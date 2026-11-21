const sqlite3 = require('sqlite3').verbose();
const dbPath = require('path').join('C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\File_Sistema\\ConsegneDB_Legacy.sqlite');
const db = new sqlite3.Database(dbPath);
const sql = "SELECT * FROM tblRifornimenti WHERE DataRifornimento >= '2026-01-01' AND CAST(PrezzoAlLitro AS DECIMAL) > 0 ORDER BY DataRifornimento ASC";
db.all(sql, [], (err, rows) => {
    if (err) { console.error("ERR:", err); return; }
    
    if (rows.length === 0) { console.log("Nessun dato."); return; }
    
    let prezzoIniziale = parseFloat(rows[0].PrezzoAlLitro);
    let totSpeso = 0;
    let totSpesoIdeale = 0;
    let totLitri = 0;
    
    for(let r of rows) {
        let litri = parseFloat(r.Litri);
        let prezzo = parseFloat(r.PrezzoAlLitro);
        let costo = parseFloat(r.CostoTotale);
        
        if (!isNaN(litri) && !isNaN(prezzo)) {
            totSpeso += costo;
            totSpesoIdeale += (litri * prezzoIniziale);
            totLitri += litri;
        }
    }
    
    let differenza = totSpeso - totSpesoIdeale;
    console.log("Prezzo iniziale (inizio anno): " + prezzoIniziale + " Euro");
    console.log("Litri totali 2026: " + totLitri.toFixed(2));
    console.log("Totale speso reale: " + totSpeso.toFixed(2) + " Euro");
    console.log("Totale speso se il prezzo fosse rimasto " + prezzoIniziale + ": " + totSpesoIdeale.toFixed(2) + " Euro");
    console.log("Differenza (Costo in più dovuto agli aumenti): " + differenza.toFixed(2) + " Euro");
});
