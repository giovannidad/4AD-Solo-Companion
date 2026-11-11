import numpy as np, sys
from PIL import Image
from scipy import ndimage as ndi
S='/private/tmp/claude-501/-Users-Samael-Documents-ClaudeWorkspace-4Ad-solo-mode/87f44118-c416-46c5-975d-8ee60f648043/scratchpad/vt/'
def gray(path): return np.array(Image.open(path).convert('L')).astype(float)
def lines(g, axis):
    dark=(g<110)
    prof=dark.mean(axis=axis)            # axis=0 -> per column
    # linee: picchi stretti; sottrai una media mobile larga per isolare le linee dai muri spessi
    from scipy.ndimage import uniform_filter1d, maximum_filter1d
    base=uniform_filter1d(prof,25)
    sig=prof-base
    pk=[i for i in range(2,len(prof)-2) if sig[i]>0.12 and sig[i]==maximum_filter1d(sig,9)[i]]
    return np.array(pk),prof
if __name__=='__main__':
    for n in sys.argv[1:]:
        g=gray(S+n+'.png'); cx,_=lines(g,0); cy,_=lines(g,1)
        print(n,g.shape,'cols',cx.tolist(),'rows',cy.tolist())
