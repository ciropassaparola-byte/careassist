// LOGICA CENTRO COMANDO ANALITICO E ARCHIVIO FOTO
// Sviluppato per Phase 5 - Sistema Logistica Avanzata

var charts = { bilancio: null, km: null, mix: null };

// FIX CLIPPING GRAFICI: Disabilita il calcolo dei pixel ad alta densità che in IE11/HTA 
// causa il taglio a metà della visualizzazione in presenza di scaling di Windows.
if (typeof Chart !== 'undefined') { Chart.defaults.global.devicePixelRatio = 1; }

var globalPhotos = []; // Buffer per foto caricate

// 1. CORE DATABASE PIPELINE
function queryAccessDB(sql, isUpdate) {
    var http = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
    try {
        http.Open("POST", "http://127.0.0.1:3002/query", false);
        http.SetRequestHeader("Content-Type", "application/json");
        http.Send(JSON.stringify({ sql: sql }));
        if (http.Status === 200) {
            var res = JSON.parse(http.ResponseText);
            return isUpdate ? true : res;
        } else { return isUpdate ? false : []; }
    } catch(errReq) { return isUpdate ? false : []; }
}

function dbToItDate(d) {
    if (!d || d === "" || d === "1900-01-01" || d.indexOf("1900-01-01") === 0) return "";
    var parts = d.trim().split(" ");
    var datePart = parts[0];
    var timePart = parts.length > 1 ? " " + parts[1] : "";
    var p = datePart.split("-");
    if (p.length === 3) {
        return p[2] + "/" + p[1] + "/" + p[0] + timePart;
    }
    return d;
}

function itToDbDate(d) {
    if (!d || d === "") return "";
    var parts = d.trim().split(" ");
    var datePart = parts[0];
    var timePart = parts.length > 1 ? " " + parts[1] : "";
    var p = datePart.split("/");
    if (p.length === 3) {
        return p[2] + "-" + p[1] + "-" + p[0] + timePart;
    }
    return d;
}

// 2. EVENTI DI AVVIO
window.onload = function() {
    // Calibrazione Dimensioni Finestra
    try {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
    } catch(e){}

    // Ritardo necessario in HTA per permettere ai container Flexbox di stabilizzarsi 
    // prima che Chart.js catturi le dimensioni degli assi e del canvas.
    setTimeout(function(){
        CaricaEElaboraGrafici();
        CaricaGalleriaDocumenti();
    }, 350);
};

function SwitchView(tab) {
    document.getElementById("btnTabGrafici").classList.remove("active");
    document.getElementById("btnTabFoto").classList.remove("active");
    document.getElementById("btnTabMappa").classList.remove("active");
    document.getElementById("panelGrafici").classList.remove("active");
    document.getElementById("panelFoto").classList.remove("active");
    document.getElementById("panelMappa").classList.remove("active");

    if (tab === 'grafici') {
        document.getElementById("btnTabGrafici").classList.add("active");
        document.getElementById("panelGrafici").classList.add("active");
        if(charts.bilancio) charts.bilancio.resize();
        if(charts.km) charts.km.resize();
        if(charts.mix) charts.mix.resize();
    } else if (tab === 'foto') {
        document.getElementById("btnTabFoto").classList.add("active");
        document.getElementById("panelFoto").classList.add("active");
    } else if (tab === 'mappa') {
        document.getElementById("btnTabMappa").classList.add("active");
        document.getElementById("panelMappa").classList.add("active");
        // Ritarda di un attimo per permettere il rendering del container DOM per Leaflet
        setTimeout(RenderMappaHeatmap, 300);
    }
}

// 3. ENGINE ANALITICO E GRAFICO
var NOMI_MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function CaricaEElaboraGrafici() {
    var anno = document.getElementById("cmbAnnoReport").value;
    
    try {
        // A. Carica DATI BASE per la costruzione del motore
        // 1. TARIFFA KM (Proviamo a prenderla da config, fallback 0.45)
        var tariffa = 0.45;
        var resCfg = queryAccessDB("SELECT Valore FROM tblConfigAuto WHERE Chiave = 'TariffaKm'") || [];
        if(resCfg[0] && resCfg[0].Valore) tariffa = parseFloat(resCfg[0].Valore.replace(",", ".")) || 0.45;

        // 2. QUERY CONSEGNE (Kilometrie & Mesi)
        var sqlConsegne = "SELECT DataConsegna, KmAndata, KmRitorno FROM tblConsegne WHERE DataConsegna LIKE '" + anno + "-%'";
        var rawConsegne = queryAccessDB(sqlConsegne) || [];
        
        // 3. QUERY RIFORNIMENTI
        var sqlRifo = "SELECT DataRifornimento, CostoTotale, Litri FROM tblRifornimenti WHERE DataRifornimento LIKE '" + anno + "-%'";
        var rawRifo = queryAccessDB(sqlRifo) || [];
        
        // 4. QUERY MANUTENZIONI (Per Mix Spese)
        var sqlSpese = "SELECT Costo, TipoIntervento, DataIntervento FROM tblSpeseVeicolo WHERE DataIntervento LIKE '" + anno + "-%'";
        var rawSpese = queryAccessDB(sqlSpese) || [];

        // B. AGGREGAZIONE MENSILE
        var datiMensili = [];
        for (var m = 0; m < 12; m++) {
            datiMensili.push({ km: 0, ricavo: 0, spesaRifo: 0, spesaManut: 0 });
        }

        // Elabora Consegne -> Km & Ricavo
        for (var i = 0; i < rawConsegne.length; i++) {
            var row = rawConsegne[i];
            var d = row.DataConsegna;
            if(!d) continue;
            var mIdx = parseInt(d.substring(5, 7), 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
                var kmRow = (parseFloat(row.KmAndata) || 0) + (parseFloat(row.KmRitorno) || 0);
                datiMensili[mIdx].km += kmRow;
                datiMensili[mIdx].ricavo += (kmRow * tariffa);
            }
        }

        // Elabora Rifornimenti -> Spesa
        var totSpesaCarburante = 0;
        for (var j = 0; j < rawRifo.length; j++) {
            var r = rawRifo[j];
            var d = r.DataRifornimento;
            if(!d) continue;
            var mIdx = parseInt(d.substring(5, 7), 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
                var c = parseFloat(r.CostoTotale) || 0;
                datiMensili[mIdx].spesaRifo += c;
                totSpesaCarburante += c;
            }
        }

        // Elabora Manutenzioni -> Mix Spese
        var totSpesaManut = 0;
        var manOrd = 0, manStra = 0;
        for (var k = 0; k < rawSpese.length; k++) {
            var s = rawSpese[k];
            var c = parseFloat(s.Costo) || 0;
            totSpesaManut += c;
            if (String(s.TipoIntervento).toUpperCase().indexOf("STRAORD") !== -1) {
                manStra += c;
            } else {
                manOrd += c;
            }
            
            var d = s.DataIntervento;
            if(d) {
                var mIdx = parseInt(d.substring(5, 7), 10) - 1;
                if (mIdx >= 0 && mIdx < 12) {
                     datiMensili[mIdx].spesaManut += c;
                }
            }
        }

        // C. AGGIORNAMENTO SUMMARY BAR
        var totRic = 0, totSpe = 0;
        var arrRic = [], arrSpeRif = [], arrKm = [];
        for (var m = 0; m < 12; m++) {
            totRic += datiMensili[m].ricavo;
            totSpe += (datiMensili[m].spesaRifo + datiMensili[m].spesaManut);
            arrRic.push(datiMensili[m].ricavo.toFixed(2));
            arrSpeRif.push(datiMensili[m].spesaRifo.toFixed(2));
            arrKm.push(datiMensili[m].km.toFixed(0));
        }

        document.getElementById("lblSummaryRicavo").innerText = totRic.toFixed(2) + " €";
        document.getElementById("lblSummarySpesa").innerText = totSpe.toFixed(2) + " €";
        var net = totRic - totSpe;
        var lblNet = document.getElementById("lblSummaryNetto");
        lblNet.innerText = net.toFixed(2) + " €";
        lblNet.style.color = net >= 0 ? "#16a34a" : "#dc2626";

        // D. RENDER CHARTS
        RenderChartBilancio(arrRic, arrSpeRif);
        RenderChartKm(arrKm);
        RenderChartPie(totSpesaCarburante, manOrd, manStra);

    } catch (err) {
        alert("Errore durante l'elaborazione dei dati: " + err.message);
    }
}

function RenderChartBilancio(ricavi, costi) {
    var ctx = document.getElementById('chartBilancioMensile');
    if(!ctx) return;
    if (charts.bilancio) charts.bilancio.destroy();

    charts.bilancio = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: NOMI_MESI,
            datasets: [
                {
                    label: 'Ricavo Consegne (€)',
                    backgroundColor: 'rgba(34, 197, 94, 0.85)', // Emerald-500
                    hoverBackgroundColor: '#16a34a',
                    data: ricavi
                },
                {
                    label: 'Costo Carburante (€)',
                    backgroundColor: 'rgba(249, 115, 22, 0.85)', // Orange-500
                    hoverBackgroundColor: '#ea580c',
                    data: costi
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: 1,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, font: { weight: 'bold' } } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            var label = context.dataset.label || '';
                            if (label) label += ': ';
                            label += Number(context.parsed.y).toFixed(2) + ' €';
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true, 
                    ticks: { callback: function(value) { return value + ' €'; } },
                    grid: { color: '#f1f5f9' }
                },
                x: { 
                    grid: { display: false } 
                }
            }
        }
    });
}

function RenderChartKm(distanze) {
    var ctx = document.getElementById('chartKmPercorsi');
    if(!ctx) return;
    if (charts.km) charts.km.destroy();

    charts.km = new Chart(ctx, {
        type: 'line',
        data: {
            labels: NOMI_MESI,
            datasets: [{
                label: 'Km Percorsi',
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                data: distanze,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0ea5e9',
                pointRadius: 4,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: 1,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { 
                        color: '#334155',
                        font: { size: 12, weight: 'bold' },
                        callback: function(value) { return value + ' Km'; } 
                    }, 
                    grid: { color: '#e2e8f0' },
                    title: { display: true, text: 'TOTALE CHILOMETRI', color: '#0f172a', font: { weight: 'bold' } }
                },
                x: { 
                    ticks: { color: '#334155', font: { size: 12, weight: 'bold' } },
                    grid: { display: false },
                    title: { display: true, text: 'MESI DELL\'ANNO', color: '#0f172a', font: { weight: 'bold' } }
                }
            }
        }
    });
}

function RenderChartPie(carb, ord, stra) {
    var ctx = document.getElementById('chartMixSpese');
    if(!ctx) return;
    if (charts.mix) charts.mix.destroy();

    var total = carb + ord + stra;
    if (total === 0) {
        // Empty Chart
        charts.mix = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Nessuna Spesa'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
            options: { responsive: true, maintainAspectRatio: false, devicePixelRatio: 1, legend: { display: false } }
        });
        return;
    }

    charts.mix = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Carburante', 'Manut. Ord.', 'Manut. Straord.'],
            datasets: [{
                data: [carb.toFixed(2), ord.toFixed(2), stra.toFixed(2)],
                backgroundColor: ['#f97316', '#3b82f6', '#ef4444'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: 1,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
            }
        }
    });
}

// 4. LOGICA ARCHIVIO FOTO (GALLERY ENGINE)
function CaricaGalleriaDocumenti() {
    globalPhotos = [];
    
    try {
        // Recupero Path Assoluto Applicazione
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var root = fso.GetParentFolderName(p);

        // 1. Estrai allegati da RIFORNIMENTI
        var rawRif = queryAccessDB("SELECT DataRifornimento, Note, PathAllegato, CostoTotale FROM tblRifornimenti WHERE PathAllegato IS NOT NULL AND PathAllegato <> '' ORDER BY DataRifornimento DESC") || [];
        for(var i=0; i<rawRif.length; i++) {
            var r = rawRif[i];
            globalPhotos.push({
                tipo: 'RIFO',
                data: r.DataRifornimento,
                titolo: "Pieno " + (r.CostoTotale?r.CostoTotale+" €":""),
                desc: r.Note || "Rifornimento Carburante",
                relPath: r.PathAllegato,
                absPath: root + "\\" + r.PathAllegato
            });
        }

        // 2. Estrai allegati da MANUTENZIONI
        var rawSpa = queryAccessDB("SELECT DataIntervento, Descrizione, PathAllegato, Costo FROM tblSpeseVeicolo WHERE PathAllegato IS NOT NULL AND PathAllegato <> '' ORDER BY DataIntervento DESC") || [];
        for(var j=0; j<rawSpa.length; j++) {
            var s = rawSpa[j];
            globalPhotos.push({
                tipo: 'SPESA',
                data: s.DataIntervento,
                titolo: s.Descrizione || "Intervento",
                desc: s.Costo ? "Spesa: " + s.Costo + " €" : "Manutenzione",
                relPath: s.PathAllegato,
                absPath: root + "\\" + s.PathAllegato
            });
        }

        // Ordina tutti per data decrescente
        globalPhotos.sort(function(a,b) { return b.data > a.data ? 1 : -1; });

        // Renderizza
        FiltraGalleria();

    } catch(e) {
        console.error("Errore caricamento foto: " + e.message);
    }
}

function FiltraGalleria() {
    var fType = document.getElementById("cmbFiltroFoto").value;
    var cont = document.getElementById("galleryContainer");
    var emp = document.getElementById("galleryEmpty");
    cont.innerHTML = "";
    
    var filtered = [];
    if (fType === 'ALL') {
        filtered = globalPhotos;
    } else {
        for(var k=0; k<globalPhotos.length; k++) {
            if(globalPhotos[k].tipo === fType) filtered.push(globalPhotos[k]);
        }
    }

    document.getElementById("lblConteggioFoto").innerText = filtered.length + " Elementi";

    if (filtered.length === 0) {
        cont.style.display = "none";
        emp.style.display = "block";
        return;
    }

    cont.style.display = "grid";
    emp.style.display = "none";

    var fso = new ActiveXObject("Scripting.FileSystemObject");

    for (var i = 0; i < filtered.length; i++) {
        var item = filtered[i];
        var card = document.createElement("div");
        card.className = "photo-card";
        
        // Verifica se il file esiste davvero sul disco prima di tentare il render
        var fileExists = false;
        try { fileExists = fso.FileExists(item.absPath); } catch(x){}

        var previewHtml = "";
        var isImage = /\.(jpg|jpeg|png|gif|bmp)$/i.test(item.absPath);
        
        if (fileExists && isImage) {
            // Nelle HTA per visualizzare file locali è necessario forzare l'uso di URL encoded path o raw backslashes che IE interpreta.
            previewHtml = '<img src="file:///' + item.absPath.replace(/\\/g, '/') + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fa fa-file-o\\\'></i>\'">';
        } else if (fileExists) {
            // È un PDF o altro
            previewHtml = '<i class="fa fa-file-pdf-o" style="color:#dc2626;"></i>';
        } else {
            previewHtml = '<i class="fa fa-exclamation-triangle" style="color:#f59e0b;" title="File mancante o non trovato su disco"></i>';
        }

        var tagClass = item.tipo === 'RIFO' ? 'tag-rifo' : 'tag-spesa';
        var tagText = item.tipo === 'RIFO' ? 'Rifornimento' : 'Manutenzione';

        var html = '<div class="photo-thumb">' + previewHtml + '</div>';
        html += '<div class="photo-details">';
        html += '  <div class="photo-date">' + dbToItDate(item.data) + '</div>';
        html += '  <div class="photo-desc">' + item.titolo + '</div>';
        html += '  <span class="photo-tag ' + tagClass + '">' + tagText + '</span>';
        html += '</div>';

        card.innerHTML = html;
        
        // Closure for event scope bind
        (function(path, title, dataInfo, isImg){
            card.onclick = function() {
                if (isImg) {
                    OpenPhotoViewer(path, title + " (" + dataInfo + ")");
                } else {
                    // Se non è un immagine (es. PDF), apriamolo col programma predefinito di Windows via Shell
                    try {
                        var sh = new ActiveXObject("WScript.Shell");
                        sh.Run('"' + path + '"', 1, false);
                    } catch(e) { alert("Impossibile aprire il documento esternamente."); }
                }
            };
        })(item.absPath, item.titolo, dbToItDate(item.data), isImage);

        cont.appendChild(card);
    }
}

// 5. OVERLAY VIEWER ENGINE
function OpenPhotoViewer(absPath, caption) {
    var over = document.getElementById("viewerOverlay");
    var img = document.getElementById("viewerFullImage");
    var cap = document.getElementById("viewerCaption");
    
    img.src = "file:///'" + absPath.replace(/\\/g, '/') + "'"; // Reset to trigger fix load if needed
    img.src = "file:///" + absPath.replace(/\\/g, '/');
    cap.innerText = caption;
    over.style.display = "flex";
}

function CloseViewer() {
    document.getElementById("viewerOverlay").style.display = "none";
}

// ==================================================================
// FASE 6: ENGINE "IL RAGIONIERE AUTOMATICO" - EXPORT FISCALE RAPIDO
// ==================================================================
function GeneraPacchettoFiscale() {
    var anno = document.getElementById("cmbAnnoReport").value;
    
    if (!confirm("Desideri generare il Pacchetto Fiscale per l'anno " + anno + " sul Desktop?\n\nVerranno raccolte e rinominate tutte le foto delle ricevute e creato un report Excel automatico.")) {
        return;
    }

    try {
        var shell = new ActiveXObject("WScript.Shell");
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        
        // 1. Ottieni il percorso del Desktop
        var desktop = shell.SpecialFolders("Desktop");
        var rootFolderName = "PACCHETTO_FISCALE_CM_" + anno;
        var destPath = desktop + "\\" + rootFolderName;

        // 2. Crea Cartella Principale e Sottocartella Allegati
        if (!fso.FolderExists(destPath)) fso.CreateFolder(destPath);
        
        var destAllegati = destPath + "\\Allegati_Spese";
        if (!fso.FolderExists(destAllegati)) fso.CreateFolder(destAllegati);

        // 3. Recupera percorso Root Applicazione per trovare file sorgente
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var appRoot = fso.GetParentFolderName(p);

        // 4. Crea il file CSV Riepilogativo (ANSI per Excel Italiano)
        var csvPath = destPath + "\\Riepilogo_Spese_" + anno + ".csv";
        var csvFile = fso.CreateTextFile(csvPath, true);
        
        // Intestazione CSV con separatore punto e virgola per Excel IT
        csvFile.WriteLine("DATA;TIPO_SPESA;DESCRIZIONE;IMPORTO_EURO;NOTE;NOME_FILE_ALLEGATO");

        var countFileCopiati = 0;
        var countErrori = 0;

        // -------------------------------------------------------------------
        // SEZIONE A: ELABORAZIONE RIFORNIMENTI
        // -------------------------------------------------------------------
        var sqlRif = "SELECT ID, DataRifornimento, CostoTotale, Note, PathAllegato FROM tblRifornimenti WHERE DataRifornimento LIKE '" + anno + "-%' ORDER BY DataRifornimento ASC";
        var rawRif = queryAccessDB(sqlRif) || [];

        for (var i = 0; i < rawRif.length; i++) {
            var rif = rawRif[i];
            var dataPulita = (rif.DataRifornimento || "").replace(/-/g, "_");
            var fileDestName = "RIF_";

            var copyRif = "";
            if (rif.PathAllegato && rif.PathAllegato !== "") {
                var ext = "";
                if (rif.PathAllegato.lastIndexOf(".") !== -1) {
                    ext = rif.PathAllegato.substring(rif.PathAllegato.lastIndexOf(".")).toLowerCase();
                }
                var newFileName = dataPulita + "_RIFORNIMENTO_ID" + rif.ID + ext;
                
                var sourceFull = appRoot + "\\" + rif.PathAllegato;
                var destFull = destAllegati + "\\" + newFileName;

                try {
                    if (fso.FileExists(sourceFull)) {
                        fso.CopyFile(sourceFull, destFull, true);
                        copyRif = newFileName;
                        countFileCopiati++;
                    }
                } catch(err) { countErrori++; }
            }

            // Scrivi riga CSV
            var csvLine = dbToItDate(rif.DataRifornimento) + ";" +
                          "CARBURANTE;" +
                          "Rifornimento Carburante;" +
                          (rif.CostoTotale ? rif.CostoTotale.toString().replace(".", ",") : "0") + ";" +
                          (rif.Note ? rif.Note.replace(/;/g, " ") : "") + ";" +
                          copyRif;
            csvFile.WriteLine(csvLine);
        }

        // -------------------------------------------------------------------
        // SEZIONE B: ELABORAZIONE SPESE MANUTENZIONE
        // -------------------------------------------------------------------
        var sqlSpe = "SELECT ID, DataIntervento, Descrizione, Costo, TipoIntervento, Note, PathAllegato FROM tblSpeseVeicolo WHERE DataIntervento LIKE '" + anno + "-%' ORDER BY DataIntervento ASC";
        var rawSpe = queryAccessDB(sqlSpe) || [];

        for (var j = 0; j < rawSpe.length; j++) {
            var spe = rawSpe[j];
            var dataPulitaS = (spe.DataIntervento || "").replace(/-/g, "_");
            
            var copySpe = "";
            if (spe.PathAllegato && spe.PathAllegato !== "") {
                var extS = "";
                if (spe.PathAllegato.lastIndexOf(".") !== -1) {
                    extS = spe.PathAllegato.substring(spe.PathAllegato.lastIndexOf(".")).toLowerCase();
                }
                var newFileNameS = dataPulitaS + "_SPESA_ID" + spe.ID + extS;
                
                var sourceFullS = appRoot + "\\" + spe.PathAllegato;
                var destFullS = destAllegati + "\\" + newFileNameS;

                try {
                    if (fso.FileExists(sourceFullS)) {
                        fso.CopyFile(sourceFullS, destFullS, true);
                        copySpe = newFileNameS;
                        countFileCopiati++;
                    }
                } catch(err) { countErrori++; }
            }

            // Scrivi riga CSV
            var csvLineS = dbToItDate(spe.DataIntervento) + ";" +
                           "MANUTENZIONE (" + (spe.TipoIntervento || "ORD") + ");" +
                           (spe.Descrizione ? spe.Descrizione.replace(/;/g, " ") : "") + ";" +
                           (spe.Costo ? spe.Costo.toString().replace(".", ",") : "0") + ";" +
                           (spe.Note ? spe.Note.replace(/;/g, " ") : "") + ";" +
                           copySpe;
            csvFile.WriteLine(csvLineS);
        }

        csvFile.Close();

        // 5. NOTIFICA ED APERTURA CARTELLA
        var msg = "🚀 PACCHETTO FISCALE CREATO CON SUCCESSO!\n\n" +
                  "📅 Anno: " + anno + "\n" +
                  "📄 Report Excel (CSV): Generato\n" +
                  "📂 Ricevute copiate e rinominate: " + countFileCopiati + "\n\n" +
                  "Troverai tutto sul tuo Desktop nella cartella:\n[" + rootFolderName + "]\n\nOra la aprirò automaticamente per te.";
        
        alert(msg);

        // Apri Cartella
        shell.Run("explorer.exe \"" + destPath + "\"");

    } catch (globalErr) {
        alert("Errore durante la generazione del pacchetto:\n" + globalErr.message);
    }
}

// ==================================================================
// FASE 6: ENGINE "GEOGRAPHICAL HEATMAP" - VISUALIZZAZIONE SPAZIALE
// ==================================================================
var mainLeafletMap = null;
var heatLayer = null;

var PUGLIA_GEO_DICTIONARY = {
    'BARI': [41.1171, 16.8719],
    'ANDRIA': [41.2319, 16.2986],
    'FOGGIA': [41.4622, 15.5446],
    'TARANTO': [40.4725, 17.2432],
    'ALTAMURA': [40.8270, 16.5536],
    'BARLETTA': [41.3169, 16.2820],
    'CASSANO DELLE MURGE': [40.8931, 16.7631],
    'GRAVINA IN PUGLIA': [40.8189, 16.4191],
    'TRANI': [41.2710, 16.4155],
    'GROTTAGLIE': [40.5369, 17.4306],
    'MODUGNO': [41.0923, 16.7804],
    'MARTINA FRANCA': [40.7043, 17.3378],
    'BISCEGLIE': [41.2426, 16.5029],
    'BITONTO': [41.1098, 16.6886],
    'SANTERAMO IN COLLE': [40.7949, 16.7591],
    'MOLFETTA': [41.1994, 16.5966],
    'LECCE': [40.3515, 18.1750],
    'BRINDISI': [40.6327, 17.9361],
    'MONOPOLI': [40.9523, 17.2995],
    'CONVERSANO': [40.9681, 17.1147],
    'GIOIA DEL COLLE': [40.7997, 16.9233],
    'CORATO': [41.1453, 16.4184],
    'TERLIZZI': [41.1324, 16.5441],
    'PALO DEL COLLE': [41.0576, 16.7036],
    'RUTIGLIANO': [40.9991, 17.0024],
    'CASAMASSIMA': [40.9567, 16.9187],
    'PUTIGNANO': [40.8496, 17.1216],
    'NOICATTARO': [41.0318, 16.9835],
    'NOCI': [40.7925, 17.1250],
    'ALBEROBELLO': [40.7834, 17.2366],
    'CERIGNOLA': [41.2653, 15.8987],
    'MANFREDONIA': [41.6287, 15.9142],
    'LUCERA': [41.5086, 15.3374],
    'SAN SEVERO': [41.6862, 15.3823]
};

function RenderMappaHeatmap() {
    if (!window.L) {
        alert("Caricamento del motore cartografico Leaflet in corso, riprova tra qualche secondo.");
        return;
    }

    var container = document.getElementById("mapContainer");
    if (!container) return;

    // 1. Inizializza Mappa Se Non Esiste
    if (mainLeafletMap === null) {
        mainLeafletMap = L.map('mapContainer').setView([41.0000, 16.6000], 8);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(mainLeafletMap);
    } else {
        // Forza re-layout se già esistente per via del rendering dinamico del tab
        mainLeafletMap.invalidateSize();
    }

    // 2. Rimuove il livello heatmap precedente se esistente
    if (heatLayer) {
        mainLeafletMap.removeLayer(heatLayer);
        heatLayer = null;
    }

    // 3. Query Densità Consegne
    var anno = document.getElementById("cmbAnnoReport").value;
    var sql = "SELECT LocalitaConsegna, COUNT(*) as TotConsegne FROM tblConsegne WHERE DataConsegna LIKE '" + anno + "-%' GROUP BY LocalitaConsegna";
    var rawData = queryAccessDB(sql) || [];

    if (rawData.length === 0) {
        return; // Nessuna consegna per questo anno
    }

    // 4. Elaborazione Coordinate e Pesi
    var heatPoints = [];
    var maxVal = 1;
    for(var i=0; i<rawData.length; i++) {
        if (rawData[i].TotConsegne > maxVal) maxVal = rawData[i].TotConsegne;
    }

    var markerGroup = []; // Per centrare la mappa
    var countMatched = 0;

    for (var j = 0; j < rawData.length; j++) {
        var entry = rawData[j];
        var cittaClean = (entry.LocalitaConsegna || "").toUpperCase().trim();
        var cont = parseFloat(entry.TotConsegne) || 0;

        // Risoluzione coordinate
        var coords = PUGLIA_GEO_DICTIONARY[cittaClean];
        if (coords) {
            // Normalizzazione peso: [Lat, Lng, Intensità (0-1)]
            var intensita = cont / maxVal;
            // Aggiungi un minimo di visibilità
            if (intensita < 0.3) intensita = 0.3; 
            
            heatPoints.push([coords[0], coords[1], intensita]);
            markerGroup.push([coords[0], coords[1]]);
            countMatched++;
        }
    }

    // 5. Disegna Heatmap
    if (heatPoints.length > 0 && window.L.heatLayer) {
        heatLayer = L.heatLayer(heatPoints, {
            radius: 35,      // Raggio dell'onda di calore
            blur: 20,        // Sfumatura
            maxZoom: 10,
            gradient: {0.3: 'blue', 0.5: 'cyan', 0.7: 'lime', 0.9: 'yellow', 1.0: 'red'}
        }).addTo(mainLeafletMap);

        // Centra la mappa automaticamente sul baricentro delle consegne trovate
        if (markerGroup.length > 0) {
             mainLeafletMap.fitBounds(markerGroup, { padding: [50, 50] });
        }
    }
}

// ==================================================================
// NAVIGAZIONE DI RITORNO (COLLEGAMENTO ALLA DASHBOARD)
// ==================================================================
function RiapriDashboard() {
    if (window.dashboardLaunched) return;
    window.dashboardLaunched = true;
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var currentDir = fso.GetParentFolderName(p);
        var dashboardPath = fso.BuildPath(currentDir, "dashboard.hta");
        if (!fso.FileExists(dashboardPath)) dashboardPath = fso.BuildPath(currentDir, "dashboard.html");
        
        shell.Run('mshta.exe "' + dashboardPath + '"', 1, false);
    } catch(e) {}
}

window.onbeforeunload = function() {
    RiapriDashboard();
};

// ==================================================================
// GESTIONE FINESTRA MANUALE D'USO
// ==================================================================
function OpenHelpModal() {
    var modal = document.getElementById("helpModalOverlay");
    if(modal) modal.style.display = "flex";
}

function CloseHelpModal() {
    var modal = document.getElementById("helpModalOverlay");
    if(modal) modal.style.display = "none";
}
