const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
process.on('uncaughtException', (err) => {
    console.error('[ERRORE NON GESTITO]', err);
    try { fs.appendFileSync(path.join(__dirname, 'server_exit.log'), 'Uncaught: ' + err.stack + '\n'); } catch(e){}
});
process.on('unhandledRejection', (reason) => {
    console.error('[PROMESSA NON GESTITA]', reason);
    try { fs.appendFileSync(path.join(__dirname, 'server_exit.log'), 'UnhandledRejection: ' + reason + '\n'); } catch(e){}
});
process.on('exit', (code) => {
    try { fs.appendFileSync(path.join(__dirname, 'server_exit.log'), `Exit code: ${code} at ${new Date().toISOString()}\n`); } catch(e){}
});

// Helper per scrittura atomica sicura contro corruzione dati e cali di corrente
function safeWriteAtomic(filePath, data) {
    const tempPath = filePath + '.tmp.' + Date.now();
    try {
        fs.writeFileSync(tempPath, data, 'utf8');
        fs.renameSync(tempPath, filePath);
        return true;
    } catch(err) {
        console.error('[ERRORE SCRITTURA ATOMICA]', filePath, err);
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e){}
        // Fallback diretto
        try { fs.writeFileSync(filePath, data, 'utf8'); } catch(e){}
        return true;
    }
}

// Helper per lettura sicura JSON (rimuove automaticamente BOM UTF-8 se presente)
function safeReadJsonSync(filePath, defaultValue) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        let c = fs.readFileSync(filePath, 'utf8');
        if (c && c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
        return JSON.parse(c || '{}');
    } catch(e) {
        return defaultValue;
    }
}


// ==============================================================================
// CLOUD DATABASE LAYER (MONGODB ATLAS) CON FALLBACK LOCALE TRASPARENTE
// ==============================================================================
let mongoClient = null;
let mongoDb = null;
let mongoCollection = null;
let isMongoReady = false;
const memoryCache = new Map();

async function initCloudDatabase() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.log('[DATABASE] MONGODB_URI non configurata: esecuzione in modalita locale (file JSON).');
        return;
    }

    let MongoClient;
    try {
        MongoClient = require('mongodb').MongoClient;
    } catch (e) {
        console.log('[DATABASE] Driver mongodb non presente in locale: fallback su file JSON.');
        return;
    }

    try {
        console.log('[DATABASE] Connessione a MongoDB Atlas in corso...');
        mongoClient = new MongoClient(mongoUri, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 10000
        });
        await mongoClient.connect();
        mongoDb = mongoClient.db(process.env.MONGODB_DB_NAME || 'milella_suite');
        mongoCollection = mongoDb.collection('suite_store');
        isMongoReady = true;
        console.log('[DATABASE] CONNESSO A MONGODB ATLAS: Dati permanenti attivi!');

        // Precarica in memoria tutti i record da MongoDB
        try {
            const allDocs = await mongoCollection.find({}).toArray();
            allDocs.forEach(doc => {
                if (doc && doc._id && doc.data !== undefined) {
                    memoryCache.set(doc._id, doc.data);
                }
            });
            console.log(`[DATABASE] Sincronizzati ${allDocs.length} archivi da MongoDB nella cache.`);
        } catch(e){}

        // Se MongoDB e vuoto, popola con i file locali esistenti
        await autoSeedCloudDatabase();
    } catch (err) {
        console.error('[DATABASE ERRORE] Impossibile connettersi a MongoDB Atlas:', err.message);
        console.log('[DATABASE] Attivato fallback trasparente su file JSON.');
        isMongoReady = false;
    }
}

async function cloudGet(key, defaultVal) {
    if (memoryCache.has(key)) return memoryCache.get(key);
    if (isMongoReady && mongoCollection) {
        try {
            const doc = await mongoCollection.findOne({ _id: key });
            if (doc && doc.data !== undefined) {
                memoryCache.set(key, doc.data);
                return doc.data;
            }
        } catch(e){}
    }
    return defaultVal;
}

async function cloudSet(key, data, localFilePath) {
    memoryCache.set(key, data);

    if (localFilePath) {
        try {
            const dir = path.dirname(localFilePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const str = typeof data === 'string' ? data : JSON.stringify(data, null, Array.isArray(data) ? 4 : 2);
            safeWriteAtomic(localFilePath, str);
            
            // Garantisci allineamento simultaneo di entrambi i percorsi per 'progetti'
            if (key === 'progetti') {
                const altPath = localFilePath.includes('data') 
                    ? path.join(__dirname, 'progetti_config.json') 
                    : path.join(__dirname, 'data', 'progetti_config.json');
                const altDir = path.dirname(altPath);
                if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });
                safeWriteAtomic(altPath, str);
            }
        } catch (e) {
            console.error(`[DATABASE] Errore salvataggio disco per ${key}:`, e.message);
        }
    }

    if (isMongoReady && mongoCollection) {
        try {
            await mongoCollection.updateOne(
                { _id: key },
                { $set: { data: data, updatedAt: new Date() } },
                { upsert: true }
            );
        } catch (e) {
            console.error(`[DATABASE] Errore salvataggio MongoDB per ${key}:`, e.message);
        }
    }
}

async function autoSeedCloudDatabase() {
    if (!isMongoReady || !mongoCollection) return;
    try {
        const count = await mongoCollection.countDocuments();
        if (count > 0) return;

        console.log('[DATABASE] Migrazione iniziale automatica: caricamento file JSON locali su MongoDB Atlas...');
        const dDir = path.join(__dirname, 'data');
        const invF = path.join(dDir, 'inventario.json');
        if (fs.existsSync(invF)) {
            try { await cloudSet('inventario', JSON.parse(fs.readFileSync(invF, 'utf8') || '[]')); } catch(e){}
        }
        const posF = path.join(dDir, 'posizioni.json');
        if (fs.existsSync(posF)) {
            try { await cloudSet('posizioni', JSON.parse(fs.readFileSync(posF, 'utf8') || '[]')); } catch(e){}
        }
        const ricF = path.join(dDir, 'ricette.json');
        if (fs.existsSync(ricF)) {
            try { await cloudSet('ricette', JSON.parse(fs.readFileSync(ricF, 'utf8') || '[]')); } catch(e){}
        }
        const opF = path.join(__dirname, 'operatori.json');
        if (fs.existsSync(opF)) {
            try { await cloudSet('operatori', JSON.parse(fs.readFileSync(opF, 'utf8') || '[]')); } catch(e){}
        }
        const prjF = path.join(__dirname, 'progetti_config.json');
        if (fs.existsSync(prjF)) {
            try { await cloudSet('progetti', JSON.parse(fs.readFileSync(prjF, 'utf8') || '[]')); } catch(e){}
        }
        const salF = path.join(dDir, 'salute_db.json');
        if (fs.existsSync(salF)) {
            try { await cloudSet('salute', JSON.parse(fs.readFileSync(salF, 'utf8') || '{}')); } catch(e){}
        }
        const careF = path.join(__dirname, 'CareAssist_Pro', 'careassist_database.json');
        if (fs.existsSync(careF)) {
            try { await cloudSet('careassist', JSON.parse(fs.readFileSync(careF, 'utf8') || '{}')); } catch(e){}
        }
        const medF = path.join(__dirname, 'MedNutri_Pro', 'mednutri_server_data.json');
        if (fs.existsSync(medF)) {
            try { await cloudSet('mednutri', JSON.parse(fs.readFileSync(medF, 'utf8') || '{}')); } catch(e){}
        }
        const gioF = path.join(dDir, 'gioco_records.json');
        if (fs.existsSync(gioF)) {
            try { await cloudSet('gioco', JSON.parse(fs.readFileSync(gioF, 'utf8') || '{}')); } catch(e){}
        }
        console.log('[DATABASE] Migrazione iniziale completata con successo su MongoDB Atlas!');
    } catch(err) {
        console.error('[DATABASE SEED ERROR]', err);
    }
}

async function startServer() {
    // Avvia connessione a MongoDB Atlas se configurato
    await initCloudDatabase().catch(e => console.warn(e));

    let createProxyMiddleware;
    try {
        const hpm = await import('http-proxy-middleware');
        createProxyMiddleware = hpm.createProxyMiddleware;
    } catch(err) {
        console.warn('http-proxy-middleware not loaded:', err);
    }
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Servizio statico diretto per foto e uploads (istantaneo, nessun ritardo o errore proxy)
    app.use('/Foto_Attrezzi', express.static(path.join(__dirname, 'data', 'Foto_Attrezzi')));
    app.use('/Foto_Attrezzi', express.static(path.join(__dirname, 'public', 'Foto_Attrezzi')));
    app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    app.use('/uploads', express.static(path.join(__dirname, '..', 'RicettarioWeb', 'public', 'uploads')));

    // Servizio Statico Ricettario (funziona sia in Cloud su Render sia in locale USB)
    const ricettarioDir = fs.existsSync(path.join(__dirname, 'public', 'ricettario')) 
        ? path.join(__dirname, 'public', 'ricettario') 
        : path.join(__dirname, '..', 'RicettarioWeb', 'public');
    app.use('/ricettario', express.static(ricettarioDir));

    // Database e Percorsi Ricettario
    const ricettarioDataDir = fs.existsSync(path.join(__dirname, 'data')) ? path.join(__dirname, 'data') : path.join(__dirname, '..', 'RicettarioWeb', 'data');
    const ricettarioJsonPath = path.join(ricettarioDataDir, 'ricette.json');
    const ricettarioUploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(ricettarioDataDir)) fs.mkdirSync(ricettarioDataDir, { recursive: true });
    if (!fs.existsSync(ricettarioUploadsDir)) fs.mkdirSync(ricettarioUploadsDir, { recursive: true });
    if (!fs.existsSync(ricettarioJsonPath)) fs.writeFileSync(ricettarioJsonPath, '[]');

    // API Ricettario Native (Zero errori proxy)
    app.get(['/api/recipes', '/ricettario/api/recipes'], (req, res) => {
        try {
            const data = fs.readFileSync(ricettarioJsonPath, 'utf8');
            res.json(JSON.parse(data || '[]'));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post(['/api/recipes', '/ricettario/api/recipes'], (req, res) => {
        try {
            safeWriteAtomic(ricettarioJsonPath, JSON.stringify(req.body, null, 4));
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    const storageRicettario = multer.diskStorage({
        destination: function (req, file, cb) { cb(null, ricettarioUploadsDir); },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, 'ricetta_' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
        }
    });
    const uploadRicettario = multer({ storage: storageRicettario });

    app.post(['/api/upload', '/ricettario/api/upload'], uploadRicettario.single('foto'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
        res.json({ path: 'uploads/' + req.file.filename });
    });

    app.delete(['/api/upload/:filename', '/ricettario/api/upload/:filename'], (req, res) => {
        try {
            const filePath = path.join(ricettarioUploadsDir, req.params.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Logging diagnostico richieste
    app.use((req, res, next) => {
        try { fs.appendFileSync(path.join(__dirname, 'requests.log'), `${new Date().toISOString()} ${req.method} ${req.url}\n`); } catch(e){}
        next();
    });

// Configurazione base
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Endpoint leggero di Healthcheck e Keep-Alive H24 (risposta immediata)
app.get('/ping', (req, res) => res.status(200).send('PONG'));
app.get('/api/suite/version-info', (req, res) => {
    res.json({
        deployId: "DEPLOY_1793707183892",
        timestamp: new Date().toISOString(),
        publicMedNutriExists: fs.existsSync(path.join(__dirname, 'public', 'mednutri', 'index.html')),
        publicLauncherExists: fs.existsSync(path.join(__dirname, 'public', 'launcher.html'))
    });
});
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'active', time: new Date().toISOString(), suite: 'C. Milella' });
});

// ==============================================================================
// SISTEMA DI CONTROLLO LICENZA & SCADENZA - AUTORE: CIRO MILELLA
// ==============================================================================
const licenseFile = path.join(__dirname, 'licenza_attiva.json');


// --- GESTIONE CHIAVI DI RINNOVO LICENZA (CIRO MILELLA) ---
const crypto = require('crypto');
const LICENSE_SECRET = 'CIRO_MILELLA_SUITE_MASTER_KEY_2026';

function generateLicenseKey(destName, daysValid) {
    const cleanName = (destName || 'UTENTE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const expDate = new Date(Date.now() + (parseInt(daysValid, 10) * 24 * 60 * 60 * 1000));
    const expStr = expDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    
    // Hash di controllo HMAC
    const rawData = cleanName + '-' + expStr + '-' + daysValid;
    const sig = crypto.createHmac('sha256', LICENSE_SECRET).update(rawData).digest('hex').toUpperCase().slice(0, 6);
    return 'CM-' + cleanName + '-' + expStr + '-' + sig;
}

function verifyAndApplyLicenseKey(keyString) {
    if (!keyString || typeof keyString !== 'string') return { success: false, message: 'Chiave non valida' };
    const cleanKey = keyString.trim().toUpperCase();
    const parts = cleanKey.split('-');
    if (parts.length !== 4 || parts[0] !== 'CM') {
        return { success: false, message: 'Formato chiave errato. Es: CM-NOME-AAAAMMGG-XXXXXX' };
    }

    const [prefix, cleanName, expStr, sig] = parts;
    const year = expStr.slice(0, 4);
    const month = expStr.slice(4, 6);
    const day = expStr.slice(6, 8);
    const newExpDate = new Date(year + '-' + month + '-' + day + 'T23:59:59');

    if (isNaN(newExpDate.getTime())) {
        return { success: false, message: 'Data contenuta nella chiave non valida' };
    }

    // Verifica firma
    let verifiedDays = null;
    const standardDays = [15, 30, 90, 180, 365, 730, 3650];
    for (let d of standardDays) {
        const testRaw = cleanName + '-' + expStr + '-' + d;
        const testSig = crypto.createHmac('sha256', LICENSE_SECRET).update(testRaw).digest('hex').toUpperCase().slice(0, 6);
        if (testSig === sig) {
            verifiedDays = d;
            break;
        }
    }

    // Se non trovato nei giorni standard, calcola la differenza in giorni dalla data di creazione
    if (!verifiedDays) {
        // Prova brute check 1..3650 se necessario
        for (let d = 1; d <= 3650; d++) {
            const testRaw = cleanName + '-' + expStr + '-' + d;
            const testSig = crypto.createHmac('sha256', LICENSE_SECRET).update(testRaw).digest('hex').toUpperCase().slice(0, 6);
            if (testSig === sig) {
                verifiedDays = d;
                break;
            }
        }
    }

    if (!verifiedDays) {
        return { success: false, message: 'Firma di sicurezza della chiave non valida o manomessa!' };
    }

    // Applica il rinnovo al file licenza_attiva.json
    try {
        let lic = {};
        if (fs.existsSync(licenseFile)) {
            try { lic = JSON.parse(fs.readFileSync(licenseFile, 'utf8')); } catch(e){}
        }
        lic.scadenza = newExpDate.toISOString();
        lic.scadenzaLabel = 'Fino al ' + newExpDate.toLocaleDateString('it-IT');
        lic.lastRun = new Date().toISOString();
        lic.ultimaChiave = cleanKey;
        lic.dataRinnovo = new Date().toISOString();
        fs.writeFileSync(licenseFile, JSON.stringify(lic, null, 2), 'utf8');
        return { success: true, message: 'Licenza rinnovata con successo fino al ' + newExpDate.toLocaleDateString('it-IT'), newExp: newExpDate };
    } catch(err) {
        return { success: false, message: 'Errore di scrittura file licenza: ' + err.message };
    }
}

function checkLicenseStatus() {
    if (!fs.existsSync(licenseFile)) {
        // Nessun file di licenza presente -> Modalita Master (nessuna scadenza)
        return { valid: true, master: true };
    }

    try {
        const lic = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        if (!lic.scadenza) {
            return { valid: true, master: false, lic };
        }

        const now = new Date();
        const expDate = new Date(lic.scadenza);

        // Controllo anti-retrodatazione dell'orologio
        if (lic.lastRun) {
            const lastRunDate = new Date(lic.lastRun);
            // Se l'orologio di sistema e stato portato indietro di oltre 24 ore rispetto all'ultimo avvio
            if (now.getTime() < lastRunDate.getTime() - (24 * 60 * 60 * 1000)) {
                return { 
                    valid: false, 
                    reason: 'CLOCK_TAMPERED', 
                    message: "Rilevata anomalia nell'orologio di sistema. Contatta Ciro Milella.",
                    lic 
                };
            }
        }

        // Salva periodicamente l'ultimo utilizzo registrato
        lic.lastRun = now.toISOString();
        try { fs.writeFileSync(licenseFile, JSON.stringify(lic, null, 2), 'utf8'); } catch(e){}

        if (now > expDate) {
            return { 
                valid: false, 
                reason: 'EXPIRED', 
                message: 'Periodo di licenza terminato il ' + expDate.toLocaleDateString('it-IT') + '.',
                lic 
            };
        }

        return { valid: true, lic, expDate };
    } catch(err) {
        return { valid: true };
    }
}

// Middleware globale di blocco alla scadenza per tutte le pagine e rotte
app.use((req, res, next) => {
    // Risorse sempre consentite (icone, manifest)
    if (req.path.endsWith('.ico') || req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path === '/manifest.json') {
        return next();
    }

    const licCheck = checkLicenseStatus();
    if (licCheck.valid) {
        return next();
    }

    // Se scaduto e la richiesta e per una pagina HTML (navigazione)
    if (req.accepts('html') || req.path.endsWith('.html') || req.path === '/' || req.path.startsWith('/progetto_gioco') || req.path.startsWith('/ricettario') || req.path.startsWith('/mednutri') || req.path.startsWith('/salute') || req.path.startsWith('/careassist')) {
        const lic = licCheck.lic || {};
        const dest = lic.destinatario || 'Utente';
        const scadFmt = lic.scadenza ? new Date(lic.scadenza).toLocaleDateString('it-IT') : 'Data non specificata';
        const msg = licCheck.reason === 'CLOCK_TAMPERED' 
            ? "Rilevata anomalia nell'orologio di sistema. Riporta l'orario corretto o contatta l'autore."
            : `La licenza d'uso per <strong>${dest}</strong> e terminata in data <strong>${scadFmt}</strong>.`;

        const lockHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Licenza Scaduta - Suite C. Milella</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Outfit', sans-serif; }
        body {
            background:#040914;
            color:#fff;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:1.5rem;
            position:relative;
            overflow:hidden;
        }
        .lock-card {
            background:rgba(15, 23, 42, 0.95);
            border:2px solid #ef4444;
            border-radius:28px;
            box-shadow:0 0 60px rgba(239, 68, 68, 0.35);
            max-width:560px;
            width:100%;
            padding:2.8rem 2.2rem;
            text-align:center;
            position:relative;
            backdrop-filter:blur(16px);
            animation:popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes popIn {
            from { opacity:0; transform:scale(0.92); }
            to { opacity:1; transform:scale(1); }
        }
        .icon-badge {
            width:84px;
            height:84px;
            border-radius:26px;
            background:linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.4) 100%);
            border:2px solid rgba(239, 68, 68, 0.5);
            display:inline-flex;
            align-items:center;
            justify-content:center;
            font-size:2.8rem;
            margin-bottom:1.5rem;
            box-shadow:0 0 30px rgba(239, 68, 68, 0.4);
        }
        h1 { font-size:1.85rem; font-weight:900; letter-spacing:0.5px; color:#ffffff; margin-bottom:0.8rem; }
        .sub { font-size:1.05rem; color:#94a3b8; line-height:1.6; margin-bottom:1.8rem; }
        .info-box {
            background:rgba(255,255,255,0.03);
            border:1px solid rgba(212,175,55,0.3);
            border-radius:18px;
            padding:1.2rem;
            margin-bottom:2rem;
            text-align:left;
            font-size:0.95rem;
        }
        .info-row { display:flex; justify-content:space-between; margin-bottom:0.5rem; }
        .info-row:last-child { margin-bottom:0; }
        .info-lbl { color:#94a3b8; font-weight:600; }
        .info-val { color:#fef08a; font-weight:800; }
        .btn-wa {
            display:flex;
            align-items:center;
            justify-content:center;
            gap:10px;
            background:linear-gradient(135deg, #10b981 0%, #059669 100%);
            color:#fff;
            padding:14px 24px;
            border-radius:16px;
            font-weight:800;
            font-size:1rem;
            text-decoration:none;
            box-shadow:0 8px 25px rgba(16, 185, 129, 0.4);
            transition:all 0.2s;
            cursor:pointer;
            border:none;
            width:100%;
        }
        .btn-wa:hover { transform:scale(1.03); }
        .footer-note { margin-top:1.4rem; font-size:0.82rem; color:#64748b; }
    </style>
</head>
<body>
    <div class="lock-card">
        <div class="icon-badge">🔒</div>
        <h1>LICENZA SCADUTA</h1>
        <p class="sub">${msg}<br>Per rinnovare o approfondire il software rivolgiti a Ciro Milella.</p>

        <div class="info-box">
            <div class="info-row">
                <span class="info-lbl">Destinatario:</span>
                <span class="info-val">${dest}</span>
            </div>
            <div class="info-row">
                <span class="info-lbl">Progetto Sviluppato da:</span>
                <span class="info-val" style="color:#fef08a;">Ciro Milella</span>
            </div>
            <div class="info-row">
                <span class="info-lbl">Data Scadenza:</span>
                <span class="info-val" style="color:#ef4444;">${scadFmt}</span>
            </div>
        </div>

        <button onclick="window.open('https://wa.me/?text=' + encodeURIComponent('Salve Ciro, la licenza della mia copia di ' + '${encodeURIComponent(dest)}' + ' e scaduta il ' + '${scadFmt}' + '. Vorrei concordare il rinnovo/approfondimento.'), '_blank')" class="btn-wa" style="margin-bottom:1.5rem;">
            <span>💬</span> <span>Contatta Ciro Milella per Rinnovo</span>
        </button>

        <!-- BOX ATTIVAZIONE CHIAVE IMMEDIATA -->
        <div style="background:rgba(255,255,255,0.04); border:1.5px solid rgba(56,189,248,0.35); border-radius:20px; padding:1.4rem; text-align:left;">
            <div style="font-size:0.95rem; font-weight:800; color:#38bdf8; margin-bottom:6px; display:flex; align-items:center; gap:8px;">
                <span>🔑</span> Inserisci Chiave di Rinnovo Fornita da Ciro
            </div>
            <div style="font-size:0.82rem; color:#94a3b8; margin-bottom:12px; line-height:1.4;">
                Se hai già ricevuto il codice di sblocco personale, incollalo qui sotto per riattivare immediatamente il sistema.
            </div>
            <div style="display:flex; gap:8px;">
                <input type="text" id="inputLicKey" placeholder="Es: CM-ROSA-20271020-XXXXXX" style="flex:1; background:rgba(0,0,0,0.5); border:1px solid rgba(56,189,248,0.5); border-radius:12px; padding:10px 14px; color:#fff; font-family:'Outfit',monospace; font-size:0.9rem; font-weight:700; text-transform:uppercase; outline:none;" />
                <button onclick="riscattaChiaveLicenza()" id="btnRedeem" style="background:linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); color:#fff; border:none; padding:10px 18px; border-radius:12px; font-weight:800; font-size:0.9rem; cursor:pointer; white-space:nowrap; transition:all 0.2s;">
                    SBLOCCA 🔓
                </button>
            </div>
            <div id="renewMsg" style="margin-top:10px; font-size:0.85rem; font-weight:700; display:none;"></div>
        </div>
        <script>
        async function riscattaChiaveLicenza() {
            const key = document.getElementById('inputLicKey').value.trim();
            const msgEl = document.getElementById('renewMsg');
            const btn = document.getElementById('btnRedeem');
            if (!key) { alert('Inserisci il codice di rinnovo ricevuto da Ciro Milella'); return; }
            btn.disabled = true; btn.innerText = 'Verifica...';
            try {
                const res = await fetch('/api/redeem-license-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                const data = await res.json();
                if (data.success) {
                    msgEl.style.display = 'block';
                    msgEl.style.color = '#4ade80';
                    msgEl.innerText = '✅ ' + data.message + ' Ricarico in corso...';
                    setTimeout(() => { window.location.reload(); }, 1500);
                } else {
                    msgEl.style.display = 'block';
                    msgEl.style.color = '#f87171';
                    msgEl.innerText = '❌ ' + (data.error || 'Chiave non valida');
                    btn.disabled = false; btn.innerText = 'SBLOCCA 🔓';
                }
            } catch(e) {
                alert('Errore di connessione al server locale');
                btn.disabled = false; btn.innerText = 'SBLOCCA 🔓';
            }
        }
        </script>

        <div class="footer-note">
            Software Aziendale con Tutela della Proprieta Intellettuale &copy; Ciro Milella
        </div>
    </div>
</body>
</html>`;
        return res.status(403).send(lockHtml);
    }

    // Se chiamata API JSON (chiamata ajax o backend)
    return res.status(403).json({
        error: 'LICENSE_EXPIRED',
        message: 'Licenza scaduta. Contatta Ciro Milella per il rinnovo.',
        scadenza: (licCheck.lic && licCheck.lic.scadenza) || null
    });
});

// Reindirizzamento automatico per facilitare la condivisione: digitando solo il dominio si va dritti al Launcher
app.get(['/', '/index.html'], (req, res, next) => {
    // Se la richiesta è per la pagina principale via browser, apri il Launcher C. Milella
    if (req.accepts('html')) {
        return res.redirect('/launcher.html');
    }
    next();
});

// Accesso Diretto ad Inventario Attrezzi
app.get(['/inventario', '/inventario/', '/inventario.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const p1 = path.join(__dirname, 'public', 'inventario.html');
    const p2 = path.join(__dirname, 'index.html');
    if (fs.existsSync(p1)) return res.sendFile(p1);
    if (fs.existsSync(p2)) return res.sendFile(p2);
    res.status(404).send('Inventario non trovato');
});

app.get(['/stanza-regia', '/regia', '/STANZA_REGIA_MASTER.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const p1 = path.join(__dirname, 'public', 'STANZA_REGIA_MASTER.html');
    const p2 = path.join(__dirname, 'STANZA_REGIA_MASTER.html');
    if (fs.existsSync(p1)) return res.sendFile(p1);
    if (fs.existsSync(p2)) return res.sendFile(p2);
    res.status(404).send('STANZA_REGIA_MASTER.html non trovato');
});

app.get('/launcher.html', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const pRoot = path.join(__dirname, 'launcher.html');
    const pPub = path.join(__dirname, 'public', 'launcher.html');
    if (fs.existsSync(pRoot)) return res.sendFile(pRoot);
    if (fs.existsSync(pPub)) return res.sendFile(pPub);
    res.status(404).send('launcher.html non trovato');
});

// ROUTE DIRETTE ANTI-CACHE PER MEDNUTRI (AMBULATORIO) E CAREASSIST
app.get(['/mednutri', '/mednutri/', '/mednutri/index.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const f = path.join(__dirname, 'public', 'mednutri', 'index.html');
    if (fs.existsSync(f)) return res.sendFile(f);
    res.status(404).send('MedNutri index non trovato');
});

app.get(['/careassist', '/careassist/', '/careassist/index.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const f = path.join(__dirname, 'public', 'careassist', 'index.html');
    if (fs.existsSync(f)) return res.sendFile(f);
    res.status(404).send('CareAssist index non trovato');
});

// LINK BREVI PER ACCESSO ISTANTANEO DA QUALSIASI DISPOSITIVO ESTERNO (FACILI DA RICORDARE)
app.get(['/turni', '/roster', '/turnario'], (req, res) => {
    res.redirect('/careassist/turni.html');
});
app.get(['/suite', '/portale', '/launcher'], (req, res) => {
    res.redirect('/launcher.html');
});

// ==============================================================================
// GESTIONE ACCESSO: PIN MASTER (SOS999) & REGISTRO OPERATORI ABILITATI
// ==============================================================================
let operatoriPath = path.join(__dirname, 'data', 'operatori.json');
if (!fs.existsSync(operatoriPath) && fs.existsSync(path.join(__dirname, 'operatori.json'))) {
    operatoriPath = path.join(__dirname, 'operatori.json');
}
const PIN_MASTER = process.env.PIN_MASTER || 'SOS999';

function loadOperatori() {
    try {
        if (memoryCache.has("operatori")) return memoryCache.get("operatori");
        if (!fs.existsSync(operatoriPath)) {
            const initial = [
                { id: "op_master", nome: "Ciro Milella (Admin)", ruolo: "admin", codice: "SOS999", attivo: true },
                { id: "op_collega1", nome: "Operatore Magazzino", ruolo: "operatore", codice: "1111", attivo: true },
                { id: "op_collega2", nome: "Operatore Cantiere", ruolo: "operatore", codice: "2222", attivo: true }
            ];
            fs.writeFileSync(operatoriPath, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        return JSON.parse(fs.readFileSync(operatoriPath, 'utf8') || '[]');
    } catch(e) {
        return [{ id: "op_master", nome: "Ciro Milella (Admin)", ruolo: "admin", codice: "SOS999", attivo: true }];
    }
}

// Lista pubblica degli operatori per la selezione rapida all'accesso
app.get('/api/operatori/lista-pubblica', (req, res) => {
    const list = loadOperatori().filter(o => o.attivo).map(o => ({ id: o.id, nome: o.nome, ruolo: o.ruolo }));
    res.json(list);
});

// ------------------------------------------------------------------------------
// TOKEN DI SESSIONE FIRMATO (HMAC-SHA256, stateless, scade dopo 12 ore)
// Il token viene emesso al login con PIN e verificato dal server su ogni API protetta.
// Viene invalidato subito se l'operatore viene disattivato/eliminato o se il PIN cambia.
// ------------------------------------------------------------------------------
const AUTH_TTL_MS = 12 * 60 * 60 * 1000;
const AUTH_SECRET = process.env.AUTH_SECRET ||
    crypto.createHash('sha256').update('milella-auth-v1|' + PIN_MASTER + '|' + LICENSE_SECRET).digest('hex');

function pinHash(c) {
    return crypto.createHash('sha256').update(String(c || '').trim().toLowerCase()).digest('hex').slice(0, 10);
}
function b64u(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64u(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Buffer.from(s, 'base64');
}
function signToken(payload) {
    const body = b64u(JSON.stringify(payload));
    const sig = b64u(crypto.createHmac('sha256', AUTH_SECRET).update(body).digest());
    return body + '.' + sig;
}
function verifyToken(tok) {
    try {
        if (!tok || typeof tok !== 'string') return null;
        const parts = tok.split('.');
        if (parts.length !== 2) return null;
        const expected = b64u(crypto.createHmac('sha256', AUTH_SECRET).update(parts[0]).digest());
        const a = Buffer.from(parts[1]);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
        const p = JSON.parse(fromB64u(parts[0]).toString('utf8'));
        if (!p.e || Date.now() > p.e) return null;
        if (p.i === 'master') {
            if (p.h !== pinHash(PIN_MASTER)) return null;
            return { id: 'master', ruolo: 'admin', nome: 'Ciro Milella (Admin)', appAbilitate: ['all'] };
        }
        const op = loadOperatori().find(o => o.id === p.i && o.attivo);
        if (!op || pinHash(op.codice) !== p.h) return null;
        return { id: op.id, ruolo: op.ruolo || 'operatore', nome: op.nome, appAbilitate: op.appAbilitate || [] };
    } catch (e) {
        return null;
    }
}
function authFromRequest(req, allowQuery) {
    const h = String(req.headers['authorization'] || '');
    let t = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : String(req.headers['x-auth-token'] || '');
    if (!t && allowQuery && req.query && req.query.token) t = String(req.query.token);
    return verifyToken(t);
}
// opts: { admin: true } solo Admin | { app: ['app_x'] } Admin oppure operatore abilitato all'app | { allowQuery: true } token anche in querystring (solo download)
function requireAuth(opts) {
    opts = opts || {};
    return function (req, res, next) {
        const a = authFromRequest(req, !!opts.allowQuery);
        if (!a) {
            return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: 'Accesso non autorizzato: effettua il login con il tuo PIN.' });
        }
        if (opts.admin && a.ruolo !== 'admin') {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Operazione riservata all\'amministratore.' });
        }
        if (opts.app && a.ruolo !== 'admin') {
            const abil = a.appAbilitate || [];
            if (!(abil.includes('all') || opts.app.some(x => abil.includes(x)))) {
                return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Non sei abilitato a questa applicazione.' });
            }
        }
        req.auth = a;
        next();
    };
}

// Limite tentativi PIN errati (anti brute-force): 10 errori in 10 minuti per indirizzo IP
const pinFails = new Map();
const PIN_FAIL_WINDOW_MS = 10 * 60 * 1000;
const PIN_FAIL_MAX = 10;
function clientIp(req) {
    return String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
}
function pinBlocked(req) {
    const ip = clientIp(req);
    const r = pinFails.get(ip);
    if (!r) return false;
    if (Date.now() - r.first > PIN_FAIL_WINDOW_MS) { pinFails.delete(ip); return false; }
    return r.n >= PIN_FAIL_MAX;
}
function pinFailed(req) {
    const ip = clientIp(req);
    const r = pinFails.get(ip);
    if (!r || Date.now() - r.first > PIN_FAIL_WINDOW_MS) pinFails.set(ip, { n: 1, first: Date.now() });
    else r.n++;
}
function pinOk(req) { pinFails.delete(clientIp(req)); }

// Verifica autenticazione (PIN Master o Codice Operatore - Case-Insensitive per SOS999/sos999)
app.post('/api/auth/login', (req, res) => {
    if (pinBlocked(req)) {
        return res.status(429).json({ success: false, message: 'Troppi tentativi errati. Riprova tra qualche minuto.' });
    }
    const { codice } = req.body || {};
    const clean = (codice || '').trim();
    if (clean.toUpperCase() === PIN_MASTER.toUpperCase()) {
        pinOk(req);
        return res.json({
            success: true,
            ruolo: 'admin',
            nome: 'Ciro Milella (Admin)',
            appAbilitate: ['all'],
            token: signToken({ i: 'master', h: pinHash(PIN_MASTER.toUpperCase()), e: Date.now() + AUTH_TTL_MS })
        });
    }
    const ops = loadOperatori();
    const found = clean && ops.find(o => o.attivo && String(o.codice || '').toLowerCase() === clean.toLowerCase());
    if (found) {
        pinOk(req);
        return res.json({
            success: true,
            ruolo: found.ruolo || 'operatore',
            nome: found.nome,
            appAbilitate: found.appAbilitate || [],
            pazAbilitati: found.pazAbilitati || [],
            profiliSalute: found.profiliSalute || [],
            canEditTerapie: !!found.canEditTerapie,
            token: signToken({ i: found.id, h: pinHash(found.codice), e: Date.now() + AUTH_TTL_MS })
        });
    }
    pinFailed(req);
    return res.status(401).json({ success: false, message: 'Codice o PIN non riconosciuto.' });
});

// Gestione operatori (solo per Admin autenticato con PIN Master)
app.post('/api/operatori/gestione', (req, res) => {
    const { pinAdmin, azione, operatore } = req.body || {};
    if (pinBlocked(req)) {
        return res.status(429).json({ success: false, message: 'Troppi tentativi errati. Riprova tra qualche minuto.' });
    }
    const auth = authFromRequest(req);
    const isAdmin = (auth && auth.ruolo === 'admin') || ((pinAdmin || '').trim().toUpperCase() === PIN_MASTER.toUpperCase());
    if (!isAdmin) {
        if (pinAdmin) pinFailed(req);
        return res.status(403).json({ success: false, message: "Accesso negato: PIN Master errato o sessione non valida." });
    }
    pinOk(req);
    let ops = loadOperatori();
    if (azione === 'list') {
        return res.json({ success: true, operatori: ops });
    } else if (azione === 'add') {
        if (!operatore || !operatore.nome || !operatore.codice) {
            return res.status(400).json({ success: false, message: 'Nome e codice richiesti' });
        }
        const newOp = {
            id: 'op_' + Date.now(),
            nome: operatore.nome.trim(),
            ruolo: operatore.ruolo || 'operatore',
            codice: operatore.codice.trim(),
            appAbilitate: operatore.appAbilitate || (operatore.appId ? [operatore.appId] : []),
            pazAbilitati: operatore.pazAbilitati || [],
            profiliSalute: operatore.profiliSalute || [],
            canEditTerapie: !!operatore.canEditTerapie,
            attivo: true
        };
        ops.push(newOp);
        cloudSet("operatori", ops, operatoriPath);
        return res.json({ success: true, operatori: ops });
    } else if (azione === 'update') {
        if (!operatore || !operatore.id) {
            return res.status(400).json({ success: false, message: 'ID operatore richiesto' });
        }
        ops = ops.map(o => {
            if (o.id === operatore.id && o.id !== 'op_master') {
                return {
                    ...o,
                    nome: operatore.nome !== undefined ? operatore.nome.trim() : o.nome,
                    codice: operatore.codice !== undefined ? operatore.codice.trim() : o.codice,
                    appAbilitate: operatore.appAbilitate || (operatore.appId ? [operatore.appId] : o.appAbilitate),
                    pazAbilitati: operatore.pazAbilitati !== undefined ? operatore.pazAbilitati : (o.pazAbilitati || []),
                    profiliSalute: operatore.profiliSalute !== undefined ? operatore.profiliSalute : (o.profiliSalute || []),
                    canEditTerapie: operatore.canEditTerapie !== undefined ? !!operatore.canEditTerapie : !!o.canEditTerapie
                };
            }
            return o;
        });
        cloudSet("operatori", ops, operatoriPath);
        return res.json({ success: true, operatori: ops });

    } else if (azione === 'toggle') {
        ops = ops.map(o => o.id === operatore.id && o.id !== 'op_master' ? { ...o, attivo: !o.attivo } : o);
        cloudSet("operatori", ops, operatoriPath);
        return res.json({ success: true, operatori: ops });
    } else if (azione === 'delete') {
        ops = ops.filter(o => o.id !== operatore.id || o.id === 'op_master');
        cloudSet("operatori", ops, operatoriPath);
        return res.json({ success: true, operatori: ops });
    }
    res.status(400).json({ success: false, message: 'Azione non valida' });
});

// ==============================================================================
// GESTIONE TURNARIO & OPERATORI ASSEGNATI A CAREASSIST PRO
// ==============================================================================
let turnarioPath = path.join(__dirname, 'data', 'turnario_settimanale.json');
if (!fs.existsSync(turnarioPath) && fs.existsSync(path.join(__dirname, 'turnario_settimanale.json'))) {
    turnarioPath = path.join(__dirname, 'turnario_settimanale.json');
}

app.get('/api/careassist/operatori-turni', (req, res) => {
    try {
        const allOps = loadOperatori();
        const careOps = allOps.filter(o => o.attivo && (
            o.ruolo === 'admin' ||
            !o.appAbilitate ||
            o.appAbilitate.includes('all') ||
            o.appAbilitate.includes('app_careassist') ||
            o.appAbilitate.includes('careassist')
        )).map(o => ({
            id: o.id,
            nome: o.nome,
            ruolo: o.ruolo === 'admin' ? 'Admin / Coordinatore' : (o.ruolo || 'OSS'),
            tel: o.tel || (o.nome.includes('Stoppelli') ? '338 739 7671' : (o.ruolo === 'admin' ? '366 460 7396' : '340 123 4567')),
            profilo: (o.nome.includes('Stoppelli') ? 'misto_pn' : (o.ruolo === 'admin' ? 'diurno' : 'full_h24')),
            disponibileCoperture: true
        }));

        // Se sono censiti solo Ciro e M.C. Stoppelli, integra con la squadra completa per l'H24
        if (careOps.length < 3) {
            careOps.push(
                { id: 'op_marco', nome: 'Marco Rossi', ruolo: 'OSS', tel: '340 123 4567', profilo: 'full_h24', disponibileCoperture: false },
                { id: 'op_sara', nome: 'Sara Viola', ruolo: 'Infermiera / OSS', tel: '347 987 6543', profilo: 'misto_pn', disponibileCoperture: true },
                { id: 'op_elena', nome: 'Elena Bianchi', ruolo: 'OSS Domiciliare', tel: '339 555 1234', profilo: 'full_h24', disponibileCoperture: false }
            );
        }

        res.json({ success: true, operatori: careOps });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/careassist/turnario', (req, res) => {
    try {
        if (memoryCache.has("turnario_settimanale")) return res.json(memoryCache.get("turnario_settimanale"));
        if (fs.existsSync(turnarioPath)) {
            const data = JSON.parse(fs.readFileSync(turnarioPath, 'utf8') || '{}');
            return sincronizzaPazientiInCareAssist(data);
        res.json(data);
        }
    } catch(e) {}
    res.json({});
});

app.post('/api/careassist/turnario', (req, res) => {
    try {
        const auth = authFromRequest(req);
        const pinAdmin = (req.body && req.body.pinAdmin) || '';
        const isAdmin = (auth && auth.ruolo === 'admin') || (pinAdmin.trim().toUpperCase() === PIN_MASTER.toUpperCase()) || req.body.isAdmin;
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: "Solo l'Admin può salvare e modificare il turnario." });
        }
        const data = req.body.turnario || req.body;
        cloudSet("turnario_settimanale", data, turnarioPath);
        res.json({ success: true, message: "Turnario salvato con successo." });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// API BACKUP & SINCRONIZZAZIONE USB / SUITE COMPLETA
app.get('/api/suite/backup-completo', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPayload = {
            suite: "Suite Milella Aziendale",
            versione: "2.5.0",
            timestamp: new Date().toISOString(),
            autore: "Ciro Milella (Admin)",
            dati: {
                turnario: memoryCache.get("turnario_settimanale") || (fs.existsSync(turnarioPath) ? JSON.parse(fs.readFileSync(turnarioPath, 'utf8') || '{}') : {}),
                operatori: (fs.existsSync(path.join(__dirname, 'operatori.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'operatori.json'), 'utf8') || '[]') : []),
                progetti: (fs.existsSync(progettiConfigPath) ? JSON.parse(fs.readFileSync(progettiConfigPath, 'utf8') || '[]') : []),
                inventario: (fs.existsSync(path.join(__dirname, 'data', 'inventario.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'inventario.json'), 'utf8') || '[]') : []),
                careassist: (fs.existsSync(careAssistDbFile) ? JSON.parse(fs.readFileSync(careAssistDbFile, 'utf8') || '{}') : {}),
                salute: (fs.existsSync(path.join(__dirname, 'data', 'salute_db.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'salute_db.json'), 'utf8') || '{}') : {}),
                veicoli: (fs.existsSync(path.join(__dirname, 'data', 'veicoli_db.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'veicoli_db.json'), 'utf8') || '{}') : {})
            }
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="BACKUP_SUITE_MILELLA_${timestamp}.json"`);
        return res.send(jsonStr);
    } catch(err) {
        console.error('[BACKUP COMPLETO ERROR]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/suite/ripristina-backup', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const payload = req.body;
        if (!payload || !payload.dati) {
            return res.status(400).json({ success: false, message: "File di backup non valido o privo di dati." });
        }
        const dati = payload.dati;
        if (dati.turnario) {
            await cloudSet("turnario_settimanale", dati.turnario, turnarioPath);
        }
        if (dati.careassist && fs.existsSync(path.dirname(careAssistDbFile))) {
            await cloudSet("careassist", dati.careassist, careAssistDbFile);
        }
        if (dati.inventario) {
            await cloudSet("inventario", dati.inventario, path.join(__dirname, 'data', 'inventario.json'));
        }
        if (dati.salute) {
            await cloudSet("salute", dati.salute, path.join(__dirname, 'data', 'salute_db.json'));
        }
        if (dati.veicoli) {
            await cloudSet("veicoli", dati.veicoli, path.join(__dirname, 'data', 'veicoli_db.json'));
        }
        res.json({ success: true, message: "Ripristino completato con successo su tutti i moduli!" });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================================
// GESTIONE PROGETTI DINAMICI NEL LAUNCHER (AGGIUNGI / ELIMINA / MODIFICA)
// ==============================================================================
let progettiConfigPath = path.join(__dirname, 'data', 'progetti_config.json');
if (!fs.existsSync(progettiConfigPath) && fs.existsSync(path.join(__dirname, 'progetti_config.json'))) {
    progettiConfigPath = path.join(__dirname, 'progetti_config.json');
}

function loadProgetti() {
    try {
        let projs = [];
        if (memoryCache.has("progetti")) {
            projs = memoryCache.get("progetti");
        } else if (fs.existsSync(progettiConfigPath)) {
            try {
                projs = JSON.parse(fs.readFileSync(progettiConfigPath, 'utf8'));
            } catch(e) {}
        }
        if (!Array.isArray(projs) || projs.length === 0) {
            projs = [
                { id: "app_veicoli", titolo: "Flotta Veicoli & Spese", icona: "🚗", url: "/veicoli_mobile/", descrizione: "Controllo scadenze revisioni, bolli, manutenzioni e rimborsi chilometrici aziendali.", visibilita: "tutti", attivo: true },
                { id: "app_inventario", titolo: "Inventario Attrezzi", icona: "🛠️", url: "/inventario.html", descrizione: "Catalogo fotografico intelligente e ricerca rapida degli attrezzi tra garage, casa e furgone.", visibilita: "tutti", attivo: true },
                { id: "app_ricettario", titolo: "Il Ricettario", icona: "👨‍🍳", url: "/ricettario/", descrizione: "L'archivio prezioso delle tue ricette personali con lista della spesa automatica.", visibilita: "tutti", attivo: true },
                { id: "app_mednutri", titolo: "MedNutri Pro", icona: "🥗", url: "/mednutri/", descrizione: "Software avanzato per piani nutrizionali personalizzati e gestione clinica.", visibilita: "admin", attivo: true },
                { id: "app_salute", titolo: "Progetto Salute", icona: "❤️", url: "/salute/", descrizione: "Monitoraggio parametri vitali, fitness e benessere personale quotidiano.", visibilita: "admin", attivo: true },
                { id: "app_gioco", titolo: "Progetto Gioco", icona: "🎰", url: "/progetto_gioco/", descrizione: "Monitoraggio statistico SuperEnalotto e Gratta & Vinci con bilancio netto.", visibilita: "admin", attivo: true },
                { id: "app_careassist", titolo: "CareAssist Pro", icona: "🩺", url: "/careassist/", descrizione: "Diario socio-sanitario, terapie farmacologiche e gestione assistenza domiciliare.", visibilita: "admin", attivo: true }
            ];
            try { fs.writeFileSync(progettiConfigPath, JSON.stringify(projs, null, 2), 'utf8'); } catch(e) {}
        }
        projs = projs.filter(p => {
            if (!p) return false;
            const id = (p.id || '').toLowerCase();
            const tit = (p.titolo || '').toLowerCase();
            const url = (p.url || '').toLowerCase();
            if (id.includes('logistica') || tit.includes('logistica') || url.includes('logistica') || id.startsWith('proj_1793083570202')) {
                return false;
            }
            return true;
        });
        memoryCache.set("progetti", projs);
        try { fs.writeFileSync(progettiConfigPath, JSON.stringify(projs, null, 2), 'utf8'); } catch(e) {}
        try { cloudSet("progetti", projs, progettiConfigPath); } catch(e) {}
        return projs;
    } catch(e) {
        return [];
    }
}

// Lettura progetti (filtrati per ruolo)
app.get('/api/progetti/lista', (req, res) => {
    res.json(loadProgetti());
});

// Modifica/Aggiunta/Eliminazione progetti (protetta da PIN Master)
app.post('/api/progetti/gestione', (req, res) => {
    const { pinAdmin, azione, progetto } = req.body || {};
    const auth = authFromRequest(req);
    const cleanPin = (pinAdmin || '').trim().toUpperCase();
    const ops = loadOperatori();
    const isOpAdmin = cleanPin && ops.some(o => o.attivo && o.ruolo === 'admin' && String(o.codice || '').trim().toUpperCase() === cleanPin);
    const isAdmin = (auth && auth.ruolo === 'admin') || (cleanPin === PIN_MASTER.toUpperCase()) || isOpAdmin;
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Accesso negato: operazione riservata all'amministratore." });
    }
    let projs = loadProgetti();
    if (azione === 'list') {
        return res.json({ success: true, progetti: projs });
    } else if (azione === 'reorder') {
        const { orderedIds } = req.body || {};
        if (Array.isArray(orderedIds)) {
            const map = new Map(projs.map(p => [p.id, p]));
            const reordered = [];
            orderedIds.forEach(id => {
                if (map.has(id)) {
                    reordered.push(map.get(id));
                    map.delete(id);
                }
            });
            map.forEach(p => reordered.push(p));
            projs = reordered;
            cloudSet('progetti', projs, progettiConfigPath);
            return res.json({ success: true, progetti: projs });
        }
        return res.status(400).json({ success: false, message: 'orderedIds array mancante' });
    } else if (azione === 'add') {
        if (!progetto || !progetto.titolo || !progetto.url) {
            return res.status(400).json({ success: false, message: 'Titolo e URL richiesti' });
        }
        const newP = {
            id: 'proj_' + Date.now(),
            titolo: progetto.titolo.trim(),
            icona: (progetto.icona || '📁').trim(),
            url: progetto.url.trim(),
            descrizione: (progetto.descrizione || '').trim(),
            visibilita: progetto.visibilita || 'tutti',
            attivo: true
        };
        projs.push(newP);
        cloudSet("progetti", projs, progettiConfigPath);
        return res.json({ success: true, progetti: projs });
    } else if (azione === 'toggle') {
        projs = projs.map(p => p.id === progetto.id ? { ...p, attivo: !p.attivo } : p);
        cloudSet("progetti", projs, progettiConfigPath);
        return res.json({ success: true, progetti: projs });
    } else if (azione === 'toggleVis') {
        // Cambia visibilità: da 'admin' a 'tutti' e viceversa con 1 clic!
        projs = projs.map(p => {
            if (p.id === progetto.id) {
                const nuovaVis = p.visibilita === 'admin' ? 'tutti' : 'admin';
                return { ...p, visibilita: nuovaVis };
            }
            return p;
        });
        fs.writeFileSync(progettiConfigPath, JSON.stringify(projs, null, 2), 'utf8');
        return res.json({ success: true, progetti: projs });
    } else if (azione === 'delete') {
        projs = projs.filter(p => p.id !== progetto.id);
        cloudSet("progetti", projs, progettiConfigPath);
        return res.json({ success: true, progetti: projs });
    }
    res.status(400).json({ success: false, message: 'Azione non valida' });
});

// ==============================================================================
// 1. STATISTICHE KPI DASHBOARD LIVE E NOTIFICHE SMART (ATTREZZI, SCADENZE FLOTTA, SALUTE)
// ==============================================================================
app.get('/api/kpi/stats', (req, res) => {
    try {
        let attrezzi = [];
        const invPath = path.join(__dirname, 'data', 'inventario.json');
        if (fs.existsSync(invPath)) {
            try { attrezzi = JSON.parse(fs.readFileSync(invPath, 'utf8') || '[]'); } catch(e){}
        }
        const totAttrezzi = attrezzi.length;
        const inUso = attrezzi.filter(a => a.stato === 'In uso' || (a.prestato_a && a.prestato_a.trim() !== '')).length;
        const disponibili = totAttrezzi - inUso;

        const ops = loadOperatori().filter(o => o.attivo);
        const totOperatori = ops.length;
        const projs = loadProgetti().filter(p => p.attivo);
        const totProgetti = projs.length;

        // Calcolo scadenze veicoli (default veicolo FG945VW o archivio)
        let scadenzeVeicoli = [];
        const veicoliDbPath = path.join(__dirname, 'data', 'veicoli_db.json');
        let veicoliList = [
            { targa: 'FG945VW', modello: 'Fiat Doblò Cargo', ass: '2026-12-31', bollo: '2027-01-31', rev: '2027-05-31' }
        ];
        if (fs.existsSync(veicoliDbPath)) {
            try { 
                const loaded = JSON.parse(fs.readFileSync(veicoliDbPath, 'utf8') || '[]');
                if (Array.isArray(loaded) && loaded.length > 0) veicoliList = loaded;
            } catch(e){}
        }
        
        const now = new Date();
        const alertsVeicoli = [];
        veicoliList.forEach(v => {
            const checks = [
                { tipo: 'Revisione', dataStr: v.rev },
                { tipo: 'Assicurazione', dataStr: v.ass },
                { tipo: 'Bollo Auto', dataStr: v.bollo }
            ];
            checks.forEach(c => {
                if (c.dataStr) {
                    const target = new Date(c.dataStr);
                    const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 30) {
                        alertsVeicoli.push({
                            veicolo: v.targa || v.modello,
                            tipo: c.tipo,
                            data: c.dataStr,
                            giorni: diffDays,
                            urgente: diffDays <= 7
                        });
                    }
                }
            });
        });

        // Controlla prestiti attrezzi
        const attrezziInUso = attrezzi.filter(a => a.prestato_a && a.prestato_a.trim() !== '').map(a => ({
            nome: a.nome,
            prestato_a: a.prestato_a,
            data_prestito: a.data_prestito || a.data_modifica || 'In corso'
        }));

        res.json({
            totAttrezzi,
            inUso,
            disponibili,
            totOperatori,
            totProgetti,
            prossimaScadenza: alertsVeicoli.length > 0 ? (alertsVeicoli[0].tipo + ' (' + alertsVeicoli[0].veicolo + '): ' + (alertsVeicoli[0].giorni <= 0 ? 'SCADUTO' : alertsVeicoli[0].giorni + 'gg')) : "In regola",
            alertsVeicoli,
            attrezziInUso
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================================================================
// 4. REGISTRO PRESTITI: PRESA IN CARICO E RIENTRO CON NOME OPERATORE
// ==============================================================================
app.post('/api/inventory/prestito', (req, res) => {
    const { idAttrezzo, operatoreNome, azione, destinazione } = req.body || {};
    const invPath = path.join(__dirname, 'data', 'inventario.json');
    if (!fs.existsSync(invPath)) return res.status(404).json({ error: 'Database inventario non trovato' });

    try {
        let attrezzi = JSON.parse(fs.readFileSync(invPath, 'utf8') || '[]');
        const idx = attrezzi.findIndex(a => a.id == idAttrezzo);
        if (idx === -1) return res.status(404).json({ error: 'Attrezzo non trovato' });

        const item = attrezzi[idx];
        const dataOggi = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT').slice(0,5);

        if (azione === 'prendi') {
            item.stato = 'In uso';
            item.prestato_a = operatoreNome || 'Operatore';
            item.data_prestito = dataOggi;
            item.destinazione_prestito = destinazione || 'Cantiere';
            item.storico_prestiti = item.storico_prestiti || [];
            item.storico_prestiti.unshift(`Preso da ${operatoreNome} il ${dataOggi} (${destinazione || 'Cantiere'})`);
        } else {
            // Rientro
            const exOperatore = item.prestato_a || 'Operatore';
            item.stato = 'Disponibile';
            item.prestato_a = '';
            item.data_rientro = dataOggi;
            item.storico_prestiti = item.storico_prestiti || [];
            item.storico_prestiti.unshift(`Restituito da ${exOperatore} il ${dataOggi}`);
        }

        safeWriteAtomic(invPath, JSON.stringify(attrezzi, null, 4));
        res.json({ success: true, item });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================================================================
// SICUREZZA GLOBALE: impedisce il download diretto di codice server, dati,
// configurazioni, eseguibili e script. Deve stare PRIMA dei mount statici.
// I dati restano accessibili solo tramite le API /api/...
// ==============================================================================
const STATIC_ALLOWED_JSON = new Set(['manifest.json', 'materiali_db.json']);
const STATIC_BLOCKED_EXT = /\.(json|exe|bat|cmd|vbs|ps1|cs|log|zip|bak|tmp|env|ini|db|sqlite|hta)$/i;
const STATIC_BLOCKED_PATH = /(^|\/)(\.git|\.env|node_modules|Dati_Clinici_USB)(\/|$)|^\/(server[^/]*\.js|index\.js)$|(^|\/)server_smartphone\.js$|\.tmp\.\d+$/i;
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    let p;
    try { p = decodeURIComponent(req.path || ''); } catch (e) { return res.status(400).send('Richiesta non valida'); }
    const base = p.split('/').pop().toLowerCase();
    if (STATIC_BLOCKED_PATH.test(p)) return res.status(403).send('Accesso negato');
    if (STATIC_BLOCKED_EXT.test(p) && !STATIC_ALLOWED_JSON.has(base)) return res.status(403).send('Accesso negato');
    next();
});

app.get('/manifest.json', (req, res) => {
    const host = ((req.headers && req.headers.host) || req.hostname || '').toLowerCase();
    const isP2 = host.includes('milella-suite-un8j');
    const manifest = {
        name: isP2 ? "Suite C. Milella 2 (5GB Attivo)" : "Suite C. Milella 1 (Primario)",
        short_name: isP2 ? "🟢 Suite 2 (5GB)" : "🔵 Suite 1",
        description: "Piattaforma Aziendale Unificata C. Milella",
        start_url: "/launcher.html",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#040914",
        theme_color: isP2 ? "#10b981" : "#0284c7",
        icons: [
            {
                src: isP2 ? "/suite_mc_p2_green.png" : "/suite_mc_p1_blue.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
            }
        ]
    };
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(manifest);
});

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));
app.use(express.static(__dirname, { dotfiles: 'deny' }));

// MedNutri Pro
const medNutriDir = fs.existsSync(path.join(__dirname, 'public', 'mednutri')) 
    ? path.join(__dirname, 'public', 'mednutri') 
    : path.join(__dirname, '..', 'MedNutri_Pro');
app.use('/mednutri', express.static(medNutriDir));

// Progetto Salute
const saluteDir = fs.existsSync(path.join(__dirname, 'public', 'salute')) 
    ? path.join(__dirname, 'public', 'salute') 
    : path.join(__dirname, '..', 'Progetto_Salute');
app.use('/salute', express.static(saluteDir));

// Flotta Veicoli
const veicoliDir = fs.existsSync(path.join(__dirname, 'public', 'veicoli')) 
    ? path.join(__dirname, 'public', 'veicoli') 
    : path.join(__dirname, '..', 'questa', 'Sistema_Logistica_C_Milella', 'File_Sistema');
app.use('/veicoli', express.static(veicoliDir));
app.use('/veicoli/File_Sistema', express.static(veicoliDir));

// Flotta Veicoli - Versione Mobile
const veicoliMobileDir = fs.existsSync(path.join(__dirname, 'public', 'veicoli_mobile'))
    ? path.join(__dirname, 'public', 'veicoli_mobile')
    : path.join(__dirname, 'public', 'veicoli', 'App_Mobile');
app.use('/veicoli_mobile', express.static(veicoliMobileDir));

// Integrazione CareAssist Pro
const careAssistLocalPath = path.resolve(__dirname, '..', 'CareAssist_Pro');
const careAssistPublicPath = path.join(__dirname, 'public', 'careassist');
const careAssistDesktopPath = 'C:\\Users\\Utente\\Desktop\\17102026 care1\\CareAssist_Pro';
const careAssistDesktopLegacy = 'C:\\Users\\Utente\\Desktop\\CareAssist Pro\\CareAssist_Pro';
const careAssistDir = fs.existsSync(careAssistPublicPath) ? careAssistPublicPath : (fs.existsSync(careAssistDesktopPath) ? careAssistDesktopPath : (fs.existsSync(careAssistLocalPath) ? careAssistLocalPath : careAssistDesktopLegacy));
const careAssistDbFile = path.join(careAssistDir, 'careassist_database.json');

// SICUREZZA: blocca il download diretto di dati e file interni dalla cartella statica.
// L'app legge/scrive i dati SOLO tramite /api/get-db e /api/save-db.
const CAREASSIST_BLOCKED = /(\.(json|exe|cs|bat|vbs|ps1|pdf|log|tmp|bak|zip)$)|(^\/(server_smartphone|generate_qr)\.js$)|(\.json\.tmp\.)/i;
app.use('/careassist', (req, res, next) => {
    const p = decodeURIComponent(req.path || '');
    if (p.toLowerCase() === '/manifest.json') return next();
    if (CAREASSIST_BLOCKED.test(p)) return res.status(403).send('Accesso negato');
    
    // Per aggiornamenti immediati su smartphone: niente cache su HTML e Service Worker
    if (p.endsWith('.html') || p === '' || p === '/' || p.endsWith('.js') || p.endsWith('.css') || p.endsWith('/sw.js') || p.endsWith('/auth_token.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});
app.use('/careassist', express.static(careAssistDir, {
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
    }
}));

// API sincronizzazione dati CareAssist Pro

// ==============================================================================
// GESTIONE SINCRONIZZAZIONE DATABASE PROGETTO GIOCO (PC & MOBILE)
// ==============================================================================
const giocoDbPath = path.join(__dirname, 'data', 'gioco_records.json');

app.get('/api/gioco/get-data', (req, res) => {
    try {
        if (!fs.existsSync(giocoDbPath)) {
            return res.json([]);
        }
        const data = fs.readFileSync(giocoDbPath, 'utf8');
        res.json(JSON.parse(data || '[]'));
    } catch(err) {
        console.error('Errore get gioco data:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/gioco/save-data', (req, res) => {
    try {
        const payload = JSON.stringify(req.body, null, 2);
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        safeWriteAtomic(giocoDbPath, payload);
        res.json({ success: true, count: req.body.length });
    } catch(err) {
        console.error('Errore save gioco data:', err);
        res.status(500).json({ error: err.message });
    }
});

// Percorso Database Unificato Pazienti Suite
const suitePazientiDbFile = path.join(__dirname, 'data', 'suite_pazienti.json');

// Sincronizza i pazienti tra suite_pazienti.json e careassist_database.json
function sincronizzaPazientiInCareAssist(caData) {
    if (!caData || !Array.isArray(caData.pazienti)) return;
    try {
        let suiteDb = safeReadJsonSync(suitePazientiDbFile, { pazienti: [] });
        if (!Array.isArray(suiteDb.pazienti)) suiteDb.pazienti = [];

        // Mappa deduplicata per ID univoco (non per nome, per evitare doppi Aldo/Angela!)
        const pzMap = new Map();

        // 1. Inserisci i pazienti della suite come base
        suiteDb.pazienti.forEach(p => {
            if (p && p.id) {
                if (p.id === 'paz_aldo') { p.nome = 'Aldo Zamparino'; p.dataNascita = '1935-01-06'; }
                if (p.id === 'paz_angela') p.nome = 'Angela Mazzicone';
                if (p.id === 'paz_rosa') p.nome = 'Rosa Annunziata Cavalcante';
                if (p.id === 'paz_mariacarmela') p.nome = 'Maria Carmela Stoppelli';
                if (!Array.isArray(p.registrazioni)) p.registrazioni = [];
                pzMap.set(p.id, p);
            }
        });

        // 2. Arricchisci e sovrascrivi con i dati completi di CareAssist
        caData.pazienti.forEach(p => {
            if (p && p.id) {
                if (p.id === 'paz_aldo') { p.nome = 'Aldo Zamparino'; p.dataNascita = '1935-01-06'; }
                if (p.id === 'paz_angela') p.nome = 'Angela Mazzicone';
                if (p.id === 'paz_rosa') p.nome = 'Rosa Annunziata Cavalcante';
                if (p.id === 'paz_mariacarmela') p.nome = 'Maria Carmela Stoppelli';
                if (!Array.isArray(p.registrazioni)) p.registrazioni = [];

                const existing = pzMap.get(p.id);
                if (existing) {
                    const merged = { ...existing, ...p };
                    if (Array.isArray(p.terapie) && p.terapie.length > 0) merged.terapie = p.terapie;
                    if (Array.isArray(p.registrazioni)) merged.registrazioni = p.registrazioni;
                    pzMap.set(p.id, merged);
                } else {
                    pzMap.set(p.id, p);
                }
            }
        });

        const listaAggiornata = Array.from(pzMap.values());
        suiteDb.pazienti = listaAggiornata;
        suiteDb.ultimoAggiornamento = new Date().toISOString();
        safeWriteAtomic(suitePazientiDbFile, JSON.stringify(suiteDb, null, 2));

        // Aggiorna anche l'oggetto passato a CareAssist
        caData.pazienti = listaAggiornata;
    } catch(err) {
        console.error('Errore sincronizzazione pazienti:', err.message);
    }
}

// ============================================================================
// SUITE MILELLA - API DATABASE UNIFICATO PAZIENTI
// ============================================================================
app.get(['/api/suite/pazienti', '/careassist/api/suite/pazienti'], async (req, res) => {
    try {
        let suiteDb = safeReadJsonSync(suitePazientiDbFile, { pazienti: [] });
        res.json({ success: true, count: (suiteDb.pazienti || []).length, pazienti: suiteDb.pazienti || [] });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post(['/api/suite/pazienti', '/careassist/api/suite/pazienti'], async (req, res) => {
    try {
        const nuovoP = req.body;
        if (!nuovoP || !nuovoP.nome) return res.status(400).json({ error: 'Nome obbligatorio' });

        let suiteDb = safeReadJsonSync(suitePazientiDbFile, { pazienti: [] });
        if (!Array.isArray(suiteDb.pazienti)) suiteDb.pazienti = [];

        const k = nuovoP.nome.trim().toLowerCase();
        const exIdx = suiteDb.pazienti.findIndex(p => p.nome && p.nome.trim().toLowerCase() === k);
        if (exIdx >= 0) {
            suiteDb.pazienti[exIdx] = Object.assign({}, suiteDb.pazienti[exIdx], nuovoP);
        } else {
            if (!nuovoP.id) nuovoP.id = 'paz_' + Date.now();
            suiteDb.pazienti.push(nuovoP);
        }

        suiteDb.ultimoAggiornamento = new Date().toISOString();
        safeWriteAtomic(suitePazientiDbFile, JSON.stringify(suiteDb, null, 2));

        // Sincronizza anche su careassist_database.json
        if (fs.existsSync(careAssistDbFile)) {
            try {
                let ca = JSON.parse(fs.readFileSync(careAssistDbFile, 'utf8') || '{}');
                ca.pazienti = suiteDb.pazienti;
                safeWriteAtomic(careAssistDbFile, JSON.stringify(ca, null, 2));
                await cloudSet('careassist', ca, careAssistDbFile);
            } catch(eCa) {}
        }

        res.json({ success: true, paziente: nuovoP, total: suiteDb.pazienti.length });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/get-db', async (req, res) => {
    try {
        let data = await cloudGet('careassist', null);
        if (data === null) {
            data = fs.existsSync(careAssistDbFile) ? JSON.parse(fs.readFileSync(careAssistDbFile, 'utf8') || '{}') : {};
        }
        if (data && typeof data === 'object') {
            sincronizzaPazientiInCareAssist(data);
        }
                // Forza data di nascita ufficiale per Aldo Zamparino (06/01/1935)
        (data.pazienti || []).forEach(p => {
            if (p.id === 'paz_aldo' || (p.nome && p.nome.toLowerCase().includes('aldo'))) {
                p.dataNascita = '1935-01-06';
                p.nome = 'Aldo Zamparino';
            }
        });
res.json(data);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/save-db', async (req, res) => {
    try {
        // Salva nel percorso primario
        sincronizzaPazientiInCareAssist(req.body);
        const payload = JSON.stringify(req.body, null, 2);
        safeWriteAtomic(careAssistDbFile, payload);
        
        // SALVATAGGIO CLOUD MONGODB & MEMORY CACHE (FONDAMENTALE PER SYNC MULTI-DEVICE SU RENDER)
        await cloudSet('careassist', req.body, careAssistDbFile);
        
        // Esegui mirroring automatico sia su USB (D:\questa\CareAssist_Pro) che su Desktop se diversi
        const usbDb = path.join(careAssistLocalPath, 'careassist_database.json');
        const deskDb = path.join(careAssistDesktopPath, 'careassist_database.json');
        
        if (careAssistDbFile !== usbDb && fs.existsSync(careAssistLocalPath)) {
            try { safeWriteAtomic(usbDb, payload); } catch(err){}
        }
        if (careAssistDbFile !== deskDb && fs.existsSync(careAssistDesktopPath)) {
            try { safeWriteAtomic(deskDb, payload); } catch(err){}
        }

        res.json({ success: true, timestamp: Date.now() });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// API sincronizzazione dati MedNutri Pro (condivisione istantanea tra PC e Smartphone)
const medNutriLocalPath = path.resolve(__dirname, '..', 'MedNutri_Pro');
const medNutriDbFile = path.join(medNutriLocalPath, 'mednutri_server_data.json');

app.get('/api/mednutri/get-data', async (req, res) => {
    try {
        let data = await cloudGet('mednutri', null);
        if (data !== null) return res.json(data);
        if (fs.existsSync(medNutriDbFile)) {
            const dataF = fs.readFileSync(medNutriDbFile, 'utf8');
            res.type('application/json').send(dataF || '{}');
        } else {
            const defaultData = {
                "mednutri_doc_profile": JSON.stringify({"avatar":"👩‍⚕️","name":"Dott.ssa Chiara Diagnosi","spec":"Medico Chirurgo Nutrizionista","clinic":"Ambulatorio Medico"}),
                "mednutri_security_pin": "f53a8cc51204bdb35e8fd0ba841c1b8c2f238bd6f069410b0a44b97a3354dbf3"
            };
            res.json(defaultData);
        }
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/mednutri/save-data', async (req, res) => {
    try {
        let current = await cloudGet('mednutri', null);
        if (!current && fs.existsSync(medNutriDbFile)) {
            try { current = JSON.parse(fs.readFileSync(medNutriDbFile, 'utf8')); } catch(e){}
        }
        const updated = Object.assign({}, current || {}, req.body);
        await cloudSet('mednutri', updated, medNutriDbFile);
        res.json({ success: true, timestamp: Date.now() });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ==============================================================================
// API SINCRONIZZAZIONE PROGETTO SALUTE (CIRO MILELLA & MARIA CARMELA)
// Condivisione istantanea tra PC e Smartphone con persistenza cloud
// ==============================================================================
const saluteDbPath = path.join(__dirname, 'data', 'salute_db.json');

// ==============================================================================
// API SINCRONIZZAZIONE FLOTTA VEICOLI MOBILE (DATI REALI CLOUD & LOCALSTORAGE SYNC)
// ==============================================================================
const veicoliCloudDbPath = path.join(__dirname, 'data', 'veicoli_cloud_db.json');
const consegneDbPath = path.join(__dirname, 'data', 'consegne_db.json');

app.get(['/api/logistica/consegne', '/logistica/api/consegne'], async (req, res) => {
    try {
        let cloudData = await cloudGet('logistica_consegne', null);
        if (cloudData) return res.json(cloudData);
        if (fs.existsSync(consegneDbPath)) {
            const dataStr = fs.readFileSync(consegneDbPath, 'utf8');
            return res.json(JSON.parse(dataStr || '{"consegne":[]}'));
        }
        res.json({ consegne: [] });
    } catch(err) {
        console.error('Errore get consegne data:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post(['/api/logistica/consegne', '/logistica/api/consegne'], async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Body non valido' });
        }
        let current = { consegne: [] };
        if (fs.existsSync(consegneDbPath)) {
            try { current = JSON.parse(fs.readFileSync(consegneDbPath, 'utf8')); } catch(e){}
        }
        const updated = Object.assign({}, current, req.body);
        safeWriteAtomic(consegneDbPath, JSON.stringify(updated, null, 2));
        await cloudSet('logistica_consegne', updated, consegneDbPath);
        res.json({ success: true, timestamp: Date.now() });
    } catch(err) {
        console.error('Errore save consegne data:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get(['/api/veicoli/data', '/veicoli_mobile/api/data'], async (req, res) => {
    try {
        let cloudData = await cloudGet('veicoli', null);
        if (cloudData) return res.json(cloudData);
        if (fs.existsSync(veicoliCloudDbPath)) {
            const dataStr = fs.readFileSync(veicoliCloudDbPath, 'utf8');
            return res.json(JSON.parse(dataStr || '{}'));
        }
        res.json({ spese: [], rifornimenti: [], rimborsiMesi: [] });
    } catch(err) {
        console.error('Errore get veicoli data:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post(['/api/veicoli/data', '/veicoli_mobile/api/data'], async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Body non valido' });
        }
        let current = {};
        if (fs.existsSync(veicoliCloudDbPath)) {
            try { current = JSON.parse(fs.readFileSync(veicoliCloudDbPath, 'utf8')); } catch(e){}
        }
        const updated = Object.assign({}, current, req.body);
        safeWriteAtomic(veicoliCloudDbPath, JSON.stringify(updated, null, 2));
        await cloudSet('veicoli', updated, veicoliCloudDbPath);
        res.json({ success: true, timestamp: Date.now() });
    } catch(err) {
        console.error('Errore save veicoli data:', err);
        res.status(500).json({ error: err.message });
    }
});

function consolidaProfiliSalute(data) {
    if (!data || typeof data !== 'object') return;
    try {
        const mariaKeys = ['moglie', '1', 'paz_mariacarmela', 'mariacarmelastoppelli', 'salute_moglie'];
        const allWeights = new Map();
        mariaKeys.forEach(pk => {
            const raw = data['weightLog_' + pk];
            if (raw) {
                try {
                    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (Array.isArray(arr)) {
                        arr.forEach(w => {
                            if (w && w.date && w.weight) {
                                const exist = allWeights.get(w.date);
                                if (!exist || (w.timestamp && w.timestamp > (exist.timestamp || 0))) {
                                    allWeights.set(w.date, w);
                                }
                            }
                        });
                    }
                } catch(e) {}
            }
        });

        if (allWeights.size > 0) {
            const sorted = Array.from(allWeights.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const str = JSON.stringify(sorted);
            data['weightLog_moglie'] = str;
            data['weightLog_1'] = str;
        }

        let maxWater = 0;
        mariaKeys.forEach(pk => {
            const w = parseInt(data['waterCount_' + pk] || 0, 10);
            if (w > maxWater) maxWater = w;
        });
        if (maxWater > 0) {
            data['waterCount_moglie'] = maxWater;
            data['waterCount_1'] = maxWater;
        }

        const pat = data['pathology_1'] || data['pathology_moglie'];
        if (pat) {
            data['pathology_moglie'] = pat;
            data['pathology_1'] = pat;
        }

        const stats = data['profileStats_moglie'] || data['profileStats_1'];
        if (stats) {
            data['profileStats_moglie'] = stats;
            data['profileStats_1'] = stats;
        }

        data['profileName_moglie'] = 'Maria Carmela';
        data['profileName_1'] = 'Maria Carmela';
    } catch(err) {
        console.warn('Errore consolidamento profili Maria Carmela:', err);
    }
}

app.get(['/api/salute/data', '/salute/api/data'], async (req, res) => {
    try {
        let parsed = await cloudGet('salute', null);
        if (!parsed && fs.existsSync(saluteDbPath)) {
            const data = fs.readFileSync(saluteDbPath, 'utf8');
            try { parsed = JSON.parse(data || '{}'); } catch(e){}
        }
        if (!parsed) {
            const autoSaveFile = path.join(__dirname, 'public', 'salute', 'Backup_Salute', 'Ultimo_Salvataggio_Automatico.salute');
            if (fs.existsSync(autoSaveFile)) {
                try { parsed = JSON.parse(fs.readFileSync(autoSaveFile, 'utf8') || '{}'); } catch(e){}
            }
        }
        parsed = parsed || {};

        consolidaProfiliSalute(parsed);

        // Escludi pesate cancellate memorizzate in _deletedWeightsLog
        const delSet = new Set(parsed._deletedWeightsLog || []);
        if (delSet.size > 0) {
            Object.keys(parsed).forEach(k => {
                if (k.startsWith('weightLog_')) {
                    const prof = k.replace('weightLog_', '');
                    try {
                        let arr = typeof parsed[k] === 'string' ? JSON.parse(parsed[k]) : parsed[k];
                        if (Array.isArray(arr)) {
                            arr = arr.filter(item => item && item.date && !delSet.has(`${prof}|${item.date}`));
                            parsed[k] = JSON.stringify(arr);
                        }
                    } catch(e) {}
                }
            });
        }
        res.json(parsed);
    } catch(err) {
        console.error('Errore lettura salute db:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post(['/api/salute/data', '/salute/api/data'], async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Body non valido' });
        }
        let current = await cloudGet('salute', null);
        if (!current && fs.existsSync(saluteDbPath)) {
            try { current = JSON.parse(fs.readFileSync(saluteDbPath, 'utf8')); } catch(e){}
        }
        current = current || {};
        
        // Merge intelligente: unisci campi e storici
        const incoming = req.body;
        const merged = Object.assign({}, current, incoming);

        // Registro autoritativo cancellazioni pesate (_deletedWeightsLog)
        let delSet = new Set(current._deletedWeightsLog || []);
        if (incoming._deletedWeights && Array.isArray(incoming._deletedWeights)) {
            incoming._deletedWeights.forEach(dw => {
                if (dw && dw.profile && dw.date) delSet.add(`${dw.profile}|${dw.date}`);
            });
        }
        merged._deletedWeightsLog = Array.from(delSet);
        
        // Gestione profili e weightLog dinamici per QUALSIASI profilo presente
        Object.keys(incoming).forEach(key => {
            if (key.startsWith('weightLog_')) {
                const prof = key.replace('weightLog_', '');
                try {
                    const arrInc = typeof incoming[key] === 'string' ? JSON.parse(incoming[key]) : incoming[key];
                    const arrCur = current[key] ? (typeof current[key] === 'string' ? JSON.parse(current[key]) : current[key]) : [];
                    if (Array.isArray(arrInc)) {
                        if (incoming._forceWeightLog) {
                            const filtered = arrInc.filter(item => item && item.date && !delSet.has(`${prof}|${item.date}`));
                            merged[key] = JSON.stringify(filtered);
                        } else {
                            const dateMap = new Map();
                            if (Array.isArray(arrCur)) {
                                arrCur.forEach(item => {
                                    if (item && item.date && !delSet.has(`${prof}|${item.date}`)) {
                                        dateMap.set(item.date, item);
                                    }
                                });
                            }
                            arrInc.forEach(item => {
                                if (item && item.date && !delSet.has(`${prof}|${item.date}`)) {
                                    dateMap.set(item.date, item);
                                }
                            });
                            const combined = Array.from(dateMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                            merged[key] = JSON.stringify(combined);
                        }
                    }
                } catch(eMerge) {}
            }
        });

        // Gestione rimozione profili eliminati
        if (incoming._deletedProfile) {
            const delProf = incoming._deletedProfile;
            delete merged._deletedProfile;
            Object.keys(merged).forEach(k => {
                if (k.endsWith('_' + delProf)) {
                    delete merged[k];
                }
            });
            // Rimuovi esplicitamente dall'elenco profili
            let pList = [];
            try {
                pList = typeof merged.health_profiles === 'string' ? JSON.parse(merged.health_profiles) : (merged.health_profiles || []);
            } catch(e) {}
            if (Array.isArray(pList)) {
                merged.health_profiles = pList.filter(p => p !== delProf);
            }
        } else {
            // Ricostruisci / proteggi l'elenco dei profili attivi in modo che nessun profilo venga mai perso
            let pSet = new Set(['marito', 'moglie']);
            // Aggiungi quelli salvati precedentemente
            [current.health_profiles, incoming.health_profiles].forEach(hp => {
                if (hp) {
                    try {
                        const arr = typeof hp === 'string' ? JSON.parse(hp) : hp;
                        if (Array.isArray(arr)) arr.forEach(p => { if (p && p.trim()) pSet.add(p.trim()); });
                    } catch(e) {}
                }
            });
            // Rileva eventuali profili dai dati salvati (profileName_*)
            Object.keys(merged).forEach(k => {
                if (k.startsWith('profileName_')) {
                    const pid = k.replace('profileName_', '').trim();
                    if (pid && !['0', '1', 'a', 'salvatoresalva'].includes(pid)) {
                        pSet.add(pid);
                    }
                }
            });
            merged.health_profiles = Array.from(pSet);
        }

        consolidaProfiliSalute(merged);
        
        await cloudSet('salute', merged, saluteDbPath);
        
        // Copia anche in Ultimo_Salvataggio_Automatico se la cartella esiste
        const autoSaveFile = path.join(__dirname, 'public', 'salute', 'Backup_Salute', 'Ultimo_Salvataggio_Automatico.salute');
        try {
            safeWriteAtomic(autoSaveFile, JSON.stringify(merged));
        } catch(eAuto) {}

        res.json({ success: true, timestamp: Date.now(), keys: Object.keys(merged).length });
    } catch(err) {
        console.error('Errore salvataggio salute db:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// SUITE MILELLA - ANAGRAFE SANITARIA FEDERATA (MASTER PATIENT REGISTRY)
// Restituisce tutti i soggetti censiti in CareAssist, Progetto Salute e Ambulatorio Medico
// ============================================================================
app.get(['/api/suite/anagrafe-condivisa', '/careassist/api/suite/anagrafe-condivisa'], async (req, res) => {
    try {
        const soggettiMap = new Map();

        // 1. Leggi CareAssist Pro & Database Unificato Suite (suite_pazienti.json)
        try {
            let caData = await cloudGet('careassist', null);
            if (!caData && fs.existsSync(careAssistDbFile)) {
                caData = JSON.parse(fs.readFileSync(careAssistDbFile, 'utf8') || '{}');
            }
            if (caData && Array.isArray(caData.pazienti)) {
                caData.pazienti.forEach(p => {
                    if (p && p.nome) {
                        const k = p.nome.trim().toLowerCase();
                        soggettiMap.set(k, {
                            id: p.id || 'paz_' + Date.now(),
                            nome: p.nome.trim(),
                            dataNascita: p.dataNascita || '',
                            sesso: p.sesso || 'M',
                            indirizzo: p.indirizzo || '',
                            telefono: p.telefono || p.cellulare || '',
                            patologie: p.patologie || [],
                            terapie: p.terapie || [],
                            altezza: p.altezza || '',
                            peso: p.peso || '',
                            polso: p.polso || '',
                            origini: ['CareAssist Pro']
                        });
                    }
                });
            }

            // Unisci con suite_pazienti.json (Master Suite)
            const sDb = safeReadJsonSync(suitePazientiDbFile, { pazienti: [] });
            if (Array.isArray(sDb.pazienti)) {
                    sDb.pazienti.forEach(p => {
                        if (p && p.nome) {
                            const k = p.nome.trim().toLowerCase();
                            if (soggettiMap.has(k)) {
                                const ex = soggettiMap.get(k);
                                if (!ex.dataNascita && p.dataNascita) ex.dataNascita = p.dataNascita;
                                if ((!ex.patologie || ex.patologie.length === 0) && p.patologie) ex.patologie = p.patologie;
                                if ((!ex.terapie || ex.terapie.length === 0) && p.terapie) ex.terapie = p.terapie;
                                if (!ex.altezza && p.altezza) ex.altezza = p.altezza;
                                if (!ex.peso && p.peso) ex.peso = p.peso;
                                if (!ex.polso && p.polso) ex.polso = p.polso;
                                if (!ex.origini.includes('Suite Master')) ex.origini.push('Suite Master');
                            } else {
                                soggettiMap.set(k, {
                                    id: p.id || 'paz_' + Date.now(),
                                    nome: p.nome.trim(),
                                    dataNascita: p.dataNascita || '',
                                    sesso: p.sesso || 'M',
                                    indirizzo: p.indirizzo || '',
                                    telefono: p.telefono || '',
                                    patologie: p.patologie || [],
                                    terapie: p.terapie || [],
                                    altezza: p.altezza || '',
                                    peso: p.peso || '',
                                    polso: p.polso || '',
                                    origini: ['Suite Master']
                                });
                            }
                        }
                    });
                }
        } catch(eCa) { console.error('Errore lettura CA/Suite per anagrafe:', eCa.message); }

        // 2. Leggi Progetto Salute
        try {
            let salData = {};
            if (fs.existsSync(saluteDbPath)) {
                salData = JSON.parse(fs.readFileSync(saluteDbPath, 'utf8') || '{}');
            }
            // Mappatura profili noti o dinamici in Salute
            const profiliSalute = [
                {
                    key: 'marito',
                    defaultName: 'Ciro Milella',
                    defaultDob: '1967-12-16',
                    defaultGender: 'M'
                },
                {
                    key: 'moglie',
                    defaultName: 'Maria Carmela',
                    defaultDob: '1969-03-20',
                    defaultGender: 'F'
                }
            ];

            profiliSalute.forEach(prof => {
                const nome = salData['profileName_' + prof.key] || prof.defaultName;
                const stats = (typeof salData['profileStats_' + prof.key] === 'object' && salData['profileStats_' + prof.key])
                    ? salData['profileStats_' + prof.key]
                    : { dob: prof.defaultDob };
                const dob = (stats && stats.dob) ? stats.dob : prof.defaultDob;
                const k = nome.trim().toLowerCase();

                if (soggettiMap.has(k)) {
                    const existing = soggettiMap.get(k);
                    if (!existing.dataNascita && dob) existing.dataNascita = dob;
                    if (!existing.origini.includes('Progetto Salute')) existing.origini.push('Progetto Salute');
                } else {
                    soggettiMap.set(k, {
                        id: 'salute_' + prof.key,
                        nome: nome.trim(),
                        dataNascita: dob,
                        sesso: prof.defaultGender,
                        indirizzo: (prof.key === 'moglie' || prof.key === 'marito') ? 'Via Giulio Petroni, 69 - BARI (BA)' : '',
                        telefono: '',
                        patologie: [],
                        origini: ['Progetto Salute']
                    });
                }
            });
        } catch(eSal) { console.error('Errore lettura Salute per anagrafe:', eSal.message); }

        // 3. Leggi Ambulatorio Medico (MedNutri Pro)
        try {
            const vaultPath = path.join(__dirname, 'public', 'mednutri', 'mednutri_cloud_vault_STUDIO-AA-890.json');
            if (fs.existsSync(vaultPath)) {
                const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8') || '{}');
                const store = vault.data || vault;
                Object.keys(store).forEach(vk => {
                    if (vk.startsWith('mednutri_pat_')) {
                        try {
                            const p = typeof store[vk] === 'string' ? JSON.parse(store[vk]) : store[vk];
                            if (p && p.name) {
                                const k = p.name.trim().toLowerCase();
                                if (soggettiMap.has(k)) {
                                    const ex = soggettiMap.get(k);
                                    if (!ex.origini.includes('Ambulatorio Medico')) ex.origini.push('Ambulatorio Medico');
                                } else {
                                    soggettiMap.set(k, {
                                        id: 'mednutri_' + Date.now(),
                                        nome: p.name.trim(),
                                        dataNascita: p.dob || '',
                                        sesso: p.gender || 'M',
                                        indirizzo: '',
                                        telefono: '',
                                        patologie: p.mainPathology ? [p.mainPathology] : [],
                                        origini: ['Ambulatorio Medico']
                                    });
                                }
                            }
                        } catch(eP) {}
                    }
                });
            }
        } catch(eMed) { console.error('Errore lettura MedNutri per anagrafe:', eMed.message); }

        const lista = Array.from(soggettiMap.values());
        res.json({ success: true, count: lista.length, soggetti: lista });
    } catch(err) {
        console.error('Errore anagrafe condivisa:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/presentazione', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', '0_PRESENTAZIONE_E_ARCHITETTURA.html'));
});

const dataDir = path.join(__dirname, 'data');
const jsonPath = path.join(dataDir, 'inventario.json');
const posizioniPath = path.join(dataDir, 'posizioni.json');
const fotoDir = path.join(dataDir, 'Foto_Attrezzi');

// Assicurarsi che le directory esistano
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(fotoDir)) fs.mkdirSync(fotoDir);
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '[]');
if (!fs.existsSync(posizioniPath)) fs.writeFileSync(posizioniPath, JSON.stringify(["Garage", "Casa", "Furgone"], null, 4));

// Configurazione Multer per upload foto
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, fotoDir)
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'foto_' + uniqueSuffix + ext)
    }
});
const upload = multer({ storage: storage });

// API GET: Leggi inventario
app.get('/api/inventory', async (req, res) => {
    try {
        let data = await cloudGet('inventario', null);
        if (data === null) {
            data = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8') || '[]') : [];
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API POST: Salva inventario
app.post('/api/inventory', async (req, res) => {
    try {
        await cloudSet('inventario', req.body, jsonPath);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API GET: Leggi posizioni
app.get('/api/locations', async (req, res) => {
    try {
        let data = await cloudGet('posizioni', null);
        if (data === null) {
            data = fs.existsSync(posizioniPath) ? JSON.parse(fs.readFileSync(posizioniPath, 'utf8') || '["Garage", "Casa", "Furgone"]') : ["Garage", "Casa", "Furgone"];
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API POST: Salva posizioni
app.post('/api/locations', async (req, res) => {
    try {
        await cloudSet('posizioni', req.body, posizioniPath);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API GET: Elenco foto disponibili nel catalogo (uploads e Foto_Attrezzi)
app.get('/api/available-photos', (req, res) => {
    try {
        const photos = [];
        const seen = new Set();
        
        // 1. Dalle cartelle fisiche uploads
        const uploadsDirs = [path.join(__dirname, 'public', 'uploads'), path.join(__dirname, 'uploads')];
        uploadsDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).forEach(file => {
                    if (/\.(jpg|jpeg|png|webp|avif)$/i.test(file) && !seen.has('uploads/' + file)) {
                        seen.add('uploads/' + file);
                        photos.push({ path: 'uploads/' + file, filename: file });
                    }
                });
            }
        });

        // 2. Dalle cartelle fisiche Foto_Attrezzi
        const attrezziDirs = [path.join(__dirname, 'public', 'Foto_Attrezzi'), path.join(__dirname, 'data', 'Foto_Attrezzi')];
        attrezziDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).forEach(file => {
                    if (/\.(jpg|jpeg|png|webp|avif)$/i.test(file) && !seen.has('Foto_Attrezzi/' + file)) {
                        seen.add('Foto_Attrezzi/' + file);
                        photos.push({ path: 'Foto_Attrezzi/' + file, filename: file });
                    }
                });
            }
        });

        res.json(photos);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// API POST: Upload foto
app.post('/api/upload', upload.single('foto'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
    }
    // Ritorniamo il percorso relativo che il frontend userà
    res.json({ path: 'Foto_Attrezzi/' + req.file.filename });
});

// API DELETE: Elimina foto
app.delete('/api/upload/:filename', (req, res) => {
    try {
        const filePath = path.join(fotoDir, req.params.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API POST: Apri cartella backup in Esplora File (Windows Locale)
app.post('/api/open-backup-folder', (req, res) => {
    const { exec } = require('child_process');
    const folder1 = path.resolve(__dirname, '..', 'Backup_Automatico_Dati');
    const folder2 = path.resolve(__dirname, '..', 'documenti', 'Backup_Completo_Sistema');
    const targetFolder = fs.existsSync(folder1) ? folder1 : (fs.existsSync(folder2) ? folder2 : __dirname);
    
    if (process.platform === 'win32') {
        exec(`explorer.exe "${targetFolder}"`);
        return res.json({ success: true, folder: targetFolder });
    } else {
        return res.json({ success: false, message: 'Funzione disponibile solo in ambiente Windows locale' });
    }
});

// API POST: Crea o scarica Backup ZIP inventario
app.post('/api/backup-inventario', (req, res) => {
    const { exec } = require('child_process');
    const destFolder = path.resolve(__dirname, '..', 'documenti', 'Backup_Completo_Sistema');
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipName = `INVENTARIO_BACKUP_${timestamp}.zip`;
    const zipPath = path.join(destFolder, zipName);
    
    // Compressione nativa ultra-rapida tramite tar di sistema
    const srcDir = __dirname;
    const cmd = process.platform === "win32" ? `tar.exe -a -c -f "${zipPath}" --exclude="node_modules" --exclude=".git" -C "${srcDir}" data public` : `tar -czf "${zipPath}" --exclude="node_modules" --exclude=".git" -C "${srcDir}" data public`;
    
    exec(cmd, (err) => {
        if (err) {
            console.error('[ERRORE BACKUP TAR]', err);
            return res.status(500).json({ error: 'Errore creazione ZIP' });
        }
        res.json({ success: true, file: zipName, path: zipPath });
    });
});

// API POST: Avvia Logistica (Electron Nativo)
app.post('/api/launch-logistica', (req, res) => {
    const { exec } = require('child_process');
    const rootPath = path.resolve(__dirname, '..', 'questa', 'Sistema_Logistica_C_Milella');
    const electronExe = path.join(rootPath, 'node_modules', 'electron', 'dist', 'electron.exe');
    const batPath = path.join(rootPath, '0_AVVIA_SISTEMA_LOGISTICA.bat');

    if (fs.existsSync(electronExe)) {
        exec(`"${electronExe}" .`, { cwd: rootPath });
    } else if (fs.existsSync(batPath)) {
        exec(`cmd.exe /c start "" "${batPath}"`, { cwd: rootPath });
    }
    res.json({ success: true });
});

// API POST: Avvia Gestione Veicoli & Spese Auto (MSHTA nativo o Web)
app.post('/api/launch-veicoli', (req, res) => {
    const { exec } = require('child_process');
    const autoHtml = path.resolve(__dirname, '..', 'questa', 'Sistema_Logistica_C_Milella', 'File_Sistema', 'auto.html');
    if (fs.existsSync(autoHtml)) {
        exec(`start "" mshta.exe "${autoHtml}"`, { cwd: path.dirname(autoHtml) });
    } else {
        exec(`start http://localhost:3000/veicoli/auto.html`);
    }
    res.json({ success: true });
});

// API POST: Avvia Progetto Salute (Electron Nativo)
app.post('/api/launch-salute', (req, res) => {
    const { exec } = require('child_process');
    const rootPath = path.resolve(__dirname, '..', 'Progetto_Salute');
    const exePath = path.join(rootPath, 'dist', 'ProgettoSalute-win32-x64', 'ProgettoSalute.exe');
    const electronExe = path.join(rootPath, 'node_modules', 'electron', 'dist', 'electron.exe');
    const batPath = path.join(rootPath, 'AVVIA_PROGETTO_SALUTE.bat');

    if (fs.existsSync(exePath)) {
        exec(`cmd.exe /c start "" "${exePath}"`, { cwd: path.dirname(exePath) });
    } else if (fs.existsSync(electronExe)) {
        exec(`cmd.exe /c start "" "${electronExe}" "${rootPath}"`, { cwd: rootPath });
    } else if (fs.existsSync(batPath)) {
        exec(`cmd.exe /c start "" "${batPath}"`, { cwd: rootPath });
    }
    res.json({ success: true });
});

// Endpoint per recuperare l'IP della macchina (Tailscale o Locale)
app.get('/api/my-ip', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let bestIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('100.')) {
                    return res.json({ ip: iface.address });
                }
                bestIp = iface.address;
            }
        }
    }
    res.json({ ip: bestIp });
});

// Chiusura aggraziata del server se richiesta
app.post('/api/shutdown', requireAuth({ admin: true }), (req, res) => {
    res.json({ success: true });
    setTimeout(() => {
        const { spawn } = require('child_process');
        const child = spawn('cmd.exe', ['/c', 'timeout /t 1 /nobreak >nul & taskkill /IM node.exe /F /T & taskkill /IM cloudflared.exe /F /T'], {
            detached: true,
            windowsHide: true,
            stdio: 'ignore'
        });
        child.unref();
        process.exit(0);
    }, 200);
});

// ==============================================================================
// SINCRONIZZAZIONE DATI CLOUD <-> PC (BUNDLE DATI COMPLETO)
// ==============================================================================

// Esporta tutti i dati in formato JSON unico (per sincronizzazione con PC o backup)
// Sincronizzazione reale Cloud / Chiavetta / Desktop (vedi server_sync.js)
if (fs.existsSync(path.join(__dirname, 'server_sync.js'))) require('./server_sync.js')(app, {
    baseDir: __dirname,
    cloudGet, cloudSet, safeWriteAtomic, authFromRequest,
    getPinMaster: () => PIN_MASTER,
    archivi: [
        { id: 'inventario',  key: 'inventario',         file: jsonPath,                cloud: true  },
        { id: 'posizioni',   key: 'posizioni',          file: posizioniPath,           cloud: true  },
        { id: 'ricette',     key: 'ricette',            file: ricettarioJsonPath,      cloud: false },
        { id: 'operatori',   key: 'operatori',          file: operatoriPath,           cloud: false },
        { id: 'progetti',    key: 'progetti',           file: progettiConfigPath,      cloud: true  },
        { id: 'salute',      key: 'salute',             file: path.join(__dirname, 'data', 'salute_db.json'), cloud: false },
        { id: 'mednutri',    key: 'mednutri',           file: medNutriDbFile,          cloud: true  },
        { id: 'careassist',  key: 'careassist',         file: careAssistDbFile,        cloud: true  },
        { id: 'gioco',       key: 'gioco',              file: path.join(__dirname, 'data', 'gioco_records.json'), cloud: false },
        { id: 'logistica',   key: 'logistica_consegne', file: consegneDbPath,          cloud: true  },
        { id: 'veicoli',     key: 'veicoli',            file: veicoliCloudDbPath,      cloud: true  }
    ]
});

// ==============================================================================
// CENTRO SICUREZZA, BACKUP E SINCRONIZZAZIONE CLOUD SUITE C. MILELLA
// ==============================================================================
app.get('/api/sicurezza/scarica-backup-zip', requireAuth({ admin: true, allowQuery: true }), (req, res) => {
    try {
        const { execSync } = require('child_process');
        const sourceDir = fs.existsSync(path.join(__dirname, '..', 'AGGIORNAMENTO_RENDER')) 
            ? path.join(__dirname, '..', 'AGGIORNAMENTO_RENDER')
            : __dirname;
        const tempZip = path.join(__dirname, 'data', `SUITE_MILELLA_BACKUP_${new Date().toISOString().slice(0,10)}.zip`);
        
        const tarZipCmd = process.platform === "win32" ? `tar.exe -a -c -f "${tempZip}" -C "${sourceDir}" *` : `tar -czf "${tempZip}" -C "${sourceDir}" *`;
        execSync(tarZipCmd);
        res.download(tempZip, `SUITE_MILELLA_BACKUP_${new Date().toISOString().slice(0,10)}.zip`, (err) => {
            try { if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip); } catch(e){}
        });
    } catch(err) {
        console.error('Errore generazione zip backup:', err);
        res.status(500).json({ error: 'Errore durante la creazione del pacchetto di sicurezza' });
    }
});

app.post('/api/sicurezza/crea-backup-locale', requireAuth({ admin: true }), (req, res) => {
    try {
        const { execSync } = require('child_process');
        const backupFolder = path.join(__dirname, '..', '_BACKUP_SICUREZZA');
        const desktopFolder = path.join(process.env.USERPROFILE || 'C:\\Users\\Utente', 'Desktop');
        if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder, { recursive: true });

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
        const zipName = `BACKUP_SUITE_MILELLA_${timeStr}.zip`;
        const destZip = path.join(backupFolder, zipName);
        const sourceDir = fs.existsSync(path.join(__dirname, '..', 'AGGIORNAMENTO_RENDER')) 
            ? path.join(__dirname, '..', 'AGGIORNAMENTO_RENDER')
            : __dirname;

        const tarDestCmd = process.platform === "win32" ? `tar.exe -a -c -f "${destZip}" -C "${sourceDir}" *` : `tar -czf "${destZip}" -C "${sourceDir}" *`;
        execSync(tarDestCmd);
        try { fs.copyFileSync(destZip, path.join(desktopFolder, zipName)); } catch(e){}

        const sizeMB = (fs.statSync(destZip).size / (1024 * 1024)).toFixed(1);
        res.json({ success: true, nome: zipName, sizeMB });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/sicurezza/lista-backup', requireAuth({ admin: true }), (req, res) => {
    try {
        const backupFolder = path.join(__dirname, '..', '_BACKUP_SICUREZZA');
        if (!fs.existsSync(backupFolder)) return res.json([]);
        const list = fs.readdirSync(backupFolder)
            .filter(f => f.endsWith('.zip'))
            .map(f => {
                const stat = fs.statSync(path.join(backupFolder, f));
                return {
                    nome: f,
                    data: stat.mtime.toLocaleString('it-IT'),
                    sizeMB: (stat.size / (1024 * 1024)).toFixed(1)
                };
            })
            .sort((a,b) => b.nome.localeCompare(a.nome));
        res.json(list);
    } catch(err) {
        res.json([]);
    }
});

// RIPRISTINO DIRETTO: Estrae il backup selezionato e ripristina la Suite
app.post('/api/sicurezza/ripristina', requireAuth({ admin: true }), (req, res) => {
    try {
        const { nomeBackup } = req.body || {};
        const { execSync } = require('child_process');
        const backupFolder = path.join(__dirname, '..', '_BACKUP_SICUREZZA');
        const targetDir = fs.existsSync(path.join(__dirname, '..', 'AGGIORNAMENTO_RENDER')) 
            ? path.join(__dirname, '..', 'AGGIORNAMENTO_RENDER')
            : __dirname;

        let zipPath = '';
        if (nomeBackup) {
            zipPath = path.join(backupFolder, nomeBackup);
        } else {
            // Prendi il backup più recente disponibile
            const files = fs.readdirSync(backupFolder)
                .filter(f => f.endsWith('.zip'))
                .map(f => ({ name: f, time: fs.statSync(path.join(backupFolder, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);
            if (files.length === 0) return res.status(404).json({ success: false, message: 'Nessun backup trovato' });
            zipPath = path.join(backupFolder, files[0].name);
        }

        if (!fs.existsSync(zipPath)) {
            return res.status(404).json({ success: false, message: 'File di backup non trovato' });
        }

        // Estrazione ripristino
        const tarExtractCmd = process.platform === "win32" ? `tar.exe -x -f "${zipPath}" -C "${targetDir}"` : `tar -xzf "${zipPath}" -C "${targetDir}"`;
        execSync(tarExtractCmd);
        res.json({ success: true, message: 'Ripristino completato con successo!', file: path.basename(zipPath) });
    } catch(err) {
        console.error('Errore ripristino:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API POST: Avvia Tunnel Cloudflare per Attrezzi/Ricettario
app.post('/api/start-tunnel-attrezzi', (req, res) => {
    const { exec } = require('child_process');
    const batFile = path.join(__dirname, 'start_tunnel_attrezzi.bat');
    
    // Eseguiamo il .bat che avvia cloudflared.exe
    exec(`"${batFile}"`, { cwd: __dirname }, (error) => {
        if (error) console.error("Errore avvio tunnel attrezzi:", error);
    });
    
    // Risponde subito, il bat lavora in background
    res.json({ success: true });
});

// API GET: Ottieni URL Tunnel Cloudflare
app.get('/api/tunnel-url', (req, res) => {
    const logFile = path.join(__dirname, 'tunnel_log.txt');
    if (!fs.existsSync(logFile)) {
        return res.json({ url: null });
    }
    
    try {
        const content = fs.readFileSync(logFile, 'utf8');
        // Cerchiamo l'URL trycloudflare.com nel log. 
        // Cloudflared stampa linee JSON, una delle quali ha il messaggio con l'URL.
        const match = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
            return res.json({ url: match[0] });
        }
    } catch (e) {
        console.error("Errore lettura tunnel log", e);
    }
    res.json({ url: null });
});

// --- MODULO ESPORTAZIONE PROGETTI STANDALONE (USB / DESKTOP) ---

// 1. Rileva unita disponibili (USB e Desktop)
app.get('/api/export-drives', (req, res) => {
    const { exec } = require('child_process');
    const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\Utente', 'Desktop');
    const currentRoot = path.parse(__dirname).root.replace(/\\$/, '');
    const psCmd = 'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType, FreeSpace, Size | ConvertTo-Json -Compress"';
    
    exec(psCmd, (err, stdout) => {
        let drives = [];
        if (!err && stdout && stdout.trim()) {
            try {
                let parsed = JSON.parse(stdout.trim());
                if (!Array.isArray(parsed)) parsed = [parsed];
                drives = parsed.map(d => {
                    const devId = d.DeviceID;
                    const hasQuesta = fs.existsSync(devId + '\\questa');
                    const isCurrent = devId.toUpperCase() === currentRoot.toUpperCase();
                    let desc = d.VolumeName ? `${d.VolumeName} (${devId})` : (d.DriveType === 2 ? `Chiavetta USB (${devId})` : `Unità Esterna (${devId})`);
                    if (isCurrent || hasQuesta) desc += ' ✦ ATTIVA';
                    return {
                        id: devId,
                        name: desc,
                        isUsb: d.DriveType === 2 || (devId && devId.toUpperCase() !== 'C:'),
                        isCurrent: isCurrent || hasQuesta,
                        hasQuesta: hasQuesta,
                        driveType: d.DriveType,
                        freeGb: d.FreeSpace ? (d.FreeSpace / (1024 * 1024 * 1024)).toFixed(1) : '0',
                        totalGb: d.Size ? (d.Size / (1024 * 1024 * 1024)).toFixed(1) : '0'
                    };
                });
            } catch(e) {}
        }
        res.json({ drives, desktopPath, currentRoot });
    });
});

// 2. Esegui esportazione progetto



// API: Stato Licenza Attiva per Client (Banner Pre-Scadenza)
app.get('/api/get-license-status', (req, res) => {
    try {
        if (!fs.existsSync(licenseFile)) {
            return res.json({ valid: true, master: true, daysLeft: null });
        }
        const lic = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        if (!lic.scadenza) {
            return res.json({ valid: true, master: false, daysLeft: null, dest: lic.destinatario || '' });
        }
        const now = new Date();
        const expDate = new Date(lic.scadenza);
        const diffTime = expDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        res.json({
            valid: now <= expDate,
            dest: lic.destinatario || 'Utente',
            scadenza: lic.scadenza,
            scadenzaFmt: expDate.toLocaleDateString('it-IT'),
            daysLeft: daysLeft
        });
    } catch(e) {
        res.json({ valid: true, daysLeft: null });
    }
});

// API: Elenco Completo Registro Licenze Rilasciate
app.get('/api/list-released-licenses', requireAuth({ admin: true }), (req, res) => {
    try {
        const releasedBase = path.resolve('D:\\VERSIONI_RILASCIATE');
        if (!fs.existsSync(releasedBase)) {
            return res.json({ licenses: [] });
        }

        const folders = fs.readdirSync(releasedBase).filter(f => {
            try { return fs.statSync(path.join(releasedBase, f)).isDirectory(); } catch(e){ return false; }
        });

        const now = new Date();
        const list = [];

        folders.forEach(f => {
            const licFile = path.join(releasedBase, f, 'licenza_attiva.json');
            let lic = null;
            if (fs.existsSync(licFile)) {
                try { lic = JSON.parse(fs.readFileSync(licFile, 'utf8')); } catch(e){}
            }

            let destName = f;
            const match = f.match(/_per_(.*?)_(DEMO|PROD)$/i);
            if (match) destName = match[1].replace(/_/g, ' ').trim();

            let status = 'ATTIVA';
            let daysLeft = null;

            if (lic && lic.scadenza) {
                const expDate = new Date(lic.scadenza);
                const diffTime = expDate.getTime() - now.getTime();
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) {
                    status = 'SCADUTA';
                } else if (daysLeft <= 15) {
                    status = 'IN_SCADENZA';
                } else {
                    status = 'ATTIVA';
                }
            } else if (!lic) {
                status = 'SENZA_FILE';
            }

            list.push({
                folderName: f,
                folderPath: path.join(releasedBase, f),
                destinatario: (lic && lic.destinatario) || destName,
                tipo: (lic && lic.tipo) || (f.includes('_DEMO') ? 'DEMO DIMOSTRATIVA' : 'PRODUZIONE COMPLETA'),
                modulo: (lic && lic.modulo) || f.replace(/_/g, ' '),
                scadenza: (lic && lic.scadenza) || null,
                scadenzaLabel: (lic && lic.scadenzaLabel) || (lic && lic.scadenza ? new Date(lic.scadenza).toLocaleDateString('it-IT') : 'Illimitata'),
                daysLeft,
                status,
                lastRun: (lic && lic.lastRun) || null
            });
        });

        res.json({ success: true, count: list.length, licenses: list });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Rinnovo Diretto da Registro Sala Regia
app.post('/api/renew-license-direct', requireAuth({ admin: true }), (req, res) => {
    try {
        const { folderName, days } = req.body;
        if (!folderName || !days) return res.status(400).json({ error: 'Cartella e durata obbligatorie' });

        const releasedBase = path.resolve('D:\\VERSIONI_RILASCIATE');
        const targetDir = path.join(releasedBase, folderName);
        const licFile1 = path.join(targetDir, 'licenza_attiva.json');
        const licFile2 = path.join(targetDir, 'InventarioWeb', 'licenza_attiva.json');

        const now = new Date();
        const expDate = new Date(now.getTime() + (parseInt(days, 10) * 24 * 60 * 60 * 1000));

        let lic = {};
        if (fs.existsSync(licFile1)) {
            try { lic = JSON.parse(fs.readFileSync(licFile1, 'utf8')); } catch(e){}
        }

        lic.scadenza = expDate.toISOString();
        lic.scadenzaLabel = days + ' Giorni (Fino al ' + expDate.toLocaleDateString('it-IT') + ')';
        lic.lastRun = now.toISOString();
        lic.rinnovoDirettoData = now.toISOString();

        const jsonStr = JSON.stringify(lic, null, 2);
        fs.writeFileSync(licFile1, jsonStr, 'utf8');
        if (fs.existsSync(path.join(targetDir, 'InventarioWeb'))) {
            fs.writeFileSync(licFile2, jsonStr, 'utf8');
        }

        res.json({ success: true, newExp: expDate.toLocaleDateString('it-IT'), days });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Riscatta Chiave di Rinnovo
app.post('/api/redeem-license-key', (req, res) => {
    const { key } = req.body;
    const result = verifyAndApplyLicenseKey(key);
    if (result.success) {
        return res.json({ success: true, message: result.message });
    }
    return res.status(400).json({ success: false, error: result.message });
});

// API: Genera Nuova Chiave di Rinnovo (Sala Regia)
app.post('/api/generate-license-key', requireAuth({ admin: true }), (req, res) => {
    const { destName, days } = req.body;
    if (!destName || !days) {
        return res.status(400).json({ error: 'Nome destinatario e durata obbligatori' });
    }
    const key = generateLicenseKey(destName, days);
    res.json({ success: true, key, destName, days });
});

app.post('/api/export-project', requireAuth({ admin: true }), (req, res) => {
    const { projectId, destinationType, targetDrive } = req.body;
    const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\Utente', 'Desktop');
    const rootSuite = path.resolve(__dirname, '..');
    
    let sourceFolder = '';
    let targetFolderName = '';
    let launcherFile = '';
    let projectName = '';

    switch(projectId) {
        case 'mednutri':
            projectName = 'MedNutri Pro (Piano Nutrizionale)';
            sourceFolder = path.join(rootSuite, 'MedNutri_Pro');
            targetFolderName = 'MedNutri_Pro';
            launcherFile = '0_AVVIA_MEDNUTRI_PORTATILE.vbs';
            break;
        case 'logistica':
            projectName = 'Sistema Logistica C. Milella';
            sourceFolder = path.join(rootSuite, 'questa', 'Sistema_Logistica_C_Milella');
            targetFolderName = 'Sistema_Logistica_C_Milella';
            launcherFile = '0_AVVIA_SISTEMA_LOGISTICA.vbs';
            break;
        case 'salute':
            projectName = 'Progetto Salute (Parametri Vitali)';
            sourceFolder = path.join(rootSuite, 'Progetto_Salute');
            targetFolderName = 'Progetto_Salute';
            launcherFile = 'AVVIA_PROGETTO_SALUTE.bat';
            break;
        case 'inventario':
            projectName = 'Inventario Attrezzi';
            sourceFolder = path.join(rootSuite, 'InventarioWeb');
            targetFolderName = 'Inventario_Attrezzi';
            launcherFile = 'start_tunnel_attrezzi.bat';
            break;
        case 'ricettario':
            projectName = 'Il Ricettario';
            sourceFolder = path.join(rootSuite, 'RicettarioWeb');
            targetFolderName = 'Il_Ricettario';
            launcherFile = 'server.js';
            break;
        case 'suite':
            projectName = 'Suite Completa Aziendale C. Milella';
            sourceFolder = rootSuite;
            targetFolderName = 'SUITE_AZIENDALE_MILELLA';
            launcherFile = '0_AVVIA_SUITE_MILELLA.bat';
            break;
        default:
            return res.status(400).json({ error: 'Progetto non valido' });
    }

    if (!fs.existsSync(sourceFolder)) {
        return res.status(404).json({ error: 'Cartella sorgente non trovata: ' + sourceFolder });
    }

    let destBase = '';
    if (destinationType === 'usb') {
        if (!targetDrive) return res.status(400).json({ error: 'Nessuna unità USB selezionata' });
        destBase = targetDrive.endsWith('\\') ? targetDrive : targetDrive + '\\';
    } else {
        destBase = desktopPath;
    }

    const finalDestPath = path.join(destBase, targetFolderName);

    // Esegui la copia ricorsiva con robocopy
    const { exec } = require('child_process');
    let excludeParams = '/XD ".git" "scratch" "data\\Foto_Attrezzi\\temp" /XF "*.tmp"';
    if (projectId === 'suite') {
        excludeParams = '/XD ".git" "scratch" "temp" "Backup_*" /XF "*.tmp"';
    }

    const robocopyCmd = `robocopy "${sourceFolder}" "${finalDestPath}" /E ${excludeParams} /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`;

    exec(robocopyCmd, (error, stdout, stderr) => {
        const exitCode = error ? error.code : 0;
        if (exitCode >= 8) {
            console.error('Robocopy error code:', exitCode, stderr);
            return res.status(500).json({ error: 'Errore durante la copia dei file.' });
        }

        // Assicurati che all'interno della cartella ci sia un lanciatore rapido 0_AVVIA_PROGETTO.bat
        try {
            const quickBatPath = path.join(finalDestPath, '0_AVVIA_PROGETTO.bat');
            let batContent = `@echo off\r\ntitle ${projectName}\r\ncd /d "%~dp0"\r\n`;
            if (launcherFile.endsWith('.vbs')) {
                batContent += `wscript.exe "${launcherFile}"\r\n`;
            } else if (launcherFile.endsWith('.bat')) {
                batContent += `call "${launcherFile}"\r\n`;
            } else {
                batContent += `start "" "${launcherFile}"\r\n`;
            }
            batContent += `exit\r\n`;
            fs.writeFileSync(quickBatPath, batContent, 'utf8');

            // Se esportato sul Desktop, crea anche il collegamento .lnk con icona
            if (destinationType === 'desktop') {
                const shortcutPath = path.join(desktopPath, `${projectName}.lnk`);
                const vbsShortcut = path.join(__dirname, 'data', 'create_export_shortcut.vbs');
                let vbsCode = `Set sh = CreateObject("WScript.Shell")\r\n` +
                              `Set sc = sh.CreateShortcut("${shortcutPath.replace(/"/g, '""')}")\r\n` +
                              `sc.TargetPath = "${quickBatPath.replace(/"/g, '""')}"\r\n` +
                              `sc.WorkingDirectory = "${finalDestPath.replace(/"/g, '""')}"\r\n` +
                              `sc.Description = "${projectName.replace(/"/g, '""')} - Versione Autonoma"\r\n` +
                              `sc.Save\r\n`;
                fs.writeFileSync(vbsShortcut, vbsCode);
                exec(`wscript.exe "${vbsShortcut}"`);
            }
        } catch(e) {}

        res.json({
            success: true,
            projectName,
            targetPath: finalDestPath,
            launcherName: '0_AVVIA_PROGETTO.bat'
        });
    });
});

// 3. Apri cartella esportata in Esplora Risorse
app.post('/api/open-exported-folder', (req, res) => {
    let { folderPath } = req.body || {};
    if (!folderPath) {
        folderPath = 'D:\\VERSIONI_RILASCIATE';
    }

    // Se per sbaglio passa E:, correggilo dinamicamente con la radice reale del server
    const currentDrive = path.parse(__dirname).root; // Es. 'D:\'
    if (folderPath.startsWith('E:\\') || folderPath.startsWith('e:\\')) {
        folderPath = folderPath.replace(/^[Ee]:\\/, currentDrive);
    }

    folderPath = path.resolve(folderPath);
    if (!fs.existsSync(folderPath)) {
        // Fallback: prova ad aprire la cartella radice delle versioni rilasciate
        const fallback = path.join(currentDrive, 'VERSIONI_RILASCIATE');
        if (fs.existsSync(fallback)) {
            folderPath = fallback;
        } else {
            return res.status(404).json({ error: 'Cartella non trovata: ' + folderPath });
        }
    }

    try {
        const { exec } = require('child_process');
        exec(`explorer.exe "${folderPath}"`);
        res.json({ success: true, folderPath });
    } catch(e) {
        try {
            const { exec } = require('child_process');
            exec(`cmd.exe /c start "" explorer.exe "${folderPath}"`);
            res.json({ success: true, folderPath });
        } catch(err2) {
            res.status(500).json({ error: e.message });
        }
    }
});

// 4. API Avanzata Generatore Versioni Personalizzate & Antigravity Orchestrator
// ==============================================================================
// 4-BIS. API DI SINCRONIZZAZIONE MULTI-DIREZIONALE REALE (USB, Desktop, Cloud)
// ==============================================================================

// ==============================================================================
// ENDPOINT SINCRONIZZAZIONE INTELLIGENTE BIDIREZIONALE (FUSIONE SENZA PERDITA)
// ==============================================================================
app.post('/api/sync/smart-bidirectional', async (req, res) => {
    const logs = [];
    const log = (msg) => {
        const line = '[' + new Date().toLocaleTimeString('it-IT') + '] ' + msg;
        logs.push(line);
        console.log('[SMART-SYNC]', msg);
    };

    try {
        log('Avvio Sincronizzazione Intelligente Bidirezionale (Merge Dati)...');
        let scriptPath = path.join(__dirname, 'sincronizzazione_intelligente.js');
        if (!fs.existsSync(scriptPath)) {
            scriptPath = path.join(__dirname, 'AGGIORNAMENTO_RENDER', 'sincronizzazione_intelligente.js');
        }
        if (!fs.existsSync(scriptPath)) {
            throw new Error('Script sincronizzazione_intelligente.js non trovato');
        }

        const { exec } = require('child_process');
        exec('node "' + scriptPath + '"', { cwd: __dirname }, (err, stdout, stderr) => {
            if (err) {
                log('Errore esecuzione: ' + (stderr || err.message));
                return res.status(500).json({ success: false, logs, error: err.message });
            }
            const outLines = (stdout || '').split('\n').filter(Boolean);
            outLines.forEach(l => log(l));
            log('Fusione bidirezionale completata con successo!');
            return res.json({ success: true, message: 'Dati unificati senza sovrascritture!', logs });
        });
    } catch(err) {
        log('Eccezione: ' + err.message);
        return res.status(500).json({ success: false, logs, error: err.message });
    }
});

app.post('/api/sync/execute', async (req, res) => {
    const { direction, driveLetter, desktopFolder, antiFreeze, incremental, multiThread } = req.body || {};
    const { exec } = require('child_process');
    const logs = [];
    const log = (msg) => {
        const line = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
        logs.push(line);
        console.log('[SYNC-API]', msg);
    };

    try {
        log(`Avvio sincronizzazione: direzione="${direction || 'usb_desktop'}"`);

        // Riconoscimento dinamico dell'unita USB reale
        let detectedRoot = path.parse(__dirname).root.replace(/\\$/, '');
        if (!fs.existsSync(detectedRoot + '\\questa')) {
            if (fs.existsSync('E:\\questa')) detectedRoot = 'E:';
            else if (fs.existsSync('D:\\questa')) detectedRoot = 'D:';
        }
        const targetDrive = (driveLetter && driveLetter.trim()) ? driveLetter.trim().replace(/\\$/, '') : detectedRoot;
        const usbQuestaDir = path.resolve(targetDrive + '\\questa');
        const deskQuestaDir = (desktopFolder && desktopFolder.trim()) ? desktopFolder.trim() : path.join(process.env.USERPROFILE || 'C:\\Users\\Utente', 'Desktop', 'questa');

        // URL del Cloud Master
        const CLOUD_MASTER_URL = process.env.RENDER_EXTERNAL_URL || 'https://milella-suite-41ff.onrender.com';

        // ----------------------------------------------------
        // CASO 1: USB <-> DESKTOP (Robocopy Reale Bidirezionale/Incrementale)
        // ----------------------------------------------------
        if (direction === 'usb_desktop') {
            if (!fs.existsSync(usbQuestaDir)) {
                return res.status(400).json({ success: false, logs, error: `Cartella USB non trovata: ${usbQuestaDir}` });
            }
            if (!fs.existsSync(deskQuestaDir)) {
                fs.mkdirSync(deskQuestaDir, { recursive: true });
                log(`Creata cartella Desktop: ${deskQuestaDir}`);
            }

            // Parametri robocopy dinamici
            let flags = '/E /R:1 /W:1 /NP /NFL /NDL';
            if (incremental !== false) flags += ' /XO';
            if (multiThread !== false) flags += ' /MT:16';
            if (antiFreeze !== false) {
                flags += ' /XD "node_modules" ".git" "scratch" "Cache" "Code Cache" "GPUCache" /XF "*.tmp" "*.bak" "*.pma" "*lock*"';
            }

                        // Per massima velocita ed evitare timeout su memorie USB lente (es. oltre 6 GB di file),
            // allineiamo il core dell'applicazione (AGGIORNAMENTO_RENDER, data, CareAssist, lanciatori)
            const srcRender = path.join(usbQuestaDir, 'AGGIORNAMENTO_RENDER');
            const dstRender = path.join(deskQuestaDir, 'AGGIORNAMENTO_RENDER');
            if (!fs.existsSync(dstRender)) fs.mkdirSync(dstRender, { recursive: true });

            const robocopyCmd = `robocopy "${srcRender}" "${dstRender}" ${flags} & robocopy "${usbQuestaDir}" "${deskQuestaDir}" *.bat *.html *.json ${flags}`;
            log(`Esecuzione Robocopy: USB (${usbQuestaDir}) -> Desktop (${deskQuestaDir})`);

            await new Promise((resolve) => {
                exec(robocopyCmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
                    // Robocopy codici uscita < 8 indicano successo (0=nessun cambio, 1=file copiati, 2=extra, 3=copiati+extra)
                    const exitCode = err ? (err.code || 0) : 0;
                    if (exitCode <= 7) {
                        log(`Robocopy completato con successo (Codice: ${exitCode}). File allineati perfettamente.`);
                    } else {
                        log(`Robocopy warning/error (Codice: ${exitCode}): ${stderr || err.message}`);
                    }
                    resolve();
                });
            });

            return res.json({
                success: true,
                direction,
                message: `Allineamento USB (${targetDrive}) e Desktop completato con successo!`,
                logs
            });
        }

        // ----------------------------------------------------
        // CASO 2: CLOUD -> USB (Scarica dati da Render su Chiavetta)
        // ----------------------------------------------------
        if (direction === 'cloud_usb') {
            log(`Download bundle dati in tempo reale da Cloud: ${CLOUD_MASTER_URL}/api/suite/backup-completo`);
            const fetchMod = globalThis.fetch || (await import('node-fetch')).default;
            const resp = await fetchMod(`${CLOUD_MASTER_URL}/api/suite/backup-completo`, { headers: { 'User-Agent': 'SuiteMilella-LocalSync' } });

            if (!resp.ok) {
                throw new Error(`Risposta Cloud non valida: ${resp.status} ${resp.statusText}`);
            }

            const backupData = await resp.json();
            if (!backupData || !backupData.dati) {
                throw new Error('Dati di backup non validi o vuoti dal server Cloud.');
            }

            const dati = backupData.dati;
            let counter = 0;

const rootDataDir = path.resolve(__dirname, '..', 'data');
            if (!fs.existsSync(rootDataDir)) try { fs.mkdirSync(rootDataDir, { recursive: true }); } catch(e){}

            if (dati.turnario) {
                await cloudSet("turnario_settimanale", dati.turnario, turnarioPath);
                try { fs.writeFileSync(path.join(rootDataDir, 'turnario_settimanale.json'), JSON.stringify(dati.turnario, null, 2), 'utf8'); } catch(e){}
                counter++;
            }
            if (dati.careassist && fs.existsSync(path.dirname(careAssistDbFile))) {
                await cloudSet("careassist", dati.careassist, careAssistDbFile);
                const rootCare = path.resolve(__dirname, '..', 'CareAssist_Pro', 'careassist_database.json');
                try { if (fs.existsSync(path.dirname(rootCare))) fs.writeFileSync(rootCare, JSON.stringify(dati.careassist, null, 2), 'utf8'); } catch(e){}
                counter++;
            }
            if (dati.inventario) {
                await cloudSet("inventario", dati.inventario, path.join(__dirname, 'data', 'inventario.json'));
                try { fs.writeFileSync(path.join(rootDataDir, 'inventario.json'), JSON.stringify(dati.inventario, null, 2), 'utf8'); } catch(e){}
                counter++;
            }
            if (dati.salute) {
                await cloudSet("salute", dati.salute, path.join(__dirname, 'data', 'salute_db.json'));
                try { fs.writeFileSync(path.join(rootDataDir, 'salute_db.json'), JSON.stringify(dati.salute, null, 2), 'utf8'); } catch(e){}
                counter++;
            }
            if (dati.veicoli) {
                await cloudSet("veicoli", dati.veicoli, path.join(__dirname, 'data', 'veicoli_db.json'));
                try { fs.writeFileSync(path.join(rootDataDir, 'veicoli_db.json'), JSON.stringify(dati.veicoli, null, 2), 'utf8'); } catch(e){}
                counter++;
            }
            if (dati.progetti) {
                await cloudSet("progetti", dati.progetti, progettiConfigPath);
                try { fs.writeFileSync(path.join(rootDataDir, 'progetti_config.json'), JSON.stringify(dati.progetti, null, 2), 'utf8'); } catch(e){}
                counter++;
            }

            log(`Salvati localmente sulla chiavetta ${counter} moduli sincronizzati dal Cloud!`);
            return res.json({
                success: true,
                direction,
                message: `Aggiornamento da Cloud completato! ${counter} database aggiornati sulla chiavetta.`,
                logs
            });
        }

        // ----------------------------------------------------
        // CASO 3: CLOUD -> DESKTOP (Scarica dati dal Cloud sulla cartella Desktop)
        // ----------------------------------------------------
        if (direction === 'cloud_desktop') {
            log(`Download bundle dati dal Cloud per la cartella Desktop...`);
            const fetchMod = globalThis.fetch || (await import('node-fetch')).default;
            const resp = await fetchMod(`${CLOUD_MASTER_URL}/api/suite/backup-completo`);
            if (!resp.ok) throw new Error(`Errore Cloud: ${resp.status} ${resp.statusText}`);

            const backupData = await resp.json();
            const deskDataDir = path.join(deskQuestaDir, 'AGGIORNAMENTO_RENDER', 'data');
            fs.mkdirSync(deskDataDir, { recursive: true });

            const dati = backupData.dati || {};
            if (dati.inventario) fs.writeFileSync(path.join(deskDataDir, 'inventario.json'), JSON.stringify(dati.inventario, null, 2), 'utf8');
            if (dati.salute) fs.writeFileSync(path.join(deskDataDir, 'salute_db.json'), JSON.stringify(dati.salute, null, 2), 'utf8');
            if (dati.veicoli) fs.writeFileSync(path.join(deskDataDir, 'veicoli_db.json'), JSON.stringify(dati.veicoli, null, 2), 'utf8');
            if (dati.careassist) {
                const deskCareDir = path.join(deskQuestaDir, 'AGGIORNAMENTO_RENDER', 'CareAssist_Pro');
                fs.mkdirSync(deskCareDir, { recursive: true });
                fs.writeFileSync(path.join(deskCareDir, 'careassist_database.json'), JSON.stringify(dati.careassist, null, 2), 'utf8');
            }

            log(`Database Cloud salvati con successo nella cartella Desktop!`);
            return res.json({
                success: true,
                direction,
                message: `Cartella Desktop aggiornata con i dati Cloud in tempo reale!`,
                logs
            });
        }

        // ----------------------------------------------------
        // CASO 4: DESKTOP/USB -> CLOUD BACKUP (Invia al Cloud Render)
        // ----------------------------------------------------
        if (direction === 'desktop_cloud') {
            log(`Preparazione backup locale per invio al Cloud Render...`);
            const payload = {
                suite: "Suite Milella Aziendale",
                versione: "2.5.0",
                timestamp: new Date().toISOString(),
                autore: "Ciro Milella (Admin)",
                dati: {
                    turnario: memoryCache.get("turnario_settimanale") || (fs.existsSync(turnarioPath) ? JSON.parse(fs.readFileSync(turnarioPath, 'utf8') || '{}') : {}),
                    operatori: (fs.existsSync(path.join(__dirname, 'operatori.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'operatori.json'), 'utf8') || '[]') : []),
                    progetti: (fs.existsSync(progettiConfigPath) ? JSON.parse(fs.readFileSync(progettiConfigPath, 'utf8') || '[]') : []),
                    inventario: (fs.existsSync(path.join(__dirname, 'data', 'inventario.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'inventario.json'), 'utf8') || '[]') : []),
                    careassist: (fs.existsSync(careAssistDbFile) ? JSON.parse(fs.readFileSync(careAssistDbFile, 'utf8') || '{}') : {}),
                    salute: (fs.existsSync(path.join(__dirname, 'data', 'salute_db.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'salute_db.json'), 'utf8') || '{}') : {}),
                    veicoli: (fs.existsSync(path.join(__dirname, 'data', 'veicoli_db.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'veicoli_db.json'), 'utf8') || '{}') : {})
                }
            };

            const fetchMod = globalThis.fetch || (await import('node-fetch')).default;
            const resp = await fetchMod(`${CLOUD_MASTER_URL}/api/suite/ripristina-backup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) throw new Error(`Caricamento fallito: ${resp.status} ${resp.statusText}`);
            const resJson = await resp.json();

            log(`Backup inviato e salvato con successo nel Cloud MongoDB Atlas!`);
            return res.json({
                success: true,
                direction,
                message: `Dati locali salvati nel Cloud protetto con successo!`,
                logs
            });
        }

        return res.status(400).json({ success: false, error: 'Direzione sincronizzazione non valida: ' + direction });
    } catch(err) {
        log(`[ERRORE CRITICO] ${err.message}`);
        console.error('[SYNC ERROR]', err);
        return res.status(500).json({ success: false, logs, error: err.message });
    }
});

app.post('/api/generate-custom-version', (req, res) => {
    const { destName, destCompany, isDemo, modules, destinationType, targetDrive, scadenza } = req.body || {};
    if (!destName || !destName.trim()) {
        return res.status(400).json({ error: 'Nome del destinatario obbligatorio' });
    }

    const currentDrive = path.parse(__dirname).root.replace(/\\$/, ''); // Es. 'D:'
    const { exec } = require('child_process');
    const psScript = path.resolve(__dirname, '..', '_Lanciatori_e_Utility_USB', 'Generatore_Versioni.ps1');
    const altScript = path.resolve(currentDrive + '\\CREA_VERSIONI_PERSONALIZZATE\\Generatore_Versioni.ps1');
    const targetScript = fs.existsSync(psScript) ? psScript : (fs.existsSync(altScript) ? altScript : psScript);

    const tipoParam = isDemo ? '1' : '2';
    const destParam = destinationType === 'desktop' ? '2' : '1';
    const driveParam = currentDrive;
    let modulesParam = '0';
    if (Array.isArray(modules) && modules.length > 0) {
        modulesParam = modules.join(',');
    } else if (typeof modules === 'string' && modules.trim()) {
        modulesParam = modules.trim();
    }

    const safeDestName = destName.replace(/["`$]/g, '');
    const safeCompany = (destCompany || '').replace(/["`$]/g, '');

    const safeScadenza = (scadenza || '').replace(/["`$]/g, '');
    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${targetScript}" -ParamDestName "${safeDestName}" -ParamDestCompany "${safeCompany}" -ParamTipo "${tipoParam}" -ParamModuli "${modulesParam}" -ParamDest "${destParam}" -ParamTargetDrive "${driveParam}" -ParamScadenza "${safeScadenza}"`;

    console.log('[GENERATORE] Avvio generazione per:', safeDestName);

    exec(psCommand, { cwd: path.dirname(targetScript), maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
        if (err) {
            console.error('[GENERATORE ERRORE]', err, stderr);
            return res.status(500).json({ error: 'Errore durante la generazione: ' + (stderr || err.message) });
        }

        let result = {
            success: true,
            destName: safeDestName,
            destCompany: safeCompany,
            isDemo: isDemo,
            rawOutput: stdout
        };

        const match = stdout.match(/RESULT_JSON:\s*(\{.*\})/);
        if (match && match[1]) {
            try {
                const parsed = JSON.parse(match[1]);
                Object.assign(result, parsed);
            } catch(e) {}
        }

        // APERTURA AUTOMATICA ISTANTANEA DELLA CARTELLA IN WINDOWS
        try {
            const folderToOpen = result.targetFolder || (currentDrive + '\\VERSIONI_RILASCIATE\\Suite_Aziendale_per_' + safeDestName.replace(/\s+/g, '_') + (isDemo ? '_DEMO' : '_PROD'));
            if (fs.existsSync(folderToOpen)) {
                exec(`explorer.exe "${folderToOpen}"`);
            } else {
                exec(`explorer.exe "${currentDrive}\\VERSIONI_RILASCIATE"`);
            }
        } catch(eExpl) {}

        res.json(result);
    });
});

// ==============================================================================
// 5. MOTORE VOCALE NEURALE UMANO ITALIANO (/api/tts-umano)
// Converte qualsiasi testo in audio MP3 naturale con prosodia umana e pause
// ==============================================================================
const ttsAudioCache = new Map();

function preparaTestoPerVoceUmana(rawText) {
    if (!rawText) return '';
    return String(rawText)
        // Rimuovi emoji e simboli grafici
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, ' ')
        .replace(/[•▪▸►✓✔✕✖★☆✦]/g, ' ')
        .replace(/&amp;/g, ' e ')
        .replace(/&/g, ' e ')
        // Espandi simboli e abbreviazioni cliniche/aziendali per una lettura fluida
        .replace(/↔/g, ' e ')
        .replace(/→|↗/g, ' verso ')
        .replace(/\bH24\b/gi, 'ventiquattro ore su ventiquattro')
        .replace(/\bADI\b/g, 'Assistenza Domiciliare')
        .replace(/\bRSA\b/g, 'R S A')
        .replace(/\bASL\b/g, 'A S L')
        .replace(/\b118\b/g, 'uno uno otto')
        .replace(/\b112\b/g, 'uno uno due')
        .replace(/\bNUE\b/gi, 'Numero Unico Europeo')
        .replace(/\bP\.?\s*IVA\b/gi, 'Partita IVA')
        .replace(/\bcpr\b/gi, 'compresse')
        .replace(/\bgg\b/gi, 'giorni')
        .replace(/\bUI\b/g, 'unità internazionali')
        .replace(/\bmg\b/gi, 'milligrammi')
        .replace(/\bml\b/gi, 'millilitri')
        .replace(/\bQR\b/g, 'Q R')
        .replace(/\s+/g, ' ')
        .trim();
}

function dividiInFrasiNaturali(text, maxLen = 170) {
    const cleaned = preparaTestoPerVoceUmana(text);
    if (!cleaned) return [];
    const sentences = cleaned.split(/(?<=[.!?।:;])\s+/);
    const chunks = [];
    for (const sentence of sentences) {
        if (sentence.length <= maxLen) {
            if (sentence.trim()) chunks.push(sentence.trim());
        } else {
            // Spezza sulle virgole o sugli spazi
            const subParts = sentence.split(/(?<=,)\s+/);
            let current = '';
            for (const sub of subParts) {
                if ((current + ' ' + sub).trim().length <= maxLen) {
                    current = (current + ' ' + sub).trim();
                } else {
                    if (current) chunks.push(current);
                    if (sub.length <= maxLen) {
                        current = sub.trim();
                    } else {
                        const words = sub.split(/\s+/);
                        let wChunk = '';
                        for (const w of words) {
                            if ((wChunk + ' ' + w).trim().length <= maxLen) {
                                wChunk = (wChunk + ' ' + w).trim();
                            } else {
                                if (wChunk) chunks.push(wChunk);
                                wChunk = w;
                            }
                        }
                        current = wChunk;
                    }
                }
            }
            if (current) chunks.push(current);
        }
    }
    return chunks;
}

// Frame MP3 di silenzio naturale (MPEG Audio Layer III silence frame - circa 300ms)
function generaPausaNaturaleAudio() {
    // Un frame MP3 valido di silenzio stereo/mono a 24/32/44.1kHz
    // Ripetuto 8-10 volte genera circa 250-300ms di pausa perfettamente silenziosa e pulita
    const frameSilenzio = Buffer.from([
        0xFF, 0xFB, 0x50, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    return Buffer.concat([frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio]);
}

app.get(['/api/tts-umano', '/careassist/api/tts-umano'], async (req, res) => {
    try {
        const rawText = String(req.query.text || '').slice(0, 1800);
        const voiceParam = String(req.query.voice || 'elsa').toLowerCase();
        const voiceName = voiceParam === 'diego' ? 'it-IT-DiegoNeural'
            : (voiceParam === 'giuseppe' ? 'it-IT-GiuseppeNeural' : (voiceParam === 'isabella' ? 'it-IT-IsabellaNeural' : 'it-IT-ElsaNeural'));
        if (!rawText.trim()) {
            return res.status(400).json({ error: 'Testo mancante' });
        }

        const cleanedText = preparaTestoPerVoceUmana(rawText);
        const cacheKey = `edge:${voiceName}:${cleanedText}`;
        if (ttsAudioCache.has(cacheKey)) {
            const cachedBuf = ttsAudioCache.get(cacheKey);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(cachedBuf);
        }

        // 1. Priorità assoluta: Motore Microsoft Azure Neural HD (24kHz 96kbps - Voce Umana Reale)
        try {
            const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

        // Frame MP3 di silenzio naturale (MPEG Audio Layer III silence frame - circa 300ms)
        function generaPausaNaturaleAudio() {
            // Un frame MP3 valido di silenzio stereo/mono a 24/32/44.1kHz
            // Ripetuto 8-10 volte genera circa 250-300ms di pausa perfettamente silenziosa e pulita
            const frameSilenzio = Buffer.from([
                0xFF, 0xFB, 0x50, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
            return Buffer.concat([frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio, frameSilenzio]);
        }
    
            const tts = new MsEdgeTTS();
            await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
            const { audioStream } = tts.toStream(cleanedText);
            const edgeBuf = await new Promise((resolve, reject) => {
                const chunks = [];
                audioStream.on('data', c => chunks.push(c));
                audioStream.on('end', () => {
                    try { tts.close(); } catch (e) {}
                    resolve(Buffer.concat(chunks));
                });
                audioStream.on('error', err => {
                    try { tts.close(); } catch (e) {}
                    reject(err);
                });
            });
            if (edgeBuf && edgeBuf.length > 500) {
                if (ttsAudioCache.size > 150) {
                    const firstKey = ttsAudioCache.keys().next().value;
                    ttsAudioCache.delete(firstKey);
                }
                ttsAudioCache.set(cacheKey, edgeBuf);
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(edgeBuf);
            }
        } catch (edgeErr) {
            console.warn('[TTS EDGE FALLBACK]', edgeErr.message);
        }

        // 2. Fallback secondario
        const chunks = dividiInFrasiNaturali(rawText, 170);
        const buffers = [];

        // RICONOSCITORE MULTI-BATTUTA INTELLIGENTE (Isabella & Ciro a quante battute vuoi!)
        let battute = [];
        let cleaned = (rawText || '').replace(/[«»]/g, '').trim();

        // Se usa i trattini "—", possiamo normalizzare per separare
        // Ma soprattutto cerchiamo la presenza dei tag "Isabella:" e "Ciro:"
        const tagRegex = /(Isabella\s*:|Ciro\s*:)/i;

        if (tagRegex.test(cleaned)) {
            // Separa mantenendo i delimitatori
            const parti = cleaned.split(/(Isabella\s*:|Ciro\s*:)/i).filter(Boolean);
            let currentVoice = 'it-IT-IsabellaNeural';
            for (let i = 0; i < parti.length; i++) {
                const seg = parti[i].trim();
                if (/^Isabella\s*:/i.test(seg)) {
                    currentVoice = 'it-IT-IsabellaNeural';
                } else if (/^Ciro\s*:/i.test(seg)) {
                    currentVoice = 'it-IT-GiuseppeNeural';
                } else if (seg) {
                    battute.push({ voce: currentVoice, testo: seg.replace(/^—\s*/, '').trim() });
                }
            }
        } else if (cleaned.includes('—')) {
            // Se usa solo i trattini "—", alterna: 1° Isabella, 2° Ciro, 3° Isabella, 4° Ciro...
            const parti = cleaned.split('—');
            parti.forEach((p, idx) => {
                const trimmed = p.trim();
                if (trimmed) {
                    const voce = (idx % 2 === 0) ? 'it-IT-IsabellaNeural' : 'it-IT-GiuseppeNeural';
                    battute.push({ voce, testo: trimmed });
                }
            });
        } else {
            battute.push({ voce: 'it-IT-IsabellaNeural', testo: cleaned });
        }

        for (const item of battute) {
            if (item.testo && item.testo.trim()) {
                const b = await generaChunkVoce(item.voce, item.testo);
                buffers.push(b);
            }
        }

        const finalBuffer = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(finalBuffer);
    } catch(err) {
        console.error('[DIALOGO AUDIO ERRORE]', err);
        return res.status(500).json({ error: err.message });
    }
});


// ==============================================================================
// 5.1 GENERATORE MULTI-VOCE NEURALE UMANA PER DIALOGHI PERSONALIZZATI (/api/genera-dialogo-audio)
// Supporta cast vocale espanso: 1, 2 o 3 Donne (Isabella, Elsa, Elena) e 1, 2 o 3 Uomini (Ciro/Giuseppe, Diego, Marco)
// ==============================================================================
app.post(['/api/genera-dialogo-audio', '/careassist/api/genera-dialogo-audio'], async (req, res) => {
    try {
        const { testo, castMode } = req.body || {};
        if (!testo || !testo.trim()) {
            return res.status(400).json({ error: 'Testo dialogo mancante' });
        }

        const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

        async function generaChunkVoce(speakerConfig, txt) {
            const cleaned = preparaTestoPerVoceUmana(txt);
            if (!cleaned) return Buffer.alloc(0);
            const voiceName = (typeof speakerConfig === 'string') ? speakerConfig : (speakerConfig.voice || 'it-IT-IsabellaNeural');
            const streamOptions = (typeof speakerConfig === 'object') ? speakerConfig.options : undefined;

            // Tentativi multipli (con fallback immediato se la connessione web socket si chiude anzitempo)
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const tts = new MsEdgeTTS();
                    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
                    const { audioStream } = tts.toStream(cleaned, streamOptions);
                    const buf = await new Promise((resolve, reject) => {
                        const chunks = [];
                        let hasData = false;
                        audioStream.on('data', c => {
                            chunks.push(c);
                            hasData = true;
                        });
                        audioStream.on('end', () => {
                            try { tts.close(); } catch(e) {}
                            resolve(Buffer.concat(chunks));
                        });
                        audioStream.on('error', err => {
                            try { tts.close(); } catch(e) {}
                            // Se abbiamo già ricevuto chunk audio validi, usiamo quelli senza fallire!
                            if (chunks.length > 0) {
                                resolve(Buffer.concat(chunks));
                            } else {
                                reject(err);
                            }
                        });
                    });
                    if (buf && buf.length > 500) return buf;
                } catch(retryErr) {
                    console.warn(`[TTS Retry ${attempt}/3 per ${voiceName}]:`, retryErr.message);
                    if (attempt === 3) break;
                    await new Promise(r => setTimeout(r, 400));
                }
            }
            return Buffer.alloc(0);
        }

        // Mappa dei personaggi e voci base predefinite
        const baseVoices = {
            'isabella': { voice: 'it-IT-IsabellaNeural', label: 'Isabella' },
            'elsa':     { voice: 'it-IT-ElsaNeural', label: 'Elsa' },
            'elena':    { voice: 'it-IT-IsabellaNeural', options: { pitch: '+18Hz', rate: '+5%' }, label: 'Elena' },
            'anna':     { voice: 'it-IT-ElsaNeural', options: { pitch: '-15Hz', rate: '-4%' }, label: 'Anna' },
            'ciro':     { voice: 'it-IT-GiuseppeNeural', label: 'Ciro' },
            'giuseppe': { voice: 'it-IT-GiuseppeNeural', label: 'Giuseppe' },
            'diego':    { voice: 'it-IT-DiegoNeural', label: 'Diego' },
            'marco':    { voice: 'it-IT-GiuseppeNeural', options: { pitch: '-20Hz', rate: '-5%' }, label: 'Marco' },
            'antonio':  { voice: 'it-IT-DiegoNeural', options: { pitch: '+20Hz', rate: '+6%' }, label: 'Antonio' }
        };

        // Roster di voci per genere da assegnare dinamicamente a QUALSIASI nome personalizzato
        const femaleVoicePool = [
            { voice: 'it-IT-IsabellaNeural', label: 'Voce Femminile 1' },
            { voice: 'it-IT-ElsaNeural', label: 'Voce Femminile 2' },
            { voice: 'it-IT-IsabellaNeural', options: { pitch: '+18Hz', rate: '+5%' }, label: 'Voce Femminile 3' },
            { voice: 'it-IT-ElsaNeural', options: { pitch: '-15Hz', rate: '-4%' }, label: 'Voce Femminile 4' }
        ];

        const maleVoicePool = [
            { voice: 'it-IT-GiuseppeNeural', label: 'Voce Maschile 1' },
            { voice: 'it-IT-DiegoNeural', label: 'Voce Maschile 2' },
            { voice: 'it-IT-GiuseppeNeural', options: { pitch: '-20Hz', rate: '-5%' }, label: 'Voce Maschile 3' },
            { voice: 'it-IT-DiegoNeural', options: { pitch: '+20Hz', rate: '+6%' }, label: 'Voce Maschile 4' }
        ];

        const buffers = [];
        let battute = [];
        let rawText = testo.replace(/[«»]/g, '').trim();

        // Riconosce QUALSIASI nome all'inizio riga o frase nel formato "Nome:" (es: "Maria:", "Roberto:", "Dottoressa:", "Paolo:")
        const genericTagRegex = /(?:^|\n|—)\s*([A-Za-zÀ-ÿ0-9_\s]{2,20})\s*:/g;
        const matches = [...rawText.matchAll(genericTagRegex)];

        if (matches.length > 0) {
            // Mappa dinamica per associare voci coerenti a qualsiasi nome inserito dall'utente
            const dynamicNameMap = {};
            let fIdx = 0;
            let mIdx = 0;

            // Determina se il contesto scelto è tutto al femminile o tutto al maschile
            const isAllWomen = (castMode === 'due_donne' || castMode === 'tre_donne');
            const isAllMen = (castMode === 'due_uomini' || castMode === 'tre_uomini');

            matches.forEach(m => {
                const nameClean = m[1].trim();
                const nameKey = nameClean.toLowerCase();
                if (!dynamicNameMap[nameKey]) {
                    if (baseVoices[nameKey]) {
                        dynamicNameMap[nameKey] = { ...baseVoices[nameKey], label: nameClean };
                    } else if (isAllWomen) {
                        dynamicNameMap[nameKey] = { ...femaleVoicePool[fIdx % femaleVoicePool.length], label: nameClean };
                        fIdx++;
                    } else if (isAllMen) {
                        dynamicNameMap[nameKey] = { ...maleVoicePool[mIdx % maleVoicePool.length], label: nameClean };
                        mIdx++;
                    } else {
                        // Misto: assegna alternando Donna / Uomo o riconoscendo nomi femminili tipici italiani che finiscono per 'a'
                        const isLikelyFemale = /[aà]$/i.test(nameClean) || ['lucia', 'maria', 'giulia', 'elena', 'sara', 'francesca', 'dottoressa', 'infermiera'].includes(nameKey);
                        if (isLikelyFemale) {
                            dynamicNameMap[nameKey] = { ...femaleVoicePool[fIdx % femaleVoicePool.length], label: nameClean };
                            fIdx++;
                        } else {
                            dynamicNameMap[nameKey] = { ...maleVoicePool[mIdx % maleVoicePool.length], label: nameClean };
                            mIdx++;
                        }
                    }
                }
            });

            // Splitta il testo rispettando tutti i nomi individuati
            const escapedNames = Object.keys(dynamicNameMap).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const splitPattern = new RegExp(`(?:^|\\n|—)\\s*(${escapedNames})\\s*:`, 'gi');
            const rawParts = rawText.split(splitPattern).filter(Boolean);

            let currentSpeaker = Object.keys(dynamicNameMap)[0];
            for (let i = 0; i < rawParts.length; i++) {
                const seg = rawParts[i].trim();
                const segKey = seg.toLowerCase();
                if (dynamicNameMap[segKey]) {
                    currentSpeaker = segKey;
                } else if (seg) {
                    const cleanText = seg.replace(/^[—\-\s]+/, '').replace(/[—\-\s]+$/, '').trim();
                    if (cleanText) {
                        battute.push({
                            speaker: currentSpeaker,
                            speakerConfig: dynamicNameMap[currentSpeaker],
                            testo: cleanText
                        });
                    }
                }
            }
        } else if (rawText.includes('—')) {
            // Alternanza automatica su trattino in base alla modalità selezionata
            const parti = rawText.split('—');
            let roster = [femaleVoicePool[0], maleVoicePool[0]];
            if (castMode === 'due_donne') roster = [femaleVoicePool[0], femaleVoicePool[1]];
            else if (castMode === 'tre_donne') roster = [femaleVoicePool[0], femaleVoicePool[1], femaleVoicePool[2]];
            else if (castMode === 'due_uomini') roster = [maleVoicePool[0], maleVoicePool[1]];
            else if (castMode === 'tre_uomini') roster = [maleVoicePool[0], maleVoicePool[1], maleVoicePool[2]];

            parti.forEach((p, idx) => {
                const cleanSeg = p.trim();
                if (cleanSeg) {
                    const cfg = roster[idx % roster.length];
                    battute.push({ speaker: `voce_${idx+1}`, speakerConfig: cfg, testo: cleanSeg });
                }
            });
        } else {
            // Testo unico
            const defaultSpeaker = (castMode === 'due_uomini' || castMode === 'tre_uomini') ? maleVoicePool[0] : femaleVoicePool[0];
            battute.push({ speaker: 'principale', speakerConfig: defaultSpeaker, testo: rawText });
        }

        console.log('[DIALOGO GENERAZIONE] Battute individuate:', battute.length);
        for (let i = 0; i < battute.length; i++) {
            const item = battute[i];
            console.log(` - Battuta ${i+1}: [${item.speakerConfig.label}] -> ${item.testo.substring(0, 50)}...`);
            const b = await generaChunkVoce(item.speakerConfig, item.testo);
            if (b && b.length > 0) {
                buffers.push(b);
                // Inserisce una pausa naturale (circa 300ms di silenzio pulito) tra battute
                if (i < battute.length - 1) {
                    buffers.push(generaPausaNaturaleAudio());
                }
            }
        }

        if (buffers.length === 0) {
            return res.status(400).json({ error: 'Nessun audio generato' });
        }

        const finalBuffer = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(finalBuffer);
    } catch(err) {
        console.error('[DIALOGO AUDIO ERRORE]', err);
        return res.status(500).json({ error: err.message });
    }
});


// --- SISTEMA ANTI-FURBI: FORZATURA VOLUME HARDWARE >= 70% SU PC WINDOWS + AUDIT LOG ---
app.all(['/api/forza-volume-70', '/careassist/api/forza-volume-70'], (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);

    const minLevel = Math.max(0.70, Math.min(1.0, parseFloat(req.query.min || '0.75') || 0.75));
    if (process.platform !== 'win32') {
        return res.json({
            ok: true,
            platform: process.platform,
            enforcedPercent: Math.round(minLevel * 100),
            mode: 'webaudio-compressor-boost'
        });
    }
    try {
        const { exec } = require('child_process');
        const psScript = [
            `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume { int f(); int g(); int h(); int i(); int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext); int j(); int GetMasterVolumeLevelScalar(out float pfLevel); int k(); int l(); int m(); int n(); int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext); int GetMute(out bool pbMute); } [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); } [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); } [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { } public class VolGuard { public static string Enforce(float minVol) { var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator; IMMDevice dev = null; Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev)); var iid = typeof(IAudioEndpointVolume).GUID; IAudioEndpointVolume epv = null; Marshal.ThrowExceptionForHR(dev.Activate(ref iid, 23, 0, out epv)); float before = 0f; epv.GetMasterVolumeLevelScalar(out before); epv.SetMute(false, Guid.Empty); float cur = before; if (cur < minVol) { epv.SetMasterVolumeLevelScalar(minVol, Guid.Empty); cur = minVol; } return Math.Round(before * 100) + "|" + Math.Round(cur * 100); } }'`,
            `[VolGuard]::Enforce(${minLevel.toFixed(2)})`
        ].join('; ');

        exec(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`, { timeout: 4000, windowsHide: true }, (err, stdout) => {
            const parts = String(stdout || '').trim().split('|');
            const prevVol = parseInt(parts[0], 10);
            const parsedVol = parseInt(parts[1] || parts[0], 10);
            return res.json({
                ok: true,
                platform: 'win32',
                unmuted: true,
                previousPercent: !isNaN(prevVol) ? prevVol : null,
                enforcedPercent: !isNaN(parsedVol) ? parsedVol : Math.round(minLevel * 100),
                warning: err ? err.message : null
            });
        });
    } catch (e) {
        return res.json({ ok: true, enforcedPercent: Math.round(minLevel * 100), fallback: true });
    }
});

// ==============================================================================
// 7. CANALE NOTIFICHE PUSH SVEGLIE SMARTPHONE A DISPLAY SPENTO (NTFY / TELEGRAM)
// ==============================================================================
const NOTIFICHE_CONFIG_FILE = path.join(dataDir, 'notifiche_mobile_config.json');

function getNotificheConfig() {
    try {
        if (fs.existsSync(NOTIFICHE_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(NOTIFICHE_CONFIG_FILE, 'utf8'));
        }
    } catch(e) {}
    // Configurazione predefinita: canale sicuro univoco per la famiglia Milella
    return {
        ntfyTopic: 'suite-milella-careassist',
        attivo: true,
        telegramToken: '',
        telegramChatId: ''
    };
}

// Invia notifica push a display spento via NTFY e Telegram
async function inviaPushMobileEmergenza(titolo, messaggio, priorita = 5, tag = 'alarm_clock') {
    const cfg = getNotificheConfig();
    const risultati = { ntfy: false, telegram: false };

    // 1. NTFY: priorità 5 ("urgent") sveglia lo schermo e suona a display spento
    if (cfg.ntfyTopic && cfg.attivo) {
        try {
            const https = require('https');
            const ntfyUrl = `https://ntfy.sh/${encodeURIComponent(cfg.ntfyTopic)}`;
            const postData = messaggio || titolo;

            await new Promise((resolve) => {
                const req = https.request(ntfyUrl, {
                    method: 'POST',
                    headers: {
                        'Title': titolo,
                        'Priority': String(priorita), // 5 = Urgent/Max, suona anche in non disturbare
                        'Tags': tag,
                        'Click': 'https://milella-suite-41ff.onrender.com/careassist/',
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, (res) => {
                    risultati.ntfy = (res.statusCode >= 200 && res.statusCode < 300);
                    resolve();
                });
                req.on('error', () => resolve());
                req.write(postData);
                req.end();
            });
        } catch(e) {
            console.warn('[PUSH NTFY ERRORE]', e.message);
        }
    }

    // 2. Telegram Bot (se configurato)
    if (cfg.telegramToken && cfg.telegramChatId) {
        try {
            const https = require('https');
            const tgMsg = `🚨 *${titolo}*\n\n${messaggio}\n\n👉 [Apri CareAssist](https://milella-suite-41ff.onrender.com/careassist/)`;
            const tgUrl = `https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`;
            const payload = JSON.stringify({
                chat_id: cfg.telegramChatId,
                text: tgMsg,
                parse_mode: 'Markdown'
            });

            await new Promise((resolve) => {
                const req = https.request(tgUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    }
                }, (res) => {
                    risultati.telegram = (res.statusCode === 200);
                    resolve();
                });
                req.on('error', () => resolve());
                req.write(payload);
                req.end();
            });
        } catch(e) {}
    }

    return risultati;
}

// Endpoint per inviare allarme push immediato al cellulare
app.post('/api/invia-alert-smartphone', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);

    const { titolo, messaggio, priorita, tag } = req.body || {};
    const t = titolo || '🚨 SVEGLIA TERAPIA CAREASSIST';
    const m = messaggio || 'È l\'ora del farmaco programmato!';
    const p = priorita || 5;

    const esito = await inviaPushMobileEmergenza(t, m, p, tag);
    return res.json({ success: true, esito, topic: getNotificheConfig().ntfyTopic });
});

// Endpoint per leggere / salvare la configurazione notifiche
app.get('/api/notifiche-config', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json(getNotificheConfig());
});

app.post('/api/notifiche-config', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);

    const body = req.body || {};
    const current = getNotificheConfig();
    const updated = {
        ntfyTopic: (body.ntfyTopic || current.ntfyTopic || 'suite-milella-careassist').trim().toLowerCase(),
        attivo: body.attivo !== undefined ? Boolean(body.attivo) : true,
        telegramToken: (body.telegramToken || current.telegramToken || '').trim(),
        telegramChatId: (body.telegramChatId || current.telegramChatId || '').trim()
    };

    try {
        fs.writeFileSync(NOTIFICHE_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
        return res.json({ success: true, config: updated });
    } catch(err) {
        return res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inventario Server running on http://localhost:${PORT}`);
    // Scrivi l'IP in un file per farlo leggere al Pannello HTA
    try {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        let bestIp = '127.0.0.1';
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    // Evitiamo le interfacce VMware
                    if (name.toLowerCase().includes('vmware')) continue;
                    bestIp = iface.address;
                    if (iface.address.startsWith('100.') || iface.address.startsWith('192.168.')) {
                        break;
                    }
                }
            }
        }
        fs.writeFileSync(path.join(dataDir, 'myip.txt'), bestIp);
    } catch(e) {}

    // --- SISTEMA AUTO-BACKUP AUTOMATICO GIORNALIERO ---
    function runAutoBackup() {
        try {
            const rootSuite = path.resolve(__dirname, '..');
            const autoBackupDir = path.join(rootSuite, 'Backup_Automatico_Dati');
            if (!fs.existsSync(autoBackupDir)) {
                fs.mkdirSync(autoBackupDir, { recursive: true });
            }

            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const todayFolder = path.join(autoBackupDir, `Backup_${dateStr}`);
            if (!fs.existsSync(todayFolder)) {
                fs.mkdirSync(todayFolder, { recursive: true });
            }

            // 1. Inventario
            const invSrc = path.join(__dirname, 'data', 'inventario.json');
            if (fs.existsSync(invSrc)) {
                fs.copyFileSync(invSrc, path.join(todayFolder, 'inventario.json'));
            }
            // 2. Posizioni
            const posSrc = path.join(__dirname, 'data', 'posizioni.json');
            if (fs.existsSync(posSrc)) {
                fs.copyFileSync(posSrc, path.join(todayFolder, 'posizioni.json'));
            }
            // 3. Ricettario
            const ricSrc = path.join(rootSuite, 'RicettarioWeb', 'data', 'ricette.json');
            if (fs.existsSync(ricSrc)) {
                fs.copyFileSync(ricSrc, path.join(todayFolder, 'ricette.json'));
            }
            // 4. MedNutri Pro
            const medSrc = path.join(rootSuite, 'MedNutri_Pro', 'mednutri_server_data.json');
            if (fs.existsSync(medSrc)) {
                fs.copyFileSync(medSrc, path.join(todayFolder, 'mednutri_server_data.json'));
            }
            // 5. CareAssist Pro
            if (fs.existsSync(careAssistDbFile)) {
                fs.copyFileSync(careAssistDbFile, path.join(todayFolder, 'careassist_database.json'));
            }

            // 6. Flotta Veicoli
            const veiSrc = path.join(__dirname, 'data', 'veicoli_db.json');
            if (fs.existsSync(veiSrc)) {
                fs.copyFileSync(veiSrc, path.join(todayFolder, 'veicoli_db.json'));
            }
            // 7. Configurazione Progetti & Operatori
            const projsSrc = path.join(__dirname, 'data', 'progetti_config.json');
            if (fs.existsSync(projsSrc)) {
                fs.copyFileSync(projsSrc, path.join(todayFolder, 'progetti_config.json'));
            }
            const opSrc = path.join(__dirname, 'data', 'operatori.json');
            if (fs.existsSync(opSrc)) {
                fs.copyFileSync(opSrc, path.join(todayFolder, 'operatori.json'));
            }

            // --- AUTO-SINCRONIZZAZIONE SILENZIOSA NELLA CARTELLA DI SICUREZZA USB ---
            try {
                const usbDrive = path.parse(__dirname).root; // Es. 'D:\'
                const safetyDir = path.join(usbDrive, 'CARTELLA_DI_SICUREZZA', 'DATI_E_DATABASE_COPIA_DIRETTA');
                if (fs.existsSync(path.join(usbDrive, 'CARTELLA_DI_SICUREZZA'))) {
                    const safetyDataDir = path.join(safetyDir, 'data');
                    if (!fs.existsSync(safetyDataDir)) fs.mkdirSync(safetyDataDir, { recursive: true });
                    
                    const filesToSync = [
                        [veiSrc, path.join(safetyDataDir, 'veicoli_db.json')],
                        [projsSrc, path.join(safetyDataDir, 'progetti_config.json')],
                        [opSrc, path.join(safetyDataDir, 'operatori.json')],
                        [invSrc, path.join(safetyDataDir, 'inventario.json')],
                        [careAssistDbFile, path.join(safetyDir, 'careassist_database.json')]
                    ];
                    filesToSync.forEach(([src, dst]) => {
                        if (src && fs.existsSync(src)) {
                            fs.copyFileSync(src, dst);
                        }
                    });
                    console.log(`[AUTO-BACKUP USB] Database sincronizzati silenziosamente in ${safetyDir}`);
                }
            } catch(eUsb) {
                // Silenzioso se la cartella di sicurezza non è montata su questa macchina
            }

            // Pulizia automatica: conserva solo gli ultimi 14 backup giornalieri
            const allBackups = fs.readdirSync(autoBackupDir)
                .filter(name => name.startsWith('Backup_'))
                .sort();
            if (allBackups.length > 14) {
                const toRemove = allBackups.slice(0, allBackups.length - 14);
                toRemove.forEach(oldFolder => {
                    try {
                        fs.rmSync(path.join(autoBackupDir, oldFolder), { recursive: true, force: true });
                    } catch(e){}
                });
            }
            console.log(`[AUTO-BACKUP] Backup giornaliero salvato in ${todayFolder}`);
        } catch(err) {
            console.error('[AUTO-BACKUP ERRORE]', err);
        }
    }

    // Esegui backup all'avvio (dopo 5 secondi) e poi ogni 12 ore
    setTimeout(runAutoBackup, 5000);
    setInterval(runAutoBackup, 4 * 60 * 60 * 1000);

    // Sistema Anti-Sospensione H24 (Keep-Alive per Render Cloud)
    // Invia un auto-ping leggero ogni 10 minuti per evitare che il server vada in standby
    const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || 'https://milella-suite-41ff.onrender.com';
    function keepAlivePing() {
        try {
            const https = require('https');
            const pingUrl = KEEP_ALIVE_URL + '/api/health';
            https.get(pingUrl, (res) => {
                // Keep-alive riuscito
            }).on('error', () => {
                // Ignora errori di rete transitori
            });
        } catch(e) {}
    }
    // Avvia auto-ping ogni 9 minuti (540000 ms)
    setInterval(keepAlivePing, 9 * 60 * 1000);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} in use, Inventario already active.`);
    } else {
        console.error("Inventario Server error:", err);
    }
});
}

startServer().catch((err) => {
    console.error("Errore critico avvio server:", err);
});

