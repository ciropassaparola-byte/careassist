const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('../../ConsegneDB_Legacy.sqlite');

db.all('SELECT ID, DataConsegna FROM tblConsegne WHERE DataConsegna LIKE "%/%"', (err, rows) => {
    if(err) return console.error(err);
    if(!rows || rows.length === 0) return console.log('No rows to update.');
    let count=0;
    rows.forEach(r => {
        const p = r.DataConsegna.split('/');
        if(p.length===3) {
            const nd = p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0');
            db.run('UPDATE tblConsegne SET DataConsegna = ? WHERE ID = ?', [nd, r.ID], (err2) => {
                if(err2) console.error(err2);
                else {
                    count++;
                    if(count===rows.length) console.log('Updated ' + count + ' rows');
                }
            });
        } else {
            count++;
        }
    });
});
