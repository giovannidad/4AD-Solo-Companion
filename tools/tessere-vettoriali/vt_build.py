import numpy as np, json, os, math, collections
from vt_analyze import analizza, S
OUT=S+'svg/'; os.makedirs(OUT,exist_ok=True)
OVR=json.load(open(S+'vt_ovr.json')) if os.path.exists(S+'vt_ovr.json') else {}
PAD=0.25           # margine (quadretti) attorno al pavimento: spessore dei muri e alone
K=128              # pixel per quadretto nella dimensione naturale dell'SVG

def estrai(name,ovr=None):
    r=analizza(name)
    xs,ys,px,py=r['xs'],r['ys'],r['px'],r['py']
    cells={k for k,v in r['cells'].items() if v>0.5}
    if ovr and ovr.get('set'): cells={tuple(c) for c in ovr['set']}
    # porte -> segmento di muro (orizzontale 'h' alla linea j fra le righe j-1 e j; verticale 'v' alla linea i)
    doors=[]
    for q in r['doors']:
        gx=(q['cx']-xs[0])/px; gy=(q['cy']-ys[0])/py
        orient='h' if q['bw']>q['bh'] else 'v'
        best=None
        for di in (-1,0,1):
            for dj in (-1,0,1):
                if orient=='h':
                    i=math.floor(gx)+di; j=round(gy)+dj
                    a,b=(i,j-1),(i,j)
                    dist=abs((i+0.5)-gx)+abs(j-gy)
                else:
                    i=round(gx)+di; j=math.floor(gy)+dj
                    a,b=(i-1,j),(i,j)
                    dist=abs((j+0.5)-gy)+abs(i-gx)
                n=(a in cells)+(b in cells)
                if n==0: continue
                sc=dist+(0.3 if n==2 else 0)
                if best is None or sc<best[0]: best=(sc,orient,i,j,n)
        if best and best[0]<1.1: doors.append(best[1:])
    # taglia gli spigoli di porta e tieni la componente principale
    cut={(('h',i,j)) for (o,i,j,n) in doors if o=='h'}|{('v',i,j) for (o,i,j,n) in doors if o=='v'}
    adj=collections.defaultdict(list)
    for (i,j) in cells:
        for (ni_,nj_,e) in ((i+1,j,('v',i+1,j)),(i-1,j,('v',i,j)),(i,j+1,('h',i,j+1)),(i,j-1,('h',i,j))):
            if (ni_,nj_) in cells and e not in cut: adj[(i,j)].append((ni_,nj_))
    seen=set(); comps=[]
    for c in cells:
        if c in seen: continue
        st=[c]; comp=set()
        while st:
            u=st.pop()
            if u in comp: continue
            comp.add(u); st+=adj[u]
        seen|=comp; comps.append(comp)
    comps.sort(key=len,reverse=True)
    cells=comps[0] if comps else set()
    return cells,[d for d in doors if True]

def svg(num,cells,doors,ovr):
    cells=set(cells)
    for c in ovr.get('add',[]): cells.add(tuple(c))
    for c in ovr.get('del',[]): cells.discard(tuple(c))
    doors=[tuple(d) for d in doors]+[tuple(d) for d in ovr.get('doors',[])]
    # solo le porte con un lato di pavimento
    doors=[(o,i,j) for (o,i,j,*_) in doors if ((i,j-1) in cells)!=((i,j) in cells) if o=='h'] + [(o,i,j) for (o,i,j,*_) in doors if o=='v' and (((i-1,j) in cells)!=((i,j) in cells))]
    if not cells: return None
    i0=min(c[0] for c in cells); j0=min(c[1] for c in cells); i1=max(c[0] for c in cells)+1; j1=max(c[1] for c in cells)+1
    fw,fh=i1-i0,j1-j0
    cs=lambda c:(c[0]-i0,c[1]-j0)
    fl={cs(c) for c in cells}
    # estremità aperte: punta di un braccio largo 1 quadretto e lungo almeno 3 (la figura del manuale prosegue oltre la tessera)
    dset={(o,i-i0,j-j0) for (o,i,j) in doors}
    tips=[]
    for (i,j) in fl:
        for (dx,dy,edge) in ((0,1,('h',i,j)),(0,-1,('h',i,j+1)),(1,0,('v',i,j)),(-1,0,('v',i+1,j))):
            # dx,dy = direzione in cui si trova il corpo del braccio; il bordo opposto è la punta
            if (i-dx,j-dy) in fl: continue
            run=[(i+dx*k,j+dy*k) for k in range(3)]
            if not all(c in fl for c in run): continue
            if any(((c[0]+px_,c[1]+py_) in fl) for c in run[:2] for (px_,py_) in ((dy,dx),(-dy,-dx))): continue
            if edge in dset: continue
            tips.append(edge)
    walls=[]  # segmenti di muro come (x1,y1,x2,y2) in quadretti
    for (i,j) in fl:
        if (i,j-1) not in fl: walls.append((i,j,i+1,j))
        if (i,j+1) not in fl: walls.append((i,j+1,i+1,j+1))
        if (i-1,j) not in fl: walls.append((i,j,i,j+1))
        if (i+1,j) not in fl: walls.append((i+1,j,i+1,j+1))
    def seg(e):
        o,i,j=e
        return (i,j,i+1,j) if o=='h' else (i,j,i,j+1)
    tseg={seg(e) for e in tips}
    walls=[w for w in walls if w not in tseg]
    W=fw+2*PAD; H=fh+2*PAD
    f=lambda v:('%.3f'%v).rstrip('0').rstrip('.')
    wp=' '.join(f'M{f(a)} {f(b)}L{f(c)} {f(d)}' for a,b,c,d in walls)
    fp=''.join(f'M{i} {j}h1v1h-1z' for (i,j) in sorted(fl))
    grid=[]
    for (i,j) in sorted(fl):
        if (i+1,j) in fl: grid.append(f'M{i+1} {j}v1')
        if (i,j+1) in fl: grid.append(f'M{i} {j+1}h1')
    dr=[]
    for (o,i,j) in doors:
        i-=i0; j-=j0
        if o=='h': dr.append(f'<rect x="{f(i+0.5-0.36)}" y="{f(j-0.17)}" width="0.72" height="0.34" rx="0.08"/>')
        else: dr.append(f'<rect x="{f(i-0.17)}" y="{f(j+0.5-0.36)}" width="0.34" height="0.72" rx="0.08"/>')
    seed=int(num) if str(num).isdigit() else 7
    s=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{f(W*K)}" height="{f(H*K)}" viewBox="{f(-PAD)} {f(-PAD)} {f(W)} {f(H)}">
<defs><filter id="m" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="{seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.07"/></filter></defs>
<path d="{wp}" fill="none" stroke="#8d8a84" stroke-opacity=".5" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="{fp}" fill="#fbf8ee"/>
<path d="{' '.join(grid)}" fill="none" stroke="#6f8fb5" stroke-opacity=".45" stroke-width=".03"/>
<g filter="url(#m)"><path d="{wp}" fill="none" stroke="#25252d" stroke-width=".2" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="#fbf8ee" stroke="#25252d" stroke-width=".07">{''.join(dr)}</g></g>
</svg>
'''
    meta=dict(w=round(W*K),h=round(H*K),cx=K,cy=K,ox=round(PAD*K),oy=round(PAD*K),svg=True,celle=sorted(fl),porte=[[o,i-i0,j-j0] for (o,i,j) in doors]+[list(e) for e in tips])
    return s,meta

if __name__=='__main__':
    import glob
    res={'tiles':{},'ingressi':{}}
    tmap={}
    for pg,lab in ((41,['11','12','13','14','15','16','21','22','23','24','25','26']),(42,['31','32','33','34','35','36','41','42','43','44','45','46']),(43,['51','52','53','54','55','56','61','62','63','64','65','66'])):
        for k,l in enumerate(lab): tmap[f't_{pg}_{k:02d}']=('tiles',l)
    for k in range(1,7): tmap[f'i_{k}']=('ingressi',str(k))
    for name,(kind,num) in tmap.items():
        cells,doors=estrai(name,OVR.get(kind[0]+num))
        r=svg(num,cells,doors,OVR.get(kind[0]+num,{}))
        if not r: print('VUOTO',name); continue
        s,meta=r
        open(OUT+f'{kind}_{num}.svg','w').write(s); res[kind][num]=meta
        print(kind,num,len(meta['celle']),'celle',len(meta['porte']),'porte')
    json.dump(res,open(S+'vt_meta.json','w'))
