// ============================================================
// VoxelField — the build volume.
//  * placed voxels in ONE InstancedMesh (single draw call)
//  * target "ghost" cells in a second translucent InstancedMesh
//  * ACTIVE-LATTICE targeting: the cursor is locked to one discrete layer
//    (floor plane, vertical slice, or a raised horizontal layer). Depth is a
//    quantized 1-axis decision — never a face-aim guessing game.
//  * forgiving delete (nearest voxel to cursor) + an undo history stack
//  * live validation of the placed set against the level blueprint
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../util/oneEuro.js';

const key = (c) => `${c.x},${c.y},${c.z}`;
const POP_MS = 0.2;
// punchy pop that never shrinks small enough to break raycasting:
// starts at 0.9, overshoots ~1.12 mid-way, settles at 1.0.
const popScale = (p) => (0.9 + 0.1 * p) * (1 + 0.16 * Math.sin(p * Math.PI));

export class VoxelField {
  constructor(scene) {
    const C = CONFIG;
    this.N = C.grid.size;
    this.H = C.grid.height;
    this.cell = C.grid.cell;
    this.capacity = this.N * this.N * this.H;

    const geo = new THREE.BoxGeometry(this.cell * 0.94, this.cell * 0.94, this.cell * 0.94);

    // --- placed voxels ---
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissiveIntensity: 0.45, transparent: true, opacity: 0.9,
      roughness: 0.32, metalness: 0.12,
    });
    mat.emissive = new THREE.Color(C.color.orange);
    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = this.capacity;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // --- ghost target voxels ---
    const ghostMat = new THREE.MeshStandardMaterial({
      color: C.color.blue, emissive: C.color.blue, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.5,
    });
    this.ghost = new THREE.InstancedMesh(geo, ghostMat, this.capacity);
    this.ghost.count = this.capacity;
    this.ghost.frustumCulled = false;
    scene.add(this.ghost);

    // active placed cells (contiguous) + lookup
    this.cells = [];                 // [{x,y,z}]
    this.index = new Map();          // key -> instance slot
    this.placeTimes = [];            // per-slot spawn time (for pop anim)
    this.history = [];               // placement order (keys) for Undo

    // blueprint
    this.target = [];                // [{x,y,z}]
    this.targetSet = new Set();

    // active build layer + its glowing plane visual
    this.activeLayer = 0;
    this._layerVisualY = 0;
    this._buildLayerPlane(scene);

    // reusable scratch
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._col = new THREE.Color();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane();
    this._hitPt = new THREE.Vector3();
    this._proj = new THREE.Vector3();

    this._parkAll();
    this._parkAllGhost();
  }

  _buildLayerPlane(scene) {
    const g = this.N * this.cell;
    const geo = new THREE.PlaneGeometry(g, g);
    const mat = new THREE.MeshBasicMaterial({
      color: CONFIG.color.blue, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false });
    this.layerPlane = new THREE.Mesh(geo, mat);
    this.layerPlane.rotation.x = -Math.PI / 2;
    this.layerPlane.visible = false;
    scene.add(this.layerPlane);
    // bright border for the active layer
    const half = g / 2;
    this.layerBorder = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, -half),
        new THREE.Vector3(half, 0, half), new THREE.Vector3(-half, 0, half)]),
      new THREE.LineBasicMaterial({ color: CONFIG.color.blue, transparent: true, opacity: 0.7 }));
    this.layerBorder.visible = false;
    scene.add(this.layerBorder);
  }

  // ---------- coordinate helpers ----------
  worldCenter(c, out = this._p) {
    const off = (this.N - 1) / 2;
    return out.set((c.x - off) * this.cell, (c.y + 0.5) * this.cell, (c.z - off) * this.cell);
  }
  inBounds(c) {
    return c.x >= 0 && c.x < this.N && c.z >= 0 && c.z < this.N && c.y >= 0 && c.y < this.H;
  }

  // ---------- level setup ----------
  loadBlueprint(cells) {
    this.reset();
    this.target = cells.map((c) => ({ ...c }));
    this.targetSet = new Set(this.target.map(key));
    this._refreshGhost();
  }

  reset() {
    this.cells = []; this.index.clear(); this.placeTimes = []; this.history = [];
    this.activeLayer = 0; this._layerVisualY = 0;
    this._parkAll();
  }

  // ---------- placement ----------
  place(cell, tSec) {
    if (!this.inBounds(cell) || this.index.has(key(cell))) return false;
    if (this.cells.length >= this.capacity) return false;
    const slot = this.cells.length;
    this.cells.push({ ...cell });
    this.index.set(key(cell), slot);
    this.placeTimes[slot] = tSec;
    this.history.push(key(cell));
    this._writeInstance(slot, popScale(0));    // full-ish size immediately (raycastable)
    this._applyColor(slot, cell);
    this._refreshGhost();
    return true;
  }

  remove(cell) {
    const k = key(cell);
    const slot = this.index.get(k);
    if (slot === undefined) return false;
    const last = this.cells.length - 1;
    // swap-remove to keep instances contiguous
    if (slot !== last) {
      const moved = this.cells[last];
      this.cells[slot] = moved;
      this.placeTimes[slot] = this.placeTimes[last];
      this.index.set(key(moved), slot);
      this._writeInstance(slot, 1);
      this._applyColor(slot, moved);
    }
    this.cells.pop(); this.placeTimes.pop(); this.index.delete(k);
    const h = this.history.lastIndexOf(k); if (h !== -1) this.history.splice(h, 1);
    this._park(last);
    this._refreshGhost();
    return true;
  }

  // Undo: remove the most recently placed voxel that still exists.
  undoLast() {
    while (this.history.length) {
      const k = this.history[this.history.length - 1];
      if (this.index.has(k)) {
        const [x, y, z] = k.split(',').map(Number);
        this.remove({ x, y, z });
        return { x, y, z };
      }
      this.history.pop(); // stale entry
    }
    return null;
  }

  // ---------- active build layer ----------
  setActiveLayer(n) {
    const clamped = clamp(Math.round(n), 0, this.H - 1);
    const changed = clamped !== this.activeLayer;
    this.activeLayer = clamped;
    return changed;   // caller plays the tick / plane-shift feedback
  }
  showLayerPlane(show) {
    this.layerPlane.visible = show;
    this.layerBorder.visible = show;
  }

  // ---------- per-frame animation ----------
  update(tSec, dt = 0.016) {
    let dirty = false;
    for (let i = 0; i < this.cells.length; i++) {
      const age = tSec - (this.placeTimes[i] ?? tSec);
      if (age < POP_MS) {
        this._writeInstance(i, popScale(clamp(age / POP_MS, 0, 1)));
        dirty = true;
      } else if (age < POP_MS + 0.05) {
        this._writeInstance(i, 1); // settle exactly at full size
        dirty = true;
      }
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;

    // slide the active-layer plane toward its target height (satisfying shift)
    const targetY = this.activeLayer * this.cell + 0.02;
    this._layerVisualY += (targetY - this._layerVisualY) * (1 - Math.pow(0.0001, dt));
    this.layerPlane.position.y = this._layerVisualY;
    this.layerBorder.position.y = this._layerVisualY;
  }

  // ---------- ACTIVE-LATTICE targeting ----------
  _castTo(cursor, camera) {
    camera.updateMatrixWorld();
    this._ray.setFromCamera({
      x: (cursor.x / window.innerWidth) * 2 - 1,
      y: -(cursor.y / window.innerHeight) * 2 + 1,
    }, camera);
  }

  // Aim on the horizontal plane at the base of `layer`. Returns cell or null.
  cellOnLayer(cursor, camera, layer) {
    this._castTo(cursor, camera);
    this._plane.set(new THREE.Vector3(0, 1, 0), -layer * this.cell);
    if (!this._ray.ray.intersectPlane(this._plane, this._hitPt)) return null;
    const off = (this.N - 1) / 2;
    const cell = {
      x: Math.round(this._hitPt.x / this.cell + off), y: layer,
      z: Math.round(this._hitPt.z / this.cell + off),
    };
    return this.inBounds(cell) ? cell : null;
  }

  // Aim on the vertical slice at z = sliceZ. Hand height => layer (y).
  // Returns cell or null.
  cellOnSlice(cursor, camera, sliceZ) {
    this._castTo(cursor, camera);
    const off = (this.N - 1) / 2;
    const worldZ = (sliceZ - off) * this.cell;
    this._plane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, worldZ));
    if (!this._ray.ray.intersectPlane(this._plane, this._hitPt)) return null;
    const cell = {
      x: Math.round(this._hitPt.x / this.cell + off),
      y: clamp(Math.round(this._hitPt.y / this.cell - 0.5), 0, this.H - 1),
      z: sliceZ,
    };
    return this.inBounds(cell) ? cell : null;
  }

  isEmpty(cell) { return !!cell && !this.index.has(key(cell)); }

  // Forgiving delete: the placed voxel whose screen projection is nearest the
  // cursor, within `deleteRadiusFrac` of the viewport diagonal. No precise aim.
  nearestVoxelToCursor(cursor, camera) {
    if (this.cells.length === 0) return null;
    camera.updateMatrixWorld();
    const diag = Math.hypot(window.innerWidth, window.innerHeight);
    const maxD = CONFIG.controls.deleteRadiusFrac * diag;
    let best = null, bestD = maxD;
    for (const c of this.cells) {
      this.worldCenter(c, this._proj).project(camera);
      const sx = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;
      const d = Math.hypot(sx - cursor.x, sy - cursor.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { ...best } : null;
  }

  // ---------- validation ----------
  validate() {
    let matched = 0, extras = 0;
    for (const c of this.cells) {
      if (this.targetSet.has(key(c))) matched++; else extras++;
    }
    const total = this.targetSet.size || 1;
    const missing = total - matched;
    const accuracy = clamp(matched / total, 0, 1);
    const solved = extras === 0 && missing === 0 && this.cells.length > 0;
    return { matched, extras, missing, total, accuracy, solved };
  }

  // ---------- internals ----------
  _writeInstance(slot, scale) {
    this.worldCenter(this.cells[slot], this._p);
    this._q.identity();
    this._s.setScalar(scale);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(slot, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  _applyColor(slot, cell) {
    const correct = this.targetSet.has(key(cell));
    this._col.set(correct ? CONFIG.color.orange : CONFIG.color.red);
    this.mesh.setColorAt(slot, this._col);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  _park(slot) {
    this._m.makeTranslation(0, -9999, 0);
    this.mesh.setMatrixAt(slot, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  _parkAll() {
    this._m.makeTranslation(0, -9999, 0);
    for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  _parkAllGhost() {
    this._m.makeTranslation(0, -9999, 0);
    for (let i = 0; i < this.capacity; i++) this.ghost.setMatrixAt(i, this._m);
    this.ghost.instanceMatrix.needsUpdate = true;
  }
  // ghost shows only the still-missing target cells
  _refreshGhost() {
    let n = 0;
    for (const c of this.target) {
      if (this.index.has(key(c))) continue;      // already placed => hide ghost
      this.worldCenter(c, this._p);
      this._q.identity(); this._s.setScalar(0.9);
      this._m.compose(this._p, this._q, this._s);
      this.ghost.setMatrixAt(n++, this._m);
    }
    this._m.makeTranslation(0, -9999, 0);
    for (let i = n; i < this.capacity; i++) this.ghost.setMatrixAt(i, this._m);
    this.ghost.instanceMatrix.needsUpdate = true;
  }

  clearAll() { this.reset(); this.target = []; this.targetSet.clear(); this._parkAllGhost(); }
}
