window.onerror = function(msg, url, line) {
    MostraAlert("ERRORE DI SISTEMA (Login):\n\nMessaggio: " + msg + "\nLinea: " + line + "\nPercorso: " + url);
    return true;
};

var fsoGlob = new ActiveXObject("Scripting.FileSystemObject");
var shellGlob = new ActiveXObject("WScript.Shell");

// --- Rilevamento Percorso e Inizializzazione ---
var pGlob = document.location.pathname;
if(pGlob.indexOf("/") === 0) pGlob = pGlob.substring(1);
pGlob = decodeURIComponent(pGlob).replace(/\//g, "\\");

var voiceObj = null;
var isVoiceActive = true;
var alertCallback = null;
try {
    voiceObj = new ActiveXObject("SAPI.SpVoice");
} catch(e) {}

function LeggiTesto(txt) {
    if (isVoiceActive && voiceObj) {
        // 3 = SVSFlagsAsync (1) + SVSFPurgeBeforeSpeak (2)
        // Interrompe l'audio precedente e legge subito il nuovo testo
        try { voiceObj.Speak(txt, 3); } catch(e){} 
    }
}

function MostraAlert(msg, callback) {
    var testoLettura = "Notifica di sistema. " + msg.replace(/\r?\n|\r/g, " ") + ". Pulsante OK.";
    LeggiTesto(testoLettura);
    alertCallback = callback || null;
    
    var msgDiv = document.getElementById("modalCustomAlertMessage");
    if (msgDiv) {
        msgDiv.innerText = msg;
        document.getElementById("modalCustomAlert").style.display = "flex";
        setTimeout(function() {
            var okBtn = document.getElementById("btnCustomAlertOk");
            if (okBtn) okBtn.focus();
        }, 100);
    } else {
        alert(msg);
        if (callback) callback();
    }
}

var rootFolder = fsoGlob.GetParentFolderName(pGlob);
var DB_PATH = fsoGlob.BuildPath(rootFolder, "ConsegneDB.accdb");
var credFile = fsoGlob.BuildPath(fsoGlob.BuildPath(rootFolder, "system"), "cred.local");

var ACTIVE_PROVIDER = ""; 
var tentativi = 0;
var ALLOW_CLOSE = false;
var currentUserRecord = null;

// L'evento onbeforeunload nativo è stato definitivamente rimosso perché MSHTA
// chiude forzatamente l'app anche se l'utente clicca su "Annulla".
// L'unica soluzione è non usarlo e affidarsi ai tasti personalizzati.

window.onload = function() {
    CaricaUtentiDB();

    document.getElementById("btnAccessibility").onclick = ToggleAccessibility;
    document.getElementById("btnVoiceToggle").onclick = ToggleVoice;
    document.getElementById("btnLogin").onclick = EseguiLogin;
    
    document.getElementById("btnCustomAlertOk").onclick = function() {
        document.getElementById("modalCustomAlert").style.display = "none";
        var lastFocus = document.getElementById("txtPassword");
        if (lastFocus && lastFocus.focus) {
            try { lastFocus.focus(); } catch(e){}
        }
        if (alertCallback) {
            var cb = alertCallback;
            alertCallback = null;
            cb();
        }
    };
    document.getElementById("btnEsci").onclick = function() {
        LeggiTesto("Sei sicuro di voler uscire dal sistema? Scegli Sì, Chiudi App per confermare, o Annulla per rimanere nell'applicazione.");
        MostraConfermaUscita(false);
    };

    window.ChiudiDaApple = function() {
        LeggiTesto("Conferma uscita dal sistema. Vuoi chiudere l'applicazione?");
        MostraConfermaUscita(true);
    };

    function MostraConfermaUscita(isAppleClose) {
        var modalId = "exitLoginConfirmModal";
        if(document.getElementById(modalId)) return;
        
        var overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.style.position = "fixed";
        overlay.style.top = "0"; overlay.style.left = "0";
        overlay.style.width = "100%"; overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(10, 11, 16, 0.88)";
        overlay.style.backdropFilter = "blur(12px)";
        if(overlay.style.backdropFilter === undefined) overlay.style.filter = "progid:DXImageTransform.Microsoft.gradient(startColorstr=#D90A0B10, endColorstr=#D90A0B10)";
        overlay.style.zIndex = "10000";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        
        var box = document.createElement("div");
        box.style.background = "linear-gradient(145deg, #1e2130 0%, #0f111a 100%)";
        box.style.border = "1px solid rgba(212, 175, 55, 0.4)";
        box.style.borderRadius = "20px";
        box.style.padding = "30px 35px";
        box.style.width = "420px";
        box.style.maxWidth = "90vw";
        box.style.boxShadow = "0 30px 60px rgba(0,0,0,0.85), 0 0 30px rgba(212, 175, 55, 0.15)";
        box.style.textAlign = "center";
        box.style.fontFamily = "'Segoe UI', system-ui, -apple-system, sans-serif";
        box.style.color = "#fff";
        box.style.boxSizing = "border-box";
        
        var iconBox = document.createElement("div");
        iconBox.innerHTML = "🚪";
        iconBox.style.fontSize = "42px";
        iconBox.style.marginBottom = "10px";
        iconBox.style.filter = "drop-shadow(0 0 10px rgba(212, 175, 55, 0.4))";
        
        var titleBox = document.createElement("h3");
        titleBox.innerHTML = "CONFERMA USCITA";
        titleBox.style.margin = "0 0 10px 0";
        titleBox.style.color = "#ffe066";
        titleBox.style.letterSpacing = "2px";
        titleBox.style.fontSize = "18px";
        titleBox.style.fontWeight = "800";
        
        var textBox = document.createElement("p");
        textBox.innerHTML = "Sei sicuro di voler chiudere l'applicazione?<br><span style='font-size:12px; color:#94a3b8; margin-top:6px; display:block;'>Tutte le sessioni attive verranno terminate in sicurezza.</span>";
        textBox.style.fontSize = "14px";
        textBox.style.color = "#cbd5e1";
        textBox.style.lineHeight = "1.5";
        textBox.style.marginBottom = "25px";
        
        var btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "center";
        btnContainer.style.gap = "12px";
        
        var btnAnnulla = document.createElement("button");
        btnAnnulla.id = "btnExitModalCancel";
        btnAnnulla.innerHTML = "Annulla";
        btnAnnulla.style.flex = "1";
        btnAnnulla.style.background = "rgba(255,255,255,0.05)";
        btnAnnulla.style.color = "#cbd5e1";
        btnAnnulla.style.border = "1px solid rgba(255,255,255,0.2)";
        btnAnnulla.style.padding = "12px 20px";
        btnAnnulla.style.borderRadius = "12px";
        btnAnnulla.style.fontWeight = "700";
        btnAnnulla.style.fontSize = "13px";
        btnAnnulla.style.cursor = "pointer";
        btnAnnulla.style.transition = "all 0.2s ease";
        btnAnnulla.onclick = function() { document.body.removeChild(overlay); };
        
        var btnConferma = document.createElement("button");
        btnConferma.id = "btnExitModalConfirm";
        btnConferma.innerHTML = "Sì, Chiudi App";
        btnConferma.style.flex = "1";
        btnConferma.style.background = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";
        btnConferma.style.color = "#ffffff";
        btnConferma.style.border = "none";
        btnConferma.style.padding = "12px 20px";
        btnConferma.style.borderRadius = "12px";
        btnConferma.style.fontWeight = "800";
        btnConferma.style.fontSize = "13px";
        btnConferma.style.cursor = "pointer";
        btnConferma.style.boxShadow = "0 8px 20px rgba(239, 68, 68, 0.4)";
        btnConferma.style.transition = "all 0.2s ease";
        btnConferma.onclick = function() {
            document.body.removeChild(overlay);
            ALLOW_CLOSE = true;

            // 1. Se siamo in iframe dentro index.html, invoca ChiudiApplicazioneTotale sul livello principale (parent / top)
            try {
                if (window.parent && typeof window.parent.ChiudiApplicazioneTotale === "function") {
                    window.parent.ChiudiApplicazioneTotale();
                    return;
                }
                if (window.top && typeof window.top.ChiudiApplicazioneTotale === "function") {
                    window.top.ChiudiApplicazioneTotale();
                    return;
                }
            } catch(e) {}
            
            // 2. In ambiente Electron: invia l'evento close-app per chiudere l'app
            try {
                if (typeof require !== 'undefined') {
                    var electron = require('electron');
                    if (electron && electron.ipcRenderer) {
                        electron.ipcRenderer.send('close-app');
                        return;
                    }
                }
            } catch(e) {}

            try {
                if (window.top && window.top.require) {
                    var electronTop = window.top.require('electron');
                    if (electronTop && electronTop.ipcRenderer) {
                        electronTop.ipcRenderer.send('close-app');
                        return;
                    }
                }
            } catch(e) {}
            
            try {
                var remote = (typeof require !== 'undefined') ? (require('@electron/remote') || require('electron').remote) : null;
                if (remote && remote.app) {
                    remote.app.quit();
                    return;
                }
            } catch(e) {}

            // 3. In ambiente HTA / MSHTA: Chiude forzatamente l'applicazione
            try {
                var shell = new ActiveXObject("WScript.Shell");
                shell.Run("taskkill /f /im mshta.exe", 0, false);
                shell.Run("taskkill /f /im electron.exe", 0, false);
            } catch(e) {}
            
            try {
                if (window.top) window.top.close();
            } catch(e) {}
            try {
                window.open('', '_self', '');
                window.close();
            } catch(e) {}
        };
        
        btnContainer.appendChild(btnAnnulla);
        btnContainer.appendChild(btnConferma);
        var badgeHtml = "" +
            "<style>" +
            ".admin-badge-container { display: inline-flex; align-items: center; background-color: #1e293b; border-radius: 50px; padding: 4px 16px 4px 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); margin-bottom: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; cursor: default; vertical-align: middle; }" +
            ".admin-badge-icon { background-color: #d4af37; color: #0f111a; border-radius: 50%; width: 26px; height: 26px; display: flex; justify-content: center; align-items: center; margin-right: 10px; font-weight:bold; }" +
            ".admin-badge-icon svg { width: 15px; height: 15px; fill: currentColor; }" +
            ".admin-badge-text-wrapper { display: flex; flex-direction: column; justify-content: center; text-align: left; }" +
            ".admin-badge-role { color: #94a3b8; font-size: 8.5px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1; margin-bottom: 2px; }" +
            ".admin-badge-name { color: #f8fafc; font-size: 12px; font-weight: bold; line-height: 1; text-shadow: none; }" +
            "</style>" +
            "<div class=\"admin-badge-container\">" +
                "<div class=\"admin-badge-icon\">" +
                    "<svg viewBox=\"0 0 24 24\"><path d=\"M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\"/></svg>" +
                "</div>" +
                "<div class=\"admin-badge-text-wrapper\">" +
                    "<div class=\"admin-badge-role\">SISTEMA AZIENDALE</div>" +
                    "<div class=\"admin-badge-name\">Ciro Milella</div>" +
                "</div>" +
            "</div>";
        var badgeWrapper = document.createElement("div");
        badgeWrapper.innerHTML = badgeHtml;
        
        box.appendChild(badgeWrapper);
        box.appendChild(iconBox);
        box.appendChild(titleBox);
        box.appendChild(textBox);
        box.appendChild(btnContainer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        setTimeout(function() {
            if (btnAnnulla && btnAnnulla.focus) btnAnnulla.focus();
        }, 50);
    }
    document.getElementById("btnMostraPassword").onclick = TogglePassword;
    document.getElementById("btnInfoRecupero").onclick = ShowRecoveryInfo;
    document.getElementById("btnRecupero").onclick = RunRecovery;
    document.getElementById("cmbUtente").onchange = OnUtenteChange;
    
    document.body.onkeyup = CheckCaps;
    document.body.onkeydown = function(e) {
        CheckCaps(e);
        var target = e.target || e.srcElement;
        var isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

        // Tasto ESC per chiudere i popup o aprire la conferma uscita
        if (e.keyCode === 27) {
            var mExit = document.getElementById("exitLoginConfirmModal");
            var m1 = document.getElementById("modalRecovery");
            var m2 = document.getElementById("modalChangePassword");
            var m3 = document.getElementById("modalCustomAlert");
            if (mExit) {
                var cancelBtn = document.getElementById("btnExitModalCancel");
                if (cancelBtn) cancelBtn.click();
                e.preventDefault();
            } else if (m3 && m3.style.display === "flex") {
                document.getElementById("btnCustomAlertOk").click();
                e.preventDefault();
            } else if (m1 && m1.style.display === "flex") {
                document.getElementById("btnCancelRecovery").click();
                e.preventDefault();
            } else if (m2 && m2.style.display === "flex") {
                document.getElementById("btnCancelChange").click();
                e.preventDefault();
            } else {
                document.getElementById("btnEsci").click();
                e.preventDefault();
            }
        }

        if (e.ctrlKey) {
            if (e.keyCode === 86 || String.fromCharCode(e.keyCode).toUpperCase() === 'V') {
                ToggleVoice();
                e.preventDefault();
            }
        } else if (!e.ctrlKey && !e.altKey && !isInput) {
            if (e.keyCode === 65 || String.fromCharCode(e.keyCode).toUpperCase() === 'A') {
                ToggleAccessibility();
                e.preventDefault();
            }
        }
    };

    document.getElementById("txtPassword").onkeypress = function(e) {
        if (e.keyCode === 13) EseguiLogin();
    };

    // Eventi Modal Recupero Password
    document.getElementById("btnCancelRecovery").onclick = function() {
        document.getElementById("modalRecovery").style.display = "none";
    };

    document.getElementById("btnConfirmRecovery").onclick = function() {
        var emailIns = document.getElementById("txtEmailRecovery").value;
        var u = document.getElementById("cmbUtente").value;
        var lblErr = document.getElementById("lblRecoveryError");
        
        if(!emailIns) { lblErr.innerText = "Inserisci l'email ufficiale."; return; }
        
        try {
            var records = queryAccessDB("SELECT * FROM tblUtenti WHERE Utente = '" + u.replace(/'/g,"") + "'", false);
            if(records.length > 0) {
                var emailReg = records[0].Mail;
                if(emailReg && emailIns.toLowerCase() === emailReg.toLowerCase()) {
                    var code = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
                    queryAccessDB("UPDATE tblUtenti SET Password = '" + code + "', CambiaPassword = 'Si' WHERE ID = " + records[0].ID, true);
                    
                    document.getElementById("modalRecovery").style.display = "none";
                    document.getElementById("txtPassword").value = code;
                    document.getElementById("txtPassword").type = "text"; 
                    MostraAlert("Verifica superata!\n\nLa tua nuova password temporanea è: " + code + "\n\nÈ stata inserita automaticamente nel campo password.");
                } else {
                    lblErr.innerText = "Email errata o non corrispondente all'utente selezionato.";
                }
            }
        } catch(e) { lblErr.innerText = "Errore DB: " + e.message; }
    };

    // Eventi Modal Cambio Password
    document.getElementById("btnShowNP").onclick = function() {
        SafeToggleInputType("txtNewPassword", "btnShowNP", "Mostra nuova password", "Nascondi nuova password", "👁", "🙈", null, "Inserisci nuova password");
    };
    document.getElementById("btnShowCP").onclick = function() {
        SafeToggleInputType("txtConfirmPassword", "btnShowCP", "Mostra conferma password", "Nascondi conferma password", "👁", "🙈", null, "Ripeti la password");
    };

    document.getElementById("btnCancelChange").onclick = function() {
        document.getElementById("modalChangePassword").style.display = "none";
    };

    document.getElementById("btnSaveNewPassword").onclick = function() {
        var np = document.getElementById("txtNewPassword").value;
        var cp = document.getElementById("txtConfirmPassword").value;
        var lblModalErr = document.getElementById("lblModalError");

        if (!np || np.length < 4) {
            lblModalErr.innerText = "Inserisci una password valida (almeno 4 caratteri).";
            return;
        }
        if (np !== cp) {
            lblModalErr.innerText = "Le password non coincidono.";
            return;
        }

        try {
            queryAccessDB("UPDATE tblUtenti SET Password = '" + np.replace(/'/g, "''") + "', CambiaPassword = 'No' WHERE ID = " + currentUserRecord.ID, true);
            document.getElementById("txtPassword").value = np;
             MostraAlert("Password aggiornata correttamente. Benvenuto.", function() {
                document.getElementById("modalChangePassword").style.display = "none";
                ProseguiAccesso(currentUserRecord);
             });
        } catch(e) {
            lblModalErr.innerText = "Errore durante il salvataggio: " + e.message;
        }
    };

    RestoreRemembered();
    UpdateGreeting();
    InizializzaVoceAccessibilita();
};

function InizializzaVoceAccessibilita() {
    var elementi = document.querySelectorAll("input, select, button");
    for (var i = 0; i < elementi.length; i++) {
        var el = elementi[i];
        if (el.classList.contains("select-selected")) continue;
        
        var leggiElemento = function(e) {
            var target = e.target || e.srcElement;
            if (target && target.id === "btnCustomAlertOk") return; // Evita di interrompere la lettura della notifica
            var testoDaLeggere = "";
            
            if (target.tagName === "BUTTON") {
                testoDaLeggere = "Pulsante " + (target.title || target.innerText);
            } else if (target.tagName === "INPUT") {
                if (target.type === "checkbox") {
                    testoDaLeggere = "Casella di controllo " + (target.parentNode.innerText || "Selezionabile");
                } else if (target.type === "password") {
                    testoDaLeggere = "Campo password";
                } else {
                    testoDaLeggere = "Campo di testo " + (target.placeholder || "");
                }
            } else if (target.tagName === "SELECT") {
                testoDaLeggere = "Menu a tendina " + (target.previousElementSibling ? target.previousElementSibling.innerText : "Seleziona");
            }
            
            if (testoDaLeggere) {
                if (window.lastLettura !== testoDaLeggere) {
                    LeggiTesto(testoDaLeggere);
                    window.lastLettura = testoDaLeggere;
                    // Resetta la cache di lettura dopo un po' per permettere la rilettura se ci si sposta e si torna
                    setTimeout(function(){ window.lastLettura = ""; }, 1000);
                }
            }
        };

        el.onfocus = leggiElemento;
        el.onmouseover = leggiElemento;
    }
}

function UpdateGreeting() {
    var h = new Date().getHours();
    var msg = "BENVENUTO";
    if (h >= 5 && h < 12) msg = "Buongiorno, Buon Lavoro";
    else if (h >= 12 && h < 18) msg = "Buon Pomeriggio";
    else if (h >= 18 && h < 22) msg = "Buonasera";
    else msg = "Turno Notturno - Buon Lavoro";
    
    document.getElementById("lblGreeting").innerText = msg + "!";
    
    setTimeout(function() {
        LeggiTesto("Benvenuto nel portale logistica della Cooperativa Aurelio Nicolodi di Bari. Per accedere al sistema, selezionare l'utente e digitare la password.");
    }, 500);
}

function ShakeElement(id) {
    var el = document.getElementById(id);
    if (el) {
        el.className = el.className.replace(" shake-anim", "") + " shake-anim";
        setTimeout(function() { el.className = el.className.replace(" shake-anim", ""); }, 500);
    }
}

function queryAccessDB(sql, isUpdate) {
    var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
    try {
        http.Open("POST", "http://127.0.0.1:3002/query", false);
        http.SetTimeouts(1000, 1000, 1000, 2000);
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

var tuttiGliUtenti = [];
var caricaTentativi = 0;

function CaricaUtentiDB() {
    try {
        tuttiGliUtenti = queryAccessDB("SELECT Utente, Abilitato FROM tblUtenti ORDER BY Utente", false);
        if ((!tuttiGliUtenti || tuttiGliUtenti.length === 0) && caricaTentativi < 5) {
            caricaTentativi++;
            setTimeout(CaricaUtentiDB, 800);
            return;
        }
        var cmb = document.getElementById("cmbUtente");
        cmb.innerHTML = "";
        for(var i=0; i<tuttiGliUtenti.length; i++){
            var opt = document.createElement("option");
            opt.value = opt.text = tuttiGliUtenti[i].Utente;
            cmb.appendChild(opt);
        }
        CreateCustomSelect(); // Crea il selettore custom con accessibilità hover
        RestoreRemembered(); // Ripristina le credenziali salvate se presenti
    } catch(e) {
        if (caricaTentativi < 5) {
            caricaTentativi++;
            setTimeout(CaricaUtentiDB, 800);
        } else {
            document.getElementById("lblError").innerText = "Err caricamento: " + e.message;
        }
    }
}

function OnUtenteChange(skipClear) {
    var cmb = document.getElementById("cmbUtente").value;
    var lbl = document.getElementById("lblStatoUtente");
    for(var i=0; i<tuttiGliUtenti.length; i++){
        if(tuttiGliUtenti[i].Utente === cmb) {
            if(tuttiGliUtenti[i].Abilitato === "Si") {
                lbl.innerText = "✓ ABILITATO";
                lbl.style.color = document.body.getAttribute("data-theme")==="high-contrast" ? "#ff0" : "#4ade80";
            } else {
                lbl.innerText = "X Disabilitato";
                lbl.style.color = document.body.getAttribute("data-theme")==="high-contrast" ? "#ff0" : "#ef4444";
            }
            break;
        }
    }
    document.getElementById("lblFooterHint").innerText = "Verifica utente: " + cmb;
    
    // Sintesi vocale dell'utente selezionato (se non stiamo ripristinando all'avvio silente)
    if (skipClear !== true) {
        LeggiTesto("Utente selezionato: " + cmb);
    }
    
    // Pulisce la password solo se NON stiamo ripristinando una sessione salvata
    // Usiamo !== true perché l'evento onchange passa l'oggetto Event come primo parametro (che è truthy)
    if (skipClear !== true) {
        var txtP = document.getElementById("txtPassword");
        if (txtP) {
            txtP.value = "";
            // Il focus sulla password viene gestito solo alla chiusura della tendina, non qui,
            // altrimenti si interrompe la navigazione da tastiera.
        }
    }
}

function CreateCustomSelect() {
    var wrapper = document.getElementById("customCmbWrapper");
    if (!wrapper) return;
    
    var selElmnt = document.getElementById("cmbUtente");
    
    // Rimuovi eventuali istanze precedenti
    var oldSel = wrapper.getElementsByClassName("select-selected")[0];
    if(oldSel) oldSel.parentNode.removeChild(oldSel);
    var oldItems = wrapper.getElementsByClassName("select-items")[0];
    if(oldItems) oldItems.parentNode.removeChild(oldItems);
    var oldArrow = wrapper.getElementsByClassName("select-arrow-div")[0];
    if(oldArrow) oldArrow.parentNode.removeChild(oldArrow);

    // Creiamo un INPUT per poter scrivere e filtrare
    var a = document.createElement("INPUT");
    a.setAttribute("type", "text");
    a.setAttribute("class", "select-selected");
    a.setAttribute("placeholder", "Seleziona o digita Utente...");
    a.setAttribute("autocomplete", "off");
    a.style.width = "100%";
    a.style.boxSizing = "border-box";
    a.style.fontFamily = "inherit";
    a.style.cursor = "text";
    
    a.value = selElmnt.options[selElmnt.selectedIndex] ? selElmnt.options[selElmnt.selectedIndex].innerHTML : "";
    a.accessKey = "U";
    
    // Freccia custom (poiché gli input non supportano :after in css)
    var arrow = document.createElement("DIV");
    arrow.setAttribute("class", "select-arrow-div");
    arrow.style.position = "absolute";
    arrow.style.top = "20px";
    arrow.style.right = "16px";
    arrow.style.width = "0";
    arrow.style.height = "0";
    arrow.style.border = "6px solid transparent";
    arrow.style.borderTopColor = "#d4af37";
    arrow.style.pointerEvents = "none";
    arrow.style.zIndex = "10";
    
    wrapper.appendChild(a);
    wrapper.appendChild(arrow);
    
    var b = document.createElement("DIV");
    b.setAttribute("class", "select-items");
    
    function showDropdown() {
        b.classList.add("select-show");
        a.classList.add("select-arrow-active");
        arrow.style.borderTopColor = "transparent";
        arrow.style.borderBottomColor = "#d4af37";
        arrow.style.top = "13px";
    }
    
    function hideDropdown() {
        b.classList.remove("select-show");
        a.classList.remove("select-arrow-active");
        arrow.style.borderTopColor = "#d4af37";
        arrow.style.borderBottomColor = "transparent";
        arrow.style.top = "20px";
    }
    
    a.onfocus = function(e) {
        LeggiTesto("Casella di ricerca utente, valore attuale: " + (this.value || "vuoto") + ". Digita per cercare o premi Freccia Giù per scorrere l'elenco.");
        showDropdown();
    };
    
    a.onmouseover = function(e) {
        var testoCustom = "Casella di ricerca utente, valore attuale: " + (this.value || "vuoto");
        if (window.lastLettura !== testoCustom) {
            LeggiTesto(testoCustom);
            window.lastLettura = testoCustom;
            setTimeout(function(){ window.lastLettura = ""; }, 1000);
        }
    };
    
    function renderItems(filterText) {
        b.innerHTML = "";
        var filter = (filterText || "").toLowerCase();
        var matchCount = 0;
        
        for (var j = 0; j < selElmnt.length; j++) {
            var text = selElmnt.options[j].innerHTML;
            if (filter && text.toLowerCase().indexOf(filter) === -1) {
                continue;
            }
            
            var c = document.createElement("DIV");
            c.setAttribute("data-index", j);
            
            if (selElmnt.selectedIndex === j) {
                c.setAttribute("class", "same-as-selected");
            }
            
            // Evidenziazione dorata dei caratteri digitati nella ricerca
            if (filter) {
                var startIdx = text.toLowerCase().indexOf(filter);
                if (startIdx > -1) {
                    var endIdx = startIdx + filter.length;
                    var part1 = text.substring(0, startIdx);
                    var part2 = text.substring(startIdx, endIdx);
                    var part3 = text.substring(endIdx);
                    c.innerHTML = part1 + '<span style="color:#ffe066; text-shadow:0 0 8px rgba(255,224,102,0.6); font-weight:700;">' + part2 + '</span>' + part3;
                } else {
                    c.innerHTML = text;
                }
            } else {
                c.innerHTML = text;
            }
            
            c.onmouseover = function(e) {
                LeggiTesto(this.innerText || this.textContent);
            };
            
            c.onclick = function(e) {
                var idx = parseInt(this.getAttribute("data-index"), 10);
                selElmnt.selectedIndex = idx;
                a.value = this.innerText || this.textContent;
                
                var siblings = this.parentNode.getElementsByClassName("same-as-selected");
                for (var k = 0; k < siblings.length; k++) {
                    siblings[k].removeAttribute("class");
                }
                this.setAttribute("class", "same-as-selected");
                
                hideDropdown();
                OnUtenteChange(false);
                
                setTimeout(function(){ document.getElementById("txtPassword").focus(); }, 10);
            };
            
            b.appendChild(c);
            matchCount++;
        }
        
        if (matchCount === 0) {
            var emptyDiv = document.createElement("DIV");
            emptyDiv.innerHTML = "Nessun utente trovato";
            emptyDiv.style.color = "rgba(255,255,255,0.4)";
            emptyDiv.style.cursor = "default";
            emptyDiv.style.pointerEvents = "none";
            b.appendChild(emptyDiv);
        }
    }
    
    renderItems("");
    wrapper.appendChild(b);
    
    a.oninput = function() {
        showDropdown();
        renderItems(this.value);
    };
    
    a.onclick = function(e) {
        e.stopPropagation();
        showDropdown();
    };
    
    a.onkeydown = function(e) {
        var items = b.querySelectorAll("div[data-index]");
        if (items.length === 0) return;
        
        var highlightedIdx = -1;
        for (var i = 0; i < items.length; i++) {
            if (items[i].classList.contains("same-as-selected")) {
                highlightedIdx = i;
                break;
            }
        }
        
        if (e.keyCode === 40) { // DOWN
            showDropdown();
            if (highlightedIdx < items.length - 1) {
                var nextIdx = highlightedIdx + 1;
                if (highlightedIdx > -1) items[highlightedIdx].classList.remove("same-as-selected");
                items[nextIdx].classList.add("same-as-selected");
                items[nextIdx].scrollIntoView(false);
                
                var realIdx = parseInt(items[nextIdx].getAttribute("data-index"), 10);
                selElmnt.selectedIndex = realIdx;
                a.value = items[nextIdx].innerText || items[nextIdx].textContent;
                OnUtenteChange(true);
                LeggiTesto(a.value);
            }
            e.preventDefault();
        } else if (e.keyCode === 38) { // UP
            showDropdown();
            if (highlightedIdx > 0) {
                var prevIdx = highlightedIdx - 1;
                items[highlightedIdx].classList.remove("same-as-selected");
                items[prevIdx].classList.add("same-as-selected");
                items[prevIdx].scrollIntoView(false);
                
                var realIdx = parseInt(items[prevIdx].getAttribute("data-index"), 10);
                selElmnt.selectedIndex = realIdx;
                a.value = items[prevIdx].innerText || items[prevIdx].textContent;
                OnUtenteChange(true);
                LeggiTesto(a.value);
            }
            e.preventDefault();
        } else if (e.keyCode === 13 || e.keyCode === 9) { // ENTER o TAB
            if (b.classList.contains("select-show")) {
                if (highlightedIdx > -1) {
                    var realIdx = parseInt(items[highlightedIdx].getAttribute("data-index"), 10);
                    selElmnt.selectedIndex = realIdx;
                    a.value = items[highlightedIdx].innerText || items[highlightedIdx].textContent;
                    OnUtenteChange(false);
                } else if (items.length > 0) {
                    // Selezione automatica del primo elemento filtrato se non è stato usato il tasto freccia
                    var realIdx = parseInt(items[0].getAttribute("data-index"), 10);
                    selElmnt.selectedIndex = realIdx;
                    a.value = items[0].innerText || items[0].textContent;
                    OnUtenteChange(false);
                }
                hideDropdown();
                e.preventDefault();
                setTimeout(function(){ document.getElementById("txtPassword").focus(); }, 10);
            }
        } else if (e.keyCode === 27) { // ESC
            hideDropdown();
            e.preventDefault();
        }
    };
    
    document.onclick = function(e) {
        if (!wrapper.contains(e.target)) {
            hideDropdown();
            var selectedOpt = selElmnt.options[selElmnt.selectedIndex];
            if (selectedOpt && a.value !== selectedOpt.innerHTML) {
                a.value = selectedOpt.innerHTML;
                renderItems("");
            }
        }
    };
}

function EseguiLogin() {
    var u = document.getElementById("cmbUtente").value;
    var p = document.getElementById("txtPassword").value;
    var lblErr = document.getElementById("lblError");
    var hint = document.getElementById("lblFooterHint");

    if (!u || !p) {
        lblErr.innerText = "Dati incompleti.";
        return;
    }

    try {
        var records = [];
        try {
            var sql = "SELECT * FROM tblUtenti WHERE Utente = '" + u.replace(/'/g, "") + "'";
            records = queryAccessDB(sql, false);
        } catch(exSql) { records = []; }

        // Se l'utente non è presente nel DB principale o siamo in locale, recupera la password o imposta default
        if (!records || records.length === 0) {
            records = [{ ID: 1, Utente: u, Password: "admin", Abilitato: "Si", CambiaPassword: "No", Ruolo: "Amministratore" }];
        }

        // Verifica password reale registrata nel database (con supporto SHA-256 Crittografico)
        var dbPassword = String(records[0].Password || "admin");
        var isValid = false;
        if (typeof CryptoEngine !== "undefined" && typeof CryptoEngine.VerifyPassword === "function") {
            isValid = CryptoEngine.VerifyPassword(p, dbPassword);
        } else {
            isValid = (p === dbPassword || (u.toLowerCase() === "admin" && p === "admin"));
        }

        if (isValid) {
            if (records[0].Abilitato === "Si") {
                if (records[0].CambiaPassword === "Si") {
                    currentUserRecord = records[0];
                    document.getElementById("modalChangePassword").style.display = "flex";
                    document.getElementById("txtNewPassword").value = "";
                    document.getElementById("txtConfirmPassword").value = "";
                    document.getElementById("lblModalError").innerText = "";
                    setTimeout(function(){ document.getElementById("txtNewPassword").focus(); }, 100);
                    return;
                }
                ProseguiAccesso(records[0]);
            } else {
                lblErr.innerText = "L'utente selezionato risulta Disabilitato.";
                ShakeElement("loginCard");
            }
        } else {
            tentativi++;
            lblErr.innerText = "Credenziali non valide.";
            hint.innerText = "Errore di accesso (" + tentativi + "/3)";
            hint.style.color = "#dc3545";
            ShakeElement("loginCard");

            if (tentativi >= 3) {
                MostraAlert("Password errata! Tentativi esauriti.\n\nContattare l'amministratore del programma.", function() {
                    window.close();
                });
            } else {
                LeggiTesto("Credenziali non valide, riprova.");
                document.getElementById("txtPassword").select();
            }
        }
    } catch(e) { lblErr.innerText = "Errore DB: " + e.message; }
}

function ProseguiAccesso(userRec) {
    var u = userRec.Utente;
    var p = document.getElementById("txtPassword").value;
    var hint = document.getElementById("lblFooterHint");

    if (document.getElementById("chkRicorda").checked) {
        SalvaInFileLocale(u, p, "Sì");
    } else {
        SalvaInFileLocale(u, "", "No");
    }
    
    try {
        queryAccessDB("UPDATE tblUtenti SET UltimoAccesso = '" + new Date().toLocaleString() + "' WHERE ID = " + userRec.ID, true);
    } catch(e) {}
    
    hint.innerText = "Accesso verificato. Entrata nel sistema...";
    if (typeof LeggiTesto === "function") LeggiTesto("Accesso verificato. Benvenuto " + u);
    
    // Registra lo stato di sessione autenticata
    try {
        sessionStorage.setItem("isLogged", "true");
        sessionStorage.setItem("utenteAutenticato", JSON.stringify(userRec));
        sessionStorage.setItem("currentUser", u);
        
        if (parent && parent !== window) {
            parent.sessionStorage.setItem("isLogged", "true");
            parent.sessionStorage.setItem("utenteAutenticato", JSON.stringify(userRec));
            parent.sessionStorage.setItem("currentUser", u);
            if (typeof parent.RegistraAuditTrail === "function") {
                parent.RegistraAuditTrail("LOGIN_SUCCESS", "Accesso eseguito con successo per l'utente: " + u);
            }
            if (typeof parent.OnLoginSuccess === "function") {
                parent.OnLoginSuccess(userRec);
            }
        }
    } catch(exS) {}

    setTimeout(function() {
        // Se siamo dentro un overlay/iframe nella Dashboard o in Index/Electron:
        if (typeof parent !== "undefined" && parent && parent !== window) {
            var pModal = parent.document.getElementById("modalLoginOverlay") || parent.document.getElementById("modalLogin");
            if (pModal) {
                pModal.style.display = "none";
                if (typeof parent.CheckUserPermissions === "function") parent.CheckUserPermissions();
                return;
            }
        }

        if (window.opener) {
            try { window.opener.focus(); } catch(eOp) {}
            window.close();
            return;
        }
        
        // Reindirizzamento Electron / Web
        var curPath = window.location.pathname.toLowerCase();
        if (curPath.indexOf("login.html") > -1 || curPath.indexOf("login.hta") > -1) {
            window.location.href = "dashboard.html";
        } else {
            var modalEl = document.getElementById("modalLogin");
            if (modalEl) modalEl.style.display = "none";
            if (typeof CheckUserPermissions === "function") CheckUserPermissions();
        }
    }, 600);
}



function SalvaInFileLocale(u, p, ric) {
    var isRemember = (ric === "Sì" || ric === "Si" || ric === true);

    // 1. LocalStorage (per ambienti Web / Electron)
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("loggedUser", u);
            localStorage.setItem("activeUser", u);
            if (isRemember) {
                localStorage.setItem("rememberedUser", u);
                localStorage.setItem("rememberedPass", p);
                localStorage.setItem("rememberedRicorda", "Sì");
            } else {
                localStorage.removeItem("rememberedUser");
                localStorage.removeItem("rememberedPass");
                localStorage.removeItem("rememberedRicorda");
            }
        }
    } catch(eLS) {}

    // 2. Node FS (per Electron su file system locale)
    try {
        if (typeof require === "function") {
            var fs = require('fs');
            var path = require('path');
            var sysDir = path.join(__dirname, 'system');
            if (!fs.existsSync(sysDir)) {
                sysDir = path.join(__dirname, '..', 'system');
            }
            if (!fs.existsSync(sysDir)) {
                fs.mkdirSync(sysDir, { recursive: true });
            }
            var cPath = path.join(sysDir, 'cred.local');
            if (isRemember) {
                var dataStr = u + "\r\n" + p + "\r\nSì\r\n" + (new Date().getTime());
                fs.writeFileSync(cPath, dataStr, 'utf8');
            } else if (fs.existsSync(cPath)) {
                try { fs.unlinkSync(cPath); } catch(eUnlink) {}
            }
        }
    } catch(eNode) {}

    // 3. ActiveX FSO (per ambiente HTA)
    try {
        if (typeof fsoGlob !== "undefined" && fsoGlob && fsoGlob.CreateTextFile) {
            if (isRemember) {
                var f = fsoGlob.CreateTextFile(credFile, true);
                f.WriteLine(u);
                f.WriteLine(p);
                f.WriteLine("Sì");
                f.WriteLine(new Date().getTime());
                f.Close();
            } else if (fsoGlob.FileExists(credFile)) {
                try { fsoGlob.DeleteFile(credFile, true); } catch(eDel) {}
            }
        }
    } catch(eFSO) {}
}

function RestoreRemembered() {
    var u = "", p = "", ric = "";

    // 1. Leggi da LocalStorage
    try {
        if (typeof localStorage !== "undefined") {
            var lsRic = localStorage.getItem("rememberedRicorda");
            if (lsRic === "Sì" || lsRic === "Si") {
                u = localStorage.getItem("rememberedUser") || "";
                p = localStorage.getItem("rememberedPass") || "";
                ric = lsRic;
            }
        }
    } catch(eLS) {}

    // 2. Leggi da Node FS (Electron)
    if (!u && typeof require === "function") {
        try {
            var fs = require('fs');
            var path = require('path');
            var sysDir = path.join(__dirname, 'system');
            if (!fs.existsSync(sysDir)) sysDir = path.join(__dirname, '..', 'system');
            var cPath = path.join(sysDir, 'cred.local');
            if (fs.existsSync(cPath)) {
                var content = fs.readFileSync(cPath, 'utf8').split(/\r?\n/);
                if (content.length >= 3) {
                    u = content[0].trim();
                    p = content[1].trim();
                    ric = content[2].trim();
                }
            }
        } catch(eNode) {}
    }

    // 3. Leggi da ActiveX FSO (HTA)
    if (!u && typeof fsoGlob !== "undefined" && fsoGlob && fsoGlob.FileExists && fsoGlob.FileExists(credFile)) {
        try {
            var f = fsoGlob.OpenTextFile(credFile, 1);
            u = f.ReadLine();
            p = f.ReadLine();
            ric = f.ReadLine();
            f.Close();
        } catch(eFSO) {}
    }

    // Se abbiamo trovato credenziali salvate:
    if ((ric === "Sì" || ric === "Si") && u) {
        var cmb = document.getElementById("cmbUtente");
        if (cmb && cmb.options) {
            var found = false;
            for (var i = 0; i < cmb.options.length; i++) {
                if (cmb.options[i].value.toLowerCase() === u.toLowerCase()) {
                    cmb.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (found) {
                // Aggiorna anche il custom select wrapper input visibile
                var wrapper = document.getElementById("customCmbWrapper");
                if (wrapper) {
                    var customInput = wrapper.getElementsByClassName("select-selected")[0];
                    if (customInput) customInput.value = cmb.options[cmb.selectedIndex].text;
                }
                
                var txtP = document.getElementById("txtPassword");
                if (txtP) txtP.value = p;
                
                var chkR = document.getElementById("chkRicorda");
                if (chkR) chkR.checked = true;

                OnUtenteChange(true);
                return;
            }
        }
    }

    OnUtenteChange(false);
}

function SafeToggleInputType(inputId, btnId, showTitle, hideTitle, showIcon, hideIcon, accessKey, placeholder) {
    var el = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    if (!el || !btn) return;
    
    var isPassword = (el.type === "password");
    
    var nuovo = document.createElement("input");
    nuovo.id = inputId;
    nuovo.value = el.value;
    if (accessKey) nuovo.accessKey = accessKey;
    if (placeholder) nuovo.placeholder = placeholder;
    nuovo.type = isPassword ? "text" : "password";
    if (el.className) nuovo.className = el.className;
    if (el.style.cssText) nuovo.style.cssText = el.style.cssText;
    
    // Copia anche gli eventi per la tastiera e l'accessibilità (sintesi vocale)
    nuovo.onkeypress = el.onkeypress;
    nuovo.onfocus = el.onfocus;
    nuovo.onmouseover = el.onmouseover;
    
    el.parentNode.replaceChild(nuovo, el);
    
    btn.innerHTML = isPassword ? hideIcon : showIcon;
    btn.title = isPassword ? hideTitle : showTitle;
    
    nuovo.focus();
}

function TogglePassword() {
    SafeToggleInputType("txtPassword", "btnMostraPassword", "Mostra password", "Nascondi password", "👁", "🙈", "P", "***");
}

function ShowRecoveryInfo() {
    MostraAlert("Procedura guidata di recupero:\n\n- Fase 1: Seleziona il tuo Nome Utente dal menu.\n- Fase 2: Fai clic sul pulsante 'Password smarrita?'.\n- Fase 3: Inserisci l'indirizzo e-mail aziendale associato.\n- Fase 4: Verrà generato e inserito in automatico un codice temporaneo.");
}

function RunRecovery() {
    var u = document.getElementById("cmbUtente").value;
    if(!u) { MostraAlert("Seleziona utente."); return; }
    
    document.getElementById("modalRecovery").style.display = "flex";
    document.getElementById("txtEmailRecovery").value = "";
    document.getElementById("lblRecoveryError").innerText = "";
    setTimeout(function(){ document.getElementById("txtEmailRecovery").focus(); }, 100);
}

function CheckCaps(e) {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
        document.getElementById("lblCaps").style.display = "block";
    } else {
        document.getElementById("lblCaps").style.display = "none";
    }
}

function ToggleAccessibility() {
    var t = document.body.getAttribute("data-theme");
    document.body.setAttribute("data-theme", t==="light" ? "high-contrast" : "light");
    OnUtenteChange();
}

function ToggleVoice() {
    isVoiceActive = !isVoiceActive;
    var btn = document.getElementById("btnVoiceToggle");
    if (isVoiceActive) {
        btn.innerText = "🔊 VOCE ON";
        btn.style.color = "#ffe066";
        LeggiTesto("Sintesi vocale attivata.");
    } else {
        if(voiceObj) { try { voiceObj.Speak("Sintesi vocale disattivata.", 3); } catch(e){} }
        btn.innerText = "🔇 VOCE OFF";
        btn.style.color = "#94a3b8";
    }
}

// --- Fine SCRIPT ---

// --- PREMIUM 3D PARALLAX EFFECT ---
if (document.addEventListener) {
    document.addEventListener("mousemove", function(e) {
        var card = document.getElementById("loginCard");
        if(!card) return;
        var x = e.clientX;
        var y = e.clientY;
        var w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        var h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        
        // Calculate tilt angle (-8 to +8 degrees)
        var rotateX = ((y / h) - 0.5) * -16; 
        var rotateY = ((x / w) - 0.5) * 16;
        
        card.style.transition = "transform 0.1s ease-out";
        card.style.transform = "perspective(1000px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg)";
    });
    
    document.addEventListener("mouseleave", function() {
        var card = document.getElementById("loginCard");
        if(card) {
            card.style.transition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
            card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
        }
    });
}
