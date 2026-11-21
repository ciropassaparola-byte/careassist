const fs = require('fs');

const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

const targetForm = `<div class="setup-form">
                <div class="input-group">
                    <label>Titolo, Nome e Cognome</label>`;
const repForm = `<div class="setup-form">
                <div class="input-group">
                    <label>Avatar / Genere</label>
                    <select id="setup-doc-avatar" style="font-size:1.2rem; cursor:pointer;">
                        <option value="👨‍⚕️">👨‍⚕️ Uomo</option>
                        <option value="👩‍⚕️" selected>👩‍⚕️ Donna</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Titolo, Nome e Cognome</label>`;
html = html.replace(targetForm, repForm);
fs.writeFileSync(indexFile, html, 'utf8');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const targetCheck = `document.getElementById('ui-doc-name').innerText = doc.name;`;
const repCheck = `document.getElementById('ui-doc-name').innerText = doc.name;
        if(doc.avatar) document.querySelector('.doc-avatar').innerText = doc.avatar;`;
js = js.replace(targetCheck, repCheck);

const targetSave = `let clinic = document.getElementById('setup-doc-clinic').value;`;
const repSave = `let clinic = document.getElementById('setup-doc-clinic').value;
    let avatar = document.getElementById('setup-doc-avatar').value;`;
js = js.replace(targetSave, repSave);

const targetDoc = `let doc = { name, spec, clinic };`;
const repDoc = `let doc = { name, spec, clinic, avatar };`;
js = js.replace(targetDoc, repDoc);

fs.writeFileSync(jsFile, js, 'utf8');

console.log('Update Complete');
