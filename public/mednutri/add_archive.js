const fs = require('fs');
const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

// Add "Salva Paziente" button
const targetHeader = `<button class="btn-primary" onclick="generateDiet()">✨ Genera Protocollo</button>`;
const replacementHeader = `<button class="btn-secondary" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; margin-right: 10px;" onclick="savePatient()">💾 Salva Paziente</button>
                <button class="btn-primary" onclick="generateDiet()">✨ Genera Protocollo</button>`;
html = html.replace(targetHeader, replacementHeader);

// Add Modal for Archive
const modalHtml = `
<!-- Archive Modal -->
<div id="archive-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
    <div style="background:white; padding:30px; border-radius:12px; width:500px; max-width:90%; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 style="font-size:1.5rem; color:#1e293b;">🗄️ Archivio Clinico</h2>
            <button onclick="document.getElementById('archive-modal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>
        <div id="archive-list" style="max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            <!-- Pazienti salvati appariranno qui -->
        </div>
    </div>
</div>
`;
if(!html.includes('archive-modal')) {
    html = html.replace('</body>', modalHtml + '\n</body>');
}

// Hook up the sidebar button
html = html.replace('<a href="#" class="nav-item">', '<a href="#" class="nav-item" onclick="openArchive()">');
// Oh wait, index.html has: <a href="#" class="nav-item">\n<div class="icon">📂</div>\n<span>Archivio Clinico</span>
// I'll replace it using a regex.
html = html.replace(/<a href="#" class="nav-item">[\s\S]*?Archivio Clinico<\/span>[\s\S]*?<\/a>/, 
`<a href="#" class="nav-item" onclick="openArchive()">
                    <div class="icon">📂</div>
                    <span>Archivio Clinico</span>
                </a>`);

fs.writeFileSync(indexFile, html, 'utf8');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const archiveJs = `
function savePatient() {
    let name = document.getElementById('patient-name').value.trim();
    if(!name) {
        showToast("Inserisci il nome del paziente per salvarlo.", "error");
        return;
    }
    
    // Raccogli patologie
    let pathologies = [];
    document.querySelectorAll('#comorbidities-container input:checked').forEach(cb => pathologies.push(cb.value));

    let patientData = {
        name: name,
        gender: document.getElementById('patient-gender').value,
        dob: document.getElementById('patient-dob').value,
        height: document.getElementById('patient-height').value,
        weight: document.getElementById('patient-weight').value,
        wrist: document.getElementById('patient-wrist').value,
        lifestyle: document.getElementById('patient-lifestyle').value,
        start: document.getElementById('period-start').value,
        end: document.getElementById('period-end').value,
        mainPathology: document.getElementById('patient-pathology').value,
        comorbidities: pathologies,
        lastSaved: new Date().toLocaleDateString()
    };
    
    localStorage.setItem('mednutri_pat_' + name.toLowerCase(), JSON.stringify(patientData));
    showToast(\`Scheda di \${name} salvata in archivio!\`, "success");
}

function openArchive() {
    let list = document.getElementById('archive-list');
    list.innerHTML = '';
    
    let patients = [];
    for(let i=0; i<localStorage.length; i++) {
        let key = localStorage.key(i);
        if(key.startsWith('mednutri_pat_')) {
            patients.push(JSON.parse(localStorage.getItem(key)));
        }
    }
    
    if(patients.length === 0) {
        list.innerHTML = '<p style="color:#64748b; text-align:center;">Nessun paziente in archivio.</p>';
    } else {
        patients.forEach(p => {
            let div = document.createElement('div');
            div.style.cssText = 'padding:15px; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:background 0.2s;';
            div.onmouseover = () => div.style.background = '#f8fafc';
            div.onmouseout = () => div.style.background = 'white';
            div.onclick = () => loadPatient(p.name);
            
            div.innerHTML = \`
                <div>
                    <div style="font-weight:600; color:#1e293b;">\${p.name}</div>
                    <div style="font-size:0.85rem; color:#64748b;">Ultimo agg: \${p.lastSaved}</div>
                </div>
                <button style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;" onclick="event.stopPropagation(); deletePatient('\${p.name}')">🗑️</button>
            \`;
            list.appendChild(div);
        });
    }
    
    document.getElementById('archive-modal').style.display = 'flex';
}

function loadPatient(name) {
    let key = 'mednutri_pat_' + name.toLowerCase();
    let data = JSON.parse(localStorage.getItem(key));
    if(data) {
        document.getElementById('patient-name').value = data.name;
        document.getElementById('patient-gender').value = data.gender;
        document.getElementById('patient-dob').value = data.dob;
        document.getElementById('patient-height').value = data.height;
        document.getElementById('patient-weight').value = data.weight;
        document.getElementById('patient-wrist').value = data.wrist || '';
        document.getElementById('patient-lifestyle').value = data.lifestyle || '1.2';
        document.getElementById('period-start').value = data.start;
        document.getElementById('period-end').value = data.end;
        
        document.getElementById('patient-pathology').value = data.mainPathology;
        
        // Ricalcola tutto
        calculateAge();
        
        // Reset checkbox prima di ricaricare
        document.querySelectorAll('#comorbidities-container input').forEach(cb => cb.checked = false);
        
        if(data.comorbidities) {
            data.comorbidities.forEach(c => {
                let cb = document.querySelector(\`#comorbidities-container input[value="\${c}"]\`);
                if(cb) cb.checked = true;
            });
        }
        
        updateAnalysis();
        document.getElementById('archive-modal').style.display = 'none';
        showToast(\`Scheda di \${data.name} caricata.\`, "success");
    }
}

function deletePatient(name) {
    if(confirm(\`Vuoi eliminare definitivamente \${name} dall'archivio?\`)) {
        localStorage.removeItem('mednutri_pat_' + name.toLowerCase());
        openArchive(); // Ricarica la lista
        showToast(\`Paziente eliminato.\`, "warning");
    }
}
`;

if(!js.includes('function savePatient')) {
    fs.writeFileSync(jsFile, js + '\n' + archiveJs, 'utf8');
}
console.log('Archive functionality added');
