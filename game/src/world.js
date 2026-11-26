// The Kestrel Valley: procedural terrain with a flattened airfield corridor,
// a carved valley for low flying, a lake, scattered pines and the airfield
// itself — runway, hangar, tower and windsock. One height function is shared
// by the renderer and the flight model, so what you see is what you hit.
import * as THREE from 'three';

export const WORLD = {
  size: 7600, // metres across
  runway: { x: 0, zFrom: 620, zTo: 1520, width: 46 }, // runs north-south
  spawn: { x: 0, z: 1440, heading: 0 }, // south end of the runway, facing north
};

// --- deterministic value noise -------------------------------------------
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  const ux = smooth(fx), uz = smooth(fz);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x, z, octaves) {
  let sum = 0, amp = 0.5, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, z) * amp;
    total += amp;
    x *= 2.13; z *= 2.13; amp *= 0.5;
  }
  return sum / total;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Terrain height in metres at (x, z). The airfield corridor and the valley
// floor are carved out of the rolling hills; ridges grow toward the rim.
export function terrainHeight(x, z) {
  const rolling = fbm(x * 0.0011 + 7.3, z * 0.0011 - 2.1, 4); // 0..1
  const ridge = fbm(x * 0.00042 - 4.7, z * 0.00042 + 9.2, 3);
  const distCentre = Math.hypot(x, z);
  const rim = smoothstep(2100, 3600, distCentre);
  let h = rolling * 85 + Math.pow(ridge, 2.1) * 980 * rim + rim * 130;

  // Carve the Kestrel valley: a channel running north near x = -950.
  const valleyDist = Math.abs(x + 950);
  const valleyCut = (1 - smoothstep(120, 520, valleyDist)) * smoothstep(-2600, -1200, z) * (1 - smoothstep(1400, 2400, z));
  h = h * (1 - valleyCut * 0.82) + 6 * valleyCut;

  // Flatten the airfield corridor.
  const r = WORLD.runway;
  const dx = Math.max(Math.abs(x - r.x) - r.width * 2.4, 0);
  const dz = Math.max(Math.abs(z - (r.zFrom + r.zTo) / 2) - (r.zTo - r.zFrom) / 2 - 260, 0);
  const flat = 1 - smoothstep(0, 420, Math.hypot(dx, dz));
  h = h * (1 - flat) + 0 * flat;

  // A lake basin north-east stays low and wet: fully carved to water level
  // so the lake disc sits above the terrain at its centre.
  const lake = 1 - smoothstep(300, 900, Math.hypot(x - 1650, z + 1750));
  h = h * (1 - lake) + 1.0 * lake;
  return h;
}

export function groundAt(x, z) {
  const r = WORLD.runway;
  const onRunway =
    Math.abs(x - r.x) <= r.width / 2 && z >= r.zFrom - 10 && z <= r.zTo + 10;
  return { height: onRunway ? 0 : Math.max(terrainHeight(x, z), 0), onRunway };
}

// --- scene construction ----------------------------------------------------
export function buildWorld(scene) {
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0xa8c6de, 900, 5200);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-1400, 2100, -900);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd7f0, 0x4a6741, 0.95));

  buildTerrain(scene);
  buildRunway(scene);
  buildAirfield(scene);
  buildLake(scene);
  buildTrees(scene);
  buildClouds(scene);
  return { sun };
}

function buildTerrain(scene) {
  const seg = 150;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = [];
  const grass = new THREE.Color(0x5d8a4c), dry = new THREE.Color(0x9aa055);
  const rock = new THREE.Color(0x8b8578), snow = new THREE.Color(0xf4f7f9);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    if (h < 26) c.copy(grass).lerp(dry, fbm(x * 0.004, z * 0.004, 2));
    else if (h < 150) c.copy(dry).lerp(rock, (h - 26) / 124);
    else if (h < 330) c.copy(rock);
    else c.copy(rock).lerp(snow, Math.min(1, (h - 330) / 160));
    colours.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(new THREE.Mesh(geo, mat));
}

function buildRunway(scene) {
  const r = WORLD.runway;
  const len = r.zTo - r.zFrom;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(r.width, 0.3, len),
    new THREE.MeshLambertMaterial({ color: 0x3c4147 }),
  );
  strip.position.set(r.x, 0.15, (r.zFrom + r.zTo) / 2);
  scene.add(strip);

  const white = new THREE.MeshBasicMaterial({ color: 0xf5f7f2 });
  for (let z = r.zFrom + 40; z < r.zTo - 20; z += 60) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 26), white);
    dash.position.set(r.x, 0.16, z);
    scene.add(dash);
  }
  // Threshold bars at both ends.
  for (const zEnd of [r.zFrom + 8, r.zTo - 8]) {
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.34, 12), white);
      bar.position.set(r.x + i * 6, 0.16, zEnd);
      scene.add(bar);
    }
  }
  // Edge lights: small amber posts the length of the strip.
  const lightGeo = new THREE.BoxGeometry(0.5, 1.1, 0.5);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  for (let z = r.zFrom; z <= r.zTo; z += 90) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(lightGeo, lightMat);
      post.position.set(r.x + side * (r.width / 2 + 3), 0.55, z);
      scene.add(post);
    }
  }
}

function buildAirfield(scene) {
  const grey = new THREE.MeshLambertMaterial({ color: 0x9aa3ab });
  const rust = new THREE.MeshLambertMaterial({ color: 0xa2543a });
  // Hangar: box with a prism roof, west of the runway's south end.
  const hangar = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(64, 20, 44), grey);
  body.position.y = 10;
  hangar.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(23, 23, 64, 3, 1), rust);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 20;
  roof.scale.set(1, 1, 0.45);
  hangar.add(roof);
  hangar.position.set(-120, 0, 1330);
  scene.add(hangar);

  // Control tower: shaft and glass cab, east side.
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 34, 8), grey);
  shaft.position.y = 17;
  tower.add(shaft);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0x2c4a63, emissive: 0x1c3648 }),
  );
  cab.position.y = 37;
  tower.add(cab);
  tower.position.set(95, 0, 1180);
  scene.add(tower);

  // Windsock: pole and orange cone by the threshold.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 12, 6), grey);
  pole.position.set(40, 6, 1480);
  scene.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0xe87e2e }),
  );
  sock.rotation.z = Math.PI / 2.3;
  sock.position.set(43, 11.4, 1480);
  scene.add(sock);
}

function buildLake(scene) {
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(430, 28),
    new THREE.MeshLambertMaterial({ color: 0x3e7ca6 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(1650, 2.2, -1750);
  scene.add(lake);
}

function buildTrees(scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const crownGeo = new THREE.ConeGeometry(4.2, 13, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f6034 });
  const count = 420;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  const m = new THREE.Matrix4();
  let placed = 0;
  for (let i = 0; i < count * 6 && placed < count; i++) {
    const x = (hash(i, 11) - 0.5) * 6400;
    const z = (hash(i, 29) - 0.5) * 6400;
    const h = terrainHeight(x, z);
    if (h < 4 || h > 120) continue;
    if (Math.abs(x) < 130 && z > 300 && z < 1800) continue; // keep the airfield clear
    const s = 0.8 + hash(i, 47) * 0.9;
    m.makeScale(s, s, s).setPosition(x, h + 2.5 * s, z);
    trunks.setMatrixAt(placed, m);
    m.makeScale(s, s, s).setPosition(x, h + (5 + 6.5) * s, z);
    crowns.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = crowns.count = placed;
  scene.add(trunks, crowns);
}

function buildClouds(scene) {
  // Unlit white material: clouds read as bright vapour, not grey rock.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  const group = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(hash(i, 3) * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 26 + hash(i * 7 + p, 5) * 42;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      puff.position.set(p * 34 - puffs * 16, hash(i + p, 8) * 10, hash(i + p, 13) * 26);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set((hash(i, 21) - 0.5) * 6200, 300 + hash(i, 23) * 190, (hash(i, 27) - 0.5) * 6200);
    group.add(cloud);
  }
  scene.add(group);
}
