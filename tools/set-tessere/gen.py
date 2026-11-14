#!/usr/bin/env python3
"""Genera i set di tessere tematici (SVG) partendo dalla geometria delle tessere vettoriali «carta» (assets/tiles, assets/ingressi).
Uso: gen.py <classico|foresta> <cartella-di-uscita> [id ...]   (senza id: tutte le 36 stanze + 6 ingressi)
Le dimensioni, i quadretti e le porte restano identici all'originale; cambiano solo pavimento, muri, dettagli e porte."""
import json, math, os, random, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
META = json.load(open(os.path.join(ROOT, 'data/rules/tiles.json')))
f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')

def leggi(kind, n):
    s = open(os.path.join(ROOT, 'assets', kind, n + '.svg')).read()
    m = re.search(r'<g filter="url\(#m\)"><path d="([^"]*)"', s)
    muri = [tuple(float(x) for x in t) for t in re.findall(r'M(\S+) (\S+)L(\S+) (\S+)', m.group(1))]
    porte = [tuple(float(x) for x in t) for t in re.findall(r'<rect x="(\S+)" y="(\S+)" width="(\S+)" height="(\S+)"', s)]
    return s, muri, porte

class Tema:
    def __init__(s, rng, celle, muri, porte):
        s.r, s.celle, s.muri, s.porte = rng, set(map(tuple, celle)), muri, porte
        s.dc = [(x + w / 2, y + h / 2) for x, y, w, h in porte]
    def libero(s, x, y, m=0.5):
        return all(math.hypot(x - a, y - b) > m for a, b in s.dc)
    def punti(s, n, margine=0.14, m=0.5):
        out = []
        for _ in range(n * 3):
            if len(out) >= n: break
            i, j = s.r.choice(sorted(s.celle))
            x, y = i + margine + s.r.random() * (1 - 2 * margine), j + margine + s.r.random() * (1 - 2 * margine)
            if s.libero(x, y, m): out.append((x, y, i, j))
        return out
    def interno(s, i, j):
        return all((i + a, j + b) in s.celle for a in (-1, 0, 1) for b in (-1, 0, 1))
    def pathmuri(s):
        return ' '.join(f'M{f(a)} {f(b)}L{f(c)} {f(d)}' for a, b, c, d in s.muri)

def cornice(t, seed, corpo, defs=''):
    W = max(i for i, j in t.celle) + 1; H = max(j for i, j in t.celle) + 1
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{round((W + .5) * 128)}" height="{round((H + .5) * 128)}" viewBox="-0.25 -0.25 {W + .5} {H + .5}">\n'
            f'<defs><filter id="m" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="{seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.08"/></filter>'
            f'<filter id="p" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="{seed + 3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.045"/></filter>{defs}</defs>\n{corpo}</svg>\n')

def celle_path(t): return ''.join(f'M{i} {j}h1v1h-1z' for i, j in sorted(t.celle))
def griglia(t, col, op):
    g = []
    for i, j in sorted(t.celle):
        if (i + 1, j) in t.celle: g.append(f'M{i + 1} {j}v1')
        if (i, j + 1) in t.celle: g.append(f'M{i} {j + 1}h1')
    return f'<path d="{" ".join(g)}" fill="none" stroke="{col}" stroke-opacity="{op}" stroke-width=".025" stroke-dasharray=".06 .05"/>'

def lungo(t, passo, scarto, fn):
    """Chiama fn(x,y,nx,ny) a intervalli regolari lungo i muri; (nx,ny) è la normale verso l'interno."""
    out = []
    for a, b, c, d in t.muri:
        L = math.hypot(c - a, d - b); n = max(1, int(L / passo))
        dx, dy = (c - a) / L, (d - b) / L
        mx, my = (a + c) / 2 - dy * .01, (b + d) / 2 + dx * .01
        nx, ny = (dy, -dx) if ((int(mx), int(my)) in t.celle or (math.floor(mx + dy * .1), math.floor(my - dx * .1)) in t.celle) else (-dy, dx)
        if (math.floor((a + c) / 2 + nx * .1), math.floor((b + d) / 2 + ny * .1)) not in t.celle: nx, ny = -nx, -ny
        for k in range(n):
            u = (k + .5) / n * L + (t.r.random() - .5) * scarto
            out.append(fn(a + dx * u, b + dy * u, nx, ny))
    return out

# ------------------------------------------------------------------ DUNGEON CLASSICO
def classico(t, seed):
    r = t.r; o = []
    o.append(f'<path d="{t.pathmuri()}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round"/>')
    o.append(f'<path d="{celle_path(t)}" fill="#d9d2c0"/>')
    # lastre di pietra: due file di mattoni sfalsati per quadretto
    lastre = []
    for i, j in sorted(t.celle):
        for k in (1, 2):
            y = j + k / 3
            lastre.append(f'M{i} {f(y)}h1')
        off = r.choice((.28, .5, .66)); lastre.append(f'M{f(i + off)} {j}v{f(1 / 3)}'); lastre.append(f'M{f(i + 1 - off)} {f(j + 1 / 3)}v{f(1 / 3)}'); lastre.append(f'M{f(i + off * .9)} {f(j + 2 / 3)}v{f(1 / 3)}')
    o.append(f'<path d="{" ".join(lastre)}" fill="none" stroke="#9c9482" stroke-width=".02" stroke-linecap="round"/>')
    o.append(f'<g clip-path="url(#c)">' if False else '<g>')
    # macchie di umidità e muschio
    for x, y, i, j in t.punti(max(2, len(t.celle) // 3), .1, .3):
        o.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(.08 + r.random() * .1)}" ry="{f(.05 + r.random() * .07)}" fill="{r.choice(("#8fa07a", "#a9a08c", "#7d8f6d"))}" opacity=".45"/>')
    # crepe
    cr = []
    for x, y, i, j in t.punti(max(2, len(t.celle) // 2), .2, .4):
        pts = [(x, y)]
        for _ in range(3): pts.append((pts[-1][0] + (r.random() - .5) * .25, pts[-1][1] + (r.random() - .3) * .2))
        cr.append('M' + ' '.join(f'{f(a)} {f(b)}' for a, b in pts).replace(' ', ' L', 1) if False else 'M' + 'L'.join(f'{f(a)} {f(b)}' for a, b in pts))
    o.append(f'<path d="{" ".join(cr)}" fill="none" stroke="#6e6757" stroke-width=".028" stroke-linecap="round" stroke-linejoin="round"/>')
    # colonne nelle sale ampie, botti, ossa, detriti
    det = []
    for i, j in sorted(t.celle):
        if t.interno(i, j) and r.random() < .55:
            cx, cy = i + .5, j + .5
            det.append(f'<circle cx="{f(cx + .04)}" cy="{f(cy + .05)}" r=".25" fill="#000" opacity=".25"/><circle cx="{f(cx)}" cy="{f(cy)}" r=".22" fill="#b9b2a2" stroke="#3b3a40" stroke-width=".05"/><circle cx="{f(cx - .04)}" cy="{f(cy - .05)}" r=".11" fill="#d3ccbb"/>')
    o.append(f'<g filter="url(#p)">{"".join(det)}</g>')
    ogg = []
    for x, y, i, j in t.punti(max(2, len(t.celle) // 2), .22, .55):
        if t.interno(i, j) and abs(x - i - .5) < .3 and abs(y - j - .5) < .3: continue
        k = r.random()
        if k < .28:   # botte
            ogg.append(f'<g transform="translate({f(x)} {f(y)})"><ellipse rx=".12" ry=".14" fill="#8a5a2b" stroke="#3a2412" stroke-width=".035"/><path d="M-.12 -.04h.24M-.12 .04h.24" stroke="#3a2412" stroke-width=".025"/></g>')
        elif k < .52:   # teschio e ossa
            ogg.append(f'<g transform="translate({f(x)} {f(y)}) rotate({round(r.random() * 60 - 30)})"><path d="M-.1 .08L.1 -.02M-.1 -.02L.1 .08" stroke="#efe9d6" stroke-width=".035" stroke-linecap="round"/><circle r=".07" fill="#efe9d6" stroke="#3b3a40" stroke-width=".02"/><path d="M-.03 -.01h.015M.015 -.01h.015" stroke="#3b3a40" stroke-width=".02"/></g>')
        elif k < .8:   # pietrisco
            ogg.append(''.join(f'<ellipse cx="{f(x + (r.random() - .5) * .16)}" cy="{f(y + (r.random() - .5) * .12)}" rx="{f(.03 + r.random() * .035)}" ry="{f(.025 + r.random() * .03)}" fill="#a49c89" stroke="#4b4639" stroke-width=".015"/>' for _ in range(4)))
        else:   # pozza
            ogg.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx=".13" ry=".07" fill="#7ea3b8" stroke="#4d6d80" stroke-width=".02" opacity=".75"/>')
    o.append(''.join(ogg))
    o.append('</g>')
    # ragnatele agli angoli concavi interni
    ws = []
    for i, j in sorted(t.celle):
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            vx, vy = i + dx, j + dy; sx, sy = (1 if dx == 0 else -1), (1 if dy == 0 else -1)
            nb = [((i + (1 if dx else -1)), j) in t.celle, (i, j + (1 if dy else -1)) in t.celle]
            if not nb[0] and not nb[1] and r.random() < .7 and t.libero(vx, vy, .6):
                L = .3; ws.append(f'M{f(vx + sx * L)} {f(vy)}Q{f(vx + sx * L * .35)} {f(vy + sy * L * .35)} {f(vx)} {f(vy + sy * L)}M{f(vx + sx * L * .6)} {f(vy)}Q{f(vx + sx * L * .25)} {f(vy + sy * L * .25)} {f(vx)} {f(vy + sy * L * .6)}M{f(vx)} {f(vy)}L{f(vx + sx * L * .7)} {f(vy + sy * L * .7)}')
    o.append(f'<path d="{" ".join(ws)}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".014"/>')
    o.append(griglia(t, '#6f6a5c', '.3'))
    # muri: bordo a inchiostro "a mano", fascia di pietra, mattoni, torce
    pm = t.pathmuri()
    o.append(f'<g filter="url(#m)"><path d="{pm}" fill="none" stroke="#1c1a1f" stroke-width=".29" stroke-linecap="round" stroke-linejoin="round"/>'
             f'<path d="{pm}" fill="none" stroke="#5d5663" stroke-width=".2" stroke-linecap="round" stroke-linejoin="round"/></g>')
    o.append(f'<g filter="url(#p)"><path d="{pm}" fill="none" stroke="#8c8494" stroke-width=".05" stroke-dasharray=".14 .09" stroke-linecap="butt"/>'
             f'<path d="{pm}" fill="none" stroke="#1c1a1f" stroke-width=".014" stroke-dasharray=".02 .23" stroke-linecap="butt"/></g>')
    # filo di luce interno e bordino a matita sottile
    o.append(f'<g filter="url(#p)"><path d="{pm}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width=".012" transform="translate(.012 .012)"/></g>')
    torce = []
    def torcia(x, y, nx, ny):
        if abs(nx) + abs(ny) < .5 or r.random() > .22 or not t.libero(x, y, .55): return
        px, py = x + nx * .12, y + ny * .12
        torce.append(f'<g transform="translate({f(px)} {f(py)})"><circle r=".24" fill="url(#lg)"/><path d="M-.03 .05L.03 .05L.02 -.04L-.02 -.04z" fill="#5a3b1c" stroke="#2a1a0c" stroke-width=".015"/><path d="M0 -.04C-.07 -.09 -.03 -.16 0 -.2C.03 -.16 .07 -.09 0 -.04z" fill="#f59a2c" stroke="#8a3a0a" stroke-width=".015"/><path d="M0 -.05C-.03 -.08 -.01 -.12 0 -.14C.01 -.12 .03 -.08 0 -.05z" fill="#ffe27a"/></g>')
    lungo(t, .9, .5, torcia)
    o.append(''.join(torce))
    # porte di legno
    dp = []
    for x, y, w, h in t.porte:
        v = h > w
        dp.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx=".05" fill="#9a6532" stroke="#2c1a0b" stroke-width=".05"/>')
        if v: dp.append(f'<path d="M{f(x + w / 2)} {f(y + .03)}v{f(h - .06)}M{f(x + .03)} {f(y + h * .3)}h{f(w - .06)}M{f(x + .03)} {f(y + h * .7)}h{f(w - .06)}" stroke="#4a2d14" stroke-width=".022"/><circle cx="{f(x + w * .75)}" cy="{f(y + h / 2)}" r=".03" fill="#d8c27a" stroke="#2c1a0b" stroke-width=".012"/>')
        else: dp.append(f'<path d="M{f(x + w / 2)} {f(y + .03)}v{f(h - .06)}M{f(x + w * .3)} {f(y + .03)}v{f(h - .06)}M{f(x + w * .7)} {f(y + .03)}v{f(h - .06)}" stroke="#4a2d14" stroke-width=".02"/><circle cx="{f(x + w / 2 + .09)}" cy="{f(y + h / 2)}" r=".03" fill="#d8c27a" stroke="#2c1a0b" stroke-width=".012"/>')
    o.append(f'<g filter="url(#p)">{"".join(dp)}</g>')
    defs = '<radialGradient id="lg"><stop offset="0" stop-color="#ffb347" stop-opacity=".75"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>'
    return cornice(t, seed, '\n'.join(o), defs)

# ------------------------------------------------------------------ FORESTA
VERDI = ['#4f8a3f', '#3f7a3b', '#5f9a46', '#336b34']
def foresta(t, seed):
    r = t.r; o = []
    pm = t.pathmuri()
    o.append(f'<path d="{pm}" fill="none" stroke="#1b2f12" stroke-opacity=".3" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round"/>')
    o.append(f'<path d="{celle_path(t)}" fill="#bcd68f"/>')
    # chiazze d'erba più chiara/scura a scacchi morbidi
    ch = ''.join(f'<ellipse cx="{f(i + .5 + (r.random() - .5) * .3)}" cy="{f(j + .5 + (r.random() - .5) * .3)}" rx="{f(.3 + r.random() * .15)}" ry="{f(.25 + r.random() * .15)}" fill="{r.choice(("#a8c97a", "#cfe3a3", "#b0cf80"))}" opacity=".7"/>' for i, j in sorted(t.celle))
    o.append(f'<g filter="url(#p)">{ch}</g>')
    # sentiero di terra battuta che collega le porte (a tratto largo)
    if len(t.dc) >= 2 and len(t.celle) > 3:
        cs = sorted(t.celle); pts = []
        for x, y in t.dc:
            pts.append((x, y))
        cx = sum(c[0] + .5 for c in cs) / len(cs); cy = sum(c[1] + .5 for c in cs) / len(cs)
        # il sentiero passa per il centro del quadretto più vicino al baricentro
        ci, cj = min(cs, key=lambda c: (c[0] + .5 - cx) ** 2 + (c[1] + .5 - cy) ** 2)
        seg = ''
        for x, y in pts[:3]:
            ix, iy = min(max(x, 0.001), 1e9), y
            tx = x + (0.0 if abs(y - round(y)) < .01 else 0)
            # punto un poco dentro la stanza
            ex = x + (.3 if (int(x), int(y)) not in t.celle and x - int(x) < .01 else 0)
            seg += f'M{f(x)} {f(y)}Q{f(ci + .5)} {f(cj + .5)} {f(ci + .5)} {f(cj + .5)}'
        o.append(f'<g clip-path="url(#cl)"><path d="{seg}" fill="none" stroke="#c9b27e" stroke-width=".26" stroke-linecap="round" opacity=".75"/></g>')
    # ciuffi d'erba
    ci = []
    for x, y, i, j in t.punti(len(t.celle) * 4, .08, .3):
        h = .05 + r.random() * .04; ci.append(f'M{f(x)} {f(y)}l-.03 -{f(h)}M{f(x)} {f(y)}l0 -{f(h * 1.2)}M{f(x)} {f(y)}l.03 -{f(h)}')
    o.append(f'<path d="{"".join(ci)}" fill="none" stroke="#3f7a3b" stroke-width=".014" stroke-linecap="round"/>')
    # fiori, funghi, sassi, tronchi
    for x, y, i, j in t.punti(len(t.celle) * 2, .12, .45):
        k = r.random()
        if k < .4:
            c = r.choice(('#ffffff', '#ffe066', '#f5a3c0', '#c3a5f0')); o.append(f'<g transform="translate({f(x)} {f(y)})"><circle r=".028" cx=".035" fill="{c}"/><circle r=".028" cx="-.035" fill="{c}"/><circle r=".028" cy=".035" fill="{c}"/><circle r=".028" cy="-.035" fill="{c}"/><circle r=".02" fill="#e0a21a"/></g>')
        elif k < .6:
            o.append(f'<g transform="translate({f(x)} {f(y)})"><rect x="-.012" y="0" width=".024" height=".05" fill="#efe6cf" stroke="#6b5a3a" stroke-width=".01"/><path d="M-.05 0A.05 .045 0 0 1 .05 0z" fill="#c9482f" stroke="#5e1a10" stroke-width=".014"/><circle cx="-.02" cy="-.02" r=".009" fill="#fff"/><circle cx=".02" cy="-.012" r=".008" fill="#fff"/></g>')
        elif k < .85:
            o.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(.05 + r.random() * .04)}" ry="{f(.04 + r.random() * .03)}" fill="#a6a69c" stroke="#4c4c44" stroke-width=".022"/><path d="M{f(x - .03)} {f(y - .01)}q.03 -.03 .06 0" stroke="#d3d3c8" stroke-width=".015" fill="none"/>')
        else:
            o.append(f'<g transform="translate({f(x)} {f(y)}) rotate({round(r.random() * 40 - 20)})"><rect x="-.14" y="-.035" width=".28" height=".07" rx=".035" fill="#8a5a2b" stroke="#3a2412" stroke-width=".022"/><ellipse cx=".14" rx=".014" ry=".035" fill="#d9b27a" stroke="#3a2412" stroke-width=".012"/></g>')
    # alberi isolati nelle sale ampie
    alb = []
    for i, j in sorted(t.celle):
        if t.interno(i, j) and r.random() < .5:
            x, y = i + .5 + (r.random() - .5) * .2, j + .5 + (r.random() - .5) * .2
            alb.append(f'<g transform="translate({f(x)} {f(y)})"><ellipse cx=".05" cy=".12" rx=".26" ry=".09" fill="#000" opacity=".22"/><rect x="-.04" y="-.02" width=".08" height=".16" fill="#7a4e26" stroke="#3a2412" stroke-width=".022"/><circle cy="-.1" r=".26" fill="#3f7a3b" stroke="#1b2f12" stroke-width=".035"/><circle cx="-.08" cy="-.16" r=".14" fill="#5f9a46"/><circle cx=".1" cy="-.06" r=".1" fill="#4f8a3f"/><circle cx="-.06" cy=".0" r=".06" fill="#336b34"/></g>')
    o.append(f'<g filter="url(#p)">{"".join(alb)}</g>')
    o.append(griglia(t, '#4d7a3a', '.3'))
    # muri: siepe/bosco fitto con bordino a mano
    o.append(f'<g filter="url(#m)"><path d="{pm}" fill="none" stroke="#14250d" stroke-width=".31" stroke-linecap="round" stroke-linejoin="round"/>'
             f'<path d="{pm}" fill="none" stroke="#2f5f2c" stroke-width=".22" stroke-linecap="round" stroke-linejoin="round"/></g>')
    blob = {c: [] for c in VERDI}
    def fogl(x, y, nx, ny):
        pass
    for a, b, c_, d in t.muri:
        L = math.hypot(c_ - a, d - b); n = max(2, int(L / .17)); dx, dy = (c_ - a) / L, (d - b) / L
        for k in range(n):
            u = (k + .5) / n * L
            px = a + dx * u + (r.random() - .5) * .08; py = b + dy * u + (r.random() - .5) * .08
            rad = .085 + r.random() * .05
            if not t.libero(px, py, .4): rad *= .6
            blob[r.choice(VERDI)].append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(rad)}"/>')
    g = ''.join(f'<g fill="{c}" stroke="#14250d" stroke-width=".02">{"".join(v)}</g>' for c, v in blob.items())
    o.append(f'<g filter="url(#p)">{g}</g>')
    luci = []
    for a, b, c_, d in t.muri:
        L = math.hypot(c_ - a, d - b); n = max(1, int(L / .5)); dx, dy = (c_ - a) / L, (d - b) / L
        for k in range(n):
            u = (k + .5) / n * L; px, py = a + dx * u, b + dy * u
            if t.libero(px, py, .5) and r.random() < .55:
                col = r.choice(('#7fc05a', '#9ad46a')); luci.append(f'<circle cx="{f(px - .03)}" cy="{f(py - .04)}" r=".04" fill="{col}" opacity=".9"/>')
                if r.random() < .5: luci.append(f'<circle cx="{f(px + .05)}" cy="{f(py + .02)}" r=".028" fill="#e8584a" stroke="#6b1a12" stroke-width=".008"/>')
    o.append(''.join(luci))
    # cancelli/aperture di legno
    dp = []
    for x, y, w, h in t.porte:
        v = h > w
        if v: dp.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx=".05" fill="#a8743c" stroke="#3a2412" stroke-width=".05"/><path d="M{f(x + w / 2)} {f(y + .03)}v{f(h - .06)}M{f(x + .03)} {f(y + h * .25)}h{f(w - .06)}M{f(x + .03)} {f(y + h * .75)}h{f(w - .06)}" stroke="#5a3a1a" stroke-width=".026"/><circle cx="{f(x + w / 2)}" cy="{f(y + h * .5)}" r=".03" fill="#d8c27a" stroke="#3a2412" stroke-width=".012"/>')
        else: dp.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx=".05" fill="#a8743c" stroke="#3a2412" stroke-width=".05"/><path d="M{f(x + w * .25)} {f(y + .03)}v{f(h - .06)}M{f(x + w * .75)} {f(y + .03)}v{f(h - .06)}M{f(x + .03)} {f(y + h / 2)}h{f(w - .06)}" stroke="#5a3a1a" stroke-width=".026"/><circle cx="{f(x + w / 2)}" cy="{f(y + h / 2)}" r=".03" fill="#d8c27a" stroke="#3a2412" stroke-width=".012"/>')
    o.append(f'<g filter="url(#p)">{"".join(dp)}</g>')
    defs = f'<clipPath id="cl"><path d="{celle_path(t)}"/></clipPath>'
    return cornice(t, seed, '\n'.join(o), defs)

TEMI = {'classico': classico, 'foresta': foresta}

# ------------------------------------------------------------------ GEOMETRIA ORIGINALE
# Le porte (e le aperture di corridoio) restano dove sono nelle tessere del manuale; il corpo della stanza viene ridisegnato.
def lati(o, i, j): return ((i, j - 1), (i, j)) if o == 'h' else ((i - 1, j), (i, j))
def vicini4(c): return [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)]

def analizza(kind, n):
    m = META[kind][n]; _, _, rect = leggi(kind, n)
    celle = set(map(tuple, m['celle']))
    porte = [tuple(p) for p in m['porte']]
    porte_rect = set()
    for x, y, w, h in rect:
        porte_rect.add(('h', round(x - .14), round(y + .17)) if w > h else ('v', round(x + .17), round(y - .14)))
    porte_d = [p for p in porte if p in porte_rect]; punte = [p for p in porte if p not in porte_rect]
    ob_in, vietate = set(), set()
    for o, i, j in porte:
        a, b = lati(o, i, j); dentro, fuori = (a, b) if a in celle else (b, a)
        ob_in.add(dentro); vietate.add(fuori)
    for o, i, j in punte:   # il braccio di un corridoio aperto resta largo 1 quadretto per 3 quadretti
        a, b = lati(o, i, j); dentro, fuori = (a, b) if a in celle else (b, a)
        d = (dentro[0] - fuori[0], dentro[1] - fuori[1])
        for k in range(3):
            c = (dentro[0] + d[0] * k, dentro[1] + d[1] * k); ob_in.add(c)
            for v in vicini4(c):
                if v != (c[0] - d[0], c[1] - d[1]) and v != (c[0] + d[0], c[1] + d[1]): vietate.add(v)
    return celle, porte_d, punte, ob_in, vietate

def ricette(bw, bh, r):
    """Forme candidate (insiemi di quadretti) per un ingombro bw×bh; ognuna ha un nome."""
    R_ = [(i, j) for i in range(bw) for j in range(bh)]
    dist = lambda i, j: min(i, bw - 1 - i) + min(j, bh - 1 - j)
    out = {}
    out['rettangolo'] = set(R_)
    if bw >= 3 and bh >= 3: out['smussata'] = {c for c in R_ if dist(*c) >= 1 or True} - {c for c in R_ if dist(*c) < 1}
    if bw >= 4 and bh >= 4: out['ottagono'] = {c for c in R_ if dist(*c) >= 2}
    if bw >= 3 and bh >= 3:
        cx, cy, rx, ry = (bw - 1) / 2, (bh - 1) / 2, bw / 2 + .15, bh / 2 + .15
        out['ovale'] = {(i, j) for i, j in R_ if ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1.0}
    if bw >= 4 and bh >= 3:
        a, b = max(1, bw // 3), max(1, bh // 3)
        out['croce'] = {(i, j) for i, j in R_ if a <= i < bw - a or b <= j < bh - b}
    if bw >= 4 and bh >= 4:
        qx, qy = bw // 2, bh // 2; q = r.choice([(0, 0), (bw - qx, 0), (0, bh - qy), (bw - qx, bh - qy)])
        out['elle'] = {(i, j) for i, j in R_ if not (q[0] <= i < q[0] + qx and q[1] <= j < q[1] + qy)}
    if bw >= 5 and bh >= 3:
        t = bh // 2 or 1; out['tau'] = {(i, j) for i, j in R_ if j < t or bw // 3 <= i < bw - bw // 3}
    if bw >= 5 and bh >= 5:
        c = {(i, j) for i, j in R_}; c.discard((bw // 2, bh // 2)); out['pilastro'] = c
    if bw >= 4 and bh >= 4:   # sala con nicchie: nucleo ridotto + nicchie sui lati
        nuc = {(i, j) for i, j in R_ if 1 <= i < bw - 1 and 1 <= j < bh - 1}
        nic = {(bw // 2, 0), (bw // 2, bh - 1), (0, bh // 2), (bw - 1, bh // 2)}
        out['nicchie'] = nuc | nic
    # macchia irregolare (radura): crescita casuale dal centro, poi lisciatura
    if bw >= 3 and bh >= 3:
        mid = (bw // 2, bh // 2); blob = {mid}; fr = [mid]; tot = max(4, int(len(R_) * .75))
        while len(blob) < tot and fr:
            c = r.choice(fr); nb = [v for v in vicini4(c) if v in set(R_) and v not in blob]
            if not nb: fr.remove(c); continue
            v = r.choice(nb); blob.add(v); fr.append(v)
        out['radura'] = blob
    return out

def connessa(S, partenza):
    vis = {partenza}; st = [partenza]
    while st:
        c = st.pop()
        for v in vicini4(c):
            if v in S and v not in vis: vis.add(v); st.append(v)
    return vis

def ancora(S, obblig): return sorted(obblig)[0] if obblig else min(S, key=lambda c: (c[1], c[0]))

def costruisci(kind, n, tema, seed):
    """Restituisce (celle, porte_d, punte) della tessera ridisegnata, con le porte negli stessi punti dell'originale (coordinate rinormalizzate)."""
    orig, porte_d, punte, obblig, vietate = analizza(kind, n)
    bw = max(c[0] for c in orig) + 1; bh = max(c[1] for c in orig) + 1
    r = random.Random(seed * 104729 + (1 if tema == 'classico' else 2))
    M = 1
    regione = {(i, j) for i in range(-M, bw + M) for j in range(-M, bh + M)} - vietate
    corridoio = bw == 1 or bh == 1 or max(bw, bh) >= 3 * min(bw, bh) and min(bw, bh) <= 1
    cand = []
    if corridoio:
        base = set(orig); liberi = [c for c in sorted(regione - base) if any(v in base for v in vicini4(c))]
        r.shuffle(liberi)
        for c in liberi[:12]:
            cand.append(('nicchia', base | {c}))
            if len(cand) > 3: break
        cand.append(('corridoio', base))
    else:
        for nome, S in ricette(bw, bh, r).items():
            # prova le posizioni: l'ingombro può slittare di un quadretto (i vincoli decidono)
            cand.append((nome, S))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if r.random() < .35: cand.append((nome, {(i + dx, j + dy) for i, j in S}))
        pref = ['ovale', 'radura', 'elle', 'croce'] if tema == 'foresta' else ['ottagono', 'croce', 'nicchie', 'pilastro', 'tau', 'smussata']
        r.shuffle(cand); cand.sort(key=lambda t: (t[0] not in pref, r.random()))
    migliore = None
    for nome, S in cand:
        S = (set(S) | obblig) & regione | obblig
        S -= vietate
        # collegamento di ogni componente a quella che contiene le porte
        if not obblig <= S: continue
        comp0 = connessa(S, ancora(S, obblig))
        for _ in range(8):   # collega i frammenti rimasti con un percorso, se possibile
            resto = S - comp0
            if not resto: break
            c = min(resto, key=lambda x: min(abs(x[0] - a[0]) + abs(x[1] - a[1]) for a in comp0)); a = min(comp0, key=lambda x: abs(x[0] - c[0]) + abs(x[1] - c[1]))
            x, y = c; passo = []
            while (x, y) != a and len(passo) < 40:
                if x != a[0]: x += 1 if a[0] > x else -1
                else: y += 1 if a[1] > y else -1
                if (x, y) in vietate: passo = None; break
                passo.append((x, y))
            if passo: S |= set(passo)
            else: S -= {c}
            comp0 = connessa(S, ancora(S, obblig))
        S = connessa(S, ancora(S, obblig))
        if not obblig <= S or S & vietate: continue
        diff = len(S ^ orig) / max(1, len(orig)); area = len(S) / max(1, len(orig))
        if .6 <= area <= 1.5 and (migliore is None or diff > migliore[0]) and (corridoio or diff >= .22):
            migliore = (diff, S)
            if diff >= .3: break
    S = migliore[1] if migliore else set(orig)
    mx, my = min(c[0] for c in S), min(c[1] for c in S)
    sh = lambda p: (p[0], p[1] - mx if p[0] == 'h' else p[1] - mx, p[2] - my if p[0] == 'h' else p[2] - my)
    def sp(p): return (p[0], p[1] - mx, p[2] - my)
    return {(i - mx, j - my) for i, j in S}, [sp(p) for p in porte_d], [sp(p) for p in punte]

def muri_di(celle, punte):
    tset = set(punte); seg = []
    for i, j in sorted(celle):
        for o, ei, ej, a in (('h', i, j, (i, j - 1)), ('h', i, j + 1, (i, j + 1)), ('v', i, j, (i - 1, j)), ('v', i + 1, j, (i + 1, j))):
            if a not in celle and (o, ei, ej) not in tset:
                seg.append((ei, ej, ei + 1, ej) if o == 'h' else (ei, ej, ei, ej + 1))
    return [tuple(float(v) for v in t) for t in seg]
def rect_porte(porte_d):
    return [(i + .14, j - .17, .72, .34) if o == 'h' else (i - .17, j + .14, .34, .72) for o, i, j in porte_d]

def genera(tema, out, ids=None):
    os.makedirs(os.path.join(out, 'tiles'), exist_ok=True); os.makedirs(os.path.join(out, 'ingressi'), exist_ok=True)
    tot = 0; meta = {'tiles': {}, 'ingressi': {}}
    for kind in ('tiles', 'ingressi'):
        for n in META[kind]:
            seed = int(n) + (0 if kind == 'tiles' else 100)
            celle, porte_d, punte = costruisci(kind, n, tema, seed)
            if not porte_d and punte:   # un corridoio senza porte non va bene: la prima apertura diventa una porta (le altre restano aperte)
                porte_d, punte = [punte[0]], punte[1:]
            W = max(i for i, j in celle) + 1; H = max(j for i, j in celle) + 1
            meta[kind][n] = dict(w=round((W + .5) * 128), h=round((H + .5) * 128), cx=128, cy=128, ox=32, oy=32, svg=True,
                                 celle=sorted([list(c) for c in celle]), porte=[list(p) for p in porte_d + punte])
            if ids and (kind[0] + n) not in ids and n not in ids: continue
            t = Tema(random.Random(seed * 7919 + len(tema)), celle, muri_di(celle, punte), rect_porte(porte_d))
            s = TEMI[tema](t, seed)
            open(os.path.join(out, kind, n + '.svg'), 'w').write(s); tot += len(s)
    json.dump(meta, open(os.path.join(out, 'tiles-meta.json'), 'w'), separators=(',', ':'))
    return tot

if __name__ == '__main__':
    tema, out = sys.argv[1], sys.argv[2]
    print(tema, genera(tema, out, set(sys.argv[3:]) or None), 'byte')
