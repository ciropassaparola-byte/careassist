/**
 * LOGIC: GESTIONE PROMEMORIA HTA MODERN AGENDA
 * Motore JavaScript v2.1 - Sistema Festività Allineato
 */

var fso = null;
try { if (typeof ActiveXObject !== "undefined") fso = new ActiveXObject("Scripting.FileSystemObject"); } catch(e) {}
var shell = null;
try { if (typeof ActiveXObject !== "undefined") shell = new ActiveXObject("WScript.Shell"); } catch(e) {}

var pathEval = document.location.pathname || "";
if(pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
var currentDir = fso ? fso.GetParentFolderName(pathEval) : "";
var DB_PATH = fso ? fso.BuildPath(currentDir, "ConsegneDB.accdb") : "ConsegneDB.accdb";

var currentID = "NEW";
var arrayPromemoria = [];
var isNavigating = false;
var isClosing = false; // Flag di sicurezza anti-loop
var currentQuickFilter = "ALL";

// Funzione Helper Globale per Animazione Numerica Count-Up (UX Premium 2026)
function AnimateCounterDash(el, endVal, suffix, prefix) {
    if (!el) return;
    var end = parseInt(endVal, 10) || 0;
    var suff = suffix || "";
    var pref = prefix || "";
    if (isNaN(end)) { el.innerText = pref + endVal + suff; return; }
    if (end === 0) { el.innerText = pref + "0" + suff; return; }
    var duration = 600; // 0.6 secondi di pura magia visiva
    var stepTime = 20; // ms per frame
    var steps = Math.ceil(duration / stepTime);
    var increment = end / steps;
    var current = 0;
    var count = 0;
    
    // Ferma animazione precedente se attiva per eliminare fastidiosi sfarfallamenti
    if (el.animationInterval) clearInterval(el.animationInterval);
    
    el.animationInterval = setInterval(function() {
        count++;
        current += increment;
        if (count >= steps) {
            clearInterval(el.animationInterval);
            el.innerText = pref + end + suff;
        } else {
            el.innerText = pref + Math.floor(current) + suff;
        }
    }, stepTime);
}

window.onbeforeunload = function() {
    if (isNavigating || isClosing) return; 
    isClosing = true;
    
    // Se si chiude con la X rossa, forziamo il ritorno alla Dashboard
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(e) {}
};

// --- GESTIONE MENU CLASSICO ---
function toggleMenu(el, ev) {
    if(ev) { if(ev.stopPropagation) ev.stopPropagation(); else ev.cancelBubble = true; }
    var isOpen = el.className.indexOf("is-open") > -1;
    // Chiudi tutti gli altri
    var items = document.querySelectorAll(".menu-item");
    for(var i=0; i<items.length; i++) items[i].className = items[i].className.replace(" is-open", "");
    if(!isOpen) el.className += " is-open";
}
// Gestore chiusura click outside
window.document.onclick = function() {
    var items = document.querySelectorAll(".menu-item");
    for(var i=0; i<items.length; i++) items[i].className = items[i].className.replace(" is-open", "");
};

function ApriGuidaUtente() {
    document.getElementById("modalGuida").style.display = "flex";
}

// ==========================================
// DB WRAPPER
// ==========================================
function queryDB(sql) {
    try {
        var http = null;
        if (typeof ActiveXObject !== "undefined") {
            try { http = new ActiveXObject("MSXML2.ServerXMLHTTP"); } catch(e) {}
            if (!http) { try { http = new ActiveXObject("MSXML2.XMLHTTP"); } catch(e) {} }
        }
        if (!http && typeof XMLHttpRequest !== "undefined") {
            http = new XMLHttpRequest();
        }
        if (!http) return [];

        http.open("POST", "http://127.0.0.1:3002/query", false);
        if (http.setRequestHeader) http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));
        
        var status = http.status || http.Status;
        var respText = http.responseText || http.ResponseText;

        if (status === 200) {
            var res = JSON.parse(respText);
            if (res && res.error) {
                alert("Errore Query:\n" + res.error + "\n\nQuery:\n" + sql);
                return [];
            }
            return res;
        } else {
            alert("Errore connessione HTTP " + status + " per query:\n" + sql);
        }
    } catch(errReq) {
        alert("Errore JScript in queryDB:\n" + errReq.message);
    }
    return [];
}

function execDB(sql) {
    try {
        var http = null;
        if (typeof ActiveXObject !== "undefined") {
            try { http = new ActiveXObject("MSXML2.ServerXMLHTTP"); } catch(e) {}
            if (!http) { try { http = new ActiveXObject("MSXML2.XMLHTTP"); } catch(e) {} }
        }
        if (!http && typeof XMLHttpRequest !== "undefined") {
            http = new XMLHttpRequest();
        }
        if (!http) return false;

        http.open("POST", "http://127.0.0.1:3002/query", false);
        if (http.setRequestHeader) http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));

        var status = http.status || http.Status;
        var respText = http.responseText || http.ResponseText;

        if (status === 200) {
            var res = JSON.parse(respText);
            if (res && res.error) {
                alert("Errore Database (Risposta API):\n" + res.error + "\n\nQuery:\n" + sql);
                return false;
            }
            if (sql.toUpperCase().indexOf("INSERT INTO") > -1) {
                return res.lastID || true;
            }
            return true;
        } else {
            alert("Errore di connessione al database.\nStato HTTP: " + status + "\nRisposta: " + respText);
        }
    } catch(errReq) {
        alert("Errore JScript in execDB:\n" + errReq.message);
    }
    return false;
}

function sqlEsc(s) { return String(s || "").replace(/'/g, "''"); }

// ==========================================
// STARTUP
// ==========================================
window.onload = function() {
    InitTheme();
    InitUI();
    CaricaLista();
    GestioneBridge();
    try { AvviaDemoneAvvisi(); } catch(e){}
    try { StartTitleClock(); } catch(e){}
    try { CaricaProfiloUtente(); } catch(e){}
    try { FetchWeather(); } catch(e){}
    try { setInterval(UpdateNowLine, 60000); UpdateNowLine(); } catch(e){}
};

// --- GESTIONE TEMA (HTA Compatible) ---
function InitTheme() {
    try {
        var themePath = fso.BuildPath(currentDir, "assets\\theme_pref.txt");
        var theme = "light";
        if (fso.FileExists(themePath)) {
            var f = fso.OpenTextFile(themePath, 1);
            theme = f.ReadAll().trim();
            f.Close();
        }
        if (theme === "dark") {
            document.body.className += " dark-theme";
            var icon = document.getElementById("themeIcon");
            if(icon) icon.className = "fa fa-moon-o";
        }
    } catch(e) {}
}

window.ToggleTheme = function() {
    var b = document.body;
    var icon = document.getElementById("themeIcon");
    var themePath = fso.BuildPath(currentDir, "assets\\theme_pref.txt");
    var newTheme = "light";

    if (b.className.indexOf("dark-theme") > -1) {
        b.className = b.className.replace(" dark-theme", "");
        if(icon) icon.className = "fa fa-sun-o";
        newTheme = "light";
    } else {
        b.className += " dark-theme";
        if(icon) icon.className = "fa fa-moon-o";
        newTheme = "dark";
    }

    try {
        var f = fso.CreateTextFile(themePath, true);
        f.Write(newTheme);
        f.Close();
    } catch(e) {}
};

// --- GESTIONE METEO (Open-Meteo) ---
window.WeatherForecast = {}; // Cache meteo a 7 giorni
window.FetchWeather = function() {
    try {
        var http;
        try { http = new ActiveXObject("MSXML2.ServerXMLHTTP"); } 
        catch(e) { http = new ActiveXObject("MSXML2.XMLHTTP"); }
        
        // Lat/Lon Bari con forecast daily a 7 giorni
        http.open("GET", "https://api.open-meteo.com/v1/forecast?latitude=41.1171&longitude=16.8719&current_weather=true&daily=weathercode,temperature_2m_max&timezone=Europe%2FRome", true); // TRUE = ASYNC
        
        http.onreadystatechange = function() {
            if (http.readyState === 4 && http.status === 200) {
                try {
                    var data = JSON.parse(http.responseText);
                    
                    // 1. Meteo Corrente
                    var cw = data.current_weather;
                    var elTemp = document.getElementById("weatherTemp");
                    var elIcon = document.getElementById("weatherIcon");
                    
                    if(elTemp) elTemp.innerText = Math.round(cw.temperature) + "°C";
                    
                    var code = cw.weathercode;
                    var icon = "☀️";
                    if(code >= 1 && code <= 3) icon = "⛅";
                    else if(code >= 45 && code <= 48) icon = "🌫️";
                    else if(code >= 51 && code <= 67) icon = "🌧️";
                    else if(code >= 71 && code <= 86) icon = "❄️";
                    else if(code >= 95) icon = "⛈️";
                    
                    if(elIcon) elIcon.innerText = icon;
                    
                    // --- LA CHICCA: HEADER CAMALEONTE ---
                    var header = document.querySelector(".danea-header");
                    if(header) {
                        header.className = header.className.replace(/weather-\S+/g, "");
                        if(code === 0) header.className += " weather-sunny";
                        else if(code >= 1 && code <= 3) header.className += " weather-cloudy";
                        else if(code >= 51 && code <= 86) header.className += " weather-rainy";
                        
                        var hr = new Date().getHours();
                        if(hr >= 20 || hr <= 6) header.className += " weather-clear-night";
                    }
                    
                    // 2. Previsioni a 7 giorni (Daily)
                    if(data.daily && data.daily.time) {
                        for(var i=0; i<data.daily.time.length; i++) {
                            var dtStr = data.daily.time[i];
                            var dcode = data.daily.weathercode[i];
                            var tMax = data.daily.temperature_2m_max[i];
                            
                            var y = dtStr.substring(0,4);
                            var m = dtStr.substring(5,7);
                            var d = dtStr.substring(8,10);
                            var key = d + "/" + m + "/" + y;
                            
                            var dIcon = "☀️";
                            if(dcode >= 1 && dcode <= 3) dIcon = "⛅";
                            else if(dcode >= 45 && dcode <= 48) dIcon = "🌫️";
                            else if(dcode >= 51 && dcode <= 67) dIcon = "🌧️";
                            else if(dcode >= 71 && dcode <= 86) dIcon = "❄️";
                            else if(dcode >= 95) dIcon = "⛈️";
                            
                            window.WeatherForecast[key] = { icon: dIcon, maxTemp: Math.round(tMax) };
                        }
                    }
                    // Aggiorna calendario se visibile (e siamo nella callback meteo per evitare flickering prolungati)
                    if(typeof window.RenderCalendarioGrid === 'function' && document.getElementById("calendarView").style.display !== "none") {
                        window.RenderCalendarioGrid();
                    }
                } catch(e2) {}
            }
        };
        http.Send();
    } catch(e) {}
};

// --- HELPER PROGRESS RINGS ---
function SetRing(id, percent) {
    var circle = document.getElementById(id);
    if (!circle) return;
    var radius = circle.r.baseVal.value;
    var circumference = radius * 2 * Math.PI;
    var offset = circumference - (percent / 100 * circumference);
    circle.style.strokeDashoffset = offset;
}

function InitUI() {
    // Autocomplete Clienti
    var cmbCl = document.getElementById("cmbCliente");
    var sugg = document.getElementById("suggClienti");
    if(!cmbCl) return; // Se non c'è il campo cliente, non serve init
    
    cmbCl.onkeyup = function() {
        var val = this.value.trim();
        if(val.length < 2) { if(sugg) sugg.style.display="none"; return; }
        var rs = queryDB("SELECT TOP 5 CognomeNome, Residenza, Localita, Telefono, Provincia, Logistica_Indirizzo, Logistica_Comune, Logistica_Provincia FROM tblClienti WHERE CognomeNome LIKE '%" + sqlEsc(val) + "%'");
        if(rs.length > 0 && sugg) {
            sugg.innerHTML = "";
            for (var i = 0; i < rs.length; i++) {
                var r = rs[i];
                var d = document.createElement("div");
                d.innerText = r.CognomeNome;
                d.onclick = (function(row) {
                    return function() {
                        cmbCl.value = row.CognomeNome;
                        var resVal = row.Residenza || "";
                        var locVal = row.Localita || "";
                        var provVal = row.Provincia || "";
                        var logInd = row.Logistica_Indirizzo || row.logistica_indirizzo || "";
                        if(logInd && logInd.trim() !== "") {
                            resVal = logInd;
                            var logCom = row.Logistica_Comune || row.logistica_comune || "";
                            var logPro = row.Logistica_Provincia || row.logistica_provincia || "";
                            if(logCom) locVal = logCom;
                            if(logPro) provVal = logPro;
                        }
                        document.getElementById("txtIndirizzo").value = resVal;
                        document.getElementById("txtLocalita").value = locVal;
                        document.getElementById("txtTelefono").value = row.Telefono || "";
                        document.getElementById("txtProvincia").value = provVal;
                        sugg.style.display = "none";
                        if(window.RefreshASLCheckup) RefreshASLCheckup(row.CognomeNome);
                    };
                })(r);
                sugg.appendChild(d);
            }
            sugg.style.display = "block";
        }
    };
    
    // Gestione selezione da datalist o cambio manuale
    cmbCl.onblur = function() {
        if(this.value.trim() !== "" && window.RefreshASLCheckup) {
            RefreshASLCheckup(this.value);
        }
    };

    // Init Time Picker (Popolamento rimosso perché ora è dinamico nel modale)
    var cOra = document.getElementById("cmbOra");
    if(cOra) cOra.onclick = ApriTimePicker;
    
    // Caricamento Mezzi Personalizzati
    CaricaListaMezzi();

    // Eventi Bottoni (I pulsanti principali sono ora nella sidebar/card)
    var btnChiudi = document.getElementById("btnChiudi");
    if(btnChiudi) btnChiudi.onclick = function() { Script_BackToDashboard(); };

    // Ricerca Sidebar con Autocompletamento Anagrafica
    var txtRic = document.getElementById("txtRicerca");
    var suggRic = document.getElementById("suggRicerca");
    if (txtRic) {
        txtRic.onkeyup = function() {
            var val = this.value.trim();
            CaricaLista(); // Filtro immediato della lista esistente
            
            if(val.length < 2) { suggRic.style.display="none"; return; }
            
            // Cerca nell'Anagrafica (tblClienti)
            var rs = queryDB("SELECT TOP 5 CognomeNome FROM tblClienti WHERE CognomeNome LIKE '%" + sqlEsc(val) + "%'");
            if(rs.length > 0) {
                suggRic.innerHTML = "";
                for (var i = 0; i < rs.length; i++) {
                    var r = rs[i];
                    var d = document.createElement("div");
                    d.innerText = r.CognomeNome;
                    d.onclick = (function(row) {
                        return function() {
                            var nomeScelto = row.CognomeNome;
                            txtRic.value = nomeScelto;
                            suggRic.style.display = "none";
                            CaricaLista();
                            
                            // Recupero dati anagrafici per popolare i campi a destra
                            var rsInfo = queryDB("SELECT Residenza, Localita, Telefono, Logistica_Indirizzo, Logistica_Comune, Logistica_Provincia FROM tblClienti WHERE CognomeNome = '" + sqlEsc(nomeScelto) + "'");
                            if(rsInfo.length > 0) {
                                Nuovo(); // Reset per nuovo inserimento o visualizzazione info
                                document.getElementById("cmbCliente").value = nomeScelto;
                                var resRow = rsInfo[0];
                                var resVal = resRow.Residenza || "";
                                var locVal = resRow.Localita || "";
                                var logInd = resRow.Logistica_Indirizzo || resRow.logistica_indirizzo || "";
                                if(logInd && logInd.trim() !== "") {
                                    resVal = logInd;
                                    var logCom = resRow.Logistica_Comune || resRow.logistica_comune || "";
                                    if(logCom) locVal = logCom;
                                }
                                document.getElementById("txtIndirizzo").value = resVal;
                                document.getElementById("txtLocalita").value = locVal;
                                document.getElementById("txtTelefono").value = resRow.Telefono || "";
                            }
                        };
                    })(r);
                    suggRic.appendChild(d);
                }
                suggRic.style.display = "block";
            } else {
                suggRic.style.display = "none";
            }
        };

        // DOPPIO CLICK: Apri Anagrafica e Chiudi Agenda
        txtRic.ondblclick = function() {
            var val = this.value.trim();
            try {
                if(val !== "") {
                    var bridgePath = fso.BuildPath(fso.BuildPath(currentDir, "system"), "search.tmp");
                    var ts = fso.CreateTextFile(bridgePath, true);
                    ts.Write(val);
                    ts.Close();
                }
                var htaPath = fso.BuildPath(currentDir, "anagrafica.html");
                shell.Run('mshta.exe "' + htaPath + '"', 1, false);
                window.close();
            } catch(e) {
                alert("Errore nell'apertura Anagrafica: " + e.message);
            }
        };
    }

    // Chiudi suggerimenti se clicchi fuori
    document.addEventListener("click", function(e) {
        var target = e.target || e.srcElement;
        if(target && target.id !== "txtRicerca") {
            var sR = document.getElementById("suggRicerca");
            if (sR) sR.style.display = "none";
        }
    });

    // Calendario
    var fData = document.getElementById("txtData");
    if (fData) {
        var fnOpenCal = function() { ApriCalendario("txtData"); };
        fData.onclick = fnOpenCal;
        fData.ondblclick = fnOpenCal;
    }
    ConfiguraCalendario();
    
    // PDF Actions
    var btnEP = document.getElementById("btnEsportaPDF");
    if (btnEP) btnEP.onclick = StampaPromemoriaPDF;
    var btnAP = document.getElementById("btnAgendaPDF");
    if (btnAP) btnAP.onclick = StampaAgendaCompletaPDF;
}

function Script_BackToDashboard() {
    isNavigating = true;
    try {
        var sh = new ActiveXObject("WScript.Shell");
        var pht = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(pht)) pht = fso.BuildPath(currentDir, "dashboard.html");
        
        // Prima di chiudere, marchiamo questa finestra
        document.title = "CHIUSURA_IN_CORSO";
        
        // Lanciamo il dashboard (che farà pulizia automatica all'avvio)
        sh.Run('mshta.exe "' + pht + '"', 1, false);
    } catch(err) {}
    
    // Tentiamo la chiusura robusta
    window.open('', '_self', '');
    window.close();
    self.close();
}

// ==========================================
// LOGICA FILTRO/PONTE (BRIDGE)
// ==========================================
function GestioneBridge() {
    // 0. Controllo Bridge da Materiali (bridge_materiale.tmp) - RICCO DI DATI
    var bPathMat = fso.BuildPath(fso.BuildPath(currentDir, "system"), "bridge_materiale.tmp");
    if(fso.FileExists(bPathMat)) {
        try {
            var tsMat = fso.OpenTextFile(bPathMat, 1, false, -1); // -1 unicode
            var content = tsMat.ReadAll();
            tsMat.Close();
            fso.DeleteFile(bPathMat);
            
            var pack = JSON.parse(content);
            if(pack && pack.nominativo) {
                setTimeout(function() {
                    Nuovo();
                    document.getElementById("cmbCliente").value = pack.nominativo;
                    document.getElementById("txtLocalita").value = pack.citta || "";
                    document.getElementById("txtTelefono").value = pack.telefono || "";
                    document.getElementById("cmbTipologia").value = "Consegna"; // Sensato per materiali
                    
                    var matStr = "ELENCO MATERIALI RICHIESTI:\n";
                    if(pack.materiali && pack.materiali.length > 0) {
                        for(var j=0; j<pack.materiali.length; j++) {
                            matStr += "• " + pack.materiali[j].nome + ": " + pack.materiali[j].valore + "\n";
                        }
                    }
                    document.getElementById("txtNote").value = matStr;
                    
                    // Cerca se c'è già residenza completa nel DB anagrafica
                    CercaDatiAnagrafici(pack.nominativo);
                    
                    // Auto-imposta data OGGI
                    var tody = new Date();
                    var dd = (tody.getDate()<10?'0':'')+tody.getDate();
                    var mm = ((tody.getMonth()+1)<10?'0':'')+(tody.getMonth()+1);
                    document.getElementById("txtData").value = dd + "/" + mm + "/" + tody.getFullYear();
                    
                    document.getElementById("cmbCliente").focus();
                }, 500);
                return; // Gestito, usciamo
            }
        } catch(eBridge) { alert("Problema nell'acquisizione pacchetto materiali: " + eBridge.message); }
    }

    var bridgeFound = false;
    var nome = "";

    // 1. Controllo Bridge da Anagrafica (rem_search.tmp)
    var bPathRem = fso.BuildPath(fso.BuildPath(currentDir, "system"), "rem_search.tmp");
    if(fso.FileExists(bPathRem)) {
        try {
            var ts = fso.OpenTextFile(bPathRem, 1);
            nome = ts.ReadLine();
            ts.Close();
            fso.DeleteFile(bPathRem);
            bridgeFound = true;
        } catch(e) {}
    }

    // 2. Controllo Bridge da Consegne (bridge_consegne.tmp)
    var bPathCon = fso.BuildPath(fso.BuildPath(currentDir, "system"), "bridge_consegne.tmp");
    if(fso.FileExists(bPathCon)) {
        try {
            var ts2 = fso.OpenTextFile(bPathCon, 1);
            nome = ts2.ReadLine();
            ts2.Close();
            fso.DeleteFile(bPathCon);
            bridgeFound = true;
        } catch(e) {}
    }

    if(bridgeFound && nome !== "") {
        // Applichiamo tutto in un unico blocco ritardato (Atomic Bridge)
        setTimeout(function() {
            // Pulisce tutto prima di iniziare
            Nuovo();
            
            // Popola i due campi chiave
            document.getElementById("txtRicerca").value = nome;
            document.getElementById("cmbCliente").value = nome;
            
            // Lancia le ricerche in parallelo
            CaricaLista();
            CercaDatiAnagrafici(nome);
            
            // Porta il focus sul campo principale
            document.getElementById("cmbCliente").focus();
        }, 500);
    }
}

function CercaDatiAnagrafici(nome) {
    if(!nome) return;
    // Primo tentativo: Corrispondenza Esatta
    var rs = queryDB("SELECT TOP 1 Residenza, Localita, Telefono, Logistica_Indirizzo, Logistica_Comune, Logistica_Provincia FROM tblClienti WHERE CognomeNome='" + sqlEsc(nome.trim()) + "'");
    
    // Secondo tentativo (Fallback): Corrispondenza Simile se il primo fallisce
    if(rs.length === 0) {
        rs = queryDB("SELECT TOP 1 Residenza, Localita, Telefono, Logistica_Indirizzo, Logistica_Comune, Logistica_Provincia FROM tblClienti WHERE CognomeNome LIKE '%" + sqlEsc(nome.trim()) + "%'");
    }

    if(rs.length > 0) {
        var r = rs[0];
        var resVal = r.Residenza || "";
        var locVal = r.Localita || "";
        var logInd = r.Logistica_Indirizzo || r.logistica_indirizzo || "";
        if(logInd && logInd.trim() !== "") {
            resVal = logInd;
            var logCom = r.Logistica_Comune || r.logistica_comune || "";
            if(logCom) locVal = logCom;
        }
        document.getElementById("txtIndirizzo").value = resVal;
        document.getElementById("txtLocalita").value = locVal;
        document.getElementById("txtTelefono").value = r.Telefono || "";
        
        // Applichiamo un feedback visivo (classe flash se disponibile o semplice stile)
        document.getElementById("cmbCliente").style.backgroundColor = "#fff9db";
        setTimeout(function() { document.getElementById("cmbCliente").style.backgroundColor = ""; }, 1000);
    }
}

// ==========================================
// LISTA E DETTAGLIO
// ==========================================
function CaricaLista() {
    var txt = document.getElementById("txtRicerca").value.trim();
    var sql = "SELECT p.*, c.Residenza, c.Localita, c.Telefono FROM tblPromemoria p LEFT JOIN tblClienti c ON p.Cliente = c.CognomeNome WHERE p.Stato != 'Cestinato'";
    if(txt !== "") sql += " AND (p.Cliente LIKE '%" + sqlEsc(txt) + "%' OR p.Note LIKE '%" + sqlEsc(txt) + "%')";
    sql += " ORDER BY p.DataPromemoria DESC, p.OraPromemoria DESC";
    
    var arr = queryDB(sql);
    
    // KPI Counters
    var kpiOggi = 0;
    var kpiUrgente = 0;
    var kpiFatti = 0;
    
    // BADGE COUNTERS (NUOVI)
    var bALL=0, bTODAY=0, bWAIT=0, bCOMM=0, bTECN=0, bCONS=0;
    var filteredArr = [];
    
    var today = new Date();
    var g = (today.getDate()<10?'0':'')+today.getDate();
    var m = ((today.getMonth()+1)<10?'0':'')+(today.getMonth()+1);
    var oggiIT = g + "/" + m + "/" + today.getFullYear();
    
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        item.DataIT = formatIT(item.DataPromemoria);
        
        var stat = String(item.Stato || "").toLowerCase();
        var tip = String(item.Tipologia || "").toLowerCase();
        
        // CALCOLO BADGE (Sempre su tutto l'array non filtrato)
        bALL++;
        if (item.DataIT === oggiIT) bTODAY++;
        if (stat.indexOf("attesa") > -1) bWAIT++;
        if (tip.indexOf("commerciale") > -1) bCOMM++;
        if (tip.indexOf("tecnico") > -1) bTECN++;
        if (tip.indexOf("consegna") > -1) bCONS++;

        var show = true;
        if (currentQuickFilter === "TODAY" && item.DataIT !== oggiIT) show = false;
        else if (currentQuickFilter === "WAIT" && stat.indexOf("attesa") === -1) show = false;
        else if (currentQuickFilter === "COMM" && tip.indexOf("commerciale") === -1) show = false;
        else if (currentQuickFilter === "TECN" && tip.indexOf("tecnico") === -1) show = false;
        else if (currentQuickFilter === "CONS" && tip.indexOf("consegna") === -1) show = false;
        
        if (item.DataIT === oggiIT) {
            kpiOggi++;
            if (stat.indexOf("completato") > -1) kpiFatti++;
            else if (stat.indexOf("attesa") > -1) kpiUrgente++;
        }
        
        if (show) filteredArr.push(item);
    }
    
    // Update Badge DOM
    if(document.getElementById("cnt_ALL")) document.getElementById("cnt_ALL").innerText = bALL;
    if(document.getElementById("cnt_TODAY")) document.getElementById("cnt_TODAY").innerText = bTODAY;
    if(document.getElementById("cnt_WAIT")) document.getElementById("cnt_WAIT").innerText = bWAIT;
    if(document.getElementById("cnt_COMM")) document.getElementById("cnt_COMM").innerText = bCOMM;
    if(document.getElementById("cnt_TECN")) document.getElementById("cnt_TECN").innerText = bTECN;
    if(document.getElementById("cnt_CONS")) document.getElementById("cnt_CONS").innerText = bCONS;

    // UPDATE KPI DOM
    var eOggi = document.getElementById("kpiOggi");
    var eUrgente = document.getElementById("kpiUrgente");
    var eFatti = document.getElementById("kpiFatti");
    
    if(eOggi) AnimateCounterDash(eOggi, kpiOggi);
    if(eUrgente) AnimateCounterDash(eUrgente, kpiUrgente);
    if(eFatti) AnimateCounterDash(eFatti, kpiFatti);

    // Animazione Rings
    if(kpiOggi > 0) {
        SetRing("ringOggi", 100);
        SetRing("ringUrgente", (kpiUrgente / kpiOggi) * 100);
        SetRing("ringFatti", (kpiFatti / kpiOggi) * 100);
    } else {
        SetRing("ringOggi", 0); SetRing("ringUrgente", 0); SetRing("ringFatti", 0);
    }
    
    arrayPromemoria = filteredArr;
    
    var container = document.getElementById("lstPromemoriaCards");
    container.innerHTML = "";
    
    // GESTIONE EMPTY STATE
    if (arrayPromemoria.length === 0) {
        var emptyDiv = document.createElement("tr");
        emptyDiv.innerHTML = '<td colspan="8"><div class="empty-state-container">' +
            '<div class="empty-state-icon">📋</div>' +
            '<div class="empty-state-text">Nessun appuntamento trovato con i filtri attuali.</div>' +
            '</div></td>';
        container.appendChild(emptyDiv);
    }

    var att=0, fat=0;
    var loopArr = arrayPromemoria; // Alias per chiarezza
    for (var i = 0; i < loopArr.length; i++) {
        var r = loopArr[i];
        var idx = i;
        var row = document.createElement("tr");
        if (currentID === r.ID) row.className = "selected";

        var stat = String(r.Stato || "").toLowerCase();
        var tagClass = "tag-attesa";
        if(stat.indexOf("completa") > -1) tagClass = "tag-completato";
        else if(stat.indexOf("annulla") > -1) tagClass = "tag-annullato";

        row.onclick = function() { 
            var rows = container.getElementsByTagName("tr");
            for(var i=0; i<rows.length; i++) rows[i].className="";
            this.className="selected";
            CaricaDettaglio(r); 
        };
        
        var d = r.DataIT || "--/--/----";
        var ora = r.OraPromemoria || "--:--";
        var noteSnippet = (r.Note || "").substring(0, 100) + (r.Note && r.Note.length > 100 ? "..." : "");

        var hoverActions = GetHoverActions(r);
        row.innerHTML = 
            '<td class="chk-col"><input type="checkbox" class="batch-chk-row" value="' + r.ID + '" onclick="CheckBatchVisibility(event)"></td>' +
            '<td>' + r.ID + '</td>' +
            '<td><span class="tag ' + tagClass + '">' + (r.Stato || "In attesa") + '</span></td>' +
            '<td style="font-weight:bold">' + d + '</td>' +
            '<td>' + ora + '</td>' +
            '<td style="color:#003366; font-weight:800">' + (r.Cliente || "Senza Nome") + '</td>' +
            '<td style="font-size:11px; color:#666">' + noteSnippet + '</td>' +
            '<td class="actions-cell">' +
                hoverActions +
                '<button class="row-btn save" onclick="ActionSalva()" title="Salva"><img src="https://img.icons8.com/fluency/48/save.png"></button>' +
                '<button class="row-btn edit" onclick="CaricaDettaglio(arrayPromemoria[' + idx + '])" title="Modifica"><img src="https://img.icons8.com/fluency/48/edit.png"></button>' +
                '<button class="row-btn delete" onclick="ActionElimina()" title="Elimina"><img src="https://img.icons8.com/fluency/48/delete-forever.png"></button>' +
            '</td>';
            
        container.appendChild(row);
        
        if(stat.indexOf("attesa")>-1 || stat.indexOf("corso")>-1) att++;
        else if(stat.indexOf("completa")>-1) fat++;
    }
    
    AnimateCounterDash(document.getElementById("cntAttesa"), att);
    AnimateCounterDash(document.getElementById("cntFatti"), fat);
    
    // Aggiornamento Statistiche Barra Filtri
    var stContainer = document.getElementById("topStats");
    if(stContainer) {
        var tot = att + fat;
        if(tot > 0) {
            var pct = Math.round((fat / tot) * 100);
            stContainer.innerHTML = "<span>" + tot + " Appuntamenti (" + fat + " Fatti, " + att + " In Attesa)</span>" +
                "<div style='width:100px; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;'>" +
                "<div style='width:" + pct + "%; height:100%; background:" + (pct==100 ? "#16a34a" : "#3b82f6") + ";'></div></div>" +
                "<span>" + pct + "%</span>";
        } else {
            stContainer.innerHTML = "<span>Nessun appuntamento in questa vista.</span>";
        }
    }

    // Popola Post-it Board
    var board = document.getElementById("postitBoard");
    if (board) {
        board.innerHTML = "";
        for (var i = 0; i < arrayPromemoria.length; i++) {
            var r = arrayPromemoria[i];
            var idx = i;
            var card = document.createElement("div");
            
            // Colore del Post-it basato sulla Tipologia o Stato
            var colClass = "color-yellow"; // Default Generico
            var stat = String(r.Stato || "").toLowerCase();
            var tip = String(r.Tipologia || "").toLowerCase();

            if (tip.indexOf("commerciale") > -1) colClass = "color-orange";
            else if (tip.indexOf("tecnico") > -1) colClass = "color-blue";
            else if (tip.indexOf("consegna") > -1) colClass = "color-purple";
            else if (tip.indexOf("sollecito") > -1) colClass = "color-pink";
            
            // Se è completato, il verde ha priorità massima visiva
            if (stat.indexOf("completa") > -1) colClass = "color-green";
            else if (stat.indexOf("annulla") > -1) colClass = "color-pink";
            
            card.className = "post-it-card " + colClass;
            if (currentID === r.ID) card.className += " selected";
            
            // LOGICA URGENZA (PULSE SE SCADUTO)
            var now = new Date();
            var currOra = (now.getHours()<10?'0':'')+now.getHours() + ":" + (now.getMinutes()<10?'0':'')+now.getMinutes();
            if (stat.indexOf("attesa") > -1 && r.DataIT === oggiIT && r.OraPromemoria && r.OraPromemoria < currOra) {
                card.className += " pulse-urgente";
            }

            // --- INIZIO LOGICA DRAG & DROP VERSO CESTINO ---
            card.draggable = true;
            card.ondragstart = (function(recordId) {
                return function(ev) {
                    ev.dataTransfer.effectAllowed = "move";
                    ev.dataTransfer.setData("Text", String(recordId));
                };
            })(r.ID);
            // --- FINE LOGICA DRAG & DROP ---
            
            card.onclick = (function(record) {
                return function() {
                    var cards = board.getElementsByClassName("post-it-card");
                    for (var j=0; j<cards.length; j++) {
                        cards[j].className = cards[j].className.replace(" selected", "");
                    }
                    this.className += " selected";
                    CaricaDettaglio(record);
                };
            })(r);
            
            var d = r.DataIT || "--/--/----";
            var ora = r.OraPromemoria || "--:--";
            var clName = r.Cliente || "Appunto Volante";
            
            // HOVER QUICK ACTIONS (Unificato)
            var hoverHTML = GetHoverActions(r, ora);

            var actHTML = "";
            if (stat.indexOf("completa") === -1 && stat.indexOf("annulla") === -1) {
                actHTML = '<button class="post-it-btn btn-complete" title="Segna come Completato" onclick="ActionStatoPostit(' + r.ID + ', \'Completato\', event)"><i class="fa fa-check"></i></button>';
            }
            actHTML += '<button class="post-it-btn btn-delete" title="Cestina Appunto" onclick="ActionStatoPostit(' + r.ID + ', \'Annullato\', event)"><i class="fa fa-trash"></i></button>';

            card.innerHTML = 
                hoverHTML +
                '<div class="post-it-pin"></div>' +
                '<div class="post-it-id">ID: ' + r.ID + '</div>' +
                '<div class="post-it-status">' + (r.Stato || "In attesa").toUpperCase() + '</div>' +
                '<div class="post-it-client">' + clName + '</div>' +
                '<div class="post-it-note">' + (r.Note || "Nessuna nota") + '</div>' +
                '<div class="post-it-footer">' +
                    '<span><i class="fa fa-calendar"></i> ' + d + ' ore ' + ora + '</span>' +
                    '<div class="post-it-actions">' + actHTML + '</div>' +
                '</div>';
                
            board.appendChild(card);
        }
    }
    
    // Rinfresca la vista corrente
    SwitchView(currentView);
}

// --- LOGICA KANBAN ---
window.DisegnaVistaKanban = function() {
    var kWait = document.getElementById("kanbanWait");
    var kDoing = document.getElementById("kanbanDoing");
    var kDone = document.getElementById("kanbanDone");
    if(!kWait || !kDoing || !kDone) return;

    kWait.innerHTML = ""; kDoing.innerHTML = ""; kDone.innerHTML = "";
    var cW=0, cDg=0, cDe=0;

    for (var i = 0; i < arrayPromemoria.length; i++) {
        var r = arrayPromemoria[i];
        var stat = String(r.Stato || "").toLowerCase();
        
        var card = document.createElement("div");
        card.className = "post-it-card mini"; 
        // Colore basato su tipologia
        var col = "color-yellow";
        var tip = String(r.Tipologia || "").toLowerCase();
        if (tip.indexOf("commerciale") > -1) col = "color-orange";
        else if (tip.indexOf("tecnico") > -1) col = "color-blue";
        else if (tip.indexOf("consegna") > -1) col = "color-purple";

        card.className += " " + col;
        card.draggable = true;
        card.ondragstart = (function(id){ return function(ev){ ev.dataTransfer.setData("Text", String(id)); }; })(r.ID);
        card.onclick = (function(rec){ return function(){ CaricaDettaglio(rec); }; })(r);

        card.innerHTML = "<strong>ID: " + r.ID + "</strong> - " + (r.Cliente || "Senza Nome") + "<br/><small>" + (r.Note || "").substring(0,40) + "...</small>";

        if (stat.indexOf("attesa") > -1) { kWait.appendChild(card); cW++; }
        else if (stat.indexOf("corso") > -1) { kDoing.appendChild(card); cDg++; }
        else if (stat.indexOf("completa") > -1) { kDone.appendChild(card); cDe++; }
    }
    
    document.getElementById("cntKanbanWait").innerText = cW;
    document.getElementById("cntKanbanDoing").innerText = cDg;
    document.getElementById("cntKanbanDone").innerText = cDe;
};

window.KanbanDragOver = function(ev) { ev.preventDefault(); ev.currentTarget.className += " drag-over"; };
window.KanbanDragLeave = function(ev) { ev.currentTarget.className = ev.currentTarget.className.replace(" drag-over", ""); };
window.KanbanDrop = function(ev, nuovoStato) {
    ev.preventDefault();
    ev.currentTarget.className = ev.currentTarget.className.replace(" drag-over", "");
    var id = ev.dataTransfer.getData("Text");
    if(id && execDB("UPDATE tblPromemoria SET Stato='" + nuovoStato + "' WHERE ID=" + id)) {
        CaricaLista();
    }
};

// --- FUNZIONI QUICK ACTION (VERSIONE LOGISTICA DEFINITIVA) ---
window.QuickWA = function(tel, ora, tipo, ev, cl) {
    if(ev) ev.stopPropagation();
    if(!tel) { alert("Nessun numero di telefono disponibile."); return; }
    
    var nomeCli = cl || "Gentile Cliente";
    var msg = "";
    
    if (tipo === "CONF") {
        msg = "Buongiorno " + nomeCli + ", sono Ciro, il consegnatario della Cooperativa Aurelio Nicolodi. Le confermo che la consegna è prevista per oggi alle ore " + ora + ". Buona giornata!";
    } else if (tipo === "DELAY") {
        msg = "Buongiorno " + nomeCli + ", sono Ciro, il consegnatario della Cooperativa Aurelio Nicolodi. La contatto per avvisarla che purtroppo avremo un ritardo sulla consegna prevista per le ore " + ora + ". Arriveremo con circa 20 minuti di ritardo. Ci scusiamo per il disagio.";
    } else if (tipo === "ARRIVING") {
        msg = "Buongiorno " + nomeCli + ", sono Ciro, il consegnatario della Cooperativa Aurelio Nicolodi. La contatto per avvisarla che stiamo arrivando da Lei.";
    }
    
    var url = "https://wa.me/39" + tel.replace(/\D/g, "") + "?text=" + encodeURIComponent(msg);
    
    // Apertura sicura per ambiente HTA
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run(url);
    } catch(e) {
        window.open(url, "_blank");
    }
};

window.QuickMap = function(loc, ev) {
    if(ev) ev.stopPropagation();
    if(!loc) { alert("Località non specificata."); return; }
    var url = "https://www.google.it/maps/search/" + encodeURIComponent(loc);
    shell.Run(url);
};

window.QuickDone = function(id, ev) {
    if(ev) ev.stopPropagation();
    if(execDB("UPDATE tblPromemoria SET Stato='Completato' WHERE ID=" + id)) {
        CaricaLista();
    }
};

function formatIT(dbDate) {
    if(!dbDate) return "";
    try {
        var d = new Date(dbDate);
        if(isNaN(d.getTime())) {
            // Se non è un formato standard JScript, proviamo come oggetto Date Access
            try {
                var gg = (dbDate.getDate()<10?'0':'')+dbDate.getDate();
                var mm = ((dbDate.getMonth()+1)<10?'0':'')+(dbDate.getMonth()+1);
                return gg + "/" + mm + "/" + dbDate.getFullYear();
            } catch(ee) { return "-"; }
        }
        var gg = (d.getDate()<10?'0':'')+d.getDate();
        var mm = ((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1);
        return gg + "/" + mm + "/" + d.getFullYear();
    } catch(e) { return "-"; }
}

function CaricaDettaglio(r) {
    currentID = r.ID;
    document.getElementById("lblID").innerText = "ID: " + r.ID;
    document.getElementById("cmbCliente").value = r.Cliente || "";
    document.getElementById("txtData").value = r.DataIT || "";
    document.getElementById("cmbOra").value = r.OraPromemoria || "";
    document.getElementById("cmbTipologia").value = r.Tipologia || "Generico";
    document.getElementById("cmbStato").value = r.Stato || "In attesa";
    document.getElementById("txtNote").value = r.Note || "";
    document.getElementById("txtAssegnato").value = r.AssegnatoA || "";
    
    // CARICAMENTO DATI ASL
    document.getElementById("txtDataASL").value = r.ASL_DataUltima || "";
    document.getElementById("txtCodiciASL").value = r.ASL_Codici || "";
    UpdateASLLogic();
    RefreshASLCheckup(r.Cliente);
    
    var res = queryDB("SELECT Residenza, Localita, Telefono, Provincia, Logistica_Indirizzo, Logistica_Comune, Logistica_Provincia FROM tblClienti WHERE CognomeNome = '" + sqlEsc(r.Cliente) + "'");
    if(res.length > 0) {
        var resRow = res[0];
        var resVal = resRow.Residenza || "";
        var locVal = resRow.Localita || "";
        var provVal = resRow.Provincia || "";
        var logInd = resRow.Logistica_Indirizzo || resRow.logistica_indirizzo || "";
        if(logInd && logInd.trim() !== "") {
            resVal = logInd;
            var logCom = resRow.Logistica_Comune || resRow.logistica_comune || "";
            var logPro = resRow.Logistica_Provincia || resRow.logistica_provincia || "";
            if(logCom) locVal = logCom;
            if(logPro) provVal = logPro;
        }
        document.getElementById("txtIndirizzo").value = resVal;
        document.getElementById("txtLocalita").value = locVal;
        document.getElementById("txtTelefono").value = resRow.Telefono || "";
        document.getElementById("txtProvincia").value = provVal;
    } else {
        document.getElementById("txtIndirizzo").value = "";
        document.getElementById("txtLocalita").value = "";
        document.getElementById("txtTelefono").value = "";
        document.getElementById("txtProvincia").value = "";
    }
    UpdateMapPreview();
    UpdateStatusColor(r.Stato || "In attesa");
}

function Nuovo() {
    currentID = "NEW";
    document.getElementById("lblID").innerText = "NUOVO";
    document.getElementById("cmbCliente").value = "";
    document.getElementById("txtData").value = "";
    document.getElementById("cmbOra").value = "";
    document.getElementById("cmbTipologia").value = "Generico";
    document.getElementById("cmbStato").value = "In attesa";
    document.getElementById("txtNote").value = "";
    document.getElementById("txtIndirizzo").value = "";
    document.getElementById("txtLocalita").value = "";
    document.getElementById("txtTelefono").value = "";
    document.getElementById("txtProvincia").value = "";
    document.getElementById("txtAssegnato").value = "";
    document.getElementById("txtDataASL").value = "";
    document.getElementById("txtCodiciASL").value = "";
    UpdateASLLogic();
    UpdateMapPreview();
    UpdateStatusColor("In attesa");
    
    var container = document.getElementById("lstPromemoriaCards");
    var rows = container.getElementsByTagName("tr");
    for(var i=0; i<rows.length; i++) rows[i].className="";
}

// ==========================================
// CRUD
// ==========================================
var isSaving = false;
function ActionSalva() {
    if(isSaving) return;
    var cl = document.getElementById("cmbCliente").value.trim();
    var dt = document.getElementById("txtData").value.trim();
    if(cl === "" || dt.length !== 10) { alert("Dati incompleti (Cliente e Data)"); return; }
    
    isSaving = true;
    var p = dt.split("/");
    var dtSql = "'" + p[2] + "-" + p[1] + "-" + p[0] + "'"; // Formato standard SQLite 'YYYY-MM-DD'
    
    // --- CONTROLLO CONFLITTI: Stesso cliente, stessa data ---
    var checkSql = "SELECT ID FROM tblPromemoria WHERE Cliente='" + sqlEsc(cl) + "' AND DataPromemoria=" + dtSql;
    if(currentID !== "NEW") checkSql += " AND ID <> " + currentID;
    
    var checkRes = queryDB(checkSql);
    if(checkRes && checkRes.length > 0) {
        alert("ATTENZIONE: Il cliente '" + cl + "' ha già un appuntamento fissato per il giorno " + dt + ".\nNon è possibile inserire duplicati per la stessa data.");
        isSaving = false;
        return;
    }
    // --------------------------------------------------------

    var ora = document.getElementById("cmbOra").value;
    var tip = document.getElementById("cmbTipologia").value;
    var stat = document.getElementById("cmbStato").value;
    var note = sqlEsc(document.getElementById("txtNote").value);
    
    var ass = sqlEsc(document.getElementById("txtAssegnato").value);
    var aslD = document.getElementById("txtDataASL").value;
    var aslC = sqlEsc(document.getElementById("txtCodiciASL").value);
    
    var sql = "";
    if(currentID === "NEW") {
        sql = "INSERT INTO tblPromemoria (Cliente, DataPromemoria, OraPromemoria, Tipologia, [Stato], [Note], AssegnatoA, ASL_DataUltima, ASL_Codici, DataInserimento) VALUES (" +
              "'" + sqlEsc(cl) + "', " + dtSql + ", '" + ora + "', '" + sqlEsc(tip) + "', '" + stat + "', '" + note + "', '" + ass + "', '" + aslD + "', '" + aslC + "', Now())";
    } else {
        sql = "UPDATE tblPromemoria SET Cliente='" + sqlEsc(cl) + "', DataPromemoria=" + dtSql + ", OraPromemoria='" + ora + "', " +
              "Tipologia='" + sqlEsc(tip) + "', [Stato]='" + stat + "', [Note]='" + note + "', AssegnatoA='" + ass + "', " +
              "ASL_DataUltima='" + aslD + "', ASL_Codici='" + aslC + "' WHERE ID=" + currentID;
    }
    
    var res = execDB(sql);
    if(res) {
        // Mirror degli aggiornamenti sull'anagrafica del cliente
        try {
            var indForm = document.getElementById("txtIndirizzo").value;
            var locForm = document.getElementById("txtLocalita").value;
            var telForm = document.getElementById("txtTelefono").value;
            
            var sqlUpdCli = "UPDATE tblClienti SET Residenza='" + sqlEsc(indForm) + "', Localita='" + sqlEsc(locForm) + "', Telefono='" + sqlEsc(telForm) + "' WHERE CognomeNome='" + sqlEsc(cl) + "'";
            execDB(sqlUpdCli);
        } catch(errCli){}

        if(currentID === "NEW") {
            currentID = res; // Diventa l'ID appena creato
            document.getElementById("lblID").innerText = "ID: " + currentID;
        }
        ShowToast("SUCCESSO", "Informazioni salvate correttamente!");
        
        // --- IL CAFFÈ FORTE: CELEBRAZIONE ---
        if (stat.toLowerCase().indexOf("completa") > -1) {
            LaunchConfetti();
        }
        
        CaricaLista();
    }
    setTimeout(function(){ isSaving = false; }, 1000);
}

window.ShowToast = function(title, msg) {
    var t = document.createElement("div");
    t.className = "toast-notification";
    
    var html = '<div class="toast-icon"><i class="fa fa-check"></i></div>' +
               '<div class="toast-content">' +
               '  <div class="toast-title">' + title + '</div>' +
               '  <div class="toast-msg">' + msg + '</div>' +
               '</div>';
    
    t.innerHTML = html;
    document.body.appendChild(t);
    
    // Trigger animation
    setTimeout(function(){ t.className += " show"; }, 10);
    
    // Remove after 4s
    setTimeout(function(){
        t.className = t.className.replace(" show", "");
        setTimeout(function(){ if(t.parentNode) document.body.removeChild(t); }, 400);
    }, 4000);
};

function ActionElimina() {
    if(currentID === "NEW") return;
    if(confirm("Eliminare definitivamente questo appuntamento?")) {
        if(execDB("DELETE FROM tblPromemoria WHERE ID=" + currentID)) {
            Nuovo();
            CaricaLista();
        }
    }
}

// ==========================================
// CALENDARIO PREMIUM + FESTIVITÀ
// ==========================================
var targetId = "";
var calDate = new Date();
function ConfiguraCalendario() {
    document.getElementById("btnCalChiudi").onclick = function() { document.getElementById("calendarOverlay").style.display="none"; };
    document.getElementById("btnCalPrev").onclick = function() { calDate.setMonth(calDate.getMonth()-1); RenderCal(); };
    document.getElementById("btnCalNext").onclick = function() { calDate.setMonth(calDate.getMonth()+1); RenderCal(); };
    document.getElementById("btnCalOggi").onclick = function() { 
        var d = new Date(); 
        document.getElementById(targetId).value = (d.getDate()<10?'0':'')+d.getDate() + "/" + ((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1) + "/" + d.getFullYear();
        document.getElementById("calendarOverlay").style.display="none";
    };
}
function ApriCalendario(id) { 
    targetId = id; 
    document.getElementById("calendarOverlay").style.display="flex"; 
    RenderCal(); 
}

function isFestivoIT(d, m, y) {
    if (d === 1 && m === 1) return true;   // Capodanno
    if (d === 6 && m === 1) return true;   // Epifania
    if (d === 8 && m === 5) return true;   // S. Nicola (Patrono)
    if (d === 25 && m === 4) return true;  // Liberazione
    if (d === 1 && m === 5) return true;   // Lavoro
    if (d === 2 && m === 6) return true;   // Repubblica
    if (d === 15 && m === 8) return true;  // Ferragosto
    if (d === 1 && m === 11) return true;  // Ognissanti
    if (d === 8 && m === 12) return true;  // Immacolata
    if (d === 25 && m === 12) return true; // Natale
    if (d === 26 && m === 12) return true; // S. Stefano
    
    // Calcolo Pasqua e Pasquetta
    var a = y % 19, b = Math.floor(y / 100), c = y % 100,
        de = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - de - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        ma = Math.floor((a + 11 * h + 22 * l) / 451),
        mP = Math.floor((h + l - 7 * ma + 114) / 31),
        dP = ((h + l - 7 * ma + 114) % 31) + 1;
        
    if (d === dP && m === mP) return true; // Pasqua
    var dtPQ = new Date(y, mP - 1, dP);
    dtPQ.setDate(dtPQ.getDate() + 1);
    if (d === dtPQ.getDate() && m === (dtPQ.getMonth() + 1)) return true; // Pasquetta
    
    return false;
}

function RenderCal() {
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    document.getElementById("lblCalMeseAnno").innerText = mesi[calDate.getMonth()] + " " + calDate.getFullYear();
    var grid = document.getElementById("gridCalendario"); grid.innerHTML = "";
    
    var table = document.createElement("table"); table.className="cal-table";
    var head = "<tr><th>LU</th><th>MA</th><th>ME</th><th>GI</th><th>VE</th><th class='sat'>SA</th><th class='sun'>DO</th></tr>";
    table.innerHTML = head;

    var first = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();
    if(first===0) first=7;
    var last = new Date(calDate.getFullYear(), calDate.getMonth()+1, 0).getDate();
    
    var currentTxtVal = document.getElementById(targetId).value;
    var today = new Date();
    
    var r, c, d=1;
    for(r=0; r<6; r++) {
        var tr = document.createElement("tr");
        for(c=1; c<=7; c++) {
            var td = document.createElement("td");
            if((r*7+c) >= first && d <= last) {
                var btn = document.createElement("button"); 
                btn.className="calendar-day-btn"; 
                btn.innerText = d;
                
                // Colorazione Sabato/Domenica o FESTIVITÀ
                var festivo = isFestivoIT(d, calDate.getMonth() + 1, calDate.getFullYear());
                if(c===6) btn.className += " sat";
                if(c===7 || festivo) btn.className += " sun";
                
                // Evidenziazione OGGI (Blu)
                if(d === today.getDate() && calDate.getMonth() === today.getMonth() && calDate.getFullYear() === today.getFullYear()) {
                    btn.className += " today";
                }
                
                // Evidenziazione SELEZIONATO (Arancione)
                var checkDate = (d<10?'0':'')+d + "/" + ((calDate.getMonth()+1)<10?'0':'')+(calDate.getMonth()+1) + "/" + calDate.getFullYear();
                if(checkDate === currentTxtVal) {
                    btn.className += " selected";
                }

                btn.onclick = (function(valD, isF, isSun){ return function(){
                    if(isSun || isF) {
                        alert("ATTENZIONE: La data selezionata è un giorno FESTIVO.\nNon è possibile fissare appuntamenti in questa data.");
                        return;
                    }
                    var dd = (valD<10?'0':'')+valD;
                    var mm = ((calDate.getMonth()+1)<10?'0':'')+(calDate.getMonth()+1);
                    document.getElementById(targetId).value = dd + "/" + mm + "/" + calDate.getFullYear();
                    document.getElementById("calendarOverlay").style.display="none";
                }; })(d, festivo, (c===7));
                td.appendChild(btn); d++;
            }
            tr.appendChild(td);
        }
        table.appendChild(tr); if(d>last) break;
    }
    grid.appendChild(table);
}

// ==========================================
// GESTIONE FILTRI RAPIDI UI
// ==========================================
function SetSmartFilter(tipo) {
    currentQuickFilter = tipo;
    
    // Aggiorna stato 'active' visivo sui pulsanti
    var btns = document.querySelectorAll(".quick-filter-btn");
    for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].className.replace(" active", "");
    }
    
    var target = document.getElementById("filterBtn_" + tipo);
    if (target) {
        target.className += " active";
    }
    
    // Riesegue la lista senza ricaricare forzatamente dal DB, usando lo stesso metodo CaricaLista!
    // (Nota: CaricaLista() rifà la query SQL che va bene per refresh ma il filtraggio scatta lato JS istantaneamente)
    CaricaLista();
}

// ==========================================
// CONVERSIONE IN CONSEGNA AVANZATA
// ==========================================
function ApriStreetView() {
    var addr = document.getElementById("txtIndirizzo").value.trim();
    var city = document.getElementById("txtLocalita").value.trim();
    var nomeCl = document.getElementById("cmbCliente").value.trim() || "Cliente";
    
    if (addr === "" || addr.toLowerCase() === "n.d.") { 
        alert("Attenzione: Indirizzo Cliente non specificato.");
        return; 
    }
    
    var fullQuery = addr + (city ? ", " + city : "");
    
    // Crea overlay visivo di attesa
    var loader = document.createElement("div");
    loader.id = "mapLoaderTemp";
    loader.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15, 23, 42, 0.7); display:flex; align-items:center; justify-content:center; z-index:999999; color:white; font-family:'Inter',sans-serif; font-size:18px; font-weight:600;";
    loader.innerHTML = "<div style='background:#1e293b; padding:25px 45px; border-radius:16px; box-shadow:0 15px 40px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); text-align:center;'><i class='fa fa-spinner fa-spin' style='font-size:32px; color:#3b82f6; margin-bottom:15px; display:block;'></i>Elaborazione Percorso Stradale...</div>";
    document.body.appendChild(loader);

    var nominatimUrl = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(fullQuery + ", Italia");
    
    ExecuteSafeGet(nominatimUrl, function(res) {
        var removeLoader = function() { 
            var l = document.getElementById("mapLoaderTemp"); 
            if(l && l.parentNode) l.parentNode.removeChild(l); 
        };
        
        if (res && res.length > 0) {
            removeLoader();
            LaunchRoutingModule(nomeCl, fullQuery, parseFloat(res[0].lat), parseFloat(res[0].lon), false);
        } else {
            // Tenta Fallback solo città se la query completa ha fallito
            if(city && city.length > 1) {
                var fallUrl = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(city + ", Italia");
                setTimeout(function(){
                    ExecuteSafeGet(fallUrl, function(resFall) {
                        removeLoader();
                        if(resFall && resFall.length > 0) {
                            LaunchRoutingModule(nomeCl, fullQuery, parseFloat(resFall[0].lat), parseFloat(resFall[0].lon), true);
                        } else {
                            alert("Geolocalizzazione Fallita: L'indirizzo non è stato rintracciato sul mappamondo.");
                        }
                    });
                }, 500); // Piccolo break per Nominatim quota limit
            } else {
                removeLoader();
                alert("Impossibile rintracciare l'indirizzo sulla mappa (Dati insufficienti).");
            }
        }
    });
}

function LaunchRoutingModule(name, address, destLat, destLon, isApprox) {
    try {
        // DEFINIZIONE TRAMA DI ROTTA: [PARTENZA FISSA] -> [DESTINAZIONE CLIENTE]
        var exportData = [
            {
                name: "PARTENZA (VIA MONTE GRAPPA 128)",
                address: "Via Monte Grappa 128, Bari",
                lat: 41.1086,
                lon: 16.8719,
                isPartenza: true,
                isApproximate: false
            },
            {
                name: name.toUpperCase(),
                address: address,
                lat: destLat,
                lon: destLon,
                isPartenza: false,
                isApproximate: isApprox
            }
        ];
        
        var sysDir = fso.BuildPath(currentDir, "system");
        if(!fso.FolderExists(sysDir)) fso.CreateFolder(sysDir);
        
        var bridgePath = fso.BuildPath(sysDir, "temp_optimized_route.json");
        var f = fso.CreateTextFile(bridgePath, true);
        
        // Serializzatore JSON custom leggero e robusto
        var jsonStr = "[";
        for (var j = 0; j < exportData.length; j++) {
            var o = exportData[j];
            jsonStr += '{"name":"' + String(o.name || "").replace(/"/g,'\\"') + '",';
            jsonStr += '"address":"' + String(o.address || "").replace(/"/g,'\\"') + '",';
            jsonStr += '"lat":' + (o.lat || "null") + ',';
            jsonStr += '"lon":' + (o.lon || "null") + ',';
            jsonStr += '"isPartenza":' + o.isPartenza + ',';
            jsonStr += '"isApproximate":' + o.isApproximate + '}';
            if (j < exportData.length - 1) jsonStr += ",";
        }
        jsonStr += "]";
        
        f.Write(jsonStr);
        f.Close();
        
        // Lancio della finestra HTA dedicato al tracciamento stradale
        var targetApp = fso.BuildPath(currentDir, "mappa_percorso.html");
        shell.Run('mshta.exe "' + targetApp + '"', 1, false);
        
    } catch(ex) {
        alert("Errore irreversibile nel lancio del modulo navigazione: " + ex.message);
    }
}

function ExecuteSafeGet(url, doneCb) {
    var xhr = null;
    try { 
        xhr = new ActiveXObject("MSXML2.ServerXMLHTTP"); 
    } catch(e) { 
        try { xhr = new ActiveXObject("MSXML2.XMLHTTP"); } catch(e2) {} 
    }
    if (!xhr) { alert("Configurazione di rete locale non supporta richieste HTTP attive."); return; }

    xhr.open("GET", url, true);
    try {
        xhr.setRequestHeader("User-Agent", "SistemaLogisticaMilella/2.1-Mapping");
    } catch(e) {}
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            var out = [];
            if (xhr.status === 200) {
                try { out = JSON.parse(xhr.responseText); } catch(ex) {}
            }
            doneCb(out);
        }
    };
    xhr.send();
}

function InviaWhatsApp() {
    var tel = document.getElementById("txtTelefono").value.trim();
    if (tel === "" || tel.toLowerCase() === "n.d.") { alert("Telefono non presente!"); return; }
    
    var cl = document.getElementById("cmbCliente").value.trim() || "Cliente";
    var dt = document.getElementById("txtData").value;
    var ora = document.getElementById("cmbOra").value;
    var ind = document.getElementById("txtIndirizzo").value.trim();
    
    var msgIndirizzo = ind !== "" ? " presso *" + ind + "*" : "";
    
    // Messaggio template aziendale cortese
    var testo = "Gentile *" + cl + "*, le confermiamo l'appuntamento previsto per il giorno *" + dt + "* alle ore *" + ora + "*" + msgIndirizzo + ". \nCordiali saluti, _Logistica C. Milella_";
    
    var cleanTel = tel.replace(/[^0-9]/g, "");
    // Se non c'è prefisso internazionale, aggiungi 39 italiano
    if(cleanTel.length === 10) cleanTel = "39" + cleanTel;
    
    var url = "https://wa.me/" + cleanTel + "?text=" + encodeURIComponent(testo);
    shell.Run(url);
}

// ==========================================
// PDF ENGINE
// ==========================================
function StampaPromemoriaPDF() {
    if(currentID === "NEW") { alert("Seleziona un promemoria."); return; }
    try {
        var xl = new ActiveXObject("Excel.Application");
        var wb = xl.Workbooks.Add();
        var ws = wb.Sheets(1);
        ws.Cells(1,1).Value = "PROMEMORIA APPUNTAMENTO";
        ws.Cells(1,1).Font.Bold = true; ws.Cells(1,1).Font.Size = 16;
        ws.Cells(3,1).Value = "CLIENTE:"; ws.Cells(3,2).Value = document.getElementById("cmbCliente").value;
        ws.Cells(4,1).Value = "INDIRIZZO:"; ws.Cells(4,2).Value = document.getElementById("txtIndirizzo").value;
        ws.Cells(5,1).Value = "LOCALITÀ:"; ws.Cells(5,2).Value = document.getElementById("txtLocalita").value;
        ws.Cells(7,1).Value = "DATA:"; ws.Cells(7,2).Value = document.getElementById("txtData").value;
        ws.Cells(7,3).Value = "ORA:"; ws.Cells(7,4).Value = document.getElementById("cmbOra").value;
        ws.Cells(9,1).Value = "NOTE:"; ws.Cells(10,1).Value = document.getElementById("txtNote").value;
        ws.Cells(10,1).WrapText = true;
        var p = fso.BuildPath(currentDir, "Promemoria_" + currentID + ".pdf");
        ws.ExportAsFixedFormat(0, p);
        wb.Close(false); xl.Quit();
        shell.Run('explorer.exe "' + p + '"');
    } catch(e) { alert("Errore PDF: " + e.message); }
}

function StampaAgendaCompletaPDF() {
    try {
        var xl = new ActiveXObject("Excel.Application");
        var wb = xl.Workbooks.Add();
        var ws = wb.Sheets(1);
        ws.Cells(1,1).Value = "AGENDA COMPLETA PROMEMORIA";
        ws.Range("A1:D1").Merge();
        ws.Range("A1").Font.Size = 16;
        ws.Range("A1").Font.Bold = true;
        ws.Range("A1").HorizontalAlignment = -4108; // xlCenter
        
        ws.Cells(2,1).Value = "Data"; ws.Cells(2,2).Value = "Ora"; ws.Cells(2,3).Value = "Cliente / Info"; ws.Cells(2,4).Value = "Stato";
        var header = ws.Range("A2:D2");
        header.Font.Bold = true;
        header.Interior.Color = 14277081; // Light gray
        
        ws.Columns(1).ColumnWidth = 12;
        ws.Columns(2).ColumnWidth = 8;
        ws.Columns(3).ColumnWidth = 45;
        ws.Columns(4).ColumnWidth = 15;
        
        var maxRow = 2;
        for(var i=0; i<arrayPromemoria.length; i++) {
            var r = arrayPromemoria[i];
            var rowIdx = i+3;
            ws.Cells(rowIdx, 1).Value = formatIT(r.DataPromemoria);
            ws.Cells(rowIdx, 2).Value = r.OraPromemoria || "";
            ws.Cells(rowIdx, 3).Value = (r.Cliente || "") + (r.Note ? " - " + r.Note : "");
            ws.Cells(rowIdx, 4).Value = r.Stato || "";
            maxRow = rowIdx;
        }
        
        // Bordi
        ws.Range("A2:D" + maxRow).Borders.LineStyle = 1;
        
        var p = fso.BuildPath(currentDir, "Agenda_Completa.pdf");
        ws.ExportAsFixedFormat(0, p);
        wb.Close(false); xl.Quit();
        shell.Run('explorer.exe "' + p + '"');
    } catch(e) { alert("Errore Agenda: " + e.message); }
}
// ==========================================
// TIME PICKER ENGINE (MODERN STYLE)
// ==========================================
var tempHour = "";
function ApriTimePicker() {
    document.getElementById("timePickerOverlay").style.display = "flex";
    RenderTimePicker();
}

function ChiudiTimePicker() {
    document.getElementById("timePickerOverlay").style.display = "none";
}

function RenderTimePicker() {
    var gOre = document.getElementById("gridOre");
    var gMin = document.getElementById("gridMinuti");
    gOre.innerHTML = "";
    gMin.innerHTML = "";
    
    // Genera Ore (08 - 18)
    for(var h=8; h<=18; h++) {
        var val = (h < 10 ? "0" : "") + h;
        var b = document.createElement("button");
        b.className = "tp-btn";
        b.innerText = val;
        b.onclick = (function(v) { 
            return function() { 
                tempHour = v;
                // Evidenzia selezione
                var btns = gOre.getElementsByClassName("tp-btn");
                for(var i=0; i<btns.length; i++) btns[i].className = "tp-btn";
                this.className = "tp-btn selected";
            };
        })(val);
        gOre.appendChild(b);
    }
    
    // Genera Minuti (da 00 a 55 a intervalli di 5 minuti per abilitare lo scorrimento e l'effetto rullino)
    var mins = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
    for (var i = 0; i < mins.length; i++) {
        var m = mins[i];
        var b = document.createElement("button");
        b.className = "tp-btn";
        b.innerText = m;
        b.onclick = (function(v) {
            return function() {
                if(tempHour === "") { alert("Seleziona prima l'ora!"); return; }
                
                // Evidenzia selezione minuti
                var btns = gMin.getElementsByClassName("tp-btn");
                for(var j=0; j<btns.length; j++) btns[j].className = "tp-btn";
                this.className = "tp-btn selected";
                
                document.getElementById("cmbOra").value = tempHour + ":" + v;
                setTimeout(function() { ChiudiTimePicker(); }, 150); // Piccolo delay per feedback visivo
            };
        })(m);
        gMin.appendChild(b);
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
    isNavigating = true;
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var htaPath = fso.BuildPath(currentDir, modulo);
        
        document.title = "CHIUSURA_IN_CORSO";
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
        
        window.close();
    } catch(e) { }
};

// ==========================================
// NUOVE FUNZIONALITÀ (MAGGIO 2026)
// ==========================================

// --- Toggle Sidebar a scomparsa ---
window.ToggleSidebar = function() {
    var panel = document.getElementById("sidePanelDetail");
    var icon = document.getElementById("iconToggleSide");
    if(panel) {
        if(panel.className.indexOf("collapsed") > -1) {
            panel.className = panel.className.replace(" collapsed", "");
            if(icon) icon.className = "fa fa-chevron-right";
        } else {
            panel.className += " collapsed";
            if(icon) icon.className = "fa fa-chevron-left";
        }
    }
};

// --- Mappa Anteprima (Iframe OSM statica) ---
window.UpdateMapPreview = function() {
    var ind = document.getElementById("txtIndirizzo").value.trim();
    var loc = document.getElementById("txtLocalita").value.trim();
    var container = document.getElementById("mapPreviewContainer");
    var iframe = document.getElementById("mapPreviewFrame");
    
    if (container && iframe) {
        if (ind !== "" && ind.toLowerCase() !== "n.d.") {
            var html = "<div style='width:100%; height:120px; border-radius:8px; background:linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #cbd5e1; cursor:pointer; transition:all 0.2s;' onclick='ApriStreetView()' onmouseover='this.style.background=\"#e0e7ff\"; this.style.borderColor=\"#818cf8\"' onmouseout='this.style.background=\"linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)\"; this.style.borderColor=\"#cbd5e1\"'>";
            html += "<i class='fa fa-map-marker' style='font-size:32px; color:#3b82f6; margin-bottom:10px;'></i>";
            html += "<span style='font-family:\"Inter\", sans-serif; font-size:13px; font-weight:700; color:#475569;'>Apri Mappa Esterna</span>";
            html += "</div>";
            container.innerHTML = html;
            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
    }
};

// --- Context Menu: Cambia Stato ---
window.contextRecordId = null;
window.SetStatoDaContext = function(nuovoStato) {
    if(window.contextRecordId) {
        if(execDB("UPDATE tblPromemoria SET [Stato]='" + nuovoStato + "' WHERE ID=" + window.contextRecordId)) {
            CaricaLista();
        }
    }
    var cm = document.getElementById("contextMenu");
    if(cm) cm.style.display = "none";
};

// Chiudi menu/tooltip se si clicca fuori
document.addEventListener("click", function() {
    var cm = document.getElementById("contextMenu");
    if(cm) cm.style.display = "none";
});

// --- Timeline View ---
var timelineDate = new Date();

window.ChangeTimelineDay = function(offset) {
    timelineDate.setDate(timelineDate.getDate() + offset);
    RenderTimelineGrid();
};

window.UpdateNowLine = function() {
    var line = document.getElementById("timelineNowLine");
    var grid = document.getElementById("timelineGrid");
    if (!grid || currentView !== "timeline") return;

    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    
    // Mostra la linea solo se siamo nell'intervallo 08:00 - 20:00
    if (h < 8 || h >= 20) {
        if(line) line.style.display = "none";
        return;
    }
    
    if (!line) {
        line = document.createElement("div");
        line.id = "timelineNowLine";
        line.className = "timeline-now-line";
        grid.appendChild(line);
    }
    line.style.display = "block";
    
    // Calcolo posizione: ogni ora è 70px + 20px di padding iniziale del contenitore
    var rowHeight = 70; 
    var topPos = ((h - 8) * rowHeight) + (m * (rowHeight / 60)) + 20;
    line.style.top = topPos + "px";
};

window.TimelineDragOver = function(ev) { 
    ev.preventDefault(); 
    if(ev.currentTarget.className.indexOf("drag-over") === -1) ev.currentTarget.className += " drag-over"; 
};
window.TimelineDragLeave = function(ev) { 
    ev.currentTarget.className = ev.currentTarget.className.replace(" drag-over", ""); 
};
window.TimelineDrop = function(ev, targetDateStr, hourStr) {
    ev.preventDefault();
    ev.currentTarget.className = ev.currentTarget.className.replace(" drag-over", "");
    var id = ev.dataTransfer.getData("Text");
    if(id && execDB("UPDATE tblPromemoria SET DataPromemoria='" + targetDateStr.split('/').reverse().join('-') + "', OraPromemoria='" + hourStr + "' WHERE ID=" + id)) {
        CaricaLista();
        ShowToast("SPOSTAMENTO", "Appuntamento ID " + id + " spostato alle " + hourStr);
    }
};

window.RenderTimelineGrid = function() {
    var lbl = document.getElementById("lblTimelineDate");
    if(!lbl) return;
    
    var g = (timelineDate.getDate()<10?'0':'')+timelineDate.getDate();
    var m = ((timelineDate.getMonth()+1)<10?'0':'')+(timelineDate.getMonth()+1);
    var targetDateStr = g + "/" + m + "/" + timelineDate.getFullYear();
    
    var oggi = new Date();
    var oggiStr = (oggi.getDate()<10?'0':'')+oggi.getDate() + "/" + ((oggi.getMonth()+1)<10?'0':'')+(oggi.getMonth()+1) + "/" + oggi.getFullYear();
    
    lbl.innerText = (targetDateStr === oggiStr) ? "Oggi (" + targetDateStr + ")" : targetDateStr;
    
    var grid = document.getElementById("timelineGrid");
    if(!grid) return;
    grid.innerHTML = "";
    
    // Raggruppa eventi per ora per rilevare conflitti
    var hourMap = {};
    for (var k = 0; k < arrayPromemoria.length; k++) {
        var prom = arrayPromemoria[k];
        if (prom.DataIT === targetDateStr && prom.OraPromemoria) {
            var hr = parseInt(prom.OraPromemoria.split(":")[0], 10);
            if(!hourMap[hr]) hourMap[hr] = [];
            hourMap[hr].push(prom);
        }
    }

    for (var h = 8; h <= 20; h++) {
        var row = document.createElement("div");
        row.className = "timeline-row";
        
        var hStr = (h < 10 ? "0" : "") + h + ":00";
        if (hourMap[h] && hourMap[h].length > 1) {
            row.className += " conflict";
            row.title = "ATTENZIONE: Conflitto di orario! Ci sono " + hourMap[h].length + " impegni.";
        }

        // --- DRAG & DROP SULLA RIGA ---
        row.ondragover = function(ev){ TimelineDragOver(ev); };
        row.ondragleave = function(ev){ TimelineDragLeave(ev); };
        row.ondrop = (function(d, hs){ return function(ev){ TimelineDrop(ev, d, hs); }; })(targetDateStr, hStr);
        // --- CLICK PER AGGIUNGERE E SELEZIONARE ---
        row.onclick = (function(d, hs, rEl){
            return function(ev) {
                // Rimuovi selezione da tutte le altre righe
                var allRows = document.querySelectorAll(".timeline-row");
                for(var x=0; x<allRows.length; x++) allRows[x].className = allRows[x].className.replace(" selected", "");
                // Aggiungi selezione a questa riga
                rEl.className += " selected";

                if(ev.target.className.indexOf("timeline-row") === -1 && ev.target.className.indexOf("timeline-events") === -1) return;
                Nuovo();
                document.getElementById("txtData").value = d;
                document.getElementById("cmbOra").value = hs;
                ShowToast("INSERIMENTO", "Aggiunta appuntamento alle ore " + hs);
            };
        })(targetDateStr, hStr, row);

        var timeCol = document.createElement("div");
        timeCol.className = "timeline-time";
        timeCol.innerText = hStr;
        
        var evCol = document.createElement("div");
        evCol.className = "timeline-events";
        
        var eventsAtHour = hourMap[h] || [];
        for (var e = 0; e < eventsAtHour.length; e++) {
            var promObj = eventsAtHour[e];
            var pDiv = document.createElement("div");
            pDiv.className = "cal-event-badge";
            
            // Drag and Drop Badge
            pDiv.draggable = true;
            pDiv.ondragstart = (function(id){ return function(ev){ ev.dataTransfer.setData("Text", String(id)); }; })(promObj.ID);

            var stat = String(promObj.Stato || "").toLowerCase();
            var tip = String(promObj.Tipologia || "").toLowerCase();
            
            if (stat.indexOf("completa") > -1) pDiv.className += " state-completato";
            else if (stat.indexOf("annulla") > -1) pDiv.className += " state-annullato";
            else {
                pDiv.className += " state-attesa";
                if (tip.indexOf("commerciale") > -1) pDiv.className += " state-commerciale";
                else if (tip.indexOf("tecnico") > -1) pDiv.className += " state-tecnico";
                else if (tip.indexOf("consegna") > -1) pDiv.className += " state-consegna";
            }
            
            var text = (promObj.OraPromemoria || "") + " - " + (promObj.Cliente || "Appunto");
            if(promObj.AssegnatoA) text += " [" + promObj.AssegnatoA.substring(0,8) + "]";
            pDiv.innerHTML = text + GetHoverActions(promObj);
            
            // RILEVAMENTO CONFLITTI: Se più di un evento alla stessa ora
            if(eventsAtHour.length > 1) {
                pDiv.className += " conflict-item";
                pDiv.innerHTML += '<div class="conflict-icon" title="CONFLITTO: Altri impegni pianificati per questa ora!"><i class="fa fa-exclamation-triangle"></i></div>';
            }
            
            // PILLOLA FUNZIONALITÀ: QUICK-VIEW TOOLTIP
            pDiv.title = "ID: " + promObj.ID + "\nCLIENTE: " + (promObj.Cliente || "-") + "\n" +
                         "TIPO: " + (promObj.Tipologia || "-") + "\n" +
                         "NOTE: " + (promObj.Note || "Nessuna nota.");
            
            pDiv.onclick = (function(record) {
                return function(ev) { 
                    var target = ev.target || ev.srcElement;
                    var isAction = false;
                    var curr = target;
                    while(curr && curr !== this) {
                        if(curr.className && (curr.className.indexOf('hover-actions') > -1 || curr.className.indexOf('hover-btn') > -1)) {
                            isAction = true;
                            break;
                        }
                        curr = curr.parentNode;
                    }
                    if(isAction) return; 
                    
                    if(ev) ev.stopPropagation(); 
                    CaricaDettaglio(record); 
                };
            })(promObj);
            
            evCol.appendChild(pDiv);
        }
        
        row.appendChild(timeCol);
        row.appendChild(evCol);
        grid.appendChild(row);
    }
    
    if (targetDateStr === oggiStr) {
        UpdateNowLine();
        setTimeout(ScrollTimelineToNow, 500); // Ritardo per permettere il rendering
    }
    
    // --- POPOLAMENTO SIDEBAR PIANIFICAZIONE ---
    var sidebar = document.getElementById("timelinePendingList");
    if(sidebar) {
        sidebar.innerHTML = "";
        // Filtriamo quelli "In attesa" o senza ora, ordinandoli per data creazione (i più vecchi prima)
        var pending = [];
        for(var z=0; z<arrayPromemoria.length; z++) {
            var p = arrayPromemoria[z];
            if(!p.OraPromemoria || p.OraPromemoria === "" || String(p.Stato).toLowerCase().indexOf("attesa") > -1) {
                pending.push(p);
            }
        }
        
        for(var j=0; j<pending.length; j++) {
            var item = pending[j];
            var div = document.createElement("div");
            div.className = "sidebar-item";
            div.draggable = true;
            div.ondragstart = (function(id){ return function(ev){ ev.dataTransfer.setData("Text", String(id)); }; })(item.ID);
            
            div.innerHTML = '<span class="cli">' + (item.Cliente || "Senza Nome") + '</span>' +
                            '<span class="tip">' + (item.Tipologia || "Generico") + '</span>';
            
            div.onclick = (function(rec){ return function(){ CaricaDettaglio(rec); }; })(item);
            sidebar.appendChild(div);
        }
    }
};

var currentView = "postit";
if (document.location.href.indexOf("view=table") > -1) {
    currentView = "table";
} else if (document.location.href.indexOf("view=calendar") > -1) {
    currentView = "calendar";
}

window.SwitchView = function(mode) {
    currentView = mode;
    var btnTab = document.getElementById("btnViewTable");
    var btnPost = document.getElementById("btnViewPostit");
    var btnCal = document.getElementById("btnViewCalendar");
    var btnTime = document.getElementById("btnViewTimeline");
    
    var tabView = document.getElementById("tableView");
    var postView = document.getElementById("postitView");
    var calView = document.getElementById("calendarView");
    var timeView = document.getElementById("timelineView");
    var kanbanView = document.getElementById("kanbanView");
    
    if (btnTab) btnTab.className = "view-toggle-btn" + (mode === "table" ? " active" : "");
    if (btnPost) btnPost.className = "view-toggle-btn" + (mode === "postit" ? " active" : "");
    if (btnCal) btnCal.className = "view-toggle-btn" + (mode === "calendar" ? " active" : "");
    if (btnTime) btnTime.className = "view-toggle-btn" + (mode === "timeline" ? " active" : "");
    
    if (tabView) tabView.style.display = (mode === "table" ? "block" : "none");
    if (postView) postView.style.display = (mode === "postit" ? "block" : "none");
    if (calView) calView.style.display = (mode === "calendar" ? "block" : "none");
    if (timeView) timeView.style.display = (mode === "timeline" ? "flex" : "none");
    if (kanbanView) kanbanView.style.display = (mode === "kanban" ? "flex" : "none");
    
    if (mode === "calendar") {
        RenderCalendarioGrid();
    } else if (mode === "timeline") {
        RenderTimelineGrid();
    } else if (mode === "kanban") {
        DisegnaVistaKanban();
    }
};

window.ActionStatoPostit = function(id, nuovoStato, event) {
    if (event) {
        if (event.stopPropagation) event.stopPropagation();
        else event.cancelBubble = true;
    }
    
    var sql = "UPDATE tblPromemoria SET [Stato]='" + nuovoStato + "' WHERE ID=" + id;
    var res = execDB(sql);
    if(res) {
        CaricaLista();
    }
};

var currentDateCal = new Date();

window.ChangeMonth = function(offset) {
    currentDateCal.setMonth(currentDateCal.getMonth() + offset);
    RenderCalendarioGrid();
};

// --- LOGICA SELETTORE MESE (VIGNETTA PRO) PER CALENDARIO ---
var calPickerYear = new Date().getFullYear();

window.ShowMonthPicker = function() {
    var year = currentDateCal.getFullYear();
    calPickerYear = year; // Sincronizza all'anno corrente del calendario
    var titleEl = document.getElementById("pickerYearTitle");
    if(titleEl) titleEl.innerText = calPickerYear;
    
    var grid = document.getElementById("monthGrid");
    if(!grid) return;
    grid.innerHTML = "";
    
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    var selMeseIdx = currentDateCal.getMonth();
    
    for (var i = 0; i < mesi.length; i++) {
        var mNome = mesi[i];
        var btn = document.createElement("button");
        btn.className = "menu-month-btn";
        if (i === selMeseIdx) btn.className += " selected";
        
        btn.innerText = mNome;
        btn.onclick = (function(idx) { 
            return function() { window.SwitchToMonthYear(idx, calPickerYear); }; 
        })(i);
        grid.appendChild(btn);
    }
    
    var overlay = document.getElementById("monthPickerOverlay");
    if(overlay) overlay.style.display = "flex";
};

window.ChangeYearPicker = function(dir) {
    calPickerYear += dir;
    var titleEl = document.getElementById("pickerYearTitle");
    if(titleEl) titleEl.innerText = calPickerYear;
    
    var grid = document.getElementById("monthGrid");
    if(!grid) return;
    grid.innerHTML = "";
    
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    var selMeseIdx = currentDateCal.getMonth();
    
    for (var i = 0; i < mesi.length; i++) {
        var mNome = mesi[i];
        var btn = document.createElement("button");
        btn.className = "menu-month-btn";
        // Evidenzia solo se siamo nello stesso anno selezionato e lo stesso mese
        if (i === selMeseIdx && calPickerYear === currentDateCal.getFullYear()) {
            btn.className += " selected";
        }
        
        btn.innerText = mNome;
        btn.onclick = (function(idx) { 
            return function() { window.SwitchToMonthYear(idx, calPickerYear); }; 
        })(i);
        grid.appendChild(btn);
    }
};

window.CloseMonthPicker = function() {
    var overlay = document.getElementById("monthPickerOverlay");
    if(overlay) overlay.style.display = "none";
};

window.SwitchToMonthYear = function(mIdx, year) {
    currentDateCal.setFullYear(year);
    currentDateCal.setMonth(mIdx);
    RenderCalendarioGrid();
    CloseMonthPicker();
};

window.RenderCalendarioGrid = function() {
    var today = new Date();
    var g = (today.getDate()<10?'0':'')+today.getDate();
    var m = ((today.getMonth()+1)<10?'0':'')+(today.getMonth()+1);
    var oggiIT = g + "/" + m + "/" + today.getFullYear();

    var grid = document.getElementById("calendarDaysGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    // Recupera conteggio consegne da tblConsegne per tutto il mese/anno corrente
    var deliveryCounts = {};
    try {
        var rsConsegne = queryDB("SELECT DataConsegna, COUNT(*) AS Tot FROM tblConsegne WHERE DataConsegna IS NOT NULL GROUP BY DataConsegna");
        if (rsConsegne && rsConsegne.length > 0) {
            for (var c = 0; c < rsConsegne.length; c++) {
                var row = rsConsegne[c];
                if (row.DataConsegna) {
                    var dbVal = String(row.DataConsegna).trim();
                    var dStr = "";
                    
                    var mISO = dbVal.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
                    if (mISO) {
                        var rg = mISO[3]; if(rg.length < 2) rg = "0" + rg;
                        var rm = mISO[2]; if(rm.length < 2) rm = "0" + rm;
                        dStr = rg + "/" + rm + "/" + mISO[1];
                    } else {
                        var mIT = dbVal.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
                        if (mIT) {
                            var rg2 = mIT[1]; if(rg2.length < 2) rg2 = "0" + rg2;
                            var rm2 = mIT[2]; if(rm2.length < 2) rm2 = "0" + rm2;
                            dStr = rg2 + "/" + rm2 + "/" + mIT[3];
                        } else {
                            dStr = dbVal.substring(0, 10);
                        }
                    }
                    
                    if (dStr !== "") {
                        deliveryCounts[dStr] = (deliveryCounts[dStr] || 0) + (row.Tot || 0);
                    }
                }
            }
        }
    } catch(errD) {}
    
    var year = currentDateCal.getFullYear();
    var month = currentDateCal.getMonth();
    
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    var lblMonth = document.getElementById("lblCalendarMonth");
    if (lblMonth) lblMonth.innerText = mesi[month] + " " + year;
    
    var firstDay = new Date(year, month, 1);
    var startDayOfWeek = firstDay.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Lunedì come inizio settimana
    
    var totalDays = new Date(year, month + 1, 0).getDate();
    var prevMonthTotalDays = new Date(year, month, 0).getDate();
    
    // Giorni vuoti del mese precedente
    for (var i = startDayOfWeek - 1; i > 0; i--) {
        var dayNum = prevMonthTotalDays - i + 1;
        var cell = document.createElement("div");
        cell.className = "cal-day-cell empty";
        
        var numDiv = document.createElement("div");
        numDiv.className = "cal-day-number";
        numDiv.innerText = dayNum;
        cell.appendChild(numDiv);
        
        grid.appendChild(cell);
    }
    
    // Giorni del mese corrente
    for (var day = 1; day <= totalDays; day++) {
        var cell = document.createElement("div");
        cell.className = "cal-day-cell";
        
        // Classificazione fine del fine settimana e festività italiane
        var currentDayObj = new Date(year, month, day);
        var dayOfWeek = currentDayObj.getDay(); // 0=Dom, 6=Sab
        if (dayOfWeek === 6) {
            cell.className += " saturday";
        } else if (dayOfWeek === 0) {
            cell.className += " sunday";
        }
        
        if (isItalianHoliday(day, month, year)) {
            cell.className += " holiday";
        }
        
        // Oggi
        var oggi = new Date();
        if (day === oggi.getDate() && month === oggi.getMonth() && year === oggi.getFullYear()) {
            cell.className += " today";
        }
        
        var currentDayStr = (day < 10 ? "0" : "") + day;
        var currentMonthStr = ((month + 1) < 10 ? "0" : "") + (month + 1);
        var targetDateStr = currentDayStr + "/" + currentMonthStr + "/" + year;
        
        // Numero giorno con Meteo
        var numDiv = document.createElement("div");
        numDiv.className = "cal-day-number";
        var meteoHTML = "";
        if(window.WeatherForecast && window.WeatherForecast[targetDateStr]) {
            var wf = window.WeatherForecast[targetDateStr];
            meteoHTML = "<span style='float:right; font-size:12px; margin-left:5px;' title='Previsti " + wf.maxTemp + "°C'>" + wf.icon + "</span>";
        }
        numDiv.innerHTML = day + meteoHTML;
        cell.appendChild(numDiv);
        
        var listContainer = document.createElement("div");
        listContainer.style.display = "flex";
        listContainer.style.flexDirection = "column";
        listContainer.style.gap = "2px";
        listContainer.style.flex = "1";
        
        // Badge Consegne Logistica
        var totConsegne = deliveryCounts[targetDateStr] || 0;
        if (totConsegne > 0) {
            var dBadge = document.createElement("div");
            dBadge.className = "cal-delivery-badge";
            dBadge.innerText = "🚚 " + totConsegne + (totConsegne === 1 ? " Consegna" : " Consegne");
            
            dBadge.onmouseover = (function(cnt) {
                return function(ev) {
                    var tt = document.getElementById("customTooltip");
                    if(!tt) return;
                    tt.innerHTML = "<strong>🚚 Logistica Attiva</strong>Ci sono <b>" + cnt + "</b> consegne programmate.<br/><i>Clicca per gestire il giro.</i>";
                    tt.style.display = "block";
                    tt.style.left = (ev.pageX + 15) + "px";
                    tt.style.top = (ev.pageY + 15) + "px";
                };
            })(totConsegne);
            dBadge.onmousemove = function(ev) {
                var tt = document.getElementById("customTooltip");
                if(tt) { tt.style.left = (ev.pageX + 15) + "px"; tt.style.top = (ev.pageY + 15) + "px"; }
            };
            dBadge.onmouseout = function() {
                var tt = document.getElementById("customTooltip");
                if(tt) tt.style.display = "none";
            };
            
            dBadge.unselectable = "on";
            dBadge.style.userSelect = "none";
            dBadge.onselectstart = function() { return false; };
            
            dBadge.onclick = (function(dStr) {
                return function(ev) {
                    if (ev) {
                        if (ev.stopPropagation) ev.stopPropagation();
                        else ev.cancelBubble = true;
                    }
                    ApriConsegneDaCalendario(dStr);
                };
            })(targetDateStr);
            listContainer.appendChild(dBadge);
            
            // Icona Condivisione WhatsApp per Autisti
            var waShare = document.createElement("a");
            waShare.className = "cal-wa-share";
            waShare.innerHTML = "💬 WhatsApp";
            waShare.title = "Invia riepilogo su WhatsApp Web";
            waShare.style.cssText = "display:none; position:absolute; bottom:5px; right:5px; font-size:10px; background:#25d366; color:white; padding:4px 8px; border-radius:12px; cursor:pointer; font-weight:bold; box-shadow:0 2px 6px rgba(0,0,0,0.3); z-index:50;";
            waShare.onclick = (function(ds, tc) {
                return function(ev) {
                    if(ev.stopPropagation) ev.stopPropagation();
                    else ev.cancelBubble = true;
                    var testoMsg = encodeURIComponent("🚚 *CONSEGNE DEL " + ds + "*\n\nHai " + tc + " consegne programmate per questa giornata. Controlla il gestionale per i dettagli del giro.");
                    window.open("https://web.whatsapp.com/send?text=" + testoMsg, "_blank");
                };
            })(targetDateStr, totConsegne);
            
            cell.onmouseenter = function() { waShare.style.display = "block"; };
            cell.onmouseleave = function() { waShare.style.display = "none"; };
            cell.appendChild(waShare);
        }
        
        for (var k = 0; k < arrayPromemoria.length; k++) {
            var promObj = arrayPromemoria[k];
            if (promObj.DataIT === targetDateStr) {
                var pDiv = document.createElement("div");
                pDiv.className = "cal-event-badge";
                
                var stat = String(promObj.Stato || "").toLowerCase();
                var tip = String(promObj.Tipologia || "").toLowerCase();
                
                if (stat.indexOf("completa") > -1) {
                    pDiv.className += " state-completato";
                } else if (stat.indexOf("annulla") > -1) {
                    pDiv.className += " state-annullato";
                } else {
                    pDiv.className += " state-attesa";
                    // Applica Color Coding in base alla tipologia se in attesa
                    if (tip.indexOf("commerciale") > -1) pDiv.className += " state-commerciale";
                    else if (tip.indexOf("tecnico") > -1) pDiv.className += " state-tecnico";
                    else if (tip.indexOf("consegna") > -1) pDiv.className += " state-consegna";
                }
                
                pDiv.innerText = (promObj.OraPromemoria || "Attesa") + " - " + (promObj.Cliente || "Appunto");
                
                // LOGICA URGENZA CALENDARIO
                var now = new Date();
                var currOra = (now.getHours()<10?'0':'')+now.getHours() + ":" + (now.getMinutes()<10?'0':'')+now.getMinutes();
                if (stat.indexOf("attesa") > -1 && promObj.DataIT === oggiIT && promObj.OraPromemoria && promObj.OraPromemoria < currOra) {
                    pDiv.className += " pulse-urgente";
                }

                // --- INIZIO LOGICA DRAG & DROP ---
                pDiv.draggable = true;
                pDiv.ondragstart = (function(recordId) {
                    return function(ev) {
                        if(typeof PlaySound !== 'undefined' && PlaySound.Pop) PlaySound.Pop();
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData("Text", String(recordId));
                    };
                })(promObj.ID);
                // --- FINE LOGICA DRAG & DROP ---
                
                // Tooltip events
                pDiv.onmouseover = (function(rec) {
                    return function(ev) {
                        var tt = document.getElementById("customTooltip");
                        if(!tt) return;
                        var tipStr = rec.Tipologia || "Generico";
                        tt.innerHTML = "<strong>" + (rec.Cliente || "Sconosciuto") + "</strong><br/>" +
                                       "📍 " + (rec.Note && rec.Note.length > 5 ? rec.Note.substring(0,30)+"..." : "Nessun dettaglio") + "<br/>" +
                                       "⏰ " + (rec.OraPromemoria || "Attesa") + " - 🏷️ " + tipStr;
                        tt.style.display = "block";
                        tt.style.left = (ev.pageX + 15) + "px";
                        tt.style.top = (ev.pageY + 15) + "px";
                    };
                })(promObj);
                
                pDiv.onmousemove = function(ev) {
                    var tt = document.getElementById("customTooltip");
                    if(tt) { tt.style.left = (ev.pageX + 15) + "px"; tt.style.top = (ev.pageY + 15) + "px"; }
                };
                
                pDiv.onmouseout = function() {
                    var tt = document.getElementById("customTooltip");
                    if(tt) tt.style.display = "none";
                };
                
                // Context Menu
                pDiv.oncontextmenu = (function(rec) {
                    return function(ev) {
                        ev.preventDefault();
                        if (ev.stopPropagation) ev.stopPropagation();
                        else ev.cancelBubble = true;
                        
                        var cm = document.getElementById("contextMenu");
                        if(!cm) return;
                        window.contextRecordId = rec.ID; // Global var per il menu
                        cm.style.display = "block";
                        cm.style.left = ev.pageX + "px";
                        cm.style.top = ev.pageY + "px";
                        
                        // Nascondi tooltip se aperto
                        var tt = document.getElementById("customTooltip");
                        if(tt) tt.style.display = "none";
                    };
                })(promObj);
                
                pDiv.onclick = (function(record, cellEl) {
                    return function(ev) {
                        if (ev) {
                            if (ev.stopPropagation) ev.stopPropagation();
                            else ev.cancelBubble = true;
                        }
                        CaricaDettaglio(record);
                        
                        var cells = document.getElementById("calendarDaysGrid").children;
                        if (cells) {
                            for (var i = 0; i < cells.length; i++) {
                                cells[i].className = cells[i].className.replace(" selected", "");
                            }
                        }
                        cellEl.className += " selected";
                    };
                })(promObj, cell);
                
                listContainer.appendChild(pDiv);
            }
        }
        cell.appendChild(listContainer);
        
        // Eventi Drop per la cella (per ricevere gli appuntamenti)
        cell.ondragenter = function(ev) {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            return false;
        };
        cell.ondragover = function(ev) {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            if(this.className.indexOf("drag-over") === -1) {
                this.className += " drag-over";
            }
            return false;
        };
        cell.ondragleave = function(ev) {
            this.className = this.className.replace(" drag-over", "");
        };
        cell.ondrop = (function(d, m, y, cellEl) {
            return function(ev) {
                ev.preventDefault();
                cellEl.className = cellEl.className.replace(" drag-over", "");
                var recId = ev.dataTransfer.getData("Text");
                if(recId) {
                    recId = recId.trim();
                    if(isNaN(parseInt(recId, 10)) || parseInt(recId, 10).toString() !== recId) {
                        if(recId.indexOf("Consegn") > -1 || recId.indexOf("🚚") > -1) {
                            alert("ATTENZIONE:\nNon è possibile trascinare il badge verde delle Consegne.\nLe consegne vanno spostate singolarmente dalla loro dashboard.");
                        }
                        return; // Ignora drop non validi (es. testo selezionato)
                    }
                    
                    var mm = (m+1)<10 ? '0'+(m+1) : (m+1);
                    var dd = d<10 ? '0'+d : d;
                    var newDateSql = "'" + y + "-" + mm + "-" + dd + "'";
                    
                    var q = "UPDATE tblPromemoria SET DataPromemoria=" + newDateSql + " WHERE ID=" + recId;
                    if(execDB(q)) {
                        if(typeof PlaySound !== 'undefined' && PlaySound.Success) PlaySound.Success();
                        CaricaLista();
                    } else {
                        alert("Errore aggiornamento DB durante il drop.");
                    }
                }
            };
        })(day, month, year, cell);
        
        cell.onclick = (function(d, m, y, cellEl) {
            return function() {
                Nuovo();
                var formattedDate = (d < 10 ? "0" : "") + d + "/" + ((m + 1) < 10 ? "0" : "") + (m + 1) + "/" + y;
                document.getElementById("txtData").value = formattedDate;
                
                var cells = document.getElementById("calendarDaysGrid").children;
                if (cells) {
                    for (var i = 0; i < cells.length; i++) {
                        cells[i].className = cells[i].className.replace(" selected", "");
                    }
                }
                cellEl.className += " selected";
            };
        })(day, month, year, cell);
        
        grid.appendChild(cell);
    }
};

window.getEasterAndPasquetta = function(y) {
    var a = y % 19;
    var b = Math.floor(y / 100);
    var c = y % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Marzo, 4 = Aprile
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    
    // Pasqua
    var pasqua = new Date(y, month - 1, day);
    // Pasquetta (Giorno dopo Pasqua)
    var pasquetta = new Date(y, month - 1, day + 1);
    
    return {
        pasqua: pasqua,
        pasquetta: pasquetta
    };
};

window.isItalianHoliday = function(day, month, year) {
    var m = month + 1; // Converti a 1-indexed (Gennaio = 1)
    
    // Festività nazionali fisse
    if (day === 1 && m === 1) return true;   // Capodanno
    if (day === 6 && m === 1) return true;   // Epifania
    if (day === 25 && m === 4) return true;  // Liberazione
    if (day === 1 && m === 5) return true;   // Festa del Lavoro
    if (day === 8 && m === 5) return true;   // SAN NICOLA (Santo Patrono di Bari!) ❤️
    if (day === 2 && m === 6) return true;   // Festa della Repubblica
    if (day === 15 && m === 8) return true;  // Ferragosto
    if (day === 1 && m === 11) return true;  // Ognissanti
    if (day === 8 && m === 12) return true;  // Immacolata
    if (day === 25 && m === 12) return true; // Natale
    if (day === 26 && m === 12) return true; // Santo Stefano
    
    // Festività nazionali mobili (Pasquetta)
    if (year) {
        var dates = getEasterAndPasquetta(year);
        if (day === dates.pasquetta.getDate() && month === dates.pasquetta.getMonth()) {
            return true;
        }
    }
    
    return false;
};

window.ApriConsegneDaCalendario = function(dateStr) {
    isNavigating = true;
    try {
        var bridgePath = fso.BuildPath(fso.BuildPath(currentDir, "system"), "consegne_date_bridge.tmp");
        var ts = fso.CreateTextFile(bridgePath, true);
        ts.Write(dateStr);
        ts.Close();
        
        var htaPath = fso.BuildPath(currentDir, "consegne.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
        window.close();
    } catch(e) {
        alert("Errore nell'apertura delle Consegne: " + e.message);
        isNavigating = false;
    }
};

window.ActionConvertiInConsegna = function() {
    if(currentID === "NEW") { alert("Attenzione: Salva prima il promemoria corrente per procedere."); return; }
    
    var cl = document.getElementById("cmbCliente").value.trim();
    var dt = document.getElementById("txtData").value.trim();
    if(cl === "" || dt.length !== 10) { alert("Dati cliente o data mancanti. Non è possibile convertire."); return; }
    
    var msg = "Stai per convertire questo promemoria in una CONSEGNA UFFICIALE.\n\nIl record verrà creato nel Registro Logistica.\nProcedere?";
    if(!confirm(msg)) return;
    
    try {
        // Recupero Dati dal Form Promemoria
        var ora = document.getElementById("cmbOra").value;
        var ind = document.getElementById("txtIndirizzo").value;
        var loc = document.getElementById("txtLocalita").value;
        var tel = document.getElementById("txtTelefono").value;
        var prov = document.getElementById("txtProvincia").value || "";
        var note = document.getElementById("txtNote").value;
        
        // Parsing Data per tblConsegne
        var p = dt.split("/");
        var dtSql = "'" + p[2] + "-" + p[1] + "-" + p[0] + "'";
        var mRef = parseInt(p[1], 10);
        var aRef = parseInt(p[2], 10);
        
        // Identifica ID_Cliente (utile per accoppiamenti)
        var idA = "NULL";
        var rsCh = queryDB("SELECT ID FROM tblClienti WHERE CognomeNome='" + sqlEsc(cl) + "'");
        if(rsCh.length > 0) idA = rsCh[0].ID;
        
        // Controllo Cliente Duplicato in stessa Data (Avviso con Scelta)
        var sqlChkCli = "SELECT COUNT(*) as Conta FROM tblConsegne WHERE DataConsegna = " + dtSql + " AND ClienteNome = '" + sqlEsc(cl) + "'";
        var rsCli = queryDB(sqlChkCli);
        if (rsCli.length > 0 && rsCli[0].Conta > 0) {
            if (!confirm("ATTENZIONE: Esiste gi\u00e0 una consegna registrata per il cliente '" + cl + "' in data " + dt + ".\n\nVuoi procedere comunque con la conversione del promemoria in una nuova consegna?")) {
                return;
            }
        }
        
        // SQL INSERT INTO TBLCONSEGNE (Stato di default: Pianificato)
        var sqlCons = "INSERT INTO tblConsegne ([ID_Cliente], [ClienteNome], [Provincia], [LocalitaConsegna], [IndirizzoConsegna], [Telefono], [DataConsegna], [OraConsegna], [Stato], [Note], [Consegnato], [MeseRiferimento], [AnnoRiferimento]) VALUES (" +
                      idA + ", '" + sqlEsc(cl) + "', '" + sqlEsc(prov) + "', '" + sqlEsc(loc) + "', '" + sqlEsc(ind) + "', '" + sqlEsc(tel) + "', " + 
                      dtSql + ", '" + sqlEsc(ora) + "', 'Pianificato', '" + sqlEsc(note) + "', 0, " + mRef + ", " + aRef + ")";
        
        if(execDB(sqlCons)) {
            // Aggiorna lo Stato del Promemoria locale in 'Completato'
            execDB("UPDATE tblPromemoria SET [Stato]='Completato' WHERE ID=" + currentID);
            
            alert("Conversione Riuscita! \n\nVerrai ora trasferito al modulo Gestione Consegne.");
            
            // Sfruttiamo la funzione esistente che scrive il bridge e fa il redirect
            window.ApriConsegneDaCalendario(dt);
        } else {
            alert("Errore critico durante l'inserimento nella tabella consegne.");
        }
    } catch(ex) {
        alert("Si è verificato un errore imprevisto durante la conversione: " + ex.message);
    }
};
// ==========================================
// FUNZIONI CESTINO INTERATTIVO
// ==========================================
window.TrashDragOver = function(ev) {
    ev.preventDefault();
    var tz = document.getElementById("trashZone");
    if(tz) {
        if(tz.className.indexOf("trash-shake") === -1) tz.className += " trash-shake";
        tz.style.background = "#fee2e2";
    }
};

window.TrashDragLeave = function(ev) {
    var tz = document.getElementById("trashZone");
    if(tz) {
        tz.className = tz.className.replace(" trash-shake", "");
        tz.style.background = "#fef2f2";
    }
};

window.TrashDrop = function(ev) {
    ev.preventDefault();
    var tz = document.getElementById("trashZone");
    if(tz) {
        tz.style.transform = "scale(1)";
        tz.style.background = "#fef2f2";
    }
    
    var recId = ev.dataTransfer.getData("Text");
    if(recId) {
        recId = recId.trim();
        if(isNaN(parseInt(recId, 10)) || parseInt(recId, 10).toString() !== recId) {
            if(recId.indexOf("Consegn") > -1 || recId.indexOf("🚚") > -1) {
                alert("Non puoi spostare i badge verdi delle Consegne nel cestino.\nCancella o archivia la singola consegna dalla sua dashboard.");
            }
            return;
        }
        
        var q = "UPDATE tblPromemoria SET Stato='Cestinato' WHERE ID=" + recId;
        if(execDB(q)) {
            CaricaLista();
        } else {
            alert("Errore durante lo spostamento nel cestino.");
        }
    }
};

window.OpenTrashModal = function() {
    var list = document.getElementById("trashList");
    if(!list) return;
    
    var rs = queryDB("SELECT ID, Cliente, DataPromemoria, Note FROM tblPromemoria WHERE Stato='Cestinato' ORDER BY ID DESC");
    list.innerHTML = "";
    if(rs.length === 0) {
        list.innerHTML = "<div style='padding:20px; text-align:center; color:#94a3b8;'>Il cestino è vuoto.</div>";
    } else {
        for(var i=0; i<rs.length; i++) {
            var r = rs[i];
            var div = document.createElement("div");
            div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;";
            var info = document.createElement("div");
            info.innerHTML = "<strong>" + (r.Cliente || "Senza nome") + "</strong> <span style='color:#64748b; font-size:12px; margin-left:10px;'>" + formatIT(r.DataPromemoria) + "</span><div style='font-size:11px; color:#94a3b8;'>" + (r.Note||"").substring(0,50) + "</div>";
            
            var btnArea = document.createElement("div");
            var btnRipristina = document.createElement("button");
            btnRipristina.innerHTML = "<i class='fa fa-reply'></i> Ripristina";
            btnRipristina.style.cssText = "background:#10b981; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:11px; cursor:pointer; margin-right:5px;";
            btnRipristina.onclick = (function(id) {
                return function() {
                    execDB("UPDATE tblPromemoria SET Stato='In attesa' WHERE ID=" + id);
                    OpenTrashModal();
                    CaricaLista();
                };
            })(r.ID);
            
            var btnElimina = document.createElement("button");
            btnElimina.innerHTML = "<i class='fa fa-times'></i>";
            btnElimina.style.cssText = "background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:4px; font-size:11px; cursor:pointer;";
            btnElimina.title = "Elimina definitivamente";
            btnElimina.onclick = (function(id) {
                return function() {
                    if(confirm("Eliminare definitivamente questo promemoria? L'azione è irreversibile.")) {
                        execDB("DELETE FROM tblPromemoria WHERE ID=" + id);
                        OpenTrashModal();
                    }
                };
            })(r.ID);
            
            btnArea.appendChild(btnRipristina);
            btnArea.appendChild(btnElimina);
            div.appendChild(info);
            div.appendChild(btnArea);
            list.appendChild(div);
        }
    }
    document.getElementById("trashModal").style.display = "block";
};

window.SvuotaCestino = function() {
    if(confirm("Attenzione: Svuotare il cestino eliminerà DEFINITIVAMENTE tutti i record cestinati. L'azione non è annullabile. Procedere?")) {
        execDB("DELETE FROM tblPromemoria WHERE Stato='Cestinato'");
        OpenTrashModal();
    }
};

// ==========================================
// DAEMON AVVISI PUSH (NOTIFICHE INTERNE)
// ==========================================
// --- BATCH ACTIONS LOGIC ---
window.ToggleSelectAll = function(checked) {
    var chks = document.querySelectorAll(".batch-chk-row");
    for(var i=0; i<chks.length; i++) {
        chks[i].checked = checked;
        var row = chks[i].parentNode.parentNode;
        if(checked) row.className = "selected-batch";
        else row.className = "";
    }
    CheckBatchVisibility();
};

window.CheckBatchVisibility = function(ev) {
    if(ev) ev.stopPropagation();
    var chks = document.querySelectorAll(".batch-chk-row:checked");
    var btn = document.getElementById("btnBatchDone");
    if(btn) btn.style.display = (chks.length > 0 ? "flex" : "none");
    
    // Highlight singola riga
    if(ev && ev.target) {
        var row = ev.target.parentNode.parentNode;
        if(ev.target.checked) row.className = "selected-batch";
        else row.className = "";
    }
};

window.ActionBatchComplete = function() {
    var chks = document.querySelectorAll(".batch-chk-row:checked");
    if(chks.length === 0) return;
    
    if(!confirm("Segnare come 'Completati' i " + chks.length + " promemoria selezionati?")) return;
    
    var ids = [];
    for(var i=0; i<chks.length; i++) ids.push(chks[i].value);
    
    var sql = "UPDATE tblPromemoria SET [Stato]='Completato' WHERE ID IN (" + ids.join(",") + ")";
    if(execDB(sql)) {
        ShowToast("BATCH", chks.length + " elementi aggiornati con successo!");
        LaunchConfetti();
        CaricaLista();
        document.getElementById("chkSelectAll").checked = false;
        CheckBatchVisibility();
    }
};

window.ScrollTimelineToNow = function() {
    var line = document.getElementById("timelineNowLine");
    var grid = document.getElementById("timelineGrid");
    if(line && grid) {
        var top = line.offsetTop;
        grid.scrollTop = top - 100; // Centra un po' meglio
    }
};

window.UpdateStatusColor = function(val) {
    var el = document.getElementById("cmbStato");
    if(!el) return;
    
    // Rimuovi vecchie classi
    el.className = el.className.replace(/\bstatus-bg-\S+/g, "");
    
    var stat = String(val).toLowerCase();
    if(stat.indexOf("attesa") > -1) el.className += " status-bg-attesa";
    else if(stat.indexOf("completa") > -1) el.className += " status-bg-completato";
    else if(stat.indexOf("annulla") > -1) el.className += " status-bg-annullato";
    else if(stat.indexOf("corso") > -1) el.className += " status-bg-corso";
};

function AvviaDemoneAvvisi() {
    // Primo check immediato dopo 5 secondi
    setTimeout(EseguiControlloAvvisi, 5000);
    // Poi ogni minuto
    setInterval(EseguiControlloAvvisi, 60000);
}

function EseguiControlloAvvisi() {
    if (!window.arrayPromemoria || arrayPromemoria.length === 0) return;
    
    var now = new Date();
    var currentH = (now.getHours() < 10 ? "0" : "") + now.getHours();
    var currentM = (now.getMinutes() < 10 ? "0" : "") + now.getMinutes();
    var strNow = currentH + ":" + currentM;
    
    // Otteniamo la data odierna in formato IT
    var gg = (now.getDate() < 10 ? '0' : '') + now.getDate();
    var mm = ((now.getMonth() + 1) < 10 ? '0' : '') + (now.getMonth() + 1);
    var oggiIT = gg + "/" + mm + "/" + now.getFullYear();
    
    for (var i = 0; i < arrayPromemoria.length; i++) {
        var r = arrayPromemoria[i];
        
        // Solo quelli di oggi, ancora in attesa
        if (r.DataIT === oggiIT && (r.Stato || "").toLowerCase().indexOf("attesa") > -1) {
            var oRem = r.OraPromemoria;
            if (oRem && oRem.length === 5 && oRem.indexOf(":") > 0) {
                var diff = calcolaMinutiDiff(strNow, oRem);
                
                // Se mancano tra 1 e 45 minuti, e non abbiamo ancora avvisato oggi
                if (diff > 0 && diff <= 45 && !r._alertDone) {
                    NotificaSchermoIncombente(r, diff);
                    r._alertDone = true; // Flag volatile in memoria
                }
            }
        }
    }
}

function calcolaMinutiDiff(str1, str2) {
    try {
        var p1 = str1.split(":");
        var p2 = str2.split(":");
        var min1 = parseInt(p1[0], 10) * 60 + parseInt(p1[1], 10);
        var min2 = parseInt(p2[0], 10) * 60 + parseInt(p2[1], 10);
        return min2 - min1;
    } catch(e) { return 999; }
}

function NotificaSchermoIncombente(r, minResidui) {
    var idBanner = "alert_banner_rem_" + r.ID;
    if (document.getElementById(idBanner)) return; // Già visibile
    
    // Iniezione dinamica animazioni se non presenti
    if(!document.getElementById("anim_toast_style")) {
        var style = document.createElement("style");
        style.id = "anim_toast_style";
        style.innerHTML = "@keyframes slideInToast { from { right: -500px; opacity: 0; } to { right: 20px; opacity: 1; } }";
        document.head.appendChild(style);
    }
    
    var div = document.createElement("div");
    div.id = idBanner;
    div.style.cssText = "position:fixed; bottom:20px; right:20px; width:450px; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); color:white; padding:18px 22px; border-radius:14px; box-shadow: 0 15px 35px rgba(0,0,0,0.4); z-index:1000000; display:flex; align-items:center; gap:15px; border:2px solid #fda4af; font-family:'Inter', sans-serif; animation: slideInToast 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;";
    
    div.innerHTML = 
        "<div style='font-size:32px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));'>🔔</div>" +
        "<div style='flex:1;'>" +
            "<div style='font-weight:900; font-size:16px; letter-spacing:0.5px;'>APPUNTAMENTO IMMINENTE</div>" +
            "<div style='font-size:14px; opacity:0.95; margin-top:4px;'>Tra <strong style='font-size:16px;'>" + minResidui + " min</strong> (Ore " + r.OraPromemoria + ")</div>" +
            "<div style='font-size:13px; margin-top:2px;'><strong>" + (r.Cliente || "Appunto") + "</strong></div>" +
        "</div>" +
        "<div style='display:flex; flex-direction:column; gap:5px;'>" +
            "<button onclick='this.parentNode.parentNode.removeChild(this.parentNode)' style='background:rgba(255,255,255,0.25); border:none; color:white; font-weight:bold; font-size:11px; padding:8px 12px; border-radius:6px; cursor:pointer; transition:all 0.2s;' onmouseover='this.style.background=\"rgba(255,255,255,0.4)\"' onmouseout='this.style.background=\"rgba(255,255,255,0.25)\"'>OK, HO CAPITO</button>" +
        "</div>";
        
    document.body.appendChild(div);
    
    // Segnale acustico
    try { shell.Run("cmd.exe /c echo ^G", 0, false); } catch(errSound) {}
}
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
        var currentPath = document.location.pathname;
        if (currentPath.indexOf("/") === 0) currentPath = currentPath.substring(1);
        currentPath = decodeURIComponent(currentPath).replace(/\//g, "\\");
        var fsoLocal = new ActiveXObject("Scripting.FileSystemObject");
        var parentDir = fsoLocal.GetParentFolderName(currentPath);
        var sysDir = fsoLocal.BuildPath(parentDir, "system");
        var credFile = fsoLocal.BuildPath(sysDir, "cred.local");
        var user = "Ciro Milella";
        if (fsoLocal.FileExists(credFile)) {
            var f = fsoLocal.OpenTextFile(credFile, 1);
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
        
        // --- IL DIAMANTE: BENVENUTO ---
        setTimeout(function(){
            ShowToast("BENVENUTO", "Buongiorno " + user + ", il Sistema Milella è pronto per te.");
        }, 2000);
    } catch(e) { }
}

window.PrintDailyAgenda = function() {
    var today = new Date();
    var g = (today.getDate()<10?'0':'')+today.getDate();
    var m = ((today.getMonth()+1)<10?'0':'')+(today.getMonth()+1);
    var oggiStr = g + "/" + m + "/" + today.getFullYear();
    
    var items = [];
    for (var i = 0; i < arrayPromemoria.length; i++) {
        if (arrayPromemoria[i].DataIT === oggiStr) items.push(arrayPromemoria[i]);
    }
    
    if (items.length === 0) { alert("Nessun appuntamento per oggi (" + oggiStr + ")"); return; }
    
    // Sort per ora
    items.sort(function(a,b){ return (a.OraPromemoria || "00:00").localeCompare(b.OraPromemoria || "00:00"); });
    
    var html = "<html><head><title>Agenda " + oggiStr + "</title>";
    html += "<style>body{font-family:Segoe UI, sans-serif; padding:40px; color:#333;} h1{color:#003366; border-bottom:3px solid #003366; padding-bottom:10px;} table{width:100%; border-collapse:collapse; margin-top:20px;} th{background:#f1f5f9; text-align:left; padding:12px; border:1px solid #cbd5e1;} td{padding:12px; border:1px solid #cbd5e1; vertical-align:top;} .ora{font-weight:bold; color:#1e40af; width:80px;} .cliente{font-weight:bold; font-size:16px;} .note{color:#64748b; font-size:13px; font-style:italic;} @media print{.no-print{display:none;}}</style>";
    html += "</head><body>";
    html += "<h1>??? Agenda Consegne - " + oggiStr + "</h1>";
    html += "<table><thead><tr><th>Ora</th><th>Cliente / Dettagli</th><th>Stato</th></tr></thead><tbody>";
    
    for (var j = 0; j < items.length; j++) {
        var it = items[j];
        html += "<tr>";
        html += "<td class='ora'>" + (it.OraPromemoria || "--:--") + "</td>";
        html += "<td><div class='cliente'>" + it.Cliente + "</div><div class='note'>" + (it.Note || "-") + "</div></td>";
        html += "<td>" + (it.Stato || "Attesa") + "</td>";
        html += "</tr>";
    }
    
    html += "</tbody></table>";
    html += "<div style='margin-top:40px; font-size:11px; color:#94a3b8; text-align:center;'>Generato da Sistema Logistica C. Milella - " + new Date().toLocaleString() + "</div>";
    html += "<script>window.print(); setTimeout(function(){ window.close(); }, 500);</script>";
    html += "</body></html>";
    
    var win = window.open("", "_blank", "width=800,height=600");
    win.document.write(html);
    win.document.close();
};

window.ScrollTimelineToNow = function() {
    var grid = document.getElementById("timelineGrid");
    var line = document.getElementById("timelineNowLine");
    if (!grid || !line) return;
    
    try {
        var targetPos = parseInt(line.style.top, 10) - 100;
        if (targetPos < 0) targetPos = 0;
        
        // IE11 non supporta scrollTo({behavior: 'smooth'}), usiamo un polyfill manuale veloce
        var start = grid.scrollTop;
        var change = targetPos - start;
        var currentTime = 0;
        var increment = 20;
        var duration = 400;
        
        var animateScroll = function() {
            currentTime += increment;
            var val = Math.easeInOutQuad(currentTime, start, change, duration);
            grid.scrollTop = val;
            if (currentTime < duration) {
                setTimeout(animateScroll, increment);
            }
        };
        animateScroll();
    } catch(e) {}
};

Math.easeInOutQuad = function (t, b, c, d) {
    t /= d/2;
    if (t < 1) return c/2*t*t + b;
    t--;
    return -c/2 * (t*(t-2) - 1) + b;
};

window.LaunchConfetti = function() {
    var colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    for (var i = 0; i < 50; i++) {
        var conf = document.createElement("div");
        conf.className = "confetti";
        conf.style.left = Math.random() * 100 + "vw";
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.width = (Math.random() * 8 + 5) + "px";
        conf.style.height = conf.style.width;
        conf.style.animationDuration = (Math.random() * 2 + 1) + "s";
        conf.style.animationDelay = (Math.random() * 2) + "s";
        document.body.appendChild(conf);
        
        // Rimuovi dopo l'animazione per non appesantire il DOM
        (function(el){ setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 4000); })(conf);
    }
};
// ==========================================
// SUPER FUNCTIONAL HELPERS (UNIFICATI)
// ==========================================
window.GetHoverActions = function(record, ora) {
    var id = record.ID;
    var tel = record.Telefono || "";
    var loc = record.Localita || "";
    var cl = record.Cliente || "Gentile Cliente";
    var hOra = ora || record.OraPromemoria || "--:--";
    
    var html = '<div class="hover-actions" onclick="event.stopPropagation()">';
    
    // WHATSAPP TEMPLATES (Passo anche il nome cliente)
    html += '<button class="hover-btn btn-wa" onclick="QuickWA(\'' + tel + '\', \'' + hOra + '\', \'CONF\', event, \'' + sqlEsc(cl) + '\')" title="WhatsApp: Conferma"><i class="fa fa-calendar-check-o"></i></button>';
    html += '<button class="hover-btn btn-wa" style="background:#fbbf24" onclick="QuickWA(\'' + tel + '\', \'' + hOra + '\', \'DELAY\', event, \'' + sqlEsc(cl) + '\')" title="WhatsApp: Ritardo"><i class="fa fa-clock-o"></i></button>';
    html += '<button class="hover-btn btn-wa" style="background:#0ea5e9" onclick="QuickWA(\'' + tel + '\', \'' + hOra + '\', \'ARRIVING\', event, \'' + sqlEsc(cl) + '\')" title="WhatsApp: Arrivo"><i class="fa fa-truck"></i></button>';
    
    html += '<div style="width:1px; background:rgba(0,0,0,0.1); margin:0 2px;"></div>';
    
    // MAPPA
    html += '<button class="hover-btn btn-map" onclick="QuickMap(\'' + loc + '\', event)" title="Apri Mappa"><i class="fa fa-map-marker"></i></button>';
    
    // DONE
    html += '<button class="hover-btn btn-done" onclick="QuickDone(' + id + ', event)" title="Segna come Fatto"><i class="fa fa-check"></i></button>';
    
    html += '</div>';
    return html;
};

// Override o integrazione delle vecchie funzioni se necessario
window.ActionQuickWhatsApp = function(id) { /* Deprecato in favore di QuickWA */ };
window.ActionQuickMappa = function(id) { /* Deprecato in favore di QuickMap */ };
window.ActionQuickDone = function(id) { QuickDone(id); };
// ==========================================
// FUNZIONI LOGISTICHE AVANZATE
// ==========================================
window.ActionStampaFoglioViaggio = function() {
    var g = (timelineDate.getDate()<10?'0':'')+timelineDate.getDate();
    var m = ((timelineDate.getMonth()+1)<10?'0':'')+(timelineDate.getMonth()+1);
    var dStr = g + "/" + m + "/" + timelineDate.getFullYear();
    
    // Filtro per la giornata corrente
    var eventiOggi = [];
    for(var i=0; i<arrayPromemoria.length; i++) {
        if(arrayPromemoria[i].DataIT === dStr) eventiOggi.push(arrayPromemoria[i]);
    }
    
    if(eventiOggi.length === 0) { alert("Nessun appuntamento da stampare per oggi."); return; }
    
    // Genero una finestra di stampa professionale
    var win = window.open("", "_blank", "width=800,height=900");
    var html = "<html><head><title>Foglio Viaggio - " + dStr + "</title>";
    html += "<style>" +
            "body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }" +
            "h1 { border-bottom: 3px solid #003366; padding-bottom: 10px; color: #003366; }" +
            "table { width: 100%; border-collapse: collapse; margin-top: 20px; }" +
            "th { background: #f1f5f9; text-align: left; padding: 12px; border: 1px solid #cbd5e1; font-size: 12px; text-transform: uppercase; }" +
            "td { padding: 12px; border: 1px solid #cbd5e1; vertical-align: top; font-size: 13px; }" +
            ".footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #666; }" +
            ".firma { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; margin-top: 40px; }" +
            "</style></head><body>";
            
    html += "<h1>🚚 FOGLIO VIAGGIO - Giorno " + dStr + "</h1>";
    html += "<table><thead><tr><th>Ora</th><th>Mezzo</th><th>Cliente / Indirizzo</th><th>Note / Firma</th></tr></thead><tbody>";
    
    for(var j=0; j<eventiOggi.length; j++) {
        var ev = eventiOggi[j];
        var addr = (ev.Residenza || "") + " - " + (ev.Localita || "");
        html += "<tr>" +
                "<td style='font-weight:bold; font-size:16px;'>" + (ev.OraPromemoria || "--:--") + "</td>" +
                "<td>" + (ev.AssegnatoA || "-") + "</td>" +
                "<td><strong>" + (ev.Cliente || "") + "</strong><br/>" + addr + "<br/>📞 " + (ev.Telefono || "-") + "</td>" +
                "<td style='height:80px;'><em>" + (ev.Note || "") + "</em><div class='firma'>Firma per Ricevuta</div></td>" +
                "</tr>";
    }
    
    html += "</tbody></table>";
    html += "<div class='footer'>Generato da Sistema Logistica C. Milella - " + new Date().toLocaleString() + "</div>";
    html += "</body></html>";
    
    win.document.write(html);
    win.document.close();
    win.print();
};

window.ActionCalcolaPercorsoGiorno = function() {
    var g = (timelineDate.getDate()<10?'0':'')+timelineDate.getDate();
    var m = ((timelineDate.getMonth()+1)<10?'0':'')+(timelineDate.getMonth()+1);
    var dStr = g + "/" + m + "/" + timelineDate.getFullYear();
    
    var tappe = [];
    for(var i=0; i<arrayPromemoria.length; i++) {
        var r = arrayPromemoria[i];
        if(r.DataIT === dStr && r.Residenza) {
            tappe.push((r.Residenza || "") + "," + (r.Localita || ""));
        }
    }
    
    if(tappe.length === 0) { alert("Nessun indirizzo geolocalizzabile per oggi."); return; }
    
    // URL Google Maps con più tappe
    var baseUrl = "https://www.google.com/maps/dir/";
    var destination = tappe[tappe.length - 1];
    var waypoints = tappe.slice(0, tappe.length - 1).join("/");
    
    var finalUrl = baseUrl + waypoints + "/" + destination;
    window.open(finalUrl);
};

// ==========================================
// LOGICA MONITORAGGIO A.S.L. (6 ANNI)
// ==========================================
window.UpdateASLLogic = function() {
    var dtStr = document.getElementById("txtDataASL").value;
    var badge = document.getElementById("aslStatusBadge");
    var lblScad = document.getElementById("lblScadenzaASL");
    
    if (!dtStr || dtStr.length !== 10) {
        badge.innerText = "LIBERO / IDONEO";
        badge.className = "asl-badge state-libero";
        lblScad.value = "";
        return;
    }
    
    try {
        var p = dtStr.split("/");
        var dtUltima = new Date(p[2], p[1]-1, p[0]);
        var dtScadenza = new Date(p[2], p[1]-1, p[0]);
        dtScadenza.setFullYear(dtScadenza.getFullYear() + 6);
        
        var oggi = new Date();
        oggi.setHours(0,0,0,0);
        
        // Formatto data scadenza per UI
        var gS = (dtScadenza.getDate()<10?'0':'')+dtScadenza.getDate();
        var mS = ((dtScadenza.getMonth()+1)<10?'0':'')+(dtScadenza.getMonth()+1);
        var dStrScad = gS + "/" + mS + "/" + dtScadenza.getFullYear();
        lblScad.value = dStrScad;
        
        var codici = document.getElementById("txtCodiciASL").value.toLowerCase();
        
        if (oggi >= dtScadenza) {
            badge.innerText = "IDONEO (6 ANNI PASSATI)";
            badge.className = "asl-badge state-libero";
        } else {
            // Se ci sono note sui residui, lo segno come parziale
            if (codici.indexOf("residuo") > -1 || codici.indexOf("avanzat") > -1 || codici.indexOf("parziale") > -1) {
                badge.innerText = "UTILIZZO PARZIALE / RESIDUI";
                badge.className = "asl-badge state-parziale";
            } else {
                badge.innerText = "BLOCCATO FINO AL " + dStrScad;
                badge.className = "asl-badge state-bloccato";
            }
        }
    } catch(e) {
        badge.innerText = "ERRORE DATA";
        badge.className = "asl-badge state-bloccato";
    }
};

window.PlanRecall6Years = function() {
    var cl = document.getElementById("cmbCliente").value;
    var dtScad = document.getElementById("lblScadenzaASL").value;
    
    if (!cl || !dtScad) { alert("Inserisci Cliente e Data Scadenza prima!"); return; }
    
    if (confirm("Vuoi programmare un ricontatto automatico per il giorno " + dtScad + " (tra 6 anni)?")) {
        var p = dtScad.split("/");
        var dtSql = "'" + p[2] + "-" + p[1] + "-" + p[0] + "'";
        
        var note = "RICONTATTO SCADENZA 6 ANNI ASL. Verificare codici precedentemente erogati.";
        var sql = "INSERT INTO tblPromemoria (Cliente, DataPromemoria, OraPromemoria, Tipologia, [Stato], [Note], DataInserimento) VALUES (" +
                  "'" + sqlEsc(cl) + "', " + dtSql + ", '09:00', 'Commerciale', 'In attesa', '" + note + "', Now())";
        
        if (execDB(sql)) {
            ShowToast("PROGRAMMATO", "Promemoria creato per il " + dtScad + "!");
        }
    }
};

// ==========================================
// SISTEMA AVVANZATO MONITORAGGIO A.S.L. (BIG DATA)
// ==========================================

// Funzione per importare il CSV (da chiamare una tantum)
window.ImportASL_CSV = function() {
    try {
        // Leggo il file tramite FSO (FileSystemObject) che è potente in HTA
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var filePath = "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\CLIENTI PUGLIA NICOLA.csv";
        
        if (!fso.FileExists(filePath)) {
            alert("File CSV non trovato in: " + filePath);
            return;
        }

        var file = fso.OpenTextFile(filePath, 1);
        var content = file.ReadAll();
        file.Close();

        var lines = content.split("\n");
        var headers = lines[0].split(";");
        
        // Pulizia tabella esistente
        execDB("DELETE FROM tblASL_Storico");
        
        var count = 0;
        for (var i = 1; i < lines.length; i++) {
            if (lines[i].trim() === "") continue;
            var cols = lines[i].split(";");
            var nome = sqlEsc(cols[1] || "");
            if (!nome) continue;

            // Per ogni colonna di codice (dalla 9 in poi)
            for (var c = 9; c < cols.length; c++) {
                var dataVal = (cols[c] || "").trim();
                if (dataVal !== "" && dataVal.indexOf("/") > -1) {
                    var isoCode = sqlEsc(headers[c] || "Codice Ignoto");
                    var sql = "INSERT INTO tblASL_Storico (Cliente, CodiceISO, DataUltima) VALUES ('" + nome + "', '" + isoCode + "', '" + dataVal + "')";
                    execDB(sql);
                }
            }
            count++;
        }
        alert("IMPORTAZIONE COMPLETATA!\nAnalizzati " + count + " clienti con i relativi codici.");
    } catch(e) {
        alert("Errore durante l'importazione: " + e.description);
    }
};

// Funzione per caricare il check-up del cliente selezionato
window.RefreshASLCheckup = function(nomeCliente) {
    var container = document.getElementById("aslCheckupList");
    if (!container) return;
    container.innerHTML = "<div style='color:#64748b; font-size:10px; text-align:center; padding:10px;'>Analisi in corso...</div>";
    
    setTimeout(function() {
        var sql = "SELECT * FROM tblASL_Storico WHERE Cliente = '" + sqlEsc(nomeCliente) + "' ORDER BY DataUltima DESC";
        var res = queryDB(sql);
        
        if (res.length === 0) {
            container.innerHTML = "<div style='color:#15803d; font-size:11px; padding:10px; background:#dcfce7; border-radius:8px;'><i class='fa fa-check-circle'></i> Nessuno storico trovato. Il cliente sembra IDONEO per tutti i codici.</div>";
            document.getElementById("aslStatusBadge").innerText = "IDONEO / NUOVO";
            document.getElementById("aslStatusBadge").className = "asl-badge state-libero";
            return;
        }

        var html = "<table style='width:100%; font-size:10px; border-collapse:collapse;'>";
        var isBlockedGlobal = false;
        var oggi = new Date();
        oggi.setHours(0,0,0,0);

        for (var i = 0; i < res.length; i++) {
            var r = res[i];
            var p = r.DataUltima.split("/");
            var dtUltima = new Date(p[2], p[1]-1, p[0]);
            var dtScadenza = new Date(p[2], p[1]-1, p[0]);
            dtScadenza.setFullYear(dtScadenza.getFullYear() + 6);
            
            var diffAnni = (dtScadenza - oggi) / (1000 * 60 * 60 * 24 * 365);
            var statusClass = "state-libero";
            var icon = "check";
            var msg = "IDONEO";

            if (oggi < dtScadenza) {
                statusClass = "state-bloccato";
                icon = "times-circle";
                msg = "BLOCCATO";
                isBlockedGlobal = true;
            }

            html += "<tr style='border-bottom:1px solid #e2e8f0;'>";
            html += "<td style='padding:4px 0; font-weight:bold; color:#1e293b;'>" + r.CodiceISO.substring(0,25) + "...</td>";
            html += "<td style='padding:4px 0; text-align:right;'><span class='asl-badge " + statusClass + "' style='padding:2px 6px; font-size:9px; margin:0; display:inline-block;'>" + msg + "</span></td>";
            html += "</tr>";
            html += "<tr><td colspan='2' style='padding-bottom:6px; color:#64748b; font-size:9px;'>Preso il: " + r.DataUltima + " (Sblocco: " + (dtScadenza.getDate()+'/'+(dtScadenza.getMonth()+1)+'/'+dtScadenza.getFullYear()) + ")</td></tr>";
        }
        html += "</table>";
        container.innerHTML = html;

        var badge = document.getElementById("aslStatusBadge");
        if (isBlockedGlobal) {
            badge.innerText = "ATTENZIONE: CODICI BLOCCATI";
            badge.className = "asl-badge state-bloccato";
        } else {
            badge.innerText = "LIBERO / IDONEO";
            badge.className = "asl-badge state-libero";
        }
    }, 300);
};

// Migrazione database per Big Data ASL
(function(){
    try { execDB("CREATE TABLE IF NOT EXISTS tblASL_Storico (ID INTEGER PRIMARY KEY AUTOINCREMENT, Cliente TEXT, CodiceISO TEXT, DataUltima TEXT)"); } catch(e){}
})();

// ==========================================
// GESTIONE MODALE STANDALONE ASL
// ==========================================
window.ApriCheckupASL = function() {
    var modal = document.getElementById("modalASL");
    if(modal) {
        modal.style.display = "flex";
        document.getElementById("txtSearchASL").focus();
    }
};

window.SearchASLModal = function(val) {
    var sugg = document.getElementById("suggASLModal");
    var resDiv = document.getElementById("aslModalResult");
    if(!sugg) return;
    
    val = val.trim();
    if(val.length < 2) { sugg.style.display = "none"; return; }
    
    var sql = "SELECT DISTINCT Cliente FROM tblASL_Storico WHERE Cliente LIKE '%" + sqlEsc(val) + "%' LIMIT 10";
    var res = queryDB(sql);
    
    if(res.length > 0) {
        sugg.innerHTML = "";
        for (var i = 0; i < res.length; i++) {
            var r = res[i];
            var d = document.createElement("div");
            d.innerText = r.Cliente;
            d.onclick = (function(nome) {
                return function() {
                    document.getElementById("txtSearchASL").value = nome;
                    sugg.style.display = "none";
                    ShowASLHistoryModal(nome);
                };
            })(r.Cliente);
            sugg.appendChild(d);
        }
        sugg.style.display = "block";
    } else {
        sugg.style.display = "none";
    }
};

window.ShowASLHistoryModal = function(nomeCliente) {
    var container = document.getElementById("aslModalResult");
    if (!container) return;
    
    var sql = "SELECT * FROM tblASL_Storico WHERE Cliente = '" + sqlEsc(nomeCliente) + "' ORDER BY DataUltima DESC";
    var res = queryDB(sql);
    
    var html = "<h3 style='margin:0 0 15px 0; color:#1e293b; font-size:14px;'><i class='fa fa-user'></i> Storico per: " + nomeCliente + "</h3>";
    html += "<table style='width:100%; font-size:12px; border-collapse:collapse;'>";
    html += "<thead><tr style='background:#f1f5f9;'><th style='text-align:left; padding:8px;'>CODICE ISO / DESCRIZIONE</th><th style='text-align:center; padding:8px;'>ULTIMA DATA</th><th style='text-align:center; padding:8px;'>SBLOCCO 6 ANNI</th><th style='text-align:center; padding:8px;'>STATO</th></tr></thead><tbody>";

    var oggi = new Date();
    oggi.setHours(0,0,0,0);

    for (var i = 0; i < res.length; i++) {
        var r = res[i];
        var p = r.DataUltima.split("/");
        var dtUltima = new Date(p[2], p[1]-1, p[0]);
        var dtScadenza = new Date(p[2], p[1]-1, p[0]);
        dtScadenza.setFullYear(dtScadenza.getFullYear() + 6);
        
        var statusClass = "state-libero";
        var msg = "IDONEO";
        if (oggi < dtScadenza) { statusClass = "state-bloccato"; msg = "BLOCCATO"; }

        html += "<tr style='border-bottom:1px solid #e2e8f0;'>";
        html += "<td style='padding:10px 8px;'>" + r.CodiceISO + "</td>";
        html += "<td style='padding:10px 8px; text-align:center;'>" + r.DataUltima + "</td>";
        html += "<td style='padding:10px 8px; text-align:center;'>" + (dtScadenza.getDate()+'/'+(dtScadenza.getMonth()+1)+'/'+dtScadenza.getFullYear()) + "</td>";
        html += "<td style='padding:10px 8px; text-align:center;'><span class='asl-badge " + statusClass + "' style='padding:3px 8px; margin:0;'>" + msg + "</span></td>";
        html += "</tr>";
    }
    html += "</tbody></table>";
    container.innerHTML = html;
};

// ==========================================
// GESTIONE MEZZI E AUTISTI PERSONALIZZATI
// ==========================================
window.CaricaListaMezzi = function() {
    try {
        var dl = document.getElementById("listMezzi");
        if (!dl) return;
        dl.innerHTML = "";
        var res = queryDB("SELECT NomeMezzo FROM tblLogistica_Mezzi ORDER BY NomeMezzo ASC");
        for(var i=0; i<res.length; i++) {
            dl.innerHTML += '<option value="' + res[i].NomeMezzo + '">';
        }
    } catch(e){}
};

window.ApriGestioneMezzi = function() {
    var modal = document.getElementById("modalMezzi");
    if(modal) {
        modal.style.display = "flex";
        RenderizzaListaMezzi();
    }
};

window.RenderizzaListaMezzi = function() {
    var container = document.getElementById("listaMezziGestione");
    if(!container) return;
    
    var res = queryDB("SELECT * FROM tblLogistica_Mezzi ORDER BY NomeMezzo ASC");
    if(res.length === 0) {
        container.innerHTML = "<div style='padding:20px; text-align:center; color:#94a3b8; font-size:12px;'>Nessun mezzo in lista.</div>";
        return;
    }
    
    var html = "<table style='width:100%; border-collapse:collapse;'>";
    for(var i=0; i<res.length; i++) {
        html += "<tr style='border-bottom:1px solid #f1f5f9;'>";
        html += "<td style='padding:10px; font-weight:600; font-size:13px; color:#1e293b;'>" + res[i].NomeMezzo + "</td>";
        html += "<td style='padding:10px; text-align:right;'>";
        html += "<button onclick='EliminaMezzo(" + res[i].ID + ")' style='background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;' title='Elimina'><i class='fa fa-trash'></i></button>";
        html += "</td></tr>";
    }
    html += "</table>";
    container.innerHTML = html;
};

window.AggiungiNuovoMezzo = function() {
    var input = document.getElementById("txtNuovoMezzo");
    var val = input.value.trim().toUpperCase();
    if(val === "") { alert("Inserisci un nome valido!"); return; }
    
    execDB("INSERT INTO tblLogistica_Mezzi (NomeMezzo) VALUES ('" + sqlEsc(val) + "')");
    input.value = "";
    RenderizzaListaMezzi();
    CaricaListaMezzi(); // Aggiorna anche la datalist
};

window.EliminaMezzo = function(id) {
    if(confirm("Sicuro di voler eliminare questo mezzo dalla lista?")) {
        execDB("DELETE FROM tblLogistica_Mezzi WHERE ID = " + id);
        RenderizzaListaMezzi();
        CaricaListaMezzi();
    }
};

// Migrazione database Mezzi
(function(){
    try { execDB("CREATE TABLE IF NOT EXISTS tblLogistica_Mezzi (ID INTEGER PRIMARY KEY AUTOINCREMENT, NomeMezzo TEXT)"); } catch(e){}
})();

// Monitoraggio ASL configurato.
