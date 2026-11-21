const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const targetLoop = /    \/\/ Ciascun giorno ha il suo pasto unico![\s\S]*?\}\);/;

const newLoop = `    // Mescola (Shuffle) casualmente le opzioni così ogni 'Generazione' crea una dieta diversa
    function shuffle(array) {
        let arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    const shColazione = shuffle(selMenu.colazione);
    const shPranzo = shuffle(selMenu.pranzo);
    const shSpuntino = shuffle(selMenu.spuntino);
    const shCena = shuffle(selMenu.cena);

    // Ciascun giorno ha il suo pasto unico e randomizzato!
    rows.forEach((r, index) => {
        let tds = r.querySelectorAll('td');
        
        let cIdx = index % shColazione.length;
        let pIdx = index % shPranzo.length;
        let sIdx = index % shSpuntino.length;
        let ceIdx = index % shCena.length;
        
        tds[1].innerText = shColazione[cIdx];
        tds[2].innerText = shPranzo[pIdx];
        tds[3].innerText = shSpuntino[sIdx];
        tds[4].innerText = shCena[ceIdx];
        
        tds[5].innerText = \`Protocollo \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Base'}\`;
    });`;

if (js.match(targetLoop)) {
    js = js.replace(targetLoop, newLoop);
    fs.writeFileSync(jsFile, js, 'utf8');
    console.log('JS updated successfully for shuffling diets!');
}
