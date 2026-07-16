// ============================================================
// PointerInput — mouse/keyboard fallback that emits the exact same
// InputState as HandTracker. Lets the game run and be tested without a
// webcam, and doubles as a robust booth-setup / demo mode.
//
//   move mouse   -> cursor (point/aim)
//   left button  -> pinch (place)
//   right button -> fist  (delete)
//   hold SHIFT + move horizontally -> orbit (2nd-hand navigation)
// ============================================================
import { GestureLatch } from '../hands/gestures.js';
import { CONFIG } from '../config.js';

export class PointerInput {
  constructor() {
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this._left = false;
    this._right = false;
    this._shift = false;
    this._present = false;
    this._pinchLatch = new GestureLatch(30);
    this._fistLatch = new GestureLatch(30);
    this._pinchAnim = 0;
    this._layerT = 0;          // wheel-controlled active layer (0..1)
    this._undoQueued = false;  // z / backspace edge
    this._bound = false;
  }

  attach() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('mousemove', (e) => {
      this.x = e.clientX; this.y = e.clientY; this._present = true;
      this._shift = e.shiftKey;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._left = true;
      if (e.button === 2) this._right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._left = false;
      if (e.button === 2) this._right = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this._shift = true;
      if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') this._undoQueued = true;
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') this._shift = false; });
    // mouse wheel changes the active build layer (L3 / debug)
    window.addEventListener('wheel', (e) => {
      const H = CONFIG.grid.height;
      const step = (e.deltaY < 0 ? 1 : -1) / (H - 1);
      this._layerT = Math.min(1, Math.max(0, this._layerT + step));
    }, { passive: true });
  }

  update(tMs) {
    // ease the reticle-morph value toward the button state
    const target = this._left ? 1 : 0.12;
    this._pinchAnim += (target - this._pinchAnim) * 0.35;

    const pinch = this._pinchLatch.update(this._left, tMs);
    const fist = this._fistLatch.update(this._right && !this._left, tMs);

    let orbit = { active: false, value: null };
    if (this._shift) orbit = { active: true, value: this.x / window.innerWidth };

    const undoDown = this._undoQueued; this._undoQueued = false;

    return {
      source: 'pointer',
      present: this._present,
      cursor: { x: this.x, y: this.y },
      pinchProgress: this._pinchAnim,
      pinch, fist, orbit,
      navHeight: this._layerT,
      undo: { down: undoDown },
    };
  }
}
