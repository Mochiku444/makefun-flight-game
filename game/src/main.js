// Summit Air — boot, game loop and the sortie state machine.
// States: title (pick a sortie) -> flying -> debrief. The loop steps the
// flight model, burns fuel, applies wind, watches for ring passes, landings
// and crashes, poses the aircraft and the chase camera, and feeds the HUD.
import * as THREE from 'three';
import { Input } from './input.js';
import { FlightModel } from './flight.js';
import { buildWorld, groundAt, WORLD, applyAtmosphere, followSky } from './world.js';
import { buildAircraft, poseAircraft } from './aircraft.js';
import { RingCourse } from './rings.js';
import { SORTIES, SPAWN, scoreSortie } from './missions.js';
import { Hud } from './hud.js';
import { SoundEngine } from './audio.js';
import { Traffic } from './traffic.js';
import { poseForShot } from './shots.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 9000);

const { sun } = buildWorld(scene);
// The shadow camera rides along with the aircraft: the light keeps its
// bearing but re-centres on the plane, so shadows stay crisp anywhere.
const SUN_OFF = new THREE.Vector3(-1400, 2100, -900).normalize().multiplyScalar(1500);
const SUN_OFF_LOW = new THREE.Vector3(-2600, 640, -1400).normalize().multiplyScalar(1500);
function followSun(low) {
  const off = low ? SUN_OFF_LOW : SUN_OFF;
  sun.position.set(flight.pos.x + off.x, flight.pos.y + off.y, flight.pos.z + off.z);
  sun.target.position.set(flight.pos.x, flight.pos.y, flight.pos.z);
}
const aircraft = buildAircraft();
scene.add(aircraft.group);
const traffic = new Traffic(scene);

const input = new Input();
const hud = new Hud();
const sound = new SoundEngine();
const flight = new FlightModel(SPAWN);

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');

let state = 'title'; // 'title' | 'flying' | 'debrief'
let sortie = null;
let course = null;
let run = null; // per-sortie mutable state
let cameraMode = 'chase'; // 'chase' | 'cockpit' | 'orbit'
let lastTime = performance.now();
let elapsed = 0;

const titleScreen = document.getElementById('title-screen');
const debriefScreen = document.getElementById('debrief');
const sortieList = document.getElementById('sortie-list');
SORTIES.forEach((s, i) => {
  const card = document.createElement('div');
  card.className = 'sortie-card';
  card.innerHTML = `<h3>${s.name}</h3><p>${s.blurb}</p><div class="s-meta">${s.meta}</div>`;
  card.addEventListener('click', () => startSortie(i));
  sortieList.appendChild(card);
});

function startSortie(index) {
  sortie = SORTIES[index];
  applyAtmosphere(scene, sortie.id === 'storm-freight' ? 'storm' : 'day');
  if (course) course.dispose(scene);
  course = new RingCourse(scene, sortie.rings());
  flight.reset(SPAWN);
  run = {
    fuel: sortie.fuel,
    hull: 1,
    timeSec: 0,
    airborne: false,
    landed: false,
    streak: 0, // rings cleared inside the streak window
    streakTimer: 0, // seconds left in the window
    streakBest: 0,
    streakBonus: 0, // points banked by streaks
    prevPos: { ...flight.pos },
    stallWarnedAt: -9,
    startWall: performance.now(),
  };
  state = 'flying';
  titleScreen.classList.add('hidden');
  debriefScreen.classList.add('hidden');
  hud.show();
  hud.message(sortie.briefing, 3.4);
  sound.ensure();
}

function endSortie(crashed) {
  state = 'debrief';
  const result = {
    ringsCleared: course.clearedCount,
    timeSec: run.timeSec,
    fuelLeft: run.fuel,
    hull: run.hull,
    streakBonus: run.streakBonus,
    streakBest: run.streakBest,
  };
  const score = scoreSortie(sortie, result);
  document.getElementById('debrief-title').textContent = crashed
    ? 'AIRCRAFT DOWN'
    : 'SORTIE COMPLETE';
  const rows = [
    ['Rings', `${result.ringsCleared} of ${course.total} — ${score.ringPoints} pts`],
    ['Streak', `best ×${result.streakBest} — ${score.streakBonus} pts`],
    ['Time', `${Math.round(result.timeSec)} s — bonus ${score.timeBonus} pts`],
    ['Fuel left', `${Math.round(result.fuelLeft * 100)}% — ${score.fuelBonus} pts`],
    ['Hull', `${Math.round(result.hull * 100)}% — penalty ${score.hullPenalty} pts`],
    ['TOTAL', `${score.total} pts`],
  ];
  document.getElementById('debrief-rows').innerHTML = rows
    .map(([k, v]) => `<div><span class="row-label">${k}</span>${v}</div>`)
    .join('');
  debriefScreen.classList.remove('hidden');
  hud.hide();
  if (!crashed) sound.thump();
}

function backToTitle() {
  state = 'title';
  if (course) {
    course.dispose(scene);
    course = null;
  }
  flight.reset(SPAWN);
  titleScreen.classList.remove('hidden');
  debriefScreen.classList.add('hidden');
  hud.hide();
}

input.onAction = (action) => {
  sound.ensure();
  if (action === 'sortie1' || action === 'sortie2' || action === 'sortie3') {
    if (state === 'title') startSortie(Number(action.slice(-1)) - 1);
  } else if (action === 'confirm') {
    if (state === 'debrief') startSortie(SORTIES.indexOf(sortie));
  } else if (action === 'menu') {
    if (state !== 'title') backToTitle();
  } else if (action === 'restart') {
    if (state === 'flying' || state === 'debrief') startSortie(SORTIES.indexOf(sortie));
  } else if (action === 'camera') {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : cameraMode === 'cockpit' ? 'orbit' : 'chase';
    hud.message(`Camera: ${cameraMode}`, 1.2);
  } else if (action === 'gear') {
    if (state === 'flying') {
      flight.gearDown = !flight.gearDown;
      hud.message(flight.gearDown ? 'Gear down' : 'Gear up', 1.1);
    }
  } else if (action === 'mute') {
    hud.message(sound.toggleMute() ? 'Sound off' : 'Sound on', 1.1);
  }
};

function stepFlying(dt, controls) {
  run.prevPos = { ...flight.pos };
  const ground = groundAt(flight.pos.x, flight.pos.z);
  flight.step(dt, controls, ground);

  // Crosswind with gusts on the storm sortie.
  if (sortie.wind > 0 && !flight.onGround) {
    const gust = Math.sin(elapsed * 0.7) * 0.45 + Math.sin(elapsed * 2.3) * 0.2;
    flight.pos.x += sortie.wind * (1 + gust) * dt;
  }

  // Fuel: the engine drinks in proportion to throttle; an empty tank glides.
  if (flight.throttle > 0 && run.fuel > 0) {
    run.fuel -= dt * (0.0035 + flight.throttle * 0.010);
    if (run.fuel <= 0) {
      run.fuel = 0;
      flight.throttle = 0;
      hud.message('TANK DRY — glide for the field', 3);
    }
  }

  if (!flight.onGround) {
    run.airborne = true;
    run.timeSec += dt;
  }

  // Ring streaks: clearing a ring opens a 25-second window; clear the
  // next inside it and the streak grows, banking bonus points — skill
  // converted into a resource, the way a long drift charges a turbo.
  if (run.streakTimer > 0) {
    run.streakTimer -= dt;
    if (run.streakTimer <= 0) run.streak = 0;
  }
  const pass = course.check(flight, run.prevPos);
  if (pass === 'cleared') {
    run.streak = run.streakTimer > 0 ? run.streak + 1 : 1;
    run.streakTimer = 25;
    run.streakBest = Math.max(run.streakBest, run.streak);
    run.streakBonus += 30 * (run.streak - 1);
    sound.ringCleared();
    if (course.done) hud.message('Final ring!', 1.6);
    else if (run.streak >= 2) hud.message(`STREAK ×${run.streak} — +${30 * (run.streak - 1)} pts`, 1.6);
    else hud.message(`Ring ${course.clearedCount} cleared`, 1.6);
  }

  if (flight.stalled && elapsed - run.stallWarnedAt > 4) {
    run.stallWarnedAt = elapsed;
    sound.warning();
    hud.message('STALL', 0.9);
  }

  if (flight.crashed) {
    run.hull = Math.max(0, run.hull - 0.55);
    sound.thump();
    endSortie(true);
    return;
  }

  // A sortie ends when the plane is back on the runway, slow, after flying.
  if (run.airborne && flight.onGround && ground.onRunway && flight.speed < 3) {
    run.landed = true;
    if (course.done) {
      endSortie(false);
    } else if (!run.landingWarned) {
      run.landingWarned = true;
      hud.message(`Landed with ${course.total - course.clearedCount} rings still out`, 2.6);
    }
  }
  // Rolling off the runway's end or stopping on grass also ends the day.
  if (run.airborne && flight.onGround && !ground.onRunway && flight.speed < 3 && !flight.crashed) {
    run.hull = Math.max(0, run.hull - 0.2);
    endSortie(true);
  }
}

const camPos = new THREE.Vector3(0, 30, 1560);
function updateCamera(dt) {
  const p = flight.pos;
  const sinH = Math.sin(flight.heading), cosH = Math.cos(flight.heading);
  if (cameraMode === 'cockpit') {
    // From the pilot's seat: the lit panel and canopy frame are part of
    // the aircraft, so the camera rides the airframe's own transform.
    aircraft.group.visible = true;
    aircraft.cockpit.visible = true;
    aircraft.canopy.visible = false;
    aircraft.group.updateMatrixWorld();
    const head = aircraft.group.localToWorld(new THREE.Vector3(0, 1.25, -2.0));
    const aim = aircraft.group.localToWorld(new THREE.Vector3(0, -6, -80));
    camera.position.copy(head);
    camPos.copy(head);
    camera.lookAt(aim);
    return;
  }
  aircraft.cockpit.visible = false;
  aircraft.canopy.visible = true;
  aircraft.group.visible = true;
  if (cameraMode === 'orbit' || state === 'title') {
    const t = elapsed * 0.11;
    const radius = state === 'title' ? 26 : 30;
    const cx = p.x + Math.sin(t) * radius;
    const cz = p.z + Math.cos(t) * radius;
    camPos.lerp(new THREE.Vector3(cx, p.y + 8, cz), 1 - Math.pow(0.0015, dt));
    camera.position.copy(camPos);
    camera.lookAt(p.x, p.y + 2, p.z);
    return;
  }
  // Chase: settle behind and above the tail, easing with the bank.
  const back = 15.5, up = 5.2;
  const target = new THREE.Vector3(
    p.x - sinH * back * Math.cos(flight.pitch),
    p.y + up + Math.sin(flight.pitch) * back * 0.4,
    p.z + cosH * back * Math.cos(flight.pitch),
  );
  camPos.lerp(target, 1 - Math.pow(0.0001, dt));
  camera.position.copy(camPos);
  camera.lookAt(
    p.x + sinH * 60,
    p.y + 2.2 + Math.sin(flight.pitch) * 22,
    p.z - cosH * 60,
  );
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// Screenshot mode: pose a deterministic scene and hold it for the camera.
if (shotMode) {
  titleScreen.classList.add('hidden');
  hud.show();
  const shot = poseForShot(shotMode, {
    flight, aircraft, camera, camPos, startSortie,
    getCourse: () => course, traffic,
    setAtmosphere: (kind) => applyAtmosphere(scene, kind),
  });
  if (shot) {
    state = 'flying';
    if (shotMode === 'cockpit') {
      aircraft.cockpit.visible = true;
      aircraft.canopy.visible = false;
    }
    followSun(shotMode === 'cover' || shotMode === 'landing');
    followSky(camera);
    course.refreshColours(1);
    hud.update(0.016, flight, sortie, course, run); // fill the instruments once
    hud.messageEl.style.opacity = '0'; // no briefing banner across the photo
    document.title = `Summit Air — shot ${shotMode}`;
  }
}

// A small handle for automated play-testing (harmless in play).
window.__summitAir = { flight, traffic, getState: () => state, getCourse: () => course, getRun: () => run };

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  lastTime = now;
  elapsed += dt;

  const controls = input.read(dt);
  if (shotMode) {
    // The shot pose is frozen: render it exactly as composed.
    renderer.render(scene, camera);
    return;
  }
  if (state === 'flying') {
    stepFlying(dt, controls);
  }
  followSun(false);
  followSky(camera);
  if (state !== 'title') {
    poseAircraft(aircraft, flight, controls, dt, elapsed);
    traffic.update(dt, elapsed);
    if (course) course.refreshColours(elapsed);
    updateCamera(dt);
    if (state === 'flying') hud.update(dt, flight, sortie, course, run);
    sound.update(flight, dt);
  } else {
    // Title: the plane waits on the runway under a slow orbit, and the
    // traffic plane keeps flying its circuit behind the menu.
    poseAircraft(aircraft, flight, { pitch: 0, roll: 0, rudder: 0 }, dt, elapsed);
    traffic.update(dt, elapsed);
    updateCamera(dt);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
