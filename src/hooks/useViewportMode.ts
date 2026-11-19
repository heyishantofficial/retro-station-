import { useEffect, useState } from 'react';

export interface ViewportMode {
  isMobile: boolean;
  isPortrait: boolean;
  isCoarsePointer: boolean;
  isIOS: boolean;
  width: number;
  height: number;
}

function readViewportMode(): ViewportMode {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isPortrait: false,
      isCoarsePointer: false,
      isIOS: false,
      width: 1440,
      height: 900,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < 768;
  const isPortrait = height > width;
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { isMobile, isPortrait, isCoarsePointer, isIOS, width, height };
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewportMode);

  useEffect(() => {
    const update = () => setMode(readViewportMode());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mode;
}
