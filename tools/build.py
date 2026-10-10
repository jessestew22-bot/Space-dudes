# Builds the game two ways:
#   dist/space-dudes.html  - body fragment (claude.ai artifact)
#   index.html             - full page for GitHub Pages (+ manifest/icons in web/)
import json, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
rows = subprocess.check_output(['python3', str(root / 'tools/build_map.py')], text=True).strip().split('\n')
js = '\n'.join((root / 'src' / f).read_text() for f in ['audio.js', 'art.js', 'world.js', 'game.js', 'ui.js'])
html = (root / 'src/index.src.html').read_text()
html = html.replace('/*__MAP__*/', "'use strict';\nconst MAP_ROWS = " + json.dumps(rows) + ';').replace('/*__JS__*/', js)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/space-dudes.html').write_text(html)

cut = html.index('</style>') + len('</style>')
head, body = html[:cut], html[cut:]
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link rel="manifest" href="web/manifest.webmanifest">
<link rel="icon" type="image/png" href="web/icon-192.png">
<link rel="apple-touch-icon" href="web/apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Space Dudes">
{head}
</head>
<body>{body}</body>
</html>
'''
(root / 'index.html').write_text(page)
print('built', len(html), 'bytes')
