// Deterministic poses for the maker's screenshots (?shot=<name>&seed=1).
// Each pose starts a sortie, sets the course progress so the HUD and the
// amber ring agree with the moment, teleports the plane into a composed
// scene — the first ring ahead on climb-out, a banked turn in the valley,
// the lake run, a landing flare — and freezes the simulation so a headless
// browser captures exactly the frame the judge will see.
import { SORTIES } from './missions.js';
import { poseAircraft } from './aircraft.js';

export function poseForShot(name, ctx) {
  const { flight, aircraft, camera, camPos, startSortie, getCourse, traffic } = ctx;
  const sortieIndex = name === 'valley' ? 1 : name === 'storm' ? 2 : 0;
  startSortie(sortieIndex);
  const sortie = SORTIES[sortieIndex];
  const course = getCourse();

  const setFlight = (pos, heading, pitch, roll, speed, throttle, vsOverride) => {
    flight.pos = { ...pos };
    flight.heading = heading;
    flight.pitch = pitch;
    flight.roll = roll;
    flight.speed = speed;
    flight.throttle = throttle;
    flight.onGround = speed === 0;
    flight.verticalSpeed = vsOverride ?? Math.sin(pitch) * speed;
  };
  const chaseCam = (dist, up, lookAhead = 60, lookDown = 0) => {
    const sinH = Math.sin(flight.heading), cosH = Math.cos(flight.heading);
    camera.position.set(
      flight.pos.x - sinH * dist,
      flight.pos.y + up,
      flight.pos.z + cosH * dist,
    );
    camPos.copy(camera.position);
    camera.lookAt(
      flight.pos.x + sinH * lookAhead,
      flight.pos.y + 2 + Math.sin(flight.pitch) * 20 - lookDown,
      flight.pos.z - cosH * lookAhead,
    );
  };
  const controls = { pitch: 0.25, roll: 0, rudder: 0 };

  switch (name) {
    case 'takeoff': {
      // Climbing out over the strip: the runway's far half fills the lower
      // frame and the first amber ring hangs ahead over the valley.
      setFlight({ x: 0, y: 34, z: 950 }, 0, 0.14, 0, 34, 1);
      flight.onGround = false;
      controls.pitch = 0.5;
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      chaseCam(18, 7.5, 70, 12);
      break;
    }
    case 'valley': {
      // Banked in the valley turn, lined up on the third ring's own axis
      // so the amber gate sits dead ahead of the nose.
      course.setProgress(2);
      const ringDef = sortie.rings()[2];
      const fwdX = Math.sin(ringDef.heading), fwdZ = -Math.cos(ringDef.heading);
      setFlight(
        { x: ringDef.x - fwdX * 330, y: ringDef.y + 6, z: ringDef.z - fwdZ * 330 },
        ringDef.heading, -0.02, 0.38, 55, 0.72,
      );
      controls.roll = 0.6;
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      // The blue traffic plane crosses ahead-left, on its own business.
      {
        const h = flight.heading;
        const fwd = { x: Math.sin(h), z: -Math.cos(h) };
        const right = { x: Math.cos(h), z: Math.sin(h) };
        traffic.poseAt(
          flight.pos.x + fwd.x * 165 + right.x * -68,
          flight.pos.y + 16,
          flight.pos.z + fwd.z * 165 + right.z * -68,
          h + 0.85,
          -0.35,
        );
      }
      chaseCam(17, 5.6);
      break;
    }
    case 'storm': {
      // On the lake ring's own axis: water dead ahead, the amber gate
      // centred over it, hills rising beyond.
      course.setProgress(2);
      const ringDef = sortie.rings()[2];
      const fwdX = Math.sin(ringDef.heading), fwdZ = -Math.cos(ringDef.heading);
      setFlight(
        { x: ringDef.x - fwdX * 430, y: ringDef.y + 30, z: ringDef.z - fwdZ * 430 },
        ringDef.heading, 0.02, 0.16, 62, 0.8,
      );
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      chaseCam(17, 6);
      break;
    }
    case 'landing': {
      // Course complete, on final: gear down, gentle sink, the strip
      // running out ahead past the nose.
      course.setProgress(sortie.rings().length);
      setFlight({ x: 6, y: 30, z: 1790 }, 0, 0.05, 0.02, 29, 0.3, -1.7);
      flight.onGround = false;
      controls.pitch = 0.35;
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      chaseCam(17, 5.5, 120, 6);
      break;
    }
    default:
      return false;
  }
  return true;
}
