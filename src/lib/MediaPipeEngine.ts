/**
 * MediaPipeEngine.ts
 * Loads MediaPipe Tasks-Vision via dynamic ES module import.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type FaceLandmarkerType = any;
type FaceLandmarkerResultType = any;

const MEDIAPIPE_VERSION = '0.10.14';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${CDN_BASE}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ─── MediaPipe WASM stderr suppressor ────────────────────────────────────────
// MediaPipe WASM calls console.error for internal C++ GLOG output (e.g. W0708...).
// We detect these by inspecting the call stack — NOT the message text,
// because the message is C++ log format which doesn't contain our keywords.
function installWasmErrorSuppressor() {
  if (typeof window === 'undefined') return;

  const WASM_STACK_MARKERS = [
    'vision_wasm_internal',
    'vision_bundle.mjs',
    'tasks-vision',
  ];

  function isMediaPipeStack(): boolean {
    try {
      const stack = new Error().stack ?? '';
      return WASM_STACK_MARKERS.some(m => stack.includes(m));
    } catch { return false; }
  }

  // Patch console.error: suppress calls originating from MediaPipe WASM
  const origError = console.error.bind(console);
  console.error = (...args: any[]) => {
    if (isMediaPipeStack()) return; // ← WASM caller detected, drop silently
    origError(...args);
  };

  // Suppress window.onerror for WASM-originated errors
  const prevOnError = window.onerror;
  window.onerror = (msg, src, ...rest) => {
    const s = `${msg ?? ''} ${src ?? ''}`;
    if (WASM_STACK_MARKERS.some(m => s.includes(m))) return true; // suppress
    return prevOnError ? prevOnError(msg, src, ...rest) : false;
  };

  // Suppress unhandledrejection for WASM-originated promises
  window.addEventListener('unhandledrejection', (e) => {
    if (WASM_STACK_MARKERS.some(m => String(e.reason ?? '').includes(m))) {
      e.preventDefault();
    }
  });
}


// ─── Module cache (load once) ─────────────────────────────────────────────────
let _moduleCache: { FilesetResolver: any; FaceLandmarker: any } | null = null;

async function loadMediaPipeModule() {
  if (_moduleCache) return _moduleCache;
  installWasmErrorSuppressor();
  // Function() prevents Turbopack from trying to statically bundle the CDN URL
  const mod = await (Function('u', 'return import(u)')(`${CDN_BASE}/vision_bundle.mjs`) as Promise<any>);
  _moduleCache = { FilesetResolver: mod.FilesetResolver, FaceLandmarker: mod.FaceLandmarker };
  return _moduleCache;
}

// ─── Engine ───────────────────────────────────────────────────────────────────
export class MediaPipeEngine {
  private faceLandmarker: FaceLandmarkerType = null;
  private initialized = false;
  private initializing = false;
  private lastTimestamp = -1;
  // Throttle: MediaPipe internally throws if called faster than ~30 FPS
  private readonly MIN_DETECT_INTERVAL_MS = 30;

  async initialize(onStatus?: (msg: string) => void) {
    if (this.initialized || this.initializing) return;
    this.initializing = true;

    try {
      onStatus?.('MediaPipe 모듈 로드 중...');
      const { FilesetResolver, FaceLandmarker } = await loadMediaPipeModule();

      onStatus?.('Vision 작업 셋 초기화 중...');
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);

      onStatus?.('FaceLandmarker 모델 로드 중...');

      const mkOpts = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO' as const,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        numFaces: 1,
      });

      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, mkOpts('GPU'));
        onStatus?.('준비 완료! ✅ (GPU)');
      } catch {
        onStatus?.('GPU 실패 → CPU 모드로 재시도...');
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, mkOpts('CPU'));
        onStatus?.('준비 완료! ✅ (CPU)');
      }

      this.initialized = true;
    } finally {
      this.initializing = false;
    }
  }

  detect(video: HTMLVideoElement): FaceLandmarkerResultType | null {
    if (!this.faceLandmarker || !this.initialized) return null;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    if (video.paused || video.ended) return null;

    const tsMs = performance.now();

    // Strictly monotonic + throttle to prevent WASM fd_write throws
    if (tsMs - this.lastTimestamp < this.MIN_DETECT_INTERVAL_MS) return null;
    this.lastTimestamp = tsMs;

    try {
      return this.faceLandmarker.detectForVideo(video, tsMs);
    } catch {
      // WASM stderr writes (C++ printf) surface as JS errors in some browsers.
      // They are harmless debug logs — skip the frame silently.
      return null;
    }
  }

  destroy() {
    try { this.faceLandmarker?.close(); } catch { /* ignore */ }
    this.faceLandmarker = null;
    this.initialized = false;
    this.lastTimestamp = -1;
  }

  get ready() { return this.initialized; }
}