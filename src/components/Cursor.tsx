import React from 'react';

interface CursorProps {
  x: number;
  y: number;
  visible: boolean;
}

export const Cursor: React.FC<CursorProps> = ({ x, y, visible }) => {
  if (!visible) return null;

  return (
    <div
      className="gaze-cursor"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    />
  );
};
export default Cursor;
