export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 0.8, beta = 0.03, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, rate: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(value: number, timestamp: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = value;
      this.tPrev = timestamp;
      this.dxPrev = 0;
      return value;
    }

    const dt = (timestamp - this.tPrev) / 1000.0; // convert to seconds
    if (dt <= 0) {
      return this.xPrev;
    }

    const rate = 1.0 / dt;

    // Calculate derivative of the signal
    const dx = (value - this.xPrev) * rate;
    // Filter derivative
    const alphaD = this.alpha(this.dCutoff, rate);
    const edx = this.dxPrev + alphaD * (dx - this.dxPrev);

    // Calculate dynamic cutoff frequency based on velocity
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // Filter value
    const alphaV = this.alpha(cutoff, rate);
    const x = this.xPrev + alphaV * (value - this.xPrev);

    // Save history
    this.xPrev = x;
    this.dxPrev = edx;
    this.tPrev = timestamp;

    return x;
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  public updateParams(minCutoff: number, beta: number): void {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }
}
