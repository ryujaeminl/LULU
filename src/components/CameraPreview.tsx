import React from 'react';
import { GazeErrorState } from '../types/gaze';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  leftEyeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  rightEyeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  showCamera: boolean;
  setShowCamera: (show: boolean) => void;
  errorState: GazeErrorState;
  fps: number;
  gazingId: string | null;
  handleMouseEnter: (id: string, action: () => void) => void;
  handleMouseLeave: () => void;
  handleManualClick: (action: () => void) => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  canvasRef,
  leftEyeCanvasRef,
  rightEyeCanvasRef,
  showCamera,
  setShowCamera,
  errorState,
  fps,
  gazingId,
  handleMouseEnter,
  handleMouseLeave,
  handleManualClick
}) => {
  return (
    <div className={`camera-preview-container ${showCamera ? 'visible' : 'minimized'}`}>
      <div className="preview-header">
        <h4>👁️ 실시간 분석 피드</h4>
        <button
          id="btn-toggle-camera"
          className={`toggle-preview-btn gazeable ${gazingId === 'btn-toggle-camera' ? 'gazing' : ''}`}
          onMouseEnter={() => handleMouseEnter('btn-toggle-camera', () => setShowCamera(!showCamera))}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleManualClick(() => setShowCamera(!showCamera))}
        >
          {showCamera ? '접기' : '열기'}
        </button>
      </div>

      {/*
        IMPORTANT: video must ALWAYS be in the DOM so that videoRef.current is
        available when initEngine() runs before the camera preview is shown.
        We hide it off-screen with CSS rather than conditional rendering.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -9999,
        }}
      />

      {/*
        canvas must also always be mounted so processFrame() can draw to it.
        We control its visibility via the parent container class.
      */}
      <div className="preview-body" style={{ display: showCamera ? 'flex' : 'none' }}>
        {/* Main Face Canvas */}
        <div className="main-canvas-wrapper">
          <canvas ref={canvasRef} width={320} height={240} className="preview-canvas" />

          {/* Overlay indicators */}
          <div className="fps-counter">{fps} FPS</div>

          {/* Error alerts */}
          {errorState.noFaceDetected && <div className="vision-alert danger">얼굴을 감지할 수 없음</div>}
          {!errorState.noFaceDetected && errorState.tooFar && <div className="vision-alert warning">카메라가 너무 멂 (가까이 오세요)</div>}
          {!errorState.noFaceDetected && errorState.tooClose && <div className="vision-alert warning">카메라가 너무 가까움</div>}
          {!errorState.noFaceDetected && errorState.poorLighting && <div className="vision-alert warning">⚠️ 조명 어두움 (조명 개선 권장)</div>}
          {!errorState.noFaceDetected && errorState.faceObstructed && <div className="vision-alert danger">눈 영역 가려짐 감지</div>}
        </div>

        {/* Cropped Eye Canvases */}
        <div className="eye-crops-wrapper">
          <div className="eye-crop-box">
            <span>좌안 (Left Eye)</span>
            <canvas ref={leftEyeCanvasRef} width={100} height={60} className="eye-canvas" />
          </div>
          <div className="eye-crop-box">
            <span>우안 (Right Eye)</span>
            <canvas ref={rightEyeCanvasRef} width={100} height={60} className="eye-canvas" />
          </div>
        </div>
      </div>
    </div>
  );
};
export default CameraPreview;
