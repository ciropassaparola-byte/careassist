const fs = require('fs');

const indexFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/index.html';
let html = fs.readFileSync(indexFile, 'utf8');

// 1. Add period dates to UI
const targetAnagrafica = `<div class="input-group full-width">
                            <label>Diagnosi / Patologia Principale</label>`;
const newAnagrafica = `<div class="input-group">
                            <label>Valido dal (Inizio)</label>
                            <input type="date" id="period-start">
                        </div>
                        <div class="input-group">
                            <label>al (Fine)</label>
                            <input type="date" id="period-end">
                        </div>
                        <div class="input-group full-width">
                            <label>Diagnosi / Patologia Principale</label>`;
html = html.replace(targetAnagrafica, newAnagrafica);

// 2. Change Stampa button to call a wrapper function
const targetBtn = `onclick="window.print()"`;
const repBtn = `onclick="prepareAndPrint()"`;
html = html.replace(targetBtn, repBtn);

// 3. Update the print header to include patient and period
const targetPrintHeader = `<div class="print-header" style="display:none; text-align:center; margin-bottom:30px; border-bottom:2px solid #000; padding-bottom:10px;">
                <h1 style="font-size:24px; text-transform:uppercase; letter-spacing:2px;">Referto Terapeutico Nutrizionale</h1>
                <p id="print-doc-info" style="font-size:16px; margin-top:5px;"></p>
            </div>`;
const repPrintHeader = `<div class="print-header" style="display:none;">
                <h1 style="font-size:20px; text-transform:uppercase; letter-spacing:2px; margin-bottom:5px;">Referto Terapeutico Nutrizionale</h1>
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:10px; border-top:1px solid #000; padding-top:5px;">
                    <div><strong>Medico:</strong> <span id="print-doc-info"></span></div>
                    <div><strong>Paziente:</strong> <span id="print-pat-info"></span></div>
                    <div><strong>Periodo:</strong> <span id="print-period-info"></span></div>
                </div>
            </div>`;
html = html.replace(targetPrintHeader, repPrintHeader);

fs.writeFileSync(indexFile, html, 'utf8');

// 4. Update JS to set these fields before printing
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const targetCheckPrint = `let pInfo = document.getElementById('print-doc-info');
        if(pInfo) pInfo.innerText = doc.name + " - " + doc.spec + " (" + doc.clinic + ")";`;
js = js.replace(targetCheckPrint, `// Doctor info will be set in prepareAndPrint`);

const printFunc = `
function prepareAndPrint() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    let docName = "Medico non specificato";
    if (saved) {
        let doc = JSON.parse(saved);
        docName = doc.name;
    }
    
    let patName = document.getElementById('patient-name').value || "Non specificato";
    let dateStart = document.getElementById('period-start').value || "...";
    let dateEnd = document.getElementById('period-end').value || "...";
    
    // Formatta le date se presenti
    if(dateStart !== "...") { let d = new Date(dateStart); dateStart = d.toLocaleDateString('it-IT'); }
    if(dateEnd !== "...") { let d = new Date(dateEnd); dateEnd = d.toLocaleDateString('it-IT'); }
    
    document.getElementById('print-doc-info').innerText = docName;
    document.getElementById('print-pat-info').innerText = patName;
    document.getElementById('print-period-info').innerText = "dal " + dateStart + " al " + dateEnd;
    
    window.print();
}
`;
js = js + '\n' + printFunc;
fs.writeFileSync(jsFile, js, 'utf8');

// 5. Update CSS to make header fixed repeating
const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const cssTarget = `.print-header { display: block !important; }`;
const cssRep = `.print-header { 
        display: block !important; 
        position: fixed; 
        top: 0; 
        left: 0; 
        right: 0; 
        background: white; 
        border-bottom: 2px solid #000;
        padding-bottom: 10px;
        z-index: 1000;
    }
    /* Add top margin to body so content doesn't hide behind fixed header */
    body { padding-top: 80px; }`;
css = css.replace(cssTarget, cssRep);
fs.writeFileSync(cssFile, css, 'utf8');

console.log('Repeating Header Added');
