// ---------- GAME ----------
const cv = document.getElementById('screen'); cv.width = VW; cv.height = VH;
const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
let wantView = { w: 320, h: 180 }, stageBox = { w: 320, h: 180 };
const lightCv = document.createElement('canvas'); lightCv.width = VW; lightCv.height = VH;
const lctx = lightCv.getContext('2d');
// resize the game view; the canvas is CSS-fitted (contain) inside the stage
function setView(w, h) {
  if (VW !== w || VH !== h) {
    VW = w; VH = h; cv.width = w; cv.height = h; lightCv.width = w; lightCv.height = h;
    ctx.imageSmoothingEnabled = false;
  }
  const k = Math.min(stageBox.w / w, stageBox.h / h), cw = Math.round(w * k), ch = Math.round(h * k);
  const st = cv.style, l = Math.round((stageBox.w - cw) / 2) + 'px', t = Math.round((stageBox.h - ch) / 2) + 'px';
  if (st.width !== cw + 'px' || st.left !== l || st.top !== t) { st.width = cw + 'px'; st.height = ch + 'px'; st.left = l; st.top = t; }
}
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAVE_KEY = 'spacedudes.save.v1';

// ---------------- state
let G = null;            // persistent progress
let P = null;            // player body
let state = 'boot';      // boot,title,select,story,play,dialog,banner,pause,map,dead,ending
let frame = 0, T = 0;
let cam = { x: 0, y: 0 }, shake = 0;
let enemies = [], shots = [], parts = [], orbs = [], rocks = [];
let boss = null, trail = [], lights = [];
let bgZone = 'surface', bgPrev = null, bgFade = 0, amb = 0.1, darkCol = [10, 4, 22];
let explored = new Uint8Array(MW * MH);
let flashA = 0, flashCol = '255,255,255';
let scene = null; // story backdrop: 'orbit'
let toastT = 0;

function freshG(who) {
  return {
    who, other: who === 'jesse' ? 'ian' : 'jesse',
    crew: { richie: false, eli: false, bigt: false, other: false }, order: [],
    fuel: {}, tanks: {}, tape: false, broken: [],
    ab: { dj: false, charge: false, suit: false },
    maxEnergy: 99, gateOpen: false, bossDead: false, easy: false,
    checkpoint: { x: shipPos.x - 36, y: shipPos.y - 14 }, flags: {}, seen: {},
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// ---------------- input
const input = { left: 0, right: 0, up: 0, down: 0, jump: 0, fire: 0 };
const prev = { ...input };
const kb = { left: 0, right: 0, up: 0, down: 0, jump: 0, fire: 0 };
const tc = { left: 0, right: 0, up: 0, down: 0, jump: 0, fire: 0 };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyX: 'fire', KeyJ: 'fire' };
addEventListener('keydown', e => {
  Snd.unlock();
  if (KEYMAP[e.code]) { kb[KEYMAP[e.code]] = 1; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyP') { if (state === 'play') openPause(); else if (state === 'pause') closePause(); }
  if (e.code === 'KeyM') { if (state === 'play') openMap(); else if (state === 'map') closeMap(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) kb[KEYMAP[e.code]] = 0; });
const pressed = k => input[k] && !prev[k];
const released = k => !input[k] && prev[k];

function setupTouch() {
  const pad = $('pad'), A = $('btnA'), B = $('btnB');
  const handle = e => {
    tc.left = tc.right = tc.up = tc.down = tc.jump = tc.fire = 0;
    const pr = pad.getBoundingClientRect(), cx = pr.left + pr.width / 2, cy = pr.top + pr.height / 2, r = pr.width / 2;
    const ar = A.getBoundingClientRect(), br = B.getBoundingClientRect();
    const inR = (t, q, m) => t.clientX > q.left - m && t.clientX < q.right + m && t.clientY > q.top - m && t.clientY < q.bottom + m;
    for (const t of e.touches) {
      const dx = t.clientX - cx, dy = t.clientY - cy;
      if (Math.hypot(dx, dy) < r * 1.6 && t.clientX < innerWidth / 2) {
        if (dx < -r * 0.28) tc.left = 1; if (dx > r * 0.28) tc.right = 1;
        if (dy < -r * 0.38) tc.up = 1; if (dy > r * 0.42) tc.down = 1;
      } else if (inR(t, ar, 14)) tc.jump = 1;
      else if (inR(t, br, 14)) tc.fire = 1;
      else if (t.clientX > innerWidth / 2) { // forgiving zone: nearest action button
        const da = Math.hypot(t.clientX - (ar.left + ar.width / 2), t.clientY - (ar.top + ar.height / 2));
        const db = Math.hypot(t.clientX - (br.left + br.width / 2), t.clientY - (br.top + br.height / 2));
        if (Math.min(da, db) < ar.width * 1.3) { if (da < db) tc.jump = 1; else tc.fire = 1; }
      }
    }
    pad.dataset.dir = (tc.left ? 'l' : '') + (tc.right ? 'r' : '') + (tc.up ? 'u' : '') + (tc.down ? 'd' : '');
    A.classList.toggle('on', !!tc.jump); B.classList.toggle('on', !!tc.fire);
  };
  const ctl = $('controls');
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => ctl.addEventListener(ev, e => { e.preventDefault(); Snd.unlock(); handle(e); }, { passive: false }));
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
}

// ---------------- layout
function layout() {
  const app = $('app'), stage = $('stage'), ctl = $('controls');
  const W = app.clientWidth, H = app.clientHeight;
  const portrait = H > W * 1.05;
  app.classList.toggle('portrait', portrait); app.classList.toggle('landscape', !portrait);
  let sw, sh, ctlH = 0;
  if (portrait) { // screen fills everything above a compact control deck
    ctlH = 196; sw = W; sh = Math.max(Math.round(W * 9 / 16), H - ctlH);
    const vw = clamp(Math.round(sw / 1.8), 200, 320), k = sw / vw, vh = clamp(Math.round(sh / k), 180, 360);
    sh = Math.round(vh * k); ctlH = H - sh; wantView = { w: vw, h: vh };
  } else { sh = H; sw = Math.round(H * 16 / 9); if (sw > W) { sw = W; sh = Math.round(W * 9 / 16); } wantView = { w: 320, h: 180 }; }
  stageBox = { w: sw, h: sh };
  stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
  stage.style.setProperty('--u', (sw / 320).toFixed(3));
  app.style.setProperty('--u', (sw / 320).toFixed(3)); app.style.setProperty('--sw', sw + 'px'); app.style.setProperty('--sh', sh + 'px');
  ctl.style.height = portrait ? ctlH + 'px' : '';
  setView(VW, VH);
}

// ---------------- bodies & collision
function moveBody(b, oneway = true) {
  b.x += b.vx; b.hitX = false;
  const y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - 0.01) / TS);
  if (b.vx > 0) { const tx = Math.floor((b.x + b.w - 0.01) / TS); for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(tx, ty))) { b.x = tx * TS - b.w; b.vx = 0; b.hitX = true; break; } }
  else if (b.vx < 0) { const tx = Math.floor(b.x / TS); for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(tx, ty))) { b.x = (tx + 1) * TS; b.vx = 0; b.hitX = true; break; } }
  const prevBottom = b.y + b.h;
  b.y += b.vy; b.onGround = false; b.hitCeil = false;
  const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - 0.01) / TS);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / TS);
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(tx, ty);
      if (isSolid(ch) || (oneway && ch === '=' && prevBottom <= ty * TS + 0.5 && !b.dropping)) { b.y = ty * TS - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / TS);
    for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(tx, ty))) { b.y = (ty + 1) * TS; b.vy = 0; b.hitCeil = true; break; }
  }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function newPlayer(x, y) {
  return { x, y, w: 10, h: 14, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, canDouble: false, inv: 0, charge: 0, fireCd: 0, aim: 'side', anim: 0, frame: 0, liquid: false, acidT: 0, dropping: 0, energy: G.maxEnergy, hurtFlash: 0 };
}

// ---------------- particles
function puff(x, y, n, col, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.ang != null ? o.ang + rand(-o.spread || -0.5, o.spread || 0.5) : rand(0, Math.PI * 2);
    const sp = rand(o.min || 0.4, o.max || 2.2);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(o.lmin || 18, o.lmax || 40), max: 40, col, size: o.size || 1 + (Math.random() < 0.3), add: o.add !== false, grav: o.grav || 0 });
  }
}

// ---------------- enemies
function spawnEnemies() {
  enemies = spawns.map(s => makeEnemy(s.type, s.x, s.y));
}
function makeEnemy(type, x, y) {
  const e = { type, x, y, home: { x, y }, vx: 0, vy: 0, flash: 0, dead: false, respawn: 0, seed: Math.random() * 10, cd: 60 + Math.random() * 60 };
  if (type === 'c') Object.assign(e, { w: 12, h: 10, hp: 2, vx: 0.45 * (Math.random() < 0.5 ? -1 : 1), y: y + 6 });
  if (type === 'f') Object.assign(e, { w: 12, h: 10, hp: 1 });
  if (type === 't') Object.assign(e, { w: 12, h: 12, hp: 4, x: x + 2, y: y + 2 });
  if (type === 'b') Object.assign(e, { w: 12, h: 10, hp: 1, type: 'f', boss: true });
  e.maxhp = e.hp; return e;
}
function updateEnemies() {
  for (const e of enemies) {
    if (e.dead) {
      if (e.boss) continue;
      e.respawn--; const far = Math.abs(e.home.x - (cam.x + 160)) > 260 || Math.abs(e.home.y - (cam.y + 90)) > 180;
      if (e.respawn <= 0 && far && !G.escape) Object.assign(e, makeEnemy(e.type, e.home.x, e.home.y - (e.type === 'c' ? 0 : 0)));
      continue;
    }
    if (Math.abs(e.x - cam.x - 160) > 360 || Math.abs(e.y - cam.y - 90) > 240) continue;
    if (e.flash > 0) e.flash--;
    const dx = P.x + 5 - (e.x + e.w / 2), dy = P.y + 7 - (e.y + e.h / 2), dist = Math.hypot(dx, dy);
    if (e.type === 'c') {
      e.vy = Math.min(e.vy + 0.3, 4);
      const dir = Math.sign(e.vx) || 1;
      moveBody(e);
      if (e.hitX) e.vx = -dir * 0.45;
      else if (e.onGround) {
        const fx = Math.floor((dir > 0 ? e.x + e.w + 1 : e.x - 1) / TS), fy = Math.floor((e.y + e.h + 2) / TS);
        const below = tileAt(fx, fy); if (!isSolid(below) && below !== '=') e.vx = -dir * 0.45;
        else e.vx = dir * 0.45;
      }
    } else if (e.type === 'f') {
      if (dist < 110 || e.boss) { e.vx += Math.sign(dx) * 0.04; e.vy += Math.sign(dy) * 0.035; }
      else { e.vx += (e.home.x - e.x) * 0.002; e.vy += (e.home.y + Math.sin(T * 2 + e.seed) * 10 - e.y) * 0.004; }
      e.vx = clamp(e.vx * 0.985, -0.95, 0.95); e.vy = clamp(e.vy * 0.985, -0.85, 0.85);
      moveBody(e, false);
    } else if (e.type === 't') {
      e.cd--;
      if (e.cd <= 0) { e.cd = 130; if (dist < 170) { const a = Math.atan2(dy, dx); shots.push({ x: e.x + 6, y: e.y + 6, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, r: 3, life: 160, hostile: true, dmg: 8, col: '255,176,58' }); } }
    }
    if (P && P.inv <= 0 && overlap(e, P)) hurt(e.type === 'c' ? 10 : 8, e.x + e.w / 2);
  }
}
function damageEnemy(e, dmg) {
  e.hp -= dmg; e.flash = 6; Snd.sfx.hit();
  if (e.hp <= 0) {
    e.dead = true; e.respawn = 60 * 25; Snd.sfx.kill();
    puff(e.x + e.w / 2, e.y + e.h / 2, 16, e.type === 'f' ? '43,212,196' : e.type === 't' ? '255,120,80' : '255,106,213');
    if (Math.random() < 0.4) orbs.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -1, life: 600 });
  }
}

// ---------------- shots
function fire(big, aim = P.aim) {
  const dir = aim === 'up' ? [0, -1] : aim === 'down' ? [0, 1] : [P.face, 0];
  const gx = aim === 'side' ? (P.face > 0 ? P.x + 14 : P.x - 4) : P.x + (P.face > 0 ? 9 : 1);
  const gy = aim === 'up' ? P.y - 2 : aim === 'down' ? P.y + 17 : P.y + 9;
  const sp = big ? 4.2 : 4.6;
  shots.push({ x: gx, y: gy, vx: dir[0] * sp, vy: dir[1] * sp, r: big ? 5 : 2, life: big ? 55 : 34, big, dmg: big ? 4 : 1, col: big ? '255,122,240' : '255,79,216' });
  if (big) { Snd.sfx.big(); shake = Math.max(shake, 3); puff(gx, gy, 10, '255,180,250', { ang: Math.atan2(dir[1], dir[0]), spread: 0.6, max: 3 }); }
  else { Snd.sfx.shoot(); puff(gx, gy, 3, '255,150,240', { ang: Math.atan2(dir[1], dir[0]), spread: 0.4 }); }
}
function updateShots() {
  for (const s of shots) {
    s.x += s.vx; s.y += s.vy; s.life--;
    if (s.big || s.crew) parts.push({ x: s.x, y: s.y, vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), life: 10, max: 10, col: s.col, size: s.big ? 2 : 1, add: true });
    const tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS), ch = tileAt(tx, ty);
    if (isSolid(ch)) {
      s.life = 0;
      if (!s.hostile && ch === 'x') breakTile(tx, ty, '255,200,120');
      else if (!s.hostile && ch === 'X') { if (s.big) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(tx + dx, ty + dy) === 'X') breakTile(tx + dx, ty + dy, '255,122,240'); } else { Snd.sfx.hit(); if (!G.ab.charge) toast('Crystal won\'t crack. Need more power.'); } }
      else if (!s.hostile && ch === 'D') { Snd.sfx.hit(); gateHint(); }
      puff(s.x - s.vx, s.y - s.vy, 5, s.col, { max: 1.5 });
      continue;
    }
    if (s.hostile) {
      if (P.inv <= 0 && Math.abs(s.x - (P.x + 5)) < 6 + s.r && Math.abs(s.y - (P.y + 7)) < 8 + s.r) { s.life = 0; hurt(s.dmg, s.x); }
      continue;
    }
    for (const e of enemies) {
      if (e.dead) continue;
      if (s.x > e.x - s.r && s.x < e.x + e.w + s.r && s.y > e.y - s.r && s.y < e.y + e.h + s.r) { damageEnemy(e, s.dmg); s.life = 0; puff(s.x, s.y, 6, s.col); break; }
    }
    if (boss && !boss.dying && s.life > 0 && s.x > boss.x && s.x < boss.x + boss.w && s.y > boss.y && s.y < boss.y + boss.h) {
      boss.hp -= s.dmg; boss.flash = 5; s.life = 0; Snd.sfx.hit(); puff(s.x, s.y, 8, '255,92,138');
      if (boss.hp <= 0) bossDie();
    }
  }
  shots = shots.filter(s => s.life > 0);
}
function breakTile(tx, ty, col) {
  grid[ty][tx] = '.'; G.broken.push(tx + ',' + ty); redrawAround(tx, ty); save();
  Snd.sfx.brk(); shake = Math.max(shake, 4);
  puff(tx * TS + 8, ty * TS + 8, 22, col, { max: 3, grav: 0.12, size: 2 });
}

// ---------------- player
function hurt(dmg, fromX, noKnock) {
  if (state !== 'play' || P.dead) return;
  if (!noKnock && P.inv > 0) return;
  P.energy -= dmg * (G.easy ? 0.5 : 1);
  if (!noKnock) {
    P.inv = 70; P.vx = (P.x + 5 < fromX ? -1 : 1) * 2.4; P.vy = -2.6; P.hurtFlash = 8;
    Snd.sfx.hurt(); shake = Math.max(shake, 5); flashA = 0.25; flashCol = '255,40,80';
  }
  if (P.energy <= 0) die();
}
function updatePlayer() {
  const p = P;
  const ctx_ = Math.floor((p.x + 5) / TS), cty = Math.floor((p.y + 9) / TS);
  const liquid = tileAt(ctx_, cty) === '~';
  if (liquid !== p.liquid) { Snd.sfx.splash(); puff(p.x + 5, p.y + 8, 10, '182,255,58', { ang: -Math.PI / 2, spread: 1, max: 2.5, grav: 0.15 }); p.liquid = liquid; }
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (mx) p.face = mx;
  const top = liquid ? 1.15 : 1.9, acc = p.onGround ? 0.42 : 0.3;
  if (p.inv < 55 || p.onGround) p.vx += clamp(mx * top - p.vx, -acc, acc);
  p.vy += liquid ? 0.1 : 0.3; p.vy = Math.min(p.vy, liquid ? 1.4 : 5.6);
  if (p.onGround) { p.coyote = 6; p.canDouble = true; } else p.coyote--;
  if (pressed('jump')) p.jumpBuf = 7; else p.jumpBuf--;
  if (p.dropping > 0) p.dropping--;
  if (p.jumpBuf > 0) {
    if (liquid) { p.vy = -2.9; p.jumpBuf = 0; Snd.sfx.splash(); }
    else if (p.coyote > 0) {
      const under = tileAt(Math.floor((p.x + 5) / TS), Math.floor((p.y + p.h + 1) / TS));
      if (input.down && under === '=') { p.dropping = 10; p.jumpBuf = 0; }
      else { p.vy = -5.6; p.coyote = 0; p.jumpBuf = 0; p.jumpHeld = true; Snd.sfx.jump(); puff(p.x + 5, p.y + 14, 5, '220,220,255', { ang: Math.PI / 2, spread: 1.2, max: 1 }); }
    } else if (G.ab.dj && p.canDouble) {
      p.vy = -5.3; p.canDouble = false; p.jumpBuf = 0; p.jumpHeld = true; Snd.sfx.jump2();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push({ x: p.x + 5, y: p.y + 15, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 0.5, life: 16, max: 16, col: '166,255,58', size: 1, add: true }); }
    }
  }
  if (!input.jump && p.jumpHeld && p.vy < -2) { p.vy = -2; p.jumpHeld = false; }
  if (p.vy >= 0) p.jumpHeld = false;
  const wasAir = !p.onGround;
  moveBody(p);
  if (p.onGround && wasAir && p.vy === 0) puff(p.x + 5, p.y + 14, 3, '200,200,255', { ang: -Math.PI / 2, spread: 1.4, max: 0.8 });
  if (p.y > MH * TS) die();
  p.aim = input.up ? 'up' : (input.down && (!p.onGround || !(input.left || input.right)) ? 'down' : 'side');
  // weapon
  if (p.fireCd > 0) p.fireCd--;
  if (pressed('fire')) { fire(false); p.fireCd = 11; p.charge = 0; }
  else if (input.fire) {
    if (G.ab.charge) { p.charge++; p.chargeAim = p.aim; if (p.charge === 38) Snd.sfx.charge(); if (p.charge > 20 && frame % 3 === 0) { const a = rand(0, 7); parts.push({ x: p.x + 5 + Math.cos(a) * 14, y: p.y + 8 + Math.sin(a) * 14, vx: -Math.cos(a) * 0.9, vy: -Math.sin(a) * 0.9, life: 14, max: 14, col: '255,122,240', size: 1, add: true }); } }
    else if (p.fireCd <= 0) { fire(false); p.fireCd = 11; }
  }
  if (released('fire')) { if (G.ab.charge && p.charge >= 38) fire(true, p.chargeAim || p.aim); p.charge = 0; }
  // anim
  if (p.onGround && Math.abs(p.vx) > 0.3) { p.anim += Math.abs(p.vx) * 0.12; p.frame = Math.floor(p.anim) % 4; } else p.frame = 0;
  if (p.inv > 0) p.inv--;
  if (p.hurtFlash > 0) p.hurtFlash--;
  if (liquid && !G.ab.suit) { p.acidT++; if (p.acidT % 5 === 0) { hurt(1, 0, true); flashA = Math.max(flashA, 0.08); flashCol = '182,255,58'; } if (p.acidT === 1) toast('ACID! Get out!'); }
  else p.acidT = 0;
  // trail for the crew
  trail.unshift({ x: p.x, y: p.y, face: p.face, air: !p.onGround, frame: p.frame, aim: p.aim });
  if (trail.length > 90) trail.length = 90;
  // energy orbs & items
  for (const o of orbs) if (Math.abs(o.x - p.x - 5) < 10 && Math.abs(o.y - p.y - 7) < 12) { o.life = 0; p.energy = Math.min(G.maxEnergy, p.energy + 15); Snd.sfx.pickup(); puff(o.x, o.y, 8, '255,90,170'); }
  for (const it of items) {
    if (taken(it)) continue;
    if (Math.abs(it.x - p.x - 5) < 12 && Math.abs(it.y - p.y - 7) < 14) collect(it);
  }
  checkTriggers();
}
const taken = it => it.type === 'F' ? G.fuel[it.id] : it.type === 'H' ? G.tanks[it.id] : G.tape;
function collect(it) {
  Snd.sfx.item(); puff(it.x, it.y, 30, it.type === 'F' ? '255,230,90' : it.type === 'H' ? '255,90,170' : '200,200,255', { max: 3 });
  if (it.type === 'F') {
    G.fuel[it.id] = true; save();
    const n = Object.keys(G.fuel).length;
    banner(`FUEL CELL ${n}/3`, n < 3 ? 'The ship needs three to make orbit.' : 'Tank\'s full. Now finish rounding up the crew.');
  } else if (it.type === 'H') {
    G.tanks[it.id] = true; G.maxEnergy += 50; P.energy = G.maxEnergy; save();
    banner('ENERGY TANK', 'Max energy +50. Fully recharged.');
  } else {
    G.tape = true; save();
    const lines = G.who === 'ian'
      ? [['ian', 'No.'], ['ian', 'No no no. SPORTS PAGES VOL. 46. FANTASTIC HOCKEY FIGHTS.'], ['ian', 'I left this on EARTH. In a DRAWER. Under a FLOOR.'], ['narr', 'A sticky note on the case: "Light-years aren\'t far enough. -J"'], ['ian', '...He\'s good. I hate that he\'s good.']]
      : [['jesse', 'Is that...'], ['jesse', 'SPORTS PAGES VOL. 46. FANTASTIC HOCKEY FIGHTS. On an alien planet.'], ['narr', 'A sticky note on the case: "Thought this was far enough. -I"'], ['jesse', 'My AI says the odds of this were zero percent.'], ['jesse', 'My AI has never met Ian.']];
    say(lines, () => banner('SECRET: THE TAPE', 'It\'s riding home with you. Whether anyone likes it or not.'));
  }
}

// ---------------- story triggers
function checkTriggers() {
  const px = P.x + 5, py = P.y + 7;
  // the cliff without boots
  if (!G.ab.dj && !G.seen.cliff && px > 49 * TS && px < 52 * TS && py > 9 * TS && py < 13 * TS) {
    G.seen.cliff = true; say([['P', G.who === 'ian' ? 'Wall. Tall. Cool.' : 'My AI says I can make that jump.'], ['P', G.who === 'ian' ? 'Somebody jumpy would be useful right now.' : '...My AI is wrong. Somebody jumpy would help.']]);
  }
  // standing on crystal: teach the down-blast
  if (G.ab.charge && !G.seen.downHint && P.onGround && tileAt(Math.floor(px / TS), Math.floor((P.y + P.h + 1) / TS)) === 'X') {
    G.seen.downHint = true; toast('Hold DOWN + FIRE, let go to blast the floor');
  }
  // rescues
  for (const k of ['richie', 'eli', 'bigt']) {
    if (G.crew[k]) continue;
    const n = npcs[k];
    if (Math.abs(n.x - px) < 18 && Math.abs(n.y - 8 - py) < 18) rescue(k);
  }
  // boss gate
  const gx = 13 * TS;
  if (!G.gateOpen && px > gx - 14 && px < gx + 26 && py > 42 * TS - 8) gateHint();
  // arena
  if (G.gateOpen && !G.bossDead && !boss && py > 52 * TS && px < 45 * TS) startBoss();
  // escape: reach the ship
  if (G.escape && Math.abs(px - (shipPos.x + 18)) < 58 && py > shipPos.y - 48 && py < shipPos.y + 4) startEnding();
  // area name card
  const z = zoneAt(Math.floor(px / TS), Math.floor(py / TS));
  if (!G.seen['z_' + z] && state === 'play') { G.seen['z_' + z] = true; areaCard(ZP[z].name); }
}
function gateHint() {
  if (G.gateOpen || state !== 'play') return;
  const crew = ['richie', 'eli', 'bigt'].filter(k => G.crew[k]).length, fuel = Object.keys(G.fuel).length;
  if (crew === 3 && fuel === 3) { openGate(); return; }
  if (G.seen.gateNag && frame - G.seen.gateNag < 300) return;
  G.seen.gateNag = frame;
  toast(`HIVE GATE · crew ${crew}/3 · fuel ${fuel}/3`);
}
function openGate() {
  G.gateOpen = true; G.checkpoint = { x: 10 * TS + 2, y: 43 * TS }; save();
  const O = G.other;
  say([
    ['eli', 'Oh great. It\'s the door brothers.'],
    ['bigt', 'That door is BREATHING. Doors don\'t BREATHE.'],
    ['radio:' + O, O === 'ian' ? '...Is that you guys? Took you long enough. There\'s a big one in here.' : 'GUYS! My AI says you\'re right outside! ...It also says I\'m a sandwich. Hurry.'],
    ['richie', 'Everybody stay calm. I\'m calm. Who touched me? Nobody? Okay.'],
  ], () => {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y][x] === 'D') { grid[y][x] = '.'; puff(x * TS + 8, y * TS + 8, 10, '255,61,110', { max: 2.5 }); }
    redrawAround(13, 46); Snd.sfx.door(); shake = 10; toast('Point of no return. Crew\'s with you.');
  });
}
function applyWorldFlags() {
  for (const k of G.broken) { const [x, y] = k.split(',').map(Number); if (grid[y]) grid[y][x] = '.'; }
  if (G.gateOpen) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y][x] === 'D') grid[y][x] = '.';
}

function rescue(k) {
  const W = G.who;
  G.crew[k] = true; G.order.push(k);
  const n = npcs[k]; G.checkpoint = { x: n.x - 5, y: n.y - 14 };
  save(); Snd.sfx.item(); puff(n.x, n.y - 8, 30, '255,255,255', { max: 2.5 });
  if (k === 'richie') {
    say([
      ['richie', 'AAAH! DUDE! Don\'t SNEAK up on me!', 'yell'],
      ...(W === 'jesse' ? [['jesse', 'RICH, LOOK OUT!'], ['richie', '...There\'s nothing there, dude.'], ['jesse', 'Saved your life. Again.']]
        : [['ian', 'You\'re glued to a wall with alien snot, Rich.'], ['richie', 'It\'s GOO, dude. Snot is a whole different thing.'], ['ian', 'Enlighten me later.']]),
      ['richie', 'They grabbed me and I jumped SO hard I jumped twice. In the AIR.'],
      ['richie', 'Pretty sure it\'s the boots. Take \'em. I\'m done jumping for today.'],
      ['richie', 'And FYI, rescues are free. I don\'t owe you five bucks for this, dude.', 'smirk'],
    ], () => { G.ab.dj = true; save(); banner('JUMPY BOOTS', 'Press JUMP again in mid-air to double jump. Rich says they\'re a loan.'); });
  } else if (k === 'eli') {
    say([
      ['eli', 'Oh great. It\'s the rescue-party brothers. Party of one.'],
      ['eli', 'Took you long enough. I\'ve been holding off space bugs with a SWORD.'],
      ...(W === 'jesse' ? [['jesse', 'My AI says swords are 80 percent of space combat.'], ['eli', 'Your AI is right. Don\'t tell it I said that.']]
        : [['ian', 'Why did you bring a sword to space.'], ['eli', 'Why DIDN\'T you.']]),
      ['eli', 'Here. ANIME DRAW. Hold the trigger. Feel it. Let go.'],
      ['eli', 'That\'s the whole lesson. Purple crystals break if you mean it.'],
    ], () => { G.ab.charge = true; save(); banner('ANIME DRAW', 'Hold FIRE to charge, release to blast. Charged shots shatter purple crystal.'); });
  } else {
    say([
      ['bigt', 'BROWN TOWN, BABY! YOU FOUND ME!', 'yell'],
      ['bigt', 'Island life. Acid on all sides. Honestly? Thriving.'],
      ['bigt', 'I\'ve been brewing remedies. Drink this. It\'s from the bathroom cabinet.'],
      ...(W === 'ian' ? [['ian', '...The label says "not for internal use."'], ['bigt', 'I SAID DON\'T READ THE LABEL!', 'yell']]
        : [['jesse', 'My AI says that\'s forty percent cough syrup.'], ['bigt', 'And SIXTY percent COURAGE.', 'yell']]),
      ['bigt', 'Acid can\'t touch you now. Neither can I. Personal space.'],
    ], () => { G.ab.suit = true; P.energy = G.maxEnergy; save(); banner('BATHROOM CABINET', 'Acid won\'t hurt you anymore. Energy refilled. Don\'t ask what was in it.'); });
  }
}

// ---------------- boss
function startBoss() {
  boss = { x: bossSpawn.x - 28, y: 55 * TS, w: 56, h: 48, hp: 70, max: 70, t: 0, cd: 140, spawnCd: 260, flash: 0, mode: 'float', modeT: 0, blink: false, dying: 0 };
  Snd.music('boss');
  say([
    ['narr', 'Something enormous unfolds from the ceiling.'],
    ['richie', 'DUDE. DUDE. IT\'S HUGE.', 'yell'],
    ['bigt', 'She\'s ugly AND she took our guy. That\'s two strikes.'],
    ['eli', 'Oh great. It\'s the queen brothers.'],
  ], () => { $('bossbar').hidden = false; areaCard('HIVE QUEEN GLORBAX'); });
}
function updateBoss() {
  const b = boss; if (!b) return;
  b.t++; if (b.flash > 0) b.flash--;
  $('bossfill').style.width = Math.max(0, b.hp / b.max * 100) + '%';
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  b.lookX = clamp((P.x - cx) / 120, -1, 1); b.lookY = clamp((P.y - cy) / 80, -1, 1);
  b.blink = (b.t % 200) < 6;
  b.enraged = b.hp < b.max * 0.5;
  if (b.dying) {
    b.dying++; b.x += rand(-1, 1);
    if (b.dying % 6 === 0) { puff(b.x + rand(0, b.w), b.y + rand(0, b.h), 14, ['255,92,138', '255,216,74', '255,255,255'][b.dying % 3], { max: 3 }); Snd.sfx.kill(); shake = 6; }
    if (b.dying === 120) { puff(cx, cy, 80, '255,200,120', { max: 5, size: 2 }); Snd.sfx.boom(); flashA = 1; shake = 16; boss = null; $('bossbar').hidden = true; afterBoss(); }
    return;
  }
  const ax0 = 9 * TS, ax1 = 44 * TS;
  if (b.mode === 'float') {
    const tx = (ax0 + ax1) / 2 + Math.sin(b.t * 0.011) * 200 - b.w / 2, ty = 55 * TS + Math.sin(b.t * 0.033) * 10;
    b.x += (tx - b.x) * 0.02; b.y += (ty - b.y) * 0.05;
    b.cd--;
    if (b.cd <= 0) {
      b.cd = b.enraged ? 85 : 120;
      const n = b.enraged ? 7 : 5, a0 = Math.atan2(P.y + 7 - cy, P.x + 5 - cx);
      for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.22; shots.push({ x: cx, y: cy + 6, vx: Math.cos(a) * 1.8, vy: Math.sin(a) * 1.8, r: 3, life: 220, hostile: true, dmg: 9, col: '184,255,58' }); }
      b.mouth = 4; setTimeout(() => { if (boss) boss.mouth = 0; }, 250);
    }
    b.spawnCd--;
    if (b.spawnCd <= 0) {
      b.spawnCd = 360;
      if (enemies.filter(e => e.boss && !e.dead).length < 3) for (let i = 0; i < 2; i++) enemies.push(makeEnemy('b', cx + (i ? 20 : -30), cy + 10));
    }
    if (b.enraged && b.t % 420 === 0) { b.mode = 'tele'; b.modeT = 0; Snd.sfx.alarm(); }
  } else if (b.mode === 'tele') {
    b.modeT++; b.x += Math.sin(b.modeT) * 1.5; if (b.modeT > 45) { b.mode = 'dive'; b.modeT = 0; b.diveX = clamp(P.x - b.w / 2, ax0, ax1 - b.w); }
  } else if (b.mode === 'dive') {
    b.modeT++; b.x += (b.diveX - b.x) * 0.08; b.y += (63 * TS - b.h - b.y) * 0.12;
    if (b.modeT === 14) { shake = 10; Snd.sfx.boom(); puff(cx, b.y + b.h, 20, '255,154,61', { ang: -Math.PI / 2, spread: 1.5, max: 3 }); }
    if (b.modeT > 50) b.mode = 'float';
  }
  if (P.inv <= 0 && overlap({ x: b.x + 6, y: b.y + 6, w: b.w - 12, h: b.h - 10 }, P)) hurt(15, cx);
}
function bossDie() { if (boss.dying) return; boss.dying = 1; enemies.forEach(e => { if (e.boss) { e.dead = true; puff(e.x, e.y, 10, '43,212,196'); } }); shots = shots.filter(s => !s.hostile); Snd.stop(); }
function afterBoss() {
  G.bossDead = true; G.crew.other = true; G.order.push('other'); save();
  const O = G.other;
  puff(capturedPos.x, capturedPos.y - 10, 40, '255,61,110', { max: 3 });
  say(O === 'ian' ? [
    ['ian', '...Took you long enough.'],
    ['ian', 'I had a whole speech ready. Forgot it. Hanging upside down does that.'],
    ['jesse', 'My AI predicted you\'d be a horse by now.'],
    ['ian', 'Your AI needs a nap.'],
  ] : [
    ['jesse', 'IAN! I KNEW you\'d come! My AI predicted it!'],
    ['ian', 'Your AI predicted launch was Thursday.'],
    ['jesse', '...It IS Thursday now. Checkmate.'],
  ], () => {
    say([
      ['narr', 'The whole hive shudders. Deep below, something goes critical.'],
      ['bigt', 'Why is the FLOOR making THAT noise?!', 'yell'],
      ['eli', 'Oh great. It\'s the exploding-planet brothers.'],
      ['richie', 'The wall! The wall broke! There\'s a shaft! GO GO GO, DUDE!', 'yell'],
    ], startEscape);
  });
}
function startEscape() {
  G.escape = true; G.escapeT = (G.easy ? 150 : 110) * 60;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y][x] === 'G') { grid[y][x] = '.'; puff(x * TS + 8, y * TS + 8, 8, '255,176,58', { max: 2.5 }); }
  redrawAround(6, 58); redrawAround(3, 13);
  enemies.forEach(e => e.dead = true);
  Snd.music('escape'); Snd.sfx.boom(); shake = 14;
  $('timer').hidden = false;
  banner('GET TO THE SHIP', 'The planet is coming apart. Up the shaft, left of the arena. Move!');
}
function updateEscape() {
  if (!G.escape) return;
  G.escapeT--;
  shake = Math.max(shake, 1.6);
  if (frame % 120 === 0) Snd.sfx.alarm();
  if (frame % 4 === 0) parts.push({ x: cam.x + rand(0, VW), y: cam.y - 4, vx: rand(-0.3, 0.3), vy: rand(1, 2.5), life: 120, max: 120, col: '255,176,58', size: 1, add: true });
  if (frame % 45 === 0) rocks.push({ x: P.x + rand(-90, 90), y: cam.y - 10, w: 8, h: 8, vx: 0, vy: 0 });
  const s = Math.max(0, Math.ceil(G.escapeT / 60));
  $('timer').textContent = `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('hot', s <= 20);
  if (G.escapeT <= 0) { flashA = 1; Snd.sfx.boom(); die(true); }
}
function updateRocks() {
  for (const r of rocks) {
    r.vy = Math.min(r.vy + 0.18, 5); r.y += r.vy;
    if (isSolid(tileAt(Math.floor((r.x + 4) / TS), Math.floor((r.y + 8) / TS))) || r.y > cam.y + 220) { r.dead = true; puff(r.x + 4, r.y + 4, 6, '180,150,130', { max: 1.6, grav: 0.1, add: false }); }
    else if (P.inv <= 0 && overlap(r, P)) { r.dead = true; hurt(10, r.x + 4); }
  }
  rocks = rocks.filter(r => !r.dead);
}

// ---------------- death / respawn
function die(planet) {
  if (P.dead) return;
  P.dead = true; state = 'dead'; G.deaths = (G.deaths || 0) + 1; Snd.sfx.boom();
  puff(P.x + 5, P.y + 7, 40, CREW[G.who].suit.slice(1).match(/../g).map(h => parseInt(h, 16)).join(','), { max: 3 });
  $('deadmsg').textContent = planet ? 'THE PLANET WON' : 'SUIT FAILURE';
  $('deadsub').textContent = planet ? 'Shaft\'s to the left of the arena. Try again.' : 'Respawning at last checkpoint…';
  showScreen('dead');
  setTimeout(respawn, 1800);
}
function respawn() {
  showScreen(null);
  shots = []; rocks = []; orbs = [];
  if (G.escape) {
    G.escapeT = (G.easy ? 150 : 110) * 60;
    P = newPlayer(20 * TS, 61 * TS);
  } else {
    P = newPlayer(G.checkpoint.x, G.checkpoint.y);
    if (boss) { boss = null; $('bossbar').hidden = true; Snd.music('explore'); enemies = enemies.filter(e => !e.boss); }
  }
  trail = [];
  enemies.forEach(e => { if (e.dead && !e.boss && !G.escape) Object.assign(e, makeEnemy(e.type, e.home.x, e.home.y)); });
  snapCam(); state = 'play';
}

// ---------------- crew followers
function crewList() { return G.order.map(k => k === 'other' ? G.other : k); }
function updateCrew() {
  const list = crewList();
  list.forEach((who, i) => {
    if (frame % 80 !== (i * 20) % 80) return;
    const tp = trail[Math.min(trail.length - 1, 14 * (i + 1))]; if (!tp) return;
    let best = null, bd = 130;
    for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - tp.x, e.y - tp.y); if (d < bd) { bd = d; best = e; } }
    let tgt = best ? { x: best.x + best.w / 2, y: best.y + best.h / 2 } : null;
    if (!tgt && boss && !boss.dying) tgt = { x: boss.x + boss.w / 2, y: boss.y + boss.h / 2 };
    if (!tgt || Math.hypot(tgt.x - tp.x, tgt.y - tp.y) > 200) return;
    const a = Math.atan2(tgt.y - tp.y - 8, tgt.x - tp.x - 5);
    const col = CREW[who].trim.slice(1).match(/../g).map(h => parseInt(h, 16)).join(',');
    shots.push({ x: tp.x + 5, y: tp.y + 8, vx: Math.cos(a) * 3.6, vy: Math.sin(a) * 3.6, r: 2, life: 50, dmg: 0.5, col, crew: true });
  });
}

// ---------------- camera
function snapCam() { cam.x = clamp(P.x + 5 - VW / 2, 0, MW * TS - VW); cam.y = clamp(P.y + 7 - VH / 2 - 10, 0, MH * TS - VH); }
function updateCam() {
  const tx = clamp(P.x + 5 - VW / 2 + P.face * 26, 0, MW * TS - VW), ty = clamp(P.y + 7 - VH / 2 - (boss ? 40 : 8), 0, MH * TS - VH);
  cam.x += (tx - cam.x) * 0.1; cam.y += (ty - cam.y) * 0.14;
  if (shake > 0) shake *= 0.88;
  if (frame % 8 === 0) {
    const x0 = Math.floor(cam.x / TS), y0 = Math.floor(cam.y / TS);
    for (let y = y0; y <= y0 + Math.ceil(VH / TS); y++) for (let x = x0; x <= x0 + Math.ceil(VW / TS); x++) if (x < MW && y < MH) explored[y * MW + x] = 1;
  }
}

// ---------------- main update
function update() {
  frame++; T = frame / 60;
  Object.assign(prev, input);
  for (const k in input) input[k] = kb[k] || tc[k];
  if (state === 'play') G.time = (G.time || 0) + 1;
  if (state === 'play') {
    updatePlayer(); updateEnemies(); updateShots(); updateCrew(); updateBoss(); updateEscape(); updateRocks();
    for (const o of orbs) { o.life--; o.vy = Math.min(o.vy + 0.05, 1); if (!isSolid(tileAt(Math.floor(o.x / TS), Math.floor((o.y + 4) / TS)))) o.y += o.vy; }
    orbs = orbs.filter(o => o.life > 0);
    updateCam(); updateHUD();
  }
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += p.grav || 0; p.vx *= 0.97; p.life--; }
  parts = parts.filter(p => p.life > 0);
  if (parts.length > 600) parts.splice(0, parts.length - 600);
  if (flashA > 0) flashA = Math.max(0, flashA - 0.04);
  if (state === 'dialog') tickDialog();
  if (toastT > 0 && --toastT === 0) $('toast').classList.remove('show');
  if (state === 'dialog' || state === 'banner') {
    if (pressed('jump') || pressed('fire')) advance();
  }
}

// ---------------- render world
function render() {
  const cine = state === 'ending' || scene === 'orbit' || state === 'title' || state === 'select' || state === 'boot' || state === 'credits';
  if (cine) setView(320, 180); else setView(wantView.w, wantView.h);
  if (state === 'ending') { renderEnding(); return; }
  if (scene === 'orbit' || state === 'title' || state === 'select' || state === 'boot' || (state === 'credits')) { renderOrbit(); return; }
  if (!P) return;
  const sx = Math.round(cam.x + (shake ? rand(-shake, shake) : 0)), sy = Math.round(cam.y + (shake ? rand(-shake, shake) : 0));
  const z = zoneAt(Math.floor((cam.x + VW / 2) / TS), Math.floor((cam.y + VH / 2) / TS));
  if (z !== bgZone) { bgPrev = bgZone; bgZone = z; bgFade = 1; }
  drawBG(ctx, bgZone, sx, sy, T);
  if (bgFade > 0) { ctx.globalAlpha = bgFade; drawBG(ctx, bgPrev, sx, sy, T); ctx.globalAlpha = 1; bgFade = Math.max(0, bgFade - 0.03); }
  ctx.drawImage(tileCanvas, sx, sy, VW, VH, 0, 0, VW, VH);
  lights = [];
  // dynamic tiles: gates, seals, crystal shimmer
  const tx0 = Math.floor(sx / TS), ty0 = Math.floor(sy / TS);
  for (let ty = ty0; ty <= ty0 + Math.ceil(VH / TS); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VW / TS); tx++) {
    const ch = tileAt(tx, ty), x = tx * TS - sx, y = ty * TS - sy;
    if (ch === 'D') {
      const pul = 0.5 + 0.5 * Math.sin(T * 3 + ty);
      ctx.fillStyle = '#4a0a24'; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = `rgba(255,61,110,${0.35 + pul * 0.4})`; ctx.fillRect(x + 3, y, 2, TS); ctx.fillRect(x + 10, y, 1, TS);
      ctx.fillStyle = '#ff9a3d'; ctx.fillRect(x + 6, y + 6 + Math.round(pul * 3), 3, 3);
      lights.push({ x: x + 8, y: y + 8, r: 26, col: '255,61,110', i: 0.5 });
    } else if (ch === 'G') {
      ctx.fillStyle = '#2b2531'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#4a4054'; ctx.fillRect(x + 1, y + 1, TS - 2, 2);
      ctx.fillStyle = '#ffb03a'; ctx.fillRect(x + 4, y + 7, 7, 1); ctx.fillRect(x + 9, y + 4, 1, 4);
    } else if (ch === 'X' && Math.sin(T * 2 + tx * 1.3 + ty) > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 6, y + 3, 3, 1);
      lights.push({ x: x + 8, y: y + 8, r: 20, col: '176,77,255', i: 0.35 });
    }
  }
  // decor
  for (const d of decor) { const x = d.x - sx, y = d.y - sy; if (x > -20 && x < VW + 20 && y > -30 && y < VH + 30) drawDecor(ctx, d, x, y, T, lights); }
  // ship
  const shx = shipPos.x - 20 - sx, shy = shipPos.y - 40 - sy;
  if (shx > -90 && shx < VW + 20 && shy > -60 && shy < VH + 10) { drawShip(ctx, shx, shy, T); lights.push({ x: shx + 56, y: shy + 16, r: 50, col: '95,246,255', i: 0.7 }); lights.push({ x: shx + 30, y: shy + 40, r: 70, col: '255,240,255', i: 0.45 }); }
  // crashed dropship wreck (decor, crash site)
  drawWreck(44 * TS - sx, 12 * TS - sy);
  // items
  for (const it of items) {
    if (taken(it)) continue;
    const x = it.x - sx, y = it.y - sy + Math.sin(T * 3 + it.x) * 2;
    if (x < -20 || x > VW + 20 || y < -20 || y > VH + 20) continue;
    if (it.type === 'F') { ctx.fillStyle = '#2a2f45'; ctx.fillRect(x - 4, y - 6, 8, 12); ctx.fillStyle = '#ffe65a'; ctx.fillRect(x - 3, y - 4, 6, 8); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 3, 1, 5); ctx.fillStyle = '#9aa3b8'; ctx.fillRect(x - 4, y - 7, 8, 2); ctx.fillRect(x - 4, y + 5, 8, 2); lights.push({ x, y, r: 40, col: '255,230,90', i: 0.95 }); }
    else if (it.type === 'H') { ctx.fillStyle = '#ff5aaa'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 3, 2, 2); ctx.strokeStyle = '#ffd1ea'; ctx.beginPath(); ctx.arc(x, y, 7 + Math.sin(T * 5), 0, 7); ctx.stroke(); lights.push({ x, y, r: 36, col: '255,90,170', i: 0.9 }); }
    else { ctx.fillStyle = '#111'; ctx.fillRect(x - 7, y - 4, 14, 9); ctx.fillStyle = '#ddd'; ctx.fillRect(x - 5, y - 3, 10, 3); ctx.fillStyle = '#e8433b'; ctx.fillRect(x - 5, y - 3, 3, 3); ctx.fillStyle = '#555'; ctx.fillRect(x - 4, y + 1, 3, 3); ctx.fillRect(x + 1, y + 1, 3, 3); lights.push({ x, y, r: 22, col: '220,220,255', i: 0.5 }); }
  }
  // orbs
  for (const o of orbs) { const x = o.x - sx, y = o.y - sy; if (o.life < 120 && frame % 8 < 4) continue; ctx.fillStyle = '#ff5aaa'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 1, 1); lights.push({ x, y, r: 16, col: '255,90,170', i: 0.7 }); }
  // stranded crew
  drawStranded(sx, sy);
  // enemies
  for (const e of enemies) {
    if (e.dead) continue; const x = e.x - sx, y = e.y - sy;
    if (x < -30 || x > VW + 30 || y < -30 || y > VH + 30) continue;
    const ev = { ...e, x, y };
    if (e.type === 'c') { drawCrawler(ctx, ev, T); lights.push({ x: x + 6, y: y + 5, r: 14, col: '184,255,58', i: 0.4 }); }
    else if (e.type === 'f') { drawFlyer(ctx, ev, T); lights.push({ x: x + 6, y: y + 5, r: 22, col: '255,225,74', i: 0.6 }); }
    else { drawTurret(ctx, ev, T); lights.push({ x: x + 6, y: y + 6, r: 18, col: '255,176,58', i: 0.5 }); }
  }
  if (boss) { const bv = { ...boss, x: boss.x - sx, y: boss.y - sy }; drawBoss(ctx, bv, T); lights.push({ x: bv.x + bv.w / 2, y: bv.y + bv.h / 2, r: 110, col: boss.enraged ? '255,40,40' : '255,92,138', i: 0.9 }); }
  // rocks
  for (const r of rocks) { ctx.fillStyle = '#6a5550'; ctx.fillRect(r.x - sx, r.y - sy, 8, 8); ctx.fillStyle = '#8a7570'; ctx.fillRect(r.x - sx + 1, r.y - sy + 1, 4, 2); lights.push({ x: r.x - sx + 4, y: r.y - sy + 4, r: 12, col: '255,176,58', i: 0.4 }); }
  // crew followers
  const list = crewList();
  for (let i = list.length - 1; i >= 0; i--) {
    const tp = trail[Math.min(trail.length - 1, 14 * (i + 1))]; if (!tp) continue;
    drawSpaceman(ctx, tp.x - sx - 1, tp.y - sy - 4, list[i], { face: tp.face, frame: tp.frame, air: tp.air, aim: 'side' });
    lights.push({ x: tp.x - sx + 5, y: tp.y - sy + 6, r: 34, col: null, i: 0.6 });
  }
  // player
  if (!P.dead && !(P.inv > 0 && P.inv < 60 && frame % 6 < 3)) {
    drawSpaceman(ctx, P.x - sx - 1, P.y - sy - 4, G.who, { face: P.face, frame: P.frame, air: !P.onGround, aim: P.aim, flash: P.hurtFlash > 0 || (P.charge >= 38 && frame % 6 < 2) });
  }
  if (!P.dead) lights.push({ x: P.x - sx + 5, y: P.y - sy + 6, r: 82, col: '200,220,255', i: 1 });
  if (P.charge > 20) lights.push({ x: P.x - sx + 5, y: P.y - sy + 8, r: 20 + Math.min(P.charge, 38) * 0.6, col: '255,122,240', i: 0.9 });
  // shots
  for (const s of shots) {
    const x = s.x - sx, y = s.y - sy;
    ctx.fillStyle = `rgb(${s.col})`; ctx.fillRect(x - s.r, y - s.r * (s.vy && !s.hostile ? 1.5 : 0.6), s.r * 2, s.r * 2 * (s.vy && !s.hostile ? 1.5 : 0.6));
    ctx.fillStyle = '#fff'; ctx.fillRect(x - s.r / 2, y - s.r / 3, s.r, Math.max(1, s.r * 0.6));
    lights.push({ x, y, r: s.big ? 46 : 22, col: s.col, i: 0.9 });
  }
  // acid overlay
  for (let ty = ty0; ty <= ty0 + Math.ceil(VH / TS); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VW / TS); tx++) {
    if (tileAt(tx, ty) !== '~') continue;
    const x = tx * TS - sx, y = ty * TS - sy, surf = tileAt(tx, ty - 1) !== '~';
    ctx.fillStyle = 'rgba(120,230,40,.42)'; ctx.fillRect(x, y, TS, TS);
    if (surf) {
      for (let i = 0; i < TS; i += 2) { const h = Math.sin(T * 4 + (tx * TS + i) * 0.3) * 1.2; ctx.fillStyle = 'rgba(214,255,120,.9)'; ctx.fillRect(x + i, y + 1 + h, 2, 1); }
      if (tx % 2 === 0) lights.push({ x: x + 8, y: y + 2, r: 26, col: '182,255,58', i: 0.5 });
      if (Math.random() < 0.01) parts.push({ x: tx * TS + rand(0, 16), y: ty * TS, vx: 0, vy: -0.4, life: 30, max: 30, col: '214,255,120', size: 1, add: true });
    }
  }
  // particles
  for (const p of parts) {
    const a = Math.min(1, p.life / 20);
    ctx.fillStyle = `rgba(${p.col},${a})`; ctx.fillRect(Math.round(p.x - sx), Math.round(p.y - sy), p.size, p.size);
  }
  // lighting
  const za = ZP[z]; let ta = za.amb; if (G.escape) ta = Math.max(0.35, ta - 0.25);
  amb += (ta - amb) * 0.05; for (let i = 0; i < 3; i++) darkCol[i] += (za.dark[i] - darkCol[i]) * 0.05;
  if (amb > 0.02) {
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, VW, VH);
    lctx.fillStyle = `rgba(${darkCol.map(v => v | 0).join(',')},${amb})`; lctx.fillRect(0, 0, VW, VH);
    lctx.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      if (L.x < -L.r || L.x > VW + L.r || L.y < -L.r || L.y > VH + L.r) continue;
      const g = lctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, `rgba(0,0,0,${L.i})`); g.addColorStop(0.5, `rgba(0,0,0,${L.i * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.drawImage(lightCv, 0, 0);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    if (!L.col || L.x < -L.r || L.x > VW + L.r || L.y < -L.r || L.y > VH + L.r) continue;
    const r = L.r * 0.55, g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
    g.addColorStop(0, `rgba(${L.col},${0.22 * L.i})`); g.addColorStop(1, `rgba(${L.col},0)`);
    ctx.fillStyle = g; ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (G.escape) { ctx.fillStyle = `rgba(255,30,40,${0.08 + 0.08 * Math.sin(T * 6)})`; ctx.fillRect(0, 0, VW, VH); }
  if (flashA > 0) { ctx.fillStyle = `rgba(${flashCol},${flashA})`; ctx.fillRect(0, 0, VW, VH); }
}
function drawWreck(x, y) {
  if (x < -80 || x > VW + 40 || y < -40 || y > VH + 20) return;
  ctx.fillStyle = '#2a2d40'; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 10, y - 14); ctx.lineTo(x + 26, y - 18); ctx.lineTo(x + 34, y); ctx.fill();
  ctx.fillStyle = '#c9cce0'; ctx.fillRect(x - 6, y - 14, 26, 5); ctx.fillStyle = '#0d0d12'; ctx.fillRect(x - 4, y - 12, 20, 1);
  ctx.fillStyle = '#ff4fa3'; ctx.fillRect(x + 22, y - 16, 4, 3);
  ctx.fillStyle = '#16131f'; ctx.fillRect(x + 4, y - 8, 9, 8);
  if (frame % 6 === 0) parts.push({ x: x + 44 * 0 + cam.x + rand(0, 16), y: y + cam.y - 16, vx: rand(-0.1, 0.25), vy: rand(-0.6, -0.3), life: 70, max: 70, col: '120,110,140', size: 2, add: false });
  if (frame % 10 === 0) parts.push({ x: cam.x + x + rand(0, 10), y: cam.y + y - 10, vx: rand(-0.3, 0.3), vy: -0.8, life: 14, max: 14, col: '255,154,61', size: 1, add: true });
  lights.push({ x: x + 6, y: y - 8, r: 30, col: '255,154,61', i: 0.6 });
}
function drawStranded(sx, sy) {
  const r = npcs.richie, e = npcs.eli, t = npcs.bigt;
  if (!G.crew.richie) { const x = r.x - sx, y = r.y - sy; if (x > -40 && x < VW + 40) {
    ctx.fillStyle = 'rgba(120,255,80,.35)'; ctx.beginPath(); ctx.ellipse(x, y - 10, 11 + Math.sin(T * 3), 13, 0, 0, 7); ctx.fill();
    drawSpaceman(ctx, x - 6, y - 18, 'richie', { face: -1, frame: Math.floor(T * 6) % 4, air: true });
    ctx.fillStyle = 'rgba(160,255,110,.5)'; ctx.beginPath(); ctx.ellipse(x, y - 10, 9, 11, 0, 0, 7); ctx.fill();
    lights.push({ x, y: y - 10, r: 40, col: '160,255,110', i: 0.8 });
    if (Math.floor(T * 1.5) % 3 === 0) bubble(x, y - 32, 'HELP, DUDE!'); } }
  if (!G.crew.eli) { const x = e.x - sx, y = e.y - sy; if (x > -40 && x < VW + 40) {
    drawSpaceman(ctx, x - 6, y - 18, 'eli', { face: Math.sin(T * 1.3) > 0 ? 1 : -1, frame: 0 });
    ctx.fillStyle = '#e8ecff'; const a = Math.sin(T * 6) * 0.8; ctx.save(); ctx.translate(x + 2, y - 10); ctx.rotate(a - 0.8); ctx.fillRect(0, -1, 14, 2); ctx.restore();
    lights.push({ x, y: y - 10, r: 40, col: '255,157,176', i: 0.8 });
    if (Math.floor(T * 1.5) % 3 === 1) bubble(x, y - 30, 'HI-YAH.'); } }
  if (!G.crew.bigt) { const x = t.x - sx, y = t.y - sy; if (x > -40 && x < VW + 40) {
    drawSpaceman(ctx, x - 6, y - 16, 'bigt', { face: 1, frame: 0 });
    ctx.fillStyle = '#7dd13a'; ctx.fillRect(x + 8, y - 6, 4, 6); ctx.fillStyle = '#e9e7f2'; ctx.fillRect(x + 9, y - 8, 2, 2);
    if (frame % 14 === 0) parts.push({ x: t.x + 10, y: t.y - 8, vx: rand(-0.2, 0.2), vy: -0.5, life: 40, max: 40, col: '182,255,58', size: 1, add: true });
    lights.push({ x, y: y - 10, r: 40, col: '255,207,122', i: 0.8 });
    if (Math.floor(T * 1.5) % 3 === 2) bubble(x, y - 30, 'BROWN TOWN!'); } }
  if (!G.crew.other && capturedPos) { const x = capturedPos.x - sx, y = capturedPos.y - sy; if (x > -40 && x < VW + 40 && y > -60 && y < VH + 40) {
    ctx.fillStyle = 'rgba(255,61,110,.35)'; ctx.beginPath(); ctx.ellipse(x, y - 14, 12, 17, 0, 0, 7); ctx.fill();
    drawSpaceman(ctx, x - 6, y - 24, G.other, { face: -1, frame: Math.floor(T * 4) % 4, air: true });
    ctx.fillStyle = 'rgba(255,90,140,.45)'; ctx.beginPath(); ctx.ellipse(x, y - 14, 10, 15, 0, 0, 7); ctx.fill();
    lights.push({ x, y: y - 14, r: 40, col: '255,61,110', i: 0.8 }); } }
}
function bubble(x, y, text) {
  ctx.font = '8px "Press Start 2P", monospace'; const w = Math.min(ctx.measureText(text).width, 90) + 8;
  ctx.fillStyle = 'rgba(10,6,20,.85)'; ctx.fillRect(Math.round(x - w / 2), y - 9, w, 12); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x - 1), y + 3, 2, 2);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, Math.round(x), y); ctx.textAlign = 'left';
}

// ---------------- orbit backdrop (title + intro)
function renderOrbit() {
  ctx.fillStyle = '#04020c'; ctx.fillRect(0, 0, VW, VH);
  STARS.forEach(s => { const a = 0.3 + 0.7 * Math.abs(Math.sin(T * (0.4 + s.s) + s.p)); ctx.fillStyle = `rgba(255,240,255,${a})`; ctx.fillRect(((s.x - T * 4 * (0.3 + s.s)) % 320 + 320) % 320, s.y, s.s > 0.92 ? 2 : 1, 1); });
  // nebula
  const ng = ctx.createRadialGradient(80, 60, 0, 80, 60, 140); ng.addColorStop(0, 'rgba(255,79,163,.18)'); ng.addColorStop(1, 'rgba(255,79,163,0)'); ctx.fillStyle = ng; ctx.fillRect(0, 0, VW, VH);
  const ng2 = ctx.createRadialGradient(260, 30, 0, 260, 30, 120); ng2.addColorStop(0, 'rgba(61,252,255,.12)'); ng2.addColorStop(1, 'rgba(61,252,255,0)'); ctx.fillStyle = ng2; ctx.fillRect(0, 0, VW, VH);
  // planet
  const px = 250, py = 210, r = 120;
  const atm = ctx.createRadialGradient(px, py, r * 0.9, px, py, r * 1.25); atm.addColorStop(0, 'rgba(255,120,200,.5)'); atm.addColorStop(1, 'rgba(255,120,200,0)');
  ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(px, py, r * 1.25, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(px - 50, py - 80, 10, px, py, r); g.addColorStop(0, '#ffcf9a'); g.addColorStop(0.35, '#d24a86'); g.addColorStop(0.75, '#4a1460'); g.addColorStop(1, '#14061e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.clip();
  for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(${i % 2 ? '60,10,70' : '255,170,200'},.13)`; ctx.fillRect(px - r, py - r + 14 + i * 13 + Math.sin(T * 0.2 + i) * 2, r * 2, 5); }
  ctx.restore();
  // ship drifting
  if (state !== 'title' || true) drawShip(ctx, 60 + Math.sin(T * 0.6) * 6, 66 + Math.sin(T * 0.9) * 4, T, { flying: true });
  if (scene === 'orbit' && G && G.introDrop) { // dropship streaking down
    const k = (frame % 180) / 180; ctx.fillStyle = '#fff'; ctx.fillRect(140 + k * 90, 90 + k * 70, 3, 2);
    ctx.strokeStyle = 'rgba(255,154,61,.7)'; ctx.beginPath(); ctx.moveTo(140 + k * 90, 91 + k * 70); ctx.lineTo(120 + k * 90, 76 + k * 70); ctx.stroke();
  }
}

// ---------------- the ending: the car-radio ride
let endT = 0;
function startEnding() {
  if (state === 'ending') return;
  G.escape = false; $('timer').hidden = true; $('hud').hidden = true;
  state = 'ending'; endT = 0; $('app').classList.add('ending'); Snd.music('ending'); clearSave();
  G.flags.finished = true;
  $('controls').classList.add('dim');
  const O = G.other;
  ENDCAPS = [
    [210, 'bigt', 'TURN IT UP!!'],
    [380, 'richie', 'Dude. Whose playlist is this?'],
    [560, 'jesse', 'My AI made it. "Songs for Leaving Exploding Planets, Vol. 1."'],
    [780, 'ian', '...It\'s good. I hate that it\'s good.'],
    [960, 'eli', 'Oh great. It\'s the road-trip brothers.'],
    [1130, 'richie', 'Shotgun, by the way. I called it back on the planet.'],
    [1300, 'bigt', 'BAD BOYS FOR LIFE! ...IN SPACE!'],
  ];
  if (G.tape) ENDCAPS.push([1500, 'narr', 'Under the seat: SPORTS PAGES VOL. 46. Nobody admits to anything.']);
}
let ENDCAPS = [];
function renderEnding() {
  endT++;
  const beat = Snd.beat();
  if (endT < 200) { // exterior: planet blows, ship rockets away
    ctx.fillStyle = '#03010a'; ctx.fillRect(0, 0, VW, VH);
    STARS.forEach(s => { ctx.fillStyle = `rgba(255,240,255,${0.5 + s.s * 0.5})`; ctx.fillRect(((s.x - endT * 6 * (0.3 + s.s)) % 320 + 320) % 320, s.y, 1 + s.s * 6, 1); });
    const pr = 70, pxx = 80, pyy = 100;
    if (endT < 60) { const g = ctx.createRadialGradient(pxx, pyy, 5, pxx, pyy, pr); g.addColorStop(0, '#ffcf9a'); g.addColorStop(0.5, '#d24a86'); g.addColorStop(1, '#2a0a3a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pxx, pyy, pr, 0, 7); ctx.fill(); if (endT % 8 < 4) { ctx.fillStyle = 'rgba(255,240,180,.6)'; ctx.fillRect(pxx - 4, pyy - 30, 8, 60); } }
    else {
      const k = endT - 60;
      ctx.strokeStyle = `rgba(255,220,160,${Math.max(0, 1 - k / 120)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(pxx, pyy, k * 3, k * 0.9, -0.2, 0, 7); ctx.stroke();
      const g = ctx.createRadialGradient(pxx, pyy, 0, pxx, pyy, 30 + k); g.addColorStop(0, `rgba(255,255,255,${Math.max(0, 1 - k / 80)})`); g.addColorStop(0.4, `rgba(255,154,61,${Math.max(0, 0.8 - k / 120)})`); g.addColorStop(1, 'rgba(255,61,110,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pxx, pyy, 30 + k, 0, 7); ctx.fill();
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28 + i; ctx.fillStyle = '#ffb03a'; ctx.fillRect(pxx + Math.cos(a) * k * (1 + (i % 3)) * 0.8, pyy + Math.sin(a) * k * 0.5 * (1 + (i % 2)), 2, 2); }
      if (endT === 61) { Snd.sfx.boom(); flashA = 1; }
    }
    drawShip(ctx, 140 + Math.min(endT, 160) * 0.6 + Math.sin(endT * 0.3) * 1, 70 + Math.sin(endT * 0.1) * 3, endT / 60, { flying: true });
    if (flashA > 0) { ctx.fillStyle = `rgba(255,255,255,${flashA})`; ctx.fillRect(0, 0, VW, VH); flashA -= 0.02; }
    return;
  }
  // interior: windshield view, everybody headbanging
  ctx.fillStyle = '#05020e'; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 70; i++) { // hyperspace streaks behind them
    const a = hash(i, 9) * 6.28, d = ((hash(i, 10) * 200 + endT * (2 + hash(i, 11) * 4)) % 220);
    const x = 160 + Math.cos(a) * d, y = 70 + Math.sin(a) * d * 0.6;
    ctx.strokeStyle = `rgba(${i % 3 ? '160,220,255' : '255,122,240'},${d / 220})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(160 + Math.cos(a) * (d - 8 - d * 0.1), 70 + Math.sin(a) * (d - 8 - d * 0.1) * 0.6); ctx.stroke();
  }
  // cabin
  ctx.fillStyle = '#1a1626'; ctx.fillRect(0, 118, VW, 62);
  const bang = Math.pow(Math.abs(Math.sin(beat * Math.PI)), 3);
  const O = G.other;
  // seat logic: front = player (driver) + Richie (shotgun, obviously). back = Eli, other, Big T
  const back = [['eli', 56], [O, 160], ['bigt', 264]], front = [[G.who, 106], ['richie', 214]];
  const ianLate = (who) => who === 'ian' && endT < 800 ? 0.15 : 1;
  for (const [who, x] of back) {
    const b = bang * 7 * (who === 'bigt' ? 1.5 : 1) * ianLate(who);
    ctx.fillStyle = '#2c2438'; ctx.fillRect(x - 24, 70, 48, 50);
    ctx.save(); ctx.translate(x - 20, 52 + b); ctx.scale(1, 1); drawPortrait(ctx, who, { noBg: true, t: endT / 60, mood: endT % 300 < 150 && who === 'bigt' ? 'yell' : 'smirk' }); ctx.restore();
  }
  ctx.fillStyle = '#3a3148'; ctx.fillRect(0, 108, VW, 8);
  for (const [who, x] of front) {
    const b = bang * 10 * ianLate(who);
    ctx.fillStyle = '#3a3150'; ctx.fillRect(x - 36, 100, 72, 60);
    ctx.save(); ctx.translate(x - 32, 78 + b); ctx.scale(1.6, 1.6); drawPortrait(ctx, who, { noBg: true, t: endT / 60, mood: 'yell' }); ctx.restore();
  }
  // windshield frame + dash
  ctx.fillStyle = '#0c0a14'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, 0); ctx.lineTo(14, 180); ctx.lineTo(0, 180); ctx.fill();
  ctx.beginPath(); ctx.moveTo(VW, 0); ctx.lineTo(VW - 34, 0); ctx.lineTo(VW - 14, 180); ctx.lineTo(VW, 180); ctx.fill();
  ctx.fillRect(0, 0, VW, 8);
  ctx.fillStyle = 'rgba(160,220,255,.05)'; ctx.beginPath(); ctx.moveTo(60, 8); ctx.lineTo(110, 8); ctx.lineTo(40, 150); ctx.lineTo(20, 150); ctx.fill();
  // rear-view mirror + fuzzy dice
  ctx.fillStyle = '#222'; ctx.fillRect(152, 8, 2, 8); ctx.fillStyle = '#3a3a48'; ctx.fillRect(138, 14, 30, 8);
  const sw = Math.sin(endT * 0.12) * 6 + bang * 4;
  ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(150, 22); ctx.lineTo(146 + sw, 38); ctx.moveTo(156, 22); ctx.lineTo(158 + sw, 36); ctx.stroke();
  ctx.fillStyle = '#ff4fa3'; ctx.fillRect(142 + sw, 37, 8, 8); ctx.fillStyle = '#4ff0ff'; ctx.fillRect(155 + sw, 35, 8, 8);
  ctx.fillStyle = '#fff'; [[144, 39], [147, 42], [157, 37], [160, 40], [157, 40]].forEach(([x, y]) => ctx.fillRect(x + sw, y, 1, 1));
  // dash + radio
  ctx.fillStyle = '#100c1a'; ctx.fillRect(0, 150, VW, 30); ctx.fillStyle = '#2a2238'; ctx.fillRect(0, 150, VW, 2);
  ctx.fillStyle = '#05040a'; ctx.fillRect(110, 156, 100, 20); ctx.strokeStyle = '#4a3a66'; ctx.strokeRect(110.5, 156.5, 100, 20);
  ctx.fillStyle = '#4ff0ff'; ctx.font = '8px "Press Start 2P", monospace';
  const msg = '  KSPC 88.5 * SPACE ROCK * SONGS FOR LEAVING EXPLODING PLANETS VOL.1 *';
  const off = Math.floor(endT / 8) % msg.length; ctx.fillText((msg + msg).slice(off, off + 11), 114, 166);
  for (let i = 0; i < 12; i++) { const h = 2 + Math.abs(Math.sin(endT * 0.15 + i * 1.7)) * 5 * (0.4 + bang); ctx.fillStyle = i < 8 ? '#a6ff3a' : '#ff4fa3'; ctx.fillRect(114 + i * 8, 175 - h, 6, h); }
  // captions
  const cap = [...ENDCAPS].reverse().find(c => endT >= c[0] && endT < c[0] + 190);
  showCaption(cap);
  if (endT === 1820) { showCaption(null); showCredits(); }
}
let lastCap = null;
function showCaption(cap) {
  const el = $('caption');
  if (cap === lastCap) return; lastCap = cap;
  if (!cap) { el.classList.remove('show'); return; }
  el.innerHTML = ''; if (cap[1] !== 'narr') { const n = document.createElement('b'); n.textContent = CREW[cap[1]].name + ': '; el.appendChild(n); }
  el.appendChild(document.createTextNode(cap[2])); el.classList.add('show');
}
