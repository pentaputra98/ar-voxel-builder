// ============================================================
// Exhibition layer — victory snapshot compositing + a local (offline)
// leaderboard persisted in localStorage. The crowd-puller.
// ============================================================
import { CONFIG, CSSCOLOR } from '../config.js';

export class Leaderboard {
  constructor() {
    this.key = CONFIG.exhibition.leaderboardKey;
    this.max = CONFIG.exhibition.leaderboardMax;
  }

  // Each level keeps its OWN board (an L3 clear is not comparable to an L1 clear).
  _key(levelId) { return `${this.key}.L${levelId}`; }

  load(levelId) {
    try { return JSON.parse(localStorage.getItem(this._key(levelId))) || []; }
    catch { return []; }
  }

  // best (fastest) time for a level, or null
  bestForLevel(levelId) { return this.load(levelId)[0]?.timeMs ?? null; }

  // returns true if `timeMs` would place on that level's board
  qualifies(timeMs, levelId) {
    const list = this.load(levelId);
    if (list.length < this.max) return true;
    return timeMs < list[list.length - 1].timeMs;
  }

  add(entry, levelId) {
    const list = this.load(levelId);
    list.push(entry);
    list.sort((a, b) => a.timeMs - b.timeMs);
    const trimmed = list.slice(0, this.max);
    localStorage.setItem(this._key(levelId), JSON.stringify(trimmed));
    return trimmed.indexOf(entry);
  }

  // Wipe every level's board (booth reset between sessions).
  resetAll() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.key)) localStorage.removeItem(k);
    }
  }

  // Composite the mirrored webcam frame + the transparent hologram canvas
  // into a single shareable image. Returns a dataURL (JPEG).
  static snapshot(video, rendererCanvas, { width = 960 } = {}) {
    const aspect = 16 / 9;
    const w = width, h = Math.round(width / aspect);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');

    // draw mirrored webcam with cover fit
    if (video && video.videoWidth) {
      const vAsp = video.videoWidth / video.videoHeight;
      let dw = w, dh = h, dx = 0, dy = 0;
      if (vAsp > aspect) { dh = h; dw = h * vAsp; dx = (w - dw) / 2; }
      else { dw = w; dh = w / vAsp; dy = (h - dh) / 2; }
      ctx.save();
      ctx.translate(w, 0); ctx.scale(-1, 1);          // mirror
      ctx.drawImage(video, -dx - dw + w, dy, dw, dh);  // account for mirror offset
      ctx.restore();
    } else {
      ctx.fillStyle = CSSCOLOR.navy; ctx.fillRect(0, 0, w, h);
    }
    // hologram on top (renderer canvas is already the right aspect-ish)
    ctx.drawImage(rendererCanvas, 0, 0, w, h);

    // brand frame + tag
    ctx.strokeStyle = CSSCOLOR.orange; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = 'rgba(10,27,61,0.75)';
    ctx.fillRect(0, h - 46, w, 46);
    ctx.fillStyle = CSSCOLOR.white;
    ctx.font = 'bold 22px "Share Tech Mono", monospace';
    ctx.fillText('V-BLOX AR · HOLOFORGE', 18, h - 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = CSSCOLOR.blue;
    ctx.fillText('BUILT BY VECTOR', w - 18, h - 16);

    return cv.toDataURL('image/jpeg', 0.8);
  }
}

// Draw a small decorative "join" emblem. NOTE: replace with a real scannable
// QR PNG for the booth (see README) — this is a branded placeholder.
export function drawJoinEmblem(canvas, seed = CONFIG.exhibition.joinUrl) {
  const ctx = canvas.getContext('2d');
  const n = 9, s = canvas.width / n;
  ctx.fillStyle = CSSCOLOR.navy; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // deterministic pixel pattern from the URL string
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => (h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  ctx.fillStyle = CSSCOLOR.orange;
  for (let y = 0; y < n; y++) for (let x = 0; x < Math.ceil(n / 2); x++) {
    if (rnd() > 0.5) {
      ctx.fillRect(x * s, y * s, s, s);
      ctx.fillRect((n - 1 - x) * s, y * s, s, s); // mirror for a QR-ish look
    }
  }
  // finder-ish corners
  ctx.fillStyle = CSSCOLOR.blue;
  for (const [cx, cy] of [[0, 0], [n - 3, 0], [0, n - 3]]) {
    ctx.fillRect(cx * s, cy * s, s * 3, s);
    ctx.fillRect(cx * s, (cy + 2) * s, s * 3, s);
    ctx.fillRect(cx * s, cy * s, s, s * 3);
    ctx.fillRect((cx + 2) * s, cy * s, s, s * 3);
  }
}
