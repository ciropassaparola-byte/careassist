const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Global crash protection
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION PREVENTED CRASH:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION PREVENTED CRASH:', reason);
});

const app = express();
const PORT = 3002;

const dbPath = path.join(__dirname, '..', '..', 'ConsegneDB_Legacy.sqlite');

// ============================================================
//  PROTEZIONE USB — Backup automatico rotante all'avvio
// ============================================================
const backupDir = path.join(__dirname, '..', '..', 'DB_Backup_Auto');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

try {
    if (fs.existsSync(dbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPath = path.join(backupDir, `ConsegneDB_${timestamp}.sqlite`);
        fs.copyFileSync(dbPath, backupPath);
        console.log('✅ Backup DB creato:', backupPath);

        // Pulizia: mantieni solo gli ultimi 3 backup
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('ConsegneDB_') && f.endsWith('.sqlite'))
            .sort().reverse();
        backups.slice(3).forEach(f => {
            try { fs.unlinkSync(path.join(backupDir, f)); } catch(e) {}
        });
        if (backups.length > 3) console.log('🧹 Pulizia vecchi backup completata (mantenuti ultimi 3).');
    }
} catch(e) {
    console.error('⚠️ Backup automatico fallito:', e.message);
}

// ============================================================
//  Apertura DB con protezioni WAL per chiavetta USB
// ============================================================
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('🔴 Errore connessione SQLite:', err);
        return;
    }
    console.log('✅ Connesso a ConsegneDB_Legacy.sqlite su porta ' + PORT);

    // --- PROTEZIONE USB: Pragma critici ---
    // WAL mode: le scritture vanno in un file .wal separato, il DB principale
    // viene toccato solo al checkpoint → se la chiavetta viene staccata, il DB resta integro
    db.run("PRAGMA journal_mode = WAL", (errWal) => {
        if (errWal) console.error('⚠️ Errore attivazione WAL:', errWal);
        else console.log('✅ WAL mode attivato (protezione anti-corruzione USB)');
    });
    // synchronous FULL: ogni scrittura è fisicamente su disco prima di procedere
    db.run("PRAGMA synchronous = FULL");
    // busy_timeout: se il DB è occupato, aspetta 5 secondi prima di dare errore
    db.run("PRAGMA busy_timeout = 5000");

    // --- Integrity check all'avvio ---
    db.get("PRAGMA integrity_check", (errIC, row) => {
        if (errIC) {
            console.error('⚠️ Errore durante integrity check:', errIC);
        } else if (row && row.integrity_check !== 'ok') {
            console.error('🔴 DATABASE CORROTTO! Risultato:', row.integrity_check);
            console.error('🔴 Tentativo di ripristino automatico dall\'ultimo backup...');

            // Cerca l'ultimo backup valido
            try {
                const backups = fs.readdirSync(backupDir)
                    .filter(f => f.startsWith('ConsegneDB_') && f.endsWith('.sqlite'))
                    .sort().reverse();
                // Il primo backup è quello appena creato (potrebbe essere corrotto anche lui)
                // Proviamo dal secondo in poi
                const candidati = backups.slice(1);
                if (candidati.length > 0) {
                    const ripristino = path.join(backupDir, candidati[0]);
                    // Salva il DB corrotto per analisi
                    const corrottoPath = dbPath + '.CORROTTO_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    fs.copyFileSync(dbPath, corrottoPath);
                    // Ripristina dal backup
                    fs.copyFileSync(ripristino, dbPath);
                    console.log('✅ DATABASE RIPRISTINATO DA:', candidati[0]);
                    console.log('⚠️ Il DB corrotto è stato salvato in:', corrottoPath);
                    console.log('⚠️ RIAVVIARE IL PROGRAMMA per usare il DB ripristinato.');
                } else {
                    console.error('🔴 NESSUN BACKUP DISPONIBILE PER IL RIPRISTINO!');
                    // Rimuoviamo anche il backup appena fatto (è probabilmente corrotto)
                    if (backups.length > 0) {
                        try { fs.unlinkSync(path.join(backupDir, backups[0])); } catch(e) {}
                    }
                }
            } catch(eRestore) {
                console.error('🔴 Errore durante il ripristino:', eRestore.message);
            }
        } else {
            console.log('✅ Database integro (integrity_check OK)');
        }
    });
});

// Manual CORS + UTF-8 charset (soltanto per le chiamate API)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.path.startsWith('/api/')) {
        res.header("Content-Type", "application/json; charset=utf-8");
    }
    next();
});
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

// SQL Dialect Transformer (Access to SQLite)
function transformSQL(sql) {
    let newSql = sql;
    
    // Convert Access date literals #YYYY-MM-DD# (and single-digit variations #YYYY-M-D#) to SQLite 'YYYY-MM-DD'
    newSql = newSql.replace(/#(\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{1,2}:\d{1,2})?)#/g, (match, p1) => {
        const parts = p1.split(' ');
        const dateParts = parts[0].split('-');
        const y = dateParts[0];
        const m = dateParts[1].padStart(2, '0');
        const d = dateParts[2].padStart(2, '0');
        const timePart = parts[1] ? ' ' + parts[1] : '';
        return `'${y}-${m}-${d}${timePart}'`;
    });
    newSql = newSql.replace(/#(\d{1,2}\/\d{1,2}\/\d{4})#/g, (match, p1) => {
        const parts = p1.split('/');
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `'${y}-${m}-${d}'`;
    });
    
    // Convert TRUE/FALSE booleans without quotes if needed, though SQLite handles 1/0
    newSql = newSql.replace(/\bTRUE\b/gi, '1');
    newSql = newSql.replace(/\bFALSE\b/gi, '0');
    
    // Convert isCancellato IS NULL OR isCancellato = 0
    newSql = newSql.replace(/isCancellato IS NULL/gi, '(isCancellato IS NULL OR isCancellato = "")');
    
    // Convert Date/Time functions
    newSql = newSql.replace(/\bYear\(([^)]+)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)");
    newSql = newSql.replace(/\bMonth\(([^)]+)\)/gi, "CAST(strftime('%m', $1) AS INTEGER)");
    newSql = newSql.replace(/\bDay\(([^)]+)\)/gi, "CAST(strftime('%d', $1) AS INTEGER)");
    newSql = newSql.replace(/\bDateAdd\('d',\s*(-?\d+),\s*Date\(\)\)/gi, "date('now', 'localtime', '$1 days')");
    newSql = newSql.replace(/\bNow\(\)/gi, "datetime('now', 'localtime')");
    newSql = newSql.replace(/\bDate\(\)/gi, "date('now', 'localtime')");
    newSql = newSql.replace(/\bFormat\(([^,]+),\s*'dd\/mm\/yyyy'\)/gi, "strftime('%d/%m/%Y', $1)");
    
    // Convert String functions
    newSql = newSql.replace(/\bUCase\(([^)]+)\)/gi, "UPPER($1)");
    newSql = newSql.replace(/\bLCase\(([^)]+)\)/gi, "LOWER($1)");
    
    // Specific IIf statements found in the codebase (placed before general IsNull)
    newSql = newSql.replace(/IIf\(Priorita IS NULL,\s*999,\s*Priorita\)/gi, "CASE WHEN Priorita IS NULL THEN 999 ELSE Priorita END");
    newSql = newSql.replace(/IIf\(Priorita LIKE '\*URGENTE\*',\s*0,\s*1\)/gi, "CASE WHEN Priorita LIKE '%URGENTE%' THEN 0 ELSE 1 END");
    newSql = newSql.replace(/IIf\(IsNull\(Max\(\[DataLavoro\]\)\),\s*(?:'1900-01-01'|#1900-01-01#),\s*Max\(\[DataLavoro\]\)\)/gi, "COALESCE(Max([DataLavoro]), '1900-01-01')");
    newSql = newSql.replace(/IIf\(\(\[DataLavoro\] IS NULL OR \[DataLavoro\] = ''\),\s*(?:'1900-01-01'|#1900-01-01#),\s*Max\(\[DataLavoro\]\)\)/gi, "COALESCE(Max([DataLavoro]), '1900-01-01')");

    // Null checks (safer regex that doesn't match nested parentheses)
    newSql = newSql.replace(/\bIsNull\(([^()]+)\)/gi, "($1 IS NULL OR $1 = '')");

    // Replace Access LIKE wildcards '*' with '%' in string literals
    newSql = newSql.replace(/LIKE\s*'([^']*)'/gi, (match, p1) => {
        return `LIKE '${p1.replace(/\*/g, '%')}'`;
    });
    
    // Convert SELECT TOP N to LIMIT N
    newSql = newSql.replace(/SELECT\s+TOP\s+(\d+)\s+([\s\S]+)/gi, (match, limit, fieldsAndFrom) => {
        let clean = fieldsAndFrom.trim();
        let hasSemicolon = clean.endsWith(';');
        if (hasSemicolon) {
            clean = clean.slice(0, -1).trim();
        }
        return `SELECT ${clean} LIMIT ${limit}${hasSemicolon ? ';' : ''}`;
    });
    
    return newSql;
}

const { exec } = require('child_process');

const NOTIF_FILE = path.join(__dirname, 'NOTIFICHE_UFFICIO.txt');
const UPLOAD_DIR = path.join(__dirname, 'PROVE_CONSEGNA');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

function logDriverNotification(driver, msg) {
    const cleanDriver = String(driver || "OSPITE").replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const driverDir = path.join(__dirname, 'NOTIFICHE_AUTISTI', cleanDriver);
    if (!fs.existsSync(driverDir)) fs.mkdirSync(driverDir, { recursive: true });

    const todayStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(driverDir, `notifiche_${todayStr}.txt`);

    const logEntry = `[${new Date().toLocaleTimeString('it-IT')}] - ${msg}\n`;
    fs.appendFileSync(logFile, logEntry);
}

// Anti-cache middleware
app.use((req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
});

// GET current user
app.get('/api/user', (req, res) => {
    res.json({ user: "Autista" });
});

// Serve static files from upper directory
app.use(express.static(path.join(__dirname, '..')));

// Serve manuals directory
const MANUALS_DIR = path.join(__dirname, '..', '..', '..', '..');
app.use('/archivio-manuali', express.static(MANUALS_DIR));

// GET manuals list
app.get('/api/manuali', (req, res) => {
    fs.readdir(MANUALS_DIR, { recursive: true }, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Errore cartella" });
        }
        
        const forbidden = ['copia_sicurezza', 'archivio_permessi', 'buste', 'report_mensile', 'node_modules', '.git'];
        
        const manuali = files
            .filter(f => {
                const lowerF = f.toLowerCase().replace(/\\/g, '/');
                const isMedia = lowerF.endsWith('.pdf') || lowerF.endsWith('.mp3');
                if (!isMedia) return false;
                
                // Exclude forbidden paths
                for (let bad of forbidden) {
                    if (lowerF.includes(bad)) return false;
                }
                return true;
            })
            .map(f => f.replace(/\\/g, '/')); // Normalize backslashes for URL
            
        res.json(manuali);
    });
});

// GET active deliveries
app.get('/api/consegne', (req, res) => {
    const sql = "SELECT [ID] as id, [ClienteNome] as cliente, [LocalitaConsegna] as citta, [IndirizzoConsegna] as indirizzo, [Provincia] as provincia, [DataConsegna] as data, [OraConsegna] as ora, [Stato] as stato, [Telefono] as telefono, [KmAndata] as kma, [KmRitorno] as kmr, [Merce] as merce, [NumeroOrdine] as ordine, [Note] as note FROM tblConsegne WHERE (Stato IS NULL OR (UPPER(Stato) NOT LIKE '%COMPLETAT%' AND UPPER(Stato) NOT LIKE '%CHIUS%' AND UPPER(Stato) NOT LIKE '%ANNULLAT%')) ORDER BY [ID] DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Errore DB" });
        }
        res.json(rows || []);
    });
});

// GET current year deliveries history
app.get('/api/storico', (req, res) => {
    const currYear = new Date().getFullYear();
    const sql = `SELECT [ID] as id, [ClienteNome] as cliente, [LocalitaConsegna] as citta, [IndirizzoConsegna] as indirizzo, [DataConsegna] as data, [OraConsegna] as ora, [Stato] as stato, [Telefono] as telefono, [KmAndata] as kma, [KmRitorno] as kmr, [Merce] as merce FROM tblConsegne WHERE CAST(strftime('%Y', DataConsegna) AS INTEGER) = ? ORDER BY DataConsegna DESC, OraConsegna DESC`;
    db.all(sql, [currYear], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Errore DB" });
        }
        res.json(rows || []);
    });
});

// GET add new delivery
app.get('/api/aggiungi', (req, res) => {
    const { nome, citta, ind, tel, merce, data } = req.query;
    let data_consegna = data;
    if (data && data.includes('/')) {
        const parts = data.split('/');
        if (parts.length === 3) data_consegna = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (!data_consegna) data_consegna = new Date().toISOString().split('T')[0];
    
    const sql = `INSERT INTO tblConsegne (ClienteNome, LocalitaConsegna, IndirizzoConsegna, Telefono, Merce, DataConsegna, Stato) VALUES (?, ?, ?, ?, ?, ?, 'DA LOGISTICA')`;
    db.run(sql, [nome, citta, ind, tel, merce, data_consegna], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false });
        }
        
        // Ensure the client exists in tblClienti so they appear in the Ufficio App
        const checkSql = `SELECT ID FROM tblClienti WHERE CognomeNome = ?`;
        db.get(checkSql, [nome], (errCheck, row) => {
            if (!errCheck && !row) {
                const insertClientSql = `INSERT INTO tblClienti (CognomeNome, Comune, Residenza, Telefono, StatoInvalidita) VALUES (?, ?, ?, ?, 'DA DEFINIRE')`;
                db.run(insertClientSql, [nome, citta, ind, tel]);
            }
        });

        res.json({ success: true });
    });
});

// GET conclude delivery
app.get('/api/concludi', (req, res) => {
    const id = req.query.id;
    const nome = req.query.nome || "ID " + id;
    const driver = req.query.driver || "OSPITE";
    const sql = `UPDATE tblConsegne SET [Stato] = 'COMPLETATA', [Consegnato] = 1 WHERE [ID] = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false });
        }
        
        // Notifica PC Ufficio
        const logMsg = `${new Date().toLocaleString()} - CONSEGNA COMPLETATA: ${nome} alle ${new Date().toLocaleTimeString()}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);
        
        logDriverNotification(driver, `CONSEGNA COMPLETATA: ${nome}`);
        
        res.json({ success: true });
    });
});

// GET update delivery details
app.get('/api/update_details', (req, res) => {
    let { id, nome, data, ora, stato, kma, kmr, merce, note, driver } = req.query;
    
    const toNum = (val) => {
        if (!val || isNaN(val.toString().replace(',', '.'))) return 0;
        return parseFloat(val.toString().replace(',', '.'));
    };
    
    const sql = `UPDATE tblConsegne SET [KmAndata] = ?, [KmRitorno] = ?, [Merce] = ?, [Note] = ?, [ClienteNome] = ?, [DataConsegna] = ?, [OraConsegna] = ?, [Stato] = ? WHERE [ID] = ?`;
    db.run(sql, [toNum(kma), toNum(kmr), merce, note, nome, data, ora, stato, id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        // Notifica PC Ufficio
        const logMsg = `${new Date().toLocaleString()} - MODIFICA DA MOBILE: ${nome || "ID "+id}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);
        
        logDriverNotification(driver || "OSPITE", `MODIFICA CONSEGNA ID ${id} (${nome || 'N.D.'}): Stato=${stato}, KM A=${kma}, KM R=${kmr}`);
        
        res.json({ success: true });
    });
});

// GET health check
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// POST RESO (Ritiro Usato)
app.post('/api/reso', (req, res) => {
    const { cliente, citta, indirizzo, note, driver } = req.body;
    
    if (!cliente) return res.status(400).json({ error: "Dati mancanti" });
    
    const data_consegna = new Date().toISOString().split('T')[0];
    const merce = "RESO DA CLIENTE";
    const noteComplete = `[RESO INSERITO DA MOBILE] ${note}`;
    
    const sql = `INSERT INTO tblConsegne (ClienteNome, LocalitaConsegna, IndirizzoConsegna, Merce, DataConsegna, Stato, Note) VALUES (?, ?, ?, ?, ?, 'DA LOGISTICA', ?)`;
    db.run(sql, [cliente, citta, indirizzo, merce, data_consegna, noteComplete], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        // Notifica PC Ufficio
        const logMsg = `${new Date().toLocaleString()} - RESO SEGNALATO DA MOBILE per ${cliente}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);
        
        logDriverNotification(driver || "OSPITE", `Segnalato RESO per ${cliente}`);
        
        res.json({ success: true });
    });
});

// SSE Push Notifications
let sseClients = [];
let lastUrgentCount = 0;

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    sseClients.push(res);
    
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

// Polling interno per SSE (controlla ogni 10 secondi nuove consegne URGENTI)
setInterval(() => {
    if (sseClients.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const sql = `SELECT COUNT(*) as count FROM tblConsegne WHERE [Stato] = 'URGENTE' AND [DataConsegna] >= ?`;
    
    db.get(sql, [today], (err, row) => {
        if (!err && row && row.count > lastUrgentCount) {
            const diff = row.count - lastUrgentCount;
            lastUrgentCount = row.count;
            
            const eventData = JSON.stringify({ type: 'NEW_URGENT', count: diff });
            sseClients.forEach(client => {
                client.write(`data: ${eventData}\n\n`);
            });
        } else if (!err && row) {
            lastUrgentCount = row.count;
        }
    });
}, 10000);

// POST POD (Proof of Delivery)
app.post('/api/upload_pod', (req, res) => {
    const { id, type, image, nome, driver } = req.body;
    if (!id || !type || !image) return res.status(400).json({ error: "Dati mancanti" });
    
    let noteAppend = ` [${type.toUpperCase()} Ricevuta]`;
    
    try {
        const podDir = path.join(__dirname, '..', '..', 'DOCUMENTI_PDF', 'POD');
        if (!fs.existsSync(podDir)) fs.mkdirSync(podDir, { recursive: true });
        
        let ext = type === 'firma' ? 'png' : 'jpg';
        const imgData = image.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `${type.charAt(0).toUpperCase() + type.slice(1)}_${id}.${ext}`;
        
        fs.writeFileSync(path.join(podDir, fileName), imgData, 'base64');
        
        // Aggiorna le Note nel DB
        const sql = `UPDATE tblConsegne SET [Note] = COALESCE([Note], '') || ? WHERE [ID] = ?`;
        db.run(sql, [noteAppend, id], function(err) {
            if (err) {
                console.error("Errore salvataggio POD nel DB:", err);
                return res.status(500).json({ success: false, error: err.message });
            }
            
            // Notifica al PC
            const logMsg = `${new Date().toLocaleString()} - POD: ${type.toUpperCase()} salvata per Consegna ID ${id} (${nome})\n`;
            fs.appendFileSync(NOTIF_FILE, logMsg);
            logDriverNotification(driver || "OSPITE", `Caricata ${type.toUpperCase()} per Consegna ID ${id}`);
            
            res.json({ success: true });
        });
    } catch (e) {
        console.error("Errore elaborazione POD:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET ausili (Manuali)
app.get('/api/ausili', (req, res) => {
    const p1 = path.join(__dirname, '..', '..', 'config_ausili.json');      // File_Sistema
    const p2 = path.join(__dirname, '..', 'config_ausili.json');             // App_Mobile
    const p3 = path.join(__dirname, '..', '..', '..', 'config_ausili.json'); // Sistema_Logistica
    
    const finalPath = [p1, p2, p3].find(p => fs.existsSync(p));
    
    if (!finalPath) {
        return res.json([]);
    }
    
    try {
        const raw = fs.readFileSync(finalPath);
        let text;
        if (raw[0] === 0xFF && raw[1] === 0xFE) {
            text = raw.slice(2).toString('utf16le');
        } else if (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) {
            text = raw.slice(3).toString('utf8');
        } else {
            try {
                text = raw.toString('utf16le');
                JSON.parse(text);
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

// GET office user
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

// GET stats
app.get('/api/stats', (req, res) => {
    res.json({ urgent: 0, pending: 0, done: 0 });
});

// POST proof of delivery image (base64 photo/signature)
app.post('/api/upload_pod', (req, res) => {
    const { id, type, image, nome, driver } = req.body;
    if (!id || !image) return res.status(400).json({ error: "Dati mancanti" });

    const cleanName = String(nome || "CLIENTE").replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const cleanDriver = String(driver || "OSPITE").replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const dateStr = new Date().toLocaleDateString('it-IT').replace(/\//g, '_');
    
    const driverDir = path.join(UPLOAD_DIR, cleanDriver);
    if (!fs.existsSync(driverDir)) fs.mkdirSync(driverDir, { recursive: true });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `${cleanName}_${type.toUpperCase()}_${dateStr}_${id}.png`;
    const filePath = path.join(driverDir, fileName);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Errore salvataggio file" });
        }

        const msgPC = `RICEVUTA ${type.toUpperCase()} per Consegna ID: ${id}`;
        const psCmd = `powershell -Command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${msgPC}', 'RICEVUTA POD', 0, 64)"`;
        exec(psCmd);
        
        const logMsg = `${new Date().toLocaleString()} - Caricata ${type.toUpperCase()}: Consegna ${id}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);

        logDriverNotification(driver, `Caricata ${type.toUpperCase()}: Consegna ID ${id} per cliente ${nome || 'N.D.'}`);

        res.json({ success: true, fileName });
    });
});

// GET notify office PC
app.get('/api/notify_pc', (req, res) => {
    const msgText = req.query.msg || "Nuovo aggiornamento dalla Mobile App";
    const driver = req.query.driver || "OSPITE";
    const psCmd = `powershell -Command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${msgText.replace(/'/g, "''")}', 'AVVISO DA APP MOBILE', 0, 64)"`;
    
    exec(psCmd, (err) => {
        const logStr = String(msgText).indexOf('NOTIZIE DA STRADA') > -1 ? msgText : `NOTIZIE DA STRADA: ${msgText}`;
        const logMsg = `${new Date().toLocaleString()} - ${logStr}\n`;
        fs.appendFileSync(NOTIF_FILE, logMsg);
        
        logDriverNotification(driver, logStr);
        
        res.json({ success: true });
    });
});

// GET fetch secure Promemoria/Reminders for mobile view
app.get('/api/promemoria', (req, res) => {
    // Ricostruzione JOIN con Anagrafica per recuperare Indirizzo e Telefono
    const sql = `
        SELECT 
            P.ID, 
            P.Cliente AS Nominativo, 
            (COALESCE(C.Residenza, '') || ' ' || COALESCE(C.Civico, '') || ', ' || COALESCE(C.Localita, '')) AS Indirizzo, 
            C.Telefono, 
            P.DataPromemoria AS Data, 
            P.OraPromemoria AS Ora, 
            P.Note, 
            P.Stato, 
            P.Tipologia 
        FROM tblPromemoria P
        LEFT JOIN tblClienti C ON P.Cliente = C.CognomeNome
        WHERE UPPER(P.Stato) NOT LIKE 'COMPLETATO%' 
          AND UPPER(P.Stato) NOT LIKE 'ANNULLATO%' 
        ORDER BY P.DataPromemoria ASC, P.OraPromemoria ASC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("SELECT Error Promemoria:", err.message);
            return res.status(500).json({ error: "Errore tabella Promemoria. Verificare esistenza." });
        }
        res.json(rows || []);
    });
});

// Single endpoint for all SQL queries
app.post('/query', (req, res) => {
    let sql = req.body.sql;
    if (!sql) return res.status(400).json({ error: "Missing SQL" });
    
    sql = transformSQL(sql);

    const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA');

    if (isSelect) {
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error("SELECT Error:", err.message, "in SQL:", sql);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows || []);
        });
    } else {
        db.run(sql, [], function(err) {
            if (err) {
                console.error("CRUD Error:", err.message, "in SQL:", sql);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, changes: this.changes, lastID: this.lastID });
        });
    }
});


// --- NUOVE API RADAR FLOTTA ---
let fleetGPS = {};
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
    const now = Date.now();
    for (const user in fleetGPS) {
        // Rimuove i veicoli che non inviano il segnale GPS da più di 30 minuti
        if (now - fleetGPS[user].timestamp > 30 * 60 * 1000) {
            delete fleetGPS[user];
        }
    }
    res.json(fleetGPS);
});

app.get('/api/gps_clear', (req, res) => {
    fleetGPS = {};
    res.json({ success: true });
});

app.get('/api/gps_remove', (req, res) => {
    const { user } = req.query;
    if (user && fleetGPS[user]) {
        delete fleetGPS[user];
    }
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`✅ UNIFIED PORTABLE BRIDGE SULLA PORTA ${PORT}`);
    console.log(`Disponibile per HTA locale e Mobile App`);
    console.log(`========================================`);
});
