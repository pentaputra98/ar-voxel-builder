// ============================================================
// Procedural WebAudio synth — every one-shot is generated, so there are
// ZERO audio files to ship (tiny bundle, offline-trivial) and pitch can
// track game state (build height, combo). Unlocked on first user gesture.
// ============================================================
import { CONFIG } from '../config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.enabled = false;
  }

  // Must be called from a user gesture (start-screen tap) per autoplay policy.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = CONFIG.fx.audioMasterGain;
    this.master.connect(this.ctx.destination);
    this.enabled = true;
    this._startAmbience();
  }

  _env(node, gain, t0, attack, hold, release) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(gain, t0 + attack);
    g.setValueAtTime(gain, t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }

  _tone({ type = 'sine', freq = 440, gain = 0.3, attack = 0.005, hold = 0.02, release = 0.12, glideTo = null, dest = null }) {
    if (!this.enabled) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + attack + hold + release);
    this._env(g, gain, t0, attack, hold, release);
    osc.connect(g); g.connect(dest || this.master);
    osc.start(t0); osc.stop(t0 + attack + hold + release + 0.05);
  }

  _noise({ gain = 0.3, release = 0.2, hp = 800 }) {
    if (!this.enabled) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * (release + 0.05));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp;
    const g = this.ctx.createGain();
    this._env(g, gain, t0, 0.002, 0.01, release);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + release + 0.06);
  }

  // ---- game one-shots ----
  place(height = 0) {
    // pitch rises with build height for a musical sense of progress
    const base = 520 + height * 70;
    this._tone({ type: 'triangle', freq: base, glideTo: base * 1.5, gain: 0.35, attack: 0.004, hold: 0.01, release: 0.09 });
    this._tone({ type: 'sine', freq: base * 2, gain: 0.12, release: 0.05 });
  }
  invalid() { this._tone({ type: 'square', freq: 150, gain: 0.18, release: 0.1 }); }
  delete() {
    this._noise({ gain: 0.4, release: 0.25, hp: 1200 });
    this._tone({ type: 'sawtooth', freq: 300, glideTo: 90, gain: 0.2, release: 0.2 });
  }
  tick() { this._tone({ type: 'sine', freq: 900, gain: 0.08, release: 0.03 }); }
  blip() { this._tone({ type: 'square', freq: 660, gain: 0.12, release: 0.05 }); }
  // satisfying mechanical "thunk" as the active build layer shifts
  layerShift(layer = 0) {
    const base = 240 + layer * 55;
    this._tone({ type: 'square', freq: base, glideTo: base * 1.4, gain: 0.16, attack: 0.003, hold: 0.015, release: 0.07 });
    this._noise({ gain: 0.12, release: 0.06, hp: 400 });
  }
  undo() {
    // reverse-sweep "whoosh" so it reads as taking something back
    this._tone({ type: 'sawtooth', freq: 520, glideTo: 180, gain: 0.22, attack: 0.004, hold: 0.01, release: 0.18 });
    this._noise({ gain: 0.16, release: 0.14, hp: 900 });
  }

  levelClear() {
    // rising triumphant arpeggio stinger
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((f, i) => setTimeout(() => {
      this._tone({ type: 'triangle', freq: f, gain: 0.3, attack: 0.005, hold: 0.06, release: 0.35 });
      this._tone({ type: 'sine', freq: f * 2, gain: 0.1, release: 0.25 });
    }, i * 90));
  }
  countdown() { this._tone({ type: 'sine', freq: 700, gain: 0.25, release: 0.15 }); }
  shutter() { this._noise({ gain: 0.5, release: 0.08, hp: 2000 }); }

  _startAmbience() {
    // very low, slow pad so the booth feels "alive" without asset bloat
    const t0 = this.ctx.currentTime;
    const pad = this.ctx.createGain(); pad.gain.value = 0.05; pad.connect(this.master);
    [110, 164.81, 220].forEach((f) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08;
      const lg = this.ctx.createGain(); lg.gain.value = 2.5;
      lfo.connect(lg); lg.connect(o.detune);
      o.connect(pad); o.start(t0); lfo.start(t0);
    });
    this.music = pad;
  }
  duckMusic(to = 0.02, back = 0.05) {
    if (!this.music) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(to, t);
    this.music.gain.linearRampToValueAtTime(back, t + 0.6);
  }
}
