// Procedural sound from the Web Audio API — no audio files.
// The engine follows the dual-layer model used by good arcade racers: an
// idle loop and a run loop crossfaded with equal power (cos/sin) so the
// transition has no volume dip, driven by SPEED rather than throttle,
// with RPM as a smoothed value that tracks the speed ratio. A filtered
// noise loop is the wind, and short blips mark rings and warnings.
// Sound starts on the first user gesture, as browsers require.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.runBlend = 0; // 0 = pure idle, 1 = pure run
    this.rpmSmooth = 0; // 0..~1.2, smoothed speed ratio
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    // Idle layer: a low triangle purr.
    this.idleOsc = ctx.createOscillator();
    this.idleOsc.type = 'triangle';
    this.idleOsc.frequency.value = 52;
    this.idleGain = ctx.createGain();
    this.idleGain.gain.value = 0;
    this.idleOsc.connect(this.idleGain);
    this.idleGain.connect(ctx.destination);
    this.idleOsc.start();

    // Run layer: two detuned saws through a low-pass, the working roar.
    this.runOsc = ctx.createOscillator();
    this.runOsc.type = 'sawtooth';
    this.runOsc2 = ctx.createOscillator();
    this.runOsc2.type = 'square';
    this.runFilter = ctx.createBiquadFilter();
    this.runFilter.type = 'lowpass';
    this.runFilter.frequency.value = 300;
    this.runGain = ctx.createGain();
    this.runGain.gain.value = 0;
    this.runOsc.connect(this.runFilter);
    this.runOsc2.connect(this.runFilter);
    this.runFilter.connect(this.runGain);
    this.runGain.connect(ctx.destination);
    this.runOsc.start();
    this.runOsc2.start();

    // Wind: looped noise buffer through a band-pass.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = buffer;
    this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 480;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    this.windSrc.start();
  }

  update(flight, dt = 0.016) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const speed = Math.abs(flight.speed);
    const speedRatio = Math.min(1.35, speed / 92);

    // Equal-power crossfade by speed: standstill is pure idle, the blend
    // completes by 14 m/s, with a small lift when the pilot holds power
    // against the brakes on the runway.
    let targetBlend = smoothstep(1, 14, speed);
    if (targetBlend === 0 && flight.throttle > 0.1) targetBlend = 0.12;
    this.runBlend += (targetBlend - this.runBlend) * Math.min(1, dt * 6.5);

    // RPM tracks speed, smoothed, with a load offset under power and in
    // a climb — steady, never jittery.
    let targetRpm = speedRatio;
    if (flight.throttle > 0.1 && speed > 1) targetRpm += 0.04;
    if (flight.pitch > 0.25 && flight.throttle > 0.6) targetRpm += 0.06;
    this.rpmSmooth += (targetRpm - this.rpmSmooth) * Math.min(1, dt * 5.5);

    const idleLevel = Math.cos(this.runBlend * Math.PI * 0.5) * 0.30;
    const runBase = 0.16 + this.rpmSmooth * 0.30;
    const runLevel = Math.sin(this.runBlend * Math.PI * 0.5) * runBase;
    const master = this.muted ? 0 : 1;
    this.idleGain.gain.setTargetAtTime(idleLevel * master * (flight.crashed ? 0.2 : 1), t, 0.09);
    this.idleOsc.frequency.setTargetAtTime(50 + speed * 0.7, t, 0.1);
    this.runGain.gain.setTargetAtTime(runLevel * master, t, 0.09);
    const runFreq = 42 + this.rpmSmooth * 105;
    this.runOsc.frequency.setTargetAtTime(runFreq, t, 0.08);
    this.runOsc2.frequency.setTargetAtTime(runFreq * 0.5 + 1.5, t, 0.08);
    this.runFilter.frequency.setTargetAtTime(240 + this.rpmSmooth * 640, t, 0.1);

    const windLevel = this.muted ? 0 : Math.min(0.11, speed * 0.0013);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(320 + speed * 7, t, 0.2);
  }

  blip(freq, seconds = 0.16, type = 'sine', level = 0.12) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  ringCleared() {
    this.blip(880, 0.14);
    setTimeout(() => this.blip(1318, 0.2), 90);
  }
  warning() {
    this.blip(196, 0.22, 'square', 0.07);
  }
  thump() {
    this.blip(74, 0.3, 'triangle', 0.22);
  }
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
