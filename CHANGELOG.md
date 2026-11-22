# Changelog

## 1.19.1
- **Campagne narrative:** l'elenco delle campagne è paginato (3 per pagina) e ha un campo di ricerca unico: le parole cercano nel nome della campagna o delle sue avventure, un numero («3») o un intervallo («2-4») cerca per livello.

## 1.19.0
- **Campagne narrative:** nuovo pulsante «Campagne narrative…» nel pannello Dungeon. Si sceglie la campagna (con descrizione e livelli coperti), poi l'avventura e infine il gruppo: quello attuale, gli eroi copiati da un'altra partita salvata (di livello adeguato) oppure un gruppo nuovo portato al livello minimo richiesto. Gli ultimi due casi creano una nuova partita salvata.
- Le avventure incluse sono ora descritte da `assets/moduli/campagne.json` (al posto di `elenco.json`); le avventure singole stanno nella campagna «Avventure singole».

## 1.18.1
- **Campagna «Il Cartografo dell'Oblio»:** l'autore delle avventure è ora «Giovanni D'Addabbo per 4AD Solo Companion» e la scheda di presentazione non mostra più la licenza.
- **Correzione:** nelle finestre delle avventure scritte (presentazione, introduzione, Esplora, errori di un file) non compare più la scritta «null».
- **Workflow dei pacchetti:** il passo di caricamento sulla release non risulta più fallito sul Mac.

## 1.18.0
- **Campagna «Il Cartografo dell'Oblio»:** cinque avventure collegate da una trama (livelli 1-2, 2-3, 3-4, 4-5, 5-6; 18-20 stanze ciascuna) con tabelle diverse per ogni capitolo: base, Acque Oscure, Nemici diabolici, Contro il Caos, Contro l'Abisso. Nell'elenco «Avventure incluse».
- **Nebbia di guerra a raggio di luce:** la mappa è scura tranne attorno ai personaggi; chi porta la lanterna illumina di più. Si può spegnere dalle Impostazioni (Mappa).
- **Introduzione e obiettivo:** all'inizio di un'avventura scritta si apre una finestra con l'introduzione e l'obiettivo (rileggibili dal pannello Dungeon).
- **Finali a scelta:** alla conclusione l'avventura propone più finali; la scelta si ricorda nella campagna e cambia l'introduzione dei capitoli successivi (campi `finali`, `serie`, `introduzioneSe`, `obiettivo` in `docs/MODULI.md`).

## 1.17.0
- **Avventure scritte (moduli):** un file `.json` descrive un dungeon già pronto (mappa a stanze con porte, anche segrete, mostri, tesori, trappole, eventi, descrizioni da leggere) per qualunque livello dei personaggi da 1 a 30, con le tabelle del set scelto dall'autore (manuale base, Nemici diabolici, Contro il Caos, Contro l'Abisso, Orrori dall'Aldilà, Contro le Profondità Dimenticate, Acque Oscure, Coboldi). Nel pannello Dungeon, riquadro «Avventura scritta»: **avventure incluse** oppure **Carica da file…**; funziona nel sito per telefono, nell'app per Mac e Windows e con il server. Le stanze sono disegnate sul foglio nello stile vettoriale del gioco; combattimenti, tesori, trappole, erranti, perquisizione, riposo e salvataggio seguono le regole di sempre, e l'avventura è salvata nella campagna insieme al modulo.
- Mostri presi dalle tabelle (`tabella` + `id`) oppure scritti da zero con livello, attacchi, PV, morale, tesoro, reazioni e alcuni poteri automatici; boss finale; tesori fissi (oro, gemme, oggetti magici) o a tiro.
- **Documentazione per gli autori:** `docs/MODULI.md`, elenco dei mostri richiamabili (`docs/MOSTRI-MODULI.md`, generato da `tools/elenco-mostri.js`), schema JSON per l'editor e controllo da riga di comando `node tools/valida-modulo.js file.json`. Due avventure d'esempio in `assets/moduli/`: «La cripta dei sussurri» (livelli 3-5) e «La fortezza di cenere» (livelli 6-8, Contro l'Abisso).
- Non supportati nei moduli: Labirinti Silvani, missioni di Contro il Caos, mappa a esagoni dell'Aldilà. Provato nel browser (server e modalità locale) sulle due avventure d'esempio; non provato su un telefono vero né nell'app Electron.

## 1.16.3
- **Scambia oggetti:** nella scheda di ogni eroe, il pulsante «Scambia» passa un oggetto dello zaino a un altro eroe (con la quantità), rispettando le restrizioni di classe; i bonus magici seguono l'oggetto.
- **Sfida magica** (manuale base): ora un mago può sfidare il mostro con 1d6 + livello; se vince il mostro conta come sconfitto, se perde il mago scende di un livello e il mostro attacca.
- **Missioni dei mostri** (manuale base): scheda negli Strumenti con «Compiuta» (ricompensa epica, 1 tiro ES, mostro sconfitto) e «Abbandona».
- **Tiri ES:** lo stesso eroe non sale due volte di fila nemmeno se è l'unico rimasto vivo.
- **Correzione:** la finestra «Bottino da assegnare» non scrive più «null» quando nessun eroe è Avido.

## 1.16.2
- **Finestra «Bottino da assegnare»:** ogni volta che qualcosa entra nel bottino (tesoro, trappola, tesoro nascosto, saccheggio, eventi, oggetti e pergamene) si apre da sola una finestra per dare oro, gemme e oggetti agli eroi o dividere l'oro. «Più tardi» lascia tutto nel bottino. Non compare durante uno scontro o per l'ospite della cooperativa.

## 1.16.1
- **Tesoro a fine scontro:** quando uno scontro finisce e c'è un tesoro da prendere compare una finestra con «Saccheggia (tira il tesoro)» e «Più tardi», senza dover cercare il pulsante nelle schede. Non compare per mostri erranti o senza tesoro.

## 1.16.0
- **Versione per telefono:** sotto gli 860 px di larghezza compare una barra in basso (Gruppo, Mappa, Dungeon, Impostazioni), con una sola area visibile alla volta; schede degli eroi e pannelli a tutta larghezza, finestre che salgono dal basso, intestazione ridotta a un menu «⋯», mappa a tutto schermo con pizzico per lo zoom e doppio tocco per «adatta», dadi 3D spenti di partenza sul telefono. Sul desktop non cambia nulla.
- **App installabile (PWA) e salvataggio nel browser:** quando il gioco viene aperto senza il server di gioco, le campagne si salvano sul dispositivo (con Esporta e Importa nelle impostazioni) e l'app si installa dalla schermata Home e funziona offline. `tools/prepara-statico.js` prepara la cartella da pubblicare su un host statico. Con il server (PC, app desktop) tutto resta come prima.
- I percorsi interni delle tessere sono ora relativi; i vecchi salvataggi vengono convertiti da soli.
- Non provato su un telefono vero: tocco a due dita, iPhone, installazione.

## 1.15.0
- **«Acque Oscure» (lvl 1-4) e «Schiavisti Coboldi» (lvl 1-2):** due nuovi set di tabelle, classe Spadaccino, oggetti acquatici, acqua santa, flagello, patto demoniaco.
- **«Labirinti Silvani» (lvl 4+):** set della selva con mappa in stile «Foresta», sei nuove classi (druido, elfo silvano, signore delle bestie, guida delle terre selvagge, due chierici), incantesimi del druido, compagni animali e cavalcature, strumenti per nuotare, abbattere alberi, incendi, ponti, pozzi e cattura.
- **«Orrori dall'Aldilà» (lvl 6-9):** set di tabelle, cinque nuove classi (paladino, demonologo, cambione, chierico di Zur, chierico di Foryos), carta «Aldilà» negli Strumenti per l'esplorazione (terreni, incontri, fortezze, Guf, luoghi unici, Scoperte, blasfemi persistenti, contatori di necro, razioni e cubi anima).
- **Menu «Tabelle del dungeon»** ordinato per livello, con le nuove voci.
- **Regole base chiarite** (FAQ di «Acque Oscure»), valide ovunque: attacco furioso con dadi esplosivi separati, boss finale senza morale, +1 del boss finale per ogni maggiore incontrato, maggiore corrotto senza tiro ES, conteggio dei seguaci non azzerato tra avventure, troll rigenerati prima delle difese, +20% su gemme e gioielli venduti da un nano, pagamento con gemme senza resto.
- **Correzione:** a ogni nuova avventura si azzerano anche il nome precedente, la fine e il boss finale ucciso.
- Non ancora presenti: le avventure scritte, la mappa a esagoni dell'Aldilà e il disegno di ponti e pozzi della selva.

## 1.14.0
- **Supplemento «Contro le Profondità Dimenticate (lvl 10-19)»:** nuovo set di tabelle del dungeon (stanze, trappole, allucinazioni, eventi, tesori, mostri e orde, idoli, missioni, boss finale), gradi eroico e leggendario con il pulsante «Passa di grado», dadi d10 e d12 esplosivi (virtuali, non 3D), 66 abilità eroiche e leggendarie, 12 incantesimi, armi e armature perfette, oggetti leggendari.
- **Fiumi, rovine, tumuli e Cittadelle** come strumenti guidati nel pannello Strumenti: tirano le tabelle e creano gli incontri; le mappe restano da disegnare a mano.
- I supplementi «Contro il Caos», «Contro l'Abisso» e «Contro le Profondità Dimenticate» possono essere attivi insieme.

## 1.13.0
- **Supplemento «Contro l'Abisso (lvl 5-9)»:** nuovo set di tabelle del dungeon (stanze, trappole, eventi, tesori, mostri, draghi, boss finale), livelli dal 6° al 9°, d8 esplosivo (dado virtuale, non 3D), 41 abilità avanzate da imparare con i tiri esperienza, 6 incantesimi avanzati, stati persistenti (follia, licantropia, peste oscura, vampirismo), mercenari, artigiani, segreti e oggetti. Si attiva dal menu «Tabelle del dungeon» o con la casella del supplemento.
- **Menu «Tabelle del dungeon» e «Stile della mappa»:** l'etichetta sta sopra e il menu occupa tutta la larghezza, così i nomi lunghi non vengono tagliati.
- **Tiri esperienza:** un incontro già concluso non può più generare un secondo tiro per lo stesso mostro; quando un mostro dà davvero più tiri (per esempio il drago come boss finale) i pulsanti sono numerati («1 di 2»).
- Senza il supplemento «Contro l'Abisso» il livello massimo è il 5°, come nel manuale base.
- Non ancora presenti di «Contro l'Abisso»: trame di campagna, partenza diretta al 5° livello, resurrezione a 1000 p.o.

## 1.12.0
- **Tabelle del dungeon con nome del manuale e livello:** «Four Against Darkness (lvl 1-2)», «Four Against Darkness – Nemici diabolici (lvl 3-5)», «Contro il Caos (lvl 3-6)».
- **«Contro il Caos» completato:**
  - traguardi con bonus permanenti applicati al completamento e contatori automatici dove possibile;
  - circa 35 tratti con effetto automatico;
  - sezione «Abilità avanzate» nella scheda (7 nuove abilità funzionanti, attacco specializzato);
  - bolas, boomerang, ricarica della balestra, restrizioni delle armi da fuoco, stella da lancio doppia;
  - veterano (assistenza, protezione, fuga, limite di oro);
  - missioni delle Caverne (cuoco compagno, prigionieri, arazzo, soglie di indizi, ascia di Nydann);
  - oggetti del caos e incantesimi Muro di Ghiaccio, Ondata di Forza, Comunicazione a Distanza, Ponte Illusorio con effetto meccanico.
- Restano manuali: veleno preparato, munizioni, tiro per imparare le abilità avanzate (arriverà con «Contro l'Abisso»).

## 1.11.3
- **Set «Dungeon classico» e «Foresta»:** rigenerati, ora ogni tessera con uscite ha almeno una porta disegnata (le tessere 42, 45, 54 e gli ingressi 3 e 5 avevano solo estremità aperte di corridoio). Le posizioni delle uscite non cambiano; le tessere 35 e 62 restano senza uscite, come nel manuale.

## 1.11.2
- **App desktop:** correttore ortografico disattivato e cache del codice JavaScript attiva fin dal primo avvio (piccola ottimizzazione dell'avvio; nessun cambiamento alle regole o alla grafica).

## 1.11.1
- **Mac con chip Apple (M1, M2, M3…):** il pacchetto `arm64` non si apriva («l'app è danneggiata») perché la firma originale di Electron non era più valida. Ora l'app è firmata in locale (ad-hoc) e la firma viene verificata. Al primo avvio: tasto destro → Apri (istruzioni nel README).
- **Documentazione:** istruzioni per scegliere il pacchetto Intel o Apple Silicon e per il primo avvio.

## 1.11.0
- **Equipaggiamento del bottino:** armi, armature e scudi trovati si possono equipaggiare subito alla consegna o dalla scheda (pulsante «Equipaggia»), nel rispetto delle classi; le armi d'argento valgono contro gli spettri.
- **Stili della mappa:** i set «Dungeon classico» e «Foresta» hanno ora forme di stanza originali (porte nelle stesse posizioni delle tessere del manuale), più varietà di dettagli.
- **Fondale** della mappa uguale (carta chiara) per tutti gli stili, anche nell'esportazione. I dungeon avviati con i set della 1.10.0 possono avere le stanze disallineate.

## 1.10.0
- **Stili della mappa:** nuovi set di tessere «Dungeon classico» (pietra, torce, botti, ossa) e «Foresta» (prato, siepi, alberi, cancelli), con bordino a mano e dettagli; si scelgono prima di iniziare un dungeon (menu «Stile della mappa»; l'originale è «4 Against Darkness»). Lo sfondo del foglio, la griglia e l'esportazione PNG/PDF si adattano allo stile scelto.
- **Esporta mappa:** i segnalini dei personaggi non vengono più disegnati.
- **Versione del programma** visibile in alto a sinistra, sotto il titolo.

## 1.9.0
- **Esporta schede:** nuovo pulsante accanto a «Esporta mappa». Le schede dei personaggi escono in PDF (una pagina A4 per eroe) o PNG, in stile fantasy a tratto di matita, pronte da stampare per giocare senza computer. Il ritratto non viene esportato: resta una cornice vuota. **Stampa eco:** solo bianco e nero, senza sfondo, per risparmiare inchiostro.
- **Esporta mappa:** i segnalini dei personaggi non mostrano più il ritratto, solo la lettera della classe.
- **Dadi 3D:** «Distingui i dadi secondari» è attivo di default (per chi non ha già salvato le impostazioni).

## 1.8.0
- **Arlecchino:** fino a 3 attacchi in mischia per turno con 2-3 armi leggere o a una mano (prima il turno finiva dopo il primo); mezzo livello solo con una sola arma.
- **Trappole e fantasmi:** finestra di scelta (disarmare, far scattare, risolvere a mano; il chierico scaccia il fantasma) per trappole, evento Fantasma e complicazioni del tesoro nascosto.
- **Negozio:** si può pagare con l'oro del gruppo (poi le gemme); gli elfi del fuoco non condividono l'oro.
- **Riposo:** stanze vuote o ripulite evidenziate in verde sulla mappa e nell'elenco; conferma se si riposa altrove.
- **Spostamenti:** muovendo gruppo o eroi fra stanze visitate si tira 1d6 per stanza (1 = mostri erranti) e si riprendono gli scontri sospesi.
- **Esporta mappa** in PNG o PDF; **nomi evocativi** per i dungeon; il pulsante «Boss ucciso e uscita dal dungeon» si attiva solo dopo aver sconfitto il boss finale.
- **Azioni di classe** negli Strumenti (disattiva trappola, scassina, travestimento, fiuta il tesoro), spente se manca la classe adatta.
- **Numero della stanza** sempre al centro della stanza (l'ingresso nel primo quadretto bianco).

## 1.7.3
- **Banner fisso in basso** che invita ad acquistare i manuali di Four Against Darkness (link Amazon dell'autore).

## 1.7.2
- **Prestazioni:** ridisegno a parti (gruppo, pannello, segnalini solo se il loro stato è cambiato); server con cache in memoria, ETag/304,
  compressione brotli/gzip e cache lunga per immagini e librerie; three.js e cannon-es caricati in differita; cooperativa a differenze
  (solo i pezzi di stato cambiati) e correzione degli ascoltatori doppi.
- **Mappa:** foglio quadrettato disegnato con pochi comandi (≈10 volte più veloce), segnalini prerenderizzati, livelli di risoluzione per le tessere.
- **Tiri veloci** (Impostazioni, attivi di default): i dadi 3D rotolano solo per attacchi, difese, salvezze, incantesimi, nuove stanze e tiri liberi.
- **Cooperativa:** la porta di rete la sceglie l'utente (errore chiaro se è occupata).
- **Ritratti degli eroi:** ritratto predefinito per classe (SVG) o immagine caricata dall'utente (ritagliata e ridotta nel browser, salvata in `ritratti.json`); compare su schede, righe di combattimento, segnalini della mappa e in cooperativa.
- **Impostazioni:** ombra dei dadi spenta di default, bordi smussati di default, nuova opzione «effetto scrittura a matita» (attiva di default).

## 1.7.1
- **Cooperativa:** la scheda mostra l'IP pubblico della macchina che ospita, con il link da condividere (serve l'inoltro della porta sul router o un tunnel).

## 1.7.0
- **Poteri dei mostri avanzati automatici:** nani posseduti (si rialzano), doppelganger (smarrimento e imitazione), manto predatore (caduta, avvolti),
  spettro (lanterne, risucchio, solo armi magiche), grosso troll e troll (rigenerazione, fuoco, a pezzi), demone scheletrico (scheletri dal sangue),
  gremlin del caos (sfortuna), manticora (artigli/morso/pungiglione e coda), mutante tentacolato (oggetti afferrati), leader dei seguaci del caos.
- **Posizionamento assistito:** le tessere conoscono le loro uscite (porte e bracci aperti); la nuova stanza si appoggia a una porta libera,
  porta contro porta, con frecce per scegliere l'uscita e pulsanti per le posizioni alternative (opzione in Impostazioni).
- **Modalità cooperativa online** (vedi `docs/COOPERATIVA.md`): un giocatore ospita, gli altri guidano i propri eroi dal browser; chat inclusa.
- **Gruppo casuale:** classi estratte a caso e nomi sempre diversi nel gruppo (anche creando o rinominando gli eroi).

## 1.6.0
- **Tessere vettoriali** ricavate dal manuale: le 36 stanze e i 6 ingressi sono SVG, si adattano alla dimensione e alla griglia del foglio.
- **Snap to grid** opzionale (Impostazioni); Alt mentre trascini per spostare liberamente. Le stanze si affiancano a pavimento contro pavimento.
- **Traguardi** con conteggio automatico (uccisioni, salvezze, bottino, missioni, avventure).

## 1.5.1
- **Combattimento:** i tasti non vengono più attenuati per errore; chi ha già agito nel turno ha i tasti spenti e, se li preme, riceve l'avviso che ha terminato gli attacchi.
- **Oggetti con cariche:** bacchette, bastoni e pergamene trovati nel dungeon si equipaggiano con le loro cariche e si lanciano dal combattimento.
- **Negozio:** vendita di gemme, armi e oggetti; le gemme valgono come moneta negli acquisti.
- **Dadi:** spigoli smussati; nuova schermata **Impostazioni** (colore dei dadi, smussatura, ombre).

## 1.5.0
- **Tabelle avanzate «Nemici diabolici»** e **«Caverne del Caos»** del supplemento «Contro il Caos»; al 3° livello di tutto il
  gruppo l'app chiede quali tabelle usare (selettore nel pannello *Dungeon*).
- **Caverne del Caos:** 6 missioni, contenuti, trappole, eventi unici, tesori, mostri, «Toccato dal caos», follia, incantesimi del caos.
- **Supplemento (opzionale):** 6 nuovi incantesimi (d12), 5 nuove classi, 6 nuove armi, tratti e traguardi.

## 1.4.1
- **Barbaro:** la spunta «Furioso» si azzera dopo ogni attacco e non resta attiva a usi esauriti.

## 1.4.0
- **Prestazioni:** i dadi 3D si disegnano solo mentre rotolano (a riposo 0 fotogrammi); ombre più leggere; la mappa non
  disegna le tessere fuori schermo e non usa più ombre sfocate per il foglio.
- **Qualità «Leggera»:** interruttore in alto (attivo da solo su computer con 2 core o 2 GB di RAM): niente dadi 3D, ombre
  né animazione a matita.
- **Peso:** tessere in WebP (da 9,1 a 1,2 MB), three.js minificata; pacchetti più piccoli di circa 7 MB.
- I salvataggi vecchi continuano a funzionare.

## 1.3.0
- **Nuove tessere:** al posto di quelle del manuale ora si usano le tessere a colori in pietra di `tiles-base.pdf`, abbinate
  alle 36 del d66 e ai 6 ingressi (vedi `docs/ASSET.md` e `docs/confronto-tessere.png`).

## 1.2.0
- **Foglio quadrettato espandibile:** parte da 20×28 quadretti e cresce in tutte le direzioni insieme al dungeon;
  il posizionamento automatico delle stanze non è più limitato al foglio e «Adatta» inquadra tutto.
- **Pannello Incontro:** chi agisce per primo (gruppo o mostri) sta in cima al quadrante di destra.

## 1.1.0
- **Perquisire una stanza vuota** ora segue davvero la tabella: si tira il d6 (−1 nei corridoi), si mostra l'esito
  in una finestra e se ne applicano gli effetti: 1 = arrivano i mostri erranti, 2-4 = stanza vuota,
  5-6 = scegli porta segreta, tesoro nascosto o indizio.
- Il mezzuomo può ritirare la perquisizione spendendo un punto fortuna.
- Pulsante «Perquisisci la stanza attuale» ben visibile nella scheda Dungeon.
- Mappa: tolto l'aggancio alla griglia; le stanze si posizionano liberamente.

## 1.0.0
- Primo rilascio: gruppo, mappa 2D con effetto matita, segnalini, dadi 3D, tabelle e combattimento, app Electron.
