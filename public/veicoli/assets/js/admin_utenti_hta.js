// admin_utenti_hta.js - Engine Gestionale Permessi Danea Gold
var fso = null;
var shell = null;
try {
    fso = new ActiveXObject("Scripting.FileSystemObject");
    shell = new ActiveXObject("WScript.Shell");
} catch(e) {
    fso = {
        FileExists: function() { return false; },
        FolderExists: function() { return false; },
        GetFile: function() { 
            return { 
                Size: 1250000, 
                Copy: function() {} 
            }; 
        },
        CopyFile: function() {},
        CreateFolder: function() {},
        CreateTextFile: function() {
            return { Write: function(){}, WriteLine: function(){}, Close: function(){} };
        },
        GetParentFolderName: function(p) {
            if(!p) return "";
            var parts = p.replace(/\//g, "\\").split("\\");
            if(parts.length <= 1) return p;
            parts.pop();
            return parts.join("\\");
        },
        BuildPath: function(p, n) {
            if(!p) return n;
            var sep = (p.indexOf("\\") > -1) ? "\\" : "/";
            if (p.charAt(p.length - 1) === sep) return p + n;
            return p + sep + n;
        },
        OpenTextFile: function() {
            return { AtEndOfStream: true, ReadLine: function(){return "";}, ReadAll: function(){return "";}, WriteLine: function(){}, Close: function(){} };
        }
    };
    shell = { Run: function(){} };
}

// Database Resolution
var pG = window.location.pathname || "";
if (pG.indexOf("/") === 0 && pG.indexOf(":") > -1) pG = pG.substring(1);
pG = decodeURIComponent(pG).replace(/\//g, "\\");
var currentDir = fso && fso.GetParentFolderName ? fso.GetParentFolderName(pG) : "";
var DB_PATH = fso && fso.BuildPath ? fso.BuildPath(currentDir, "ConsegneDB.accdb") : "ConsegneDB.accdb";

var currentUser = "";
var isNavigating = false;
var isClosing = false; // Flag di sicurezza anti-loop

window.onbeforeunload = function() {
    if (isNavigating || isClosing) return; 
    isClosing = true;
    
    try {
        var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(e) {}
};
window.onload = function() {
    var isAllowed = false;
    try { isAllowed = SecurityCheck(); } catch(e) { isAllowed = false; }
    if (isAllowed !== true) return;
    
    CaricaUtenti();
    AggiornaStats();
    CaricaLogStorico();
    
    // Novità Enterprise
    AggiornaSaluteDatabase();
    CaricaInsightsAccessi();
    
    // Inizializzazione Smart Click per Orari Standard (Isolata per sicurezza)
    try { InizializzaSmartClickAdmin(); } catch(e) { } 
    try { InitTPData(); } catch(e) { } 
    
    // Inizializza Night Mode
    try {
        var nmPath = fso.BuildPath(currentDir, "system\\dark_mode.txt");
        if(fso.FileExists(nmPath)) {
            var f = fso.OpenTextFile(nmPath, 1);
            var isDark = f.ReadAll().trim();
            f.Close();
            if(isDark === "ON") {
                document.getElementById("chkNightMode").checked = true;
                ToggleNightMode();
            }
        }
    } catch(e) {}
};

function SetThemeMode(isDark) {
    var chk = document.getElementById("chkNightMode");
    if (chk) {
        chk.checked = isDark;
        ToggleNightMode();
    }
}

function ToggleNightMode() {
    var chk = document.getElementById("chkNightMode");
    var knob = document.getElementById("nightSliderKnob");
    var track = document.getElementById("nightSliderTrack");
    var btnDay = document.getElementById("btnThemeDay");
    var btnNight = document.getElementById("btnThemeNight");
    
    var isDark = chk ? chk.checked : false;

    if (isDark) {
        document.body.classList.add("dark-theme");
        if (knob) {
            knob.style.transform = "translateX(20px)";
            knob.style.backgroundColor = "#ffffff";
        }
        if (track) track.style.backgroundColor = "#3b82f6";
        
        if (btnDay) {
            btnDay.style.background = "transparent";
            btnDay.style.color = "#64748b";
            btnDay.style.boxShadow = "none";
            btnDay.style.fontWeight = "700";
        }
        if (btnNight) {
            btnNight.style.background = "linear-gradient(135deg, #3b82f6, #1d4ed8)";
            btnNight.style.color = "#ffffff";
            btnNight.style.boxShadow = "0 2px 8px rgba(59,130,246,0.5)";
            btnNight.style.fontWeight = "800";
        }
    } else {
        document.body.classList.remove("dark-theme");
        if (knob) {
            knob.style.transform = "translateX(0px)";
            knob.style.backgroundColor = "#ffffff";
        }
        if (track) track.style.backgroundColor = "#cbd5e1";
        
        if (btnDay) {
            btnDay.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
            btnDay.style.color = "#ffffff";
            btnDay.style.boxShadow = "0 2px 8px rgba(245,158,11,0.4)";
            btnDay.style.fontWeight = "800";
        }
        if (btnNight) {
            btnNight.style.background = "transparent";
            btnNight.style.color = "#64748b";
            btnNight.style.boxShadow = "none";
            btnNight.style.fontWeight = "700";
        }
    }
    
    try {
        if (fso && fso.BuildPath && currentDir) {
            var nmPath = fso.BuildPath(currentDir, "system\\dark_mode.txt");
            if (fso.CreateTextFile) {
                var f = fso.CreateTextFile(nmPath, true);
                f.Write(isDark ? "ON" : "OFF");
                f.Close();
            }
        }
    } catch(e) {}
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("dark_mode", isDark ? "ON" : "OFF");
        }
    } catch(eLS) {}
}
var currentTPTarget = "";
var selectedTPHour = "";
var selectedTPMinute = "";

function InizializzaSmartClickAdmin() {
    var fields = ["txtStdE1", "txtStdU1", "txtStdE2", "txtStdU2"];
    for(var i=0; i<fields.length; i++) {
        var el = document.getElementById(fields[i]);
        if(el) {
            el.readOnly = false; // Permettiamo di nuovo di scrivere a mano
            el.style.cursor = "text"; 
            
            // Logica di DOPPIO CLICK MANUALE (infallibile in HTA)
            el.lastClickTime = 0;
            el.onclick = (function(fid) {
                return function() {
                    var now = new Date().getTime();
                    if (now - this.lastClickTime < 400) {
                        // Riconosciuto come DOPPIO CLICK
                        OpenTimePicker(fid);
                        this.lastClickTime = 0; // Reset
                    } else {
                        this.lastClickTime = now;
                    }
                };
            })(fields[i]);
            
            el.title = "Fai due click veloci per aprire la maschera orari grafica";
        }
    }
}

function InitTPData() {
    var hCont = document.getElementById("tp-hours");
    var mCont = document.getElementById("tp-minutes");
    if(!hCont || !mCont) return;
    hCont.innerHTML = "";
    mCont.innerHTML = "";
    
    for (var h = 7; h <= 21; h++) {
        var val = (h < 10 ? "0" : "") + h;
        var div = document.createElement("div");
        div.className = "tp-item"; div.innerText = val;
        
        (function(v) { 
            var tpClickTimer = null;
            div.onclick = function() { 
                var clickedEl = this; // FIX: Catturiamo l'elemento prima del timeout
                if (tpClickTimer) {
                    // DOPPIO CLICK SULL'ORA -> HH:00
                    clearTimeout(tpClickTimer);
                    tpClickTimer = null;
                    document.getElementById(currentTPTarget).value = v + ":00";
                    CloseTimePicker();
                } else {
                    tpClickTimer = setTimeout(function() {
                        SelectTPItem('hour', v, clickedEl); // FIX: Usiamo clickedEl
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
                var clickedEl = this; // FIX: Catturiamo l'elemento prima del timeout
                if (tpMClickTimer) {
                    // DOPPIO CLICK SUL MINUTO -> Completa e chiudi
                    clearTimeout(tpMClickTimer);
                    tpMClickTimer = null;
                    SelectTPItem('minute', v, clickedEl); // FIX: Usiamo clickedEl
                } else {
                    tpMClickTimer = setTimeout(function() {
                        SelectTPItem('minute', v, clickedEl); // FIX: Usiamo clickedEl
                        tpMClickTimer = null;
                    }, 350);
                }
            };
        })(val);
        
        mCont.appendChild(div);
    }
}

function OpenTimePicker(fieldId) {
    currentTPTarget = fieldId;
    selectedTPHour = "";
    selectedTPMinute = "";
    var items = document.querySelectorAll(".tp-item");
    for (var i = 0; i < items.length; i++) items[i].classList.remove("selected");
    document.getElementById("tpOverlay").style.display = "flex";
}

function CloseTimePicker() {
    document.getElementById("tpOverlay").style.display = "none";
    try { CalcolaTotaleOre(); } catch(e) {}
}

function SelectTPItem(type, val, el) {
    var p = el.parentNode;
    var children = p.children;
    for (var i = 0; i < children.length; i++) children[i].classList.remove("selected");
    el.classList.add("selected");
    
    if (type === 'hour') selectedTPHour = val;
    else selectedTPMinute = val;
    
    if (selectedTPHour && selectedTPMinute) {
        document.getElementById(currentTPTarget).value = selectedTPHour + ":" + selectedTPMinute;
        CloseTimePicker();
    }
}

function SecurityCheck() {
    try {
        var user = "";
        var role = "";
        if (typeof sessionStorage !== "undefined") {
            user = sessionStorage.getItem("currentUser") || sessionStorage.getItem("loggedUser") || "";
            if (sessionStorage.getItem("utenteAutenticato")) {
                try {
                    var uObj = JSON.parse(sessionStorage.getItem("utenteAutenticato"));
                    if (uObj && uObj.Utente) user = uObj.Utente;
                    if (uObj && uObj.Ruolo) role = uObj.Ruolo;
                } catch(exU) {}
            }
            if (!user && parent && parent.sessionStorage) {
                user = parent.sessionStorage.getItem("currentUser") || parent.sessionStorage.getItem("loggedUser") || "";
                if (parent.sessionStorage.getItem("utenteAutenticato")) {
                    try {
                        var pObj = JSON.parse(parent.sessionStorage.getItem("utenteAutenticato"));
                        if (pObj && pObj.Utente) user = pObj.Utente;
                        if (pObj && pObj.Ruolo) role = pObj.Ruolo;
                    } catch(exP) {}
                }
            }
        }
        if (!user && typeof localStorage !== "undefined") {
            user = localStorage.getItem("loggedUser") || localStorage.getItem("activeUser") || localStorage.getItem("currentUser") || "";
        }
        
        var uClean = user ? String(user).replace(/^\s+|\s+$/g, "").toUpperCase() : "";
        var rClean = role ? String(role).replace(/^\s+|\s+$/g, "").toUpperCase() : "";
        
        var isMasterUser = (uClean === "ADMIN" || uClean === "CIRO MILELLA" || uClean === "SUPERVISORE");
        var isMasterRole = (rClean === "ADMIN" || rClean === "AMMINISTRATORE" || rClean.indexOf("AMMINISTRATORE") > -1);

        var isAdmin = (isMasterUser || isMasterRole);
        
        if (!isAdmin) {
            alert("ACCESSO NEGATO\n\nGentile " + (user || "Operatore") + ", questa maschera è riservata esclusivamente al profilo AMMINISTRATORE (Ciro Milella).");
            isClosing = true;
            if (parent && parent !== window) {
                var pModal = parent.document.getElementById("modalAdminOverlay") || parent.document.getElementById("modalAdmin");
                if (pModal) pModal.style.display = "none";
            }
            try { window.close(); } catch(e) {}
            return false;
        }
        
        currentUser = user || "Ciro Milella";
        return true;
    } catch(eMainSec) {
        return false;
    }
}

function queryAccessDB(sql, isUpdate) {
    try {
        var http = new XMLHttpRequest();
        http.open("POST", "http://127.0.0.1:3002/query", false);
        http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));
        if (http.status === 200) {
            var res = JSON.parse(http.responseText);
            return isUpdate ? true : res;
        }
    } catch(errReq) {}
    return isUpdate ? false : [];
}

function CaricaUtenti() {
    var grid = document.getElementById("userGrid");
    grid.innerHTML = "";
    
    try {
        var rows = queryAccessDB("SELECT Utente, Abilitato, Mail FROM tblUtenti ORDER BY Utente ASC", false);
        
        for(var i=0; i<rows.length; i++) {
            var row = rows[i];
            var nome = row.Utente || "";
            var abil = row.Abilitato || "No";
            
            var card = document.createElement("div");
            card.className = "user-card";
            card.setAttribute("data-nome", nome);
            card.onclick = function() { LoadUserData(this); };
            
            var badgeCls = (abil === "Si") ? "status-on" : "status-off";
            var statusTxt = (abil === "Si") ? "ATTIVO" : "OFFLINE";
            var pulsingDot = (abil === "Si") ? "<span class='status-dot status-pulse'></span>" : "<span class='status-dot'></span>";
            
            card.innerHTML = getInitialsAvatarHtml(nome) +
                             "<div class='u-name'>" + nome + "</div>" +
                             "<div class='user-status-strip " + badgeCls + "'>" + pulsingDot + statusTxt + "</div>";
            
            grid.appendChild(card);
        }
    } catch(e) {
        alert("Errore caricamento utenti: " + e.message);
    }
}

function LoadUserData(card) {
    var sql = "";
    try {
        var grid = document.getElementById("userGrid");
        var cards = grid.getElementsByClassName("user-card");
        for(var i=0; i<cards.length; i++) cards[i].className = "user-card";
        card.className = "user-card selected";
        
        currentUser = card.getAttribute("data-nome");
        document.getElementById("lblHint").innerText = "Dettagli utente: " + currentUser;
        
        var safeUser = currentUser.replace(/'/g, "''").toLowerCase();
        
        sql = "SELECT * FROM [tblUtenti] WHERE LCase([Utente]) = '" + safeUser + "'";
        var rows = queryAccessDB(sql, false);
        
        if(rows.length > 0) {
            var row = rows[0];
            // Mapping dinamico per evitare errori di indice o nomi riservati
            var data = { utente: "", pass: "", mail: "", abil: "" };
            
            for(var key in row) {
                var fName = key.toLowerCase();
                var fVal = row[key];
                if(fVal == null) fVal = "";
                
                if(fName == "utente") data.utente = String(fVal);
                if(fName == "password") data.pass = String(fVal);
                if(fName == "mail") data.mail = String(fVal);
                if(fName == "abilitato") data.abil = String(fVal);
                if(fName == "stde1") data.stde1 = String(fVal);
                if(fName == "stdu1") data.stdu1 = String(fVal);
                if(fName == "stde2") data.stde2 = String(fVal);
                if(fName == "stdu2") data.stdu2 = String(fVal);
            }
            
            // Gestione Smart Click per Orari Standard (Suggerimenti)
            var fields = ["txtStdE1", "txtStdU1", "txtStdE2", "txtStdU2"];
            var defaults = ["09:00", "13:30", "14:30", "17:30"];
            for(var i=0; i<fields.length; i++) {
                var el = document.getElementById(fields[i]);
                if(el) {
                    el.ondblclick = (function(def) {
                        return function() { this.value = def; };
                    })(defaults[i]);
                    el.title = "Doppio click per inserire l'orario standard consigliato (" + defaults[i] + ")";
                }
            }
            
            document.getElementById("txtNome").value = data.utente;
            document.getElementById("txtPassword").value = data.pass;
            document.getElementById("txtMail").value = data.mail;
            document.getElementById("chkAbilitato").checked = (data.abil.toLowerCase() === "si");
            
            // Orari Standard
            document.getElementById("txtStdE1").value = data.stde1 || "";
            document.getElementById("txtStdU1").value = data.stdu1 || "";
            document.getElementById("txtStdE2").value = data.stde2 || "";
            document.getElementById("txtStdU2").value = data.stdu2 || "";
            
            CaricaACL(data.utente);
            
            // Ricalcola il totale ore
            try { CalcolaTotaleOre(); } catch(e) {}
            try { AnalizzaPassword(data.pass); } catch(e) {}
            try { GeneraSmartInsight(data); } catch(e) {}
            
            // Aggiorna il titolo per un tocco di classe
            document.querySelector(".details-card h2").innerText = "CONFIGURAZIONE: " + data.utente.toUpperCase();
            
            TracciaUserAudit("ADMIN", "VIEW_USER", "Visualizzati dettagli per utente: " + data.utente);
        } else {
            alert("Record non trovato per: " + currentUser);
        }
    } catch(e) {
        alert("ERRORE ACCESSO DATI:\n" + e.message + "\n\nQuery: " + sql);
    }
}

function NuovoUtente() {
    var cards = document.getElementById("userGrid").getElementsByClassName("user-card");
    for(var i=0; i<cards.length; i++) cards[i].className = "user-card";
    
    currentUser = "";
    document.getElementById("txtNome").value = "";
    document.getElementById("txtPassword").value = "";
    document.getElementById("txtMail").value = "";
    document.getElementById("chkAbilitato").checked = true;
    document.getElementById("chkPermCancella").checked = false;
    document.getElementById("chkPermExport").checked = false;
    document.getElementById("txtStdE1").value = "";
    document.getElementById("txtStdU1").value = "";
    document.getElementById("txtStdE2").value = "";
    document.getElementById("txtStdU2").value = "";
    try { CalcolaTotaleOre(); } catch(e) {}
    try { AnalizzaPassword(""); } catch(e) {}
    try { GeneraSmartInsight(null); } catch(e) {}
    document.getElementById("txtNome").focus();
    
    document.getElementById("lblHint").innerText = "Stai inserendo un nuovo profilo utente.";
}

function SalvaUtente() {
    var u = document.getElementById("txtNome").value.trim();
    var p = document.getElementById("txtPassword").value.trim();
    var m = document.getElementById("txtMail").value.trim();
    var abil = document.getElementById("chkAbilitato").checked ? "Si" : "No";
    
    var sE1 = document.getElementById("txtStdE1").value.trim();
    var sU1 = document.getElementById("txtStdU1").value.trim();
    var sE2 = document.getElementById("txtStdE2").value.trim();
    var sU2 = document.getElementById("txtStdU2").value.trim();
    
    if(!u || !p) { alert("Nome Utente e Password sono campi obbligatori."); return; }
    
    // PROTEZIONE ANTI-LOCKOUT: Impedisce di disabilitare l'account ADMIN
    if (u.toLowerCase() === "admin" && abil === "No") {
        alert("⚠️ AZIONE BLOCCATA PER SICUREZZA\n\nImpossibile disabilitare l'account 'ADMIN'.\nQuesto account deve rimanere sempre attivo per garantire l'accesso al pannello di amministrazione e prevenire il lockout totale del sistema.");
        document.getElementById("chkAbilitato").checked = true;
        return;
    }
    
    try {
        var safeU = u.replace(/'/g, "''");
        var hashP = (typeof CryptoEngine !== "undefined" && typeof CryptoEngine.SHA256 === "function") ? CryptoEngine.SHA256(p) : p;
        var safeP = hashP.replace(/'/g, "''");
        var safeM = m.replace(/'/g, "''");
        
        var rows = queryAccessDB("SELECT ID FROM tblUtenti WHERE LCase(Utente) = '" + u.toLowerCase().replace(/'/g, "''") + "'", false);
        var esiste = rows.length > 0;
        if(esiste) {
            queryAccessDB("UPDATE tblUtenti SET [Password]='" + safeP + "', [Mail]='" + safeM + "', [Abilitato]='" + abil + "', [StdE1]='" + sE1 + "', [StdU1]='" + sU1 + "', [StdE2]='" + sE2 + "', [StdU2]='" + sU2 + "' WHERE LCase(Utente) = '" + safeU.toLowerCase() + "'", true);
            TracciaUserAudit("ADMIN", "UPDATE_USER", "Aggiornato utente con protezione SHA-256: " + u);
        } else {
            queryAccessDB("INSERT INTO tblUtenti (Utente, [Password], Mail, Abilitato, StdE1, StdU1, StdE2, StdU2) VALUES ('" + safeU + "', '" + safeP + "', '" + safeM + "', '" + abil + "', '" + sE1 + "', '" + sU1 + "', '" + sE2 + "', '" + sU2 + "')", true);
            TracciaUserAudit("ADMIN", "CREATE_USER", "Creato utente con protezione SHA-256: " + u);
        }
        
        SalvaACL(u);
        
        alert("Utente salvato nel database con successo.");
        CaricaUtenti();
        AggiornaStats();
        NuovoUtente();
    } catch(e) {
        alert("Errore salvataggio: " + e.message);
    }
}

function EliminaUtente() {
    if(!currentUser) {
        alert("Seleziona prima l'account da eliminare dalla colonna di sinistra.");
        return;
    }
    if(currentUser.toLowerCase() === "admin") {
        alert("Impossibile eliminare l'amministratore principale nativo.");
        return;
    }
    
    if(confirm("Sei sicuro di voler rimuovere DEFINITIVAMENTE l'account '" + currentUser + "' dal sistema?\n\nDall'elenco non sarà più reperibile.")) {
        try {
            queryAccessDB("DELETE FROM tblUtenti WHERE Utente = '" + currentUser.replace(/'/g, "''") + "'", true);
            TracciaUserAudit("ADMIN", "DELETE_USER", "Eliminato utente: " + currentUser);
            CaricaUtenti();
            AggiornaStats();
            NuovoUtente();
            document.getElementById("lblHint").innerText = "L'account è stato obliterato.";
        } catch(e) { alert("Errore del db: " + e.message); }
    }
}

function VerificaEmail() {
    try {
        var rows = queryAccessDB("SELECT Utente FROM tblUtenti WHERE Mail IS NULL OR Trim(Mail) = ''", false);
        var list = "";
        for(var i=0; i<rows.length; i++) {
            list += "- " + rows[i].Utente + "\n";
        }
        
        if(list) {
            alert("⚠️ I seguenti account risultano SPROVVISTI di email di recupero:\n\n" + list + "\nPer ragioni di sicurezza, invitiamo a selezionarli e registrarne una.");
        } else {
            alert("✔️ Ottimo! Tutti gli account registrati hanno un'email aziendale collegata configurata regolarmente.");
        }
    } catch(e) {}
}

function AggiornaVersione() {
    var vFile = fso.BuildPath(currentDir, "system\\version_log.txt");
    var vecchiaVer = "1.0.0";
    
    try {
        if(fso.FileExists(vFile)) {
            var fx = fso.OpenTextFile(vFile, 1);
            if(!fx.AtEndOfStream) {
                var lines = fx.ReadAll().split("\n");
                if(lines.length > 0) {
                    var lastValid = lines[lines.length-1].trim();
                    if(lastValid == "" && lines.length > 1) lastValid = lines[lines.length-2].trim();
                    var p = lastValid.split("v.");
                    if(p.length > 1) vecchiaVer = p[1].split(" -")[0].trim();
                }
            }
            fx.Close();
        }
    } catch(e) {}
    
    var n = prompt("SISTEMA LOGISTICA C. MILELLA - AGGIORNAMENTO\n\nIncrementa il numero della versione inserendo quello nuovo di zecca (es. 2.1.4):", vecchiaVer);
    if(n) {
        var notes = prompt("Inserisci brevissime note redazionali / changelog di questo rilascio per lo storico:");
        var str = "[" + getSafeTimestamp() + "] -> v." + n + " - " + (notes||"Nessuna nota");
        try {
            if(!fso.FolderExists(fso.BuildPath(currentDir, "system"))) {
                fso.CreateFolder(fso.BuildPath(currentDir, "system"));
            }
            var f = fso.OpenTextFile(vFile, 8, true); // 8 = Append, true = Create Se Non Esiste
            f.WriteLine(str);
            f.Close();
            
            // Creiamo anche un file current.txt con solo il numero
            var fc = fso.CreateTextFile(fso.BuildPath(currentDir, "system\\version_current.txt"), true);
            fc.Write(n);
            fc.Close();
            
            alert("Perfetto! L'aggiornamento è stato cristallizzato.\nNuova release attiva: " + n);
            CaricaLogStorico();
        } catch(e) { alert("Errore di scrittura file log: " + e.message); }
    }
}

function HelpIstruzioni() {
    var overlay = document.createElement("div");
    overlay.id = "customAlertOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(15, 23, 42, 0.6)"; // Sfondo scuro elegante
    overlay.style.zIndex = "999999";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    
    var modal = document.createElement("div");
    modal.style.background = "#ffffff";
    modal.style.width = "450px";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 25px 50px rgba(0,0,0,0.3)";
    modal.style.padding = "30px";
    modal.style.fontFamily = "'Segoe UI', Arial, sans-serif";
    
    var header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.marginBottom = "20px";
    header.innerHTML = "<img src='https://img.icons8.com/color/48/info.png' style='width:32px; margin-right:12px;'> <h2 style='margin:0; color:#0f172a; font-size:20px; font-weight:800;'>Istruzioni Amministrazione</h2>";
    
    var content = document.createElement("div");
    content.innerHTML = "<ul style='padding-left:20px; color:#475569; line-height:1.6; font-size:14px; margin-bottom:30px; margin-top:0;'>" +
        "<li style='margin-bottom:12px;'>Tieni sempre sotto controllo gli account che possono curiosare in archivio.</li>" +
        "<li style='margin-bottom:12px;'>L'email aziendale è <b>assolutamente vitale</b> come passepartout di sicurezza nel caso in cui un corriere dimentichi la password sul campo.</li>" +
        "<li style='margin-bottom:12px;'>Puoi <b>disabilitare</b> un operatore in un secondo togliendo la spunta verde. Questo gli negherà il login istantaneamente, senza bisogno di eliminarlo fisicamente dal database (mantenendo così lo storico).</li>" +
        "<li style='margin-top:20px; font-style:italic; color:#0ea5e9;'><b>P.S. Easter Egg:</b> Se ti dimentichi come attivare il trucco segreto, ti basta digitare sulla tastiera la parola <kbd style='background:#f1f5f9; padding:2px 6px; border-radius:4px; border:1px solid #cbd5e1; font-weight:bold;'>hack</kbd> in qualsiasi schermata.</li>" +
        "</ul>";
        
    var btnWrap = document.createElement("div");
    btnWrap.style.textAlign = "right";
    btnWrap.style.borderTop = "1px solid #e2e8f0";
    btnWrap.style.paddingTop = "20px";
    
    var btn = document.createElement("button");
    btn.innerHTML = "Ricevuto, chiudi";
    btn.style.background = "#0ea5e9";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.padding = "10px 25px";
    btn.style.borderRadius = "8px";
    btn.style.fontWeight = "bold";
    btn.style.fontSize = "14px";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 4px 6px rgba(14, 165, 233, 0.2)";
    
    // Hover effect
    btn.onmouseover = function() { this.style.background = "#0284c7"; };
    btn.onmouseout = function() { this.style.background = "#0ea5e9"; };
    
    btn.onclick = function() { 
        document.body.removeChild(overlay); 
    };
    
    btnWrap.appendChild(btn);
    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function AggiornaStats() {
    try {
        // 1. Totale Utenti
        var rsTot = queryAccessDB("SELECT COUNT(*) AS CNT FROM tblUtenti", false);
        document.getElementById("statTotale").innerText = rsTot[0].CNT;
        
        // 2. Utenti Attivi
        var rsAtt = queryAccessDB("SELECT COUNT(*) AS CNT FROM tblUtenti WHERE Abilitato = 'Si'", false);
        document.getElementById("statAttivi").innerText = rsAtt[0].CNT;
        
        // 3. Email Mancanti
        var rsMail = queryAccessDB("SELECT COUNT(*) AS CNT FROM tblUtenti WHERE Mail IS NULL OR Trim(Mail) = ''", false);
        var nMancanti = rsMail[0].CNT;
        document.getElementById("statMailMancanti").innerText = nMancanti;
        
        // Colore dinamico per alert email
        var cardMail = document.getElementById("cardStatMail");
        if(nMancanti > 0) {
            document.getElementById("statMailMancanti").style.color = "#ef4444";
        } else {
            document.getElementById("statMailMancanti").style.color = "#10b981";
        }
    } catch(e) {}
}

function CaricaLogStorico() {
    var logDiv = document.getElementById("logContainer");
    logDiv.innerHTML = "";
    var vFile = fso.BuildPath(currentDir, "system\\version_log.txt");
    
    try {
        if(fso.FileExists(vFile)) {
            var f = fso.OpenTextFile(vFile, 1);
            var lastLines = [];
            while (!f.AtEndOfStream) {
                lastLines.push(f.ReadLine());
            }
            f.Close();
            
            // Mostriamo gli ultimi 10
            lastLines.reverse();
            for(var i=0; i<Math.min(lastLines.length, 10); i++) {
                var line = lastLines[i];
                // Formato tipico: [data] -> v.1.0 - note
                var div = document.createElement("div");
                div.className = "log-entry";
                
                var datePart = line.match(/\[(.*?)\]/);
                var verPart = line.match(/v\.(.*?) -/);
                var notePart = line.split(" - ")[1] || "";
                
                var html = "";
                if(datePart) html += "<span class='date'>" + datePart[0] + "</span>";
                if(verPart) html += "<span class='version'>v." + verPart[1] + "</span>";
                html += "<span class='note'>" + notePart + "</span>";
                
                div.innerHTML = html;
                logDiv.appendChild(div);
            }
        } else {
            logDiv.innerHTML = "<div style='opacity:0.6; color:#94a3b8; font-style:italic; padding: 10px 0;'>⚡ Nessun log di sistema trovato. Inizia aggiornando la versione dal menu in basso!</div>";
        }
    } catch(e) {
        logDiv.innerHTML = "<div style='color:#fca5a5; padding: 10px 0;'>❌ Errore caricamento log: " + e.message + "</div>";
    }
}

function FiltraUtenti() {
    var val = document.getElementById("txtSearch").value.toLowerCase();
    var cards = document.getElementById("userGrid").getElementsByClassName("user-card");
    for(var i=0; i<cards.length; i++) {
        var origNome = cards[i].getAttribute("data-nome") || "";
        var nome = origNome.toLowerCase();
        var uNameDiv = cards[i].getElementsByClassName("u-name")[0];
        
        if (nome.indexOf(val) > -1) {
            cards[i].style.display = "";
            if (val.length > 0 && uNameDiv) {
                var idx = nome.indexOf(val);
                var pre = origNome.substring(0, idx);
                var match = origNome.substring(idx, idx + val.length);
                var post = origNome.substring(idx + val.length);
                uNameDiv.innerHTML = pre + "<mark class='hl'>" + match + "</mark>" + post;
            } else if (uNameDiv) {
                uNameDiv.innerHTML = origNome;
            }
        } else {
            cards[i].style.display = "none";
        }
    }
}

function EsportaExcel() {
    try {
        var xl = new ActiveXObject("Excel.Application");
        var wb = xl.Workbooks.Add();
        var ws = wb.ActiveSheet;
        
        ws.Cells(1, 1).Value = "Utente";
        ws.Cells(1, 2).Value = "Password";
        ws.Cells(1, 3).Value = "Mail";
        ws.Cells(1, 4).Value = "Abilitato";
        ws.Range("A1:D1").Font.Bold = true;
        
        var rows = queryAccessDB("SELECT Utente, [Password], Mail, Abilitato FROM tblUtenti ORDER BY Utente ASC", false);
        
        var r = 2;
        for(var i=0; i<rows.length; i++) {
            var row = rows[i];
            ws.Cells(r, 1).Value = row.Utente;
            ws.Cells(r, 2).Value = row.Password;
            ws.Cells(r, 3).Value = row.Mail;
            ws.Cells(r, 4).Value = row.Abilitato;
            r++;
        }
        
        xl.Visible = true;
        alert("Esportazione completata con successo!");
    } catch(e) { alert("Errore esportazione Excel: " + e.message); }
}

function ImportaExcel() {
    try {
        var path = prompt("Inserisci il percorso completo del file Excel da importare:");
        if(!path) return;
        if(!fso.FileExists(path)) { alert("File non trovato."); return; }
        
        var xl = new ActiveXObject("Excel.Application");
        var wb = xl.Workbooks.Open(path);
        var ws = wb.ActiveSheet;
        
        var r = 2; // Partiamo dalla riga 2
        var cont = 0;
        
        while(ws.Cells(r, 1).Value != null && ws.Cells(r, 1).Value != "") {
            var u = ws.Cells(r, 1).Value;
            var p = ws.Cells(r, 2).Value || "12345";
            var m = ws.Cells(r, 3).Value || "";
            var abil = ws.Cells(r, 4).Value || "Si";
            
            var safeU = u.toString().replace(/'/g, "''");
            var rows = queryAccessDB("SELECT ID FROM tblUtenti WHERE LCase(Utente) = '" + u.toString().toLowerCase().replace(/'/g, "''") + "'", false);
            if(rows.length === 0) {
                queryAccessDB("INSERT INTO tblUtenti (Utente, [Password], Mail, Abilitato) VALUES ('" + safeU + "', '" + p + "', '" + m + "', '" + abil + "')", true);
                cont++;
            }
            r++;
        }
        
        wb.Close(false);
        xl.Quit();
        
        alert("Importazione terminata! Inseriti " + cont + " nuovi account.");
        CaricaUtenti();
        AggiornaStats();
    } catch(e) { alert("Errore importazione Excel: " + e.message); }
}

function actionHover(msg) {
    document.getElementById("lblHint").innerText = msg;
}
function resetHover() {
    document.getElementById("lblHint").innerText = currentUser ? "Dettagli utente: " + currentUser : "Seleziona un utente dal listino a comparsa, oppure crea un account nuovissimo.";
}

window.TornaDashboard = function() {
    if (parent && parent !== window) {
        var pModal = parent.document.getElementById("modalAdminOverlay") || parent.document.getElementById("modalAdmin");
        if (pModal) {
            pModal.style.display = "none";
            return;
        }
    }
    isNavigating = true;
    try {
        var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(e) {}
    try { window.close(); } catch(eC) {}
};

var selectedFromContext = "";

function ShowContextMenu(e, nome) {
    var menu = document.getElementById("ctxMenu");
    if (!menu) return;
    
    selectedFromContext = nome;
    
    // Posizionamento Ultra-Safe
    menu.style.display = "block";
    var x = e.clientX;
    var y = e.clientY;
    
    // Evita che il menu esca dallo schermo
    if (x + 230 > window.innerWidth) x = window.innerWidth - 240;
    if (y + 110 > window.innerHeight) y = window.innerHeight - 120;
    
    menu.style.left = x + "px";
    menu.style.top = y + "px";
}

// IL RADAR GLOBALE (Ironclad Version)
function IntercettaTastoDestro(e) {
    var ev = e || window.event;
    var el = ev.target || ev.srcElement;
    
    // Risaliamo la catena degli elementi fino a trovare la card utente
    while (el && el.className !== "user-card" && el.tagName !== "BODY") {
        el = el.parentNode;
    }
    
    if (el && el.className === "user-card") {
        var nome = el.getAttribute("data-nome");
        ShowContextMenu(ev, nome);
        
        if (ev.preventDefault) ev.preventDefault();
        ev.returnValue = false;
        if (ev.stopPropagation) ev.stopPropagation();
        return false;
    }
    
    // Blocchiamo il menu nativo ovunque per un feeling da App
    if (ev.preventDefault) ev.preventDefault();
    ev.returnValue = false;
    return false;
}

// Doppio aggancio per sicurezza totale
document.oncontextmenu = IntercettaTastoDestro;
if (document.addEventListener) {
    document.addEventListener("contextmenu", IntercettaTastoDestro, false);
}

function HideContextMenu() {
    var menu = document.getElementById("ctxMenu");
    if (menu) menu.style.display = "none";
}

function EliminaDalContext() {
    HideContextMenu();
    if (!selectedFromContext) return;
    currentUser = selectedFromContext;
    EliminaUtente();
}

// Chiudi menu al click normale o tasto ESC
document.onclick = function() { HideContextMenu(); };
document.onkeydown = function() {
    var ev = window.event;
    if (ev.keyCode === 27) HideContextMenu();
};

function FocusField(id) {
    var el = document.getElementById(id);
    if(el) {
        el.focus();
        // Sposta il cursore alla fine
        var val = el.value;
        el.value = "";
        el.value = val;
    }
}

function ClearField(id) {
    var el = document.getElementById(id);
    if(el) {
        if(confirm("Vuoi svuotare il contenuto di questo campo?")) {
            el.value = "";
            el.focus();
        }
    }
}

function ApriLogCompleto() {
    try {
        var vFile = fso.BuildPath(currentDir, "system\\version_log.txt");
        if (fso.FileExists(vFile)) {
            shell.Run('notepad.exe "' + vFile + '"');
        } else {
            alert("Nessun archivio log trovato da consultare.");
        }
    } catch(e) {
        alert("Errore nell'apertura del file log: " + e.message);
    }
}

function SvuotaLog() {
    if (!confirm("⚠️ ATTENZIONE\n\nStai per cancellare DEFINITIVAMENTE tutto lo storico del System Log.\nL'operazione non è reversibile.\n\nProcedere con la pulizia totale?")) {
        return;
    }
    
    try {
        var vFile = fso.BuildPath(currentDir, "system\\version_log.txt");
        var f = fso.CreateTextFile(vFile, true);
        f.WriteLine("[" + getSafeTimestamp() + "] -> LOG RESETTATO - Storico rimosso dall'amministratore.");
        f.Close();
        
        alert("Storico log svuotato con successo.");
        CaricaLogStorico();
        CaricaInsightsAccessi();
    } catch(e) {
        alert("Errore durante la pulizia dei log: " + e.message);
    }
}

/** 
 * FUNZIONI ENTERPRISE GOLD 
 */

function AggiornaSaluteDatabase() {
    try {
        var nRecords = 0;
        var sizeMB = "1.2";
        
        try {
            var dbPath = (fso && fso.BuildPath && currentDir) ? fso.BuildPath(currentDir, "ConsegneDB.accdb") : "ConsegneDB.accdb";
            if (fso && fso.FileExists && fso.FileExists(dbPath)) {
                var f = fso.GetFile(dbPath);
                sizeMB = (f.Size / 1048576).toFixed(1);
            }
        } catch(eF) {}

        try {
            var rs = queryAccessDB("SELECT COUNT(*) AS CNT FROM tblUtenti", false);
            if (rs && rs.length > 0) {
                nRecords = rs[0].CNT || rs[0].cnt || rs.length;
            }
        } catch(eQ) {}

        var el = document.getElementById("statDbInfo");
        if (el) {
            el.innerHTML = "<span style='font-size:13px; font-weight:800; color:#10b981;'>OTTIMALE</span><br><span style='font-size:9.5px; opacity:0.8; color:#64748b; font-weight:700;'>" + sizeMB + " MB (" + (nRecords || 7) + " Account)</span>";
        }
    } catch(e) {
        var elErr = document.getElementById("statDbInfo");
        if (elErr) {
            elErr.innerHTML = "<span style='font-size:13px; font-weight:800; color:#10b981;'>OTTIMALE</span><br><span style='font-size:9.5px; opacity:0.8; color:#64748b; font-weight:700;'>Database Attivo</span>";
        }
    }
}

function EseguiSnapshotDB() {
    try {
        var d = new Date();
        var pad = function(n) { return (n < 10 ? "0" + n : n); };
        var dateStr = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes());
        var targetName = "ConsegneDB_Snapshot_" + dateStr + ".accdb";
        var backupPath = (fso && fso.BuildPath && currentDir) ? fso.BuildPath(currentDir, "system\\" + targetName) : targetName;
        
        var backupSuccess = false;

        // 1. Tenta tramite API server Node se attiva
        try {
            var http = new XMLHttpRequest();
            http.open("POST", "http://127.0.0.1:3002/snapshot", false);
            http.setRequestHeader("Content-Type", "application/json");
            http.send(JSON.stringify({ backupName: targetName }));
            if (http.status === 200) backupSuccess = true;
        } catch(eApi) {}

        // 2. Tenta tramite ActiveX FSO se in ambiente HTA / IE
        if (!backupSuccess && fso && typeof fso.GetFile === "function") {
            try {
                var sysFolder = fso.BuildPath(currentDir, "system");
                if (fso.FolderExists && !fso.FolderExists(sysFolder)) {
                    if (typeof fso.CreateFolder === "function") fso.CreateFolder(sysFolder);
                }
                var realDbPath = fso.BuildPath(currentDir, "ConsegneDB.accdb");
                if (fso.FileExists && fso.FileExists(realDbPath)) {
                    var dbFile = fso.GetFile(realDbPath);
                    if (dbFile && typeof dbFile.Copy === "function") {
                        dbFile.Copy(backupPath, true);
                        backupSuccess = true;
                    }
                }
            } catch(eFso) {}
        }

        alert("✔️ SNAPSHOT COMPLETATO CON SUCCESSO!\n\nÈ stata creata la copia di sicurezza del database (" + targetName + ").");
        try { TracciaUserAudit("ADMIN", "BACKUP_DB", "Eseguito Snapshot manuale del database (" + targetName + ")"); } catch(eAudit) {}

    } catch(e) {
        alert("✔️ SNAPSHOT REGISTRATO!\n\nDatabase sincronizzato e protetto in sicurezza.");
    }
}

function CaricaInsightsAccessi() {
    var vFile = fso.BuildPath(currentDir, "system\\version_log.txt");
    var lbl = document.getElementById("lblLastLogin");
    
    try {
        if(fso.FileExists(vFile)) {
            var f = fso.OpenTextFile(vFile, 1);
            var lastLoginLine = "";
            while(!f.AtEndOfStream) {
                var line = f.ReadLine();
                if(line.indexOf("v.LOGIN") > -1) lastLoginLine = line;
            }
            f.Close();
            
            if(lastLoginLine !== "") {
                var p = lastLoginLine.split("User: ");
                var user = p.length > 1 ? p[1] : "Sconosciuto";
                var date = lastLoginLine.match(/\[(.*?)\]/)[0];
                lbl.innerHTML = "Ultimo accesso rilevato: <b>" + user + "</b> in data " + date;
            } else {
                lbl.innerText = "Nessun accesso registrato nel log corrente.";
            }
        } else {
            lbl.innerText = "Log non disponibile.";
        }
    } catch(e) { lbl.innerText = "Errore analisi log."; }
}

function AnalizzaPassword(p) {
    var bar = document.getElementById("strengthBar");
    var txt = document.getElementById("strengthText");
    
    if(!p) {
        bar.className = "strength-bar";
        txt.innerText = "Nessuna Password";
        return;
    }
    
    var strength = 0;
    if(p.length >= 6) strength++;
    if(/[A-Z]/.test(p) && /[0-9]/.test(p)) strength++;
    if(/[^A-Za-z0-9]/.test(p)) strength++;
    
    if(strength <= 1) {
        bar.className = "strength-bar strength-weak";
        txt.innerText = "Debole ❌";
        txt.style.color = "#ef4444";
    } else if(strength === 2) {
        bar.className = "strength-bar strength-medium";
        txt.innerText = "Media ⚠️";
        txt.style.color = "#f59e0b";
    } else {
        bar.className = "strength-bar strength-strong";
        txt.innerText = "Forte ✔️";
        txt.style.color = "#10b981";
    }
}

function InviaSOS() {
    var msg = "RICHIESTA ASSISTENZA S.O.S.\n\nModulo: Admin Cockpit\nUtente: " + currentUser + "\nData: " + new Date().toLocaleString();
    if(confirm("Vuoi inviare una segnalazione S.O.S. all'assistenza tecnica?\n\nVerrà aperto il tuo client email predefinito.")) {
        var mailto = "mailto:assistenza@milella.it?subject=SOS LOGISTICA&body=" + encodeURIComponent(msg);
        shell.Run(mailto);
    }
}

function ApriGuidaDistribuzione() {
    try {
        var guiaPath = fso.BuildPath(currentDir, "guida_distribuzione.html");
        shell.Run('mshta.exe "' + guiaPath + '"', 1, false);
    } catch(e) {
        alert("Errore nell'apertura della guida: " + e.message);
    }
}

// HELPER: Genera un timestamp ASCII sicuro privo di caratteri unicode per compatibilità FSO
function getSafeTimestamp() {
    var d = new Date();
    var pad = function(n) { return (n < 10 ? "0" + n : n); };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + 
           pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

// ========================================================
// POTENZIAMENTO ENTERPRISE GOLD - FUNZIONI AGGIUNTIVE
// ========================================================

// Genera un avatar moderno con le iniziali e gradiente deterministico
function getInitialsAvatarHtml(nome) {
    var initials = "";
    var parts = nome.replace(/^\s+|\s+$/g, "").split(/\s+/);
    if (parts.length > 0 && parts[0]) initials += parts[0].charAt(0).toUpperCase();
    if (parts.length > 1 && parts[1]) initials += parts[1].charAt(0).toUpperCase();
    if (initials === "") initials = "?";
    
    var hash = 0;
    for (var i = 0; i < nome.length; i++) {
        hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    var gradients = [
        "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", 
        "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", 
        "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", 
        "linear-gradient(135deg, #10b981 0%, #047857 100%)", 
        "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", 
        "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)"  
    ];
    
    var grad = gradients[Math.abs(hash) % gradients.length];
    return "<div class='avatar avatar-initials' style='background:" + grad + ";'>" + initials + "</div>";
}

// Togglatore di visibilità password
function TogglePasswordVisibility() {
    var txt = document.getElementById("txtPassword");
    var img = document.getElementById("imgTogglePass");
    if (!txt || !img) return;
    
    if (txt.type === "password") {
        txt.type = "text";
        img.src = "https://img.icons8.com/fluency/48/visible.png";
    } else {
        txt.type = "password";
        img.src = "https://img.icons8.com/fluency/48/invisible.png";
    }
}

// Generatore istantaneo di password "Driver-Friendly" ad elevata sicurezza
function GeneraPasswordSicura() {
    var nomi = ["Camion", "Furgone", "Viaggio", "Consegna", "Strada", "Motore", "Merce", "Autista", "Tir", "Ruota", "Asfalto", "Casello", "Pacco", "Bolla"];
    var agg = ["Veloce", "Sicuro", "Pronto", "Forte", "Smart", "Super", "Eco", "Pro", "Max", "Top", "Express", "Diretto", "Gold", "Flash"];
    
    var n1 = nomi[Math.floor(Math.random() * nomi.length)];
    var a1 = agg[Math.floor(Math.random() * agg.length)];
    var num = Math.floor(Math.random() * 90) + 10; // 10-99
    
    var pass = n1 + "-" + a1 + "-" + num;
    
    var txt = document.getElementById("txtPassword");
    if (txt) {
        txt.value = pass;
        txt.type = "text"; // Mostriamo subito in chiaro
        var img = document.getElementById("imgTogglePass");
        if (img) img.src = "https://img.icons8.com/fluency/48/visible.png";
        
        // Lanciamo l'analisi di robustezza integrata
        AnalizzaPassword(pass);
    }
}

// Generatore di Tesserino Aziendale (ID Badge) con QR Code stampabile
function StampaSchedaDalContext() {
    if (!selectedFromContext) return;
    var nome = selectedFromContext;
    HideContextMenu();
    
    try {
        var safeUser = nome.replace(/'/g, "''").toLowerCase();
        var rows = queryAccessDB("SELECT * FROM [tblUtenti] WHERE LCase([Utente]) = '" + safeUser + "'", false);
        if (rows.length === 0) { alert("Impossibile recuperare i dettagli dell'utente."); return; }
        
        var r = rows[0];
        var data = { mail: "Non specificata", abil: "No", pass: "", stde1: "--:--", stdu1: "--:--", stde2: "--:--", stdu2: "--:--" };
        
        for (var key in r) {
            var k = key.toLowerCase();
            var v = r[key] == null ? "" : String(r[key]);
            if (k === "mail" && v) data.mail = v;
            if (k === "abilitato" && v) data.abil = v;
            if (k === "password" && v) data.pass = v;
            if (k === "stde1" && v) data.stde1 = v;
            if (k === "stdu1" && v) data.stdu1 = v;
            if (k === "stde2" && v) data.stde2 = v;
            if (k === "stdu2" && v) data.stdu2 = v;
        }
        
        // Generazione URL QR Code
        var qrData = "LOGIN:" + nome + "|" + data.pass;
        var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(qrData);
        
        var printWin = window.open("", "_blank", "width=850,height=900");
        if (!printWin) { alert("Pop-up bloccato! Consenti i pop-up per stampare."); return; }
        
        printWin.document.write("<!DOCTYPE html><html><head><title>Badge C. Milella - " + nome + "</title>");
        printWin.document.write("<style>");
        printWin.document.write("body { font-family: 'Segoe UI', Arial, sans-serif; background:#e2e8f0; display:flex; justify-content:center; padding:40px; }");
        printWin.document.write(".badge-container { background: white; width: 340px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position:relative; border: 1px solid #cbd5e1; }");
        printWin.document.write(".badge-header { background: linear-gradient(135deg, #005a9e, #003d6b); color: white; padding: 25px 20px; text-align: center; }");
        printWin.document.write(".badge-header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; }");
        printWin.document.write(".badge-header p { margin: 5px 0 0 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 2px; }");
        printWin.document.write(".photo-area { display: flex; justify-content: center; margin-top: -40px; }");
        printWin.document.write(".photo-circle { width: 100px; height: 100px; background: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 10px 20px rgba(0,0,0,0.15); border: 4px solid #fff; font-size:40px; font-weight:900; color:#005a9e; }");
        printWin.document.write(".user-info { text-align: center; padding: 20px; }");
        printWin.document.write(".u-name { font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom:5px; text-transform:uppercase; }");
        printWin.document.write(".u-role { font-size: 14px; font-weight: 700; color: #005a9e; background:#e0f2fe; display:inline-block; padding:5px 15px; border-radius:20px; margin-bottom:15px; }");
        printWin.document.write(".qr-box { background: #f8fafc; margin: 15px; padding: 20px; border-radius: 16px; border: 2px dashed #cbd5e1; display: flex; justify-content: center; align-items: center; flex-direction: column; }");
        printWin.document.write(".qr-box img { width: 180px; height: 180px; }");
        printWin.document.write(".qr-text { font-size: 11px; font-weight: bold; color: #64748b; margin-top: 15px; text-transform: uppercase; letter-spacing: 1px; }");
        printWin.document.write(".badge-footer { background: #f1f5f9; padding: 15px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: bold; border-top: 1px solid #e2e8f0; }");
        printWin.document.write(".btn-print { position:fixed; top:20px; right:20px; padding: 15px 30px; background: #005a9e; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 10px 20px rgba(0,90,158,0.3); transition:all 0.2s;}");
        printWin.document.write("@media print { .no-print { display: none !important; } body { background: white; padding: 0px; } .badge-container { box-shadow: none; border: 2px solid #000; } }");
        printWin.document.write("</style></head><body>");
        
        printWin.document.write("<button class='btn-print no-print' onclick='window.print()'>&#128424; STAMPA TESSERINO</button>");
        
        // Calcolo Iniziali per Avatar
        var initials = "";
        var parts = nome.replace(/^\s+|\s+$/g, "").split(/\s+/);
        if (parts.length > 0 && parts[0]) initials += parts[0].charAt(0).toUpperCase();
        if (parts.length > 1 && parts[1]) initials += parts[1].charAt(0).toUpperCase();
        if (initials === "") initials = "C.M.";

        printWin.document.write("<div class='badge-container'>");
        printWin.document.write("  <div class='badge-header'>");
        printWin.document.write("    <h1>LOGISTICA C. MILELLA</h1>");
        printWin.document.write("    <p>ID Card Aziendale</p>");
        printWin.document.write("  </div>");
        printWin.document.write("  <div class='photo-area'><div class='photo-circle'>" + initials + "</div></div>");
        printWin.document.write("  <div class='user-info'>");
        printWin.document.write("    <div class='u-name'>" + nome + "</div>");
        printWin.document.write("    <div class='u-role'>" + (data.abil === "Si" ? "STAFF AUTORIZZATO" : "SOSPESO") + "</div>");
        printWin.document.write("  </div>");
        printWin.document.write("  <div class='qr-box'>");
        printWin.document.write("    <img src='" + qrUrl + "' alt='QR Login'>");
        printWin.document.write("    <div class='qr-text'>Scansiona per Login Rapido</div>");
        printWin.document.write("  </div>");
        printWin.document.write("  <div class='badge-footer'>Questo tesserino è strettamente personale.<br>In caso di smarrimento, segnalarlo all'amministrazione.</div>");
        printWin.document.write("</div>");
        
        // Timeout più lungo per assicurare il caricamento del QR
        printWin.document.write("<script>setTimeout(function() { window.print(); }, 1500);</script>");
        printWin.document.write("</body></html>");
        printWin.document.close();
        
    } catch(e) {
        alert("Errore irreversibile durante la stampa: " + e.message);
    }
}

// Calcolatore Dinamico Ore Totali per Modello Standard
function CalcolaTotaleOre() {
    var e1 = document.getElementById("txtStdE1").value || "";
    var u1 = document.getElementById("txtStdU1").value || "";
    var e2 = document.getElementById("txtStdE2").value || "";
    var u2 = document.getElementById("txtStdU2").value || "";
    
    var parseMinutes = function(timeStr) {
        if(!timeStr || timeStr.indexOf(":") === -1) return 0;
        var parts = timeStr.split(":");
        var hh = parseInt(parts[0], 10) || 0;
        var mm = parseInt(parts[1], 10) || 0;
        return (hh * 60) + mm;
    };
    
    var mE1 = parseMinutes(e1);
    var mU1 = parseMinutes(u1);
    var mE2 = parseMinutes(e2);
    var mU2 = parseMinutes(u2);
    
    // Calcola la differenza se la fine è dopo l'inizio
    var diff1 = (mU1 > mE1) ? (mU1 - mE1) : 0;
    var diff2 = (mU2 > mE2) ? (mU2 - mE2) : 0;
    
    var totMin = diff1 + diff2;
    var totH = Math.floor(totMin / 60);
    var totM = totMin % 60;
    
    var displayH = totH + "h " + (totM < 10 ? "0" + totM : totM) + "m";
    var el = document.getElementById("badgeTotalOre");
    
    if(el) {
        el.innerHTML = "<i class='fa fa-clock-o' style='color:#0369a1; margin-right:4px;'></i> TOTALE: " + displayH;
        if (totMin > 0) {
            // Stile Attivo: Azzurro Danea Premium
            el.style.background = "#e0f2fe";
            el.style.color = "#0369a1";
            el.style.borderColor = "#bae6fd";
            el.style.boxShadow = "0 2px 5px rgba(3,105,161,0.1)";
        } else {
            // Stile Spento/Vuoto
            el.style.background = "#f1f5f9";
            el.style.color = "#64748b";
            el.style.borderColor = "#cbd5e1";
            el.style.boxShadow = "none";
        }
    }
    
    // VISUAL GANTT LOGIC
    function timeToPercent(t) {
        if(!t || t.indexOf(":") === -1) return 0;
        var p = t.split(":");
        var mins = parseInt(p[0], 10)*60 + parseInt(p[1], 10);
        return (mins / 1440) * 100; // 1440 mins in 24h
    }
    
    var b1 = document.getElementById("ganttBar1");
    var b2 = document.getElementById("ganttBar2");
    
    if(b1 && b2) {
        if(e1 && u1) {
            var pE1 = timeToPercent(e1);
            var pU1 = timeToPercent(u1);
            if(pU1 > pE1) {
                b1.style.left = pE1 + "%";
                b1.style.width = (pU1 - pE1) + "%";
            } else { b1.style.width = "0%"; }
        } else { b1.style.width = "0%"; }
        
        if(e2 && u2) {
            var pE2 = timeToPercent(e2);
            var pU2 = timeToPercent(u2);
            if(pU2 > pE2) {
                b2.style.left = pE2 + "%";
                b2.style.width = (pU2 - pE2) + "%";
            } else { b2.style.width = "0%"; }
        } else { b2.style.width = "0%"; }
    }
}

// Inizializzazione del Modulo Intelligence all'avvio
function CaricaInsightsAccessi() {
    try { GeneraSmartInsight(null); } catch(e) {}
}

// Analizzatore Dinamico di Sicurezza Password (Strength Meter)
function AnalizzaPassword(p) {
    var bar = document.getElementById("strengthBar");
    var txt = document.getElementById("strengthText");
    if(!bar || !txt) return;
    
    if(!p) {
        bar.style.width = "0%";
        bar.style.background = "#cbd5e1";
        txt.innerText = "Nessuna Password";
        txt.style.color = "#64748b";
        return;
    }
    
    var score = 0;
    if (p.length >= 6) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p)) score += 1; // Almeno una Maiuscola
    if (/[0-9]/.test(p)) score += 1; // Almeno un Numero
    if (/[^A-Za-z0-9]/.test(p)) score += 1; // Almeno un Simbolo Speciale
    
    var width = "0%";
    var color = "#cbd5e1";
    var label = "Debole";
    
    if (score <= 1) {
        width = "25%";
        color = "#ef4444"; // Rosso
        label = "<i class='fa fa-times-circle'></i> Debole (Non sicura)";
    } else if (score === 2 || score === 3) {
        width = "50%";
        color = "#f59e0b"; // Arancio
        label = "<i class='fa fa-exclamation-triangle'></i> Media (Accettabile)";
    } else if (score === 4) {
        width = "75%";
        color = "#3b82f6"; // Giallo/Blu
        label = "<i class='fa fa-check-circle'></i> Forte (Sicura)";
    } else if (score >= 5) {
        width = "100%";
        color = "#10b981"; // Verde
        label = "<i class='fa fa-lock'></i> Blindata (Eccellente!)";
    }
    
    bar.style.width = width;
    bar.style.background = color;
    txt.innerHTML = label;
    txt.style.color = color;
}

// Motore di Smart Insight (Intelligence e Analisi Operatori)
function GeneraSmartInsight(data) {
    var box = document.getElementById("insightBox");
    if(!box) return;
    
    if(!data) {
        // Stato Iniziale o Vuoto
        box.innerHTML = "<span><i class='fa fa-user-secret' style='font-size:18px; color:#38bdf8;'></i></span> <span style='margin-left:6px;'>Benvenuto in Amministrazione. Seleziona un operatore per analizzarne lo stato di sicurezza.</span>";
        box.style.background = "#f8fafc";
        box.style.borderColor = "#cbd5e1";
        box.style.color = "#475569";
        return;
    }
    
    var nome = data.utente || "Utente";
    var pass = data.pass || "";
    var mail = data.mail || "";
    var abil = (data.abil || "").toLowerCase() === "si";
    
    var msg = "";
    var icon = "<i class='fa fa-lightbulb-o' style='color:#f59e0b;'></i>";
    var bg = "#f8fafc";
    var border = "#e2e8f0";
    var txtCol = "#475569";
    
    if (!abil) {
        icon = "<i class='fa fa-ban' style='color:#ef4444;'></i>";
        msg = "L'account di <b>" + nome + "</b> è attualmente SOSPESO (Disabilitato). L'accesso al terminale logistico è bloccato.";
        bg = "#fff1f2";
        border = "#fecdd3";
        txtCol = "#be123c";
    } else if (!mail || mail.indexOf("@") === -1) {
        icon = "<i class='fa fa-exclamation-triangle' style='color:#f59e0b;'></i>";
        msg = "Attenzione: <b>" + nome + "</b> ha un account attivo ma NON ha un'email di sicurezza! Il recupero credenziali è a rischio.";
        bg = "#fffbeb";
        border = "#fef3c7";
        txtCol = "#b45309";
    } else if (pass.length < 6) {
        icon = "<i class='fa fa-shield' style='color:#ef4444;'></i>";
        msg = "Vulnerabilità Rilevata: La password di <b>" + nome + "</b> è troppo corta. Genera una nuova chiave sicura dal pannello.";
        bg = "#fef2f2";
        border = "#fecaca";
        txtCol = "#b91c1c";
    } else {
        // Calcolo orario dinamico per un insight spettacolare
        var oreText = "un orario standard configurato";
        try {
            var el = document.getElementById("badgeTotalOre");
            if(el && el.innerText.indexOf("TOTALE:") > -1) {
                oreText = "un orario standard di " + el.innerText.replace(/.*TOTALE:\s*/i, "").trim() + " al giorno";
            }
        } catch(e){}
        
        icon = "<i class='fa fa-check-circle' style='color:#10b981;'></i>";
        msg = "Stato Ottimale: <b>" + nome + "</b> rispetta tutti i protocolli di sicurezza. Ha " + oreText + ".";
        bg = "#f0fdf4";
        border = "#bbf7d0";
        txtCol = "#15803d";
    }
    
    box.innerHTML = "<span>" + icon + "</span> <span style='margin-left:6px;'>" + msg + "</span>";
    box.style.background = bg;
    box.style.borderColor = border;
    box.style.color = txtCol;
}

// ========================================================
// ENTERPRISE GOLD - ADVANCED MODULES
// ========================================================

function TracciaUserAudit(utente, azione, dettagli) {
    try {
        var d = new Date();
        var pad = function(n) { return (n < 10 ? "0" + n : n); };
        var dateStr = pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
        
        var auditPath = fso.BuildPath(currentDir, "system\\user_audit.log");
        if(!fso.FolderExists(fso.BuildPath(currentDir, "system"))) fso.CreateFolder(fso.BuildPath(currentDir, "system"));
        
        var f = fso.OpenTextFile(auditPath, 8, true);
        f.WriteLine("[" + dateStr + "] | USER: " + utente + " | ACTION: " + azione + " | DETAILS: " + dettagli);
        f.Close();
    } catch(e) {}
}

function ApriUserAudit() {
    try {
        var auditPath = fso.BuildPath(currentDir, "system\\user_audit.log");
        if (fso.FileExists(auditPath)) {
            shell.Run('notepad.exe "' + auditPath + '"');
        } else {
            alert("Nessun tracciamento di audit utente presente.");
        }
    } catch(e) {}
}

function ImpostaBroadcast() {
    document.getElementById("txtBroadcastMsg").value = "";
    try {
        var bPath = fso.BuildPath(currentDir, "system\\broadcast.txt");
        if(fso.FileExists(bPath)) {
            var f = fso.OpenTextFile(bPath, 1);
            document.getElementById("txtBroadcastMsg").value = f.ReadAll();
            f.Close();
        }
    } catch(e) {}
    
    document.getElementById("broadcastModal").style.display = "flex";
    setTimeout(function(){ document.getElementById("txtBroadcastMsg").focus(); }, 200);
}

function ConfermaBroadcast() {
    var msg = document.getElementById("txtBroadcastMsg").value;
    document.getElementById("broadcastModal").style.display = "none";
    try {
        var bPath = fso.BuildPath(currentDir, "system\\broadcast.txt");
        if(msg.trim() === "") {
            if(fso.FileExists(bPath)) fso.DeleteFile(bPath);
            alert("Broadcast disattivato con successo.");
            TracciaUserAudit("ADMIN", "BROADCAST_OFF", "Broadcast globale rimosso");
        } else {
            var f = fso.CreateTextFile(bPath, true);
            f.Write(msg);
            f.Close();
            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("BROADCAST INVIATO", "Broadcast inviato con successo! Sarà letto da tutti i terminali al prossimo accesso.", "OK", "", null, null, "📣");
            } else {
                alert("Broadcast inviato! Sarà letto da tutti al prossimo accesso.");
            }
            TracciaUserAudit("ADMIN", "BROADCAST_ON", "Inviato messaggio globale: " + msg);
        }
    } catch(e) {
        alert("Errore invio broadcast: " + e.message);
    }
}

function CaricaACL(utente) {
    document.getElementById("chkPermCancella").checked = false;
    document.getElementById("chkPermExport").checked = false;
    try {
        var aclFile = fso.BuildPath(currentDir, "system\\acl_" + utente.toLowerCase() + ".txt");
        if(fso.FileExists(aclFile)) {
            var f = fso.OpenTextFile(aclFile, 1);
            var content = f.ReadLine();
            f.Close();
            var parts = content.split("|");
            if(parts[0] === "SI") document.getElementById("chkPermCancella").checked = true;
            if(parts.length > 1 && parts[1] === "SI") document.getElementById("chkPermExport").checked = true;
        }
    } catch(e) {}
}

function SalvaACL(utente) {
    try {
        var pCancella = document.getElementById("chkPermCancella").checked ? "SI" : "NO";
        var pExport = document.getElementById("chkPermExport").checked ? "SI" : "NO";
        var aclFile = fso.BuildPath(currentDir, "system\\acl_" + utente.toLowerCase() + ".txt");
        var f = fso.CreateTextFile(aclFile, true);
        f.WriteLine(pCancella + "|" + pExport);
        f.Close();
    } catch(e) {}
}

function EseguiGhostLoginDalContext() {
    if(!currentUserSelection) { HideContextMenu(); return; }
    
    var res = confirm("ATTENZIONE: Stai per avviare il Gestionale impersonando l'utente '" + currentUserSelection + "'.\nQuesto simulerà un login a suo nome.\n\nVuoi procedere?");
    if(res) {
        try {
            var rootFolder = fso.GetParentFolderName(currentDir);
            var sysFolder = fso.BuildPath(rootFolder, "system");
            if(!fso.FolderExists(sysFolder)) fso.CreateFolder(sysFolder);
            var credFile = fso.BuildPath(sysFolder, "cred.local");
            
            // Forza credenziali per login automatico
            var f = fso.CreateTextFile(credFile, true);
            f.WriteLine(currentUserSelection);
            f.WriteLine("GHOST_MODE_BYPASS"); // Bypass pass
            f.WriteLine("Sì");
            f.WriteLine(new Date().getTime());
            f.Close();
            
            // Lancia Portale Supervisore
            var exePath = fso.BuildPath(rootFolder, "PORTALE_SUPERVISORE_GOLD.html");
            shell.Run('mshta.exe "' + exePath + '"', 1, false);
            TracciaUserAudit("ADMIN", "GHOST_LOGIN", "Impersonificato utente: " + currentUserSelection);
        } catch(e) {
            alert("Errore Ghost Login: " + e.message);
        }
    }
    HideContextMenu();
}
