const fs = require('fs');

const jsFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/app.js';
let js = fs.readFileSync(jsFile, 'utf8');

const targetDB = /const pathologyDB = \{[\s\S]*?\n    \};\n/;

const newDB = `const pathologyDB = {
    'nessuna': { 
        name: "Nessuna / Prevenzione Base", desc: "Regime bilanciato standard mediterraneo.", 
        goldenRule: "Bevi almeno 2 litri d'acqua al giorno e mangia 5 porzioni di frutta e verdura.",
        avoid: ["Eccesso di sale", "Zuccheri aggiunti", "Bevande gassate", "Superalcolici", "Grassi idrogenati (Margarina)", "Carni processate (Wurstel)"], 
        promote: ["Frutta fresca", "Verdura di stagione", "Cereali Integrali", "Pesce azzurro", "Legumi", "Olio EVO a crudo"] 
    },
    'diabete': { 
        name: "Diabete di Tipo 2", desc: "Controllo rigoroso del carico glicemico.", 
        goldenRule: "Regola delle 4 P: Non abbinare MAI nello stesso pasto Pane, Pasta, Patate o Pizza.",
        avoid: ["Zucchero aggiunto", "Miele e Sciroppi", "Dolci e Pasticceria", "Pane bianco", "Succhi di frutta", "Bevande zuccherate", "Frutta sciroppata", "Caramelle e Cioccolato al latte"], 
        promote: ["Cereali integrali (Avena, Orzo)", "Legumi", "Verdure fibrose", "Noci e Mandorle", "Pesce ricco di Omega-3", "Carni bianche magre"] 
    },
    'ipertensione': { 
        name: "Ipertensione Arteriosa", desc: "Dieta DASH. Controllo rigoroso del sodio (< 2g/die).", 
        goldenRule: "Usa le spezie, il limone e le erbe aromatiche per insaporire al posto del sale.",
        avoid: ["Sale aggiunto da cucina", "Dadi da brodo", "Salumi e Insaccati", "Cibi in scatola e Salamoie", "Formaggi stagionati (Pecorino, Grana)", "Salse pronte (Ketchup, Soia)", "Snack salati (Patatine)", "Liquirizia"], 
        promote: ["Verdure fresche", "Banane (Ricche di Potassio)", "Latticini magri", "Pesce fresco", "Spezie ed erbe aromatiche", "Aglio e Cipolla"] 
    },
    'ipercolesterolemia': { 
        name: "Ipercolesterolemia", desc: "Riduzione colesterolo LDL e grassi saturi.", 
        goldenRule: "Aumenta la fibra solubile: i beta-glucani dell'avena intrappolano il colesterolo.",
        avoid: ["Burro e Panna", "Formaggi stagionati e fusi", "Insaccati e Salumi", "Frattaglie (Fegato, Cervello)", "Carni rosse grasse", "Prodotti da forno industriali", "Olio di palma e cocco", "Maionese"], 
        promote: ["Avena (Beta-glucani)", "Pesce Azzurro (Salmone, Sgombro)", "Legumi (Soia, Ceci)", "Frutta secca", "Olio EVO", "Fibre solubili (Mele con buccia)"] 
    },
    'steatosi': { 
        name: "Steatosi Epatica (Fegato Grasso)", desc: "Protocollo per ripristino epatico. Azzeramento alcol e grassi saturi.", 
        goldenRule: "Evita tassativamente il consumo di alcol: il fegato ha bisogno di disintossicarsi completamente.",
        avoid: ["Alcolici e Superalcolici", "Burro, Panna e Lardo", "Insaccati e Carni lavorate", "Fritti e Soffritti", "Zuccheri semplici e Bevande dolci", "Salse elaborate (Maionese, Ketchup)", "Carni rosse grasse", "Cibi da fast-food"], 
        promote: ["Carciofi e Cardo (Epatoprotettori)", "Verdure a foglia amara (Cicoria, Rucola)", "Pesce magro", "Olio EVO", "Limone a digiuno", "Tè verde (Antiossidante)"] 
    },
    'reflusso': { 
        name: "Reflusso Gastroesofageo (MRGE)", desc: "Controllo dell'acidità gastrica e svuotamento rapido.", 
        goldenRule: "Evita di sdraiarti subito dopo i pasti. Attendi almeno 2 o 3 ore prima di andare a letto.",
        avoid: ["Pomodoro crudo e passata", "Agrumi (Arance, Limoni)", "Caffè e Tè forte", "Cioccolato e Cacao", "Menta", "Cibi fritti e molto grassi", "Spezie piccanti (Peperoncino, Pepe nero)", "Bevande gassate", "Alcolici", "Aglio e Cipolla crudi"], 
        promote: ["Verdure cotte (Zucchine, Carote)", "Carni bianche ai ferri", "Pesce al vapore", "Cereali ben cotti", "Patate lesse", "Banane mature", "Finocchio (Digestivo)"] 
    },
    'gastrite': { 
        name: "Gastrite Acuta / Cronica", desc: "Regime non irritante per la mucosa gastrica.", 
        goldenRule: "Mastica molto lentamente e fai piccoli pasti frequenti per tamponare l'acidità.",
        avoid: ["Pepe, Peperoncino e Spezie forti", "Brodo di carne o dadi", "Caffè (anche decaffeinato)", "Alcolici e Superalcolici", "Agrumi e Succhi acidi", "Pomodoro", "Fritti", "Cibi troppo caldi o troppo freddi", "Gomme da masticare"], 
        promote: ["Riso bianco o Pasta ben cotta", "Zucchine e Carote lesse", "Pollo o Tacchino al vapore", "Olio EVO a crudo", "Patate", "Mele cotte"] 
    },
    'colon': { 
        name: "Sindrome Intestino Irritabile (IBS)", desc: "Protocollo Low-FODMAP per riduzione del gonfiore.", 
        goldenRule: "Riduci temporaneamente gli alimenti fermentescibili (FODMAP) e reintroducili gradualmente.",
        avoid: ["Legumi (Ceci, Fagioli, Lenticchie)", "Latticini con Lattosio", "Cipolla e Aglio", "Mele, Pere, Pesche, Susine", "Cavoli, Broccoli e Cavolfiori", "Gomme da masticare (Xilitolo, Sorbitolo)", "Frumento e Segale in grandi quantità", "Funghi", "Cibi molto elaborati"], 
        promote: ["Latte delattosato o vegetale", "Kiwi, Banane, Mirtilli, Arance", "Zucchine, Melanzane, Carote", "Riso, Quinoa, Avena", "Carni magre", "Pesce", "Patate"] 
    },
    'gotta': { 
        name: "Iperuricemia / Gotta", desc: "Controllo rigoroso delle purine.", 
        goldenRule: "Evita alimenti ad alta densità cellulare (come le frattaglie) per limitare la produzione di acido urico.",
        avoid: ["Frattaglie (Fegato, Rognone)", "Carni rosse (Manzo, Castrato)", "Molluschi e Crostacei", "Acciughe, Sardine e Sgombro", "Estratti di carne e Dadi", "Alcolici (specialmente Birra)", "Selvaggina", "Cibi ricchi di fruttosio industriale"], 
        promote: ["Ciliegie e Frutti di bosco (Uricosurici)", "Latticini magri", "Uova", "Pasta e Riso", "Verdure (eccetto Spinaci e Asparagi in eccesso)", "Acqua abbondante (>2.5 litri/die)"] 
    },
    'celiachia': { 
        name: "Celiachia (Gluten-Free)", desc: "Esclusione totale e a vita del glutine.", 
        goldenRule: "Attenzione alle contaminazioni incrociate: usa taglieri e pentole separate per cucinare il senza glutine.",
        avoid: ["Frumento (Grano)", "Farro, Orzo e Segale", "Kamut e Spelta", "Pangrattato e Farine normali", "Lievito madre tradizionale", "Seitan", "Birra tradizionale", "Cibi industriali non certificati 'Senza Glutine'"], 
        promote: ["Riso, Mais e Grano Saraceno", "Quinoa, Amaranto e Miglio", "Tuberi (Patate, Tapioca)", "Carni fresche e Pesce", "Uova", "Legumi", "Frutta e Verdura fresca"] 
    },
    'renale': { 
        name: "Insufficienza Renale (Stadio 1-3)", desc: "Controllo di proteine, potassio e fosforo.", 
        goldenRule: "Per ridurre il potassio, taglia le verdure a pezzetti e lasciale a bagno nell'acqua per alcune ore prima di cuocerle.",
        avoid: ["Eccesso di Proteine (Carni rosse grandi porzioni)", "Sale aggiunto", "Cibi in scatola", "Formaggi fusi e Sottilette (Ricchi di Fosforo)", "Frutta secca e Cacao", "Brodo di carne", "Banane e Kiwi (Se il potassio è alto)", "Salumi"], 
        promote: ["Cereali aproteici (se prescritti)", "Pasta e Riso bianco", "Verdure bollite (scartando l'acqua)", "Olio EVO", "Burro (con moderazione per calorie)", "Mela, Pera"] 
    },
    'tiroide': { 
        name: "Ipotiroidismo", desc: "Supporto metabolico e modulazione iodio/gozzigeni.", 
        goldenRule: "Non esagerare con cavoli e broccoli crudi, poiché contengono sostanze 'gozzigene' che ostacolano l'assorbimento dello iodio.",
        avoid: ["Verdure crucifere crude (Cavoli, Broccoli, Rapanelli)", "Eccesso di Soia (Ostacola l'assorbimento degli ormoni tiroidei)", "Zuccheri raffinati (A causa del metabolismo rallentato)", "Grassi idrogenati", "Alghe in eccesso (Senza consulto medico)", "Alimenti ultra-processati"], 
        promote: ["Pesce di mare (Ricco di Iodio)", "Uova", "Carni magre", "Noci del Brasile (Ricche di Selenio)", "Cereali integrali (Per la stipsi)", "Sale iodato (Con moderazione)"] 
    },
    'pcos': { 
        name: "Sindrome Ovaio Policistico (PCOS)", desc: "Controllo dell'insulino-resistenza associata.", 
        goldenRule: "Prediligi sempre carboidrati a basso indice glicemico per tenere a bada i picchi di insulina.",
        avoid: ["Farine raffinate (Pane bianco, Pizza normale)", "Zuccheri semplici e Dolci", "Bevande zuccherate", "Latte vaccino in eccesso (Stimola l'IGF-1)", "Cibi confezionati", "Grassi saturi (Burro, Insaccati)"], 
        promote: ["Cereali integrali (Avena, Quinoa, Farro)", "Legumi", "Semi di Lino e Zucca", "Pesce azzurro (Omega-3)", "Verdure a foglia verde", "Carboidrati abbinati a proteine o grassi buoni"] 
    },
    'stipsi': { 
        name: "Stipsi Cronica", desc: "Aumento dell'apporto di fibre insolubili e acqua.", 
        goldenRule: "Non basta mangiare fibre: senza un adeguato apporto d'acqua (almeno 2L), le fibre induriscono ulteriormente le feci.",
        avoid: ["Pane bianco e Riso brillato", "Patate", "Banane poco mature", "Mele senza buccia", "Formaggi stagionati", "Tè molto concentrato", "Eccesso di Cioccolato fondente", "Cibi astringenti (Limone in eccesso)"], 
        promote: ["Prugne e Kiwi maturi", "Crusca d'avena o frumento", "Cereali 100% integrali", "Legumi", "Verdura cotta (Spinaci, Bietole)", "Zuppe e Minestroni", "Acqua ricca di magnesio"] 
    },
    'osteoporosi': { 
        name: "Osteoporosi / Osteopenia", desc: "Ottimizzazione di Calcio e Vitamina D.", 
        goldenRule: "L'eccesso di sale e di caffeina aumenta la perdita di calcio attraverso le urine. Moderazione!",
        avoid: ["Sale aggiunto (Aumenta l'escrezione di calcio)", "Caffè in eccesso (>3 tazzine/die)", "Superalcolici", "Bevande tipo Cola (Ricche di fosfati)", "Crusca in eccesso (Ostacola l'assorbimento del calcio)", "Eccesso di proteine animali"], 
        promote: ["Latticini magri (Yogurt, Ricotta)", "Grana padano o Parmigiano (30g)", "Mandorle", "Acqua calcica (>200 mg/L di Calcio)", "Verdure a foglia verde scura", "Pesce azzurro (Per Vitamina D)"] 
    }
};
`;

if(js.match(targetDB)) {
    js = js.replace(targetDB, newDB);
    fs.writeFileSync(jsFile, js, 'utf8');
    console.log('Database enriched successfully');
}
