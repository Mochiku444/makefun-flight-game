// Procedural sound from the Web Audio API — no audio files. A sawtooth
// engine note through a low-pass filter tracks rpm, a filtered noise loop
// is the wind, and short blips mark rings, warnings and the landing thump.
// Sound starts on the first user gesture, as browsers require.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
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

    // Engine: two detuned saws into a low-pass.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    this.engineOsc2.start();

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

  update(flight) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 28 + flight.throttle * 62 + flight.speed * 0.14;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 0.5 + 1.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(240 + flight.throttle * 620, t, 0.1);
    const engineLevel = this.muted ? 0 : 0.028 + flight.throttle * 0.05;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    const windLevel = this.muted ? 0 : Math.min(0.11, flight.speed * 0.0013);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(320 + flight.speed * 7, t, 0.2);
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
