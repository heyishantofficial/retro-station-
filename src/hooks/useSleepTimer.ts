import { useState, useEffect, useCallback } from 'react';

interface UseSleepTimerOptions {
  onStop: () => void;
  onVolumeFade?: (volumeRatio: number) => void;
  onTimerComplete?: () => void;
}

export function useSleepTimer({ onStop, onVolumeFade, onTimerComplete }: UseSleepTimerOptions) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const clearTimer = useCallback(() => {
    setSelectedMinutes(null);
    setRemainingSeconds(null);
    if (onVolumeFade) onVolumeFade(1);
  }, [onVolumeFade]);

  const setTimer = useCallback((minutes: number | null) => {
    if (minutes === null || minutes <= 0) {
      clearTimer();
    } else {
      setSelectedMinutes(minutes);
      setRemainingSeconds(minutes * 60);
      if (onVolumeFade) onVolumeFade(1);
    }
  }, [clearTimer, onVolumeFade]);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          // Timer finished!
          clearInterval(interval);
          onStop();
          if (onVolumeFade) onVolumeFade(1);
          if (onTimerComplete) onTimerComplete();
          setSelectedMinutes(null);
          return null;
        }

        const next = prev - 1;

        // Smooth volume fade during the last 30 seconds
        if (next <= 30 && onVolumeFade) {
          const ratio = Math.max(0, next / 30);
          onVolumeFade(ratio);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, onStop, onVolumeFade, onTimerComplete]);

  const formatRemaining = useCallback((): string | null => {
    if (remainingSeconds === null) return null;
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, [remainingSeconds]);

  return {
    selectedMinutes,
    remainingSeconds,
    isActive: remainingSeconds !== null && remainingSeconds > 0,
    formattedRemaining: formatRemaining(),
    setTimer,
    clearTimer,
  };
}
