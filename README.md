# V-Blox AR — HoloForge Edition

A markerless webcam-AR voxel builder for the **VECTOR** club exhibition booth.
Point, pinch, and build glowing structures out of light to match a blueprint
before the clock runs out. Built with **Three.js** + **MediaPipe Hand
Landmarker**, no build step, no framework.

> _"Forge structures out of light with your bare hands."_

---

## Run it (30 seconds)

The game needs to be served over **http/https** (webcam + ES modules don't work
from `file://`). Any static server works — pick one:

```bash
# Python (already on most machines)
python -m http.server 8000

# or Node
npx serve .

# or VS Code: "Live Server" extension → Open with Live Server
```

Then open **http://localhost:8000** in **Chrome or Edge** (Chromium gives the
best MediaPipe performance) and allow camera access.

No webcam? It still runs — the game auto-falls back to **mouse mode**.

---

## Controls

The screen always shows a **cheat sheet** (left) with the gesture icons, and a
label pinned to the reticle tells you what the game is about to do — **READY**
as your pinch closes, **DELETE MODE** when a fist is up, **NO SPACE** on an
invalid cell.

Depth uses an **Active-Lattice** model: the cursor is always locked to one
discrete build layer — no aiming at tiny voxel faces. You shift layers by
raising/lowering your hand, with a tick + a glowing layer-plane that slides.

Pinch/fist detection runs on MediaPipe **worldLandmarks** (metric 3D), so the
`|thumb–index| / hand-span` ratio recognises a pinch identically whether your
hand is 10 cm or 1 m from the camera — and a closed fist is never mistaken for
a pinch (it deletes, never places).

**Hand mode (webcam):**
| Gesture | Action |
|---|---|
| ☝️ Point (index finger) | Move the smart reticle / aim within the active layer |
| ☝️ **Point & HOLD** on a cell | **Place a voxel** — hold ~0.8s, a ring fills, then it drops (primary, foolproof) |
| 🤏 Pinch (thumb + index) | Optional instant-place accelerator |
| ✊ Fist (near a block) | Shatter the **nearest** voxel — forgiving, no precise aim |
| 🖐️ Open hand, swipe **left** | **Undo** the last placed block |
| ✋ Other hand (Level 3) | Raise/lower = change active layer (camera auto-orbits) |

**Point-and-Dwell** is the primary placement: hold the reticle still on a valid
cell and a radial ring fills; at 100% the block places with full juice, then a
short cooldown prevents accidental stacking. Move to another cell and the ring
resets instantly. The camera **freezes while you're dwelling** so the target
can't drift out from under a steady hand. Tune the hold time live with `T` →
**Dwell place time (ms)**.

On Level 2, raising your hand higher moves the cursor to a higher layer
(Z is fixed to the pyramid's slice, so height is a clean 1-axis choice).

**Undo** has three redundant triggers so it never fails a first-timer:
open-hand swipe-left · **dwell** the cursor on the on-screen `⟲ UNDO` button
(~0.5s) or click it · the `Z` key.

**Mouse mode / debug:**
| Input | Action |
|---|---|
| Move mouse | Aim |
| Left click | Place |
| Right click | Delete nearest voxel |
| **Wheel** | Change active layer (Level 3) |
| Hold **Shift** + move | Orbit |
| `Z` / Backspace / click ⟲ | Undo |

**Keys:** `T` **live tuning** · `D` diagnostics (fps / draw calls) ·
`M` toggle mouse mode · `H` swap which hand builds · `Z` undo ·
`R` restart level · `F` fullscreen.

### Live tuning mode (`T`) — dial in the feel on real hardware

Press `T` during play to open the tuning panel. Sliders write straight into
the running game, and a webcam overlay shows you what the tracker sees:

- **Sliders:** pinch threshold, fist curl count, gesture debounce, **undo swipe
  speed**, **delete radius**, dwell-undo time, and L3 auto-orbit speed.
- **Overlay:** your hand skeleton drawn over the feed, the red **delete-radius
  ring** around the cursor (with a box on the exact voxel a fist would shatter),
  and a **swipe-velocity meter** with the undo threshold marked — so you can see
  the precise moment a swipe-left would trigger Undo.
- **Readout:** live pinch distance vs. threshold, curl count, and active layer.

Tune until it feels right, then copy the values into
[`src/config.js`](src/config.js) (`hands` and `controls` blocks) to make them
the booth defaults.

---

## How it plays

Three escalating time-attack levels:

1. **LINE** — a single-layer line on the floor. Teaches point + pinch.
   Camera auto-drifts.
2. **PYRAMID** — a vertical slice (5→3→1). Raise your hand to reach higher
   layers; teaches the Active-Lattice depth control.
3. **THE CORE** — a true 3D vault with hidden back cells. The camera
   **auto-orbits** (slow cinematic spin) so hidden faces come around on their
   own; the second hand does ONE thing — raise/lower to change the active layer.

The **blue ghost** shows what to build; placed blocks glow **orange** when
correct and **red** when wrong. Fill the ghost exactly to clear the level, then
strike a pose for the snapshot and land on the local leaderboard.

---

## Configuration

All tuning lives in [`src/config.js`](src/config.js): the VECTOR palette, grid
size, timers, gesture thresholds, FX intensity, and:

- `exhibition.joinUrl` — **set this to your club sign-up URL** (shown on the
  results screen; also swap the placeholder emblem for a real QR — see below).
- `hands.dominantHandedness` — which hand builds vs navigates (or press `H`
  live if it feels inverted; the feed is mirrored).
- `debug.startInPointerMode` / `debug.showDiag` — booth-setup helpers.

---

## Offline booth build (recommended for the fair)

By default the code loads Three.js and MediaPipe from CDN (see the import map in
[`index.html`](index.html) and `hands.wasmPath` / `hands.modelPath` in
`src/config.js`). Venue Wi-Fi is unreliable — **vendor the dependencies** so the
booth needs no network:

1. Download into `./vendor/`:
   - `three.module.js` (v0.160.0)
   - `@mediapipe/tasks-vision@0.10.14` (the `wasm/` folder + `vision_bundle.mjs`)
   - `hand_landmarker.task` model
2. Repoint the import map in `index.html` to `./vendor/...`.
3. Set `CONFIG.hands.wasmPath` and `CONFIG.hands.modelPath` to the local paths.

A real **QR code**: generate a PNG for `joinUrl` and drop it into the results
screen (replace the `drawJoinEmblem` placeholder in
[`src/exhibition/leaderboard.js`](src/exhibition/leaderboard.js)). The current
emblem is decorative and does **not** scan.

---

## Architecture

One `requestAnimationFrame` loop: **input → game update → render**. Both the
hand tracker and the mouse fallback emit the *same* `InputState`, so the game
never cares which is live.

```
src/
  main.js               bootstrap + main loop + keyboard
  config.js             palette & all tuning
  ar/camera.js          webcam, object-fit:cover mapping, ambient sampling
  hands/
    tracker.js          MediaPipe HandLandmarker → InputState
    gestures.js         pinch/fist/open classification + debounce latch
  input/pointer.js      mouse/keyboard fallback (same InputState)
  scene/
    world.js            renderer, orbit camera, lights, fog, holo-table
    voxels.js           instanced voxels, face/floor targeting, validation
    reticle.js          the smart reticle + laser drop-line + contact shadow
  fx/
    audio.js            procedural WebAudio synth (no audio files)
    particles.js        pooled sparks / shatter / confetti
    screen.js           trauma shake, hit-stop, slow-mo, flashes
  game/
    levels.js           the three blueprints
    game.js             state machine (attract→calibrate→play→clear→results)
  ui/
    hud.js              corner panels + full-screen overlays
    vex.js              VEX the pixel-robot mascot
  exhibition/
    leaderboard.js      snapshot compositing + localStorage leaderboard
```

Design and domain expertise are documented in [`skills/`](skills/) —
`mediapipe-hand-tracking`, `spatial-computing-ux`, `webgl-optimization`,
`game-juice-fx`, and `vector-brand-exhibition`.

---

## Performance notes

- All voxels share **one `InstancedMesh`** → the whole build is ~a handful of
  draw calls (check with `D`).
- `devicePixelRatio` capped at 2; glow is faked with emissive materials (no
  heavy bloom pass); particles are pooled.
- Hand inference is the biggest cost; it runs once per new video frame and holds
  the last good pose on dropped frames.

Made with 💙🧡 for **VECTOR** — Vidatra Engineering Coding Technology of Robotics.
