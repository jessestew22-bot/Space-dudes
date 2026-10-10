// Renders the home-screen icons from the game's own art: node tools/icons.js
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const root = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); await p.goto('file://' + root + '/index.html'); await p.waitForTimeout(300);
  for (const [name, n] of [['icon-512', 512], ['icon-192', 192], ['apple-touch-icon', 180]]) {
    const url = await p.evaluate(n => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#07021a'); g.addColorStop(0.6, '#3a0f5a'); g.addColorStop(1, '#ff4fa3');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      STARS.slice(0, 30).forEach(s => { x.fillStyle = 'rgba(255,240,255,.8)'; x.fillRect((s.x / 10) | 0, (s.y / 4) | 0, 1, 1); });
      drawPlanetBG(x, 48, 16, 9, 0);
      x.save(); x.translate(8, 14); x.scale(1.2, 1.2); drawPortrait(x, 'jesse', { noBg: true, t: 1, mood: 'smirk' }); x.restore();
      const o = document.createElement('canvas'); o.width = o.height = n; const ox = o.getContext('2d');
      ox.imageSmoothingEnabled = false; ox.drawImage(c, 0, 0, n, n); return o.toDataURL('image/png');
    }, n);
    fs.writeFileSync(`${root}/web/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons ok');
})();
