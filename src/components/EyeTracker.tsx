'use client';

import React from 'react';

interface EyeTrackerProps {
  isReady: boolean;
  isInitializing: boolean;
  initStatus: string;
  initEngine: () => void;
  children: React.ReactNode;
}

export const EyeTracker: React.FC<EyeTrackerProps> = ({
  isReady,
  isInitializing,
  initStatus,
  initEngine,
  children
}) => {
  return (
    <>
      {/*
        CRITICAL: children must ALWAYS be mounted so that videoRef and canvasRef
        are connected to the DOM before initEngine() is called.
        We hide them with CSS when not ready (not with conditional rendering).
      */}
      <div style={{ display: isReady ? 'contents' : 'none' }}>
        {children}
      </div>

      {/* Bootstrap / Splash screen — shown while not ready */}
      {!isReady && (
        <div className="bootstrap-container">
          <div className="bootstrap-card glass-panel">
            <div className="bootstrap-logo-wrapper">
              <span className="logo-symbol">L</span>
              <h1>LuLu V2</h1>
              <p>ALS Patient Gaze Communication Engine</p>
            </div>

            <div className="bootstrap-status-box">
              <div className="status-label">엔진 연결 상태</div>
              <div className="status-text">{initStatus}</div>

              {isInitializing && (
                <div className="loading-spinner-wrapper">
                  <div className="loading-spinner" />
                </div>
              )}
            </div>

            {!isInitializing && !isReady && (
              <button
                className="bootstrap-action-btn primary-btn glowing-btn gazeable"
                onClick={initEngine}
              >
                🔌 카메라 연결 및 엔진 활성화
              </button>
            )}

            <div className="bootstrap-instructions">
              <h4>💡 권장 조준 환경</h4>
              <ul>
                <li>웹캠 조명이 얼굴 전체에 충분히 고르게 비치도록 하세요.</li>
                <li>카메라와 얼굴 사이의 거리는 40cm~60cm가 이상적입니다.</li>
                <li>두 눈이 비디오 프레임에 또렷하게 보이도록 고정하세요.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default EyeTracker;
