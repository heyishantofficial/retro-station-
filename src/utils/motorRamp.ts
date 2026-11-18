// True Cubic S-Curve Ease-In-Out Motor Ramp (interruptible from live speed)

export interface MotorRampState {
  startSpeed: number;
  targetSpeed: number;
  startTime: number;
  durationMs: number;
  currentSpeed: number;
}

export function createMotorRamp(initialSpeed = 0): MotorRampState {
  return {
    startSpeed: initialSpeed,
    targetSpeed: initialSpeed,
    startTime: performance.now(),
    durationMs: 1,
    currentSpeed: initialSpeed,
  };
}

export function retargetMotorRamp(
  ramp: MotorRampState,
  newTarget: number,
  durationMs: number,
  overrideCurrentSpeed?: number
) {
  const liveSpeed =
    overrideCurrentSpeed !== undefined ? overrideCurrentSpeed : ramp.currentSpeed;
  ramp.startSpeed = liveSpeed;
  ramp.targetSpeed = newTarget;
  ramp.startTime = performance.now();
  ramp.durationMs = Math.max(1, durationMs);
  ramp.currentSpeed = liveSpeed;
}

export function sampleMotorRamp(ramp: MotorRampState, now: number): number {
  const u = Math.max(0, Math.min(1, (now - ramp.startTime) / ramp.durationMs));
  // Cubic ease-in-out S-curve: gentle start, fluid acceleration, velvety stop
  const eased = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  ramp.currentSpeed = ramp.startSpeed + (ramp.targetSpeed - ramp.startSpeed) * eased;
  return ramp.currentSpeed;
}
