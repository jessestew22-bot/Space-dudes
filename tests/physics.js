// Frame-exact reachability checks for the gates: node tests/physics.js
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const root = path.resolve(__dirname, '..');
fs.mkdirSync(root + '/.shots', { recursive: true });
fs.writeFileSync(root + '/.shots/test.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(root + '/dist/space-dudes.html', 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + root + '/.shots/test.html#jesse'); await new Promise(r => setTimeout(r, 500));
  await p.evaluate(() => {
    loop = () => {}; // freeze the rAF loop; we drive update() by hand
    window.sim = (x, y, ab, script, n) => {
      Object.assign(G.ab, ab); state = 'play'; P = newPlayer(x, y); P.energy = 999; enemies = [];
      for (let f = 0; f < n; f++) { const k = script(f); for (const key in kb) kb[key] = k.includes(key) ? 1 : 0; update(); if (state !== 'play') { state = 'play'; dialog = null; } }
      for (const key in kb) kb[key] = 0;
      return { x: Math.round(P.x), y: Math.round(P.y), ground: P.onGround, tx: Math.floor((P.x + 5) / 16), ty: Math.floor((P.y + 13) / 16) };
    };
    window.dj = f => f < 18 ? ['right', 'jump'] : f < 21 ? ['right'] : f < 40 ? ['right', 'jump'] : ['right'];
    window.up2 = dir => f => f < 18 ? ['jump', ...(f > 10 ? [dir] : [])] : f < 21 ? [dir] : f < 40 ? ['jump', dir] : (f < 60 ? [dir] : []);
  });
  await p.evaluate(() => {
    // brute-force a handful of human-ish input timings; reachable if ANY works
    window.reach = (x, y, ab, dir, goal) => {
      for (const j1 of [8, 12, 18]) for (const gap of [2, 6, 10]) for (const d0 of [0, 8, 16, 24, 32]) for (const d1 of [30, 45, 70, 100])
        for (const tap of [0, 1]) {
          const r = sim(x, y, ab, f => { const k = []; if (f < j1 || (f >= j1 + gap && f < j1 + gap + 20)) k.push('jump'); if (tap && f > 60 && f < 64) k.push('jump'); if (dir && f >= d0 && f < d1) k.push(dir); return k; }, 130);
          if (goal(r)) return { ok: true, r, how: { j1, gap, d0, d1 } };
        }
      return { ok: false };
    };
  });
  const t = async (name, code) => { const r = await p.evaluate(code); console.log((r.ok ? 'PASS ' : 'FAIL ') + name, JSON.stringify(r)); };
  await t('cliff blocked WITHOUT boots (expect FAIL)', `reach(48*16, 13*16-14, {dj:false}, 'right', r => r.tx >= 52)`);
  await t('cliff cleared with boots', `reach(48*16, 13*16-14, {dj:true}, 'right', r => r.tx >= 52 && r.ty <= 8)`);
  await t('richie room -> r26', `reach(46*16, 30*16-14, {dj:true}, null, r => r.ty === 25)`);
  await t('r26 -> r23', `reach(45*16, 26*16-14, {dj:true}, 'left', r => r.ty === 22)`);
  await t('r23 -> tunnel', `reach(41*16+2, 23*16-14, {dj:true}, 'left', r => r.ty === 21 && r.tx < 40)`);
  await t('r23 -> r19 (fuel ledge)', `reach(42*16, 23*16-14, {dj:true}, null, r => r.ty === 18)`);
  await t('tunnel -> r18 ledge', `reach(20*16, 22*16-14, {dj:true}, null, r => r.ty === 17)`);
  await t('r18 -> r15 ledge', `reach(20*16, 18*16-14, {dj:true}, 'right', r => r.ty === 14)`);
  await t('r15 -> surface', `reach(21*16+2, 15*16-14, {dj:true}, 'right', r => r.ty <= 12 && r.tx >= 23)`);
  await t('eli hall -> r27', `reach(88*16, 30*16-14, {dj:true}, null, r => r.ty === 26)`);
  await t('r27 -> r23', `reach(90*16, 27*16-14, {dj:true}, 'right', r => r.ty === 22)`);
  await t('r11 -> crystal hall', `reach(88*16, 11*16-14, {dj:true}, 'left', r => r.ty <= 8 && r.tx < 86)`);
  await t('acid island -> r41', `reach(67*16, 45*16-14, {dj:true}, 'left', r => r.ty === 40)`);
  await t('r41 -> r37', `reach(63*16, 41*16-14, {dj:true}, 'right', r => r.ty === 36)`);
  await t('r37 -> r33', `reach(66*16+4, 37*16-14, {dj:true}, 'left', r => r.ty === 32)`);
  await t('r33 -> crystal hall', `(()=>{ for (let x=64;x<=68;x++) grid[30][x]='.'; return reach(64*16+2, 33*16-14, {dj:true}, 'left', r => r.ty <= 29); })()`);
  await t('bigt island -> r40 west ledge', `reach(35*16, 45*16-14, {dj:true}, 'left', r => r.ty === 39)`);
  await t('shaft one level', `reach(2*16, 61*16-14, {dj:true}, null, r => r.ty === 56)`);
  await t('shaft top -> surface', `(()=>{ for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) if (grid[y][x]==='G') grid[y][x]='.'; return reach(2*16, 17*16-14, {dj:true}, 'right', r => r.ty <= 12 && r.tx >= 6); })()`);
  await t('arena -> shaft (G open)', `reach(9*16, 63*16-14, {dj:true}, 'left', r => r.tx <= 5)`);
  console.log('ERRORS', errs.length ? errs : 'none');
  await b.close();
})();
