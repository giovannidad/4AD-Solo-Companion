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

## Manuale (non automatizzato)

- Missioni di soccorso, rituale di resurrezione, vendita di oggetti (solo promemoria).
- Rigenerazione dei troll, sedare/legare i mostri, trasporto di compagni caduti o pietrificati.
- Più di un tipo di nemico nella stessa stanza (si gestisce un incontro alla volta con la coda).
- Modalità cooperativa/competitiva e le abilità avanzate del volume «Contro l'Abisso» (non fornito).
- Alcuni poteri dei mostri avanzati sono solo descritti nella nota del mostro: rospi giganti, nani posseduti, doppelganger, manto predatore, golem (2 PV con un 1), maestri di spada hobgoblin, demone scheletrico, capo hobgoblin, spettro, troll, gremlin del caos (punti sfortuna), leader dei seguaci del caos, manticora e mutante tentacolato.
- Le uscite delle tessere non sono codificate: il giocatore le fa combaciare a mano.

## Fedeltà al manuale

I dati in `data/rules/` riportano le tabelle del manuale: in caso di dubbio **fa fede il libro**.
Segnala le differenze aprendo una issue.
