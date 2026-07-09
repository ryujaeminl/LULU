import { GazeFeatures } from '../types/gaze';

export interface TrainingSample {
  input: number[];
  target: number[];
}

export class RegressionEngine {
  private inputDim = 20;
  private hiddenDim = 40;
  private outputDim = 2;

  // Model weights and biases
  private w1: number[][]; // [hiddenDim][inputDim]
  private w2: number[][]; // [outputDim][hiddenDim]
  private b1: number[];   // [hiddenDim]
  private b2: number[];   // [outputDim]

  // Normalization statistics
  private inputMean: number[];
  private inputStd: number[];
  private targetMean: number[];
  private targetStd: number[];

  private calibrationDeltas: { target: number[]; delta: number[] }[] = [];

  public isTrained = false;

  constructor() {
    const std1 = Math.sqrt(2.0 / this.inputDim);
    const std2 = Math.sqrt(2.0 / this.hiddenDim);

    this.w1 = Array.from({ length: this.hiddenDim }, () =>
      Array.from({ length: this.inputDim }, () => (Math.random() - 0.5) * 2.0 * std1)
    );
    this.w2 = Array.from({ length: this.outputDim }, () =>
      Array.from({ length: this.hiddenDim }, () => (Math.random() - 0.5) * 2.0 * std2)
    );
    this.b1 = new Array(this.hiddenDim).fill(0);
    this.b2 = new Array(this.outputDim).fill(0);

    this.inputMean = new Array(this.inputDim).fill(0);
    this.inputStd = new Array(this.inputDim).fill(1);
    this.targetMean = new Array(this.outputDim).fill(0);
    this.targetStd = new Array(this.outputDim).fill(1);
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private sigmoidDerivative(y: number): number {
    return y * (1 - y); // y is already sigmoid(x)
  }

  private relu(x: number): number {
    return Math.max(0.1 * x, x); // Leaky ReLU
  }

  private reluDerivative(y: number): number {
    return y > 0 ? 1 : 0.1;
  }

  public featuresToArray(f: GazeFeatures): number[] {
    const leftPitch = f.leftEyePitch !== undefined ? f.leftEyePitch : f.pitch;
    const leftYaw = f.leftEyeYaw !== undefined ? f.leftEyeYaw : f.yaw;
    const rightPitch = f.rightEyePitch !== undefined ? f.rightEyePitch : f.pitch;
    const rightYaw = f.rightEyeYaw !== undefined ? f.rightEyeYaw : f.yaw;

    // 1. Head Roll (tilt) rotation correction for BOTH eyes independently
    const cosR = Math.cos(f.headRoll);
    const sinR = Math.sin(f.headRoll);

    const rotatedLeftYaw = leftYaw * cosR + leftPitch * sinR;
    const rotatedLeftPitch = -leftYaw * sinR + leftPitch * cosR;

    const rotatedRightYaw = rightYaw * cosR + rightPitch * sinR;
    const rotatedRightPitch = -rightYaw * sinR + rightPitch * cosR;

    // 2. Head Yaw & Pitch rotation compensation (dynamic scaling based on face scale/distance)
    const refFaceScale = 0.15; // standard face scale at normal distance
    const scaleFactor = Math.max(0.5, Math.min(2.0, f.faceScale / refFaceScale));
    const headYawScale = 20.0 * scaleFactor;
    const headPitchScale = 20.0 * scaleFactor;

    const compLeftYaw = rotatedLeftYaw + f.headYaw * headYawScale;
    const compLeftPitch = rotatedLeftPitch - f.headPitch * headPitchScale;

    const compRightYaw = rotatedRightYaw + f.headYaw * headYawScale;
    const compRightPitch = rotatedRightPitch - f.headPitch * headPitchScale;

    // 3. Polynomial and Cross-Interaction features for extreme precision
    const leftYawLeftPitch = leftYaw * leftPitch;
    const rightYawRightPitch = rightYaw * rightPitch;
    const headYawLeftYaw = f.headYaw * leftYaw;
    const headPitchLeftPitch = f.headPitch * leftPitch;
    const leftYawSq = leftYaw * leftYaw;
    const leftPitchSq = leftPitch * leftPitch;

    return [
      leftPitch,
      leftYaw,
      rightPitch,
      rightYaw,
      f.headPitch,
      f.headYaw,
      f.headRoll,
      f.leftEyeOpenness,
      f.faceScale,
      f.cameraDistance,
      compLeftPitch,
      compLeftYaw,
      compRightPitch,
      compRightYaw,
      leftYawLeftPitch,
      rightYawRightPitch,
      headYawLeftYaw,
      headPitchLeftPitch,
      leftYawSq,
      leftPitchSq
    ];
  }

  /**
   * Computes normalization statistics for inputs and targets
   */
  private calculateStats(samples: TrainingSample[]): void {
    const N = samples.length;
    if (N === 0) return;

    // Calculate means
    this.inputMean.fill(0);
    this.targetMean.fill(0);
    for (const s of samples) {
      for (let i = 0; i < this.inputDim; i++) this.inputMean[i] += s.input[i];
      for (let i = 0; i < this.outputDim; i++) this.targetMean[i] += s.target[i];
    }
    for (let i = 0; i < this.inputDim; i++) this.inputMean[i] /= N;
    for (let i = 0; i < this.outputDim; i++) this.targetMean[i] /= N;

    // Calculate standard deviations
    const inputVar = new Array(this.inputDim).fill(0);
    const targetVar = new Array(this.outputDim).fill(0);
    for (const s of samples) {
      for (let i = 0; i < this.inputDim; i++) {
        inputVar[i] += Math.pow(s.input[i] - this.inputMean[i], 2);
      }
      for (let i = 0; i < this.outputDim; i++) {
        targetVar[i] += Math.pow(s.target[i] - this.targetMean[i], 2);
      }
    }
    for (let i = 0; i < this.inputDim; i++) {
      this.inputStd[i] = Math.sqrt(inputVar[i] / N) || 1.0;
      if (this.inputStd[i] < 0.0001) this.inputStd[i] = 1.0;
    }
    for (let i = 0; i < this.outputDim; i++) {
      this.targetStd[i] = Math.sqrt(targetVar[i] / N) || 1.0;
      if (this.targetStd[i] < 0.0001) this.targetStd[i] = 1.0;
    }
  }

  private normalizeInput(raw: number[]): number[] {
    return raw.map((val, i) => (val - this.inputMean[i]) / this.inputStd[i]);
  }

  private normalizeTarget(raw: number[]): number[] {
    return raw.map((val, i) => (val - this.targetMean[i]) / this.targetStd[i]);
  }

  private denormalizeOutput(norm: number[]): number[] {
    return norm.map((val, i) => val * this.targetStd[i] + this.targetMean[i]);
  }

  /**
   * Forward pass: computes the output coordinates from gaze features
   */
  public predict(features: GazeFeatures): { x: number; y: number } | null {
    if (!this.isTrained) return null;

    const rawInput = this.featuresToArray(features);
    const x = this.normalizeInput(rawInput);

    // Hidden layer activations
    const h = new Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      let sum = this.b1[i];
      for (let j = 0; j < this.inputDim; j++) {
        sum += x[j] * this.w1[i][j];
      }
      h[i] = this.relu(sum);
    }

    // Output layer activations
    const out = new Array(this.outputDim);
    for (let i = 0; i < this.outputDim; i++) {
      let sum = this.b2[i];
      for (let j = 0; j < this.hiddenDim; j++) {
        sum += h[j] * this.w2[i][j];
      }
      out[i] = sum; // Linear output activation for regression
    }

    const denorm = this.denormalizeOutput(out);
    let mlpX = denorm[0];
    let mlpY = denorm[1];

    // Apply Local Calibration Error Correction (LCEC) using IDW (Inverse Distance Weighting)
    if (this.calibrationDeltas.length > 0) {
      let sumW = 0;
      let sumDeltaX = 0;
      let sumDeltaY = 0;
      const power = 2;
      const epsilon = 0.0001;

      for (const d of this.calibrationDeltas) {
        const dist = Math.sqrt(Math.pow(mlpX - d.target[0], 2) + Math.pow(mlpY - d.target[1], 2));
        if (dist < 4) {
          // Snap directly if very close to calibration target
          return { x: mlpX + d.delta[0], y: mlpY + d.delta[1] };
        }
        const w = 1.0 / (Math.pow(dist, power) + epsilon);
        sumW += w;
        sumDeltaX += w * d.delta[0];
        sumDeltaY += w * d.delta[1];
      }

      if (sumW > 0) {
        mlpX += sumDeltaX / sumW;
        mlpY += sumDeltaY / sumW;
      }
    }

    return { x: mlpX, y: mlpY };
  }

  public computeCalibrationDeltas(samples: TrainingSample[]): void {
    this.calibrationDeltas = [];
    if (!this.isTrained || samples.length === 0) return;

    // Upgrade older samples if necessary to match inputDim
    const upgradedSamples = samples.map(s => {
      let input = [...s.input];
      if (input.length === 8) {
        const pitch = input[0];
        const yaw = input[1];
        const headPitch = input[2];
        const headYaw = input[3];
        const headRoll = input[4];

        const cosR = Math.cos(headRoll);
        const sinR = Math.sin(headRoll);
        const rotatedYaw = yaw * cosR + pitch * sinR;
        const rotatedPitch = -yaw * sinR + pitch * cosR;

        const headYawScale = 20.0;
        const headPitchScale = 20.0;
        const compYaw = rotatedYaw + headYaw * headYawScale;
        const compPitch = rotatedPitch - headPitch * headPitchScale;

        input.push(compPitch, compYaw);
      }

      if (input.length === 10) {
        const avgPitch = input[0];
        const avgYaw = input[1];
        const headPitch = input[2];
        const headYaw = input[3];
        const headRoll = input[4];
        const leftOpenness = input[5];
        const faceScale = input[6];
        const cameraDistance = input[7];
        const compAvgPitch = input[8];
        const compAvgYaw = input[9];

        input = [
          avgPitch, // leftPitch
          avgYaw,   // leftYaw
          avgPitch, // rightPitch
          avgYaw,   // rightYaw
          headPitch,
          headYaw,
          headRoll,
          leftOpenness,
          faceScale,
          cameraDistance,
          compAvgPitch, // compLeftPitch
          compAvgYaw,   // compLeftYaw
          compAvgPitch, // compRightPitch
          compAvgYaw    // compRightYaw
        ];
      }

      if (input.length === 14) {
        const leftPitch = input[0];
        const leftYaw = input[1];
        const rightPitch = input[2];
        const rightYaw = input[3];
        const headPitch = input[4];
        const headYaw = input[5];

        const leftYawLeftPitch = leftYaw * leftPitch;
        const rightYawRightPitch = rightYaw * rightPitch;
        const headYawLeftYaw = headYaw * leftYaw;
        const headPitchLeftPitch = headPitch * leftPitch;
        const leftYawSq = leftYaw * leftYaw;
        const leftPitchSq = leftPitch * leftPitch;

        input.push(
          leftYawLeftPitch,
          rightYawRightPitch,
          headYawLeftYaw,
          headPitchLeftPitch,
          leftYawSq,
          leftPitchSq
        );
      }
      return { input, target: s.target };
    });

    // Group samples by target coordinates
    const targetGroups = new Map<string, TrainingSample[]>();
    for (const s of upgradedSamples) {
      const key = `${s.target[0].toFixed(1)},${s.target[1].toFixed(1)}`;
      if (!targetGroups.has(key)) {
        targetGroups.set(key, []);
      }
      targetGroups.get(key)!.push(s);
    }

    // Compute average prediction delta for each target point
    for (const [key, group] of targetGroups.entries()) {
      let sumPredX = 0;
      let sumPredY = 0;

      for (const s of group) {
        const normX = this.normalizeInput(s.input);
        
        const h = new Array(this.hiddenDim);
        for (let i = 0; i < this.hiddenDim; i++) {
          let sum = this.b1[i];
          for (let j = 0; j < this.inputDim; j++) {
            sum += normX[j] * this.w1[i][j];
          }
          h[i] = this.relu(sum);
        }

        let outX = this.b2[0];
        let outY = this.b2[1];
        for (let j = 0; j < this.hiddenDim; j++) {
          outX += h[j] * this.w2[0][j];
          outY += h[j] * this.w2[1][j];
        }

        const pred = this.denormalizeOutput([outX, outY]);
        sumPredX += pred[0];
        sumPredY += pred[1];
      }

      const avgPredX = sumPredX / group.length;
      const avgPredY = sumPredY / group.length;

      const targetCoords = group[0].target;
      const deltaX = targetCoords[0] - avgPredX;
      const deltaY = targetCoords[1] - avgPredY;

      this.calibrationDeltas.push({
        target: [targetCoords[0], targetCoords[1]],
        delta: [deltaX, deltaY]
      });
    }
    console.log(`[RegressionEngine] LCEC initialized with ${this.calibrationDeltas.length} anchor points.`);
  }

  /**
   * Train the neural network model using backpropagation
   */
  public train(samples: TrainingSample[], epochs = 300, lr = 0.01): void {
    if (samples.length < 5) return;

    // Dynamic upgrade: Reconstruct 20D inputs from older 8D, 10D, or 14D samples
    const upgradedSamples = samples.map(s => {
      let input = [...s.input];
      if (input.length === 8) {
        const pitch = input[0];
        const yaw = input[1];
        const headPitch = input[2];
        const headYaw = input[3];
        const headRoll = input[4];

        const cosR = Math.cos(headRoll);
        const sinR = Math.sin(headRoll);
        const rotatedYaw = yaw * cosR + pitch * sinR;
        const rotatedPitch = -yaw * sinR + pitch * cosR;

        const headYawScale = 20.0;
        const headPitchScale = 20.0;
        const compYaw = rotatedYaw + headYaw * headYawScale;
        const compPitch = rotatedPitch - headPitch * headPitchScale;

        input.push(compPitch, compYaw);
      }

      if (input.length === 10) {
        const avgPitch = input[0];
        const avgYaw = input[1];
        const headPitch = input[2];
        const headYaw = input[3];
        const headRoll = input[4];
        const leftOpenness = input[5];
        const faceScale = input[6];
        const cameraDistance = input[7];
        const compAvgPitch = input[8];
        const compAvgYaw = input[9];

        input = [
          avgPitch, // leftPitch
          avgYaw,   // leftYaw
          avgPitch, // rightPitch
          avgYaw,   // rightYaw
          headPitch,
          headYaw,
          headRoll,
          leftOpenness,
          faceScale,
          cameraDistance,
          compAvgPitch, // compLeftPitch
          compAvgYaw,   // compLeftYaw
          compAvgPitch, // compRightPitch
          compAvgYaw    // compRightYaw
        ];
      }

      if (input.length === 14) {
        const leftPitch = input[0];
        const leftYaw = input[1];
        const rightPitch = input[2];
        const rightYaw = input[3];
        const headPitch = input[4];
        const headYaw = input[5];

        const leftYawLeftPitch = leftYaw * leftPitch;
        const rightYawRightPitch = rightYaw * rightPitch;
        const headYawLeftYaw = headYaw * leftYaw;
        const headPitchLeftPitch = headPitch * leftPitch;
        const leftYawSq = leftYaw * leftYaw;
        const leftPitchSq = leftPitch * leftPitch;

        input.push(
          leftYawLeftPitch,
          rightYawRightPitch,
          headYawLeftYaw,
          headPitchLeftPitch,
          leftYawSq,
          leftPitchSq
        );
      }

      return {
        input,
        target: s.target
      };
    });

    // Perform VOR Head Pose Data Augmentation to prevent posture-drift
    const augmentedSamples: TrainingSample[] = [];
    const refFaceScale = 0.15;

    for (const s of upgradedSamples) {
      // Keep the original clean sample
      augmentedSamples.push(s);

      const leftPitch = s.input[0];
      const leftYaw = s.input[1];
      const rightPitch = s.input[2];
      const rightYaw = s.input[3];
      const headPitch = s.input[4];
      const headYaw = s.input[5];
      const headRoll = s.input[6];
      const leftOpenness = s.input[7];
      const faceScale = s.input[8];
      const cameraDistance = s.input[9];

      // Dynamic scaling factor based on face scale
      const scaleFactor = Math.max(0.5, Math.min(2.0, faceScale / refFaceScale));
      const headYawScale = 20.0 * scaleFactor;
      const headPitchScale = 20.0 * scaleFactor;

      // 12 synthetic posture and leaning (scale/distance) variations per sample
      const variations = [
        // Rotations only
        { dYaw: 0.18, dPitch: 0.0, dRoll: 0.0, scaleMult: 1.0, distMult: 1.0 },
        { dYaw: -0.18, dPitch: 0.0, dRoll: 0.0, scaleMult: 1.0, distMult: 1.0 },
        { dYaw: 0.0, dPitch: 0.12, dRoll: 0.0, scaleMult: 1.0, distMult: 1.0 },
        { dYaw: 0.0, dPitch: -0.12, dRoll: 0.0, scaleMult: 1.0, distMult: 1.0 },
        { dYaw: 0.12, dPitch: 0.08, dRoll: 0.05, scaleMult: 1.0, distMult: 1.0 },
        { dYaw: -0.12, dPitch: -0.08, dRoll: -0.05, scaleMult: 1.0, distMult: 1.0 },
        // Leaning variations (distance & scale shift)
        { dYaw: 0.0, dPitch: 0.0, dRoll: 0.0, scaleMult: 0.85, distMult: 1.15 },
        { dYaw: 0.0, dPitch: 0.0, dRoll: 0.0, scaleMult: 1.15, distMult: 0.85 },
        // Combined rotations + leaning
        { dYaw: 0.12, dPitch: -0.06, dRoll: 0.03, scaleMult: 0.9, distMult: 1.1 },
        { dYaw: -0.12, dPitch: 0.06, dRoll: -0.03, scaleMult: 1.1, distMult: 0.9 },
        { dYaw: -0.08, dPitch: 0.10, dRoll: -0.04, scaleMult: 0.9, distMult: 1.1 },
        { dYaw: 0.08, dPitch: -0.10, dRoll: 0.04, scaleMult: 1.1, distMult: 0.9 }
      ];

      for (const v of variations) {
        // VOR: Head rotates by +v, eye iris rotates by -v (relative to head)
        const augHeadYaw = headYaw + v.dYaw;
        const augHeadPitch = headPitch + v.dPitch;
        const augHeadRoll = headRoll + v.dRoll;

        // Apply scale multiplier to faceScale and inverse to distance
        const augFaceScale = faceScale * v.scaleMult;
        const augCameraDistance = cameraDistance * v.distMult;

        // VOR eye counter-rotation scales with the augmented face scale
        const augScaleFactor = Math.max(0.5, Math.min(2.0, augFaceScale / refFaceScale));
        const augHeadYawScale = 20.0 * augScaleFactor;
        const augHeadPitchScale = 20.0 * augScaleFactor;

        const augLeftYaw = leftYaw - v.dYaw * augHeadYawScale;
        const augLeftPitch = leftPitch - v.dPitch * augHeadPitchScale;
        const augRightYaw = rightYaw - v.dYaw * augHeadYawScale;
        const augRightPitch = rightPitch - v.dPitch * augHeadPitchScale;

        // Reconstruct the compensated values for the augmented sample
        const cosR = Math.cos(augHeadRoll);
        const sinR = Math.sin(augHeadRoll);

        const rotatedLeftYaw = augLeftYaw * cosR + augLeftPitch * sinR;
        const rotatedLeftPitch = -augLeftYaw * sinR + augLeftPitch * cosR;
        const rotatedRightYaw = augRightYaw * cosR + augRightPitch * sinR;
        const rotatedRightPitch = -augRightYaw * sinR + augRightPitch * cosR;

        const compLeftYaw = rotatedLeftYaw + augHeadYaw * augHeadYawScale;
        const compLeftPitch = rotatedLeftPitch - augHeadPitch * augHeadPitchScale;
        const compRightYaw = rotatedRightYaw + augHeadYaw * augHeadYawScale;
        const compRightPitch = rotatedRightPitch - augHeadPitch * augHeadPitchScale;

        // Calculate polynomial terms
        const leftYawLeftPitch = augLeftYaw * augLeftPitch;
        const rightYawRightPitch = augRightYaw * augRightPitch;
        const headYawLeftYaw = augHeadYaw * augLeftYaw;
        const headPitchLeftPitch = augHeadPitch * augLeftPitch;
        const leftYawSq = augLeftYaw * augLeftYaw;
        const leftPitchSq = augLeftPitch * augLeftPitch;

        const augInput = [
          augLeftPitch,
          augLeftYaw,
          augRightPitch,
          augRightYaw,
          augHeadPitch,
          augHeadYaw,
          augHeadRoll,
          leftOpenness,
          augFaceScale,
          augCameraDistance,
          compLeftPitch,
          compLeftYaw,
          compRightPitch,
          compRightYaw,
          leftYawLeftPitch,
          rightYawRightPitch,
          headYawLeftYaw,
          headPitchLeftPitch,
          leftYawSq,
          leftPitchSq
        ];

        augmentedSamples.push({
          input: augInput,
          target: s.target
        });
      }
    }

    this.calculateStats(augmentedSamples);

    // Prepare standardized training set
    const trainSet = augmentedSamples.map(s => ({
      x: this.normalizeInput(s.input),
      y: this.normalizeTarget(s.target)
    }));

    // Initialize momentum buffers for smooth gradient descent acceleration
    const v_w1 = Array.from({ length: this.hiddenDim }, () => new Array(this.inputDim).fill(0));
    const v_w2 = Array.from({ length: this.outputDim }, () => new Array(this.hiddenDim).fill(0));
    const v_b1 = new Array(this.hiddenDim).fill(0);
    const v_b2 = new Array(this.outputDim).fill(0);

    const M = trainSet.length;
    const wd = 0.0001; // L2 weight decay regularizer
    const mu = 0.9;    // Momentum coefficient

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Initialize gradient accumulators
      const dw1 = Array.from({ length: this.hiddenDim }, () => new Array(this.inputDim).fill(0));
      const dw2 = Array.from({ length: this.outputDim }, () => new Array(this.hiddenDim).fill(0));
      const db1 = new Array(this.hiddenDim).fill(0);
      const db2 = new Array(this.outputDim).fill(0);

      for (const sample of trainSet) {
        const x = sample.x;
        const target = sample.y;

        // --- 1. Forward Pass ---
        const h_net = new Array(this.hiddenDim);
        const h_out = new Array(this.hiddenDim);
        for (let i = 0; i < this.hiddenDim; i++) {
          let sum = this.b1[i];
          for (let j = 0; j < this.inputDim; j++) {
            sum += x[j] * this.w1[i][j];
          }
          h_net[i] = sum;
          h_out[i] = this.relu(sum);
        }

        const out = new Array(this.outputDim);
        for (let i = 0; i < this.outputDim; i++) {
          let sum = this.b2[i];
          for (let j = 0; j < this.hiddenDim; j++) {
            sum += h_out[j] * this.w2[i][j];
          }
          out[i] = sum;
        }

        // --- 2. Backward Pass (Backpropagation) ---
        // Output layer error gradient
        const d_out = new Array(this.outputDim);
        for (let i = 0; i < this.outputDim; i++) {
          d_out[i] = out[i] - target[i]; // Loss derivative (MSE)
        }

        // Hidden layer error gradient
        const d_hidden = new Array(this.hiddenDim);
        for (let i = 0; i < this.hiddenDim; i++) {
          let errorSum = 0;
          for (let j = 0; j < this.outputDim; j++) {
            errorSum += d_out[j] * this.w2[j][i];
          }
          d_hidden[i] = errorSum * this.reluDerivative(h_out[i]);
        }

        // Accumulate gradients across the batch (all screen regions)
        for (let i = 0; i < this.outputDim; i++) {
          db2[i] += d_out[i];
          for (let j = 0; j < this.hiddenDim; j++) {
            dw2[i][j] += d_out[i] * h_out[j];
          }
        }
        for (let i = 0; i < this.hiddenDim; i++) {
          db1[i] += d_hidden[i];
          for (let j = 0; j < this.inputDim; j++) {
            dw1[i][j] += d_hidden[i] * x[j];
          }
        }
      }

      // --- 3. Update Weights and Biases using Batch Gradient Descent with Momentum ---
      for (let i = 0; i < this.outputDim; i++) {
        const grad_b = db2[i] / M;
        v_b2[i] = mu * v_b2[i] + lr * grad_b;
        this.b2[i] -= v_b2[i];

        for (let j = 0; j < this.hiddenDim; j++) {
          const grad_w = dw2[i][j] / M + wd * this.w2[i][j];
          v_w2[i][j] = mu * v_w2[i][j] + lr * grad_w;
          this.w2[i][j] -= v_w2[i][j];
        }
      }

      for (let i = 0; i < this.hiddenDim; i++) {
        const grad_b = db1[i] / M;
        v_b1[i] = mu * v_b1[i] + lr * grad_b;
        this.b1[i] -= v_b1[i];

        for (let j = 0; j < this.inputDim; j++) {
          const grad_w = dw1[i][j] / M + wd * this.w1[i][j];
          v_w1[i][j] = mu * v_w1[i][j] + lr * grad_w;
          this.w1[i][j] -= v_w1[i][j];
        }
      }
    }

    this.isTrained = true;
  }

  public getIsTrained(): boolean {
    return this.isTrained;
  }

  // Weight serialization for persistence
  public saveModel(): string {
    return JSON.stringify({
      w1: this.w1,
      w2: this.w2,
      b1: this.b1,
      b2: this.b2,
      inputMean: this.inputMean,
      inputStd: this.inputStd,
      targetMean: this.targetMean,
      targetStd: this.targetStd,
      isTrained: this.isTrained,
      calibrationDeltas: this.calibrationDeltas
    });
  }

  public loadModel(serialized: string): boolean {
    try {
      const data = JSON.parse(serialized);
      // Dimension safety check
      if (!data.w1 || data.w1.length !== this.hiddenDim || data.w1[0].length !== this.inputDim) {
        console.warn("[RegressionEngine] Saved model has incompatible dimensions. Discarding.");
        return false;
      }
      this.w1 = data.w1;
      this.w2 = data.w2;
      this.b1 = data.b1;
      this.b2 = data.b2;
      this.inputMean = data.inputMean;
      this.inputStd = data.inputStd;
      this.targetMean = data.targetMean;
      this.targetStd = data.targetStd;
      this.isTrained = data.isTrained;
      this.calibrationDeltas = data.calibrationDeltas || [];
      return true;
    } catch (e) {
      console.error("Failed to load MLP model:", e);
      return false;
    }
  }
}
