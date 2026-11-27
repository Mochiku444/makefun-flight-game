// Keyboard and mouse input for Summit Air.
// Keys: W/S or arrows pitch, A/D bank, Shift/Ctrl throttle, Space brake,
// G gear, C camera, M mute, R restart, Esc menu, 1-5 pick a sortie, Enter confirm.
// Mouse: moving it steers gently toward the pointer; clicking the title cards picks a sortie.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0; // -1..1 across the window
    this.mouseY = 0;
    this.mouseSteer = false; // becomes true once the mouse moves during flight
    this.onAction = null; // (action: string) => void, for one-shot keys

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const action = Input.actionFor(e.code);
      if (action && this.onAction) this.onAction(action);
      if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / innerHeight) * 2 - 1;
      this.mouseSteer = true;
    });
  }

  static actionFor(code) {
    switch (code) {
      case 'KeyC': return 'camera';
      case 'KeyG': return 'gear';
      case 'KeyM': return 'mute';
      case 'KeyR': return 'restart';
      case 'Escape': return 'menu';
      case 'Enter': return 'confirm';
      case 'Digit1': return 'sortie1';
      case 'Digit2': return 'sortie2';
      case 'Digit3': return 'sortie3';
      case 'Digit4': return 'sortie4';
      case 'Digit5': return 'sortie5';
      default: return null;
    }
  }

  // Continuous control axes in -1..1 (pitch: +1 = nose up) plus throttle deltas.
  read(dt) {
    const k = this.keys;
    let pitch = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) pitch += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) pitch -= 1;
    let roll = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) roll -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) roll += 1;

    if (this.mouseSteer && pitch === 0 && roll === 0) {
      // Gentle pointer steering: the plane eases toward where the mouse rests.
      roll += clamp(this.mouseX * 0.9, -1, 1);
      pitch += clamp(-this.mouseY * 0.55, -1, 1);
    }

    let throttleDelta = 0;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) throttleDelta += dt;
    if (k.has('ControlLeft') || k.has('ControlRight')) throttleDelta -= dt;

    return {
      pitch,
      roll,
      throttleDelta,
      brake: k.has('Space'),
      rudder: (k.has('KeyQ') ? -1 : 0) + (k.has('KeyE') ? 1 : 0),
    };
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
