// ============================================================
// SmartReticle — the whole cursor language in one adaptive element.
//   idle dot  ->  morphing wireframe cube (driven by pinch PROGRESS,
//   not a binary threshold)  ->  solid orange ghost when valid,
//   red broken/shaking ring when invalid.
// Plus the depth cues: a glowing laser drop-line to the floor and a
// contact shadow ring — the single biggest aid to placement accuracy.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { damp } from '../util/oneEuro.js';

export class SmartReticle {
  constructor(scene, field) {
    this.field = field;
    const C = CONFIG;
    this.group = new THREE.Group();
    scene.add(this.group);

    // idle dot
    this.dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 16),
      new THREE.MeshBasicMaterial({ color: C.color.blue, transparent: true, opacity: 0.95 }));
    this.group.add(this.dot);

    // wireframe cube (morph target)
    const box = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    this.wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: C.color.blue, transparent: true, opacity: 0 }));
    this.group.add(this.wire);

    // solid ghost fill (fills in as pinch completes)
    this.fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshStandardMaterial({
        color: C.color.orange, emissive: C.color.orange, emissiveIntensity: 0.7,
        transparent: true, opacity: 0, roughness: 0.3 }));
    this.group.add(this.fill);

    // laser drop-line to the floor
    this._lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()]);
    this.laser = new THREE.Line(this._lineGeo,
      new THREE.LineBasicMaterial({ color: C.color.blue, transparent: true, opacity: 0.6 }));
    scene.add(this.laser);

    // contact shadow ring on the floor
    this.contact = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 24),
      new THREE.MeshBasicMaterial({ color: C.color.blue, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide }));
    this.contact.rotation.x = -Math.PI / 2;
    scene.add(this.contact);

    // delete-target outline (pulsing red box)
    this.delOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: C.color.red, transparent: true, opacity: 0 }));
    scene.add(this.delOutline);

    this._pos = new THREE.Vector3();
    this._colBlue = new THREE.Color(C.color.blue);
    this._colOrange = new THREE.Color(C.color.orange);
    this._colRed = new THREE.Color(C.color.red);
    this._curCol = new THREE.Color(C.color.blue);
    this._shake = 0;
    this._t = 0;
  }

  // info: { placeCell, placeValid, deleteCell }, pinchProgress 0..1,
  // deleting: boolean (fist active)
  update(info, pinchProgress, deleting, dt) {
    this._t += dt;
    const visible = info && info.placeCell;
    this.group.visible = !!visible;
    this.laser.visible = !!visible;
    this.contact.visible = !!visible;

    if (visible) {
      this.field.worldCenter(info.placeCell, this._pos);
      // invalid -> jitter the reticle
      this._shake = info.placeValid ? damp(this._shake, 0, 12, dt) : 0.05;
      const jx = (Math.random() - 0.5) * this._shake;
      const jz = (Math.random() - 0.5) * this._shake;
      this.group.position.set(this._pos.x + jx, this._pos.y, this._pos.z + jz);

      // colour: blue (idle) -> orange (valid, filling) or red (invalid)
      const targetCol = !info.placeValid ? this._colRed
        : this._curCol.clone().copy(this._colBlue).lerp(this._colOrange, pinchProgress);
      this._curCol.lerp(targetCol, 1 - Math.pow(0.001, dt));

      // morph: dot shrinks, wire fades in, fill fills with pinch
      const p = pinchProgress;
      this.dot.scale.setScalar(1 - p * 0.7);
      this.dot.material.color.copy(this._curCol);
      this.dot.material.opacity = 0.95 * (1 - p * 0.8);

      this.wire.material.color.copy(this._curCol);
      this.wire.material.opacity = Math.min(1, 0.25 + p * 0.9) * (info.placeValid ? 1 : 0.9);
      this.wire.scale.setScalar(0.6 + p * 0.42);

      this.fill.material.opacity = info.placeValid ? p * 0.85 : 0;
      this.fill.scale.setScalar(0.6 + p * 0.4);

      // laser drop-line + contact ring at floor
      this._lineGeo.setFromPoints([
        new THREE.Vector3(this._pos.x, this._pos.y, this._pos.z),
        new THREE.Vector3(this._pos.x, 0.01, this._pos.z)]);
      this._lineGeo.attributes.position.needsUpdate = true;
      this.laser.material.color.copy(this._curCol);
      this.contact.position.set(this._pos.x, 0.02, this._pos.z);
      this.contact.material.color.copy(this._curCol);
      const pulse = 0.4 + 0.15 * Math.sin(this._t * 6);
      this.contact.material.opacity = pulse;
    }

    // delete-target outline
    const showDel = deleting && info && info.deleteCell;
    this.delOutline.visible = !!showDel;
    if (showDel) {
      this.field.worldCenter(info.deleteCell, this._pos);
      this.delOutline.position.copy(this._pos);
      this.delOutline.material.opacity = 0.5 + 0.5 * Math.sin(this._t * 12);
    }
  }
}
