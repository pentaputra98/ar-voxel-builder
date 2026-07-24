---
name: mediapipe-hand-tracking
description: Engineering robust real-time hand-gesture recognition with MediaPipe Hands/Tasks in the browser — landmark math, pinch/fist detection, smoothing, dual-hand handedness, and fully-offline WASM/model bundling.
license: Internal — VECTOR club project
---

# MediaPipe Hand Tracking

Turn 21 noisy 3D landmarks per hand into stable, intentional game actions at 30–60fps on a mid-range laptop webcam.

## Which library

Use **MediaPipe Tasks Vision (`HandLandmarker`)** — the current, maintained API. It ships:
- a WASM runtime bundle (`vision_wasm_internal.js/.wasm`, `vision_wasm_nosimd_internal.*`)
- a model `.task` file (`hand_landmarker.task`, ~7–8MB)

Both must be vendored locally for offline (see offline-first-architecture). Never point `FilesetResolver` at a CDN in production booth builds.

Config for a booth:
- `runningMode: "VIDEO"`, call `detectForVideo(video, timestampMs)` each rAF.
- `numHands: 2`, `minHandDetectionConfidence: 0.5`, `minTrackingConfidence: 0.5`.
- Prefer GPU delegate; fall back to CPU if unavailable.

## Landmark model

21 landmarks, index-stable. Key ones:
- 0 wrist; 4 thumb-tip; 8 index-tip; 12 middle-tip; 16 ring-tip; 20 pinky-tip; 5/9/13/17 = finger MCP knuckles.
- Coordinates are normalized [0,1] in image space, plus a z estimate (relative depth, smaller = closer to camera). Treat z as a weak cue, not truth.

## Gesture detection recipes

Normalize distances by a scale-invariant reference — the hand's own size — so detection works near or far. Use `handSpan = dist(wrist(0), middleMCP(9))`.

- **Pinch (Add):** `dist(thumbTip(4), indexTip(8)) / handSpan < 0.28`. Expose the *ratio itself* to the reticle so the cube can morph continuously as fingers close, not just at the threshold.
- **Fist (Delete):** all four finger tips curled — each tip closer to the wrist than its PIP joint, i.e. `dist(tip, wrist) < dist(pip, wrist)` for index/middle/ring/pinky.
- **Open hand (Idle/Orbit):** fingers extended — tips farther from wrist than PIPs, and spread.
- **Swipe (Orbit):** track wrist(0) X velocity across frames while open-hand; feed delta to camera azimuth.
- **Pinch-drag zoom:** while pinched, map wrist Y delta to camera radius.

## Smoothing — the difference between toy and product

Raw landmarks jitter every frame. Apply, in order:
1. **One-Euro filter** per landmark (or per derived cursor point). Tunable: low `minCutoff` for stillness, higher `beta` for responsiveness. Far better than a fixed EMA — smooth when still, snappy when moving.
2. **Deadzone** near the reticle's current cell so it doesn't buzz between two grid cells.
3. **Confidence freeze:** on a dropped/low-confidence frame, hold last good pose; don't snap to origin.

## Dual-hand handedness

`HandLandmarker` returns a `handedness` label per detection ("Left"/"Right"). **Remember the feed is mirrored** — the label is from the model's view of the raw image, so decide your role mapping once and test it live. Bind *action* role to one handedness and *navigation* to the other, and hold the assignment stable even if one hand briefly drops out (hysteresis on identity) so roles don't swap mid-build.

## Performance

- Run detection on the same resolution you display or lower (e.g. 640×480 input is plenty); downscale before `detectForVideo` if the webcam is 1080p.
- Detection and Three.js render share the frame budget — target detection < 16ms. If it slips, drop detection to every other frame and interpolate the cursor.
- Reuse the same result buffers; avoid per-frame allocation to keep GC pauses out of the render loop.
