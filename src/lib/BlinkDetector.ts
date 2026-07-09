import { BlinkType } from '../types/gaze';

export class BlinkDetector {
  private eyesClosed = false;
  private closedStartTime: number | null = null;
  private longBlinkTriggered = false;
  private lastBlinkEndTime: number | null = null;
  private blinkBuffer: number[] = []; // Timestamps of recent completed blinks
  
  // Settings
  private blinkThreshold = 0.55; // Blendshape blink value or 1 - EAR normalization
  private minBlinkDuration = 80; // ms
  private maxBlinkDuration = 500; // ms
  private longBlinkDuration = 650; // ms
  private doubleBlinkWindow = 1000; // ms

  /**
   * Process a frame's eye closure scores (0.0 = fully open, 1.0 = fully closed).
   * Returns a detected BlinkType.
   */
  public update(
    leftClosedScore: number,
    rightClosedScore: number,
    timestamp: number
  ): { isClosed: boolean; trigger: BlinkType } {
    // We average left and right to detect unified voluntary blinking
    const avgScore = (leftClosedScore + rightClosedScore) / 2;
    const currentlyClosed = avgScore >= this.blinkThreshold;
    let trigger: BlinkType = 'none';

    if (currentlyClosed && !this.eyesClosed) {
      // Transition: Eyes just closed
      this.eyesClosed = true;
      this.closedStartTime = timestamp;
      this.longBlinkTriggered = false;
    } else if (currentlyClosed && this.eyesClosed) {
      // Eyes remain closed: Check for long blink trigger
      if (this.closedStartTime !== null && !this.longBlinkTriggered) {
        const duration = timestamp - this.closedStartTime;
        if (duration >= this.longBlinkDuration) {
          this.longBlinkTriggered = true;
          trigger = 'long';
        }
      }
    } else if (!currentlyClosed && this.eyesClosed) {
      // Transition: Eyes just opened
      this.eyesClosed = false;
      
      if (this.closedStartTime !== null) {
        const duration = timestamp - this.closedStartTime;
        this.closedStartTime = null;

        // Only count as normal blink if it wasn't already triggered as a long blink
        if (!this.longBlinkTriggered && duration >= this.minBlinkDuration && duration <= this.maxBlinkDuration) {
          const now = timestamp;
          this.blinkBuffer.push(now);
          // Keep only blinks within the double blink window
          this.blinkBuffer = this.blinkBuffer.filter(t => now - t <= this.doubleBlinkWindow);

          if (this.blinkBuffer.length >= 2) {
            trigger = 'double';
            this.blinkBuffer = []; // Reset buffer
          } else {
            // Check if it's a single blink (we wait briefly or trigger immediately depending on strictness)
            // For real-time click response, we trigger 'single' immediately.
            trigger = 'single';
          }
        }
      }
    }

    return { isClosed: currentlyClosed, trigger };
  }

  public setThreshold(threshold: number): void {
    this.blinkThreshold = threshold;
  }

  public reset(): void {
    this.eyesClosed = false;
    this.closedStartTime = null;
    this.longBlinkTriggered = false;
    this.lastBlinkEndTime = null;
    this.blinkBuffer = [];
  }
}
