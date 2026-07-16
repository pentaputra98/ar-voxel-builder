// ============================================================
// V-Blox AR · HoloForge Edition — bootstrap & main loop.
// One requestAnimationFrame drives: input -> game update -> render.
// Falls back gracefully to mouse mode if webcam / model are unavailable.
// ============================================================
import { CONFIG } from './config.js';
import { ARCamera } from './ar/camera.js';
import { HandTracker } from './hands/tracker.js';
import { PointerInput } from './input/pointer.js';
import { World } from './scene/world.js';
import { VoxelField } from './scene/voxels.js';
import { SmartReticle } from './scene/reticle.js';
import { Particles } from './fx/particles.js';
import { AudioEngine } from './fx/audio.js';
import { ScreenFX } from './fx/screen.js';
import { HUD } from './ui/hud.js';
import { Vex } from './ui/vex.js';
import { Leaderboard } from './exhibition/leaderboard.js';
import { TuningPanel } from './ui/tuning.js';
import { Game } from './game/game.js';

async function boot() {
  // --- core singletons ---
  const canvas = document.getElementById('scene');
  const video = document.getElementById('webcam');
  const overlaysEl = document.getElementById('overlays');

  const ar = new ARCamera(video);
  const world = new World(canvas);
  const field = new VoxelField(world.scene);
  const reticle = new SmartReticle(world.scene, field);
  const particles = new Particles(world.scene);
  const audio = new AudioEngine();
  const screen = new ScreenFX();
  const hud = new HUD();
  const vex = new Vex(document.getElementById('vex-canvas'), document.getElementById('vex-bubble'));
  const leaderboard = new Leaderboard();
  const pointer = new PointerInput();
  pointer.attach();

  const tracker = new HandTracker(ar);
  const tuning = new TuningPanel({ tracker, ar, field, world });

  const game = new Game({ world, field, reticle, particles, audio, screen, hud, vex, ar, leaderboard });

  // --- async: bring up camera + hand model without blocking the menu ---
  let manualPointer = CONFIG.debug.startInPointerMode;
  (async () => {
    const camOk = await ar.start();
    if (camOk) {
      await tracker.init();
      // refresh the start overlay now that we know camera state
      if (game.state === 'attract') game.enterAttract();
    } else {
      manualPointer = true;
      console.warn('[HoloForge]', ar.error, '→ mouse mode');
      if (game.state === 'attract') game.enterAttract();
    }
  })();

  // --- keyboard controls ---
  let showDiag = CONFIG.debug.showDiag;
  hud.showDiag(showDiag);
  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'd': showDiag = !showDiag; hud.showDiag(showDiag); document.body.classList.toggle('show-cursor', showDiag); break;
      case 'm': manualPointer = !manualPointer; vex.say(manualPointer ? 'Mouse mode' : 'Hand mode'); break;
      case 'h': tracker.swapHands(); vex.say('Swapped hands'); break;
      case 't': tuning.toggle(); break;
      case 'z': game.undo(); break;
      case 'r': game.restartLevel(); break;
      case 'f': if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); break;
    }
  });

  // --- main loop ---
  let last = performance.now();
  let fpsT = 0, fpsN = 0, fps = 0;

  function frame(now) {
    const rawDt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const tSec = now / 1000;

    // choose input source (hands when available, else pointer)
    const usePointer = manualPointer || game.pointerForced || !tracker.ready || !ar.ready;
    const input = usePointer ? pointer.update(now) : tracker.update(now);
    // show the OS cursor whenever a full-screen overlay is up (welcome / results /
    // calibrate) or we're in mouse mode — so visitors can see what to click.
    const overlayOpen = overlaysEl.children.length > 0;
    document.body.classList.toggle('show-cursor', overlayOpen || usePointer);

    // time controls: hit-stop freezes, slow-mo scales
    const dt = screen.isFrozen() ? 0 : rawDt * screen.timeScale;
    game.update(dt, input, tSec);
    world.render();
    tuning.update(input);

    // diagnostics
    fpsN++; fpsT += rawDt;
    if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    if (showDiag) {
      const calls = world.renderer.info.render.calls;
      hud.diag(
        `${fps} fps · ${calls} draw calls · ${input.source}${usePointer ? ' (fallback)' : ''}\n` +
        `state:${game.state} · voxels:${field.cells.length}/${field.targetSet.size} · ` +
        `hands:${tracker.ready ? 'ok' : (tracker.error ? 'err' : '…')} cam:${ar.ready ? 'ok' : 'no'}`);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // expose for console debugging
  window.HOLOFORGE = { game, world, field, tracker, ar, tuning };
}

boot().catch((e) => {
  console.error('[HoloForge] fatal', e);
  const o = document.getElementById('overlays');
  if (o) o.innerHTML =
    `<div class="overlay"><h1>Boot Error</h1><p>${e?.message || e}</p>` +
    `<p class="sub">Serve this folder over http (see README) and use a Chromium browser.</p></div>`;
});
