/* permessi_hta.js - Logica ERP Classic (Danea Style) */

var fso = null;
try { if (typeof ActiveXObject !== "undefined") fso = new ActiveXObject("Scripting.FileSystemObject"); } catch(e) {}
var pathEval = document.location.pathname || "";
if (pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
var currentDir = fso ? fso.GetParentFolderName(pathEval) : "";
var dbPath = fso ? fso.BuildPath(currentDir, "ConsegneDB.accdb") : "ConsegneDB.accdb";
if (fso && !fso.FileExists(dbPath)) {
    dbPath = fso.BuildPath(fso.GetParentFolderName(currentDir), "ConsegneDB.accdb");
}

// Schema Update and Persistence
var festivitCustom = {}; // Cache: {"DD/MM": "Nome"}
var isRedirecting = false; // Flag per navigazione
var isClosing = false;    // Flag di sicurezza anti-loop

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
        if (http.setRequestHeader) http.setRequestHeader("Content-Type", "application/json");
        http.send(JSON.stringify({ sql: sql }));

        var status = http.status || http.Status;
        var respText = http.responseText || http.ResponseText;

        if (status === 200) {
            var res = JSON.parse(respText);
            return isUpdate ? true : res;
        }
    } catch(errReq) {}
    return isUpdate ? false : [];
}

(function EnsureSchema() {
    try {
        // Create tblDipendenti if missing
        try { queryAccessDB("CREATE TABLE IF NOT EXISTS tblDipendenti (ID INTEGER PRIMARY KEY AUTOINCREMENT, CognomeNome TEXT UNIQUE, LuogoNascita TEXT, DataNascita TEXT, Indirizzo TEXT, Ha104 INTEGER DEFAULT 0)", true); } catch(e) {}
        // Add Columns if missing
        try { queryAccessDB("ALTER TABLE tblDipendenti ADD COLUMN Ha104 INTEGER", true); } catch(e) {}
        try { queryAccessDB("ALTER TABLE tblDipendenti ADD COLUMN LuogoNascita TEXT", true); } catch(e) {}
        try { queryAccessDB("ALTER TABLE tblDipendenti ADD COLUMN DataNascita TEXT", true); } catch(e) {}
        try { queryAccessDB("ALTER TABLE tblDipendenti ADD COLUMN Indirizzo TEXT", true); } catch(e) {}
        
        // Tabella Log Black Box
        try {
            queryAccessDB("CREATE TABLE tblLogs_Permessi (ID INTEGER PRIMARY KEY AUTOINCREMENT, DataOra TEXT, Dipendente TEXT, Tipo TEXT, Note TEXT)", true);
        } catch(e) {}
        // Tabella Festivita Personalizzate
        try {
            queryAccessDB("CREATE TABLE tblFestivita (GiornoMese TEXT PRIMARY KEY, NomeFesta TEXT)", true);
            try { queryAccessDB("INSERT INTO tblFestivita (GiornoMese, NomeFesta) VALUES ('08/05', 'San Nicola (Bari)')", true); } catch(e) {}
        } catch(e) {}
        
        // Caricamento in Cache
        var rows = queryAccessDB("SELECT * FROM tblFestivita", false);
        for (var i = 0; i < rows.length; i++) {
            festivitCustom[rows[i].GiornoMese] = rows[i].NomeFesta;
        }
    } catch(e) {}
})();

var selectedDipendente = null;
var dipendentiCache = [];
var opMode = "existing"; // "existing" o "new"
var isRedirecting = false;

window.onload = function() {
    InitTheme();
    CaricaListaDipendenti();
    AggiornaVistaParametri();
    ToggleOpMode('existing');
    try { StartTitleClock(); } catch(e) {}
    try { CaricaProfiloUtente(); } catch(e) {}
    try { document.getElementById("cmbDipendente").focus(); } catch(e) {}
};

function InitTheme() {
    var shell = new ActiveXObject("WScript.Shell");
    try {
        var theme = shell.RegRead("HKEY_CURRENT_USER\\Software\\SistemaLogistica\\Theme");
        if (theme === "high-contrast") {
            document.body.setAttribute("data-theme", "high-contrast");
            document.getElementById("btnAccessibility").innerText = "Tema Normale";
        }
    } catch(e) {}
}

function ToggleHighContrast() {
    var body = document.body;
    var btn = document.getElementById("btnAccessibility");
    var shell = new ActiveXObject("WScript.Shell");
    
    if (body.getAttribute("data-theme") === "high-contrast") {
        body.removeAttribute("data-theme");
        btn.innerText = "Alto Contrasto";
        try { shell.RegWrite("HKEY_CURRENT_USER\\Software\\SistemaLogistica\\Theme", "standard", "REG_SZ"); } catch(e) {}
    } else {
        body.setAttribute("data-theme", "high-contrast");
        btn.innerText = "Tema Normale";
        try { shell.RegWrite("HKEY_CURRENT_USER\\Software\\SistemaLogistica\\Theme", "high-contrast", "REG_SZ"); } catch(e) {}
    }
}

// === SELECTION LOGIC ===
function ToggleOpMode(mode) {
    opMode = mode;
    var isNew = (mode === "new");
    
    // UI Feedback
    document.getElementById("boxAnagrafica").className = "platinum-card";
    document.getElementById("groupExisting").style.opacity = "1";
    
    // Enable/Disable inputs (Always editable to allow updates)
    document.getElementById("m_Nome").readOnly = false;
    document.getElementById("m_Luogo").readOnly = false;
    document.getElementById("m_Data").readOnly = false;
    document.getElementById("m_Indirizzo").readOnly = false;
    
    if (isNew) {
        selectedDipendente = null; // Forza il reset se creiamo un nuovo dipendente
        try { document.getElementById("cmbDipendente").value = ""; } catch(e) {}
        if (document.getElementById("lblDatiEsistenti")) {
            document.getElementById("lblDatiEsistenti").innerText = "Nessun dipendente selezionato";
        }
        document.getElementById("m_Nome").value = "";
        document.getElementById("m_Luogo").value = "";
        document.getElementById("m_Data").value = "";
        document.getElementById("m_Indirizzo").value = "";
    } else {
        // Se torniamo a existing, ripopoliamo se c'Ã¨ un selezionato
        if (selectedDipendente) OnDipendenteChange();
    }
    AggiornaAnteprima();
}

function CaricaListaDipendenti() {
    var cmb = document.getElementById("cmbDipendente");
    cmb.options.length = 1; 
    dipendentiCache = [];

    try {
        var rows = queryAccessDB("SELECT * FROM tblDipendenti ORDER BY CognomeNome ASC", false);
        for(var i=0; i<rows.length; i++) {
            var row = rows[i];
            var dip = {
                id: row.ID,
                nome: row.CognomeNome,
                luogo: row.LuogoNascita,
                dataN: row.DataNascita ? FormatVBDato(row.DataNascita) : "",
                indirizzo: row.Indirizzo,
                ha104: (row.Ha104 == 1 || row.Ha104 == "Si" || row.Ha104 === true)
            };
            dipendentiCache.push(dip);
            var opt = document.createElement("option");
            opt.value = dip.id;
            opt.text = dip.nome;
            cmb.options[cmb.options.length] = opt;
        }
    } catch(e) {}
}

function OnDipendenteChange() {
    var cmb = document.getElementById("cmbDipendente");
    var id = cmb.value;
    selectedDipendente = null;
    
    // Reset pulsante gestione
    var btnSalva = document.getElementById("btnSalvaAnagrafica");
    var btnElimina = document.getElementById("btnEliminaAnagrafica");
    if (btnSalva) btnSalva.innerText = "SALVA DIPENDENTE";
    if (btnElimina) btnElimina.style.display = "none";
    if (document.getElementById("lblDatiEsistenti")) {
        document.getElementById("lblDatiEsistenti").innerText = "Nessun dipendente selezionato";
    }
    if (document.getElementById("lblSaldoFerie")) {
        document.getElementById("lblSaldoFerie").style.display = "none";
    }

    for (var i = 0; i < dipendentiCache.length; i++) {
        if (dipendentiCache[i].id == id) {
            selectedDipendente = dipendentiCache[i];
            break;
        }
    }

    if (selectedDipendente) {
        if (document.getElementById("lblDatiEsistenti")) {
            document.getElementById("lblDatiEsistenti").innerText = "Dipendente selezionato: " + selectedDipendente.nome;
        }
        var saldoLabel = document.getElementById("lblSaldoFerie");
        if (saldoLabel) {
            var saldoBuste = SincronizzaDaBustePaga(selectedDipendente.nome);
            var saldo = saldoBuste !== null ? saldoBuste : selectedDipendente.GiorniFerieResidui;
            if (saldo === undefined || saldo === null) saldo = 26;
            
            if (saldoBuste !== null) {
                saldoLabel.innerHTML = "Saldo Ferie Residuo: <b>" + saldo + "</b> giorni (da Busta Paga)";
                saldoLabel.style.color = "#10b981"; // Verde smeraldo per indicare sync avvenuto
            } else {
                saldoLabel.innerHTML = "Saldo Ferie Residuo: <b>" + saldo + "</b> giorni";
                saldoLabel.style.color = "#d4af37";
            }
            saldoLabel.style.display = "inline";
        }
        document.getElementById("m_Nome").value = selectedDipendente.nome;
        document.getElementById("m_Luogo").value = selectedDipendente.luogo || "";
        document.getElementById("m_Data").value = selectedDipendente.dataN || "";
        document.getElementById("m_Indirizzo").value = selectedDipendente.indirizzo || "";
        
        if (btnSalva) btnSalva.innerText = "AGGIORNA DATI";
        if (btnElimina) btnElimina.style.display = "block";
        
        // Gestione eligibilitÃ  Legge 104
        var btn104 = document.getElementById("btnToggle104");
        if (btn104) {
            btn104.style.display = "block";
            btn104.innerHTML = selectedDipendente.ha104 ? "ðŸ”“" : "ðŸ”’";
            btn104.title = selectedDipendente.ha104 ? "ABILITATO Legge 104 (Clicca per bloccare)" : "NON ABILITATO (Clicca per sbloccare)";
        }
        
        // Dropdown Tipi sempre completo
        var cmbT = document.getElementById("cmbTipo");
        var valPrima = cmbT.value;
        cmbT.options.length = 0;
        cmbT.options[cmbT.options.length] = new Option("Ferie", "Ferie");
        cmbT.options[cmbT.options.length] = new Option("Permesso (ROL)", "Permesso (ROL)");
        cmbT.options[cmbT.options.length] = new Option("Ore di recupero", "Ore di recupero");
        cmbT.options[cmbT.options.length] = new Option("Legge 104/92", "Legge 104/92");
        
        cmbT.value = valPrima;
        AggiornaVistaParametri();
    }
    AggiornaAnteprima();
}

function NuovoDipendente() {
    document.getElementById("cmbDipendente").value = "";
    document.getElementById("m_Nome").value = "";
    document.getElementById("m_Luogo").value = "";
    document.getElementById("m_Data").value = "";
    document.getElementById("m_Indirizzo").value = "";
    selectedDipendente = null;
    
    var btnSalva = document.getElementById("btnSalvaAnagrafica");
    var btnElimina = document.getElementById("btnEliminaAnagrafica");
    if (btnSalva) btnSalva.innerText = "SALVA DIPENDENTE";
    if (btnElimina) btnElimina.style.display = "none";
    
    AggiornaAnteprima();
    document.getElementById("m_Nome").focus();
}

function SalvaDipendente() {
    var nome = document.getElementById("m_Nome").value;
    var luogo = document.getElementById("m_Luogo").value;
    var dataN = document.getElementById("m_Data").value;
    var indirizzo = document.getElementById("m_Indirizzo").value;

    if (!nome) { alert("Inserire almeno il nome del dipendente!"); return; }

    try {
        var sql = "";
        
        if (selectedDipendente) {
            // Aggiorna esistente
            sql = "UPDATE tblDipendenti SET " +
                  "CognomeNome = '" + nome.replace(/'/g, "''") + "', " +
                  "LuogoNascita = '" + luogo.replace(/'/g, "''") + "', " +
                  "DataNascita = " + (dataN ? "'" + dataN + "'" : "NULL") + ", " +
                  "Indirizzo = '" + indirizzo.replace(/'/g, "''") + "' " +
                  "WHERE ID = " + selectedDipendente.id;
        } else {
            // Inserisci nuovo
            sql = "INSERT INTO tblDipendenti (CognomeNome, LuogoNascita, DataNascita, Indirizzo) VALUES (" +
                  "'" + nome.replace(/'/g, "''") + "', " +
                  "'" + luogo.replace(/'/g, "''") + "', " +
                  (dataN ? "'" + dataN + "'" : "NULL") + ", " +
                  "'" + indirizzo.replace(/'/g, "''") + "')";
        }
        
        queryAccessDB(sql, true);
        alert("Dati anagrafici salvati correttamente!");
        CaricaListaDipendenti(); 
    } catch(e) {
        alert("Errore salvataggio anagrafica: " + e.message);
    }
    AggiornaAnteprima();
}

function FormatVBDato(v) {
    if (!v) return "";
    var s = String(v).replace(/^\s+|\s+$/g, ""); // Safe trim
    if (!s) return "";
    
    // Se Ã¨ giÃ  nel formato DD/MM/AAAA (es. 12/04/1968), lo restituiamo cosÃ¬ com'Ã¨
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        return s;
    }
    
    // Se Ã¨ in formato YYYY-MM-DD, lo convertiamo in DD/MM/AAAA
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
        var parts = s.split("-");
        var dd = parts[2]; if (dd.length < 2) dd = "0" + dd;
        var mm = parts[1]; if (mm.length < 2) mm = "0" + mm;
        return dd + "/" + mm + "/" + parts[0];
    }

    try {
        var d = new Date(s);
        if (isNaN(d.getTime())) return s;
        var dd = d.getDate(); if(dd<10) dd="0"+dd;
        var mm = d.getMonth()+1; if(mm<10) mm="0"+mm;
        return dd + "/" + mm + "/" + d.getFullYear();
    } catch(err) {
        return s;
    }
}

// === UI LOGIC ===
function AggiornaVistaParametri() {
    var tipo = document.getElementById("cmbTipo").value;
    var grpAl = document.getElementById("grpAl");
    var grpG = document.getElementById("groupGiorni");
    var lblDal = document.getElementById("lblDateDal");
    var grpConfig = document.getElementById("grpConfig");
    var extra = document.getElementById("extraParams");
    var params104 = document.getElementById("params104");
    var grpStandardDates = document.getElementById("grpStandardDates");
    
    var colori = {
        "Ferie": "rgba(16, 185, 129, 0.25)",      // Emerald Tint
        "Permesso (ROL)": "rgba(59, 130, 246, 0.25)", // Sapphire Tint
        "Ore di recupero": "rgba(245, 158, 11, 0.25)", // Amber Tint
        "Legge 104/92": "rgba(168, 85, 247, 0.25)"   // Amethyst Tint
    };
    
    if (grpConfig) {
        grpConfig.style.background = colori[tipo] || "rgba(0, 0, 0, 0.3)";
        grpConfig.style.borderColor = (colori[tipo] || "rgba(255, 255, 255, 0.15)").replace("0.25", "0.5");
    }
    
    // Reset visibilitÃ 
    if (extra) extra.style.display = "none";
    if (params104) params104.style.display = "none";
    if (grpStandardDates) grpStandardDates.style.display = "flex";
    if (grpG) grpG.style.display = "block";

    if (tipo === "Ferie") {
        if (lblDal) lblDal.innerText = "DAL";
        if (grpAl) grpAl.style.display = "block";
    } else if (tipo === "Legge 104/92") {
        if (grpStandardDates) grpStandardDates.style.display = "none";
        if (params104) params104.style.display = "flex";
        if (grpG) grpG.style.display = "block";
    } else {
        // ROL / Recupero
        if (lblDal) lblDal.innerText = "IL GIORNO";
        if (grpAl) grpAl.style.display = "none";
        if (grpG) grpG.style.display = "none";
        if (extra) extra.style.display = "flex";
    }
    
    CalcolaEDinamizza();
}

function CalcolaEDinamizza() {
    ResetHighLight();
    var tipo = document.getElementById("cmbTipo").value;
    var count = 0;
    
    if (tipo === "Ferie") {
        var d1 = ParseITDate(document.getElementById("dateDal").value);
        var d2 = ParseITDate(document.getElementById("dateAl").value);
        if (d1 && d2) {
            if (d2 < d1) {
                document.getElementById("txtGiorni").value = "ERRORE DATE";
                document.getElementById("txtGiorni").style.color = "red";
            } else if (IsFestivo(d1.getDate(), d1.getMonth() + 1, d1.getFullYear())) {
                document.getElementById("txtGiorni").value = "DATA FESTIVA";
                document.getElementById("txtGiorni").style.color = "red";
            } else {
                count = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
                document.getElementById("txtGiorni").value = count;
                document.getElementById("txtGiorni").style.color = "var(--emerald)";
            }
        } else {
            document.getElementById("txtGiorni").value = "";
        }
    } else if (tipo === "Legge 104/92") {
        var d1_val = document.getElementById("date104_1").value;
        var d2_val = document.getElementById("date104_2").value;
        var d3_val = document.getElementById("date104_3").value;
        
        // Validazione in tempo reale (Bordi Rossi)
        if (d1_val) {
            var v1 = ParseITDate(d1_val);
            document.getElementById("date104_1").style.border = v1 ? "" : "2px solid red";
            if (v1) count++;
        }
        if (d2_val) {
            var v2 = ParseITDate(d2_val);
            document.getElementById("date104_2").style.border = v2 ? "" : "2px solid red";
            if (v2) count++;
        }
        if (d3_val) {
            var v3 = ParseITDate(d3_val);
            document.getElementById("date104_3").style.border = v3 ? "" : "2px solid red";
            if (v3) count++;
        }
        
        // Validazione Duplicati
        var arr = [];
        if (v1) arr.push({id:"date104_1", val:d1_val});
        if (v2) arr.push({id:"date104_2", val:d2_val});
        if (v3) arr.push({id:"date104_3", val:d3_val});
        
        for(var i=0; i<arr.length; i++) {
            for(var j=i+1; j<arr.length; j++) {
                if(arr[i].val === arr[j].val) {
                    document.getElementById(arr[i].id).style.border = "2px solid #f59e0b";
                    document.getElementById(arr[j].id).style.border = "2px solid #f59e0b";
                }
            }
        }
        
        document.getElementById("txtGiorni").value = count;
        document.getElementById("txtGiorni").style.color = "black";
    } else {
        // ROL / Recupero
        var dDal = document.getElementById("dateDal").value;
        if (dDal) {
            document.getElementById("dateDal").style.border = ParseITDate(dDal) ? "" : "2px solid red";
        }
        // Orario
        var h1 = document.getElementById("timeInizio").value;
        var h2 = document.getElementById("timeFine").value;
        // La validazione oraria completa avviene in GeneraPDF
    }
    AggiornaAnteprima();
}

function ValidaRangeOrario(h1, h2) {
    var minTime = "07:00";
    var maxTime = "20:00";
    
    if (h1 < minTime || h1 > maxTime || h2 < minTime || h2 > maxTime) return false;
    if (h1 >= h2) return false;
    return true;
}

function ParseITDate(s) {
    if (!s) return null;
    s = s.trim();
    // Validazione Regex Rigida: GG/MM/AAAA
    var regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    var match = s.match(regex);
    if (!match) return null;
    
    var d = parseInt(match[1], 10);
    var m = parseInt(match[2], 10);
    var y = parseInt(match[3], 10);
    
    var dateObj = new Date(y, m - 1, d);
    
    // Verifica che l'oggetto Date sia coerente con i dati (evita 31/02/2024 -> 02/03/2024)
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== (m - 1) || dateObj.getDate() !== d) {
        return null;
    }
    
    return dateObj;
}

function AggiornaAnteprima() {
    var preview = document.getElementById("previewArea");
    var nome = document.getElementById("m_Nome").value;
    if (!nome) {
        preview.innerHTML = "<div style='display:flex; align-items:center; justify-content:center; height:100%; color:#94a3b8; font-style:italic;'>Indicare il dipendente e il tipo di richiesta...</div>";
        return;
    }

    var luogo = document.getElementById("m_Luogo").value;
    var dataN = document.getElementById("m_Data").value;
    var ind = document.getElementById("m_Indirizzo").value;
    var tipo = document.getElementById("cmbTipo").value;
    var d_oggi = new Date();
    var oggi = (d_oggi.getDate() < 10 ? '0' : '') + d_oggi.getDate() + "/" + 
               ((d_oggi.getMonth() + 1) < 10 ? '0' : '') + (d_oggi.getMonth() + 1) + "/" + 
               d_oggi.getFullYear();

    // Header Comune a tutti i modelli
    var html = "<div style='font-family:\"Times New Roman\", serif; color:#000; line-height:1.4;'>" +
               "<div style='text-align:left; margin-bottom:30px; font-size:14px;'>" +
               "Alla c. a. Presidente<br>" +
               "Della Societ&agrave; Cooperativa Sociale Aurelio Nicolodi<br>" +
               "Sig. Giuseppe Simone" +
               "</div>" +
               "<div style='font-weight:bold; text-decoration:underline; margin-bottom:25px; text-transform:uppercase;'>" +
               "Oggetto: richiesta permessi (" + (tipo === "Legge 104/92" ? "Legge 104/92" : (tipo === "Ferie" ? "Ferie" : "RoL")) + ")" +
               "</div>";

    var corpoText = "";
    var incipit = "Il sottoscritto <b>" + nome + "</b> nato a <b>" + luogo + "</b> il <b>" + dataN + 
                 "</b> e residente in <b>" + ind + "</b> in qualit&agrave; di dipendente di codesto Ente ";

    if (tipo === "Ferie") {
        var nG = parseInt(document.getElementById("txtGiorni").value) || 0;
        var labelG = (nG === 1) ? " giorno" : " giorni";
        corpoText = incipit + "chiede di poter usufruire del periodo di ferie dal <b>" + (document.getElementById("dateDal").value || "[DATA]") + 
                    "</b> al <b>" + (document.getElementById("dateAl").value || "[DATA]") + 
                    "</b> per un totale di n. <b>" + (nG || "...") + "</b> " + labelG + ".";
    } else if (tipo === "Legge 104/92") {
        var d1 = document.getElementById("date104_1").value;
        var d2 = document.getElementById("date104_2").value;
        var d3 = document.getElementById("date104_3").value;
        var dList = [];
        if (d1) dList.push("<b>" + d1 + "</b>");
        if (d2) dList.push("<b>" + d2 + "</b>");
        if (d3) dList.push("<b>" + d3 + "</b>");
        
        var dateStr = "";
        if (dList.length === 1) dateStr = "il giorno " + dList[0];
        else if (dList.length === 2) dateStr = "nei giorni " + dList[0] + " e " + dList[1];
        else if (dList.length >= 3) dateStr = "nei giorni " + dList[0] + ", " + dList[1] + " e " + dList[2];
        else dateStr = "[DATE NON INSERITE]";

        corpoText = incipit + "chiede di poter usufruire dei permessi Legge 104/92 " + dateStr + ".";
    } else {
        // ROL o RECUPERO
        var oreI = document.getElementById("timeInizio").value || "[ORA]";
        var oreF = document.getElementById("timeFine").value || "[ORA]";
        var giorno = document.getElementById("dateDal").value || "[DATA]";
        corpoText = incipit + "chiede di poter usufruire di un permesso (" + tipo + ") nel giorno <b>" + giorno + 
                    "</b> dalle ore <b>" + oreI + "</b> alle ore <b>" + oreF + "</b>.";
    }

    html += "<div style='text-align:justify; margin-bottom:30px; text-justify: inter-word;'>" + corpoText + "</div>" +
            "<div style='margin-bottom:40px;'>Certo di un riscontro positivo porgo cordiali saluti.</div>" +
            "<div style='margin-bottom:30px;'>Bari, " + oggi + "</div>" +
            "<div style='overflow:hidden;'>" +
              "<div style='float:left; width:50%; text-align:center;'>" +
                "Firma dipendente<br><br>___________________________<br>" + nome +
              "</div>" +
              "<div style='float:right; width:50%; text-align:center;'>" +
                "Per accettazione<br><br>___________________________<br>Il Presidente" +
              "</div>" +
            "</div>" +
            "</div>";
            
    preview.innerHTML = html;
}

function FormatDate(d) {
    if (!d) return "[DATA]";
    // Se Ã¨ giÃ  in formato GG/MM/AAAA lo restituiamo cosÃ¬
    if (d.indexOf("/") !== -1) return d;
    // Se Ã¨ in formato AAAA-MM-GG (residuo) lo convertiamo
    var p = d.split("-");
    if (p.length < 3) return d;
    return p[2] + "/" + p[1] + "/" + p[0];
}

function IsFestivo(d, m, y) {
    var dt = new Date(y, m - 1, d);
    
    // 1. Domenica
    if (dt.getDay() === 0) return true;
    
    // 2. FestivitÃ  Fisse
    if (d === 1 && m === 1) return true;   // Capodanno
    if (d === 6 && m === 1) return true;   // Epifania
    if (d === 25 && m === 4) return true;  // Liberazione
    if (d === 1 && m === 5) return true;   // Lavoro
    if (d === 2 && m === 6) return true;   // Repubblica
    if (d === 15 && m === 8) return true;  // Ferragosto
    if (d === 1 && m === 11) return true;  // Ognissanti
    if (d === 8 && m === 12) return true;  // Immacolata
    if (d === 25 && m === 12) return true; // Natale
    if (d === 26 && m === 12) return true; // S. Stefano
    
    // 3. FestivitÃ  Mobili (Pasquetta)
    var a = y % 19, b = Math.floor(y / 100), c = y % 100,
        de = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - de - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        ma = Math.floor((a + 11 * h + 22 * l) / 451),
        mP = Math.floor((h + l - 7 * ma + 114) / 31),
        dP = ((h + l - 7 * ma + 114) % 31) + 1;
        
    var dtPQ = new Date(y, mP - 1, dP);
    dtPQ.setDate(dtPQ.getDate() + 1);
    if (d === dtPQ.getDate() && m === (dtPQ.getMonth() + 1)) return true;
    
    // 4. FestivitÃ  Personalizzate (Database)
    var key = (d < 10 ? "0" : "") + d + "/" + (m < 10 ? "0" : "") + m;
    if (typeof festivitCustom !== "undefined" && festivitCustom[key]) return true;

    return false;
}

function GeneraPDF() {
    // 1. Acquisizione Dati con Conversione Stringa Forzata
    var nome = String(document.getElementById("m_Nome").value || "");
    var luogo = String(document.getElementById("m_Luogo").value || "");
    var dataN = String(document.getElementById("m_Data").value || "");
    var ind = String(document.getElementById("m_Indirizzo").value || "");
    var dataDal = String(document.getElementById("dateDal").value || "");
    var dataAl = String(document.getElementById("dateAl").value || "");
    var tipo = String(document.getElementById("cmbTipo").value || "");
    
    ResetHighLight();
    
    // 2. Validazioni
    var errori = [];
    if (!nome) errori.push("m_Nome");
    if (tipo === "Ferie") {
        if (!dataDal) errori.push("dateDal");
        if (!dataAl) errori.push("dateAl");
    } else if (tipo === "Legge 104/92") {
        if (!document.getElementById("date104_1").value && !document.getElementById("date104_2").value && !document.getElementById("date104_3").value) {
            errori.push("date104_1");
        }
    } else {
        if (!dataDal) errori.push("dateDal");
        if (!document.getElementById("timeInizio").value) errori.push("timeInizio");
        if (!document.getElementById("timeFine").value) errori.push("timeFine");
    }

    if (errori.length > 0) {
        for (var i = 0; i < errori.length; i++) {
            var el = document.getElementById(errori[i]);
            if (el) el.style.border = "2px solid red";
        }
        alert("Attenzione: Compilare i campi obbligatori evidenziati.");
        return;
    }

    // 3. Controllo Accavallamento (Solo per Ferie)
    if (tipo === "Ferie" && dataDal && dataAl) {
        try {
            var overlapSql = "SELECT Dipendente FROM tblStoricoFerie WHERE Tipo = 'Ferie' AND ((DataDal <= '" + dataAl + "' AND DataAl >= '" + dataDal + "'))";
            var overlapRes = queryAccessDB(overlapSql, false);
            if (overlapRes && overlapRes.length > 0) {
                var people = [];
                for (var j = 0; j < overlapRes.length; j++) {
                    if (overlapRes[j].Dipendente !== nome && people.indexOf(overlapRes[j].Dipendente) === -1) {
                        people.push(overlapRes[j].Dipendente);
                    }
                }
                if (people.length > 0) {
                    if (!confirm("ATTENZIONE:\nNelle stesse date (o in parte) sono giÃ  in ferie:\n\n- " + people.join("\n- ") + "\n\nVuoi procedere comunque con la richiesta di " + nome + "?")) {
                        return;
                    }
                }
            }
        } catch(e) {}
    }

    ShowElegantConfirm("Confermi la generazione del documento PDF per <b style='color:#f3e5ab; font-size:16px;'>" + String(nome) + "</b>?", function(confirmed) {
        if (!confirmed) return;

        if (typeof opMode !== "undefined" && opMode === "new") {
            SalvaDatiNuovo();
        }

    // 4. Inizio Automazione Word via VBScript nativo (Fix per errori OLE/COM in JScript)
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var vbsPath = fso.BuildPath(currentDir, "tools\\export_permesso_word.vbs");
        
        var val104_1 = document.getElementById("date104_1") ? document.getElementById("date104_1").value : "";
        var val104_2 = document.getElementById("date104_2") ? document.getElementById("date104_2").value : "";
        var val104_3 = document.getElementById("date104_3") ? document.getElementById("date104_3").value : "";
        var valTime1 = document.getElementById("timeInizio") ? document.getElementById("timeInizio").value : "";
        var valTime2 = document.getElementById("timeFine") ? document.getElementById("timeFine").value : "";
        var valGiorni = document.getElementById("txtGiorni") ? document.getElementById("txtGiorni").value : "0";
        
        var argsArr = [nome, luogo, dataN, ind, tipo, dataDal, dataAl, 
            val104_1, val104_2, val104_3, valTime1, valTime2, valGiorni, currentDir
        ];
        
        var cmd = 'cscript //NoLogo "' + vbsPath + '"';
        for(var i=0; i<argsArr.length; i++) {
            var val = String(argsArr[i] || "").replace(/"/g, '""');
            cmd += ' "' + val + '"';
        }
        
        var tempOut = fso.BuildPath(fso.GetSpecialFolder(2).Path, "word_out_" + Math.floor(Math.random()*10000) + ".txt");
        cmd += ' > "' + tempOut + '"';
        
        shell.Run("cmd.exe /c " + cmd, 0, true);
        
        if (fso.FileExists(tempOut)) {
            var fOut = fso.OpenTextFile(tempOut, 1);
            var result = fOut.ReadAll();
            fOut.Close();
            try { fso.DeleteFile(tempOut, true); } catch(e){}
            
            if (result.indexOf("OK:") > -1) {
                var fp = result.split("OK:")[1].replace(/^\s+|\s+$/g, '');
                
                // Aggiornamento DB Saldo e Storico
                try {
                    var valGiorni = document.getElementById("txtGiorni") ? document.getElementById("txtGiorni").value : "0";
                    var amount = parseFloat(valGiorni) || 0;
                    var q1 = "INSERT INTO tblStoricoFerie (Dipendente, DataRichiesta, DataDal, DataAl, Giorni, Tipo) VALUES ('" + nome.replace(/'/g,"''") + "', datetime('now'), '" + dataDal + "', '" + dataAl + "', " + amount + ", '" + tipo + "')";
                    queryAccessDB(q1, true);

                    if (tipo === "Ferie" && amount > 0) {
                        var q2 = "UPDATE tblDipendenti SET GiorniFerieResidui = GiorniFerieResidui - " + amount + " WHERE CognomeNome = '" + nome.replace(/'/g,"''") + "'";
                        queryAccessDB(q2, true);
                    }
                } catch(eDB) {}

                alert("Richiesta generata con successo nella cartella di lavoro:\nArchivio_Permessi");
                LogOperazione(nome, tipo, "Generato file");
                shell.Run('"' + fp + '"', 1, false);
                shell.Run('explorer.exe "' + fso.GetParentFolderName(fp) + '"', 1, false);
            } else {
                alert("ERRORE SALVATAGGIO:\n" + result);
            }
        } else {
            alert("Errore sconosciuto durante l'esportazione.");
        }
        
    } catch(errG) {
        alert("ERRORE LANCIO SCRIPT:\n" + errG.message);
    }
    }); // Chiusura callback ShowElegantConfirm
}

// ==========================================
// FUNZIONE PER MODALE ELEGANTE ASINCRONO
// ==========================================
function ShowElegantConfirm(msg, callback) {
    var overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0"; overlay.style.left = "0";
    overlay.style.width = "100%"; overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.backdropFilter = "blur(4px)";

    var modal = document.createElement("div");
    modal.style.background = "linear-gradient(145deg, #0f172a 0%, #080c14 100%)";
    modal.style.border = "1px solid #d4af37";
    modal.style.borderRadius = "12px";
    modal.style.padding = "24px 32px";
    modal.style.width = "400px";
    modal.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(212, 175, 55, 0.2)";
    modal.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    modal.style.textAlign = "center";
    modal.style.color = "#e2e8f0";

    var icon = document.createElement("div");
    icon.innerHTML = "&#10068;"; 
    icon.style.fontSize = "36px";
    icon.style.color = "#d4af37";
    icon.style.marginBottom = "16px";
    icon.style.textShadow = "0 0 10px rgba(212, 175, 55, 0.4)";
    modal.appendChild(icon);

    var text = document.createElement("div");
    text.innerHTML = msg;
    text.style.fontSize = "15px";
    text.style.lineHeight = "1.5";
    text.style.marginBottom = "24px";
    modal.appendChild(text);

    var btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "center";
    btnContainer.style.gap = "16px";

    var btnNo = document.createElement("button");
    btnNo.innerText = "ANNULLA";
    btnNo.style.padding = "8px 20px";
    btnNo.style.border = "1px solid rgba(255,255,255,0.2)";
    btnNo.style.background = "rgba(255,255,255,0.05)";
    btnNo.style.color = "#e2e8f0";
    btnNo.style.borderRadius = "6px";
    btnNo.style.cursor = "pointer";
    btnNo.style.fontWeight = "600";
    btnNo.style.transition = "all 0.2s";
    btnNo.onmouseover = function() { this.style.background = "rgba(255,255,255,0.1)"; };
    btnNo.onmouseout = function() { this.style.background = "rgba(255,255,255,0.05)"; };

    var btnYes = document.createElement("button");
    btnYes.innerText = "CONFERMA";
    btnYes.style.padding = "8px 20px";
    btnYes.style.border = "none";
    btnYes.style.background = "linear-gradient(135deg, #d4af37 0%, #b8860b 100%)";
    btnYes.style.color = "#0b0f19";
    btnYes.style.borderRadius = "6px";
    btnYes.style.cursor = "pointer";
    btnYes.style.fontWeight = "bold";
    btnYes.style.boxShadow = "0 4px 10px rgba(212, 175, 55, 0.3)";
    btnYes.style.transition = "all 0.2s";
    btnYes.onmouseover = function() { this.style.transform = "translateY(-1px)"; this.style.boxShadow = "0 6px 15px rgba(212, 175, 55, 0.4)"; };
    btnYes.onmouseout = function() { this.style.transform = "translateY(0)"; this.style.boxShadow = "0 4px 10px rgba(212, 175, 55, 0.3)"; };

    btnNo.onclick = function() { 
        document.body.removeChild(overlay); 
        if(callback) setTimeout(function(){ callback(false); }, 10); 
    };
    
    btnYes.onclick = function() { 
        document.body.removeChild(overlay); 
        if(callback) setTimeout(function(){ callback(true); }, 10); 
    };

    btnContainer.appendChild(btnNo);
    btnContainer.appendChild(btnYes);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function SalvaDatiNuovo() {
    var nome = document.getElementById("m_Nome").value;
    var luogo = document.getElementById("m_Luogo").value;
    var data = document.getElementById("m_Data").value;
    var ind = document.getElementById("m_Indirizzo").value;

    var sql = "INSERT INTO tblDipendenti (CognomeNome, LuogoNascita, DataNascita, Indirizzo) VALUES ('" + 
              nome.replace(/'/g, "''") + "', '" + luogo.replace(/'/g, "''") + "', " + (data ? "'" + data + "'" : "NULL") + ", '" + ind.replace(/'/g, "''") + "')";
    
    try {
        queryAccessDB(sql, true);
        CaricaListaDipendenti(); // Ricarica dropdown
    } catch(e) { }
}

function NuovaRichiesta() {
    // Reset di tutta la maschera
    document.getElementById("cmbDipendente").selectedIndex = 0;
    selectedDipendente = null;
    document.getElementById("m_Nome").value = "";
    document.getElementById("m_Luogo").value = "";
    document.getElementById("m_Data").value = "";
    document.getElementById("m_Indirizzo").value = "";
    document.getElementById("dateDal").value = "";
    document.getElementById("dateAl").value = "";
    document.getElementById("txtGiorni").value = "";
    
    // Reset Radio Buttons a 'existing'
    var radios = document.getElementsByName("opMode");
    for(var i=0; i<radios.length; i++) {
        if(radios[i].value == "existing") radios[i].checked = true;
    }

    document.getElementById("lblDatiEsistenti").innerText = "Nessun dipendente selezionato";
    
    ToggleOpMode('existing');
    AggiornaVistaParametri();
}

// === CUSTOM CALENDAR LOGIC ===
var currentCalDate = new Date();
var activeTargetId = "";
var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function OpenCalendar(targetId) {
    activeTargetId = targetId;
    var currentVal = document.getElementById(targetId).value;
    var initDate = ParseITDate(currentVal);
    currentCalDate = initDate || new Date();
    
    document.getElementById("calendarBackdrop").style.display = "block";
    document.getElementById("calendarModal").style.display = "block";
    RenderCalendar();
}

function GetFestivitaInfo(d, m, y) {
    var dt = new Date(y, m, d);
    var dayStr = ((d < 10) ? "0" + d : d) + "/" + ((m + 1 < 10) ? "0" + (m + 1) : (m + 1));
    
    var fisse = {
        "01/01": "Capodanno",
        "06/01": "Epifania",
        "25/04": "Liberazione",
        "01/05": "Festa del Lavoro",
        "02/06": "Festa della Repubblica",
        "15/08": "Ferragosto",
        "01/11": "Ognissanti",
        "08/12": "Immacolata Concezione",
        "25/12": "Natale",
        "26/12": "Santo Stefano",
        "08/05": "San Nicola (Bari)"
    };
    
    if (fisse[dayStr]) return fisse[dayStr];
    if (festivitCustom[dayStr]) return festivitCustom[dayStr];
    
    var pasquetta = GetPasquetta(y);
    if (d === pasquetta.getDate() && m === pasquetta.getMonth() && y === pasquetta.getFullYear()) return "Luned\u00ec dell'Angelo";
    
    var pasqua = new Date(pasquetta);
    pasqua.setDate(pasqua.getDate() - 1);
    if (d === pasqua.getDate() && m === pasqua.getMonth() && y === pasqua.getFullYear()) return "Pasqua";

    if (dt.getDay() === 0) return "Domenica";
    return null;
}

function GetPasquetta(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31);
    var da = ((h + l - 7 * m + 114) % 31) + 1;
    var res = new Date(y, mo - 1, da);
    res.setDate(res.getDate() + 1);
    return res;
}

function CloseCalendar() {
    document.getElementById("calendarBackdrop").style.display = "none";
    document.getElementById("calendarModal").style.display = "none";
}

function GoToToday() {
    currentCalDate = new Date();
    RenderCalendar();
}

function ChangeMonth(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    RenderCalendar();
}

function RenderCalendar() {
    var year = currentCalDate.getFullYear();
    var month = currentCalDate.getMonth();
    
    document.getElementById("calMonthYear").innerText = mesi[month] + " " + year;
    
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    
    var startIdx = firstDay.getDay() - 1;
    if (startIdx < 0) startIdx = 6;
    
    var grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    
    for (var e = 0; e < startIdx; e++) {
        var div = document.createElement("div");
        div.className = "cal-day empty";
        grid.appendChild(div);
    }
    
    var today = new Date();
    for (var d = 1; d <= lastDay.getDate(); d++) {
        var div = document.createElement("div");
        div.className = "cal-day";
        div.innerText = d;
        var dObj = new Date(year, month, d);
        var dayOfWeek = dObj.getDay();
        var festiveName = GetFestivitaInfo(d, month, year);
        if (dayOfWeek === 6) div.className += " sat";
        if (festiveName) {
            div.className += " sun";
            div.title = festiveName;
        } else {
            div.title = "Doppio click per segnare come festivit\u00e0";
        }
        if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            div.className += " today";
        }
        div.onclick = (function(dv, mv, yv) { return function() { SelectDate(dv, mv, yv); }; })(d, month + 1, year);
        div.ondblclick = (function(dv, mv, yv) { return function() { ToggleFestaManuale(dv, mv, yv); }; })(d, month + 1, year);
        grid.appendChild(div);
    }
}

function ToggleFestaManuale(d, m, y) {
    var dayStr = ((d < 10) ? "0" + d : d) + "/" + ((m < 10) ? "0" + m : m);
    var attuale = festivitCustom[dayStr];
    
    try {
        if (attuale) {
            if (confirm("Rimuovere la festivitÃ  '" + attuale + "' per il giorno " + dayStr + "?")) {
                queryAccessDB("DELETE FROM tblFestivita WHERE GiornoMese = '" + dayStr + "'", true);
                delete festivitCustom[dayStr];
            }
        } else {
            var nome = prompt("Inserisci il nome della festivitÃ  per il giorno " + dayStr + " (es. San Nicola):", "");
            if (nome) {
                queryAccessDB("INSERT INTO tblFestivita (GiornoMese, NomeFesta) VALUES ('" + dayStr + "', '" + nome.replace(/'/g, "''") + "')", true);
                festivitCustom[dayStr] = nome;
            }
        }
        RenderCalendar(); // Aggiorna i colori
    } catch(e) {
        alert("Errore salvataggio festivitÃ : " + e.message);
    }
}

var isGestioneFeste = false;

function ToggleModoGestione() {
    isGestioneFeste = !isGestioneFeste;
    var btn = document.getElementById("btnGestioneFeste");
    if (isGestioneFeste) {
        btn.style.background = "#ef4444";
        btn.style.borderColor = "#ef4444";
        btn.style.color = "#fff";
        btn.innerText = "FINE GESTIONE";
        alert("MODALIT\u00c0 GESTIONE ATTIVATA\n\nOra puoi cliccare sui giorni per aggiungerli o rimuoverli dalle festivit\u00e0 senza chiudere il calendario.\n\nAl termine, riclicca su 'FINE GESTIONE'.");
    } else {
        btn.style.background = "#10b981";
        btn.style.borderColor = "#10b981";
        btn.style.color = "#000";
        btn.innerText = "GESTISCI FESTE";
    }
}

function SelectDate(d, m, y) {
    if (isGestioneFeste) {
        ToggleFestaManuale(d, m, y);
        return;
    }
    var formatted = (d < 10 ? "0" + d : d) + "/" + (m < 10 ? "0" + m : m) + "/" + y;
    var festa = GetFestivitaInfo(d, m - 1, y);
    if (festa) {
        alert("FESTIVITÃ€: " + formatted + " non puoi digitarla.");
        return;
    }
    // Sabato (6)
    if (new Date(y, m - 1, d).getDay() === 6) {
        alert("SABATO: " + formatted + " non puoi digitarla.");
        return;
    }
    document.getElementById(activeTargetId).value = formatted;
    CloseCalendar();
    CalcolaEDinamizza();
}

var activeTimeTargetId = "";
var selectedHour = "";
var selectedMinute = "";

function OpenTimePicker(targetId) {
    activeTimeTargetId = targetId;
    var currentVal = document.getElementById(targetId).value;
    if (currentVal.indexOf(":") !== -1) {
        selectedHour = currentVal.split(":")[0];
        selectedMinute = currentVal.split(":")[1];
    } else {
        selectedHour = "";
        selectedMinute = "";
    }
    document.getElementById("timeBackdrop").style.display = "block";
    document.getElementById("timeModal").style.display = "block";
    RenderTimePicker();
}

function CloseTimePicker() {
    document.getElementById("timeBackdrop").style.display = "none";
    document.getElementById("timeModal").style.display = "none";
}

function RenderTimePicker() {
    var hGrid = document.getElementById("hourGrid");
    var mGrid = document.getElementById("minuteGrid");
    hGrid.innerHTML = ""; mGrid.innerHTML = "";
    
    // Genera ORE (07 - 20)
    for (var h = 7; h <= 20; h++) {
        var hStr = (h < 10 ? "0" + h : h).toString();
        var div = document.createElement("div");
        div.className = "time-item" + (selectedHour === hStr ? " selected" : "");
        div.innerText = hStr;
        div.onclick = (function(val) { return function() { SelectHour(val); }; })(hStr);
        hGrid.appendChild(div);
        
        // Auto-scroll al valore selezionato se presente
        if (selectedHour === hStr) {
            setTimeout((function(el, grid){ return function() { grid.scrollTop = el.offsetTop - (grid.offsetHeight / 2) + (el.offsetHeight / 2); }; })(div, hGrid), 10);
        }
    }
    
    // Genera MINUTI (00 - 55 con intervallo 5 min)
    for (var m = 0; m <= 55; m += 5) {
        var mStr = (m < 10 ? "0" + m : m).toString();
        var div = document.createElement("div");
        div.className = "time-item" + (selectedMinute === mStr ? " selected" : "");
        div.innerText = mStr;
        div.onclick = (function(val) { return function() { SelectMinute(val); }; })(mStr);
        mGrid.appendChild(div);
        
        // Auto-scroll al valore selezionato se presente
        if (selectedMinute === mStr) {
            setTimeout((function(el, grid){ return function() { grid.scrollTop = el.offsetTop - (grid.offsetHeight / 2) + (el.offsetHeight / 2); }; })(div, mGrid), 10);
        }
    }
}

function SelectHour(h) { 
    selectedHour = h; 
    RenderTimePicker(); 
}

function SelectMinute(m) {
    selectedMinute = m; 
    RenderTimePicker();
    if (selectedHour !== "") {
        document.getElementById(activeTimeTargetId).value = selectedHour + ":" + selectedMinute;
        setTimeout(CloseTimePicker, 200); // Piccolo delay per feedback visivo
        CalcolaEDinamizza();
    }
}

function ResetHighLight() {
    var inputs = document.getElementsByTagName("input");
    for (var i = 0; i < inputs.length; i++) { inputs[i].style.borderColor = ""; }
}

function ChiudiMaschera() {
    isRedirecting = true;
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var dashboardPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(dashboardPath)) dashboardPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + dashboardPath + '"', 1, false);
    } catch(e) {}
    window.close();
}

function LogOperazione(dipendente, tipo, nota) {
    try {
        var now = new Date();
        var mm = now.getMonth() + 1;
        var dd = now.getDate();
        var yyyy = now.getFullYear();
        var hh = now.getHours();
        var nn = now.getMinutes();
        var ss = now.getSeconds();
        var sqlDate = "'" + yyyy + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd + " " + hh + ":" + nn + ":" + ss + "'";
        
        var sql = "INSERT INTO tblLogs_Permessi (DataOra, Dipendente, Tipo, Note) VALUES (" + 
                  sqlDate + ", '" + dipendente.replace(/'/g, "''") + "', '" + tipo + "', '" + nota.replace(/'/g, "''") + "')";
        queryAccessDB(sql, true);
        if (document.getElementById("lblStatus")) {
            document.getElementById("lblStatus").innerText = "Operazione registrata nella Black Box";
        }
    } catch(e) {
        // Silenzioso per non disturbare l'utente se il log fallisce
    }
}

// === APPLE WHEEL PICKER LOGIC ===
var wheelTargetId = "";
var wheelDebounceDay = null;
var wheelDebounceMonth = null;
var wheelDebounceYear = null;

function OpenWheelPicker(targetId) {
    wheelTargetId = targetId;
    document.getElementById("wheelBackdrop").style.display = "block";
    document.getElementById("wheelModal").style.display = "block";
    
    PopulateWheel("wheelDay", 1, 31);
    var abbrMesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    PopulateWheel("wheelMonth", abbrMesi);
    var curYear = new Date().getFullYear();
    PopulateWheel("wheelYear", 1920, curYear, true);
    
    // Leggi la data attualmente presente nell'input per posizionare le ruote
    var currentVal = document.getElementById(targetId).value;
    var initDay = 15;
    var initMonth = "Giu";
    var initYear = 1990;
    
    if (currentVal && currentVal.indexOf("/") !== -1) {
        var parts = currentVal.split("/");
        if (parts.length === 3) {
            var dVal = parseInt(parts[0], 10);
            var mVal = parseInt(parts[1], 10);
            var yVal = parseInt(parts[2], 10);
            if (!isNaN(dVal) && dVal >= 1 && dVal <= 31) initDay = dVal;
            if (!isNaN(mVal) && mVal >= 1 && mVal <= 12) initMonth = abbrMesi[mVal - 1];
            if (!isNaN(yVal) && yVal >= 1920 && yVal <= curYear) initYear = yVal;
        }
    }
    
    // Posizionamento iniziale dinamico e sincronizzato
    setTimeout(function() {
        ScrollWheelToValue("wheelYear", initYear);
        ScrollWheelToValue("wheelMonth", initMonth);
        ScrollWheelToValue("wheelDay", initDay);
    }, 200);
}

function PopulateWheel(id, start, end, reverse) {
    var col = document.getElementById(id);
    col.innerHTML = "";
    var items = [];
    if (Array.isArray(start)) {
        items = start;
    } else {
        if (reverse) {
            for (var i = end; i >= start; i--) items.push(i);
        } else {
            for (var i = start; i <= end; i++) items.push(i);
        }
    }
    
    col.appendChild(document.createElement("div")).style.height = "80px";
    for (var k = 0; k < items.length; k++) {
        var div = document.createElement("div");
        div.className = "wheel-item";
        div.innerText = items[k];
        div.setAttribute("data-val", items[k]);
        div.style.height = "40px";
        div.style.lineHeight = "40px";
        div.style.textAlign = "center";
        div.style.color = "#888";
        div.style.fontSize = "16px";
        div.style.fontWeight = "normal";
        div.style.cursor = "pointer";
        col.appendChild(div);
    }
    col.appendChild(document.createElement("div")).style.height = "120px";
}

function OnWheelScroll(id) {
    if (id === "wheelDay") {
        if (wheelDebounceDay) clearTimeout(wheelDebounceDay);
        wheelDebounceDay = setTimeout(function() { SnapWheel("wheelDay"); }, 100);
    } else if (id === "wheelMonth") {
        if (wheelDebounceMonth) clearTimeout(wheelDebounceMonth);
        wheelDebounceMonth = setTimeout(function() { SnapWheel("wheelMonth"); }, 100);
    } else if (id === "wheelYear") {
        if (wheelDebounceYear) clearTimeout(wheelDebounceYear);
        wheelDebounceYear = setTimeout(function() { SnapWheel("wheelYear"); }, 100);
    }
}

function SnapWheel(id) {
    var col = document.getElementById(id);
    var items = col.getElementsByClassName("wheel-item");
    var index = Math.round(col.scrollTop / 40);
    col.scrollTop = index * 40;
    for (var i = 0; i < items.length; i++) { 
        items[i].classList.remove("active"); 
        items[i].style.color = "#888";
        items[i].style.fontWeight = "normal";
    }
    if (items[index]) {
        items[index].classList.add("active");
        items[index].style.color = "#10b981";
        items[index].style.fontWeight = "bold";
    }
}

function ScrollWheelToValue(id, val) {
    var col = document.getElementById(id);
    var items = col.getElementsByClassName("wheel-item");
    for (var i = 0; i < items.length; i++) {
        if (items[i].getAttribute("data-val") == val) {
            col.scrollTop = i * 40;
            SnapWheel(id);
            break;
        }
    }
}

function CloseWheelPicker() {
    document.getElementById("wheelBackdrop").style.display = "none";
    document.getElementById("wheelModal").style.display = "none";
}

function ConfirmWheelDate() {
    var d = GetWheelVal("wheelDay");
    var m = GetWheelVal("wheelMonth");
    var y = GetWheelVal("wheelYear");
    var mIdx = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"].indexOf(m) + 1;
    var formatted = (d < 10 ? "0" + d : d) + "/" + (mIdx < 10 ? "0" + mIdx : mIdx) + "/" + y;
    document.getElementById(wheelTargetId).value = formatted;
    CloseWheelPicker();
    AggiornaAnteprima();
}

function GetWheelVal(id) {
    var col = document.getElementById(id);
    var active = col.getElementsByClassName("active")[0];
    return active ? active.getAttribute("data-val") : "";
}

function ResetCampi() {
    if (confirm("Sei sicuro di voler ripulire tutti i campi della richiesta?")) {
        document.getElementById("m_Cognome").value = "";
        document.getElementById("m_Luogo").value = "";
        document.getElementById("m_Data").value = "";
        document.getElementById("m_Indirizzo").value = "";
        document.getElementById("m_Giorni").value = "";
        document.getElementById("m_Dal").value = "";
        document.getElementById("m_Al").value = "";
        document.getElementById("m_Rientro").value = "";
        CalcolaEDinamizza();
    }
}

function MostraAnteprimaGrande() {
    alert("FUNZIONE ELITE\n\nL'anteprima \u00e8 giÃ  ottimizzata per la massima leggibilit\u00e0. Per una visione a tutto schermo, genera il PDF.");
}

function MostraInfo() {
    alert("GESTIONE LOGISTICA E CONSEGNE - C. MILELLA\n" +
          "Versione Royal Platinum - Superior Performance\n\n" +
          "Sviluppato per garantire la massima efficienza istituzionale.\n" +
          "\u00a9 2026 - Tutti i diritti riservati.");
}

function ActionEsci() {
    window.close();
}

// === HOTKEYS LOGIC ===
document.onkeydown = function() {
    if (event.altKey) {
        switch (event.keyCode) {
            case 70: // ALT+F (File)
                break;
            case 77: // ALT+M (Modifica)
                ToggleModoGestione();
                break;
        }
    }
    if (event.ctrlKey && event.keyCode == 80) { // CTRL+P (Print)
        GeneraPDF();
        return false;
    }
}

window.onbeforeunload = function() {
    if (isRedirecting || isClosing) return; 
    isClosing = true;
    
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var dashboardPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(dashboardPath)) dashboardPath = fso.BuildPath(currentDir, "dashboard.html");
        shell.Run('mshta.exe "' + dashboardPath + '"', 1, false);
    } catch(e) {}
};
function Toggle104() {
    if (!selectedDipendente) {
        alert("Seleziona prima un dipendente!");
        return;
    }
    
    selectedDipendente.ha104 = !selectedDipendente.ha104;
    
    // Aggiorna UI immediata
    var btn = document.getElementById("btnToggle104");
    if (btn) {
        btn.innerHTML = selectedDipendente.ha104 ? "ðŸ”“" : "ðŸ”’";
        btn.title = selectedDipendente.ha104 ? "ABILITATO Legge 104 (Clicca per bloccare)" : "NON ABILITATO (Clicca per sbloccare)";
    }
    
    // Aggiorna Dropdown Tipi
    var cmbT = document.getElementById("cmbTipo");
    var valPrima = cmbT.value;
    cmbT.options.length = 0;
    cmbT.options[cmbT.options.length] = new Option("Ferie", "Ferie");
    cmbT.options[cmbT.options.length] = new Option("Permesso (ROL)", "Permesso (ROL)");
    cmbT.options[cmbT.options.length] = new Option("Ore di recupero", "Ore di recupero");
    if (selectedDipendente.ha104) {
        cmbT.options[cmbT.options.length] = new Option("Legge 104/92", "Legge 104/92");
    }
    cmbT.value = (valPrima === "Legge 104/92" && !selectedDipendente.ha104) ? "Ferie" : valPrima;
    
    // Persisti nel Database
    try {
        var sql = "UPDATE tblDipendenti SET Ha104 = " + (selectedDipendente.ha104 ? "1" : "0") + " WHERE ID = " + selectedDipendente.id;
        queryAccessDB(sql, true);
    } catch(e) {
        // Fallback silenzioso
    }
    
    AggiornaVistaParametri();
    AggiornaAnteprima();
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
        var rootDir = currentDir;
        var sysDir = fso.BuildPath(rootDir, "system");
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


function EsportaReportMensile() {
    var sql = "SELECT Dipendente, DataDal, DataAl, Giorni, Tipo FROM tblStoricoFerie ORDER BY DataDal DESC LIMIT 100";
    var res = queryAccessDB(sql, false);
    if (!res || res.length === 0) {
        alert("Nessun permesso trovato nello storico.");
        return;
    }
    
    var csvContent = "Dipendente;Data Inizio;Data Fine;Giorni;Tipo\n";
    for(var i=0; i<res.length; i++) {
        csvContent += "\"" + (res[i].Dipendente || "") + "\";";
        csvContent += "\"" + (res[i].DataDal || "") + "\";";
        csvContent += "\"" + (res[i].DataAl || "") + "\";";
        csvContent += "\"" + (res[i].Giorni || 0) + "\";";
        csvContent += "\"" + (res[i].Tipo || "") + "\"\n";
    }
    
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var shell = new ActiveXObject("WScript.Shell");
        var currentDir = window.location.pathname.replace(/\/[^\/]+$/, "").replace(/^\//, "").replace(/\//g, "\\");
        currentDir = decodeURI(currentDir);
        var reportPath = fso.BuildPath(currentDir, "REPORT_FERIE_PERMESSI.csv");
        
        var file = fso.CreateTextFile(reportPath, true, false);
        file.Write(csvContent);
        file.Close();
        
        shell.Run("explorer.exe \"" + reportPath + "\"", 1, false);
    } catch(e) {
        alert("Errore durante la creazione del report: " + e.message);
    }
}

function OttieniUltimoFileBustePaga() {
    var latestFile = "";
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var currentDir = window.location.pathname.replace(/\/[^\/]+$/, "").replace(/^\//, "").replace(/\//g, "\\");
        currentDir = decodeURI(currentDir);
        var rootDir = fso.GetParentFolderName(currentDir);
        var busteDir = fso.BuildPath(rootDir, "buste paghe");
        if (fso.FolderExists(busteDir)) {
            var folder = fso.GetFolder(busteDir);
            var files = new Enumerator(folder.Files);
            var latestDateStr = "";
            for (; !files.atEnd(); files.moveNext()) {
                var file = files.item();
                var name = file.Name;
                if (name.indexOf("registro_buste_paga_") === 0 && name.indexOf(".json") !== -1) {
                    var dateStr = name.replace("registro_buste_paga_", "").replace(".json", "");
                    if (dateStr > latestDateStr) {
                        latestDateStr = dateStr;
                        latestFile = file.Path;
                    }
                }
            }
        }
    } catch(e) {}
    return latestFile;
}

function SincronizzaDaBustePaga(nomeDipendente) {
    var ferie = null;
    try {
        var fileBuste = OttieniUltimoFileBustePaga();
        if (fileBuste) {
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            var f = fso.OpenTextFile(fileBuste, 1);
            var content = f.ReadAll();
            f.Close();
            var payslips = eval("(" + content + ")");
            
            var lastSlip = null;
            for(var i=0; i<payslips.length; i++) {
                var t = (payslips[i].titolare || "").toLowerCase().trim();
                var searchName = nomeDipendente.toLowerCase().trim();
                
                if(t === searchName || 
                  (searchName === "ciro milella" && (t === "" || t === "tutti (congiunto)"))) {
                    lastSlip = payslips[i];
                }
            }
            if (lastSlip) {
                ferie = lastSlip.ferieResidue || "0,00";
            }
        }
    } catch(e) { }
    return ferie;
}

