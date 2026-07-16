// ============================================================
// ARCamera — owns the webcam <video>, the mirrored full-bleed feed,
// the object-fit:cover coordinate mapping, and ambient light sampling.
// ============================================================
import { CONFIG } from '../config.js';

export class ARCamera {
  constructor(videoEl) {
    this.video = videoEl;
    this.ready = false;
    this.error = null;
    // tiny offscreen canvas for ambient brightness sampling
    this._sample = document.createElement('canvas');
    this._sample.width = 1; this._sample.height = 1;
    this._sctx = this._sample.getContext('2d', { willReadFrequently: true });
    this._ambient = 1.0;
    this._frame = 0;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = 'getUserMedia unavailable (needs https or localhost).';
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      this.video.srcObject = stream;
      await this.video.play();
      await new Promise((res) => {
        if (this.video.readyState >= 2) return res();
        this.video.onloadeddata = () => res();
      });
      this.ready = true;
      return true;
    } catch (e) {
      this.error = (e && e.name) === 'NotAllowedError'
        ? 'Camera permission denied.'
        : `Camera error: ${e?.message || e}`;
      return false;
    }
  }

  get vw() { return this.video.videoWidth || 1280; }
  get vh() { return this.video.videoHeight || 720; }

  // Map a MediaPipe normalised point (raw image space, [0,1]) to on-screen
  // pixels, accounting for (a) horizontal mirror and (b) object-fit: cover crop.
  // Returns { x, y } in CSS pixels of the current viewport.
  normalizedToScreen(nx, ny) {
    const sw = window.innerWidth, sh = window.innerHeight;
    const mx = 1 - nx;                     // mirror to match the flipped feed
    const videoAspect = this.vw / this.vh;
    const screenAspect = sw / sh;
    let x, y;
    if (screenAspect > videoAspect) {
      // video scaled to fill width; top/bottom cropped
      const scale = sw / this.vw;
      const dispH = this.vh * scale;
      const cropY = (dispH - sh) / 2;
      x = mx * sw;
      y = ny * dispH - cropY;
    } else {
      // video scaled to fill height; left/right cropped
      const scale = sh / this.vh;
      const dispW = this.vw * scale;
      const cropX = (dispW - sw) / 2;
      x = mx * dispW - cropX;
      y = ny * sh;
    }
    return { x, y };
  }

  // Average webcam brightness (0..1) — drives scene light so the hologram
  // feels lit by the real room. Sampled every ~12 frames (cheap).
  sampleAmbient() {
    this._frame++;
    if (!this.ready || (this._frame % 12) !== 0) return this._ambient;
    try {
      this._sctx.drawImage(this.video, 0, 0, 1, 1);
      const [r, g, b] = this._sctx.getImageData(0, 0, 1, 1).data;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // ease toward the reading to avoid flicker
      this._ambient += (lum - this._ambient) * 0.25;
    } catch { /* video not ready yet */ }
    return this._ambient;
  }
}
