// The three sorties of Summit Air. Each is a small story with a decision in
// it: how much throttle to burn, how low to chase the rings, and whether the
// fuel left buys a careful approach or a glide home. Rings are placed over
// the valley's landmarks so the course itself teaches the terrain.
// Coordinates: x east, z south, y up; heading 0 faces north (-Z).
import { WORLD, terrainHeight } from './world.js';

function ring(x, y, z, headingDeg) {
  return { x, y, z, heading: (headingDeg * Math.PI) / 180 };
}
function ringOver(x, z, heightAboveGround, headingDeg) {
  return ring(x, terrainHeight(x, z) + heightAboveGround, z, headingDeg);
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
    timePar: 330,
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
];

// Scoring for the debrief: rings and time against par, minus the cost of
// bent metal and a dry tank. A sortie only counts when it ends in a landing.
export function scoreSortie(sortie, result) {
  const ringPoints = result.ringsCleared * 120;
  const timeBonus = Math.max(0, Math.round((sortie.timePar - result.timeSec) * 1.5));
  const fuelBonus = Math.round(result.fuelLeft * 220);
  const hullPenalty = Math.round((1 - result.hull) * 300);
  const total = Math.max(0, ringPoints + timeBonus + fuelBonus - hullPenalty);
  return { ringPoints, timeBonus, fuelBonus, hullPenalty, total };
}

export const SPAWN = { x: WORLD.spawn.x, y: 0, z: WORLD.spawn.z, heading: WORLD.spawn.heading };
