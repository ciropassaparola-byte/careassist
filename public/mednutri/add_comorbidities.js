const fs = require('fs');

const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

const targetDiagnosi = `<div class="input-group full-width">
                            <label>Diagnosi / Patologia Principale</label>
                            <select id="patient-pathology" onchange="updateAnalysis()">
                                <option value="nessuna">Nessuna / Prevenzione Base</option>
                                <option value="diabete">Diabete di Tipo 2</option>
                                <option value="ipertensione">Ipertensione Arteriosa</option>
                                <option value="ipercolesterolemia">Ipercolesterolemia</option>
                                <option value="steatosi">Steatosi Epatica (Fegato Grasso)</option>
                                <option value="reflusso">Reflusso Gastroesofageo (MRGE)</option>
                                <option value="gastrite">Gastrite Acuta / Cronica</option>
                                <option value="colon">Sindrome Intestino Irritabile (IBS)</option>
                                <option value="gotta">Iperuricemia / Gotta</option>
                                <option value="celiachia">Celiachia</option>
                                <option value="renale">Insufficienza Renale (Lieve)</option>
                                <option value="tiroide">Ipotiroidismo</option>
                                <option value="pcos">PCOS (Sindrome Ovaio Policistico)</option>
                                <option value="stipsi">Stipsi Cronica</option>
                                <option value="osteoporosi">Osteoporosi</option>
                                <option value="altro">Altra Patologia (Specificare sotto)</option>
                            </select>
                        </div>
                        
                        <div class="input-group full-width" id="custom-pathology-box" style="display:none;">`;

const newDiagnosi = `<div class="input-group full-width">
                            <label>Diagnosi / Patologia Principale (Genera Dieta Base)</label>
                            <select id="patient-pathology" onchange="updateAnalysis()">
                                <option value="nessuna">Nessuna / Prevenzione Base</option>
                                <option value="diabete">Diabete di Tipo 2</option>
                                <option value="ipertensione">Ipertensione Arteriosa</option>
                                <option value="ipercolesterolemia">Ipercolesterolemia</option>
                                <option value="steatosi">Steatosi Epatica (Fegato Grasso)</option>
                                <option value="reflusso">Reflusso Gastroesofageo (MRGE)</option>
                                <option value="gastrite">Gastrite Acuta / Cronica</option>
                                <option value="colon">Sindrome Intestino Irritabile (IBS)</option>
                                <option value="gotta">Iperuricemia / Gotta</option>
                                <option value="celiachia">Celiachia</option>
                                <option value="renale">Insufficienza Renale (Lieve)</option>
                                <option value="tiroide">Ipotiroidismo</option>
                                <option value="pcos">PCOS (Sindrome Ovaio Policistico)</option>
                                <option value="stipsi">Stipsi Cronica</option>
                                <option value="osteoporosi">Osteoporosi</option>
                                <option value="altro">Altra Patologia (Specificare sotto)</option>
                            </select>
                        </div>
                        
                        <div class="input-group full-width" id="comorbidities-wrapper" style="margin-top:15px; background: rgba(255,255,255,0.4); padding: 10px; border-radius: 8px;">
                            <label style="margin-bottom: 10px; display:block; color:#3b82f6;">➕ Patologie Concomitanti (Comorbidità - Opzionale)</label>
                            <div id="comorbidities-container" class="checkbox-grid">
                                <!-- Generato dinamicamente via JS -->
                            </div>
                        </div>

                        <div class="input-group full-width" id="custom-pathology-box" style="display:none; margin-top:15px;">`;

html = html.replace(targetDiagnosi, newDiagnosi);
fs.writeFileSync(indexFile, html, 'utf8');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const jsComorbiditiesFunc = `
function initComorbidities() {
    const container = document.getElementById('comorbidities-container');
    container.innerHTML = '';
    
    // Escludiamo 'nessuna' e 'altro' dalle patologie secondarie
    const excludedKeys = ['nessuna', 'altro'];
    
    for (let key in pathologyDB) {
        if (!excludedKeys.includes(key)) {
            let label = document.createElement('label');
            label.className = 'com-checkbox';
            label.innerHTML = \`<input type="checkbox" value="\${key}" onchange="updateAnalysis()"> \${pathologyDB[key].name}\`;
            container.appendChild(label);
        }
    }
}
`;

const targetInit = `function initDates() {`;
js = js.replace(targetInit, jsComorbiditiesFunc + '\nfunction initDates() {');

const targetDomLoad = `initDates();
});`;
const repDomLoad = `initDates();
    initComorbidities();
});`;
js = js.replace(targetDomLoad, repDomLoad);

// Now update updateAnalysis to merge rules
const targetUpdateAnalysis = /function updateAnalysis\(\) \{[\s\S]*?panel\.innerHTML = `[\s\S]*?`;\n\}/m;

const newUpdateAnalysis = `function updateAnalysis() {
    const selector = document.getElementById('patient-pathology');
    const panel = document.getElementById('medical-analysis');
    const customBox = document.getElementById('custom-pathology-box');
    const comContainer = document.getElementById('comorbidities-wrapper');
    
    if (selector.value === 'altro') {
        customBox.style.display = 'block';
        comContainer.style.display = 'none';
        panel.innerHTML = \`<p class="placeholder-text">Compila i campi personalizzati. Il piano andrà generato manualmente o potrai usare le linee guida di base.</p>\`;
        return;
    } else {
        customBox.style.display = 'none';
        comContainer.style.display = 'block';
    }

    const mainPat = pathologyDB[selector.value];

    if (!mainPat || selector.value === 'nessuna') {
        panel.innerHTML = \`<p class="placeholder-text">\${mainPat ? mainPat.desc : 'Seleziona una patologia.'}</p>\`;
        
        // Se non c'è patologia principale, disabilita le checkbox
        let checkboxes = document.querySelectorAll('#comorbidities-container input');
        checkboxes.forEach(cb => { cb.checked = false; cb.disabled = true; });
        return;
    } else {
        // Riabilita checkbox e disabilita quella uguale alla patologia principale
        let checkboxes = document.querySelectorAll('#comorbidities-container input');
        checkboxes.forEach(cb => { 
            cb.disabled = false; 
            if(cb.value === selector.value) {
                cb.checked = false;
                cb.disabled = true;
            }
        });
    }

    // Raccogliamo le patologie da unire (Principale + Spuntate)
    let selectedPathologies = [mainPat];
    
    let checkboxes = document.querySelectorAll('#comorbidities-container input:checked');
    checkboxes.forEach(cb => {
        if (pathologyDB[cb.value]) {
            selectedPathologies.push(pathologyDB[cb.value]);
        }
    });

    // Uniamo i dati usando Set per evitare doppioni
    let mergedAvoid = new Set();
    let mergedPromote = new Set();
    let mergedGoldenRules = [];
    
    let titleNames = [];

    selectedPathologies.forEach(p => {
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
}`;

js = js.replace(targetUpdateAnalysis, newUpdateAnalysis);
fs.writeFileSync(jsFile, js, 'utf8');

const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const cssComorbidities = `
.checkbox-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.85rem;
    max-height: 120px;
    overflow-y: auto;
    padding-right: 5px;
}
.checkbox-grid::-webkit-scrollbar {
    width: 6px;
}
.checkbox-grid::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
}
.com-checkbox {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    color: #475569;
}
.com-checkbox input {
    margin: 0;
    cursor: pointer;
}
`;
css = css + '\n' + cssComorbidities;
fs.writeFileSync(cssFile, css, 'utf8');

console.log('Comorbidities module added');
