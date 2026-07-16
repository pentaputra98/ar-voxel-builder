// ============================================================
// Particles — one pooled, additive-blended Points system for everything:
// placement sparks, delete shatter shards, and level-clear confetti.
// Pooled & preallocated: zero per-frame allocation in the hot path.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Particles {
  constructor(scene) {
    this.max = CONFIG.fx.maxParticles;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // pool metadata
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);      // remaining life (s)
    this.maxLife = new Float32Array(this.max);
    this.grav = new Float32Array(this.max);
    this.head = 0;
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -9999;
  }

  _spawn(x, y, z, vx, vy, vz, life, grav, color) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
  }

  burst(p, { count = 20, speed = 3, life = 0.5, grav = 6, colors = [0xffffff] } = {}) {
    const c = new THREE.Color();
    for (let n = 0; n < count; n++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.4 + Math.random() * 0.8);
      c.set(colors[(Math.random() * colors.length) | 0]);
      this._spawn(
        p.x, p.y, p.z,
        s * Math.sin(ph) * Math.cos(th), Math.abs(s * Math.cos(ph)) + 1, s * Math.sin(ph) * Math.sin(th),
        life * (0.6 + Math.random() * 0.6), grav, c);
    }
  }

  sparks(p) {
    this.burst(p, { count: CONFIG.fx.sparkCount, speed: 3.2, life: 0.5, grav: 7,
      colors: [CONFIG.color.orange, CONFIG.color.blue, CONFIG.color.white] });
  }
  shatter(p, color = CONFIG.color.red) {
    this.burst(p, { count: CONFIG.fx.shatterShards, speed: 4.2, life: 0.75, grav: 10,
      colors: [color, CONFIG.color.white] });
  }
  confetti(center) {
    const c = new THREE.Color();
    const palette = [CONFIG.color.orange, CONFIG.color.blue, CONFIG.color.white];
    for (let n = 0; n < CONFIG.fx.confettiCount; n++) {
      c.set(palette[(Math.random() * palette.length) | 0]);
      this._spawn(
        center.x + (Math.random() - 0.5) * 2, center.y + 3 + Math.random() * 2, center.z + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5,
        1.6 + Math.random() * 1.2, 5, c);
    }
  }

  update(dt) {
    let changed = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      changed = true;
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;          // gravity
      this.vel[k] *= 0.98; this.vel[k + 2] *= 0.98;  // drag
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.life[i] <= 0 || this.pos[k + 1] < -1) this.pos[k + 1] = -9999; // retire
    }
    if (changed) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }
}
