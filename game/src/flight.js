// The flight model: an arcade-but-honest simulation of a small prop plane.
// State is position (metres), heading/pitch/roll (radians), speed (m/s) and
// throttle (0..1). Lift fades near the stall, a banked wing turns the plane,
// drag grows with the square of speed, and the ground is always honest.
export const PLANE = {
  maxSpeed: 92, // m/s at full throttle, level
  minThrottleSpeed: 0,
  stallSpeed: 21, // m/s; below this the nose drops and the wing stops holding
  rotateSpeed: 24, // m/s; enough to lift off with a firm pull
  accel: 9.5, // m/s^2 the engine can add before drag
  pitchRate: 0.85, // rad/s of commanded pitch change
  rollRate: 1.9, // rad/s of commanded bank change
  maxBank: 1.05, // rad, about 60 degrees
  maxPitch: 0.62, // rad, about 35 degrees
  gravity: 9.81,
};

export class FlightModel {
  constructor(spawn) {
    this.reset(spawn);
  }

  reset(spawn) {
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.heading = spawn.heading; // rad, 0 = north (-Z), clockwise from above
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.gearDown = true;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.crashed = false;
    this.stalled = false;
  }

  // Advance one step. input: {pitch, roll, throttleDelta, brake, rudder}.
  // groundHeight: terrain height under the plane; runway: {top} when over the strip.
  step(dt, input, ground) {
    if (this.crashed) return;

    this.throttle = clamp(this.throttle + input.throttleDelta, 0, 1);

    // Bank toward the commanded roll; the wing answers faster with airflow.
    const authority = clamp(this.speed / 30, 0.25, 1);
    const targetRoll = input.roll * PLANE.maxBank;
    this.roll += clamp(targetRoll - this.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);

    // Pitch toward the commanded attitude; a stalled wing cannot hold the nose.
    this.stalled = !this.onGround && this.speed < PLANE.stallSpeed;
    const targetPitch = input.pitch * PLANE.maxPitch;
    this.pitch += clamp(targetPitch - this.pitch, -PLANE.pitchRate * dt * authority, PLANE.pitchRate * dt * authority);
    if (this.stalled) this.pitch -= 0.55 * dt; // the nose falls through

    // A banked wing turns the nose; rudder helps a little on the ground and in slow flight.
    const turnRate = Math.sin(this.roll) * (PLANE.gravity / Math.max(this.speed, 12)) * 1.15;
    this.heading += turnRate * dt + input.rudder * 0.25 * dt * (this.onGround ? 1 : 0.3);

    // Thrust against quadratic drag, gravity along the flight path.
    const thrust = this.throttle * PLANE.accel * 2.4;
    const drag = 0.0026 * this.speed * this.speed + (input.brake ? 2.6 : 0);
    const slope = -Math.sin(this.pitch) * PLANE.gravity * 0.92;
    this.speed += (thrust - drag + slope) * dt;
    if (this.onGround && input.brake) this.speed -= 14 * dt;
    this.speed = clamp(this.speed, 0, 130);

    // Velocity: forward in the heading/pitch plane; lift holds altitude only
    // while the wing is flying, otherwise gravity takes its share.
    const fx = Math.sin(this.heading) * Math.cos(this.pitch);
    const fz = -Math.cos(this.heading) * Math.cos(this.pitch);
    let vy = Math.sin(this.pitch) * this.speed;
    if (!this.onGround) {
      const liftFactor = clamp((this.speed - 12) / (PLANE.stallSpeed - 12), 0, 1);
      vy -= (1 - liftFactor) * 4.5; // a slow wing sinks
      if (this.stalled) vy -= 3.2;
    }
    this.verticalSpeed = vy;

    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;

    // Ground contact. While rolling, the gear holds the plane at floor
    // height; altitude only integrates once the wing has lifted it off.
    const floor = ground.height;
    if (this.onGround) {
      this.pos.y = floor;
      this.verticalSpeed = 0;
      if (this.pitch < 0) this.pitch = 0;
      if (this.speed > PLANE.rotateSpeed && this.pitch > 0.06) {
        this.onGround = false; // lift-off: the next step integrates altitude
      }
      if (this.speed < 2 && this.throttle === 0) this.speed = 0;
      return;
    }

    this.pos.y += vy * dt;
    if (this.pos.y <= floor) {
      this.pos.y = floor;
      // The touchdown moment: terrain is not a runway, and arriving too
      // hard or too banked bends the aeroplane.
      const hardHit = vy < -7.5 || Math.abs(this.roll) > 0.5;
      if (!ground.onRunway || hardHit) {
        this.crashed = true;
      } else {
        this.onGround = true;
        this.verticalSpeed = 0;
        if (this.pitch < 0) this.pitch = 0;
      }
    }
  }

  get speedKnots() {
    return this.speed * 1.94384;
  }
  get altitudeFeet() {
    return this.pos.y * 3.28084;
  }
  get headingDegrees() {
    const deg = (this.heading * 180) / Math.PI;
    return ((deg % 360) + 360) % 360;
  }
  get verticalFpm() {
    return this.verticalSpeed * 196.85;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
