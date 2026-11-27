# Mock Judge — Summit Air V4 screenshot set

A self-assessment, written before submission in the way the bounty judge is
instructed to read an entry: the contact sheet first (cover large on top,
the rest in a row beneath), then the source outline. Criteria in the
judge's own order. Set: `1-cover.jpg` (golden climb-out), `2-cockpit.jpg`
(cockpit final), `3-storm.jpg` (storm freight over the lake),
`4-debrief.jpg` (sortie debrief at dusk).

**1. A complete flight game, shown in screenshots of the game itself.**
The strongest criterion here. Three of the four frames are the game in
flight: a chase view on climb-out with the runway below, the first ring
ahead and ALT/SPD/HDG/V-S plus an artificial horizon lit on the HUD; a
cockpit view on final with a modelled panel, gauges and the strip ahead;
and a banked chase view over the lake in storm murk with the active ring
in frame. The fourth frame closes the loop the first criterion implies —
a debrief proving sorties end, score and grade. Nothing is a menu or a
render: every frame is the game's own camera.

**2. Fun and depth.**
The sheet itself advertises variety: three different sorties appear by
name (First Flight, Storm Freight, and the Dusk Courier's debrief), with
different objectives on the banners — rings, a crosswind freight run, an
evening parcel drop. The debrief's rows make the decision economy legible
at a glance: streak bonuses for chaining rings, time against par, fuel
left as points, hull as penalty. Five sorties ship in the game (a circuit,
a low valley run, the storm run, a high rim line, the dusk courier), each
with its own fuel fraction and weather; the sheet shows three of the five
stories directly.

**3. Feel and polish.**
The cockpit frame is the polish evidence: the panel leans like a real
console, the horizon ball and needles sit where a pilot looks, and the
tower's "cleared to land" runs on the radio strip under the screen — as
does "wind west gusting" in the storm frame and the takeoff clearance on
the cover. Landings read as what happened because the debrief grades them:
the sheet's arrival is "SMOOTH — 220 fpm sink", a number the flight model
records at the touchdown instant, not a script. Chase cameras sit behind
the tail with the aircraft large in frame; no shot fights its subject.

**4. Look and originality.**
One low-poly style holds across terrain, sky and aircraft, in three
distinct lights (golden, day, storm) that are atmospheres, not filters.
The world has a signature now: Kestrel Light, a banded lighthouse on the
lake's south-east shore, stands in the storm frame with its lamp glowing
through the murk, and the dusk courier's whole route is built around it
and the village it serves. Nothing is borrowed — no commercial names, art
or music; every asset is procedural, down to the gauge faces. Honest
weakness: the storm frame's far shore is still soft and empty under fog,
and the tourer is a plain working aeroplane rather than a beauty — the
style is coherent, but the storm light flattens what the golden light
flatters. (This pass already applied the cheap fix: the storm pose was
re-composed off the ring axis so the gate, the lake and Kestrel Light
share the frame instead of an empty reach of water.)

**5. Structure.**
The outline shows twelve source files with one job each, named for it:
`flight.js` (the model), `world.js` (terrain, airfield, lighthouse),
`aircraft.js`, `rings.js`, `missions.js` (the five sorties as data),
`hud.js`, `audio.js`, `input.js`, `traffic.js`, `shots.js` (the
screenshot poses), `main.js` (the state machine). Three.js sits under
`vendor/` where it belongs. A reader of the outline alone can find where
any behaviour lives.

**Weakest point, plainly:** criterion 4 in the storm frame — fog and flat
light leave the far shore featureless, so the set's most original asset
(the lighthouse) has to carry that frame almost alone. The re-composed
pose mitigates it; curing it properly would mean dressing the storm
shoreline (moored boats, a lit jetty), which is world-building for one
frame and was left for a future revision rather than rushed.
