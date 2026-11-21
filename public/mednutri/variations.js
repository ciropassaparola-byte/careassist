const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const regex = /function generateDiet\(\) \{[\s\S]*?alert\(\`Terapia settimanale generata[\s\S]*?\n\}/m;

const newGenFunc = `function generateDiet() {
    const pat = document.getElementById('patient-pathology').value;
    const name = document.getElementById('patient-name').value || 'il Paziente';
    
    if (pat === 'altro') {
        alert("Hai selezionato 'Altra Patologia'. Inserisci i pasti manualmente nella tabella tenendo conto dei cibi che hai specificato di evitare.");
        return;
    }

    const tbody = document.getElementById('diet-body');
    const rows = tbody.querySelectorAll('tr');
    
    // Variazioni Pasti per Patologia (3 varianti per ogni pasto)
    const menus = {
        'diabete': {
            colazione: ["Yogurt greco, 30g avena, mirtilli", "Latte di soia, 3 fette Wasa, mandorle", "Kefir, semi di lino, mezza mela verde"],
            pranzo: ["70g farro, 150g tacchino, insalata, olio EVO", "70g quinoa, 150g pollo, zucchine grigliate", "80g orzo, 100g ricotta, spinaci baby"],
            spuntino: ["1 mela verde", "15 mandorle", "Yogurt magro bianco"],
            cena: ["200g merluzzo, broccoli, 50g pane segale", "2 uova sode, asparagi, 50g pane integrale", "150g salmone, fagiolini, 50g pane segale"]
        },
        'steatosi': {
            colazione: ["Porridge (avena e latte parz. scremato), noci", "Yogurt bianco magro, 1 kiwi, mandorle", "Tè verde, 4 fette integrali, marmellata senza zuccheri"],
            pranzo: ["70g riso integrale, 150g salmone, carciofi", "70g farro, 150g fesa di tacchino, insalata mista", "Zuppa di lenticchie (150g), carote julienne"],
            spuntino: ["150g kefir bianco", "1 mela", "10 noci"],
            cena: ["Minestrone verdure, 150g pollo piastrato", "200g branzino al forno, spinaci lessi", "100g bresaola, rucola e limone, 50g pane integrale"]
        },
        'ipertensione': {
            colazione: ["Latte scremato, fette senza sale, banana", "Yogurt magro, fiocchi d'avena, mirtilli", "Tè deteinato, pane sciapo con ricotta fresca"],
            pranzo: ["80g pasta pomodoro (zero sale), zucchine grigliate", "70g riso, 150g pollo al limone, insalata (no sale, sì spezie)", "Minestrone di verdure fresche, 50g pane sciapo"],
            spuntino: ["1 banana (potassio)", "Yogurt magro bianco", "1 arancia"],
            cena: ["150g pollo limone, spinaci lessi (zero sale)", "200g pesce azzurro al forno, pomodori freschi", "2 uova, melanzane grigliate, 50g pane sciapo"]
        },
        'ipercolesterolemia': {
            colazione: ["Porridge con avena (beta-glucani), noci", "Yogurt di soia, semi di chia, frutti rossi", "Latte scremato, 4 fette biscottate integrali"],
            pranzo: ["70g orzo, 150g salmone, spinaci", "70g pasta integrale, 150g legumi misti, carote", "70g quinoa, 150g petto di tacchino, zucchine"],
            spuntino: ["1 mela", "15 mandorle", "Yogurt magro"],
            cena: ["200g merluzzo, broccoli al vapore", "150g petto di pollo, insalata mista", "Minestrone di verdure, 50g pane integrale"]
        },
        'reflusso': {
            colazione: ["Latte parz. scremato, fette biscottate classiche", "Yogurt magro, fiocchi di riso, mela cotta", "Tè leggero, 4 biscotti secchi magri"],
            pranzo: ["70g riso bianco, 150g pollo bollito, carote lesse", "70g pasta, 100g ricotta vaccina, zucchine lesse", "70g farro, 150g platessa al vapore, patate"],
            spuntino: ["1 banana matura", "Mela cotta", "Yogurt magro"],
            cena: ["200g pesce magro, patate lesse", "150g tacchino, carote e zucchine lesse", "2 uova alla coque, vellutata di zucca"]
        },
        'colon': {
            colazione: ["Latte senza lattosio, fiocchi di avena", "Yogurt delattosato, mezza banana, noci macadamia", "Tè verde, gallette di riso, sciroppo d'acero"],
            pranzo: ["70g riso, 150g carne magra, carote", "70g quinoa, 150g pollo, zucchine (senza semi)", "70g pasta senza glutine, 150g pesce, spinaci"],
            spuntino: ["1 kiwi", "Mezza banana", "10 arachidi"],
            cena: ["200g orata, patate al forno", "150g tacchino, carote lesse", "2 uova, insalata verde a foglia piccola"]
        },
        'celiachia': {
            colazione: ["Yogurt, 30g quinoa soffiata, frutta", "Latte, gallette di mais, marmellata", "Kefir, fiocchi di grano saraceno, noci"],
            pranzo: ["70g pasta senza glutine, 150g pollo, insalata", "70g riso, 150g tonno naturale, pomodorini", "70g grano saraceno, 150g tacchino, zucchine"],
            spuntino: ["Frutta fresca", "Yogurt", "Mandorle"],
            cena: ["200g pesce, patate al forno, verdure", "150g carne magra, fagiolini", "Frittata (2 uova), insalata mista, gallette di riso"]
        }
    };
    
    // Fallback menu for pathologies not explicitly defined in variants yet
    const fallback = {
        colazione: ["Yogurt magro, 30g avena, 1 frutto", "Latte parz. scremato, 3 fette integrali", "Tè, 4 biscotti secchi, 1 frutto"],
        pranzo: ["70g pasta integrale, 150g pollo, insalata", "70g riso, 150g pesce, verdure di stagione", "70g farro, 100g formaggio magro, verdure"],
        spuntino: ["1 frutto di stagione", "Yogurt magro", "15 mandorle"],
        cena: ["200g pesce bianco, verdure, pane", "150g tacchino, insalata, pane", "Minestrone di verdure, 2 uova"]
    };

    const selMenu = menus[pat] || fallback;

    // Distribuzione ciclica per evitare ripetizioni nello stesso giorno
    rows.forEach((r, index) => {
        let tds = r.querySelectorAll('td');
        
        // Uso l'indice (0-6 per lun-dom) modulo 3 per ciclare le 3 varianti (es. 0,1,2,0,1,2,0)
        let vIndex = index % 3;
        // Per variare ulteriormente, sfalso il pranzo di 1 e la cena di 2
        let pIndex = (index + 1) % 3;
        let cIndex = (index + 2) % 3;
        
        tds[1].innerText = selMenu.colazione[vIndex];
        tds[2].innerText = selMenu.pranzo[pIndex];
        tds[3].innerText = selMenu.spuntino[vIndex];
        tds[4].innerText = selMenu.cena[cIndex];
        
        tds[5].innerText = \`Protocollo \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Base'}\`;
    });

    alert(\`Terapia settimanale generata con successo per \${name}, ottimizzata per: \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Mantenimento Base'}.\`);
}`;

js = js.replace(regex, newGenFunc);

fs.writeFileSync(jsFile, js, 'utf8');
console.log('Variations updated!');
