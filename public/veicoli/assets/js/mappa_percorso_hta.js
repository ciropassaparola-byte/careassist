// MAPPA_PERCORSO_HTA.JS
// Engine di rendering geografico del percorso per Smart Routing

var mapInstance = null;
var routePathData = []; // L'array finale dei dati ordinati
var fso = new ActiveXObject("Scripting.FileSystemObject");
var shell = new ActiveXObject("WScript.Shell");
var mapLayers = []; // Array per tenere traccia dei layer aggiunti
var lastCalculatedETA = []; // Array per conservare gli orari stimati per la stampa

window.onload = function() {
    setTimeout(InitMapSystem, 300); // Leggero ritardo per dare tempo al motore HTA di stabilizzarsi
};

function InitMapSystem() {
    // 1. Carica dati dal file temporaneo
    var currentPath = document.location.pathname;
    if(currentPath.indexOf("/") === 0) currentPath = currentPath.substring(1);
    currentPath = decodeURIComponent(currentPath).replace(/\//g, "\\");
    var basePath = currentPath.substring(0, currentPath.lastIndexOf("\\") + 1);
    
    var dataFilePath = basePath + "system\\temp_optimized_route.json";
    
    if (!fso.FileExists(dataFilePath)) {
        alert("Errore di sistema: Dati percorso non trovati.\nRiprova a ottimizzare dalla schermata principale.");
        return;
    }
    
    try {
        var f = fso.OpenTextFile(dataFilePath, 1);
        var raw = f.ReadAll();
        f.Close();
        
        // Pulisce stringa: rimuove spazi/a capo iniziali e finali (che mandano in errore IE)
        raw = raw.replace(/^\s+|\s+$/g, "");
        
        // Forza l'inizio della stringa dal primo carattere del JSON array per eliminare eventuali BOM invisibili
        var startIdx = raw.indexOf("[");
        if (startIdx > -1) {
            raw = raw.substring(startIdx);
        }
        
        try {
            routePathData = JSON.parse(raw);
        } catch(parseErr) {
            // Fallback solido come roccia se JSON.parse fa capricci coi caratteri speciali nell'HTA
            routePathData = eval("(" + raw + ")");
        }
        
    } catch(e) {
        alert("Errore nel parsing dei dati:\n" + e.message);
        return;
    }

    if (!routePathData || routePathData.length < 2) {
        alert("Nessun percorso valido da disegnare.");
        return;
    }

    // Aggiorna Label Conteggio
    document.getElementById("lblTappeCount").innerText = routePathData.length;
    document.getElementById("lblSummaryInfo").innerText = "Tracciamento stradale per " + routePathData.length + " tappe totali";

    // 2. Inizializzazione Leaflet
    var firstValid = null;
    for(var k=0; k<routePathData.length; k++) {
        if(routePathData[k].lat && routePathData[k].lon) {
            firstValid = routePathData[k]; break;
        }
    }
    
    var defaultCenter = firstValid ? [firstValid.lat, firstValid.lon] : [41.1171, 16.8719]; // Bari di default
    
    mapInstance = L.map('mapMain').setView(defaultCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);

    // 3. Disegna Elementi
    RenderUIList();
    DrawMarkersAndRoute();
    InitSortableList();
}

function InitSortableList() {
    if(typeof Sortable !== 'undefined') {
        var el = document.getElementById('tappeList');
        Sortable.create(el, {
            animation: 150,
            onEnd: function (evt) {
                if (evt.oldIndex === evt.newIndex) return;
                var movedItem = routePathData.splice(evt.oldIndex, 1)[0];
                routePathData.splice(evt.newIndex, 0, movedItem);
                RenderUIList();
                DrawMarkersAndRoute();
            }
        });
    }
}

function RenderUIList() {
    var container = document.getElementById("tappeList");
    container.innerHTML = "";

    for(var i=0; i<routePathData.length; i++) {
        var item = routePathData[i];
        var isStart = (i === 0);
        var isReturn = !!item.isReturn;
        
        var div = document.createElement("div");
        var extraClass = isStart ? " start-point" : (isReturn ? " return-point" : "");
        div.className = "stop-item" + extraClass;
        if (isReturn) div.style.cssText = "border-left: 5px solid #10b981;"; // Stile speciale per ritorno
        
        var numLabel = isStart ? "<i class='fa fa-building'></i>" : (isReturn ? "<i class='fa fa-flag-checkered'></i>" : i);
        var nameText = isStart ? "MAGAZZINO DI PARTENZA" : (isReturn ? "RITORNO IN SEDE" : (item.name || "Consegna Anonima"));
        
        var statusHtml = "";
        if (!item.lat || !item.lon) {
            statusHtml = '<div style="color:#dc2626; font-size:9px; font-weight:800; margin-top:3px;"><i class="fa fa-warning"></i> INDIRIZZO NON GEOLOCALIZZATO</div>';
        } else if (item.isApproximate) {
            statusHtml = '<div class="tag-approx"><i class="fa fa-map-signs"></i> POSIZIONE APPROSSIMATIVA (Solo Città)</div>';
        }

        div.innerHTML = '<div class="stop-number">' + numLabel + '</div>' +
                        '<div class="stop-info">' +
                            '<div class="stop-name">' + nameText.toUpperCase() + '</div>' +
                            '<div class="stop-addr">' + (item.address || "Indirizzo non disponibile") + '</div>' +
                            statusHtml +
                        '</div>';
        
        // Aggiungi funzione di click per centrare sulla mappa
        (function(lat, lon) {
            div.onclick = function() {
                if (lat && lon && mapInstance) {
                    mapInstance.setView([lat, lon], 15, { animate: true });
                }
            };
        })(item.lat, item.lon);
        
        container.appendChild(div);
    }
}

function DrawMarkersAndRoute() {
    var latlngs = [];
    var group = L.featureGroup();
    var coordinatesForOsrm = "";
    
    // Pulisce layer precedenti se presenti
    for (var l=0; l<mapLayers.length; l++) {
        mapInstance.removeLayer(mapLayers[l]);
    }
    mapLayers = [];

    for (var i = 0; i < routePathData.length; i++) {
        var p = routePathData[i];
        if (!p.lat || !p.lon) continue;
        
        var isStart = (i === 0);
        var isReturn = !!p.isReturn;
        var isApprox = !!p.isApproximate;
        var currentPos = [p.lat, p.lon];
        latlngs.push(currentPos);
        coordinatesForOsrm += p.lon + "," + p.lat + ";";

        // Classi Dinamiche
        var pinClass = "marker-pin";
        if (isStart || isReturn) pinClass += " start-pin";
        else if (isApprox) pinClass += " approx-pin";

        // Custom Pin (Leaflet divIcon)
        var innerIcon = isStart ? "<i class='fa fa-home'></i>" : (isReturn ? "<i class='fa fa-flag-checkered'></i>" : i);
        var iconHtml = "<div class='" + pinClass + "'></div>" +
                       "<div class='marker-text'>" + innerIcon + "</div>";
                       
        var myIcon = L.divIcon({
            className: 'custom-div-icon',
            html: iconHtml,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        });

        var markerLabel = isStart ? "🏁 PARTENZA" : (isReturn ? "🏁 RITORNO" : "📍 TAPPA #" + i);
        var warningText = isApprox ? "<br/><span style='color:#d97706; font-weight:bold; font-size:10px;'>⚠️ Indirizzo specifico non trovato.<br/>Centro città visualizzato.</span>" : "";

        var navLink = "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lon;
        var btnNav = "<br/><br/><a href='#' onclick='shell.Run(\"cmd /c start \\\"\\\" \\\"" + navLink + "\\\"\", 0, false); return false;' style='background:#2563eb; color:white; padding:4px 8px; text-decoration:none; border-radius:4px; font-weight:bold; display:inline-block;'><i class='fa fa-location-arrow'></i> Naviga Qui</a>";

        var popupContent = "<strong>" + markerLabel + "</strong><br/>" +
                           "<strong>" + (p.name || "") + "</strong><br/>" +
                           (p.address || "") +
                           warningText + btnNav;

        var mark = L.marker(currentPos, {icon: myIcon}).bindPopup(popupContent);
        mark.addTo(group);
    }
    
    group.addTo(mapInstance);
    mapLayers.push(group);

    // Richiesta via STRADALE a OSRM (per disegnare le linee che seguono le strade vere!)
    if (coordinatesForOsrm.length > 0) {
        coordinatesForOsrm = coordinatesForOsrm.slice(0, -1); // Rimuove ultimo ";"
        
        var osrmUrl = "https://router.project-osrm.org/route/v1/driving/" + coordinatesForOsrm + "?overview=full&geometries=polyline";
        
        var xhr = null;
        try { xhr = new XMLHttpRequest(); } catch(e) { xhr = new ActiveXObject("MSXML2.XMLHTTP"); }
        
        xhr.open("GET", osrmUrl, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.routes && response.routes.length > 0) {
                            var encodedGeometry = response.routes[0].geometry;
                            var decodedPoints = decodePolyline(encodedGeometry);
                            
                            // Disegna linea blu spessa PREMIUM sopra le strade
                            var roadPath1 = L.polyline(decodedPoints, {
                                color: '#2563eb',
                                weight: 6,
                                opacity: 0.8,
                                lineCap: 'round',
                                lineJoin: 'round',
                                shadowColor: '#000',
                                shadowBlur: 10
                            }).addTo(mapInstance);
                            
                            // Un'altra linea bianca interna per effetto strade hi-tech
                            var roadPath2 = L.polyline(decodedPoints, {
                                color: '#ffffff',
                                weight: 2,
                                opacity: 0.9,
                                dashArray: '5, 10'
                            }).addTo(mapInstance);
                            
                            mapLayers.push(roadPath1);
                            mapLayers.push(roadPath2);

                            var distanceKm = (response.routes[0].distance / 1000).toFixed(1);
                            var durationMin = Math.round(response.routes[0].duration / 60);
                            
                            document.getElementById("lblSummaryInfo").innerText = "Percorso stradale: " + distanceKm + " KM • Circa " + durationMin + " min stimati";
                            
                            // ---- INIZIO CALCOLO TEMPI TAPPE ----
                            lastCalculatedETA = []; // Reset ETA cache
                            var timeStartStr = document.getElementById("timeStart") ? document.getElementById("timeStart").value : "08:00";
                            var stopMin = document.getElementById("timeStop") ? parseInt(document.getElementById("timeStop").value) : 5;
                            if (isNaN(stopMin)) stopMin = 5;
                            
                            var parts = timeStartStr.split(":");
                            var currentMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                            if (isNaN(currentMinutes)) currentMinutes = 8 * 60; // fallback 08:00

                            if (response.routes[0].legs && response.routes[0].legs.length > 0) {
                                var container = document.getElementById("tappeList");
                                var stopItems = container.getElementsByClassName("stop-item");
                                
                                var validStopIndices = [];
                                for(var v=0; v<routePathData.length; v++) {
                                    if(routePathData[v].lat && routePathData[v].lon) {
                                        validStopIndices.push(v);
                                    }
                                }
                                
                                for (var j = 0; j < response.routes[0].legs.length; j++) {
                                    var legDurationMin = Math.round(response.routes[0].legs[j].duration / 60);
                                    if (legDurationMin < 1 && response.routes[0].legs[j].duration > 0) legDurationMin = 1;
                                    var legDistanceKm = (response.routes[0].legs[j].distance / 1000).toFixed(1);
                                    
                                    currentMinutes += legDurationMin; // Aggiunge tempo di guida
                                    
                                    var arrH = Math.floor(currentMinutes / 60) % 24;
                                    var arrM = currentMinutes % 60;
                                    var etaStr = (arrH < 10 ? "0" : "") + arrH + ":" + (arrM < 10 ? "0" : "") + arrM;
                                    
                                    var destStopIndex = validStopIndices[j + 1];
                                    if (destStopIndex !== undefined && destStopIndex < stopItems.length) {
                                        lastCalculatedETA[destStopIndex] = etaStr; // Salva in cache
                                        
                                        var timeDiv = document.createElement("div");
                                        timeDiv.style.cssText = "font-size:11px; color:#10b981; font-weight:800; margin-top:5px; padding:3px 6px; background:#ecfdf5; border-radius:4px; display:inline-block; border:1px solid #a7f3d0;";
                                        
                                        var diffId = "diff_" + destStopIndex;
                                        timeDiv.innerHTML = '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
                                            '<span><i class="fa fa-clock-o"></i> ETA ' + etaStr + ' &bull; <i class="fa fa-car"></i> ' + legDistanceKm + ' km</span>' +
                                            '<div style="display:flex; align-items:center; gap:4px; background:white; padding:1px 4px; border-radius:3px; border:1px solid #d1fae5;">' +
                                            '<i class="fa fa-pencil" style="font-size:8px; color:#9ca3af;"></i>' +
                                            '<input type="number" class="real-km-input" data-calc="'+legDistanceKm+'" step="0.1" value="'+legDistanceKm+'" placeholder="Reali..." style="width:50px; font-size:9px; border:none; outline:none; color:#374151; font-weight:bold;" oninput="CalcolaScarto(this, \''+legDistanceKm+'\', \''+diffId+'\')">' +
                                            '<span id="'+diffId+'" style="font-size:9px;"></span>' +
                                            '</div></div>';
                                        
                                        var infoDiv = stopItems[destStopIndex].getElementsByClassName("stop-info")[0];
                                        if (infoDiv) {
                                            infoDiv.appendChild(timeDiv);
                                        }
                                    }
                                    
                                    currentMinutes += stopMin; // Aggiunge tempo di scarico prima del prossimo viaggio
                                }
                                
                                // AGGIUNTA RIEPILOGO FINALE CON COSTI
                                var costoStimato = (distanceKm * 0.25).toFixed(2); // Default 0.25 euro/km
                                var recapDiv = document.createElement("div");
                                recapDiv.style.cssText = "background:linear-gradient(135deg, #0f172a, #1e293b); border:1.5px solid #3b82f6; border-radius:10px; padding:15px; margin-top:15px; text-align:center; box-shadow: 0 4px 15px rgba(0,0,0,0.3);";
                                recapDiv.innerHTML = "<div style='color:#93c5fd; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;'>RIEPILOGO COMPLESSIVO</div>" +
                                                     "<div style='color:#ffffff; font-size:22px; font-weight:900; margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:8px;'><i class='fa fa-road'></i> <span id='totaleRealeText'>" + distanceKm + "</span> KM TOTALI <span id='totaleScartoText' style='font-size:14px; margin-left:5px;'></span></div>" +
                                                     "<div style='background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; color:#cbd5e1; font-size:12px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.1); margin-bottom:8px;'>" +
                                                        "<span><i class='fa fa-hourglass-half'></i> " + durationMin + " min. guida</span>" + 
                                                        "<span style='color:#10b981;'><i class='fa fa-flag-checkered'></i> Rientro: " + etaStr + "</span>" +
                                                     "</div>" +
                                                     "<div style='font-size:11px; color:#94a3b8; border-top:1px dashed #334155; padding-top:8px; display:flex; justify-content:space-between;'>" +
                                                        "<span>Costo Stimato Consumi (0.25 €/km):</span> <strong style='color:#facc15;'>€ " + costoStimato + "</strong>" +
                                                     "</div>";
                                container.appendChild(recapDiv);
                            }
                            // ---- FINE CALCOLO TEMPI TAPPE ----
                        }
                    } catch(err) {
                        console.log("Error decoding OSRM route", err);
                        DrawFallbackLine(latlngs);
                    }
                } else {
                    DrawFallbackLine(latlngs);
                }
                
                // Centra la mappa visualizzando tutto il tragitto
                try { mapInstance.fitBounds(group.getBounds().pad(0.1)); } catch(e){}
            }
        };
        xhr.send();
    }
}

function DrawFallbackLine(coords) {
    // Se OSRM fallisce (mancanza rete, o query troppo lunga), disegniamo le linee rette tra le tappe
    var line = L.polyline(coords, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(mapInstance);
    mapLayers.push(line);
    document.getElementById("lblSummaryInfo").innerText += " (Tracciamento Lineare)";
}

function ApreGoogleMapsEsterno() {
    if (!routePathData || routePathData.length === 0) return;
    
    var mapsUrl = "https://www.google.com/maps/dir/";
    for (var i = 0; i < routePathData.length; i++) {
        var query = routePathData[i].address;
        if (query) {
            mapsUrl += encodeURIComponent(query + ", Italia") + "/";
        }
    }
    
    shell.Run("cmd /c start \"\" \"" + mapsUrl + "\"", 0, false);
}

// Utility decoder geometrico Polyline di Google/OSRM
function decodePolyline(str, precision) {
    var index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision || 5);

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change;

        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}

// INJECTION: NEAREST NEIGHBOR ALGORITHM PER OTTIMIZZAZIONE INTELLIGENTE
function ActionOttimizzaIntelligente() {
    if(!routePathData || routePathData.length < 3) {
        alert("Non ci sono abbastanza tappe intermedie per ottimizzare il percorso.");
        return;
    }
    if(typeof UXPremium !== 'undefined') UXPremium.ShowSplash("OTTIMIZZAZIONE PERCORSO IN CORSO...");

    var startNode = routePathData[0];
    var isEndFixed = !!routePathData[routePathData.length - 1].isReturn;
    var endNode = isEndFixed ? routePathData[routePathData.length - 1] : null;

    var nodesToSort = [];
    var maxIdx = isEndFixed ? routePathData.length - 1 : routePathData.length;
    for(var i = 1; i < maxIdx; i++) {
        nodesToSort.push(routePathData[i]);
    }

    var optimizedPath = [startNode];
    var currentNode = startNode;

    // Nearest Neighbor
    while(nodesToSort.length > 0) {
        var nearestIdx = -1;
        var minDistance = Infinity;

        for(var j = 0; j < nodesToSort.length; j++) {
            var candidate = nodesToSort[j];
            if(!candidate.lat || !candidate.lon || !currentNode.lat || !currentNode.lon) {
                // Se non si può calcolare la distanza, va preso per forza subito
                nearestIdx = j;
                break;
            }
            // Calcolo distanza linea d'aria approssimata tra i punti
            var d = L.latLng(currentNode.lat, currentNode.lon).distanceTo(L.latLng(candidate.lat, candidate.lon));
            if(d < minDistance) {
                minDistance = d;
                nearestIdx = j;
            }
        }
        var nextNode = nodesToSort.splice(nearestIdx, 1)[0];
        optimizedPath.push(nextNode);
        if(nextNode.lat && nextNode.lon) currentNode = nextNode;
    }

    if(isEndFixed) optimizedPath.push(endNode);

    routePathData = optimizedPath;
    
    setTimeout(function() {
        RenderUIList();
        DrawMarkersAndRoute();
        if(typeof UXPremium !== 'undefined') UXPremium.HideSplash();
    }, 400);
}

// ==== NUOVE FUNZIONI AVANZATE ====

function RicalcolaTempi() {
    DrawMarkersAndRoute();
}

function ToggleDarkMode() {
    var body = document.body;
    if (body.className.indexOf("dark-mode") === -1) {
        body.className += " dark-mode";
    } else {
        body.className = body.className.replace(" dark-mode", "");
    }
}

function CondividiWhatsApp() {
    if (!routePathData || routePathData.length === 0) return;
    
    var testo = "🚗 *GIRO CONSEGNE* 🚗\n\n";
    for (var i = 0; i < routePathData.length; i++) {
        var eta = lastCalculatedETA[i] ? "[" + lastCalculatedETA[i] + "] " : "";
        var name = i === 0 ? "PARTENZA" : (routePathData[i].name || "Consegna");
        testo += i + ". " + eta + name + "\n";
    }
    
    var mapsUrl = "https://www.google.com/maps/dir/";
    for (var i = 0; i < routePathData.length; i++) {
        if (routePathData[i].address) mapsUrl += encodeURIComponent(routePathData[i].address + ", Italia") + "/";
    }
    
    testo += "\n🔗 *Mappa Completa:*\n" + mapsUrl;
    
    var waUrl = "https://web.whatsapp.com/send?text=" + encodeURIComponent(testo);
    shell.Run("cmd /c start \"\" \"" + waUrl + "\"", 0, false);
}

function StampaFoglioAttuale() {
    if (!routePathData || routePathData.length === 0) return;
    
    var currentPath = document.location.pathname;
    if(currentPath.indexOf("/") === 0) currentPath = currentPath.substring(1);
    currentPath = decodeURIComponent(currentPath).replace(/\//g, "\\");
    var basePath = currentPath.substring(0, currentPath.lastIndexOf("\\") + 1);
    var tempFile = basePath + "system\\temp_stampa_mappa.html";
    
    var html = "<html><head><title>Stampa Foglio di Viaggio</title>";
    html += "<style>body{font-family:'Segoe UI', sans-serif; margin:30px; color:#0f172a;} table{width:100%; border-collapse:collapse; margin-top:20px; font-size:13px;} th,td{border:1px solid #cbd5e1; padding:10px; text-align:left;} th{background:#1e293b; color:white;} .eta-badge{background:#ecfdf5; color:#10b981; padding:3px 6px; border-radius:4px; font-weight:bold; border:1px solid #a7f3d0;}</style>";
    html += "</head><body onload='window.print()'>";
    html += "<h1 style='color:#2563eb; margin-bottom:5px;'>📋 FOGLIO DI VIAGGIO</h1>";
    html += "<div style='color:#64748b; font-size:12px; margin-bottom:20px;'>Generato il: " + new Date().toLocaleString() + "</div>";
    
    html += "<table><tr><th>#</th><th>ETA stimato</th><th>Destinatario</th><th>Indirizzo / Dettagli</th><th>Firma per ricevuta / Note</th></tr>";
    
    for (var i = 0; i < routePathData.length; i++) {
        var eta = lastCalculatedETA[i] ? "<span class='eta-badge'>" + lastCalculatedETA[i] + "</span>" : "--:--";
        if (i === 0) eta = "<b>PARTENZA</b>";
        var rawPhone = routePathData[i].contactPhone;
        var telHtml = "";
        if (rawPhone && rawPhone !== "Nessun Recapito") {
            var firstPhone = rawPhone.split(/[,;\/]/)[0].trim();
            var cleanPhone = firstPhone.replace(/[^0-9+]/g, "");
            if (cleanPhone.length === 10 && cleanPhone.indexOf("3") === 0) {
                cleanPhone = "39" + cleanPhone;
            }
            var waLink = "<a href='https://wa.me/" + cleanPhone + "' style='text-decoration:none; background:#dcfce7; color:#16a34a; padding:4px 8px; border-radius:4px; border:1px solid #bbf7d0; display:inline-block; font-weight:bold;' target='_blank'>💬 WhatsApp</a>";
            telHtml = "<br><a href='tel:" + cleanPhone + "' style='font-size:13px; color:#2563eb; text-decoration:none; font-weight:900; display:inline-block; margin-top:4px;'>📞 " + rawPhone + "</a><br><div style='margin-top:6px; font-size:11px;'>" + waLink + "</div>";
        }
        var name = i === 0 ? "MAGAZZINO LOGISTICA" : ("<b>" + (routePathData[i].name || "Consegna") + "</b>" + telHtml);
        var addr = routePathData[i].address || "";
        html += "<tr><td style='text-align:center; font-weight:bold;'>" + i + "</td><td>" + eta + "</td><td>" + name + "</td><td>" + addr + "</td><td></td></tr>";
    }
    
    html += "</table></body></html>";
    
    try {
        // Il terzo parametro 'true' abilita la codifica Unicode per supportare le emoji senza generare l'errore "Argomento non valido"
        var f = fso.CreateTextFile(tempFile, true, true);
        f.Write(html);
        f.Close();
        shell.Run("cmd /c start \"\" \"" + tempFile + "\"", 0, false);
    } catch(e) {
        if(typeof UXPremium !== 'undefined') {
            UXPremium.ShowError("Errore durante la creazione del file di stampa: " + e.message);
        } else {
            alert("Errore durante la creazione del file di stampa: " + e.message);
        }
    }
}

// Funzione per calcolare lo scarto chilometrico in tempo reale
window.CalcolaScarto = function(inputEl, calcKmStr, diffId) {
    var diffSpan = document.getElementById(diffId);
    if (!diffSpan) return;
    if (inputEl.value === "") {
        diffSpan.innerHTML = "";
    } else {
        var realKm = parseFloat(inputEl.value.replace(",", "."));
        var calcKm = parseFloat(calcKmStr);
        if (!isNaN(realKm) && !isNaN(calcKm)) {
            var diff = realKm - calcKm;
            var diffStr = Math.abs(diff).toFixed(1);
            if (diff > 0.05) {
                diffSpan.innerHTML = '<span style="color:#ef4444;" title="In eccesso (+' + diffStr + ' km)">+' + diffStr + '</span>';
            } else if (diff < -0.05) {
                diffSpan.innerHTML = '<span style="color:#3b82f6;" title="In difetto (-' + diffStr + ' km)">-' + diffStr + '</span>';
            } else {
                diffSpan.innerHTML = '<span style="color:#10b981;">=</span>';
            }
        } else {
            diffSpan.innerHTML = "";
        }
    }

    // Aggiorna il totale riepilogativo in basso
    var inputs = document.getElementsByClassName("real-km-input");
    var totalReal = 0;
    var totalCalc = 0;
    for (var i = 0; i < inputs.length; i++) {
        var val = parseFloat(inputs[i].value.replace(",", "."));
        var cVal = parseFloat(inputs[i].getAttribute("data-calc"));
        if (!isNaN(val)) {
            totalReal += val;
        } else if (!isNaN(cVal)) {
            totalReal += cVal;
        }
        if (!isNaN(cVal)) {
            totalCalc += cVal;
        }
    }
    
    var totEl = document.getElementById("totaleRealeText");
    var scartoEl = document.getElementById("totaleScartoText");
    if (totEl) {
        totEl.innerText = totalReal.toFixed(1);
        var tDiff = totalReal - totalCalc;
        if (Math.abs(tDiff) > 0.05) {
            var tDiffStr = Math.abs(tDiff).toFixed(1);
            if (tDiff > 0) {
                scartoEl.innerHTML = '<span style="color:#ef4444; background:rgba(239, 68, 68, 0.2); padding:2px 8px; border-radius:6px; font-weight:900;">+' + tDiffStr + '</span>';
            } else {
                scartoEl.innerHTML = '<span style="color:#3b82f6; background:rgba(59, 130, 246, 0.2); padding:2px 8px; border-radius:6px; font-weight:900;">-' + tDiffStr + '</span>';
            }
        } else {
            scartoEl.innerHTML = "";
        }
    }
};
