// Database Medico delle Patologie con Linee Guida Cliniche Ufficiali, Interazioni Farmaco-Cibo e Stile di Vita
const pathologyDB = {
    'nessuna': { 
        name: "Nessuna / Prevenzione Base", 
        desc: "Regime bilanciato standard mediterraneo ad elevata densità nutrizionale (Linee Guida CREA / SINU).", 
        guidelineRef: "Linee Guida CREA 2018 - Dieta Mediterranea Cardioprotettiva",
        goldenRule: "Bevi almeno 2 litri d'acqua al giorno e assumi 5 porzioni tra frutta fresca e verdura di stagione.",
        lifestyle: "Attività fisica moderata aerobica per almeno 150 minuti alla settimana (30 min di camminata a passo svelto al giorno). Idratazione continua distribuita nell'arco della giornata.",
        drugInteractions: "Nessuna interazione farmacologica segnalata in regime preventivo.",
        labMonitoring: "Check-up ematochimico annuale: Emocromo, Glicemia, Profilo Lipidico completo (Colesterolo Tot, HDL, LDL, Trigliceridi), Transaminasi (ALT/AST), Creatinina ed esame urine.",
        avoid: ["Eccesso di sale da cucina (>5g/die)", "Zuccheri semplici aggiunti e bevande dolci", "Bevande gassate e zuccherate", "Superalcolici", "Grassi idrogenati e acidi grassi trans", "Carni ultra-processate (Wurstel, insaccati ricchi di nitriti)"], 
        promote: ["Frutta fresca di stagione a basso indice glicemico", "Verdura cruda e cotta variopinta", "Cereali integrali in chicco (Farro, Orzo, Avena)", "Pesce azzurro ricco di Omega-3 (Sgombro, Sardine)", "Legumi cotti al naturale", "Olio Extravergine d'Oliva a crudo come condimento principe"] 
    },
    'diabete': { 
        name: "Diabete di Tipo 2 & Insulino-Resistenza", 
        desc: "Controllo rigoroso del carico glicemico e prevenzione complicanze micro/macrovascolari (Standard AMD-SID / ADA).", 
        guidelineRef: "Standard Italiani per la Cura del Diabete Mellito (AMD-SID 2023) / ADA Guidelines",
        goldenRule: "Regola del Piatto Sano & 4P: Non abbinare mai nello stesso pasto Pane, Pasta, Patate e Pizza. Precedi sempre il pasto con verdura cruda per smussare il picco insulinico post-prandiale.",
        lifestyle: "Camminata di 15-20 minuti immediatamente dopo i pasti principali per aumentare l'uptake muscolare di glucosio insulino-indipendente. Esercizi contro resistenza 2-3 volte/settimana.",
        drugInteractions: "⚠️ Con Metformina: monitorare assorbimento Vitamina B12. Con Sulfoniluree o Insuline: rischio ipoglicemie se si saltano pasti o con alcol a digiuno. Con SGLT2i (Gliflozine): idratazione abbondante per prevenire disidratazione e infezioni genitourinarie.",
        labMonitoring: "Emoglobina Glicata (HbA1c) ogni 3-6 mesi (target < 7.0% o personalizzato), Microalbuminuria annuale, Creatinina/eGFR, Fondo oculare biennale, Controllo piedi.",
        avoid: ["Zucchero raffinato e di canna", "Miele, sciroppi e melassa", "Dolci, merendine e pasticceria", "Pane bianco e farine raffinate 00", "Succhi di frutta e bibite zuccherate", "Frutta sciroppata, canditi e datteri", "Alcolici a digiuno (rischio ipoglicemia severa)", "Caramelle e snack dolci"], 
        promote: ["Cereali a chicco intero (Avena, Orzo, Farro integrale)", "Legumi ricchi di fibre solubili (Lenticchie, Ceci)", "Verdure fibrose a foglia amara", "Frutta secca a guscio (Mandorle, Noci: 30g/die)", "Pesce azzurro e pesce magro", "Carni bianche magre ai ferri"] 
    },
    'ipertensione': { 
        name: "Ipertensione Arteriosa", 
        desc: "Protocollo dietetico DASH (Dietary Approaches to Stop Hypertension) e restrizione sodio (ESC/ESH).", 
        guidelineRef: "Linee Guida Europee ESC/ESH 2023 per la Gestione dell'Ipertensione Arteriosa",
        goldenRule: "Sostituisci il sale con spezie, erbe aromatiche, aglio, cipolla e succo di limone. Riduci il sodio a meno di 2g al giorno (corrispondenti a max 5g di sale da cucina).",
        lifestyle: "Attività aerobica continuativa (camminata, nuoto, cyclette) 40-50 min per 4-5 giorni alla settimana. Tecniche di respirazione diaframmatica e gestione dello stress. Misurazione pressoria domiciliare mattino/sera.",
        drugInteractions: "⚠️ Con ACE-inibitori o Sartani: attenzione all'eccesso di sostituti del sale a base di cloruro di potassio (rischio iperkaliemia). Con Calcio-antagonisti (es. Amlodipina): EVITARE IL POMPELMO. Evitare la Liquirizia (aumenta la pressione). Con Diuretici dell'ansa: monitorare potassio ed elettroliti.",
        labMonitoring: "Elettroliti sierici (Sodio, Potassio, Cloro), Creatinina ed eGFR, Azotemia, Esame urine (Rapporto Albumina/Creatinina), Monitoraggio Holter pressorio 24h se indicato.",
        avoid: ["Sale da cucina aggiunto a tavola", "Dadi da brodo, estratti di carne e glutammato", "Salumi, insaccati e carni conservate", "Cibi in salamoia e sottaceti industriali", "Formaggi stagionati e salati (Pecorino, Grana, Feta)", "Salse commerciali (Salsa di soia, ketchup, maionese)", "Snack salati, patatine e arachidi salate", "Liquirizia pura e dolciumi alla liquirizia"], 
        promote: ["Verdure a foglia verde scuro (ricche di Magnesio)", "Banane, albicocche e patate lesse (apporto naturale di Potassio)", "Latticini freschi a ridotto tenore di grassi e sale", "Pesce fresco al vapore o al forno", "Erbe aromatiche (Origano, Basilico, Rosmarino, Timo)", "Acqua minimamente mineralizzata iposodica (Sodio < 10 mg/L)"] 
    },
    'ipercolesterolemia': { 
        name: "Ipercolesterolemia & Dislipidemia", 
        desc: "Riduzione colesterolo LDL e acidi grassi saturi, potenziamento fitosteroli e omega-3 (EAS/ESC).", 
        guidelineRef: "Linee Guida ESC/EAS 2019 per la Gestione delle Dislipidemie",
        goldenRule: "Massimizza l'apporto di fibre solubili (beta-glucani dell'avena e pectina) e sostituisci interamente i grassi saturi animali con monoinsaturi da olio extravergine d'oliva.",
        lifestyle: "Esercizio aerobico di resistenza (cardio) a intensità moderata per favorire l'innalzamento della frazione HDL e la clearance dei trigliceridi. Riduzione ponderale mirata se BMI > 25.",
        drugInteractions: "⚠️ Con Statine (Atorvastatina, Simvastatina): DIVIETO ASSOLUTO DI POMPELMO (inibisce il CYP3A4 aumentando la concentrazione ematica e il rischio di miopatie/rabdomiolisi). Moderare alcolici.",
        labMonitoring: "Profilo lipidico completo dopo 8-12 settimane dall'avvio della dietoterapia: Colesterolo Totale, HDL, LDL calcolato o diretto, Trigliceridi, Apolipoproteina B, CPK e Transaminasi se in terapia con statine.",
        avoid: ["Burro, panna, strutto e lardo", "Formaggi fusi, stagionati e mascarpone", "Insaccati grassi e carni rosse marmorizzate", "Frattaglie (Fegato, cervello, rognone)", "Olio di palma, olio di cocco e grassi vegetali idrogenati", "Prodotti da forno industriali e croissant", "Maionese e salse a base di uova e panna"], 
        promote: ["Avena in fiocchi e crusca d'avena (fonte eccellente di Beta-glucani)", "Pesce azzurro (Sgombro, Salmone selvaggio, Alacce) 3 volte/settimana", "Legumi secchi cotti (Ceci, Soia, Lenticchie)", "Frutta secca a guscio (30g di noci o mandorle al giorno)", "Olio Extravergine d'Oliva crudo spremuto a freddo", "Mele con buccia ben lavata (ricche di pectina)"] 
    },
    'steatosi': { 
        name: "Steatosi Epatica (NAFLD / MASLD)", 
        desc: "Rigenerazione epatocitaria, abbattimento del grasso viscerale ed epatico, azzeramento alcol e fruttosio aggiunto (EASL).", 
        guidelineRef: "Linee Guida EASL-EASD-EASO per la Gestione della MASLD / NAFLD",
        goldenRule: "Azzeramento totale di alcolici e superalcolici. Elimina categoricamente il fruttosio industriale (sciroppo di mais, bibite) che sovraccarica la lipogenesi de novo epatica.",
        lifestyle: "Puntare a una riduzione graduale del 7-10% del peso corporeo se sovrappeso per ridurre drasticamente il contenuto lipidico intraepatico. Attività fisica combinata aerobica + pesi 3 volte a settimana.",
        drugInteractions: "⚠️ In caso di epatite concomitante o terapie antivirali (es. Entecavir, Sofosbuvir): assumere rigorosamente i farmaci con la cadenza stabilita (es. a digiuno o lontano dai pasti come prescritto). Evitare integratori fitoterapici epatotossici non validati.",
        labMonitoring: "Transaminasi ALT/AST, Gamma-GT, Fosfatasi Alcalina, Bilirubina frazionata, Ecografia addome superiore per stadiazione steatosi, FIB-4 index per rischio fibrosi.",
        avoid: ["Alcol, vino, birra e superalcolici (tolleranza zero)", "Fritti, soffritti e cotture a temperatura elevata con oli ossidati", "Bevande gassate, tè freddi zuccherati e succhi di frutta commerciali", "Carni rosse grasse e carni lavorate conservate", "Burro, lardo, panna e salse industriali ricche di grassi saturi", "Fast-food e snack iper-calorici industriali"], 
        promote: ["Carciofi, cardi e cicoria amara (ricchi di cinarina ed epatoprotettori)", "Rucola e verdure a foglia verde scuro", "Pesce bianco e pesce azzurro cotti al vapore o al cartoccio", "Olio EVO a crudo (antiossidanti polifenolici)", "Limone spremuto in acqua tiepida a digiuno", "Tè verde e caffè amaro (protettivo documentato contro la progressione fibrotica)", "Cereali integrali in chicco"] 
    },
    'reflusso': { 
        name: "Reflusso Gastroesofageo (MRGE) & Esofagite", 
        desc: "Protezione mucosa esofagea, accelerazione svuotamento gastrico e riduzione pressione intragastrica.", 
        guidelineRef: "Linee Guida Nazionali SGG per la Malattia da Reflusso Gastroesofageo",
        goldenRule: "Non coricarsi mai prima di 2.5 - 3 ore dalla fine del pasto. Fai pasti piccoli, frequenti e mastica lentamente. Solleva la testiera del letto di 15-20 cm.",
        lifestyle: "Evitare cinture o indumenti stretti all'addome che aumentano la pressione intra-addominale. Camminare dolcemente dopo i pasti (evitare di piegarsi a 90° o sdraiarsi sul divano). Abolizione del fumo.",
        drugInteractions: "⚠️ Con Inibitori di Pompa Protonica (IPP: Pantoprazolo, Omeprazolo, Esomeprazolo): assumere 30-45 minuti PRIMA della colazione a stomaco vuoto con acqua per massimizzare l'efficacia antisecretiva. Con antiacidi/alginati: assumere 1-2 ore dopo i pasti e prima di dormire.",
        labMonitoring: "Valutazione clinica sintomi (Reflux Symptom Index). EGDS (Gastroscopia) se compaiono segnali d'allarme (disfagia, calo ponderale, anemia) o mancata risposta a terapia.",
        avoid: ["Pomodoro crudo, concentrato e passata di pomodoro", "Agrumi e succhi d'arancia/pompelmo", "Caffè (anche decaffeinato) e tè concentrato", "Cioccolato e cacao", "Menta e caramelle alla menta (rilasciano lo sfintere esofageo inferiore)", "Cibi molto grassi, fritture e intingoli", "Spezie piccanti (Pepe, peperoncino, curry)", "Bevande gassate e bevande alcoliche"], 
        promote: ["Verdure dolci cotte a vapore (Zucchine, carote, zucca)", "Carni bianche magre ai ferri o lessate (Pollo, tacchino)", "Pesce bianco magro (Merluzzo, sogliola, spigola)", "Cereali ben cotti e digeribili (Riso basmati, farro)", "Patate lesse o al vapore", "Finocchi crudi o cotti (azione carminativa e digestiva)", "Banane mature e mele cotte"] 
    },
    'gastrite': { 
        name: "Gastrite Acuta / Cronica & Dispepsia", 
        desc: "Dieta di risparmio gastrico per riepitelizzazione mucosa ed eubiosi gastrica.", 
        guidelineRef: "Linee Guida di Gastroenterologia Clinica SIGE",
        goldenRule: "Fraziona l'alimentazione in 5 piccoli pasti quotidiani evitando digiuni prolungati e abbuffate che causano picchi di secrezione acida cloridrica.",
        lifestyle: "Mangiare con calma in ambiente rilassato, dedicando almeno 20 minuti al pasto e masticando a lungo ogni boccone. Evitare l'uso improprio di FANS (antinfiammatori) a stomaco vuoto.",
        drugInteractions: "⚠️ Con Gastroprotettori (IPP o Antiacidi): non assumere contemporaneamente a integratori di ferro o calcio (ne riducono l'assorbimento). Distanziare le dosi.",
        labMonitoring: "Ricerca Helicobacter Pylori (Urea Breath Test o Antigene fecale), Emocromo per escludere sanguinamenti occulti, Sideremia e Ferritina.",
        avoid: ["Pepe nero, peperoncino, noce moscata e spezie forti", "Brodo concentrato di carne o dadi industriali", "Caffè, tè nero e bevande contenenti xantine", "Alcolici e vino bianco acido", "Fritti e soffritti", "Cibi a temperature estreme (troppo caldi o ghiacciati)", "Gomme da masticare (stimolano vuota acidità gastrica)"], 
        promote: ["Riso bianco o pasta corta ben cotta e condita solo con un filo d'olio a crudo", "Zucchine e carote bollite", "Pollo, tacchino e coniglio lessati o al vapore", "Olio Extravergine d'Oliva crudo in quantità dosata", "Patate cotte al vapore", "Mele sbucciate cotte al forno"] 
    },
    'colon': { 
        name: "Sindrome Intestino Irritabile (IBS)", 
        desc: "Protocollo Low-FODMAP per riduzione della fermentazione batterica colica e del meteorismo.", 
        guidelineRef: "Linee Guida Monash University & Società Italiana di Nutrizione Umana (SINU) per IBS",
        goldenRule: "Fase di eliminazione transitoria (4-6 settimane) dei cibi ad alto contenuto di FODMAP, seguita da reintroduzione controllata per target personalizzato.",
        lifestyle: "Attività fisica dolce (Yoga, camminata rilassante) per favorire la motilità intestinale fisiologica e ridurre la reattività dell'asse intestino-cervello. Regolarità negli orari dei pasti.",
        drugInteractions: "⚠️ Con Fermenti lattici/Probiotici: assumere a stomaco vuoto o lontano dai pasti secondo ceppo specifico. Con antispastici: assumere 20 minuti prima del pasto principale.",
        labMonitoring: "Calprotectina fecale (per escludere malattie infiammatorie IBD), Esami celiachia (IgA anti-tTG), Sangue occulto nelle feci, Coprocoltura ed esame parassitologico.",
        avoid: ["Legumi tradizionali con buccia spessa (Fagioli, ceci secchi)", "Latticini contenenti lattosio (latte vaccino, formaggi freschi non stagionati)", "Aglio e cipolla (anche soffritti o in polvere)", "Mele, pere, pesche, anguria e susine (ricche di fruttosio/polioli)", "Cavoli, verza, cavolfiori e broccoli", "Dolcificanti artificiali (Xilitolo, sorbitolo, mannitolo)", "Funghi e carciofi in fase acuta"], 
        promote: ["Latte e yogurt delattosati o bevande vegetali (Riso, avena gluten free)", "Kiwi maturi, mirtilli, arance e fragole", "Zucchine, carote, fagiolini fini e spinaci novelli", "Riso basmati, quinoa, miglio e avena", "Pesce fresco e carni magre", "Uova biologiche", "Olio aromatizzato all'aglio fatto in casa (senza fibra solida)"] 
    },
    'gotta': { 
        name: "Iperuricemia / Gotta Clinica", 
        desc: "Restrizione purinica per prevenzione artropatia uratica e nefrolitiasi (EULAR).", 
        guidelineRef: "Linee Guida EULAR 2020 per la Gestione della Gotta e dell'Iperuricemia",
        goldenRule: "Idratazione abbondante (>2.5 - 3 litri di liquidi al giorno) con acque alcaline o bicarbonato-calciche per favorire la solubilità e l'escrezione renale di acido urico.",
        lifestyle: "Calo ponderale graduale se sovrappeso (evitare digiuni prolungati o diete chetogeniche che scatenano attacchi gottosi acuti per competizione tra chetoni e acido urico nei tubuli renali).",
        drugInteractions: "⚠️ Con Allopurinolo o Febuxostat (es. Adenuric): assumere quotidianamente dopo i pasti con un bicchiere pieno d'acqua. Non sospendere autonomamente durante un attacco acuto.",
        labMonitoring: "Uricemia sierica ogni 1-3 mesi (target terapeutico < 6.0 mg/dL, o < 5.0 mg/dL nei casi tofacei), Creatinina ed eGFR, Ecografia articolare o renale per calcoli.",
        avoid: ["Frattaglie (Fegato, rognone, animelle, cuore)", "Carni rosse grasse e carni di animali giovani (Vitello, agnello)", "Molluschi, crostacei, acciughe, sardine, aringhe e sgombro", "Estratti di carne concentrati, sughi di carne e dadi da brodo", "Birra (anche analcolica: ricca di guanosina) e superalcolici", "Selvaggina e cacciagione", "Bevande dolcificate con sciroppo di mais ad alto contenuto di fruttosio"], 
        promote: ["Ciliegie e frutti di bosco freschi (azione uricosurica scientificamente validata)", "Latticini magri (Yogurt magro, latte scremato: azione ipouricemizzante)", "Uova come fonte nobile priva di purine", "Pasta, riso e cereali raffinati", "Verdure di stagione a basso tenore purinico", "Acqua alcalina o bicarbonata (> 2.5 litri/die)"] 
    },
    'celiachia': { 
        name: "Celiachia (Enteropatia da Glutine)", 
        desc: "Esclusione rigorosa, totale e a vita del glutine (Linee Guida AIC / ESPGHAN).", 
        guidelineRef: "Linee Guida Nazionali AIC (Associazione Italiana Celiachia) & ESPGHAN",
        goldenRule: "Tolleranza zero al glutine: attenzione maniacale alle contaminazioni crociate in cucina (taglieri, tostapane, posate in legno, olio di frittura riutilizzato).",
        lifestyle: "Educazione del paziente e dei conviventi alla manipolazione sicura degli alimenti. Lettura accurata dell'etichettatura alimentare (presenza del marchio Spiga Barrata o dicitura 'Senza Glutine').",
        drugInteractions: "⚠️ Verificare sempre che sciroppi, farmaci e integratori non contengano amido di frumento o derivati del glutine tra gli eccipienti non certificati.",
        labMonitoring: "Anticorpi anti-transglutaminasi IgA (anti-tTG) e dosaggio IgA totali a 6 e 12 mesi dalla diagnosi per valutare l'aderenza alla dieta. Ferritina, Folati, Vitamina D e B12.",
        avoid: ["Frumento (Grano tenero e duro)", "Farro, orzo, segale, kamut e spelta", "Pangrattato, farina 00, semola e couscous convenzionale", "Lievito madre tradizionale", "Seitan e alimenti a base di glutine vitale", "Birra convenzionale d'orzo o frumento", "Prodotti industriali non provvisti della certificazione 'Senza Glutine'"], 
        promote: ["Riso in tutte le varietà (Basmati, Carnaroli, Venere, Rosso)", "Mais, polenta e grano saraceno (naturalmente privo di glutine)", "Quinoa, amaranto, miglio e teff", "Tuberi freschi (Patate, patate dolci, tapioca)", "Carni fresche, uova, pesci freschi al naturale", "Legumi secchi lavati e cotti", "Frutta fresca e verdure integre"] 
    },
    'renale': { 
        name: "Insufficienza Renale Cronica (IRC Stadio 1-3)", 
        desc: "Controllo rigoroso del carico proteico, del fosforo, del sodio e modulazione del potassio (KDIGO / SIN).", 
        guidelineRef: "Linee Guida Internazionali KDIGO 2023 & Società Italiana di Nefrologia (SIN)",
        goldenRule: "Limitare l'apporto proteico a 0.6 - 0.8 g/kg di peso ideale. Per abbattere il potassio, tagliare le verdure a piccoli pezzi e lessarle cambiando l'acqua a metà cottura.",
        lifestyle: "Mantenimento di un rigoroso controllo pressorio (< 130/80 mmHg). Monitoraggio quotidiano del peso per cogliere precocemente segni di ritenzione idrica o edemi declivi.",
        drugInteractions: "⚠️ Monitorare attentamente diuretici, chelanti del fosforo (da assumere RIGOROSAMENTE durante i pasti per sequestrare il fosforo alimentare) e integratori vitaminici.",
        labMonitoring: "Creatinina sierica ed eGFR (formula CKD-EPI), Azotemia, Elettroliti (Sodio, Potassio, Cloro, Calcio, Fosforo), PTH intatto, Bicarbonati, Proteinuria 24h.",
        avoid: ["Eccesso di proteine animali (Carni rosse, porzioni abbondanti di formaggi)", "Sale aggiunto e dadi da brodo", "Formaggi fusi, sottilette e cibi addizionati con polifosfati industriali", "Frutta secca a guscio, cacao e cioccolato (molto ricchi di potassio e fosforo)", "Brodi di carne e verdura concentrati", "Banane, kiwi, fichi e albicocche se il potassio sierico è elevato (> 5.0 mEq/L)", "Salumi e insaccati"], 
        promote: ["Cereali aproteici speciali (se prescritti dal nefrologo)", "Pasta e riso raffinati cotti in abbondante acqua", "Verdure a basso tenore di potassio lessate e scolate", "Olio Extravergine d'Oliva crudo come fonte calorica pulita", "Piccole porzioni pesate di carne bianca o albume d'uovo", "Mele e pere sbucciate"] 
    },
    'tiroide': { 
        name: "Ipotiroidismo & Tiroidite Cronica", 
        desc: "Supporto della sintesi ormonale tiroidea, apporto ottimale di iodio e selenio, modulazione cibi gozzigeni.", 
        guidelineRef: "Linee Guida AIT (Associazione Italiana della Tiroide) & ETA",
        goldenRule: "Assumi la Levo-tiroxina al mattino rigorosamente a digiuno con solo acqua e attendi almeno 30-45 minuti prima di fare colazione per garantirne il completo assorbimento.",
        lifestyle: "Attività fisica aerobica regolare per contrastare il rallentamento metabolico basale e favorire la motilità intestinale. Buona igiene del sonno.",
        drugInteractions: "⚠️ Con Levotiroxina (Eutirox, Tirosint): NON assumere insieme a caffè, soia, integratori di ferro, calcio o antiacidi (riducono drasticamente la biodisponibilità). Distanziare di almeno 4 ore.",
        labMonitoring: "TSH reflex ogni 6-12 mesi (o a 6-8 settimane da variazioni di dosaggio terapeutico), FT3, FT4, Anticorpi anti-TPO e anti-TG se eziologia autoimmune.",
        avoid: ["Verdure crucifere CRUDE in grandi quantità (Cavolo, cavolfiore, broccoli, verza: rilasciano tiocianati gozzigeni)", "Eccesso di derivati della soia in prossimità del farmaco", "Zuccheri raffinati e dolciumi che aggravano l'aumento ponderale", "Grassi idrogenati", "Alghe essiccate e integratori iodati non prescritti (rischio sbalzi funzionali)"], 
        promote: ["Pesce di mare fresco (fonte primaria di Iodio naturale)", "Uova biologiche intere", "Noci del Brasile (1-2 al giorno garantiscono l'intero fabbisogno di Selenio)", "Cereali integrali per prevenire la stipsi", "Carni bianche magre", "Sale iodato (utilizzato con moderazione a crudo)"] 
    },
    'pcos': { 
        name: "Sindrome dell'Ovaio Policistico (PCOS)", 
        desc: "Modulazione dell'insulino-resistenza associata, riduzione dell'iperandrogenismo e controllo ponderale.", 
        guidelineRef: "International Evidence-based Guideline for PCOS 2023",
        goldenRule: "Punta su pasti a basso e medio carico glicemico: associa sempre una fonte proteica e grassi monoinsaturi ai carboidrati complessi per evitare picchi insulinici stimolatori degli androgeni.",
        lifestyle: "Attività fisica combinata (allenamenti di forza/pesi associati a sessioni HIIT o aerobiche) per migliorare la sensibilità periferica all'insulina e la composizione corporea.",
        drugInteractions: "⚠️ Con Inositolo (Myo-inositolo + D-chiro-inositolo): assumere con costanza due volte al giorno lontano dai pasti. Con eventuale Metformina: assumere a stomaco pieno per ridurre effetti gastrointestinali.",
        labMonitoring: "Glicemia e Insulina basali (indice HOMA-IR), Curva da carico orale di glucosio con insulinemia, Profilo ormonale (LH, FSH, Testosterone libero, DHEA-S, 17-OHP), Profilo lipidico.",
        avoid: ["Farine raffinate e pane bianco classico", "Zuccheri semplici, merendine, snack dolci", "Bevande zuccherate, succhi e soft-drink", "Latte vaccino in eccesso (stimola la secrezione di IGF-1)", "Grassi idrogenati industriali e cibi fritti", "Alimenti ad altissimo indice glicemico"], 
        promote: ["Cereali integrali in chicco (Farro, orzo, quinoa, riso integrale)", "Semi di lino macinati e semi di zucca (ricchi di lignani e zinco)", "Pesce azzurro e salmone ricchi di Omega-3 anti-infiammatori", "Legumi cotti al naturale", "Verdure a foglia verde scuro", "Avocado e Olio EVO"] 
    },
    'stipsi': { 
        name: "Stipsi Cronica & Rallentato Transito", 
        desc: "Ottimizzazione del transito colico, combinazione di fibre solubili/insolubili e idratazione mirata.", 
        guidelineRef: "Linee Guida Nazionali AIGO per la Gestione della Stipsi Funzionale",
        goldenRule: "Le fibre alimentari funzionano SOLO se accompagnate da un abbondante introito idrico (>2 - 2.5 litri d'acqua al giorno); in caso contrario, rischiano di formare feci dure e ostruenti.",
        lifestyle: "Stabilire un orario fisso per l'evacuazione senza reprimere lo stimolo (preferibilmente 20-30 min dopo la colazione per sfruttare il riflesso gastro-colico). Posizione accovacciata con sgabellino sotto i piedi.",
        drugInteractions: "⚠️ Con lassativi osmotici (Macrogol, Lattulosio): bere abbondante acqua. Non abusare di lassativi antrachinonici da erboristeria (Senna, Frangula: causano assuefazione e melanosi del colon).",
        labMonitoring: "Emocromo (escludere anemia), Elettroliti sierici, Funzionalità tiroidea (TSH: escludere ipotiroidismo secondario), Colonscopia se età > 50 anni o sintomi d'allarme.",
        avoid: ["Riso bianco brillato e crema di riso", "Pane bianco raffinato e fette biscottate non integrali", "Banane acerbe e cachi non maturi", "Mele sbucciate", "Tè nero fortemente concentrato e ricco di tannini astringenti", "Formaggi stagionati a pasta dura", "Eccesso di cioccolato e cacao"], 
        promote: ["Kiwi maturi (2 al mattino a stomaco vuoto)", "Prugne secche reidratate in acqua per una notte", "Cereali 100% integrali e crusca d'avena", "Legumi con buccia ben cotti (Lenticchie, fagioli borlotti)", "Verdure cotte ad azione lassativa (Spinaci, bietole, zucchine)", "Acque minerali ricche di Magnesio e Solfati"] 
    },
    'osteoporosi': { 
        name: "Osteoporosi & Osteopenia", 
        desc: "Massimizzazione del picco di massa ossea, ottimizzazione del bilancio di Calcio, Vitamina D e Magnesio (SIOMMMS).", 
        guidelineRef: "Linee Guida SIOMMMS 2021 per la Diagnosi e Terapia dell'Osteoporosi",
        goldenRule: "Combina l'apporto di calcio biodisponibile (acque calciche e alimenti ricchi) con una corretta sintesi o supplementazione di Vitamina D e regolare attività contro gravità.",
        lifestyle: "Attività fisica a carico gravitazionale (camminata sostenuta, salita scale, ballo, ginnastica con piccoli pesi) che stimola meccanicamente gli osteoblasti. Esposizione solare protetta per almeno 20 minuti al giorno.",
        drugInteractions: "⚠️ Con Bifosfonati orali (Alendronato, Risedronato): assumere al risveglio a digiuno con SOLO ACQUA di rubinetto (un bicchiere pieno), rimanendo in posizione rigorosamente eretta/seduta per almeno 30 minuti senza mangiare né bere.",
        labMonitoring: "Densitometria Ossea MOC DEXA femorale e lombare ogni 18-24 mesi, 25-OH Vitamina D sierica, Calcemia, Fosforemia, Calciuria 24 ore, Creatinina e Paratormone (PTH).",
        avoid: ["Sale da cucina in eccesso (aumenta l'escrezione renale di calcio urinario)", "Caffè in dosi elevate (> 3 tazzine al giorno)", "Bevande a base di cola industriali (ricche di acido fosforico sequestrante il calcio)", "Superalcolici e alcolici", "Diete iperproteiche sbilanciate", "Eccesso di fitati crudi non cotti che chelano il calcio intestinale"], 
        promote: ["Acque minerali calciche ad alto tenore di calcio (> 250-300 mg/L)", "Latticini magri (Yogurt greco, ricotta fresca, kefir)", "Grana Padano o Parmigiano Reggiano (scaglie da 25-30g ricchissime di calcio assorbibile)", "Pesce azzurro consumato anche con le lische morbide (Sardine)", "Semi di sesamo e mandorle sgusciate", "Verdure a foglia verde scuro (Cicoria, rucola, agretti)"] 
    }
};
    

function updateAnalysis() {
    const pat = document.getElementById('patient-pathology').value;
    const panel = document.getElementById('medical-analysis');
    
    if (pat === 'altro') {
        const cName = document.getElementById('custom-pat-name').value || "Patologia Personalizzata";
        const cAvoid = document.getElementById('custom-pat-avoid').value;
        const cPromote = document.getElementById('custom-pat-promote').value;
        
        let avoidHtml = cAvoid ? cAvoid.split(',').map(i => `<li>❌ ${i.trim()}</li>`).join('') : "<li>❌ (Nessun dato inserito)</li>";
        let promoteHtml = cPromote ? cPromote.split(',').map(i => `<li>✅ ${i.trim()}</li>`).join('') : "<li>✅ (Nessun dato inserito)</li>";
        
        panel.innerHTML = `
            <div style="background:#ffffff; border-radius:14px; padding:16px; border:1px solid #cbd5e1; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <p style="margin:0; font-weight:800; color:#0f172a; font-size:1.05rem;">🩺 ${cName} (Personalizzata dal Medico)</p>
                    <button type="button" class="btn-primary" onclick="applicaLineeGuidaSuNote()" style="padding:6px 12px; font-size:12px; background:#0284c7; border:none; border-radius:8px; color:#fff; cursor:pointer; font-weight:700;">✍️ Applica a Cartella & Note</button>
                </div>
                <div class="rule-item danger" style="margin-bottom:10px; background:#fef2f2; border-left:4px solid #ef4444; padding:10px; border-radius:8px;">
                    <strong style="color:#b91c1c;">Da Evitare Tassativamente:</strong>
                    <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.88rem; color:#7f1d1d;">${avoidHtml}</ul>
                </div>
                <div class="rule-item success" style="background:#f0fdf4; border-left:4px solid #22c55e; padding:10px; border-radius:8px;">
                    <strong style="color:#15803d;">Da Promuovere Fortemente:</strong>
                    <ul style="list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.88rem; color:#14532d;">${promoteHtml}</ul>
                </div>
            </div>
        `;
        return;
    }
    
    const mainPat = pathologyDB[pat] || pathologyDB['nessuna'];
    
    // Raccogli comorbidità selezionate
    let selectedComorbidities = [];
    document.querySelectorAll('.com-checkbox input:checked').forEach(cb => {
        if(pathologyDB[cb.value]) selectedComorbidities.push(pathologyDB[cb.value]);
    });

    // Unisci divieti e promozioni
    let mergedAvoid = new Set(mainPat.avoid);
    let mergedPromote = new Set(mainPat.promote);
    let mergedGoldenRules = [];
    if(mainPat.goldenRule) mergedGoldenRules.push(`<strong>⭐ ${mainPat.name}:</strong> ${mainPat.goldenRule}`);
    
    let titleNames = [mainPat.name];
    let lifestyleList = [mainPat.lifestyle || 'Attività fisica moderata costante'];
    let drugAlerts = [mainPat.drugInteractions || 'Nessuna specifica interazione registrata'];
    let labChecks = [mainPat.labMonitoring || 'Check-up generale'];
    let guidelinesRefs = [mainPat.guidelineRef || 'Standard Clinico Internazionale'];

    selectedComorbidities.forEach(p => {
        titleNames.push(p.name);
        p.avoid.forEach(item => mergedAvoid.add(item));
        p.promote.forEach(item => mergedPromote.add(item));
        if (p.goldenRule) {
            mergedGoldenRules.push(`<strong>⭐ ${p.name}:</strong> ${p.goldenRule}`);
        }
        if (p.lifestyle) lifestyleList.push(`• <b>${p.name}</b>: ${p.lifestyle}`);
        if (p.drugInteractions) drugAlerts.push(`• <b>${p.name}</b>: ${p.drugInteractions}`);
        if (p.labMonitoring) labChecks.push(`• <b>${p.name}</b>: ${p.labMonitoring}`);
        if (p.guidelineRef) guidelinesRefs.push(`• ${p.guidelineRef}`);
    });

    let avoidHtml = Array.from(mergedAvoid).map(i => `<li>❌ ${i}</li>`).join('');
    let promoteHtml = Array.from(mergedPromote).map(i => `<li>✅ ${i}</li>`).join('');
    let rulesHtml = mergedGoldenRules.map(r => `<div style="margin-bottom:6px; line-height:1.45;">${r}</div>`).join('');

    let combinedTitle = titleNames.length > 1 
        ? `Protocollo Integrato Multipatologia: ${titleNames.join(' + ')}` 
        : mainPat.desc;

    panel.innerHTML = `
        <div style="background:#ffffff; border-radius:14px; padding:18px 20px; border:1.5px solid #cbd5e1; box-shadow:0 6px 18px rgba(0,0,0,0.04);">
            
            <!-- HEADER GUIDELINES -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:12px; flex-wrap:wrap; gap:8px;">
                <div>
                    <span style="font-size:11px; font-weight:800; background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:0.5px;">Supporto Decisionale Clinico</span>
                    <h4 style="margin:4px 0 2px 0; font-size:1.15rem; color:#0f172a; font-weight:800;">${mainPat.name}</h4>
                    <p style="margin:0; font-size:0.83rem; color:#64748b; font-style:italic;">${combinedTitle}</p>
                    <p style="margin:3px 0 0 0; font-size:0.75rem; color:#0284c7; font-weight:600;">📚 Fonte: ${guidelinesRefs.join(' | ')}</p>
                </div>
                <button type="button" onclick="applicaLineeGuidaSuNote()" style="background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; border:none; padding:8px 14px; border-radius:10px; font-weight:700; font-size:12.5px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(2,132,199,0.3); transition:all 0.15s;" title="Inserisce queste direttive nelle Note Cliniche del referto per la tua firma">
                    <span>✍️</span> Inserisci in Diagnosi & Note
                </button>
            </div>

            <!-- REGOLA D'ORO CLINICA -->
            ${mergedGoldenRules.length > 0 ? `
            <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:10px 14px; border-radius:8px; margin-bottom:14px; color:#92400e; font-size:0.88rem;">
                ${rulesHtml}
            </div>` : ''}

            <!-- SEZIONE INTERAZIONI FARMACO-CIBO (ALERT) -->
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px 14px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:6px; color:#b91c1c; font-weight:800; font-size:0.85rem; margin-bottom:4px;">
                    <span>⚠️</span> ALERT CLINICO INTERAZIONI FARMACO-CIBO & PRECAUZIONI:
                </div>
                <div style="font-size:0.83rem; color:#991b1b; line-height:1.45;">
                    ${drugAlerts.join('<br>')}
                </div>
            </div>

            <!-- SEZIONE STILE DI VITA & ATTIVITÀ MOTORIA -->
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:6px; color:#15803d; font-weight:800; font-size:0.85rem; margin-bottom:4px;">
                    <span>🏃</span> PRESCRIZIONE ATTIVITÀ FISICA & STILE DI VITA:
                </div>
                <div style="font-size:0.83rem; color:#166534; line-height:1.45;">
                    ${lifestyleList.join('<br>')}
                </div>
            </div>

            <!-- SEZIONE MONITORAGGIO BIOCHIMICO -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:6px; color:#475569; font-weight:800; font-size:0.82rem; margin-bottom:4px;">
                    <span>🧪</span> MONITORAGGIO DI LABORATORIO SUGGERITO:
                </div>
                <div style="font-size:0.8rem; color:#334155; line-height:1.4;">
                    ${labChecks.join('<br>')}
                </div>
            </div>

            <!-- DUE COLONNE: EVITARE / PROMUOVERE -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="rule-item danger" style="background:#fff1f2; border:1px solid #fecdd3; border-radius:10px; padding:12px;">
                    <strong style="color:#be123c; font-size:0.86rem; display:block; margin-bottom:6px;">🚫 Da Evitare Tassativamente:</strong>
                    <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:4px; font-size:0.82rem; color:#9f1239;">${avoidHtml}</ul>
                </div>
                <div class="rule-item success" style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px;">
                    <strong style="color:#15803d; font-size:0.86rem; display:block; margin-bottom:6px;">✅ Da Promuovere Fortemente:</strong>
                    <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:4px; font-size:0.82rem; color:#14532d;">${promoteHtml}</ul>
                </div>
            </div>
        </div>
    `;
}

// Funzione che copia la prescrizione e le linee guida direttamente nel campo note del medico
function applicaLineeGuidaSuNote() {
    const pat = document.getElementById('patient-pathology').value;
    const notesEl = document.getElementById('patient-notes');
    if (!notesEl) return;

    let prescrizione = "";
    if (pat === 'altro') {
        const cName = document.getElementById('custom-pat-name').value || "Patologia Personalizzata";
        prescrizione = `\n\n📌 LINEE GUIDA CLINICHE APPLICATE (${cName}):\n• Cibi da promuovere: ${document.getElementById('custom-pat-promote').value || 'n.d.'}\n• Cibi da limitare/evitare: ${document.getElementById('custom-pat-avoid').value || 'n.d.'}`;
    } else {
        const p = pathologyDB[pat] || pathologyDB['nessuna'];
        prescrizione = `\n\n📌 LINEE GUIDA & INDICAZIONI NUTRIZIONALI SPECIALISTICHE (${p.name}):\n` +
                       `• Fonte Clinica: ${p.guidelineRef || 'Standard Internazionale'}\n` +
                       `• Regola d'Oro: ${p.goldenRule || ''}\n` +
                       `• Prescrizione Attività Motoria: ${p.lifestyle || ''}\n` +
                       `• Alert Interazioni Farmacologiche: ${p.drugInteractions || 'Nessuna specifica'}\n` +
                       `• Controlli di Laboratorio: ${p.labMonitoring || 'Check-up di routine'}\n` +
                       `• Valutazione Medico Curante: Quadri clinico-nutrizionale compatibile con il piano assegnato. Si raccomanda aderenza terapeutica.`;
    }

    if (!notesEl.value.includes("LINEE GUIDA")) {
        notesEl.value = (notesEl.value ? notesEl.value.trim() : '') + prescrizione;
    } else {
        notesEl.value = notesEl.value.replace(/\n\n📌 LINEE GUIDA[\s\S]*$/, prescrizione);
    }

    notesEl.scrollTop = notesEl.scrollHeight;
    try { notesEl.dispatchEvent(new Event('input')); } catch(e){}
    if (typeof showToast !== 'undefined') {
        showToast("Linee guida applicate alle note della cartella clinica!", "success");
    } else {
        alert("Linee guida cliniche inserite nelle Note del Medico!");
    }
}

function generateDiet() {
    const pat = document.getElementById('patient-pathology').value;
    const name = document.getElementById('patient-name').value || 'il Paziente';
    
    if (pat === 'altro') {
        if(typeof showToast !== 'undefined') showToast("Hai selezionato 'Altra Patologia'. Inserisci i pasti manualmente.", "warning");
        return;
    }

    const tbody = document.getElementById('diet-body');
    const rows = tbody.querySelectorAll('tr');
    
    // Variazioni Pasti per Patologia (7 varianti per ogni pasto)
    const menus = {
        'diabete': {
            colazione: [
                "Yogurt greco, 30g avena, mirtilli", 
                "Latte di soia, 3 fette Wasa, mandorle", 
                "Kefir, semi di lino, mezza mela verde",
                "Yogurt magro, 1 kiwi, noci",
                "Tè verde, 4 biscotti integrali per diabetici",
                "Latte scremato, 30g crusca, fragole",
                "Yogurt greco, noci pecan, cannella"
            ],
            pranzo: [
                "70g farro, 150g tacchino, insalata, olio EVO", 
                "70g quinoa, 150g pollo, zucchine grigliate", 
                "80g orzo, 100g ricotta, spinaci baby",
                "150g lenticchie, verdure miste, 1 cucchiaio olio",
                "70g riso integrale, 150g petto di pollo, melanzane",
                "70g pasta integrale, 100g tonno naturale, pomodorini",
                "Zuppa di ceci (150g), verdure a foglia, crostini integrali"
            ],
            spuntino: [
                "1 mela verde", "15 mandorle", "Yogurt magro bianco", "1 finocchio", "10 noci", "Mezza pera", "Kefir"
            ],
            cena: [
                "200g merluzzo, broccoli, 50g pane segale", 
                "2 uova sode, asparagi, 50g pane integrale", 
                "150g salmone, fagiolini, 50g pane segale",
                "200g platessa al vapore, cavolfiore, 50g pane segale",
                "150g fesa di tacchino, insalata mista, 50g pane integrale",
                "100g formaggio magro, verdure grigliate, 50g pane",
                "200g spigola al forno, zucchine, 50g pane segale"
            ]
        },
        'steatosi': {
            colazione: ["Porridge avena", "Yogurt bianco magro", "Tè verde, fette integrali", "Kefir e mirtilli", "Latte di mandorla, noci", "Yogurt greco magro", "Tè deteinato, fette Wasa"],
            pranzo: ["70g riso integrale, 150g salmone, carciofi", "70g farro, 150g tacchino, insalata", "Zuppa lenticchie, carote", "70g orzo, verdure grigliate", "70g pasta integrale, 150g pollo, zucchine", "70g quinoa, pomodorini e rucola", "Riso venere 70g, 150g pesce magro, broccoli"],
            spuntino: ["150g kefir", "1 mela", "10 noci", "1 finocchio", "Yogurt magro", "15 mandorle", "Spremuta d'arancia"],
            cena: ["Minestrone verdure, pollo", "200g branzino, spinaci", "100g bresaola, rucola", "150g vitello magro, cavolfiore", "2 uova, asparagi", "200g merluzzo, fagiolini", "Insalatona mista, 100g ricotta"]
        },
        'ipertensione': {
            colazione: ["Latte scremato, banana", "Yogurt magro, mirtilli", "Tè, pane sciapo e ricotta", "Spremuta, fette senza sale", "Porridge con mela", "Latte e fiocchi d'avena", "Yogurt e noci"],
            pranzo: ["80g pasta (zero sale), zucchine", "70g riso, pollo limone", "Minestrone fresco, pane sciapo", "70g farro, pomodori freschi", "150g ceci, verdure", "70g pasta, sugo fresco basilico", "Zuppa orzo e legumi"],
            spuntino: ["1 banana", "Yogurt", "1 arancia", "Mandorle non salate", "1 kiwi", "Mezza mela", "Kefir"],
            cena: ["150g pollo, spinaci (zero sale)", "200g pesce azzurro, pomodori", "2 uova, melanzane", "200g merluzzo, fagiolini", "150g tacchino, carote", "Formaggio magro dolce, insalata", "150g vitello, asparagi"]
        },
        'ipercolesterolemia': {
            colazione: ["Porridge avena (beta-glucani)", "Yogurt soia, frutti rossi", "Latte scremato, fette", "Tè verde, biscotti avena", "Kefir, semi di chia", "Spremuta, mandorle", "Yogurt magro, mela"],
            pranzo: ["70g orzo, 150g salmone", "70g pasta int, legumi", "70g quinoa, tacchino", "150g fagioli, verdure", "70g riso int, pollo", "70g farro, zucchine", "Zuppa ceci e cavolo nero"],
            spuntino: ["1 mela", "15 mandorle", "Yogurt magro", "1 finocchio", "10 noci", "1 pera", "Kefir"],
            cena: ["200g merluzzo, broccoli", "150g pollo, insalata", "Minestrone, pane int", "200g sgombro, fagiolini", "2 uova, spinaci", "150g tacchino, carote", "100g ricotta, verdure grigliate"]
        },
        'reflusso': {
            colazione: ["Latte parz. scremato, fette", "Yogurt magro, mela cotta", "Tè leggero, biscotti", "Latte mandorla, fette", "Yogurt bianco, pera cotta", "Latte, fiocchi riso", "Tè, fette e marmellata"],
            pranzo: ["70g riso, pollo bollito", "70g pasta, ricotta, zucchine", "70g farro, platessa, patate", "70g pasta, carote lesse", "70g riso, tacchino", "70g orzo, verdure lesse", "Vellutata zucca, crostini"],
            spuntino: ["1 banana matura", "Mela cotta", "Yogurt", "Pera cotta", "Fette biscottate", "Latte scremato", "Banana"],
            cena: ["200g pesce magro, patate", "150g tacchino, carote", "2 uova coque, vellutata", "200g merluzzo, zucchine", "150g pollo, fagiolini", "Formaggio magro, patate", "Pesce al vapore, finocchi lessi"]
        },
        'colon': {
            colazione: ["Latte s/lattosio, avena", "Yogurt delatt, banana", "Tè verde, gallette riso", "Kefir, noci", "Latte s/lattosio, fette", "Tè, biscotti s/lattosio", "Yogurt soia"],
            pranzo: ["70g riso, carne magra, carote", "70g quinoa, pollo, zucchine", "70g pasta GF, pesce, spinaci", "70g riso, tacchino", "70g miglio, verdure", "70g riso, tonno", "Pasta GF, zucchine"],
            spuntino: ["1 kiwi", "Mezza banana", "10 arachidi", "Yogurt s/latt", "Mandarino", "Gallette di riso", "Mandorle"],
            cena: ["200g orata, patate forno", "150g tacchino, carote", "2 uova, insalata", "200g spigola, spinaci", "150g pollo, fagiolini", "Formaggio s/latt, patate", "Pesce, zucchine"]
        },
        'celiachia': {
            colazione: ["Yogurt, quinoa soffiata", "Latte, gallette mais", "Kefir, grano saraceno", "Tè, fette GF", "Latte, biscotti GF", "Yogurt, frutta fresca", "Tè, gallette riso"],
            pranzo: ["70g pasta GF, pollo", "70g riso, tonno", "70g grano saraceno, tacchino", "70g mais, pesce", "70g quinoa, verdure", "70g riso, carne", "Pasta GF, zucchine"],
            spuntino: ["Frutta fresca", "Yogurt", "Mandorle", "Gallette riso", "1 mela", "Noci", "Kefir"],
            cena: ["200g pesce, patate", "150g carne, fagiolini", "Frittata, insalata", "200g spigola, carote", "150g pollo, spinaci", "Formaggio, verdure", "Pesce, patate"]
        }
    };

    // Fallback menu for pathologies not explicitly defined in variants yet
    const fallback = {
        colazione: ["Yogurt magro, 30g avena, 1 frutto", "Latte parz. scremato, 3 fette integrali", "Tè, 4 biscotti secchi, 1 frutto"],
        pranzo: ["70g pasta integrale, 150g pollo, insalata", "70g riso, 150g pesce, verdure di stagione", "70g farro, 100g formaggio magro, verdure"],
        spuntino: ["1 frutto di stagione", "Yogurt magro", "15 mandorle"],
        cena: ["200g pesce bianco, verdure, pane", "150g tacchino, insalata, pane", "Minestrone di verdure, 2 uova"]
    };

    const selMenu = menus[pat] || fallback;

    // Mescola (Shuffle) casualmente le opzioni così ogni 'Generazione' crea una dieta diversa
    function shuffle(array) {
        let arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    const shColazione = shuffle(selMenu.colazione);
    const shPranzo = shuffle(selMenu.pranzo);
    const shSpuntino = shuffle(selMenu.spuntino);
    const shCena = shuffle(selMenu.cena);

    const goal = (document.getElementById('patient-goal') || {}).value || 'normo';
    applyGoalChange();

    // Ciascun giorno ha il suo pasto unico e randomizzato!
    rows.forEach((r, index) => {
        let tds = r.querySelectorAll('td');
        
        let cIdx = index % shColazione.length;
        let pIdx = index % shPranzo.length;
        let sIdx = index % shSpuntino.length;
        let ceIdx = index % shCena.length;
        
        tds[1].innerText = adjustPortionText(shColazione[cIdx], goal);
        tds[2].innerText = adjustPortionText(shPranzo[pIdx], goal);
        tds[3].innerText = adjustPortionText(shSpuntino[sIdx], goal);
        tds[4].innerText = adjustPortionText(shCena[ceIdx], goal);
        
        for (let i = 1; i <= 4; i++) {
            tds[i].setAttribute('contenteditable', 'true');
            tds[i].setAttribute('title', 'Clicca per modificare il piatto a mano');
        }
    });

    let goalLabel = goal === 'ipo' ? ' (Ipocalorica)' : (goal === 'iper' ? ' (Iperproteica)' : '');
    showToast(`Terapia generata per ${name}: ${pat !== 'nessuna' ? pathologyDB[pat].name : 'Mantenimento Base'}${goalLabel}.`, "success");
}

function adjustPortionText(dish, goal) {
    if (!dish || goal === 'normo') return dish;
    // Ricalcola quantitativi in grammi es. 70g -> 55g (ipo) o 85g (iper)
    return dish.replace(/(\d+)\s*g\b/gi, (match, p1) => {
        let val = parseInt(p1, 10);
        if (isNaN(val)) return match;
        let factor = (goal === 'ipo') ? 0.8 : 1.2;
        let adjusted = Math.round((val * factor) / 5) * 5;
        if (adjusted < 15) adjusted = 15;
        return adjusted + 'g';
    });
}

function applyGoalChange() {
    const goalEl = document.getElementById('patient-goal');
    if (!goalEl) return;
    const goal = goalEl.value;
    const dietBadge = document.getElementById('diet-goal-badge');
    const goalBadge = document.getElementById('goal-badge');
    
    let text = '⚖️ Normocalorica';
    let color = '#0369a1';
    let bg = '#e0f2fe';
    if (goal === 'ipo') {
        text = '🔻 Ipocalorica (-20% carbo/porzioni)';
        color = '#b45309';
        bg = '#fef3c7';
    } else if (goal === 'iper') {
        text = '🔺 Iperproteica / Sport (+20% porzioni)';
        color = '#15803d';
        bg = '#dcfce7';
    }
    
    if (dietBadge) {
        dietBadge.innerText = text;
        dietBadge.style.color = color;
        dietBadge.style.background = bg;
    }
    if (goalBadge) {
        goalBadge.innerText = goal === 'normo' ? '' : (goal === 'ipo' ? '(-20%)' : '(+20%)');
        goalBadge.style.color = color;
    }
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
            calculateBMI();
}
        document.getElementById('calculated-age').innerText = '(' + age + ' anni)';
    } else {
        document.getElementById('calculated-age').innerText = '';
    }
}


const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
function initTable() {
    const tbody = document.getElementById('diet-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    daysOfWeek.forEach(day => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${day}</strong></td>
            <td contenteditable="true" title="Clicca per modificare il piatto a mano">-</td>
            <td contenteditable="true" title="Clicca per modificare il piatto a mano">-</td>
            <td contenteditable="true" title="Clicca per modificare il piatto a mano">-</td>
            <td contenteditable="true" title="Clicca per modificare il piatto a mano">-</td>
        `;
        tbody.appendChild(tr);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // Se non ci sono pazienti in archivio o il profilo manca, ripristina automaticamente dal backup predefinito
    try {
        const seedData = {
            "mednutri_doc_profile": JSON.stringify({"avatar":"👨‍⚕️","name":"Dott. Ciro Milella","spec":"Medico Chirurgo Nutrizionista","clinic":"Ambulatorio Medico"}),
            "mednutri_security_pin": "f53a8cc51204bdb35e8fd0ba841c1b8c2f238bd6f069410b0a44b97a3354dbf3",
            "mednutri_pat_ciro milella": JSON.stringify({"name":"Ciro Milella","gender":"M","dob":"1967-12-16","height":"160","weight":"79.3","wrist":"25","lifestyle":"1.375","start":"2026-10-06","end":"2026-11-05","mainPathology":"steatosi","comorbidities":[],"lastSaved":"06/10/2026"}),
            "mednutri_custom_pathologies": JSON.stringify({"items":{},"deleted":[]}),
            "mednutri_last_cloud_sync": "12/10/2026 alle 20:30",
            "mednutri_cloud_config": JSON.stringify({"studioId":"STUDIO-AA-890","autoSyncEnabled":true,"endpoint":"https://api.jsonbin.io/v3/b"})
        };

        if (!localStorage.getItem('mednutri_pat_ciro milella') || !localStorage.getItem('mednutri_doc_profile')) {
            for (let k in seedData) {
                if (!localStorage.getItem(k)) {
                    localStorage.setItem(k, seedData[k]);
                }
            }
            checkDoctorProfile();
            if (typeof loadPatient === 'function') loadPatient('Ciro Milella');
        }
    } catch(e) {
        console.warn('MedNutri seed error:', e);
    }

    initDates();
    initComorbidities();
    checkDoctorProfile();
    initTable();
    applyGoalChange();

    // Auto-carica l'ultimo paziente se il campo nome è vuoto
    setTimeout(() => {
        let nameEl = document.getElementById('patient-name');
        if (nameEl && !nameEl.value.trim()) {
            if (localStorage.getItem('mednutri_pat_ciro milella') && typeof loadPatient === 'function') {
                loadPatient('Ciro Milella');
            } else {
                for (let i = 0; i < localStorage.length; i++) {
                    let k = localStorage.key(i);
                    if (k && k.startsWith('mednutri_pat_')) {
                        try {
                            let p = JSON.parse(localStorage.getItem(k));
                            if (p && p.name && typeof loadPatient === 'function') {
                                loadPatient(p.name);
                                break;
                            }
                        } catch(e) {}
                    }
                }
            }
        }
    }, 150);
});


function prepareAndPrint() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    let docName = "Medico non specificato";
    if (saved) {
        let doc = JSON.parse(saved);
        docName = doc.name;
    }
    
    let patName = document.getElementById('patient-name').value || "Non specificato";
    let dateStart = document.getElementById('period-start').value || "...";
    let dateEnd = document.getElementById('period-end').value || "...";
    
    // Formatta le date se presenti
    if(dateStart !== "...") { let d = new Date(dateStart); dateStart = d.toLocaleDateString('it-IT'); }
    if(dateEnd !== "...") { let d = new Date(dateEnd); dateEnd = d.toLocaleDateString('it-IT'); }
    
    let patDob = document.getElementById('patient-dob').value;
    if(patDob) { let d = new Date(patDob); patDob = d.toLocaleDateString('it-IT'); } else { patDob = "N/D"; }
    
    let gender = document.getElementById('patient-gender').value === 'M' ? 'Uomo' : 'Donna';
    if(patDob !== "N/D") patDob += " (" + gender + ")";
    
    let pHeight = document.getElementById('patient-height').value || '-';
    let pWeight = document.getElementById('patient-weight').value || '-';
    
    document.getElementById('print-doc-info').innerText = docName;
    document.getElementById('print-pat-info').innerText = patName;
    document.getElementById('print-pat-dob').innerText = patDob;
    document.getElementById('print-pat-hw').innerText = `${pWeight} Kg / ${pHeight} cm`;
    document.getElementById('print-period-info').innerText = "dal " + dateStart + " al " + dateEnd;
    
    // Dati Clinici Stampati
    let goalEl = document.getElementById('patient-goal');
    let goalText = goalEl ? goalEl.options[goalEl.selectedIndex].text : "Standard";
    let patVal = (document.getElementById('patient-pathology') || {}).value || 'nessuna';
    let mainPatName = (pathologyDB[patVal] || {}).name || "Prevenzione Base";
    
    let coms = [];
    document.querySelectorAll('#comorbidities-container input:checked').forEach(cb => {
        if (pathologyDB[cb.value]) coms.push(pathologyDB[cb.value].name);
    });
    
    let notesText = (document.getElementById('patient-notes') || {}).value || '';

    let prDiag = document.getElementById('print-diagnosis-info');
    let prGoal = document.getElementById('print-goal-info');
    let prComRow = document.getElementById('print-comorbidities-row');
    let prComInfo = document.getElementById('print-comorbidities-info');
    let prNotes = document.getElementById('print-notes-text');
    let prDate = document.getElementById('print-date-today');

    if (prDiag) prDiag.innerText = mainPatName;
    if (prGoal) prGoal.innerText = goalText;
    if (prComRow && prComInfo) {
        if (coms.length > 0) {
            prComRow.style.display = 'block';
            prComInfo.innerText = coms.join(', ');
        } else {
            prComRow.style.display = 'none';
        }
    }
    if (prNotes) {
        prNotes.innerText = notesText.trim() ? notesText.trim() : "Seguire il piano alimentare rispettando le combinazioni prescritte. Idratazione raccomandata: almeno 1.5 - 2 litri d'acqua al giorno.";
    }
    if (prDate) prDate.innerText = new Date().toLocaleDateString('it-IT');

    window.print();
}



function initComorbidities() {
    const container = document.getElementById('comorbidities-container');
    container.innerHTML = '';
    
    const excludedKeys = ['nessuna', 'altro'];
    
    let sortedKeys = Object.keys(pathologyDB).filter(k => !excludedKeys.includes(k));
    sortedKeys.sort((a, b) => pathologyDB[a].name.localeCompare(pathologyDB[b].name));
    
    sortedKeys.forEach(key => {
        let label = document.createElement('label');
        label.className = 'com-checkbox';
        label.innerHTML = `<input type="checkbox" value="${key}" onchange="updateAnalysis()"> ${pathologyDB[key].name}`;
        container.appendChild(label);
    });
}

function initDates() {
    const today = new Date();
    document.getElementById('period-start').valueAsDate = today;
    
    // Default validità 30 giorni
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    document.getElementById('period-end').valueAsDate = nextMonth;
}


function calculateBMI() {
    let hRaw = document.getElementById('patient-height').value;
    let wRaw = document.getElementById('patient-weight').value;
    let wristRaw = document.getElementById('patient-wrist').value;
    
    let h = parseFloat(hRaw.replace(',', '.'));
    let w = parseFloat(wRaw.replace(',', '.'));
    let wrist = parseFloat(wristRaw.replace(',', '.'));
    let gender = document.getElementById('patient-gender').value;
    let lifestyle = document.getElementById('patient-lifestyle').value;
    
    let ageText = document.getElementById('calculated-age').innerText;
    let age = parseInt(ageText.replace(/\D/g, '')) || 0;
    
    let badge = document.getElementById('bmi-badge');
    let frameBadge = document.getElementById('frame-badge');
    let tdeeBadge = document.getElementById('tdee-badge');
    
    // Auto-correzione se il medico inserisce l'altezza in metri (es. 1.60) invece di cm (es. 160)
    if (h > 0 && h < 3) {
        h = h * 100;
    }
    
    // Calcolo Costituzione (Morfologia)
    if (h > 0 && wrist > 0) {
        let r = h / wrist;
        let frame = '';
        let fColor = '';
        if (gender === 'M') {
            if (r > 10.4) { frame = 'Longilinea (Ossa fini)'; fColor = '#8b5cf6'; }
            else if (r >= 9.6 && r <= 10.4) { frame = 'Normolinea'; fColor = '#10b981'; }
            else { frame = 'Brevilinea (Ossa grosse)'; fColor = '#f59e0b'; }
        } else {
            if (r > 10.9) { frame = 'Longilinea (Ossa fini)'; fColor = '#8b5cf6'; }
            else if (r >= 9.9 && r <= 10.9) { frame = 'Normolinea'; fColor = '#10b981'; }
            else { frame = 'Brevilinea (Ossa grosse)'; fColor = '#f59e0b'; }
        }
        
        if (wrist < 5 || wrist > 35) {
            frame = 'Valore errato'; fColor = '#ef4444';
        }
        
        frameBadge.innerHTML = `<span style="color: ${fColor}; background: ${fColor}20; padding: 2px 6px; border-radius: 4px;">${frame}</span>`;
    } else {
        frameBadge.innerHTML = '';
    }

    // Calcolo BMI & TDEE
    if (h > 0 && w > 0) {
        let heightM = h / 100;
        let bmi = (w / (heightM * heightM)).toFixed(1);
        
        let status = '';
        let color = '';
        
        if (bmi < 18.5) { status = 'Sottopeso'; color = '#3b82f6'; }
        else if (bmi >= 18.5 && bmi < 25) { status = 'Normopeso'; color = '#22c55e'; }
        else if (bmi >= 25 && bmi < 30) { status = 'Sovrappeso'; color = '#eab308'; }
        else if (bmi >= 30 && bmi < 35) { status = 'Obesità 1'; color = '#f97316'; }
        else if (bmi >= 35 && bmi < 40) { status = 'Obesità 2'; color = '#ef4444'; }
        else { status = 'Obesità 3'; color = '#991b1b'; }
        
        badge.innerHTML = `<span style="color: ${color}; background: ${color}20; padding: 2px 6px; border-radius: 4px;">BMI ${bmi} (${status})</span>`;
        
        // Calcolo BMR (Mifflin-St Jeor) e TDEE
        if (age > 0) {
            let bmr = 0;
            if (gender === 'M') {
                bmr = (10 * w) + (6.25 * h) - (5 * age) + 5;
            } else {
                bmr = (10 * w) + (6.25 * h) - (5 * age) - 161;
            }
            let tdee = Math.round(bmr * parseFloat(lifestyle));
            tdeeBadge.innerHTML = `<span style="color: #0284c7; background: #0284c720; padding: 2px 6px; border-radius: 4px;">${tdee} Kcal/die</span>`;
        }
    } else {
        badge.innerHTML = '';
        tdeeBadge.innerHTML = '';
    }
}


function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    if(type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}


function savePatient() {
    let fields = [
        { id: 'patient-name', val: document.getElementById('patient-name').value.trim() },
        { id: 'patient-dob', val: document.getElementById('patient-dob').value },
        { id: 'patient-height', val: document.getElementById('patient-height').value },
        { id: 'patient-weight', val: document.getElementById('patient-weight').value },
        { id: 'patient-wrist', val: document.getElementById('patient-wrist').value }
    ];
    
    // Reset errors and re-add normal listeners
    fields.forEach(f => {
        let el = document.getElementById(f.id);
        el.classList.remove('input-error');
        // Rimuove l'errore non appena l'utente inizia a scrivere
        el.addEventListener('input', function() { this.classList.remove('input-error'); });
    });
    
    let missing = fields.filter(f => !f.val);
    
    if (missing.length > 0) {
        // Applica classe errore a tutti i campi vuoti
        missing.forEach(f => document.getElementById(f.id).classList.add('input-error'));
        
        // Sposta il focus sul primo campo vuoto
        document.getElementById(missing[0].id).focus();
        
        showToast("Compila i campi evidenziati in rosso prima di salvare.", "error");
        return;
    }
    
    let name = fields[0].val;
    
    // Raccogli patologie
    let pathologies = [];
    document.querySelectorAll('#comorbidities-container input:checked').forEach(cb => pathologies.push(cb.value));

    // Raccogli la tabella settimanale con eventuali piatti modificati manualmente
    let dietGrid = [];
    document.querySelectorAll('#diet-body tr').forEach(tr => {
        let cells = tr.querySelectorAll('td');
        if (cells.length >= 5) {
            dietGrid.push([cells[1].innerText, cells[2].innerText, cells[3].innerText, cells[4].innerText]);
        }
    });

    let patientData = {
        name: name,
        gender: document.getElementById('patient-gender').value,
        dob: document.getElementById('patient-dob').value,
        height: document.getElementById('patient-height').value,
        weight: document.getElementById('patient-weight').value,
        wrist: document.getElementById('patient-wrist').value,
        lifestyle: document.getElementById('patient-lifestyle').value,
        goal: (document.getElementById('patient-goal') || {}).value || 'normo',
        notes: (document.getElementById('patient-notes') || {}).value || '',
        start: document.getElementById('period-start').value,
        end: document.getElementById('period-end').value,
        mainPathology: document.getElementById('patient-pathology').value,
        comorbidities: pathologies,
        dietGrid: dietGrid,
        lastSaved: new Date().toLocaleDateString()
    };
    
    localStorage.setItem('mednutri_pat_' + name.toLowerCase(), JSON.stringify(patientData));
    showToast(`Scheda di ${name} salvata in archivio (incluso piano pasti personalizzato)!`, "success");

    // TRASMISSIONE AUTOMATICA AL DATABASE UNIFICATO DELLA SUITE (CAREASSIST & SALUTE)
    try {
        fetch('/api/suite/pazienti', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 'paz_' + Date.now(),
                nome: name,
                dataNascita: document.getElementById('patient-dob').value,
                sesso: document.getElementById('patient-gender').value,
                altezza: document.getElementById('patient-height')?.value || '',
                peso: document.getElementById('patient-weight')?.value || '',
                polso: document.getElementById('patient-wrist')?.value || '',
                bmi: (typeof calculateBMI === 'function' ? (document.getElementById('calculated-bmi')?.textContent || '') : ''),
                noteCliniche: document.getElementById('patient-notes')?.value || '',
                patologie: pathologies,
                nutrizione: {
                    patologiaTarget: document.getElementById('patologia')?.value || '',
                    ultimoAggiornamento: new Date().toISOString()
                },
                origini: ['Ambulatorio Medico', 'CareAssist Pro', 'Progetto Salute']
            })
        }).then(r => r.json()).then(res => {
            console.log('Paziente sincronizzato su Suite centrale:', res);
        }).catch(err => console.warn('Errore sync suite da MedNutri:', err.message));
    } catch(eSync) {}

    // Sincronizzazione automatica su Cloud in background
    if (typeof triggerAutoCloudSync === 'function') {
        triggerAutoCloudSync(false);
    }
}

function openArchive() {
    let list = document.getElementById('archive-list');
    list.innerHTML = '';
    
    let patients = [];
    for(let i=0; i<localStorage.length; i++) {
        let key = localStorage.key(i);
        if(key.startsWith('mednutri_pat_')) {
            patients.push(JSON.parse(localStorage.getItem(key)));
        }
    }
    
    if(patients.length === 0) {
        list.innerHTML = '<p style="color:#64748b; text-align:center;">Nessun paziente in archivio.</p>';
    } else {
        patients.forEach(p => {
            let div = document.createElement('div');
            div.style.cssText = 'padding:15px; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:background 0.2s;';
            div.onmouseover = () => div.style.background = '#f8fafc';
            div.onmouseout = () => div.style.background = 'white';
            div.onclick = () => loadPatient(p.name);
            
            div.innerHTML = `
                <div>
                    <div style="font-weight:600; color:#1e293b;">${p.name}</div>
                    <div style="font-size:0.85rem; color:#64748b;">Ultimo agg: ${p.lastSaved}</div>
                </div>
                <button style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;" onclick="event.stopPropagation(); deletePatient('${p.name}')">🗑️</button>
            `;
            list.appendChild(div);
        });
    }
    
    document.getElementById('archive-modal').style.display = 'flex';
}

function loadPatient(name) {
    let key = 'mednutri_pat_' + name.toLowerCase();
    let data = JSON.parse(localStorage.getItem(key));
    if(data) {
        document.getElementById('patient-name').value = data.name;
        document.getElementById('patient-gender').value = data.gender;
        document.getElementById('patient-dob').value = data.dob;
        document.getElementById('patient-height').value = data.height;
        document.getElementById('patient-weight').value = data.weight;
        document.getElementById('patient-wrist').value = data.wrist || '';
        document.getElementById('patient-lifestyle').value = data.lifestyle || '1.2';
        document.getElementById('period-start').value = data.start;
        document.getElementById('period-end').value = data.end;
        
        if (data.goal && document.getElementById('patient-goal')) {
            document.getElementById('patient-goal').value = data.goal;
            applyGoalChange();
        }
        if (data.notes && document.getElementById('patient-notes')) {
            document.getElementById('patient-notes').value = data.notes;
        }
        
        document.getElementById('patient-pathology').value = data.mainPathology;
        
        // Ricalcola tutto
        calculateAge();
        
        // Reset checkbox prima di ricaricare
        document.querySelectorAll('#comorbidities-container input').forEach(cb => cb.checked = false);
        
        if(data.comorbidities) {
            data.comorbidities.forEach(c => {
                let cb = document.querySelector(`#comorbidities-container input[value="${c}"]`);
                if(cb) cb.checked = true;
            });
        }
        
        // Se presente la griglia pasti salvata (con eventuali modifiche a mano), ripristinala!
        if (data.dietGrid && Array.isArray(data.dietGrid)) {
            let trs = document.querySelectorAll('#diet-body tr');
            data.dietGrid.forEach((rowMeals, rIdx) => {
                if (trs[rIdx]) {
                    let tds = trs[rIdx].querySelectorAll('td');
                    if (tds.length >= 5 && Array.isArray(rowMeals)) {
                        tds[1].innerText = rowMeals[0] || '-';
                        tds[2].innerText = rowMeals[1] || '-';
                        tds[3].innerText = rowMeals[2] || '-';
                        tds[4].innerText = rowMeals[3] || '-';
                        for (let i = 1; i <= 4; i++) {
                            tds[i].setAttribute('contenteditable', 'true');
                            tds[i].setAttribute('title', 'Clicca per modificare il piatto a mano');
                        }
                    }
                }
            });
        }

        updateAnalysis();
        document.getElementById('archive-modal').style.display = 'none';
        showToast(`Scheda di ${data.name} caricata con successo!`, "success");
    }
}

function deletePatient(name) {
    let modal = document.getElementById('custom-confirm');
    document.getElementById('custom-confirm-message').innerHTML = `Vuoi eliminare definitivamente <strong>${name}</strong> dall'archivio?<br><span style="font-size:0.8rem; color:#94a3b8; display:block; margin-top:5px;">Questa azione è irreversibile.</span>`;
    
    modal.style.display = 'flex';
    
    document.getElementById('custom-confirm-cancel').onclick = function() {
        modal.style.display = 'none';
    };
    
    document.getElementById('custom-confirm-ok').onclick = function() {
        localStorage.removeItem('mednutri_pat_' + name.toLowerCase());
        openArchive(); // Ricarica la lista
        showToast(`Paziente eliminato con successo.`, "success");
        modal.style.display = 'none';
    };
}


// FUNZIONI PROFILO MEDICO
function checkDoctorProfile() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    let setupModal = document.getElementById('doctor-setup-modal');
    let mainApp = document.getElementById('main-app');
    let cancelBtn = document.getElementById('setup-cancel-btn');
    
    if (saved) {
        let doc = {};
        try { doc = JSON.parse(saved); } catch(e) {}
        let avatarEl = document.querySelector('.doc-avatar');
        let nameEl = document.getElementById('ui-doc-name');
        let specEl = document.getElementById('ui-doc-spec');
        let clinicEl = document.getElementById('ui-doc-clinic');
        
        if(avatarEl) avatarEl.innerText = doc.avatar || '👨‍⚕️';
        if(nameEl) nameEl.innerText = doc.name || 'Dott. Ciro Milella';
        if(specEl) specEl.innerText = doc.spec || 'Medico Chirurgo Nutrizionista';
        if(clinicEl) clinicEl.innerText = doc.clinic || 'Ambulatorio Medico';
        
        if(cancelBtn) cancelBtn.style.display = 'block';
        
        // Se l'ambulatorio non è ancora stato sbloccato col PIN, mostra SEMPRE la schermata di blocco
        if (typeof isAppUnlocked !== 'undefined' && !isAppUnlocked) {
            if(setupModal) setupModal.style.display = 'none';
            if (typeof showLockscreen === 'function') {
                showLockscreen();
            } else {
                if(mainApp) mainApp.style.display = 'none';
            }
        } else {
            if(setupModal) setupModal.style.display = 'none';
            if(mainApp) mainApp.style.display = 'flex';
        }
    } else {
        // Se non esiste ancora il profilo e non è sbloccato, mostra la schermata PIN di default (1234)
        if (typeof isAppUnlocked !== 'undefined' && !isAppUnlocked) {
            if (typeof showLockscreen === 'function') showLockscreen();
        } else {
            if(setupModal) setupModal.style.display = 'flex';
            if(mainApp) mainApp.style.display = 'none';
            if(cancelBtn) cancelBtn.style.display = 'none';
        }
    }
}

function saveDoctorProfile() {
    let avatar = document.getElementById('setup-doc-avatar').value;
    let name = document.getElementById('setup-doc-name').value.trim();
    let spec = document.getElementById('setup-doc-spec').value.trim();
    let clinic = document.getElementById('setup-doc-clinic').value.trim();
    let studioNameInput = document.getElementById('setup-doc-studioname');
    let studioName = studioNameInput ? studioNameInput.value.trim() : '';
    let pinInput = document.getElementById('setup-doc-pin');
    let pin = pinInput ? pinInput.value.trim() : '';
    
    if(!name || !spec) {
        if (typeof showToast !== 'undefined') showToast('Inserisci almeno Titolo, Nome e Specializzazione.', 'error');
        else alert('Inserisci almeno Titolo, Nome e Specializzazione.');
        return;
    }
    
    let doc = { avatar, name, spec, clinic, studioName };
    localStorage.setItem('mednutri_doc_profile', JSON.stringify(doc));
    
    // Sincronizza profilo anche sul server per smartphone e tablet
    try {
        fetch('/api/mednutri/save-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mednutri_doc_profile: JSON.stringify(doc) })
        }).catch(() => {});
    } catch(e) {}
    
    // Aggiorna il Codice Studio Cloud se specificato
    if (studioName) {
        let cleanId = studioName.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-_]/g, '');
        if (!cleanId.startsWith('STUDIO-')) cleanId = 'STUDIO-' + cleanId;
        let conf = (typeof getCloudConfig === 'function') ? getCloudConfig() : { autoSyncEnabled: true };
        conf.studioId = cleanId;
        if (typeof saveCloudConfig === 'function') {
            saveCloudConfig(conf);
        } else {
            localStorage.setItem('mednutri_cloud_config', JSON.stringify(conf));
        }
    }
    
    // Se l'utente ha inserito un nuovo PIN (minimo 4 caratteri), lo salviamo
    if (pin && pin.length >= 4 && typeof setSecurityPin === 'function') {
        setSecurityPin(pin).then(() => {
            if (typeof showToast !== 'undefined') showToast('Profilo e nuovo PIN salvati con successo!', 'success');
            setTimeout(() => { window.location.reload(); }, 500);
        });
    } else {
        // Se non ha digitato un nuovo PIN ma non esisteva ancora un PIN, assicuriamo il default 1234
        if (typeof getStoredPinHash === 'function' && !getStoredPinHash() && typeof setSecurityPin === 'function') {
            setSecurityPin('1234');
        }
        let setupModal = document.getElementById('doctor-setup-modal');
        let mainApp = document.getElementById('main-app');
        if(setupModal) setupModal.style.display = 'none';
        if (typeof isAppUnlocked !== 'undefined' && isAppUnlocked) {
            if(mainApp) mainApp.style.display = 'flex';
        } else {
            if (typeof showLockscreen === 'function') showLockscreen();
        }
        checkDoctorProfile();
        if (typeof showToast !== 'undefined') showToast('Profilo salvato con successo! Ambulatorio protetto con PIN.', 'success');
    }
}

function resetDoctorProfile() {
    let saved = localStorage.getItem('mednutri_doc_profile');
    let conf = (typeof getCloudConfig === 'function') ? getCloudConfig() : {};
    if(saved) {
        let doc = JSON.parse(saved);
        document.getElementById('setup-doc-avatar').value = doc.avatar || '👩‍⚕️';
        document.getElementById('setup-doc-name').value = doc.name || '';
        document.getElementById('setup-doc-spec').value = doc.spec || '';
        document.getElementById('setup-doc-clinic').value = doc.clinic || '';
        let stEl = document.getElementById('setup-doc-studioname');
        if (stEl) stEl.value = doc.studioName || conf.studioId || '';
    } else {
        let stEl = document.getElementById('setup-doc-studioname');
        if (stEl) stEl.value = conf.studioId || '';
    }
    
    let cancelBtn = document.getElementById('setup-cancel-btn');
    if (cancelBtn) {
        cancelBtn.style.display = saved ? 'block' : 'none';
    }
    
    let setupModal = document.getElementById('doctor-setup-modal');
    if(setupModal) setupModal.style.display = 'flex';
}

function closeDoctorSetup() {
    let setupModal = document.getElementById('doctor-setup-modal');
    if(setupModal) setupModal.style.display = 'none';
    let mainApp = document.getElementById('main-app');
    if (typeof isAppUnlocked !== 'undefined' && isAppUnlocked) {
        if(mainApp) mainApp.style.display = 'flex';
    } else {
        if (typeof showLockscreen === 'function') showLockscreen();
    }
}


function showDatabase(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    try {
    let modal = document.getElementById('database-modal');
    let list = document.getElementById('database-list');
    if (!modal || !list) { alert('Errore: finestra Database non trovata nella pagina.'); return false; }
    // Sposta il modal direttamente nel body per evitare che contenitori nascosti lo blocchino
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    list.innerHTML = '';
    
    for (const key in pathologyDB) {
        if (key === 'altro') continue;
        const pat = pathologyDB[key];
        
        let avoidHtml = pat.avoid && pat.avoid.length ? pat.avoid.map(i => `<li>❌ ${i}`).join('</li>') + '</li>' : '';
        let promoteHtml = pat.promote && pat.promote.length ? pat.promote.map(i => `<li>✅ ${i}`).join('</li>') + '</li>' : '';
        
        let div = document.createElement('div');
        div.style.cssText = 'padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;';
        div.innerHTML = `
            <h3 style="color:#0f172a; font-size:1.1rem; margin-bottom:5px;">${pat.name || key}</h3>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:10px;">${pat.desc || ''}</p>
            ${pat.goldenRule ? `<p style="font-size:0.9rem; margin-bottom:10px; background:#e0f2fe; padding:8px; border-radius:6px; color:#0284c7;"><strong>⭐ Golden Rule:</strong> ${pat.goldenRule}</p>` : ''}
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <div>
                    <strong style="font-size:0.85rem; color:#ef4444;">Da Evitare:</strong>
                    <ul style="list-style:none; padding:0; margin-top:5px; font-size:0.8rem; display:flex; flex-direction:column; gap:3px;">${avoidHtml}</ul>
                </div>
                <div>
                    <strong style="font-size:0.85rem; color:#10b981;">Da Promuovere:</strong>
                    <ul style="list-style:none; padding:0; margin-top:5px; font-size:0.8rem; display:flex; flex-direction:column; gap:3px;">${promoteHtml}</ul>
                </div>
            </div>
        `;
        list.appendChild(div);
    }
    
    modal.style.zIndex = '100000';
    modal.style.display = 'flex';
    } catch (err) {
        console.error(err);
        alert('Errore apertura Database Patologie: ' + err.message);
    }
    return false;
}

// Chiudi il Database cliccando fuori dalla finestra o premendo ESC
document.addEventListener('click', (e) => {
    const m = document.getElementById('database-modal');
    if (m && e.target === m) m.style.display = 'none';
});
document.addEventListener('keydown', (e) => {
    const m = document.getElementById('database-modal');
    if (e.key === 'Escape' && m) m.style.display = 'none';
});
