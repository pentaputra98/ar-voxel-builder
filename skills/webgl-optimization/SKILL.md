---
name: webgl-optimization
description: Three.js / WebGL performance for real-time AR that shares the frame budget with a webcam and a hand-tracking model — draw-call batching, instancing voxels, shader-based glow, and a stable 60fps on integrated GPUs.
license: Internal — VECTOR club project
---

# WebGL Optimization

The render loop is not alone: it competes with video decode + MediaPipe inference every frame. Budget ~8–10ms for Three.js so the whole pipeline holds 60fps (or a solid 30fps floor) on a laptop with integrated graphics.

## Instance the voxels — this is the #1 rule

A voxel structure is dozens-to-hundreds of identical cubes. Never create one `Mesh` each.

- Use a single **`InstancedMesh`** with one box geometry + one material. Set per-cube transforms via `setMatrixAt`, per-cube tint via `setColorAt`. One draw call for the entire build.
- Keep a max instance count sized to the hardest level; hide unused instances by scaling to 0 or moving off-screen, and mark `instanceMatrix.needsUpdate = true` only when the set changes.
- The ghost/preview voxel and the reticle are separate lightweight meshes, not instances.

## Materials and glow without a heavy post-stack

The "sci-fi glass" look is tempting to do with full `UnrealBloomPass`, which is expensive on integrated GPUs.

- Prefer **emissive materials + a cheap selective bloom** only if the budget allows; measure it. A good fake: emissive fresnel rim in a custom `ShaderMaterial`/`onBeforeCompile`, plus additive glow sprites at edges — near-free versus a full-res bloom pass.
- `MeshStandardMaterial` with `transparent`, moderate `roughness`, and `emissiveIntensity` gets most of the glassmorphism read. Avoid `transmission`/refraction (very costly).
- Batch transparent voxels; sort issues are minor on a lattice. Disable `depthWrite` selectively only if you see ordering artifacts.

## Lighting

- One `HemisphereLight` + one `DirectionalLight` is enough. Shadows are the expensive part.
- If you want contact shadows for depth, use a **single blurred shadow-catcher plane** or baked blob shadows under voxels — not real-time `PCFSoftShadowMap` on every cube.
- "Ambient light matching" from the booth: sample average brightness of the webcam frame (downscale to 1×1 via canvas) and drive light intensity/exposure. Cheap and convincing.

## Render loop discipline

- One `requestAnimationFrame` loop drives: video draw → hand detect (possibly every other frame) → update sim → render. Never nest rAFs.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` — capping DPR is the single biggest perf lever on hi-dpi laptops.
- Camera moves use lerp/damping toward a target, computed once per frame — cinematic *and* cheap.
- Particle systems: cap counts, use `Points` or instanced quads with a lifetime in the shader, pool and recycle. A shatter effect is ~100–300 particles, not thousands.
- Preallocate; zero per-frame `new` in the hot path (vectors, matrices, colors reused).

## Budget checklist (target per frame @60fps = 16.6ms)

- Video blit: ~1ms
- Hand inference: ~6–10ms (the big one — halve its rate if needed)
- Scene update + render: ~4–8ms
- If dropping frames: cap DPR → drop detection cadence → simplify bloom → reduce particle counts, in that order.

## Instrumentation

- Ship a hidden FPS/ms overlay (toggle key) for booth setup day.
- Watch draw calls (`renderer.info.render.calls`) — for the whole game it should stay in the low single/double digits thanks to instancing.
