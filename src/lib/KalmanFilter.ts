export class KalmanFilter {
  private Q: number; // Process noise covariance
  private R: number; // Measurement noise covariance
  private x: number = 0; // State estimate (smoothed value)
  private p: number = 1.0; // Estimation error covariance
  private k: number = 0; // Kalman gain
  private initialized: boolean = false;

  constructor(processNoise = 0.1, measurementNoise = 8.0) {
    this.Q = processNoise;
    this.R = measurementNoise;
  }

  public filter(measurement: number): number {
    if (!this.initialized) {
      this.x = measurement;
      this.p = 1.0;
      this.initialized = true;
      return this.x;
    }

    // Prediction update
    this.p = this.p + this.Q;

    // Measurement update (Correction)
    this.k = this.p / (this.p + this.R);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;

    return this.x;
  }

  public reset(): void {
    this.initialized = false;
    this.x = 0;
    this.p = 1.0;
    this.k = 0;
  }

  public setNoiseParameters(processNoise: number, measurementNoise: number): void {
    this.Q = processNoise;
    this.R = measurementNoise;
  }
}
