// Web Audio API synthesized tactile clicks + velocity-responsive DJ vinyl scratch engine

interface ScratchNodes {
  grainSource: AudioBufferSourceNode;
  noiseSource: AudioBufferSourceNode;
  grainFilter: BiquadFilterNode;
  noiseFilter: BiquadFilterNode;
  masterGain: GainNode;
  idleTimer: number | null;
}

class SoundEffects {
  private ctx: AudioContext | null = null;
  private scratchNodes: ScratchNodes | null = null;
  private grooveBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureScratchBuffers(ctx: AudioContext) {
    if (!this.grooveBuffer) {
      // Rich harmonic waveform + micro-vinyl grain that pitches naturally like a real record sample
      const length = Math.floor(ctx.sampleRate * 1.2);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / ctx.sampleRate;
        // Warm formant-like tone cluster + subtle vinyl groove grit
        const tone =
          Math.sin(2 * Math.PI * 195 * t) * 0.32 +
          Math.sin(2 * Math.PI * 392 * t + 0.4) * 0.24 +
          Math.sin(2 * Math.PI * 587 * t + 1.1) * 0.16 +
          Math.sin(2 * Math.PI * 980 * t) * 0.08;
        const grit = (Math.random() * 2 - 1) * 0.22;
        data[i] = (tone + grit) * 0.7;
      }
      this.grooveBuffer = buffer;
    }

    if (!this.noiseBuffer) {
      // Crisp stylus friction noise buffer
      const length = Math.floor(ctx.sampleRate * 1.0);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        // Pink-ish warm vinyl friction spectrum
        last = (last + 0.08 * white) / 1.08;
        data[i] = last * 2.4 + white * 0.25;
      }
      this.noiseBuffer = buffer;
    }
  }

  // Soft Apple-style tactile click
  public playClick(freq = 1200, duration = 0.02) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.075, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // ignore if autoplay blocked
    }
  }

  // Subtle disc cue / spin-up whoosh
  public playDiscSpin() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(85, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(310, ctx.currentTime + 0.26);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.26);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.038, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // ignore
    }
  }

  // Short crisp vinyl needle zip when switching tracks or committing a scrub
  public playNeedleScratch(direction: 1 | -1 = 1) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      this.ensureScratchBuffers(ctx);

      const now = ctx.currentTime;
      const dur = 0.13;

      const src = ctx.createBufferSource();
      src.buffer = this.grooveBuffer!;
      src.loop = true;
      src.playbackRate.setValueAtTime(direction > 0 ? 0.65 : 1.55, now);
      src.playbackRate.exponentialRampToValueAtTime(direction > 0 ? 1.85 : 0.45, now + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(3.2, now);
      filter.frequency.setValueAtTime(direction > 0 ? 650 : 1900, now);
      filter.frequency.exponentialRampToValueAtTime(direction > 0 ? 2200 : 520, now + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      src.start(now);
      src.stop(now + dur + 0.01);
    } catch {
      // ignore
    }
  }

  // Start continuous turntable vinyl scratch session when pointer grabs the disc
  public startScratch() {
    if (!this.enabled) return;
    this.stopScratch();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      this.ensureScratchBuffers(ctx);

      const now = ctx.currentTime;

      const grainSource = ctx.createBufferSource();
      grainSource.buffer = this.grooveBuffer!;
      grainSource.loop = true;
      grainSource.playbackRate.setValueAtTime(0.5, now);

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer!;
      noiseSource.loop = true;

      const grainFilter = ctx.createBiquadFilter();
      grainFilter.type = 'bandpass';
      grainFilter.frequency.setValueAtTime(800, now);
      grainFilter.Q.setValueAtTime(2.6, now);

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1600, now);
      noiseFilter.Q.setValueAtTime(3.8, now);

      const grainMix = ctx.createGain();
      grainMix.gain.setValueAtTime(0.75, now);

      const noiseMix = ctx.createGain();
      noiseMix.gain.setValueAtTime(0.55, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);

      grainSource.connect(grainFilter);
      grainFilter.connect(grainMix);
      grainMix.connect(masterGain);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseMix);
      noiseMix.connect(masterGain);

      masterGain.connect(ctx.destination);

      grainSource.start(now);
      noiseSource.start(now);

      this.scratchNodes = {
        grainSource,
        noiseSource,
        grainFilter,
        noiseFilter,
        masterGain,
        idleTimer: null,
      };
    } catch {
      // ignore
    }
  }

  /**
   * Modulates real-time pitch, filter resonance, and volume from angular velocity (deg/sec).
   * Positive = clockwise (forward), Negative = counter-clockwise (rewind).
   */
  public updateScratch(angularVelocityDegPerSec: number) {
    if (!this.enabled || !this.scratchNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const speed = Math.abs(angularVelocityDegPerSec);
    const isForward = angularVelocityDegPerSec >= 0;

    // Normalize angular speed (0..650 deg/sec -> 0..1)
    const norm = Math.min(1, speed / 550);

    // Pitch sweeps like a real stylus accelerating/decelerating over vinyl grooves
    const targetRate = 0.28 + norm * (isForward ? 2.6 : 2.1);
    const targetGrainFreq = (isForward ? 420 : 310) + norm * (isForward ? 2100 : 1550);
    const targetNoiseFreq = (isForward ? 950 : 720) + norm * 2600;
    const targetGain = speed < 8 ? 0.0001 : Math.min(0.18, 0.028 + norm * 0.15);

    const { grainSource, grainFilter, noiseFilter, masterGain } = this.scratchNodes;
    grainSource.playbackRate.setTargetAtTime(targetRate, now, 0.018);
    grainFilter.frequency.setTargetAtTime(targetGrainFreq, now, 0.018);
    noiseFilter.frequency.setTargetAtTime(targetNoiseFreq, now, 0.018);
    masterGain.gain.setTargetAtTime(targetGain, now, 0.016);

    // Automatically silence the needle if pointer pauses while still holding the disc
    if (this.scratchNodes.idleTimer !== null) {
      window.clearTimeout(this.scratchNodes.idleTimer);
    }
    this.scratchNodes.idleTimer = window.setTimeout(() => {
      if (this.scratchNodes && this.ctx) {
        this.scratchNodes.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.025);
      }
    }, 45);
  }

  // Smoothly release scratch audio graph when pointer lifts off the disc
  public stopScratch() {
    if (!this.scratchNodes) return;
    const nodes = this.scratchNodes;
    this.scratchNodes = null;

    if (nodes.idleTimer !== null) {
      window.clearTimeout(nodes.idleTimer);
    }

    try {
      if (this.ctx) {
        const now = this.ctx.currentTime;
        nodes.masterGain.gain.cancelScheduledValues(now);
        nodes.masterGain.gain.setTargetAtTime(0.0001, now, 0.02);
        window.setTimeout(() => {
          try {
            nodes.grainSource.stop();
            nodes.noiseSource.stop();
            nodes.grainSource.disconnect();
            nodes.noiseSource.disconnect();
            nodes.masterGain.disconnect();
          } catch {
            // ignore
          }
        }, 120);
      }
    } catch {
      // ignore
    }
  }

  public playSwitch() {
    this.playClick(800, 0.03);
  }
}

export const sound = new SoundEffects();
