const fs = require('fs');

const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const toastCss = `
/* Toast Notifications */
#toast-container {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.toast {
    background: white;
    color: #1e293b;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    font-size: 0.95rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    border-left: 5px solid var(--primary);
    max-width: 400px;
}

.toast.success { border-left-color: #22c55e; }
.toast.error { border-left-color: #ef4444; }
.toast.warning { border-left-color: #f59e0b; }

.toast-icon {
    font-size: 1.2rem;
}

@keyframes slideIn {
    from { transform: translateX(120%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(120%); opacity: 0; }
}
`;

if(!css.includes('#toast-container')) {
    fs.writeFileSync(cssFile, css + '\n' + toastCss, 'utf8');
    console.log('CSS updated');
}

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const toastJs = `
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = \`toast \${type}\`;
    
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    if(type === 'warning') icon = '⚠️';
    
    toast.innerHTML = \`<span class="toast-icon">\${icon}</span> <span>\${message}</span>\`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
`;

if(!js.includes('function showToast')) {
    js = js + '\n' + toastJs;
    js = js.replace('alert("Inserisci almeno il tuo Nome e Titolo.");', 'showToast("Inserisci almeno il tuo Nome e Titolo.", "error");');
    js = js.replace('alert("Hai selezionato \'Altra Patologia\'. Inserisci i pasti manualmente nella tabella tenendo conto dei cibi che hai specificato di evitare.");', 'showToast("Hai selezionato \'Altra Patologia\'. Inserisci i pasti manualmente.", "warning");');
    js = js.replace('alert(`Terapia settimanale generata con successo per ${name}, ottimizzata per: ${pat !== \'nessuna\' ? pathologyDB[pat].name : \'Mantenimento Base\'}.`);', 'showToast(`Terapia generata per ${name}: ${pat !== \'nessuna\' ? pathologyDB[pat].name : \'Mantenimento Base\'}.`, "success");');
    
    fs.writeFileSync(jsFile, js, 'utf8');
    console.log('JS updated');
}
