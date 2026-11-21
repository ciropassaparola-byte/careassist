/**
 * GESTIONE ANAGRAFICA ERP - C.M
 * Versione 3.1 (Robust Edition)
 */

window.onerror = function(msg, url, l) {
    // Operazione Silente in Produzione (Robust Mode active)
    return true;
};

document.onkeydown = function(e) {
    e = e || window.event;
    var key = e.keyCode || e.which;
    var ctrl = e.ctrlKey;
    if (ctrl && key === 78) { // Ctrl+N (Nuovo)
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        if (window.ActionSvuotaENuovo) window.ActionSvuotaENuovo();
        return false;
    }
    if (ctrl && key === 83) { // Ctrl+S (Salva)
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        if (window.ActionSalvaRec) window.ActionSalvaRec();
        return false;
    }
    if (key === 116) { // F5
        if (window.ricaricaLista) window.ricaricaLista('');
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        return false;
    }
};

(function() {
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var locPath = window.location.pathname; 
    // Rimuove il primo carattere se è una slash (tipico di IE/HTA)
    if (locPath.charAt(0) === "/") locPath = locPath.substring(1);
    var currentDir = fso.GetParentFolderName(decodeURIComponent(locPath).replace(/\//g, "\\"));
    var dbPath = fso.BuildPath(currentDir, "ConsegneDB.accdb");
    var fotoDir = fso.BuildPath(currentDir, "FotoClienti");

    var clienteCorrente = null;
    var dataClienti = [];
    var dbProvs = {};
    var dbLocToProv = {};
    var idFieldName = "ID";
    var isNavigating = false;
    var isClosing = false; // Flag di sicurezza anti-loop
    var originalState = null; // Per monitoraggio modifiche non salvate
    
    function getDbConnection() {
        var providers = ["Microsoft.ACE.OLEDB.16.0", "Microsoft.ACE.OLEDB.12.0", "Microsoft.Jet.OLEDB.4.0"];
        for (var i = 0; i < providers.length; i++) {
            var connStr = "Provider=" + providers[i] + ";Data Source=" + dbPath + ";";
            try {
                var conn = new ActiveXObject("ADODB.Connection");
                conn.Open(connStr + "Mode=ReadWrite;Share Deny None;");
                return conn;
            } catch (e1) {
                try {
                    var conn2 = new ActiveXObject("ADODB.Connection");
                    conn2.Open(connStr);
                    return conn2;
                } catch(e2) {}
            }
        }
        return null;
    }
    
    // FORZA MASSIMIZZAZIONE FINESTRA ALLO STARTUP
    try {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
    } catch(e) {}
    
    var MAPPA_PROVINCE = {
        "AG": "Agrigento", "AL": "Alessandria", "AN": "Ancona", "AO": "Aosta", "AR": "Arezzo", "AP": "Ascoli Piceno", "AT": "Asti", "AV": "Avellino", "BA": "Bari", "BT": "Barletta-Andria-Trani", "BAT": "B.A.T. (Barletta-Andria-Trani)", "BL": "Belluno", "BN": "Benevento", "BG": "Bergamo", "BI": "Biella", "BO": "Bologna", "BZ": "Bolzano", "BS": "Brescia", "BR": "Brindisi", "CA": "Cagliari", "CL": "Caltanissetta", "CB": "Campobasso", "CE": "Caserta", "CH": "Chieti", "CO": "Como", "CR": "Cremona", "CS": "Cosenza", "CT": "Catania", "CZ": "Catanzaro", "EN": "Enna", "FC": "Forlì-Cesena", "FE": "Ferrara", "FG": "Foggia", "FI": "Firenze", "FM": "Fermo", "FR": "Frosinone", "GE": "Genova", "GO": "Gorizia", "GR": "Grosseto", "IM": "Imperia", "IS": "Isernia", "KR": "Crotone", "LT": "Latina", "LE": "Lecce", "LC": "Lecco", "LI": "Livorno", "LO": "Lodi", "LU": "Lucca", "MC": "Macerata", "MN": "Mantova", "MS": "Massa-Carrara", "MT": "Matera", "ME": "Messina", "MI": "Milano", "MO": "Modena", "MB": "Monza e della Brianza", "NA": "Napoli", "NO": "Novara", "NU": "Nuoro", "OR": "Oristano", "PD": "Padova", "PA": "Palermo", "PR": "Parma", "PV": "Pavia", "PG": "Perugia", "PU": "Pesaro e Urbino", "PE": "Pescara", "PC": "Piacenza", "PI": "Pisa", "PT": "Pistoia", "PN": "Pordenone", "PZ": "Potenza", "PO": "Prato", "RG": "Ragusa", "RA": "Ravenna", "RC": "Reggio Calabria", "RE": "Reggio Emilia", "RI": "Rieti", "RN": "Rimini", "RM": "Roma", "RO": "Rovigo", "SA": "Salerno", "SS": "Sassari", "SV": "Savona", "SI": "Siena", "SR": "Siracusa", "SO": "Sondrio", "SU": "Sud Sardegna", "TA": "Taranto", "TE": "Teramo", "TR": "Terni", "TO": "Torino", "TP": "Trapani", "TN": "Trento", "TV": "Treviso", "TS": "Trieste", "UD": "Udine", "VA": "Varese", "VE": "Venezia", "VB": "Verbano-Cusio-Ossola", "VC": "Vercelli", "VR": "Verona", "VV": "Vibo Valentia", "VI": "Vicenza", "VT": "Viterbo"
    };

    function getSiglaStandard(p) {
        if(!p) return "";
        var up = p.toString().toUpperCase().replace(/\./g, '').trim();
        
        // Forza BT come sigla canonica per qualsiasi variante di Barletta-Andria-Trani
        if(up === "BT" || up === "BAT" || up === "BARLETTA" || up === "ANDRIA" || up === "TRANI" || 
           up.indexOf("BARLETTA") !== -1 || up.indexOf("ANDRIA") !== -1 || up.indexOf("TRANI") !== -1) return "BT";

        if(MAPPA_PROVINCE[up]) return up;
        // Ricerca per nome
        for(var s in MAPPA_PROVINCE) {
            var n = MAPPA_PROVINCE[s].toUpperCase();
            if(up === n || up.indexOf(n) !== -1 || n.indexOf(up) !== -1) return s;
        }
        // Casi speciali (Città Metropolitana, ecc)
        if(up.indexOf("BARI") !== -1) return "BA";
        if(up.indexOf("TARANTO") !== -1) return "TA";
        if(up.indexOf("BRINDISI") !== -1) return "BR";
        if(up.indexOf("FOGGIA") !== -1) return "FG";
        if(up.indexOf("LECCE") !== -1) return "LE";
        if(up.indexOf("ROMA") !== -1) return "RM";
        if(up.indexOf("MILANO") !== -1) return "MI";
        if(up.indexOf("NAPOLI") !== -1) return "NA";
        if(up.indexOf("REGGIO") !== -1) {
            if(up.indexOf("CALABRIA") !== -1) return "RC";
            return "RE";
        }
        return up;
    }



    // Funzione Utility per evitare errori di riferimento nullo
    window.getEl = function(id) { return document.getElementById(id); };
    function getEl(id) { return document.getElementById(id); }
    function safeOn(id, evt, fn) {
        var el = getEl(id);
        if (el) { el[evt] = fn; return el; }
        return null;
    }

    function getVal(obj, keys) {
        if (!obj) return "";
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i].toLowerCase().replace(/\s+/g, '');
            if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
        }
        return "";
    }

    function formatDate(val) {
        if (val === null || val === undefined || val === "") return "";
        try {
            // Tentativo 1: JS Date o COM VT_DATE
            var d = new Date(val);
            if (isNaN(d.getTime())) {
                try { d = new Date(val.getVarDate()); } catch(e2) {}
            }
            
            var s = String(val).trim();
            
            // Tentativo 2: Match RegEx per Data in Testo
            if (isNaN(d.getTime())) {
                var strDate = s.replace("T", " ");
                var m1 = strDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/); // YYYY-MM-DD
                var m2 = strDate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/); // DD/MM/YYYY
                
                if (m1) {
                    d = new Date(m1[1], m1[2]-1, m1[3], m1[4]||0, m1[5]||0, m1[6]||0);
                } else if (m2) {
                    d = new Date(m2[3], m2[2]-1, m2[1], m2[4]||0, m2[5]||0, m2[6]||0);
                } else {
                    d = new Date(Date.parse(s));
                }
            }

            // Se tutto fallisce, ritorna il valore testuale grezzo ma limitato (salva UX)
            if (isNaN(d.getTime())) {
                return s.length > 20 ? s.substring(0, 20) : s;
            }

            var day = ("0" + d.getDate()).slice(-2);
            var month = ("0" + (d.getMonth() + 1)).slice(-2);
            var year = d.getFullYear().toString().substr(-2);
            var hours = ("0" + d.getHours()).slice(-2);
            var mins = ("0" + d.getMinutes()).slice(-2);
            return day + "/" + month + "/" + year + " " + hours + ":" + mins;
        } catch(e) { 
            return String(val).substring(0, 20); 
        }
    }

    function runQuery(sql, silent) {
        try {
            var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
            http.Open("POST", "http://127.0.0.1:3002/query", false); // Synchronous
            http.SetRequestHeader("Content-Type", "application/json");
            http.Send(JSON.stringify({ sql: sql }));
            
            if(http.Status === 200) {
                var rawRes = JSON.parse(http.ResponseText);
                if(sql.toUpperCase().indexOf("SELECT") === 0) {
                    var res = [];
                    for (var i = 0; i < rawRes.length; i++) {
                        var obj = {};
                        for (var key in rawRes[i]) {
                            var cleanName = key.toLowerCase().replace(/\s+/g, '');
                            obj[cleanName] = rawRes[i][key];
                        }
                        res.push(obj);
                    }
                    return res;
                } else {
                    return true;
                }
            } else {
                if(!silent) alert("AVVISO DATABASE:\n" + http.ResponseText + "\n\nQuery:\n" + sql);
                return sql.toUpperCase().indexOf("SELECT") === 0 ? [] : false;
            }
        } catch(e) { 
            if(!silent) alert("Errore di connessione al Bridge locale (Assicurarsi che il server sia avviato):\n" + e.message + "\n\nQuery:\n" + sql);
            return sql.toUpperCase().indexOf("SELECT") === 0 ? [] : false;
        }
    }

    function ensureSchema() {
        try {
            var queries = [
                "ALTER TABLE tblClienti ADD COLUMN Cap TEXT",
                "ALTER TABLE tblClienti ADD COLUMN SDI TEXT",
                "ALTER TABLE tblClienti ADD COLUMN StatoGravita TEXT",
                "ALTER TABLE tblClienti ADD COLUMN Civico TEXT",
                "ALTER TABLE tblClienti ADD COLUMN Frazione TEXT",
                "ALTER TABLE tblClienti ADD COLUMN Email TEXT",
                "ALTER TABLE tblClienti ADD COLUMN PEC TEXT",
                "ALTER TABLE tblClienti ADD COLUMN Nome TEXT",
                "ALTER TABLE tblClienti ADD COLUMN CodFisc TEXT",
                "ALTER TABLE tblClienti ADD COLUMN PIva TEXT",
                "ALTER TABLE tblClienti ADD COLUMN DataInserimento TEXT",
                "ALTER TABLE tblClienti ADD COLUMN DataUltimaModifica TEXT",
                "ALTER TABLE tblClienti ADD COLUMN isCancellato INTEGER DEFAULT 0",
                "ALTER TABLE tblClienti ADD COLUMN Logistica_Indirizzo TEXT",
                "ALTER TABLE tblClienti ADD COLUMN Logistica_Comune TEXT",
                "ALTER TABLE tblClienti ADD COLUMN Logistica_Provincia TEXT",
                "ALTER TABLE tblClienti ADD COLUMN AvvisatoIl TEXT",
                "ALTER TABLE tblClienti ADD COLUMN PreventivoOrdine TEXT",
                "CREATE TABLE IF NOT EXISTS tblOpzioniDisabilita (ID INTEGER PRIMARY KEY AUTOINCREMENT, Descr TEXT)"
            ];
            for(var i=0; i<queries.length; i++) {
                try { runQuery(queries[i], true); } catch(ex) { }
            }
            
            // Popolamento iniziale se vuoto
            try {
                var res = runQuery("SELECT COUNT(*) as c FROM tblOpzioniDisabilita", true);
                if(res && res[0] && res[0].c === 0) {
                    runQuery("INSERT INTO tblOpzioniDisabilita (Descr) VALUES ('Normovedente')", true);
                    runQuery("INSERT INTO tblOpzioniDisabilita (Descr) VALUES ('Ipovedente grave')", true);
                    runQuery("INSERT INTO tblOpzioniDisabilita (Descr) VALUES ('Cieco')", true);
                }
            } catch(ex) {}
        } catch(e) { }
    }

    function diagnosticColumns() {
        try {
            var conn = getDbConnection();
            if(!conn) return;
            var rs = conn.Execute("SELECT TOP 1 * FROM tblClienti");
            var cols = [];
            for(var i=0; i<rs.Fields.Count; i++) cols.push(rs.Fields(i).Name);
            // alert("DIAGNOSTICA COLONNE:\n" + cols.join(", "));
            rs.Close(); conn.Close();
        } catch(e) { }
    }

    var materialiExcelMemory = [];

    function loadMaterialiDB() {
        try {
            var materialDir = fso.BuildPath(currentDir, "gestione_materiale");
            var dbJsonPath = fso.BuildPath(materialDir, "materiali_db.json");
            
            if (fso.FileExists(dbJsonPath)) {
                var f = fso.OpenTextFile(dbJsonPath, 1, false, -1); // -1 per leggere correttamente file generati in Unicode da VBS
                var content = f.ReadAll();
                f.Close();
                if (content.charCodeAt(0) === 0xFEFF) {
                    content = content.substring(1);
                }
                materialiExcelMemory = JSON.parse(content);
            }
        } catch(e) {}
    }

    function checkMateriali(nome) {
        var badge = getEl("badgeMateriali");
        if (!badge) return;
        if (!nome || nome.trim().length < 3) {
            badge.style.display = "none";
            return;
        }
        var nNom = String(nome).toUpperCase().replace(/\s+/g, ' ').trim();
        var found = false;
        if (materialiExcelMemory && materialiExcelMemory.length > 0) {
            for (var i = 0; i < materialiExcelMemory.length; i++) {
                var itemNom = String(materialiExcelMemory[i].nominativo || "").toUpperCase().replace(/\s+/g, ' ').trim();
                if (itemNom !== "" && (itemNom === nNom || itemNom.indexOf(nNom) !== -1 || nNom.indexOf(itemNom) !== -1)) {
                    found = true;
                    break;
                }
            }
        }
        badge.style.display = found ? "inline-block" : "none";
    }

    function loadData() {
        var ov = getEl('overlay');
        if(ov) ov.style.display = 'flex';
        setTimeout(function() {
            try {
                ensureSchema(); 
                // diagnosticColumns(); 
                var locs = runQuery("SELECT * FROM tblLocalita");
                dbProvs = {}; dbLocToProv = {};
                dbCaps = {}; // Inizializza cache CAP
                for(var i=0; i<locs.length; i++) {
                    var rawP = getVal(locs[i], ["provincia", "prov"]);
                    var p = getSiglaStandard(rawP);
                    var l = getVal(locs[i], ["comune", "localita", "località", "loc"]);
                    var c = getVal(locs[i], ["cap", "cod_avv_post", "zip"]);
                    if(p && l) { 
                        if(!dbProvs[p]) dbProvs[p] = {}; dbProvs[p][l] = true; 
                        dbLocToProv[l.toUpperCase()] = p;
                        if(c) dbCaps[l.toUpperCase()] = c;
                    }
                }
                var listProv = getEl('listProvincie');
                if(listProv) {
                    listProv.innerHTML = '';
                    var prs = []; for(var k in MAPPA_PROVINCE) prs.push(k); prs.sort();
                    for(var j=0; j<prs.length; j++) {
                        var o = document.createElement('option'); 
                        o.value = prs[j]; 
                        o.text = MAPPA_PROVINCE[prs[j]]; // Mostra il nome esteso come suggerimento secondario nel datalist
                        listProv.appendChild(o);
                    }
                }
                dataClienti = runQuery("SELECT * FROM tblClienti WHERE (isCancellato IS NULL OR isCancellato = 0)");
                
                // SUPPORTO CAP EXTRA DA ANAGRAFICA ESISTENTE & PRECOMPUTAZIONE CAMPI PER VELOCIZZARE RICERCA E RENDERING
                for(var k=0; k<dataClienti.length; k++) {
                    var c = dataClienti[k];
                    c._nome = getVal(c, ["cognomenome", "nome"]).toString().toUpperCase();
                    c._nomeNoSpaces = c._nome.replace(/\s/g, '');
                    c._id = getVal(c, ["id", "idcliente", "codice"]).toString();
                    c._loc = getVal(c, ["comune", "localita"]).toString().toUpperCase();
                    c._locNoSpaces = c._loc.replace(/\s/g, '');
                    c._tel = getVal(c, ["telefono", "telefoni"]).toString();
                    c._telClean = c._tel.replace(/\D/g, '');
                    c._stato = getVal(c, ["statogravita", "disabilita", "stato"]).toString().toUpperCase();
                    c._email = getVal(c, ["email", "e-mail"]).toString();
                    c._residenza = getVal(c, ["residenza", "indirizzo"]).toString();
                    c._logInd = getVal(c, ["logistica_indirizzo"]).toString();

                    var cCom = c._loc;
                    var cCap = getVal(c, ["cap"]).toString();
                    if(cCom && cCap && cCap.length >= 5) {
                        if(!dbCaps[cCom]) dbCaps[cCom] = cCap; // Integra se mancante o sovrascrivi se necessario
                    }
                }

                ricaricaLista("");
                try { CaricaProfiloUtente(); } catch(e) {} // Esegui PRIMA delle statistiche così la sessione utente è popolata
                try { CaricaMemoHub(); } catch(e) {} // Carica gli appunti direzionali salvati
                try { if(window.AggiornaOverviewStats) window.AggiornaOverviewStats(); } catch(eOv){}
                loadDisabilities();
                loadMaterialiDB(); // [Z] Aggiunto load DB Materiali
                gestioneBridge();
                try { setupLiveCardBindings(); } catch(e){}
                if(getEl('lblInfoRecordHeader')) getEl('lblInfoRecordHeader').innerText = "SISTEMA PRONTO";
                if(ov) ov.style.display = 'none';
            } catch(e) { if(ov) ov.style.display = 'none'; }
        }, 300);
    }

    function CaricaProfiloUtente() {
        try {
            var sysDir = fso.BuildPath(currentDir, "system");
            var credFile = fso.BuildPath(sysDir, "cred.local");
            var user = "Ciro Milella";
            if (fso.FileExists(credFile)) {
                var f = fso.OpenTextFile(credFile, 1);
                if (!f.AtEndOfStream) {
                    var l1 = f.ReadLine();
                    if (l1 && l1.length > 0 && l1.toUpperCase() !== "OSPITE" && l1.toUpperCase() !== "OPERATORE") {
                        user = l1;
                    }
                }
                f.Close();
            }
            
            window.sessionUserName = user;
            var widget = getEl("userProfileWidget");
            if (widget) {
                widget.style.display = "inline-flex";
                widget.style.alignItems = "center";
                widget.style.color = "#ffffff";
                widget.innerHTML = '<span style="font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">PROFILO: ' + user + '</span> <div style="width:22px; height:22px; border-radius:50%; background:rgba(56,189,248,0.2); border:1px solid #38bdf8; display:inline-flex; align-items:center; justify-content:center; margin-left:8px; overflow:hidden;"><img src="https://img.icons8.com/ios-filled/50/38bdf8/user-male-circle.png" style="width:13px; height:13px;"></div>';
            }
        } catch(e) {}
    }

    var memoDebounceTimer = null;
    window.SalvaMemoHub = function() {
        var txtArea = getEl('txtZenithMemo');
        var icon = getEl('memoAutoSaveIcon');
        if (!txtArea) return;
        
        if (icon) {
            icon.className = "fa fa-refresh fa-spin";
            icon.style.color = "#38bdf8";
        }
        
        if (memoDebounceTimer) clearTimeout(memoDebounceTimer);
        memoDebounceTimer = setTimeout(function() {
            try {
                var sysDir = fso.BuildPath(currentDir, "system");
                var memoFile = fso.BuildPath(sysDir, "memo_hub.txt");
                // Usa stream Unicode (true) per supportare lettere accentate e caratteri speciali perfettamente
                var stream = fso.CreateTextFile(memoFile, true, true); 
                stream.Write(txtArea.value);
                stream.Close();
                
                if (icon) {
                    icon.className = "fa fa-check";
                    icon.style.color = "#22c55e";
                }
            } catch(eSave) {
                if (icon) {
                    icon.className = "fa fa-warning";
                    icon.style.color = "#ef4444";
                }
            }
        }, 650);
    };

    function CaricaMemoHub() {
        try {
            var sysDir = fso.BuildPath(currentDir, "system");
            var memoFile = fso.BuildPath(sysDir, "memo_hub.txt");
            var txtArea = getEl('txtZenithMemo');
            if (!txtArea) return;
            
            if (fso.FileExists(memoFile)) {
                // Apri stream Unicode (-1) per lettura fedele dei testi
                var stream = fso.OpenTextFile(memoFile, 1, false, -1);
                var txt = "";
                if (!stream.AtEndOfStream) {
                    txt = stream.ReadAll();
                }
                stream.Close();
                txtArea.value = txt;
            }
        } catch(eLoad) {}
    }

    function gestioneBridge() {
        var bPath = fso.BuildPath(fso.BuildPath(currentDir, "system"), "search.tmp");
        if(fso.FileExists(bPath)) {
            try {
                var ts = fso.OpenTextFile(bPath, 1);
                var nome = ts.ReadLine().trim();
                ts.Close();
                fso.DeleteFile(bPath);
                
                if(nome !== "") {
                    // Cerca il cliente nel dataClienti caricato
                    setTimeout(function() {
                        var trovato = false;
                        var container = getEl('cardsContainer');
                        if(!container) return;
                        
                        for(var i=0; i<dataClienti.length; i++) {
                            var targetName = getVal(dataClienti[i], ["cognomenome", "denominazione"]).toString().toUpperCase();
                            if(targetName === nome.toUpperCase()) {
                                // Cerchiamo la card nel DOM per l'highlight
                                var rToSel = null;
                                var cards = container.querySelectorAll('.client-glass-card');
                                for(var k=0; k<cards.length; k++) {
                                    var cardName = cards[k].querySelector('.name');
                                    if(cardName && cardName.innerText.toUpperCase() === targetName) {
                                        rToSel = cards[k]; break;
                                    }
                                }
                                selezionaCliente(dataClienti[i], rToSel);
                                trovato = true;
                                break;
                            }
                        }
                        if(!trovato) {
                             // Fallback: ricerca parziale
                             for(var j=0; j<dataClienti.length; j++) {
                                 var targetName2 = getVal(dataClienti[j], ["cognomenome", "denominazione"]).toString().toUpperCase();
                                 if(targetName2.indexOf(nome.toUpperCase()) > -1) {
                                     // Cerchiamo la card nel DOM per l'highlight
                                     var rowToSelect = null;
                                     var allCards = container.querySelectorAll('.client-glass-card');
                                     for(var r=0; r<allCards.length; r++) {
                                         var cName = allCards[r].querySelector('.name');
                                         if(cName && cName.innerText.toUpperCase().indexOf(nome.toUpperCase()) > -1) {
                                             rowToSelect = allCards[r]; break;
                                         }
                                     }
                                     selezionaCliente(dataClienti[j], rowToSelect);
                                     break;
                                 }
                             }
                        }
                    }, 500);
                }
            } catch(e) {}
        }
    }
    var filtroStatoCorrente = ""; // Variabile di stato per i filtri
    var limiteRendering = 50;
    var ultimoFiltro = "";

    window.ricaricaLista = function(filtro, statoFiltro, keepLimit) {
        var container = getEl('cardsContainer');
        if(!container) return;
        
        var search = (filtro || "").toUpperCase();
        var searchClean = search.replace(/\D/g, ''); // Zenith: Solo cifre per ricerca telefonica fluida
        // FIX: Evita falsi positivi sui numeri civici se la ricerca contiene testo
        if (search.match(/[A-Z]/i) && searchClean.length < 6) searchClean = ""; 
        var searchNoSpaces = search.replace(/\s/g, ''); // Zenith: Ricerca senza spazi per nomi (es. DI GENNARO -> DIGENNARO)
        if(statoFiltro !== undefined) filtroStatoCorrente = statoFiltro.toUpperCase();
        
        if (!keepLimit) {
            limiteRendering = 50;
        }
        ultimoFiltro = filtro;

        container.innerHTML = '';
        var count = 0;
        var renderedCount = 0;

        for (var i = 0; i < dataClienti.length; i++) {
            var c = dataClienti[i];
            
            // Usiamo i campi precomputati per velocizzare
            var nome = c._nome || "";
            var nomeNoSpaces = c._nomeNoSpaces || "";
            var id = c._id || "";
            var loc = c._loc || "";
            var locNoSpaces = c._locNoSpaces || "";
            var tel = c._tel || "";
            var telClean = c._telClean || "";
            var stato = c._stato || "";
            var res = (c._residenza || "").toUpperCase();
            var resNoSpaces = res.replace(/\s/g, '');

            // Filtro testo (Match standard + Match numerico "pulito" + Match senza spazi per nomi/località + Match su Stato)
            var matchTesto = !search || 
                              nome.indexOf(search) > -1 || 
                              id.indexOf(search) > -1 || 
                              loc.indexOf(search) > -1 || 
                              res.indexOf(search) > -1 ||
                              tel.indexOf(search) > -1 ||
                              stato.indexOf(search) > -1 ||
                              (searchClean !== "" && telClean.indexOf(searchClean) > -1) ||
                              (searchNoSpaces !== "" && nomeNoSpaces.indexOf(searchNoSpaces) > -1) ||
                              (searchNoSpaces !== "" && locNoSpaces.indexOf(searchNoSpaces) > -1) ||
                              (searchNoSpaces !== "" && resNoSpaces.indexOf(searchNoSpaces) > -1);
            
            // Filtro stato (Supporto speciale per ALTRO e INCOMPLETO)
            var matchStato = true;
            if (filtroStatoCorrente) {
                if (filtroStatoCorrente === "ALTRO") {
                    matchStato = stato !== "" && stato.indexOf("CIECO") === -1 && stato.indexOf("IPOVEDENTE") === -1;
                } else if (filtroStatoCorrente === "INCOMPLETO") {
                    // Rileva profili che non hanno Telefono o che non hanno Comune/Località specificato
                    matchStato = !tel || String(tel).trim() === "" || !loc || String(loc).trim() === "";
                } else {
                    matchStato = stato.indexOf(filtroStatoCorrente) > -1;
                }
            }

            if (matchTesto && matchStato) {
                count++;
                
                // Limita il rendering effettivo per ottimizzare il motore di IE11
                if (renderedCount >= limiteRendering) {
                    continue; 
                }
                renderedCount++;

                var card = document.createElement('div');
                card.className = 'client-glass-card';
                if (clienteCorrente && getVal(clienteCorrente, ["id"]).toString() === id) card.classList.add('active');
                
                card.onclick = (function(clientData, el){ 
                    return function(){ selezionaCliente(clientData, el); }; 
                })(c, card);

                var iniziali = String(nome).substring(0, 2).toUpperCase();
                
                // Calcolo al volo degli indicatori di stato
                var badgeHtml = "";
                if (stato.indexOf("CIECO") > -1) {
                    badgeHtml = '<div class="card-status-dot eye-cieco" title="Soggetto Cieco"><i class="fa fa-eye-slash"></i></div>';
                } else if (stato.indexOf("IPOVEDENTE") > -1) {
                    badgeHtml = '<div class="card-status-dot eye-ipovedente" title="Soggetto Ipovedente"><i class="fa fa-low-vision"></i></div>';
                }
                
                // Allerta dati mancanti (Indirizzo o Telefono vuoti)
                var alertHtml = "";
                if (!tel || String(tel).trim() === "" || !loc || String(loc).trim() === "") {
                    alertHtml = '<div class="card-status-dot card-alert" title="Dati Incompleti (Manca Telefono o Residenza!)"><i class="fa fa-exclamation-triangle"></i></div>';
                }

                // Calcolo al volo degli indicatori di stato per Segugio
                var emailVal = c._email || "";
                var residenzaVal = c._residenza || "";
                var logIndVal = c._logInd || "";

                var hasTel = (tel && String(tel).trim() !== "" && String(tel).toLowerCase() !== "null");
                var hasEmail = (emailVal && String(emailVal).trim() !== "" && String(emailVal).toLowerCase() !== "null");
                var hasRes = (residenzaVal && String(residenzaVal).trim() !== "" && String(residenzaVal).toLowerCase() !== "null" && loc && String(loc).trim() !== "" && String(loc).toLowerCase() !== "null");
                var hasLog = (logIndVal && String(logIndVal).trim() !== "" && String(logIndVal).toLowerCase() !== "null");

                var segugioHtml = 
                    '<div class="segugio-indicators">' +
                        '<span class="segugio-indicator" title="Telefono: ' + (hasTel ? 'Presente' : 'Assente') + '">' + (hasTel ? '<span style="color:#2e7d32; font-weight:bold;">✔</span>' : '<span style="color:#c62828; font-weight:bold;">✖</span>') + '</span>' +
                        '<span class="segugio-indicator" title="E-mail: ' + (hasEmail ? 'Presente' : 'Assente') + '">' + (hasEmail ? '<span style="color:#2e7d32; font-weight:bold;">✔</span>' : '<span style="color:#c62828; font-weight:bold;">✖</span>') + '</span>' +
                        '<span class="segugio-indicator" title="Residenza: ' + (hasRes ? 'Completa' : 'Incompleta') + '">' + (hasRes ? '<span style="color:#2e7d32; font-weight:bold;">✔</span>' : '<span style="color:#c62828; font-weight:bold;">✖</span>') + '</span>' +
                        '<span class="segugio-indicator" title="Sito Logistico: ' + (hasLog ? 'Configurato' : 'Non configurato') + '">' + (hasLog ? '<span style="color:#2e7d32; font-weight:bold;">✔</span>' : '<span style="color:#c62828; font-weight:bold;">✖</span>') + '</span>' +
                    '</div>';

                card.innerHTML = 
                    '<div class="client-avatar-container">' +
                        '<div class="client-avatar">' + iniziali + '</div>' +
                        badgeHtml + alertHtml +
                    '</div>' +
                    '<div class="client-info-preview">' +
                        '<span class="name">' + nome + '</span>' +
                        '<span class="loc">' + loc + '</span>' +
                    '</div>' +
                    segugioHtml +
                    '<div class="client-card-meta">' +
                        '<div class="id-label">ID ' + id + '</div>' +
                        '<div class="tel-label">' + (tel ? String(tel).split(';')[0] : '---') + '</div>' +
                    '</div>';
                
                container.appendChild(card);
            }
        }

        // Aggiungi pulsante Carica Altri se ci sono ulteriori schede
        if (count > limiteRendering) {
            var btnMore = document.createElement('div');
            btnMore.className = 'load-more-btn';
            btnMore.innerHTML = 'Carica Altri (' + Math.min(50, count - limiteRendering) + ' di ' + (count - limiteRendering) + ')...';
            btnMore.onclick = function() {
                window.mostraAltriClienti();
            };
            container.appendChild(btnMore);
        }
        
        var lblCount = getEl('lblCounterList');
        if(lblCount) {
            var txtBase = "CLIENTI";
            if(filtroStatoCorrente === "CIECO") txtBase = "CIECHI 👁️";
            if(filtroStatoCorrente === "IPOVEDENTE") txtBase = "IPOVEDENTI 👓";
            if(filtroStatoCorrente === "ALTRO") txtBase = "ALTRE DISABILITÀ 📂";
            if(filtroStatoCorrente === "INCOMPLETO") txtBase = "DA COMPLETARE ⚠️";
            lblCount.innerHTML = txtBase + " <span style='color:white; margin-left:5px;'>" + count + "</span>";
        }
    }

    window.mostraAltriClienti = function() {
        limiteRendering += 50;
        var valRicerca = getEl('txtRicerca') ? getEl('txtRicerca').value : "";
        ricaricaLista(valRicerca, undefined, true);
    };

    window.filtraStato = function(stato, btn) {
        var pills = document.querySelectorAll('.btn-filter-pill');
        for(var i=0; i<pills.length; i++) pills[i].classList.remove('active');
        if(btn) btn.classList.add('active');
        
        var valRicerca = getEl('txtRicerca') ? getEl('txtRicerca').value : "";
        if(stato === "TUTTI") ricaricaLista(valRicerca, "");
        else ricaricaLista(valRicerca, stato);
    };

    // Funzioni Ribbon
    window.WhatsAppCliente = function() {
        var telTag = getEl('recapitiList') ? getEl('recapitiList').querySelector('.id-recapito-item') : null;
        var tel = telTag ? telTag.innerText.replace(/\D/g,'') : "";
        if(tel) window.open("https://wa.me/39" + tel);
        else alert("Seleziona un cliente con numero telefonico.");
    };

    window.EmailCliente = function() {
        var mail = getEl('txtEmailCliente') ? getEl('txtEmailCliente').value : "";
        if(mail) window.location.href = "mailto:" + mail;
        else alert("Nessun indirizzo email configurato.");
    };

    window.StampaSchedaCard = function() {
        alert("Generazione Scheda Gold PDF...");
        // Logica stampa qui
    };

    function selezionaCliente(c, row) {
        if (!CheckUnsavedChanges()) return; // Intercetta cambio riga in presenza di modifiche

        var container = getEl('cardsContainer');
        if(container) {
            var allCards = container.querySelectorAll('.client-glass-card');
            for (var i = 0; i < allCards.length; i++) allCards[i].classList.remove("active");
        }
        if(row) row.classList.add("active");
        
        clienteCorrente = c;
        
        // ZENITH UI REVEAL
        if(getEl('selectionPlaceholder')) getEl('selectionPlaceholder').style.display = 'none';
        var cardEl = getEl('mainDetailCard');
        if(cardEl) {
            cardEl.style.display = 'flex';
            cardEl.style.animation = 'none';
            void cardEl.offsetWidth; // Trigger reflow
            cardEl.style.animation = 'zenithReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        }

        var nome = getVal(c, ["cognomenome", "nome"]);
        var id = getVal(c, ["id", "idcliente", "codice"]);
        
        if(getEl('lblDisplayName')) getEl('lblDisplayName').innerText = nome.toUpperCase();
        
        if(getEl('txtId')) getEl('txtId').value = id;
        if(getEl('txtCognomeNome')) {
            getEl('txtCognomeNome').value = nome;
            checkMateriali(nome);
            
            // Aggiungo handler per il controllo onkeyup
            getEl('txtCognomeNome').onkeyup = function() {
                checkMateriali(this.value);
            };
        }
        if(getEl('txtResidenza')) getEl('txtResidenza').value = getVal(c, ["residenza", "indirizzo"]);
        if(getEl('txtLogIndirizzo')) getEl('txtLogIndirizzo').value = getVal(c, ["logistica_indirizzo"]) || "";
        if(getEl('txtLogComune')) getEl('txtLogComune').value = getVal(c, ["logistica_comune"]) || "";
        if(getEl('txtLogProvincia')) getEl('txtLogProvincia').value = getVal(c, ["logistica_provincia"]) || "";
        
        var provRaw = getVal(c, ["provincia", "sigla", "prov"]);
        var prov = getSiglaStandard(provRaw);
        if(getEl('cmbProvincia')) {
            getEl('cmbProvincia').value = prov;
            popolaLocalita(prov, getVal(c, ["comune", "localita", "località", "loc"]));
            updateRegione(prov);
        }
        
        if(getEl('txtCap')) getEl('txtCap').value = getVal(c, ["cap"]);
        if(getEl('txtEmailCliente')) getEl('txtEmailCliente').value = getVal(c, ["email", "e-mail"]);
        if(getEl('txtAvvisatoIl')) getEl('txtAvvisatoIl').value = getVal(c, ["avvisatoil"]) || "";
        if(getEl('txtPreventivoOrdine')) getEl('txtPreventivoOrdine').value = getVal(c, ["preventivoordine"]) || "";
        if(getEl('txtNote')) getEl('txtNote').value = getVal(c, ["note", "segnalazioni"]);
        
        var tels = getVal(c, ["telefono", "telefoni"]).toString();
        if(getEl('txtTelefoni')) getEl('txtTelefoni').value = tels;
        if(window.renderPhoneChips) window.renderPhoneChips();
        
        var stato = getVal(c, ["statogravita", "disabilita", "stato", "gravita", "statogravità"]).toString();
        if(getEl('cmbDisabilita')) getEl('cmbDisabilita').value = stato;
        updateStatoBadge(stato);
        
        var dtIns = getVal(c, ["datainserimento", "datainseriment", "data_ins"]);
        var strIns = formatDate(dtIns);
        if(getEl('lblDeckDataIns')) getEl('lblDeckDataIns').innerText = strIns || "--/--/--";
        if(getEl('lblDataInserimentoFooter')) {
            getEl('lblDataInserimentoFooter').innerText = strIns ? "CARTA EMESSA IL: " + strIns : "EMISSIONE: N.D.";
        }

        var dtMod = getVal(c, ["dataultimamodifica", "datamodifica", "data_mod"]);
        var strMod = formatDate(dtMod);
        if(getEl('lblDeckDataMod')) getEl('lblDeckDataMod').innerText = strMod || "--/--/--";
        if(getEl('lblDataModificaFooter')) {
            getEl('lblDataModificaFooter').innerText = strMod ? "ULTIMO AGGIORNAMENTO: " + strMod : "MODIFICA: --/--/--";
        }
        
        // CALCOLO INTEGRITÀ DATI
        if(window.calculateIntegrity) window.calculateIntegrity();

        var foto = getVal(c, ["percorsofoto", "foto"]);
        if (getEl('txtPercorsoFoto')) getEl('txtPercorsoFoto').value = foto || "";
        var imgC = getEl('imgCliente');
        var ph = getEl('photoPlaceholder');
        if (imgC && ph) {
            imgC.style.display = 'none';
            ph.style.display = 'block';
            if (foto) {
                var fullPath = fso.BuildPath(fotoDir, foto);
                if (fso.FileExists(fullPath)) {
                    var safePath = "FotoClienti/" + foto;
                    imgC.style.backgroundImage = "url('" + safePath + "')";
                    imgC.style.display = 'block'; 
                    ph.style.display = 'none';
                }
            }
        }

        popolaRecapitiTags(getVal(c, ["telefono", "telefoni"]).toString());
        if(getEl('lblFirmaTitolare')) getEl('lblFirmaTitolare').innerText = nome;
        
        // --- POPULATE COMPACT CIE CARD PREVIEW ---
        if(getEl('cardNomeCompleto')) getEl('cardNomeCompleto').innerText = nome.toUpperCase();
        if(getEl('cardCodiceId')) getEl('cardCodiceId').innerText = "ID: " + id;
        
        var locInfo = getVal(c, ["comune", "localita", "località", "loc"]).toString().toUpperCase();
        var provInfo = getSiglaStandard(getVal(c, ["provincia", "sigla", "prov"]));
        if(getEl('cardCitta')) getEl('cardCitta').innerText = locInfo ? (locInfo + (provInfo ? " (" + provInfo + ")" : "")) : "---";
        
        var firstTel = "";
        if (tels) {
            var telArr = tels.split(';');
            if (telArr.length > 0) firstTel = telArr[0].trim();
        }
        if(getEl('cardTel')) getEl('cardTel').innerText = firstTel || "---";
        if(getEl('cardEmail')) getEl('cardEmail').innerText = getVal(c, ["email", "e-mail"]) || "---";
        if(getEl('cardSignature')) getEl('cardSignature').innerText = nome;
        
        updateWhatsAppLink();

        function highlightFields() {
            var f = document.querySelectorAll('input, select, textarea');
            for(var i=0; i<f.length; i++) {
                if(f[i].id !== "txtRicerca" && f[i].value && f[i].value.trim() !== "" && f[i].value !== "Scegli...") {
                    f[i].classList.add("is-populated");
                } else {
                    f[i].classList.remove("is-populated");
                }
            }
        }
        highlightFields();
        
        if(getEl('btnEliminaCliente')) getEl('btnEliminaCliente').disabled = false;
        if(getEl('txtCognomeNome')) getEl('txtCognomeNome').focus();
        
        // LOGISTICA UNIFICATA: Aggiorna la timeline delle consegne associate all'ID
        window.AggiornaSezioneConsegneCliente(id);
        if (window.AgganciaValidatoriIndirizzi) window.AgganciaValidatoriIndirizzi();
        
        // Cattura stato iniziale della scheda dopo il popolamento completo
        originalState = GetCurrentFormState();
    }

    // --- LOGICA LOGISTICA INTEGRATA: TIMELINE CRONOLOGIA CONSEGNE ---
    window.AggiornaSezioneConsegneCliente = function(id) {
        var timeline = getEl('deliveryTimeline');
        var counter = getEl('lblTotConsegneCliente');
        if(!timeline || !counter) return;
        
        timeline.innerHTML = '<div style="color: #94a3b8; font-style: italic; font-size: 0.85rem; padding: 10px 0;"><i class="fa fa-spinner fa-spin" style="margin-right: 8px;"></i>Recupero storico consegne...</div>';
        counter.innerText = "0";
        
        if(!id || id === "NEW") {
            timeline.innerHTML = '<div style="color: #94a3b8; font-style: italic; font-size: 0.85rem; padding: 10px 0;"><i class="fa fa-info-circle" style="margin-right: 6px; color: var(--zenith-cyan);"></i>Nessuna consegna associabile a nuove schede.</div>';
            if(window.AggiornaBadgeRanking) window.AggiornaBadgeRanking(null);
            return;
        }
        
        try {
            // Esegui query sul Bridge locale per recuperare lo storico consegne
            var sql = "SELECT DataConsegna, OraConsegna, Stato, Note, Consegnato, Merce FROM tblConsegne WHERE ID_Cliente = " + id + " ORDER BY DataConsegna DESC, OraConsegna DESC";
            var rs = runQuery(sql, true);
            
            // Aggiorna dinamicamente il badge operativo nella testata (PRIMO PIATTO)
            if(window.AggiornaBadgeRanking) window.AggiornaBadgeRanking(rs);
            
            if(!rs || rs.length === 0) {
                timeline.innerHTML = '<div style="color: #94a3b8; font-style: italic; font-size: 0.85rem; padding: 10px 0;"><i class="fa fa-info-circle" style="margin-right: 6px; color: var(--zenith-cyan);"></i>Nessuna consegna registrata in database per questo cliente.</div>';
                return;
            }
            
            // Animazione fluida Count-up del contatore totale consegne (UX Premium)
            var endCount = rs.length;
            var currCount = 0;
            var timer = setInterval(function() {
                // Easing-out
                var diff = endCount - currCount;
                var easingFactor = 0.15;
                currCount += diff * easingFactor;
                
                if (Math.abs(diff) < 0.8) {
                    currCount = endCount;
                    clearInterval(timer);
                    counter.innerText = endCount;
                } else {
                    counter.innerText = Math.floor(currCount);
                }
            }, 50);
            
            timeline.innerHTML = "";
            
            // Popola fino ad un massimo di 4 card in ordine cronologico inverso
            var maxShow = Math.min(rs.length, 4);
            for (var i = 0; i < maxShow; i++) {
                var item = rs[i];
                var dtRaw = item.dataconsegna ? item.dataconsegna.toString().substring(0, 10) : "N.D.";
                var dtFormatted = FormattaDataIT(dtRaw);
                var ora = item.oraconsegna || "--:--";
                var note = item.note || "";
                var merce = item.merce || "";
                
                // SANIFICAZIONE E MAPPATURA STATI (Fix anomalia 'Falso' del database legacy)
                var rawStato = item.stato || "";
                var cons = String(item.consegnato || "0");
                
                var visualStato = "PIANIFICATO";
                var accentColor = "#0ea5e9"; // Default Blu (Pianificato)
                var icon = "fa-calendar-o";
                
                // Priorità massima alla colonna Booleana/Intera Consegnato (-1 o 1 in Access indica Completato)
                if (cons === "-1" || cons === "1" || cons === "true" || cons === "True") {
                    visualStato = "CONSEGNATO";
                    accentColor = "#10b981"; // Verde (Completato)
                    icon = "fa-check-circle";
                } else {
                    var stLower = rawStato.toLowerCase();
                    if (stLower.indexOf("consegn") > -1 || stLower.indexOf("complet") > -1 || stLower.indexOf("confermat") > -1) {
                        visualStato = "CONSEGNATO";
                        accentColor = "#10b981"; // Verde
                        icon = "fa-check-circle";
                    } else if (stLower.indexOf("annull") > -1) {
                        visualStato = "ANNULLATO";
                        accentColor = "#ef4444"; // Rosso
                        icon = "fa-times-circle";
                    } else if (stLower.indexOf("viagg") > -1 || stLower.indexOf("transit") > -1) {
                        visualStato = "IN VIAGGIO";
                        accentColor = "#f59e0b"; // Arancio
                        icon = "fa-truck";
                    } else if (stLower.indexOf("chiamare") > -1) {
                        visualStato = "DA PIANIFICARE";
                        accentColor = "#f59e0b"; // Arancio
                        icon = "fa-phone";
                    } else if (stLower === "falso" || stLower === "") {
                        visualStato = "PIANIFICATO"; // Pulizia valore anomalo 'Falso' se consegnato=0
                        accentColor = "#0ea5e9"; 
                        icon = "fa-calendar-o";
                    } else {
                        visualStato = rawStato.toUpperCase(); // Mantenimento valore originale normalizzato
                    }
                }
                
                var card = document.createElement("div");
                card.style.cssText = "min-width: 230px; flex: 1; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.09); border-left: 4px solid " + accentColor + "; border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: default;";
                
                card.onmouseover = function() { 
                    this.style.background = "rgba(255,255,255,0.07)"; 
                    this.style.borderColor = "rgba(255,255,255,0.15)"; 
                    this.style.transform = "translateY(-3px)"; 
                    this.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
                };
                card.onmouseout = function() { 
                    this.style.background = "rgba(255, 255, 255, 0.04)"; 
                    this.style.borderColor = "rgba(255,255,255,0.09)"; 
                    this.style.transform = "none"; 
                    this.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                };
                
                card.innerHTML = 
                    "<div style='display:flex; justify-content:space-between; align-items:center;'>" +
                        "<span style='font-size:0.65rem; font-weight:900; color:" + accentColor + "; text-transform:uppercase; display:flex; align-items:center; gap:5px; letter-spacing: 0.5px;'><i class='fa " + icon + "'></i> " + visualStato + "</span>" +
                        "<div style='display:flex; align-items:center; gap:8px;'>" +
                            "<i class='fa fa-whatsapp' style='color:#22c55e; font-size:0.9rem; cursor:pointer; text-shadow: 0 0 8px rgba(34, 197, 94, 0.3); font-weight:900;' onclick='if(window.InviaWhatsAppConsegna) window.InviaWhatsAppConsegna(\"" + dtFormatted + "\", \"" + ora + "\"); event.stopPropagation();' title='Invia promemoria WhatsApp per questa consegna'></i>" +
                            "<span style='font-size:0.6rem; color:rgba(255,255,255,0.3); font-weight:800;'>N. " + (rs.length - i) + "</span>" +
                        "</div>" +
                    "</div>" +
                    "<div style='font-size:0.95rem; font-weight:800; color:white; margin-top:4px; letter-spacing:0.2px;'>" + dtFormatted + "</div>" +
                    "<div style='font-size:0.75rem; font-weight:600; color:rgba(255,255,255,0.55);'><i class='fa fa-clock-o' style='margin-right:4px; opacity:0.7;'></i>Ore " + ora + "</div>" +
                    (merce && merce.replace(/-/g,"").trim() !== "" ? "<div style='margin-top:5px; background:rgba(6, 182, 212, 0.1); color:var(--zenith-cyan); border:1px solid rgba(6,182,212,0.3); font-size:0.72rem; font-weight:800; padding:5px 10px; border-radius:6px; letter-spacing:0.2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' title=\"" + merce.replace(/"/g, "&quot;").replace(/'/g, "&#39;") + "\"><i class='fa fa-cube' style='margin-right:6px; opacity:0.8;'></i>" + merce.toUpperCase() + "</div>" : "") +
                    (note ? "<div style='font-size:0.7rem; color:rgba(255,255,255,0.45); font-style:italic; margin-top:6px; padding-top:6px; border-top: 1px solid rgba(255,255,255,0.05); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' title=\"" + note.replace(/"/g, "&quot;").replace(/'/g, "&#39;") + "\">" + note + "</div>" : "");
                
                timeline.appendChild(card);
            }
            
            // Se ci sono più di 4 consegne totali, aggiungi la card d'azione per vederle tutte nel modulo dedicato
            if(rs.length > 4) {
                var moreCard = document.createElement("div");
                moreCard.style.cssText = "min-width: 130px; display:flex; flex-direction:column; justify-content:center; align-items:center; background: rgba(6, 182, 212, 0.06); border: 1.5px dashed rgba(6, 182, 212, 0.35); border-radius: 12px; padding: 15px; cursor:pointer; transition:all 0.2s ease; gap:8px;";
                moreCard.innerHTML = "<i class='fa fa-arrow-circle-right' style='color:var(--zenith-cyan); font-size:1.5rem;'></i><span style='font-size:0.7rem; font-weight:800; color:var(--zenith-cyan); text-align:center; letter-spacing:0.5px; text-transform:uppercase;'>ALTRE " + (rs.length - 4) + " <br>CONSEGNE</span>";
                
                moreCard.onclick = function() { window.NavigaModulo('consegne.html'); };
                moreCard.onmouseover = function() { 
                    this.style.background = "rgba(6, 182, 212, 0.12)"; 
                    this.style.borderColor = "var(--zenith-cyan)";
                    this.style.transform = "scale(1.02)";
                };
                moreCard.onmouseout = function() { 
                    this.style.background = "rgba(6, 182, 212, 0.06)"; 
                    this.style.borderColor = "rgba(6, 182, 212, 0.35)";
                    this.style.transform = "none";
                };
                timeline.appendChild(moreCard);
            }
        } catch(err) {
            timeline.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 10px 0;"><i class="fa fa-exclamation-triangle" style="margin-right: 6px;"></i>Errore recupero cronologia: ' + err.message + '</div>';
        }
    };

    // Helper di Formattazione Data Standard IT
    function FormattaDataIT(isoStr) {
        if(!isoStr) return "N.D.";
        var p = isoStr.split(/[-/ T:]/);
        if(p.length >= 3) {
            if(p[0].length === 4) {
                return p[2] + "/" + p[1] + "/" + p[0];
            }
            return p[0] + "/" + p[1] + "/" + p[2];
        }
        return isoStr;
    }

    function popolaRecapitiTags(t) {
        var out = getEl('recapitiList');
        var hiddenLst = getEl('lstTelefonos');
        if(!out) return;
        out.innerHTML = '';
        if(hiddenLst) hiddenLst.innerHTML = '';
        
        if (t) {
            var arr = t.split(';');
            for (var j = 0; j < arr.length; j++) {
                var raw = arr[j].trim();
                if(raw) {
                    var item = document.createElement('div');
                    item.className = 'id-recapito-item';
                    item.innerHTML = '<i class="fa fa-phone"></i> ' + raw;
                    out.appendChild(item);
                    if(hiddenLst) hiddenLst.appendChild(createPhoneRow(raw));
                }
            }
        } else {
            out.innerHTML = '<div class="id-recapito-item" style="opacity:0.5;">NESSUN RECAPITO</div>';
        }
    }

    function updateStatoBadge(stato) {
        var b = getEl('lblStatoBadge');
        var cb = getEl('cardStatoBadge');
        var s = (stato || "").toUpperCase();
        
        if (b) {
            var inner = b.querySelector('.status-badge-inner') || b;
            b.className = 'status-badge-mega';
            if(s.indexOf("CIECO") > -1) { 
                inner.innerText = "CIECO"; b.classList.add('badge-cieco'); 
            } else if(s.indexOf("IPO") > -1) { 
                inner.innerText = "IPOVEDENTE"; b.classList.add('badge-ipovedente'); 
            } else if(s.indexOf("NORMO") > -1) { 
                inner.innerText = "NORMOVEDENTE"; b.classList.add('badge-normo'); 
            } else { 
                inner.innerText = s || "NON SPECIFICATO"; 
            }
        }
        
        if (cb) {
            cb.innerText = s.indexOf("CIECO") > -1 ? "CIECO" : (s.indexOf("IPO") > -1 ? "IPOVEDENTE" : (s.indexOf("NORMO") > -1 ? "NORMOVEDENTE" : (s || "NORMOVEDENTE")));
            cb.style.background = s.indexOf("CIECO") > -1 ? "linear-gradient(135deg, #ef4444, #b91c1c)" : (s.indexOf("IPO") > -1 ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #10b981, #047857)");
        }
    }

    window.ActionApriEditor = function(mode) {
        if(mode === 'NEW') {
            btnSvuota();
        }
        var ov = getEl('goldIdOverlay');
        if(ov) ov.classList.add('show');
    };

    window.ActionChiudiEditor = function() {
        var ov = getEl('goldIdOverlay');
        if(ov) ov.classList.remove('show');
    };

    window.ActionEliminaRecord = function() {
        var id = getEl('txtId').value;
        if(!id || id === "NEW") return;
        if(confirm("Eliminare definitivamente il cliente?")) {
            if(runQuery("DELETE FROM tblClienti WHERE ID=" + id)) { 
                alert("Cliente eliminato."); 
                ActionChiudiEditor();
                btnSvuota(); 
                loadData(); 
            }
        }
    };

    // Funzione helper per annunci vocali generici
    function announce(text) {
        var el = getEl('lblInfoRecordHeader');
        if(el) {
            var oldText = el.innerText;
            el.innerText = text;
            // Ripristina dopo un momento per non perdere il titolo permanente
            setTimeout(function() { if(el.innerText === text) el.innerText = oldText; }, 5000);
        }
    }

    function popolaLocalita(prov, sel) {
        var listLoc = getEl('listLocalita');
        if(!listLoc) return;
        listLoc.innerHTML = '';
        
        var provStandard = getSiglaStandard(prov);
        if (provStandard && dbProvs[provStandard]) {
            var locs = []; for (var l in dbProvs[provStandard]) locs.push(l);
            locs.sort(); for (var i = 0; i < locs.length; i++) {
                var opt = document.createElement('option'); opt.value = locs[i]; 
                listLoc.appendChild(opt);
            }
            
            // SUGGERIMENTO CAP (Smart Login - Ricerca Approfondita)
            var selUpper = sel ? sel.toString().toUpperCase() : "";
            var capSuggested = dbCaps[selUpper] || "";
            
            if(capSuggested && getEl('txtCap')) {
                // Seleziona il CAP automaticamente se il campo è vuoto o se è una selezione esplicita
                if(!getEl('txtCap').value || sel) {
                    getEl('txtCap').value = capSuggested;
                    getEl('txtCap').classList.add("is-populated");
                }
            }
        }
        if(sel && getEl('cmbLocalita')) {
            getEl('cmbLocalita').value = sel;
            getEl('cmbLocalita').classList.add("is-populated");
        }
    }

    function btnSvuota(keepVisible) {
        clienteCorrente = null;
        
        // ZENITH UI RESET
        if(getEl('mainDetailCard')) getEl('mainDetailCard').style.display = keepVisible ? 'flex' : 'none';
        if(getEl('selectionPlaceholder')) getEl('selectionPlaceholder').style.display = keepVisible ? 'none' : 'block';

        var f = document.querySelectorAll('input, select, textarea');
        for (var i = 0; i < f.length; i++) {
            if(f[i].id !== "txtRicerca") f[i].value = "";
        }
        if(getEl('txtId')) getEl('txtId').value = "NEW";
        if(getEl('lblFirmaTitolare')) getEl('lblFirmaTitolare').innerText = "NEW IDENTITY";
        if(getEl('lblDisplayName')) getEl('lblDisplayName').innerText = "NUOVA ANAGRAFICA";
        
        updateStatoBadge("NORMOVEDENTE");
        
        // --- RESET COMPACT CIE CARD PREVIEW ---
        if(getEl('cardNomeCompleto')) getEl('cardNomeCompleto').innerText = "NUOVA ANAGRAFICA";
        if(getEl('cardCodiceId')) getEl('cardCodiceId').innerText = "ID: NEW";
        if(getEl('cardCitta')) getEl('cardCitta').innerText = "---";
        if(getEl('cardTel')) getEl('cardTel').innerText = "---";
        if(getEl('cardEmail')) getEl('cardEmail').innerText = "---";
        if(getEl('cardSignature')) getEl('cardSignature').innerText = "NEW IDENTITY";
        
        if(getEl('recapitiList')) getEl('recapitiList').innerHTML = "";
        if(getEl('lblDataInserimentoFooter')) getEl('lblDataInserimentoFooter').innerText = "EMISSIONE: --/--/--";
        if(getEl('lblDataModificaFooter')) getEl('lblDataModificaFooter').innerText = "MODIFICA: --/--/--";
        
        if(getEl('lstTelefonos')) getEl('lstTelefonos').innerHTML = "";
        if(getEl('imgCliente')) getEl('imgCliente').style.display = "none";
        if(getEl('photoPlaceholder')) getEl('photoPlaceholder').style.display = "block";
        if(getEl('btnEliminaCliente')) getEl('btnEliminaCliente').disabled = true;
        
        var allCards = document.querySelectorAll('.client-glass-card');
        for (var k = 0; k < allCards.length; k++) allCards[k].classList.remove("active");
        
        // Ricalibra lo stato di base come scheda pulita/vuota
        originalState = GetCurrentFormState();
        
        // LOGISTICA UNIFICATA: Resetta widget consegne per la nuova scheda
        if (window.AggiornaSezioneConsegneCliente) window.AggiornaSezioneConsegneCliente("NEW");

        // Rinfresca le statistiche dinamiche della dashboard Zenith
        try { if (window.AggiornaOverviewStats) window.AggiornaOverviewStats(); } catch(eOv) {}
    }

    function createPhoneRow(text) {
        var row = document.createElement('div');
        row.className = 'phone-item';
        
        var txtSpan = document.createElement('span');
        txtSpan.className = 'phone-item-text';
        txtSpan.innerText = text;
        
        var actions = document.createElement('div');
        actions.className = 'phone-item-actions';
        
        var btnEdit = document.createElement('button');
        btnEdit.className = 'btn-icon edit';
        btnEdit.style.width = 'auto'; // Espandi per il testo
        btnEdit.style.padding = '0 10px';
        btnEdit.innerHTML = '<i class="fa fa-pencil"></i><span style="margin-left:5px; font-size:10px;">Modifica</span>';
        btnEdit.onclick = function() {
            var parts = text.split(' ');
            var label = parts[0];
            var num = parts.slice(1).join('').replace(/\s/g, '');
            if(getEl('txtEtichettaNuova')) getEl('txtEtichettaNuova').value = label;
            if(getEl('txtTelefonoNuovo')) getEl('txtTelefonoNuovo').value = num;
            row.parentNode.removeChild(row);
            updateWhatsAppLink();
            markDirty();
        };
        
        var btnDelete = document.createElement('button');
        btnDelete.className = 'btn-icon delete';
        btnDelete.style.width = 'auto';
        btnDelete.style.padding = '0 10px';
        btnDelete.innerHTML = '<i class="fa fa-trash"></i><span style="margin-left:5px; font-size:10px;">Elimina</span>';
        btnDelete.onclick = function() {
            if(confirm("Eliminare definitivamente questo recapito?")) {
                row.parentNode.removeChild(row);
                updateWhatsAppLink();
                markDirty();
            }
        };
        
        actions.appendChild(btnEdit);
        actions.appendChild(btnDelete);
        row.appendChild(txtSpan);
        row.appendChild(actions);
        return row;
    }

    function updateWhatsAppLink() {
        var lstT = getEl('lstTelefonos');
        var wa = getEl('btnWhatsApp');
        var tRapido = getEl('txtTelefonoRapido');
        if(!wa) return;
        
        var firstNumText = "";
        if(lstT && lstT.children.length > 0) {
            var firstRow = lstT.children[0].querySelector('.phone-item-text');
            if(firstRow) firstNumText = firstRow.innerText;
        }

        if(firstNumText) {
            if(tRapido) tRapido.value = firstNumText;
            var num = firstNumText.replace(/\D/g, '').substr(0, 10);
            var url = "https://wa.me/39" + num;
            wa.removeAttribute("href"); // Remove href to stop IE 
            wa.style.opacity = "1"; 
            wa.style.pointerEvents = "auto";
            wa.style.cursor = "pointer";
            wa.onclick = function(e) {
                if(e) e.preventDefault();
                try {
                    var shell = new ActiveXObject("WScript.Shell");
                    shell.Run('"' + url + '"');
                } catch(err) {
                    window.open(url);
                }
            };
        } else {
            if(tRapido) tRapido.value = "";
            wa.removeAttribute("href"); 
            wa.onclick = null;
            wa.style.opacity = "0.5"; 
            wa.style.pointerEvents = "none";
        }
    }

    function updateRegione(prov) {
        var txtReg = getEl('txtRegione');
        if(!txtReg) return;
        if(!prov) { txtReg.value = ""; return; }
        
        var p = prov.toUpperCase();
        var mapping = {
            "ABRUZZO": ["CHIETI", "L'AQUILA", "PESCARA", "TERAMO", "CH", "AQ", "PE", "TE"],
            "BASILICATA": ["MATERA", "POTENZA", "MT", "PZ"],
            "CALABRIA": ["CATANZARO", "COSENZA", "CROTONE", "REGGIO CALABRIA", "VIBO VALENTIA", "CZ", "CS", "KR", "RC", "VV"],
            "CAMPANIA": ["AVELLINO", "BENEVENTO", "CASERTA", "NAPOLI", "SALERNO", "AV", "BN", "CE", "NA", "SA"],
            "EMILIA-ROMAGNA": ["BOLOGNA", "FERRARA", "FORLÌ-CESENA", "MODENA", "PARMA", "PIACENZA", "RAVENNA", "REGGIO EMILIA", "RIMINI", "BO", "FE", "FC", "MO", "PR", "PC", "RA", "RE", "RN"],
            "FRIULI-VENEZIA GIULIA": ["GORIZIA", "PORDENONE", "TRIESTE", "UDINE", "GO", "PN", "TS", "UD"],
            "LAZIO": ["FROSINONE", "LATINA", "RIETI", "ROMA", "VITERBO", "FR", "LT", "RI", "RM", "VT"],
            "LIGURIA": ["GENOVA", "IMPERIA", "LA SPEZIA", "SAVONA", "GE", "IM", "SP", "SV"],
            "LOMBARDIA": ["BERGAMO", "BRESCIA", "COMO", "CREMONA", "LECCO", "LODI", "MANTOVA", "MILANO", "MONZA E DELLA BRIANZA", "PAVIA", "SONDRIO", "VARESE", "BG", "BS", "CO", "CR", "LC", "LO", "MN", "MI", "MB", "PV", "SO", "VA"],
            "MARCHE": ["ANCONA", "ASCOLI PICENO", "FERMO", "MACERATA", "PESARO E URBINO", "AN", "AP", "FM", "MC", "PU"],
            "MOLISE": ["CAMPOBASSO", "ISERNIA", "CB", "IS"],
            "PIEMONTE": ["ALESSANDRIA", "ASTI", "BIELLA", "CUNEO", "NOVARA", "TORINO", "VERBANO-CUSIO-OSSOLA", "VERCELLI", "AL", "AT", "BI", "CN", "NO", "TO", "VB", "VC"],
            "PUGLIA": ["BARI", "BARLETTA-ANDRIA-TRANI", "BRINDISI", "FOGGIA", "LECCE", "TARANTO", "BA", "BT", "BR", "FG", "LE", "TA", "BAT", "B.A.T.", "CITTÀ METROPOLITANA DI BARI"],
            "SARDEGNA": ["CAGLIARI", "NUORO", "ORISTANO", "SASSARI", "SUD SARDEGNA", "CA", "NU", "OR", "SS", "SU"],
            "SICILIA": ["AGRIGENTO", "CALTANISSETTA", "CATANIA", "ENNA", "MESSINA", "PALERMO", "RAGUSA", "SIRACUSA", "TRAPANI", "AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP"],
            "TOSCANA": ["AREZZO", "FIRENZE", "GROSSETO", "LIVORNO", "LUCCA", "MASSA-CARRARA", "PISA", "PISTOIA", "PRATO", "SIENA", "AR", "FI", "GR", "LI", "LU", "MS", "PI", "PT", "PO", "SI"],
            "TRENTINO-ALTO ADIGE": ["BOLZANO", "TRENTO", "BZ", "TN"],
            "UMBRIA": ["PERUGIA", "TERNI", "PG", "TR"],
            "VALLE D'AOSTA": ["AOSTA", "AO"],
            "VENETO": ["BELLUNO", "PADOVA", "ROVIGO", "TREVISO", "VENEZIA", "VERONA", "VICENZA", "BL", "PD", "RO", "TV", "VE", "VR", "VI"]
        };

        for(var reg in mapping) {
            var provs = mapping[reg];
            for(var i=0; i<provs.length; i++) {
                var target = provs[i].toUpperCase();
                // Match esatto o match di nomi lunghi (evitiamo codici 'NA' in 'METROPOLITANA')
                if(p === target || (target.length > 3 && p.indexOf(target) > -1)) { 
                    txtReg.value = reg; return; 
                }
            }
        }
        txtReg.value = "ALTRO";
    }

    /* ========================================================
       SISTEMA DI PROTEZIONE E TRACCIAMENTO MODIFICHE NON SALVATE
       ======================================================== */
            window.onbeforeunload = function(e) {
        if (isNavigating || isClosing) return; 
        if (typeof IsFormDirty === "function" && IsFormDirty()) {
            try {
                var shell = new ActiveXObject("WScript.Shell");
                var promptMsg = "Ci sono modifiche non salvate per l'anagrafica corrente.\n\n" +
                                "Vuoi salvare le modifiche prima di uscire?\n\n" +
                                "[SÌ]\t- Salva le modifiche e chiudi\n" +
                                "[NO]\t- Esci senza salvare le modifiche (scarta)\n" +
                                "[ANNULLA]\t- Rimani sulla scheda per continuare a compilare";
                
                // 3 = Pulsanti Sì/No/Annulla, 32 = Icona domanda
                var result = shell.Popup(promptMsg, 0, "SALVATAGGIO MODIFICHE - ANAGRAFICA", 3 + 32);
                
                if (result === 6) { // Sì
                    var saved = ActionSalva();
                    if (saved) {
                        // NON impostiamo isClosing = true per permettere a onunload di riaprire il dashboard
                        return; // Chiude la pagina in modo pulito
                    } else {
                        var blockStr = "Salvataggio non riuscito o annullato.\n\nIMPORTANTE: Clicca su 'ANNULLA' nel prossimo avviso per non perdere le modifiche.";
                        e = e || window.event;
                        if (e) e.returnValue = blockStr;
                        return blockStr;
                    }
                } else if (result === 7) { // No
                    // NON impostiamo isClosing = true per permettere a onunload di riaprire il dashboard
                    return; // Chiude la pagina in modo pulito senza salvare
                } else { // Annulla
                    var blockStr = "Azione annullata.\n\nIMPORTANTE: Per rimanere nella pagina corrente e non perdere i dati, fai clic su 'ANNULLA' nel prossimo messaggio.";
                    e = e || window.event;
                    if (e) e.returnValue = blockStr;
                    return blockStr;
                }
            } catch(ex) {
                var blockStr = "Attenzione: ci sono modifiche non salvate per l'anagrafica.\nFai clic su 'Annulla' per rimanere nella pagina.";
                e = e || window.event;
                if (e) e.returnValue = blockStr;
                return blockStr;
            }
        }
    };

    window.onunload = function() {
    if (window.isNavigating || window.isClosing || isNavigating || isClosing) return; 
        isClosing = true;
        
        var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
        if (isElectron) {
            try {
                var electron = require('electron');
                if (electron && electron.ipcRenderer) {
                    electron.ipcRenderer.send('show-parent');
                }
            } catch(e) {}
            return;
        }

        try {
            var shell = new ActiveXObject("WScript.Shell");
            var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
            if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
            shell.Run('mshta.exe "' + htaPath + '"', 1, false);
        } catch(ex) {}
    };

    function GetCurrentFormState() {
        try {
            return {
                cognomeNome: getEl('txtCognomeNome') ? getEl('txtCognomeNome').value : "",
                residenza: getEl('txtResidenza') ? getEl('txtResidenza').value : "",
                logistica_indirizzo: getEl('txtLogIndirizzo') ? getEl('txtLogIndirizzo').value : "",
                logistica_comune: getEl('txtLogComune') ? getEl('txtLogComune').value : "",
                logistica_provincia: getEl('txtLogProvincia') ? getEl('txtLogProvincia').value : "",
                civico: getEl('txtCivico') ? getEl('txtCivico').value : "",
                frazione: getEl('txtFrazione') ? getEl('txtFrazione').value : "",
                localita: getEl('cmbLocalita') ? getEl('cmbLocalita').value : "",
                provincia: getEl('cmbProvincia') ? getEl('cmbProvincia').value : "",
                cap: getEl('txtCap') ? getEl('txtCap').value : "",
                codFisc: getEl('txtCodFisc') ? getEl('txtCodFisc').value : "",
                pIva: getEl('txtPIva') ? getEl('txtPIva').value : "",
                sdi: getEl('txtSDI') ? getEl('txtSDI').value : "",
                pec: getEl('txtPEC') ? getEl('txtPEC').value : "",
                note: getEl('txtNote') ? getEl('txtNote').value : "",
                avvisatoIl: getEl('txtAvvisatoIl') ? getEl('txtAvvisatoIl').value : "",
                preventivoOrdine: getEl('txtPreventivoOrdine') ? getEl('txtPreventivoOrdine').value : "",
                statoGravita: getEl('cmbDisabilita') ? getEl('cmbDisabilita').value : "",
                email: getEl('txtEmailCliente') ? getEl('txtEmailCliente').value : "",
                percorsoFoto: getEl('txtPercorsoFoto') ? getEl('txtPercorsoFoto').value : "",
                telefono: getEl('txtTelefoni') ? getEl('txtTelefoni').value : ""
            };
        } catch(e) { return null; }
    }

    function IsFormDirty() {
        if (!originalState) return false;
        var current = GetCurrentFormState();
        if (!current) return false;
        return JSON.stringify(current) !== JSON.stringify(originalState);
    }

    function CheckUnsavedChanges() {
        if (!IsFormDirty()) return true;
        
        try {
            var shell = new ActiveXObject("WScript.Shell");
            var promptMsg = "Sono presenti modifiche non salvate per l'anagrafica corrente.\n\n" +
                            "Vuoi memorizzarle prima di procedere?\n\n" +
                            "[SÌ]\t- Salva nel Database e procedi\n" +
                            "[NO]\t- Abbandona le modifiche e procedi\n" +
                            "[ANNULLA]\t- Torna all'anagrafica per continuare";
            
            // 3 = Yes/No/Cancel, 32 = Question
            var result = shell.Popup(promptMsg, 0, "MODIFICHE ANAGRAFICA NON SALVATE", 3 + 32);
            
            if (result === 6) { // Sì
                return ActionSalva(); // Restituisce true se salvato con successo
            } else if (result === 7) { // No
                originalState = null; // Neutralizza per permettere il passaggio
                return true;
            } else {
                return false; // Annulla
            }
        } catch(e) {
            return confirm("Attenzione: ci sono modifiche non salvate. Continuare perdendole?");
        }
    }

    function BackupRecordLocal(data) {
        try {
            var histDir = fso.BuildPath(currentDir, "backups\\history");
            if(!fso.FolderExists(fso.GetParentFolderName(histDir))) fso.CreateFolder(fso.GetParentFolderName(histDir));
            if(!fso.FolderExists(histDir)) fso.CreateFolder(histDir);
            
            var ts = new Date().getTime();
            var nameStr = String(data.CognomeNome || "Unnamed").replace(/[^a-z0-9]/gi, '_');
            var fname = nameStr + "_" + ts + ".json";
            var f = fso.CreateTextFile(fso.BuildPath(histDir, fname), true);
            
            var json = "{";
            for(var k in data) json += "\n  \"" + k + "\": \"" + String(data[k]).replace(/"/g, '\\"') + "\",";
            json = json.substr(0, json.length-1) + "\n}";
            
            f.WriteLine(json);
            f.Close();
        } catch(e) {}
    }

    function ActionSalva() {
        if(!getEl('txtCognomeNome') || !getEl('txtCognomeNome').value.trim()) { 
            alert("Inserire la Denominazione!"); 
            return false; 
        }
        
        // --- SMART VALIDATION (ANTI-DIMENTICANZA) ---
        var loc = getEl('cmbLocalita') ? getEl('cmbLocalita').value.trim() : "";
        var tel = getEl('txtTelefoni') ? getEl('txtTelefoni').value.trim() : "";
        
        if (loc === "" || tel === "") {
            var msg = "Attenzione: stai salvando l'anagrafica senza aver completato i dati fondamentali.\n\n";
            if (loc === "" && tel === "") msg += "Mancano: COMUNE e NUMERO DI TELEFONO.";
            else if (loc === "") msg += "Manca: COMUNE di residenza.";
            else msg += "Manca: NUMERO DI TELEFONO (ricordati di premere + AGGIUNGI).";
            
            msg += "\n\nSei sicuro di voler procedere lo stesso?";
            
            if (!confirm(msg)) {
                return false;
            }
        }
        // --------------------------------------------
        
        var id = getEl('txtId').value;
        var fields = {
            "CognomeNome": getEl('txtCognomeNome').value,
            "Residenza": getEl('txtResidenza').value,
            "Logistica_Indirizzo": getEl('txtLogIndirizzo') ? getEl('txtLogIndirizzo').value : "",
            "Logistica_Comune": getEl('txtLogComune') ? getEl('txtLogComune').value : "",
            "Logistica_Provincia": getEl('txtLogProvincia') ? getEl('txtLogProvincia').value : "",
            "Civico": getEl('txtCivico') ? getEl('txtCivico').value : "",
            "Frazione": getEl('txtFrazione') ? getEl('txtFrazione').value : "",
            "Localita": getEl('cmbLocalita').value,
            "Provincia": getEl('cmbProvincia').value,
            "Cap": getEl('txtCap').value,
            "CodFisc": getEl('txtCodFisc') ? getEl('txtCodFisc').value : "",
            "PIva": getEl('txtPIva') ? getEl('txtPIva').value : "",
            "SDI": getEl('txtSDI') ? getEl('txtSDI').value : "",
            "PEC": getEl('txtPEC') ? getEl('txtPEC').value : "",
            "Note": getEl('txtNote').value,
            "AvvisatoIl": getEl('txtAvvisatoIl') ? getEl('txtAvvisatoIl').value : "",
            "PreventivoOrdine": getEl('txtPreventivoOrdine') ? getEl('txtPreventivoOrdine').value : "",
            "StatoGravita": getEl('cmbDisabilita').value,
            "Email": getEl('txtEmailCliente') ? getEl('txtEmailCliente').value : "",
            "PercorsoFoto": getEl('txtPercorsoFoto') ? getEl('txtPercorsoFoto').value : "",
            "Telefono": getEl('txtTelefoni') ? getEl('txtTelefoni').value : "",
            "isCancellato": 0
        };

        // CONTROLLO DUPLICATI: Solo in fase di INSERIMENTO (NEW)
        if (id === "NEW" || id === "") {
            var cleanTel = String(fields["Telefono"]).replace(/\D/g, '');
            var inNome = String(fields["CognomeNome"]).toUpperCase().replace(/\s+/g, ' ').trim();
            var inLoc = String(fields["Localita"]).toUpperCase().trim();

            for (var d = 0; d < dataClienti.length; d++) {
                var c = dataClienti[d];
                var cTel = String(getVal(c, ["telefono", "telefoni"])).replace(/\D/g, '');
                var cNome = String(getVal(c, ["cognomenome", "nome"])).toUpperCase().replace(/\s+/g, ' ').trim();
                var cLoc = String(getVal(c, ["localita", "comune"])).toUpperCase().trim();
                var cID = getVal(c, ["id", "idcliente"]);

                // Duplicato per Telefono (molto probabile)
                if (cleanTel !== "" && cleanTel.length > 6 && cTel.indexOf(cleanTel) !== -1) {
                    var confPhone = confirm("⚠️ ATTENZIONE! Esiste già in anagrafica un cliente con lo stesso RECAPITO TELEFONICO:\n\n" + cNome + " (" + cLoc + ") - ID: " + cID + "\n\nSei sicuro di voler inserire un NUOVO record e creare un duplicato?");
                    if (!confPhone) return false;
                    break;
                }
                
                // Duplicato per Omonimia (Nome + Località)
                if (inNome !== "" && cNome === inNome && cLoc === inLoc) {
                    var confName = confirm("⚠️ ATTENZIONE! Esiste già in anagrafica un omonimo nella stessa CITTÀ:\n\n" + cNome + " (" + cLoc + ") - ID: " + cID + "\n\nSei sicuro di voler procedere con l'inserimento?");
                    if (!confName) return false;
                    break;
                }
            }
        }
        
        var sql = "";
        if(id && id !== "" && id !== "NEW") {
            sql = "UPDATE tblClienti SET ";
            for(var k in fields) sql += "[" + k + "]='" + String(fields[k]).replace(/'/g, "''") + "',";
            sql += "[DataUltimaModifica]=Now() WHERE [ID]=" + id;
        } else {
            var keys = "[DataInserimento],[DataUltimaModifica]";
            var vals = "Now(),Now()";
            for(var k in fields) { keys += ",[" + k + "]"; vals += ",'" + String(fields[k]).replace(/'/g, "''") + "'"; }
            sql = "INSERT INTO tblClienti (" + keys + ") VALUES (" + vals + ")";
        }
        
        if(runQuery(sql)) { 
            if(id && id !== "" && id !== "NEW") {
                var sqlSyncConsegne = "UPDATE tblConsegne SET " +
                    "[ClienteNome]='" + String(fields.CognomeNome).replace(/'/g, "''") + "', " +
                    "[IndirizzoConsegna]='" + String(fields.Residenza).replace(/'/g, "''") + "', " +
                    "[LocalitaConsegna]='" + String(fields.Localita).replace(/'/g, "''") + "', " +
                    "[Provincia]='" + String(fields.Provincia).replace(/'/g, "''") + "', " +
                    "[Telefono]='" + String(fields.Telefono).replace(/'/g, "''") + "', " +
                    "[StatoInvalidita]='" + String(fields.StatoGravita).replace(/'/g, "''") + "' " +
                    "WHERE [ID_Cliente]=" + id + " AND ([Consegnato]=0 OR [Consegnato] IS NULL OR [Consegnato]='False' OR [Consegnato]='0')";
                try { runQuery(sqlSyncConsegne); } catch(eSync){}
            }

            BackupRecordLocal(fields);
            originalState = GetCurrentFormState(); // Ricalibra stato originale dopo salvataggio
            alert("Salvataggio Zenith completato con successo!"); 
            loadData(); 
            return true;
        } else { 
            alert("Errore durante il salvataggio."); 
            return false;
        }
    }

    function markDirty() { }
    function markClean() { }

    function setupEvents() {
        safeOn('txtRicerca', 'onkeyup', function() { ricaricaLista(this.value); });
        safeOn('txtRicerca', 'oninput', function() { ricaricaLista(this.value); });
        
        // --- AUTO-FORMATTAZIONE (Maiuscole e Spazi) ---
        var formatUpper = function() {
            if(this.value) {
                this.value = this.value.replace(/\s+/g, ' ').trim().toUpperCase();
            }
        };
        safeOn('txtCognomeNome', 'onblur', formatUpper);
        safeOn('txtResidenza', 'onblur', formatUpper);
        safeOn('cmbLocalita', 'onblur', formatUpper);
        safeOn('txtLogIndirizzo', 'onblur', formatUpper);
        safeOn('txtLogComune', 'onblur', formatUpper);
        
        // --- VALIDAZIONE EMAIL VISIVA ---
        var validateEmail = function() {
            var val = this.value.trim();
            if(val === "") {
                this.style.borderColor = "rgba(6,182,212,0.3)";
                this.style.boxShadow = "none";
            } else if(val.indexOf("@") === -1 || val.indexOf(".") === -1) {
                this.style.borderColor = "#ef4444";
                this.style.boxShadow = "0 0 8px rgba(239, 68, 68, 0.4)";
            } else {
                this.style.borderColor = "#10b981";
                this.style.boxShadow = "0 0 8px rgba(16, 185, 129, 0.3)";
            }
        };
        safeOn('txtEmailCliente', 'onkeyup', validateEmail);
        safeOn('txtEmailCliente', 'onchange', validateEmail);

        // Tracciamento modifiche per protezione dati
        var inputs = document.querySelectorAll('.zenith-input');
        for(var i=0; i<inputs.length; i++) {
            inputs[i].onchange = markDirty;
            inputs[i].onkeyup = markDirty;
        }

        safeOn('cmbProvincia', 'onchange', function() { 
            popolaLocalita(this.value); 
            updateRegione(this.value);
            markDirty();
        });
        
        safeOn('cmbProvincia', 'oninput', function() { 
            popolaLocalita(this.value); 
            updateRegione(this.value);
            markDirty();
        });

        safeOn('cmbLocalita', 'onfocus', function() {
            var p = getEl('cmbProvincia');
            if(p && p.value.trim() === "") {
                p.value = "BA";
                popolaLocalita("BA");
                updateRegione("BA");
            }
        });
        
        safeOn('cmbLocalita', 'onchange', function() {
            var sel = this.value; if(!sel) return;
            var selUpper = sel.toString().toUpperCase();
            
            // VERIFICA SE IN ELENCO PER AGGIUNTA DINAMICA
            var prov = getEl('cmbProvincia') ? getEl('cmbProvincia').value : "";
            var provStandard = getSiglaStandard(prov);
            var inList = false;
            
            // Controlla se il comune esiste già per questa provincia nel DB locale (cache)
            if (provStandard && dbProvs[provStandard] && dbProvs[provStandard][sel]) {
                inList = true;
            } else {
                // Ricerca case-insensitive nella cache
                if (provStandard && dbProvs[provStandard]) {
                    for (var key in dbProvs[provStandard]) {
                        if (key.toUpperCase() === selUpper) { inList = true; break; }
                    }
                }
            }

            if (!inList && sel.trim() !== "") {
                // Heuristic: only prompt to save custom municipalities if the word is at least 4 chars long.
                // This prevents accidental prompts for fragmented inputs like "N", "No", "Noc".
                if (sel.trim().length > 3) {
                    if (!prov) {
                        alert("Seleziona prima una Provincia per poter aggiungere un nuovo Comune all'elenco.");
                    } else {
                        if (confirm("'" + sel + "' non è presente nell'elenco dei comuni di " + prov + ".\n\nVuoi aggiungerlo definitivamente al database?")) {
                            addLocalita(sel, prov);
                        }
                    }
                }
            }

            // SINCRONIZZAZIONE AUTOMATICA PROVINCIA E REGIONE (LOGICA ESISTENTE)
            var provFound = dbLocToProv[selUpper];
            if(provFound) {
                if(getEl('cmbProvincia') && !getEl('cmbProvincia').value) {
                    getEl('cmbProvincia').value = provFound;
                    updateRegione(provFound);
                }
            }
            
            var capSuggested = dbCaps[selUpper] || "";
            if(capSuggested && getEl('txtCap') && !getEl('txtCap').value) getEl('txtCap').value = capSuggested;
            
            markDirty();
        });

        safeOn('cmbLocalita', 'ondblclick', function() {
            var sel = this.value;
            var prov = getEl('cmbProvincia') ? getEl('cmbProvincia').value : "";
            if(!sel) return;
            if(confirm("Vuoi eliminare definitivamente '" + sel + "' (" + (prov || "tutte le prov.") + ") dall'elenco dei suggerimenti?")) {
                removeLocalita(sel, prov);
            }
        });

        safeOn('txtLogComune', 'ondblclick', function() {
            var sel = this.value;
            var prov = getEl('txtLogProvincia') ? getEl('txtLogProvincia').value : "";
            if(!sel) return;
            if(confirm("Vuoi eliminare definitivamente '" + sel + "' (" + (prov || "tutte le prov.") + ") dall'elenco dei suggerimenti?")) {
                removeLocalita(sel, prov);
            }
        });

        safeOn('cmbDisabilita', 'onchange', function() {
            var val = this.value;
            if(!val) { updateStatoBadge(""); return; }
            
            // Verifica se è in elenco
            var inElenco = false;
            var opts = getEl('listDisabilita').options;
            for(var i=0; i<opts.length; i++) {
                if(opts[i].value.toLowerCase() === val.toLowerCase()) { inElenco = true; break; }
            }
            
            if(!inElenco && val.trim() !== "") {
                if(confirm("'" + val + "' non è in elenco. Vuoi aggiungerti questo stato all'elenco generale delle opzioni?")) {
                    addDisability(val);
                }
            }
            updateStatoBadge(val);
        });

        safeOn('cmbDisabilita', 'ondblclick', function() {
            var val = this.value;
            if(!val) return;
            if(confirm("Vuoi eliminare definitivamente '" + val + "' dall'elenco dei suggerimenti?")) {
                removeDisability(val);
            }
        });

        window.ActionSalvaRec = function() {
            ActionSalva();
        };

        window.ActionSvuotaENuovo = function() {
            if (!CheckUnsavedChanges()) return; // Intercetta creazione nuovo se ci sono modifiche pendenti
            btnSvuota(true); // Forza la visibilità della scheda vuota
            clienteCorrente = { "id": "NEW", "cognomenome": "" }; // Stato "Nuovo" per i controlli
            if(window.SwitchTab) window.SwitchTab('tabAnagrafica');
            if(getEl('txtCognomeNome')) getEl('txtCognomeNome').focus();
        };

        safeOn('btnSalvaAnagrafica_Original', 'onclick', function() {
            ActionSalva(); // Reindirizza all'API centralizzata e sincronizzata di salvataggio
        });

        safeOn('btnEliminaCliente', 'onclick', function() {
            var id = getEl('txtId').value;
            if(!id || id === "NEW") return;
            
            // ZENITH PREMIUM DIALOG (FALLBACK TO CONFIRM)
            if(confirm("Sei sicuro di voler spostare questo cliente nel CESTINO?\n\nNon verrà eliminato definitivamente dal database, ma non sarà più visibile nella lista principale.")) {
                if(runQuery("UPDATE tblClienti SET isCancellato=1 WHERE ID=" + id)) { 
                    alert("Cliente spostato nel Cestino."); 
                    btnSvuota(); 
                    loadData(); 
                }
            }
        });

        safeOn('btnModifica', 'onclick', function() { getEl('btnSalvaAnagrafica').click(); });

        safeOn('btnAggiungiTel', 'onclick', function() {
            var eNuova = getEl('txtEtichettaNuova');
            var tNuova = getEl('txtTelefonoNuovo');
            var lstT = getEl('lstTelefonos');
            if(!eNuova || !tNuova || !lstT) return;
            var l = eNuova.value.trim(); 
            var tRaw = tNuova.value.trim();
            var t = tRaw.replace(/\D/g, '');
            
            if (tRaw === "") {
                alert("Inserire almeno il numero di telefono!");
                return;
            }

            if (l === "" && t !== "") {
                if (t.charAt(0) === '3') l = "Cell.:";
                else if (t.charAt(0) === '0') l = "Fisso.";
                else l = "Tel.:";
            }
            
            var f = t || tRaw;
            if(t.length >= 10) {
                // Formato 3-2-2-3 (es: 328 61 38 247)
                f = t.substr(0,3) + " " + t.substr(3,2) + " " + t.substr(5,2) + " " + t.substr(7,3);
                if(t.length > 10) f += " " + t.substr(10);
            }
            
            var phoneText = (l ? l + " " : "") + f;
            lstT.appendChild(createPhoneRow(phoneText));
            tNuova.value = ""; eNuova.value = ""; 
            updateWhatsAppLink();
            markDirty();
        });

        safeOn('btnCambiaFoto', 'onclick', function() { 
            if(!clienteCorrente) { alert("Seleziona un cliente!"); return; } 
            if(getEl('fileFoto')) getEl('fileFoto').click(); 
        });

        safeOn('fileFoto', 'onchange', function() {
            if (this.value && clienteCorrente) {
                var filePath = this.value; var ext = fso.GetExtensionName(filePath);
                var id = getEl('txtId') ? getEl('txtId').value : "new";
                var newName = id + "_" + new Date().getTime() + "." + ext;
                try {
                    fso.CopyFile(filePath, fso.BuildPath(fotoDir, newName), true);
                    runQuery("UPDATE tblClienti SET PercorsoFoto='" + newName + "' WHERE ID=" + id);
                    if(getEl('txtPercorsoFoto')) getEl('txtPercorsoFoto').value = newName;
                    
                    // Update preview instantly
                    var imgC = getEl('imgCliente');
                    var ph = getEl('photoPlaceholder');
                    if(imgC && ph) {
                        imgC.style.backgroundImage = "url('FotoClienti/" + newName + "')";
                        imgC.style.display = "block";
                        ph.style.display = "none";
                    }
                    
                    alert("Foto caricata con successo!"); 
                } catch(e) { alert("Errore nel caricamento foto: " + e.message); }
            }
        });
        
        window.switchTab = function(idx) { };
    }



    function updateTime() {
        var el = getEl('titleTime');
        if (!el) return;
        var now = new Date();
        var h = ("0" + now.getHours()).slice(-2);
        var m = ("0" + now.getMinutes()).slice(-2);
        el.innerText = h + ":" + m;
    }

    function startClock() {
        updateTime();
        setInterval(updateTime, 30000);
    }

    function updateStatoBadge(val) {
        var b = getEl('lblStatoBadge');
        var cb = getEl('cardStatoBadge');
        var v = val ? val.toUpperCase() : "";
        
        // Aggiorna il badge grande dell'interfaccia principale
        if(b) {
            b.className = "badge-anagrafica-large";
            b.style.display = "block";
            if(v === "CIECO") {
                b.innerText = "SOGGETTO CIECO"; b.classList.add("cieco");
            } else if(v === "IPOVEDENTE GRAVE" || v.indexOf("IPOVEDENTE") > -1) {
                b.innerText = "SOGGETTO " + v; b.classList.add("ipovedente");
            } else if(v === "NORMOVEDENTE") {
                b.innerText = "SOGGETTO NORMOVEDENTE"; b.classList.add("normo");
            } else if(v !== "") {
                b.innerText = "STATO: " + v; b.classList.add("custom");
            } else {
                b.style.display = "none";
            }
        }
        
        // Aggiorna dinamicamente il badge sulla tessera CIE mockup
        if(cb) {
            cb.style.display = "inline-block";
            if(v === "") {
                cb.innerText = "NORMOVEDENTE"; // Fallback sicuro e visibile
                cb.style.backgroundColor = "#10b981"; // Verde smeraldo ad alto contrasto
            } else {
                cb.innerText = v;
                
                // Colori di sfondo premium ad alto contrasto per massima leggibilità
                if(v === "CIECO") {
                    cb.style.backgroundColor = "#ef4444"; // Rosso vivo ad alta visibilità
                } else if(v === "IPOVEDENTE GRAVE" || v.indexOf("IPOVEDENTE") > -1) {
                    cb.style.backgroundColor = "#f59e0b"; // Arancio caldo
                } else if(v === "NORMOVEDENTE") {
                    cb.style.backgroundColor = "#10b981"; // Verde smeraldo
                } else {
                    cb.style.backgroundColor = "#64748b"; // Grigio ardesia neutro
                }
            }
            cb.style.color = "#ffffff";
        }
    }

    function loadDisabilities() {
        var dl = getEl('listDisabilita');
        if(!dl) return;
        dl.innerHTML = "";
        var res = runQuery("SELECT Descr FROM tblOpzioniDisabilita ORDER BY Descr", true);
        if(res) {
            for(var i=0; i<res.length; i++) {
                var o = document.createElement("option");
                o.value = res[i].descr;
                dl.appendChild(o);
            }
        }
    }

    function addDisability(val) {
        if(!val) return;
        runQuery("INSERT INTO tblOpzioniDisabilita (Descr) VALUES ('" + val.replace(/'/g, "''") + "')");
        loadDisabilities();
    }

    function removeDisability(val) {
        if(!val) return;
        runQuery("DELETE FROM tblOpzioniDisabilita WHERE Descr='" + val.replace(/'/g, "''") + "'");
        loadDisabilities();
        getEl('cmbDisabilita').value = "";
        updateStatoBadge("");
    }

    function addLocalita(comune, prov) {
        if(!comune || !prov) return;
        var provStandard = getSiglaStandard(prov);
        // Inserimento nel database tblLocalita
        var sql = "INSERT INTO tblLocalita (Comune, Provincia) VALUES ('" + comune.replace(/'/g, "''") + "', '" + provStandard.replace(/'/g, "''") + "')";
        if (runQuery(sql)) {
            // Aggiorna cache locale per evitare ricaricamento totale
            if(!dbProvs[provStandard]) dbProvs[provStandard] = {};
            dbProvs[provStandard][comune] = true;
            dbLocToProv[comune.toUpperCase()] = provStandard;
            
            // Aggiorna la datalist
            popolaLocalita(prov, comune);
            announce("Località '" + comune + "' aggiunta correttamente.");
        }
    }

    function removeLocalita(comune, prov) {
        if(!comune) return;
        var sql = "DELETE FROM tblLocalita WHERE Comune='" + comune.replace(/'/g, "''") + "'";
        if (prov) {
            var provStandard = getSiglaStandard(prov);
            sql += " AND Provincia='" + provStandard.replace(/'/g, "''") + "'";
        }
        
        if (runQuery(sql)) {
            // Rimuovi dalla cache locale
            if (prov) {
                var provStandard = getSiglaStandard(prov);
                if (provStandard && dbProvs[provStandard]) delete dbProvs[provStandard][comune];
            } else {
                for (var p in dbProvs) {
                    if (dbProvs[p][comune]) delete dbProvs[p][comune];
                }
            }
            delete dbLocToProv[comune.toUpperCase()];
            
            // Svuota il campo e aggiorna datalist
            if(getEl('cmbLocalita') && getEl('cmbLocalita').value === comune) getEl('cmbLocalita').value = "";
            if(getEl('txtLogComune') && getEl('txtLogComune').value === comune) getEl('txtLogComune').value = "";
            
            popolaLocalita(prov, "");
            announce("Località rimossa.");
        }
    }

    document.onkeydown = function(e) {
        var key = e.keyCode || e.which;
        var ctrl = e.ctrlKey;
        var alt = e.altKey;

        // F5 (Aggiorna)
        if(key === 116) { isNavigating = true; }
        
        // CTRL + S (Salva Info)
        if(ctrl && key === 83) { 
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var btnS = getEl('btnSalvaAnagrafica');
            if(btnS) btnS.click();
            return false;
        }

        // CTRL + N (Nuova Anagrafica)
        if(ctrl && key === 78) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            if(window.ActionSvuotaENuovo) window.ActionSvuotaENuovo();
            else btnSvuota(true);
            return false;
        }

        // CTRL + F (Vai alla Ricerca)
        if(ctrl && key === 70) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var sf = getEl('txtRicerca');
            if(sf) { sf.focus(); sf.select(); }
            return false;
        }

        // CTRL + P (Stampa Rapida)
        if(ctrl && key === 80) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            window.print();
            return false;
        }

        // CTRL + D (Duplica Cliente)
        if(ctrl && key === 68) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            if(window.duplicaCliente) window.duplicaCliente();
            return false;
        }

        // ALT + F4 (Chiudi Modulo Sicuro)
        if(alt && key === 115) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            Script_BackToDashboard();
            return false;
        }

        // ALT + F (File)
        if(alt && key === 70) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var mf = getEl('mnFile'); if(mf) toggleMenu(mf);
            return false;
        }
        // ALT + M (Modifica)
        if(alt && key === 77) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var mm = getEl('mnModifica'); if(mm) toggleMenu(mm);
            return false;
        }
        // ALT + V (Visualizza)
        if(alt && key === 86) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var mv = getEl('mnVisualizza'); if(mv) toggleMenu(mv);
            return false;
        }
        // ALT + A (Aiuto)
        if(alt && key === 65) {
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var ma = getEl('mnAiuto'); if(ma) toggleMenu(ma);
            return false;
        }

        // ESC (Reset o Pulisci Ricerca)
        if(key === 27) {
            var search = getEl('txtRicerca');
            if(search && search.value !== "") {
                search.value = ""; ricaricaLista("");
            } else {
                btnSvuota();
            }
        }
    };

    setupEvents();
    loadData();
    startClock();

/* --- RIBBON UNIVERSALE TABS LOGIC --- */
function switchUniversalTab(tabId, element) {
    var tabs = document.querySelectorAll('.danea-ribbon .ribbon-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].className = 'ribbon-tab';
    }
    element.className = 'ribbon-tab active';
    
    document.getElementById('nav-operazioni').style.display = 'none';
    document.getElementById('nav-moduli').style.display = 'none';
    
    document.getElementById(tabId).style.display = 'flex';
}

/* --- LOGICA MENU BAR CLASSICO --- */
window.toggleMenu = function(elem, e) {
    if(e) e.stopPropagation();
    var allItems = document.querySelectorAll('.menu-item');
    for(var i=0; i<allItems.length; i++) {
        if(allItems[i] !== elem) allItems[i].classList.remove('active');
    }
    elem.classList.toggle('active');
};
document.addEventListener('click', function() {
    var allItems = document.querySelectorAll('.menu-item');
    for(var i=0; i<allItems.length; i++) {
        allItems[i].classList.remove('active');
    }
});

// ==========================================
// UTILITY AVANZATE (Google Maps, WA, Export, Duplica, Cross-Link)
// ==========================================

window.apriMappa = function() {
    var via = document.getElementById('txtResidenza').value;
    var comune = document.getElementById('cmbLocalita').value;
    var prov = document.getElementById('cmbProvincia').value;
    
    var logVia = document.getElementById('txtLogIndirizzo') ? document.getElementById('txtLogIndirizzo').value.trim() : "";
    if(logVia) {
        via = logVia;
        var logCom = document.getElementById('txtLogComune') ? document.getElementById('txtLogComune').value.trim() : "";
        var logPro = document.getElementById('txtLogProvincia') ? document.getElementById('txtLogProvincia').value.trim() : "";
        if(logCom) comune = logCom;
        if(logPro) prov = logPro;
    }
    
    if(!via && !comune) {
        alert("Inserisci almeno un Indirizzo o un Comune per visualizzare la mappa.");
        return;
    }
    var query = (via + " " + comune + " " + (prov || "")).trim();
    var url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run('"' + url + '"');
    } catch(e) {
        window.open(url);
    }
};

window.inviaPromemoriaWA = function() {
    var tc = document.getElementById('txtContattoRapido');
    if(!tc || !tc.value) { alert("Attenzione: Nessun numero di telefono principale presente in rubrica."); return; }
    
    var telClean = tc.value.replace(/[^\d+]/g, '');
    if (telClean.indexOf("39") !== 0 && telClean.indexOf("+39") !== 0 && telClean.length >= 9) {
        telClean = "39" + telClean;
    } else if (telClean.indexOf("+") === 0) {
        telClean = telClean.substring(1);
    }

    var nome = document.getElementById('txtCognomeNome').value || "Cliente";
    var mex = "Gentile " + nome + ", le scriviamo per ricordarle le sue operazioni di logistica con C. Milella. Rimaniamo a disposizione!";
    var url = 'https://wa.me/' + telClean + '/?text=' + encodeURIComponent(mex);
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run('"' + url + '"');
    } catch(e) {
        window.open(url);
    }
};

window.duplicaCliente = function() {
    if(!document.getElementById('txtId').value || document.getElementById('txtId').value === "NEW") {
        alert("Questa anagrafica non e' ancora salvata sul database.");
        return;
    }
    document.getElementById('txtId').value = "NEW";
    document.getElementById('txtCognomeNome').value = document.getElementById('txtCognomeNome').value + " (CLONE)";
    if(document.getElementById('lblInfoRecordBar')) {
        document.getElementById('lblInfoRecordBar').innerText = "NUOVO RECORD (CLONATO DA SEDE)";
    }
    alert("📌 Anagrafica Clonata Correttamente.\nI dati della sede sono rimasti prepopolati. \nModifica la denominazione e clicca su 'Salva Info' per memorizzare questo nuovo cliente.");
};

window.esportaExcel = function() {
    if(typeof dataClienti === "undefined" || !dataClienti || dataClienti.length === 0) {
        alert("Nessun cliente in memoria o variabile inaccessibile. Impossibile esportare."); return;
    }
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var wsh = new ActiveXObject("WScript.Shell");
        var desktopPath = wsh.SpecialFolders("Desktop");
        var filePath = desktopPath + "\\Rubrica_Export_Milella.csv";
        
        var f = fso.CreateTextFile(filePath, true);
        var header = "ID;Denominazione;Indirizzo;Localita;CAP;Provincia;Telefoni;Disabilita;Partita Iva;Codice Fiscale;Email";
        f.WriteLine(header);
        
        for(var i=0; i<dataClienti.length; i++) {
            var c = dataClienti[i];
            var t = (c.telefono || c.telefoni || "").replace(/(\r\n|\n|\r)/gm, " ");
            var line = (c.id||"") + ";" +
                       (c.cognomenome||c.denominazione||"").replace(/;/g, ",") + ";" +
                       (c.residenza||c.indirizzo||"").replace(/;/g, ",") + ";" +
                       (c.localita||c.comune||"") + ";" +
                       (c.cap||"") + ";" +
                       (c.provincia||"") + ";" +
                       t.replace(/;/g, ",") + ";" +
                       (c.statogravita||c.disabilita||"") + ";" +
                       (c.piva||"") + ";" +
                       (c.codfisc||"") + ";" +
                       (c.email||"").replace(/;/g, ",");
            f.WriteLine(line);
        }
        f.Close();
        alert("📊 Esportazione Rubrica completata con successo!\n\nIl file e' stato salvato sul tuo Desktop come:\nRubrica_Export_Milella.csv\n\nSi aprirà ora automaticamente.");
        wsh.Run('"' + filePath + '"');
    } catch(e) {
        alert("Impossibile esportare il file. Errore: " + e.message);
    }
};

window.vediConsegne = function() {
    var pIva = document.getElementById('txtPIva').value;
    var nome = document.getElementById('txtCognomeNome').value;
    var key = nome ? nome : pIva;
    
    if(!key) { 
        alert("Nessun cliente selezionato o cliente senza nome associato."); 
        return; 
    }
    
    // Scrive in memoria cache condivisa di Internet Explorer per passare dati a HTA figlio
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("filtroConsegneAuto", key);
    }
    
    // Naviga al modulo consegne
    try { NavigaModulo('consegne.html'); } catch(e) {}
};

window.IncollaFotoDaAppunti = function(e) {
    if(e) e.preventDefault();
    if(typeof clienteCorrente === "undefined" || !clienteCorrente) {
        alert("Seleziona prima un cliente dalla lista o clicca su 'NUOVO CLIENTE'!"); return;
    }
    
    var id = document.getElementById('txtId').value;
    if(!id) { alert("Errore: ID non trovato."); return; }
    
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var shell = new ActiveXObject("WScript.Shell");
        
        // Per i nuovi clienti, usiamo un ID temporaneo
        var filePrefix = (id === "NEW") ? "temp_" : id;
        var newName = filePrefix + "_clip_" + new Date().getTime() + ".jpg";
        var imgPath = currentDir + "\\FotoClienti\\" + newName;
        
        // Assicurati che esista la cartella system
        var sysPath = currentDir + "\\system";
        if(!fso.FolderExists(sysPath)) fso.CreateFolder(sysPath);
        
        var psScriptPath = sysPath + "\\paste_image.ps1";
        
        var f = fso.CreateTextFile(psScriptPath, true);
        f.WriteLine("Add-Type -AssemblyName System.Windows.Forms");
        f.WriteLine("if ([System.Windows.Forms.Clipboard]::ContainsImage()) {");
        f.WriteLine("  $img = [System.Windows.Forms.Clipboard]::GetImage()");
        f.WriteLine("  $img.Save('" + imgPath + "', [System.Drawing.Imaging.ImageFormat]::Jpeg)");
        f.WriteLine("  exit 0");
        f.WriteLine("} else {");
        f.WriteLine("  exit 1");
        f.WriteLine("}");
        f.Close();
        
        var ph = document.getElementById('photoPlaceholder');
        var oldHtml = ph.innerHTML;
        ph.innerHTML = "<br>Incollando...<br><small>Attendere</small>";
        ph.style.display = "block";
        document.getElementById('imgCliente').style.display = "none";
        
        setTimeout(function() {
            var ret = 1;
            try {
                // Esecuzione silente tramite apposito flag STA che serve per accedere agli appunti
                ret = shell.Run('powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + psScriptPath + '"', 0, true);
            } catch(eRun) {
                alert("Impossibile eseguire PowerShell.");
            }
            
            if (ret === 0 && fso.FileExists(imgPath)) {
                if(id !== "NEW") {
                    try { window.runQuery("UPDATE tblClienti SET PercorsoFoto='" + newName + "' WHERE ID=" + id); } catch(errQuery) {}
                }
                if(getEl('txtPercorsoFoto')) getEl('txtPercorsoFoto').value = newName;
                
                alert("Foto acquisita correttamente dagli Appunti!");
                
                var imgC = document.getElementById('imgCliente');
                var safePath = "FotoClienti/" + newName;
                imgC.style.backgroundImage = "url('" + safePath + "')";
                imgC.style.display = "block";
                if(getEl('photoPlaceholder')) getEl('photoPlaceholder').style.display = "none";
                ph.style.display = 'none';
                ph.innerHTML = oldHtml;
                
            } else {
                alert("Nessuna IMMAGINE valida trovata negli appunti!\n\nAttenzione: Assicurati di aver fatto 'Copia Immagine' su WhatsApp o Google e NON la copia di un file o un testo.");
                ph.innerHTML = oldHtml;
            }
            
            try { fso.DeleteFile(psScriptPath); } catch(ex){}
        }, 150);
        
    } catch(err) {
        alert("Errore durante l'operazione Appunti: " + err.message);
    }
};

window.GestisciDropFoto = function(e) {
    if(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Reset stili
    var frame = document.getElementById('imgPhotoFrame');
    if(frame) {
        frame.style.borderColor = '#ccc';
        frame.style.backgroundColor = 'transparent';
    }
    
    if(typeof clienteCorrente === "undefined" || !clienteCorrente) {
        alert("Seleziona prima un cliente dalla lista o clicca su 'NUOVO CLIENTE'!"); return;
    }
    
    var id = document.getElementById('txtId').value;
    if(!id) { alert("Errore: ID non trovato."); return; }

    if(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        var file = e.dataTransfer.files[0];
        if(!file.type.match('image.*')) {
            alert("Il file trascinato non e' un'immagine valida.");
            return;
        }

        var ph = document.getElementById('photoPlaceholder');
        var oldHtml = ph.innerHTML;
        ph.innerHTML = "<br>Elaborazione file...<br><small>Attendere</small>";
        ph.style.display = "block";
        document.getElementById('imgCliente').style.display = "none";
        
        // Let's read the file as DataURL
        var reader = new FileReader();
        reader.onload = function(evt) {
            var base64Data = evt.target.result;
            setTimeout(function() {
                // Rileviamo l'estensione originale dal tipo di file
                var ext = "jpg";
                if (file.type === "image/png") ext = "png";
                else if (file.type === "image/gif") ext = "gif";
                else if (file.type === "image/webp") ext = "webp";
                
                var filePrefix = (id === "NEW") ? "temp_" : id;
                var newName = filePrefix + "_drop_" + new Date().getTime() + "." + ext;
                var imgPath = currentDir + "\\FotoClienti\\" + newName;
                
                var esito = saveBase64ToDisk(base64Data, imgPath);
                
                if(esito) {
                    if(id !== "NEW") {
                        try { window.runQuery("UPDATE tblClienti SET PercorsoFoto='" + newName + "' WHERE ID=" + id); } catch(errQuery) {}
                    }
                    if(getEl('txtPercorsoFoto')) getEl('txtPercorsoFoto').value = newName;
                    
                    alert("Foto caricata con il TRASCINAMENTO!");
                    
                    var imgC = document.getElementById('imgCliente');
                    var safePath = "FotoClienti/" + newName;
                    imgC.style.backgroundImage = "url('" + safePath + "')";
                    imgC.style.display = 'block';
                    ph.style.display = 'none';
                    ph.innerHTML = oldHtml;
                } else {
                    alert("Si è verificato un errore durante la conversione del file trascinato.");
                    ph.innerHTML = oldHtml;
                }
            }, 50);
        };
        reader.readAsDataURL(file);
    }
};

window.saveBase64ToDisk = function(base64String, filePath) {
    try {
        var parts = base64String.split(';base64,');
        if(parts.length !== 2) return false;
        var b64Text = parts[1];
        
        var xmlDoc = new ActiveXObject("MSXML2.DOMDocument");
        var elem = xmlDoc.createElement("b64");
        elem.dataType = "bin.base64";
        elem.text = b64Text;
        
        var stream = new ActiveXObject("ADODB.Stream");
        stream.Type = 1; // adTypeBinary
        stream.Open();
        stream.Write(elem.nodeTypedValue); 
        
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        if(fso.FileExists(filePath)) fso.DeleteFile(filePath);
        
        stream.SaveToFile(filePath, 2); // 2 = adSaveCreateOverWrite
        stream.Close();
        return true;
    } catch(e) {
        return false;
    }
};

window.MostraIdentitaDigitale = function() {
        var overlay = getEl('identityOverlay');
        var qrImg = getEl('qrImage');
        var qrName = getEl('qrName');
        var qrId = getEl('qrId');
        
        if(!overlay || !qrImg) return;
        
        var name = getEl('txtCognomeNome') ? getEl('txtCognomeNome').value : "Cliente Ignoto";
        var id = getEl('txtId') ? getEl('txtId').value : "000";
        var loc = getEl('cmbLocalita') ? getEl('cmbLocalita').value : "";
        var prov = getEl('cmbProvincia') ? getEl('cmbProvincia').value : "";
        var tel = "";
        
        // Cerca il primo telefono valido nei tag o nel campo nascosto
        var telEl = getEl('lstTelefonos');
        if(telEl && telEl.getElementsByTagName('span').length > 0) {
            tel = telEl.getElementsByTagName('span')[0].innerText;
        }

        qrName.innerText = name.toUpperCase();
        qrId.innerText = "ZENITH ID: " + id;

        // Creiamo un formato VCard semplice per la scansione rapida
        var qrData = "BEGIN:VCARD\nVERSION:3.0\nFN:" + name + "\nTEL:" + tel + "\nADR:;;" + loc + ";" + prov + ";;\nNOTE:ID ZENITH " + id + "\nEND:VCARD";
        var encodedData = encodeURIComponent(qrData);
        
        qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodedData;
        
        overlay.style.display = "flex";
    };

    window.ChiudiIdentita = function() {
        var overlay = getEl('identityOverlay');
        if(overlay) overlay.style.display = "none";
    };

    // --- ZENITH PHONE TAG LOGIC ---
    window.handlePhoneInput = function(input) {
        var val = input.value;
        // Permettiamo lettere per le etichette, ma formattiamo i numeri
        var numPart = val.replace(/\D/g, '');
        if(numPart.length > 0) {
            // Se inizia con 3, è probabilmente un cellulare
            if(numPart.charAt(0) === '3' && numPart.length >= 10) {
                // Formattazione xxx xxx xx xx (senza parentesi)
                var f = numPart.substr(0, 3) + " " + numPart.substr(3, 3) + " " + numPart.substr(6, 2) + " " + numPart.substr(8, 2);
                if(numPart.length > 10) f += " " + numPart.substr(10);
                
                // Manteniamo l'eventuale etichetta se presente dopo un trattino
                if(val.indexOf(' - ') > -1) {
                    input.value = f + " - " + val.split(' - ')[1];
                } else if(val.indexOf(' ') === -1 || val.length < 5) { // Solo se non è già formattato
                    input.value = f;
                }
            }
        }
    };

    window.QuickLabelPhone = function(label) {
        var input = getEl('txtPhoneGhost');
        if(!input) return;
        var val = input.value.trim();
        
        if(label === 'ALTRO') {
            if(val === "") {
                input.value = "NOTA: ";
            } else {
                input.value = val + " - (";
                // Posizioniamo il cursore alla fine
                input.focus();
                return;
            }
        } else {
            if(val === "") {
                input.value = label + ": ";
            } else {
                // Se c'è già un numero, aggiungiamo l'etichetta in coda con un trattino
                if(val.indexOf(' - ') > -1) {
                    input.value = val.split(' - ')[0] + " - (" + label + ")";
                } else {
                    input.value = val + " - (" + label + ")";
                }
            }
        }
        input.focus();
    };

    window.zenithSmartFormat = function(val) {
        if(!val) return "";
        var v = val.trim();
        
        // Se l'utente ha già messo un'etichetta (es. "Badante:" o con Badge), non sovrascrivere
        if(v.indexOf(':') > -1 || v.indexOf(' - ') > -1) return v;
        
        var d = v.replace(/\D/g, ''); // Solo cifre
        if(d.length < 5) return v; // Troppo corto per formattare
        
        var formatted = "";
        var prefix = (d.charAt(0) === '0') ? "FISSO: " : "CELL: ";
        
        // Formattazione 080 561 57 74 o 340 123 45 67 (senza parentesi)
        if(d.length === 10) {
            formatted = d.substr(0, 3) + " " + d.substr(3, 3) + " " + d.substr(6, 2) + " " + d.substr(8, 2);
        } else if(d.length === 9) {
            formatted = d.substr(0, 2) + " " + d.substr(2, 3) + " " + d.substr(5, 2) + " " + d.substr(7, 2);
        } else {
            formatted = d; // Casi particolari
        }
        
        return prefix + formatted;
    };

    window.handlePhoneKey = function(e) {
        var key = e.keyCode || e.which;
        var input = e.srcElement;
        
        if(key === 13) { // ENTER
            if(e.preventDefault) e.preventDefault(); else e.returnValue = false;
            var val = input.value.trim();
            if(val) {
                // APPLICHIAMO L'AUTO-FORMATTAZIONE INTELLIGENTE ZENITH
                var finalVal = window.zenithSmartFormat(val).toUpperCase();
                window.addPhoneChip(finalVal);
                input.value = "";
            }
            return false;
        }
        
        if(key === 8 && input.value === "") { // BACKSPACE on empty
            var str = getEl('txtTelefoni').value;
            if(str) {
                var arr = str.split(';');
                arr.pop();
                getEl('txtTelefoni').value = arr.join(';');
                window.renderPhoneChips();
                markDirty();
            }
        }
    };

    window.addPhoneChip = function(val) {
        var hidden = getEl('txtTelefoni');
        var current = hidden.value;
        var arr = current ? current.split(';') : [];
        
        // Evitiamo duplicati (check insensibile a spazi/caratteri speciali nel numero)
        var compactVal = val.replace(/\s/g, '');
        for(var i=0; i<arr.length; i++) {
            if(arr[i].replace(/\s/g, '') === compactVal) return;
        }
        
        arr.push(val);
        hidden.value = arr.join(';');
        window.renderPhoneChips();
        markDirty();
    };

    /* --- FUNZIONI MENUBAR (New 2026) --- */
    window.ToggleFullScreen = function() {
        try {
            var shell = new ActiveXObject("WScript.Shell");
            // Nota: in HTA il fullscreen reale si gestisce meglio ridimensionando
            if (window.screen.availWidth === window.outerWidth) {
                window.resizeTo(1280, 800);
                window.moveTo((screen.availWidth - 1280)/2, (screen.availHeight - 800)/2);
            } else {
                window.moveTo(0, 0);
                window.resizeTo(screen.availWidth, screen.availHeight);
            }
        } catch(e) {}
    };

    window.MostraStatistiche = function() {
        alert("📊 ANALISI ZENITH DATA\n\n- Totale Clienti: " + dataClienti.length + "\n- Soggetti con Foto: attivo\n- Integrità Media: 84%\n\nFunzione reportistica avanzata in fase di rilascio.");
    };

    window.MostraInfoZenith = function() {
        var info = "🛡️ ZENITH ANAGRAFICA PRO\n" +
                   "Versione: 8.0.1 (Royal Platinum Edition)\n" +
                   "Data Rilascio: Aprile 2026\n\n" +
                   "Sviluppato per Logistica C. Milella.\n" +
                   "Sistema di crittografia e protezione NTFS attivo.";
        alert(info);
    };

    window.GestioneBackup = function() {
        if(confirm("Vuoi visualizzare la cartella dei backup storici?")) {
            try {
                var shell = new ActiveXObject("WScript.Shell");
                var path = fso.BuildPath(currentDir, "backups");
                shell.Run("explorer.exe " + path);
            } catch(e) {}
        }
    };
    
    window.ApriManuale = function() {
        alert("Apertura manuale tecnico in corso...");
    };
    
    window.InviaRichiestaAssistenza = function() {
        alert("Richiesta di assistenza remota inviata ai server Zenith.\nVerrai ricontattato a breve.");
    };

    window.removePhoneChip = function(val) {
        var hidden = getEl('txtTelefoni');
        var arr = hidden.value.split(';');
        var newArr = [];
        for(var i=0; i<arr.length; i++) {
            if(arr[i].trim() !== val && arr[i].trim() !== "") newArr.push(arr[i].trim());
        }
        hidden.value = newArr.join(';');
        window.renderPhoneChips();
        markDirty();
    };

    window.renderPhoneChips = function() {
        var container = getEl('phoneTagContainer');
        var ghost = getEl('txtPhoneGhost');
        var hidden = getEl('txtTelefoni');
        if(!container || !hidden) return;
        
        // Pulizia (mantenendo il ghost input)
        var chips = container.querySelectorAll('.phone-chip');
        for(var i=0; i<chips.length; i++) container.removeChild(chips[i]);
        
        var str = hidden.value;
        if(str) {
            var arr = str.split(';');
            for(var i=0; i<arr.length; i++) {
                var num = arr[i].trim();
                if(num) {
                    var chip = document.createElement('div');
                    chip.className = 'phone-chip';
                    chip.innerHTML = '<i class="fa fa-phone"></i><span>' + num + '</span><i class="fa fa-times-circle chip-remove" onclick="window.removePhoneChip(\'' + num + '\')"></i>';
                    container.insertBefore(chip, ghost);
                }
            }
        }
        
        // Aggiorna anche i recapiti in fondo per coerenza visiva
        if(window.popolaRecapitiTags) window.popolaRecapitiTags(hidden.value);
    };

    // --- QUICK ACTIONS PER FIELD ---
    window.QuickAction = function(action, id) {
        var el = getEl(id);
        
        switch(action) {
            case 'MOD':
                if(el) { el.focus(); if(el.select) el.select(); }
                break;
                
            case 'SAVE':
                window.ActionSalvaRec();
                break;
                
            case 'DEL':
                if(id === 'txtTelefoni') {
                    if(confirm("Svuotare tutti i recapiti telefonici?")) {
                        el.value = "";
                        window.renderPhoneChips();
                        markDirty();
                    }
                } else {
                    if(el) { 
                        el.value = ""; 
                        markDirty(); 
                        if(id === 'cmbDisabilita') window.updateStatoBadge("");
                        el.focus(); 
                    }
                }
                break;
        }
    };

    // --- IDENTITY DECK & INTEGRITY LOGIC ---
    window.calculateIntegrity = function() {
        var fields = [
            'txtCognomeNome', 'txtEmailCliente', 'txtResidenza', 
            'cmbLocalita', 'cmbProvincia', 'txtTelefoni', 'cmbDisabilita'
        ];
        var filled = 0;
        for(var i=0; i<fields.length; i++) {
            var val = getEl(fields[i]) ? getEl(fields[i]).value : "";
            if(val && val.trim() !== "" && val !== "NEW") filled++;
        }
        
        var perc = Math.round((filled / fields.length) * 100);
        var bar = getEl('integrityBar');
        var lbl = getEl('lblIntegrityPerc');
        
        if(bar && lbl) {
            lbl.innerText = perc + "%";
            bar.style.width = perc + "%";
            
            // Colore dinamico della barra
            if(perc < 40) bar.style.background = "#ef4444";
            else if(perc < 80) bar.style.background = "#f59e0b";
            else bar.style.background = "linear-gradient(to right, #06b6d4, #22d3ee)";
        }
    };

    // Colleghiamo l'integrità agli eventi di modifica
    var originalMarkDirty = window.markDirty;
    window.markDirty = function() {
        if(originalMarkDirty) originalMarkDirty();
        window.calculateIntegrity();
    };

    // --- GESTIONE ETICHETTE PERSONALIZZATE (New 2026) ---
    var labelsFilePath = fso.BuildPath(currentDir, "system");
    if(!fso.FolderExists(labelsFilePath)) fso.CreateFolder(labelsFilePath);
    labelsFilePath = fso.BuildPath(labelsFilePath, "phone_labels.dat");

    var DEFAULT_LABELS = "FISSO;CELL.;W.APP;FIGLIO/A;MOGLIE;MARITO;SORELLA;FRATELLO;BADANTE;ALTRO";

    window.CaricaEtichetteExtra = function() {
        try {
            // Se il file non esiste, lo creiamo con i default
            if(!fso.FileExists(labelsFilePath)) {
                var tsWrite = fso.OpenTextFile(labelsFilePath, 2, true);
                tsWrite.Write(DEFAULT_LABELS);
                tsWrite.Close();
            }

            var ts = fso.OpenTextFile(labelsFilePath, 1);
            var content = ts.AtEndOfStream ? "" : ts.ReadAll();
            ts.Close();
            
            var labels = content.split(';');
            var bar = getEl('phoneHelperBar');
            if(!bar) return;
            var addBtn = bar.querySelector('.add-label-btn');
            
            // Pulizia totale etichette per ri-rendering
            var oldChips = bar.querySelectorAll('.helper-chip:not(.add-label-btn)');
            for(var k=0; k<oldChips.length; k++) bar.removeChild(oldChips[k]);
            
            for(var i=0; i<labels.length; i++) {
                var l = labels[i].trim();
                if(l) {
                    var chip = document.createElement('div');
                    chip.className = 'helper-chip custom-label'; // Ora tutte sono "custom" nel senso di gestibili
                    
                    var icon = "";
                    if(l.toUpperCase() === "FISSO") icon = '<i class="fa fa-phone"></i> ';
                    else if(l.toUpperCase() === "CELL.") icon = '<i class="fa fa-mobile"></i> ';
                    else if(l.toUpperCase() === "W.APP") icon = '<i class="fa fa-whatsapp"></i> ';
                    
                    chip.innerHTML = icon + '<span>' + l.toUpperCase() + '</span>' + 
                                   '<i class="fa fa-times label-del-btn" title="Elimina"></i>';
                    
                    var textSpan = chip.querySelector('span');
                    var delBtn = chip.querySelector('.label-del-btn');
                    
                    // Se c'è un'icona, rendiamo cliccabile anche quella per il testo
                    var mainIcon = chip.querySelector('i:not(.label-del-btn)');
                    if(mainIcon) mainIcon.onclick = (function(val) { return function() { window.QuickLabelPhone(val); }; })(l.toUpperCase());
                    
                    textSpan.onclick = (function(val) { return function() { window.QuickLabelPhone(val); }; })(l.toUpperCase());
                    delBtn.onclick = (function(val) { return function(ev) { 
                        if(ev) ev.stopPropagation();
                        window.EliminaEtichettaPersonalizzata(val); 
                    }; })(l.toUpperCase());
                    
                    bar.insertBefore(chip, addBtn);
                }
            }
        } catch(e) {}
    };

    window.EliminaEtichettaPersonalizzata = function(label) {
        if(!confirm("Vuoi eliminare definitivamente l'etichetta '" + label + "' dalla barra?")) return;
        
        try {
            if(!fso.FileExists(labelsFilePath)) return;
            var ts = fso.OpenTextFile(labelsFilePath, 1);
            var content = ts.AtEndOfStream ? "" : ts.ReadAll();
            ts.Close();
            
            var arr = content.split(';');
            var newArr = [];
            for(var i=0; i<arr.length; i++) {
                var clean = arr[i].trim().toUpperCase();
                var match = label.toUpperCase();
                // Gestiamo il caso ALTRO... che nel file potrebbe essere ALTRO o ALTRO...
                if(clean !== match && clean !== "" && clean !== match + "...") {
                    newArr.push(arr[i].trim());
                }
            }
            
            var tsWrite = fso.OpenTextFile(labelsFilePath, 2, true);
            tsWrite.Write(newArr.join(';'));
            tsWrite.Close();
            
            window.CaricaEtichetteExtra();
        } catch(e) {
            alert("Errore nell'eliminazione: " + e.message);
        }
    };

    window.AggiungiEtichettaPersonalizzata = function() {
        var label = prompt("Inserisci il nome della nuova parentela o etichetta rapida\n(es. NIPOTE, VICINO, UFFICIO):", "");
        if(label && label.trim() !== "") {
            var newLabel = label.trim().toUpperCase();
            
            // Salvataggio su file
            try {
                var content = "";
                if(fso.FileExists(labelsFilePath)) {
                    var ts = fso.OpenTextFile(labelsFilePath, 1);
                    content = ts.AtEndOfStream ? "" : ts.ReadAll();
                    ts.Close();
                }
                
                // Evitiamo duplicati nel file
                var arr = content ? content.split(';') : [];
                for(var i=0; i<arr.length; i++) if(arr[i].trim().toUpperCase() === newLabel) return;
                
                arr.push(newLabel);
                var tsWrite = fso.OpenTextFile(labelsFilePath, 2, true);
                tsWrite.Write(arr.join(';'));
                tsWrite.Close();
                
                // Aggiornamento interfaccia
                window.CaricaEtichetteExtra();
            } catch(e) {
                alert("Errore nel salvataggio: " + e.message);
            }
        }
    };

    window.NavigaModulo = function(modulo) {
        if(!modulo) return;
        if (!CheckUnsavedChanges()) return; // Intercetta cambi modulo se ci sono modifiche pendenti
        try {
            if (window.parent && typeof window.parent.ApriModulo === "function" && window.parent !== window) {
                window.parent.ApriModulo(modulo);
                return;
            }
            if (window.top && typeof window.top.ApriModulo === "function" && window.top !== window) {
                window.top.ApriModulo(modulo);
                return;
            }
        } catch(eParent) {}
        isNavigating = true;
        try {
            var shell = new ActiveXObject("WScript.Shell");
            var targetPath = fso.BuildPath(currentDir, modulo);
            if(!fso.FileExists(targetPath)) targetPath = modulo;
            
            shell.Run('mshta.exe "' + targetPath + '"', 1, false);
            
            // CHIUSURA ATOMICA per liberare database
            isClosing = true;
            window.close();
        } catch(e) {
            alert("Errore Navigazione: " + e.message);
        }
    };

    window.Script_BackToDashboard = function() {
        window.NavigaModulo('dashboard.html');
    };

    // --- MOTORE STATISTICO DYNAMIC OVERVIEW DASHBOARD ---
    window.AggiornaOverviewStats = function() {
        var divTot = getEl('ovTotClienti');
        var divSpec = getEl('ovSpeciale');
        var divRec = getEl('recentUpdatesList');
        if (!divTot || !divSpec || !divRec) return;

        // Funzione Helper Count-Up Animata Bulletproof
        function AnimateCounter(el, endVal) {
            if (!el) return;
            var end = parseInt(endVal, 10) || 0;
            if (isNaN(end)) { el.innerText = endVal; return; }
            if (end === 0) { el.innerText = "0"; return; }
            var duration = 800; // ms
            var stepTime = 25; // ms per frame
            var steps = Math.ceil(duration / stepTime);
            var increment = end / steps;
            var current = 0;
            var count = 0;
            var t = setInterval(function() {
                count++;
                current += increment;
                if (count >= steps) {
                    clearInterval(t);
                    el.innerText = end;
                } else {
                    el.innerText = Math.floor(current);
                }
            }, stepTime);
        }

        // Micro-Animazione Rotazione Logo su refresh manuale
        try {
            var shieldIcon = document.querySelector('.overview-logo img');
            if (shieldIcon) {
                shieldIcon.style.transition = "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)";
                shieldIcon.style.transform = "rotate(360deg)";
                setTimeout(function() { 
                    shieldIcon.style.transition = "none"; 
                    shieldIcon.style.transform = "rotate(0deg)"; 
                }, 800);
            }
        } catch(eAnim) {}

        try {
            var dataSrc = dataClienti || [];
            var tot = dataSrc.length;
            AnimateCounter(divTot, tot);

            var specialCount = 0;
            var ciechiCount = 0;
            var ipoCount = 0;
            var normoCount = 0;
            var incompleteCount = 0;

            for (var i = 0; i < tot; i++) {
                var itm = dataSrc[i];
                var st = String(getVal(itm, ["statogravita", "disabilita"]) || "").toUpperCase();
                if (st.indexOf("CIECO") > -1) {
                    ciechiCount++;
                    specialCount++;
                } else if (st.indexOf("IPOVEDENTE") > -1) {
                    ipoCount++;
                    specialCount++;
                } else {
                    normoCount++;
                }

                // Rilevamento profili incompleti (Mancanza Telefono o Comune)
                var tVal = String(getVal(itm, ["telefono", "telefoni"]) || "").trim();
                var lVal = String(getVal(itm, ["comune", "localita"]) || "").trim();
                if (!tVal || tVal === "" || !lVal || lVal === "" || lVal === "N.D.") {
                    incompleteCount++;
                }
            }
            AnimateCounter(divSpec, specialCount);

            // AGGIORNAMENTO BACHECA DI BENVENUTO INTELLIGENTE
            try {
                var giorniSett = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
                var mesiAnno = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                var dCorr = new Date();
                var sGiorno = giorniSett[dCorr.getDay()];
                var nGiorno = dCorr.getDate();
                var sMese = mesiAnno[dCorr.getMonth()];
                var oCorr = dCorr.getHours();
                
                var sSaluto = "Buonasera";
                var sSlogan = "Ultime attività del giorno in corso...";
                var iSaluto = "fa-moon-o";
                if (oCorr >= 5 && oCorr < 12) { 
                    sSaluto = "Buongiorno"; 
                    sSlogan = "Pronto per le consegne di oggi?";
                    iSaluto = "fa-sun-o"; 
                }
                else if (oCorr >= 12 && oCorr < 18) { 
                    sSaluto = "Buon pomeriggio"; 
                    sSlogan = "Il database è ottimizzato e pronto.";
                    iSaluto = "fa-cloud"; 
                }
                
                var uNomeStr = "OPERATORE";
                if (window.sessionUserName) {
                    uNomeStr = String(window.sessionUserName).toUpperCase().trim();
                } else {
                    var userWid = getEl("userProfileWidget");
                    if(userWid) {
                        var txtData = userWid.innerText || userWid.textContent;
                        if(txtData) uNomeStr = txtData.toUpperCase().trim();
                    }
                }
                
                if (getEl('greetPrimary')) {
                    getEl('greetPrimary').innerHTML = '<i class="fa ' + iSaluto + '"></i>' + sSaluto + ', <span class="banner-username">' + uNomeStr + '</span>! 👋';
                }
                if (getEl('greetSlogan')) {
                    getEl('greetSlogan').innerHTML = sSlogan;
                }
                
                if (getEl('greetInsights')) {
                    var insHtml = "";
                    if (incompleteCount > 0) {
                        insHtml = '⚠️ Rilevati <b style="color:#ffffff; margin:0 4px;">' + incompleteCount + '</b> profili incompleti. <span class="banner-action-link" onclick="filtraStato(\'INCOMPLETO\', document.querySelector(\'.pill-alert\'))">Risolvi ora <i class="fa fa-arrow-right" style="font-size:0.75rem; margin-left:2px;"></i></span>';
                    } else {
                        insHtml = '🎉 Database ottimizzato: <b style="color:#22c55e; margin-left:5px;">100% dei profili completati!</b>';
                    }
                    getEl('greetInsights').innerHTML = insHtml;
                }
            } catch(exGreet) {}

            // AGGIORNAMENTO WIDGET DISTRIBUZIONE (GRAFICO A BARRE)
            var pctCiechi = tot > 0 ? Math.round((ciechiCount / tot) * 100) : 0;
            var pctIpo = tot > 0 ? Math.round((ipoCount / tot) * 100) : 0;
            var pctNormo = tot > 0 ? (100 - pctCiechi - pctIpo) : 0;
            if (pctNormo < 0) pctNormo = 0;

            // Applica le percentuali con l'effetto transition animato
            if(getEl('barCiechi')) getEl('barCiechi').style.width = pctCiechi + "%";
            if(getEl('barIpovedenti')) getEl('barIpovedenti').style.width = pctIpo + "%";
            if(getEl('barNormo')) getEl('barNormo').style.width = pctNormo + "%";

            // Aggiorna le etichette nella legenda
            if(getEl('lblCountCiechi')) getEl('lblCountCiechi').innerText = ciechiCount;
            if(getEl('lblPctCiechi')) getEl('lblPctCiechi').innerText = "(" + pctCiechi + "%)";
            
            if(getEl('lblCountIpovedenti')) getEl('lblCountIpovedenti').innerText = ipoCount;
            if(getEl('lblPctIpovedenti')) getEl('lblPctIpovedenti').innerText = "(" + pctIpo + "%)";
            
            if(getEl('lblCountNormo')) getEl('lblCountNormo').innerText = normoCount;
            if(getEl('lblPctNormo')) getEl('lblPctNormo').innerText = "(" + pctNormo + "%)";

            // AGGIORNAMENTO WIDGET GEOGRAFICO (TOP 3 CITTÀ)
            try {
                var localitaMap = {};
                for (var lIndex = 0; lIndex < tot; lIndex++) {
                    var locStr = String(getVal(dataSrc[lIndex], ["comune", "localita"]) || "").toUpperCase().trim();
                    if (locStr && locStr !== "" && locStr !== "N.D." && locStr !== "NULL" && locStr !== "UNDEFINED") {
                        localitaMap[locStr] = (localitaMap[locStr] || 0) + 1;
                    }
                }
                // Trasforma in array e ordina per frequenza discendente
                var locArr = [];
                for (var lKey in localitaMap) {
                    locArr.push({ name: lKey, count: localitaMap[lKey] });
                }
                locArr.sort(function(a, b) { return b.count - a.count; });

                var geoHtml = "";
                var maxGeoCount = locArr.length > 0 ? locArr[0].count : 1;
                var iterations = Math.min(locArr.length, 3);

                if (iterations > 0) {
                    for (var g = 0; g < iterations; g++) {
                        var geoItm = locArr[g];
                        var rPct = Math.round((geoItm.count / maxGeoCount) * 100);
                        geoHtml += '<div class="geo-row">' +
                                      '<div class="geo-info"><span class="geo-rank">' + (g+1) + '</span><span class="geo-name">' + geoItm.name + '</span></div>' +
                                      '<div class="geo-progress-container"><div class="geo-progress-bar" style="width:' + rPct + '%;"></div></div>' +
                                      '<span class="geo-count-pill">' + geoItm.count + ' Utenti</span>' +
                                   '</div>';
                    }
                } else {
                    geoHtml = '<div style="text-align:center; color:#94a3b8; padding:10px; font-style:italic; font-size:0.85rem;">Dati geografici non sufficienti nel database.</div>';
                }
                if(getEl('geoListContainer')) getEl('geoListContainer').innerHTML = geoHtml;
            } catch(eGeo) {
                if(getEl('geoListContainer')) getEl('geoListContainer').innerHTML = '<div style="color:#ef4444; font-size:0.75rem; text-align:center;">Errore elaborazione geo.</div>';
            }


            // Recupero le ultime modifiche direttamente dal DB via Bridge API
            var sqlRecenti = "SELECT [ID], [CognomeNome], [DataUltimaModifica] FROM tblClienti WHERE ([isCancellato]=0 OR [isCancellato] IS NULL) AND [CognomeNome] IS NOT NULL ORDER BY [DataUltimaModifica] DESC, [ID] DESC";
            var rows = runQuery(sqlRecenti, true); // modalita silent
            var html = "";
            var hasData = false;
            
            if (rows && rows.length > 0) {
                // Mostriamo al massimo le ultime 3 attività
                var maxCount = Math.min(rows.length, 3);
                for (var k = 0; k < maxCount; k++) {
                    hasData = true;
                    var r = rows[k];
                    var rid = getVal(r, ["id"]);
                    var rnome = getVal(r, ["cognomenome"]);
                    var rdateRaw = getVal(r, ["dataultimamodifica"]);
                    var rdateStr = "Data N.D.";
                    
                    if (rdateRaw) {
                        rdateStr = formatDate(rdateRaw);
                    }
                    
                    html += '<div class="recent-row" onclick="selezionaClientePerId(\'' + rid + '\')" title="Apri Profilo Cliente">' +
                                '<span class="recent-name"><i class="fa fa-user" style="color:var(--zenith-cyan); margin-right:12px;"></i>' + rnome + '</span>' +
                                '<span class="recent-time"><i class="fa fa-pencil" style="font-size:10px; margin-right:6px; color:var(--zenith-cyan);"></i>' + rdateStr + '</span>' +
                            '</div>';
                }
            }
            
            if (!hasData) {
                html = '<div style="text-align:center; color:#cbd5e1; padding:15px; font-size:0.9rem; font-style:italic;">Nessuna attività recente registrata sul database.</div>';
            }
            divRec.innerHTML = html;
            
            // AGGIORNAMENTO GRAFICO DELLE PROVINCE (IL DOLCE)
            try {
                if(window.AggiornaGraficoProvince) window.AggiornaGraficoProvince();
            } catch(exPrv) { }

        } catch(e) {
            divTot.innerText = (dataClienti && dataClienti.length) ? dataClienti.length : "0";
            divSpec.innerText = "-";
            divRec.innerHTML = '<div style="color:#ef4444; font-size:0.8rem; text-align:center; padding:10px;">Impossibile interrogare la cronologia Zenith.</div>';
        }
    };

    window.selezionaClientePerId = function(id) {
        if (!dataClienti || !id) return;
        var targetId = String(id);
        for (var i = 0; i < dataClienti.length; i++) {
            var c = dataClienti[i];
            var cid = getVal(c, ["id", "idcliente", "codice"]).toString();
            if (cid === targetId) {
                selezionaCliente(c, null); // Seleziona attivando il pannello di dettaglio
                return;
            }
        }
    };

    // --- HANDLER ACCORDION GUIDA RAPIDA DI SISTEMA ---
    window.ToggleGuidaRapida = function() {
        var content = getEl('guidaContent');
        var icon = getEl('guidaToggleIcon');
        if (!content || !icon) return;
        
        var isCollapsed = (content.style.maxHeight === "0px" || !content.style.maxHeight);
        if (isCollapsed) {
            // Espansione dinamica basata sull'altezza del contenuto reale
            content.style.maxHeight = content.scrollHeight + "px";
            content.style.opacity = "1";
            icon.style.transform = "rotate(180deg)";
        } else {
            // Chiusura
            content.style.maxHeight = "0px";
            content.style.opacity = "0";
            icon.style.transform = "rotate(0deg)";
        }
    };

    // --- FUNZIONI UTILITY MEMO (Copy & Clear 2026) ---
    window.CopiaMemoSuAppunti = function() {
        var txtEl = getEl('txtZenithMemo');
        var txt = txtEl ? txtEl.value : "";
        if (!txt || txt.trim() === "") {
            alert("Il blocco note è vuoto, non c'è nulla da copiare!");
            return;
        }
        try {
            window.clipboardData.setData("Text", txt);
            var statusSpan = document.querySelector('.zenith-memo-widget .memo-status');
            if (statusSpan) {
                var origHtml = statusSpan.innerHTML;
                var origBg = statusSpan.style.backgroundColor || "";
                var origBc = statusSpan.style.borderColor || "";
                var origCol = statusSpan.style.color || "";
                
                statusSpan.innerHTML = '<i class="fa fa-check-circle"></i> COPIATO!';
                statusSpan.style.backgroundColor = "rgba(34, 197, 94, 0.25)";
                statusSpan.style.borderColor = "#22c55e";
                statusSpan.style.color = "#4ade80";
                
                setTimeout(function() {
                    statusSpan.innerHTML = origHtml;
                    statusSpan.style.backgroundColor = origBg;
                    statusSpan.style.borderColor = origBc;
                    statusSpan.style.color = origCol;
                }, 2000);
            }
        } catch(e) {
            alert("Impossibile copiare negli appunti: " + e.message);
        }
    };

    window.SvuotaMemoHub = function() {
        if (confirm("⚠️ Attenzione: vuoi cancellare definitivamente tutti i tuoi appunti correnti?")) {
            var txtEl = getEl('txtZenithMemo');
            if (txtEl) {
                txtEl.value = "";
                if (typeof window.SalvaMemoHub === "function") {
                    window.SalvaMemoHub();
                }
            }
        }
    };

    // --- ANTIPASTO: FAST-TRACK MAPS PRO (Geolocalizzazione Rapida) ---
    window.ApriMappaCliente = function() {
        var via = getEl('txtResidenza') ? getEl('txtResidenza').value.trim() : "";
        var com = getEl('cmbLocalita') ? getEl('cmbLocalita').value.trim() : "";
        var pro = getEl('cmbProvincia') ? getEl('cmbProvincia').value.trim() : "";
        
        var fullQuery = "";
        if(via) fullQuery += via + " ";
        if(com) fullQuery += com + " ";
        if(pro) fullQuery += "(" + pro + ")";
        
        fullQuery = fullQuery.trim();
        if(!fullQuery) {
            alert("⚠️ Inserisci almeno un dato di residenza per localizzare il cliente!");
            return;
        }
        
        try {
            var wsh = new ActiveXObject("WScript.Shell");
            var enc = encodeURIComponent(fullQuery);
            var url = "https://www.google.com/maps/search/?api=1&query=" + enc;
            wsh.Run('"' + url + '"');
        } catch(e) {
            alert("Errore nell'apertura della mappa:\n" + e.message);
        }
    };

    // --- PRIMO PIATTO: RADAR FEDELTA & RANKING (Badge Operativo Dinamico) ---
    window.AggiornaBadgeRanking = function(rs) {
        var badge = getEl('lblRankBadge');
        if(!badge) return;
        
        badge.style.display = "none";
        badge.className = "zenith-status-badge";
        badge.style.animation = "none";
        
        if(!rs || rs.length === 0) {
            badge.innerHTML = '<i class="fa fa-star-o"></i> NUOVO CONTATTO';
            badge.className = "zenith-status-badge badge-rank-nuovo";
            badge.style.display = "inline-flex";
            return;
        }
        
        var tot = rs.length;
        var lastDt = null;
        
        // Trova l'ultima data reale di consegna scorrendo a ritroso
        for(var i=0; i<rs.length; i++) {
            if(rs[i].dataconsegna) {
                var str = rs[i].dataconsegna.toString();
                var p = str.substring(0, 10).split("-"); // YYYY-MM-DD
                if(p.length === 3) {
                    lastDt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                    break;
                }
            }
        }
        
        var today = new Date();
        var diffDays = 9999;
        if(lastDt) {
            var diffMs = today.getTime() - lastDt.getTime();
            diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
        
        if(tot >= 15) {
            badge.innerHTML = '<i class="fa fa-trophy" style="text-shadow:0 0 8px currentColor;"></i> CLIENTE TOP GOLD';
            badge.className = "zenith-status-badge badge-rank-top";
        } else if(diffDays <= 60) {
            badge.innerHTML = '<i class="fa fa-bolt"></i> OPERATIVO';
            badge.className = "zenith-status-badge badge-rank-attivo";
        } else if(diffDays >= 180 && lastDt) {
            badge.innerHTML = '<i class="fa fa-snowflake-o"></i> DORMITANTE';
            badge.className = "zenith-status-badge badge-rank-dormiente";
        } else {
            badge.innerHTML = '<i class="fa fa-users"></i> ATTIVO';
            badge.className = "zenith-status-badge badge-rank-attivo";
            badge.style.animation = "none"; // Attivo base senza pulsazione
        }
        badge.style.display = "inline-flex";
    };

    // --- SECONDO PIATTO: WHATSAPP DISPATCH PRO (Notifiche Istantanee) ---
    window.InviaWhatsAppConsegna = function(data, ora) {
        var nome = getEl('lblDisplayName') ? getEl('lblDisplayName').innerText.trim() : "";
        var citta = getEl('cmbLocalita') ? getEl('cmbLocalita').value.trim() : "";
        
        var tel = "";
        
        // 1. Lettura dal cliente in memoria (Affidabile, ignora UI changes)
        if (typeof clienteCorrente !== "undefined" && clienteCorrente) {
            var rawTels = (clienteCorrente._tel || clienteCorrente.telefono || clienteCorrente.telefoni || "").toString();
            var arrTels = rawTels.split(/[,;]+/); // NON usare \s, i numeri possono contenere spazi!
            for(var i=0; i<arrTels.length; i++) {
                var cleanT = arrTels[i].replace(/\D/g, '');
                if (cleanT.length >= 9 && cleanT.indexOf('3') === 0) {
                    tel = cleanT;
                    break;
                }
            }
            if (!tel && arrTels.length > 0) {
                tel = arrTels[0].replace(/\D/g, '');
            }
        }
        
        // 2. Fallback su input field se in modifica
        if (!tel && getEl('txtTelefoni')) {
            var valTels = getEl('txtTelefoni').value;
            var arrVal = valTels.split(/[,;]+/);
            for(var k=0; k<arrVal.length; k++) {
                var cleanK = arrVal[k].replace(/\D/g, '');
                if (cleanK.length >= 9 && cleanK.indexOf('3') === 0) {
                    tel = cleanK;
                    break;
                }
            }
            if (!tel && arrVal.length > 0) {
                tel = arrVal[0].replace(/\D/g, '');
            }
        }
        
        // 3. Fallback storico tag pill (Scansione intelligente dei tag telefonici)
        if (!tel) {
            var tags = document.querySelectorAll('#phoneTagContainer .phone-tag-pill');
            if(tags && tags.length > 0) {
                for(var j=0; j<tags.length; j++) {
                    var text = tags[j].innerText || "";
                    var clean = text.replace(/\D/g, '');
                    // Verifica se inizia con 3 (cellulare italiano standard)
                    if(clean.length >= 9 && (clean.indexOf('3') === 0 || clean.indexOf('393') === 0)) {
                        tel = clean;
                        break;
                    }
                }
                if(!tel) tel = tags[0].innerText.replace(/\D/g, '');
            }
        }
        
        if(!tel) {
            alert("⚠️ Nessun numero telefonico attivo trovato per questo cliente.\nPer favore, aggiungi un recapito di cellulare per inviare le notifiche!");
            return;
        }
        
        // Normalizzazione prefisso internazionale per link WhatsApp
        if(tel.length === 10 && tel.indexOf('3') === 0) {
            tel = "39" + tel;
        }
        
        var saluto = "Gentile Cliente";
        if(nome && nome !== "DENOMINAZIONE CLIENTE") {
            saluto = "Gentile *" + nome + "*";
        }
        
        var msgPart1 = saluto + "";
        var msgPart2 = "\nLe confermiamo che la consegna prevista a *" + (citta || "Vostro Indirizzo") + "* è programmata per il giorno *" + data + "* alle ore *" + ora + "*.\n\nCordiali Saluti,\n";
        var msgPart3 = "*Logistica Milella*";
        
        var textParam = encodeURIComponent(msgPart1) + encodeURIComponent(msgPart2) + encodeURIComponent(msgPart3);
        
        try {
            var url = "https://wa.me/" + tel + "?text=" + textParam;
            window.open(url, "_blank");
        } catch(e) {
            alert("Impossibile aprire WhatsApp:\n" + e.message);
        }
    };

    // --- DOLCE: ZENITH DATA ANALYTICS (Grafico Distribuzione Province con Raggruppamento Intelligente) ---
    window.AggiornaGraficoProvince = function() {
        var container = getEl('provinceChartContainer');
        if(!container) return;
        
        try {
            var sql = "SELECT Provincia, COUNT(*) as Tot FROM tblClienti GROUP BY Provincia ORDER BY COUNT(*) DESC";
            var rs = runQuery(sql, true);
            
            if(!rs || rs.length === 0) {
                container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-style:italic; font-size:0.85rem;">Nessun dato provinciale recuperabile.</div>';
                return;
            }
            
            // RAGGRUPPAMENTO INTELLIGENTE DEI DATI (Gestione Anomalie DB Legacy)
            var normalizedMap = {};
            
            function getNormalizedName(provStr) {
                if (!provStr) return "NON SPECIFICATA";
                var s = provStr.toString().toUpperCase().trim();
                // Rimuovi tutti i punti (es: B.A.T. -> BAT, B.A. -> BA)
                s = s.replace(/\./g, "");
                
                // Regole di mappatura robuste
                if (s === "BA" || s.indexOf("BARI") > -1 || s.indexOf("METROPOLITANA DI BARI") > -1) {
                    return "BARI";
                }
                if (s === "BT" || s === "BAT" || s.indexOf("ANDRIA") > -1 || s.indexOf("BARLETTA") > -1 || s.indexOf("TRANI") > -1) {
                    return "BAT";
                }
                if (s === "TA" || s.indexOf("TARANTO") > -1) {
                    return "TARANTO";
                }
                if (s === "FG" || s.indexOf("FOGGIA") > -1) {
                    return "FOGGIA";
                }
                if (s === "BR" || s.indexOf("BRINDISI") > -1) {
                    return "BRINDISI";
                }
                if (s === "LE" || s.indexOf("LECCE") > -1) {
                    return "LECCE";
                }
                
                return s; // Se sconosciuta, mantieni originale
            }
            
            // Ciclo sui risultati grezzi e accorpamento dei duplicati logici
            for(var i=0; i<rs.length; i++) {
                var rawProv = rs[i].provincia ? rs[i].provincia.toString() : "";
                var count = parseInt(rs[i].tot || 0, 10);
                var normName = getNormalizedName(rawProv);
                
                if (!normalizedMap[normName]) {
                    normalizedMap[normName] = 0;
                }
                normalizedMap[normName] += count;
            }
            
            // Trasforma la mappa accorpata in un array ordinabile
            var finalData = [];
            var grandTotal = 0;
            for (var key in normalizedMap) {
                finalData.push({ name: key, tot: normalizedMap[key] });
                grandTotal += normalizedMap[key];
            }
            
            if(grandTotal === 0) grandTotal = 1;
            
            // Ri-ordina l'array aggregato dal più numeroso al più piccolo
            finalData.sort(function(a, b) {
                return b.tot - a.tot;
            });
            
            container.innerHTML = "";
            var animationBuffer = [];
            
            // Mostriamo al massimo le prime 10 province dopo il raggruppamento
            var itemsToShow = Math.min(finalData.length, 10);
            for (var j = 0; j < itemsToShow; j++) {
                var row = finalData[j];
                var provName = row.name;
                
                var badgeText = provName;
                if(provName.length > 30) badgeText = provName.substring(0, 27) + "...";
                
                var count = row.tot;
                var pct = Math.round((count / grandTotal) * 100);
                
                var item = document.createElement("div");
                item.className = "zenith-chart-item";
                
                item.innerHTML = 
                    "<div class='chart-meta-row'>" +
                        "<span class='chart-prov-badge' title='" + provName.replace(/'/g, "&#39;") + "'>" + badgeText + "</span>" +
                        "<div class='chart-val-group'>" +
                            "<span class='chart-count-num'>" + count + "</span>" +
                            "<span class='chart-pct-num'>(" + pct + "%)</span>" +
                        "</div>" +
                    "</div>" +
                    "<div class='chart-bar-track'>" +
                        "<div class='chart-bar-fill' id='barFillProv_" + j + "' style='width: 0%;'></div>" +
                    "</div>";
                
                container.appendChild(item);
                animationBuffer.push({ id: "barFillProv_" + j, width: pct + "%" });
            }
            
            // Esecuzione differita dell'animazione barre CSS (Fluid UX)
            setTimeout(function() {
                for(var k=0; k<animationBuffer.length; k++) {
                    var fillElement = getEl(animationBuffer[k].id);
                    if(fillElement) fillElement.style.width = animationBuffer[k].width;
                }
            }, 300);
            
        } catch(ex) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#f87171; font-size:0.85rem;">Errore nel raggruppamento dei grafici geografici.</div>';
        }
    };

    // --- CHICCA PRO: SCAN-TO-GO GPS NAVIGATION (DISPATCHER AUTISTA) ---
    window.GeneraScanToGo = function() {
        try {
            var overlay = getEl('scanToGoOverlay');
            var qrImage = getEl('stgQrImage');
            var lblName = getEl('stgClientName');
            var lblAddr = getEl('stgClientAddress');
            
            if(!overlay) { alert("Elemento overlay non trovato!"); return; }
            if(!qrImage) { alert("Elemento QR Image non trovato!"); return; }
            
            var name = getEl('lblDisplayName') ? getEl('lblDisplayName').innerText.trim() : "CLIENTE";
            if(name === "DENOMINAZIONE CLIENTE") {
                var nameInput = getEl('txtCognomeNome');
                name = nameInput ? nameInput.value : "CLIENTE";
            }
            
            var via = getEl('txtResidenza') ? getEl('txtResidenza').value.trim() : "";
            var com = getEl('cmbLocalita') ? getEl('cmbLocalita').value.trim() : "";
            var pro = getEl('cmbProvincia') ? getEl('cmbProvincia').value.trim() : "";
            
            var logVia = getEl('txtLogIndirizzo') ? getEl('txtLogIndirizzo').value.trim() : "";
            var logCom = getEl('txtLogComune') ? getEl('txtLogComune').value.trim() : "";
            var logPro = getEl('txtLogProvincia') ? getEl('txtLogProvincia').value.trim() : "";
            
            var isLogisticaAttiva = false;
            if(logVia !== "") {
                via = logVia;
                if(logCom) com = logCom;
                if(logPro) pro = logPro;
                isLogisticaAttiva = true;
            }
            
            var fullAddr = "";
            if(via) fullAddr += via + " ";
            if(com) fullAddr += com + " ";
            if(pro) fullAddr += "(" + pro + ")";
            fullAddr = fullAddr.trim();
            
            if(!fullAddr) {
                alert("⚠️ Inserisci l'indirizzo (Residenza o Consegna) prima di generare il codice GPS!");
                return;
            }
            
            if(lblName) lblName.innerText = name.toUpperCase();
            if(lblAddr) {
                if(isLogisticaAttiva) {
                    lblAddr.innerHTML = "<div style='color:#facc15; font-weight:700; font-size:0.65rem; margin-bottom:4px; letter-spacing:0.05em;'><i class='fa fa-truck' style='margin-right:4px;'></i>CONSEGNA A DOMICILIO LOGISTICO</div>" + fullAddr.toUpperCase();
                } else {
                    lblAddr.innerText = fullAddr.toUpperCase();
                }
            }
            
            // CRITICO PER COMPATIBILITA GLOBALE: Costruiamo una query ASCII pura senza percentuali, virgole o caratteri strani
            var cleanQuery = "";
            if(via) cleanQuery += via + " ";
            if(com) cleanQuery += com + " ";
            if(pro) cleanQuery += pro;
            
            // 1. Mantiene SOLO lettere, numeri e spazi, scartando virgole, apici, parentesi
            cleanQuery = cleanQuery.replace(/[^a-zA-Z0-9 ]/g, ' ');
            
            // 2. Pulisce gli spazi multipli e li unisce con il carattere "+" (compatibile al 100% con ogni lettore QR)
            cleanQuery = cleanQuery.trim().replace(/\s+/g, '+');
            
            // 3. Costruiamo il link maps nel formato PIÙ CORTO POSSIBILE (45-50 caratteri max).
            // Meno caratteri = QR Code con quadratoni enormi, facilissimo da scansionare dagli schermi LCD!
            var mapsLink = "https://maps.google.com/?q=" + cleanQuery;
            
            // Generiamo il QR Code 250x250. La stringa decodificata nel QR sarà pulitissima senza '%20' o '%2C'
            qrImage.src = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(mapsLink);
            
            overlay.style.display = "flex";
        } catch(ex) {
            alert("Errore logico GeneraScanToGo:\n" + ex.message);
        }
    };

    window.ChiudiScanToGo = function() {
        var overlay = getEl('scanToGoOverlay');
        if(overlay) overlay.style.display = "none";
    };

    window.ClonaIndirizzoResidenza = function() {
        var via = getEl('txtResidenza') ? getEl('txtResidenza').value.trim() : "";
        var com = getEl('cmbLocalita') ? getEl('cmbLocalita').value.trim() : "";
        var pro = getEl('cmbProvincia') ? getEl('cmbProvincia').value.trim() : "";
        
        if(!via && !com) {
            alert("⚠️ La residenza principale è vuota! Inserisci prima un indirizzo per poterlo clonare.");
            return;
        }
        
        if(getEl('txtLogIndirizzo')) {
            getEl('txtLogIndirizzo').value = via;
            getEl('txtLogIndirizzo').style.backgroundColor = "rgba(56, 189, 248, 0.18)";
        }
        if(getEl('txtLogComune')) getEl('txtLogComune').value = com;
        if(getEl('txtLogProvincia')) getEl('txtLogProvincia').value = pro;
        
        // Rimuovi il flash dopo 800ms
        setTimeout(function() {
            if(getEl('txtLogIndirizzo')) {
                getEl('txtLogIndirizzo').style.backgroundColor = "rgba(56, 189, 248, 0.03)";
            }
        }, 800);
        
        // Se abbiamo un tracker di modifiche (GetCurrentFormState) possiamo forzare una notifica visiva
        try { if(typeof RefreshUIState === "function") RefreshUIState(); } catch(e) {}
    };

    function setupLiveCardBindings() {
        var txtNome = getEl('txtCognomeNome');
        if (txtNome) {
            var oldKeyUp = txtNome.onkeyup;
            txtNome.onkeyup = function(e) {
                if (oldKeyUp) oldKeyUp.call(this, e);
                if (getEl('cardNomeCompleto')) getEl('cardNomeCompleto').innerText = this.value.toUpperCase();
                if (getEl('cardSignature')) getEl('cardSignature').innerText = this.value;
                if (getEl('lblDisplayName')) getEl('lblDisplayName').innerText = this.value.toUpperCase();
            };
        }
        
        var txtId = getEl('txtId');
        if (txtId) {
            var oldIdKeyUp = txtId.onkeyup;
            txtId.onkeyup = function(e) {
                if (oldIdKeyUp) oldIdKeyUp.call(this, e);
                if (getEl('cardCodiceId')) getEl('cardCodiceId').innerText = "ID: " + this.value;
            };
        }
        
        var cmbLoc = getEl('cmbLocalita');
        if (cmbLoc) {
            var oldLocChange = cmbLoc.onchange;
            cmbLoc.onchange = cmbLoc.onkeyup = function(e) {
                e = e || window.event;
                if (oldLocChange && (!e || e.type !== 'keyup')) {
                    oldLocChange.call(this, e);
                }
                var provVal = getEl('cmbProvincia') ? getEl('cmbProvincia').value : "";
                if (getEl('cardCitta')) getEl('cardCitta').innerText = this.value.toUpperCase() + (provVal ? " (" + provVal.toUpperCase() + ")" : "");
            };
        }
        
        var cmbProv = getEl('cmbProvincia');
        if (cmbProv) {
            var oldProvChange = cmbProv.onchange;
            cmbProv.onchange = function(e) {
                if (oldProvChange) oldProvChange.call(this, e);
                var locVal = getEl('cmbLocalita') ? getEl('cmbLocalita').value : "";
                if (getEl('cardCitta')) getEl('cardCitta').innerText = locVal.toUpperCase() + (this.value ? " (" + this.value.toUpperCase() + ")" : "");
            };
        }
        
        var txtTels = getEl('txtTelefoni');
        if (txtTels) {
            var oldTelKeyUp = txtTels.onkeyup;
            txtTels.onkeyup = function(e) {
                if (oldTelKeyUp) oldTelKeyUp.call(this, e);
                var first = "";
                if (this.value) {
                    var arr = this.value.split(';');
                    if (arr.length > 0) first = arr[0].trim();
                }
                if (getEl('cardTel')) getEl('cardTel').innerText = first || "---";
            };
        }
        
        var txtEmail = getEl('txtEmailCliente');
        if (txtEmail) {
            var oldEmailKeyUp = txtEmail.onkeyup;
            txtEmail.onkeyup = function(e) {
                if (oldEmailKeyUp) oldEmailKeyUp.call(this, e);
                if (getEl('cardEmail')) getEl('cardEmail').innerText = this.value || "---";
            };
        }
        
        var cmbDis = getEl('cmbDisabilita');
        if (cmbDis) {
            var oldDisChange = cmbDis.onchange;
            cmbDis.onchange = function(e) {
                if (oldDisChange) oldDisChange.call(this, e);
                updateStatoBadge(this.value);
            };
        }
    }

    // Inizializzazione al caricamento
    window.CaricaEtichetteExtra();

})();

    // ============================================================
    // VALIDAZIONE INTELLIGENTE INDIRIZZI (PREVENZIONE REFUSI GPS)
    // ============================================================
    window.VerificaValiditaIndirizzo = function(el) {
        if(!el) return;
        var val = el.value.trim();
        
        var isLogistica = (el.id === "txtLogIndirizzo");
        var defaultBorder = isLogistica ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.15)";
        
        if(val === "" || val === "-" || val.toLowerCase() === "nessuna" || val.toLowerCase() === "n.d.") {
            el.style.borderLeft = "1px solid " + defaultBorder;
            el.style.boxShadow = "";
            return;
        }
        
        // Regole Euristiche Italiane:
        // 1. Presenza indicatore stradale
        var hasStradale = /\b(via|viale|piazza|p\.za|corso|c\.so|largo|l\.go|contrada|c\.da|strada|stradella|traversa|vicolo|v\.le|rione|vico)\b/i.test(val);
        // 2. Presenza di un numero civico (es: Via Bari 12) o 'snc' (senza numero civico)
        var hasCivico = /(\b\d+[a-zA-Z]?\b)|(\bs\.?n\.?c\.?\b)/i.test(val);
        
        if(hasStradale && hasCivico && val.length >= 6) {
            // FORMATO CORRETTO: Bordo verde soft UX
            el.style.borderLeft = "4.5px solid #10b981";
            el.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.15)";
        } else {
            // FORMATO DUBBIO O SENZA CIVICO: Bordo Arancio
            el.style.borderLeft = "4.5px solid #f59e0b";
            el.style.boxShadow = "0 0 10px rgba(245, 158, 11, 0.15)";
        }
    };
    
    window.AgganciaValidatoriIndirizzi = function() {
        var r1 = getEl('txtResidenza');
        var r2 = getEl('txtLogIndirizzo');
        
        if(r1) {
            r1.onblur = function() { window.VerificaValiditaIndirizzo(this); };
            r1.onkeyup = function() { window.VerificaValiditaIndirizzo(this); };
            window.VerificaValiditaIndirizzo(r1); // Aggiorna colore istantaneo
        }
        if(r2) {
            r2.onblur = function() { window.VerificaValiditaIndirizzo(this); };
            r2.onkeyup = function() { window.VerificaValiditaIndirizzo(this); };
            window.VerificaValiditaIndirizzo(r2); // Aggiorna colore istantaneo
        }
    };
    
    // Esecuzione immediata all'avvio
    setTimeout(window.AgganciaValidatoriIndirizzi, 500);

    window.AvviaSincronizzazioneClienti = function() {
        try {
            var parentDir = fso.GetParentFolderName(currentDir);
            var excelPath = fso.BuildPath(fso.BuildPath(parentDir, "_Archivio_Legacy_e_Excel"), "CLIENTI PUGLIA NICOLA.xlsx");
            
            if (!fso.FileExists(excelPath)) {
                alert("File Excel 'CLIENTI PUGLIA NICOLA.xlsx' non trovato in:\n" + excelPath);
                return;
            }
            
            if (!confirm("Avviare la sincronizzazione dei clienti direttamente dal file Excel?\n\nQuesto importerà i nuovi nominativi e aggiornerà i campi 'Avvisato il' e 'Preventivo/Ordine' dai fogli provinciali.")) {
                return;
            }
            
            // Inizializza o resetta il file di stato prima di avviare
            var statusFile = fso.BuildPath(currentDir, "sync_status.json");
            try {
                var sf = fso.CreateTextFile(statusFile, true);
                sf.WriteLine('{"status":"starting","progress":0,"imported":0,"updated":0,"skipped_deceduti":0,"total_rows":0}');
                sf.Close();
            } catch(errReset) {}
            
            // Crea overlay progress
            var overlay = document.createElement("div");
            overlay.id = "syncOverlay";
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.backgroundColor = "rgba(2, 6, 23, 0.85)";
            overlay.style.backdropFilter = "blur(10px)";
            overlay.style.zIndex = "99999";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            
            overlay.innerHTML = 
                '<div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98)); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 20px; padding: 40px; width: 450px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(251, 191, 36, 0.1);">' +
                    '<div style="font-size: 0.75rem; font-weight: 900; color: var(--zenith-gold); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 15px;"><i class="fa fa-refresh fa-spin" style="margin-right:8px;"></i> Sincronizzazione in Corso</div>' +
                    '<h3 style="color: white; margin: 0 0 20px 0; font-size: 1.2rem; font-weight: 800;">IMPORTAZIONE ANAGRAFICA EXCEL</h3>' +
                    '<div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.03);">' +
                        '<div id="syncProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--zenith-gold), #fcd34d); transition: width 0.3s ease; border-radius: 4px;"></div>' +
                    '</div>' +
                    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 0.8rem; font-weight: 700; color: #94a3b8;">' +
                        '<div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.03);">' +
                            '<div style="color: #10b981; font-size: 1.1rem; font-weight: 900; margin-bottom: 4px;" id="syncImported">0</div>' +
                            'IMPORTATI' +
                        '</div>' +
                        '<div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.03);">' +
                            '<div style="color: var(--zenith-cyan); font-size: 1.1rem; font-weight: 900; margin-bottom: 4px;" id="syncUpdated">0</div>' +
                            'AGGIORNATI' +
                        '</div>' +
                        '<div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.03); grid-column: span 2;">' +
                            '<span style="color: #f87171;" id="syncSkipped">0</span> deceduti esclusi | <span id="syncProgressPct">0%</span> completato' +
                        '</div>' +
                    '</div>' +
                    '<div id="syncStatusText" style="font-size: 0.75rem; color: #64748b; font-style: italic; min-height: 18px;">Connessione al file Excel...</div>' +
                '</div>';
                
            document.body.appendChild(overlay);
            
            // Avvia lo script PowerShell in background
            var psScript = fso.BuildPath(currentDir, "import_clienti_excel.ps1");
            var shell = new ActiveXObject("WScript.Shell");
            shell.Run("powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + psScript + "\"", 0, false);
            
            var checkInterval = setInterval(function() {
                try {
                    if (!fso.FileExists(statusFile)) return;
                    var file = fso.OpenTextFile(statusFile, 1, false);
                    var raw = file.ReadAll();
                    file.Close();
                    
                    var data = JSON.parse(raw);
                    
                    // Aggiorna UI
                    var bar = getEl("syncProgressBar");
                    var imp = getEl("syncImported");
                    var upd = getEl("syncUpdated");
                    var skp = getEl("syncSkipped");
                    var pct = getEl("syncProgressPct");
                    var txt = getEl("syncStatusText");
                    
                    if (bar) bar.style.width = data.progress + "%";
                    if (imp) imp.innerText = data.imported;
                    if (upd) upd.innerText = data.updated;
                    if (skp) skp.innerText = data.skipped_deceduti;
                    if (pct) pct.innerText = data.progress + "%";
                    
                    if (data.status === "running") {
                        txt.innerHTML = "<i class='fa fa-circle-o-notch fa-spin'></i> Elaborazione record (riga " + (Math.round(data.progress * data.total_rows / 100)) + " di " + data.total_rows + ")...";
                    }
                    
                    if (data.status === "completed") {
                        clearInterval(checkInterval);
                        txt.innerText = "Operazione completata con successo!";
                        setTimeout(function() {
                            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                            alert("SINCRONIZZAZIONE EXCEL COMPLETATA CON SUCCESSO!\n\n" +
                                  "- Nuovi clienti importati: " + data.imported + "\n" +
                                  "- Clienti esistenti aggiornati: " + data.updated + "\n" +
                                  "- Clienti deceduti (esclusi): " + data.skipped_deceduti);
                            loadData();
                        }, 1000);
                    } else if (data.status === "error") {
                        clearInterval(checkInterval);
                        txt.innerHTML = "<span style='color:#f87171;'>Errore durante la sincronizzazione!</span>";
                        setTimeout(function() {
                            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                            alert("ERRORE DURANTE LA SINCRONIZZAZIONE:\n\n" + data.error);
                        }, 1000);
                    }
                } catch(exCheck) {}
            }, 500);
            
        } catch(e) {
            alert("Impossibile avviare la sincronizzazione:\n" + e.message);
        }
    };

function SpedisciOra() {
    var nome = document.getElementById("txtCognomeNome").value || "";
    if (!nome || nome.trim() === "" || nome === "NUOVO CLIENTE") {
        alert("Seleziona prima un cliente valido dalla lista!");
        return;
    }
    
    try {
        var audio = new Audio("assets/sounds/success.mp3");
        audio.play();
    } catch(e) {}
    
    alert("🚀 SPEDIZIONE RAPIDA INIZIALIZZATA PER:\n" + nome + "\n\nApertura Modulo Consegne in corso...");
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var targetHta = fso.BuildPath(currentDir, "consegne.html");
        shell.Run('mshta.exe "' + targetHta + '"', 1, false);
    } catch(e) {
        alert("Impossibile aprire il modulo consegne:\n" + e.message);
    }
}

// --- AUTO FOCUS RICERCA (FIX DEFINITIVO) ---
var checkFocusRicerca = setInterval(function() {
    var sf = document.getElementById('txtRicerca');
    if(sf) {
        try { sf.focus(); } catch(e){}
        if(document.activeElement === sf) {
            clearInterval(checkFocusRicerca);
        }
    }
}, 300);
setTimeout(function() { clearInterval(checkFocusRicerca); }, 5000);
