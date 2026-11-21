const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('../../ConsegneDB_Legacy.sqlite');

db.all("SELECT DISTINCT ClienteNome, LocalitaConsegna, IndirizzoConsegna, Telefono FROM tblConsegne WHERE ClienteNome NOT IN (SELECT CognomeNome FROM tblClienti)", (err, rows) => {
    if(err) return console.error(err);
    if(!rows || rows.length === 0) return console.log('No missing clients.');
    let count = 0;
    rows.forEach(r => {
        db.run("INSERT INTO tblClienti (CognomeNome, Comune, Residenza, Telefono, StatoInvalidita) VALUES (?, ?, ?, ?, 'DA DEFINIRE')", 
            [r.ClienteNome, r.LocalitaConsegna, r.IndirizzoConsegna, r.Telefono], 
            (err2) => {
                if(err2) console.error(err2);
                count++;
                if(count === rows.length) console.log('Inserted ' + count + ' missing clients');
            }
        );
    });
});
