// ============================================================
// TuningPanel — live webcam testing mode (toggle with 'T').
// Sliders write straight into CONFIG so you can dial thresholds on real
// hardware, and a canvas overlay draws the hand skeleton, the forgiving-
// delete radius, the targeted voxel, and a swipe-velocity meter with the
// undo threshold marked — so you can SEE exactly when a gesture fires.
// ============================================================
import { CONFIG, CSSCOLOR } from '../config.js';

const HAND_BONES = [
  [0,1],[1,2],[2,3],[3,4],            // thumb
  [0,5],[5,6],[6,7],[7,8],            // index
  [5,9],[9,10],[10,11],[11,12],       // middle
  [9,13],[13,14],[14,15],[15,16],     // ring
  [13,17],[17,18],[18,19],[19,20],    // pinky
  [0,17],                             // palm base
];

export class TuningPanel {
  constructor({ tracker, ar, field, world }) {
    this.tracker = tracker; this.ar = ar; this.field = field; this.world = world;
    this.visible = false;

    // overlay canvas (above HUD, below full-screen overlays)
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', zIndex: '4', pointerEvents: 'none', display: 'none',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.panel = this._buildPanel();
    document.body.appendChild(this.panel);
  }

  toggle() {
    this.visible = !this.visible;
    this.canvas.style.display = this.visible ? '' : 'none';
    this.panel.style.display = this.visible ? '' : 'none';
    if (!this.visible) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _buildPanel() {
    const p = document.createElement('div');
    p.id = 'tuning-panel';
    p.style.display = 'none';
    p.innerHTML = `<div class="tp-title">◈ LIVE TUNING <span class="tp-hint">press T to close</span></div>
      <div class="tp-rows"></div>
      <div class="tp-readout" id="tp-readout"></div>`;
    const rows = p.querySelector('.tp-rows');

    const add = (label, get, set, min, max, step, fmt = (v) => v) => {
      const row = document.createElement('label'); row.className = 'tp-row';
      row.innerHTML = `<span class="tp-lab">${label}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${get()}">
        <span class="tp-val">${fmt(get())}</span>`;
      const input = row.querySelector('input'); const val = row.querySelector('.tp-val');
      input.addEventListener('input', () => { const v = parseFloat(input.value); set(v); val.textContent = fmt(v); });
      rows.appendChild(row);
    };

    // the primary placement control the user calibrates:
    add('Dwell place time (ms)', () => CONFIG.controls.dwellPlaceMs, (v) => CONFIG.controls.dwellPlaceMs = v, 300, 2000, 25);
    // gesture thresholds
    add('Pinch threshold', () => CONFIG.hands.pinchThreshold, (v) => CONFIG.hands.pinchThreshold = v, 0.20, 0.80, 0.01, (v) => v.toFixed(2));
    add('Fist curl count', () => CONFIG.hands.fistCurlCount, (v) => CONFIG.hands.fistCurlCount = v, 2, 4, 1);
    add('Gesture debounce (ms)', () => CONFIG.hands.debounceMs, (v) => CONFIG.hands.debounceMs = v, 30, 220, 10);
    // the two the user asked to test by hand:
    add('Undo swipe speed (px/s)', () => CONFIG.controls.undoSwipeVel, (v) => CONFIG.controls.undoSwipeVel = v, 300, 1800, 25);
    add('Delete radius (×diag)', () => CONFIG.controls.deleteRadiusFrac, (v) => CONFIG.controls.deleteRadiusFrac = v, 0.08, 0.5, 0.01, (v) => v.toFixed(2));
    add('Dwell-undo (ms)', () => CONFIG.controls.dwellUndoMs, (v) => CONFIG.controls.dwellUndoMs = v, 250, 1200, 25);
    // camera
    add('L3 auto-orbit (rad/s)', () => CONFIG.camera.autoOrbitSpeed, (v) => CONFIG.camera.autoOrbitSpeed = v, 0.0, 0.7, 0.02, (v) => v.toFixed(2));
    return p;
  }

  // called every frame from the main loop
  update(input) {
    if (!this.visible) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (this.canvas.width !== w * dpr) { this.canvas.width = w * dpr; this.canvas.height = h * dpr; }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this._drawHands(ctx);
    this._drawDeleteRadius(ctx, input);
    this._drawSwipeMeter(ctx, w, h);
    this._readout(input);
  }

  _drawHands(ctx) {
    const d = this.tracker.debug;
    if (!d || !d.landmarks || d.landmarks.length === 0) return;
    for (let hi = 0; hi < d.landmarks.length; hi++) {
      const lm = d.landmarks[hi];
      const isDom = hi === d.domIndex;
      const col = isDom ? CSSCOLOR.orange : CSSCOLOR.blue;
      const pts = lm.map((p) => this.ar.normalizedToScreen(p.x, p.y));
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
      for (const [a, b] of HAND_BONES) {
        ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = col;
      for (const pt of pts) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
      // pinch line thumb(4)-index(8)
      ctx.strokeStyle = CSSCOLOR.white; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pts[4].x, pts[4].y); ctx.lineTo(pts[8].x, pts[8].y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawDeleteRadius(ctx, input) {
    if (!input || !input.cursor) return;
    const { x, y } = input.cursor;
    const r = CONFIG.controls.deleteRadiusFrac * Math.hypot(window.innerWidth, window.innerHeight);
    ctx.strokeStyle = CSSCOLOR.red; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // crosshair
    ctx.strokeStyle = CSSCOLOR.white; ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
    // which voxel a fist would shatter
    const del = this.field.nearestVoxelToCursor(input.cursor, this.world.camera);
    if (del) {
      const v = this.field.worldCenter(del).clone().project(this.world.camera);
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      ctx.strokeStyle = CSSCOLOR.red; ctx.lineWidth = 3;
      ctx.strokeRect(sx - 14, sy - 14, 28, 28);
    }
  }

  _drawSwipeMeter(ctx, w, h) {
    const cx = w / 2, y = h - 96, half = 200;
    const vx = this.tracker.debug?.swipeVx || 0;
    const thr = CONFIG.controls.undoSwipeVel;
    const maxV = Math.max(thr * 1.8, 1200);
    ctx.font = '12px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = CSSCOLOR.blue; ctx.fillText('SWIPE VELOCITY (undo when past the red mark)', cx, y - 14);
    // track
    ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - half, y, half * 2, 14);
    // zero line
    ctx.strokeStyle = 'rgba(245,249,255,0.5)';
    ctx.beginPath(); ctx.moveTo(cx, y - 4); ctx.lineTo(cx, y + 18); ctx.stroke();
    // left threshold (leftward swipe = undo)
    const thrX = cx - (thr / maxV) * half;
    ctx.strokeStyle = CSSCOLOR.red; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(thrX, y - 4); ctx.lineTo(thrX, y + 18); ctx.stroke();
    // current value bar
    const bx = Math.max(-half, Math.min(half, (vx / maxV) * half));
    const fired = vx < -thr;
    ctx.fillStyle = fired ? CSSCOLOR.orange : CSSCOLOR.blue;
    ctx.fillRect(cx, y + 2, bx, 10);
    ctx.fillStyle = fired ? CSSCOLOR.orange : CSSCOLOR.white;
    ctx.fillText(`${Math.round(vx)} px/s`, cx, y + 34);
  }

  _readout(input) {
    const el = document.getElementById('tp-readout'); if (!el) return;
    const m = this.tracker.debug?.metrics;
    const src = input?.source || '—';
    const rows = [
      `input: ${src}${src === 'pointer' ? ' (no webcam / mouse mode)' : ''}`,
      `active layer: ${this.field.activeLayer + 1}/${this.field.H}`,
    ];
    if (m) {
      rows.push(`pinch dist: ${m.pinchDist.toFixed(2)} (thr ${CONFIG.hands.pinchThreshold.toFixed(2)}) ${m.pinchDist < CONFIG.hands.pinchThreshold ? '● PINCH' : ''}`);
      rows.push(`pinch progress: ${(m.pinchProgress * 100 | 0)}%`);
      rows.push(`curled: ${m.curlCount}/4  ${m.fist ? '● FIST' : ''} ${m.open ? '○ open' : ''}`);
    } else if (src !== 'pointer') {
      rows.push('no hand detected — hold your hand up to the webcam');
    }
    el.textContent = rows.join('\n');
  }
}
