/**
 * APPLE WINDOW CONTROLS - Logica Universale per HTA
 * Gestisce Drag & Drop, Minimizzazione, Massimizzazione e Chiusura.
 */

var isDragging = false;
var mouseX, mouseY;

// --- TRASCINAMENTO FINESTRA ---
function StartDrag() {
    isDragging = true;
    mouseX = event.screenX;
    mouseY = event.screenY;
    document.body.onmousemove = DoDrag;
    document.body.onmouseup = StopDrag;
}

function DoDrag() {
    if (!isDragging) return;
    var deltaX = event.screenX - mouseX;
    var deltaY = event.screenY - mouseY;
    window.moveBy(deltaX, deltaY);
    mouseX = event.screenX;
    mouseY = event.screenY;
}

function StopDrag() {
    isDragging = false;
    document.body.onmousemove = null;
    document.body.onmouseup = null;
}

// --- CONTROLLI FINESTRA ---
function getHtaApp() {
    // Cerca l'elemento HTA:APPLICATION nel documento
    var htas = document.getElementsByTagName("HTA:APPLICATION");
    if (htas && htas.length > 0) {
        return htas[0];
    }
    return null;
}

// Rileva se siamo in Electron
function _isElectronEnv() {
    return (typeof process !== "undefined" && process.versions && process.versions.electron) ||
           (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) ||
           (typeof require === "function");
}

// Ottieni il nome della pagina corrente
function _currentPage() {
    var href = window.location.href || "";
    var parts = href.split("/");
    return parts[parts.length - 1].split("?")[0].toLowerCase();
}

function MinimizeWindow() {
    try {
        if (typeof require !== 'undefined') {
            var electron = require('electron');
            if (electron && electron.ipcRenderer) {
                electron.ipcRenderer.send('minimize-app');
                return;
            }
        }
    } catch(e) {}
    if (_isElectronEnv()) {
        try {
            var remote = require("@electron/remote") || require("electron").remote;
            if (remote) { remote.getCurrentWindow().minimize(); return; }
        } catch(e) {}
    }
    var hta = getHtaApp();
    if (hta) { hta.windowState = "minimize"; }
}

function ToggleMaximize() {
    try {
        if (typeof require !== 'undefined') {
            var electron = require('electron');
            if (electron && electron.ipcRenderer) {
                electron.ipcRenderer.send('maximize-app');
                return;
            }
        }
    } catch(e) {}
    if (_isElectronEnv()) {
        try {
            var remote = require("@electron/remote") || require("electron").remote;
            if (remote) {
                var win = remote.getCurrentWindow();
                if (win.isMaximized()) win.unmaximize(); else win.maximize();
                return;
            }
        } catch(e) {}
    }
    var hta = getHtaApp();
    if (hta) {
        if (hta.windowState === "maximize") {
            hta.windowState = "normal";
        } else {
            hta.windowState = "maximize";
        }
    }
}

function CloseWindow() {
    var page = _currentPage();
    
    // SPECIAL ROUTE FOR LOGIN & INDEX: Chiedi o esegui la chiusura dell'intera applicazione
    if (page === "login.html") {
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
            var shell = new ActiveXObject("WScript.Shell");
            shell.Run("taskkill /f /im mshta.exe", 0, false);
        } catch(e) {}
        window.onbeforeunload = null;
        if (typeof ALLOW_CLOSE !== "undefined") ALLOW_CLOSE = true;
        window.close();
        return;
    }

    // SPECIAL ROUTE FOR DASHBOARD: Chiudi e torna a Controllo Amministrativo (index.html)
    if (page === "dashboard.html") {
        if (window.parent && typeof window.parent.ApriModulo === "function" && window.parent !== window) {
            window.parent.ApriModulo("dashboard.html");
            return;
        }
        if (window.opener) {
            try {
                if (typeof require !== 'undefined') {
                    var electron = require('electron');
                    if (electron && electron.ipcRenderer) {
                        electron.ipcRenderer.send('show-parent');
                        return;
                    }
                }
            } catch(e) {}
            window.close();
            return;
        }
        window.onbeforeunload = null;
        if (typeof ALLOW_CLOSE !== "undefined") ALLOW_CLOSE = true;
        var targetDashboard = (window.location.pathname.toLowerCase().indexOf("file_sistema") > -1) ? "dashboard.html" : "File_Sistema/dashboard.html"; window.location.href = targetDashboard;
        return;
    }

    // SPECIAL ROUTE FOR INDEX (Cruscotto Amministrativo): Chiedi conferma prima di uscire con stile Premium
    if (page === "index.html" || page === "portale_supervisore_gold.html" || page === "portale_supervisore_gold.hta" || page === "") {
        if (typeof window.ShowGoldConfirm === "function") {
            window.ShowGoldConfirm(
                "CONFERMA USCITA",
                "Sei sicuro di voler uscire dal Cruscotto di Controllo Amministrativo?",
                "Sì, Esci",
                "Annulla",
                function() {
                    try {
                        if (typeof require !== 'undefined') {
                            var electron = require('electron');
                            if (electron && electron.ipcRenderer) {
                                electron.ipcRenderer.send('close-app');
                                return;
                            }
                        }
                    } catch(e) {}
                    window.close();
                },
                null,
                "🚪"
            );
        } else {
            if (confirm("Sei sicuro di voler uscire dal Cruscotto di Controllo Amministrativo?")) {
                try {
                    if (typeof require !== 'undefined') {
                        var electron = require('electron');
                        if (electron && electron.ipcRenderer) {
                            electron.ipcRenderer.send('close-app');
                            return;
                        }
                    }
                } catch(e) {}
                window.close();
            }
        }
        return;
    }
    
    var isMainDashboard = (page === "dashboard.html" || page === "index.html" || page === "" || page === "login.html" || page === "portale_supervisore_gold.hta" || page === "portale_supervisore_gold.html");
    
    // Se siamo su una maschera secondaria, torna alla scheda Pannello di Controllo (dashboard.html) senza chiudere l'app!
    if (!isMainDashboard) {
        try {
            if (typeof window.ApriModulo === "function") {
                window.ApriModulo("dashboard.html");
                return;
            }
            if (window.parent && typeof window.parent.ApriModulo === "function") {
                window.parent.ApriModulo("dashboard.html");
                return;
            }
            if (window.top && typeof window.top.ApriModulo === "function") {
                window.top.ApriModulo("dashboard.html");
                return;
            }
        } catch(eParent) {}

        // Se la finestra Ã¨ un pop-up separato in Electron (window.opener)
        if (_isElectronEnv() && window.opener) {
            try {
                if (typeof require !== 'undefined') {
                    var electron = require('electron');
                    if (electron && electron.ipcRenderer) {
                        electron.ipcRenderer.send('show-parent');
                        return;
                    }
                }
            } catch(e) {}
            window.close();
            return;
        }

        window.onbeforeunload = null;
        if (typeof ALLOW_CLOSE !== "undefined") ALLOW_CLOSE = true;
        window._isNavigatingInternal = true;
        
        // Se siamo all'interno della Suite Web (Porta 3000), torna sempre al Portale Principale
        if (window.location.port === "3000" || (window.location.origin && window.location.origin.indexOf(":3000") > -1) || window.location.pathname.indexOf("/veicoli") > -1) {
            window.location.href = "/launcher.html";
            return;
        }

        var targetDashboard = (window.location.pathname.toLowerCase().indexOf("file_sistema") > -1) ? "dashboard.html" : "File_Sistema/dashboard.html"; 
        window.location.href = targetDashboard;
        return;
    }

    // Se siamo giÃ  sulla Dashboard Principale: chiudi l'applicazione intera
    try {
        if (typeof require !== 'undefined') {
            var electron = require('electron');
            if (electron && electron.ipcRenderer) {
                electron.ipcRenderer.send('close-app');
                return;
            }
        }
    } catch(e) {}

    if (typeof window.ActionEsci === "function") {
        window.ActionEsci();
    } else if (typeof window.AtomicClose === "function") {
        window.AtomicClose();
    } else {
        window.close();
    }
}

function ChiudiPortale() {
    CloseWindow();
}

function ChiudiDaApple() {
    CloseWindow();
}

// --- UNIVERSAL AUTO-INJECTING SPOTLIGHT SEARCH (F2 / Ctrl+K) ACROSS ALL MODULES ---
function EnsureSpotlightSearchInjected() {
    if (document.getElementById("modalSpotlightSearch")) return;

    var isInFileSistema = (window.location.pathname.toLowerCase().indexOf("file_sistema") > -1);
    var pfx = isInFileSistema ? "" : "File_Sistema/";

    window.ApriSpotlightSearch = function() {
        try {
            var isLogged = false;
            if (typeof sessionStorage !== "undefined") {
                isLogged = sessionStorage.getItem("isLogged") === "true";
            }
            if (window.top && window.top.sessionStorage) {
                isLogged = isLogged || (window.top.sessionStorage.getItem("isLogged") === "true");
            }
            if (!isLogged) return;
        } catch(e) {}

        var el = document.getElementById("modalSpotlightSearch");
        if (el) {
            el.style.display = "flex";
            var input = document.getElementById("txtSpotlightQuery");
            if (input) { input.value = ""; input.focus(); }
            window.EseguiSpotlightSearch("");
        }
    };

    window.ChiudiSpotlightSearch = function() {
        var el = document.getElementById("modalSpotlightSearch");
        if (el) el.style.display = "none";
    };

    window.EseguiSpotlightSearch = function(q) {
        var resBox = document.getElementById("spotlightSearchResults");
        if (!resBox) return;
        q = (q || "").toLowerCase().trim();
        
        var html = "";
        var items = [
            { cat: "ðŸšš CONSEGNE & DDT", title: "DDT #2026-0891 - Clienti Bari Centro", sub: "Stato: In consegna â€¢ Autista: Vito Milella", link: pfx + "consegne.html" },
            { cat: "ðŸšš CONSEGNE & DDT", title: "DDT #2026-0892 - Supermercati Dok Modugno", sub: "Stato: In attesa â€¢ Autista: Nicola Milella", link: pfx + "consegne.html" },
            { cat: "ðŸ‘¤ ANAGRAFICA CLIENTI", title: "Eurospin Italia S.r.l.", sub: "Cod. C00192 â€¢ Via Zona Industriale Bari", link: pfx + "anagrafica.html" },
            { cat: "ðŸ‘¤ ANAGRAFICA CLIENTI", title: "Megamark S.r.l. - Trani", sub: "Cod. C00412 â€¢ Strada Statale 16", link: pfx + "anagrafica.html" },
            { cat: "ðŸš› FLOTTA & VEICOLI", title: "Iveco Daily 35C18 - Targa GA892XX", sub: "Revisione: 15/10/2026 â€¢ Assicurazione: ATTIVA", link: pfx + "auto.html" },
            { cat: "ðŸš› FLOTTA & VEICOLI", title: "Mercedes Sprinter 519 - Targa EX441YY", sub: "Revisione: 28/09/2026 â€¢ Tagliando imminente", link: pfx + "auto.html" },
            { cat: "ðŸ‘· PERSONALE & AUTISTI", title: "Vito Milella - Autista CQC", sub: "Patente CE â€¢ Scadenza: 14/05/2028 â€¢ Stato: Attivo", link: pfx + "presenze.html" }
        ];

        var filtered = items.filter(function(it) {
            return !q || it.title.toLowerCase().indexOf(q) !== -1 || it.sub.toLowerCase().indexOf(q) !== -1 || it.cat.toLowerCase().indexOf(q) !== -1;
        });

        if (filtered.length === 0) {
            html = "<div style='padding:30px; text-align:center; color:#94a3b8;'>Nessun risultato trovato per <b>\"" + q + "\"</b></div>";
        } else {
            filtered.forEach(function(it) {
                html += "<div onclick=\"window.ChiudiSpotlightSearch(); if(typeof window.ApriModulo==='function') window.ApriModulo('" + it.link + "'); else if(window.parent && typeof window.parent.ApriModulo==='function') window.parent.ApriModulo('" + it.link + "'); else window.location.href='" + it.link + "';\" style='padding:12px 16px; margin-bottom:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(212,175,55,0.15); border-radius:12px; cursor:pointer; transition:all 0.2s;' onmouseover=\"this.style.background='rgba(212,175,55,0.12)'; this.style.borderColor='#d4af37';\" onmouseout=\"this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(212,175,55,0.15)';\">" +
                    "<div style='font-size:10px; font-weight:bold; color:#d4af37; letter-spacing:0.5px; margin-bottom:2px;'>" + it.cat + "</div>" +
                    "<div style='font-size:14px; font-weight:bold; color:#f8fafc;'>" + it.title + "</div>" +
                    "<div style='font-size:12px; color:#94a3b8; margin-top:2px;'>" + it.sub + "</div>" +
                    "</div>";
            });
        }
        resBox.innerHTML = html;
    };

    var modalDiv = document.createElement("div");
    modalDiv.id = "modalSpotlightSearch";
    modalDiv.style.cssText = "display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(10, 15, 30, 0.85); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); z-index:9999999; justify-content:center; align-items:flex-start; padding-top:80px;";
    modalDiv.innerHTML = '' +
        '<div style="background:linear-gradient(145deg, #1e293b, #0f172a); border:1.5px solid #d4af37; border-radius:20px; width:640px; max-width:92vw; box-shadow:0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(212,175,55,0.25); overflow:hidden; font-family:\'Segoe UI\', sans-serif;">' +
            '<div style="padding:16px 20px; border-bottom:1px solid rgba(212,175,55,0.2); display:flex; align-items:center; background:rgba(15, 23, 42, 0.6);">' +
                '<span style="font-size:20px; margin-right:12px;">ðŸ”</span>' +
                '<input id="txtSpotlightQuery" type="text" oninput="window.EseguiSpotlightSearch(this.value)" placeholder="Cerca istantaneamente clienti, DDT, autisti, targhe (Ctrl + K)..." style="width:100%; background:transparent; border:none; color:#f8fafc; font-size:16px; outline:none; font-family:inherit;">' +
                '<button onclick="window.ChiudiSpotlightSearch()" style="background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#ef4444; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer; margin-left:10px;">âœ•</button>' +
            '</div>' +
            '<div id="spotlightSearchResults" style="max-height:420px; overflow-y:auto; padding:16px;"></div>' +
            '<div style="padding:10px 20px; background:rgba(15, 23, 42, 0.8); border-top:1px solid rgba(255,255,255,0.05); font-size:11px; color:#94a3b8; display:flex; justify-content:space-between;">' +
                '<span>ðŸ’¡ Digita per filtrare in tempo reale</span>' +
                '<span>Premi <kbd style="background:#334155; padding:2px 6px; border-radius:4px; color:#fff;">ESC</kbd> per chiudere</span>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modalDiv);
}

if (document.addEventListener) {
    document.addEventListener("keydown", function(e) {
        handleAppleWindowKeydown(e);
    });
} else if (document.attachEvent) {
    document.attachEvent("onkeydown", function(e) {
        handleAppleWindowKeydown(e || window.event);
    });
}

function handleAppleWindowKeydown(e) {
    if (!e) e = window.event;
    if ((e.ctrlKey && (e.key === "k" || e.key === "K")) || e.keyCode === 113) { // Ctrl+K oppure F2
        try {
            var isLogged = false;
            if (window.top && typeof window.top.IsUserAuthenticated === "function") {
                isLogged = window.top.IsUserAuthenticated();
            } else {
                if (typeof sessionStorage !== "undefined") {
                    isLogged = sessionStorage.getItem("isLogged") === "true";
                }
                if (window.top && window.top.sessionStorage) {
                    isLogged = isLogged || (window.top.sessionStorage.getItem("isLogged") === "true");
                }
                var logOverlay = document.getElementById("modalLoginOverlay") || (window.top && window.top.document ? window.top.document.getElementById("modalLoginOverlay") : null);
                if (logOverlay && logOverlay.style.display === "none") {
                    isLogged = true;
                } else if (!logOverlay) {
                    isLogged = true;
                }
            }
            if (!isLogged) return; // Blocco di sicurezza prima del login
        } catch(errAuth) {}

        EnsureSpotlightSearchInjected();
        var spotModal = document.getElementById("modalSpotlightSearch");
        if (spotModal && spotModal.style.display === "flex") {
            window.ChiudiSpotlightSearch();
        } else {
            window.ApriSpotlightSearch();
        }
        e.preventDefault();
    } else if (e.ctrlKey && (e.key === "m" || e.key === "M")) { // Ctrl+M per Assistente Vocale Command & Control
        try {
            if (window.top && typeof window.top.AvviaRiconoscimentoVocale === "function") {
                window.top.AvviaRiconoscimentoVocale();
                e.preventDefault();
                return;
            }
            if (typeof window.AvviaRiconoscimentoVocale === "function") {
                window.AvviaRiconoscimentoVocale();
                e.preventDefault();
                return;
            }
        } catch(errVoice) {}
    } else if (e.keyCode === 112 || e.keyCode === 36) { // F1 oppure HOME
        try {
            if (window.parent && typeof window.parent.ApriModulo === "function") {
                window.parent.ApriModulo("dashboard.html");
                e.preventDefault();
                return;
            }
            if (window.top && typeof window.top.ApriModulo === "function") {
                window.top.ApriModulo("dashboard.html");
                e.preventDefault();
                return;
            }
        } catch(errF1) {}
    } else if (e.keyCode === 27) { // ESC
        var spotModal = document.getElementById("modalSpotlightSearch");
        if (spotModal && spotModal.style.display === "flex") {
            window.ChiudiSpotlightSearch();
            if (e.preventDefault) e.preventDefault();
            else e.returnValue = false;
        }
    }
}

// --- UNIVERSAL FLOATING BUTTON (TORNA AL PORTALE F1) ---
function InjectHomePortalPillButton() {
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf("login.html") > -1) return; // Escludi la schermata di login
    var isInFileSistema = (path.indexOf("file_sistema") > -1);
    if (!isInFileSistema) return;
    if (document.getElementById("btnHomePortalFloating")) return;

    var btn = document.createElement("button");
    btn.id = "btnHomePortalFloating";
    btn.title = "Torna istantaneamente al Portale Principale (Premi F1)";
    btn.style.cssText = "position:fixed; top:6px; right:340px; z-index:999999; background:linear-gradient(135deg, rgba(212,175,55,0.25), rgba(15,23,42,0.95)); border:1.5px solid #d4af37; color:#ffe066; border-radius:20px; padding:4px 12px; font-size:10.5px; font-weight:800; font-family:'Segoe UI', sans-serif; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.6); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); transition:all 0.2s; display:flex; align-items:center; gap:5px;";
    btn.innerHTML = "<span>&#127968;</span> <span>PORTALE PRINCIPALE (F1)</span>";
    btn.onmouseover = function() { this.style.transform = "scale(1.05)"; this.style.borderColor = "#ffe066"; };
    btn.onmouseout = function() { this.style.transform = "scale(1)"; this.style.borderColor = "#d4af37"; };
    btn.onclick = function() {
        try {
            sessionStorage.setItem("isLogged", "true");
            localStorage.setItem("isLogged", "true");
        } catch(e) {}

        try {
            if (window.parent && typeof window.parent.ApriModulo === "function") {
                if (window.parent.document.getElementById("modalLoginOverlay")) {
                    window.parent.document.getElementById("modalLoginOverlay").style.display = "none";
                }
                window.parent.ApriModulo("dashboard.html");
                return;
            }
        } catch(e) {}

        try {
            if (window.top && typeof window.top.ApriModulo === "function") {
                if (window.top.document.getElementById("modalLoginOverlay")) {
                    window.top.document.getElementById("modalLoginOverlay").style.display = "none";
                }
                window.top.ApriModulo("dashboard.html");
                return;
            }
        } catch(e) {}

        var targetUrl = "../index.html?autologin=1";
        if (window.location.pathname.toLowerCase().indexOf("file_sistema") === -1) {
            targetUrl = "index.html?autologin=1";
        }
        window.location.href = targetUrl;
    };
    document.body.appendChild(btn);
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(InjectHomePortalPillButton, 300);
} else if (document.addEventListener) {
    document.addEventListener("DOMContentLoaded", InjectHomePortalPillButton);
} else if (window.attachEvent) {
    window.attachEvent("onload", InjectHomePortalPillButton);
} else {
    setTimeout(InjectHomePortalPillButton, 500);
}

