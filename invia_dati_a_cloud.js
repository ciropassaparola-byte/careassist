const https = require('https');
const fs = require('fs');
const path = require('path');

const targetUrl = 'https://milella-suite-41ff.onrender.com/api/suite/ripristina-backup';
const suiteDir = path.resolve(__dirname);

console.log('[*] Raccolta dati da Chiavetta USB in corso...');

const rootData = path.join(suiteDir, 'data');
const renderData = path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'data');

function readJsonFirst(files) {
    for (const f of files) {
        if (fs.existsSync(f)) {
            try {
                const txt = fs.readFileSync(f, 'utf8');
                if (txt && txt.trim()) return JSON.parse(txt);
            } catch(e) {}
        }
    }
    return null;
}

const turnario = readJsonFirst([
    path.join(renderData, 'turnario_settimanale.json'),
    path.join(rootData, 'turnario_settimanale.json')
]);

const inventario = readJsonFirst([
    path.join(renderData, 'inventario.json'),
    path.join(rootData, 'inventario.json')
]);

const salute = readJsonFirst([
    path.join(renderData, 'salute_db.json'),
    path.join(rootData, 'salute_db.json')
]);

const veicoli = readJsonFirst([
    path.join(renderData, 'veicoli_db.json'),
    path.join(rootData, 'veicoli_db.json')
]);

const progetti = readJsonFirst([
    path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'progetti_config.json'),
    path.join(rootData, 'progetti_config.json')
]);

const careassist = readJsonFirst([
    path.join(suiteDir, 'public', 'careassist', 'careassist_database.json'),
    path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'public', 'careassist', 'careassist_database.json'),
    path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'CareAssist_Pro', 'careassist_database.json'),
    path.join(suiteDir, 'CareAssist_Pro', 'careassist_database.json')
]);

const payload = {
    suite: "Suite Milella Aziendale",
    versione: "2.5.0",
    timestamp: new Date().toISOString(),
    autore: "Ciro Milella (Admin)",
    dati: {}
};

let count = 0;
if (turnario) { payload.dati.turnario = turnario; count++; console.log('  [+] Turnario pronto'); }
if (inventario) { payload.dati.inventario = inventario; count++; console.log('  [+] Inventario pronto'); }
if (salute) { payload.dati.salute = salute; count++; console.log('  [+] Salute pronto'); }
if (veicoli) { payload.dati.veicoli = veicoli; count++; console.log('  [+] Veicoli pronto'); }
if (progetti) { payload.dati.progetti = progetti; count++; console.log('  [+] Progetti pronto'); }
if (careassist) { payload.dati.careassist = careassist; count++; console.log('  [+] CareAssist pronto'); }

console.log(`[*] ${count} moduli letti dalla chiavetta. Invio a Cloud Render (MongoDB Atlas)...`);

const jsonStr = JSON.stringify(payload);
const urlObj = new URL(targetUrl);

const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr)
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.setEncoding('utf8');
    res.on('data', chunk => { responseData += chunk; });
    res.on('end', () => {
        try {
            const resJson = JSON.parse(responseData);
            if (res.statusCode === 200 && resJson.success) {
                console.log('\n================================================================================');
                console.log(' [OK] ALLINEAMENTO COMPLETATO CON SUCCESSO!');
                console.log('      Il Web Cloud (Render / MongoDB Atlas) ora contiene esattamente i dati della USB!');
                console.log('================================================================================\n');
            } else {
                console.error('[ERRORE CLOUD]', resJson.message || responseData);
            }
        } catch(e) {
            console.error('[RISPOSTA NON JSON]', responseData);
        }
    });
});

req.on('error', (e) => {
    console.error('[ERRORE CONNESSIONE]', e.message);
});

req.write(jsonStr);
req.end();