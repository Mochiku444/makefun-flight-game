// Deterministic poses for the maker's screenshots (?shot=<name>&seed=1).
// Each pose starts a sortie, sets the course progress so the HUD and the
// amber ring agree with the moment, teleports the plane into a composed
// scene — the first ring ahead on climb-out, a banked turn in the valley,
// the lake run, a landing flare — and freezes the simulation so a headless
// browser captures exactly the frame the judge will see.
import * as THREE from 'three';
import { SORTIES } from './missions.js';
import { poseAircraft } from './aircraft.js';

export function poseForShot(name, ctx) {
  const { flight, aircraft, camera, camPos, startSortie, getCourse, traffic, setAtmosphere, getRun, finishSortie } = ctx;
  const sortieIndex = name === 'valley' ? 1 : name === 'storm' ? 2 : name === 'debrief' ? 4 : 0;
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
    case 'cover': {
      // Golden-hour climb-out over the home strip: runway, hangar and
      // tower below, the fields, dirt road and village spreading east,
      // the first amber ring ahead and the rim peaks on the horizon —
      // the whole game in one frame.
      setAtmosphere('golden');
      setFlight({ x: 0, y: 42, z: 1150 }, 0, 0.13, 0.06, 36, 1);
      flight.onGround = false;
      controls.pitch = 0.5;
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      traffic.poseAt(230, 95, 480, -1.1, 0.12);
      chaseCam(16, 6, 80, 3);
      break;
    }
    case 'cockpit': {
      // From the pilot's seat on final: lit gauges, canopy frame, the
      // strip running out ahead past the nose.
      course.setProgress(sortie.rings().length);
      setFlight({ x: 5, y: 30, z: 1830 }, 0, -0.02, 0.02, 30, 0.32, -1.6);
      flight.onGround = false;
      controls.pitch = 0.3;
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      aircraft.group.updateMatrixWorld();
      const head = aircraft.group.localToWorld(new THREE.Vector3(0, 1.32, -1.85));
      const aim = aircraft.group.localToWorld(new THREE.Vector3(0, -25, -80));
      camera.position.copy(head);
      camPos.copy(head);
      camera.lookAt(aim);
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
      // On the lake run, swung toward the south-east shore: the amber
      // gate rides left of the nose, Kestrel Light stands on its headland
      // to the right, and the whole lake spreads below in the murk.
      course.setProgress(2);
      const ringDef = sortie.rings()[2];
      setFlight(
        { x: 1381, y: ringDef.y - 6, z: -1456 },
        ringDef.heading, 0.02, 0.3, 62, 0.8,
      );
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      chaseCam(16, 5.4);
      break;
    }
    case 'landing': {
      // Course complete, on final at golden hour: gear down, gentle
      // sink, long shadows on the strip running out ahead.
      setAtmosphere('golden');
      course.setProgress(sortie.rings().length);
      setFlight({ x: 6, y: 30, z: 1790 }, 0, 0.05, 0.02, 29, 0.3, -1.7);
      flight.onGround = false;
      controls.pitch = 0.35;
      poseAircraft(aircraft, flight, controls, 0.016, 1);
      chaseCam(15.5, 4.8, 120, 6);
      break;
    }
    case 'debrief': {
      // The dusk courier brought home: a fabricated completed run (all
      // six rings, a streak, a SMOOTH touchdown) run through the game's
      // own debrief path, the panel lifted just enough to let the dusk
      // field and the parked plane show around its edges.
      course.setProgress(sortie.rings().length);
      const run = getRun();
      run.timeSec = 262;
      run.fuel = 0.34;
      run.hull = 1;
      run.streakBest = 3;
      run.streakBonus = 90;
      run.airborne = true;
      flight.touchdownVy = -1.1; // 220 fpm — a SMOOTH arrival
      setFlight({ x: 0, y: 0, z: 900 }, 0, 0, 0, 0, 0);
      poseAircraft(aircraft, flight, { pitch: 0, roll: 0, rudder: 0 }, 0.016, 1);
      camera.position.set(21, 7, 860);
      camPos.copy(camera.position);
      camera.lookAt(0, 3, 905);
      document.getElementById('debrief').style.background =
        'radial-gradient(ellipse at 50% 35%, rgba(20, 48, 78, 0.58), rgba(5, 12, 22, 0.8))';
      finishSortie(false);
      break;
    }
    default:
      return false;
  }
  return true;
}
