const fs = require('fs');

// UPDATE CSS
const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const focusCss = `
/* Focus & Error States */
.input-group input:focus, 
.input-group select:focus,
.com-checkbox input:focus {
    background-color: #f0f9ff !important;
    border-color: #3b82f6 !important;
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
    transition: all 0.2s ease-in-out;
}

.input-error {
    border-color: #ef4444 !important;
    background-color: #fef2f2 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
    transition: all 0.2s ease-in-out;
}
`;

if(!css.includes('.input-error')) {
    fs.writeFileSync(cssFile, css + '\n' + focusCss, 'utf8');
    console.log('CSS updated');
}

// UPDATE JS
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const targetSave = /function savePatient\(\) \{[\s\S]*?return;\n    \}/;

const newSave = `function savePatient() {
    let fields = [
        { id: 'patient-name', val: document.getElementById('patient-name').value.trim() },
        { id: 'patient-dob', val: document.getElementById('patient-dob').value },
        { id: 'patient-height', val: document.getElementById('patient-height').value },
        { id: 'patient-weight', val: document.getElementById('patient-weight').value },
        { id: 'patient-wrist', val: document.getElementById('patient-wrist').value }
    ];
    
    // Reset errors and re-add normal listeners
    fields.forEach(f => {
        let el = document.getElementById(f.id);
        el.classList.remove('input-error');
        // Rimuove l'errore non appena l'utente inizia a scrivere
        el.addEventListener('input', function() { this.classList.remove('input-error'); });
    });
    
    let missing = fields.filter(f => !f.val);
    
    if (missing.length > 0) {
        // Applica classe errore a tutti i campi vuoti
        missing.forEach(f => document.getElementById(f.id).classList.add('input-error'));
        
        // Sposta il focus sul primo campo vuoto
        document.getElementById(missing[0].id).focus();
        
        showToast("Compila i campi evidenziati in rosso prima di salvare.", "error");
        return;
    }
    
    let name = fields[0].val;`;

if(js.match(targetSave)) {
    js = js.replace(targetSave, newSave);
    fs.writeFileSync(jsFile, js, 'utf8');
    console.log('JS updated');
}
