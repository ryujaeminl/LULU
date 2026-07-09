import React from 'react';

export interface Alert {
  id: string;
  priority: 'emergency' | 'important' | 'regular';
  message: string;
  time: string;
  status: 'active' | 'resolved';
}

interface CareHubProps {
  postureTimerMinutes: number;
  setPostureTimerMinutes: (min: number) => void;
  alerts: Alert[];
  resolveAlert: (id: string) => void;
  sleepAlertsEnabled: boolean;
  setSleepAlertsEnabled: (enabled: boolean) => void;
  triggerSound: (type: any) => void;
  gazingId: string | null;
  handleMouseEnter: (id: string, action: () => void) => void;
  handleMouseLeave: () => void;
  handleManualClick: (action: () => void) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const CareHub: React.FC<CareHubProps> = ({
  postureTimerMinutes,
  setPostureTimerMinutes,
  alerts,
  resolveAlert,
  sleepAlertsEnabled,
  setSleepAlertsEnabled,
  triggerSound,
  gazingId,
  handleMouseEnter,
  handleMouseLeave,
  handleManualClick,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const maxLimit = 120; // 2 hours
  const pct = Math.min((postureTimerMinutes / maxLimit) * 100, 100);
  const colorVar = postureTimerMinutes >= maxLimit ? 'var(--color-emergency)' : 'var(--color-success)';
  const conicGradient = `conic-gradient(${colorVar} ${pct}%, rgba(255, 255, 255, 0.05) 0)`;

  return (
    <div id="caregiver-drawer" className="device-column caregiver-column slide-drawer open">
      <div className="drawer-header">
        <div className="sidebar-logo">
          <span className="logo-symbol">C</span>
          <h3>LuLu Care Hub</h3>
        </div>
        <button
          id="caregiver-close-btn"
          className={`gazeable icon-btn close-btn ${gazingId === 'caregiver-close-btn' ? 'gazing' : ''}`}
          onMouseEnter={() => handleMouseEnter('caregiver-close-btn', onClose)}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleManualClick(onClose)}
        >
          ✕
        </button>
      </div>

      <div className="drawer-content-scroll">
        <div className="drawer-pill">보호자용 실시간 모니터</div>
        
        {/* Posture Timer Card */}
        <div className="status-card border-warning" style={{ marginTop: '15px' }}>
          <div className="card-title">🛌 자세 변경 타이머</div>
          <div className="card-body">
            <div className="circular-progress-wrapper">
              <div
                className={`circular-progress ${postureTimerMinutes < maxLimit ? 'safe' : ''}`}
                id="posture-progress-ring"
                style={{ background: conicGradient }}
              >
                <div className="inner-circle">
                  <span id="posture-time-text">
                    {Math.floor(postureTimerMinutes / 60) > 0 ? `${Math.floor(postureTimerMinutes / 60)}시간 ` : ''}{postureTimerMinutes % 60}분
                  </span>
                </div>
              </div>
            </div>
            <p className={`status-alert-text ${postureTimerMinutes >= maxLimit ? 'text-red' : 'text-green'}`} id="posture-warning-msg">
              {postureTimerMinutes >= maxLimit ? "경고: 2시간 자세 유지 초과" : "정상 동작 상태"}
            </p>
            <button
              id="btn-reset-posture"
              className="action-btn-sm warning"
              onClick={() => { triggerSound('click'); setPostureTimerMinutes(0); }}
            >
              자세 변경 완료 처리
            </button>
          </div>
        </div>

        {/* Live Priority Alert Log */}
        <div className="caregiver-alerts-section" style={{ marginTop: '20px' }}>
          <h3>📥 실시간 우선순위 수신 알림</h3>
          {alerts.length === 0 ? (
            <div id="empty-alerts-placeholder" className="empty-alerts">
              <p>수신된 긴급 호출이나 알림이 없습니다.</p>
            </div>
          ) : (
            <div id="caregiver-alerts-log" className="alerts-log-container">
              {alerts.map(alert => (
                <div key={alert.id} className={`alert-card-rec ${alert.priority === 'emergency' ? 'emergency-active' : ''}`} id={alert.id}>
                  <div className={`alert-side-indicator ${alert.priority}`}></div>
                  <div className="alert-content-box">
                    <h4>
                      {alert.priority === 'emergency' && "🔴 [응급]"}
                      {alert.priority === 'important' && "🟡 [중요]"}
                      {alert.priority === 'regular' && "🔵 [일반]"}
                      {' '}{alert.message}
                    </h4>
                    <p>김수민 환자로부터 호출 수신됨</p>
                  </div>
                  <div className="alert-action-area">
                    <span className="alert-time">{alert.time}</span>
                    <button className="ack-btn" onClick={() => resolveAlert(alert.id)}>알림 확인</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendation Suggestions Engine */}
        <div className="caregiver-ai-patterns" style={{ marginTop: '20px' }}>
          <h3>🧠 AI 패턴 분석 및 제안 엔진</h3>
          <div className="pattern-cards-container">
            <div className="pattern-card">
              <div className="pattern-meta">
                <span className="badge badge-ai">패턴 학습</span>
                <span className="time">방금 전</span>
              </div>
              <h4>자세 미변경 감지 알림</h4>
              <p>환자가 2시간 이상 동일한 자세를 유지했습니다. 욕창 방지를 위해 자세 변경 제안을 전송했습니다.</p>
              <div className="pattern-actions">
                <span className="status-badge sent">환자 화면에 제안됨</span>
              </div>
            </div>
            <div className="pattern-card">
              <div className="pattern-meta">
                <span className="badge badge-ai">시간적 학습</span>
                <span className="time">10분 전</span>
              </div>
              <h4>취침 전 자동 준비 제안 설정</h4>
              <p>환자의 평균 취침 시간 도래 시 '주무실 준비를 하시겠습니까?' 문장을 AI 추천 첫 항목으로 배치합니다.</p>
              <div className="pattern-actions">
                <button
                  className={`btn-toggle-switch ${sleepAlertsEnabled ? 'active' : ''}`}
                  onClick={() => { triggerSound('click'); setSleepAlertsEnabled(!sleepAlertsEnabled); }}
                >
                  {sleepAlertsEnabled ? '활성화됨' : '비활성화됨'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CareHub;
