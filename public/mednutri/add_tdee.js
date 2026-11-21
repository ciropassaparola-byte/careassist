const fs = require('fs');
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const calcBMIRegex = /function calculateBMI\(\) \{[\s\S]*?badge\.innerHTML = '';\n    \}\n\}/;

const newCalcBMI = `function calculateBMI() {
    let hRaw = document.getElementById('patient-height').value;
    let wRaw = document.getElementById('patient-weight').value;
    let wristRaw = document.getElementById('patient-wrist').value;
    
    let h = parseFloat(hRaw.replace(',', '.'));
    let w = parseFloat(wRaw.replace(',', '.'));
    let wrist = parseFloat(wristRaw.replace(',', '.'));
    let gender = document.getElementById('patient-gender').value;
    let lifestyle = document.getElementById('patient-lifestyle').value;
    
    let ageText = document.getElementById('calculated-age').innerText;
    let age = parseInt(ageText.replace(/\\D/g, '')) || 0;
    
    let badge = document.getElementById('bmi-badge');
    let frameBadge = document.getElementById('frame-badge');
    let tdeeBadge = document.getElementById('tdee-badge');
    
    // Auto-correzione se il medico inserisce l'altezza in metri (es. 1.60) invece di cm (es. 160)
    if (h > 0 && h < 3) {
        h = h * 100;
    }
    
    // Calcolo Costituzione (Morfologia)
    if (h > 0 && wrist > 0) {
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
        
        if (wrist < 5 || wrist > 35) {
            frame = 'Valore errato'; fColor = '#ef4444';
        }
        
        frameBadge.innerHTML = \`<span style="color: \${fColor}; background: \${fColor}20; padding: 2px 6px; border-radius: 4px;">\${frame}</span>\`;
    } else {
        frameBadge.innerHTML = '';
    }

    // Calcolo BMI & TDEE
    if (h > 0 && w > 0) {
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
        
        // Calcolo BMR (Mifflin-St Jeor) e TDEE
        if (age > 0) {
            let bmr = 0;
            if (gender === 'M') {
                bmr = (10 * w) + (6.25 * h) - (5 * age) + 5;
            } else {
                bmr = (10 * w) + (6.25 * h) - (5 * age) - 161;
            }
            let tdee = Math.round(bmr * parseFloat(lifestyle));
            tdeeBadge.innerHTML = \`<span style="color: #0284c7; background: #0284c720; padding: 2px 6px; border-radius: 4px;">\${tdee} Kcal/die</span>\`;
        }
    } else {
        badge.innerHTML = '';
        tdeeBadge.innerHTML = '';
    }
}`;

js = js.replace(calcBMIRegex, newCalcBMI);

// Wait, the age calculation might need to trigger calculateBMI so it updates the TDEE when the birthdate changes
js = js.replace('function calculateAge() {', 'function calculateAge() {'); // just to find it
const calcAgeMatch = js.match(/function calculateAge\(\) \{[\s\S]*?\}\n/);
if (calcAgeMatch && !calcAgeMatch[0].includes('calculateBMI();')) {
    const newCalcAge = calcAgeMatch[0].replace(/}\n$/, '    calculateBMI();\n}\n');
    js = js.replace(calcAgeMatch[0], newCalcAge);
}

fs.writeFileSync(jsFile, js, 'utf8');
console.log('BMR & TDEE calculation added');
