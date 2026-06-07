import { useEffect, useState } from 'react';

export function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0, px: 0.5, py: 0.5 });

  useEffect(() => {
    let frame = null;

    function handleMove(e) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setPosition({
          x: e.clientX,
          y: e.clientY,
          px: e.clientX / window.innerWidth,
          py: e.clientY / window.innerHeight,
        });
      });
    }

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return position;
}
