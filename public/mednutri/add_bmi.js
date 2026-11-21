const fs = require('fs');
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const bmiFunc = `
function calculateBMI() {
    let h = document.getElementById('patient-height').value;
    let w = document.getElementById('patient-weight').value;
    let badge = document.getElementById('bmi-badge');
    
    if (h && w && h > 0 && w > 0) {
        let heightM = h / 100;
        let bmi = (w / (heightM * heightM)).toFixed(1);
        
        let status = '';
        let color = '';
        
        if (bmi < 18.5) { status = 'Sottopeso'; color = '#3b82f6'; }
        else if (bmi >= 18.5 && bmi < 25) { status = 'Normopeso'; color = '#22c55e'; }
        else if (bmi >= 25 && bmi < 30) { status = 'Sovrappeso'; color = '#eab308'; }
        else if (bmi >= 30 && bmi < 35) { status = 'Obesità Grado 1'; color = '#f97316'; }
        else if (bmi >= 35 && bmi < 40) { status = 'Obesità Grado 2'; color = '#ef4444'; }
        else { status = 'Obesità Grado 3'; color = '#991b1b'; }
        
        badge.innerHTML = \`<span style="color: \${color}; background: \${color}20; padding: 2px 6px; border-radius: 4px;">BMI \${bmi} (\${status})</span>\`;
    } else {
        badge.innerHTML = '';
    }
}
`;

js = js + '\n' + bmiFunc;
fs.writeFileSync(jsFile, js, 'utf8');
console.log('BMI appended');
