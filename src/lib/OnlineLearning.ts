import { GazeFeatures } from '../types/gaze';
import { RegressionEngine, TrainingSample } from './RegressionEngine';
import { saveModelWeights } from './PineconeClient';

export class OnlineLearning {
  private baseSamples: TrainingSample[] = [];
  private onlineSamples: TrainingSample[] = [];
  private maxOnlineSamples = 150;
  private sessionId: string;
  private isTraining = false;

  constructor(private regressionEngine: RegressionEngine, sessionId = 'default') {
    this.sessionId = sessionId;
  }

  public setBaseSamples(samples: TrainingSample[]): void {
    this.baseSamples = [...samples];
  }

  public setSessionId(id: string): void {
    this.sessionId = id;
  }

  public addImplicitSample(features: GazeFeatures, screenX: number, screenY: number): void {
    const input = [
      features.pitch,
      features.yaw,
      features.headPitch,
      features.headYaw,
      features.headRoll,
      features.leftEyeOpenness,
      features.faceScale,
      features.cameraDistance,
    ];

    const sample: TrainingSample = { input, target: [screenX, screenY] };
    this.onlineSamples.push(sample);
    if (this.onlineSamples.length > this.maxOnlineSamples) {
      this.onlineSamples.shift();
    }

    this.trainInBackground();
  }

  private trainInBackground(): void {
    if (this.isTraining) return; // Prevent concurrent training runs

    const combinedSamples = [...this.baseSamples, ...this.onlineSamples];
    if (combinedSamples.length === 0) return;

    // Safety guard: do not retrain if base samples are missing or too small
    if (this.baseSamples.length < 5) {
      console.warn('[OnlineLearning] Skipping training: base samples are missing or too small.');
      return;
    }

    this.isTraining = true;

    setTimeout(() => {
      console.log(
        `[OnlineLearning] Training — Base: ${this.baseSamples.length}, Online: ${this.onlineSamples.length}`
      );
      try {
        this.regressionEngine.train(combinedSamples, 20, 0.002); // Reduced epochs and learning rate for stability
        this.regressionEngine.computeCalibrationDeltas(this.baseSamples); // Recompute correction anchors
        const serialized = this.regressionEngine.saveModel();
        
        // Save to localStorage (fast / offline)
        localStorage.setItem('lulu_trained_mlp', serialized);

        // Save to Pinecone (async, fire-and-forget)
        saveModelWeights(this.sessionId, serialized).catch(() => {});

        console.log('[OnlineLearning] Model saved to localStorage + Pinecone');
      } catch (err) {
        console.error('[OnlineLearning] Failed to save model:', err);
      } finally {
        this.isTraining = false;
      }
    }, 100);
  }

  public reset(): void {
    this.onlineSamples = [];
  }
}
