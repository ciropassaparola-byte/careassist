const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

// 1. Aggiungiamo le golden rules al DB
const dbTarget = /const pathologyDB = \{[\s\S]*?\n\};\n/m;

const newDB = `const pathologyDB = {
    'nessuna': { 
        name: "Nessuna / Prevenzione Base", desc: "Regime bilanciato standard mediterraneo.", 
        goldenRule: "Bevi almeno 2 litri d'acqua al giorno e mangia 5 porzioni di frutta e verdura.",
        avoid: ["Eccesso di sale", "Zuccheri aggiunti"], promote: ["Frutta", "Verdura", "Cereali Integrali", "Pesce", "Legumi"] 
    },
    'diabete': { 
        name: "Diabete di Tipo 2", desc: "Controllo rigoroso del carico glicemico.", 
        goldenRule: "Regola delle 4 P: Non abbinare MAI nello stesso pasto Pane, Pasta, Patate o Pizza.",
        avoid: ["Zucchero aggiunto", "Dolci", "Pane bianco", "Succhi di frutta"], promote: ["Cereali integrali", "Legumi", "Verdure fibrose", "Noci"] 
    },
    'ipertensione': { 
        name: "Ipertensione Arteriosa", desc: "Dieta DASH. Controllo rigoroso del sodio (< 2g/die).", 
        goldenRule: "Usa le spezie, il limone e le erbe aromatiche per insaporire al posto del sale.",
        avoid: ["Sale aggiunto", "Dadi da brodo", "Salumi", "Cibi in scatola"], promote: ["Verdure fresche", "Banane (Potassio)", "Latticini magri", "Pesce fresco"] 
    },
    'ipercolesterolemia': { 
        name: "Ipercolesterolemia", desc: "Riduzione colesterolo LDL e grassi saturi.", 
        goldenRule: "Aumenta la fibra solubile: i beta-glucani dell'avena intrappolano il colesterolo.",
        avoid: ["Burro", "Formaggi stagionati", "Insaccati", "Frattaglie"], promote: ["Avena (Beta-glucani)", "Salmone", "Olio EVO", "Legumi"] 
    },
    'steatosi': { 
        name: "Steatosi Epatica", desc: "Protocollo per ripristino epatico. Azzeramento alcol e grassi saturi.", 
        goldenRule: "Evita tassativamente il consumo di alcol: il fegato ha bisogno di disintossicarsi completamente.",
        avoid: ["Alcolici", "Burro e Panna", "Insaccati", "Fritti", "Zuccheri"], promote: ["Salmone", "Noci", "Verdure a foglia verde", "Carciofi"] 
    },
    'reflusso': { 
        name: "Reflusso Gastroesofageo (MRGE)", desc: "Limitazione alimenti irritanti e a svuotamento gastrico lento.", 
        goldenRule: "Non sdraiarti mai nelle 2 ore successive ai pasti per evitare la risalita degli acidi.",
        avoid: ["Caffè", "Menta", "Pomodoro crudo", "Agrumi", "Cioccolato", "Cibi grassi/fritti"], promote: ["Verdure lesse", "Carni bianche magre", "Pesce magro", "Banane, Mele"] 
    },
    'gastrite': { 
        name: "Gastrite Acuta / Cronica", desc: "Dieta blanda, pasti piccoli e frequenti.", 
        goldenRule: "Mastica molto lentamente ogni boccone: la prima digestione avviene in bocca.",
        avoid: ["Spezie piccanti", "Caffè", "Alcol", "Agrumi", "Cibi molto caldi o freddi"], promote: ["Patate", "Riso bianco", "Zucchine", "Carni bianche"] 
    },
    'colon': { 
        name: "Sindrome Intestino Irritabile (IBS)", desc: "Protocollo Low-FODMAP (bassi fermentescibili).", 
        goldenRule: "Riduci lo stress e mangia a orari regolari, l'intestino è il nostro secondo cervello.",
        avoid: ["Cipolla e Aglio", "Legumi (se non decorticati)", "Lattosio", "Frumento", "Mele/Pere"], promote: ["Avena", "Riso", "Carote", "Carne/Pesce magri", "Latte senza lattosio"] 
    },
    'gotta': { 
        name: "Iperuricemia / Gotta", desc: "Riduzione delle purine e dell'alcol.", 
        goldenRule: "Stop all'alcol (specie la birra) e bevi moltissima acqua per favorire l'escrezione di acido urico.",
        avoid: ["Frattaglie", "Acciughe/Sardine", "Selvaggina", "Alcol (Birra e Superalcolici)", "Frutti di mare"], promote: ["Latticini (aiutano escrezione urati)", "Ciliegie", "Uova", "Verdure fresche"] 
    },
    'celiachia': { 
        name: "Celiachia", desc: "Esclusione totale e rigorosa del glutine.", 
        goldenRule: "Attenzione massima alle contaminazioni incrociate: usa posate e pentole dedicate.",
        avoid: ["Frumento", "Orzo", "Farro", "Segale", "Avena (se non certificata)", "Alimenti contaminati"], promote: ["Riso", "Mais", "Quinoa", "Grano saraceno", "Patate", "Carne/Pesce freschi"] 
    },
    'renale': { 
        name: "Insufficienza Renale (Lieve)", desc: "Controllo dell'apporto proteico (0.8g/kg) e del sodio.", 
        goldenRule: "Fai bollire le verdure in abbondante acqua (e buttala) per eliminare il potassio in eccesso.",
        avoid: ["Sale aggiunto", "Eccesso di carne", "Dadi", "Insaccati", "Alimenti ultra-processati"], promote: ["Pasta aproteica (se necessario)", "Frutta e Verdura", "Olio EVO", "Proteine alto valore biologico (Uova)"] 
    },
    'tiroide': { 
        name: "Ipotiroidismo", desc: "Supporto metabolico e iodio.", 
        goldenRule: "Cuoci sempre le verdure crucifere (broccoli, cavoli), da crude bloccano l'assorbimento dello iodio.",
        avoid: ["Soia cruda", "Crucifere crude (broccoli, cavoli)", "Eccesso di zuccheri (rallentano metabolismo)"], promote: ["Pesce marino (Iodio)", "Noci del Brasile (Selenio)", "Uova", "Cereali integrali"] 
    },
    'pcos': { 
        name: "PCOS (Sindrome Ovaio Policistico)", desc: "Miglioramento dell'insulino-resistenza.", 
        goldenRule: "Inizia sempre il pasto con una porzione di verdura fibrosa per appiattire il picco glicemico.",
        avoid: ["Carboidrati raffinati", "Zuccheri", "Latticini vaccini (in alcuni casi)", "Grassi trans"], promote: ["Proteine magre", "Verdure", "Semi di lino", "Grassi sani (Avocado, Olio EVO)"] 
    },
    'stipsi': { 
        name: "Stipsi Cronica", desc: "Alto apporto di fibre (25-30g) e idratazione (>2L).", 
        goldenRule: "Idratazione prima di tutto: le fibre senza acqua peggiorano il tappo intestinale.",
        avoid: ["Tè molto concentrato", "Riso brillato", "Eccesso di formaggi", "Cibi secchi/disidratati senza acqua"], promote: ["Kiwi (al mattino)", "Prugne", "Cereali integrali", "Legumi", "Olio EVO a crudo"] 
    },
    'osteoporosi': { 
        name: "Osteoporosi", desc: "Integrazione naturale di Calcio e Vitamina D.", 
        goldenRule: "Associa sempre calcio e attività fisica (camminate): l'osso si rinforza solo se stimolato dal carico.",
        avoid: ["Eccesso di sale (aumenta calciuria)", "Eccesso di caffeina", "Alcol"], promote: ["Latticini magri", "Acqua calcica (>150mg/L)", "Verdure a foglia verde scuro", "Mandorle"] 
    }
};
`;

js = js.replace(dbTarget, newDB);

// 2. Aggiorniamo updateAnalysis()
const uiTarget = `panel.innerHTML = \`
        <p style="margin-bottom:15px; font-weight:500;">\${p.desc}</p>`;
const newUi = `panel.innerHTML = \`
        <p style="margin-bottom:15px; font-weight:500;">\${p.desc}</p>
        \${p.goldenRule ? \`<div class="golden-rule"><strong>⭐ Regola D'Oro:</strong> \${p.goldenRule}</div>\` : ''}`;

js = js.replace(uiTarget, newUi);

fs.writeFileSync(jsFile, js, 'utf8');

// 3. Aggiungiamo CSS
const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

const cssRule = `
.golden-rule {
    background: linear-gradient(135deg, #fef08a, #fde047);
    color: #854d0e;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 15px;
    font-size: 0.95rem;
    border-left: 4px solid #eab308;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
@media print {
    .golden-rule { border: 1px solid #000; border-left: 4px solid #000; color: #000; background: transparent; }
}
`;
css = css + '\n' + cssRule;
fs.writeFileSync(cssFile, css, 'utf8');

console.log('Golden Rules Added');
