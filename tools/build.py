# Inlines src/ into dist/space-dudes.html (single file, no external assets except Google Fonts).
import json, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
rows = subprocess.check_output(['python3', str(root / 'tools/build_map.py')], text=True).strip().split('\n')
js = '\n'.join((root / 'src' / f).read_text() for f in ['audio.js', 'art.js', 'world.js', 'game.js', 'ui.js'])
html = (root / 'src/index.src.html').read_text()
html = html.replace('/*__MAP__*/', "'use strict';\nconst MAP_ROWS = " + json.dumps(rows) + ';').replace('/*__JS__*/', js)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/space-dudes.html').write_text(html)
print('built', len(html), 'bytes')
