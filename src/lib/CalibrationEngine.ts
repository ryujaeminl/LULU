import { CalibrationPoint, CalibrationMode, GazeFeatures, CalibrationSample } from '../types/gaze';
import { filterOutliersIQR } from '../utils/Math';

export class CalibrationEngine {
  private mode: CalibrationMode = '25';
  private points: CalibrationPoint[] = [];
  private currentPointIndex = -1;
  private maxSamplesPerPoint = 20; // 20 frames target

  constructor(mode: CalibrationMode = '25') {
    this.setMode(mode);
  }

  public setMode(mode: CalibrationMode): void {
    this.mode = mode;
    this.points = this.generateGridPoints(mode);
    this.currentPointIndex = -1;
  }

  private generateGridPoints(mode: CalibrationMode): CalibrationPoint[] {
    const gridPoints: CalibrationPoint[] = [];
    const size = mode === '25' ? 5 : 7;
    const step = 0.76 / (size - 1); // bounds [0.12 ... 0.88]

    for (let r = 0; r < size; r++) {
      // Even rows: Left-to-Right. Odd rows: Right-to-Left (continuous snake path)
      const isEvenRow = r % 2 === 0;
      for (let c = 0; c < size; c++) {
        const colIndex = isEvenRow ? c : (size - 1 - c);
        const x = 0.12 + colIndex * step;
        const y = 0.12 + r * step;
        const id = `calib_${r}_${colIndex}`;
        gridPoints.push({
          id,
          x,
          y,
          samples: [],
          status: 'pending'
        });
      }
    }

    // Do NOT shuffle randomly; return the sequential zigzag snake path for smooth gaze tracking
    return gridPoints;
  }

  public getPoints(): CalibrationPoint[] {
    return this.points;
  }

  public getCurrentPoint(): CalibrationPoint | null {
    if (this.currentPointIndex >= 0 && this.currentPointIndex < this.points.length) {
      return this.points[this.currentPointIndex];
    }
    return null;
  }

  public startCalibration(): void {
    this.points.forEach(p => {
      p.samples = [];
      p.status = 'pending';
    });
    this.currentPointIndex = 0;
    if (this.points.length > 0) {
      this.points[0].status = 'collecting';
    }
  }

  public nextPoint(): boolean {
    if (this.currentPointIndex >= 0 && this.currentPointIndex < this.points.length) {
      this.points[this.currentPointIndex].status = 'completed';
    }
    this.currentPointIndex++;
    if (this.currentPointIndex < this.points.length) {
      this.points[this.currentPointIndex].status = 'collecting';
      return true;
    }
    return false; // completed all points
  }

  public addSample(features: GazeFeatures): boolean {
    const active = this.getCurrentPoint();
    if (!active) return false;

    active.samples.push(features);
    
    // Returns true when enough samples are collected for the active point
    if (active.samples.length >= this.maxSamplesPerPoint) {
      active.status = 'completed';
      return true;
    }
    return false;
  }

  /**
   * Process and clean all collected calibration points using IQR.
   * Compiles the samples into clean training data for the regression engine.
   */
  public compileCleanTrainingData(
    screenWidth: number,
    screenHeight: number
  ): { input: number[]; target: number[] }[] {
    const trainingData: { input: number[]; target: number[] }[] = [];

    for (const point of this.points) {
      const N = point.samples.length;
      if (N === 0) continue;

      // Filter outliers on critical gaze features (Pitch, Yaw)
      const pitches = point.samples.map(s => s.pitch);
      const yaws = point.samples.map(s => s.yaw);
      
      const pitchKeep = filterOutliersIQR(pitches);
      const yawKeep = filterOutliersIQR(yaws);

      const targetX = point.x * screenWidth;
      const targetY = point.y * screenHeight;

      for (let i = 0; i < N; i++) {
        // Drop frames containing blink/saccadic noise in eye tracking
        if (pitchKeep[i] && yawKeep[i]) {
          const sample = point.samples[i];
          trainingData.push({
            input: [
              sample.pitch,
              sample.yaw,
              sample.headPitch,
              sample.headYaw,
              sample.headRoll,
              sample.leftEyeOpenness,
              sample.faceScale,
              sample.cameraDistance
            ],
            target: [targetX, targetY]
          });
        }
      }
    }

    return trainingData;
  }

  public getProgress(): number {
    if (this.points.length === 0) return 0;
    const completedCount = this.points.filter(p => p.status === 'completed').length;
    
    const active = this.getCurrentPoint();
    const activeProgress = active ? active.samples.length / this.maxSamplesPerPoint : 0;
    
    return ((completedCount + activeProgress) / this.points.length) * 100;
  }
}
