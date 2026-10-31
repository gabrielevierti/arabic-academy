# Importare un volume PDF

Questi script trasformano un volume di Arabic Academy (PDF generato con WeasyPrint)
nel formato interattivo del sito: lezioni con passaggi, esercizi con soluzioni,
materiali della biblioteca e lessico. Il Volume 6 (C1) è stato importato così.

## Perché non basta estrarre il testo

Nei PDF dei volumi l'arabo non si può copiare direttamente:

- **Noto Naskh Arabic** disegna molte lettere come «corpo senza punti + punti
  separati» (ت = corpo di ب + due punti sopra), e la mappa ToUnicode scritta nel
  PDF riporta per ogni glifo il testo del primo grappolo in cui è comparso. Un
  normale estrattore restituisce quindi lettere sbagliate.
- Il testo è salvato in **ordine visivo**: righe arabe, frasi miste italiano/arabo,
  numeri e parentesi speculari vanno rimessi in ordine logico.

`pdftext.py` riconosce ogni glifo dal suo disegno (confronto con i contorni della
stessa versione del font, 2.021), ricompone lettere, punti, hamza e vocali e
inverte l'algoritmo bidirezionale Unicode riga per riga. `bidicheck.py` verifica il
risultato: riapplica l'algoritmo in avanti e confronta con l'ordine dei glifi
nella pagina.

## Uso

```sh
pip install -r scripts/volume-import/requirements.txt
scripts/volume-import/fetch-fonts.sh          # font di riferimento (OFL) da npm
cd scripts/volume-import
python3 extract_pages.py VOLUME.pdf pages.json   # 1. righe, tabelle, stili
python3 assemble.py pages.json out --level C1 --title "Competenza professionale"
python3 integrate.py out ../..                  # 3. copia in data/ e public/course/
cd ../.. && npm run content:index && npm run content:qa && npm test
```

`assemble.py` usa l'indice (segnalibri) del PDF: ogni voce di primo livello
diventa un materiale della biblioteca; le unità `C1-xx`, `INT-xx`, `EGY-xx` e
`MAG-xx` diventano lezioni. Gli esercizi («Esercizio N · …») vengono separati in
domande (righe a), b)… delle tabelle o elenchi in linea) e collegati alle
soluzioni del Soluzionario; nel punto della lezione in cui compaiono resta un
collegamento all'attività. «Verifica dell'unità» e le simulazioni d'esame
diventano attività con la loro soluzione.

`python3 bidicheck.py VOLUME.pdf 120` controlla l'ordine delle righe su 120
pagine a caso. Le poche differenze residue riguardano frasi che nell'originale
erano isolate con `dir="rtl"`, dove l'algoritmo in avanti senza isolamento dà
un ordine diverso da quello stampato: il testo estratto segue la pagina stampata.

## Limiti noti

- La traduzione inglese archiviata copre solo A0–B2: il prodotto è solo in italiano.
- Le risposte aperte restano in autovalutazione con il modello del Soluzionario.
- Se un volume cambia impaginazione (colori delle tabelle, dimensioni dei
  titoli), vanno aggiornate le costanti in `layout.py` e `blocks.py`.
