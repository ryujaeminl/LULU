export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface GazeFeatures {
  pitch: number;          // Eye pitch estimate (relative iris Y deviation)
  yaw: number;            // Eye yaw estimate (relative iris X deviation)
  headPitch: number;      // Head pitch (radians)
  headYaw: number;        // Head yaw (radians)
  headRoll: number;       // Head roll (radians)
  leftEyeOpenness: number; // Left EAR (Eye Aspect Ratio) or Blendshape value
  rightEyeOpenness: number; // Right EAR
  faceScale: number;      // Normalized size of the face bounding box
  cameraDistance: number; // Estimated Z distance
  leftEyePitch?: number;
  leftEyeYaw?: number;
  rightEyePitch?: number;
  rightEyeYaw?: number;
}

export interface CalibrationSample {
  features: GazeFeatures;
  targetX: number;
  targetY: number;
}

export interface CalibrationPoint {
  id: string;
  x: number; // normalized screen X [0..1]
  y: number; // normalized screen Y [0..1]
  samples: GazeFeatures[];
  status: 'pending' | 'collecting' | 'completed';
}

export type CalibrationMode = '25' | '49';

export type BlinkType = 'none' | 'single' | 'double' | 'long';

export type IntentMode = 'dwell' | 'double_blink' | 'long_blink';

export type FilterMode = 'kalman' | 'oneeuro' | 'combined';

export interface GazeErrorState {
  noFaceDetected: boolean;
  tooFar: boolean;
  tooClose: boolean;
  poorLighting: boolean;
  faceObstructed: boolean;
  cameraJitter: boolean;
}

export interface GazeState {
  rawX: number;
  rawY: number;
  smoothedX: number;
  smoothedY: number;
  gazedElementId: string;
  gazedElementText: string;
  isEyesClosed: boolean;
  blinkDetected: BlinkType;
  errorState: GazeErrorState;
  fps: number;
}
