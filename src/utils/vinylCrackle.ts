/**
 * Procedural Vinyl Surface Noise & Dust Crackle Generator using Web Audio API.
 * Synthesizes authentic analog warmth without loading any external MP3 files.
 */

class VinylCrackleSynthesizer {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private crackleNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isRunning = false;
  private currentLevel: 'off' | 'subtle' | 'warm' = 'off';

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Generates 5 seconds of looping pink noise filtered for that dark record groove rumble
  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // Generates authentic intermittent record crackles and microscopic dust pops
  private createCrackleBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // 0.08% chance per sample of a microscopic dust pop
      if (Math.random() < 0.0008) {
        const amplitude = (Math.random() * 0.6 + 0.2) * (Math.random() > 0.5 ? 1 : -1);
        data[i] = amplitude;
        if (i + 1 < bufferSize) data[i + 1] = amplitude * -0.5; // Quick bipolar impulse
      } else {
        data[i] = 0;
      }
    }
    return buffer;
  }

  public setLevel(level: 'off' | 'subtle' | 'warm') {
    this.currentLevel = level;
    if (level === 'off') {
      this.stop();
    } else {
      this.start(level === 'subtle' ? 0.045 : 0.095);
    }
  }

  public getLevel(): 'off' | 'subtle' | 'warm' {
    return this.currentLevel;
  }

  private start(targetGain: number) {
    this.initContext();
    if (!this.ctx) return;

    if (!this.isRunning) {
      const noiseBuffer = this.createNoiseBuffer();
      const crackleBuffer = this.createCrackleBuffer();
      if (!noiseBuffer || !crackleBuffer) return;

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.crackleNode = this.ctx.createBufferSource();
      this.crackleNode.buffer = crackleBuffer;
      this.crackleNode.loop = true;

      // Filter: Warm analog LP curve (low pass around 1800Hz, high pass at 60Hz)
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(1800, this.ctx.currentTime);

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(60, this.ctx.currentTime);

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);

      this.noiseNode.connect(lowpass);
      this.crackleNode.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.noiseNode.start();
      this.crackleNode.start();
      this.isRunning = true;
    } else if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
    }
  }

  private stop() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => {
        try {
          this.noiseNode?.stop();
          this.crackleNode?.stop();
          this.noiseNode?.disconnect();
          this.crackleNode?.disconnect();
        } catch {
          // ignore
        }
        this.noiseNode = null;
        this.crackleNode = null;
        this.isRunning = false;
      }, 150);
    }
  }
}

export const vinylCrackle = new VinylCrackleSynthesizer();
