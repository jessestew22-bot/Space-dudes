# Builds the SPACE DUDES world map as ASCII. Run: python3 tools/build_map.py
W, H = 100, 66
g = [['#'] * W for _ in range(H)]

def carve(x0, y0, x1, y1, ch='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch

def put(x, y, ch): g[y][x] = ch
def plat(x0, x1, y, ch='='):
    for x in range(x0, x1 + 1): g[y][x] = ch

# ---- SURFACE (open sky, rows 0-12) ----
carve(1, 0, 58, 12)
# ground bumps
carve(1, 12, 58, 12)
for x in range(26, 33): put(x, 12, '#')
for x in range(27, 32): put(x, 11, '#')
for x in range(40, 44): put(x, 12, '#')
# east cliff: wall at cols 52-58 rising to row 6 (needs double jump: 6 tiles)
carve(52, 8, 58, 12, '#')
# cliff top continues east into the crystal caverns
carve(52, 0, 64, 7)
# ship pad
put(10, 12, 'S')

# ---- ESCAPE SHAFT (cols 1-5, rows 13-60), sealed by G ----
carve(1, 13, 5, 60)
for x in range(1, 6): put(x, 13, 'G')
for i, y in enumerate(range(17, 60, 4)):
    if i % 2 == 0: plat(1, 3, y)
    else: plat(3, 5, y)

# ---- UPPER CAVES (rows 14-30) ----
carve(19, 13, 22, 17)          # drop hole from surface
carve(8, 17, 40, 21)           # long tunnel
for x in range(8, 41, 7): put(x, 21, '#')
carve(8, 15, 12, 17)           # little alcove left
put(10, 17, 'H')               # energy tank (reachable)
put(9, 17, '.')
carve(36, 21, 40, 25)          # step down
carve(36, 24, 57, 29)          # Richie chamber
put(54, 29, 'R')               # Richie stuck in goo
plat(44, 47, 26)
# high alcove with fuel cell 1 (double jump from shelf)
carve(40, 14, 46, 16)
carve(41, 17, 45, 23)
plat(41, 45, 19)
put(43, 15, 'F')
# secret: weak blocks hide the VHS tape
carve(29, 23, 34, 25)
for y in range(23, 26): put(35, y, 'x')
put(30, 25, 'V')
plat(41, 43, 23)

# enemies upper caves
put(16, 21, 'c'); put(30, 20, 'c'); put(48, 29, 'c'); put(50, 25, 'f'); put(25, 18, 'f')
put(35, 12, 'c'); put(46, 11, 'c')

# ---- CRYSTAL CAVERNS (cols 60-98, rows 2-30) ----
carve(59, 2, 97, 8)
carve(86, 8, 97, 29)           # big vertical drop east
carve(62, 22, 90, 29)          # lower hall (Eli)
put(70, 29, 'E')               # Eli
put(66, 29, 'c'); put(76, 29, 'c'); put(80, 24, 'f'); put(72, 23, 'f'); put(84, 29, 'c')
put(75, 5, 'f'); put(90, 8, 'c'); put(97, 16, 't')
# fuel cell 2 behind crystal (X) wall
carve(59, 24, 61, 29)
for y in range(24, 30): put(61, y, 'X')
put(60, 29, 'F')
plat(66, 70, 26)
# crystal floor down into acid depths
carve(64, 30, 68, 33)
for x in range(64, 69): put(x, 30, 'X')
put(82, 3, 'H')                # energy tank 2 (top ledge)
plat(80, 84, 6)

# ---- ACID DEPTHS (rows 31-50, cols 20-98) ----
carve(22, 34, 96, 49)
carve(22, 47, 96, 49, '~')     # acid sea
# stepping stones / islands
islands = [(66, 70, 44), (58, 61, 45), (50, 53, 44), (42, 46, 45), (34, 37, 44)]
for x0, x1, y in islands:
    carve(x0, y + 1, x1, 49, '#')
for x in range(42, 47): put(x, 45, '.')
put(44, 45, 'T')               # Big T on his island
carve(42, 46, 46, 49, '#')
plat(72, 76, 40); plat(80, 84, 37); plat(56, 60, 39); plat(26, 30, 40)
# fuel cell 3 at the bottom of a deep acid pit
carve(78, 50, 84, 55, '~')
put(81, 55, 'F')
carve(78, 56, 84, 56, '#')
put(74, 43, 'f'); put(52, 38, 'f'); put(88, 34, 't'); put(30, 39, 'f'); put(62, 41, 'f')
# acid corridor to the boss gate (wall-hugging, needs suit)
carve(14, 45, 21, 49, '~')
carve(14, 42, 21, 44)
for y in range(42, 50): put(13, y, 'D')   # boss gate
# ---- HIVE / BOSS ARENA ----
carve(9, 42, 12, 51)
carve(8, 52, 44, 62)           # arena
plat(14, 18, 58); plat(34, 38, 58); plat(23, 29, 55)
put(40, 60, 'K')               # boss spawn
put(42, 62, 'P')               # captured crew
for y in range(56, 61):
    put(6, y, 'G'); put(7, y, 'G')
carve(6, 56, 7, 60, 'G')

# east-drop ladder (placed after the hall carve so it isn't erased)
for i, y in enumerate(range(11, 29, 4)):
    plat(87 + (i % 2) * 4, 92 + (i % 2) * 4, y)
# return routes (no softlocks): surface hole ledge, acid -> crystal ladder
plat(19, 20, 18); plat(21, 22, 15)
plat(62, 64, 41); plat(66, 68, 37); plat(64, 65, 33)

for y in range(H):
    for x in range(W):
        if x in (0, W - 1) or y == H - 1:
            if g[y][x] not in 'G': g[y][x] = '#'
# sky open at top row except walls
print('\n'.join(''.join(r) for r in g))
