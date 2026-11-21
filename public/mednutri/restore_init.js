const fs = require('fs');
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const initTableFunc = `
const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
function initTable() {
    const tbody = document.getElementById('diet-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    daysOfWeek.forEach(day => {
        let tr = document.createElement('tr');
        tr.innerHTML = \`
            <td><strong>\${day}</strong></td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
        \`;
        tbody.appendChild(tr);
    });
}
`;

if(!js.includes('function initTable()')) {
    js = js.replace(/window\.addEventListener\('DOMContentLoaded'/, initTableFunc + '\nwindow.addEventListener(\'DOMContentLoaded\'');
    js = js.replace(/tds\[5\]\.innerText = `Protocollo.*?`;/g, '');
    fs.writeFileSync(jsFile, js, 'utf8');
    console.log('initTable restored!');
} else {
    console.log('initTable already exists.');
}
