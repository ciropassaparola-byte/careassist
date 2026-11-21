// ============================================================
//  CHECKPOINT WAL — Consolida dati residui da crash precedente
//  Questo script viene eseguito PRIMA di avviare il programma
//  per assicurarsi che eventuali dati nel file .wal vengano
//  scritti nel database principale.
// ============================================================

const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'ConsegneDB_Legacy.sqlite');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

// Se non esiste il file WAL, non c'è nulla da fare
if (!fs.existsSync(walPath)) {
    console.log('✅ Nessun file WAL residuo trovato. Database pulito.');
    process.exit(0);
}

const walSize = fs.statSync(walPath).size;
if (walSize === 0) {
    console.log('✅ File WAL vuoto. Nessun dato da consolidare.');
    // Pulizia file vuoti
    try { fs.unlinkSync(walPath); } catch(e) {}
    try { fs.unlinkSync(shmPath); } catch(e) {}
    process.exit(0);
}

console.log(`⚠️ Trovato file WAL residuo (${(walSize / 1024).toFixed(1)} KB). Consolidamento in corso...`);

try {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('🔴 Errore apertura DB per checkpoint:', err.message);
            process.exit(1);
        }

        // Esegui checkpoint completo (TRUNCATE svuota il WAL dopo il checkpoint)
        db.run("PRAGMA wal_checkpoint(TRUNCATE)", (errCP) => {
            if (errCP) {
                console.error('⚠️ Errore durante checkpoint WAL:', errCP.message);
            } else {
                console.log('✅ Checkpoint WAL completato! Dati consolidati nel database.');
            }

            db.close((errClose) => {
                if (errClose) console.error('⚠️ Errore chiusura DB:', errClose.message);
                
                // Pulizia file WAL e SHM residui
                try { if (fs.existsSync(walPath)) fs.unlinkSync(walPath); } catch(e) {}
                try { if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath); } catch(e) {}
                
                console.log('✅ File WAL e SHM rimossi. Database pronto per l\'uso.');
                process.exit(0);
            });
        });
    });
} catch(e) {
    console.error('🔴 Errore critico durante checkpoint:', e.message);
    process.exit(1);
}
