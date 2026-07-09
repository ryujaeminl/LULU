import React from 'react';
import { CalibrationMode } from '../types/gaze';

interface CalibrationProps {
  isCalibrating: boolean;
  progress: number;
  calibPoint: { x: number; y: number } | null;
  calibrationMode: CalibrationMode;
}

export const Calibration: React.FC<CalibrationProps> = ({
  isCalibrating,
  progress,
  calibPoint,
  calibrationMode
}) => {
  if (!isCalibrating || !calibPoint) return null;

  // Render instructions based on general screen quad
  const getInstructions = (x: number, y: number) => {
    let horizontal = '';
    let vertical = '';

    if (x < 0.2) horizontal = '왼쪽';
    else if (x > 0.8) horizontal = '오른쪽';
    else if (x > 0.4 && x < 0.6) horizontal = '중앙';
    else horizontal = '중간';

    if (y < 0.2) vertical = '위쪽';
    else if (y > 0.8) vertical = '아래쪽';
    else if (y > 0.4 && y < 0.6) vertical = '중앙';
    else vertical = '중간';

    if (horizontal === '중앙' && vertical === '중앙') {
      return '화면 중앙의 보정 점을 계속 응시하세요';
    }

    return `${vertical} ${horizontal} 영역의 보정 점을 계속 응시하세요`;
  };

  return (
    <div className="calibration-overlay">
      <div className="calibration-header-panel">
        <h3>🎯 정밀 시선 영점 조절 ({calibrationMode} 포인트)</h3>
        <div className="calibration-progress-bar-wrapper">
          <div 
            className="calibration-progress-bar-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="calibration-text">
          {getInstructions(calibPoint.x, calibPoint.y)} ({Math.round(progress)}%)
        </div>
        <p className="calibration-subtext">빨간 점이 움직이면 시선만 따라 이동하고, 눈을 크게 뜬 채 머리를 고정하세요.</p>
      </div>

      <div 
        className="calibration-dot-wrapper"
        style={{
          position: 'absolute',
          left: `${calibPoint.x * 100}%`,
          top: `${calibPoint.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.4s ease-out, top 0.4s ease-out'
        }}
      >
        <div className="calibration-dot-outer" />
        <div className="calibration-dot-inner" />
      </div>
    </div>
  );
};
export default Calibration;
