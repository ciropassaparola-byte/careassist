const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'ConsegneDB_Legacy.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT ID, ClienteNome, OraConsegna, Priorita FROM tblConsegne LIMIT 15", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            rows.forEach(row => {
                console.log(`ID: ${row.ID} | Name: ${row.ClienteNome} | Ora: ${row.OraConsegna} | Priorita: ${row.Priorita}`);
            });
        }
        db.close();
    });
});
