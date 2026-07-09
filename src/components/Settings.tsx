import React, { useState, useEffect } from 'react';
import { IntentMode, CalibrationMode } from '../types/gaze';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  intentMode: IntentMode;
  changeIntentMode: (mode: IntentMode) => void;
  dwellTime: number;
  changeDwellTime: (timeMs: number) => void;
  startCalibration: (mode: CalibrationMode) => void;
  isModelTrained: boolean;
  syncWithPinecone: (sessionId: string) => Promise<boolean>;
}

export const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  intentMode,
  changeIntentMode,
  dwellTime,
  changeDwellTime,
  startCalibration,
  isModelTrained,
  syncWithPinecone
}) => {
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedSid = localStorage.getItem('lulu_session_id') || '';
      setSessionIdInput(savedSid);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSync = async () => {
    if (!sessionIdInput.trim()) {
      alert("세션 ID를 입력해 주세요.");
      return;
    }
    setIsSyncing(true);
    const ok = await syncWithPinecone(sessionIdInput.trim());
    setIsSyncing(false);
    if (ok) {
      alert("☁️ Pinecone 클라우드 가중치 및 학습 데이터를 정상적으로 불러왔습니다!");
      onClose();
    } else {
      alert("❌ 동기화 실패. 세션 ID를 확인해 주세요.");
    }
  };

  const handleClearModel = () => {
    localStorage.removeItem('lulu_trained_mlp');
    localStorage.removeItem('lulu_calibration_samples');
    localStorage.removeItem('lulu_session_id');
    alert("💾 저장된 시선 모델 가중치, 학습 샘플, 세션 ID를 초기화했습니다. 정상 작동을 위해 새로고침 후 재조정을 수행하세요.");
    window.location.reload();
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-card">
        <div className="modal-header">
          <h3>⚙️ 개인화 시선 추적 설정</h3>
          <button className="gazeable icon-btn modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Gaze Trigger Selector */}
          <div className="setting-section">
            <h4>🖱️ 시선 선택(클릭) 유도 방식</h4>
            <div className="mode-selector-grid">
              <button 
                className={`gazeable mode-btn ${intentMode === 'dwell' ? 'active' : ''}`}
                onClick={() => changeIntentMode('dwell')}
              >
                🕒 응시 대기 (Dwell)
              </button>
              <button 
                className={`gazeable mode-btn ${intentMode === 'double_blink' ? 'active' : ''}`}
                onClick={() => changeIntentMode('double_blink')}
              >
                👀 더블 깜빡임 (Double Blink)
              </button>
              <button 
                className={`gazeable mode-btn ${intentMode === 'long_blink' ? 'active' : ''}`}
                onClick={() => changeIntentMode('long_blink')}
              >
                ⏳ 롱 깜빡임 (Long Blink)
              </button>
            </div>
            <p className="setting-desc">
              {intentMode === 'dwell' && "원하는 버튼을 일정 시간(대기 시간) 가만히 바라보고 있으면 자동으로 클릭됩니다."}
              {intentMode === 'double_blink' && "원하는 버튼을 바라본 상태에서 의도적으로 눈을 두 번 깜빡이면 클릭됩니다."}
              {intentMode === 'long_blink' && "원하는 버튼을 바라본 채 눈을 지긋이 감았다가(0.65초 이상) 뜨면 클릭됩니다."}
            </p>
          </div>

          {/* Dwell Speed config */}
          {intentMode === 'dwell' && (
            <div className="setting-section">
              <h4>🕒 응시 대기 시간 (Dwell Timer)</h4>
              <div className="slider-wrapper">
                <input 
                  type="range" 
                  min="600" 
                  max="2000" 
                  step="100" 
                  value={dwellTime} 
                  onChange={(e) => changeDwellTime(Number(e.target.value))}
                  className="gazeable settings-slider"
                />
                <span className="slider-value">{(dwellTime / 1000).toFixed(1)}초</span>
              </div>
            </div>
          )}

          {/* Calibration Trigger Panel */}
          <div className="setting-section">
            <h4>🎯 정밀 시선 영점 조절 (Calibration)</h4>
            <div className="calib-trigger-grid">
              <button 
                className="gazeable calib-trigger-btn primary"
                onClick={() => {
                  onClose();
                  startCalibration('25');
                }}
              >
                🎯 25점 영점 조절 (권장)
              </button>
              <button 
                className="gazeable calib-trigger-btn secondary"
                onClick={() => {
                  onClose();
                  startCalibration('49');
                }}
              >
                🌀 49점 하이퍼 정밀 조절
              </button>
            </div>
            <p className="setting-desc">정확도가 떨어지거나 머리 위치를 많이 변경했을 때 보정을 새로 수행하십시오.</p>
          </div>

          {/* Pinecone Cloud Sync */}
          <div className="setting-section">
            <h4>☁️ Pinecone 클라우드 데이터 동기화</h4>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="세션 ID 입력 (예: session_1720...)"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}
              />
              <button
                className="gazeable calib-trigger-btn primary"
                style={{ width: 'auto', margin: 0, padding: '8px 16px' }}
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? '동기화 중...' : '불러오기'}
              </button>
            </div>
            <p className="setting-desc">Pinecone에 저장된 기존 세션 ID를 통해 가중치와 보정 데이터를 다운로드하여 복구합니다.</p>
          </div>

          {/* Reset configurations */}
          <div className="setting-section danger-zone">
            <h4>⚠️ 가중치 초기화</h4>
            <button className="gazeable delete-weights-btn" onClick={handleClearModel}>
              🗑️ 학습 데이터 및 모델 파일 영구 삭제
            </button>
            <p className="setting-desc">기존 브라우저 로컬 저장소에 캐싱된 개인화 AI 가중치를 삭제합니다.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="gazeable modal-close-action-btn" onClick={onClose}>설정 완료</button>
        </div>
      </div>
    </div>
  );
};
export default Settings;
