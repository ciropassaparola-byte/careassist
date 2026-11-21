const fs = require('fs');

// --- 1. UPDATE INDEX.HTML ---
const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

const targetSelectBox = `<div class="input-group full-width">
                            <label>Diagnosi / Patologia Principale</label>
                            <select id="patient-pathology" onchange="updateAnalysis()">
                                <option value="nessuna">Nessuna (Prevenzione Base)</option>
                                <option value="diabete">Diabete di Tipo 2</option>
                                <option value="steatosi">Steatosi Epatica (Fegato Grasso)</option>
                                <option value="ipertensione">Ipertensione Arteriosa</option>
                            </select>
                        </div>`;

const newSelectBox = `<div class="input-group full-width">
                            <label>Diagnosi / Patologia Principale</label>
                            <select id="patient-pathology" onchange="updateAnalysis()">
                                <option value="nessuna">Nessuna (Prevenzione Base)</option>
                                <option value="diabete">Diabete di Tipo 2</option>
                                <option value="ipertensione">Ipertensione Arteriosa</option>
                                <option value="ipercolesterolemia">Ipercolesterolemia</option>
                                <option value="steatosi">Steatosi Epatica (Fegato Grasso)</option>
                                <option value="reflusso">Reflusso Gastroesofageo (MRGE)</option>
                                <option value="gastrite">Gastrite Acuta / Cronica</option>
                                <option value="colon">Sindrome Intestino Irritabile (IBS)</option>
                                <option value="gotta">Iperuricemia / Gotta</option>
                                <option value="celiachia">Celiachia (Gluten-Free)</option>
                                <option value="renale">Insufficienza Renale (Stadio 1-3)</option>
                                <option value="tiroide">Ipotiroidismo</option>
                                <option value="pcos">Sindrome Ovaio Policistico (PCOS)</option>
                                <option value="stipsi">Stipsi Cronica</option>
                                <option value="osteoporosi">Osteoporosi / Osteopenia</option>
                                <option value="altro">✏️ Altra Patologia (Personalizzata)</option>
                            </select>
                        </div>
                        
                        <!-- Custom Pathology Inputs (Hidden by default) -->
                        <div id="custom-pathology-box" style="display:none; grid-column: span 2; background:#f8fafc; padding:15px; border-radius:10px; border:1px dashed var(--primary);">
                            <div class="input-grid">
                                <div class="input-group full-width">
                                    <label>Nome Patologia</label>
                                    <input type="text" id="custom-pat-name" placeholder="Es. Morbo di Crohn">
                                </div>
                                <div class="input-group">
                                    <label style="color:var(--danger)">Cibi da Evitare (separati da virgola)</label>
                                    <input type="text" id="custom-pat-avoid" placeholder="Es. Latticini, Fritti, Spezie">
                                </div>
                                <div class="input-group">
                                    <label style="color:var(--success)">Cibi da Promuovere</label>
                                    <input type="text" id="custom-pat-promote" placeholder="Es. Riso bianco, Zucchine lesse">
                                </div>
                            </div>
                        </div>`;

html = html.replace(targetSelectBox, newSelectBox);
fs.writeFileSync(indexFile, html, 'utf8');

// --- 2. UPDATE APP.JS ---
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

// Using regex to replace pathologyDB completely
const dbRegex = /const pathologyDB = \{[\s\S]*?\n\};\n/m;

const newPathologyDB = `const pathologyDB = {
    'nessuna': { name: "Nessuna / Prevenzione Base", desc: "Regime bilanciato standard mediterraneo.", avoid: ["Eccesso di sale", "Zuccheri aggiunti"], promote: ["Frutta", "Verdura", "Cereali Integrali", "Pesce", "Legumi"] },
    'diabete': { name: "Diabete di Tipo 2", desc: "Controllo rigoroso del carico glicemico.", avoid: ["Zucchero aggiunto", "Dolci", "Pane bianco", "Succhi di frutta"], promote: ["Cereali integrali", "Legumi", "Verdure fibrose", "Noci"] },
    'ipertensione': { name: "Ipertensione Arteriosa", desc: "Dieta DASH. Controllo rigoroso del sodio (< 2g/die).", avoid: ["Sale aggiunto", "Dadi da brodo", "Salumi", "Cibi in scatola"], promote: ["Verdure fresche", "Banane (Potassio)", "Latticini magri", "Pesce fresco"] },
    'ipercolesterolemia': { name: "Ipercolesterolemia", desc: "Riduzione colesterolo LDL e grassi saturi.", avoid: ["Burro", "Formaggi stagionati", "Insaccati", "Frattaglie"], promote: ["Avena (Beta-glucani)", "Salmone", "Olio EVO", "Legumi"] },
    'steatosi': { name: "Steatosi Epatica", desc: "Protocollo per ripristino epatico. Azzeramento alcol e grassi saturi.", avoid: ["Alcolici", "Burro e Panna", "Insaccati", "Fritti", "Zuccheri"], promote: ["Salmone", "Noci", "Verdure a foglia verde", "Carciofi"] },
    'reflusso': { name: "Reflusso Gastroesofageo (MRGE)", desc: "Limitazione alimenti irritanti e a svuotamento gastrico lento.", avoid: ["Caffè", "Menta", "Pomodoro crudo", "Agrumi", "Cioccolato", "Cibi grassi/fritti"], promote: ["Verdure lesse", "Carni bianche magre", "Pesce magro", "Banane, Mele"] },
    'gastrite': { name: "Gastrite Acuta / Cronica", desc: "Dieta blanda, pasti piccoli e frequenti.", avoid: ["Spezie piccanti", "Caffè", "Alcol", "Agrumi", "Cibi molto caldi o freddi"], promote: ["Patate", "Riso bianco", "Zucchine", "Carni bianche"] },
    'colon': { name: "Sindrome Intestino Irritabile (IBS)", desc: "Protocollo Low-FODMAP (bassi fermentescibili).", avoid: ["Cipolla e Aglio", "Legumi (se non decorticati)", "Lattosio", "Frumento", "Mele/Pere"], promote: ["Avena", "Riso", "Carote", "Carne/Pesce magri", "Latte senza lattosio"] },
    'gotta': { name: "Iperuricemia / Gotta", desc: "Riduzione delle purine e dell'alcol.", avoid: ["Frattaglie", "Acciughe/Sardine", "Selvaggina", "Alcol (Birra e Superalcolici)", "Frutti di mare"], promote: ["Latticini (aiutano escrezione urati)", "Ciliegie", "Uova", "Verdure fresche"] },
    'celiachia': { name: "Celiachia", desc: "Esclusione totale e rigorosa del glutine.", avoid: ["Frumento", "Orzo", "Farro", "Segale", "Avena (se non certificata)", "Alimenti contaminati"], promote: ["Riso", "Mais", "Quinoa", "Grano saraceno", "Patate", "Carne/Pesce freschi"] },
    'renale': { name: "Insufficienza Renale (Lieve)", desc: "Controllo dell'apporto proteico (0.8g/kg) e del sodio.", avoid: ["Sale aggiunto", "Eccesso di carne", "Dadi", "Insaccati", "Alimenti ultra-processati"], promote: ["Pasta aproteica (se necessario)", "Frutta e Verdura", "Olio EVO", "Proteine alto valore biologico (Uova)"] },
    'tiroide': { name: "Ipotiroidismo", desc: "Supporto metabolico e iodio.", avoid: ["Soia cruda", "Crucifere crude (broccoli, cavoli)", "Eccesso di zuccheri (rallentano metabolismo)"], promote: ["Pesce marino (Iodio)", "Noci del Brasile (Selenio)", "Uova", "Cereali integrali"] },
    'pcos': { name: "PCOS (Sindrome Ovaio Policistico)", desc: "Miglioramento dell'insulino-resistenza.", avoid: ["Carboidrati raffinati", "Zuccheri", "Latticini vaccini (in alcuni casi)", "Grassi trans"], promote: ["Proteine magre", "Verdure", "Semi di lino", "Grassi sani (Avocado, Olio EVO)"] },
    'stipsi': { name: "Stipsi Cronica", desc: "Alto apporto di fibre (25-30g) e idratazione (>2L).", avoid: ["Tè molto concentrato", "Riso brillato", "Eccesso di formaggi", "Cibi secchi/disidratati senza acqua"], promote: ["Kiwi (al mattino)", "Prugne", "Cereali integrali", "Legumi", "Olio EVO a crudo"] },
    'osteoporosi': { name: "Osteoporosi", desc: "Integrazione naturale di Calcio e Vitamina D.", avoid: ["Eccesso di sale (aumenta calciuria)", "Eccesso di caffeina", "Alcol"], promote: ["Latticini magri", "Acqua calcica (>150mg/L)", "Verdure a foglia verde scuro", "Mandorle"] }
};
`;

js = js.replace(dbRegex, newPathologyDB);

// Replace updateAnalysis logic to handle 'altro'
const updateRegex = /function updateAnalysis\(\) \{[\s\S]*?\}\n/m;

const newUpdateFunc = `function updateAnalysis() {
    const selector = document.getElementById('patient-pathology');
    const panel = document.getElementById('medical-analysis');
    const customBox = document.getElementById('custom-pathology-box');
    
    if (selector.value === 'altro') {
        customBox.style.display = 'block';
        panel.innerHTML = \`<p class="placeholder-text">Compila i campi personalizzati. Il piano andrà generato manualmente o potrai usare le linee guida di base.</p>\`;
        return;
    } else {
        customBox.style.display = 'none';
    }

    const p = pathologyDB[selector.value];

    if (!p || selector.value === 'nessuna') {
        panel.innerHTML = \`<p class="placeholder-text">\${p ? p.desc : 'Seleziona una patologia.'}</p>\`;
        return;
    }

    let avoidHtml = p.avoid.map(i => \`<li>❌ \${i}</li>\`).join('');
    let promoteHtml = p.promote.map(i => \`<li>✅ \${i}</li>\`).join('');

    panel.innerHTML = \`
        <p style="margin-bottom:15px; font-weight:500;">\${p.desc}</p>
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
`;

js = js.replace(updateRegex, newUpdateFunc);

// Update generateDiet to just use basic mappings for all 15 so the demo works
const genRegex = /function generateDiet\(\) \{[\s\S]*?alert\(\`Terapia settimanale[\s\S]*?\n\}/m;

const newGenFunc = `function generateDiet() {
    const pat = document.getElementById('patient-pathology').value;
    const name = document.getElementById('patient-name').value || 'il Paziente';
    
    if (pat === 'altro') {
        alert("Hai selezionato 'Altra Patologia'. Inserisci i pasti manualmente nella tabella tenendo conto dei cibi che hai specificato di evitare.");
        return;
    }

    const tbody = document.getElementById('diet-body');
    const rows = tbody.querySelectorAll('tr');
    
    // Un piccolo generatore dinamico universale
    let baseColazione = "Yogurt magro, 30g avena, 1 frutto fresco";
    let basePranzo = "70g pasta integrale, 150g petto di pollo, insalata, olio EVO";
    let baseSpuntino = "1 mela o 15 mandorle";
    let baseCena = "200g pesce bianco, verdure di stagione, 50g pane integrale";

    if (pat === 'diabete' || pat === 'pcos') { baseColazione = "Yogurt greco, 30g avena, mirtilli"; basePranzo = "70g farro, 150g tacchino, insalata, olio EVO"; baseCena = "200g merluzzo, broccoli, 50g pane di segale"; }
    else if (pat === 'ipertensione' || pat === 'osteoporosi') { baseColazione = "Latte scremato, fette senza sale, banana"; basePranzo = "80g pasta pomodoro (zero sale), zucchine grigliate"; baseCena = "150g pollo limone, spinaci lessi (zero sale)"; }
    else if (pat === 'ipercolesterolemia' || pat === 'steatosi') { baseColazione = "Porridge (avena e latte parz. scremato), noci"; basePranzo = "70g riso integrale, 150g salmone, carciofi"; baseCena = "Minestrone verdure, 150g tacchino piastrato"; }
    else if (pat === 'reflusso' || pat === 'gastrite') { baseColazione = "Latte parz. scremato, fette biscottate classiche"; basePranzo = "70g riso bianco, 150g pollo bollito, carote lesse"; baseSpuntino = "1 banana"; baseCena = "200g platessa, patate lesse, olio EVO a crudo"; }
    else if (pat === 'colon') { baseColazione = "Latte senza lattosio, fiocchi di avena"; basePranzo = "70g riso, 150g carne magra, carote"; baseSpuntino = "1 kiwi"; baseCena = "200g orata, zucchine (senza semi), gallette di riso"; }
    else if (pat === 'celiachia') { baseColazione = "Yogurt, 30g quinoa soffiata, frutta"; basePranzo = "70g pasta senza glutine, 150g pollo, insalata"; baseCena = "200g pesce, patate al forno, verdure"; }
    else if (pat === 'gotta') { baseColazione = "Latte scremato, fette, ciliegie/fragole"; basePranzo = "70g pasta, 2 uova sode, verdure"; baseCena = "150g petto pollo, abbondante insalata, formaggio magro"; }
    else if (pat === 'renale') { baseColazione = "Tè, fette biscottate, burro e marmellata"; basePranzo = "80g pasta aproteica, 100g petto di pollo, verdure (poco potassio)"; baseSpuntino = "Mele cotte"; baseCena = "120g pesce, verdure (bollite due volte per togliere potassio)"; }
    else if (pat === 'stipsi') { baseColazione = "Kefir, 40g crusca d'avena, 2 prugne secche"; basePranzo = "80g pasta integrale, 150g lenticchie, spinaci"; baseSpuntino = "2 Kiwi"; baseCena = "Minestrone con legumi, 50g pane integrale"; }
    else if (pat === 'tiroide') { baseColazione = "Yogurt, noci del brasile, fiocchi d'avena"; basePranzo = "70g riso, 150g pesce di mare (sgombro/tonno), pomodori"; baseCena = "2 uova, verdure cotte, pane integrale"; }

    rows.forEach(r => {
        let tds = r.querySelectorAll('td');
        tds[1].innerText = baseColazione;
        tds[2].innerText = basePranzo;
        tds[3].innerText = baseSpuntino;
        tds[4].innerText = baseCena;
        tds[5].innerText = \`Protocollo \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Base'}\`;
    });

    alert(\`Terapia settimanale generata con successo per \${name}, ottimizzata per: \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Mantenimento Base'}.\`);
}`;

js = js.replace(genRegex, newGenFunc);

fs.writeFileSync(jsFile, js, 'utf8');

console.log('Update Complete');
