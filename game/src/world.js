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

// Kestrel Light: the lighthouse on the lake's south-east shore, the valley's
// signature landmark — courses and briefings navigate by it.
export const LIGHTHOUSE = { x: 1990, z: -1420 };

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
let skyMat = null, cloudMat = null, sunGlow = null, sunLight = null, hemiLight = null, skyMesh = null;

// The sky dome rides with the camera so its far side never crosses the
// camera's far plane (which clipped it into a black cap on the horizon).
export function followSky(camera) {
  if (skyMesh) skyMesh.position.copy(camera.position);
}

const ATMOSPHERES = {
  day:    { top: 0x3a6fc4, horizon: 0xdcebf5, fog: 0xcfe0ec, fogNear: 1300, fogFar: 7000, sun: 0xfff1d6, sunI: 2.6, hemi: 0.95, cloud: 0xffffff, cloudO: 0.88, glow: 0.85 },
  golden: { top: 0x2e4a7a, horizon: 0xffb36b, fog: 0xe8b98a, fogNear: 1100, fogFar: 6800, sun: 0xffc98a, sunI: 2.9, hemi: 0.8, cloud: 0xffe9d0, cloudO: 0.9, glow: 1.0 },
  storm:  { top: 0x2c3e50, horizon: 0x8799a8, fog: 0x76879a, fogNear: 420, fogFar: 3300, sun: 0xbfd0dd, sunI: 1.15, hemi: 0.5, cloud: 0x8d9aa6, cloudO: 0.96, glow: 0.25 },
};

export function applyAtmosphere(scene, kind) {
  const a = ATMOSPHERES[kind] || ATMOSPHERES.day;
  if (skyMat) {
    skyMat.uniforms.top.value.set(a.top);
    skyMat.uniforms.horizon.value.set(a.horizon);
  }
  scene.fog.color.set(a.fog);
  scene.fog.near = a.fogNear;
  scene.fog.far = a.fogFar;
  if (sunLight) {
    sunLight.color.set(a.sun);
    sunLight.intensity = a.sunI;
  }
  if (hemiLight) hemiLight.intensity = a.hemi;
  if (cloudMat) {
    cloudMat.color.set(a.cloud);
    cloudMat.opacity = a.cloudO;
  }
  if (sunGlow) sunGlow.material.opacity = a.glow;
}

export function buildWorld(scene) {
  scene.fog = new THREE.Fog(0xcfe0ec, 1300, 7000);

  // Gradient sky dome: deep blue overhead melting into a pale horizon.
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3a6fc4) },
      horizon: { value: new THREE.Color(0xdcebf5) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP;\n' +
      'void main(){ float t = pow(clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0), 0.72); gl_FragColor = vec4(mix(horizon, top, t), 1.0);\n' +
      '#include <colorspace_fragment>\n}',
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 24, 12), skyMat);
  scene.add(skyMesh);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-1400, 2100, -900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -430; sun.shadow.camera.right = 430;
  sun.shadow.camera.top = 430; sun.shadow.camera.bottom = -430;
  sun.shadow.camera.near = 200; sun.shadow.camera.far = 3200;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 3;
  scene.add(sun);
  scene.add(sun.target);
  sunLight = sun;
  hemiLight = new THREE.HemisphereLight(0xbcd7f0, 0x4a6741, 0.95);
  scene.add(hemiLight);

  // Sun glow billboard riding the light's direction.
  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,244,214,1)');
    gr.addColorStop(0.35, 'rgba(255,226,160,0.55)');
    gr.addColorStop(1, 'rgba(255,226,160,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
  sunGlow.scale.setScalar(1100);
  sunGlow.position.set(-1400, 2100, -900).normalize().multiplyScalar(4800);
  scene.add(sunGlow);

  buildTerrain(scene);
  buildRunway(scene);
  buildAirfield(scene);
  buildLake(scene);
  buildLighthouse(scene);
  buildRoadAndVillage(scene);
  buildTrees(scene);
  buildClouds(scene);
  return { sun };
}

function buildTerrain(scene) {
  const seg = 190;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = [];
  const grass = new THREE.Color(0x55803f), dry = new THREE.Color(0x9aa055);
  const rock = new THREE.Color(0x8b8578), snow = new THREE.Color(0xf4f7f9);
  // Farmland patchwork: from the air, fields are what make land read as land.
  const fieldPalette = [0x5d8a42, 0x6f9a52, 0xb3a05e, 0x8a6f4d, 0x4f7a3a].map((h) => new THREE.Color(h));
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    if (h < 26) {
      const cell = hash(Math.floor(x / 280), Math.floor(z / 280));
      const field = fieldPalette[Math.floor(cell * fieldPalette.length) % fieldPalette.length];
      c.copy(field).lerp(grass, 0.25 + fbm(x * 0.004, z * 0.004, 2) * 0.3);
    }
    else if (h < 150) c.copy(dry).lerp(rock, (h - 26) / 124);
    else if (h < 330) c.copy(rock);
    else c.copy(rock).lerp(snow, Math.min(1, (h - 330) / 160));
    colours.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
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
  body.castShadow = true; body.receiveShadow = true;
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
  cab.castShadow = true;
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

// Kestrel Light: a banded lighthouse on the lake's south-east shore. Four
// stacked drums alternate white and signal red; a gallery and lamp room cap
// the tower, and a warm glow sprite hangs at the lamp so the light reads
// from across the valley, day or dusk.
function buildLighthouse(scene) {
  const { x, z } = LIGHTHOUSE;
  const base = terrainHeight(x, z);
  const tower = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc23a2e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e3438 });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 3, 12), dark);
  plinth.position.y = 1.5;
  plinth.castShadow = true; plinth.receiveShadow = true;
  tower.add(plinth);

  const bandH = 6.4;
  for (let i = 0; i < 4; i++) {
    const rBottom = 4.8 - i * 0.45, rTop = 4.8 - (i + 1) * 0.45;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, bandH, 12),
      i % 2 === 0 ? white : red,
    );
    band.position.y = 3 + bandH * (i + 0.5);
    band.castShadow = true; band.receiveShadow = true;
    tower.add(band);
  }
  const towerTop = 3 + bandH * 4; // 28.6

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 1.3, 12), dark);
  gallery.position.y = towerTop + 0.65;
  gallery.castShadow = true;
  tower.add(gallery);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 3.6, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd98a }),
  );
  lamp.position.y = towerTop + 1.3 + 1.8;
  tower.add(lamp);
  const lampFrame = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.5, 8), dark);
  lampFrame.position.y = towerTop + 1.3 + 0.25;
  tower.add(lampFrame);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.8, 8), dark);
  roof.position.y = towerTop + 1.3 + 3.6 + 1.4;
  roof.castShadow = true;
  tower.add(roof);

  // The lamp's glow: a soft radial sprite, the same trick as the sun glow.
  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,224,150,0.95)');
    gr.addColorStop(0.4, 'rgba(255,205,110,0.4)');
    gr.addColorStop(1, 'rgba(255,205,110,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.9, depthWrite: false }));
  glow.scale.setScalar(46);
  glow.position.y = towerTop + 1.3 + 1.8;
  tower.add(glow);

  tower.position.set(x, base, z);
  scene.add(tower);
}

// A dirt road out of the airfield and a farming village on the lake's west
// shore: landmarks a pilot (and a screenshot) can navigate by.
function buildRoadAndVillage(scene) {
  const dirt = new THREE.MeshLambertMaterial({ color: 0x9a8563, polygonOffset: true, polygonOffsetFactor: -2 });
  const from = { x: 90, z: 1250 }, to = { x: 1180, z: -1330 };
  const segs = 26, dx = (to.x - from.x) / segs, dz = (to.z - from.z) / segs;
  const segLen = Math.hypot(dx, dz);
  const roadGeo = new THREE.PlaneGeometry(17, segLen + 14);
  for (let i = 0; i < segs; i++) {
    const cx = from.x + dx * (i + 0.5), cz = from.z + dz * (i + 0.5);
    const seg = new THREE.Mesh(roadGeo, dirt);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = Math.atan2(dx, dz);
    seg.position.set(cx, terrainHeight(cx, cz) + 0.45, cz);
    seg.receiveShadow = true;
    scene.add(seg);
  }
  const wallMats = [0xf0e6d2, 0xe8d8b8, 0xdcc7a0].map((h) => new THREE.MeshLambertMaterial({ color: h }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xa2543a });
  const spots = [
    [1180, -1380, 0.4], [1265, -1315, -0.3], [1150, -1470, 0.9], [1300, -1420, 0.1],
    [1210, -1560, -0.6], [1090, -1330, 0.2], [1350, -1500, 0.7], [1240, -1230, -0.9],
    [330, 830, 0.3], [395, 760, -0.4],
  ];
  for (const [hx, hz, rot] of spots) {
    const house = new THREE.Group();
    const w = 16 + hash(hx, hz) * 8, d = 12 + hash(hz, hx) * 6, hgt = 7 + hash(hx, 3) * 3;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wallMats[Math.floor(hash(hx, 9) * 3) % 3]);
    body.position.y = hgt / 2;
    body.castShadow = true; body.receiveShadow = true;
    house.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.72, d * 0.72, w + 2, 3, 1), roofMat);
    roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
    roof.scale.set(1, 1, 0.5);
    roof.position.y = hgt + d * 0.16;
    roof.castShadow = true;
    house.add(roof);
    house.position.set(hx, terrainHeight(hx, hz), hz);
    house.rotation.y = rot;
    scene.add(house);
  }
}

function buildTrees(scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const crownGeo = new THREE.ConeGeometry(4.2, 13, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f6034 });
  const count = 680;
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
  crowns.castShadow = true;
  scene.add(trunks, crowns);
}

function buildClouds(scene) {
  // Unlit white material: clouds read as bright vapour, not grey rock.
  cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  const mat = cloudMat;
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
