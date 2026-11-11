import pymupdf, json
S='/private/tmp/claude-501/-Users-Samael-Documents-ClaudeWorkspace-4Ad-solo-mode/87f44118-c416-46c5-975d-8ee60f648043/scratchpad/vt/'
d=pymupdf.open('/Users/Samael/Documents/ClaudeWorkspace/4Ad-solo-mode/manuali/FAD - [ITA] - Four Against Darkness.pdf')
def ordered(p):
    infos=p.get_image_info(xrefs=True)
    infos=[i for i in infos if i['width']<1000 and (i['bbox'][3]-i['bbox'][1])>50]
    for i in infos: i['cy']=(i['bbox'][1]+i['bbox'][3])/2
    infos.sort(key=lambda i:i['cy'])
    rows=[];
    for i in infos:
        if rows and abs(rows[-1][-1]['cy']-i['cy'])<45: rows[-1].append(i)
        else: rows.append([i])
    return [i for r in rows for i in sorted(r,key=lambda i:i['bbox'][0])]
# etichette: numero (cifre impilate) accanto a ogni immagine
for pg,base in ((40,'t'),(41,'t'),(42,'t')):
    p=d[pg]; lst=ordered(p); print('page',pg+1,len(lst))
    words=p.get_text('words')
    for k,i in enumerate(lst):
        r=pymupdf.Rect(i['bbox'])
        pix=p.get_pixmap(dpi=300,clip=r); pix.save(f'{S}t_{pg+1}_{k:02d}.png')
        # etichetta: cifre nella colonna grigia a sinistra della cella
        lab=[w for w in words if abs((w[1]+w[3])/2-i['cy'])<45 and w[0]<(28.3+20 if r.x0<150 else 226.8+20) and w[0]>(20 if r.x0<150 else 218)]
        print(pg+1,k,[round(x) for x in i['bbox']],''.join(w[4] for w in sorted(lab,key=lambda w:w[1])))
# ingressi (pagina 40)
p=d[39]; lst=[i for i in ordered(p) if i['bbox'][1]>250 and not (i['bbox'][0]<20)]
print('ingressi',len(lst))
for k,i in enumerate(lst):
    r=pymupdf.Rect(i['bbox']); p.get_pixmap(dpi=300,clip=r).save(f'{S}i_{k+1}.png'); print(k+1,[round(x) for x in i['bbox']])
