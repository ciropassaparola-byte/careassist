const fs = require('fs');

const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

// Replace Anagrafica structure to include Gender and Wrist
const targetAnag = `<div class="input-grid">
                        <div class="input-group">
                            <label>Nome e Cognome</label>
                            <input type="text" id="patient-name" placeholder="Es. Mario Rossi">
                        </div>
                        <div class="input-group">
                            <label>Data di Nascita <span id="calculated-age" style="color:var(--primary); font-weight:600; margin-left:5px;"></span></label>
                            <input type="date" id="patient-dob" onchange="calculateAge()">
                        </div>
                        <div class="input-group">
                            <label>Altezza (cm)</label>
                            <input type="number" id="patient-height" placeholder="Es. 175" onkeyup="calculateBMI()" onchange="calculateBMI()">
                        </div>
                        <div class="input-group">
                            <label>Peso (Kg) <span id="bmi-badge" style="margin-left: 5px; font-weight: 600; font-size: 0.85rem;"></span></label>
                            <input type="number" id="patient-weight" placeholder="Es. 82" onkeyup="calculateBMI()" onchange="calculateBMI()">
                        </div>`;

const newAnag = `<div class="input-grid">
                        <div class="input-group" style="grid-column: span 2;">
                            <label>Nome e Cognome</label>
                            <input type="text" id="patient-name" placeholder="Es. Mario Rossi">
                        </div>
                        <div class="input-group">
                            <label>Sesso</label>
                            <select id="patient-gender" onchange="calculateBMI()">
                                <option value="M">Uomo</option>
                                <option value="F">Donna</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Data di Nascita <span id="calculated-age" style="color:var(--primary); font-weight:600; margin-left:5px;"></span></label>
                            <input type="date" id="patient-dob" onchange="calculateAge()">
                        </div>
                        
                        <div class="input-group">
                            <label>Altezza (cm)</label>
                            <input type="number" id="patient-height" placeholder="Es. 175" onkeyup="calculateBMI()" onchange="calculateBMI()">
                        </div>
                        <div class="input-group">
                            <label>Peso (Kg) <span id="bmi-badge" style="margin-left: 5px; font-weight: 600; font-size: 0.85rem;"></span></label>
                            <input type="number" id="patient-weight" placeholder="Es. 82" onkeyup="calculateBMI()" onchange="calculateBMI()">
                        </div>
                        <div class="input-group">
                            <label>Circonferenza Polso (cm) <span id="frame-badge" style="margin-left: 5px; font-weight: 600; font-size: 0.85rem;"></span></label>
                            <input type="number" id="patient-wrist" placeholder="Es. 17" onkeyup="calculateBMI()" onchange="calculateBMI()">
                        </div>
                        
                        <!-- spacer invisibile per mantenere la griglia bilanciata -->
                        <div class="input-group"></div>
`;

html = html.replace(targetAnag, newAnag);
fs.writeFileSync(indexFile, html, 'utf8');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const oldBmi = /function calculateBMI\(\) \{[\s\S]*?\n\}\n/m;
const newBmi = `function calculateBMI() {
    let h = document.getElementById('patient-height').value;
    let w = document.getElementById('patient-weight').value;
    let wrist = document.getElementById('patient-wrist').value;
    let gender = document.getElementById('patient-gender').value;
    
    let badge = document.getElementById('bmi-badge');
    let frameBadge = document.getElementById('frame-badge');
    
    // Calcolo Costituzione (Morfologia)
    if (h && wrist && h > 0 && wrist > 0) {
        let r = h / wrist;
        let frame = '';
        let fColor = '';
        if (gender === 'M') {
            if (r > 10.4) { frame = 'Longilinea (Ossa fini)'; fColor = '#8b5cf6'; }
            else if (r >= 9.6 && r <= 10.4) { frame = 'Normolinea'; fColor = '#10b981'; }
            else { frame = 'Brevilinea (Ossa grosse)'; fColor = '#f59e0b'; }
        } else {
            if (r > 10.9) { frame = 'Longilinea (Ossa fini)'; fColor = '#8b5cf6'; }
            else if (r >= 9.9 && r <= 10.9) { frame = 'Normolinea'; fColor = '#10b981'; }
            else { frame = 'Brevilinea (Ossa grosse)'; fColor = '#f59e0b'; }
        }
        frameBadge.innerHTML = \`<span style="color: \${fColor}; background: \${fColor}20; padding: 2px 6px; border-radius: 4px;">\${frame}</span>\`;
    } else {
        frameBadge.innerHTML = '';
    }

    // Calcolo BMI
    if (h && w && h > 0 && w > 0) {
        let heightM = h / 100;
        let bmi = (w / (heightM * heightM)).toFixed(1);
        
        let status = '';
        let color = '';
        
        if (bmi < 18.5) { status = 'Sottopeso'; color = '#3b82f6'; }
        else if (bmi >= 18.5 && bmi < 25) { status = 'Normopeso'; color = '#22c55e'; }
        else if (bmi >= 25 && bmi < 30) { status = 'Sovrappeso'; color = '#eab308'; }
        else if (bmi >= 30 && bmi < 35) { status = 'Obesità 1'; color = '#f97316'; }
        else if (bmi >= 35 && bmi < 40) { status = 'Obesità 2'; color = '#ef4444'; }
        else { status = 'Obesità 3'; color = '#991b1b'; }
        
        badge.innerHTML = \`<span style="color: \${color}; background: \${color}20; padding: 2px 6px; border-radius: 4px;">BMI \${bmi} (\${status})</span>\`;
    } else {
        badge.innerHTML = '';
    }
}
`;

js = js.replace(oldBmi, newBmi);
fs.writeFileSync(jsFile, js, 'utf8');

console.log('Frame calculation added');
