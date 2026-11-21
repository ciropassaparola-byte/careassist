/* accessibility.js - Universal Accessibility and Speech Engine for Zenith Suite */

(function() {
    // 1. Initialise ActiveX objects safely
    var fso = null;
    var shell = null;
    var isHTA = false;
    try {
        fso = new ActiveXObject("Scripting.FileSystemObject");
        shell = new ActiveXObject("WScript.Shell");
        isHTA = true;
    } catch(e) {}

    // 2. Compute directory paths relative to the HTA location
    var accDir = "";
    if (fso) {
        try {
            var accPathEval = decodeURIComponent(window.location.pathname).replace(/^file:\/\/\//, "").replace(/\//g, "\\");
            if (accPathEval.charAt(0) === "\\") accPathEval = accPathEval.substring(1);
            accDir = fso.GetParentFolderName(accPathEval) + "\\";
        } catch(e) {}
    }

    // 3. Settings persistence functions using text files or localStorage fallback
    var _memorySpeechSetting = null;

    function writeSettingsJS() {
        if (!fso) return;
        try {
            var path = accDir + "accessibility_settings.js";
            var file = fso.CreateTextFile(path, true);
            file.WriteLine("window.accessibilitySettings = {");
            file.WriteLine("  speechEnabled: " + window.getSpeechEnabledSetting() + ",");
            file.WriteLine("  highContrast: " + window.getHighContrastSetting() + ",");
            file.WriteLine("  zoomLevel: '" + window.getZoomSetting() + "',");
            file.WriteLine("  speechRate: " + window.getSpeechRateSetting() + ",");
            file.WriteLine("  rulerEnabled: " + window.getRulerSetting());
            file.WriteLine("};");
            file.Close();
        } catch(e) {}
    }

    window.getSpeechEnabledSetting = function() {
        try {
            if (_memorySpeechSetting !== null) return _memorySpeechSetting;
            if (!isHTA && typeof localStorage !== "undefined") {
                var localVal = localStorage.getItem("speech_setting");
                if (localVal !== null) {
                    return localVal !== "false";
                }
            }
            if (window.accessibilitySettings && window.accessibilitySettings.speechEnabled !== undefined) {
                return window.accessibilitySettings.speechEnabled;
            }
            if (fso) {
                var path = accDir + "speech_setting.txt";
                if (fso.FileExists(path)) {
                    var file = fso.OpenTextFile(path, 1);
                    var content = file.ReadLine().replace(/^\s+|\s+$/g, "");
                    file.Close();
                    return content !== "false";
                }
            }
        } catch(e) {}
        return true; // Default to true
    };

    window.setSpeechEnabledSetting = function(enabled) {
        try {
            _memorySpeechSetting = enabled;
            if (!window.accessibilitySettings) {
                window.accessibilitySettings = {};
            }
            window.accessibilitySettings.speechEnabled = enabled;
            
            if (fso) {
                var path = accDir + "speech_setting.txt";
                var file = fso.CreateTextFile(path, true);
                file.WriteLine(enabled ? "true" : "false");
                file.Close();
                writeSettingsJS();
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem("speech_setting", enabled ? "true" : "false");
            }
        } catch(e) {}
    };

    window.getHighContrastSetting = function() {
        try {
            if (!isHTA && typeof localStorage !== "undefined") {
                var localVal = localStorage.getItem("contrast_setting");
                if (localVal !== null) {
                    return localVal === "true";
                }
            }
            if (window.accessibilitySettings && window.accessibilitySettings.highContrast !== undefined) {
                return window.accessibilitySettings.highContrast;
            }
            if (fso) {
                var path = accDir + "contrast_setting.txt";
                if (fso.FileExists(path)) {
                    var file = fso.OpenTextFile(path, 1);
                    var content = file.ReadLine().replace(/^\s+|\s+$/g, "");
                    file.Close();
                    return content === "true";
                }
            }
        } catch(e) {}
        return false;
    };

    window.setHighContrastSetting = function(enabled) {
        try {
            if (!window.accessibilitySettings) {
                window.accessibilitySettings = {};
            }
            window.accessibilitySettings.highContrast = enabled;
            
            if (fso) {
                var path = accDir + "contrast_setting.txt";
                var file = fso.CreateTextFile(path, true);
                file.WriteLine(enabled ? "true" : "false");
                file.Close();
                writeSettingsJS();
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem("contrast_setting", enabled ? "true" : "false");
            }
        } catch(e) {}
    };

    window.getZoomSetting = function() {
        try {
            if (!isHTA && typeof localStorage !== "undefined") {
                var localVal = localStorage.getItem("zoom_setting");
                if (localVal !== null) {
                    return localVal;
                }
            }
            if (window.accessibilitySettings && window.accessibilitySettings.zoomLevel !== undefined) {
                return window.accessibilitySettings.zoomLevel;
            }
            if (fso) {
                var path = accDir + "zoom_setting.txt";
                if (fso.FileExists(path)) {
                    var file = fso.OpenTextFile(path, 1);
                    var content = file.ReadLine().replace(/^\s+|\s+$/g, "");
                    file.Close();
                    return content || 'std';
                }
            }
        } catch(e) {}
        return 'std';
    };

    window.setZoomSetting = function(level) {
        try {
            if (!window.accessibilitySettings) {
                window.accessibilitySettings = {};
            }
            window.accessibilitySettings.zoomLevel = level;
            
            if (fso) {
                var path = accDir + "zoom_setting.txt";
                var file = fso.CreateTextFile(path, true);
                file.WriteLine(level);
                file.Close();
                writeSettingsJS();
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem("zoom_setting", level);
            }
        } catch(e) {}
    };

    window.getSpeechRateSetting = function() {
        try {
            if (!isHTA && typeof localStorage !== "undefined") {
                var localVal = localStorage.getItem("rate_setting");
                if (localVal !== null) {
                    var rate = parseInt(localVal, 10);
                    if (!isNaN(rate) && rate >= -10 && rate <= 10) {
                        return rate;
                    }
                }
            }
            if (window.accessibilitySettings && window.accessibilitySettings.speechRate !== undefined) {
                return window.accessibilitySettings.speechRate;
            }
            if (fso) {
                var path = accDir + "rate_setting.txt";
                if (fso.FileExists(path)) {
                    var file = fso.OpenTextFile(path, 1);
                    var content = file.ReadLine().replace(/^\s+|\s+$/g, "");
                    file.Close();
                    var rate = parseInt(content, 10);
                    if (!isNaN(rate) && rate >= -10 && rate <= 10) {
                        return rate;
                    }
                }
            }
        } catch(e) {}
        return 0; // Default rate
    };

    window.setSpeechRateSetting = function(val) {
        try {
            var rate = parseInt(val, 10);
            if (isNaN(rate)) rate = 0;
            if (!window.accessibilitySettings) {
                window.accessibilitySettings = {};
            }
            window.accessibilitySettings.speechRate = rate;
            
            if (fso) {
                var path = accDir + "rate_setting.txt";
                var file = fso.CreateTextFile(path, true);
                file.WriteLine(rate);
                file.Close();
                writeSettingsJS();
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem("rate_setting", rate);
            }
        } catch(e) {}
    };

    window.getRulerSetting = function() {
        try {
            if (!isHTA && typeof localStorage !== "undefined") {
                var localVal = localStorage.getItem("ruler_setting");
                if (localVal !== null) {
                    return localVal === "true";
                }
            }
            if (window.accessibilitySettings && window.accessibilitySettings.rulerEnabled !== undefined) {
                return window.accessibilitySettings.rulerEnabled;
            }
            if (fso) {
                var path = accDir + "ruler_setting.txt";
                if (fso.FileExists(path)) {
                    var file = fso.OpenTextFile(path, 1);
                    var content = file.ReadLine().replace(/^\s+|\s+$/g, "");
                    file.Close();
                    return content === "true";
                }
            }
        } catch(e) {}
        return false;
    };

    window.setRulerSetting = function(enabled) {
        try {
            if (!window.accessibilitySettings) {
                window.accessibilitySettings = {};
            }
            window.accessibilitySettings.rulerEnabled = enabled;
            
            if (fso) {
                var path = accDir + "ruler_setting.txt";
                var file = fso.CreateTextFile(path, true);
                file.WriteLine(enabled ? "true" : "false");
                file.Close();
                writeSettingsJS();
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem("ruler_setting", enabled ? "true" : "false");
            }
        } catch(e) {}
    };

    // 4. Voice Synthesis methods
    var voiceObj = null;
    var eqInterval = null;

    function checkSpeakingStatus() {
        try {
            if (voiceObj && voiceObj.Status) {
                var state = voiceObj.Status.RunningState;
                var eq = document.getElementById("accEqualizer_acc");
                if (eq) {
                    if (state === 2) {
                        eq.className = "acc-equalizer active";
                    } else {
                        eq.className = "acc-equalizer";
                        if (eqInterval) {
                            clearInterval(eqInterval);
                            eqInterval = null;
                        }
                    }
                }
            }
        } catch(e) {
            if (eqInterval) {
                clearInterval(eqInterval);
                eqInterval = null;
            }
        }
    }

    window.SpeakText = function(txt) {
        try {
            if (!window.getSpeechEnabledSetting()) return;
            
            // Prova con SAPI SpVoice (ActiveX) se siamo in HTA / IE
            try {
                if (!voiceObj) {
                    voiceObj = new ActiveXObject("SAPI.SpVoice");
                }
                if (voiceObj) {
                    voiceObj.Rate = window.getSpeechRateSetting();
                    // 3 = SVSFlagsAsync (1) + SVSFPurgeBeforeSpeak (2)
                    voiceObj.Speak(txt, 3);

                    // Avvia animazione equalizzatore
                    var eq = document.getElementById("accEqualizer_acc");
                    if (eq) {
                        eq.className = "acc-equalizer active";
                        if (eqInterval) clearInterval(eqInterval);
                        eqInterval = setInterval(checkSpeakingStatus, 150);
                    }
                    return; // Successo con SAPI, termina
                }
            } catch(sapiErr) {
                // Fallback a SpeechSynthesis nativo in caso di errore ActiveX
            }
            
            // Fallback nativo: Web Speech API (SpeechSynthesis)
            if (typeof window.speechSynthesis !== "undefined") {
                window.speechSynthesis.cancel(); // Ferma la lettura precedente
                var utterance = new SpeechSynthesisUtterance(txt);
                utterance.lang = "it-IT";
                
                // Forza la ricerca e l'assegnazione di una voce italiana
                if (window.speechSynthesis.getVoices) {
                    var voices = window.speechSynthesis.getVoices();
                    for (var i = 0; i < voices.length; i++) {
                        if (voices[i].lang.indexOf("it") === 0) {
                            utterance.voice = voices[i];
                            break;
                        }
                    }
                }
                
                // Mappa la velocità da rate setting (-10 a 10) a rate di SpeechSynthesis (0.1 a 3, default 1)
                var rateSetting = window.getSpeechRateSetting();
                var nativeRate = 1;
                if (rateSetting > 0) {
                    nativeRate = 1 + (rateSetting * 0.2); // fino a 3x
                } else if (rateSetting < 0) {
                    nativeRate = 1 + (rateSetting * 0.08); // fino a 0.2x
                }
                utterance.rate = nativeRate;
                
                // Gestione animazione equalizzatore
                var eq = document.getElementById("accEqualizer_acc");
                if (eq) {
                    eq.className = "acc-equalizer active";
                    utterance.onend = function() {
                        eq.className = "acc-equalizer";
                    };
                    utterance.onerror = function() {
                        eq.className = "acc-equalizer";
                    };
                }
                window.speechSynthesis.speak(utterance);
            }
        } catch(e) {}
    };

    window.StopSpeaking = function() {
        try {
            if (voiceObj) {
                voiceObj.Speak("", 2); // 2 = SVSFPurgeBeforeSpeak
            }
            if (typeof window.speechSynthesis !== "undefined") {
                window.speechSynthesis.cancel();
            }
            var eq = document.getElementById("accEqualizer_acc");
            if (eq) eq.className = "acc-equalizer";
            if (eqInterval) {
                clearInterval(eqInterval);
                eqInterval = null;
            }
        } catch(e) {}
    };

    // 5. GUI Application of settings
    window.ApplyContrast = function(enabled) {
        try {
            var body = document.body;
            if (!body) return;
            body.className = body.className.replace(/\bhigh-contrast\b/g, '');
            if (enabled) {
                body.className += " high-contrast";
            }
            body.className = body.className.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            
            // Check native checkboxes or floating widget checkboxes
            var chk = document.getElementById('chkContrast') || document.getElementById('chkContrast_acc');
            if (chk) chk.checked = enabled;
            
            var menuContrast = document.getElementById('menuToggleContrast');
            if (menuContrast) {
                menuContrast.innerHTML = enabled ? 
                    "Disattiva Contrasto Elevato <span class='menu-shortcut'>Ctrl+H</span>" : 
                    "Attiva Contrasto Elevato <span class='menu-shortcut'>Ctrl+H</span>";
            }
        } catch(e) {}
    };

    window.ApplyZoom = function(level) {
        try {
            var body = document.body;
            if (!body) return;
            body.className = body.className.replace(/\b(zoom-lrg|zoom-xlrg)\b/g, '');
            if (level === 'lrg') {
                body.className += " zoom-lrg";
            } else if (level === 'xlrg') {
                body.className += " zoom-xlrg";
            }
            body.className = body.className.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            
            // Update active state style on native/floating zoom buttons
            var levels = ['std', 'lrg', 'xlrg'];
            for (var i = 0; i < levels.length; i++) {
                var lvl = levels[i];
                var btn = document.getElementById('btnZoom' + lvl.charAt(0).toUpperCase() + lvl.slice(1)) ||
                          document.getElementById('btnZoom' + lvl.charAt(0).toUpperCase() + lvl.slice(1) + '_acc');
                if (btn) {
                    if (lvl === level) {
                        btn.style.background = "#ef443b";
                        btn.className = "acc-zoom-btn active";
                    } else {
                        btn.style.background = "rgba(255,255,255,0.1)";
                        btn.className = "acc-zoom-btn";
                    }
                }
            }
        } catch(e) {}
    };

    window.ToggleSpeech = function(enabled) {
        window.setSpeechEnabledSetting(enabled);
        var chk = document.getElementById('chkSpeech') || document.getElementById('chkSpeech_acc');
        if (chk) chk.checked = enabled;
        
        var speechTrack = document.getElementById('speechTrack');
        var speechKnob = document.getElementById('speechKnob');
        if (speechTrack && speechKnob) {
            speechTrack.style.background = enabled ? '#10b981' : '#cbd5e1';
            speechKnob.style.transform = enabled ? 'translateX(16px)' : 'translateX(0px)';
        }
        
        var menuLnk = document.getElementById('menuToggleSpeech');
        if (menuLnk) {
            if (window.location.pathname.toLowerCase().indexOf("anagrafica.html") > -1) {
                menuLnk.innerHTML = enabled ? 
                    "<i class='fa fa-volume-off'></i> DISATTIVA SINTESI <small>Ctrl+V</small>" : 
                    "<i class='fa fa-volume-up'></i> ATTIVA SINTESI <small>Ctrl+V</small>";
            } else {
                var shortcutClass = (window.location.pathname.toLowerCase().indexOf("consegne.html") > -1 || window.location.pathname.toLowerCase().indexOf("storico.html") > -1) ? "shortcut" : "menu-shortcut";
                menuLnk.innerHTML = enabled ? 
                    "Disattiva Sintesi Vocale <span class='" + shortcutClass + "'>Ctrl+V</span>" : 
                    "Attiva Sintesi Vocale <span class='" + shortcutClass + "'>Ctrl+V</span>";
            }
        }
        if (enabled) {
            window.SpeakText("Sintesi vocale attivata. Premi Control più V per disattivarla.");
        } else {
            window.StopSpeaking();
        }
    };

    window.SetSpeechRate = function(val) {
        try {
            var rate = parseInt(val, 10);
            window.setSpeechRateSetting(rate);
            if (voiceObj) {
                voiceObj.Rate = rate;
            }
            var r1 = document.getElementById('rngRate');
            if (r1) r1.value = rate;
            var r2 = document.getElementById('rngRate_acc');
            if (r2) r2.value = rate;
            window.SpeakText("Velocità modificata");
        } catch(e) {}
    };

    window.ToggleHighContrast = function(enabled) {
        window.setHighContrastSetting(enabled);
        window.ApplyContrast(enabled);
        window.SpeakText(enabled ? "Contrasto elevato attivato" : "Contrasto elevato disattivato");
    };

    window.ToggleSpeechShortcut = function() {
        var current = window.getSpeechEnabledSetting();
        window.ToggleSpeech(!current);
    };
    window.ToggleSpeechMenu = window.ToggleSpeechShortcut;

    window.ToggleHighContrastShortcut = function() {
        var current = window.getHighContrastSetting();
        window.ToggleHighContrast(!current);
    };

    var rulerEl = null;
    var rulerMouseListener = null;

    window.ToggleReadingRuler = function(enabled, silent) {
        try {
            if (enabled) {
                if (!rulerEl) {
                    rulerEl = document.createElement("div");
                    rulerEl.id = "accReadingRuler";
                    document.body.appendChild(rulerEl);
                }
                rulerEl.style.display = "block";
                
                if (!rulerMouseListener) {
                    rulerMouseListener = function(e) {
                        e = e || window.event;
                        var y = e.clientY;
                        if (rulerEl) {
                            rulerEl.style.top = (y - 14) + "px";
                        }
                    };
                    addEvent(document, "mousemove", rulerMouseListener);
                }
                if (!silent) {
                    window.SpeakText("Righello di lettura attivato");
                }
            } else {
                if (rulerEl) {
                    rulerEl.style.display = "none";
                }
                if (rulerMouseListener) {
                    if (document.removeEventListener) {
                        document.removeEventListener("mousemove", rulerMouseListener, false);
                    } else if (document.detachEvent) {
                        document.detachEvent("onmousemove", rulerMouseListener);
                    }
                    rulerMouseListener = null;
                }
                if (!silent) {
                    window.SpeakText("Righello di lettura disattivato");
                }
            }
            
            window.setRulerSetting(enabled);
            
            var chk = document.getElementById("chkRuler_acc");
            if (chk) chk.checked = enabled;
        } catch(e) {}
    };

    window.SetZoomLevel = function(level, silent) {
        window.setZoomSetting(level);
        window.ApplyZoom(level);
        if (!silent) {
            var txt = "Dimensione testo normale";
            if (level === 'lrg') txt = "Dimensione testo grande";
            else if (level === 'xlrg') txt = "Dimensione testo molto grande";
            window.SpeakText(txt);
        }
    };

    // 6. Universal Self-Voicing Engine (Hover + Tab Focus)
    var lastSpokenText = "";
    var lastSpokenTime = 0;

    window.ReadElement = function(el, eventType) {
        try {
            if (!el || el === document.body || el === document.documentElement) return;
            if (!window.getSpeechEnabledSetting()) return;
            
            // Check if we are on a guide or documentation page to allow reading standard text elements
            var isGuidePage = /guida|installazione|manuale/i.test(window.location.pathname) || 
                              /guida|installazione|manuale/i.test(document.title) ||
                              (document.querySelector("h1") && /guida|installazione|manuale/i.test(document.querySelector("h1").innerText));
            
            // Walk up the DOM tree from the hovered/focused element to find an interactive or readable element
            var targetEl = el;
            var maxDepth = 4;
            var found = null;
            
            while (targetEl && targetEl !== document.body && targetEl !== document.documentElement && maxDepth > 0) {
                var tag = targetEl.tagName ? targetEl.tagName.toLowerCase() : "";
                var cls = "";
                if (targetEl.className) {
                    if (typeof targetEl.className === "string") {
                        cls = targetEl.className;
                    } else if (typeof targetEl.className.baseVal === "string") {
                        cls = targetEl.className.baseVal;
                    }
                }
                var isInteractive = false;
                
                if (tag === "input" || tag === "select" || tag === "textarea" || tag === "button" || tag === "a") {
                    isInteractive = true;
                } else if (targetEl.getAttribute("tabindex") !== null) {
                    isInteractive = true;
                } else if (targetEl.onclick || targetEl.getAttribute("onclick") || targetEl.id && targetEl.id.indexOf("btn") !== -1) {
                    isInteractive = true;
                } else if (isGuidePage && (
                    tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "p" || tag === "li" ||
                    tag === "td" || tag === "th" || cls.indexOf("pro-tip") !== -1 || cls.indexOf("code-box") !== -1
                )) {
                    isInteractive = true;
                } else if (isGuidePage && tag === "img") {
                    // Check if the image is inside a button or link
                    var isInsideInteractive = false;
                    var parentNode = targetEl.parentNode;
                    while (parentNode && parentNode !== document.body) {
                        var pTag = parentNode.tagName ? parentNode.tagName.toLowerCase() : "";
                        if (pTag === "button" || pTag === "a" || parentNode.getAttribute("tabindex") !== null || parentNode.onclick) {
                            isInsideInteractive = true;
                            break;
                        }
                        parentNode = parentNode.parentNode;
                    }
                    if (!isInsideInteractive) {
                        isInteractive = true;
                    }
                } else {
                    if (cls.indexOf("sidebar-item") !== -1 ||
                        cls.indexOf("nav-btn") !== -1 ||
                        cls.indexOf("console-btn") !== -1 ||
                        cls.indexOf("filter-tab") !== -1 ||
                        cls.indexOf("btn-") !== -1 ||
                        cls.indexOf("exit-btn-sidebar") !== -1 ||
                        cls.indexOf("clickable-value") !== -1 ||
                        cls.indexOf("user-card") !== -1 ||
                        cls.indexOf("quick-action") !== -1 ||
                        cls.indexOf("menu-item") !== -1 ||
                        cls.indexOf("menu-link") !== -1 ||
                        cls.indexOf("alert-item") !== -1) {
                        isInteractive = true;
                    }
                }
                
                if (isInteractive) {
                    found = targetEl;
                    break;
                }
                
                targetEl = targetEl.parentNode;
                maxDepth--;
            }
            
            if (!found) return;
            el = found; // Focus on the resolved interactive/readable element
            
            var tag = el.tagName ? el.tagName.toLowerCase() : "";
            var cls = "";
            if (el.className) {
                if (typeof el.className === "string") {
                    cls = el.className;
                } else if (typeof el.className.baseVal === "string") {
                    cls = el.className.baseVal;
                }
            }
            var txt = "";
            var hint = el.getAttribute("data-hint") || el.getAttribute("title") || el.getAttribute("aria-label");
            var id = el.id || "";
            
            if (tag === "img") {
                txt = el.getAttribute("alt") || el.getAttribute("title") || "";
                if (txt) {
                    txt = "Illustrazione: " + txt;
                }
            }
            else if (cls.indexOf("sidebar-item") !== -1 || cls.indexOf("nav-btn") !== -1 || cls.indexOf("exit-btn-sidebar") !== -1) {
                txt = el.innerText || el.textContent || "";
                txt = txt.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                if (txt.toUpperCase().indexOf("ESCI") !== -1) {
                    txt = "Esci dall'applicazione";
                } else {
                    txt = "Sezione " + txt;
                }
            }
            else if (tag === "input" && el.type === "checkbox") {
                var lblText = "";
                if (el.id) {
                    var labels = document.getElementsByTagName("label");
                    for (var i = 0; i < labels.length; i++) {
                        if (labels[i].htmlFor === el.id || labels[i].getAttribute("for") === el.id) {
                            lblText = labels[i].innerText || labels[i].textContent;
                            break;
                        }
                    }
                }
                if (!lblText) {
                    var parent = el.parentNode;
                    if (parent && parent.tagName.toLowerCase() === "label") {
                        lblText = parent.innerText || parent.textContent;
                    } else {
                        lblText = el.title || el.name || "";
                    }
                }
                lblText = lblText.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                txt = "Interruttore " + lblText + ". " + (el.checked ? "Attivato" : "Disattivato");
            }
            else if (tag === "input" || tag === "textarea" || tag === "select") {
                var lblText = "";
                if (el.id) {
                    var labels = document.getElementsByTagName("label");
                    for (var i = 0; i < labels.length; i++) {
                        if (labels[i].htmlFor === el.id || labels[i].getAttribute("for") === el.id) {
                            lblText = labels[i].innerText || labels[i].textContent;
                            break;
                        }
                    }
                }
                if (!lblText) {
                    var parent = el.parentNode;
                    if (parent && parent.tagName.toLowerCase() === "label") {
                        lblText = parent.innerText || parent.textContent;
                    } else if (el.placeholder) {
                        lblText = el.placeholder;
                    } else {
                        lblText = el.title || el.name || "";
                    }
                }
                lblText = lblText.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                
                var val = el.value || "";
                val = val.trim();
                if (val) {
                    if (/^\d{6,}$/.test(val) || id.toLowerCase().indexOf("id") > -1 && /^\d+$/.test(val)) {
                        // ID or phone number: read digit-by-digit
                        val = val.split("").join(" ");
                    }
                    txt = "Casella " + lblText + ". Valore attuale: " + val;
                } else {
                    txt = "Casella " + lblText + ". Vuota.";
                }
            }
            else if (cls.indexOf("clickable-value") !== -1) {
                var parentLabel = el.parentNode ? el.parentNode.innerText.split(":")[0].trim() : "";
                var val = el.innerText.trim();
                if (/^\d+$/.test(val)) {
                    val = val.split("").join(" ");
                }
                txt = parentLabel + ": " + val + ". Premi invio per copiare.";
            }
            else if (cls.indexOf("user-card") !== -1) {
                var nameEl = el.getElementsByClassName("user-name")[0];
                var name = nameEl ? nameEl.innerText : "";
                var source = el.getAttribute("data-source") || "";
                txt = "Scheda Operatore " + name + ". Provenienza " + source;
            }
            else if (cls.indexOf("btn-connetti") !== -1) {
                var card = el.parentNode;
                while (card && card.className.indexOf("user-card") === -1) {
                    card = card.parentNode;
                }
                var name = "";
                if (card) {
                    var nameEl = card.getElementsByClassName("user-name")[0];
                    if (nameEl) name = nameEl.innerText;
                }
                txt = "Pulsante Connetti ad " + name;
            }
            else if (cls.indexOf("alert-item") !== -1) {
                txt = "Notifica. " + (el.innerText || el.textContent || "").trim();
            }
            else if (tag === "button" || tag === "a") {
                var prefix = (tag === "button") ? "Pulsante" : "Collegamento";
                var cleanText = (el.innerText || el.textContent || "").trim();
                var isSymbolOnly = cleanText.length <= 2 && !/[a-zA-Z0-9]/.test(cleanText);
                if (hint && (isSymbolOnly || !cleanText)) {
                    txt = prefix + " " + hint;
                    hint = ""; // Impedisce che l'hint venga accodato una seconda volta
                } else {
                    txt = prefix + " " + cleanText;
                }
            }
            else {
                // General text elements
                txt = el.innerText || el.textContent || "";
                txt = txt.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                
                // Allow longer reads on guide pages, otherwise truncate for tables/dashboards
                var maxLen = isGuidePage ? 1000 : 120;
                if (txt.length > maxLen) {
                    txt = txt.substring(0, maxLen - 10) + "...";
                }
            }
            
            // Append data hint or title description if available and not redundant
            if (hint && hint !== txt && txt.indexOf(hint) === -1) {
                if (txt) {
                    txt = txt + ". " + hint;
                } else {
                    txt = hint;
                }
            }
            
            txt = txt.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
            
            // Play speech if text is non-empty and different from last spoken, or if enough time has passed
            if (txt && (txt !== lastSpokenText || (new Date().getTime() - lastSpokenTime) > 1000)) {
                lastSpokenText = txt;
                lastSpokenTime = new Date().getTime();
                window.SpeakText(txt);
            }
        } catch(e) {}
    };

    // === FOCUS TRAPPING LOGIC ===
    var focusTrapElement = null;
    var focusTrapListener = null;

    window.trapFocusOnElement = function(element) {
        window.releaseFocusTrap();
        focusTrapElement = element;
        focusTrapListener = function(e) {
            e = e || window.event;
            var keyCode = e.keyCode || e.which;
            if (keyCode === 9) { // Tab key
                try {
                    var focusables = [];
                    var all = focusTrapElement.getElementsByTagName("*");
                    for (var i = 0; i < all.length; i++) {
                        var el = all[i];
                        var tag = el.tagName.toLowerCase();
                        var isFocusable = tag === "input" || tag === "select" || tag === "textarea" || tag === "button" || tag === "a" || el.getAttribute("tabindex") !== null;
                        if (isFocusable && el.style.display !== "none" && el.style.visibility !== "hidden") {
                            focusables.push(el);
                        }
                    }
                    if (focusables.length === 0) return;
                    
                    var first = focusables[0];
                    var last = focusables[focusables.length - 1];
                    var active = document.activeElement;
                    
                    if (e.shiftKey) { // Shift + Tab
                        if (active === first) {
                            if (e.preventDefault) e.preventDefault();
                            else e.returnValue = false;
                            last.focus();
                        }
                    } else { // Tab
                        if (active === last) {
                            if (e.preventDefault) e.preventDefault();
                            else e.returnValue = false;
                            first.focus();
                        }
                    }
                } catch(err) {}
            }
        };
        addEvent(document, "keydown", focusTrapListener);
    };

    window.releaseFocusTrap = function() {
        if (focusTrapListener) {
            if (document.removeEventListener) {
                document.removeEventListener("keydown", focusTrapListener, false);
            } else if (document.detachEvent) {
                document.detachEvent("onkeydown", focusTrapListener);
            }
            focusTrapListener = null;
        }
        focusTrapElement = null;
    };

    window.TrapFocusOnModal = function(modalId) {
        var modal = document.getElementById(modalId);
        if (modal) {
            window.trapFocusOnElement(modal);
        }
    };


    // === COMMAND PALETTE SYSTEM ===
    var commands = [
        { name: "Apri Pannello Comandi (Dashboard)", desc: "Naviga alla schermata principale di riepilogo e notifiche", action: function() { window.NavigaModulo("dashboard.html"); } },
        { name: "Apri Gestione Consegne", desc: "Gestisci l'inserimento ed elaborazione delle consegne operative", action: function() { window.NavigaModulo("consegne.html"); } },
        { name: "Apri Anagrafica Clienti", desc: "Visualizza e modifica l'archivio dei clienti e delle invalidità", action: function() { window.NavigaModulo("anagrafica.html"); } },
        { name: "Apri Archivio Storico", desc: "Consulta lo storico dei dati e le sincronizzazioni", action: function() { window.NavigaModulo("storico.html"); } },
        { name: "Apri AnyDesk Hub", desc: "Torna alla console di connessione principale per il backup", action: function() { window.NavigaModulo("anydesk_hub.html"); } },
        { name: "Apri Registro Presenze", desc: "Accedi al registro per inserire le ore di presenza degli operatori", action: function() { window.NavigaModulo("presenze.html"); } },
        { name: "Apri Spese Auto e Rimborsi", desc: "Gestisci le spese, i consumi e le tratte dei veicoli aziendali", action: function() { window.NavigaModulo("auto.html"); } },
        { name: "Apri Agenda Promemoria", desc: "Visualizza scadenze, note e bacheca comunicazioni", action: function() { window.NavigaModulo("promemoria.html"); } },
        
        { name: "Attiva Sintesi Vocale", desc: "Abilita la lettura ad alta voce degli elementi con focus ed hover", action: function() { window.ToggleSpeech(true); } },
        { name: "Disattiva Sintesi Vocale", desc: "Spegne la lettura automatica dell'applicazione", action: function() { window.ToggleSpeech(false); } },
        { name: "Attiva Contrasto Elevato", desc: "Applica colori ad alta visibilità nero e giallo neon", action: function() { window.ToggleHighContrast(true); } },
        { name: "Disattiva Contrasto Elevato", desc: "Ripristina la tavolozza di colori standard di Zenith Suite", action: function() { window.ToggleHighContrast(false); } },
        
        { name: "Dimensione Testo Standard", desc: "Imposta il carattere alle dimensioni di default", action: function() { window.SetZoomLevel('std'); } },
        { name: "Dimensione Testo Grande (A+)", desc: "Ingrandisce leggermente le scritte per una lettura facilitata", action: function() { window.SetZoomLevel('lrg'); } },
        { name: "Dimensione Testo Molto Grande (A++)", desc: "Applica il massimo ingrandimento possibile ai font di testo", action: function() { window.SetZoomLevel('xlrg'); } },
        
        { name: "Esegui Backup Database", desc: "Avvia la routine batch per il backup di sicurezza", action: function() { 
            try {
                if (typeof window.RunBackup === "function") window.RunBackup();
                else if (document.getElementById('cmdBackup')) document.getElementById('cmdBackup').click();
                else window.SpeakText("Funzione backup non disponibile su questa pagina.");
            } catch(e) {}
        } },
        { name: "Chiudi e Esci dall'Applicazione", desc: "Termina in sicurezza le istanze attive", action: function() {
            try {
                if (typeof window.ActionEsci === "function") window.ActionEsci();
                else if (typeof window.SafeExit === "function") window.SafeExit();
                else window.close();
            } catch(e) {}
        } }
    ];

    var activeCommandIndex = -1;
    var filteredCommands = [];
    var previousFocusedEl = null;

    window.openCommandPalette = function() {
        var overlay = document.getElementById("cmdPaletteOverlay");
        if (!overlay) return;
        
        previousFocusedEl = document.activeElement;
        overlay.style.display = "flex";
        
        var input = document.getElementById("cmdPaletteInput");
        if (input) {
            input.value = "";
            input.focus();
        }
        
        window.filterPaletteCommands("");
        window.SpeakText("Tavolozza dei comandi aperta. Digita per cercare.");
        window.trapFocusOnElement(document.getElementById("cmdPaletteCard"));
    };

    window.closeCommandPalette = function() {
        var overlay = document.getElementById("cmdPaletteOverlay");
        if (!overlay || overlay.style.display === "none") return;
        
        overlay.style.display = "none";
        window.SpeakText("Tavolozza dei comandi chiusa.");
        window.releaseFocusTrap();
        
        if (previousFocusedEl && previousFocusedEl.focus) {
            try { previousFocusedEl.focus(); } catch(e) {}
        }
    };

    window.filterPaletteCommands = function(query) {
        query = query.toLowerCase().trim();
        filteredCommands = [];
        for (var i = 0; i < commands.length; i++) {
            var c = commands[i];
            if (!query || c.name.toLowerCase().indexOf(query) > -1 || c.desc.toLowerCase().indexOf(query) > -1) {
                filteredCommands.push(c);
            }
        }
        activeCommandIndex = filteredCommands.length > 0 ? 0 : -1;
        window.renderPaletteCommands();
    };

    window.renderPaletteCommands = function() {
        var container = document.getElementById("cmdPaletteResults");
        if (!container) return;
        
        var html = "";
        for (var i = 0; i < filteredCommands.length; i++) {
            var c = filteredCommands[i];
            var activeClass = (i === activeCommandIndex) ? " active" : "";
            html += '<div class="cmd-palette-item' + activeClass + '" onclick="window.triggerPaletteCommand(' + i + ')" role="option" aria-selected="' + (i === activeCommandIndex ? 'true' : 'false') + '">' +
                    '  <span class="cmd-name">' + c.name + '</span>' +
                    '  <span class="cmd-desc">' + c.desc + '</span>' +
                    '</div>';
        }
        if (filteredCommands.length === 0) {
            html = '<div style="padding: 16px; text-align: center; color: rgba(255,255,255,0.4); font-size:13px;">Nessun comando corrispondente</div>';
        }
        container.innerHTML = html;
        
        if (activeCommandIndex > -1) {
            var sel = filteredCommands[activeCommandIndex];
            window.SpeakText(sel.name + ". " + sel.desc);
        }
    };

    window.triggerPaletteCommand = function(idx) {
        if (idx > -1 && idx < filteredCommands.length) {
            var c = filteredCommands[idx];
            window.closeCommandPalette();
            setTimeout(function() {
                c.action();
            }, 300);
        }
    };

    window.handlePaletteKeys = function(e) {
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        
        if (keyCode === 27) { // Escape
            if (e.preventDefault) e.preventDefault();
            e.returnValue = false;
            window.closeCommandPalette();
        }
        else if (keyCode === 38) { // Up arrow
            if (e.preventDefault) e.preventDefault();
            e.returnValue = false;
            if (filteredCommands.length > 0) {
                activeCommandIndex = (activeCommandIndex <= 0) ? filteredCommands.length - 1 : activeCommandIndex - 1;
                window.renderPaletteCommands();
                window.scrollPaletteItemIntoView();
            }
        }
        else if (keyCode === 40) { // Down arrow
            if (e.preventDefault) e.preventDefault();
            e.returnValue = false;
            if (filteredCommands.length > 0) {
                activeCommandIndex = (activeCommandIndex >= filteredCommands.length - 1) ? 0 : activeCommandIndex + 1;
                window.renderPaletteCommands();
                window.scrollPaletteItemIntoView();
            }
        }
        else if (keyCode === 13) { // Enter
            if (e.preventDefault) e.preventDefault();
            e.returnValue = false;
            if (activeCommandIndex > -1) {
                window.triggerPaletteCommand(activeCommandIndex);
            }
        }
    };

    window.scrollPaletteItemIntoView = function() {
        try {
            var container = document.getElementById("cmdPaletteResults");
            var items = container.getElementsByClassName("cmd-palette-item");
            if (items && items[activeCommandIndex]) {
                var item = items[activeCommandIndex];
                var containerTop = container.scrollTop;
                var containerBottom = containerTop + container.clientHeight;
                var itemTop = item.offsetTop - container.offsetTop;
                var itemBottom = itemTop + item.clientHeight;
                
                if (itemTop < containerTop) {
                    container.scrollTop = itemTop;
                } else if (itemBottom > containerBottom) {
                    container.scrollTop = itemBottom - container.clientHeight;
                }
            }
        } catch(e) {}
    };

    function injectCommandPalette() {
        if (document.getElementById("cmdPaletteOverlay")) return;
        
        var overlay = document.createElement("div");
        overlay.id = "cmdPaletteOverlay";
        overlay.className = "cmd-palette-overlay";
        overlay.style.display = "none";
        
        overlay.innerHTML = 
            '<div class="cmd-palette-card" id="cmdPaletteCard" role="dialog" aria-modal="true" aria-label="Tavolozza dei comandi">' +
            '  <div class="cmd-palette-header">🔍 Tavolozza dei Comandi - Zenith Suite</div>' +
            '  <input type="text" id="cmdPaletteInput" class="cmd-palette-input" placeholder="Cerca un comando o una sezione... (Esci con Esc)" autocomplete="off">' +
            '  <div id="cmdPaletteResults" class="cmd-palette-results" role="listbox"></div>' +
            '</div>';
            
        document.body.appendChild(overlay);
        
        var input = document.getElementById("cmdPaletteInput");
        if (input) {
            addEvent(input, "keyup", function(ev) {
                ev = ev || window.event;
                var kc = ev.keyCode || ev.which;
                if (kc !== 38 && kc !== 40 && kc !== 13 && kc !== 27) {
                    window.filterPaletteCommands(input.value);
                }
            });
            addEvent(input, "keydown", window.handlePaletteKeys);
        }
        
        addEvent(overlay, "click", function(ev) {
            ev = ev || window.event;
            var target = ev.target || ev.srcElement;
            var card = document.getElementById("cmdPaletteCard");
            if (target === overlay && target !== card && !isDescendant(card, target)) {
                window.closeCommandPalette();
            }
        });
    }

    // Helper to register events in cross-browser fashion
    function addEvent(el, type, fn) {
        if (el.addEventListener) el.addEventListener(type, fn, false);
        else if (el.attachEvent) el.attachEvent("on" + type, fn);
    }

    // 7. Accessibility panel injection (Floating widget with Drag and Drop)
    function injectFloatingWidget() {
        if (document.getElementById('chkSpeech') || document.getElementById('chkSpeech_acc')) return;
        if (document.getElementById('accWidgetContainer')) return;
        
        var container = document.createElement("div");
        container.className = "acc-widget-container";
        container.id = "accWidgetContainer";
        
        // Restore saved position if available
        try {
            var savedPos = (typeof localStorage !== "undefined") ? localStorage.getItem("acc_widget_pos") : null;
            if (savedPos) {
                var pos = JSON.parse(savedPos);
                if (pos && pos.left !== undefined && pos.top !== undefined) {
                    container.style.left = pos.left + "px";
                    container.style.top = pos.top + "px";
                    container.style.right = "auto";
                    container.style.bottom = "auto";
                }
            }
        } catch(ePos) {}

        container.innerHTML = 
            '<button class="acc-widget-btn" id="accWidgetBtn" title="Accessibilità (Trascina per spostare ove desideri)" aria-label="Accessibilità">♿</button>' +
            '<div class="acc-widget-panel" id="accWidgetPanel">' +
            '  <div class="acc-widget-header">⚙️ Accessibilità</div>' +
            '  <div class="acc-widget-row">' +
            '    <span style="display:flex; align-items:center;">Sintesi Vocale <div class="acc-equalizer" id="accEqualizer_acc"><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span></div></span>' +
            '    <label class="acc-switch">' +
            '      <input type="checkbox" id="chkSpeech_acc" onchange="ToggleSpeech(this.checked)">' +
            '      <span class="acc-slider"></span>' +
            '    </label>' +
            '  </div>' +
            '  <div class="acc-widget-row">' +
            '    <span>Velocità Voce</span>' +
            '    <input type="range" id="rngRate_acc" min="-10" max="10" value="0" step="1" onchange="SetSpeechRate(this.value)" style="width: 90px; vertical-align: middle;">' +
            '  </div>' +
            '  <div class="acc-widget-row">' +
            '    <span>Contrasto Elevato</span>' +
            '    <label class="acc-switch">' +
            '      <input type="checkbox" id="chkContrast_acc" onchange="ToggleHighContrast(this.checked)">' +
            '      <span class="acc-slider"></span>' +
            '    </label>' +
            '  </div>' +
            '  <div class="acc-widget-row">' +
            '    <span>Dimensione Testo</span>' +
            '    <div class="acc-zoom-buttons">' +
            '      <button id="btnZoomStd_acc" onclick="SetZoomLevel(\'std\')" class="acc-zoom-btn">STD</button>' +
            '      <button id="btnZoomLrg_acc" onclick="SetZoomLevel(\'lrg\')" class="acc-zoom-btn">A+</button>' +
            '      <button id="btnZoomXlrg_acc" onclick="SetZoomLevel(\'xlrg\')" class="acc-zoom-btn">A++</button>' +
            '    </div>' +
            '  </div>' +
            '  <div class="acc-widget-row" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px; margin-top: 8px; margin-bottom: 0;">' +
            '    <span>Righello Lettura</span>' +
            '    <label class="acc-switch">' +
            '      <input type="checkbox" id="chkRuler_acc" onchange="ToggleReadingRuler(this.checked)">' +
            '      <span class="acc-slider"></span>' +
            '    </label>' +
            '  </div>' +
            '  <div style="border-top: 1px dashed rgba(255,255,255,0.15); margin-top: 10px; padding-top: 6px; display:flex; justify-content:space-between; align-items:center;">' +
            '    <span style="font-size:9px; color:#94a3b8;">💡 Trascina l\'icona ♿ con il mouse</span>' +
            '    <button onclick="window.ResetAccWidgetPos()" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#cbd5e1; font-size:9px; border-radius:3px; padding:2px 6px; cursor:pointer;">Reset Posizione</button>' +
            '  </div>' +
            '</div>';
        
        document.body.appendChild(container);

        var btn = document.getElementById("accWidgetBtn");
        btn.style.touchAction = "none";
        var hasMoved = false;
        var startX = 0, startY = 0, origLeft = 0, origTop = 0;

        var startDrag = function(clientX, clientY) {
            startX = clientX;
            startY = clientY;
            var rect = container.getBoundingClientRect();
            origLeft = rect.left;
            origTop = rect.top;
            hasMoved = false;
        };

        var moveDrag = function(clientX, clientY) {
            var dx = clientX - startX;
            var dy = clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
                var newLeft = origLeft + dx;
                var newTop = origTop + dy;

                var maxLeft = window.innerWidth - 55;
                var maxTop = window.innerHeight - 55;
                if (newLeft < 5) newLeft = 5;
                if (newLeft > maxLeft) newLeft = maxLeft;
                if (newTop < 5) newTop = 5;
                if (newTop > maxTop) newTop = maxTop;

                container.style.left = newLeft + "px";
                container.style.top = newTop + "px";
                container.style.right = "auto";
                container.style.bottom = "auto";
            }
        };

        var endDrag = function() {
            if (hasMoved) {
                try {
                    var rect = container.getBoundingClientRect();
                    if (typeof localStorage !== "undefined") {
                        localStorage.setItem("acc_widget_pos", JSON.stringify({ left: rect.left, top: rect.top }));
                    }
                } catch(ex) {}
            }
        };

        btn.onmousedown = function(e) {
            e = e || window.event;
            startDrag(e.clientX, e.clientY);

            var onMouseMove = function(ev) {
                ev = ev || window.event;
                moveDrag(ev.clientX, ev.clientY);
            };

            var onMouseUp = function() {
                if (document.removeEventListener) {
                    document.removeEventListener("mousemove", onMouseMove, false);
                    document.removeEventListener("mouseup", onMouseUp, false);
                } else if (document.detachEvent) {
                    document.detachEvent("onmousemove", onMouseMove);
                    document.detachEvent("onmouseup", onMouseUp);
                }
                endDrag();
            };

            addEvent(document, "mousemove", onMouseMove);
            addEvent(document, "mouseup", onMouseUp);
        };

        btn.ontouchstart = function(e) {
            if (!e.touches || e.touches.length !== 1) return;
            var touch = e.touches[0];
            startDrag(touch.clientX, touch.clientY);

            var onTouchMove = function(ev) {
                if (!ev.touches || ev.touches.length === 0) return;
                moveDrag(ev.touches[0].clientX, ev.touches[0].clientY);
                if (ev.preventDefault) ev.preventDefault();
            };

            var onTouchEnd = function() {
                if (document.removeEventListener) {
                    document.removeEventListener("touchmove", onTouchMove, false);
                    document.removeEventListener("touchend", onTouchEnd, false);
                }
                endDrag();
            };

            if (document.addEventListener) {
                document.addEventListener("touchmove", onTouchMove, { passive: false });
                document.addEventListener("touchend", onTouchEnd, false);
            }
        };

        btn.onclick = function(e) {
            if (hasMoved) {
                e = e || window.event;
                if (e.stopPropagation) e.stopPropagation();
                e.cancelBubble = true;
                return false;
            }
            toggleAccPanel();
        };

        // Click outside panel closes it
        addEvent(document, "click", function(e) {
            e = e || window.event;
            var src = e.srcElement || e.target;
            var panel = document.getElementById("accWidgetPanel");
            var btnEl = document.getElementById("accWidgetBtn");
            var sidebarBtn = document.getElementById("accSidebarBtn");
            
            var clickedBtn = (src === btnEl || (btnEl && isDescendant(btnEl, src))) ||
                             (src === sidebarBtn || (sidebarBtn && isDescendant(sidebarBtn, src)));
                             
            if (panel && panel.className.indexOf("open") !== -1 && !clickedBtn && !isDescendant(panel, src)) {
                panel.className = "acc-widget-panel";
            }
        });
    }

    window.ResetAccWidgetPos = function() {
        var container = document.getElementById("accWidgetContainer");
        if (container) {
            container.style.left = "auto";
            container.style.top = "auto";
            container.style.right = "20px";
            container.style.bottom = "85px";
            try {
                if (typeof localStorage !== "undefined") localStorage.removeItem("acc_widget_pos");
            } catch(e) {}
        }
        window.SpeakText("Posizione pulsante accessibilità resettata.");
    };

    window.toggleAccPanel = function() {
        var panel = document.getElementById("accWidgetPanel");
        if (panel) {
            if (panel.className.indexOf("open") !== -1) {
                panel.className = "acc-widget-panel";
            } else {
                panel.className = "acc-widget-panel open";
                window.SpeakText("Apertura pannello accessibilità");
            }
        }
    };
    window.ApriMenuAccessibilita = window.toggleAccPanel;

    function isDescendant(parent, child) {
        var node = child.parentNode;
        while (node != null) {
            if (node == parent) return true;
            node = node.parentNode;
        }
        return false;
    }

    // 8. Navigation delay wrappers (Intercepts transitions so SAPI isn't cut off)
    function wrapNavigation(methodName) {
        var _original = window[methodName];
        Object.defineProperty(window, methodName, {
            get: function() {
                return function(page) {
                    var pageName = String(page).split(".")[0];
                    var speechText = "Apertura " + pageName;
                    if (pageName === "dashboard") speechText = "Ritorno al pannello di controllo";
                    else if (pageName === "anagrafica") speechText = "Apertura anagrafica";
                    else if (pageName === "consegne") speechText = "Apertura consegne";
                    else if (pageName === "storico") speechText = "Apertura anagrafica storica";
                    else if (pageName === "anydesk_hub") speechText = "Apertura anydesk hub";
                    else if (pageName === "presenze") speechText = "Apertura registro presenze";
                    else if (pageName === "promemoria") speechText = "Apertura agenda promemoria";
                    else if (pageName === "articoli") speechText = "Apertura catalogo articoli";
                    
                    window.SpeakText(speechText);
                    setTimeout(function() {
                        if (typeof _original === "function") {
                            _original(page);
                        } else {
                            try {
                                var shell = new ActiveXObject("WScript.Shell");
                                shell.Run('mshta.exe "' + accDir + page + '"', 1, false);
                                window.close();
                            } catch(ex){}
                        }
                    }, 400); // 400ms is enough to let speech finish
                };
            },
            set: function(fn) {
                _original = fn;
            },
            configurable: true
        });
    }

    wrapNavigation("NavigaModulo");
    wrapNavigation("LaunchModule");
    wrapNavigation("NavigateTo");

    // === PAUSA SCHERMO (SCREENSAVER) GLOBALE ===
    var ssTimer;
    var ssActive = false;
    var lastInteraction = 0;
    
    function AttivaScreensaver() {
        var ss = document.getElementById("accScreensaver");
        if (!ss) return;
        ssActive = true;
        ss.style.display = "flex";
        CaricaMeteoSS_acc();
        AggiornaOrologioSS();
        AvviaParticelleSS_acc("ssCanvas_acc");
    }
    
    function ResetScreensaver() {
        var now = new Date().getTime();
        if (now - lastInteraction < 500 && !ssActive) return; 
        lastInteraction = now;

        clearTimeout(ssTimer);
        if(ssActive) {
            var ss = document.getElementById("accScreensaver");
            if (ss) ss.style.display = "none";
            ssActive = false;
            try {
                if (typeof window.StopSpeaking === "function") {
                    window.StopSpeaking();
                } else if (typeof speechSynthesis !== "undefined") {
                    speechSynthesis.cancel();
                }
            } catch(ex) {}
        }
        // Impostato a 30 minuti come richiesto dall'utente per evitare loop fastidiosi
        ssTimer = setTimeout(AttivaScreensaver, 1800000); 
    }
    
    function AggiornaOrologioSS() {
        if(!ssActive) return;
        var d = new Date();
        var hh = (d.getHours()<10?'0':'')+d.getHours();
        var mm = (d.getMinutes()<10?'0':'')+d.getMinutes();
        var giorni = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
        var mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        
        var cClock = document.getElementById("ssClock_acc");
        if(cClock) cClock.innerText = hh + ":" + mm;
        var cDate = document.getElementById("ssDate_acc");
        if(cDate) cDate.innerText = giorni[d.getDay()] + " " + d.getDate() + " " + mesi[d.getMonth()] + " " + d.getFullYear();
        
        var cStats = document.getElementById("ssConsegneOggi_acc");
        if (cStats) {
            var deliveryCount = "0";
            try {
                // 1. Prova a leggere da un contatore esistente nella pagina
                var existingCnt = document.getElementById("cntConsegne") || 
                                  document.getElementById("ssConsegneOggi") ||
                                  document.getElementById("lblStat1");
                if (existingCnt) {
                    var txt = existingCnt.innerText || existingCnt.textContent;
                    var m = txt.match(/\d+/);
                    if (m) deliveryCount = m[0];
                } else if (isHTA && typeof DB_PATH !== "undefined") {
                    // 2. Se in HTA e abbiamo DB_PATH, esegui query ADODB veloce
                    try {
                        var conn = new ActiveXObject("ADODB.Connection");
                        var connStr = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" + DB_PATH + ";";
                        conn.Open(connStr);
                        var qOggi = "DataConsegna >= Date() AND DataConsegna < DateAdd('d', 1, Date())";
                        var rs = conn.Execute("SELECT COUNT(*) FROM tblConsegne WHERE " + qOggi);
                        if (!rs.EOF) {
                            deliveryCount = rs.Fields(0).Value + "";
                        }
                        rs.Close();
                        conn.Close();
                    } catch(eDb) {
                        try {
                            var connJet = new ActiveXObject("ADODB.Connection");
                            var connStrJet = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" + DB_PATH + ";";
                            connJet.Open(connStrJet);
                            var qOggi = "DataConsegna >= Date() AND DataConsegna < DateAdd('d', 1, Date())";
                            var rsJet = connJet.Execute("SELECT COUNT(*) FROM tblConsegne WHERE " + qOggi);
                            if (!rsJet.EOF) {
                                deliveryCount = rsJet.Fields(0).Value + "";
                            }
                            rsJet.Close();
                            connJet.Close();
                        } catch(eJet) {}
                    }
                }
            } catch(eStatsEx) {}
            cStats.innerText = deliveryCount;
        }
        
        setTimeout(AggiornaOrologioSS, 1000);
    }

    function GestisciKeydownSS_acc(e) {
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        if (ssActive) {
            if (keyCode === 32 || keyCode === 86) { // Spazio o V
                try {
                    var d = new Date();
                    var hh = d.getHours();
                    var mm = d.getMinutes();
                    var cStats = document.getElementById("ssConsegneOggi_acc");
                    var numConsegne = cStats ? cStats.innerText : "0";
                    var textToSpeak = "Pausa schermo. Sono le ore " + hh + " e " + mm + ". Consegne in attesa per oggi: " + numConsegne + ".";
                    
                    if (typeof window.SpeakText === "function") {
                        window.SpeakText(textToSpeak);
                    } else if (isHTA) {
                        try {
                            var sp = new ActiveXObject("SAPI.SpVoice");
                            sp.Speak(textToSpeak, 1);
                        } catch(sapiEx) {}
                    } else if (typeof speechSynthesis !== "undefined") {
                        var u = new SpeechSynthesisUtterance(textToSpeak);
                        u.lang = "it-IT";
                        speechSynthesis.speak(u);
                    }
                } catch(ex) {}
                if (e.preventDefault) e.preventDefault();
                else e.returnValue = false;
                return false;
            }
        }
        ResetScreensaver();
    }

    function CaricaMeteoSS_acc() {
        var ssM = document.getElementById("ssMeteo_acc");
        if (!ssM) return;
        try {
            if (isHTA) {
                var x = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
                x.Open("GET", "https://wttr.in/Bari?format=%t+%C", true);
                x.onreadystatechange = function() {
                    if (x.readyState === 4 && x.status === 200) {
                        ssM.innerText = x.responseText.trim();
                    }
                };
                x.Send();
            } else {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "https://wttr.in/Bari?format=%t+%C", true);
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        ssM.innerText = xhr.responseText.trim();
                    }
                };
                xhr.send();
            }
        } catch(e) {
            ssM.innerText = "22°C Sereno";
        }
    }

    function AvviaParticelleSS_acc(canvasId) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;
        try {
            var ctx = canvas.getContext("2d");
            var particles = [];
            var w = canvas.width = window.innerWidth;
            var h = canvas.height = window.innerHeight;
            
            var oldResize = window.onresize;
            window.onresize = function() {
                try {
                    if (oldResize) oldResize();
                    w = canvas.width = window.innerWidth;
                    h = canvas.height = window.innerHeight;
                } catch(e){}
            };
            
            for (var i = 0; i < 40; i++) {
                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: Math.random() * 2.5 + 0.8,
                    vy: -(Math.random() * 0.3 + 0.1),
                    vx: Math.random() * 0.15 - 0.07,
                    alpha: Math.random() * 0.4 + 0.1
                });
            }
            
            function draw() {
                if (!ssActive) return;
                ctx.clearRect(0, 0, w, h);
                for (var i = 0; i < particles.length; i++) {
                    var p = particles[i];
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, true);
                    ctx.fillStyle = "rgba(212, 175, 55, " + p.alpha + ")";
                    ctx.fill();
                    
                    p.y += p.vy;
                    p.x += p.vx;
                    
                    if (p.y < 0) {
                        p.y = h;
                        p.x = Math.random() * w;
                    }
                }
                if (window.requestAnimationFrame) {
                    window.requestAnimationFrame(draw);
                } else {
                    setTimeout(draw, 16);
                }
            }
            draw();
        } catch(e) {}
    }

    // === BROWSER WELCOME & USER GESTURE ACTIVATION BANNER ===
    var speechUnlocked = false;
    
    window.unlockSpeechExplicit = function() {
        unlockSpeech();
    };

    function unlockSpeech() {
        if (speechUnlocked) return;
        speechUnlocked = true;
        hideActivationBanner();
        
        try {
            if (typeof window.speechSynthesis !== "undefined" && window.getSpeechEnabledSetting()) {
                window.speechSynthesis.cancel();
                var isLogin = /login/i.test(window.location.pathname);
                var h1 = document.querySelector("h1");
                if (h1 && !isLogin) {
                    var isGuidePage = /guida|installazione|manuale/i.test(window.location.pathname) || 
                                      /guida|installazione|manuale/i.test(document.title) ||
                                      /guida|installazione|manuale/i.test(h1.innerText);
                    var welcomeTxt = "Lettura vocale avviata. " + h1.innerText;
                    if (isGuidePage) {
                        welcomeTxt += ". Premi il tasto Tab per scorrere i contenuti con la tastiera, o passa il mouse.";
                    }
                    var utterance = new SpeechSynthesisUtterance(welcomeTxt);
                    utterance.lang = "it-IT";
                    var rateSetting = window.getSpeechRateSetting();
                    var nativeRate = 1;
                    if (rateSetting > 0) nativeRate = 1 + (rateSetting * 0.2);
                    else if (rateSetting < 0) nativeRate = 1 + (rateSetting * 0.08);
                    utterance.rate = nativeRate;
                    window.speechSynthesis.speak(utterance);
                }
            }
        } catch(e) {}
    }

    function injectActivationBanner() {
        if (isHTA) return; // Skip in HTA/IE
        if (document.getElementById("accBrowserActivationBanner")) return;
        
        var banner = document.createElement("div");
        banner.id = "accBrowserActivationBanner";
        banner.className = "acc-activation-banner";
        banner.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; background: #1e1c2c; border-bottom: 3px solid #ff6b00; box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 1000000; display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; box-sizing: border-box; font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; color: #ffffff; transition: all 0.4s ease; opacity: 1; transform: translateY(0);";
        
        banner.innerHTML = 
            '<div class="acc-activation-content" style="display: flex; align-items: center; gap: 12px;">' +
            '  <span class="acc-activation-icon" style="font-size: 20px;">🔊</span>' +
            '  <span class="acc-activation-text" style="font-size: 13px; line-height: 1.4; color: #ffffff;"><b>Sintesi Vocale Attiva:</b> Fai clic in un punto qualsiasi della pagina per sbloccare l\'audio e ascoltare i testi al passaggio del mouse.</span>' +
            '</div>' +
            '<button class="acc-activation-btn" onclick="window.unlockSpeechExplicit()" style="background: #ff6b00; border: none; color: #000000; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 18px; border-radius: 20px; cursor: pointer; box-shadow: 0 4px 10px rgba(255, 107, 0, 0.3);">Abilita Audio</button>';
            
        document.body.insertBefore(banner, document.body.firstChild);
    }

    function hideActivationBanner() {
        var banner = document.getElementById("accBrowserActivationBanner");
        if (banner) {
            banner.className = "acc-activation-banner hidden";
            setTimeout(function() {
                if (banner && banner.parentNode) {
                    banner.parentNode.removeChild(banner);
                }
            }, 500);
        }
    }

    function makeElementsFocusable() {
        try {
            var isGuidePage = /guida|installazione|manuale/i.test(window.location.pathname) || 
                              /guida|installazione|manuale/i.test(document.title) ||
                              (document.querySelector("h1") && /guida|installazione|manuale/i.test(document.querySelector("h1").innerText));
            if (!isGuidePage) return;

            var selectors = ["h1", "h2", "h3", "h4", "p", "li", "img", "td", "th", ".pro-tip", ".code-box"];
            var els = document.querySelectorAll(selectors.join(", "));
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                var tag = el.tagName.toLowerCase();
                
                if (tag === "img") {
                    var parentNode = el.parentNode;
                    var isInsideInteractive = false;
                    while (parentNode && parentNode !== document.body) {
                        var pTag = parentNode.tagName ? parentNode.tagName.toLowerCase() : "";
                        if (pTag === "button" || pTag === "a" || parentNode.getAttribute("tabindex") !== null || parentNode.onclick) {
                            isInsideInteractive = true;
                            break;
                        }
                        parentNode = parentNode.parentNode;
                    }
                    if (isInsideInteractive) continue;
                }
                
                if (el.getAttribute("tabindex") === null) {
                    el.setAttribute("tabindex", "0");
                }
            }
        } catch(e) {}
    }

    // 9. Startup Initialisation
    function initAccessibility() {
        makeElementsFocusable();
        // Apply Contrast and Zoom on load
        
        // Iniezione dinamica del controllo per ricaricare la maschera al logo sulla barra superiore
        try {
            var topBar = document.querySelector(".danea-top-black-bar");
            if (topBar) {
                var img = topBar.querySelector("img");
                if (img) {
                    // Imposta il gestore click per ricaricare la pagina se non ne ha già uno
                    if (!img.onclick && !img.getAttribute("onclick")) {
                        img.onclick = function() { window.location.reload(); };
                    }
                    // Aggiunge il titolo descrittivo per l'hover tooltip
                    if (!img.title) {
                        img.setAttribute("title", "Ricarica Maschera");
                    }
                    // Applica la classe per le micro-animazioni premium
                    if (img.className.indexOf("refresh-logo-btn") === -1) {
                        img.className = (img.className ? img.className + " " : "") + "refresh-logo-btn";
                    }
                    img.style.cursor = "pointer";
                    
                    // Iniezione dinamica degli stili per .refresh-logo-btn se non già definiti
                    var styleId = "dynamic-refresh-logo-btn-style";
                    if (!document.getElementById(styleId)) {
                        var style = document.createElement("style");
                        style.id = styleId;
                        style.innerHTML = 
                            ".refresh-logo-btn {\n" +
                            "    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s !important;\n" +
                            "    cursor: pointer !important;\n" +
                            "}\n" +
                            ".refresh-logo-btn:hover {\n" +
                            "    transform: scale(1.18) rotate(15deg) !important;\n" +
                            "    filter: drop-shadow(0 0 10px rgba(6, 182, 212, 0.7)) !important;\n" +
                            "}\n" +
                            ".refresh-logo-btn:active {\n" +
                            "    transform: scale(0.9) rotate(360deg) !important;\n" +
                            "    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) !important;\n" +
                            "}";
                        document.head.appendChild(style);
                    }
                }
            }
        } catch(e) {}
        // Iniezione Screensaver Globale o integrazione logo AN su quello esistente
        var imgPath = "assets/img/logo_nicolodi_circular.png";
        if (isHTA && fso) {
            try {
                if (accDir.indexOf("File_Sistema") === -1) {
                    imgPath = accDir + "File_Sistema\\assets\\img\\logo_nicolodi_circular.png";
                } else {
                    var parts = accDir.split("File_Sistema");
                    imgPath = parts[0] + "File_Sistema\\assets\\img\\logo_nicolodi_circular.png";
                }
            } catch(exPath) {}
        } else {
            if (window.location.pathname.indexOf("App_Mobile") !== -1) {
                imgPath = "../assets/img/logo_nicolodi_circular.png";
            }
        }

        // Stili per il logo del screensaver con animazione pulsante premium
        var ssLogoStyleId = "acc-ss-logo-style";
        if (!document.getElementById(ssLogoStyleId)) {
            var ssLogoStyle = document.createElement("style");
            ssLogoStyle.id = ssLogoStyleId;
            ssLogoStyle.innerHTML = 
                ".ss-logo-acc { width: 180px; height: 180px; margin-bottom: 30px; display: block; margin-left: auto; margin-right: auto; border-radius: 50%; object-fit: cover; border: none; filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.6)); animation: ssPulse 3s ease-in-out infinite; }\n" +
                "@keyframes ssPulse {\n" +
                "    0% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.4)); }\n" +
                "    50% { transform: scale(1.05); filter: drop-shadow(0 0 25px rgba(212, 175, 55, 0.8)); }\n" +
                "    100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.4)); }\n" +
                "}\n";
            document.head.appendChild(ssLogoStyle);
        }

        // Iniezione su screensaver locale se presente
        try {
            var localSS = document.getElementById("screensaver");
            if (localSS) {
                var localContent = localSS.querySelector(".screensaver-content") || localSS;
                if (localContent && !localContent.querySelector(".ss-logo-acc")) {
                    var localLogo = document.createElement("img");
                    localLogo.src = imgPath;
                    localLogo.className = "ss-logo-acc";
                    localLogo.alt = "Logo AN";
                    localContent.insertBefore(localLogo, localContent.firstChild);
                }
            }
        } catch(eLocalSS) {}

        if (!document.getElementById("screensaver") && !document.getElementById("accScreensaver")) {
            var style = document.createElement("style");
            style.innerHTML = "#accScreensaver { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: radial-gradient(circle, #081024 0%, #000000 100%); z-index: 100000; display: none; flex-direction: column; align-items: center; justify-content: center; color: #d4af37; cursor: none; font-family: 'Segoe UI', Arial, sans-serif; overflow: hidden; }\n" +
                              ".ss-aurora { position: absolute; width: 400px; height: 400px; border-radius: 50%; z-index: 1; pointer-events: none; opacity: 0.08; filter: blur(100px); }\n" +
                              ".ss-aurora-1 { background: #0077c2; top: 15%; left: 15%; animation: auroraMove1 22s infinite alternate ease-in-out; }\n" +
                              ".ss-aurora-2 { background: #d4af37; bottom: 15%; right: 15%; animation: auroraMove2 28s infinite alternate ease-in-out; }\n" +
                              "@keyframes auroraMove1 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(150px, 80px) scale(1.3); } }\n" +
                              "@keyframes auroraMove2 { 0% { transform: translate(0, 0) scale(1.3); } 100% { transform: translate(-150px, -80px) scale(0.9); } }\n" +
                              ".ss-clock-acc { font-size: 150px; font-weight: 800; color: #e2c054; text-shadow: 0 0 45px rgba(212, 175, 55, 0.45); font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: -5px; line-height: 1; animation: clockGlowPulse 4s ease-in-out infinite alternate; }\n" +
                              "@keyframes clockGlowPulse { 0% { text-shadow: 0 0 30px rgba(212, 175, 55, 0.3); } 100% { text-shadow: 0 0 60px rgba(212, 175, 55, 0.8); } }\n" +
                              ".ss-date-acc { font-size: 24px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; margin-top: 10px; }\n" +
                              ".ss-cards-container { display: flex; gap: 24px; margin-top: 45px; justify-content: center; align-items: center; z-index: 10; }\n" +
                              ".ss-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.15); padding: 12px 24px; border-radius: 14px; box-shadow: 0 10px 30px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: flex; align-items: center; gap: 12px; color: #cbd5e1; font-family: 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; min-width: 190px; transition: transform 0.3s ease, border-color 0.3s ease; }\n" +
                              ".ss-card:hover { transform: translateY(-2px); border-color: rgba(212, 175, 55, 0.4); box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5), 0 0 15px rgba(212, 175, 55, 0.1); }\n" +
                              ".ss-card-icon { font-size: 22px; color: #d4af37; text-shadow: 0 0 10px rgba(212, 175, 55, 0.3); }\n" +
                              ".ss-card-label { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 2px; }\n" +
                              ".ss-card-title { font-size: 9px; color: #94a3b8; letter-spacing: 1px; font-weight: 800; }\n" +
                              ".ss-card-val { font-size: 16px; font-weight: 800; color: #ffffff; text-shadow: 0 0 8px rgba(255, 255, 255, 0.2); }";
            document.head.appendChild(style);
            
            var ssDiv = document.createElement("div");
            ssDiv.id = "accScreensaver";
            ssDiv.innerHTML = '<div class="ss-aurora ss-aurora-1"></div>' +
                              '<div class="ss-aurora ss-aurora-2"></div>' +
                              '<canvas id="ssCanvas_acc" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:2;"></canvas>' +
                              '<div class="screensaver-content" style="text-align: center; position: relative; z-index: 10;">' +
                              '  <img src="' + imgPath + '" class="ss-logo-acc" alt="Logo AN">' +
                              '  <div id="ssClock_acc" class="ss-clock-acc">00:00</div>' +
                              '  <div id="ssDate_acc" class="ss-date-acc">Lunedì 1 Gennaio 2026</div>' +
                              '  <div class="ss-cards-container">' +
                              '    <div class="ss-card">' +
                              '      <span class="ss-card-icon">📦</span>' +
                              '      <div class="ss-card-label">' +
                              '        <span class="ss-card-title">Consegne Oggi</span>' +
                              '        <span class="ss-card-val" id="ssConsegneOggi_acc">0</span>' +
                              '      </div>' +
                              '    </div>' +
                              '    <div class="ss-card">' +
                              '      <span class="ss-card-icon">⛅</span>' +
                              '      <div class="ss-card-label">' +
                              '        <span class="ss-card-title">Meteo Bari</span>' +
                              '        <span class="ss-card-val" id="ssMeteo_acc">Bari --°C</span>' +
                              '      </div>' +
                              '    </div>' +
                              '  </div>' +
                              '</div>';
            addEvent(ssDiv, "mousemove", ResetScreensaver);
            document.body.appendChild(ssDiv);
            
            addEvent(document, "mousemove", ResetScreensaver);
            addEvent(document, "mousedown", ResetScreensaver);
            addEvent(document, "keydown", GestisciKeydownSS_acc);
            
            ResetScreensaver();
        }

        if (!isHTA && window.getSpeechEnabledSetting()) {
            injectActivationBanner();
            addEvent(document, "click", unlockSpeech);
            addEvent(document, "keydown", unlockSpeech);
        }

        var isContrast = window.getHighContrastSetting();
        var zoomLvl = window.getZoomSetting();
        var isSpeech = window.getSpeechEnabledSetting();
        var isRuler = window.getRulerSetting();
        
        window.ApplyContrast(isContrast);
        window.ApplyZoom(zoomLvl);
        window.ToggleReadingRuler(isRuler, true);

        if (isHTA && isSpeech) {
            var isGuidePage = /guida|installazione|manuale/i.test(window.location.pathname) || 
                              /guida|installazione|manuale/i.test(document.title) ||
                              (document.querySelector("h1") && /guida|installazione|manuale/i.test(document.querySelector("h1").innerText));
            var pageTitle = document.title || "";
            var h1 = document.querySelector("h1");
            if (h1) pageTitle = h1.innerText;
            
            var welcomeMsg = "Lettura vocale avviata. " + pageTitle;
            if (isGuidePage) {
                welcomeMsg += ". Premi il tasto Tab per scorrere i contenuti con la tastiera, o passa il mouse.";
            }
            window.SpeakText(welcomeMsg);
        }

        // Inject widget on pages that don't have accessibility control checkboxes
        injectFloatingWidget();
        
        // Inject the universal Command Palette overlay
        injectCommandPalette();

        // Update checkbox and menu states after loading elements
        var chkSpeech = document.getElementById('chkSpeech') || document.getElementById('chkSpeech_acc');
        if (chkSpeech) chkSpeech.checked = isSpeech;

        var chkContrast = document.getElementById('chkContrast') || document.getElementById('chkContrast_acc');
        if (chkContrast) chkContrast.checked = isContrast;

        var chkRuler = document.getElementById('chkRuler_acc');
        if (chkRuler) chkRuler.checked = isRuler;

        var rngRate = document.getElementById('rngRate');
        if (rngRate) rngRate.value = window.getSpeechRateSetting();
        var rngRateAcc = document.getElementById('rngRate_acc');
        if (rngRateAcc) rngRateAcc.value = window.getSpeechRateSetting();

        var menuLnk = document.getElementById('menuToggleSpeech');
        if (menuLnk) {
            if (window.location.pathname.toLowerCase().indexOf("anagrafica.html") > -1) {
                menuLnk.innerHTML = isSpeech ? 
                    "<i class='fa fa-volume-off'></i> DISATTIVA SINTESI <small>Ctrl+V</small>" : 
                    "<i class='fa fa-volume-up'></i> ATTIVA SINTESI <small>Ctrl+V</small>";
            } else {
                var shortcutClass = (window.location.pathname.toLowerCase().indexOf("consegne.html") > -1 || window.location.pathname.toLowerCase().indexOf("storico.html") > -1) ? "shortcut" : "menu-shortcut";
                menuLnk.innerHTML = isSpeech ? 
                    "Disattiva Sintesi Vocale <span class='" + shortcutClass + "'>Ctrl+V</span>" : 
                    "Attiva Sintesi Vocale <span class='" + shortcutClass + "'>Ctrl+V</span>";
            }
        }

        window.ApplyZoom(zoomLvl); // Re-run to light up active buttons

        if (isHTA) {
            writeSettingsJS();
        }

        // 10. Focus & Hover Event Listeners registration
        addEvent(document, "focusin", function(e) {
            e = e || window.event;
            var target = e.target || e.srcElement;
            window.ReadElement(target, "focus");
        });

        var lastHoveredEl = null;
        addEvent(document, "mouseover", function(e) {
            e = e || window.event;
            var target = e.target || e.srcElement;
            if (target === lastHoveredEl) return;
            lastHoveredEl = target;
            window.ReadElement(target, "hover");
        });

        // 11. Keypress handler for tabindex element activation
        addEvent(document, "keyup", function(e) {
            e = e || window.event;
            if (e.keyCode === 13) {
                var el = document.activeElement;
                if (el && el.click && el.tagName.toLowerCase() !== "input" && el.tagName.toLowerCase() !== "textarea" && el.tagName.toLowerCase() !== "select") {
                    el.click();
                }
            }
        });

        // 12. Global keyboard shortcut listener (A or Ctrl+V for Speech, Ctrl+H for High Contrast, Ctrl+K for Palette)
        addEvent(document, "keydown", function(e) {
            e = e || window.event;
            var keyCode = e.keyCode || e.which;
            var activeEl = document.activeElement;
            var isInput = activeEl && (
                activeEl.tagName.toLowerCase() === "input" || 
                activeEl.tagName.toLowerCase() === "textarea" || 
                activeEl.isContentEditable
            );


            if (e.ctrlKey) {
                if (keyCode === 86) { // 'V' key for "Voce"
                    if (!isInput) {
                        if (e.preventDefault) e.preventDefault();
                        else e.returnValue = false;
                        window.ToggleSpeechShortcut();
                    }
                } else if (keyCode === 72) { // 'H' key for Contrast
                    if (!isInput) {
                        if (e.preventDefault) e.preventDefault();
                        else e.returnValue = false;
                        window.ToggleHighContrastShortcut();
                    }
                } else if (keyCode === 75) { // 'K' key for Command Palette
                    if (e.preventDefault) e.preventDefault();
                    else e.returnValue = false;
                    var overlay = document.getElementById("cmdPaletteOverlay");
                    if (overlay) {
                        if (overlay.style.display === "none") {
                            window.openCommandPalette();
                        } else {
                            window.closeCommandPalette();
                        }
                    }
                } else if (keyCode === 38) { // Ctrl+Up to increase speech rate
                    if (e.preventDefault) e.preventDefault();
                    else e.returnValue = false;
                    var currentRate = window.getSpeechRateSetting();
                    if (currentRate < 10) {
                        window.SetSpeechRate(currentRate + 1);
                    }
                } else if (keyCode === 40) { // Ctrl+Down to decrease speech rate
                    if (e.preventDefault) e.preventDefault();
                    else e.returnValue = false;
                    var currentRate = window.getSpeechRateSetting();
                    if (currentRate > -10) {
                        window.SetSpeechRate(currentRate - 1);
                    }
                }
            }
        });
    }

    function loadAndInit() {
        if (!isHTA) {
            var script = document.createElement("script");
            script.src = "../accessibility_settings.js";
            script.onload = function() {
                initAccessibility();
            };
            script.onerror = function() {
                initAccessibility();
            };
            document.head.appendChild(script);
        } else {
            initAccessibility();
        }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        loadAndInit();
    } else {
        addEvent(window, "load", loadAndInit);
    }
})();
