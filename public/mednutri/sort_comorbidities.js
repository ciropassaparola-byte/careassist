const fs = require('fs');
const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const targetFunc = /function initComorbidities\(\) \{[\s\S]*?\}\n\}/m;

const newFunc = `function initComorbidities() {
    const container = document.getElementById('comorbidities-container');
    container.innerHTML = '';
    
    const excludedKeys = ['nessuna', 'altro'];
    
    let sortedKeys = Object.keys(pathologyDB).filter(k => !excludedKeys.includes(k));
    sortedKeys.sort((a, b) => pathologyDB[a].name.localeCompare(pathologyDB[b].name));
    
    sortedKeys.forEach(key => {
        let label = document.createElement('label');
        label.className = 'com-checkbox';
        label.innerHTML = \`<input type="checkbox" value="\${key}" onchange="updateAnalysis()"> \${pathologyDB[key].name}\`;
        container.appendChild(label);
    });
}`;

js = js.replace(targetFunc, newFunc);
fs.writeFileSync(jsFile, js, 'utf8');
console.log('Comorbidities sorted');
