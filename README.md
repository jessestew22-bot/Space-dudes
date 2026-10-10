# SPACE DUDES

Metroid-style platform shooter from Ian's pitch. Single HTML file, all art and music generated in code, touch controls for iPhone.

- Play: `dist/space-dudes.html` (published as a claude.ai artifact)
- Build: `python3 tools/build.py` (map from `tools/build_map.py` + `src/*` → `dist/space-dudes.html`)
- Tests: `node tests/physics.js` (every gated jump is reachable, no softlocks) and `node tests/smoke.js` (screenshots to `.shots/`)
- Debug deep links: `#jesse`, `#ian` (skip menus), `#ending`
