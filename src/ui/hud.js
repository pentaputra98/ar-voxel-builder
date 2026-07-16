// ============================================================
// HUD — owns all DOM chrome (corner panels) and the full-screen
// overlays (start / calibrate / results+leaderboard). Center stays clear.
// ============================================================
import { CONFIG, CSSCOLOR } from '../config.js';
import { drawJoinEmblem } from '../exhibition/leaderboard.js';

const $ = (id) => document.getElementById(id);
const fmt = (ms) => (ms / 1000).toFixed(1);

export class HUD {
  constructor() {
    this.levelTag = $('level-tag');
    this.timer = $('timer');
    this.accFill = $('accuracy-fill');
    this.accLabel = $('accuracy-label');
    this.coachIcon = $('coach-icon');
    this.coachText = $('coach-text');
    this.coachPanel = $('panel-coach');
    this.bannerEl = $('banner');
    this.diagEl = $('diag');
    this.statusPanel = $('panel-status');
    this.overlays = $('overlays');
    this.cheatSheet = $('cheat-sheet');
    this.cheatLayerRow = $('cheat-layer-row');
    this.reticleLabel = $('reticle-label');
    this.dwellRing = $('dwell-ring');
    this.dwellProg = this.dwellRing?.querySelector('.dr-prog');
    this._dwellCirc = 2 * Math.PI * 27;   // matches r=27 in the SVG
    this._buildControls();
  }

  // ---------- dwell-to-place ring ----------
  setDwellRing(x, y, progress) {
    const el = this.dwellRing; if (!el) return;
    el.classList.add('show');
    el.classList.toggle('full', progress >= 0.999);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.dwellProg.style.strokeDashoffset = String(this._dwellCirc * (1 - progress));
  }
  hideDwellRing() { this.dwellRing?.classList.remove('show', 'full'); }

  // ---------- cheat sheet ----------
  showCheatSheet(show, layered = false) {
    this.cheatSheet.style.display = show ? '' : 'none';
    this.cheatLayerRow.classList.toggle('on', layered);
  }
  pulseCheatSheet() {
    this.cheatSheet.classList.remove('attn'); void this.cheatSheet.offsetWidth;
    this.cheatSheet.classList.add('attn');
  }

  // ---------- reticle floating label ----------
  setReticleLabel(x, y, text, mode) {
    const el = this.reticleLabel;
    el.textContent = text;
    el.className = `show ${mode}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  hideReticleLabel() { this.reticleLabel.className = ''; }

  // Inject the UNDO button (dwell + click) and the layer meter.
  _buildControls() {
    const hud = $('hud');
    const undo = document.createElement('button');
    undo.id = 'undo-btn';
    undo.className = 'undo-btn';
    undo.innerHTML = '<span class="undo-glyph">⟲</span> UNDO<span class="dwell" id="undo-dwell"></span>';
    undo.style.display = 'none';
    hud.appendChild(undo);
    this.undoBtn = undo;
    this.undoDwell = undo.querySelector('#undo-dwell');

    const meter = document.createElement('div');
    meter.id = 'layer-meter';
    meter.className = 'layer-meter';
    meter.style.display = 'none';
    meter.innerHTML = '<div class="lm-segments" id="lm-segments"></div><div class="lm-label" id="lm-label">LAYER 1</div>';
    hud.appendChild(meter);
    this.layerMeter = meter;
    this.lmSegments = meter.querySelector('#lm-segments');
    this.lmLabel = meter.querySelector('#lm-label');
    this._lmTotal = 0;
  }

  onUndo(cb) { this.undoBtn.addEventListener('click', cb); }
  showBuildControls(show, layered) {
    this.undoBtn.style.display = show ? '' : 'none';
    this.layerMeter.style.display = show && layered ? '' : 'none';
  }
  undoRect() { return this.undoBtn.getBoundingClientRect(); }
  setDwell(frac) { if (this.undoDwell) this.undoDwell.style.width = `${Math.round(frac * 100)}%`; }

  setLayer(n, total) {
    if (total !== this._lmTotal) {
      this._lmTotal = total;
      this.lmSegments.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const s = document.createElement('div'); s.className = 'lm-seg'; this.lmSegments.appendChild(s);
      }
    }
    const segs = this.lmSegments.children;
    for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i <= n);
    this.lmLabel.textContent = `LAYER ${n + 1}`;
  }
  pulseLayer() {
    this.layerMeter.classList.remove('pulse'); void this.layerMeter.offsetWidth;
    this.layerMeter.classList.add('pulse');
  }

  setLevel(tag) { this.levelTag.textContent = tag; }

  setTimer(seconds) {
    this.timer.textContent = seconds.toFixed(1);
    const urgent = seconds <= CONFIG.game.urgentAt;
    this.timer.classList.toggle('urgent', urgent);
  }
  hideStatus(hide) { this.statusPanel.style.opacity = hide ? '0' : '1'; }

  setAccuracy(frac) {
    this.accFill.style.width = `${Math.round(frac * 100)}%`;
    this.accLabel.textContent = `${Math.round(frac * 100)}%`;
  }

  coach(icon, html) {
    this.coachIcon.textContent = icon;
    this.coachText.innerHTML = html;
    this.coachPanel.style.opacity = '1';
  }
  showCoach(v) { this.coachPanel.style.opacity = v ? '1' : '0'; }

  banner(text, { win = false } = {}) {
    this.bannerEl.textContent = text;
    this.bannerEl.className = 'banner';   // reset animation
    void this.bannerEl.offsetWidth;       // reflow to restart
    this.bannerEl.classList.add('show');
    if (win) this.bannerEl.classList.add('win');
  }
  clearBanner() { this.bannerEl.className = 'banner'; this.bannerEl.textContent = ''; }

  diag(text) { this.diagEl.textContent = text; }
  showDiag(v) { this.diagEl.hidden = !v; }

  // ---------- overlays ----------
  closeOverlay() { this.overlays.innerHTML = ''; }

  showStart({ bests = [], cameraOk, onStart, onReset }) {
    const mode = cameraOk ? '' :
      `<p class="sub" style="color:var(--red)">webcam unavailable · mouse mode active</p>`;
    // per-level best times
    const bestRows = bests.map((b) =>
      `<div class="best-item"><span class="best-name">${b.name}</span>` +
      `<span class="best-time">${b.timeMs != null ? fmt(b.timeMs) + 's' : '—'}</span></div>`).join('');
    this.overlays.innerHTML = `
      <div class="overlay">
        <div class="sub">VECTOR · VIDATRA ENGINEERING CODING TECHNOLOGY OF ROBOTICS</div>
        <h1>V&#8288;-&#8288;BLOX <span class="accent">AR</span></h1>
        <p class="sub">HOLOFORGE EDITION</p>
        <p>Forge structures out of light with your bare hands. Match the glowing blueprint before the clock runs out.</p>
        ${mode}
        <button class="cta" id="btn-start">STEP IN TO PLAY</button>
        <div class="best-board">
          <div class="best-title">BEST TIMES</div>
          <div class="best-list">${bestRows}</div>
          <button class="cta ghost" id="btn-reset">⟲ RESET HIGH SCORES</button>
        </div>
        <p class="hint-keys">Keys: <kbd>T</kbd> live tuning · <kbd>D</kbd> diagnostics · <kbd>M</kbd> mouse mode · <kbd>H</kbd> swap hands · <kbd>Z</kbd> undo · <kbd>R</kbd> restart</p>
      </div>`;
    $('btn-start').onclick = onStart;
    // two-tap confirm so a booth reset can't happen by accident
    const rbtn = $('btn-reset');
    let armed = false, armTimer = null;
    rbtn.onclick = () => {
      if (!armed) {
        armed = true; rbtn.textContent = '⚠ TAP AGAIN TO CONFIRM'; rbtn.classList.add('danger');
        armTimer = setTimeout(() => { armed = false; rbtn.textContent = '⟲ RESET HIGH SCORES'; rbtn.classList.remove('danger'); }, 3000);
      } else {
        clearTimeout(armTimer);
        onReset?.();
      }
    };
  }

  showCalibrate({ onReady, onSkip }) {
    this.overlays.innerHTML = `
      <div class="overlay">
        <div class="sub">CALIBRATION</div>
        <h1 style="font-size:clamp(24px,5vw,48px)">RAISE YOUR HANDS</h1>
        <p>Hold your hands up inside the glowing frames. This sets the perfect distance from the camera.</p>
        <div class="calib-hands">
          <div class="calib-hand" id="calib-l" data-label="NAVIGATE"></div>
          <div class="calib-hand" id="calib-r" data-label="BUILD"></div>
        </div>
        <p class="sub" id="calib-status">Looking for your hands…</p>
        <button class="cta ghost" id="btn-skip">SKIP · USE MOUSE</button>
      </div>`;
    this._calibL = $('calib-l');
    this._calibR = $('calib-r');
    this._calibStatus = $('calib-status');
    this._onCalibReady = onReady;
    $('btn-skip').onclick = onSkip;
  }
  // progress 0..1 while hands are held in place
  setCalibProgress(present, progress) {
    if (!this._calibStatus) return;
    this._calibL?.classList.toggle('matched', present);
    this._calibR?.classList.toggle('matched', present);
    this._calibStatus.textContent = present
      ? `Hold steady… ${Math.round(progress * 100)}%`
      : 'Looking for your hands…';
  }

  showResults({ timeMs, levelTag, board, myRank, canSave, onSave, onNext, snapshotURL }) {
    const rows = board.map((e, i) => `
      <div class="board-row ${i === myRank ? 'me' : ''}">
        <span class="rank">#${i + 1}</span>
        <img class="thumb" src="${e.thumb || ''}" alt="" />
        <span class="who">${e.initials || '???'}</span>
        <span class="score">${fmt(e.timeMs)}s</span>
      </div>`).join('');

    const saveBlock = canSave ? `
      <p class="sub">NEW TOP TIME! Enter your initials</p>
      <input class="initials-input" id="initials" maxlength="3" placeholder="AAA" />
      <button class="cta" id="btn-save">SAVE SCORE</button>` : `
      <button class="cta" id="btn-next">NEXT CHALLENGER</button>`;

    this.overlays.innerHTML = `
      <div class="overlay" style="justify-content:flex-start;padding:4vh 0;overflow:auto;gap:14px">
        <h1 style="font-size:clamp(26px,5vw,54px)">LEVEL <span class="accent">CLEARED</span></h1>
        <p class="sub">TIME · <b style="color:var(--orange)">${fmt(timeMs)}s</b></p>
        ${snapshotURL ? `<img class="snapshot-preview" src="${snapshotURL}" alt="your build" />` : ''}
        <div class="best-title" style="margin-top:6px">${levelTag || ''} · TOP TIMES</div>
        <div class="board">${rows || '<p class="sub">Be the first on the board!</p>'}</div>
        ${saveBlock}
        <div class="qr-join">
          <div class="qr"><canvas id="qr-canvas" width="72" height="72"></canvas></div>
          <div class="qr-text">Loved it?<br><b>Scan to join VECTOR</b><br>${CONFIG.exhibition.joinUrl}</div>
        </div>
      </div>`;

    const qr = $('qr-canvas'); if (qr) drawJoinEmblem(qr);

    if (canSave) {
      const input = $('initials');
      input.focus();
      const save = () => {
        const v = (input.value || 'AAA').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
        onSave(v);
      };
      $('btn-save').onclick = save;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    } else {
      $('btn-next').onclick = onNext;
    }
  }

  // re-render board after a save, then show the NEXT button
  showResultsSaved({ board, myRank, onNext }) {
    const boardEl = document.querySelector('.overlay .board');
    if (boardEl) {
      boardEl.innerHTML = board.map((e, i) => `
        <div class="board-row ${i === myRank ? 'me' : ''}">
          <span class="rank">#${i + 1}</span>
          <img class="thumb" src="${e.thumb || ''}" alt="" />
          <span class="who">${e.initials || '???'}</span>
          <span class="score">${fmt(e.timeMs)}s</span>
        </div>`).join('');
    }
    const btn = $('btn-save');
    if (btn) { btn.textContent = 'NEXT CHALLENGER'; btn.id = 'btn-next'; btn.onclick = onNext; }
    const input = $('initials'); if (input) input.disabled = true;
  }
}
