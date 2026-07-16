// ============================================================
// One-Euro filter — smooth when still, snappy when moving.
// The single biggest "toy -> product" upgrade for noisy landmarks.
// Ref: Casiez et al., "1€ Filter" (CHI 2012).
// ============================================================

class LowPass {
  constructor() { this.y = null; this.s = null; }
  filter(x, alpha) {
    this.s = this.y === null ? x : alpha * x + (1 - alpha) * this.s;
    this.y = x;
    return this.s;
  }
  get hasLast() { return this.y !== null; }
}

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuro {
  constructor({ minCutoff = 1.4, beta = 0.03, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.lastT = null;
  }
  reset() { this.x = new LowPass(); this.dx = new LowPass(); this.lastT = null; }
  filter(value, tSeconds) {
    let dt = 1 / 60;
    if (this.lastT !== null && tSeconds > this.lastT) dt = tSeconds - this.lastT;
    this.lastT = tSeconds;
    const dValue = this.x.hasLast ? (value - this.x.y) / dt : 0;
    const edValue = this.dx.filter(dValue, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
    return this.x.filter(value, alpha(cutoff, dt));
  }
}

// Smooths a 2D/3D point (array of OneEuros, one per axis).
export class OneEuroVec {
  constructor(dims, params) {
    this.filters = Array.from({ length: dims }, () => new OneEuro(params));
  }
  reset() { this.filters.forEach(f => f.reset()); }
  filter(vec, t) { return vec.map((v, i) => this.filters[i].filter(v, t)); }
}

// Frame-rate-independent damping toward a target.
// f in (0,1): fraction *remaining* per second (smaller = snappier).
export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
