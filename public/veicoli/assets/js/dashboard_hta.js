var fsoG = null;
try {
    fsoG = new ActiveXObject("Scripting.FileSystemObject");
} catch(e) {
    fsoG = {
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
        }
    };
}

var pG = window.location.pathname || "";
if (pG.indexOf("/") === 0 && pG.indexOf(":") > -1) pG = pG.substring(1);
pG = decodeURIComponent(pG).replace(/\//g, "\\");
var currentDir = fsoG.GetParentFolderName(pG);
var DB_PATH = fsoG.BuildPath(currentDir, "ConsegneDB.accdb");
var loggedUserActive = "";

var ALLOW_CLOSE = false;

// Funzione Helper Globale per Animazione Numerica Count-Up (UX Premium 2026)
function AnimateCounterDash(el, endVal, suffix, prefix) {
    if (!el) return;
    
    // Supporto per i numeri con virgola (es. TFR 4862,19)
    var isDecimal = String(endVal).indexOf(",") !== -1 || String(endVal).indexOf(".") !== -1;
    var endNum = parseFloat(String(endVal).replace(",", "."));
    var end = isNaN(endNum) ? parseInt(endVal, 10) : endNum;
    
    var suff = suffix || "";
    var pref = prefix || "";
    if (isNaN(end)) { el.innerText = pref + endVal + suff; return; }
    if (end === 0) { el.innerText = pref + (isDecimal ? "0,00" : "0") + suff; return; }
    
    var duration = 800; // ms
    var stepTime = 50; // ms per frame (aumentato da 25 per evitare scatti su HTA)
    var steps = Math.ceil(duration / stepTime);
    var increment = end / steps;
    var current = 0;
    var count = 0;
    
    var formatVal = function(val) {
        if (!isDecimal) return Math.floor(val);
        // Formatta a due cifre decimali con la virgola
        return val.toFixed(2).replace(".", ",");
    };

    var t = setInterval(function() {
        // Easing-out: invece di un incremento fisso, calcola una frazione della distanza rimanente
        var diff = end - current;
        var easingFactor = 0.15; // Frena dolcemente
        current += diff * easingFactor;
        
        // Se siamo molto vicini al target, forza l'arrivo e chiudi
        if (Math.abs(diff) < (isDecimal ? 0.05 : 0.8)) {
            current = end;
            clearInterval(t);
            el.innerText = pref + formatVal(end) + suff;
        } else {
            el.innerText = pref + formatVal(current) + suff;
        }
    }, stepTime);
}

function queryDB(sql) {
    try {
        var http;
        try { http = new ActiveXObject("MSXML2.ServerXMLHTTP"); } 
        catch(e) { http = new ActiveXObject("MSXML2.XMLHTTP"); }
        http.open("POST", "http://127.0.0.1:3002/query", false);
        http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));
        if (http.status === 200) {
            var res = JSON.parse(http.responseText);
            if (res && res.error) {
                alert("Errore Query:\n" + res.error + "\n\nQuery:\n" + sql);
                return [];
            }
            return res;
        } else {
            console.log("Errore HTTP " + http.status);
            return [];
        }
    } catch(errReq) {
        console.log("Errore JScript in queryDB:\n" + errReq.message);
        return [];
    }
}

function execDB(sql) {
    try {
        var http;
        try { http = new ActiveXObject("MSXML2.ServerXMLHTTP"); } 
        catch(e) { http = new ActiveXObject("MSXML2.XMLHTTP"); }
        http.open("POST", "http://127.0.0.1:3002/query", false);
        http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));
        if (http.status === 200) {
            var res = JSON.parse(http.responseText);
            if (res && res.error) {
                alert("Errore Database (Risposta API):\n" + res.error + "\n\nQuery:\n" + sql);
                return false;
            }
            return true;
        } else {
            console.log("Errore HTTP " + http.status);
            return false;
        }
    } catch(errReq) {
        alert("Errore JScript in execDB:\n" + errReq.message);
        return false;
    }
}

window.onbeforeunload = function() {
    var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
    if (!isElectron && !ALLOW_CLOSE) {
        try {
            var sh = new ActiveXObject("WScript.Shell");
            sh.Run('taskkill /F /IM node.exe', 0, false);
        } catch(e) {}
    }
};

function InitDashboardHTA() {
    try { Document_CleanupOtherWindows(); } catch(e) {}
    try { KillOldMonitor(); } catch(e) {}
    
    // 2. Forza il tutto schermo
    try {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
    } catch(e) {}
    
    try { ImpostaDataSottotitolo(); } catch(e) {}
    try { AggiornaDashboardStats(); } catch(e) {}
    try { SetupEventHandlers(); } catch(e) {}
    try { StartTitleClock(); } catch(e) {}
    try { CheckUserPermissions(); } catch(e) {} // Controllo Sicurezza ADMIN e Profilo Utente
    try { UpdateDynamicGreeting(loggedUserActive); } catch(e) {}
    try { StartAnalogClock(); } catch(e) {}
    try { CaricaAgendaHome(); } catch(e) {} // Carica l'elenco consegne prioritized in Home
    
    try { CheckUserPermissions(); } catch(e) {} // Controllo Sicurezza ADMIN
    try { LogAccess(); } catch(e) {} // Registrazione silenziosa accesso per sicurezza
    
    try { InitNotificheMobile(); } catch(e) {}
    try { AggiornaMeteoLive(); } catch(e) {}
    setInterval(function() { try { AggiornaMeteoLive(); } catch(e) {} }, 1800000); // Ogni 30 min
    
    // 4. Auto-Refresh Agenda (Ogni minuto)
    setInterval(function() {
        try { CaricaAgendaHome(); } catch(e) {}
        try { AggiornaDashboardStats(); } catch(e) {}
    }, 60000);
}

if (typeof window.addEventListener === "function") {
    window.addEventListener("load", InitDashboardHTA, false);
} else {
    var _oldOnloadDash = window.onload;
    window.onload = function() {
        if (typeof _oldOnloadDash === "function") {
            try { _oldOnloadDash(); } catch(e) {}
        }
        InitDashboardHTA();
    };
}

// --- METEO LIVE DASHBOARD ---
function AggiornaMeteoLive() {
    try {
        var x = null;
        if (typeof window !== "undefined" && window.XMLHttpRequest) {
            x = new XMLHttpRequest();
        } else {
            x = new ActiveXObject("MSXML2.ServerXMLHTTP.6.0");
        }
        x.open("GET", "https://api.open-meteo.com/v1/forecast?latitude=41.1171&longitude=16.8719&current_weather=true", true);
        x.onreadystatechange = function() {
            if (x.readyState === 4 && x.status === 200) {
                // Utilizzo eval o json parse manuale se JSON non definito in HTA. 
                // Di solito JSON.parse esiste nelle versioni moderne di IE (Edge mode)
                var txt = x.responseText;
                var res = window.JSON ? JSON.parse(txt) : eval("(" + txt + ")");
                var t = res.current_weather.temperature;
                var wc = res.current_weather.weathercode;
                
                var elTemp = document.getElementById("lblMeteoTemp");
                if (elTemp) elTemp.innerText = Math.round(t) + "°C";
                
                var desc = "Sereno";
                var icon = "☀️";
                if(wc >= 1 && wc <= 3) { desc = "Poco Nuvoloso"; icon = "⛅"; }
                if(wc >= 45 && wc <= 48) { desc = "Nebbia"; icon = "🌫️"; }
                if(wc >= 51 && wc <= 67) { desc = "Pioggia"; icon = "🌧️"; }
                if(wc >= 71 && wc <= 77) { desc = "Neve"; icon = "❄️"; }
                if(wc >= 80 && wc <= 82) { desc = "Acquazzoni"; icon = "🌦️"; }
                if(wc >= 95) { desc = "Temporale"; icon = "⛈️"; }
                
                var elDesc = document.getElementById("lblMeteoDesc");
                if (elDesc) elDesc.innerText = desc.toUpperCase();
                
                var elIcon = document.getElementById("lblMeteoIcon");
                if (elIcon) elIcon.innerText = icon;
                
                var elTip = document.getElementById("lblMeteoTip");
                if (elTip) {
                    if (wc >= 51) {
                        elTip.innerText = "Attenzione: Tempi di consegna potenzialmente dilatati causa meteo!";
                        elTip.style.color = "#ef4444";
                        if(typeof UXPremium !== "undefined" && UXPremium.ShowToast) {
                            UXPremium.ShowToast("Meteo Avverso: Possibili ritardi logistici odierni.", "warning");
                        }
                    }
                    else {
                        elTip.innerText = "Condizioni ottimali per la guida.";
                        elTip.style.color = "";
                    }
                }
            } else if (x.readyState === 4) {
                var elDesc = document.getElementById("lblMeteoDesc");
                if (elDesc) elDesc.innerText = "NON DISPONIBILE";
            }
        };
        x.send();
    } catch(e) {
        var elDesc = document.getElementById("lblMeteoDesc");
        if (elDesc) elDesc.innerText = "ERRORE CONNESSIONE";
    }
}

function StartMonitorDriver() {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var monitorPath = fsoG.BuildPath(currentDir, "MONITOR_DRIVER.vbs");
        shell.Run('wscript.exe "' + monitorPath + '"', 0, false);
    } catch(e) {}
}

function LogAccess() {
    try {
        var sysDir = fsoG.BuildPath(currentDir, "system");
        var credFile = fsoG.BuildPath(sysDir, "cred.local");
        var logFile = fsoG.BuildPath(sysDir, "version_log.txt");
        var user = "Ospite";
        
        if (fsoG.FileExists(credFile)) {
            var f = fsoG.OpenTextFile(credFile, 1);
            user = f.ReadLine();
            f.Close();
        }
        
        if (!fsoG.FolderExists(sysDir)) fsoG.CreateFolder(sysDir);
        
        var fl = fsoG.OpenTextFile(logFile, 8, true); // Append
        fl.WriteLine("[" + new Date().toLocaleString() + "] -> v.LOGIN - Accesso Dashboard - Utente: " + user);
        fl.Close();
    } catch(e) { /* Silenzioso */ }
}

function CheckUserPermissions() {
    try {
        var user = GoldSecurityManager.GetActiveUser();
        if (!user || user === "Operatore" || user === "Ospite") {
            user = (typeof sessionStorage !== "undefined" && (sessionStorage.getItem("currentUser") || sessionStorage.getItem("loggedUser"))) || 
                   (typeof localStorage !== "undefined" && (localStorage.getItem("loggedUser") || localStorage.getItem("activeUser"))) || "Ospite";
        }
        loggedUserActive = user;
        
        var uUpper = user.toUpperCase();
        var isAdmin = (uUpper === "ADMIN" || uUpper === "CIRO" || uUpper === "CIRO MILELLA" || uUpper === "SUPERVISORE" || uUpper.indexOf("MILELLA") > -1);
        
        var profileLbl = document.getElementById("lblFooterProfile");
        if (profileLbl) {
            profileLbl.style.display = "inline-flex";
            profileLbl.style.alignItems = "center";
            profileLbl.style.fontSize = "13px";
            profileLbl.style.fontWeight = "600";
            profileLbl.style.color = "#cbd5e1";
            profileLbl.innerHTML = 'Profilo attivo: <b style="color:#38bdf8; margin-left:4px;">' + user + '</b> <div style="width:24px; height:24px; border-radius:50%; background:#1e293b; border:1px solid rgba(255,255,255,0.2); display:inline-flex; align-items:center; justify-content:center; margin-left:8px; overflow:hidden;"><img src="https://img.icons8.com/ios-filled/50/38bdf8/user-male-circle.png" style="width:14px; height:14px;"></div>';
        }
        
        // Zenith Homogeneity: also populate the top header widget with active session badge! (UX-15)
        var topW = document.getElementById("userProfileWidget");
        if (topW) {
            topW.className = "admin-badge-widget";
            topW.onclick = function() { LaunchModule('admin_utenti.html'); };
            topW.title = "Clicca per aprire la Scheda del tuo Profilo Utente";
            topW.style.cssText = "display:inline-flex; align-items:center; background:#1e293b; border:1px solid rgba(255,255,255,0.15); border-radius:50px; padding:3px 14px 3px 4px; box-shadow:0 4px 12px rgba(0,0,0,0.3); margin-right:10px; cursor:pointer; vertical-align:middle;";
            topW.innerHTML = 
                '<div style="background:#38bdf8; color:white; border-radius:50%; width:26px; height:26px; display:flex; justify-content:center; align-items:center; margin-right:8px; flex-shrink:0;">' +
                    '<svg viewBox="0 0 24 24" style="width:15px; height:15px; fill:currentColor;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' +
                '</div>' +
                '<div style="display:flex; flex-direction:column; justify-content:center; text-align:left;">' +
                    '<div style="color:#38bdf8; font-size:8.5px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; line-height:1; margin-bottom:2px;">PROFILO UTENTE</div>' +
                    '<div style="color:#f8fafc; font-size:12.5px; font-weight:800; line-height:1;">' + user + (isAdmin ? ' <span style="font-size:10px; color:#fbbf24; font-weight:700;">(Admin)</span>' : '') + '</div>' +
                '</div>';
        }

        // UX-14: Inizializza il saluto personalizzato intelligente!
        UpdateDynamicGreeting(user);
        
        // Assicuriamoci che i pulsanti rimangano SEMPRE cliccabili in modo da mostrare il Pop-up di avviso agli utenti non abilitati
        var btnIds = ["cmdAdmin", "cmdAdminGrid", "btnAdminUtenti", "cmdAdminKpi", "cmdAdminSidebar"];
        for (var bIdx = 0; bIdx < btnIds.length; bIdx++) {
            var bObj = document.getElementById(btnIds[bIdx]);
            if (bObj) {
                bObj.disabled = false;
                bObj.className = bObj.className ? bObj.className.replace(/\bbtn-locked\b/g, "").trim() : "";
            }
        }
    } catch(e) {}
}

function HandleIconError(img, emoji) {
    try {
        var parent = img.parentNode;
        var span = document.createElement("span");
        span.className = "emoji-fallback";
        span.innerText = emoji;
        img.style.display = "none";
        parent.insertBefore(span, img);
    } catch(e) {}
}

/**
 * AGGIORNA IL SALUTO DINAMICO INTELLIGENTE (UX-14)
 */
function UpdateDynamicGreeting(nomeUser) {
    try {
        var user = "Ciro Milella";
        if (nomeUser && nomeUser.toUpperCase() !== "OSPITE" && nomeUser.toUpperCase() !== "OPERATORE") {
            // Capitalizza ogni parola del nome utente
            var words = nomeUser.split(" ");
            for (var i = 0; i < words.length; i++) {
                if (words[i].length > 0) {
                    words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase();
                }
            }
            user = words.join(" ");
        }
        
        var ora = new Date().getHours();
        var saluto = "";
        var icona = "";
        var frase = "";
        
        if (ora >= 5 && ora < 12) { 
            saluto = "Buongiorno"; icona = "☀️"; 
            frase = "Pronti per un'altra grande giornata di consegne? 🚚💨";
        }
        else if (ora >= 12 && ora < 18) { 
            saluto = "Buon pomeriggio"; icona = "🌤️"; 
            frase = "Il cruscotto operativo è pronto al servizio del tuo business! 💪";
        }
        else if (ora >= 18 && ora < 22) { 
            saluto = "Buonasera"; icona = "🌅"; 
            frase = "Giornata intensa? Ottimo lavoro, quasi tempo di riposare. ✨";
        }
        else { 
            saluto = "Buonanotte"; icona = "🌙"; 
            frase = "Operazioni notturne silenziose. Server e archivi al sicuro. 💤";
        }
        
        var hub = document.getElementById("greetingHub");
        if (hub) {
            hub.innerHTML = '<span class="greeting-text">' + icona + ' <b>' + saluto + ', ' + user + '!</b> <span style="color:#64748b; font-weight:600; margin-left:8px; font-size:13px;">' + frase + '</span></span>';
        }
    } catch(e) {}
}

function Document_CleanupOtherWindows() {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var finalTitle = "AGENDA - C.M";
        
        // Se siamo già nel processo di chiusura o transizione, evitiamo la pulizia aggressiva
        if (window.name === "TRANSITION_ACTIVE") return;
        
        document.title = "PULIZIA_IN_CORSO";
        
        // Pulizia selettiva: chiudiamo solo istanze vecchie accertate per evitare zombie
        // NOTA: Non killiamo tutto mshta.exe per evitare di chiudere AnyDesk se è aperto in parallelo volutamente
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq CHIUSURA_IN_CORSO"', 0, false);
        shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq PULIZIA_IN_CORSO"', 0, false);
        
        document.title = finalTitle;
    } catch(e) { }
}

function StartTitleClock() {
    var timer = function() {
        var ora = new Date();
        var h = (ora.getHours() < 10 ? '0' : '') + ora.getHours();
        var m = (ora.getMinutes() < 10 ? '0' : '') + ora.getMinutes();
        
        // --- DATA IN ITALIANO ---
        var giorni = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
        var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        var dStr = giorni[ora.getDay()] + ", " + ora.getDate() + " " + mesi[ora.getMonth()] + " " + ora.getFullYear();
        
        var dEl = document.getElementById("titleDate");
        if (dEl) dEl.innerText = dStr;

        var tEl = document.getElementById("titleTime");
        if (tEl) {
            var icon = (ora.getHours() >= 6 && ora.getHours() < 20) ? "☀️" : "🌙";
            tEl.innerHTML = '<span class="time-icon">' + icon + '</span> ' + h + ":" + m;
        }
    };
    timer();
    setInterval(timer, 10000);
}

function StartAnalogClock() {
    var hourHand = document.getElementById("clock-hour");
    var minHand = document.getElementById("clock-min");
    var secHand = document.getElementById("clock-sec");

    if (!hourHand || !minHand || !secHand) return;

    function setDate() {
        var now = new Date();

        var seconds = now.getSeconds();
        var secondsDegrees = (seconds * 6); // 360 / 60
        secHand.style.transform = "rotate(" + secondsDegrees + "deg)";

        var mins = now.getMinutes();
        var minsDegrees = (mins * 6) + (seconds / 10); // 360 / 60 + 6 / 60
        minHand.style.transform = "rotate(" + minsDegrees + "deg)";

        var hour = now.getHours();
        var hourDegrees = (hour * 30) + (mins / 2); // 360 / 12 + 30 / 60
        hourHand.style.transform = "rotate(" + hourDegrees + "deg)";
    }

    setInterval(setDate, 1000);
    setDate();
}

function ImpostaDataSottotitolo() {
    var giorni = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    var oggi = new Date();
    var stringData = giorni[oggi.getDay()] + ", " + oggi.getDate() + " " + mesi[oggi.getMonth()] + " " + oggi.getFullYear();
    document.getElementById("lblSottotitolo").innerText = stringData;
}

function selectCount(sql, conn, dbAccess) {
    if (conn) {
        var rs = conn.Execute(sql);
        var res = rs.Fields(0).Value || 0;
        rs.Close();
        return res;
    } else if (dbAccess) {
        var rs = dbAccess.OpenRecordset(sql);
        var res = 0;
        if (!rs.EOF) { res = rs.Fields(0).Value || 0; }
        rs.Close();
        return res;
    } else {
        try {
            var rows = queryAccessDB(sql);
            if (rows && rows.length > 0) {
                var firstRow = rows[0];
                for (var key in firstRow) {
                    if (firstRow.hasOwnProperty(key)) {
                        return firstRow[key] || 0;
                    }
                }
            }
        } catch(e) {}
    }
    return 0;
}

function AggiornaDashboardStats() {
    var conn = null;
    var app = null;
    var dbAccess = null;

    try {
        var dbObj = ConnectToDatabase();
        if (dbObj) {
            if (dbObj.type === "ADO") {
                conn = dbObj.handle;
                dbAccess = null;
            } else {
                conn = null;
                dbAccess = dbObj.handle;
            }
        }

        var qOggi = "DataConsegna >= Date() AND DataConsegna < DateAdd('d', 1, Date())";

        var qTot = "SELECT COUNT(*) FROM tblConsegne WHERE " + qOggi;
        var nTot = selectCount(qTot, conn, dbAccess);

        // UX-5 & UX-7: Includiamo Consegnato = True/1 per la barra di progresso lampo
        var qComp = "SELECT COUNT(*) FROM tblConsegne WHERE " + qOggi + " AND (KmAndata IS NOT NULL OR Consegnato = True OR Consegnato = 1)";
        var nComp = selectCount(qComp, conn, dbAccess);

        var lbl1 = document.getElementById("lblStat1");
        AnimateCounterDash(lbl1, nComp, " / " + nTot);
        
        // --- GESTIONE BARRA DI PROGRESSO LIVE (UX-7) ---
        var pct = nTot > 0 ? Math.round((nComp / nTot) * 100) : 0;
        var progBar = document.getElementById("progressoOggiBar");
        if (progBar) {
            progBar.style.width = pct + "%";
        }
        
        // DISEGNO SPARKLINE PROGRESSO
        if(typeof UXPremium !== "undefined" && UXPremium.DrawSimpleLineChart) {
            // Simuliamo un andamento storico del progresso basato sul dato odierno (da estendere con query storiche)
            var trendDati = [ Math.max(0, nTot-10), Math.max(0, nTot-5), nTot+2, nTot-1, nTot ];
            UXPremium.DrawSimpleLineChart("uxChartProgresso", trendDati, "#10b981", "#34d399");
        }
        
        var cardProg = document.getElementById("cardProgresso");
        if (cardProg) {
            if (nTot > 0 && nComp >= nTot) {
                // Celebrazione al 100%: Card verde e alone luminoso smeraldo!
                lbl1.style.color = "#27ae60";
                cardProg.style.boxShadow = "0 0 15px 2px rgba(39, 174, 96, 0.25), inset 0 0 15px rgba(39, 174, 96, 0.05)";
                cardProg.style.borderColor = "#27ae60";
                
                // GAMIFICATION: Particelle d'oro per traguardo raggiunto
                if(typeof UXPremium !== "undefined" && UXPremium.PlayGoldParticles) {
                    var rect = lbl1.getBoundingClientRect();
                    UXPremium.PlayGoldParticles(rect.left + rect.width/2, rect.top + 20);
                }
            } else {
                lbl1.style.color = "#2c3e50";
                cardProg.style.boxShadow = "none";
                cardProg.style.borderColor = "#e2e8f0";
            }
        }

        var qUrg = "SELECT COUNT(*) FROM tblConsegne WHERE " + qOggi +
            " AND (KmAndata IS NULL)" +
            " AND (Priorita LIKE '%URGENTE%' OR Note LIKE '%URGENTE%' OR Priorita LIKE '%TASSATIVO%' OR Note LIKE '%TASSATIVO%')";
        var nUrg = selectCount(qUrg, conn, dbAccess);

        var qSett = "SELECT COUNT(*) FROM tblConsegne WHERE DataConsegna >= Date() AND DataConsegna <= DateAdd('d', 7, Date())";
        var nSett = selectCount(qSett, conn, dbAccess);

        AnimateCounterDash(document.getElementById("lblStat3"), nSett);

        // --- AGGIORNAMENTO BADGE PROMEMORIA SULLA CAMPANELLA ---
        var qProm = "SELECT COUNT(*) FROM tblPromemoria WHERE Stato = 'In attesa'";
        var nProm = selectCount(qProm, conn, dbAccess);
        var badgeProm = document.getElementById("badgePromemoria");
        var btnProm = document.getElementById("btnPromemoria");
        
        if (badgeProm) {
            if (nProm > 0) {
                badgeProm.innerText = nProm;
                badgeProm.style.display = "block";
                // UX-8: Attiva la danza magnetica della campanella!
                if (btnProm && btnProm.className.indexOf("wiggle-active") === -1) {
                    btnProm.className += " wiggle-active";
                }
            } else {
                badgeProm.style.display = "none";
                if (btnProm) {
                    btnProm.className = btnProm.className.replace(/\bwiggle-active\b/g, "").trim();
                }
            }
        }

        // --- AGGIORNAMENTO CENTRO NOTIFICHE SIDEBAR ---
        var alertUrg = document.getElementById("alertUrgenze");
        var alertComp = document.getElementById("alertCompletate");
        var alertBack = document.getElementById("alertBackup");
        var cardUrgenze = document.getElementById("cardUrgenze");

        // Stat 2 (Urgenze nella card principale)
        AnimateCounterDash(document.getElementById("lblStat2"), nUrg);
        if (nUrg > 0) {
            if (cardUrgenze) cardUrgenze.style.display = "block";
        } else {
            if (cardUrgenze) cardUrgenze.style.display = "none";
        }

        // 1. Alert Urgenze (Sidebar)
        if (nUrg > 0) {
            document.getElementById("valUrg").innerText = nUrg;
            alertUrg.style.display = "block";
        } else {
            alertUrg.style.display = "none";
        }

        // 2. Alert Completamento
        if (nTot > 0 && nComp == nTot) {
            alertComp.style.display = "block";
        } else {
            alertComp.style.display = "none";
        }

        // 3. Alert Backup (Sempre visibile come reminder o basato su logica)
        if (alertBack) {
            alertBack.style.display = "block";
            alertBack.onclick = function(e) {
                if (e && e.stopPropagation) e.stopPropagation();
                if (window.event) window.event.cancelBubble = true;
                EseguiBackup(false);
            };
        }

        // 4. Alert Scadenza Veicoli (Fase 3)
        try {
            var alertVeicoli = document.getElementById("alertVeicoli");
            var valVeicoliAlert = document.getElementById("valVeicoliAlert");
            if (alertVeicoli) {
                var sqlVeh = "SELECT Targa, Modello, ScadenzaAssicurazione, ScadenzaBollo, ScadenzaRevisione, KmAttuali, SogliaTagliando FROM tblVeicoli";
                var vehicles = queryAccessDB(sqlVeh) || [];
                
                // -------------------------------------------------------------------
                // FASE 2: AUTOPILOTA LIVE SULLA DASHBOARD (Replica Logica Avanzata)
                // -------------------------------------------------------------------
                try {
                    var sqlDashRif = "SELECT TOP 1 KmAttuali, DataRifornimento FROM tblRifornimenti ORDER BY KmAttuali DESC";
                    var resDashRif = queryAccessDB(sqlDashRif) || [];
                    var baseKmDash = 0, baseDateDash = "";
                    if (resDashRif && resDashRif.length > 0) {
                        baseKmDash = Number(resDashRif[0].KmAttuali) || 0;
                        baseDateDash = resDashRif[0].DataRifornimento || "";
                    }

                    var extraKmDash = 0;
                    var dailyAvgDash = 25;
                    if (baseDateDash !== "" && baseKmDash > 0) {
                        var aDash = new Date().getFullYear();
                        var sqlCDash = "SELECT DataConsegna, KmAndata, KmRitorno FROM tblConsegne WHERE Year(DataConsegna) = " + aDash;
                        var rowsCDash = queryAccessDB(sqlCDash) || [];
                        var limitStrDash = baseDateDash.substring(0, 10);
                        var minDStr = "9999-12-31", maxDStr = "0000-01-01", totDashKm = 0;
                        
                        for (var jD = 0; jD < rowsCDash.length; jD++) {
                            var dcD = rowsCDash[jD].DataConsegna;
                            if(!dcD) continue;
                            var curDD = dcD.substring(0, 10);
                            var rowKmD = (Number(rowsCDash[jD].KmAndata) || 0) + (Number(rowsCDash[jD].KmRitorno) || 0);
                            totDashKm += rowKmD;
                            if(curDD < minDStr) minDStr = curDD;
                            if(curDD > maxDStr) maxDStr = curDD;
                            if (curDD >= limitStrDash) { extraKmDash += rowKmD; }
                        }
                        
                        if (minDStr !== "9999-12-31" && maxDStr !== "0000-01-01") {
                            var diffDaysD = Math.floor((new Date(maxDStr.replace(/-/g, '/')) - new Date(minDStr.replace(/-/g, '/'))) / 86400000) + 1;
                            if (diffDaysD > 0) dailyAvgDash = Math.max(5, totDashKm / diffDaysD);
                        }
                    }
                    var liveKmDash = Math.floor(baseKmDash + extraKmDash);
                    
                    // Iniezione Valori Ricalcolati ed Aggiornamento Card
                    if (vehicles.length > 0) {
                        var mainVeh = vehicles[0]; // Prendiamo il principale
                        if (liveKmDash > 0 && liveKmDash > (Number(mainVeh.KmAttuali) || 0)) {
                             mainVeh.KmAttuali = liveKmDash; // Ricalibra allarme istantaneamente
                        }
                        
                        // CHECK ALERT DA LAVORARE STORICO
                        try {
                            var qAlert = "SELECT COUNT(*) FROM tblConsegne WHERE (Stato IS NULL OR Stato = '' OR Stato = 'PENDENTE' OR Stato = 'DA CHIAMARE')";
                            var nAlert = selectCount(qAlert, conn, dbAccess);
                            var btnStorico = document.getElementById("btnNavRicerca");
                            if(btnStorico) {
                                var badge = document.getElementById("alertStoricoDaLavorare");
                                if(!badge) {
                                    // Aggiunge keyframes per l'animazione pulsante se non esiste
                                    if(!document.getElementById("styleBadgePulse")) {
                                        var style = document.createElement("style");
                                        style.id = "styleBadgePulse";
                                        style.innerHTML = "@keyframes pulseBadgeRed { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); } 70% { transform: scale(1.2); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }";
                                        document.head.appendChild(style);
                                    }
                                    badge = document.createElement("div");
                                    badge.id = "alertStoricoDaLavorare";
                                    badge.style.cssText = "position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; text-align:center; line-height:16px; font-size:11px; font-weight:900; font-family:sans-serif; border: 2px solid #fff; z-index:99; pointer-events:none; animation: pulseBadgeRed 1.5s infinite ease-in-out; box-shadow: 0 3px 8px rgba(239, 68, 68, 0.5);";
                                    var iconSpan = btnStorico.querySelector("span");
                                    if (iconSpan) {
                                        iconSpan.style.position = "relative";
                                        iconSpan.appendChild(badge);
                                    } else {
                                        btnStorico.style.position = "relative";
                                        btnStorico.appendChild(badge);
                                    }
                                }
                                if(nAlert > 0) {
                                    badge.innerText = nAlert > 99 ? "99+" : nAlert;
                                    badge.style.display = "block";
                                } else {
                                    badge.style.display = "none";
                                }
                            }
                        } catch(e) {}

                        // --- UX Premium: Disegna Grafico ---Card KPI
                        var lblDashM = document.getElementById("lblDashModel");
                        if(lblDashM) lblDashM.innerText = (mainVeh.Modello || "Veicolo").toUpperCase() + " (" + (mainVeh.Targa || "").toUpperCase() + ")";
                        
                        function fDate(d) {
                            if(!d) return "--/--/----";
                            var p = String(d).split("-");
                            return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : d;
                        }
                        var lblA = document.getElementById("lblDashAssicVal");
                        if(lblA) lblA.innerText = fDate(mainVeh.ScadenzaAssicurazione);
                        var lblR = document.getElementById("lblDashRevisVal");
                        if(lblR) lblR.innerText = fDate(mainVeh.ScadenzaRevisione);
                        var lblB = document.getElementById("lblDashBolloVal");
                        if(lblB) lblB.innerText = fDate(mainVeh.ScadenzaBollo);

                        var lblDashK = document.getElementById("lblDashKm");
                        if(lblDashK) AnimateCounterDash(lblDashK, mainVeh.KmAttuali, " Km");
                        
                        var lblDashPrev = document.getElementById("lblDashPrevisione");
                        var thrD = Number(mainVeh.SogliaTagliando) || 0;
                        var currentKmNum = Number(mainVeh.KmAttuali) || 0;
                        
                        // --- ANIMAZIONE FISICA LANCETTA ---
                        var needle = document.getElementById("gaugeNeedle");
                        if (needle && thrD > 0) {
                             var remainingKm = thrD - currentKmNum;
                             // Scala la visualizzazione sugli ULTIMI 15.000 KM di vita dell'olio
                             var safeScale = 15000; 
                             var cappedRemaining = Math.max(0, Math.min(safeScale, remainingKm));
                             // Calcolo percentuale di CONSUMO (0 = Pieno, 1 = Vuoto/Tagliando)
                             var consumoPct = 1 - (cappedRemaining / safeScale);
                             // Mappatura Gradi: -90° (Tutto ok) -> +90° (Allarme Rosso)
                             var degrees = -90 + (consumoPct * 180);
                             
                             // Ritardo minimo per permettere alla pagina di disegnare e poi animare!
                             setTimeout(function() {
                                 document.getElementById("gaugeNeedle").style.transform = "rotate(" + degrees + "deg)";
                             }, 800);
                        }
                        
                        if (lblDashPrev && thrD > 0 && currentKmNum < thrD) {
                             var daysLeft = Math.floor((thrD - currentKmNum) / dailyAvgDash);
                             var pDate = new Date();
                             pDate.setDate(pDate.getDate() + daysLeft);
                             lblDashPrev.innerHTML = "<i class='fa fa-magic'></i> <span>Predizione Tagliando: ~ " + pDate.toLocaleDateString('it-IT') + "</span>";
                             lblDashPrev.style.display = "flex";
                        }

                        // --- FASE 2: CALCOLO AUTONOMIA/RISERVA CARBURANTE ---
                        var lblDashAutonomia = document.getElementById("lblDashAutonomia");
                        var lblDashAutonomiaVal = document.getElementById("lblDashAutonomiaVal");
                        var barDashAutonomia = document.getElementById("barDashAutonomia");
                        var lblDashUltimoRif = document.getElementById("lblDashUltimoRif");
                        
                        if (lblDashAutonomia && lblDashAutonomiaVal && barDashAutonomia) {
                            try {
                                var sqlRifAut = "SELECT TOP 1 Litri, KmAttuali, DataRifornimento FROM tblRifornimenti ORDER BY DataRifornimento DESC, ID DESC";
                                var resRifAut = queryAccessDB(sqlRifAut) || [];
                                
                                if (resRifAut.length > 0 && resRifAut[0].DataRifornimento) {
                                    var lastLitri = parseFloat(resRifAut[0].Litri) || 0;
                                    var lastDate = resRifAut[0].DataRifornimento;
                                    
                                    var dateFilter = lastDate.split("T")[0];
                                    if (dateFilter.length > 10) dateFilter = dateFilter.substring(0, 10);
                                    
                                    var sqlCAut = "SELECT KmAndata, KmRitorno FROM tblConsegne WHERE DataConsegna >= #" + dateFilter + "#";
                                    var resCAut = queryAccessDB(sqlCAut) || [];
                                    
                                    var kmLavorativiDaPieno = 0;
                                    for (var cA=0; cA<resCAut.length; cA++) {
                                        kmLavorativiDaPieno += (parseFloat(resCAut[cA].KmAndata) || 0) + (parseFloat(resCAut[cA].KmRitorno) || 0);
                                    }
                                    
                                    var cMedio = 15.0;
                                    try {
                                        var resCons = queryAccessDB("SELECT Valore FROM tblConfigAuto WHERE Chiave = 'ConsumoMedio'") || [];
                                        if (resCons.length > 0 && parseFloat(resCons[0].Valore) > 0) cMedio = parseFloat(resCons[0].Valore);
                                    } catch(eCons) {}
                                    
                                    var capSerbatoio = 44.0;
                                    try {
                                        var resCap = queryAccessDB("SELECT Valore FROM tblConfigAuto WHERE Chiave = 'CapacitaSerbatoio'") || [];
                                        if (resCap.length > 0 && parseFloat(resCap[0].Valore) > 0) capSerbatoio = parseFloat(resCap[0].Valore);
                                    } catch(eCap) {}

                                    var litriConsumati = kmLavorativiDaPieno / cMedio;
                                    var litriResidui = capSerbatoio - litriConsumati;
                                    if (litriResidui < 0) litriResidui = 0;
                                    
                                    var kmResiduiTeorici = litriResidui * cMedio;
                                    var pctAut = (litriResidui / capSerbatoio) * 100;
                                    if (pctAut > 100) pctAut = 100;
                                    
                                    lblDashAutonomiaVal.innerText = "~ " + kmResiduiTeorici.toFixed(0) + " Km";
                                    barDashAutonomia.style.width = pctAut + "%";
                                    
                                    if (lblDashUltimoRif) {
                                        var pD = dateFilter.split("-");
                                        lblDashUltimoRif.innerText = "Ultimo rifornimento: " + (pD.length===3 ? (pD[2]+"/"+pD[1]+"/"+pD[0]) : dateFilter);
                                        lblDashUltimoRif.style.display = "block";
                                    }
                                    
                                    if (litriResidui <= 6 || pctAut < 18) {
                                        lblDashAutonomia.style.background = "#fef2f2";
                                        lblDashAutonomia.style.borderColor = "#f87171";
                                        lblDashAutonomia.style.color = "#991b1b";
                                        lblDashAutonomiaVal.style.color = "#dc2626";
                                        barDashAutonomia.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                                    } else {
                                        lblDashAutonomia.style.background = "#dcfce7";
                                        lblDashAutonomia.style.borderColor = "#86efac";
                                        lblDashAutonomia.style.color = "#14532d";
                                        lblDashAutonomiaVal.style.color = "#15803d";
                                        barDashAutonomia.style.background = "linear-gradient(90deg, #22c55e, #16a34a)";
                                    }
                                    
                                    lblDashAutonomia.style.display = "flex";
                                }
                            } catch(eAut) {}
                        }
                    }
                } catch(eAutoDash) { /* Fallback Silente */ }
                // -------------------------------------------------------------------
                
                var numAl = 0;
                var alertMsg = "";
                
                var today = new Date();
                today.setHours(0,0,0,0);
                
                for (var vIdx = 0; vIdx < vehicles.length; vIdx++) {
                    var veh = vehicles[vIdx];
                    
                    // Controlla scadenze date
                    var checkDates = [
                        { d: veh.ScadenzaAssicurazione, t: "Assic." },
                        { d: veh.ScadenzaBollo, t: "Bollo" },
                        { d: veh.ScadenzaRevisione, t: "Revis." }
                    ];
                    
                    for (var dIdx = 0; dIdx < checkDates.length; dIdx++) {
                        var item = checkDates[dIdx];
                        if (item.d && item.d !== "") {
                            var p = item.d.split("-");
                            var exp = new Date(p[0], p[1]-1, p[2]);
                            exp.setHours(0,0,0,0);
                            var diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                            if (diff <= 15) {
                                numAl++;
                                if (alertMsg === "") {
                                    alertMsg = veh.Modello.toUpperCase() + " (" + veh.Targa.toUpperCase() + "): " + item.t + " in scadenza!";
                                }
                            }
                        }
                    }
                    
                    // Controlla soglia tagliando
                    if (veh.KmAttuali && veh.SogliaTagliando) {
                        var diffKm = Number(veh.SogliaTagliando) - Number(veh.KmAttuali);
                        if (diffKm <= 1000 && diffKm >= 0) {
                            numAl++;
                            if (alertMsg === "") {
                                alertMsg = veh.Modello.toUpperCase() + ": Tagliando necessario!";
                            }
                        }
                    }
                }
                
                if (numAl > 0) {
                    if (numAl > 1) {
                        valVeicoliAlert.innerText = numAl + " SCADENZE VEICOLI!";
                    } else {
                        valVeicoliAlert.innerText = alertMsg;
                    }
                    alertVeicoli.style.display = "block";
                } else {
                    alertVeicoli.style.display = "none";
                }
            }
        } catch(eVe) {}

        try {
            AggiornaWidgetPresenze();
        } catch(eP) {}

        if (conn) conn.Close();
        if (app) app.Quit();

    } catch (err) {
        if (conn) try { conn.Close(); } catch (e) { }
        if (app) try { app.Quit(); } catch (e) { }

        document.getElementById("lblStat1").innerText = "Err: " + err.message;
        document.getElementById("lblStat2").innerText = "-";
        document.getElementById("lblStat3").innerText = "-";
    }
}

function AggiornaWidgetPresenze() {
    try {
        var lblOre = document.getElementById("lblDashPresenzeOre");
        var lblInfo = document.getElementById("lblDashPresenzeInfo");
        var bar = document.getElementById("pbDashPresenze");
        var lblWarn = document.getElementById("lblDashPresenzeWarning");
        
        if (!lblOre || !lblInfo || !bar || !lblWarn) return;

        var user = GoldSecurityManager.GetActiveUser();
        if (!user || user === "Ospite" || user === "Operatore") {
            user = loggedUserActive || "Ospite";
        }
        if (user === "Ospite" && typeof fsoG !== "undefined" && fsoG) {
            var sysDir = fsoG.BuildPath(currentDir, "system");
            var credFile = fsoG.BuildPath(sysDir, "cred.local");
            if (fsoG.FileExists(credFile)) {
                var f = fsoG.OpenTextFile(credFile, 1);
                user = f.ReadLine();
                f.Close();
                loggedUserActive = user;
            }
        }

        var d = new Date();
        var m = d.getMonth() + 1;
        var a = d.getFullYear();

        var sql = "SELECT OreLavorate, DataLavoro, Entrata1, Uscita1, Entrata2, Uscita2 " +
                  "FROM tblOrePresenze " +
                  "WHERE Month(DataLavoro) = " + m + " AND Year(DataLavoro) = " + a + " " +
                  "AND LCase(Utente) = '" + user.trim().toLowerCase().replace(/'/g, "''") + "'";
        
        var rows = queryAccessDB(sql);
        var totOre = 0;
        var hasIncomplete = false;
        var todayStart = new Date();
        todayStart.setHours(0,0,0,0);

        if (rows && rows.length > 0) {
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                totOre += parseFloat(r.OreLavorate) || 0;

                var dStr = r.DataLavoro ? r.DataLavoro.toString().replace(/-/g, "/") : "";
                var dDate = dStr ? new Date(dStr) : null;
                if (dDate && dDate.getTime() < todayStart.getTime()) {
                    if ((r.Entrata1 && !r.Uscita1) || (r.Entrata2 && !r.Uscita2)) {
                        hasIncomplete = true;
                    }
                }
            }
        }

        var h = Math.floor(totOre);
        var min = Math.round((totOre - h) * 60);
        AnimateCounterDash(lblOre, h, "h " + (min < 10 ? "0" : "") + min + "m");

        var target = 160;
        var pct = Math.min(100, Math.round((totOre / target) * 100));
        bar.style.width = pct + "%";
        AnimateCounterDash(lblInfo, pct, "% DI " + target + " ORE (TARGET)");

        if (hasIncomplete) {
            lblWarn.style.display = "inline-block";
        } else {
            lblWarn.style.display = "none";
        }
    } catch (e) { }
}

// GESTIONE EVENTI HOVER E CLICK
function SetupEventHandlers() {
    var lblHint = document.getElementById("lblFooterHint");
    var defaultHint = "Passa il mouse sopra un pulsante per visualizzarne la funzione.";

    // Delegazione Eventi Globale per mouseover/mouseout
    if (document.addEventListener) {
        document.addEventListener("mouseover", function(e) {
            var target = e.target && e.target.closest ? e.target.closest("[data-hint]") : null;
            if (!target && e.target) {
                var parent = e.target;
                while (parent && parent !== document.body) {
                    if (parent.getAttribute && parent.getAttribute("data-hint")) {
                        target = parent;
                        break;
                    }
                    parent = parent.parentNode;
                }
            }
            if (target && lblHint) {
                var hint = target.getAttribute("data-hint");
                if (hint) {
                    lblHint.innerText = hint;
                    lblHint.style.color = "#1e293b";
                }
            }
        }, true);

        document.addEventListener("mouseout", function(e) {
            var target = e.target && e.target.closest ? e.target.closest("[data-hint]") : null;
            if (target && lblHint) {
                lblHint.innerText = defaultHint;
                lblHint.style.color = "#95a5a6";
            }
        }, true);
    }

    // 1. Applica hint e click a tutti gli elementi con data-hint
    var elementsWithHint = document.querySelectorAll("[data-hint]");
    for (var i = 0; i < elementsWithHint.length; i++) {
        var el = elementsWithHint[i];
        el.onmouseover = function () {
            var hintText = this.getAttribute("data-hint");
            if (lblHint && hintText) {
                lblHint.innerText = hintText;
                lblHint.style.color = "#1e293b";
            }
        };
        el.onmouseout = function () {
            if (lblHint) {
                lblHint.innerText = defaultHint;
                lblHint.style.color = "#95a5a6";
            }
        };
        if (!el.onclick) {
            el.onclick = function () { EseguiAzione(this.id); };
        }
    }

    // 2. Applica click a tutti i bottoni che non hanno data-hint (per sicurezza)
    var allButtons = document.getElementsByTagName("button");
    for (var j = 0; j < allButtons.length; j++) {
        var btn = allButtons[j];
        if (!btn.onclick) {
            btn.onclick = function () { EseguiAzione(this.id); };
        }
    }

    // Bottoni Calendario Modale
    document.getElementById("btnCalPrev").onclick = function() { calDate.setMonth(calDate.getMonth() - 1); RenderCalendario(); };
    document.getElementById("btnCalNext").onclick = function() { calDate.setMonth(calDate.getMonth() + 1); RenderCalendario(); };
    document.getElementById("btnCalOggi").onclick = function() {
        var d = new Date();
        SelezionaGiornoPerStampa(d.getDate(), d.getMonth() + 1, d.getFullYear());
    };
    document.getElementById("btnCalChiudi").onclick = function() {
        document.getElementById("calendarOverlay").style.display = "none";
    };

    // Toggle Calendario Sidebar
    var chkCal = document.getElementById("chkShowCalendar");
    if (chkCal) {
        chkCal.onclick = function() {
            var wrapper = document.getElementById("sidebarCalendarWrapper");
            if (this.checked) {
                wrapper.style.display = "block";
                RenderSidebarCalendar();
            } else {
                wrapper.style.display = "none";
            }
        };
    }
}

function EseguiAzione(idBtn) {
    var sourceEl = document.getElementById(idBtn);
    if (sourceEl && (sourceEl.disabled || sourceEl.className.indexOf("btn-locked") > -1)) {
        return false; // Blocco totale se il tasto è disabilitato o marchiato come locked
    }
    
    try {
        switch (idBtn) {
            case "cmdFullBackupKpi":
                EseguiBackupCompletoProgetto();
                break;
            case "cmdGuidaBackupKpi":
                MostraGuidaBackupModal();
                break;
            case "lblTitolo":
                AggiornaDashboardStats();
                document.getElementById("lblSottotitolo").innerText = "Dati aggiornati alle: " + new Date().toLocaleTimeString();
                break;
            case "btnNavAnagrafica":
                LaunchModule("anagrafica.html");
                break;
            case "btnRadarLive":
                LaunchModuleStayOpen("mappa_radar.html");
                break;
            case "btnNavConsegne":
                LaunchModule("consegne.html");
                break;
            case "btnNavRicerca":
                LaunchModule("storico.html");
                break;
            case "btnPromemoria":
                LaunchModule("promemoria.html");
                break;
            case "btnElencoQuantitaMateriali":
                LaunchMaterialDashboard();
                break;
            case "btnNavAsl":
                LaunchModuleStayOpen("asl_monitor.html");
                break;
            case "btnNavEsci":
                ActionEsci();
                break;
            case "cmdApriPresenze":
                LaunchModule("presenze.html");
                break;
            case "btnReportPresenze":
                try {
                    var oggi = new Date();
                    var targetUser = loggedUserActive || "Ospite";
                    var sysDir = fsoG.BuildPath(currentDir, "system");
                    var pFile = fsoG.BuildPath(sysDir, "report_presenze_params.tmp");
                    var f = fsoG.CreateTextFile(pFile, true);
                    f.WriteLine(targetUser);
                    f.WriteLine(oggi.getMonth() + 1);
                    f.WriteLine(oggi.getFullYear());
                    f.Close();
                    LaunchModule("report_presenze.html");
                } catch(ex) {
                    alert("Impossibile generare parametri report presenze: " + ex.message);
                }
                break;
            case "btnPermessi":
                LaunchModule("permessi.html");
                break;
            case "btnStampaReport":
                var oggi = new Date();
                var paramsFile = fsoG.BuildPath(fsoG.BuildPath(currentDir, "system"), "report_params.tmp");
                var f = fsoG.OpenTextFile(paramsFile, 2, true);
                f.WriteLine(oggi.getMonth() + 1);
                f.WriteLine(oggi.getFullYear());
                f.Close();
                LaunchModule("report_mensile.html");
                break;
            case "cmdStampaPerData":
                ApriCalendarioPerStampa();
                break;
            case "cmdSyncUSB":
            case "cmdSyncUSBKpi":
                LaunchModule("UTILITY_SYNC_USB.html");
                break;
            case "cmdStatistiche":
            case "cmdStatisticheKpi":
                LaunchModule("statistiche.html");
                break;
            case "cmdAnnoNuovo":
            case "cmdAnnoNuovoKpi":
                alert("Modulo Archiviazione annua.");
                break;
            case "cmdManuali":
            case "cmdManualiKpi":
                ApriManuali();
                break;
            case "cmdCambiaUtente":
            case "cmdCambiaUtenteKpi":
                if (typeof window.ShowGoldConfirm === "function") {
                    window.ShowGoldConfirm("CAMBIO UTENTE", "Sei sicuro di voler chiudere la sessione corrente e tornare alla schermata di login?", "SÌ, ESCI", "ANNULLA", function() {
                        LaunchModule("login.html");
                    }, null, "👤");
                } else {
                    LaunchModule("login.html");
                }
                break;
            case "cmdAdmin":
            case "cmdAdminGrid":
            case "cmdAdminSidebar":
            case "btnAdminUtenti":
            case "cmdAdminKpi":
                LaunchModule("admin_utenti.hta");
                break;
            case "btnAnyDesk":
                LaunchModule("anydesk_hub.html");
                break;
            case "btnGestioneMateriale":
                // Controlla se abbiamo già un percorso salvato nel config.json dei materiali
                var fso = new ActiveXObject("Scripting.FileSystemObject");
                var materialDir = fso.BuildPath(currentDir, "gestione_materiale");
                var configPath = fso.BuildPath(materialDir, "config.json");
                var lastPath = "";
                try {
                    if (fso.FileExists(configPath)) {
                        var f = fso.OpenTextFile(configPath, 1);
                        var content = f.ReadAll();
                        f.Close();
                        var match = content.match(/"excelPath"\s*:\s*"(.*?)"/);
                        if (match && match[1]) lastPath = match[1].replace(/\\\\/g, "\\");
                    }
                } catch(e) {}

                var isValidPath = lastPath && lastPath.toLowerCase().indexOf("fakepath") === -1 && fso.FileExists(lastPath);
                
                // Fallback automatico su percorsi noti se il file non è stato ancora collegato
                if (!isValidPath) {
                    var desktopFile = fso.BuildPath("C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC", "ELENCO E QUANTITA'MATERIALE.xls");
                    var archiveFile = fso.BuildPath(currentDir, "_Archivio_Legacy_e_Excel\\ELENCO E QUANTITA'MATERIALE.xls");
                    if (fso.FileExists(desktopFile)) {
                        lastPath = desktopFile;
                        isValidPath = true;
                    } else if (fso.FileExists(archiveFile)) {
                        lastPath = archiveFile;
                        isValidPath = true;
                    }
                }

                if (isValidPath) {
                    LaunchMaterialDashboard(lastPath);
                } else {
                    var picker = document.getElementById("excelFilePicker");
                    picker.onchange = function() { if (this.value) LaunchMaterialDashboard(this.value); };
                    picker.click();
                }
                break;
            case "btnCambiaFileExcel":
                var picker = document.getElementById("excelFilePicker");
                picker.onchange = function() { if (this.value) LaunchMaterialDashboard(this.value); };
                picker.click();
                break;
            case "btnGestioneArticoli":
                LaunchModule("articoli.html");
                break;
            case "btnConsegneGiornata":
                LaunchModule("promemoria.html?view=calendar");
                break;
            case "btnRimborsi":
                LaunchModule("auto.html?tab=rimborsi");
                break;
            case "cmdApriGestioneAuto":
                LaunchModule("auto.html");
                break;
            case "btnApriGuidaNovita":
                ApriGuidaNovita();
                break;
        }
    } catch (e) {
        alert("Errore Navigazione: " + e.message);
    }
}

function LaunchModuleStayOpen(fileName) {
    var cleanFileName = fileName.replace(/\.hta$/i, ".html");
    if (typeof window.ApriModulo === "function") {
        window.ApriModulo(cleanFileName);
        return;
    }
    if (window.parent && typeof window.parent.ApriModulo === "function") {
        window.parent.ApriModulo(cleanFileName);
        return;
    }
    if (window.top && typeof window.top.ApriModulo === "function") {
        window.top.ApriModulo(cleanFileName);
        return;
    }
    try {
        var cleanFileName = fileName;
        var queryString = "";
        var qIndex = fileName.indexOf("?");
        if (qIndex > -1) {
            cleanFileName = fileName.substring(0, qIndex);
            queryString = fileName.substring(qIndex);
        }

        var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
        if (isElectron || typeof ActiveXObject === "undefined") {
            // Nei browser moderni si deve usare sempre la versione .html (i browser non eseguono .hta ma tentano il download!)
            var htmlName = cleanFileName.replace(/\.hta$/i, ".html");
            window.open(htmlName + queryString, "_blank", "width=1200,height=800");
        } else {
            // In MSHTA/ActiveXObject si usa la versione .hta se disponibile
            var htaName = cleanFileName.replace(/\.html$/i, ".hta");
            var targetFile = fsoG.FileExists(fsoG.BuildPath(currentDir, htaName)) ? htaName : cleanFileName;
            var cleanPath = fsoG.BuildPath(currentDir, targetFile);

            var sh = new ActiveXObject("WScript.Shell");
            if (queryString) {
                var fileUri = "file:///" + cleanPath.replace(/\\/g, "/") + queryString;
                sh.Run('mshta.exe "' + fileUri + '"', 1, false);
            } else {
                sh.Run('mshta.exe "' + cleanPath + '"', 1, false);
            }
        }
    } catch(e) {
        window.open(fileName, "_blank");
    }
}

window.NavigaModulo = function(fileName) {
    if (typeof LaunchModule === "function") {
        LaunchModule(fileName);
    } else if (typeof ExecuteHTA === "function") {
        ExecuteHTA(fileName);
    }
};

/**
 * ============================================================================
 * GOLD SECURITY MANAGER - ENTERPRISE ACCESS CONTROL ENGINE
 * Sistema Logistica C. Milella - Royal Platinum Edition
 * ============================================================================
 */
var GoldSecurityManager = {
    GetActiveUser: function() {
        var user = "";
        try {
            if (typeof sessionStorage !== "undefined") {
                user = sessionStorage.getItem("currentUser") || sessionStorage.getItem("loggedUser") || "";
                if (!user && sessionStorage.getItem("utenteAutenticato")) {
                    try {
                        var uObj = JSON.parse(sessionStorage.getItem("utenteAutenticato"));
                        if (uObj && uObj.Utente) user = uObj.Utente;
                    } catch(exU) {}
                }
            }
            if (!user && typeof loggedUserActive === "string" && loggedUserActive.length > 0 && loggedUserActive !== "Ospite") {
                user = loggedUserActive;
            }
            if (!user && typeof localStorage !== "undefined") {
                user = localStorage.getItem("loggedUser") || localStorage.getItem("activeUser") || localStorage.getItem("currentUser") || "";
            }
            if (!user && typeof require === "function") {
                try {
                    var fs = require('fs');
                    var path = require('path');
                    var cP1 = path.join(__dirname, 'system', 'cred.local');
                    var cP2 = path.join(__dirname, 'File_Sistema', 'system', 'cred.local');
                    var targetCred = fs.existsSync(cP1) ? cP1 : (fs.existsSync(cP2) ? cP2 : null);
                    if (targetCred) {
                        var content = fs.readFileSync(targetCred, 'utf8');
                        var lines = content.split(/\r?\n/);
                        if (lines[0] && lines[0].trim()) user = lines[0].trim();
                    }
                } catch(eN) {}
            }
            if (!user && typeof fsoG !== "undefined" && fsoG && fsoG.BuildPath) {
                var sysDir = fsoG.BuildPath(currentDir, "system");
                var credFile = fsoG.BuildPath(sysDir, "cred.local");
                if (fsoG.FileExists(credFile)) {
                    var f = fsoG.OpenTextFile(credFile, 1);
                    if (!f.AtEndOfStream) {
                        var l1 = f.ReadLine();
                        if (l1 && l1.length > 0) user = l1;
                    }
                    f.Close();
                }
            }
        } catch(e) {}
        
        user = user ? String(user).replace(/^\s+|\s+$/g, "") : "Operatore";
        return user;
    },

    IsAdmin: function() {
        try {
            var user = this.GetActiveUser();
            var uUpper = user ? String(user).replace(/^\s+|\s+$/g, "").toUpperCase() : "";
            
            // Controlla anche il ruolo memorizzato nell'oggetto utenteAutenticato
            var roleUpper = "";
            try {
                if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("utenteAutenticato")) {
                    var uObj = JSON.parse(sessionStorage.getItem("utenteAutenticato"));
                    if (uObj && uObj.Ruolo) roleUpper = String(uObj.Ruolo).toUpperCase();
                }
            } catch(exR) {}

            // È ADMIN soltanto l'account esatto "CIRO MILELLA", "ADMIN" o un utente con ruolo esplicito "AMMINISTRATORE"
            var isMasterUser = (uUpper === "ADMIN" || uUpper === "CIRO MILELLA" || uUpper === "SUPERVISORE");
            var isMasterRole = (roleUpper === "ADMIN" || roleUpper === "AMMINISTRATORE" || roleUpper.indexOf("AMMINISTRATORE") > -1);
            
            return (isMasterUser || isMasterRole);
        } catch(e) {
            return false;
        }
    },

    CanAccessModule: function(moduleName) {
        if (!moduleName) return true;
        var modLower = moduleName.toLowerCase();
        if (modLower.indexOf("admin_utenti") > -1) {
            return this.IsAdmin();
        }
        return true;
    },

    ShowAccessDeniedModal: function(customUser) {
        var user = customUser || this.GetActiveUser();
        try {
            var overlay = document.getElementById("modalAccessoNegato");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "modalAccessoNegato";
                overlay.style.cssText = "display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); backdrop-filter:blur(6px); z-index:999999; justify-content:center; align-items:center;";
                
                var box = document.createElement("div");
                box.style.cssText = "background:#ffffff; border-radius:24px; width:450px; max-width:92%; padding:32px 28px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; position:relative; border:2px solid #fee2e2;";
                
                box.innerHTML = 
                    '<div style="width:72px; height:72px; border-radius:50%; background:#fef2f2; border:2px solid #fca5a5; display:inline-flex; align-items:center; justify-content:center; margin-bottom:18px; box-shadow:0 10px 20px rgba(239,68,68,0.2);">' +
                        '<i class="fa fa-lock" style="font-size:34px; color:#ef4444;"></i>' +
                    '</div>' +
                    '<h3 style="margin:0 0 8px 0; color:#0f172a; font-size:20px; font-weight:800; letter-spacing:-0.4px;">ACCESSO RISERVATO</h3>' +
                    '<div style="background:#fff1f2; color:#be123c; border-radius:12px; padding:10px 16px; font-size:12px; font-weight:700; margin-bottom:18px; border:1px solid #fecdd3;">' +
                        '<i class="fa fa-exclamation-triangle" style="margin-right:6px;"></i> Funzione riservata esclusivamente al profilo <b>ADMIN</b>' +
                    '</div>' +
                    '<p style="margin:0 0 24px 0; color:#64748b; font-size:13.5px; line-height:1.6; font-weight:500;">' +
                        'Gentile <b id="modalAccessoNegatoUser" style="color:#0f172a;">' + user + '</b>, il tuo profilo attuale non dispone dei privilegi amministrativi per accedere alla Gestione Utenti di Sistema.' +
                    '</p>' +
                    '<button onclick="GoldSecurityManager.CloseAccessDeniedModal()" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#ffffff; border:none; padding:14px 34px; border-radius:12px; font-weight:800; font-size:12px; cursor:pointer; letter-spacing:0.6px; text-transform:uppercase; box-shadow:0 6px 18px rgba(15,23,42,0.35); transition:all 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\';" onmouseout="this.style.transform=\'none\';">' +
                        'HO CAPITO, GRAZIE' +
                    '</button>' +
                    '<div style="margin-top:22px; padding-top:14px; border-top:1px solid #e2e8f0; font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">' +
                        '<span style="color:#d4af37; margin-right:4px;">👑</span> AMMINISTRATORE DEL PROGETTO: <strong style="color:#0f172a; font-weight:800;">Ciro Milella</strong>' +
                    '</div>';
                
                overlay.appendChild(box);
                document.body.appendChild(overlay);
            } else {
                var uEl = document.getElementById("modalAccessoNegatoUser");
                if (uEl) uEl.innerText = user;
                overlay.style.display = "flex";
            }
            
            // 1. Notifica Toast in basso a destra
            try {
                if (typeof ToastManager !== "undefined") {
                    if (ToastManager.warning) {
                        ToastManager.warning("ACCESSO NEGATO: La Gestione Utenti è riservata al profilo ADMIN.");
                    } else if (ToastManager.show) {
                        ToastManager.show("ACCESSO NEGATO: La Gestione Utenti è riservata al profilo ADMIN.", "warning");
                    }
                }
            } catch(eT) {}
            
            // 2. Registro Audit di sicurezza
            try {
                if (typeof AggiungiLog === "function") {
                    AggiungiLog("SECURITY", "Tentativo di accesso a Gestione Utenti respinto per l'utente: " + user, "warning");
                }
            } catch(eL) {}
        } catch(e) {
            alert("ACCESSO NEGATO:\n\nGentile " + user + ", la Gestione Utenti è riservata al profilo ADMIN.");
        }
    },

    CloseAccessDeniedModal: function() {
        try {
            var overlay = document.getElementById("modalAccessoNegato");
            if (overlay) overlay.style.display = "none";
        } catch(e) {}
    }
};

function MostraPopUpAccessoNegato(user) {
    GoldSecurityManager.ShowAccessDeniedModal(user);
}

function ChiudiPopUpAccessoNegato() {
    GoldSecurityManager.CloseAccessDeniedModal();
}

function IsUserAdminSession() {
    return GoldSecurityManager.IsAdmin();
}

function LaunchModule(fileName) {
    if (!GoldSecurityManager.CanAccessModule(fileName)) {
        GoldSecurityManager.ShowAccessDeniedModal();
        return;
    }
    
    var modLower = String(fileName).toLowerCase();
    if (modLower.indexOf("admin_utenti") > -1) {
        if (typeof window.ApriModalAdminUtenti === "function") {
            window.ApriModalAdminUtenti();
            return;
        } else if (parent && typeof parent.ApriModalAdminUtenti === "function") {
            parent.ApriModalAdminUtenti();
            return;
        }
    }

    ExecuteHTA(fileName);
}

function ExecuteHTA(fileName) {
    try {
        var cleanFileName = fileName;
        var queryString = "";
        var qIndex = fileName.indexOf("?");
        if (qIndex > -1) {
            cleanFileName = fileName.substring(0, qIndex);
            queryString = fileName.substring(qIndex);
        }

        var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
        if (isElectron || typeof ActiveXObject === "undefined") {
            // Nei browser moderni si deve usare sempre la versione .html (i browser non eseguono .hta ma tentano il download!)
            ALLOW_CLOSE = true;
            window.onbeforeunload = null;
            var htmlName = cleanFileName.replace(/\.hta$/i, ".html");
            var targetUrl = htmlName + queryString;

            if (typeof window.ApriModulo === "function") {
                window.ApriModulo(targetUrl);
                return;
            }
            if (window.parent && typeof window.parent.ApriModulo === "function") {
                window.parent.ApriModulo(targetUrl);
                return;
            }
            if (window.top && typeof window.top.ApriModulo === "function") {
                window.top.ApriModulo(targetUrl);
                return;
            }

            window.location.href = targetUrl;
            return;
        } else {
            // In MSHTA/ActiveXObject si usa la versione .hta se disponibile
            var htaName = cleanFileName.replace(/\.html$/i, ".hta");
            var targetFile = fsoG.FileExists(fsoG.BuildPath(currentDir, htaName)) ? htaName : cleanFileName;
            var cleanPath = fsoG.BuildPath(currentDir, targetFile);

            var shell = new ActiveXObject("WScript.Shell");
            if (queryString) {
                var fileUri = "file:///" + cleanPath.replace(/\\/g, "/") + queryString;
                shell.Run('mshta.exe "' + fileUri + '"', 1, false);
            } else {
                shell.Run('mshta.exe "' + cleanPath + '"', 1, false);
            }
            // Transizione atomica: chiudiamo subito per liberare il database
            AtomicClose();
        }
    } catch(e) {
        ALLOW_CLOSE = true;
        window.onbeforeunload = null;
        window.location.href = fileName;
    }
}

function SelezionaEImportaMateriale() {
    var picker = document.getElementById("pickerMaterialeFile");
    if (picker) {
        picker.value = ""; // Reset per consentire la re-selezione dello stesso file
        picker.click();
    } else {
        LaunchMaterialDashboard();
    }
}

function GestisciImportazioneMateriale(inputElement) {
    if (!inputElement || !inputElement.files || inputElement.files.length === 0) {
        return;
    }
    var fileObj = inputElement.files[0];
    var filePath = (fileObj && fileObj.path) ? fileObj.path : (inputElement.value || "");
    ImportaFileExcelMateriali(filePath, fileObj);
}

function ImportaFileExcelMateriali(filePath, fileObj) {
    try {
        var hasActiveX = (typeof ActiveXObject !== "undefined");
        var shellAx = null;
        var fsoAx = null;
        if (hasActiveX) {
            try {
                shellAx = new ActiveXObject("WScript.Shell");
                fsoAx = new ActiveXObject("Scripting.FileSystemObject");
            } catch(eAx) {}
        }

        var targetExcelPath = (filePath && filePath.toLowerCase().indexOf("fakepath") === -1) ? filePath : "";
        if (fileObj && fileObj.path) {
            targetExcelPath = fileObj.path;
        }

        function checkFileExists(p) {
            if (!p) return false;
            try {
                if (fsoAx) return fsoAx.FileExists(p);
                if (typeof require === "function") {
                    var fsN = require("fs");
                    return fsN.existsSync(p);
                }
            } catch(e) {}
            return true;
        }

        if (!targetExcelPath || !checkFileExists(targetExcelPath)) {
            var candidatePaths = [
                "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\_Documenti_e_Fogli\\ELENCO E QUANTITA'MATERIALE.xls",
                "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\_Archivio_Legacy_e_Excel\\ELENCO E QUANTITA'MATERIALE.xls",
                "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_Ufficio\\ELENCO E QUANTITA'MATERIALE.xls",
                "C:\\Users\\Utente\\Desktop\\ELENCO E QUANTITA'MATERIALE.xls",
                "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\ELENCO E QUANTITA'MATERIALE.xls"
            ];
            for (var c = 0; c < candidatePaths.length; c++) {
                if (checkFileExists(candidatePaths[c])) {
                    targetExcelPath = candidatePaths[c];
                    break;
                }
            }
        }

        // Se abbiamo un percorso Excel valido, esegui l'importazione e aggiorna config.json
        if (targetExcelPath) {
            var materialDir = "gestione_materiale";
            if (fsoAx && typeof currentDir !== "undefined") {
                materialDir = fsoAx.BuildPath(currentDir, "gestione_materiale");
            }
            var importScript = (fsoAx && typeof currentDir !== "undefined") ? fsoAx.BuildPath(materialDir, "import_excel_native.vbs") : "gestione_materiale\\import_excel_native.vbs";
            var configPath = (fsoAx && typeof currentDir !== "undefined") ? fsoAx.BuildPath(materialDir, "config.json") : "gestione_materiale\\config.json";

            // 1. Aggiorna config.json
            try {
                if (fsoAx && fsoAx.FileExists(configPath)) {
                    var f = fsoAx.OpenTextFile(configPath, 1);
                    var content = f.ReadAll();
                    f.Close();
                    var cleanedPath = targetExcelPath.replace(/\\/g, "\\\\");
                    if (content.indexOf("excelPath") > -1) {
                        content = content.replace(/"excelPath"\s*:\s*".*?"/g, '"excelPath": "' + cleanedPath + '"');
                    } else {
                        content = content.replace(/}\s*$/, ', "excelPath": "' + cleanedPath + '" }');
                    }
                    var fw = fsoAx.OpenTextFile(configPath, 2);
                    fw.Write(content);
                    fw.Close();
                } else if (typeof require === "function") {
                    var fsNode = require("fs");
                    var pathMod = require("path");
                    var fullConfig = pathMod.join(process.cwd(), "File_Sistema", "gestione_materiale", "config.json");
                    if (!fsNode.existsSync(fullConfig)) {
                        fullConfig = pathMod.join(process.cwd(), "gestione_materiale", "config.json");
                    }
                    if (fsNode.existsSync(fullConfig)) {
                        var contentStr = fsNode.readFileSync(fullConfig, "utf8");
                        var cleanedPath = targetExcelPath.replace(/\\/g, "\\\\");
                        if (contentStr.indexOf("excelPath") > -1) {
                            contentStr = contentStr.replace(/"excelPath"\s*:\s*".*?"/g, '"excelPath": "' + cleanedPath + '"');
                        }
                        fsNode.writeFileSync(fullConfig, contentStr, "utf8");
                    }
                }
            } catch(eCfg) {}

            // 2. Esegui importazione VBScript nativa
            if (fsoAx && shellAx) {
                try {
                    shellAx.Run('wscript.exe "' + importScript + '" "' + targetExcelPath + '"', 0, true);
                } catch(eRun) {}
            } else if (typeof require === "function") {
                try {
                    var cp = require("child_process");
                    var pathMod = require("path");
                    var fullVbs = pathMod.join(process.cwd(), "File_Sistema", "gestione_materiale", "import_excel_native.vbs");
                    if (require("fs").existsSync(fullVbs)) {
                        cp.execSync('wscript.exe "' + fullVbs + '" "' + targetExcelPath + '"', { windowsHide: true });
                    }
                } catch(eExec) {}
            }
        }

        LaunchMaterialDashboard(targetExcelPath);
    } catch(err) {
        alert("Errore caricamento nuovo file materiale: " + err.message);
        LaunchMaterialDashboard();
    }
}

function LaunchMaterialDashboard(excelPath) {
    try {
        ExecuteHTA("gestione_materiale/visualizzatore_materiali.html");
    } catch(err) {
        alert("Errore avvio gestione materiale: " + err.message);
    }
}

function ActionEsci() {
    var nUrg = 0;
    try { 
        var lbl = document.getElementById("lblStat2");
        if (lbl) nUrg = parseInt(lbl.innerText) || 0; 
    } catch(e){}
    
    var msg = "Sei sicuro di voler uscire e chiudere il programma?";
    if (nUrg > 0) {
        msg = "<div style='color:#ef4444; font-weight:800; margin-bottom:8px;'>⚠️ ATTENZIONE: Ci sono ancora " + nUrg + " URGENZE attive per oggi!</div>" + msg;
    }
    
    var modal = document.getElementById("exitModalOverlay");
    var msgEl = document.getElementById("exitModalMessage");
    if (modal && msgEl) {
        msgEl.innerHTML = msg;
        modal.style.display = "flex";
    } else if (typeof window.ShowGoldConfirm === "function") {
        window.ShowGoldConfirm("CONFERMA DI USCITA", msg, "SI, ESCI", "ANNULLA", function() {
            EseguiBackup(true); 
            AtomicClose();
        }, null, "🚪");
    } else {
        if (confirm("Sei sicuro di voler uscire e chiudere il programma?")) {
            EseguiBackup(true); 
            AtomicClose();
        }
    }
}

function ChiudiModalUscita() {
    var modal = document.getElementById("exitModalOverlay");
    if (modal) modal.style.display = "none";
}

function ConfermaUscitaEffettiva() {
    ChiudiModalUscita();
    EseguiBackup(true); 
    AtomicClose();
}

function AtomicClose() {
    try {
        ALLOW_CLOSE = true; 
        window.onbeforeunload = null;
        
        var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
        if (isElectron) {
            try {
                if (typeof require !== 'undefined') {
                    var electron = require('electron');
                    electron.ipcRenderer.send('show-parent');
                }
            } catch(e) {}
            window.close();
            return;
        }

        // Fermiamo ogni clock o processo asincrono che cambia il titolo
        if (typeof(titleClockInterval) !== 'undefined') clearInterval(titleClockInterval);
        
        // Se non c'è ActiveXObject (browser moderno)
        if (typeof ActiveXObject === "undefined") {
            try { window.open('', '_self', ''); } catch(e) {}
            try { window.close(); } catch(e) {}
            try { self.close(); } catch(e) {}
            return;
        }

        // Se c'è ActiveXObject (MSHTA / IE)
        var uniqueKillerTitle = "TERMINATE_DASHBOARD_" + new Date().getTime();
        document.title = uniqueKillerTitle;
        window.focus();
        
        try {
            window.open('', '_self', '');
            window.close();
        } catch(eClose) {}

        setTimeout(function() {
            try {
                var sh = new ActiveXObject("WScript.Shell");
                try { sh.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq ' + uniqueKillerTitle + '"', 0, false); } catch(e1) {}
                try { sh.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq AGENDA - Pannello di Controllo"', 0, false); } catch(e2) {}
            } catch(ex) {}
        }, 100);
    } catch(err) {
        try { window.close(); } catch(e) {}
    }
}

function EseguiBackup(isQuiet) {
    try {
        if (typeof require === "function") {
            try {
                var fs = require('fs');
                var path = require('path');
                var dbPath = path.join(__dirname, 'File_Sistema', 'ConsegneDB_Legacy.sqlite');
                if (!fs.existsSync(dbPath)) dbPath = path.join(__dirname, 'ConsegneDB_Legacy.sqlite');
                
                var backupDir = path.join(__dirname, 'File_Sistema', 'Backup_Vault');
                if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
                
                if (fs.existsSync(dbPath)) {
                    var now = new Date();
                    var timestamp = now.getFullYear() +
                        ("0" + (now.getMonth() + 1)).slice(-2) +
                        ("0" + now.getDate()).slice(-2) + "_" +
                        ("0" + now.getHours()).slice(-2) +
                        ("0" + now.getMinutes()).slice(-2) +
                        ("0" + now.getSeconds()).slice(-2);
                    var destPath = path.join(backupDir, 'ConsegneDB_AUTO_' + timestamp + '.sqlite');
                    fs.copyFileSync(dbPath, destPath);
                    
                    var files = fs.readdirSync(backupDir).filter(function(f) { return f.indexOf('ConsegneDB_AUTO_') === 0; }).map(function(f) {
                        return { name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() };
                    }).sort(function(a, b) { return b.time - a.time; });
                    
                    if (files.length > 15) {
                        for (var i = 15; i < files.length; i++) {
                            try { fs.unlinkSync(path.join(backupDir, files[i].name)); } catch(eU) {}
                        }
                    }
                    if (!isQuiet) {
                        if (typeof ToastManager !== "undefined") {
                            ToastManager.success("BACKUP COMPLETATO CON SUCCESSO!\nSnapshot salvato in Backup_Vault.");
                        } else {
                            alert("Backup completato con successo nel Backup_Vault!");
                        }
                    }
                    return;
                }
            } catch(eNode) {}
        }
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var pathEval = document.location.pathname;
        if (pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
        pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
        var dir = fso.GetParentFolderName(pathEval);
        
        var pathBackupBat = fso.BuildPath(fso.BuildPath(dir, "system"), "AVVIA_BACKUP.bat");
        var shell = new ActiveXObject("WScript.Shell");
        
        if (isQuiet) {
            var pathPs1 = fso.BuildPath(fso.BuildPath(dir, "system"), "backup_manager.ps1");
            shell.Run('powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + pathPs1 + '"', 0, false);
        } else {
            shell.Run('"' + pathBackupBat + '"', 1, false);
        }
    } catch(e) {
        if (!isQuiet) alert("Errore durante l'avvio del backup: " + e.message);
    }
}

function EseguiBackupCompletoProgetto() {
    try {
        if (typeof require === "function") {
            var cp = require('child_process');
            var path = require('path');
            var fs = require('fs');

            var projDir = path.join(__dirname);
            if (!fs.existsSync(path.join(projDir, 'package.json'))) {
                projDir = path.join(__dirname, '..');
            }

            var psScript = path.join(projDir, 'tools', 'Crea_Backup_Completo_Zip.ps1');

            if (typeof ToastManager !== "undefined") {
                ToastManager.info("AVVIO BACKUP COMPLETO INTERFACCIA & DATI\nCreazione archivio ZIP in corso...");
            }
            
            // Crea overlay di blocco per indicare l'attesa
            var loadingOverlay = document.createElement("div");
            loadingOverlay.id = "backupLoadingOverlay";
            loadingOverlay.style.position = "fixed";
            loadingOverlay.style.top = "0";
            loadingOverlay.style.left = "0";
            loadingOverlay.style.width = "100%";
            loadingOverlay.style.height = "100%";
            loadingOverlay.style.background = "rgba(15,23,42,0.95)";
            loadingOverlay.style.backdropFilter = "blur(10px)";
            loadingOverlay.style.zIndex = "9999999";
            loadingOverlay.style.display = "flex";
            loadingOverlay.style.flexDirection = "column";
            loadingOverlay.style.alignItems = "center";
            loadingOverlay.style.justifyContent = "center";
            loadingOverlay.innerHTML = 
                "<style>" +
                "@keyframes pulseGlow{0%{filter:drop-shadow(0 0 5px rgba(245,158,11,0.5));transform:scale(1);}50%{filter:drop-shadow(0 0 20px rgba(245,158,11,0.9));transform:scale(1.02);}100%{filter:drop-shadow(0 0 5px rgba(245,158,11,0.5));transform:scale(1);}}" +
                "@keyframes spinLoader{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}" +
                ".loader-ring{display:inline-block;width:56px;height:56px;border:6px solid rgba(245,158,11,0.15);border-radius:50%;border-top-color:#f59e0b;animation:spinLoader 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;margin-bottom:24px;box-shadow: 0 0 15px rgba(245,158,11,0.2);}" +
                ".backup-title{animation:pulseGlow 2.5s infinite ease-in-out;color:#f59e0b;font-family:\"Segoe UI\",Tahoma,sans-serif;font-size:34px;font-weight:900;letter-spacing:2.5px;margin-bottom:12px;margin-top:0;}" +
                "</style>" +
                "<div class='loader-ring'></div>" +
                "<h1 class='backup-title'>BACKUP IN CORSO...</h1>" +
                "<p style='color:white; font-size:18px;'>Salvataggio in sicurezza di tutti i dati e delle grafiche.</p>" +
                "<p style='color:#cbd5e1; font-size:15px; margin-top:24px; padding:15px; border:1px solid #334155; border-radius:8px; background:rgba(0,0,0,0.5);'>" +
                "L'operazione richiede alcune decine di secondi in base alla dimensione dei file.<br>" +
                "<b style='color:#ef4444;'>TI PREGHIAMO DI ATTENDERE E NON CHIUDERE L'APPLICAZIONE.</b>" +
                "</p>";
            document.body.appendChild(loadingOverlay);

            var psCmd = 'powershell.exe -ExecutionPolicy Bypass -File "' + psScript + '"';
            
            cp.exec(psCmd, { cwd: projDir }, function(err, stdout, stderr) {
                var overlay = document.getElementById("backupLoadingOverlay");
                if (overlay) overlay.parentNode.removeChild(overlay);
                
                if (!err && stdout && stdout.indexOf("SALVATO CON SUCCESSO") > -1) {
                    if (typeof ToastManager !== "undefined") {
                        ToastManager.success("BACKUP COMPLETO SALVATO CON SUCCESSO!\nArchivio salvato in: documenti/Backup_Completo_Sistema");
                    }
                } else {
                    var errMsg = err ? err.message : (stderr || stdout);
                    if (typeof ToastManager !== "undefined") {
                        ToastManager.error("Errore durante il backup completo:\n" + errMsg);
                    }
                }
            });
            return;
        }
        alert("Funzione di Backup Completo disponibile in ambiente Electron.");
    } catch(e) {
        alert("Errore avvio backup completo: " + e.message);
    }
}

function ApriCartellaBackupCompleto(e) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.cancelBubble !== undefined) e.cancelBubble = true;
    }
    try {
        var targetDir = "";
        if (typeof require === "function") {
            var cp = require('child_process');
            var projDir = fsoG.GetParentFolderName(currentDir);
            targetDir = fsoG.BuildPath(projDir, "documenti\\Backup_Completo_Sistema");
            if (!fsoG.FolderExists(targetDir)) {
                try { fsoG.CreateFolder(targetDir); } catch(errMk){}
            }
            cp.exec('explorer.exe "' + targetDir + '"');
            return;
        }

        if (typeof ActiveXObject !== "undefined" || window.ActiveXObject) {
            var shell = new ActiveXObject("WScript.Shell");
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            var projDir = fso.GetAbsolutePathName(".");
            targetDir = projDir + "\\documenti\\Backup_Completo_Sistema";
            if (!fso.FolderExists(targetDir)) {
                try { fso.CreateFolder(targetDir); } catch(errMk){}
            }
            shell.Run('explorer.exe "' + targetDir + '"');
            return;
        }
    } catch(err) {
        alert("Errore nell'apertura della cartella backup: " + err.message);
    }
}
if (typeof window !== "undefined") window.ApriCartellaBackupCompleto = ApriCartellaBackupCompleto;

function MostraGuidaBackupModal() {
    try {
        var m = document.getElementById("modalGuidaBackup");
        if (m) m.style.display = "flex";
    } catch(e) {}
}

/**
 * MOTORE CALENDARIO PER STAMPA
 */
var calDate = new Date();

function ApriCalendarioPerStampa() {
    calDate = new Date();
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
    for (var i = 0; i < days.length; i++) {
        var d = days[i];
        var th = document.createElement("th"); 
        th.innerText = d; 
        if(i === 5) th.style.color = "#005a9e"; // Sabato
        if(i === 6) th.style.color = "#e74c3c"; // Domenica
        trH.appendChild(th); 
    }
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
                
                // Colorazioni Weekend
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
                btn.onclick = (function(d, m, y) {
                    return function() { SelezionaGiornoPerStampa(d, m, y); };
                })(dayCount, calDate.getMonth() + 1, calDate.getFullYear());
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
    // 1. Festività Fisse
    if (day === 1 && month === 1) return true;   // Capodanno
    if (day === 6 && month === 1) return true;   // Epifania
    if (day === 25 && month === 4) return true;  // Liberazione
    if (day === 1 && month === 5) return true;   // Lavoro
    if (day === 2 && month === 6) return true;   // Repubblica
    if (day === 15 && month === 8) return true;  // Ferragosto
    if (day === 1 && month === 11) return true;  // Ognissanti
    if (day === 8 && month === 12) return true;  // Immacolata
    if (day === 25 && month === 12) return true; // Natale
    if (day === 26 && month === 12) return true; // S. Stefano
    
    // 2. Festività Mobili (Pasqua e Pasquetta)
    // Calcoliamo la Pasqua per l'anno corrente (Algoritmo di Gauss semplificato)
    var a = year % 19, b = Math.floor(year / 100), c = year % 100,
        d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451),
        monthPasqua = Math.floor((h + l - 7 * m + 114) / 31),
        dayPasqua = ((h + l - 7 * m + 114) % 31) + 1;
        
    // Pasqua
    if (day === dayPasqua && month === monthPasqua) return true;
    
    // Pasquetta (Lunedì dell'Angelo)
    var dtP = new Date(year, monthPasqua - 1, dayPasqua);
    dtP.setDate(dtP.getDate() + 1);
    if (day === dtP.getDate() && month === (dtP.getMonth() + 1)) return true;

    return false;
}

/**
 * MINI CALENDARIO PER SIDEBAR
 */
function RenderSidebarCalendar() {
    var container = document.getElementById("sidebarCalendarGrid");
    var title = document.getElementById("sidebarCalendarTitle");
    if (!container || !title) return;
    
    container.innerHTML = "";
    var now = new Date();
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    title.innerText = mesi[now.getMonth()] + " " + now.getFullYear();
    
    var table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "8px";
    table.style.color = "#ecf0f1";
    
    var trH = document.createElement("tr");
    var sidebarDays = ["L","M","M","G","V","S","D"];
    for (var i = 0; i < sidebarDays.length; i++) {
        var d = sidebarDays[i];
        var th = document.createElement("th");
        th.innerText = d;
        th.style.padding = "1px";
        th.style.opacity = "0.5";
        trH.appendChild(th);
    }
    table.appendChild(trH);
    
    var firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    if(firstDay === 0) firstDay = 7;
    var lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    var dayCount = 1;
    
    for(var r=0; r<6; r++) {
        var tr = document.createElement("tr");
        for(var c=1; c<=7; c++) {
            var td = document.createElement("td");
            td.style.textAlign = "center";
            td.style.padding = "1px";
            var pos = r * 7 + c;
            if(pos >= firstDay && dayCount <= lastDay) {
                td.innerText = dayCount;
                if(dayCount === now.getDate()) {
                    td.style.background = "#ffab00";
                    td.style.color = "#000";
                    td.style.borderRadius = "50%";
                    td.style.fontWeight = "bold";
                }
                if(c >= 6) td.style.color = "#ff8c00"; // Weekend
                dayCount++;
            }
            tr.appendChild(td);
        }
        table.appendChild(tr);
        if(dayCount > lastDay) break;
    }
    container.appendChild(table);
}

function SelezionaGiornoPerStampa(g, m, a) {
    document.getElementById("calendarOverlay").style.display = "none";
    var gg = (g < 10 ? '0' : '') + g;
    var mm = (m < 10 ? '0' : '') + m;
    var dataStr = gg + "/" + mm + "/" + a;
    
    GeneraReportPerDataSpecifica(dataStr);
}

function GeneraReportPerDataSpecifica(strData) {
    var p = strData.split("/");
    var sqlDate = "#" + p[2] + "-" + p[1] + "-" + p[0] + "#";
    
    // Filtro: Solo quelle da fare (Consegnato = False o 0)
    var sql = "SELECT * FROM tblConsegne WHERE DataConsegna = " + sqlDate + " AND (Consegnato = False OR Consegnato = 0) ORDER BY OraConsegna ASC, Priorita ASC";
    
    try {
        var dati = queryAccessDB(sql);
        if(dati.length === 0) {
            alert("Nessuna consegna 'DA FARE' trovata per il giorno " + strData);
            return;
        }
        
        MostraAnteprimaReport(dati, "Consegne da Effettuare - Giorno " + strData);
    } catch(e) {
        alert("Errore caricamento dati: " + e.message);
    }
}

/**
 * MOTORE DI STAMPA ENTERPRISE
 */
var currentReportFileName = "";
var exportPath = ""; // Verrà caricato o chiesto al bisogno

function MostraAnteprimaReport(dati, titolo) {
    currentReportFileName = "Report_" + titolo.replace(/ /g, "_") + ".pdf";
    var container = document.getElementById("reportStampaContainer");
    
    var html = '<div class="print-controls">';
    html += '<button class="btn-print-confirm" onclick="EsportaPDFProfessionale()">📄 GENERA PDF</button>';
    html += '<button class="btn-print-cancel" onclick="ChiudiAnteprimaReport()">❌ ESCI</button>';
    html += '</div>';
    
    html += '<div class="page">';
    html += '  <div class="header-coop">C.M</div>'; // Rebranding
    html += '  <div class="report-subtitle">Servizi di Logistica e Consegne Ausili</div>';
    html += '  <div class="report-title-box"><div class="report-title">' + titolo + '</div></div>';
    
    html += '  <table class="report-table">';
    html += '    <thead><tr><th width="40">N°</th><th width="80">Ora</th><th>Cliente</th><th width="120">Telefono</th><th>Indirizzo / Località</th><th width="90">Ordine</th></tr></thead>';
    html += '    <tbody>';
    
    for(var i=0; i<dati.length; i++) {
        var r = dati[i];
        html += '<tr class="' + (i%2===1?'bg-alt':'') + '">';
        html += '<td align="center">' + (i+1) + '</td>';
        html += '<td align="center"><b>' + (r.OraConsegna || "--:--") + '</b></td>';
        html += '<td class="row-name">' + (r.ClienteNome || "").toUpperCase() + '</td>';
        html += '<td>' + (r.Telefono || "-") + '</td>';
        html += '<td>' + (r.IndirizzoConsegna || "") + " - " + (r.LocalitaConsegna || "").toUpperCase() + '</td>';
        html += '<td align="center">' + (r.NumeroOrdine || "-") + '</td>';
        html += '</tr>';
        
        if(r.Note && r.Note.trim() !== "") {
            html += '<tr class="' + (i%2===1?'bg-alt':'') + '"><td></td><td colspan="5" style="font-style:italic; font-size:9pt; color:#555;"><b>NOTA:</b> ' + r.Note + '</td></tr>';
        }
    }
    
    html += '    </tbody></table>';
    html += '  <div class="signatures-wrapper">';
    html += '    <div class="signature-block"><div class="signature-title">Firma Conducente</div><div class="signature-line"></div></div>';
    html += '    <div class="signature-block"><div class="signature-title">Firma Responsabile</div><div class="signature-line"></div></div>';
    html += '  </div>';
    html += '</div>';
    
    container.innerHTML = html;
    container.style.display = "block";
    document.getElementById("mainDashboardContainer").style.display = "none";
}

function ChiudiAnteprimaReport() {
    document.getElementById("reportStampaContainer").style.display = "none";
    document.getElementById("mainDashboardContainer").style.display = "block";
}

function EsportaPDFProfessionale() {
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var shell = new ActiveXObject("WScript.Shell");
    var desktop = shell.SpecialFolders("Desktop");
    var pdfPath = fso.BuildPath(desktop, currentReportFileName);
    
    try {
        var reportHTML = document.getElementById("reportStampaContainer").innerHTML;
        reportHTML = reportHTML.replace(/<div class="print-controls[\s\S]*?<\/div>/i, "");
        
        var fullHTML = '<html><head><meta charset="UTF-8"><style>' +
                       'body { font-family: "Segoe UI", Arial; padding: 2cm; }' +
                       '.header-coop { font-size: 24pt; font-weight: bold; text-align: center; }' +
                       '.report-title-box { border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 10px; margin: 20px 0; text-align: center; }' +
                       '.report-title { font-size: 16pt; font-weight: bold; }' +
                       '.report-table { width: 100%; border-collapse: collapse; }' +
                       '.report-table th { background: #34495e; color: #fff; padding: 10px; border: 1px solid #333; }' +
                       '.report-table td { padding: 8px; border: 1px solid #ccc; font-size: 10pt; }' +
                       '.bg-alt { background: #f9f9f9; }' +
                       '.signatures-wrapper { margin-top: 50px; display: table; width: 100%; }' +
                       '.signature-block { display: table-cell; width: 50%; text-align: center; }' +
                       '.signature-title { font-weight: bold; margin-bottom: 40px; }' +
                       '.signature-line { border-top: 1px solid #000; width: 200px; margin: 0 auto; }' +
                       '</style></head><body>' + reportHTML + '</body></html>';

        var tmpPath = fso.BuildPath(currentDir, "temp_print.html");
        var stream = new ActiveXObject("ADODB.Stream");
        stream.Type = 2; stream.Charset = "utf-8"; stream.Open();
        stream.WriteText(fullHTML); stream.SaveToFile(tmpPath, 2); stream.Close();

        var wordApp = new ActiveXObject("Word.Application");
        wordApp.Visible = false;
        var doc = wordApp.Documents.Open(tmpPath);
        doc.PageSetup.Orientation = 1; // Landscape
        doc.SaveAs2(pdfPath, 17); // wdFormatPDF
        doc.Close(false);
        wordApp.Quit();

        fso.DeleteFile(tmpPath);
        alert("PDF creato sul Desktop:\n" + pdfPath);
        shell.Run('"' + pdfPath + '"');
    } catch(e) {
        alert("Errore PDF: " + e.message);
    }
}

// Funzione di utilità per interpretare Date/Seriali/Stringhe da database
function parseAnyDate(v) {
    if (!v) return null;
    
    // TENTATIVO 1: Gestione stringa (es. "DD/MM/YYYY" o formati locale) - PRIORITÀ ALTA PER FORMATO IT
    var s = String(v);
    var parts = s.match(/\d+/g);
    if (parts && parts.length >= 3) {
        var gg, mm, aa;
        // Se la stringa inizia con l'anno (ISO: YYYY-MM-DD)
        if (parts[0].length === 4) {
            aa = parseInt(parts[0], 10);
            mm = parseInt(parts[1], 10);
            gg = parseInt(parts[2], 10);
        } else {
            // Formato IT: GG/MM/AAAA (pulisce nomi giorni es "Wed ")
            gg = parseInt(parts[0], 10);
            mm = parseInt(parts[1], 10);
            aa = parseInt(parts[2], 10);
            
            // Fallback per mesi testuali in stringhe tipo "Wed Apr 6 2026"
            if (isNaN(mm) || mm > 12) {
                var mesiEN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                for(var m=0; m<12; m++) { if(s.indexOf(mesiEN[m]) > -1) { mm = m + 1; break; } }
            }
        }
        if (aa > 0 && aa < 100) aa += 2000;
        if (aa > 1900 && mm > 0 && mm <= 12) {
            var d_res = new Date(aa, mm - 1, gg);
            if (!isNaN(d_res.getTime())) return d_res;
        }
    }

    // TENTATIVO 2: Conversione tramite valore numerico (per seriali o timestamp)
    var n = Number(v);
    if (!isNaN(n) && n > 0) {
        if (n > 1000000000000) return new Date(n);
        if (n > 30000 && n < 60000) return new Date((n - 25569) * 86400000);
    }

    // TENTATIVO 3: Conversione diretta (per oggetti Date e tipo 'date' ADODB)
    try {
        var d = new Date(v);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return d;
    } catch(e) {}
    
    return null;
}

function queryAccessDB(sql, isUpdate) {
    try {
        var http = null;
        if (typeof window !== "undefined" && window.XMLHttpRequest) {
            http = new XMLHttpRequest();
        } else {
            http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
            http.SetTimeouts(1500, 1500, 1500, 1500); // Timeout rapidi per non freezare l'HTA
        }
        
        http.open("POST", "http://127.0.0.1:3002/query", false);
        http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));
        
        if (http.status === 200) {
            var res = JSON.parse(http.responseText);
            return isUpdate ? true : res;
        } else {
            return isUpdate ? false : [];
        }
    } catch(errReq) {
        return isUpdate ? false : [];
    }
}

function ConnectToDatabase() {
    // 1. Prova con ADO (ACE/Jet) - Più veloce
    // Tentiamo in sequenza 16.0 e 12.0 restando a 64-bit (o nel bitness attuale)
    var providers = ["Microsoft.ACE.OLEDB.16.0", "Microsoft.ACE.OLEDB.12.0", "Microsoft.Jet.OLEDB.4.0"];
    for (var i = 0; i < providers.length; i++) {
        var connStr = "Provider=" + providers[i] + ";Data Source=" + DB_PATH + ";";
        try {
            var conn = new ActiveXObject("ADODB.Connection");
            conn.Open(connStr + "Mode=ReadWrite;Share Deny None;");
            return { type: "ADO", handle: conn };
        } catch (e1) {
            try {
                var conn2 = new ActiveXObject("ADODB.Connection");
                conn2.Open(connStr); // Fallback senza parametri di blocco
                return { type: "ADO", handle: conn2 };
            } catch(e2) {}
        }
    }

    // 2. Prova con Access.Application (DAO) - Fallback robusto
    try {
        var app = new ActiveXObject("Access.Application");
        app.Visible = false;
        app.OpenCurrentDatabase(DB_PATH);
        return { type: "DAO", handle: app.CurrentDb(), app: app };
    } catch (e) { }

    return null;
}

function EseguiStampaExcel(dati, titoloPeriodo) {
    var xlApp = null;
    try {
        xlApp = new ActiveXObject("Excel.Application");
        var wb = xlApp.Workbooks.Add();
        var ws = wb.Sheets(1);
        ws.Name = "Report_Temp";

        // Intestazione
        ws.Range("A1").Value = "Consegne - " + titoloPeriodo;
        ws.Range("C1").Value = "Cooperativa Aurelio Nicolodi";
        ws.Range("C1").Font.Bold = true;
        ws.Range("F1").Value = "Stampa: " + new Date().toLocaleDateString("it-IT");

        ws.Range("A3:G3").Merge();
        ws.Range("A3").Value = "Stampa Consegne/Configurazioni - " + titoloPeriodo;
        ws.Range("A3").Font.Size = 18;
        ws.Range("A3").Font.Bold = true;
        ws.Range("A3").HorizontalAlignment = -4108; // Center

        // Headers
        var headers = ["N°", "Mese", "Cognome Nome", "Località", "Residenza", "Giorno", "Ora"];
        for (var h = 0; h < headers.length; h++) ws.Cells(5, h + 1).Value = headers[h];

        var hdrRange = ws.Range("A5:G5");
        hdrRange.Font.Bold = true;
        hdrRange.Interior.Color = 13816530; // Grigio 210
        hdrRange.Font.Size = 14;
        hdrRange.Borders.LineStyle = 1;

        // Scrittura Dati
        var riga = 6;
        var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        for (var i = 0; i < dati.length; i++) {
            var record = dati[i];
            var colore = (i % 2 === 0) ? 16777215 : 15132390; // Bianco vs Grigio 230

            ws.Cells(riga, 1).Value = i + 1;
            var dt = new Date(record.DataConsegna);
            ws.Cells(riga, 2).Value = mesi[dt.getMonth()].substring(0, 5);
            ws.Cells(riga, 3).Value = (record.ClienteNome || "").toUpperCase();
            ws.Cells(riga, 4).Value = record.LocalitaConsegna || "";
            ws.Cells(riga, 5).Value = record.IndirizzoConsegna || "";
            ws.Cells(riga, 6).Value = dt.toLocaleDateString("it-IT");

            var tCell = ws.Cells(riga, 7);
            tCell.NumberFormat = "@";
            if (record.OraConsegna) {
                var ora = new Date(record.OraConsegna);
                if (ora.getTime()) tCell.Value = ora.getHours() + ":" + (ora.getMinutes() < 10 ? "0" : "") + ora.getMinutes();
                else tCell.Value = record.OraConsegna; // Fallback stringa
            }
            tCell.Font.Size = 18;
            tCell.Font.Bold = true;

            var rRange = ws.Range("A" + riga + ":G" + riga);
            rRange.Interior.Color = colore;
            rRange.Borders.LineStyle = 1;
            rRange.Font.Size = 14;
            rRange.VerticalAlignment = -4108;

            // Note (se esistono)
            if (record.Note) {
                riga++;
                var noteRange = ws.Range("B" + riga + ":G" + riga);
                noteRange.Merge();
                noteRange.Value = "   NOTA: " + record.Note;
                noteRange.Font.Italic = true;
                noteRange.Font.Size = 13;
                noteRange.Font.Bold = true;
                noteRange.Interior.Color = colore;
                noteRange.Borders.LineStyle = 1;
                noteRange.WrapText = true;
                ws.Range("A" + riga).Interior.Color = colore;
                ws.Range("A" + riga).Borders.LineStyle = 1;
            }
            riga++;
        }

        // Firme
        riga += 2;
        ws.Cells(riga, 3).Value = "Firma per ricevuta: ____________________";
        ws.Cells(riga, 6).Value = "Firma per visione: ____________________";
        ws.Range("A" + riga + ":G" + riga).Font.Bold = true;

        // Formato Colonne
        ws.Columns("A").ColumnWidth = 5;
        ws.Columns("B").ColumnWidth = 10;
        ws.Columns("C").ColumnWidth = 35;
        ws.Columns("D").ColumnWidth = 20;
        ws.Columns("E").ColumnWidth = 40;
        ws.Columns("F").ColumnWidth = 16;
        ws.Columns("G").ColumnWidth = 15;

        // Page Setup
        var ps = ws.PageSetup;
        ps.Orientation = 2; // Landscape
        ps.Zoom = false;
        ps.FitToPagesWide = 1;
        ps.FitToPagesTall = false;

        // Export PDF
        var desktop = new ActiveXObject("WScript.Shell").SpecialFolders("Desktop");
        var pdfPath = desktop + "\\Report_Consegne_" + new Date().getTime() + ".pdf";

        wb.ExportAsFixedFormat(0, pdfPath);
        xlApp.Visible = true; // Apre excel per mostrare il template temporaneo

        alert("PDF creato con successo sul Desktop:\n" + pdfPath);
    } catch (err) {
        alert("Errore Generazione PDF: " + err.message);
    } finally {
        if (xlApp) {
            // Se vogliamo chiudere e pulire (come nel VBA PulisciAmbientePDF)
            // xlApp.DisplayAlerts = false;
            // xlApp.Quit();
        }
    }
}


/**
 * RICUPERO DATI PER AGENDA HOME (RICHIESTA UTENTE)
 * Priorità: Urgenze in cima, poi le altre del giorno/mese
 */
function CaricaAgendaHome() {
    var tbody = document.getElementById("tbodyAgendaHome");
    if (!tbody) return;

    try {
        // Query che mette gli URGENTI per primi (IIf in Access)
        // Mostra solo consegne NON effettuate (Consegnato = False o 0)
        var sql = "SELECT ClienteNome, OraConsegna, LocalitaConsegna, IndirizzoConsegna, NumeroOrdine, Merce, Note, Priorita, ID, Telefono, DataConsegna " +
                  "FROM tblConsegne " +
                  "WHERE (Consegnato = False OR Consegnato = 0) " +
                  "AND (DataConsegna >= Date() OR Priorita LIKE '*URGENTE*') " +
                  "ORDER BY IIf(Priorita LIKE '*URGENTE*', 0, 1), DataConsegna ASC, OraConsegna ASC";
        
        var dati = queryAccessDB(sql);
        tbody.innerHTML = "";

        // Inizializzazione contatori per la barra DataViz
        var cUrg = 0;
        var cOggi = 0;
        var cPlan = 0;

        var todayMidnight = new Date();
        todayMidnight.setHours(0,0,0,0);

        if (dati.length === 0) {
            tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding:20px; color:#95a5a6;'>Nessuna consegna operativa in programma.</td></tr>";
            document.getElementById("cntUrg").innerText = "0";
            document.getElementById("cntOggi").innerText = "0";
            document.getElementById("cntPianif").innerText = "0";
            document.getElementById("barUrgente").style.width = "0%";
            document.getElementById("barOggi").style.width = "0%";
            document.getElementById("barPianificato").style.width = "0%";
            return;
        }

        for (var i = 0; i < dati.length; i++) {
            var r = dati[i];
            
            var isUrgent = (String(r.Priorita).toUpperCase().indexOf("URGENTE") > -1);
            var dt = parseAnyDate(r.DataConsegna);

            // Incrementa i contatori per tipologia
            if (isUrgent) {
                cUrg++;
            } else if (dt) {
                var recMidnight = new Date(dt.getTime());
                recMidnight.setHours(0,0,0,0);
                if (recMidnight.getTime() === todayMidnight.getTime()) {
                    cOggi++;
                } else {
                    cPlan++;
                }
            } else {
                cPlan++; // Fallback come pianificato
            }

            var tr = document.createElement("tr");
            tr.id = "row-consegna-" + r.ID; 
            
            if (isUrgent) tr.className = "row-urgent";

            var dataStr = "-";
            if (dt) {
                var gg = (dt.getDate() < 10 ? '0' : '') + dt.getDate();
                var mm = ((dt.getMonth() + 1) < 10 ? '0' : '') + (dt.getMonth() + 1);
                dataStr = gg + "/" + mm + "/" + dt.getFullYear();
            }

            var html = "";
            var telClean = (r.Telefono || "").replace(/'/g, "\\'");
            var nameClean = (r.ClienteNome || "").replace(/'/g, "\\'");
            var locClean = (r.LocalitaConsegna || "").replace(/'/g, "\\'");
            var indClean = (r.IndirizzoConsegna || "").replace(/'/g, "\\'");
            var merceClean = (r.Merce || "").replace(/'/g, "\\'");
            
            // Trinità delle Scorciatoie Rapide: Chiama, Copia Riepilogo e WhatsApp
            var quickActions = "";
            if (r.Telefono && r.Telefono !== "-" && r.Telefono !== "") {
                var callHtml = "<a href='#' class='quick-action-animate quick-action-phone' onclick='event.cancelBubble=true; if(event.stopPropagation) event.stopPropagation(); ChiamaCliente(\"" + telClean + "\"); return false;' style='margin-left:10px; text-decoration:none;' title='Chiama via Skype/PC'><img src='https://img.icons8.com/fluency/48/phone-office.png' style='width:18px; height:18px; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));'></a>";
                
                var copyHtml = "<a href='#' class='quick-action-animate quick-action-copy' onclick='event.cancelBubble=true; if(event.stopPropagation) event.stopPropagation(); CopiaRiepilogoConsegna(\"" + nameClean + "\", \"" + indClean + "\", \"" + locClean + "\", \"" + telClean + "\", \"" + merceClean + "\", \"" + dataStr + "\", \"" + (r.OraConsegna || "") + "\"); return false;' style='margin-left:6px; text-decoration:none;' title='Copia Riepilogo per WhatsApp'><img src='https://img.icons8.com/fluency/48/copy-link.png' style='width:18px; height:18px; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));'></a>";
                
                var waHtml = "<a href='#' class='quick-action-animate quick-action-wa' onclick='event.cancelBubble=true; if(event.stopPropagation) event.stopPropagation(); InviaWhatsApp(\"" + telClean + "\", \"" + nameClean + "\", \"" + (r.OraConsegna || "") + "\", \"" + locClean + "\", \"" + merceClean + "\"); return false;' style='margin-left:6px; text-decoration:none;' title='Invia Notifica Diretta WhatsApp'><img src='https://img.icons8.com/color/48/whatsapp.png' style='width:18px; height:18px;'></a>";
                
                quickActions = callHtml + copyHtml + waHtml;
            }
            
            // Link Google Maps "One-Tap"
            var mapsBtn = "";
            if (r.LocalitaConsegna) {
                var addressStr = (r.IndirizzoConsegna ? r.IndirizzoConsegna + ", " : "") + r.LocalitaConsegna;
                var cleanAddr = addressStr.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                mapsBtn = "<a href='#' class='quick-action-animate quick-action-maps' onclick='event.cancelBubble=true; if(event.stopPropagation) event.stopPropagation(); ApriMappaInApp(\"" + cleanAddr + "\"); return false;' style='margin-left:8px;' title='Vedi Mappa al Volo'><img src='https://img.icons8.com/color/48/google-maps-new.png' style='width:18px; height:18px; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));'></a>";
            }
            
            // Renderizzazione celle
            html += "<td style='white-space:nowrap; vertical-align:middle;'><div style='display:flex; align-items:center;'>" + (isUrgent ? "<span class='badge-urgent-table'><span class='led-pulse'></span>URGENTE</span>" : "") + "<b>" + (r.ClienteNome || "-").toUpperCase() + "</b>" + quickActions + "</div></td>";
            html += "<td style='font-weight:600; color:#005a9e;'>" + dataStr + "</td>";
            html += "<td>" + (r.OraConsegna || "--:--") + "</td>";
            html += "<td style='vertical-align:middle;'><div style='display:flex; align-items:center; justify-content:space-between;'>" + (r.LocalitaConsegna || "-").toUpperCase() + mapsBtn + "</div></td>";
            html += "<td>" + (r.NumeroOrdine || "-") + "</td>";
            var merceVal = r.Merce ? String(r.Merce).trim() : "";
            var noteVal = r.Note ? String(r.Note).trim() : "";
            
            if (merceVal === "-") merceVal = "";
            if (noteVal === "-") noteVal = "";
            
            var merceTitle = merceVal ? " title=\"" + merceVal.replace(/"/g, "&quot;") + "\"" : "";
            var noteTitle = noteVal ? " title=\"" + noteVal.replace(/"/g, "&quot;") + "\"" : "";

            html += "<td" + merceTitle + " style='font-size:11px; color:#475569; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>" + (merceVal || "<span style='color:#cbd5e1;'>·</span>") + "</td>";
            html += "<td" + noteTitle + " style='font-size:11px; color:#475569; font-style:italic; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>" + (noteVal || "<span style='color:#cbd5e1;'>·</span>") + "</td>";
            
            // Bottone di chiusura lampo
            html += "<td style='text-align:center; vertical-align:middle;'><button class='quick-action-animate quick-action-check' onclick='event.cancelBubble=true; if(event.stopPropagation) event.stopPropagation(); EseguiChiusuraLampo(" + r.ID + ", \"" + nameClean + "\"); return false;' style='outline:none;' title='Segna come CONSEGNATA (Salva e Rimuovi)'><img src='https://img.icons8.com/fluency/48/checkmark.png' style='width:22px; height:22px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));'></button></td>";
            
            tr.innerHTML = html;
            
            // Azione al click sulla riga
            tr.onclick = (function(idCorrente) {
                return function() {
                    LaunchModule("consegne.html?id=" + idCorrente);
                };
            })(r.ID);

            tbody.appendChild(tr);
        }

        // Aggiorna all'istante la legenda testuale e le dimensioni della barra
        document.getElementById("cntUrg").innerText = cUrg;
        document.getElementById("cntOggi").innerText = cOggi;
        document.getElementById("cntPianif").innerText = cPlan;

        var totalBreakdown = cUrg + cOggi + cPlan;
        var barUrg = document.getElementById("barUrgente");
        var barOgg = document.getElementById("barOggi");
        var barPla = document.getElementById("barPianificato");

        if (totalBreakdown > 0) {
            barUrg.style.width = (cUrg / totalBreakdown * 100) + "%";
            barOgg.style.width = (cOggi / totalBreakdown * 100) + "%";
            barPla.style.width = (cPlan / totalBreakdown * 100) + "%";
        } else {
            barUrg.style.width = "0%";
            barOgg.style.width = "0%";
            barPla.style.width = "0%";
        }

    } catch (e) {
        tbody.innerHTML = "<tr><td colspan='8' style='color:red; text-align:center;'>Errore caricamento: " + e.message + "</td></tr>";
    }
}
// ==========================================
// MONITOR NOTIFICHE DA MOBILE APP
// ==========================================
var lastNotifSize = -1;
var notifFilePath = "";

function InitNotificheMobile() {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        notifFilePath = fso.BuildPath(currentDir, "App_Mobile\\server\\NOTIFICHE_UFFICIO.txt");
        if (fso.FileExists(notifFilePath)) {
            lastNotifSize = fso.GetFile(notifFilePath).Size;
        } else {
            // Se il file non esiste ancora, lo creiamo vuoto
            if (!fso.FolderExists(fso.GetParentFolderName(notifFilePath))) {
                // Se manca la cartella server (improbabile), non facciamo nulla
                return;
            }
            fso.CreateTextFile(notifFilePath, true).Close();
            lastNotifSize = 0;
        }
        
        // Controlla ogni 5 secondi (piu' reattivo)
        setInterval(CheckNewNotifications, 5000);
    } catch(e) { }
}

function CheckNewNotifications() {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
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
                // Filtro: Solo notifiche da Mobile
                var isFromMobile = (content.indexOf("CONSEGNA COMPLETATA") > -1 || 
                                    content.indexOf("NOTIZIE DA STRADA") > -1 || 
                                    content.indexOf("MODIFICA") > -1 || 
                                    content.indexOf("Caricata") > -1);

                var isAutoRefresh = (content.indexOf("REFRESH AUTOMATICO") > -1);

                if (isFromMobile || isAutoRefresh) {
                    if (isFromMobile) {
                        PlayNotificationSound();
                        var shell = new ActiveXObject("WScript.Shell");
                        var msg = "🔔 NUOVA NOTIFICA DA APP MOBILE:\n\n" + content;
                        shell.Popup(msg, 0, "AGENDA - NOTIFICA MOBILE", 64);
                    }
                    
                    if (typeof AggiornaDashboardStats === "function") AggiornaDashboardStats();
                    if (typeof CaricaAgendaHome === "function") CaricaAgendaHome();
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

function KillOldMonitor() {
    try {
        var locator = new ActiveXObject("WbemScripting.SWbemLocator");
        var service = locator.ConnectServer(".", "root\\cimv2");
        var processes = service.ExecQuery("Select * from Win32_Process Where Name = 'wscript.exe'");
        var e = new Enumerator(processes);
        for (; !e.atEnd(); e.moveNext()) {
            var p = e.item();
            if (p.CommandLine && p.CommandLine.toLowerCase().indexOf("monitor_driver.vbs") > -1) {
                p.Terminate();
            }
        }
    } catch(e) { }
}

function ApriManuali() {
    try {
        var modalId = "modalSelezionaManuale";
        var existing = document.getElementById(modalId);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        var overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); z-index:999999; display:flex; justify-content:center; align-items:center;";

        var box = document.createElement("div");
        box.style.cssText = "background:#ffffff; border-radius:24px; width:650px; max-width:92%; padding:32px 28px; box-shadow:0 25px 60px rgba(0,0,0,0.6); border:2px solid #0284c7; position:relative; text-align:center;";

        box.innerHTML = 
            '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\'))" style="position:absolute; top:16px; right:20px; background:#f1f5f9; border:none; width:36px; height:36px; border-radius:50%; font-size:18px; font-weight:bold; cursor:pointer; color:#64748b;" onmouseover="this.style.background=\'#e2e8f0\'">✕</button>' +
            '<div style="margin-bottom:20px;">' +
                '<div style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, #0f172a, #1e293b); color:#f8fafc; border:1px solid #d4af37; padding:6px 18px; border-radius:20px; font-size:11.5px; font-weight:800; letter-spacing:0.5px; box-shadow:0 3px 10px rgba(0,0,0,0.25); margin-bottom:14px;">' +
                    '<span style="color:#d4af37; font-size:14px;">👑</span>' +
                    '<span>Amministratore del progetto Ciro Milella</span>' +
                '</div>' +
                '<div style="width:64px; height:64px; border-radius:50%; background:#e0f2fe; border:2px solid #38bdf8; display:flex; align-items:center; justify-content:center; margin:0 auto 10px auto;">' +
                    '<i class="fa fa-book" style="font-size:28px; color:#0284c7;"></i>' +
                '</div>' +
                '<h2 style="margin:0; color:#0f172a; font-size:22px; font-weight:800;">LIBRERIA MANUALI OPERATIVI</h2>' +
                '<p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Seleziona il manuale di consultazione desiderato</p>' +
            '</div>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; text-align:left;">' +
                '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\')); LaunchModule(\'Manuals/MANUALE_ALLINEAMENTO_E_USO.html\');" style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #0284c7; border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background=\'#e0f2fe\';">' +
                    '<div style="font-weight:800; color:#0369a1; font-size:13px;">📘 MANUALE GESTIONALE & USO</div>' +
                    '<div style="font-size:11.5px; color:#64748b; margin-top:4px;">Guida all’uso quotidiano delle funzioni</div>' +
                '</button>' +
                '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\')); LaunchModule(\'App_Mobile/guida_segreteria.html\');" style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #10b981; border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background=\'#d1fae5\';">' +
                    '<div style="font-weight:800; color:#047857; font-size:13px;">🏢 GUIDA SEGRETERIA UFFICIO</div>' +
                    '<div style="font-size:11.5px; color:#64748b; margin-top:4px;">Istruzioni per gli operatori di segreteria</div>' +
                '</button>' +
                '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\')); LaunchModule(\'App_Mobile/guida_utente.html\');" style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #f59e0b; border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background=\'#fef3c7\';">' +
                    '<div style="font-weight:800; color:#b45309; font-size:13px;">📱 GUIDA AUTISTA SMARTPHONE</div>' +
                    '<div style="font-size:11.5px; color:#64748b; margin-top:4px;">Manuale d’uso del ponte mobile autisti</div>' +
                '</button>' +
                '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\')); LaunchModule(\'App_Mobile/istruzioni_installazione.html\');" style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #8b5cf6; border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background=\'#ede9fe\';">' +
                    '<div style="font-weight:800; color:#6d28d9; font-size:13px;">⚙️ ISTRUZIONI INSTALLAZIONE</div>' +
                    '<div style="font-size:11.5px; color:#64748b; margin-top:4px;">Guida alla prima configurazione</div>' +
                '</button>' +
            '</div>';

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    } catch(e) {
        if (typeof LaunchModule === "function") {
            LaunchModule("Manuals/MANUALE_ALLINEAMENTO_E_USO.html");
        }
    }
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
    
    var msg = "Gentile Cliente " + nome.toUpperCase() + ", la informiamo che la consegna dei suoi articoli C. Milella è in programma per oggi alle ore " + (ora || "--:--") + " in " + localita.toUpperCase() + ". I nostri autisti sono in arrivo! A presto.";
    if (merce && merce !== "-" && merce.trim() !== "") {
        msg = "Gentile Cliente " + nome.toUpperCase() + ", la informiamo che la consegna dei suoi articoli (" + merce + ") C. Milella è in programma per oggi alle ore " + (ora || "--:--") + " in " + localita.toUpperCase() + ". A presto!";
    }
    
    var url = "https://wa.me/" + cleanTel + "?text=" + encodeURIComponent(msg);
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run(url);
    } catch(err) {
        window.open(url, "_blank");
    }
}

/**
 * FILTRA LIVE LA TABELLA AGENDA IN BASE AL TESTO INSERITO DALL'UTENTE (UX-1)
 */
function FiltraAgendaLive(txt) {
    try {
        var filter = String(txt || "").toUpperCase();
        var tbody = document.getElementById("tbodyAgendaHome");
        if (!tbody) return;
        var rows = tbody.getElementsByTagName("tr");
        
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            // Ignora righe che non contengono i dati della tabella (es: messaggi vuoti o header)
            if (row.cells.length < 6) continue; 
            
            var rowText = row.innerText || row.textContent || "";
            if (rowText.toUpperCase().indexOf(filter) > -1) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        }
    } catch(e) {}
}

/**
 * APRE L'ANTEPRIMA VOLANTE DELLE CONSEGNE IN ARRIVO (UX-10)
 */
function ApriAnteprimaInArrivo() {
    try {
        var overlay = document.getElementById("anteprimaOverlay");
        var corpo = document.getElementById("listaAnteprimaCorpo");
        if (!overlay || !corpo) return;
        
        overlay.style.display = "flex";
        corpo.innerHTML = "<div style='text-align:center; padding:30px; font-weight:600; color:#64748b; font-size:12px;'>Caricamento anteprima volante...</div>";
        
        // Query: Estrae consegne NON completate nei prossimi 7 giorni
        var sql = "SELECT ClienteNome, DataConsegna, OraConsegna, LocalitaConsegna, Priorita " +
                  "FROM tblConsegne " +
                  "WHERE DataConsegna >= Date() AND DataConsegna <= DateAdd('d', 7, Date()) " +
                  "AND (Consegnato = False OR Consegnato = 0) " +
                  "ORDER BY DataConsegna ASC, OraConsegna ASC";
        
        var dati = queryAccessDB(sql);
        
        if (!dati || dati.length === 0) {
            corpo.innerHTML = "<div style='text-align:center; padding:30px; font-weight:700; color:#94a3b8; font-size:12px;'>Nessuna consegna programmata per i prossimi 7 giorni.</div>";
            return;
        }
        
        var html = "";
        for (var i = 0; i < dati.length; i++) {
            var r = dati[i];
            
            // Formattazione data (GG/MM)
            var dt = parseAnyDate(r.DataConsegna);
            var dataStr = "-";
            if (dt) {
                var gg = (dt.getDate() < 10 ? '0' : '') + dt.getDate();
                var mm = ((dt.getMonth() + 1) < 10 ? '0' : '') + (dt.getMonth() + 1);
                dataStr = gg + "/" + mm;
            }
            
            var isUrg = String(r.Priorita || "").toUpperCase().indexOf("URGENTE") > -1;
            var borderC = isUrg ? "#e74c3c" : "#e2e8f0";
            var bgC = isUrg ? "#fff5f5" : "#ffffff";
            
            html += "<div style='background:" + bgC + "; border:1.5px solid " + borderC + "; border-radius:12px; padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.02);'>";
            html += "  <div style='text-align:left;'>";
            html += "    <div style='font-weight:800; font-size:13px; color:#0f172a; display:flex; align-items:center; gap:6px;'>" + 
                         (isUrg ? "<span style='background:#e74c3c; color:white; font-size:8px; padding:1px 4px; border-radius:4px; font-weight:900;'>URGENTE</span> " : "") +
                         (r.ClienteNome || "-").toUpperCase() + "</div>";
            html += "    <div style='font-size:11px; font-weight:700; color:#64748b; margin-top:3px;'>📍 " + (r.LocalitaConsegna || "-").toUpperCase() + "</div>";
            html += "  </div>";
            html += "  <div style='text-align:right; border-left:1px dashed #cbd5e1; padding-left:15px; min-width:80px;'>";
            html += "    <div style='font-size:12px; font-weight:900; color:#e67e22;'>" + dataStr + "</div>";
            html += "    <div style='font-size:10px; font-weight:700; color:#94a3b8; margin-top:2px;'>🕒 " + (r.OraConsegna || "--:--") + "</div>";
            html += "  </div>";
            html += "</div>";
        }
        corpo.innerHTML = html;
    } catch(e) {
        alert("Impossibile caricare l'anteprima rapida: " + e.message);
    }
}

/**
 * CHIUDE L'ANTEPRIMA VOLANTE (UX-10)
 */
function ChiudiAnteprimaInArrivo() {
    var overlay = document.getElementById("anteprimaOverlay");
    if (overlay) overlay.style.display = "none";
}

// ============================================================
// FASE 3: GESTIONE "MAPPA AL VOLO" INTEGRATA (IN-APP VIEWER)
// ============================================================
function ApriMappaInApp(indirizzo) {
    try {
        var overlay = document.getElementById("mappaOverlay");
        var lbl = document.getElementById("lblMappaIndirizzo");
        var iframe = document.getElementById("iframeMappa");
        var btnExt = document.getElementById("btnApriMappaEsterna");
        
        if (!overlay || !iframe) return;
        
        if (lbl) lbl.innerText = String(indirizzo || "").toUpperCase();
        
        // Usiamo il formato Google Maps embed sicuro per visualizzazione integrata
        var query = encodeURIComponent(indirizzo);
        var embedUrl = "https://maps.google.com/maps?q=" + query + "&t=&z=15&ie=UTF8&iwloc=&output=embed";
        var extUrl = "https://www.google.com/maps/search/?api=1&query=" + query;
        
        iframe.src = embedUrl;
        overlay.style.display = "flex";
        
        if (btnExt) {
            btnExt.onclick = function() {
                ApriLinkEsterno(extUrl);
            };
        }
    } catch(e) {
        alert("Errore Apertura Mappa: " + e.message);
    }
}

function ChiudiMappaInApp() {
    try {
        var overlay = document.getElementById("mappaOverlay");
        var iframe = document.getElementById("iframeMappa");
        if (overlay) overlay.style.display = "none";
        if (iframe) iframe.src = "about:blank"; // Rilascia le risorse ed arresta processi in background
    } catch(e) {}
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
// FASE 2: GESTIONE FLYOUT NOTIFICATION DRAWER (UX MODERNIZATION)
// ============================================================
function ToggleNotifDrawer(isOpen) {
    try {
        var overlay = document.getElementById("notifDrawerOverlay");
        var panel = document.getElementById("notifDrawer");
        if (!overlay || !panel) return;

        if (isOpen) {
            // Carica i dati freschi prima di mostrare
            CaricaNotificheDrawer();
            
            overlay.style.display = "block";
            setTimeout(function() {
                overlay.className = "drawer-overlay open";
                panel.className = "drawer-panel open";
            }, 10);
        } else {
            overlay.className = "drawer-overlay";
            panel.className = "drawer-panel";
            setTimeout(function() {
                overlay.style.display = "none";
            }, 300);
        }
    } catch(e) {
        alert("Errore Drawer: " + e.message);
    }
}

function CaricaNotificheDrawer() {
    var content = document.getElementById("drawerContent");
    if (!content) return;
    
    content.innerHTML = "<div style='text-align:center; padding:40px; color:#64748b; font-weight:600;'><img src='https://img.icons8.com/material-outlined/48/spinner-frame.png' class='spinner' style='width:32px; animation:fa-spin 2s infinite linear; opacity:0.6; margin-bottom:15px;'><br>Sincronizzazione notifiche...</div>";
    
    try {
        var html = "";
        var count = 0;
        
        // 1. NOTIFICHE URGENTI OGGI (Da Database)
        try {
            var sql = "SELECT ClienteNome, OraConsegna, LocalitaConsegna " +
                      "FROM tblConsegne " +
                      "WHERE DataConsegna >= Date() AND DataConsegna < DateAdd('d', 1, Date()) " +
                      "AND (KmAndata IS NULL AND (Consegnato = False OR Consegnato = 0)) " +
                      "AND (Priorita LIKE '%URGENTE%' OR Note LIKE '%URGENTE%' OR Priorita LIKE '%TASSATIVO%' OR Note LIKE '%TASSATIVO%')";
            var dataUrg = queryAccessDB(sql) || [];
            
            for (var i = 0; i < dataUrg.length; i++) {
                var item = dataUrg[i];
                count++;
                html += "<div class='notif-card urgent' onclick='ToggleNotifDrawer(false); LaunchModule(\"consegne.html\")'>";
                html += "  <div class='notif-card-icon'><img src='https://img.icons8.com/color/48/high-priority.png' style='width:22px; height:22px;'></div>";
                html += "  <div class='notif-card-body'>";
                html += "    <div class='notif-card-title'>URGENZA CONSEGNA OGGI</div>";
                html += "    <div class='notif-card-desc'><b>" + (item.ClienteNome || "").toUpperCase() + "</b> richiede attenzione a <i>" + (item.LocalitaConsegna || "").toUpperCase() + "</i>.</div>";
                html += "    <div class='notif-card-time'>Pianificato: " + (item.OraConsegna || "--:--") + "</div>";
                html += "  </div>";
                html += "</div>";
            }
        } catch(e1) {}

        // 2. NOTIFICHE VEICOLI (Scadenze e Tagliandi)
        try {
            var sqlV = "SELECT Targa, Modello, ScadenzaAssicurazione, ScadenzaBollo, ScadenzaRevisione, KmAttuali, SogliaTagliando FROM tblVeicoli";
            var vehicles = queryAccessDB(sqlV) || [];
            var today = new Date();
            today.setHours(0,0,0,0);
            
            for (var j = 0; j < vehicles.length; j++) {
                var veh = vehicles[j];
                var nameV = (veh.Modello || "Veicolo").toUpperCase();
                
                // Controlla scadenze entro 15gg
                var dateFields = [
                    { d: veh.ScadenzaAssicurazione, l: "Assicurazione" },
                    { d: veh.ScadenzaBollo, l: "Bollo Auto" },
                    { d: veh.ScadenzaRevisione, l: "Revisione Periodica" }
                ];
                
                for (var k = 0; k < dateFields.length; k++) {
                    var fld = dateFields[k];
                    if (fld.d && fld.d !== "") {
                        var p = fld.d.split("-");
                        var exp = new Date(p[0], p[1]-1, p[2]);
                        exp.setHours(0,0,0,0);
                        var diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                        if (diff <= 15) {
                            count++;
                            var isRed = diff <= 3;
                            var cardC = isRed ? "urgent" : "warning";
                            var iconC = isRed ? "https://img.icons8.com/color/48/brake-warning.png" : "https://img.icons8.com/color/48/car.png";
                            
                            html += "<div class='notif-card " + cardC + "' onclick='ToggleNotifDrawer(false); LaunchModule(\"auto.html\")'>";
                            html += "  <div class='notif-card-icon'><img src='" + iconC + "' style='width:22px; height:22px;'></div>";
                            html += "  <div class='notif-card-body'>";
                            html += "    <div class='notif-card-title'>" + fld.l.toUpperCase() + "</div>";
                            html += "    <div class='notif-card-desc'>La scadenza del mezzo <b>" + nameV + "</b> (" + (veh.Targa || "").toUpperCase() + ") scade tra " + diff + " giorni.</div>";
                            html += "    <div class='notif-card-time'>" + (isRed ? "IMMINENTE" : "PROMEMORIA") + " - " + diff + " GG RIMANENTI</div>";
                            html += "  </div>";
                            html += "</div>";
                        }
                    }
                }
                
                // Tagliando
                if (veh.KmAttuali && veh.SogliaTagliando) {
                    var rem = Number(veh.SogliaTagliando) - Number(veh.KmAttuali);
                    if (rem <= 1000 && rem >= -500) {
                        count++;
                        var isCrit = rem <= 0;
                        html += "<div class='notif-card warning' onclick='ToggleNotifDrawer(false); LaunchModule(\"auto.html\")'>";
                        html += "  <div class='notif-card-icon'><img src='https://img.icons8.com/color/48/administrative-tools.png' style='width:22px; height:22px;'></div>";
                        html += "  <div class='notif-card-body'>";
                        html += "    <div class='notif-card-title'>MANUTENZIONE RICHIESTA</div>";
                        html += "    <div class='notif-card-desc'>Raggiunta la soglia tagliando per <b>" + nameV + "</b>. Km residui: " + rem + " Km.</div>";
                        html += "    <div class='notif-card-time'>" + (isCrit ? "SOGLIA SUPERATA!" : "PREPARARE TAGLIANDO") + "</div>";
                        html += "  </div>";
                        html += "</div>";
                    }
                }
            }
        } catch(e2) {}

        // 3. NOTIFICHE DA APP MOBILE (Dal File di Testo)
        try {
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            if (fso.FileExists(notifFilePath)) {
                var f = fso.OpenTextFile(notifFilePath, 1);
                var lines = [];
                while(!f.AtEndOfStream) {
                    var lStr = f.ReadLine().trim();
                    if (lStr !== "") lines.push(lStr);
                }
                f.Close();
                
                // Mostriamo solo le ultime 8 in ordine inverso
                lines.reverse();
                var showMax = Math.min(lines.length, 8);
                for (var m = 0; m < showMax; m++) {
                    var rawL = lines[m];
                    
                    // Salta le righe di refresh automatico tecniche
                    if (rawL.indexOf("REFRESH AUTOMATICO") > -1) continue;
                    
                    count++;
                    
                    var nTitle = "ATTIVITÀ MOBILE";
                    var nClass = "info";
                    var nIcon = "https://img.icons8.com/color/48/phone.png";
                    
                    if (rawL.indexOf("CONSEGNA COMPLETATA") > -1) {
                        nTitle = "CONSEGNA EFFETTUATA";
                        nClass = "success";
                        nIcon = "https://img.icons8.com/color/48/ok--v1.png";
                    } else if (rawL.indexOf("MODIFICA") > -1) {
                        nTitle = "MODIFICA DATI";
                        nClass = "warning";
                        nIcon = "https://img.icons8.com/color/48/edit--v1.png";
                    } else if (rawL.indexOf("NOTIZIE DA STRADA") > -1) {
                        nTitle = "NOTE DA STRADA";
                        nClass = "info";
                        nIcon = "https://img.icons8.com/color/48/chat.png";
                    }
                    
                    // Estrai eventuale data se presente [GG/MM/AAAA HH:MM:SS]
                    var timestamp = "RICEVUTA DA DISPOSITIVO";
                    var cleanedMsg = rawL;
                    var matchTS = rawL.match(/\[(.*?)\]/);
                    if (matchTS && matchTS.length > 1) {
                        timestamp = matchTS[1];
                        cleanedMsg = rawL.replace(/\[.*?\]\s*/, "");
                    }
                    
                    html += "<div class='notif-card " + nClass + "' onclick='ToggleNotifDrawer(false); CaricaAgendaHome();'>";
                    html += "  <div class='notif-card-icon'><img src='" + nIcon + "' style='width:22px; height:22px;'></div>";
                    html += "  <div class='notif-card-body'>";
                    html += "    <div class='notif-card-title'>" + nTitle + "</div>";
                    html += "    <div class='notif-card-desc'>" + cleanedMsg + "</div>";
                    html += "    <div class='notif-card-time'>Mobile - " + timestamp + "</div>";
                    html += "  </div>";
                    html += "</div>";
                }
            }
        } catch(e3) {}
        
        // 4. DEFAULT BACKUP PROMEMORIA (Se nient'altro c'è, o come ultima voce)
        count++;
        html += "<div class='notif-card info' onclick='ToggleNotifDrawer(false); EseguiBackup(false);'>";
        html += "  <div class='notif-card-icon'><img src='https://img.icons8.com/color/48/data-backup.png' style='width:22px; height:22px;'></div>";
        html += "  <div class='notif-card-body'>";
        html += "    <div class='notif-card-title'>BACKUP SISTEMA</div>";
        html += "    <div class='notif-card-desc'>È consigliato eseguire periodicamente un backup di sicurezza sul server o su chiavetta USB.</div>";
        html += "    <div class='notif-card-time'>Azione Consigliata</div>";
        html += "  </div>";
        html += "</div>";
        
        content.innerHTML = html;
        
    } catch(errGlobal) {
        content.innerHTML = "<div style='padding:20px; color:#ef4444; font-weight:700;'>Errore renderizzazione notifiche:<br>" + errGlobal.message + "</div>";
    }
}

// ==========================================
// GUIDA INTERATTIVA ALLE NOVITÀ (UX UPGRADE)
// ==========================================
function ApriGuidaNovita() {
    try {
        var overlay = document.getElementById("guidaNovitaOverlay");
        if (overlay) {
            overlay.style.display = "flex";
            // Inizializza sul primo tab
            var primoTab = document.getElementById("tabGuidaBtn0");
            CambiaTabGuida(0, primoTab);
        }
    } catch(e) {}
}

function ChiudiGuidaNovita() {
    try {
        var overlay = document.getElementById("guidaNovitaOverlay");
        if (overlay) overlay.style.display = "none";
    } catch(e) {}
}

function CambiaTabGuida(tabIndex, btnEl) {
    try {
        // 1. Gestisci lo stato dei pulsanti sidebar
        var btns = [document.getElementById("tabGuidaBtn0"), document.getElementById("tabGuidaBtn1"), document.getElementById("tabGuidaBtn2"), document.getElementById("tabGuidaBtn3")];
        for(var i = 0; i < btns.length; i++) {
            if (btns[i]) btns[i].className = "tab-guida-btn";
        }
        if (btnEl) btnEl.className = "tab-guida-btn active";
        
        // 2. Inietta il contenuto dinamicamente
        var contentDiv = document.getElementById("contenutoGuida");
        if (!contentDiv) return;
        
        var html = "";
        
        if (tabIndex === 0) {
            // TAB 0: KPI & Widget
            html += "<div style='margin-bottom:25px;'><h3 style='font-size:18px; font-weight:800; color:#0f172a; margin-bottom:6px;'>📊 Widget & KPI Interattivi</h3><p style='font-size:12px; color:#64748b;'>Una panoramica completa sullo stato dell'azienda e dei veicoli aggiornata in tempo reale.</p></div>";
            
            html += "<div class='guida-card'>";
            html += "  <div class='guida-card-icon'>📊</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Progresso Giornaliero <span class='guida-badge-new'>LIVE</span></div>";
            html += "    <div class='guida-card-desc'>La barra verde si riempie dinamicamente. Quando raggiungi il 100%, la scheda si illumina celebrando il completamento di tutte le consegne!</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.1s;'>";
            html += "  <div class='guida-card-icon'>🚗</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Stato Veicolo Intelligente</div>";
            html += "    <div class='guida-card-desc'>Il cruscotto ricalcola automaticamente i chilometri percorsi dalle consegne odierne e la lancetta fisica simula il consumo dell'olio, predicendo automaticamente la data stimata del tagliando.</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.2s;'>";
            html += "  <div class='guida-card-icon'>🕒</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Widget Ore Presenze</div>";
            html += "    <div class='guida-card-desc'>Colore viola per tenere sott'occhio le tue ore totali del mese rispetto alle 160 ore di target. Se scordi di registrare un'uscita dei giorni scorsi, appare un'icona di avviso ⚠️.</div>";
            html += "  </div>";
            html += "</div>";
            
        } else if (tabIndex === 1) {
            // TAB 1: Agenda Operativa
            html += "<div style='margin-bottom:25px;'><h3 style='font-size:18px; font-weight:800; color:#0f172a; margin-bottom:6px;'>📅 L'Agenda delle Consegne</h3><p style='font-size:12px; color:#64748b;'>La tavola operativa con integrazioni ultra-veloci e controlli salva-tempo.</p></div>";
            
            html += "<div class='guida-card'>";
            html += "  <div class='guida-card-icon'>✍️</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Note Intelligenti <span class='guida-badge-new'>NOVITÀ</span></div>";
            html += "    <div class='guida-card-desc'>Le note ora appaiono direttamente in tabella! Il testo si accorcia elegantemente con i tre puntini `...` se è troppo lungo. Basta passarci sopra il mouse per visualizzarle interamente nel tooltip fluttuante. I campi vuoti sono sostituiti da un pulitissimo puntino `·`.</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.1s;'>";
            html += "  <div class='guida-card-icon'>💬</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>WhatsApp One-Tap</div>";
            html += "    <div class='guida-card-desc'>Accanto ai clienti con numero di cellulare compare l'icona di WhatsApp. Cliccala per generare all'istante un messaggio precompilato e personalizzato con ora, merce e indirizzo da inviare al cliente!</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.2s;'>";
            html += "  <div class='guida-card-icon'>🗺️</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Mappa al Volo (In-App)</div>";
            html += "    <div class='guida-card-desc'>Clicca sull'iconcina del GPS 📍 vicino alla località. Si aprirà una mappa interattiva direttamente dentro questa applicazione per farti vedere dove si trova la destinazione!</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.3s;'>";
            html += "  <div class='guida-card-icon'>🚨</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Spia LED Urgenze</div>";
            html += "    <div class='guida-card-desc'>Le righe delle consegne URGENTI emettono una respirazione di luce rossa e mostrano un distintivo premium con un LED bianco che pulsa realmente per non fartela sfuggire.</div>";
            html += "  </div>";
            html += "</div>";
            
        } else if (tabIndex === 2) {
            // TAB 2: Scorciatoie
            html += "<div style='margin-bottom:25px;'><h3 style='font-size:18px; font-weight:800; color:#0f172a; margin-bottom:6px;'>⚡ Trucchi Veloci d'Efficienza</h3><p style='font-size:12px; color:#64748b;'>Scorciatoie intelligenti che fanno risparmiare decine di clic quotidiani.</p></div>";
            
            html += "<div class='guida-card'>";
            html += "  <div class='guida-card-icon'>✔️</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Chiusura Lampo</div>";
            html += "    <div class='guida-card-desc'>Invece di aprire la scheda e inserire i chilometri, clicca sul bottone di spunta verde in fondo alla riga per segnare immediatamente la consegna come COMPLETATA! La riga eseguirà una fantastica animazione di uscita e scivolamento verso destra.</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.1s;'>";
            html += "  <div class='guida-card-icon'>🔍</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Ricerca Live Istantanea</div>";
            html += "    <div class='guida-card-desc'>Digita nel campo 'Cerca al volo...'. La tabella si riduce istantaneamente filtrando ogni singola lettera, evidenziando solo le righe desiderate, combinando anche i filtri per URGENTI.</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.2s;'>";
            html += "  <div class='guida-card-icon'>🖨️</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Stampa Data Professionale</div>";
            html += "    <div class='guida-card-desc'>Accedi al calendario dal bottone 'Stampa Data'. Seleziona un giorno e il programma genererà all'istante un PDF impaginato professionalmente da stampare e dare all'autista.</div>";
            html += "  </div>";
            html += "</div>";
        } else {
            // TAB 3: Backup & Sicurezza
            html += "<div style='margin-bottom:25px;'><h3 style='font-size:18px; font-weight:800; color:#0f172a; margin-bottom:6px;'>📁 Gestione dei Backup e Sicurezza</h3><p style='font-size:12px; color:#64748b;'>Guida rapida all'utilizzo del sistema automatico di salvataggio e ripristino dati.</p></div>";
            
            html += "<div class='guida-card'>";
            html += "  <div class='guida-card-icon'>💾</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Creazione Backup Istantaneo</div>";
            html += "    <div class='guida-card-desc'>Il programma salva automaticamente una copia dei dati ad ogni chiusura. Se vuoi fare un salvataggio manuale immediato, clicca su <b>Gestione Backup</b> e poi sul pulsante verde <b>CREA ORA</b>.</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.1s;'>";
            html += "  <div class='guida-card-icon'>⚡</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Ripristino Rapido in 1 Clic</div>";
            html += "    <div class='guida-card-desc'>In caso di errori, clicca su <b>Gestione Backup</b>, seleziona la data del salvataggio desiderato dal menù a tendina e premi <b>RIPRISTINA</b>. Il programma fa tutto da solo e si riavvia coi nuovi dati.</div>";
            html += "  </div>";
            html += "</div>";
            
            html += "<div class='guida-card' style='animation-delay: 0.2s;'>";
            html += "  <div class='guida-card-icon'>🛡️</div>";
            html += "  <div class='guida-card-body'>";
            html += "    <div class='guida-card-title'>Sicurezza Failsafe Integrata</div>";
            html += "    <div class='guida-card-desc'>Non temere di sbagliare backup: prima di sovrascrivere, il sistema crea comunque una copia d'emergenza del database attivo (chiamata ConsegneDB_EMERGENCY_[timestamp]) per poterti far tornare indietro!</div>";
            html += "  </div>";
            html += "</div>";
        }
        
        contentDiv.innerHTML = html;
        
    } catch(e) {
        alert("Errore Tab Guida: " + e.message);
    }
}

// ============================================================
// SCORCIATOIE DI PRODUTTIVITÀ VELOCE (ZENITH SLATE)
// ============================================================

window.ChiamaCliente = function(tel) {
    if (!tel || tel === "Nessun Recapito" || tel.trim() === "" || tel === "-") {
        alert("Nessun numero di telefono disponibile per questo cliente.");
        return;
    }
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

window.CopiaRiepilogoConsegna = function(nome, ind, loc, tel, merce, data, ora) {
    try {
        var strData = (data || "").trim();
        var strOra = (ora || "").trim();
        if (strOra && strOra.toLowerCase() !== "null" && strOra.indexOf("--:--") === -1) {
            strData += " (" + strOra + ")";
        }
        
        var testo = "📋 *RIEPILOGO CONSEGNA C. MILELLA*\n" +
                    "-----------------------------------------\n" +
                    "👤 *Destinatario*: " + String(nome || "-").toUpperCase() + "\n" +
                    "📍 *Indirizzo*: " + (ind || "-") + " - " + (loc || "-") + "\n" +
                    "📞 *Contatto*: " + (tel || "Nessun Recapito") + "\n" +
                    "📦 *Articoli*: " + (merce || "-") + "\n" +
                    "📅 *Consegna*: " + strData + "\n" +
                    "-----------------------------------------\n" +
                    "🚀 *Copiato dalla Dashboard Principale*";
                    
        var clip = new ActiveXObject("htmlfile").parentWindow.clipboardData;
        clip.setData("Text", testo);
        
        // Feedback Toast animato Premium
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

window.CalcolaPercorsoMappaOdierno = function() {
    try {
        var dbObj = ConnectToDatabase();
        var conn = null, dbAccess = null;
        if (dbObj) {
            if (dbObj.type === "ADO") conn = dbObj.handle;
            else dbAccess = dbObj.handle;
        } else return;
        
        var qOggi = "SELECT Indirizzo, Citta FROM tblConsegne WHERE DataConsegna >= Date() AND DataConsegna < DateAdd('d', 1, Date()) AND Indirizzo IS NOT NULL";
        var indirizzi = [];
        if (conn) {
            var rs = conn.Execute(qOggi);
            while(!rs.EOF) {
                if(rs.Fields("Indirizzo").Value) {
                    var ind = rs.Fields("Indirizzo").Value + (rs.Fields("Citta").Value ? ", " + rs.Fields("Citta").Value : "");
                    indirizzi.push(encodeURIComponent(ind.replace(/\\s+/g, " ")));
                }
                rs.MoveNext();
            }
            rs.Close();
            conn.Close();
        } else if (dbAccess) {
            var rows = queryAccessDB(qOggi);
            if(rows) {
                for(var i=0; i<rows.length; i++){
                    var r = rows[i];
                    if(r.Indirizzo) {
                        var ind = r.Indirizzo + (r.Citta ? ", " + r.Citta : "");
                        indirizzi.push(encodeURIComponent(ind.replace(/\\s+/g, " ")));
                    }
                }
            }
        }
        
        if (indirizzi.length === 0) {
            if(typeof UXPremium !== "undefined" && UXPremium.ShowToast) UXPremium.ShowToast("Nessun indirizzo valido trovato oggi.", "warning");
            return;
        }
        
        // Limita i waypoint per Google Maps
        var waypoints = indirizzi.slice(0, 10).join("/");
        var url = "https://www.google.com/maps/dir/" + waypoints;
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run(url, 1, false);
        
        if(typeof UXPremium !== "undefined" && UXPremium.ShowToast) UXPremium.ShowToast("Mappa percorso aperta!", "success");
        
    } catch(e) {
        if(typeof UXPremium !== "undefined" && UXPremium.ShowToast) UXPremium.ShowToast("Errore mappa: " + e.message, "error");
    }
};

// --- LOGICA ASSISTENTE VOCALE (Porting per Dashboard HTA) ---
var voiceEnabled = true;
var voiceObj = null;
var useWebSpeech = false;

try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
        useWebSpeech = true;
    } else {
        voiceObj = new ActiveXObject("SAPI.SpVoice");
    }
} catch(e) {
    if (!useWebSpeech) voiceEnabled = false;
}

function ToggleVoiceAudio() {
    voiceEnabled = !voiceEnabled;
    try {
        if (!voiceEnabled) {
            if (useWebSpeech) {
                window.speechSynthesis.cancel();
            } else if (voiceObj) {
                voiceObj.Speak("", 2); // Interrompe il parlato
            }
        }
    } catch(e) {}
    
    var statusText = document.getElementById("aiAssistantStatus");
    if (statusText) {
        statusText.innerText = voiceEnabled ? "PRONTO (Clicca per Avviare)" : "SINTESI DISATTIVATA";
    }
}

var isSpeakingAssistant = false;
var assistantAnimationInterval = null;

function StopAssistente() {
    isSpeakingAssistant = false;
    if (assistantAnimationInterval) {
        clearInterval(assistantAnimationInterval);
        assistantAnimationInterval = null;
    }
    var widget = document.getElementById("aiAssistantWidget");
    if (widget) {
        widget.className = widget.className.replace(/\bvoice-speaking\b/g, "").trim();
    }
    var statusText = document.getElementById("aiAssistantStatus");
    if (statusText) statusText.innerText = voiceEnabled ? "PRONTO (Clicca per Avviare)" : "SINTESI DISATTIVATA";
    try {
        if (useWebSpeech) {
            window.speechSynthesis.cancel();
        } else if (voiceObj) {
            voiceObj.Speak("", 2);
        }
    } catch(e) {}
}

function ParlaAssistente() {
    if (!voiceEnabled) return;
    if (isSpeakingAssistant) {
        StopAssistente();
        return;
    }
    
    var widget = document.getElementById("aiAssistantWidget");
    var statusText = document.getElementById("aiAssistantStatus");
    if (!widget) return;

    isSpeakingAssistant = true;
    widget.className += " voice-speaking";
    if (statusText) statusText.innerText = "IN ASCOLTO...";

    var now = new Date();
    var hh = now.getHours();
    var mm = now.getMinutes();

    // Tenta di leggere un elemento per i numeri
    var report = "Cruscotto di Riepilogo. Sono le ore " + hh + " e " + mm + ". ";
    var comp = document.getElementById("lblStat1") ? document.getElementById("lblStat1").innerText : "sconosciuto";
    if(comp !== "sconosciuto") {
        var parts = comp.split("/");
        if(parts.length === 2) report += "Oggi abbiamo completato " + parts[0].trim() + " consegne su " + parts[1].trim() + ". ";
    }
    var urg = document.getElementById("lblStat2") ? document.getElementById("lblStat2").innerText : "0";
    if(urg !== "0") {
        report += "Ci sono " + urg + " consegne urgenti. ";
    }
    var arr = document.getElementById("lblStat3") ? document.getElementById("lblStat3").innerText : "0";
    if(arr !== "0") {
        report += "E abbiamo " + arr + " consegne programmate nei prossimi 7 giorni. ";
    }
    report += "Tutte le procedure del cruscotto sono operative.";
    
    try {
        if (useWebSpeech) {
            var utterance = new SpeechSynthesisUtterance(report);
            utterance.rate = 1.1; // Leggermente più veloce per sembrare più smart
            utterance.pitch = 1.2; // Tono leggermente più alto per emulare Siri (femminile)
            
            // Trova una voce italiana (preferibilmente femminile)
            var voices = window.speechSynthesis.getVoices();
            var itVoices = voices.filter(function(v) { return v.lang.indexOf("it") > -1; });
            var femaleVoice = null;
            // Euristiche basate sui nomi delle voci (Google italiano, Elsa, etc.)
            for (var i = 0; i < itVoices.length; i++) {
                var vName = itVoices[i].name.toLowerCase();
                if (vName.indexOf("female") > -1 || vName.indexOf("elsa") > -1 || vName.indexOf("siri") > -1) {
                    femaleVoice = itVoices[i];
                    break;
                }
            }
            if (femaleVoice) {
                utterance.voice = femaleVoice;
            } else if (itVoices.length > 0) {
                utterance.voice = itVoices[0]; // Fallback alla prima italiana
            }

            utterance.onend = function() {
                StopAssistente();
            };
            utterance.onerror = function() {
                StopAssistente();
            };
            
            window.speechSynthesis.speak(utterance);
        } else {
            if (!voiceObj) {
                voiceObj = new ActiveXObject("SAPI.SpVoice");
            }
            voiceObj.Volume = 100;
            voiceObj.Rate = 0;
            voiceObj.Speak(report, 3); // 3 = SVSFlagsAsync
            
            var checkTimer = 0;
            assistantAnimationInterval = setInterval(function() {
                checkTimer += 200;
                var ancoraParla = false;
                try {
                    if (voiceObj && voiceObj.Status) {
                        if (voiceObj.Status.RunningState === 2) {
                            ancoraParla = true;
                        }
                    }
                } catch(ex) {}

                if (!ancoraParla || checkTimer > 30000) {
                    StopAssistente();
                }
            }, 200);
        }
    } catch(e) {
        voiceEnabled = false;
        StopAssistente();
    }
}


// --- AUTOMATED BACKUP MANAGER MODAL FOR ELECTRON ---
window.ApriGestoreBackup = function() {
    var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) || (typeof require === "function");
    if (!isElectron) {
        alert("La gestione backup avanzata è disponibile solo in modalità Electron.");
        return;
    }
    
    try {
        var fsNode = require('fs');
        var pathNode = require('path');
        
        var pathname = window.location.pathname;
        if (pathname.charAt(0) === "/") pathname = pathname.substring(1);
        var currentFolder = pathNode.dirname(decodeURIComponent(pathname));
        
        var rootDir = currentFolder;
        if (rootDir.toLowerCase().indexOf("file_sistema") > -1) {
            var fsIndex = rootDir.toLowerCase().indexOf("file_sistema");
            rootDir = rootDir.substring(0, fsIndex);
        }
        
        var fsFolder = "";
        var fsIndex = currentFolder.toLowerCase().indexOf("file_sistema");
        if (fsIndex > -1) {
            fsFolder = currentFolder.substring(0, fsIndex + "file_sistema".length);
        } else {
            fsFolder = pathNode.join(currentFolder, "File_Sistema");
        }
        var dbPath = pathNode.join(fsFolder, "ConsegneDB_Legacy.sqlite");
        var backupDir = pathNode.join(fsFolder, "backups");
        
        if (!fsNode.existsSync(backupDir)) {
            fsNode.mkdirSync(backupDir, { recursive: true });
        }
        
        var files = fsNode.readdirSync(backupDir);
        var backupFiles = [];
        for (var idx = 0; idx < files.length; idx++) {
            var f = files[idx];
            if (f.toLowerCase().indexOf("consegnedb_") === 0 && f.endsWith(".sqlite")) {
                var filePath = pathNode.join(backupDir, f);
                var stats = fsNode.statSync(filePath);
                backupFiles.push({
                    name: f,
                    path: filePath,
                    mtime: stats.mtime
                });
            }
        }
        
        backupFiles.sort(function(a, b) {
            return b.mtime - a.mtime;
        });
        
        var modalId = "gold-backup-manager-modal";
        var existing = document.getElementById(modalId);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        
        var overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(10, 15, 30, 0.85)";
        overlay.style.backdropFilter = "blur(14px)";
        overlay.style.webkitBackdropFilter = "blur(14px)";
        overlay.style.zIndex = "999999";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.fontFamily = "'Outfit', 'Inter', -apple-system, sans-serif";
        
        var box = document.createElement("div");
        box.style.background = "linear-gradient(145deg, #1e293b, #0f172a)";
        box.style.border = "1.5px solid rgba(212, 175, 55, 0.4)";
        box.style.borderRadius = "24px";
        box.style.padding = "30px";
        box.style.width = "520px";
        box.style.maxWidth = "90vw";
        box.style.boxShadow = "0 25px 60px rgba(0, 0, 0, 0.75), 0 0 50px rgba(212, 175, 55, 0.15)";
        box.style.color = "#ffffff";
        box.style.textAlign = "center";
        
        var title = document.createElement("h2");
        title.style.margin = "0 0 10px 0";
        title.style.color = "#ffe066";
        title.style.fontSize = "20px";
        title.style.fontWeight = "800";
        title.style.letterSpacing = "1px";
        title.innerHTML = "📁 CENTRO GESTIONE BACKUP";
        box.appendChild(title);
        
        var descr = document.createElement("p");
        descr.style.fontSize = "12.5px";
        descr.style.color = "#94a3b8";
        descr.style.margin = "0 0 20px 0";
        descr.style.lineHeight = "1.4";
        descr.innerHTML = "Seleziona uno dei salvataggi automatici per ripristinare i dati del programma ad uno stato precedente.";
        box.appendChild(descr);
        
        var select = document.createElement("select");
        select.style.width = "100%";
        select.style.padding = "12px";
        select.style.background = "rgba(15, 23, 42, 0.8)";
        select.style.border = "1px solid rgba(212, 175, 55, 0.3)";
        select.style.borderRadius = "10px";
        select.style.color = "#ffffff";
        select.style.fontSize = "13px";
        select.style.fontWeight = "600";
        select.style.outline = "none";
        select.style.marginBottom = "20px";
        
        if (backupFiles.length === 0) {
            var opt = document.createElement("option");
            opt.value = "";
            opt.text = "Nessun backup automatico trovato";
            select.appendChild(opt);
            select.disabled = true;
        } else {
            for (var i = 0; i < backupFiles.length; i++) {
                var bf = backupFiles[i];
                var opt = document.createElement("option");
                opt.value = bf.path;
                
                var d = bf.mtime;
                var dateStr = d.getDate().toString().padStart(2, '0') + "/" + 
                              (d.getMonth() + 1).toString().padStart(2, '0') + "/" + 
                              d.getFullYear() + " ore " + 
                              d.getHours().toString().padStart(2, '0') + ":" + 
                              d.getMinutes().toString().padStart(2, '0');
                              
                opt.text = "Salvataggio del " + dateStr + " (" + bf.name + ")";
                select.appendChild(opt);
            }
        }
        box.appendChild(select);
        
        var btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.gap = "15px";
        btnContainer.style.justifyContent = "center";
        btnContainer.style.marginTop = "20px";
        
        var btnRestore = document.createElement("button");
        btnRestore.style.background = "linear-gradient(135deg, #d4af37, #aa8410)";
        btnRestore.style.color = "#000000";
        btnRestore.style.border = "none";
        btnRestore.style.borderRadius = "12px";
        btnRestore.style.padding = "12px 22px";
        btnRestore.style.fontWeight = "800";
        btnRestore.style.fontSize = "11.5px";
        btnRestore.style.textTransform = "uppercase";
        btnRestore.style.cursor = "pointer";
        btnRestore.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.3)";
        btnRestore.style.transition = "all 0.2s";
        btnRestore.innerHTML = "⚡ RIPRISTINA";
        if (backupFiles.length === 0) btnRestore.disabled = true;
        
        btnRestore.onmouseover = function() { if(!this.disabled) { this.style.transform = "translateY(-1px)"; this.style.boxShadow = "0 6px 20px rgba(212, 175, 55, 0.45)"; } };
        btnRestore.onmouseout = function() { if(!this.disabled) { this.style.transform = "none"; this.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.3)"; } };
        
        btnRestore.onclick = function() {
            var selectedPath = select.value;
            if (!selectedPath) return;
            
            var selectedText = select.options[select.selectedIndex].text;
            
            var confirmMsg = "<div style='color: #ef4444; font-weight: 800; margin-bottom: 12px; font-size: 15px;'>⚠️ SOVRASCRITTURA DATI CORRENTI</div>" +
                             "Stai per ripristinare il:<br><br><strong>" + selectedText + "</strong><br><br>" +
                             "Tutti i dati correnti verranno sostituiti. Vuoi procedere?";
                             
            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("CONFERMA RIPRISTINO", confirmMsg, "SÌ, RIPRISTINA", "ANNULLA", function() {
                    try {
                        var pad = function(n) { return n.toString().padStart(2, '0'); };
                        var now = new Date();
                        var timestamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes());
                        var emergencyPath = pathNode.join(backupDir, "ConsegneDB_EMERGENCY_" + timestamp + ".sqlite");
                        
                        if (fsNode.existsSync(dbPath)) {
                            fsNode.copyFileSync(dbPath, emergencyPath);
                        }
                        
                        fsNode.copyFileSync(selectedPath, dbPath);
                        
                        if (typeof window.ShowGoldAlert === "function") {
                            window.ShowGoldAlert("RIPRISTINO COMPLETATO", "Il database è stato ripristinato con successo!<br><br>L'applicazione verrà riavviata automaticamente per applicare le modifiche.", "✅", function() {
                                window.location.reload();
                            });
                        } else {
                            alert("Ripristino completato! Riavvio in corso...");
                            window.location.reload();
                        }
                    } catch(errEx) {
                        if (typeof window.ShowGoldAlert === "function") {
                            window.ShowGoldAlert("ERRORE RIPRISTINO", "Si è verificato un errore durante il ripristino:<br><br>" + errEx.message, "❌");
                        } else {
                            alert("Errore durante il ripristino:\n" + errEx.message);
                        }
                    }
                }, null, "💾");
            } else {
                // Fallback standard se il polyfill non è pronto
                var rawConfirmMsg = "ATTENZIONE! Stai per ripristinare il:\n\n" + selectedText + "\n\nI dati attuali verranno sovrascritti. Vuoi procedere?";
                if (confirm(rawConfirmMsg)) {
                    try {
                        var pad = function(n) { return n.toString().padStart(2, '0'); };
                        var now = new Date();
                        var timestamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes());
                        var emergencyPath = pathNode.join(backupDir, "ConsegneDB_EMERGENCY_" + timestamp + ".sqlite");
                        
                        if (fsNode.existsSync(dbPath)) {
                            fsNode.copyFileSync(dbPath, emergencyPath);
                        }
                        
                        fsNode.copyFileSync(selectedPath, dbPath);
                        alert("RIPRISTINO COMPLETATO CON SUCCESSO!\n\nIl database è stato aggiornato. L'applicazione verrà riavviata.");
                        window.location.reload();
                    } catch(errEx) {
                        alert("Errore durante il ripristino:\n" + errEx.message);
                    }
                }
            }
        };
        
        var btnCreate = document.createElement("button");
        btnCreate.style.background = "rgba(16, 185, 129, 0.15)";
        btnCreate.style.color = "#10b981";
        btnCreate.style.border = "1px solid #10b981";
        btnCreate.style.borderRadius = "12px";
        btnCreate.style.padding = "12px 18px";
        btnCreate.style.fontWeight = "800";
        btnCreate.style.fontSize = "11.5px";
        btnCreate.style.textTransform = "uppercase";
        btnCreate.style.cursor = "pointer";
        btnCreate.style.transition = "all 0.2s";
        btnCreate.innerHTML = "💾 CREA ORA";
        
        btnCreate.onmouseover = function() { this.style.background = "#10b981"; this.style.color = "#fff"; };
        btnCreate.onmouseout = function() { this.style.background = "rgba(16, 185, 129, 0.15)"; this.style.color = "#10b981"; };
        
        btnCreate.onclick = function() {
            try {
                var now = new Date();
                var pad = function(n) { return n.toString().padStart(2, '0'); };
                var timestamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes());
                var newBackupFile = "ConsegneDB_AUTO_" + timestamp + ".sqlite";
                var newBackupPath = pathNode.join(backupDir, newBackupFile);
                
                if (fsNode.existsSync(dbPath)) {
                    fsNode.copyFileSync(dbPath, newBackupPath);
                    alert("Nuovo backup manuale creato con successo:\n" + newBackupFile);
                    window.ApriGestoreBackup();
                } else {
                    alert("Impossibile trovare il database principale.");
                }
            } catch(errEx) {
                alert("Errore durante la creazione del backup:\n" + errEx.message);
            }
        };
        
        var btnClose = document.createElement("button");
        btnClose.style.background = "rgba(255, 255, 255, 0.05)";
        btnClose.style.color = "#cbd5e1";
        btnClose.style.border = "1px solid rgba(255, 255, 255, 0.15)";
        btnClose.style.borderRadius = "12px";
        btnClose.style.padding = "12px 18px";
        btnClose.style.fontWeight = "800";
        btnClose.style.fontSize = "11.5px";
        btnClose.style.textTransform = "uppercase";
        btnClose.style.cursor = "pointer";
        btnClose.style.transition = "all 0.2s";
        btnClose.innerHTML = "CHIUDI";
        
        btnClose.onmouseover = function() { this.style.background = "rgba(255, 255, 255, 0.1)"; };
        btnClose.onmouseout = function() { this.style.background = "rgba(255, 255, 255, 0.05)"; };
        
        btnClose.onclick = function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        
        btnContainer.appendChild(btnClose);
        btnContainer.appendChild(btnCreate);
        btnContainer.appendChild(btnRestore);
        box.appendChild(btnContainer);
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
    } catch(e) {
        alert("Errore caricamento centro backup:\n" + e.message);
    }
};

if (typeof window.SelezionaConsegna === "undefined") {
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
}

// Attivazione dell'Inactivity Auto-Logout Timer su Dashboard (15 minuti di inattività)
window.addEventListener("load", function() {
    try {
        if (typeof CryptoEngine !== "undefined" && typeof CryptoEngine.InitInactivityTimer === "function") {
            CryptoEngine.InitInactivityTimer(15, function() {
                var isLogged = (sessionStorage.getItem("isLogged") === "true") || (parent && parent.sessionStorage && parent.sessionStorage.getItem("isLogged") === "true");
                if (isLogged) {
                    try { sessionStorage.removeItem("isLogged"); sessionStorage.removeItem("sessionToken"); } catch(e1) {}
                    try { if (parent && parent.sessionStorage) { parent.sessionStorage.removeItem("isLogged"); parent.sessionStorage.removeItem("sessionToken"); } } catch(e2) {}
                    alert("🔒 SESSIONE SCADUTA PER INATTIVITÀ!\n\nSei stato disconnesso automaticamente dopo 15 minuti di inattività per ragioni di sicurezza.");
                    if (typeof window.ApriSelezionaOperatore === "function") {
                        window.ApriSelezionaOperatore();
                    } else if (parent && typeof parent.ApriSelezionaOperatore === "function") {
                        parent.ApriSelezionaOperatore();
                    } else {
                        window.location.href = "../index.html";
                    }
                }
            });
        }
    } catch(eInitTimer) {}
});
