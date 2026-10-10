// Headless smoke test: node tests/smoke.js  (screenshots -> .shots/)
const path = require('path'), fs = require('fs');
const { chromium, devices } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const root = path.resolve(__dirname, '..');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(root + '/dist/space-dudes.html', 'utf8') + '</body></html>';
fs.mkdirSync(root + '/.shots', { recursive: true });
fs.writeFileSync(root + '/.shots/test.html', html);
const url = 'file://' + root + '/.shots/test.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const errs = [];
  const mk = async (vp, hash = '') => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(url + hash); await wait(400); return p;
  };
  const shot = (p, n) => p.screenshot({ path: `${root}/.shots/${n}.png` });
  const skip = async (p, n = 40) => { for (let i = 0; i < n; i++) { const s = await p.evaluate(() => state); if (s !== 'dialog' && s !== 'banner') break; await p.evaluate(() => advance()); await wait(30); } };
  // landscape iPhone
  let p = await mk({ width: 844, height: 390 });
  await shot(p, '01-boot');
  await p.click('#btnStart'); await wait(300); await shot(p, '02-title');
  await p.click('#btnNew'); await wait(300); await shot(p, '03-select');
  await p.click('#pickJesse'); await wait(900); await shot(p, '04-intro');
  await skip(p); await wait(200); await shot(p, '05-banner'); await skip(p);
  await wait(1500); await shot(p, '06-play-surface');
  const tp = async (x, y, n, extra = '') => { await p.evaluate(`P.x=${x};P.y=${y};P.vx=0;P.vy=0;${extra};snapCam();`); await wait(900); await skip(p); await wait(300); await shot(p, n); };
  await tp(20 * 16, 19 * 16, '07-caves');
  await tp(54 * 16, 27 * 16, '08-richie');
  await tp(80 * 16, 6 * 16, '09-crystal', 'G.ab.dj=true');
  await tp(70 * 16, 27 * 16, '10-eli');
  await tp(60 * 16, 42 * 16, '11-acid');
  await tp(44 * 16, 43 * 16, '12-bigt');
  console.log('crew', JSON.stringify(await p.evaluate(() => G.crew)), 'ab', JSON.stringify(await p.evaluate(() => G.ab)));
  // collect fuel
  await p.evaluate(() => { items.forEach(it => { if (it.type === 'F') G.fuel[it.id] = true; }); });
  await tp(14 * 16 + 2, 43 * 16, '13-gate');
  console.log('gate', await p.evaluate(() => G.gateOpen));
  await tp(20 * 16, 60 * 16, '14-boss'); await wait(1500); await skip(p); await p.evaluate(() => { boss.x = P.x + 40; boss.t = 600; boss.cd = 999; }); await wait(300); await shot(p, '15-boss-fight');
  await p.evaluate(() => { boss.hp = 0; bossDie(); }); await wait(2600); await skip(p); await wait(300); await skip(p); await skip(p); await wait(600);
  await shot(p, '16-escape');
  console.log('escape', await p.evaluate(() => [G.escape, G.escapeT, tileAt(6, 58), tileAt(3, 13)]));
  await tp(3 * 16, 30 * 16, '17-shaft');
  await tp(11 * 16, 11 * 16, '18-ship'); await wait(4000); await shot(p, '19-ending-ext'); await wait(5000); await shot(p, '20-ending-int');
  await p.evaluate(() => { endT = 1810; }); await wait(1500); await shot(p, '21-credits');
  // portrait
  const q = await mk({ width: 390, height: 844 }, '#ian');
  await wait(800); await q.evaluate(() => advance()); await wait(500); await q.screenshot({ path: root + '/.shots/22-portrait.png' });
  await q.evaluate(() => say([['eli', 'Oh great. It\'s the portrait-mode brothers.']])); await wait(1500); await q.screenshot({ path: root + '/.shots/23-portrait-dialog.png' });
  await q.evaluate(() => { advance(); advance(); openMap(); }); await wait(300); await q.screenshot({ path: root + '/.shots/24-map.png' });
  console.log('ERRORS', errs.length ? errs : 'none');
  await b.close();
})();
