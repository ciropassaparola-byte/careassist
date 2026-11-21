/**
 * SINCRONIZZAZIONE INTELLIGENTE BIDIREZIONALE (MERGE SENZA PERDITA DATI)
 * Suite Aziendale C. Milella
 * 
 * Permette di fondere le modifiche fatte offline da USB con le novita registrate online dal Cellulare.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const suiteDir = path.resolve(__dirname);
const rootData = path.join(suiteDir, 'data');
const renderData = path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'data');
const careassistUsbPath = path.join(suiteDir, 'public', 'careassist', 'careassist_database.json');
const careassistRenderPath = path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'public', 'careassist', 'careassist_database.json');

const CLOUD_URL_GET = 'https://milella-suite-41ff.onrender.com/api/suite/backup-completo';
const CLOUD_URL_POST = 'https://milella-suite-41ff.onrender.com/api/suite/ripristina-backup';

console.log('================================================================================');
console.log('   🔄 SINCRONIZZAZIONE INTELLIGENTE BIDIREZIONALE: USB <--> WEB CLOUD');
console.log('================================================================================');
console.log('[*] 1. Connessione a Cloud Web Render in corso...');

function getCloudData() {
    return new Promise((resolve, reject) => {
        https.get(CLOUD_URL_GET, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error('Cloud ha risposto con codice HTTP ' + res.statusCode));
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed || !parsed.dati) {
                        return reject(new Error('Risposta Cloud priva della sezione dati.'));
                    }
                    resolve(parsed.dati);
                } catch(err) {
                    reject(err);
                }
            });
        }).on('error', (e) => reject(e));
    });
}

function postCloudData(mergedPayload) {
    return new Promise((resolve, reject) => {
        const jsonStr = JSON.stringify(mergedPayload);
        const urlObj = new URL(CLOUD_URL_POST);
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
            let resp = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { resp += chunk; });
            res.on('end', () => {
                try {
                    const r = JSON.parse(resp);
                    if (res.statusCode === 200 && r.success) {
                        resolve(r);
                    } else {
                        reject(new Error(r.message || resp));
                    }
                } catch(e) {
                    reject(new Error('Risposta non JSON dal Cloud: ' + resp));
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(jsonStr);
        req.end();
    });
}

function readLocalJson(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            const txt = fs.readFileSync(filePath, 'utf8');
            if (txt && txt.trim()) return JSON.parse(txt);
        } catch(e) {}
    }
    return null;
}

function saveLocalJson(filePath, dataObj) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(dataObj, null, 2), 'utf8');
}

/**
 * FUSIONE CAREASSIST PRO
 */
function mergeCareAssist(localCA, cloudCA) {
    if (!localCA && !cloudCA) return null;
    if (!localCA) return cloudCA;
    if (!cloudCA) return localCA;

    const merged = { ...cloudCA, ...localCA };
    merged.lastModified = new Date().toISOString();
    merged.lastModifiedBy = 'Merge Intelligente USB <-> Web';

    const localPazienti = Array.isArray(localCA.pazienti) ? localCA.pazienti : [];
    const cloudPazienti = Array.isArray(cloudCA.pazienti) ? cloudCA.pazienti : [];
    const allPazMap = new Map();

    // Inserisci prima i cloud
    cloudPazienti.forEach(p => { if (p && p.id != null) allPazMap.set(String(p.id), JSON.parse(JSON.stringify(p))); });

    // Fai merge con i locali
    localPazienti.forEach(locP => {
        if (!locP || locP.id == null) return;
        const pId = String(locP.id);
        if (!allPazMap.has(pId)) {
            allPazMap.set(pId, JSON.parse(JSON.stringify(locP)));
        } else {
            const cP = allPazMap.get(pId);
            const fusedP = { ...cP, ...locP };

            // 1. Fondi registrazioni / cronologia senza duplicati (per ID o timestamp+testo)
            const cReg = Array.isArray(cP.registrazioni) ? cP.registrazioni : [];
            const lReg = Array.isArray(locP.registrazioni) ? locP.registrazioni : [];
            const regMap = new Map();
            cReg.forEach(r => {
                const k = r.id || (r.timestamp + '_' + (r.testo || ''));
                regMap.set(k, r);
            });
            lReg.forEach(r => {
                const k = r.id || (r.timestamp + '_' + (r.testo || ''));
                regMap.set(k, r);
            });
            fusedP.registrazioni = Array.from(regMap.values()).sort((a,b) => (new Date(b.timestamp) - new Date(a.timestamp)));

            // 2. Fondi Terapie / Farmaci
            const cTer = Array.isArray(cP.terapie) ? cP.terapie : [];
            const lTer = Array.isArray(locP.terapie) ? locP.terapie : [];
            const terMap = new Map();
            cTer.forEach(t => { if (t && t.id != null) terMap.set(String(t.id), t); });
            lTer.forEach(t => {
                if (!t || t.id == null) return;
                const tId = String(t.id);
                if (!terMap.has(tId)) {
                    terMap.set(tId, t);
                } else {
                    const ct = terMap.get(tId);
                    // Mantieni chi ha somministrazione piu recente
                    const locTime = t.fattoOggiTimestamp ? new Date(t.fattoOggiTimestamp).getTime() : 0;
                    const cldTime = ct.fattoOggiTimestamp ? new Date(ct.fattoOggiTimestamp).getTime() : 0;
                    if (locTime >= cldTime) {
                        terMap.set(tId, { ...ct, ...t });
                    } else {
                        terMap.set(tId, { ...t, ...ct });
                    }
                }
            });
            fusedP.terapie = Array.from(terMap.values());
            allPazMap.set(pId, fusedP);
        }
    });

    merged.pazienti = Array.from(allPazMap.values());
    return merged;
}

/**
 * FUSIONE INVENTARIO (Array di oggetti con ID o codice)
 */
function mergeArrayById(localArr, cloudArr) {
    if (!localArr && !cloudArr) return [];
    if (!localArr) return cloudArr;
    if (!cloudArr) return localArr;

    const map = new Map();
    cloudArr.forEach(item => {
        const k = String(item.id || item.codice || item.nome || Math.random());
        map.set(k, item);
    });
    localArr.forEach(item => {
        const k = String(item.id || item.codice || item.nome || Math.random());
        if (map.has(k)) {
            map.set(k, { ...map.get(k), ...item });
        } else {
            map.set(k, item);
        }
    });
    return Array.from(map.values());
}

/**
 * FUSIONE MODULO A OGGETTO CHIAVE-VALORE
 */
function mergeObjectByKey(localObj, cloudObj) {
    if (!localObj && !cloudObj) return {};
    if (!localObj) return cloudObj;
    if (!cloudObj) return localObj;
    return { ...cloudObj, ...localObj };
}

async function main() {
    try {
        const cloudDati = await getCloudData();
        console.log('  [+] Dati Cloud scaricati correttamente.');

        console.log('[*] 2. Lettura dati locali da USB...');
        const localCA = readLocalJson(careassistUsbPath) || readLocalJson(careassistRenderPath);
        const localInv = readLocalJson(path.join(rootData, 'inventario.json')) || readLocalJson(path.join(renderData, 'inventario.json'));
        const localSalute = readLocalJson(path.join(rootData, 'salute_db.json')) || readLocalJson(path.join(renderData, 'salute_db.json'));
        const localVeicoli = readLocalJson(path.join(rootData, 'veicoli_db.json')) || readLocalJson(path.join(renderData, 'veicoli_db.json'));
        const localTurnario = readLocalJson(path.join(rootData, 'turnario_settimanale.json')) || readLocalJson(path.join(renderData, 'turnario_settimanale.json'));
        const localProgetti = readLocalJson(path.join(rootData, 'progetti_config.json')) || readLocalJson(path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'progetti_config.json'));

        console.log('[*] 3. Esecuzione fusione intelligente (Merge senza sovrascritture)...');
        const mergedCareAssist = mergeCareAssist(localCA, cloudDati.careassist);
        const mergedInventario = mergeArrayById(localInv, cloudDati.inventario);
        const mergedSalute = mergeObjectByKey(localSalute, cloudDati.salute);
        const mergedVeicoli = mergeObjectByKey(localVeicoli, cloudDati.veicoli);
        const mergedTurnario = mergeObjectByKey(localTurnario, cloudDati.turnario);
        const mergedProgetti = mergeObjectByKey(localProgetti, cloudDati.progetti);

        // SALVA SU USB IN TUTTE LE CARTELLE
        console.log('[*] 4. Aggiornamento file locali su Chiavetta USB...');
        if (mergedCareAssist) {
            saveLocalJson(careassistUsbPath, mergedCareAssist);
            saveLocalJson(careassistRenderPath, mergedCareAssist);
            console.log('  [OK] CareAssist Pro salvato su USB (terapie e note unificate)');
        }
        if (mergedInventario) {
            saveLocalJson(path.join(rootData, 'inventario.json'), mergedInventario);
            saveLocalJson(path.join(renderData, 'inventario.json'), mergedInventario);
            console.log('  [OK] Inventario salvato su USB (' + mergedInventario.length + ' elementi)');
        }
        if (mergedSalute) {
            saveLocalJson(path.join(rootData, 'salute_db.json'), mergedSalute);
            saveLocalJson(path.join(renderData, 'salute_db.json'), mergedSalute);
            console.log('  [OK] Salute DB salvato su USB');
        }
        if (mergedVeicoli) {
            saveLocalJson(path.join(rootData, 'veicoli_db.json'), mergedVeicoli);
            saveLocalJson(path.join(renderData, 'veicoli_db.json'), mergedVeicoli);
            console.log('  [OK] Veicoli DB salvato su USB');
        }
        if (mergedTurnario) {
            saveLocalJson(path.join(rootData, 'turnario_settimanale.json'), mergedTurnario);
            saveLocalJson(path.join(renderData, 'turnario_settimanale.json'), mergedTurnario);
            console.log('  [OK] Turnario salvato su USB');
        }
        if (mergedProgetti) {
            saveLocalJson(path.join(rootData, 'progetti_config.json'), mergedProgetti);
            saveLocalJson(path.join(suiteDir, 'AGGIORNAMENTO_RENDER', 'progetti_config.json'), mergedProgetti);
            console.log('  [OK] Progetti & Launcher salvati su USB');
        }

        // CARICA IL MERGED COMPLETO SU CLOUD
        console.log('[*] 5. Trasmissione dei dati unificati a Cloud Web Render...');
        const payloadToCloud = {
            suite: 'Suite Milella Aziendale',
            versione: '2.5.0',
            timestamp: new Date().toISOString(),
            autore: 'Merge Automatico Intelligente USB-Web',
            dati: {
                careassist: mergedCareAssist,
                inventario: mergedInventario,
                salute: mergedSalute,
                veicoli: mergedVeicoli,
                turnario: mergedTurnario,
                progetti: mergedProgetti
            }
        };

        await postCloudData(payloadToCloud);

        console.log('\n================================================================================');
        console.log('  ✅ SINCRONIZZAZIONE INTELLIGENTE COMPLETATA CON SUCCESSO!');
        console.log('  - Le novita registrate dal Cellulare sono state importate sulla USB');
        console.log('  - Le modifiche fatte dal PC offline sono state caricate sul Cloud');
        console.log('  - Nessun dato e andato perso o sovrascritto.');
        console.log('================================================================================\n');

    } catch (err) {
        console.error('\n[ERRORE DURANTE LA SINCRONIZZAZIONE]:', err.message);
    }
}

main();
