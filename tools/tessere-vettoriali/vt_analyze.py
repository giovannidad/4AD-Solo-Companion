import numpy as np, json, glob, os, sys
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from vt_grid import lines, gray, S

def fit_lattice(pk, n):
    """Periodo e fase di un reticolo regolare che spiega al meglio i picchi (con n pixel totali)."""
    pk=np.array(pk,float); best=None
    for p in np.arange(52,100,0.5):
        for ph in np.arange(0,p,1.0):
            d=((pk-ph+p/2)%p)-p/2
            sc=np.exp(-(d/5.0)**2).sum()
            if best is None or sc>best[0]: best=(sc,p,ph)
    sc,p,ph=best
    # raffina con minimi quadrati sui picchi vicini
    for _ in range(3):
        k=np.round((pk-ph)/p); d=pk-(ph+k*p); m=np.abs(d)<9
        if m.sum()>=3: A=np.vstack([np.ones(m.sum()),k[m]]).T; ph,p=np.linalg.lstsq(A,pk[m],rcond=None)[0]
    return p,ph

def analizza(name, dbg=True):
    g=gray(S+name+'.png'); H,W=g.shape
    cx,_=lines(g,0); cy,_=lines(g,1)
    px,fx=fit_lattice(cx,W); py,fy=fit_lattice(cy,H)
    # tutti i nodi della griglia che cadono nell'immagine
    xs=[fx+k*px for k in range(-3,40) if -px*0.3<=fx+k*px<=W+px*0.3]
    ys=[fy+k*py for k in range(-3,40) if -py*0.3<=fy+k*py<=H+py*0.3]
    white=g>195
    # --- porte: piccole macchie bianche con bordo nero tutt'intorno (min lato < 0.5 quadretto)
    labw,nw=ndi.label(white); porte=[]
    dark=g<110
    for l,sl in enumerate(ndi.find_objects(labw),1):
        m=labw[sl]==l; a=int(m.sum()); hh,ww=m.shape
        if a<0.05*px*py or a>0.42*px*py: continue
        if min(hh,ww)>0.55*px or max(hh,ww)<0.3*px or max(hh,ww)>1.0*px or min(hh,ww)<0.14*px: continue
        full=np.zeros(white.shape,bool); full[sl][m]=True
        ring=ndi.binary_dilation(full,iterations=7)&~ndi.binary_dilation(full,iterations=2)
        if dark[ring].mean()<0.8: continue
        if a/(hh*ww)<0.72: continue
        if sl[0].start<14 or sl[1].start<14 or sl[0].stop>H-14 or sl[1].stop>W-14: continue
        ys_,xs_=np.nonzero(full); porte.append(dict(cx=float(xs_.mean()),cy=float(ys_.mean()),bw=int(ww),bh=int(hh),a=a,x0=sl[1].start,x1=sl[1].stop,y0=sl[0].start,y1=sl[0].stop))
    ni,nj=len(xs)-1,len(ys)-1
    def cen(i,j): return ((xs[i]+xs[i+1])/2,(ys[j]+ys[j+1])/2)
    def inside(i,j): return 0<=i<ni and 0<=j<nj
    frac={}
    for j in range(nj):
        for i in range(ni):
            x0,x1,y0,y1=xs[i],xs[i+1],ys[j],ys[j+1]; mx,my=(x1-x0)*0.22,(y1-y0)*0.22
            xa,xb,ya,yb=int(max(0,x0+mx)),int(min(W,x1-mx)),int(max(0,y0+my)),int(min(H,y1-my))
            if (xb-xa)<(x1-x0)*0.4 or (yb-ya)<(y1-y0)*0.4 or xb-xa<8 or yb-ya<8: continue
            frac[(i,j)]=white[ya:yb,xa:xb].mean()
    def varco(a,b):
        """True se tra i centri dei due quadretti non c'è un muro (le linee sottili della griglia non contano)."""
        (xa,ya),(xb,yb)=cen(*a),cen(*b)
        mx_,my_=(xa+xb)/2,(ya+yb)/2
        for q in porte:
            if q['x0']-6<=mx_<=q['x1']+6 and q['y0']-6<=my_<=q['y1']+6: return False
        n=int(max(abs(xb-xa),abs(yb-ya)))
        run=0; mx=0
        for t in range(n+1):
            x=int(round(xa+(xb-xa)*t/max(n,1))); y=int(round(ya+(yb-ya)*t/max(n,1)))
            # media su 5 pixel trasversali
            if abs(xb-xa)>abs(yb-ya): w=white[max(0,y-6):y+7,min(W-1,max(0,x))].mean()
            else: w=white[min(H-1,max(0,y)),max(0,x-6):x+7].mean()
            if w<0.55: run+=1; mx=max(mx,run)
            else: run=0
        return mx<0.30*px
    # muri spessi: tolgo le linee sottili (griglia e bordi delle porte) con un'apertura, poi chiudo le crepe
    def disco(r): y,x=np.ogrid[-r:r+1,-r:r+1]; return (x*x+y*y)<=r*r
    wall=ndi.binary_opening(g<95,structure=disco(int(px*0.11)))
    wall=ndi.binary_closing(wall,structure=disco(int(px*0.2)))
    barrier=wall.copy()
    for q in porte: barrier[max(0,q['y0']-3):q['y1']+3,max(0,q['x0']-3):q['x1']+3]=True
    passable=~barrier
    labp,_=ndi.label(passable)
    bord=set(np.unique(np.concatenate([labp[0],labp[-1],labp[:,0],labp[:,-1]])))-{0}
    outside=np.isin(labp,list(bord))
    grigio=(g>115)&(g<=195)
    def muro_lungo(cxp,cyp,dx,dy,maxc=5):
        """C'è un muro spesso (o una porta) entro maxc quadretti nella direzione data?"""
        for t in range(int(px*0.35),int(px*maxc)):
            x=int(cxp+dx*t); y=int(cyp+dy*t)
            if x<0 or y<0 or x>=W or y>=H: return False
            if dx: sl=barrier[max(0,y-int(py*0.12)):y+int(py*0.12)+1,x]
            else: sl=barrier[y,max(0,x-int(px*0.12)):x+int(px*0.12)+1]
            if sl.any(): return True
        return False
    cells={}; floor=np.zeros_like(white)
    for j in range(nj):
        for i in range(ni):
            if (i,j) not in frac: continue
            x0,x1,y0,y1=xs[i],xs[i+1],ys[j],ys[j+1]; mx,my=(x1-x0)*0.22,(y1-y0)*0.22
            xa,xb,ya,yb=int(max(0,x0+mx)),int(min(W,x1-mx)),int(max(0,y0+my)),int(min(H,y1-my))
            ok=frac[(i,j)]>0.5 and grigio[ya:yb,xa:xb].mean()<0.10 and not barrier[ya:yb,xa:xb].mean()>0.3
            if ok:
                c=((x0+x1)/2,(y0+y1)/2)
                u,d_,l_,r_=[muro_lungo(c[0],c[1],dx,dy) for dx,dy in ((0,-1),(0,1),(-1,0),(1,0))]
                ok=(u and d_) or (l_ and r_)
            cells[(i,j)]=1.0 if ok else 0.0
            if ok: floor[int(y0):int(y1),int(x0):int(x1)]=True
    def libero(a,b):
        (xa,ya),(xb,yb)=cen(*a),cen(*b); n=int(max(abs(xb-xa),abs(yb-ya)))
        pts=[(int(round(xa+(xb-xa)*t/n)),int(round(ya+(yb-ya)*t/n))) for t in range(n+1)]
        return np.mean([barrier[min(H-1,y),min(W-1,x)] for x,y in pts])<0.12
    cand={k for k,f in frac.items() if f>0.55 and cells.get(k,0)<0.5}
    for _ in range(4):
        mod=False
        for (i,j) in list(cand):
            x0,x1,y0,y1=xs[i],xs[i+1],ys[j],ys[j+1]; mx,my=(x1-x0)*0.22,(y1-y0)*0.22
            xa,xb,ya,yb=int(max(0,x0+mx)),int(min(W,x1-mx)),int(max(0,y0+my)),int(min(H,y1-my))
            if grigio[ya:yb,xa:xb].mean()>=0.10: continue
            nb=[(i+dx,j+dy) for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if cells.get((i+dx,j+dy),0)>0.5 and libero((i,j),(i+dx,j+dy))]
            if len(nb)>=2:
                cells[(i,j)]=1.0; cand.discard((i,j)); floor[int(y0):int(y1),int(x0):int(x1)]=True; mod=True
        if not mod: break
    doors=porte
    return dict(barrier=barrier,outside=outside,g=g,xs=xs,ys=ys,px=px,py=py,cells=cells,floor=floor,doors=doors)
if __name__=='__main__':
    r=analizza(sys.argv[1]); print(r['px'],r['py'],len(r['xs']),len(r['ys']))
    for j in range(len(r['ys'])-1): print(' '.join('%.2f'%r['cells'].get((i,j),-1) for i in range(len(r['xs'])-1)))
