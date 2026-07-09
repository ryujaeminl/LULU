import { HeadPose } from '../types/gaze';

/**
 * Decomposes Euler angles (Pitch, Yaw, Roll) from a 4x4 transformation matrix.
 * MediaPipe face landmarker transformation matrix is column-major:
 * [
 *   m00, m10, m20, m30, // Column 0 (Right direction vector)
 *   m01, m11, m21, m31, // Column 1 (Up direction vector)
 *   m02, m12, m22, m32, // Column 2 (Forward/normal direction vector)
 *   m03, m13, m23, m33  // Column 3 (Translation vector)
 * ]
 */
export function getEulerAnglesFromTransformMatrix(m: number[]): HeadPose {
  if (m.length < 16) {
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  // Decompose column-major rotation vectors
  // R02 = m[8], R12 = m[9], R22 = m[10]
  // R10 = m[1], R11 = m[5], R12 = m[9]
  // R00 = m[0], R01 = m[4], R02 = m[8]
  
  const r12 = m[9];
  const r22 = m[10];
  const r02 = m[8];
  const r10 = m[1];
  const r11 = m[5];

  let pitch = 0;
  let yaw = 0;
  let roll = 0;

  // Decompose rotation sequence YXZ (Yaw, Pitch, Roll)
  if (Math.abs(r12) < 0.99999) {
    pitch = Math.asin(-r12);
    yaw = Math.atan2(r02, r22);
    roll = Math.atan2(r10, r11);
  } else {
    // Gimbal lock case
    pitch = r12 > 0 ? -Math.PI / 2 : Math.PI / 2;
    yaw = Math.atan2(-r02, r11); // Approximated
    roll = 0;
  }

  return { pitch, yaw, roll };
}

/**
 * Geometric backup head pose estimation in case transformation matrix is unavailable.
 * Uses key facial landmarks to calculate Pitch, Yaw, Roll.
 */
export function estimateHeadPoseGeometrically(
  nose: { x: number; y: number; z: number },
  leftFace: { x: number; y: number; z: number },
  rightFace: { x: number; y: number; z: number },
  topFace: { x: number; y: number; z: number },
  bottomFace: { x: number; y: number; z: number }
): HeadPose {
  // Yaw: horizontal asymmetry of nose relative to face bounds
  const faceWidth = Math.max(0.0001, Math.abs(rightFace.x - leftFace.x));
  const horizontalDiff = nose.x - (leftFace.x + rightFace.x) / 2;
  const yaw = (horizontalDiff / faceWidth) * 1.5; // Scale to approximate radians

  // Pitch: vertical asymmetry of nose relative to top/bottom face bounds
  const faceHeight = Math.max(0.0001, Math.abs(bottomFace.y - topFace.y));
  const verticalDiff = nose.y - (topFace.y + bottomFace.y) / 2;
  const pitch = (verticalDiff / faceHeight) * 1.5;

  // Roll: angle between left and right face landmarks
  const dx = rightFace.x - leftFace.x;
  const dy = rightFace.y - leftFace.y;
  const roll = Math.atan2(dy, dx);

  return { pitch, yaw, roll };
}
