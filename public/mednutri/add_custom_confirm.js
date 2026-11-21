const fs = require('fs');

// 1. UPDATE HTML
const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

const confirmHtml = `
<!-- Custom Confirm Modal -->
<div id="custom-confirm" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); z-index:10000; justify-content:center; align-items:center; backdrop-filter: blur(4px);">
    <div style="background:white; padding:30px; border-radius:16px; width:400px; max-width:90%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); text-align:center; transform: translateY(-20px); animation: modalIn 0.3s ease-out forwards;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto 20px auto;">
            <i class="fas fa-exclamation-triangle">⚠️</i>
        </div>
        <h3 style="font-size:1.25rem; color:#1e293b; margin-bottom:10px; font-weight:600;">Conferma Eliminazione</h3>
        <p id="custom-confirm-message" style="color:#64748b; font-size:0.95rem; margin-bottom:25px;">Sei sicuro?</p>
        <div style="display:flex; justify-content:center; gap:15px;">
            <button id="custom-confirm-cancel" style="padding:10px 20px; border-radius:8px; border:1px solid #cbd5e1; background:white; color:#475569; font-weight:500; cursor:pointer; transition:all 0.2s;">Annulla</button>
            <button id="custom-confirm-ok" style="padding:10px 20px; border-radius:8px; border:none; background:#ef4444; color:white; font-weight:500; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 6px -1px rgba(239,68,68,0.2);">Elimina Definitivamente</button>
        </div>
    </div>
</div>
`;

if(!html.includes('id="custom-confirm"')) {
    html = html.replace('</body>', confirmHtml + '\n</body>');
    fs.writeFileSync(indexFile, html, 'utf8');
    console.log('HTML updated');
}


// 2. UPDATE CSS
const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const confirmCss = `
/* Custom Confirm Modal Animations & Hovers */
@keyframes modalIn {
    to { transform: translateY(0); opacity: 1; }
}
#custom-confirm-cancel:hover { background: #f8fafc; color: #0f172a; border-color:#94a3b8; }
#custom-confirm-ok:hover { background: #dc2626; box-shadow:0 10px 15px -3px rgba(239,68,68,0.3); }
`;

if(!css.includes('#custom-confirm-cancel:hover')) {
    fs.writeFileSync(cssFile, css + '\n' + confirmCss, 'utf8');
    console.log('CSS updated');
}


// 3. UPDATE JS
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const oldDelete = /function deletePatient\(name\) \{[\s\S]*?\}\n\}/;

const newDelete = `function deletePatient(name) {
    let modal = document.getElementById('custom-confirm');
    document.getElementById('custom-confirm-message').innerHTML = \`Vuoi eliminare definitivamente <strong>\${name}</strong> dall'archivio?<br><span style="font-size:0.8rem; color:#94a3b8; display:block; margin-top:5px;">Questa azione è irreversibile.</span>\`;
    
    modal.style.display = 'flex';
    
    document.getElementById('custom-confirm-cancel').onclick = function() {
        modal.style.display = 'none';
    };
    
    document.getElementById('custom-confirm-ok').onclick = function() {
        localStorage.removeItem('mednutri_pat_' + name.toLowerCase());
        openArchive(); // Ricarica la lista
        showToast(\`Paziente eliminato con successo.\`, "success");
        modal.style.display = 'none';
    };
}`;

if(js.match(oldDelete)) {
    js = js.replace(oldDelete, newDelete);
    fs.writeFileSync(jsFile, js, 'utf8');
    console.log('JS updated');
}
