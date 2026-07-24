---
name: game-juice-fx
description: Making a web game feel AAA — particle bursts, screen shake, hit-stop, easing curves, procedural/one-shot audio, and layered feedback so every action lands with weight. The "wow" layer.
license: Internal — VECTOR club project
---

# Game Juice & FX

Juice is redundant, multi-sensory feedback on every meaningful action. The mechanics can be simple; the *feel* is what makes visitors say "wow" and want to play again. Rule: no action ever happens silently or instantly.

## Every action gets a feedback stack

Layer at least three channels per event (visual + motion + audio):

**Place voxel (pinch):**
- snap the ghost into the cell with an overshoot ease (`back.out`)
- burst of ~20 digital-spark particles at the cell, orange/light-blue
- short bright "tick/snap" sound, pitch rising slightly with build height for a musical sense of progress
- a quick expanding ring shockwave decal on the grid
- tiny screen punch (scale 1.00→1.01→1.00 over ~90ms)

**Delete voxel (fist):**
- the cube shatters into instanced fragments with fake physics (velocity + gravity, fade+shrink over ~0.8s)
- glass-break sound
- brief red flash on the target cell
- small screen shake

**Level cleared:**
- freeze-frame hit-stop (~150ms), then green screen flash
- "LEVEL CLEARED" banner drops with a bouncy ease + slight rotation settle
- confetti/voxel-burst explosion across the AR space
- rising triumphant stinger chord

## Motion: easing is everything

- Never animate linearly except constant motion (rotating blueprint). UI and feedback use eased curves: `back.out` for pops, `expo.out` for entrances, `elastic` sparingly for celebrations.
- **Damping/lerp** camera and reticle toward targets: `current += (target - current) * (1 - Math.pow(f, dt))`. Frame-rate independent, buttery.
- **Anticipation + follow-through:** things wind up slightly before firing and overshoot slightly after. This is what reads as "alive."

## Screen effects, used with restraint

- **Screen shake:** trauma-based (add trauma, decay each frame, offset = trauma² × random). Big on clears, tiny on places, medium on deletes. Overuse = nausea; scale to event weight.
- **Hit-stop / freeze-frame:** pause the sim 80–150ms on big moments — the brain reads the pause as impact.
- **Chromatic aberration / vignette pulse** on major events only.
- **Time scale:** briefly slow-mo (0.3×) into a level-clear, then snap to normal.

## Audio without asset bloat

- A **WebAudio** synth for one-shots (snaps, ticks, UI blips) keeps the bundle tiny and offline-trivial — no files to ship. Procedural blips also let pitch track game state (build height, combo).
- Keep a couple of small looping ambience/music stems (vendored locally) at low volume for atmosphere.
- **Autoplay policy:** browsers block audio until a user gesture. Unlock the AudioContext on the first tap/click of the start screen; never assume sound works before that.
- Ducking: drop music slightly under big SFX so the hit cuts through.

## Particles

- Pool everything; never allocate mid-burst.
- Sparks: additive-blended points/quads, short life, gravity + drag, fade alpha and shrink to zero.
- Shatter: reuse the voxel's color, spawn 8–16 shards, give angular velocity.
- Confetti: instanced quads, 150–300 max, gravity + flutter, cull off-screen.

## Restraint

Juice is seasoning. The clear moment should be the loudest thing in the session — if every micro-action is maxed out, nothing feels special. Build a feedback *hierarchy*: place < delete < combo < level-clear, in escalating intensity.
