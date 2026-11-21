const fs = require('fs');

const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

const targetBtn = `<button class="btn-secondary" onclick="alert('Funzione Stampa PDF in arrivo!')">📄 Stampa per Paziente</button>`;
const repBtn = `<button class="btn-secondary print-btn" onclick="window.print()">📄 Stampa per Paziente (PDF)</button>`;
html = html.replace(targetBtn, repBtn);

// Add a print-only header
const targetMain = `<main class="main-content">`;
const repMain = `<main class="main-content">
            <div class="print-header" style="display:none; text-align:center; margin-bottom:30px; border-bottom:2px solid #000; padding-bottom:10px;">
                <h1 style="font-size:24px; text-transform:uppercase; letter-spacing:2px;">Referto Terapeutico Nutrizionale</h1>
                <p id="print-doc-info" style="font-size:16px; margin-top:5px;"></p>
            </div>`;
html = html.replace(targetMain, repMain);
fs.writeFileSync(indexFile, html, 'utf8');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

// Update checkDoctorProfile to set print header info
const targetCheck = `document.getElementById('ui-doc-clinic').innerText = doc.clinic;`;
const repCheck = `document.getElementById('ui-doc-clinic').innerText = doc.clinic;
        let pInfo = document.getElementById('print-doc-info');
        if(pInfo) pInfo.innerText = doc.name + " - " + doc.spec + " (" + doc.clinic + ")";`;
js = js.replace(targetCheck, repCheck);
fs.writeFileSync(jsFile, js, 'utf8');

const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const printCSS = `
/* --- REGOLE DI STAMPA PDF --- */
@media print {
    body { background: white; color: black; min-height: auto; }
    .sidebar, .topbar, .btn-primary, .btn-secondary, .setup-overlay { display: none !important; }
    
    .app-container { height: auto; display: block; }
    .main-content { padding: 0; overflow: visible; }
    
    .print-header { display: block !important; }
    
    .glass-card { 
        border: 1px solid #000; 
        box-shadow: none; 
        border-radius: 0;
        background: white;
        margin-bottom: 20px;
        page-break-inside: avoid;
    }
    
    .dashboard-grid { 
        display: block; 
    }
    
    .patient-card, .rules-card { 
        margin-bottom: 20px;
        padding: 15px;
    }
    
    .input-group input, .input-group select {
        border: none;
        border-bottom: 1px solid #000;
        border-radius: 0;
        padding: 5px 0;
        background: transparent;
        appearance: none;
        -webkit-appearance: none;
    }
    
    .diet-table { border-collapse: collapse; width: 100%; }
    .diet-table th, .diet-table td {
        border: 1px solid #000 !important;
        border-radius: 0 !important;
        padding: 8px !important;
        font-size: 12px;
    }
    
    .rule-item {
        border: 1px solid #000;
        border-left: 5px solid #000;
    }
    
    @page {
        margin: 1.5cm;
        size: A4 portrait;
    }
}
`;
css = css + '\n' + printCSS;
fs.writeFileSync(cssFile, css, 'utf8');

console.log('Print module added');
