// The HUD: DOM instruments fed from the flight model every frame — altitude,
// speed, heading and vertical speed as digital readouts, an artificial
// horizon drawn on a small canvas, fuel/hull/throttle bars, the objective
// banner and a bearing arrow that points at the active ring.
export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.alt = document.getElementById('g-alt');
    this.spd = document.getElementById('g-spd');
    this.hdg = document.getElementById('g-hdg');
    this.vs = document.getElementById('g-vs');
    this.fuel = document.getElementById('m-fuel');
    this.hull = document.getElementById('m-hull');
    this.thr = document.getElementById('m-thr');
    this.objTitle = document.getElementById('obj-title');
    this.objText = document.getElementById('obj-text');
    this.objSub = document.getElementById('obj-sub');
    this.arrow = document.getElementById('ring-arrow');
    this.messageEl = document.getElementById('message');
    this.horizon = document.getElementById('horizon').getContext('2d');
    this.messageTimer = 0;
  }

  show() {
    this.root.classList.remove('hidden');
  }
  hide() {
    this.root.classList.add('hidden');
  }

  message(text, seconds = 2.2) {
    this.messageEl.textContent = text;
    this.messageEl.style.opacity = '1';
    this.messageTimer = seconds;
  }

  update(dt, flight, sortie, course, state) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageEl.style.opacity = '0';
    }

    this.alt.textContent = String(Math.max(0, Math.round(flight.altitudeFeet)));
    this.spd.textContent = String(Math.round(flight.speedKnots));
    this.hdg.textContent = String(Math.round(flight.headingDegrees)).padStart(3, '0');
    const vs = Math.round(flight.verticalFpm / 10) * 10;
    this.vs.textContent = (vs > 0 ? '+' : '') + String(vs);
    this.vs.style.color = flight.stalled ? '#ff6b5e' : '';

    this.fuel.style.width = `${Math.max(0, state.fuel * 100)}%`;
    this.hull.style.width = `${Math.max(0, state.hull * 100)}%`;
    this.thr.style.width = `${flight.throttle * 100}%`;

    this.objTitle.textContent = sortie.name;
    const guide = course.guidance(flight);
    if (flight.crashed) {
      this.objText.textContent = 'Aircraft down';
      this.objSub.textContent = 'Press R to try the sortie again';
      this.arrow.style.opacity = '0';
    } else if (course.done) {
      this.objText.textContent = 'All rings cleared — land on the runway';
      this.objSub.textContent = state.landed
        ? 'Sortie complete'
        : 'Line up on the strip, gear down, gentle sink';
      this.arrow.style.opacity = '0';
    } else if (guide) {
      this.objText.textContent = `Ring ${course.clearedCount + 1} of ${course.total}`;
      const altNote = guide.dy > 12 ? ' · climb' : guide.dy < -12 ? ' · descend' : '';
      this.objSub.textContent = `${Math.round(guide.distance)} m${altNote}`;
      this.arrow.style.opacity = '1';
      this.arrow.style.transform = `translateX(-50%) rotate(${guide.relative}rad)`;
    }

    this.drawHorizon(flight);
  }

  drawHorizon(flight) {
    const ctx = this.horizon;
    const w = 120, h = 120, cx = w / 2, cy = h / 2;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-flight.roll);
    const pitchPx = Math.max(-34, Math.min(34, -flight.pitch * 56));
    ctx.fillStyle = '#3f7fbf';
    ctx.fillRect(-70, -70 + pitchPx, 140, 70);
    ctx.fillStyle = '#8a6b45';
    ctx.fillRect(-70, pitchPx, 140, 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    for (const off of [-24, -12, 12, 24]) {
      ctx.beginPath();
      ctx.moveTo(-13, pitchPx + off);
      ctx.lineTo(13, pitchPx + off);
      ctx.stroke();
    }
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx - 7, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx + 7, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.stroke();
  }
}
