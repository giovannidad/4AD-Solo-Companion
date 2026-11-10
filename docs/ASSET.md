# Asset

## Tessere delle stanze

- `assets/tiles/NN.png` – le 36 tessere del d66 (11…66); `assets/ingressi/1-6.png` – le 6 stanze d'ingresso.
- Sono state estratte dalle pagine 40–43 del manuale con `pypdf` (immagini incorporate); l'ordine corrisponde alla lettura per righe
  (le immagini di ogni pagina vengono elencate in ordine alfabetico dei nomi dei moduli, `Fm0, Fm1, Fm10, …`).
- Ogni immagine è stata ritagliata ai bordi non bianchi.

## Misure della griglia (`data/rules/tiles.json`)

Per ogni immagine sono memorizzati: `w, h` (pixel), `cx, cy` (pixel per quadretto sui due assi: alcune immagini nel PDF sono state
stirate) e `ox, oy` (posizione della prima linea di griglia, modulo quadretto).

Metodo: si individuano le linee nere continue (colonne/righe con più del 60–90 % di pixel scuri, larghezza ≤ 16 px),
si prende la distanza più frequente fra le linee e la posizione media modulo la distanza. Se un asse ha pochi voti si usa l'altro.
Se una tessera risulta troppo grande o piccola, correggi `cx`/`cy` a mano nel JSON.

## Icona

`build/icon.png` (1024×1024, generata con Pillow): spade incrociate su cerchio runico, scritta "4AD".
Per cambiarla sostituisci il file e ricostruisci i pacchetti.

## Diritti

Il manuale, le sue illustrazioni, i testi delle tabelle e le tessere appartengono ai rispettivi titolari (autore ed editore).
Vedi `LICENSE` (GPL-3.0, solo codice) e `NOTICE` (contenuti di gioco esclusi dalla licenza).
