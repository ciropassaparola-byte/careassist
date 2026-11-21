const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const missingFuncs = `
// FUNZIONI PROFILO MEDICO
function checkDoctorProfile() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    if (saved) {
        let doc = JSON.parse(saved);
        let avatarEl = document.querySelector('.doc-avatar');
        let nameEl = document.querySelector('.doc-info h3');
        let specEl = document.querySelector('.doc-info p');
        if(avatarEl) avatarEl.innerText = doc.avatar;
        if(nameEl) nameEl.innerText = doc.name;
        if(specEl) specEl.innerText = doc.spec;
        
        let setupModal = document.getElementById('setup-modal');
        let mainApp = document.getElementById('main-app');
        if(setupModal) setupModal.style.display = 'none';
        if(mainApp) mainApp.style.display = 'grid';
    } else {
        let setupModal = document.getElementById('setup-modal');
        let mainApp = document.getElementById('main-app');
        if(setupModal) setupModal.style.display = 'flex';
        if(mainApp) mainApp.style.display = 'none';
    }
}

function saveDoctorProfile() {
    let avatar = document.getElementById('setup-doc-avatar').value;
    let name = document.getElementById('setup-doc-name').value.trim();
    let spec = document.getElementById('setup-doc-spec').value.trim();
    let clinic = document.getElementById('setup-doc-clinic').value.trim();
    
    if(!name || !spec) {
        if (typeof showToast !== 'undefined') showToast('Inserisci almeno Titolo, Nome e Specializzazione.', 'error');
        else alert('Inserisci almeno Titolo, Nome e Specializzazione.');
        return;
    }
    
    let doc = { avatar, name, spec, clinic };
    localStorage.setItem('mednutri_doc_profile', JSON.stringify(doc));
    
    checkDoctorProfile();
    if (typeof showToast !== 'undefined') showToast('Profilo Medico salvato con successo!', 'success');
}

function resetDoctorProfile() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    if(saved) {
        let doc = JSON.parse(saved);
        document.getElementById('setup-doc-avatar').value = doc.avatar;
        document.getElementById('setup-doc-name').value = doc.name;
        document.getElementById('setup-doc-spec').value = doc.spec;
        document.getElementById('setup-doc-clinic').value = doc.clinic;
    }
    let setupModal = document.getElementById('setup-modal');
    if(setupModal) setupModal.style.display = 'flex';
}
`;

fs.writeFileSync(jsFile, js + '\n' + missingFuncs, 'utf8');
console.log('Doctor profile functions restored.');
