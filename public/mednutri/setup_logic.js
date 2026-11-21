const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const setupLogic = `
function checkDoctorProfile() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    if (saved) {
        let doc = JSON.parse(saved);
        document.getElementById('ui-doc-name').innerText = doc.name;
        document.getElementById('ui-doc-spec').innerText = doc.spec;
        document.getElementById('ui-doc-clinic').innerText = doc.clinic;
        
        document.getElementById('doctor-setup-modal').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
    } else {
        document.getElementById('doctor-setup-modal').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
}

function saveDoctorProfile() {
    let name = document.getElementById('setup-doc-name').value;
    let spec = document.getElementById('setup-doc-spec').value;
    let clinic = document.getElementById('setup-doc-clinic').value;
    
    if(!name) { alert("Inserisci almeno il tuo Nome e Titolo."); return; }
    
    let doc = { name, spec, clinic };
    localStorage.setItem('mednutri_doc_profile', JSON.stringify(doc));
    checkDoctorProfile();
}

function resetDoctorProfile() {
    localStorage.removeItem('mednutri_doc_profile');
    checkDoctorProfile();
}
`;

js = setupLogic + '\n' + js;
js = js.replace("window.addEventListener('DOMContentLoaded', () => {", "window.addEventListener('DOMContentLoaded', () => {\n    checkDoctorProfile();");

fs.writeFileSync(jsFile, js, 'utf8');
console.log('Update Complete');
