const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

let db = new sqlite3.Database('C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\File_Sistema\\ConsegneDB_Legacy.sqlite');

db.all('SELECT DataConsegna, KmAndata, KmRitorno FROM tblConsegne', [], (err, rows) => {
  if (err) {
    throw err;
  }
  fs.writeFileSync('C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\File_Sistema\\consegne_dump.json', JSON.stringify(rows));
  console.log("DUMP OK, rows: " + rows.length);
});

db.close();
