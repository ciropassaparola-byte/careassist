const fs = require('fs');

const cleanJS = `// Database Medico delle Patologie
const pathologyDB = {
    'nessuna': { name: "Nessuna / Prevenzione Base", desc: "Regime bilanciato standard mediterraneo.", avoid: ["Eccesso di sale", "Zuccheri aggiunti"], promote: ["Frutta", "Verdura", "Cereali Integrali", "Pesce", "Legumi"] },
    'diabete': { name: "Diabete di Tipo 2", desc: "Controllo rigoroso del carico glicemico.", avoid: ["Zucchero aggiunto", "Dolci", "Pane bianco", "Succhi di frutta"], promote: ["Cereali integrali", "Legumi", "Verdure fibrose", "Noci"] },
    'ipertensione': { name: "Ipertensione Arteriosa", desc: "Dieta DASH. Controllo rigoroso del sodio (< 2g/die).", avoid: ["Sale aggiunto", "Dadi da brodo", "Salumi", "Cibi in scatola"], promote: ["Verdure fresche", "Banane (Potassio)", "Latticini magri", "Pesce fresco"] },
    'ipercolesterolemia': { name: "Ipercolesterolemia", desc: "Riduzione colesterolo LDL e grassi saturi.", avoid: ["Burro", "Formaggi stagionati", "Insaccati", "Frattaglie"], promote: ["Avena (Beta-glucani)", "Salmone", "Olio EVO", "Legumi"] },
    'steatosi': { name: "Steatosi Epatica", desc: "Protocollo per ripristino epatico. Azzeramento alcol e grassi saturi.", avoid: ["Alcolici", "Burro e Panna", "Insaccati", "Fritti", "Zuccheri"], promote: ["Salmone", "Noci", "Verdure a foglia verde", "Carciofi"] },
    'reflusso': { name: "Reflusso Gastroesofageo (MRGE)", desc: "Limitazione alimenti irritanti e a svuotamento gastrico lento.", avoid: ["Caffè", "Menta", "Pomodoro crudo", "Agrumi", "Cioccolato", "Cibi grassi/fritti"], promote: ["Verdure lesse", "Carni bianche magre", "Pesce magro", "Banane, Mele"] },
    'gastrite': { name: "Gastrite Acuta / Cronica", desc: "Dieta blanda, pasti piccoli e frequenti.", avoid: ["Spezie piccanti", "Caffè", "Alcol", "Agrumi", "Cibi molto caldi o freddi"], promote: ["Patate", "Riso bianco", "Zucchine", "Carni bianche"] },
    'colon': { name: "Sindrome Intestino Irritabile (IBS)", desc: "Protocollo Low-FODMAP (bassi fermentescibili).", avoid: ["Cipolla e Aglio", "Legumi (se non decorticati)", "Lattosio", "Frumento", "Mele/Pere"], promote: ["Avena", "Riso", "Carote", "Carne/Pesce magri", "Latte senza lattosio"] },
    'gotta': { name: "Iperuricemia / Gotta", desc: "Riduzione delle purine e dell'alcol.", avoid: ["Frattaglie", "Acciughe/Sardine", "Selvaggina", "Alcol (Birra e Superalcolici)", "Frutti di mare"], promote: ["Latticini (aiutano escrezione urati)", "Ciliegie", "Uova", "Verdure fresche"] },
    'celiachia': { name: "Celiachia", desc: "Esclusione totale e rigorosa del glutine.", avoid: ["Frumento", "Orzo", "Farro", "Segale", "Avena (se non certificata)", "Alimenti contaminati"], promote: ["Riso", "Mais", "Quinoa", "Grano saraceno", "Patate", "Carne/Pesce freschi"] },
    'renale': { name: "Insufficienza Renale (Lieve)", desc: "Controllo dell'apporto proteico (0.8g/kg) e del sodio.", avoid: ["Sale aggiunto", "Eccesso di carne", "Dadi", "Insaccati", "Alimenti ultra-processati"], promote: ["Pasta aproteica (se necessario)", "Frutta e Verdura", "Olio EVO", "Proteine alto valore biologico (Uova)"] },
    'tiroide': { name: "Ipotiroidismo", desc: "Supporto metabolico e iodio.", avoid: ["Soia cruda", "Crucifere crude (broccoli, cavoli)", "Eccesso di zuccheri (rallentano metabolismo)"], promote: ["Pesce marino (Iodio)", "Noci del Brasile (Selenio)", "Uova", "Cereali integrali"] },
    'pcos': { name: "PCOS (Sindrome Ovaio Policistico)", desc: "Miglioramento dell'insulino-resistenza.", avoid: ["Carboidrati raffinati", "Zuccheri", "Latticini vaccini (in alcuni casi)", "Grassi trans"], promote: ["Proteine magre", "Verdure", "Semi di lino", "Grassi sani (Avocado, Olio EVO)"] },
    'stipsi': { name: "Stipsi Cronica", desc: "Alto apporto di fibre (25-30g) e idratazione (>2L).", avoid: ["Tè molto concentrato", "Riso brillato", "Eccesso di formaggi", "Cibi secchi/disidratati senza acqua"], promote: ["Kiwi (al mattino)", "Prugne", "Cereali integrali", "Legumi", "Olio EVO a crudo"] },
    'osteoporosi': { name: "Osteoporosi", desc: "Integrazione naturale di Calcio e Vitamina D.", avoid: ["Eccesso di sale (aumenta calciuria)", "Eccesso di caffeina", "Alcol"], promote: ["Latticini magri", "Acqua calcica (>150mg/L)", "Verdure a foglia verde scuro", "Mandorle"] }
};

function checkDoctorProfile() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    if (saved) {
        let doc = JSON.parse(saved);
        document.getElementById('ui-doc-name').innerText = doc.name;
        document.getElementById('ui-doc-spec').innerText = doc.spec;
        document.getElementById('ui-doc-clinic').innerText = doc.clinic;
        if(doc.avatar) document.querySelector('.doc-avatar').innerText = doc.avatar;
        
        document.getElementById('doctor-setup-modal').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
    } else {
        document.getElementById('doctor-setup-modal').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
}

function saveDoctorProfile() {
    let name = document.getElementById('setup-doc-name').value;
    let spec = document.getElementById('setup-doc-spec').value;
    let clinic = document.getElementById('setup-doc-clinic').value;
    let avatar = document.getElementById('setup-doc-avatar').value;
    
    if(!name) { alert("Inserisci almeno il tuo Nome e Titolo."); return; }
    
    let doc = { name, spec, clinic, avatar };
    localStorage.setItem('mednutri_doc_profile', JSON.stringify(doc));
    checkDoctorProfile();
}

function resetDoctorProfile() {
    localStorage.removeItem('mednutri_doc_profile');
    checkDoctorProfile();
}

const weekDays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function initTable() {
    const tbody = document.getElementById('diet-body');
    tbody.innerHTML = '';
    weekDays.forEach(day => {
        let tr = document.createElement('tr');
        tr.innerHTML = \`
            <td>\${day}</td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true" style="color:#64748b; font-size:0.85rem; font-style:italic;"></td>
        \`;
        tbody.appendChild(tr);
    });
}

function updateAnalysis() {
    const selector = document.getElementById('patient-pathology');
    const panel = document.getElementById('medical-analysis');
    const customBox = document.getElementById('custom-pathology-box');
    
    if (selector.value === 'altro') {
        customBox.style.display = 'block';
        panel.innerHTML = \`<p class="placeholder-text">Compila i campi personalizzati. Il piano andrà generato manualmente o potrai usare le linee guida di base.</p>\`;
        return;
    } else {
        customBox.style.display = 'none';
    }

    const p = pathologyDB[selector.value];

    if (!p || selector.value === 'nessuna') {
        panel.innerHTML = \`<p class="placeholder-text">\${p ? p.desc : 'Seleziona una patologia.'}</p>\`;
        return;
    }

    let avoidHtml = p.avoid.map(i => \`<li>❌ \${i}</li>\`).join('');
    let promoteHtml = p.promote.map(i => \`<li>✅ \${i}</li>\`).join('');

    panel.innerHTML = \`
        <p style="margin-bottom:15px; font-weight:500;">\${p.desc}</p>
        <div class="rule-item danger">
            <strong>Da Evitare Tassativamente:</strong>
            <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">\${avoidHtml}</ul>
        </div>
        <div class="rule-item success">
            <strong>Da Promuovere Fortemente:</strong>
            <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">\${promoteHtml}</ul>
        </div>
    \`;
}

function generateDiet() {
    const pat = document.getElementById('patient-pathology').value;
    const name = document.getElementById('patient-name').value || 'il Paziente';
    
    if (pat === 'altro') {
        alert("Hai selezionato 'Altra Patologia'. Inserisci i pasti manualmente nella tabella tenendo conto dei cibi che hai specificato di evitare.");
        return;
    }

    const tbody = document.getElementById('diet-body');
    const rows = tbody.querySelectorAll('tr');
    
    let baseColazione = "Yogurt magro, 30g avena, 1 frutto fresco";
    let basePranzo = "70g pasta integrale, 150g petto di pollo, insalata, olio EVO";
    let baseSpuntino = "1 mela o 15 mandorle";
    let baseCena = "200g pesce bianco, verdure di stagione, 50g pane integrale";

    if (pat === 'diabete' || pat === 'pcos') { baseColazione = "Yogurt greco, 30g avena, mirtilli"; basePranzo = "70g farro, 150g tacchino, insalata, olio EVO"; baseCena = "200g merluzzo, broccoli, 50g pane di segale"; }
    else if (pat === 'ipertensione' || pat === 'osteoporosi') { baseColazione = "Latte scremato, fette senza sale, banana"; basePranzo = "80g pasta pomodoro (zero sale), zucchine grigliate"; baseCena = "150g pollo limone, spinaci lessi (zero sale)"; }
    else if (pat === 'ipercolesterolemia' || pat === 'steatosi') { baseColazione = "Porridge (avena e latte parz. scremato), noci"; basePranzo = "70g riso integrale, 150g salmone, carciofi"; baseCena = "Minestrone verdure, 150g tacchino piastrato"; }
    else if (pat === 'reflusso' || pat === 'gastrite') { baseColazione = "Latte parz. scremato, fette biscottate classiche"; basePranzo = "70g riso bianco, 150g pollo bollito, carote lesse"; baseSpuntino = "1 banana"; baseCena = "200g platessa, patate lesse, olio EVO a crudo"; }
    else if (pat === 'colon') { baseColazione = "Latte senza lattosio, fiocchi di avena"; basePranzo = "70g riso, 150g carne magra, carote"; baseSpuntino = "1 kiwi"; baseCena = "200g orata, zucchine (senza semi), gallette di riso"; }
    else if (pat === 'celiachia') { baseColazione = "Yogurt, 30g quinoa soffiata, frutta"; basePranzo = "70g pasta senza glutine, 150g pollo, insalata"; baseCena = "200g pesce, patate al forno, verdure"; }
    else if (pat === 'gotta') { baseColazione = "Latte scremato, fette, ciliegie/fragole"; basePranzo = "70g pasta, 2 uova sode, verdure"; baseCena = "150g petto pollo, abbondante insalata, formaggio magro"; }
    else if (pat === 'renale') { baseColazione = "Tè, fette biscottate, burro e marmellata"; basePranzo = "80g pasta aproteica, 100g petto di pollo, verdure (poco potassio)"; baseSpuntino = "Mele cotte"; baseCena = "120g pesce, verdure (bollite due volte per togliere potassio)"; }
    else if (pat === 'stipsi') { baseColazione = "Kefir, 40g crusca d'avena, 2 prugne secche"; basePranzo = "80g pasta integrale, 150g lenticchie, spinaci"; baseSpuntino = "2 Kiwi"; baseCena = "Minestrone con legumi, 50g pane integrale"; }
    else if (pat === 'tiroide') { baseColazione = "Yogurt, noci del brasile, fiocchi d'avena"; basePranzo = "70g riso, 150g pesce di mare (sgombro/tonno), pomodori"; baseCena = "2 uova, verdure cotte, pane integrale"; }

    rows.forEach(r => {
        let tds = r.querySelectorAll('td');
        tds[1].innerText = baseColazione;
        tds[2].innerText = basePranzo;
        tds[3].innerText = baseSpuntino;
        tds[4].innerText = baseCena;
        tds[5].innerText = \`Protocollo \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Base'}\`;
    });

    alert(\`Terapia settimanale generata con successo per \${name}, ottimizzata per: \${pat !== 'nessuna' ? pathologyDB[pat].name : 'Mantenimento Base'}.\`);
}

function calculateAge() {
    let dob = document.getElementById('patient-dob').value;
    if (dob) {
        let birthDate = new Date(dob);
        let today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        let m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        document.getElementById('calculated-age').innerText = '(' + age + ' anni)';
    } else {
        document.getElementById('calculated-age').innerText = '';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    checkDoctorProfile();
    initTable();
});
`;

fs.writeFileSync('C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js', cleanJS, 'utf8');
console.log('Fixed syntax error by rewriting cleanJS');
