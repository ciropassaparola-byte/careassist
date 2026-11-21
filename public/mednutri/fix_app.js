const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

// I need to find where pathologyDB ends (line 93) and where the broken code begins.
// The broken code starts at line 94 with `    // Fallback menu for pathologies...`

const lines = js.split('\n');

const fix = `
function updateAnalysis() {
    const pat = document.getElementById('patient-pathology').value;
    const panel = document.getElementById('medical-analysis');
    
    if (pat === 'altro') {
        const cName = document.getElementById('custom-pat-name').value || "Patologia Personalizzata";
        const cAvoid = document.getElementById('custom-pat-avoid').value;
        const cPromote = document.getElementById('custom-pat-promote').value;
        
        let avoidHtml = cAvoid ? cAvoid.split(',').map(i => \`<li>❌ \${i.trim()}</li>\`).join('') : "<li>❌ (Nessun dato)</li>";
        let promoteHtml = cPromote ? cPromote.split(',').map(i => \`<li>✅ \${i.trim()}</li>\`).join('') : "<li>✅ (Nessun dato)</li>";
        
        panel.innerHTML = \`
            <p style="margin-bottom:15px; font-weight:600; color:#1e293b;">\${cName} (Personalizzata)</p>
            <div class="rule-item danger">
                <strong>Da Evitare Tassativamente:</strong>
                <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">\${avoidHtml}</ul>
            </div>
            <div class="rule-item success">
                <strong>Da Promuovere Fortemente:</strong>
                <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">\${promoteHtml}</ul>
            </div>
        \`;
        return;
    }
    
    const mainPat = pathologyDB[pat];
    
    // Raccogli comorbidità selezionate
    let selectedComorbidities = [];
    document.querySelectorAll('.com-checkbox input:checked').forEach(cb => {
        if(pathologyDB[cb.value]) selectedComorbidities.push(pathologyDB[cb.value]);
    });

    // Unisci divieti e promozioni
    let mergedAvoid = new Set(mainPat.avoid);
    let mergedPromote = new Set(mainPat.promote);
    let mergedGoldenRules = [];
    if(mainPat.goldenRule) mergedGoldenRules.push(\`<strong>⭐ \${mainPat.name}:</strong> \${mainPat.goldenRule}\`);
    
    let titleNames = [mainPat.name];

    selectedComorbidities.forEach(p => {
        titleNames.push(p.name);
        p.avoid.forEach(item => mergedAvoid.add(item));
        p.promote.forEach(item => mergedPromote.add(item));
        if (p.goldenRule) {
            mergedGoldenRules.push(\`<strong>⭐ \${p.name}:</strong> \${p.goldenRule}\`);
        }
    });

    let avoidHtml = Array.from(mergedAvoid).map(i => \`<li>❌ \${i}</li>\`).join('');
    let promoteHtml = Array.from(mergedPromote).map(i => \`<li>✅ \${i}</li>\`).join('');
    let rulesHtml = mergedGoldenRules.map(r => \`<div style="margin-bottom:5px;">\${r}</div>\`).join('');

    let combinedTitle = titleNames.length > 1 
        ? \`Protocollo Unificato: \${titleNames.join(' + ')}\` 
        : mainPat.desc;

    panel.innerHTML = \`
        <p style="margin-bottom:15px; font-weight:600; color:#1e293b;">\${combinedTitle}</p>
        \${mergedGoldenRules.length > 0 ? \`<div class="golden-rule">\${rulesHtml}</div>\` : ''}
        <div class="rule-item danger">
            <strong>Da Evitare Tassativamente:</strong>
            <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">\${avoidHtml}</ul>
        </div>
        <div class="rule-item success">
            <strong>Da Promuovere Fortemente:</strong>
            <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">\${promoteHtml}</ul>
        </div>
    \`;
}

function generateDiet() {
    const pat = document.getElementById('patient-pathology').value;
    const name = document.getElementById('patient-name').value || 'il Paziente';
    
    if (pat === 'altro') {
        if(typeof showToast !== 'undefined') showToast("Hai selezionato 'Altra Patologia'. Inserisci i pasti manualmente.", "warning");
        return;
    }

    const tbody = document.getElementById('diet-body');
    const rows = tbody.querySelectorAll('tr');
    
    // Variazioni Pasti per Patologia (7 varianti per ogni pasto)
    const menus = {
        'diabete': {
            colazione: [
                "Yogurt greco, 30g avena, mirtilli", 
                "Latte di soia, 3 fette Wasa, mandorle", 
                "Kefir, semi di lino, mezza mela verde",
                "Yogurt magro, 1 kiwi, noci",
                "Tè verde, 4 biscotti integrali per diabetici",
                "Latte scremato, 30g crusca, fragole",
                "Yogurt greco, noci pecan, cannella"
            ],
            pranzo: [
                "70g farro, 150g tacchino, insalata, olio EVO", 
                "70g quinoa, 150g pollo, zucchine grigliate", 
                "80g orzo, 100g ricotta, spinaci baby",
                "150g lenticchie, verdure miste, 1 cucchiaio olio",
                "70g riso integrale, 150g petto di pollo, melanzane",
                "70g pasta integrale, 100g tonno naturale, pomodorini",
                "Zuppa di ceci (150g), verdure a foglia, crostini integrali"
            ],
            spuntino: [
                "1 mela verde", "15 mandorle", "Yogurt magro bianco", "1 finocchio", "10 noci", "Mezza pera", "Kefir"
            ],
            cena: [
                "200g merluzzo, broccoli, 50g pane segale", 
                "2 uova sode, asparagi, 50g pane integrale", 
                "150g salmone, fagiolini, 50g pane segale",
                "200g platessa al vapore, cavolfiore, 50g pane segale",
                "150g fesa di tacchino, insalata mista, 50g pane integrale",
                "100g formaggio magro, verdure grigliate, 50g pane",
                "200g spigola al forno, zucchine, 50g pane segale"
            ]
        },
        'steatosi': {
            colazione: ["Porridge avena", "Yogurt bianco magro", "Tè verde, fette integrali", "Kefir e mirtilli", "Latte di mandorla, noci", "Yogurt greco magro", "Tè deteinato, fette Wasa"],
            pranzo: ["70g riso integrale, 150g salmone, carciofi", "70g farro, 150g tacchino, insalata", "Zuppa lenticchie, carote", "70g orzo, verdure grigliate", "70g pasta integrale, 150g pollo, zucchine", "70g quinoa, pomodorini e rucola", "Riso venere 70g, 150g pesce magro, broccoli"],
            spuntino: ["150g kefir", "1 mela", "10 noci", "1 finocchio", "Yogurt magro", "15 mandorle", "Spremuta d'arancia"],
            cena: ["Minestrone verdure, pollo", "200g branzino, spinaci", "100g bresaola, rucola", "150g vitello magro, cavolfiore", "2 uova, asparagi", "200g merluzzo, fagiolini", "Insalatona mista, 100g ricotta"]
        },
        'ipertensione': {
            colazione: ["Latte scremato, banana", "Yogurt magro, mirtilli", "Tè, pane sciapo e ricotta", "Spremuta, fette senza sale", "Porridge con mela", "Latte e fiocchi d'avena", "Yogurt e noci"],
            pranzo: ["80g pasta (zero sale), zucchine", "70g riso, pollo limone", "Minestrone fresco, pane sciapo", "70g farro, pomodori freschi", "150g ceci, verdure", "70g pasta, sugo fresco basilico", "Zuppa orzo e legumi"],
            spuntino: ["1 banana", "Yogurt", "1 arancia", "Mandorle non salate", "1 kiwi", "Mezza mela", "Kefir"],
            cena: ["150g pollo, spinaci (zero sale)", "200g pesce azzurro, pomodori", "2 uova, melanzane", "200g merluzzo, fagiolini", "150g tacchino, carote", "Formaggio magro dolce, insalata", "150g vitello, asparagi"]
        },
        'ipercolesterolemia': {
            colazione: ["Porridge avena (beta-glucani)", "Yogurt soia, frutti rossi", "Latte scremato, fette", "Tè verde, biscotti avena", "Kefir, semi di chia", "Spremuta, mandorle", "Yogurt magro, mela"],
            pranzo: ["70g orzo, 150g salmone", "70g pasta int, legumi", "70g quinoa, tacchino", "150g fagioli, verdure", "70g riso int, pollo", "70g farro, zucchine", "Zuppa ceci e cavolo nero"],
            spuntino: ["1 mela", "15 mandorle", "Yogurt magro", "1 finocchio", "10 noci", "1 pera", "Kefir"],
            cena: ["200g merluzzo, broccoli", "150g pollo, insalata", "Minestrone, pane int", "200g sgombro, fagiolini", "2 uova, spinaci", "150g tacchino, carote", "100g ricotta, verdure grigliate"]
        },
        'reflusso': {
            colazione: ["Latte parz. scremato, fette", "Yogurt magro, mela cotta", "Tè leggero, biscotti", "Latte mandorla, fette", "Yogurt bianco, pera cotta", "Latte, fiocchi riso", "Tè, fette e marmellata"],
            pranzo: ["70g riso, pollo bollito", "70g pasta, ricotta, zucchine", "70g farro, platessa, patate", "70g pasta, carote lesse", "70g riso, tacchino", "70g orzo, verdure lesse", "Vellutata zucca, crostini"],
            spuntino: ["1 banana matura", "Mela cotta", "Yogurt", "Pera cotta", "Fette biscottate", "Latte scremato", "Banana"],
            cena: ["200g pesce magro, patate", "150g tacchino, carote", "2 uova coque, vellutata", "200g merluzzo, zucchine", "150g pollo, fagiolini", "Formaggio magro, patate", "Pesce al vapore, finocchi lessi"]
        },
        'colon': {
            colazione: ["Latte s/lattosio, avena", "Yogurt delatt, banana", "Tè verde, gallette riso", "Kefir, noci", "Latte s/lattosio, fette", "Tè, biscotti s/lattosio", "Yogurt soia"],
            pranzo: ["70g riso, carne magra, carote", "70g quinoa, pollo, zucchine", "70g pasta GF, pesce, spinaci", "70g riso, tacchino", "70g miglio, verdure", "70g riso, tonno", "Pasta GF, zucchine"],
            spuntino: ["1 kiwi", "Mezza banana", "10 arachidi", "Yogurt s/latt", "Mandarino", "Gallette di riso", "Mandorle"],
            cena: ["200g orata, patate forno", "150g tacchino, carote", "2 uova, insalata", "200g spigola, spinaci", "150g pollo, fagiolini", "Formaggio s/latt, patate", "Pesce, zucchine"]
        },
        'celiachia': {
            colazione: ["Yogurt, quinoa soffiata", "Latte, gallette mais", "Kefir, grano saraceno", "Tè, fette GF", "Latte, biscotti GF", "Yogurt, frutta fresca", "Tè, gallette riso"],
            pranzo: ["70g pasta GF, pollo", "70g riso, tonno", "70g grano saraceno, tacchino", "70g mais, pesce", "70g quinoa, verdure", "70g riso, carne", "Pasta GF, zucchine"],
            spuntino: ["Frutta fresca", "Yogurt", "Mandorle", "Gallette riso", "1 mela", "Noci", "Kefir"],
            cena: ["200g pesce, patate", "150g carne, fagiolini", "Frittata, insalata", "200g spigola, carote", "150g pollo, spinaci", "Formaggio, verdure", "Pesce, patate"]
        }
    };
`;

let topPart = lines.slice(0, 94).join('\n'); // Up to `};`
let bottomPart = lines.slice(94).join('\n'); // From `// Fallback menu` onwards.

let restoredJs = topPart + '\n' + fix + '\n' + bottomPart;

fs.writeFileSync(jsFile, restoredJs, 'utf8');
console.log('Restored broken code successfully.');
