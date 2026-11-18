import { useRef, useState, useEffect, useCallback } from 'react';
import { sound } from '../utils/soundEffects';
import { createMotorRamp, retargetMotorRamp, sampleMotorRamp } from '../utils/motorRamp';

interface UseDiscScrubOptions {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  baseSpeed?: number; // deg per 16.6ms frame while playing
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onFrame?: (angleDeg: number, speed: number) => void;
}

export function useDiscScrub({
  isPlaying,
  currentTime,
  duration,
  baseSpeed = 0.45,
  onTogglePlay,
  onSeek,
  onSetPlaybackRate,
  onFrame,
}: UseDiscScrubOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spinAngleRef = useRef(0);
  const motorRampRef = useRef(createMotorRamp(isPlaying ? baseSpeed : 0));
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [scrubDelta, setScrubDelta] = useState(0);
  const [intensityBadge, setIntensityBadge] = useState<string | null>(null);

  const dragRef = useRef({
    active: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    lastAngle: 0,
    lastTime: 0,
    lastSeekTime: 0,
    lastRate: 1,
    lastVel: 0,
    accumDeg: 0,
    startSongTime: 0,
    currentScrubTime: 0,
    idleTimer: null as number | null,
  });

  useEffect(() => {
    return () => {
      if (dragRef.current.idleTimer !== null) {
        window.clearTimeout(dragRef.current.idleTimer);
      }
      if (dragRef.current.active) {
        onSetPlaybackRate(1);
      }
    };
  }, [onSetPlaybackRate]);

  // Cubic S-curve ease-in-out spin ramp: 950ms smooth spool-up, 1250ms heavy-platter coast-down
  useEffect(() => {
    if (isScrubbing) {
      retargetMotorRamp(motorRampRef.current, 0, 80);
    } else if (isPlaying) {
      retargetMotorRamp(motorRampRef.current, baseSpeed, 950);
    } else {
      retargetMotorRamp(motorRampRef.current, 0, 1250);
    }
  }, [isPlaying, isScrubbing, baseSpeed]);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.666, 3);
      last = now;

      let speed = 0;
      if (!dragRef.current.active) {
        speed = sampleMotorRamp(motorRampRef.current, now);
        if (Math.abs(speed) > 0.0004 || isPlaying) {
          spinAngleRef.current = (spinAngleRef.current + speed * dt) % 360;
        }
      }

      onFrameRef.current?.(spinAngleRef.current, speed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const getAngle = (clientX: number, clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return (Math.atan2(clientY - (rect.top + rect.height / 2), clientX - (rect.left + rect.width / 2)) * 180) / Math.PI;
  };

  const applyRate = useCallback(
    (vel: number) => {
      const speed = Math.abs(vel);
      const fwd = vel >= 0;
      let rate = 1;
      let label: string | null = null;

      if (fwd) {
        if (speed > 260) {
          rate = 2.0;
          label = 'FWD 2×';
        } else if (speed > 110) {
          rate = 1.5;
          label = 'FWD 1.5×';
        } else if (speed > 18) {
          rate = 1.25;
          label = 'FWD 1.25×';
        } else {
          rate = 0.5;
          label = 'HOLD';
        }
      } else {
        if (speed > 200) {
          rate = 0.5;
          label = 'REW 2×';
        } else if (speed > 20) {
          rate = 0.75;
          label = 'REW';
        } else {
          rate = 0.5;
          label = 'HOLD';
        }
      }

      if (dragRef.current.lastRate !== rate) {
        dragRef.current.lastRate = rate;
        onSetPlaybackRate(rate);
      }
      setIntensityBadge(label);
    },
    [onSetPlaybackRate]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const now = performance.now();
    retargetMotorRamp(motorRampRef.current, 0, 1, 0);

    dragRef.current = {
      active: true,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
      lastAngle: getAngle(e.clientX, e.clientY),
      lastTime: now,
      lastSeekTime: now,
      lastRate: 1,
      lastVel: 0,
      accumDeg: 0,
      startSongTime: currentTime,
      currentScrubTime: currentTime,
      idleTimer: null,
    };

    setIsScrubbing(true);
    setScrubTime(currentTime);
    setScrubDelta(0);
    setIntensityBadge(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;

    const now = performance.now();
    const dtMs = Math.max(6, now - d.lastTime);
    d.lastTime = now;

    const angle = getAngle(e.clientX, e.clientY);
    let delta = angle - d.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.lastAngle = angle;

    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.hasMoved && (dist > 6 || Math.abs(d.accumDeg + delta) > 3.5)) {
      d.hasMoved = true;
    }
    if (!d.hasMoved) return;

    spinAngleRef.current = (spinAngleRef.current + delta) % 360;
    const vel = (delta / dtMs) * 1000;
    d.lastVel = vel;
    d.accumDeg += delta;
    applyRate(vel);

    if (d.idleTimer !== null) window.clearTimeout(d.idleTimer);
    d.idleTimer = window.setTimeout(() => {
      if (dragRef.current.active && dragRef.current.hasMoved) {
        if (dragRef.current.lastRate !== 0.5) {
          dragRef.current.lastRate = 0.5;
          onSetPlaybackRate(0.5);
        }
        setIntensityBadge('HOLD');
      }
    }, 110);

    const secsPerTurn = Math.max(30, Math.min(75, duration * 0.25 || 50));
    const nextTime = Math.max(0, Math.min(duration, d.startSongTime + (d.accumDeg / 360) * secsPerTurn));
    d.currentScrubTime = nextTime;
    setScrubTime(nextTime);
    setScrubDelta(nextTime - d.startSongTime);

    if (now - d.lastSeekTime >= 150) {
      d.lastSeekTime = now;
      onSeek(nextTime);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (d.idleTimer !== null) window.clearTimeout(d.idleTimer);

    const wasScrub = d.hasMoved;
    const finalTime = d.currentScrubTime;
    const releaseVel = Math.max(-5, Math.min(5, (d.lastVel / 1000) * 16.666 * 0.35));

    d.active = false;
    setIsScrubbing(false);
    setScrubTime(null);
    setScrubDelta(0);
    setIntensityBadge(null);
    onSetPlaybackRate(1);

    if (wasScrub) {
      retargetMotorRamp(motorRampRef.current, isPlaying ? baseSpeed : 0, 850, releaseVel);
      onSeek(finalTime);
    } else {
      sound.playSwitch();
      onTogglePlay();
    }
  };

  return {
    containerRef,
    spinAngleRef,
    isScrubbing,
    scrubTime,
    scrubDelta,
    intensityBadge,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
