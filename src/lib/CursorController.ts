import { KalmanFilter } from './KalmanFilter';
import { OneEuroFilter } from './OneEuroFilter';
import { Point2D } from '../types/gaze';

export class CursorController {
  private kalmanX = new KalmanFilter(0.12, 10.0);
  private kalmanY = new KalmanFilter(0.12, 10.0);
  
  // Adaptive One Euro Filters
  private oneEuroX = new OneEuroFilter(0.8, 0.03, 1.0);
  private oneEuroY = new OneEuroFilter(0.8, 0.03, 1.0);

  private lastX: number | null = null;
  private lastY: number | null = null;
  private lastTime: number | null = null;

  // Velocity threshold for Saccades (pixels per millisecond)
  private saccadeSpeedThreshold = 1.8; // ~1800 px/sec

  /**
   * Filter raw screen coordinates and return stabilized coordinates.
   */
  public update(rawX: number, rawY: number, timestamp: number): Point2D {
    if (this.lastX === null || this.lastY === null || this.lastTime === null) {
      this.lastX = rawX;
      this.lastY = rawY;
      this.lastTime = timestamp;
      
      this.kalmanX.reset();
      this.kalmanY.reset();
      this.oneEuroX.reset();
      this.oneEuroY.reset();
      
      return { x: rawX, y: rawY };
    }

    const dt = Math.max(1, timestamp - this.lastTime);
    const dx = rawX - this.lastX;
    const dy = rawY - this.lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = distance / dt; // pixels per ms

    let filteredX = rawX;
    let filteredY = rawY;

    if (speed > this.saccadeSpeedThreshold) {
      // SACCADE (Fast Eye Movement): Bypass heavy filters to avoid lag
      // Snap to target immediately, resetting the internal filter state
      this.kalmanX.reset();
      this.kalmanY.reset();
      
      filteredX = this.oneEuroX.filter(rawX, timestamp);
      filteredY = this.oneEuroY.filter(rawY, timestamp);
    } else {
      // FIXATION (Static Gaze): Cascaded Kalman -> One Euro Filter
      // First pass: Kalman Filter for macro drift suppression
      const kX = this.kalmanX.filter(rawX);
      const kY = this.kalmanY.filter(rawY);

      // Second pass: One Euro Filter for micro-jitter suppression
      filteredX = this.oneEuroX.filter(kX, timestamp);
      filteredY = this.oneEuroY.filter(kY, timestamp);
    }

    this.lastX = filteredX;
    this.lastY = filteredY;
    this.lastTime = timestamp;

    return { x: filteredX, y: filteredY };
  }

  public reset(): void {
    this.lastX = null;
    this.lastY = null;
    this.lastTime = null;
    
    this.kalmanX.reset();
    this.kalmanY.reset();
    this.oneEuroX.reset();
    this.oneEuroY.reset();
  }
}
