import { useEffect, useRef, useState, useCallback } from 'react';
import { GazeState, GazeFeatures, BlinkType, IntentMode, GazeErrorState, CalibrationMode } from '../types/gaze';
import { MediaPipeEngine } from '../lib/MediaPipeEngine';
import { RegressionEngine } from '../lib/RegressionEngine';
import { CalibrationEngine } from '../lib/CalibrationEngine';
import { CursorController } from '../lib/CursorController';
import { BlinkDetector } from '../lib/BlinkDetector';
import { HeadPoseEstimator } from '../lib/HeadPoseEstimator';
import { EyeCropper } from '../lib/EyeCropper';
import { OnlineLearning } from '../lib/OnlineLearning';
import { saveCalibrationData, saveModelWeights, loadCalibrationData, loadModelWeights } from '../lib/PineconeClient';

export function useEyeTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  leftEyeCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  rightEyeCanvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  // Engine Instances
  const mediaPipeRef = useRef(new MediaPipeEngine());
  const regressionRef = useRef(new RegressionEngine());
  const calibrationRef = useRef(new CalibrationEngine('25'));
  const cursorRef = useRef(new CursorController());
  const blinkRef = useRef(new BlinkDetector());
  const headPoseRef = useRef(new HeadPoseEstimator());
  const cropperRef = useRef(new EyeCropper());
  const onlineLearningRef = useRef<OnlineLearning | null>(null);

  // Settings & States
  const [isInitializing, setIsInitializing] = useState(false);
  const [initStatus, setInitStatus] = useState("Camera Offline");
  const [isReady, setIsReady] = useState(false);
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [gazeState, setGazeState] = useState<GazeState>({
    rawX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    rawY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    smoothedX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    smoothedY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    gazedElementId: '',
    gazedElementText: '',
    isEyesClosed: false,
    blinkDetected: 'none',
    errorState: {
      noFaceDetected: false,
      tooFar: false,
      tooClose: false,
      poorLighting: false,
      faceObstructed: false,
      cameraJitter: false
    },
    fps: 0
  });

  // Mirrors the latest coordinates without forcing processFrame to be
  // recreated on every render (setGazeState fires ~60x/sec).
  const coordsRef = useRef({
    rawX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    rawY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    smoothedX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    smoothedY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  });

  const [intentMode, setIntentMode] = useState<IntentMode>('dwell');
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>('25');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibPoint, setCalibPoint] = useState<{ x: number; y: number } | null>(null);

  // Dwell timer variables
  const dwellTime = useRef(1200);
  const lastTargetRef = useRef<HTMLElement | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const lastTargetTimeRef = useRef<number>(0);

  // Feature smoothing filters
  const filtersInitialized = useRef(false);
  const smoothedLeftEyeYaw = useRef<number>(0);
  const smoothedLeftEyePitch = useRef<number>(0);
  const smoothedRightEyeYaw = useRef<number>(0);
  const smoothedRightEyePitch = useRef<number>(0);
  const smoothedHeadPitch = useRef<number>(0);
  const smoothedHeadYaw = useRef<number>(0);
  const smoothedHeadRoll = useRef<number>(0);

  // Frame counting for FPS
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());
  const activeLoop = useRef(true);

  // Saccade delay guard (ignore coordinates transition right after calibration dot moves)
  const dotChangedTime = useRef<number>(0);

  // Lazy load local model
  useEffect(() => {
    onlineLearningRef.current = new OnlineLearning(regressionRef.current);

    // Load historical model if saved
    const saved = localStorage.getItem('lulu_trained_mlp');
    if (saved) {
      const ok = regressionRef.current.loadModel(saved);
      if (ok) {
        console.log("[useEyeTracking] Loaded previously trained MLP model.");
        setIsModelTrained(true);

        // Also load base samples for Online Learning
        const savedSamples = localStorage.getItem('lulu_calibration_samples');
        if (savedSamples && onlineLearningRef.current) {
          try {
            const samples = JSON.parse(savedSamples);
            onlineLearningRef.current.setBaseSamples(samples);
            console.log("[useEyeTracking] Loaded base calibration samples for Online Learning.");
          } catch (e) {
            console.error("Failed to parse saved calibration samples:", e);
          }
        }

        // Load session ID if saved
        const savedSessionId = localStorage.getItem('lulu_session_id');
        if (savedSessionId && onlineLearningRef.current) {
          onlineLearningRef.current.setSessionId(savedSessionId);
        }
      }
    }
  }, []);

  const triggerClickAt = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement;
    if (!el) return;

    // Play subtle audio response
    const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== "); // 0.1s beep
    audio.volume = 0.15;
    audio.play().catch(() => { });

    // Dispatch DOM click
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });
    el.dispatchEvent(clickEvent);

    // Online Learning trigger
    if (regressionRef.current.getIsTrained() && onlineLearningRef.current && latestFeatures.current) {
      const gazeable = el.closest('.gazeable') as HTMLElement;
      if (gazeable) {
        const rect = gazeable.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        // Stability Guard: only train if current eye prediction coordinates x, y 
        // are reasonably close to the target element (within 180px) and eyes are open.
        const dx = x - targetX;
        const dy = y - targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const eyesOpen = latestFeatures.current.leftEyeOpenness > 0.6 && latestFeatures.current.rightEyeOpenness > 0.6;

        if (dist < 180 && eyesOpen) {
          onlineLearningRef.current.addImplicitSample(latestFeatures.current, targetX, targetY);
        } else {
          console.log(`[OnlineLearning] Sample rejected — dist: ${dist.toFixed(1)}px, eyesOpen: ${eyesOpen}`);
        }
      }
    }
  }, []);

  const latestFeatures = useRef<GazeFeatures | null>(null);

  // Frame processing loop
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || !activeLoop.current) {
      return;
    }

    const timestamp = performance.now();
    frameCount.current++;

    // Calculate FPS
    if (timestamp - lastFpsTime.current >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / (timestamp - lastFpsTime.current));
      setGazeState(prev => ({ ...prev, fps }));
      frameCount.current = 0;
      lastFpsTime.current = timestamp;
    }

    // Canvas preview rendering
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (canvas && ctx) {
      ctx.save();
      // Mirror horizontal for natural feedback
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    const landmarkerResult = mediaPipeRef.current.detect(video);
    if (landmarkerResult === null) {
      // Throttled or video not ready — skip frame silently without modifying state
      return;
    }

    const errorState: GazeErrorState = {
      noFaceDetected: false,
      tooFar: false,
      tooClose: false,
      poorLighting: false,
      faceObstructed: false,
      cameraJitter: false
    };

    if (!landmarkerResult.faceLandmarks || landmarkerResult.faceLandmarks.length === 0) {
      errorState.noFaceDetected = true;
      setGazeState(prev => ({ ...prev, errorState }));
      return;
    }

    const landmarks = landmarkerResult.faceLandmarks[0];
    const blendshapes = landmarkerResult.faceBlendshapes?.[0]?.categories || [];
    const transformMatrix = landmarkerResult.facialTransformationMatrixes?.[0]?.data || [];

    // 1. Head Pose Estimation
    const headPose = headPoseRef.current.estimate(landmarks, transformMatrix);

    // 2. Eye Landmark extraction & Iris estimation
    // Left eye landmarks
    const outerL = landmarks[33];
    const innerL = landmarks[133];
    const topL = landmarks[159];
    const bottomL = landmarks[145];
    const irisL = landmarks[468]; // Iris center Left

    // Right eye landmarks
    const innerR = landmarks[362];
    const outerR = landmarks[263];
    const topR = landmarks[386];
    const bottomR = landmarks[374];
    const irisR = landmarks[473]; // Iris center Right

    if (!outerL || !innerL || !topL || !bottomL || !irisL || !innerR || !outerR || !topR || !bottomR || !irisR) {
      errorState.faceObstructed = true;
      setGazeState(prev => ({ ...prev, errorState }));
      return;
    }

    // Crop eyes and draw to small canvases (throttled to save CPU/GPU cycles)
    if (frameCount.current % 5 === 0) {
      if (leftEyeCanvasRef.current) {
        const leftCtx = leftEyeCanvasRef.current.getContext('2d');
        if (leftCtx) cropperRef.current.cropEyeToCanvas(video, landmarks, 'left', leftCtx);
      }
      if (rightEyeCanvasRef.current) {
        const rightCtx = rightEyeCanvasRef.current.getContext('2d');
        if (rightCtx) cropperRef.current.cropEyeToCanvas(video, landmarks, 'right', rightCtx);
      }
    }

    // Overlay iris indicators on primary preview canvas
    if (canvas && ctx) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(irisL.x * canvas.width, irisL.y * canvas.height, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(irisR.x * canvas.width, irisR.y * canvas.height, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // Pupil relative ratios (normalised coordinates invariant to eye scale and blinking)
    const leftEyeWidth = Math.max(0.0001, Math.abs(innerL.x - outerL.x));
    const rightEyeWidth = Math.max(0.0001, Math.abs(outerR.x - innerR.x));
    const leftEyeCenterX = (innerL.x + outerL.x) / 2;
    const leftEyeCenterY = (topL.y + bottomL.y) / 2;

    // Head-pose perspective projection compensation (scale coordinates by cosine of yaw/pitch)
    const cosYaw = Math.abs(Math.cos(headPose.yaw));
    const cosPitch = Math.abs(Math.cos(headPose.pitch));
    const factorX = cosYaw > 0.3 ? cosYaw : 1.0;
    const factorY = cosPitch > 0.3 ? cosPitch : 1.0;

    const leftIrisRatioX = ((irisL.x - leftEyeCenterX) / leftEyeWidth) / factorX;
    const leftIrisRatioY = ((irisL.y - leftEyeCenterY) / leftEyeWidth) / factorY; // Corrected for vertical foreshortening

    const rightEyeCenterX = (innerR.x + outerR.x) / 2;
    const rightEyeCenterY = (topR.y + bottomR.y) / 2;
    const rightIrisRatioX = ((irisR.x - rightEyeCenterX) / rightEyeWidth) / factorX;
    const rightIrisRatioY = ((irisR.y - rightEyeCenterY) / rightEyeWidth) / factorY; // Corrected for vertical foreshortening

    // Left eye pitch/yaw estimation from relative iris displacements
    const leftEyeYaw = leftIrisRatioX * 20.0;
    const leftEyePitch = leftIrisRatioY * 20.0;

    // Right eye pitch/yaw estimation from relative iris displacements
    const rightEyeYaw = rightIrisRatioX * 20.0;
    const rightEyePitch = rightIrisRatioY * 20.0;

    // Eye Openness / EAR score
    let leftOpenness = 1.0;
    let rightOpenness = 1.0;

    // Extract blendshapes for blinks if available
    const blinkLeftBs = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkLeft');
    const blinkRightBs = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkRight');

    if (blinkLeftBs && blinkRightBs) {
      leftOpenness = 1.0 - blinkLeftBs.score;
      rightOpenness = 1.0 - blinkRightBs.score;
    } else {
      // Geometric EAR fallback
      const EAR_L = (Math.abs(landmarks[160].y - landmarks[144].y) + Math.abs(landmarks[158].y - landmarks[153].y)) / (2 * leftEyeWidth);
      const EAR_R = (Math.abs(landmarks[385].y - landmarks[380].y) + Math.abs(landmarks[387].y - landmarks[373].y)) / (2 * rightEyeWidth);
      leftOpenness = Math.min(1.0, EAR_L * 3.0);
      rightOpenness = Math.min(1.0, EAR_R * 3.0);
    }

    // Face scale (bounding box size) and camera distance estimation
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];
    const faceScale = Math.max(0.0001, Math.abs(rightFace.x - leftFace.x));
    const cameraDistance = Math.abs(landmarks[1].z); // Nose depth z

    // Lighting check (Throttled to once every 100 frames to prevent severe GPU stalls)
    if (canvas && ctx && frameCount.current % 100 === 0) {
      try {
        const pixelData = ctx.getImageData(0, 0, 10, 10).data;
        let brightnessSum = 0;
        for (let i = 0; i < pixelData.length; i += 4) {
          brightnessSum += (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3;
        }
        const avgBrightness = brightnessSum / (pixelData.length / 4);
        if (avgBrightness < 35) {
          errorState.poorLighting = true;
        }
      } catch (e) {
        // cross-origin canvas error safety
      }
    }

    if (faceScale < 0.12) {
      errorState.tooFar = true;
    } else if (faceScale > 0.45) {
      errorState.tooClose = true;
    }

    // EMA Smoothing for raw features before prediction & training
    if (!filtersInitialized.current) {
      smoothedLeftEyeYaw.current = leftEyeYaw;
      smoothedLeftEyePitch.current = leftEyePitch;
      smoothedRightEyeYaw.current = rightEyeYaw;
      smoothedRightEyePitch.current = rightEyePitch;
      smoothedHeadPitch.current = headPose.pitch;
      smoothedHeadYaw.current = headPose.yaw;
      smoothedHeadRoll.current = headPose.roll;
      filtersInitialized.current = true;
    } else {
      smoothedLeftEyeYaw.current = smoothedLeftEyeYaw.current * 0.65 + leftEyeYaw * 0.35;
      smoothedLeftEyePitch.current = smoothedLeftEyePitch.current * 0.65 + leftEyePitch * 0.35;
      smoothedRightEyeYaw.current = smoothedRightEyeYaw.current * 0.65 + rightEyeYaw * 0.35;
      smoothedRightEyePitch.current = smoothedRightEyePitch.current * 0.65 + rightEyePitch * 0.35;
      smoothedHeadPitch.current = smoothedHeadPitch.current * 0.75 + headPose.pitch * 0.25;
      smoothedHeadYaw.current = smoothedHeadYaw.current * 0.75 + headPose.yaw * 0.25;
      smoothedHeadRoll.current = smoothedHeadRoll.current * 0.75 + headPose.roll * 0.25;
    }

    // Construct features
    const features: GazeFeatures = {
      pitch: (smoothedLeftEyePitch.current + smoothedRightEyePitch.current) / 2,
      yaw: (smoothedLeftEyeYaw.current + smoothedRightEyeYaw.current) / 2,
      headPitch: smoothedHeadPitch.current,
      headYaw: smoothedHeadYaw.current,
      headRoll: smoothedHeadRoll.current,
      leftEyeOpenness: leftOpenness,
      rightEyeOpenness: rightOpenness,
      faceScale,
      cameraDistance,
      leftEyePitch: smoothedLeftEyePitch.current,
      leftEyeYaw: smoothedLeftEyeYaw.current,
      rightEyePitch: smoothedRightEyePitch.current,
      rightEyeYaw: smoothedRightEyeYaw.current
    };

    latestFeatures.current = features;

    // --- Blink Detector ---
    const blinkResult = blinkRef.current.update(1.0 - leftOpenness, 1.0 - rightOpenness, timestamp);

    // --- Calibration Mode ---
    if (isCalibrating) {
      const active = calibrationRef.current.getCurrentPoint();
      if (active) {
        setCalibPoint({ x: active.x, y: active.y });
        setCalibrationProgress(calibrationRef.current.getProgress());

        // Wait 600ms right after the point moves (saccade guard)
        if (Date.now() - dotChangedTime.current >= 600) {
          const completedPoint = calibrationRef.current.addSample(features);
          if (completedPoint) {
            // Point target acquired!
            const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ");
            audio.volume = 0.05;
            audio.play().catch(() => { });

            const hasNext = calibrationRef.current.nextPoint();
            dotChangedTime.current = Date.now();
            if (!hasNext) {
              // Calibration finished! Compile data and train
              setIsCalibrating(false);
              setCalibPoint(null);

              const samples = calibrationRef.current.compileCleanTrainingData(window.innerWidth, window.innerHeight);
              regressionRef.current.train(samples, 500, 0.012);
              regressionRef.current.computeCalibrationDeltas(samples);
              setIsModelTrained(true);

              // Base sample alignment for OnlineLearning
              if (onlineLearningRef.current) {
                onlineLearningRef.current.setBaseSamples(samples);
                onlineLearningRef.current.reset();
              }

              // Persist model to localStorage + Pinecone
              const serialized = regressionRef.current.saveModel();
              localStorage.setItem('lulu_trained_mlp', serialized);
              localStorage.setItem('lulu_calibration_samples', JSON.stringify(samples));

              // Save to Pinecone (async, fire-and-forget)
              const sessionId = `session_${Date.now()}`;
              localStorage.setItem('lulu_session_id', sessionId);
              if (onlineLearningRef.current) {
                onlineLearningRef.current.setSessionId(sessionId);
              }
              
              saveCalibrationData(sessionId, samples)
                .then(() => console.log('[useEyeTracking] Calibration data saved to Pinecone'));
              saveModelWeights(sessionId, serialized)
                .then(() => console.log('[useEyeTracking] Model weights saved to Pinecone'));

              console.log('[useEyeTracking] Calibration complete. Neural network trained.');
            }
          }
        }
      }
    }

    // --- Normal Tracking Mode ---
    let finalX = coordsRef.current.smoothedX;
    let finalY = coordsRef.current.smoothedY;
    let predictedX = coordsRef.current.rawX;
    let predictedY = coordsRef.current.rawY;

    if (regressionRef.current.getIsTrained()) {
      const pred = regressionRef.current.predict(features);
      if (pred) {
        // Clamp to screen bounds
        let px = Math.max(0, Math.min(window.innerWidth, pred.x));
        let py = Math.max(0, Math.min(window.innerHeight, pred.y));

        predictedX = px;
        predictedY = py;

        // Stabilize coordinates
        const smoothed = cursorRef.current.update(px, py, timestamp);
        finalX = Math.max(0, Math.min(window.innerWidth, smoothed.x));
        finalY = Math.max(0, Math.min(window.innerHeight, smoothed.y));
      }
    }

    // Apply Magnetic Gaze Snapping to nearest .gazeable elements to ensure 100% selection accuracy
    if (regressionRef.current.getIsTrained() && !isCalibrating) {
      const gazeables = Array.from(document.querySelectorAll('.gazeable')) as HTMLElement[];
      let nearestGazeable: HTMLElement | null = null;
      let minDistance = Infinity;
      let nearestCenter = { x: 0, y: 0 };

      for (const el of gazeables) {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
        
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = Math.max(rect.left - finalX, 0, finalX - rect.right);
        const dy = Math.max(rect.top - finalY, 0, finalY - rect.bottom);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance) {
          minDistance = dist;
          nearestGazeable = el;
          nearestCenter = { x: cx, y: cy };
        }
      }

      if (nearestGazeable && minDistance < 140) {
        const snapStrength = Math.max(0, 1 - minDistance / 140);
        const alpha = snapStrength * 0.95; // Pull gaze up to 95% towards element center
        finalX = finalX * (1 - alpha) + nearestCenter.x * alpha;
        finalY = finalY * (1 - alpha) + nearestCenter.y * alpha;
      }
    }

    // Gazeable element lookup & Dwell trigger
    let gazedId = '';
    let gazedText = '';

    if (regressionRef.current.getIsTrained() && !isCalibrating) {
      const targetEl = document.elementFromPoint(finalX, finalY) as HTMLElement;
      const gazeable = targetEl?.closest('.gazeable') as HTMLElement;

      if (gazeable) {
        gazedId = gazeable.id || targetEl.id || '';
        gazedText = gazeable.textContent?.trim().substring(0, 40) || targetEl.textContent?.trim().substring(0, 40) || '';

        // Dwell click mode logic
        if (intentMode === 'dwell') {
          if (lastTargetRef.current === gazeable) {
            lastTargetTimeRef.current = timestamp;
            if (dwellStartRef.current !== null) {
              const elapsed = timestamp - dwellStartRef.current;
              
              // Dynamic progress bar check/creation
              let progressEl = gazeable.querySelector('.gaze-progress-bar') as HTMLElement;
              if (!progressEl) {
                progressEl = document.createElement('div');
                progressEl.className = 'gaze-progress-bar';
                gazeable.appendChild(progressEl);
              }

              const percent = Math.min(100, (elapsed / dwellTime.current) * 100);
              progressEl.style.width = `${percent}%`;

              if (elapsed >= dwellTime.current) {
                // Trigger dwell click!
                triggerClickAt(finalX, finalY);
                dwellStartRef.current = null; // Reset
                progressEl.style.width = '0%';
              }
            } else {
              dwellStartRef.current = timestamp;
            }
          } else {
            // Target is different. Check if we are within the grace period (180ms)
            const timeSinceLastGaze = timestamp - lastTargetTimeRef.current;
            if (lastTargetRef.current && timeSinceLastGaze < 180) {
              // Keep the current target active (ignore the brief focus loss)
            } else {
              // Grace period expired or no previous target: perform hard reset to the new target
              if (lastTargetRef.current) {
                const progressEl = lastTargetRef.current.querySelector('.gaze-progress-bar') as HTMLElement;
                if (progressEl) progressEl.style.width = '0%';
              }
              lastTargetRef.current = gazeable;
              dwellStartRef.current = timestamp;
              lastTargetTimeRef.current = timestamp;
            }
          }
        }
      } else {
        // Looking at blank screen. Check if we are within the grace period (180ms)
        if (intentMode === 'dwell') {
          const timeSinceLastGaze = timestamp - lastTargetTimeRef.current;
          if (lastTargetRef.current && timeSinceLastGaze < 180) {
            // Keep the current target active (ignore the brief focus loss)
          } else {
            // Grace period expired: perform hard reset
            if (lastTargetRef.current) {
              const progressEl = lastTargetRef.current.querySelector('.gaze-progress-bar') as HTMLElement;
              if (progressEl) progressEl.style.width = '0%';
            }
            lastTargetRef.current = null;
            dwellStartRef.current = null;
          }
        }
      }
    }

    // --- Blink Intent Actions ---
    let blinkAction: BlinkType = 'none';
    if (blinkResult.trigger !== 'none') {
      blinkAction = blinkResult.trigger;

      // If intent selection mode matches, trigger click event
      if (!isCalibrating) {
        if (intentMode === 'double_blink' && blinkResult.trigger === 'double') {
          triggerClickAt(finalX, finalY);
        } else if (intentMode === 'long_blink' && blinkResult.trigger === 'long') {
          triggerClickAt(finalX, finalY);
        }
      }
    }

    coordsRef.current = { rawX: predictedX, rawY: predictedY, smoothedX: finalX, smoothedY: finalY };

    setGazeState(prev => ({
      ...prev,
      rawX: predictedX,
      rawY: predictedY,
      smoothedX: finalX,
      smoothedY: finalY,
      gazedElementId: gazedId,
      gazedElementText: gazedText,
      isEyesClosed: blinkResult.isClosed,
      blinkDetected: blinkAction,
      errorState
    }));
  }, [isCalibrating, intentMode, triggerClickAt, videoRef, canvasRef, leftEyeCanvasRef, rightEyeCanvasRef]);

  // Keep a stable ref to the latest processFrame so the loop effect below
  // never needs to restart just because processFrame's identity changed.
  const processFrameRef = useRef(processFrame);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  // Start frame loop once MediaPipe and Camera are online.
  // A single rAF chain is owned here (with its id tracked so it can be
  // cancelled on cleanup) instead of processFrame re-scheduling itself,
  // which previously caused a new parallel rAF chain to spawn on every
  // gazeState update (~60x/sec) and made detection effectively unusable.
  const rafIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeLoop.current = true;

    if (isReady) {
      const loop = () => {
        if (!activeLoop.current) return;
        processFrameRef.current();
        rafIdRef.current = requestAnimationFrame(loop);
      };
      rafIdRef.current = requestAnimationFrame(loop);
    }

    return () => {
      activeLoop.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isReady]);

  // Camera & Model Bootstrap
  const initEngine = useCallback(async () => {
    setIsInitializing(true);
    setInitStatus("카메라 연결 중...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      const video = videoRef.current;
      if (!video) throw new Error("Video 엘리먼트를 찾을 수 없습니다.");

      // 스트림 연결
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      // 재생 시작
      await video.play();

      // 첫 프레임이 올 때까지 대기 (최대 8초)
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 8000;
        const check = () => {
          if (
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            resolve();
          } else if (Date.now() > deadline) {
            reject(new Error("카메라 프레임 수신 타임아웃 (8초)"));
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });

      console.log(
        "[Camera Ready]",
        video.videoWidth,
        video.videoHeight,
        "readyState:",
        video.readyState
      );

      setInitStatus("MediaPipe 초기화 중...");
      await mediaPipeRef.current.initialize(setInitStatus);

      setIsReady(true);
      setIsInitializing(false);
    } catch (e: any) {
      setIsInitializing(false);
      setInitStatus(
        e?.message ? `오류: ${e.message}` : "카메라 접근 실패."
      );
      console.error("[initEngine error]", e);
    }
  }, [videoRef]);

  const startCalibrationLoop = useCallback((mode: CalibrationMode = '25') => {
    setCalibrationMode(mode);
    calibrationRef.current.setMode(mode);
    calibrationRef.current.startCalibration();

    dotChangedTime.current = Date.now();
    setIsCalibrating(true);
    setCalibrationProgress(0);
  }, []);

  const changeIntentMode = useCallback((mode: IntentMode) => {
    setIntentMode(mode);
  }, []);

  const changeDwellTime = useCallback((timeMs: number) => {
    dwellTime.current = timeMs;
  }, []);

  const syncWithPinecone = useCallback(async (sid: string): Promise<boolean> => {
    setIsInitializing(true);
    setInitStatus("Pinecone 클라우드에서 데이터 가져오는 중...");
    try {
      const weights = await loadModelWeights(sid);
      if (!weights) {
        setInitStatus("오류: 클라우드에서 모델 가중치를 찾을 수 없습니다.");
        setIsInitializing(false);
        return false;
      }

      const ok = regressionRef.current.loadModel(weights);
      if (!ok) {
        setInitStatus("오류: 모델 가중치 분석에 실패했습니다.");
        setIsInitializing(false);
        return false;
      }

      // Save to localStorage
      localStorage.setItem('lulu_trained_mlp', weights);
      localStorage.setItem('lulu_session_id', sid);
      setIsModelTrained(true);

      // Load and sync calibration samples
      const samples = await loadCalibrationData(sid);
      if (samples) {
        localStorage.setItem('lulu_calibration_samples', JSON.stringify(samples));
        if (onlineLearningRef.current) {
          onlineLearningRef.current.setBaseSamples(samples);
          onlineLearningRef.current.setSessionId(sid);
          onlineLearningRef.current.reset();
        }
        console.log(`[useEyeTracking] Loaded ${samples.length} base samples from Pinecone.`);
      }

      setInitStatus("클라우드 동기화 완료! ✅");
      setIsInitializing(false);
      return true;
    } catch (e: any) {
      setInitStatus(`동기화 오류: ${e.message}`);
      setIsInitializing(false);
      return false;
    }
  }, []);

  return {
    isInitializing,
    initStatus,
    isReady,
    gazeState,
    intentMode,
    isCalibrating,
    calibrationProgress,
    calibPoint,
    calibrationMode,
    isModelTrained,
    initEngine,
    startCalibration: startCalibrationLoop,
    changeIntentMode,
    changeDwellTime,
    dwellTime: dwellTime.current,
    syncWithPinecone
  };
}
