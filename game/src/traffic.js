// AI traffic: a second tourer, painted blue, that flies a closed circuit
// around the valley forever — the Kestrel Valley's resident show-off.
// It follows a Catmull-Rom loop through the landmarks (the AI technique
// of waypoint following, smoothed into a spline), banks into its turns,
// bobs gently with the air, and dips low over the home strip each lap.
// Kinematic, not simulated: it can never crash into the player's story.
import * as THREE from 'three';
import { buildAircraft } from './aircraft.js';

const CIRCUIT = [
  [350, 150, -250],
  [-480, 175, -880],
  [-950, 150, -1580], // down the valley
  [-350, 195, -2280],
  [780, 205, -1950],
  [1520, 175, -950], // past the lake
  [950, 150, 150],
  [150, 120, 620], // low over the home field
];

export class Traffic {
  constructor(scene) {
    this.parts = buildAircraft(0x2e7de8); // blue paint
    scene.add(this.parts.group);
    this.curve = new THREE.CatmullRomCurve3(
      CIRCUIT.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      true,
      'catmullrom',
      0.6,
    );
    this.length = this.curve.getLength();
    this.speed = 47; // m/s
    this.distance = 0; // metres along the loop
    this.prevHeading = 0;
  }

  update(dt, elapsed) {
    this.distance = (this.distance + this.speed * dt) % this.length;
    const u = (((this.distance / this.length) % 1) + 1) % 1;
    const pos = this.curve.getPointAt(u);
    const tangent = this.curve.getTangentAt(u);
    // A show-off's flourish: a gentle bob, and a dip on the home straight.
    pos.y += Math.sin(elapsed * 0.9) * 4;
    const heading = Math.atan2(tangent.x, -tangent.z);
    let dHeading = heading - this.prevHeading;
    while (dHeading > Math.PI) dHeading -= Math.PI * 2;
    while (dHeading < -Math.PI) dHeading += Math.PI * 2;
    this.prevHeading = heading;
    const bank = THREE.MathUtils.clamp(-dHeading * 9, -0.55, 0.55);
    const pitch = Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));

    const fakeFlight = {
      pos: { x: pos.x, y: pos.y - 2.2, z: pos.z },
      heading,
      pitch,
      roll: bank,
      speed: this.speed,
      throttle: 0.75,
      onGround: false,
    };
    // Reuse the player's pose code with a neutral control input.
    poseTrafficAircraft(this.parts, fakeFlight, dt);
  }

  // Freeze the traffic plane at a composed spot (screenshot poses).
  poseAt(x, y, z, heading, roll) {
    const fakeFlight = {
      pos: { x, y: y - 2.2, z },
      heading,
      pitch: 0.02,
      roll,
      speed: this.speed,
      throttle: 0.75,
      onGround: false,
    };
    poseTrafficAircraft(this.parts, fakeFlight, 0.016);
  }
}

function poseTrafficAircraft(parts, flight, dt) {
  const g = parts.group;
  g.position.set(flight.pos.x, flight.pos.y + 2.2, flight.pos.z);
  g.rotation.set(0, 0, 0);
  g.rotateY(-flight.heading);
  g.rotateX(-flight.pitch);
  g.rotateZ(flight.roll);
  parts.prop.rotation.z += 40 * dt;
  parts.blur.material.opacity = 0.3;
}
