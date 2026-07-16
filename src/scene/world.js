// ============================================================
// World — Three.js renderer, orbiting camera, lights, fog, and the
// holographic engineering-table grid that anchors the whole build.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { damp, clamp } from '../util/oneEuro.js';

export class World {
  constructor(canvas) {
    const C = CONFIG;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // #1 perf lever
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(C.color.navy, 0.032);

    const gsize = C.grid.size * C.grid.cell;
    this.center = new THREE.Vector3(0, C.grid.height * 0.28, 0);

    this.camera = new THREE.PerspectiveCamera(
      C.camera.fov, safeAspect(), 0.1, 100);

    // spherical orbit state
    this.azimuth = 0.6;
    this.targetAzimuth = 0.6;
    this.radius = C.camera.radius;
    this.targetRadius = C.camera.radius;
    this.phi = C.camera.phi;
    this._swayT = 0;
    // screen-shake offset applied on top of the orbit position
    this._shake = new THREE.Vector3();
    this._updateCameraPos(0);

    // ---- lights ----
    this.hemi = new THREE.HemisphereLight(C.color.blue, C.color.navy, 0.9);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(C.color.white, 1.1);
    this.dir.position.set(4, 9, 5);
    this.scene.add(this.dir);
    this.scene.add(new THREE.AmbientLight(C.color.white, 0.25));

    // ---- holographic table ----
    this._buildTable(gsize);

    window.addEventListener('resize', () => this.resize());
  }

  _buildTable(gsize) {
    const C = CONFIG;
    const g = new THREE.Group();

    // Grid lines on the floor (light-blue)
    const grid = new THREE.GridHelper(gsize, C.grid.size, C.color.blue, C.color.blue);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    g.add(grid);

    // Glowing base slab
    const slabGeo = new THREE.BoxGeometry(gsize + 0.6, 0.12, gsize + 0.6);
    const slabMat = new THREE.MeshStandardMaterial({
      color: C.color.navy2, emissive: C.color.blue, emissiveIntensity: 0.25,
      transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.2,
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.y = -0.07;
    g.add(slab);

    // Perimeter frame (line loop) — reads as a projector footprint
    const half = gsize / 2 + 0.3;
    const pts = [
      new THREE.Vector3(-half, 0.001, -half), new THREE.Vector3(half, 0.001, -half),
      new THREE.Vector3(half, 0.001, half), new THREE.Vector3(-half, 0.001, half),
      new THREE.Vector3(-half, 0.001, -half),
    ];
    const frame = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: C.color.orange, transparent: true, opacity: 0.85 }));
    g.add(frame);
    this.frame = frame;

    // Corner posts (little pixel-robot-ish pylons)
    const postMat = new THREE.MeshStandardMaterial({
      color: C.color.orange, emissive: C.color.orange, emissiveIntensity: 0.6 });
    for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), postMat);
      post.position.set(sx * half, 0.25, sz * half);
      g.add(post);
    }

    this.table = g;
    this.scene.add(g);
  }

  _updateCameraPos(dt) {
    const sinPhi = Math.sin(this.phi);
    const x = this.center.x + this.radius * sinPhi * Math.sin(this.azimuth);
    const z = this.center.z + this.radius * sinPhi * Math.cos(this.azimuth);
    const y = this.center.y + this.radius * Math.cos(this.phi);
    this.camera.position.set(x + this._shake.x, y + this._shake.y, z + this._shake.z);
    this.camera.lookAt(this.center);
  }

  // orbit: { mode, speed?, center?, range? }
  //   'drift' — slow continuous rotation (attract / L1 floor)
  //   'auto'  — faster continuous rotation to reveal hidden faces (L3)
  //   'sway'  — oscillate around a near-frontal azimuth so a vertical build
  //             slice never turns edge-on and stays aimable (L2)
  //   'fixed' — hold a set azimuth
  update(dt, { orbit = { mode: 'drift' }, shake = null } = {}) {
    const C = CONFIG.camera;
    const o = orbit || { mode: 'drift' };
    switch (o.mode) {
      case 'auto':
      case 'drift':
        this.targetAzimuth += (o.speed ?? C.autoOrbitSpeed) * dt;
        break;
      case 'sway':
        this._swayT += dt;
        this.targetAzimuth = (o.center ?? 0.25) + Math.sin(this._swayT * (o.speed ?? 0.4)) * (o.range ?? 0.32);
        break;
      case 'fixed':
        if (o.center != null) this.targetAzimuth = o.center;
        break;
    }
    // damp toward targets (cinematic)
    this.azimuth = damp(this.azimuth, this.targetAzimuth, C.damping, dt);
    this.radius = damp(this.radius, this.targetRadius, C.damping, dt);
    this._shake.copy(shake || this._shake.set(0, 0, 0));
    this._updateCameraPos(dt);
  }

  setRadius(r) { this.targetRadius = clamp(r, CONFIG.camera.minRadius, CONFIG.camera.maxRadius); }

  setAmbient(level) {
    // level 0..1 from webcam brightness -> gentle exposure match
    const e = 0.55 + level * 0.85;
    this.dir.intensity = 0.7 + level * 0.9;
    this.hemi.intensity = 0.6 + level * 0.6;
    this.renderer.toneMappingExposure = e;
  }

  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.camera.aspect = safeAspect();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    // self-heal the aspect every frame — a kiosk can boot at a 0-size viewport,
    // and a NaN aspect would silently break all raycasting.
    const a = safeAspect();
    if (this.camera.aspect !== a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
    this.renderer.render(this.scene, this.camera);
  }
}

function safeAspect() {
  const w = window.innerWidth, h = window.innerHeight;
  return (w > 0 && h > 0) ? w / h : 1;
}
