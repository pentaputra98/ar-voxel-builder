---
name: vector-brand-exhibition
description: The VECTOR club visual identity (light-blue / navy / orange / white, pixel-robot motif) and the exhibition crowd-puller loop — attract mode, snapshot, local leaderboard, and 60-second turn design that keeps a booth line moving and converts spectators into members.
license: Internal — VECTOR club project
---

# VECTOR Brand & Exhibition

The game is a recruiting tool first, a tech demo second. Every visual and loop decision serves one metric: a stranger walks up, plays once, and wants to join VECTOR (Vidatra Engineering Coding Technology of Robotics).

## Palette — locked

Use these four as the whole system. Do not introduce new hues; depth comes from value/opacity, not more colors.

| Role | Color | Hex | Use |
|------|-------|-----|-----|
| Base / stage | Navy | `#0A1B3D` | HUD panels, deep background, fog color |
| Primary UI | Light Blue | `#38BDF8` | reticle idle, grid lines, text accents, calm states |
| Action / energy | Orange | `#FF7A1A` | placement glow, CTA, timer urgency, "join us" |
| Neutral | White | `#F5F9FF` | primary text, high-contrast HUD, victory flash |

Semantics: **light-blue = calm/valid/idle**, **orange = action/success/energy**, **red (reserved, `#FF3B3B`) = invalid/delete only**. Never use orange and red near each other — they must stay distinct at a glance for a first-timer.

## Pixel-robot motif — subtle, not childish

The identity is "friendly retro-future robotics," not a kids' game.

- A small pixel-robot mascot ("VEX") lives in a corner as a reactive guide — idles, blinks, reacts to placements (thumbs up on clear), demonstrates gestures in onboarding. Animated as a tiny sprite-sheet, chunky-pixel style, 2–3 palette colors only.
- Pixel accents used sparingly: 1px stepped corners on some panels, a dithered edge, a scanline shimmer on the logo. The 3D voxel grid itself is the main "blocky" expression — don't over-pixelate the chrome too or it reads cheap.
- Typography: a clean geometric sans for legibility (HUD, timer) paired with one pixel/mono display face for the logo and big moments ("LEVEL CLEARED"). Legibility wins every conflict — booth glare is real.

## The 60-second turn — respect the line

A booth has a queue. The whole loop is engineered so one person's turn is ~45–90s and the next can start instantly.

1. **Attract mode** (no one playing): looping hero reel — a ghost robot hand auto-building a structure, VECTOR logo, "STEP IN TO PLAY," high score. Motion draws the eye from down the hall.
2. **Calibrate** (hands in outlines) = distance calibration, ~3s.
3. **Play** one time-attack level, 60s cap.
4. **Climax + snapshot** on clear.
5. **Auto-reset** to attract mode after ~8s idle so an abandoned session never blocks the booth.

## Crowd-puller mechanics

- **Victory-pose snapshot:** on a fast clear, 3-2-1 countdown, capture webcam + virtual build composited together. This is the shareable artifact and the reason to gather friends.
- **Local leaderboard:** name (3-initials, arcade style) + clear time + snapshot thumbnail, pushed to a second monitor facing the hallway. Competition among classmates is the strongest replay driver. Persist locally (offline-first) — no network needed.
- **The conversion beat:** the clear screen and the leaderboard both carry a quiet, always-present "Built by VECTOR — scan to join" with a QR. The ask rides on the moment of delight, never a nag mid-game.
- **Escalation:** the difficulty curve (line → pyramid → orbit-required 3D) is a spectacle for onlookers too — watching someone orbit a webcam-AR structure is itself the advertisement.

## Non-negotiables

- Center screen is the AR stage; brand chrome lives in corners as frosted navy-glass panels.
- Readable while standing 0.5–1.5m away, one glance, no narration.
- The single loudest, most saturated moment in the whole session is the level-clear — brand energy peaks there, on purpose.
