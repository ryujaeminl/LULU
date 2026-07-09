/**
 * PineconeClient.ts
 *
 * Client-side helper to persist:
 *   1. Calibration training samples  → type: 'calibration'
 *   2. MLP model weights             → type: 'model'
 *   3. Gaze activity logs            → type: 'log'
 *
 * All vectors are 8-dimensional (matching GazeFeatures input size).
 * Pinecone index must be configured for dimension=1024; we pad to 1024.
 */

import { GazeFeatures } from '../types/gaze';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad1024(values: number[]): number[] {
  const arr = new Float32Array(1024);
  values.forEach((v, i) => { if (i < 1024) arr[i] = v; });
  return Array.from(arr);
}

function featuresToVector(f: GazeFeatures): number[] {
  return pad1024([
    f.pitch,
    f.yaw,
    f.headPitch,
    f.headYaw,
    f.headRoll,
    f.leftEyeOpenness,
    f.faceScale,
    f.cameraDistance,
  ]);
}

async function upsert(vectors: { id: string; values: number[]; metadata: Record<string, unknown> }[]) {
  try {
    const res = await fetch('/api/gaze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.warn('[PineconeClient] upsert failed:', err);
    } else {
      console.log(`[PineconeClient] upserted ${vectors.length} vector(s)`);
    }
  } catch (e) {
    console.warn('[PineconeClient] network error:', e);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save calibration training samples to Pinecone.
 * Called after calibration completes.
 */
export async function saveCalibrationData(
  sessionId: string,
  samples: { input: number[]; target: number[] }[]
): Promise<void> {
  const ts = Date.now();
  const vectors = samples.map((s, i) => ({
    id: `calib_${sessionId}_${ts}_${i}`,
    values: pad1024(s.input),
    metadata: {
      type: 'calibration',
      sessionId,
      targetX: s.target[0],
      targetY: s.target[1],
      timestamp: ts,
      input: JSON.stringify(s.input),
    },
  }));

  // Pinecone has a 100-vector limit per upsert request
  for (let i = 0; i < vectors.length; i += 100) {
    await upsert(vectors.slice(i, i + 100));
  }
  console.log(`[PineconeClient] Saved ${vectors.length} calibration samples`);
}

/**
 * Save serialized MLP model weights to Pinecone.
 * Called after training / online-learning updates.
 */
export async function saveModelWeights(
  sessionId: string,
  modelJson: string
): Promise<void> {
  const ts = Date.now();

  // Store the model as a single vector with the JSON in metadata
  // We use a zero-vector as the embedding (model is fully in metadata)
  await upsert([{
    id: `model_${sessionId}_${ts}`,
    values: pad1024([ts / 1e12]), // near-zero float
    metadata: {
      type: 'model',
      sessionId,
      timestamp: ts,
      weights: modelJson, // full serialized JSON
    },
  }]);
  console.log('[PineconeClient] Saved model weights');
}

/**
 * Log a single gaze event (dwell / click / blink) to Pinecone.
 * Fire-and-forget — doesn't block the rAF loop.
 */
export async function logGazeEvent(
  sessionId: string,
  features: GazeFeatures,
  eventType: 'dwell' | 'click' | 'blink',
  targetId: string,
  screenX: number,
  screenY: number
): Promise<void> {
  const ts = Date.now();
  await upsert([{
    id: `log_${sessionId}_${ts}_${Math.random().toString(36).slice(2, 6)}`,
    values: featuresToVector(features),
    metadata: {
      type: 'log',
      sessionId,
      eventType,
      targetId,
      screenX,
      screenY,
      timestamp: ts,
    },
  }]);
}

/**
 * Load serialized MLP model weights from Pinecone.
 */
export async function loadModelWeights(sessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/gaze?sessionId=${sessionId}&type=model`);
    if (!res.ok) {
      console.warn('[PineconeClient] Failed to fetch model weights from API:', res.statusText);
      return null;
    }
    const data = await res.json();
    const matches = data.matches;
    if (!matches || matches.length === 0) return null;

    // Sort by timestamp descending to find the latest saved model in the session
    matches.sort((a: any, b: any) => {
      const tsA = a.metadata?.timestamp || 0;
      const tsB = b.metadata?.timestamp || 0;
      return tsB - tsA;
    });

    return matches[0].metadata?.weights || null;
  } catch (e) {
    console.warn('[PineconeClient] Network error loading model weights:', e);
    return null;
  }
}

/**
 * Load clean calibration data samples from Pinecone.
 */
export async function loadCalibrationData(
  sessionId: string
): Promise<{ input: number[]; target: number[] }[] | null> {
  try {
    const res = await fetch(`/api/gaze?sessionId=${sessionId}&type=calibration`);
    if (!res.ok) {
      console.warn('[PineconeClient] Failed to fetch calibration samples from API:', res.statusText);
      return null;
    }
    const data = await res.json();
    const matches = data.matches;
    if (!matches || matches.length === 0) return null;

    // Parse and map Pinecone matches to TrainingSample format
    return matches.map((m: any) => {
      let input: number[];
      try {
        input = JSON.parse(m.metadata.input);
      } catch {
        // Fallback: extract from padded values array (first 8 dimensions)
        input = m.values.slice(0, 8);
      }
      return {
        input,
        target: [Number(m.metadata.targetX), Number(m.metadata.targetY)]
      };
    });
  } catch (e) {
    console.warn('[PineconeClient] Network error loading calibration data:', e);
    return null;
  }
}
