/**
 * GESTIONALE INTEGRATO C. MILELLA - PREMIUM UX/UI MODULE
 * Fornisce:
 * 1. Toast Notifications
 * 2. Custom Context Menu
 * 3. Splash Screen Overlay
 * 4. Micro-Interazioni Sonore
 */

function addEvent(el, event, fn) {
    if (!el) return;
    if (el.addEventListener) {
        el.addEventListener(event, fn, false);
    } else if (el.attachEvent) {
        el.attachEvent("on" + event, fn);
    } else {
        el["on" + event] = fn;
    }
}

function removeEvent(el, event, fn) {
    if (!el) return;
    if (el.removeEventListener) {
        el.removeEventListener(event, fn, false);
    } else if (el.detachEvent) {
        el.detachEvent("on" + event, fn);
    } else {
        el["on" + event] = null;
    }
}

var UXPremium = (function() {
    
    var isZenMode = false;
    var audioCtx = null;
    
    // Suoni generati tramite bgsound di sistema per compatibilità MSHTA (IE11 non supporta AudioContext)
    function playSysSound(wavName) {
        try {
            var bgs = document.getElementById("ux-sys-sound");
            if (!bgs) {
                bgs = document.createElement("bgsound");
                bgs.id = "ux-sys-sound";
                document.body.appendChild(bgs);
            }
            bgs.src = "C:\\Windows\\Media\\" + wavName;
        } catch(e) {}
    }

    return {
        // --- 1. SOUND DESIGN ---
        PlaySound: {
            Click: function() { playSysSound("Windows Navigation Start.wav"); },
            Success: function() { playSysSound("chimes.wav"); },
            Error: function() { playSysSound("Windows Error.wav"); },
            Notification: function() { playSysSound("Windows Notify Messaging.wav"); },
            Warning: function() { playSysSound("Windows Exclamation.wav"); },
            Pop: function() { playSysSound("Windows Balloon.wav"); }
        },

        // --- 1.b. SAPI (SINTESI VOCALE) ---
        Speak: function(testo) {
            try {
                var voice = new ActiveXObject("SAPI.SpVoice");
                // flag 1 = SVSFlagsAsync (asincrono, non blocca l'interfaccia)
                voice.Speak(testo, 1);
            } catch(e) {
                // SAPI non disponibile o errore, fallback silenzioso
            }
        },

        // --- 2. TOAST NOTIFICATIONS ---
        ShowToast: function(message, type) {
            // type = 'success', 'error', 'info', 'warning'
            type = type || 'info';
            this.PlaySound.Notification();
            
            var toastContainer = document.getElementById("ux-toast-container");
            if (!toastContainer) {
                toastContainer = document.createElement("div");
                toastContainer.id = "ux-toast-container";
                toastContainer.style.position = "fixed";
                toastContainer.style.bottom = "30px";
                toastContainer.style.right = "30px";
                toastContainer.style.zIndex = "100000";
                toastContainer.style.display = "flex";
                toastContainer.style.flexDirection = "column";
                toastContainer.style.gap = "10px";
                document.body.appendChild(toastContainer);
            }
            
            var toast = document.createElement("div");
            var bgColor = "rgba(30, 33, 48, 0.95)";
            var borderColor = "rgba(255,255,255,0.1)";
            var icon = "ℹ️";
            var textColor = "#cbd5e1";
            
            if (type === 'success') { borderColor = "rgba(16, 185, 129, 0.5)"; icon = "✅"; textColor = "#10b981"; }
            else if (type === 'error') { borderColor = "rgba(239, 68, 68, 0.5)"; icon = "❌"; textColor = "#ef4444"; }
            else if (type === 'warning') { borderColor = "rgba(245, 158, 11, 0.5)"; icon = "⚠️"; textColor = "#f59e0b"; }
            else if (type === 'gold') { borderColor = "rgba(212, 175, 55, 0.6)"; icon = "⭐"; textColor = "#d4af37"; }

            toast.style.background = bgColor;
            toast.style.backdropFilter = "blur(10px)";
            toast.style.border = "1px solid " + borderColor;
            toast.style.color = "#fff";
            toast.style.padding = "12px 20px";
            toast.style.borderRadius = "12px";
            toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
            toast.style.display = "flex";
            toast.style.alignItems = "center";
            toast.style.gap = "12px";
            toast.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
            toast.style.fontSize = "14px";
            toast.style.fontWeight = "600";
            toast.style.transform = "translateX(120%)";
            toast.style.opacity = "0";
            toast.style.transition = "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
            toast.style.cursor = "pointer";
            
            toast.innerHTML = "<span style='font-size:18px;'>" + icon + "</span> <span style='color:" + textColor + "'>" + message + "</span>";
            
            // Chiudi al clic
            toast.onclick = function() {
                toast.style.transform = "translateX(120%)";
                toast.style.opacity = "0";
                setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
            };

            toastContainer.appendChild(toast);
            
            // Trigger animazione entrata
            setTimeout(function() {
                toast.style.transform = "translateX(0)";
                toast.style.opacity = "1";
            }, 10);
            
            // Auto rimozione dopo 4 secondi
            setTimeout(function() {
                if(toast.parentNode) {
                    toast.style.transform = "translateX(120%)";
                    toast.style.opacity = "0";
                    setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
                }
            }, 4000);
        },

        // --- 3. CUSTOM CONTEXT MENU ---
        InitContextMenu: function() {
            document.oncontextmenu = function(e) {
                e = e || window.event;
                var target = e.target || e.srcElement;
                if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                    return true; // Permetti menu standard su campi di testo
                }
                
                e.preventDefault();
                var menuId = "ux-context-menu";
                var menu = document.getElementById(menuId);
                
                if (!menu) {
                    menu = document.createElement("div");
                    menu.id = menuId;
                    menu.style.position = "absolute";
                    menu.style.zIndex = "1000000";
                    menu.style.background = "linear-gradient(145deg, rgba(20,22,30,0.95) 0%, rgba(10,11,15,0.98) 100%)";
                    menu.style.border = "1px solid rgba(212, 175, 55, 0.4)";
                    menu.style.borderRadius = "10px";
                    menu.style.boxShadow = "0 15px 35px rgba(0,0,0,0.8)";
                    menu.style.padding = "6px";
                    menu.style.minWidth = "200px";
                    menu.style.backdropFilter = "blur(12px)";
                    menu.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
                    
                    var createItem = function(icon, text, action) {
                        var item = document.createElement("div");
                        item.style.padding = "10px 15px";
                        item.style.color = "#cbd5e1";
                        item.style.fontSize = "13px";
                        item.style.fontWeight = "600";
                        item.style.cursor = "pointer";
                        item.style.borderRadius = "6px";
                        item.style.display = "flex";
                        item.style.alignItems = "center";
                        item.style.gap = "10px";
                        item.style.transition = "all 0.2s";
                        
                        item.innerHTML = "<span style='font-size:16px; width:20px; text-align:center; color:#d4af37'>" + icon + "</span> " + text;
                        
                        item.onmouseover = function() { 
                            this.style.background = "rgba(212, 175, 55, 0.15)"; 
                            this.style.color = "#fff";
                            UXPremium.PlaySound.Click();
                        };
                        item.onmouseout = function() { 
                            this.style.background = "transparent"; 
                            this.style.color = "#cbd5e1";
                        };
                        item.onclick = function(ev) {
                            ev.stopPropagation();
                            document.body.removeChild(menu);
                            setTimeout(action, 50); // Esegue l'azione nel contesto globale sicuro
                        };
                        return item;
                    };
                    
                    menu.appendChild(createItem("🔄", "Aggiorna Pagina", function() { 
                        if (typeof HardRefresh === 'function') {
                            HardRefresh();
                        } else if (typeof ricaricaLista === 'function') {
                            ricaricaLista();
                        } else {
                            try {
                                var shell = new ActiveXObject("WScript.Shell");
                                var loc = window.location.pathname;
                                if (loc.charAt(0) === "/") loc = loc.substring(1);
                                loc = decodeURIComponent(loc).replace(/\//g, "\\");
                                shell.Run('mshta.exe "' + loc + '"', 1, false);
                                if (typeof AtomicClose === 'function') AtomicClose();
                                else window.close();
                            } catch(e) {
                                window.location.reload(true);
                            }
                        }
                    }));
                    menu.appendChild(createItem("🏠", "Torna alla Dashboard", function() { 
                        if(typeof CaricaAgendaHome === 'function') CaricaAgendaHome(); 
                        else if(typeof Script_BackToDashboard === 'function') Script_BackToDashboard();
                        else if(typeof NavigaModulo === 'function') NavigaModulo('dashboard.html');
                        else if(typeof window.ApriModuloHTA === 'function') window.ApriModuloHTA('dashboard.html');
                        else {
                            try {
                                var fso = new ActiveXObject("Scripting.FileSystemObject");
                                var shell = new ActiveXObject("WScript.Shell");
                                var loc = window.location.pathname;
                                if (loc.charAt(0) === "/") loc = loc.substring(1);
                                var base = fso.GetParentFolderName(decodeURIComponent(loc).replace(/\//g, "\\"));
                                var parentBase = fso.GetParentFolderName(base);
                                
                                var candidates = [
                                    fso.BuildPath(base, "dashboard.hta"),
                                    fso.BuildPath(parentBase, "0_AVVIA_SISTEMA_LOGISTICA.vbs"),
                                    fso.BuildPath(parentBase, "1_GESTIONALE_DESKTOP.vbs"),
                                    fso.BuildPath(parentBase, "PORTALE_SUPERVISORE_GOLD.hta")
                                ];
                                
                                var launched = false;
                                for(var i=0; i<candidates.length; i++) {
                                    if(fso.FileExists(candidates[i])) {
                                        if (candidates[i].toLowerCase().indexOf(".vbs") !== -1) {
                                            shell.Run('wscript.exe "' + candidates[i] + '"', 1, false);
                                        } else {
                                            shell.Run('mshta.exe "' + candidates[i] + '"', 1, false);
                                        }
                                        launched = true;
                                        break;
                                    }
                                }
                                
                                if (typeof AtomicClose === 'function') AtomicClose();
                                else window.close();
                            } catch(e) {
                                window.close();
                            }
                        }
                    }));
                    menu.appendChild(createItem("🖨️", "Stampa Schermata", function() { window.print(); }));
                    
                    var sep = document.createElement("div");
                    sep.style.height = "1px"; sep.style.background = "rgba(255,255,255,0.1)"; sep.style.margin = "5px 0";
                    menu.appendChild(sep);
                    
                    menu.appendChild(createItem("🧘", "Modalità Zen", function() { UXPremium.ToggleZenMode(); }));
                    
                    document.body.appendChild(menu);
                }
                
                // Posizionamento
                var x = e.clientX;
                var y = e.clientY;
                menu.style.display = "block";
                menu.style.left = x + "px";
                menu.style.top = y + "px";
                
                // Aggiusta se esce dallo schermo
                var rect = menu.getBoundingClientRect();
                if (x + rect.width > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 5) + "px";
                if (y + rect.height > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 5) + "px";
                
                return false;
            };
            
            // Chiudi cliccando altrove
            addEvent(document, "click", function(e) {
                var menu = document.getElementById("ux-context-menu");
                if (menu) menu.style.display = "none";
            });
        },

        // --- 4. ZEN MODE ---
        ToggleZenMode: function() {
            isZenMode = !isZenMode;
            // Dashboard elements
            var sidebar = document.querySelector(".dashboard-sidebar");
            var titlebar = document.getElementById("custom-titlebar");
            var header = document.querySelector(".header");
            var kpi = document.querySelector(".kpi-section");
            
            // Consegne elements
            var topBlackBar = document.querySelector(".danea-top-black-bar");
            var menuBar = document.querySelector(".classic-menu-bar");
            var ribbon = document.querySelector(".danea-ribbon");
            var appNav = document.querySelector(".danea-app-nav");
            var archiveFilters = document.querySelector(".archive-filters");
            var archiveHeader = document.querySelector(".archive-header");
            
            // Anagrafica elements
            var sideList = document.querySelector(".zenith-side-list");
            
            this.PlaySound.Success();

            if (isZenMode) {
                if(sidebar) sidebar.style.display = "none";
                if(titlebar) titlebar.style.display = "none";
                if(header) header.style.display = "none";
                if(kpi) kpi.style.display = "none";
                
                if(topBlackBar) topBlackBar.style.display = "none";
                if(menuBar) menuBar.style.display = "none";
                if(ribbon) ribbon.style.display = "none";
                if(appNav) appNav.style.display = "none";
                if(archiveFilters) archiveFilters.style.display = "none";
                if(archiveHeader) archiveHeader.style.display = "none";
                if(sideList) sideList.style.display = "none";
                
                this.ShowToast("Modalità Zen Attivata. Premi ESC per uscire.", "gold");
                
                // Aggiungi listener per ESC
                var escHandler = function(e) {
                    if (e.keyCode === 27 && isZenMode) {
                        UXPremium.ToggleZenMode();
                        removeEvent(document, "keydown", escHandler);
                    }
                };
                addEvent(document, "keydown", escHandler);
                
            } else {
                if(sidebar) sidebar.style.display = "";
                if(titlebar) titlebar.style.display = "";
                if(header) header.style.display = "";
                if(kpi) kpi.style.display = "grid";
                
                if(topBlackBar) topBlackBar.style.display = "flex";
                if(menuBar) menuBar.style.display = "";
                if(ribbon) ribbon.style.display = "";
                if(appNav) appNav.style.display = "";
                if(archiveFilters) archiveFilters.style.display = "flex";
                if(archiveHeader) archiveHeader.style.display = "flex";
                if(sideList) sideList.style.display = "";
                
                this.ShowToast("Modalità Zen Disattivata.", "info");
            }
        },

        // --- 5. SPLASH SCREEN ---
        ShowSplash: function(message) {
            var splashId = "ux-splash-screen";
            var splash = document.getElementById(splashId);
            if (!splash) {
                splash = document.createElement("div");
                splash.id = splashId;
                splash.style.position = "fixed";
                splash.style.top = "0"; splash.style.left = "0";
                splash.style.width = "100vw"; splash.style.height = "100vh";
                splash.style.background = "rgba(10, 11, 16, 0.85)";
                splash.style.backdropFilter = "blur(15px)";
                splash.style.zIndex = "10000000";
                splash.style.display = "flex";
                splash.style.flexDirection = "column";
                splash.style.alignItems = "center";
                splash.style.justifyContent = "center";
                splash.style.color = "#fff";
                splash.style.fontFamily = "'Segoe UI', sans-serif";
                splash.style.opacity = "0";
                splash.style.transition = "opacity 0.3s";
                
                var spinner = document.createElement("div");
                spinner.innerHTML = "⏳";
                spinner.style.fontSize = "60px";
                spinner.style.animation = "spin 2s linear infinite";
                spinner.style.marginBottom = "20px";
                
                // Inject keyframes se non esiste
                if (!document.getElementById("ux-animations")) {
                    var style = document.createElement("style");
                    style.id = "ux-animations";
                    style.innerHTML = "@keyframes spin { 100% { transform: rotate(360deg); } }";
                    document.head.appendChild(style);
                }
                
                var text = document.createElement("h2");
                text.id = "ux-splash-text";
                text.style.color = "#d4af37";
                text.style.fontWeight = "800";
                text.style.letterSpacing = "2px";
                
                splash.appendChild(spinner);
                splash.appendChild(text);
                if (document.body) {
                    document.body.appendChild(splash);
                } else {
                    document.documentElement.appendChild(splash);
                }
            }
            
            document.getElementById("ux-splash-text").innerText = (message || "ATTENDERE PREGO...").toUpperCase();
            splash.style.display = "flex";
            setTimeout(function(){ splash.style.opacity = "1"; }, 10);
        },
        
        HideSplash: function() {
            var splash = document.getElementById("ux-splash-screen");
            if (splash) {
                splash.style.opacity = "0";
                setTimeout(function(){ splash.style.display = "none"; }, 300);
            }
        },

        // --- 6. SIMPLE CANVAS CHART (Per sostituire vecchi grafici) ---
        DrawSimpleLineChart: function(canvasId, dataPoints, colorStart, colorEnd) {
            var canvas = document.getElementById(canvasId);
            if (!canvas) return;
            var ctx = canvas.getContext("2d");
            if (!ctx) return;
            
            var width = canvas.width;
            var height = canvas.height;
            var padding = 10;
            
            ctx.clearRect(0, 0, width, height);
            if (!dataPoints || dataPoints.length === 0) return;
            
            var maxVal = Math.max.apply(null, dataPoints) || 1;
            var minVal = 0; // Inizia da 0
            
            var stepX = (width - padding * 2) / (dataPoints.length - 1);
            if(dataPoints.length === 1) stepX = width;
            
            // Draw Gradient Line
            ctx.beginPath();
            for (var i = 0; i < dataPoints.length; i++) {
                var x = padding + i * stepX;
                var y = height - padding - ((dataPoints[i] - minVal) / (maxVal - minVal)) * (height - padding * 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            var grad = ctx.createLinearGradient(0, 0, width, 0);
            grad.addColorStop(0, colorStart || "#ffe066");
            grad.addColorStop(1, colorEnd || "#d4af37");
            
            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            
            // Draw Area Under Line
            ctx.lineTo(width - padding, height - padding);
            ctx.lineTo(padding, height - padding);
            ctx.closePath();
            
            var areaGrad = ctx.createLinearGradient(0, 0, 0, height);
            areaGrad.addColorStop(0, (colorStart || "#ffe066").replace("rgb", "rgba").replace(")", ", 0.4)"));
            areaGrad.addColorStop(1, "rgba(0,0,0,0)");
            
            ctx.fillStyle = areaGrad;
            ctx.fill();
            
            // Draw Points
            ctx.fillStyle = "#fff";
            for (var i = 0; i < dataPoints.length; i++) {
                var x = padding + i * stepX;
                var y = height - padding - ((dataPoints[i] - minVal) / (maxVal - minVal)) * (height - padding * 2);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke(); // uses the gradient stroke
            }
        },

        // --- 7. SPOTLIGHT SEARCH (Ctrl + Spazio) ---
        InitSpotlight: function() {
            var spotlightId = "ux-spotlight";
            var spotlight = document.getElementById(spotlightId);
            if (!spotlight) {
                spotlight = document.createElement("div");
                spotlight.id = spotlightId;
                spotlight.style.position = "fixed";
                spotlight.style.top = "0"; spotlight.style.left = "0";
                spotlight.style.width = "100vw"; spotlight.style.height = "100vh";
                spotlight.style.background = "rgba(0, 0, 0, 0.6)";
                spotlight.style.backdropFilter = "blur(8px)";
                spotlight.style.zIndex = "10000001";
                spotlight.style.display = "none";
                spotlight.style.flexDirection = "column";
                spotlight.style.alignItems = "center";
                spotlight.style.paddingTop = "15vh";
                spotlight.style.fontFamily = "'Segoe UI', sans-serif";
                spotlight.style.opacity = "0";
                spotlight.style.transition = "opacity 0.2s";
                
                var searchBox = document.createElement("div");
                searchBox.style.width = "600px";
                searchBox.style.maxWidth = "90vw";
                searchBox.style.background = "#12141c"; // Sfondo solido per coprire il testo sottostante
                searchBox.style.borderRadius = "16px";
                searchBox.style.boxShadow = "0 20px 50px rgba(0,0,0,0.8)";
                searchBox.style.border = "2px solid #ffc107"; // Bordo Gold Premium
                searchBox.style.overflow = "hidden";
                searchBox.style.display = "flex";
                searchBox.style.alignItems = "center";
                searchBox.style.padding = "10px 20px";
                
                var icon = document.createElement("span");
                icon.innerHTML = "<img src='https://img.icons8.com/color/48/search--v1.png' style='width:28px; height:28px;'>";
                icon.style.marginRight = "15px";
                icon.style.display = "flex";
                icon.style.alignItems = "center";
                
                var inputContainer = document.createElement("div");
                inputContainer.style.position = "relative";
                inputContainer.style.flex = "1";
                
                var placeholderTxt = document.createElement("div");
                placeholderTxt.innerHTML = "Cerca un cliente e premi Invio...";
                placeholderTxt.style.position = "absolute";
                placeholderTxt.style.left = "0";
                placeholderTxt.style.top = "50%";
                placeholderTxt.style.transform = "translateY(-50%)";
                placeholderTxt.style.color = "rgba(255,255,255,0.4)";
                placeholderTxt.style.fontSize = "20px";
                placeholderTxt.style.pointerEvents = "none";
                placeholderTxt.id = "ux-spotlight-placeholder";
                
                var input = document.createElement("input");
                input.id = "ux-spotlight-input";
                input.type = "text";
                input.style.width = "100%";
                input.style.background = "transparent";
                input.style.border = "none";
                input.style.color = "#fff";
                input.style.fontSize = "22px";
                input.style.outline = "none";
                input.style.padding = "10px 0";
                input.style.position = "relative";
                input.style.zIndex = "2";
                
                var checkPlaceholder = function() {
                    var ph = document.getElementById("ux-spotlight-placeholder");
                    if(ph) ph.style.display = input.value.length > 0 ? "none" : "block";
                };
                
                addEvent(input, "input", checkPlaceholder);
                addEvent(input, "keyup", checkPlaceholder);
                
                inputContainer.appendChild(placeholderTxt);
                inputContainer.appendChild(input);
                
                searchBox.appendChild(icon);
                searchBox.appendChild(inputContainer);
                spotlight.appendChild(searchBox);
                
                var tip = document.createElement("div");
                tip.innerHTML = "Premi <b>ESC</b> per chiudere";
                tip.style.color = "rgba(255,255,255,0.5)";
                tip.style.marginTop = "15px";
                tip.style.fontSize = "13px";
                spotlight.appendChild(tip);
                
                document.body.appendChild(spotlight);
                
                // Event Listener
                addEvent(input, "keydown", function(e) {
                    if (e.keyCode === 27) { // ESC
                        UXPremium.HideSpotlight();
                    } else if (e.keyCode === 13) { // ENTER
                        var val = input.value.trim();
                        if (val !== "") {
                            try {
                                var fso = new ActiveXObject("Scripting.FileSystemObject");
                                var locPath = window.location.pathname;
                                if (locPath.charAt(0) === "/") locPath = locPath.substring(1);
                                var baseDir = fso.GetParentFolderName(decodeURIComponent(locPath).replace(/\//g, "\\"));
                                var sysDir = fso.BuildPath(baseDir, "system");
                                if (!fso.FolderExists(sysDir)) fso.CreateFolder(sysDir);
                                var tmpFile = fso.BuildPath(sysDir, "search.tmp");
                                var stream = fso.CreateTextFile(tmpFile, true);
                                stream.WriteLine(val);
                                stream.Close();
                                
                                UXPremium.HideSpotlight();
                                UXPremium.PlaySound.Success();
                                // Naviga in anagrafica
                                if (window.location.pathname.toLowerCase().indexOf("anagrafica.hta") === -1) {
                                    UXPremium.ShowSplash("RICERCA GLOBALE...");
                                    setTimeout(function(){ 
                                        try {
                                            var anagraficaPath = fso.BuildPath(baseDir, "anagrafica.hta");
                                            if (!fso.FileExists(anagraficaPath)) {
                                                anagraficaPath = fso.BuildPath(fso.BuildPath(baseDir, "File_Sistema"), "anagrafica.hta");
                                            }
                                            var shell = new ActiveXObject("WScript.Shell");
                                            if (fso.FileExists(anagraficaPath)) {
                                                shell.Run('mshta.exe "' + anagraficaPath + '"', 1, false);
                                                if (typeof AtomicClose === 'function') AtomicClose();
                                                else window.close();
                                            } else {
                                                window.location.href = "anagrafica.hta";
                                            }
                                        } catch(e) {
                                            window.location.href = "anagrafica.hta"; 
                                        }
                                    }, 300);
                                } else {
                                    if(typeof ricaricaLista === 'function') {
                                        document.getElementById('txtRicerca').value = val;
                                        ricaricaLista(val);
                                    }
                                }
                            } catch(ex) {
                                UXPremium.ShowToast("Errore di ricerca globale.", "error");
                            }
                        }
                    }
                });
                
                addEvent(spotlight, "click", function(e) {
                    if (e.target === spotlight) UXPremium.HideSpotlight();
                });
            }
            
            // Global Shortcut Ctrl + Space
            addEvent(document, "keydown", function(e) {
                if (e.ctrlKey && e.keyCode === 32) {
                    e.preventDefault();
                    var spl = document.getElementById("ux-spotlight");
                    if (spl.style.display === "none" || spl.style.opacity === "0") {
                        spl.style.display = "flex";
                        setTimeout(function(){ 
                            spl.style.opacity = "1"; 
                            document.getElementById("ux-spotlight-input").value = "";
                            var ph = document.getElementById("ux-spotlight-placeholder");
                            if(ph) ph.style.display = "block";
                            document.getElementById("ux-spotlight-input").focus();
                            UXPremium.PlaySound.Click();
                        }, 10);
                    } else {
                        UXPremium.HideSpotlight();
                    }
                }
            });
        },
        
        HideSpotlight: function() {
            var spl = document.getElementById("ux-spotlight");
            if (spl) {
                spl.style.opacity = "0";
                setTimeout(function(){ spl.style.display = "none"; }, 200);
            }
        }
    };
})();

addEvent(window, "load", function() {
    UXPremium.InitContextMenu();
    UXPremium.InitSpotlight();
    
    // Inject CSS for Ripple Effect
    if (!document.getElementById("ux-ripple-css")) {
        var style = document.createElement("style");
        style.id = "ux-ripple-css";
        style.innerHTML = "" +
            ".ux-ripple-btn { position: relative; overflow: hidden; } " +
            ".ux-ripple-circle { " +
            "    position: absolute; " +
            "    border-radius: 50%; " +
            "    transform: scale(0); " +
            "    animation: ux-ripple-anim 0.6s linear; " +
            "    background-color: rgba(255, 255, 255, 0.3); " +
            "    pointer-events: none; " +
            "} " +
            "@keyframes ux-ripple-anim { " +
            "    to { transform: scale(4); opacity: 0; } " +
            "} ";
        document.head.appendChild(style);
    }
    
    // Associa il suono del click e l'effetto Ripple a tutti i bottoni
    var buttons = document.querySelectorAll("button, .nav-btn, .action-btn, .quick-action-animate, .launcher-card");
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        btn.classList.add("ux-ripple-btn");
        
        var mousedownHandler = function(e) { 
            UXPremium.PlaySound.Click(); 
            
            // Ripple Effect Logic
            var target = e.currentTarget;
            var circle = document.createElement("span");
            var diameter = Math.max(target.clientWidth, target.clientHeight);
            var radius = diameter / 2;
            
            // Check se e.clientX è disponibile (alcuni IE event non lo passano bene se wrappati, ma di solito sì)
            var rect = target.getBoundingClientRect();
            var x = (e.clientX || rect.left + radius) - rect.left - radius;
            var y = (e.clientY || rect.top + radius) - rect.top - radius;
            
            circle.style.width = circle.style.height = diameter + "px";
            circle.style.left = x + "px";
            circle.style.top = y + "px";
            circle.classList.add("ux-ripple-circle");
            
            target.appendChild(circle);
            
            setTimeout(function() {
                if (circle.parentNode) circle.parentNode.removeChild(circle);
            }, 600);
        };
        
        addEvent(btn, "mousedown", mousedownHandler);
    }
    
    // --- FUNZIONALITA' PREMIUM EXTRA ---
    UXPremium.ToggleFocusMode = function(elementId, enable) {
        var el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
        if(!el) return;
        
        if(enable) {
            var overlay = document.getElementById("ux-focus-overlay");
            if(!overlay) {
                overlay = document.createElement("div");
                overlay.id = "ux-focus-overlay";
                overlay.style.position = "fixed";
                overlay.style.top = "0";
                overlay.style.left = "0";
                overlay.style.width = "100vw";
                overlay.style.height = "100vh";
                overlay.style.background = "rgba(0,0,0,0.6)";
                overlay.style.backdropFilter = "blur(8px)";
                overlay.style.webkitBackdropFilter = "blur(8px)";
                overlay.style.zIndex = "9998";
                overlay.style.transition = "opacity 0.5s ease";
                overlay.style.opacity = "0";
                document.body.appendChild(overlay);
                setTimeout(function(){ overlay.style.opacity = "1"; }, 10);
            }
            if(!el.hasAttribute("data-old-zindex")) {
                el.setAttribute("data-old-zindex", el.style.zIndex || "");
                el.setAttribute("data-old-position", el.style.position || "");
                el.setAttribute("data-old-boxshadow", el.style.boxShadow || "");
            }
            if(window.getComputedStyle && window.getComputedStyle(el).position === "static") {
                el.style.position = "relative";
            }
            el.style.zIndex = "9999";
            el.style.boxShadow = "0 0 40px rgba(212, 175, 55, 0.4)";
        } else {
            var overlay = document.getElementById("ux-focus-overlay");
            if(overlay) {
                overlay.style.opacity = "0";
                setTimeout(function(){ 
                    if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); 
                }, 500);
            }
            if(el.hasAttribute("data-old-zindex")) {
                el.style.zIndex = el.getAttribute("data-old-zindex");
                el.style.position = el.getAttribute("data-old-position");
                el.style.boxShadow = el.getAttribute("data-old-boxshadow");
                el.removeAttribute("data-old-zindex");
                el.removeAttribute("data-old-position");
                el.removeAttribute("data-old-boxshadow");
            }
        }
    };
    
    UXPremium.PlayGoldParticles = function(x, y) {
        for(var i = 0; i < 20; i++) {
            (function() {
                var p = document.createElement("div");
                p.style.position = "fixed";
                p.style.width = (Math.random() * 6 + 4) + "px";
                p.style.height = p.style.width;
                p.style.background = Math.random() > 0.5 ? "#ffd700" : "#ffb142";
                p.style.borderRadius = "50%";
                p.style.left = x + "px";
                p.style.top = y + "px";
                p.style.pointerEvents = "none";
                p.style.zIndex = "100000";
                p.style.boxShadow = "0 0 10px " + p.style.background;
                
                var angle = Math.random() * Math.PI * 2;
                var velocity = 40 + Math.random() * 80;
                var tx = Math.cos(angle) * velocity;
                var ty = Math.sin(angle) * velocity - 50; 
                
                p.style.transition = "all 0.8s cubic-bezier(0.1, 0.8, 0.3, 1)";
                
                document.body.appendChild(p);
                
                setTimeout(function(){
                    p.style.transform = "translate(" + tx + "px, " + ty + "px) scale(0)";
                    p.style.opacity = "0";
                }, 10);
                setTimeout(function(){
                    if(p.parentNode) p.parentNode.removeChild(p);
                }, 800);
            })();
        }
    };
    
    // Auto-bind Cinematic Focus per i campi di testo Premium disabilitato (richiesta utente)
    /*
    setTimeout(function() {
        var inputs = document.getElementsByTagName("input");
        var textareas = document.getElementsByTagName("textarea");
        var allInputs = [];
        for(var i=0; i<inputs.length; i++) allInputs.push(inputs[i]);
        for(var j=0; j<textareas.length; j++) allInputs.push(textareas[j]);
        
        for(var k=0; k<allInputs.length; k++) {
            var el = allInputs[k];
            if(el.className && (el.className.indexOf("zenith-input") > -1 || el.className.indexOf("memo-textarea") > -1)) {
                var handlerIn = function(e) {
                    var t = e.target || e.srcElement;
                    var p = t.parentNode;
                    if(p && p.className && p.className.indexOf("zenith-field-group") > -1) {
                        UXPremium.ToggleFocusMode(p, true);
                    } else {
                        UXPremium.ToggleFocusMode(t, true);
                    }
                };
                var handlerOut = function(e) {
                    var t = e.target || e.srcElement;
                    var p = t.parentNode;
                    if(p && p.className && p.className.indexOf("zenith-field-group") > -1) {
                        UXPremium.ToggleFocusMode(p, false);
                    } else {
                        UXPremium.ToggleFocusMode(t, false);
                    }
                };
                
                addEvent(el, "focus", handlerIn);
                addEvent(el, "blur", handlerOut);
            }
        }
    }, 1500); // Ritardo per assicurarsi che i moduli siano caricati
    */

    // --- 🎁 REGALO EASTER EGG DINAMICO (BASATO SUL PROFILO UTENTE) ---
    var secretCode = "";
    var targetCode = "CIRO"; // Fallback
    
    // Leggi il nome utente dalla sessione
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        if (fso.FileExists("session.tmp")) {
            var f = fso.OpenTextFile("session.tmp", 1);
            var content = f.ReadAll();
            f.Close();
            if (content) {
                // Prendi il nome utente pulito, tutto in maiuscolo e senza spazi per facilitare la digitazione
                targetCode = content.replace(/^\s+|\s+$/g, '').toUpperCase().replace(/\s+/g, '');
            }
        }
    } catch(e) {}
    
    if (!targetCode || targetCode.length === 0) targetCode = "ADMIN";

    addEvent(document, "keydown", function(e) {
        if(e.key && e.key.length === 1) {
            secretCode += e.key.toUpperCase();
            if(secretCode.length > targetCode.length) secretCode = secretCode.substring(secretCode.length - targetCode.length);
            
            if(secretCode === targetCode) {
                secretCode = ""; // Reset
                UXPremium.PlaySound.Success();
                
                var displayNome = targetCode.charAt(0).toUpperCase() + targetCode.slice(1).toLowerCase();
                UXPremium.ShowToast("🌟 SEGRETO SBLOCCATO: Benvenuto Master " + displayNome + "! Il sistema è operativo ai massimi livelli.", "gold");
                
                // Pioggia di scintille dorate su tutto lo schermo
                var w = window.innerWidth;
                var h = window.innerHeight;
                for(var i = 0; i < 15; i++) {
                    setTimeout(function() {
                        UXPremium.PlayGoldParticles(Math.random() * w, Math.random() * h);
                    }, i * 150);
                }
                
                // Effetto vocale personalizzato
                try {
                    UXPremium.Speak("Benvenuto Master " + displayNome + ". Tutti i sistemi sono pronti e ai massimi livelli operativi.");
                } catch(ex) {}
            }
        }
    });
});
