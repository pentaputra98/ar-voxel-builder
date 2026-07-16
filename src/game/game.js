// ============================================================
// Game — the state machine that drives the whole experience:
//   attract -> calibrate -> countdown -> play -> clear -> results
// Consumes a normalised InputState each frame (hands OR pointer).
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { LEVELS } from './levels.js';
import { Leaderboard } from '../exhibition/leaderboard.js';

const S = { ATTRACT: 'attract', CALIBRATE: 'calibrate', COUNTDOWN: 'countdown', PLAY: 'play', CLEAR: 'clear', FAIL: 'fail', RESULTS: 'results' };
const cellKey = (c) => `${c.x},${c.y},${c.z}`;

export class Game {
  constructor(refs) {
    Object.assign(this, refs); // world, field, reticle, particles, audio, screen, hud, vex, ar, leaderboard
    this.state = S.ATTRACT;
    this.stateTime = 0;
    this.levelIndex = 0;
    this.timeLeftMs = 0;
    this.lastActionSec = 0;
    this.pointerForced = false;
    this._tmp = new THREE.Vector3();
    this._lastTarget = null;
    this._calibHold = 0;
    this._cdStep = -1;
    this._dwell = 0;              // dwell-to-undo accumulator
    this._undoCdUntil = 0;       // shared undo cooldown (all triggers)
    this._dwellT = 0;            // dwell-to-place accumulator
    this._dwellCell = null;      // cell the dwell is accumulating on
    this._dwellGrace = 0;        // jitter/dropout tolerance
    this._dwellCdUntil = 0;      // post-place cooldown
    this._dwelling = false;      // true while a dwell is in progress (freezes camera)
    this.hud.onUndo(() => this.undo());
    this.enterAttract(true);
  }

  // public undo — used by the on-screen button and the global Z key
  undo() { this._doUndo(performance.now() / 1000); }

  setState(s) { this.state = s; this.stateTime = 0; }

  get level() { return LEVELS[this.levelIndex]; }

  // Camera orbit is fully automatic. L1 drifts, L2 sways near-frontal so its
  // vertical build-slice stays aimable, L3 spins to reveal hidden back cells.
  _orbitConfig() {
    if (this.state !== S.PLAY) return { mode: 'drift' };
    // hold the camera perfectly still while the user is committing a dwell-place,
    // so the target cell can't slide out from under a steady hand
    if (this._dwelling) return { mode: 'fixed' };
    switch (this.level.profile) {
      case 'slice':   return { mode: 'sway', center: 0.22, range: 0.34, speed: 0.4 };
      case 'layered': return { mode: 'auto', speed: 0.34 };
      case 'floor':
      default:        return { mode: 'drift' };
    }
  }

  // ---------------- ATTRACT ----------------
  enterAttract(first = false) {
    this.setState(S.ATTRACT);
    this.levelIndex = 0;
    this.field.loadBlueprint(this.level.cells);  // rotating ghost behind the menu
    this.hud.clearBanner();
    this.hud.hideStatus(true);
    this.hud.showCoach(false);
    this._hideBuildUI();
    this.vex.setMood('idle');
    // best time PER LEVEL for the start-screen readout
    const bests = LEVELS.map((lv) => ({ name: lv.name, timeMs: this.leaderboard.bestForLevel(lv.id) }));
    this.hud.showStart({
      bests,
      cameraOk: this.ar.ready,
      onStart: () => this.beginCalibration(),
      onReset: () => { this.leaderboard.resetAll(); this.audio.blip(); this.enterAttract(); },
    });
  }

  beginCalibration() {
    this.audio.unlock();               // must be inside the click gesture
    this.audio.blip();
    if (!this.ar.ready) { this.pointerForced = true; return this.startTurn(); }
    this.setState(S.CALIBRATE);
    this._calibHold = 0;
    this.hud.showCalibrate({
      onReady: () => this.startTurn(),
      onSkip: () => { this.pointerForced = true; this.startTurn(); },
    });
  }

  // ---------------- TURN / LEVELS ----------------
  startTurn() {
    this.levelIndex = 0;
    this.hud.closeOverlay();
    this.beginLevel();
  }

  beginLevel() {
    const lv = this.level;
    this.field.loadBlueprint(lv.cells);
    this.hud.setLevel(lv.tag);
    this.hud.hideStatus(false);
    this.hud.setAccuracy(0);
    this.hud.coach('👆', lv.teach);
    this.hud.showCoach(true);
    // build controls: undo always; layer meter for multi-layer profiles
    const layered = lv.profile === 'slice' || lv.profile === 'layered';
    this.hud.showBuildControls(true, layered);
    this.hud.setLayer(0, this.field.H);
    this.field.showLayerPlane(layered);
    // always-on cheat sheet — VEX explicitly directs attention to it
    this.hud.showCheatSheet(true, layered);
    this.hud.pulseCheatSheet();
    this._dwell = 0;
    this._dwellT = 0; this._dwellCell = null; this._dwellCdUntil = 0;
    this.vex.setMood('point');
    this.vex.say('👈 Point at a cell & HOLD to build!', 3600);
    this.timeLeftMs = lv.seconds * 1000;
    this._cdStep = 3;
    this.setState(S.COUNTDOWN);
    this.audio.countdown();
    this.hud.banner('3');
  }

  _hideBuildUI() {
    this.hud.showBuildControls(false, false);
    this.hud.showCheatSheet(false);
    this.hud.hideReticleLabel();
    this.hud.hideDwellRing();
    this.field.showLayerPlane(false);
    this._dwellT = 0; this._dwellCell = null;
  }

  // ---------------- per-frame ----------------
  update(dt, input, tSec) {
    this.stateTime += dt;

    // camera behaviour depends on state/level (auto — the player never
    // steers the camera; L3 just spins slowly so hidden faces come around)
    const shake = this.screen.update(dt);
    this.world.update(dt, { orbit: this._orbitConfig(), shake });
    this.world.setAmbient(this.ar.sampleAmbient());
    this.field.update(tSec, dt);
    this.particles.update(dt);
    this.vex.update(dt);

    switch (this.state) {
      case S.CALIBRATE: this._updateCalibrate(dt, input); break;
      case S.COUNTDOWN: this._updateCountdown(dt); break;
      case S.PLAY: this._updatePlay(dt, input, tSec); break;
      case S.CLEAR: this._updateClear(dt); break;
      case S.FAIL: this._updateFail(dt); break;
      case S.RESULTS: this._updateResults(dt, input); break;
      case S.ATTRACT: default: break;
    }
  }

  _updateCalibrate(dt, input) {
    const present = input.present;
    if (present) this._calibHold += dt; else this._calibHold = Math.max(0, this._calibHold - dt * 2);
    const progress = Math.min(1, this._calibHold / 1.2);
    this.hud.setCalibProgress(present, progress);
    if (progress >= 1) { this.audio.blip(); this.startTurn(); }
  }

  _updateCountdown(dt) {
    const step = 3 - Math.floor(this.stateTime / 0.7);
    if (step !== this._cdStep) {
      this._cdStep = step;
      if (step > 0) { this.hud.banner(String(step)); this.audio.countdown(); }
      else if (step === 0) { this.hud.banner('BUILD!', { win: true }); this.audio.blip(); }
    }
    if (this.stateTime >= 2.4) {
      this.hud.clearBanner();
      this.lastActionSec = performance.now() / 1000;
      this.setState(S.PLAY);
    }
  }

  _updatePlay(dt, input, tSec) {
    // timer
    this.timeLeftMs -= dt * 1000;
    this.hud.setTimer(Math.max(0, this.timeLeftMs / 1000));
    if (this.timeLeftMs <= 0) return this._enterFail();

    // walked-away guard
    if (!input.present && (tSec - this.lastActionSec) > CONFIG.game.idleResetMs / 1000) {
      return this.enterAttract();
    }

    const cam = this.world.camera;
    const lv = this.level;

    // ---- Active-Lattice targeting: resolve the locked cursor cell ----
    let cell = null;
    if (input.present && input.cursor) {
      if (lv.profile === 'floor') {
        this.field.setActiveLayer(0);
        cell = this.field.cellOnLayer(input.cursor, cam, 0);
      } else if (lv.profile === 'slice') {
        cell = this.field.cellOnSlice(input.cursor, cam, lv.sliceZ);
        if (cell && this.field.setActiveLayer(cell.y)) this._onLayerChange();
      } else { // layered — nav-hand (or wheel) height picks the layer
        if (input.navHeight != null) {
          const layer = Math.min(this.field.H - 1, Math.floor(input.navHeight * this.field.H));
          if (this.field.setActiveLayer(layer)) this._onLayerChange();
        }
        cell = this.field.cellOnLayer(input.cursor, cam, this.field.activeLayer);
      }
    }
    this.hud.setLayer(this.field.activeLayer, this.field.H);

    const placeValid = this.field.isEmpty(cell);
    let deleteCell = null;
    if (input.cursor && (input.fist.active || input.fist.down)) {
      deleteCell = this.field.nearestVoxelToCursor(input.cursor, cam);
    }

    // ---- POINT-AND-DWELL placement (primary, foolproof) ----
    // Hold the reticle still on a valid empty cell for dwellPlaceMs -> auto place.
    // A short grace absorbs tracking jitter; the camera freezes while dwelling
    // (see _orbitConfig) so the target cell can't drift out from under the hand.
    const dwellMs = CONFIG.controls.dwellPlaceMs;
    const GRACE = 0.15;
    const eligible = cell && placeValid && !input.fist.active && tSec >= this._dwellCdUntil;
    let dwellProgress = 0;
    if (eligible) {
      if (this._dwellCell && cellKey(cell) === cellKey(this._dwellCell)) {
        this._dwellT += dt; this._dwellGrace = 0;
      } else if (this._dwellCell && this._dwellGrace < GRACE && this.field.isEmpty(this._dwellCell)) {
        this._dwellGrace += dt;                     // brief wobble — keep the original target
      } else {
        this._dwellCell = { ...cell }; this._dwellT = 0; this._dwellGrace = 0;
      }
      dwellProgress = Math.min(1, this._dwellT / (dwellMs / 1000));
      if (dwellProgress >= 1) {
        this._tryPlace(this._dwellCell, tSec);
        this._dwellT = 0; this._dwellCell = null; this._dwellGrace = 0;
        this._dwellCdUntil = tSec + CONFIG.controls.dwellPlaceCooldownMs / 1000;
        dwellProgress = 0;
      }
    } else if (this._dwellCell && this._dwellGrace < GRACE && !input.fist.active) {
      this._dwellGrace += dt;                        // tolerate a momentary tracking dropout
      dwellProgress = Math.min(1, this._dwellT / (dwellMs / 1000));
    } else {
      this._dwellCell = null; this._dwellT = 0; this._dwellGrace = 0;
    }
    this._dwelling = dwellProgress > 0.001;          // freezes the camera next frame

    // reticle ghost fills with whichever is further along (dwell or a pinch)
    const info = (cell || deleteCell)
      ? { placeCell: cell, placeValid, deleteCell } : null;
    const fillProgress = Math.max(dwellProgress, input.pinchProgress || 0);
    this.reticle.update(info, fillProgress, input.fist.active, dt);
    this._updateReticleLabel(input, cell, placeValid, deleteCell, dwellProgress);

    // dwell progress ring, anchored to the committed target cell on screen
    const ringCell = this._dwellCell || cell;
    if (dwellProgress > 0.001 && ringCell) {
      const v = this.field.worldCenter(ringCell, this._tmp).clone().project(cam);
      this.hud.setDwellRing((v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight, dwellProgress);
    } else {
      this.hud.hideDwellRing();
    }

    // ---- pinch: optional instant-place accelerator (dwell is primary) ----
    if (input.pinch.down) {
      if (cell && placeValid) this._tryPlace(cell, tSec);
      else { this.audio.invalid(); this.screen.addTrauma(0.06); this.vex.setMood('oops'); }
    }

    // ---- forgiving delete: shatter the voxel nearest the cursor ----
    if (input.fist.down) {
      const del = this.field.nearestVoxelToCursor(input.cursor, cam);
      if (del) {
        this.field.worldCenter(del, this._tmp);
        this.field.remove(del);
        this.particles.shatter(this._tmp, CONFIG.color.red);
        this.audio.delete();
        this.screen.addTrauma(0.3);
        this._onAction(tSec);
        this._checkSolved();
      }
    }

    // ---- undo: swipe-left / Z / Backspace (via InputState) ----
    if (input.undo && input.undo.down) this._doUndo(tSec);

    // ---- dwell-to-undo: hold the cursor over the UNDO button ----
    this._updateDwell(dt, input, tSec);

    // struggle hint
    if ((tSec - this.lastActionSec) > 8 && this.field.cells.length < this.field.targetSet.size) {
      this.vex.setMood('point');
      this.vex.say(this.level.control === 'two-hand'
        ? 'Use your other hand to orbit!' : 'Pinch thumb + finger to place');
      this.lastActionSec = tSec - 3; // don't spam every frame
    }
  }

  // Shared place action (used by dwell-complete AND the optional pinch).
  _tryPlace(cell, tSec) {
    if (!cell || !this.field.isEmpty(cell)) return false;
    this.field.place(cell, tSec);
    this.field.worldCenter(cell, this._tmp);
    this.particles.sparks(this._tmp);
    this.audio.place(cell.y);
    this.screen.addTrauma(0.12);
    this.vex.setMood('happy');
    this._onAction(tSec);
    this._checkSolved();
    return true;
  }

  _onAction(tSec) {
    this.lastActionSec = tSec;
    const v = this.field.validate();
    this.hud.setAccuracy(v.accuracy);
  }

  _checkSolved() {
    const v = this.field.validate();
    if (v.solved) this._enterClear();
  }

  _onLayerChange() {
    this.audio.layerShift(this.field.activeLayer);
    this.hud.pulseLayer();
  }

  // Explicit "what the AI is thinking" text pinned to the reticle.
  _updateReticleLabel(input, cell, placeValid, deleteCell, dwellProgress = 0) {
    if (!input.present || !input.cursor) return this.hud.hideReticleLabel();
    let text = '', mode = '';
    if (input.fist.active) {
      text = 'DELETE MODE'; mode = 'delete';
    } else if (cell && !placeValid) {
      text = 'NO SPACE'; mode = 'bad';                 // cell already filled
    } else if (cell && placeValid && dwellProgress < 0.06) {
      text = 'POINT & HOLD'; mode = 'hint';            // nudge; ring takes over as it fills
    }
    if (!text) return this.hud.hideReticleLabel();
    // anchor the label to the block that will change; fall back to the cursor
    const target = mode === 'delete' ? deleteCell : cell;
    let ax = input.cursor.x, ay = input.cursor.y;
    if (target) {
      const v = this.field.worldCenter(target, this._tmp).clone().project(this.world.camera);
      ax = (v.x * 0.5 + 0.5) * window.innerWidth;
      ay = (-v.y * 0.5 + 0.5) * window.innerHeight;
    }
    this.hud.setReticleLabel(ax, ay, text, mode);
  }

  _doUndo(tSec) {
    if (tSec < this._undoCdUntil) return;               // shared cooldown
    const removed = this.field.undoLast();
    if (!removed) return;
    this._undoCdUntil = tSec + CONFIG.controls.undoCooldownMs / 1000;
    this.field.worldCenter(removed, this._tmp);
    this.particles.shatter(this._tmp, CONFIG.color.blue);
    this.audio.undo();
    this.screen.addTrauma(0.15);
    this.vex.setMood('point');
    this.vex.say('Undid last block');
    this._onAction(tSec);
  }

  _updateDwell(dt, input, tSec) {
    if (!input.cursor) { this._dwell = 0; this.hud.setDwell(0); return; }
    const r = this.hud.undoRect();
    const inside = input.cursor.x >= r.left && input.cursor.x <= r.right &&
                   input.cursor.y >= r.top && input.cursor.y <= r.bottom;
    if (inside && tSec >= this._undoCdUntil) {
      this._dwell += dt;
      this.hud.setDwell(Math.min(1, this._dwell / (CONFIG.controls.dwellUndoMs / 1000)));
      if (this._dwell >= CONFIG.controls.dwellUndoMs / 1000) {
        this._dwell = 0; this.hud.setDwell(0); this._doUndo(tSec);
      }
    } else {
      this._dwell = 0; this.hud.setDwell(0);
    }
  }

  // ---------------- CLEAR ----------------
  _enterClear() {
    this.setState(S.CLEAR);
    this.elapsedMs = this.level.seconds * 1000 - this.timeLeftMs;
    this.screen.hitStop(150);
    this.screen.slowMo(0.3, 420);
    this.screen.flash('#6EF08A', 0.8, 420);       // green victory flash
    this.screen.addTrauma(0.7);
    this.particles.confetti(this.world.center);
    this.audio.duckMusic();
    this.audio.levelClear();
    this.hud.banner('LEVEL CLEARED', { win: true });
    this.hud.showCoach(false);
    this._hideBuildUI();
    this.vex.setMood('happy');
    this.vex.say('AWESOME! 🎉');
    this.reticle.update(null, 0, false, 0.016);   // hide reticle
  }

  _updateClear(dt) {
    if (this.stateTime >= CONFIG.game.clearHoldMs / 1000) this._enterResults();
  }

  _enterResults() {
    this.setState(S.RESULTS);
    this.hud.clearBanner();
    this.hud.hideStatus(true);
    const lid = this.level.id;
    const snap = Leaderboard.snapshot(this.ar.video, this.world.renderer.domElement);
    const canSave = this.leaderboard.qualifies(this.elapsedMs, lid);
    const board = this.leaderboard.load(lid);
    this.hud.showResults({
      timeMs: this.elapsedMs,
      levelTag: this.level.tag,
      board,
      myRank: -1,
      canSave,
      snapshotURL: snap,
      onSave: (initials) => {
        const entry = { initials, timeMs: this.elapsedMs, thumb: snap, level: lid };
        const rank = this.leaderboard.add(entry, lid);
        this.audio.blip();
        this.hud.showResultsSaved({ board: this.leaderboard.load(lid), myRank: rank, onNext: () => this._advance() });
      },
      onNext: () => this._advance(),
    });
  }

  _advance() {
    this.audio.blip();
    if (this.levelIndex < LEVELS.length - 1) {
      this.levelIndex++;
      this.hud.closeOverlay();
      this.beginLevel();
    } else {
      this.hud.closeOverlay();
      this.hud.banner('YOU BEAT HOLOFORGE!', { win: true });
      setTimeout(() => this.enterAttract(), 2600);
    }
  }

  // ---------------- FAIL ----------------
  _enterFail() {
    this.setState(S.FAIL);
    this.screen.flash('#FF3B3B', 0.5, 400);
    this.screen.addTrauma(0.4);
    this.hud.banner("TIME'S UP");
    this._hideBuildUI();
    this.vex.setMood('oops');
    this.vex.say('So close! Try again?');
    this.reticle.update(null, 0, false, 0.016);
  }
  _updateFail(dt) {
    if (this.stateTime >= 2.6) this.enterAttract();
  }

  _updateResults(dt, input) {
    // auto-reset the booth if a finished session is abandoned
    if (this.stateTime > CONFIG.game.idleResetMs / 1000) this.enterAttract();
  }

  // ---------------- external controls ----------------
  restartLevel() { if ([S.PLAY, S.FAIL].includes(this.state)) this.beginLevel(); }
}
