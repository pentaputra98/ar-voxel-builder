// ============================================================
// HandTracker — MediaPipe HandLandmarker wrapper.
// Produces a normalised InputState identical in shape to the pointer
// fallback, so the game loop never cares which input source is live.
//
// InputState = {
//   source, present, cursor:{x,y}|null, pinchProgress,
//   pinch:{active,down,up}, fist:{active,down,up},
//   orbit:{active, value}   // value: 0..1 azimuth control from 2nd hand
// }
// ============================================================
import { CONFIG } from '../config.js';
import { OneEuroVec, OneEuro } from '../util/oneEuro.js';
import { classify, GestureLatch } from './gestures.js';

export class HandTracker {
  constructor(arCamera) {
    this.ar = arCamera;
    this.landmarker = null;
    this.ready = false;
    this.error = null;
    this.lastVideoTime = -1;

    // smoothing for the dominant hand's cursor + pinch, and orbit hand
    this._cursorFilter = new OneEuroVec(2, CONFIG.hands.oneEuro);
    this._pinchFilter = new OneEuro({ minCutoff: 2.0, beta: 0.02 });
    this._orbitFilter = new OneEuro({ minCutoff: 1.0, beta: 0.02 });

    this._pinchLatch = new GestureLatch();
    this._fistLatch = new GestureLatch();

    // hold last good state on dropped frames (confidence freeze)
    this._lastCursor = null;
    this._present = false;
    this._dominant = CONFIG.hands.dominantHandedness;

    // undo-swipe tracking (dominant hand, open palm, quick left motion)
    this._prevSx = null;
    this._prevSt = 0;
    this._undoCooldownUntil = 0;

    // live diagnostics for the tuning overlay
    this.debug = { landmarks: [], handed: [], domIndex: -1, navIndex: -1, metrics: null, swipeVx: 0 };

    this._state = blankState('hands');
  }

  async init() {
    try {
      const vision = await import('tasks-vision');
      const { HandLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(CONFIG.hands.wasmPath);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: CONFIG.hands.modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: CONFIG.hands.numHands,
        minHandDetectionConfidence: CONFIG.hands.minDetectionConfidence,
        minTrackingConfidence: CONFIG.hands.minTrackingConfidence,
      });
      this.ready = true;
      return true;
    } catch (e) {
      this.error = `Hand model load failed: ${e?.message || e}`;
      return false;
    }
  }

  swapHands() {
    this._dominant = this._dominant === 'Right' ? 'Left' : 'Right';
  }

  // Run detection for this frame and return the InputState.
  update(tMs) {
    if (!this.ready || !this.ar.ready) return this._state;
    const video = this.ar.video;
    if (video.currentTime === this.lastVideoTime) return this._state; // no new frame
    this.lastVideoTime = video.currentTime;

    let result;
    try {
      result = this.landmarker.detectForVideo(video, tMs);
    } catch {
      return this._state; // keep last good state
    }

    const hands = result?.landmarks || [];
    const worldHands = result?.worldLandmarks || [];
    const handed = result?.handedness || [];
    const aspect = this.ar.vw / this.ar.vh;
    if (hands.length === 0) {
      this._present = false;
      this._prevSx = null;   // avoid a velocity spike when the hand returns
      this.debug = { landmarks: [], handed: [], domIndex: -1, navIndex: -1, metrics: null, swipeVx: 0 };
      this._state = { ...blankState('hands'), cursor: this._lastCursor };
      // release any held gestures cleanly
      this._pinchLatch.update(false, tMs);
      this._fistLatch.update(false, tMs);
      return this._state;
    }

    // --- assign roles by handedness (mirror-aware, with single-hand fallback) ---
    let domIdx = -1, navIdx = -1;
    for (let i = 0; i < hands.length; i++) {
      const label = handed[i]?.[0]?.categoryName || 'Right';
      if (label === this._dominant && domIdx === -1) domIdx = i;
      else navIdx = i;
    }
    if (domIdx === -1) domIdx = 0;          // only the "wrong" hand present -> use it to act
    if (navIdx === domIdx) navIdx = -1;

    const t = tMs / 1000;

    // --- dominant hand: cursor + pinch + fist (world-space gesture math) ---
    const dom = classify(hands[domIdx], worldHands[domIdx], aspect);
    const rawScreen = this.ar.normalizedToScreen(dom.cursor.x, dom.cursor.y);
    const [sx, sy] = this._cursorFilter.filter([rawScreen.x, rawScreen.y], t);
    this._lastCursor = { x: sx, y: sy };
    this._present = true;

    const pinchProgress = this._pinchFilter.filter(dom.pinchProgress, t);
    const pinch = this._pinchLatch.update(dom.pinching, tMs);
    // fist suppressed while pinching so the two never collide
    const fist = this._fistLatch.update(dom.fist && !dom.pinching, tMs);

    // --- undo: open dominant hand swiped quickly to the left ---
    let undoDown = false;
    let swipeVx = 0;
    if (this._prevSx !== null) {
      const dtS = Math.max(1e-3, t - this._prevSt);
      swipeVx = (sx - this._prevSx) / dtS;   // px/s in screen space
      if (dom.open && swipeVx < -CONFIG.controls.undoSwipeVel && tMs > this._undoCooldownUntil) {
        undoDown = true;
        this._undoCooldownUntil = tMs + CONFIG.controls.undoCooldownMs;
      }
    }
    this._prevSx = sx; this._prevSt = t;

    // --- navigation hand: orbit (horizontal) + layer (vertical raise) ---
    let orbit = { active: false, value: null };
    let navHeight = null;
    if (navIdx !== -1) {
      const nav = classify(hands[navIdx], worldHands[navIdx], aspect);
      orbit = { active: true, value: this._orbitFilter.filter(1 - nav.wrist.x, t) };
      navHeight = clampUnit(1 - nav.wrist.y);   // 1 = hand raised high
    }

    this.debug = {
      landmarks: hands, handed, domIndex: domIdx, navIndex: navIdx,
      metrics: { pinchDist: dom.pinchDist, pinchProgress, fist: dom.fist, open: dom.open, curlCount: dom.curlCount },
      swipeVx,
    };

    this._state = {
      source: 'hands',
      present: true,
      cursor: { x: sx, y: sy },
      pinchProgress,
      pinch, fist, orbit,
      navHeight,
      undo: { down: undoDown },
    };
    return this._state;
  }

  get state() { return this._state; }
}

const clampUnit = (v) => Math.min(1, Math.max(0, v));

function blankState(source) {
  return {
    source,
    present: false,
    cursor: null,
    pinchProgress: 0,
    pinch: { active: false, down: false, up: false },
    fist: { active: false, down: false, up: false },
    orbit: { active: false, value: null },
    navHeight: null,
    undo: { down: false },
  };
}
