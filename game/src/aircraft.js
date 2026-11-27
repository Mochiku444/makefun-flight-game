// The aircraft: a single-engine high-wing tourer built from primitives —
// cream fuselage, sunset-orange wing and tail, a spinning two-blade prop,
// working control surfaces that deflect with the pilot's input, fixed gear
// and navigation lights. Built facing north (-Z) to match heading 0.
// The accent colour is a parameter so traffic can wear a different paint.
import * as THREE from 'three';

export function buildAircraft(accentHex = 0xe87e2e) {
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const orange = new THREE.MeshLambertMaterial({ color: accentHex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x274b63, emissive: 0x14324a });

  const plane = new THREE.Group();

  // Fuselage: a tapered body from tail (z +5.4) to nose (z -5.2).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.34, 9.6, 10), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.85, 1.6, 10), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, -4.9);
  plane.add(nose);

  // Canopy: a squashed glass dome over the cabin.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.92, 12, 8), glass);
  canopy.scale.set(0.82, 0.62, 1.7);
  canopy.position.set(0, 0.62, -1.2);
  plane.add(canopy);

  // Main wing with separate ailerons that deflect with roll input.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.18, 1.9), orange);
  wing.position.set(0, 0.92, -1.1);
  plane.add(wing);
  const aileronGeo = new THREE.BoxGeometry(2.6, 0.1, 0.62);
  const aileronL = new THREE.Mesh(aileronGeo, orange);
  aileronL.position.set(-4.1, 0.92, -0.05);
  plane.add(aileronL);
  const aileronR = new THREE.Mesh(aileronGeo, orange);
  aileronR.position.set(4.1, 0.92, -0.05);
  plane.add(aileronR);
  // Wing struts.
  const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(strutGeo, dark);
    strut.position.set(side * 1.9, 0.1, -1.1);
    strut.rotation.z = side * 0.72;
    plane.add(strut);
  }

  // Tail: horizontal stabiliser with elevator, vertical fin with rudder.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.14, 1.15), orange);
  stab.position.set(0, 0.28, 5.1);
  plane.add(stab);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.09, 0.55), orange);
  elevator.position.set(0, 0.28, 5.85);
  plane.add(elevator);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 1.5), orange);
  fin.position.set(0, 1.1, 5.15);
  plane.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.7, 0.6), orange);
  rudder.position.set(0, 1.05, 6.05);
  plane.add(rudder);

  // Propeller: spinner and two blades on a pivot the engine spins.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 10), dark);
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  const bladeGeo = new THREE.BoxGeometry(0.28, 2.5, 0.07);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  prop.position.set(0, 0, -5.85);
  plane.add(prop);
  // A translucent blur disc that fades in with rpm.
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 24),
    new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  blur.position.set(0, 0, -5.8);
  plane.add(blur);

  // Fixed landing gear: two mains and a tail wheel, with fairings.
  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6);
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 10);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(side * 0.95, -1.05, -1.4);
    leg.rotation.z = side * 0.35;
    plane.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.25, -1.75, -1.4);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.62, 5.3);
  plane.add(tailWheel);

  // Navigation lights: red left, green right, white tail.
  const lightGeo = new THREE.SphereGeometry(0.13, 6, 6);
  const navL = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  navL.position.set(-5.7, 0.92, -1.1);
  plane.add(navL);
  const navR = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x44ff77 }));
  navR.position.set(5.7, 0.92, -1.1);
  plane.add(navR);

  // Cockpit interior: a lit gauge panel, glareshield and canopy frame,
  // shown only from the pilot's seat. The gauges are drawn once on a
  // canvas — dials, needles and a horizon ball — so the panel reads as
  // flown instruments, not decoration.
  const cockpit = new THREE.Group();
  const panelTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 144;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#20242a'; cx.fillRect(0, 0, 512, 144);
    const dial = (x, label, needle, draw) => {
      cx.beginPath(); cx.arc(x, 62, 40, 0, Math.PI * 2);
      cx.fillStyle = '#101216'; cx.fill();
      cx.lineWidth = 3; cx.strokeStyle = '#c8b98a'; cx.stroke();
      cx.fillStyle = '#9fb4c4'; cx.font = '11px monospace'; cx.textAlign = 'center';
      for (let t = 0; t < 10; t++) {
        const a = Math.PI * 0.75 + t * Math.PI * 1.5 / 9;
        cx.fillRect(x + Math.cos(a) * 33 - 1, 62 + Math.sin(a) * 33 - 1, 2, 2);
      }
      if (draw) draw(x);
      const na = Math.PI * 0.75 + needle * Math.PI * 1.5;
      cx.beginPath(); cx.moveTo(x, 62);
      cx.lineTo(x + Math.cos(na) * 30, 62 + Math.sin(na) * 30);
      cx.lineWidth = 3; cx.strokeStyle = '#ffb347'; cx.stroke();
      cx.fillStyle = '#e8e2d2'; cx.font = 'bold 12px monospace';
      cx.fillText(label, x, 122);
    };
    dial(58, 'ASI', 0.42);
    dial(150, 'ALT', 0.18);
    dial(242, 'HORIZON', 0.5, (x) => {
      cx.save(); cx.beginPath(); cx.arc(x, 62, 36, 0, Math.PI * 2); cx.clip();
      cx.fillStyle = '#3f7ec2'; cx.fillRect(x - 36, 26, 72, 36);
      cx.fillStyle = '#7a5c38'; cx.fillRect(x - 36, 62, 72, 36);
      cx.restore();
    });
    dial(334, 'HDG', 0.0);
    dial(426, 'VSI', 0.55);
    dial(486, 'RPM', 0.7);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.62, 0.14),
    new THREE.MeshLambertMaterial({ color: 0x23272e }),
  );
  const gauges = new THREE.Mesh(
    new THREE.PlaneGeometry(1.44, 0.54),
    new THREE.MeshBasicMaterial({ map: panelTex }),
  );
  gauges.position.set(0, 0, 0.08);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.3), panel.material);
  shield.position.set(0, 0.36, -0.05);
  // The console leans back toward the pilot so its lit face catches the
  // eye from the seat instead of hiding under the glareshield.
  const console3 = new THREE.Group();
  console3.add(panel, gauges, shield);
  console3.position.set(0, 0.56, -2.62);
  console3.rotation.x = -0.42;
  cockpit.add(console3);
  const pillarGeo = new THREE.BoxGeometry(0.055, 1.0, 0.055);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, panel.material);
    pillar.position.set(side * 0.8, 1.2, -2.6);
    pillar.rotation.z = side * -0.25;
    cockpit.add(pillar);
  }
  cockpit.visible = false;
  plane.add(cockpit);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  blur.castShadow = false;

  return { group: plane, prop, blur, aileronL, aileronR, elevator, rudder, cockpit, canopy };
}

// Pose the aircraft from the flight model and animate its moving parts.
export function poseAircraft(parts, flight, input, dt, time) {
  const g = parts.group;
  g.position.set(flight.pos.x, flight.pos.y + 2.2, flight.pos.z);
  g.rotation.set(0, 0, 0);
  g.rotateY(-flight.heading);
  g.rotateX(-flight.pitch);
  g.rotateZ(flight.roll);

  const rpm = 2 + flight.throttle * 46 + (flight.speed > 1 ? 6 : 0);
  parts.prop.rotation.z += rpm * dt;
  parts.blur.material.opacity = Math.min(0.34, flight.throttle * 0.4);
  parts.aileronL.rotation.x = input.roll * 0.5;
  parts.aileronR.rotation.x = -input.roll * 0.5;
  parts.elevator.rotation.x = -input.pitch * 0.45;
  parts.rudder.rotation.y = input.rudder * 0.4;
  // A parked plane sits nose-level; a flying one carries its attitude.
  if (flight.onGround) g.position.y = flight.pos.y + 2.2 - Math.sin(time * 2) * 0.01;
}
