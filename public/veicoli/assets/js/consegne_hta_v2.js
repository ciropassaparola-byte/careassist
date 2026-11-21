/**
 * GESTIONE CONSEGNE HTA - Motore JavaScript
 * Riscrittura integrale v2.0 per architettura senza Excel
 */

// ==========================================
// VARIABILI GLOBALI E CONFIGURAZIONI STRUTTURALI
// ==========================================
var isNavigating = false;
var isClosing = false; // Flag di sicurezza anti-loop

window.onbeforeunload = function(e) {
    if (isNavigating || isClosing) return; 
    
    if (typeof IsFormDirty === "function" && IsFormDirty()) {
        try {
            var promptMsg = "Ci sono modifiche non salvate per la scheda corrente.\n\n" +
                            "Vuoi salvare le modifiche prima di uscire?\n\n";
            
            // Mostra il nostro bellissimo dialog premium (blocca l'esecuzione)
            var result = window.showModalDialog("premium_prompt.html", {msg: promptMsg}, "dialogWidth:480px;dialogHeight:280px;center:yes;status:no;scroll:no;unadorned:yes;");
            if (!result) result = 2; // Default ad Annulla se chiude con la X
            
            if (result === 6) { // SÌ, SALVA
                ActionSalva();
                // Lasciamo che la finestra si chiuda in silenzio, NESSUN messaggio nativo di Windows!
                return;
            } else if (result === 7) { // NO, SCARTA
                // Lasciamo che la finestra si chiuda in silenzio perdendo le modifiche, NESSUN messaggio nativo!
                return;
            } else { // ANNULLA (Vuole restare)
                // L'UNICO MODO per fermare la chiusura di Windows è scatenare il messaggio nativo.
                var blockStr = "Hai scelto di ANNULLARE la chiusura.\n\nPremi 'Annulla' in questa finestra di sistema per tornare al tuo gestionale.";
                e = e || window.event;
                if (e) e.returnValue = blockStr;
                return blockStr;
            }
        } catch(ex) {
            var blockStr = "ATTENZIONE: Ci sono modifiche non salvate!\nClicca su 'Annulla' per tornare al gestionale.";
            e = e || window.event;
            if (e) e.returnValue = blockStr;
            return blockStr;
        }
    }
};

window.onunload = function() {
    // Questo evento scatta SOLO DOPO che l'utente ha confermato di voler uscire.
    // Evitiamo doppi lanci in caso di navigazione programmata.
    if (isNavigating || isClosing) return; 
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
        var htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(ex) {}
};
var fso = new ActiveXObject("Scripting.FileSystemObject");
var pathEval = document.location.pathname;
if(pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
var currentDir = fso.GetParentFolderName(pathEval);
var DB_PATH = fso.BuildPath(currentDir, "ConsegneDB.accdb");
var FOTO_DIR = fso.BuildPath(currentDir, "FotoClienti");
var ARTICOLI_DIR = fso.BuildPath(currentDir, "Articoli");

var currentFilterState = ""; // "", "SOSPESI", "URGENTI", "CHIUSI"
var arrayConsegneMemory = []; // Cache listato consegne
var dipendenzePopolate = false;
var idConsegnaCorrente = "NEW";
var exportPath = ""; // Percorso scelto per salvataggio PDF
var currentReportFileName = ""; // Nome file dinamico per esportazione PDF
var materialiExcelMemory = []; // Cache dati ufficio
var originalState = null; // Tracciatore per rilevamento modifiche non salvate

// ==========================================
// FUNZIONI DATABASE UNIVERSALI (Fallback Access/ADODB)
// ==========================================

function AssicuraAvvioBridge() {
    try {
        var nodePortable = fso.BuildPath(currentDir, "App_Mobile\\bin\\node.exe");
        var bridgePortable = fso.BuildPath(currentDir, "App_Mobile\\server\\db_bridge.js");
        if (fso.FileExists(nodePortable) && fso.FileExists(bridgePortable)) {
            var shell = new ActiveXObject("WScript.Shell");
            shell.Run('"' + nodePortable + '" "' + bridgePortable + '"', 0, false);
            return true;
        }
    } catch(e) {
        // Ignora
    }
    return false;
}

function queryAccessDB(sql, isRetry) {
    try {
        var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
        http.SetTimeouts(2000, 2000, 2000, 2000);
        http.Open("POST", "http://127.0.0.1:3002/query", false); // Synchronous
        http.SetRequestHeader("Content-Type", "application/json");
        http.Send(JSON.stringify({ sql: sql }));
        
        if (http.Status === 200) {
            return JSON.parse(http.ResponseText);
        } else {
            alert("Errore DB Query:\n" + http.ResponseText);
            return [];
        }
    } catch(errReq) {
        if (!isRetry && AssicuraAvvioBridge()) {
            var start = new Date().getTime();
            while (new Date().getTime() - start < 1500) {}
            return queryAccessDB(sql, true);
        }
        alert("Errore di connessione al Bridge locale (Assicurarsi che il server sia avviato):\n" + errReq.message + "\n\nQuery: " + sql);
        return [];
    }
}

function executeAccessDBCrud(sql, isRetry) {
    try {
        var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
        http.Open("POST", "http://127.0.0.1:3002/query", false); // Synchronous
        http.SetRequestHeader("Content-Type", "application/json");
        http.Send(JSON.stringify({ sql: sql }));
        
        if (http.Status === 200) {
            return true;
        } else {
            ScriviLogErrore("Errore DB CRUD: " + http.ResponseText + " - Query: " + sql);
            alert("Impossibile salvare i dati a causa di un errore interno del database. Le informazioni tecniche sono state registrate nel file log.");
            return false;
        }
    } catch(errReq) {
        if (!isRetry && AssicuraAvvioBridge()) {
            var start = new Date().getTime();
            while (new Date().getTime() - start < 1500) {}
            return executeAccessDBCrud(sql, true);
        }
        ScriviLogErrore("Errore di connessione al Bridge: " + errReq.message + " - Query: " + sql);
        alert("Impossibile connettersi al server locale. Assicurati che il bridge di collegamento sia avviato.");
        return false;
    }
}

function OttieniPercorsoBase() {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var locPath = window.location.pathname;
        if (locPath.charAt(0) === "/") locPath = locPath.substring(1);
        var baseDir = fso.GetParentFolderName(decodeURIComponent(locPath).replace(/\//g, "\\"));
        return baseDir;
    } catch(e) {
        return "";
    }
}

function ScriviLogErrore(messaggio) {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var baseDir = OttieniPercorsoBase();
        var logPath = baseDir ? fso.BuildPath(baseDir, "gestionale_log.txt") : "gestionale_log.txt";
        var file;
        if (fso.FileExists(logPath)) {
            file = fso.OpenTextFile(logPath, 8, true); // 8 = Append
        } else {
            file = fso.CreateTextFile(logPath, true);
        }
        var data = new Date();
        file.WriteLine("[" + data.toLocaleString() + "] " + messaggio);
        file.Close();
    } catch(e) {
        // Fallback silenzioso
    }
}

function executeAccessDBCrudAsync(sql, callback) {
    try {
        var http = new ActiveXObject("MSXML2.XMLHTTP");
        http.open("POST", "http://127.0.0.1:3002/query", true); // Asynchronous
        http.setRequestHeader("Content-Type", "application/json");
        http.onreadystatechange = function() {
            if (http.readyState === 4) {
                if (http.status === 200) {
                    if (callback) callback(true);
                } else {
                    ScriviLogErrore("Errore DB CRUD Asincrono: " + http.responseText + " - Query: " + sql);
                    alert("Impossibile completare l'operazione in background a causa di un errore del database. I dati verranno ricaricati.");
                    if (callback) callback(false);
                }
            }
        };
        http.send(JSON.stringify({ sql: sql }));
    } catch(errReq) {
        ScriviLogErrore("Eccezione DB CRUD Asincrono: " + errReq.message + " - Query: " + sql);
        alert("Errore di connessione al server locale durante l'operazione asincrona.");
        if (callback) callback(false);
    }
}

function sqlEscape(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "''");
}

function formatDateToDB(dateStr) {
    // da DD/MM/YYYY a YYYY-MM-DD per MS Access (#YYYY-MM-DD#)
    if (!dateStr || dateStr.length !== 10) return "NULL";
    var p = dateStr.split("/");
    return "#" + p[2] + "-" + p[1] + "-" + p[0] + "#";
}

function formatDBDateToIT(dbDate) {
    if (dbDate === null || dbDate === undefined || dbDate === "" || String(dbDate).toLowerCase() === "null") return "";
    
    // TENTATIVO 0: Se è già un numero (Seriale Access/Excel)
    var n = Number(dbDate);
    if (!isNaN(n) && n > 30000 && n < 60000) { 
        // 30000 è circa il 1982, 60000 è oltre il 2060. Range ragionevole per date.
        // Access usa giorni dal 30/12/1899. JS usa ms dal 1/1/1970.
        var dateJS = new Date((n - 25569) * 86400 * 1000);
        if (!isNaN(dateJS.getTime())) {
            var gN = dateJS.getDate(); if(gN<10) gN="0"+gN;
            var mN = dateJS.getMonth()+1; if(mN<10) mN="0"+mN;
            return gN + "/" + mN + "/" + dateJS.getFullYear();
        }
    }

    var s = String(dbDate).trim();
    if(s === "") return "";

    // TENTATIVO 1: Regex IT (GG/MM/AAAA o GG-MM-AAAA)
    var mIT = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (mIT) {
        var rg2 = mIT[1]; if(rg2.length<2) rg2="0"+rg2;
        var rm2 = mIT[2]; if(rm2.length<2) rm2="0"+rm2;
        return rg2 + "/" + rm2 + "/" + mIT[3];
    }
    
    // TENTATIVO 2: Regex ISO (AAAA-MM-GG)
    var mISO = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (mISO) {
        var rg = mISO[3]; if(rg.length<2) rg="0"+rg;
        var rm = mISO[2]; if(rm.length<2) rm="0"+rm;
        return rg + "/" + rm + "/" + mISO[1];
    }

    // TENTATIVO 3: Oggetto Data Nativo o Fallback IE
    try {
        var d = new Date(dbDate);
        if (!isNaN(d.getTime())) {
            var gg = d.getDate(); if(gg<10) gg="0"+gg;
            var mm = d.getMonth()+1; if(mm<10) mm="0"+mm;
            return gg + "/" + mm + "/" + d.getFullYear();
        }
    } catch(e) {}

    // TENTATIVO 4: Fallback euristico (cerca sequenze di numeri nel testo)
    var cifre = s.match(/\d+/g);
    if (cifre && cifre.length >= 2) {
        var anno = ""; var resto = [];
        for(var i=0; i<cifre.length; i++) {
            if(cifre[i].length === 4) anno = cifre[i];
            else resto.push(cifre[i]);
        }
        if(anno !== "" && resto.length >= 1) {
            var ggVal = resto[0]; if(ggVal.length<2) ggVal="0"+ggVal;
            var mmVal = "00";
            var mesiEN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var mesiIT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
            for(var m=0; m<12; m++) {
                if(s.indexOf(mesiEN[m])>-1 || s.indexOf(mesiIT[m])>-1) {
                    mmVal = (m+1); if(mmVal<10) mmVal="0"+mmVal; break;
                }
            }
            if(mmVal === "00" && resto.length >= 2) {
                mmVal = resto[1]; if(mmVal.length<2) mmVal="0"+mmVal;
            }
            if(mmVal !== "00") return ggVal + "/" + mmVal + "/" + anno;
        }
    }

    return "";
}

function checkAndMigrateExpenseColumns() {
    try {
        var columns = [
            "RimborsoAutostrada DOUBLE",
            "RimborsoParcheggio DOUBLE",
            "RimborsoTrenoAvaria DOUBLE",
            "RimborsoVarie DOUBLE",
            "RimborsoNote MEMO",
            "TotaleRimborso DOUBLE"
        ];
        for (var i = 0; i < columns.length; i++) {
            try {
                var sql = "ALTER TABLE tblConsegne ADD COLUMN " + columns[i];
                var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
                http.Open("POST", "http://127.0.0.1:3002/query", false);
                http.SetRequestHeader("Content-Type", "application/json");
                http.Send(JSON.stringify({ sql: sql }));
            } catch (e) {}
        }
    } catch(err) {}
}

// ==========================================
// STARTUP MASCHERA
// ==========================================

window.onload = function() {
    // Universal Cleanup (Mappa-Chiudi)
    Document_CleanupOtherWindows();
    checkAndMigrateExpenseColumns();
    
    CaricaProfiloUtente();
    InitFiltriTemporali();
    PopolaTendenzeDB();
    ConfiguraMotoreUI();
    ConfiguraAutocompletamento();
    ConfiguraCalendario();
    CaricaStatiOperativi();
    CaricaEnti();
    
    // Configura i doppi click sul campo data
    document.getElementById("txtDataConsegna").ondblclick = function() {
        ApriCalendario(this.id);
    };

    // Inserisce icona salva rapido su ogni label
    var editorLabels = document.querySelectorAll('#editorPanel .form-group label');
    for (var i = 0; i < editorLabels.length; i++) {
        var lbl = editorLabels[i];
        if (lbl.id === "lblChiusa" || lbl.innerText.indexOf("CHIUSA") > -1) continue;
        var saveIco = document.createElement('i');
        saveIco.className = 'fa fa-save q-action';
        saveIco.style.cssText = 'cursor:pointer; color:#0ea5e9; float:right; font-size:14px; transition:color 0.2s; padding: 2px;';
        saveIco.title = 'Salva Modifiche';
        saveIco.onclick = function() { if(document.getElementById('cmdSalva')) document.getElementById('cmdSalva').click(); };
        saveIco.onmouseover = function() { this.style.color = '#38bdf8'; };
        saveIco.onmouseout = function() { this.style.color = '#0ea5e9'; };
        lbl.appendChild(saveIco);
    }

    // Caricamento configurazioni locali (cartella export)
    CaricaConfigurazioniLocali();

    // Avvio Monitor Notifiche da Mobile App
    InitNotificheMobile();

    // Inizializzazione Ponte Materiali (Excel Ufficio)
    InitPonteMateriali();

    // Imposta il focus iniziale per permettere la ricerca/inserimento immediato
    var tNome = document.getElementById("txtNome");
    if(tNome) {
        tNome.focus();
        tNome.addEventListener("keyup", function() { 
            setTimeout(UpdateSmartExcelBadge, 500); 
        });
    }
    
    var cLoc = document.getElementById("cmbLocalita");
    if(cLoc) {
        cLoc.onchange = function() { UpdateSmartExcelBadge(); };
    }

    // Controllo Bridge da Calendario Promemoria (consegne_date_bridge.tmp)
    try {
        var bPathDate = fso.BuildPath(fso.BuildPath(currentDir, "system"), "consegne_date_bridge.tmp");
        if(fso.FileExists(bPathDate)) {
            var tsDate = fso.OpenTextFile(bPathDate, 1);
            var bridgeDate = tsDate.ReadLine().trim();
            tsDate.Close();
            fso.DeleteFile(bPathDate);
            
            if (bridgeDate && bridgeDate.length === 10) {
                var parts = bridgeDate.split("/");
                var mesiIT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                var meseNome = mesiIT[parseInt(parts[1], 10) - 1];
                var annoVal = parts[2];
                
                // Seleziona mese e anno nei dropdown dei filtri temporali
                document.getElementById("cmbMese").value = meseNome;
                document.getElementById("cmbAnni").value = annoVal;
                AggiornaTitoloMese();
                
                // Imposta il valore nel campo di ricerca per filtrare esattamente quel giorno
                document.getElementById("txtRicerca").value = bridgeDate;
                
                // Forza la ricerca e focus sulla ricerca
                setTimeout(function() {
                    try {
                        CercaConsegne();
                        document.getElementById("txtRicerca").focus();
                    } catch(errC) {}
                }, 300);
            }
        }
    } catch(e) {}

    // --- INTEGRAZIONE DA DASHBOARD (QueryString ?id=XXX o via File Bridge) ---
    try {
        var targetId = null;
        var bPathId = fso.BuildPath(fso.BuildPath(currentDir, "system"), "consegne_id_bridge.tmp");
        if (fso.FileExists(bPathId)) {
            try {
                var tsId = fso.OpenTextFile(bPathId, 1);
                targetId = tsId.ReadLine().trim();
                tsId.Close();
                fso.DeleteFile(bPathId);
            } catch(eBridge) {}
        }
        
        if (!targetId) {
            var params = document.location.search;
            if (params && params.indexOf("id=") > -1) {
                var matchId = params.match(/[?&]id=(\d+)/);
                if (matchId && matchId[1]) {
                    targetId = matchId[1];
                }
            }
        }
        
        if (targetId) {
            // 1. Recupera le informazioni sul mese/anno di questa consegna dal DB
            var resInfo = queryAccessDB("SELECT ID, MeseRiferimento, AnnoRiferimento, DataConsegna FROM tblConsegne WHERE ID = " + targetId);
            if (resInfo && resInfo.length > 0) {
                var rowInfo = resInfo[0];
                var targetMonth = null;
                var targetYear = null;

                if (rowInfo.MeseRiferimento && rowInfo.AnnoRiferimento) {
                    targetMonth = Number(rowInfo.MeseRiferimento);
                    targetYear = Number(rowInfo.AnnoRiferimento);
                } else if (rowInfo.DataConsegna) {
                    var parts = formatDBDateToIT(rowInfo.DataConsegna).split("/");
                    if (parts.length === 3) {
                        targetMonth = Number(parts[1]);
                        targetYear = Number(parts[2]);
                    }
                }

                if (targetMonth && targetYear) {
                    // Reset robusto dello stato dei filtri per evitare che la consegna venga esclusa
                    currentFilterState = "";
                    var btnFiltri = document.querySelectorAll(".btn-filter");
                    if (btnFiltri) {
                        for (var q = 0; q < btnFiltri.length; q++) {
                            btnFiltri[q].className = btnFiltri[q].className.replace(" active", "");
                        }
                    }
                    var btnTutti = document.getElementById("btnFiltroTutti");
                    if (btnTutti) btnTutti.className += " active";

                    var tRicerca = document.getElementById("txtRicerca");
                    if (tRicerca) tRicerca.value = "";
                    var tRicercaGlobale = document.getElementById("txtRicercaGlobale");
                    if (tRicercaGlobale) tRicercaGlobale.value = "";

                    // Imposta mese e anno nei filtri dell'UI per garantire la visibilità del record
                    var mesiIT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                    var meseNome = mesiIT[targetMonth - 1];
                    
                    document.getElementById("cmbMese").value = meseNome;
                    
                    // Verifica robusta sull'esistenza dell'anno nel dropdown, altrimenti aggiungilo al volo
                    var optExist = false;
                    var cmbA = document.getElementById("cmbAnni");
                    for (var o = 0; o < cmbA.options.length; o++) {
                        if (Number(cmbA.options[o].value) === targetYear) { optExist = true; break; }
                    }
                    if (!optExist) {
                        var optNew = document.createElement("option");
                        optNew.value = targetYear; optNew.text = targetYear;
                        cmbA.appendChild(optNew);
                    }
                    
                    cmbA.value = targetYear;
                    AggiornaTitoloMese();
                }
                
                // 2. Esegui la ricerca passando l'ID per caricarlo, evidenziarlo ed espanderlo
                setTimeout(function() {
                    CercaConsegne(targetId);
                }, 400);
            }
        }
    } catch(eParams) {}
};

// Registrazione del gestore di salvataggio rapido da tastiera
if (document.attachEvent) {
    document.attachEvent("onkeydown", GestisciSalvataggioRapido);
} else if (document.addEventListener) {
    document.addEventListener("keydown", GestisciSalvataggioRapido);
}

function GestisciSalvataggioRapido(e) {
    e = e || window.event;
    var key = e.keyCode || e.which;
    var target = e.target || e.srcElement;
    var targetId = target ? target.id : "";
    
    // --- SMART TAB (Miglioramento UX: Navigazione fluida tra segmenti) ---
    if (key === 9) { // TAB
        var shift = e.shiftKey;
        // Da Anagrafica -> Logistica
        if (targetId === "txtStatoInvalidita" && !shift) {
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            if (document.getElementById("cardAnagrafica") && document.getElementById("cardAnagrafica").className.indexOf("collapsed") === -1) ToggleCard("cardAnagrafica");
            if (document.getElementById("cardLogistica") && document.getElementById("cardLogistica").className.indexOf("collapsed") !== -1) ToggleCard("cardLogistica");
            setTimeout(function(){ if(document.getElementById("txtDataConsegna")) document.getElementById("txtDataConsegna").focus(); }, 100);
            return false;
        }
        // Da Logistica -> Anagrafica
        if (targetId === "txtDataConsegna" && shift) {
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            if (document.getElementById("cardLogistica") && document.getElementById("cardLogistica").className.indexOf("collapsed") === -1) ToggleCard("cardLogistica");
            if (document.getElementById("cardAnagrafica") && document.getElementById("cardAnagrafica").className.indexOf("collapsed") !== -1) ToggleCard("cardAnagrafica");
            setTimeout(function(){ if(document.getElementById("txtStatoInvalidita")) document.getElementById("txtStatoInvalidita").focus(); }, 100);
            return false;
        }
        // Da Logistica -> Note
        if (targetId === "chkConsegnato" && !shift) {
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            if (document.getElementById("cardLogistica") && document.getElementById("cardLogistica").className.indexOf("collapsed") === -1) ToggleCard("cardLogistica");
            if (document.getElementById("cardNote") && document.getElementById("cardNote").className.indexOf("collapsed") !== -1) ToggleCard("cardNote");
            setTimeout(function(){ if(document.getElementById("txtNote")) document.getElementById("txtNote").focus(); }, 100);
            return false;
        }
        // Da Note -> Logistica
        if (targetId === "txtNote" && shift) {
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            if (document.getElementById("cardNote") && document.getElementById("cardNote").className.indexOf("collapsed") === -1) ToggleCard("cardNote");
            if (document.getElementById("cardLogistica") && document.getElementById("cardLogistica").className.indexOf("collapsed") !== -1) ToggleCard("cardLogistica");
            setTimeout(function(){ if(document.getElementById("chkConsegnato")) document.getElementById("chkConsegnato").focus(); }, 100);
            return false;
        }
    }
    
    // 1d. Ctrl + N per inserire una nuova consegna
    if (e.ctrlKey && key === 78) {
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        ActionNuovo();
        return false;
    }
    
    // 1c. Ctrl + Shift + C per copiare il riepilogo negli appunti
    if (e.ctrlKey && e.shiftKey && key === 67) {
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        ActionCopiaRiepilogo();
        return false;
    }
    
    // 1b. Ctrl + Canc (Delete) per eliminare la consegna corrente
    if (e.ctrlKey && key === 46) {
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        ActionElimina();
        return false;
    }
    
    // 1. Ctrl + S oppure Ctrl + Invio (da qualsiasi campo, inclusi i textareas)
    if (e.ctrlKey && (key === 83 || key === 13)) {
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        ActionSalva(true);
        return false;
    }
    
    // 2. Invio singolo sui campi di input a riga singola (senza tasti modificatori)
    if (key === 13 && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        var campiAbilitati = [
            "cmbProvincia", "cmbLocalita", "txtResidenza", "txtEmail", 
            "cmbEnte", "txtDataConsegna", "cmbOra", "txtOrdine", 
            "cmbStato", "txtKmAndata", "txtKmRitorno", "chkConsegnato"
        ];
        
        var isCampoValido = false;
        for (var i = 0; i < campiAbilitati.length; i++) {
            if (campiAbilitati[i] === targetId) {
                isCampoValido = true;
                break;
            }
        }
        
        if (isCampoValido) {
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            ActionSalva(true);
            return false;
        }
    }
}

function InitPonteMateriali() {
    try {
        var materialDir = fso.BuildPath(currentDir, "gestione_materiale");
        var dbJsonPath = fso.BuildPath(materialDir, "materiali_db.json");
        
        if (fso.FileExists(dbJsonPath)) {
            var f = fso.OpenTextFile(dbJsonPath, 1, false, -1); // -1 Unicode (da VBS)
            var content = f.ReadAll();
            f.Close();
            materialiExcelMemory = JSON.parse(content);
        }
    } catch(e) {}
}

function UpdateSmartExcelBadge() {
    var nom = document.getElementById("txtNome").value.trim();
    var loc = "";
    var elLoc = document.getElementById("cmbLocalita");
    if (elLoc.selectedIndex >= 0) loc = elLoc.options[elLoc.selectedIndex].text.trim();
    
    var badge = document.getElementById("lblSmartExcel");
    if (!badge) return;

    if (nom.length < 3) {
        badge.style.display = "none";
        return;
    }

    var match = FindMaterialMatch(nom, loc);
    if (match) {
        badge.style.display = "inline-block";
        badge.setAttribute("data-match-id", match.id);
    } else {
        badge.style.display = "none";
    }
}

function FindMaterialMatch(nome, localita) {
    if (!materialiExcelMemory || materialiExcelMemory.length === 0) return null;
    var nQ = String(nome).toUpperCase().replace(/\s+/g, ' ').trim();
    var lQ = String(localita || "").toUpperCase().trim();
    
    for (var i = 0; i < materialiExcelMemory.length; i++) {
        var item = materialiExcelMemory[i];
        var itemNom = String(item.nominativo || "").toUpperCase().replace(/\s+/g, ' ').trim();
        var itemLoc = String(item.citta || "").toUpperCase().trim();
        
        // Match esatto o se la località coincide
        if (itemNom === nQ && (lQ === "" || itemLoc === lQ)) {
            return item;
        }
        // Fallback per nomi lunghi (ricerca parziale)
        if (nQ.length > 5 && itemNom.indexOf(nQ) !== -1) {
            return item;
        }
    }
    return null;
}

function FindAllMaterialMatches(query) {
    if (!materialiExcelMemory || materialiExcelMemory.length === 0) return [];
    var results = [];
    var nQ = String(query).toUpperCase().replace(/\s+/g, ' ').trim();
    
    for (var i = 0; i < materialiExcelMemory.length; i++) {
        var item = materialiExcelMemory[i];
        var itemNom = String(item.nominativo || "").toUpperCase();
        if (itemNom.indexOf(nQ) !== -1) {
            results.push(item);
            if (results.length >= 5) break; // Limite per non intasare la UI
        }
    }
    return results;
}

function PopolaDaMaterialiJSON(item) {
    if(!item) return;
    
    // Reset della scheda per nuovo inserimento ibrido
    ActionNuovo();
    
    // --- FUSIONE INTELLIGENTE (SMART MERGE) ---
    // Cerchiamo se il cliente esiste nell'Anagrafica Master (Access)
    var resAccess = queryAccessDB("SELECT ID FROM tblClienti WHERE (isCancellato IS NULL OR isCancellato = 0) AND CognomeNome = '" + sqlEscape(item.nominativo) + "'");
    
    if (resAccess.length > 0) {
        // CASO A: CLIENTE REGISTRATO - Usiamo i dati ufficiali dell'Anagrafica
        // Carichiamo tutto (Indirizzo, Foto, Invalidità) ma NON sovrascriviamo il nome se già impostato
        PopolaDaAnagrafica(resAccess[0].ID, false);
        
        // Sovrascriviamo o aggiungiamo i materiali dall'Excel dell'ufficio
        if (item.materiali && item.materiali.length > 0) {
            var listM = [];
            for (var j = 0; j < item.materiali.length; j++) {
                var mat = item.materiali[j];
                var labelM = GetMaterialLabel(mat.nome, mat.valore);
                listM.push(String(labelM).toUpperCase());
            }
            var txtM = document.getElementById("txtMerce");
            txtM.value = listM.join(", ");
            txtM.onchange(); 
            txtM.classList.add("loaded-from-excel");
            try { document.getElementById("tagExcel").style.display = "inline-block"; } catch(e){}
            Highlight(txtM);
        }
        
        // Ente Riferimento (Aggiornamento anche per clienti registrati se presente in Excel)
        if (item.cliente) {
            document.getElementById("cmbEnte").value = item.cliente;
        }

        announce("FUSIONE COMPLETATA: Profilo Anagrafico + Materiali Ufficio");
    } else {
        // CASO B: NUOVO CLIENTE (Solo in Excel) - Usiamo i dati dell'ufficio
        document.getElementById("txtNome").value = item.nominativo;
        document.getElementById("txtResidenza").value = item.indirizzo || "";
        document.getElementById("txtTelefono").value = item.telefono || "";
        document.getElementById("txtEmail").value = item.email || "";
        
        // Località e Provincia (Fuzzy)
        var pValE = item.province || "";
        if (ImpostaValoreProvinciaFuzzy("cmbProvincia", pValE)) {
            document.getElementById("cmbProvincia").onchange();
        }
        document.getElementById("cmbLocalita").value = item.citta || "";
        
        // Ente Riferimento (Nuovo!)
        if (item.cliente) {
            document.getElementById("cmbEnte").value = item.cliente;
        }
        
        // Materiali
        if (item.materiali && item.materiali.length > 0) {
            var listE = [];
            for (var k = 0; k < item.materiali.length; k++) {
                var mE = item.materiali[k];
                var labE = GetMaterialLabel(mE.nome, mE.valore);
                listE.push(String(labE).toUpperCase());
            }
            document.getElementById("txtMerce").value = listE.join(", ");
            document.getElementById("txtMerce").onchange();
        }
        announce("Dati caricati dall'Ufficio per " + item.nominativo);
    }
    
    // UI Cleanup
    ApplicaEvidenziatoriPannelloDati();
    Highlight(document.getElementById("txtNome"));
}

function ActionCaricaMerceExcel() {
    var badge = document.getElementById("lblSmartExcel");
    var matchId = badge.getAttribute("data-match-id");
    if (!matchId) return;

    var item = null;
    for (var i = 0; i < materialiExcelMemory.length; i++) {
        if (materialiExcelMemory[i].id === matchId) {
            item = materialiExcelMemory[i];
            break;
        }
    }

    if (item && item.materiali) {
        var list = [];
        for (var j = 0; j < item.materiali.length; j++) {
            var m = item.materiali[j];
            var val = m.valore;
            var label = GetMaterialLabel(m.nome, m.valore);
            list.push(String(label).toUpperCase());
        }
        
        var txtMerce = document.getElementById("txtMerce");
        var merceStr = list.join(", ");
        
        if (confirm("Ho trovato questi materiali nell'Excel dell'ufficio:\n\n" + merceStr + "\n\nVuoi caricarli nella descrizione merce?")) {
            var oldVal = txtMerce.value.trim();
            if (oldVal !== "" && oldVal.indexOf(merceStr) === -1) {
                txtMerce.value = oldVal + ", " + merceStr;
            } else {
                txtMerce.value = merceStr;
            }
            
            // --- UI PREMIUM UPDATE ---
            txtMerce.classList.add("loaded-from-excel");
            var tagExcel = document.getElementById("tagExcel");
            if (tagExcel) tagExcel.style.display = "inline-block";
            
            Highlight(txtMerce);
            
            // --- ENTE RIFERIMENTO ---
            if (item.cliente) {
                document.getElementById("cmbEnte").value = item.cliente;
            }

            badge.style.display = "none"; // Nascondi dopo il caricamento
        }
    }
}

function Document_CleanupOtherWindows() {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var finalTitle = "GESTIONE CONSEGNE - C.M";
        
        // 1. Marchiamo temporaneamente questa finestra
        document.title = "PULIZIA_IN_CORSO_C";
        
        // 2. Pulizia Totale: uccidiamo ogni possibile istanza vecchia o appesa
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq AGENDA - Pannello di Controllo"', 0, true);
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq AGENDA - C.M"', 0, true);
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq ANAGRAFICA - C.M"', 0, true);
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq GESTIONE CONSEGNE - C.M"', 0, true);
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq CHIUSURA_IN_CORSO"', 0, true);
        
        // 3. Rimozione blocchi Database (Hanging Access processes)
        try { shell.Run('taskkill /F /IM msaccess.exe /T', 0, false); } catch(e3){}
        
        // 4. Titolo finale ufficiale
        document.title = finalTitle;
    } catch(e) { }
}

function CaricaConfigurazioniLocali() {
    var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "export_path.local");
    if(fso.FileExists(pConfig)) {
        try {
            var f = fso.OpenTextFile(pConfig, 1);
            exportPath = f.ReadLine();
            f.Close();
        } catch(e) {}
    }
}

function SalvaConfigurazionePercorso(path) {
    try {
        var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "export_path.local");
        var f = fso.CreateTextFile(pConfig, true);
        f.WriteLine(path);
        f.Close();
    } catch(e) {}
}

function OttieniPercorsoSalvataggioSicuro() {
    var shell = new ActiveXObject("WScript.Shell");
    var paths = [
        exportPath,
        shell.SpecialFolders("Desktop"),
        shell.SpecialFolders("MyDocuments"),
        currentDir
    ];
    
    for(var i=0; i<paths.length; i++) {
        var p = paths[i];
        if(p && p !== "" && p.indexOf("::") === -1 && fso.FolderExists(p)) {
            return p;
        }
    }
    return "";
}

function OttieniPercorsoBrowser() {
    var paths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    for(var i=0; i<paths.length; i++) {
        if(fso.FileExists(paths[i])) return paths[i];
    }
    return "";
}

function IsFileLocked(path) {
    if(!fso.FileExists(path)) return false;
    try {
        // Tentativo di apertura in scrittura esclusiva
        var f = fso.OpenTextFile(path, 8, false); 
        f.Close();
        return false;
    } catch(e) {
        return true;
    }
}

window.GestisciCartella = function(isCambio) {
    var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof require !== "undefined");
    
    var fallbackAnno = document.getElementById('cmbAnni') ? document.getElementById('cmbAnni').value : new Date().getFullYear().toString();
    var defaultFolder = fso.BuildPath(fso.GetParentFolderName(currentDir), 'REPORT_MENSILE_' + fallbackAnno);
    var pathToOpen = exportPath || defaultFolder;

    try {
        if (!fso.FolderExists(pathToOpen)) {
            fso.CreateFolder(pathToOpen);
        }
    } catch(e) {}

    if (!isCambio) {
        // Modalità APRI
        try {
            if (isElectron) {
                require('child_process').exec('explorer.exe "' + pathToOpen + '"');
            } else {
                var shell = new ActiveXObject("WScript.Shell");
                shell.Run('explorer.exe "' + pathToOpen + '"');
            }
        } catch(e) {
            alert("Errore nell'apertura della cartella: " + e.message);
        }
        return;
    }

    // Modalità CAMBIA
    if (isElectron) {
        try {
            var cp = require('child_process');
            var fs = require('fs');
            var path = require('path');
            
            var vbsScript = 'Set objShell = CreateObject("Shell.Application")\n' +
                            'Set objFolder = objShell.BrowseForFolder(0, "Seleziona la nuova cartella di salvataggio (es. Desktop o Documenti)", &H41, "")\n' +
                            'If objFolder Is Nothing Then\n' +
                            '    Wscript.Echo ""\n' +
                            'Else\n' +
                            '    Wscript.Echo objFolder.Self.Path\n' +
                            'End If';
            
            var tmpFile = path.join(process.env.TEMP || "C:\\Temp", 'folder_picker_' + Date.now() + '.vbs');
            fs.writeFileSync(tmpFile, vbsScript);
            
            cp.exec('cscript //Nologo "' + tmpFile + '"', function(err, stdout, stderr) {
                try { fs.unlinkSync(tmpFile); } catch(e) {}
                
                var pickedPath = (stdout || "").trim();
                if (pickedPath && pickedPath.indexOf("::") !== 0) {
                    exportPath = pickedPath;
                    var pConfig = path.join(currentDir, 'system', 'export_path.local');
                    fs.writeFileSync(pConfig, exportPath, 'utf8');
                    alert("Cartella impostata correttamente:\n" + exportPath);
                } else if (pickedPath && pickedPath.indexOf("::") === 0) {
                    alert("ATTENZIONE: Hai selezionato una cartella virtuale non valida.\nPer favore, seleziona una cartella reale come Desktop o Documenti.");
                }
            });
            return;
        } catch(ex) {
            console.error(ex);
        }
    }

    // Fallback MSHTA
    try {
        var objShell = new ActiveXObject("Shell.Application");
        var folder = objShell.BrowseForFolder(0, "Seleziona la nuova cartella di salvataggio", 0x41, "");
        if (folder) {
            var pathStr = "";
            try {
                pathStr = folder.Self.Path;
            } catch(e) {
                try { pathStr = folder.Items().Item().Path; } catch(e2) {}
            }
            if(!pathStr || pathStr.indexOf("::") === 0) {
                alert("ATTENZIONE: Hai selezionato una cartella virtuale non valida.\nPer favore, seleziona una cartella reale.");
                return;
            }
            exportPath = pathStr;
            var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "export_path.local");
            var f = fso.CreateTextFile(pConfig, true);
            f.WriteLine(exportPath);
            f.Close();
            alert("Cartella impostata correttamente:\n" + exportPath);
        }
    } catch(e) {
        alert("Errore nella selezione della cartella: " + e.message);
    }
}

function ScegliCartellaLavoro() {
    window.GestisciCartella(true);
}

function ApriPromemoria(clienteNome) {
    isNavigating = true;
    try {
        if (clienteNome) {
            var bridgePath = fso.BuildPath(fso.BuildPath(currentDir, "system"), "rem_search.tmp");
            try {
                var ts = fso.CreateTextFile(bridgePath, true);
                ts.Write(clienteNome);
                ts.Close();
            } catch(e1) {}
        }

        var htaPath = fso.BuildPath(currentDir, "promemoria.html");
        
        // 1. Lanciamo la nuova maschera
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
        
        // 2. Chiusura Robusta di questa finestra (CONSEGNE)
        AtomicClose();
    } catch(e) {
        alert("Errore nell'apertura dei Promemoria: " + e.message);
        isNavigating = false;
    }
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
        
        var profileWidget = document.getElementById("userProfileWidget");
        if (profileWidget) {
            var iconHtml = '<div style="width:22px; height:22px; border-radius:50%; background:rgba(56,189,248,0.2); border:1px solid #38bdf8; display:inline-flex; align-items:center; justify-content:center; margin-left:8px; overflow:hidden;"><img src="https://img.icons8.com/ios-filled/50/38bdf8/user-male-circle.png" style="width:13px; height:13px;"></div>';
            profileWidget.innerHTML = '<span style="font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">PROFILO: ' + user + '</span> ' + iconHtml;
        }
    } catch(e) { }
}

function AtomicClose() {
    try {
        ALLOW_CLOSE = true;
        window.onbeforeunload = null;
        
        // 1. Marchiamo la finestra in modo unico per il killer
        var uniqueKillerTitle = "TERMINATE_CONSEGNE_" + new Date().getTime();
        document.title = uniqueKillerTitle;
        window.focus();
        
        // 2. Tentativo di chiusura standard (veloce) e fallback taskkill coordinato
        setTimeout(function() {
            try {
                window.open('', '_self', '');
                window.close();
                if (typeof(DashboardConsegne) !== 'undefined') DashboardConsegne.close();
                self.close();
                
                // 3. Fallback Nucleare Sequenziale
                var sh = new ActiveXObject("WScript.Shell");
                sh.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq ' + uniqueKillerTitle + '"', 0, false);
                sh.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq CHIUSURA_IN_CORSO"', 0, false);
                sh.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq GESTIONE CONSEGNE - C.Milella"', 0, false);
            } catch(ex) {}
        }, 200);
    } catch(err) {}
}

var prevMeseIdx = new Date().getMonth();
var prevAnnoVal = new Date().getFullYear().toString();

function ShowSystemConfirm(title, msg, onConfirmCallback, onCancelCallback) {
    var modalId = "sys-confirm-modal";
    var existing = document.getElementById(modalId);
    if (existing) { if(existing.parentNode) existing.parentNode.removeChild(existing); }

    var overlay = document.createElement("div");
    overlay.id = modalId;
    overlay.style.position = "fixed";
    overlay.style.top = "0"; overlay.style.left = "0";
    overlay.style.width = "100vw"; overlay.style.height = "100vh";
    overlay.style.background = "rgba(0, 0, 0, 0.6)";
    overlay.style.zIndex = "100000";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.2s";

    var box = document.createElement("div");
    box.style.background = "rgba(15, 23, 42, 0.98)";
    box.style.border = "2px solid #0ea5e9";
    box.style.borderRadius = "16px";
    box.style.padding = "25px 30px";
    box.style.width = "400px";
    box.style.boxShadow = "0 15px 40px rgba(0,0,0,0.5)";
    box.style.fontFamily = "'Inter', sans-serif";
    box.style.transform = "scale(0.9)";
    box.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";

    var header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "15px";
    header.style.marginBottom = "20px";
    header.innerHTML = "<div style='color:#0ea5e9; font-size:24px;'><i class='fa fa-question-circle'></i></div>" + 
                       "<h3 style='margin:0; font-size:15px; font-weight:800; color:#ffffff; text-transform:uppercase;'>" + title + "</h3>";

    var body = document.createElement("div");
    body.style.fontSize = "13px";
    body.style.color = "#cbd5e1";
    body.style.marginBottom = "25px";
    body.style.lineHeight = "1.5";
    body.innerHTML = msg;

    var footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";

    var btnAnnulla = document.createElement("button");
    btnAnnulla.innerText = "Annulla";
    btnAnnulla.style.background = "transparent";
    btnAnnulla.style.border = "1px solid #475569";
    btnAnnulla.style.color = "#cbd5e1";
    btnAnnulla.style.padding = "8px 16px";
    btnAnnulla.style.borderRadius = "8px";
    btnAnnulla.style.cursor = "pointer";
    btnAnnulla.style.fontWeight = "bold";
    btnAnnulla.style.transition = "all 0.2s";
    btnAnnulla.onmouseover = function() { this.style.background = "rgba(255,255,255,0.05)"; };
    btnAnnulla.onmouseout = function() { this.style.background = "transparent"; };
    btnAnnulla.onclick = function() {
        overlay.style.opacity = "0";
        box.style.transform = "scale(0.9)";
        setTimeout(function(){ 
            if(overlay.parentNode) overlay.parentNode.removeChild(overlay); 
            if(typeof onCancelCallback === "function") onCancelCallback();
        }, 200);
    };

    var btnConferma = document.createElement("button");
    btnConferma.innerHTML = "<i class='fa fa-check'></i> Conferma";
    btnConferma.style.background = "#0ea5e9";
    btnConferma.style.border = "none";
    btnConferma.style.color = "#ffffff";
    btnConferma.style.padding = "8px 16px";
    btnConferma.style.borderRadius = "8px";
    btnConferma.style.cursor = "pointer";
    btnConferma.style.fontWeight = "bold";
    btnConferma.style.transition = "all 0.2s";
    btnConferma.onmouseover = function() { this.style.background = "#0284c7"; };
    btnConferma.onmouseout = function() { this.style.background = "#0ea5e9"; };
    btnConferma.onclick = function() {
        overlay.style.opacity = "0";
        box.style.transform = "scale(0.9)";
        setTimeout(function(){ 
            if(overlay.parentNode) overlay.parentNode.removeChild(overlay); 
            if(typeof onConfirmCallback === "function") onConfirmCallback();
        }, 200);
    };

    footer.appendChild(btnAnnulla);
    footer.appendChild(btnConferma);

    box.appendChild(header);
    box.appendChild(body);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    setTimeout(function(){
        overlay.style.opacity = "1";
        box.style.transform = "scale(1)";
    }, 10);
}

function VerificaAccessoStoricoAsync(onSuccess, onCancel) {
    var mSel = document.getElementById("cmbMese").selectedIndex;
    var aSel = parseInt(document.getElementById("cmbAnni").value, 10);
    var now = new Date();
    var aCorr = now.getFullYear();
    var mCorr = now.getMonth();
    
    if(aSel < aCorr || (aSel === aCorr && mSel < mCorr)) {
        var msg = "Stai accedendo allo storico di un mese precedente.<br><br>Vuoi proseguire per visualizzare o modificare i dati storici?";
        ShowSystemConfirm("ACCESSO STORICO", msg, onSuccess, onCancel);
    } else {
        onSuccess();
    }
}

function InitFiltriTemporali() {
    var cmbMese = document.getElementById("cmbMese");
    var cmbAnni = document.getElementById("cmbAnni");
    
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    mesi.forEach(function(m, idx) {
        var opt = document.createElement("option");
        opt.value = m; opt.text = m;
        // In VBA mese è base 1-12, js getMonth() è 0-11
        if (new Date().getMonth() === idx) opt.selected = true;
        cmbMese.appendChild(opt);
    });

    // Populate anni dal DB + Anni storici garantiti (2024 richiesto, 2025, 2026)
    var annoCorrente = new Date().getFullYear();
    var anniSet = {};
    anniSet[2024] = true; // Forza anno storico richiesto dall'utente
    anniSet[2025] = true;
    anniSet[2026] = true;
    anniSet[annoCorrente] = true;
    
    var sql = "SELECT DISTINCT YEAR(DataConsegna) AS Anno FROM tblConsegne WHERE DataConsegna IS NOT NULL";
    var resAnni = queryAccessDB(sql);
    resAnni.forEach(function(row) {
        if (row.Anno) anniSet[row.Anno] = true;
    });
    
    // Conversione in array ordinato in senso decrescente
    var arrayAnni = [];
    for (var a in anniSet) {
        if (anniSet.hasOwnProperty(a)) arrayAnni.push(parseInt(a, 10));
    }
    arrayAnni.sort(function(x, y) { return y - x; });
    
    // Riempimento selettore
    cmbAnni.innerHTML = ""; 
    arrayAnni.forEach(function(anno) {
        var opt = document.createElement("option");
        opt.value = anno; opt.text = anno;
        if(String(anno) === String(annoCorrente)) opt.selected = true;
        cmbAnni.appendChild(opt);
    });
    
    prevMeseIdx = cmbMese.selectedIndex;
    prevAnnoVal = cmbAnni.value;

    AggiornaTitoloMese();
    cmbMese.onchange = function() { 
        VerificaAccessoStoricoAsync(function() {
            prevMeseIdx = cmbMese.selectedIndex;
            AggiornaTitoloMese(); 
            ResetFiltriArchivio();
            CercaConsegne(); 
        }, function() {
            cmbMese.selectedIndex = prevMeseIdx;
        });
    };
    cmbAnni.onchange = function() { 
        VerificaAccessoStoricoAsync(function() {
            prevAnnoVal = cmbAnni.value;
            AggiornaTitoloMese();
            ResetFiltriArchivio();
            CercaConsegne(); 
        }, function() {
            cmbAnni.value = prevAnnoVal;
        });
    };
}

function ResetFiltriArchivio() {
    currentFilterState = "";
    var btnFiltri = document.querySelectorAll(".btn-filter");
    for(var q=0; q<btnFiltri.length; q++) {
        btnFiltri[q].className = btnFiltri[q].className.replace(" active", "");
        if (btnFiltri[q].id === "btnFiltroTutti") {
            btnFiltri[q].className += " active";
        }
    }
}

function AggiornaTitoloMese() {
    var mese = document.getElementById("cmbMese").value;
    document.getElementById("lblTitolo").innerText = "Responsabile della Logistica - " + mese.toUpperCase();
}

function ActionEsci() {
    if (!CheckUnsavedChanges()) return; // Intercetta modifiche non salvate
    try {
        if (window.parent && typeof window.parent.ApriModulo === "function" && window.parent !== window) {
            window.parent.ApriModulo("dashboard.html");
            return;
        }
        if (window.top && typeof window.top.ApriModulo === "function" && window.top !== window) {
            window.top.ApriModulo("dashboard.html");
            return;
        }
    } catch(eParent) {}
    isNavigating = true;
    
    var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
    if (isElectron) {
        try {
            var electron = require('electron');
            if (electron && electron.ipcRenderer) {
                // electron.ipcRenderer.send('show-parent');
            }
        } catch(e) {}
        window.close();
        return;
    }

    try {
        var shell = new ActiveXObject("WScript.Shell");
        var htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(e) {}
    window.close();
}

// --- LOGICA MODALE CATALOGO PRODOTTI (CONTESTUALE) ---
function ApriModalArticoli() {
    var modal = document.getElementById("modalArticoli");
    var content = document.getElementById("modalContentArticoli");
    var trigger = document.getElementById("txtMerce");
    
    // Calcolo posizione
    var rect = trigger.getBoundingClientRect();
    var topPos = rect.top + window.pageYOffset;
    var leftPos = rect.left + window.pageXOffset;
    
    // Se c'è spazio sotto lo mettiamo sotto, altrimenti sopra
    if (topPos + 450 > window.innerHeight) {
        content.style.top = (topPos - 430) + "px";
    } else {
        content.style.top = (topPos + 40) + "px";
    }
    content.style.left = (leftPos) + "px";

    modal.style.display = "block"; // Cambiato da flex a block per posizionamento assoluto
    modal.style.opacity = "0";
    setTimeout(function() { modal.style.opacity = "1"; }, 10);
}

function ChiudiModalArticoli() {
    var modal = document.getElementById("modalArticoli");
    modal.style.opacity = "0";
    setTimeout(function() { modal.style.display = "none"; }, 300);
}

function SvuotaMerce() {
    if(confirm("Vuoi cancellare tutto il contenuto della descrizione merce?")) {
        document.getElementById("txtMerce").value = "";
        document.getElementById("txtMerce").onchange();
        Highlight(document.getElementById("txtMerce"));
    }
}

function ConfermaSelezioneArticolo() {
    var lBox = document.getElementById("lstArticoli");
    if(lBox.selectedIndex === -1) {
        alert("Seleziona prima un articolo dal catalogo.");
        return;
    }
    // Sfruttiamo la logica dblclick già esistente simulandola
    lBox.ondblclick();
    ChiudiModalArticoli();
}

function PopolaTendenzeDB() {
    if(dipendenzePopolate) return;
    
    // Province
    var pr = queryAccessDB("SELECT DISTINCT Provincia FROM tblLocalita ORDER BY Provincia");
    var cPr = document.getElementById("cmbProvincia");
    cPr.innerHTML = '<option value="">Seleziona...</option>';
    pr.forEach(function(r) {
        var pVal = r.Provincia;
        if(!pVal) return;
        
        var displayLabel = pVal;
        var pUp = pVal.toUpperCase();
        if(pUp.indexOf("CITTÀ METROPOLITANA DI BARI") !== -1) displayLabel = "BARI (C.M.)";
        else if(pUp.indexOf("BARLETTA-ANDRIA-TRANI") !== -1 || pUp === "BAT") {
            pVal = "B.A.T.";
            displayLabel = "B.A.T.";
        }
        
        var o = document.createElement("option"); 
        o.value = pVal; 
        o.text = displayLabel;
        o.title = pVal; // Mostra il nome completo al passaggio del mouse
        cPr.appendChild(o);
    });
    
    cPr.onchange = function() {
        var queryProv = this.value;
        PopolaListaLocalita(queryProv);
        Highlight(this);
    };

    var cLoc = document.getElementById("cmbLocalita");
    if (cLoc) {
        cLoc.onchange = function() {
            var val = this.value.trim();
            if (val === "") return;
            
            var prov = document.getElementById("cmbProvincia").value;
            
            // Verifica se il valore è già nel datalist
            var opts = document.getElementById("listLocalita").options;
            var trovato = false;
            for (var i = 0; i < opts.length; i++) {
                if (opts[i].value.toUpperCase() === val.toUpperCase()) { trovato = true; break; }
            }
            
            if (!trovato && val !== "") {
                if (!prov) {
                    alert("Seleziona prima una Provincia per poter aggiungere un nuovo Comune all'elenco.");
                } else {
                    if (confirm("'" + val + "' non è presente nell'elenco dei comuni di " + prov + ".\n\nVuoi aggiungerlo definitivamente al database?")) {
                        addLocalita(val, prov);
                    }
                }
            }
            
            // SUGGERISCE E AUTOCOMPILA I KM BASANDOSI SUI PRECEDENTI DATI IN DB
            if (val !== "") {
                try {
                    var sqlKM = "SELECT TOP 1 KmAndata, KmRitorno FROM tblConsegne WHERE LocalitaConsegna = '" + sqlEscape(val) + "' AND KmAndata > 0 ORDER BY DataConsegna DESC, ID DESC";
                    var resKM = queryAccessDB(sqlKM);
                    if (resKM && resKM.length > 0) {
                        var suggestedKA = parseFloat(resKM[0].KmAndata) || 0;
                        var suggestedKR = parseFloat(resKM[0].KmRitorno) || 0;
                        
                        var inpKA = document.getElementById("txtKmAndata");
                        var inpKR = document.getElementById("txtKmRitorno");
                        if (inpKA && inpKR && (parseFloat(inpKA.value) || 0) === 0 && (parseFloat(inpKR.value) || 0) === 0) {
                            inpKA.value = suggestedKA;
                            inpKR.value = suggestedKR;
                            Highlight(inpKA);
                            Highlight(inpKR);
                            CalcolaKMTotale();
                        }
                    }
                } catch(e) {}
            }
            if (typeof UpdateSmartExcelBadge === "function") {
                UpdateSmartExcelBadge();
            }
            Highlight(this);
        };

        cLoc.ondblclick = function() {
            var val = this.value.trim();
            var prov = document.getElementById("cmbProvincia").value;
            if (!val) return;
            if (confirm("Vuoi eliminare definitivamente '" + val + "' (" + (prov || "tutte le prov.") + ") dall'elenco dei suggerimenti?")) {
                removeLocalita(val, prov);
            }
        };
    }

    // Campo ORA configurato per Time Picker Modale (Vedi funzioni dedicate a fine file)
    
    // Articoli (Categorie)
    var art = queryAccessDB("SELECT DISTINCT Categoria FROM tblArticoli ORDER BY Categoria");
    var cArt = document.getElementById("cmbArticoli");
    cArt.innerHTML = '<option value="">Tutti gli Articoli</option>';
    art.forEach(function(r) {
         var o = document.createElement("option"); o.value=r.Categoria; o.text=r.Categoria; cArt.appendChild(o);
    });
    PopolaListaArticoli("");
    
    cArt.onchange = function() { PopolaListaArticoli(this.value); };
    
    dipendenzePopolate = true;
    
    // ============================================
    // Cross-Linking da Anagrafica (Filtro Autocentrato)
    // ============================================
    var autoFilter = "";
    if (typeof localStorage !== "undefined") {
        autoFilter = localStorage.getItem("filtroConsegneAuto");
        if (autoFilter) {
            document.getElementById("txtRicercaGlobale").value = autoFilter;
            localStorage.removeItem("filtroConsegneAuto"); // Consumato e rimosso
        }
    }
    
    CercaConsegne(); // Avvia ricerca base all'apertura (applicherà l'eventuale filtro pescato da localStorage)
}

// ==========================================
// AUTOCOMPLETAMENTO ANAGRAFICA DA tblClienti
// ==========================================
function ConfiguraAutocompletamento() {
    var txtNome = document.getElementById("txtNome");
    var sugg = document.getElementById("suggerimenti");
    
    // Evento doppio click per aprire Anagrafica (Consolidato con navigazione atomica)
    document.getElementById("txtNome").ondblclick = function() {
        var val = this.value.trim();
        if(val === "") return;
        
        isNavigating = true;
        try {
            var bridgePath = fso.BuildPath(fso.BuildPath(currentDir, "system"), "search.tmp");
            try {
                var ts = fso.CreateTextFile(bridgePath, true);
                ts.Write(val);
                ts.Close();
            } catch(e1) {}

            var shell = new ActiveXObject("WScript.Shell");
            var htaPath = fso.BuildPath(currentDir, "anagrafica.html");
            
            // Marchiamo la finestra per la chiusura atomica
            document.title = "CHIUSURA_IN_CORSO";
            shell.Run('mshta.exe "' + htaPath + '"', 1, false);
            AtomicClose();
        } catch(e) {
            alert("Errore nell'apertura dell'Anagrafica: " + e.message);
            isNavigating = false;
        }
    };

    document.getElementById("txtNome").oninput = function() {
        document.getElementById("lblClientID").value = ""; 
        Highlight(this);
    };

    // Integrazione ORO: Caricamento materiali su uscita dal campo (anche per nuovi inserimenti)
    document.getElementById("txtNome").onblur = function() {
        var val = this.value.trim();
        if(val === "") return;
        
        var txtMerce = document.getElementById("txtMerce");
        if(txtMerce.value.trim() === "" || document.getElementById("cmbEnte").value === "") {
            var excelData = LoadMaterialsForPatient(val);
            
            // Materiali
            if(excelData.materials !== "" && txtMerce.value.trim() === "") {
                txtMerce.value = excelData.materials;
                Highlight(txtMerce);
                try { document.getElementById("lblConteggioMerce").innerText = "(MATERIALI AUTO-CARICATI)"; } catch(e){}
            }
            
            // Ente
            var elEnte = document.getElementById("cmbEnte");
            if (elEnte && elEnte.value === "" && excelData.ente !== "") {
                elEnte.value = excelData.ente;
                Highlight(elEnte);
            }
        }
    };

    document.getElementById("txtNome").onkeyup = function(e) {
        var searchVal = this.value.trim();
        if(searchVal.length < 2) {
            sugg.style.display = "none";
            return;
        }
        
        sugg.innerHTML = "";
        var found = false;

        // 1. RICERCA IN ANAGRAFICA STORICA (ACCESS)
        var rs = queryAccessDB("SELECT TOP 10 ID, CognomeNome FROM tblClienti WHERE (isCancellato IS NULL OR isCancellato = 0) AND CognomeNome LIKE '%" + sqlEscape(searchVal) + "%'");
        for (var i = 0; i < rs.length; i++) {
            found = true;
            var cliente = rs[i];
            var div = document.createElement("div");
            div.innerHTML = "<i class='fa fa-history' style='color:#666; margin-right:8px;'></i> " + cliente.CognomeNome;
            div.onclick = (function(c) {
                return function() {
                    txtNome.value = c.CognomeNome;
                    sugg.style.display = "none";
                    PopolaDaAnagrafica(c.ID, false);
                };
            })(cliente);
            sugg.appendChild(div);
        }

        // 2. RICERCA IN MATERIALI UFFICIO (JSON/EXCEL)
        var matches = FindAllMaterialMatches(searchVal);
        for (var j = 0; j < matches.length; j++) {
            found = true;
            var item = matches[j];
            
            // Verifica se questo cliente dell'ufficio è già presente in Anagrafica Master
            var isLinked = false;
            var chkLink = queryAccessDB("SELECT ID FROM tblClienti WHERE CognomeNome = '" + sqlEscape(item.nominativo) + "'");
            if (chkLink.length > 0) isLinked = true;

            var divA = document.createElement("div");
            divA.style.borderLeft = isLinked ? "4px solid #005a9e" : "4px solid #ffab00";
            divA.style.background = isLinked ? "#f0f7ff" : "#fffdeb";
            
            var icon = isLinked ? "<i class='fa fa-check-circle' style='color:#005a9e; margin-right:8px;'></i>" : "<i class='fa fa-archive' style='color:#ffab00; margin-right:8px;'></i>";
            var labelLink = isLinked ? " <small style='color:#005a9e; font-weight:bold;'>(Anagrafica + Materiali)</small>" : " <small style='color:#ffab00;'>(Solo Materiali)</small>";
            
            var cittaStr = item.citta || "";
            var indirizzoStr = item.indirizzo || "";
            var displayLoc = (cittaStr !== "" || indirizzoStr !== "") ? (cittaStr + " " + indirizzoStr).trim() : "Nessun indirizzo in Excel";

            divA.innerHTML = icon + " <b>" + item.nominativo + "</b>" + labelLink + "<br><small style='color:#999; margin-left:24px;'>" + displayLoc + "</small>";
            
            divA.onclick = (function(it) {
                return function() {
                    sugg.style.display = "none";
                    PopolaDaMaterialiJSON(it);
                };
            })(item);
            sugg.appendChild(divA);
        }

        if(found) {
            sugg.style.display = "block";
        } else {
            sugg.style.display = "none";
        }
    };
    
    // Chiudi lista suggerimenti se clicchi fuori
    document.onclick = function(e) {
        if(e.target.id !== "txtNome") sugg.style.display = "none";
    };
}

// ==========================================
// LOGICA CALENDARIO
// ==========================================
var targetInputId = "";
var calDate = new Date();

function ConfiguraCalendario() {
    document.getElementById("btnCalChiudi").onclick = function() { document.getElementById("calendarOverlay").style.display = "none"; };
    document.getElementById("btnCalPrev").onclick = function() { calDate.setMonth(calDate.getMonth() - 1); RenderCalendario(); };
    document.getElementById("btnCalNext").onclick = function() { calDate.setMonth(calDate.getMonth() + 1); RenderCalendario(); };
    
    var btnOggi = document.getElementById("btnCalOggi");
    if (btnOggi) {
        btnOggi.onclick = function() {
            var d = new Date();
            var dd = (d.getDate()<10?'0':'')+d.getDate();
            var mm = ((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1);
            var valIdx = dd + "/" + mm + "/" + d.getFullYear();
            document.getElementById(targetInputId).value = valIdx;
            document.getElementById("calendarOverlay").style.display = "none";
            // Trigger highlight update
            try { Highlight(document.getElementById(targetInputId)); } catch(e){}
        };
    }
}

function ApriCalendario(inputId) {
    targetInputId = inputId;
    var val = document.getElementById(inputId).value;
    var parsedDate = null;
    if(val.length === 10) {
        var p = val.split("/");
        if(p.length === 3) {
            var day = parseInt(p[0], 10);
            var month = parseInt(p[1], 10) - 1;
            var year = parseInt(p[2], 10);
            if(!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                parsedDate = new Date(year, month, day);
            }
        }
    }
    if (parsedDate && !isNaN(parsedDate.getTime())) {
        calDate = parsedDate;
    } else {
        calDate = new Date();
    }
    RenderCalendario();
    document.getElementById("calendarOverlay").style.display = "flex";
}

function RenderCalendario() {
    var container = document.getElementById("gridCalendario");
    container.innerHTML = "";
    
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    document.getElementById("lblCalMeseAnno").innerText = mesi[calDate.getMonth()] + " " + calDate.getFullYear();
    
    var table = document.createElement("table");
    table.className = "cal-table";
    
    var thead = document.createElement("thead");
    var trH = document.createElement("tr");
    var days = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];
    days.forEach(function(d, i){ 
        var th = document.createElement("th"); 
        th.innerText = d; 
        if(i === 5) th.style.color = "#005a9e"; // Sabato
        if(i === 6) th.style.color = "#e74c3c"; // Domenica
        trH.appendChild(th); 
    });
    thead.appendChild(trH);
    table.appendChild(thead);
    
    var tbody = document.createElement("tbody");
    var firstDay = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();
    if(firstDay === 0) firstDay = 7;
    
    var lastDay = new Date(calDate.getFullYear(), calDate.getMonth()+1, 0).getDate();
    var dayCount = 1;
    
    for(var r=0; r<6; r++) {
        var tr = document.createElement("tr");
        for(var c=1; c<=7; c++) {
            var td = document.createElement("td");
            var pos = r * 7 + c;
            if(pos >= firstDay && dayCount <= lastDay) {
                var btn = document.createElement("button");
                btn.className = "calendar-day-btn";
                
                // Weekend
                if (c === 6) btn.className += " sat"; 
                if (c === 7) btn.className += " sun";
                
                // Colorazione Festivi Italiani
                if (IsItalianHoliday(dayCount, calDate.getMonth() + 1, calDate.getFullYear())) {
                    if (btn.className.indexOf("sun") === -1) btn.className += " sun";
                }

                btn.innerText = dayCount;
                if(dayCount === new Date().getDate() && calDate.getMonth() === new Date().getMonth() && calDate.getFullYear() === new Date().getFullYear()) {
                    btn.className += " today";
                }
                btn.onclick = (function(d) {
                    return function() {
                        var dd = (d<10?'0':'')+d;
                        var mm = ((calDate.getMonth()+1)<10?'0':'')+(calDate.getMonth()+1);
                        var a = calDate.getFullYear();
                        var dataStr = dd + "/" + mm + "/" + a;
                        
                        // VALIDAZIONE: Blocca festivi e sabati
                        if (IsItalianHoliday(d, calDate.getMonth() + 1, a) || (new Date(a, calDate.getMonth(), d).getDay() === 0)) {
                            alert("FESTIVITÀ: " + dataStr + " non puoi digitarla.");
                            return;
                        }
                        if (new Date(a, calDate.getMonth(), d).getDay() === 6) {
                            alert("SABATO: " + dataStr + " non puoi digitarla.");
                            return;
                        }
                        
                        document.getElementById(targetInputId).value = dataStr;
                        document.getElementById("calendarOverlay").style.display = "none";
                        try { Highlight(document.getElementById(targetInputId)); } catch(e){}
                        try { document.getElementById(targetInputId).onblur(); } catch(e){}
                    };
                })(dayCount);
                td.appendChild(btn);
                dayCount++;
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
        if(dayCount > lastDay) break;
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

function IsItalianHoliday(day, month, year) {
    if (day === 1 && month === 1) return true;   // Capodanno
    if (day === 6 && month === 1) return true;   // Epifania
    if (day === 8 && month === 5) return true;   // S. Nicola (Patrono)
    if (day === 25 && month === 4) return true;  // Liberazione
    if (day === 1 && month === 5) return true;   // Lavoro
    if (day === 2 && month === 6) return true;   // Repubblica
    if (day === 15 && month === 8) return true;  // Ferragosto
    if (day === 1 && month === 11) return true;  // Ognissanti
    if (day === 8 && month === 12) return true;  // Immacolata
    if (day === 25 && month === 12) return true; // Natale
    if (day === 26 && month === 12) return true; // S. Stefano
    
    var a = year % 19, b = Math.floor(year / 100), c = year % 100,
        d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451),
        monthPasqua = Math.floor((h + l - 7 * m + 114) / 31),
        dayPasqua = ((h + l - 7 * m + 114) % 31) + 1;
        
    if (day === dayPasqua && month === monthPasqua) return true;
    var dtP = new Date(year, monthPasqua - 1, dayPasqua);
    dtP.setDate(dtP.getDate() + 1);
    if (day === dtP.getDate() && month === (dtP.getMonth() + 1)) return true;
    return false;
}


// ==========================================
// ANAGRAFICA BRIDGE & NORMALIZZAZIONE
// ==========================================
var MAPPA_PROVINCE = {
    "AG": "Agrigento", "AL": "Alessandria", "AN": "Ancona", "AO": "Aosta", "AR": "Arezzo", "AP": "Ascoli Piceno", "AT": "Asti", "AV": "Avellino", "BA": "Città Metropolitana di Bari", "BT": "B.A.T.", "BAT": "B.A.T.", "BL": "Belluno", "BN": "Benevento", "BG": "Bergamo", "BI": "Biella", "BO": "Bologna", "BZ": "Bolzano", "BS": "Brescia", "BR": "Brindisi", "CA": "Cagliari", "CL": "Caltanissetta", "CB": "Campobasso", "CE": "Caserta", "CH": "Chieti", "CO": "Como", "CR": "Cremona", "CS": "Cosenza", "CT": "Catania", "CZ": "Catanzaro", "EN": "Enna", "FC": "Forlì-Cesena", "FE": "Ferrara", "FG": "Foggia", "FI": "Firenze", "FM": "Fermo", "FR": "Frosinone", "GE": "Genova", "GO": "Gorizia", "GR": "Grosseto", "IM": "Imperia", "IS": "Isernia", "KR": "Crotone", "LT": "Latina", "LE": "Lecce", "LC": "Lecco", "LI": "Livorno", "LO": "Lodi", "LU": "Lucca", "MC": "Macerata", "MN": "Mantova", "MS": "Massa-Carrara", "MT": "Matera", "ME": "Messina", "MI": "Milano", "MO": "Modena", "MB": "Monza e della Brianza", "NA": "Napoli", "NO": "Novara", "NU": "Nuoro", "OR": "Oristano", "PD": "Padova", "PA": "Palermo", "PR": "Parma", "PV": "Pavia", "PG": "Perugia", "PU": "Pesaro e Urbino", "PE": "Pescara", "PC": "Piacenza", "PI": "Pisa", "PT": "Pistoia", "PN": "Pordenone", "PZ": "Potenza", "PO": "Prato", "RG": "Ragusa", "RA": "Ravenna", "RC": "Reggio Calabria", "RE": "Reggio Emilia", "RI": "Rieti", "RN": "Rimini", "RM": "Roma", "RO": "Rovigo", "SA": "Salerno", "SS": "Sassari", "SV": "Savona", "SI": "Siena", "SR": "Siracusa", "SO": "Sondrio", "SU": "Sud Sardegna", "TA": "Taranto", "TE": "Teramo", "TR": "Terni", "TO": "Torino", "TP": "Trapani", "TN": "Trento", "TV": "Treviso", "TS": "Trieste", "UD": "Udine", "VA": "Varese", "VE": "Venezia", "VB": "Verbano-Cusio-Ossola", "VC": "Vercelli", "VR": "Verona", "VV": "Vibo Valentia", "VI": "Vicenza", "VT": "Viterbo"
};

function NormalizzaProvincia(sigla) {
    if(!sigla) return "";
    var s = sigla.toString().toUpperCase().trim().replace(/\./g, '');
    if(s === "BT") return "B.A.T.";
    if(s === "BA") return "Città Metropolitana di Bari";
    if(MAPPA_PROVINCE[s]) return MAPPA_PROVINCE[s];
    return sigla;
}

function ImpostaValoreProvinciaFuzzy(idDropdown, sigla) {
    var el = document.getElementById(idDropdown);
    if (!el) return false;
    
    var siglaNorm = sigla.toString().toUpperCase().trim().replace(/\./g, '');
    var nomeEsteso = NormalizzaProvincia(siglaNorm).toUpperCase();
    
    // 1. Tentativo match esatto (es: BAT === BAT)
    for (var i = 0; i < el.options.length; i++) {
        var optVal = el.options[i].value.toUpperCase();
        var optText = el.options[i].text.toUpperCase();
        if (optVal === siglaNorm || optText === nomeEsteso || optVal === nomeEsteso) {
            el.selectedIndex = i;
            return true;
        }
    }
    
    // 2. Tentativo match parziale (es: "Città Metropolitana di Bari" contiene "BARI")
    for (var j = 0; j < el.options.length; j++) {
        var optT = el.options[j].text.toUpperCase();
        if (optT.indexOf(siglaNorm) !== -1 || (nomeEsteso !== "" && optT.indexOf(nomeEsteso) !== -1)) {
            el.selectedIndex = j;
            return true;
        }
    }
    return false;
}
function PopolaDaAnagrafica(idCl, skipBasic) {
    if(!idCl) return;
    var res = queryAccessDB("SELECT * FROM tblClienti WHERE ID = " + idCl);
    if(res.length > 0) {
        var row = res[0];
        document.getElementById("lblClientID").value = row.ID;
        
        var elNome = document.getElementById("txtNome");
        var elRes = document.getElementById("txtResidenza");
        var elProv = document.getElementById("cmbProvincia");
        var elLoc = document.getElementById("cmbLocalita");
        var elTel = document.getElementById("txtTelefono");
        var elMail = document.getElementById("txtEmail");
        var elStatoInv = document.getElementById("txtStatoInvalidita");

        // Regola: Se NON stiamo facendo lo skip, sovrascrivi tutto.
        // Se stiamo facendo lo skip, riempi solo quello che è vuoto.
        if (!skipBasic || elNome.value === "") elNome.value = row.CognomeNome || "";
        
        // PIANO B LOGISTICS INTERCEPTION: Se esiste un indirizzo logistico (consegna fisica), USALO al posto della residenza amministrativa!
        var resVal = row.Residenza || "";
        var provVal = row.Provincia || "";
        var locVal = row.Localita || "";
        
        var logInd = row.Logistica_Indirizzo || row.logistica_indirizzo || "";
        if (logInd && logInd.trim() !== "") {
            resVal = logInd;
            var logCom = row.Logistica_Comune || row.logistica_comune || "";
            var logPro = row.Logistica_Provincia || row.logistica_provincia || "";
            if(logCom) locVal = logCom;
            if(logPro) provVal = logPro;
        }
        
        if (!skipBasic || elRes.value === "") elRes.value = resVal;
        if (!skipBasic || GetPhoneNumbersFromChips() === "") RenderPhoneChips(row.Telefono || "");
        if (!skipBasic || elMail.value === "") elMail.value = row.Email || "";
        if (!skipBasic || GetInvalidityFromChips() === "") RenderInvalidityChips(row.StatoGravita || "");

        var pVal = provVal;
        if (!skipBasic || elProv.value === "" || elProv.selectedIndex <= 0) {
            var trovato = ImpostaValoreProvinciaFuzzy("cmbProvincia", pVal);
            if(trovato) elProv.onchange(); 
            
            // Impostazione località (Sincrona - queryAccessDB è bloccante in HTA)
            if(elLoc && (!skipBasic || elLoc.value === "" || elLoc.selectedIndex <= 0)) {
                elLoc.value = locVal;
                if(elLoc.selectedIndex === -1 && locVal !== "") {
                    for(var i=0; i<elLoc.options.length; i++) {
                        if(elLoc.options[i].text.toUpperCase() === locVal.toUpperCase()) {
                            elLoc.selectedIndex = i; break;
                        }
                    }
                }
            }
            Highlight(elLoc);
        }
        
        // Logica Disabilita' (Sempre aggiornata da Anagrafica)
        var statoGrav = String(row.StatoGravita || "").toUpperCase();
        var badge = document.getElementById("lblStatoDisabilita");
        badge.style.display = "none";
        badge.style.backgroundColor = "";
        badge.style.color = "";
        
        if(statoGrav && statoGrav !== "" && statoGrav !== "NORMOVEDENTE" && statoGrav !== "NESSUNA") {
            badge.innerText = statoGrav;
            badge.style.display = "inline-block";
            
            // Colori Potenziati (Stile Foto 1)
            if(statoGrav.indexOf("CIECO") !== -1) {
                badge.style.backgroundColor = "#e74c3c"; // Rosso Apple
                badge.style.color = "#FFF";
                badge.style.boxShadow = "0 0 10px rgba(231,76,60,0.5)";
            } else if(statoGrav.indexOf("IPOVEDENTE") !== -1) {
                badge.style.backgroundColor = "#f39c12"; // Arancio Apple
                badge.style.color = "#FFF";
                badge.style.boxShadow = "0 0 10px rgba(243,156,18,0.5)";
            } else {
                badge.style.backgroundColor = "#3498db"; // Blu per altre disabilità
                badge.style.color = "#FFF";
            }
        }
        
        // Foto (Sempre aggiornata da Anagrafica)
        var fName = row.PercorsoFoto || "";
        var imgTag = document.getElementById("imgFotoCliente");
        var lblNof = document.getElementById("lblNoFoto");
        if(fName !== "") {
            var fullPath = fso.BuildPath(FOTO_DIR, fName);
            if(fso.FileExists(fullPath)) {
                imgTag.src = "file:///" + fullPath.replace(/\\/g, "/") + "?t=" + new Date().getTime();
                imgTag.style.display = "block";
                lblNof.style.display = "none";
            } else {
                imgTag.src = "about:blank";
                imgTag.style.display = "none";
                lblNof.style.display = "block";
            }
        } else {
            imgTag.src = "about:blank";
            imgTag.style.display = "none";
            lblNof.style.display = "block";
        }
        
        ApplicaEvidenziatoriPannelloDati();
        if (!skipBasic) BloccaCampiAnagrafica(true);

        // --- [AZZARDO ORO: CARICAMENTO AUTOMATICO MATERIALI ED ENTE] ---
        var excelData = LoadMaterialsForPatient(row.CognomeNome);
        if (excelData.materials !== "") {
            var txtMerce = document.getElementById("txtMerce");
            var currentVal = txtMerce.value.trim();
            if (currentVal !== "") {
                if (currentVal.toUpperCase().indexOf(excelData.materials.toUpperCase()) === -1) {
                    txtMerce.value = currentVal + ", " + excelData.materials;
                }
            } else {
                txtMerce.value = excelData.materials;
            }
            Highlight(txtMerce);
            try { document.getElementById("lblConteggioMerce").innerText = "(MATERIALI AUTO-CARICATI)"; } catch(e){}
        }
        
        // Popolamento automatico Ente da Excel se non già presente o se vogliamo forzarlo
        if (excelData.ente !== "") {
            var elEnte = document.getElementById("cmbEnte");
            if (elEnte.value === "") {
                elEnte.value = excelData.ente;
                Highlight(elEnte);
            }
        }
    }
}

function isNumericMaterial(val) {
    if (val === undefined || val === null || val === "") return false;
    var s = String(val).replace(",", ".");
    return !isNaN(parseFloat(s)) && isFinite(s);
}

function GetMaterialLabel(name, value) {
    if (!value || value === "") return "";
    var v = String(value).trim();
    // Se è un numero (es. "1", "2") mostriamo solo il nome della categoria
    if (isNumericMaterial(v)) return name;
    // Se è la colonna Note/Misto, mostriamo solo il testo
    if (name.toUpperCase() === "NOTE" || name.toUpperCase() === "MISTO") return v;
    // Altrimenti mostriamo Categoria (Descrizione)
    return name + " (" + v + ")";
}

function LoadMaterialsForPatient(nominativo) {
    if (!nominativo || nominativo.trim() === "") return { materials: "", ente: "" };
    try {
        // CORREZIONE PERCORSO: Uso del dynamic currentDir invece del path hardcoded
        var materialPath = fso.BuildPath(fso.BuildPath(currentDir, "gestione_materiale"), "materiali_db.json");
        
        if (!fso.FileExists(materialPath)) {
            // Tentativo fallback se la cartella ha un nome leggermente diverso o posizione flat
            var materialPathFallback = fso.BuildPath(currentDir, "materiali_db.json");
            if (fso.FileExists(materialPathFallback)) {
                materialPath = materialPathFallback;
            } else {
                return { materials: "", ente: "" };
            }
        }

        var f = fso.OpenTextFile(materialPath, 1, false, -1); // -1 Unicode per evitare silent fail
        var content = f.ReadAll();
        f.Close();

        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.substring(1);
        }

        // Parsing JSON compatibile HTA (IE)
        var data = [];
        try { 
            data = JSON.parse(content); 
        } catch(e) { 
            try { data = eval("(" + content + ")"); } catch(e2) { return { materials: "", ente: "" }; }
        }

        var normalize = function(s) {
            return String(s || "").toUpperCase().replace(/\s+/g, ' ').trim();
        };

        var searchNom = normalize(nominativo);
        for (var i = 0; i < data.length; i++) {
            var p = data[i];
            var targetNom = normalize(p.nominativo);
            
            if (targetNom !== "" && (targetNom === searchNom || targetNom.indexOf(searchNom) !== -1 || searchNom.indexOf(targetNom) !== -1)) {
                var enteTrovato = p.cliente || "";
                var foundList = [];
                
                if (p.materiali && p.materiali.length > 0) {
                    for (var j = 0; j < p.materiali.length; j++) {
                        var mat = p.materiali[j];
                        var val = mat.valore;
                        var label = GetMaterialLabel(mat.nome, mat.valore);
                        foundList.push(String(label).toUpperCase());
                    }
                }
                
                return { materials: foundList.join(", "), ente: enteTrovato };
            }
        }

        return { materials: "", ente: "" };
    } catch(e) {
        return { materials: "", ente: "" };
    }
}

function BloccaCampiAnagrafica(locked) {
    // Lasciamo txtNome fuori per permettere modifiche estemporanee
    var campi = ["txtResidenza", "txtTelefono", "txtEmail", "cmbProvincia", "cmbLocalita"];
    for(var i=0; i<campi.length; i++) {
        var el = document.getElementById(campi[i]);
        if(el.tagName === "SELECT") {
            el.disabled = locked;
        } else {
            el.readOnly = locked;
        }
        if(locked) el.classList.add("locked"); else el.classList.remove("locked");
    }
}

// ==========================================
// ARTICOLI SELECTOR
// ==========================================
function PopolaListaArticoli(categoriaFiltro) {
    var lBox = document.getElementById("lstArticoli");
    lBox.innerHTML = "";
    var sql = "SELECT NomeArticolo FROM tblArticoli";
    if(categoriaFiltro !== "") {
         sql += " WHERE Categoria='" + sqlEscape(categoriaFiltro) + "'";
    }
    sql += " ORDER BY NomeArticolo";
    var arts = queryAccessDB(sql);
    document.getElementById("lblArticoliContatore").innerText = "Tot: " + arts.length;
    
    arts.forEach(function(r) {
        var nomeMostrato = (r.NomeArticolo && r.NomeArticolo.trim() !== "") ? r.NomeArticolo : "[ARTICOLO SENZA NOME]";
        var opt = document.createElement("option");
        opt.value = nomeMostrato;
        opt.text = nomeMostrato;
        lBox.appendChild(opt);
    });
    
    // --- GESTIONE INTERAZIONE ARTICOLI ---
    
    // 1. Selezione: Mostra Foto
    lBox.onchange = function() {
        if(this.selectedIndex === -1) return;
        MostraFotoArticolo(this.options[this.selectedIndex].text);
    };

    // 2. Doppio Click: Inserimento in Merce
    lBox.ondblclick = function() {
        if(this.selectedIndex === -1) return;
        var artSel = this.options[this.selectedIndex].text;
        var merceArea = document.getElementById("txtMerce");
        var txtCorr = merceArea.value.trim();
        
        if(txtCorr === "") {
             merceArea.value = artSel;
        } else {
             if(txtCorr.indexOf(artSel) === -1) {
                  merceArea.value = txtCorr + ", " + artSel;
             }
        }
        Highlight(merceArea);
        document.getElementById("txtMerce").onchange(); 
        
        MostraFotoArticolo(artSel);
        ChiudiModalArticoli(); 
    };
}

/**
 * Funzione centralizzata per l'anteprima immagini articoli
 */
function MostraFotoArticolo(artSel) {
    var imgBox = document.getElementById("imgFotoArticolo");
    var lblNoImg = document.getElementById("lblNoFotoArt");
    var found = false;
    var exts = [".jpg", ".jpeg", ".png", ".bmp", ".gif"];
    
    for(var z=0; z<exts.length; z++) {
         var pp = fso.BuildPath(ARTICOLI_DIR, artSel + exts[z]);
         if(fso.FileExists(pp)) {
             imgBox.src = "file:///" + pp.replace(/\\/g, "/") + "?t=" + new Date().getTime();
             imgBox.style.display = "block";
             lblNoImg.style.display = "none";
             found = true;
             break;
         }
    }
    
    if(!found) {
        imgBox.src = "about:blank";
        imgBox.style.display = "none";
        lblNoImg.style.display = "block";
        lblNoImg.innerText = "NO FOTO";
    }
}

// ==========================================
// AUTOPILOTA NUMERICO (Suggerimento N. ORDINE)
// ==========================================
function AutoPopolaOrdine() {
    var txtOrdine = document.getElementById("txtOrdine");
    var dateStr = document.getElementById("txtDataConsegna").value.trim();
    var oraStr = document.getElementById("cmbOra").value.trim();

    if(dateStr.length !== 10) return;

    if (idConsegnaCorrente !== "NEW") {
        // In modalità MODIFICA, interveniamo SOLO se la data o l'ora sono cambiate rispetto all'originale
        var originalDate = document.getElementById("txtDataConsegna").getAttribute("data-original-date") || "";
        var originalOra = document.getElementById("cmbOra").getAttribute("data-original-ora") || "";
        if (dateStr === originalDate && oraStr === originalOra) return; 
    }
    
    try {
        var sDataFormatted = formatDateToDB(dateStr);
        // Conta quante consegne ci sono già in questa data (e prima/uguale a questa ora)
        var sql = "SELECT COUNT(*) as Tot FROM tblConsegne WHERE (DataConsegna = " + sDataFormatted + " OR DataConsegna = '" + sqlEscape(dateStr) + "')";
        
        if (oraStr !== "") {
             sql += " AND (OraConsegna IS NULL OR OraConsegna = '' OR OraConsegna <= '" + sqlEscape(oraStr) + "')";
        }
        
        // Se siamo in modifica, escludiamo la consegna stessa dal conteggio della sua posizione!
        if (idConsegnaCorrente !== "NEW") {
             sql += " AND ID <> " + idConsegnaCorrente;
        }

        var rs = queryAccessDB(sql);
        if(rs && rs.length > 0) {
            var conteggio = parseInt(rs[0].Tot, 10);
            // Propone il numero successivo
            var nuovoNum = conteggio + 1;
            txtOrdine.value = nuovoNum;
            txtOrdine.setAttribute("data-last-auto", nuovoNum);
            try { Highlight(txtOrdine); } catch(ex){}
        } else {
            // Se rs è vuoto, fallback a 1
            txtOrdine.value = 1;
            txtOrdine.setAttribute("data-last-auto", 1);
            try { Highlight(txtOrdine); } catch(ex){}
        }
    } catch(e) {
        alert("Errore AutoPopolaOrdine: " + e.message);
    }
}

// ==========================================
// UI LOGIC (Calcolo, Highlight, Roadmap)
// ==========================================
function ConfiguraMotoreUI() {
    // Highlighter Setup su campi Testo e Combo
    var inputs = document.querySelectorAll(".main-wrapper input[type=text], .main-wrapper input[type=email], .main-wrapper select, .main-wrapper textarea");
    for(var u=0; u<inputs.length; u++) {
        inputs[u].addEventListener("change", function() { Highlight(this); });
        inputs[u].addEventListener("keyup", function() { Highlight(this); });
    }
    
    // Eventi KM
    document.getElementById("txtKmAndata").onchange = CalcolaKMTotale;
    document.getElementById("txtKmRitorno").onchange = CalcolaKMTotale;
    
    // Format Date On change
    var dInput = document.getElementById("txtDataConsegna");
    dInput.onblur = function() {
         var v = this.value.trim().replace(/-/g,"").replace(/\//g,"").replace(/\./g,"");
         if(v.length >= 6) { // supportiamo ddmmyy e ddmmyyyy
             var res = FormatCustomFastDate(v);
             if(res !== "Invalid") {
                 this.value = res;
                 Highlight(this);
                 AggiornaRoadmapGiornaliera();
                 // Avvia l'autopilota numerico appena la data è confermata
                 AutoPopolaOrdine();
             } else {
                 alert("Formato Data Errato (Usa GGMMAAAA)");
                 this.style.backgroundColor = "#FFC8C8";
             }
         }
    };
    
    // Checkbox Style
    document.getElementById("chkConsegnato").onclick = function() {
         var lbl = document.getElementById("lblChiusa");
         if(this.checked) {
              lbl.innerText = "SI";
              lbl.style.color = "#009600";
         } else {
              lbl.innerText = "CHIUSA?";
              lbl.style.color = "#C00000";
         }
    };
    
    // Conteggio Merce
    document.getElementById("txtMerce").onchange = function() {
         var vs = this.value.split(",");
         var cnt = 0;
         for(var i=0; i<vs.length; i++) { if(vs[i].trim() !== "") cnt++; }
         document.getElementById("lblConteggioMerce").innerText = "Prodotti: " + cnt;
    };
    
    // Button Actions Mapping
    document.getElementById("cmdNuovo").onclick = ActionNuovo;
    document.getElementById("cmdSalva").onclick = ActionSalva;
    document.getElementById("cmdElimina").onclick = ActionElimina;
    
    document.getElementById("cmdGeneraReport").onclick = ActionReportMensile;
    document.getElementById("cmdGeneraReportDiretto").onclick = ActionReportMensileDiretto;
    document.getElementById("cmdEmail").onclick = InviaDettaglioEmail;
    document.getElementById("cmdConsegneImminenti").onclick = ActionConsegneImminenti;
    
    // Nuovo tasto cartella
    document.getElementById("cmdMostraFile").onclick = ScegliCartellaLavoro;
    
    // Tasti Pannello Dati (Promemoria & Ore)
    document.getElementById("cmdPromemoria").onclick = function() {
        var clName = document.getElementById("txtNome").value.trim();
        ApriPromemoria(clName);
    };
    
    document.getElementById("cmdOreRecupero").onclick = function() {
        var shellNav = new ActiveXObject("Shell.Application");
        shellNav.ShellExecute(fso.BuildPath(currentDir, "presenze.html"), "", currentDir, "open", 1);
    };
    
    document.getElementById("cmdPDF").onclick = function() {
        // Implementato placeholder o logica specifica se necessario
        alert("Funzione PDF Dettaglio in fase di attivazione.");
    };
    
    document.getElementById("cmdWhatsApp").onclick = function() {
        ApriWhatsAppModal();
    };
    
        document.getElementById("cmdHelp").onclick = function() {
        ApriHelpModal();
    };
    
    document.getElementById("btnMappa").onclick = function() {
        var addr = (document.getElementById("txtResidenza").value + " " + document.getElementById("cmbLocalita").value + " " + document.getElementById("cmbProvincia").value).trim();
        if(addr == "") {alert("Senza indirizzo!"); return;}
        ApriMappaInApp(addr);
    };

    // Close logic
    document.getElementById("cmdChiudi").onclick = function() {
        isNavigating = true;
        try {
            var shell = new ActiveXObject("WScript.Shell");
            var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
            if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
            shell.Run('mshta.exe "' + htaPath + '"', 1, false);
            AtomicClose();
        } catch(e) {
            alert("Errore Ritorno Dashboard: " + e.message);
            isNavigating = false;
        }
    };
    
    // Setup Filtri Rapidi Archvio
    var btnFiltri = document.querySelectorAll(".btn-filter");
    for(var k=0; k<btnFiltri.length; k++) {
        btnFiltri[k].onclick = function() {
            for(var q=0; q<btnFiltri.length; q++) btnFiltri[q].className = btnFiltri[q].className.replace(" active","");
            this.className += " active";
            if(this.id==="btnFiltroTutti") currentFilterState = "";
            if(this.id==="btnFiltroSospesi") currentFilterState = "SOSPESI";
            if(this.id==="btnFiltroUrgenti") currentFilterState = "URGENTI";
            if(this.id==="btnFiltroChiusi") currentFilterState = "CHIUSI";
            if(this.id==="btnFiltroProssimeDaFare") currentFilterState = "PROSSIME_DA_FARE";
            if(this.id==="btnFiltroOggiUrgenti") currentFilterState = "OGGI_URGENTI";
            CercaConsegne();
        };
    }

    // Eventi ENTE RIFERIMENTO (Aggiunta/Rimozione dinamica)
    var cEnte = document.getElementById("cmbEnte");
    if(cEnte) {
        cEnte.onchange = function() { ActionVerificaNuovoEnte(this.value); Highlight(this); };
        cEnte.ondblclick = function() { ActionEliminaEnteDblClick(this.value); };
    }
    
    // Eventi STATO OPERATIVO (Aggiunta/Rimozione dinamica)
    var cStato = document.getElementById("cmbStato");
    if(cStato) {
        cStato.onchange = function() { ActionVerificaNuovoStato(this.value); Highlight(this); };
        cStato.ondblclick = function() { ActionEliminaStatoDblClick(this.value); };
    }

    // Bottoni Ordinamento
    document.getElementById("btnSpostaSu").onclick = ActionSpostaSu;
    document.getElementById("btnSpostaGiu").onclick = ActionSpostaGiu;

    // --- LOGICA RICERCA ARCHIVIO ---
    var tRicerca = document.getElementById("txtRicerca");
    if(tRicerca) {
        tRicerca.onkeyup = function() { CercaConsegne(); };
        tRicerca.oninput = function() { CercaConsegne(); }; 
    }
}

// ==========================================
// GESTIONE VISIBILITA EDITOR PANEL
// ==========================================
function ActionApriEditor() {
    var ep = document.getElementById("editorPanel");
    if(ep) {
        ep.classList.remove("collapsed");
        // Safe dynamic layout class for robust IE rendering
        if(document.body.className.indexOf("editor-mode") === -1) {
            document.body.className += " editor-mode";
        }
        ep.scrollTop = 0;
    }
}

function ActionChiudiEditor() {
    if (!CheckUnsavedChanges()) return; // Avvisa in caso di modifiche in chiusura
    var ep = document.getElementById("editorPanel");
    if(ep) {
        ep.classList.add("collapsed");
        // Safe removal of dynamic layout class
        document.body.className = document.body.className.replace(/\beditor-mode\b/g, "").trim();
        // Deseleziona card correnti per pulizia visiva
        var cards = document.querySelectorAll(".delivery-gold-card");
        for(var i=0; i<cards.length; i++) cards[i].classList.remove("selected");
    }
}

function FormatCustomFastDate(raw) {
    var gg, mm, yy;
    if(raw.length === 6) { // GGMMAA -> GG/MM/20AA
        gg = raw.substring(0,2);
        mm = raw.substring(2,4);
        yy = "20" + raw.substring(4,6);
    } else if(raw.length === 8) {
        gg = raw.substring(0,2);
        mm = raw.substring(2,4);
        yy = raw.substring(4,8);
    } else {
        return "Invalid";
    }
    // minimal validate
    if(parseInt(mm)>12 || parseInt(mm)<1) return "Invalid";
    if(parseInt(gg)>31 || parseInt(gg)<1) return "Invalid";
    return gg + "/" + mm + "/" + yy;
}

function CalcolaKMTotale() {
    var a = parseFloat(document.getElementById("txtKmAndata").value) || 0;
    var r = parseFloat(document.getElementById("txtKmRitorno").value) || 0;
    var totale = a + r;
    // Fix per precisione floating point Javascript
    document.getElementById("txtKmTotale").value = parseFloat(totale.toFixed(2));
}

// ==========================================
// GESTIONE MULTI-CONTATTO (CHIPS TELEFONO)
// ==========================================
function InitPhoneHandlers() {
    var txt = document.getElementById("txtTelefono");
    if(!txt) return;
    
    txt.onblur = function() {
        this.value = NormalizePhone(this.value);
        Highlight(this);
    };

    txt.onkeydown = function(e) {
        if (e.keyCode === 13) { // INVIO
            e.preventDefault();
            var val = NormalizePhone(this.value);
            if (val !== "") {
                AddPhoneChip(val);
                this.value = "";
            }
        }
        if (e.keyCode === 8 && this.value === "") { // BACKSPACE su campo vuoto
            var chips = document.getElementById("chipsArea").getElementsByClassName("phone-chip");
            if (chips.length > 0) {
                document.getElementById("chipsArea").removeChild(chips[chips.length - 1]);
            }
        }
    };
}

function AddPhoneLabel(lbl) {
    var txt = document.getElementById("txtTelefono");
    txt.value = lbl + txt.value;
    txt.focus();
}

function NormalizePhone(num) {
    if(!num) return "";
    
    // 1. Pulizia: rimuove punti, trattini, slash e spazi extra
    var clean = String(num).replace(/[\.\-\/]/g, " ").replace(/\s+/g, " ").trim();
    
    // 2. Formattazione Intelligente: se è un numero mobile standard da 10 cifre
    var digits = clean.replace(/\s/g, "");
    if (digits.length === 10 && digits.indexOf("+") === -1) {
        return digits.substring(0, 3) + " " + digits.substring(3, 5) + " " + digits.substring(5, 7) + " " + digits.substring(7, 10);
    }
    
    return clean;
}

function AddPhoneChip(num) {
    if(!num) return;
    
    // Normalizzazione avanzata
    num = NormalizePhone(num);
    
    var area = document.getElementById("chipsArea");
    
    // Evita duplicati nella stessa sessione visiva
    var existing = area.innerText;
    if(existing.indexOf(num) !== -1) return;

    var chip = document.createElement("div");
    chip.className = "phone-chip";
    
    var waIcon = "<img src='https://img.icons8.com/color/48/whatsapp.png' class='chip-wa-icon' title='Invia WhatsApp' onclick='ActionInviaWhatsAppSingolo(\"" + num.replace(/'/g,"\\'") + "\")'>";
    
    chip.innerHTML = waIcon + "<span>" + num + "</span><span class='remove-chip' onclick='this.parentElement.parentElement.removeChild(this.parentElement)'>&times;</span>";
    area.appendChild(chip);
}

function RenderPhoneChips(valStr) {
    var area = document.getElementById("chipsArea");
    area.innerHTML = "";
    if(!valStr) return;
    
    var pts = valStr.split(/[,;]/); // Divide per virgola o punto e virgola
    for(var i=0; i<pts.length; i++) {
        var n = pts[i].trim();
        if(n !== "") AddPhoneChip(n);
    }
}

function GetPhoneNumbersFromChips() {
    var chips = document.getElementById("chipsArea").getElementsByClassName("phone-chip");
    var arr = [];
    for(var i=0; i<chips.length; i++) {
        var val = chips[i].getElementsByTagName("span")[0].innerText;
        arr.push(val);
    }
    // Aggiungi anche quello che è eventualmente scritto nel campo testo ma non ancora confermato
    var txt = document.getElementById("txtTelefono").value.trim();
    if(txt !== "") arr.push(txt);
    
    return arr.join(", ");
}

function ActionInviaWhatsAppSingolo(num) {
    var cleanNum = num.replace(/[^0-9+]/g, ""); 
    if(cleanNum === "") { alert("Numero non valido per WhatsApp"); return; }
    window.open("https://wa.me/" + (cleanNum.indexOf("+") === 0 ? "" : "39") + cleanNum);
}

// ==========================================
// GESTIONE STATO INVALIDITÀ (CHIPS)
// ==========================================
function InitInvalidityHandlers() {
    var txt = document.getElementById("txtStatoInvalidita");
    if(!txt) return;
    
    txt.onkeydown = function(e) {
        if (e.keyCode === 13) { // INVIO
            e.preventDefault();
            var val = this.value.trim().toUpperCase();
            if (val !== "") {
                AddInvalidityChip(val);
                this.value = "";
            }
        }
        if (e.keyCode === 8 && this.value === "") { // BACKSPACE
            var chips = document.getElementById("invChipsArea").getElementsByClassName("invalidity-chip");
            if (chips.length > 0) {
                document.getElementById("invChipsArea").removeChild(chips[chips.length - 1]);
            }
        }
    };
}

function AddInvLabel(lbl) {
    AddInvalidityChip(lbl);
    document.getElementById("txtStatoInvalidita").focus();
}

function AddInvalidityChip(text) {
    if(!text) return;
    text = text.toUpperCase().trim();
    var area = document.getElementById("invChipsArea");
    
    // Evita duplicati
    var existing = area.innerText;
    if(existing.indexOf(text) !== -1) return;

    var chip = document.createElement("div");
    chip.className = "invalidity-chip";
    chip.innerHTML = "<span>" + text + "</span><span class='remove-inv' onclick='this.parentElement.parentElement.removeChild(this.parentElement)'>&times;</span>";
    area.appendChild(chip);
}

function RenderInvalidityChips(valStr) {
    var area = document.getElementById("invChipsArea");
    area.innerHTML = "";
    if(!valStr) return;
    
    var pts = valStr.split(/[,;]/);
    for(var i=0; i<pts.length; i++) {
        var n = pts[i].trim();
        if(n !== "") AddInvalidityChip(n);
    }
}

function GetInvalidityFromChips() {
    var chips = document.getElementById("invChipsArea").getElementsByClassName("invalidity-chip");
    var arr = [];
    for(var i=0; i<chips.length; i++) {
        var val = chips[i].getElementsByTagName("span")[0].innerText;
        arr.push(val);
    }
    var txt = document.getElementById("txtStatoInvalidita").value.trim();
    if(txt !== "") arr.push(txt.toUpperCase());
    
    return arr.join(", ");
}

// ==========================================
// GESTIONE SEZIONI COLLASSABILI (ACCORDION)
// ==========================================
function ToggleCard(cardId) {
    var card = document.getElementById(cardId);
    if(!card) return;
    
    var btn = card.querySelector(".btn-toggle-card");
    
    if (card.className.indexOf("collapsed") === -1) {
        card.className += " collapsed";
        if(btn) btn.innerHTML = "▼";
        // Mostra nome cliente nell'header della card Anagrafica quando collassata
        if (cardId === "cardAnagrafica") {
            var lblInH = document.getElementById("lblNomeInCardHeader");
            var nomeAtt = document.getElementById("txtNome") ? document.getElementById("txtNome").value.trim() : "";
            if (lblInH && nomeAtt !== "") { lblInH.innerText = "👤 " + nomeAtt; lblInH.style.display = "inline"; }
        }
    } else {
        card.className = card.className.replace(/\bcollapsed\b/g, "").trim();
        if(btn) btn.innerHTML = "▲";
        // Nasconde il nome dall'header quando la card si espande
        if (cardId === "cardAnagrafica") {
            var lblInH = document.getElementById("lblNomeInCardHeader");
            if (lblInH) lblInH.style.display = "none";
        }
    }
}

function Highlight(ctrl) {
    if(!ctrl) return;
    if(ctrl.id === "txtRicerca") return; 
    
    var isPopulated = false;
    var val = (ctrl.value || "").trim();
    if(val !== "" && val !== "Seleziona..." && val !== "gg/mm/aaaa" && val !== "Seleziona ora...") {
        isPopulated = true;
    }
    
    // Supporto per i contenitori di Chips (Telefono e Invalidità)
    if(ctrl.id === "txtTelefono") {
        var area = document.getElementById("chipsArea");
        if(area && area.getElementsByClassName("phone-chip").length > 0) isPopulated = true;
    }
    if(ctrl.id === "txtStatoInvalidita") {
        var area = document.getElementById("invChipsArea");
        if(area && area.getElementsByClassName("invalidity-chip").length > 0) isPopulated = true;
    }

    if(isPopulated) {
        if(ctrl.className.indexOf("populated") === -1) ctrl.className += " populated";
        // Evidenzia anche il wrapper se è un campo chip
        if(ctrl.id === "txtTelefono") {
            var wrp = document.querySelector(".phone-chips-wrapper");
            if(wrp && wrp.className.indexOf("populated") === -1) wrp.className += " populated";
        }
        if(ctrl.id === "txtStatoInvalidita") {
            var wrp = document.querySelector(".invalidity-chips-wrapper");
            if(wrp && wrp.className.indexOf("populated") === -1) wrp.className += " populated";
        }
    } else {
        ctrl.className = ctrl.className.replace(/\bpopulated\b/g, "").trim();
        if(ctrl.id === "txtTelefono") {
            var wrp = document.querySelector(".phone-chips-wrapper");
            if(wrp) wrp.className = wrp.className.replace(/\bpopulated\b/g, "").trim();
        }
        if(ctrl.id === "txtStatoInvalidita") {
            var wrp = document.querySelector(".invalidity-chips-wrapper");
            if(wrp) wrp.className = wrp.className.replace(/\bpopulated\b/g, "").trim();
        }
    }
}
function ApplicaEvidenziatoriPannelloDati() {
     var inputs = document.querySelectorAll(".main-wrapper input[type=text], .main-wrapper input[type=email], .main-wrapper select, .main-wrapper textarea");
     for(var u=0; u<inputs.length; u++) Highlight(inputs[u]);
}


// ==========================================
// GESTIONE DATI: CARICAMENTO (ARCHIVIO) E CLICK
function CercaConsegne(idDaSelezionare) {
    var cmbM = document.getElementById("cmbMese");
    var cmbA = document.getElementById("cmbAnni");
    
    if(!cmbM || !cmbA || cmbM.selectedIndex === -1 || cmbA.value === "") {
        return;
    }

    var meseNum = cmbM.selectedIndex + 1;
    var annoSel = cmbA.value;
    var stxt = document.getElementById("txtRicerca").value.trim();
    
    // Filtro temporale basato sul periodo operativo (MeseRiferimento) o data effettiva se privo di periodo
    // PIANO B: JOIN per estrarre l'indirizzo logistico e mostrare il badge visivo nella griglia
    var sql = "SELECT c.*, cl.Logistica_Indirizzo FROM tblConsegne c LEFT JOIN tblClienti cl ON c.ID_Cliente = cl.ID WHERE 1=1 ";
    
    if (currentFilterState === "PROSSIME_DA_FARE") {
        sql += " AND c.DataConsegna >= date('now') AND (c.Consegnato=0 OR c.Consegnato IS NULL) AND (LOWER(c.Stato)<>'chiuso' AND LOWER(c.Stato)<>'consegnato') ";
    } else if (currentFilterState === "OGGI_URGENTI") {
        sql += " AND (c.DataConsegna = date('now') OR LOWER(c.Stato) = 'urgente' OR LOWER(c.Stato) = 'urgenti' OR c.Note LIKE '%urgente%') ";
    } else {
        var mesePadded = (meseNum < 10 ? "0" : "") + meseNum;
        sql += " AND ((CAST(c.MeseRiferimento AS INT)=" + meseNum + " AND CAST(c.AnnoRiferimento AS INT)=" + annoSel + ") " +
               "OR (c.DataConsegna LIKE '" + annoSel + "-" + mesePadded + "%')) ";
    }
    if(stxt !== "") {
         var esc = sqlEscape(stxt);
         sql += " AND (c.ClienteNome LIKE '%" + esc + "%' OR c.IndirizzoConsegna LIKE '%" + esc + "%' OR c.Telefono LIKE '%" + esc + "%' OR c.LocalitaConsegna LIKE '%" + esc + "%' ";
         
         // Caso 1: Solo Giorno (es. "06" o "6")
         var mDayOnly = stxt.match(/^(\d{1,2})$/);
         if (mDayOnly) {
             var dayVal = parseInt(mDayOnly[1], 10);
             if (dayVal >= 1 && dayVal <= 31) {
                 var dayStr = (dayVal < 10 ? "0" : "") + dayVal;
                 sql += " OR Format(c.DataConsegna, 'dd') = '" + dayStr + "' ";
             }
         }
         
         // Caso 2: Giorno/Mese (es. "06/05" o "6/5")
         var mDayMonth = stxt.match(/^(\d{1,2})[-/.](\d{1,2})$/);
         if (mDayMonth) {
             var dayVal = parseInt(mDayMonth[1], 10);
             var monthVal = parseInt(mDayMonth[2], 10);
             if (dayVal >= 1 && dayVal <= 31 && monthVal >= 1 && monthVal <= 12) {
                 var dayStr = (dayVal < 10 ? "0" : "") + dayVal;
                 var monthStr = (monthVal < 10 ? "0" : "") + monthVal;
                 sql += " OR Format(c.DataConsegna, 'dd/mm') = '" + dayStr + "/" + monthStr + "' ";
             }
         }
         
         // Caso 3: Data completa (es. "06/05/2026")
         var mFullDate = stxt.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
         if (mFullDate) {
             var dG = parseInt(mFullDate[1], 10);
             var dM = parseInt(mFullDate[2], 10);
             var dA = parseInt(mFullDate[3], 10);
             var dayStr = (dG < 10 ? "0" : "") + dG;
             var monthStr = (dM < 10 ? "0" : "") + dM;
             sql += " OR Format(c.DataConsegna, 'dd/mm/yyyy') = '" + dayStr + "/" + monthStr + "/" + dA + "' ";
         }
         sql += ") ";
    }
    
    sql += " ORDER BY c.DataConsegna ASC, IIf(c.Priorita IS NULL, 999, c.Priorita) ASC, c.OraConsegna ASC, c.ID ASC ";
    
    var arrAll = queryAccessDB(sql);
    
    // Forziamo l'ordinamento cronologico via JavaScript nel caso in cui DataConsegna 
    // sia salvata come Testo nel DB (che causa ordinamento alfabetico: 11/06 prima di 27/05).
    arrAll.sort(function(a, b) {
        var parseSortDate = function(dVal) {
            if (!dVal) return 0;
            var str = String(dVal).replace(/-/g, "/").replace("T", " ");
            var regexIT = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
            var match = str.match(regexIT);
            if (match) {
                var dG = parseInt(match[1], 10);
                var dM = parseInt(match[2], 10) - 1;
                var dA = parseInt(match[3], 10);
                return new Date(dA, dM, dG).getTime();
            }
            var t = Date.parse(str);
            if (!isNaN(t)) return t;
            return 0;
        };
        
        var t1 = parseSortDate(a.DataConsegna);
        var t2 = parseSortDate(b.DataConsegna);
        if (t1 !== t2) return t1 - t2;
        
        // Si usa la Priorità/Ordine prima dell'ora per consentire il riordinamento manuale da parte dell'utente
        var p1 = a.Priorita ? parseInt(a.Priorita, 10) : 999;
        var p2 = b.Priorita ? parseInt(b.Priorita, 10) : 999;
        if (p1 !== p2) return p1 - p2;
        
        // Controllo l'Ora come tie-breaker
        var o1 = a.OraConsegna || "23:59";
        var o2 = b.OraConsegna || "23:59";
        if (o1 !== o2) return o1 < o2 ? -1 : 1;
        
        return (a.ID || 0) - (b.ID || 0);
    });
    
    // Conteggio dinamico in memoria per ciascuna categoria di filtro
    var countTutti = arrAll.length;
    var countSospesi = 0;
    var countUrgenti = 0;
    var countChiusi = 0;
    
    for (var i = 0; i < arrAll.length; i++) {
        var r = arrAll[i];
        var lowStato = String(r.Stato || "").toLowerCase();
        var lowNote = String(r.Note || "").toLowerCase();
        
        var isClosed = (r.Consegnato === true || r.Consegnato === -1 || String(r.Consegnato).toLowerCase() === "true" || String(r.Consegnato) === "-1" || r.Consegnato === 1 || String(r.Consegnato) === "1");
        var isSospeso = (lowStato === "sospeso" || lowStato === "in sospeso" || lowStato === "da chiamare");
        var isUrgent = (lowStato === "urgenti" || lowStato === "urgente" || lowNote.indexOf("urgente") > -1);
        
        if (isClosed) countChiusi++;
        if (isSospeso) countSospesi++;
        if (isUrgent) countUrgenti++;
    }
    
    var btnTutti = document.getElementById("btnFiltroTutti");
    var btnSospesi = document.getElementById("btnFiltroSospesi");
    var btnUrgenti = document.getElementById("btnFiltroUrgenti");
    var btnChiusi = document.getElementById("btnFiltroChiusi");
    var btnProssime = document.getElementById("btnFiltroProssimeDaFare");
    var btnOggiUrgenti = document.getElementById("btnFiltroOggiUrgenti");
    
    if (btnTutti) {
        var isAct = currentFilterState === "";
        var bg = isAct ? "rgba(14, 165, 233, 0.25)" : "rgba(255, 255, 255, 0.08)";
        var fg = isAct ? "#0ea5e9" : "#94a3b8";
        btnTutti.innerHTML = "TUTTI <span style='background:" + bg + "; color:" + fg + "; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; margin-left:6px; display:inline-block; min-width:12px; text-align:center;'>" + countTutti + "</span>";
    }
    if (btnSospesi) {
        var isAct = currentFilterState === "SOSPESI";
        var bg = isAct ? "rgba(14, 165, 233, 0.25)" : "rgba(255, 255, 255, 0.08)";
        var fg = isAct ? "#0ea5e9" : "#94a3b8";
        btnSospesi.innerHTML = "SOSPESI <span style='background:" + bg + "; color:" + fg + "; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; margin-left:6px; display:inline-block; min-width:12px; text-align:center;'>" + countSospesi + "</span>";
    }
    if (btnUrgenti) {
        var isAct = currentFilterState === "URGENTI";
        var bg = isAct ? "rgba(14, 165, 233, 0.25)" : "rgba(255, 255, 255, 0.08)";
        var fg = isAct ? "#0ea5e9" : "#94a3b8";
        btnUrgenti.innerHTML = "URGENTI <span style='background:" + bg + "; color:" + fg + "; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; margin-left:6px; display:inline-block; min-width:12px; text-align:center;'>" + countUrgenti + "</span>";
    }
    if (btnChiusi) {
        var isAct = currentFilterState === "CHIUSI";
        var bg = isAct ? "rgba(14, 165, 233, 0.25)" : "rgba(255, 255, 255, 0.08)";
        var fg = isAct ? "#0ea5e9" : "#94a3b8";
        btnChiusi.innerHTML = "CHIUSI <span style='background:" + bg + "; color:" + fg + "; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; margin-left:6px; display:inline-block; min-width:12px; text-align:center;'>" + countChiusi + "</span>";
    }
    if (btnOggiUrgenti) {
        var isAct = currentFilterState === "OGGI_URGENTI";
        btnOggiUrgenti.style.background = isAct ? "#ef4444" : "rgba(239, 68, 68, 0.1)";
        btnOggiUrgenti.style.color = isAct ? "#ffffff" : "#ef4444";
        btnOggiUrgenti.style.borderColor = isAct ? "#ef4444" : "rgba(239, 68, 68, 0.3)";
    }
    if (btnProssime) {
        var isAct = currentFilterState === "PROSSIME_DA_FARE";
        btnProssime.style.background = isAct ? "#eab308" : "rgba(234, 179, 8, 0.2)";
        btnProssime.style.color = isAct ? "#000000" : "#fde047";
        btnProssime.style.borderColor = isAct ? "#eab308" : "#eab308";
    }
    
    // Filtriamo l'array finale in base al filtro correntemente selezionato
    var arr = [];
    if (currentFilterState === "" || currentFilterState === "PROSSIME_DA_FARE") {
        arr = arrAll;
    } else if (currentFilterState === "OGGI_URGENTI") {
        var tObj = new Date();
        var dd = tObj.getDate(); if (dd < 10) dd = "0" + dd;
        var mm = tObj.getMonth() + 1; if (mm < 10) mm = "0" + mm;
        var yyyy = tObj.getFullYear();
        var todayStr = dd + "/" + mm + "/" + yyyy;
        for (var i = 0; i < arrAll.length; i++) {
            var r = arrAll[i];
            var dateIt = formatDBDateToIT(r.DataConsegna);
            var isTdy = (dateIt === todayStr);
            var lowStato = String(r.Stato || "").toLowerCase();
            var lowNote = String(r.Note || "").toLowerCase();
            var isUrg = (lowStato === "urgente" || lowStato === "urgenti" || lowNote.indexOf("urgente") > -1);
            if (isTdy || isUrg) {
                arr.push(r);
            }
        }
    } else if (currentFilterState === "SOSPESI") {
        for (var i = 0; i < arrAll.length; i++) {
            var r = arrAll[i];
            var lowStato = String(r.Stato || "").toLowerCase();
            if (lowStato === "sospeso" || lowStato === "in sospeso" || lowStato === "da chiamare") arr.push(r);
        }
    } else if (currentFilterState === "URGENTI") {
        for (var i = 0; i < arrAll.length; i++) {
            var r = arrAll[i];
            var lowStato = String(r.Stato || "").toLowerCase();
            var lowNote = String(r.Note || "").toLowerCase();
            if (lowStato === "urgenti" || lowStato === "urgente" || lowNote.indexOf("urgente") > -1) arr.push(r);
        }
    } else if (currentFilterState === "CHIUSI") {
        for (var i = 0; i < arrAll.length; i++) {
            var r = arrAll[i];
            var isClosed = (r.Consegnato === true || r.Consegnato === -1 || String(r.Consegnato).toLowerCase() === "true" || String(r.Consegnato) === "-1" || r.Consegnato === 1 || String(r.Consegnato) === "1");
            if (isClosed) arr.push(r);
        }
    }
    
    arrayConsegneMemory = arr;
    
    if (typeof window.AggiornaMiniDashboard === 'function') {
        window.AggiornaMiniDashboard(arr);
    }
    
    if (window.isKanbanViewActive) {
        window.RenderKanban(arr);
        return;
    }
    
    var container = document.getElementById("cardListContainer");
    container.innerHTML = "";
    
    if (arr.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding:40px; color:#999;'>Nessuna consegna trovata per questo periodo.</div>";
    }

    var sumKm = 0;
    var lastDateSeen = "";
    for(var u=0; u<arr.length; u++) {
        var row = arr[u];
        
        // Divisore di Data intelligente per raggruppamento consegne giornaliere
        var dIt = formatDBDateToIT(row.DataConsegna);
        if (dIt !== "" && dIt !== lastDateSeen) {
            lastDateSeen = dIt;
            var dateHeader = document.createElement("div");
            dateHeader.className = "date-separator-header";
            
            var fullDayLabel = getGiornoSettimanaIT(row.DataConsegna);
            // Calcolo statistiche giornaliere per l'header del gruppo
            var dayCount = 0;
            var dayCompleted = 0;
            var dayKm = 0;
            for (var k = u; k < arr.length; k++) {
                if (formatDBDateToIT(arr[k].DataConsegna) === dIt) {
                    dayCount++;
                    var ka = parseFloat(arr[k].KmAndata) || 0;
                    var kr = parseFloat(arr[k].KmRitorno) || 0;
                    dayKm += (ka + kr);
                    var rc = arr[k];
                    var isDone = (rc.Consegnato === true || rc.Consegnato === -1 || String(rc.Consegnato).toLowerCase() === "true" || String(rc.Consegnato) === "-1" || rc.Consegnato === 1 || String(rc.Consegnato) === "1");
                    if (isDone) {
                        dayCompleted++;
                    }
                } else {
                    break;
                }
            }
            var pct = dayCount > 0 ? Math.round((dayCompleted / dayCount) * 100) : 0;
            var statsStr = " <span style='font-size: 11px; font-weight: normal; color: #94a3b8; margin-left: 10px; background: rgba(255,255,255,0.04); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);'>" + dayCount + " consegne (" + dayCompleted + " completate) | " + dayKm.toFixed(1) + " KM totali</span>";
            var progressBarHtml = "<div class='day-progress-container' title='Completamento consegne del giorno: " + pct + "%'><div class='day-progress-bar' style='width:" + pct + "%'></div></div>";
            dateHeader.innerHTML = "<div>📅 " + (fullDayLabel || dIt) + statsStr + "</div>" + progressBarHtml;
            container.appendChild(dateHeader);
        }
        
        var stateLabel = row.Stato || "Pianificato";
        
        var lowStato = String(row.Stato).toLowerCase();
        var isUrgent = (lowStato.indexOf("urgente") > -1 || String(row.Note).toLowerCase().indexOf("urgente") > -1);
        var isClosed = (row.Consegnato === true || row.Consegnato === -1 || String(row.Consegnato).toLowerCase() === "true" || String(row.Consegnato) === "-1" || row.Consegnato === 1 || String(row.Consegnato) === "1");
        
        var pillClass = "status-pill status-pending";
        if(isUrgent) pillClass = "status-pill status-urgent";
            if(isClosed) { pillClass = "status-pill status-closed"; stateLabel = "CONSEGNATO"; }
        
        // PIANO B: Rileva se l'indirizzo visualizzato è di tipo Logistico e mostra badge in griglia
        var hasLogistica = false;
        var logAddr = row.Logistica_Indirizzo || row.logistica_indirizzo || "";
        if (logAddr && logAddr.trim() !== "") {
            hasLogistica = true;
        }

        // Calcolo oggi per evidenziazione oggi
        var tObj = new Date();
        var dd = tObj.getDate(); if (dd < 10) dd = "0" + dd;
        var mm = tObj.getMonth() + 1; if (mm < 10) mm = "0" + mm;
        var yyyy = tObj.getFullYear();
        var todayStr = dd + "/" + mm + "/" + yyyy;
        var isToday = (formatDBDateToIT(row.DataConsegna) === todayStr);
        var todayBadge = isToday ? ' <span class="badge-today">OGGI</span>' : '';

        // Generazione badge Ente colorato
        var enteLabel = row.Ente || "";
        var enteBadge = "";
        if (enteLabel && enteLabel.trim() !== "" && enteLabel.toLowerCase() !== "null") {
            var enteClean = enteLabel.trim().toUpperCase();
            var bgEnte = "rgba(255, 255, 255, 0.08)", borderEnte = "rgba(255, 255, 255, 0.2)", fgEnte = "#cbd5e1";
            if (enteClean === "ASL") { bgEnte = "rgba(16, 185, 129, 0.15)"; borderEnte = "rgba(16, 185, 129, 0.35)"; fgEnte = "#34d399"; }
            else if (enteClean === "INAIL") { bgEnte = "rgba(249, 115, 22, 0.15)"; borderEnte = "rgba(249, 115, 22, 0.35)"; fgEnte = "#fb923c"; }
            else if (enteClean === "PRIVATO") { bgEnte = "rgba(168, 85, 247, 0.15)"; borderEnte = "rgba(168, 85, 247, 0.35)"; fgEnte = "#c084fc"; }
            else if (enteClean === "COMUNE") { bgEnte = "rgba(6, 182, 212, 0.15)"; borderEnte = "rgba(6, 182, 212, 0.35)"; fgEnte = "#22d3ee"; }
            enteBadge = '<span style="background:' + bgEnte + '; border:1px solid ' + borderEnte + '; color:' + fgEnte + '; font-size:9.5px; font-weight:900; padding:4px 10px; border-radius:12px; margin-left:8px; display:inline-block; vertical-align:middle; text-transform:uppercase; letter-spacing:0.5px;">' + enteClean + '</span>';
        }

        var card = document.createElement("div");
        card.className = "delivery-gold-card" + (isUrgent ? " urgent" : "") + (isToday ? " today-delivery" : "");
        card.setAttribute("data-idx", u);
        
        // DRAG & DROP SUPPORT
        card.draggable = true;
        card.ondragstart = function(e) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.getAttribute('data-idx'));
            this.style.opacity = '0.5';
        };
        card.ondragend = function(e) { this.style.opacity = '1'; };
        card.ondragover = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        card.ondrop = function(e) {
            e.preventDefault();
            var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            var toIdx = parseInt(this.getAttribute('data-idx'));
            if(!isNaN(fromIdx) && fromIdx !== toIdx) {
                SpostaCardDragDrop(fromIdx, toIdx);
            }
        };
        
        var ka = parseFloat(row.KmAndata)||0;
        var kr = parseFloat(row.KmRitorno)||0;
        
        var merceMostrata = row.Merce || "";
        if (!merceMostrata || merceMostrata.trim() === "" || merceMostrata.toLowerCase() === "null") {
            merceMostrata = GetMaterialsFromExcelCached(row.ClienteNome);
        }
        
        // Evidenziazione termini cercati
        var displayNome = highlightSearchText(row.ClienteNome || "-", stxt);
        var displayIndirizzo = highlightSearchText(row.IndirizzoConsegna || "-", stxt);
        var displayLocalita = highlightSearchText(row.LocalitaConsegna || "", stxt);
        var displayProv = highlightSearchText(row.Provincia || "", stxt);
        var displayTelefono = highlightSearchText(row.Telefono || "Nessun Recapito", stxt);
        var displayMerce = highlightSearchText(merceMostrata, stxt);
        
        var html = '<div class="batch-checkbox-container">' +
                   '    <input type="checkbox" class="batch-checkbox" data-id="' + row.ID + '" data-tel="' + (row.Telefono || "") + '" onclick="(window.event || event).cancelBubble=true; if(event && event.stopPropagation) event.stopPropagation(); UpdateBatchActionsPanel();">' +
                   '</div>' +
                   '<div class="card-main">' +
                   '    <div class="client-details">DESTINATARIO <span style="float:right; display:flex; align-items:center; background:rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.1); color:#475569; font-size:10px; font-weight:900; padding:2px 8px; border-radius:10px; letter-spacing:0.5px;">POSIZIONE: ' + (u + 1) + 
                   ' <span class="card-order-controls">' +
                   '   <span class="btn-card-order" title="Sposta su" onclick="(window.event || event).cancelBubble=true; if(event && event.stopPropagation) event.stopPropagation(); SpostaCardConsegna(' + row.ID + ', \'su\', ' + u + '); return false;">▲</span>' +
                   '   <span class="btn-card-order" title="Sposta giù" onclick="(window.event || event).cancelBubble=true; if(event && event.stopPropagation) event.stopPropagation(); SpostaCardConsegna(' + row.ID + ', \'giu\', ' + u + '); return false;">▼</span>' +
                   ' </span>' +
                   '</span></div>' +
                   '    <div class="client-name">' + displayNome + '</div>' +
                   '    <div style="margin-top: 8px; margin-bottom: 5px;"><span class="' + pillClass + '">' + stateLabel + '</span>' + enteBadge + '</div>' +
                   '</div>' +
                   
                   '<!-- COLONNA 2: BADGE TESTUALI -->' +
                   '<div class="segugio-indicators" style="flex-direction:column; gap:4px; align-items:flex-start; min-width:90px;">' +
                   (row.Telefono ? '<span class="badge-status-client" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; margin:0;">RECAPITO</span>' : '') +
                   (merceMostrata ? '<span class="badge-status-client" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; margin:0;">MERCE OK</span>' : '') +
                   (hasLogistica ? '<span class="badge-status-client" style="background:#e0e7ff; color:#4338ca; border:1px solid #a5b4fc; margin:0;">LOGISTICA</span>' : '') +
                   '</div>' +

                   '<div class="card-info">' +
                   '    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">' +
                   '        <div style="display:flex; align-items:center; gap:6px;">' +
                   '            <div class="client-details" style="color: #64748b !important;">INDIRIZZO E LOCALIT&Agrave;</div>' +
                                 (hasLogistica ? '            <div style="background:rgba(2, 132, 199, 0.1); border:1px solid rgba(2, 132, 199, 0.2); color:#0284c7; font-size:8px; font-weight:900; padding:1.5px 6px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; letter-spacing:0.5px; text-transform:uppercase;"><i class="fa fa-truck" style="font-size:9px;"></i> SITO LOGISTICO</div>' : '') +
                   '        </div>' +
                   '        <div style="display:flex; gap:5px;">' +
                   '            <div class="delivery-date-badge" style="background:rgba(2, 132, 199, 0.08); border-color:rgba(2, 132, 199, 0.2); color:#0284c7;"><i class="fa fa-calendar" style="color:#0284c7;"></i> ' + formatDBDateToIT(row.DataConsegna) + todayBadge + '</div>' +
                                 (row.OraConsegna && String(row.OraConsegna).trim() !== "" && String(row.OraConsegna).toLowerCase() !== "null" ? '            <div class="delivery-time-badge" style="background:rgba(217, 119, 6, 0.08); border-color:rgba(217, 119, 6, 0.2); color:#d97706;"><i class="fa fa-clock-o" style="color:#d97706;"></i> ' + row.OraConsegna + '</div>' : '') +
                   '        </div>' +
                   '    </div>' +
                   '    <div class="address-main">' + displayIndirizzo + '</div>' +
                   '    <div class="address-sub">' + (displayLocalita || "") + (displayProv && String(displayProv).trim() !== "" && String(displayProv).toLowerCase() !== "null" ? ' (' + displayProv + ')' : '') + '</div>' +
                   (merceMostrata && merceMostrata.trim() !== "" ?
                    '    <div style="margin-top:10px; font-size:11.5px; color:#475569; display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.02); padding:6px 12px; border-radius:8px; border:1px solid rgba(0,0,0,0.05); width:100%; box-sizing:border-box; cursor:pointer;" onclick="(window.event || event).cancelBubble=true; InlineEditMerce(this, ' + row.ID + ', \'' + String(merceMostrata).replace(/'/g, "\\'") + '\');" title="Clicca per modificare la merce rapidamente">' +
                    '        <i class="fa fa-cube" style="color:#0284c7; font-size:12px;"></i>' +
                    '        <span style="font-weight:900; color:#0284c7; font-size:9.5px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; margin-right:4px;">MERCE:</span>' +
                    '        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; color:#334155;">' + displayMerce + '</span>' +
                    '    </div>' : '') +
                   '</div>' +
                   
                   '<!-- COLONNA METADATI E AZIONI SEGUGIO STYLE -->' +
                   '<div class="card-meta" style="flex-direction: row !important; align-items: center !important; gap: 15px !important; justify-content: flex-end !important; flex: 1.6 !important;">' +
                   '    <div style="display:flex; flex-direction:column; align-items:flex-end;">' +
                   '        <div class="contact-box" style="margin-bottom:4px !important;">' + displayTelefono + '</div>' +
                   '        <div class="action-icons" style="margin-bottom:5px;">' +
                   '            <img src="https://img.icons8.com/fluency/48/phone-office.png" class="action-icon-btn" style="width:20px; height:20px;" title="Chiama via Skype/PC" onclick="event.cancelBubble=true; ChiamaCliente(\'' + (row.Telefono || "").replace(/'/g, "\\'") + '\');">' +
                   '            <img src="https://img.icons8.com/color/48/google-maps-new.png" class="action-icon-btn" style="width:20px; height:20px;" title="Vedi Mappa al Volo" onclick="event.cancelBubble=true; ApriMappaDaCard(\'' + (row.IndirizzoConsegna || "").replace(/'/g, "\\'") + '\', \'' + (row.LocalitaConsegna || "").replace(/'/g, "\\'") + '\', \'' + (row.Provincia || "") + '\');">' +
                   '            <img src="https://img.icons8.com/fluency/48/qr-code.png" class="action-icon-btn" style="width:20px; height:20px;" title="Vedi QR Code Navigatore" onclick="event.cancelBubble=true; ApriQRNavigatore(\'' + (row.IndirizzoConsegna || "").replace(/'/g, "\\'") + '\', \'' + (row.LocalitaConsegna || "").replace(/'/g, "\\'") + '\', \'' + (row.Provincia || "") + '\');">' +
                   '            <img src="https://img.icons8.com/fluency/48/copy-link.png" class="action-icon-btn" style="width:20px; height:20px;" title="Copia Riepilogo WhatsApp" onclick="event.cancelBubble=true; CopiaRiepilogoConsegna(\'' + (row.ClienteNome || "").replace(/'/g, "\\'") + '\', \'' + (row.IndirizzoConsegna || "").replace(/'/g, "\\'") + '\', \'' + (row.LocalitaConsegna || "").replace(/'/g, "\\'") + '\', \'' + (row.Provincia || "") + '\', \'' + (row.Telefono || "").replace(/'/g, "\\'") + '\', \'' + merceMostrata.replace(/'/g, "\\'") + '\', \'' + formatDBDateToIT(row.DataConsegna) + '\', \'' + (row.OraConsegna || "") + '\', \'' + hasLogistica + '\');">' +
                   '            <img src="https://img.icons8.com/color/48/whatsapp.png" class="action-icon-btn" style="width:20px; height:20px;" title="Invia Notifica Diretta WhatsApp" onclick="event.cancelBubble=true; InviaWhatsApp(\'' + (row.Telefono || "").replace(/'/g, "\\'") + '\', \'' + (row.ClienteNome || "").replace(/'/g, "\\'") + '\', \'' + (row.OraConsegna || "") + '\', \'' + (row.LocalitaConsegna || "").replace(/'/g, "\\'") + '\', \'' + merceMostrata.replace(/'/g, "\\'") + '\');">' +
                   '            <img src="https://img.icons8.com/fluency/48/delete-forever.png" class="action-icon-btn" style="width:20px; height:20px;" title="Elimina Consegna" onclick="event.cancelBubble=true; ActionEliminaPerRiga(' + row.ID + ');">' +
                   '        </div>' +
                   '    </div>' +
                   '    ' +
                   '    <!-- METRICA IN GRANDE (KM) -->' +
                   '    <div class="segugio-metric-km">' + (ka + kr > 0 ? (ka + kr).toFixed(0) + ' KM' : '0 KM') + '</div>' +
                   '    ' +
                   '    <!-- BOTTONE SCEGLI (APRI) -->' +
                   '    <div class="segugio-button">APRI <span style="font-weight: bold; font-family: Courier New, monospace; margin-left: 2px;">&gt;</span></div>' +
                   '</div>';

        card.innerHTML = html;
        sumKm += (ka+kr);
        
        card.onclick = function() {
             if (!CheckUnsavedChanges()) return; // Interrompe cambio scheda se ci sono modifiche
             var cards = container.getElementsByClassName("delivery-gold-card");
             for(var z=0; z<cards.length; z++) cards[z].classList.remove("selected");
             this.classList.add("selected");
             CaricaDettaglioConsegna(arrayConsegneMemory[this.getAttribute("data-idx")]);
             ActionApriEditor();
        };
        container.appendChild(card);
    }
    
    var count = arr.length;
    var msgContatore = "Consegne: " + count + " | Totale KM: " + sumKm.toFixed(1);
    document.getElementById("lblContatore").innerText = msgContatore;
    
    if (idDaSelezionare) {
        var cards = container.getElementsByClassName("delivery-gold-card");
        for (var i = 0; i < arr.length; i++) {
            if (Number(arr[i].ID) === Number(idDaSelezionare)) {
                if (cards[i]) {
                    cards[i].classList.add("selected");
                    cards[i].classList.add("pulse-highlight"); // Micro-animazione d'impatto visivo (UX-3)
                    try {
                        cards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } catch(eScroll) {
                        try { cards[i].scrollIntoView(true); } catch(errFall) {}
                    }
                    
                    // Rimuovi l'animazione in modo pulito alla conclusione dei cicli
                    (function(el) {
                        setTimeout(function() {
                            try { el.classList.remove("pulse-highlight"); } catch(e) {}
                        }, 2900);
                    })(cards[i]);
                }
                CaricaDettaglioConsegna(arr[i]);
                ActionApriEditor();
                break;
            }
        }
    }
    
    // Aggiorna la Progress Bar di Produttività
    AggiornaProgressoGiornaliero(arr);
}

function AggiornaProgressoGiornaliero(arr) {
    if (!arr) return;
    var bar = document.getElementById("barProgresso");
    var lbl = document.getElementById("lblProgresso");
    if (!bar || !lbl) return;

    if (arr.length === 0) {
        bar.style.width = "0%";
        lbl.innerText = "0%";
        return;
    }

    var completate = 0;
    for (var i = 0; i < arr.length; i++) {
        var row = arr[i];
        var isClosed = (row.Consegnato === true || row.Consegnato === -1 || String(row.Consegnato).toLowerCase() === "true" || String(row.Consegnato) === "-1" || row.Consegnato === 1 || String(row.Consegnato) === "1");
        // consideriamo completato anche se lo stato testuale è CHIUSO
        var statoStr = String(row.Stato || "").toUpperCase().trim();
        if (isClosed || statoStr === "CHIUSO" || statoStr === "CONSEGNATO") {
            completate++;
        }
    }

    var percentuale = Math.round((completate / arr.length) * 100);
    bar.style.width = percentuale + "%";
    lbl.innerText = percentuale + "%";
    
    // Colora la label in base al completamento e GAMIFICATION
    if (percentuale === 100) {
        lbl.style.color = "#fbbf24"; // Giallo oro
        lbl.style.textShadow = "0 0 10px rgba(251,191,36,0.8)";
        bar.style.background = "linear-gradient(90deg, #fbbf24, #f59e0b)";
        bar.style.boxShadow = "0 0 15px rgba(251,191,36,0.8)";
        
        // Effetto Confetti (se non è già stato fatto)
        if (!window.confettiFired) {
            window.confettiFired = true;
            TriggerConfetti();
        }
    } else if (percentuale > 0) {
        window.confettiFired = false;
        lbl.style.color = "#10b981"; // Verde pieno
        lbl.style.textShadow = "none";
        bar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
        bar.style.boxShadow = "0 0 10px rgba(16,185,129,0.5)";
    } else {
        window.confettiFired = false;
        lbl.style.color = "#64748b"; // Grigio spento se 0
        lbl.style.textShadow = "none";
        bar.style.boxShadow = "none";
    }
}

function CaricaDettaglioConsegna(row) {
    idConsegnaCorrente = Number(row.ID);
    document.getElementById("txtId").value = idConsegnaCorrente;
    
    // Aggiornamento della visualizzazione della posizione corrente
    var idxCur = -1;
    if (typeof arrayConsegneMemory !== "undefined") {
        for(var i=0; i<arrayConsegneMemory.length; i++) {
            if(Number(arrayConsegneMemory[i].ID) === idConsegnaCorrente) { idxCur = i; break; }
        }
    }
    var lblPos = document.getElementById("lblPosizioneConsegna");
    if(lblPos) {
        if(idxCur !== -1) {
            lblPos.innerText = "POSIZIONE: " + (idxCur + 1) + " DI " + arrayConsegneMemory.length;
            lblPos.style.display = "inline-block";
            // Riavvia l'animazione di pulsazione
            lblPos.className = lblPos.className.replace(/\bpulse-position\b/g, "").trim();
            void lblPos.offsetWidth; // Forza reflow per riavviare animazione in IE/Edge
            lblPos.className += " pulse-position";
        } else {
            lblPos.style.display = "none";
        }
    }
    
    document.getElementById("txtNome").value = row.ClienteNome || "";
    
    var pVal = row.Provincia || "";
    var provDropdown = document.getElementById("cmbProvincia");
    if(trov = ImpostaValoreProvinciaFuzzy("cmbProvincia", pVal)) {
        provDropdown.onchange();
    }
    
    // Caricamento località (Sincrono)
    var locDropdown = document.getElementById("cmbLocalita");
    var valTarget = row.LocalitaConsegna || "";
    locDropdown.value = valTarget;
    
    if(locDropdown.selectedIndex <= 0 && valTarget !== "") {
        var found = false;
        for(var i=0; i<locDropdown.options.length; i++) {
            if(locDropdown.options[i].text.toUpperCase() === valTarget.toUpperCase()) {
                locDropdown.selectedIndex = i;
                found = true;
                break;
            }
        }
        if(!found) {
            var optL = document.createElement("option");
            optL.value = valTarget; optL.text = valTarget + " (Esterna)";
            locDropdown.appendChild(optL);
            locDropdown.value = valTarget;
        }
    }
    Highlight(locDropdown);
    
    document.getElementById("txtResidenza").value = row.IndirizzoConsegna || "";
    RenderPhoneChips(row.Telefono || "");
    RenderInvalidityChips(row.StatoInvalidita || "");
    Highlight(document.getElementById("txtResidenza"));
    document.getElementById("txtEmail").value = row.Email || "";
    document.getElementById("cmbEnte").value = row.Ente || "";
    var formattata = formatDBDateToIT(row.DataConsegna);
    document.getElementById("txtDataConsegna").value = formattata;
    document.getElementById("txtDataConsegna").setAttribute("data-original-date", formattata);
    
    var oraVal = row.OraConsegna || "";
    document.getElementById("cmbOra").value = oraVal;
    document.getElementById("cmbOra").setAttribute("data-original-ora", oraVal);
    
    document.getElementById("txtOrdine").value = row.NumeroOrdine || "";
    document.getElementById("cmbStato").value = row.Stato || "";
    document.getElementById("txtKmAndata").value = row.KmAndata || "";
    document.getElementById("txtKmRitorno").value = row.KmRitorno || "";
    document.getElementById("txtMerce").value = row.Merce || "";
    var noteVal = row.Note || "";
    document.getElementById("txtNote").value = noteVal;
    
    var btnPod = document.getElementById("btnViewPOD");
    if(btnPod) {
        if(noteVal.indexOf("[FIRMA Ricevuta]") > -1 || noteVal.indexOf("[FOTO Ricevuta]") > -1) {
            btnPod.style.display = "inline-block";
        } else {
            btnPod.style.display = "none";
        }
    }
    
    document.getElementById("chkConsegnato").checked = (row.Consegnato === true || row.Consegnato === -1 || String(row.Consegnato).toLowerCase() === "true" || String(row.Consegnato) === "-1" || row.Consegnato === 1 || String(row.Consegnato) === "1");
    document.getElementById("chkConsegnato").onclick(); // forza refresh visuale UI
    
    CalcolaKMTotale();
    
    // Aggancio anagrafica ID x foto ecc. e FALLBACK DATI MANCANTI
    var fIdA = Number(row.ID_Cliente);
    if(fIdA > 0) {
        // Carichiamo anagrafica per Foto/Stato senza sovrascrivere i dati della consegna
        PopolaDaAnagrafica(fIdA, true); 
    } else {
        // Se non abbiamo ID, tentiamo il recupero per nome (solo per agganciare foto/stato)
        var resNameLookup = queryAccessDB("SELECT ID FROM tblClienti WHERE CognomeNome = '" + sqlEscape(row.ClienteNome) + "'");
        if(resNameLookup.length > 0) PopolaDaAnagrafica(resNameLookup[0].ID, true);
    }
    
    document.getElementById("lblInseritoIl").innerText = "Inserito il: " + (row.DataInserimento ? String(row.DataInserimento).replace("T"," ") : "-");
    document.getElementById("lblModificatoIl").innerText = "Modificato il: " + (row.DataUltimaModifica ? String(row.DataUltimaModifica).replace("T"," ") : "-");
    
    var btnSalva = document.getElementById("cmdSalva");
    btnSalva.innerHTML = "💾 MODIFICA";
    btnSalva.className = "btn-action success";
    
    document.getElementById("txtMerce").onchange(); // conteggio
    AggiornaRoadmapGiornaliera();
    ApplicaEvidenziatoriPannelloDati();

    // Accessibilità: Annuncia il caricamento del dettaglio e sposta il focus
    announce("Consegna caricata per " + (row.ClienteNome || "nuovo cliente"));
    if(document.getElementById("txtNome")) document.getElementById("txtNome").focus();
    
    // Crea lo stato iniziale "pulito" per il monitoraggio futuro
    originalState = GetCurrentFormState();
    
    // Mostra nome cliente nella barra in cima alla scheda (sempre visibile)
    var lblHdr = document.getElementById("lblNomeClienteHeader");
    if (lblHdr) { lblHdr.innerText = "👤 " + (row.ClienteNome || ""); lblHdr.style.display = (row.ClienteNome ? "inline-block" : "none"); }
    // Se la card anagrafica e' collassata, aggiorna anche il suo header
    var cardAn = document.getElementById("cardAnagrafica");
    var lblInH = document.getElementById("lblNomeInCardHeader");
    if (cardAn && lblInH && cardAn.className.indexOf("collapsed") !== -1) {
        lblInH.innerText = "👤 " + (row.ClienteNome || ""); lblInH.style.display = "inline";
    }
}

// Funzione helper per annunci vocali generici
function announce(text) {
    var el = document.getElementById("lblTitolo"); // Usiamo il titolo come area live polite
    if(el) {
        var oldText = el.innerText;
        el.innerText = text;
        // Ripristina il titolo originale dopo 5 secondi per non perdere il nome del modulo
        setTimeout(function() { if(el.innerText === text) el.innerText = oldText; }, 5000);
    }
}

function PopolaDaAnagraficaByName(nome) {
    if(!nome) return;
    var res = queryAccessDB("SELECT ID FROM tblClienti WHERE CognomeNome = '" + sqlEscape(nome) + "'");
    if(res.length>0) PopolaDaAnagrafica(res[0].ID);
}

// ==========================================
// ACTIONS CRUD (NUOVO, SALVA, ELIMINA)
// ==========================================

function ActionNuovo() {
    if (!CheckUnsavedChanges()) return; // Intercetta se stiamo azzerando dati modificati
    idConsegnaCorrente = "NEW";
    // Svuota badge nome cliente nella barra e nell'header card
    var lblHdr = document.getElementById("lblNomeClienteHeader");
    if (lblHdr) { lblHdr.innerText = ""; lblHdr.style.display = "none"; }
    var lblInH = document.getElementById("lblNomeInCardHeader");
    if (lblInH) { lblInH.innerText = ""; lblInH.style.display = "none"; }
    var selector = ".main-wrapper input[type=text], .main-wrapper input[type=email], .main-wrapper select:not(#cmbMese):not(#cmbAnni), .main-wrapper textarea, .main-wrapper input[type=hidden]:not(#txtId):not(#lblClientID)";
    var inputs = document.querySelectorAll(selector);
    for(var i=0; i<inputs.length; i++) {
        inputs[i].value = "";
    }
    var txtOrd = document.getElementById("txtOrdine");
    if(txtOrd) txtOrd.removeAttribute("data-last-auto");
    
    document.getElementById("txtId").value = "NEW";
    RenderPhoneChips("");
    document.getElementById("lblClientID").value = "";
    
    var chk = document.getElementById("chkConsegnato");
    chk.checked = false; chk.onclick();
    
    document.getElementById("lblStatoDisabilita").style.display = "none";
    document.getElementById("imgFotoCliente").src = "";
    document.getElementById("imgFotoArticolo").src = "";
    document.getElementById("txtStatoInvalidita").value = "";
    
    document.getElementById("lblInseritoIl").innerText = "Inserito il: -";
    document.getElementById("lblModificatoIl").innerText = "Modificato il: -";
    
    var btnSalva = document.getElementById("cmdSalva");
    btnSalva.innerHTML = "💾 SALVA";
    btnSalva.className = "btn-action"; // Togli colore rosso Modifica
    
    document.getElementById("txtDataConsegna").value = "";
    BloccaCampiAnagrafica(false);
    AggiornaRoadmapGiornaliera();
    ApplicaEvidenziatoriPannelloDati();
    
    // Porta il focus sul campo Nome/Cognome per iniziare subito la digitazione
    document.getElementById("txtNome").focus();
    ActionApriEditor();
    
    // Memorizza lo stato del form vuoto/nuovo come punto di partenza
    originalState = GetCurrentFormState();
}

var globalIsSaving = false;
function ActionSalva(silent) {
    if (globalIsSaving) return;
    
    // Validazione Top level
    var stNome = document.getElementById("txtNome").value.trim();
    var stData = document.getElementById("txtDataConsegna").value.trim();
    if(stNome === "") { alert("Inserire il Nome!"); return; }
    if(stData.length !== 10) { alert("Data non inserita o non formattata corretta (es. 28/05/2026)"); return; }

    globalIsSaving = true;
    var btnSalva = document.getElementById("cmdSalva");
    var oldText = btnSalva.innerHTML;
    btnSalva.innerHTML = "â ³ ATTENDI...";
    btnSalva.disabled = true;
    
    try {
        // Preparazione dati
        var isNew = (idConsegnaCorrente === "NEW");
        var sDataFormatted = formatDateToDB(stData); // -> stringa YYYY-MM-DD
        var bConsegnato = document.getElementById("chkConsegnato").checked ? "-1" : "0";
        var kmA = document.getElementById("txtKmAndata").value.replace(",",".") || "0";
        var kmR = document.getElementById("txtKmRitorno").value.replace(",",".") || "0";
        
        var sProv = sqlEscape(document.getElementById("cmbProvincia").value);
        var sLoc = sqlEscape(document.getElementById("cmbLocalita").value);
        var sInd = sqlEscape(document.getElementById("txtResidenza").value);
        var sTel = sqlEscape(GetPhoneNumbersFromChips());
        var sEmail = sqlEscape(document.getElementById("txtEmail").value);
        var invaliditaStr = GetInvalidityFromChips();
        var sOra = sqlEscape(document.getElementById("cmbOra").value);
        var sOrdin = sqlEscape(document.getElementById("txtOrdine").value);
        var sStat = sqlEscape(document.getElementById("cmbStato").value);
        var sNote = sqlEscape(document.getElementById("txtNote").value);
        var sMerce = sqlEscape(document.getElementById("txtMerce").value);
        var sEnte = sqlEscape(document.getElementById("cmbEnte").value);
        
        var mRef = document.getElementById("cmbMese").selectedIndex + 1;
        var aRef = document.getElementById("cmbAnni").value;
        // Fallback di sicurezza: se Mese o Anno sono vuoti nell'UI, usiamo la data corrente
        if (mRef <= 0) mRef = new Date().getMonth() + 1;
        if (aRef === "" || isNaN(aRef)) aRef = new Date().getFullYear();
        
        // --- VALIDAZIONE ANTI-DUPLICATO (Richiesta Utente) ---
        // 1. Controllo Ora (Avviso)
        if (sOra !== "" && sOra !== "Seleziona...") {
            var sqlChkOra = "SELECT COUNT(*) as Conta FROM tblConsegne WHERE (DataConsegna = " + sDataFormatted + " OR DataConsegna = '" + sqlEscape(stData) + "') AND OraConsegna = '" + sOra + "'";
            if (!isNew) sqlChkOra += " AND ID <> " + idConsegnaCorrente;
            var rsOra = queryAccessDB(sqlChkOra);
            if (rsOra.length > 0 && rsOra[0].Conta > 0) {
                var ans = window.showModalDialog("premium_confirm.html", {
                    msg: "ATTENZIONE: Esiste già una consegna registrata per la stessa DATA e ORA (" + sOra + ").\n\nVuoi procedere comunque?",
                    btnYesText: "PROCEDI",
                    icon: "&#9888;"
                }, "dialogWidth:480px;dialogHeight:260px;center:yes;status:no;scroll:no;unadorned:yes;");
                if (ans !== true) {
                    globalIsSaving = false;
                    btnSalva.innerHTML = oldText;
                    btnSalva.disabled = false;
                    return;
                }
            }
        }
        
        // 2. Numero Ordine: Se gia' occupato -> scala automaticamente le altre consegne
        if (sOrdin !== "") {
            var numOrdInt = parseInt(sOrdin, 10);
            var sqlChkOrd = "SELECT COUNT(*) as Conta FROM tblConsegne WHERE (DataConsegna = " + sDataFormatted + " OR DataConsegna = '" + sqlEscape(stData) + "') AND NumeroOrdine = '" + sOrdin + "'";
            if (!isNew) sqlChkOrd += " AND ID <> " + idConsegnaCorrente;
            var rsOrd = queryAccessDB(sqlChkOrd);
            if (rsOrd.length > 0 && rsOrd[0].Conta > 0) {
                var ans = window.showModalDialog("premium_confirm.html", {
                    msg: "Il N. ORDINE '" + sOrdin + "' è già assegnato a un'altra consegna di questa data.\n\nVuoi procedere?\nLe altre consegne scaleranno automaticamente di numero.",
                    btnYesText: "PROCEDI",
                    icon: "&#8505;"
                }, "dialogWidth:480px;dialogHeight:260px;center:yes;status:no;scroll:no;unadorned:yes;");
                if (ans !== true) {
                    globalIsSaving = false;
                    btnSalva.innerHTML = oldText;
                    btnSalva.disabled = false;
                    return;
                }
                // Scalatura a cascata: incrementa di 1 tutte le consegne della stessa data
                // con NumeroOrdine >= al numero inserito (escludendo la consegna corrente)
                var sqlScala = "UPDATE tblConsegne SET NumeroOrdine = CAST((CAST(NumeroOrdine AS INTEGER) + 1) AS TEXT)" +
                               " WHERE DataConsegna = " + sDataFormatted +
                               " AND NumeroOrdine GLOB '[0-9]*'" +
                               " AND CAST(NumeroOrdine AS INTEGER) >= " + numOrdInt;
                if (!isNew) sqlScala += " AND ID <> " + idConsegnaCorrente;
                executeAccessDBCrud(sqlScala);
            }
        }
        // 3. Controllo Cliente Duplicato in stessa Data (Avviso con Scelta)
        if (stNome !== "") {
            var sqlChkCli = "SELECT COUNT(*) as Conta FROM tblConsegne WHERE (DataConsegna = " + sDataFormatted + " OR DataConsegna = '" + sqlEscape(stData) + "') AND ClienteNome = '" + sqlEscape(stNome) + "'";
            if (!isNew) sqlChkCli += " AND ID <> " + idConsegnaCorrente;
            var rsCli = queryAccessDB(sqlChkCli);
            if (rsCli.length > 0 && rsCli[0].Conta > 0) {
                var ans = window.showModalDialog("premium_confirm.html", {
                    msg: "ATTENZIONE: Esiste già una consegna registrata per il cliente '" + stNome + "' in data " + stData + ".\n\nVuoi procedere comunque con il salvataggio di un duplicato?",
                    btnYesText: "SALVA DUPLICATO",
                    icon: "&#9888;"
                }, "dialogWidth:480px;dialogHeight:260px;center:yes;status:no;scroll:no;unadorned:yes;");
                if (ans !== true) {
                    globalIsSaving = false;
                    btnSalva.innerHTML = oldText;
                    btnSalva.disabled = false;
                    return;
                }
            }
        }
        
        // --- AUTO-POPOLAMENTO ANAGRAFICA DA CONSEGNA ---
        var idA = document.getElementById("lblClientID").value;
        var rsC = queryAccessDB("SELECT ID FROM tblClienti WHERE CognomeNome='" + sqlEscape(stNome) + "'");
        
        if (rsC.length > 0) {
            idA = rsC[0].ID;
            document.getElementById("lblClientID").value = idA;
        } else {
            // Se il cliente non esiste, lo CREIAMO ora in Anagrafica Master
            var sqlNewCl = "INSERT INTO tblClienti (CognomeNome, Residenza, Localita, Provincia, Telefono, Email, StatoGravita) VALUES (" +
                           "'" + sqlEscape(stNome) + "', '" + sInd + "', '" + sLoc + "', '" + sProv + "', '" + sTel + "', '" + sEmail + "', '" + sqlEscape(invaliditaStr) + "')";
            if(executeAccessDBCrud(sqlNewCl)) {
                var rsNewId = queryAccessDB("SELECT TOP 1 ID FROM tblClienti ORDER BY ID DESC");
                if(rsNewId.length > 0) {
                    idA = rsNewId[0].ID;
                    document.getElementById("lblClientID").value = idA;
                    announce("Nuovo cliente aggiunto in Anagrafica!");
                }
            }
        }
        
        var idAcVal = (idA && idA !== "") ? idA : "NULL";
        
        // Rimosse righe ricalcolate (ora precalcolate all'inizio della funzione)
        
        var sqlExe = "";
        if(isNew) {
             sqlExe = "INSERT INTO tblConsegne ([ID_Cliente], [ClienteNome], [Provincia], [LocalitaConsegna], [IndirizzoConsegna], [Telefono], [StatoInvalidita], [DataConsegna], [OraConsegna], [NumeroOrdine], [Stato], [Note], [Merce], [KmAndata], [KmRitorno], [Consegnato], [Ente], [MeseRiferimento], [AnnoRiferimento]) VALUES (" +
                      idAcVal + ", '" + sqlEscape(stNome) + "', '" + sProv + "', '" + sLoc + "', '" + sInd + "', '" + sTel + "', '" + sqlEscape(invaliditaStr) + "', " +
                      sDataFormatted + ", '" + sOra + "', '" + sOrdin + "', '" + sStat + "', '" + sNote + "', '" + sMerce + "', " + 
                      kmA + ", " + kmR + ", " + bConsegnato + ", '" + sEnte + "', " + mRef + ", " + aRef + ")";
        } else {
             // --- PROTEZIONE ANTI-SOVRASCRITTURA KM ---
             var sqlCheckKM = "SELECT KmAndata, KmRitorno FROM tblConsegne WHERE ID=" + idConsegnaCorrente;
             var resKM = queryAccessDB(sqlCheckKM);
             if (resKM.length > 0) {
                 var dbA = parseFloat(String(resKM[0].KmAndata).replace(",",".")) || 0;
                 var dbR = parseFloat(String(resKM[0].KmRitorno).replace(",",".")) || 0;
                 var formA = parseFloat(kmA) || 0;
                 var formR = parseFloat(kmR) || 0;
                 
                 // Se nel DB ci sono già dati (>0) e sono diversi da quelli nel form
                 if ((dbA > 0 || dbR > 0) && (dbA !== formA || dbR !== formR)) {
                     var msg = "ATTENZIONE: CONFLITTO DATI KM\n\n" +
                               "Nel database sono già presenti dei chilometri per questa consegna:\n" +
                               "- KM ANDATA: " + dbA + "\n" +
                               "- KM RITORNO: " + dbR + "\n\n" +
                               "I dati che stai salvando sono diversi.\n" +
                               "Vuoi SOVRASCRIVERE i dati nel database?";
                     
                     var ans = window.showModalDialog("premium_confirm.html", {
                         msg: msg,
                         btnYesText: "SOVRASCRIVI",
                         icon: "&#9888;"
                     }, "dialogWidth:480px;dialogHeight:300px;center:yes;status:no;scroll:no;unadorned:yes;");
                     
                     if (ans !== true) {
                         globalIsSaving = false;
                         btnSalva.innerHTML = oldText;
                         btnSalva.disabled = false;
                         return;
                     }
                 }
             }

             sqlExe = "UPDATE tblConsegne SET [ID_Cliente]=" + idAcVal + ", [ClienteNome]='" + sqlEscape(stNome) + "', [Provincia]='" + sProv + "', [LocalitaConsegna]='" + sLoc + "', " +
                      "[IndirizzoConsegna]='" + sInd + "', [Telefono]='" + sTel + "', [StatoInvalidita]='" + sqlEscape(invaliditaStr) + "', [DataConsegna]=" + sDataFormatted + ", [OraConsegna]='" + sOra + "', " +
                      "[NumeroOrdine]='" + sOrdin + "', [Stato]='" + sStat + "', [Note]='" + sNote + "', [Merce]='" + sMerce + "', [KmAndata]=" + kmA + ", [KmRitorno]=" + kmR + ", " +
                      "[Consegnato]=" + bConsegnato + ", [Ente]='" + sEnte + "', [MeseRiferimento]=" + mRef + ", [AnnoRiferimento]=" + aRef + " WHERE ID=" + idConsegnaCorrente;
        }
        
        if(executeAccessDBCrud(sqlExe)) {
             announce("Salvataggio completato con successo");
             
             var targetId = idConsegnaCorrente;
             if(isNew) {
                 var rsId = queryAccessDB("SELECT TOP 1 ID FROM tblConsegne ORDER BY ID DESC");
                 if(rsId.length > 0) {
                     targetId = rsId[0].ID;
                     idConsegnaCorrente = Number(targetId); // AGGIORNAMENTO: Passiamo in modalità modifica
                     document.getElementById("txtId").value = idConsegnaCorrente;
                     var btnSalva = document.getElementById("cmdSalva");
                     btnSalva.innerHTML = "💾 MODIFICA";
                     btnSalva.className = "btn-action success";
                 }
             }

             // FORZATURA REFRESH DASHBOARD: Scriviamo una notifica locale per svegliare la dashboard se aperta
             try {
                 var logMsg = new Date().toLocaleString() + " - REFRESH AUTOMATICO (Modifica da PC)\n";
                 var notifPath = fso.BuildPath(currentDir, "App_Mobile\\server\\NOTIFICHE_UFFICIO.txt");
                 var fLog = fso.OpenTextFile(notifPath, 8, true);
                 fLog.WriteLine(logMsg);
                 fLog.Close();
             } catch(eLog) {}

             // --- AGGIORNAMENTO ANAGRAFICA MASTER ---
             if (idA && idA !== "") {
                var sqlUpdMaster = "UPDATE tblClienti SET StatoGravita='" + sqlEscape(invaliditaStr) + "', Residenza='" + sInd + "', Localita='" + sLoc + "', Provincia='" + sProv + "', Telefono='" + sTel + "', Email='" + sEmail + "' WHERE ID=" + idA;
                executeAccessDBCrud(sqlUpdMaster);
             }

             if (silent !== true) alert("Salvataggio Completato!");
             originalState = null; // Resetta per forzare rigenerazione stato a fine ricaricamento
             CercaConsegne(targetId);
             return true; // Segnala successo al chiamante (es. popup)
        } else {
             return false; // Segnala fallimento salvataggio
        }
    } catch(e) {
        alert("Errore durante il salvataggio: " + e.message);
        return false;
    } finally {
        globalIsSaving = false;
        btnSalva.innerHTML = oldText;
        btnSalva.disabled = false;
    }
}

function ActionElimina() {
    ActionEliminaPerRiga(idConsegnaCorrente);
}

// Funzioni Helper per azioni dirette da riga
function ActionCaricaPerRiga(idx) {
    var container = document.getElementById("cardListContainer");
    var cards = container.getElementsByClassName("delivery-gold-card");
    if(cards[idx]) cards[idx].click();
}

function ActionSalvaPerRiga(id) {
    if(idConsegnaCorrente === "NEW" || Number(idConsegnaCorrente) !== Number(id)) {
        alert("Per salvare, devi prima selezionare la riga (icona Matita) per caricare i dati nel pannello superiore.");
        return;
    }
    ActionSalva();
}

function ActionEliminaPerRiga(id) {
    if(id === "NEW") { alert("Seleziona una consegna già registrata per eliminarla."); return; }
    
    var msg = "Sei sicuro di voler ELIMINARE PER SEMPRE questa consegna?\nVerrà rimossa dal database.";
    var ans = window.showModalDialog("premium_confirm.html", {msg: msg, btnYesText: "SI, ELIMINA"}, "dialogWidth:450px;dialogHeight:240px;center:yes;status:no;scroll:no;unadorned:yes;");
    
    if(ans === true) {
         // Recupera DataConsegna e NumeroOrdine prima di cancellare per compattare i successivi
         var sqlGet = "SELECT DataConsegna, NumeroOrdine FROM tblConsegne WHERE ID=" + id;
         var rsGet = queryAccessDB(sqlGet);
         var targetData = null;
         var targetOrd = null;
         if (rsGet && rsGet.length > 0) {
             targetData = rsGet[0].DataConsegna;
             targetOrd = rsGet[0].NumeroOrdine;
         }

         if(executeAccessDBCrud("DELETE FROM tblConsegne WHERE ID=" + id)) {
              // Compattazione in cascata: tutti i successivi scalano indietro di 1
              if (targetData && targetOrd && !isNaN(parseInt(targetOrd, 10))) {
                  var numOrdInt = parseInt(targetOrd, 10);
                  // Scaliamo all'indietro (-1) i Numeri d'Ordine maggiori di quello cancellato per quella data
                  var sqlScalaIndietro = "UPDATE tblConsegne SET NumeroOrdine = CAST((CAST(NumeroOrdine AS INTEGER) - 1) AS TEXT)" +
                                         " WHERE DataConsegna = " + formatDateToDB(formatDBDateToIT(targetData)) +
                                         " AND NumeroOrdine GLOB '[0-9]*'" +
                                         " AND CAST(NumeroOrdine AS INTEGER) > " + numOrdInt;
                  executeAccessDBCrud(sqlScalaIndietro);
              }
         
              announce("Cancellazione record avvenuta correttamente");
              alert("Eliminazione avvenuta con successo.");
              originalState = null; // Rimuove lo stato tracciato per evitare popup
              
              if(idConsegnaCorrente !== "NEW" && Number(idConsegnaCorrente) === Number(id)) {
                  ActionNuovo();
                  CercaConsegne(); // Non seleziona più la precedente
              } else if(idConsegnaCorrente !== "NEW") {
                  CercaConsegne(idConsegnaCorrente); // Mantiene selezionata quella che stavi guardando
              } else {
                  CercaConsegne();
              }
         }
    }
}


// ==========================================
// ROADMAP GIORNALIERA (Widget Top)
// ==========================================
function ActionStampaSpecial(tipo) {
    var dati = [];
    var titolo = "";
    var file = "";
    
    try {
        if (tipo === 'ULTIMI5') {
            var dFine = new Date();
            var dInizio = new Date();
            dInizio.setDate(dFine.getDate() - 5);
            var sInizio = "#" + dInizio.getFullYear() + "-" + (dInizio.getMonth()+1) + "-" + dInizio.getDate() + "#";
            var sFine = "#" + dFine.getFullYear() + "-" + (dFine.getMonth()+1) + "-" + dFine.getDate() + "#";
            var sql = "SELECT * FROM tblConsegne WHERE DataConsegna BETWEEN " + sInizio + " AND " + sFine + " ORDER BY DataConsegna ASC, OraConsegna ASC";
            dati = queryAccessDB(sql);
            titolo = "Report Ultime Consegne (Ultimi 5gg)";
            file = "Report_Ultime_5_Giorni.pdf";
        } 
        else if (tipo === 'PROSSIMI5') {
            var dOggi = new Date();
            var dFine = new Date();
            dFine.setDate(dOggi.getDate() + 5);
            var sOggi = "#" + dOggi.getFullYear() + "-" + (dOggi.getMonth()+1) + "-" + dOggi.getDate() + "#";
            var sFine = "#" + dFine.getFullYear() + "-" + (dFine.getMonth()+1) + "-" + dFine.getDate() + "#";
            var sql = "SELECT * FROM tblConsegne WHERE DataConsegna BETWEEN " + sOggi + " AND " + sFine + " ORDER BY DataConsegna ASC, OraConsegna ASC";
            dati = queryAccessDB(sql);
            titolo = "Pianificazione Prossime Consegne (5gg)";
            file = "Pianificazione_Prossime_Consegne.pdf";
        }
        else if (tipo === 'MENSILE') {
            var mIdx = document.getElementById("cmbMese").selectedIndex;
            var mNome = document.getElementById("cmbMese").value;
            var a = document.getElementById("cmbAnni").value;
            var sql = "SELECT * FROM tblConsegne WHERE MeseRiferimento=" + (mIdx + 1) + " AND AnnoRiferimento=" + a + " ORDER BY DataConsegna ASC, OraConsegna ASC";
            dati = queryAccessDB(sql);
            titolo = "Registro Mensile Consegne - " + mNome + " " + a;
            file = "Registro_Mensile_" + mNome + "_" + a + ".pdf";
        }

        if (dati.length === 0) {
            alert("Nessun dato trovato per il periodo selezionato.");
            return;
        }
        
        GeneraAnteprimaDinamica(dati, titolo, file);
        
        // Piccolo ritardo per assicurarsi che il DOM sia pronto
        setTimeout(function() { 
            EsportaPDFProfessionale(false); 
        }, 800);
        
    } catch(e) {
        alert("Errore durante la generazione della stampa specializzata: " + e.message);
    }
}

function ActionPulisciDuplicati() {
    try {
        var mIdx = document.getElementById("cmbMese").selectedIndex + 1;
        var a = document.getElementById("cmbAnni").value;
        
        // Query Aggressiva basata sulla DATA REALE (ignora MeseRiferimento/AnnoRiferimento errati)
        var sqlGroups = "SELECT ClienteNome, DataConsegna, COUNT(*) as Conta " +
                        "FROM tblConsegne " +
                        "WHERE Month(DataConsegna) = " + mIdx + " AND Year(DataConsegna) = " + a + " " +
                        "GROUP BY ClienteNome, DataConsegna " +
                        "HAVING COUNT(*) > 1";
        
        var gruppi = queryAccessDB(sqlGroups);
        if (gruppi.length === 0) {
            alert("Nessun record duplicato trovato per il periodo selezionato.");
            return;
        }
        
        var idsToDelete = [];
        var totalDuplicated = 0;
        
        for (var i = 0; i < gruppi.length; i++) {
            var g = gruppi[i];
            var sqlDetails = "SELECT ID FROM tblConsegne " +
                             "WHERE ClienteNome = '" + sqlEscape(g.ClienteNome) + "' " +
                             "AND DataConsegna = " + formatDateToDB(formatDBDateToIT(g.DataConsegna)) + " " +
                             "ORDER BY (KmAndata + KmRitorno) DESC, ID DESC";
            
            var records = queryAccessDB(sqlDetails);
            for (var j = 1; j < records.length; j++) {
                idsToDelete.push(records[j].ID);
                totalDuplicated++;
            }
        }
        
        if (idsToDelete.length > 0) {
            if (confirm("Sistema ha trovato " + totalDuplicated + " record duplicati reali.\n" +
                        "Vuoi rimuoverli mantenendo solo la versione più completa?\n\n" +
                        "(Operazione basata sulla data reale di consegna)")) {
                
                var sqlDelete = "DELETE FROM tblConsegne WHERE ID IN (" + idsToDelete.join(",") + ")";
                if (executeAccessDBCrud(sqlDelete)) {
                    alert("Deduplicazione forzata completata! Rimossi " + totalDuplicated + " record.");
                    CercaConsegne();
                }
            }
        } else {
            alert("Nessun duplicato significativo trovato nel periodo selezionato.");
        }
    } catch(e) {
        alert("Errore durante la pulizia duplicati: " + e.message);
    }
}

function ActionRimuoviBozzeVuote() {
    try {
        var mIdx = document.getElementById("cmbMese").selectedIndex + 1;
        var a = document.getElementById("cmbAnni").value;
        
        // Verifica basata sulla DATA REALE di consegna
        var sqlCheck = "SELECT COUNT(*) as Conta FROM tblConsegne " +
                       "WHERE Month(DataConsegna) = " + mIdx + " AND Year(DataConsegna) = " + a + " " +
                       "AND KmAndata=0 AND KmRitorno=0";
        var count = queryAccessDB(sqlCheck)[0].Conta;
        
        if (count == 0) {
            alert("Non ci sono record con 0 KM per il mese/anno selezionato.");
            return;
        }
        
        if (confirm("Attenzione: sono stati trovati " + count + " record 'fantasma' (0 KM) per il periodo selezionato.\n\n" +
                    "Vuoi cancellarli tutti definitivamente per pulire il tuo report?\n" +
                    "(I record con KM inseriti non verranno toccati)")) {
            
            var sqlDelete = "DELETE FROM tblConsegne " +
                           "WHERE Month(DataConsegna) = " + mIdx + " AND Year(DataConsegna) = " + a + " " +
                           "AND KmAndata=0 AND KmRitorno=0";
            
            if (executeAccessDBCrud(sqlDelete)) {
                alert("Pulizia forzata completata! Rimossi " + count + " record vuoti.");
                CercaConsegne();
            }
        }
    } catch(e) {
        alert("Errore durante la rimozione bozze: " + e.message);
    }
}

function ActionConsegneImminenti() {
    var dOggi = new Date();
    var dFine = new Date();
    dFine.setDate(dOggi.getDate() + 5);
    
    var sOggi = "#" + dOggi.getFullYear() + "-" + (dOggi.getMonth()+1) + "-" + dOggi.getDate() + "#";
    var sFine = "#" + dFine.getFullYear() + "-" + (dFine.getMonth()+1) + "-" + dFine.getDate() + "#";
    
    // Query per range date
    var sql = "SELECT * FROM tblConsegne WHERE DataConsegna BETWEEN " + sOggi + " AND " + sFine + " ORDER BY DataConsegna ASC, OraConsegna ASC";
    
    var arr = queryAccessDB(sql);
    
    // NOTIFICA E SCELTA UTENTE
    if(arr.length === 0) {
        alert("Nessuna consegna prevista per i prossimi 5 giorni.");
        return;
    }

    alert("Pianificazione Logistica:\n\nSono state trovate " + arr.length + " consegne nei prossimi 5 giorni.");
    
    if(confirm("Vuoi generare il documento PDF per la pianificazione dei prossimi 5 giorni?")) {
        GeneraAnteprimaDinamica(arr, "Pianificazione Prossime Consegne (5gg)", "Pianificazione_Consegne_Settimanali.pdf");
        return;
    }
    
    // Se non stampa, mostra comunque nel listato principale come prima
    arrayConsegneMemory = arr;
    var tbody = document.getElementById("lstClientiBody");
    tbody.innerHTML = "";
    
    for(var u=0; u<arr.length; u++) {
        var row = arr[u];
        var tr = document.createElement("tr");
        tr.setAttribute("data-idx", u);
        var dtStr = formatDBDateToIT(row.DataConsegna);
        // Icone Azioni Affiancate (Modifica, Salva, Elimina)
        var btnEdit = "<img src='https://img.icons8.com/fluency/48/edit.png' style='width:22px; cursor:pointer; margin-right:6px;' title='Modifica' onclick='event.cancelBubble=true; this.parentElement.parentElement.click(); window.scrollTo(0,0);'>";
        var btnSave = "<img src='https://img.icons8.com/fluency/48/save.png' style='width:22px; cursor:pointer; margin-right:6px;' title='Salva' onclick='event.cancelBubble=true; document.getElementById(\"cmdSalva\").click();'>";
        var btnDelete = "<img src='https://img.icons8.com/fluency/48/delete-forever.png' style='width:22px; cursor:pointer;' onclick='event.cancelBubble=true; ActionEliminaPerRiga(" + row.ID + ")' title='Elimina'>";
        var actionsCol = btnEdit + btnSave + btnDelete;

        tr.innerHTML = "<td style='font-weight:700; color:#005a9e;'>" + (row.ClienteNome||"-") + "</td>" +
                       "<td>" + (row.Provincia||"-") + "</td>" +
                       "<td>" + dtStr + " (" + (row.OraConsegna||"--") + ")</td>" +
                       "<td>" + (row.LocalitaConsegna||"-") + "</td>" +
                       "<td style='font-size:0.9rem;'>" + (row.Telefono||"-") + "</td>" +
                       "<td style='text-align:center; white-space:nowrap;'>" + actionsCol + "</td>";
        
        tr.onclick = function() {
             var trs = tbody.getElementsByTagName("tr");
             for(var z=0; z<trs.length; z++) trs[z].className = "";
             this.className = "selected";
             CaricaDettaglioConsegna(arrayConsegneMemory[this.getAttribute("data-idx")]);
        };
        tbody.appendChild(tr);
    }
    document.getElementById("lblContatore").innerText = "IMMINENTI: Found " + arr.length;
}

// ==========================================
// ORDINAMENTO PRIORITA (SU / GIU)
// ==========================================
function GetPrioritaOrMax(valStr) {
    if(valStr === "" || valStr === null || valStr === undefined) return 999;
    var n = Number(valStr);
    if(isNaN(n)) return 999;
    return n;
}

function ActionSpostaSu() {
    if (!CheckUnsavedChanges()) return;
    if(!idConsegnaCorrente || idConsegnaCorrente === "NEW") { alert("Seleziona una consegna dalla lista."); return; }
    
    // Troviamo l'indice nell'array in memoria
    var idx = -1;
    for(var i=0; i<arrayConsegneMemory.length; i++) {
        if(Number(arrayConsegneMemory[i].ID) === idConsegnaCorrente) { idx = i; break; }
    }
    
    if(idx <= 0) return; // Già in cima o non trovato
    
    var curr = arrayConsegneMemory[idx];
    var prev = arrayConsegneMemory[idx-1];
    
    var dCurr = formatDBDateToIT(curr.DataConsegna);
    var dPrev = formatDBDateToIT(prev.DataConsegna);
    
    if (dCurr !== "" && dPrev !== "" && dCurr !== dPrev) {
        chiediSpostamentoData(curr, prev, function(choice) {
            if (choice === "annulla") return;
            var targetDateSql = "";
            if (choice === "allinea") {
                targetDateSql = ", DataConsegna = " + formatDateToDB(dPrev);
            }
            eseguiSwapSposta(curr, prev, idx - 1, targetDateSql, "su");
        });
    } else {
        eseguiSwapSposta(curr, prev, idx - 1, "", "su");
    }
}

function ActionSpostaGiu() {
    if (!CheckUnsavedChanges()) return;
    if(!idConsegnaCorrente || idConsegnaCorrente === "NEW") { alert("Seleziona una consegna dalla lista."); return; }
    
    var idx = -1;
    for(var i=0; i<arrayConsegneMemory.length; i++) {
        if(Number(arrayConsegneMemory[i].ID) === idConsegnaCorrente) { idx = i; break; }
    }
    
    if(idx === -1 || idx >= arrayConsegneMemory.length - 1) return; // Già in fondo
    
    var curr = arrayConsegneMemory[idx];
    var next = arrayConsegneMemory[idx+1];
    
    var dCurr = formatDBDateToIT(curr.DataConsegna);
    var dNext = formatDBDateToIT(next.DataConsegna);
    
    if (dCurr !== "" && dNext !== "" && dCurr !== dNext) {
        chiediSpostamentoData(curr, next, function(choice) {
            if (choice === "annulla") return;
            var targetDateSql = "";
            if (choice === "allinea") {
                targetDateSql = ", DataConsegna = " + formatDateToDB(dNext);
            }
            eseguiSwapSposta(curr, next, idx + 1, targetDateSql, "giu");
        });
    } else {
        eseguiSwapSposta(curr, next, idx + 1, "", "giu");
    }
}

function eseguiSwapSposta(curr, targetRow, targetIndex, extraSql, direzione) {
    // Swap Priorita nel DB
    var pCurr = GetPrioritaOrMax(curr.Priorita);
    var pTarget = GetPrioritaOrMax(targetRow.Priorita);
    
    // Se sono uguali, forziamo un distacco
    if(pCurr === pTarget) {
        if (direzione === "su") pCurr++; else pCurr--;
    }
    
    // Aggiorna localmente le priorità in memoria
    curr.Priorita = pTarget;
    targetRow.Priorita = pCurr;
    
    var sql1 = "UPDATE tblConsegne SET Priorita = " + pTarget + (extraSql || "") + " WHERE ID = " + curr.ID;
    var sql2 = "UPDATE tblConsegne SET Priorita = " + pCurr + " WHERE ID = " + targetRow.ID;
    
    var currentIndex = (direzione === "su") ? targetIndex + 1 : targetIndex - 1;
    
    var dCurr = formatDBDateToIT(curr.DataConsegna);
    var dTarget = formatDBDateToIT(targetRow.DataConsegna);
    var canDoDomSwap = (dCurr === dTarget && !extraSql);
    
    if (canDoDomSwap) {
        // Swap nell'array in memoria
        var temp = arrayConsegneMemory[currentIndex];
        arrayConsegneMemory[currentIndex] = arrayConsegneMemory[targetIndex];
        arrayConsegneMemory[targetIndex] = temp;
        
        // Swap visivo immediato degli elementi DOM
        var container = document.getElementById("cardListContainer");
        var cards = container.getElementsByClassName("delivery-gold-card");
        var cardCurr = cards[currentIndex];
        var cardTarget = cards[targetIndex];
        
        if (cardCurr && cardTarget) {
            if (direzione === "su") {
                container.insertBefore(cardCurr, cardTarget);
            } else {
                container.insertBefore(cardTarget, cardCurr);
            }
            cardCurr.setAttribute("data-idx", targetIndex);
            cardTarget.setAttribute("data-idx", currentIndex);
            
            // Ripristina l'evidenziazione
            for (var z = 0; z < cards.length; z++) cards[z].classList.remove("selected");
            cardCurr.classList.add("selected");
            
            // Aggiorna l'editor se è aperto
            var ep = document.getElementById("editorPanel");
            if (ep && !ep.classList.contains("collapsed")) {
                CaricaDettaglioConsegna(arrayConsegneMemory[targetIndex]);
            }
            
            // Mostra feedback visivo tramite Toast
            var posNum = targetIndex + 1;
            var msg = (direzione === "su" ? "⬆️ Spostato in alto!" : "⬇️ Spostato in basso!") + " Nuova posizione: <strong>" + posNum + "</strong> di " + arrayConsegneMemory.length;
            showToast(msg, "success");
        }
        
        // Esegui l'aggiornamento del database asincrono in background per non bloccare la UI
        executeAccessDBCrudAsync(sql1, function(s1) {
            if (s1) {
                executeAccessDBCrudAsync(sql2, function(s2) {
                    if (!s2) CercaConsegne(); // Ripristina in caso di errore
                });
            } else {
                CercaConsegne();
            }
        });
    } else {
        // Fallback su riordino classico con query sincrona e ricarica totale per cambi di data
        if(executeAccessDBCrud(sql1) && executeAccessDBCrud(sql2)) {
            CercaConsegne();
            setTimeout(function(){
                 var container = document.getElementById("cardListContainer");
                 var cards = container.getElementsByClassName("delivery-gold-card");
                 if(cards[targetIndex]) {
                     for(var z=0; z<cards.length; z++) cards[z].classList.remove("selected");
                     cards[targetIndex].classList.add("selected");
                     
                     var ep = document.getElementById("editorPanel");
                     if(ep && !ep.classList.contains("collapsed")) {
                         CaricaDettaglioConsegna(arrayConsegneMemory[targetIndex]);
                     }
                 }
                 
                 var posNum = targetIndex + 1;
                 var msg = (direzione === "su" ? "⬆️ Spostato in alto!" : "⬇️ Spostato in basso!") + " Nuova posizione: <strong>" + posNum + "</strong> di " + arrayConsegneMemory.length;
                 if (extraSql) msg += " (Data allineata)";
                 showToast(msg, "success");
            }, 100);
        }
    }
}

function chiediSpostamentoData(curr, target, onChoice) {
    var overlay = document.getElementById("dateConfirmOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "dateConfirmOverlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.background = "rgba(15, 23, 42, 0.75)";
        overlay.style.backdropFilter = "blur(8px)";
        overlay.style.zIndex = "1000000";
        overlay.style.display = "none";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        
        var modal = document.createElement("div");
        modal.style.background = "#0f172a";
        modal.style.width = "500px";
        modal.style.borderRadius = "18px";
        modal.style.border = "1.5px solid #fbbf24";
        modal.style.boxShadow = "0 30px 70px rgba(0,0,0,0.7)";
        modal.style.overflow = "hidden";
        modal.style.fontFamily = "'Inter', sans-serif";
        
        var header = document.createElement("div");
        header.style.background = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
        header.style.padding = "20px";
        header.style.borderBottom = "2px solid #fbbf24";
        header.style.color = "white";
        header.style.fontWeight = "900";
        header.style.fontSize = "14px";
        header.style.letterSpacing = "0.5px";
        header.innerHTML = "⚠️ ATTENZIONE: DATE DIVERSE";
        modal.appendChild(header);
        
        var body = document.createElement("div");
        body.id = "dateConfirmBody";
        body.style.padding = "25px";
        body.style.color = "#cbd5e1";
        body.style.fontSize = "13px";
        body.style.lineHeight = "1.6";
        modal.appendChild(body);
        
        var footer = document.createElement("div");
        footer.style.padding = "20px";
        footer.style.background = "rgba(15,23,42,0.95)";
        footer.style.borderTop = "1px solid rgba(255,255,255,0.06)";
        
        function createBtn(text, bg, border, color, onClick) {
            var btn = document.createElement("button");
            btn.style.width = "100%";
            btn.style.padding = "11px 15px";
            btn.style.borderRadius = "8px";
            btn.style.border = "1.5px solid " + border;
            btn.style.background = bg;
            btn.style.color = color;
            btn.style.fontWeight = "800";
            btn.style.fontSize = "11px";
            btn.style.cursor = "pointer";
            btn.style.textTransform = "uppercase";
            btn.style.transition = "all 0.2s";
            btn.style.marginBottom = "10px";
            btn.innerHTML = text;
            btn.onclick = onClick;
            return btn;
        }
        
        var btnAllinea = createBtn("", "rgba(251,191,36,0.15)", "#fbbf24", "#fbbf24", function() {
            document.getElementById("dateConfirmOverlay").style.display = "none";
            onChoice("allinea");
        });
        btnAllinea.id = "btnConfirmAllinea";
        footer.appendChild(btnAllinea);
        
        var btnMantieni = createBtn("MANTIENI LE DATE ORIGINARIE", "rgba(14, 165, 233, 0.15)", "#0ea5e9", "#cbd5e1", function() {
            document.getElementById("dateConfirmOverlay").style.display = "none";
            onChoice("mantieni");
        });
        footer.appendChild(btnMantieni);
        
        var btnAnnulla = createBtn("ANNULLA LO SPOSTAMENTO", "#1e293b", "#334155", "#94a3b8", function() {
            document.getElementById("dateConfirmOverlay").style.display = "none";
            onChoice("annulla");
        });
        btnAnnulla.style.marginBottom = "0px";
        footer.appendChild(btnAnnulla);
        
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }
    
    var dateCurr = formatDBDateToIT(curr.DataConsegna);
    var dateTarget = formatDBDateToIT(target.DataConsegna);
    
    document.getElementById("dateConfirmBody").innerHTML = 
        "Stai spostando la consegna di <strong>" + curr.ClienteNome + "</strong> (del " + dateCurr + ") " +
        "accanto a quella di <strong>" + target.ClienteNome + "</strong> (del " + dateTarget + ").<br><br>" +
        "Le due consegne hanno <strong>date diverse</strong>. Cosa desideri fare?";
        
    document.getElementById("btnConfirmAllinea").innerHTML = "ALLINEA DATA (Imposta anche " + curr.ClienteNome + " al " + dateTarget + ")";
    
    document.getElementById("dateConfirmOverlay").style.display = "flex";
}

// ==========================================
// TOAST NOTIFICATIONS FOR USER FEEDBACK (UX)
// ==========================================
function showToast(message, type) {
    var toast = document.getElementById("customToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "customToast";
        toast.style.position = "fixed";
        toast.style.bottom = "30px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.background = "rgba(15, 23, 42, 0.95)";
        toast.style.color = "#f8fafc";
        toast.style.padding = "12px 24px";
        toast.style.borderRadius = "12px";
        toast.style.border = "1.5px solid #0ea5e9";
        toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
        toast.style.fontSize = "13px";
        toast.style.fontWeight = "bold";
        toast.style.zIndex = "999999";
        toast.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
        toast.style.opacity = "0";
        toast.style.pointerEvents = "none";
        document.body.appendChild(toast);
    }
    
    // Set color based on type
    if (type === "success") {
        toast.style.borderColor = "#22c55e";
        toast.style.boxShadow = "0 0 20px rgba(34, 197, 94, 0.25)";
    } else if (type === "info") {
        toast.style.borderColor = "#0ea5e9";
        toast.style.boxShadow = "0 0 20px rgba(14, 165, 233, 0.25)";
    } else if (type === "warning") {
        toast.style.borderColor = "#eab308";
        toast.style.boxShadow = "0 0 20px rgba(234, 179, 8, 0.25)";
    }
    
    toast.innerHTML = message;
    toast.style.opacity = "1";
    toast.style.bottom = "50px"; // Sposta leggermente verso l'alto
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    
    window.toastTimeout = setTimeout(function() {
        toast.style.opacity = "0";
        toast.style.bottom = "30px";
    }, 2500);
}

// Helper per ottenere la data estesa in italiano con giorno della settimana
function getGiornoSettimanaIT(dbDate) {
    if (!dbDate) return "";
    try {
        var dObj = null;
        if (dbDate instanceof Date) {
            dObj = dbDate;
        } else {
            var str = String(dbDate).replace(/-/g, "/").replace("T", " ");
            
            // Fix formato italiano DD/MM/YYYY
            var regexIT = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.*))?$/;
            var match = str.match(regexIT);
            
            if (match) {
                var dG = parseInt(match[1], 10);
                var dM = parseInt(match[2], 10) - 1; // I mesi partono da 0 in JS
                var dA = parseInt(match[3], 10);
                dObj = new Date(dA, dM, dG);
            } else {
                var t = Date.parse(str);
                if (!isNaN(t)) dObj = new Date(t);
            }
        }
        
        if (dObj && !isNaN(dObj.getTime())) {
            var days = ["DOMENICA", "LUNEDÌ", "MARTEDÌ", "MERCOLEDÌ", "GIOVEDÌ", "VENERDÌ", "SABATO"];
            var months = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
            return days[dObj.getDay()] + " " + dObj.getDate() + " " + months[dObj.getMonth()] + " " + dObj.getFullYear();
        }
    } catch(e) {}
    return formatDBDateToIT(dbDate);
}

// Cerca materiali da Excel con cache globale autopopolante
function GetMaterialsFromExcelCached(nominativo) {
    if (!nominativo || nominativo.trim() === "") return "";
    try {
        if (typeof window.cachedMaterialsList === "undefined") {
            window.cachedMaterialsList = null;
        }
        if (!window.cachedMaterialsList) {
            var materialPath = fso.BuildPath(fso.BuildPath(currentDir, "gestione_materiale"), "materiali_db.json");
            if (!fso.FileExists(materialPath)) {
                var materialPathFallback = fso.BuildPath(currentDir, "materiali_db.json");
                if (fso.FileExists(materialPathFallback)) materialPath = materialPathFallback;
                else return "";
            }
            var f = fso.OpenTextFile(materialPath, 1, false, -1);
            var content = f.ReadAll();
            f.Close();
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.substring(1);
            }
            try { 
                window.cachedMaterialsList = JSON.parse(content); 
            } catch(e) { 
                window.cachedMaterialsList = eval("(" + content + ")"); 
            }
        }
        
        var normalize = function(s) {
            return String(s || "").toUpperCase().replace(/\s+/g, ' ').trim();
        };

        var searchNom = normalize(nominativo);
        for (var i = 0; i < window.cachedMaterialsList.length; i++) {
            var p = window.cachedMaterialsList[i];
            var targetNom = normalize(p.nominativo);
            if (targetNom !== "" && (targetNom === searchNom || targetNom.indexOf(searchNom) !== -1 || searchNom.indexOf(targetNom) !== -1)) {
                var foundList = [];
                if (p.materiali && p.materiali.length > 0) {
                    for (var j = 0; j < p.materiali.length; j++) {
                        var mat = p.materiali[j];
                        var label = GetMaterialLabel(mat.nome, mat.valore);
                        foundList.push(String(label).toUpperCase());
                    }
                }
                return foundList.join(", ");
            }
        }
    } catch(e) {}
    return "";
}

// Funzione per aprire la mappa da un indirizzo della card
function ApriMappaDaCard(indirizzo, localita, provincia) {
    var addr = (indirizzo + " " + localita + " " + provincia).trim();
    if(addr === "") { alert("Senza indirizzo!"); return; }
    ApriMappaInApp(addr);
}

function AggiornaRoadmapGiornaliera() {
    var dataStr = document.getElementById("txtDataConsegna").value;
    var dataTarget = new Date();
    
    document.getElementById("lblRoadmapData").innerText = "-";
    
    if(dataStr.length === 10) {
         var pts = dataStr.split("/");
         dataTarget = new Date(pts[2], pts[1]-1, pts[0]);
         document.getElementById("lblRoadmapData").innerText = pts[0] + "/" + pts[1];
    } else {
         document.getElementById("lblRoadmapData").innerText = "OGGI";
    }
    
    // Cerchiamo le consegne per questa esatta data...
    var mP = dataTarget.getMonth()+1; var sMP = (mP < 10 ? '0' : '') + mP;
    var dP = dataTarget.getDate(); var sDP = (dP < 10 ? '0' : '') + dP;
    var dtBdb = "#" + dataTarget.getFullYear() + "-" + sMP + "-" + sDP + "#";
    var sqlRM = "SELECT OraConsegna FROM tblConsegne WHERE DataConsegna = " + dtBdb;
    var rsRM = queryAccessDB(sqlRM);
    
    var nm = 0; var np = 0;
    rsRM.forEach(function(rec) {
         var ora = rec.OraConsegna || "";
         if(ora !== "") {
              // Parsiamo "HH:MM"
              var hpts = ora.split(":");
              if(hpts.length>0) {
                   var ho = parseInt(hpts[0], 10);
                   if(!isNaN(ho)) {
                        if(ho < 13) nm++; else np++;
                   }
              }
         }
    });
    
    document.getElementById("lblRoadmapMattina").innerText = "MAT: " + nm;
    document.getElementById("lblRoadmapPomeriggio").innerText = "POM: " + np;
    
    var tot = nm + np;
    var barM = document.getElementById("barMattina");
    var barP = document.getElementById("barPomeriggio");
    if(tot === 0) {
         barM.style.width = "0%"; barP.style.width = "0%";
    } else {
         barM.style.width = ((nm/tot)*100) + "%";
         barP.style.width = ((np/tot)*100) + "%";
    }
}

// ==========================================
// REPORT MENSILE PROFESSIONALE
// ==========================================
function ActionReportMensile() {
    ActionReportMensileBase(false);
}

function ActionReportMensileDiretto() {
    ActionReportMensileBase(true);
}

function ActionReportMensileBase(isDiretto) {
    var m = document.getElementById("cmbMese").selectedIndex + 1;
    var a = document.getElementById("cmbAnni").value;
    var mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    var sql = "SELECT * FROM tblConsegne WHERE " +
              "([MeseRiferimento] = " + m + " AND [AnnoRiferimento] = " + a + ") " +
              "OR ([MeseRiferimento] IS NULL AND Month([DataConsegna]) = " + m + " AND Year([DataConsegna]) = " + a + ") " +
              "ORDER BY DataConsegna ASC, NumeroOrdine ASC, Priorita ASC";
    
    var datiRaw = queryAccessDB(sql);
    if(datiRaw.length === 0) {
        alert("Nessun dato trovato per " + mesiNomi[m-1] + " " + a);
        return;
    }
    
    // Forziamo ordinamento cronologico JS
    datiRaw.sort(function(a, b) {
        var parseSortDate = function(dVal) {
            if (!dVal) return 0;
            var str = String(dVal).replace(/-/g, "/").replace("T", " ");
            var regexIT = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
            var match = str.match(regexIT);
            if (match) {
                var dG = parseInt(match[1], 10);
                var dM = parseInt(match[2], 10) - 1;
                var dA = parseInt(match[3], 10);
                return new Date(dA, dM, dG).getTime();
            }
            var t = Date.parse(str);
            if (!isNaN(t)) return t;
            return 0;
        };
        
        var t1 = parseSortDate(a.DataConsegna);
        var t2 = parseSortDate(b.DataConsegna);
        if (t1 !== t2) return t1 - t2;
        
        var o1 = a.NumeroOrdine ? parseInt(a.NumeroOrdine, 10) : 999;
        var o2 = b.NumeroOrdine ? parseInt(b.NumeroOrdine, 10) : 999;
        if (o1 !== o2) return o1 - o2;
        
        var p1 = a.Priorita ? parseInt(a.Priorita, 10) : 999;
        var p2 = b.Priorita ? parseInt(b.Priorita, 10) : 999;
        return p1 - p2;
    });

    var dati = [];
    for(var k=0; k<datiRaw.length; k++) {
        var kmA = parseFloat(datiRaw[k].KmAndata) || 0;
        var kmR = parseFloat(datiRaw[k].KmRitorno) || 0;
        if(kmA > 0 || kmR > 0) dati.push(datiRaw[k]);
    }

    if(dati.length === 0) {
        alert("Sono state trovate consegne, ma nessuna ha chilometri registrati.");
        return;
    }

    var titolo = "Registro Mensile Consegne - " + mesiNomi[m-1] + " " + a;
    var nFile = "Registro_Consegne_" + mesiNomi[m-1].toUpperCase() + "_" + a + ".pdf";
    
    if (isDiretto) {
        currentReportFileName = nFile;
        var htmlContent = CompilaHTMLReport(dati, titolo);
        document.getElementById("reportStampaContainer").innerHTML = htmlContent;
        EsportaPDFProfessionale(false);
    } else {
        GeneraAnteprimaDinamica(dati, titolo, nFile);
    }
}

function GeneraAnteprimaDinamica(dati, titoloReport, nomeFileOutput) {
    currentReportFileName = nomeFileOutput;
    var htmlContent = CompilaHTMLReport(dati, titoloReport);
    var container = document.getElementById("reportStampaContainer");

    var controls = '<div class="print-controls no-print">';
    controls += '<button class="btn-change-folder" onclick="ScegliCartellaLavoro()" title="Cambia cartella di salvataggio">&#128194;</button>';
    controls += '<button class="btn-print-confirm" onclick="EsportaPDFProfessionale(false)">&#128196; GENERA PDF</button>';
    controls += '<button class="btn-email-segreteria" onclick="InviaReportSegreteria()">&#9993;&#65039; INVIA ALLA SEGRETERIA</button>';
    controls += '<button class="btn-print-cancel" onclick="ChiudiAnteprimaReport()">&#10060; ESCI</button>';
    controls += '</div>';
    
    container.innerHTML = controls + htmlContent;
    container.style.display = "block";
    document.getElementById("mainDashboardContainer").style.display = "none";
}

function CompilaHTMLReport(dati, titoloReport) {
    var mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    
    var hasPianificazione = titoloReport.indexOf("Pianificazione") > -1;
    var hasTotals = !hasPianificazione;

    // ALGORITMO DI CHUNKING INTELLIGENTE PER IMPAGINAZIONE PDF LANDSCAPE
    var MAX_ROWS_PAGE_1_TOTALS = 8; // Pagina singola con header e totali
    var MAX_ROWS_PAGE_1 = 11;       // Prima pagina (solo header)
    var MAX_ROWS_MIDDLE = 14;       // Pagine centrali (solo righe, riempite al massimo)
    var MAX_ROWS_LAST = 11;          // Ultima pagina (solo totali)

    var chunks = [];
    var remainingDati = dati.slice();

    if (hasTotals) {
        if (remainingDati.length <= MAX_ROWS_PAGE_1_TOTALS) {
            chunks.push(remainingDati);
        } else {
            // Dobbiamo fare almeno 2 pagine.
            // La prima pagina può contenere al massimo MAX_ROWS_PAGE_1 (8) righe.
            // Ma se le righe totali sono poche (es. tra 6 e 10), limitiamo la prima pagina
            // per forzare almeno 2 righe sulla pagina successiva che ospita i totali.
            var firstPageRows = MAX_ROWS_PAGE_1;
            if (remainingDati.length <= MAX_ROWS_PAGE_1 + 2) {
                firstPageRows = remainingDati.length - 2;
                if (firstPageRows < 1) firstPageRows = 1;
            }
            chunks.push(remainingDati.slice(0, firstPageRows));
            remainingDati = remainingDati.slice(firstPageRows);

            while (remainingDati.length > 0) {
                if (remainingDati.length <= MAX_ROWS_LAST) {
                    chunks.push(remainingDati);
                    remainingDati = [];
                } else {
                    // Pagine centrali. Se le righe rimanenti sono poco più di MAX_ROWS_MIDDLE,
                    // lasciamo almeno 2 righe all'ultima pagina.
                    var rowsToTake = MAX_ROWS_MIDDLE;
                    if (remainingDati.length <= MAX_ROWS_MIDDLE + 2) {
                        rowsToTake = remainingDati.length - 2;
                        if (rowsToTake < 1) rowsToTake = 1;
                    }
                    chunks.push(remainingDati.slice(0, rowsToTake));
                    remainingDati = remainingDati.slice(rowsToTake);
                }
            }
        }
    } else {
        // Nessun totale (Pianificazione)
        if (remainingDati.length <= MAX_ROWS_PAGE_1) {
            chunks.push(remainingDati);
        } else {
            chunks.push(remainingDati.slice(0, MAX_ROWS_PAGE_1));
            remainingDati = remainingDati.slice(MAX_ROWS_PAGE_1);
            while (remainingDati.length > 0) {
                chunks.push(remainingDati.slice(0, MAX_ROWS_MIDDLE));
                remainingDati = remainingDati.slice(MAX_ROWS_MIDDLE);
            }
        }
    }

    var numPagine = chunks.length;
    var html = "";
    
    var isAlt = false;
    var totalKm = 0;
    var totalSpeseMensili = 0;
    var displayCount = 0;
    var prevDate = "";
    var dailyOrder = 0;
    
    var parseDate = function(dVal) {
        if (!dVal) return new Date();
        if (typeof dVal === "string") {
            var clean = dVal.replace(/-/g, "/").replace("T", " ");
            var regexIT = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.*))?$/;
            var match = clean.match(regexIT);
            if (match) {
                var dG = parseInt(match[1], 10);
                var dM = parseInt(match[2], 10) - 1;
                var dA = parseInt(match[3], 10);
                return new Date(dA, dM, dG);
            }
            var d = new Date(clean);
            if (!isNaN(d.getTime())) return d;
        }
        var d2 = new Date(dVal);
        if (!isNaN(d2.getTime())) return d2;
        return new Date();
    };

    var formattedDates = [];
    for(var k=0; k<dati.length; k++) {
        var d = parseDate(dati[k].DataConsegna);
        formattedDates.push((d.getDate()<10?'0':'')+d.getDate() + "/" + ((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1) + "/" + d.getFullYear());
    }

    var globalIdxOffset = 0;

    for (var p = 0; p < numPagine; p++) {
        var chunk = chunks[p];

        // Creiamo la pagina come un blocco relativo per posizionare il footer in modo assoluto in fondo
        html += "<div class='page'" + (p < numPagine - 1 ? " style='page-break-after: always; height: 175mm; position: relative;'" : " style='height: 175mm; position: relative;'") + ">";
        
        // Raggruppiamo Header + Tabella + Firme 
        html += "<div>";

        if (p === 0) {
            html += "  <div class='header-coop'>Cooperativa Aurelio Nicolodi</div>";
            html += "  <div class='report-subtitle'>Servizi di Logistica Consegne e Configurazione Ausili</div>";
            html += "  <div class='report-title-box'><div class='report-title'>" + titoloReport + "</div></div>";
        } else {
            html += "  <div style='text-align:center; font-weight:bold; margin-bottom: 15px; margin-top: 10px; font-size:12pt; text-transform:uppercase; color:#2c3e50;'>" + titoloReport + "</div>";
        }

        var tableHeader = "";
        if (hasPianificazione) {
            tableHeader = "<tr><th width='35'>N&deg;</th><th width='90'>Ora</th><th>Cognome Nome</th><th width='120'>Telefono</th><th width='90'>Ordine</th><th>Localit&agrave; / Indirizzo</th><th width='95'>Giorno</th></tr>";
        } else {
            tableHeader = "<tr><th width='35'>N&deg;</th><th width='60'>Mese</th><th>Cognome Nome</th><th width='120'>Localit&agrave;</th><th>Indirizzo Residenza</th><th width='95'>Giorno</th><th width='60'>O.C.</th><th width='50'>Km A.</th><th width='50'>Km R.</th><th width='70'>Km Tot.</th></tr>";
        }

        html += "  <table class='report-table'><thead>" + tableHeader + "</thead><tbody>";

        for (var i = 0; i < chunk.length; i++) {
            var globalIdx = globalIdxOffset + i;
            var r = chunk[i];
            var dStr = formattedDates[globalIdx];
            displayCount++;
            
            if (dStr !== prevDate) {
                isAlt = !isAlt;
                prevDate = dStr;
                dailyOrder = 0;
            }
            dailyOrder++;
            var kmA = Math.round((parseFloat(r.KmAndata) || 0) * 10) / 10;
            var kmR = Math.round((parseFloat(r.KmRitorno) || 0) * 10) / 10;
            var kmTot = Math.round((kmA + kmR) * 10) / 10;
            
            totalKm = Math.round((totalKm + kmTot) * 10) / 10;
            
            var nameClass = isAlt ? "row-name-normal" : "row-name";

            if (hasPianificazione) {
                html += "<tr class='" + (isAlt ? "bg-alt" : "") + "'>";
                html += "<td class='row-id'>" + displayCount + "</td>";
                html += "<td align='center'><b>" + (r.OraConsegna || "-") + "</b></td>";
                html += "<td class='" + nameClass + "'>" + (r.ClienteNome || "").toUpperCase() + "</td>";
                html += "<td>" + (r.Telefono || "-") + "</td>";
                html += "<td align='center'>" + dailyOrder + "</td>";
                html += "<td>" + (r.LocalitaConsegna || "").toUpperCase() + " - " + (r.IndirizzoConsegna || "") + "</td>";
                html += "<td class='row-date' align='center'>" + dStr + "</td>";
                html += "</tr>";
                var nota = (r.Note || "").trim();
                if (nota !== "") {
                    html += "<tr class='" + (isAlt ? "bg-alt" : "") + "'><td></td><td colspan='6' style='padding-left: 20px; font-style: italic; color: #555;'><b>NOTA:</b> " + nota + "</td></tr>";
                }
            } else {
                var dObj = parseDate(r.DataConsegna);
                html += "<tr class='" + (isAlt ? "bg-alt" : "") + "'>";
                html += "<td class='row-id'>" + displayCount + "</td>";
                html += "<td>" + mesiNomi[dObj.getMonth()].substring(0, 3).toUpperCase() + "</td>";
                html += "<td class='" + nameClass + "'>" + (r.ClienteNome || "").toUpperCase() + "</td>";
                html += "<td>" + (r.LocalitaConsegna || "").toUpperCase() + "</td>";
                html += "<td>" + (r.IndirizzoConsegna || "") + "</td>";
                html += "<td class='row-date' align='center'>" + dStr + "</td>";
                html += "<td align='center'>" + dailyOrder + "</td>";
                html += "<td align='right'>" + (kmA > 0 ? kmA.toFixed(1) : "-") + "</td>";
                html += "<td align='right'>" + (kmR > 0 ? kmR.toFixed(1) : "-") + "</td>";
                html += "<td align='right'><b>" + (kmTot > 0 ? kmTot.toFixed(1) : "-") + "</b></td>";
                html += "</tr>";

                var speseTotRiga = (parseFloat(r.RimborsoAutostrada)||0) + (parseFloat(r.RimborsoParcheggio)||0) + (parseFloat(r.RimborsoTrenoAvaria)||0) + (parseFloat(r.RimborsoVarie)||0);
                if (speseTotRiga > 0) {
                     totalSpeseMensili += speseTotRiga;
                     var descr = "Spese extra sostenute: ";
                     if ((parseFloat(r.RimborsoAutostrada)||0)>0) descr += "Autostrada/Pedaggi €" + parseFloat(r.RimborsoAutostrada).toFixed(2) + "  ";
                     if ((parseFloat(r.RimborsoParcheggio)||0)>0) descr += "Parcheggio €" + parseFloat(r.RimborsoParcheggio).toFixed(2) + "  ";
                     if ((parseFloat(r.RimborsoTrenoAvaria)||0)>0) descr += "Treno/Avaria €" + parseFloat(r.RimborsoTrenoAvaria).toFixed(2) + "  ";
                     if ((parseFloat(r.RimborsoVarie)||0)>0) descr += "Varie €" + parseFloat(r.RimborsoVarie).toFixed(2) + "  ";
                     if (r.RimborsoNote) descr += "| Note: " + r.RimborsoNote;
                     html += "<tr class='" + (isAlt ? "bg-alt" : "") + "'><td colspan='3'></td><td colspan='7' style='padding-left: 10px; font-style: italic; color: #10b981; font-size: 10px;'><b>" + descr + " (TOT: € " + speseTotRiga.toFixed(2) + ")</b></td></tr>";
                }
            }
        }

        html += "</tbody></table>";

        globalIdxOffset += chunk.length;

        // FOOTER PER PAGINA (Totale e Firme solo all'ultima)
        if (p === numPagine - 1 && hasTotals) {
            html += "<div class='report-footer-bundle'>";
            html += "<div class='totale-wrapper' style='display:flex; justify-content:space-between; gap:20px;'>";
            html += "<div class='totale-box' style='flex:1;'><span class='totale-label'>CHILOMETRAGGIO TOTALE COMPLESSIVO</span><span class='totale-value'>" + totalKm.toLocaleString("it-IT", {minimumFractionDigits: 1}) + " KM</span></div>";
            if (totalSpeseMensili > 0) {
                html += "<div class='totale-box' style='flex:1; border-color:#10b981; background:rgba(16,185,129,0.05);'><span class='totale-label' style='color:#10b981;'>TOTALE SPESE EXTRA MESE</span><span class='totale-value' style='color:#10b981;'>€ " + totalSpeseMensili.toLocaleString("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + "</span></div>";
            }
            html += "</div>";
            html += "<div class='signatures-wrapper'><table width='100%' border='0'><tr><td width='50%' class='signature-block'><div class='signature-line'>Firma per Ricevuta</div></td><td width='50%' class='signature-block'><div class='signature-line'>Firma per Visione</div></td></tr></table></div>";
            html += "</div>";
        }

        html += "</div>"; // Chiude il blocco top (tabella + intestazione + eventualmente firme)

        // PAGE NUMBER E DATA SEMPRE AL FONDO (posizionato in modo assoluto in fondo al foglio)
        var dataDiOggi = new Date();
        var dataFormatted = (dataDiOggi.getDate()<10?'0':'')+dataDiOggi.getDate() + "/" + ((dataDiOggi.getMonth()+1)<10?'0':'')+(dataDiOggi.getMonth()+1) + "/" + dataDiOggi.getFullYear();
        html += "<div class='print-meta' style='position: absolute; bottom: 0; left: 0; width: 100%; display: flex; justify-content: space-between; font-size: 10pt; color: #64748b; font-family: Segoe UI, Tahoma, sans-serif; border-top: 1px solid #e2e8f0; padding-top: 8px;'>" +
                "<span style='font-style: italic;'>Data di emissione: " + dataFormatted + "</span>" +
                "<span style='font-weight: bold; letter-spacing: 0.5px;'>" + (p + 1) + " di " + numPagine + "</span></div>";

        html += "</div>"; // close .page
    }
    
    return html;
}

function ChiudiAnteprimaReport() {
    isNavigating = true;
    var shell = new ActiveXObject("WScript.Shell");
    var htaPath = fso.BuildPath(currentDir, "dashboard.html");
    shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    window.close();
}

function EsportaPDFProfessionale(silente) {
    var step = 'Inizializzazione';
    var a_rep = document.getElementById('cmbAnni') ? document.getElementById('cmbAnni').value : new Date().getFullYear().toString();
    var targetFolder = fso.BuildPath(fso.GetParentFolderName(currentDir), 'REPORT_MENSILE_' + a_rep);
    if (!fso.FolderExists(targetFolder)) {
        try { fso.CreateFolder(targetFolder); } catch(e) { targetFolder = OttieniPercorsoSalvataggioSicuro(); }
    }
    exportPath = targetFolder;

    var fileName = currentReportFileName;
    if(fileName === '') {
        var m = document.getElementById('cmbMese').value || 'REPOR';
        var a = document.getElementById('cmbAnni').value || '2026';
        fileName = 'Registro_Consegne_' + m.toUpperCase() + '_' + a + '.pdf';
    }
    var pdfPath = fso.BuildPath(exportPath, fileName);
    
    if(IsFileLocked(pdfPath)) {
        alert('IMPOSSIBILE SCRIVERE IL PDF:\nIl file ' + fileName + ' è aperto in un altro programma.\n\nPer favore, chiudi il PDF e riprova.');
        return null;
    }

    var btn = document.querySelector('.btn-print-confirm');
    var oldTxt = btn ? btn.innerText : '';
    if(btn) { btn.innerText = 'GENERAZIONE...'; btn.disabled = true; }
    
    var shell = new ActiveXObject('WScript.Shell');
    var tmpPath = '';

    try {
        step = 'Creazione HTML temporaneo';
        var reportHTML = document.getElementById('reportStampaContainer').innerHTML;
        reportHTML = reportHTML.replace(/<div class="print-controls[\s\S]*?<\/div>/i, '');
        
        var styleExtra = '<style>' +
                          '@media screen {' +
                          '  #reportStampaContainer { background-color: #525659 !important; padding: 60px 0 40px 0 !important; overflow-y: auto; }' +
                          '  .btn-change-folder { background: #f39c12; color: white; border: none; padding: 10px 15px; font-weight: bold; cursor: pointer; border-radius: 5px; font-size: 14pt; }' +
                          '  .page { ' +
                          '    width: 297mm !important; ' +
                          '    height: 210mm !important; ' +
                          '    background: white !important; ' +
                          '    margin: 0 auto 40px auto !important; ' +
                          '    position: relative !important; ' +
                          '    border: 12mm solid white !important; ' +
                          '    border-radius: 2px !important; ' +
                          '    box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; ' +
                          '    box-sizing: border-box !important; ' +
                          '  }' +
                          '}' +
                          '@media print {' +
                          '  .page { ' +
                          '    width: 100% !important; ' +
                          '    height: 175mm !important; ' +
                          '    background: transparent !important; ' +
                          '    margin: 0 !important; ' +
                          '    padding: 0 !important; ' +
                          '    border: none !important; ' +
                          '    box-shadow: none !important; ' +
                          '    box-sizing: content-box !important; ' +
                          '  }' +
                          '}' +
                          '@page { size: landscape; margin: 0.8cm; }' +
                          'body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; }' +
                          '.page { padding: 0; border: none; }' +
                          '.header-coop { font-size: 24pt; font-weight: 800; color: #0f172a; text-align: center; letter-spacing: 1.5px; margin-bottom: 2px; text-transform: uppercase; }' +
                          '.report-subtitle { font-size: 11pt; font-weight: 500; color: #64748b; text-align: center; margin-bottom: 20px; display: block; letter-spacing: 0.5px; }' +
                          '.report-title-box { border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 12px 0; margin-bottom: 25px; text-align: center; background: #f8fafc; }' +
                          '.report-title { font-size: 15pt; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0; letter-spacing: 1px; }' +
                          '.report-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border-bottom: 2px solid #334155; page-break-after: avoid; }' +
                           '.report-table tr { page-break-inside: avoid; }' +
                           '.report-table th { background-color: #334155 !important; color: #ffffff !important; font-weight: 600; font-size: 10pt; padding: 8px 6px; text-align: center; text-transform: uppercase; border-bottom: 2px solid #0f172a; border-right: 1px solid rgba(255,255,255,0.1); -webkit-print-color-adjust: exact; letter-spacing: 0.5px; }' +
                           '.report-table th:last-child { border-right: none; }' +
                           '.report-table td { padding: 6px 6px; font-size: 10.5pt; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }' +
                           '.bg-alt { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }' +
                           '.row-id { font-weight: bold; color: #64748b; text-align: center; font-size: 9.5pt; }' +
                           '.row-name { font-weight: bold; color: #0f172a; }' +
                           '.row-name-normal { font-weight: normal; color: #334155; }' +
                           '.row-date { text-align: center; color: #475569; }' +
                           '.report-footer-bundle { page-break-inside: avoid; break-inside: avoid; margin-top: 15px; }' +
                           '.totale-wrapper { display: flex; justify-content: flex-end; margin-top: 0; }' +
                           '.totale-box { border: 2px solid #334155; padding: 6px 15px; background: #fff; border-radius: 6px; text-align: right; min-width: 220px; -webkit-print-color-adjust: exact; }' +
                           '.totale-label { font-size: 9pt; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px; }' +
                           '.totale-value { font-size: 15pt; font-weight: 800; color: #e67e22; }' + 
                           '.signatures-wrapper { margin-top: 20px; width: 100%; }' + 
                           '.signature-block { text-align: center; padding: 0 40px; }' +
                           '.signature-line { border-top: 1.5px solid #334155; padding-top: 6px; font-weight: 600; color: #334155; font-size: 11pt; }' + '.signature-line { border-top: 1.5px solid #334155; padding-top: 6px; font-weight: 600; color: #334155; font-size: 11pt; }' +
                          '</style>';

        var fullHTML = '<html><head><meta charset="UTF-8">' + styleExtra + '</head><body>' + reportHTML + '</body></html>';

        var tempFolder = shell.ExpandEnvironmentStrings('%TEMP%');
        tmpPath = fso.BuildPath(tempFolder, 'logistica_tmp_' + new Date().getTime() + '.html');
        
        var stream = new ActiveXObject('ADODB.Stream');
        stream.Type = 2; stream.Charset = 'utf-8'; stream.Open();
        stream.WriteText(fullHTML);
        stream.SaveToFile(tmpPath, 2); stream.Close();

        var browserPath = OttieniPercorsoBrowser();

        if(browserPath !== '') {
            step = 'Generazione PDF (Motore Browser)';
            var cmd = '"' + browserPath + '" --headless --disable-gpu --print-to-pdf="' + pdfPath + '" "' + tmpPath + '"';
            shell.Run(cmd, 0, true);
            
            if(fso.FileExists(pdfPath)) {
                if(btn) { btn.innerText = oldTxt; btn.disabled = false; }
                if(!silente) {
                    alert('Il tuo Report PDF \xE8 stato generato e salvato correttamente!\n\n\uD83D\uDCC4 File: ' + fileName + '\n\uD83D\uDCC1 Cartella: ' + exportPath);
                    ApriDocumentoConAppDedicata(pdfPath);
                }
                try { fso.DeleteFile(tmpPath); } catch(e) {}
                return pdfPath;
            }
        }

        step = 'Generazione PDF (Motore Word)';
        var wordApp = null, doc = null;
        try {
            try { wordApp = new ActiveXObject('Word.Application'); } catch(e) { wordApp = new ActiveXObject('Word.Application.16'); }
            wordApp.Visible = false;
            wordApp.DisplayAlerts = 0;
            doc = wordApp.Documents.Open(tmpPath);
            doc.PageSetup.Orientation = 1;
            doc.SaveAs2(pdfPath, 17);
            doc.Close(false);
            wordApp.Quit();
            
            if(btn) { btn.innerText = oldTxt; btn.disabled = false; }
            if(!silente) {
                alert('Il tuo Report PDF \xE8 stato generato e salvato correttamente tramite Word!\n\n\uD83D\uDCC4 File: ' + fileName + '\n\uD83D\uDCC1 Cartella: ' + exportPath);
                ApriDocumentoConAppDedicata(pdfPath);
            }
            try { fso.DeleteFile(tmpPath); } catch(e) {}
            return pdfPath;
        } catch(errWord) {
            try { if(doc) doc.Close(false); } catch(e3) {}
            try { if(wordApp) wordApp.Quit(); } catch(e4) {}
            throw errWord;
        }

    } catch(err) {
        if(btn) { btn.innerText = 'ERRORE'; btn.disabled = false; }
        var msg = 'Errore critico generazione PDF:\n' + err.message;
        msg += '\n\nFase: ' + step;
        if(tmpPath !== '') msg += '\nTemp: ' + tmpPath;
        alert(msg);
        return null;
    }
}

    var btn = document.querySelector(".btn-print-confirm");
function InviaReportSegreteria() {
    // 1. Genera il PDF silente prima di tutto
    var currentPdf = EsportaPDFProfessionale(true);
    if(!currentPdf) return; // Errore o annullato

    var m = document.getElementById("cmbMese").value;
    var a = document.getElementById("cmbAnni").value;
    
    // Tenta Outlook via ActiveX con ALLEGATO REALE
    try {
        var outlookApp = new ActiveXObject("Outlook.Application");
        var mail = outlookApp.CreateItem(0);
        mail.Subject = "Registro Consegne Mensile - " + m + " " + a;
        mail.To = "segreteria@coopnicolodi.it";
        mail.Body = "Gentile Segreteria,\n\nin allegato invio il registro mensile delle consegne relativo a " + m + " " + a + ".\n\nCordiali saluti.";
        
        // Allegato
        mail.Attachments.Add(currentPdf);
        
        mail.Display();
        alert("Email generata con successo! Il PDF è stato ALLEGATO automaticamente.");
    } catch(e) {
        // Fallback mailto (non può allegare)
        var subject = encodeURIComponent("Registro Consegne Mensile - " + m + " " + a);
        var body = encodeURIComponent("Gentile Segreteria,\nin allegato invio il report mensile.\n\n[ATTENZIONE: Allega manualmente il file da: " + currentPdf + "]");
        window.location.href = "mailto:segreteria@coopnicolodi.it?subject=" + subject + "&body=" + body;
        
        // Apri cartella per aiutare il drag-drop
        if(exportPath !== "") {
            var shell = new ActiveXObject("WScript.Shell");
            shell.Run('explorer.exe "' + exportPath + '"');
        }
        alert("Impossibile allegare automaticamente (Outlook non trovato). Allega manualmente il file dalla cartella che si è aperta.");
    }
}

function ApriDocumentoConAppDedicata(path) {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        
        // Se e' un PDF, forza l'apertura con Edge in modalita' "App" (senza barra indirizzi)
        // Questo nasconde il fastidioso percorso file:///
        if (path.toLowerCase().indexOf(".pdf") > -1) {
            var edgePath = "";
            var possibleEdgePaths = [
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
            ];
            for (var i = 0; i < possibleEdgePaths.length; i++) {
                if (fso.FileExists(possibleEdgePaths[i])) {
                    edgePath = possibleEdgePaths[i];
                    break;
                }
            }
            if (edgePath !== "") {
                var uriPath = path.replace(/\\/g, "/");
                try {
                    shell.Run('"' + edgePath + '" --app="file:///' + uriPath + '"', 1, false);
                    return;
                } catch(eApp) { }
            }
        }
    } catch(e) { }

    try {
        // Tentativo con Shell.Application (più "nativo" per le app desktop)
        var shellApp = new ActiveXObject("Shell.Application");
        shellApp.ShellExecute(path, "", "", "open", 1);
    } catch(e) {
        // Fallback al metodo standard se il precedente fallisce
        try {
            var shell = new ActiveXObject("WScript.Shell");
            shell.Run('"' + path + '"');
        } catch(e2) {
            alert("Impossibile aprire il file automaticamente. Puoi trovarlo qui:\n" + path);
        }
    }
}

function InviaDettaglioEmail() {
    var nome = document.getElementById("txtNome").value;
    var data = document.getElementById("txtDataConsegna").value;
    var ordine = document.getElementById("txtOrdine").value;
    
    if(!nome) { alert("Seleziona prima una consegna!"); return; }
    
    var subject = encodeURIComponent("Dettaglio Consegna: " + nome + " (" + data + ")");
    var body = encodeURIComponent("Buongiorno,\n\nsi trasmette il dettaglio per la consegna di " + nome + " prevista per il " + data + ".\nOrdine Nr: " + ordine + "\n\nNote: " + document.getElementById("txtNote").value);
    
    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
}

// =========================================================================
// GESTIONE SELETTORE ORARIO (TIME PICKER MODALE V3.0)
// =========================================================================
var tpSelectedHour = "";
var tpSelectedMinute = "";

function ApriTimePicker() {
    var raw = document.getElementById("cmbOra").value || "";
    if (raw.indexOf(":") !== -1) {
        var p = raw.split(":");
        tpSelectedHour = p[0];
        tpSelectedMinute = p[1];
    } else {
        tpSelectedHour = "";
        tpSelectedMinute = "";
    }
    
    document.getElementById("tp-backdrop").style.display = "flex";
    RenderTimePicker();
    
    // Auto-scroll al valore selezionato se esiste (sia Ore che Minuti)
    setTimeout(function() {
        var selH = document.querySelector("#tp-hour-grid .tp-item.selected");
        if(selH) {
            try {
                selH.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch(eScroll) {
                try { selH.scrollIntoView(true); } catch(errFall) {}
            }
        }
        var selM = document.querySelector("#tp-minute-grid .tp-item.selected");
        if(selM) {
            try {
                selM.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch(eScroll) {
                try { selM.scrollIntoView(true); } catch(errFall) {}
            }
        }
    }, 150);
}

function ChiudiTimePicker() {
    document.getElementById("tp-backdrop").style.display = "none";
}

function RenderTimePicker() {
    var hGrid = document.getElementById("tp-hour-grid");
    var mGrid = document.getElementById("tp-minute-grid");
    if(!hGrid || !mGrid) return;
    
    hGrid.innerHTML = "";
    mGrid.innerHTML = "";
    
    // 1. ORE (Range completo 07:00 - 20:00 per massima copertura logistica)
    for (var h = 7; h <= 20; h++) {
        var hStr = (h < 10 ? "0" + h : h).toString();
        var div = document.createElement("div");
        div.className = "tp-item" + (tpSelectedHour === hStr ? " selected" : "");
        div.innerText = hStr;
        div.onclick = (function(val) { 
            return function() { 
                tpSelectedHour = val; 
                RenderTimePicker(); 
            }; 
        })(hStr);
        hGrid.appendChild(div);
    }
    
    // 2. MINUTI (Precisione a 5 minuti)
    var minutes = ["00","05","10","15","20","25","30","35","40","45","50","55"];
    for (var i = 0; i < minutes.length; i++) {
        var mStr = minutes[i];
        var divM = document.createElement("div");
        divM.className = "tp-item" + (tpSelectedMinute === mStr ? " selected" : "");
        divM.innerText = mStr;
        divM.onclick = (function(val) { 
            return function() { SelezionaOrarioFinale(val); }; 
        })(mStr);
        mGrid.appendChild(divM);
    }
}

function SelezionaOrarioFinale(m) {
    if (tpSelectedHour === "") {
        alert("Per favore, seleziona prima l'ORA.");
        return;
    }
    tpSelectedMinute = m;
    RenderTimePicker();
    
    var timeString = tpSelectedHour + ":" + tpSelectedMinute;
    var input = document.getElementById("cmbOra");
    input.value = timeString;
    
    // Feedback visuale e chiusura
    if (typeof Highlight === "function") Highlight(input);
    setTimeout(ChiudiTimePicker, 250);
    
    // Attiva autopilota numerico per aggiornare l'ordine in base alla nuova ora
    try { AutoPopolaOrdine(); } catch(e){}
}

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

window.NavigaModulo = function(modulo) {
    if (!CheckUnsavedChanges()) return; // Intercetta in navigazione moduli
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
        var htaPath = fso.BuildPath(currentDir, modulo);
        
        document.title = "CHIUSURA_IN_CORSO";
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
        
        AtomicClose();
    } catch(e) { }
};

/* --- CLASSIC MENU BAR LOGIC --- */
function toggleMenu(el, event) {
    if (event) {
        event.cancelBubble = true;
        if (event.stopPropagation) event.stopPropagation();
    }
    
    var wasOpen = el.className.indexOf('is-open') > -1;
    
    // Chiudi tutti gli altri
    var items = document.querySelectorAll('.menu-item');
    for (var i = 0; i < items.length; i++) {
        items[i].className = 'menu-item';
    }
    
    // Toggle corrente
    if (!wasOpen) {
        el.className = 'menu-item is-open';
    }
}

// Chiusura automatica al click esterno
window.attachEvent ? window.attachEvent('onclick', closeAllMenus) : window.addEventListener('click', closeAllMenus);

function closeAllMenus() {
    var items = document.querySelectorAll('.menu-item');
    for (var i = 0; i < items.length; i++) {
        items[i].className = 'menu-item';
    }
}

function copyToClipboard(text) {
    if (!text) return;
    try {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE/HTA Native
            window.clipboardData.setData("Text", text);
        } else {
            // Fallback Moderno (se disponibile in IE=edge)
            var textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
        alert("Testo copiato negli appunti: " + text);
    } catch (err) {
        alert("Impossibile copiare negli appunti.");
    }
}

/* --- GESTIONE DINAMICA STATI OPERATIVI (FLEXIBLE VERSION) --- */
function CaricaStatiOperativi() {
    try {
        var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "stati_operativi.txt");
        var stati = ["DA CHIAMARE", "CONFERMATO", "SOSPESO", "URGENTE"]; // Default
        
        if (fso.FileExists(pConfig)) {
            var f = fso.OpenTextFile(pConfig, 1);
            if (!f.AtEndOfStream) {
                var content = f.ReadAll();
                f.Close();
                if (content && content.trim() !== "") {
                    stati = content.split(/\r?\n/).map(function(s) { return s.trim(); }).filter(function(s) { return s !== ""; });
                }
            } else {
                f.Close();
            }
        }
        
        // Popola DATALIST per autocompletamento
        var lst = document.getElementById("listStati");
        if (lst) {
            lst.innerHTML = '';
            for (var i = 0; i < stati.length; i++) {
                var opt = document.createElement("option");
                opt.value = stati[i];
                lst.appendChild(opt);
            }
        }
        
        var btnBar = document.getElementById("stato-buttons-bar");
        if (btnBar) {
            btnBar.innerHTML = '';
            for (var i = 0; i < stati.length; i++) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "label-btn";
                btn.innerText = stati[i];
                btn.onclick = (function(val) {
                    return function() {
                        var inp = document.getElementById("cmbStato");
                        inp.value = val;
                        Highlight(inp);
                    };
                })(stati[i]);
                btnBar.appendChild(btn);
            }
        }
    } catch(e) { }
}

function ActionVerificaNuovoStato(val) {
    if (!val || val.trim() === "") return;
    val = val.trim().toUpperCase();
    
    var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "stati_operativi.txt");
    var statiAttuali = RecuperaStatiArray(pConfig);
    
    // Controlla se esiste già (case-insensitive)
    var esiste = false;
    for(var i=0; i<statiAttuali.length; i++) {
        if(statiAttuali[i].toUpperCase() === val) { esiste = true; break; }
    }
    
    if (!esiste) {
        if (confirm("Lo stato '" + val + "' non è presente nell'elenco dei suggerimenti.\n\nVuoi aggiungerlo permanentemente?")) {
            statiAttuali.push(val);
            SalvaStatiArray(pConfig, statiAttuali);
            alert("Stato '" + val + "' aggiunto con successo!");
        }
    }
}

function ActionEliminaStatoDblClick(val) {
    if (!val || val.trim() === "") return;
    val = val.trim().toUpperCase();
    
    var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "stati_operativi.txt");
    var statiAttuali = RecuperaStatiArray(pConfig);
    
    var trovatoIdx = -1;
    for(var i=0; i<statiAttuali.length; i++) {
        if(statiAttuali[i].toUpperCase() === val) { trovatoIdx = i; break; }
    }
    
    if (trovatoIdx > -1) {
        if (confirm("Vuoi eliminare definitivamente lo stato '" + statiAttuali[trovatoIdx] + "' dall'elenco dei suggerimenti?")) {
            statiAttuali.splice(trovatoIdx, 1);
            SalvaStatiArray(pConfig, statiAttuali);
            document.getElementById("cmbStato").value = "";
            alert("Stato rimosso con successo.");
        }
    }
}

function InizializzaEntiRapidi() {
    try {
        var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "enti_riferimento.txt");
        var enti = ["A.S.L.", "Pro.V.I."]; // Default
        
        if (fso.FileExists(pConfig)) {
            var f = fso.OpenTextFile(pConfig, 1);
            if (!f.AtEndOfStream) {
                var content = f.ReadAll();
                f.Close();
                if (content && content.trim() !== "") {
                    enti = content.split(/\r?\n/).map(function(s) { return s.trim(); }).filter(function(s) { return s !== ""; });
                }
            } else {
                f.Close();
            }
        } else {
            var f2 = fso.CreateTextFile(pConfig, true);
            f2.Write(enti.join("\r\n"));
            f2.Close();
        }
        
        var lst = document.getElementById("listEnti");
        if (lst) {
            lst.innerHTML = '';
            for (var i = 0; i < enti.length; i++) {
                var opt = document.createElement("option");
                opt.value = enti[i];
                lst.appendChild(opt);
            }
        }
        
        var btnBar = document.getElementById("ente-buttons-bar");
        if (btnBar) {
            btnBar.innerHTML = '';
            for (var i = 0; i < enti.length; i++) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "label-btn";
                btn.innerText = enti[i];
                btn.onclick = (function(val) {
                    return function() {
                        var inp = document.getElementById("cmbEnte");
                        inp.value = val;
                        Highlight(inp);
                    };
                })(enti[i]);
                btnBar.appendChild(btn);
            }
        }
    } catch(e) { }
}

function ActionVerificaNuovoEnte(val) {
    if (!val || val.trim() === "") return;
    val = val.trim().toUpperCase();
    
    var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "enti_riferimento.txt");
    var entiAttuali = RecuperaEntiArray(pConfig);
    
    var esiste = false;
    for(var i=0; i<entiAttuali.length; i++) {
        if(entiAttuali[i].toUpperCase() === val) { esiste = true; break; }
    }
    
    if (!esiste) {
        if (confirm("L'Ente '" + val + "' non è presente nell'elenco dei suggerimenti.\n\nVuoi aggiungerlo permanentemente?")) {
            entiAttuali.push(val);
            SalvaEntiArray(pConfig, entiAttuali);
            alert("Ente '" + val + "' aggiunto con successo!");
        }
    }
}

function ActionEliminaEnteDblClick(val) {
    if (!val || val.trim() === "") return;
    val = val.trim().toUpperCase();
    
    var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "enti_riferimento.txt");
    var entiAttuali = RecuperaEntiArray(pConfig);
    
    var trovatoIdx = -1;
    for(var i=0; i<entiAttuali.length; i++) {
        if(entiAttuali[i].toUpperCase() === val) { trovatoIdx = i; break; }
    }
    
    if (trovatoIdx > -1) {
        if (confirm("Vuoi eliminare definitivamente l'Ente '" + entiAttuali[trovatoIdx] + "' dall'elenco dei suggerimenti?")) {
            entiAttuali.splice(trovatoIdx, 1);
            SalvaEntiArray(pConfig, entiAttuali);
            document.getElementById("cmbEnte").value = "";
            alert("Ente rimosso con successo.");
        }
    }
}

function ActionGestisciEnti() {
    try {
        var pConfig = fso.BuildPath(fso.BuildPath(currentDir, "system"), "enti_riferimento.txt");
        var choice = prompt("GESTIONE ENTI RIFERIMENTO\n\n1. AGGIUNGI nuovo ente\n2. ELIMINA ente esistente\n\nInserisci 1 o 2 (o premi Annulla):", "1");
        
        if (choice === null) return;
        
        if (choice === "1") {
            var nuovo = prompt("Inserisci il nome del NUOVO ente di riferimento:", "");
            if (nuovo && nuovo.trim() !== "") {
                var entiAttuali = RecuperaEntiArray(pConfig);
                entiAttuali.push(nuovo.trim().toUpperCase());
                SalvaEntiArray(pConfig, entiAttuali);
                alert("Ente aggiunto con successo!");
            }
        } else if (choice === "2") {
            var entiAttuali = RecuperaEntiArray(pConfig);
            if (entiAttuali.length === 0) {
                alert("Nessun ente da eliminare.");
                return;
            }
            
            var list = "";
            for (var i = 0; i < entiAttuali.length; i++) {
                list += (i + 1) + ". " + entiAttuali[i] + "\n";
            }
            
            var scel = prompt("Scegli il NUMERO dell'ente da ELIMINARE:\n\n" + list, "");
            if (scel === null) return;
            
            var idx = parseInt(scel, 10);
            if (!isNaN(idx) && idx >= 1 && idx <= entiAttuali.length) {
                if (confirm("Sei sicuro di voler eliminare l'ente '" + entiAttuali[idx-1] + "'?")) {
                    entiAttuali.splice(idx-1, 1);
                    SalvaEntiArray(pConfig, entiAttuali);
                    alert("Ente eliminato.");
                }
            } else {
                alert("Selezione non valida.");
            }
        }
    } catch(err) {
        alert("Errore GESTIONE: " + err.message);
    }
}

function RecuperaEntiArray(p) {
    var arr = ["A.S.L.", "Pro.V.I."];
    try {
        if (fso.FileExists(p)) {
            var f = fso.OpenTextFile(p, 1);
            if (!f.AtEndOfStream) {
                var c = f.ReadAll(); 
                arr = c.split(/\r?\n/).map(function(s){return s.trim();}).filter(function(s){return s!=="";});
            }
            f.Close();
        }
    } catch(e) {}
    return arr;
}

function SalvaEntiArray(p, arr) {
    try {
        var f = fso.CreateTextFile(p, true);
        f.Write(arr.join("\r\n"));
        f.Close();
        CaricaEnti();
    } catch(e) { alert("Errore salvataggio file: " + e.message); }
}


// ==========================================
// MONITOR NOTIFICHE DA MOBILE APP
// ==========================================
var lastNotifSize = -1;
var notifFilePath = "";

function InitNotificheMobile() {
    try {
        notifFilePath = fso.BuildPath(currentDir, "App_Mobile\\server\\NOTIFICHE_UFFICIO.txt");
        if (fso.FileExists(notifFilePath)) {
            lastNotifSize = fso.GetFile(notifFilePath).Size;
        } else {
            // Se il file non esiste ancora, lo creiamo vuoto
            fso.CreateTextFile(notifFilePath, true).Close();
            lastNotifSize = 0;
        }
        
        setInterval(CheckNewNotifications, 5000);
    } catch(e) { }
}

function CheckNewNotifications() {
    try {
        if (!fso.FileExists(notifFilePath)) return;
        
        var currentSize = fso.GetFile(notifFilePath).Size;
        if (currentSize > lastNotifSize && lastNotifSize !== -1) {
            // C'e' qualcosa di nuovo!
            var f = fso.OpenTextFile(notifFilePath, 1);
            var content = "";
            while (!f.AtEndOfStream) {
                content = f.ReadLine(); // Leggiamo fino all'ultima riga
            }
            f.Close();
            
            if (content.trim() !== "") {
                // Filtro: Avvisiamo l'ufficio SOLO se la notifica arriva dal Driver/App Mobile
                // Se la notifica e' un log di sistema interno o un'azione fatta dal PC, la ignoriamo.
                var isFromMobile = (content.indexOf("CONSEGNA COMPLETATA") > -1 || 
                                    content.indexOf("NOTIZIE DA STRADA") > -1 || 
                                    content.indexOf("Caricata foto") > -1);

                if (isFromMobile) {
                    PlayNotificationSound();
                    var shell = new ActiveXObject("WScript.Shell");
                    var msg = "🔔 NUOVA NOTIFICA DA APP MOBILE:\n\n" + content + "\n\n(Dati aggiornati nel database)";
                    shell.Popup(msg, 0, "AGENDA - NOTIFICA MOBILE", 64);
                    
                    // Ricarica la griglia per mostrare i dati nuovi
                    if (typeof CercaConsegne === "function") CercaConsegne();
                }
            }
        }
        lastNotifSize = currentSize;
    } catch(e) { }
}

function PlayNotificationSound() {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        // Esegue un beep di sistema informativo (Asterisk)
        shell.Run("powershell -c [System.Media.SystemSounds]::Asterisk.Play()", 0, false);
    } catch(e) {}
}

// ==========================================
// FUNZIONI GESTIONE LOCALITA (DINAMICHE)
// ==========================================
function PopolaListaLocalita(prov) {
    var queryProv = prov;
    if(queryProv === "B.A.T.") queryProv = "BAT";
    var loc = queryAccessDB("SELECT Comune FROM tblLocalita WHERE Provincia='" + sqlEscape(queryProv) + "' ORDER BY Comune");
    var dLoc = document.getElementById("listLocalita");
    if(!dLoc) return;
    dLoc.innerHTML = '';
    loc.forEach(function(r) {
        var o = document.createElement("option"); o.value=r.Comune; dLoc.appendChild(o);
    });
    
    var btnBar = document.getElementById("localita-buttons-bar");
    if (btnBar) {
        btnBar.innerHTML = '';
        var limit = Math.min(loc.length, 6);
        for (var i = 0; i < limit; i++) {
            var val = loc[i].Comune;
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "label-btn";
            btn.innerText = val;
            btn.onclick = (function(v) {
                return function() {
                    var inp = document.getElementById("cmbLocalita");
                    inp.value = v;
                    Highlight(inp);
                    if (typeof inp.onchange === "function") inp.onchange();
                };
            })(val);
            btnBar.appendChild(btn);
        }
    }
}

function ActionGestisciLocalita() {
    try {
        var prov = document.getElementById("cmbProvincia").value;
        if (!prov) {
            alert("Seleziona prima una Provincia per poter gestire i Comuni.");
            return;
        }
        var choice = prompt("GESTIONE COMUNI (" + prov + ")\n\n1. AGGIUNGI nuovo comune\n2. ELIMINA comune esistente\n\nInserisci 1 o 2 (o premi Annulla):", "1");
        if (choice === null) return;
        
        if (choice === "1") {
            var nuovo = prompt("Inserisci il nome del NUOVO comune per la provincia di " + prov + ":", "");
            if (nuovo && nuovo.trim() !== "") {
                addLocalita(nuovo.trim().toUpperCase(), prov);
            }
        } else if (choice === "2") {
            var queryProv = prov;
            if(queryProv === "B.A.T.") queryProv = "BAT";
            var loc = queryAccessDB("SELECT Comune FROM tblLocalita WHERE Provincia='" + sqlEscape(queryProv) + "' ORDER BY Comune");
            if (loc.length === 0) {
                alert("Nessun comune in elenco per questa provincia.");
                return;
            }
            var list = "";
            for (var i = 0; i < loc.length; i++) {
                list += (i + 1) + ". " + loc[i].Comune + "\n";
            }
            var scel = prompt("Scegli il NUMERO del comune da ELIMINARE:\n\n" + list, "");
            if (scel === null) return;
            var idx = parseInt(scel, 10);
            if (!isNaN(idx) && idx >= 1 && idx <= loc.length) {
                if (confirm("Sei sicuro di voler eliminare '" + loc[idx-1].Comune + "'?")) {
                    removeLocalita(loc[idx-1].Comune, prov);
                }
            } else {
                alert("Selezione non valida.");
            }
        }
    } catch(err) {
        alert("Errore GESTIONE: " + err.message);
    }
}

function addLocalita(comune, prov) {
    if(!comune || !prov) return;
    var sql = "INSERT INTO tblLocalita (Comune, Provincia) VALUES ('" + sqlEscape(comune) + "', '" + sqlEscape(prov) + "')";
    if (executeAccessDBCrud(sql)) {
        PopolaListaLocalita(prov);
        var shell = new ActiveXObject("WScript.Shell");
        shell.Popup("Comune '" + comune + "' aggiunto correttamente al database.", 2, "Sistema Logistica", 64);
    }
}

function removeLocalita(comune, prov) {
    if(!comune) return;
    var sql = "DELETE FROM tblLocalita WHERE Comune='" + sqlEscape(comune) + "'";
    if (prov) sql += " AND Provincia='" + sqlEscape(prov) + "'";
    
    if (executeAccessDBCrud(sql)) {
        PopolaListaLocalita(prov);
        document.getElementById("cmbLocalita").value = "";
        var shell = new ActiveXObject("WScript.Shell");
        shell.Popup("Comune rimosso dall'elenco.", 2, "Sistema Logistica", 64);
    }
}

// Inizializzazione Multi-Contatto e Note
InitPhoneHandlers();
InitInvalidityHandlers();

// ==========================================
// SMART ROUTING (NOMINATIM + OSRM)
// ==========================================
function ActionOttimizzaPercorso() {
    var container = document.getElementById("cardListContainer");
    var cards = container.getElementsByClassName("delivery-gold-card");
    if (!cards || cards.length < 1) {
        alert("Nessuna consegna visibile per calcolare il percorso.");
        return;
    }

    // --- NUOVA LOGICA: RACCOLTA E FILTRAGGIO PREVENTIVO PER DATA ---
    var today = new Date();
    today.setHours(0,0,0,0);
    var listDates = [];
    var mapDateCount = {};
    
    // Prima scansione per raccogliere le date uniche valide (non passate)
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var dateBadge = null;
        var bArr = card.getElementsByClassName("delivery-date-badge");
        if (bArr.length > 0) dateBadge = bArr[0].innerText.trim();
        
        if (dateBadge) {
            var parts = dateBadge.split("/");
            if (parts.length === 3) {
                var d = new Date(parts[2], parts[1]-1, parts[0]);
                if (d >= today) {
                    if (!mapDateCount[dateBadge]) {
                        mapDateCount[dateBadge] = 0;
                        listDates.push(dateBadge);
                    }
                    mapDateCount[dateBadge]++;
                }
            }
        }
    }
    
    if (listDates.length > 1) {
        // Ordiniamo le date in modo cronologico
        listDates.sort(function(a, b) {
            var pa = a.split("/"); var pb = b.split("/");
            var da = new Date(pa[2], pa[1]-1, pa[0]);
            var db = new Date(pb[2], pb[1]-1, pb[0]);
            return da - db;
        });
        
        // Apertura del modal moderno in HTML
        ApriModalSceltaData(listDates, mapDateCount);
    } else {
        var singleDate = (listDates.length === 1) ? listDates[0] : null;
        EseguiSmartRouting(singleDate);
    }
}

function ApriModalSceltaData(listDates, mapDateCount) {
    var container = document.getElementById("dateRoutingContainer");
    if (!container) return;
    container.innerHTML = "";
    
    for (var i = 0; i < listDates.length; i++) {
        var dt = listDates[i];
        var count = mapDateCount[dt];
        
        var card = document.createElement("div");
        card.style.cssText = "border: 1.5px solid #334155; border-radius: 12px; padding: 14px; cursor: pointer; background: #0f172a; display:flex; justify-content:space-between; align-items:center; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin-bottom: 8px; color:#cbd5e1;";
        
        card.innerHTML = "<div>📅 Data: <span style='color:#0ea5e9; font-weight:900; font-size:13px;'>" + dt + "</span></div>" +
                         "<div style='background:rgba(234, 179, 8, 0.15); color:#eab308; border:1px solid rgba(234,179,8,0.3); border-radius:20px; padding:4px 12px; font-size:9px; font-weight:900;'>" + count + " CONSEGNE</div>";
        
        (function(selDt) {
            card.onclick = function() {
                ChiudiDateRoutingModal();
                setTimeout(function() {
                    EseguiSmartRouting(selDt);
                }, 150);
            };
        })(dt);
        
        card.onmouseover = function() {
            this.style.transform = "translateY(-2px)";
            this.style.boxShadow = "0 8px 20px rgba(0,0,0,0.4)";
            this.style.borderColor = "#0ea5e9";
            this.style.background = "#1e293b";
        };
        card.onmouseout = function() {
            this.style.transform = "translateY(0)";
            this.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
            this.style.borderColor = "#334155";
            this.style.background = "#0f172a";
        };
        
        container.appendChild(card);
    }
    
    var overlay = document.getElementById("dateRoutingModalOverlay");
    if (overlay) overlay.style.display = "flex";
}

function ChiudiDateRoutingModal() {
    var overlay = document.getElementById("dateRoutingModalOverlay");
    if (overlay) overlay.style.display = "none";
}

function EseguiSmartRouting(selectedDate) {
    var container = document.getElementById("cardListContainer");
    var cards = container.getElementsByClassName("delivery-gold-card");
    
    var today = new Date();
    today.setHours(0,0,0,0);
    
    var overlay = document.getElementById("routingOverlay");
    if (overlay) overlay.style.display = "flex";
    
    var deliveries = [];
    
    // 1. Partenza fissa da magazzino
    deliveries.push({
        cardElement: null,
        clientName: "PARTENZA",
        addressQuery: "Via Monte Grappa 128, Bari",
        lat: null,
        lon: null,
        isPartenza: true
    });

    var skippedCount = 0;

    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        
        // Pulizia stili precedenti
        card.style.border = "";
        var oldBadge = card.querySelector(".tappa-badge");
        if(oldBadge) oldBadge.parentNode.removeChild(oldBadge);
        
        // 2. Filtro Date antecedenti a oggi e Filtro Data Selezionata
        var dateBadge = null;
        var bArr = card.getElementsByClassName("delivery-date-badge");
        if(bArr.length > 0) dateBadge = bArr[0].innerText.trim();
        
        if (dateBadge) {
            var parts = dateBadge.split("/");
            if (parts.length === 3) {
                var d = new Date(parts[2], parts[1]-1, parts[0]);
                if (d < today) {
                    card.style.display = "none";
                    skippedCount++;
                    continue;
                } else {
                    if (selectedDate && dateBadge !== selectedDate) {
                        card.style.display = "none"; 
                        continue;
                    }
                    card.style.display = "";
                }
            }
        }

        var addrMain = null;
        var addrSub = null;
        
        var mArr = card.getElementsByClassName("address-main");
        var sArr = card.getElementsByClassName("address-sub");
        if(mArr.length > 0) addrMain = mArr[0];
        if(sArr.length > 0) addrSub = sArr[0];
        
        var nArr = card.getElementsByClassName("client-name");
        var nameVal = nArr.length > 0 ? nArr[0].innerText.trim() : "Consegna";
        
        var cArr = card.getElementsByClassName("contact-box");
        var contactVal = cArr.length > 0 ? cArr[0].innerText.trim() : "";

        var q = "";
        if (addrMain) {
            var mainT = addrMain.innerText.trim();
            mainT = mainT.replace(/n\.?\s*n\/n/ig, "");
            mainT = mainT.replace(/INT\.?\s*\d+/ig, "");
            q += mainT + " ";
        }
        var cleanSub = "";
        if (addrSub) {
            var subText = addrSub.innerText.trim();
            cleanSub = subText.replace(/\([^)]*\)/g, "").replace(/,/g, " ").trim();
            q += cleanSub;
        }

        deliveries.push({
            cardElement: card,
            clientName: nameVal,
            addressQuery: q.trim(),
            fallbackQuery: cleanSub,
            contactPhone: contactVal,
            isApproximate: false,
            lat: null,
            lon: null,
            isPartenza: false
        });
    }

    if (deliveries.length < 2) {
        if (overlay) overlay.style.display = "none";
        alert("Non ci sono consegne da ottimizzare.");
        return;
    }

    GeocodeDeliveries(deliveries, 0, function(success) {
        if (!success) {
            if (overlay) overlay.style.display = "none";
            alert("Errore durante la conversione degli indirizzi. Verifica la connessione.");
            return;
        }
        OptimizeRouteOSRM(deliveries);
    });
}

function GeocodeDeliveries(deliveries, index, callback) {
    if (index >= deliveries.length) {
        callback(true);
        return;
    }

    var currentItem = deliveries[index];
    var el = document.getElementById("lblRoutingDetails");
    if (el) el.innerText = "Geolocalizzazione " + (index + 1) + " di " + deliveries.length + "...";

    // TENTATIVO 1: Indirizzo Completo
    var mainAddress = currentItem.addressQuery;
    var url1 = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(mainAddress + ", Italia");

    ExecuteSafeGet(url1, function(res1) {
        if (res1 && res1.length > 0) {
            // Successo al primo colpo!
            currentItem.lat = res1[0].lat;
            currentItem.lon = res1[0].lon;
            
            setTimeout(function() { GeocodeDeliveries(deliveries, index + 1, callback); }, 1000);
        } else {
            // FALLIMENTO TENTATIVO 1: Proviamo il Fallback se disponibile
            var fallAddress = currentItem.fallbackQuery;
            if (fallAddress && fallAddress.trim() !== "") {
                var url2 = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(fallAddress.trim() + ", Italia");
                
                // Attendi 1 secondo per policy rate-limit prima del secondo tentativo
                setTimeout(function() {
                    ExecuteSafeGet(url2, function(res2) {
                        if (res2 && res2.length > 0) {
                            // Successo con approssimazione Centro Città!
                            currentItem.lat = res2[0].lat;
                            currentItem.lon = res2[0].lon;
                            currentItem.isApproximate = true; 
                        }
                        // Prossimo elemento
                        setTimeout(function() { GeocodeDeliveries(deliveries, index + 1, callback); }, 1000);
                    });
                }, 1000);
            } else {
                // Nessun fallback possibile, prosegui
                setTimeout(function() { GeocodeDeliveries(deliveries, index + 1, callback); }, 1000);
            }
        }
    });
}

function ExecuteSafeGet(url, doneCb) {
    var xhr = null;
    try { 
        // Usiamo ServerXMLHTTP per poter impostare un User-Agent dedicato 
        // e bypassare ogni blocco o cache di rete che causava errori silenziosi.
        xhr = new ActiveXObject("MSXML2.ServerXMLHTTP"); 
    } catch(e) { 
        xhr = new ActiveXObject("MSXML2.XMLHTTP"); 
    }
    
    xhr.open("GET", url, true);
    try {
        xhr.setRequestHeader("User-Agent", "SistemaLogisticaMilella/2.0 (contact: admin)");
    } catch(e) {}
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            var result = [];
            if (xhr.status === 200) {
                try { result = JSON.parse(xhr.responseText); } catch(e) {}
            }
            doneCb(result);
        }
    };
    xhr.send();
}


function getDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // Raggio della Terra in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function OptimizeRouteOSRM(deliveries) {
    var overlay = document.getElementById("routingOverlay");
    var el = document.getElementById("lblRoutingDetails");
    if (el) el.innerText = "Calcolo ottimizzazione locale (Nearest Neighbor)...";

    var validDelivs = [];
    var unmappedDelivs = [];
    
    for(var i=0; i<deliveries.length; i++) {
        if(deliveries[i].lat && deliveries[i].lon) {
            validDelivs.push(deliveries[i]);
        } else {
            if (!deliveries[i].isPartenza) {
                unmappedDelivs.push(deliveries[i]);
            }
        }
    }

    var optimized = [];
    
    if (validDelivs.length > 0) {
        var unvisited = validDelivs.slice();
        var current = validDelivs[0];
        
        var startIdx = -1;
        for(var k=0; k<validDelivs.length; k++) {
             if(validDelivs[k].isPartenza) { startIdx = k; break; }
        }
        if (startIdx >= 0) {
             current = validDelivs[startIdx];
             unvisited.splice(startIdx, 1);
        } else {
             current = unvisited[0];
             unvisited.splice(0, 1);
        }
        optimized.push(current);

        while(unvisited.length > 0) {
            var nearestIdx = -1;
            var minDist = Infinity;
            for(var j=0; j<unvisited.length; j++) {
                var candidate = unvisited[j];
                var dist = getDistance(parseFloat(current.lat), parseFloat(current.lon), parseFloat(candidate.lat), parseFloat(candidate.lon));
                if(dist < minDist) {
                    minDist = dist;
                    nearestIdx = j;
                }
            }
            current = unvisited[nearestIdx];
            optimized.push(current);
            unvisited.splice(nearestIdx, 1);
        }
    }

    // Aggiungiamo alla fine quelli non geocodificati da Nominatim (ci penserà Google Maps a trovarli!)
    for(var m=0; m<unmappedDelivs.length; m++) {
        optimized.push(unmappedDelivs[m]);
    }

    if (optimized.length < 2) {
        if (overlay) overlay.style.display = "none";
        alert("Non ci sono abbastanza tappe per creare un percorso.");
        return;
    }

    // Riordino visivo e aggiunta Etichette
    var container = document.getElementById("cardListContainer");
    var tappaCounter = 1;
    for(var z=0; z<optimized.length; z++) {
        var card = optimized[z].cardElement;
        if (card) {
            // Ripuliamo stili precedenti
            card.style.border = "";
            var oldBadges = card.querySelectorAll(".tappa-badge");
            for(var b=0; b<oldBadges.length; b++) oldBadges[b].parentNode.removeChild(oldBadges[b]);

            container.appendChild(card);
            
            var badge = document.createElement("div");
            badge.className = "tappa-badge";
            
            if (optimized[z].lat && optimized[z].lon) {
                if (optimized[z].isApproximate) {
                    badge.style.cssText = "background:#ea580c; color:white; font-size:12px; font-weight:bold; padding:2px 6px; border-radius:4px; margin-top:5px; display:inline-block;";
                    badge.innerText = "📍 Tappa " + tappaCounter + " (Solo Città)";
                } else {
                    badge.style.cssText = "background:#005a9e; color:white; font-size:12px; font-weight:bold; padding:2px 6px; border-radius:4px; margin-top:5px; display:inline-block;";
                    badge.innerText = "📍 Tappa " + tappaCounter;
                }
            } else {
                // Completamente non trovato
                badge.style.cssText = "background:#b91c1c; color:white; font-size:12px; font-weight:bold; padding:2px 6px; border-radius:4px; margin-top:5px; display:inline-block;";
                badge.innerText = "📍 Tappa " + tappaCounter + " (Non trovata)";
            }

            var mArr = card.getElementsByClassName("address-main");
            if(mArr.length > 0) mArr[0].parentNode.appendChild(badge);
            
            tappaCounter++;
        }
    }

    // ================================================
    // INTEGRAZIONE: Esportazione e Lancio MODULO MAPPA
    // ================================================
    
    // Prepariamo un Array leggero serializzabile per il file JSON
    var exportData = [];
    var startNode = null;
    for(var k = 0; k < optimized.length; k++) {
        var nodeData = {
            name: optimized[k].clientName || "",
            address: optimized[k].addressQuery || "",
            contactPhone: optimized[k].contactPhone || "",
            lat: optimized[k].lat ? parseFloat(optimized[k].lat) : null,
            lon: optimized[k].lon ? parseFloat(optimized[k].lon) : null,
            isPartenza: optimized[k].isPartenza || false,
            isApproximate: optimized[k].isApproximate || false,
            isReturn: false
        };
        exportData.push(nodeData);
        if (nodeData.isPartenza) startNode = nodeData;
    }
    
    // AGGIUNTA AUTOMATICA DEL RITORNO IN SEDE
    if (startNode) {
        exportData.push({
            name: "RITORNO IN SEDE",
            address: startNode.address,
            contactPhone: "",
            lat: startNode.lat,
            lon: startNode.lon,
            isPartenza: false,
            isApproximate: false,
            isReturn: true
        });
    }

    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var sysDir = fso.BuildPath(currentDir, "system");
        if(!fso.FolderExists(sysDir)) fso.CreateFolder(sysDir);
        
        var bridgePath = fso.BuildPath(sysDir, "temp_optimized_route.json");
        
        // Serializzatore JSON primitivo sicuro per IE legacy
        var jsonStr = "[";
        for (var j = 0; j < exportData.length; j++) {
            var obj = exportData[j];
            jsonStr += '{"name":"' + (obj.name || "").replace(/"/g,'\\"') + '",';
            jsonStr += '"address":"' + (obj.address || "").replace(/"/g,'\\"') + '",';
            jsonStr += '"contactPhone":"' + (obj.contactPhone || "").replace(/"/g,'\\"') + '",';
            jsonStr += '"lat":' + (obj.lat || "null") + ',';
            jsonStr += '"lon":' + (obj.lon || "null") + ',';
            jsonStr += '"isPartenza":' + obj.isPartenza + ',';
            jsonStr += '"isApproximate":' + obj.isApproximate + ',';
            jsonStr += '"isReturn":' + obj.isReturn + '}';
            if (j < exportData.length - 1) jsonStr += ",";
        }
        jsonStr += "]";
        
        // Scrittura robusta UTF-8 tramite ADODB.Stream per garantire supporto a caratteri accentati ed unicode
        var stream = new ActiveXObject("ADODB.Stream");
        stream.Type = 2; // Testo
        stream.Charset = "utf-8";
        stream.Open();
        stream.WriteText(jsonStr);
        stream.SaveToFile(bridgePath, 2); // 2 = Sovrascrittura
        stream.Close();
        
        // Lancio del modulo integrato (Nuova Finestra HTA)
        var targetApp = fso.BuildPath(currentDir, "mappa_percorso.html");
        
        if (overlay) overlay.style.display = "none";
        
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run('mshta.exe "' + targetApp + '"', 1, false);
        
    } catch(err) {
        if (overlay) overlay.style.display = "none";
        alert("Errore nell'avvio del modulo integrato. Rilevamento tradizionale...\n\n" + err.message);
        
        // Fallback tradizionale in caso di crash imprevisto dei permessi disco
        var mapsUrl = "https://www.google.com/maps/dir/";
        for(var w=0; w<optimized.length; w++) {
            mapsUrl += encodeURIComponent(optimized[w].addressQuery + ", Italia") + "/";
        }
        var shellFall = new ActiveXObject("WScript.Shell");
        shellFall.Run("cmd /c start \"\" \"" + mapsUrl + "\"", 0, false);
    }
}

// ==========================================
// SELETTORE TEMPLATE WHATSAPP INTELLIGENTE
// ==========================================
function ApriWhatsAppModal() {
    var p = document.getElementById("txtTelefono").value.trim();
    if(p === "") {
        var chips = document.getElementById("chipsArea").getElementsByClassName("phone-chip");
        if(chips.length > 0) {
            p = chips[0].getElementsByTagName("span")[0].innerText;
        }
    }
    if(p === "") { alert("Manca il Telefono!"); return; }
    
    var cleanPhone = p.replace(/[^0-9]/g, "");
    if(cleanPhone.substring(0,2) !== "39" && cleanPhone.length === 10) {
        cleanPhone = "39" + cleanPhone;
    }
    
    var cliente = document.getElementById("txtNome").value.trim() || "Cliente";
    var data = document.getElementById("txtDataConsegna").value.trim() || "oggi";
    var ordine = document.getElementById("txtOrdine").value.trim() || "";
    var ordText = ordine !== "" ? (" ordine n. " + ordine) : "";
    
    var merce = document.getElementById("txtMerce") ? document.getElementById("txtMerce").value.trim() : "";
    var merceTextAvviso = merce !== "" ? (" di " + merce) : "";
    var merceTextConferma = merce !== "" ? (" dei suoi ausili (" + merce + ")") : " del suo ausilio";

    window.currentWaData = {
        tel: cleanPhone,
        nome: cliente,
        ora: data,
        localita: document.getElementById("txtLocalita") ? document.getElementById("txtLocalita").value.trim() : "",
        merce: merce
    };

    var templates = [
        {
            titolo: "📅 CONSEGNA PROGRAMMATA",
            sottotitolo: "Invia avviso di consegna futura",
            testo: "Gentile " + cliente + ", la informiamo che la consegna" + ordText + merceTextAvviso + " è prevista per il giorno " + data + "."
        },
        {
            titolo: "✅ CONSEGNA COMPLETATA",
            sottotitolo: "Invia conferma di avvenuta fornitura",
            testo: "Gentile " + cliente + ", la informiamo che la fornitura" + merceTextConferma + " è stata completata in data odierna."
        },
        {
            titolo: "⚠️ RITARDO / IMPREVISTO",
            sottotitolo: "Invia notifica di variazione oraria",
            testo: "Gentile " + cliente + ", la informiamo che la consegna prevista per oggi ha subito un imprevisto operazionale. Sarete contattati a breve."
        },
        {
            titolo: "📝 CREA MESSAGGIO PERSONALIZZATO",
            sottotitolo: "Scrivi un messaggio di testo libero al momento dell'invio",
            testo: "CUSTOM_MSG"
        }
    ];

    var container = document.getElementById("waTemplateContainer");
    if(container) {
        container.innerHTML = "";

        for(var i=0; i<templates.length; i++) {
            var t = templates[i];
            var card = document.createElement("div");
            card.style.cssText = "border: 1.5px solid #334155; border-radius: 12px; padding: 14px; cursor: pointer; background: #0f172a; color:#cbd5e1; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin-bottom: 10px;";
            
            var displayTesto = t.testo;
            if(t.testo === "CUSTOM_MSG") displayTesto = "Clicca qui per digitare un messaggio personalizzato elegante da inviare a " + cliente + ".";

            card.innerHTML = "<div style='font-weight:900; color:#0ea5e9; font-size:12px; margin-bottom:3px;'>" + t.titolo + "</div>" +
                             "<div style='font-size:10px; color:#94a3b8; margin-bottom:6px; font-style:italic;'>" + t.sottotitolo + "</div>" +
                             "<div style='font-size:11px; color:#e2e8f0; line-height:1.4; background:#1e293b; padding:8px; border-radius:6px; border:1.5px solid #334155;'>" + displayTesto + "</div>";
                             
            (function(txt) {
                card.onclick = function() {
                    if(txt === "CUSTOM_MSG") {
                        ChiudiWhatsAppModal();
                        var customModal = document.getElementById("modalWhatsAppCustom");
                        if(customModal) {
                            customModal.style.display = "flex";
                            var customTxt = document.getElementById("txtWaCustomMessage");
                            if(customTxt) { customTxt.value = ""; customTxt.focus(); }
                        }
                        return;
                    }
                    var url = "whatsapp://send?phone=" + cleanPhone + "&text=" + encodeURIComponent(txt);
                    if(typeof ApriLinkEsterno === "function") {
                        ApriLinkEsterno(url);
                    } else {
                        try {
                            var shell = new ActiveXObject("WScript.Shell");
                            shell.Run(url);
                        } catch(e) {
                            window.open(url, "_blank");
                        }
                    }
                    ChiudiWhatsAppModal();
                };
            })(t.testo);
            
            card.onmouseover = function() {
                this.style.transform = "translateY(-2px)";
                this.style.boxShadow = "0 8px 20px rgba(0,0,0,0.4)";
                this.style.borderColor = "#0ea5e9";
                this.style.background = "#1e293b";
            };
            card.onmouseout = function() {
                this.style.transform = "translateY(0)";
                this.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
                this.style.borderColor = "#334155";
                this.style.background = "#0f172a";
            };
            
            container.appendChild(card);
        }
    }

    var ov = document.getElementById("whatsappOverlay");
    if(ov) ov.style.display = "flex";
}

function ChiudiWhatsAppModal() {
    var ov = document.getElementById("whatsappOverlay");
    if(ov) ov.style.display = "none";
}

// ==========================================
// CABINA DI REGIA: APRI E CHIUDI STATS MODAL
// ==========================================
function ApriStatsModal() {
    var arr = arrayConsegneMemory || [];
    var total = arr.length;
    var activeTotal = 0;
    var completed = 0;
    var totalKm = 0;
    var localities = {};

    for(var i=0; i<total; i++) {
        var r = arr[i];
        var ka = parseFloat(r.KmAndata) || 0;
        var kr = parseFloat(r.KmRitorno) || 0;
        var kmTot = ka + kr;
        
        // Se non ci sono chilometri inseriti (kmTot === 0), la consegna è esclusa dalle statistiche
        if (kmTot === 0) continue;

        activeTotal++;
        if(r.Consegnato === true || r.Consegnato === -1 || String(r.Consegnato).toLowerCase() === "true" || String(r.Consegnato) === "-1" || r.Consegnato === 1 || String(r.Consegnato) === "1") {
            completed++;
        }
        totalKm += kmTot;

        var loc = (r.LocalitaConsegna || "").trim().toUpperCase();
        if(loc !== "") {
            localities[loc] = (localities[loc] || 0) + 1;
        }
    }

    var pending = activeTotal - completed;
    var successRate = activeTotal > 0 ? Math.round((completed / activeTotal) * 100) : 0;

    // Ordina le località per numero di consegne
    var locArray = [];
    for (var key in localities) {
        if (localities.hasOwnProperty(key)) {
            locArray.push({ name: key, count: localities[key] });
        }
    }
    locArray.sort(function(a, b) { return b.count - a.count; });
    var topLocs = locArray.slice(0, 3); // Prendi le prime 3

    var cmbM = document.getElementById("cmbMese");
    var meseNome = cmbM ? cmbM.options[cmbM.selectedIndex].text : "Selezionato";
    document.getElementById("lblStatsMese").innerText = "- " + meseNome;

    var container = document.getElementById("statsContainer");
    
    var html = "";
    
    // 1. KPI Cards Row (Grid)
    html += "<div style='display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;'>" +
            "  <div style='background:rgba(14, 165, 233, 0.08); border:1.5px solid rgba(14, 165, 233, 0.2); border-radius:12px; padding:14px; text-align:center;'>" +
            "    <div style='font-size:10px; color:#94a3b8; font-weight:800; text-transform:uppercase;'>Consegne Totali</div>" +
            "    <div style='font-size:1.85rem; font-weight:900; color:#0ea5e9; margin-top:5px;'>" + activeTotal + "</div>" +
            "  </div>" +
            "  <div style='background:rgba(34, 197, 94, 0.08); border:1.5px solid rgba(34, 197, 94, 0.2); border-radius:12px; padding:14px; text-align:center;'>" +
            "    <div style='font-size:10px; color:#94a3b8; font-weight:800; text-transform:uppercase;'>Chilometri Totali</div>" +
            "    <div style='font-size:1.85rem; font-weight:900; color:#22c55e; margin-top:5px;'>" + totalKm.toFixed(1) + " <span style='font-size:0.9rem;'>KM</span></div>" +
            "  </div>" +
            "</div>";

    // 2. Progresso Consegne (Progress Bar)
    html += "<div style='background:#1e293b; border:1.5px solid #334155; border-radius:12px; padding:16px;'>" +
            "  <div style='display:flex; justify-content:space-between; font-size:11px; font-weight:800; margin-bottom:8px; color:#cbd5e1;'>" +
            "    <span>STATO AVANZAMENTO</span>" +
            "    <span style='color:#0ea5e9;'>" + successRate + "% COMPLETATO</span>" +
            "  </div>" +
            "  <div style='width:100%; height:12px; background:#0f172a; border-radius:6px; overflow:hidden; border:1px solid #334155;'>" +
            "    <div style='width:" + successRate + "%; height:100%; background:linear-gradient(90deg, #22c55e, #4ade80); transition: width 0.5s;'></div>" +
            "  </div>" +
            "  <div style='display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-top:10px; font-weight:700;'>" +
            "    <span>✅ " + completed + " Completate</span>" +
            "    <span>⏳ " + pending + " In Corso</span>" +
            "  </div>" +
            "</div>";

    // 3. Località Più Servite
    html += "<div style='background:#1e293b; border:1.5px solid #334155; border-radius:12px; padding:16px; margin-top:12px;'>" +
            "  <div style='font-size:11px; font-weight:800; margin-bottom:12px; color:#cbd5e1; text-transform:uppercase; letter-spacing:0.5px;'>📍 Principali Comuni Serviti</div>";
            
    if(topLocs.length === 0) {
        html += "  <div style='font-size:11px; color:#64748b; text-align:center; padding:12px; font-style:italic;'>Nessun dato disponibile</div>";
    } else {
        for(var k=0; k<topLocs.length; k++) {
            var percent = activeTotal > 0 ? Math.round((topLocs[k].count / activeTotal) * 100) : 0;
            html += "  <div style='margin-bottom:10px;'>" +
                    "    <div style='display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px;'>" +
                    "      <span style='font-weight:700; color:#cbd5e1;'>" + topLocs[k].name + "</span>" +
                    "      <span style='font-weight:800; color:#0ea5e9;'>" + topLocs[k].count + " consegne (" + percent + "%)</span>" +
                    "    </div>" +
                    "    <div style='width:100%; height:7px; background:#0f172a; border-radius:3px; overflow:hidden; border:1px solid #334155;'>" +
                    "      <div style='width:" + percent + "%; height:100%; background:#0ea5e9;'></div>" +
                    "    </div>" +
                    "  </div>";
        }
    }
    html += "</div>";

    container.innerHTML = html;
    document.getElementById("statsOverlay").style.display = "flex";
}

function ChiudiStatsModal() {
    document.getElementById("statsOverlay").style.display = "none";
}

function InviaWhatsApp(tel, nome, ora, localita, merce) {
    if (!tel || tel === "Nessun Recapito" || tel.trim() === "" || tel === "-") {
        alert("Nessun numero di telefono disponibile per questo cliente.");
        return;
    }
    var firstPhone = tel.split(/[,;\/]/)[0].trim();
    var cleanTel = firstPhone.replace(/[^0-9]/g, "");
    if (cleanTel.length === 10 && cleanTel.indexOf("3") === 0) {
        cleanTel = "39" + cleanTel;
    }
    
    currentWaData = {
        tel: cleanTel,
        nome: nome,
        ora: ora,
        localita: localita,
        merce: merce
    };
    
    var modal = document.getElementById("modalWhatsApp");
    if (modal) {
        modal.style.display = "flex";
    } else {
        var msg = "Gentile Cliente " + nome.toUpperCase() + ", la informiamo che la consegna dei suoi articoli C. Milella è in programma per oggi alle ore " + (ora || "--:--") + " in " + localita.toUpperCase() + ". I nostri autisti sono in arrivo! A presto.";
        InviaSfondoWhatsApp(cleanTel, msg);
    }
}

// ============================================================
// FASE 3: GESTIONE "MAPPA AL VOLO" INTEGRATA (IN-APP VIEWER)
// ============================================================
function ApriMappaInApp(indirizzo) {
    try {
        if (!indirizzo) return;
        var query = encodeURIComponent(indirizzo);
        var extUrl = "https://www.google.com/maps/search/?api=1&query=" + query;
        ApriLinkEsterno(extUrl);
    } catch(e) {
        alert("Errore Apertura Mappa: " + e.message);
    }
}

function ChiudiMappaInApp() {
    // Non più necessario
}

function ApriLinkEsterno(url) {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run('"' + url + '"');
    } catch(e) {
        window.open(url, "_blank");
    }
}

// ============================================================
// ESTENSIONI PRODUTTIVITÀ PREMIUM (ZENITH COHERENCE)
// ============================================================

window.ChiamaCliente = function(tel) {
    if (!tel || tel === "Nessun Recapito" || tel.trim() === "" || tel === "-") {
        alert("Nessun numero di telefono disponibile per questo cliente.");
        return;
    }
    // Estrai il primo numero utilizzabile
    var first = tel.split(/[,;\/]/)[0].trim();
    var clean = first.replace(/[^0-9+]/g, "");
    if (clean === "") return;
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run("callto:" + clean);
    } catch(e) {
        window.open("tel:" + clean);
    }
};

window.CopiaRiepilogoConsegna = function(nome, ind, loc, prov, tel, merce, data, ora, isLogistica) {
    try {
        var strData = (data || "").trim();
        var strOra = (ora || "").trim();
        if (strOra && strOra.toLowerCase() !== "null" && strOra !== "Seleziona ora...") {
            strData += " (" + strOra + ")";
        }
        
        var prefixLog = "";
        if (String(isLogistica).toLowerCase() === "true") {
            prefixLog = "⚠️ *ATTENZIONE AUTISTA*: Consegna programmata presso *Domicilio Logistico* (Diverso da residenza)!\n\n";
        }
        
        var testo = prefixLog + "📋 *RIEPILOGO CONSEGNA C. MILELLA*\n" +
                    "-----------------------------------------\n" +
                    "👤 *Destinatario*: " + String(nome || "-").toUpperCase() + "\n" +
                    "📍 *Indirizzo*: " + (ind || "-") + " - " + (loc || "-") + " (" + (prov || "") + ")\n" +
                    "📞 *Contatto*: " + (tel || "Nessun Recapito") + "\n" +
                    "📦 *Articoli*: " + (merce || "-") + "\n" +
                    "📅 *Consegna*: " + strData + "\n" +
                    "-----------------------------------------\n" +
                    "🚀 *Inviato dal Terminale Logistico*";
                    
        var clip = new ActiveXObject("htmlfile").parentWindow.clipboardData;
        clip.setData("Text", testo);
        
        // Effetto di conferma UX a video!
        var box = document.createElement("div");
        box.innerHTML = "<div style='display:flex; align-items:center; gap:8px;'><img src='https://img.icons8.com/color/48/ok--v1.png' style='width:18px; height:18px;'> Riepilogo Copiato!</div>";
        box.style.cssText = "position:fixed; bottom:40px; right:40px; background:rgba(15, 23, 42, 0.95); border:1.5px solid #22c55e; color:#FFF; padding:14px 28px; border-radius:14px; font-weight:900; box-shadow:0 15px 35px rgba(34,197,94,0.3); z-index:100000; animation: slideUpConfirm 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); font-family:'Inter', sans-serif; font-size:12.5px; backdrop-filter:blur(10px); text-transform:uppercase; letter-spacing:0.5px;";
        document.body.appendChild(box);
        
        setTimeout(function(){
             box.style.transition = "all 0.4s ease";
             box.style.opacity = "0";
             box.style.transform = "translateY(10px) scale(0.9)";
             setTimeout(function(){ if(box.parentNode) box.parentNode.removeChild(box); }, 450);
        }, 2200);
        
    } catch(e) {
        alert("Impossibile copiare negli appunti: " + e.message);
    }
};

/* ========================================================
   SISTEMA DI PROTEZIONE E TRACCIAMENTO MODIFICHE NON SALVATE
   ======================================================== */
function GetCurrentFormState() {
    try {
        return {
            nome: document.getElementById("txtNome") ? document.getElementById("txtNome").value : "",
            provincia: document.getElementById("cmbProvincia") ? document.getElementById("cmbProvincia").value : "",
            localita: document.getElementById("cmbLocalita") ? document.getElementById("cmbLocalita").value : "",
            residenza: document.getElementById("txtResidenza") ? document.getElementById("txtResidenza").value : "",
            email: document.getElementById("txtEmail") ? document.getElementById("txtEmail").value : "",
            ente: document.getElementById("cmbEnte") ? document.getElementById("cmbEnte").value : "",
            dataConsegna: document.getElementById("txtDataConsegna") ? document.getElementById("txtDataConsegna").value : "",
            oraConsegna: document.getElementById("cmbOra") ? document.getElementById("cmbOra").value : "",
            ordine: document.getElementById("txtOrdine") ? document.getElementById("txtOrdine").value : "",
            stato: document.getElementById("cmbStato") ? document.getElementById("cmbStato").value : "",
            kmAndata: document.getElementById("txtKmAndata") ? document.getElementById("txtKmAndata").value : "",
            kmRitorno: document.getElementById("txtKmRitorno") ? document.getElementById("txtKmRitorno").value : "",
            merce: document.getElementById("txtMerce") ? document.getElementById("txtMerce").value : "",
            note: document.getElementById("txtNote") ? document.getElementById("txtNote").value : "",
            consegnato: document.getElementById("chkConsegnato") ? document.getElementById("chkConsegnato").checked : false,
            telefoni: typeof GetPhoneNumbersFromChips === "function" ? GetPhoneNumbersFromChips() : "",
            invalidita: typeof GetInvalidityFromChips === "function" ? GetInvalidityFromChips() : ""
        };
    } catch(e) {
        return null;
    }
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
        var promptMsg = "Sono presenti modifiche non salvate per la scheda corrente.\n\n" +
                        "Vuoi memorizzarle prima di procedere?\n\n" +
                        "[SÌ]\t- Salva nel Database e procedi\n" +
                        "[NO]\t- Abbandona le modifiche e procedi\n" +
                        "[ANNULLA]\t- Torna alla scheda per continuare a scrivere";
        
        // Mostra il nuovo dialog premium
        var result = window.showModalDialog("premium_prompt.html", {msg: promptMsg}, "dialogWidth:480px;dialogHeight:280px;center:yes;status:no;scroll:no;unadorned:yes;");
        if (!result) result = 2;


        
        if (result === 6) { // Sì (Yes)
            return ActionSalva(); // Restituisce l'esito boolean
        } else if (result === 7) { // No
            originalState = null; // Disabilita monitoraggio temporaneamente per lasciar procedere l'azione
            return true;
        } else {
            return false; // Annulla (Cancel)
        }
    } catch(e) {
        return confirm("Ci sono modifiche non salvate sulla scheda. Vuoi abbandonarle per continuare?");
    }
}

// ============================================================
// FASE 4: LA "DISTINTA DI CARICO" AGGREGATA (ENHANCEMENT 2026)
// ============================================================
window.GeneraDistintaCarico = function() {
    try {
        var dataArr = window.arrayConsegneMemory || [];
        if (dataArr.length === 0) {
            alert("Nessuna consegna visualizzata nell'elenco per cui generare la distinta.");
            return;
        }
        
        var cmbM = document.getElementById("cmbMese");
        var cmbA = document.getElementById("cmbAnni");
        var meseNome = cmbM ? cmbM.options[cmbM.selectedIndex].text : "";
        var annoNome = cmbA ? cmbA.value : "";
        var sottotitolo = "ELENCO DI CARICO: " + meseNome.toUpperCase() + " " + annoNome;
        
        var txtSub = document.getElementById("lblDistintaSottotitolo");
        if(txtSub) txtSub.innerText = sottotitolo;
        
        var printData = document.getElementById("lblDistintaDataStampa");
        if(printData) {
            var d = new Date();
            printData.innerText = "Generata il: " + d.getDate() + "/" + (d.getMonth()+1) + "/" + d.getFullYear() + " alle " + d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        }
        
        // Mappa di aggregazione Merce -> Quantità
        var mapCarico = {};
        var pezziTotali = 0;
        var consegneValide = 0;
        
        for (var i = 0; i < dataArr.length; i++) {
            var row = dataArr[i];
            // Ignora le consegne chiuse: l'autista deve caricare solo le merci NON ancora consegnate
            var isClosed = (row.Consegnato === true || row.Consegnato === -1 || String(row.Consegnato).toLowerCase() === "true" || String(row.Consegnato) === "-1" || row.Consegnato === 1 || String(row.Consegnato) === "1");
            if (isClosed) continue; 

            var merceRaw = row.Merce || "";
            if (merceRaw === "" || merceRaw.trim() === "-" || merceRaw.trim() === "") continue;
            
            consegneValide++;
            
            // Split intelligente su virgole, punti e virgole o ritorni a capo
            var items = merceRaw.split(/[,;\n]/);
            for (var j = 0; j < items.length; j++) {
                var item = items[j].replace(/^\s*[-\*•]\s*/, "").trim(); // Pulizia trattini o elenchi
                if (item === "" || item === "-") continue;
                
                var itemNorm = item.toUpperCase();
                
                // Gestione quantitativi (es: "2 Carrozzine", "3x Aste")
                var qtyInStr = 1;
                var matchQty = itemNorm.match(/^(\d+)\s*X?\s+(.+)$/i);
                if (matchQty) {
                    qtyInStr = parseInt(matchQty[1], 10);
                    itemNorm = matchQty[2].trim();
                } else {
                    var matchQtyEnd = itemNorm.match(/^(.+?)\s*X\s*(\d+)$/i);
                    if (matchQtyEnd) {
                        qtyInStr = parseInt(matchQtyEnd[2], 10);
                        itemNorm = matchQtyEnd[1].trim();
                    }
                }
                
                if (mapCarico[itemNorm]) {
                    mapCarico[itemNorm] += qtyInStr;
                } else {
                    mapCarico[itemNorm] = qtyInStr;
                }
                pezziTotali += qtyInStr;
            }
        }
        
        var container = document.getElementById("distintaItemsContainer");
        if (!container) return;
        container.innerHTML = "";
        
        var sortedKeys = [];
        for (var k in mapCarico) {
            if (mapCarico.hasOwnProperty(k)) sortedKeys.push(k);
        }
        sortedKeys.sort();
        
        if (sortedKeys.length === 0) {
            container.innerHTML = "<div style='text-align:center; padding:40px; color:#94a3b8; font-style:italic;'><i class='fa fa-exclamation-triangle' style='color:#fbbf24; font-size:2rem; margin-bottom:15px; display:block;'></i>Tutte le consegne visibili per questo filtro risultano prive di merce o già chiuse.</div>";
            pezziTotali = 0;
        } else {
            for (var s = 0; s < sortedKeys.length; s++) {
                var label = sortedKeys[s];
                var qty = mapCarico[label];
                
                var rowDiv = document.createElement("div");
                rowDiv.className = "distinta-row";
                rowDiv.innerHTML = '<div class="distinta-qty">' + qty + '</div>' +
                                   '<div class="distinta-label">' + label + '</div>' +
                                   '<div class="no-print" style="color:rgba(255,255,255,0.2); cursor:pointer; padding: 4px 10px; border-radius: 8px; transition:0.15s;" onclick="var p=this.parentElement; var active=(p.style.opacity===\'0.35\'); p.style.opacity=active?\'1\':\'0.35\'; p.style.background=active?\'\':\'rgba(255,255,255,0.01)\'; this.style.color=active?\'\':\'#10b981\'; event.stopPropagation();" title="Spunta come prelevato" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'\'"><i class="fa fa-check-circle" style="font-size:18px;"></i></div>';
                container.appendChild(rowDiv);
            }
        }
        
        var lblPezzi = document.getElementById("lblDistintaPezziTot");
        var lblConsegne = document.getElementById("lblDistintaConsegneTot");
        if (lblPezzi) lblPezzi.innerText = "TOTALE PEZZI DA CARICARE: " + pezziTotali;
        if (lblConsegne) lblConsegne.innerText = "CONSEGNE DA EVADERE COINVOLTE: " + consegneValide;
        
        document.getElementById("distintaOverlay").style.display = "flex";
    } catch(ex) {
        alert("Impossibile calcolare la distinta:\n" + ex.message);
    }
};

window.ChiudiDistintaCarico = function() {
    var ov = document.getElementById("distintaOverlay");
    if (ov) ov.style.display = "none";
};

window.StampaDistintaCarico = function() {
    try {
        window.print();
    } catch(e) {
        alert("Errore di stampa: " + e.message);
    }
};


// =========================================================================
// NUOVE FUNZIONALITÀ AGGIUNTIVE: ASSOCIAZIONE FOTO E COPIA RIEPILOGO
// =========================================================================

function ActionAssociaFotoCliente(filePath) {
    if (!filePath) return;
    try {
        var idCl = document.getElementById("lblClientID").value;
        if (!idCl || idCl === "" || isNaN(idCl)) {
            alert("Per associare una foto, devi prima salvare o selezionare una consegna associata a un cliente registrato.");
            return;
        }
        
        // Estrazione estensione
        var ext = "";
        var dotIdx = filePath.lastIndexOf(".");
        if (dotIdx !== -1) {
            ext = filePath.substring(dotIdx + 1).toLowerCase();
        }
        if (ext !== "jpg" && ext !== "jpeg" && ext !== "png" && ext !== "gif") {
            alert("Formato immagine non supportato. Selezionare un file JPG, JPEG, PNG o GIF.");
            return;
        }
        
        // Assicurarsi che la directory FotoClienti esista
        if (!fso.FolderExists(FOTO_DIR)) {
            fso.CreateFolder(FOTO_DIR);
        }
        
        // Costruzione percorso di destinazione con timestamp per evitare caching di Internet Explorer
        var timestamp = new Date().getTime();
        var destFileName = "cliente_" + idCl + "_" + timestamp + "." + ext;
        var destPath = fso.BuildPath(FOTO_DIR, destFileName);
        
        // Copia fisica del file immagine
        fso.CopyFile(filePath, destPath, true);
        
        // Aggiornamento sul Database Access
        var sql = "UPDATE tblClienti SET PercorsoFoto = '" + sqlEscape(destFileName) + "' WHERE ID = " + idCl;
        if (executeAccessDBCrud(sql)) {
            announce("Foto associata al cliente con successo");
            
            // Aggiornamento grafico dell'anteprima
            var imgTag = document.getElementById("imgFotoCliente");
            var lblNof = document.getElementById("lblNoFoto");
            if (imgTag) {
                imgTag.src = "file:///" + destPath.replace(/\\/g, "/") + "?t=" + timestamp;
                imgTag.style.display = "block";
            }
            if (lblNof) lblNof.style.display = "none";
        } else {
            alert("Errore durante il salvataggio del percorso foto nel database.");
        }
    } catch(e) {
        alert("Errore associazione foto: " + e.message);
    }
}

function ActionCopiaRiepilogo() {
    try {
        var nome = document.getElementById("txtNome").value.trim();
        if (nome === "") {
            alert("Seleziona una consegna prima di copiare il riepilogo.");
            return;
        }
        
        var indirizzo = document.getElementById("txtResidenza").value.trim();
        var localita = document.getElementById("cmbLocalita").value.trim();
        var provincia = document.getElementById("cmbProvincia").value.trim();
        
        // Recupero telefono dai chip o dal campo di inserimento
        var telefono = "";
        var chips = document.getElementById("chipsArea") ? document.getElementById("chipsArea").getElementsByClassName("phone-chip") : [];
        if (chips && chips.length > 0) {
            telefono = chips[0].getElementsByTagName("span")[0].innerText;
        } else if (document.getElementById("txtTelefono")) {
            telefono = document.getElementById("txtTelefono").value.trim();
        }
        
        var merce = document.getElementById("txtMerce") ? document.getElementById("txtMerce").value.trim() : "";
        var data = document.getElementById("txtDataConsegna") ? document.getElementById("txtDataConsegna").value.trim() : "";
        var ora = document.getElementById("cmbOra") ? document.getElementById("cmbOra").value.trim() : "";
        var stato = document.getElementById("cmbStato") ? document.getElementById("cmbStato").value.trim() : "";
        
        var parts = [];
        parts.push("NOME: " + nome);
        if (indirizzo) {
            parts.push("INDIRIZZO: " + indirizzo + (localita ? (", " + localita) : "") + (provincia ? (" (" + provincia + ")") : ""));
        }
        if (telefono) parts.push("TEL: " + telefono);
        if (merce) parts.push("MERCE: " + merce);
        if (data) parts.push("DATA: " + data + (ora ? (" ore " + ora) : ""));
        if (stato) parts.push("STATO: " + stato);
        
        var txtDaCopiare = parts.join(" | ");
        copyToClipboard(txtDaCopiare);
        announce("Riepilogo copiato negli appunti");
    } catch(e) {
        alert("Errore durante la copia del riepilogo: " + e.message);
    }
}


window.ApriHelpModal = function() {
    var ov = document.getElementById("helpOverlay");
    if (ov) ov.style.display = "flex";
};

window.ChiudiHelpModal = function() {
    var ov = document.getElementById("helpOverlay");
    if (ov) ov.style.display = "none";
};














// ============================================================
// WHATSAPP TEMPLATES MODAL HELPERS & SEARCH HIGHLIGHTING
// ============================================================
var currentWaData = null;
var batchWaDataArray = [];

function ChiudiModalWhatsApp() {
    var modal = document.getElementById("modalWhatsApp");
    if (modal) modal.style.display = "none";
}

function ChiudiModalWhatsAppCustom() {
    var modal = document.getElementById("modalWhatsAppCustom");
    if (modal) modal.style.display = "none";
}

function InviaWhatsAppCustom() {
    var txt = document.getElementById("txtWaCustomMessage");
    if(!txt || txt.value.trim() === "") {
        alert("Inserisci un messaggio valido.");
        return;
    }
    var customText = txt.value.trim();
    
    var datiDaProcessare = [];
    if (typeof batchWaDataArray !== 'undefined' && batchWaDataArray && batchWaDataArray.length > 0) {
        datiDaProcessare = batchWaDataArray;
    } else if (currentWaData) {
        datiDaProcessare.push(currentWaData);
    } else {
        ChiudiModalWhatsAppCustom();
        return;
    }
    
    for(var i=0; i<datiDaProcessare.length; i++) {
        var d = datiDaProcessare[i];
        var nameUp = (d.nome || "").toUpperCase();
        var locUp = (d.localita || "").toUpperCase();
        var ora = d.ora || "--:--";
        var msg = customText.replace(/\[NOME\]/gi, nameUp).replace(/\[LOCALITA\]/gi, locUp).replace(/\[ORA\]/gi, ora);
        
        InviaSfondoWhatsApp(d.tel, msg);
    }
    
    if (typeof batchWaDataArray !== 'undefined') batchWaDataArray = [];
    ChiudiModalWhatsAppCustom();
    var bClear = document.getElementById("batchActionsPanel");
    if(bClear && bClear.style.display !== "none") BatchActionClear();
}

function SpedisciWhatsAppConMessaggio(tplNum) {
    var datiDaProcessare = [];
    if (typeof batchWaDataArray !== 'undefined' && batchWaDataArray && batchWaDataArray.length > 0) {
        datiDaProcessare = batchWaDataArray;
    } else if (currentWaData) {
        datiDaProcessare.push(currentWaData);
    } else {
        return;
    }
    
    var customText = "";
    if (tplNum === 4) {
        ChiudiModalWhatsApp();
        var customModal = document.getElementById("modalWhatsAppCustom");
        if(customModal) {
            customModal.style.display = "flex";
            var txt = document.getElementById("txtWaCustomMessage");
            if(txt) { txt.value = ""; txt.focus(); }
        }
        return;
    }
    
    for(var i=0; i<datiDaProcessare.length; i++) {
        var d = datiDaProcessare[i];
        var msg = "";
        var nameUp = (d.nome || "").toUpperCase();
        var locUp = (d.localita || "").toUpperCase();
        var ora = d.ora || "--:--";
        
        if (tplNum === 1) {
            msg = "Gentile Cliente " + nameUp + ", la informiamo che la consegna dei suoi articoli C. Milella è in programma per oggi. I nostri autisti sono in arrivo tra circa 15 minuti! A presto.";
        } else if (tplNum === 2) {
            msg = "Gentile Cliente " + nameUp + ", la informiamo che la consegna dei suoi articoli C. Milella è programmata per oggi alle ore " + ora + " circa in " + locUp + ". A presto!";
            if (d.merce && d.merce !== "-" && d.merce.trim() !== "") {
                msg = "Gentile Cliente " + nameUp + ", la informiamo che la consegna dei suoi articoli (" + d.merce + ") C. Milella è programmata per oggi alle ore " + ora + " circa in " + locUp + ". A presto!";
            }
        } else if (tplNum === 3) {
            msg = "Gentile Cliente " + nameUp + ", i nostri autisti hanno tentato la consegna a " + locUp + " ma non è stato possibile completarla per assenza del destinatario. Ci contatti per riprogrammare. Grazie.";
        }
        
        InviaSfondoWhatsApp(d.tel, msg);
    }
    
    if (typeof batchWaDataArray !== 'undefined') batchWaDataArray = [];
    ChiudiModalWhatsApp();
    var bClear = document.getElementById("batchActionsPanel");
    if(bClear && bClear.style.display !== "none") BatchActionClear();
}

function ApriLinkEsterno(url) {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run(url);
    } catch(err) {
        window.open(url, "_blank");
    }
}

function highlightSearchText(text, query) {
    if (!text) return "";
    if (!query || query.trim() === "") return text;
    var q = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    var re = new RegExp("(" + q + ")", "gi");
    return String(text).replace(re, "<span class='search-highlight'>$1</span>");
}

// ============================================================
// PREMIUM FEATURES: QR NAVIGATORE, CARD REORDERING & QUICK FILTERS
// ============================================================
function ApriQRNavigatore(indirizzo, localita, provincia) {
    var fullAddress = (indirizzo || "") + ", " + (localita || "") + " (" + (provincia || "") + ")";
    document.getElementById("modalQRAddress").innerText = fullAddress;
    
    // Costruiamo il link di navigazione di Google Maps
    var mapsLink = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(fullAddress);
    
    // Generiamo l'URL del QR Code tramite le API goqr.me
    var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(mapsLink);
    
    document.getElementById("modalQRImage").src = qrUrl;
    document.getElementById("modalQR").style.display = "flex";
}

function ChiudiModalQR() {
    document.getElementById("modalQR").style.display = "none";
    document.getElementById("modalQRImage").src = "";
}

function SpostaCardConsegna(id, direzione, idx) {
    // Prima impostiamo idConsegnaCorrente in modo che la funzione di ordinamento sappia su quale card operare
    idConsegnaCorrente = Number(id);
    
    // Per far vedere la selezione (anche graficamente), evidenziamo la card senza aprirla
    var container = document.getElementById("cardListContainer");
    var cards = container.getElementsByClassName("delivery-gold-card");
    if(cards[idx]) {
        for(var z=0; z<cards.length; z++) cards[z].classList.remove("selected");
        cards[idx].classList.add("selected");
        
        // Se l'editor è già aperto, carichiamo la consegna corrente senza aprirne un'altra
        var ep = document.getElementById("editorPanel");
        if(ep && !ep.classList.contains("collapsed")) {
            CaricaDettaglioConsegna(arrayConsegneMemory[idx]);
        }
    }
    
    // Ora avviamo l'ordinamento nativo!
    if (direzione === "su") {
        ActionSpostaSu();
    } else {
        ActionSpostaGiu();
    }
}

// --- NUOVE FUNZIONI INTEGRATE (SPLIT VIEW, DRAG & DROP, BATCH, INLINE EDIT) ---

function ToggleSplitViewMap() {
    var container = document.getElementById("cardListContainer");
    var mapPanel = document.getElementById("mapPanel");
    
    if (mapPanel.style.display === "block") {
        mapPanel.style.display = "none";
        container.classList.remove("split-mode");
    } else {
        mapPanel.style.display = "block";
        container.classList.add("split-mode");
        var mapIframe = document.getElementById("mapFrame");
        mapIframe.src = "mappa_premium.html";
        if(typeof window.ToastManager !== 'undefined') window.ToastManager.info("Caricamento Smart Routing Visivo...");
    }
}

function UpdateBatchActionsPanel() {
    var checkboxes = document.getElementsByClassName("batch-checkbox");
    var count = 0;
    for(var i=0; i<checkboxes.length; i++) {
        if(checkboxes[i].checked) count++;
    }
    
    var panel = document.getElementById("batchActionsPanel");
    var lbl = document.getElementById("lblBatchCount");
    if(count > 0) {
        lbl.innerText = count;
        panel.style.display = "flex";
    } else {
        panel.style.display = "none";
    }
}

function BatchActionClear() {
    var checkboxes = document.getElementsByClassName("batch-checkbox");
    for(var i=0; i<checkboxes.length; i++) {
        checkboxes[i].checked = false;
    }
    UpdateBatchActionsPanel();
}

function BatchActionWhatsApp() {
    var checkboxes = document.getElementsByClassName("batch-checkbox");
    if (typeof batchWaDataArray === 'undefined') window.batchWaDataArray = [];
    batchWaDataArray = [];
    for(var i=0; i<checkboxes.length; i++) {
        if(checkboxes[i].checked) {
            var el = checkboxes[i];
            while(el && !el.classList.contains("delivery-gold-card")) {
                el = el.parentNode;
            }
            if(el) {
                var idx = el.getAttribute("data-idx");
                var row = arrayConsegneMemory[idx];
                if(row && row.Telefono && row.Telefono !== "Nessun Recapito" && row.Telefono.trim() !== "" && row.Telefono !== "-") {
                    var merce = row.Merce || "";
                    if (!merce || merce === "null") {
                        if (typeof GetMaterialsFromExcelCached === "function") {
                            merce = GetMaterialsFromExcelCached(row.ClienteNome);
                        }
                    }
                    var firstPhone = row.Telefono.split(/[,;\/]/)[0].trim();
                    var cleanTel = firstPhone.replace(/[^0-9]/g, "");
                    if (cleanTel.length === 10 && cleanTel.indexOf("3") === 0) {
                        cleanTel = "39" + cleanTel;
                    }
                    batchWaDataArray.push({
                        tel: cleanTel,
                        nome: row.ClienteNome || "",
                        ora: row.OraConsegna || "",
                        localita: row.LocalitaConsegna || "",
                        merce: merce
                    });
                }
            }
        }
    }
    if(batchWaDataArray.length > 0) {
        var modal = document.getElementById("modalWhatsApp");
        if (modal) {
            modal.style.display = "flex";
        } else {
            alert("Modulo selezione messaggi non trovato.");
        }
    } else {
        alert("Nessun cliente tra quelli selezionati ha un numero di telefono valido.");
        BatchActionClear();
    }
}

function BatchActionStatus() {
    var checkboxes = document.getElementsByClassName("batch-checkbox");
    var idsToUpdate = [];
    for(var i=0; i<checkboxes.length; i++) {
        if(checkboxes[i].checked) {
            idsToUpdate.push(checkboxes[i].getAttribute("data-id"));
        }
    }
    if(idsToUpdate.length === 0) return;
    
    if(confirm("Vuoi segnare " + idsToUpdate.length + " consegne come COMPLETATE?")) {
        var idsString = idsToUpdate.join(",");
        if (typeof ExecuteSQL === "function") {
            try {
                ExecuteSQL("UPDATE TabellaConsegne SET Stato = 'Chiuso' WHERE ID IN (" + idsString + ")");
                alert(idsToUpdate.length + " consegne completate con successo!");
                BatchActionClear();
                if(typeof CercaConsegne === "function") CercaConsegne();
            } catch(e) {
                alert("Errore durante l'aggiornamento: " + e.message);
            }
        } else {
            alert("Simulazione completamento (SQL non disponibile) per ID: " + idsString);
            BatchActionClear();
        }
    }
}

function SpostaCardDragDrop(fromIdx, toIdx) {
    if(fromIdx === toIdx) return;
    alert("Integrazione Drag & Drop (Simulazione DB - Spostamento da posizione " + fromIdx + " a " + toIdx + ") effettuata.");
}

function InlineEditMerce(element, id, currentVal) {
    var parent = element.parentNode;
    parent.innerHTML = '<input type="text" class="inline-edit-input" value="' + currentVal.replace(/"/g, '&quot;') + '" onblur="SaveInlineMerce(' + id + ', this.value, this.parentNode)" onkeydown="if(event.keyCode===13) this.blur()">';
    parent.firstChild.focus();
}

function SaveInlineMerce(id, newVal, parentContainer) {
    parentContainer.innerHTML = '<i class="fa fa-cube" style="color:#0284c7; font-size:12px;"></i>' +
                     '<span style="font-weight:900; color:#0284c7; font-size:9.5px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; margin-right:4px;">MERCE:</span>' +
                     '<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; color:#334155;">' + newVal + '</span>';
    parentContainer.onclick = function(e) { e.cancelBubble=true; InlineEditMerce(this, id, newVal); };
    
    if (typeof ExecuteSQL === "function") {
        try {
            ExecuteSQL("UPDATE TabellaConsegne SET Merce = '" + newVal.replace(/'/g, "''") + "' WHERE ID = " + id);
        } catch(e) {}
    }
}

// ==========================================
// KANBAN VIEW & MINI DASHBOARD (PREMIUM UI)
// ==========================================

window.AggiornaMiniDashboard = function(arr) {
    if (!document.getElementById("miniDashboardPremium")) return;
    
    var completed = 0;
    var pending = 0;
    var issues = 0;
    var total = arr.length;
    
    for (var i = 0; i < arr.length; i++) {
        var r = arr[i];
        var isClosed = (r.Consegnato === true || r.Consegnato === -1 || String(r.Consegnato).toLowerCase() === "true" || String(r.Consegnato) === "-1" || r.Consegnato === 1 || String(r.Consegnato) === "1");
        var lowStato = String(r.Stato || "").toLowerCase();
        
        if (isClosed) {
            completed++;
        } else if (lowStato === "sospeso" || lowStato === "in sospeso" || lowStato === "da chiamare") {
            issues++;
        } else {
            pending++;
        }
    }
    
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById("dashCompleted").innerHTML = completed + " / " + total;
    document.getElementById("dashPending").innerHTML = pending;
    document.getElementById("dashIssues").innerHTML = issues;
    
    document.getElementById("dashProgressBar").style.width = pct + "%";
    document.getElementById("dashProgressText").innerHTML = pct + "%";
};

window.isKanbanViewActive = false;
window.ToggleKanbanView = function() {
    window.isKanbanViewActive = !window.isKanbanViewActive;
    var btn = document.getElementById("btnToggleKanban");
    if (window.isKanbanViewActive) {
        btn.innerHTML = "📝 LISTA";
        btn.style.background = "rgba(236, 72, 153, 0.12)";
        btn.style.color = "#ec4899";
        btn.style.borderColor = "rgba(236, 72, 153, 0.4)";
    } else {
        btn.innerHTML = "📋 KANBAN";
        btn.style.background = "rgba(139,92,246,0.12)";
        btn.style.color = "#a78bfa";
        btn.style.borderColor = "rgba(139,92,246,0.4)";
    }
    
    // Ridisegna
    if (typeof window.CercaConsegne === 'function') {
        window.CercaConsegne();
    }
};

window.RenderKanban = function(arr) {
    var container = document.getElementById("cardListContainer");
    
    // Struttura Kanban: 3 Colonne
    var html = "<div style='display:flex; gap:15px; overflow-x:auto; padding:10px; height:100%; box-sizing:border-box;'>";
    
    html += "<div class='kanban-col' style='flex:1; min-width:240px; background:rgba(15,23,42,0.4); border-radius:12px; border:1px solid #1e293b; display:flex; flex-direction:column;'>";
    html += "   <div style='padding:15px; border-bottom:2px solid #facc15; font-weight:900; color:#facc15; text-align:center;'>IN ATTESA / PIANIFICATE</div>";
    html += "   <div id='kb-pending' class='kb-dropzone' style='flex:1; overflow-y:auto; padding:10px; min-height:200px;' ondragover='window.KBDragOver(event)' ondrop='window.KBDrop(event, \"pending\")'></div>";
    html += "</div>";
    
    html += "<div class='kanban-col' style='flex:1; min-width:240px; background:rgba(15,23,42,0.4); border-radius:12px; border:1px solid #1e293b; display:flex; flex-direction:column;'>";
    html += "   <div style='padding:15px; border-bottom:2px solid #ef4444; font-weight:900; color:#ef4444; text-align:center;'>SOSPESI / PROBLEMI</div>";
    html += "   <div id='kb-issues' class='kb-dropzone' style='flex:1; overflow-y:auto; padding:10px; min-height:200px;' ondragover='window.KBDragOver(event)' ondrop='window.KBDrop(event, \"sospeso\")'></div>";
    html += "</div>";
    
    html += "<div class='kanban-col' style='flex:1; min-width:240px; background:rgba(15,23,42,0.4); border-radius:12px; border:1px solid #1e293b; display:flex; flex-direction:column;'>";
    html += "   <div style='padding:15px; border-bottom:2px solid #22c55e; font-weight:900; color:#22c55e; text-align:center;'>COMPLETATE</div>";
    html += "   <div id='kb-completed' class='kb-dropzone' style='flex:1; overflow-y:auto; padding:10px; min-height:200px;' ondragover='window.KBDragOver(event)' ondrop='window.KBDrop(event, \"completed\")'></div>";
    html += "</div>";
    
    html += "</div>";
    
    // Inietta stili per le card kanban (se non ci sono)
    if (!document.getElementById("kanbanStylesPremium")) {
        var style = document.createElement("style");
        style.id = "kanbanStylesPremium";
        style.innerHTML = "" +
        ".kanban-card-premium { " +
        "   background: linear-gradient(145deg, #1e293b, #0f172a); " +
        "   border: 1px solid #334155; " +
        "   border-left: 4px solid #0ea5e9; " +
        "   border-radius: 10px; " +
        "   padding: 12px; " +
        "   color: #f8fafc; " +
        "   box-shadow: 0 4px 6px rgba(0,0,0,0.3); " +
        "   transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; " +
        "   cursor: grab; " +
        "   display: block !important; " + // Override any generic flex
        "} " +
        ".kanban-card-premium:hover { " +
        "   transform: translateY(-2px); " +
        "   box-shadow: 0 6px 12px rgba(0,0,0,0.5); " +
        "   border-color: #475569; " +
        "} " +
        ".kanban-card-premium.urgent { " +
        "   border-left-color: #ef4444; " +
        "} " +
        ".kb-dropzone::-webkit-scrollbar { width: 6px; } " +
        ".kb-dropzone::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; } " +
        ".kb-dropzone::-webkit-scrollbar-track { background: transparent; }";
        document.head.appendChild(style);
    }
    
    container.innerHTML = html;
    
    var colPending = document.getElementById("kb-pending");
    var colIssues = document.getElementById("kb-issues");
    var colCompleted = document.getElementById("kb-completed");
    
    for (var u = 0; u < arr.length; u++) {
        var row = arr[u];
        var isClosed = (row.Consegnato === true || row.Consegnato === -1 || String(row.Consegnato).toLowerCase() === "true" || String(row.Consegnato) === "-1" || row.Consegnato === 1 || String(row.Consegnato) === "1");
        var lowStato = String(row.Stato || "").toLowerCase();
        var card = CreaCardObj(row, u);
        
        // Add drag support
        card.setAttribute("draggable", "true");
        card.ondragstart = function(e) {
            e.dataTransfer.setData("text/plain", this.getAttribute("data-idx"));
            this.style.opacity = "0.5";
        };
        card.ondragend = function(e) {
            this.style.opacity = "1";
        };
        
        if (isClosed) {
            colCompleted.appendChild(card);
        } else if (lowStato === "sospeso" || lowStato === "in sospeso" || lowStato === "da chiamare") {
            colIssues.appendChild(card);
        } else {
            colPending.appendChild(card);
        }
    }
};

window.KBDragOver = function(e) {
    e.preventDefault();
};

window.KBDrop = function(e, newState) {
    e.preventDefault();
    var idx = e.dataTransfer.getData("text/plain");
    if (!idx || typeof window.arrayConsegneMemory === 'undefined') return;
    
    var row = window.arrayConsegneMemory[idx];
    if(!row) return;
    
    var id = row.ID;
    var sql = "";
    
    if (newState === "completed") {
        sql = "UPDATE TabellaConsegne SET Consegnato = -1, Stato = 'Consegnato' WHERE ID = " + id;
    } else if (newState === "sospeso") {
        sql = "UPDATE TabellaConsegne SET Consegnato = 0, Stato = 'Sospeso' WHERE ID = " + id;
    } else {
        sql = "UPDATE TabellaConsegne SET Consegnato = 0, Stato = 'Pianificato' WHERE ID = " + id;
    }
    
    if (typeof ExecuteSQL === "function") {
        try {
            ExecuteSQL(sql);
            if(typeof window.ToastManager !== 'undefined') window.ToastManager.success("Stato aggiornato con successo!");
            setTimeout(function() { window.CercaConsegne(); }, 300);
        } catch(ex) {
            if(typeof window.ToastManager !== 'undefined') window.ToastManager.error("Errore aggiornamento: " + ex.message);
        }
    }
};

// Wrapper per riutilizzare la logica di CreaCard nel Kanban
function CreaCardObj(row, u) {
    var c = document.createElement("div");
    c.className = "kanban-card-premium";
    c.style.marginBottom = "10px";
    c.setAttribute("data-idx", u);
    c.setAttribute("data-id", row.ID);
    
    var isUrgent = (String(row.Stato).toLowerCase().indexOf("urgente") > -1 || String(row.Note).toLowerCase().indexOf("urgente") > -1);
    if(isUrgent) c.className += " urgent";
    
    var html = "<div style='display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;'>";
    html += "<strong style='color:#f8fafc; font-size:13px; line-height:1.2; word-break:break-word; max-width:75%;'>" + (row.ClienteNome || "Sconosciuto") + "</strong>";
    html += "<span style='color:#0ea5e9; font-size:11px; font-weight:bold; white-space:nowrap; background:rgba(14,165,233,0.1); padding:2px 6px; border-radius:12px;'>" + (row.OraConsegna || "--:--") + "</span>";
    html += "</div>";
    
    html += "<div style='color:#94a3b8; font-size:11px; margin-bottom:6px; display:flex; gap:6px; align-items:center;'><i class='fa fa-map-marker' style='color:#64748b;'></i> <span style='overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>" + (row.IndirizzoConsegna || "") + " - " + (row.LocalitaConsegna || "") + "</span></div>";
    if(row.Merce) {
        html += "<div style='color:#cbd5e1; font-size:11px; margin-bottom:8px; display:flex; gap:6px; align-items:center;'><i class='fa fa-cube' style='color:#64748b;'></i> <span style='overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>" + row.Merce + "</span></div>";
    }
    
    html += "<div style='margin-top:auto; text-align:right; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;'>";
    html += "<button onclick='SelezionaConsegna(\"" + row.ID + "\")' style='background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); color:#38bdf8; border-radius:6px; padding:4px 10px; font-size:10px; font-weight:bold; cursor:pointer; transition:all 0.2s;' onmouseover='this.style.background=\"rgba(14,165,233,0.3)\"' onmouseout='this.style.background=\"rgba(14,165,233,0.15)\"'>Apri Dettaglio</button>";
    html += "</div>";
    
    c.innerHTML = html;
    return c;
}


// --- SMART FORMATTERS ---
function FormatSmartPhone(val) {
    val = val.replace(/[^0-9]/g, '');
    if(val.length > 3 && val.length <= 6) return val.slice(0,3) + ' ' + val.slice(3);
    if(val.length > 6) return val.slice(0,3) + ' ' + val.slice(3,6) + ' ' + val.slice(6,10);
    return val;
}
function FormatSmartTime(val) {
    val = val.replace(/[^0-9:]/g, '');
    if(val.length === 4 && val.indexOf(':') === -1) return val.slice(0,2) + ':' + val.slice(2);
    return val;
}


// --- GAMIFICATION CONFETTI ---
function TriggerConfetti() {
    var colors = ['#fbbf24', '#f59e0b', '#10b981', '#38bdf8', '#ef4444'];
    for(var i=0; i<30; i++) {
        var confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '8px';
        confetti.style.height = '8px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.zIndex = '99999';
        confetti.style.pointerEvents = 'none';
        document.body.appendChild(confetti);
        animateConfetti(confetti);
    }
}
function animateConfetti(el) {
    var top = -10;
    var speed = Math.random() * 3 + 2;
    var rot = 0;
    var timer = setInterval(function() {
        top += speed;
        rot += speed * 2;
        el.style.top = top + 'px';
        el.style.transform = 'rotate(' + rot + 'deg)';
        if(top > window.innerHeight) { clearInterval(timer); el.parentNode.removeChild(el); }
    }, 20);
}

// API WHATSAPP LOCALE
function ApriServerWhatsApp() {
    document.getElementById('serverWaModalOverlay').style.display='flex';
    document.getElementById('waStatusText').innerText = "CONNESIONE AL SERVER...";
    document.getElementById('waStatusText').style.color = "#cbd5e1";
    document.getElementById('waQrImage').style.display = "none";
    
    if(window.waPollInterval) clearInterval(window.waPollInterval);
    
    window.waPollInterval = setInterval(function() {
        try {
            var xhr = new ActiveXObject("Microsoft.XMLHTTP");
            xhr.open("GET", "http://localhost:3002/api/wa/qr?t=" + new Date().getTime(), true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        var d = JSON.parse(xhr.responseText);
                        if (d.status === "CONNECTED") {
                            document.getElementById('waStatusText').innerText = " SERVER WHATSAPP CONNESSO E OPERATIVO";
                            document.getElementById('waStatusText').style.color = "#22c55e";
                            document.getElementById('waQrImage').style.display = "none";
                            clearInterval(window.waPollInterval);
                        } else if (d.status === "QR_READY") {
                            document.getElementById('waStatusText').innerText = " INQUADRA IL QR CODE CON WHATSAPP";
                            document.getElementById('waStatusText').style.color = "#facc15";
                            document.getElementById('waQrImage').src = d.qr;
                            document.getElementById('waQrImage').style.display = "block";
                        } else {
                            document.getElementById('waStatusText').innerText = "IN ATTESA DEL SERVER WA...";
                            document.getElementById('waStatusText').style.color = "#cbd5e1";
                        }
                    } catch(e){}
                }
            };
            xhr.send();
        } catch(e) {
            document.getElementById('waStatusText').innerText = " SERVER NON RAGGIUNGIBILE. ASSICURARSI CHE SIA AVVIATO IN BACKGROUND.";
            document.getElementById('waStatusText').style.color = "#ef4444";
        }
    }, 2000);
}

function InviaSfondoWhatsApp(telefono, testo) {
    if(typeof window.ToastManager !== 'undefined') window.ToastManager.info("Apertura App WhatsApp per " + telefono + "...");
    var url = "whatsapp://send?phone=" + telefono + "&text=" + encodeURIComponent(testo);
    ApriLinkEsterno(url);
}

function ApriPOD() {
    if(!ConsegnaAttivaId) return;
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var shell = new ActiveXObject("WScript.Shell");
        var baseDir = OttieniPercorsoBase();
        var podDir = fso.BuildPath(baseDir, "DOCUMENTI_PDF\\POD");
        
        var fileFirma = fso.BuildPath(podDir, "Firma_" + ConsegnaAttivaId + ".png");
        var fileFoto = fso.BuildPath(podDir, "Foto_" + ConsegnaAttivaId + ".jpg");
        
        if (fso.FileExists(fileFirma)) {
            shell.Run('"' + fileFirma + '"', 1, false);
        } else if (fso.FileExists(fileFoto)) {
            shell.Run('"' + fileFoto + '"', 1, false);
        } else {
            alert("Documento POD non trovato nella cartella del server locale.");
        }
    } catch(e) {
        alert("Errore nell'apertura del POD: " + e.message);
    }
}

// FUNZIONE UNIVERSALE PER APRIRE DETTAGLIO CONSEGNA (Fix per pulsante "Apri Dettaglio")
window.SelezionaConsegna = function(id) {
    try {
        if (id === undefined || id === null) return;
        var numId = Number(id);
        
        var foundRow = null;
        if (typeof arrayConsegneMemory !== "undefined" && arrayConsegneMemory && arrayConsegneMemory.length) {
            for (var i = 0; i < arrayConsegneMemory.length; i++) {
                if (Number(arrayConsegneMemory[i].ID) === numId || arrayConsegneMemory[i].ID == id) {
                    foundRow = arrayConsegneMemory[i];
                    break;
                }
            }
        }
        
        if (typeof CaricaDettaglioConsegna === "function" && foundRow) {
            CaricaDettaglioConsegna(foundRow);
            if (typeof ActionApriEditor === "function") ActionApriEditor();
            return;
        }
        
        if (foundRow && typeof MostraDettagliRapidi === "function") {
            MostraDettagliRapidi(
                foundRow.ID,
                foundRow.ClienteNome || foundRow.Cliente || "Destinatario",
                foundRow.LocalitaConsegna || foundRow.Citta || "",
                foundRow.Merce || foundRow.Note || "",
                foundRow.Stato || "In Corso"
            );
            return;
        }
        
        if (foundRow) {
            var html = '<div style="text-align:left; font-family:\'Outfit\', sans-serif; padding:10px;">' +
                '<div style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #0284c7; border-radius:12px; padding:16px; margin-bottom:14px;">' +
                    '<div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:6px;">👤 ' + (foundRow.ClienteNome || foundRow.Cliente || "Destinatario") + '</div>' +
                    '<div style="font-size:13px; color:#475569; margin-bottom:4px;">📍 <strong>Indirizzo:</strong> ' + (foundRow.IndirizzoConsegna || "") + ' - ' + (foundRow.LocalitaConsegna || foundRow.Citta || "") + '</div>' +
                    '<div style="font-size:13px; color:#475569; margin-bottom:4px;">🕒 <strong>Orario:</strong> ' + (foundRow.OraConsegna || "--:--") + '</div>' +
                    '<div style="font-size:13px; color:#475569; margin-bottom:4px;">📦 <strong>Merce / Note:</strong> ' + (foundRow.Merce || foundRow.Note || "Nessuna nota presente") + '</div>' +
                    '<div style="font-size:13px; color:#047857; font-weight:700;">📌 <strong>Stato:</strong> ' + (foundRow.Stato || "In Corso") + '</div>' +
                '</div>' +
            '</div>';
            
            if (typeof window.ShowGoldAlert === "function") {
                window.ShowGoldAlert("DETTAGLIO CONSEGNA #" + id, html, "🚚");
            } else {
                alert("Dettaglio Consegna #" + id + "\n\nCliente: " + (foundRow.ClienteNome||foundRow.Cliente) + "\nNote: " + (foundRow.Merce||foundRow.Note));
            }
        }
    } catch(eErr) {
        console.error("Errore SelezionaConsegna:", eErr);
    }
};

// ==========================================
// GESTIONE SPESE EXTRA (MODAL)
// ==========================================
function ApriModalSpese() {
    if (!idConsegnaCorrente || idConsegnaCorrente === "NEW") {
        alert("Devi prima selezionare o salvare una consegna per aggiungere le spese extra.");
        return;
    }
    
    // Recupera le spese attuali dal DB
    var res = queryAccessDB("SELECT RimborsoAutostrada, RimborsoParcheggio, RimborsoTrenoAvaria, RimborsoVarie, RimborsoNote FROM tblConsegne WHERE ID = " + idConsegnaCorrente);
    if (res && res.length > 0) {
        var r = res[0];
        document.getElementById("txtModalRimborsoAutostrada").value = (parseFloat(r.RimborsoAutostrada) || 0).toFixed(2).replace(".", ",");
        document.getElementById("txtModalRimborsoParcheggio").value = (parseFloat(r.RimborsoParcheggio) || 0).toFixed(2).replace(".", ",");
        document.getElementById("txtModalRimborsoTrenoAvaria").value = (parseFloat(r.RimborsoTrenoAvaria) || 0).toFixed(2).replace(".", ",");
        document.getElementById("txtModalRimborsoVarie").value = (parseFloat(r.RimborsoVarie) || 0).toFixed(2).replace(".", ",");
        document.getElementById("txtModalRimborsoNote").value = r.RimborsoNote || "";
    } else {
        document.getElementById("txtModalRimborsoAutostrada").value = "0,00";
        document.getElementById("txtModalRimborsoParcheggio").value = "0,00";
        document.getElementById("txtModalRimborsoTrenoAvaria").value = "0,00";
        document.getElementById("txtModalRimborsoVarie").value = "0,00";
        document.getElementById("txtModalRimborsoNote").value = "";
    }
    
    RicalcolaTotaleSpeseModal();
    document.getElementById("speseExtraOverlay").style.display = "flex";
}

function ChiudiModalSpese() {
    document.getElementById("speseExtraOverlay").style.display = "none";
}

function RicalcolaTotaleSpeseModal() {
    var getVal = function(id) {
        var val = document.getElementById(id).value.replace(",", ".");
        var num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };
    var tot = getVal("txtModalRimborsoAutostrada") + getVal("txtModalRimborsoParcheggio") + getVal("txtModalRimborsoTrenoAvaria") + getVal("txtModalRimborsoVarie");
    document.getElementById("lblModalSpeseTotale").innerText = "€ " + tot.toFixed(2).replace(".", ",");
}

function SalvaSpeseExtraModal() {
    if (!idConsegnaCorrente || idConsegnaCorrente === "NEW") {
        alert("Nessuna consegna valida selezionata.");
        return;
    }
    
    var getVal = function(id) {
        var val = document.getElementById(id).value.replace(",", ".");
        var num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };
    
    var aut = getVal("txtModalRimborsoAutostrada");
    var par = getVal("txtModalRimborsoParcheggio");
    var trn = getVal("txtModalRimborsoTrenoAvaria");
    var varSp = getVal("txtModalRimborsoVarie");
    var tot = aut + par + trn + varSp;
    var not = document.getElementById("txtModalRimborsoNote").value.replace(/'/g, "''");
    
    var sql = "UPDATE tblConsegne SET " +
              "RimborsoAutostrada = " + aut + ", " +
              "RimborsoParcheggio = " + par + ", " +
              "RimborsoTrenoAvaria = " + trn + ", " +
              "RimborsoVarie = " + varSp + ", " +
              "TotaleRimborso = " + tot + ", " +
              "RimborsoNote = '" + not + "' " +
              "WHERE ID = " + idConsegnaCorrente;
              
    if (executeAccessDBCrud(sql)) {
        if (typeof ToastManager !== "undefined") ToastManager.success("Spese Extra salvate correttamente.");
        else announce("Spese Extra salvate correttamente.");
        ChiudiModalSpese();
    }
}