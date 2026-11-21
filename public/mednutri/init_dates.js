const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const dateFunc = `
function initDates() {
    const today = new Date();
    document.getElementById('period-start').valueAsDate = today;
    
    // Default validità 30 giorni
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    document.getElementById('period-end').valueAsDate = nextMonth;
}
`;

const targetInit = `window.addEventListener('DOMContentLoaded', () => {`;
const repInit = `window.addEventListener('DOMContentLoaded', () => {
    initDates();`;

js = js + '\n' + dateFunc;
js = js.replace(targetInit, repInit);

fs.writeFileSync(jsFile, js, 'utf8');
console.log('Dates initialized');
