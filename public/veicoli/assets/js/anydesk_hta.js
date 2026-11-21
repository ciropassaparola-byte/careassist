// anydesk_hta.js - Enterprise AnyDesk Hub Integration
var fso = new ActiveXObject(["Scripting", "FileSystemObject"].join("."));
var shell = new ActiveXObject(["WScript", "Shell"].join("."));

// CALCOLO DINAMICO DEL PERCORSO DI LAVORO PORTABLE
var pathEval = decodeURIComponent(window.location.pathname).replace(/^file:\/\/\//, "").replace(/\//g, "\\");
if (pathEval.charAt(0) === "\\") pathEval = pathEval.substring(1);
var currentDir = fso.GetParentFolderName(pathEval) + "\\";

var EXCEL_PATH = "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\ANYDESK UTENTI.xlsx";
if (!fso.FileExists(EXCEL_PATH)) {
    EXCEL_PATH = "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC1\\ANYDESK UTENTI.xlsx";
}
if (!fso.FileExists(EXCEL_PATH)) {
    EXCEL_PATH = "C:\\Users\\Utente\\Desktop\\di bello\\ANYDESK UTENTI.xlsx";
}
var DB_PATH = currentDir + "ConsegneDB.accdb";

var usersData = [];
var ALLOW_CLOSE = false;
var currentFilterTab = 'all';

// ACCESSO AL DATABASE TRAMITE PORTALE NODE.JS SQLITE BRIDGE
function queryAccessDB(sql, isUpdate) {
    try {
        var http = new ActiveXObject(["WinHttp", "WinHttpRequest", "5.1"].join("."));
        http.Open("POST", "http://127.0.0.1:3002/query", false);
        http.SetRequestHeader("Content-Type", "application/json");
        http.Send(JSON.stringify({ sql: sql }));
        if (http.Status === 200) {
            var res = JSON.parse(http.ResponseText);
            return isUpdate ? true : res;
        }
    } catch(errReq) {}
    return isUpdate ? false : [];
}

function CreateTableIfMissing() {
    try {
        var exists = queryAccessDB("SELECT name FROM sqlite_master WHERE type='table' AND name='AnyDeskUsers'");
        if (!exists || exists.length === 0) {
            var sql = "CREATE TABLE AnyDeskUsers (ID_U INTEGER PRIMARY KEY AUTOINCREMENT, Nome TEXT(100), AnyID TEXT(50), AnyPass TEXT(50), Fonte TEXT(20))";
            queryAccessDB(sql, true);
        }
    } catch(e) {}
}

window.onload = function() { 
    window.moveTo(0, 0); 
    window.resizeTo(screen.availWidth, screen.availHeight); 
    
    CreateTableIfMissing(); // Assicuriamoci che la tabella esista
    
    try { 
        LoadUsers(); 
    } catch(e) {
        document.getElementById('usersList').innerHTML = "<div style='color:#ef443b; background:#fee2e2; padding:15px; border-radius:8px; border:1px solid #fca5a5; font-size:13px;'><b>Errore Database:</b> " + e.message + "</div>";
    }

    UpdateClock();
    setInterval(UpdateClock, 1000);
    
    // Inizializza stato sintesi vocale
    try {
        var isEnabled = getSpeechEnabledSetting();
        var chk = document.getElementById('chkSpeech');
        if (chk) {
            chk.checked = isEnabled;
        }
        var menuLnk = document.getElementById('menuToggleSpeech');
        if (menuLnk) {
            menuLnk.innerText = isEnabled ? "Disattiva Sintesi Vocale" : "Attiva Sintesi Vocale";
        }
    } catch(e) {}

    // Inizializza stato contrasto elevato
    try {
        var isContrast = getHighContrastSetting();
        var chkContrast = document.getElementById('chkContrast');
        if (chkContrast) {
            chkContrast.checked = isContrast;
        }
        if (isContrast) {
            document.body.className += " high-contrast";
            document.body.className = document.body.className.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            var menuContrast = document.getElementById('menuToggleContrast');
            if (menuContrast) {
                menuContrast.innerHTML = "Disattiva Contrasto Elevato <span class='menu-shortcut'>Ctrl+H</span>";
            }
        }
    } catch(e) {}
    
    // Inizializza stato zoom
    try {
        var zoomLevel = getZoomSetting();
        SetZoomLevel(zoomLevel, true);
    } catch(e) {}
    
    document.onkeydown = function() {
        var e = window.event;
        if(e.keyCode === 27) GoToDashboard();
        if(e.keyCode === 112) ShowAppGuide();
        if(e.keyCode === 116) { e.returnValue = false; RefreshData(); }
        
        if(e.ctrlKey) {
            if(e.keyCode === 83) { e.returnValue = false; RefreshData(); }
            if(e.ctrlKey && e.keyCode === 79) { e.returnValue = false; BrowseFile(); }
            if(e.ctrlKey && e.keyCode === 80) { e.returnValue = false; GeneratePDF(); }
            if(e.ctrlKey && e.keyCode === 70) { e.returnValue = false; document.getElementById('searchInput').focus(); }
        }
        
        if(e.altKey) {
            if(e.keyCode === 78) OpenUserModal();
            if(e.keyCode === 89) SyncWithExcel();
        }
    };
};

function UpdateClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var s = now.getSeconds();
    
    var hDeg = (h % 12) * 30 + (m / 60) * 30;
    var mDeg = m * 6;
    var sDeg = s * 6;
    
    try {
        document.getElementById('hour-h').style.transform = 'rotate(' + hDeg + 'deg)';
        document.getElementById('min-h').style.transform = 'rotate(' + mDeg + 'deg)';
        document.getElementById('sec-h').style.transform = 'rotate(' + sDeg + 'deg)';
    } catch(e) {}
}

function CleanString(s) { 
    if(!s) return "";
    return s.toString().replace(/\'/g, "''").replace(/\"/g, "&quot;").replace(/\r?\n|\r/g, " ").trim();
}

function FilterUsers() {
    var input = document.getElementById('searchInput');
    var filter = input.value.toUpperCase();
    var list = document.getElementById('usersList');
    var cards = list.getElementsByClassName('user-card');
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var txt = card.innerText || card.textContent;
        var source = card.getAttribute('data-source') || "";
        
        var matchSearch = txt.toUpperCase().indexOf(filter) > -1;
        var matchTab = (currentFilterTab === 'all') || 
                       (currentFilterTab === 'excel' && source === 'EXCEL') ||
                       (currentFilterTab === 'manual' && source === 'MANUALE');
                       
        if (matchSearch && matchTab) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    }
}

var isClosing = false;
window.onbeforeunload = function() {
    if (ALLOW_CLOSE || isClosing) return; 
    isClosing = true;
    window.onbeforeunload = null;
    
    try {
        var htaPath = currentDir + "dashboard.hta";
        if (fso.FileExists(htaPath)) {
            shell.Run('mshta.exe "' + htaPath + '"', 1, false);
        } else {
            shell.Run("mshta.exe dashboard.hta");
        }
        
        var uniqueTitle = "TERMINATE_ANYDESKHUB_" + new Date().getTime();
        document.title = uniqueTitle;
        
        setTimeout(function() {
            try {
                shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq ' + uniqueTitle + '"', 0, false);
            } catch(ex){}
        }, 100);
    } catch(e) {
        try { shell.Run("mshta.exe dashboard.hta"); } catch(ex){}
    }
};

function LoadUsers() {
    try {
        var rows = queryAccessDB("SELECT * FROM AnyDeskUsers ORDER BY Nome ASC", false);
        usersData = [];
        for (var i = 0; i < rows.length; i++) {
            usersData.push({ 
                id_db: rows[i].ID_U,
                nome: rows[i].Nome, 
                id: rows[i].AnyID, 
                pass: rows[i].AnyPass || "",
                fonte: rows[i].Fonte || "EXCEL"
            });
        }
        Render(usersData);
        UpdateFilterCounts();
        FilterUsers();
        if(usersData.length === 0) {
            document.getElementById('usersList').innerHTML = "<div style='padding:20px; color:#777;'>Nessun dato nel Database. Clicca su <b>SINCRONIZZA</b> per importare dall'Excel.</div>";
        }
    } catch(e) {
        document.getElementById('usersList').innerHTML = "<div style='padding:20px; color:red;'>Errore Database: " + e.message + "</div>";
    }
}

function SyncWithExcel() {
    if(!fso.FileExists(EXCEL_PATH)) {
        alert("File Excel non configurato o non trovato: " + EXCEL_PATH + "\nSelezionalo prima con il tasto 'Sfoglia'.");
        return;
    }

    if(!confirm("Vuoi importare DEFINITIVAMENTE i dati di questo file Excel nel database?\n\nQuesta operazione memorizzerà i codici nel programma rendendoli indipendenti dal file originale.")) return;

    var xlApp = null;
    try {
        xlApp = new ActiveXObject("Excel.Application");
        var wb = xlApp.Workbooks.Open(EXCEL_PATH, 0, true);
        var ws = wb.Sheets(1);
        var lastRow = ws.Cells(ws.Rows.Count, "B").End(-4162).Row; // -4162 = xlUp

        // Pulisce i vecchi record importati da Excel per evitare orfani o dati errati, lasciando intatti quelli inseriti manualmente
        queryAccessDB("DELETE FROM AnyDeskUsers WHERE Fonte='EXCEL'", true);

        var addCount = 0;
        var updateCount = 0;

        for (var r = 2; r <= lastRow; r++) {
            var nome = (ws.Cells(r, 1).Value || "").toString().trim();
            var anyId = (ws.Cells(r, 2).Value || "").toString().trim().replace(/\s/g, "");
            var pass = (ws.Cells(r, 3).Value || "").toString().trim();

            if (nome && anyId) {
                var rs = queryAccessDB("SELECT COUNT(*) as Cnt FROM AnyDeskUsers WHERE AnyID='" + CleanString(anyId) + "'", false);
                var exists = rs.length > 0 ? rs[0].Cnt : 0;

                if (exists == 0) {
                    var sql = "INSERT INTO AnyDeskUsers (Nome, AnyID, AnyPass, Fonte) VALUES ('" + CleanString(nome) + "', '" + CleanString(anyId) + "', '" + CleanString(pass) + "', 'EXCEL')";
                    queryAccessDB(sql, true);
                    addCount++;
                } else {
                    var sql = "UPDATE AnyDeskUsers SET Nome='" + CleanString(nome) + "', AnyPass='" + CleanString(pass) + "', Fonte='EXCEL' WHERE AnyID='" + CleanString(anyId) + "'";
                    queryAccessDB(sql, true);
                    updateCount++;
                }
            }
        }

        wb.Close(false);
        xlApp.Quit();
        xlApp = null;

        SpeakText("Sincronizzazione completata");
        alert("SINCRONIZZAZIONE COMPLETATA!\n\nNuovi operatori aggiunti: " + addCount + "\nOperatori aggiornati: " + updateCount);
        LoadUsers();

    } catch(e) {
        alert("Errore durante la sincronizzazione: " + e.message);
        if (xlApp) {
            try { xlApp.Quit(); } catch(ex) {}
        }
    }
}

function Render(l) {
    var h = "";
    for(var i=0; i<l.length; i++) {
        var item = l[i];
        var safeId = CleanString(item.id);
        var safeNome = CleanString(item.nome).toUpperCase();
        var safePass = CleanString(item.pass);
        var fonte = item.fonte; // EXCEL o MANUALE
        var colorTheme = (fonte === "MANUALE") ? "#ef443b" : "#10b981"; // Rosso vs Verde Smeraldo
        var cardClass = (fonte === "MANUALE") ? "source-manual" : "source-excel";
        
        h += '<div class="user-card ' + cardClass + '" data-source="' + fonte + '" tabindex="0" style="border-top: 4px solid ' + colorTheme + ';">';
        h += '  <div class="card-main-layout">';
        
        // AREA CONTENUTO (SINISTRA)
        var idBadgeId = 'id_badge_' + i;
        var passBadgeId = 'pass_badge_' + i;
        h += '      <div class="card-content-left">';
        h += '          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
        h += '              <div class="user-name" style="margin-bottom:0;">' + safeNome + '</div>';
        h += '              <div style="font-size:9px; font-weight:800; color:' + colorTheme + '; background:rgba(0,0,0,0.04); padding:3px 8px; border-radius:12px; letter-spacing:0.5px;">' + fonte + '</div>';
        h += '          </div>';
        h += '          <div class="user-info">ID: <span class="clickable-value" tabindex="0" title="Clicca per copiare negli appunti" onclick="CopyToClipboard(\''+safeId+'\', \''+idBadgeId+'\')">' + safeId + '</span><span id="'+idBadgeId+'" class="copy-badge">Copiato!</span></div>';
        if(safePass) {
            h += '          <div class="user-info" style="margin-bottom:0;">PWD: <span class="clickable-value" tabindex="0" title="Clicca per copiare negli appunti" onclick="CopyToClipboard(\''+safePass+'\', \''+passBadgeId+'\')">' + safePass + '</span><span id="'+passBadgeId+'" class="copy-badge">Copiato!</span></div>';
        } else {
            h += '          <div class="user-info" style="margin-bottom:0;">PWD: <span style="color:#94a3b8; font-style:italic; font-weight:normal;">nessuna</span></div>';
        }
        h += '          <button class="btn-connetti" onclick="Connetti(\''+safeId+'\')">CONNETTI</button>';
        h += '      </div>';
        
        // AREA AZIONI (DESTRA) - Solo per record MANUALI
        if(fonte === "MANUALE") {
            h += '      <div class="card-actions-right">';
            // ICONA SALVA (Floppy)
            h += '          <button class="btn-action save" title="Esporta Backup" onclick="SaveBackupRecord('+i+')">';
            h += '              <svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>';
            h += '          </button>';
            // ICONA MODIFICA (Pencil)
            h += '          <button class="btn-action edit" title="Modifica" onclick="OpenUserModal('+item.id_db+')">';
            h += '              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
            h += '          </button>';
            // ICONA ELIMINA (Trash)
            h += '          <button class="btn-action delete" title="Elimina" onclick="DeleteUserManual('+item.id_db+')">';
            h += '              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
            h += '          </button>';
            h += '      </div>';
        }
        
        h += '  </div>'; // fine layout
        h += '</div>'; // fine card
    }
    document.getElementById('usersList').innerHTML = h || "<div style='grid-column: 1/-1; text-align:center; padding:40px; color:#64748b; font-weight:500;'>Nessun operatore trovato.</div>";
}

function SaveBackupRecord(index) {
    var item = usersData[index];
    if(!item) return;
    
    try {
        var desktop = shell.SpecialFolders("Desktop");
        var filename = "AnyDesk_" + item.nome.replace(/[^a-z0-9]/gi, '_') + ".txt";
        var path = desktop + "\\" + filename;
        
        var f = fso.CreateTextFile(path, true);
        f.WriteLine("--- BACKUP OPERATORE ANYDESK ---");
        f.WriteLine("OPERATORE: " + item.nome);
        f.WriteLine("ID: " + item.id);
        f.WriteLine("PWD: " + (item.pass || "Nessuna"));
        f.WriteLine("DATA EXPORT: " + new Date().toLocaleString());
        f.Close();
        
        alert("Informazioni salvate sul Desktop:\n" + filename);
    } catch(e) {
        alert("Errore nel salvataggio backup: " + e.message);
    }
}

var editingUserId = null;

function OpenUserModal(id) {
    editingUserId = id || null;
    var modal = document.getElementById('userModalOverlay');
    var title = document.getElementById('modalTitle');
    
    // Reset campi
    document.getElementById('txtAddNome').value = "";
    document.getElementById('txtAddID').value = "";
    document.getElementById('txtAddPass').value = "";
    
    if(editingUserId) {
        title.innerText = "MODIFICA OPERATORE";
        SpeakText("Modifica operatore selezionato");
        // Cerca i dati del record
        for(var i=0; i<usersData.length; i++) {
            if(usersData[i].id_db == editingUserId) {
                document.getElementById('txtAddNome').value = usersData[i].nome;
                document.getElementById('txtAddID').value = usersData[i].id;
                document.getElementById('txtAddPass').value = usersData[i].pass;
                break;
            }
        }
    } else {
        title.innerText = "NUOVO OPERATORE";
        SpeakText("Apertura scheda nuovo operatore");
    }
    
    modal.style.display = 'flex';
    document.getElementById('txtAddNome').focus();
}

function CloseUserModal() {
    document.getElementById('userModalOverlay').style.display = 'none';
    editingUserId = null;
    SpeakText("Operazione annullata");
}

function SaveUserManual() {
    var nome = document.getElementById('txtAddNome').value.trim();
    var id = document.getElementById('txtAddID').value.trim().replace(/\s/g, "");
    var pass = document.getElementById('txtAddPass').value.trim();
    
    if(!nome || !id) {
        alert("Nome e ID AnyDesk sono obbligatori.");
        return;
    }

    try {
        if(editingUserId) {
            var sql = "UPDATE AnyDeskUsers SET Nome='" + CleanString(nome) + "', AnyID='" + CleanString(id) + "', AnyPass='" + CleanString(pass) + "' WHERE ID_U=" + editingUserId;
            queryAccessDB(sql, true);
            SpeakText("Operatore modificato con successo");
        } else {
            var sql = "INSERT INTO AnyDeskUsers (Nome, AnyID, AnyPass, Fonte) VALUES ('" + CleanString(nome) + "', '" + CleanString(id) + "', '" + CleanString(pass) + "', 'MANUALE')";
            queryAccessDB(sql, true);
            SpeakText("Nuovo operatore salvato con successo");
        }
        CloseUserModal();
        LoadUsers();
        alert("Operatore salvato con successo.");
    } catch(e) {
        alert("Errore nel salvataggio: " + e.message);
    }
}

function DeleteUserManual(id) {
    if(!confirm("Sei sicuro di voler eliminare questo operatore inserito manualmente?")) return;
    try {
        queryAccessDB("DELETE FROM AnyDeskUsers WHERE ID_U=" + id, true);
        SpeakText("Operatore eliminato");
        LoadUsers();
        alert("Operatore eliminato.");
    } catch(e) {
        alert("Errore durante l'eliminazione: " + e.message);
    }
}

function BrowseFile() {
    SpeakText("Selezione file Excel");
    try {
        var shell = new ActiveXObject(["WScript", "Shell"].join("."));
        var psCmd = "powershell -WindowStyle Hidden -Command \"[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $fd = New-Object System.Windows.Forms.OpenFileDialog; $fd.Filter = 'Excel Files (*.xlsx)|*.xlsx'; if($fd.ShowDialog() -eq 'OK') { $fd.FileName }\"";
        
        var exec = shell.Exec(psCmd);
        var newPath = exec.StdOut.ReadAll().replace(/[\r\n]/g, "");
        
        if (newPath && newPath.length > 5) {
            EXCEL_PATH = newPath;
            LoadUsers();
            alert("File selezionato: " + EXCEL_PATH);
        }
    } catch(e) {
        alert("Errore nella selezione del file: " + e.message);
    }
}

function GeneratePDF() {
    SpeakText("Generazione report PDF");
    var shell = new ActiveXObject(["WScript", "Shell"].join("."));
    var scriptPath = currentDir + "bridge_pdf_sender.ps1";
    shell.Run("powershell.exe -ExecutionPolicy Bypass -File \"" + scriptPath + "\"", 0, false);
    alert("Generazione PDF avviata. Troverai il file 'REPORT_OPERATORI_ANYDESK.pdf' sul Desktop tra pochi secondi.");
}

function SendWhatsApp() {
    SpeakText("Apertura WhatsApp Web");
    var text = "Ecco la lista dei codici AnyDesk aggiornata. Puoi scaricare il PDF dal PC principale.";
    var url = "https://web.whatsapp.com/send?text=" + encodeURIComponent(text);
    var shell = new ActiveXObject(["WScript", "Shell"].join("."));
    shell.Run(url);
}

function SendEmail() {
    SpeakText("Preparazione email report");
    var shell = new ActiveXObject(["WScript", "Shell"].join("."));
    GeneratePDF();
    setTimeout(function(){
        var mailto = "mailto:?subject=Report AnyDesk Aggiornato&body=In allegato trovi il PDF dei codici AnyDesk generato dal sistema.";
        shell.Run(mailto);
    }, 3000);
}

var isMaximized = true;
var lastW = 450, lastH = 600, lastX = 0, lastY = 0;

function WinMin() { try { AppAnyDesk.minimize(); } catch(e){} }
function WinMax() { 
    try {
        var btn = document.getElementById('btnMax');
        if(!isMaximized) {
            lastW = document.body.offsetWidth; lastH = document.body.offsetHeight;
            lastX = window.screenLeft; lastY = window.screenTop;
            window.moveTo(0,0); window.resizeTo(screen.availWidth, screen.availHeight);
            btn.innerHTML = "&#10066;";
            isMaximized = true;
        } else {
            window.moveTo(lastX, lastY); window.resizeTo(1000, 950);
            btn.innerHTML = "&#9633;";
            isMaximized = false;
        }
    } catch(e){} 
}

function GetAnyDeskPath() {
    var commonPaths = [
        "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe",
        "C:\\Program Files\\AnyDesk\\AnyDesk.exe"
    ];
    try {
        var userProfile = shell.ExpandEnvironmentStrings("%USERPROFILE%");
        if (userProfile && userProfile !== "%USERPROFILE%") {
            commonPaths.push(userProfile + "\\Downloads\\AnyDesk.exe");
            commonPaths.push(userProfile + "\\Desktop\\AnyDesk.exe");
            commonPaths.push(userProfile + "\\Downloads\\anydesk.exe");
            commonPaths.push(userProfile + "\\Desktop\\anydesk.exe");
        }
        var localAppData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%");
        if (localAppData && localAppData !== "%LOCALAPPDATA%") {
            commonPaths.push(localAppData + "\\AnyDesk\\AnyDesk.exe");
        }
        var programFiles = shell.ExpandEnvironmentStrings("%ProgramFiles%");
        if (programFiles && programFiles !== "%ProgramFiles%") {
            commonPaths.push(programFiles + "\\AnyDesk\\AnyDesk.exe");
        }
        var programFilesX86 = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%");
        if (programFilesX86 && programFilesX86 !== "%ProgramFiles(x86)%") {
            commonPaths.push(programFilesX86 + "\\AnyDesk\\AnyDesk.exe");
        }
    } catch(e) {}

    for (var i = 0; i < commonPaths.length; i++) {
        if (fso.FileExists(commonPaths[i])) {
            return commonPaths[i];
        }
    }
    return "anydesk.exe";
}

function IsAnyDeskRunning() {
    try {
        var locator = new ActiveXObject("WbemScripting.SWbemLocator");
        var service = locator.ConnectServer(".", "root\\cimv2");
        var processes = service.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'anydesk.exe'");
        return (processes.Count > 0);
    } catch(e) {
        try {
            var exec = shell.Exec("cmd.exe /c tasklist /FI \"IMAGENAME eq anydesk.exe\" /NH");
            var output = exec.StdOut.ReadAll();
            return (output.toLowerCase().indexOf("anydesk.exe") !== -1);
        } catch(ex) {
            return false;
        }
    }
}

function Connetti(id) { 
    try { 
        var cleanId = id.toString().replace(/\s/g, "");
        if(!cleanId) { alert("ID AnyDesk non valido."); return; }
        
        var nomeOp = "operatore";
        for (var i = 0; i < usersData.length; i++) {
            if (usersData[i].id.toString().replace(/\s/g, "") === cleanId) {
                nomeOp = usersData[i].nome;
                break;
            }
        }
        SpeakText("Avvio collegamento con " + nomeOp);

        var anydeskPath = GetAnyDeskPath();
        
        try {
            if (anydeskPath === "anydesk.exe") {
                shell.Run("anydesk.exe " + cleanId, 1, false);
            } else {
                shell.Run('"' + anydeskPath + '" ' + cleanId, 1, false);
            }
            StartSessionTimer();
        } catch(e1) {
            try {
                if (anydeskPath !== "anydesk.exe") {
                    shell.Run("anydesk.exe " + cleanId, 1, false);
                    StartSessionTimer();
                    return;
                }
            } catch(e2) {}
            alert("AnyDesk non trovato o impossibile avviarlo. Assicurati che sia installato sul PC.\nErrore: " + e1.message);
        }
    } catch(e) { 
        alert("Errore durante il collegamento: " + e.message); 
    } 
}

var sessionInterval = null;
var sessionSeconds = 0;
var anydeskCheckCounter = 0;
function StartSessionTimer() {
    if(sessionInterval) clearInterval(sessionInterval);
    sessionSeconds = 0;
    anydeskCheckCounter = 0;
    document.getElementById('hgIcon').className = 'hg-icon hg-active';
    document.getElementById('sessionTimerDisplay').innerText = "00:00:00";
    
    var btn = document.getElementById('btnStopSession');
    if (btn) {
        btn.style.display = 'block';
    }
    
    sessionInterval = setInterval(function() {
        sessionSeconds++;
        var hrs = Math.floor(sessionSeconds / 3600);
        var mins = Math.floor((sessionSeconds % 3600) / 60);
        var secs = sessionSeconds % 60;
        
        var display = (hrs < 10 ? "0" + hrs : hrs) + ":" + 
                      (mins < 10 ? "0" + mins : mins) + ":" + 
                      (secs < 10 ? "0" + secs : secs);
        document.getElementById('sessionTimerDisplay').innerText = display;

        // Controlla se AnyDesk è ancora in esecuzione (dopo 5 secondi dall'avvio)
        anydeskCheckCounter++;
        if (anydeskCheckCounter > 5) {
            if (!IsAnyDeskRunning()) {
                StopSession();
            }
        }
    }, 1000);
}

function StopSession() {
    if(sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
    }
    var hg = document.getElementById('hgIcon');
    if (hg) {
        hg.className = 'hg-icon';
    }
    var btn = document.getElementById('btnStopSession');
    if (btn) {
        btn.style.display = 'none';
    }
    SpeakText("Connessione AnyDesk interrotta");
    try {
        shell.Run('taskkill /F /IM anydesk.exe', 0, false);
    } catch(e) {}
}

function RunAnyDesk(id) { 
    if(!id) return;
    try {
        StartSessionTimer();
        var anydeskPath = GetAnyDeskPath();
        if (anydeskPath === "anydesk.exe") {
            shell.Run("anydesk.exe " + id, 1, false); 
        } else {
            shell.Run('"' + anydeskPath + '" ' + id, 1, false); 
        }
    } catch(e) { 
        try {
            shell.Run("anydesk.exe " + id, 1, false);
        } catch(ex) {
            alert('Errore: Assicurati che AnyDesk sia installato.'); 
        }
    } 
}

function NavigateTo(page) {
    try {
        ALLOW_CLOSE = true;
        window.onbeforeunload = null;
        
        var pagePath = currentDir + page;
        if(fso.FileExists(pagePath)) {
            shell.Run('mshta.exe "' + pagePath + '"', 1, false);
        } else {
            shell.Run("mshta.exe " + page, 1, false);
        }
        
        var uniqueTitle = "TERMINATE_ANYDESKHUB_" + new Date().getTime();
        document.title = uniqueTitle;
        
        setTimeout(function() {
            try {
                window.open('', '_self', '');
                window.close();
                shell.Run('taskkill /F /IM mshta.exe /FI "WINDOWTITLE eq ' + uniqueTitle + '"', 0, false);
            } catch(ex){}
        }, 100);
    } catch(e) {
        try { shell.Run("mshta.exe " + page); window.close(); } catch(ex){}
    }
}

function GoToDashboard() {
    SpeakText("Ritorno al pannello comandi");
    NavigateTo("dashboard.html");
}

function ShowAppGuide() {
    SpeakText("Apertura guida rapida");
    var msg = "GUIDA RAPIDA - ANYDESK HUB v8.0\n\n";
    msg += "1. SINCRONIZZA: Clicca sul tasto 'Sincronizza' per importare i nuovi operatori dall'Excel al Database locale. Questa operazione evita i duplicati.\n\n";
    msg += "2. RICERCA: Digita il nome o l'ID nella barra superiore per filtrare la lista in tempo reale.\n\n";
    msg += "3. CONNESSIONE: Premi 'CONNETTI' su un box operatore per avviare AnyDesk. Il tempo di sessione partirà automaticamente.\n\n";
    msg += "4. SESSION TRACKER: Nella sidebar a sinistra puoi monitorare la durata dell'assistenza remota tramite il timer e la clessidra animata.\n\n";
    msg += "5. REPORT & EXPORT: Usa i tasti 'Crea PDF', 'WhatsApp' o 'Email' per condividere o archiviare la lista dei codici.\n\n";
    msg += "6. NAVIGAZIONE: Usa la Sidebar per tornare velocemente al Pannello Comandi principale.\n\n";
    msg += "Sviluppato con standard Enterprise Gold - Identità C. Milella";
    alert(msg);
}

function AboutApp() {
    SpeakText("Informazioni applicazione");
    alert("AnyDesk Hub - Sistema Logistica\nVersione 8.0 (Royal Platinum Edition)\n\nSviluppato per C. Milella\nStandard di Sicurezza Enterprise Gold\n© 2026 Tutti i diritti riservati.");
}

function RunBackup() {
    SpeakText("Avvio backup di sicurezza");
    try {
        var pathBackupBat = currentDir + "system\\AVVIA_BACKUP.bat";
        if(fso.FileExists(pathBackupBat)) {
            shell.Run('"' + pathBackupBat + '"', 1, false);
        } else {
            alert("File di backup (AVVIA_BACKUP.bat) non trovato nella cartella system.");
        }
    } catch(e) {
        alert("Errore durante l'avvio del backup: " + e.message);
    }
}

function SafeExit() {
    SpeakText("Chiusura applicazione");
    if(confirm("Sei sicuro di voler chiudere AnyDesk Hub?")) {
        ALLOW_CLOSE = true;
        window.close();
    }
}

// Le funzioni di Sintesi Vocale (getSpeechEnabledSetting, SpeakText, ToggleSpeech, ecc.) sono state spostate in assets/js/accessibility.js

function CopyToClipboard(val, badgeId) {
    try {
        window.clipboardData.setData("Text", val.toString());
        var badge = document.getElementById(badgeId);
        if (badge) {
            badge.className = 'copy-badge show';
            setTimeout(function() {
                badge.className = 'copy-badge';
            }, 1500);
        }
    } catch(e) {}
}

function ChangeFilterTab(tab) {
    currentFilterTab = tab;
    var tabs = document.getElementsByClassName('filter-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].className = 'filter-tab';
        if (tabs[i].getAttribute('data-tab') === tab) {
            tabs[i].className = 'filter-tab active';
        }
    }
    
    var tabName = "tutti";
    if (tab === "excel") tabName = "da excel";
    if (tab === "manual") tabName = "manuali";
    SpeakText("Filtro " + tabName);
    
    FilterUsers();
}

function RefreshData() {
    SpeakText("Dati aggiornati");
    LoadUsers();
}

function UpdateFilterCounts() {
    var allCnt = usersData.length;
    var excelCnt = 0;
    var manualCnt = 0;
    for (var i = 0; i < usersData.length; i++) {
        if (usersData[i].fonte === "EXCEL") excelCnt++;
        else if (usersData[i].fonte === "MANUALE") manualCnt++;
    }
    
    try {
        document.getElementById('countAll').innerText = allCnt;
        document.getElementById('countExcel').innerText = excelCnt;
        document.getElementById('countManual').innerText = manualCnt;
    } catch(e) {}
}

// Le funzioni di Contrasto, Zoom, Gestione Focus e Keyup ad accessibilità sono state spostate in assets/js/accessibility.js
