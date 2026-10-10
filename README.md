# SPACE DUDES

Metroid-style platform shooter from Ian's pitch. Single HTML file, all art and music generated in code, touch controls for iPhone.

**Play:** https://jessestew22-bot.github.io/Space-dudes/ (iPhone: Share → Add to Home Screen for full screen)

- `index.html` + `web/` is the GitHub Pages build; `dist/space-dudes.html` is the same game as a page fragment
- Build: `python3 tools/build.py` (map from `tools/build_map.py` + `src/*` → `index.html` and `dist/space-dudes.html`); icons: `node tools/icons.js`
- Tests: `node tests/physics.js` (every gated jump is reachable, no softlocks) and `node tests/smoke.js` (screenshots to `.shots/`)
- Debug deep links: `#jesse`, `#ian` (skip menus), `#ending`
