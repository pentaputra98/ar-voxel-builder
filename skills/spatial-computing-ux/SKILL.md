---
name: spatial-computing-ux
description: UX patterns for markerless webcam AR — camera-feed aspect handling, depth perception on a 2D screen, smart reticles, gesture state machines, and first-time-user legibility at an exhibition booth.
license: Internal — VECTOR club project
---

# Spatial Computing UX

Design AR interaction for people who have never done it before, standing at a noisy booth, with one shot to feel like magic. The screen is 2D and the input is a blurry webcam; every UX decision fights those two facts.

## The camera feed is the ground truth — never distort it

Webcam native aspect (usually 4:3 or 16:9) rarely matches the display. Solve stretch explicitly:

- Render the video to a full-bleed layer using **`object-fit: cover`** semantics: scale to fill, crop the overflow, never squish. A stretched face is the fastest way to break immersion.
- The Three.js scene camera must share the **same** effective FOV/aspect as the *cropped* video, or virtual voxels will slide off real-world anchors. Compute `scene.aspect = displayW/displayH` and derive the video crop rectangle from the same ratio.
- Mirror the feed horizontally (`scaleX(-1)`) so it behaves like a mirror — users expect their right hand to appear on the right. **Mirror the hand-landmark X coordinates to match**, or the cursor will feel inverted.
- Letterbox is acceptable only as a deliberate cinematic frame; default to cover.

## Depth on a flat screen is the core problem

Users cannot judge Z from a 2D image. Give redundant depth cues:

- **Grounding shadow / laser drop-line:** a vertical line from the cursor to the floor grid, plus a soft contact shadow. This single cue does more for placement accuracy than anything else.
- **Size + parallax:** voxels nearer the camera are larger and move faster on orbit. Keep the build grid at a fixed comfortable radius so scale stays a reliable cue.
- **Fog / depth fade:** subtle exponential fog so far cells desaturate — reads as distance instantly.
- **Snap to a discrete lattice.** Continuous free placement is impossible to aim with a webcam. Quantize to grid cells; the reticle jumps cell-to-cell, removing sub-pixel aiming.

## The Smart Reticle is the whole cursor language

One element must communicate: where am I, what will happen, is it valid. Encode state in shape + color, not text:

| State | Shape | Color |
|-------|-------|-------|
| Idle / hovering | small ring or dot | white / light-blue |
| Pinch anticipated (fingers closing) | morphs toward wireframe cube, fills in | light-blue → orange |
| Valid placement | solid ghost voxel snapped to cell | orange glow |
| Invalid (mid-air / occupied) | broken ring, shake | red |
| Delete target | outlined existing voxel, pulsing | red |

Animate transitions with damping — a reticle that teleports feels broken; one that eases feels alive.

## Gesture state machine, not gesture soup

Raw landmark thresholds jitter. Wrap them in a state machine with hysteresis:

- **Debounce every transition** (e.g. pinch must hold ~80–120ms before firing). Prevents flicker-placement.
- **Separate hands by role** so gestures never collide: one hand acts (add/delete), one navigates (orbit/zoom). Assign by handedness from the tracker, not by screen position.
- **One action per gesture edge.** Fire on the *transition into* a state, then lock until the hand releases — otherwise a held pinch spawns a tower of voxels.
- Confidence gating: if landmark confidence drops, freeze the reticle in place rather than letting it fly to a garbage position.

## Booth legibility

- Assume the viewer is 0.5–1.5m from the screen and there is glare. Minimum HUD text ~18px, high contrast, heavy weight.
- Keep interactive UI out of the center — that's the AR stage. Push chrome to corners as frosted panels.
- Everything must be readable and operable while standing, one-handed, with no instructions read aloud. If a first-timer needs a sentence explained, redesign it.
- Auto-reset to attract-mode after idle so the next person starts clean.

## Onboarding: show, don't tell

- Hand-alignment calibration ("put your hands in the glowing outlines") doubles as distance calibration — it forces the user to the optimal camera range before gameplay.
- Animated ghost-hand demonstrations loop silently; never a wall of text.
- Detect struggle (cursor hovering, no action for N seconds) and surface a looping gesture hint contextually.
