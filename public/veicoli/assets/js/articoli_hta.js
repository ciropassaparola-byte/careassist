/**
 * GESTIONE ARTICOLI HTA - Motore Logico ENTERPRISE GOLD
 */

var fso = new ActiveXObject("Scripting.FileSystemObject");
var shell = new ActiveXObject("WScript.Shell");
var pathEval = document.location.pathname;
if (pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
var currentDir = fso.GetParentFolderName(pathEval);
var DB_PATH = fso.BuildPath(currentDir, "ConsegneDB.accdb");
var ARTICOLI_DIR = fso.BuildPath(currentDir, "Articoli");
var MANUALI_DIR = fso.BuildPath(currentDir, "Manuals");

var isModificaMode = false;
var modelloOriginale = "";
var categoriaOriginale = "";
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
    try {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
    } catch(e) {}

    VerificaECreaFolder();
    CaricaClassifiche();
    AggiornaBadgeGlobale();
    SetupEventHandlers();
    
    try { StartTitleClock(); } catch(e) {}
    try { CaricaProfiloUtente(); } catch(e) {}
    
    document.title = "GESTIONE CATALOGO ARTICOLI - Danea Super";
};

function Script_BackToDashboard() {
    isNavigating = true;
    var htaPath = fso.BuildPath(currentDir, "dashboard.hta");
    if (!fso.FileExists(htaPath)) htaPath = fso.BuildPath(currentDir, "dashboard.html");
    shell.Run('mshta.exe "' + htaPath + '"', 1, false);
    window.close();
}

function VerificaECreaFolder() {
    if (!fso.FolderExists(ARTICOLI_DIR)) {
        try { fso.CreateFolder(ARTICOLI_DIR); } catch (e) {}
    }
    if (!fso.FolderExists(MANUALI_DIR)) {
        try { fso.CreateFolder(MANUALI_DIR); } catch (e) {}
    }
}

function queryAccessDB(sql, isUpdate) {
    var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
    try {
        http.Open("POST", "http://127.0.0.1:3002/query", false);
        http.SetRequestHeader("Content-Type", "application/json");
        http.Send(JSON.stringify({ sql: sql }));
        if (http.Status === 200) {
            var res = JSON.parse(http.ResponseText);
            return isUpdate ? true : res;
        } else {
            return isUpdate ? false : [];
        }
    } catch(errReq) {
        return isUpdate ? false : [];
    }
}

function sqlEscape(str) { return str ? String(str).replace(/'/g, "''") : ""; }

/* --- UI LOGIC --- */
function CaricaClassifiche(catDaSel) {
    var cmb = document.getElementById("cmbClassifica");
    cmb.innerHTML = '<option value="">Tutte le Categorie</option>';
    try {
        var res = queryAccessDB("SELECT DISTINCT Categoria FROM tblArticoli ORDER BY Categoria");
        for (var i = 0; i < res.length; i++) {
            var r = res[i];
            var opt = document.createElement("option");
            opt.value = r.Categoria; opt.text = r.Categoria;
            if (catDaSel && r.Categoria === catDaSel) opt.selected = true;
            cmb.appendChild(opt);
        }
        FiltrArticoli();
    } catch (e) { ShowHint("Errore DB: " + e.message, "danger"); }
}

function FiltrArticoli() {
    var query = document.getElementById("txtRicerca").value.toLowerCase();
    var catSel = document.getElementById("cmbClassifica").value;
    var list = document.getElementById("lstArticoli");
    list.innerHTML = "";
    
    var sql = "SELECT NomeArticolo, Categoria FROM tblArticoli WHERE 1=1";
    if (catSel !== "") sql += " AND Categoria = '" + sqlEscape(catSel) + "'";
    sql += " ORDER BY NomeArticolo";
    
    var res = queryAccessDB(sql);
    
    for (var i = 0; i < res.length; i++) {
        var r = res[i];
        if (query === "" || r.NomeArticolo.toLowerCase().indexOf(query) !== -1) {
            var div = document.createElement("div");
            div.className = "grid-item";
            div.innerHTML = '<i class="fa fa-tag" style="margin-right:10px; opacity:0.5;"></i> ' + r.NomeArticolo;
            
            div.onclick = (function(n, c) {
                return function() { SelectItem(this, n, c); };
            })(r.NomeArticolo, r.Categoria);
            
            div.ondblclick = (function(n, c) {
                return function() { EnterEditMode(n, c); };
            })(r.NomeArticolo, r.Categoria);
            
            list.appendChild(div);
        }
    }
    var count = list.children.length;
    document.getElementById("lblCounter").innerText = "RISULTATI: " + count;
    
    // Annuncio per screen reader
    if(query !== "" || catSel !== "") {
        var msgA11y = count === 0 ? "Nessun articolo trovato" : "Trovati " + count + " articoli";
        announce(msgA11y);
    }
}

function SelectItem(el, nome, cat) {
    var items = document.querySelectorAll(".grid-item");
    for (var i=0; i<items.length; i++) items[i].classList.remove("selected");
    el.classList.add("selected");
    
    ShowPreview(nome);
    CheckManualExistence(nome);
    ShowHint("Articolo selezionato: " + nome, "primary");
    // Annuncio selezione
    announce("Selezionato: " + nome + " (" + cat + ")");
}

function CheckManualExistence(nome) {
    var badge = document.getElementById("lblManualStatus");
    if(!badge) return;
    
    var manualPath = fso.BuildPath(MANUALI_DIR, nome + ".pdf");
    if (fso.FileExists(manualPath)) {
        badge.innerText = "MANUALE DISPONIBILE";
        badge.style.background = "#0284c7";
        badge.style.color = "#fff";
        document.getElementById("btnApriManuale").disabled = false;
        document.getElementById("btnApriManuale").style.opacity = "1";
    } else {
        badge.innerText = "MANUALE NON PRESENTE";
        badge.style.background = "#f1f5f9";
        badge.style.color = "#64748b";
        document.getElementById("btnApriManuale").disabled = true;
        document.getElementById("btnApriManuale").style.opacity = "0.5";
    }
}

function ShowPreview(nome) {
    var img = document.getElementById("imgPreview");
    var noImg = document.getElementById("noImageLabel");
    var badge = document.getElementById("lblImgStatus");
    var found = false;
    var exts = [".jpg", ".jpeg", ".bmp", ".png", ".gif"];
    
    for (var i=0; i<exts.length; i++) {
        var p = fso.BuildPath(ARTICOLI_DIR, nome + exts[i]);
        if (fso.FileExists(p)) {
            img.src = "file:///" + p.replace(/\\/g, "/") + "?t=" + new Date().getTime();
            img.style.display = "block";
            noImg.style.display = "none";
            badge.innerText = "FOTO PRESENTE";
            badge.style.background = "#2ecc71";
            found = true;
            break;
        }
    }
    
    if (!found) {
        img.style.display = "none";
        noImg.style.display = "block";
        badge.innerText = "NESSUNA FOTO";
        badge.style.background = "rgba(0,0,0,0.4)";
    }
}

function EnterEditMode(nome, cat) {
    isModificaMode = true;
    modelloOriginale = nome;
    categoriaOriginale = cat;
    
    document.getElementById("txtNuovoModello").value = nome;
    document.getElementById("txtNuovaCategoria").value = cat;
    
    // Feedback sulla Ribbon
    var btnSave = document.getElementById("btnSalva");
    btnSave.querySelector("span").innerText = "Conferma";
    btnSave.classList.add("active");
    
    ShowHint("MODALITÀ MODIFICA: " + nome, "accent");
    
    // Porta il focus sul primo campo modificabile
    if(document.getElementById("txtNuovaCategoria")) {
        document.getElementById("txtNuovaCategoria").focus();
    }
}

function ResetUI() {
    isModificaMode = false;
    document.getElementById("txtNuovoModello").value = "";
    document.getElementById("txtNuovaCategoria").value = "";
    
    var btnSave = document.getElementById("btnSalva");
    btnSave.querySelector("span").innerText = "Salva";
    btnSave.classList.remove("active");
    
    document.getElementById("imgPreview").style.display = "none";
    document.getElementById("noImageLabel").style.display = "block";
    
    var mBadge = document.getElementById("lblManualStatus");
    if(mBadge) { mBadge.innerText = "SELEZIONA ARTICOLO"; mBadge.style.background="#f1f5f9"; mBadge.style.color="#64748b"; }
    var btnM = document.getElementById("btnApriManuale");
    if(btnM) { btnM.disabled = true; btnM.style.opacity = "0.5"; }

    var items = document.querySelectorAll(".grid-item");
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove("selected");
    }
    
    ShowHint("Pronto per nuovo inserimento.", "muted");
}

function ActionSalva() {
    var nome = document.getElementById("txtNuovoModello").value.trim();
    var cat = document.getElementById("txtNuovaCategoria").value.trim();
    if (cat === "") cat = document.getElementById("cmbClassifica").value;
    
    if (nome === "" || cat === "") { alert("Inserire Categoria e Nome Articolo!"); return; }
    
    try {
        if (isModificaMode) {
            var sql = "UPDATE tblArticoli SET Categoria = '" + sqlEscape(cat) + "', NomeArticolo = '" + sqlEscape(nome) + "' " +
                      "WHERE Categoria = '" + sqlEscape(categoriaOriginale) + "' AND NomeArticolo = '" + sqlEscape(modelloOriginale) + "'";
            queryAccessDB(sql, true);
        } else {
            var sqlCheck = "SELECT COUNT(*) as Tot FROM tblArticoli WHERE NomeArticolo = '" + sqlEscape(nome) + "'";
            if (queryAccessDB(sqlCheck)[0].Tot > 0) { alert("Errore: Articolo già esistente!"); return; }
            var sqlIns = "INSERT INTO tblArticoli (Categoria, NomeArticolo) VALUES ('" + sqlEscape(cat) + "', '" + sqlEscape(nome) + "')";
            queryAccessDB(sqlIns, true);
        }
        ResetUI(); CaricaClassifiche(cat); AggiornaBadgeGlobale();
        ShowHint("Operazione completata con successo.", "accent");
        announce("Dati articolo salvati correttamente");
    } catch (e) { alert("Errore: " + e.message); }
}

function ActionElimina() {
    var sel = document.querySelector(".grid-item.selected");
    if (!sel) { alert("Seleziona un articolo dalla lista!"); return; }
    var nome = sel.innerText.trim();
    if (!confirm("Eliminare definitivamente '" + nome + "'?")) return;
    
    try {
        queryAccessDB("DELETE FROM tblArticoli WHERE NomeArticolo = '" + sqlEscape(nome) + "'", true);
        announce("Articolo eliminato con successo");
        FiltrArticoli(); AggiornaBadgeGlobale(); ResetUI();
        ShowHint("Articolo rimosso dal catalogo.", "danger");
    } catch (e) { alert("Errore: " + e.message); }
}

// Funzione helper per annunci vocali generici
function announce(text) {
    var el = document.getElementById("lblHint");
    if(el) {
        var oldText = el.innerText;
        el.innerText = text;
        // Ripristina dopo 5 secondi
        setTimeout(function() { if(el.innerText === text) el.innerText = oldText; }, 5000);
    }
}


function ActionAssegnaFoto() {
    var sel = document.querySelector(".grid-item.selected");
    if (!sel) { alert("Seleziona prima l'articolo dalla lista!"); return; }
    var nomeArt = sel.innerText.trim();
    
    try {
        var psCmd = "powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -Command \"& {Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Immagini|*.jpg;*.jpeg;*.png;*.bmp;*.gif'; $f.Title = 'Scegli Foto Articolo...'; if($f.ShowDialog() -eq 'OK') { Write-Host $f.FileName }}\"";
        var exec = shell.Exec(psCmd);
        var fileS = ""; while (!exec.StdOut.AtEndOfStream) { fileS += exec.StdOut.ReadAll(); }
        fileS = fileS.replace(/^\s+|\s+$/g, '');
        if (!fileS) return;
        
        var ext = fso.GetExtensionName(fileS);
        // Per uniformità, forziamo l'estensione in minuscolo o manteniamo quella originale
        var fileD = fso.BuildPath(ARTICOLI_DIR, nomeArt + "." + ext.toLowerCase());
        fso.CopyFile(fileS, fileD, true);
        ShowPreview(nomeArt);
        ShowHint("Foto assegnata con successo.", "accent");
    } catch (e) { alert("Errore foto: " + e.message); }
}

function ActionApriManuale() {
    var sel = document.querySelector(".grid-item.selected");
    if(!sel) return;
    var nome = sel.innerText.trim();
    var p = fso.BuildPath(MANUALI_DIR, nome + ".pdf");
    if(fso.FileExists(p)) {
        shell.Run('"' + p + '"');
    } else {
        alert("Manuale non trovato localmente.");
    }
}

function ActionAssegnaManuale() {
    var sel = document.querySelector(".grid-item.selected");
    if (!sel) { alert("Seleziona prima l'articolo dalla lista!"); return; }
    var nomeArt = sel.innerText.trim();
    
    try {
        var psCmd = "powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -Command \"& {Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Documenti PDF|*.pdf'; $f.Title = 'Scegli Manuale PDF...'; if($f.ShowDialog() -eq 'OK') { Write-Host $f.FileName }}\"";
        var exec = shell.Exec(psCmd);
        var fileS = ""; while (!exec.StdOut.AtEndOfStream) { fileS += exec.StdOut.ReadAll(); }
        fileS = fileS.replace(/^\s+|\s+$/g, '');
        if (!fileS) return;
        
        var fileD = fso.BuildPath(MANUALI_DIR, nomeArt + ".pdf");
        fso.CopyFile(fileS, fileD, true);
        CheckManualExistence(nomeArt);
        ShowHint("Manuale caricato con successo.", "accent");
    } catch (e) { alert("Errore manuale: " + e.message); }
}

function ActionCercaManualeWeb() {
    var sel = document.querySelector(".grid-item.selected");
    var query = "";
    if(sel) {
        query = sel.innerText.trim() + " manuale d'uso pdf";
    } else {
        query = "manuale d'uso articoli logistica pdf";
    }
    var url = "https://www.google.com/search?q=" + encodeURIComponent(query);
    shell.Run(url);
}

function AggiornaBadgeGlobale() {
    try {
        var res = queryAccessDB("SELECT COUNT(*) as Tot FROM tblArticoli");
        document.getElementById("lblBadgeCount").innerText = res[0].Tot;
    } catch (e) {}
}

function SetupEventHandlers() {
    document.getElementById("txtRicerca").onkeyup = FiltrArticoli;
    document.getElementById("cmbClassifica").onchange = function() {
        FiltrArticoli();
        var val = this.value;
        if(val && !isModificaMode) document.getElementById("txtNuovaCategoria").value = val;
    };
    
    document.getElementById("btnSalva").onclick = ActionSalva;
    document.getElementById("btnAnnulla").onclick = ResetUI;
    document.getElementById("btnElimina_Tool").onclick = ActionElimina;
    document.getElementById("btnExportPDF_Tool").onclick = function() { alert("Generazione PDF in corso..."); 
        // Qui andrebbe la logica PDF esistente
    };
    
    document.getElementById("btnAssegnaFoto").onclick = ActionAssegnaFoto;
    document.getElementById("btnSfogliaCartella").onclick = function() { shell.Run('explorer.exe "' + ARTICOLI_DIR + '"'); };
    
    document.getElementById("btnApriManuale").onclick = ActionApriManuale;
    document.getElementById("btnAssegnaManuale").onclick = ActionAssegnaManuale;
    document.getElementById("btnCercaManualeWeb").onclick = ActionCercaManualeWeb;
    document.getElementById("btnSfogliaManuali").onclick = function() { shell.Run('explorer.exe "' + MANUALI_DIR + '"'); };

    document.getElementById("btnEsci").onclick = Script_BackToDashboard;
    
    var btnSalvaCard = document.getElementById("btnSalvaCard");
    if(btnSalvaCard) btnSalvaCard.onclick = ActionSalva;

    document.onkeydown = function(e) {
        e = e || window.event;
        var key = e.keyCode || e.which;
        var ctrl = e.ctrlKey;
        
        if (ctrl && key === 78) { // Ctrl+N (Nuovo)
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            ResetUI();
            return false;
        }
        if (ctrl && key === 83) { // Ctrl+S (Salva)
            if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
            ActionSalva();
            return false;
        }
    };
}

function ShowHint(msg, type) {
    var lbl = document.getElementById("lblHint");
    lbl.innerText = msg;
    var colors = { "danger": "#ef4444", "accent": "#10b981", "primary": "#3b82f6", "muted": "#6b7280" };
    lbl.style.color = colors[type] || colors["muted"];
}

/* --- RIBBON TABS LOGIC --- */
function switchRibbonTab(tabId, element) {
    var tabs = document.querySelectorAll('.ribbon-tab');
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
        var execStr = 'mshta.exe "' + fso.BuildPath(currentDir, modulo) + '"';
        shell.Run(execStr, 1, false);
        window.close();
    } catch (e) { }
};

window.Script_BackToDashboard = function() { window.NavigaModulo("dashboard.html"); };

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
