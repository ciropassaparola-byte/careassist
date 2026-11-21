const fs = require('fs');

const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

const targetAge = `<div class="input-group">
                            <label>Età</label>
                            <input type="number" id="patient-age" placeholder="Es. 55">
                        </div>`;
const repAge = `<div class="input-group">
                            <label>Data di Nascita <span id="calculated-age" style="color:var(--primary); font-weight:600; margin-left:5px;"></span></label>
                            <input type="date" id="patient-dob" onchange="calculateAge()">
                        </div>`;

html = html.replace(targetAge, repAge);
fs.writeFileSync(indexFile, html, 'utf8');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const calcAgeFunc = `
function calculateAge() {
    let dob = document.getElementById('patient-dob').value;
    if (dob) {
        let birthDate = new Date(dob);
        let today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        let m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        document.getElementById('calculated-age').innerText = '(' + age + ' anni)';
    } else {
        document.getElementById('calculated-age').innerText = '';
    }
}
`;

js = js + '\n' + calcAgeFunc;
fs.writeFileSync(jsFile, js, 'utf8');

console.log('Update Complete');
