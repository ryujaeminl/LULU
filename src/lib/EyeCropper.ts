import { Point3D } from '../types/gaze';
import { getEyeCropBox } from '../utils/Geometry';

export class EyeCropper {
  // Standard MediaPipe FaceMesh indices for Left Eye Contour
  private static leftEyeIndices = [
    33, 7, 163, 144, 145, 153, 154, 155, 
    133, 173, 157, 158, 159, 160, 161, 246
  ];

  // Standard MediaPipe FaceMesh indices for Right Eye Contour
  private static rightEyeIndices = [
    362, 382, 381, 380, 374, 373, 390, 249, 
    263, 466, 388, 387, 386, 385, 384, 398
  ];

  /**
   * Estimates crop bounding box coordinates for the left eye,
   * scaled normalized to [0..1] of video dimensions.
   */
  public getLeftEyeBox(landmarks: Point3D[], padding = 0.25) {
    return getEyeCropBox(landmarks, EyeCropper.leftEyeIndices, padding);
  }

  /**
   * Estimates crop bounding box coordinates for the right eye,
   * scaled normalized to [0..1] of video dimensions.
   */
  public getRightEyeBox(landmarks: Point3D[], padding = 0.25) {
    return getEyeCropBox(landmarks, EyeCropper.rightEyeIndices, padding);
  }

  /**
   * Crops the eye region out of an HTMLVideoElement and draws it to a canvas context
   */
  public cropEyeToCanvas(
    video: HTMLVideoElement,
    landmarks: Point3D[],
    eye: 'left' | 'right',
    destCanvasCtx: CanvasRenderingContext2D,
    padding = 0.25
  ): void {
    const box = eye === 'left' 
      ? this.getLeftEyeBox(landmarks, padding)
      : this.getRightEyeBox(landmarks, padding);

    const vidW = video.videoWidth;
    const vidH = video.videoHeight;

    const sx = box.x * vidW;
    const sy = box.y * vidH;
    const sWidth = box.width * vidW;
    const sHeight = box.height * vidH;

    const dx = 0;
    const dy = 0;
    const dWidth = destCanvasCtx.canvas.width;
    const dHeight = destCanvasCtx.canvas.height;

    destCanvasCtx.clearRect(dx, dy, dWidth, dHeight);
    
    // Draw cropped video frame
    try {
      destCanvasCtx.drawImage(
        video,
        sx, sy, sWidth, sHeight,
        dx, dy, dWidth, dHeight
      );
    } catch (e) {
      // Occasional frame sync issues, ignore silently
    }
  }
}
