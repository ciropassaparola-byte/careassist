const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3002;

const UPLOAD_DIR = path.join(__dirname, 'PROVE_CONSEGNA');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const NOTIF_FILE = path.join(__dirname, 'NOTIFICHE_UFFICIO.txt');

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Per gestire le immagini base64

// Memoria in-RAM per il Tracking GPS della flotta
let fleetGPS = {};

app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}));

app.post('/query', (req, res) => {
    let sql = req.body.sql;
    if (!sql) return res.status(400).json({ error: 'No SQL provided' });
    
    // SQLite translation layer for Access SQL functions
    sql = sql.replace(/Month\(([^)]+)\)/gi, "CAST(strftime('%m', $1) AS INTEGER)");
    sql = sql.replace(/Year\(([^)]+)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)");
    sql = sql.replace(/Day\(([^)]+)\)/gi, "CAST(strftime('%d', $1) AS INTEGER)");
    sql = sql.replace(/UCase\(([^)]+)\)/gi, "UPPER($1)");
    sql = sql.replace(/LCase\(([^)]+)\)/gi, "LOWER($1)");
    // Date/time string constants replacement if needed, e.g., #2026-08-01# -> '2026-08-01'
    sql = sql.replace(/#([^#]+)#/g, "'$1'");
    
    const isUpdate = sql.toUpperCase().trim().startsWith('UPDATE') || sql.toUpperCase().trim().startsWith('INSERT') || sql.toUpperCase().trim().startsWith('DELETE');
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = require('path').join(__dirname, '..', '..', 'ConsegneDB_Legacy.sqlite');
    const db = new sqlite3.Database(dbPath);
    if (isUpdate) {
        db.run(sql, [], function(err) {
            db.close();
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        });
    } else {
        db.all(sql, [], (err, rows) => {
            db.close();
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});
app.get('/api/consegne', (req, res) => {
    const vbsPath = path.join(__dirname, 'fetch_consegne.vbs');
    exec(`cscript //NoLogo "${vbsPath}"`, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: "Errore DB" });
        res.send(stdout);
    });
});

app.get('/api/storico', (req, res) => {
    const vbsPath = path.join(__dirname, 'fetch_storico.vbs');
    exec(`cscript //NoLogo "${vbsPath}"`, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: "Errore DB" });
        res.send(stdout);
    });
});

app.get('/api/aggiungi', (req, res) => {
    const { nome, citta, ind, tel, merce, data } = req.query;
    const vbsPath = path.join(__dirname, 'add_consegna.vbs');
    // Escaping basic quotes for VBS arguments
    const cmd = `cscript //NoLogo "${vbsPath}" "${nome}" "${citta}" "${ind}" "${tel}" "${merce}" "${data || ''}"`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ success: false });
        res.send(stdout);
    });
});

app.get('/api/concludi', (req, res) => {
    const id = req.query.id;
    const nome = req.query.nome || "ID " + id;
    const vbsPath = path.join(__dirname, 'update_consegna.vbs');
    exec(`cscript //NoLogo "${vbsPath}" ${id} "COMPLETATA"`, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ success: false });

        // Notifica PC Ufficio
        const logMsg = `${new Date().toLocaleString()} - CONSEGNA COMPLETATA: ${nome} alle ${new Date().toLocaleTimeString()}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);

        res.send(stdout);
    });
});

app.get('/api/update_details', (req, res) => {
    let { id, nome, data, ora, stato, kma, kmr, merce, note } = req.query;
    const vbsPath = path.join(__dirname, 'update_km.vbs');
    
    // Pulizia totale: no virgolette (usiamo apici), no ritorni a capo (usiamo spazi)
    const clean = (str) => String(str || "").replace(/"/g, "'").replace(/\r?\n|\r/g, " "); 
    const cmd = `cscript //NoLogo "${vbsPath}" ${id} "${clean(kma)}" "${clean(kmr)}" "${clean(merce)}" "${clean(note)}" "${clean(nome)}" "${clean(data)}" "${clean(ora)}" "${clean(stato)}"`;
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ success: false, error: stderr || error.message });

        // Notifica PC Ufficio
        const logMsg = `${new Date().toLocaleString()} - MODIFICA DA MOBILE: ${nome || "ID "+id}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);

        res.send(stdout);
    });
});

// --- NUOVE API RADAR FLOTTA ---
app.get('/api/gps_update', (req, res) => {
    const { user, lat, lon } = req.query;
    if (user && lat && lon) {
        fleetGPS[user] = {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            timestamp: Date.now()
        };
    }
    res.json({ success: true });
});

app.get('/api/fleet_locations', (req, res) => {
    res.json(fleetGPS);
});
// ------------------------------

app.get('/api/ausili', (req, res) => {
    // Percorso del file generato dall'HTA: File_Sistema/config_ausili.json
    // Il server è in App_Mobile/server, quindi 2 livelli su = File_Sistema
    const p1 = path.join(__dirname, '..', '..', 'config_ausili.json');      // File_Sistema
    const p2 = path.join(__dirname, '..', 'config_ausili.json');             // App_Mobile
    const p3 = path.join(__dirname, '..', '..', '..', 'config_ausili.json'); // Sistema_Logistica
    
    const finalPath = [p1, p2, p3].find(p => fs.existsSync(p));
    
    if (!finalPath) {
        return res.json([]);
    }
    
    // Il file è salvato da HTA Windows in UTF-16LE con BOM
    // Proviamo a leggerlo con iconv-lite se disponibile, altrimenti buffer raw
    try {
        const raw = fs.readFileSync(finalPath);
        let text;
        // Rileva BOM UTF-16 LE (FF FE)
        if (raw[0] === 0xFF && raw[1] === 0xFE) {
            text = raw.slice(2).toString('utf16le');
        } else if (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) {
            text = raw.slice(3).toString('utf8'); // BOM UTF-8
        } else {
            // Prova prima utf16le poi utf8
            try {
                text = raw.toString('utf16le');
                JSON.parse(text); // Verifica validità
            } catch(e) {
                text = raw.toString('utf8');
            }
        }
        const data = JSON.parse(text);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Errore parsing ausili: ' + e.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get('/api/user', (req, res) => {
    const credPath = path.join(__dirname, '..', '..', 'system', 'cred.local');
    if (fs.existsSync(credPath)) {
        const content = fs.readFileSync(credPath, 'utf8');
        const lines = content.split(/\r?\n/);
        res.json({ user: lines[0] || "Ospite" });
    } else {
        res.json({ user: "Ospite" });
    }
});

app.get('/api/stats', (req, res) => {
    res.json({ urgent: 0, pending: 0, done: 0 });
});

// Endpoint per Caricamento Prove di Consegna (Firma o Foto)
app.post('/api/upload_pod', (req, res) => {
    const { id, type, image, nome, driver } = req.body; // type: 'firma' o 'foto'
    if (!id || !image) return res.status(400).json({ error: "Dati mancanti" });

    // Pulizia nomi per filesystem
    const cleanName = String(nome || "CLIENTE").replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const cleanDriver = String(driver || "OSPITE").replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const dateStr = new Date().toLocaleDateString('it-IT').replace(/\//g, '_');
    
    // Creazione cartella driver se non esiste
    const driverDir = path.join(UPLOAD_DIR, cleanDriver);
    if (!fs.existsSync(driverDir)) fs.mkdirSync(driverDir, { recursive: true });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `${cleanName}_${type.toUpperCase()}_${dateStr}_${id}.png`;
    const filePath = path.join(driverDir, fileName);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).json({ error: "Errore salvataggio file" });

        // --- GENERAZIONE AUTOMATICA BOLLA DI CONSEGNA (POD) ---
        if (type === 'firma') {
            const htmlPOD = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Ricevuta di Consegna (POD) - ${id}</title></head>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: #f8fafc;">
                <div style="max-width: 700px; margin: 0 auto; background: white; border: 2px solid #cbd5e1; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #0284c7; margin: 0;">BOLLA DI CONSEGNA</h1>
                        <p style="color: #64748b; margin-top: 5px; font-weight: bold;">PROVA DI CONSEGNA UFFICIALE (POD)</p>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>ID Consegna:</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${id}</td></tr>
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Cliente / Destinatario:</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${nome || "N/A"}</td></tr>
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Operatore / Autista:</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${driver || "N/A"}</td></tr>
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Data e Ora Ricezione:</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${new Date().toLocaleString()}</td></tr>
                    </table>
                    <div style="margin-top: 40px; text-align: center;">
                        <h3 style="color: #475569; margin-bottom: 15px;">FIRMA DEL DESTINATARIO</h3>
                        <img src="${image}" style="max-width: 400px; height: auto; border: 1px dashed #94a3b8; border-radius: 8px; padding: 15px; background: #fff;" />
                    </div>
                    <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px;">
                        Generato automaticamente dal Sistema Logistica - Documento Valido a fini di tracciamento.
                    </div>
                </div>
            </body>
            </html>
            `;
            const htmlName = `${cleanName}_POD_${dateStr}_${id}.html`;
            fs.writeFileSync(path.join(driverDir, htmlName), htmlPOD);
        }
        // ------------------------------------------------------

        // Notifica PC Ufficio
        const msgPC = `RICEVUTA ${type.toUpperCase()} per Consegna ID: ${id}`;
        const psCmd = `powershell -Command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${msgPC}', 'RICEVUTA POD', 0, 64)"`;
        exec(psCmd);
        
        // Logghiamo l'evento
        const logMsg = `${new Date().toLocaleString()} - Caricata ${type.toUpperCase()}: Consegna ${id}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);

        res.json({ success: true, fileName });
    });
});

// Endpoint per Caricamento Documenti (PDF ecc.)
app.post('/api/upload_document', (req, res) => {
    const { driver, filename, base64 } = req.body;
    if (!filename || !base64) return res.status(400).json({ error: "Dati mancanti" });

    const cleanDriver = String(driver || "OSPITE").replace(/[^a-z0-9]/gi, '_').toUpperCase();
    
    const docDir = path.join(__dirname, '..', 'DOCUMENTI_PDF', cleanDriver);
    if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });

    const cleanFileName = filename.replace(/[^a-z0-9\.\-_]/gi, '_');
    const filePath = path.join(docDir, cleanFileName);
    const fileData = base64.replace(/^data:.*?;base64,/, "");

    fs.writeFile(filePath, fileData, 'base64', (err) => {
        if (err) return res.status(500).json({ error: "Errore salvataggio documento" });

        // Notifica PC Ufficio
        const msgPC = `RICEVUTO DOCUMENTO: ${cleanFileName} da ${cleanDriver}`;
        const psCmd = `powershell -Command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${msgPC}', 'NUOVO DOCUMENTO', 0, 64)"`;
        exec(psCmd);
        
        // Logghiamo l'evento
        const logMsg = `${new Date().toLocaleString()} - Caricato Documento: ${cleanFileName} (Autista: ${cleanDriver})\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);

        res.json({ success: true, url: `/DOCUMENTI_PDF/${cleanDriver}/${cleanFileName}` });
    });
});

// Endpoint per Notificare il PC in Ufficio
app.get('/api/notify_pc', (req, res) => {
    const msgText = req.query.msg || "Nuovo aggiornamento dalla Mobile App";
    const { exec } = require('child_process');
    
    // Comando 'msg' di Windows per popup istantaneo
    // Comando PowerShell per popup garantito al centro dello schermo
    const psCmd = `powershell -Command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${msgText.replace(/'/g, "''")}', 'AVVISO DA APP MOBILE', 0, 64)"`;
    
    exec(psCmd, (err) => {
        // Logghiamo anche su file per sicurezza
        const fs = require('fs');
        const logStr = String(msgText).indexOf('NOTIZIE DA STRADA') > -1 ? msgText : `NOTIZIE DA STRADA: ${msgText}`;
        const logMsg = `${new Date().toLocaleString()} - ${logStr}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);
        
        res.json({ success: true });
    });
});

// Global crash protection for Node.js process
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION PREVENTED CRASH:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION PREVENTED CRASH:', reason);
});

// --- NUOVO MODULO WHATSAPP INVISIBILE ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(chromePath)) {
    chromePath = undefined;
}

let waClient = null;
let waStatus = 'DISCONNECTED'; // DISCONNECTED, QR_READY, CONNECTED
let waQR = '';

try {
    var puppeteerOpts = {
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions'
        ]
    };
    if (chromePath) puppeteerOpts.executablePath = chromePath;

    waClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: puppeteerOpts
    });

    waClient.on('qr', async (qr) => {
        waStatus = 'QR_READY';
        try {
            waQR = await qrcode.toDataURL(qr);
            console.log('QR Code WhatsApp pronto (Base64) per la UI!');
        } catch(err) {
            console.error('Errore generazione QR:', err);
        }
    });

    waClient.on('ready', () => {
        console.log('WhatsApp Client e connesso e pronto!');
        waStatus = 'CONNECTED';
        waQR = '';
    });

    waClient.on('disconnected', (reason) => {
        console.log('WhatsApp Client disconnesso', reason);
        waStatus = 'DISCONNECTED';
    });

    waClient.initialize().catch(err => {
        console.warn('WhatsApp Client init warning (skipped):', err.message);
        waStatus = 'DISCONNECTED';
    });
} catch(e) {
    console.warn("Modulo WhatsApp disattivato per incompatibilità sistema:", e.message);
}

// Endpoint per controllare lo stato e ottenere il QR Code
app.get('/api/wa/qr', (req, res) => {
    res.json({ status: waStatus, qr: waQR });
});

// Endpoint per inviare il messaggio
app.post('/api/wa/send', async (req, res) => {
    const { phone, message } = req.body;
    if (waStatus !== 'CONNECTED') {
        return res.status(500).json({ error: "WhatsApp non connesso al server." });
    }
    try {
        let formattedPhone = phone.replace(/\D/g, ''); 
        if (!formattedPhone.startsWith('39') || formattedPhone.length <= 10) {
             formattedPhone = '39' + formattedPhone;
        }
        const chatId = formattedPhone + "@c.us";
        await waClient.sendMessage(chatId, message);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});
// --------------------------------------

app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`SERVER MOBILE ATTIVO SULLA PORTA ${PORT}`);
    console.log(`Endpoint locale: http://localhost:${PORT}`);
    console.log(`Data/Ora: ${new Date().toLocaleString()}`);
    console.log(`========================================`);
});


