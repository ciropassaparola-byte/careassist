const fs = require('fs');
const path = require('path');
const sqlite3 = require(path.join(__dirname, 'App_Mobile', 'server', 'node_modules', 'sqlite3')).verbose();

const csvPath = path.join(__dirname, '..', '_Archivio_Legacy_e_Excel', 'CLIENTI PUGLIA.csv');
const dbPath = path.join(__dirname, 'ConsegneDB_Legacy.sqlite');

console.log('CSV Path:', csvPath);
console.log('DB Path:', dbPath);

if (!fs.existsSync(csvPath)) {
    console.error('CRITICAL: CSV file not found at:', csvPath);
    process.exit(1);
}

// Province standardizer (matches HTA logic)
function getSiglaStandard(p) {
    if (!p) return '';
    const up = p.toString().toUpperCase().replace(/\./g, '').trim();
    if (up === 'BT' || up === 'BAT' || up === 'BARLETTA' || up === 'ANDRIA' || up === 'TRANI' || 
        up.indexOf('BARLETTA') !== -1 || up.indexOf('ANDRIA') !== -1 || up.indexOf('TRANI') !== -1) return 'BT';
    if (up.indexOf('BARI') !== -1 || up === 'BA') return 'BA';
    if (up.indexOf('TARANTO') !== -1 || up === 'TA') return 'TA';
    if (up.indexOf('BRINDISI') !== -1 || up === 'BR') return 'BR';
    if (up.indexOf('FOGGIA') !== -1 || up === 'FG') return 'FG';
    if (up.indexOf('LECCE') !== -1 || up === 'LE') return 'LE';
    return up;
}

// Parse invalidity string to match HTA standards
function parseInvalidita(inv) {
    const val = (inv || '').trim().toUpperCase();
    if (val === 'CIECO') return 'Cieco';
    if (val === 'IPOVEDENTE') return 'Ipovedente';
    // Title case other options
    return val.charAt(0) + val.slice(1).toLowerCase();
}

// Read CSV Content (clean BOM)
let csvContent = fs.readFileSync(csvPath, 'utf8');
csvContent = csvContent.replace(/^\ufeff/, ''); // Strip UTF-8 BOM if present

const csvLines = csvContent.split('\n');
const clientsToInsert = [];

console.log('Reading CSV file lines...');

for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i].replace(/\r/g, '').trim();
    if (line === '') continue;

    const cols = line.split(';');
    if (cols.length < 3) continue;

    const invaliditaRaw = (cols[0] || '').trim();
    const denominazioneRaw = (cols[1] || '').trim();
    const citta = (cols[2] || '').trim();
    const provRaw = (cols[4] || '').trim();
    const email = (cols[6] || '').trim();
    const tel = (cols[7] || '').trim();
    const cell = (cols[8] || '').trim();

    if (!denominazioneRaw) continue;

    // Filter out deceased clients
    const upperInv = invaliditaRaw.toUpperCase();
    if (upperInv.includes('DECEDUT')) {
        continue;
    }

    const cognomeNome = denominazioneRaw.toUpperCase().trim();
    const provincia = getSiglaStandard(provRaw);
    const invalidita = parseInvalidita(invaliditaRaw);

    // Combine phones
    const phones = [];
    if (tel) phones.push(tel.trim());
    if (cell) phones.push(cell.trim());
    const telefono = phones.join(';');

    clientsToInsert.push({
        cognomeNome,
        localita: citta,
        provincia,
        telefono,
        statoGravita: invalidita,
        email,
        note: ''
    });
}

console.log(`Parsed ${clientsToInsert.length} active client records from CSV.`);

// Connect to Database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('CRITICAL: Error opening SQLite database:', err);
        process.exit(1);
    }
    
    // Query active records to prevent duplicates
    db.all('SELECT ID, CognomeNome FROM tblClienti WHERE (isCancellato IS NULL OR isCancellato = 0)', [], (err, rows) => {
        if (err) {
            console.error('CRITICAL: Error querying tblClienti:', err);
            db.close();
            process.exit(1);
        }

        const existingNames = new Set(rows.map(r => r.CognomeNome.toUpperCase().trim()));
        console.log(`Loaded ${existingNames.size} existing clients from SQLite.`);

        const newClients = clientsToInsert.filter(c => !existingNames.has(c.cognomeNome));
        console.log(`Found ${newClients.length} clients not present in the database.`);

        if (newClients.length === 0) {
            console.log('No new clients to insert. Database is already up-to-date.');
            db.close();
            process.exit(0);
        }

        // Execute batch inserts inside a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const stmt = db.prepare(`
                INSERT INTO tblClienti (
                    CognomeNome, Localita, Provincia, Telefono, StatoGravita, Email, Note,
                    Residenza, Cap, CodFisc, PIva, SDI, PEC, PercorsoFoto, isCancellato,
                    DataInserimento, DataUltimaModifica
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', '', '', '', '', 0, ?, ?)
            `);

            let insertedCount = 0;
            newClients.forEach(c => {
                stmt.run(
                    c.cognomeNome,
                    c.localita,
                    c.provincia,
                    c.telefono,
                    c.statoGravita,
                    c.email,
                    c.note,
                    nowStr,
                    nowStr,
                    (err) => {
                        if (err) {
                            console.error(`Error inserting ${c.cognomeNome}:`, err.message);
                        } else {
                            insertedCount++;
                        }
                    }
                );
            });

            stmt.finalize();

            db.run('COMMIT', (err) => {
                if (err) {
                    console.error('CRITICAL: Failed to commit transaction:', err);
                } else {
                    console.log(`Successfully migrated ${insertedCount} new clients to the database.`);
                }
                db.close();
            });
        });
    });
});
