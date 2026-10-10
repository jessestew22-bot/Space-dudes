// ---------- WORLD: map parse, zones, tile prerender, backgrounds ----------
const TS = 16, VW = 320, VH = 180;
const MW = MAP_ROWS[0].length, MH = MAP_ROWS.length;
let grid = [];
const spawns = [], items = [], npcs = {};
let shipPos = null, bossSpawn = null, capturedPos = null;

function parseMap() {
  grid = MAP_ROWS.map(r => r.split(''));
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const ch = grid[y][x];
    const fill = () => { grid[y][x] = (grid[y][x - 1] === '~' || grid[y][x + 1] === '~') ? '~' : '.'; };
    if (ch === 'S') { shipPos = { x: x * TS, y: (y + 1) * TS }; fill(); }
    else if (ch === 'R' || ch === 'E' || ch === 'T') { npcs[{ R: 'richie', E: 'eli', T: 'bigt' }[ch]] = { x: x * TS + 8, y: (y + 1) * TS }; fill(); }
    else if (ch === 'P') { capturedPos = { x: x * TS + 8, y: (y + 1) * TS }; fill(); }
    else if (ch === 'K') { bossSpawn = { x: x * TS, y: y * TS }; fill(); }
    else if ('FHV'.includes(ch)) { items.push({ type: ch, id: ch + x + '_' + y, x: x * TS + 8, y: y * TS + 8 }); fill(); }
    else if ('cft'.includes(ch)) { spawns.push({ type: ch, x: x * TS, y: y * TS }); fill(); }
  }
}
const tileAt = (tx, ty) => (tx < 0 || tx >= MW || ty >= MH) ? '#' : (ty < 0 ? '.' : grid[ty][tx]);
const SOLID = '#XxDG';
const isSolid = ch => SOLID.includes(ch);

function zoneAt(tx, ty) {
  if (tx <= 5 && ty >= 13) return 'shaft';
  if (ty <= 14 && tx <= 64) return 'surface';
  if (ty >= 50 || (tx <= 13 && ty >= 41)) return 'hive';
  if (ty >= 31) return 'acid';
  if (tx >= 58) return 'crystal';
  return 'caves';
}
const ZP = {
  surface: { rock: '#3b1f52', edge: '#ff5fa8', top: '#4dffd2', dark: [10, 4, 22], amb: 0.12, name: 'CRASH SITE' },
  caves:   { rock: '#1d2547', edge: '#4f6bd6', top: '#3dfcff', dark: [3, 4, 12], amb: 0.86, name: 'GLOWWORM CAVES' },
  shaft:   { rock: '#262033', edge: '#6a5a8a', top: '#ffb03a', dark: [3, 2, 8], amb: 0.88, name: 'THE EXPRESS SHAFT' },
  crystal: { rock: '#2a1748', edge: '#9a6bff', top: '#ff7af0', dark: [8, 3, 18], amb: 0.74, name: 'CRYSTAL CAVERNS' },
  acid:    { rock: '#14301f', edge: '#3f8a4a', top: '#b6ff3a', dark: [2, 8, 4], amb: 0.72, name: 'ACID DEPTHS' },
  hive:    { rock: '#3a0d1d', edge: '#b5245a', top: '#ff9a3d', dark: [10, 1, 4], amb: 0.84, name: 'THE HIVE' },
};

// ---- prerendered tile layer
let tileCanvas, tctx;
function mix(a, b, f) { // hex a,b
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) * (1 - f) + (pb >> 16) * f) | 0, g = (((pa >> 8) & 255) * (1 - f) + ((pb >> 8) & 255) * f) | 0, bl = ((pa & 255) * (1 - f) + (pb & 255) * f) | 0;
  return `rgb(${r},${g},${bl})`;
}
function airDist(tx, ty) {
  for (let d = 1; d <= 3; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    const ch = tileAt(tx + dx, ty + dy); if (!isSolid(ch) && ch !== '=') return d;
  }
  return 4;
}
function drawTileTo(c, tx, ty) {
  const px = tx * TS, py = ty * TS, ch = tileAt(tx, ty);
  c.clearRect(px, py, TS, TS);
  if (ch === '.' || ch === '~' || ch === 'D' || ch === 'G') return;
  const z = ZP[zoneAt(tx, ty)];
  if (ch === '=') {
    c.fillStyle = shade(z.edge, 0.55); c.fillRect(px, py, TS, 5);
    c.fillStyle = z.edge; c.fillRect(px, py, TS, 1);
    c.fillStyle = shade(z.top, 0.9); c.fillRect(px, py, TS, 1);
    c.fillStyle = shade(z.edge, 0.3); c.fillRect(px, py + 5, TS, 1);
    if ((tx + ty) % 2 === 0) { c.fillStyle = shade(z.edge, 0.35); c.fillRect(px + 7, py + 5, 2, 4); }
    return;
  }
  const d = airDist(tx, ty);
  const dk = '#' + ZP[zoneAt(tx, ty)].dark.map(v => v.toString(16).padStart(2, '0')).join('');
  const base = d >= 4 ? mix(z.rock, dk, 0.82) : mix(z.rock, dk, (d - 1) * 0.28);
  c.fillStyle = base; c.fillRect(px, py, TS, TS);
  // texture
  for (let i = 0; i < 7; i++) {
    const hx = (hash(tx * 7 + i, ty * 3) * 15) | 0, hy = (hash(tx, ty * 11 + i) * 15) | 0;
    c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)';
    c.fillRect(px + hx, py + hy, 2, 1);
  }
  if (d <= 2) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px + ((hash(tx, ty) * 10) | 0), py + 6, 5, 4); }
  const up = !isSolid(tileAt(tx, ty - 1)), dn = !isSolid(tileAt(tx, ty + 1)), lf = !isSolid(tileAt(tx - 1, ty)), rt = !isSolid(tileAt(tx + 1, ty));
  if (lf) { c.fillStyle = shade(z.edge, 0.7); c.fillRect(px, py, 1, TS); }
  if (rt) { c.fillStyle = shade(z.edge, 0.5); c.fillRect(px + 15, py, 1, TS); }
  if (dn) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(px, py + 14, TS, 2);
    if (hash(tx, ty + 99) < 0.35) { c.fillStyle = shade(z.edge, 0.55); const sx = (hash(tx, ty) * 10) | 0; c.fillRect(px + sx, py + 15, 2, 1); } }
  if (up) {
    c.fillStyle = z.edge; c.fillRect(px, py, TS, 2);
    c.fillStyle = shade(z.edge, 0.6); c.fillRect(px, py + 2, TS, 1);
    c.fillStyle = z.top;
    for (let i = 0; i < TS; i += 2) if (hash(tx * 16 + i, ty) < 0.55) c.fillRect(px + i, py, 1, 1 + ((hash(i, tx) * 2) | 0));
  }
  if (ch === 'X') { // crystal block
    c.fillStyle = '#1a0a33'; c.fillRect(px, py, TS, TS);
    const g = c.createLinearGradient(px, py, px + TS, py + TS); g.addColorStop(0, '#ffb3f5'); g.addColorStop(0.5, '#b04dff'); g.addColorStop(1, '#4b1aa8');
    c.fillStyle = g; c.beginPath(); c.moveTo(px + 8, py + 1); c.lineTo(px + 15, py + 6); c.lineTo(px + 12, py + 15); c.lineTo(px + 3, py + 14); c.lineTo(px + 1, py + 5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(px + 6, py + 3, 3, 1); c.fillRect(px + 5, py + 4, 1, 4);
    c.strokeStyle = 'rgba(40,0,80,.6)'; c.beginPath(); c.moveTo(px + 8, py + 1); c.lineTo(px + 9, py + 15); c.stroke();
  }
  if (ch === 'x') { // weak, cracked
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.beginPath();
    c.moveTo(px + 3, py + 2); c.lineTo(px + 7, py + 7); c.lineTo(px + 5, py + 12); c.moveTo(px + 7, py + 7); c.lineTo(px + 13, py + 9); c.stroke();
    c.fillStyle = 'rgba(255,200,120,.12)'; c.fillRect(px + 6, py + 6, 2, 2);
  }
}
function buildTiles() {
  tileCanvas = document.createElement('canvas'); tileCanvas.width = MW * TS; tileCanvas.height = MH * TS;
  tctx = tileCanvas.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) drawTileTo(tctx, x, y);
}
function redrawAround(tx, ty) {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < MW && y < MH) drawTileTo(tctx, x, y);
  }
}

// ---- decor (non-colliding, glowing flora)
const decor = [];
function buildDecor() {
  decor.length = 0;
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    const ch = grid[y][x]; if (ch !== '.') continue;
    const z = zoneAt(x, y), below = grid[y + 1][x], above = grid[y - 1][x];
    const r = hash(x * 3, y * 5);
    if (below === '#' && r < (z === 'surface' ? 0.22 : 0.16)) decor.push({ x: x * TS + 8, y: (y + 1) * TS, z, kind: 'floor', s: hash(x, y) });
    else if (above === '#' && r > 0.9 && z !== 'surface') decor.push({ x: x * TS + 8, y: y * TS, z, kind: 'ceil', s: hash(x, y) });
  }
}
function drawDecor(c, d, sx, sy, t, lights) {
  const sw = Math.sin(t * 1.5 + d.s * 9) * 1.5;
  if (d.kind === 'floor') {
    if (d.z === 'surface') { // alien grass fronds
      c.fillStyle = '#2bd4a8'; for (let i = -1; i <= 1; i++) { c.fillRect(sx + i * 3 + sw * (i + 2) / 3, sy - 5 - (i === 0 ? 3 : 0), 1, 5 + (i === 0 ? 3 : 0)); }
      c.fillStyle = '#b6fff0'; c.fillRect(sx + sw, sy - 9, 1, 1);
      if (d.s > 0.6) lights.push({ x: sx, y: sy - 8, r: 14, col: '77,255,210', i: 0.5 });
    } else if (d.z === 'caves' || d.z === 'shaft') { // glow mushrooms
      c.fillStyle = '#8a8fb8'; c.fillRect(sx, sy - 6, 2, 6);
      c.fillStyle = '#3dfcff'; c.fillRect(sx - 3, sy - 8, 8, 2); c.fillRect(sx - 2, sy - 9, 6, 1);
      c.fillStyle = '#d6ffff'; c.fillRect(sx - 1, sy - 8, 1, 1); c.fillRect(sx + 3, sy - 8, 1, 1);
      lights.push({ x: sx + 1, y: sy - 8, r: 26, col: '61,252,255', i: 0.75 });
    } else if (d.z === 'crystal') {
      c.fillStyle = d.s > 0.5 ? '#ff7af0' : '#8e6bff';
      c.beginPath(); c.moveTo(sx - 3, sy); c.lineTo(sx, sy - 10 - d.s * 6); c.lineTo(sx + 3, sy); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(sx - 1, sy - 6, 1, 4);
      lights.push({ x: sx, y: sy - 6, r: 28, col: d.s > 0.5 ? '255,122,240' : '142,107,255', i: 0.75 });
    } else if (d.z === 'acid') {
      c.fillStyle = '#2f6b3a'; c.beginPath(); c.ellipse(sx, sy - 4, 4, 4, 0, 0, 7); c.fill();
      c.fillStyle = '#b6ff3a'; c.fillRect(sx - 1, sy - 6 + Math.round(Math.sin(t * 3 + d.s * 6)), 2, 2);
      lights.push({ x: sx, y: sy - 5, r: 22, col: '182,255,58', i: 0.65 });
    } else { // hive eggs
      c.fillStyle = '#5a1430'; c.beginPath(); c.ellipse(sx, sy - 5, 4, 5 + Math.sin(t * 2 + d.s * 5) * 0.6, 0, 0, 7); c.fill();
      c.fillStyle = '#ff9a3d'; c.fillRect(sx - 1, sy - 6, 2, 2);
      lights.push({ x: sx, y: sy - 5, r: 22, col: '255,154,61', i: 0.6 });
    }
  } else { // ceiling: glow worms / drips
    const len = 4 + ((d.s * 10) | 0);
    c.fillStyle = 'rgba(200,220,255,.35)'; c.fillRect(sx, sy, 1, len);
    const col = d.z === 'hive' ? '#ff9a3d' : d.z === 'acid' ? '#b6ff3a' : d.z === 'crystal' ? '#ff7af0' : '#9dfcff';
    c.fillStyle = col; c.fillRect(sx - 1 + Math.round(sw * 0.4), sy + len, 3, 2);
    lights.push({ x: sx, y: sy + len, r: 18, col: d.z === 'hive' ? '255,154,61' : d.z === 'acid' ? '182,255,58' : d.z === 'crystal' ? '255,122,240' : '157,252,255', i: 0.55 });
  }
}

// ---- parallax backgrounds (640x180 tiles, seamless)
const BG = {};
function layer(fn, w = 640, h = 180) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
function ridge(c, w, base, amps, col, top) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, top ? 0 : 180);
  for (let x = 0; x <= w; x += 2) {
    let y = base; amps.forEach(([a, k, p]) => { y += a * Math.sin((x / w) * Math.PI * 2 * k + p); });
    c.lineTo(x, y);
  }
  c.lineTo(w, top ? 0 : 180); c.closePath(); c.fill();
}
function buildBG() {
  BG.surface = {
    sky: layer((c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#07021a'); g.addColorStop(0.45, '#2a0c4a'); g.addColorStop(0.75, '#a12a72'); g.addColorStop(1, '#ff9a6b');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 320, 180),
    far: layer((c, w) => {
      ridge(c, w, 120, [[14, 3, 0.4], [8, 7, 1.3], [4, 13, 2]], '#4a1752');
      ridge(c, w, 138, [[10, 4, 2.1], [6, 9, 0.2], [3, 17, 1]], '#2c0d3d');
    }),
    near: layer((c, w) => {
      ridge(c, w, 160, [[6, 5, 1], [3, 11, 0.5]], '#160623');
      for (let i = 0; i < 9; i++) {
        const x = hash(i, 77) * w, hgt = 50 + hash(i, 78) * 70, wd = 5 + hash(i, 79) * 7;
        for (const ox of [0, -w, w]) {
          c.fillStyle = '#160623'; c.beginPath(); c.moveTo(ox + x - wd, 180); c.lineTo(ox + x - wd * 0.4, 180 - hgt); c.lineTo(ox + x, 180 - hgt - 10); c.lineTo(ox + x + wd * 0.5, 180 - hgt + 4); c.lineTo(ox + x + wd, 180); c.fill();
          c.fillStyle = '#ff5fa8'; c.fillRect(ox + x - 1, 180 - hgt - 6, 2, 2);
        }
      }
    }),
  };
  const caveLayer = (rock, glow, seed) => layer((c, w) => {
    ridge(c, w, 30, [[16, 3, seed], [8, 8, seed * 2], [5, 15, 1]], rock, true);
    ridge(c, w, 150, [[14, 4, seed + 1], [7, 9, 0.3], [4, 19, 2]], rock);
    for (let i = 0; i < 6; i++) {
      const x = hash(i, seed * 9) * w, wd = 10 + hash(i, 3) * 18;
      for (const ox of [0, -w, w]) { c.fillStyle = rock; c.fillRect(ox + x, 0, wd, 180); c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(ox + x, 0, 2, 180); }
    }
    for (let i = 0; i < 50; i++) { c.fillStyle = glow; c.globalAlpha = 0.3 + hash(i, seed) * 0.6; c.fillRect(hash(i, 5 + seed) * w, hash(i, 6) * 180, 1, 1); }
    c.globalAlpha = 1;
  });
  const grad = (a, b) => layer((c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 320, 180);
  BG.caves = { sky: grad('#05070f', '#0d1430'), far: caveLayer('#0a0f22', '#3dfcff', 1.1), near: caveLayer('#070a17', '#9dfcff', 2.7) };
  BG.shaft = { sky: grad('#060409', '#140d1f'), far: caveLayer('#0c0912', '#ffb03a', 3.3), near: caveLayer('#08060c', '#ffd27a', 4.1) };
  BG.crystal = {
    sky: grad('#0a0418', '#200c3c'),
    far: layer((c, w) => {
      for (let i = 0; i < 14; i++) {
        const x = hash(i, 41) * w, hgt = 60 + hash(i, 42) * 110, wd = 12 + hash(i, 43) * 20, tilt = (hash(i, 44) - 0.5) * 30, top = hash(i, 45) < 0.4;
        for (const ox of [0, -w, w]) {
          const g = c.createLinearGradient(ox + x, 0, ox + x + wd, 0); g.addColorStop(0, '#2b1458'); g.addColorStop(0.5, '#3f1f7a'); g.addColorStop(1, '#1c0c3a');
          c.fillStyle = g; c.beginPath();
          if (top) { c.moveTo(ox + x - wd, 0); c.lineTo(ox + x + tilt, hgt * 0.7); c.lineTo(ox + x + wd, 0); }
          else { c.moveTo(ox + x - wd, 180); c.lineTo(ox + x + tilt, 180 - hgt); c.lineTo(ox + x + wd, 180); }
          c.fill();
          c.strokeStyle = 'rgba(190,140,255,.35)'; c.stroke();
        }
      }
    }),
    near: caveLayer('#120826', '#ff7af0', 5.5),
  };
  BG.acid = {
    sky: layer((c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#030805'); g.addColorStop(0.7, '#0a1d10'); g.addColorStop(1, '#2a5a12'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 320, 180),
    far: layer((c, w) => {
      ridge(c, w, 40, [[18, 4, 0.7], [9, 11, 1.7]], '#0b1a10', true);
      for (let i = 0; i < 16; i++) { const x = hash(i, 51) * w, l = 30 + hash(i, 52) * 70; for (const ox of [0, -w, w]) { c.fillStyle = '#0b1a10'; c.beginPath(); c.moveTo(ox + x - 6, 0); c.lineTo(ox + x, l); c.lineTo(ox + x + 6, 0); c.fill(); c.fillStyle = '#7dd13a'; c.fillRect(ox + x, l, 1, 2); } }
    }),
    near: caveLayer('#06110a', '#b6ff3a', 6.2),
  };
  BG.hive = {
    sky: grad('#0d0207', '#2a0614'),
    far: layer((c, w) => {
      c.lineWidth = 9; c.strokeStyle = '#3a0a1c';
      for (let i = 0; i < 8; i++) { const x = (i / 8) * w; c.beginPath(); c.ellipse(x, 180, 46, 150, 0, Math.PI, 0); c.stroke(); }
      c.lineWidth = 2; c.strokeStyle = '#6a1636';
      for (let i = 0; i < 8; i++) { const x = (i / 8) * w; c.beginPath(); c.ellipse(x, 180, 46, 150, 0, Math.PI * 1.1, Math.PI * 1.6); c.stroke(); }
    }),
    near: layer((c, w) => {
      ridge(c, w, 155, [[10, 5, 0.1], [5, 13, 2]], '#1f0610');
      ridge(c, w, 22, [[10, 4, 1.3], [5, 9, 0.7]], '#1f0610', true);
      c.strokeStyle = '#ff3d6e'; c.globalAlpha = 0.35; c.lineWidth = 1;
      for (let i = 0; i < 10; i++) { c.beginPath(); let x = hash(i, 61) * w, y = 0; c.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (hash(i, k) - 0.5) * 30; y += 22; c.lineTo(x, y); } c.stroke(); }
      c.globalAlpha = 1;
    }),
  };
}
function drawPlanetBG(c, x, y, r, t) {
  const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffd1a1'); g.addColorStop(0.5, '#e0577f'); g.addColorStop(1, '#3a0f4a');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  c.fillStyle = 'rgba(80,10,60,.35)'; for (let i = 0; i < 5; i++) c.fillRect(x - r, y - r * 0.6 + i * r * 0.3, r * 2, r * 0.08);
  c.restore();
  c.strokeStyle = 'rgba(255,220,240,.55)'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.35, -0.3, Math.PI * 0.05, Math.PI * 0.95, true); c.stroke();
  c.strokeStyle = 'rgba(255,170,220,.3)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, r * 2.1, r * 0.42, -0.3, Math.PI * 0.05, Math.PI * 0.95, true); c.stroke();
}
function drawBG(c, zone, camX, camY, t) {
  const L = BG[zone];
  c.drawImage(L.sky, 0, 0);
  if (zone === 'surface') {
    STARS.forEach(s => { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.5 + s.s) + s.p)); c.fillStyle = `rgba(255,240,255,${a * (1 - s.y / 140)})`; c.fillRect(((s.x - camX * 0.02) % 320 + 320) % 320, s.y * 0.7, s.s > 0.9 ? 2 : 1, 1); });
    drawPlanetBG(c, 250 - camX * 0.03, 52, 26, t);
    c.fillStyle = '#ffe9f5'; c.beginPath(); c.arc(70 - camX * 0.04, 34, 5, 0, 7); c.fill();
    c.fillStyle = '#b9a7ff'; c.beginPath(); c.arc(104 - camX * 0.045, 22, 3, 0, 7); c.fill();
  }
  const fy = Math.max(-30, Math.min(30, -camY * 0.04));
  const ox1 = -(((camX * 0.15) % 640) + 640) % 640, ox2 = -(((camX * 0.35) % 640) + 640) % 640;
  c.drawImage(L.far, ox1, fy); c.drawImage(L.far, ox1 + 640, fy);
  c.drawImage(L.near, ox2, fy * 1.8); c.drawImage(L.near, ox2 + 640, fy * 1.8);
}
