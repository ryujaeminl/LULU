import { useState, useCallback } from 'react';
import { CalibrationMode } from '../types/gaze';

export function useCalibration() {
  const [calibMode, setCalibMode] = useState<CalibrationMode>('25');

  const getGridStyle = useCallback((mode: CalibrationMode) => {
    const size = mode === '25' ? 5 : 7;
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${size}, 1fr)`,
      gridTemplateRows: `repeat(${size}, 1fr)`,
      width: '100vw',
      height: '100vh',
      position: 'absolute' as const,
      top: 0,
      left: 0,
      pointerEvents: 'none' as const
    };
  }, []);

  return {
    calibMode,
    setCalibMode,
    getGridStyle
  };
}
