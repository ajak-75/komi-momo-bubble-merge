/**
 * All sound is synthesised with the Web Audio API — no audio files, no CDN, 0 won.
 * SFX and BGM have separate gain stages so each can be toggled on its own.
 */

type Wave = OscillatorType;

const A = 440;
const note = (semitonesFromA4: number): number => A * Math.pow(2, semitonesFromA4 / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private bgmTimer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  sfxEnabled = true;
  bgmEnabled = true;
  ready = false;

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxEnabled ? 0.6 : 0;
      this.sfxBus.connect(this.master);

      this.bgmBus = ctx.createGain();
      this.bgmBus.gain.value = this.bgmEnabled ? 0.14 : 0;
      this.bgmBus.connect(this.master);

      this.ready = true;
      if (this.bgmEnabled) this.startBgm();
    } catch {
      this.ctx = null;
    }
  }

  setSfx(on: boolean): void {
    this.sfxEnabled = on;
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.03);
  }

  setBgm(on: boolean): void {
    this.bgmEnabled = on;
    if (this.bgmBus && this.ctx) this.bgmBus.gain.setTargetAtTime(on ? 0.14 : 0, this.ctx.currentTime, 0.2);
    if (on) this.startBgm();
    else this.stopBgm();
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private tone(opts: {
    freq: number;
    dur: number;
    when?: number;
    type?: Wave;
    gain?: number;
    bus?: GainNode | null;
    glideTo?: number;
    attack?: number;
  }): void {
    const ctx = this.ctx;
    const bus = opts.bus ?? this.sfxBus;
    if (!ctx || !bus) return;
    const start = opts.when ?? this.now();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, start);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.glideTo), start + opts.dur);
    const peak = opts.gain ?? 0.3;
    const attack = opts.attack ?? 0.008;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + opts.dur + 0.05);
  }

  private noise(dur: number, gainValue = 0.15, when?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const start = when ?? this.now();
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(start);
  }

  /* ------------------------------------------------------------------ sfx */

  playShoot(): void {
    this.tone({ freq: note(-9), dur: 0.1, type: 'triangle', gain: 0.2, glideTo: note(3) });
  }

  playBounce(): void {
    this.tone({ freq: note(-5), dur: 0.07, type: 'square', gain: 0.08, glideTo: note(-1) });
  }

  /** A pop that climbs with the combo, like beads clicking into place. */
  playPop(combo: number, size = 3): void {
    const steps = [0, 3, 5, 7, 10, 12, 15, 17];
    const base = steps[Math.min(steps.length - 1, Math.max(0, combo - 1))] ?? 0;
    const start = this.now();
    this.tone({ freq: note(base - 5), dur: 0.16, type: 'triangle', gain: 0.26, glideTo: note(base + 7) });
    this.tone({ freq: note(base + 12), dur: 0.12, when: start + 0.02, type: 'sine', gain: 0.12 });
    this.noise(0.1, 0.07);
    for (let i = 1; i < Math.min(6, size); i++) {
      this.tone({ freq: note(base + 7 + i * 2), dur: 0.1, when: start + i * 0.035, type: 'sine', gain: 0.08 });
    }
  }

  playDrop(count: number): void {
    const start = this.now();
    const ticks = Math.min(8, Math.max(2, count));
    for (let i = 0; i < ticks; i++) {
      this.tone({
        freq: note(7 - i * 3),
        dur: 0.12,
        when: start + i * 0.055,
        type: 'sine',
        gain: 0.1,
      });
    }
  }

  playRow(): void {
    const start = this.now();
    this.tone({ freq: note(-17), dur: 0.24, type: 'sawtooth', gain: 0.14, glideTo: note(-24) });
    this.noise(0.16, 0.05, start);
  }

  playClear(): void {
    const start = this.now();
    [0, 4, 7, 12, 16, 19].forEach((semi, i) => {
      this.tone({ freq: note(semi + 3), dur: 0.5, when: start + i * 0.075, type: 'triangle', gain: 0.2 });
      this.tone({ freq: note(semi + 15), dur: 0.4, when: start + i * 0.075, type: 'sine', gain: 0.08 });
    });
    this.noise(0.5, 0.05, start + 0.1);
  }

  playGameOver(): void {
    const start = this.now();
    [0, -3, -7, -12].forEach((semi, i) => {
      this.tone({ freq: note(semi), dur: 0.42, when: start + i * 0.17, type: 'triangle', gain: 0.22 });
    });
  }

  playUi(): void {
    this.tone({ freq: note(12), dur: 0.06, type: 'sine', gain: 0.14 });
  }

  /* ------------------------------------------------------------------ bgm */

  startBgm(): void {
    if (!this.ctx || !this.bgmEnabled || this.bgmTimer !== null) return;
    this.nextBar = this.ctx.currentTime + 0.1;
    this.bar = 0;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 240);
    this.scheduleBgm();
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /** A four-bar, slow, music-box loop in A minor pentatonic. */
  private scheduleBgm(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmBus) return;
    const barLength = 2.4;
    while (this.nextBar < ctx.currentTime + 1.2) {
      const chords = [
        [0, 3, 7],
        [-4, 0, 3],
        [-7, -4, 0],
        [-2, 2, 5],
      ];
      const chord = chords[this.bar % chords.length];
      const start = this.nextBar;
      for (const semi of chord) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        osc.type = 'sine';
        osc.frequency.value = note(semi - 12);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.1, start + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + barLength);
        osc.connect(filter).connect(gain).connect(this.bgmBus);
        osc.start(start);
        osc.stop(start + barLength + 0.1);
      }
      const melody = [12, 15, 19, 22, 19, 15, 12, 10];
      melody.forEach((semi, i) => {
        const t = start + i * (barLength / 8);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note(semi + (this.bar % 2 === 0 ? 0 : -2));
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        osc.connect(gain).connect(this.bgmBus!);
        osc.start(t);
        osc.stop(t + 0.6);
      });
      this.nextBar += barLength;
      this.bar += 1;
    }
  }
}
