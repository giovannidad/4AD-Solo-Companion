# Regole implementate

L'app segue il regolamento italiano di *Four Against Darkness*. È un **assistente**: tira i dadi, applica i
modificatori e tiene i conti, ma le decisioni (chi attacca, quando ritirarsi, dove mettere la stanza) restano al giocatore.
Tutto può essere corretto a mano (PV, mostri rimasti, oggetti, posizione dei segnalini).

## Automatico

- Tiri con **6 esplosivo** e **1 = fallimento automatico** (attacco, difesa, salvezza, ES).
- **Creazione eroi** con ricchezza iniziale tirata, vita `base + livello`, equipaggiamento di partenza.
- **Stanza d'ingresso (d6)**, **nuova stanza (d66)**, **contenuto (2d6)**, caratteristiche, eventi, trappole.
- **Tesori** (con modificatore del mostro, moltiplicatori, tesoro doppio nelle stanze segrete, boss finale ×3 / 2 oggetti magici),
  pergamene, oggetti magici, armi magiche.
- **Perquisire** (d6, −1 nei corridoi; il mezzuomo può ritirare con un punto fortuna), porta segreta (scorciatoia con 6), tesoro nascosto con complicazioni, indizi (3 = segreto + tiro ES).
- **Mostri**: tabelle infestanti, seguaci, aberranti, boss; boss finale (`1d6 + maggiori sconfitti ≥ 6`).
- **Reazioni dei mostri**, corruzione (oro, oro degli stolti; non con 2+ nani), missioni.
- **Attacco**: modificatori per classe, livello, arma (leggera −1, due mani +1, fionda −1), contundente vs scheletri,
  nano vs goblin, elfo vs orchi, chierico vs non-morti, furfante in superiorità, lanterna assente (−2), zoppia, bonus del gruppo.
  Mostri minori: `floor(totale / LIV)` uccisi; maggiori: ferite, livello −1 sotto la metà dei PV.
- **Incantesimi**: Fulmine Magico, Palla di Fuoco, Sonno, Protezione, Benedizione, Fuga; Guarigione del chierico; attacco furioso del barbaro.
- **Difesa**: armatura, scudo, furfante, nano/mezzuomo contro giganti e troll, ritirata (+1), fuga, sorpresa, maledizione, lanterna;
  6 naturale = successo, 1 naturale = fallimento.
- **Morale** (minori sotto la metà, maggiori sotto la metà dei PV), ritirata/fuga con rientro nella stanza.
- **Abilità speciali**: infezione dei ratti, veleni (millepiedi, fungoidi, ragno), soffio di chimera e drago, sguardi di catoblepa e medusa,
  poteri del signore del caos, ferrofago, minotauro.
- **Esperienza**: tiri ES per maggiori sconfitti, 10 incontri con seguaci (−1), indizi; limiti di livello 5.

## Tabelle avanzate e supplemento «Contro il Caos»

Prima di ogni avventura (pannello *Dungeon*) scegli il **set di tabelle**; quando **tutti** i personaggi vivi hanno raggiunto il
3° livello l'app te lo chiede una volta (potrai cambiare scelta in seguito):

- **Tabelle base**: quelle del manuale.
- **Nemici diabolici** (manuale base, p. 89-95): sostituiscono Tesori, Tesori magici e le quattro tabelle di mostri
  (`data/rules/avanzate.json`). Gli infestanti contano come seguaci per l'esperienza.
- **Caverne del Caos** (supplemento «Contro il Caos», p. 47-72, `data/rules/caos.json`): contenuti delle stanze, trappole,
  caratteristiche, eventi unici (una volta per avventura), tesori, oggetti magici e utili, complicazioni dei tesori nascosti,
  mostri del caos, «Toccato dal caos» con punti follia, incantesimi del caos, i 4 segreti e le **6 missioni**
  (livello consigliato: mostri e PV in più se il gruppo è più forte; tiri ES a +1).

La casella **«Usa il supplemento Contro il Caos»** abilita inoltre: tabella degli incantesimi a caso d12 con i 6 nuovi
incantesimi, le 5 classi (arlecchino, assassino, elfo del fuoco, tiratore scelto, veterano), le 6 nuove armi (archibugio e pistola
esplodono con un 1), i **tratti** (d66 e tratti rari d8) e i **traguardi** (d66 con contatore) nella scheda dell'eroe.

Sono automatici: i modificatori delle nuove classi, il «Marchia» dell'assassino (danni tripli), la vista di fuoco, gli
incantesimi nuovi e del caos, i poteri dei mostri più comuni (livello al primo turno, immunità, veleni, pietrificazione,
inghiottimento del cubo, malattia della melma verde, tagliola degli schiavisti, sciame di vespe, ecc.).

### Automazioni del supplemento (tratti, traguardi, abilità, armi, oggetti)

- **Traguardi**: completandoli si applicano i benefici permanenti (flagelli, colpo di grazia, dragonidi, infestanti, tolleranze, padronanze, santuari,
  Generoso, Tomo, grimorio di pergamene, gioiello delle gemme, ecc., elencati in «Benefici permanenti» della scheda). Si contano da soli uccisioni
  per tipo di mostro, salvezze, dungeon, riposi (Cuoco), tesori al minimo (Cercatore), incontri (Abitanti), oggetti magici (Panoplia), oro (Risparmiatore);
  per santuari, Ritratto e Generoso c'è il pulsante «Paga p.o.»; gli altri hanno i pulsanti −/+.
- **Tratti** con meccanica: alcolizzato, allergie, braccati (imboscata a fine avventura, da soli), changeling, cimelio, diario, intuizione, fortuna,
  maestri di bastoni/lame, miope, molti nemici, nobile, piaga, presenza, protetto dagli dèi, sangue orchesco, prima linea/retroguardia, sovrappeso,
  talento, ben piazzato, distruttore, guaritore, mente geniale, esca per draghi, abilità meccanica (la scheda li segna «effetto automatico»).
- **Abilità avanzate** (sezione della scheda): le 7 nuove (Assistenza, Attacco specializzato, Concentrazione mentale, Preparare veleno, Recuperare munizioni,
  Sputafuoco, Usare bombe) più Doppio attacco, Leader carismatico e Lanciatore di coltelli (stella); le altre sono solo elencate («Contro l'Abisso»).
- **Armi**: bolas (cattura e «Lega il bersaglio»), boomerang, balestra (ricarica), archibugio e pistola (classi ammesse, riparazione e vendita nel negozio),
  stella da lancio doppia.
- **Missioni**: mezzuomo cuoco (Negoziatore), prigionieri con scorta, elfo e pergamena dell'arazzo, soglia degli indizi, pergamene e amuleto del signore del caos,
  ascia di Nydann.
- **Oggetti**: bomba, triboli, polvere melmicida, segno di Xichtul, invocazione dell'ordine, cappuccio, filtro, amuleto, mazza e arma dorata.

## Supplemento «Contro l'Abisso» (livelli 5-9)

- **Set di tabelle** «Contro l'Abisso (lvl 5-9)»: contenuti delle stanze, trappole, caratteristiche speciali, eventi unici, tesori (d8), tesori magici,
  banchetto incantato, complicazioni dei tesori nascosti, mostri (infestanti, seguaci, aberranti, boss, draghi), erranti, boss finale e tana del drago.
  Sotto il 5° livello compare un avviso con conferma.
- **Livelli 6-9** con la casella «Usa il supplemento Contro l'Abisso» o in un dungeon dell'Abisso: tiro ES 1d8+2 (7-8 naturale sempre un successo),
  da spendere per salire di livello o imparare un'abilità o un incantesimo avanzato. Senza il supplemento il tetto resta il 5° livello.
- **d8 esplosivo** per gli eroi dal 5° livello: è un dado virtuale (non 3D), indicato con `[d8]` nel riquadro dei tiri e nel registro.
- **Mostri**: poteri nuovi automatizzati dove hanno un effetto numerico (gli altri nel riquadro «Poteri»), reazioni «amichevole» e «immobile»,
  singolar tenzone, leader e campione.
- **Scheda**: stati persistenti (follia, licantropia, peste oscura, vampirismo, livelli persi) e le 41 abilità avanzate filtrate per classe.
- **Negozio e Strumenti**: 10 mercenari, 11 artigiani (con le pozioni dell'alchimista), segreti e oggetti dell'Abisso.

## Supplemento «Contro le Profondità Dimenticate» (livelli 10-19)

- **Set di tabelle** «Contro le Profondità Dimenticate (lvl 10-19)»: stanze, trappole, allucinazioni, eventi (d10), tesori, tesori magici eroici e leggendari,
  mostri (infestanti, seguaci, orde, aberranti, boss), idoli, missioni, boss finale. Sotto il 10° livello compare un avviso con conferma.
- **Gradi** eroico e leggendario, separati dal livello: pulsante «Passa di grado» tra due avventure (tiri ES e oro), dadi **d10** e **d12** esplosivi
  (virtuali, indicati con `[d10]` e `[d12]`), 1 naturale sempre un fallimento, numero del grado (GR) nelle formule dei mostri.
- **Scheda**: 45 abilità eroiche e 21 leggendarie filtrate per classe e grado, 12 incantesimi (2 o 3 posti di memoria), armi e armature perfette,
  oggetti leggendari, segreti da 5 o 6 indizi.
- **Fiumi, rovine, tumuli, Cittadelle, idoli**: strumenti guidati nel pannello Strumenti che tirano le tabelle e creano gli incontri; le mappe non
  vengono disegnate (nel manuale sono solo immagini) e i tratti si leggono a mano. Portali e passaggi verso l'Aldilà sono solo descritti.
- Dove testo e tabella dei gradi si contraddicono si segue la tabella (il d12 esplode con 9 o più).

## Altri supplementi

- **«Acque Oscure» (lvl 1-4) e «Schiavisti Coboldi» (lvl 1-2)**: due set di tabelle (acquatico e demoniaco), classe **Spadaccino** (doppio attacco, punti maestria),
  oggetti acquatici, acqua santa e flagello, patto demoniaco, perdita di arti, compagno PNG. Casella «Usa Acque Oscure e Schiavisti Coboldi».
  Le avventure scritte non sono implementate.
- **«Labirinti Silvani» (lvl 4+)**: set della selva con stile mappa «Foresta» e ingresso 1d6+60; classi chierico di Elidra, chierico di Korimnos, druido, elfo silvano,
  guida delle terre selvagge, signore delle bestie; 19 incantesimi del druido, compagni animali, cavalcature. Nuotare, abbattere alberi, incendio, ponti, pozzi
  e cattura sono strumenti guidati che tirano e scrivono nel registro; ponti e pozzi scattano dal numero di tessera (non sono disegnati). «L'Unicorno Nero» non è implementato.
- **«Orrori dall'Aldilà» (lvl 6-9)**: set di tabelle, classi paladino, demonologo, cambione, chierico di Zur e chierico di Foryos, 6 incantesimi, oggetti magici.
  L'esplorazione a esagoni è una carta di strumenti (spedizione, terreno, incontri, fortezza, Guf, luoghi I-VII, Scoperte, dicerie, mercanti, blasfemi persistenti,
  contatori di necro, razioni, cubi anima, catturati); la mappa a esagoni non è disegnata. Dungeon annidati e molti poteri dei blasfemi restano a mano.
- **Chiarimenti alle regole base** (dalle FAQ di «Acque Oscure»), validi in tutti i dungeon: attacco furioso con dadi esplosivi separati, boss finale senza morale,
  +1 del boss finale per ogni maggiore incontrato, maggiore corrotto senza tiro ES, conteggio dei seguaci non azzerato tra avventure, troll rigenerati prima delle difese,
  +20% su gemme e gioielli venduti da un nano, pagamento con gemme senza resto.

## Manuale (non automatizzato)

- Missioni di soccorso, rituale di resurrezione, vendita di oggetti (solo promemoria).
- Rigenerazione dei troll, sedare/legare i mostri, trasporto di compagni caduti o pietrificati.
- Più di un tipo di nemico nella stessa stanza (si gestisce un incontro alla volta con la coda).
- Di «Contro l'Abisso»: trame di campagna, partenza diretta al 5° livello, resurrezione a 1000 p.o., più mostri maggiori nella stessa stanza; gli effetti di Guida, Guardia del corpo, Accolito e Portatore sono solo descritti.
- Alcuni poteri dei mostri avanzati sono solo descritti nella nota del mostro: rospi giganti, nani posseduti, doppelganger, manto predatore, golem (2 PV con un 1), maestri di spada hobgoblin, demone scheletrico, capo hobgoblin, spettro, troll, gremlin del caos (punti sfortuna), leader dei seguaci del caos, manticora e mutante tentacolato.
- Le uscite delle tessere non sono codificate: il giocatore le fa combaciare a mano.

## Fedeltà al manuale

I dati in `data/rules/` riportano le tabelle del manuale: in caso di dubbio **fa fede il libro**.
Segnala le differenze aprendo una issue.


## Poteri dei mostri avanzati (automatizzati)
- **Nani posseduti:** per ogni nano ucciso 1d6, con 3+ attacca ancora al turno dei mostri e poi resta morto.
- **Doppelganger:** imita un eroe a caso; a ogni turno gli altri salvano (L4) o non attaccano; attacca solo l'imitato e, se questi muore, fugge.
- **Manto predatore:** 2 su 1d6 (4 con un furfante) di individuarlo; altrimenti tutti schivano a 3+ (−1 armatura pesante, +1 elfi e furfanti): chi fallisce non attacca e perde 1 PV a ogni difesa.
- **Spettro:** 2 su 1d6 le lanterne si spengono; ogni ferita richiede un salvezza L4 o si perde un livello; ferito solo da armi magiche/d'argento, incantesimi o colpi da 2+ PV.
- **Troll / grosso troll:** rigenerazione (5-6 su 1d6 per ogni troll ucciso; 1 PV a turno il boss), impedita da Palla di Fuoco o dal cadavere fatto a pezzi; −1 ai colpi contundenti sul grosso troll.
- **Demone scheletrico:** ogni PV inflitto genera uno scheletro corazzato (LIV 4), da affrontare dopo il demone (semplificazione dell'arrivo immediato).
- **Gremlin del caos:** a fine turno 1 punto sfortuna a testa: il 6 non esplode e toglie 1 punto; la Benedizione li azzera.
- **Manticora nera:** 2 attacchi sullo stesso bersaglio (artigli 1 PV, morso 2 PV, pungiglione 1 PV + veleno L6 o morte); si può attaccare la coda (LIV 6).
- **Mutante tentacolato:** un 1 naturale in attacco o difesa fa afferrare un oggetto, inutilizzabile fino a fine incontro.
- **Leader dei seguaci del caos:** tirato all'incontro e affrontato come boss dopo il gruppo (semplificazione).
