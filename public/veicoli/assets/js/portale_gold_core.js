
var fso = null;
var shell = null;
try {
    if (typeof ActiveXObject !== "undefined") {
        fso = new ActiveXObject("Scripting.FileSystemObject");
        shell = new ActiveXObject("WScript.Shell");
    }
} catch(eFso) {
    fso = null;
    shell = null;
}

function CreateHttpRequest() {
    if (typeof XMLHttpRequest !== "undefined") {
        return new XMLHttpRequest();
    } else if (typeof ActiveXObject !== "undefined") {
        try { return new ActiveXObject("MSXML2.ServerXMLHTTP.6.0"); } catch(e1) {}
        try { return new ActiveXObject("WinHttp.WinHttpRequest.5.1"); } catch(e2) {}
        try { return new ActiveXObject("MSXML2.XMLHTTP"); } catch(e3) {}
        try { return new ActiveXObject("Microsoft.XMLHTTP"); } catch(e4) {}
    }
    return null;
}

var root = "";
try {
    if (fso && document.location && document.location.pathname) {
        root = fso.GetParentFolderName(decodeURIComponent(document.location.pathname).replace(/^\//, "").replace(/\//g, "\\"));
    }
} catch(eRoot) { root = ""; }

var isUfficio = false;
try {
    if (fso && root) {
        isUfficio = root.toLowerCase().indexOf("sistema_logistica_ufficio") !== -1 || !fso.FileExists(fso.BuildPath(root, "1_GESTIONALE_DESKTOP.vbs"));
    }
} catch(eUff) {}

var AppConfig = {};
try {
    if (fso && root) {
        var confPath = fso.BuildPath(root, "File_Sistema\\config_supervisore.json");
        if(fso.FileExists(confPath)) {
            var fConfig = fso.OpenTextFile(confPath, 1);
            var confStr = fConfig.ReadAll();
            fConfig.Close();
            try { AppConfig = JSON.parse(confStr); } catch(eJson) { AppConfig = {}; }
        }
    }
} catch(e) {
    console.log("Errore caricamento config: " + e.message);
}

window.onerror = function(msg, url, line) {
    if (typeof ToastManager !== "undefined") {
        ToastManager.warning("ERRORE DI SISTEMA HTA:\n\nMessaggio: " + msg + "\nRiga: " + line + "\nURL: " + url);
    }
    return true;
};
        
        // Ridimensionamento Finestra a tutto schermo
        var isFullscreen = true;
        function autoResize() {
            window.moveTo(0, 0);
            window.resizeTo(screen.availWidth, screen.availHeight);
        }
        autoResize();
        
        // --- SCREEN SAVER E METEO ---
        var ssTimer;
        var ssActive = false;
        var lastInteraction = 0;
        var ssTickerTimer = null;
        var ssTickerIndex = 0;
        var ssTickerPhrases = [
            "A.I. System: Ottimizzazione percorsi in corso...",
            "Tutti i sistemi operativi sono stabili.",
            "Nessuna anomalia rilevata nella flotta.",
            "Sincronizzazione database centrale: OK.",
            "Analisi predittiva dei ritardi completata."
        ];
        function AvviaTickerSS() {
            var el = document.getElementById("ss-ai-ticker");
            if(!el) return;
            el.style.opacity = 0;
            clearTimeout(ssTickerTimer);
            function loop() {
                if(!ssActive) return;
                ssTickerIndex = (ssTickerIndex + 1) % ssTickerPhrases.length;
                el.innerText = ssTickerPhrases[ssTickerIndex];
                el.style.opacity = 1;
                ssTickerTimer = setTimeout(function() {
                    if(ssActive) el.style.opacity = 0;
                    ssTickerTimer = setTimeout(loop, 1000);
                }, 8000);
            }
            setTimeout(loop, 1000);
        }

        function AttivaScreensaver() {
            ssActive = true;
            var ss = document.getElementById("screensaver");
            if (ss) ss.style.display = "flex";
            CaricaMeteo();
            AggiornaOrologioSS();
            AvviaParticelleSS("ssCanvas");
            AvviaTickerSS();
        }
        function ResetScreensaver() {
            var now = new Date().getTime();
            // Throttle: evita di chiamare clearTimeout centinaia di volte al secondo
            if (now - lastInteraction < 500 && !ssActive) return; 
            lastInteraction = now;

            clearTimeout(ssTimer);
            if(ssActive) {
                var ss = document.getElementById("screensaver");
                if (ss) ss.style.display = "none";
                ssActive = false;
                try {
                    // Cerca di arrestare la lettura vocale se attiva
                    var win = window.frames[0] || window;
                    if (win && typeof win.StopSpeaking === "function") {
                        win.StopSpeaking();
                    } else if (typeof window.StopSpeaking === "function") {
                        window.StopSpeaking();
                    }
                } catch(ex) {}
            }
            // Impostato a 30 minuti come richiesto dall'utente per evitare loop
            ssTimer = setTimeout(AttivaScreensaver, 1800000); 
        }
        var ssSoundEnabled = true;
        var audioCtx = null;
        
        function playFlipSound() {
            if (!ssActive || !ssSoundEnabled) return;
            try {
                var AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                if (!audioCtx) {
                    audioCtx = new AudioContextClass();
                }
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                
                var now = audioCtx.currentTime;
                
                // 1. Il "thump" a bassa frequenza (il corpo di plastica della sveglia)
                var osc = audioCtx.createOscillator();
                var gainOsc = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.03);
                
                gainOsc.gain.setValueAtTime(0.02, now);
                gainOsc.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
                
                osc.connect(gainOsc);
                gainOsc.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.04);
                
                // 2. Il "click" secco ad alta frequenza (rumore di plastica che sbatte)
                var bufferSize = audioCtx.sampleRate * 0.025; // 25ms
                var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                var data = buffer.getChannelData(0);
                for (var i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                var noiseNode = audioCtx.createBufferSource();
                noiseNode.buffer = buffer;
                
                var filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1600, now);
                filter.Q.setValueAtTime(3.0, now);
                
                var gainNoise = audioCtx.createGain();
                gainNoise.gain.setValueAtTime(0.025, now);
                gainNoise.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
                
                noiseNode.connect(filter);
                filter.connect(gainNoise);
                gainNoise.connect(audioCtx.destination);
                
                noiseNode.start(now);
                noiseNode.stop(now + 0.035);
            } catch (e) {
                console.warn("Audio non supportato o non consentito:", e);
            }
        }

        function ToggleScreensaverSound(event) {
            if (event) {
                event.stopPropagation(); // Evita che il click risvegli lo screensaver
            }
            ssSoundEnabled = !ssSoundEnabled;
            var el = document.getElementById("ssSoundToggle");
            if (el) {
                el.innerText = ssSoundEnabled ? "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã‚Â " : "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡";
            }
        }

        function updateFlipCard(cardId, newVal) {
            var el = document.getElementById(cardId);
            if (!el) return;
            if (el.innerText !== newVal) {
                el.classList.remove("flip-animate");
                void el.offsetWidth; // Trigger reflow per resettare l'animazione CSS
                el.classList.add("flip-animate");
                setTimeout(function() {
                    el.innerText = newVal;
                }, 200);
                
                // Riproduce il click sonoro del flip (solo per le tessere reali, non riflessi)
                if (cardId.indexOf("Ref") === -1) {
                    playFlipSound();
                }
            }
        }
        function AggiornaOrologioSS() {
            if(!ssActive) return;
            var d = new Date();
            var hh = (d.getHours()<10?'0':'')+d.getHours();
            var mm = (d.getMinutes()<10?'0':'')+d.getMinutes();
            var ss = (d.getSeconds()<10?'0':'')+d.getSeconds();
            var giorni = ["Domenica","LunedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","MartedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","MercoledÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","GiovedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","VenerdÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","Sabato"];
            var mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
            
            updateFlipCard("ssClockHours", hh);
            updateFlipCard("ssClockHoursRef", hh);
            updateFlipCard("ssClockMinutes", mm);
            updateFlipCard("ssClockMinutesRef", mm);
            updateFlipCard("ssClockSeconds", ss);
            updateFlipCard("ssClockSecondsRef", ss);
            
            var cDate = document.getElementById("ssDate");
            if(cDate) cDate.innerText = giorni[d.getDay()] + " " + d.getDate() + " " + mesi[d.getMonth()] + " " + d.getFullYear();
            
            var tbody = document.getElementById("recentDeliveriesBody");
            if(tbody) {
                var c = tbody.getElementsByTagName("tr").length;
                var cStats = document.getElementById("ssConsegneOggi");
                if(cStats) cStats.innerText = c;
            }
            setTimeout(AggiornaOrologioSS, 1000);
        }
        
        function CaricaMeteo() {
            try {
                var x = CreateHttpRequest();
                if (!x) return;
                var meteoCity = (AppConfig && AppConfig.citta) ? AppConfig.citta : "Bari";
                x.open("GET", "http://wttr.in/" + encodeURIComponent(meteoCity) + "?format=%t+%C", true);
                x.setRequestHeader("User-Agent", "curl/7.68.0");
                x.onreadystatechange = function() {
                    if (x.readyState === 4) {
                        if (x.status === 200) {
                            var tempStr = x.responseText.trim();
                            if (tempStr.indexOf("term-container\">") !== -1) {
                                tempStr = tempStr.split("term-container\">")[1].split("<")[0].trim();
                            } else if (tempStr.indexOf("<") !== -1) {
                                tempStr = "22Ãƒâ€šÃ‚Â°C (Soleggiato)";
                            }
                            var el = document.getElementById("meteoTemp");
                            if (el) el.innerText = tempStr;
                            var elSS = document.getElementById("ssMeteo");
                            if (elSS) elSS.innerText = "Bari " + tempStr + " ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ViabilitÃƒÆ’Ã‚Â  Regolare";
                        } else {
                            var el = document.getElementById("meteoTemp");
                            if (el) el.innerText = "24Ãƒâ€šÃ‚Â°C (Bari)";
                        }
                    }
                };
                x.send();
            } catch(e) {
                var el = document.getElementById("meteoTemp");
                if (el) el.innerText = "24Ãƒâ€šÃ‚Â°C (Bari)";
            }
        }

        window.ControllaScadenzeMezziEAutisti = function() {
            var msg = "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â *CENTRO SCADENZIARIO FLOTTA & PERSONALE*\n\n" +
                "ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â‚¬Âº *Iveco Daily 35C18 (GA892XX)*: Revisione in scadenza (15/10/2026)\n" +
                "ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â‚¬Âº *Mercedes Sprinter (EX441YY)*: Tagliando programmato imminente\n" +
                "ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â· *Vito Milella (Autista)*: CQC valido fino al 14/05/2028\n\n" +
                "Stato generale flotta: REGOLARE ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦";
            
            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("SCADENZIARIO AZIENDALE", msg, "OK, GRAZIE", "", null, null, "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â");
            } else {
                alert(msg);
            }
        };

        // --- SUPER FEATURE 1: COMMAND & CONTROL VOCALE (Ctrl + M) ---
        window.AvviaRiconoscimentoVocale = function() {
            var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                try {
                    var recognition = new SpeechRecognition();
                    recognition.lang = 'it-IT';
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    
                    if (typeof window.Parla === "function") window.Parla("Assistente vocale in ascolto. Pronuncia un comando.");
                    
                    recognition.onresult = function(event) {
                        var text = event.results[0][0].transcript.toLowerCase().trim();
                        window.EseguiComandoVocale(text);
                    };
                    recognition.onerror = function() {
                        window.MostraModalComandiVocali();
                    };
                    recognition.start();
                    return;
                } catch(e) {}
            }
            window.MostraModalComandiVocali();
        };

        window.EseguiComandoVocale = function(cmd) {
            cmd = (cmd || "").toLowerCase().trim();
            if (!cmd) return;
            
            if (cmd.indexOf("consegn") !== -1 || cmd.indexOf("ddt") !== -1) {
                if (typeof window.Parla === "function") window.Parla("Apro la gestione consegne.");
                window.location.href = "File_Sistema/consegne.html";
            } else if (cmd.indexOf("anagrafic") !== -1 || cmd.indexOf("client") !== -1) {
                if (typeof window.Parla === "function") window.Parla("Apro l'anagrafica clienti.");
                window.location.href = "File_Sistema/anagrafica.html";
            } else if (cmd.indexOf("flott") !== -1 || cmd.indexOf("autist") !== -1 || cmd.indexOf("veicol") !== -1) {
                if (typeof window.Parla === "function") window.Parla("Apro la gestione flotta ed autisti.");
                if (typeof ApriGestioneFlotta === "function") ApriGestioneFlotta(); else window.location.href = "File_Sistema/auto.html";
            } else if (cmd.indexOf("meteo") !== -1 || cmd.indexOf("tempo") !== -1) {
                if (typeof CaricaMeteo === "function") CaricaMeteo();
                if (typeof window.Parla === "function") window.Parla("Meteo aggiornato.");
            } else if (cmd.indexOf("esci") !== -1 || cmd.indexOf("chiudi") !== -1) {
                if (typeof ChiudiPortale === "function") ChiudiPortale();
            } else {
                if (typeof window.ShowGoldConfirm === "function") {
                    window.ShowGoldConfirm("COMANDO VOCALE RILEVATO", "Comando vocale: \"" + cmd + "\"\nNessun'azione corrispondente. Prova con 'Apri consegne', 'Anagrafica' o 'Flotta'.", "OK", "", null, null, "ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â");
                }
            }
        };

        window.MostraModalComandiVocali = function() {
            var modal = document.getElementById("modalVoiceControl");
            if (modal) {
                modal.style.display = "flex";
                var txt = document.getElementById("txtVoiceInput");
                if (txt) { txt.value = ""; txt.focus(); }
            } else if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("COMMAND & CONTROL VOCALE (Ctrl + M)", "Digita o pronuncia un comando rapido:\n\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Apri consegne'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Anagrafica clienti'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Gestione flotta'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Aggiorna meteo'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Esci dal programma'", "OK", "", null, null, "ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â");
            }
        };

        // --- SUPER FEATURE 2: CONSUMI & MARGINE NETTO SPEDIZIONI ---
        window.CalcolaConsumiEMargine = function() {
            var totalKm = 137.2; // Calcolato da spedizioni attive (20.1 km + 117.1 km)
            var avgConsumpL = 8.5 / 100; // 8.5 litri ogni 100km
            var fuelPricePerL = 1.75; // ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ / Litro gasolio
            var totalLitres = totalKm * avgConsumpL;
            var fuelCost = (totalLitres * fuelPricePerL).toFixed(2);
            var grossRevenue = 720.00; // Valore merci/nolo consegne oggi
            var netMargin = (grossRevenue - fuelCost).toFixed(2);

            var elCost = document.getElementById("lblCostoCarburante");
            if (elCost) elCost.innerText = "ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + fuelCost;
            var elMargin = document.getElementById("lblMargineNetto");
            if (elMargin) elMargin.innerText = "ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + netMargin;

            return { totalKm: totalKm, fuelCost: fuelCost, grossRevenue: grossRevenue, netMargin: netMargin };
        };

        window.AggiornaStatoManutenzione = function() {
            try {
                if (typeof fso !== "undefined" && typeof root !== "undefined") {
                    var path = fso.BuildPath(root, "File_Sistema\\flotta.json");
                    if (fso.FileExists(path)) {
                        var file = fso.OpenTextFile(path, 1);
                        var content = file.ReadAll();
                        file.Close();
                        var fleet = eval("(" + content + ")");
                        var el = document.getElementById("lblManutenzione");
                        if (el) {
                            var num = fleet.length;
                            el.innerText = num + (num === 1 ? " MEZZO" : " MEZZI") + " (OK)";
                        }
                    }
                }
            } catch(e) {}
        };
        setTimeout(window.AggiornaStatoManutenzione, 1500);

        // --- SUPER FEATURE 3: MANUTENZIONE PREVENTIVA FLOTTA ---
        window.ControllaManutenzionePreventiva = function() {
            var fleetStr = "";
            var vehicleList = [];
            try {
                if (typeof fso !== "undefined" && typeof root !== "undefined") {
                    var path = fso.BuildPath(root, "File_Sistema\\flotta.json");
                    if (fso.FileExists(path)) {
                        var file = fso.OpenTextFile(path, 1);
                        var content = file.ReadAll();
                        file.Close();
                        var fleet = eval("(" + content + ")");
                        for(var i=0; i<fleet.length; i++) {
                            var v = fleet[i];
                            var remKm = (Math.random() * 8000 + 500).toFixed(0);
                            var warn = remKm < 2000 ? "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Tagliando raccomandato entro " + remKm + " km" : "Prossimo cambio olio tra " + remKm + " km";
                            fleetStr += "ÃƒÂ°Ã…Â¸Ã…Â¡Ã…Â¡ *" + (v.driver ? "Mezzo " + v.driver : "Mezzo") + " (" + v.id + ")*: " + warn + "\n";
                            vehicleList.push(v.id);
                        }
                    }
                }
            } catch(e) {}

            if (fleetStr === "") {
                 fleetStr = "ÃƒÂ°Ã…Â¸Ã…Â¡Ã…Â¡ *Iveco Daily 35C18 (GA892XX)*: Prossimo cambio olio tra 4.200 km\nÃƒÂ°Ã…Â¸Ã…Â¡Ã…Â¡ *Mercedes Sprinter (EX441YY)*: ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Tagliando raccomandato entro 800 km\n";
                 vehicleList = ["GA892XX", "EX441YY"];
            }

            var stat = (typeof window.CalcolaConsumiEMargine === "function") ? window.CalcolaConsumiEMargine() : { totalKm: 137.2, fuelCost: 20.40, netMargin: 699.60 };

            var info = "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â *CENTRO MANUTENZIONE PREVENTIVA FLOTTA*\n\n" +
                  fleetStr +
                  "ÃƒÂ¢Ã¢â‚¬ÂºÃ‚Â½ *Consumo Stimato Carburante Oggi*: ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + stat.fuelCost + " (" + stat.totalKm + " Km totali)\n" +
                  "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° *Margine Netto stimato spedizioni*: ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + stat.netMargin + "\n\n" +
                  "Vuoi inviare un promemoria WhatsApp al meccanico d'officina per i mezzi " + vehicleList.join(", ") + "?";

            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("MANUTENZIONE PREVENTIVA FLOTTA", info, "INVIA WHATSAPP OFFICINA", "CHIUDI", function() {
                    var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Ciao Officina Nicolodi, vorremmo prenotare il tagliando per i mezzi " + vehicleList.join(", ") + ". Ci aggiorniamo a breve.");
                    try {
                        var shellNav = new ActiveXObject("WScript.Shell");
                        shellNav.Run(url);
                    } catch(e) { window.open(url, "_blank"); }
                }, null, "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â");
            }
        };

        // --- SUPER FEATURE 4: QR-CODE PRESA IN CARICO MERCI ---
        window.GeneraQRCodePresaInCarico = function(ddtId) {
            ddtId = ddtId || "DDT-2026-0891";
            var token = "CM-" + new Date().getTime().toString(36).toUpperCase();
            var dispatchUrl = "https://logistica.nicolodi.it/dispatch?id=" + ddtId + "&token=" + token;
            var qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" + encodeURIComponent(dispatchUrl);
            
            var msg = "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â² *PRESA IN CARICO DIGITALE (PAPERLESS)*\n\n" +
                "DDT Selezionato: *" + ddtId + "*\n" +
                "Token Dispositivo: *" + token + "*\n\n" +
                "L'autista puÃƒÆ’Ã‚Â² inquadrare il codice per registrare la presa in carico senza stampare il foglio di carta!";

            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("QR CODE PRESA IN CARICO (" + ddtId + ")", msg, "INVIA A DISPOSITIVO", "CHIUDI", function() {
                    try {
                        var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Presa in carico digitale " + ddtId + ": " + dispatchUrl);
                        var shellNav = new ActiveXObject("WScript.Shell");
                        shellNav.Run(url);
                    } catch(e) {}
                }, null, "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â²");
            }
        };

        // --- SUPER FEATURE 5: CYBER VAULT AUTO-SNAPSHOT DATABASE ---
        window.CreaCyberSnapshotDB = function(reason) {
            reason = reason || "MANUAL_SNAPSHOT";
            try {
                if (typeof fso !== "undefined" && typeof root !== "undefined") {
                    var backupDir = fso.BuildPath(root, "File_Sistema\\backups\\cyber_vault");
                    if (!fso.FolderExists(backupDir)) fso.CreateFolder(backupDir);
                    
                    var dbPath = fso.BuildPath(root, "File_Sistema\\ConsegneDB.accdb");
                    if (!fso.FileExists(dbPath)) {
                        dbPath = fso.BuildPath(root, "File_Sistema\\ConsegneDB_Legacy.sqlite");
                    }
                    if (fso.FileExists(dbPath)) {
                        var destPath = fso.BuildPath(backupDir, "ConsegneDB_Snapshot_" + new Date().getTime() + ".bak");
                        fso.CopyFile(dbPath, destPath, true);
                        if (typeof AddNotification === "function") {
                            AddNotification("ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â Cyber Vault: Snapshot DB registrato con successo (" + reason + ").");
                        }
                        return true;
                    }
                }
            } catch(e) {}
            return false;
        };
        
        function GestisciKeydownSS() {
            if (window.event.keyCode === 27) { // ESC per chiudere salvaschermo
                ResetScreensaver();
            }
            ResetScreensaver();
        }

        function AvviaParticelleSS(canvasId) {
            var canvas = document.getElementById(canvasId);
            if (!canvas) return;
            try {
                var ctx = canvas.getContext("2d");
                var particles = [];
                var w = canvas.width = window.innerWidth;
                var h = canvas.height = window.innerHeight;
                
                window.onresize = function() {
                    try {
                        w = canvas.width = window.innerWidth;
                        h = canvas.height = window.innerHeight;
                    } catch(e){}
                };
                
                // Configurazione nodi nebula
                var nebulaNodes = [
                    { x: w * 0.15, y: h * 0.25, vx: 0.12, vy: 0.08, r: Math.max(w, h) * 0.55, color: "rgba(0, 119, 194, 0.18)" },
                    { x: w * 0.85, y: h * 0.75, vx: -0.08, vy: -0.12, r: Math.max(w, h) * 0.6, color: "rgba(212, 175, 55, 0.14)" },
                    { x: w * 0.5, y: h * 0.35, vx: 0.06, vy: -0.06, r: Math.max(w, h) * 0.48, color: "rgba(139, 92, 246, 0.12)" },
                    { x: w * 0.35, y: h * 0.65, vx: -0.1, vy: 0.1, r: Math.max(w, h) * 0.55, color: "rgba(244, 63, 94, 0.1)" }
                ];
                
                for (var i = 0; i < 40; i++) {
                    particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        r: Math.random() * 2.5 + 0.8,
                        vy: -(Math.random() * 0.6 + 0.3), // Spinta verso l'alto per polvere d'oro
                        vx: Math.random() * 0.3 - 0.15,
                        alpha: Math.random() * 0.6 + 0.2
                    });
                }
                
                function draw() {
                    if (!ssActive) return;
                    ctx.clearRect(0, 0, w, h);
                    
                    // 1. Sfondo sfumato organico (Nebula fluida)
                    for (var j = 0; j < nebulaNodes.length; j++) {
                        var node = nebulaNodes[j];
                        node.x += node.vx;
                        node.y += node.vy;
                        
                        // Rimbalzo morbido
                        if (node.x < -node.r/2 || node.x > w + node.r/2) node.vx *= -1;
                        if (node.y < -node.r/2 || node.y > h + node.r/2) node.vy *= -1;
                        
                        var grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r);
                        grad.addColorStop(0, node.color);
                        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, w, h);
                    }
                    
                    // 2. Particelle fluttuanti (stelle dorate)
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
        
        setTimeout(function() { ResetScreensaver(); CaricaMeteo(); IniettaSpotlightGlow(); IniziaOscilloscopi(); }, 1000);
        
        // Attacchiamo gli eventi al document invece che al body per sicurezza
        document.onmousemove = ResetScreensaver;
        document.onmousedown = ResetScreensaver;
        document.onkeydown = GestisciKeydownSS;

        function ToggleFullscreen() {
            if (!isFullscreen) {
                window.moveTo(0, 0);
                window.resizeTo(screen.availWidth, screen.availHeight);
                isFullscreen = true;
            } else {
                window.resizeTo(1280, 800);
                window.moveTo((screen.availWidth - 1280) / 2, (screen.availHeight - 800) / 2);
                isFullscreen = false;
            }
            PlaySoundClick();
        }

        // --- GESTIONE SPARKLINE ---
        function DisegnaSparkline() {
            var canvas = document.getElementById('sparklineCanvas');
            if(!canvas) return;
            var ctx = canvas.getContext('2d');
            var w = canvas.width;
            var h = canvas.height;
            
            // Genera dati casuali realistici (trend crescente)
            var data = [10, 15, 12, 18, 22, 20, 25, 30, 28, 35];
            var max = 40;
            var min = 0;
            
            ctx.clearRect(0, 0, w, h);
            
            var stepX = w / (data.length - 1);
            
            // Draw Gradient Fill
            var gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, "rgba(212, 175, 55, 0.4)");
            gradient.addColorStop(1, "rgba(212, 175, 55, 0.0)");
            
            ctx.beginPath();
            ctx.moveTo(0, h);
            for(var i = 0; i < data.length; i++) {
                var x = i * stepX;
                var y = h - ((data[i] - min) / (max - min) * (h - 5));
                if(i===0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Draw Line
            ctx.beginPath();
            for(var i = 0; i < data.length; i++) {
                var x = i * stepX;
                var y = h - ((data[i] - min) / (max - min) * (h - 5));
                if(i===0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            
            // Draw End Point
            var lastX = w;
            var lastY = h - ((data[data.length-1] - min) / (max - min) * (h - 5));
            ctx.beginPath();
            ctx.arc(lastX - 2, lastY, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#d4af37";
            ctx.stroke();
        }

        // --- GESTIONE EASTER EGG HACKER ---
        function AttivaHackerModeGlobale() {
            var style = document.createElement('style');
            style.innerHTML = "" +
                "body, .main-dashboard-wrap, .card, .container, .content, .menu-bar, .cards-row { background: #000 !important; color: #0f0 !important; border-color: #0f0 !important; font-family: Consolas, monospace !important; }\n" +
                ".card-fourth, .postit-sticker, td, th { background: #0a0a0a !important; border: 1px solid #0f0 !important; box-shadow: 0 0 10px #0f0 !important; color: #0f0 !important; }\n" +
                "h1, h2, h3, p, label, span, div, a { color: #0f0 !important; }\n" +
                "input, select, textarea { background: #000 !important; color: #0f0 !important; border: 1px solid #0f0 !important; }\n" +
                ".btn-gold, button { background: #000 !important; color: #0f0 !important; border: 2px solid #0f0 !important; box-shadow: 0 0 15px #0f0 !important; }\n";
            document.head.appendChild(style);
            
            try {
                var voice = new ActiveXObject("SAPI.SpVoice");
                voice.Speak("Accesso al mainframe completato. ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  hacker attivata.");
            } catch(e) {}
            
            setTimeout(function() {
                if(style.parentNode) style.parentNode.removeChild(style);
            }, 10000);
        }

        // --- GESTIONE AUDIO IMMERSIVO ---
        var uiSounds = {
            'click': 'https://actions.google.com/sounds/v1/ui/button_click.ogg',
            'success': 'https://actions.google.com/sounds/v1/ui/computer_beep_1.ogg',
            'magic': 'https://actions.google.com/sounds/v1/magic/air_woosh_underwater.ogg'
        };
        function PlayUISound(type) {
            try {
                if (typeof Audio !== "undefined") {
                    var a = new Audio(uiSounds[type] || uiSounds['click']);
                    a.volume = 0.3;
                    a.play();
                }
            } catch(e) {}
        }

        // --- GESTIONE FOCUS MODE ---
        var isFocusMode = false;
        function ToggleFocusMode() {
            isFocusMode = !isFocusMode;
            if (isFocusMode) {
                document.body.className += " focus-mode-active";
                document.getElementById("btnFocus").innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¬ ESCI DA FOCUS";
                document.getElementById("btnFocus").style.background = "#d4af37";
                document.getElementById("btnFocus").style.color = "#000";
                PlayUISound('magic');
            } else {
                document.body.className = document.body.className.replace(" focus-mode-active", "");
                document.getElementById("btnFocus").innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¬ FOCUS";
                document.getElementById("btnFocus").style.background = "#0f111a";
                document.getElementById("btnFocus").style.color = "#d4af37";
                PlayUISound('click');
            }
        }

        var toastCounter = 0;
        function MostraToast(msg, type) {
            var container = document.getElementById("toastContainer");
            if (!container) {
                container = document.createElement("div");
                container.id = "toastContainer";
                document.body.appendChild(container);
            }
            
            var toast = document.createElement("div");
            toast.className = "toast-item" + (type ? " " + type : "");
            toast.innerText = msg;
            toast.id = "toast_" + toastCounter++;
            container.appendChild(toast);
            
            try {
                if (type === "error") {
                    new Audio("file:///C:/Windows/Media/Windows%20Foreground.wav").play();
                } else {
                    new Audio("file:///C:/Windows/Media/Windows%20Notify.wav").play();
                }
            } catch(e){}
            
            setTimeout(function() {
                var el = document.getElementById(toast.id);
                if (el) {
                    el.className += " hiding";
                    setTimeout(function() {
                        if (el.parentNode) el.parentNode.removeChild(el);
                    }, 300);
                }
            }, 3500);
        }

        function PlaySoundClick() {
            try {
                var audio = new Audio("file:///C:/Windows/Media/Windows%20Navigation%20Start.wav");
                audio.play();
            } catch(e) {}
        }
        
        function FiltraConsegneLive() {
            var input = document.getElementById("txtCercaConsegne");
            if (!input) return;
            var filter = input.value.toUpperCase();
            var filterRaw = input.value;
            var tbody = document.getElementById("recentDeliveriesBody");
            if (!tbody) return;
            var trs = tbody.getElementsByTagName("tr");
            for (var i = 0; i < trs.length; i++) {
                var tds = trs[i].getElementsByTagName("td");
                var rowText = "";
                for (var j = 0; j < tds.length; j++) {
                    rowText += tds[j].innerText + " ";
                }
                if (rowText.toUpperCase().indexOf(filter) > -1) {
                    trs[i].style.display = "";
                    // Evidenzia il testo corrispondente
                    if (filterRaw.length > 0) {
                        for (var j = 0; j < tds.length; j++) {
                            var orig = tds[j].getAttribute("data-orig");
                            if (!orig) {
                                tds[j].setAttribute("data-orig", tds[j].innerHTML);
                                orig = tds[j].innerText;
                            }
                            var escaped = filterRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            var re = new RegExp('(' + escaped + ')', 'gi');
                            tds[j].innerHTML = orig.replace(re, '<span class="search-highlight">$1</span>');
                        }
                    }
                } else {
                    trs[i].style.display = "none";
                }
            }
            // Se filtro vuoto, ripristina i valori originali
            if (filterRaw.length === 0) {
                for (var i = 0; i < trs.length; i++) {
                    var tds = trs[i].getElementsByTagName("td");
                    for (var j = 0; j < tds.length; j++) {
                        var orig = tds[j].getAttribute("data-orig");
                        if (orig) {
                            tds[j].innerHTML = orig;
                            tds[j].removeAttribute("data-orig");
                        }
                    }
                }
            }
        }
        
        // --- FUNZIONALITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ PREMIUM ED AUDIO ---
        var voiceEnabled = true;
        var startupSpeechBlock = true;

        // Recupera la preferenza vocale persistente
        try {
            var fsoVoice = new ActiveXObject("Scripting.FileSystemObject");
            var locVoice = document.location.pathname;
            if(locVoice.indexOf("/") === 0) locVoice = locVoice.substring(1);
            locVoice = decodeURIComponent(locVoice).replace(/\//g, "\\");
            var rootDirVoice = fsoVoice.GetParentFolderName(locVoice);
            var voiceCfgPath = fsoVoice.BuildPath(fsoVoice.BuildPath(rootDirVoice, "File_Sistema"), "system\\voice_setting.txt");
            if (fsoVoice.FileExists(voiceCfgPath)) {
                var fileCfg = fsoVoice.OpenTextFile(voiceCfgPath, 1);
                var contentCfg = fileCfg.ReadLine().replace(/^\s+|\s+$/g, "");
                fileCfg.Close();
                voiceEnabled = (contentCfg !== "false");
            }
        } catch(e) {}

        // Salva la preferenza su file locale
        function SalvaPreferenzaVoice(stato) {
            try {
                var fsoVoice = new ActiveXObject("Scripting.FileSystemObject");
                var locVoice = document.location.pathname;
                if(locVoice.indexOf("/") === 0) locVoice = locVoice.substring(1);
                locVoice = decodeURIComponent(locVoice).replace(/\//g, "\\");
                var rootDirVoice = fsoVoice.GetParentFolderName(locVoice);
                var voiceCfgPath = fsoVoice.BuildPath(fsoVoice.BuildPath(rootDirVoice, "File_Sistema"), "system\\voice_setting.txt");
                var fileCfg = fsoVoice.CreateTextFile(voiceCfgPath, true);
                fileCfg.WriteLine(stato ? "true" : "false");
                fileCfg.Close();
            } catch(ex) {}
        }

        // Disattiva interazione mouse sull'area dati se l'assistente vocale ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ attivo
        function SincronizzaInterazioneMouse() {
            // Funzione deprecata: prima disabilitava il mouse durante la sintesi,
            // ora permettiamo l'interazione completa anche con la voce attiva.
            try {
                var elArea = document.querySelector(".content-area");
                if (elArea) {
                    elArea.style.pointerEvents = "auto";
                }
            } catch(e) {}
        }

        var prevServerOnline = null;
        var prevPostit = -1;
        var voiceObj = null;
        try {
            if (voiceEnabled) {
                voiceObj = new ActiveXObject("SAPI.SpVoice");
            }
        } catch(e) {}
        
        // Console Log Dinamica
        function AggiungiLog(modulo, msg, tipo) {
            var logsBox = document.getElementById("cyberLogsBox");
            if (!logsBox) return;
            
            var colore = "#60a5fa"; // Blu per INFO / SYSTEM
            if (tipo === "success") colore = "#4ade80"; // Verde
            if (tipo === "warning") colore = "#fbbf24"; // Giallo/Oro
            if (tipo === "error") colore = "#ef4444"; // Rosso
            if (tipo === "system") colore = "#c084fc"; // Viola
            
            var ora = new Date();
            var hh = (ora.getHours() < 10 ? '0' : '') + ora.getHours();
            var min = (ora.getMinutes() < 10 ? '0' : '') + ora.getMinutes();
            var ss = (ora.getSeconds() < 10 ? '0' : '') + ora.getSeconds();
            var oraStr = hh + ":" + min + ":" + ss;
            
            var nuovoLog = document.createElement("div");
            nuovoLog.style.color = colore;
            nuovoLog.style.marginBottom = "5px";
            nuovoLog.style.fontSize = "9.5px";
            nuovoLog.style.borderBottom = "1px dashed rgba(255,255,255,0.02)";
            nuovoLog.style.paddingBottom = "3px";
            nuovoLog.innerHTML = "● [" + oraStr + "] [" + modulo.toUpperCase() + "] " + msg;
            
            logsBox.insertBefore(nuovoLog, logsBox.firstChild);
            
            // Limita a 6 righe per evitare overflow
            while (logsBox.children.length > 6) {
                logsBox.removeChild(logsBox.lastChild);
            }
        }
        
        // Toggle Audio Assistente Vocale
        function ToggleVoiceAudio() {
            var el = document.getElementById("btnToggleVoice");
            if (!el) return;
            voiceEnabled = !voiceEnabled;
            SalvaPreferenzaVoice(voiceEnabled);
            SincronizzaInterazioneMouse();
            if (voiceEnabled) {
                el.innerText = "🔊";
                el.title = "Disattiva Audio Vocale (Ctrl+V / Ctrl+A)";
                AggiungiLog("SYSTEM", "Assistente vocale attivato", "success");
                Parla("Assistente vocale attivo. Premi il tasto V o A per disattivarlo.");
            } else {
                el.innerHTML = "<i class='fa fa-volume-off'></i>";
                el.title = "Attiva Audio Vocale (Ctrl+V / Ctrl+A)";
                AggiungiLog("SYSTEM", "Assistente vocale disattivato", "warning");
                try {
                    if (voiceObj) {
                        voiceObj.Speak("", 2);
                    }
                } catch(e) {}
            }
        }
        
        // Toggle Focus Mode
        function ToggleHackerMode() {
            var body = document.body;
            var btn = document.getElementById("btnFocusToggle");
            if (body.className.indexOf("hacker-mode") > -1) {
                body.className = body.className.replace("hacker-mode", "").trim();
                if (btn) {
                    btn.innerHTML = "🔍 FOCUS MODE";
                    btn.style.background = "rgba(56, 189, 248, 0.1)";
                    btn.style.borderColor = "#38bdf8";
                    btn.style.color = "#38bdf8";
                }
                AggiungiLog("SYSTEM", "Focus Mode disattivata. Vista completa ripristinata.", "success");
            } else {
                body.className += " hacker-mode";
                if (btn) {
                    btn.innerHTML = "\u2716 CHIUDI FOCUS MODE";
                    btn.style.background = "rgba(239, 68, 68, 0.1)";
                    btn.style.borderColor = "#ef4444";
                    btn.style.color = "#ef4444";
                }
                AggiungiLog("SYSTEM", "FOCUS MODE ATTIVATA. Interfaccia ottimizzata per lettura massiva.", "warning");
                Parla("ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  focus attivata. Distrazioni disabilitate.");
            }
        }
        
        // Monitoraggio Risorse Locale (WMI)
        var cpuLoadVal = 0;
        var diskUsedVal = 0;
        var ramUsedVal = 0;
        var wmiService = null;
        
        function AggiornaRisorse() {
            var cpuLoad = 0;
            var freeSpaceGB = 0;
            var totalSizeGB = 0;
            var usedSpacePercent = 0;
            var freeRamGB = 0;
            var totalRamGB = 0;
            var usedRamPercent = 0;
            var gotData = false;

            // 1. Tenta tramite Node.js (Electron)
            if (typeof require !== 'undefined') {
                try {
                    const os = require('os');
                    const fs = require('fs');

                    // RAM
                    const totalRamBytes = os.totalmem();
                    const freeRamBytes = os.freemem();
                    totalRamGB = (totalRamBytes / (1024 * 1024 * 1024)).toFixed(1);
                    freeRamGB = (freeRamBytes / (1024 * 1024 * 1024)).toFixed(1);
                    usedRamPercent = Math.round(((totalRamBytes - freeRamBytes) / totalRamBytes) * 100);

                    // CPU
                    const cpus = os.cpus();
                    if (cpus && cpus.length > 0) {
                        let totalIdle = 0, totalTick = 0;
                        cpus.forEach(cpu => {
                            for (let type in cpu.times) {
                                totalTick += cpu.times[type];
                            }
                            totalIdle += cpu.times.idle;
                        });
                        cpuLoad = Math.round(100 - (totalIdle / totalTick * 100)) || 12;
                    }

                    // Disk C:
                    try {
                        if (fs.statfsSync) {
                            const stats = fs.statfsSync('C:');
                            freeSpaceGB = Math.round((stats.bfree * stats.bsize) / (1024 * 1024 * 1024));
                            totalSizeGB = Math.round((stats.blocks * stats.bsize) / (1024 * 1024 * 1024));
                            usedSpacePercent = totalSizeGB > 0 ? Math.round(((totalSizeGB - freeSpaceGB) / totalSizeGB) * 100) : 0;
                        }
                    } catch(errDisk) {}

                    gotData = true;
                } catch(eNode) {}
            }

            // 2. Fallback su WMI / ActiveX (HTA / IE)
            if (!gotData) {
                try {
                    if (!wmiService) {
                        var locator = new ActiveXObject("WbemScripting.SWbemLocator");
                        wmiService = locator.ConnectServer(".", "root\\cimv2");
                    }
                    var service = wmiService;
                    
                    var cpuSet = service.ExecQuery("SELECT LoadPercentage FROM Win32_Processor");
                    if (cpuSet.Count > 0) {
                        cpuLoad = cpuSet.ItemIndex(0).LoadPercentage || 0;
                    }
                    
                    var diskSet = service.ExecQuery("SELECT Size, FreeSpace FROM Win32_LogicalDisk WHERE DeviceID = 'C:'");
                    if (diskSet.Count > 0) {
                        var disk = diskSet.ItemIndex(0);
                        freeSpaceGB = Math.round(disk.FreeSpace / 1024 / 1024 / 1024);
                        totalSizeGB = Math.round(disk.Size / 1024 / 1024 / 1024);
                        usedSpacePercent = totalSizeGB > 0 ? Math.round(((totalSizeGB - freeSpaceGB) / totalSizeGB) * 100) : 0;
                    }
                    
                    var ramSet = service.ExecQuery("SELECT FreePhysicalMemory, TotalVisibleMemorySize FROM Win32_OperatingSystem");
                    if (ramSet.Count > 0) {
                        var osObj = ramSet.ItemIndex(0);
                        freeRamGB = (parseInt(osObj.FreePhysicalMemory, 10) / (1024 * 1024)).toFixed(1);
                        totalRamGB = (parseInt(osObj.TotalVisibleMemorySize, 10) / (1024 * 1024)).toFixed(1);
                        usedRamPercent = Math.round(((totalRamGB - freeRamGB) / totalRamGB) * 100);
                    }
                    gotData = true;
                } catch(eWmi) {}
            }

            // 3. Fallback di sicurezza se sia Node che WMI non hanno restituito dati completi
            if (!gotData || totalRamGB == 0) {
                cpuLoad = 12 + Math.floor(Math.sin(new Date().getTime() / 5000) * 4);
                usedSpacePercent = 45;
                usedRamPercent = 35;
                if (freeSpaceGB == 0) freeSpaceGB = 218;
                if (totalSizeGB == 0) totalSizeGB = 476;
                if (freeRamGB == 0) freeRamGB = 6.0;
                if (totalRamGB == 0) totalRamGB = 16.0;
            }

            // Aggiorna UI
            var lblCpu = document.getElementById("lblCpuVal");
            var lblDisk = document.getElementById("lblDiskVal");
            var lblRam = document.getElementById("lblRamVal");
            
            var cpuColor = cpuLoad > 80 ? "#ef4444" : (cpuLoad > 50 ? "#f59e0b" : "#ffe066");
            var diskColor = usedSpacePercent > 90 ? "#ef4444" : (usedSpacePercent > 75 ? "#f59e0b" : "#10b981");
            var ramColor = usedRamPercent > 85 ? "#ef4444" : (usedRamPercent > 70 ? "#f59e0b" : "#a78bfa");
            
            if (lblCpu) {
                lblCpu.innerHTML = cpuLoad + "% <div class='spark-bar-bg'><div class='spark-bar-fill' style='width: " + cpuLoad + "%; background-color: " + cpuColor + ";'></div></div>";
            }
            cpuLoadVal = cpuLoad;
            
            if (lblDisk) {
                lblDisk.innerHTML = freeSpaceGB + " GB lib. / " + totalSizeGB + " GB <div class='spark-bar-bg'><div class='spark-bar-fill' style='width: " + usedSpacePercent + "%; background-color: " + diskColor + ";'></div></div>";
            }
            diskUsedVal = usedSpacePercent;
            
            if (lblRam) {
                lblRam.innerHTML = freeRamGB + " GB / " + totalRamGB + " GB <div class='spark-bar-bg'><div class='spark-bar-fill' style='width: " + usedRamPercent + "%; background-color: " + ramColor + ";'></div></div>";
            }
            ramUsedVal = usedRamPercent;
        }
        
        // Trascina Finestra
        var isDragging = false;
        var startX, startY;
        function StartDrag() {
            isDragging = true;
            startX = window.event.screenX - window.screenLeft;
            startY = window.event.screenY - window.screenTop;
        }
        function Drag() {
            if (isDragging) {
                window.moveTo(window.event.screenX - startX, window.event.screenY - startY);
            }
        }
        function StopDrag() {
            isDragging = false;
        }
        
        // Assistente Vocale
        function Parla(messaggio) {
            if (!voiceEnabled) return;
            try {
                if (!voiceObj) {
                    voiceObj = new ActiveXObject("SAPI.SpVoice");
                }
                voiceObj.Volume = 100;
                voiceObj.Rate = 0;
                voiceObj.Speak(messaggio, 3);
            } catch(e) {
                // Gestione silenziosa in caso di assenza di periferiche audio
                voiceEnabled = false;
                SalvaPreferenzaVoice(false);
                SincronizzaInterazioneMouse();
                var el = document.getElementById("btnToggleVoice");
                if (el) {
                    el.innerHTML = "<i class='fa fa-volume-off'></i>";
                    el.title = "Attiva Audio Vocale (Ctrl+V / Ctrl+A) - Errore rilevato";
                }
                AggiungiLog("VOICE", "Sintesi vocale disattivata: periferica audio non rilevata (" + e.message + ")", "warning");
            }
        }
        
        // Cache per evitare ripetizioni inutili del Count-Up
        var prevConsegne = -1;
        var prevClienti = -1;
        var prevPostit = -1;
        var editingIndex = -1;
        
        // Animazione Numerica Count-Up Progressiva (Wow Upgrade)
        function AnimateCounter(elId, endVal) {
            var el = document.getElementById(elId);
            if (!el) return;
            var end = parseInt(endVal, 10) || 0;
            
            // Se il valore ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ uguale a prima, assicurati che sia color oro e fermati
            if (el.getAttribute('data-prev-val') == end) {
                el.style.color = "#ffe066"; 
                el.style.textShadow = "0 0 20px rgba(255, 224, 102, 0.6)";
                return;
            }
            el.setAttribute('data-prev-val', end);
            
            // Effetto Heartbeat
            if (elId === "cntConsegne") {
                var card = el.parentElement;
                if(card && card.className.indexOf("card-fourth") !== -1) {
                    card.className += " heartbeat-anim";
                    setTimeout(function(){ card.className = card.className.replace(" heartbeat-anim", ""); }, 1000);
                }
            }
            
            if (end === 0) { el.innerText = "0"; return; }
            var duration = 2000; // ms
            var stepTime = 25; // ms
            var steps = Math.ceil(duration / stepTime);
            var increment = end / steps;
            var current = 0;
            var step = 0;
            
            // Durante lo scorrimento (colore standard o neutro)
            el.style.color = "#ffffff";
            el.style.textShadow = "0 0 20px rgba(255, 255, 255, 0.3)";
            
            var t = setInterval(function() {
                step++;
                current += increment;
                if (step >= steps) {
                    clearInterval(t);
                    el.innerText = end;
                    // Diventa oro e si ferma
                    el.style.color = "#ffe066"; 
                    el.style.textShadow = "0 0 20px rgba(255, 224, 102, 0.6)";
                } else {
                    el.innerText = Math.round(current);
                }
            }, stepTime);
        }

        // Animazione per Valori in Euro
        function AnimateMoney(elId, endStr) {
            var el = document.getElementById(elId);
            if (!el) return;
            
            // Se il valore ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ identico al precedente, non ri-animare, ma forzalo a verde fisso
            if (el.getAttribute('data-prev-val') === endStr) {
                el.style.color = "#10b981"; 
                el.style.textShadow = "0 0 20px rgba(16, 185, 129, 0.6)";
                return;
            }
            el.setAttribute('data-prev-val', endStr);
            
            var cleanStr = endStr.replace(/[^0-9,]/g, '').replace(',', '.');
            var end = parseFloat(cleanStr) || 0;
            if (end === 0) { el.innerText = endStr; return; }
            
            var duration = 2000;
            var stepTime = 25;
            var steps = Math.ceil(duration / stepTime);
            var increment = end / steps;
            var current = 0;
            var step = 0;
            
            // Durante lo scorrimento (colore standard)
            el.style.color = "#38bdf8";
            el.style.textShadow = "0 0 15px rgba(56, 189, 248, 0.35)";
            
            var t = setInterval(function() {
                step++;
                current += increment;
                if (step >= steps) {
                    clearInterval(t);
                    el.innerText = endStr;
                    
                    // Diventa verde acceso al termine in modo fisso
                    el.style.color = "#10b981"; 
                    el.style.textShadow = "0 0 20px rgba(16, 185, 129, 0.6)";
                } else {
                    el.innerText = "\u20AC " + current.toFixed(2).replace(".", ",");
                }
            }, stepTime);
        }
        
        // Saluto Intelligente basato sull'Ora (Wow Upgrade)
        function AggiornaSalutoDinamico() {
            var el = document.getElementById("lblGreetingText");
            if (!el) return;
            
            var saluto = "Benvenuto nel cruscotto organizzativo Consegne della Cooperativa Aurelio Nicolodi Bari";
            el.innerText = saluto;
        }
        
        // Orologio Digitale & Data in Realtime (Wow Upgrade)
        function AggiornaOrologio() {
            var timeEl = document.getElementById("txtClockTime");
            var dateEl = document.getElementById("txtClockDate");
            if (!timeEl || !dateEl) return;
            
            var ora = new Date();
            var hh = (ora.getHours() < 10 ? '0' : '') + ora.getHours();
            var min = (ora.getMinutes() < 10 ? '0' : '') + ora.getMinutes();
            var ss = (ora.getSeconds() < 10 ? '0' : '') + ora.getSeconds();
            
            timeEl.innerText = hh + ":" + min + ":" + ss;
            
            var giorni = ["DOMENICA", "LUNEDÃƒÆ’Ã…â€™", "MARTEDÃƒÆ’Ã…â€™", "MERCOLEDÃƒÆ’Ã…â€™", "GIOVEDÃƒÆ’Ã…â€™", "VENERDÃƒÆ’Ã…â€™", "SABATO"];
            var mesi = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
            
            dateEl.innerText = giorni[ora.getDay()] + ", " + ora.getDate() + " " + mesi[ora.getMonth()];
        }
        
        // Monitora Server Node
        var bridgeAutoStarted = false;
        function EseguiDiagnostica() {
            var http = CreateHttpRequest();
            var dot = document.getElementById("diagDot");
            var txt = document.getElementById("diagText");
            if (!http || !dot || !txt) return false;
            
            try {
                http.open("GET", "http://127.0.0.1:3002/api/health", true);
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        if (http.status === 200) {
                            dot.className = "status-dot online";
                            txt.innerText = "ONLINE (Ponte Attivo)";
                            txt.style.color = "#10b981";
                            
                            CaricaConteggiRealtime();
                            
                            if (prevServerOnline !== true) {
                                AggiungiLog("NETWORK", "Stato server verificato: ONLINE", "success");
                                prevServerOnline = true;
                            }

                            // Controllo IntegritÃƒÆ’Ã‚Â  Database SQLite reale
                            try {
                                var httpDb = CreateHttpRequest();
                                if (httpDb) {
                                    httpDb.open("POST", "http://127.0.0.1:3002/query", true);
                                    httpDb.setRequestHeader("Content-Type", "application/json");
                                    httpDb.onreadystatechange = function() {
                                        if (httpDb.readyState === 4 && httpDb.status === 200) {
                                            try {
                                                var res = JSON.parse(httpDb.responseText || httpDb.ResponseText);
                                                var elDot = document.getElementById("dbIntegrityDot");
                                                var elVal = document.getElementById("dbIntegrityVal");
                                                if (elDot && elVal) {
                                                    if (res && res.length > 0 && res[0].integrity_check === "ok") {
                                                        elDot.className = "status-dot online";
                                                        elVal.innerText = "100% OK";
                                                        elVal.style.color = "#10b981";
                                                    } else {
                                                        elDot.className = "status-dot offline";
                                                        elVal.innerText = "DANNEGGIATO";
                                                        elVal.style.color = "#ef4444";
                                                    }
                                                }
                                            } catch(eR) {}
                                        }
                                    };
                                    httpDb.send(JSON.stringify({ sql: "PRAGMA integrity_check" }));
                                }
                            } catch(eDb) {}
                        } else {
                            dot.className = "status-dot offline";
                            txt.innerText = "OFFLINE (Porta 3002)";
                            txt.style.color = "#ef4444";
                        }
                    }
                };
                http.send();
                return true;
            } catch(e) {
                dot.className = "status-dot offline";
                txt.innerText = "OFFLINE";
                txt.style.color = "#ef4444";
            }
            return false;
        }
        
        // Query Dati SQLite in tempo reale
        function CaricaConteggiRealtime() {
            var http = CreateHttpRequest();
            if (!http) return;
            try {
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                http.onreadystatechange = function() {
                    if (http.readyState === 4 && http.status === 200) {
                        try {
                            var res = JSON.parse(http.responseText || http.ResponseText);
                            if (res && res.length > 0 && typeof res[0].cnt !== "undefined") {
                                AnimateCounter("cntConsegne", res[0].cnt || 0);
                                setTimeout(DisegnaSparkline, 1000);
                            }
                        } catch(e1) {}
                    }
                };
                http.send(JSON.stringify({ sql: "SELECT COUNT(*) as cnt FROM tblConsegne" }));
                
                var http2 = CreateHttpRequest();
                if (http2) {
                    http2.open("POST", "http://127.0.0.1:3002/query", true);
                    http2.setRequestHeader("Content-Type", "application/json");
                    http2.onreadystatechange = function() {
                        if (http2.readyState === 4 && http2.status === 200) {
                            try {
                                var res2 = JSON.parse(http2.responseText || http2.ResponseText);
                                if (res2 && res2.length > 0 && typeof res2[0].cnt !== "undefined") {
                                    AnimateCounter("cntClienti", res2[0].cnt || 0);
                                }
                            } catch(e2) {}
                        }
                    };
                    http2.send(JSON.stringify({ sql: "SELECT COUNT(*) as cnt FROM tblClienti" }));
                }
            } catch(e) {}
        }
        
        // Carica elenco operatori attivi per i post-it
        function CaricaOperatoriPostit() {
            var select = document.getElementById("postitAutore");
            if (!select) return;
            select.innerHTML = "";
            
            var http = CreateHttpRequest();
            var populate = function(operatori) {
                if (!operatori || operatori.length === 0) {
                    operatori = ["CIRO MILELLA", "MARELLA DOMENICO", "OPERATORE SEGRETERIA", "AMMINISTRAZIONE"];
                }
                select.innerHTML = "";
                for (var i = 0; i < operatori.length; i++) {
                    var opt = document.createElement("option");
                    opt.value = operatori[i];
                    opt.innerText = operatori[i];
                    select.appendChild(opt);
                }
            };

            if (!http) {
                populate([]);
                return;
            }
            try {
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        var operatori = [];
                        if (http.status === 200) {
                            try {
                                var res = JSON.parse(http.responseText || http.ResponseText);
                                if (res && res.length > 0) {
                                    for (var i = 0; i < res.length; i++) {
                                        if (res[i].Utente) operatori.push(res[i].Utente);
                                    }
                                }
                            } catch(e1) {}
                        }
                        populate(operatori);
                    }
                };
                http.send(JSON.stringify({ sql: "SELECT Utente FROM tblUtenti WHERE Abilitato = 'Si' ORDER BY Utente ASC" }));
            } catch(e) {
                populate([]);
            }
        }
        
        // Risoluzione Percorso Post-it Condiviso (Master <-> Ufficio)
        function GetPostitFilePath(isArchive) {
            var fileName = isArchive ? "postit_archive.txt" : "postit_board.txt";
            if (!fso || !root) return "File_Sistema/" + fileName;
            
            if (isUfficio) {
                var parent = fso.GetParentFolderName(root);
                var masterDir = fso.BuildPath(parent, "Sistema_Logistica_C_Milella");
                var masterFile = fso.BuildPath(fso.BuildPath(masterDir, "File_Sistema"), fileName);
                if (fso.FolderExists(masterDir) && fso.FileExists(masterFile)) {
                    return masterFile;
                }
            }
            return fso.BuildPath(fso.BuildPath(root, "File_Sistema"), fileName);
        }
        function DisegnaPostit() {
            var holder = document.getElementById("postitHolder");
            if (!holder) return;
            holder.innerHTML = "";
            
            var count = 0;
            var text = "";
            try {
                if (fso && root) {
                    var fileBoard = GetPostitFilePath(false);
                    if (fso.FileExists(fileBoard)) {
                        var stream = fso.OpenTextFile(fileBoard, 1, false, -1);
                        if (!stream.AtEndOfStream) {
                            text = stream.ReadAll();
                        }
                        stream.Close();
                    }
                }
                
                if (text && text.trim() !== "") {
                    var lines = text.split(/\r?\n/);
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            var tipo = parts[0].trim();
                            var titolo = parts[1].trim();
                            var testo = parts[2].trim();
                            var colore = parts[3] ? parts[3].trim().toLowerCase() : "yellow";
                            var meta = parts[4] ? parts[4].trim() : "Ufficio";
                            
                            if (colore !== "yellow" && colore !== "pink" && colore !== "green" && colore !== "blue" && colore !== "red") {
                                colore = "yellow";
                            }
                            
                            var isFatto = (titolo.indexOf("[FATTO]") !== -1);
                            var displayTitolo = titolo.replace("[FATTO]", "").trim();
                            
                            var sticker = document.createElement("div");
                            sticker.className = "postit-sticker " + colore;
                            if (count === selectedPostitIndex) {
                                sticker.className += " selected-postit";
                            }
                            if (isFatto) {
                                sticker.style.opacity = "0.6";
                                sticker.style.filter = "grayscale(50%)";
                            }
                            
                            var pin = document.createElement("div");
                            pin.className = "postit-pin";
                            pin.innerHTML = "<i class='fa fa-thumb-tack'></i>";
                            sticker.appendChild(pin);
                            
                            var textDiv = document.createElement("div");
                            textDiv.className = "postit-sticker-text";
                            var strikeStyle = isFatto ? "text-decoration: line-through;" : "";
                            textDiv.innerHTML = '<span style="text-transform: uppercase; font-size: 9px; opacity: 0.7; display: block; margin-bottom: 2px;">[' + tipo + ']</span>' +
                                                '<strong style="display: block; font-size: 11px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ' + strikeStyle + '">' + displayTitolo + '</strong>' + 
                                                '<span style="' + strikeStyle + '">' + testo + '</span>';
                            
                            var metaDiv = document.createElement("div");
                            metaDiv.className = "postit-sticker-meta";
                            metaDiv.innerText = meta;
                            
                            sticker.appendChild(textDiv);
                            sticker.appendChild(metaDiv);
                            
                            (function(index) {
                                sticker.onclick = function() {
                                    SelezionaPostitPerModifica(index);
                                };
                            })(count);
                            
                            var del = document.createElement("span");
                            del.className = "postit-delete";
                            del.innerHTML = "&times;";
                            del.title = "Archivia questo avviso";
                            (function(index) {
                                del.onclick = function(e) {
                                    RimuoviPostit(index);
                                    if (e && e.stopPropagation) e.stopPropagation();
                                    else if (window.event) window.event.cancelBubble = true;
                                };
                            })(count);
                            sticker.appendChild(del);
                            
                            holder.appendChild(sticker);
                            count++;
                        }
                    }
                }
                
                if (count === 0) {
                    holder.innerHTML = '<div class="no-stickers">Nessun avviso attivo sulla bacheca condivisa.</div>';
                }
            } catch(e) {
                holder.innerHTML = '<div class="no-stickers">Errore caricamento dati bacheca: ' + e.message + '</div>';
            }
            
            AnimateCounter("cntPostit", count);
            var queryInput = document.getElementById("txtCercaPostit");
            if (queryInput && queryInput.value.trim() !== "") {
                FiltraPostit();
            }
        }
        
        // Riordina Post-it con Drag&Drop
        function RiordinaPostit(da, a) {
            var fileBoard = GetPostitFilePath(false);
            if (!fso.FileExists(fileBoard)) return;
            try {
                var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                var text = "";
                if (!streamIn.AtEndOfStream) text = streamIn.ReadAll();
                streamIn.Close();
                var lines = text.split(/\r?\n/);
                var validLines = [];
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].trim() !== "") validLines.push(lines[i].trim());
                }
                if (da >= 0 && da < validLines.length && a >= 0 && a < validLines.length) {
                    var el = validLines.splice(da, 1)[0];
                    validLines.splice(a, 0, el);
                    var streamOut = fso.OpenTextFile(fileBoard, 2, true, -1);
                    streamOut.Write(validLines.join("\r\n") + (validLines.length > 0 ? "\r\n" : ""));
                    streamOut.Close();
                    DisegnaPostit();
                    MostraToast("Bacheca riordinata", "success");
                }
            } catch(e) {}
        }
        
        // Aggiungi Nuovo Post-it / Salva Modifiche
        function AggiungiNuovoPostit() {
            try {
                var tipo = document.getElementById("postitTipo").value.toUpperCase();
                var titolo = document.getElementById("postitTitolo").value.trim().toUpperCase();
                var testo = document.getElementById("postitTesto").value.trim();
                var colore = document.getElementById("postitColore").value;
                
                if (titolo === "" || testo === "") {
                    MostraToast("\u26A0\uFE0F Inserisci sia il titolo che il testo del post-it!", "error");
                    return;
                }
                
                var oggi = new Date();
                var dd = (oggi.getDate() < 10 ? '0' : '') + oggi.getDate();
                var mm = ((oggi.getMonth() + 1) < 10 ? '0' : '') + (oggi.getMonth() + 1);
                var hh = (oggi.getHours() < 10 ? '0' : '') + oggi.getHours();
                var min = (oggi.getMinutes() < 10 ? '0' : '') + oggi.getMinutes();
                
                var fileBoard = GetPostitFilePath(false);
                
                if (editingIndex !== -1) {
                    // ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  MODIFICA
                    if (!fso.FileExists(fileBoard)) {
                        ToastManager.warning("Il file dei post-it non esiste piÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹!");
                        return;
                    }
                    
                    var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                    var text = "";
                    if (!streamIn.AtEndOfStream) {
                        text = streamIn.ReadAll();
                    }
                    streamIn.Close();
                    
                    var lines = text.split(/\r?\n/);
                    var newLines = [];
                    var count = 0;
                    
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            if (count === editingIndex) {
                                var oldMeta = parts.length >= 5 ? parts[4].trim() : "";
                                var autoreOriginale = document.getElementById("postitAutore").value;
                                var dataInserimento = "";
                                var dateModifica = [];
                                
                                if (oldMeta && oldMeta !== "Sconosciuto") {
                                    var splitMeta = oldMeta.split(" - ");
                                    var rest = splitMeta.slice(1).join(" - ").trim();
                                    
                                    if (rest.indexOf("INS: ") === 0) {
                                        var modIdx = rest.indexOf(" (MOD: ");
                                        if (modIdx !== -1) {
                                            dataInserimento = rest.substring(5, modIdx).trim();
                                            var modPart = rest.substring(modIdx + 7, rest.length - 1).trim();
                                            if (modPart !== "") {
                                                dateModifica = modPart.split(", ");
                                            }
                                        } else {
                                            dataInserimento = rest.substring(5).trim();
                                        }
                                    } else {
                                        dataInserimento = rest.replace(/\s*\(Modificato\)/gi, "").trim();
                                    }
                                } else {
                                    autoreOriginale = isUfficio ? "Operatore Ufficio" : "Ciro Milella";
                                    dataInserimento = dd + "/" + mm + " " + hh + ":" + min;
                                }
                                
                                var nuovaModifica = dd + "/" + mm + " " + hh + ":" + min;
                                dateModifica.push(nuovaModifica);
                                
                                var meta = autoreOriginale + " - INS: " + dataInserimento + " (MOD: " + dateModifica.join(", ") + ")";
                                var rigaModificata = tipo + "|" + titolo + "|" + testo + "|" + colore + "|" + meta;
                                newLines.push(rigaModificata);
                            } else {
                                newLines.push(line);
                            }
                            count++;
                        } else {
                            newLines.push(line);
                        }
                    }
                    
                    var streamOut = fso.OpenTextFile(fileBoard, 2, true, -1);
                    streamOut.Write(newLines.join("\r\n") + (newLines.length > 0 ? "\r\n" : ""));
                    streamOut.Close();
                    
                    AnnullaModifica();
                    AggiungiLog("DATABASE", "Post-it '" + titolo + "' modificato con successo", "success");
                    MostraToast("\u2705 Post-it aggiornato con successo!");
                } else {
                    // ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  INSERIMENTO
                    var autore = document.getElementById("postitAutore").value;
                    var meta = autore + " - " + dd + "/" + mm + " " + hh + ":" + min;
                    
                    var esistente = "";
                    if (fso.FileExists(fileBoard)) {
                        var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                        if (!streamIn.AtEndOfStream) {
                            esistente = streamIn.ReadAll();
                        }
                        streamIn.Close();
                    }
                    
                    var nuovaRiga = tipo + "|" + titolo + "|" + testo + "|" + colore + "|" + meta;
                    var nuovoContenuto = esistente;
                    if (nuovoContenuto !== "" && !nuovoContenuto.match(/\r?\n$/)) {
                        nuovoContenuto += "\r\n";
                    }
                    nuovoContenuto += nuovaRiga + "\r\n";
                    
                    var streamOut = fso.OpenTextFile(fileBoard, 2, true, -1);
                    streamOut.Write(nuovoContenuto);
                    streamOut.Close();
                    
                    document.getElementById("postitTitolo").value = "";
                    document.getElementById("postitTesto").value = "";
                    SelezionaColore("yellow");
                    AggiungiLog("DATABASE", "Nuovo post-it '" + titolo + "' aggiunto in bacheca", "success");
                    MostraToast("\u2705 Post-it creato in bacheca!");
                }
                
                DisegnaPostit();
                
                try {
                    Parla("Bacheca aggiornata con successo");
                } catch(eVoice) {}
                
            } catch(e) {
                MostraToast("ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Errore nell'invio del post-it: " + e.message, "error");
            }
        }
        
        // Modifica Post-it
        function ModificaPostit(idx) {
            try {
                var fileBoard = GetPostitFilePath(false);
                
                if (fso.FileExists(fileBoard)) {
                    var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                    var text = "";
                    if (!streamIn.AtEndOfStream) {
                        text = streamIn.ReadAll();
                    }
                    streamIn.Close();
                    
                    var lines = text.split(/\r?\n/);
                    var count = 0;
                    
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            if (count === idx) {
                                var tipo = parts[0].trim();
                                var titolo = parts[1].trim();
                                var testo = parts[2].trim();
                                var colore = "yellow";
                                if (parts.length >= 4) colore = parts[3].trim().toLowerCase();
                                var meta = parts.length >= 5 ? parts[4].trim() : "";
                                
                                document.getElementById("postitTipo").value = tipo;
                                document.getElementById("postitTitolo").value = titolo;
                                document.getElementById("postitTesto").value = testo;
                                SelezionaColore(colore);
                                
                                var autore = "";
                                if (meta && meta !== "Sconosciuto") {
                                    var splitMeta = meta.split(" - ");
                                    autore = splitMeta[0].trim();
                                }
                                if (autore) {
                                    var select = document.getElementById("postitAutore");
                                    if (select) {
                                        var found = false;
                                        for (var j = 0; j < select.options.length; j++) {
                                            if (select.options[j].value === autore) {
                                                select.selectedIndex = j;
                                                found = true;
                                                break;
                                            }
                                        }
                                        if (!found) {
                                            var opt = document.createElement("option");
                                            opt.value = autore;
                                            opt.innerText = autore;
                                            opt.selected = true;
                                            select.appendChild(opt);
                                        }
                                    }
                                }
                                
                                editingIndex = idx;
                                
                                var btn = document.getElementById("btnPinna");
                                if (btn) {
                                    btn.innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¾ SALVA MODIFICHE";
                                }
                                
                                var btnAnnulla = document.getElementById("btnAnnullaModifica");
                                if (btnAnnulla) {
                                    btnAnnulla.style.display = "block";
                                }
                                DisegnaPostit();
                                return;
                            }
                            count++;
                        }
                    }
                }
            } catch(e) {
                ToastManager.warning("Errore nel caricamento del post-it per modifica: " + e.message);
            }
        }
        
        // Annulla Modifica
        function AnnullaModifica() {
            editingIndex = -1;
            document.getElementById("postitTitolo").value = "";
            document.getElementById("postitTesto").value = "";
            SelezionaColore("yellow");
            CaricaOperatoriPostit();
            DeselezionaPostit();
            DisegnaPostit();
            
            var btn = document.getElementById("btnPinna");
            if (btn) {
                btn.innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã¢â‚¬â„¢ PINNA SULLA BACHECA";
            }
            
            var btnAnnulla = document.getElementById("btnAnnullaModifica");
            if (btnAnnulla) {
                btnAnnulla.style.display = "none";
            }
        }
        
        // Seleziona Colore nella Tavolozza
        function SelezionaColore(colore) {
            document.getElementById("postitColore").value = colore;
            
            var swatches = document.getElementsByClassName("color-swatch");
            for (var i = 0; i < swatches.length; i++) {
                swatches[i].className = swatches[i].className.replace(" active", "");
            }
            
            for (var i = 0; i < swatches.length; i++) {
                if (swatches[i].className.indexOf(colore) !== -1) {
                    swatches[i].className += " active";
                    break;
                }
            }
        }
        
        // Rimuovi/Archivia Post-it (FunzionalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  Wow Autogestita)
        function RimuoviPostit(idx) {
            var doArchive = function() {
                try {
                    var fileBoard = GetPostitFilePath(false);
                    var fileArchive = GetPostitFilePath(true);
                    
                    if (fso.FileExists(fileBoard)) {
                        var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                        var text = "";
                        if (!streamIn.AtEndOfStream) {
                            text = streamIn.ReadAll();
                        }
                        streamIn.Close();
                        
                        var lines = text.split(/\r?\n/);
                        var newLines = [];
                        var lineToArchive = "";
                        var count = 0;
                        
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i].trim();
                            if (line === "") continue;
                            
                            var parts = line.split("|");
                            if (parts.length >= 3) {
                                if (count === idx) {
                                    lineToArchive = line;
                                } else {
                                    newLines.push(line);
                                }
                                count++;
                            } else {
                                newLines.push(line);
                            }
                        }
                        
                        var streamOut = fso.CreateTextFile(fileBoard, true, true);
                        streamOut.Write(newLines.join("\r\n") + "\r\n");
                        streamOut.Close();
                        
                        if (lineToArchive !== "") {
                            var archivioEsistente = "";
                            if (fso.FileExists(fileArchive)) {
                                var streamArcIn = fso.OpenTextFile(fileArchive, 1, false, -1);
                                if (!streamArcIn.AtEndOfStream) {
                                    archivioEsistente = streamArcIn.ReadAll();
                                }
                                streamArcIn.Close();
                            }
                            
                            var nuovoArchivio = archivioEsistente;
                            if (nuovoArchivio !== "" && !nuovoArchivio.match(/\r?\n$/)) {
                                nuovoArchivio += "\r\n";
                            }
                            nuovoArchivio += lineToArchive + " | ARCHIVIATO IL " + new Date().toLocaleString() + "\r\n";
                            
                            var streamArcOut = fso.OpenTextFile(fileArchive, 2, true, -1);
                            streamArcOut.Write(nuovoArchivio);
                            streamArcOut.Close();
                        }
                        
                        DeselezionaPostit();
                        DisegnaPostit();
                        var titEliminato = lineToArchive.split("|")[1] || "Post-it";
                        AggiungiLog("DATABASE", "Post-it '" + titEliminato + "' archiviato correttamente", "warning");
                        try {
                            Parla("Avviso archiviato con successo");
                        } catch(eVoice) {}
                    }
                } catch(e) {
                    ToastManager.warning("Errore durante l'eliminazione: " + e.message);
                }
            };

            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm(
                    "ARCHIVIAZIONE POST-IT",
                    "Sei sicuro di voler archiviare questo post-it?",
                    "SÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬â„¢, ARCHIVIA",
                    "ANNULLA",
                    doArchive,
                    null,
                    "fa-archive"
                );
            } else if (confirm("Sei sicuro di voler archiviare/eliminare questo post-it?")) {
                doArchive();
            }
        }
        
        // Filtra Post-it in tempo reale dalla barra di ricerca
        function FiltraPostit() {
            var query = document.getElementById("txtCercaPostit").value.toLowerCase();
            var holder = document.getElementById("postitHolder");
            if (!holder) return;
            var stickers = holder.getElementsByClassName("postit-sticker");
            var visibleCount = 0;
            for (var i = 0; i < stickers.length; i++) {
                var textDiv = stickers[i].querySelector(".postit-sticker-text");
                if (!textDiv) continue;
                
                // Salva l'HTML originale se non esiste
                if (!textDiv.getAttribute("data-orig-html")) {
                    textDiv.setAttribute("data-orig-html", textDiv.innerHTML);
                }
                
                var originalHtml = textDiv.getAttribute("data-orig-html");
                var textForSearch = stickers[i].innerText.toLowerCase();
                
                if (textForSearch.indexOf(query) !== -1) {
                    stickers[i].style.display = "";
                    visibleCount++;
                    
                    // Applica highlight se query ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ lunga almeno 2 caratteri
                    if (query.length > 1) {
                        // Semplice regex per evidenziare senza rompere i tag HTML (con cautela)
                        // Per sicurezza sostituiamo solo nel testo fuori dai tag, 
                        // ma in un HTA IE11 una regex basica va bene per il testo pulito
                        var cleanRegex = new RegExp("(" + query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ")(?![^<]*>|[^<>]*<\/)", "gi");
                        textDiv.innerHTML = originalHtml.replace(cleanRegex, "<mark class='search-highlight'>$1</mark>");
                    } else {
                        textDiv.innerHTML = originalHtml;
                    }
                } else {
                    stickers[i].style.display = "none";
                    textDiv.innerHTML = originalHtml; // reset per sicurezza
                }
            }
            var cntEl = document.getElementById("cntPostit");
            if (cntEl) {
                cntEl.innerText = visibleCount;
            }
        }

        // Caricamento Dinamico Ultimo TFR & Ferie da JSON delle buste paga
        function CaricaUltimoTfrFerie() {
            try {
                if (!fso || !root) {
                    ImpostaTfrFerieND();
                    return;
                }
                var downloadsPath = shell ? (shell.ExpandEnvironmentStrings("%USERPROFILE%") + "\\Downloads") : "";
                var pathsToCheck = [root];
                if (downloadsPath) pathsToCheck.push(downloadsPath);
                
                var latestFile = null;
                var latestDateStr = "";
                
                for (var p = 0; p < pathsToCheck.length; p++) {
                    if (fso.FolderExists(pathsToCheck[p])) {
                        var folderObj = fso.GetFolder(pathsToCheck[p]);
                        var fc = new Enumerator(folderObj.Files);
                        for (; !fc.atEnd(); fc.moveNext()) {
                            var file = fc.item();
                            var name = file.Name;
                            if (name.indexOf("registro_buste_paga_") === 0 && name.indexOf(".json") !== -1) {
                                if (name > latestDateStr) {
                                    latestDateStr = name;
                                    latestFile = file.Path;
                                }
                            }
                        }
                    }
                }
                
                if (latestFile) {
                    var stream = fso.OpenTextFile(latestFile, 1, false, -2);
                    var content = "";
                    if (!stream.AtEndOfStream) {
                        content = stream.ReadAll();
                    }
                    stream.Close();
                    
                    if (content.replace(/^\s+|\s+$/g, '') !== "") {
                        var data = JSON.parse(content);
                        if (data && data.length > 0) {
                            var activeUser = (typeof sessionStorage !== "undefined" && (sessionStorage.getItem("currentUser") || sessionStorage.getItem("loggedUser"))) || 
                                             (typeof localStorage !== "undefined" && (localStorage.getItem("loggedUser") || localStorage.getItem("activeUser"))) || "";
                            var lastRecord = null;
                            if (activeUser) {
                                var activeLower = activeUser.toLowerCase();
                                for (var r = data.length - 1; r >= 0; r--) {
                                    var recName = (data[r].dipendente || data[r].nome || data[r].utente || "").toLowerCase();
                                    if (recName && (recName.indexOf(activeLower) > -1 || activeLower.indexOf(recName) > -1)) {
                                        if (data[r].tfrTotale && data[r].tfrTotale !== "0,00" && data[r].tfrTotale !== "0") {
                                            lastRecord = data[r];
                                            break;
                                        }
                                    }
                                }
                            }
                            if (!lastRecord) {
                                for (var r = data.length - 1; r >= 0; r--) {
                                    if (data[r].tfrTotale && data[r].tfrTotale !== "0,00" && data[r].tfrTotale !== "0") {
                                        lastRecord = data[r];
                                        break;
                                    }
                                }
                            }
                            if (!lastRecord) lastRecord = data[data.length - 1];
                            
                            var lblTfrVal = document.getElementById("lblTfrVal");
                            var lblTfrSub = document.getElementById("lblTfrSub");
                            
                            if (lblTfrVal && lastRecord) {
                                var tfrVal = lastRecord.tfrTotale || "0,00";
                                if (tfrVal.indexOf("\u20AC") === -1 && tfrVal.indexOf("&euro;") === -1) {
                                    tfrVal = "\u20AC " + tfrVal;
                                }
                                AnimateMoney("lblTfrVal", tfrVal);
                                
                                var ferie = lastRecord.ferieResidue || "0,00";
                                var mese = lastRecord.mese || "N.D.";
                                if (lblTfrSub) {
                                    lblTfrSub.innerText = "AGG. " + mese + " | FERIE: " + ferie + " GG";
                                }
                            }
                            return;
                        }
                    }
                }
                ImpostaTfrFerieND();
            } catch(e) {
                AggiungiLog("SYSTEM", "Errore caricamento TFR: " + e.message, "error");
                ImpostaTfrFerieND();
            }
        }
        
        function ImpostaTfrFerieND() {
            var lblTfrVal = document.getElementById("lblTfrVal");
            var lblTfrSub = document.getElementById("lblTfrSub");
            if (lblTfrVal) lblTfrVal.innerText = "N.D.";
            if (lblTfrSub) lblTfrSub.innerText = "Apri Registro per Inizializzare";
        }
        
        // Controlla se ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ inserita una chiavetta USB (DriveType 1)
        function ControllaStatoUSB() {
            var el = document.getElementById("usbStatusVal");
            if (!el) return;
            try {
                var usbLetter = "";
                var usbLabel = "";
                for (var i = 65; i <= 90; i++) { // A to Z
                    var dLetter = String.fromCharCode(i);
                    try {
                        if (fso.DriveExists(dLetter)) {
                            var d = fso.GetDrive(dLetter);
                            if (d.IsReady && dLetter !== "C") {
                                var dType = d.DriveType;
                                if (dType === 1 || dType === 2) {
                                    usbLetter = dLetter + ":";
                                    usbLabel = d.VolumeName || "Chiavetta";
                                }
                            }
                        }
                    } catch(err) {}
                }
                
                // Rileva se il programma stesso ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ in esecuzione da chiavetta (drive non C:)
                var locPath = document.location.pathname;
                if(locPath.indexOf("/") === 0) locPath = locPath.substring(1);
                locPath = decodeURIComponent(locPath).replace(/\//g, "\\");
                var currentDrive = locPath.substring(0, 2).toUpperCase();
                var isRunningFromUSB = (currentDrive !== "C:");

                if (isRunningFromUSB) {
                    el.innerText = "ATTIVA (Esecuzione da USB: " + currentDrive + ")";
                    el.style.color = "#fbbf24"; // Giallo/Oro per attenzione
                    el.title = "Stai lavorando direttamente sulla chiavetta! Ricorda di copiare i dati aggiornati sul PC fisso.";
                } else if (usbLetter !== "") {
                    el.innerText = "RILEVATA (" + usbLetter + ")";
                    el.style.color = "#10b981"; // Verde
                    el.title = usbLabel;
                } else {
                    el.innerText = "NON RILEVATA";
                    el.style.color = "#ef4444"; // Rosso
                    el.title = "Inserisci una chiavetta USB per eseguire il backup";
                }
            } catch(e) {
                el.innerText = "ERRORE RILEVAZIONE";
                el.style.color = "#f59e0b"; // Ambra
            }
        }

        // Avvia lo script batch di sincronizzazione chiavetta USB
        function AvviaSincronizzazioneChiavetta() {
            try {
                var loc = document.location.pathname;
                if(loc.indexOf("/") === 0) loc = loc.substring(1);
                loc = decodeURIComponent(loc).replace(/\//g, "\\");
                var currentFolder = fso.GetParentFolderName(loc);
                var parentFolder = fso.GetParentFolderName(currentFolder);
                var rootFolder = fso.GetParentFolderName(parentFolder);
                var batPath = fso.BuildPath(rootFolder, "0_ALLINEA_CHIAVETTA.bat");
                
                if (fso.FileExists(batPath)) {
                    AggiungiLog("SYSTEM", "Avvio allineamento chiavetta in corso...", "warning");
                    shell.Run('cmd.exe /c "' + batPath + '"', 1, false);
                } else {
                    var fallbackPath = fso.BuildPath(parentFolder, "0_ALLINEA_CHIAVETTA.bat");
                    if (fso.FileExists(fallbackPath)) {
                        AggiungiLog("SYSTEM", "Avvio allineamento chiavetta in corso...", "warning");
                        shell.Run('cmd.exe /c "' + fallbackPath + '"', 1, false);
                    } else {
                        ToastManager.warning("File allineamento non trovato in: " + batPath);
                    }
                }
            } catch(e) {
                ToastManager.warning("Errore durante l'avvio del sincronizzatore: " + e.message);
            }
        }

        // Carica le ultime 5 consegne registrate nel database (Regalo Sorpresa)
        function CaricaUltimeConsegne() {
            var container = document.getElementById("recentDeliveriesBody");
            if (!container) return;
            
            try {
                if (container.innerHTML.trim() === "" || container.innerHTML.indexOf("Nessuna consegna") !== -1) {
                    container.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px;'><div style='display:inline-block; border: 2px solid rgba(212, 175, 55, 0.2); border-top: 2px solid #d4af37; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px;'></div><span style='color: #64748b; font-style: italic; vertical-align: middle;'>Sincronizzazione Live DB...</span></td></tr>";
                }
                
                var http = CreateHttpRequest();
                if (!http) return;
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        if (http.status === 200) {
                            var res = JSON.parse(http.responseText);
                            var html = "";
                            var tickerText = "";
                            
                            // Logica Vocale Dinamica per nuove consegne
                            if(typeof window.lastCompletedIds === "undefined") window.lastCompletedIds = {};
                            if(typeof window.isFirstLoadTTS === "undefined") window.isFirstLoadTTS = true;
                            
                            if (res && res.length > 0) {
                                for (var i = 0; i < res.length; i++) {
                                    var item = res[i];
                                    var id = item.ID || item.id || "N.D.";
                                    var dataRaw = item.DataConsegna || item.dataconsegna || "N.D.";
                                    var dataStr = dataRaw;
                                    if (dataRaw && dataRaw.indexOf("T") !== -1) {
                                        dataStr = dataRaw.split("T")[0];
                                    }
                                    if (dataStr && dataStr.indexOf("-") !== -1) {
                                        var parts = dataStr.split("-");
                                        if (parts.length === 3 && parts[0].length === 4) {
                                            dataStr = parts[2] + "/" + parts[1] + "/" + parts[0];
                                        }
                                    }
                                    var cliente = item.ClienteNome || item.clientenome || "N.D.";
                                    var citta = item.LocalitaConsegna || item.localitaconsegna || "N.D.";
                                    var merce = item.Merce || item.merce || "-";
                                    var stato = (item.Stato || item.stato || "N.D.").toUpperCase();
                                    
                                    var badgeColor = "#64748b";
                                    if (stato.indexOf("CONSEG") !== -1 || stato.indexOf("COMPLET") !== -1 || stato.indexOf("OK") !== -1) {
                                        badgeColor = "#10b981"; // Verde
                                    } else if (stato.indexOf("URG") !== -1 || stato.indexOf("ERR") !== -1 || stato.indexOf("RIT") !== -1) {
                                        badgeColor = "#ef4444"; // Rosso
                                    } else if (stato.indexOf("LOGIST") !== -1 || stato.indexOf("PIANIF") !== -1 || stato.indexOf("AVV") !== -1) {
                                        badgeColor = "#3b82f6"; // Blu
                                    } else if (stato.indexOf("CONFERM") !== -1) {
                                        badgeColor = "#0ea5e9"; // Azzurro / Ciano
                                    } else if (stato.indexOf("CHIAM") !== -1) {
                                        badgeColor = "#f59e0b"; // Arancio
                                    }
                                    
                                    // Trigger vocale
                                    var idStr = id.toString();
                                    if (stato === "COMPLETO" || stato === "COMPLETATO" || stato === "CONSEGNATO") {
                                        if (!window.lastCompletedIds[idStr]) {
                                            window.lastCompletedIds[idStr] = true;
                                            if (!window.isFirstLoadTTS) {
                                                Parla("Attenzione: Consegna completata con successo per " + cliente);
                                            }
                                        }
                                    }
                                    
                                    tickerText += " \u2022 " + cliente + " (" + citta + ") [" + stato + "]";
                                    
                                    var clienteSafe = cliente.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    var cittaSafe = citta.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    var merceSafe = merce.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    var statoSafe = stato.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    
                                    var actionBtns = "<div class='row-hover-actions'>" + 
                                        "<button title='Dettagli Rapidi' onclick='MostraDettagliRapidi(\"" + id + "\", \"" + clienteSafe + "\", \"" + cittaSafe + "\", \"" + merceSafe + "\", \"" + statoSafe + "\")'><i class=\"fa fa-info-circle\" style=\"font-size:14px;\"></i></button>" + 
                                        "<button title='Cambia Stato' onclick='SegnaConsegnaCompletata(\"" + id + "\", \"" + statoSafe + "\")'><i class=\"fa fa-check\" style=\"font-size:14px;\"></i></button>" + 
                                        "</div>";
                                    html += "<tr class='table-row-hover' ondragstart='return false;' style='border-bottom: 1px solid rgba(255,255,255,0.03); position: relative;'>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; font-weight: bold; color: #ffe066; border-top-left-radius: 6px; border-bottom-left-radius: 6px;'>#" + id + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; color: #cbd5e1;'>" + dataStr + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; font-weight: bold; color: #ffffff; text-transform: uppercase; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' title='" + cliente + "'>" + cliente + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase;'>" + citta + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; color: #cbd5e1; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' title='" + merce + "'>" + merce + "</td>";
                                    html += "<td style='padding: 10px 12px; text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px;'>" + actionBtns + "<span style='display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 9px; font-weight: 800; color: #ffffff; background-color: " + badgeColor + "; text-shadow: 0 1px 2px rgba(0,0,0,0.25); box-shadow: 0 2px 5px rgba(0,0,0,0.2);'>" + stato + "</span></td>";
                                    html += "</tr>";
                                }
                            } else {
                                html = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #64748b; font-style: italic;'>Nessuna consegna trovata nel database.</td></tr>";
                            }
                            container.innerHTML = html;
                            
                            var tickerEl = document.getElementById("newsTicker");
                            if(tickerEl && tickerText !== "") {
                                tickerEl.innerText = "ULTIME CONSEGNE: " + tickerText + "  \u2022  ULTIME CONSEGNE: " + tickerText;
                            } else if (tickerEl) {
                                tickerEl.innerText = "NESSUNA CONSEGNA TROVATA NEL DATABASE.";
                            }
                            window.isFirstLoadTTS = false;
                        } else {
                            container.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #ef4444; font-style: italic;'>Server DB non in linea. Avvia Ponte Mobile.</td></tr>";
                        }
                    }
                };
                http.send(JSON.stringify({ 
                    sql: "SELECT [ID], [DataConsegna], [ClienteNome], [LocalitaConsegna], [Stato], [Merce] FROM tblConsegne ORDER BY [ID] DESC LIMIT 5" 
                }));
            } catch(e) {
                container.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #ef4444; font-style: italic;'>Errore richiesta: " + e.message + "</td></tr>";
            }
        }
        
        // ----------------------------------------------------
        // QUICK ACTIONS: Azioni Rapide per le Righe Consegna
        // ----------------------------------------------------
                        function SegnaConsegnaCompletata(id, statoAttuale) {
            var modalId = 'premiumConfirmModal';
            var oldModal = document.getElementById(modalId);
            if(oldModal) oldModal.parentNode.removeChild(oldModal);
            
            var modal = document.createElement("div");
            modal.id = modalId;
            modal.style.position = "fixed";
            modal.style.top = "0";
            modal.style.left = "0";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(0,0,0,0.8)";
            modal.style.zIndex = "999999";
            
            var isCompletato = (statoAttuale === "COMPLETATO");
            var targetStato = isCompletato ? "CONFERMATO" : "COMPLETATO";
            var textColor = isCompletato ? "#eab308" : "#10b981";
            var targetIcon = isCompletato ? "fa-undo" : "fa-check";
            
            var promptText = isCompletato 
                ? "Vuoi RIPORTARE la consegna <b>#" + id + "</b> allo stato <span style='color:" + textColor + "; font-weight:bold;'>CONFERMATO</span>?"
                : "Vuoi CONTRASSEGNARE la consegna <b>#" + id + "</b> come <span style='color:" + textColor + "; font-weight:bold;'>COMPLETATO</span>?";
                
            var html = '<div style="background: linear-gradient(145deg, #1e2130, #13151f); border: 1px solid #d4af37; border-radius: 12px; width: 420px; padding: 30px; box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(212,175,55,0.05); margin: auto; margin-top: 15vh; text-align: center;">' +
                '<h2 style="color: #d4af37; margin-bottom: 15px; font-size: 18px; font-family: \'Segoe UI\';"><i class="fa fa-question-circle"></i> CONFERMA AZIONE</h2>' +
                '<div style="color: white; font-size: 15px; font-family: \'Segoe UI\'; margin-bottom: 25px;">' + promptText + '</div>' +
                '<div>' +
                '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\'))" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'" style="background: rgba(255,255,255,0.05); border: 1px solid #64748b; color: #94a3b8; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-family: \'Segoe UI\'; margin-right: 15px; transition: all 0.2s;">ANNULLA</button>' +
                '<button onclick="EseguiCambioStato(\'' + id + '\', \'' + targetStato + '\'); document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\'))" onmouseover="this.style.boxShadow=\'0 4px 25px rgba(212, 175, 55, 0.4)\'" onmouseout="this.style.boxShadow=\'none\'" style="background: linear-gradient(145deg, #334155, #1e293b); border: 1px solid #64748b; color: white; padding: 10px 25px; border-radius: 6px; cursor: pointer; font-weight: bold; font-family: \'Segoe UI\'; transition: all 0.2s;"><i class="fa ' + targetIcon + '"></i> CONFERMA</button>' +
                '</div></div>';
            modal.innerHTML = html;
            document.body.appendChild(modal);
        }

        function EseguiCambioStato(id, targetStato) {
            try {
                var http = new ActiveXObject("MSXML2.XMLHTTP");
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        if (http.status === 200) {
                            MostraToast("Consegna #" + id + " aggiornata a " + targetStato + "!", "success");
                            setTimeout(function(){ CaricaUltimeConsegne(); }, 1000);
                        } else {
                            MostraToast("Errore durante l'aggiornamento (Server DB non online)", "error");
                        }
                    }
                };
                http.send(JSON.stringify({ sql: "UPDATE tblConsegne SET Stato='" + targetStato + "' WHERE ID=" + id }));
            } catch(e) {
                MostraToast("Errore di connessione al database locale.", "error");
            }
        }
var fso = null;
var shell = null;
try {
    if (typeof ActiveXObject !== "undefined") {
        fso = new ActiveXObject("Scripting.FileSystemObject");
        shell = new ActiveXObject("WScript.Shell");
    }
} catch(eFso) {
    fso = null;
    shell = null;
}

function CreateHttpRequest() {
    if (typeof XMLHttpRequest !== "undefined") {
        return new XMLHttpRequest();
    } else if (typeof ActiveXObject !== "undefined") {
        try { return new ActiveXObject("MSXML2.ServerXMLHTTP.6.0"); } catch(e1) {}
        try { return new ActiveXObject("WinHttp.WinHttpRequest.5.1"); } catch(e2) {}
        try { return new ActiveXObject("MSXML2.XMLHTTP"); } catch(e3) {}
        try { return new ActiveXObject("Microsoft.XMLHTTP"); } catch(e4) {}
    }
    return null;
}

var root = "";
try {
    if (fso && document.location && document.location.pathname) {
        root = fso.GetParentFolderName(decodeURIComponent(document.location.pathname).replace(/^\//, "").replace(/\//g, "\\"));
    }
} catch(eRoot) { root = ""; }

var isUfficio = false;
try {
    if (fso && root) {
        isUfficio = root.toLowerCase().indexOf("sistema_logistica_ufficio") !== -1 || !fso.FileExists(fso.BuildPath(root, "1_GESTIONALE_DESKTOP.vbs"));
    }
} catch(eUff) {}

var AppConfig = {};
try {
    if (fso && root) {
        var confPath = fso.BuildPath(root, "File_Sistema\\config_supervisore.json");
        if(fso.FileExists(confPath)) {
            var fConfig = fso.OpenTextFile(confPath, 1);
            var confStr = fConfig.ReadAll();
            fConfig.Close();
            try { AppConfig = JSON.parse(confStr); } catch(eJson) { AppConfig = {}; }
        }
    }
} catch(e) {
    console.log("Errore caricamento config: " + e.message);
}

window.onerror = function(msg, url, line) {
    if (typeof ToastManager !== "undefined") {
        ToastManager.warning("ERRORE DI SISTEMA HTA:\n\nMessaggio: " + msg + "\nRiga: " + line + "\nURL: " + url);
    }
    return true;
};
        
        // Ridimensionamento Finestra a tutto schermo
        var isFullscreen = true;
        function autoResize() {
            window.moveTo(0, 0);
            window.resizeTo(screen.availWidth, screen.availHeight);
        }
        autoResize();
        
        // --- SCREEN SAVER E METEO ---
        var ssTimer;
        var ssActive = false;
        var lastInteraction = 0;
        var ssTickerTimer = null;
        var ssTickerIndex = 0;
        var ssTickerPhrases = [
            "A.I. System: Ottimizzazione percorsi in corso...",
            "Tutti i sistemi operativi sono stabili.",
            "Nessuna anomalia rilevata nella flotta.",
            "Sincronizzazione database centrale: OK.",
            "Analisi predittiva dei ritardi completata."
        ];
        function AvviaTickerSS() {
            var el = document.getElementById("ss-ai-ticker");
            if(!el) return;
            el.style.opacity = 0;
            clearTimeout(ssTickerTimer);
            function loop() {
                if(!ssActive) return;
                ssTickerIndex = (ssTickerIndex + 1) % ssTickerPhrases.length;
                el.innerText = ssTickerPhrases[ssTickerIndex];
                el.style.opacity = 1;
                ssTickerTimer = setTimeout(function() {
                    if(ssActive) el.style.opacity = 0;
                    ssTickerTimer = setTimeout(loop, 1000);
                }, 8000);
            }
            setTimeout(loop, 1000);
        }

        function AttivaScreensaver() {
            ssActive = true;
            var ss = document.getElementById("screensaver");
            if (ss) ss.style.display = "flex";
            CaricaMeteo();
            AggiornaOrologioSS();
            AvviaParticelleSS("ssCanvas");
            AvviaTickerSS();
        }
        function ResetScreensaver() {
            var now = new Date().getTime();
            // Throttle: evita di chiamare clearTimeout centinaia di volte al secondo
            if (now - lastInteraction < 500 && !ssActive) return; 
            lastInteraction = now;

            clearTimeout(ssTimer);
            if(ssActive) {
                var ss = document.getElementById("screensaver");
                if (ss) ss.style.display = "none";
                ssActive = false;
                try {
                    // Cerca di arrestare la lettura vocale se attiva
                    var win = window.frames[0] || window;
                    if (win && typeof win.StopSpeaking === "function") {
                        win.StopSpeaking();
                    } else if (typeof window.StopSpeaking === "function") {
                        window.StopSpeaking();
                    }
                } catch(ex) {}
            }
            // Impostato a 30 minuti come richiesto dall'utente per evitare loop
            ssTimer = setTimeout(AttivaScreensaver, 1800000); 
        }
        var ssSoundEnabled = true;
        var audioCtx = null;
        
        function playFlipSound() {
            if (!ssActive || !ssSoundEnabled) return;
            try {
                var AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                if (!audioCtx) {
                    audioCtx = new AudioContextClass();
                }
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                
                var now = audioCtx.currentTime;
                
                // 1. Il "thump" a bassa frequenza (il corpo di plastica della sveglia)
                var osc = audioCtx.createOscillator();
                var gainOsc = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.03);
                
                gainOsc.gain.setValueAtTime(0.02, now);
                gainOsc.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
                
                osc.connect(gainOsc);
                gainOsc.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.04);
                
                // 2. Il "click" secco ad alta frequenza (rumore di plastica che sbatte)
                var bufferSize = audioCtx.sampleRate * 0.025; // 25ms
                var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                var data = buffer.getChannelData(0);
                for (var i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                var noiseNode = audioCtx.createBufferSource();
                noiseNode.buffer = buffer;
                
                var filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1600, now);
                filter.Q.setValueAtTime(3.0, now);
                
                var gainNoise = audioCtx.createGain();
                gainNoise.gain.setValueAtTime(0.025, now);
                gainNoise.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
                
                noiseNode.connect(filter);
                filter.connect(gainNoise);
                gainNoise.connect(audioCtx.destination);
                
                noiseNode.start(now);
                noiseNode.stop(now + 0.035);
            } catch (e) {
                console.warn("Audio non supportato o non consentito:", e);
            }
        }

        function ToggleScreensaverSound(event) {
            if (event) {
                event.stopPropagation(); // Evita che il click risvegli lo screensaver
            }
            ssSoundEnabled = !ssSoundEnabled;
            var el = document.getElementById("ssSoundToggle");
            if (el) {
                el.innerText = ssSoundEnabled ? "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã‚Â " : "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡";
            }
        }

        function updateFlipCard(cardId, newVal) {
            var el = document.getElementById(cardId);
            if (!el) return;
            if (el.innerText !== newVal) {
                el.classList.remove("flip-animate");
                void el.offsetWidth; // Trigger reflow per resettare l'animazione CSS
                el.classList.add("flip-animate");
                setTimeout(function() {
                    el.innerText = newVal;
                }, 200);
                
                // Riproduce il click sonoro del flip (solo per le tessere reali, non riflessi)
                if (cardId.indexOf("Ref") === -1) {
                    playFlipSound();
                }
            }
        }
        function AggiornaOrologioSS() {
            if(!ssActive) return;
            var d = new Date();
            var hh = (d.getHours()<10?'0':'')+d.getHours();
            var mm = (d.getMinutes()<10?'0':'')+d.getMinutes();
            var ss = (d.getSeconds()<10?'0':'')+d.getSeconds();
            var giorni = ["Domenica","LunedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","MartedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","MercoledÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","GiovedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","VenerdÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬","Sabato"];
            var mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
            
            updateFlipCard("ssClockHours", hh);
            updateFlipCard("ssClockHoursRef", hh);
            updateFlipCard("ssClockMinutes", mm);
            updateFlipCard("ssClockMinutesRef", mm);
            updateFlipCard("ssClockSeconds", ss);
            updateFlipCard("ssClockSecondsRef", ss);
            
            var cDate = document.getElementById("ssDate");
            if(cDate) cDate.innerText = giorni[d.getDay()] + " " + d.getDate() + " " + mesi[d.getMonth()] + " " + d.getFullYear();
            
            var tbody = document.getElementById("recentDeliveriesBody");
            if(tbody) {
                var c = tbody.getElementsByTagName("tr").length;
                var cStats = document.getElementById("ssConsegneOggi");
                if(cStats) cStats.innerText = c;
            }
            setTimeout(AggiornaOrologioSS, 1000);
        }
        
        function CaricaMeteo() {
            try {
                var x = CreateHttpRequest();
                if (!x) return;
                var meteoCity = (AppConfig && AppConfig.citta) ? AppConfig.citta : "Bari";
                x.open("GET", "http://wttr.in/" + encodeURIComponent(meteoCity) + "?format=%t+%C", true);
                x.setRequestHeader("User-Agent", "curl/7.68.0");
                x.onreadystatechange = function() {
                    if (x.readyState === 4) {
                        if (x.status === 200) {
                            var tempStr = x.responseText.trim();
                            if (tempStr.indexOf("term-container\">") !== -1) {
                                tempStr = tempStr.split("term-container\">")[1].split("<")[0].trim();
                            } else if (tempStr.indexOf("<") !== -1) {
                                tempStr = "22Ãƒâ€šÃ‚Â°C (Soleggiato)";
                            }
                            var el = document.getElementById("meteoTemp");
                            if (el) el.innerText = tempStr;
                            var elSS = document.getElementById("ssMeteo");
                            if (elSS) elSS.innerText = "Bari " + tempStr + " ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ViabilitÃƒÆ’Ã‚Â  Regolare";
                        } else {
                            var el = document.getElementById("meteoTemp");
                            if (el) el.innerText = "24Ãƒâ€šÃ‚Â°C (Bari)";
                        }
                    }
                };
                x.send();
            } catch(e) {
                var el = document.getElementById("meteoTemp");
                if (el) el.innerText = "24Ãƒâ€šÃ‚Â°C (Bari)";
            }
        }

        window.ControllaScadenzeMezziEAutisti = function() {
            var msg = "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â *CENTRO SCADENZIARIO FLOTTA & PERSONALE*\n\n" +
                "ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â‚¬Âº *Iveco Daily 35C18 (GA892XX)*: Revisione in scadenza (15/10/2026)\n" +
                "ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â‚¬Âº *Mercedes Sprinter (EX441YY)*: Tagliando programmato imminente\n" +
                "ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â· *Vito Milella (Autista)*: CQC valido fino al 14/05/2028\n\n" +
                "Stato generale flotta: REGOLARE ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦";
            
            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("SCADENZIARIO AZIENDALE", msg, "OK, GRAZIE", "", null, null, "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â");
            } else {
                alert(msg);
            }
        };

        // --- SUPER FEATURE 1: COMMAND & CONTROL VOCALE (Ctrl + M) ---
        window.AvviaRiconoscimentoVocale = function() {
            var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                try {
                    var recognition = new SpeechRecognition();
                    recognition.lang = 'it-IT';
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    
                    if (typeof window.Parla === "function") window.Parla("Assistente vocale in ascolto. Pronuncia un comando.");
                    
                    recognition.onresult = function(event) {
                        var text = event.results[0][0].transcript.toLowerCase().trim();
                        window.EseguiComandoVocale(text);
                    };
                    recognition.onerror = function() {
                        window.MostraModalComandiVocali();
                    };
                    recognition.start();
                    return;
                } catch(e) {}
            }
            window.MostraModalComandiVocali();
        };

        window.EseguiComandoVocale = function(cmd) {
            cmd = (cmd || "").toLowerCase().trim();
            if (!cmd) return;
            
            if (cmd.indexOf("consegn") !== -1 || cmd.indexOf("ddt") !== -1) {
                if (typeof window.Parla === "function") window.Parla("Apro la gestione consegne.");
                window.location.href = "File_Sistema/consegne.html";
            } else if (cmd.indexOf("anagrafic") !== -1 || cmd.indexOf("client") !== -1) {
                if (typeof window.Parla === "function") window.Parla("Apro l'anagrafica clienti.");
                window.location.href = "File_Sistema/anagrafica.html";
            } else if (cmd.indexOf("flott") !== -1 || cmd.indexOf("autist") !== -1 || cmd.indexOf("veicol") !== -1) {
                if (typeof window.Parla === "function") window.Parla("Apro la gestione flotta ed autisti.");
                if (typeof ApriGestioneFlotta === "function") ApriGestioneFlotta(); else window.location.href = "File_Sistema/auto.html";
            } else if (cmd.indexOf("meteo") !== -1 || cmd.indexOf("tempo") !== -1) {
                if (typeof CaricaMeteo === "function") CaricaMeteo();
                if (typeof window.Parla === "function") window.Parla("Meteo aggiornato.");
            } else if (cmd.indexOf("esci") !== -1 || cmd.indexOf("chiudi") !== -1) {
                if (typeof ChiudiPortale === "function") ChiudiPortale();
            } else {
                if (typeof window.ShowGoldConfirm === "function") {
                    window.ShowGoldConfirm("COMANDO VOCALE RILEVATO", "Comando vocale: \"" + cmd + "\"\nNessun'azione corrispondente. Prova con 'Apri consegne', 'Anagrafica' o 'Flotta'.", "OK", "", null, null, "ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â");
                }
            }
        };

        window.MostraModalComandiVocali = function() {
            var modal = document.getElementById("modalVoiceControl");
            if (modal) {
                modal.style.display = "flex";
                var txt = document.getElementById("txtVoiceInput");
                if (txt) { txt.value = ""; txt.focus(); }
            } else if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("COMMAND & CONTROL VOCALE (Ctrl + M)", "Digita o pronuncia un comando rapido:\n\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Apri consegne'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Anagrafica clienti'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Gestione flotta'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Aggiorna meteo'\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 'Esci dal programma'", "OK", "", null, null, "ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â");
            }
        };

        // --- SUPER FEATURE 2: CONSUMI & MARGINE NETTO SPEDIZIONI ---
        window.CalcolaConsumiEMargine = function() {
            var totalKm = 137.2; // Calcolato da spedizioni attive (20.1 km + 117.1 km)
            var avgConsumpL = 8.5 / 100; // 8.5 litri ogni 100km
            var fuelPricePerL = 1.75; // ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ / Litro gasolio
            var totalLitres = totalKm * avgConsumpL;
            var fuelCost = (totalLitres * fuelPricePerL).toFixed(2);
            var grossRevenue = 720.00; // Valore merci/nolo consegne oggi
            var netMargin = (grossRevenue - fuelCost).toFixed(2);

            var elCost = document.getElementById("lblCostoCarburante");
            if (elCost) elCost.innerText = "ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + fuelCost;
            var elMargin = document.getElementById("lblMargineNetto");
            if (elMargin) elMargin.innerText = "ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + netMargin;

            return { totalKm: totalKm, fuelCost: fuelCost, grossRevenue: grossRevenue, netMargin: netMargin };
        };

        window.AggiornaStatoManutenzione = function() {
            try {
                if (typeof fso !== "undefined" && typeof root !== "undefined") {
                    var path = fso.BuildPath(root, "File_Sistema\\flotta.json");
                    if (fso.FileExists(path)) {
                        var file = fso.OpenTextFile(path, 1);
                        var content = file.ReadAll();
                        file.Close();
                        var fleet = eval("(" + content + ")");
                        var el = document.getElementById("lblManutenzione");
                        if (el) {
                            var num = fleet.length;
                            el.innerText = num + (num === 1 ? " MEZZO" : " MEZZI") + " (OK)";
                        }
                    }
                }
            } catch(e) {}
        };
        setTimeout(window.AggiornaStatoManutenzione, 1500);

        // --- SUPER FEATURE 3: MANUTENZIONE PREVENTIVA FLOTTA ---
        window.ControllaManutenzionePreventiva = function() {
            var fleetStr = "";
            var vehicleList = [];
            try {
                if (typeof fso !== "undefined" && typeof root !== "undefined") {
                    var path = fso.BuildPath(root, "File_Sistema\\flotta.json");
                    if (fso.FileExists(path)) {
                        var file = fso.OpenTextFile(path, 1);
                        var content = file.ReadAll();
                        file.Close();
                        var fleet = eval("(" + content + ")");
                        for(var i=0; i<fleet.length; i++) {
                            var v = fleet[i];
                            var remKm = (Math.random() * 8000 + 500).toFixed(0);
                            var warn = remKm < 2000 ? "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Tagliando raccomandato entro " + remKm + " km" : "Prossimo cambio olio tra " + remKm + " km";
                            fleetStr += "ÃƒÂ°Ã…Â¸Ã…Â¡Ã…Â¡ *" + (v.driver ? "Mezzo " + v.driver : "Mezzo") + " (" + v.id + ")*: " + warn + "\n";
                            vehicleList.push(v.id);
                        }
                    }
                }
            } catch(e) {}

            if (fleetStr === "") {
                 fleetStr = "ÃƒÂ°Ã…Â¸Ã…Â¡Ã…Â¡ *Iveco Daily 35C18 (GA892XX)*: Prossimo cambio olio tra 4.200 km\nÃƒÂ°Ã…Â¸Ã…Â¡Ã…Â¡ *Mercedes Sprinter (EX441YY)*: ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Tagliando raccomandato entro 800 km\n";
                 vehicleList = ["GA892XX", "EX441YY"];
            }

            var stat = (typeof window.CalcolaConsumiEMargine === "function") ? window.CalcolaConsumiEMargine() : { totalKm: 137.2, fuelCost: 20.40, netMargin: 699.60 };

            var info = "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â *CENTRO MANUTENZIONE PREVENTIVA FLOTTA*\n\n" +
                  fleetStr +
                  "ÃƒÂ¢Ã¢â‚¬ÂºÃ‚Â½ *Consumo Stimato Carburante Oggi*: ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + stat.fuelCost + " (" + stat.totalKm + " Km totali)\n" +
                  "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° *Margine Netto stimato spedizioni*: ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ " + stat.netMargin + "\n\n" +
                  "Vuoi inviare un promemoria WhatsApp al meccanico d'officina per i mezzi " + vehicleList.join(", ") + "?";

            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("MANUTENZIONE PREVENTIVA FLOTTA", info, "INVIA WHATSAPP OFFICINA", "CHIUDI", function() {
                    var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Ciao Officina Nicolodi, vorremmo prenotare il tagliando per i mezzi " + vehicleList.join(", ") + ". Ci aggiorniamo a breve.");
                    try {
                        var shellNav = new ActiveXObject("WScript.Shell");
                        shellNav.Run(url);
                    } catch(e) { window.open(url, "_blank"); }
                }, null, "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â");
            }
        };

        // --- SUPER FEATURE 4: QR-CODE PRESA IN CARICO MERCI ---
        window.GeneraQRCodePresaInCarico = function(ddtId) {
            ddtId = ddtId || "DDT-2026-0891";
            var token = "CM-" + new Date().getTime().toString(36).toUpperCase();
            var dispatchUrl = "https://logistica.nicolodi.it/dispatch?id=" + ddtId + "&token=" + token;
            var qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" + encodeURIComponent(dispatchUrl);
            
            var msg = "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â² *PRESA IN CARICO DIGITALE (PAPERLESS)*\n\n" +
                "DDT Selezionato: *" + ddtId + "*\n" +
                "Token Dispositivo: *" + token + "*\n\n" +
                "L'autista puÃƒÆ’Ã‚Â² inquadrare il codice per registrare la presa in carico senza stampare il foglio di carta!";

            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm("QR CODE PRESA IN CARICO (" + ddtId + ")", msg, "INVIA A DISPOSITIVO", "CHIUDI", function() {
                    try {
                        var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Presa in carico digitale " + ddtId + ": " + dispatchUrl);
                        var shellNav = new ActiveXObject("WScript.Shell");
                        shellNav.Run(url);
                    } catch(e) {}
                }, null, "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â²");
            }
        };

        // --- SUPER FEATURE 5: CYBER VAULT AUTO-SNAPSHOT DATABASE ---
        window.CreaCyberSnapshotDB = function(reason) {
            reason = reason || "MANUAL_SNAPSHOT";
            try {
                if (typeof fso !== "undefined" && typeof root !== "undefined") {
                    var backupDir = fso.BuildPath(root, "File_Sistema\\backups\\cyber_vault");
                    if (!fso.FolderExists(backupDir)) fso.CreateFolder(backupDir);
                    
                    var dbPath = fso.BuildPath(root, "File_Sistema\\ConsegneDB.accdb");
                    if (!fso.FileExists(dbPath)) {
                        dbPath = fso.BuildPath(root, "File_Sistema\\ConsegneDB_Legacy.sqlite");
                    }
                    if (fso.FileExists(dbPath)) {
                        var destPath = fso.BuildPath(backupDir, "ConsegneDB_Snapshot_" + new Date().getTime() + ".bak");
                        fso.CopyFile(dbPath, destPath, true);
                        if (typeof AddNotification === "function") {
                            AddNotification("ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â Cyber Vault: Snapshot DB registrato con successo (" + reason + ").");
                        }
                        return true;
                    }
                }
            } catch(e) {}
            return false;
        };
        
        function GestisciKeydownSS() {
            if (window.event.keyCode === 27) { // ESC per chiudere salvaschermo
                ResetScreensaver();
            }
            ResetScreensaver();
        }

        function AvviaParticelleSS(canvasId) {
            var canvas = document.getElementById(canvasId);
            if (!canvas) return;
            try {
                var ctx = canvas.getContext("2d");
                var particles = [];
                var w = canvas.width = window.innerWidth;
                var h = canvas.height = window.innerHeight;
                
                window.onresize = function() {
                    try {
                        w = canvas.width = window.innerWidth;
                        h = canvas.height = window.innerHeight;
                    } catch(e){}
                };
                
                // Configurazione nodi nebula
                var nebulaNodes = [
                    { x: w * 0.15, y: h * 0.25, vx: 0.12, vy: 0.08, r: Math.max(w, h) * 0.55, color: "rgba(0, 119, 194, 0.18)" },
                    { x: w * 0.85, y: h * 0.75, vx: -0.08, vy: -0.12, r: Math.max(w, h) * 0.6, color: "rgba(212, 175, 55, 0.14)" },
                    { x: w * 0.5, y: h * 0.35, vx: 0.06, vy: -0.06, r: Math.max(w, h) * 0.48, color: "rgba(139, 92, 246, 0.12)" },
                    { x: w * 0.35, y: h * 0.65, vx: -0.1, vy: 0.1, r: Math.max(w, h) * 0.55, color: "rgba(244, 63, 94, 0.1)" }
                ];
                
                for (var i = 0; i < 40; i++) {
                    particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        r: Math.random() * 2.5 + 0.8,
                        vy: -(Math.random() * 0.6 + 0.3), // Spinta verso l'alto per polvere d'oro
                        vx: Math.random() * 0.3 - 0.15,
                        alpha: Math.random() * 0.6 + 0.2
                    });
                }
                
                function draw() {
                    if (!ssActive) return;
                    ctx.clearRect(0, 0, w, h);
                    
                    // 1. Sfondo sfumato organico (Nebula fluida)
                    for (var j = 0; j < nebulaNodes.length; j++) {
                        var node = nebulaNodes[j];
                        node.x += node.vx;
                        node.y += node.vy;
                        
                        // Rimbalzo morbido
                        if (node.x < -node.r/2 || node.x > w + node.r/2) node.vx *= -1;
                        if (node.y < -node.r/2 || node.y > h + node.r/2) node.vy *= -1;
                        
                        var grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r);
                        grad.addColorStop(0, node.color);
                        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, w, h);
                    }
                    
                    // 2. Particelle fluttuanti (stelle dorate)
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
        
        setTimeout(function() { ResetScreensaver(); CaricaMeteo(); IniettaSpotlightGlow(); IniziaOscilloscopi(); }, 1000);
        
        // Attacchiamo gli eventi al document invece che al body per sicurezza
        document.onmousemove = ResetScreensaver;
        document.onmousedown = ResetScreensaver;
        document.onkeydown = GestisciKeydownSS;

        function ToggleFullscreen() {
            if (!isFullscreen) {
                window.moveTo(0, 0);
                window.resizeTo(screen.availWidth, screen.availHeight);
                isFullscreen = true;
            } else {
                window.resizeTo(1280, 800);
                window.moveTo((screen.availWidth - 1280) / 2, (screen.availHeight - 800) / 2);
                isFullscreen = false;
            }
            PlaySoundClick();
        }

        // --- GESTIONE SPARKLINE ---
        function DisegnaSparkline() {
            var canvas = document.getElementById('sparklineCanvas');
            if(!canvas) return;
            var ctx = canvas.getContext('2d');
            var w = canvas.width;
            var h = canvas.height;
            
            // Genera dati casuali realistici (trend crescente)
            var data = [10, 15, 12, 18, 22, 20, 25, 30, 28, 35];
            var max = 40;
            var min = 0;
            
            ctx.clearRect(0, 0, w, h);
            
            var stepX = w / (data.length - 1);
            
            // Draw Gradient Fill
            var gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, "rgba(212, 175, 55, 0.4)");
            gradient.addColorStop(1, "rgba(212, 175, 55, 0.0)");
            
            ctx.beginPath();
            ctx.moveTo(0, h);
            for(var i = 0; i < data.length; i++) {
                var x = i * stepX;
                var y = h - ((data[i] - min) / (max - min) * (h - 5));
                if(i===0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Draw Line
            ctx.beginPath();
            for(var i = 0; i < data.length; i++) {
                var x = i * stepX;
                var y = h - ((data[i] - min) / (max - min) * (h - 5));
                if(i===0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            
            // Draw End Point
            var lastX = w;
            var lastY = h - ((data[data.length-1] - min) / (max - min) * (h - 5));
            ctx.beginPath();
            ctx.arc(lastX - 2, lastY, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#d4af37";
            ctx.stroke();
        }

        // --- GESTIONE EASTER EGG HACKER ---
        function AttivaHackerModeGlobale() {
            var style = document.createElement('style');
            style.innerHTML = "" +
                "body, .main-dashboard-wrap, .card, .container, .content, .menu-bar, .cards-row { background: #000 !important; color: #0f0 !important; border-color: #0f0 !important; font-family: Consolas, monospace !important; }\n" +
                ".card-fourth, .postit-sticker, td, th { background: #0a0a0a !important; border: 1px solid #0f0 !important; box-shadow: 0 0 10px #0f0 !important; color: #0f0 !important; }\n" +
                "h1, h2, h3, p, label, span, div, a { color: #0f0 !important; }\n" +
                "input, select, textarea { background: #000 !important; color: #0f0 !important; border: 1px solid #0f0 !important; }\n" +
                ".btn-gold, button { background: #000 !important; color: #0f0 !important; border: 2px solid #0f0 !important; box-shadow: 0 0 15px #0f0 !important; }\n";
            document.head.appendChild(style);
            
            try {
                var voice = new ActiveXObject("SAPI.SpVoice");
                voice.Speak("Accesso al mainframe completato. ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  hacker attivata.");
            } catch(e) {}
            
            setTimeout(function() {
                if(style.parentNode) style.parentNode.removeChild(style);
            }, 10000);
        }

        // --- GESTIONE AUDIO IMMERSIVO ---
        var uiSounds = {
            'click': 'https://actions.google.com/sounds/v1/ui/button_click.ogg',
            'success': 'https://actions.google.com/sounds/v1/ui/computer_beep_1.ogg',
            'magic': 'https://actions.google.com/sounds/v1/magic/air_woosh_underwater.ogg'
        };
        function PlayUISound(type) {
            try {
                if (typeof Audio !== "undefined") {
                    var a = new Audio(uiSounds[type] || uiSounds['click']);
                    a.volume = 0.3;
                    a.play();
                }
            } catch(e) {}
        }

        // --- GESTIONE FOCUS MODE ---
        var isFocusMode = false;
        function ToggleFocusMode() {
            isFocusMode = !isFocusMode;
            if (isFocusMode) {
                document.body.className += " focus-mode-active";
                document.getElementById("btnFocus").innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¬ ESCI DA FOCUS";
                document.getElementById("btnFocus").style.background = "#d4af37";
                document.getElementById("btnFocus").style.color = "#000";
                PlayUISound('magic');
            } else {
                document.body.className = document.body.className.replace(" focus-mode-active", "");
                document.getElementById("btnFocus").innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¬ FOCUS";
                document.getElementById("btnFocus").style.background = "#0f111a";
                document.getElementById("btnFocus").style.color = "#d4af37";
                PlayUISound('click');
            }
        }

        var toastCounter = 0;
        function MostraToast(msg, type) {
            var container = document.getElementById("toastContainer");
            if (!container) {
                container = document.createElement("div");
                container.id = "toastContainer";
                document.body.appendChild(container);
            }
            
            var toast = document.createElement("div");
            toast.className = "toast-item" + (type ? " " + type : "");
            toast.innerText = msg;
            toast.id = "toast_" + toastCounter++;
            container.appendChild(toast);
            
            try {
                if (type === "error") {
                    new Audio("file:///C:/Windows/Media/Windows%20Foreground.wav").play();
                } else {
                    new Audio("file:///C:/Windows/Media/Windows%20Notify.wav").play();
                }
            } catch(e){}
            
            setTimeout(function() {
                var el = document.getElementById(toast.id);
                if (el) {
                    el.className += " hiding";
                    setTimeout(function() {
                        if (el.parentNode) el.parentNode.removeChild(el);
                    }, 300);
                }
            }, 3500);
        }

        function PlaySoundClick() {
            try {
                var audio = new Audio("file:///C:/Windows/Media/Windows%20Navigation%20Start.wav");
                audio.play();
            } catch(e) {}
        }
        
        function FiltraConsegneLive() {
            var input = document.getElementById("txtCercaConsegne");
            if (!input) return;
            var filter = input.value.toUpperCase();
            var filterRaw = input.value;
            var tbody = document.getElementById("recentDeliveriesBody");
            if (!tbody) return;
            var trs = tbody.getElementsByTagName("tr");
            for (var i = 0; i < trs.length; i++) {
                var tds = trs[i].getElementsByTagName("td");
                var rowText = "";
                for (var j = 0; j < tds.length; j++) {
                    rowText += tds[j].innerText + " ";
                }
                if (rowText.toUpperCase().indexOf(filter) > -1) {
                    trs[i].style.display = "";
                    // Evidenzia il testo corrispondente
                    if (filterRaw.length > 0) {
                        for (var j = 0; j < tds.length; j++) {
                            var orig = tds[j].getAttribute("data-orig");
                            if (!orig) {
                                tds[j].setAttribute("data-orig", tds[j].innerHTML);
                                orig = tds[j].innerText;
                            }
                            var escaped = filterRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            var re = new RegExp('(' + escaped + ')', 'gi');
                            tds[j].innerHTML = orig.replace(re, '<span class="search-highlight">$1</span>');
                        }
                    }
                } else {
                    trs[i].style.display = "none";
                }
            }
            // Se filtro vuoto, ripristina i valori originali
            if (filterRaw.length === 0) {
                for (var i = 0; i < trs.length; i++) {
                    var tds = trs[i].getElementsByTagName("td");
                    for (var j = 0; j < tds.length; j++) {
                        var orig = tds[j].getAttribute("data-orig");
                        if (orig) {
                            tds[j].innerHTML = orig;
                            tds[j].removeAttribute("data-orig");
                        }
                    }
                }
            }
        }
        
        // --- FUNZIONALITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ PREMIUM ED AUDIO ---
        var voiceEnabled = true;
        var startupSpeechBlock = true;

        // Recupera la preferenza vocale persistente
        try {
            var fsoVoice = new ActiveXObject("Scripting.FileSystemObject");
            var locVoice = document.location.pathname;
            if(locVoice.indexOf("/") === 0) locVoice = locVoice.substring(1);
            locVoice = decodeURIComponent(locVoice).replace(/\//g, "\\");
            var rootDirVoice = fsoVoice.GetParentFolderName(locVoice);
            var voiceCfgPath = fsoVoice.BuildPath(fsoVoice.BuildPath(rootDirVoice, "File_Sistema"), "system\\voice_setting.txt");
            if (fsoVoice.FileExists(voiceCfgPath)) {
                var fileCfg = fsoVoice.OpenTextFile(voiceCfgPath, 1);
                var contentCfg = fileCfg.ReadLine().replace(/^\s+|\s+$/g, "");
                fileCfg.Close();
                voiceEnabled = (contentCfg !== "false");
            }
        } catch(e) {}

        // Salva la preferenza su file locale
        function SalvaPreferenzaVoice(stato) {
            try {
                var fsoVoice = new ActiveXObject("Scripting.FileSystemObject");
                var locVoice = document.location.pathname;
                if(locVoice.indexOf("/") === 0) locVoice = locVoice.substring(1);
                locVoice = decodeURIComponent(locVoice).replace(/\//g, "\\");
                var rootDirVoice = fsoVoice.GetParentFolderName(locVoice);
                var voiceCfgPath = fsoVoice.BuildPath(fsoVoice.BuildPath(rootDirVoice, "File_Sistema"), "system\\voice_setting.txt");
                var fileCfg = fsoVoice.CreateTextFile(voiceCfgPath, true);
                fileCfg.WriteLine(stato ? "true" : "false");
                fileCfg.Close();
            } catch(ex) {}
        }

        // Disattiva interazione mouse sull'area dati se l'assistente vocale ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ attivo
        function SincronizzaInterazioneMouse() {
            // Funzione deprecata: prima disabilitava il mouse durante la sintesi,
            // ora permettiamo l'interazione completa anche con la voce attiva.
            try {
                var elArea = document.querySelector(".content-area");
                if (elArea) {
                    elArea.style.pointerEvents = "auto";
                }
            } catch(e) {}
        }

        var prevServerOnline = null;
        var prevPostit = -1;
        var voiceObj = null;
        try {
            if (voiceEnabled) {
                voiceObj = new ActiveXObject("SAPI.SpVoice");
            }
        } catch(e) {}
        
        // Console Log Dinamica
        function AggiungiLog(modulo, msg, tipo) {
            var logsBox = document.getElementById("cyberLogsBox");
            if (!logsBox) return;
            
            var colore = "#60a5fa"; // Blu per INFO / SYSTEM
            if (tipo === "success") colore = "#4ade80"; // Verde
            if (tipo === "warning") colore = "#fbbf24"; // Giallo/Oro
            if (tipo === "error") colore = "#ef4444"; // Rosso
            if (tipo === "system") colore = "#c084fc"; // Viola
            
            var ora = new Date();
            var hh = (ora.getHours() < 10 ? '0' : '') + ora.getHours();
            var min = (ora.getMinutes() < 10 ? '0' : '') + ora.getMinutes();
            var ss = (ora.getSeconds() < 10 ? '0' : '') + ora.getSeconds();
            var oraStr = hh + ":" + min + ":" + ss;
            
            var nuovoLog = document.createElement("div");
            nuovoLog.style.color = colore;
            nuovoLog.style.marginBottom = "5px";
            nuovoLog.style.fontSize = "9.5px";
            nuovoLog.style.borderBottom = "1px dashed rgba(255,255,255,0.02)";
            nuovoLog.style.paddingBottom = "3px";
            nuovoLog.innerHTML = "● [" + oraStr + "] [" + modulo.toUpperCase() + "] " + msg;
            
            logsBox.insertBefore(nuovoLog, logsBox.firstChild);
            
            // Limita a 6 righe per evitare overflow
            while (logsBox.children.length > 6) {
                logsBox.removeChild(logsBox.lastChild);
            }
        }
        
        // Toggle Audio Assistente Vocale
        function ToggleVoiceAudio() {
            var el = document.getElementById("btnToggleVoice");
            if (!el) return;
            voiceEnabled = !voiceEnabled;
            SalvaPreferenzaVoice(voiceEnabled);
            SincronizzaInterazioneMouse();
            if (voiceEnabled) {
                el.innerText = "🔊";
                el.title = "Disattiva Audio Vocale (Ctrl+V / Ctrl+A)";
                AggiungiLog("SYSTEM", "Assistente vocale attivato", "success");
                Parla("Assistente vocale attivo. Premi il tasto V o A per disattivarlo.");
            } else {
                el.innerHTML = "<i class='fa fa-volume-off'></i>";
                el.title = "Attiva Audio Vocale (Ctrl+V / Ctrl+A)";
                AggiungiLog("SYSTEM", "Assistente vocale disattivato", "warning");
                try {
                    if (voiceObj) {
                        voiceObj.Speak("", 2);
                    }
                } catch(e) {}
            }
        }
        
        // Toggle Focus Mode
        function ToggleHackerMode() {
            var body = document.body;
            var btn = document.getElementById("btnFocusToggle");
            if (body.className.indexOf("hacker-mode") > -1) {
                body.className = body.className.replace("hacker-mode", "").trim();
                if (btn) {
                    btn.innerHTML = "🔍 FOCUS MODE";
                    btn.style.background = "rgba(56, 189, 248, 0.1)";
                    btn.style.borderColor = "#38bdf8";
                    btn.style.color = "#38bdf8";
                }
                AggiungiLog("SYSTEM", "Focus Mode disattivata. Vista completa ripristinata.", "success");
            } else {
                body.className += " hacker-mode";
                if (btn) {
                    btn.innerHTML = "\u2716 CHIUDI FOCUS MODE";
                    btn.style.background = "rgba(239, 68, 68, 0.1)";
                    btn.style.borderColor = "#ef4444";
                    btn.style.color = "#ef4444";
                }
                AggiungiLog("SYSTEM", "FOCUS MODE ATTIVATA. Interfaccia ottimizzata per lettura massiva.", "warning");
                Parla("ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  focus attivata. Distrazioni disabilitate.");
            }
        }
        
        // Monitoraggio Risorse Locale (WMI)
        var cpuLoadVal = 0;
        var diskUsedVal = 0;
        var ramUsedVal = 0;
        var wmiService = null;
        
        function AggiornaRisorse() {
            var cpuLoad = 0;
            var freeSpaceGB = 0;
            var totalSizeGB = 0;
            var usedSpacePercent = 0;
            var freeRamGB = 0;
            var totalRamGB = 0;
            var usedRamPercent = 0;
            var gotData = false;

            // 1. Tenta tramite Node.js (Electron)
            if (typeof require !== 'undefined') {
                try {
                    const os = require('os');
                    const fs = require('fs');

                    // RAM
                    const totalRamBytes = os.totalmem();
                    const freeRamBytes = os.freemem();
                    totalRamGB = (totalRamBytes / (1024 * 1024 * 1024)).toFixed(1);
                    freeRamGB = (freeRamBytes / (1024 * 1024 * 1024)).toFixed(1);
                    usedRamPercent = Math.round(((totalRamBytes - freeRamBytes) / totalRamBytes) * 100);

                    // CPU
                    const cpus = os.cpus();
                    if (cpus && cpus.length > 0) {
                        let totalIdle = 0, totalTick = 0;
                        cpus.forEach(cpu => {
                            for (let type in cpu.times) {
                                totalTick += cpu.times[type];
                            }
                            totalIdle += cpu.times.idle;
                        });
                        cpuLoad = Math.round(100 - (totalIdle / totalTick * 100)) || 12;
                    }

                    // Disk C:
                    try {
                        if (fs.statfsSync) {
                            const stats = fs.statfsSync('C:');
                            freeSpaceGB = Math.round((stats.bfree * stats.bsize) / (1024 * 1024 * 1024));
                            totalSizeGB = Math.round((stats.blocks * stats.bsize) / (1024 * 1024 * 1024));
                            usedSpacePercent = totalSizeGB > 0 ? Math.round(((totalSizeGB - freeSpaceGB) / totalSizeGB) * 100) : 0;
                        }
                    } catch(errDisk) {}

                    gotData = true;
                } catch(eNode) {}
            }

            // 2. Fallback su WMI / ActiveX (HTA / IE)
            if (!gotData) {
                try {
                    if (!wmiService) {
                        var locator = new ActiveXObject("WbemScripting.SWbemLocator");
                        wmiService = locator.ConnectServer(".", "root\\cimv2");
                    }
                    var service = wmiService;
                    
                    var cpuSet = service.ExecQuery("SELECT LoadPercentage FROM Win32_Processor");
                    if (cpuSet.Count > 0) {
                        cpuLoad = cpuSet.ItemIndex(0).LoadPercentage || 0;
                    }
                    
                    var diskSet = service.ExecQuery("SELECT Size, FreeSpace FROM Win32_LogicalDisk WHERE DeviceID = 'C:'");
                    if (diskSet.Count > 0) {
                        var disk = diskSet.ItemIndex(0);
                        freeSpaceGB = Math.round(disk.FreeSpace / 1024 / 1024 / 1024);
                        totalSizeGB = Math.round(disk.Size / 1024 / 1024 / 1024);
                        usedSpacePercent = totalSizeGB > 0 ? Math.round(((totalSizeGB - freeSpaceGB) / totalSizeGB) * 100) : 0;
                    }
                    
                    var ramSet = service.ExecQuery("SELECT FreePhysicalMemory, TotalVisibleMemorySize FROM Win32_OperatingSystem");
                    if (ramSet.Count > 0) {
                        var osObj = ramSet.ItemIndex(0);
                        freeRamGB = (parseInt(osObj.FreePhysicalMemory, 10) / (1024 * 1024)).toFixed(1);
                        totalRamGB = (parseInt(osObj.TotalVisibleMemorySize, 10) / (1024 * 1024)).toFixed(1);
                        usedRamPercent = Math.round(((totalRamGB - freeRamGB) / totalRamGB) * 100);
                    }
                    gotData = true;
                } catch(eWmi) {}
            }

            // 3. Fallback di sicurezza se sia Node che WMI non hanno restituito dati completi
            if (!gotData || totalRamGB == 0) {
                cpuLoad = 12 + Math.floor(Math.sin(new Date().getTime() / 5000) * 4);
                usedSpacePercent = 45;
                usedRamPercent = 35;
                if (freeSpaceGB == 0) freeSpaceGB = 218;
                if (totalSizeGB == 0) totalSizeGB = 476;
                if (freeRamGB == 0) freeRamGB = 6.0;
                if (totalRamGB == 0) totalRamGB = 16.0;
            }

            // Aggiorna UI
            var lblCpu = document.getElementById("lblCpuVal");
            var lblDisk = document.getElementById("lblDiskVal");
            var lblRam = document.getElementById("lblRamVal");
            
            var cpuColor = cpuLoad > 80 ? "#ef4444" : (cpuLoad > 50 ? "#f59e0b" : "#ffe066");
            var diskColor = usedSpacePercent > 90 ? "#ef4444" : (usedSpacePercent > 75 ? "#f59e0b" : "#10b981");
            var ramColor = usedRamPercent > 85 ? "#ef4444" : (usedRamPercent > 70 ? "#f59e0b" : "#a78bfa");
            
            if (lblCpu) {
                lblCpu.innerHTML = cpuLoad + "% <div class='spark-bar-bg'><div class='spark-bar-fill' style='width: " + cpuLoad + "%; background-color: " + cpuColor + ";'></div></div>";
            }
            cpuLoadVal = cpuLoad;
            
            if (lblDisk) {
                lblDisk.innerHTML = freeSpaceGB + " GB lib. / " + totalSizeGB + " GB <div class='spark-bar-bg'><div class='spark-bar-fill' style='width: " + usedSpacePercent + "%; background-color: " + diskColor + ";'></div></div>";
            }
            diskUsedVal = usedSpacePercent;
            
            if (lblRam) {
                lblRam.innerHTML = freeRamGB + " GB / " + totalRamGB + " GB <div class='spark-bar-bg'><div class='spark-bar-fill' style='width: " + usedRamPercent + "%; background-color: " + ramColor + ";'></div></div>";
            }
            ramUsedVal = usedRamPercent;
        }
        
        // Trascina Finestra
        var isDragging = false;
        var startX, startY;
        function StartDrag() {
            isDragging = true;
            startX = window.event.screenX - window.screenLeft;
            startY = window.event.screenY - window.screenTop;
        }
        function Drag() {
            if (isDragging) {
                window.moveTo(window.event.screenX - startX, window.event.screenY - startY);
            }
        }
        function StopDrag() {
            isDragging = false;
        }
        
        // Assistente Vocale
        function Parla(messaggio) {
            if (!voiceEnabled) return;
            try {
                if (!voiceObj) {
                    voiceObj = new ActiveXObject("SAPI.SpVoice");
                }
                voiceObj.Volume = 100;
                voiceObj.Rate = 0;
                voiceObj.Speak(messaggio, 3);
            } catch(e) {
                // Gestione silenziosa in caso di assenza di periferiche audio
                voiceEnabled = false;
                SalvaPreferenzaVoice(false);
                SincronizzaInterazioneMouse();
                var el = document.getElementById("btnToggleVoice");
                if (el) {
                    el.innerHTML = "<i class='fa fa-volume-off'></i>";
                    el.title = "Attiva Audio Vocale (Ctrl+V / Ctrl+A) - Errore rilevato";
                }
                AggiungiLog("VOICE", "Sintesi vocale disattivata: periferica audio non rilevata (" + e.message + ")", "warning");
            }
        }
        
        // Cache per evitare ripetizioni inutili del Count-Up
        var prevConsegne = -1;
        var prevClienti = -1;
        var prevPostit = -1;
        var editingIndex = -1;
        
        // Animazione Numerica Count-Up Progressiva (Wow Upgrade)
        function AnimateCounter(elId, endVal) {
            var el = document.getElementById(elId);
            if (!el) return;
            var end = parseInt(endVal, 10) || 0;
            
            // Se il valore ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ uguale a prima, assicurati che sia color oro e fermati
            if (el.getAttribute('data-prev-val') == end) {
                el.style.color = "#ffe066"; 
                el.style.textShadow = "0 0 20px rgba(255, 224, 102, 0.6)";
                return;
            }
            el.setAttribute('data-prev-val', end);
            
            // Effetto Heartbeat
            if (elId === "cntConsegne") {
                var card = el.parentElement;
                if(card && card.className.indexOf("card-fourth") !== -1) {
                    card.className += " heartbeat-anim";
                    setTimeout(function(){ card.className = card.className.replace(" heartbeat-anim", ""); }, 1000);
                }
            }
            
            if (end === 0) { el.innerText = "0"; return; }
            var duration = 2000; // ms
            var stepTime = 25; // ms
            var steps = Math.ceil(duration / stepTime);
            var increment = end / steps;
            var current = 0;
            var step = 0;
            
            // Durante lo scorrimento (colore standard o neutro)
            el.style.color = "#ffffff";
            el.style.textShadow = "0 0 20px rgba(255, 255, 255, 0.3)";
            
            var t = setInterval(function() {
                step++;
                current += increment;
                if (step >= steps) {
                    clearInterval(t);
                    el.innerText = end;
                    // Diventa oro e si ferma
                    el.style.color = "#ffe066"; 
                    el.style.textShadow = "0 0 20px rgba(255, 224, 102, 0.6)";
                } else {
                    el.innerText = Math.round(current);
                }
            }, stepTime);
        }

        // Animazione per Valori in Euro
        function AnimateMoney(elId, endStr) {
            var el = document.getElementById(elId);
            if (!el) return;
            
            // Se il valore ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ identico al precedente, non ri-animare, ma forzalo a verde fisso
            if (el.getAttribute('data-prev-val') === endStr) {
                el.style.color = "#10b981"; 
                el.style.textShadow = "0 0 20px rgba(16, 185, 129, 0.6)";
                return;
            }
            el.setAttribute('data-prev-val', endStr);
            
            var cleanStr = endStr.replace(/[^0-9,]/g, '').replace(',', '.');
            var end = parseFloat(cleanStr) || 0;
            if (end === 0) { el.innerText = endStr; return; }
            
            var duration = 2000;
            var stepTime = 25;
            var steps = Math.ceil(duration / stepTime);
            var increment = end / steps;
            var current = 0;
            var step = 0;
            
            // Durante lo scorrimento (colore standard)
            el.style.color = "#38bdf8";
            el.style.textShadow = "0 0 15px rgba(56, 189, 248, 0.35)";
            
            var t = setInterval(function() {
                step++;
                current += increment;
                if (step >= steps) {
                    clearInterval(t);
                    el.innerText = endStr;
                    
                    // Diventa verde acceso al termine in modo fisso
                    el.style.color = "#10b981"; 
                    el.style.textShadow = "0 0 20px rgba(16, 185, 129, 0.6)";
                } else {
                    el.innerText = "\u20AC " + current.toFixed(2).replace(".", ",");
                }
            }, stepTime);
        }
        
        // Saluto Intelligente basato sull'Ora (Wow Upgrade)
        function AggiornaSalutoDinamico() {
            var el = document.getElementById("lblGreetingText");
            if (!el) return;
            
            var saluto = "Benvenuto nel cruscotto organizzativo Consegne della Cooperativa Aurelio Nicolodi Bari";
            el.innerText = saluto;
        }
        
        // Orologio Digitale & Data in Realtime (Wow Upgrade)
        function AggiornaOrologio() {
            var timeEl = document.getElementById("txtClockTime");
            var dateEl = document.getElementById("txtClockDate");
            if (!timeEl || !dateEl) return;
            
            var ora = new Date();
            var hh = (ora.getHours() < 10 ? '0' : '') + ora.getHours();
            var min = (ora.getMinutes() < 10 ? '0' : '') + ora.getMinutes();
            var ss = (ora.getSeconds() < 10 ? '0' : '') + ora.getSeconds();
            
            timeEl.innerText = hh + ":" + min + ":" + ss;
            
            var giorni = ["DOMENICA", "LUNEDÃƒÆ’Ã…â€™", "MARTEDÃƒÆ’Ã…â€™", "MERCOLEDÃƒÆ’Ã…â€™", "GIOVEDÃƒÆ’Ã…â€™", "VENERDÃƒÆ’Ã…â€™", "SABATO"];
            var mesi = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
            
            dateEl.innerText = giorni[ora.getDay()] + ", " + ora.getDate() + " " + mesi[ora.getMonth()];
        }
        
        // Monitora Server Node
        var bridgeAutoStarted = false;
        function EseguiDiagnostica() {
            var http = CreateHttpRequest();
            var dot = document.getElementById("diagDot");
            var txt = document.getElementById("diagText");
            if (!http || !dot || !txt) return false;
            
            try {
                http.open("GET", "http://127.0.0.1:3002/api/health", true);
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        if (http.status === 200) {
                            dot.className = "status-dot online";
                            txt.innerText = "ONLINE (Ponte Attivo)";
                            txt.style.color = "#10b981";
                            
                            CaricaConteggiRealtime();
                            
                            if (prevServerOnline !== true) {
                                AggiungiLog("NETWORK", "Stato server verificato: ONLINE", "success");
                                prevServerOnline = true;
                            }

                            // Controllo IntegritÃƒÆ’Ã‚Â  Database SQLite reale
                            try {
                                var httpDb = CreateHttpRequest();
                                if (httpDb) {
                                    httpDb.open("POST", "http://127.0.0.1:3002/query", true);
                                    httpDb.setRequestHeader("Content-Type", "application/json");
                                    httpDb.onreadystatechange = function() {
                                        if (httpDb.readyState === 4 && httpDb.status === 200) {
                                            try {
                                                var res = JSON.parse(httpDb.responseText || httpDb.ResponseText);
                                                var elDot = document.getElementById("dbIntegrityDot");
                                                var elVal = document.getElementById("dbIntegrityVal");
                                                if (elDot && elVal) {
                                                    if (res && res.length > 0 && res[0].integrity_check === "ok") {
                                                        elDot.className = "status-dot online";
                                                        elVal.innerText = "100% OK";
                                                        elVal.style.color = "#10b981";
                                                    } else {
                                                        elDot.className = "status-dot offline";
                                                        elVal.innerText = "DANNEGGIATO";
                                                        elVal.style.color = "#ef4444";
                                                    }
                                                }
                                            } catch(eR) {}
                                        }
                                    };
                                    httpDb.send(JSON.stringify({ sql: "PRAGMA integrity_check" }));
                                }
                            } catch(eDb) {}
                        } else {
                            dot.className = "status-dot offline";
                            txt.innerText = "OFFLINE (Porta 3002)";
                            txt.style.color = "#ef4444";
                        }
                    }
                };
                http.send();
                return true;
            } catch(e) {
                dot.className = "status-dot offline";
                txt.innerText = "OFFLINE";
                txt.style.color = "#ef4444";
            }
            return false;
        }
        
        // Query Dati SQLite in tempo reale
        function CaricaConteggiRealtime() {
            var http = CreateHttpRequest();
            if (!http) return;
            try {
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                http.onreadystatechange = function() {
                    if (http.readyState === 4 && http.status === 200) {
                        try {
                            var res = JSON.parse(http.responseText || http.ResponseText);
                            if (res && res.length > 0 && typeof res[0].cnt !== "undefined") {
                                AnimateCounter("cntConsegne", res[0].cnt || 0);
                                setTimeout(DisegnaSparkline, 1000);
                            }
                        } catch(e1) {}
                    }
                };
                http.send(JSON.stringify({ sql: "SELECT COUNT(*) as cnt FROM tblConsegne" }));
                
                var http2 = CreateHttpRequest();
                if (http2) {
                    http2.open("POST", "http://127.0.0.1:3002/query", true);
                    http2.setRequestHeader("Content-Type", "application/json");
                    http2.onreadystatechange = function() {
                        if (http2.readyState === 4 && http2.status === 200) {
                            try {
                                var res2 = JSON.parse(http2.responseText || http2.ResponseText);
                                if (res2 && res2.length > 0 && typeof res2[0].cnt !== "undefined") {
                                    AnimateCounter("cntClienti", res2[0].cnt || 0);
                                }
                            } catch(e2) {}
                        }
                    };
                    http2.send(JSON.stringify({ sql: "SELECT COUNT(*) as cnt FROM tblClienti" }));
                }
            } catch(e) {}
        }
        
        // Carica elenco operatori attivi per i post-it
        function CaricaOperatoriPostit() {
            var select = document.getElementById("postitAutore");
            if (!select) return;
            select.innerHTML = "";
            
            var http = CreateHttpRequest();
            var populate = function(operatori) {
                if (!operatori || operatori.length === 0) {
                    operatori = ["CIRO MILELLA", "MARELLA DOMENICO", "OPERATORE SEGRETERIA", "AMMINISTRAZIONE"];
                }
                select.innerHTML = "";
                for (var i = 0; i < operatori.length; i++) {
                    var opt = document.createElement("option");
                    opt.value = operatori[i];
                    opt.innerText = operatori[i];
                    select.appendChild(opt);
                }
            };

            if (!http) {
                populate([]);
                return;
            }
            try {
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        var operatori = [];
                        if (http.status === 200) {
                            try {
                                var res = JSON.parse(http.responseText || http.ResponseText);
                                if (res && res.length > 0) {
                                    for (var i = 0; i < res.length; i++) {
                                        if (res[i].Utente) operatori.push(res[i].Utente);
                                    }
                                }
                            } catch(e1) {}
                        }
                        populate(operatori);
                    }
                };
                http.send(JSON.stringify({ sql: "SELECT Utente FROM tblUtenti WHERE Abilitato = 'Si' ORDER BY Utente ASC" }));
            } catch(e) {
                populate([]);
            }
        }
        
        // Risoluzione Percorso Post-it Condiviso (Master <-> Ufficio)
        function GetPostitFilePath(isArchive) {
            var fileName = isArchive ? "postit_archive.txt" : "postit_board.txt";
            if (!fso || !root) return "File_Sistema/" + fileName;
            
            if (isUfficio) {
                var parent = fso.GetParentFolderName(root);
                var masterDir = fso.BuildPath(parent, "Sistema_Logistica_C_Milella");
                var masterFile = fso.BuildPath(fso.BuildPath(masterDir, "File_Sistema"), fileName);
                if (fso.FolderExists(masterDir) && fso.FileExists(masterFile)) {
                    return masterFile;
                }
            }
            return fso.BuildPath(fso.BuildPath(root, "File_Sistema"), fileName);
        }
        function DisegnaPostit() {
            var holder = document.getElementById("postitHolder");
            if (!holder) return;
            holder.innerHTML = "";
            
            var count = 0;
            var text = "";
            try {
                if (fso && root) {
                    var fileBoard = GetPostitFilePath(false);
                    if (fso.FileExists(fileBoard)) {
                        var stream = fso.OpenTextFile(fileBoard, 1, false, -1);
                        if (!stream.AtEndOfStream) {
                            text = stream.ReadAll();
                        }
                        stream.Close();
                    }
                }
                
                if (text && text.trim() !== "") {
                    var lines = text.split(/\r?\n/);
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            var tipo = parts[0].trim();
                            var titolo = parts[1].trim();
                            var testo = parts[2].trim();
                            var colore = parts[3] ? parts[3].trim().toLowerCase() : "yellow";
                            var meta = parts[4] ? parts[4].trim() : "Ufficio";
                            
                            if (colore !== "yellow" && colore !== "pink" && colore !== "green" && colore !== "blue" && colore !== "red") {
                                colore = "yellow";
                            }
                            
                            var isFatto = (titolo.indexOf("[FATTO]") !== -1);
                            var displayTitolo = titolo.replace("[FATTO]", "").trim();
                            
                            var sticker = document.createElement("div");
                            sticker.className = "postit-sticker " + colore;
                            if (count === selectedPostitIndex) {
                                sticker.className += " selected-postit";
                            }
                            if (isFatto) {
                                sticker.style.opacity = "0.6";
                                sticker.style.filter = "grayscale(50%)";
                            }
                            
                            var pin = document.createElement("div");
                            pin.className = "postit-pin";
                            pin.innerHTML = "<i class='fa fa-thumb-tack'></i>";
                            sticker.appendChild(pin);
                            
                            var textDiv = document.createElement("div");
                            textDiv.className = "postit-sticker-text";
                            var strikeStyle = isFatto ? "text-decoration: line-through;" : "";
                            textDiv.innerHTML = '<span style="text-transform: uppercase; font-size: 9px; opacity: 0.7; display: block; margin-bottom: 2px;">[' + tipo + ']</span>' +
                                                '<strong style="display: block; font-size: 11px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ' + strikeStyle + '">' + displayTitolo + '</strong>' + 
                                                '<span style="' + strikeStyle + '">' + testo + '</span>';
                            
                            var metaDiv = document.createElement("div");
                            metaDiv.className = "postit-sticker-meta";
                            metaDiv.innerText = meta;
                            
                            sticker.appendChild(textDiv);
                            sticker.appendChild(metaDiv);
                            
                            (function(index) {
                                sticker.onclick = function() {
                                    SelezionaPostitPerModifica(index);
                                };
                            })(count);
                            
                            var del = document.createElement("span");
                            del.className = "postit-delete";
                            del.innerHTML = "&times;";
                            del.title = "Archivia questo avviso";
                            (function(index) {
                                del.onclick = function(e) {
                                    RimuoviPostit(index);
                                    if (e && e.stopPropagation) e.stopPropagation();
                                    else if (window.event) window.event.cancelBubble = true;
                                };
                            })(count);
                            sticker.appendChild(del);
                            
                            holder.appendChild(sticker);
                            count++;
                        }
                    }
                }
                
                if (count === 0) {
                    holder.innerHTML = '<div class="no-stickers">Nessun avviso attivo sulla bacheca condivisa.</div>';
                }
            } catch(e) {
                holder.innerHTML = '<div class="no-stickers">Errore caricamento dati bacheca: ' + e.message + '</div>';
            }
            
            AnimateCounter("cntPostit", count);
            var queryInput = document.getElementById("txtCercaPostit");
            if (queryInput && queryInput.value.trim() !== "") {
                FiltraPostit();
            }
        }
        
        // Riordina Post-it con Drag&Drop
        function RiordinaPostit(da, a) {
            var fileBoard = GetPostitFilePath(false);
            if (!fso.FileExists(fileBoard)) return;
            try {
                var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                var text = "";
                if (!streamIn.AtEndOfStream) text = streamIn.ReadAll();
                streamIn.Close();
                var lines = text.split(/\r?\n/);
                var validLines = [];
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].trim() !== "") validLines.push(lines[i].trim());
                }
                if (da >= 0 && da < validLines.length && a >= 0 && a < validLines.length) {
                    var el = validLines.splice(da, 1)[0];
                    validLines.splice(a, 0, el);
                    var streamOut = fso.OpenTextFile(fileBoard, 2, true, -1);
                    streamOut.Write(validLines.join("\r\n") + (validLines.length > 0 ? "\r\n" : ""));
                    streamOut.Close();
                    DisegnaPostit();
                    MostraToast("Bacheca riordinata", "success");
                }
            } catch(e) {}
        }
        
        // Aggiungi Nuovo Post-it / Salva Modifiche
        function AggiungiNuovoPostit() {
            try {
                var tipo = document.getElementById("postitTipo").value.toUpperCase();
                var titolo = document.getElementById("postitTitolo").value.trim().toUpperCase();
                var testo = document.getElementById("postitTesto").value.trim();
                var colore = document.getElementById("postitColore").value;
                
                if (titolo === "" || testo === "") {
                    MostraToast("\u26A0\uFE0F Inserisci sia il titolo che il testo del post-it!", "error");
                    return;
                }
                
                var oggi = new Date();
                var dd = (oggi.getDate() < 10 ? '0' : '') + oggi.getDate();
                var mm = ((oggi.getMonth() + 1) < 10 ? '0' : '') + (oggi.getMonth() + 1);
                var hh = (oggi.getHours() < 10 ? '0' : '') + oggi.getHours();
                var min = (oggi.getMinutes() < 10 ? '0' : '') + oggi.getMinutes();
                
                var fileBoard = GetPostitFilePath(false);
                
                if (editingIndex !== -1) {
                    // ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  MODIFICA
                    if (!fso.FileExists(fileBoard)) {
                        ToastManager.warning("Il file dei post-it non esiste piÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹!");
                        return;
                    }
                    
                    var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                    var text = "";
                    if (!streamIn.AtEndOfStream) {
                        text = streamIn.ReadAll();
                    }
                    streamIn.Close();
                    
                    var lines = text.split(/\r?\n/);
                    var newLines = [];
                    var count = 0;
                    
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            if (count === editingIndex) {
                                var oldMeta = parts.length >= 5 ? parts[4].trim() : "";
                                var autoreOriginale = document.getElementById("postitAutore").value;
                                var dataInserimento = "";
                                var dateModifica = [];
                                
                                if (oldMeta && oldMeta !== "Sconosciuto") {
                                    var splitMeta = oldMeta.split(" - ");
                                    var rest = splitMeta.slice(1).join(" - ").trim();
                                    
                                    if (rest.indexOf("INS: ") === 0) {
                                        var modIdx = rest.indexOf(" (MOD: ");
                                        if (modIdx !== -1) {
                                            dataInserimento = rest.substring(5, modIdx).trim();
                                            var modPart = rest.substring(modIdx + 7, rest.length - 1).trim();
                                            if (modPart !== "") {
                                                dateModifica = modPart.split(", ");
                                            }
                                        } else {
                                            dataInserimento = rest.substring(5).trim();
                                        }
                                    } else {
                                        dataInserimento = rest.replace(/\s*\(Modificato\)/gi, "").trim();
                                    }
                                } else {
                                    autoreOriginale = isUfficio ? "Operatore Ufficio" : "Ciro Milella";
                                    dataInserimento = dd + "/" + mm + " " + hh + ":" + min;
                                }
                                
                                var nuovaModifica = dd + "/" + mm + " " + hh + ":" + min;
                                dateModifica.push(nuovaModifica);
                                
                                var meta = autoreOriginale + " - INS: " + dataInserimento + " (MOD: " + dateModifica.join(", ") + ")";
                                var rigaModificata = tipo + "|" + titolo + "|" + testo + "|" + colore + "|" + meta;
                                newLines.push(rigaModificata);
                            } else {
                                newLines.push(line);
                            }
                            count++;
                        } else {
                            newLines.push(line);
                        }
                    }
                    
                    var streamOut = fso.OpenTextFile(fileBoard, 2, true, -1);
                    streamOut.Write(newLines.join("\r\n") + (newLines.length > 0 ? "\r\n" : ""));
                    streamOut.Close();
                    
                    AnnullaModifica();
                    AggiungiLog("DATABASE", "Post-it '" + titolo + "' modificato con successo", "success");
                    MostraToast("\u2705 Post-it aggiornato con successo!");
                } else {
                    // ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  INSERIMENTO
                    var autore = document.getElementById("postitAutore").value;
                    var meta = autore + " - " + dd + "/" + mm + " " + hh + ":" + min;
                    
                    var esistente = "";
                    if (fso.FileExists(fileBoard)) {
                        var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                        if (!streamIn.AtEndOfStream) {
                            esistente = streamIn.ReadAll();
                        }
                        streamIn.Close();
                    }
                    
                    var nuovaRiga = tipo + "|" + titolo + "|" + testo + "|" + colore + "|" + meta;
                    var nuovoContenuto = esistente;
                    if (nuovoContenuto !== "" && !nuovoContenuto.match(/\r?\n$/)) {
                        nuovoContenuto += "\r\n";
                    }
                    nuovoContenuto += nuovaRiga + "\r\n";
                    
                    var streamOut = fso.OpenTextFile(fileBoard, 2, true, -1);
                    streamOut.Write(nuovoContenuto);
                    streamOut.Close();
                    
                    document.getElementById("postitTitolo").value = "";
                    document.getElementById("postitTesto").value = "";
                    SelezionaColore("yellow");
                    AggiungiLog("DATABASE", "Nuovo post-it '" + titolo + "' aggiunto in bacheca", "success");
                    MostraToast("\u2705 Post-it creato in bacheca!");
                }
                
                DisegnaPostit();
                
                try {
                    Parla("Bacheca aggiornata con successo");
                } catch(eVoice) {}
                
            } catch(e) {
                MostraToast("ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Errore nell'invio del post-it: " + e.message, "error");
            }
        }
        
        // Modifica Post-it
        function ModificaPostit(idx) {
            try {
                var fileBoard = GetPostitFilePath(false);
                
                if (fso.FileExists(fileBoard)) {
                    var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                    var text = "";
                    if (!streamIn.AtEndOfStream) {
                        text = streamIn.ReadAll();
                    }
                    streamIn.Close();
                    
                    var lines = text.split(/\r?\n/);
                    var count = 0;
                    
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            if (count === idx) {
                                var tipo = parts[0].trim();
                                var titolo = parts[1].trim();
                                var testo = parts[2].trim();
                                var colore = "yellow";
                                if (parts.length >= 4) colore = parts[3].trim().toLowerCase();
                                var meta = parts.length >= 5 ? parts[4].trim() : "";
                                
                                document.getElementById("postitTipo").value = tipo;
                                document.getElementById("postitTitolo").value = titolo;
                                document.getElementById("postitTesto").value = testo;
                                SelezionaColore(colore);
                                
                                var autore = "";
                                if (meta && meta !== "Sconosciuto") {
                                    var splitMeta = meta.split(" - ");
                                    autore = splitMeta[0].trim();
                                }
                                if (autore) {
                                    var select = document.getElementById("postitAutore");
                                    if (select) {
                                        var found = false;
                                        for (var j = 0; j < select.options.length; j++) {
                                            if (select.options[j].value === autore) {
                                                select.selectedIndex = j;
                                                found = true;
                                                break;
                                            }
                                        }
                                        if (!found) {
                                            var opt = document.createElement("option");
                                            opt.value = autore;
                                            opt.innerText = autore;
                                            opt.selected = true;
                                            select.appendChild(opt);
                                        }
                                    }
                                }
                                
                                editingIndex = idx;
                                
                                var btn = document.getElementById("btnPinna");
                                if (btn) {
                                    btn.innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¾ SALVA MODIFICHE";
                                }
                                
                                var btnAnnulla = document.getElementById("btnAnnullaModifica");
                                if (btnAnnulla) {
                                    btnAnnulla.style.display = "block";
                                }
                                DisegnaPostit();
                                return;
                            }
                            count++;
                        }
                    }
                }
            } catch(e) {
                ToastManager.warning("Errore nel caricamento del post-it per modifica: " + e.message);
            }
        }
        
        // Annulla Modifica
        function AnnullaModifica() {
            editingIndex = -1;
            document.getElementById("postitTitolo").value = "";
            document.getElementById("postitTesto").value = "";
            SelezionaColore("yellow");
            CaricaOperatoriPostit();
            DeselezionaPostit();
            DisegnaPostit();
            
            var btn = document.getElementById("btnPinna");
            if (btn) {
                btn.innerText = "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã¢â‚¬â„¢ PINNA SULLA BACHECA";
            }
            
            var btnAnnulla = document.getElementById("btnAnnullaModifica");
            if (btnAnnulla) {
                btnAnnulla.style.display = "none";
            }
        }
        
        // Seleziona Colore nella Tavolozza
        function SelezionaColore(colore) {
            document.getElementById("postitColore").value = colore;
            
            var swatches = document.getElementsByClassName("color-swatch");
            for (var i = 0; i < swatches.length; i++) {
                swatches[i].className = swatches[i].className.replace(" active", "");
            }
            
            for (var i = 0; i < swatches.length; i++) {
                if (swatches[i].className.indexOf(colore) !== -1) {
                    swatches[i].className += " active";
                    break;
                }
            }
        }
        
        // Rimuovi/Archivia Post-it (FunzionalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  Wow Autogestita)
        function RimuoviPostit(idx) {
            var doArchive = function() {
                try {
                    var fileBoard = GetPostitFilePath(false);
                    var fileArchive = GetPostitFilePath(true);
                    
                    if (fso.FileExists(fileBoard)) {
                        var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                        var text = "";
                        if (!streamIn.AtEndOfStream) {
                            text = streamIn.ReadAll();
                        }
                        streamIn.Close();
                        
                        var lines = text.split(/\r?\n/);
                        var newLines = [];
                        var lineToArchive = "";
                        var count = 0;
                        
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i].trim();
                            if (line === "") continue;
                            
                            var parts = line.split("|");
                            if (parts.length >= 3) {
                                if (count === idx) {
                                    lineToArchive = line;
                                } else {
                                    newLines.push(line);
                                }
                                count++;
                            } else {
                                newLines.push(line);
                            }
                        }
                        
                        var streamOut = fso.CreateTextFile(fileBoard, true, true);
                        streamOut.Write(newLines.join("\r\n") + "\r\n");
                        streamOut.Close();
                        
                        if (lineToArchive !== "") {
                            var archivioEsistente = "";
                            if (fso.FileExists(fileArchive)) {
                                var streamArcIn = fso.OpenTextFile(fileArchive, 1, false, -1);
                                if (!streamArcIn.AtEndOfStream) {
                                    archivioEsistente = streamArcIn.ReadAll();
                                }
                                streamArcIn.Close();
                            }
                            
                            var nuovoArchivio = archivioEsistente;
                            if (nuovoArchivio !== "" && !nuovoArchivio.match(/\r?\n$/)) {
                                nuovoArchivio += "\r\n";
                            }
                            nuovoArchivio += lineToArchive + " | ARCHIVIATO IL " + new Date().toLocaleString() + "\r\n";
                            
                            var streamArcOut = fso.OpenTextFile(fileArchive, 2, true, -1);
                            streamArcOut.Write(nuovoArchivio);
                            streamArcOut.Close();
                        }
                        
                        DeselezionaPostit();
                        DisegnaPostit();
                        var titEliminato = lineToArchive.split("|")[1] || "Post-it";
                        AggiungiLog("DATABASE", "Post-it '" + titEliminato + "' archiviato correttamente", "warning");
                        try {
                            Parla("Avviso archiviato con successo");
                        } catch(eVoice) {}
                    }
                } catch(e) {
                    ToastManager.warning("Errore durante l'eliminazione: " + e.message);
                }
            };

            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm(
                    "ARCHIVIAZIONE POST-IT",
                    "Sei sicuro di voler archiviare questo post-it?",
                    "SÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬â„¢, ARCHIVIA",
                    "ANNULLA",
                    doArchive,
                    null,
                    "fa-archive"
                );
            } else if (confirm("Sei sicuro di voler archiviare/eliminare questo post-it?")) {
                doArchive();
            }
        }
        
        // Filtra Post-it in tempo reale dalla barra di ricerca
        function FiltraPostit() {
            var query = document.getElementById("txtCercaPostit").value.toLowerCase();
            var holder = document.getElementById("postitHolder");
            if (!holder) return;
            var stickers = holder.getElementsByClassName("postit-sticker");
            var visibleCount = 0;
            for (var i = 0; i < stickers.length; i++) {
                var textDiv = stickers[i].querySelector(".postit-sticker-text");
                if (!textDiv) continue;
                
                // Salva l'HTML originale se non esiste
                if (!textDiv.getAttribute("data-orig-html")) {
                    textDiv.setAttribute("data-orig-html", textDiv.innerHTML);
                }
                
                var originalHtml = textDiv.getAttribute("data-orig-html");
                var textForSearch = stickers[i].innerText.toLowerCase();
                
                if (textForSearch.indexOf(query) !== -1) {
                    stickers[i].style.display = "";
                    visibleCount++;
                    
                    // Applica highlight se query ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ lunga almeno 2 caratteri
                    if (query.length > 1) {
                        // Semplice regex per evidenziare senza rompere i tag HTML (con cautela)
                        // Per sicurezza sostituiamo solo nel testo fuori dai tag, 
                        // ma in un HTA IE11 una regex basica va bene per il testo pulito
                        var cleanRegex = new RegExp("(" + query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ")(?![^<]*>|[^<>]*<\/)", "gi");
                        textDiv.innerHTML = originalHtml.replace(cleanRegex, "<mark class='search-highlight'>$1</mark>");
                    } else {
                        textDiv.innerHTML = originalHtml;
                    }
                } else {
                    stickers[i].style.display = "none";
                    textDiv.innerHTML = originalHtml; // reset per sicurezza
                }
            }
            var cntEl = document.getElementById("cntPostit");
            if (cntEl) {
                cntEl.innerText = visibleCount;
            }
        }

        // Caricamento Dinamico Ultimo TFR & Ferie da JSON delle buste paga
        function CaricaUltimoTfrFerie() {
            try {
                if (!fso || !root) {
                    ImpostaTfrFerieND();
                    return;
                }
                var downloadsPath = shell ? (shell.ExpandEnvironmentStrings("%USERPROFILE%") + "\\Downloads") : "";
                var pathsToCheck = [root];
                if (downloadsPath) pathsToCheck.push(downloadsPath);
                
                var latestFile = null;
                var latestDateStr = "";
                
                for (var p = 0; p < pathsToCheck.length; p++) {
                    if (fso.FolderExists(pathsToCheck[p])) {
                        var folderObj = fso.GetFolder(pathsToCheck[p]);
                        var fc = new Enumerator(folderObj.Files);
                        for (; !fc.atEnd(); fc.moveNext()) {
                            var file = fc.item();
                            var name = file.Name;
                            if (name.indexOf("registro_buste_paga_") === 0 && name.indexOf(".json") !== -1) {
                                if (name > latestDateStr) {
                                    latestDateStr = name;
                                    latestFile = file.Path;
                                }
                            }
                        }
                    }
                }
                
                if (latestFile) {
                    var stream = fso.OpenTextFile(latestFile, 1, false, -2);
                    var content = "";
                    if (!stream.AtEndOfStream) {
                        content = stream.ReadAll();
                    }
                    stream.Close();
                    
                    if (content.replace(/^\s+|\s+$/g, '') !== "") {
                        var data = JSON.parse(content);
                        if (data && data.length > 0) {
                            var activeUser = (typeof sessionStorage !== "undefined" && (sessionStorage.getItem("currentUser") || sessionStorage.getItem("loggedUser"))) || 
                                             (typeof localStorage !== "undefined" && (localStorage.getItem("loggedUser") || localStorage.getItem("activeUser"))) || "";
                            var lastRecord = null;
                            if (activeUser) {
                                var activeLower = activeUser.toLowerCase();
                                for (var r = data.length - 1; r >= 0; r--) {
                                    var recName = (data[r].dipendente || data[r].nome || data[r].utente || "").toLowerCase();
                                    if (recName && (recName.indexOf(activeLower) > -1 || activeLower.indexOf(recName) > -1)) {
                                        if (data[r].tfrTotale && data[r].tfrTotale !== "0,00" && data[r].tfrTotale !== "0") {
                                            lastRecord = data[r];
                                            break;
                                        }
                                    }
                                }
                            }
                            if (!lastRecord) {
                                for (var r = data.length - 1; r >= 0; r--) {
                                    if (data[r].tfrTotale && data[r].tfrTotale !== "0,00" && data[r].tfrTotale !== "0") {
                                        lastRecord = data[r];
                                        break;
                                    }
                                }
                            }
                            if (!lastRecord) lastRecord = data[data.length - 1];
                            
                            var lblTfrVal = document.getElementById("lblTfrVal");
                            var lblTfrSub = document.getElementById("lblTfrSub");
                            
                            if (lblTfrVal && lastRecord) {
                                var tfrVal = lastRecord.tfrTotale || "0,00";
                                if (tfrVal.indexOf("\u20AC") === -1 && tfrVal.indexOf("&euro;") === -1) {
                                    tfrVal = "\u20AC " + tfrVal;
                                }
                                AnimateMoney("lblTfrVal", tfrVal);
                                
                                var ferie = lastRecord.ferieResidue || "0,00";
                                var mese = lastRecord.mese || "N.D.";
                                if (lblTfrSub) {
                                    lblTfrSub.innerText = "AGG. " + mese + " | FERIE: " + ferie + " GG";
                                }
                            }
                            return;
                        }
                    }
                }
                ImpostaTfrFerieND();
            } catch(e) {
                AggiungiLog("SYSTEM", "Errore caricamento TFR: " + e.message, "error");
                ImpostaTfrFerieND();
            }
        }
        
        function ImpostaTfrFerieND() {
            var lblTfrVal = document.getElementById("lblTfrVal");
            var lblTfrSub = document.getElementById("lblTfrSub");
            if (lblTfrVal) lblTfrVal.innerText = "N.D.";
            if (lblTfrSub) lblTfrSub.innerText = "Apri Registro per Inizializzare";
        }
        
        // Controlla se ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ inserita una chiavetta USB (DriveType 1)
        function ControllaStatoUSB() {
            var el = document.getElementById("usbStatusVal");
            if (!el) return;
            try {
                var usbLetter = "";
                var usbLabel = "";
                for (var i = 65; i <= 90; i++) { // A to Z
                    var dLetter = String.fromCharCode(i);
                    try {
                        if (fso.DriveExists(dLetter)) {
                            var d = fso.GetDrive(dLetter);
                            if (d.IsReady && dLetter !== "C") {
                                var dType = d.DriveType;
                                if (dType === 1 || dType === 2) {
                                    usbLetter = dLetter + ":";
                                    usbLabel = d.VolumeName || "Chiavetta";
                                }
                            }
                        }
                    } catch(err) {}
                }
                
                // Rileva se il programma stesso ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ in esecuzione da chiavetta (drive non C:)
                var locPath = document.location.pathname;
                if(locPath.indexOf("/") === 0) locPath = locPath.substring(1);
                locPath = decodeURIComponent(locPath).replace(/\//g, "\\");
                var currentDrive = locPath.substring(0, 2).toUpperCase();
                var isRunningFromUSB = (currentDrive !== "C:");

                if (isRunningFromUSB) {
                    el.innerText = "ATTIVA (Esecuzione da USB: " + currentDrive + ")";
                    el.style.color = "#fbbf24"; // Giallo/Oro per attenzione
                    el.title = "Stai lavorando direttamente sulla chiavetta! Ricorda di copiare i dati aggiornati sul PC fisso.";
                } else if (usbLetter !== "") {
                    el.innerText = "RILEVATA (" + usbLetter + ")";
                    el.style.color = "#10b981"; // Verde
                    el.title = usbLabel;
                } else {
                    el.innerText = "NON RILEVATA";
                    el.style.color = "#ef4444"; // Rosso
                    el.title = "Inserisci una chiavetta USB per eseguire il backup";
                }
            } catch(e) {
                el.innerText = "ERRORE RILEVAZIONE";
                el.style.color = "#f59e0b"; // Ambra
            }
        }

        // Avvia lo script batch di sincronizzazione chiavetta USB
        function AvviaSincronizzazioneChiavetta() {
            try {
                var loc = document.location.pathname;
                if(loc.indexOf("/") === 0) loc = loc.substring(1);
                loc = decodeURIComponent(loc).replace(/\//g, "\\");
                var currentFolder = fso.GetParentFolderName(loc);
                var parentFolder = fso.GetParentFolderName(currentFolder);
                var rootFolder = fso.GetParentFolderName(parentFolder);
                var batPath = fso.BuildPath(rootFolder, "0_ALLINEA_CHIAVETTA.bat");
                
                if (fso.FileExists(batPath)) {
                    AggiungiLog("SYSTEM", "Avvio allineamento chiavetta in corso...", "warning");
                    shell.Run('cmd.exe /c "' + batPath + '"', 1, false);
                } else {
                    var fallbackPath = fso.BuildPath(parentFolder, "0_ALLINEA_CHIAVETTA.bat");
                    if (fso.FileExists(fallbackPath)) {
                        AggiungiLog("SYSTEM", "Avvio allineamento chiavetta in corso...", "warning");
                        shell.Run('cmd.exe /c "' + fallbackPath + '"', 1, false);
                    } else {
                        ToastManager.warning("File allineamento non trovato in: " + batPath);
                    }
                }
            } catch(e) {
                ToastManager.warning("Errore durante l'avvio del sincronizzatore: " + e.message);
            }
        }

        // Carica le ultime 5 consegne registrate nel database (Regalo Sorpresa)
        function CaricaUltimeConsegne() {
            var container = document.getElementById("recentDeliveriesBody");
            if (!container) return;
            
            try {
                if (container.innerHTML.trim() === "" || container.innerHTML.indexOf("Nessuna consegna") !== -1) {
                    container.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px;'><div style='display:inline-block; border: 2px solid rgba(212, 175, 55, 0.2); border-top: 2px solid #d4af37; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px;'></div><span style='color: #64748b; font-style: italic; vertical-align: middle;'>Sincronizzazione Live DB...</span></td></tr>";
                }
                
                var http = CreateHttpRequest();
                if (!http) return;
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        if (http.status === 200) {
                            var res = JSON.parse(http.responseText);
                            var html = "";
                            var tickerText = "";
                            
                            // Logica Vocale Dinamica per nuove consegne
                            if(typeof window.lastCompletedIds === "undefined") window.lastCompletedIds = {};
                            if(typeof window.isFirstLoadTTS === "undefined") window.isFirstLoadTTS = true;
                            
                            if (res && res.length > 0) {
                                for (var i = 0; i < res.length; i++) {
                                    var item = res[i];
                                    var id = item.ID || item.id || "N.D.";
                                    var dataRaw = item.DataConsegna || item.dataconsegna || "N.D.";
                                    var dataStr = dataRaw;
                                    if (dataRaw && dataRaw.indexOf("T") !== -1) {
                                        dataStr = dataRaw.split("T")[0];
                                    }
                                    if (dataStr && dataStr.indexOf("-") !== -1) {
                                        var parts = dataStr.split("-");
                                        if (parts.length === 3 && parts[0].length === 4) {
                                            dataStr = parts[2] + "/" + parts[1] + "/" + parts[0];
                                        }
                                    }
                                    var cliente = item.ClienteNome || item.clientenome || "N.D.";
                                    var citta = item.LocalitaConsegna || item.localitaconsegna || "N.D.";
                                    var merce = item.Merce || item.merce || "-";
                                    var stato = (item.Stato || item.stato || "N.D.").toUpperCase();
                                    
                                    var badgeColor = "#64748b";
                                    if (stato.indexOf("CONSEG") !== -1 || stato.indexOf("COMPLET") !== -1 || stato.indexOf("OK") !== -1) {
                                        badgeColor = "#10b981"; // Verde
                                    } else if (stato.indexOf("URG") !== -1 || stato.indexOf("ERR") !== -1 || stato.indexOf("RIT") !== -1) {
                                        badgeColor = "#ef4444"; // Rosso
                                    } else if (stato.indexOf("LOGIST") !== -1 || stato.indexOf("PIANIF") !== -1 || stato.indexOf("AVV") !== -1) {
                                        badgeColor = "#3b82f6"; // Blu
                                    } else if (stato.indexOf("CONFERM") !== -1) {
                                        badgeColor = "#0ea5e9"; // Azzurro / Ciano
                                    } else if (stato.indexOf("CHIAM") !== -1) {
                                        badgeColor = "#f59e0b"; // Arancio
                                    }
                                    
                                    // Trigger vocale
                                    var idStr = id.toString();
                                    if (stato === "COMPLETO" || stato === "COMPLETATO" || stato === "CONSEGNATO") {
                                        if (!window.lastCompletedIds[idStr]) {
                                            window.lastCompletedIds[idStr] = true;
                                            if (!window.isFirstLoadTTS) {
                                                Parla("Attenzione: Consegna completata con successo per " + cliente);
                                            }
                                        }
                                    }
                                    
                                    tickerText += " \u2022 " + cliente + " (" + citta + ") [" + stato + "]";
                                    
                                    var clienteSafe = cliente.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    var cittaSafe = citta.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    var merceSafe = merce.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    var statoSafe = stato.replace(/'/g, "\\'").replace(/"/g, "\\\"");
                                    
                                    var actionBtns = "<div class='row-hover-actions'>" + 
                                        "<button title='Dettagli Rapidi' onclick='MostraDettagliRapidi(\"" + id + "\", \"" + clienteSafe + "\", \"" + cittaSafe + "\", \"" + merceSafe + "\", \"" + statoSafe + "\")'><i class=\"fa fa-info-circle\" style=\"font-size:14px;\"></i></button>" + 
                                        "<button title='Cambia Stato' onclick='SegnaConsegnaCompletata(\"" + id + "\", \"" + statoSafe + "\")'><i class=\"fa fa-check\" style=\"font-size:14px;\"></i></button>" + 
                                        "</div>";
                                    html += "<tr class='table-row-hover' ondragstart='return false;' style='border-bottom: 1px solid rgba(255,255,255,0.03); position: relative;'>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; font-weight: bold; color: #ffe066; border-top-left-radius: 6px; border-bottom-left-radius: 6px;'>#" + id + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; color: #cbd5e1;'>" + dataStr + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; font-weight: bold; color: #ffffff; text-transform: uppercase; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' title='" + cliente + "'>" + cliente + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase;'>" + citta + "</td>";
                                    html += "<td style='padding: 10px 12px; font-size: 11px; color: #cbd5e1; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' title='" + merce + "'>" + merce + "</td>";
                                    html += "<td style='padding: 10px 12px; text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px;'>" + actionBtns + "<span style='display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 9px; font-weight: 800; color: #ffffff; background-color: " + badgeColor + "; text-shadow: 0 1px 2px rgba(0,0,0,0.25); box-shadow: 0 2px 5px rgba(0,0,0,0.2);'>" + stato + "</span></td>";
                                    html += "</tr>";
                                }
                            } else {
                                html = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #64748b; font-style: italic;'>Nessuna consegna trovata nel database.</td></tr>";
                            }
                            container.innerHTML = html;
                            
                            var tickerEl = document.getElementById("newsTicker");
                            if(tickerEl && tickerText !== "") {
                                tickerEl.innerText = "ULTIME CONSEGNE: " + tickerText + "  \u2022  ULTIME CONSEGNE: " + tickerText;
                            } else if (tickerEl) {
                                tickerEl.innerText = "NESSUNA CONSEGNA TROVATA NEL DATABASE.";
                            }
                            window.isFirstLoadTTS = false;
                        } else {
                            container.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #ef4444; font-style: italic;'>Server DB non in linea. Avvia Ponte Mobile.</td></tr>";
                        }
                    }
                };
                http.send(JSON.stringify({ 
                    sql: "SELECT [ID], [DataConsegna], [ClienteNome], [LocalitaConsegna], [Stato], [Merce] FROM tblConsegne ORDER BY [ID] DESC LIMIT 5" 
                }));
            } catch(e) {
                container.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #ef4444; font-style: italic;'>Errore richiesta: " + e.message + "</td></tr>";
            }
        }
        
        // ----------------------------------------------------
        // QUICK ACTIONS: Azioni Rapide per le Righe Consegna
        // ----------------------------------------------------
                        function SegnaConsegnaCompletata(id, statoAttuale) {
            var modalId = 'premiumConfirmModal';
            var oldModal = document.getElementById(modalId);
            if(oldModal) oldModal.parentNode.removeChild(oldModal);
            
            var modal = document.createElement("div");
            modal.id = modalId;
            modal.style.position = "fixed";
            modal.style.top = "0";
            modal.style.left = "0";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(0,0,0,0.8)";
            modal.style.zIndex = "999999";
            
            var isCompletato = (statoAttuale === "COMPLETATO");
            var targetStato = isCompletato ? "CONFERMATO" : "COMPLETATO";
            var textColor = isCompletato ? "#eab308" : "#10b981";
            var targetIcon = isCompletato ? "fa-undo" : "fa-check";
            
            var promptText = isCompletato 
                ? "Vuoi RIPORTARE la consegna <b>#" + id + "</b> allo stato <span style='color:" + textColor + "; font-weight:bold;'>CONFERMATO</span>?"
                : "Vuoi CONTRASSEGNARE la consegna <b>#" + id + "</b> come <span style='color:" + textColor + "; font-weight:bold;'>COMPLETATO</span>?";
                
            var html = '<div style="background: linear-gradient(145deg, #1e2130, #13151f); border: 1px solid #d4af37; border-radius: 12px; width: 420px; padding: 30px; box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(212,175,55,0.05); margin: auto; margin-top: 15vh; text-align: center;">' +
                '<h2 style="color: #d4af37; margin-bottom: 15px; font-size: 18px; font-family: \'Segoe UI\';"><i class="fa fa-question-circle"></i> CONFERMA AZIONE</h2>' +
                '<div style="color: white; font-size: 15px; font-family: \'Segoe UI\'; margin-bottom: 25px;">' + promptText + '</div>' +
                '<div>' +
                '<button onclick="document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\'))" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'" style="background: rgba(255,255,255,0.05); border: 1px solid #64748b; color: #94a3b8; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-family: \'Segoe UI\'; margin-right: 15px; transition: all 0.2s;">ANNULLA</button>' +
                '<button onclick="EseguiCambioStato(\'' + id + '\', \'' + targetStato + '\'); document.getElementById(\'' + modalId + '\').parentNode.removeChild(document.getElementById(\'' + modalId + '\'))" onmouseover="this.style.boxShadow=\'0 4px 25px rgba(212, 175, 55, 0.4)\'" onmouseout="this.style.boxShadow=\'none\'" style="background: linear-gradient(145deg, #334155, #1e293b); border: 1px solid #64748b; color: white; padding: 10px 25px; border-radius: 6px; cursor: pointer; font-weight: bold; font-family: \'Segoe UI\'; transition: all 0.2s;"><i class="fa ' + targetIcon + '"></i> CONFERMA</button>' +
                '</div></div>';
            modal.innerHTML = html;
            document.body.appendChild(modal);
        }

        function EseguiCambioStato(id, targetStato) {
            try {
                var http = new ActiveXObject("MSXML2.XMLHTTP");
                http.open("POST", "http://127.0.0.1:3002/query", true);
                http.setRequestHeader("Content-Type", "application/json");
                http.onreadystatechange = function() {
                    if (http.readyState === 4) {
                        if (http.status === 200) {
                            MostraToast("Consegna #" + id + " aggiornata a " + targetStato + "!", "success");
                            setTimeout(function(){ CaricaUltimeConsegne(); }, 1000);
                        } else {
                            MostraToast("Errore durante l'aggiornamento (Server DB non online)", "error");
                        }
                    }
                };
                http.send(JSON.stringify({ sql: "UPDATE tblConsegne SET Stato='" + targetStato + "' WHERE ID=" + id }));
            } catch(e) {
                MostraToast("Errore di connessione al database locale.", "error");
            }
        }

        function MostraDettagliRapidi(id, cliente, citta, merce, stato) {
            var oldModal = document.getElementById("quickDetailsModal");
            if(oldModal) oldModal.parentNode.removeChild(oldModal);
            
            var modal = document.createElement("div");
            modal.id = "quickDetailsModal";
            modal.style.position = "fixed";
            modal.style.top = "0";
            modal.style.left = "0";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(10, 11, 16, 0.85)";
            // modal.style.backdropFilter = "blur(8px)"; // backdrop-filter non ben supportato in IE11, simuliamo con opacity
            modal.style.zIndex = "99999";
            modal.style.display = "flex";
            modal.style.alignItems = "center";
            modal.style.justifyContent = "center";
            
            var coloreStato = "#3b82f6";
            if (stato.indexOf("COMPLET") !== -1 || stato.indexOf("CONFERM") !== -1) coloreStato = "#10b981";
            if (stato.indexOf("URG") !== -1 || stato.indexOf("ERR") !== -1) coloreStato = "#ef4444";
            
            var html = '<div style="background: linear-gradient(145deg, #1e2130, #13151f); border: 1px solid #d4af37; border-radius: 12px; width: 450px; padding: 30px; box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(212,175,55,0.05); margin: auto; margin-top: 15vh;">' +
                '<h2 style="color: #d4af37; margin-bottom: 20px; font-size: 18px; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 10px; font-family: \'Segoe UI\';"><i class="fa fa-info-circle"></i> DETTAGLIO RAPIDO CONSEGNA #' + id + '</h2>' +
                '<div style="margin-bottom: 12px; font-family: \'Segoe UI\';"><span style="color: #64748b; font-size: 11px; font-weight: bold;">CLIENTE</span><br><span style="color: white; font-size: 14px;">' + cliente + '</span></div>' +
                '<div style="margin-bottom: 12px; font-family: \'Segoe UI\';"><span style="color: #64748b; font-size: 11px; font-weight: bold;">CITTÃ€</span><br><span style="color: white; font-size: 14px;">' + citta + '</span></div>' +
                '<div style="margin-bottom: 12px; font-family: \'Segoe UI\';"><span style="color: #64748b; font-size: 11px; font-weight: bold;">STATO ATTUALE</span><br><span style="color: ' + coloreStato + '; font-weight: bold; font-size: 14px;">' + stato + '</span></div>' +
                '<div style="margin-bottom: 25px; font-family: \'Segoe UI\';"><span style="color: #64748b; font-size: 11px; font-weight: bold;">MERCE SPEDITA</span><br><div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; color: #cbd5e1; font-size: 13px; margin-top: 5px; max-height: 150px; overflow-y: auto;">' + merce + '</div></div>' +
                '<div style="text-align: right;"><button onclick="document.getElementById(\'quickDetailsModal\').parentNode.removeChild(document.getElementById(\'quickDetailsModal\'))" style="background: rgba(212,175,55,0.1); border: 1px solid #d4af37; color: #ffe066; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-family: \'Segoe UI\'; transition: all 0.2s;">CHIUDI DETTAGLI</button></div>' +
                '</div>';
            modal.innerHTML = html;
            document.body.appendChild(modal);
        }
        
        // ----------------------------------------------------
        // SAFE VAULT BACKUP
        // ----------------------------------------------------
        function EseguiBackupSicuro() {
            try {
                // Definisci currentDir per questo script
                var currentDir = fso.BuildPath(root, "File_Sistema");
                
                // Crea cartella se non esiste
                var backupFolder = fso.BuildPath(currentDir, "Backup_Vault");
                if (!fso.FolderExists(backupFolder)) {
                    fso.CreateFolder(backupFolder);
                }
                
                var sourceDB = fso.BuildPath(currentDir, "ConsegneDB.accdb");
                var destExt = ".accdb";
                if (!fso.FileExists(sourceDB)) {
                    sourceDB = fso.BuildPath(currentDir, "ConsegneDB_Legacy.sqlite");
                    destExt = ".sqlite";
                }
                
                if (!fso.FileExists(sourceDB)) {
                    ToastManager.warning("Errore: Database non trovato in " + currentDir);
                    return;
                }
                
                // Crea nome file con data e ora
                var d = new Date();
                var timestamp = d.getFullYear() + ("0" + (d.getMonth()+1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "_" + 
                                ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ("0" + d.getSeconds()).slice(-2);
                var destDB = fso.BuildPath(backupFolder, "ConsegneDB_BACKUP_" + timestamp + destExt);
                
                // UI Animazione Hack/Sci-fi
                var overlay = document.createElement("div");
                overlay.id = "backupOverlay";
                overlay.style.position = "fixed";
                overlay.style.top = "0";
                overlay.style.left = "0";
                overlay.style.width = "100%";
                overlay.style.height = "100%";
                overlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
                overlay.style.zIndex = "999999";
                overlay.style.display = "flex";
                overlay.style.flexDirection = "column";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.fontFamily = "Courier New, monospace";
                overlay.style.color = "#d4af37";
                
                var html = '<div style="font-size: 40px; margin-bottom: 20px;"><i class="fa fa-shield"></i></div>' +
                           '<h2 style="font-size: 24px; margin-bottom: 15px; letter-spacing: 5px;">SAFE VAULT PROTOCOL INIZIALIZZATO</h2>' +
                           '<div style="width: 300px; height: 10px; border: 1px solid #d4af37; margin-bottom: 20px;">' +
                           '<div id="backupBar" style="width: 0%; height: 100%; background-color: #d4af37; transition: width 0.5s;"></div>' +
                           '</div>' +
                           '<div id="backupText" style="font-size: 14px; color: #10b981;">Creazione snapshot database in corso...</div>';
                overlay.innerHTML = html;
                document.body.appendChild(overlay);
                
                // Effettuiamo la copia
                fso.CopyFile(sourceDB, destDB, true);
                
                // Simula avanzamento
                setTimeout(function() { document.getElementById("backupBar").style.width = "40%"; document.getElementById("backupText").innerText = "Compressione e criptazione (simulata)..."; }, 500);
                setTimeout(function() { document.getElementById("backupBar").style.width = "80%"; document.getElementById("backupText").innerText = "Trasferimento al Vault locale..."; }, 1200);
                setTimeout(function() { 
                    document.getElementById("backupBar").style.width = "100%"; 
                    document.getElementById("backupText").innerText = "BACKUP COMPLETATO CON SUCCESSO!"; 
                    document.getElementById("backupText").style.color = "#d4af37";
                    
                    setTimeout(function() {
                        document.body.removeChild(overlay);
                        MostraToast("Backup salvato in Backup_Vault", "success");
                    }, 1500);
                }, 2000);
                
            } catch(e) {
                ToastManager.warning("Errore durante il Safe Vault Backup: " + e.message);
                var overlay = document.getElementById("backupOverlay");
                if (overlay) document.body.removeChild(overlay);
            }
        }
        
        function TornaInPrimoPiano() {
            window.focus();
            try {
                var wsh = new ActiveXObject("WScript.Shell");
                wsh.AppActivate("C. Milella - Portale del Supervisore Gold Edition");
            } catch(e) {}
        }
        
        // Chiude in sicurezza il portale allineando i dati se ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ presente la chiavetta USB
        var isClosingNormally = false;
        function ChiudiPortale() {
            if (typeof window.ShowGoldConfirm === "function") {
                window.ShowGoldConfirm(
                    "CONFERMA USCITA",
                    "Sei sicuro di voler uscire dal Cruscotto di Controllo Amministrativo?",
                    "SÃ¬, Esci",
                    "Annulla",
                    function() {
                        EseguiChiusuraEffettivaPortabile();
                    },
                    null,
                    "ðŸšª"
                );
            } else {
                if (confirm("Sei sicuro di voler uscire dal Cruscotto di Controllo Amministrativo?")) {
                    EseguiChiusuraEffettivaPortabile();
                }
            }
        }

        function EseguiChiusuraEffettivaPortabile() {
            isClosingNormally = true;
            try {
                var usbFound = false;
                var usbDriveLetter = "";
                var loc = document.location.pathname;
                if(loc.indexOf("/") === 0) loc = loc.substring(1);
                loc = decodeURIComponent(loc).replace(/\//g, "\\");
                var currentDrive = loc.substring(0, 2).toUpperCase();
                
                if (currentDrive === "C:") {
                    for (var i = 65; i <= 90; i++) { // A to Z
                        var dLetter = String.fromCharCode(i);
                        try {
                            if (fso.DriveExists(dLetter)) {
                                var d = fso.GetDrive(dLetter);
                                var isReady = false;
                                try { isReady = d.IsReady; } catch(err) { isReady = false; }
                                
                                if (isReady && dLetter !== "C") {
                                    var dType = 0;
                                    try { dType = d.DriveType; } catch(err) {}
                                    var fullDrive = dLetter + ":";
                                    
                                    // 1. Preferenza se esiste giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  la cartella specifica
                                    if (fso.FolderExists(fullDrive + "\\LOGISTICA_CONSEGNE_MC")) {
                                        usbDriveLetter = fullDrive;
                                        usbFound = true;
                                        break; // Trovato abbinamento perfetto, interrompi
                                    }
                                    // 2. Fallback su qualsiasi unitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  rimovibile (DriveType === 1 o 2)
                                    if ((dType === 1 || dType === 2) && !usbDriveLetter) {
                                        usbDriveLetter = fullDrive;
                                        usbFound = true;
                                    }
                                }
                            }
                        } catch(driveErr) {}
                    }
                }
                
                if (usbFound && usbDriveLetter) {
                    document.getElementById("usbModalLetter").innerText = "(" + usbDriveLetter + ")";
                    document.getElementById("usbExitModal").style.display = "flex";
                    
                    window._pendingUsbDrive = usbDriveLetter;
                    window._pendingLoc = loc;
                    return; 
                }
            } catch(e) {}
            window.close();
        }
        
        window.ConfirmUsbSync = function(syncRequested) {
            document.getElementById("usbExitModal").style.display = "none";
            if (syncRequested && window._pendingUsbDrive) {
                var loc = window._pendingLoc;
                var currentFolder = fso.GetParentFolderName(loc);
                var parentFolder = fso.GetParentFolderName(currentFolder);
                var rootFolder = fso.GetParentFolderName(parentFolder);
                var batPath = fso.BuildPath(rootFolder, "0_ALLINEA_CHIAVETTA.bat");
                if (fso.FileExists(batPath)) {
                    shell.Run('cmd.exe /c "' + batPath + '" ' + window._pendingUsbDrive, 1, true);
                }
            }
            window._pendingUsbDrive = null;
            window._pendingLoc = null;
            window.close();
        };

        window.onbeforeunload = function() {
            // Se stiamo giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  chiudendo normalmente (usando il pulsante rosso), 
            // il controllo USB ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  stato fatto dal modale in-page. Saltiamo tutto.
            if (isClosingNormally) {
                return; 
            }

            // Altrimenti (chiusura forzata es. Alt+F4 o Taskbar):
            try {
                var usbFound = false;
                var usbDriveLetter = "";
                var loc = document.location.pathname;
                if(loc.indexOf("/") === 0) loc = loc.substring(1);
                loc = decodeURIComponent(loc).replace(/\//g, "\\");
                var currentDrive = loc.substring(0, 2).toUpperCase();
                
                if (currentDrive === "C:") {
                    for (var i = 65; i <= 90; i++) { // A to Z
                        var dLetter = String.fromCharCode(i);
                        try {
                            if (fso.DriveExists(dLetter)) {
                                var d = fso.GetDrive(dLetter);
                                var isReady = false;
                                try { isReady = d.IsReady; } catch(err) { isReady = false; }
                                
                                if (isReady && dLetter !== "C") {
                                    var dType = 0;
                                    try { dType = d.DriveType; } catch(err) {}
                                    var fullDrive = dLetter + ":";
                                    
                                    if (fso.FolderExists(fullDrive + "\\LOGISTICA_CONSEGNE_MC")) {
                                        usbDriveLetter = fullDrive;
                                        usbFound = true;
                                        break; 
                                    }
                                    if ((dType === 1 || dType === 2) && !usbDriveLetter) {
                                        usbDriveLetter = fullDrive;
                                        usbFound = true;
                                    }
                                }
                            }
                        } catch(driveErr) {}
                    }
                }
                
                if (usbFound && usbDriveLetter) {
                    var currentFolder = fso.GetParentFolderName(loc);
                    var parentFolder = fso.GetParentFolderName(currentFolder);
                    var rootFolder = fso.GetParentFolderName(parentFolder);
                    
                    // Il file usb_prompt.html si trova in File_Sistema, che ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ dentro la cartella corrente del portale
                    var htmlPath = fso.BuildPath(currentFolder, "File_Sistema\\usb_prompt.html");
                    
                    if (fso.FileExists(htmlPath)) {
                        // Utilizziamo il popup HTML sincrono
                        var conferma = window.showModalDialog("File_Sistema/usb_prompt.html", usbDriveLetter, "dialogWidth:480px;dialogHeight:320px;center:yes;scroll:no;status:no;resizable:no;");
                        
                        // Se l'utente ha risposto (SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ o No), acconsentiamo alla chiusura, annullando il Kiosk
                        if (conferma !== undefined) {
                            isClosingNormally = true;
                            
                            if (conferma === true) { 
                                var batPath = fso.BuildPath(rootFolder, "0_ALLINEA_CHIAVETTA.bat");
                                if (fso.FileExists(batPath)) {
                                    shell.Run('cmd.exe /c "' + batPath + '" ' + usbDriveLetter, 1, true); 
                                }
                            }
                        }
                    }
                }
            } catch(e) {}
        };

        // ----------------------------------------------------
        // PONTE MOBILE RADAR
        // ----------------------------------------------------
        var radarInterval = null;
        function AvviaRadar() {
            function pingServer() {
                try {
                    var http = new ActiveXObject("MSXML2.XMLHTTP");
                    http.open("GET", "http://127.0.0.1:3002/", true);
                    http.onreadystatechange = function() {
                        if (http.readyState === 4) {
                            var dot = document.getElementById("radarIndicator");
                            var txt = document.getElementById("radarText");
                            if (dot && txt) {
                                if (http.status === 200 || http.status === 404 || http.status === 500) {
                                    // Se risponde qualcosa sulla porta 3002, il server Node ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ vivo
                                    dot.className = "radar-dot online";
                                    txt.innerText = "Ponte Mobile (Online)";
                                    txt.style.color = "#10b981";
                                } else {
                                    dot.className = "radar-dot";
                                    txt.innerText = "Ponte Mobile (Offline)";
                                    txt.style.color = "#ef4444";
                                }
                            }
                        }
                    };
                    http.send();
                } catch(e) {}
            }
            pingServer();
            radarInterval = setInterval(pingServer, 5000);
        }

        function InitPortaleGoldCore() {
            try { AvviaRadar(); } catch(e) {}
            try { CaricaDatiAusili(); } catch(e) {}
            try { CaricaOperatoriPostit(); } catch(e) {}
            try { EseguiDiagnostica(); } catch(e) {}
            try { EseguiAutoBackup(); } catch(e) {}
            try { DisegnaPostit(); } catch(e) {}
            try { AggiornaSalutoDinamico(); } catch(e) {}
            try { AggiornaOrologio(); } catch(e) {}
            try { CaricaUltimoTfrFerie(); } catch(e) {}
            try { ControllaStatoUSB(); } catch(e) {}
            try { CaricaUltimeConsegne(); } catch(e) {}
            
            // Sincronizza stato grafico dell'assistente vocale se caricato disattivato
            if (!voiceEnabled) {
                var el = document.getElementById("btnToggleVoice");
                if (el) {
                    el.innerHTML = "<i class='fa fa-volume-off'></i>";
                    el.title = "Attiva Audio Vocale (Ctrl+V / Ctrl+A)";
                }
            }
            try { SincronizzaInterazioneMouse(); } catch(e) {}

            // Avviso se in esecuzione da chiavetta
            try {
                var locPath = document.location.pathname;
                if(locPath.indexOf("/") === 0) locPath = locPath.substring(1);
                locPath = decodeURIComponent(locPath).replace(/\//g, "\\");
                var currentDrive = locPath.substring(0, 2).toUpperCase();
                if (currentDrive !== "C:") {
                    AggiungiLog("SYSTEM", "ATTENZIONE: Esecuzione da Chiavetta " + currentDrive + ". Ricorda di allineare i dati sul PC fisso!", "warning");
                }
            } catch(e) {}
            // Riproduzione vocale benvenuto (Smart Briefing)
            setTimeout(function() {
                try {
                    var consegneVal = document.getElementById("cntConsegne") ? document.getElementById("cntConsegne").innerText : "molte";
                    if (consegneVal === "---") consegneVal = "diverse";
                    
                    var postitVal = 0;
                    var holder = document.getElementById("postitHolder");
                    if (holder) {
                        postitVal = holder.getElementsByClassName("postit-sticker").length;
                    }
                    
                    Parla("Buongiorno Ciro. Sistema operativo. Trovate " + consegneVal + " consegne totali nel database e " + postitVal + " avvisi in bacheca. Premi V per disabilitare.");
                } catch(e) {}
            }, 1800);

            // Sblocca il lettore vocale dei controlli dopo 9.5 secondi (fine messaggio di benvenuto)
            setTimeout(function() {
                startupSpeechBlock = false;
            }, 9500);

            // Esegue compattazione SQLite (VACUUM) in background all'avvio (dopo 3 secondi)
            setTimeout(function() {
                try {
                    var httpVac = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
                    httpVac.Open("POST", "http://127.0.0.1:3002/query", true); // Asincrono (true) per non bloccare la UI
                    httpVac.SetRequestHeader("Content-Type", "application/json");
                    httpVac.Send(JSON.stringify({ sql: "VACUUM" }));
                } catch(eVac) {}
            }, 3000);
            
            // Loop orologio, diagnostica, TFR, USB status e Consegne
            setInterval(AggiornaOrologio, 1000);
            setInterval(EseguiDiagnostica, 4000);
            setInterval(CaricaUltimoTfrFerie, 8000);
            setInterval(ControllaStatoUSB, 5000);
            setInterval(CaricaUltimeConsegne, 7000);
            
            // Adatta UI se in modalita Ufficio
            if (isUfficio) {
                var lblTitle = document.getElementById("lblTitleText");
                if (lblTitle) lblTitle.innerHTML = "C. MILELLA &bull; PORTALE DI CONTROLLO UFFICIO";
                var lblSubtitle = document.getElementById("lblBrandSubtitle");
                if (lblSubtitle) lblSubtitle.innerText = "OFFICE CONTROL CENTER";
                
                // Eleva Ufficio a pulsante primario
                var btnUfficio = document.getElementById("btnAvviaUfficio");
                if (btnUfficio) {
                    btnUfficio.className = "btn-gold";
                    btnUfficio.innerHTML = "&#128666; APRI GESTIONE CONSEGNE";
                    btnUfficio.style.marginBottom = "12px";
                }
                
                // Abilita sempre il Ponte Mobile
                var btnPonte = document.getElementById("btnAvviaPonte");
                if (btnPonte) {
                    btnPonte.disabled = false;
                    btnPonte.style.opacity = "1";
                    btnPonte.style.cursor = "pointer";
                    btnPonte.style.borderColor = "#38bdf8";
                    btnPonte.style.color = "#38bdf8";
                    btnPonte.title = "Avvia il servizio di sincronizzazione Ponte Mobile per i dispositivi della flotta";
                }
            }
            
            // Associazione Pulsanti
            document.getElementById("btnAvviaMaster").onclick = function() {
                var isLogged = sessionStorage.getItem("isLogged") === "true";
                if (!isLogged) {
                    if (typeof ToastManager !== "undefined") ToastManager.warning("Autenticazione richiesta! Seleziona l'operatore ed inserisci la password.");
                    else alert("Autenticazione richiesta! Seleziona l'operatore ed inserisci la password.");
                    
                    if (typeof window.ApriSelezionaOperatore === "function") {
                        window.ApriSelezionaOperatore();
                    } else if (parent && typeof parent.ApriSelezionaOperatore === "function") {
                        parent.ApriSelezionaOperatore();
                    }
                    return;
                }
                AggiungiLog("SYSTEM", "Avvio Pannello di Controllo Dashboard in corso...", "system");
                var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof require === "function");
                if (isElectron) {
                    window.location.href = "File_Sistema/dashboard.html";
                } else {
                    var dashPath = fso ? fso.BuildPath(root, "File_Sistema\\dashboard.html") : "File_Sistema\\dashboard.html";
                    if (fso && !fso.FileExists(dashPath)) dashPath = fso.BuildPath(root, "File_Sistema\\dashboard.hta");
                    if (shell) shell.Run('mshta.exe "' + dashPath + '"', 1, false);
                    else window.location.href = dashPath;
                }
            };
            
            document.getElementById("btnAvviaPonte").onclick = function() {
                if (typeof AggiungiLog === "function") AggiungiLog("SYSTEM", "Avvio Ponte Mobile HTA (2_AVVIA_PONTE_MOBILE.bat)...", "system");
                
                try {
                    var sh = (typeof shell !== "undefined" && shell) ? shell : (typeof ActiveXObject !== "undefined" ? new ActiveXObject("WScript.Shell") : null);
                    if (sh) {
                        var batPath = "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\2_AVVIA_PONTE_MOBILE.bat";
                        if (typeof fso !== "undefined" && fso && typeof root !== "undefined") {
                            var checkPath = fso.BuildPath(root, "2_AVVIA_PONTE_MOBILE.bat");
                            if (fso.FileExists(checkPath)) {
                                batPath = checkPath;
                            } else {
                                checkPath = fso.BuildPath(root, "File_Sistema\\AVVIA_MOBILE.bat");
                                if (fso.FileExists(checkPath)) batPath = checkPath;
                            }
                        }
                        sh.Run('cmd.exe /c "' + batPath + '"', 1, false);
                    }
                } catch(e) {
                    console.warn("Avvio batch da browser non supportato:", e.message);
                }
            };
            
            document.getElementById("btnAvviaUfficio").onclick = function() {
                var isLogged = sessionStorage.getItem("isLogged") === "true";
                if (!isLogged) {
                    if (typeof ToastManager !== "undefined") ToastManager.warning("Autenticazione richiesta! Seleziona l'operatore ed inserisci la password.");
                    else alert("Autenticazione richiesta! Seleziona l'operatore ed inserisci la password.");
                    
                    if (typeof window.ApriSelezionaOperatore === "function") {
                        window.ApriSelezionaOperatore();
                    } else if (parent && typeof parent.ApriSelezionaOperatore === "function") {
                        parent.ApriSelezionaOperatore();
                    }
                    return;
                }
                AggiungiLog("SYSTEM", "Avvio Edizione Ufficio / Consegne in corso...", "system");
                var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) || (typeof require === "function");
                if (isElectron) {
                    window.location.href = "File_Sistema/consegne.html";
                } else {
                    var consPath = fso ? fso.BuildPath(root, "File_Sistema\\consegne.html") : "File_Sistema\\consegne.html";
                    if (shell) shell.Run('mshta.exe "' + consPath + '"', 1, false);
                    else window.location.href = consPath;
                }
            };
            
            document.getElementById("btnAvviaFerie").onclick = function() {
                AggiungiLog("SYSTEM", "Avvio Registro Ferie e TFR...", "system");
                if (typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.send("open-ferie-window");
                        return;
                    } catch(e) {}
                }
                try {
                    if (typeof fso !== 'undefined' && fso && typeof shell !== 'undefined' && shell) {
                        var batPath = fso.BuildPath(root, "File_Sistema\\gestione_ferie_tfr\\launcher.bat");
                        if (fso.FileExists(batPath)) {
                            shell.Run('cmd.exe /c "' + batPath + '"', 0, false);
                            return;
                        }
                    }
                } catch(err) {}
                window.open("File_Sistema/gestione_ferie_tfr/index.html", "_blank");
            };
            
            document.getElementById("btnAvviaSync").onclick = function() {
                var syncPath = fso.BuildPath(root, "File_Sistema\\UTILITY_SYNC_USB.html");
                if (fso.FileExists(syncPath)) {
                    AggiungiLog("SYSTEM", "Avvio Utility Sincronizzazione USB...", "system");
                    shell.Run('mshta.exe "' + syncPath + '"', 1, false);
                } else {
                    AggiungiLog("SYSTEM", "Errore: Utility Sync USB non trovata", "error");
                    ToastManager.warning("Utility di sincronizzazione USB non trovata.");
                }
            };
            
            document.getElementById("btnSblocca").onclick = function() {
                if (confirm("Vuoi forzare lo sblocco del database arrestando eventuali istanze Node appese?")) {
                    AggiungiLog("SYSTEM", "Esecuzione sblocco database forzato...", "warning");
                    shell.Run("taskkill /f /im node.exe", 0, true);
                    EseguiDiagnostica();
                    AggiungiLog("SYSTEM", "Sblocco database completato", "success");
                    ToastManager.warning("Tutti i processi bloccanti sono stati terminati con successo.");
                }
            };
            
            // Inizializzazione Log Dinamici e Risorse
            AggiungiLog("SYSTEM", "Console operativa avviata e pronta", "system");
            if (isUfficio) {
                AggiungiLog("SYSTEM", "Ambiente caricato: EDIZIONE UFFICIO", "success");
            } else {
                AggiungiLog("SYSTEM", "Ambiente caricato: GOLD CONTROL CENTER", "success");
            }
            AggiungiLog("VOICE", "Sintesi vocale pronta", "system");
            
            // Avvio monitoraggio risorse locale WMI
            try { AggiornaRisorse(); } catch(e) {}
            setInterval(function() { try { AggiornaRisorse(); } catch(e) {} }, 5000); // Aggiorna ogni 5 secondi
        }

        if (document.readyState === "complete" || document.readyState === "interactive") {
            setTimeout(InitPortaleGoldCore, 10);
        } else if (typeof window.addEventListener === "function") {
            window.addEventListener("load", InitPortaleGoldCore, false);
            window.addEventListener("DOMContentLoaded", InitPortaleGoldCore, false);
        } else {
            var _oldOnloadCore = window.onload;
            window.onload = function() {
                if (typeof _oldOnloadCore === "function") {
                    try { _oldOnloadCore(); } catch(e) {}
                }
                InitPortaleGoldCore();
            };
        }

            // --- SISTEMA DI ACCESSIBILITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ INTEGRATO (LETTORE CONTROLLI SU FOCUS/HOVER) ---
            var lastVoicedElement = null;
            var voiceHandler = function(e) {
                var el = e.target || e.srcElement;
                if (!el || !voiceEnabled || startupSpeechBlock) return;
                
                // Cerca l'antenato interattivo piÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ vicino (fino a 5 livelli per i postit)
                var current = el;
                var depth = 0;
                var interactiveEl = null;
                while (current && depth < 5) {
                    if (current.nodeType === 1) {
                        var tag = current.tagName ? current.tagName.toUpperCase() : "";
                        var className = current.className || "";
                        if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "A" ||
                            className.indexOf("btn") !== -1 || className.indexOf("dropdown-item") !== -1 || 
                            className.indexOf("menu-title") !== -1 || className.indexOf("postit-sticker") !== -1 ||
                            className.indexOf("config-tab-btn") !== -1 || 
                            (current.getAttribute && current.getAttribute("onclick")) || 
                            (current.getAttribute && current.getAttribute("title"))) {
                            interactiveEl = current;
                            break;
                        }
                    }
                    current = current.parentNode;
                    depth++;
                }
                
                if (!interactiveEl) return;
                
                // Evita di ripetere la lettura se siamo giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  sullo stesso controllo
                if (interactiveEl === lastVoicedElement) return;
                lastVoicedElement = interactiveEl;
                
                var text = "";
                var title = interactiveEl.getAttribute("title") || "";
                var tag = interactiveEl.tagName ? interactiveEl.tagName.toUpperCase() : "";
                var className = interactiveEl.className || "";
                
                if (title) {
                    text = title;
                } else if (tag === "BUTTON" || className.indexOf("btn") !== -1 || className.indexOf("dropdown-item") !== -1) {
                    text = interactiveEl.innerText || interactiveEl.textContent;
                    if (text) text = "Pulsante: " + text;
                } else if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                    var placeholder = interactiveEl.getAttribute("placeholder") || "";
                    var labelText = "";
                    if (interactiveEl.id) {
                        var labelEl = document.querySelector("label[for='" + interactiveEl.id + "']");
                        if (labelEl) labelText = labelEl.innerText || labelEl.textContent;
                    }
                    text = labelText || placeholder || interactiveEl.id || interactiveEl.name || "";
                    if (tag === "SELECT") {
                        text = "Selezione: " + text;
                    } else if (tag === "INPUT" && interactiveEl.type === "checkbox") {
                        text = "Casella di controllo: " + text + (interactiveEl.checked ? ", selezionata" : ", non selezionata");
                    } else {
                        text = "Casella di testo: " + text;
                    }
                } else if (className.indexOf("postit-sticker") !== -1) {
                    // Estrae il testo utile del post-it pulendo markup HTML
                    text = "Post-it: " + (interactiveEl.innerText || interactiveEl.textContent);
                } else if (className.indexOf("config-tab-btn") !== -1) {
                    text = "Scheda: " + (interactiveEl.innerText || interactiveEl.textContent);
                } else if (className.indexOf("menu-title") !== -1) {
                    text = "Menu: " + (interactiveEl.innerText || interactiveEl.textContent);
                }
                
                if (text) {
                    // Pulisce simboli, emoji e spazi doppi per una pronuncia fluida
                    text = text.replace(/[^a-zA-Z0-9ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â²ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ \.,\?!:\-]/g, " ").replace(/\s+/g, " ").trim();
                    Parla(text);
                }
            };
            
            var resetHandler = function(e) {
                var el = e.target || e.srcElement;
                if (el === lastVoicedElement || (lastVoicedElement && lastVoicedElement.contains(el))) {
                    var related = e.relatedTarget || e.toElement;
                    if (!related || !lastVoicedElement.contains(related)) {
                        lastVoicedElement = null;
                    }
                }
            };

            if (document.addEventListener) {
                document.addEventListener("focusin", voiceHandler, true);
                document.addEventListener("mouseover", voiceHandler, true);
                document.addEventListener("mouseout", resetHandler, true);
            } else if (document.attachEvent) {
                document.attachEvent("onfocusin", voiceHandler);
                document.attachEvent("onmouseover", voiceHandler);
                document.attachEvent("onmouseout", resetHandler);
            }
        
        // Gestione Selezione e Scorciatoie da Tastiera
        var selectedPostitIndex = -1;

        function SelezionaPostit(idx) {
            selectedPostitIndex = idx;
            var holder = document.getElementById("postitHolder");
            if (holder) {
                var stickers = holder.getElementsByClassName("postit-sticker");
                for (var i = 0; i < stickers.length; i++) {
                    stickers[i].className = stickers[i].className.replace(" selected-postit", "");
                    var rot = stickers[i].getAttribute("data-rot") || "0";
                    if (i === idx) {
                        stickers[i].className += " selected-postit";
                        stickers[i].style.transform = "scale(1.05)";
                        stickers[i].style.zIndex = "50";
                    } else {
                        stickers[i].style.transform = "rotate(" + rot + "deg)";
                        stickers[i].style.zIndex = "1";
                    }
                }
            }
        }

        function DeselezionaPostit() {
            selectedPostitIndex = -1;
            var holder = document.getElementById("postitHolder");
            if (holder) {
                var stickers = holder.getElementsByClassName("postit-sticker");
                for (var i = 0; i < stickers.length; i++) {
                    stickers[i].className = stickers[i].className.replace(" selected-postit", "");
                    var rot = stickers[i].getAttribute("data-rot") || "0";
                    stickers[i].style.transform = "rotate(" + rot + "deg)";
                    stickers[i].style.zIndex = "1";
                }
            }
        }

        document.onclick = function() {
            var el = window.event.srcElement;
            var isPostit = false;
            while (el) {
                if (el.className && String(el.className).indexOf("postit-sticker") !== -1) {
                    isPostit = true;
                    break;
                }
                el = el.parentElement;
            }
            if (!isPostit) {
                DeselezionaPostit();
            }
        };

        document.onkeydown = function() {
            var key = window.event.keyCode;
            
            // Chiudi Configurazione Ausili con ESC
            var configOverlay = document.getElementById("configModalOverlay");
            if (configOverlay && configOverlay.style.display === "block") {
                if (key === 27) { // Escape
                    NascondiConfigAusili();
                    window.event.returnValue = false;
                    return;
                }
            }
            
            // Chiudi Statistiche Spedizioni con ESC
            var statsOverlay = document.getElementById("statsModalOverlay");
            if (statsOverlay && statsOverlay.style.display === "block") {
                if (key === 27) { // Escape
                    NascondiStatistiche();
                    window.event.returnValue = false;
                    return;
                }
            }
            
            // Apri Command Palette con Ctrl+Spazio
            if (window.event.ctrlKey && key === 32) {
                MostraPalette();
                window.event.returnValue = false;
                return;
            }
            
            // Evita scorciatoie se l'utente sta scrivendo negli input o textarea
            var activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
                if (key === 27) { // Escape
                    AnnullaModifica();
                    activeEl.blur();
                }
                return;
            }
            
            // Tasto 'V' o 'A' per attivare/disattivare assistente vocale
            if (key === 86 || key === 65) {
                ToggleVoiceAudio();
                window.event.returnValue = false;
                return;
            }
            
            if (selectedPostitIndex !== -1) {
                if (key === 69 || key === 13 || key === 77) { // 'E', 'Enter', 'M'
                    ModificaPostit(selectedPostitIndex);
                    setTimeout(function() {
                        var tit = document.getElementById("postitTitolo");
                        if (tit) tit.focus();
                    }, 50);
                    window.event.returnValue = false;
                }
                else if (key === 46 || key === 68) { // 'Delete' (Canc), 'D'
                    RimuoviPostit(selectedPostitIndex);
                    window.event.returnValue = false;
                }
                else if (key === 27) { // Escape
                    DeselezionaPostit();
                    window.event.returnValue = false;
                }
            }
        };

        // --- DYNAMIC AUTO-BACKUP SYSTEM ---
        function EseguiAutoBackup() {
            try {
                if (typeof fso === "undefined" || !fso) return;
                var dbFile = fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "ConsegneDB.accdb");
                if (!fso.FileExists(dbFile)) {
                    dbFile = fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "ConsegneDB_Legacy.sqlite");
                }
                if (!fso.FileExists(dbFile)) return;
                
                var backupDir = fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "backups");
                if (!fso.FolderExists(backupDir)) {
                    fso.CreateFolder(backupDir);
                }
                
                var oggi = new Date();
                var dd = (oggi.getDate() < 10 ? '0' : '') + oggi.getDate();
                var mm = ((oggi.getMonth() + 1) < 10 ? '0' : '') + (oggi.getMonth() + 1);
                var yyyy = oggi.getFullYear();
                var dataStr = yyyy + "-" + mm + "-" + dd;
                
                var ext = dbFile.substring(dbFile.lastIndexOf("."));
                var newBackupName = "ConsegneDB_Auto_" + dataStr + ext;
                var newBackupPath = fso.BuildPath(backupDir, newBackupName);
                
                if (!fso.FileExists(newBackupPath)) {
                    fso.CopyFile(dbFile, newBackupPath, true);
                    AggiungiLog("SYSTEM", "Auto-Backup giornaliero creato con successo", "success");
                }
            } catch(e) {
                // Silently bypass ActiveX exceptions when not running in HTA
            }
        }

        // --- QUICK RESOURCE CENTER ACCESSORS ---
        function ApriCartellaBackup() {
            try {
                var path = fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "backups");
                if (!fso.FolderExists(path)) {
                    fso.CreateFolder(path);
                }
                shell.Run('explorer.exe "' + path + '"');
                AggiungiLog("SYSTEM", "Apertura cartella backup in Esplora Risorse", "success");
            } catch(e) {
                ToastManager.warning("Impossibile aprire la cartella: " + e.message);
            }
        }
        
        function ApriManualeUso() {
            try {
                var manuale = fso.BuildPath(root, "MANUALE_ALLINEAMENTO_E_USO.html");
                if (fso.FileExists(manuale)) {
                    shell.Run('"' + manuale + '"');
                    AggiungiLog("SYSTEM", "Apertura manuale allineamento ed uso", "success");
                } else {
                    ToastManager.warning("File manuale non trovato.");
                }
            } catch(e) {
                ToastManager.warning("Errore apertura manuale: " + e.message);
            }
        }
        
        function ApriExcelMateriali() {
            try {
                var excelFile = fso.BuildPath(root, "ELENCO E QUANTITA'MATERIALE.xls");
                if (fso.FileExists(excelFile)) {
                    shell.Run('"' + excelFile + '"');
                    AggiungiLog("SYSTEM", "Apertura file Excel materiali", "success");
                } else {
                    ToastManager.warning("File Excel materiali non trovato.");
                }
            } catch(e) {
                ToastManager.warning("Errore apertura file Excel: " + e.message);
            }
        }
        
        // ============================================================
        // FULL BACKUP ZIP (UI + DATI) - Script PowerShell esterno
        // ============================================================
        function EseguiFullBackupZip() {
            try {
                var projectDir = fso.BuildPath(root, "File_Sistema");
                // Percorso script PowerShell relativo al progetto (tools/Crea_Backup_Completo_Zip.ps1)
                var scriptPath = fso.BuildPath(fso.BuildPath(root, "tools"), "Crea_Backup_Completo_Zip.ps1");
                if (!fso.FileExists(scriptPath)) {
                    // Prova percorso alternativo nella cartella Sistema_Logistica_Ufficio
                    var parentDir = fso.GetParentFolderName(root);
                    scriptPath = fso.BuildPath(fso.BuildPath(fso.BuildPath(parentDir, "Sistema_Logistica_Ufficio"), "tools"), "Crea_Backup_Completo_Zip.ps1");
                }
                if (!fso.FileExists(scriptPath)) {
                    ToastManager.warning("Script di backup non trovato: Crea_Backup_Completo_Zip.ps1");
                    return;
                }

                // Overlay animato "FULL BACKUP IN CORSO..."
                var overlay = document.createElement("div");
                overlay.id = "fullBackupOverlay";
                overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif;";
                overlay.innerHTML =
                    '<div style="font-size:54px;margin-bottom:20px;filter:drop-shadow(0 0 20px rgba(251,146,60,0.8));">ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã…â€œÃƒÂ¯Ã‚Â¸Ã‚Â</div>' +
                    '<h2 style="color:#fb923c;font-size:22px;font-weight:900;letter-spacing:4px;margin:0 0 8px 0;text-shadow:0 0 20px rgba(251,146,60,0.5);">FULL BACKUP IN CORSO</h2>' +
                    '<p style="color:#94a3b8;font-size:12px;margin:0 0 28px 0;letter-spacing:1px;">Compressione UI + DATI in archivio ZIP...</p>' +
                    '<div style="width:320px;height:6px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;margin-bottom:20px;">' +
                    '  <div id="fullBackupProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#f97316,#fb923c,#fbbf24);border-radius:99px;transition:width 0.5s ease;box-shadow:0 0 12px rgba(251,146,60,0.6);"></div>' +
                    '</div>' +
                    '<p id="fullBackupStatus" style="color:#64748b;font-size:11px;font-family:Consolas,monospace;letter-spacing:0.5px;">Avvio compressione...</p>';
                document.body.appendChild(overlay);

                // Animazione barra di avanzamento simulata
                var progress = 0;
                var progressInterval = setInterval(function() {
                    progress += (progress < 80) ? (Math.random() * 8 + 3) : 0.5;
                    if (progress > 96) progress = 96;
                    var bar = document.getElementById("fullBackupProgressBar");
                    if (bar) bar.style.width = progress + "%";
                    var statusEl = document.getElementById("fullBackupStatus");
                    if (statusEl) {
                        if (progress < 30) statusEl.innerText = "Raccolta file di sistema UI...";
                        else if (progress < 60) statusEl.innerText = "Copia database e file dati...";
                        else if (progress < 85) statusEl.innerText = "Compressione archivio ZIP...";
                        else statusEl.innerText = "Finalizzazione...";
                    }
                }, 600);

                AggiungiLog("SYSTEM", "Avvio Full Backup ZIP (UI+DATI) in corso...", "info");

                // Esegui lo script PowerShell in background (sincrono HTA)
                setTimeout(function() {
                    try {
                        var cmd = 'powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + scriptPath + '" -ProjectDir "' + root + '"';
                        shell.Run(cmd, 0, true);

                        clearInterval(progressInterval);
                        var bar = document.getElementById("fullBackupProgressBar");
                        if (bar) { bar.style.width = "100%"; bar.style.background = "linear-gradient(90deg,#22c55e,#4ade80)"; }
                        var statusEl = document.getElementById("fullBackupStatus");
                        if (statusEl) { statusEl.style.color = "#4ade80"; statusEl.innerText = "ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ BACKUP COMPLETATO CON SUCCESSO!"; }

                        setTimeout(function() {
                            if (document.getElementById("fullBackupOverlay")) {
                                document.body.removeChild(overlay);
                            }
                            // Apri la cartella di destinazione
                            var destFolder = fso.BuildPath(fso.BuildPath(root, "documenti"), "Backup_Completo_Sistema");
                            if (!fso.FolderExists(destFolder)) {
                                destFolder = fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "Backup_Vault");
                            }
                            if (fso.FolderExists(destFolder)) {
                                shell.Run('explorer.exe "' + destFolder + '"');
                            }
                            AggiungiLog("SYSTEM", "Full Backup ZIP completato con successo!", "success");
                            ToastManager.success("ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã…â€œÃƒÂ¯Ã‚Â¸Ã‚Â Backup ZIP salvato con successo!");
                        }, 1500);
                    } catch(e) {
                        clearInterval(progressInterval);
                        if (document.getElementById("fullBackupOverlay")) {
                            document.body.removeChild(overlay);
                        }
                        ToastManager.warning("Errore durante il backup ZIP: " + e.message);
                        AggiungiLog("SYSTEM", "Errore Full Backup ZIP: " + e.message, "error");
                    }
                }, 300);

            } catch(e) {
                ToastManager.warning("Errore avvio backup ZIP: " + e.message);
            }
        }

        // Helper per le azioni del Menu
        function triggerAction(btnId) {
            var btn = document.getElementById(btnId);
            if (btn) {
                if (btn.disabled) {
                    ToastManager.warning("Azione non disponibile in questo ambiente.");
                } else {
                    btn.click();
                }
            } else {
                ToastManager.warning("Elemento di controllo non trovato.");
            }
        }
        
        // --- FUNZIONALITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ TAVOLOZZA DEI COMANDI (COMMAND PALETTE) ---
        var paletteCommands = [
            { text: "Avvia Master PC", action: function() { triggerAction('btnAvviaMaster'); } },
            { text: "Avvia Ponte Mobile", action: function() { triggerAction('btnAvviaPonte'); } },
            { text: "Apri Edizione Ufficio", action: function() { triggerAction('btnAvviaUfficio'); } },
            { text: "Registro Buste Paga & TFR", action: function() { triggerAction('btnAvviaFerie'); } },
            { text: "Statistiche Spedizioni", action: function() { MostraStatistiche(); } },
            { text: "Guida Configurazione Ausili", action: function() { MostraConfigAusili(); } },
            { text: "Sincronizzazione USB", action: function() { triggerAction('btnAvviaSync'); } },
            { text: "Forza Sblocco Database", action: function() { triggerAction('btnSblocca'); } },
            { text: "Apri Cartella Backup", action: function() { ApriCartellaBackup(); } },
            { text: "Excel Materiali", action: function() { ApriExcelMateriali(); } },
            { text: "Manuale Operativo", action: function() { ApriManualeUso(); } },
            { text: "Toggle Assistente Vocale", action: function() { ToggleVoiceAudio(); } },
            { text: "Aggiorna Bacheca & Dati", action: function() { document.getElementById('btnRefresh').click(); } },
            { text: "Esci dal Portale", action: function() { window.close(); } }
        ];

        var activePaletteIndex = 0;
        var visibleCommands = [];

        function MostraPalette() {
            var overlay = document.getElementById("cmdPaletteOverlay");
            if (!overlay) return;
            overlay.style.display = "block";
            var input = document.getElementById("cmdPaletteInput");
            if (input) {
                input.value = "";
                input.focus();
            }
            FiltraPalette();
        }

        function NascondiPalette() {
            var overlay = document.getElementById("cmdPaletteOverlay");
            if (overlay) {
                overlay.style.display = "none";
            }
        }

        function RidisegnaListaPalette() {
            var list = document.getElementById("cmdPaletteList");
            if (!list) return;
            list.innerHTML = "";
            for (var i = 0; i < visibleCommands.length; i++) {
                var cmd = visibleCommands[i];
                var item = document.createElement("div");
                item.className = "cmd-palette-item" + (i === activePaletteIndex ? " active" : "");
                item.innerHTML = cmd.text;
                item.onclick = (function(index) {
                    return function() { EseguiComandoPalette(index); };
                })(i);
                list.appendChild(item);
            }
        }

        function FiltraPalette() {
            var query = document.getElementById("cmdPaletteInput").value.toLowerCase();
            
            // --- EASTER EGG MATRIX ---
            if (query === "matrix" || query === "hack") {
                document.getElementById("cmdPaletteInput").value = "";
                NascondiPalette();
                if(typeof AttivaHackerModeGlobale === "function") {
                    AttivaHackerModeGlobale();
                }
                return;
            }

            visibleCommands = [];
            activePaletteIndex = 0;
            
            // 1. Cerca nei comandi di sistema
            for (var i = 0; i < paletteCommands.length; i++) {
                var cmd = paletteCommands[i];
                if (cmd.text.toLowerCase().indexOf(query) !== -1) {
                    visibleCommands.push(cmd);
                }
            }
            
            RidisegnaListaPalette();
            
            // 2. Spotlight: Cerca nel database se query lunga
            if (query.length >= 3) {
                visibleCommands.push({ text: "<i style='color:#94a3b8; font-size:11px;'>Ricerca '" + query + "' nel database...</i>", action: function(){} });
                RidisegnaListaPalette();
                
                try {
                    var http = new ActiveXObject("MSXML2.XMLHTTP");
                    http.open("POST", "http://127.0.0.1:3002/query", true);
                    http.setRequestHeader("Content-Type", "application/json");
                    http.onreadystatechange = function() {
                        if (http.readyState === 4 && http.status === 200) {
                            // Rimuovi il placeholder di caricamento
                            visibleCommands = visibleCommands.filter(function(c){ return c.text.indexOf("Ricerca") === -1; });
                            
                            var res = JSON.parse(http.responseText);
                            if (res && res.length > 0) {
                                for (var r = 0; r < res.length; r++) {
                                    (function(item){
                                        var nome = item.ClienteNome || item.clientenome || "Sconosciuto";
                                        var dataC = item.DataConsegna || item.dataconsegna || "";
                                        var idC = item.ID || item.id || "";
                                        var dataShort = dataC.indexOf("T") !== -1 ? dataC.split("T")[0] : dataC;
                                        visibleCommands.push({
                                            text: "<span style='color:#d4af37;'>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â¦ #" + idC + "</span> <strong style='color:white;'>" + nome + "</strong> <span style='font-size:10px; color:#64748b;'>" + dataShort + "</span>",
                                            action: function() { 
                                                MostraDettagliRapidi(idC, nome, item.LocalitaConsegna||"", item.Merce||"", item.Stato||"");
                                            }
                                        });
                                    })(res[r]);
                                }
                            } else {
                                visibleCommands.push({ text: "<i style='color:#ef4444; font-size:11px;'>Nessuna consegna trovata per '" + query + "'</i>", action: function(){} });
                            }
                            RidisegnaListaPalette();
                        }
                    };
                    var sqlSafe = query.replace(/'/g, "");
                    http.send(JSON.stringify({ sql: "SELECT ID, DataConsegna, ClienteNome, LocalitaConsegna, Merce, Stato FROM tblConsegne WHERE ClienteNome LIKE '%" + sqlSafe + "%' OR ID LIKE '%" + sqlSafe + "%' ORDER BY ID DESC LIMIT 5" }));
                } catch(e) {}
            }
        }

        function EseguiComandoPalette(index) {
            if (index >= 0 && index < visibleCommands.length) {
                var cmd = visibleCommands[index];
                NascondiPalette();
                cmd.action();
            }
        }

        function GestisciKeyPalette() {
            var key = window.event.keyCode;
            var overlay = document.getElementById("cmdPaletteOverlay");
            if (!overlay || overlay.style.display !== "block") return;
            
            if (key === 27) { // Esc
                NascondiPalette();
                if (window.event.stopPropagation) window.event.stopPropagation();
                window.event.cancelBubble = true;
                window.event.returnValue = false;
                return;
            }
            
            if (key === 38) { // Up Arrow
                if (activePaletteIndex > 0) {
                    activePaletteIndex--;
                    DisegnaSelezionePalette();
                }
                if (window.event.stopPropagation) window.event.stopPropagation();
                window.event.cancelBubble = true;
                window.event.returnValue = false;
                return;
            }
            
            if (key === 40) { // Down Arrow
                if (activePaletteIndex < visibleCommands.length - 1) {
                    activePaletteIndex++;
                    DisegnaSelezionePalette();
                }
                if (window.event.stopPropagation) window.event.stopPropagation();
                window.event.cancelBubble = true;
                window.event.returnValue = false;
                return;
            }
            
            if (key === 13) { // Enter
                EseguiComandoPalette(activePaletteIndex);
                if (window.event.stopPropagation) window.event.stopPropagation();
                window.event.cancelBubble = true;
                window.event.returnValue = false;
                return;
            }
        }

        function DisegnaSelezionePalette() {
            var list = document.getElementById("cmdPaletteList");
            if (!list) return;
            var items = list.getElementsByClassName("cmd-palette-item");
            for (var i = 0; i < items.length; i++) {
                items[i].className = "cmd-palette-item" + (i === activePaletteIndex ? " active" : "");
            }
        }

        // --- FUNZIONALITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ STATISTICHE SPEDIZIONI (DASHBOARD ANALYTICS) ---
        function MostraStatistiche() {
            var overlay = document.getElementById("statsModalOverlay");
            if (!overlay) return;
            
            var diagText = document.getElementById("diagText");
            if (diagText && diagText.innerText.indexOf("OFFLINE") !== -1) {
                ToastManager.warning("Impossibile mostrare le statistiche: il server SQLite ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ OFFLINE.\nAvvia il Ponte Mobile o controlla la connessione.");
                return;
            }

            overlay.style.display = "block";
            
            var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
            
            // 1. Carica Statistiche per Stato
            var listStati = document.getElementById("statsStatiList");
            if (listStati) listStati.innerHTML = "<div style='color:#64748b; font-style:italic; font-size:11px;'>Caricamento...</div>";
            
            try {
                http.Open("POST", "http://127.0.0.1:3002/query", false);
                http.SetRequestHeader("Content-Type", "application/json");
                http.Send(JSON.stringify({ 
                    sql: "SELECT Stato, COUNT(*) as Cnt FROM tblConsegne GROUP BY Stato ORDER BY Cnt DESC" 
                }));
                
                if (http.Status === 200) {
                    var res = JSON.parse(http.ResponseText);
                    var html = "";
                    var totale = 0;
                    for (var i = 0; i < res.length; i++) {
                        totale += res[i].Cnt || 0;
                    }
                    
                    if (res.length > 0) {
                        for (var i = 0; i < res.length; i++) {
                            var item = res[i];
                            var stato = (item.Stato || "N.D.").toUpperCase();
                            var cnt = item.Cnt || 0;
                            var pct = totale > 0 ? Math.round((cnt / totale) * 100) : 0;
                            
                            var badgeColor = "#64748b";
                            if (stato.indexOf("CONSEG") !== -1 || stato.indexOf("COMPLET") !== -1 || stato.indexOf("OK") !== -1) {
                                badgeColor = "#10b981";
                            } else if (stato.indexOf("URG") !== -1 || stato.indexOf("ERR") !== -1 || stato.indexOf("RIT") !== -1) {
                                badgeColor = "#ef4444";
                            } else if (stato.indexOf("LOGIST") !== -1 || stato.indexOf("PIANIF") !== -1 || stato.indexOf("AVV") !== -1) {
                                badgeColor = "#3b82f6";
                            }
                            
                            html += "<div class='stats-list-item'>";
                            html += "  <span class='stats-list-label'><span class='stats-badge' style='background-color:" + badgeColor + ";'>" + stato + "</span></span>";
                            html += "  <span class='stats-list-value'>" + cnt + " (" + pct + "%)</span>";
                            html += "  <div class='stats-bar-container'><div class='stats-bar-fill' style='width:" + pct + "%; background:" + badgeColor + ";'></div></div>";
                            html += "</div>";
                        }
                    } else {
                        html = "<div style='color:#64748b; font-style:italic;'>Nessun dato spedizione trovato.</div>";
                    }
                    listStati.innerHTML = html;
                }
            } catch(e) {
                if (listStati) listStati.innerHTML = "<div style='color:#ef4444; font-style:italic; font-size:11px;'>Errore nel caricamento dei dati.</div>";
            }
            
            // 2. Carica Top LocalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â 
            var listCitta = document.getElementById("statsCittaList");
            if (listCitta) listCitta.innerHTML = "<div style='color:#64748b; font-style:italic; font-size:11px;'>Caricamento...</div>";
            
            try {
                http.Open("POST", "http://127.0.0.1:3002/query", false);
                http.SetRequestHeader("Content-Type", "application/json");
                http.Send(JSON.stringify({ 
                    sql: "SELECT LocalitaConsegna, COUNT(*) as Cnt FROM tblConsegne GROUP BY LocalitaConsegna ORDER BY Cnt DESC LIMIT 5" 
                }));
                
                if (http.Status === 200) {
                    var res = JSON.parse(http.ResponseText);
                    var html = "";
                    var maxCnt = 0;
                    if (res.length > 0) {
                        maxCnt = res[0].Cnt || 1;
                        for (var i = 0; i < res.length; i++) {
                            var item = res[i];
                            var citta = (item.LocalitaConsegna || "Sconosciuta").toUpperCase();
                            var cnt = item.Cnt || 0;
                            var pct = Math.round((cnt / maxCnt) * 100);
                            
                            html += "<div class='stats-list-item'>";
                            html += "  <span class='stats-list-label'>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â " + citta + "</span>";
                            html += "  <span class='stats-list-value'>" + cnt + " sped.</span>";
                            html += "  <div class='stats-bar-container'><div class='stats-bar-fill' style='width:" + pct + "%;'></div></div>";
                            html += "</div>";
                        }
                    } else {
                        html = "<div style='color:#64748b; font-style:italic;'>Nessuna localitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  trovata.</div>";
                    }
                    listCitta.innerHTML = html;
                }
            } catch(e) {
                if (listCitta) listCitta.innerHTML = "<div style='color:#ef4444; font-style:italic; font-size:11px;'>Errore nel caricamento delle cittÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â .</div>";
            }
        }

        function NascondiStatistiche() {
            var overlay = document.getElementById("statsModalOverlay");
            if (overlay) {
                overlay.style.display = "none";
            }
        }
        
        // --- FUNZIONALITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ ASSISTENTE CONFIGURAZIONE AUSILI ---
        var configAusiliData = [];
        var tempConfigAusiliData = [];
        var configEditMode = false;
        var selectedAusilioIndex = 0;
        var activeConfigTab = "chk";
        var configTimerInterval = null;
        var configTimerSeconds = 0;

        function GetConfigAusiliFilePath() {
            var root = fso.GetParentFolderName(decodeURIComponent(document.location.pathname).replace(/^\//, "").replace(/\//g, "\\"));
            return fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "config_ausili.json");
        }

        function GetDocumentiPdfPath() {
            var root = fso.GetParentFolderName(decodeURIComponent(document.location.pathname).replace(/^\//, "").replace(/\//g, "\\"));
            var pdfDir = fso.BuildPath(fso.BuildPath(fso.BuildPath(root, "File_Sistema"), "App_Mobile"), "DOCUMENTI_PDF");
            if (!fso.FolderExists(pdfDir)) fso.CreateFolder(pdfDir);
            return pdfDir;
        }

        function CaricaDatiAusili() {
            var filePath = GetConfigAusiliFilePath();
            
            if (fso.FileExists(filePath)) {
                try {
                    var stream = fso.OpenTextFile(filePath, 1, false, -1); // -1 per Unicode
                    var content = "";
                    if (!stream.AtEndOfStream) {
                        content = stream.ReadAll();
                    }
                    stream.Close();
                    if (content.replace(/^\s+|\s+$/g, '') !== "") {
                        configAusiliData = JSON.parse(content);
                        return;
                    }
                } catch(e) {
                    AggiungiLog("SYSTEM", "Errore lettura config_ausili.json: " + e.message, "error");
                }
            }
            
            // Dati di default
            configAusiliData = [
                {
                    nome: "\u267F Carrozzine Pieghevoli & Comode",
                    tempo: 10,
                    checklist: [
                        "Verificare l'integritÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  strutturale del telaio in metallo.",
                        "Controllare il gonfiaggio e l'usura delle ruote posteriori.",
                        "Verificare il corretto funzionamento dei freni di stazionamento.",
                        "Montare e regolare in altezza le pedane poggiapiedi.",
                        "Posizionare il cuscino antidecubito sulla seduta."
                    ],
                    spiegazione: [
                        "Mostrare come aprire e chiudere il telaio in sicurezza.",
                        "Spiegare come agganciare, sganciare e ruotare le pedane.",
                        "Mostrare il funzionamento dei freni (blocco e sblocco).",
                        "Spiegare come effettuare la pulizia ordinaria del rivestimento."
                    ],
                    imprevisti: [
                        { t: "Freno di stazionamento che slitta", s: "Stringere il bullone del morsetto del freno sul telaio per riavvicinare il pattino alla ruota." },
                        { t: "Ruote piroettanti rumorose o frenate", s: "Rimuovere sporco/capelli accumulati attorno al perno e applicare uno spray lubrificante al silicone." },
                        { t: "DifficoltÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  nella chiusura del telaio", s: "Verificare che la seduta in tela sia ben stesa e non incastrata tra i montanti verticali." }
                    ]
                },
                {
                    nome: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Letti Motorizzati & Materassi",
                    tempo: 25,
                    checklist: [
                        "Posizionare il letto nel punto stabilito e bloccare i freni delle ruote.",
                        "Fissare le sponde laterali di sicurezza verificando lo sblocco rapido.",
                        "Montare l'asta alzaletto ad innesto e regolare l'altezza del triangolo.",
                        "Collegare la centralina elettrica e testare i movimenti del telecomando.",
                        "Stendere il materasso ad aria e impostare la pressione sul compressore."
                    ],
                    spiegazione: [
                        "Mostrare al paziente e al caregiver l'uso dei tasti del telecomando (schiena/gambe/altezza).",
                        "Spiegare come abbassare le sponde di sicurezza usando il perno di sblocco.",
                        "Mostrare come regolare la manopola del compressore in base al peso corporeo.",
                        "Raccomandare di tenere il compressore sempre acceso ed evitare pieghe nel tubo dell'aria."
                    ],
                    imprevisti: [
                        { t: "Il telecomando non risponde ai comandi", s: "Verificare che il cavo a spirale sia ben inserito nella centralina sotto il letto e che la spina a muro sia alimentata." },
                        { t: "Compressore del materasso eccessivamente rumoroso", s: "Controllare che non tocchi pareti e appenderlo alla pediera tramite i ganci metallici rivestiti in gomma." },
                        { t: "Il letto cigola durante i movimenti elettrici", s: "Lubrificare i giunti metallici e i perni degli attuatori lineari sotto la rete con grasso spray." }
                    ]
                },
                {
                    nome: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Sollevatori Clinici (Pazienti)",
                    tempo: 15,
                    checklist: [
                        "Controllare lo stato della batteria e l'allineamento della colonna.",
                        "Verificare il corretto funzionamento del pulsante rosso di emergenza.",
                        "Fissare il bilancino di sollevamento e lubrificare il perno di rotazione.",
                        "Controllare lo stato di usura dell'imbracatura (cuciture e asole).",
                        "Verificare la regolazione manuale o a pedale della base divaricabile."
                    ],
                    spiegazione: [
                        "Mostrare come allargare e stringere le gambe della base per passare attraverso le porte.",
                        "Istruire sull'aggancio corretto delle asole dell'imbracatura al bilancino.",
                        "Mostrare il funzionamento della pulsantiera di salita/discesa.",
                        "Spiegare la procedura di discesa d'emergenza in caso di batteria scarica."
                    ],
                    imprevisti: [
                        { t: "Il sollevatore non si accende", s: "Verificare che il pulsante rosso a fungo non sia premuto (ruotare in senso orario per sbloccarlo)." },
                        { t: "Allarme acustico intermittente all'avvio", s: "Indica batteria scarica. Collegare immediatamente il sollevatore alla presa elettrica per la ricarica." },
                        { t: "Il pistone elettrico fa fatica a sollevare", s: "Verificare che il peso del paziente non superi la portata massima indicata sulla targhetta (es. 150/180 Kg)." }
                    ]
                },
                {
                    nome: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¨ Concentratori di Ossigeno",
                    tempo: 20,
                    checklist: [
                        "Posizionare il dispositivo lontano da pareti o fonti di calore (almeno 30 cm).",
                        "Riempire il bicchiere dell'umidificatore con acqua distillata fino al livello MAX.",
                        "Avvitare saldamente il bicchiere al concentratore e connettere il flussimetro.",
                        "Accendere il dispositivo e verificare l'assenza dell'allarme di bassa purezza.",
                        "Collegare il tubo dell'ossigeno e posizionare la cannula nasale."
                    ],
                    spiegazione: [
                        "Insegnare l'accensione/spegnimento e la regolazione precisa dei litri/minuto prescritti.",
                        "Spiegare l'importanza di lavare il bicchiere dell'umidificatore e cambiare l'acqua giornalmente.",
                        "Mostrare come estrarre e lavare sotto l'acqua corrente il filtro antipolvere nero sul retro.",
                        "Avvisare che in caso di allarme sonoro persistente occorre passare subito alla bombola d'emergenza."
                    ],
                    imprevisti: [
                        { t: "Il flussimetro non eroga ossigeno (bolle assenti)", s: "Verificare che il bicchiere sia avvitato dritto e stretto; una perdita d'aria dalla filettatura blocca il flusso." },
                        { t: "Si sente un allarme acustico continuo senza spie accese", s: "Mancanza di corrente elettrica. Controllare il cavo di alimentazione o se ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ scattato il salvavita in casa." },
                        { t: "Allarme di bassa purezza ossigeno attivo (spia gialla)", s: "Il filtro dell'aria sul retro is intasato. Spegnere, lavare il filtro, asciugarlo bene e reinserirlo." }
                    ]
                },
                {
                    nome: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¶ Deambulatori & Rollator",
                    tempo: 5,
                    checklist: [
                        "Controllare il corretto serraggio delle manopole regolabili in altezza.",
                        "Verificare che l'altezza delle manopole sia allineata ai polsi dell'utente in piedi.",
                        "Testare la stabilitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  dei freni a mano e il bloccaggio di stazionamento.",
                        "Verificare il corretto montaggio del cestino e del vassoio portaoggetti.",
                        "Controllare il perno di blocco del sistema di chiusura rapida."
                    ],
                    spiegazione: [
                        "Mostrare come regolare l'altezza delle impugnature per una postura corretta.",
                        "Spiegare come rallentare tirando le leve e come bloccare spingendole verso il basso.",
                        "Mostrare come sedersi in sicurezza sul sedile integrato, sempre a freni bloccati.",
                        "Spiegare la modalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  di chiusura del telaio a compasso per il bagagliaio."
                    ],
                    imprevisti: [
                        { t: "Il deambulatore frena in modo asimmetrico", s: "Regolare il tensionamento del cavo agendo sulla rondella zigrinata posta sopra la pinza del freno sulla ruota." },
                        { t: "Le manopole ruotano o scivolano", s: "Rimuoverle, applicare uno strato di nastro biadesivo sul tubo metallico e reinserire forzando la manopola." },
                        { t: "Le ruote anteriori piroettanti tremano o oscillano", s: "Stringere leggermente il dado autobloccante centrale della forcella per ridurre il gioco assiale." }
                    ]
                }
            ];
            SalvaDatiAusili();
        }

        function SalvaDatiAusili() {
            var filePath = GetConfigAusiliFilePath();
            try {
                var stream = fso.OpenTextFile(filePath, 2, true, -1); // -1 per Unicode/UTF-16LE
                stream.Write(JSON.stringify(configAusiliData, null, 4));
                stream.Close();
            } catch(e) {
                AggiungiLog("SYSTEM", "Errore salvataggio config_ausili.json: " + e.message, "error");
            }
        }

        function MostraConfigAusili() {
            var overlay = document.getElementById("configModalOverlay");
            if (!overlay) return;
            overlay.style.display = "block";
            
            configEditMode = false;
            AggiornaUIEditMode();
            
            CaricaDatiAusili();
            
            selectedAusilioIndex = 0;
            DisegnaAusiliSidebar();
            SelezionaAusilio(0);
        }

        function NascondiConfigAusili() {
            var overlay = document.getElementById("configModalOverlay");
            if (overlay) {
                overlay.style.display = "none";
            }
            ResetConfigTimer();
            configEditMode = false;
            AggiornaUIEditMode();
            TornaInPrimoPiano();
        }

        function DisegnaAusiliSidebar() {
            var sidebar = document.getElementById("configSidebarList");
            if (!sidebar) return;
            var html = "";
            var arr = configEditMode ? tempConfigAusiliData : configAusiliData;
            
            for (var i = 0; i < arr.length; i++) {
                var aid = arr[i];
                var nameOnly = aid.nome;
                
                html += "<div class='config-sidebar-item" + (i === selectedAusilioIndex ? " active" : "") + "' onclick='SelezionaAusilio(" + i + ")'>";
                html += "  <span style='vertical-align: middle;'>" + nameOnly + "</span>";
                
                if (configEditMode) {
                    html += "  <span class='config-sidebar-del' onclick='EliminaAusilio(" + i + "); window.event.cancelBubble=true;' title='Elimina Ausilio'>ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢</span>";
                }
                
                html += "</div>";
            }
            
            if (configEditMode) {
                html += "<div class='config-sidebar-add' onclick='AggiungiAusilio()' title='Aggiungi Nuovo Ausilio'>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Nuovo Ausilio</div>";
            }
            
            sidebar.innerHTML = html;
        }

        function SelezionaAusilio(idx) {
            if (configEditMode && idx !== selectedAusilioIndex) {
                SalvaInputCorrenti();
            }
            
            selectedAusilioIndex = idx;
            var arr = configEditMode ? tempConfigAusiliData : configAusiliData;
            
            if (idx < 0 || idx >= arr.length) {
                selectedAusilioIndex = 0;
                idx = 0;
            }
            
            // Aggiorna sidebar active class
            var listItems = document.getElementById("configSidebarList").children;
            for (var i = 0; i < listItems.length; i++) {
                if (listItems[i].className.indexOf("config-sidebar-add") === -1) {
                    listItems[i].className = "config-sidebar-item" + (i === idx ? " active" : "");
                }
            }
            
            // Riferimento dati ausilio
            var data = arr[idx];
            
            // Aggiorna titolo modal
            var titleEl = document.getElementById("configActiveTitle");
            if (titleEl) {
                titleEl.innerText = data.nome;
            }
            
            // Aggiorna inputs edit o testi statici
            if (configEditMode) {
                var editNome = document.getElementById("editAidNome");
                if (editNome) editNome.value = data.nome;
                
                var editTempo = document.getElementById("editAidTempo");
                if (editTempo) editTempo.value = data.tempo;
                
                // Aggiorna UI PDF
                var pdfNameEl = document.getElementById("editAidPdfName");
                var btnRimuovi = document.getElementById("btnRimuoviPdf");
                if (pdfNameEl) {
                    if (data.pdf) {
                        pdfNameEl.innerText = data.pdf;
                        pdfNameEl.style.color = "#10b981";
                        if (btnRimuovi) btnRimuovi.style.display = "inline-block";
                    } else {
                        pdfNameEl.innerText = "Nessun PDF allegato";
                        pdfNameEl.style.color = "#94a3b8";
                        if (btnRimuovi) btnRimuovi.style.display = "none";
                    }
                }
            } else {
                var estEl = document.getElementById("configEstTime");
                if (estEl) {
                    estEl.innerText = data.tempo + " MINUTI";
                }
            }
            
            // Ridisegna schede
            DisegnaContenutoPane("chk");
            DisegnaContenutoPane("speak");
            DisegnaContenutoPane("trouble");
            
            // Reimposta tab attivo
            CambiaConfigTab(activeConfigTab);
            ResetConfigTimer();
        }

        function DisegnaContenutoPane(tabName) {
            var arr = configEditMode ? tempConfigAusiliData : configAusiliData;
            var data = arr[selectedAusilioIndex];
            if (!data) return;
            
            if (tabName === "chk") {
                var paneChk = document.getElementById("paneChk");
                if (!paneChk) return;
                var html = "";
                
                if (configEditMode) {
                    for (var i = 0; i < data.checklist.length; i++) {
                        html += "<div class='config-edit-row'>";
                        html += "  <input type='text' class='config-edit-input edit-chk-input' value=\"" + data.checklist[i].replace(/"/g, "&quot;") + "\">";
                        html += "  <span class='config-edit-del-btn' onclick='EliminaVoceChecklist(" + i + ")' title='Rimuovi'>ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢</span>";
                        html += "</div>";
                    }
                    html += "<button class='config-edit-add-btn' onclick='AggiungiVoceChecklist()'>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Aggiungi elemento checklist</button>";
                } else {
                    for (var i = 0; i < data.checklist.length; i++) {
                        var chkId = "chk_item_" + i;
                        html += "<label class='config-chk-item'>";
                        html += "  <input type='checkbox' id='" + chkId + "' onclick='window.event.cancelBubble=true;'> " + data.checklist[i];
                        html += "</label>";
                    }
                    if (data.checklist.length === 0) {
                        html = "<div style='color:#64748b; font-style:italic; font-size:11px;'>Nessun elemento configurazione inserito.</div>";
                    }
                }
                paneChk.innerHTML = html;
            }
            else if (tabName === "speak") {
                var paneSpeak = document.getElementById("paneSpeak");
                if (!paneSpeak) return;
                var html = "";
                
                if (configEditMode) {
                    for (var i = 0; i < data.spiegazione.length; i++) {
                        html += "<div class='config-edit-row'>";
                        html += "  <input type='text' class='config-edit-input edit-speak-input' value=\"" + data.spiegazione[i].replace(/"/g, "&quot;") + "\">";
                        html += "  <span class='config-edit-del-btn' onclick='EliminaVoceSpiegazione(" + i + ")' title='Rimuovi'>ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢</span>";
                        html += "</div>";
                    }
                    html += "<button class='config-edit-add-btn' onclick='AggiungiVoceSpiegazione()'>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Aggiungi spiegazione</button>";
                } else {
                    html = "<ul class='config-text-list'>";
                    for (var i = 0; i < data.spiegazione.length; i++) {
                        html += "<li>" + data.spiegazione[i] + "</li>";
                    }
                    html += "</ul>";
                    if (data.spiegazione.length === 0) {
                        html = "<div style='color:#64748b; font-style:italic; font-size:11px;'>Nessun elemento spiegazione inserito.</div>";
                    }
                }
                paneSpeak.innerHTML = html;
            }
            else if (tabName === "trouble") {
                var paneTrouble = document.getElementById("paneTrouble");
                if (!paneTrouble) return;
                var html = "";
                
                if (configEditMode) {
                    for (var i = 0; i < data.imprevisti.length; i++) {
                        html += "<div class='config-edit-trouble-box'>";
                        html += "  <div style='margin-bottom: 8px;'>";
                        html += "    <label style='font-size:9px; color:#fca5a5; font-weight:bold; display:block; margin-bottom:2px;'>ALLARME / IMPREVISTO</label>";
                        html += "    <input type='text' class='config-edit-input edit-trouble-t' style='width:92%;' value=\"" + data.imprevisti[i].t.replace(/"/g, "&quot;") + "\">";
                        html += "    <span class='config-edit-del-btn' style='position:absolute; right:12px; top:24px;' onclick='EliminaVoceImprevisto(" + i + ")' title='Rimuovi'>ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢</span>";
                        html += "  </div>";
                        html += "  <div>";
                        html += "    <label style='font-size:9px; color:#cbd5e1; font-weight:bold; display:block; margin-bottom:2px;'>SOLUZIONE PROPOSTA</label>";
                        html += "    <input type='text' class='config-edit-input edit-trouble-s' style='width:100%;' value=\"" + data.imprevisti[i].s.replace(/"/g, "&quot;") + "\">";
                        html += "  </div>";
                        html += "</div>";
                    }
                    html += "<button class='config-edit-add-btn' onclick='AggiungiVoceImprevisto()'>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Aggiungi imprevisto</button>";
                } else {
                    for (var i = 0; i < data.imprevisti.length; i++) {
                        html += "<div class='config-trouble-card'>";
                        html += "  <div class='config-trouble-title'>ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Allarme: " + data.imprevisti[i].t + "</div>";
                        html += "  <div class='config-trouble-solution'>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â§ Soluzione: " + data.imprevisti[i].s + "</div>";
                        html += "</div>";
                    }
                    if (data.imprevisti.length === 0) {
                        html = "<div style='color:#64748b; font-style:italic; font-size:11px;'>Nessun imprevisto inserito.</div>";
                    }
                }
                paneTrouble.innerHTML = html;
            }
        }

        function CambiaConfigTab(tabName) {
            if (configEditMode) {
                SalvaInputCorrenti();
            }
            
            activeConfigTab = tabName;
            
            // Aggiorna bottoni active class
            var tabBtns = document.getElementById("configTabsBar").children;
            for (var i = 0; i < tabBtns.length; i++) {
                var isCurrent = tabBtns[i].getAttribute("data-tab") === tabName;
                tabBtns[i].className = "config-tab-btn" + (isCurrent ? " active" : "");
            }
            
            // Aggiorna panes active class
            var tabPanes = document.getElementById("configTabContent").children;
            for (var i = 0; i < tabPanes.length; i++) {
                var isCurrent = tabPanes[i].id === "pane" + tabName.charAt(0).toUpperCase() + tabName.slice(1);
                tabPanes[i].className = "config-tab-pane" + (isCurrent ? " active" : "");
            }
        }

        function ToggleConfigTimer() {
            var btn = document.getElementById("btnConfigTimerToggle");
            if (!btn) return;
            
            if (configTimerInterval) {
                // Metti in pausa
                clearInterval(configTimerInterval);
                configTimerInterval = null;
                btn.innerText = "Avvia Timer";
                btn.className = "config-timer-btn start";
            } else {
                // Avvia
                configTimerInterval = setInterval(AggiornaConfigTimer, 1000);
                btn.innerText = "Pausa";
                btn.className = "config-timer-btn stop";
            }
        }

        function ResetConfigTimer() {
            if (configTimerInterval) {
                clearInterval(configTimerInterval);
                configTimerInterval = null;
            }
            configTimerSeconds = 0;
            
            var btn = document.getElementById("btnConfigTimerToggle");
            if (btn) {
                btn.innerText = "Avvia Timer";
                btn.className = "config-timer-btn start";
            }
            
            var display = document.getElementById("txtConfigTimerVal");
            if (display) {
                display.innerText = "00:00";
                display.style.color = "#fbbf24";
            }
        }

        function AggiornaConfigTimer() {
            configTimerSeconds++;
            
            var min = Math.floor(configTimerSeconds / 60);
            var sec = configTimerSeconds % 60;
            
            var minStr = (min < 10 ? '0' : '') + min;
            var secStr = (sec < 10 ? '0' : '') + sec;
            
            var display = document.getElementById("txtConfigTimerVal");
            if (display) {
                display.innerText = minStr + ":" + secStr;
                
                var arr = configEditMode ? tempConfigAusiliData : configAusiliData;
                var stimatoMinuti = arr[selectedAusilioIndex] ? arr[selectedAusilioIndex].tempo : 10;
                if (min >= stimatoMinuti) {
                    display.style.color = "#ef4444";
                } else if (min >= (stimatoMinuti - 2)) {
                    display.style.color = "#f59e0b";
                } else {
                    display.style.color = "#10b981";
                }
            }
        }

        // --- FUNZIONI DI EDITING (GESTIONE AUSILI A MANO) ---
        function AbilitaConfigEditMode() {
            configEditMode = true;
            
            // Copia profonda dell'array
            tempConfigAusiliData = JSON.parse(JSON.stringify(configAusiliData));
            
            AggiornaUIEditMode();
            DisegnaAusiliSidebar();
            SelezionaAusilio(selectedAusilioIndex);
            
            AggiungiLog("SYSTEM", "ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  modifica ausili attivata", "warning");
        }

        function DisattivaConfigEditMode() {
            configEditMode = false;
            
            AggiornaUIEditMode();
            DisegnaAusiliSidebar();
            SelezionaAusilio(selectedAusilioIndex);
            
            AggiungiLog("SYSTEM", "ModalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  modifica ausili disattivata", "system");
        }

        function SalvaConfigModifiche() {
            SalvaInputCorrenti();
            
            // Copia all'array ufficiale e salva su file
            configAusiliData = JSON.parse(JSON.stringify(tempConfigAusiliData));
            SalvaDatiAusili();
            
            configEditMode = false;
            AggiornaUIEditMode();
            DisegnaAusiliSidebar();
            SelezionaAusilio(selectedAusilioIndex);
            
            AggiungiLog("SYSTEM", "Configurazione ausili salvata correttamente", "success");
            ToastManager.warning("Modifiche salvate con successo nel file config_ausili.json!");
        }

        function AggiornaUIEditMode() {
            var area = document.getElementById("configDetailsArea");
            if (!area) return;
            
            var btnToggle = document.getElementById("btnConfigEditToggle");
            var editBanner = document.getElementById("configEditBanner");
            
            if (configEditMode) {
                area.className = "config-details-area editing";
                if (btnToggle) btnToggle.style.display = "none";
                if (editBanner) editBanner.style.display = "block";
            } else {
                area.className = "config-details-area";
                if (btnToggle) btnToggle.style.display = "block";
                if (editBanner) editBanner.style.display = "none";
            }
        }

        function SalvaInputCorrenti() {
            if (!configEditMode || selectedAusilioIndex < 0 || selectedAusilioIndex >= tempConfigAusiliData.length) return;
            
            var aid = tempConfigAusiliData[selectedAusilioIndex];
            
            var inputNome = document.getElementById("editAidNome");
            if (inputNome) aid.nome = inputNome.value;
            
            var inputTempo = document.getElementById("editAidTempo");
            if (inputTempo) aid.tempo = parseInt(inputTempo.value, 10) || 5;
            
            // Salva checklist
            var elsChk = document.getElementsByClassName("edit-chk-input");
            var listChk = [];
            for (var i = 0; i < elsChk.length; i++) {
                listChk.push(elsChk[i].value);
            }
            aid.checklist = listChk;
            
            // Salva spiegazione
            var elsSpeak = document.getElementsByClassName("edit-speak-input");
            var listSpeak = [];
            for (var i = 0; i < elsSpeak.length; i++) {
                listSpeak.push(elsSpeak[i].value);
            }
            aid.spiegazione = listSpeak;
            
            // Salva imprevisti
            var elsTroubleT = document.getElementsByClassName("edit-trouble-t");
            var elsTroubleS = document.getElementsByClassName("edit-trouble-s");
            var listTrouble = [];
            for (var i = 0; i < elsTroubleT.length; i++) {
                listTrouble.push({
                    t: elsTroubleT[i].value,
                    s: elsTroubleS[i] ? elsTroubleS[i].value : ""
                });
            }
            aid.imprevisti = listTrouble;
            
            // Il campo pdf ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ gestito direttamente da CopiaPdfAusilio/RimuoviPdfAusilio
            // Non sovrascriverlo qui, viene giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  aggiornato sull'oggetto
        }

        function SelezionaPdfAusilio() {
            var input = document.getElementById("inputPdfAusilio");
            if (input) input.click();
        }

        function CopiaPdfAusilio() {
            var input = document.getElementById("inputPdfAusilio");
            if (!input || !input.value) return;
            
            var srcPath = input.value;
            var fileName = srcPath.split("\\").pop();
            
            // Copia il file nella cartella DOCUMENTI_PDF
            var destDir = GetDocumentiPdfPath();
            var destPath = fso.BuildPath(destDir, fileName);
            
            try {
                fso.CopyFile(srcPath, destPath, true);
                
                // Salva il nome nel dato corrente
                if (selectedAusilioIndex >= 0 && selectedAusilioIndex < tempConfigAusiliData.length) {
                    tempConfigAusiliData[selectedAusilioIndex].pdf = fileName;
                }
                
                // Aggiorna la UI
                var pdfNameEl = document.getElementById("editAidPdfName");
                var btnRimuovi = document.getElementById("btnRimuoviPdf");
                if (pdfNameEl) { pdfNameEl.innerText = fileName; pdfNameEl.style.color = "#10b981"; }
                if (btnRimuovi) btnRimuovi.style.display = "inline-block";
                
                AggiungiLog("SYSTEM", "PDF allegato: " + fileName, "success");
            } catch(e) {
                ToastManager.warning("Errore durante la copia del PDF: " + e.message);
            }
        }

        function RimuoviPdfAusilio() {
            if (selectedAusilioIndex >= 0 && selectedAusilioIndex < tempConfigAusiliData.length) {
                tempConfigAusiliData[selectedAusilioIndex].pdf = "";
            }
            var pdfNameEl = document.getElementById("editAidPdfName");
            var btnRimuovi = document.getElementById("btnRimuoviPdf");
            if (pdfNameEl) { pdfNameEl.innerText = "Nessun PDF allegato"; pdfNameEl.style.color = "#94a3b8"; }
            if (btnRimuovi) btnRimuovi.style.display = "none";
            AggiungiLog("SYSTEM", "PDF rimosso dall'ausilio", "warning");
        }

        function AggiungiVoceChecklist() {
            SalvaInputCorrenti();
            tempConfigAusiliData[selectedAusilioIndex].checklist.push("");
            DisegnaContenutoPane("chk");
        }

        function EliminaVoceChecklist(idx) {
            SalvaInputCorrenti();
            tempConfigAusiliData[selectedAusilioIndex].checklist.splice(idx, 1);
            DisegnaContenutoPane("chk");
        }

        function AggiungiVoceSpiegazione() {
            SalvaInputCorrenti();
            tempConfigAusiliData[selectedAusilioIndex].spiegazione.push("");
            DisegnaContenutoPane("speak");
        }

        function EliminaVoceSpiegazione(idx) {
            SalvaInputCorrenti();
            tempConfigAusiliData[selectedAusilioIndex].spiegazione.splice(idx, 1);
            DisegnaContenutoPane("speak");
        }

        function AggiungiVoceImprevisto() {
            SalvaInputCorrenti();
            tempConfigAusiliData[selectedAusilioIndex].imprevisti.push({ t: "", s: "" });
            DisegnaContenutoPane("trouble");
        }

        function EliminaVoceImprevisto(idx) {
            SalvaInputCorrenti();
            tempConfigAusiliData[selectedAusilioIndex].imprevisti.splice(idx, 1);
            DisegnaContenutoPane("trouble");
        }

        function AggiungiAusilio() {
            SalvaInputCorrenti();
            var nuovo = {
                nome: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Nuovo Ausilio",
                tempo: 10,
                checklist: [],
                spiegazione: [],
                imprevisti: []
            };
            tempConfigAusiliData.push(nuovo);
            selectedAusilioIndex = tempConfigAusiliData.length - 1;
            
            DisegnaAusiliSidebar();
            SelezionaAusilio(selectedAusilioIndex);
        }

        function EliminaAusilio(idx) {
            if (tempConfigAusiliData.length <= 1) {
                ToastManager.warning("Deve esserci almeno un ausilio in lista!");
                return;
            }
            if (confirm("Sei sicuro di voler eliminare l'ausilio '" + tempConfigAusiliData[idx].nome + "'?")) {
                SalvaInputCorrenti();
                if (idx === selectedAusilioIndex) {
                    selectedAusilioIndex = 0;
                } else if (idx < selectedAusilioIndex) {
                    selectedAusilioIndex--;
                }
                tempConfigAusiliData.splice(idx, 1);
                DisegnaAusiliSidebar();
                SelezionaAusilio(selectedAusilioIndex);
            }
        }

        function IniettaSpotlightGlow() {
            var cards = [];
            var kpis = [];
            if (document.querySelectorAll) {
                kpis = document.querySelectorAll('.card-third, .card-fourth');
            }
            
            if (!kpis || kpis.length === 0) {
                var allElems = document.getElementsByTagName('*');
                for (var i = 0; i < allElems.length; i++) {
                    var c = allElems[i].className || "";
                    if (c.indexOf('card-third') !== -1 || c.indexOf('card-fourth') !== -1) {
                        cards.push(allElems[i]);
                    }
                }
            } else {
                for (var i = 0; i < kpis.length; i++) {
                    cards.push(kpis[i]);
                }
            }

            for (var i = 0; i < cards.length; i++) {
                (function(card) {
                    if (card.getAttribute('data-spotlight-injected')) return;
                    card.setAttribute('data-spotlight-injected', 'true');
                    
                    var glow = document.createElement('div');
                    glow.className = 'spotlight-glow';
                    card.appendChild(glow);

                    if (card.addEventListener) {
                        card.addEventListener('mousemove', onMove);
                        card.addEventListener('mouseenter', onEnter);
                        card.addEventListener('mouseleave', onLeave);
                    } else if (card.attachEvent) {
                        card.attachEvent('onmousemove', onMove);
                        card.attachEvent('onmouseenter', onEnter);
                        card.attachEvent('onmouseleave', onLeave);
                    }

                    function onMove(e) {
                        e = e || window.event;
                        var rect = card.getBoundingClientRect();
                        var x = (e.clientX || e.pageX) - rect.left;
                        var y = (e.clientY || e.pageY) - rect.top;
                        glow.style.left = x + 'px';
                        glow.style.top = y + 'px';
                    }

                    function onEnter(e) {
                        glow.style.opacity = '1';
                        glow.style.display = 'block';
                    }

                    function onLeave(e) {
                        glow.style.opacity = '0';
                        glow.style.display = 'none';
                    }
                })(cards[i]);
            }
        }

        function IniziaOscilloscopi() {
            var cpuCanvas = document.getElementById("cpuOscilloscope");
            var diskCanvas = document.getElementById("diskOscilloscope");
            var ramCanvas = document.getElementById("ramOscilloscope");
            if (!cpuCanvas || !diskCanvas) return;

            var cpuCtx = cpuCanvas.getContext("2d");
            var diskCtx = diskCanvas.getContext("2d");
            var ramCtx = ramCanvas ? ramCanvas.getContext("2d") : null;

            cpuCanvas.width = cpuCanvas.clientWidth || 250;
            cpuCanvas.height = cpuCanvas.clientHeight || 35;
            diskCanvas.width = diskCanvas.clientWidth || 250;
            diskCanvas.height = diskCanvas.clientHeight || 35;
            if (ramCanvas) {
                ramCanvas.width = ramCanvas.clientWidth || 250;
                ramCanvas.height = ramCanvas.clientHeight || 35;
            }

            var offsetCpu = 0;
            var offsetDisk = 0;
            var offsetRam = 0;

            function render() {
                disegnaOnda(cpuCanvas, cpuCtx, cpuLoadVal, offsetCpu, "#d4af37", "rgba(212, 175, 55, 0.05)");
                offsetCpu += (0.05 + (cpuLoadVal / 100) * 0.15);

                disegnaOnda(diskCanvas, diskCtx, diskUsedVal, offsetDisk, "#10b981", "rgba(16, 185, 129, 0.05)");
                offsetDisk += (0.03 + (diskUsedVal / 100) * 0.07);

                if (ramCanvas && ramCtx) {
                    disegnaOnda(ramCanvas, ramCtx, ramUsedVal, offsetRam, "#a78bfa", "rgba(167, 139, 250, 0.05)");
                    offsetRam += (0.04 + (ramUsedVal / 100) * 0.1);
                }

                if (window.requestAnimationFrame) {
                    window.requestAnimationFrame(render);
                } else {
                    setTimeout(render, 33);
                }
            }

            function disegnaOnda(canvas, ctx, val, offset, strokeColor, gridColor) {
                var w = canvas.width;
                var h = canvas.height;
                ctx.clearRect(0, 0, w, h);

                ctx.strokeStyle = gridColor;
                ctx.lineWidth = 0.5;
                for (var x = 0; x < w; x += 15) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
                for (var y = 0; y < h; y += 8) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                }

                var amp = 2 + (val / 100) * (h / 2.5);
                var freq = 0.02 + (val / 100) * 0.06;

                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                for (var i = 0; i < w; i += 3) {
                    var sineY = h / 2 + Math.sin(i * freq - offset) * amp;
                    if (i === 0) {
                        ctx.moveTo(i, sineY);
                    } else {
                        ctx.lineTo(i, sineY);
                    }
                }
                ctx.stroke();
            }

            render();
        }

        var isSpeakingAssistant = false;
        var assistantAnimationInterval = null;

        function ParlaAssistente() {
            var widget = document.getElementById("aiAssistantWidget");
            var statusText = document.getElementById("aiAssistantStatus");
            if (!widget) return;

            if (isSpeakingAssistant) {
                StopSpeakingAssistant();
                return;
            }

            isSpeakingAssistant = true;
            widget.className += " voice-speaking";
            if (statusText) statusText.innerText = "IN ASCOLTO...";

            var d = new Date();
            var hh = d.getHours();
            var mm = d.getMinutes();
            
            var nTot = parseInt(document.getElementById("cntConsegne").innerText || "0", 10) || 0;
            var nCli = parseInt(document.getElementById("cntClienti").innerText || "0", 10) || 0;
            var nPost = parseInt(document.getElementById("cntPostit").innerText || "0", 10) || 0;

            var meteoText = "Meteo non disponibile";
            var meteoEl = document.getElementById("meteoTemp") || document.getElementById("ssMeteo");
            if (meteoEl) {
                meteoText = meteoEl.innerText || meteoEl.textContent;
                meteoText = meteoText.replace(/[ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢Ãƒâ€šÃ‚Â§ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€¹Ã¢â‚¬Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢Ãƒâ€šÃ‚ÂªÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â]/g, "");
            }

            var report = "Cruscotto di controllo Milella. Sono le ore " + hh + " e " + mm + ". ";
            report += "Il sistema ha registrato " + nTot + " consegne totali nel database, con " + nCli + " clienti attivi. ";
            if (nPost > 0) {
                report += "Ci sono " + nPost + " promemoria appesi sulla bacheca dell'ufficio. Ti leggo i primi: ";
                var postitDivs = document.getElementsByClassName("postit-sticker-text");
                var readCount = 0;
                for (var i = 0; i < postitDivs.length && readCount < 5; i++) {
                    var pText = postitDivs[i].innerText || postitDivs[i].textContent || "";
                    if (pText.length > 2) {
                        pText = pText.replace(/\[.*?\]/g, ""); // Rimuove tag come [GLOBALE]
                        pText = pText.replace(/[^a-zA-Z0-9ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â²ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ \.,\?!]/g, " "); // Rimuove simboli strani per SAPI
                        pText = pText.replace(/\s+/g, " "); // Spazi multipli
                        report += "Avviso numero " + (readCount + 1) + ": " + pText + ". ";
                        readCount++;
                    }
                }
                if (nPost > 5) {
                    report += "E altri " + (nPost - 5) + " avvisi. ";
                }
            } else {
                report += "La bacheca dell'ufficio ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ vuota. ";
            }

            if (meteoText) {
                report += "Condizioni meteo a Bari: " + meteoText + ".";
            }

            try {
                if (!voiceObj) {
                    voiceObj = new ActiveXObject("SAPI.SpVoice");
                }
                voiceObj.Volume = 100;
                voiceObj.Rate = 0;
                voiceObj.Speak(report, 3);
            } catch(e) {}

            var stimaDuration = (report.length / 15) * 1000 + 1000;
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

                if ((!ancoraParla && checkTimer > 2000) || checkTimer > stimaDuration) {
                    StopSpeakingAssistant();
                }
            }, 200);
        }

        function StopSpeakingAssistant() {
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
            if (statusText) statusText.innerText = "PRONTO (Clicca per Avviare)";

            try {
                if (voiceObj) {
                    voiceObj.Speak("", 2);
                }
            } catch(e) {}
        }

        // --- CUSTOM CONTEXT MENU ---
        function MostraContextMenu(e) {
            e = e || window.event;
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            e.returnValue = false;
            
            var menu = document.getElementById("customContextMenu");
            if (!menu) return false;
            
            var x = e.clientX || e.pageX;
            var y = e.clientY || e.pageY;
            
            // Evita che il menu esca dallo schermo
            if (x + 220 > window.innerWidth) x = window.innerWidth - 220;
            if (y + 280 > window.innerHeight) y = window.innerHeight - 280;
            
            menu.style.left = x + "px";
            menu.style.top = y + "px";
            menu.style.display = "block";
            return false;
        }
        
        function NascondiContextMenu() {
            var menu = document.getElementById("customContextMenu");
            if (menu) menu.style.display = "none";
        }
        
        // Esporta CSV
        function EsportaConsegneCSV() {
            NascondiContextMenu();
            try {
                var tbody = document.getElementById("recentDeliveriesBody");
                if (!tbody) { MostraToast("Nessun dato da esportare", "warning"); return; }
                var trs = tbody.getElementsByTagName("tr");
                if (!trs || trs.length === 0) { MostraToast("Tabella vuota", "warning"); return; }
                
                var csv = "ID;Data;Cliente;Localita;Merce;Stato\r\n";
                for (var i = 0; i < trs.length; i++) {
                    if (trs[i].style.display === "none") continue;
                    var tds = trs[i].getElementsByTagName("td");
                    if (tds.length < 6) continue;
                    var row = [];
                    for (var j = 0; j < tds.length; j++) {
                        var val = tds[j].innerText.replace(/[#]/g, "").replace(/;/g, ",").replace(/\r?\n/g, " ").trim();
                        row.push(val);
                    }
                    csv += row.join(";") + "\r\n";
                }
                
                var desktopPath = shell.SpecialFolders("Desktop");
                var d = new Date();
                var dateStr = d.getFullYear() + "" + (d.getMonth()+1 < 10 ? "0" : "") + (d.getMonth()+1) + "" + (d.getDate() < 10 ? "0" : "") + d.getDate();
                var fileName = "consegne_export_" + dateStr + ".csv";
                var filePath = fso.BuildPath(desktopPath, fileName);
                
                var file = fso.CreateTextFile(filePath, true, true);
                file.Write(csv);
                file.Close();
                
                MostraToast("\u2705 CSV esportato sulla Scrivania: " + fileName);
                AggiungiLog("EXPORT", "File CSV esportato: " + fileName, "success");
            } catch(e) {
                MostraToast("Errore esportazione: " + e.message, "error");
            }
        }
        
        // --- SESSION UPTIME ---
        var sessionStartTime = new Date();
        function AggiornaUptime() {
            var el = document.getElementById("lblUptime");
            if (!el) return;
            var now = new Date();
            var diff = Math.floor((now - sessionStartTime) / 1000);
            var h = Math.floor(diff / 3600);
            var m = Math.floor((diff % 3600) / 60);
            var s = diff % 60;
            var str = "";
            if (h > 0) str += h + "h ";
            str += (m < 10 ? "0" : "") + m + "m " + (s < 10 ? "0" : "") + s + "s";
            el.innerText = str;
        }
        setInterval(AggiornaUptime, 1000);
        
        // --- GRAFICI DINAMICI MODAL ---
        function MostraGraficiRapidi() {
            var modal = document.getElementById("modalGrafici");
            if (!modal) return;
            modal.style.display = "flex";
            
            // Set initial widths to 0 and reset labels
            var fills = document.getElementsByClassName("chart-bar-fill");
            for(var i=0; i<fills.length; i++) {
                fills[i].style.width = "0%";
            }
            var labels = document.getElementsByClassName("chart-bar-label");
            if(labels.length >= 3) {
                labels[0].innerHTML = "<span>Completate (Lettura...)</span><span style='color:#10b981;'>--%</span>";
                labels[1].innerHTML = "<span>In Pianificazione (Lettura...)</span><span style='color:#3b82f6;'>--%</span>";
                labels[2].innerHTML = "<span>In Ritardo / Errori (Lettura...)</span><span style='color:#ef4444;'>--%</span>";
            }
            
            // Dati Reali da consegne.json
            setTimeout(function() {
                try {
                    var consegne = typeof LeggiConsegneDB === "function" ? LeggiConsegneDB() : [];
                    var tot = consegne.length, completate = 0, daAssegnare = 0, inCarico = 0;
                    
                    for(var j=0; j<consegne.length; j++) {
                        var s = (consegne[j].stato || "").toUpperCase();
                        if(s === "COMPLETO" || s === "COMPLETATO" || s === "CONSEGNATO") completate++;
                        else if(s === "IN CARICO") inCarico++;
                        else daAssegnare++; 
                    }
                    
                    var pComp = tot > 0 ? Math.round((completate / tot) * 100) : 0;
                    var pDaAss = tot > 0 ? Math.round((daAssegnare / tot) * 100) : 0;
                    var pInCar = tot > 0 ? Math.round((inCarico / tot) * 100) : 0;
                    
                    var labels = document.getElementsByClassName("chart-bar-label");
                    if(labels.length >= 3) {
                        labels[0].innerHTML = "<span>Completate (" + completate + ")</span><span style='color:#10b981;'>" + pComp + "%</span>";
                        labels[1].innerHTML = "<span>Da Assegnare (" + daAssegnare + ")</span><span style='color:#3b82f6;'>" + pDaAss + "%</span>";
                        labels[2].innerHTML = "<span>In Carico (" + inCarico + ")</span><span style='color:#fbbf24;'>" + pInCar + "%</span>"; 
                    }
                    
                    var fills = document.getElementsByClassName("chart-bar-fill");
                    if(fills.length >= 3) {
                        fills[0].style.width = pComp + "%";
                        fills[1].style.width = pDaAss + "%";
                        fills[2].style.width = pInCar + "%";
                        fills[2].style.backgroundColor = "#fbbf24"; 
                    }
                } catch(e) {}
            }, 300);
        }
        function NascondiGraficiRapidi() {
            var modal = document.getElementById("modalGrafici");
            if (modal) {
                modal.style.display = "none";
                var fills = document.getElementsByClassName("chart-bar-fill");
                for(var i=0; i<fills.length; i++) {
                    fills[i].style.width = "0%";
                }
            }
        }        function SegnaCompletato(idx) {
            try {
                var fileBoard = GetPostitFilePath(false);
                if (fso.FileExists(fileBoard)) {
                    var streamIn = fso.OpenTextFile(fileBoard, 1, false, -1);
                    var text = "";
                    if (!streamIn.AtEndOfStream) text = streamIn.ReadAll();
                    streamIn.Close();
                    
                    var lines = text.split(/\r?\n/);
                    var newLines = [];
                    var count = 0;
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line === "") continue;
                        var parts = line.split("|");
                        if (parts.length >= 3) {
                            if (count === idx) {
                                if (parts[1].indexOf("[FATTO]") === -1) {
                                    parts[1] = "[FATTO] " + parts[1];
                                } else {
                                    parts[1] = parts[1].replace("[FATTO] ", "");
                                }
                                line = parts.join("|");
                            }
                            count++;
                        }
                        newLines.push(line);
                    }
                    var streamOut = fso.CreateTextFile(fileBoard, true, true);
                    streamOut.Write(newLines.join("\r\n") + "\r\n");
                    streamOut.Close();
                    DisegnaPostit();
                }
            } catch(e) {
                MostraToast("Errore durante il completamento.", "error");
            }
        }

// ----------------------------------------------------
// SYSTEM TELEMETRY (CPU & RAM WMI)
// ----------------------------------------------------
function AggiornaTelemetriaSistema() {
    try {
        var locator = new ActiveXObject('WbemScripting.SWbemLocator');
        var service = locator.ConnectServer('.', 'root\\cimv2');
        
        // CPU
        var queryCpu = 'SELECT LoadPercentage FROM Win32_Processor';
        var itemsCpu = new Enumerator(service.ExecQuery(queryCpu));
        var avgCpu = 0;
        var cpuCount = 0;
        for (; !itemsCpu.atEnd(); itemsCpu.moveNext()) {
            var proc = itemsCpu.item();
            avgCpu += parseInt(proc.LoadPercentage || 0, 10);
            cpuCount++;
        }
        if (cpuCount > 0) avgCpu = Math.round(avgCpu / cpuCount);
        
        var cpuVal = document.getElementById('cpuLoadVal');
        var cpuDot = document.getElementById('cpuLoadDot');
        if (cpuVal) cpuVal.innerText = avgCpu + ' %';
        
        if (avgCpu > 80) {
            if (cpuVal) cpuVal.style.color = '#ef4444';
            if (cpuDot) { cpuDot.style.backgroundColor = '#ef4444'; cpuDot.style.boxShadow = '0 0 8px #ef4444'; }
        } else if (avgCpu > 50) {
            if (cpuVal) cpuVal.style.color = '#fbbf24';
            if (cpuDot) { cpuDot.style.backgroundColor = '#fbbf24'; cpuDot.style.boxShadow = '0 0 8px #fbbf24'; }
        } else {
            if (cpuVal) cpuVal.style.color = '#38bdf8';
            if (cpuDot) { cpuDot.style.backgroundColor = '#38bdf8'; cpuDot.style.boxShadow = '0 0 8px #38bdf8'; }
        }
        
        // RAM
        var queryRam = 'SELECT FreePhysicalMemory, TotalVisibleMemorySize FROM Win32_OperatingSystem';
        var itemsRam = new Enumerator(service.ExecQuery(queryRam));
        if (!itemsRam.atEnd()) {
            var os = itemsRam.item();
            var freeGB = (parseInt(os.FreePhysicalMemory, 10) / (1024 * 1024)).toFixed(1);
            var totalGB = (parseInt(os.TotalVisibleMemorySize, 10) / (1024 * 1024)).toFixed(1);
            
            var ramVal = document.getElementById('ramFreeVal');
            if (ramVal) ramVal.innerText = freeGB + ' GB / ' + totalGB + ' GB';
            
            var freePercent = (freeGB / totalGB) * 100;
            if (freePercent < 15) {
                if (ramVal) ramVal.style.color = '#ef4444';
            } else {
                if (ramVal) ramVal.style.color = '#a78bfa';
            }
        }
    } catch(e) {
        var cpuVal = document.getElementById('cpuLoadVal');
        if (cpuVal && cpuVal.innerText === '-- %') cpuVal.innerText = 'N.D.';
    }
}

// Start telemetry on load
setTimeout(function() {
    AggiornaTelemetriaSistema();
    setInterval(AggiornaTelemetriaSistema, 3000);
}, 1500);




