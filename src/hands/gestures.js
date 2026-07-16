// ============================================================
// Gesture recognition from 21 MediaPipe landmarks.
// All distances normalised by the hand's own span => distance-invariant.
// ============================================================
import { CONFIG } from '../config.js';
import { clamp, invLerp } from '../util/oneEuro.js';

// Landmark indices
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_TIP: 12,
  RING_PIP: 14, RING_TIP: 16,
  PINKY_PIP: 18, PINKY_TIP: 20,
};

// 3D metric distance (for worldLandmarks) — rotation & scale invariant.
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
// aspect-corrected 2D distance (image landmarks are anisotropic: x is over
// width, y over height — so we un-stretch x before measuring).
const dist2a = (a, b, aspect) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

// Classify one hand into gesture metrics.
//   lm    : image-space landmarks [0..1] (used for the on-screen cursor)
//   wlm   : worldLandmarks (metric 3D) — preferred for gesture math because
//           the ratio is invariant to how far the hand is from the camera
//           AND to the hand's orientation. Falls back to aspect-corrected 2D.
//   aspect: image width/height, only used by the 2D fallback.
export function classify(lm, wlm = null, aspect = 1) {
  const g = (wlm && wlm.length === lm.length) ? wlm : lm;
  const use3 = g === wlm;
  const D = use3 ? dist3 : (a, b) => dist2a(a, b, aspect);

  // reference length = the hand's own span (wrist -> middle-finger knuckle)
  const span = D(g[LM.WRIST], g[LM.MIDDLE_MCP]) || 1e-3;

  // --- finger curl: tip closer to wrist than its PIP joint --- (compute first)
  const curled = (tip, pip) => D(g[tip], g[LM.WRIST]) < D(g[pip], g[LM.WRIST]);
  const idxCurl = curled(LM.INDEX_TIP, LM.INDEX_PIP);
  const midCurl = curled(LM.MIDDLE_TIP, LM.MIDDLE_PIP);
  const ringCurl = curled(LM.RING_TIP, LM.RING_PIP);
  const pinkyCurl = curled(LM.PINKY_TIP, LM.PINKY_PIP);
  const curlCount = idxCurl + midCurl + ringCurl + pinkyCurl;

  // fist = enough fingers curled AND middle curled (so a pinch, which keeps
  // ring/pinky extended, is never misread as a fist).
  const fist = curlCount >= CONFIG.hands.fistCurlCount && midCurl;
  // open hand (idle / orbit / undo-swipe) = most fingers extended
  const open = curlCount <= 1;

  // --- pinch: |thumbTip - indexTip| / span  (dimensionless, scale-free) ---
  // CRITICAL: a closed fist also has thumb & index close together, so a pinch
  // is only a pinch when it is NOT a fist. Otherwise every delete-fist would
  // register as a place. This is the #1 false-positive fix.
  const { pinchThreshold, pinchOpenRef } = CONFIG.hands;
  const pinchDist = D(g[LM.THUMB_TIP], g[LM.INDEX_TIP]) / span;
  const pinching = pinchDist < pinchThreshold && !fist;
  const pinchProgress = fist ? 0 : clamp(invLerp(pinchOpenRef, pinchThreshold, pinchDist), 0, 1);

  // cursor + wrist ALWAYS come from image space (that's what maps to pixels)
  const cursor = { x: lm[LM.INDEX_TIP].x, y: lm[LM.INDEX_TIP].y };
  const wrist = { x: lm[LM.WRIST].x, y: lm[LM.WRIST].y };

  return { span, pinchDist, pinchProgress, pinching, fist, open, curlCount, cursor, wrist };
}

// Hysteresis + debounce: a raw boolean must hold `debounceMs` before it
// becomes active; `down`/`up` are single-frame edges. One-action-per-edge.
export class GestureLatch {
  constructor(debounceMs = CONFIG.hands.debounceMs) {
    this.debounceMs = debounceMs;
    this.active = false;
    this._candidateSince = null;
  }
  update(raw, tMs) {
    let down = false, up = false;
    if (raw) {
      if (!this.active) {
        if (this._candidateSince === null) this._candidateSince = tMs;
        if (tMs - this._candidateSince >= this.debounceMs) {
          this.active = true; down = true;
        }
      }
    } else {
      this._candidateSince = null;
      if (this.active) { this.active = false; up = true; }
    }
    return { active: this.active, down, up };
  }
}
