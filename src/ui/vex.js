// ============================================================
// VEX — the VECTOR pixel-robot mascot. Drawn procedurally on a tiny
// canvas (chunky pixels, 2-3 palette colours). Reacts to gameplay:
// idle/blink, happy (thumbs-up on clear), point (onboarding), oops.
// ============================================================
import { CSSCOLOR } from '../config.js';

const P = 8;              // logical pixel grid is 8x8 scaled up
export class Vex {
  constructor(canvas, bubbleEl) {
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;      // 64
    this.scale = this.size / P;
    this.bubble = bubbleEl;
    this.mood = 'idle';
    this.t = 0;
    this._blink = 0;
  }

  setMood(m) { this.mood = m; }

  say(text, ms = 2200) {
    if (!this.bubble) return;
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(() => this.bubble.classList.remove('show'), ms);
  }

  _px(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
  }

  update(dt) {
    this.t += dt;
    this._blink -= dt;
    if (this._blink < 0) this._blink = 2 + Math.random() * 2.5;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    const body = CSSCOLOR.blue;
    const dark = CSSCOLOR.navy;
    const acc = CSSCOLOR.orange;
    const eyeOpen = this._blink > 0.12;

    // head shell (rows 1-5, cols 1-6)
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 6; x++) this._px(x, y, body);
    // antenna
    this._px(3, 0, acc); this._px(4, 0, acc);
    // dark visor band
    for (let x = 1; x <= 6; x++) this._px(x, 2, dark);

    // eyes
    if (this.mood === 'happy') {
      // ^ ^ happy eyes
      this._px(2, 2, acc); this._px(5, 2, acc);
    } else if (eyeOpen) {
      this._px(2, 2, CSSCOLOR.white); this._px(5, 2, CSSCOLOR.white);
    }

    // mouth / expression on row 4
    if (this.mood === 'happy') { this._px(3, 4, acc); this._px(4, 4, acc); }
    else if (this.mood === 'oops') { this._px(3, 4, CSSCOLOR.red); }
    else { this._px(3, 4, dark); this._px(4, 4, dark); }

    // arm (thumbs-up when happy)
    if (this.mood === 'happy') { this._px(7, 3, acc); this._px(7, 2, acc); }
    else if (this.mood === 'point') { this._px(7, 3, acc); this._px(6, 3, acc); }
    else { this._px(6, 5, body); }

    // feet
    this._px(2, 6, dark); this._px(5, 6, dark);
  }
}
