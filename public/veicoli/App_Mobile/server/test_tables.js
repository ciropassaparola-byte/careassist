const sqlite3 = require('sqlite3').verbose();
const dbPath = require('path').join('C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\ConsegneDB_Legacy.sqlite');
const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, rows) => {
    console.log(rows);
});
