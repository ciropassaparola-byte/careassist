/**
 * GESTIONE PRESENZE & RECUPERO HTA - Motore Logico ENTERPRISE GOLD
 */

var fso = null;
try { if (typeof ActiveXObject !== "undefined") fso = new ActiveXObject("Scripting.FileSystemObject"); } catch(e) {}
var shell = null;
try { if (typeof ActiveXObject !== "undefined") shell = new ActiveXObject("WScript.Shell"); } catch(e) {}

var pathEval = document.location.pathname || "";
if (pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
var currentDir = fso ? fso.GetParentFolderName(pathEval) : "";
var DB_PATH = fso ? fso.BuildPath(currentDir, "ConsegneDB.accdb") : "ConsegneDB.accdb";

var isNavigating = false;
function isTrueVal(val) {
    if (!val) return false;
    var s = String(val).toLowerCase();
    return s === "true" || s === "-1" || s === "1" || s === "si" || s === "yes";
}
var mesiCol = {"Gennaio":1, "Febbraio":2, "Marzo":3, "Aprile":4, "Maggio":5, "Giugno":6, "Luglio":7, "Agosto":8, "Settembre":9, "Ottobre":10, "Novembre":11, "Dicembre":12};
var currentMeseStr = "";
var currentDbMap = {}; 
var idRecordCorrente = 0;
var selectedGiornoNum = 0; // Traccia il giorno selezionato per la sincronizzazione bidirezionale
var calViewMonth = -1;
var calViewYear = -1;
var nomeMesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
var loggedUser = "SCONOSCIUTO";
var isAdmin = false;
var isAbilitato = false;
var isNavigating = false;
var isSavingInProgress = false; // Lock anti-duplicazione per salvataggi multipli rapidi
var isClosing = false; // Flag di sicurezza anti-loop
var originalState = null; // Tracciatore per rilevamento modifiche non salvate

// Funzione Helper Globale per Animazione Numerica Count-Up con Supporto Formattazione Tempo (UX Premium 2026)
function AnimateCounterTime(el, endMinutes) {
    if (!el) return;
    var end = Math.round(parseFloat(endMinutes)) || 0;
    
    if (el.animationInterval) clearInterval(el.animationInterval);
    
    var duration = 600; // Durata scattante per feedback real-time
    var stepTime = 20;
    var steps = Math.ceil(duration / stepTime);
    var increment = end / steps;
    var current = 0;
    var count = 0;
    
    el.animationInterval = setInterval(function() {
        count++;
        current += increment;
        if (count >= steps) {
            clearInterval(el.animationInterval);
            el.innerText = FormattaMinuti(end);
        } else {
            el.innerText = FormattaMinuti(Math.round(current));
        }
    }, stepTime);
}

window.onbeforeunload = function() {
    if (isNavigating || isClosing) return; 
    isClosing = true;
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(e) {}
};

window.onload = function() {
    // Riconfigurazione Forzata del Tutto Schermo (Anti-Race OS)
    try {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
        setTimeout(function() {
            window.moveTo(0, 0);
            window.resizeTo(screen.availWidth, screen.availHeight);
        }, 150);
    } catch(e) {}

    InitLoggedUser();
    VerificaPermessiDB();
    VerificaIntegritaDB();
    InizializzaInterfaccia();
    CaricaListaMesi();
    StartAnalogClock();
    try { StartTitleClock(); } catch(e) {}
    try { CaricaProfiloUtente(); } catch(e) {}
};

var userDefaults = { e1: "09:00", u1: "13:30", e2: "14:30", u2: "17:30" };

function InitLoggedUser() {
    var user = "";
    
    try {
        if (typeof GoldSecurityManager !== "undefined" && typeof GoldSecurityManager.GetActiveUser === "function") {
            user = GoldSecurityManager.GetActiveUser();
        }
    } catch(eSec) {}
    
    if (!user || user === "Operatore" || user === "Ospite" || user === "SCONOSCIUTO") {
        try {
            if (typeof sessionStorage !== "undefined") {
                user = sessionStorage.getItem("loggedUser") || sessionStorage.getItem("currentUser") || sessionStorage.getItem("activeUser") || sessionStorage.getItem("user") || "";
            }
        } catch(eS) {}
    }
    
    if (!user || user === "Operatore" || user === "Ospite" || user === "SCONOSCIUTO") {
        try {
            if (typeof localStorage !== "undefined") {
                user = localStorage.getItem("loggedUser") || localStorage.getItem("activeUser") || localStorage.getItem("currentUser") || localStorage.getItem("user") || "";
            }
        } catch(eL) {}
    }

    if (!user || user === "Operatore" || user === "Ospite" || user === "SCONOSCIUTO") {
        try {
            if (fso && currentDir) {
                var credFile = fso.BuildPath(fso.BuildPath(currentDir, "system"), "cred.local");
                if (fso.FileExists(credFile)) {
                    var f = fso.OpenTextFile(credFile, 1);
                    user = f.ReadLine() || "";
                    f.Close();
                }
            }
        } catch(eCred) {}
    }

    if (user && user !== "SCONOSCIUTO") {
        loggedUser = user.trim();
    }
}

function TimbraOra() {
    var now = new Date();
    var hh = (now.getHours() < 10 ? '0' : '') + now.getHours();
    var min = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    var timeStr = hh + ":" + min;
    
    var dd = ("0"+now.getDate()).slice(-2);
    var mm = ("0"+(now.getMonth()+1)).slice(-2);
    var yyyy = now.getFullYear();
    var accessDate = yyyy + "-" + mm + "-" + dd; // Formato sicuro YYYY-MM-DD
    
    try {
        var sqlCheck = "SELECT ID, Entrata1, Uscita1, Entrata2, Uscita2 FROM tblOrePresenze WHERE Utente = '" + loggedUser.replace(/'/g, "''") + "' AND Year(DataLavoro) = " + yyyy + " AND Month(DataLavoro) = " + parseInt(mm,10) + " AND Day(DataLavoro) = " + parseInt(dd,10);
        var res = queryAccessDB(sqlCheck);
        
        var sqlUpdate = "";
        var azione = "";
        
        if(res && res.length > 0) {
            var rec = res[0];
            if(!rec.Entrata1 || rec.Entrata1 === "") {
                sqlUpdate = "UPDATE tblOrePresenze SET Entrata1 = '" + timeStr + "' WHERE ID = " + rec.ID;
                azione = "ENTRATA 1";
            } else if(!rec.Uscita1 || rec.Uscita1 === "") {
                sqlUpdate = "UPDATE tblOrePresenze SET Uscita1 = '" + timeStr + "' WHERE ID = " + rec.ID;
                azione = "USCITA 1";
            } else if(!rec.Entrata2 || rec.Entrata2 === "") {
                sqlUpdate = "UPDATE tblOrePresenze SET Entrata2 = '" + timeStr + "' WHERE ID = " + rec.ID;
                azione = "ENTRATA 2";
            } else if(!rec.Uscita2 || rec.Uscita2 === "") {
                sqlUpdate = "UPDATE tblOrePresenze SET Uscita2 = '" + timeStr + "' WHERE ID = " + rec.ID;
                azione = "USCITA 2";
            } else {
                alert("Hai già completato i 4 slot di timbratura (Entrata/Uscita mattina e pomeriggio) per oggi.");
                return;
            }
        } else {
            // Crea record (Riempendo tutti i campi default per evitare errori silenziosi di Access)
            sqlUpdate = "INSERT INTO tblOrePresenze ([DataLavoro], [Entrata1], [Uscita1], [Entrata2], [Uscita2], [OreLavorate], [OreRecupero], [Permessi], [Ferie], [Malattia], [Legge104], [Recuperato], [Note], [NotePrivate], [DataInserimento], [Utente]) VALUES (#" + accessDate + "#, '" + timeStr + "', '', '', '', 0, 0, 0, 0, 0, 0, 0, '', '', Now(), '" + loggedUser.replace(/'/g, "''") + "')";
            azione = "ENTRATA 1";
        }
        
        if(sqlUpdate !== "") {
            var succ = queryAccessDB(sqlUpdate, true);
            if(succ) {
                var lbl = document.getElementById("lblUltimaTimbratura");
                if (lbl) lbl.innerHTML = "Timbratura " + azione + " effettuata alle <b style='color:#38bdf8; font-size:11px;'>" + timeStr + "</b>";
                try { var audio = new Audio("assets/sounds/success.mp3"); audio.play(); } catch(e) {}
                alert("✅ TIMBRATURA REGISTRATA NEL DATABASE!\n\n" + timeStr + " - " + loggedUser + " [" + azione + "]");
                
                // Aggiorna tabella visualizzata se possibile
                if(typeof CaricaDatiMese === 'function' && typeof currentMeseStr !== 'undefined') {
                    CaricaDatiMese(currentMeseStr);
                }
            } else {
                alert("ERRORE: Impossibile scrivere la timbratura nel DB Access.");
            }
        }
    } catch(e) {
        alert("Errore di Comunicazione DB Timbratore: " + e.message);
    }
}

function VerificaPermessiDB() {
    try {
        // Verifica permessi, abilitazione e recupero orari standard nel DB
        var sql = "SELECT Abilitato, StdE1, StdU1, StdE2, StdU2 FROM tblUtenti WHERE LCase(Utente) = '" + loggedUser.toLowerCase().replace(/'/g, "''") + "'";
        var res = queryAccessDB(sql);
        
        if (res && res.length > 0) {
            isAbilitato = (res[0].Abilitato === "Si");
            // Carica Orari Standard (se definiti)
            if (res[0].StdE1) userDefaults.e1 = res[0].StdE1;
            if (res[0].StdU1) userDefaults.u1 = res[0].StdU1;
            if (res[0].StdE2) userDefaults.e2 = res[0].StdE2;
            if (res[0].StdU2) userDefaults.u2 = res[0].StdU2;
        } else {
            // Se l'utente non esiste nel DB, per sicurezza verifichiamo se è l'ADMIN di sistema
            isAbilitato = (loggedUser.toUpperCase() === "ADMIN");
        }

        // Definizione Amministratori
        if (loggedUser.toUpperCase() === "ADMIN" || loggedUser.toUpperCase() === "CIRO MILELLA") {
            isAdmin = true;
            isAbilitato = true; // L'Admin è sempre abilitato
        }

        if (!isAbilitato) {
            alert("ACCESSO NEGATO: Il tuo profilo non è abilitato all'uso del programa.\nContatta l'Amministratore.");
            Script_BackToDashboard();
        }
    } catch(e) { 
        loggedUser = "SCONOSCIUTO"; 
        isAdmin = false;
        isAbilitato = false;
    }
}

function StartAnalogClock() {
    function update() {
        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        var s = now.getSeconds();
        
        var hDeg = (h * 30) + (m / 2);
        var mDeg = (m * 6);
        var sDeg = (s * 6);
        
        try {
            document.getElementById("clock-hour").style.transform = "translateX(-50%) rotate(" + hDeg + "deg)";
            document.getElementById("clock-minute").style.transform = "translateX(-50%) rotate(" + mDeg + "deg)";
            document.getElementById("clock-second").style.transform = "translateX(-50%) rotate(" + sDeg + "deg)";
        } catch(e) {}
    }
    setInterval(update, 1000);
    update();
}

function Script_BackToDashboard() {
    if (!CheckUnsavedChanges()) return; // Ferma in caso di modifiche non salvate cancellate
    isNavigating = true;
    var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
    if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
    shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    window.close();
}

/* --- DATABASE CORE --- */
function queryAccessDB(sql, isUpdate, silenceErrors) {
    try {
        var http = null;
        if (typeof ActiveXObject !== "undefined") {
            try { http = new ActiveXObject("WinHttp.WinHttpRequest.5.1"); } catch(e) {}
        }
        if (!http && typeof XMLHttpRequest !== "undefined") {
            http = new XMLHttpRequest();
        }
        if (!http) return isUpdate ? false : [];

        http.open("POST", "http://127.0.0.1:3002/query", false); // Synchronous
        if (http.setRequestHeader) {
            http.setRequestHeader("Content-Type", "application/json");
        }
        http.send(JSON.stringify({ sql: sql }));
        
        var status = http.status || http.Status;
        var respText = http.responseText || http.ResponseText;
        
        if (status === 200) {
            var res = JSON.parse(respText);
            return isUpdate ? true : res;
        } else {
            if (!silenceErrors) alert("Errore DB Query:\n" + respText + "\n\nQuery: " + sql);
            return isUpdate ? false : [];
        }
    } catch(errReq) {
        if (!silenceErrors) alert("Errore di connessione al Bridge locale (Assicurarsi che il server sia avviato):\n" + errReq.message + "\n\nQuery: " + sql);
        return isUpdate ? false : [];
    }
}

function sqlEscape(str) { return str ? String(str).replace(/'/g, "''") : ""; }

function IsItalianHoliday(d, m, y) {
    // Aggiunto "8-5" (San Nicola, patrono di Bari) su esplicita richiesta utente
    var fixed = ["1-1", "6-1", "25-4", "1-5", "8-5", "2-6", "15-8", "1-11", "8-12", "25-12", "26-12"];
    if (fixed.indexOf(d + "-" + m) !== -1) return true;
    var pasquette = { "2025": "21-4", "2026": "6-4", "2027": "29-3", "2028": "17-4", "2029": "2-4", "2030": "22-4" };
    return pasquette[y] === d + "-" + m;
}

function VerificaIntegritaDB() {
    try { 
        queryAccessDB("SELECT TOP 1 ID FROM tblOrePresenze"); 
    } catch (e) {
        try {
            var sqlCreate = "CREATE TABLE tblOrePresenze (ID COUNTER PRIMARY KEY, DataLavoro DATETIME, Entrata1 TEXT(10), Uscita1 TEXT(10), Entrata2 TEXT(10), Uscita2 TEXT(10), OreLavorate DOUBLE, OreRecupero DOUBLE, Permessi DOUBLE, Ferie BIT, Malattia BIT, Legge104 BIT, Recuperato BIT, Note MEMO, DataInserimento DATETIME)";
            queryAccessDB(sqlCreate, true);
        } catch (ex) { alert("Errore creazione tabella: " + ex.message); }
    }
    
    // Assicuriamoci che le nuove colonne siano presenti anche in tabelle esistenti (Silenziati altrimenti sollevano allerta SQL duplicata se esistono)
    try { queryAccessDB("ALTER TABLE tblOrePresenze ADD COLUMN Malattia BIT", true, true); } catch(e1){}
    try { queryAccessDB("ALTER TABLE tblOrePresenze ADD COLUMN Legge104 BIT", true, true); } catch(e2){}
    try { queryAccessDB("ALTER TABLE tblOrePresenze ADD COLUMN Utente TEXT(100)", true, true); } catch(e3){}
    try { queryAccessDB("ALTER TABLE tblOrePresenze ADD COLUMN NotePrivate MEMO", true, true); } catch(eNote){}
    
    // Migrazione tblUtenti per Orario Standard
    try { queryAccessDB("ALTER TABLE tblUtenti ADD COLUMN StdE1 TEXT(10)", true, true); } catch(e4){}
    try { queryAccessDB("ALTER TABLE tblUtenti ADD COLUMN StdU1 TEXT(10)", true, true); } catch(e5){}
    try { queryAccessDB("ALTER TABLE tblUtenti ADD COLUMN StdE2 TEXT(10)", true, true); } catch(e6){}
    try { queryAccessDB("ALTER TABLE tblUtenti ADD COLUMN StdU2 TEXT(10)", true, true); } catch(e7){}
}

/* --- LOGICA DI CALCOLO --- */
function FormattaMinuti(minTot) {
    var segno = minTot < 0 ? "-" : "";
    var m = Math.abs(Math.round(minTot));
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return segno + h + "h " + (mm < 10 ? "0" : "") + mm + "m";
}

function CalcolaOreEffettive(e1, u1, e2, u2) {
    function diffMin(ini, fine) {
        if (!ini || !fine) return 0;
        var pI = ini.split(":"); var pF = fine.split(":");
        var tI = (parseInt(pI[0], 10) || 0) * 60 + (parseInt(pI[1], 10) || 0);
        var tF = (parseInt(pF[0], 10) || 0) * 60 + (parseInt(pF[1], 10) || 0);
        return tF >= tI ? tF - tI : (tF + 1440) - tI;
    }
    var res = (e1 && u2 && !u1 && !e2) ? diffMin(e1, u2) : diffMin(e1, u1) + diffMin(e2, u2);
    return isNaN(res) ? 0 : res;
}

/* --- UI ENGINE --- */
var currentTPTarget = null;
var selectedTPHour = null;
var selectedTPMinute = null;

var isGlobalView = false;

function FormattaOraInput(val) {
    if (!val) return "";
    val = val.trim().replace(/[\.,]/g, ":"); // Sostituisce punti e virgole con i due punti
    
    // Rileva numeri interi o concatenati (es. "9", "09", "0900", "930")
    if (/^\d+$/.test(val)) {
        if (val.length === 1 || val.length === 2) {
            var h = parseInt(val, 10);
            if (h >= 0 && h < 24) return (h < 10 ? "0" : "") + h + ":00";
        }
        if (val.length === 3) { // es. "930" -> "09:30"
            var h = parseInt(val.substring(0, 1), 10);
            var m = parseInt(val.substring(1), 10);
            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                return "0" + h + ":" + (m < 10 ? "0" : "") + m;
            }
        }
        if (val.length === 4) { // es. "0930" o "1800"
            var h = parseInt(val.substring(0, 2), 10);
            var m = parseInt(val.substring(2), 10);
            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
            }
        }
    }
    
    // Rileva orari con i due punti (es. "9:30", "09:30", "9:5")
    if (val.indexOf(":") !== -1) {
        var parts = val.split(":");
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) || 0;
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
            return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
        }
    }
    
    return ""; // Formato non riconosciuto
}

function InizializzaInterfaccia() {
    var ribbonModuli = document.getElementById("nav-moduli");
    if (ribbonModuli) ribbonModuli.style.display = "flex";

    var btnAdmin = document.getElementById("btnAdminGlobal");
    var filterBox = document.getElementById("adminUserFilterBox");

    if (isAdmin) {
        if (btnAdmin) {
            btnAdmin.style.display = "inline-flex";
            btnAdmin.onclick = function() { ToggleGlobalView(this); };
        }
        
        // Popola Filter Box per Admin
        PopolaFiltroProfiliAdmin();
    } else {
        if (btnAdmin) btnAdmin.style.display = "none";
        if (filterBox) filterBox.style.display = "none";
    }
    
    var triggers = ["cmbE1", "cmbU1", "cmbE2", "cmbU2", "txtPermessi", "chkFerie", "chkMalattia", "chkL104", "chkRecuperato"];
    for (var i = 0; i < triggers.length; i++) {
        var id = triggers[i];
        var el = document.getElementById(id);
        
        // Gestione esclusività per i giustificativi
        if (id === "chkFerie" || id === "chkMalattia" || id === "chkL104" || id === "chkRecuperato") {
            el.onclick = function() {
                if (this.checked) {
                    var group = ["chkFerie", "chkMalattia", "chkL104", "chkRecuperato"];
                    for (var j = 0; j < group.length; j++) {
                        if (group[j] !== this.id) document.getElementById(group[j]).checked = false;
                    }
                }
                TriggerUpdate();
            };
        } else {
            el.onchange = TriggerUpdate;
        }
        
        // Collega i campi ORA al Time Picker con DOPPIO CLICK MANUALE (richiesta utente)
        if (id.indexOf("cmb") === 0) {
            el.readOnly = false; // Permette di scrivere a mano
            el.style.cursor = "text";
            
            el.lastClickTime = 0;
            el.onclick = (function(tid) { 
                return function() { 
                    var now = new Date().getTime();
                    if (now - this.lastClickTime < 400) {
                        // DOPPIO CLICK!
                        OpenTimePicker(tid);
                        this.lastClickTime = 0;
                    } else {
                        this.lastClickTime = now;
                    }
                }; 
            })(id);
            
            el.onblur = function() {
                var formatted = FormattaOraInput(this.value);
                if (this.value.trim() !== "" && formatted === "") {
                    alert("Formato orario non valido.\nInserisci ad esempio: 9, 09:30, 930 o 9.30");
                    this.value = "";
                } else {
                    this.value = formatted;
                }
                TriggerUpdate();
            };
            
            el.title = "Scrivi l'ora o fai due click veloci per aprire l'orologio";
        }
    }
    if (document.getElementById("txtPermessi")) document.getElementById("txtPermessi").onkeyup = TriggerUpdate;
    
    // Assegnazione sicura eventi Pulsanti
    var btnS = document.getElementById("btnSalva"); if (btnS) btnS.onclick = ActionSalva;
    var btnE = document.getElementById("btnElimina"); if (btnE) btnE.onclick = ActionElimina;
    var btnP = document.getElementById("btnPDF"); if (btnP) btnP.onclick = function() { ActionExport('pdf'); };
    var btnW = document.getElementById("btnActionWord"); if (btnW) btnW.onclick = function() { ActionExport('word'); };
    var btnC = document.getElementById("btnChiudi"); if (btnC) btnC.onclick = Script_BackToDashboard;

    document.getElementById("btnCalPrev").onclick = function() { CalendarNav(-1); };
    document.getElementById("btnCalNext").onclick = function() { CalendarNav(1); };
    document.getElementById("calMonthTitle").onclick = ShowMonthPicker; // Collega titolo calendario
    document.getElementById("calMonthTitle").style.cursor = "pointer";
    
    InitTPData();
}

/* --- ADMIN ENGINE --- */
function ToggleGlobalView(btn) {
    if (!isAdmin) return;
    
    isGlobalView = !isGlobalView;
    if (isGlobalView) {
        btn.style.background = "#ff9800";
        btn.style.color = "white";
        btn.innerHTML = '<img src="https://img.icons8.com/fluency/48/lock-orientation.png" style="width:18px"> Ritorna a Vista Privata';
    } else {
        btn.style.background = "#fff4e5";
        btn.style.color = "black";
        btn.innerHTML = '<img src="https://img.icons8.com/fluency/48/checked-user-male.png" style="width:18px"> Sblocco Totale Ore';
    }
    
    UpdateAdminFilterVisibility();
    CaricaDatiMese(currentMeseStr);
}

function UpdateAdminFilterVisibility() {
    var box = document.getElementById("adminUserFilterBox");
    if (box) {
        box.style.display = (isGlobalView && isAdmin) ? "flex" : "none";
    }
}

function PopolaFiltroProfiliAdmin() {
    var cmb = document.getElementById("cmbAdminUserFilter");
    if (!cmb) return;
    
    // Pulisci tranne il primo
    while (cmb.options.length > 1) cmb.remove(1);
    
    try {
        var sql = "SELECT DISTINCT Utente FROM tblUtenti ORDER BY Utente ASC";
        var res = queryAccessDB(sql);
        for (var i = 0; i < res.length; i++) {
            var opt = document.createElement("option");
            opt.value = res[i].Utente;
            opt.text = res[i].Utente;
            cmb.add(opt);
        }
        
        // Collega l'evento di cambio filtro per aggiornare gli orari standard
        cmb.onchange = function() {
            var selected = this.value;
            if (selected === "TUTTI") {
                // Ripristina defaults del loggato o sistema
                AggiornaOrariStandardProfilo(loggedUser);
            } else {
                AggiornaOrariStandardProfilo(selected);
            }
            CaricaDatiMese(currentMeseStr);
        };
        
    } catch(e) {}
}

/**
 * Recupera dal DB gli orari standard del profilo selezionato
 * e aggiorna i suggerimenti dell'editor.
 */
function AggiornaOrariStandardProfilo(nomeUtente) {
    try {
        var sql = "SELECT StdE1, StdU1, StdE2, StdU2 FROM tblUtenti WHERE LCase(Utente) = '" + nomeUtente.toLowerCase().replace(/'/g, "''") + "'";
        var res = queryAccessDB(sql);
        
        // Valori di backup (Sistema)
        var sysDef = { e1: "09:00", u1: "13:30", e2: "14:30", u2: "17:30" };
        
        if (res && res.length > 0) {
            userDefaults.e1 = res[0].StdE1 || sysDef.e1;
            userDefaults.u1 = res[0].StdU1 || sysDef.u1;
            userDefaults.e2 = res[0].StdE2 || sysDef.e2;
            userDefaults.u2 = res[0].StdU2 || sysDef.u2;
        } else {
            userDefaults = sysDef;
        }
        
    } catch(e) { }
}

/* --- LOGICA SELETTORE MESE (VIGNETTA PRO) --- */
function ShowMonthPicker() {
    document.getElementById("pickerYearTitle").innerText = calViewYear;
    var grid = document.getElementById("monthGrid");
    grid.innerHTML = "";
    
    // Recupera mese e anno correnti per highlight
    var p = currentMeseStr.split(" ");
    var selMese = p[0];
    var selAnno = parseInt(p[1], 10);

    for (var i = 0; i < nomeMesi.length; i++) {
        var mNome = nomeMesi[i];
        var btn = document.createElement("button");
        btn.className = "menu-month-btn";
        if (mNome === selMese && calViewYear === selAnno) btn.classList.add("selected");
        
        btn.innerText = mNome;
        btn.onclick = (function(idx) { return function() { SwitchMonth(idx); }; })(i);
        grid.appendChild(btn);
    }
    
    document.getElementById("monthPickerOverlay").style.display = "flex";
}

function ChangeYearPicker(dir) {
    calViewYear += dir;
    ShowMonthPicker(); // Refresh griglia e titolo anno
}

function CloseMonthPicker() {
    document.getElementById("monthPickerOverlay").style.display = "none";
}

function SwitchMonth(mIdx) {
    var targetMeseStr = nomeMesi[mIdx] + " " + calViewYear;
    
    var cmb = document.getElementById("cmbMeseAnno");
    var found = false;
    for (var i = 0; i < cmb.options.length; i++) {
        if (cmb.options[i].value === targetMeseStr) {
            cmb.selectedIndex = i;
            found = true;
            break;
        }
    }
    
    if (!found) {
        var opt = document.createElement("option");
        opt.value = targetMeseStr; opt.text = targetMeseStr;
        cmb.insertBefore(opt, cmb.firstChild);
        cmb.selectedIndex = 0;
    }
    
    CaricaDatiMese(targetMeseStr);
    CloseMonthPicker();
}

function InitTPData() {
    var hCont = document.getElementById("tp-hours");
    var mCont = document.getElementById("tp-minutes");
    hCont.innerHTML = ""; mCont.innerHTML = "";

    for (var h = 7; h <= 21; h++) {
        var val = (h < 10 ? "0" : "") + h;
        var div = document.createElement("div");
        div.className = "tp-item"; div.innerText = val;
        
        (function(v) { 
            var tpClickTimer = null;
            div.onclick = function() { 
                var self = this;
                if (tpClickTimer) {
                    // DOPPIO CLICK SULL'ORA -> HH:00
                    clearTimeout(tpClickTimer);
                    tpClickTimer = null;
                    document.getElementById(currentTPTarget).value = v + ":00";
                    CloseTimePicker();
                    TriggerUpdate();
                } else {
                    tpClickTimer = setTimeout(function() {
                        SelectTPItem('hour', v, self);
                        tpClickTimer = null;
                    }, 350);
                }
            }; 
        })(val);

        hCont.appendChild(div);
    }

    for (var m = 0; m <= 55; m += 5) {
        var val = (m < 10 ? "0" : "") + m;
        var div = document.createElement("div");
        div.className = "tp-item"; div.innerText = val;
        
        (function(v) {
            var tpMClickTimer = null;
            div.onclick = function() {
                var self = this;
                if (tpMClickTimer) {
                    // DOPPIO CLICK SUL MINUTO -> Completa e chiudi
                    clearTimeout(tpMClickTimer);
                    tpMClickTimer = null;
                    SelectTPItem('minute', v, self);
                } else {
                    tpMClickTimer = setTimeout(function() {
                        SelectTPItem('minute', v, self);
                        tpMClickTimer = null;
                    }, 350);
                }
            };
        })(val);
        
        mCont.appendChild(div);
    }
}

function OpenTimePicker(id) {
    currentTPTarget = id;
    selectedTPHour = null;
    selectedTPMinute = null;
    
    // Reset selection styles
    var items = document.querySelectorAll(".tp-item");
    for(var i=0; i<items.length; i++) items[i].classList.remove("selected");
    
    document.getElementById("tpOverlay").style.display = "flex";
}

function SelectTPItem(type, val, el) {
    var parent = el.parentNode;
    var siblings = parent.getElementsByTagName("div");
    for(var i=0; i<siblings.length; i++) siblings[i].classList.remove("selected");
    el.classList.add("selected");

    if (type === 'hour') selectedTPHour = val;
    else selectedTPMinute = val;

    if (selectedTPHour && selectedTPMinute) {
        var finalTime = selectedTPHour + ":" + selectedTPMinute;
        document.getElementById(currentTPTarget).value = finalTime;
        CloseTimePicker();
        TriggerUpdate();
    }
}

function CloseTimePicker() {
    document.getElementById("tpOverlay").style.display = "none";
}

function CaricaListaMesi() {
    var cmb = document.getElementById("cmbMeseAnno");
    var d = new Date();
    // Mostriamo i prossimi 2 mesi e i passati 15 per permettere la pre-compilazione
    for (var i = -2; i < 15; i++) {
        var temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
        var val = nomeMesi[temp.getMonth()] + " " + temp.getFullYear();
        var opt = document.createElement("option");
        opt.value = val; opt.text = val; cmb.appendChild(opt);
    }
    cmb.onchange = function() { CaricaDatiMese(this.value); };
    
    // Seleziona il mese corrente (che ora è in posizione 2 grazie a i = -2)
    cmb.selectedIndex = 2;
    CaricaDatiMese(cmb.value);
}

function CaricaDatiMese(meseAnno) {
    if (currentMeseStr !== meseAnno) {
        selectedGiornoNum = 0;
    }
    currentMeseStr = meseAnno;
    originalState = null; // Sospende il tracciamento durante la ricostruzione della griglia
    var list = document.getElementById("lstPresenzeBody");
    list.innerHTML = "";
    var p = meseAnno.split(" ");
    var mIdx = mesiCol[p[0]] - 1;
    var year = parseInt(p[1], 10);
    var numGiorni = new Date(year, mIdx + 1, 0).getDate();
    
    // LOGICA DI FILTRAGGIO SICURA (Enterprise Gold)
    var userFilter = "";
    if (isGlobalView && isAdmin) {
        var adminFilterVal = document.getElementById("cmbAdminUserFilter").value;
        if (adminFilterVal !== "TUTTI") {
            userFilter = " AND LCase(Utente) = '" + adminFilterVal.trim().toLowerCase().replace(/'/g, "''") + "'";
        }
        // Se è 'TUTTI', non aggiungiamo filtri (vista globale totale)
    } else {
        // Obbligatorio per utenti normali o se la vista globale è spenta
        userFilter = " AND LCase(Utente) = '" + loggedUser.trim().toLowerCase().replace(/'/g, "''") + "'";
    }

    var sql = "SELECT * FROM tblOrePresenze WHERE Month(DataLavoro) = " + (mIdx + 1) + " AND Year(DataLavoro) = " + year + userFilter + " ORDER BY DataLavoro";
    var dbRes = queryAccessDB(sql);

    // Gestione visibilità pulsante Riparatore (solo Admin e solo se non è su TUTTI)
    var btnRepair = document.getElementById("btnRepairOrphans");
    if (btnRepair) {
        if (isAdmin && isGlobalView && adminFilterVal !== "TUTTI") {
            btnRepair.style.display = "inline-flex";
        } else {
            btnRepair.style.display = "none";
        }
    }

    var dbMap = {};
    for (var i = 0; i < dbRes.length; i++) {
        var r = dbRes[i];
        var dStr = r.DataLavoro ? r.DataLavoro.toString().replace(/-/g, "/") : "";
        var dDate = dStr ? new Date(dStr) : null;
        if (dDate && !isNaN(dDate.getTime())) {
            dbMap[dDate.getDate()] = r;
        }
    }
    currentDbMap = dbMap; // Salva globalmente per l'export

    var progressivoMin = 0;
    var totRecuperoMese = 0;
    var totOreLavorateMese = 0;
    var countFerie = 0;
    var countMalattia = 0;
    var countL104 = 0;
    var countLavorati = 0;
    var totPermessiMin = 0;

    for (var i = 1; i <= numGiorni; i++) {
        var dt = new Date(year, mIdx, i);
        var dData = dbMap[i] || {};
        var tr = document.createElement("tr");
        
        if (isTrueVal(dData.Ferie)) countFerie++;
        if (isTrueVal(dData.Malattia)) countMalattia++;
        if (isTrueVal(dData.Legge104)) countL104++;
        if (dData.Entrata1 || dData.Uscita1 || dData.Entrata2 || dData.Uscita2) countLavorati++;
        if (parseFloat(dData.Permessi) > 0) totPermessiMin += (parseFloat(dData.Permessi) * 60);
        
        var dw = dt.getDay();
        var isFestivo = IsItalianHoliday(i, mIdx + 1, year);
        if (dw === 0 || isFestivo) tr.classList.add("is-holiday");
        else if (dw === 6) tr.classList.add("is-weekend");
        
        if (i === new Date().getDate() && mIdx === new Date().getMonth() && year === new Date().getFullYear()) {
            tr.classList.add("is-today");
        }
        
        var rowClickTimer = null;
        tr.onclick = (function(gg, obj) { 
            return function() { 
                if (rowClickTimer) {
                    // DOPPIO CLICK SULLA RIGA
                    clearTimeout(rowClickTimer);
                    rowClickTimer = null;
                    ActionQuickStdSalva(gg);
                } else {
                    rowClickTimer = setTimeout(function() {
                        SelectGiorno(gg, obj);
                        rowClickTimer = null;
                    }, 350);
                }
            }; 
        })(i, dData);

        tr.title = "Click: Seleziona | Doppio click: Caricamento rapido e Salvataggio";

        var recMin = (parseFloat(dData.OreRecupero) || 0) * 60;
        if (dData.Recuperato) progressivoMin = 0; else progressivoMin += recMin;
        totRecuperoMese += parseFloat(dData.OreRecupero) || 0;
        totOreLavorateMese += parseFloat(dData.OreLavorate) || 0;

        // --- LOGICA RILEVAMENTO INCOMPLETE ---
        var isIncomplete = false;
        if (dData.ID) {
            var todayStart = new Date();
            todayStart.setHours(0,0,0,0);
            if (dt.getTime() < todayStart.getTime()) {
                if ((dData.Entrata1 && !dData.Uscita1) || (dData.Entrata2 && !dData.Uscita2)) {
                    isIncomplete = true;
                }
            }
        }
        if (isIncomplete) {
            tr.classList.add("row-incomplete");
            tr.title += " | ATTENZIONE: Orari di uscita incompleti!";
        }

        var warnIcon = isIncomplete ? ' <span style="color:#ef4444; cursor:help; margin-left:2px;" title="Uscita mancante!">⚠️</span>' : '';
        var html = '<td>' + (i < 10 ? '0' : '') + i + warnIcon + '</td>';
        html += '<td style="font-size:10px; color:#666">' + ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"][dw] + '</td>';
        
        // --- COLONNA AZIONI DINAMICA ---
        var btnActions = '<div class="actions-cell" style="text-align:center; display:flex; justify-content:center; gap:8px;">';
        if (dData.ID) {
            btnActions += '<button class="row-btn" title="Modifica" style="border:none; background:none; cursor:pointer;"><img src="https://img.icons8.com/fluency/48/edit-property.png" style="width:18px;"></button>';
            btnActions += '<button class="row-btn" onclick="window.event.cancelBubble=true; ActionSalvaRapido(' + i + ')" title="Salva Rapido" style="border:none; background:none; cursor:pointer;"><img src="https://img.icons8.com/fluency/48/save.png" style="width:18px;"></button>';
            btnActions += '<button class="row-btn" onclick="window.event.cancelBubble=true; ActionEliminaRapida(' + dData.ID + ')" title="Elimina" style="border:none; background:none; cursor:pointer;"><img src="https://img.icons8.com/fluency/48/delete-trash.png" style="width:18px;"></button>';
        } else {
            btnActions += '<button class="row-btn" onclick="window.event.cancelBubble=true; ActionSalvaRapido(' + i + ')" title="Salva Rapido" style="border:none; background:none; cursor:pointer;"><img src="https://img.icons8.com/fluency/48/save.png" style="width:18px;"></button>';
        }
        btnActions += '</div>';
        html += '<td style="text-align:center;">' + btnActions + '</td>';

        html += '<td style="font-weight:700;">' + (dData.Entrata1 || "") + '</td>';
        html += '<td style="font-weight:700;">' + (dData.Uscita1 || "") + '</td>';
        html += '<td style="font-weight:700;">' + (dData.Entrata2 || "") + '</td>';
        html += '<td style="font-weight:700;">' + (dData.Uscita2 || "") + '</td>';
        
        var recCl = recMin >= 0 ? "cell-recupero" : "cell-debito";
        html += '<td class="' + recCl + '">' + FormattaMinuti(recMin) + (dData.Recuperato ? ' <i class="fa fa-check-circle"></i>' : '') + '</td>';
        html += '<td style="font-weight:700;">' + FormattaMinuti(progressivoMin) + '</td>';
        
        // --- NUOVA COLONNA PROFILO ---
        var dispUser = dData.Utente || "";
        var userStyle = (dispUser.toUpperCase() !== loggedUser.toUpperCase()) ? "color:#d97706; font-weight:bold;" : "color:#1e293b; font-weight:700;";
        html += '<td style="font-size:10px; ' + userStyle + '">' + dispUser + '</td>';

        var badges = "";
        if (isTrueVal(dData.Ferie)) { badges += '<span class="badge-grid b-ferie">FERIE</span> '; tr.style.backgroundColor = "#f0f9ff"; }
        if (isTrueVal(dData.Malattia)) { badges += '<span class="badge-grid b-malattia">MALATTIA</span> '; tr.style.backgroundColor = "#fff5f5"; }
        if (isTrueVal(dData.Legge104)) { badges += '<span class="badge-grid b-104">L.104</span> '; tr.style.backgroundColor = "#f5f3ff"; }
        if (dData.NotePrivate) { badges += '<span class="badge-grid" style="background:#fff4e5; color:#b45309; border:1px solid #ffcc80;" title="' + dData.NotePrivate.replace(/"/g, '&quot;') + '">🔒 NOTA PRIVATA</span> '; }

        // --- COLONNA NOTE / IDENTIFICAZIONE PROFILO ---
        var noteContent = (dData.Note || "");
        if (isGlobalView && dData.Utente && dData.Utente.toUpperCase() !== loggedUser.toUpperCase()) {
            noteContent = '<span style="color:#d97706; font-weight:bold;">[PROFILO: ' + dData.Utente + ']</span> ' + noteContent;
            tr.style.borderLeft = "4px solid #f59e0b"; // Evidenzia riga non appartenente all'utente
        }

        html += '<td style="font-size:10px; color:#1e293b; font-weight:600">' + badges + noteContent + '</td>';
        
        tr.innerHTML = html;
        list.appendChild(tr);
    }

    // Animazione Premium Sidebar Mensile (Count-Up 2026)
    AnimateCounterTime(document.getElementById("lblBadgeCount"), totRecuperoMese * 60);
    if (document.getElementById("lblBadgeLavorateTot")) {
        AnimateCounterTime(document.getElementById("lblBadgeLavorateTot"), totOreLavorateMese * 60);
        // CALCOLO TARGET MENSILE (160 ore standard)
        var targetHours = 160;
        var pct = Math.min(100, Math.round((totOreLavorateMese / targetHours) * 100));
        var pb = document.getElementById("progressMensile");
        if (pb) { pb.style.width = pct + "%"; }
        var lblPct = document.getElementById("lblProgressPerc");
        if (lblPct) { lblPct.innerText = pct + "% DI " + targetHours + " ORE (TARGET)"; }
    }

    if (document.getElementById("lblStatGiorniLavorati")) document.getElementById("lblStatGiorniLavorati").innerText = countLavorati + " gg";
    if (document.getElementById("lblStatFerie")) document.getElementById("lblStatFerie").innerText = countFerie + " gg";
    if (document.getElementById("lblStatMalattia")) document.getElementById("lblStatMalattia").innerText = (countMalattia + countL104) + " gg";
    if (document.getElementById("lblStatPermessi")) document.getElementById("lblStatPermessi").innerText = FormattaMinuti(totPermessiMin);
    AggiornaSidebar(year);
    if (calViewMonth === -1) { calViewMonth = mIdx; calViewYear = year; }
    UpdateCalendarDisplay();

    // AUTO-SELEZIONE ALL'APERTURA o mantenimento selezione corrente dopo il salvataggio
    var targetDay = selectedGiornoNum;
    if (targetDay <= 0 || targetDay > numGiorni) {
        // Fallback se non c'è una selezione precedente o se è fuori dai limiti del mese caricato
        if (mIdx === new Date().getMonth() && year === new Date().getFullYear()) {
            targetDay = new Date().getDate();
        } else {
            targetDay = 1;
        }
    }
    SelectGiorno(targetDay, dbMap[targetDay]);

    // Annuncio per screen reader sui dati del mese caricato
    var msgA11y = "Caricato registro per " + meseAnno + ". Totale recupero maturato: " + FormattaMinuti(totRecuperoMese * 60);
    announce(msgA11y);
}

function AggiornaSidebar(year) {
    try {
        var subQ = "(SELECT IIf(IsNull(Max([DataLavoro])), #1900-01-01#, Max([DataLavoro])) FROM tblOrePresenze WHERE [Recuperato] <> 0 AND Utente = '" + sqlEscape(loggedUser) + "')";
        var res = queryAccessDB("SELECT SUM(OreRecupero) as Tot FROM tblOrePresenze WHERE [Recuperato] = False AND [DataLavoro] > " + subQ + " AND Utente = '" + sqlEscape(loggedUser) + "'");
        // Animazione Premium Sidebar Annuale (Count-Up 2026)
        AnimateCounterTime(document.getElementById("lblTotaleCredito"), (res[0].Tot || 0) * 60);

        var resY = queryAccessDB("SELECT SUM(OreRecupero) as TotE FROM tblOrePresenze WHERE Year([DataLavoro]) = " + year + " AND [OreRecupero] > 0 AND Utente = '" + sqlEscape(loggedUser) + "'");
        AnimateCounterTime(document.getElementById("lblAnnuoMat"), (resY[0].TotE || 0) * 60);
        var resU = queryAccessDB("SELECT SUM(OreRecupero) as TotU FROM tblOrePresenze WHERE Year([DataLavoro]) = " + year + " AND [OreRecupero] < 0 AND Utente = '" + sqlEscape(loggedUser) + "'");
        AnimateCounterTime(document.getElementById("lblAnnuoFru"), Math.abs((resU[0].TotU || 0) * 60));
    } catch (e) {}
}

/* --- CALENDARIO --- */
function CalendarNav(dir) {
    calViewMonth += dir;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    // Sincronizza automaticamente la griglia principale con la navigazione del calendario (UX Premium)
    SwitchMonth(calViewMonth);
}

function UpdateCalendarDisplay() {
    document.getElementById("calMonthTitle").innerText = nomeMesi[calViewMonth] + " " + calViewYear;
    var container = document.getElementById("miniCalendar");
    // Classi speciali cal-th-weekend e cal-th-holiday per evidenziare le intestazioni di Sabato e Domenica
    var html = '<table class="cal-table-grid"><thead><tr><th>LU</th><th>MA</th><th>ME</th><th>GI</th><th>VE</th><th class="cal-th-weekend">SA</th><th class="cal-th-holiday">DO</th></tr></thead><tbody><tr>';
    var firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
    if (firstDay === 0) firstDay = 7;
    var lastDay = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    for (var i = 1; i < firstDay; i++) html += '<td></td>';
    var col = firstDay;
    
    // Estrai mese e anno attivi visualizzati nella griglia principale per disegnare i puntini di presenza dati
    var isCurrentGridMonth = false;
    if (currentMeseStr) {
        var gridP = currentMeseStr.split(" ");
        var gridMIdx = mesiCol[gridP[0]] - 1;
        var gridYear = parseInt(gridP[1], 10);
        isCurrentGridMonth = (calViewMonth === gridMIdx && calViewYear === gridYear);
    }

    for (var d = 1; d <= lastDay; d++) {
        if (col > 7) { html += '</tr><tr>'; col = 1; }
        var cls = "cal-day-cell";
        
        // Identificazione Festività (Nazionali + Patronali Bari 'S. Nicola' + Pasquetta)
        var isFestivo = IsItalianHoliday(d, calViewMonth + 1, calViewYear);
        
        if (col === 6) {
            cls += " is-weekend"; // Sabato: Evidenziazione soft slate
        } else if (col === 7 || isFestivo) {
            cls += " is-holiday"; // Domenica e Festivi: Evidenziazione calda festiva
        }

        if (d === new Date().getDate() && calViewMonth === new Date().getMonth() && calViewYear === new Date().getFullYear()) cls += " today";
        
        // Applica classe active-selection se il giorno coincide con la selezione corrente nella griglia
        if (isCurrentGridMonth && d === selectedGiornoNum) cls += " active-selection";
        
        // Iniezione Heatmap Dots: micro-segnalatori grafici per far vedere a colpo d'occhio i giorni registrati
        var dotHtml = "";
        if (isCurrentGridMonth && currentDbMap && currentDbMap[d]) {
            var dbRec = currentDbMap[d];
            var dotColor = "#10b981"; // Smeraldo standard per ore lavorate
            if (isTrueVal(dbRec.Ferie) || isTrueVal(dbRec.Malattia) || isTrueVal(dbRec.Legge104)) {
                dotColor = "#f59e0b"; // Oro ambra per ferie e permessi speciali
            }
            dotHtml = '<span class="cal-dot" style="background-color:' + dotColor + ' !important;"></span>';
        }

        html += '<td><span class="' + cls + '" id="cal_day_' + d + '" onclick="SelectGiorno(' + d + ', null)" style="position:relative;">' + d + dotHtml + '</span></td>';
        col++;
    }
    html += '</tr></tbody></table>';
    container.innerHTML = html;
}

/* --- AZIONI --- */
function SelectGiorno(g, data) {
    // Verifica modifiche non salvate PRIMA di procedere col cambio selezione
    if (selectedGiornoNum > 0 && g !== selectedGiornoNum) {
        if (!CheckUnsavedChanges()) {
            return; // Interrompe l'azione e rimane sul giorno corrente
        }
        // In caso di salvataggio avvenuto correttamente, il DB è stato ricaricato: leggiamo i dati aggiornati
        data = (currentDbMap && currentDbMap[g]) ? currentDbMap[g] : null;
    }

    // Aggiorna tracciatore globale per l'evidenziazione attiva del calendario
    selectedGiornoNum = g;

    // Fallback dati critico: se cliccato dal calendario con data=null, recuperiamo i record reali salvati dal database
    if (!data && currentDbMap && currentDbMap[g]) {
        data = currentDbMap[g];
    }

    var rows = document.querySelectorAll("#lstPresenzeBody tr");
    for (var i = 0; i < rows.length; i++) {
        rows[i].classList.remove("row-selected");
    }
    
    if (rows[g-1]) {
        var targetRow = rows[g-1];
        targetRow.classList.add("row-selected");
        
        // SINCRONIZZAZIONE BIDIREZIONALE: Scorre automaticamente la griglia per posizionarla sulla riga selezionata
        try {
            targetRow.scrollIntoView(false); 
        } catch(errScroll) {
            try { targetRow.scrollIntoView(); } catch(errFall) {}
        }
    }

    // SINCRONIZZAZIONE BIDIREZIONALE: Illumina all'istante il cerchietto del giorno sul mini-calendario
    var calCells = document.querySelectorAll(".cal-day-cell");
    for (var c = 0; c < calCells.length; c++) {
        calCells[c].classList.remove("active-selection");
    }
    var activeCal = document.getElementById("cal_day_" + g);
    if (activeCal) {
        activeCal.classList.add("active-selection");
    }

    document.getElementById("lblInfoGiorno").innerText = "MODIFICA GIORNO " + g;
    idRecordCorrente = data ? data.ID : 0;
    
    // Risolve dinamicamente il profilo target per questo giorno (selezionato o dal filtro)
    var targetUser = loggedUser;
    if (data && data.Utente) {
        targetUser = data.Utente;
    } else if (isAdmin && isGlobalView) {
        var filterVal = document.getElementById("cmbAdminUserFilter") ? document.getElementById("cmbAdminUserFilter").value : "TUTTI";
        if (filterVal && filterVal !== "TUTTI") targetUser = filterVal;
    }
    
    // Forza il caricamento sincrono dell'orario standard specifico di QUESTO utente prima di popolare i campi
    AggiornaOrariStandardProfilo(targetUser);
    
    // Mostra l'orario salvato OPPURE quello standard del profilo caricato (se non è Admin!)
    var isTargetAdmin = (targetUser.toLowerCase() === "admin");
    var defE1 = isTargetAdmin ? "" : userDefaults.e1;
    var defU1 = isTargetAdmin ? "" : userDefaults.u1;
    var defE2 = isTargetAdmin ? "" : userDefaults.e2;
    var defU2 = isTargetAdmin ? "" : userDefaults.u2;

    document.getElementById("cmbE1").value = (data && data.Entrata1) ? data.Entrata1 : defE1;
    document.getElementById("cmbU1").value = (data && data.Uscita1) ? data.Uscita1 : defU1;
    document.getElementById("cmbE2").value = (data && data.Entrata2) ? data.Entrata2 : defE2;
    document.getElementById("cmbU2").value = (data && data.Uscita2) ? data.Uscita2 : defU2;
    
    document.getElementById("txtPermessi").value = data ? (data.Permessi || "0") : "0";
    document.getElementById("chkFerie").checked = data ? (data.Ferie || false) : false;
    document.getElementById("chkMalattia").checked = data ? (data.Malattia || false) : false;
    document.getElementById("chkL104").checked = data ? (data.Legge104 || false) : false;
    document.getElementById("chkRecuperato").checked = data ? (data.Recuperato || false) : false;
    document.getElementById("txtProfiloCorrente").value = targetUser;
    document.getElementById("txtNote").value = data ? (data.Note || "") : "";
    document.getElementById("txtNotePrivate").value = data ? (data.NotePrivate || "") : "";
    TriggerUpdate();
    
    // Feedback visivo sui campi popolati
    var ctrls = document.querySelectorAll(".danea-editor-panel-horizontal select, .danea-editor-panel-horizontal input[type=text]");
    for(var i=0; i<ctrls.length; i++) Highlight(ctrls[i]);

    // Accessibilità: Annuncio e focus
    announce("Selezionato giorno " + g);
    if(document.getElementById("cmbE1")) document.getElementById("cmbE1").focus();
    
    // Memorizza lo stato del form pulito per i confronti successivi
    originalState = GetCurrentFormState();
}

// Funzione helper per annunci vocali generici
function announce(text) {
    var el = document.getElementById("lblStatusMessage");
    if(el) {
        var oldText = el.innerText;
        el.innerText = text;
        // Ripristina dopo 5 secondi
        setTimeout(function() { if(el.innerText === text) el.innerText = oldText; }, 5000);
    }
}

function Highlight(ctrl) {
    if(!ctrl) return;
    var val = (ctrl.value || "").trim();
    if(val !== "" && val !== "0" && val !== "--:--") {
        if(ctrl.className.indexOf("populated") === -1) ctrl.className += " populated";
    } else {
        ctrl.className = ctrl.className.replace(/\bpopulated\b/g, "").trim();
    }
}

function TriggerUpdate() {
    var e1 = document.getElementById("cmbE1").value, u1 = document.getElementById("cmbU1").value;
    var e2 = document.getElementById("cmbE2").value, u2 = document.getElementById("cmbU2").value;
    var perms = parseFloat(document.getElementById("txtPermessi").value.replace(",", ".")) || 0;
    var isFerie = document.getElementById("chkFerie").checked || document.getElementById("chkMalattia").checked || document.getElementById("chkL104").checked;
    var isRecuperato = document.getElementById("chkRecuperato").checked;

    var lavMin = CalcolaOreEffettive(e1, u1, e2, u2);
    
    // Aggiorna display ORE LAVORATE (Verde)
    document.getElementById("lblOreLavorate").innerText = FormattaMinuti(lavMin);

    var p = currentMeseStr.split(" ");
    var selRow = document.querySelector(".row-selected");
    var g = selRow ? parseInt(selRow.cells[0].innerText, 10) : 1;
    var dt = new Date(p[1], mesiCol[p[0]]-1, g);
    var isNonLav = (dt.getDay() === 0 || dt.getDay() === 1 || dt.getDay() === 5 || dt.getDay() === 6 || IsItalianHoliday(g, dt.getMonth()+1, dt.getFullYear()));

    var recMin = (isFerie || isRecuperato) ? 0 : (isNonLav ? (lavMin - (perms * 60)) : (lavMin - 450 - (perms * 60)));
    var lblRec = document.getElementById("lblRecuperoOggi");
    lblRec.innerText = (recMin >= 0 ? "+" : "") + FormattaMinuti(recMin);
    lblRec.style.backgroundColor = recMin >= 0 ? "#f0fdf4" : "#fef2f2";
    lblRec.style.color = recMin >= 0 ? "#16a34a" : "#dc2626";
    lblRec.style.borderColor = recMin >= 0 ? "#bbf7d0" : "#fecaca";
    
    // Aggiorna highlight sui controlli che cambiano
    Highlight(document.activeElement);
}

function ActionSalva() {
    if (isSavingInProgress) return false;
    isSavingInProgress = true;
    
    try {
        var selRow = document.querySelector(".row-selected");
        if (!selRow) { isSavingInProgress = false; return false; }
        var g = parseInt(selRow.cells[0].innerText, 10), p = currentMeseStr.split(" ");
        var dt = p[1] + "-" + mesiCol[p[0]] + "-" + g;
        var hE1 = document.getElementById("cmbE1").value, hU1 = document.getElementById("cmbU1").value;
        var hE2 = document.getElementById("cmbE2").value, hU2 = document.getElementById("cmbU2").value;
        var nPerm = parseFloat(document.getElementById("txtPermessi").value.replace(",", ".")) || 0;
        var bFerie = document.getElementById("chkFerie").checked, bRec = document.getElementById("chkRecuperato").checked;
        var bMal = document.getElementById("chkMalattia").checked, b104 = document.getElementById("chkL104").checked;
        var sNote = document.getElementById("txtNote").value;
        var sNotePriv = document.getElementById("txtNotePrivate").value;
        var lavMin = CalcolaOreEffettive(hE1, hU1, hE2, hU2);
        var dTemp = new Date(p[1], mesiCol[p[0]]-1, g);
        
        var isNonLav = (dTemp.getDay() === 0 || dTemp.getDay() === 1 || dTemp.getDay() === 5 || dTemp.getDay() === 6 || IsItalianHoliday(g, dTemp.getMonth()+1, dTemp.getFullYear()));
        var recMin = (bFerie || bRec || bMal || b104) ? 0 : (isNonLav ? (lavMin - (nPerm * 60)) : (lavMin - 450 - (nPerm * 60)));

        // Recupera il profilo correntemente visualizzato nell'editor per l'attribuzione corretta delle ore
        var saveUser = document.getElementById("txtProfiloCorrente").value || loggedUser;

        var sql = idRecordCorrente > 0 ? 
            "UPDATE tblOrePresenze SET [Entrata1]='"+sqlEscape(hE1)+"', [Uscita1]='"+sqlEscape(hU1)+"', [Entrata2]='"+sqlEscape(hE2)+"', [Uscita2]='"+sqlEscape(hU2)+"', [OreLavorate]="+(lavMin/60)+", [OreRecupero]="+(recMin/60)+", [Permessi]="+nPerm+", [Ferie]="+(bFerie?-1:0)+", [Malattia]="+(bMal?-1:0)+", [Legge104]="+(b104?-1:0)+", [Recuperato]="+(bRec?-1:0)+", [Note]='"+sqlEscape(sNote)+"', [NotePrivate]='"+sqlEscape(sNotePriv)+"' WHERE [ID]=" + idRecordCorrente :
            "INSERT INTO tblOrePresenze ([DataLavoro], [Entrata1], [Uscita1], [Entrata2], [Uscita2], [OreLavorate], [OreRecupero], [Permessi], [Ferie], [Malattia], [Legge104], [Recuperato], [Note], [NotePrivate], [DataInserimento], [Utente]) VALUES (#"+dt+"#, '"+sqlEscape(hE1)+"', '"+sqlEscape(hU1)+"', '"+sqlEscape(hE2)+"', '"+sqlEscape(hU2)+"', "+(lavMin/60)+", "+(recMin/60)+", "+nPerm+", "+(bFerie?-1:0)+", "+(bMal?-1:0)+", "+(b104?-1:0)+", "+(bRec?-1:0)+", '"+sqlEscape(sNote)+"', '"+sqlEscape(sNotePriv)+"', Now(), '"+sqlEscape(saveUser)+"')";
        
        var success = queryAccessDB(sql, true); 
        if (success) {
            announce("Registrazione salvata con successo");
            originalState = null; // Resetta per evitare avvisi duplicati
            CaricaDatiMese(currentMeseStr); 
            isSavingInProgress = false;
            return true;
        } else {
            alert("ATTENZIONE: Si è verificato un problema durante il salvataggio nel database. Riprovare.");
            isSavingInProgress = false;
            return false;
        }
    } catch (e) { 
        alert("Errore nel modulo di salvataggio: " + e.message); 
        isSavingInProgress = false;
        return false;
    }
}

function ActionElimina() {
    if (idRecordCorrente === 0) return;
    if (confirm("Eliminare il record?")) { 
        queryAccessDB("DELETE FROM tblOrePresenze WHERE ID=" + idRecordCorrente, true); 
        announce("Record eliminato");
        CaricaDatiMese(currentMeseStr); 
    }
}

function ActionEliminaRapida(id) {
    if (!id) return;
    if (confirm("Eliminare definitivamente?")) { queryAccessDB("DELETE FROM tblOrePresenze WHERE ID=" + id, true); CaricaDatiMese(currentMeseStr); }
}

function ActionSalvaPerRiga(gg) { ActionSalva(); }

function ApplicaOrarioStandard() {
    var currentUser = document.getElementById("txtProfiloCorrente") ? document.getElementById("txtProfiloCorrente").value : "";
    if (currentUser.toLowerCase() === "admin") {
        alert("L'utente Admin non ha un orario di turno standard configurato.");
        return;
    }
    document.getElementById("cmbE1").value = userDefaults.e1;
    document.getElementById("cmbU1").value = userDefaults.u1;
    document.getElementById("cmbE2").value = userDefaults.e2;
    document.getElementById("cmbU2").value = userDefaults.u2;
    TriggerUpdate();
    announce("Orario standard caricato.");
}

function CopiaDaIeri() {
    var selectedRow = document.querySelector(".row-selected");
    if (!selectedRow) { alert("Seleziona prima una riga!"); return; }
    var currentDay = parseInt(selectedRow.cells[0].innerText, 10);
    if (isNaN(currentDay)) { return; }
    
    var yesterdayData = null;
    var foundDay = -1;
    for (var prevG = currentDay - 1; prevG >= 1; prevG--) {
        if (currentDbMap[prevG] && (currentDbMap[prevG].Entrata1 || currentDbMap[prevG].Note || currentDbMap[prevG].NotePrivate)) {
            yesterdayData = currentDbMap[prevG];
            foundDay = prevG;
            break;
        }
    }
    
    if (!yesterdayData) {
        alert("Nessun dato di registrazione trovato nei giorni precedenti!");
        return;
    }
    
    document.getElementById("cmbE1").value = yesterdayData.Entrata1 || "";
    document.getElementById("cmbU1").value = yesterdayData.Uscita1 || "";
    document.getElementById("cmbE2").value = yesterdayData.Entrata2 || "";
    document.getElementById("cmbU2").value = yesterdayData.Uscita2 || "";
    document.getElementById("txtPermessi").value = yesterdayData.Permessi || "0";
    document.getElementById("chkFerie").checked = yesterdayData.Ferie == "1" || yesterdayData.Ferie === true;
    document.getElementById("chkMalattia").checked = yesterdayData.Malattia == "1" || yesterdayData.Malattia === true;
    document.getElementById("chkL104").checked = yesterdayData.Legge104 == "1" || yesterdayData.Legge104 === true;
    document.getElementById("chkRecuperato").checked = yesterdayData.Recuperato == "1" || yesterdayData.Recuperato === true;
    document.getElementById("txtNote").value = yesterdayData.Note || "";
    document.getElementById("txtNotePrivate").value = yesterdayData.NotePrivate || "";
    
    TriggerUpdate();
    announce("Orari copiati con successo dal giorno " + foundDay);
}

function ActionQuickStdSalva(gg) {
    // 1. Seleziona la riga
    var rows = document.querySelectorAll("#lstPresenzeBody tr");
    if (rows[gg-1]) {
        SelectGiorno(gg, currentDbMap[gg]);
        
        // 2. Se è vuoto (no ID), applica standard
        if (idRecordCorrente === 0) {
            ApplicaOrarioStandard();
        }
        
        // 3. Salva
        setTimeout(function() { ActionSalva(); }, 50);
    }
}

function ActionSalvaRapido(gg) {
    // Seleziona la riga corrispondente e poi salva
    var rows = document.querySelectorAll("#lstPresenzeBody tr");
    if (rows[gg-1]) {
        // Forza la selezione grafica e logica
        if (rows[gg-1].className.indexOf("row-selected") === -1) {
            rows[gg-1].click(); 
        }
        // Piccolissimo delay per permettere all'editor di caricare i valori (defaults o DB)
        setTimeout(function() { ActionSalva(); }, 50);
    }
}

function ActionNuovo() {
    if (!CheckUnsavedChanges()) return; // Avvisa se ci sono modifiche pendenti
    var selRow = document.querySelector(".row-selected");
    var g = selRow ? parseInt(selRow.cells[0].innerText, 10) : new Date().getDate();
    originalState = null; // Disattiva il check interno a SelectGiorno
    SelectGiorno(g, null); // Passando null resettiamo ai valori di default
}

function ActionAnnulla() {
    originalState = null; // Resetta intenzionalmente per permettere il ripristino senza popup
    var selRow = document.querySelector(".row-selected");
    if (selRow) {
        selRow.click(); // Il click sulla riga ricarica i dati originali dal DB
    } else {
        ActionNuovo();
    }
}

function ActionAggiorna() {
    isNavigating = true;
    location.reload();
}

// Gestione tasto F5 per aggiornamento e scorciatoie globali (Ctrl+N, Ctrl+S)
document.onkeydown = function(e) {
    e = e || window.event;
    var key = e.keyCode || e.which;
    var ctrl = e.ctrlKey;
    
    if (key == 116) { // F5
        ActionAggiorna();
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        try { e.keyCode = 0; } catch(ex) {}
        return false;
    }
    if (ctrl && key === 78) { // Ctrl+N (Nuovo)
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        ActionNuovo();
        return false;
    }
    if (ctrl && key === 83) { // Ctrl+S (Salva)
        if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
        ActionSalva();
        return false;
    }
}

function ActionExport(tipo) {
    if (tipo === 'pdf') {
        EsportaReportPresenze();
        return;
    }
    var objApp, docOrWb;
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var shell = new ActiveXObject("WScript.Shell");
        var desktopPath = "";
        try {
            if (shell && shell.SpecialFolders) {
                if (typeof shell.SpecialFolders === "function") {
                    desktopPath = shell.SpecialFolders("Desktop");
                } else if (shell.SpecialFolders.Item) {
                    desktopPath = shell.SpecialFolders.Item("Desktop");
                } else if (shell.SpecialFolders.item) {
                    desktopPath = shell.SpecialFolders.item("Desktop");
                }
            }
        } catch(eSF) {}
        if (!desktopPath && shell && shell.ExpandEnvironmentStrings) {
            try { desktopPath = shell.ExpandEnvironmentStrings("%USERPROFILE%\\Desktop"); } catch(eEnv) {}
        }
        if (!desktopPath) desktopPath = fso.BuildPath(currentDir, "..");
        
        // Utilizziamo currentDir definito all'inizio dello script
        var templatePath = fso.BuildPath(currentDir, "assets\\template_presenze.xlsx");
        
        if (!fso.FileExists(templatePath)) {
            alert("Modello Excel non trovato in:\n" + templatePath + "\n\nAssicurati che il file 'template_presenze.xlsx' sia presente nella cartella assets.");
            return;
        }

        // --- 1. RECUPERO UTENTE PER EXPORT ---
        var exportUser = loggedUser;
        if (isAdmin && isGlobalView) {
            var adminFilterVal = document.getElementById("cmbAdminUserFilter").value;
            if (adminFilterVal !== "TUTTI") {
                exportUser = adminFilterVal;
            }
        }
        
        // Mappatura identità: ADMIN -> Ciro Milella (Richiesta utente per formato Proper Case)
        if (exportUser.toUpperCase() === "ADMIN") {
            exportUser = "Ciro Milella";
        }
        
        var currentUser = exportUser; // Manteniamo il formato naturale (es. Ciro Milella)

        // --- 2. PREPARAZIONE DATI MESE ---
        var p = currentMeseStr.split(" ");
        var mNome = p[0].toUpperCase();
        var aVal = p[1];
        var mIdx = mesiCol[p[0]]; // 1-based
        var cleanMNome = mNome.replace(/\s/g, "").toUpperCase();

        var finalName = "Presenze_" + cleanMNome + "_" + aVal + "_" + currentUser.replace(/\s+/g, "_");
        
        var targetDir = desktopPath;
        if (tipo === 'excel') {
            var baseDir = "";
            try {
                var checkDir = currentDir;
                while (checkDir && checkDir.length > 3) {
                    var name = fso.GetFileName(checkDir);
                    if (name.toUpperCase() === "LOGISTICA_CONSEGNE_MC") {
                        baseDir = checkDir;
                        break;
                    }
                    var parent = fso.GetParentFolderName(checkDir);
                    if (!parent || parent === checkDir) break;
                    checkDir = parent;
                }
            } catch(eFind) {}

            // Fallback se non trova LOGISTICA_CONSEGNE_MC per qualche motivo
            if (!baseDir) {
                baseDir = desktopPath;
            }

            var folderName = "presenze_" + aVal;
            var targetFolder = fso.BuildPath(baseDir, folderName);
            if (!fso.FolderExists(targetFolder)) {
                fso.CreateFolder(targetFolder);
            }
            targetDir = targetFolder;
        }
        var finalPath = fso.BuildPath(targetDir, finalName + ".xlsx");

        if (tipo === 'excel' || tipo === 'word' || tipo === 'pdf') {
            var toolsDir = fso.BuildPath(currentDir, "tools");
            if (!fso.FolderExists(toolsDir)) {
                try { fso.CreateFolder(toolsDir); } catch(eMk) {}
            }
            var dataTempPath = fso.BuildPath(toolsDir, "export_data_" + new Date().getTime() + ".txt");
            var runnerScript = (tipo === 'word') ? "export_word_runner.vbs" : ((tipo === 'pdf') ? "export_pdf_runner.vbs" : "export_excel_runner.vbs");
            var vbsRunner = fso.BuildPath(toolsDir, runnerScript);
            var targetOutPath = (tipo === 'word') ? fso.BuildPath(desktopPath, finalName + ".doc") : ((tipo === 'pdf') ? fso.BuildPath(desktopPath, finalName + ".pdf") : finalPath);
            
            var monthMap = {"GENNAIO":1,"FEBBRAIO":2,"MARZO":3,"APRILE":4,"MAGGIO":5,"GIUGNO":6,"LUGLIO":7,"AGOSTO":8,"SETTEMBRE":9,"OTTOBRE":10,"NOVEMBRE":11,"DICEMBRE":12};
            var realMIdx = monthMap[cleanMNome] || 1;
            var lastDay = new Date(parseInt(aVal, 10), realMIdx, 0).getDate();
            var dayNames = ["DOMENICA", "LUNEDI", "MARTEDI", "MERCOLEDI", "GIOVEDI", "VENERDI", "SABATO"];
            
            var dataLines = [];
            for (var d = 1; d <= lastDay; d++) {
                var dtObj = new Date(parseInt(aVal, 10), realMIdx - 1, d); 
                var dayNum = dtObj.getDay(); 
                var isWeekend = (dayNum === 0 || dayNum === 6);
                var isHoliday = IsItalianHoliday(d, realMIdx, parseInt(aVal, 10));
                var isWeekendHoliday = (isWeekend || isHoliday) ? "1" : "0";
                
                var dayName = dayNames[dayNum];
                var sDataIT = (d < 10 ? "0" + d : "" + d) + "-" + cleanMNome.toLowerCase().substring(0, 3);
                
                var record = currentDbMap[d] || { Entrata1:"", Uscita1:"", Entrata2:"", Uscita2:"", Permessi:0, Ferie:false, Malattia:false, Legge104:false, Note:"" };
                var permessiVal = record.Permessi || 0;
                var statusStr = "";
                if (isTrueVal(record.Ferie)) statusStr = "FERIE";
                else if (isTrueVal(record.Malattia)) statusStr = "MALATTIA";
                else if (isTrueVal(record.Legge104)) statusStr = "L.104";

                dataLines.push([
                    d,
                    sDataIT,
                    dayName,
                    record.Entrata1 || "",
                    record.Uscita1 || "",
                    record.Entrata2 || "",
                    record.Uscita2 || "",
                    currentUser,
                    permessiVal,
                    statusStr,
                    (record.Note || "").replace(/\r?\n/g, " "),
                    isWeekendHoliday
                ].join("|"));
            }

            try {
                var fTemp = fso.CreateTextFile(dataTempPath, true);
                fTemp.Write(dataLines.join("\r\n"));
                fTemp.Close();
            } catch(eFileWrite) {}

            if (fso.FileExists(vbsRunner)) {
                var cmd = 'cscript //NoLogo "' + vbsRunner + '" "' + templatePath + '" "' + targetOutPath + '" "' + dataTempPath + '" "' + cleanMNome + '" "' + aVal + '" "' + currentUser + '"';
                try {
                    shell.Run(cmd, 0, false);
                    var labelOut = (tipo === 'word') ? "Esportazione Word avviata per " + finalName + ".doc" : ((tipo === 'pdf') ? "Generazione PDF avviata per " + finalName + ".pdf" : "Esportazione Excel avviata");
                    if (typeof announce === "function") announce(labelOut);
                    else alert(labelOut);
                    return;
                } catch(eRun) {}
            }
        }

        // Copia il modello con gestione file in uso
        try {
            fso.CopyFile(templatePath, finalPath, true);
        } catch (eCopy) {
            alert("⚠️ IMPOSSIBILE SOVRASCRIVERE IL FILE EXCEL!\n\nIl file:\n" + finalName + ".xlsx\n\nè attualmente aperto in Microsoft Excel oppure è bloccato da un altro processo.\n\n👉 SOLUZIONE: Chiudi il file Excel o chiudi Microsoft Excel e riprova.");
            return;
        }

        // Apertura Excel (inizialmente invisibile per evitare flickering)
        try { 
            objApp = new ActiveXObject("Excel.Application"); 
        } catch(e1) { 
            try { 
                objApp = new ActiveXObject("Excel.Application.16"); 
            } catch(e2) {
                alert("⚠️ AUTOMAZIONE EXCEL NON DISPONIBILE!\n\nImpossibile avviare Microsoft Excel tramite ActiveX (Excel potrebbe non essere installato o i permessi ActiveX sono disabilitati).\n\n👉 SOLUZIONE: Utilizza il pulsante 'STAMPA RIEPILOGO' in basso per generare il PDF stampabile.");
                return;
            }
        }
        objApp.Visible = false; 
        objApp.DisplayAlerts = false;
        
        try {
            docOrWb = objApp.Workbooks.Open(finalPath);
        } catch(eOpen) {
            alert("⚠️ IMPOSSIBILE APRIRE IL FILE IN EXCEL!\n\nIl file risulta bloccato o in uso. Chiudi Microsoft Excel e riprova.");
            if (objApp) { try { objApp.Quit(); } catch(x){} }
            return;
        }
        var sheet = null;
        if (docOrWb) {
            try { sheet = docOrWb.ActiveSheet; } catch(eA) {}
            if (!sheet && docOrWb.Sheets) {
                try { sheet = (typeof docOrWb.Sheets === "function") ? docOrWb.Sheets(1) : docOrWb.Sheets[1]; } catch(eS) {}
            }
        }
        if (!sheet) {
            alert("⚠️ IMPOSSIBILE ACCEDERE AL FOGLIO EXCEL!\n\nChiudi Microsoft Excel se è attualmente aperto in background e riprova.");
            if (objApp) { try { objApp.Quit(); } catch(x){} }
            return;
        }
        
        // Rinomina la linguetta del foglio con il nome del mese (richiesta utente)
        try {
            for (var s = docOrWb.Sheets.Count; s >= 1; s--) {
                var sh = docOrWb.Sheets(s);
                if (sh.Name.toUpperCase() === cleanMNome.toUpperCase() && sh.Name !== sheet.Name) {
                    sh.Delete();
                }
            }
        } catch(ex) {}
        try { sheet.Name = cleanMNome; } catch(e) {}

        // --- IMPOSTAZIONE FONT GLOBALE (Tutto il lavoro basato su Times New Roman) ---
        sheet.Cells.Font.Name = "Times New Roman";

        // --- 3. PULIZIA PROFONDA (Commenti, Note, Vecchi dati) ---
        try { 
            sheet.Cells.ClearComments(); 
            sheet.Range("A7:J60").Clear(); // Reset totale (dati + stili vecchi)
        } catch(e) {}

        // --- RIMOZIONE CONTROLLI LEGACY (Conserva il LOGO) ---
        try {
            for (var s = sheet.Shapes.Count; s >= 1; s--) {
                if (sheet.Shapes(s).Type != 13 && sheet.Shapes(s).Type != 12) {
                    sheet.Shapes(s).Delete();
                }
            }
        } catch(e) { }

        // --- 4. INIEZIONE INTESTAZIONE E FIRMA GLOBALE ---
        try {
            sheet.Cells.Replace("MILELLA CIRO", currentUser, 2, 1, false);
            sheet.Cells.Replace("CIRO MILELLA", currentUser, 2, 1, false);
            sheet.Cells.Replace("ADMIN", currentUser, 2, 1, false); // Sostituisci anche placeholder ADMIN se presente
        } catch(e) { 
            sheet.Range("C2").Value = currentUser;
            sheet.Range("E2").Value = currentUser;
        }
        
        // --- RICERCA DINAMICA INTESTAZIONE MESE ---
        try {
            var cellMese = sheet.Cells.Find("MESE DI");
            if (cellMese) {
                cellMese.Value = "MESE DI " + cleanMNome + " " + aVal;
                cellMese.Font.Name = "Times New Roman";
                cellMese.Font.Bold = true;
            } else {
                // Fallback su G2 se la ricerca fallisce
                sheet.Range("G2").Value = "MESE DI " + cleanMNome + " " + aVal;
            }
        } catch(f) {
            sheet.Range("G2").Value = "MESE DI " + cleanMNome + " " + aVal;
        }

        sheet.Range("D3").Value = "MANSIONE: IMPIEGATO";

        // --- 5. RIEMPIMENTO TABELLA DINAMICA ---
        // Mappa dei mesi per sincronizzazione assoluta
        var monthMap = {"GENNAIO":1,"FEBBRAIO":2,"MARZO":3,"APRILE":4,"MAGGIO":5,"GIUGNO":6,"LUGLIO":7,"AGOSTO":8,"SETTEMBRE":9,"OTTOBRE":10,"NOVEMBRE":11,"DICEMBRE":12};
        var realMIdx = monthMap[cleanMNome] || 1;

        // Calcolo ultimi giorni del mese con precisione
        var lastDay = new Date(aVal, realMIdx, 0).getDate();
        
        for (var d = 1; d <= lastDay; d++) {
            var rowIndex = 6 + d; 
            // IMPORTANTE: realMIdx - 1 perché JS conta i mesi da 0 a 11
            var dtObj = new Date(aVal, realMIdx - 1, d); 
            var dayNum = dtObj.getDay(); 
            var isWeekend = (dayNum === 0 || dayNum === 6);
            var isHoliday = IsItalianHoliday(d, realMIdx, parseInt(aVal, 10));
            
            // Giorno della settimana in Italiano
            var dayName = dtObj.toLocaleDateString('it-IT', { weekday: 'long' }).toUpperCase();
            
            // Formato data (es. 01-mar) - Usiamo il nome del mese estratto correttamente
            var sDataIT = (d < 10 ? "0" + d : d) + "-" + cleanMNome.toLowerCase().substring(0, 3);
            
            var record = currentDbMap[d] || { Entrata1:"", Uscita1:"", Entrata2:"", Uscita2:"", Permessi:0, Ferie:false, Malattia:false, Legge104:false, Note:"" };

            sheet.Cells(rowIndex, 1).Value = sDataIT;
            sheet.Cells(rowIndex, 2).Value = dayName; 
            sheet.Cells(rowIndex, 3).Value = record.Entrata1 || "";
            sheet.Cells(rowIndex, 4).Value = record.Uscita1 || "";
            sheet.Cells(rowIndex, 5).Value = record.Entrata2 || "";
            sheet.Cells(rowIndex, 6).Value = record.Uscita2 || "";
            
            var status = "";
            if (isTrueVal(record.Ferie)) status = "FERIE";
            else if (isTrueVal(record.Malattia)) status = "MALATTIA";
            else if (isTrueVal(record.Legge104)) status = "L.104";
            if (status) sheet.Cells(rowIndex, 9).Value = status;
            
            // Se è presente un giustificativo di assenza (FERIE, MALATTIA, L.104), la FIRMA NON deve apparire (utente assente).
            if (status !== "") {
                sheet.Cells(rowIndex, 7).Value = "";
            } else if (record.Entrata1 || record.Uscita1 || record.Entrata2 || record.Uscita2) {
                sheet.Cells(rowIndex, 7).Value = currentUser; 
            } else {
                sheet.Cells(rowIndex, 7).Value = "";
            }
            
            sheet.Cells(rowIndex, 10).Value = record.Note || "";

            // --- STILE DINAMICO ---
            var rowRange = sheet.Range("A" + rowIndex + ":J" + rowIndex);
            var colABRange = sheet.Range("A" + rowIndex + ":B" + rowIndex);
            var colCHRange = sheet.Range("C" + rowIndex + ":J" + rowIndex);
            
            rowRange.Borders.LineStyle = 1;
            rowRange.Font.Name = "Times New Roman";
            rowRange.Font.Size = 10;
            rowRange.VerticalAlignment = -4108; 
            rowRange.RowHeight = 14.25;
            
            colABRange.HorizontalAlignment = -4131; // Sinistra
            colCHRange.HorizontalAlignment = -4108; // Centro

            colABRange.Interior.Color = 15652797; // Azzurro

            if (isWeekend || isHoliday) {
                rowRange.Interior.Color = 15652797; 
                rowRange.Font.Bold = true;
            } else {
                colCHRange.Interior.ColorIndex = 0; 
                rowRange.Font.Bold = false;
            }
        }

        // Nascondi le righe per i giorni non presenti nel mese (es. giorno 31 nei mesi da 30 giorni)
        for (var dUnused = lastDay + 1; dUnused <= 31; dUnused++) {
            var rowIndexUnused = 6 + dUnused;
            try {
                sheet.Rows(rowIndexUnused).EntireRow.Hidden = true;
            } catch(eHide) {}
        }

        // --- CALIBRAZIONE LARGHEZZE (Identico a originale) ---
        sheet.Columns("A").ColumnWidth = 6.29;
        sheet.Columns("B").ColumnWidth = 11.43;
        sheet.Columns("G").AutoFit();

        // --- 6. SALVATAGGIO E APERTURA FINALE ---
        var shell = new ActiveXObject("WScript.Shell");
        
        if (tipo === 'pdf') {
            var pdfPath = fso.BuildPath(desktopPath, finalName + ".pdf");
            docOrWb.ExportAsFixedFormat(0, pdfPath); // 0 = xlTypePDF
            docOrWb.Close(false);
            objApp.Quit();
            
            if (fso.FileExists(finalPath)) fso.DeleteFile(finalPath);
            
            // APERTURA AUTOMATICA PDF
            try { shell.Run('"' + pdfPath + '"'); } catch(e){}
            announce("Stampa PDF visualizzata.");
        } 
        else if (tipo === 'word') {
            // --- ESPORTAZIONE IN WORD (Strategia a 3 Livelli) ---
            var ts = new Date().getTime().toString().substring(8);
            var wordPath = fso.BuildPath(desktopPath, finalName + ".doc"); 
            var objWord = null;
            
            try {
                // LIVELLO 1: Automazione Nativa Premium
                try { 
                    objWord = new ActiveXObject("Word.Application"); 
                } catch(e) { 
                    try { objWord = new ActiveXObject("Word.Application.16"); } catch(e2) {}
                }
                
                if (objWord) {
                    objWord.Visible = true;
                    objWord.DisplayAlerts = 0;
                    var wordDoc = objWord.Documents.Add();
                    wordDoc.PageSetup.Orientation = 1; // Landscape
                    
                    // Margini Standard (Torniamo su 2 pagine per leggibilità)
                    wordDoc.PageSetup.TopMargin = 30;
                    wordDoc.PageSetup.BottomMargin = 30;
                    wordDoc.PageSetup.LeftMargin = 30;
                    wordDoc.PageSetup.RightMargin = 30;
                    
                    var lastRowToCopy = 6 + lastDay; 
                    sheet.Range("A1:J" + lastRowToCopy).Copy();
                    
                    // Incolla Semplice (Massima compatibilità)
                    try { 
                        wordDoc.Content.Paste(); 
                    } catch(eP) { 
                        wordDoc.Content.PasteExcelTable(false, false, false); 
                    }
                    
                    if (wordDoc.Tables.Count > 0) {
                        var table = wordDoc.Tables(1);
                        table.Range.Font.Size = 11; // Carattere Leggibile
                        table.Range.Font.Name = "Times New Roman";
                        table.Rows.Alignment = 1; // Centra
                        // Nessuna restrizione altezza -> andrà naturalmente su 2 fogli
                    }
                    
                    wordDoc.SaveAs(wordPath);
                    docOrWb.Close(false);
                    objApp.Quit();
                    if (fso.FileExists(finalPath)) { try { fso.DeleteFile(finalPath); } catch(x){} }
                    objWord.Activate();
                    announce("Esportazione Word completata.");
                } else {
                    // LIVELLO 2: Fallback tramite Excel
                    try {
                        docOrWb.SaveAs(wordPath, 45); // 45 = xlWebArchive
                        docOrWb.Close(false);
                        objApp.Quit();
                        if (fso.FileExists(finalPath)) { try { fso.DeleteFile(finalPath); } catch(x){} }
                        var shell = new ActiveXObject("WScript.Shell");
                        shell.Run('"' + wordPath + '"');
                        announce("Esportazione Word (Compatibile) completata.");
                    } catch(eB) {
                        // LIVELLO 3: PDF Corazzato
                        var pdfFallback = fso.BuildPath(desktopPath, finalName + "_Versione_P_D_F.pdf");
                        docOrWb.ExportAsFixedFormat(0, pdfFallback);
                        docOrWb.Close(false);
                        objApp.Quit();
                        if (fso.FileExists(finalPath)) { try { fso.DeleteFile(finalPath); } catch(x){} }
                        var shell = new ActiveXObject("WScript.Shell");
                        shell.Run('"' + pdfFallback + '"');
                        alert("Spostamento su PDF: Word è bloccato da una finestra di dialogo esterna.");
                    }
                }
            } catch(eAny) {
                var errDetail = eAny.description || eAny.message || ("Errore " + eAny.number);
                alert("Si è verificato un intoppo durante l'esportazione Word:\n" + errDetail + "\n\nAssicurati che non ci siano altre finestre di Word aperte.");
                if (objApp) { try { objApp.Visible = true; } catch(x){} }
            }
        }
        else {
            // EXCEL
            docOrWb.Save();
            objApp.Visible = true; 
            
            // Visualizza nella barra di stato la cartella e il nome del file salvato
            var relativeSavedPath = fso.GetFileName(fso.GetParentFolderName(finalPath)) + "\\" + fso.GetFileName(finalPath);
            announce("Esportato con successo in: " + relativeSavedPath);
        }

    } catch (err) {
        alert("Errore durante l'azione " + tipo + ":\n" + err.message);
        if (objApp) {
            try { objApp.Visible = true; } catch(e){}
        }
    }
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
    if (!CheckUnsavedChanges()) return; // Blocca navigazione se ci sono modifiche pendenti
    isNavigating = true;
    if (typeof window.parent !== "undefined" && typeof window.parent.ApriModulo === "function") {
        window.parent.ApriModulo(modulo);
    } else if (typeof window.top !== "undefined" && typeof window.top.ApriModulo === "function") {
        window.top.ApriModulo(modulo);
    } else {
        try {
            var shell = new ActiveXObject("WScript.Shell");
            var htaPath = fso ? fso.BuildPath(currentDir, modulo) : modulo;
            document.title = "CHIUSURA_IN_CORSO";
            shell.Run('mshta.exe "' + htaPath + '"', 1, false);
            window.close();
        } catch(e) { }
    }
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
if (window.attachEvent) {
    window.attachEvent('onclick', closeAllMenus);
} else {
    window.addEventListener('click', closeAllMenus);
}

function closeAllMenus() {
    var items = document.querySelectorAll('.menu-item');
    for (var i = 0; i < items.length; i++) {
        items[i].className = 'menu-item';
    }
}

/**
 * FUNZIONE DI MANUTENZIONE ADMIN: RIPARAZIONE RECORD ORFANI
 * Assegna i record senza proprietario del mese corrente all'utente selezionato nel filtro.
 */
function RepairOrphanRecords() {
    var adminFilterVal = document.getElementById("cmbAdminUserFilter").value;
    if (!adminFilterVal || adminFilterVal === "TUTTI") {
        alert("Seleziona prima un profilo specifico a cui assegnare i dati (es. Ciro Milella).");
        return;
    }
    
    if (!confirm("ATTENZIONE: Stai per assegnare tutti i record SENZA NOME di questo mese all'utente '" + adminFilterVal + "'.\n\nVuoi procedere?")) return;
    
    var p = currentMeseStr.split(" ");
    var mIdx = mesiCol[p[0]]; // 1-based
    var year = parseInt(p[1], 10);
    
    var sql = "UPDATE tblOrePresenze SET Utente = '" + adminFilterVal.replace(/'/g, "''") + "' " +
              "WHERE (Utente IS NULL OR Utente = '') " +
              "AND Month(DataLavoro) = " + mIdx + " AND Year(DataLavoro) = " + year;
              
    try {
        queryAccessDB(sql, true);
        alert("RIEPILOGO MANUTENZIONE:\nOperazione completata con successo.\nI record orfani del mese di " + p[0] + " ora appartengono a " + adminFilterVal + ".");
        CaricaDatiMese(currentMeseStr);
    } catch(e) {
        alert("Errore durante la riparazione: " + e.message);
    }
}

// Append at end
function StartTitleClock() {
    var timer = function() {
        var ora = new Date();
        var h = (ora.getHours() < 10 ? '0' : '') + ora.getHours();
        var m = (ora.getMinutes() < 10 ? '0' : '') + ora.getMinutes();
        var tEl = document.getElementById("titleTime");
        if (tEl) {
            tEl.innerText = h + ":" + m;
        }
    };
    timer();
    setInterval(timer, 10000);
}

function CaricaProfiloUtente() {
    try {
        var profileWidget = document.getElementById("userProfileWidget");
        if (profileWidget) {
            var iconHtml = '<div style="width:22px; height:22px; border-radius:50%; background:rgba(255,255,255,0.15); display:inline-flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid rgba(255,255,255,0.3);"><img src="https://img.icons8.com/ios-filled/50/ffffff/user-male-circle.png" style="width:13px; height:13px; opacity:0.9;"></div>';
            var displayUser = (loggedUser || "OSPITE").toUpperCase();
            profileWidget.innerHTML = '<span style="text-transform:uppercase; letter-spacing:0.5px;">' + displayUser + '</span> ' + iconHtml;
        }
    } catch(e) { }
}

function EsportaReportPresenze() {
    try {
        var targetUser = loggedUser || "Ospite";
        if (typeof isAdmin !== "undefined" && typeof isGlobalView !== "undefined" && isAdmin && isGlobalView) {
            var adminFilterVal = document.getElementById("cmbAdminUserFilter").value;
            if (adminFilterVal && adminFilterVal !== "TUTTI") {
                targetUser = adminFilterVal;
            }
        }

        var meseAnno = currentMeseStr || document.getElementById("cmbMeseAnno").value;
        if (!meseAnno) {
            alert("Seleziona un mese da esportare.");
            return;
        }

        var p = meseAnno.split(" ");
        var mIdx = mesiCol[p[0]]; 
        var year = parseInt(p[1], 10);

        if (!mIdx || !year) {
            alert("Errore nell'interpretazione del periodo temporale.");
            return;
        }

        if (typeof localStorage !== "undefined") {
            try {
                localStorage.setItem("report_user", targetUser);
                localStorage.setItem("report_month", mIdx);
                localStorage.setItem("report_year", year);
            } catch(eLS) {}
        }

        if (typeof fso !== "undefined" && fso && currentDir) {
            try {
                var sysDir = fso.BuildPath(currentDir, "system");
                if (!fso.FolderExists(sysDir)) fso.CreateFolder(sysDir);
                var pFile = fso.BuildPath(sysDir, "report_presenze_params.tmp");
                var f = fso.CreateTextFile(pFile, true);
                f.WriteLine(targetUser);
                f.WriteLine(mIdx);
                f.WriteLine(year);
                f.Close();
            } catch(eFso) {}
        }

        if (typeof LaunchModuleStayOpen === "function") {
            LaunchModuleStayOpen("report_presenze.html");
        } else if (typeof window.ApriModulo === "function") {
            window.ApriModulo("report_presenze.html");
        } else if (window.parent && typeof window.parent.ApriModulo === "function") {
            window.parent.ApriModulo("report_presenze.html");
        } else if (window.top && typeof window.top.ApriModulo === "function") {
            window.top.ApriModulo("report_presenze.html");
        } else {
            window.open("report_presenze.html", "_blank");
        }

    } catch(e) {
        alert("Errore durante la generazione del prospetto di stampa: " + e.message);
    }
}

/* ========================================================
   SISTEMA DI PROTEZIONE E TRACCIAMENTO MODIFICHE NON SALVATE
   ======================================================== */
function GetCurrentFormState() {
    try {
        return {
            e1: document.getElementById("cmbE1") ? document.getElementById("cmbE1").value : "",
            u1: document.getElementById("cmbU1") ? document.getElementById("cmbU1").value : "",
            e2: document.getElementById("cmbE2") ? document.getElementById("cmbE2").value : "",
            u2: document.getElementById("cmbU2") ? document.getElementById("cmbU2").value : "",
            permessi: document.getElementById("txtPermessi") ? document.getElementById("txtPermessi").value : "0",
            ferie: document.getElementById("chkFerie") ? document.getElementById("chkFerie").checked : false,
            malattia: document.getElementById("chkMalattia") ? document.getElementById("chkMalattia").checked : false,
            l104: document.getElementById("chkL104") ? document.getElementById("chkL104").checked : false,
            recuperato: document.getElementById("chkRecuperato") ? document.getElementById("chkRecuperato").checked : false,
            note: document.getElementById("txtNote") ? document.getElementById("txtNote").value : "",
            notePrivate: document.getElementById("txtNotePrivate") ? document.getElementById("txtNotePrivate").value : ""
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
        var promptMsg = "Sono presenti modifiche non salvate per il giorno corrente.\n\n" +
                        "Vuoi memorizzarle prima di procedere?\n\n" +
                        "[SÌ]\t- Salva nel Database e procedi\n" +
                        "[NO]\t- Abbandona le modifiche e procedi\n" +
                        "[ANNULLA]\t- Torna alla scheda per continuare a scrivere";
        
        // 3 = Yes/No/Cancel buttons, 32 = Question Icon, 0 = Default Yes
        var result = shell.Popup(promptMsg, 0, "MODIFICHE NON SALVATE", 3 + 32);
        
        if (result === 6) { // Sì (Yes)
            return ActionSalva(); // Esegue il salvataggio sincrono e restituisce l'esito (true/false)
        } else if (result === 7) { // No
            originalState = null; // Neutralizza per consentire l'operazione
            return true;
        } else {
            return false; // Annulla (Cancel)
        }
    } catch(e) {
        // Fallback nel caso eccezionale di blocco ActiveX
        return confirm("Attenzione: ci sono modifiche non salvate.\nVuoi ignorarle e continuare?");
    }
}

function ActionEsci() {
    if (!CheckUnsavedChanges()) return;
    if (typeof window.parent !== "undefined" && typeof window.parent.ApriModulo === "function") {
        window.parent.ApriModulo("dashboard.html");
    } else if (typeof window.top !== "undefined" && typeof window.top.ApriModulo === "function") {
        window.top.ApriModulo("dashboard.html");
    } else {
        window.close();
    }
}

function ApriCartellaDestinazione() {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var shell = new ActiveXObject("WScript.Shell");
        var desktopPath = shell.SpecialFolders("Desktop");
        
        // Trova la cartella base (LOGISTICA_CONSEGNE_MC o fallback Desktop)
        var baseDir = "";
        try {
            var checkDir = currentDir;
            while (checkDir && checkDir.length > 3) {
                var name = fso.GetFileName(checkDir);
                if (name.toUpperCase() === "LOGISTICA_CONSEGNE_MC") {
                    baseDir = checkDir;
                    break;
                }
                var parent = fso.GetParentFolderName(checkDir);
                if (!parent || parent === checkDir) break;
                checkDir = parent;
            }
        } catch(eFind) {}
        if (!baseDir) baseDir = desktopPath;

        // Estrai l'anno selezionato per aprire la cartella corretta
        var aVal = new Date().getFullYear();
        if (currentMeseStr) {
            var p = currentMeseStr.split(" ");
            if (p.length === 2 && !isNaN(parseInt(p[1], 10))) {
                aVal = parseInt(p[1], 10);
            }
        }
        
        var folderName = "presenze_" + aVal;
        var targetFolder = fso.BuildPath(baseDir, folderName);
        
        if (!fso.FolderExists(targetFolder)) {
            fso.CreateFolder(targetFolder);
        }
        
        shell.Run("explorer.exe \"" + targetFolder + "\"");
        announce("Apertura cartella destinazione in corso...");
    } catch(e) {
        alert("Impossibile aprire la cartella: " + e.message);
    }
}


function ActionExportHTMLPDF() {
    announce('Preparazione PDF Premium in corso...');
    var controls = document.querySelector('.controls');
    if(controls) controls.style.display = 'none';
    var opt = { margin: 10, filename: 'Report_Presenze_' + loggedUser.replace(/\s+/g, '_') + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
    var tableContainer = document.querySelector('.table-container');
    if(!tableContainer) tableContainer = document.body;
    html2pdf().set(opt).from(tableContainer).save().then(function() {
        if(controls) controls.style.display = 'flex';
        announce('Download PDF Premium completato.');
    }).catch(function(err) {
        if(controls) controls.style.display = 'flex';
        alert('Errore generazione PDF: ' + err);
    });
}
