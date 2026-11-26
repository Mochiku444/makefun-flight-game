// Target rings: glowing torus gates hung in the sky. A course is an ordered
// list of rings; the active ring burns amber and pulses, cleared rings turn
// green and fade, and the rest wait in pale blue. Passing through the disc
// (close to its plane, inside its radius) clears it.
import * as THREE from 'three';

export const RING_RADIUS = 17;

export class RingCourse {
  constructor(scene, definitions) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rings = definitions.map((def, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x9fc6e8, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 1.15, 10, 36), mat);
      mesh.position.set(def.x, def.y, def.z);
      mesh.rotation.y = Math.PI - def.heading; // torus normal matches the check's (sin h, -cos h)
      this.group.add(mesh);
      return { ...def, mesh, mat, cleared: false };
    });
    this.activeIndex = 0;
    this.refreshColours(0);
  }

  get active() {
    return this.rings[this.activeIndex] ?? null;
  }
  get clearedCount() {
    return this.rings.filter((r) => r.cleared).length;
  }
  get total() {
    return this.rings.length;
  }
  get done() {
    return this.activeIndex >= this.rings.length;
  }

  // Mark the first n rings cleared (used by the screenshot poses so the
  // HUD and the amber ring agree with the moment being photographed).
  setProgress(n) {
    this.rings.forEach((ring, i) => {
      ring.cleared = i < n;
    });
    this.activeIndex = n;
  }

  refreshColours(time) {
    this.rings.forEach((ring, i) => {
      if (ring.cleared) {
        ring.mat.color.setHex(0x53d769);
        ring.mat.opacity = 0.28;
      } else if (i === this.activeIndex) {
        ring.mat.color.setHex(0xffb02e);
        ring.mat.opacity = 0.95;
        const pulse = 1 + Math.sin(time * 4) * 0.03;
        ring.mesh.scale.setScalar(pulse);
      } else {
        ring.mat.color.setHex(0x9fc6e8);
        ring.mat.opacity = 0.55;
        ring.mesh.scale.setScalar(1);
      }
    });
  }

  // Check the plane against the active ring. Returns 'cleared' on a pass,
  // 'missed' when the plane crosses the ring's plane outside the disc.
  check(flight, prevPos) {
    const ring = this.active;
    if (!ring) return null;
    // Ring plane normal from its heading.
    const nx = Math.sin(ring.heading), nz = -Math.cos(ring.heading);
    const dPrev = (prevPos.x - ring.x) * nx + (prevPos.z - ring.z) * nz;
    const dNow = (flight.pos.x - ring.x) * nx + (flight.pos.z - ring.z) * nz;
    if (dPrev === 0 || dPrev * dNow > 0) return null; // plane not crossed yet
    // Crossing point: distance from the ring centre decides.
    const t = dPrev / (dPrev - dNow);
    const cx = prevPos.x + (flight.pos.x - prevPos.x) * t;
    const cy = prevPos.y + (flight.pos.y - prevPos.y) * t;
    const cz = prevPos.z + (flight.pos.z - prevPos.z) * t;
    const dist = Math.hypot(cx - ring.x, cy - ring.y, cz - ring.z);
    if (dist <= RING_RADIUS) {
      ring.cleared = true;
      this.activeIndex++;
      return 'cleared';
    }
    return 'missed';
  }

  // Bearing and distance to the active ring, for the HUD arrow.
  guidance(flight) {
    const ring = this.active;
    if (!ring) return null;
    const dx = ring.x - flight.pos.x;
    const dz = ring.z - flight.pos.z;
    const distance = Math.hypot(dx, dz, ring.y - flight.pos.y);
    const bearing = Math.atan2(dx, -dz); // rad, 0 = north
    let relative = bearing - flight.heading;
    while (relative > Math.PI) relative -= Math.PI * 2;
    while (relative < -Math.PI) relative += Math.PI * 2;
    return { distance, relative, dy: ring.y - flight.pos.y };
  }

  dispose(scene) {
    scene.remove(this.group);
    this.rings.forEach((r) => {
      r.mesh.geometry.dispose();
      r.mat.dispose();
    });
  }
}
