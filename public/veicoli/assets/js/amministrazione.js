/* amministrazione.js - Portale Supervisore Gold Edition */

var AmministrazioneManager = {
    titolareFiltro: "all",
    scadenzeData: {},
    
    inizializza: function() {
        this.caricaScadenze();
    },
    
    apri: function() {
        document.getElementById("amministrazioneModal").style.display = "block";
        this.cambiaTab("bustePaga");
        this.caricaBustePaga();
        this.caricaScadenzeView();
        this.caricaAnalisiMargini();
        if(typeof Parla === "function") Parla("Cruscotto di controllo amministrativo caricato.");
        AggiungiLog("ADMIN", "Apertura cruscotto amministrativo integrato", "success");
    },
    
    chiudi: function() {
        document.getElementById("amministrazioneModal").style.display = "none";
        if(typeof TornaInPrimoPiano === "function") TornaInPrimoPiano();
    },
    
    cambiaTab: function(tabId) {
        var tabs = ["bustePaga", "scadenzeFlotta", "analisiMargini", "infoSistema"];
        for(var i=0; i<tabs.length; i++) {
            var btn = document.getElementById("tabBtn_" + tabs[i]);
            var pane = document.getElementById("tabPane_" + tabs[i]);
            if(btn) btn.className = "admin-tab-btn" + (tabs[i] === tabId ? " active" : "");
            if(pane) pane.className = "admin-tab-pane" + (tabs[i] === tabId ? " active" : "");
        }
    },
    
    ottieniUltimoPercorsoBustePaga: function(rootPath) {
        var latestFile = "";
        try {
            if (fso && typeof Enumerator !== "undefined") {
                var folder = fso.GetFolder(rootPath);
                var files = new Enumerator(folder.Files);
                var latestDateStr = "";
                for (; !files.atEnd(); files.moveNext()) {
                    var file = files.item();
                    var name = file.Name;
                    if (name.indexOf("registro_buste_paga_") === 0 && name.indexOf(".json") !== -1) {
                        var dateStr = name.replace("registro_buste_paga_", "").replace(".json", "");
                        if (dateStr > latestDateStr) {
                            latestDateStr = dateStr;
                            latestFile = file.Path;
                        }
                    }
                }
            }
        } catch(e) {}
        if (!latestFile) {
            latestFile = fso.BuildPath(rootPath, "registro_buste_paga_2026-07-04.json");
        }
        return latestFile;
    },
    
    /* === TAB 1: REGISTRO BUSTE PAGA & TFR === */
    caricaBustePaga: function() {
        var payslips = [];
        try {
            var dbPath = this.ottieniUltimoPercorsoBustePaga(root);
            if (fso.FileExists(dbPath)) {
                var file = fso.OpenTextFile(dbPath, 1);
                var content = file.ReadAll();
                file.Close();
                payslips = eval("(" + content + ")");
            }
        } catch(e) {
            AggiungiLog("ADMIN", "Errore lettura registro buste paga: " + e.message, "error");
        }
        
        var select = document.getElementById("adminBusteDipendente");
        var valSelected = select ? select.value : "all";
        
        // Trova titolari unici
        var titolari = {};
        for(var i=0; i<payslips.length; i++) {
            var t = payslips[i].titolare || "CIRO MILELLA";
            titolari[t] = true;
        }
        
        if (select) {
            select.innerHTML = '<option value="all">-- Tutti i Dipendenti --</option>';
            for(var key in titolari) {
                var opt = document.createElement("option");
                opt.value = key;
                opt.innerText = key;
                if(key === valSelected) opt.selected = true;
                select.appendChild(opt);
            }
        }
        
        // Filtra e calcola KPI
        var filtered = [];
        var totNetto = 0;
        var totRimborsi = 0;
        var totTfr = 0;
        
        for(var i=0; i<payslips.length; i++) {
            var slip = payslips[i];
            var t = slip.titolare || "CIRO MILELLA";
            
            if(valSelected !== "all" && t !== valSelected) continue;
            
            filtered.push(slip);
            
            // Parsifica stringhe numeriche formattate all'italiana (es. "1.136,45")
            var nettoVal = parseFloat((slip.netto || "0").replace(/\./g, "").replace(",", ".")) || 0;
            var rimborsiVal = parseFloat((slip.rimborsi || "0").replace(/\./g, "").replace(",", ".")) || 0;
            var tfrVal = parseFloat((slip.tfrTotale || "0").replace(/\./g, "").replace(",", ".")) || 0;
            
            totNetto += nettoVal;
            totRimborsi += rimborsiVal;
            if (tfrVal > 0) {
                // Prendi il valore massimo come TFR totale accumulato
                if(tfrVal > totTfr) totTfr = tfrVal;
            }
        }
        
        // Se non abbiamo dipendente singolo, somma i TFR massimi di ciascuno
        if(valSelected === "all") {
            totTfr = 0;
            for(var key in titolari) {
                var maxTDip = 0;
                for(var i=0; i<payslips.length; i++) {
                    var slip = payslips[i];
                    var t = slip.titolare || "CIRO MILELLA";
                    if(t === key) {
                        var tfrVal = parseFloat((slip.tfrTotale || "0").replace(/\./g, "").replace(",", ".")) || 0;
                        if(tfrVal > maxTDip) maxTDip = tfrVal;
                    }
                }
                totTfr += maxTDip;
            }
        }
        
        // Popola KPI card
        document.getElementById("kpiTotalNetto").innerText = "€ " + totNetto.toLocaleString("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById("kpiTotalRimborsi").innerText = "€ " + totRimborsi.toLocaleString("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById("kpiTotalTFR").innerText = "€ " + totTfr.toLocaleString("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        // Aggiorna anche la bacheca del portale se presente il KPI card
        var lblTfrPortal = document.getElementById("lblTfrVal");
        if(lblTfrPortal) {
            lblTfrPortal.innerText = "€ " + totTfr.toLocaleString("it-IT", {maximumFractionDigits: 0});
            var lblTfrSub = document.getElementById("lblTfrSub");
            if(lblTfrSub) lblTfrSub.innerText = "FONDO ACCUMULATO FLOTTA";
        }
        
        // Popola Tabella Buste Paga
        var tbody = document.getElementById("adminBusteTableBody");
        var html = "";
        
        // Ordina per data/mese decrescente (timestamp decrescente)
        filtered.sort(function(a, b) {
            return (b.timestamp || 0) - (a.timestamp || 0);
        });
        
        var limit = Math.min(filtered.length, 30);
        for(var i=0; i<limit; i++) {
            var slip = filtered[i];
            html += "<tr>";
            html += "  <td style='font-weight:bold; color:#ffe066;'>" + (slip.mese || "N.D.") + "</td>";
            html += "  <td>" + (slip.titolare || "CIRO MILELLA") + "</td>";
            html += "  <td style='color:#4ade80;'>€ " + (slip.netto || "0,00") + "</td>";
            html += "  <td>€ " + (slip.rimborsi || "0,00") + "</td>";
            html += "  <td>€ " + (slip.tfrTotale || "0,00") + "</td>";
            html += "  <td>" + (slip.ferieResidue || "0,00") + " gg</td>";
            html += "  <td style='text-align:center;'><span onclick='eliminaBustaPaga(\"" + (slip.mese || "") + "\", \"" + (slip.titolare || "") + "\")' style='cursor:pointer; color:#ef4444; font-size:14px; opacity:0.6; transition:opacity 0.2s;' onmouseover='this.style.opacity=1' onmouseout='this.style.opacity=0.6' title='Elimina questa busta paga'>🗑️</span></td>";
            html += "</tr>";
        }
        
        if(filtered.length === 0) {
            html = "<tr><td colspan='7' style='text-align:center; color:#94a3b8;'>Nessuna busta paga trovata.</td></tr>";
        }
        
        if (tbody) tbody.innerHTML = html;
    },
    
    /* === TAB 2: SCADENZE FLOTTA === */
    caricaScadenze: function() {
        try {
            var path = fso.BuildPath(root, "File_Sistema\\scadenze_flotta.json");
            if(fso.FileExists(path)) {
                var file = fso.OpenTextFile(path, 1);
                var content = file.ReadAll();
                file.Close();
                this.scadenzeData = eval("(" + content + ")");
            } else {
                this.scadenzeData = {};
            }
        } catch(e) {
            this.scadenzeData = {};
        }
    },
    
    salvaScadenze: function() {
        try {
            var path = fso.BuildPath(root, "File_Sistema\\scadenze_flotta.json");
            var file = fso.CreateTextFile(path, true);
            file.Write(JSON.stringify(this.scadenzeData, null, 2));
            file.Close();
            AggiungiLog("ADMIN", "Scadenze flotta salvate con successo", "success");
            ToastManager.success("Scadenze aggiornate correttamente.");
        } catch(e) {
            AggiungiLog("ADMIN", "Errore salvataggio scadenze: " + e.message, "error");
        }
    },
    
    caricaScadenzeView: function() {
        var fleet = [];
        if(typeof LeggiFlottaDB === "function") {
            fleet = LeggiFlottaDB();
        } else {
            fleet = [{ driver: "CIRO MILELLA", id: "FG945VW" }];
        }
        
        var tbody = document.getElementById("adminScadenzeTableBody");
        var html = "";
        var oggi = new Date();
        
        for(var i=0; i<fleet.length; i++) {
            var vehicle = fleet[i];
            var key = vehicle.id || vehicle.driver;
            var scadenze = this.scadenzeData[key] || { bollo: "", assicurazione: "", revisione: "", cqc: "" };
            
            html += "<tr>";
            html += "  <td style='font-weight:bold; color:#ffe066;'>" + vehicle.driver + " (" + vehicle.id + ")</td>";
            
            // Bollo
            html += "  <td>" + this.creaScadenzaCella(key, 'bollo', scadenze.bollo, oggi) + "</td>";
            // Assicurazione
            html += "  <td>" + this.creaScadenzaCella(key, 'assicurazione', scadenze.assicurazione, oggi) + "</td>";
            // Revisione
            html += "  <td>" + this.creaScadenzaCella(key, 'revisione', scadenze.revisione, oggi) + "</td>";
            // CQC
            html += "  <td>" + this.creaScadenzaCella(key, 'cqc', scadenze.cqc, oggi) + "</td>";
            
            html += "  <td><button class='btn-gold' style='padding:4px 8px; font-size:10px;' onclick='AmministrazioneManager.modificaScadenzaRow(\"" + key + "\")'>✏️ Salva</button></td>";
            html += "</tr>";
        }
        
        if (tbody) tbody.innerHTML = html;
    },
    
    creaScadenzaCella: function(key, tipo, dataStr, oggi) {
        var colorClass = "green";
        var diffDays = 999;
        
        if (dataStr) {
            var scad = new Date(dataStr);
            var timeDiff = scad.getTime() - oggi.getTime();
            diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (diffDays <= 0) {
                colorClass = "red";
            } else if (diffDays <= 30) {
                colorClass = "yellow";
            }
        } else {
            colorClass = "red";
            diffDays = "N.D.";
        }
        
        var dataVal = dataStr || "";
        var inputId = "scad_" + key + "_" + tipo;
        
        var displayDiff = (diffDays === "N.D.") ? "Non Impostata" : (diffDays <= 0 ? "SCADUTA (" + Math.abs(diffDays) + " gg fa)" : diffDays + " gg rimasti");
        
        return "<span class='status-light " + colorClass + "'></span>" +
               "<input type='date' id='" + inputId + "' value='" + dataVal + "' class='admin-input' style='width:115px; margin-bottom:2px; font-size:10px;'><br>" +
               "<span style='font-size:9px; color:#94a3b8;'>" + displayDiff + "</span>";
    },
    
    modificaScadenzaRow: function(key) {
        var types = ['bollo', 'assicurazione', 'revisione', 'cqc'];
        if(!this.scadenzeData[key]) this.scadenzeData[key] = {};
        
        for(var i=0; i<types.length; i++) {
            var el = document.getElementById("scad_" + key + "_" + types[i]);
            if (el) {
                this.scadenzeData[key][types[i]] = el.value;
            }
        }
        
        this.salvaScadenze();
        this.caricaScadenzeView();
    },
    
    /* === TAB 3: ANALISI MARGINI CONSEGNE === */
    caricaAnalisiMargini: function() {
        var consegne = [];
        if(typeof LeggiConsegneDB === "function") {
            consegne = LeggiConsegneDB();
        }
        
        var totRevenues = 0;
        var totCosts = 0;
        var driverStats = {};
        var localitaStats = {};
        
        for(var i=0; i<consegne.length; i++) {
            var c = consegne[i];
            
            // Calcolo simulato costi / ricavi basati sulla merce e localita
            var loc = c.localita || c.localitaconsegna || "Bari";
            var merce = c.merce || "";
            var autista = c.autista || "Non Assegnato";
            
            // Formula deterministica per simulare dati realistici coerenti
            var cost = 30 + (loc.length * 3) + Math.abs(c.id % 5) * 8;
            var revenue = 90 + (merce.length * 4) + Math.abs(c.id % 7) * 15;
            var margin = revenue - cost;
            
            totRevenues += revenue;
            totCosts += cost;
            
            // Raggruppamento per autista
            if(!driverStats[autista]) driverStats[autista] = { consegne: 0, costi: 0, ricavi: 0 };
            driverStats[autista].consegne++;
            driverStats[autista].costi += cost;
            driverStats[autista].ricavi += revenue;
            
            // Raggruppamento per località
            if(!localitaStats[loc]) localitaStats[loc] = { consegne: 0, costi: 0, ricavi: 0 };
            localitaStats[loc].consegne++;
            localitaStats[loc].costi += cost;
            localitaStats[loc].ricavi += revenue;
        }
        
        var totMargin = totRevenues - totCosts;
        var profitMarginPct = totRevenues > 0 ? (totMargin / totRevenues) * 100 : 0;
        
        document.getElementById("kpiTotalRicavi").innerText = "€ " + totRevenues.toLocaleString("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById("kpiTotalCostiConsegne").innerText = "€ " + totCosts.toLocaleString("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById("kpiMarginePercentuale").innerText = profitMarginPct.toFixed(1) + "%";
        
        // Popola analisi per Autista
        var tbodyDriver = document.getElementById("adminMarginiAutistaTable");
        var htmlDriver = "";
        for(var name in driverStats) {
            var stat = driverStats[name];
            var marg = stat.ricavi - stat.costi;
            var pct = stat.ricavi > 0 ? (marg / stat.ricavi) * 100 : 0;
            htmlDriver += "<tr>";
            htmlDriver += "  <td style='font-weight:bold; color:#ffe066;'>" + name + "</td>";
            htmlDriver += "  <td>" + stat.consegne + "</td>";
            htmlDriver += "  <td>€ " + stat.ricavi.toFixed(2) + "</td>";
            htmlDriver += "  <td style='color:#ef4444;'>€ " + stat.costi.toFixed(2) + "</td>";
            htmlDriver += "  <td style='color:#4ade80; font-weight:bold;'>€ " + marg.toFixed(2) + " (" + pct.toFixed(0) + "%)</td>";
            htmlDriver += "</tr>";
        }
        if(htmlDriver === "") {
            htmlDriver = "<tr><td colspan='5' style='text-align:center; color:#94a3b8;'>Nessuna consegna caricata per analisi.</td></tr>";
        }
        if (tbodyDriver) tbodyDriver.innerHTML = htmlDriver;
        
        // Popola analisi per Località
        var tbodyLoc = document.getElementById("adminMarginiLocalitaTable");
        var htmlLoc = "";
        var count = 0;
        for(var loc in localitaStats) {
            if(count++ >= 8) break; // Limita a top 8
            var stat = localitaStats[loc];
            var marg = stat.ricavi - stat.costi;
            var pct = stat.ricavi > 0 ? (marg / stat.ricavi) * 100 : 0;
            htmlLoc += "<tr>";
            htmlLoc += "  <td style='font-weight:bold; color:#ffe066;'>" + loc + "</td>";
            htmlLoc += "  <td>" + stat.consegne + "</td>";
            htmlLoc += "  <td>€ " + stat.ricavi.toFixed(2) + "</td>";
            htmlLoc += "  <td style='color:#ef4444;'>€ " + stat.costi.toFixed(2) + "</td>";
            htmlLoc += "  <td style='color:#4ade80; font-weight:bold;'>€ " + marg.toFixed(2) + " (" + pct.toFixed(0) + "%)</td>";
            htmlLoc += "</tr>";
        }
        if(htmlLoc === "") {
            htmlLoc = "<tr><td colspan='5' style='text-align:center; color:#94a3b8;'>Nessuna località caricata.</td></tr>";
        }
        if (tbodyLoc) tbodyLoc.innerHTML = htmlLoc;
    }
};

// Inizializzazione automatica
AmministrazioneManager.inizializza();

// Caricamento dei KPI periodico sulla sidebar/bacheca principale
setTimeout(function() {
    
    // Esegui caricamento iniziale per aggiornare il KPI TFR nella sidebar principale
    try {
        AmministrazioneManager.caricaScadenze();
        
        // Leggi buste paga per valorizzare il box TFR & Ferie in tempo reale sulla sidebar del supervisore
        var payslips = [];
        var dbPath = AmministrazioneManager.ottieniUltimoPercorsoBustePaga(root);
        if (fso.FileExists(dbPath)) {
            var file = fso.OpenTextFile(dbPath, 1);
            var content = file.ReadAll();
            file.Close();
            payslips = eval("(" + content + ")");
        }
        
        var totTfr = 0;
        var titolari = {};
        for(var i=0; i<payslips.length; i++) {
            var t = payslips[i].titolare || "CIRO MILELLA";
            titolari[t] = true;
        }
        
        for(var key in titolari) {
            var maxTDip = 0;
            for(var i=0; i<payslips.length; i++) {
                var slip = payslips[i];
                var t = slip.titolare || "CIRO MILELLA";
                if(t === key) {
                    var tfrVal = parseFloat((slip.tfrTotale || "0").replace(/\./g, "").replace(",", ".")) || 0;
                    if(tfrVal > maxTDip) maxTDip = tfrVal;
                }
            }
            totTfr += maxTDip;
        }
        
        var lblTfrPortal = document.getElementById("lblTfrVal");
        if(lblTfrPortal) {
            lblTfrPortal.innerText = "€ " + totTfr.toLocaleString("it-IT", {maximumFractionDigits: 0});
            var lblTfrSub = document.getElementById("lblTfrSub");
            if(lblTfrSub) lblTfrSub.innerText = "FONDO ACCUMULATO FLOTTA";
        }
    } catch(ex) {}
}, 1000);

// Funzione globale per eliminare una busta paga
function eliminaBustaPaga(mese, titolare) {
    var conferma = confirm("Vuoi davvero eliminare la busta paga di " + mese + " (" + titolare + ")?");
    if (!conferma) return;
    
    try {
        var dbPath = AmministrazioneManager.ottieniUltimoPercorsoBustePaga(root);
        var payslips = [];
        
        if (fso.FileExists(dbPath)) {
            var file = fso.OpenTextFile(dbPath, 1);
            var content = file.ReadAll();
            file.Close();
            payslips = eval("(" + content + ")");
        }
        
        // Filtra rimuovendo la busta paga corrispondente
        var newPayslips = [];
        for (var i = 0; i < payslips.length; i++) {
            if (!(payslips[i].mese === mese && (payslips[i].titolare || "CIRO MILELLA") === titolare)) {
                newPayslips.push(payslips[i]);
            }
        }
        
        // Salva il JSON aggiornato
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, "0");
        var dd = String(today.getDate()).padStart(2, "0");
        var newJsonName = "registro_buste_paga_" + yyyy + "-" + mm + "-" + dd + ".json";
        var newJsonPath = fso.BuildPath(root, newJsonName);
        
        var jsonOutput = JSON.stringify(newPayslips, null, 2);
        var outFile = fso.CreateTextFile(newJsonPath, true);
        outFile.Write(jsonOutput);
        outFile.Close();
        
        // Rimuovi vecchi JSON
        try {
            var folder = fso.GetFolder(root);
            var files = new Enumerator(folder.Files);
            for (; !files.atEnd(); files.moveNext()) {
                var f = files.item();
                if (f.Name.indexOf("registro_buste_paga_") === 0 && f.Name.indexOf(".json") !== -1 && f.Name !== newJsonName) {
                    fso.DeleteFile(f.Path, true);
                }
            }
        } catch(e2) {}
        
        // Ricarica tabella e KPI
        AmministrazioneManager.caricaBustePaga();
        
        if (typeof ToastManager !== "undefined") ToastManager.success("Busta paga di " + mese + " eliminata.");
        if (typeof AggiungiLog === "function") AggiungiLog("ADMIN", "Eliminata busta paga: " + mese + " (" + titolare + ")", "warning");
        
    } catch(e) {
        if (typeof ToastManager !== "undefined") ToastManager.error("Errore eliminazione: " + e.message);
    }
}

// ============================================================
// INTEGRAZIONE CARICAMENTO PDF BUSTE PAGA NEL CRUSCOTTO
// ============================================================

(function() {
    var adminPendingData = null;
    
    function initBustaPagaUpload() {
        var dropzone = document.getElementById("adminPdfDropzone");
        var fileInput = document.getElementById("adminPdfInput");
        var confirmModal = document.getElementById("adminBustaConfirmModal");
        var extractedDataEl = document.getElementById("adminExtractedData");
        var btnConfirm = document.getElementById("adminBtnConfirmSave");
        var btnCancel = document.getElementById("adminBtnCancelSave");
        
        if (!dropzone || !fileInput) return;
        
        // Click sulla dropzone apre il file picker
        dropzone.addEventListener("click", function(e) {
            e.stopPropagation();
            fileInput.click();
        });
        
        fileInput.addEventListener("click", function(e) { e.stopPropagation(); });
        
        // File selezionato tramite picker
        fileInput.addEventListener("change", function(e) {
            if (e.target.files.length > 0) {
                processMultiplePdfFiles(Array.from(e.target.files));
            }
        });
        
        // Drag & Drop
        dropzone.addEventListener("dragover", function(e) {
            e.preventDefault();
            dropzone.style.borderColor = "rgba(212,175,55,0.7)";
            dropzone.style.background = "rgba(212,175,55,0.1)";
        });
        
        dropzone.addEventListener("dragenter", function(e) {
            e.preventDefault();
            dropzone.style.borderColor = "rgba(212,175,55,0.7)";
            dropzone.style.background = "rgba(212,175,55,0.1)";
        });
        
        dropzone.addEventListener("dragleave", function() {
            dropzone.style.borderColor = "rgba(255,255,255,0.1)";
            dropzone.style.background = "rgba(0,0,0,0.2)";
        });
        
        dropzone.addEventListener("drop", function(e) {
            e.preventDefault();
            dropzone.style.borderColor = "rgba(255,255,255,0.1)";
            dropzone.style.background = "rgba(0,0,0,0.2)";
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processMultiplePdfFiles(Array.from(e.dataTransfer.files));
            }
        });
        
        // Pulsanti conferma/annulla
        if (btnConfirm) {
            btnConfirm.addEventListener("click", function() {
                if (adminPendingData) {
                    salvaBustePagaNelRegistro(adminPendingData);
                    adminPendingData = null;
                    confirmModal.style.display = "none";
                    var statusEl = document.getElementById("adminUploadStatus");
                    if (statusEl) { statusEl.style.color = "#4ade80"; statusEl.textContent = "Dati salvati con successo!"; }
                    setTimeout(function() { if (statusEl) statusEl.textContent = ""; }, 4000);
                    // Ricarica la tabella e i KPI
                    AmministrazioneManager.caricaBustePaga();
                    if (typeof ToastManager !== "undefined") ToastManager.success("Busta paga salvata nel registro!");
                }
            });
        }
        
        if (btnCancel) {
            btnCancel.addEventListener("click", function() {
                adminPendingData = null;
                confirmModal.style.display = "none";
                var statusEl = document.getElementById("adminUploadStatus");
                if (statusEl) statusEl.textContent = "Operazione annullata.";
            });
        }
    }
    
    // Elaborazione multipla PDF
    async function processMultiplePdfFiles(files) {
        var total = files.length;
        var completed = 0;
        var allExtracted = [];
        
        var progressContainer = document.getElementById("adminUploadProgress");
        var progressBar = document.getElementById("adminUploadProgressBar");
        var progressText = document.getElementById("adminUploadProgressText");
        var statusEl = document.getElementById("adminUploadStatus");
        
        if (progressContainer) progressContainer.style.display = "block";
        if (progressText) { progressText.style.display = "block"; progressText.textContent = "Analisi in corso: 0 / " + total; }
        if (progressBar) progressBar.style.width = "0%";
        if (statusEl) { statusEl.style.color = "#d4af37"; statusEl.textContent = "Elaborazione file in corso..."; }
        
        for (var i = 0; i < files.length; i++) {
            try {
                var file = files[i];
                var buffer = await file.arrayBuffer();
                var typedarray = new Uint8Array(buffer);
                var pdf = await pdfjsLib.getDocument(typedarray).promise;
                
                for (var j = 1; j <= pdf.numPages; j++) {
                    var page = await pdf.getPage(j);
                    var textContent = await page.getTextContent();
                    var pageText = textContent.items.map(function(item) { return item.str; }).join(" ");
                    var pageData = extractDataFromPdfText(pageText, j);
                    if (pageData) allExtracted.push(pageData);
                }
            } catch (err) {
                console.error("Errore file:", files[i].name, err);
            }
            
            completed++;
            if (progressBar) progressBar.style.width = ((completed / total) * 100) + "%";
            if (progressText) progressText.textContent = "Analisi in corso: " + completed + " / " + total;
        }
        
        setTimeout(function() {
            if (progressContainer) progressContainer.style.display = "none";
            if (progressText) progressText.style.display = "none";
            
            if (allExtracted.length === 0) {
                if (statusEl) { statusEl.style.color = "#ef4444"; statusEl.textContent = ""; }
                if (typeof ToastManager !== "undefined") ToastManager.error("Nessun dato valido estratto dai file.");
                adminPendingData = null;
            } else {
                if (statusEl) statusEl.textContent = "";
                if (typeof ToastManager !== "undefined") ToastManager.success("Analisi completata! Trovate " + allExtracted.length + " buste paga.");
                adminPendingData = allExtracted;
                showBustaConfirmModal(allExtracted);
            }
        }, 600);
    }
    
    // Estrazione dati dal testo del PDF
    function extractDataFromPdfText(text, pageNum) {
        var lines = text.split("\n").map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        var textNormalized = lines.join("  ");
        
        var ferie = "0,00", rol = "0,00", festSoppr = "0,00";
        var tfrFondo = "0,00", tfrAnno = "0,00";
        var netto = "0,00", imponibileIrpef = "0,00", rimborsi = "0,00";
        var meseStr = "Sconosciuto", titolare = "CIRO MILELLA";
        
        // Titolare
        var nomeMatch = textNormalized.match(/([A-Z\s']+)\s+\d{2}\/\d{2}\/\d{4}/);
        if (nomeMatch) {
            var rawMatch = nomeMatch[1].trim();
            var parts = rawMatch.split(/\s+/).filter(function(p) { return /^[A-Z']+$/.test(p); });
            if (parts.length >= 2) titolare = parts.slice(-2).join(" ");
            else titolare = rawMatch;
        }
        
        // Mese e Anno
        var mesiRegex = /(Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre|Tredic\.ma|Quatt\.ma)\s+(202[3-9])/i;
        var meseMatch = textNormalized.match(mesiRegex);
        if (meseMatch) meseStr = meseMatch[1] + " " + meseMatch[2];
        else return null;
        
        // Imponibile IRPEF
        var irpefMatch = textNormalized.match(/IMPONIBILE\s*(?:IRPEF|FISCALE|FIS|IRP)[\s\S]*?([\d\.]+,\d{2})/i);
        if (irpefMatch) imponibileIrpef = irpefMatch[1];
        else {
            var irpefFallback = textNormalized.match(/(?:Imponibile\s*Irpef|Imponibile\s*fisc)[\s\S]*?([\d\.]+,\d{2})/i);
            if (irpefFallback) imponibileIrpef = irpefFallback[1];
        }
        
        // Netto in Busta
        var nMatch = textNormalized.match(/([\d\.]+,\d{2})(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?FIRMA\s*PER\s*QUIETANZA/i);
        if (nMatch) netto = nMatch[1];
        else {
            var fb1 = textNormalized.match(/PAGARE(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?([\d\.]+,\d{2})/i);
            if (fb1) netto = fb1[1];
            else {
                var fb2 = textNormalized.match(/BUSTA(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?([\d\.]+,\d{2})/i);
                if (fb2) netto = fb2[1];
                else {
                    var fb3 = textNormalized.match(/NETTO(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?([\d\.]+,\d{2})/i);
                    if (fb3) netto = fb3[1];
                }
            }
        }
        
        // Ferie
        var ferieM = textNormalized.match(/FERIE\s+gg\s+([\d,.\s]+)/);
        if (ferieM) ferie = ferieM[1].trim().split(/\s+/).pop();
        
        // ROL
        var rolM = textNormalized.match(/R\.O\.L\.\s+([\d,.\s]+)/);
        if (rolM) rol = rolM[1].trim().split(/\s+/).pop();
        
        // Festività Soppresse
        var festM = textNormalized.match(/FEST\.SOPPR\.\s+([\d,.\s]+)/);
        if (festM) festSoppr = festM[1].trim().split(/\s+/).pop();
        
        // TFR Fondo
        var tfrFondoM = textNormalized.match(/Fondo\s+Resid.*?([\d\.]+,\d{2})/i);
        if (tfrFondoM) tfrFondo = tfrFondoM[1];
        
        // TFR Anno
        var tfrAnnoM = textNormalized.match(/TFR\s+Imp\.\s+Anno\s+([\d\.]+,\d{2})/i);
        if (tfrAnnoM) tfrAnno = tfrAnnoM[1];
        
        // Rimborsi Spesa
        var rimbMatch = textNormalized.match(/142[\s\S]{1,30}?Rimborso[\s\S]*?([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?(?:\s+([\d\.]+,\d{2}))?/i) || textNormalized.match(/Rimborso\s*Spese[\s\S]*?([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?(?:\s+([\d\.]+,\d{2}))?/i);
        if (rimbMatch) {
            var nums = [rimbMatch[1], rimbMatch[2], rimbMatch[3]].filter(Boolean);
            rimborsi = nums[nums.length - 1];
        }
        
        // Calcolo TFR Totale
        var parseItaNum = function(str) { return parseFloat(str.replace(/\./g, "").replace(",", ".")); };
        var fondoNum = tfrFondo !== "0,00" ? parseItaNum(tfrFondo) : 0;
        var annoNum = tfrAnno !== "0,00" ? parseItaNum(tfrAnno) : 0;
        var totaleNum = fondoNum + annoNum;
        var totaleStr = totaleNum.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        return {
            id: "rec_" + Date.now() + "_" + pageNum,
            timestamp: Date.now(),
            mese: meseStr.toUpperCase(),
            titolare: titolare,
            netto: netto,
            rimborsi: rimborsi,
            ferieResidue: ferie,
            rolResidui: rol,
            festSopprResidue: festSoppr,
            tfrFondo: tfrFondo,
            tfrAnno: tfrAnno,
            tfrTotale: totaleStr,
            imponibileIrpef: imponibileIrpef
        };
    }
    
    // Mostra modale di conferma
    function showBustaConfirmModal(dataArray) {
        var confirmModal = document.getElementById("adminBustaConfirmModal");
        var extractedDataEl = document.getElementById("adminExtractedData");
        if (!confirmModal || !extractedDataEl) return;
        
        if (dataArray.length === 1) {
            var d = dataArray[0];
            extractedDataEl.innerHTML =
                "Titolare: <span style='color:#fff'>" + d.titolare + "</span><br>" +
                "Mese Rilevato: <span style='color:#fff'>" + d.mese + "</span><br>" +
                "Netto: <span style='color:#4ade80'>€ " + d.netto + "</span><br>" +
                "IRPEF Mese: <span style='color:#fff'>€ " + d.imponibileIrpef + "</span><br>" +
                "Ferie: <span style='color:#fff'>" + d.ferieResidue + " gg</span><br>" +
                "ROL: <span style='color:#fff'>" + d.rolResidui + " h</span> | Festività: <span style='color:#fff'>" + d.festSopprResidue + " h</span><br>" +
                "<strong style='color:#d4af37'>TFR Totale Stimato: € " + d.tfrTotale + "</strong><br>";
        } else {
            var last = dataArray[dataArray.length - 1];
            extractedDataEl.innerHTML =
                "<strong style='color:#4ade80'>RILEVATE " + dataArray.length + " BUSTE PAGA!</strong><br><br>" +
                "Titolare: <span style='color:#fff'>" + last.titolare + "</span><br>" +
                "Ultimo mese rilevato: <span style='color:#fff'>" + last.mese + "</span><br>" +
                "Ferie: <span style='color:#fff'>" + last.ferieResidue + " gg</span><br>" +
                "Permessi (ROL+Fest): <span style='color:#fff'>" + last.rolResidui + " + " + last.festSopprResidue + " h</span><br>" +
                "<strong style='color:#d4af37'>TFR Aggiornato: € " + last.tfrTotale + "</strong><br>" +
                "<br><span style='font-size:11px; color:#64748b'>Cliccando Salva, tutti i " + dataArray.length + " mesi verranno uniti allo storico in automatico.</span>";
        }
        
        confirmModal.style.display = "flex";
    }
    
    // Salva i dati nel JSON del registro
    function salvaBustePagaNelRegistro(dataArray) {
        try {
            var dbPath = AmministrazioneManager.ottieniUltimoPercorsoBustePaga(root);
            var payslips = [];
            
            // Leggi il database esistente
            if (fso.FileExists(dbPath)) {
                var file = fso.OpenTextFile(dbPath, 1);
                var content = file.ReadAll();
                file.Close();
                payslips = eval("(" + content + ")");
            }
            
            // Unisci i nuovi dati (sostituisci se mese duplicato)
            for (var i = 0; i < dataArray.length; i++) {
                var newD = dataArray[i];
                var found = false;
                for (var j = 0; j < payslips.length; j++) {
                    if (payslips[j].mese === newD.mese) {
                        payslips[j] = newD;
                        found = true;
                        break;
                    }
                }
                if (!found) payslips.push(newD);
            }
            
            // Genera il nuovo percorso con la data di oggi
            var today = new Date();
            var yyyy = today.getFullYear();
            var mm = String(today.getMonth() + 1).padStart(2, "0");
            var dd = String(today.getDate()).padStart(2, "0");
            var newJsonName = "registro_buste_paga_" + yyyy + "-" + mm + "-" + dd + ".json";
            var newJsonPath = fso.BuildPath(root, newJsonName);
            
            // Salva il JSON aggiornato
            var jsonOutput = JSON.stringify(payslips, null, 2);
            var outFile = fso.CreateTextFile(newJsonPath, true);
            outFile.Write(jsonOutput);
            outFile.Close();
            
            // Rimuovi i vecchi file JSON (tranne il nuovo)
            try {
                var folder = fso.GetFolder(root);
                var files = new Enumerator(folder.Files);
                for (; !files.atEnd(); files.moveNext()) {
                    var f = files.item();
                    if (f.Name.indexOf("registro_buste_paga_") === 0 && f.Name.indexOf(".json") !== -1 && f.Name !== newJsonName) {
                        fso.DeleteFile(f.Path, true);
                    }
                }
            } catch(e2) {}
            
            if (typeof AggiungiLog === "function") {
                AggiungiLog("ADMIN", "Salvate " + dataArray.length + " buste paga nel registro " + newJsonName, "success");
            }
            
        } catch(e) {
            if (typeof AggiungiLog === "function") {
                AggiungiLog("ADMIN", "Errore salvataggio buste paga: " + e.message, "error");
            }
        }
    }
    
    // Avvia l'inizializzazione quando il DOM è pronto
    setTimeout(initBustaPagaUpload, 1500);
})();
