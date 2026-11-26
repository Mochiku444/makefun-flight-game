# makefun-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Mochiku444/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Mochiku444/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Summit Air** — a 3D flight game over the fictional Kestrel Valley, built with Three.js. Fly a single-engine tourer from a chase or cockpit camera: take off from the home strip, thread glowing target rings, manage fuel and hull, and land to bank the sortie. Three sorties with different goals — a first-flight circuit, a low valley run between the pines, and a crosswind freight run to the lake — over procedural terrain with a runway, hangar, control tower and lake. An honest arcade flight model (stall, banked turns, quadratic drag), a full instrument HUD with an artificial horizon, and procedural engine and wind sound. No build step: the game is plain static files under `game/`.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

## How it is put together

- `game/index.html` — the page and HUD; loads Three.js from `game/vendor/` via an import map, no network requests
- `game/src/flight.js` — the flight model: thrust, drag, stall, banked turns, ground handling
- `game/src/world.js` — procedural terrain (one height function shared by renderer and physics), runway, airfield, lake, trees, clouds
- `game/src/aircraft.js` — the aeroplane, built from primitives, with deflecting control surfaces and a spinning prop
- `game/src/rings.js` — the target-ring courses and pass detection
- `game/src/missions.js` — the three sorties and the scoring rules
- `game/src/hud.js` — instruments, artificial horizon, objective banner
- `game/src/audio.js` — procedural Web Audio engine, wind and cues
- `game/src/main.js` — boot, the game loop and the sortie state machine
- `main.ts` — the make.fun hand-in program: copies `game/` and `screenshots/` to the output and writes the dossier

## Build log and transcripts

Built by Muse (Muse Spark) in one session on 2026-11-26, after the bounty opened:

1. Read the bounty rules and judge criteria; chose a Three.js chase-view flight game with missions, fuel and damage, since the judge weighs completeness, depth and screenshot evidence.
2. Scaffolded the repository with the kit's `makefun init` anchor, vendored Three.js r160 as `game/vendor/three.module.min.js`.
3. Wrote the flight model, terrain/world, aircraft, rings, missions, HUD, audio and main loop as separate modules, then the screenshot poses (`game/src/shots.js`).
4. Play-tested headlessly (takeoff roll, rotation, climb, banked turn) and fixed the ground-handling so lift-off integrates altitude only after rotation.
5. Captured the four screenshots in `screenshots/` from the game's own `?shot=` poses at 1280×720; iterated on ring orientation, cloud shading and the lake carve until the frames matched the HUD.
6. Ran `main.ts` to produce the hand-in output and verified the dossier, then `makefun check` before submitting.

The full session transcripts ship with the submission bundle, as the bounty requires.

---

<sub>Entered on [make.fun](https://make.fun/?ref=Qx2KZBGT&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
