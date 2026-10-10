// Dialogue/banner must never cover the touch controls: node tests/layout.js (serve repo on :8765 first)
const path = require('path');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const S = path.resolve(__dirname, '../.shots/');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = []; let fails = 0;
  for (const [tag, vp] of [['iphone-land', { width: 844, height: 390 }], ['iphone-port', { width: 390, height: 844 }], ['se-land', { width: 667, height: 375 }], ['se-port', { width: 375, height: 667 }]]) {
    const c = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(String(e)));
    await p.goto('http://localhost:8765/#jesse'); await p.waitForTimeout(500);
    for (const [kind, code] of [
      ['dialog', `say(SCRIPT.eli('jesse'))`],
      ['longest', `say([['jesse', 'And it\\'s Tuesday, and you came anyway. Checkmate. My AI says the crew left early. Rude.']])`],
      ['banner', `banner(...SCRIPT.eliGift)`],
    ]) {
      await p.evaluate(code); await p.waitForTimeout(kind === 'longest' ? 2200 : 900);
      const r = await p.evaluate(kind => {
        const box = (kind === 'banner' ? $('banner') : $('dialog')).getBoundingClientRect();
        const hit = ['pad', 'btnA', 'btnB'].filter(id => { const q = $(id).getBoundingClientRect(); return box.left < q.right && box.right > q.left && box.top < q.bottom && box.bottom > q.top; });
        const st = $('stage').getBoundingClientRect();
        return { hit, inStage: box.top >= st.top - 1 && box.bottom <= st.bottom + 1 && box.left >= -1 && box.right <= innerWidth + 1 };
      }, kind);
      const ok = r.hit.length === 0 && r.inStage;
      if (!ok) fails++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${tag} ${kind}`, JSON.stringify(r));
      await p.screenshot({ path: `${S}/ui-${tag}-${kind}.png` });
      await p.evaluate(() => { while (state === 'dialog' || state === 'banner') advance(); });
    }
    await c.close();
  }
  console.log('fails', fails, 'errors', errs); await b.close();
})();
