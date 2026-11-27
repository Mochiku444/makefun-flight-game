// The five sorties of Summit Air. Each is a small story with a decision in
// it: how much throttle to burn, how low to chase the rings, and whether the
// fuel left buys a careful approach or a glide home. Rings are placed over
// the valley's landmarks so the course itself teaches the terrain.
// Coordinates: x east, z south, y up; heading 0 faces north (-Z).
import { WORLD, LIGHTHOUSE, terrainHeight } from './world.js';

function ring(x, y, z, headingDeg) {
  return { x, y, z, heading: (headingDeg * Math.PI) / 180 };
}
function ringOver(x, z, heightAboveGround, headingDeg) {
  return ring(x, terrainHeight(x, z) + heightAboveGround, z, headingDeg);
}
// A ring at (x, z) whose gate faces the direction of travel toward (tx, tz) —
// used by the routed sorties so every gate is square to the leg that flies it.
function ringTo(x, z, heightAboveGround, tx, tz) {
  const headingDeg = (Math.atan2(tx - x, -(tz - z)) * 180) / Math.PI;
  return ringOver(x, z, heightAboveGround, headingDeg);
}

export const SORTIES = [
  {
    id: 'first-flight',
    name: 'SORTIE 1 — FIRST FLIGHT',
    blurb: 'Take off north, fly five rings over the home valley, and land back on the strip you left.',
    meta: '5 RINGS · FUEL 100% · CALM',
    fuel: 1,
    wind: 0,
    timePar: 240,
    rings: () => [
      ringOver(120, -350, 120, 0),
      ringOver(-420, -1050, 130, 340),
      ringOver(350, -1750, 150, 20),
      ringOver(1150, -1150, 140, 90),
      ringOver(500, -250, 120, 180),
    ],
    briefing: 'Throttle up, lift off, and chase the amber rings',
  },
  {
    id: 'valley-run',
    name: 'SORTIE 2 — VALLEY RUN',
    blurb: 'Eight rings threaded low down the Kestrel valley. The walls are close, the turns are banked, and altitude is a debt you repay in speed.',
    meta: '8 RINGS · FUEL 78% · LOW LEVEL',
    fuel: 0.78,
    wind: 0,
    timePar: 300,
    rings: () => [
      ringOver(-150, -500, 90, 350),
      ringOver(-880, -1150, 55, 0),
      ringOver(-980, -1650, 48, 10),
      ringOver(-900, -2150, 60, 355),
      ringOver(-1010, -1000, 70, 180),
      ringOver(-700, -350, 95, 170),
      ringOver(150, 150, 110, 180),
      ringOver(60, 620, 90, 180),
    ],
    briefing: 'Drop into the valley west of the field — rings hug the floor',
  },
  {
    id: 'storm-freight',
    name: 'SORTIE 3 — STORM FREIGHT',
    blurb: 'A mail run to the lake and back with a crosswind that pushes you off every heading. Heavy tanks, gusty air, and a landing that earns its keep.',
    meta: '7 RINGS · FUEL 64% · CROSSWIND',
    fuel: 0.64,
    wind: 6.5, // m/s crosswind from the west, with gusts
    atmo: 'storm',
    timePar: 330,
    atcStart: 'Kestrel Tower — Summit 1, wind west gusting, cleared for takeoff',
    atcLand: 'Kestrel Tower — Summit 1, cleared to land, mind the crosswind',
    rings: () => [
      ringOver(500, -600, 130, 30),
      ringOver(1250, -1250, 150, 45),
      ringOver(1650, -1750, 120, 60), // over the lake
      ringOver(1950, -1100, 160, 140),
      ringOver(1300, -300, 140, 200),
      ringOver(420, 250, 110, 190),
      ringOver(40, 700, 85, 180),
    ],
    briefing: 'Wind is up from the west — crab into it and watch the fuel',
  },
  {
    id: 'cliff-runner',
    name: 'SORTIE 4 — CLIFF RUNNER',
    blurb: 'A high line along the rim where the valley falls away. Seven gates ride the cliff edge south — altitude is safety, and the view is the pay.',
    meta: '7 RINGS · FUEL 85% · HIGH LINE',
    fuel: 0.85,
    wind: 0,
    timePar: 360,
    atcStart: 'Kestrel Tower — Summit 1, cleared for takeoff, the rim is yours',
    atcLand: 'Kestrel Tower — Summit 1, cleared to land',
    rings: () => [
      ringTo(-350, -1900, 150, -1500, -2100),
      ringTo(-1500, -2100, 90, -2150, -1400),
      ringTo(-2150, -1400, 75, -2250, -500),
      ringTo(-2250, -500, 70, -2050, 350),
      ringTo(-2050, 350, 80, -1500, 950),
      ringTo(-1500, 950, 110, -500, 700),
      ringTo(-500, 700, 100, 0, 1070),
    ],
    briefing: 'Climb north-west and pick up the rim — gates ride the cliff edge',
  },
  {
    id: 'dusk-courier',
    name: 'SORTIE 5 — DUSK COURIER',
    blurb: 'The evening post at golden hour: out over the fields, a low drop on the village green, a wave at Kestrel Light, and home before dark.',
    meta: '6 RINGS · FUEL 80% · DUSK DROP',
    fuel: 0.8,
    wind: 0,
    atmo: 'golden',
    timePar: 330,
    dropAt: 2, // the village ring: clearing it drops the parcel
    atcStart: 'Kestrel Tower — Summit 1, evening post, cleared for takeoff',
    atcLand: 'Kestrel Tower — Summit 1, cleared to land, light fading',
    rings: () => [
      ringTo(700, -800, 130, 1250, -1300),
      ringTo(1250, -1300, 110, 1220, -1420),
      ringTo(1220, -1420, 26, LIGHTHOUSE.x, LIGHTHOUSE.z), // low over the village green
      ringTo(LIGHTHOUSE.x, LIGHTHOUSE.z, 58, 1300, -500), // past Kestrel Light
      ringTo(1300, -500, 130, 450, 300),
      ringTo(450, 300, 100, 0, 1070),
    ],
    briefing: 'Evening post — drop the parcel on the village green, home by dark',
  },
];

// Scoring for the debrief: rings and time against par, minus the cost of
// bent metal and a dry tank. A sortie only counts when it ends in a landing.
export function scoreSortie(sortie, result) {
  const ringPoints = result.ringsCleared * 120;
  const streakBonus = result.streakBonus ?? 0;
  const timeBonus = Math.max(0, Math.round((sortie.timePar - result.timeSec) * 1.5));
  const fuelBonus = Math.round(result.fuelLeft * 220);
  const hullPenalty = Math.round((1 - result.hull) * 300);
  const total = Math.max(0, ringPoints + streakBonus + timeBonus + fuelBonus - hullPenalty);
  return { ringPoints, streakBonus, timeBonus, fuelBonus, hullPenalty, total };
}

export const SPAWN = { x: WORLD.spawn.x, y: 0, z: WORLD.spawn.z, heading: WORLD.spawn.heading };
