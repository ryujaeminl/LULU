import { useState, useCallback } from 'react';
import { BlinkType } from '../types/gaze';

export function useBlinkDetection() {
  const [blinkThreshold, setBlinkThreshold] = useState(0.55);

  const getBlinkInstructions = useCallback((type: BlinkType) => {
    switch (type) {
      case 'single':
        return '단일 깜빡임 감지';
      case 'double':
        return '더블 깜빡임 클릭';
      case 'long':
        return '롱 깜빡임 클릭';
      default:
        return '정상 상태 (눈 뜸)';
    }
  }, []);

  return {
    blinkThreshold,
    setBlinkThreshold,
    getBlinkInstructions
  };
}
