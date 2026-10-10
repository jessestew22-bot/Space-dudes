// ---------- UI: dialog, banners, HUD, screens, story, loop ----------
let dialog = null, bannerCb = null, cleanGrid = null;
const dport = $('dport'), dpctx = dport.getContext('2d'); dpctx.imageSmoothingEnabled = false;

function resolveWho(w) { return w === 'P' ? G.who : w === 'O' ? G.other : w; }
function say(lines, done) {
  dialog = { lines, i: 0, ch: 0, done, ret: state === 'dialog' || state === 'banner' ? 'play' : (state === 'story' ? 'story' : 'play') };
  state = 'dialog'; $('dialog').hidden = false; showLine();
}
function showLine() {
  const [w0, text] = dialog.lines[dialog.i];
  let who = resolveWho(w0), radio = false;
  if (who.startsWith('radio:')) { radio = true; who = resolveWho(who.slice(6)); }
  dialog.who = who; dialog.radio = radio; dialog.text = text; dialog.ch = 0;
  const box = $('dialog');
  box.classList.toggle('narr', who === 'narr'); box.classList.toggle('radio', radio);
  $('dname').textContent = who === 'narr' ? '' : (radio ? 'RADIO · ' : '') + CREW[who].name;
  $('dtext').textContent = ''; $('dnext').hidden = true;
}
function tickDialog() {
  if (!dialog) return;
  const d = dialog;
  if (d.ch < d.text.length) { d.ch = Math.min(d.text.length, d.ch + 1.2); $('dtext').textContent = d.text.slice(0, Math.floor(d.ch)); if (frame % 3 === 0 && d.text[Math.floor(d.ch)] !== ' ') Snd.sfx.blip(); }
  else $('dnext').hidden = false;
  if (d.who !== 'narr') {
    dpctx.clearRect(0, 0, 40, 40);
    drawPortrait(dpctx, d.who, { t: T, talk: d.ch < d.text.length, mood: d.lines[d.i][2], bg: d.radio ? '#0d1a14' : '#140d26' });
    if (d.radio) { for (let i = 0; i < 40; i++) { dpctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; dpctx.fillRect((Math.random() * 40) | 0, i, (Math.random() * 12) | 0, 1); } dpctx.fillStyle = 'rgba(80,255,160,.18)'; dpctx.fillRect(0, 0, 40, 40); }
  }
}
function advance() {
  if (state === 'banner') { $('banner').hidden = true; state = 'play'; const cb = bannerCb; bannerCb = null; if (cb) cb(); return; }
  if (!dialog) return;
  const d = dialog;
  if (d.ch < d.text.length) { d.ch = d.text.length; $('dtext').textContent = d.text; return; }
  d.i++;
  if (d.i < d.lines.length) { showLine(); return; }
  dialog = null; $('dialog').hidden = true; state = d.ret;
  if (d.done) d.done();
}
function banner(title, desc, done) {
  state = 'banner'; bannerCb = done || null;
  $('btitle').textContent = title; $('bdesc').textContent = desc; $('banner').hidden = false;
  Snd.sfx.pickup();
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); toastT = 150; }
function areaCard(name) { const a = $('areacard'); a.textContent = name; a.classList.remove('show'); void a.offsetWidth; a.classList.add('show'); }

// ---- HUD
let hudKey = '';
const hudCrew = {};
function buildHUD() {
  const wrap = $('hcrew'); wrap.innerHTML = '';
  ['richie', 'eli', 'bigt', 'other'].forEach(k => {
    const who = k === 'other' ? G.other : k;
    const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.title = CREW[who].full;
    drawPortrait(c.getContext('2d'), who, { t: 0, bg: '#1a1030' });
    wrap.appendChild(c); hudCrew[k] = c;
  });
  hudKey = '';
}
function updateHUD() {
  const fuel = Object.keys(G.fuel).length;
  const key = [Math.ceil(P.energy), G.maxEnergy, fuel, G.crew.richie, G.crew.eli, G.crew.bigt, G.crew.other].join('|');
  if (key === hudKey) return; hudKey = key;
  const en = Math.max(0, Math.ceil(P.energy)), tanks = (G.maxEnergy - 99) / 50;
  let tk = ''; for (let i = 0; i < tanks; i++) tk += `<i class="${en > 99 + i * 50 ? 'on' : ''}"></i>`;
  $('htanks').innerHTML = tk;
  $('henergy').textContent = String(en).padStart(2, '0');
  $('henergy').classList.toggle('low', en < 30);
  for (const k in hudCrew) hudCrew[k].classList.toggle('got', !!G.crew[k]);
  $('hfuel').innerHTML = [0, 1, 2].map(i => `<i class="${i < fuel ? 'on' : ''}"></i>`).join('');
}

// ---- screens
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'scr-' + name; });
}
function openPause() { if (state !== 'play') return; state = 'pause'; showScreen('pause'); syncToggles(); }
function closePause() { state = 'play'; showScreen(null); }
function openMap() { if (state !== 'play' && state !== 'pause') return; state = 'map'; showScreen('map'); drawMap(); }
function closeMap() { state = 'play'; showScreen(null); }
function syncToggles() {
  $('tEasy').textContent = 'EASY MODE: ' + (G.easy ? 'ON' : 'OFF');
  $('tSound').textContent = 'SOUND: ' + (Snd.muted ? 'OFF' : 'ON');
}
function drawMap() {
  const c = $('mapcv'), m = c.getContext('2d'), s = 3;
  c.width = MW * s; c.height = MH * s;
  m.fillStyle = '#07040f'; m.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!explored[y * MW + x]) continue;
    const ch = grid[y][x], z = ZP[zoneAt(x, y)];
    m.fillStyle = isSolid(ch) ? shade(z.edge, 0.35) : ch === '~' ? '#5a9a20' : shade(z.rock, 1.35);
    m.fillRect(x * s, y * s, s, s);
  }
  const dot = (x, y, col, r = 3) => { m.fillStyle = col; m.fillRect(Math.round(x / TS * s) - r, Math.round(y / TS * s) - r, r * 2, r * 2); };
  dot(shipPos.x + 16, shipPos.y - 8, '#4ff0ff', 4);
  for (const it of items) if (it.type === 'F' && !taken(it) && explored[Math.floor(it.y / TS) * MW + Math.floor(it.x / TS)]) dot(it.x, it.y, '#ffe65a');
  for (const k of ['richie', 'eli', 'bigt']) { const n = npcs[k]; if (!G.crew[k] && explored[Math.floor((n.y - 8) / TS) * MW + Math.floor(n.x / TS)]) dot(n.x, n.y - 8, '#ff7af0'); }
  if (P) dot(P.x + 5, P.y + 7, '#ffffff', 3);
  const crew = ['richie', 'eli', 'bigt'].filter(k => G.crew[k]).length, fuel = Object.keys(G.fuel).length;
  $('mapinfo').textContent = [`CREW ${crew + (G.crew.other ? 1 : 0)}/4`, `FUEL ${fuel}/3`, G.ab.dj && 'JUMPY BOOTS', G.ab.charge && 'ANIME DRAW', G.ab.suit && 'BATHROOM CABINET'].filter(Boolean).join(' · ');
}

// ---- story
function resetGrid() { grid = cleanGrid.map(r => r.slice()); }
function startNewGame(who) {
  G = freshG(who); save();
  scene = 'orbit'; G.introDrop = true; state = 'story'; showScreen(null);
  const lines = SCRIPT.intro(who, G.other);
  say(lines, () => { scene = null; G.introDrop = false; beginPlay(true); });
}
function beginPlay(fresh) {
  resetGrid(); G.escape = false; applyWorldFlags(); buildTiles(); buildDecor(); spawnEnemies();
  shots = []; parts = []; orbs = []; rocks = []; boss = null; trail = [];
  P = newPlayer(G.checkpoint.x, G.checkpoint.y);
  $('hud').hidden = false; $('bossbar').hidden = true; $('timer').hidden = true; $('controls').classList.remove('dim');
  buildHUD(); showScreen(null);
  state = 'play'; snapCam(); Snd.music('explore');
  if (G.bossDead) { P = newPlayer(20 * TS, 61 * TS); snapCam(); startEscape(); return; }
  if (fresh) {
    banner(...SCRIPT.mission(G.who, G.other));
  }
}
function showCredits() {
  $('controls').classList.add('dim');
  showScreen('credits');
  const secs = Math.floor((G.time || 0) / 60);
  $('stats').textContent = `${Math.floor(secs / 60)}m ${secs % 60}s · ${G.deaths || 0} deaths${G.easy ? ' · easy' : ''}${G.tape ? ' · found the tape' : ''}`;
  const roll = $('roll'); roll.classList.remove('go'); void roll.offsetWidth; roll.classList.add('go');
}

// ---- wiring
function wire() {
  const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); Snd.unlock(); fn(); });
  on('btnStart', () => { Snd.unlock(); Snd.music('title'); showTitle(); });
  on('btnNew', () => { state = 'select'; showScreen('select'); });
  on('btnCont', () => { const s = loadSave(); if (!s) return; G = s; if (!G.seen) G.seen = {}; beginPlay(false); toast('Welcome back.'); });
  on('pickJesse', () => startNewGame('jesse'));
  on('pickIan', () => startNewGame('ian'));
  on('selBack', () => showTitle());
  on('btnPause', () => openPause());
  on('btnMap', () => openMap());
  on('pResume', () => closePause());
  on('pMap', () => openMap());
  on('mapClose', () => closeMap());
  on('tEasy', () => { G.easy = !G.easy; save(); syncToggles(); });
  on('tSound', () => { Snd.setMuted(!Snd.muted); syncToggles(); });
  on('pQuit', () => { save(); state = 'title'; $('hud').hidden = true; $('timer').hidden = true; $('bossbar').hidden = true; Snd.music('title'); showTitle(); });
  on('again', () => { $('caption').classList.remove('show'); showTitle(); Snd.music('title'); });
  $('stage').addEventListener('pointerdown', () => { Snd.unlock(); if (state === 'dialog' || state === 'banner') advance(); });
  $('dialog').addEventListener('pointerdown', e => { e.stopPropagation(); advance(); });
  $('banner').addEventListener('pointerdown', e => { e.stopPropagation(); advance(); });
  ['pickJesse', 'pickIan'].forEach((id, i) => { const c = $(id).querySelector('canvas'); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; drawPortrait(x, i ? 'ian' : 'jesse', { t: 1, mood: 'smirk' }); });
  addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 120));
}
function showTitle() {
  $('app').classList.remove('ending');
  state = 'title'; scene = null; $('hud').hidden = true; $('controls').classList.add('dim');
  $('btnCont').hidden = !loadSave();
  showScreen('title');
}

// ---- loop
let acc = 0, last = 0;
function loop(ts) {
  const dt = Math.min(100, ts - (last || ts)); last = ts; acc += dt;
  let n = 0;
  while (acc >= 1000 / 60 && n < 4) { update(); acc -= 1000 / 60; n++; }
  if (n === 4) acc = 0;
  try { render(); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
function init() {
  parseMap(); cleanGrid = grid.map(r => r.slice());
  buildBG(); buildTiles(); buildDecor();
  setupTouch(); wire(); layout();
  showScreen('boot'); state = 'boot';
  requestAnimationFrame(loop);
  // ?play deep-link for testing: #jesse / #ian skips the menus
  const h = location.hash.slice(1);
  if (h === 'jesse' || h === 'ian') { G = freshG(h); beginPlay(false); }
  if (h === 'ending') { G = freshG('jesse'); G.tape = true; beginPlay(false); startEnding(); }
}
init();
