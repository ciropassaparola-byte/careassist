// storico_hta.js - Enterprise Search Engine
var fso = null;
try { if (typeof ActiveXObject !== "undefined") fso = new ActiveXObject("Scripting.FileSystemObject"); } catch(e) {}
var shell = null;
try { if (typeof ActiveXObject !== "undefined") shell = new ActiveXObject("WScript.Shell"); } catch(e) {}

// Risoluzione Percorso Database
var pG = document.location.pathname || "";
if (pG.indexOf("/") === 0) pG = pG.substring(1);
pG = decodeURIComponent(pG).replace(/\//g, "\\");
var currentDir = fso ? fso.GetParentFolderName(pG) : "";
var DB_PATH = fso ? fso.BuildPath(currentDir, "ConsegneDB.accdb") : "ConsegneDB.accdb";

var selectedId = null;
var activeInput = null;
var calDate = new Date();
var isNavigating = false; 
var isClosing = false;    
var currentStatusFilter = "TUTTI";
var ultimoSqlDati = "";
var ultimoFiltroTesto = "";

// Funzione Helper Globale per Animazione Numerica Count-Up (UX Premium 2026)
function AnimateCounterDash(el, endVal, suffix, prefix) {
    if (!el) return;
    var end = parseInt(endVal, 10) || 0;
    var suff = suffix || "";
    var pref = prefix || "";
    if (isNaN(end)) { el.innerText = pref + endVal + suff; return; }
    if (end === 0) { el.innerText = pref + "0" + suff; return; }
    var duration = 500; // Animazione più rapida per la ricerca smart interattiva
    var stepTime = 20; // ms per frame
    var steps = Math.ceil(duration / stepTime);
    var increment = end / steps;
    var current = 0;
    var count = 0;
    
    // Se un'animazione è già attiva sull'elemento, la fermiamo per evitare sovrapposizioni convulse
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

function queryAccessDB(sql, isUpdate) {
    try {
        var http = null;
        if (typeof ActiveXObject !== "undefined") {
            try { http = new ActiveXObject("WinHttp.WinHttpRequest.5.1"); } catch(e) {}
        }
        if (!http && typeof XMLHttpRequest !== "undefined") {
            http = new XMLHttpRequest();
        }
        if (!http) return isUpdate ? false : [];

        http.open("POST", "http://127.0.0.1:3002/query", false);
        if (http.setRequestHeader) {
            http.setRequestHeader("Content-Type", "application/json");
        }
        http.send(JSON.stringify({ sql: sql }));
        if (http.status === 200) {
            var res = JSON.parse(http.responseText || http.ResponseText);
            return isUpdate ? true : res;
        }
    } catch(errReq) {}
    return isUpdate ? false : [];
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

window.onload = function() {
    StartTitleClock();
    try { CaricaProfiloUtente(); } catch(e) {}
    InizializzaFiltri();
    SetupEventListeners();
    AutoCleanOldRecords();
    CaricaDati(); // Caricamento iniziale
};

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

function InizializzaFiltri() {
    try {
        var sqlAnni = "SELECT DISTINCT Year(DataConsegna) as Anno FROM tblConsegne WHERE DataConsegna IS NOT NULL ORDER BY Year(DataConsegna) DESC";
        var rows = queryAccessDB(sqlAnni, false);
        var cboAnni = document.getElementById("cboAnni");
        for (var i = 0; i < rows.length; i++) {
            var opt = document.createElement("option");
            opt.value = rows[i].Anno;
            opt.innerText = rows[i].Anno;
            cboAnni.appendChild(opt);
        }
        var mesiNomi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        var cboMesi = document.getElementById("cboMesi");
        for(var i=0; i<12; i++) {
            var opt = document.createElement("option");
            opt.value = i + 1;
            opt.innerText = mesiNomi[i];
            cboMesi.appendChild(opt);
        }
    } catch(e) {}
}

function SetupEventListeners() {
    var searchTimer = null;
    var liveSearch = function() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(CaricaDati, 400); // Leggero ritardo per stabilità
    };

    // Ricerca Automatica (Real-time)
    document.getElementById("txtCerca").oninput = liveSearch;
    document.getElementById("cboAnni").onchange = CaricaDati;
    document.getElementById("cboMesi").onchange = CaricaDati;
    document.getElementById("dtpDal").oninput = liveSearch;
    document.getElementById("dtpAl").oninput = liveSearch;
    
    // Supporto per il doppio click sui campi data per il calendario
    document.getElementById("dtpDal").ondblclick = function() { OpenSmartCalendar(this); };
    document.getElementById("dtpAl").ondblclick = function() { OpenSmartCalendar(this); };

    // Gestione chiusura e navigazione già gestita nel Ribbon
    // cmdEsci e cmdSync non sono più presenti come ID singoli nel footer
    document.body.onclick = function(e) {
        var cal = document.getElementById("calContainer");
        var t = e.srcElement || e.target;
        if(cal && cal.style.display === "block") {
            if(!cal.contains(t) && t.id !== "dtpDal" && t.id !== "dtpAl") CloseSmartCalendar();
        }
    };
}

window.PulisciFiltri = function() {
    try {
        document.getElementById("txtCerca").value = "";
        document.getElementById("cboAnni").value = "Tutti";
        document.getElementById("cboMesi").value = "Tutti";
        document.getElementById("dtpDal").value = "";
        document.getElementById("dtpAl").value = "";
        
        // Reset rapido dei tag filtri
        currentStatusFilter = "TUTTI";
        var tags = document.querySelectorAll('.quick-tag');
        for(var i=0; i<tags.length; i++) tags[i].classList.remove('active');
        var tagTutti = document.getElementById("tagTUTTI");
        if(tagTutti) tagTutti.classList.add("active");
        
        ResetFocusCard();
        CaricaDati();
    } catch(e) {}
};

window.ApplicaFiltroRapido = function(stato, element) {
    try {
        currentStatusFilter = stato.toUpperCase();
        
        // Aggiorna classi grafiche sui pulsanti
        var tags = document.querySelectorAll('.quick-tag');
        for(var i=0; i<tags.length; i++) tags[i].classList.remove('active');
        if (element) element.classList.add('active');
        
        ResetFocusCard(); // Resetta la scheda focus al cambio filtro
        
        // Ridisegna la tabella coi filtri aggiornati riusando l'ultima query salvata
        RenderTabella(ultimoSqlDati, ultimoFiltroTesto);
    } catch(e) {}
};

function ResetFocusCard() {
    try {
        document.getElementById("focusCliente").innerText = "Nessun record selezionato";
        document.getElementById("focusId").innerText = "-";
        document.getElementById("focusData").innerText = "-";
        document.getElementById("focusLoc").innerText = "-";
        document.getElementById("focusTel").innerText = "-";
        document.getElementById("focusCallBtnWrapper").innerHTML = "";
        document.getElementById("focusBadgeWrapper").innerHTML = "";
        document.getElementById("focusNote").innerText = "Seleziona una riga dall'archivio storico sovrastante per caricare il riepilogo e visualizzare le note testuali registrate sul database.";
        document.getElementById("focusCard").classList.remove("has-data");
        
        var btnCopy = document.getElementById("btnCopiaDettagli");
        if (btnCopy) btnCopy.style.display = "none";
    } catch(e) {}
}

window.CopiaRiepilogo = function() {
    try {
        var id = document.getElementById("focusId").innerText;
        var cliente = document.getElementById("focusCliente").innerText;
        var data = document.getElementById("focusData").innerText;
        var loc = document.getElementById("focusLoc").innerText;
        var tel = document.getElementById("focusTel").innerText;
        var note = document.getElementById("focusNote").innerText;
        
        if(id === "-") return;
        
        var text = "🚚 *CONSEGNA C. MILELLA* 🚚\n" +
                   "-----------------------------------\n" +
                   "🆔 *ID Ordine:* #" + id + "\n" +
                   "📅 *Data Consegna:* " + data + "\n" +
                   "👤 *Cliente:* " + cliente + "\n" +
                   "📍 *Città:* " + loc + "\n" +
                   "📞 *Telefono:* " + (tel === "Non presente" || tel === "-" ? "Non indicato" : tel) + "\n" +
                   "-----------------------------------\n" +
                   "📝 *NOTE LOGISTICA:* \n" + note + "\n" +
                   "-----------------------------------";
        
        // Copia nativa supportata nel container di Windows
        window.clipboardData.setData("Text", text);
        
        // Animazione pulsante copiatore
        var btn = document.getElementById("btnCopiaDettagli");
        var oldHtml = btn.innerHTML;
        btn.innerHTML = "<i class='fa fa-check'></i> Copiato!";
        btn.style.backgroundColor = "#22c55e";
        btn.style.borderColor = "#16a34a";
        btn.style.color = "#ffffff";
        
        setTimeout(function(){
            btn.innerHTML = oldHtml;
            btn.style.backgroundColor = "";
            btn.style.borderColor = "";
            btn.style.color = "";
        }, 2000);
        
    } catch(err) {
        alert("Impossibile copiare negli appunti.");
    }
};

// --- LOGICA FESTIVITA' ITALIANE ---
function GetPasquetta(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100,
        d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mon = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mon - 1, day + 1);
}

function isFestivo(d, m, y) {
    if (d === 1 && m === 1) return true;
    if (d === 6 && m === 1) return true;
    if (d === 8 && m === 5) return true; // S. Nicola
    if (d === 25 && m === 4) return true;
    if (d === 1 && m === 5) return true;
    if (d === 2 && m === 6) return true;
    if (d === 15 && m === 8) return true;
    if (d === 1 && m === 11) return true;
    if (d === 8 && m === 12) return true;
    if (d === 25 && m === 12) return true;
    if (d === 26 && m === 12) return true;
    var pasquetta = GetPasquetta(y);
    if (d === pasquetta.getDate() && m === (pasquetta.getMonth() + 1)) return true;
    return false;
}

// --- RENDERING CALENDARIO ---
function OpenSmartCalendar(input) {
    activeInput = input;
    var cal = document.getElementById("calContainer");
    if(!cal) return;
    var rect = input.getBoundingClientRect();
    cal.style.left = (rect.left - 10) + "px";
    cal.style.top = (rect.bottom + 5) + "px";
    cal.style.display = "block";
    if(input.value && ControlloData(input.value)) {
        var p = input.value.split("/");
        calDate = new Date(p[2], p[1]-1, p[0]);
    } else {
        calDate = new Date();
    }
    RenderSmartCalendar();
}

function RenderSmartCalendar() {
    var cal = document.getElementById("calContainer");
    var year = calDate.getFullYear();
    var month = calDate.getMonth();
    var mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
    var firstDay = new Date(year, month, 1).getDay();
    if(firstDay === 0) firstDay = 7; 
    firstDay--; 
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date();
    var html = '<div class="cal-smart-header">' +
               '<span class="cal-smart-nav" onclick="ChangeSmartMonth(-1)">◄</span>' +
               '<span class="cal-smart-title">' + mesi[month] + ' ' + year + '</span>' +
               '<span class="cal-smart-nav" onclick="ChangeSmartMonth(1)">►</span>' +
               '</div>';
    html += '<table class="cal-smart-tbl"><thead><tr>';
    var lbls = ["LU","MA","ME","GI","VE","SA","DO"];
    for(var i=0; i<7; i++) {
        var cls = "cal-smart-day-label" + (i===5?" sat": (i===6?" sun":""));
        html += '<th class="' + cls + '">' + lbls[i] + '</th>';
    }
    html += '</tr></thead><tbody><tr>';
    for(var i=0; i<firstDay; i++) html += '<td class="cal-smart-cell empty"></td>';
    for(var d=1; d<=daysInMonth; d++) {
        if((firstDay + d - 1) % 7 === 0 && d > 1) html += '</tr><tr>';
        var cls = "cal-smart-cell";
        var currIdx = (firstDay + d - 1) % 7;
        if(currIdx === 5) cls += " sat";
        if(currIdx === 6 || isFestivo(d, month + 1, year)) cls += " sun";
        if(d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) cls += " today";
        if(activeInput && activeInput.value) {
            var p = activeInput.value.split("/");
            if(parseInt(p[0]) === d && parseInt(p[1]) === month+1 && parseInt(p[2]) === year) cls += " selected";
        }
        html += '<td class="' + cls + '" onclick="SetSmartDate(' + d + ',' + (month+1) + ',' + year + ')">' +
                '<span class="cal-num-wrap">' + d + '</span></td>';
    }
    var lastCells = (firstDay + daysInMonth) % 7;
    if(lastCells > 0) {
        for(var i=lastCells; i<7; i++) html += '<td class="cal-smart-cell empty"></td>';
    }
    html += '</tr></tbody></table>';
    html += '<div class="cal-smart-footer">' +
            '<button class="btn-cal-smart oggi" onclick="SetSmartToday()">OGGI</button>' +
            '<button class="btn-cal-smart chiudi" onclick="CloseSmartCalendar()">CHIUDI</button>' +
            '</div>';
    cal.innerHTML = html;
}

function ChangeSmartMonth(v) {
    calDate.setMonth(calDate.getMonth() + v);
    RenderSmartCalendar();
}

function SetSmartDate(d, m, y) {
    if(activeInput) {
        activeInput.value = Pad(d) + "/" + Pad(m) + "/" + y;
        CloseSmartCalendar();
        CaricaDati();
    }
}

function SetSmartToday() {
    var now = new Date();
    SetSmartDate(now.getDate(), now.getMonth()+1, now.getFullYear());
}

function CloseSmartCalendar() {
    document.getElementById("calContainer").style.display = "none";
}

function CaricaDati() {
    var txt = document.getElementById("txtCerca").value.toLowerCase();
    var anno = document.getElementById("cboAnni").value;
    var mese = document.getElementById("cboMesi").value;
    var dal = document.getElementById("dtpDal").value;
    var al = document.getElementById("dtpAl").value;

    // --- CONTROLLO RANGE DATE COERENTE ---
    if(dal && ControlloData(dal) && al && ControlloData(al)) {
        var pDal = dal.split("/");
        var pAl = al.split("/");
        var dDal = new Date(parseInt(pDal[2]), parseInt(pDal[1])-1, parseInt(pDal[0]));
        var dAl = new Date(parseInt(pAl[2]), parseInt(pAl[1])-1, parseInt(pAl[0]));
        if (dDal > dAl) {
            alert("ERRORE NELL'INSERIMENTO DELLE DATE:\n\nLa data di inizio (DA: " + dal + ") non può essere successiva alla data di fine (AL: " + al + ").\n\nCorreggi le date per procedere con la ricerca.");
            return;
        }
    }

    // Zenith: Recuperiamo anche il telefono e indirizzo per la ricerca smart
    var sql = "SELECT c.ID, c.DataConsegna, c.ClienteNome, c.LocalitaConsegna, c.Stato, c.Note, c.Telefono, c.IndirizzoConsegna FROM tblConsegne c WHERE 1=1";
    if(anno !== "Tutti") sql += " AND Year(c.DataConsegna) = " + anno;
    if(mese !== "Tutti") { var mPad = (parseInt(mese, 10) < 10 ? "0" : "") + parseInt(mese, 10); sql += " AND (CAST(c.MeseRiferimento AS INT) = " + parseInt(mese, 10) + " OR c.DataConsegna LIKE '%-" + mPad + "-%')"; }
    
    // Solo se la data è completa e corretta la aggiungiamo al SQL
    if(dal && ControlloData(dal)) sql += " AND c.DataConsegna >= #" + FormattaDataSQL(dal) + "#";
    if(al && ControlloData(al)) sql += " AND c.DataConsegna <= #" + FormattaDataSQL(al) + "#";
    
    // Nota: Il filtro 'txt' viene ora gestito in RenderTabella per supportare la normalizzazione dei telefoni
    sql += " ORDER BY c.DataConsegna DESC";
    RenderTabella(sql, txt);
}

function RenderTabella(sql, filtroTesto) {
    var tbody = document.getElementById("tbodyRisultati");
    tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding: 40px;'>Ricerca in corso...</td></tr>";
    
    // Salviamo i parametri di questa query come "ultima query" per il filtraggio al volo
    ultimoSqlDati = sql;
    ultimoFiltroTesto = filtroTesto || "";
    
    var search = (filtroTesto || "").toUpperCase();
    var searchClean = search.replace(/\D/g, '');
    // FIX: Evita falsi positivi sui numeri civici se la ricerca contiene testo
    if (search.match(/[A-Z]/i) && searchClean.length < 6) searchClean = ""; 
    var searchNoSpaces = search.replace(/\s/g, ''); 
    
    try {
        var rows = queryAccessDB(sql, false);
        tbody.innerHTML = "";
        
        var countQueryMatches = 0; // Record totali che matchano la sidebar search
        var countRendered = 0;     // Record disegnati a schermo (dopo filtro rapido)
        
        // Contatori specifici per il Breakdown Bar (Distribuzione)
        var cDel = 0;   // CONSEGNATO
        var cComp = 0;  // COMPLETATA
        var cConf = 0;  // CONFERMATO
        var cCall = 0;  // DA CHIAMARE
        var cPend = 0;  // PENDENTE / ALTRO
        
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var nome = (row.ClienteNome || "").toString().toUpperCase();
            var nomeNoSpaces = nome.replace(/\s/g, ''); 
            
            var loc = (row.LocalitaConsegna || "").toString().toUpperCase();
            var locNoSpaces = loc.replace(/\s/g, ''); 
            
            var note = (row.Note || "").toString().toUpperCase();
            var tel = (row.Telefono || "").toString();
            var telClean = tel.replace(/\D/g, '');
            var id = row.ID.toString();
            var indirizzo = (row.IndirizzoConsegna || "").toString().toUpperCase();
            var indirizzoNoSpaces = indirizzo.replace(/\s/g, '');
            
            var matchTesto = !search || 
                             nome.indexOf(search) > -1 || 
                             loc.indexOf(search) > -1 || 
                             indirizzo.indexOf(search) > -1 || 
                             note.indexOf(search) > -1 || 
                             id.indexOf(search) > -1 ||
                             tel.toUpperCase().indexOf(search) > -1 ||
                             (searchClean !== "" && telClean.indexOf(searchClean) > -1) ||
                             (searchNoSpaces !== "" && nomeNoSpaces.indexOf(searchNoSpaces) > -1) ||
                             (searchNoSpaces !== "" && locNoSpaces.indexOf(searchNoSpaces) > -1) ||
                             (searchNoSpaces !== "" && indirizzoNoSpaces.indexOf(searchNoSpaces) > -1);

            if (matchTesto) {
                countQueryMatches++;
                var stato = (row.Stato || "PENDENTE").toUpperCase();
                
                // Calcoliamo le quote per la barra di riepilogo GLOBALE (indipendentemente dal tag selezionato!)
                if (stato === "CONSEGNATO") cDel++;
                else if (stato === "COMPLETATA") cComp++;
                else if (stato === "CONFERMATO") cConf++;
                else if (stato === "DA CHIAMARE") cCall++;
                else cPend++;
                
                // --- FILTRO RAPIDO TAGS (Applica il taglio grafico delle righe) ---
                if (currentStatusFilter !== "TUTTI") {
                    if (currentStatusFilter === "DA LAVORARE" && (stato === "PENDENTE" || stato === "DA CHIAMARE" || stato === "DA LAVORARE")) {
                        // Passa il filtro (sono considerati tutti Da Lavorare)
                    } else if (stato !== currentStatusFilter) {
                        continue; // Saltiamo il rendering di questa riga
                    }
                }
                
                countRendered++;
                var tr = document.createElement("tr");
                tr.setAttribute("data-id", id);
                tr.setAttribute("data-note", row.Note || "");
                tr.setAttribute("data-telefono", row.Telefono || "");
                
                var rawDate = row.DataConsegna;
                var dt = parseAnyDate(rawDate);
                if (!dt || isNaN(dt.getTime())) dt = new Date();
                var dtStr = Pad(dt.getDate()) + "/" + Pad(dt.getMonth()+1) + "/" + dt.getFullYear();
                var mesiEN = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
                var mIdx = dt.getMonth();
                var meseNome = (mIdx >= 0 && mIdx < 12) ? mesiEN[mIdx] : "Gennaio";
                
                var badgeCls = "badge-pending";
                if (stato === "CONSEGNATO") badgeCls = "badge-success";
                else if (stato === "COMPLETATA") badgeCls = "badge-completed";
                else if (stato === "CONFERMATO") badgeCls = "badge-confirmed";
                else if (stato === "DA CHIAMARE") badgeCls = "badge-tocall";
                
                var btnView = "<button class='btn-view-action' onclick='ApriDettaglioConsegna(" + id + ", event)' title='Vedi Dettaglio Consegna'>" +
                              "<i class='fa fa-eye'></i>" +
                              "</button>";
                
                var btnDelete = "<button class='btn-delete-action' onclick='EliminaRecord(" + id + ", event)' title='Elimina Record'>" +
                                "<i class='fa fa-trash-o'></i>" +
                                "</button>";

                tr.innerHTML = "<td><span class='row-indicator'></span>" + id + "</td>" +
                               "<td>" + dtStr + "</td>" +
                               "<td class='col-mese'>" + meseNome.substring(0,3) + "</td>" +
                               "<td class='col-cliente'>" + nome + "</td>" +
                               "<td class='col-loc'>" + loc + "</td>" +
                               "<td class='col-stato'><span class='badge " + badgeCls + "'>" + stato + "</span></td>" +
                               "<td class='col-azioni'>" + btnView + btnDelete + "</td>";
                tr.onclick = function() { SelezionaRiga(this); };
                tbody.appendChild(tr);
            }
        }
        
        // Se non ci sono record visibili (magari filtrati da un Tag) mostriamo un feedback
        if (countRendered === 0) {
            tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding: 30px; color:#64748b; font-weight:700;'>Nessun record corrisponde al filtro selezionato.</td></tr>";
        }
        
        document.getElementById("lblConteggio").innerText = "Trovati: " + countQueryMatches + " record";
        
        // Aggiornamento Interfaccia Statistiche e DataViz
        var hasData = countQueryMatches > 0;
        var statsBar = document.getElementById("statsBar");
        var breakdownCont = document.getElementById("breakdownContainer");
        var quickTags = document.getElementById("quickTagsRow");
        
        if (statsBar) statsBar.style.display = hasData ? "flex" : "none";
        if (breakdownCont) breakdownCont.style.display = hasData ? "block" : "none";
        if (quickTags) quickTags.style.display = hasData ? "flex" : "none";
        
        if (hasData) {
            // 1. Compila i KPI con Animazione Count-Up Premium Real-Time
            AnimateCounterDash(document.getElementById("statTotal"), countQueryMatches);
            var successTotal = cDel + cComp;
            var perc = Math.round((successTotal / countQueryMatches) * 100);
            AnimateCounterDash(document.getElementById("statSuccess"), perc, "%");
            var warningTotal = cCall + cPend;
            AnimateCounterDash(document.getElementById("statWarning"), warningTotal);
            
            // 2. Costruisce dinamicamente la barra dei segmenti (Breakdown Progress Bar)
            var pDel = (cDel / countQueryMatches) * 100;
            var pComp = (cComp / countQueryMatches) * 100;
            var pConf = (cConf / countQueryMatches) * 100;
            var pCall = (cCall / countQueryMatches) * 100;
            var pPend = (cPend / countQueryMatches) * 100;
            
            var bHtml = "";
            if(pDel > 0) bHtml += "<div class='seg seg-delivered' style='width:" + pDel + "%' title='Consegnato: " + cDel + " (" + Math.round(pDel) + "%)'></div>";
            if(pComp > 0) bHtml += "<div class='seg seg-completed' style='width:" + pComp + "%' title='Completata: " + cComp + " (" + Math.round(pComp) + "%)'></div>";
            if(pConf > 0) bHtml += "<div class='seg seg-confirmed' style='width:" + pConf + "%' title='Confermato: " + cConf + " (" + Math.round(pConf) + "%)'></div>";
            if(pCall > 0) bHtml += "<div class='seg seg-tocall' style='width:" + pCall + "%' title='Da Chiamare: " + cCall + " (" + Math.round(pCall) + "%)'></div>";
            if(pPend > 0) bHtml += "<div class='seg seg-pending' style='width:" + pPend + "%' title='Pendente: " + cPend + " (" + Math.round(pPend) + "%)'></div>";
            
            document.getElementById("breakdownBar").innerHTML = bHtml;
        }
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>Errore Database: " + e.message + "</td></tr>";
    }
}

function SelezionaRiga(row) {
    try {
        var rows = document.querySelectorAll("#tbodyRisultati tr");
        for(var i=0; i<rows.length; i++) rows[i].classList.remove("selected");
        row.classList.add("selected");
        
        var id = row.getAttribute("data-id");
        var note = row.getAttribute("data-note") || "Nessuna nota logistica registrata per questa consegna.";
        var tel = row.getAttribute("data-telefono") || "";
        
        // Estrapola i dati dalle celle della riga cliccata
        var cells = row.getElementsByTagName("td");
        var dataStr = cells[1].innerText;
        var clienteStr = cells[3].innerText;
        var localitaStr = cells[4].innerText;
        var badgeHtml = cells[5].innerHTML;
        
        // Popola la Focus Card
        document.getElementById("focusCliente").innerText = clienteStr;
        document.getElementById("focusId").innerText = id;
        document.getElementById("focusData").innerText = dataStr;
        document.getElementById("focusLoc").innerText = localitaStr;
        document.getElementById("focusBadgeWrapper").innerHTML = badgeHtml;
        document.getElementById("focusNote").innerText = note;
        
        // Gestione Telefono e Pulsante Chiamata Rapida
        var telSpan = document.getElementById("focusTel");
        var callWrapper = document.getElementById("focusCallBtnWrapper");
        
        if (tel && tel.replace(/\s/g, '') !== "") {
            telSpan.innerText = tel;
            callWrapper.innerHTML = "<a href='tel:" + tel.replace(/\s/g, '') + "' class='focus-call-btn' title='Avvia chiamata con Skype / Telefono'>" +
                                    "<i class='fa fa-phone'></i>" +
                                    "</a>";
        } else {
            telSpan.innerText = "Non presente";
            callWrapper.innerHTML = "";
        }
        
        // Mostra pulsante di condivisione veloce Whatsapp
        var btnCopy = document.getElementById("btnCopiaDettagli");
        if (btnCopy) btnCopy.style.display = "inline-flex";
        
        // Aggiunge lo stato visivo "popolato"
        document.getElementById("focusCard").classList.add("has-data");
    } catch(e) {}
}

function EliminaRecord(id, event) {
    if(event) event.stopPropagation();
    if(confirm("Eliminare record #" + id + "?")) {
        try {
            queryAccessDB("DELETE FROM tblConsegne WHERE ID = " + id, true);
            CaricaDati();
        } catch(e) {}
    }
}

function SincronizzaExcel() { 
    if(confirm("ATTENZIONE AL FORMATO DEL FILE!\n\nPer un'importazione di successo assicurati che il file Excel sia salvato in formato \".CSV\" (delimitato dal separatore standard usato nell'esportazione).\n\nDevono essere presenti le classiche colonne: ID; DATA; MESE; CLIENTE; LOCALITA; STATO; NOTE.\n\nProcedere con la selezione del file?")) {
        document.getElementById("fileImportCSV").click();
    }
}

window.EseguiImportazioneCSV = function(inputElem) {
    if(!inputElem.value) return;
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    try {
        var filePath = inputElem.value;
        if(!fso.FileExists(filePath)) throw new Error("Il file non esiste più nel percorso.");
        
        var f = fso.OpenTextFile(filePath, 1); // ForReading = 1
        var rowCount = 0;
        var insertedCount = 0;
        
        while(!f.AtEndOfStream) {
            var line = f.ReadLine();
            rowCount++;
            // Salta intestazione
            if(rowCount === 1) continue;
            
            // Il formato esportato da questo gestionale è separato da punto e virgola
            var parts = line.split(";");
            if(parts.length >= 6) {
                var rawData = parts[1].trim(); 
                // data format comes as 01/01/2026 => D/M/Y
                var pDate = rawData.split("/");
                var sqlData = "NULL";
                var yr = new Date().getFullYear();
                if(pDate.length === 3) {
                    sqlData = "'" + pDate[2] + "-" + pDate[1] + "-" + pDate[0] + "'";
                    yr = parseInt(pDate[2]);
                }
                
                var cl = parts[3] ? parts[3].replace(/'/g, "''").trim() : "";
                var loc = parts[4] ? parts[4].replace(/'/g, "''").trim() : "";
                var stat = parts[5] ? parts[5].replace(/'/g, "''").trim() : "PENDENTE";
                var not = (parts.length >= 7 && parts[6]) ? parts[6].replace(/'/g, "''").trim() : "";
                
                if(cl.length > 0) {
                    var sqlIns = "INSERT INTO tblConsegne (DataConsegna, ClienteNome, LocalitaConsegna, Stato, Note, AnnoRiferimento) VALUES (" + 
                                 sqlData + ", '" + cl + "', '" + loc + "', '" + stat + "', '" + not + "', " + yr + ")";
                    
                    try {
                        queryAccessDB(sqlIns, true);
                        insertedCount++;
                    } catch(errIns) {
                        // Salta riga se fallisce e vai alla prossima
                    }
                }
            }
        }
        f.Close();
        
        // Svuotiamo l'input per poter ricaricare lo stesso file in futuro
        inputElem.value = "";
        
        alert("✔️ IMPORTAZIONE EXCEL COMPLETATA VITTORIOSAMENTE!\n\nSono state lette " + (rowCount-1) + " righe e sono stati inseriti con successo " + insertedCount + " nuovi record nel database.");
        CaricaDati(); // Aggiorna i dati
        
    } catch(ex) {
        alert("Errore critico durante la lettura del file Excel/CSV: " + ex.message);
        // Svuotiamo l'input nel caso di errore generico
        inputElem.value = "";
    }
};

window.NavigaModulo = function(modulo) {
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
        
        // CHIUSURA ATOMICA per liberare il database immediatamente
        isClosing = true;
        window.close();
    } catch(e) {
        if (window.location.pathname.toLowerCase().indexOf("file_sistema") > -1) {
            window.location.href = modulo;
        } else {
            window.location.href = "File_Sistema/" + modulo;
        }
    }
};

window.ApriDettaglioConsegna = function(id, event) {
    if (event) event.stopPropagation();
    try {
        if (window.parent && typeof window.parent.ApriModulo === "function" && window.parent !== window) {
            window.parent.ApriModulo("consegne.html?id=" + id);
            return;
        }
    } catch(eParent) {}
    isNavigating = true;
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var targetHta = fso.BuildPath(currentDir, "consegne.html");
        var runCmd = 'mshta.exe "' + targetHta + '?id=' + id + '"';
        shell.Run(runCmd, 1, false);
        
        isClosing = true;
        window.close();
    } catch(e) {
        alert("Errore durante il reindirizzamento al modulo consegne:\n" + e.message);
        isNavigating = false;
    }
};

function ActionEsci() {
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
    try {
        var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    } catch(e) {}
    window.close();
}

function EsportaDati(tipo) {
    var tbody = document.getElementById("tbodyRisultati");
    var rows = tbody.getElementsByTagName("tr");
    
    if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.indexOf("corso") !== -1) || (rows.length === 1 && rows[0].innerText.indexOf("Errore") !== -1)) {
        alert("Attenzione: Nessun dato disponibile in griglia per l'esportazione.");
        return;
    }

    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var wsh = new ActiveXObject("WScript.Shell");
    var deskPath = wsh.SpecialFolders("Desktop");
    var dTime = new Date();
    var strTime = dTime.getFullYear() + Pad(dTime.getMonth()+1) + Pad(dTime.getDate()) + "_" + Pad(dTime.getHours()) + Pad(dTime.getMinutes());

    if (tipo === 'pdf') {
        // ESPORTAZIONE PDF TRAMITE EXCEL AUTOMATION CON FORMATTAZIONE PREMIUM
        var wb = null;
        var xl = null;
        try {
            var fName = "Report_Storico_Consegne_" + strTime + ".pdf";
            var pdfPath = fso.BuildPath(deskPath, fName);
            
            xl = new ActiveXObject("Excel.Application");
            xl.Visible = false;
            xl.DisplayAlerts = false;
            
            wb = xl.Workbooks.Add();
            var sh = wb.ActiveSheet;
            sh.Name = "Storico Consegne";
            
            // Stile Globale Font
            sh.Cells.Font.Name = "Segoe UI";
            sh.Cells.Font.Size = 10;
            
            // Intestazione Principale Aziendale
            sh.Range("A1:G1").Merge();
            sh.Range("A1").Value = "C. MILELLA LOGISTICA - REPORT ARCHIVIO STORICO CONSEGNE";
            sh.Range("A1").Font.Bold = true;
            sh.Range("A1").Font.Size = 16;
            sh.Range("A1").Font.Color = 0xFFFFFF;
            sh.Range("A1").Interior.Color = 0x9E5A00; // Blu Zenith
            sh.Range("A1").HorizontalAlignment = -4108; // xlCenter
            sh.Range("A1").VerticalAlignment = -4108;
            sh.Rows(1).RowHeight = 38;
            
            sh.Range("A2:G2").Merge();
            sh.Range("A2").Value = "Documento generato il: " + Pad(dTime.getDate()) + "/" + Pad(dTime.getMonth()+1) + "/" + dTime.getFullYear() + " alle " + Pad(dTime.getHours()) + ":" + Pad(dTime.getMinutes());
            sh.Range("A2").Font.Italic = true;
            sh.Range("A2").Font.Size = 9;
            sh.Range("A2").Font.Color = 0x555555;
            sh.Range("A2").HorizontalAlignment = -4108;
            
            // Intestazione Tabella
            var headers = ["ID CONSEGNA", "DATA", "MESE", "CLIENTE / DESTINATARIO", "LOCALITÀ", "STATO", "NOTE E DETTAGLI"];
            for (var c = 0; c < headers.length; c++) {
                var cell = sh.Cells(4, c + 1);
                cell.Value = headers[c];
                cell.Font.Bold = true;
                cell.Font.Color = 0x333333;
                cell.Interior.Color = 0xF1F5F9;
                cell.Borders.LineStyle = 1;
                cell.HorizontalAlignment = -4108;
            }
            sh.Rows(4).RowHeight = 24;
            
            var xlRow = 5;
            var countExp = 0;
            for (var i = 0; i < rows.length; i++) {
                var tr = rows[i];
                var idCheck = tr.getAttribute("data-id");
                if (!idCheck) continue;
                
                var cells = tr.getElementsByTagName("td");
                if (cells.length < 6) continue;
                
                sh.Cells(xlRow, 1).Value = idCheck;
                sh.Cells(xlRow, 2).Value = cells[1].innerText.trim();
                sh.Cells(xlRow, 3).Value = cells[2].innerText.trim();
                sh.Cells(xlRow, 4).Value = cells[3].innerText.trim();
                sh.Cells(xlRow, 5).Value = cells[4].innerText.trim();
                sh.Cells(xlRow, 6).Value = cells[5].innerText.trim();
                sh.Cells(xlRow, 7).Value = (tr.getAttribute("data-note") || "").replace(/(\r\n|\n|\r)/gm, " ");
                
                sh.Cells(xlRow, 1).HorizontalAlignment = -4108;
                sh.Cells(xlRow, 2).HorizontalAlignment = -4108;
                sh.Cells(xlRow, 3).HorizontalAlignment = -4108;
                
                for(var col=1; col<=7; col++) {
                    sh.Cells(xlRow, col).Borders.LineStyle = 1;
                    sh.Cells(xlRow, col).Borders.Color = 0xE2E8F0;
                }
                
                var stUpper = cells[5].innerText.trim().toUpperCase();
                var colorFg = 0x000000;
                if(stUpper === "CONSEGNATO") colorFg = 0x15803D;
                else if(stUpper === "COMPLETATA") colorFg = 0x0369A1;
                else if(stUpper === "DA CHIAMARE") colorFg = 0xB91C1C;
                sh.Cells(xlRow, 6).Font.Color = colorFg;
                sh.Cells(xlRow, 6).Font.Bold = true;

                xlRow++;
                countExp++;
            }
            
            sh.Columns("A:G").AutoFit();
            sh.Columns("D").ColumnWidth = 35;
            sh.Columns("E").ColumnWidth = 25;
            sh.Columns("G").ColumnWidth = 45;
            sh.Columns("G").WrapText = true;
            
            sh.PageSetup.Orientation = 2; // Landscape
            sh.PageSetup.Zoom = false;
            sh.PageSetup.FitToPagesWide = 1;
            sh.PageSetup.FitToPagesTall = false;
            
            wb.ExportAsFixedFormat(0, pdfPath); // xlTypePDF = 0
            
            wb.Close(false);
            xl.Quit();
            
            alert("📄 REPORT PDF GENERATO CON SUCCESSO!\n\nIl documento è stato salvato sul tuo Desktop:\n" + fName + "\n\nSi aprirà ora per la stampa.");
            wsh.Run('"' + pdfPath + '"');
            
        } catch(err) {
            try { if(wb) wb.Close(false); if(xl) xl.Quit(); } catch(eIgnore){}
            alert("Errore critico durante la generazione del PDF:\n\n" + err.message + "\n\nAssicurati che Microsoft Excel sia regolarmente installato su questa macchina.");
        }
        return;
    }

    // ESPORTAZIONE EXCEL VELOCE (CSV)
    try {
        var fileName = "Storico_Consegne_" + strTime + ".csv";
        var filePath = fso.BuildPath(deskPath, fileName);
        var f = fso.CreateTextFile(filePath, true);
        
        f.WriteLine("ID;DATA;MESE;CLIENTE;LOCALITA;STATO;NOTE AGGIUNTIVE");
        
        var rowCount = 0;
        for (var i = 0; i < rows.length; i++) {
            var tr = rows[i];
            var idCheck = tr.getAttribute("data-id");
            if (!idCheck) continue;
            
            var cells = tr.getElementsByTagName("td");
            if (cells.length < 6) continue;
            
            var id = cells[0].innerText.trim();
            var data = cells[1].innerText.trim();
            var mese = cells[2].innerText.trim();
            var cliente = cells[3].innerText.trim().replace(/;/g, ",");
            var localita = cells[4].innerText.trim().replace(/;/g, ",");
            var stato = cells[5].innerText.trim();
            var note = (tr.getAttribute("data-note") || "").replace(/(\r\n|\n|\r)/gm, " ").replace(/;/g, ",");
            
            f.WriteLine(id + ";" + data + ";" + mese + ";" + cliente + ";" + localita + ";" + stato + ";" + note);
            rowCount++;
        }
        f.Close();
        
        alert("📊 Estrazione Excel (CSV) Terminata!\n\nSono stati esportati " + rowCount + " record.\nIl file è stato generato sul Desktop:\n" + fileName);
        wsh.Run('"' + filePath + '"');
        
    } catch(e) {
        alert("Errore durante l'esportazione Excel:\n\n" + e.message);
    }
}
function ApriConnessione() {
    return null;
}

function ControlloData(d) { return /^\d{2}\/\d{2}\/\d{4}$/.test(d); }
function FormattaDataSQL(d) { var p = d.split("/"); return p[2] + "-" + p[1] + "-" + p[0]; }
function Pad(n) { return (n < 10 ? '0' : '') + n; }

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

/* --- CLASSIC MENU BAR LOGIC --- */
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

function parseAnyDate(v) {
    if (!v) return null;
    
    var s = String(v);
    var parts = s.match(/\d+/g);
    if (parts && parts.length >= 3) {
        var gg, mm, aa;
        if (parts[0].length === 4) {
            aa = parseInt(parts[0], 10);
            mm = parseInt(parts[1], 10);
            gg = parseInt(parts[2], 10);
        } else {
            gg = parseInt(parts[0], 10);
            mm = parseInt(parts[1], 10);
            aa = parseInt(parts[2], 10);
            
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

    var n = Number(v);
    if (!isNaN(n) && n > 0) {
        if (n > 1000000000000) return new Date(n);
        if (n > 30000 && n < 60000) return new Date((n - 25569) * 86400000);
    }

    try {
        var d = new Date(v);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return d;
    } catch(e) {}
    
    return null;
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

function AutoCleanOldRecords() {
    try {
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        var yy = thirtyDaysAgo.getFullYear();
        var mm = thirtyDaysAgo.getMonth() + 1;
        var dd = thirtyDaysAgo.getDate();
        var dtStr = yy + "-" + (mm<10?'0':'') + mm + "-" + (dd<10?'0':'') + dd;
        var sql = "UPDATE tblConsegne SET Stato = 'COMPLETATA' WHERE (Stato IS NULL OR Stato = '' OR Stato = 'PENDENTE' OR Stato = 'DA CHIAMARE') AND DataConsegna < #" + dtStr + "#";
        queryAccessDB(sql, true);
    } catch(e) {}
}

function highlightText(text, search) {
    if(!search || !text) return text;
    var re = new RegExp("(" + search.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ")", "gi");
    return String(text).replace(re, "<mark style='background:#fef08a; padding:0 2px; border-radius:3px;'>$1</mark>");
}

function ToggleAllCheckboxes(source) {
    var checkboxes = document.querySelectorAll('.row-chk');
    for(var i=0; i<checkboxes.length; i++) checkboxes[i].checked = source.checked;
    UpdateBulkToolbar();
}

function UpdateBulkToolbar() {
    var checkboxes = document.querySelectorAll('.row-chk:checked');
    var count = checkboxes.length;
    var toolbar = document.getElementById('bulkToolbar');
    var countLabel = document.getElementById('bulkCount');
    if(toolbar && countLabel) {
        if(count > 0) { toolbar.style.display = 'flex'; countLabel.innerText = count; }
        else toolbar.style.display = 'none';
    }
}

function BulkAzione(azione) {
    var checkboxes = document.querySelectorAll('.row-chk:checked');
    var ids = [];
    for(var i=0; i<checkboxes.length; i++) ids.push(checkboxes[i].value);
    if(ids.length === 0) return;
    if(azione === 'ELIMINA') {
        if(!confirm("Vuoi eliminare definitivamente " + ids.length + " pratiche?")) return;
        queryAccessDB("DELETE FROM tblConsegne WHERE ID IN (" + ids.join(",") + ")", true);
        if(typeof window.ToastManager !== 'undefined') window.ToastManager.success("Pratiche eliminate.");
    } else if(azione === 'COMPLETATA') {
        if(!confirm("Vuoi segnare " + ids.length + " pratiche come COMPLETATA?")) return;
        queryAccessDB("UPDATE tblConsegne SET Stato = 'COMPLETATA' WHERE ID IN (" + ids.join(",") + ")", true);
        if(typeof window.ToastManager !== 'undefined') window.ToastManager.success("Pratiche aggiornate.");
    }
    var chkAll = document.getElementById('chkAll');
    if(chkAll) chkAll.checked = false;
    UpdateBulkToolbar();
    CaricaDati();
}

window.AzzeraDaLavorare = function() {
    try {
        var countEl = document.getElementById("statWarning");
        var count = countEl ? countEl.innerText : "0";
        if(count === "0") {
            alert("Non ci sono record 'Da Lavorare' da azzerare.");
            return;
        }
        if(confirm("Vuoi segnare come COMPLETATA tutti i " + count + " record attualmente in sospeso (Da Lavorare)?\nL'operazione non può essere annullata.")) {
            var sql = "UPDATE tblConsegne SET Stato = 'COMPLETATA' WHERE Stato IS NULL OR Stato = '' OR Stato = 'PENDENTE' OR Stato = 'DA CHIAMARE'";
            queryAccessDB(sql, true);
            if(typeof window.ToastManager !== 'undefined') window.ToastManager.success("Tutti i record in sospeso sono stati completati!");
            CaricaDati();
        }
    } catch(e) {
        alert("Errore durante l'azzeramento: " + e.message);
    }
};

