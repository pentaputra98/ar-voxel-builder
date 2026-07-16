// ============================================================
// Central configuration & tuning. One place to tweak the whole game.
// ============================================================

export const CONFIG = {
  // ---- VECTOR brand palette (locked) ----
  color: {
    navy:   0x0a1b3d,
    navy2:  0x0d2350,
    blue:   0x38bdf8,
    orange: 0xff7a1a,
    white:  0xf5f9ff,
    red:    0xff3b3b,
  },

  // ---- Build grid / world ----
  grid: {
    size: 7,        // NxN floor cells (odd => centred cell)
    height: 6,      // max stacking layers
    cell: 1,        // world units per voxel (cube is 1x1x1)
  },

  // ---- Camera (orbits a fixed-radius sphere so scale stays a reliable cue) ----
  camera: {
    fov: 52,
    radius: 11.5,
    minRadius: 8,
    maxRadius: 15,
    phi: 1.02,               // polar angle (from +Y), ~58deg down-ish
    autoOrbitSpeed: 0.10,    // rad/s cinematic drift (levels 1-2)
    damping: 6.0,            // higher = snappier follow
  },

  // ---- Hand tracking / gestures ----
  hands: {
    // MediaPipe endpoints — repoint to ./vendor/... for the offline booth build.
    wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    modelPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    numHands: 2,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    dominantHandedness: 'Right', // which label acts (add/delete); other navigates
    // gesture thresholds — ratio of |thumb-index| to hand span, measured in
    // metric worldLandmark space (scale- & rotation-invariant). Pinched ~0.3,
    // open ~1.1, so the threshold sits in the valley between them.
    pinchThreshold: 0.45,   // ratio below this = pinched
    pinchOpenRef: 1.10,     // ratio treated as "fully open" for reticle morph
    fistCurlCount: 3,       // >= this many curled fingers = fist
    debounceMs: 90,         // a gesture must hold this long before it fires
    // One-Euro filter (per landmark / cursor)
    oneEuro: { minCutoff: 1.4, beta: 0.03, dCutoff: 1.0 },
  },

  // ---- Build controls (Active-Lattice depth + forgiving delete/undo) ----
  controls: {
    // forgiving delete: a fist shatters the nearest voxel within this screen
    // radius (fraction of the viewport diagonal) — no pixel-perfect aim needed.
    deleteRadiusFrac: 0.30,
    // undo via open-hand swipe-left: required leftward cursor speed (px/s)
    undoSwipeVel: 850,
    undoCooldownMs: 700,
    // POINT-AND-DWELL placement: hold the reticle on a valid cell this long to
    // auto-place (foolproof — no pinch needed). Then a short cooldown so a
    // steady hand doesn't instantly stack a pillar of blocks.
    dwellPlaceMs: 800,
    dwellPlaceCooldownMs: 320,
    // dwell-to-undo: hover the cursor over the UNDO button this long to fire
    dwellUndoMs: 550,
    // L3 layer selection from the nav-hand height: hysteresis margin (0..0.5)
    // of a layer band, to stop the active layer flickering between two levels.
    layerHysteresis: 0.28,
  },

  // ---- Timing ----
  game: {
    turnSeconds: 60,
    urgentAt: 10,           // timer turns orange/pulses below this
    idleResetMs: 22000,     // no player => back to attract mode
    clearHoldMs: 2600,      // linger on the clear celebration
  },

  // ---- FX ----
  fx: {
    sparkCount: 26,
    shatterShards: 14,
    confettiCount: 220,
    maxParticles: 600,
    shakeDecay: 1.8,
    audioMasterGain: 0.5,
  },

  // ---- Exhibition ----
  exhibition: {
    joinUrl: 'https://s.id/vector26',   // <- put the club sign-up URL here
    leaderboardKey: 'vblox.leaderboard.v1',
    leaderboardMax: 8,
  },

  // ---- Debug ----
  debug: {
    startInPointerMode: false,   // force mouse/keyboard control (no webcam)
    showDiag: false,
  },
};

// Convenience: THREE-ready hex strings for DOM use.
export const CSSCOLOR = {
  navy: '#0A1B3D', blue: '#38BDF8', orange: '#FF7A1A', white: '#F5F9FF', red: '#FF3B3B',
};
