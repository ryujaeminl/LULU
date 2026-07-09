import { HeadPose, Point3D } from '../types/gaze';
import { getEulerAnglesFromTransformMatrix, estimateHeadPoseGeometrically } from '../utils/Matrix';

export class HeadPoseEstimator {
  /**
   * Estimates head pose angles (pitch, yaw, roll) using facial transformation matrix
   * or landmark-based geometric fallbacks.
   */
  public estimate(
    landmarks: Point3D[],
    transformMatrix?: number[]
  ): HeadPose {
    // If MediaPipe provides the transformation matrix, use it
    if (transformMatrix && transformMatrix.length === 16) {
      return getEulerAnglesFromTransformMatrix(transformMatrix);
    }

    // Fallback: Geometric estimation
    // Landmarks used:
    // 1: Nose tip
    // 234: Left face outer edge
    // 454: Right face outer edge
    // 10: Top face hairline edge
    // 152: Bottom face chin edge
    const nose = landmarks[1];
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];
    const topFace = landmarks[10];
    const bottomFace = landmarks[152];

    if (!nose || !leftFace || !rightFace || !topFace || !bottomFace) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    return estimateHeadPoseGeometrically(nose, leftFace, rightFace, topFace, bottomFace);
  }
}
