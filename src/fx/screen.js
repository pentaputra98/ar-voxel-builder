// ============================================================
// ScreenFX — trauma-based screen shake (camera offset), hit-stop /
// time-scale, and full-screen colour flashes. Scaled to event weight so
// the level-clear is always the loudest moment (feedback hierarchy).
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class ScreenFX {
  constructor() {
    this.trauma = 0;                 // 0..1, shake = trauma^2
    this.timeScale = 1;             // <1 = slow-mo
    this._hitStopUntil = 0;
    this._offset = new THREE.Vector3();
    this.flashEl = document.getElementById('fx-flash');
    this.vignetteEl = document.getElementById('fx-vignette');
  }

  addTrauma(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  // Freeze the sim briefly — the brain reads the pause as impact.
  hitStop(ms) { this._hitStopUntil = performance.now() + ms; }

  slowMo(scale, holdMs) {
    this.timeScale = scale;
    clearTimeout(this._smTimer);
    this._smTimer = setTimeout(() => { this.timeScale = 1; }, holdMs);
  }

  flash(color = '#F5F9FF', peak = 0.85, ms = 320) {
    if (!this.flashEl) return;
    this.flashEl.style.background = color;
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = String(peak);
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${ms}ms ease-out`;
      this.flashEl.style.opacity = '0';
    });
  }

  isFrozen() { return performance.now() < this._hitStopUntil; }

  // returns the camera shake offset for this frame
  update(dt) {
    this.trauma = Math.max(0, this.trauma - CONFIG.fx.shakeDecay * dt);
    const s = this.trauma * this.trauma;
    const mag = s * 0.45;
    this._offset.set(
      (Math.random() * 2 - 1) * mag,
      (Math.random() * 2 - 1) * mag,
      (Math.random() * 2 - 1) * mag * 0.5);
    return this._offset;
  }
}
