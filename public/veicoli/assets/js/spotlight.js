// spotlight.js - Global Search Spotlight (Premium UI)

(function() {
    if(window.SpotlightLoaded) return;
    window.SpotlightLoaded = true;

    // Inietta HTML dello Spotlight
    var html = "" +
    "<div id='globalSpotlightOverlay' style='display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(8px); z-index:200000; align-items:center; justify-content:center; flex-direction:column;'>" +
    "    <div id='globalSpotlightBox' style='width:600px; max-width:90%; background:#0f172a; border: 1.5px solid #334155; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); overflow:hidden; transform: translateY(-10vh);'>" +
    "        <div style='display:flex; align-items:center; padding: 15px 20px; border-bottom: 1px solid #1e293b;'>" +
    "            <i class='fa fa-search' style='color:#0ea5e9; font-size:20px; margin-right:15px;'></i>" +
    "            <input type='text' id='globalSpotlightInput' placeholder='Cerca consegne, clienti, indirizzi...' style='width:100%; background:transparent; border:none; color:white; font-size:18px; outline:none; font-family:\"Segoe UI\", sans-serif;'>" +
    "            <button onclick='window.ChiudiSpotlight()' style='background:none; border:none; color:#64748b; font-size:24px; cursor:pointer;'>&times;</button>" +
    "        </div>" +
    "        <div id='globalSpotlightResults' style='max-height:400px; overflow-y:auto; padding:10px;'>" +
    "            <div style='padding:20px; text-align:center; color:#64748b; font-size:13px;'>Inizia a digitare per cercare ovunque...</div>" +
    "        </div>" +
    "        <div style='padding: 10px 20px; background: #0b1120; border-top: 1px solid #1e293b; color: #64748b; font-size:11px; display:flex; justify-content:space-between;'>" +
    "            <span>Premi <strong>ESC</strong> per chiudere</span>" +
    "            <span>Ricerca globale intelligente</span>" +
    "        </div>" +
    "    </div>" +
    "</div>";

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // Style for results
    var style = document.createElement('style');
    style.innerHTML = "" +
    ".spotlight-item { padding: 12px 15px; border-radius: 8px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 4px; transition: all 0.2s; }" +
    ".spotlight-item:hover { background: #1e293b; }" +
    ".spotlight-title { color: #f8fafc; font-weight: bold; font-size: 14px; }" +
    ".spotlight-sub { color: #94a3b8; font-size: 12px; }" +
    ".spotlight-highlight { color: #0ea5e9; font-weight: 900; }";
    document.head.appendChild(style);

    // Event Listeners
    window.ChiudiSpotlight = function() {
        document.getElementById('globalSpotlightOverlay').style.display = 'none';
        document.getElementById('globalSpotlightInput').value = '';
    };

    window.ApriSpotlight = function() {
        var over = document.getElementById('globalSpotlightOverlay');
        over.style.display = 'flex';
        var inp = document.getElementById('globalSpotlightInput');
        inp.value = '';
        setTimeout(function() { inp.focus(); }, 100);
        document.getElementById('globalSpotlightResults').innerHTML = "<div style='padding:20px; text-align:center; color:#64748b; font-size:13px;'>Inizia a digitare per cercare ovunque...</div>";
    };

    // CTRL + SPACE listener
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.code === 'Space') {
            e.preventDefault();
            var over = document.getElementById('globalSpotlightOverlay');
            if (over.style.display === 'none' || over.style.display === '') {
                window.ApriSpotlight();
            } else {
                window.ChiudiSpotlight();
            }
        }
        if (e.code === 'Escape') {
            window.ChiudiSpotlight();
        }
    });

    // Search logic
    document.getElementById('globalSpotlightInput').addEventListener('input', function(e) {
        var query = e.target.value.trim().toLowerCase();
        var resContainer = document.getElementById('globalSpotlightResults');
        
        if (query.length < 2) {
            resContainer.innerHTML = "<div style='padding:20px; text-align:center; color:#64748b; font-size:13px;'>Digita almeno 2 caratteri...</div>";
            return;
        }

        var results = [];

        // Check if we have consegne data
        if (typeof window.arrayConsegneMemory !== 'undefined') {
            for (var i = 0; i < window.arrayConsegneMemory.length; i++) {
                var c = window.arrayConsegneMemory[i];
                var searchStr = (c.ClienteNome + " " + c.LocalitaConsegna + " " + c.IndirizzoConsegna + " " + (c.Merce||"") + " " + (c.Telefono||"")).toLowerCase();
                if (searchStr.indexOf(query) !== -1) {
                    results.push({
                        type: 'CONSEGNA',
                        title: c.ClienteNome,
                        sub: c.IndirizzoConsegna + " - " + c.LocalitaConsegna,
                        date: c.DataConsegna,
                        state: c.Stato,
                        refIdx: i
                    });
                }
            }
        }
        
        // Check if we have anagrafica data
        if (typeof window.dataClienti !== 'undefined') {
            for (var j = 0; j < window.dataClienti.length; j++) {
                var ac = window.dataClienti[j];
                var searchAcStr = (ac.CognomeNome + " " + ac.Indirizzo + " " + ac.Comune + " " + ac.Provincia + " " + (ac.Telefono||"")).toLowerCase();
                if (searchAcStr.indexOf(query) !== -1) {
                    results.push({
                        type: 'CLIENTE',
                        title: ac.CognomeNome,
                        sub: ac.Indirizzo + " - " + ac.Comune,
                        date: null,
                        state: ac.Stato,
                        refIdx: j
                    });
                }
            }
        }

        renderResults(results, query);
    });

    function renderResults(results, query) {
        var resContainer = document.getElementById('globalSpotlightResults');
        if (results.length === 0) {
            resContainer.innerHTML = "<div style='padding:20px; text-align:center; color:#ef4444; font-size:13px;'>Nessun risultato trovato per \\'\" + query + \"\\'</div>";
            return;
        }

        // Limit to 20 results for performance
        var limit = Math.min(results.length, 20);
        var html = "";
        
        for (var i = 0; i < limit; i++) {
            var r = results[i];
            var typeColor = r.type === 'CONSEGNA' ? '#0ea5e9' : '#d4af37';
            
            // Highlight
            var qSafe = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            var re = new RegExp("(" + qSafe + ")", "gi");
            var hlTitle = String(r.title).replace(re, "<span class='spotlight-highlight'>$1</span>");
            var hlSub = String(r.sub).replace(re, "<span class='spotlight-highlight'>$1</span>");

            html += "<div class='spotlight-item' onclick='window.SpotlightAction(\"" + r.type + "\", " + r.refIdx + ")'>";
            html += "   <div style='display:flex; justify-content:space-between; align-items:center;'>";
            html += "       <span class='spotlight-title'>" + hlTitle + "</span>";
            html += "       <span style='background:" + typeColor + "; color:white; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:bold;'>" + r.type + "</span>";
            html += "   </div>";
            html += "   <div class='spotlight-sub'>" + hlSub + "</div>";
            if(r.date) {
                html += "   <div class='spotlight-sub' style='color:#64748b; font-size:10px;'><i class='fa fa-calendar'></i> " + r.date + " | Stato: " + r.state + "</div>";
            }
            html += "</div>";
        }
        
        if(results.length > 20) {
            html += "<div style='text-align:center; padding:10px; color:#64748b; font-size:11px;'>...e altri " + (results.length - 20) + " risultati</div>";
        }
        
        resContainer.innerHTML = html;
    }

    // Action when clicking a result
    window.SpotlightAction = function(type, idx) {
        window.ChiudiSpotlight();
        
        if (type === 'CONSEGNA') {
            if (typeof window.arrayConsegneMemory !== 'undefined') {
                var c = window.arrayConsegneMemory[idx];
                
                // If we are in consegne, we can filter or highlight it
                if (typeof window.CercaConsegne === 'function') {
                    var searchBox = document.getElementById("txtCercaGlobal") || document.getElementById("txtRicerca");
                    if (searchBox) {
                        searchBox.value = c.ClienteNome;
                        window.CercaConsegne();
                        if (typeof window.CercaConsegne === 'function' && searchBox.id === "txtRicerca") {
                            // try fallback if CercaConsegne needs id argument
                            window.CercaConsegne(c.ID);
                        }
                        
                        setTimeout(function() {
                            if(typeof window.ToastManager !== 'undefined') {
                                window.ToastManager.success("Trovato: " + c.ClienteNome);
                            }
                        }, 500);
                    }
                }
            }
        } else if (type === 'CLIENTE') {
            if (typeof window.dataClienti !== 'undefined') {
                var ac = window.dataClienti[idx];
                if (typeof window.ApriDettaglio === 'function') {
                    window.ApriDettaglio(ac.ID_Paziente);
                } else if (typeof window.ricaricaLista === 'function') {
                    var sb = document.getElementById("txtRicerca");
                    if (sb) {
                        sb.value = ac.CognomeNome;
                        window.ricaricaLista(ac.CognomeNome);
                    }
                }
            }
        }
    };
})();
