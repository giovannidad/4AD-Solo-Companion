# Asset

## Tessere vettoriali (dal manuale)

- `assets/tiles/NN.svg` e `assets/ingressi/N.svg`: le 36 tessere del d66 e i 6 ingressi **ricostruiti in vettoriale** dalle pagine 40–43 del manuale
  (ITA). Sono SVG con unità in quadretti (`viewBox` = quadretti + 0,3 di margine), quindi si ridimensionano senza perdere qualità e le loro linee
  coincidono con quelle del foglio quadrettato.
- Procedura (script in `tools/tessere-vettoriali/`, richiede PyMuPDF, Pillow, NumPy e SciPy): ogni figura viene estratta a 300 dpi, si rileva il
  reticolo della griglia disegnata, si classificano i quadretti (pavimento / muro / esterno), si individuano le porte e si genera lo SVG
  (pavimento, muri a tratto, alone, porte). Il risultato (quadretti `celle` e `porte` di ogni stanza) è anche in `data/rules/tiles.json`.
- Le stanze curve sono approssimate a quadretti. Gli ingressi 3, 4 e 5 sono stati definiti a mano (`sovrascritture.json`) perché la figura del manuale
  contiene grandi masse nere. I confronti manuale / vettoriale sono in `docs/confronto-vettoriali-*.png`: controlla soprattutto 13, 25, 34–36, 42, 53,
  62 e gli ingressi 2–6.
- **Snap to grid**: opzione in *Impostazioni*; la stanza si aggancia in modo che la sua griglia cada sui quadretti (Alt mentre trascini = movimento libero).
  Le stanze si affiancano per il solo pavimento, così i muri combaciano.
- Le vecchie tessere `*.webp` (colorate in pietra, da `tiles-base.pdf`) restano per le campagne già salvate.

## Tessere delle stanze (raster, versioni precedenti)

- `assets/tiles/NN.webp` – le 36 tessere del d66 (11…66); `assets/ingressi/1-6.webp` – le 6 stanze d'ingresso.
- Sono le tessere **a colori in pietra** del PDF `manuali/tiles-base.pdf` (42 pagine, una immagine per pagina, JPEG2000 con
  trasparenza). Sono state estratte con `pypdf`, lo sfondo nero esterno è stato reso trasparente, sono state ritagliate e
  dimezzate di risoluzione.
- Le pagine 3–8 del PDF sono gli ingressi 1–6 (stesso ordine del manuale); le altre 36 pagine sono state **abbinate a mano**
  alle tessere del manuale confrontando forma, numero e posizione delle porte (le immagini possono essere ruotate o specchiate,
  il che non conta ai fini del gioco). L'abbinamento è in `docs/abbinamento-tessere.json`.
- `docs/confronto-tessere.png` mostra, per ogni numero del d66, la tessera del manuale (a sinistra) e quella usata (a destra).
  Gli abbinamenti **meno sicuri** sono scritti in rosso (e nel campo `incerte` del JSON): 11, 12, 13, 14, 16, 26, 41, 43, 46, 64.
  Per correggerli basta scambiare i file `assets/tiles/NN.webp` corrispondenti.

## Misure (`data/rules/tiles.json`)

Per ogni immagine: `w, h` (pixel), `cx, cy` (pixel per quadretto), `ox, oy` (scostamento della griglia, 0 per le tessere a colori).
Le tessere a colori non hanno griglia disegnata: i corridoi sono larghi 1 quadretto e si è assunto 175 px per quadretto
sull'originale (87,5 px dopo il dimezzamento). Se una stanza risulta troppo grande o piccola, ritocca `cx`/`cy` oppure usa −/+ nel gioco.

Le vecchie tessere disegnate a mano (dal manuale) usavano invece una griglia misurata con le linee nere continue;
quel metodo è rimasto nella storia git.

## Icona

`build/icon.png` (1024×1024, generata con Pillow): spade incrociate su cerchio runico, scritta "4AD".
Per cambiarla sostituisci il file e ricostruisci i pacchetti.

## Diritti

Il manuale, le sue illustrazioni, i testi delle tabelle e le tessere appartengono ai rispettivi titolari (autore ed editore).
Vedi `LICENSE` (GPL-3.0, solo codice) e `NOTICE` (contenuti di gioco esclusi dalla licenza).
