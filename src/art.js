// ---------- ART: all procedural, original pixel art ----------
const CREW = {
  jesse: { name: 'J', full: 'JESSE "J"', suit: '#ffd23f', trim: '#2a2238', boot: '#e8433b', visor: '#4ff0ff', skin: '#f1c9a5', hair: '#c9a35a', hairStyle: 'curly' },
  ian:   { name: 'IAN', full: 'IAN', suit: '#3a4256', trim: '#38e0c8', boot: '#15151d', visor: '#0b0b12', skin: '#e2b58c', hair: '#d9c48e', hairStyle: 'short', shades: true },
  richie:{ name: 'RICH', full: 'RICHIE', suit: '#ff8a2a', trim: '#a6ff3a', boot: '#f2f2f2', visor: '#9ffcff', skin: '#f0c7a1', hair: '#2a1d16', hairStyle: 'beanie', beanie: '#a6ff3a' },
  eli:   { name: 'E', full: 'ELI "E"', suit: '#e9e7f2', trim: '#d0213f', boot: '#2a2238', visor: '#ff9db0', skin: '#6b4226', hair: '#140e0b', hairStyle: 'afro', katana: true },
  bigt:  { name: 'BIG T', full: 'BIG T', suit: '#7a4e2a', trim: '#4a2e17', boot: '#2e1c0e', visor: '#ffcf7a', skin: '#f3cfae', hair: '#0e0c0c', hairStyle: 'straight' },
};

// deterministic hash noise
const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
const shade = (hex, f) => { // f<1 darker, >1 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

// Astronaut, 12x18, anchored at top-left of hitbox (10x14) offset
function drawSpaceman(c, x, y, who, o = {}) {
  const P = CREW[who]; const f = o.face || 1; const fr = o.frame || 0;
  x = Math.round(x); y = Math.round(y);
  c.save(); c.translate(x + 6, y); if (f < 0) c.scale(-1, 1); c.translate(-6, 0);
  const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
  const flash = o.flash;
  const S = flash ? '#fff' : P.suit, T = flash ? '#fff' : P.trim;
  // backpack
  R(shade(P.suit, 0.6), 0, 6, 3, 7); R(T, 0, 8, 2, 1);
  if (P.katana && !flash) { R('#cfd6ff', -1, 2, 1, 9); R('#d0213f', -1, 10, 1, 2); }
  // legs
  const run = o.air ? 0 : fr;
  const lA = [0, 2, 0, -2][run % 4], lB = -lA;
  R(shade(P.suit, 0.75), 3, 13, 3, 3 + (lA > 0 ? 0 : 0)); R(shade(P.suit, 0.85), 7, 13, 3, 3);
  R(P.boot, 3 + (lA > 0 ? 1 : lA < 0 ? -1 : 0), 16, 3, 2); R(P.boot, 7 + (lB > 0 ? 1 : lB < 0 ? -1 : 0), 16, 3, 2);
  if (o.air) { R(P.boot, 3, 15, 3, 2); R(P.boot, 8, 14, 3, 2); }
  // torso
  R(S, 2, 7, 9, 7); R(shade(P.suit, 1.25), 3, 7, 6, 1); R(T, 2, 11, 9, 1); R(shade(P.suit, 0.7), 2, 13, 9, 1);
  // arm + blaster
  const ay = o.aim === 'up' ? -3 : o.aim === 'down' ? 3 : 0;
  R(shade(P.suit, 0.85), 7, 8, 3, 3);
  if (o.aim === 'up') { R('#9aa3b8', 9, 2, 2, 7); R('#ff4fd8', 9, 1, 2, 1); }
  else if (o.aim === 'down') { R('#9aa3b8', 9, 10, 2, 6); R('#ff4fd8', 9, 16, 2, 1); }
  else { R('#9aa3b8', 9, 9 + ay, 5, 2); R('#4a5068', 9, 11 + ay, 2, 1); R('#ff4fd8', 14, 9 + ay, 1, 2); }
  // helmet
  R(flash ? '#fff' : '#e9ecf5', 2, 0, 9, 7); R('#b9bfd0', 2, 6, 9, 1); R(flash ? '#fff' : '#ffffff', 3, 0, 4, 1);
  R(P.visor, 5, 2, 6, 3); R(P.skin, 6, 3, 3, 2);
  if (P.shades) R('#050508', 6, 3, 4, 1);
  R('rgba(255,255,255,.75)', 9, 2, 1, 1);
  R(T, 2, 1, 1, 4);
  c.restore();
}

// Portrait, 40x40 (drawn at any scale by the caller's transform)
function drawPortrait(c, who, o = {}) {
  const P = CREW[who]; const t = o.t || 0;
  const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
  if (!o.noBg) { R(o.bg || '#140d26', 0, 0, 40, 40); for (let i = 0; i < 40; i += 2) R('rgba(255,255,255,.03)', 0, i, 40, 1); }
  // suit collar + shoulders
  R(P.suit, 4, 32, 32, 8); R(shade(P.suit, 1.2), 6, 32, 28, 1); R(P.trim, 4, 36, 32, 2);
  R('#c7ccda', 13, 29, 14, 4);
  // helmet ring (open helmet behind head)
  c.fillStyle = 'rgba(200,230,255,.18)'; c.beginPath(); c.arc(20, 18, 17, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(220,240,255,.5)'; c.lineWidth = 1; c.beginPath(); c.arc(20, 18, 16.5, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  const hs = P.hairStyle, H = P.hair, Hd = shade(P.hair, 0.7);
  // hair behind
  if (hs === 'curly') { for (let i = 0; i < 14; i++) { const a = Math.PI * (0.85 + i * 0.1); c.fillStyle = i % 2 ? H : Hd; c.beginPath(); c.arc(20 + Math.cos(a) * 11, 18 + Math.sin(a) * 11 + (i > 9 || i < 3 ? 6 : 0), 4, 0, 7); c.fill(); }
    R(H, 7, 18, 5, 14); R(H, 28, 18, 5, 14); R(Hd, 8, 26, 3, 7); R(Hd, 29, 26, 3, 7); }
  if (hs === 'straight') { R(H, 9, 8, 22, 15); }
  if (hs === 'afro') { c.fillStyle = H; c.beginPath(); c.ellipse(20, 13, 11, 8, 0, 0, 7); c.fill(); }
  // neck + face
  R(shade(P.skin, 0.85), 16, 26, 8, 5);
  c.fillStyle = P.skin; c.beginPath(); c.ellipse(20, 19, 8.5, 10, 0, 0, 7); c.fill();
  R(shade(P.skin, 0.85), 12, 22, 2, 3); R(shade(P.skin, 0.85), 26, 22, 2, 3);
  // hair front
  if (hs === 'curly') { for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? H : shade(P.hair, 1.15); c.beginPath(); c.arc(12 + i * 2.7, 10 + (i % 2), 3, 0, 7); c.fill(); } }
  if (hs === 'short') { R(H, 12, 8, 16, 4); R(shade(H, 1.15), 13, 8, 10, 1); R(H, 11, 10, 2, 4); R(H, 27, 10, 2, 3); }
  if (hs === 'straight') { R(H, 11, 9, 18, 4); R(H, 11, 12, 3, 6); R(H, 26, 12, 3, 6); R(shade(H, 1.6), 14, 9, 6, 1); }
  if (hs === 'afro') { c.fillStyle = H; c.beginPath(); c.ellipse(20, 11, 9.5, 4.5, 0, 0, 7); c.fill(); }
  if (hs === 'beanie') { R(P.beanie, 11, 6, 18, 6); R(shade(P.beanie, 0.7), 11, 11, 18, 2); R(P.beanie, 18, 4, 4, 2); R(H, 11, 13, 3, 5); R(H, 26, 13, 3, 5); }
  // eyes
  const blink = (Math.floor(t * 60) % 180) < 5;
  if (P.shades) { R('#050508', 13, 17, 14, 4); R('#050508', 12, 17, 16, 1); R('rgba(140,255,240,.8)', 14, 18, 3, 1); R('rgba(140,255,240,.8)', 22, 18, 3, 1); }
  else if (blink) { R('#2a1a14', 14, 19, 4, 1); R('#2a1a14', 22, 19, 4, 1); }
  else { R('#fff', 14, 18, 4, 3); R('#fff', 22, 18, 4, 3); R('#1a1220', 16, 18, 2, 3); R('#1a1220', 22, 18, 2, 3);
    R(shade(P.hair, 0.8), 13, 16, 5, 1); R(shade(P.hair, 0.8), 22, 16, 5, 1); }
  // mouth
  const talk = o.talk && (Math.floor(t * 12) % 2);
  if (o.mood === 'yell' || talk) { R('#3a1418', 17, 24, 6, 3); R('#e86a6a', 18, 26, 4, 1); }
  else if (o.mood === 'smirk') { R('#5a2a22', 17, 25, 5, 1); R('#5a2a22', 22, 24, 1, 1); }
  else { R('#5a2a22', 17, 25, 6, 1); }
  if (who === 'bigt') { R('rgba(120,70,30,.25)', 14, 26, 12, 3); }
}

// ---- enemies
function drawCrawler(c, e, t) {
  const x = Math.round(e.x), y = Math.round(e.y), fl = e.flash > 0;
  const body = fl ? '#fff' : e.zoneCol || '#5b2a86';
  c.fillStyle = shade(body.startsWith('#') ? body : '#5b2a86', 0.6);
  const leg = Math.floor(t * 10) % 2;
  for (let i = 0; i < 3; i++) c.fillRect(x + 1 + i * 4, y + 8 + ((i + leg) % 2), 2, 2);
  c.fillStyle = body; c.fillRect(x, y + 3, 12, 6); c.fillRect(x + 2, y + 1, 8, 2);
  c.fillStyle = fl ? '#fff' : '#ff6ad5'; for (let i = 0; i < 4; i++) c.fillRect(x + 1 + i * 3, y, 1, 2);
  c.fillStyle = '#b8ff3a'; const ex = e.vx > 0 ? x + 9 : x + 1; c.fillRect(ex, y + 4, 2, 2);
}
function drawFlyer(c, e, t) {
  const x = Math.round(e.x), y = Math.round(e.y), fl = e.flash > 0;
  const w = Math.sin(t * 18 + e.seed) > 0;
  c.fillStyle = fl ? '#fff' : '#2bd4c4';
  if (w) { c.fillRect(x - 3, y + 2, 4, 2); c.fillRect(x + 11, y + 2, 4, 2); c.fillRect(x - 5, y, 3, 2); c.fillRect(x + 14, y, 3, 2); }
  else { c.fillRect(x - 3, y + 5, 4, 2); c.fillRect(x + 11, y + 5, 4, 2); c.fillRect(x - 5, y + 7, 3, 2); c.fillRect(x + 14, y + 7, 3, 2); }
  c.fillStyle = fl ? '#fff' : '#1b6f8a'; c.fillRect(x + 1, y + 1, 10, 8); c.fillRect(x + 3, y, 6, 10);
  c.fillStyle = fl ? '#fff' : '#ffe14a'; c.fillRect(x + 4, y + 3, 4, 4);
  c.fillStyle = '#ff3d6e'; c.fillRect(x + 5, y + 4, 2, 2);
  c.fillStyle = '#1b6f8a'; for (let i = 0; i < 3; i++) c.fillRect(x + 3 + i * 3, y + 10 + (Math.floor(t * 8 + i) % 2), 1, 2);
}
function drawTurret(c, e, t) {
  const x = Math.round(e.x), y = Math.round(e.y), fl = e.flash > 0;
  c.fillStyle = fl ? '#fff' : '#7a1f3a'; c.fillRect(x, y + 2, 12, 9); c.fillRect(x + 2, y, 8, 12);
  c.fillStyle = fl ? '#fff' : '#c23a5e'; c.fillRect(x + 2, y + 2, 8, 2);
  const open = (e.cd < 30);
  c.fillStyle = open ? '#fff6a8' : '#ffb03a'; c.fillRect(x + 4, y + 4, 4, open ? 4 : 2);
  if (open) { c.fillStyle = '#a31d1d'; c.fillRect(x + 5, y + 5, 2, 2); }
}
function drawBoss(c, b, t) {
  const x = Math.round(b.x), y = Math.round(b.y), fl = b.flash > 0;
  const W = b.w, H = b.h;
  // tentacles
  for (let i = 0; i < 6; i++) {
    const bx = x + 8 + i * (W - 16) / 5;
    c.strokeStyle = fl ? '#fff' : (i % 2 ? '#7a1f3a' : '#a42a55'); c.lineWidth = 4;
    c.beginPath(); c.moveTo(bx, y + H - 8);
    for (let k = 1; k <= 5; k++) c.lineTo(bx + Math.sin(t * 3 + i + k * 0.8) * 5 * k / 2, y + H - 8 + k * 6);
    c.stroke();
  }
  // body
  const g = c.createRadialGradient(x + W / 2, y + H / 2, 4, x + W / 2, y + H / 2, W * 0.6);
  g.addColorStop(0, fl ? '#fff' : '#ff5c8a'); g.addColorStop(0.5, fl ? '#fff' : '#8c1f4a'); g.addColorStop(1, fl ? '#fff' : '#3a0a1e');
  c.fillStyle = g; c.beginPath(); c.ellipse(x + W / 2, y + H / 2, W / 2, H / 2 - 4, 0, 0, 7); c.fill();
  // crown spikes
  c.fillStyle = fl ? '#fff' : '#ffd84a';
  for (let i = 0; i < 5; i++) { const sx = x + W / 2 - 20 + i * 10; c.beginPath(); c.moveTo(sx - 4, y + 8); c.lineTo(sx, y - 6 - (i === 2 ? 6 : 0)); c.lineTo(sx + 4, y + 8); c.fill(); }
  // segments
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.ellipse(x + W / 2, y + H / 2 + i * 4, W / 2 - i * 3, H / 2 - 6 - i * 2, 0, 0.2, Math.PI - 0.2); c.stroke(); }
  // eye
  const ex = x + W / 2 + Math.max(-6, Math.min(6, (b.lookX || 0) * 6)), ey = y + H / 2 - 2;
  c.fillStyle = '#fff8e0'; c.beginPath(); c.ellipse(ex, ey, 11, b.blink ? 1 : 9, 0, 0, 7); c.fill();
  if (!b.blink) { c.fillStyle = b.enraged ? '#ff2a2a' : '#b8ff3a'; c.beginPath(); c.ellipse(ex + (b.lookX || 0) * 3, ey + (b.lookY || 0) * 2, 5, 7, 0, 0, 7); c.fill();
    c.fillStyle = '#100'; c.fillRect(ex + (b.lookX || 0) * 3 - 1, ey - 4 + (b.lookY || 0) * 2, 2, 8); }
  // mouth
  c.fillStyle = '#1a0008'; c.fillRect(x + W / 2 - 10, y + H - 16, 20, 4 + (b.mouth || 0));
  c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) c.fillRect(x + W / 2 - 9 + i * 4, y + H - 16, 2, 2);
}

// ---- the ship (STARSTANG 5.0), ~72x40
function drawShip(c, x, y, t, o = {}) {
  x = Math.round(x); y = Math.round(y);
  const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
  if (!o.flying) { R('#3d4258', 12, 32, 3, 8); R('#3d4258', 56, 32, 3, 8); R('#262a3a', 9, 38, 9, 2); R('#262a3a', 53, 38, 9, 2); }
  // hull
  R('#1c1f2e', 4, 18, 64, 14); R('#2e3350', 6, 14, 58, 6); R('#3c4468', 10, 12, 44, 3);
  R('#d8dbe8', 6, 19, 60, 9); R('#ffffff', 8, 19, 50, 2); R('#9ba1ba', 6, 26, 60, 2);
  // racing stripes (5.0 vibe)
  R('#0d0d12', 14, 21, 44, 2); R('#0d0d12', 14, 24, 44, 1);
  R('#ff4fa3', 6, 23, 6, 1);
  // tail fin
  R('#c7cbe0', 4, 6, 8, 13); R('#ff4fa3', 5, 7, 3, 10); R('#9ba1ba', 4, 6, 2, 13);
  // nose
  c.fillStyle = '#d8dbe8'; c.beginPath(); c.moveTo(x + 66, y + 19); c.lineTo(x + 76, y + 25); c.lineTo(x + 66, y + 30); c.fill();
  // cockpit glass
  c.fillStyle = '#5ff6ff'; c.beginPath(); c.moveTo(x + 44, y + 19); c.lineTo(x + 52, y + 10); c.lineTo(x + 63, y + 12); c.lineTo(x + 68, y + 19); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x + 52, y + 12, 6, 1);
  // engines
  R('#3d4258', 0, 20, 6, 10);
  const fl = o.flying ? 1 : 0.35 + Math.sin(t * 20) * 0.1;
  const gl = c.createLinearGradient(x, 0, x - 26 * fl, 0); gl.addColorStop(0, '#fff'); gl.addColorStop(0.3, '#5ff6ff'); gl.addColorStop(1, 'rgba(255,79,163,0)');
  c.fillStyle = gl; c.fillRect(x - 26 * fl, y + 21, 26 * fl, 8);
  // lights
  if (Math.floor(t * 2) % 2) { R('#ff3d3d', 3, 5, 2, 2); R('#3dff7a', 66, 30, 2, 2); }
}

// background star field (screen space)
const STARS = Array.from({ length: 140 }, (_, i) => ({ x: hash(i, 1) * 640, y: hash(i, 2) * 180, s: hash(i, 3), p: hash(i, 4) * 6.28 }));
