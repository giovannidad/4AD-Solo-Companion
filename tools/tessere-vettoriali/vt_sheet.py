import pymupdf, glob, os, json
from PIL import Image, ImageDraw
S='/private/tmp/claude-501/-Users-Samael-Documents-ClaudeWorkspace-4Ad-solo-mode/87f44118-c416-46c5-975d-8ee60f648043/scratchpad/'
meta=json.load(open(S+'vt/vt_meta.json'))
items=[]
tm={}
for pg,lab in ((41,['11','12','13','14','15','16','21','22','23','24','25','26']),(42,['31','32','33','34','35','36','41','42','43','44','45','46']),(43,['51','52','53','54','55','56','61','62','63','64','65','66'])):
    for k,l in enumerate(lab): tm[l]=f'vt/t_{pg}_{k:02d}.png'
for l in sorted(tm): items.append((l,tm[l],f'vt/svg/tiles_{l}.svg'))
for k in range(1,7): items.append(('E'+str(k),f'vt/i_{k}.png',f'vt/svg/ingressi_{k}.svg'))
def render(svgp,h):
    d=pymupdf.open(S+svgp); p=d[0]; z=h/p.rect.height
    pix=p.get_pixmap(matrix=pymupdf.Matrix(z,z),alpha=False)
    return Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
CH=190; sheets=[]
for part in range(0,len(items),9):
    sub=items[part:part+9]; sh=Image.new('RGB',(3*2*330,3*CH),'white'); d=ImageDraw.Draw(sh)
    for k,(l,png,sv) in enumerate(sub):
        o=Image.open(S+png).convert('RGB'); o.thumbnail((320,CH-6)); v=render(sv,CH-6); v.thumbnail((320,CH-6))
        x=(k%3)*660; y=(k//3)*CH
        sh.paste(o,(x,y)); sh.paste(v,(x+330,y)); d.text((x+4,y+2),l,fill=(255,0,0))
    sh.save(S+f'vt/cmp_{part//9}.png')
print('ok')
