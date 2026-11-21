const sqlite3 = require('sqlite3').verbose();
const dbPath = require('path').join(__dirname, '..', '..', 'ConsegneDB_Legacy.sqlite');
const db = new sqlite3.Database(dbPath);
db.all("SELECT DataConsegna FROM tblConsegne LIMIT 5", [], (err, rows) => {
    if (err) console.error("ERR:", err);
    console.log("ROWS:", rows);
});
