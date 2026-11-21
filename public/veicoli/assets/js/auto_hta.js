var speseMemory = [];
var veicoliMemory = [];
var rifornimentiMemory = [];
var selectedSpesaIdx = -1;
var selectedVeicoloIdx = -1;
var selectedRifornimentoIdx = -1;
var currentTab = "spese";

function parseCleanKm(val) {
    if (val === undefined || val === null) return 0;
    var str = String(val).trim();
    if (str.indexOf(".") > -1 && str.split(".")[1].length === 3) {
        str = str.replace(".", "");
    }
    str = str.replace(/[\s,]/g, "");
    var res = parseInt(str, 10);
    return isNaN(res) ? 0 : res;
}

(function EnsureSchemaAuto() {
    try {
        // 1. Creazione Tabella Rifornimenti
        queryAccessDB("CREATE TABLE IF NOT EXISTS tblRifornimenti (ID INTEGER PRIMARY KEY AUTOINCREMENT, DataRifornimento TEXT, PrezzoAlLitro REAL, Litri REAL, CostoTotale REAL, KmAttuali INTEGER, Note TEXT, PathAllegato TEXT)", true);
        
        // 1b. Creazione Tabella Configurazioni Permanenti per i Rimborsi
        queryAccessDB("CREATE TABLE IF NOT EXISTS tblConfigAuto (Chiave TEXT PRIMARY KEY, Valore TEXT)", true);
        
        // 2. Estensione Tabella Spese (Se non già presenti)
        try { queryAccessDB("ALTER TABLE tblSpeseVeicolo ADD COLUMN TipoIntervento TEXT", true); } catch(err){}
        try { queryAccessDB("ALTER TABLE tblSpeseVeicolo ADD COLUMN PathAllegato TEXT", true); } catch(err){}
        
        // 3. Creazione Directory per Foto/Allegati
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var rootPath = fso.GetParentFolderName(p);
        
        var attachDir = fso.BuildPath(rootPath, "Allegati_Veicolo");
        if (!fso.FolderExists(attachDir)) fso.CreateFolder(attachDir);
        
        var subDir1 = fso.BuildPath(attachDir, "Rifornimenti");
        if (!fso.FolderExists(subDir1)) fso.CreateFolder(subDir1);
        
        var subDir2 = fso.BuildPath(attachDir, "Manutenzioni");
        if (!fso.FolderExists(subDir2)) fso.CreateFolder(subDir2);
        
    } catch(ex) {}
})();

function CaricaImpostazioni() {
    try {
        var res = queryAccessDB("SELECT * FROM tblConfigAuto") || [];
        for (var i = 0; i < res.length; i++) {
            var row = res[i];
            var k = row.Chiave || row.chiave;
            var v = row.Valore || row.valore;
            if (k === "TariffaKm") { try{ document.getElementById("txtTariffaKm").value = v; }catch(e){} }
            else if (k === "ConsumoMedio") { try{ document.getElementById("txtConsumoMedio").value = v; }catch(e){} }
            else if (k === "PrezzoCarburante") { try{ document.getElementById("txtPrezzoCarburante").value = v; }catch(e){} }
        }
    } catch(e) {}
}

window.onload = function() {
    CaricaImpostazioni();
    
    // Inizializzazione Automatica Anno Corrente nel Selettore Rimborsi
    try {
        var selAnno = document.getElementById("fltAnnoRimborsi");
        var curYear = new Date().getFullYear().toString();
        if (selAnno) {
            for (var o = 0; o < selAnno.options.length; o++) {
                if (selAnno.options[o].value === curYear) {
                    selAnno.selectedIndex = o;
                    break;
                }
            }
        }
    } catch(e) {}

    var initialTab = "spese";
    try { if (document.location.search.indexOf("tab=rimborsi") > -1) initialTab = "rimborsi"; } catch(e) {}
    SwitchSubTab(initialTab);
    
    try { StartTitleClock(); } catch(e) {}
    try { CaricaProfiloUtente(); } catch(e) {}
    
    // SUGGERIMENTO PRO: Angelo Custode delle Scadenze Auto all'avvio
    setTimeout(function(){ VerificaScadenzeCritiche(); }, 1000); // Lancio ritardato per non bloccare il rendering iniziale
};

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

// Helpers per date
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

function getScadenzaBadge(dateStr) {
    if (!dateStr || dateStr === "") return "<span class='badge-scadenza ok'>-</span>";
    try {
        var today = new Date();
        today.setHours(0,0,0,0);
        
        var parts = dateStr.split("-");
        var expDate = new Date(parts[0], parts[1]-1, parts[2]);
        expDate.setHours(0,0,0,0);
        
        var diffTime = expDate - today;
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        var formatted = dbToItDate(dateStr);
        if (diffDays < 0) {
            return "<span class='badge-scadenza expired' title='Scaduto!'>" + formatted + " ⚠️</span>";
        } else if (diffDays <= 15) {
            return "<span class='badge-scadenza warning' title='In scadenza imminente!'>" + formatted + " ⏳</span>";
        } else {
            return "<span class='badge-scadenza ok'>" + formatted + " ✅</span>";
        }
    } catch(e) {
        return dbToItDate(dateStr);
    }
}
// Gestione Navigazione Tab
// Gestione Navigazione Tab
function SwitchSubTab(tab) {
    currentTab = tab;
    
    // Toggle pulsanti tab
    document.getElementById("tabSpeseBtn").classList.remove("active");
    document.getElementById("tabRifornimentiBtn").classList.remove("active");
    document.getElementById("tabRimborsiBtn").classList.remove("active");
    document.getElementById("tabScadenzeBtn").classList.remove("active");
    var btnAnalisi = document.getElementById("tabAnalisiBtn");
    if (btnAnalisi) btnAnalisi.classList.remove("active");
    
    // Toggle viste principali
    document.getElementById("viewSpese").style.display = "none";
    document.getElementById("viewRifornimenti").style.display = "none";
    document.getElementById("viewRimborsi").style.display = "none";
    document.getElementById("viewScadenze").style.display = "none";
    var vAnalisi = document.getElementById("viewAnalisi");
    if (vAnalisi) vAnalisi.style.display = "none";
    
    // Toggle editor panel
    document.getElementById("editorSpese").style.display = "none";
    document.getElementById("editorRifornimenti").style.display = "none";
    document.getElementById("editorVeicoli").style.display = "none";
    document.getElementById("editorPanel").style.display = "block";
    
    // Toggle barra di ricerca
    document.getElementById("searchBoxContainer").style.display = "block";
    
    // Toggle pulsanti ribbon in base alla scheda attiva
    var btnExcel = document.getElementById("btnRibbonExcel");
    var btnNuovo = document.getElementById("btnRibbonNuovo");
    var btnElimina = document.getElementById("btnRibbonElimina");
    if (btnExcel) btnExcel.style.display = (tab === "rimborsi") ? "inline-block" : "none";
    if (btnNuovo) btnNuovo.style.display = (tab === "rimborsi" || tab === "analisi") ? "none" : "inline-block";
    if (btnElimina) btnElimina.style.display = (tab === "rimborsi" || tab === "analisi") ? "none" : "inline-block";
    
    if (tab === "spese") {
        document.getElementById("tabSpeseBtn").classList.add("active");
        document.getElementById("viewSpese").style.display = "block";
        document.getElementById("editorSpese").style.display = "block";
        document.getElementById("txtRicerca").placeholder = "Cerca intervento o descrizione...";
        CaricaSpese();
        NuovoSpesa();
    } else if (tab === "rifornimenti") {
        document.getElementById("tabRifornimentiBtn").classList.add("active");
        document.getElementById("viewRifornimenti").style.display = "block";
        document.getElementById("editorRifornimenti").style.display = "block";
        document.getElementById("txtRicerca").placeholder = "Cerca note o dettagli rifornimento...";
        CaricaRifornimenti();
        NuovoRifornimento();
    } else if (tab === "rimborsi") {
        document.getElementById("tabRimborsiBtn").classList.add("active");
        document.getElementById("viewRimborsi").style.display = "block";
        document.getElementById("editorPanel").style.display = "none"; 
        document.getElementById("searchBoxContainer").style.display = "none";
        CalcolaRimborsiMensili();
    } else if (tab === "scadenze") {
        document.getElementById("tabScadenzeBtn").classList.add("active");
        document.getElementById("viewScadenze").style.display = "block";
        document.getElementById("editorVeicoli").style.display = "block";
        document.getElementById("txtRicerca").placeholder = "Cerca modello o targa auto...";
        CaricaVeicoli();
        NuovoVeicolo();
    } else if (tab === "analisi") {
        var btnAnalisi = document.getElementById("tabAnalisiBtn");
        if (btnAnalisi) btnAnalisi.classList.add("active");
        if (vAnalisi) vAnalisi.style.display = "block";
        document.getElementById("editorPanel").style.display = "none";
        document.getElementById("searchBoxContainer").style.display = "none";
        CalcolaStatisticheAnalisi();
    }
}

var chartAnalisiInst = null;

function CalcolaStatisticheAnalisi() {
    var tbody = document.getElementById("tbodyAnalisiMensile");
    if (tbody) tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#94a3b8;'>Elaborazione statistiche e bilancio finanziario...</td></tr>";

    var annoElem = document.getElementById("fltAnnoRimborsi");
    var anno = annoElem ? annoElem.value : String((new Date()).getFullYear());
    var lblAnno = document.getElementById("lblAnnoStatistiche");
    if (lblAnno) lblAnno.innerText = anno;

    var tariffaStr = document.getElementById("txtTariffaKm") ? document.getElementById("txtTariffaKm").value.replace(",", ".") : "0.45";
    var tariffa = parseFloat(tariffaStr);
    if (isNaN(tariffa) || tariffa < 0) tariffa = 0.45;

    try {
        var sqlSpese = "SELECT Costo, DataIntervento FROM tblSpeseVeicolo";
        var resSpese = queryAccessDB(sqlSpese) || [];
        var totSpeseManutenzione = 0;
        var speseMesi = [0,0,0,0,0,0,0,0,0,0,0,0];

        for (var s = 0; s < resSpese.length; s++) {
            var sp = resSpese[s];
            var c = parseFloat(sp.Costo || sp.costo) || 0;
            var dt = sp.DataIntervento || sp.dataintervento;
            if (dt && String(dt).substring(0, 4) === anno) {
                totSpeseManutenzione += c;
                var mIdx = parseInt(String(dt).substring(5, 7), 10) - 1;
                if (mIdx >= 0 && mIdx < 12) speseMesi[mIdx] += c;
            }
        }

        var sqlAllRif = "SELECT * FROM tblRifornimenti ORDER BY KmAttuali ASC";
        var allRif = queryAccessDB(sqlAllRif) || [];
        var spesaBenzinaTotaleAnno = 0;
        var litriTotaliValidati = 0;
        var primaRicaricaLitri = 0;
        var minKm = 999999999, maxKm = 0;
        var minKmRif = 999999999, maxKmRif = 0;

        for (var r = 0; r < allRif.length; r++) {
            var rRecord = allRif[r];
            if (rRecord.DataRifornimento && String(rRecord.DataRifornimento).substring(0, 4) === anno) {
                var l = parseFloat(rRecord.Litri) || 0;
                var k = parseCleanKm(rRecord.KmAttuali);
                if (!isNaN(k) && k > 0) {
                    if (k < minKm) minKm = k;
                    if (k > maxKm) maxKm = k;
                    if (l > 0) {
                        spesaBenzinaTotaleAnno += parseFloat(rRecord.CostoTotale) || 0;
                        litriTotaliValidati += l;
                        if (k < minKmRif) {
                            minKmRif = k;
                            primaRicaricaLitri = l;
                        }
                        if (k > maxKmRif) maxKmRif = k;
                    }
                }
            }
        }

        var kmTotaliAutoNellAnno = (maxKm > minKm && minKm < 999999999) ? (maxKm - minKm) : 0;
        var kmPercorsiPeriodoCarburante = (maxKmRif > minKmRif && minKmRif < 999999999) ? (maxKmRif - minKmRif) : 0;
        var litriConsumatiPerQueiKm = litriTotaliValidati - primaRicaricaLitri;
        var consumoKmLitroReale = (kmPercorsiPeriodoCarburante > 0 && litriConsumatiPerQueiKm > 0) ? (kmPercorsiPeriodoCarburante / litriConsumatiPerQueiKm) : 0;

        var sqlConsegne = "SELECT DataConsegna, MeseRiferimento, AnnoRiferimento, Month(DataConsegna) AS MonthReal, Year(DataConsegna) AS YearReal, KmAndata, KmRitorno, RimborsoAutostrada, RimborsoParcheggio, RimborsoTrenoAvaria, RimborsoVarie " +
                           "FROM tblConsegne " +
                           "WHERE ([AnnoRiferimento] = " + anno + ") OR ([AnnoRiferimento] IS NULL AND Year([DataConsegna]) = " + anno + ")";
        var consegne = queryAccessDB(sqlConsegne) || [];

        var mesiDati = [];
        for (var m = 0; m < 12; m++) { mesiDati.push({ nConsegne: 0, totKm: 0.0, speseExtra: 0.0 }); }

        for (var i = 0; i < consegne.length; i++) {
            var row = consegne[i];
            var refAnno = row.AnnoRiferimento || row.annoriferimento || row.YearReal || row.yearreal;
            if (parseInt(refAnno, 10) !== parseInt(anno, 10)) continue;
            var meseIdx = (row.MeseRiferimento || row.meseriferimento || row.MonthReal || row.monthreal || 0) - 1;
            if (meseIdx >= 0 && meseIdx < 12) {
                mesiDati[meseIdx].nConsegne++;
                var kDist = (parseFloat(row.KmAndata) || 0) + (parseFloat(row.KmRitorno) || 0);
                mesiDati[meseIdx].totKm += kDist;
                var ex = (parseFloat(row.RimborsoAutostrada) || 0) + (parseFloat(row.RimborsoParcheggio) || 0) + (parseFloat(row.RimborsoTrenoAvaria) || 0) + (parseFloat(row.RimborsoVarie) || 0);
                mesiDati[meseIdx].speseExtra += ex;
            }
        }

        var fallbackConsumo = parseFloat(document.getElementById("txtConsumoMedio") ? document.getElementById("txtConsumoMedio").value.replace(",", ".") : "15.0") || 15.0;
        var fallbackPrezzo = parseFloat(document.getElementById("txtPrezzoCarburante") ? document.getElementById("txtPrezzoCarburante").value.replace(",", ".") : "1.80") || 1.80;

        var rimborsiMesi = [];
        var benzinaMesi = [];
        var netMesi = [];
        var totRimborsiACI = 0;
        var totBenzinaStima = 0;

        for (var k = 0; k < 12; k++) {
            var md = mesiDati[k];
            var tempR = (md.totKm * tariffa) + md.speseExtra;
            rimborsiMesi.push(tempR);
            totRimborsiACI += tempR;

            var sommaPrezziMese = 0, conteggioPrezziMese = 0;
            for (var r = 0; r < allRif.length; r++) {
                var rRecord = allRif[r];
                if (rRecord.DataRifornimento && String(rRecord.DataRifornimento).substring(0, 4) === anno) {
                    var mMese = parseInt(String(rRecord.DataRifornimento).substring(5, 7), 10) - 1;
                    if (mMese === k) {
                        var pLitro = parseFloat(rRecord.PrezzoAlLitro) || 0;
                        if (pLitro > 0) { sommaPrezziMese += pLitro; conteggioPrezziMese++; }
                    }
                }
            }

            var prezzoCarburanteMese = conteggioPrezziMese > 0 ? (sommaPrezziMese / conteggioPrezziMese) : fallbackPrezzo;
            var consumoEffettivo = consumoKmLitroReale > 0 ? consumoKmLitroReale : fallbackConsumo;
            var tempB = md.totKm > 0 ? (md.totKm / consumoEffettivo) * prezzoCarburanteMese : 0;
            benzinaMesi.push(tempB);
            totBenzinaStima += tempB;

            var tempN = tempR - tempB - speseMesi[k];
            netMesi.push(tempN);
        }

        var totNetto = totRimborsiACI - totBenzinaStima - totSpeseManutenzione;

        var kpiRim = document.getElementById("analisi-kpi-rimborsi");
        var kpiOrd = document.getElementById("analisi-kpi-ord");
        var kpiStra = document.getElementById("analisi-kpi-stra");
        var kpiNet = document.getElementById("analisi-kpi-netto");

        if (kpiRim) kpiRim.innerText = totRimborsiACI.toFixed(2).replace(".", ",") + " €";
        if (kpiOrd) kpiOrd.innerText = totBenzinaStima.toFixed(2).replace(".", ",") + " €";
        if (kpiStra) kpiStra.innerText = totSpeseManutenzione.toFixed(2).replace(".", ",") + " €";
        if (kpiNet) {
            kpiNet.innerText = (totNetto >= 0 ? "+" : "") + totNetto.toFixed(2).replace(".", ",") + " €";
            kpiNet.style.color = totNetto >= 0 ? "#fbbf24" : "#ef4444";
        }

        if (tbody) {
            tbody.innerHTML = "";
            var nomiMesiLoc = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
            for (var m = 0; m < 12; m++) {
                var tr = document.createElement("tr");
                if (m % 2 !== 0) tr.style.backgroundColor = "rgba(30, 41, 59, 0.2)";

                var html = "";
                html += "<td style='padding:8px 10px;'><b>" + nomiMesiLoc[m] + " " + anno + "</b></td>";
                html += "<td style='padding:8px 10px; text-align:center; font-family:monospace;'>" + mesiDati[m].nConsegne + "</td>";
                html += "<td style='padding:8px 10px; text-align:right; font-family:monospace;'>" + mesiDati[m].totKm.toFixed(1) + " Km</td>";
                html += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#38bdf8;'>" + benzinaMesi[m].toFixed(2).replace(".", ",") + " €</td>";
                html += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#f87171;'>" + speseMesi[m].toFixed(2).replace(".", ",") + " €</td>";
                html += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#eab308;'>" + mesiDati[m].speseExtra.toFixed(2).replace(".", ",") + " €</td>";
                html += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#34d399; font-weight:bold;'>" + rimborsiMesi[m].toFixed(2).replace(".", ",") + " €</td>";
                var colorN = netMesi[m] >= 0 ? "#06b6d4" : "#ef4444";
                html += "<td style='padding:8px 10px; text-align:right; font-family:monospace; font-weight:800; color:" + colorN + ";'>" + (netMesi[m] >= 0 ? "+" : "") + netMesi[m].toFixed(2).replace(".", ",") + " €</td>";

                tr.innerHTML = html;
                tbody.appendChild(tr);
            }
        }

        RenderGraficoAnalisi(rimborsiMesi, benzinaMesi, speseMesi, netMesi);

        // --- ELABORAZIONE COMPLETA STATISTICA RIPARTIZIONE USO PRIVATO VS LAVORO ---
        var totKmLavoroAnno = 0;
        for (var m = 0; m < 12; m++) {
            totKmLavoroAnno += mesiDati[m].totKm;
        }

        var totKmTotaliAnno = kmTotaliAutoNellAnno > 0 ? kmTotaliAutoNellAnno : (totKmLavoroAnno > 0 ? Math.round(totKmLavoroAnno / 0.7) : 0);
        var totKmPrivatoAnno = totKmTotaliAnno >= totKmLavoroAnno ? (totKmTotaliAnno - totKmLavoroAnno) : Math.round(totKmLavoroAnno * 0.3);
        if (totKmTotaliAnno < (totKmLavoroAnno + totKmPrivatoAnno)) {
            totKmTotaliAnno = totKmLavoroAnno + totKmPrivatoAnno;
        }

        var pctLavoro = totKmTotaliAnno > 0 ? Math.round((totKmLavoroAnno / totKmTotaliAnno) * 100) : 70;
        if (pctLavoro > 100) pctLavoro = 100;
        var pctPrivato = 100 - pctLavoro;

        var spesaCarburanteTotale = totBenzinaStima > 0 ? totBenzinaStima : spesaBenzinaTotaleAnno;
        var spesaCarburanteLavoro = (spesaCarburanteTotale * (pctLavoro / 100));
        var spesaCarburantePrivato = spesaCarburanteTotale - spesaCarburanteLavoro;

        var elemKmLavoro = document.getElementById("lblKmLavoro");
        var elemKmPrivato = document.getElementById("lblKmPrivato");
        var elemKmTotaliAnno = document.getElementById("lblKmTotaliAnno");
        var elemCostoLavoro = document.getElementById("lblCostoLavoro");
        var elemCostoPrivato = document.getElementById("lblCostoPrivato");
        var elemCostoTotaleAnno = document.getElementById("lblCostoTotaleAnno");
        var elemPctLavoro = document.getElementById("lblPctLavoro");
        var elemPctPrivato = document.getElementById("lblPctPrivato");

        if (elemKmLavoro) elemKmLavoro.innerText = totKmLavoroAnno.toFixed(1).replace(".", ",") + " Km";
        if (elemKmPrivato) elemKmPrivato.innerText = totKmPrivatoAnno.toFixed(1).replace(".", ",") + " Km";
        if (elemKmTotaliAnno) elemKmTotaliAnno.innerText = totKmTotaliAnno.toFixed(1).replace(".", ",") + " Km";
        if (elemCostoLavoro) elemCostoLavoro.innerText = spesaCarburanteLavoro.toFixed(2).replace(".", ",") + " €";
        if (elemCostoPrivato) elemCostoPrivato.innerText = spesaCarburantePrivato.toFixed(2).replace(".", ",") + " €";
        if (elemCostoTotaleAnno) elemCostoTotaleAnno.innerText = spesaCarburanteTotale.toFixed(2).replace(".", ",") + " €";
        if (elemPctLavoro) elemPctLavoro.innerText = pctLavoro + "%";
        if (elemPctPrivato) elemPctPrivato.innerText = pctPrivato + "%";

        var barLavoro = document.getElementById("barFillLavoro");
        var barPrivato = document.getElementById("barFillPrivato");
        var txtLavoro = document.getElementById("barTxtLavoro");
        var txtPrivato = document.getElementById("barTxtPrivato");
        var lblBarKmLavoro = document.getElementById("lblBarKmLavoro");
        var lblBarKmPrivato = document.getElementById("lblBarKmPrivato");

        if (barLavoro) barLavoro.style.width = pctLavoro + "%";
        if (barPrivato) barPrivato.style.width = pctPrivato + "%";
        if (txtLavoro) txtLavoro.innerText = pctLavoro + "% Lavoro";
        if (txtPrivato) txtPrivato.innerText = pctPrivato + "% Privato";
        if (lblBarKmLavoro) lblBarKmLavoro.innerText = totKmLavoroAnno.toFixed(1).replace(".", ",") + " Km";
        if (lblBarKmPrivato) lblBarKmPrivato.innerText = totKmPrivatoAnno.toFixed(1).replace(".", ",") + " Km";

        var tbodyRipartizione = document.getElementById("tbodyRipartizioneMensile");
        if (tbodyRipartizione) {
            tbodyRipartizione.innerHTML = "";
            var nomiMesiLoc = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
            
            for (var m = 0; m < 12; m++) {
                var tr = document.createElement("tr");
                if (m % 2 !== 0) tr.style.backgroundColor = "rgba(30, 41, 59, 0.2)";

                var kmLavMese = mesiDati[m].totKm;
                var kmTotMese = kmLavMese > 0 ? (kmLavMese / (pctLavoro / 100 || 0.7)) : 0;
                var kmPrivMese = kmTotMese - kmLavMese;
                var costoLavMese = benzinaMesi[m];
                var costoPrivMese = kmLavMese > 0 ? (costoLavMese * (kmPrivMese / kmLavMese)) : 0;
                if (isNaN(costoPrivMese) || !isFinite(costoPrivMese)) costoPrivMese = 0;

                var pctMeseLavoro = kmTotMese > 0 ? Math.round((kmLavMese / kmTotMese) * 100) : pctLavoro;
                var pctMesePrivato = 100 - pctMeseLavoro;

                var htmlR = "";
                htmlR += "<td style='padding:8px 10px;'><b>" + nomiMesiLoc[m] + " " + anno + "</b></td>";
                htmlR += "<td style='padding:8px 10px; text-align:right; font-family:monospace;'>" + kmTotMese.toFixed(1).replace(".", ",") + " Km</td>";
                htmlR += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#06b6d4; font-weight:bold;'>" + kmLavMese.toFixed(1).replace(".", ",") + " Km</td>";
                htmlR += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#f59e0b; font-weight:bold;'>" + kmPrivMese.toFixed(1).replace(".", ",") + " Km</td>";
                htmlR += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#38bdf8;'>" + costoLavMese.toFixed(2).replace(".", ",") + " €</td>";
                htmlR += "<td style='padding:8px 10px; text-align:right; font-family:monospace; color:#fbbf24;'>" + costoPrivMese.toFixed(2).replace(".", ",") + " €</td>";
                htmlR += "<td style='padding:8px 10px; text-align:center;'><span style='background:rgba(6,182,212,0.15); color:#06b6d4; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800;'>" + pctMeseLavoro + "% L</span> <span style='background:rgba(245,158,11,0.15); color:#f59e0b; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800;'>" + pctMesePrivato + "% P</span></td>";

                tr.innerHTML = htmlR;
                tbodyRipartizione.appendChild(tr);
            }
        }

    } catch(e) {
        if (tbody) tbody.innerHTML = "<tr><td colspan='6' style='color:#ef4444; text-align:center; padding:15px;'>Errore nel calcolo statistiche: " + e.message + "</td></tr>";
    }
}

function EsportaReportRipartizionePDF() {
    try {
        var annoElem = document.getElementById("fltAnnoRimborsi");
        var anno = annoElem ? annoElem.value : String((new Date()).getFullYear());
        var kmLav = document.getElementById("lblKmLavoro") ? document.getElementById("lblKmLavoro").innerText : "0 Km";
        var kmPriv = document.getElementById("lblKmPrivato") ? document.getElementById("lblKmPrivato").innerText : "0 Km";
        var kmTot = document.getElementById("lblKmTotaliAnno") ? document.getElementById("lblKmTotaliAnno").innerText : "0 Km";
        var pctLav = document.getElementById("lblPctLavoro") ? document.getElementById("lblPctLavoro").innerText : "0%";
        var pctPriv = document.getElementById("lblPctPrivato") ? document.getElementById("lblPctPrivato").innerText : "0%";
        var cLavoro = document.getElementById("lblCostoLavoro") ? document.getElementById("lblCostoLavoro").innerText : "0,00 €";
        var cPrivato = document.getElementById("lblCostoPrivato") ? document.getElementById("lblCostoPrivato").innerText : "0,00 €";
        var cTotale = document.getElementById("lblCostoTotaleAnno") ? document.getElementById("lblCostoTotaleAnno").innerText : "0,00 €";
        
        var htmlContent = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Report Ripartizione Uso Privato e Lavoro - " + anno + "</title>" +
            "<style>" +
            "body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 25px; background: #fff; }" +
            "h1 { color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 8px; font-size: 22px; text-transform: uppercase; margin-bottom:5px; }" +
            ".sub { color: #64748b; font-size: 13px; margin-bottom: 25px; }" +
            ".kpi-box { display: flex; gap: 15px; margin-bottom: 25px; }" +
            ".kpi { flex: 1; border: 1px solid #cbd5e1; background: #f8fafc; padding: 18px; border-radius: 8px; text-align: center; }" +
            ".kpi span { display: block; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }" +
            ".kpi strong { font-size: 24px; color: #0f172a; }" +
            "table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }" +
            "th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }" +
            "th { background: #0284c7; color: #fff; text-transform: uppercase; font-size: 11px; }" +
            "tr:nth-child(even) { background: #f8fafc; }" +
            ".print-btn { float: right; padding: 8px 16px; background: #0284c7; color: #fff; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }" +
            "</style></head><body>" +
            "<button class='print-btn' onclick='window.print()'>📄 Stampa PDF</button>" +
            "<h1>📊 Report Ripartizione Uso Privato vs Lavoro (" + anno + ")</h1>" +
            "<div class='sub'>Sistema Logistica C. Milella &bull; Certificazione Ripartizione Chilometrica</div>" +
            "<div class='kpi-box'>" +
            "<div class='kpi'><span>💼 Uso Lavoro</span><strong>" + kmLav + " (" + pctLav + ")</strong><div style='font-size:12px; color:#0284c7; margin-top:4px;'>Costo: " + cLavoro + "</div></div>" +
            "<div class='kpi'><span>🏠 Uso Privato</span><strong>" + kmPriv + " (" + pctPriv + ")</strong><div style='font-size:12px; color:#d97706; margin-top:4px;'>Costo: " + cPrivato + "</div></div>" +
            "<div class='kpi'><span>🚗 Totale Percorso</span><strong>" + kmTot + "</strong><div style='font-size:12px; color:#475569; margin-top:4px;'>Costo Totale: " + cTotale + "</div></div>" +
            "</div>" +
            "<h3>Dettaglio Mensile Ripartizione</h3>" +
            (document.getElementById("tbodyRipartizioneMensile") ? "<table><thead><tr><th>Mese</th><th>Km Totali</th><th>Km Lavoro</th><th>Km Privato</th><th>Costo Lavoro (€)</th><th>Costo Privato (€)</th></tr></thead><tbody>" + document.getElementById("tbodyRipartizioneMensile").innerHTML.replace(/<span[^>]*>[^<]*<\/span>/g, '') + "</tbody></table>" : "") +
            "</body></html>";

        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var shell = new ActiveXObject("WScript.Shell");
        var pathEval = document.location.pathname;
        if (pathEval.indexOf("/") === 0) pathEval = pathEval.substring(1);
        pathEval = decodeURIComponent(pathEval).replace(/\//g, "\\");
        var currentDir = fso.GetParentFolderName(pathEval);
        var tempFile = fso.BuildPath(currentDir, "report_stampa.html");

        var stream = new ActiveXObject("ADODB.Stream");
        stream.Type = 2;
        stream.Charset = "utf-8";
        stream.Open();
        stream.WriteText(htmlContent);
        stream.SaveToFile(tempFile, 2);
        stream.Close();

        shell.Run('"' + tempFile + '"');
    } catch(e) {
        alert("Errore generazione report ripartizione: " + e.message);
    }
}

function RenderGraficoAnalisi(rimborsi, benzina, manutenzione, netti) {
    try {
        var ctx = document.getElementById("chartAnalisiMensile");
        if (!ctx) return;
        if (typeof Chart === "undefined") return;

        if (chartAnalisiInst) { chartAnalisiInst.destroy(); }

        var shortLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

        chartAnalisiInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: shortLabels,
                datasets: [
                    {
                        label: 'Rimborso ACI (€)',
                        data: rimborsi,
                        backgroundColor: 'rgba(16, 185, 129, 0.65)',
                        borderColor: '#10b981',
                        borderWidth: 1.5
                    },
                    {
                        label: 'Stima Carburante (€)',
                        data: benzina,
                        backgroundColor: 'rgba(14, 165, 233, 0.65)',
                        borderColor: '#0ea5e9',
                        borderWidth: 1.5
                    },
                    {
                        label: 'Manutenzione (€)',
                        data: manutenzione,
                        backgroundColor: 'rgba(239, 68, 68, 0.65)',
                        borderColor: '#ef4444',
                        borderWidth: 1.5
                    },
                    {
                        type: 'line',
                        label: 'Guadagno Netto (€)',
                        data: netti,
                        borderColor: '#fbbf24',
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#fbbf24',
                        pointRadius: 4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    labels: { fontColor: '#94a3b8', fontSize: 11, fontFamily: 'Inter' }
                },
                title: {
                    display: true,
                    text: 'CONFRONTO MENSILE ENTRATE/USCITE ED EFFICIENZA FINANZIARIA',
                    fontSize: 12,
                    fontFamily: 'Inter',
                    fontColor: '#0ea5e9',
                    fontStyle: '800'
                },
                scales: {
                    yAxes: [{
                        gridLines: { color: 'rgba(51, 65, 85, 0.3)', zeroLineColor: 'rgba(51, 65, 85, 0.6)' },
                        ticks: { fontColor: '#94a3b8', fontSize: 10, callback: function(v){ return v + ' €'; } }
                    }],
                    xAxes: [{
                        gridLines: { display: false },
                        ticks: { fontColor: '#94a3b8', fontSize: 10 }
                    }]
                }
            }
        });
    } catch(e) {}
}

function EseguiRicerca() {
    if (currentTab === "spese") FiltraSpese();
    else if (currentTab === "rifornimenti") FiltraRifornimenti();
    else if (currentTab === "scadenze") FiltraVeicoli();
}

// ==========================================
// SEZIONE 1: REGISTRO SPESE
// ==========================================
function CaricaSpese() {
    var tbody = document.getElementById("tbodySpese");
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Caricamento in corso...</td></tr>";
    
    try {
        var sql = "SELECT * FROM tblSpeseVeicolo ORDER BY DataIntervento DESC";
        speseMemory = queryAccessDB(sql) || [];
        RenderSpeseTable(speseMemory);
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='5' style='color:red; text-align:center;'>Errore: " + e.message + "</td></tr>";
    }
}

function RenderSpeseTable(arr) {
    var tbody = document.getElementById("tbodySpese");
    tbody.innerHTML = "";
    
    if (arr.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px; color:#94a3b8;'>Nessun intervento registrato.</td></tr>";
        return;
    }
    
    for (var i = 0; i < arr.length; i++) {
        var s = arr[i];
        var tr = document.createElement("tr");
        tr.setAttribute("data-idx", i);
        
        var costStr = s.Costo ? Number(s.Costo).toFixed(2) + " €" : "0.00 €";
        var badgeTipo = "";
        if (s.TipoIntervento === "EMERGENZA") {
            badgeTipo = "<span style='color:#f59e0b; font-weight:800;'>⚠️ EMERGENZA</span>";
        } else if (s.TipoIntervento === "STRAORDINARIA") {
            badgeTipo = "<span style='color:#ef4444; font-weight:800;'>🚨 STR</span>";
        } else {
            badgeTipo = "<span style='color:#10b981;'>🔧 ORD</span>";
        }
        var attachIcon = s.PathAllegato ? " 📎" : "";

        var html = "";
        html += "<td>" + s.ID + "</td>";
        html += "<td>" + dbToItDate(s.DataIntervento) + "</td>";
        html += "<td>" + badgeTipo + "</td>";
        html += "<td><b>" + (s.Descrizione || "-").toUpperCase() + attachIcon + "</b></td>";
        html += "<td style='text-align:right; font-weight:bold; color:#ef4444;'>" + costStr + "</td>";
        html += "<td style='color:#64748b; font-size:11px; overflow:hidden; text-overflow:ellipsis; max-width:150px; white-space:nowrap;'>" + (s.Note || "") + "</td>";
        html += "<td style='text-align:center;'><i class='fa fa-floppy-o row-save-btn' title='Salva le modifiche ora' onclick='SalvaRecord(); if(event.stopPropagation)event.stopPropagation(); event.cancelBubble=true;'></i><i class='fa fa-trash row-delete-btn' title='Elimina questa voce' onclick='EliminaRigaRapida(\"spese\"," + s.ID + ", event)'></i></td>";
        
        tr.innerHTML = html;
        
        tr.onclick = function() {
            var rows = tbody.getElementsByTagName("tr");
            for(var z=0; z<rows.length; z++) rows[z].classList.remove("selected");
            this.classList.add("selected");
            
            selectedSpesaIdx = Number(this.getAttribute("data-idx"));
            CaricaDettaglioSpesa(speseMemory[selectedSpesaIdx]);
        };
        
        tbody.appendChild(tr);
    }
    if (typeof RenderSpeseTimeline === "function") {
        RenderSpeseTimeline(arr);
    }
}

function FiltraSpese() {
    var txt = document.getElementById("txtRicerca").value.trim().toLowerCase();
    if (txt === "") {
        RenderSpeseTable(speseMemory);
        return;
    }
    var filtrati = [];
    for (var i = 0; i < speseMemory.length; i++) {
        var s = speseMemory[i];
        var desc = String(s.Descrizione || "").toLowerCase();
        var note = String(s.Note || "").toLowerCase();
        if (desc.indexOf(txt) > -1 || note.indexOf(txt) > -1) {
            filtrati.push(s);
        }
    }
    RenderSpeseTable(filtrati);
}

function CaricaDettaglioSpesa(s) {
    document.getElementById("lblIDSpesa").innerText = s.ID;
    document.getElementById("txtIDSpesa").value = s.ID;
    document.getElementById("txtDataSpesa").value = dbToItDate(s.DataIntervento);
    document.getElementById("txtDescrizioneSpesa").value = s.Descrizione || "";
    document.getElementById("txtCostoSpesa").value = s.Costo || "";
    document.getElementById("cmbTipoIntervento").value = s.TipoIntervento || "ORDINARIA";
    document.getElementById("txtNoteSpesa").value = s.Note || "";
    
    // Gestione allegato
    var path = s.PathAllegato || "";
    document.getElementById("txtPathAllegatoSpesa").value = path;
    document.getElementById("viewFileSpesa").style.display = path !== "" ? "block" : "none";
}

function NuovoSpesa() {
    selectedSpesaIdx = -1;
    document.getElementById("lblIDSpesa").innerText = "NUOVO";
    document.getElementById("txtIDSpesa").value = "";
    
    var d_oggi = new Date();
    var dd = d_oggi.getDate(); if(dd<10) dd="0"+dd;
    var mm = d_oggi.getMonth()+1; if(mm<10) mm="0"+mm;
    document.getElementById("txtDataSpesa").value = dd + "/" + mm + "/" + d_oggi.getFullYear();
    
    document.getElementById("txtDescrizioneSpesa").value = "";
    document.getElementById("txtCostoSpesa").value = "";
    document.getElementById("cmbTipoIntervento").value = "ORDINARIA";
    document.getElementById("txtNoteSpesa").value = "";
    document.getElementById("txtPathAllegatoSpesa").value = "";
    document.getElementById("viewFileSpesa").style.display = "none";
    
    var rows = document.getElementById("tbodySpese").getElementsByTagName("tr");
    for(var z=0; z<rows.length; z++) rows[z].classList.remove("selected");
}

// ==========================================
// SEZIONE 1.B: GESTIONE RIFORNIMENTI (CARBURANTE)
// ==========================================
var chartInst = null;

function CaricaRifornimenti() {
    var tbody = document.getElementById("tbodyRifornimenti");
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px;'>Recupero registro pieno...</td></tr>";
    
    try {
        var sql = "SELECT * FROM tblRifornimenti ORDER BY DataRifornimento DESC";
        rifornimentiMemory = queryAccessDB(sql) || [];
        RenderRifornimentiTable(rifornimentiMemory);
        AggiornaGraficoCarburante(rifornimentiMemory);
        AggiornaStatisticheRifornimenti(rifornimentiMemory); try { AggiornaExtraCarburante(rifornimentiMemory); } catch(eX) {}
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='6' style='color:red;'>Errore caricamento carburante: " + e.message + "</td></tr>";
    }
}

function AggiornaStatisticheRifornimenti(arr) {
    try {
        var totLiters = 0;
        var totCost = 0;
        var countWithPrice = 0;
        var sumPrices = 0;
        
        for(var i=0; i<arr.length; i++) {
            var l = parseFloat(arr[i].Litri) || 0;
            var c = parseFloat(arr[i].CostoTotale) || 0;
            var p = parseFloat(arr[i].PrezzoAlLitro) || 0;
            
            totLiters += l;
            totCost += c;
            if (p > 0) {
                sumPrices += p;
                countWithPrice++;
            }
        }
        
        var avgPrice = countWithPrice > 0 ? (sumPrices / countWithPrice) : 0;
        
        var lblAvg = document.getElementById("lblFuelAvgPrice");
        var lblLit = document.getElementById("lblFuelTotLiters");
        var lblCst = document.getElementById("lblFuelTotCost");
        
        // --- NUOVO CALCOLO IMPATTO RINCARI ANNUALE ---
        var totLitriAnno = 0;
        var totSpesoAnno = 0;
        var prezzoInizialeAnno = 0;
        var currentYear = new Date().getFullYear();
        var arrAnno = [];
        for(var z=arr.length-1; z>=0; z--) {
            if(arr[z].DataRifornimento && arr[z].DataRifornimento.substring(0,4) == currentYear) {
                arrAnno.push(arr[z]);
            }
        }
        if(arrAnno.length > 0) {
            prezzoInizialeAnno = 0;
            for(var z=0; z<arrAnno.length; z++) {
                var prZ = parseFloat(arrAnno[z].PrezzoAlLitro) || 0;
                if(prZ > 0 && prezzoInizialeAnno === 0) {
                    prezzoInizialeAnno = prZ;
                }
            }
            for(var z=0; z<arrAnno.length; z++) {
                var l_ = parseFloat(arrAnno[z].Litri) || 0;
                var c_ = parseFloat(arrAnno[z].CostoTotale) || 0;
                totLitriAnno += l_;
                totSpesoAnno += c_;
            }
        }            var totIdealeAnno = totLitriAnno * prezzoInizialeAnno;
            var diffInflazione = totSpesoAnno - totIdealeAnno;
            var pctInflazione = 0;
            if (totIdealeAnno > 0) {
                pctInflazione = (diffInflazione / totIdealeAnno) * 100;
            }
            
            var lblInf = document.getElementById("lblFuelInflation");
            var pnlWrap = document.getElementById("pnlFuelInflationWrap");
            if(lblInf) {
                if(arrAnno.length > 0 && prezzoInizialeAnno > 0) {
                    var strPct = pctInflazione !== 0 ? " <span style='font-size:12px; opacity:0.8;'>(" + (pctInflazione > 0 ? "+" : "") + pctInflazione.toFixed(1).replace(".", ",") + "%)</span>" : "";
                    
                    if(diffInflazione > 0) lblInf.innerHTML = "<span style='color:#ef4444'>+" + diffInflazione.toFixed(2).replace(".", ",") + " &euro;</span>" + strPct;
                    else if(diffInflazione < 0) lblInf.innerHTML = "<span style='color:#10b981'>" + Math.abs(diffInflazione).toFixed(2).replace(".", ",") + " &euro;</span>" + strPct;
                    else lblInf.innerHTML = "<span style='color:#94a3b8'>0,00 &euro;</span>";
                  
                  var pctTxt = pctInflazione !== 0 ? (pctInflazione > 0 ? "+" : "") + pctInflazione.toFixed(1).replace(".", ",") + "%" : "0%";
                    if(pnlWrap) {
                        pnlWrap.className = "fstat-info premium-tooltip";
                        pnlWrap.setAttribute("data-tooltip", "SPIEGAZIONE:\nQuesto dato si riferisce all'intero anno solare (NON al singolo pieno).\n\nConsiderando tutti i tuoi pieni dell'anno (" + totLitriAnno.toFixed(1).replace(".", ",") + " Litri), la tua spesa complessiva e' " + (diffInflazione > 0 ? "aumentata" : "diminuita") + " del " + pctTxt + ".\n\nIn pratica: finora hai pagato " + Math.abs(diffInflazione).toFixed(2) + " \u20AC " + (diffInflazione > 0 ? "in PIU'" : "in MENO") + " rispetto al primissimo prezzo registrato a inizio anno (" + prezzoInizialeAnno.toFixed(3).replace(".", ",") + " \u20AC/L).");
                        pnlWrap.title = "";
                    }
              } else {
                  lblInf.innerHTML = "-- &euro;";
              }
          }
          
            // --- PROIEZIONE DI SPESA A FINE ANNO ---
            var lblFor = document.getElementById("lblFuelForecast");
            var pnlForWrap = document.getElementById("pnlFuelForecastWrap");
            if(lblFor) {
                if(arrAnno.length > 0 && totSpesoAnno > 0) {
                    var now = new Date();
                    var start = new Date(now.getFullYear(), 0, 0);
                    var diff = now - start;
                    var oneDay = 1000 * 60 * 60 * 24;
                    var dayOfYear = Math.floor(diff / oneDay);
                    
                    if (dayOfYear > 0) {
                        var spesaGiornaliera = totSpesoAnno / dayOfYear;
                        var proiezione = spesaGiornaliera * 365;
                        lblFor.innerHTML = proiezione.toFixed(2).replace(".", ",") + " &euro;";
                        
                        if(pnlForWrap) {
                            pnlForWrap.className = "fstat-info premium-tooltip";
                            pnlForWrap.setAttribute("data-tooltip", "PROIEZIONE:\nBasata sulla tua spesa attuale di " + totSpesoAnno.toFixed(2).replace(".", ",") + " \u20AC nei primi " + dayOfYear + " giorni dell'anno.\n\nAl 31 Dicembre spenderai approssimativamente " + proiezione.toFixed(2).replace(".", ",") + " \u20AC se continui con questi ritmi di consumo.");
                            pnlForWrap.title = "";
                        }
                    }
                } else {
                    lblFor.innerHTML = "-- &euro;";
                }
            }
            
            // --- BUDGET MENSILE CARBURANTE ---
            var MAX_BUDGET = GetBudgetMensile();
            var currentMonth = new Date().getMonth() + 1;
            var currentMonthStr = currentMonth < 10 ? "0" + currentMonth : "" + currentMonth;
            var meseCorrenteSpesa = 0;
            
            for(var z=0; z<arrAnno.length; z++) {
                if(arrAnno[z].DataRifornimento && arrAnno[z].DataRifornimento.substring(5,7) == currentMonthStr) {
                    meseCorrenteSpesa += parseFloat(arrAnno[z].CostoTotale) || 0;
                }
            }
            
            var lblBudMonth = document.getElementById("lblBudgetMonth");
            var lblBudSpent = document.getElementById("lblBudgetSpent");
            var barBud = document.getElementById("barBudgetFuel");
            var lblBudWarn = document.getElementById("lblBudgetWarning");
            
            if(lblBudMonth && lblBudSpent && barBud && lblBudWarn) {
                var mesiNomi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
                lblBudMonth.innerText = mesiNomi[currentMonth-1].toUpperCase();
                var lblBudMax = document.getElementById("lblBudgetMax");
                if(lblBudMax) lblBudMax.innerHTML = "/ " + MAX_BUDGET.toFixed(0) + " &euro; MAX &#9998;";
                lblBudSpent.innerHTML = meseCorrenteSpesa.toFixed(2).replace(".", ",") + " &euro;";
                
                var pctBudget = (meseCorrenteSpesa / MAX_BUDGET) * 100;
                if(pctBudget > 100) pctBudget = 100;
                barBud.style.width = pctBudget + "%";
                
                if (meseCorrenteSpesa >= MAX_BUDGET) {
                    barBud.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
                    lblBudWarn.innerText = "Budget esaurito! Hai superato il limite mensile.";
                    lblBudWarn.style.color = "#ef4444";
                } else if (meseCorrenteSpesa >= MAX_BUDGET * 0.8) {
                    barBud.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)";
                    lblBudWarn.innerText = "Attenzione: stai per raggiungere il limite del budget (" + (MAX_BUDGET - meseCorrenteSpesa).toFixed(2).replace(".", ",") + " € rimanenti).";
                    lblBudWarn.style.color = "#f59e0b";
                } else {
                    barBud.style.background = "linear-gradient(90deg, #10b981, #0ea5e9)";
                    lblBudWarn.innerText = "Sei perfettamente in linea con il budget mensile. (Ti restano " + (MAX_BUDGET - meseCorrenteSpesa).toFixed(2).replace(".", ",") + " €)";
                    lblBudWarn.style.color = "#10b981";
                }
            }
            
            // --- MANUTENZIONE PREDITTIVA SUI CHILOMETRI ---
            try {
                var maxKmRegistrato = maxK || 0; // maxK calcolato prima (riga 920 circa) se ci sono rifs
                // Se maxK non e' definito o non c'e', lo peschiamo dall'ultimo pieno in assoluto
                if(!maxKmRegistrato || maxKmRegistrato <= 0) {
                    var allK = arr.map(function(r) { return parseInt(r.KmAttuali, 10); }).filter(function(k) { return !isNaN(k) && k > 0; });
                    if(allK.length > 0) maxKmRegistrato = Math.max.apply(null, allK);
                }
                
                if (maxKmRegistrato > 0) {
                    var sqlManut = "SELECT * FROM tblSpeseVeicolo WHERE (Descrizione LIKE '%tagliando%' OR Descrizione LIKE '%olio%' OR TipoIntervento = 'Tagliando' OR TipoIntervento = 'Manutenzione') ORDER BY DataIntervento DESC";
                    var resManut = queryAccessDB(sqlManut);
                    if (resManut && resManut.length > 0) {
                        var lastManutDate = resManut[0].DataIntervento;
                        var kmAtManut = 0;
                        for(var i=0; i<arr.length; i++) {
                            if (arr[i].DataRifornimento >= lastManutDate) {
                                var k = parseInt(arr[i].KmAttuali, 10);
                                if (!isNaN(k) && k > 0 && kmAtManut === 0) {
                                    kmAtManut = k;
                                }
                            }
                        }
                        if (kmAtManut === 0) {
                            for(var i=arr.length-1; i>=0; i--) {
                                var k = parseInt(arr[i].KmAttuali, 10);
                                if (!isNaN(k) && k > 0) {
                                    kmAtManut = k;
                                    break;
                                }
                            }
                        }
                        
                        if (kmAtManut > 0) {
                            var diff = maxKmRegistrato - kmAtManut;
                            var soglia = 15000; // Valore comunicato dall'utente
                            
                            var hud = document.getElementById("pnlManutenzionePredittiva");
                            if (!hud) {
                                hud = document.createElement("div");
                                hud.id = "pnlManutenzionePredittiva";
                                var grid = document.querySelector(".fuel-budget-panel");
                                if (grid) grid.parentNode.insertBefore(hud, grid);
                            }
                            
                            if (diff >= (soglia - 1500)) {
                                var alertMsg = diff >= soglia ? "MANUTENZIONE RICHIESTA! Hai percorso " + diff + " km dall'ultimo tagliando/cambio olio (Soglia: " + soglia + " km)." : "PREVISIONE MANUTENZIONE: Tra " + (soglia - diff) + " km dovrai effettuare il prossimo tagliando/cambio olio.";
                                var alertColor = diff >= soglia ? "#ef4444" : "#f59e0b";
                                hud.innerHTML = "<div style='margin-top:20px; padding:12px 18px; background:rgba(30,41,59,0.8); border:2px solid " + alertColor + "; border-radius:10px; color:" + alertColor + "; font-weight:bold; display:flex; align-items:center; gap:10px; box-shadow:0 0 15px " + alertColor + "40;'><i class='fa fa-wrench fa-lg'></i> " + alertMsg + "</div>";
                            } else {
                                hud.innerHTML = ""; // Nascondi se non serve
                            }
                        }
                    }
                }
            } catch(eManut) { console.log(eManut); }
            
        // ----------------------------------------------

        if (lblAvg) {
            if (avgPrice > 0) {
                if (typeof AnimateSlotMachineNumber === "function") { AnimateSlotMachineNumber("lblFuelAvgPrice", avgPrice, " €/L", "", 3); }
                else { lblAvg.innerText = avgPrice.toFixed(3).replace(".", ",") + " €/L"; }
            } else {
                lblAvg.innerText = "-- €/L";
            }
        }
        if (lblLit) {
            if (totLiters > 0) {
                if (typeof AnimateSlotMachineNumber === "function") { AnimateSlotMachineNumber("lblFuelTotLiters", totLiters, " L", "", 1); }
                else { lblLit.innerText = totLiters.toFixed(1).replace(".", ",") + " L"; }
            } else {
                lblLit.innerText = "0,0 L";
            }
        }
        if (lblCst) {
            if (totCost > 0) {
                if (typeof AnimateSlotMachineNumber === "function") { AnimateSlotMachineNumber("lblFuelTotCost", totCost, " €", "", 2); }
                else { lblCst.innerText = totCost.toFixed(2).replace(".", ",") + " €"; }
            } else {
                lblCst.innerText = "0,00 €";
            }
        }

        // 1. Stazione più conveniente basata sulla cronologia
        var minPrice = 999;
        var cheapestStationNote = "";
        for (var i = 0; i < arr.length; i++) {
            var pVal = parseFloat(arr[i].PrezzoAlLitro) || 0;
            if (pVal > 0 && pVal < minPrice) {
                minPrice = pVal;
                cheapestStationNote = arr[i].Note || "Self Service";
            }
        }
        var lblCheapest = document.getElementById("lblFuelCheapestStation");
        if (lblCheapest) {
            if (minPrice < 999) {
                var cleanNote = cheapestStationNote.replace(/[\r\n]+/g, " ");
                if (cleanNote.length > 22) cleanNote = cleanNote.substring(0, 20) + "..";
                lblCheapest.innerText = minPrice.toFixed(3).replace(".", ",") + " €/L (" + cleanNote + ")";
                lblCheapest.title = minPrice.toFixed(3) + " €/L - " + cheapestStationNote;
            } else {
                lblCheapest.innerText = "--";
                lblCheapest.title = "";
            }
        }
        
        // 2. Consumo reale complessivo (Km/L) calcolato su tutti i rifornimenti validi
        var sortedRif = arr.slice().sort(function(a,b){ return (parseInt(a.KmAttuali, 10) || 0) - (parseInt(b.KmAttuali, 10) || 0); });
        var validRifs = [];
        for(var i=0; i<sortedRif.length; i++){
            var k = parseInt(sortedRif[i].KmAttuali, 10);
            if(!isNaN(k) && k > 0) validRifs.push(sortedRif[i]);
        }
        var realCons = 0;
        if (validRifs.length >= 2) {
            var minK = parseInt(validRifs[0].KmAttuali, 10);
            var maxK = parseInt(validRifs[validRifs.length - 1].KmAttuali, 10);
            var totK = maxK - minK;
            var totL = 0;
            for(var j=1; j<validRifs.length; j++){
                totL += parseFloat(validRifs[j].Litri) || 0;
            }
            if(totK > 0 && totL > 0) {
                realCons = totK / totL;
            }
        }
        var lblRealCons = document.getElementById("lblFuelRealConsumo");
        if (lblRealCons) {
            if (realCons > 0) {
                lblRealCons.innerText = realCons.toFixed(1).replace(".", ",") + " Km/L";
            } else {
                lblRealCons.innerText = "-- Km/L";
            }
        }
    } catch(ex) {}
}

function RenderRifornimentiTable(arr) {
    var tbody = document.getElementById("tbodyRifornimenti");
    tbody.innerHTML = "";
    
    if (arr.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#94a3b8;'>Nessun rifornimento registrato. Registra il tuo primo scontrino.</td></tr>";
        return;
    }
    
    // Ordina per Km/Data decrescenti per la visualizzazione nella griglia
    for (var i = 0; i < arr.length; i++) {
        var r = arr[i];
        var tr = document.createElement("tr");
        tr.setAttribute("data-idx", i);
        
        var prezzo = r.PrezzoAlLitro ? Number(r.PrezzoAlLitro).toFixed(3) + " €" : "-";
        var tot = r.CostoTotale ? Number(r.CostoTotale).toFixed(2) + " €" : "0.00 €";
        var allegato = r.PathAllegato ? " 📎" : "";

        // Calcolo Ripartizione Lavoro/Privato per ogni pieno
        var infoRip = "<i>Da elaborare a fine mese</i>";
        try {
            if (i === 0) {
                infoRip = "<i style='color:#64748b; font-size:10.5px;'>Pieno corrente in uso...</i>";
            } else {
                var kCurr = parseInt(r.KmAttuali, 10);
                var rNext = arr[i-1]; // arr è DESC, quindi i-1 è il pieno temporalmente SUCCESSIVO (più recente)
                var kNext = parseInt(rNext.KmAttuali, 10);
                if (!isNaN(kCurr) && !isNaN(kNext) && kNext > kCurr && r.DataRifornimento && rNext.DataRifornimento) {
                    var dist = kNext - kCurr; // Km percorsi col pieno attuale (arr[i])
                    var dCurrStr = r.DataRifornimento.substring(0, 10);
                    var dNextStr = rNext.DataRifornimento.substring(0, 10);
                    
                    var sqlKm = "SELECT KmAndata, KmRitorno FROM tblConsegne WHERE DataConsegna >= '" + dCurrStr + "' AND DataConsegna < '" + dNextStr + "'";
                    var resKm = queryAccessDB(sqlKm) || [];
                    var kmLav = 0;
                    for (var q = 0; q < resKm.length; q++) {
                        kmLav += (parseFloat(resKm[q].KmAndata) || 0) + (parseFloat(resKm[q].KmRitorno) || 0);
                    }
                    
                    if (kmLav > dist) kmLav = dist;
                    var perc = dist > 0 ? (kmLav / dist) * 100 : 0;
                    var costTot = parseFloat(r.CostoTotale) || 0;
                    var costLav = (costTot * (perc / 100)).toFixed(2);
                    var costPriv = (costTot - costLav).toFixed(2);
                    
                    infoRip = "<b style='color:#38bdf8;'>" + perc.toFixed(0) + "% Lavoro</b> (" + costLav + " €)<br><span style='color:#94a3b8; font-size:10px;'>" + (100 - perc).toFixed(0) + "% Privato (" + costPriv + " €)</span>";
                } else {
                    infoRip = "<i style='color:#64748b; font-size:10px;'>Dati Km mancanti/incoerenti</i>";
                }
            }
        } catch(e) {
            infoRip = "<i>Errore calcolo</i>";
        }
        
        // -- NUOVO: Calcolo Differenze Rispetto al Rifornimento Precedente --
        var trPrz = "", trTot = "", trLit = "", trKm = "";
        if (i + 1 < arr.length) {
            var prev = arr[i+1];
            var dPrz = Number(r.PrezzoAlLitro || 0) - Number(prev.PrezzoAlLitro || 0);
            var dTot = Number(r.CostoTotale || 0) - Number(prev.CostoTotale || 0);
            var dLit = Number(r.Litri || 0) - Number(prev.Litri || 0);
            var dKm = parseInt(r.KmAttuali || 0) - parseInt(prev.KmAttuali || 0);
            
            if(dPrz > 0) trPrz = "<br><span style='font-size:10px; color:#ef4444;'>▲ +" + dPrz.toFixed(3) + " €</span>";
            else if(dPrz < 0) trPrz = "<br><span style='font-size:10px; color:#10b981;'>▼ " + Math.abs(dPrz).toFixed(3) + " €</span>";
            
            if(dTot > 0) trTot = "<br><span style='font-size:10px; color:#ef4444;'>▲ +" + dTot.toFixed(2) + " €</span>";
            else if(dTot < 0) trTot = "<br><span style='font-size:10px; color:#10b981;'>▼ " + Math.abs(dTot).toFixed(2) + " €</span>";
            
            if(dLit > 0) trLit = "<br><span style='font-size:10px; color:#fbbf24;'>+" + dLit.toFixed(1) + " L</span>";
            else if(dLit < 0) trLit = "<br><span style='font-size:10px; color:#38bdf8;'>" + dLit.toFixed(1) + " L</span>";
            
            if(dKm > 0 && !isNaN(dKm)) trKm = "<br><span style='font-size:10px; color:#94a3b8;'>+" + dKm + " Km</span>";
        }
        // --------------------------------------------------------------------

        var html = "";
        html += "<td><b>" + dbToItDate(r.DataRifornimento) + allegato + "</b></td>";
        html += "<td style='text-align:right; font-family:monospace;'>" + (r.KmAttuali || "-") + trKm + "</td>";
        html += "<td style='text-align:right; font-weight:800; color:#f59e0b;'>" + prezzo + trPrz + "</td>";
        html += "<td style='text-align:center; font-family:monospace;'>" + (r.Litri || "-") + " L" + trLit + "</td>";
        html += "<td style='text-align:right; font-weight:bold; color:#10b981;'>" + tot + trTot + "</td>";
        html += "<td style='font-size:11px; color:#94a3b8;'>" + infoRip + "</td>";
        html += "<td style='text-align:center;'><i class='fa fa-floppy-o row-save-btn' title='Salva questo rifornimento ora' onclick='SalvaRecord(); if(event.stopPropagation)event.stopPropagation(); event.cancelBubble=true;'></i><i class='fa fa-trash row-delete-btn' title='Elimina questo rifornimento' onclick='EliminaRigaRapida(\"rifornimenti\"," + r.ID + ", event)'></i></td>";
        
        tr.innerHTML = html;
        
        tr.onclick = function() {
            var rows = tbody.getElementsByTagName("tr");
            for(var z=0; z<rows.length; z++) rows[z].classList.remove("selected");
            this.classList.add("selected");
            
            selectedRifornimentoIdx = Number(this.getAttribute("data-idx"));
            CaricaDettaglioRifornimento(rifornimentiMemory[selectedRifornimentoIdx]);
        };
        
        tbody.appendChild(tr);
    }
}

function AggiornaGraficoCarburante(datiRaw) {
    try {
        var ctx = document.getElementById('chartPrezzoCarburante');
        if (!ctx) return;
        
        if (chartInst) { chartInst.destroy(); }

        // Crea una copia e ordina in senso cronologico ascendente per il grafico
        var d = datiRaw.slice().sort(function(a,b){ return a.DataRifornimento > b.DataRifornimento ? 1 : -1; });
        
        // Mostra solo gli ultimi 12 record
        if (d.length > 12) d = d.slice(d.length - 12);
        
        var labels = [];
        var pData = [];
        for(var i=0; i<d.length; i++) {
            labels.push(dbToItDate(d[i].DataRifornimento));
            pData.push(parseFloat(d[i].PrezzoAlLitro) || 0);
        }

        // --- CREAZIONE GRADIENTE SFUMATO PREMIUM SOTTO LA LINEA ---
        var chartCtx = ctx.getContext('2d');
        var neonGradient = chartCtx.createLinearGradient(0, 0, 0, 220);
        neonGradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)'); // Ciano semi-trasparente in alto
        neonGradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.1)');
        neonGradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)'); // Completamente trasparente in basso

        chartInst = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Prezzo al Litro (€)',
                    data: pData,
                    borderColor: '#06b6d4',
                    backgroundColor: neonGradient, // Usa il nostro gradiente!
                    borderWidth: 4, // Più spessa e incisiva
                    lineTension: 0.35, // Curve morbide premium
                    fill: true,
                    // --- PUNTI ULTRA-GLOWING NEON ---
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#06b6d4',
                    pointBorderWidth: 3,
                    pointRadius: d.length === 1 ? 8 : 5, // Enorme se c'è solo un record!
                    pointHoverRadius: 9,
                    pointHoverBackgroundColor: '#0ea5e9',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: { display: false },
                title: { 
                    display: true, 
                    text: 'TELEMETRIA COSTO CARBURANTE (Trend Storico)', 
                    fontSize: 13, 
                    fontFamily: 'Inter', 
                    fontColor: '#0ea5e9',
                    fontStyle: '800',
                    padding: 10
                },
                // Layout Padding per evitare il taglio dei pallini giganti in alto/basso
                layout: {
                    padding: { left: 10, right: 15, top: 10, bottom: 10 }
                },
                scales: {
                    yAxes: [{
                        gridLines: { color: 'rgba(51, 65, 85, 0.3)', zeroLineColor: 'rgba(51, 65, 85, 0.6)', drawBorder: false },
                        ticks: { 
                            fontColor: '#94a3b8',
                            fontStyle: 'bold',
                            fontSize: 10,
                            padding: 8,
                            callback: function(val){ return val.toFixed(3) + " €"; } 
                        }
                    }],
                    xAxes: [{
                        gridLines: { display: false }, // Rimuove le linee verticali per un look minimal cockpit!
                        ticks: { 
                            fontColor: '#94a3b8',
                            fontStyle: 'bold',
                            fontSize: 10,
                            padding: 8
                        }
                    }]
                }
            }
        });
    } catch(e) {}
}

function CaricaDettaglioRifornimento(r) {
    document.getElementById("lblIDRif").innerText = r.ID;
    document.getElementById("txtIDRif").value = r.ID;
    document.getElementById("txtDataRifornimento").value = dbToItDate(r.DataRifornimento);
    document.getElementById("txtKmRifornimento").value = r.KmAttuali || "";
    document.getElementById("txtPrezzoLitro").value = r.PrezzoAlLitro || "";
    document.getElementById("txtLitriRifornimento").value = r.Litri || "";
    document.getElementById("txtCostoTotalePieno").value = r.CostoTotale ? Number(r.CostoTotale).toFixed(2) : "";
    document.getElementById("txtNoteRifornimento").value = r.Note || "";
    
    var path = r.PathAllegato || "";
    document.getElementById("txtPathAllegatoRifornimento").value = path;
    document.getElementById("viewFileRifornimento").style.display = path !== "" ? "block" : "none";
}

function NuovoRifornimento() {
    selectedRifornimentoIdx = -1;
    document.getElementById("lblIDRif").innerText = "NUOVO";
    document.getElementById("txtIDRif").value = "";
    
    var d_oggi = new Date();
    var dd = d_oggi.getDate(); if(dd<10) dd="0"+dd;
    var mm = d_oggi.getMonth()+1; if(mm<10) mm="0"+mm;
    document.getElementById("txtDataRifornimento").value = dd + "/" + mm + "/" + d_oggi.getFullYear();
    
    document.getElementById("txtKmRifornimento").value = "";
    document.getElementById("txtPrezzoLitro").value = "";
    document.getElementById("txtLitriRifornimento").value = "";
    document.getElementById("txtCostoTotalePieno").value = "";
    document.getElementById("txtNoteRifornimento").value = "";
    document.getElementById("txtPathAllegatoRifornimento").value = "";
    document.getElementById("viewFileRifornimento").style.display = "none";
    
    var rows = document.getElementById("tbodyRifornimenti").getElementsByTagName("tr");
    for(var z=0; z<rows.length; z++) rows[z].classList.remove("selected");
}

function CalcolaTotalePieno() {
    var valP = document.getElementById("txtPrezzoLitro").value;
    var valL = document.getElementById("txtLitriRifornimento").value;
    if (!valP) valP = "";
    if (!valL) valL = "";
    
    var prezz = parseFloat(valP.replace(",", ".")) || 0;
    var litri = parseFloat(valL.replace(",", ".")) || 0;
    
    var tot = prezz * litri;
    if (tot > 0) {
        document.getElementById("txtCostoTotalePieno").value = tot.toFixed(2).replace(".", ",");
    } else {
        document.getElementById("txtCostoTotalePieno").value = "";
    }
}

function FiltraRifornimenti() {
    var txt = document.getElementById("txtRicerca").value.trim().toLowerCase();
    if (txt === "") {
        RenderRifornimentiTable(rifornimentiMemory);
        return;
    }
    var filtrati = [];
    for (var i = 0; i < rifornimentiMemory.length; i++) {
        var r = rifornimentiMemory[i];
        var nt = String(r.Note || "").toLowerCase();
        var dt = String(dbToItDate(r.DataRifornimento) || "").toLowerCase();
        if (nt.indexOf(txt) > -1 || dt.indexOf(txt) > -1) {
            filtrati.push(r);
        }
    }
    RenderRifornimentiTable(filtrati);
}

// ==========================================
// SEZIONE 2: RIMBORSI CHILOMETRICI
// ==========================================
var nomiMesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

function CalcolaRimborsiMensili() {
    var tbody = document.getElementById("tbodyRimborsi");
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:20px;'>Analisi proporzionale chilometri e carburante in corso...</td></tr>";
    
    var anno = document.getElementById("fltAnnoRimborsi").value;
    var tariffaStr = document.getElementById("txtTariffaKm").value.replace(",", ".");
    var tariffa = parseFloat(tariffaStr);
    if (isNaN(tariffa) || tariffa < 0) tariffa = 0.45;
    
    try {
        // 1. Carica le spese di manutenzione filtrate per l'anno selezionato e raggruppate per mese
        var sqlSpese = "SELECT Costo, DataIntervento FROM tblSpeseVeicolo";
        var resSpese = queryAccessDB(sqlSpese) || [];
        var totSpeseManutenzione = 0;
        var speseMesi = [];
        for (var m = 0; m < 12; m++) { speseMesi.push(0.0); }
        
        for (var s = 0; s < resSpese.length; s++) {
            var sp = resSpese[s];
            var c = parseFloat(sp.Costo || sp.costo) || 0;
            var dt = sp.DataIntervento || sp.dataintervento;
            if (dt) {
                var y = dt.substring(0, 4);
                if (y === anno) {
                    totSpeseManutenzione += c;
                    var mIdx = parseInt(dt.substring(5, 7), 10) - 1;
                    if (mIdx >= 0 && mIdx < 12) {
                        speseMesi[mIdx] += c;
                    }
                }
            }
        }
        if(typeof AnimateSlotMachineNumber === "function") { AnimateSlotMachineNumber("lblTotSpeseBalance", totSpeseManutenzione, " €"); } else { document.getElementById("lblTotSpeseBalance").innerText = totSpeseManutenzione.toFixed(2) + " €"; }
        
        // 2. Recupero Totale Rifornimenti reali dell'anno per la proporzione
        var sqlAllRif = "SELECT * FROM tblRifornimenti ORDER BY KmAttuali ASC"; // Ordiniamo per Km crescenti per calcoli precisi
        var allRif = queryAccessDB(sqlAllRif) || [];
        
        var spesaBenzinaTotaleAnno = 0;
        var litriTotaliValidati = 0;
        var primaRicaricaLitri = 0;
        
        // minKm e maxKm calcolati includendo il punto di calibrazione (per i Km totali dell'auto nell'anno)
        var minKm = 999999999, maxKm = 0;
        
        // minKmRif e maxKmRif calcolati escludendo i punti di calibrazione (solo scontrini reali con litri > 0)
        var minKmRif = 999999999, maxKmRif = 0;
        
        var countValidKm = 0;
        for (var r=0; r<allRif.length; r++) {
            var rRecord = allRif[r];
            if (rRecord.DataRifornimento && rRecord.DataRifornimento.substring(0, 4) === anno) {
                var l = parseFloat(rRecord.Litri) || 0;
                var k = parseCleanKm(rRecord.KmAttuali);
                
                if (!isNaN(k) && k > 0) {
                    // Orometro completo dell'anno (incluso punto zero)
                    if (k < minKm) minKm = k;
                    if (k > maxKm) maxKm = k;
                    
                    // Solo scontrini reali con litri > 0
                    if (l > 0) {
                        spesaBenzinaTotaleAnno += parseFloat(rRecord.CostoTotale) || 0;
                        countValidKm++;
                        litriTotaliValidati += l;
                        if (k < minKmRif) {
                            minKmRif = k;
                            primaRicaricaLitri = l; // Litri del primo pieno reale
                        }
                        if (k > maxKmRif) maxKmRif = k;
                    }
                }
            }
        }
        var kmTotaliAutoNellAnno = (maxKm > minKm && minKm < 999999999) ? (maxKm - minKm) : 0;
        var kmPercorsiPeriodoCarburante = (maxKmRif > minKmRif && minKmRif < 999999999) ? (maxKmRif - minKmRif) : 0;
        var litriConsumatiPerQueiKm = litriTotaliValidati - primaRicaricaLitri;
        var consumoKmLitroReale = (kmPercorsiPeriodoCarburante > 0 && litriConsumatiPerQueiKm > 0) ? (kmPercorsiPeriodoCarburante / litriConsumatiPerQueiKm) : 0;

        // 3. Interroga le consegne lavorative per l'anno selezionato
        var sqlConsegne = "SELECT DataConsegna, MeseRiferimento, AnnoRiferimento, Month(DataConsegna) AS MonthReal, Year(DataConsegna) AS YearReal, KmAndata, KmRitorno, RimborsoAutostrada, RimborsoParcheggio, RimborsoTrenoAvaria, RimborsoVarie, RimborsoNote " +
                           "FROM tblConsegne " +
                           "WHERE ([AnnoRiferimento] = " + anno + ") OR ([AnnoRiferimento] IS NULL AND Year([DataConsegna]) = " + anno + ")";
        var consegne = queryAccessDB(sqlConsegne) || [];
        
        var mesiDati = [];
        for (var m = 0; m < 12; m++) { mesiDati.push({ nConsegne: 0, totKm: 0.0, speseExtra: 0.0, extraDesc: "" }); }
        
        var kmTotaliLavoroAnno = 0;
        for (var i = 0; i < consegne.length; i++) {
            var row = consegne[i];
            var refAnno = row.AnnoRiferimento || row.annoriferimento || row.YearReal || row.yearreal;
            if (parseInt(refAnno, 10) !== parseInt(anno, 10)) continue;
            
            var meseIdx = (row.MeseRiferimento || row.meseriferimento || row.MonthReal || row.monthreal || 0) - 1;
            if (meseIdx >= 0 && meseIdx < 12) {
                mesiDati[meseIdx].nConsegne++;
                var kDist = (parseFloat(row.KmAndata) || 0) + (parseFloat(row.KmRitorno) || 0);
                mesiDati[meseIdx].totKm += kDist;
                
                var rAut = parseFloat(row.RimborsoAutostrada) || 0;
                var rPar = parseFloat(row.RimborsoParcheggio) || 0;
                var rTrn = parseFloat(row.RimborsoTrenoAvaria) || 0;
                var rVar = parseFloat(row.RimborsoVarie) || 0;
                var ex = rAut + rPar + rTrn + rVar;
                mesiDati[meseIdx].speseExtra += ex;
                
                if (ex > 0) {
                    var descrStr = "";
                    if (rAut > 0) descrStr += "Pedaggi " + rAut.toFixed(2) + "€; ";
                    if (rPar > 0) descrStr += "Parcheggio " + rPar.toFixed(2) + "€; ";
                    if (rTrn > 0) descrStr += "Treno " + rTrn.toFixed(2) + "€; ";
                    if (rVar > 0) descrStr += "Varie " + rVar.toFixed(2) + "€; ";
                    if (row.RimborsoNote) descrStr += "Note: " + row.RimborsoNote;
                    mesiDati[meseIdx].extraDesc += "• " + descrStr.trim() + "&#10;";
                }
                
                kmTotaliLavoroAnno += kDist;
            }
        }
        
        // 4. FORMULA MATEMATICA RIPARTIZIONE PROPORZIONALE
        var percUtilizzoLavoro = 0;
        if (kmTotaliAutoNellAnno > 0) {
            percUtilizzoLavoro = kmTotaliLavoroAnno / kmTotaliAutoNellAnno;
            if (percUtilizzoLavoro > 1) percUtilizzoLavoro = 1; // Safe guard
        }
        var fallbackConsumo = parseFloat(document.getElementById("txtConsumoMedio").value.replace(",",".")) || 15.0;
        var fallbackPrezzo = parseFloat(document.getElementById("txtPrezzoCarburante").value.replace(",",".")) || 1.80;
        
        // 5. Calcolo e Render righe mensili
        tbody.innerHTML = "";
        var totRimborsiACI = 0.0;
        
        // --- PRE-CALCOLO MASSIMI PER SPARKLINES ---
        var maxKm = 0.1;
        var maxRimborso = 0.1;
        var maxNet = 0.1;
        var maxDeficit = 0.1;
        
        var rimborsiMesi = [];
        var benzinaMesi = [];
        var netMesi = [];
        
        for (var k = 0; k < 12; k++) {
            var md = mesiDati[k];
            if (md.totKm > maxKm) maxKm = md.totKm;
            
            var tempR = (md.totKm * tariffa) + (md.speseExtra || 0);
            rimborsiMesi.push(tempR);
            if (tempR > maxRimborso) maxRimborso = tempR;
            
            var prezzoCarburanteMese = 0;
            var sommaPrezziMese = 0;
            var conteggioPrezziMese = 0;
            for (var r = 0; r < allRif.length; r++) {
                var rRecord = allRif[r];
                if (rRecord.DataRifornimento && rRecord.DataRifornimento.substring(0, 4) === anno) {
                    var mMese = parseInt(rRecord.DataRifornimento.substring(5, 7), 10) - 1;
                    if (mMese === k) {
                        var pLitro = parseFloat(rRecord.PrezzoAlLitro) || 0;
                        if (pLitro > 0) {
                            sommaPrezziMese += pLitro;
                            conteggioPrezziMese++;
                        }
                    }
                }
            }
            
            if (conteggioPrezziMese > 0) {
                prezzoCarburanteMese = sommaPrezziMese / conteggioPrezziMese;
            } else {
                // Cerca l'ultimo prezzo disponibile in assoluto o usa il fallback
                var ultimoPrezzoTrovato = 0;
                for (var mm = k - 1; mm >= 0; mm--) {
                    for (var r = allRif.length - 1; r >= 0; r--) {
                        var rRecord = allRif[r];
                        if (rRecord.DataRifornimento && rRecord.DataRifornimento.substring(0, 4) === anno) {
                            var mMese = parseInt(rRecord.DataRifornimento.substring(5, 7), 10) - 1;
                            if (mMese === mm) {
                                var pLitro = parseFloat(rRecord.PrezzoAlLitro) || 0;
                                if (pLitro > 0) { ultimoPrezzoTrovato = pLitro; break; }
                            }
                        }
                    }
                    if (ultimoPrezzoTrovato > 0) break;
                }
                if (ultimoPrezzoTrovato === 0) {
                    for (var mm = k + 1; mm < 12; mm++) {
                        for (var r = 0; r < allRif.length; r++) {
                            var rRecord = allRif[r];
                            if (rRecord.DataRifornimento && rRecord.DataRifornimento.substring(0, 4) === anno) {
                                var mMese = parseInt(rRecord.DataRifornimento.substring(5, 7), 10) - 1;
                                if (mMese === mm) {
                                    var pLitro = parseFloat(rRecord.PrezzoAlLitro) || 0;
                                    if (pLitro > 0) { ultimoPrezzoTrovato = pLitro; break; }
                                }
                            }
                        }
                        if (ultimoPrezzoTrovato > 0) break;
                    }
                }
                prezzoCarburanteMese = ultimoPrezzoTrovato > 0 ? ultimoPrezzoTrovato : fallbackPrezzo;
            }
            
            var consumoEffettivo = consumoKmLitroReale > 0 ? consumoKmLitroReale : fallbackConsumo;
            
            var tempB = 0;
            if (md.totKm > 0) {
                tempB = (md.totKm / consumoEffettivo) * prezzoCarburanteMese;
            } else {
                tempB = 0.0;
            }
            benzinaMesi.push(tempB);
            
            var tempN = tempR - tempB - speseMesi[k];
            netMesi.push(tempN);
            
            if (tempN > 0 && tempN > maxNet) maxNet = tempN;
            if (tempN < 0 && Math.abs(tempN) > maxDeficit) maxDeficit = Math.abs(tempN);
        }
        
        for (var m = 0; m < 12; m++) {
            var md = mesiDati[m];
            var rimborsoMese = rimborsiMesi[m];
            totRimborsiACI += rimborsoMese;
            
            var pctKm = (md.totKm / maxKm) * 100;
            var pctRimborso = (rimborsoMese / maxRimborso) * 100;
            
            var benzinaMeseCalculated = benzinaMesi[m];
            var spesaMan = speseMesi[m];
            var netMese = netMesi[m];
            
            var pctNet = 0;
            if (netMese > 0 && maxNet > 0.1) pctNet = (netMese / maxNet) * 100;
            else if (netMese < 0 && maxDeficit > 0.1) pctNet = (Math.abs(netMese) / maxDeficit) * 100;
            
            var tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.setAttribute("data-mese", m);
            tr.setAttribute("data-anno", anno);
            tr.onclick = function() {
                var sibs = tbody.getElementsByTagName("tr");
                for(var z=0; z<sibs.length; z++) {
                    sibs[z].classList.remove("selected");
                }
                this.classList.add("selected");
                
                var meseIdx = parseInt(this.getAttribute("data-mese"), 10);
                var annoVal = this.getAttribute("data-anno");
                MostraDettaglioMensile(meseIdx, annoVal, mesiDati[meseIdx], rimborsiMesi[meseIdx], benzinaMesi[meseIdx], speseMesi[meseIdx], netMesi[meseIdx]);
            };
            
            // EVIDENZA MESE CORRENTE E ALTERNANZA RIGHE
            var dOggi = new Date();
            var mCorrente = dOggi.getMonth(); // 0-11
            var aCorrente = dOggi.getFullYear();
            
            if (m % 2 !== 0) {
                tr.style.backgroundColor = "rgba(30, 41, 59, 0.2)"; // Colorazione scura e carica per l'alternanza delle righe
            }
            
            if (m === mCorrente && parseInt(anno) === aCorrente) {
                tr.classList.add("current-month"); // Applica evidenziazione Oro/Ambra premium (UX-5)
            }
            
            var sqlCheckRettifica = "SELECT ID FROM tblConsegne WHERE ([AnnoRiferimento] = " + anno + " AND [MeseRiferimento] = " + (m + 1) + ") AND ClienteNome LIKE 'RETTIFICA BUSTA PAGA%'";
            var resCheckRett = queryAccessDB(sqlCheckRettifica) || [];
            var haRettifica = (resCheckRett.length > 0);

            var html = "";
            html += "<td>";
            html += "  <div style='display:flex; align-items:center; justify-content:space-between; gap:8px;'>";
            html += "    <span><b>" + nomiMesi[m] + " " + anno + "</b>" + (haRettifica ? " <span title='Allineato con Busta Paga' style='color:#10b981; font-size:12px; margin-left:4px;'><i class='fa fa-check-circle'></i></span>" : "") + "</span>";
            html += "    <button class='no-print btn-allinea-busta' onclick='event.stopPropagation(); ApriModalAllineaBusta(" + m + ", \"" + anno + "\");' title='Allinea con Busta Paga' style='background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; border-radius:6px; padding:2px 7px; font-size:10px; font-weight:800; cursor:pointer; font-family:sans-serif; transition:all 0.2s;' onmouseover='this.style.background=\"rgba(16,185,129,0.3)\";' onmouseout='this.style.background=\"rgba(16,185,129,0.15)\";'>📄 Allinea Busta</button>";
            html += "  </div>";
            html += "</td>";
            html += "<td style='text-align:center;'>" + md.nConsegne + "</td>";
            
            // TELEMETRIA SPARKLINE AZZURRA SU KM
            html += "<td style='text-align:right; font-family:monospace; position:relative; z-index:1;'>";
            if(md.totKm > 0) {
                html += "<div style='position:absolute; right:0; top:4px; bottom:4px; width:" + pctKm.toFixed(0) + "%; background:rgba(14, 165, 233, 0.12); border-right:2.5px solid #0ea5e9; border-radius:3px; z-index:-1;'></div>";
            }
            html += md.totKm.toFixed(1) + " Km</td>";
            
            html += "<td style='text-align:right; font-family:monospace; font-weight:bold; color:#f59e0b;' title='" + (kmTotaliAutoNellAnno>0?"Calcolo Reale Proporzionale":"Stima Teorica") + "'>" + benzinaMeseCalculated.toFixed(2) + " €" + (kmTotaliAutoNellAnno>0?"*":"") + "</td>";
            
            // COLONNA SPESE MANUTENZIONE
            html += "<td style='text-align:right; font-family:monospace; color:#ef4444;" + (spesaMan > 0 ? "font-weight:bold;" : "opacity:0.4;") + "'>";
            html += spesaMan.toFixed(2) + " €</td>";
            
            // COLONNA SPESE EXTRA
            var speseExt = md.speseExtra || 0;
            var tooltipAttr = md.extraDesc ? " data-tooltip='" + md.extraDesc.replace(/'/g, "&apos;") + "'" : "";
            var premiumClass = md.extraDesc ? "premium-tooltip" : "";
            html += "<td class='" + premiumClass + "' style='text-align:right; font-family:monospace; color:#eab308;" + (speseExt > 0 ? "font-weight:bold;" : "opacity:0.4;") + "'" + tooltipAttr + ">";
            html += speseExt.toFixed(2) + " €</td>";
            
            // TELEMETRIA SPARKLINE VERDE SU RIMBORSO
            html += "<td style='text-align:right; font-weight:800; color:#10b981; position:relative; z-index:1;'>";
            if(rimborsoMese > 0) {
                html += "<div style='position:absolute; right:0; top:4px; bottom:4px; width:" + pctRimborso.toFixed(0) + "%; background:rgba(16, 185, 129, 0.12); border-right:2.5px solid #10b981; border-radius:3px; z-index:-1;'></div>";
            }
            html += rimborsoMese.toFixed(2) + " €</td>";
            
            // TELEMETRIA SPARKLINE SU GUADAGNO NETTO
            var colorNet = netMese >= 0 ? "#06b6d4" : "#ef4444";
            var bgNet = netMese >= 0 ? "rgba(6, 182, 212, 0.12)" : "rgba(239, 68, 68, 0.12)";
            var borderNet = netMese >= 0 ? "#06b6d4" : "#ef4444";
            
            html += "<td style='text-align:right; font-weight:800; color:" + colorNet + "; position:relative; z-index:1;'>";
            if(Math.abs(netMese) > 0.01) {
                html += "<div style='position:absolute; right:0; top:4px; bottom:4px; width:" + pctNet.toFixed(0) + "%; background:" + bgNet + "; border-right:2.5px solid " + borderNet + "; border-radius:3px; z-index:-1;'></div>";
            }
            html += (netMese >= 0 ? "+" : "") + netMese.toFixed(2) + " €</td>";
            
            tr.innerHTML = html;
            tbody.appendChild(tr);
        }
        
        // 6. Determinazione Benzina Lavorativa REALE totale (Somma dei costi mensili effettivi)
        var spesaBenzinaAttribuibileLavoro = 0;
        for (var m = 0; m < 12; m++) {
            spesaBenzinaAttribuibileLavoro += benzinaMesi[m];
        }

        // Aggiorna widget bilancio finale
        if (typeof AnimateSlotMachineNumber === "function") {
            AnimateSlotMachineNumber("lblTotRimborsi", totRimborsiACI, " €");
            AnimateSlotMachineNumber("lblTotBenzina", spesaBenzinaAttribuibileLavoro, " €");
        } else {
            document.getElementById("lblTotRimborsi").innerText = totRimborsiACI.toFixed(2) + " €";
            document.getElementById("lblTotBenzina").innerText = spesaBenzinaAttribuibileLavoro.toFixed(2) + " €";
        }
        
        // Se abbiamo dati reali, mostriamo una nota nella label sotto la card
        var notaNode = document.getElementById("lblTotBenzina").parentNode;
        // Rimuoviamo eventuali note vecchie
        var oldN = document.getElementById("infoCalcBenz");
        if(oldN) oldN.parentNode.removeChild(oldN);
        
        var infoDiv = document.createElement("div");
        infoDiv.id = "infoCalcBenz";
        infoDiv.style.fontSize = "10px";
        infoDiv.style.marginTop = "4px";
        
        var containerInfoCostoReale = document.getElementById("infoCostoRealeKM");
        var lblValCostoReale = document.getElementById("lblValCostoReale");

        if (kmTotaliAutoNellAnno > 0) {
            infoDiv.innerHTML = "<b style='color:#38bdf8;'>Ripartizione Reale:</b> " + (percUtilizzoLavoro*100).toFixed(1) + "% utilizzo lavoro su " + kmTotaliAutoNellAnno + "km totali dell'auto.";
            
            // Calcolo del COSTO REALE AL KM dell'intero veicolo (Costo Carburante Reale per Km + Costo Manutenzione per Km)
            var costoCarburanteAlKm = kmPercorsiPeriodoCarburante > 0 ? (spesaBenzinaTotaleAnno / kmPercorsiPeriodoCarburante) : 0;
            var costoManutenzioneAlKm = kmTotaliAutoNellAnno > 0 ? (totSpeseManutenzione / kmTotaliAutoNellAnno) : 0;
            var costoKmReale = costoCarburanteAlKm + costoManutenzioneAlKm;
            if (containerInfoCostoReale && lblValCostoReale) {
                lblValCostoReale.innerText = costoKmReale.toFixed(4).replace(".", ",");
                containerInfoCostoReale.style.display = "block";
            }
        } else {
            infoDiv.innerHTML = "<i style='color:#64748b;'>Inserisci almeno 2 scontrini con i KM per il calcolo reale.</i>";
            if (containerInfoCostoReale) containerInfoCostoReale.style.display = "none";
        }
        notaNode.appendChild(infoDiv);

        // Calcolo NETTO reale
        var net = totRimborsiACI - spesaBenzinaAttribuibileLavoro - totSpeseManutenzione;
        var lblNet = document.getElementById("lblBilancioNetto");
        var cardNet = document.getElementById("cardBilancioNetto");
        
        if(typeof AnimateSlotMachineNumber === "function") { AnimateSlotMachineNumber("lblBilancioNetto", net, " €", (net >= 0 ? "+" : "")); } else { lblNet.innerText = (net >= 0 ? "+" : "") + net.toFixed(2) + " €"; }
        
        if (net >= 0) {
            cardNet.className = "balance-card net positive";
        } else {
            cardNet.className = "balance-card net";
        }
        
        // --- ANALISI SMART E CONSIGLI DINAMICI ---
        var boxAdvice = document.getElementById("divSmartAdvice");
        var lblAdvice = document.getElementById("lblSmartAdviceContent");
        if (boxAdvice && lblAdvice) {
            boxAdvice.style.display = "flex";
            var msg = "";
            
            // 1. Valutazione GUADAGNO NETTO
            if (net > 500) {
                msg = "<b>🏆 Eccellente Strategia Finanziaria!</b> Il tuo Guadagno Netto è solido (" + net.toFixed(0) + "€). Le tue entrate coprono splendidamente sia la benzina che l'usura veicolo. Continua così!";
            } else if (net > 0) {
                msg = "<b>✅ Gestione in Attivo:</b> Stai realmente portando a casa " + net.toFixed(0) + "€ netti depurati da ogni spesa. È una gestione sana e sostenibile nel tempo.";
            } else if (net < 0) {
                msg = "<b>⚠️ Attenzione al Saldo:</b> Attualmente sei in perdita reale di " + Math.abs(net).toFixed(2) + "€. Valuta di rinegoziare la <i>Tariffa Rimborso</i> o ottimizzare le tappe per tornare in profitto.";
            } else {
                msg = "Inserisci i dati delle consegne per sbloccare le mie analisi personalizzate sui tuoi guadagni!";
            }

            // 2. Analisi efficienza CARBURANTE / KM REALE (se ci sono dati)
            if (kmTotaliAutoNellAnno > 0) {
                var costoKmRealeCheck = costoKmReale;
                if (costoKmRealeCheck > 0.22) {
                    msg += "<br><b style='color:#ef4444;'>⛽ SUGGERIMENTO RISPARMIO:</b> Noto che il tuo veicolo ti costa ben " + costoKmRealeCheck.toFixed(2) + "€ al KM (alto). Ti consiglio di verificare la pressione delle gomme, evitare accelerate brusche e cercare distributori 'Self' più economici.";
                } else if (costoKmRealeCheck > 0 && costoKmRealeCheck < 0.15) {
                    msg += "<br><b style='color:#10b981;'>✨ EFFICIENZA TOP:</b> Il tuo costo chilometrico reale (" + costoKmRealeCheck.toFixed(2) + "€/Km) è straordinariamente basso! Stai guidando in modo super efficiente.";
                }
                
                // QUADRO DETTAGLIATO EFFICIENZA & MARGINI (Antigravity Upgrade)
                if (consumoKmLitroReale > 0) {
                    var diffTariffa = tariffa - costoCarburanteAlKm;
                    msg += "<br><br><div style='background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.3); padding:12px; border-radius:10px; margin-top:8px;'>";
                    msg += "<h4 style='color:#10b981; margin:0 0 6px 0; font-size:12.5px; font-weight:800;'><i class='fa fa-dashboard'></i> QUADRO DETTAGLIATO EFFICIENZA & MARGINI</h4>";
                    msg += "• <b>Consumo Medio Reale:</b> <span style='color:#38bdf8; font-weight:bold;'>" + consumoKmLitroReale.toFixed(2) + " Km/Litro</span> (circa " + (100 / consumoKmLitroReale).toFixed(1) + " L/100Km).<br>";
                    msg += "• <b>Costo Carburante Medio:</b> <span style='color:#f59e0b; font-weight:bold;'>" + costoCarburanteAlKm.toFixed(3) + " €/Km</span>.<br>";
                    msg += "• <b>Margine di Rimborso:</b> Ricevi " + tariffa.toFixed(3) + " €/Km contro una spesa viva di " + costoCarburanteAlKm.toFixed(3) + " €/Km, lasciandoti un <b>margine attivo di <span style='color:#10b981; font-weight:bold;'>" + diffTariffa.toFixed(3) + " €/Km</span></b> (il " + ((diffTariffa/tariffa)*100).toFixed(0) + "% del rimborso resta a tuo favore!).";
                    msg += "</div>";
                }
                
                // --- NEW: GAMIFICATION BADGE ECO-DRIVE ---
                var profileWidget = document.getElementById("userProfileWidget");
                if (profileWidget) {
                    var badgeHtml = "";
                    if (costoKmRealeCheck <= 0.12) {
                        badgeHtml = "<span style='color:#fbbf24; background:rgba(251,191,36,0.2); padding:2px 8px; border-radius:12px; font-size:11px;' title=\"Consumi Eccezionali!\"><i class='fa fa-trophy'></i> RANGO: MAESTRO EFFICIENZA</span>";
                    } else if (costoKmRealeCheck <= 0.17) {
                        badgeHtml = "<span style='color:#38bdf8; background:rgba(56,189,248,0.2); padding:2px 8px; border-radius:12px; font-size:11px;'><i class='fa fa-star'></i> RANGO: AUTISTA ESPERTO</span>";
                    } else {
                        badgeHtml = "<span style='color:#94a3b8; background:rgba(148,163,184,0.2); padding:2px 8px; border-radius:12px; font-size:11px;'><i class='fa fa-car'></i> RANGO: ECO-DRIVER JUNIOR</span>";
                    }
                    var uName = (typeof username !== "undefined") ? username : "Corriere";
                    profileWidget.innerHTML = "<i class='fa fa-user-circle' style='font-size:16px; color:#38bdf8;'></i> <span style='margin-right:5px;'>" + uName.toUpperCase() + "</span> " + badgeHtml;
                }
            } else {
                // Default badge se non ci sono km calcolabili
                var profileWidget = document.getElementById("userProfileWidget");
                if (profileWidget && profileWidget.innerHTML.indexOf("RANGO") === -1) {
                    var uName = (typeof username !== "undefined") ? username : "Corriere";
                    profileWidget.innerHTML = "<i class='fa fa-user-circle' style='font-size:16px; color:#38bdf8;'></i> <span style='margin-right:5px;'>" + uName.toUpperCase() + "</span> <span style='color:#94a3b8; background:rgba(148,163,184,0.2); padding:2px 8px; border-radius:12px; font-size:11px;'><i class='fa fa-hourglass-start'></i> IN VALUTAZIONE</span>";
                }
            }
            
            // 3. Alert Spese Manutenzione eccessive
            if (totSpeseManutenzione > spesaBenzinaAttribuibileLavoro && totSpeseManutenzione > 0) {
                msg += "<br><b style='color:#eab308;'>🔧 ALERT MANUTENZIONE:</b> Le spese di officina superano quelle della benzina quest'anno. Tieni d'occhio l'affidabilità del mezzo se fa molti km!";
            }
            
            // 4. Alert Punto Zero Mancante (se manca tracciamento o è iniziato tardi nell'anno)
            var minKmRifCheck = 999999999;
            var mesePrimoRif = 12;
            for (var r = 0; r < allRif.length; r++) {
                if (allRif[r].DataRifornimento && allRif[r].DataRifornimento.substring(0, 4) === anno) {
                    var k = parseInt(allRif[r].KmAttuali, 10);
                    if (!isNaN(k) && k > 0 && k < minKmRifCheck) {
                        minKmRifCheck = k;
                        mesePrimoRif = parseInt(allRif[r].DataRifornimento.substring(5, 7), 10);
                    }
                }
            }
            if (minKmRifCheck === 999999999 || mesePrimoRif > 1) {
                msg += "<br><br><div style='background:rgba(234,179,8,0.1); border:1px solid #eab308; padding:10px; border-radius:8px;'><b style='color:#eab308;'>⚠️ PUNTO ZERO MANCANTE:</b> Non hai impostato i Km del cruscotto all'inizio dell'anno. I grafici non includeranno i Km privati percorsi prima del primo rifornimento inserito. <br><button onclick='CalibraInizioAnno()' style='margin-top:6px; background:#eab308; border:none; color:#0f172a; padding:4px 10px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer;'>CALIBRA ORA</button></div>";
            }

            lblAdvice.innerHTML = msg;
        }

        // --- TRIPLE UPGRADE TELEMETRIA 2026 ---
        try {
            if (typeof AggiornaGraficoRipartizione === "function") {
                AggiornaGraficoRipartizione(totRimborsiACI, spesaBenzinaAttribuibileLavoro, totSpeseManutenzione, net);
            }
            if (typeof AggiornaGraficoAndamento === "function") {
                AggiornaGraficoAndamento(netMesi);
            }
            if (typeof AggiornaGraficoKm === "function") {
                // Calcolo intelligente del tracciamento Km dal primo rifornimento all'ultimo noto
                var minDateRif = "9999-12-31";
                var minKmRif = 999999999;
                for (var r = 0; r < allRif.length; r++) {
                    var rRecord = allRif[r];
                    if (rRecord.DataRifornimento && rRecord.DataRifornimento.substring(0, 4) === anno) {
                        var k = parseInt(rRecord.KmAttuali, 10);
                        if (!isNaN(k) && k > 0 && k < minKmRif) {
                            minKmRif = k;
                            minDateRif = rRecord.DataRifornimento.substring(0, 10);
                        }
                    }
                }
                
                // Salva la data in una variabile globale per poterla usare nella legenda
                window.currentTrackingDate = (minKmRif < 999999999) ? minDateRif : null;
                
                var kmLavoroTracked = 0;
                var kmTotaliTracked = 0;
                
                if (minKmRif < 999999999) {
                    // Somma consegne da quella data in poi
                    for (var cIdx = 0; cIdx < consegne.length; cIdx++) {
                        var cRow = consegne[cIdx];
                        var dc = cRow.DataConsegna;
                        if (dc && dc.substring(0, 10) >= minDateRif) {
                            kmLavoroTracked += (parseFloat(cRow.KmAndata) || 0) + (parseFloat(cRow.KmRitorno) || 0);
                        }
                    }
                    
                    // Ometro Live - Calcolo ESATTO del cruscotto (senza proiezioni future)
                    var baseKmVal = 0;
                    if (allRif && allRif.length > 0) {
                        var lastRif = allRif[allRif.length - 1];
                        baseKmVal = Number(lastRif.KmAttuali) || 0;
                    }
                    
                    kmTotaliTracked = Math.max(0, baseKmVal - minKmRif);
                }
                
                if (kmTotaliTracked > 0) {
                    AggiornaGraficoKm(kmLavoroTracked, kmTotaliTracked, consumoKmLitroReale);
                } else {
                    // Fallback all'intero anno se non ci sono rifornimenti
                    AggiornaGraficoKm(kmTotaliLavoroAnno, kmTotaliAutoNellAnno, consumoKmLitroReale);
                }
            }
            if (typeof CalcolaAutonomiaResidua === "function") {
                var activeConsumo = (consumoKmLitroReale > 0) ? consumoKmLitroReale : (parseFloat(document.getElementById("txtConsumoMedio").value.replace(",",".")) || 15.0);
                CalcolaAutonomiaResidua(activeConsumo);
            }
        } catch(eEx) {}

        // --- AGGIORNA IL SUGGERIMENTO CONSUMO REALE NEGLI INPUT ---
        var divHint = document.getElementById("divRealConsumoHint");
        var lblHintVal = document.getElementById("lblRealConsumoVal");
        if (divHint && lblHintVal) {
            if (consumoKmLitroReale > 0) {
                lblHintVal.innerText = consumoKmLitroReale.toFixed(1).replace(".", ",");
                divHint.style.display = "block";
            } else {
                divHint.style.display = "none";
            }
        }
        
        // FASE 3: Check Pneumatici Stagionali
        if (typeof CheckMeteoGomme === "function") {
            CheckMeteoGomme();
        }
        
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#ef4444; padding:20px;'>Errore nel calcolo rimborsi: " + e.message + "</td></tr>";
    }
}

// ==========================================
// FUNZIONALITÀ PREMIUM: ALLINEAMENTO BUSTA PAGA
// ==========================================
function ApriModalAllineaBusta(mIdx, annoVal) {
    var meseNome = nomiMesi[mIdx];
    var meseNum = mIdx + 1;
    var tariffaStr = document.getElementById("txtTariffaKm").value.replace(",", ".");
    var tariffa = parseFloat(tariffaStr) || 0.45;

    // 1. Calcola i Km e Rimborso Base (senza la rettifica esistente)
    var sqlConsegneBase = "SELECT KmAndata, KmRitorno FROM tblConsegne WHERE ([AnnoRiferimento] = " + annoVal + " AND [MeseRiferimento] = " + meseNum + " OR ([AnnoRiferimento] IS NULL AND Year(DataConsegna) = " + annoVal + " AND Month(DataConsegna) = " + meseNum + ")) AND (ClienteNome NOT LIKE 'RETTIFICA BUSTA PAGA%' OR ClienteNome IS NULL)";
    var resBase = queryAccessDB(sqlConsegneBase) || [];
    var kmBase = 0;
    for (var i = 0; i < resBase.length; i++) {
        kmBase += (parseFloat(resBase[i].KmAndata) || 0) + (parseFloat(resBase[i].KmRitorno) || 0);
    }
    var rimbCalcolatoBase = kmBase * tariffa;

    // 2. Controlla se c'è già una rettifica esistente
    var sqlExistingRett = "SELECT ID, KmAndata FROM tblConsegne WHERE ([AnnoRiferimento] = " + annoVal + " AND [MeseRiferimento] = " + meseNum + ") AND ClienteNome LIKE 'RETTIFICA BUSTA PAGA%'";
    var resExisting = queryAccessDB(sqlExistingRett) || [];
    var kmRettificaEsistente = 0;
    if (resExisting.length > 0) {
        kmRettificaEsistente = parseFloat(resExisting[0].KmAndata) || 0;
    }
    var importoBustaIniziale = (rimbCalcolatoBase + (kmRettificaEsistente * tariffa)).toFixed(2);

    // Rimozione modali esistenti
    var oldModal = document.getElementById("modalAllineaBusta");
    if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);

    var modal = document.createElement("div");
    modal.id = "modalAllineaBusta";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); z-index:10000; display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif;";

    var content = document.createElement("div");
    content.style.cssText = "background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border:1.5px solid #10b981; border-radius:16px; padding:24px; width:450px; box-shadow:0 20px 50px rgba(0,0,0,0.6); color:#f8fafc;";

    var htmlModal = "<div style='display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:16px;'>" +
                    "  <h3 style='margin:0; font-size:16px; font-weight:800; color:#10b981; font-family:\"Outfit\",sans-serif;'>📄 ALLINEAMENTO BUSTA PAGA</h3>" +
                    "  <span onclick='ChiudiModalAllineaBusta()' style='cursor:pointer; color:#94a3b8; font-size:18px; font-weight:bold;'>&times;</span>" +
                    "</div>";

    htmlModal += "<div style='font-size:12px; color:#cbd5e1; margin-bottom:15px; line-height:1.6; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);'>" +
                 "  Mese: <b style='color:#ffffff;'>" + meseNome.toUpperCase() + " " + annoVal + "</b><br>" +
                 "  Rimborso calcolato dai Km del registro: <b style='color:#38bdf8;'>" + rimbCalcolatoBase.toFixed(2) + " €</b> (" + kmBase.toFixed(1) + " Km @ " + tariffa.toFixed(4) + " €/Km)" +
                 "</div>";

    htmlModal += "<div style='background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:14px; margin-bottom:16px;'>" +
                 "  <label style='display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;'>Importo Netto in Busta Paga (€):</label>" +
                 "  <input type='text' id='txtImportoBustaPagaVal' value='" + importoBustaIniziale.replace(".", ",") + "' style='width:100%; background:#0f172a; border:1.5px solid #10b981; color:#10b981; font-size:20px; font-weight:900; padding:10px 12px; border-radius:8px; outline:none; text-align:right; font-family:monospace;' oninput='AggiornaDiffBusta(" + rimbCalcolatoBase + ", " + tariffa + ")'>" +
                 "  <div id='lblDiffBustaCalc' style='margin-top:10px; font-size:12px; font-weight:700; text-align:right; color:#10b981;'></div>" +
                 "</div>";

    htmlModal += "<div style='display:flex; gap:10px; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;'>" +
                 (resExisting.length > 0 ? "  <button onclick='RimuoviRettificaBusta(" + mIdx + ", \"" + annoVal + "\")' style='background:#ef4444; border:none; color:white; padding:10px 14px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;'>Rimuovi Allineamento</button>" : "") +
                 "  <button onclick='SalvaAllineamentoBusta(" + mIdx + ", \"" + annoVal + "\", " + rimbCalcolatoBase + ", " + tariffa + ")' style='background:linear-gradient(135deg, #10b981 0%, #059669 100%); border:none; color:white; padding:10px 18px; border-radius:8px; font-weight:800; font-size:12px; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.3);'>Applica & Allinea ✅</button>" +
                 "</div>";

    content.innerHTML = htmlModal;
    modal.appendChild(content);
    document.body.appendChild(modal);

    setTimeout(function() {
        AggiornaDiffBusta(rimbCalcolatoBase, tariffa);
    }, 50);
}

function AggiornaDiffBusta(rimbCalcolatoBase, tariffa) {
    var inputEl = document.getElementById("txtImportoBustaPagaVal");
    if (!inputEl) return;
    var valStr = inputEl.value.replace(",", ".").trim();
    var valBusta = parseFloat(valStr) || 0;
    var diff = valBusta - rimbCalcolatoBase;
    var lbl = document.getElementById("lblDiffBustaCalc");
    if (!lbl) return;

    if (Math.abs(diff) < 0.01) {
        lbl.innerHTML = "<span style='color:#34d399;'>Nessuna differenza (Coincide al 100%)</span>";
    } else if (diff > 0) {
        var kmNeed = diff / tariffa;
        lbl.innerHTML = "<span style='color:#10b981;'>Eccedenza Busta: +" + diff.toFixed(2).replace(".", ",") + " € (+" + kmNeed.toFixed(2) + " Km)</span>";
    } else {
        var kmNeed = Math.abs(diff) / tariffa;
        lbl.innerHTML = "<span style='color:#f59e0b;'>Deficit Busta: -" + Math.abs(diff).toFixed(2).replace(".", ",") + " € (-" + kmNeed.toFixed(2) + " Km)</span>";
    }
}

function SalvaAllineamentoBusta(mIdx, annoVal, rimbCalcolatoBase, tariffa) {
    var inputEl = document.getElementById("txtImportoBustaPagaVal");
    var valStr = inputEl ? inputEl.value.replace(",", ".").trim() : "0";
    var valBusta = parseFloat(valStr) || 0;
    var diff = valBusta - rimbCalcolatoBase;
    var meseNum = mIdx + 1;

    // Cancella eventuali vecchie rettifiche per questo mese
    var sqlDel = "DELETE FROM tblConsegne WHERE ([AnnoRiferimento] = " + annoVal + " AND [MeseRiferimento] = " + meseNum + ") AND ClienteNome LIKE 'RETTIFICA BUSTA PAGA%'";
    queryAccessDB(sqlDel, true);

    if (Math.abs(diff) >= 0.01) {
        var kmNeed = (diff / tariffa).toFixed(2);
        var sqlIns = "INSERT INTO tblConsegne (DataConsegna, ClienteNome, IndirizzoConsegna, KmAndata, KmRitorno, AnnoRiferimento, MeseRiferimento, Consegnato, Stato) " +
                     "VALUES ('" + annoVal + "-" + (meseNum < 10 ? "0" + meseNum : meseNum) + "-28', 'RETTIFICA BUSTA PAGA (CONGUAGLIO " + nomiMesi[mIdx].toUpperCase() + ")', 'Ufficio Logistica / Amministrazione', '" + kmNeed + "', '0', '" + annoVal + "', '" + meseNum + "', '1', 'Consegnato')";
        queryAccessDB(sqlIns, true);
    }

    ChiudiModalAllineaBusta();
    if (typeof ShowSystemToast === "function") {
        ShowSystemToast("Allineamento Completato", "Il rimborso di " + nomiMesi[mIdx] + " " + annoVal + " è stato allineato a " + valBusta.toFixed(2) + " €", "success");
    } else {
        alert("Allineamento completato a " + valBusta.toFixed(2) + " €");
    }
    CalcolaRimborsiMensili();
}

function RimuoviRettificaBusta(mIdx, annoVal) {
    var meseNum = mIdx + 1;
    var sqlDel = "DELETE FROM tblConsegne WHERE ([AnnoRiferimento] = " + annoVal + " AND [MeseRiferimento] = " + meseNum + ") AND ClienteNome LIKE 'RETTIFICA BUSTA PAGA%'";
    queryAccessDB(sqlDel, true);
    ChiudiModalAllineaBusta();
    if (typeof ShowSystemToast === "function") {
        ShowSystemToast("Rettifica Rimossa", "Rettifica per " + nomiMesi[mIdx] + " rimossa con successo.", "info");
    }
    CalcolaRimborsiMensili();
}

function ChiudiModalAllineaBusta() {
    var oldModal = document.getElementById("modalAllineaBusta");
    if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);
}

function MostraDettaglioMensile(mIdx, annoVal, infoMese, rimborso, benzina, manutenzione, netto) {
    // 1. Rimuovi eventuali modal esistenti
    var oldModal = document.getElementById("modalDettaglioMensile");
    if(oldModal) {
        try { oldModal.parentNode.removeChild(oldModal); } catch(e){}
    }
    
    // 2. Trova le manutenzioni registrate in questo mese
    var interventi = [];
    try {
        var sql = "SELECT Descrizione, Costo, DataIntervento, TipoIntervento FROM tblSpeseVeicolo";
        var resSpese = queryAccessDB(sql) || [];
        var meseStr = (mIdx + 1) < 10 ? "0" + (mIdx + 1) : "" + (mIdx + 1);
        var prefix = annoVal + "-" + meseStr;
        
        for (var s = 0; s < resSpese.length; s++) {
            var sp = resSpese[s];
            var dt = sp.DataIntervento || sp.dataintervento;
            if (dt && dt.substring(0, 7) === prefix) {
                interventi.push({
                    desc: sp.Descrizione || sp.descrizione || "Intervento",
                    costo: parseFloat(sp.Costo || sp.costo) || 0,
                    tipo: sp.TipoIntervento || sp.tipointervento || "ORDINARIA"
                });
            }
        }
    } catch(err){}
    
    // 3. Costruisci il modal
    var modal = document.createElement("div");
    modal.id = "modalDettaglioMensile";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 17, 32, 0.85); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:'Inter', sans-serif; backdrop-filter: blur(8px);";
    
    var box = document.createElement("div");
    box.style.cssText = "background:#0f172a; width:520px; border:2px solid #06b6d4; border-radius:20px; padding:25px; box-shadow:0 0 40px rgba(6, 182, 212, 0.25); position:relative; color:#e2e8f0; animation: fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);";
    
    // Stile animazione
    if (!document.getElementById("styleFadeInScale")) {
        var style = document.createElement("style");
        style.id = "styleFadeInScale";
        style.innerHTML = "@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }";
        document.getElementsByTagName("head")[0].appendChild(style);
    }
    
    var closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = "position:absolute; top:12px; right:18px; background:none; border:none; font-size:26px; cursor:pointer; color:#94a3b8; font-weight:bold; outline:none;";
    closeBtn.onclick = function() { try { modal.parentNode.removeChild(modal); } catch(e){} };
    box.appendChild(closeBtn);
    
    // Calcolo dei totali parziali per Officina ed Emergenza
    var totOfficina = 0;
    var totEmergenze = 0;
    for (var i = 0; i < interventi.length; i++) {
        if (interventi[i].tipo === "EMERGENZA") {
            totEmergenze += interventi[i].costo;
        } else {
            totOfficina += interventi[i].costo;
        }
    }

    // Bottone Voice Mese
    var voiceMeseBtn = document.createElement("button");
    voiceMeseBtn.innerHTML = "<i class='fa fa-volume-up'></i> ASCOLTA";
    voiceMeseBtn.style.cssText = "position:absolute; top:16px; right:55px; background:none; border:none; font-size:11px; cursor:pointer; color:#06b6d4; font-weight:bold; outline:none; display:flex; align-items:center; gap:5px;";
    voiceMeseBtn.onclick = function() {
        var meseNome = nomiMesi[mIdx];
        var text = "Rapporto dettagliato per " + meseNome + " " + annoVal + ". ";
        text += "Distanza lavorativa percorsa: " + infoMese.totKm.toFixed(0) + " chilometri, suddivisi in " + infoMese.nConsegne + " consegne. ";
        text += "Rimborso maturato: " + rimborso.toFixed(2).replace(".", ",") + " euro. ";
        text += "Costo benzina stimato: " + benzina.toFixed(2).replace(".", ",") + " euro. ";
        if (totOfficina > 0) {
            text += "Spese di officina sostenute: " + totOfficina.toFixed(2).replace(".", ",") + " euro. ";
        }
        if (totEmergenze > 0) {
            text += "Spese per emergenze in servizio sostenute: " + totEmergenze.toFixed(2).replace(".", ",") + " euro. ";
        }
        if (netto >= 0) {
            text += "Il bilancio mensile registra un margine positivo di " + netto.toFixed(2).replace(".", ",") + " euro.";
        } else {
            text += "Il bilancio mensile registra una perdita netta di " + Math.abs(netto).toFixed(2).replace(".", ",") + " euro.";
        }
        LeggiTestoVocale(text);
    };
    box.appendChild(voiceMeseBtn);
    
    var title = document.createElement("h2");
    title.innerHTML = "📊 ANALISI MENSILE DETTAGLIATA";
    title.style.cssText = "font-size:16px; font-weight:800; color:#06b6d4; margin:0 0 5px 0; text-transform:uppercase; letter-spacing:0.8px;";
    box.appendChild(title);
    
    var subtitle = document.createElement("div");
    subtitle.innerHTML = nomiMesi[mIdx] + " " + annoVal;
    subtitle.style.cssText = "font-size:22px; font-weight:900; color:#ffffff; margin-bottom:20px; border-bottom:1px solid #334155; padding-bottom:10px;";
    box.appendChild(subtitle);
    
    var content = document.createElement("div");
    content.style.cssText = "display:flex; flex-direction:column; gap:18px;";
    
    // Sezione 1: Telemetria Attività
    var sec1 = "";
    sec1 += "<div style='background:rgba(30, 41, 59, 0.4); border:1px solid #334155; border-radius:12px; padding:12px 16px;'>";
    sec1 += "  <b style='color:#0ea5e9; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;'>🚗 Telemetria di Viaggio</b>";
    sec1 += "  <div style='display:flex; justify-content:space-between; margin-top:8px; font-size:13px;'>";
    sec1 += "    <span>Consegne Effettuate:</span> <b>" + infoMese.nConsegne + "</b>";
    sec1 += "  </div>";
    sec1 += "  <div style='display:flex; justify-content:space-between; margin-top:5px; font-size:13px;'>";
    sec1 += "    <span>Distanza Percorsa:</span> <b>" + infoMese.totKm.toFixed(1) + " Km</b>";
    sec1 += "  </div>";
    sec1 += "</div>";
    
    // Sezione 2: Lista Manutenzioni
    var sec2 = "";
    sec2 += "<div style='background:rgba(30, 41, 59, 0.4); border:1px solid #334155; border-radius:12px; padding:12px 16px;'>";
    sec2 += "  <b style='color:#ef4444; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;'>🔧 Spese ed Emergenze del Mese</b>";
    sec2 += "  <div style='margin-top:8px; max-height:100px; overflow-y:auto;'>";
    if (interventi.length === 0) {
        sec2 += "    <div style='font-size:12px; color:#64748b; font-style:italic;'>Nessuna spesa registrata in questo mese.</div>";
    } else {
        for (var i = 0; i < interventi.length; i++) {
            var icon = "🔧";
            var color = "#ef4444";
            if (interventi[i].tipo === "EMERGENZA") {
                icon = "⚠️";
                color = "#f59e0b";
            } else if (interventi[i].tipo === "STRAORDINARIA") {
                icon = "🚨";
            }
            sec2 += "    <div style='display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:5px;'>";
            sec2 += "      <span style='color:#e2e8f0;'>" + icon + " " + interventi[i].desc.toUpperCase() + "</span>";
            sec2 += "      <b style='color:" + color + "; font-family:monospace;'>" + interventi[i].costo.toFixed(2) + " €</b>";
            sec2 += "    </div>";
        }
    }
    sec2 += "  </div>";
    sec2 += "</div>";
    
    // Sezione 3: Bilancio e Verdetto
    var sec3 = "";
    var verdettoColor = netto >= 0 ? "#10b981" : "#ef4444";
    var verdettoBg = netto >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)";
    var verdettoText = netto >= 0 ? "MARGINE IN ATTIVO" : "PERDITA RILEVATA";
    
    sec3 += "<div style='background:" + verdettoBg + "; border:1.5px solid " + verdettoColor + "; border-radius:12px; padding:15px; text-align:center;'>";
    sec3 += "  <div style='font-size:10px; font-weight:800; color:" + verdettoColor + "; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;'>" + verdettoText + "</div>";
    sec3 += "  <div style='font-size:28px; font-weight:900; color:" + verdettoColor + "; font-family:monospace;'>" + (netto >= 0 ? "+" : "") + netto.toFixed(2) + " €</div>";
    sec3 += "  <div style='margin-top:10px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px; display:flex; justify-content:space-around; font-size:10px; color:#94a3b8; flex-wrap:wrap; gap:8px;'>";
    sec3 += "    <div>Rimborsi: <b style='color:#10b981; font-family:monospace;'>+" + rimborso.toFixed(2) + "€</b></div>";
    sec3 += "    <div>Benzina: <b style='color:#f59e0b; font-family:monospace;'>-" + benzina.toFixed(2) + "€</b></div>";
    sec3 += "    <div>Officina: <b style='color:#ef4444; font-family:monospace;'>-" + totOfficina.toFixed(2) + "€</b></div>";
    if (totEmergenze > 0) {
        sec3 += "    <div>Emergenze: <b style='color:#f59e0b; font-family:monospace;'>-" + totEmergenze.toFixed(2) + "€</b></div>";
    }
    sec3 += "  </div>";
    sec3 += "</div>";
    
    content.innerHTML = sec1 + sec2 + sec3;
    box.appendChild(content);
    
    // Row di bottoni (Generazione Nota Spese + Chiudi)
    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px;";
    
    var printNotaBtn = document.createElement("button");
    printNotaBtn.innerHTML = "<i class='fa fa-print'></i> GENERA NOTA SPESE";
    printNotaBtn.style.cssText = "background:#10b981; color:#ffffff; padding:10px 20px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-family:'Inter',sans-serif; font-size:11.5px; transition:0.2s; outline:none; box-shadow:0 0 15px rgba(16,185,129,0.3);";
    printNotaBtn.onmouseover = function(){ this.style.background="#059669"; };
    printNotaBtn.onmouseout = function(){ this.style.background="#10b981"; };
    printNotaBtn.onclick = function() {
        GeneraNotaSpeseMensile(mIdx, annoVal, infoMese, rimborso, benzina, manutenzione, netto, interventi);
    };
    btnRow.appendChild(printNotaBtn);
    
    var okBtn = document.createElement("button");
    okBtn.innerText = "CHIUDI DETTAGLIO";
    okBtn.style.cssText = "background:#334155; color:#ffffff; padding:10px 20px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-family:'Inter',sans-serif; font-size:11.5px; transition:0.2s; outline:none;";
    okBtn.onmouseover = function(){ this.style.background="#475569"; };
    okBtn.onmouseout = function(){ this.style.background="#334155"; };
    okBtn.onclick = function() { try { modal.parentNode.removeChild(modal); } catch(e){} };
    btnRow.appendChild(okBtn);
    
    box.appendChild(btnRow);
    
    modal.appendChild(box);
    document.body.appendChild(modal);
}

// ==========================================
// SEZIONE 3: DOCUMENTI E SCADENZE AUTO
// ==========================================
function CaricaVeicoli() {
    var tbody = document.getElementById("tbodyVeicoli");
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px;'>Caricamento in corso...</td></tr>";
    
    try {
        var sql = "SELECT * FROM tblVeicoli ORDER BY Modello ASC";
        veicoliMemory = queryAccessDB(sql) || [];
        
        // --- INTELLIGENZA ARTIFICIALE: AUTOPILOTA CHILOMETRICO ---
        // 1. Cerchiamo l'ultimo rifornimento noto per stabilire la base di partenza certa
        var sqlRif = "SELECT TOP 1 KmAttuali, DataRifornimento FROM tblRifornimenti ORDER BY DataRifornimento DESC, ID DESC";
        var resRif = queryAccessDB(sqlRif) || [];
        var baseKm = 0;
        var baseDate = "";
        if (resRif && resRif.length > 0) {
            baseKm = Number(resRif[0].KmAttuali) || 0;
            baseDate = resRif[0].DataRifornimento || "";
        }
        
        // 2. Sommiamo i Km di tutte le consegne fatte da quella data ad oggi & Calcolo Media Giornaliera
        var extraKm = 0;
        var dailyAvg = 25; // Fallback ragionevole
        if (baseDate !== "" && baseKm > 0) {
            var aCurr = new Date().getFullYear();
            var sqlC = "SELECT DataConsegna, KmAndata, KmRitorno FROM tblConsegne WHERE Year(DataConsegna) = " + aCurr;
            var rowsC = queryAccessDB(sqlC) || [];
            
            var limitStr = baseDate.substring(0, 10);
            var minDateStr = "9999-12-31", maxDateStr = "0000-01-01";
            var totalYearlyKm = 0;
            
            for (var j=0; j<rowsC.length; j++) {
                var dc = rowsC[j].DataConsegna;
                if (!dc) continue;
                var curDate = dc.substring(0, 10);
                
                var rowKm = (Number(rowsC[j].KmAndata) || 0) + (Number(rowsC[j].KmRitorno) || 0);
                totalYearlyKm += rowKm;
                
                if (curDate < minDateStr) minDateStr = curDate;
                if (curDate > maxDateStr) maxDateStr = curDate;
                
                // Somma progressiva per l'autopilota (dal rifornimento in poi)
                if (curDate >= limitStr) {
                    extraKm += rowKm;
                }
            }
            
            // Calcolo media reale sull'arco temporale dell'anno
            if (minDateStr !== "9999-12-31" && maxDateStr !== "0000-01-01") {
                var dMin = new Date(minDateStr.replace(/-/g, '/'));
                var dMax = new Date(maxDateStr.replace(/-/g, '/'));
                var diffG = Math.floor((dMax - dMin) / (1000 * 60 * 60 * 24)) + 1;
                if (diffG > 0 && totalYearlyKm > 0) {
                    dailyAvg = totalYearlyKm / diffG;
                    if (dailyAvg < 5) dailyAvg = 5; // Soglia minima realistica
                }
            }
        }
        
        // 3. Calcoliamo il cruscotto reale dinamico e proiezioni future
        var liveOdometer = Math.floor(baseKm + extraKm);
        
        // 4. Aggiorniamo dati e calcoliamo PREVISIONE TAGLIANDO
        for (var i=0; i<veicoliMemory.length; i++) {
            var old = Number(veicoliMemory[i].KmAttuali) || 0;
            // Inietta live odometer se superiore
            if (liveOdometer > 0 && liveOdometer > old) {
                veicoliMemory[i].KmAttuali = liveOdometer;
            }
            
            // Motore Predittivo
            var thr = Number(veicoliMemory[i].SogliaTagliando) || 0;
            var currentNow = Number(veicoliMemory[i].KmAttuali) || 0;
            if (thr > 0 && currentNow > 0 && thr > currentNow) {
                var kmMancanti = thr - currentNow;
                var giorniAlTarget = Math.floor(kmMancanti / dailyAvg);
                var targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + giorniAlTarget);
                
                // Formattazione data ITA
                var d = targetDate.getDate();
                var m = targetDate.getMonth() + 1;
                veicoliMemory[i].PrevisioneTagliando = (d < 10 ? '0'+d : d) + "/" + (m < 10 ? '0'+m : m) + "/" + targetDate.getFullYear();
            } else {
                veicoliMemory[i].PrevisioneTagliando = null;
            }
        }
        // -------------------------------------------------------

        // AGGIORNAMENTO PRO: Popoliamo ENTRAMBE le viste contemporaneamente!
        RenderVeicoliTable(veicoliMemory);
        RenderVeicoliPostIt(veicoliMemory);
        
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='6' style='color:red; text-align:center;'>Errore: " + e.message + "</td></tr>";
    }
}

function RenderVeicoliTable(arr) {
    var tbody = document.getElementById("tbodyVeicoli");
    tbody.innerHTML = "";
    
    if (arr.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#94a3b8;'>Nessun veicolo registrato.</td></tr>";
        return;
    }
    
    for (var i = 0; i < arr.length; i++) {
        var v = arr[i];
        var tr = document.createElement("tr");
        tr.setAttribute("data-idx", i);
        
        var html = "";
        html += "<td>" + v.ID + "</td>";
        html += "<td><b>" + (v.Modello || "-").toUpperCase() + "</b></td>";
        html += "<td><span style='font-family:monospace; font-weight:bold; background:#1e293b; padding:2px 6px; border-radius:4px; border:1px solid #334155; color:#e2e8f0;'>" + (v.Targa || "-").toUpperCase() + "</span></td>";
        html += "<td>" + getScadenzaBadge(v.ScadenzaAssicurazione) + "</td>";
        html += "<td>" + dbToItDate(v.ScadenzaRevisione) + "</td>";
        html += "<td>" + (v.KmAttuali || "-") + "</td>";
        html += "<td style='text-align:center;'><i class='fa fa-floppy-o row-save-btn' title='Salva dati veicolo ora' onclick='SalvaRecord(); if(event.stopPropagation)event.stopPropagation(); event.cancelBubble=true;'></i><i class='fa fa-trash row-delete-btn' title='Elimina veicolo' onclick='EliminaRigaRapida(\"scadenze\"," + v.ID + ", event)'></i></td>";
        
        tr.innerHTML = html;
        
        tr.onclick = function() {
            var rows = tbody.getElementsByTagName("tr");
            for(var z=0; z<rows.length; z++) rows[z].classList.remove("selected");
            this.classList.add("selected");
            
            selectedVeicoloIdx = Number(this.getAttribute("data-idx"));
            var selectedCar = veicoliMemory[selectedVeicoloIdx];
            CaricaDettaglioVeicolo(selectedCar);
            if (typeof AggiornaXrayRadar === "function") {
                AggiornaXrayRadar(selectedCar);
            }
        };
        
        tbody.appendChild(tr);
    }
}

// --- NUOVA FUNZIONE RENDER POST-IT (VISTA ALTERNATIVA) ---
function RenderVeicoliPostIt(arr) {
    var board = document.getElementById("boardPostit");
    if(!board) return;
    board.innerHTML = "";
    
    if (arr.length === 0) {
        board.innerHTML = "<div style='color:#94a3b8; font-style:italic; padding:20px;'>Nessun veicolo trovato nella ricerca.</div>";
        return;
    }
    
    for (var i = 0; i < arr.length; i++) {
        var v = arr[i];
        var card = document.createElement("div");
        card.className = "post-it-card";
        card.setAttribute("data-idx", i);
        card.title = "Clicca per vedere/modificare il dettaglio";
        
        var html = "";
        html += "<div class='post-it-pin'></div>";
        html += "<div class='post-it-header'>";
        html += "  <span class='post-it-id'>#" + v.ID + "</span>";
        html += "  <span class='post-it-targa'>" + (v.Targa || "N/D").toUpperCase() + "</span>";
        html += "</div>";
        
        html += "<div class='post-it-title'>" + (v.Modello || "Veicolo Senza Nome").toUpperCase() + "</div>";
        
        html += "<div class='post-it-scad-row'><i class='fa fa-shield' style='width:16px;'></i> <b>Assic.:</b> " + (dbToItDate(v.ScadenzaAssicurazione) || "--") + "</div>";
        html += "<div class='post-it-scad-row'><i class='fa fa-calendar-check-o' style='width:16px;'></i> <b>Revisione:</b> " + (dbToItDate(v.ScadenzaRevisione) || "--") + "</div>";
        html += "<div class='post-it-scad-row'><i class='fa fa-eur' style='width:16px;'></i> <b>Bollo:</b> " + (dbToItDate(v.ScadenzaBollo) || "--") + "</div>";
        
        // NUOVA SEZIONE PREDIZIONE PRO
        if (v.PrevisioneTagliando) {
            html += "<div class='post-it-pred-box'>";
            html += "  <i class='fa fa-magic'></i> <span>Previsione Tagliando: <b>" + v.PrevisioneTagliando + "</b></span>";
            html += "</div>";
        }
        
        html += "<div class='post-it-footer'>";
        html += "  <div class='post-it-km'><i class='fa fa-tachometer'></i> " + (v.KmAttuali || 0) + " Km</div>";
        html += "  <div>";
        html += "    <i class='fa fa-floppy-o row-save-btn' style='opacity:0.9; margin-right:12px; font-size:16px;' onclick='SalvaRecord(); if(event.stopPropagation)event.stopPropagation(); event.cancelBubble=true;' title='Salva Ora'></i>";
        html += "    <i class='fa fa-trash row-delete-btn' style='opacity:0.9; font-size:16px;' onclick='EliminaRigaRapida(\"scadenze\"," + v.ID + ", event)' title='Elimina'></i>";
        html += "  </div>";
        html += "</div>";
        
        card.innerHTML = html;
        
        card.onclick = function() {
            var cards = document.getElementById("boardPostit").getElementsByClassName("post-it-card");
            for(var z=0; z<cards.length; z++) { 
                cards[z].classList.remove("selected"); 
                cards[z].style.border = ""; // Pulisci eventuali stili inline residui legacy
            }
            this.classList.add("selected");
            
            selectedVeicoloIdx = Number(this.getAttribute("data-idx"));
            CaricaDettaglioVeicolo(veicoliMemory[selectedVeicoloIdx]);
        };
        
        board.appendChild(card);
    }
    // FASE 3: Aggiornamento automatico primo radar
    if (arr.length > 0 && typeof AggiornaXrayRadar === "function") {
        AggiornaXrayRadar(arr[0]);
    }
}

function CambiaVistaScadenze(tipo) {
    var tab = document.getElementById("containerVistaTabella");
    var postit = document.getElementById("containerVistaPostit");
    var btnTab = document.getElementById("btnViewTabella");
    var btnPost = document.getElementById("btnViewPostit");
    if(!tab || !postit) return;
    
    if (tipo === "postit") {
        tab.style.display = "none";
        postit.style.display = "block";
        btnTab.className = "view-toggle-btn";
        btnPost.className = "view-toggle-btn active";
    } else {
        tab.style.display = "block";
        postit.style.display = "none";
        btnTab.className = "view-toggle-btn active";
        btnPost.className = "view-toggle-btn";
    }
}

function CaricaDettaglioVeicolo(v) {
    document.getElementById("lblIDVeh").innerText = v.ID;
    document.getElementById("txtIDVeh").value = v.ID;
    document.getElementById("txtModello").value = v.Modello || "";
    document.getElementById("txtTarga").value = (v.Targa || "").toUpperCase();
    document.getElementById("txtScadenzaAssicurazione").value = dbToItDate(v.ScadenzaAssicurazione);
    document.getElementById("txtScadenzaBollo").value = dbToItDate(v.ScadenzaBollo);
    document.getElementById("txtScadenzaRevisione").value = dbToItDate(v.ScadenzaRevisione);
    document.getElementById("txtKmAttuali").value = v.KmAttuali || "";
    document.getElementById("txtSogliaTagliando").value = v.SogliaTagliando || "";
    document.getElementById("txtNoteVeh").value = v.Note || "";
    
    // FASE 6: Innesca X-RAY SALUTE
    document.getElementById("xrayPanel").style.display = "block";
    LoadAndRenderXray(v.ID, v.KmAttuali);
}

function NuovoVeicolo() {
    selectedVeicoloIdx = -1;
    document.getElementById("lblIDVeh").innerText = "NUOVO";
    document.getElementById("txtIDVeh").value = "";
    document.getElementById("txtModello").value = "";
    document.getElementById("txtTarga").value = "";
    document.getElementById("txtScadenzaAssicurazione").value = "";
    document.getElementById("txtScadenzaBollo").value = "";
    document.getElementById("txtScadenzaRevisione").value = "";
    document.getElementById("txtKmAttuali").value = "";
    document.getElementById("txtSogliaTagliando").value = "";
    document.getElementById("txtNoteVeh").value = "";
    
    // FASE 6: Nascondi X-RAY su nuovo record
    document.getElementById("xrayPanel").style.display = "none";
    
    var rows = document.getElementById("tbodyVeicoli").getElementsByTagName("tr");
    for(var z=0; z<rows.length; z++) rows[z].classList.remove("selected");
}

function FiltraVeicoli() {
    var txt = document.getElementById("txtRicerca").value.trim().toLowerCase();
    if (txt === "") {
        RenderVeicoliTable(veicoliMemory);
        RenderVeicoliPostIt(veicoliMemory); // Aggiorna anche vista post-it!
        return;
    }
    var filtrati = [];
    for (var i = 0; i < veicoliMemory.length; i++) {
        var v = veicoliMemory[i];
        var haystack = (v.Modello + " " + v.Targa).toLowerCase();
        if (haystack.indexOf(txt) !== -1) {
            filtrati.push(v);
        }
    }
    RenderVeicoliTable(filtrati);
    RenderVeicoliPostIt(filtrati); // Aggiorna anche vista post-it!
}

// ==========================================
// OPERAZIONI BARRA COMUNI (NUOVO, SALVA, ELIMINA)
// ==========================================
function NuovoRecord() {
    // Se siamo nel tab Rimborsi (che è in sola lettura), ci spostiamo su Spese automaticamente
    if (currentTab === "rimborsi") {
        SwitchSubTab("spese");
    }
    
    if (currentTab === "spese") {
        NuovoSpesa();
        try { document.getElementById("txtDescrizioneSpesa").focus(); } catch(e) {}
    } else if (currentTab === "rifornimenti") {
        NuovoRifornimento();
        try { document.getElementById("txtKmRifornimento").focus(); } catch(e) {}
    } else if (currentTab === "scadenze") {
        NuovoVeicolo();
        try { document.getElementById("txtModello").focus(); } catch(e) {}
    }
}

function sqlEscape(str) {
    if(!str) return "";
    return str.replace(/'/g, "''");
}

function EliminaRigaRapida(tipo, id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    else if (window.event) window.event.cancelBubble = true; // IE legacy stopPropagation

    if (!id) return;
    
    var msg = "Sei sicuro di voler eliminare definitivamente questo elemento?";
    if (tipo === "scadenze") msg = "ATTENZIONE! Eliminando il veicolo cancellerai tutti i suoi dati. Continuare?";
    
    if (!confirm(msg)) return;
    
    var sql = "";
    if (tipo === "spese") sql = "DELETE FROM tblSpeseVeicolo WHERE ID = " + id;
    else if (tipo === "rifornimenti") sql = "DELETE FROM tblRifornimenti WHERE ID = " + id;
    else if (tipo === "scadenze") sql = "DELETE FROM tblVeicoli WHERE ID = " + id;
    
    if (sql !== "" && queryAccessDB(sql, true)) {
        // Messaggio Feedback Transazionale
        if (tipo === "spese") { CaricaSpese(); NuovoSpesa(); }
        else if (tipo === "rifornimenti") {
            AggiornaOdimetroVeicoloAutomatico();
            CaricaRifornimenti();
            NuovoRifornimento();
        }
        else if (tipo === "scadenze") { CaricaVeicoli(); NuovoVeicolo(); }
    } else {
        alert("Si è verificato un problema durante l'eliminazione del record.");
    }
}

// --- GESTORE ALLEGATI HARDWARE SHELL ---
function SelezionaAllegato(scope) {
    // Creiamo input invisibile HTML, in HTA ci dà il full path del file scelto
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.style.display = "none";
    
    input.onchange = function() {
        var source = this.value;
        if (!source || source === "") return;
        
        try {
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            if (!fso.FileExists(source)) { alert("File non accessibile o inesistente."); return; }
            
            var ext = fso.GetExtensionName(source);
            var timestamp = new Date().getTime();
            var destName = (scope === 'rifornimenti' ? "RIF_" : "MAN_") + timestamp + "." + ext;
            
            var p = document.location.pathname;
            if (p.indexOf("/") === 0) p = p.substring(1);
            p = decodeURIComponent(p).replace(/\//g, "\\");
            var base = fso.GetParentFolderName(p);
            
            var subDir = (scope === 'rifornimenti' ? "Allegati_Veicolo\\Rifornimenti\\" : "Allegati_Veicolo\\Manutenzioni\\");
            var fullDest = fso.BuildPath(fso.BuildPath(base, subDir), destName);
            
            fso.CopyFile(source, fullDest, true);
            
            // Salva solo path relativo nel DB
            var relPath = subDir + destName;
            
            if (scope === 'rifornimenti') {
                document.getElementById("txtPathAllegatoRifornimento").value = relPath;
                document.getElementById("viewFileRifornimento").style.display = "block";
            } else {
                document.getElementById("txtPathAllegatoSpesa").value = relPath;
                document.getElementById("viewFileSpesa").style.display = "block";
            }
            alert("Documento collegato e salvato in archivio!");
            
        } catch(ex) {
            alert("Si è verificato un errore nella copia del file:\n" + ex.message);
        }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(function(){ try{document.body.removeChild(input);}catch(e){} }, 2000);
}

function ApriAllegato(relPath) {
    if (!relPath || relPath === "") return;
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var sh = new ActiveXObject("WScript.Shell");
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var base = fso.GetParentFolderName(p);
        
        var full = base + "\\" + relPath;
        if (fso.FileExists(full)) {
            sh.Run('"' + full + '"', 1, false);
        } else {
            alert("Allegato non trovato sul disco.");
        }
    } catch(e) {
        alert("Errore nell'apertura dell'allegato.");
    }
}

function SalvaRecord() {
    if (currentTab === "spese") {
        var id = document.getElementById("txtIDSpesa").value;
        var data = itToDbDate(document.getElementById("txtDataSpesa").value.trim());
        var desc = document.getElementById("txtDescrizioneSpesa").value.trim();
        var cost = document.getElementById("txtCostoSpesa").value.trim().replace(",", ".");
        var note = document.getElementById("txtNoteSpesa").value.trim();
        var tipoInt = document.getElementById("cmbTipoIntervento").value;
        var pathAll = document.getElementById("txtPathAllegatoSpesa").value;
        
        if (data === "" || desc === "" || cost === "") {
            alert("Data, Descrizione e Costo sono obbligatori.");
            return;
        }
        
        var sql = "";
        if (id === "") {
            sql = "INSERT INTO tblSpeseVeicolo (DataIntervento, Descrizione, Costo, Note, TipoIntervento, PathAllegato) " +
                  "VALUES ('" + data + "', '" + sqlEscape(desc) + "', " + cost + ", '" + sqlEscape(note) + "', '" + tipoInt + "', '" + sqlEscape(pathAll) + "')";
        } else {
            sql = "UPDATE tblSpeseVeicolo SET " +
                  "DataIntervento = '" + data + "', " +
                  "Descrizione = '" + sqlEscape(desc) + "', " +
                  "Costo = " + cost + ", " +
                  "Note = '" + sqlEscape(note) + "', " +
                  "TipoIntervento = '" + tipoInt + "', " +
                  "PathAllegato = '" + sqlEscape(pathAll) + "' " +
                  "WHERE ID = " + id;
        }
        
        if (queryAccessDB(sql, true)) {
            if(typeof ShowSystemToast === "function") { ShowSystemToast("Operazione Riuscita", "Spesa salvata correttamente nel registro!", "success"); } else { alert("Spesa salvata correttamente!"); }
            CaricaSpese();
            NuovoSpesa();
        } else { alert("Errore salvataggio."); }
        
    } else if (currentTab === "rifornimenti") {
        var id = document.getElementById("txtIDRif").value;
        var data = itToDbDate(document.getElementById("txtDataRifornimento").value.trim());
        var km = document.getElementById("txtKmRifornimento").value.trim();
        if (km !== "") {
            km = km.replace(/[\.,\s]/g, "");
        }
        var pLit = document.getElementById("txtPrezzoLitro").value.trim().replace(",", ".");
        var litri = document.getElementById("txtLitriRifornimento").value.trim().replace(",", ".");
        var tot = document.getElementById("txtCostoTotalePieno").value.trim().replace(",", ".");
        var note = document.getElementById("txtNoteRifornimento").value.trim();
        var pathAll = document.getElementById("txtPathAllegatoRifornimento").value;

        if (data === "" || pLit === "" || tot === "") {
            alert("Data, Prezzo e Costo Totale sono campi obbligatori.");
            return;
        }

        var sql = "";
        if (id === "") {
            sql = "INSERT INTO tblRifornimenti (DataRifornimento, PrezzoAlLitro, Litri, CostoTotale, KmAttuali, Note, PathAllegato) VALUES (" +
                  "'" + data + "', " + pLit + ", " + (litri !== "" ? litri : "NULL") + ", " + tot + ", " + (km !== "" ? km : "NULL") + ", '" + sqlEscape(note) + "', '" + sqlEscape(pathAll) + "')";
        } else {
            sql = "UPDATE tblRifornimenti SET " +
                  "DataRifornimento = '" + data + "', " +
                  "PrezzoAlLitro = " + pLit + ", " +
                  "Litri = " + (litri !== "" ? litri : "NULL") + ", " +
                  "CostoTotale = " + tot + ", " +
                  "KmAttuali = " + (km !== "" ? km : "NULL") + ", " +
                  "Note = '" + sqlEscape(note) + "', " +
                  "PathAllegato = '" + sqlEscape(pathAll) + "' " +
                  "WHERE ID = " + id;
        }

        if (queryAccessDB(sql, true)) {
            if(typeof ShowSystemToast === "function") { ShowSystemToast("Operazione Riuscita", "Rifornimento salvato e telemetria aggiornata!", "success"); } else { alert("Pieno salvato correttamente!"); }
            AggiornaOdimetroVeicoloAutomatico();
            CaricaRifornimenti();
            NuovoRifornimento();
        } else { alert("Errore nel salvataggio del rifornimento."); }

    } else if (currentTab === "scadenze") {
        var id = document.getElementById("txtIDVeh").value;
        var mod = document.getElementById("txtModello").value.trim();
        var tar = document.getElementById("txtTarga").value.trim().toUpperCase();
        var scadAss = itToDbDate(document.getElementById("txtScadenzaAssicurazione").value.trim());
        var scadBol = itToDbDate(document.getElementById("txtScadenzaBollo").value.trim());
        var scadRev = itToDbDate(document.getElementById("txtScadenzaRevisione").value.trim());
        var km = document.getElementById("txtKmAttuali").value.trim();
        if (km !== "") {
            km = km.replace(/[\.,\s]/g, "");
        }
        var soglia = document.getElementById("txtSogliaTagliando").value.trim();
        var note = document.getElementById("txtNoteVeh").value.trim();
        
        if (mod === "" || tar === "") {
            alert("Modello e Targa sono obbligatori.");
            return;
        }
        
        var sql = "";
        if (id === "") {
            sql = "INSERT INTO tblVeicoli (Modello, Targa, ScadenzaAssicurazione, ScadenzaBollo, ScadenzaRevisione, KmAttuali, SogliaTagliando, Note) " +
                  "VALUES ('" + sqlEscape(mod) + "', '" + sqlEscape(tar) + "', '" + scadAss + "', '" + scadBol + "', '" + scadRev + "', " + (km !== "" ? km : "NULL") + ", " + (soglia !== "" ? soglia : "NULL") + ", '" + sqlEscape(note) + "')";
        } else {
            sql = "UPDATE tblVeicoli SET " +
                  "Modello = '" + sqlEscape(mod) + "', " +
                  "Targa = '" + sqlEscape(tar) + "', " +
                  "ScadenzaAssicurazione = '" + scadAss + "', " +
                  "ScadenzaBollo = '" + scadBol + "', " +
                  "ScadenzaRevisione = '" + scadRev + "', " +
                  "KmAttuali = " + (km !== "" ? km : "NULL") + ", " +
                  "SogliaTagliando = " + (soglia !== "" ? soglia : "NULL") + ", " +
                  "Note = '" + sqlEscape(note) + "' " +
                  "WHERE ID = " + id;
        }
        
        if (queryAccessDB(sql, true)) {
            if(typeof ShowSystemToast === "function") { ShowSystemToast("Operazione Riuscita", "Scheda veicolo salvata e radar allineato!", "success"); } else { alert("Veicolo salvato correttamente!"); }
            CaricaVeicoli();
            NuovoVeicolo();
        } else {
            alert("Errore durante il salvataggio del veicolo.");
        }
    } else if (currentTab === "rimborsi") {
        try {
            var tar = document.getElementById("txtTariffaKm").value.trim();
            var con = document.getElementById("txtConsumoMedio").value.trim();
            var prz = document.getElementById("txtPrezzoCarburante").value.trim();
            
            var q1 = "REPLACE INTO tblConfigAuto (Chiave, Valore) VALUES ('TariffaKm', '" + sqlEscape(tar) + "')";
            var q2 = "REPLACE INTO tblConfigAuto (Chiave, Valore) VALUES ('ConsumoMedio', '" + sqlEscape(con) + "')";
            var q3 = "REPLACE INTO tblConfigAuto (Chiave, Valore) VALUES ('PrezzoCarburante', '" + sqlEscape(prz) + "')";
            
            queryAccessDB(q1, true);
            queryAccessDB(q2, true);
            queryAccessDB(q3, true);
            
            if(typeof UXPremium !== "undefined") { UXPremium.ShowToast("Impostazioni e parametri di calcolo salvati permanentemente!", "success"); } else { alert("Impostazioni e parametri di calcolo salvati permanentemente!"); }
            CalcolaRimborsiMensili(); // Ricalcola subito la griglia con i nuovi dati salvati
        } catch(e) {
            if(typeof UXPremium !== "undefined") { UXPremium.ShowToast("Si è verificato un errore durante il salvataggio.", "error"); } else { alert("Si è verificato un errore durante il salvataggio delle impostazioni."); }
        }
    } else {
        if(typeof UXPremium !== "undefined") { UXPremium.ShowToast("Nessun record da salvare in questa scheda.", "warning"); } else { alert("Nessun record da salvare in questa scheda."); }
    }
}

function EliminaRecord() {
    if (currentTab === "spese") {
        var id = document.getElementById("txtIDSpesa").value;
        if (id === "") {
            alert("Seleziona prima una spesa da eliminare.");
            return;
        }
        if (confirm("Vuoi eliminare definitivamente questa spesa?")) {
            var sql = "DELETE FROM tblSpeseVeicolo WHERE ID = " + id;
            if (queryAccessDB(sql, true)) {
                alert("Spesa eliminata!");
                CaricaSpese();
                NuovoSpesa();
            } else {
                alert("Errore durante l'eliminazione.");
            }
        }
    } else if (currentTab === "rifornimenti") {
        var id = document.getElementById("txtIDRif").value;
        if (id === "") { alert("Seleziona un pieno da eliminare."); return; }
        if (confirm("Cancellare questa voce di rifornimento?")) {
            if (queryAccessDB("DELETE FROM tblRifornimenti WHERE ID = " + id, true)) {
                alert("Voce eliminata.");
                AggiornaOdimetroVeicoloAutomatico();
                CaricaRifornimenti();
                NuovoRifornimento();
            }
        }
    } else if (currentTab === "scadenze") {
        var id = document.getElementById("txtIDVeh").value;
        if (id === "") {
            alert("Seleziona prima un veicolo da eliminare.");
            return;
        }
        if (confirm("Vuoi eliminare definitivamente questo veicolo?")) {
            var sql = "DELETE FROM tblVeicoli WHERE ID = " + id;
            if (queryAccessDB(sql, true)) {
                alert("Veicolo eliminato!");
                CaricaVeicoli();
                NuovoVeicolo();
            } else {
                alert("Errore durante l'eliminazione.");
            }
        }
    } else {
        alert("Nessun record da eliminare in questa scheda.");
    }
}

window.dashboardLaunched = false;
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

function ActionEsci() {
    RiapriDashboard();
    window.close();
}

// ==========================================
// CALENDARIO FLOTTANTE STILE DIARIO
// ==========================================
var activeCalendarInputId = null;
var calendarCurrentYear = null;
var calendarCurrentMonth = null;

function ShowCalendarPicker(inputId) {
    activeCalendarInputId = inputId;
    var input = document.getElementById(inputId);
    var cal = document.getElementById("diaryCalendarPicker");
    if (!cal) return;
    
    // Chiudi temporaneamente per ricalcolare
    cal.style.display = "none";
    
    // Calcola posizione assoluta dell'input
    var rect = input.getBoundingClientRect();
    var topPos = rect.bottom + document.documentElement.scrollTop + 5;
    var leftPos = rect.left + document.documentElement.scrollLeft;
    
    // Se il calendario esce dallo schermo in basso, lo posizioniamo sopra l'input
    if (topPos + 220 > window.innerHeight + document.documentElement.scrollTop) {
        topPos = rect.top + document.documentElement.scrollTop - 215;
    }
    
    cal.style.top = topPos + "px";
    cal.style.left = leftPos + "px";
    cal.style.display = "block";
    
    // Leggi la data corrente dell'input
    var dateVal = input.value.trim();
    var d = new Date();
    if (dateVal.length === 10) {
        var parts = dateVal.split("/");
        if (parts.length === 3) {
            var gg = parseInt(parts[0], 10);
            var mm = parseInt(parts[1], 10) - 1;
            var aaaa = parseInt(parts[2], 10);
            if (!isNaN(gg) && !isNaN(mm) && !isNaN(aaaa)) {
                d = new Date(aaaa, mm, gg);
            }
        }
    }
    
    calendarCurrentYear = d.getFullYear();
    calendarCurrentMonth = d.getMonth();
    
    RenderCalendarDays();
}

function getHolidayName(day, month, year) {
    var m = month + 1;
    var d = day;
    
    // Festività Nazionali Italiane Fisse
    if (d === 1 && m === 1) return "Capodanno";
    if (d === 6 && m === 1) return "Epifania";
    if (d === 25 && m === 4) return "Festa della Liberazione";
    if (d === 1 && m === 5) return "Festa dei Lavoratori";
    if (d === 2 && m === 6) return "Festa della Repubblica";
    if (d === 15 && m === 8) return "Ferragosto";
    if (d === 1 && m === 11) return "Tutti i Santi";
    if (d === 8 && m === 12) return "Immacolata Concezione";
    if (d === 25 && m === 12) return "Natale";
    if (d === 26 && m === 12) return "Santo Stefano";
    
    // Festività Patrono di Bari (San Nicola)
    if (d === 8 && m === 5) return "San Nicola (Patrono di Bari)";
    if (d === 6 && m === 12) return "San Nicola";
    
    // Lunedì dell'Angelo (Pasquetta)
    if (year === 2026 && d === 6 && m === 4) return "Lunedì dell'Angelo (Pasquetta)";
    if (year === 2025 && d === 21 && m === 4) return "Lunedì dell'Angelo (Pasquetta)";
    if (year === 2024 && d === 1 && m === 4) return "Lunedì dell'Angelo (Pasquetta)";
    
    return null;
}

function RenderCalendarDays() {
    var title = document.getElementById("calendarMonthTitle");
    var tbody = document.getElementById("calendarDaysGridTable");
    if (!title || !tbody) return;
    
    var nomiMesiEstesi = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    
    title.innerText = nomiMesiEstesi[calendarCurrentMonth] + " " + calendarCurrentYear;
    tbody.innerHTML = "";
    
    // Primo giorno del mese
    var firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1);
    var startDayIdx = firstDay.getDay();
    // Convertiamo affinché 0 = Lunedì, ..., 6 = Domenica
    startDayIdx = (startDayIdx === 0) ? 6 : startDayIdx - 1;
    
    // Totale giorni del mese corrente
    var totalDays = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0).getDate();
    
    // Leggi l'eventuale giorno selezionato nell'input per evidenziarlo
    var selectedDay = -1;
    var inputVal = document.getElementById(activeCalendarInputId).value.trim();
    if (inputVal.length === 10) {
        var parts = inputVal.split("/");
        if (parts.length === 3) {
            var gg = parseInt(parts[0], 10);
            var mm = parseInt(parts[1], 10) - 1;
            var aaaa = parseInt(parts[2], 10);
            if (aaaa === calendarCurrentYear && mm === calendarCurrentMonth) {
                selectedDay = gg;
            }
        }
    }
    
    var currentDayNum = 1;
    var done = false;
    
    for (var r = 0; r < 6; r++) {
        if (done) break;
        
        var tr = document.createElement("tr");
        tr.style.height = "38px";
        
        for (var c = 0; c < 7; c++) {
            var td = document.createElement("td");
            td.style.textAlign = "center";
            td.style.verticalAlign = "middle";
            td.style.padding = "2px 0";
            
            if (r === 0 && c < startDayIdx) {
                td.innerHTML = "";
            } else if (currentDayNum > totalDays) {
                td.innerHTML = "";
                done = true;
            } else {
                var dayDiv = document.createElement("div");
                dayDiv.innerText = currentDayNum;
                dayDiv.setAttribute("data-day", currentDayNum);
                dayDiv.style.width = "30px";
                dayDiv.style.height = "30px";
                dayDiv.style.lineHeight = "30px";
                dayDiv.style.margin = "auto";
                dayDiv.style.borderRadius = "50%";
                dayDiv.style.cursor = "pointer";
                dayDiv.style.fontFamily = "'Inter', sans-serif";
                dayDiv.style.fontSize = "13px";
                dayDiv.style.transition = "all 0.15s ease";
                
                var isWeekend = (c === 5 || c === 6);
                var holidayName = getHolidayName(currentDayNum, calendarCurrentMonth, calendarCurrentYear);
                
                if (holidayName) {
                    dayDiv.title = holidayName;
                }
                
                if (currentDayNum === selectedDay) {
                    dayDiv.style.background = "#f59e0b";
                    dayDiv.style.color = "#ffffff";
                    dayDiv.style.fontWeight = "bold";
                    dayDiv.style.boxShadow = "0 4px 8px rgba(245, 158, 11, 0.4)";
                } else if (isWeekend || holidayName) {
                    dayDiv.style.background = "#fff5ea";
                    dayDiv.style.color = "#e05638";
                    dayDiv.style.fontWeight = "bold";
                    
                    dayDiv.onmouseover = function() {
                        this.style.background = "#fddcb4";
                    };
                    dayDiv.onmouseout = function() {
                        this.style.background = "#fff5ea";
                    };
                } else {
                    dayDiv.style.background = "transparent";
                    dayDiv.style.color = "#1e293b";
                    dayDiv.style.fontWeight = "bold";
                    
                    dayDiv.onmouseover = function() {
                        this.style.background = "#f1f5f9";
                    };
                    dayDiv.onmouseout = function() {
                        this.style.background = "transparent";
                    };
                }
                
                dayDiv.onclick = function(e) {
                    var clickedDay = this.getAttribute("data-day");
                    var formattedGG = clickedDay < 10 ? "0" + clickedDay : clickedDay;
                    var formattedMM = (calendarCurrentMonth + 1) < 10 ? "0" + (calendarCurrentMonth + 1) : (calendarCurrentMonth + 1);
                    
                    document.getElementById(activeCalendarInputId).value = formattedGG + "/" + formattedMM + "/" + calendarCurrentYear;
                    
                    document.getElementById("diaryCalendarPicker").style.display = "none";
                    
                    try {
                        var evt = document.createEvent ? document.createEvent("HTMLEvents") : null;
                        if (evt) {
                            evt.initEvent("change", true, true);
                            document.getElementById(activeCalendarInputId).dispatchEvent(evt);
                        } else {
                            document.getElementById(activeCalendarInputId).fireEvent("onchange");
                        }
                    } catch(err) {}
                    
                    if (!e) e = window.event;
                    if (e) {
                        e.cancelBubble = true;
                        if (e.stopPropagation) e.stopPropagation();
                    }
                };
                
                td.appendChild(dayDiv);
                currentDayNum++;
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

function SetCalendarToday() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();
    
    var formattedDD = dd < 10 ? "0" + dd : dd;
    var formattedMM = mm < 10 ? "0" + mm : mm;
    
    document.getElementById(activeCalendarInputId).value = formattedDD + "/" + formattedMM + "/" + yyyy;
    
    try {
        var evt = document.createEvent ? document.createEvent("HTMLEvents") : null;
        if (evt) {
            evt.initEvent("change", true, true);
            document.getElementById(activeCalendarInputId).dispatchEvent(evt);
        } else {
            document.getElementById(activeCalendarInputId).fireEvent("onchange");
        }
    } catch(err) {}
    
    CloseCalendar();
}

function CloseCalendar() {
    var cal = document.getElementById("diaryCalendarPicker");
    if (cal) cal.style.display = "none";
}

function PrevMonthCalendar() {
    calendarCurrentMonth--;
    if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
    }
    RenderCalendarDays();
}

function NextMonthCalendar() {
    calendarCurrentMonth++;
    if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
    }
    RenderCalendarDays();
}

// Chiudi il calendario se si clicca fuori
if (document.addEventListener) {
    document.addEventListener("mousedown", function(e) {
        var cal = document.getElementById("diaryCalendarPicker");
        if (!cal) return;
        
        var target = e.target;
        var isInput = (target.id === "txtDataSpesa" || target.id === "txtScadenzaAssicurazione" || target.id === "txtScadenzaBollo" || target.id === "txtScadenzaRevisione");
        
        var insideCal = false;
        var temp = target;
        while (temp) {
            if (temp.id === "diaryCalendarPicker") {
                insideCal = true;
                break;
            }
            temp = temp.parentNode;
        }
        
        if (!isInput && !insideCal) {
            cal.style.display = "none";
        }
    }, true);
} else {
    document.attachEvent("onmousedown", function() {
        var cal = document.getElementById("diaryCalendarPicker");
        if (!cal) return;
        
        var target = window.event.srcElement;
        var isInput = (target.id === "txtDataSpesa" || target.id === "txtScadenzaAssicurazione" || target.id === "txtScadenzaBollo" || target.id === "txtScadenzaRevisione");
        
        var insideCal = false;
        var temp = target;
        while (temp) {
            if (temp.id === "diaryCalendarPicker") {
                insideCal = true;
                break;
            }
            temp = temp.parentNode;
        }
        
        if (!isInput && !insideCal) {
            cal.style.display = "none";
        }
    });
}

function EsportaInExcel() {
    try {
        var tbody = document.getElementById("tbodyRimborsi");
        if (!tbody) {
            alert("Nessun dato da esportare.");
            return;
        }
        var rows = tbody.getElementsByTagName("tr");
        if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.indexOf("corso") > -1)) {
            ShowSystemToast("Nessun dato", "Non ci sono dati elaborati da esportare.", "warning");
            return;
        }
        
        var anno = document.getElementById("fltAnnoRimborsi").value;
        var csv = "Mese/Anno\tConsegne\tKm Percorsi\tBenzina Stimata\tManutenzione\tRimborso Spettante\tGuadagno Netto\r\n";
        
        for (var i = 0; i < rows.length; i++) {
            var cells = rows[i].getElementsByTagName("td");
            if (cells.length >= 7) {
                var mese = cells[0].innerText || cells[0].textContent;
                var consegne = cells[1].innerText || cells[1].textContent;
                var km = cells[2].innerText || cells[2].textContent;
                var benzina = cells[3].innerText || cells[3].textContent;
                var manutenzione = cells[4].innerText || cells[4].textContent;
                var rimborso = cells[5].innerText || cells[5].textContent;
                var guadagno = cells[6].innerText || cells[6].textContent;
                
                // Rimuovi eventuali asterischi, pulisci spazi e caratteri €
                km = km.replace(" Km", "").replace(" km", "").trim();
                benzina = benzina.replace(" €", "").replace("*", "").trim();
                manutenzione = manutenzione.replace(" €", "").trim();
                rimborso = rimborso.replace(" €", "").trim();
                guadagno = guadagno.replace(" €", "").replace("+", "").trim();
                
                csv += mese + "\t" + consegne + "\t" + km + "\t" + benzina + "\t" + manutenzione + "\t" + rimborso + "\t" + guadagno + "\r\n";
            }
        }
        
        window.clipboardData.setData("Text", csv);
        ShowSystemToast("Copia Riuscita", "I dati dei rimborsi del " + anno + " sono stati copiati negli appunti! Premi Ctrl+V su Excel per incollarli.", "success");
    } catch (e) {
        alert("Errore durante la copia dei dati: " + e.message);
    }
}

// --- TELEMETRIA & SIMULAZIONI & VOCE (GIFTS 2026) ---
var voiceObj = null;
var isVoiceMuted = false;

function ToggleMute() {
    isVoiceMuted = !isVoiceMuted;
    var btnImg = document.getElementById("imgMuteIcon");
    var lblTxt = document.getElementById("lblMuteText");
    if (isVoiceMuted) {
        if (voiceObj) { try { voiceObj.Speak("", 2); } catch(e){} }
        if (btnImg) btnImg.src = "https://img.icons8.com/fluency/48/mute.png";
        if (lblTxt) lblTxt.innerText = "Voce OFF";
        if (typeof UXPremium !== 'undefined') UXPremium.ShowToast("Voce disattivata", "success");
    } else {
        if (btnImg) btnImg.src = "https://img.icons8.com/fluency/48/high-volume.png";
        if (lblTxt) lblTxt.innerText = "Voce ON";
        if (typeof UXPremium !== 'undefined') UXPremium.ShowToast("Voce attivata", "success");
    }
}

document.addEventListener('keydown', function(e) {
    // Scorciatoia Ctrl+M per mutare la voce
    if (e.ctrlKey && (e.key === 'm' || e.key === 'M' || e.keyCode === 77)) {
        ToggleMute();
        e.preventDefault();
    }
});

function LeggiTestoVocale(testo) {
    if (isVoiceMuted) return; // Se mutato non esegue nulla
    if (!voiceObj) {
        try { voiceObj = new ActiveXObject("SAPI.SpVoice"); } catch(e){}
    }
    if (voiceObj) {
        try {
            voiceObj.Speak("", 2); // SVSFPurgeBeforeSpeak = 2
            if (testo && testo.trim() !== "") {
                voiceObj.Speak(testo, 1); // SVSFlagsAsync = 1
            }
        } catch(e){}
    }
}

function AvviaBriefingVocale() {
    try {
        var anno = document.getElementById("fltAnnoRimborsi").value;
        var totRimborsi = document.getElementById("lblTotRimborsi").innerText;
        var totBenzina = document.getElementById("lblTotBenzina").innerText;
        var totSpese = document.getElementById("lblTotSpeseBalance").innerText;
        var netto = document.getElementById("lblBilancioNetto").innerText;
        
        var rimbVal = totRimborsi.replace(" €","").trim();
        var benzVal = totBenzina.replace(" €","").trim();
        var speseVal = totSpese.replace(" €","").trim();
        var netVal = parseFloat(netto.replace("€","").replace(".","").replace(",","."));
        
        var tbody = document.getElementById("tbodyRimborsi");
        var rows = tbody ? tbody.getElementsByTagName("tr") : [];
        var totKm = 0;
        var totConsegne = 0;
        
        for (var i = 0; i < rows.length; i++) {
            var cells = rows[i].getElementsByTagName("td");
            if (cells.length >= 7) {
                totConsegne += parseInt(cells[1].innerText, 10) || 0;
                totKm += parseFloat(cells[2].innerText.replace("Km","").trim()) || 0;
            }
        }
        
        var text = "Rapporto di gestione veicolo per l'anno " + anno + ". ";
        text += "Hai completato " + totConsegne + " consegne lavorative, percorrendo un totale di " + totKm.toFixed(0) + " chilometri. ";
        text += "I rimborsi chilometrici spettanti ammontano a " + rimbVal + " euro. ";
        text += "La spesa stimata per il carburante è di " + benzVal + " euro, ";
        text += "mentre le spese di manutenzione e officina registrate per l'anno in corso sono di " + speseVal + " euro. ";
        
        if (netVal >= 0) {
            text += "Il tuo bilancio complessivo è in attivo, con un guadagno netto reale di " + netVal.toFixed(2).replace(".", ",") + " euro. Ottimo lavoro! ";
        } else {
            text += "Attenzione: il tuo bilancio complessivo è in perdita di " + Math.abs(netVal).toFixed(2).replace(".", ",") + " euro, a causa delle spese sostenute. Valuta un'ottimizzazione delle tappe. ";
        }
        
        var profileWidget = document.getElementById("userProfileWidget");
        if (profileWidget && profileWidget.innerText.indexOf("RANGO:") !== -1) {
            var rangoStr = profileWidget.innerText.split("RANGO:")[1];
            if (rangoStr) text += "Ti informo inoltre che il tuo grado di efficienza Eco-Drive al volante è valutato come: " + rangoStr.trim() + ". ";
        }

        
        LeggiTestoVocale(text);
    } catch(e) {
        alert("Impossibile generare il briefing vocale: " + e.message);
    }
}

function ToggleSimulatorExpand() {
    var content = document.getElementById("bodySimulatorContent");
    var label = document.getElementById("lblSimulatorToggle");
    if (!content || !label) return;
    
    if (content.style.display === "none") {
        content.style.display = "block";
        label.innerText = "CONTRAI ⚡";
        try {
            var activeTariffa = parseFloat(document.getElementById("txtTariffaKm").value.replace(",", ".")) || 0.45;
            var activePrezzo = parseFloat(document.getElementById("txtPrezzoCarburante").value.replace(",", ".")) || 1.80;
            var activeConsumo = parseFloat(document.getElementById("txtConsumoMedio").value.replace(",", ".")) || 15.0;
            
            document.getElementById("sliderSimTariffa").value = activeTariffa;
            document.getElementById("sliderSimPrezzoCarb").value = activePrezzo;
            document.getElementById("sliderSimConsumo").value = activeConsumo;
        } catch(e){}
        EseguiSimulazione();
    } else {
        content.style.display = "none";
        label.innerText = "ESPANDI ⚡";
    }
}

function EseguiSimulazione() {
    try {
        var t = parseFloat(document.getElementById("sliderSimTariffa").value);
        var p = parseFloat(document.getElementById("sliderSimPrezzoCarb").value);
        var c = parseFloat(document.getElementById("sliderSimConsumo").value);
        
        document.getElementById("valSimTariffa").innerText = t.toFixed(2).replace(".", ",");
        document.getElementById("valSimPrezzoCarb").innerText = p.toFixed(2).replace(".", ",");
        document.getElementById("valSimConsumo").innerText = c.toFixed(1).replace(".", ",");
        
        var costBenzKm = p / c;
        var marginKm = t - costBenzKm;
        
        var totSpese = parseFloat(document.getElementById("lblTotSpeseBalance").innerText.replace("€","").replace(".","").replace(",",".").trim()) || 0;
        var speseMensiliMedie = totSpese / 12;
        
        var breakEvenEl = document.getElementById("valSimBreakEven");
        var profitEl = document.getElementById("valSimProfit1000");
        
        if (marginKm <= 0) {
            breakEvenEl.innerHTML = "<span style='color:#ef4444;'>Nessun break-even</span>";
            profitEl.innerHTML = "<span style='color:#ef4444;'>Perdita garantita</span>";
        } else {
            var kmBreakEven = speseMensiliMedie > 0 ? (speseMensiliMedie / marginKm) : 0;
            breakEvenEl.innerHTML = kmBreakEven.toFixed(0) + " Km <span style='font-size:9.5px; color:#94a3b8; font-weight:normal;'>(&approx; " + (kmBreakEven/22).toFixed(0) + " Km/giorno)</span>";
            
            var profit1000 = (1000 * marginKm) - speseMensiliMedie;
            if (profit1000 >= 0) {
                profitEl.innerHTML = "<span style='color:#22c55e;'>+" + profit1000.toFixed(2).replace(".", ",") + " €</span>";
            } else {
                profitEl.innerHTML = "<span style='color:#ef4444;'>" + profit1000.toFixed(2).replace(".", ",") + " €</span>";
            }
        }
    } catch(e) {}
}

function GeneraNotaSpeseMensile(mIdx, annoVal, infoMese, rimborso, benzina, manutenzione, netto, interventi) {
    try {
        var meseNome = nomiMesi[mIdx];
        var meseDueCifre = (mIdx + 1) < 10 ? "0" + (mIdx + 1) : "" + (mIdx + 1);
        
        var sql = "SELECT DataConsegna, Destinatario, KmAndata, KmRitorno FROM tblConsegne " +
                  "WHERE (([AnnoRiferimento] = " + annoVal + " AND [MeseRiferimento] = " + (mIdx + 1) + ") " +
                  "OR ([AnnoRiferimento] IS NULL AND Year(DataConsegna) = " + annoVal + " AND Month(DataConsegna) = " + (mIdx + 1) + ")) " +
                  "ORDER BY DataConsegna ASC";
        var resConsegne = queryAccessDB(sql) || [];
        
        var username = GetLoggedUserName();
        var qualifica = "Supervisore Logistica e Consegne";
        if (username.toLowerCase().indexOf("ospite") > -1 || username.toLowerCase().indexOf("tecnico") > -1) {
            qualifica = "Operatore Logistica";
        }
        
        var vehModel = "Auto Personale";
        var vehTarga = "";
        if (selectedVeicoloIdx >= 0 && veicoliMemory[selectedVeicoloIdx]) {
            vehModel = veicoliMemory[selectedVeicoloIdx].Modello || "Auto Personale";
            vehTarga = veicoliMemory[selectedVeicoloIdx].Targa || "";
        } else if (veicoliMemory.length > 0) {
            vehModel = veicoliMemory[0].Modello || "Auto Personale";
            vehTarga = veicoliMemory[0].Targa || "";
        }
        var vehicleStr = vehModel.toUpperCase() + (vehTarga ? " (Targa: " + vehTarga.toUpperCase() + ")" : "");
        
        var htmlContent = "<html><head><meta charset='UTF-8'><title>Nota Spese " + meseNome + " " + annoVal + "</title>";
        htmlContent += "<style>" +
            "@page { size: portrait; margin: 12mm 15mm; }" +
            "body { font-family: 'Lora', Georgia, serif; background: #ffffff; color: #1e293b; padding: 0; margin: 0; }" +
            ".invoice-box { padding: 15px; }" +
            ".header-table { width: 100%; margin-bottom: 25px; border-bottom: 2px solid #0f172a; padding-bottom: 15px; }" +
            ".company-title { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: bold; color: #0f172a; margin: 0; }" +
            ".doc-title { font-size: 16px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; text-align: right; margin: 0; }" +
            ".meta-section { width: 100%; margin-bottom: 20px; font-size: 12px; line-height: 1.6; }" +
            ".meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }" +
            ".grid-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }" +
            ".grid-table th { background: #0f172a; color: #ffffff; font-weight: bold; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; }" +
            ".grid-table td { padding: 7px 10px; border: 1px solid #cbd5e1; }" +
            ".summary-box { width: 45%; float: right; margin-top: 20px; border: 1.5px solid #0f172a; border-radius: 8px; background: #fdfbf7; padding: 12px; font-size: 12px; }" +
            ".summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; }" +
            ".signature-section { width: 100%; margin-top: 60px; clear: both; display: flex; justify-content: space-between; font-size: 12px; }" +
            ".sig-box { width: 40%; text-align: center; border-top: 1px solid #475569; padding-top: 8px; margin-top: 40px; }" +
            "</style></head><body>";
            
        htmlContent += "<div class='invoice-box'>";
        
        htmlContent += "<table class='header-table'><tr>" +
                       "<td><div class='company-title'>Nota Spese e Rimborsi Auto</div></td>" +
                       "<td><div class='doc-title'>Mese di Riferimento<br><span style='color:#0f172a; font-size:22px; font-weight:900;'>" + meseNome.toUpperCase() + " " + annoVal + "</span></div></td>" +
                       "</tr></table>";
                       
        htmlContent += "<table class='meta-section' style='width:100%;'><tr>" +
                       "<td style='width:50%; padding-right:10px;'>" +
                       "  <div class='meta-card'>" +
                       "    <b>Conducente:</b> " + username.toUpperCase() + "<br>" +
                       "    <b>Qualifica:</b> " + qualifica + "<br>" +
                       "    <b>Veicolo:</b> " + vehicleStr + "" +
                       "  </div>" +
                       "</td>" +
                       "<td style='width:50%; padding-left:10px;'>" +
                       "  <div class='meta-card'>" +
                       "    <b>Tariffa ACI/Km:</b> " + document.getElementById("txtTariffaKm").value + " €/Km<br>" +
                       "    <b>Consumo Rilevato:</b> " + document.getElementById("txtConsumoMedio").value + " Km/L<br>" +
                       "    <b>Prezzo Carburante:</b> " + document.getElementById("txtPrezzoCarburante").value + " €/L" +
                       "  </div>" +
                       "</td>" +
                       "</tr></table>";
                       
        htmlContent += "<h3 style='font-size:12px; font-weight:800; border-bottom:1.5px solid #475569; padding-bottom:4px; margin-top:20px; color:#0f172a;'>🚗 REGISTRO TRATTE E VIAGGI EFFETTUATI</h3>";
        htmlContent += "<table class='grid-table'>";
        htmlContent += "<thead><tr>" +
                       "<th>Data Viaggio</th>" +
                       "<th>Destinazione / Cliente</th>" +
                       "<th style='text-align:right;'>Km Andata</th>" +
                       "<th style='text-align:right;'>Km Ritorno</th>" +
                       "<th style='text-align:right;'>Distanza Totale</th>" +
                       "<th style='text-align:right;'>Rimborso Calcolato</th>" +
                       "</tr></thead><tbody>";
                       
        var tariffa = parseFloat(document.getElementById("txtTariffaKm").value.replace(",", ".")) || 0.45;
        if (resConsegne.length === 0) {
            htmlContent += "<tr><td colspan='6' style='text-align:center; color:#94a3b8; font-style:italic;'>Nessun viaggio registrato in questo mese.</td></tr>";
        } else {
            for (var c = 0; c < resConsegne.length; c++) {
                var cons = resConsegne[c];
                var dtVal = cons.DataConsegna ? dbToItDate(cons.DataConsegna.substring(0, 10)) : "--";
                var dest = (cons.Destinatario || "Cliente").toUpperCase();
                var kmA = parseFloat(cons.KmAndata) || 0;
                var kmR = parseFloat(cons.KmRitorno) || 0;
                var dist = kmA + kmR;
                var rimbTrip = dist * tariffa;
                
                htmlContent += "<tr>" +
                               "<td>" + dtVal + "</td>" +
                               "<td>" + dest + "</td>" +
                               "<td style='text-align:right; font-family:monospace;'>" + kmA.toFixed(1) + " Km</td>" +
                               "<td style='text-align:right; font-family:monospace;'>" + kmR.toFixed(1) + " Km</td>" +
                               "<td style='text-align:right; font-family:monospace; font-weight:bold;'>" + dist.toFixed(1) + " Km</td>" +
                               "<td style='text-align:right; font-family:monospace; color:#166534; font-weight:bold;'>" + rimbTrip.toFixed(2) + " €</td>" +
                               "</tr>";
            }
        }
        htmlContent += "</tbody></table>";
        
        if (interventi.length > 0) {
            htmlContent += "<h3 style='font-size:12px; font-weight:800; border-bottom:1.5px solid #475569; padding-bottom:4px; margin-top:25px; color:#0f172a;'>🔧 DETTAGLIO INTERVENTI DI MANUTENZIONE</h3>";
            htmlContent += "<table class='grid-table'>";
            htmlContent += "<thead><tr>" +
                           "<th>Intervento</th>" +
                           "<th>Tipo Manutenzione</th>" +
                           "<th style='text-align:right;'>Costo Sostenuto</th>" +
                           "</tr></thead><tbody>";
            for (var i = 0; i < interventi.length; i++) {
                htmlContent += "<tr>" +
                               "<td>" + interventi[i].desc.toUpperCase() + "</td>" +
                               "<td>" + interventi[i].tipo.toUpperCase() + "</td>" +
                               "<td style='text-align:right; font-family:monospace; font-weight:bold; color:#ef4444;'>" + interventi[i].costo.toFixed(2) + " €</td>" +
                               "</tr>";
            }
            htmlContent += "</tbody></table>";
        }
        
        // Calcolo totali parziali per la stampa
        var totOfficina = 0;
        var totEmergenze = 0;
        for (var i = 0; i < interventi.length; i++) {
            if (interventi[i].tipo === "EMERGENZA") {
                totEmergenze += interventi[i].costo;
            } else {
                totOfficina += interventi[i].costo;
            }
        }

        htmlContent += "<div class='summary-box'>";
        htmlContent += "  <div class='summary-row'><span>Totale Rimborsi ACI Spettanti:</span> <b style='color:#166534;'>+" + rimborso.toFixed(2) + " €</b></div>";
        htmlContent += "  <div class='summary-row'><span>Costo Carburante Stimato:</span> <b style='color:#b45309;'>-" + benzina.toFixed(2) + " €</b></div>";
        htmlContent += "  <div class='summary-row'><span>Spese Officina (Manutenzione):</span> <b style='color:#b91c1c;'>-" + totOfficina.toFixed(2) + " €</b></div>";
        if (totEmergenze > 0) {
            htmlContent += "  <div class='summary-row'><span>Spese Emergenza in Servizio:</span> <b style='color:#c2410c;'>-" + totEmergenze.toFixed(2) + " €</b></div>";
        }
        htmlContent += "  <div style='margin-top:8px; border-top:1.5px solid #0f172a; padding-top:6px; display:flex; justify-content:space-between; font-weight:900; font-size:13px;'>" +
                       "    <span>DIFFERENZIALE NETTO:</span> " +
                       "    <span style='color:" + (netto >= 0 ? "#166534" : "#b91c1c") + ";'>" + (netto >= 0 ? "+" : "") + netto.toFixed(2) + " €</span>" +
                       "  </div>";
        htmlContent += "</div>";
        
        htmlContent += "<div class='signature-section'>";
        htmlContent += "  <div class='sig-box'>Firma Conducente<br><br><br>_______________________________</div>";
        htmlContent += "  <div class='sig-box'>Firma Amministrazione<br><br><br>_______________________________</div>";
        htmlContent += "</div>";
        
        htmlContent += "</div>";
        htmlContent += "<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1200); };</script>";
        htmlContent += "</body></html>";
        
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var tempDir = fso.GetSpecialFolder(2).Path;
        var uniqueId = Math.floor(Math.random() * 899999) + 100000;
        var tempFile = fso.BuildPath(tempDir, "nota_spese_" + meseDueCifre + "_" + uniqueId + ".html");
        
        var stream = new ActiveXObject("ADODB.Stream");
        stream.Type = 2;
        stream.Charset = "utf-8";
        stream.Open();
        stream.WriteText(htmlContent);
        stream.SaveToFile(tempFile, 2);
        stream.Close();
        
        try {
            var shellApp = new ActiveXObject("Shell.Application");
            if (shellApp && typeof shellApp.ShellExecute === "function") {
                shellApp.ShellExecute(tempFile, "", "", "open", 1);
            } else if (typeof window !== "undefined" && window.open) {
                window.open(tempFile, "_blank");
            }
        } catch(eShell) {
            if (typeof window !== "undefined" && window.open) {
                window.open(tempFile, "_blank");
            }
        }
        
    } catch(e) {
        alert("Errore nella generazione della nota spese: " + e.message);
    }
}

function StampaDocumento() {
    try {
        var anno = document.getElementById("fltAnnoRimborsi").value;
        var htmlContent = "<html><head><meta charset='UTF-8'><title>Report Spese Auto & Rimborsi Chilometrici</title>";
        
        // Stili moderni ed eleganti per la stampa
        htmlContent += "<style>" + 
            "@page { size: portrait; margin: 8mm 12mm; }" + // Elimina intestazioni e piè di pagina del browser (URL, data, paginazione)
            "body { font-family: 'Lora', Georgia, serif; background: #ffffff; color: #2d221c; padding: 10px; margin: 0; }" +
            "button, .btn, .no-print, .btn-allinea-busta { display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important; overflow: hidden !important; }" +
            ".print-header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #c5a059; padding-bottom: 12px; }" +
            ".print-title { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: bold; margin: 0; color: #2d221c; }" +
            ".print-meta { font-size: 13px; color: #5c4a3c; margin-top: 5px; }" +
            ".balance-cards { display: flex; justify-content: space-between; margin-bottom: 18px; gap: 12px; }" +
            ".balance-card { flex: 1; border: 1.5px solid #c5a059; border-radius: 10px; padding: 10px 12px; text-align: center; background: #fdfbf7; }" +
            ".balance-title { font-family: 'Inter', sans-serif; font-size: 9px; text-transform: uppercase; color: #5c4a3c; margin-bottom: 4px; font-weight: 700; letter-spacing: 0.5px; }" +
            ".balance-val { font-size: 16px; font-weight: bold; color: #166534; }" +
            ".enterprise-grid { width: 100%; border-collapse: collapse; margin-top: 10px; font-family: 'Lora', Georgia, serif; font-size: 11px; }" +
            ".enterprise-grid th { background: #efe7db; color: #2d221c; text-align: left; padding: 9px 12px; border-bottom: 1.5px solid #c5a059; font-weight: bold; text-transform: uppercase; font-size: 10px; }" +
            ".enterprise-grid td { padding: 8px 12px; border-bottom: 1px dashed #cbd5e1; color: #3d322b; }" +
            "b { font-weight: bold; }" +
            "</style></head><body>";

        htmlContent += "<div class='print-header'>";
        htmlContent += "<h1 class='print-title'>Registro Auto Personale & Rimborso Km</h1>";
        htmlContent += "<div class='print-meta'>Anno di Riferimento: <b>" + anno + "</b></div>";
        htmlContent += "</div>";

        // Determina quale tab è attivo ed esporta i relativi dati
        if (document.getElementById("viewRimborsi").style.display !== "none") {
            // Cruscotto Finanziario
            htmlContent += "<div class='balance-cards'>";
            htmlContent += "<div class='balance-card'><div class='balance-title'>Totale Rimborsi</div><div class='balance-val' style='color:#166534;'>" + document.getElementById("lblTotRimborsi").innerText + "</div></div>";
            htmlContent += "<div class='balance-card'><div class='balance-title'>Costo Benzina</div><div class='balance-val' style='color:#c2410c;'>" + document.getElementById("lblTotBenzina").innerText + "</div></div>";
            htmlContent += "<div class='balance-card'><div class='balance-title'>Manutenzione</div><div class='balance-val' style='color:#8f2b2b;'>" + document.getElementById("lblTotSpeseBalance").innerText + "</div></div>";
            htmlContent += "<div class='balance-card'><div class='balance-title'>Guadagno Reale</div><div class='balance-val' style='color:#1a5ea4;'>" + document.getElementById("lblBilancioNetto").innerText + "</div></div>";
            htmlContent += "</div>";

            // Tabella Rimborsi senza i pulsanti "Allinea Busta"
            var cleanRimborsiHtml = document.getElementById("tbodyRimborsi").innerHTML.replace(/<button[\s\S]*?<\/button>/gi, '');
            htmlContent += "<table class='enterprise-grid'>";
            htmlContent += "<thead><tr>" +
                           "<th>Mese di Riferimento</th>" +
                           "<th style='width:90px; text-align:center;'>Consegne</th>" +
                           "<th style='width:100px; text-align:right;'>Km Percorsi</th>" +
                           "<th style='width:120px; text-align:right;'>Benzina Stimata (€)</th>" +
                           "<th style='width:120px; text-align:right;'>Manutenzione (€)</th>" +
                           "<th style='width:130px; text-align:right;'>Rimborso Spettante (€)</th>" +
                           "<th style='width:130px; text-align:right;'>Guadagno Netto (€)</th>" +
                           "</tr></thead>";
            htmlContent += "<tbody>" + cleanRimborsiHtml + "</tbody>";
            htmlContent += "</table>";
        } else if (document.getElementById("viewSpese").style.display !== "none") {
            // Tabella Spese
            htmlContent += "<table class='enterprise-grid'>";
            htmlContent += "<thead><tr>" +
                           "<th style='width:50px'>ID</th>" +
                           "<th style='width:120px'>Data Spesa</th>" +
                           "<th>Intervento / Descrizione</th>" +
                           "<th style='width:120px; text-align:right;'>Costo (€)</th>" +
                           "<th>Note</th>" +
                           "</tr></thead>";
            htmlContent += "<tbody>" + document.getElementById("tbodySpese").innerHTML + "</tbody>";
            htmlContent += "</table>";
        } else {
            // Tabella Scadenze Veicoli
            htmlContent += "<table class='enterprise-grid'>";
            htmlContent += "<thead><tr>" +
                           "<th>Modello / Marca</th>" +
                           "<th style='width:100px;'>Targa</th>" +
                           "<th style='width:120px; text-align:center;'>Scad. Assicurazione</th>" +
                           "<th style='width:120px; text-align:center;'>Scad. Bollo</th>" +
                           "<th style='width:120px; text-align:center;'>Scad. Revisione</th>" +
                           "<th>Note Veicolo</th>" +
                           "</tr></thead>";
            htmlContent += "<tbody>" + document.getElementById("tbodyVeicoli").innerHTML + "</tbody>";
            htmlContent += "</table>";
        }

        // Script per avviare la stampa nativa del browser e chiudere la finestra d'appoggio al completamento
        htmlContent += "<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); };</script>";
        htmlContent += "</body></html>";

        // Scrittura del file temporaneo HTML usando la cartella temporanea di Windows (sempre scrivibile al 100%)
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var tempDir = fso.GetSpecialFolder(2).Path; // Estrae esplicitamente il percorso stringa dal Folder Object
        var uniqueId = Math.floor(Math.random() * 899999) + 100000; // Genera un ID randomico per prevenire blocchi file concorrenti
        var tempFile = fso.BuildPath(tempDir, "report_stampa_" + uniqueId + ".html"); // Costruisce il percorso con un nome unico univoco

        // Scrittura robusta UTF-8 tramite ADODB.Stream per supportare simboli speciali (€, lettere accentate, etc.)
        var stream = new ActiveXObject("ADODB.Stream");
        stream.Type = 2; // Testo
        stream.Charset = "utf-8";
        stream.Open();
        stream.WriteText(htmlContent);
        stream.SaveToFile(tempFile, 2); // 2 = Sovrascrittura
        stream.Close();

        // Apertura automatica ed infallibile a livello OS senza passare da cmd.exe o WScript.Shell
        try {
            var shellApp = new ActiveXObject("Shell.Application");
            if (shellApp && typeof shellApp.ShellExecute === "function") {
                shellApp.ShellExecute(tempFile, "", "", "open", 1);
            } else if (typeof window !== "undefined" && window.open) {
                window.open(tempFile, "_blank");
            }
        } catch(eShell) {
            if (typeof window !== "undefined" && window.open) {
                window.open(tempFile, "_blank");
            }
        }

    } catch (e) {
        alert("Errore durante l'apertura dell'anteprima: " + e.message);
    }
}

function MostraInfo() {
    // Prevenzione duplicati
    var old = document.getElementById("modalGuidaManuale");
    if(old) { try { old.parentNode.removeChild(old); } catch(e){} }
    
    var modal = document.createElement("div");
    modal.id = "modalGuidaManuale";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 17, 32, 0.85); z-index:9999; display:flex; align-items:center; justify-content:center; font-family:'Inter', sans-serif; backdrop-filter: blur(8px);";
    
    var box = document.createElement("div");
    box.style.cssText = "background:#0f172a; width:650px; max-height:85%; border:1px solid #334155; border-radius:16px; padding:30px; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0, 0, 0, 0.5); position:relative; color:#e2e8f0; animation: fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);";
    
    // Aggiungiamo animazione keyframes al volo se non c'è
    var style = document.createElement('style');
    style.innerHTML = "@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }";
    document.getElementsByTagName('head')[0].appendChild(style);

    var closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = "position:absolute; top:15px; right:20px; background:none; border:none; font-size:28px; cursor:pointer; color:#94a3b8; font-weight:bold;";
    closeBtn.onclick = function() { try { modal.parentNode.removeChild(modal); } catch(e){} };
    box.appendChild(closeBtn);
    
    var title = document.createElement("h1");
    title.innerHTML = "📖 GUIDA OPERATIVA DEL SISTEMA";
    title.style.cssText = "font-family:'Inter', sans-serif; font-size:20px; font-weight:800; color:#ffffff; border-bottom:1px solid #334155; padding-bottom:12px; margin-bottom:20px; text-align:center; letter-spacing:0.5px;";
    box.appendChild(title);
    
    var c = document.createElement("div");
    c.style.cssText = "font-size:14px; line-height:1.6; font-family:'Inter', sans-serif;";
    
    var html = "";
    html += "<h3 style='color:#eab308; margin-top:0; font-weight:800;'><i class='fa fa-wrench'></i> 1. REGISTRO SPESE MANUTENZIONE</h3>";
    html += "<p style='margin-bottom:15px; color:#94a3b8;'>Registra qui tagliandi, cambio gomme e riparazioni. Premi <b>Nuovo</b>, compila a destra il costo e il tipo, poi <b>Salva</b>. <br><i>Consiglio:</i> usa il tasto 'Carica Documento' per salvare la foto digitale dello scontrino!</p>";
    
    html += "<h3 style='color:#38bdf8; font-weight:800;'><i class='fa fa-tint'></i> 2. REGISTRO CARBURANTE (BENZINA)</h3>";
    html += "<p style='margin-bottom:15px; color:#94a3b8;'>Ad ogni rifornimento premi <b>Nuovo</b>. Inserisci Prezzo/Litro, Totale e soprattutto i <b>KM CRUSCOTTO</b>. <br>Questa è la parte fondamentale: senza il chilometraggio esatto dell'auto il sistema non può analizzare l'andamento!</p>";
    
    html += "<h3 style='color:#10b981; font-weight:800;'><i class='fa fa-calculator'></i> 3. RIMBORSI CHILOMETRICI MENSILI</h3>";
    html += "<p style='margin-bottom:15px; color:#94a3b8;'>Qui trovi la potenza del sistema. Incrocia i KM delle consegne coi tuoi rifornimenti, dandoti un verdetto su:<br>✅ Totale Rimborsi Maturati<br>✅ <b>Il Tuo Vero Costo a KM</b> (indicato automaticamente in rosso)<br>✅ Il Tuo Guadagno Netto reale depurato dalle spese.</p>";
    
    html += "<h3 style='color:#f43f5e; font-weight:800;'><i class='fa fa-calendar'></i> 4. SCADENZE AUTO & DOCUMENTI</h3>";
    html += "<p style='margin-bottom:15px; color:#94a3b8;'>Inserisci qui i dati dell'auto (Targa, Revisione, Assicurazione). <br>Una tabella ti avviserà visivamente con dei <b>semafori colorati</b> quando una scadenza si sta avvicinando.</p>";
    
    html += "<div style='background:rgba(6, 182, 212, 0.1); padding:15px; border-radius:10px; border:1px solid #06b6d4; margin-top:25px; font-size:12px; color:#22d3ee; text-align:center;'>";
    html += "<b>💡 TRUCCO IMPORTANTE:</b> Digita la tua <i>Tariffa Rimborso</i> desiderata in alto nella scheda Rimborsi, poi clicca su <b>File > Salva Informazioni</b> per ricordartela per sempre!";
    html += "</div>";
    
    c.innerHTML = html;
    box.appendChild(c);
    
    var okBtn = document.createElement("button");
    okBtn.innerText = "CHIUDI MANUALE";
    okBtn.style.cssText = "display:block; margin:25px auto 5px; background:#334155; color:#ffffff; padding:12px 35px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-family:'Inter',sans-serif; letter-spacing:0.5px; font-size:12px; transition:0.2s;";
    okBtn.onmouseover = function(){ this.style.background="#475569"; };
    okBtn.onmouseout = function(){ this.style.background="#334155"; };
    okBtn.onclick = function() { try { modal.parentNode.removeChild(modal); } catch(e){} };
    box.appendChild(okBtn);
    
    modal.appendChild(box);
    document.body.appendChild(modal);
}

function ApplicaConsumoReale() {
    var val = document.getElementById("lblRealConsumoVal").innerText;
    if(val && val !== "--") {
        document.getElementById("txtConsumoMedio").value = val;
        alert("✨ OTTIMO! Ho impostato il Consumo Reale calcolato dai tuoi scontrini: " + val + " Km/L.\nOra tutti i calcoli teorici sono allineati con la realtà della tua guida!");
        CalcolaRimborsiMensili();
    }
}

// ==========================================
// SUGGERIMENTO PRO: ANGELO CUSTODE SCADENZE
// ==========================================
// ==========================================
// SUGGERIMENTO PRO: ANGELO CUSTODE SCADENZE & BRIEFING
// ==========================================
function GetLoggedUserName() {
    try {
        var fsoLoc = new ActiveXObject("Scripting.FileSystemObject");
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var root = fsoLoc.GetParentFolderName(p);
        var credFile = fsoLoc.BuildPath(fsoLoc.BuildPath(root, "system"), "cred.local");
        if (fsoLoc.FileExists(credFile)) {
            var f = fsoLoc.OpenTextFile(credFile, 1);
            var user = f.ReadLine();
            f.Close();
            return user.trim();
        }
    } catch(e) {}
    return "Ospite";
}

function GetEstimatedAutonomy(consumoMedio) {
    try {
        var sqlRif = "SELECT TOP 1 Litri, KmAttuali, DataRifornimento FROM tblRifornimenti ORDER BY DataRifornimento DESC, ID DESC";
        var resRif = queryAccessDB(sqlRif) || [];
        if (!resRif || resRif.length === 0) return null;
        
        var lastLitri = parseFloat(resRif[0].Litri) || 0;
        var lastDate = resRif[0].DataRifornimento;
        if (lastLitri <= 0 || !lastDate) return null;
        
        var dateFilter = lastDate.split("T")[0];
        if (dateFilter.length > 10) dateFilter = dateFilter.substring(0, 10);
        
        var sqlC = "SELECT KmAndata, KmRitorno FROM tblConsegne WHERE DataConsegna >= #" + dateFilter + "#";
        var resC = queryAccessDB(sqlC) || [];
        
        var kmLavorativiDaPieno = 0;
        for (var i = 0; i < resC.length; i++) {
            kmLavorativiDaPieno += (parseFloat(resC[i].KmAndata) || 0) + (parseFloat(resC[i].KmRitorno) || 0);
        }
        
        // Capacità serbatoio predefinita (44L per Opel Corsa), con possibilità di lettura da config
        var capSerbatoio = 44.0;
        try {
            var resCap = queryAccessDB("SELECT Valore FROM tblConfigAuto WHERE Chiave = 'CapacitaSerbatoio'") || [];
            if (resCap && resCap.length > 0 && parseFloat(resCap[0].Valore) > 0) {
                capSerbatoio = parseFloat(resCap[0].Valore);
            }
        } catch(eCap) {}

        var cMedio = parseFloat(consumoMedio) || 15.0;
        var litriConsumati = kmLavorativiDaPieno / cMedio;
        var litriResidui = Math.max(0, capSerbatoio - litriConsumati);
        return litriResidui * cMedio;
    } catch(e) {
        return null;
    }
}

function EseguiWelcomeBriefing(veicoliData) {
    try {
        var username = GetLoggedUserName();
        var text = "Buongiorno " + username + ". Benvenuto nel tuo cockpit di gestione logistica. ";
        
        if (veicoliData && veicoliData.length > 0) {
            var primaryVeh = veicoliData[0];
            text += "Il tuo veicolo primario, " + (primaryVeh.Modello || "auto").toUpperCase() + ", ha attualmente " + (primaryVeh.KmAttuali || 0) + " chilometri registrati. ";
            
            // Autonomia
            var consumoSetting = parseFloat(document.getElementById("txtConsumoMedio").value.replace(",", ".")) || 15.0;
            var autonomy = GetEstimatedAutonomy(consumoSetting);
            if (autonomy !== null) {
                text += "L'autonomia lavorativa residua con l'ultimo pieno è stimata in " + autonomy.toFixed(0) + " chilometri. ";
                if (autonomy < 100) {
                    text += "Attenzione, l'autonomia stimata è ridotta. Si raccomanda di effettuare rifornimento a breve. ";
                }
            }
            
            // Scadenze documenti
            var oggi = new Date();
            oggi.setHours(0,0,0,0);
            function checkScadenza(dateStr, label) {
                if (!dateStr) return "";
                var p = dateStr.split("-");
                if (p.length < 3) return "";
                var scad = new Date(p[0], p[1]-1, p[2]);
                scad.setHours(0,0,0,0);
                var diffDays = Math.ceil((scad - oggi) / (1000 * 3600 * 24));
                if (diffDays < 0) {
                    return "Attenzione, la scadenza " + label + " è superata da " + Math.abs(diffDays) + " giorni! ";
                } else if (diffDays >= 0 && diffDays <= 15) {
                    return "Attenzione, la scadenza " + label + " scadrà tra " + diffDays + " giorni. ";
                }
                return "";
            }
            
            var alertsText = "";
            alertsText += checkScadenza(primaryVeh.ScadenzaAssicurazione, "dell'assicurazione");
            alertsText += checkScadenza(primaryVeh.ScadenzaRevisione, "della revisione");
            alertsText += checkScadenza(primaryVeh.ScadenzaBollo, "del bollo");
            if (alertsText !== "") {
                text += alertsText;
            }
            
            // Usura componenti X-Ray
            var configRows = queryAccessDB("SELECT Chiave, Valore FROM tblConfigAuto WHERE Chiave LIKE 'XRAY_%_VEH_" + primaryVeh.ID + "'") || [];
            var memoryBase = {};
            for(var j=0; j<configRows.length; j++){
                var key = configRows[j].Chiave.split("_")[1];
                memoryBase[key] = parseFloat(configRows[j].Valore) || 0;
            }
            var components = ['Olio', 'Freni', 'Gomme', 'Cinghia'];
            var wearAlerts = [];
            for (var k=0; k<components.length; k++) {
                var comp = components[k];
                var base = memoryBase[comp] || 0;
                var lifespan = XRAY_LIFESPAN[comp];
                if (primaryVeh.KmAttuali > 0 && base > 0) {
                    var kmPercorsi = primaryVeh.KmAttuali - base;
                    var pct = 100 - (kmPercorsi / lifespan) * 100;
                    if (pct <= 20) {
                        var compNomeITA = comp;
                        if (comp === 'Olio') compNomeITA = "olio motore";
                        if (comp === 'Freni') compNomeITA = "impianto frenante";
                        if (comp === 'Gomme') compNomeITA = "pneumatici";
                        if (comp === 'Cinghia') compNomeITA = "cinghia di distribuzione";
                        wearAlerts.push(compNomeITA + " al " + pct.toFixed(0) + " percento");
                    }
                }
            }
            if (wearAlerts.length > 0) {
                text += "Attenzione: usura critica rilevata per " + wearAlerts.join(", ") + ". Si raccomanda di pianificare la manutenzione. ";
            }
        }
        
        text += "Tutti i sistemi sono stabili. Buona giornata e buona guida!";
        LeggiTestoVocale(text);
    } catch(errSpeech) {}
}

function RipetiBriefingVocale() {
    try {
        var sql = "SELECT * FROM tblVeicoli";
        var data = queryAccessDB(sql) || [];
        if (data.length > 0) {
            EseguiWelcomeBriefing(data);
        } else {
            LeggiTestoVocale("Nessun veicolo registrato per il briefing.");
        }
    } catch(e) {
        alert("Errore durante la riproduzione del briefing vocale: " + e.message);
    }
}

function AggiornaOdimetroVeicoloAutomatico() {
    try {
        var resVeh = queryAccessDB("SELECT TOP 1 ID, KmAttuali FROM tblVeicoli") || [];
        if (!resVeh || resVeh.length === 0) return;
        var vehID = resVeh[0].ID || resVeh[0].id;
        var oldKm = Number(resVeh[0].KmAttuali || resVeh[0].kmattuali) || 0;
        
        var sqlRif = "SELECT TOP 1 KmAttuali, DataRifornimento FROM tblRifornimenti ORDER BY DataRifornimento DESC, ID DESC";
        var resRif = queryAccessDB(sqlRif) || [];
        var baseKm = 0;
        var baseDate = "";
        if (resRif && resRif.length > 0) {
            baseKm = Number(resRif[0].KmAttuali || resRif[0].kmattuali) || 0;
            baseDate = resRif[0].DataRifornimento || resRif[0].datarifornimento || "";
        }
        
        var extraKm = 0;
        if (baseDate !== "" && baseKm > 0) {
            var aCurr = new Date().getFullYear();
            var sqlC = "SELECT DataConsegna, KmAndata, KmRitorno FROM tblConsegne WHERE Year(DataConsegna) = " + aCurr;
            var rowsC = queryAccessDB(sqlC) || [];
            
            var limitStr = baseDate.substring(0, 10);
            for (var j=0; j<rowsC.length; j++) {
                var dc = rowsC[j].DataConsegna || rowsC[j].dataconsegna;
                if (!dc) continue;
                var curDate = dc.substring(0, 10);
                var rowKm = (Number(rowsC[j].KmAndata || rowsC[j].kmandata) || 0) + (Number(rowsC[j].KmRitorno || rowsC[j].kmritorno) || 0);
                if (curDate >= limitStr) {
                    extraKm += rowKm;
                }
            }
        }
        
        var liveOdometer = Math.floor(baseKm + extraKm);
        
        if (liveOdometer > 0 && liveOdometer > oldKm) {
            var sqlUpdate = "UPDATE tblVeicoli SET KmAttuali = " + liveOdometer + " WHERE ID = " + vehID;
            queryAccessDB(sqlUpdate, true);
        }
    } catch(e) {}
}

function VerificaScadenzeCritiche() {
    try {
        // Aggiorna l'odometro del veicolo prima di avviare il welcome briefing
        AggiornaOdimetroVeicoloAutomatico();

        var sql = "SELECT * FROM tblVeicoli";
        var data = queryAccessDB(sql) || [];
        if (data.length === 0) return;

        // Avvia il briefing vocale all'avvio
        EseguiWelcomeBriefing(data);

        var oggi = new Date();
        oggi.setHours(0,0,0,0);
        var alerts = [];

        function analizza(dataStr, tipo, mezzo) {
            if (!dataStr) return;
            var p = dataStr.split("-");
            if (p.length < 3) return;
            var scad = new Date(p[0], p[1] - 1, p[2]);
            scad.setHours(0,0,0,0);
            
            var diffTempo = scad.getTime() - oggi.getTime();
            var diffGiorni = Math.ceil(diffTempo / (1000 * 3600 * 24));

            if (diffGiorni < 0) {
                alerts.push("<div style='border-left:4px solid #ef4444; padding:10px; background:rgba(239, 68, 68, 0.1); margin-bottom:10px; border-radius:4px; color:#fda4af;'><b style='color:#ef4444;'>⛔ SCADUTA!</b> La scadenza <b>" + tipo + "</b> per <b>" + mezzo + "</b> è scaduta da " + Math.abs(diffGiorni) + " giorni!</div>");
            } else if (diffGiorni >= 0 && diffGiorni <= 15) {
                alerts.push("<div style='border-left:4px solid #f59e0b; padding:10px; background:rgba(245, 158, 11, 0.1); margin-bottom:10px; border-radius:4px; color:#fde68a;'><b style='color:#f59e0b;'>⚠️ ATTENZIONE:</b> Mancano solo " + diffGiorni + " giorni alla scadenza <b>" + tipo + "</b> di " + mezzo + ".</div>");
            }
        }

        for (var i = 0; i < data.length; i++) {
            var v = data[i];
            var mezzoInfo = (v.Modello || "Veicolo").toUpperCase() + " (" + (v.Targa || "--") + ")";
            analizza(v.ScadenzaAssicurazione, "Assicurazione", mezzoInfo);
            analizza(v.ScadenzaRevisione, "Revisione", mezzoInfo);
            analizza(v.ScadenzaBollo, "Bollo", mezzoInfo);
        }

        if (alerts.length > 0) {
            LanciaNotificaScadenza(alerts.join(""));
        }
    } catch (e) {}
}

function LanciaNotificaScadenza(contenutoHtml) {
    var overlay = document.createElement("div");
    overlay.id = "notificaAlertOverlay";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 17, 32, 0.8); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(6px);";
    
    var box = document.createElement("div");
    box.style.cssText = "background:#0f172a; width:450px; padding:25px; border-radius:15px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border:1px solid #334155; border-top:6px solid #ef4444; font-family:'Inter',sans-serif; color:#e2e8f0;";
    
    var header = "<h2 style='margin:0 0 15px; color:#ffffff; display:flex; align-items:center; gap:10px; font-family:\"Inter\", sans-serif; font-weight:800;'>🔔 Avviso Scadenze Auto</h2>";
    var body = "<div style='max-height:300px; overflow-y:auto; margin-bottom:20px; font-family:\"Inter\", sans-serif; font-size:13px; line-height:1.5;'>" + contenutoHtml + "</div>";
    var btn = "<button onclick=\"document.getElementById('notificaAlertOverlay').parentNode.removeChild(document.getElementById('notificaAlertOverlay'))\" style='display:block; width:100%; background:#334155; color:#ffffff; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; transition: 0.2s;'>HO CAPITO, GRAZIE</button>";
    
    box.innerHTML = header + body + btn;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// ==========================================================
// FASE 6: CENTRO LOGICO X-RAY - PREDIZIONE SALUTE COMPONENTI
// ==========================================================

// Definizione Durata Standard Cicli Componenti (Km stimati di vita)
var XRAY_LIFESPAN = {
    'Olio': 20000,
    'Freni': 30000,
    'Gomme': 45000,
    'Cinghia': 100000
};

function ToggleXrayConfig(component) {
    var div = document.getElementById("healthConfig_" + component);
    if(div.style.display === "block") {
        div.style.display = "none";
    } else {
        div.style.display = "block";
        document.getElementById("baseKm_" + component).focus();
    }
}

function LoadAndRenderXray(veicoloID, currentKm) {
    var numKm = parseFloat(currentKm) || 0;
    
    // 1. Recupera tutti i baseline del veicolo corrente dal DB CONFIG
    var configRows = queryAccessDB("SELECT Chiave, Valore FROM tblConfigAuto WHERE Chiave LIKE 'XRAY_%_VEH_" + veicoloID + "'") || [];
    var memoryBase = {};
    for(var i=0; i<configRows.length; i++){
        var key = configRows[i].Chiave.split("_")[1]; // Estrae es. 'Olio' da 'XRAY_Olio_VEH_5'
        memoryBase[key] = parseFloat(configRows[i].Valore) || 0;
    }

    var components = ['Olio', 'Freni', 'Gomme', 'Cinghia'];

    for (var j=0; j<components.length; j++) {
        var comp = components[j];
        var base = memoryBase[comp] || 0; // Se non presente, assume 0 come default

        // Popola l'input field nascosto
        var inp = document.getElementById("baseKm_" + comp);
        if(inp) inp.value = base > 0 ? base : "";

        // Calcolo salute
        var lifespan = XRAY_LIFESPAN[comp];
        var pct = 100;
        
        if (numKm > 0 && base > 0) {
            var kmPercorsiDaCambio = numKm - base;
            if (kmPercorsiDaCambio < 0) kmPercorsiDaCambio = 0; // Caso di reset futuro
            
            var percUsura = (kmPercorsiDaCambio / lifespan) * 100;
            pct = 100 - percUsura;
            if (pct < 0) pct = 0;
        } else if (numKm > 0 && base === 0) {
             // Se non ha impostato la base, partiamo da 100% e mettiamo avviso o calcolo da zero?
             // Per semplicità assumiamo 100% ma avvisiamo visivamente impostando grigio o 100
             pct = 100; 
        }

        // Update UI
        var lbl = document.getElementById("healthPct_" + comp);
        var fill = document.getElementById("healthFill_" + comp);
        
        if(lbl) lbl.innerText = pct.toFixed(0) + "%";
        if(fill) {
            fill.style.width = pct.toFixed(0) + "%";
            // Reset classi colore
            fill.className = "health-bar-fill";
            if(pct <= 15) fill.className += " danger";
            else if(pct <= 40) fill.className += " warning";
        }
    }
}

function SaveXrayBaseline(component) {
    var vehId = document.getElementById("txtIDVeh").value;
    var val = document.getElementById("baseKm_" + component).value.trim();
    
    if (!vehId || vehId === "" || vehId === "NUOVO") {
        alert("Salvare prima il veicolo per abilitare l'analisi componenti.");
        return;
    }
    
    if (val === "" || isNaN(parseFloat(val))) {
        alert("Inserisci un valore chilometrico valido.");
        return;
    }

    var numVal = parseFloat(val);
    var keyName = "XRAY_" + component + "_VEH_" + vehId;

    // 1. Controlliamo se la chiave esiste per decidere UPDATE o INSERT
    var checkSql = "SELECT ID FROM tblConfigAuto WHERE Chiave = '" + keyName + "'";
    var resCheck = queryAccessDB(checkSql) || [];
    
    var sql = "";
    if (resCheck.length > 0) {
        sql = "UPDATE tblConfigAuto SET Valore = '" + numVal + "' WHERE Chiave = '" + keyName + "'";
    } else {
        sql = "INSERT INTO tblConfigAuto (Chiave, Valore) VALUES ('" + keyName + "', '" + numVal + "')";
    }

    if (queryAccessDB(sql, true)) {
        alert("Kilometria base per " + component + " aggiornata con successo!");
        document.getElementById("healthConfig_" + component).style.display = "none";
        // Ricalcola al volo
        var curKm = document.getElementById("txtKmAttuali").value || 0;
        LoadAndRenderXray(vehId, curKm);
    } else {
        alert("Errore durante il salvataggio della configurazione X-RAY.");
    }
}

function ResetXrayToCurrent(component) {
    var vehId = document.getElementById("txtIDVeh").value;
    var kmAttuali = document.getElementById("txtKmAttuali").value.trim();
    
    if (!vehId || vehId === "" || vehId === "NUOVO") {
        alert("Salvare prima il veicolo per abilitare l'analisi componenti.");
        return;
    }
    
    if (kmAttuali === "" || isNaN(parseFloat(kmAttuali))) {
        alert("Impossibile eseguire il reset: il veicolo non ha dei chilometri attuali validi.");
        return;
    }
    
    if (!confirm("Vuoi impostare il chilometraggio di ultimo cambio per " + component + " a " + kmAttuali + " Km?")) {
        return;
    }
    
    document.getElementById("baseKm_" + component).value = kmAttuali;
    SaveXrayBaseline(component);
}
// Append functions for clock and user widget
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
        var fsoLoc = new ActiveXObject("Scripting.FileSystemObject");
        var p = document.location.pathname;
        if (p.indexOf("/") === 0) p = p.substring(1);
        p = decodeURIComponent(p).replace(/\//g, "\\");
        var root = fsoLoc.GetParentFolderName(p);
        var credFile = fsoLoc.BuildPath(fsoLoc.BuildPath(root, "system"), "cred.local");
        
        var user = "Ciro Milella";
        if (fsoLoc.FileExists(credFile)) {
            var f = fsoLoc.OpenTextFile(credFile, 1);
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

// ============================================================
// UTILS PREMIUM UX: CONTATORE ANIMATO STILE SLOT MACHINE (2026)
// ============================================================
function AnimateSlotMachineNumber(elementId, targetValue, suffix, prefix, decimals) {
    try {
        var el = document.getElementById(elementId);
        if (!el) return;
        
        suffix = suffix || "";
        prefix = prefix || "";
        if (decimals === undefined || decimals === null) decimals = 2;
        
        var target = parseFloat(targetValue);
        if (isNaN(target)) {
            el.innerText = prefix + targetValue + suffix;
            return;
        }
        
        // Ferma eventuali animazioni in corso sull'elemento
        if (el._slotTimer) {
            clearInterval(el._slotTimer);
        }
        
        var startTime = new Date().getTime();
        var duration = 1300; // Durata: 1.3 secondi per una girata fluida e godibile
        
        // Cattura il valore attuale per farlo scorrere dal punto in cui si trova! (Continuità UX)
        var rawVal = el.innerText.replace(suffix, "").replace(prefix, "").replace(/[^0-9.-]+/g, "").replace(",", ".");
        var startVal = parseFloat(rawVal) || 0;
        
        // Se il valore è identico, non animare
        var delta = Math.pow(10, -decimals) / 2;
        if (Math.abs(target - startVal) < delta) {
            el.innerText = prefix + target.toFixed(decimals).replace(".", ",") + suffix;
            return;
        }
        
        el._slotTimer = setInterval(function() {
            var now = new Date().getTime();
            var elapsed = now - startTime;
            
            if (elapsed >= duration) {
                clearInterval(el._slotTimer);
                el._slotTimer = null;
                el.innerText = prefix + target.toFixed(decimals).replace(".", ",") + suffix;
                return;
            }
            
            // Curva di Easing: easeOutQuart (frenata dei rulli in slow-mo alla fine)
            var t = elapsed / duration;
            var ease = 1 - Math.pow(1 - t, 4);
            
            var current = startVal + (target - startVal) * ease;
            
            // Formattazione italiana
            var currentStr = current.toFixed(decimals).replace(".", ",");
            el.innerText = prefix + currentStr + suffix;
            
        }, 25); // 40 fps per massima fluidità visiva!
        
    } catch(ex) {
        // Fallback istantaneo in caso di anomalie legacy HTA
        var fallEl = document.getElementById(elementId);
        if(fallEl) fallEl.innerText = (prefix||"") + targetValue.toFixed(decimals||2).replace(".", ",") + (suffix||"");
    }
}

// ============================================================
// GRAFICO DOUGHNUT: RIPARTIZIONE SPESE VEICOLO & PROFITTO
// ============================================================
var doughnutChartInst = null;

function AggiornaGraficoRipartizione(rimborsi, benzina, manutenzione, netto) {
    setTimeout(function() {
    try {
        var ctx = document.getElementById('chartRipartizioneCosti');
        if (!ctx) return;
        
        if (doughnutChartInst) { doughnutChartInst.destroy(); }
        ctx.removeAttribute('width');
        ctx.removeAttribute('height');
        ctx.style.width = '';
        ctx.style.height = '';
        
        var pNetto = netto > 0 ? netto : 0;
        var pBenzina = benzina > 0 ? benzina : 0;
        var pManutenzione = manutenzione > 0 ? manutenzione : 0;
        
        var grandTot = pNetto + pBenzina + pManutenzione;
        if (grandTot <= 0) grandTot = 0.01; 
        
        var chartCtx = ctx.getContext('2d');
        
        doughnutChartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Profitto Netto', 'Costo Benzina', 'Manutenzione'],
                datasets: [{
                    data: [pNetto.toFixed(2), pBenzina.toFixed(2), pManutenzione.toFixed(2)],
                    backgroundColor: [
                        '#10b981', // Neon Emerald
                        '#f59e0b', // Vivid Amber
                        '#ef4444'  // Crimson Red
                    ],
                    borderColor: '#1a2235',
                    borderWidth: 2,
                    hoverBorderColor: '#ffffff',
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutoutPercentage: 65,
                animation: {
                    animateScale: true,
                    animateRotate: true
                },
                legend: {
                    display: false // Spento per rendere la legenda in HTML
                },
                tooltips: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFontFamily: 'Inter',
                    titleFontSize: 11,
                    bodyFontFamily: 'Inter',
                    bodyFontSize: 11,
                    bodyFontStyle: 'bold',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(tooltipItem, data) {
                            var val = parseFloat(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index]);
                            return " " + data.labels[tooltipItem.index] + ": " + val.toFixed(2).replace(".", ",") + " €";
                        }
                    }
                }
            }
        });

        // Genera Legenda HTML Premium
        var legendEl = document.getElementById("htmlChartLegend");
        var btnD = document.getElementById("btnChartDoughnut");
        if (legendEl && (!btnD || btnD.className.indexOf("active") > -1)) {
            var p1 = ((pNetto / grandTot) * 100).toFixed(0);
            var p2 = ((pBenzina / grandTot) * 100).toFixed(0);
            var p3 = ((pManutenzione / grandTot) * 100).toFixed(0);
            
            var html = "";
            html += "<div style='background:rgba(16,185,129,0.06); border:1.5px solid rgba(16,185,129,0.15); border-radius:8px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;'>";
            html += "  <div style='display:flex; align-items:center; gap:6px;'><span style='width:6px; height:6px; border-radius:50%; background:#10b981;'></span><span style='color:#cbd5e1; font-weight:800; font-size:10px; font-family:\'Inter\',sans-serif;'>PROFITTO</span></div>";
            html += "  <div style='text-align:right;'><b style='color:#10b981; font-family:monospace; font-size:11px;'>" + pNetto.toFixed(2) + " €</b> <span style='font-size:9px; color:#64748b; font-weight:bold; font-family:\'Inter\',sans-serif;'>(" + p1 + "%)</span></div>";
            html += "</div>";
            
            html += "<div style='background:rgba(245,158,11,0.06); border:1.5px solid rgba(245,158,11,0.15); border-radius:8px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;'>";
            html += "  <div style='display:flex; align-items:center; gap:6px;'><span style='width:6px; height:6px; border-radius:50%; background:#f59e0b;'></span><span style='color:#cbd5e1; font-weight:800; font-size:10px; font-family:\'Inter\',sans-serif;'>BENZINA</span></div>";
            html += "  <div style='text-align:right;'><b style='color:#f59e0b; font-family:monospace; font-size:11px;'>" + pBenzina.toFixed(2) + " €</b> <span style='font-size:9px; color:#64748b; font-weight:bold; font-family:\'Inter\',sans-serif;'>(" + p2 + "%)</span></div>";
            html += "</div>";
            
            html += "<div style='background:rgba(239,68,68,0.06); border:1.5px solid rgba(239,68,68,0.15); border-radius:8px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;'>";
            html += "  <div style='display:flex; align-items:center; gap:6px;'><span style='width:6px; height:6px; border-radius:50%; background:#ef4444;'></span><span style='color:#cbd5e1; font-weight:800; font-size:10px; font-family:\'Inter\',sans-serif;'>OFFICINA</span></div>";
            html += "  <div style='text-align:right;'><b style='color:#ef4444; font-family:monospace; font-size:11px;'>" + pManutenzione.toFixed(2) + " €</b> <span style='font-size:9px; color:#64748b; font-weight:bold; font-family:\'Inter\',sans-serif;'>(" + p3 + "%)</span></div>";
            html += "</div>";
            
            legendEl.innerHTML = html;
            legendEl.style.display = "flex";
        }
    } catch(ex) {}
    }, 50);
}

var kmChartInst = null;
function AggiornaGraficoKm(kmLavoro, kmTotali, consumoReale) {
    setTimeout(function() {
    try {
        var ctx = document.getElementById('chartRipartizioneChilometri');
        if (!ctx) return;
        
        if (kmChartInst) { kmChartInst.destroy(); }
        ctx.removeAttribute('width');
        ctx.removeAttribute('height');
        ctx.style.width = '';
        ctx.style.height = '';
        
        var kmLavoroVal = parseFloat(kmLavoro) || 0;
        var kmTotaliVal = parseFloat(kmTotali) || 0;
        var kmPersonaliVal = Math.max(0, kmTotaliVal - kmLavoroVal);
        
        var grandTot = kmLavoroVal + kmPersonaliVal;
        if (grandTot <= 0) grandTot = 0.01;
        
        var chartCtx = ctx.getContext('2d');
        
        kmChartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Km Lavorativi', 'Km Personali'],
                datasets: [{
                    data: [kmLavoroVal.toFixed(1), kmPersonaliVal.toFixed(1)],
                    backgroundColor: [
                        '#06b6d4', // Cyan
                        '#ec4899'  // Pink
                    ],
                    borderColor: '#1a2235',
                    borderWidth: 2,
                    hoverBorderColor: '#ffffff',
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutoutPercentage: 65,
                animation: {
                    animateScale: true,
                    animateRotate: true
                },
                legend: {
                    display: false // Spento per rendere la legenda in HTML
                },
                tooltips: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFontFamily: 'Inter',
                    titleFontSize: 11,
                    bodyFontFamily: 'Inter',
                    bodyFontSize: 11,
                    bodyFontStyle: 'bold',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(tooltipItem, data) {
                            var val = parseFloat(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index]);
                            return " " + data.labels[tooltipItem.index] + ": " + val.toFixed(1).replace(".", ",") + " Km";
                        }
                    }
                }
            }
        });

        // Genera Legenda HTML Premium per i KM
        var legendEl = document.getElementById("htmlChartLegend");
        var btnK = document.getElementById("btnChartKm");
        if (legendEl && (!btnK || btnK.className.indexOf("active") > -1)) {
            var pL = ((kmLavoroVal / grandTot) * 100).toFixed(0);
            var pP = ((kmPersonaliVal / grandTot) * 100).toFixed(0);
            
            var html = "";
            html += "<div style='background:rgba(6,182,212,0.06); border:1.5px solid rgba(6,182,212,0.15); border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; margin-top:8px;'>";
            html += "  <div style='display:flex; align-items:center; gap:8px;'><span style='width:7px; height:7px; border-radius:50%; background:#06b6d4;'></span><span style='color:#cbd5e1; font-weight:800; font-size:10px; text-transform:uppercase; font-family:\'Inter\',sans-serif;'>Km Lavoro</span></div>";
            html += "  <div style='text-align:right;'><b style='color:#06b6d4; font-family:monospace; font-size:12px;'>" + kmLavoroVal.toFixed(1) + " Km</b> <span style='font-size:9.5px; color:#64748b; font-weight:bold; font-family:\'Inter\',sans-serif;'>(" + pL + "%)</span></div>";
            html += "</div>";
            
            html += "<div style='background:rgba(236,72,153,0.06); border:1.5px solid rgba(236,72,153,0.15); border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; margin-top:8px;'>";
            html += "  <div style='display:flex; align-items:center; gap:8px;'><span style='width:7px; height:7px; border-radius:50%; background:#ec4899;'></span><span style='color:#cbd5e1; font-weight:800; font-size:10px; text-transform:uppercase; font-family:\\'Inter\\',sans-serif;'>Km Privati</span>";
            html += "  <span onclick='MostraInfoKmPrivati()' style='cursor:pointer; background:rgba(236,72,153,0.2); color:#ec4899; width:16px; height:16px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; margin-left:4px; box-shadow:0 0 5px rgba(236,72,153,0.3);' title=\"Come viene calcolato?\">?</span></div>";
            html += "  <div style='text-align:right;'><b style='color:#ec4899; font-family:monospace; font-size:12px;'>" + kmPersonaliVal.toFixed(1) + " Km</b> <span style='font-size:9.5px; color:#64748b; font-weight:bold; font-family:\\'Inter\\',sans-serif;'>(" + pP + "%)</span></div>";
            html += "</div>";
            
            // --- NEW: BOX EVIDENZIATO TOTALE KM ---
            html += "<div style='background:rgba(245,158,11,0.1); border:1.5px solid rgba(245,158,11,0.3); border-radius:8px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; margin-top:12px;'>";
            html += "  <div style='display:flex; align-items:center; gap:8px;'><i class='fa fa-tachometer' style='color:#f59e0b; font-size:13px;'></i><span style='color:#fcd34d; font-weight:800; font-size:11px; text-transform:uppercase; font-family:\\'Inter\\',sans-serif;'>Totale Percorso</span></div>";
            html += "  <div style='text-align:right;'><b style='color:#f59e0b; font-family:monospace; font-size:14px; text-shadow:0 0 5px rgba(245,158,11,0.4);'>" + grandTot.toFixed(1) + " Km</b></div>";
            html += "</div>";
            
            // --- KICCA 1: MESSAGGIO ANALISI ---
            var splitRatioMsg = "";
            var splitColor = "";
            var splitIcon = "";
            if (kmLavoroVal >= kmPersonaliVal && grandTot > 100) {
                splitRatioMsg = "USO PREVALENTE LAVORATIVO";
                splitColor = "#06b6d4";
                splitIcon = "fa-briefcase";
            } else if (kmPersonaliVal > kmLavoroVal && grandTot > 100) {
                splitRatioMsg = "USO PREVALENTE PRIVATO";
                splitColor = "#ec4899";
                splitIcon = "fa-car";
            }
            
            if (splitRatioMsg !== "") {
                html += "<div style='margin-top:12px; text-align:center;'>";
                html += "  <span style='background:rgba(255,255,255,0.05); border:1px solid " + splitColor + "; color:" + splitColor + "; padding:4px 10px; border-radius:12px; font-size:8.5px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; box-shadow:0 0 8px " + splitColor + "40;'><i class='fa " + splitIcon + "' style='margin-right:4px;'></i>" + splitRatioMsg + "</span>";
                html += "</div>";
            }
            
            // --- KICCA 2: EFFICIENZA (SE PRESENTE) ---
            if (consumoReale && consumoReale > 0) {
                html += "<div style='background:rgba(16,185,129,0.08); border:1.5px dashed rgba(16,185,129,0.3); border-radius:8px; padding:6px 12px; margin-top:10px; display:flex; justify-content:space-between; align-items:center;'>";
                html += "  <div style='display:flex; align-items:center; gap:8px;'><i class='fa fa-leaf' style='color:#10b981; font-size:12px;'></i><span style='color:#34d399; font-weight:800; font-size:10px; text-transform:uppercase; font-family:\\'Inter\\',sans-serif;'>Efficienza Media</span></div>";
                html += "  <div style='text-align:right;'><b style='color:#10b981; font-family:monospace; font-size:13px; text-shadow:0 0 5px rgba(16,185,129,0.5);'>" + consumoReale.toFixed(1) + " Km/L</b></div>";
                html += "</div>";
            }
            
            if (window.currentTrackingDate) {
                var itTrackingDate = window.currentTrackingDate.split("-").reverse().join("/");
                html += "<div style='text-align:center; font-size:9px; color:#94a3b8; margin-top:12px; padding-top:8px; border-top:1px dashed #334155;'><i class='fa fa-clock-o' style='margin-right:5px;'></i> Tracciato a partire dal: <b>" + itTrackingDate + "</b></div>";
            } else {
                html += "<div style='text-align:center; margin-top:12px; padding-top:8px; border-top:1px dashed #334155;'><button onclick='CalibraInizioAnno()' style='background:transparent; border:1px solid #eab308; color:#eab308; padding:3px 8px; border-radius:4px; font-size:9px; font-weight:bold; cursor:pointer;'>CALIBRA PUNTO ZERO</button></div>";
            }
            
            legendEl.innerHTML = html;
            legendEl.style.display = "flex";
        }
    } catch(ex) {
        alert("Errore Grafico KM: " + ex.message);
    }
    }, 50);
}

var barChartInst = null;
function AggiornaGraficoAndamento(netMesi) {
    setTimeout(function() {
    try {
        var ctx = document.getElementById('chartAndamentoMensile');
        if (!ctx) return;
        
        if (barChartInst) { barChartInst.destroy(); }
        ctx.removeAttribute('width');
        ctx.removeAttribute('height');
        ctx.style.width = '';
        ctx.style.height = '';
        
        var labels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        var bgColors = [];
        var borderColors = [];
        
        for (var i = 0; i < 12; i++) {
            var v = netMesi[i] || 0;
            if (v >= 0) {
                bgColors.push('rgba(6, 182, 212, 0.35)');
                borderColors.push('#06b6d4');
            } else {
                bgColors.push('rgba(239, 68, 68, 0.35)');
                borderColors.push('#ef4444');
            }
        }
        
        var chartCtx = ctx.getContext('2d');
        
        barChartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Guadagno Netto (€)',
                    data: netMesi,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: { display: false },
                scales: {
                    yAxes: [{
                        gridLines: { color: 'rgba(51, 65, 85, 0.3)', zeroLineColor: 'rgba(94, 163, 184, 0.6)', drawBorder: false },
                        ticks: { 
                            fontColor: '#94a3b8',
                            fontStyle: 'bold',
                            fontSize: 9,
                            callback: function(val){ return val.toFixed(0) + " €"; } 
                        }
                    }],
                    xAxes: [{
                        gridLines: { display: false },
                        ticks: { 
                            fontColor: '#94a3b8',
                            fontStyle: 'bold',
                            fontSize: 9
                        }
                    }]
                },
                tooltips: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFontFamily: 'Inter',
                    titleFontSize: 11,
                    bodyFontFamily: 'Inter',
                    bodyFontSize: 11,
                    bodyFontStyle: 'bold',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(tooltipItem, data) {
                            var val = parseFloat(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index]);
                            return " Guadagno Netto: " + (val >= 0 ? "+" : "") + val.toFixed(2).replace(".", ",") + " €";
                        }
                    }
                }
            }
        });
    } catch(ex) {}
    }, 50);
}

function ToggleRimborsiChart(type) {
    try {
        var dChart = document.getElementById("wrapperRipartizioneCosti");
        var bChart = document.getElementById("wrapperAndamentoMensile");
        var kChart = document.getElementById("wrapperRipartizioneChilometri");
    var btnD = document.getElementById("btnChartDoughnut");
    var btnB = document.getElementById("btnChartBar");
    var btnK = document.getElementById("btnChartKm");
    var legendEl = document.getElementById("htmlChartLegend");
    var canvasWrapper = document.getElementById("chartCanvasWrapper");
    
    if(!dChart || !bChart || !btnD || !btnB) return;
    
    if (type === "bar") {
        dChart.style.display = "none";
        bChart.style.display = "block";
        if (kChart) kChart.style.display = "none";
        
        if (legendEl) legendEl.style.display = "none";
        if (canvasWrapper) canvasWrapper.style.flex = "1";
        
        btnD.className = "chart-tab-btn";
        btnD.style.color = "#94a3b8";
        btnD.style.background = "transparent";
        btnD.style.fontWeight = "bold";
        
        btnB.className = "chart-tab-btn active";
        btnB.style.color = "#0ea5e9";
        btnB.style.background = "rgba(14,165,233,0.15)";
        btnB.style.fontWeight = "800";
        
        if (btnK) {
            btnK.className = "chart-tab-btn";
            btnK.style.color = "#94a3b8";
            btnK.style.background = "transparent";
            btnK.style.fontWeight = "bold";
        }
        
        // Trigger redrawing of monthly trend chart with actual data
        if (barChartInst) {
            var bData = barChartInst.data.datasets[0].data;
            AggiornaGraficoAndamento(bData);
        }
    } else if (type === "km") {
        dChart.style.display = "none";
        bChart.style.display = "none";
        if (kChart) kChart.style.display = "block";
        
        if (legendEl) legendEl.style.display = "flex";
        if (canvasWrapper) canvasWrapper.style.flex = "1.2";
        
        btnD.className = "chart-tab-btn";
        btnD.style.color = "#94a3b8";
        btnD.style.background = "transparent";
        btnD.style.fontWeight = "bold";
        
        btnB.className = "chart-tab-btn";
        btnB.style.color = "#94a3b8";
        btnB.style.background = "transparent";
        btnB.style.fontWeight = "bold";
        
        if (btnK) {
            btnK.className = "chart-tab-btn active";
            btnK.style.color = "#0ea5e9";
            btnK.style.background = "rgba(14,165,233,0.15)";
            btnK.style.fontWeight = "800";
        }
        
        // Trigger redrawing of HTML legend with actual data
        if (kmChartInst) {
            var kData = kmChartInst.data.datasets[0].data;
            AggiornaGraficoKm(parseFloat(kData[0]), parseFloat(kData[0]) + parseFloat(kData[1]));
        }
    } else {
        dChart.style.display = "block";
        bChart.style.display = "none";
        if (kChart) kChart.style.display = "none";
        
        if (legendEl) legendEl.style.display = "flex";
        if (canvasWrapper) canvasWrapper.style.flex = "1.2";
        
        btnD.className = "chart-tab-btn active";
        btnD.style.color = "#0ea5e9";
        btnD.style.background = "rgba(14,165,233,0.15)";
        btnD.style.fontWeight = "800";
        
        btnB.className = "chart-tab-btn";
        btnB.style.color = "#94a3b8";
        btnB.style.background = "transparent";
        btnB.style.fontWeight = "bold";
        
        if (btnK) {
            btnK.className = "chart-tab-btn";
            btnK.style.color = "#94a3b8";
            btnK.style.background = "transparent";
            btnK.style.fontWeight = "bold";
        }
        
        // Trigger redrawing of HTML legend with actual data
        if (doughnutChartInst) {
            var dData = doughnutChartInst.data.datasets[0].data;
            AggiornaGraficoRipartizione(parseFloat(dData[0]), parseFloat(dData[1]), parseFloat(dData[2]), parseFloat(dData[0]));
        }
    }
    } catch(ex) {
        alert("Errore Cambio Scheda Grafico: " + ex.message);
    }
}

// ============================================================
// PREDITTIVO: AUTOPILOTA AUTONOMIA SERBATOIO LAVORO (2026)
// ============================================================
function CalcolaAutonomiaResidua(consumoMedio) {
    var box = document.getElementById("divPredictiveAutonomia");
    var lbl = document.getElementById("lblPredictiveAutonomiaText");
    var icon = document.getElementById("iconPredictiveAutonomia");
    if (!box || !lbl) return;
    
    try {
        // 1. Trova ultimo rifornimento registrato
        var sqlRif = "SELECT TOP 1 Litri, KmAttuali, DataRifornimento FROM tblRifornimenti ORDER BY DataRifornimento DESC, ID DESC";
        var resRif = queryAccessDB(sqlRif) || [];
        
        if (!resRif || resRif.length === 0) {
            box.style.display = "none";
            return;
        }
        
        var lastLitri = parseFloat(resRif[0].Litri) || 0;
        var lastDate = resRif[0].DataRifornimento;
        
        if (lastLitri <= 0 || !lastDate) {
            box.style.display = "none";
            return;
        }
        
        // Estrai YYYY-MM-DD per query compatibile Access
        var dateFilter = lastDate.split("T")[0];
        if (dateFilter.length > 10) dateFilter = dateFilter.substring(0, 10);
        
        // 2. Somma i km di tutte le consegne da quella data ad oggi
        var sqlC = "SELECT KmAndata, KmRitorno FROM tblConsegne WHERE DataConsegna >= #" + dateFilter + "#";
        var resC = queryAccessDB(sqlC) || [];
        
        var kmLavorativiDaPieno = 0;
        for (var i=0; i<resC.length; i++) {
            kmLavorativiDaPieno += (parseFloat(resC[i].KmAndata) || 0) + (parseFloat(resC[i].KmRitorno) || 0);
        }
        
        // 3. Formula consumi
        var cMedio = parseFloat(consumoMedio) || 15.0;
        
        // Capacità serbatoio predefinita (44L per Opel Corsa), con possibilità di lettura da config
        var capSerbatoio = 44.0;
        try {
            var resCap = queryAccessDB("SELECT Valore FROM tblConfigAuto WHERE Chiave = 'CapacitaSerbatoio'") || [];
            if (resCap && resCap.length > 0 && parseFloat(resCap[0].Valore) > 0) {
                capSerbatoio = parseFloat(resCap[0].Valore);
            }
        } catch(eCap) {}

        var litriConsumati = kmLavorativiDaPieno / cMedio;
        var litriResidui = capSerbatoio - litriConsumati;
        if (litriResidui < 0) litriResidui = 0;
        
        var kmResiduiTeorici = litriResidui * cMedio;
        var pct = (litriResidui / capSerbatoio) * 100;
        
        box.style.display = "flex";
        var itDate = dbToItDate(lastDate);
        
        if (litriResidui <= 6 || pct < 18) {
            // ALLERTA RISERVA
            box.style.background = "rgba(239, 68, 68, 0.08)";
            box.style.borderColor = "#ef4444";
            box.style.boxShadow = "0 0 20px rgba(239, 68, 68, 0.3)";
            if (icon) {
                icon.style.color = "#ef4444";
                icon.innerHTML = '<i class="fa fa-exclamation-triangle" style="animation: pulse 1s infinite;"></i>';
            }
            lbl.innerHTML = "<b>⚠️ ATTENZIONE RISERVA IMMINENTE!</b> Con il pieno del " + itDate + " (rabbocco di " + lastLitri.toFixed(1) + "L) e " + kmLavorativiDaPieno.toFixed(0) + " Km di consegne effettuate, ti rimangono circa <b style='color:#f87171;'>" + litriResidui.toFixed(1) + " Litri</b> lavorativi prima della riserva. <b style='text-decoration:underline; color:#ffffff;'>Autonomia residua: ~" + kmResiduiTeorici.toFixed(0) + " Km.</b> Si raccomanda rifornimento.";
        } else {
            // NOMINALE
            box.style.background = "rgba(6, 182, 212, 0.06)";
            box.style.borderColor = "#0891b2";
            box.style.boxShadow = "0 5px 15px rgba(6,182,212,0.1)";
            if (icon) {
                icon.style.color = "#06b6d4";
                icon.innerHTML = '<i class="fa fa-rocket"></i>';
            }
            lbl.innerHTML = "Stato carburante efficiente. Dall'ultimo pieno del " + itDate + " (rabbocco di " + lastLitri.toFixed(1) + "L) hai svolto " + kmLavorativiDaPieno.toFixed(0) + " Km di consegne. Ti rimangono teoricamente <b style='color:#22d3ee;'>" + litriResidui.toFixed(1) + " Litri</b> per le prossime consegne (Autonomia stimata: <b style='color:#22d3ee;'>" + kmResiduiTeorici.toFixed(0) + " Km</b> su " + capSerbatoio.toFixed(0) + "L).";
        }
        
    } catch(e) {
        box.style.display = "none";
    }
}

// Mostra alert informativo sul calcolo dei Km Privati
function MostraInfoKmPrivati() {
    var msg = "💡 COME VENGONO CALCOLATI I KM PRIVATI?\n\n";
    msg += "Il calcolo non si basa sui km totali di vita dell'auto, ma solo sul periodo attualmente tracciato.\n\n";
    msg += "1. TOTALE PERCORSO: Il sistema legge i km del cruscotto tra il primo rifornimento dell'anno (o da quando hai iniziato a tracciare) e l'ultimo rifornimento inserito.\n";
    msg += "2. KM LAVORO: Somma i Km (Andata + Ritorno) di tutte le consegne che hai registrato esattamente in quello stesso periodo.\n";
    msg += "3. KM PRIVATI: È la differenza matematica (Totale Percorso - Km Lavoro). Il sistema presume che i km restanti siano stati fatti per uso personale o per tragitti non lavorativi.\n";
    alert(msg);
}


// --- INIZIO AGGIORNAMENTI FASE 3 "SCI-FI HORIZON" ---

// A. GESTIONE TIMELINE SPESE & INTERVENTI
function CambiaVistaSpese(tipo) {
    var btnTabella = document.getElementById("btnViewSpeseTabella");
    var btnTimeline = document.getElementById("btnViewSpeseTimeline");
    var containerTab = document.getElementById("containerSpeseTabella");
    var containerTime = document.getElementById("containerSpeseTimeline");

    if (tipo === "timeline") {
        btnTabella.classList.remove("active");
        btnTimeline.classList.add("active");
        containerTab.style.display = "none";
        containerTime.style.display = "block";
    } else {
        btnTabella.classList.add("active");
        btnTimeline.classList.remove("active");
        containerTab.style.display = "block";
        containerTime.style.display = "none";
    }
}

function RenderSpeseTimeline(arr) {
    var container = document.getElementById("timelineSpese");
    if (!container) return;
    container.innerHTML = "";

    if (arr.length === 0) {
        container.innerHTML = "<div style='text-align:center; color:#94a3b8; font-style:italic; padding:30px;'>Nessuna spesa da visualizzare nella timeline.</div>";
        return;
    }

    // Clona e ordina l'array per data decrescente (dal più recente al più vecchio)
    var sortedArr = arr.slice().sort(function(a, b) {
        return new Date(b.DataIntervento) - new Date(a.DataIntervento);
    });

    for (var i = 0; i < sortedArr.length; i++) {
        var s = sortedArr[i];
        var sideClass = (i % 2 === 0) ? "left" : "right";
        
        var iconClass = "fa-wrench"; // Default
        var color = "#0ea5e9";
        if (s.TipoIntervento === "STRAORDINARIA") {
            iconClass = "fa-exclamation-triangle";
            color = "#f43f5e";
        } else if (s.Descrizione && (s.Descrizione.toLowerCase().indexOf("gomm") !== -1 || s.Descrizione.toLowerCase().indexOf("pneumatic") !== -1)) {
            iconClass = "fa-circle-o-notch";
            color = "#10b981";
        } else if (s.Descrizione && (s.Descrizione.toLowerCase().indexOf("olio") !== -1 || s.Descrizione.toLowerCase().indexOf("tagliando") !== -1)) {
            iconClass = "fa-filter";
            color = "#f59e0b";
        }

        var item = document.createElement("div");
        item.className = "timeline-item " + sideClass;
        item.style.animationDelay = (i * 0.1) + "s";

        var badge = document.createElement("div");
        badge.className = "timeline-badge";
        badge.style.borderColor = color;
        badge.style.color = color;
        badge.innerHTML = '<i class="fa ' + iconClass + '"></i>';
        item.appendChild(badge);

        var card = document.createElement("div");
        card.className = "timeline-card";
        
        // Trova l'indice originale nel memory array per permettere la selezione al click
        var origIdx = -1;
        for(var k=0; k<arr.length; k++) { if(arr[k].ID === s.ID) { origIdx = k; break; } }
        
        if (origIdx !== -1) {
            card.setAttribute("data-orig-idx", origIdx);
            card.onclick = function() {
                var oIdx = Number(this.getAttribute("data-orig-idx"));
                selectedSpesaIdx = oIdx;
                CaricaDettaglioSpesa(speseMemory[oIdx]);
                
                // Evidenziamo visivamente nel layout
                var allCards = document.querySelectorAll(".timeline-card");
                for (var idx = 0; idx < allCards.length; idx++) {
                    var c = allCards[idx];
                    c.style.borderColor = "#334155";
                    c.style.boxShadow = "";
                }
                this.style.borderColor = "#38bdf8";
                this.style.boxShadow = "0 0 20px rgba(56, 189, 248, 0.3)";
            };
        }

        var html = "";
        html += "<div class='timeline-date'>" + dbToItDate(s.DataIntervento) + "</div>";
        html += "<div class='timeline-title'>" + (s.Descrizione || "").toUpperCase() + "</div>";
        html += "<div class='timeline-cost'>" + (s.Costo ? Number(s.Costo).toFixed(2) + " €" : "0.00 €") + "</div>";
        if (s.Note) {
            html += "<div class='timeline-note'>" + s.Note + "</div>";
        }
        
        card.innerHTML = html;
        item.appendChild(card);
        container.appendChild(item);
    }
}

// B. PREDITTORE METEO GOMME STAGIONALI
function CheckMeteoGomme() {
    var box = document.getElementById("divMeteoGomme");
    var lbl = document.getElementById("lblMeteoGommeText");
    var icon = document.getElementById("iconMeteoGomme");
    if (!box || !lbl) return;

    try {
        var oggi = new Date();
        var mese = oggi.getMonth() + 1; 
        var giorno = oggi.getDate();
        
        // Legge italiana pneumatici:
        // Obbligo Invernali: 15 Nov - 15 Apr (Tolleranza dal 15 Ott)
        // Obbligo Estive: 15 Apr - 15 Nov (Tolleranza dal 15 Mar)
        
        var inInvernali = false;
        if ((mese === 11 && giorno >= 15) || mese > 11 || mese < 4 || (mese === 4 && giorno <= 15)) {
            inInvernali = true;
        }
        
        box.style.display = "flex";
        
        var isWarning = false;
        var nextDeadLine = "";
        var deadType = "";
        
        if ((mese === 10 && giorno >= 15) || (mese === 11 && giorno < 15)) {
            isWarning = true; nextDeadLine = "15 Novembre"; deadType = "INVERNALI";
        } else if ((mese === 3 && giorno >= 15) || (mese === 4 && giorno < 15)) {
            isWarning = true; nextDeadLine = "15 Aprile"; deadType = "ESTIVE";
        }
        
        if (isWarning) {
            box.style.background = "rgba(249, 115, 22, 0.08)";
            box.style.borderColor = "#f97316";
            box.style.boxShadow = "0 0 15px rgba(249, 115, 22, 0.2)";
            if (icon) {
                icon.style.color = "#f97316";
                icon.innerHTML = '<i class="fa fa-wrench" style="animation: pulse 1.5s infinite;"></i>';
            }
            lbl.innerHTML = "<b>⚠️ ATTENZIONE: PREAVVISO CAMBIO STAGIONALE!</b> Finestra di tolleranza attiva. Monta pneumatici <b>" + deadType + "</b> entro il <b>" + nextDeadLine + "</b> per rispettare il Codice della Strada!";
        } else {
            if (inInvernali) {
                box.style.background = "rgba(59, 130, 246, 0.06)";
                box.style.borderColor = "#3b82f6";
                box.style.boxShadow = "0 5px 15px rgba(59, 130, 246, 0.1)";
                if (icon) {
                    icon.style.color = "#60a5fa";
                    icon.innerHTML = '<i class="fa fa-snowflake-o"></i>';
                }
                lbl.innerHTML = "<b>❄️ REGIME INVERNALE ATTIVO:</b> Obbligo pneumatici da neve o catene a bordo (15 Nov - 15 Apr). Viaggia sicuro!";
            } else {
                box.style.background = "rgba(234, 179, 8, 0.05)";
                box.style.borderColor = "#eab308";
                box.style.boxShadow = "0 5px 15px rgba(234, 179, 8, 0.1)";
                if (icon) {
                    icon.style.color = "#facc15";
                    icon.innerHTML = '<i class="fa fa-sun-o"></i>';
                }
                lbl.innerHTML = "<b>☀️ REGIME ESTIVO ATTIVO:</b> Circolazione con dotazioni estive regolare (15 Apr - 15 Nov). Controlla le pressioni!";
            }
        }
    } catch(e) { console.log("MeteoGomme Error: " + e.message); }
}

// C. SCANNER HUD X-RAY RADAR VEICOLO
function AggiornaXrayRadar(v) {
    var lblCar = document.getElementById("lblXraySelectedVehicle");
    var tooltip = document.getElementById("panelXrayTooltip");
    if (!v) {
        if(lblCar) lblCar.innerText = "Nessun veicolo selezionato";
        return;
    }
    
    if (lblCar) lblCar.innerText = (v.Modello || "VEICOLO").toUpperCase() + " (" + (v.Targa || "").toUpperCase() + ")";
    
    var oggi = new Date();
    oggi.setHours(0,0,0,0);
    
    // Aiutante diagnostica
    function valutaStato(dataStr, alertGiorni) {
        if (!dataStr) return { label: "Non censito", css: "" };
        var scad = new Date(dataStr);
        scad.setHours(0,0,0,0);
        var diffMs = scad.getTime() - oggi.getTime();
        var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { label: "SCADUTO da " + Math.abs(diffDays) + " gg! (" + dbToItDate(dataStr) + ")", css: "danger" };
        if (diffDays <= alertGiorni) return { label: "In scadenza tra " + diffDays + " gg (" + dbToItDate(dataStr) + ")", css: "warning" };
        return { label: "Regolare fino al " + dbToItDate(dataStr) + " (" + diffDays + " gg)", css: "" };
    }
    
    var statoAssic = valutaStato(v.ScadenzaAssicurazione, 30);
    var statoRev = valutaStato(v.ScadenzaRevisione, 30);
    var statoBollo = valutaStato(v.ScadenzaBollo, 30);
    
    // Per le gomme simuliamo uno stato in base all'IA se presente un avviso, o consideriamo sempre Ok se non scaduti gli altri
    var statoGomme = { label: "Pneumatici Ok. Monitoraggio sensori attivo.", css: "" };
    if (v.PrevisioneTagliando && v.PrevisioneTagliando.toLowerCase().indexOf("imminente") !== -1) {
        statoGomme = { label: "Avviso Autopilota: Manutenzione pneumatici consigliata!", css: "warning" };
    }
    
    // Assegna classi e titoli ai Dot
    var dots = {
        "dotAssicurazione": { obj: document.getElementById("dotAssicurazione"), info: statoAssic, pre: "🛡️ ASSICURAZIONE: " },
        "dotTagliando": { obj: document.getElementById("dotTagliando"), info: statoRev, pre: "🔍 REVISIONE AUTO: " },
        "dotBollo": { obj: document.getElementById("dotBollo"), info: statoBollo, pre: "🎫 BOLLO VEICOLO: " },
        "dotGomme": { obj: document.getElementById("dotGomme"), info: statoGomme, pre: "🚗 PNEUMATICI: " }
    };
    
    for (var dotId in dots) {
        var d = dots[dotId];
        if (d.obj) {
            d.obj.className = "xray-dot " + d.info.css;
            d.obj.title = d.pre + d.info.label + " [CLICCA PER REGISTRARE]";
            
            // Animazione Radar Neon Dinamica
            if (!document.getElementById("stylePulseXray")) {
                var s = document.createElement("style");
                s.id = "stylePulseXray";
                s.innerHTML = "@keyframes pulseXray { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.3); opacity: 1; } }";
                document.head.appendChild(s);
            }
            if (d.info.css === "danger") {
                d.obj.style.animation = "pulseXray 0.5s infinite alternate";
                d.obj.style.boxShadow = "0 0 20px #ef4444";
            } else if (d.info.css === "warning") {
                d.obj.style.animation = "pulseXray 1.5s infinite alternate";
                d.obj.style.boxShadow = "0 0 15px #f59e0b";
            } else {
                d.obj.style.animation = "none";
                d.obj.style.boxShadow = "0 0 8px rgba(16,185,129,0.5)";
            }
            
            d.obj.setAttribute("data-id", dotId);
            d.obj.setAttribute("data-msg", d.pre + "<b>" + d.info.label + "</b><br><i style='color:#38bdf8; font-size:9.5px;'>⚡ Clicca per precompilare la spesa!</i>");
            
            d.obj.onmouseover = function() {
                if(tooltip) {
                    tooltip.innerHTML = this.getAttribute("data-msg");
                    tooltip.style.color = "#ffffff";
                    if (this.className.indexOf("danger") !== -1) { tooltip.style.borderColor = "#ef4444"; tooltip.style.background = "rgba(220,38,38,0.15)"; }
                    else if (this.className.indexOf("warning") !== -1) { tooltip.style.borderColor = "#f59e0b"; tooltip.style.background = "rgba(217,119,6,0.15)"; }
                    else { tooltip.style.borderColor = "#10b981"; tooltip.style.background = "rgba(16,185,129,0.1)"; }
                }
            };
            d.obj.onmouseout = function() {
                if(tooltip) {
                    tooltip.innerHTML = "Passa il mouse sui radar neon per visualizzare le diagnosi";
                    tooltip.style.color = "#94a3b8";
                    tooltip.style.borderColor = "#475569";
                    tooltip.style.background = "rgba(15, 23, 42, 0.7)";
                }
            };
            
            d.obj.onclick = function() {
                var did = this.getAttribute("data-id");
                var testoSpesa = "";
                
                if (did === "dotGomme") testoSpesa = "ACQUISTO / CAMBIO PNEUMATICI STAGIONALI";
                else if (did === "dotAssicurazione") testoSpesa = "PAGAMENTO PREMIO ASSICURAZIONE AUTO";
                else if (did === "dotTagliando") testoSpesa = "ESECUZIONE REVISIONE / TAGLIANDO AUTO";
                else if (did === "dotBollo") testoSpesa = "PAGAMENTO BOLLO ANNUALE VEICOLO";
                
                if (typeof SwitchSubTab === "function" && testoSpesa !== "") {
                    SwitchSubTab('spese');
                    
                    if (typeof NuovoRecord === "function") NuovoRecord();
                    
                    var inputDesc = document.getElementById("txtDescrizioneSpesa");
                    var selectTipo = document.getElementById("cmbTipoIntervento");
                    var inputCosto = document.getElementById("txtCostoSpesa");
                    var inputData = document.getElementById("txtDataSpesa");
                    
                    if(inputDesc) { inputDesc.value = testoSpesa; }
                    if(selectTipo) selectTipo.value = "ORDINARIA";
                    
                    if(inputData) {
                        var t = new Date();
                        var dd = ("0" + t.getDate()).slice(-2);
                        var mm = ("0" + (t.getMonth()+1)).slice(-2);
                        inputData.value = dd + "/" + mm + "/" + t.getFullYear();
                    }
                    
                    if(inputCosto) {
                        inputCosto.placeholder = "Scrivi qui il costo...";
                        setTimeout(function(){ inputCosto.focus(); }, 150);
                    }
                }
            };
        }
    }
}

// --- FINE AGGIORNAMENTI FASE 3 "SCI-FI HORIZON" ---

// D. SISTEMA NOTIFICHE HUD FLOTTANTI PREMIUM (TOASTS)
function ShowSystemToast(title, message, type) {
    var toast = document.getElementById("customSystemToast");
    var icon = document.getElementById("toastIcon");
    var tTitle = document.getElementById("toastTitle");
    var tMsg = document.getElementById("toastMessage");
    
    if(!toast) return;
    
    if (type === "error") {
        toast.style.borderColor = "#ef4444";
        if(icon) { icon.innerHTML = '<i class="fa fa-times-circle"></i>'; icon.style.color = "#ef4444"; icon.style.filter = "drop-shadow(0 0 8px rgba(239,68,68,0.4))"; }
    } else if (type === "warning") {
        toast.style.borderColor = "#f59e0b";
        if(icon) { icon.innerHTML = '<i class="fa fa-exclamation-triangle"></i>'; icon.style.color = "#f59e0b"; icon.style.filter = "drop-shadow(0 0 8px rgba(245,158,11,0.4))"; }
    } else {
        // Success
        toast.style.borderColor = "#10b981";
        if(icon) { icon.innerHTML = '<i class="fa fa-check-circle"></i>'; icon.style.color = "#10b981"; icon.style.filter = "drop-shadow(0 0 8px rgba(16,185,129,0.4))"; }
    }
    
    if(tTitle) tTitle.innerText = title.toUpperCase();
    if(tMsg) tMsg.innerText = message;
    
    // Slide in
    toast.style.right = "25px";
    
    // Auto hide after 3 seconds
    setTimeout(function() {
        toast.style.right = "-360px";
    }, 3000);
}

// ============================================================
// E. DRIVER OLOGRAFICO 3D INTERATTIVO "VIRTUAL ORBIT HUD" (2026)
// ============================================================
function Update3DCarRotation(val) {
    var car = document.getElementById("innerHologramCar");
    var lbl = document.getElementById("lbl3DAngle");
    if (car) {
        // Mantiene il tilt prospettico di 55 gradi e ruota solo l'asse Z!
        car.style.transform = "rotateX(55deg) rotateZ(" + val + "deg)";
    }
    if (lbl) {
        lbl.innerText = val + "°";
    }
}

function ToggleAutoOrbit() {
    var car = document.getElementById("innerHologramCar");
    var btn = document.getElementById("btnAutoOrbit");
    var icon = document.getElementById("iconAutoOrbit");
    var slider = document.getElementById("slider3D");
    var lbl = document.getElementById("lbl3DAngle");
    
    if (!car || !btn || !icon || !slider || !lbl) return;
    
    if (car.className.indexOf("orbiting-active") !== -1) {
        // 1. DISATTIVA AUTO-ORBIT -> PASSA A MANUALE
        car.className = car.className.replace("orbiting-active", "").trim();
        
        btn.style.background = "rgba(15, 23, 42, 0.8)";
        btn.style.borderColor = "#475569";
        btn.style.boxShadow = "none";
        btn.querySelector("span").innerText = "MANUAL";
        icon.className = "fa fa-play";
        
        slider.disabled = false;
        slider.style.opacity = "1";
        slider.style.cursor = "pointer";
        
        // Ripristina l'angolo dallo slider corrente
        var val = slider.value;
        car.style.transform = "rotateX(55deg) rotateZ(" + val + "deg)";
        lbl.innerText = val + "°";
    } else {
        // 2. ATTIVA AUTO-ORBIT
        car.className += " orbiting-active";
        
        btn.style.background = "#1e3a8a";
        btn.style.borderColor = "#3b82f6";
        btn.style.boxShadow = "0 0 10px rgba(59,130,246,0.3)";
        btn.querySelector("span").innerText = "AUTO";
        icon.className = "fa fa-pause";
        
        slider.disabled = true;
        slider.style.opacity = "0.4";
        slider.style.cursor = "not-allowed";
        lbl.innerText = "AUTO";
    }
}

// F. CALIBRAZIONE PUNTO ZERO (AUTO)
function CalibraInizioAnno() {
    var anno = document.getElementById("fltAnnoRimborsi") ? document.getElementById("fltAnnoRimborsi").value : new Date().getFullYear();
    var defaultDate = anno + "-01-01T08:00:00.000Z";
    
    var kmPrompt = prompt("Imposta il Punto Zero: Quanti Km esatti segnava il tuo cruscotto all'inizio dell'anno (es. 1 Gennaio " + anno + ")?\n\nIl sistema creerà un record tecnico invisibile per calcolare correttamente i Km privati.", "");
    
    if (kmPrompt !== null && kmPrompt.trim() !== "") {
        var km = parseFloat(kmPrompt.replace(".", "").replace(",", "."));
        if (!isNaN(km) && km > 0) {
            try {
                var sql = "INSERT INTO tblRifornimenti (DataRifornimento, KmAttuali, PrezzoAlLitro, Litri, TotaleEuro, TipoCarburante, Note, IDVeicolo) VALUES (" +
                          "'" + defaultDate + "', " +
                          "'" + km + "', " +
                          "'0', '0', '0', 'ZeroPoint', " +
                          "'CALIBRAZIONE PUNTO ZERO " + anno + "', " +
                          "1)";
                queryAccessDB(sql);
                alert("Punto Zero calibrato correttamente a " + km + " Km!\nI grafici ora calcoleranno i chilometri privati in modo preciso.");
                if (typeof CalcolaRimborsiMensili === "function") {
                    CalcolaRimborsiMensili();
                }
            } catch (e) {
                alert("Errore durante la calibrazione: " + e.message);
            }
        } else {
            alert("Valore Km non valido. Inserisci solo numeri.");
        }
    }
}




















// --- BUDGET MENSILE CARBURANTE MODIFICABILE (salvato su DB: tblConfigAuto) ---
function CaricaConfigBudget() {
    var cfg = {};
    try {
        var rows = queryAccessDB("SELECT Chiave, Valore FROM tblConfigAuto WHERE Chiave LIKE 'BudgetCarburante%'") || [];
        for (var i = 0; i < rows.length; i++) cfg[rows[i].Chiave] = parseFloat(rows[i].Valore);
    } catch(e) {}
    return cfg;
}
function GetBudgetMensile(meseStr) {
    if (!meseStr) {
        var mm = new Date().getMonth() + 1;
        meseStr = mm < 10 ? "0" + mm : "" + mm;
    }
    var cfg = CaricaConfigBudget();
    var v = cfg["BudgetCarburante_" + meseStr];
    if (isNaN(v) || !v || v <= 0) v = cfg["BudgetCarburante"];
    if (isNaN(v) || !v || v <= 0) v = 150;
    return v;
}
function SalvaBudgetConfig(chiave, valore) {
    queryAccessDB("DELETE FROM tblConfigAuto WHERE Chiave = '" + chiave + "'", true);
    return queryAccessDB("INSERT INTO tblConfigAuto (Chiave, Valore) VALUES ('" + chiave + "', '" + valore + "')", true);
}
function ImpostaBudgetMensile() {
    var span = document.getElementById("lblBudgetMax");
    if (!span || span.getAttribute("data-editing") == "1") return;
    span.setAttribute("data-editing", "1");
    span.onclick = null;
    var mm = new Date().getMonth() + 1;
    var mStr = mm < 10 ? "0" + mm : "" + mm;
    var valore = GetBudgetMensile(mStr);
    var btnStyle = "cursor:pointer; font-weight:800; margin-left:6px; padding:1px 6px; border-radius:4px; font-size:10px;";
    span.style.borderBottom = "none";
    span.innerHTML = "/ <input type='text' id='txtBudgetMax' value='" + valore + "' style='width:60px; background:#0f172a; color:#f8fafc; border:1px solid #0ea5e9; border-radius:4px; padding:1px 4px; font-size:12px; text-align:right;'> &euro;" +
        "<span id='btnBudgetMese' title='Vale solo per il mese in corso' style='" + btnStyle + " background:#10b981; color:#0f172a;'>&#10003; solo questo mese</span>" +
        "<span id='btnBudgetTutti' title='Vale per tutti i mesi' style='" + btnStyle + " background:#0ea5e9; color:#0f172a;'>&#10003; tutti i mesi</span>";
    var inp = document.getElementById("txtBudgetMax");
    var fine = function() {
        span.setAttribute("data-editing", "0");
        span.style.borderBottom = "1px dashed #64748b";
        span.onclick = ImpostaBudgetMensile;
        CaricaRifornimenti();
    };
    var salva = function(tutti) {
        var n = parseFloat(String(inp.value).replace(",", "."));
        if (isNaN(n) || n <= 0) { alert("Inserisci un importo valido (es. 200)."); return; }
        var ok = false;
        try {
            if (tutti) {
                queryAccessDB("DELETE FROM tblConfigAuto WHERE Chiave LIKE 'BudgetCarburante_%'", true);
                ok = SalvaBudgetConfig("BudgetCarburante", n);
            } else {
                ok = SalvaBudgetConfig("BudgetCarburante_" + mStr, n);
            }
        } catch(e) {}
        var letto = GetBudgetMensile(mStr);
        if (!ok || letto != n) {
            alert("Salvataggio non riuscito (server dati: " + (ok ? "ok" : "errore") + ", valore letto: " + letto + "). Controlla che il server locale sia avviato.");
        }
        fine();
    };
    inp.onkeydown = function(e) {
        e = e || window.event;
        if (e.keyCode == 13) salva(false);
        if (e.keyCode == 27) fine();
    };
    document.getElementById("btnBudgetMese").onclick = function() { salva(false); };
    document.getElementById("btnBudgetTutti").onclick = function() { salva(true); };
    inp.focus();
    inp.select();
}

// --- EXTRA CARBURANTE: costo al km, confronto mese scorso, scadenze imminenti ---
function FmtEuroExtra(n) {
    return n.toFixed(2).replace(".", ",") + " &euro;";
}
function AggiornaExtraCarburante(arr) {
    var box = document.getElementById("pnlExtraCarburante");
    if (!box) return;
    arr = arr || [];
    var oggi = new Date();
    var anno = oggi.getFullYear();
    var mese = oggi.getMonth() + 1;
    var giorno = oggi.getDate();
    var mStr = mese < 10 ? "0" + mese : "" + mese;
    var pm = mese == 1 ? 12 : mese - 1;
    var pmStr = pm < 10 ? "0" + pm : "" + pm;
    var pmAnno = mese == 1 ? anno - 1 : anno;

    var spesaCorr = 0, spesaPrecStessoPeriodo = 0, spesaPrecTot = 0, costoAnno = 0;
    var kmMin = 0, kmMax = 0, costoAlKmMin = 0, kmInit = false;
    for (var i = 0; i < arr.length; i++) {
        var d = arr[i].DataRifornimento || "";
        var c = parseFloat(arr[i].CostoTotale) || 0;
        var y = parseInt(d.substring(0, 4), 10);
        var m = d.substring(5, 7);
        var g = parseInt(d.substring(8, 10), 10) || 0;
        if (y == anno) {
            costoAnno += c;
            var km = parseInt(arr[i].KmAttuali, 10);
            if (!isNaN(km) && km > 0) {
                if (!kmInit || km < kmMin) { kmMin = km; costoAlKmMin = c; }
                if (!kmInit || km > kmMax) { kmMax = km; }
                kmInit = true;
            }
            if (m == mStr) spesaCorr += c;
        }
        if (y == pmAnno && m == pmStr) {
            spesaPrecTot += c;
            if (g <= giorno) spesaPrecStessoPeriodo += c;
        }
    }

    // --- Costo al km ---
    var spanKm = kmMax - kmMin;
    var cardKm;
    if (kmInit && spanKm > 50) {
        var carbAlKm = (costoAnno - costoAlKmMin) / spanKm;
        var speseAnno = 0;
        try {
            var rs = queryAccessDB("SELECT Costo, DataIntervento FROM tblSpeseVeicolo") || [];
            for (var s = 0; s < rs.length; s++) {
                if (parseInt((rs[s].DataIntervento || "").substring(0, 4), 10) == anno) speseAnno += parseFloat(rs[s].Costo) || 0;
            }
        } catch(e1) {}
        var totAlKm = (costoAnno - costoAlKmMin + speseAnno) / spanKm;
        cardKm = "<div style='font-size:20px; font-weight:800; color:#f8fafc;'>" + carbAlKm.toFixed(3).replace(".", ",") + " &euro;/km</div>" +
                 "<div style='font-size:10px; color:#94a3b8; margin-top:4px;'>Solo carburante (" + spanKm + " km nell'anno)</div>" +
                 "<div style='font-size:11px; color:#fbbf24; margin-top:4px; font-weight:700;'>Con manutenzione: " + totAlKm.toFixed(3).replace(".", ",") + " &euro;/km</div>";
    } else {
        cardKm = "<div style='font-size:12px; color:#94a3b8; font-style:italic;'>Servono almeno 2 pieni con i km inseriti.</div>";
    }

    // --- Confronto con il mese scorso (stesso periodo) ---
    var cardCmp;
    if (spesaPrecStessoPeriodo > 0) {
        var diff = spesaCorr - spesaPrecStessoPeriodo;
        var pct = (diff / spesaPrecStessoPeriodo) * 100;
        var su = diff > 0;
        var col = su ? "#ef4444" : "#10b981";
        var frec = su ? "&#9650;" : "&#9660;";
        cardCmp = "<div style='font-size:20px; font-weight:800; color:" + col + ";'>" + frec + " " + (su ? "+" : "-") + FmtEuroExtra(Math.abs(diff)) + " <span style='font-size:12px; opacity:0.85;'>(" + (su ? "+" : "-") + Math.abs(pct).toFixed(1).replace(".", ",") + "%)</span></div>" +
                  "<div style='font-size:10px; color:#94a3b8; margin-top:4px;'>Fino al giorno " + giorno + ": ora " + FmtEuroExtra(spesaCorr) + " contro " + FmtEuroExtra(spesaPrecStessoPeriodo) + " del mese scorso</div>" +
                  "<div style='font-size:10px; color:#64748b; margin-top:2px;'>Mese scorso intero: " + FmtEuroExtra(spesaPrecTot) + "</div>";
    } else if (spesaPrecTot > 0) {
        cardCmp = "<div style='font-size:20px; font-weight:800; color:#f8fafc;'>" + FmtEuroExtra(spesaCorr) + "</div>" +
                  "<div style='font-size:10px; color:#94a3b8; margin-top:4px;'>Mese scorso intero: " + FmtEuroExtra(spesaPrecTot) + " (nessun pieno nello stesso periodo)</div>";
    } else {
        cardCmp = "<div style='font-size:12px; color:#94a3b8; font-style:italic;'>Nessun dato del mese scorso da confrontare.</div>";
    }

    // --- Scadenze imminenti (entro 60 giorni) ---
    var scad = [];
    try {
        var veh = queryAccessDB("SELECT * FROM tblVeicoli") || [];
        var oggi0 = new Date(anno, oggi.getMonth(), giorno);
        var campi = [["ScadenzaAssicurazione", "Assicurazione"], ["ScadenzaRevisione", "Revisione"], ["ScadenzaBollo", "Bollo"]];
        for (var v = 0; v < veh.length; v++) {
            for (var f = 0; f < campi.length; f++) {
                var ds = veh[v][campi[f][0]];
                if (!ds) continue;
                var p = String(ds).split("-");
                if (p.length < 3) continue;
                var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                var gg = Math.round((dt.getTime() - oggi0.getTime()) / 86400000);
                if (gg <= 60) scad.push({ giorni: gg, tipo: campi[f][1], mezzo: (veh[v].Targa || veh[v].Modello || "Veicolo") });
            }
        }
        scad.sort(function(a, b) { return a.giorni - b.giorni; });
    } catch(e2) {}
    var cardScad = "";
    if (scad.length === 0) {
        cardScad = "<div style='font-size:12px; color:#10b981; font-weight:700;'>&#10003; Nessuna scadenza nei prossimi 60 giorni</div>";
    } else {
        for (var k = 0; k < scad.length && k < 5; k++) {
            var sc = scad[k];
            var colS = sc.giorni < 0 ? "#ef4444" : (sc.giorni <= 15 ? "#f59e0b" : "#0ea5e9");
            var txtS = sc.giorni < 0 ? "scaduta da " + Math.abs(sc.giorni) + " gg" : (sc.giorni == 0 ? "scade OGGI" : "tra " + sc.giorni + " gg");
            cardScad += "<div style='font-size:12px; margin-bottom:3px; color:#e2e8f0;'><span style='display:inline-block; width:8px; height:8px; border-radius:50%; background:" + colS + "; margin-right:6px;'></span><b>" + sc.tipo + "</b> " + sc.mezzo + " <span style='color:" + colS + "; font-weight:700;'>" + txtS + "</span></div>";
        }
    }

    var cardStyle = "flex:1; min-width:230px; background:rgba(30, 41, 59, 0.5); border:1.5px solid #334155; border-radius:12px; padding:14px 18px; box-shadow:0 4px 12px rgba(0,0,0,0.1);";
    var titStyle = "font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:8px;";
    box.innerHTML =
        "<div style='display:flex; gap:15px; flex-wrap:wrap;'>" +
        "<div style='" + cardStyle + "'><div style='" + titStyle + "'><i class='fa fa-road' style='color:#0ea5e9; margin-right:5px;'></i> Costo al chilometro</div>" + cardKm + "</div>" +
        "<div style='" + cardStyle + "'><div style='" + titStyle + "'><i class='fa fa-exchange' style='color:#a855f7; margin-right:5px;'></i> Vs mese scorso</div>" + cardCmp + "</div>" +
        "<div style='" + cardStyle + "'><div style='" + titStyle + "'><i class='fa fa-calendar' style='color:#f59e0b; margin-right:5px;'></i> Scadenze imminenti</div>" + cardScad + "</div>" +
        "</div>";
}

// =====================================================================
// CONSULENTE AUTO: maschera con dati, semafori e consigli in tempo reale
// =====================================================================
var CS_CAMPI = [
    ["cs_rip", "Riparazioni previste / anno", "&euro;", "calc"],
    ["cs_guasto", "Guasto singolo pi&ugrave; grave", "&euro;", "calc"],
    ["cs_altre", "Altre spese (lavaggi, gomme...) / anno", "&euro;", "calc"],
    ["cs_consumo", "Consumo reale", "km/l", "calc"],
    ["cs_prezzo", "Prezzo carburante", "&euro;/L", "calc"],
    ["cs_km", "Km attuali", "km", "calc"],
    ["cs_kmannui", "Km percorsi / anno", "km", "calc"],
    ["cs_ass", "Assicurazione / anno", "&euro;", "user"],
    ["cs_bollo", "Bollo / anno", "&euro;", "user"],
    ["cs_rata", "Auto alternativa (Rata VERA incl. anticipo/maxirata)", "&euro;/mese", "user"],
    ["cs_valore", "Valore attuale auto", "&euro;", "user"],
    ["cs_anno", "Anno immatricolazione", "anno", "user"],
    ["cs_ass_prev", "Assicurazione (anno prec.)", "&euro;", "user"]
];
var CS_SOGLIE = [
    ["cs_t_ripG", "Riparazioni/anno: attenzione da", "&euro;", 1500],
    ["cs_t_ripR", "Riparazioni/anno: critico da", "&euro;", 2000],
    ["cs_t_gstG", "Guasto singolo: attenzione da", "&euro;", 1500],
    ["cs_t_gstR", "Guasto singolo: critico da", "&euro;", 2500],
    ["cs_t_conG", "Consumo: ottimo da", "km/l", 15],
    ["cs_t_conR", "Consumo: critico sotto", "km/l", 14],
    ["cs_t_kmG", "Chilometraggio: attenzione da", "km", 200000],
    ["cs_t_kmR", "Chilometraggio: critico da", "km", 250000]
];

function CsFmt0(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) == "-";
    if (neg) s = s.substring(1);
    var out = "";
    while (s.length > 3) { out = "." + s.substring(s.length - 3) + out; s = s.substring(0, s.length - 3); }
    return (neg ? "-" : "") + s + out;
}
function CsNum(id, def) {
    var el = document.getElementById(id);
    if (!el) return def;
    var n = parseFloat(String(el.value).replace(",", "."));
    return isNaN(n) ? def : n;
}
function CsLeggiSalvati() {
    var cfg = {};
    try {
        var rows = queryAccessDB("SELECT Chiave, Valore FROM tblConfigAuto WHERE Chiave LIKE 'Consulente_%'") || [];
        for (var i = 0; i < rows.length; i++) cfg[rows[i].Chiave] = rows[i].Valore;
    } catch(e) {}
    return cfg;
}
function CsCalcolaDati(periodo) {
    var d = { rip: 0, guasto: 0, altre: 0, consumo: 17.7, prezzo: 1.8, km: 0, kmannui: 15000 };
    var oggi = new Date();
    var anno = oggi.getFullYear();
    var giornoAnno = Math.floor((oggi.getTime() - new Date(anno, 0, 1).getTime()) / 86400000) + 1;
    var fattore = 365 / Math.max(giornoAnno, 90);

    // Spese veicolo nel periodo scelto
    periodo = periodo || "anno";
    if (periodo == String(anno)) periodo = "anno";
    try {
        var sp = queryAccessDB("SELECT DataIntervento, Descrizione, Costo FROM tblSpeseVeicolo") || [];
        var rip = 0, altre = 0, maxG = 0, minData = null;
        var reOrd = /lavagg|igieniz|ruote|gomm|pneumat|tagliand|olio|filtr/i;
        var limite12 = new Date(anno - 1, oggi.getMonth(), oggi.getDate());
        for (var i = 0; i < sp.length; i++) {
            var ds0 = String(sp[i].DataIntervento || "").substring(0, 10).split("-");
            if (ds0.length < 3) continue;
            var ay = parseInt(ds0[0], 10);
            var dtI = new Date(ay, parseInt(ds0[1], 10) - 1, parseInt(ds0[2], 10));
            if (periodo == "anno" && ay != anno) continue;
            if (periodo == "12m" && dtI < limite12) continue;
            if (/^\d{4}$/.test(periodo) && ay != parseInt(periodo, 10)) continue;
            if (!minData || dtI < minData) minData = dtI;
            var c = parseFloat(sp[i].Costo) || 0;
            if (reOrd.test(String(sp[i].Descrizione || ""))) { altre += c; }
            else { rip += c; if (c > maxG) maxG = c; }
        }
        var fat = 1;
        if (periodo == "anno") fat = fattore;
        else if (periodo == "tutto" && minData) {
            var anniSpan = (oggi.getTime() - minData.getTime()) / (365 * 86400000);
            fat = 1 / Math.max(anniSpan, 1);
        }
        d.rip = rip * fat;
        d.altre = altre * fat;
        d.guasto = maxG;
    } catch(e1) {}

    // Rifornimenti: consumo, prezzo, km
    try {
        var rf = queryAccessDB("SELECT DataRifornimento, PrezzoAlLitro, Litri, CostoTotale, KmAttuali FROM tblRifornimenti ORDER BY DataRifornimento") || [];
        var conKm = [];
        var ultimoPrezzo = 0;
        var kmMax = 0;
        var primoAnno = null;
        for (var j = 0; j < rf.length; j++) {
            var pz = parseFloat(rf[j].PrezzoAlLitro) || 0;
            if (pz > 0) ultimoPrezzo = pz;
            var km = parseInt(rf[j].KmAttuali, 10);
            if (!isNaN(km) && km > 0) {
                if (km > kmMax) kmMax = km;
                conKm.push({ km: km, l: parseFloat(rf[j].Litri) || 0 });
                if (!primoAnno && parseInt(String(rf[j].DataRifornimento || "").substring(0, 4), 10) == anno) {
                    var ds = String(rf[j].DataRifornimento).substring(0, 10).split("-");
                    primoAnno = { km: km, data: new Date(parseInt(ds[0], 10), parseInt(ds[1], 10) - 1, parseInt(ds[2], 10)) };
                }
            }
        }
        conKm.sort(function(a, b) { return a.km - b.km; });
        var totKm = 0, totL = 0;
        for (var k = 1; k < conKm.length; k++) {
            var dk = conKm[k].km - conKm[k - 1].km;
            if (dk > 0 && conKm[k].l > 0) {
                var kml = dk / conKm[k].l;
                if (kml >= 8 && kml <= 30) { totKm += dk; totL += conKm[k].l; }
            }
        }
        if (totL > 0) d.consumo = totKm / totL;
        if (ultimoPrezzo > 0) d.prezzo = ultimoPrezzo;
        d.km = kmMax;
        if (primoAnno) {
            var gg = (oggi.getTime() - primoAnno.data.getTime()) / 86400000;
            if (gg >= 30 && kmMax > primoAnno.km) d.kmannui = (kmMax - primoAnno.km) / gg * 365;
        }
    } catch(e2) {}

    // Km dalla scheda veicolo
    try {
        var vh = queryAccessDB("SELECT KmAttuali FROM tblVeicoli") || [];
        for (var v = 0; v < vh.length; v++) {
            var kv = parseInt(vh[v].KmAttuali, 10);
            if (!isNaN(kv) && kv > d.km) d.km = kv;
        }
    } catch(e3) {}
    return d;
}
function CsCreaRigaInput(c, valore) {
    return "<div style='display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;'>" +
        "<label for='" + c[0] + "' style='font-size:11px; color:#cbd5e1; flex:1;'>" + c[1] + (c[3] == "calc" ? " <span style='color:#0ea5e9; font-size:9px;'>(dai tuoi dati)</span>" : "") + "</label>" +
        "<input type='text' id='" + c[0] + "' value='" + valore + "' style='width:130px; background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:6px; padding:4px 6px; font-size:12px; text-align:right;'>" +
        "<span style='font-size:10px; color:#64748b; width:48px;'>" + c[2] + "</span></div>";
}
function ApriConsulenteAuto() {
    if (document.getElementById("consulenteAutoOverlay")) return;
    var dati = CsCalcolaDati();
    var salv = CsLeggiSalvati();
    CS_SCAD = CsLeggiScadenze();
    var valori = {
        cs_rip: Math.round(dati.rip), cs_guasto: Math.round(dati.guasto), cs_altre: Math.round(dati.altre),
        cs_consumo: dati.consumo.toFixed(1), cs_prezzo: dati.prezzo.toFixed(3), cs_km: Math.round(dati.km),
        cs_kmannui: Math.round(dati.kmannui)
    };
    var i;
    for (i = 0; i < CS_CAMPI.length; i++) {
        if (CS_CAMPI[i][3] == "user") {
            var sv = salv["Consulente_" + CS_CAMPI[i][0]];
            valori[CS_CAMPI[i][0]] = (sv !== undefined && sv !== null && sv !== "") ? sv : 0;
        }
    }
    var htmlCampi = "";
    for (i = 0; i < CS_CAMPI.length; i++) htmlCampi += CsCreaRigaInput(CS_CAMPI[i], valori[CS_CAMPI[i][0]]);
    var htmlPeriodo = "<div style='display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; padding:8px 10px; background:rgba(14,165,233,0.08); border:1px solid #1e3a5f; border-radius:8px;'>" +
        "<label for='cs_periodo' style='font-size:11px; color:#cbd5e1;'>Spese analizzate</label>" +
        "<select id='cs_periodo' style='background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:6px; padding:4px 6px; font-size:11px;'>" +
        "<option value='anno'>Anno in corso (proiezione)</option><option value='12m'>Ultimi 12 mesi</option><option value='tutto'>Tutto lo storico (media annua)</option>";
    var anniS = CsAnniSpese();
    for (i = 0; i < anniS.length; i++) htmlPeriodo += "<option value='" + anniS[i] + "'>Solo anno " + anniS[i] + "</option>";
    htmlPeriodo += "</select></div>";
    var htmlSoglie = "";
    for (i = 0; i < CS_SOGLIE.length; i++) {
        var sg = salv["Consulente_" + CS_SOGLIE[i][0]];
        htmlSoglie += CsCreaRigaInput([CS_SOGLIE[i][0], CS_SOGLIE[i][1], CS_SOGLIE[i][2], "soglia"], (sg !== undefined && sg !== null && sg !== "") ? sg : CS_SOGLIE[i][3]);
    }

    var overlay = document.createElement("div");
    overlay.id = "consulenteAutoOverlay";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 17, 32, 0.85); z-index:99998; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(6px);";
    var box = document.createElement("div");
    box.style.cssText = "background:#0f172a; width:1060px; max-width:96%; max-height:92%; overflow-y:auto; padding:22px 26px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6); border:1px solid #334155; font-family:'Inter',sans-serif; color:#e2e8f0;";
    box.innerHTML =
        "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;'>" +
        "<h2 style='margin:0; color:#fff; font-size:20px; font-weight:800;'><i class='fa fa-stethoscope' style='color:#0ea5e9; margin-right:8px;'></i>Consulente Auto</h2>" +
        "<div><span id='cs_msg' style='font-size:11px; color:#10b981; margin-right:12px; font-weight:700;'></span>" +
        "<button id='cs_btnReset' style='background:#1e293b; color:#cbd5e1; border:1px solid #334155; padding:7px 12px; border-radius:8px; cursor:pointer; font-size:11px; margin-right:6px;'>Ricarica dai dati</button>" +
        "<button id='cs_btnSalva' style='background:#10b981; color:#0f172a; border:none; padding:7px 14px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:800; margin-right:6px;'>Salva dati</button>" +
        "<button id='cs_btnSmontaPrev' style='background:#f59e0b; color:#0f172a; border:none; padding:7px 14px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:800; margin-right:6px;'><i class='fa fa-balance-scale'></i> Simula Acquisto</button>" +
        "<button id='cs_btnChiudi' style='background:#334155; color:#fff; border:none; padding:7px 14px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:800;'>Chiudi</button></div></div>" +
        "<div id='cs_verdict' style='margin-bottom:14px;'></div>" +
        "<div id='cs_kpi' style='display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;'></div>" +
        "<div style='display:flex; gap:20px; flex-wrap:wrap;'>" +
        "<div style='width:360px; flex:0 0 360px;'>" +
        "<div style='font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:10px;'>I tuoi dati (modificali per simulare)</div>" + htmlPeriodo + htmlCampi +
        "<div id='cs_toggleSoglie' style='font-size:11px; color:#0ea5e9; cursor:pointer; margin:12px 0 8px; font-weight:700;'>&#9881; Soglie personalizzabili &#9662;</div>" +
        "<div id='cs_soglie' style='display:none;'>" + htmlSoglie + "</div></div>" +
        "<div style='flex:1; min-width:420px;'><div style='font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:10px;'>Situazione e consigli</div><div id='cs_res'></div></div></div>";
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var tutti = [];
    for (i = 0; i < CS_CAMPI.length; i++) tutti.push(CS_CAMPI[i][0]);
    for (i = 0; i < CS_SOGLIE.length; i++) tutti.push(CS_SOGLIE[i][0]);
    for (i = 0; i < tutti.length; i++) {
        var el = document.getElementById(tutti[i]);
        el.onkeyup = CsRicalcola;
        el.onchange = CsRicalcola;
    }
    document.getElementById("cs_periodo").onchange = CsAggiornaPeriodo;
    document.getElementById("cs_btnChiudi").onclick = CsChiudi;
    document.getElementById("cs_btnSalva").onclick = CsSalva;
    if (document.getElementById("cs_btnSmontaPrev")) document.getElementById("cs_btnSmontaPrev").onclick = ApriSmontaPreventivi;
    document.getElementById("cs_btnReset").onclick = function() { CsChiudi(); ApriConsulenteAuto(); };
    document.getElementById("cs_toggleSoglie").onclick = function() {
        var s = document.getElementById("cs_soglie");
        s.style.display = (s.style.display == "none") ? "block" : "none";
    };
    CsRicalcola();
}
function CsChiudi() {
    var o = document.getElementById("consulenteAutoOverlay");
    if (o) o.parentNode.removeChild(o);
}
function CsSalva() {
    var ok = true;
    var i, id, n;
    for (i = 0; i < CS_CAMPI.length; i++) {
        if (CS_CAMPI[i][3] != "user") continue;
        id = CS_CAMPI[i][0]; n = CsNum(id, 0);
        ok = SalvaChiaveConsulente(id, n) && ok;
    }
    for (i = 0; i < CS_SOGLIE.length; i++) {
        id = CS_SOGLIE[i][0]; n = CsNum(id, CS_SOGLIE[i][3]);
        ok = SalvaChiaveConsulente(id, n) && ok;
    }
    var m = document.getElementById("cs_msg");
    if (m) {
        m.style.color = ok ? "#10b981" : "#ef4444";
        m.innerHTML = ok ? "&#10003; Dati salvati" : "Salvataggio non riuscito";
        setTimeout(function() { var mm = document.getElementById("cs_msg"); if (mm) mm.innerHTML = ""; }, 2500);
    }
}
function SalvaChiaveConsulente(id, valore) {
    var chiave = "Consulente_" + id;
    queryAccessDB("DELETE FROM tblConfigAuto WHERE Chiave = '" + chiave + "'", true);
    return queryAccessDB("INSERT INTO tblConfigAuto (Chiave, Valore) VALUES ('" + chiave + "', '" + valore + "')", true);
}
function CsRiga(label, valTxt, lvl, consiglio) {
    var cols = ["#10b981", "#f59e0b", "#ef4444", "#64748b"];
    var c = cols[lvl];
    return "<div style='display:flex; gap:12px; align-items:flex-start; padding:10px 12px; margin-bottom:8px; background:rgba(30,41,59,0.5); border:1px solid #334155; border-left:4px solid " + c + "; border-radius:10px;'>" +
        "<span style='display:inline-block; width:12px; height:12px; border-radius:50%; background:" + c + "; margin-top:3px; flex:0 0 12px;'></span>" +
        "<div style='flex:1;'><div style='display:flex; justify-content:space-between; gap:10px;'><b style='font-size:12px; color:#f1f5f9;'>" + label + "</b><b style='font-size:12px; color:" + c + ";'>" + valTxt + "</b></div>" +
        "<div style='font-size:11px; color:#94a3b8; margin-top:3px; line-height:1.4;'>" + consiglio + "</div></div></div>";
}
function CsKpi(titolo, valore, colore) {
    return "<div style='flex:1; min-width:150px; background:rgba(30,41,59,0.5); border:1px solid #334155; border-radius:10px; padding:10px 14px;'>" +
        "<div style='font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:800; letter-spacing:0.5px;'>" + titolo + "</div>" +
        "<div style='font-size:18px; font-weight:800; color:" + (colore || "#f8fafc") + "; margin-top:2px;'>" + valore + "</div></div>";
}
function CsRicalcola() {
    var rip = CsNum("cs_rip", 0), guasto = CsNum("cs_guasto", 0), altre = CsNum("cs_altre", 0);
    var consumo = CsNum("cs_consumo", 0), prezzo = CsNum("cs_prezzo", 0), km = CsNum("cs_km", 0);
    var kmAnnui = CsNum("cs_kmannui", 0), ass = CsNum("cs_ass", 0), bollo = CsNum("cs_bollo", 0), rata = CsNum("cs_rata", 0);
    var valore = CsNum("cs_valore", 0), annoImm = CsNum("cs_anno", 0), assPrev = CsNum("cs_ass_prev", 0);
    var tRipG = CsNum("cs_t_ripG", 1500), tRipR = CsNum("cs_t_ripR", 2000);
    var tGstG = CsNum("cs_t_gstG", 1500), tGstR = CsNum("cs_t_gstR", 2500);
    var tConG = CsNum("cs_t_conG", 15), tConR = CsNum("cs_t_conR", 14);
    var tKmG = CsNum("cs_t_kmG", 200000), tKmR = CsNum("cs_t_kmR", 250000);

    var righe = [];
    var reds = [], yellows = [];
    var faultRed = false;
    function reg(label, val, lvl, cons, conta) {
        righe.push(CsRiga(label, val, lvl, cons));
        if (conta) { if (lvl == 2) reds.push(label); else if (lvl == 1) yellows.push(label); }
    }

    // 1. Riparazioni
    var l1 = rip >= tRipR ? 2 : (rip >= tRipG ? 1 : 0);
    reg("Riparazioni all'anno", CsFmt0(rip) + " &euro;", l1,
        l1 == 0 ? "Spese di guasto sotto controllo: tieni l'auto." :
        (l1 == 1 ? "Le riparazioni stanno salendo: tieni d'occhio i prossimi interventi e confronta i preventivi." :
        "Riparazioni troppo alte rispetto al valore dell'auto: valuta seriamente la sostituzione."), true);

    // 2. Guasto singolo
    var l2 = guasto >= tGstR ? 2 : (guasto >= tGstG ? 1 : 0);
    if (l2 == 2) faultRed = true;
    reg("Guasto singolo pi&ugrave; grave", CsFmt0(guasto) + " &euro;", l2,
        l2 == 0 ? "Nessun guasto fuori scala: gli interventi sono nella norma per l'et&agrave; dell'auto." :
        (l2 == 1 ? "Guasto importante: chiedi sempre un secondo preventivo prima di riparare." :
        "Costo vicino al valore di un'auto usata: spesso non conviene riparare."), true);

    // 3. Consumo
    var l3 = consumo >= tConG ? 0 : (consumo >= tConR ? 1 : 2);
    if (consumo <= 0) l3 = 3;
    reg("Consumo reale", consumo > 0 ? consumo.toFixed(1).replace(".", ",") + " km/l" : "--", l3,
        l3 == 0 ? "Consumo ottimo: il motore sta lavorando bene." :
        (l3 == 1 ? "Consumo in calo: controlla pressione gomme, filtro aria e candele." :
        (l3 == 2 ? "Consumo troppo alto: possibile usura o guasto, fai un controllo in officina." : "Inserisci il consumo.")), consumo > 0);

    // 4. Chilometraggio
    var l4, c4;
    var prossimo = Math.ceil((km + 1) / 50000) * 50000;
    var manca = prossimo - km;
    if (km >= tKmR) { l4 = 2; c4 = "Chilometraggio molto alto: aspettati riparazioni frequenti (frizione, sospensioni, distribuzione)."; }
    else if (km >= tKmG) { l4 = 1; c4 = "Oltre la soglia di attenzione: fai controllare frizione, sospensioni e distribuzione."; }
    else if (manca <= 5000) { l4 = 1; c4 = "Ti avvicini ai " + CsFmt0(prossimo) + " km (mancano " + CsFmt0(manca) + "): fai il tagliando completo e controlla cinghia o catena di distribuzione."; }
    else { l4 = 0; c4 = "Mancano " + CsFmt0(manca) + " km al prossimo controllo importante (" + CsFmt0(prossimo) + " km)."; }
    reg("Km attuali", CsFmt0(km) + " km", l4, c4, true);

    // 5. Km annui
    var l5 = kmAnnui > 25000 ? 1 : 0;
    var c5;
    if (kmAnnui <= 0) { c5 = "Inserisci i km percorsi in un anno."; l5 = 3; }
    else if (km >= 200000) { c5 = "Hai gi&agrave; superato i 200.000 km."; }
    else {
        var mesi = Math.round((200000 - km) / kmAnnui * 12);
        c5 = "Arriverai a 200.000 km tra circa " + (mesi >= 12 ? (Math.floor(mesi / 12) + " anni e " + (mesi % 12) + " mesi") : (mesi + " mesi")) + ".";
        if (l5 == 1) c5 += " Uso intensivo: l'auto si usura pi&ugrave; in fretta.";
    }
    reg("Km percorsi all'anno", CsFmt0(kmAnnui) + " km", l5, c5, false);

    // 6. Carburante
    var kmCarb = (consumo > 0 && prezzo > 0) ? prezzo / consumo : 0;
    var carbAnno = kmCarb * kmAnnui;
    reg("Costo carburante", kmCarb > 0 ? kmCarb.toFixed(3).replace(".", ",") + " &euro;/km" : "--", kmCarb > 0 ? 0 : 3,
        kmCarb > 0 ? "Carburante stimato: " + CsFmt0(carbAnno) + " &euro; all'anno (" + CsFmt0(carbAnno / 12) + " &euro; al mese)." : "Servono consumo e prezzo.", false);

    // 7. Costo tenuta
    var keep = carbAnno + rip + altre + ass + bollo;
    var keepKm = kmAnnui > 0 ? keep / kmAnnui : 0;
    var l7 = keepKm >= 0.40 ? 2 : (keepKm >= 0.25 ? 1 : 0);
    if (kmAnnui <= 0) l7 = 3;
    reg("Costo totale di tenere l'auto", CsFmt0(keep) + " &euro;/anno", l7,
        kmAnnui > 0 ? "Ti costa circa " + keepKm.toFixed(3).replace(".", ",") + " &euro; al km tra carburante, riparazioni, spese varie" + ((ass + bollo) > 0 ? ", assicurazione e bollo." : ". Inserisci assicurazione e bollo per il costo reale.") : "Inserisci i km annui.", true);

    // 8. Alternativa
    var alt = 0, diff = 0;
    if (rata > 0) {
        alt = rata * 12 + carbAnno + ass + bollo;
        diff = alt - keep;
        var l8 = diff > 0 ? 0 : 2;
        reg("Confronto con auto alternativa", (diff > 0 ? "+" : "-") + CsFmt0(Math.abs(diff)) + " &euro;/anno", l8,
            diff > 0 ? "Ti costa " + CsFmt0(diff) + " &euro; in meno all'anno. (Hai calcolato la rata VERA dell'alternativa spalmando anticipo/maxirata?)" :
            "L'alternativa costa " + CsFmt0(Math.abs(diff)) + " &euro; in meno all'anno: valuta il cambio.", true);
    } else {
        reg("Confronto con auto alternativa", "--", 3, "Inserisci il VERO costo mensile (calcolato spalmando su base mensile anticipo, rate e maxirata) per confrontarla.", false);
    }

    // 9. Valore Auto vs Riparazioni
    if (valore > 0) {
        var ripTot = rip + guasto;
        var percV = (ripTot / valore) * 100;
        var l9 = percV >= 50 ? 2 : (percV >= 30 ? 1 : 0);
        reg("Rapporto Riparazioni/Valore Auto", percV.toFixed(1).replace(".", ",") + " %", l9,
            l9 == 0 ? "Le riparazioni sono congrue al valore attuale dell'auto (" + CsFmt0(valore) + " &euro;)." :
            (l9 == 1 ? "Le spese di officina incidono per un terzo sul valore dell'auto: valuta bene i prossimi interventi." :
            "Le riparazioni pesano per il " + percV.toFixed(0) + "% del valore dell'auto. Spesso non conviene pi&ugrave; ripararla!"), true);
    } else {
        reg("Rapporto Riparazioni/Valore Auto", "--", 3, "Inserisci il valore attuale dell'auto per valutare se conviene ripararla.", false);
    }

    // 10. Età Auto
    if (annoImm > 0) {
        var etaAuto = new Date().getFullYear() - annoImm;
        var l10 = etaAuto >= 15 ? 2 : (etaAuto >= 10 ? 1 : 0);
        reg("Et&agrave; dell'auto", etaAuto + " anni", l10,
            l10 == 0 ? "L'auto &egrave; relativamente recente." :
            (l10 == 1 ? "Auto con pi&ugrave; di 10 anni: aspettati un fisiologico aumento delle piccole usure (manicotti, guarnizioni)." :
            "Auto oltre i 15 anni: rischio alto di spese impreviste importanti."), false);
    } else {
        reg("Et&agrave; dell'auto", "--", 3, "Inserisci l'anno di immatricolazione.", false);
    }

    // 11. Storico Assicurazione
    if (ass > 0 && assPrev > 0) {
        var diffAss = ass - assPrev;
        var percAss = (diffAss / assPrev) * 100;
        var l11 = percAss > 15 ? 2 : (percAss > 5 ? 1 : 0);
        reg("Rincaro Assicurazione", (diffAss > 0 ? "+" : "") + CsFmt0(diffAss) + " &euro; (" + (percAss > 0 ? "+" : "") + percAss.toFixed(1).replace(".", ",") + "%)", l11,
            l11 == 0 ? "L'assicurazione &egrave; stabile o diminuita." :
            (l11 == 1 ? "Premio in leggero aumento rispetto all'anno scorso." :
            "Rincaro importante! Cerca subito dei preventivi alternativi online, potresti risparmiare molto."), true);
    } else if (ass > 0 && assPrev <= 0) {
        reg("Rincaro Assicurazione", "--", 3, "Inserisci il premio dell'anno precedente per valutare eventuali rincari.", false);
    }

    // Scadenze e documenti (dalla scheda veicolo)
    var scUrg = [], kpiScad = CsKpi("Prossima scadenza", "--", "#64748b");
    righe.push("<div style='font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.6px; margin:14px 0 8px;'>Scadenze e documenti</div>");
    var prossima = null;
    for (var q = 0; q < CS_SCAD.length; q++) {
        var sc = CS_SCAD[q];
        var nomeSc = sc.tipo + (CS_SCAD.length > 3 && sc.mezzo ? " - " + sc.mezzo : "");
        if (sc.giorni === null) {
            reg(nomeSc, "non inserita", 3, "Inserisci la data nella scheda veicolo (tab Scadenze &amp; Documenti Auto).", false);
            continue;
        }
        var val = CsValutaScadenza(sc.tipo, sc.giorni);
        var quando = sc.giorni < 0 ? "scaduta da " + Math.abs(sc.giorni) + " gg" : (sc.giorni == 0 ? "scade OGGI" : "tra " + sc.giorni + " gg");
        reg(nomeSc, sc.data + " (" + quando + ")", val[0], val[1], false);
        if (val[0] == 2) scUrg.push(sc.tipo + (sc.giorni < 0 ? " (scaduta)" : " (tra " + sc.giorni + " gg)"));
        if (prossima === null || sc.giorni < prossima.giorni) prossima = sc;
    }
    if (prossima !== null) {
        var colP = ["#10b981", "#f59e0b", "#ef4444", "#64748b"][CsValutaScadenza(prossima.tipo, prossima.giorni)[0]];
        kpiScad = CsKpi("Prossima scadenza", prossima.tipo.split(" ")[0] + ": " + (prossima.giorni < 0 ? "scaduta" : prossima.giorni + " gg"), colP);
    }
    // Verdetto
    var verd, vcol, vtxt;
    if (reds.length >= 2 || faultRed) {
        verd = "VALUTA IL CAMBIO"; vcol = "#ef4444";
        vtxt = "Criticit&agrave;: " + reds.join(", ") + ". Conviene confrontare seriamente un'alternativa.";
    } else if (reds.length == 1 || yellows.length >= 2) {
        verd = "ATTENZIONE"; vcol = "#f59e0b";
        vtxt = "Da tenere d'occhio: " + reds.concat(yellows).join(", ") + ".";
    } else {
        verd = "TIENILA"; vcol = "#10b981";
        vtxt = yellows.length == 1 ? "Va bene cos&igrave;, prepara solo: " + yellows[0] + "." : "Tutti i parametri sono sotto controllo: non serve cambiare auto.";
    }
    if (scUrg.length > 0) {
        if (verd == "TIENILA") {
            verd = "ATTENZIONE"; vcol = "#f59e0b";
            vtxt = "Auto a posto, ma ci sono scadenze da regolarizzare: " + scUrg.join(", ") + ".";
        } else {
            vtxt += " Scadenze urgenti: " + scUrg.join(", ") + ".";
        }
    }    document.getElementById("cs_verdict").innerHTML =
        "<div style='background:linear-gradient(90deg, " + vcol + "33, transparent); border:1.5px solid " + vcol + "; border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:16px;'>" +
        "<div style='font-size:24px; font-weight:900; color:" + vcol + "; letter-spacing:0.5px;'>" + verd + "</div>" +
        "<div style='font-size:12px; color:#e2e8f0;'>" + vtxt + "</div></div>";

    document.getElementById("cs_kpi").innerHTML =
        CsKpi("Costo annuo tenuta", CsFmt0(keep) + " &euro;", "#f8fafc") +
        CsKpi("Costo al km", keepKm > 0 ? keepKm.toFixed(3).replace(".", ",") + " &euro;" : "--", "#fbbf24") +
        CsKpi("Carburante / mese", CsFmt0(carbAnno / 12) + " &euro;", "#0ea5e9") +
        CsKpi("Km a 200.000", km >= 200000 ? "superati" : CsFmt0(200000 - km) + " km", "#a855f7") +
        kpiScad;

    document.getElementById("cs_res").innerHTML = righe.join("");
}

function CsAnniSpese() {
    var anni = [];
    var anno = new Date().getFullYear();
    try {
        var sp = queryAccessDB("SELECT DataIntervento FROM tblSpeseVeicolo") || [];
        var visti = {};
        for (var i = 0; i < sp.length; i++) {
            var y = parseInt(String(sp[i].DataIntervento || "").substring(0, 4), 10);
            if (!isNaN(y) && y < anno && !visti[y]) { visti[y] = true; anni.push(y); }
        }
        anni.sort(function(a, b) { return b - a; });
    } catch(e) {}
    return anni;
}
function CsAggiornaPeriodo() {
    var sel = document.getElementById("cs_periodo");
    if (!sel) return;
    var d = CsCalcolaDati(sel.value);
    document.getElementById("cs_rip").value = Math.round(d.rip);
    document.getElementById("cs_guasto").value = Math.round(d.guasto);
    document.getElementById("cs_altre").value = Math.round(d.altre);
    CsRicalcola();
}

var CS_SCAD = [];
function CsLeggiScadenze() {
    var out = [];
    try {
        var veh = queryAccessDB("SELECT * FROM tblVeicoli") || [];
        var oggi = new Date();
        var o0 = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
        var campi = [["ScadenzaAssicurazione", "Assicurazione"], ["ScadenzaRevisione", "Revisione (collaudo)"], ["ScadenzaBollo", "Bollo"]];
        for (var v = 0; v < veh.length; v++) {
            for (var f = 0; f < campi.length; f++) {
                var ds = String(veh[v][campi[f][0]] || "").substring(0, 10);
                var p = ds.split("-");
                var g = null, txt = "";
                if (p.length == 3 && ds.indexOf("1900") !== 0) {
                    var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                    if (!isNaN(dt.getTime())) {
                        g = Math.round((dt.getTime() - o0.getTime()) / 86400000);
                        txt = p[2] + "/" + p[1] + "/" + p[0];
                    }
                }
                out.push({ tipo: campi[f][1], mezzo: String(veh[v].Targa || veh[v].Modello || ""), data: txt, giorni: g });
            }
        }
    } catch(e) {}
    return out;
}
function CsValutaScadenza(tipo, g) {
    var t = String(tipo).toLowerCase();
    var ass = t.indexOf("assic") === 0, rev = t.indexOf("revis") === 0;
    var n = Math.abs(g);
    if (g < 0) {
        if (ass) return [2, "SCADUTA da " + n + " giorni: circolare senza copertura &egrave; illegale e comporta sanzioni pesanti. Rinnova subito."];
        if (rev) return [2, "SCADUTA da " + n + " giorni: rischio di sanzione e fermo del veicolo. Prenota subito il collaudo."];
        return [2, "SCADUTO da " + n + " giorni: paga il prima possibile per evitare more e sanzioni."];
    }
    if (g <= 15) {
        if (ass) return [2, "Scade tra " + g + " giorni: rinnova adesso e confronta almeno 2-3 preventivi."];
        if (rev) return [2, "Scade tra " + g + " giorni: prenota il collaudo ora, i posti si esauriscono."];
        return [2, "Scade tra " + g + " giorni: paga entro la scadenza per evitare more."];
    }
    if (g <= 30) {
        if (ass) return [1, "Scade tra " + g + " giorni: inizia a confrontare i preventivi, conviene farlo in anticipo."];
        if (rev) return [1, "Scade tra " + g + " giorni: pianifica la prenotazione del collaudo."];
        return [1, "Scade tra " + g + " giorni: preparati al pagamento."];
    }
    var quando = g >= 365 ? "circa " + (g / 365).toFixed(1).replace(".", ",") + " anni" : g + " giorni";
    return [0, "In regola: scade tra " + quando + "."];
}

function ApriSmontaPreventivi() {
    if (document.getElementById('smontaPrevOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'smontaPrevOverlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 17, 32, 0.95); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(8px);';
    var box = document.createElement('div');
    box.style.cssText = 'background:#0f172a; width:1200px; max-width:98%; max-height:95%; overflow-y:auto; padding:25px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8); border:2px solid #f59e0b; font-family:\'Inter\',sans-serif; color:#e2e8f0; display:flex; flex-direction:column; gap:20px;';
    
    var savedStr = localStorage.getItem('sp_preventivi_memoria');
    var sD = { p1:{}, p2:{} };
    if (savedStr) { try { sD = JSON.parse(savedStr); } catch(e){} }
    
    var colHtml = function(pref, num) {
        var d = sD[pref] || {};
        var defMod = num==1 ? 'Jeep' : 'Auto B';
        return "<div style='flex:1; background:rgba(30,41,59,0.5); padding:15px; border-radius:12px; border:1px solid #334155;'>" +
        "<h3 style='margin:0 0 15px 0; color:#0ea5e9; font-size:14px; text-transform:uppercase;'>Opzione " + num + "</h3>" +
        "<div style='display:flex; flex-direction:column; gap:10px;'>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Modello</label><input type='text' id='" + pref + "_modello' value='" + (d.mod||defMod) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Listino (&euro;)</label><input type='number' id='" + pref + "_prezzo' value='" + (d.prz||(num==1?22100:"")) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Anticipo (&euro;)</label><input type='number' id='" + pref + "_anticipo' value='" + (d.ant||(num==1?6500:"")) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Rata mensile (&euro;)</label><input type='number' id='" + pref + "_rata' value='" + (d.rata||(num==1?128:"")) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Numero Rate</label><input type='number' id='" + pref + "_mesi' value='" + (d.mesi||(num==1?48:"")) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Maxirata VFG (&euro;)</label><input type='number' id='" + pref + "_maxirata' value='" + (d.maxi||(num==1?11000:"")) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "<div><label style='font-size:11px; font-weight:bold; color:#cbd5e1; display:block; margin-bottom:3px;'>Consumo (km/l)</label><input type='number' id='" + pref + "_consumo' value='" + (d.con||(num==1?20:"")) + "' style='width:100%; padding:6px; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569;'></div>" +
        "</div></div>";
    };
    
    var html = "<div style='display:flex; justify-content:space-between; align-items:center;'>" +
        "<h2 style='margin:0; color:#f59e0b; font-size:22px; font-weight:900;'><i class='fa fa-balance-scale' style='margin-right:10px;'></i>Comparatore Preventivi Auto</h2>" +
        "<div><button id='sp_btnSalva' style='background:#3b82f6; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:800; margin-right:10px;'><i class='fa fa-save'></i> Salva in Memoria</button>" +
        "<button id='sp_btnStampa' style='background:#10b981; color:#0f172a; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:800; margin-right:10px;'><i class='fa fa-print'></i> Esporta/Stampa</button>" +
        "<button id='sp_btnChiudi' style='background:#334155; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:800;'>Chiudi</button></div></div>" +
        "<div style='display:flex; gap:20px;'>" +
        colHtml('p1', 1) + colHtml('p2', 2) +
        "<div style='flex:2; background:rgba(30,41,59,0.5); padding:20px; border-radius:12px; border:1px solid #334155; display:flex; flex-direction:column; gap:15px;' id='sp_risultati'>" +
        "</div></div>";
    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    var getDati = function(pref) {
        var o = {};
        o.mod = document.getElementById(pref+'_modello').value || 'Auto';
        o.prz = parseFloat(document.getElementById(pref+'_prezzo').value) || 0;
        o.ant = parseFloat(document.getElementById(pref+'_anticipo').value) || 0;
        o.rata = parseFloat(document.getElementById(pref+'_rata').value) || 0;
        o.mesi = parseFloat(document.getElementById(pref+'_mesi').value) || 1;
        o.maxi = parseFloat(document.getElementById(pref+'_maxirata').value) || 0;
        o.con = parseFloat(document.getElementById(pref+'_consumo').value) || 1;
        o.totFin = o.ant + (o.rata * o.mesi) + o.maxi;
        o.interessi = o.totFin - o.prz;
        o.rataVera = o.totFin / (o.mesi > 0 ? o.mesi : 1);
        
        o.tasso = "--";
        if (o.prz - o.ant > 0 && o.mesi > 0 && o.totFin > o.prz) {
            var r = 0.005, p_fin = o.prz - o.ant;
            for (var iter = 0; iter < 20; iter++) {
                var val = -p_fin, deriv = 0;
                for (var m = 1; m <= o.mesi; m++) {
                    val += o.rata / Math.pow(1 + r, m);
                    deriv -= m * o.rata / Math.pow(1 + r, m + 1);
                }
                val += o.maxi / Math.pow(1 + r, o.mesi);
                deriv -= o.mesi * o.maxi / Math.pow(1 + r, o.mesi + 1);
                r = r - val / deriv;
            }
            if (!isNaN(r) && r > 0 && r < 1) o.tasso = (r * 12 * 100).toFixed(1).replace(".", ",") + "%";
        }
        return o;
    };
    
    var calcola = function() {
        var d1 = getDati('p1');
        var d2 = getDati('p2');
        
        var d = CsCalcolaDati();
        var oldCostoKm = (d.consumo > 0 && d.prezzo > 0) ? (d.prezzo / d.consumo) : 0;
        var kmAnnui = d.kmannui > 0 ? d.kmannui : 15000;
        var oldCarbAnno = oldCostoKm * kmAnnui;
        var rimbOld = d.rip + d.altre + oldCarbAnno;
        
        var compHtml = function(dx, col) {
            if (dx.prz <= 0) return "<div style='flex:1; opacity:0.3; text-align:center; padding-top:50px;'><i class='fa fa-pencil' style='font-size:24px; margin-bottom:10px;'></i><br>Inserisci dati Opzione</div>";
            if (dx.ant >= dx.prz) return "<div style='flex:1; border-left:4px solid #ef4444; padding:15px; color:#ef4444;'><h4 style='margin:0 0 10px 0;'>" + dx.mod + " - ERRORE</h4>Dati incongruenti: l'anticipo versato (" + dx.ant + "&euro;) &egrave; maggiore o uguale al prezzo di listino (" + dx.prz + "&euro;). Il finanziamento non ha senso.</div>";
            if (dx.maxi >= dx.prz) return "<div style='flex:1; border-left:4px solid #ef4444; padding:15px; color:#ef4444;'><h4 style='margin:0 0 10px 0;'>" + dx.mod + " - ERRORE</h4>Dati incongruenti: la Maxirata (" + dx.maxi + "&euro;) non pu&ograve; essere uguale o superiore all'intero costo di listino dell'auto!</div>";
            if (dx.con > 100) return "<div style='flex:1; border-left:4px solid #ef4444; padding:15px; color:#ef4444;'><h4 style='margin:0 0 10px 0;'>" + dx.mod + " - ERRORE</h4>Consumo impossibile! Un'auto che fa " + dx.con + " km/l non esiste.</div>";
            if (dx.mesi > 120) return "<div style='flex:1; border-left:4px solid #ef4444; padding:15px; color:#ef4444;'><h4 style='margin:0 0 10px 0;'>" + dx.mod + " - ERRORE</h4>Numero di rate non valido! Nessuna finanziaria ti concede un mutuo auto di " + dx.mesi + " mesi (oltre 10 anni)!</div>";
            
            if (dx.mesi <= 0 || dx.con <= 0) return "<div style='flex:1; opacity:0.3; text-align:center; padding-top:50px;'><i class='fa fa-pencil' style='font-size:24px; margin-bottom:10px;'></i><br>Compila tutti i dati dell'opzione...</div>";
            
            if (dx.totFin < dx.prz) return "<div style='flex:1; border-left:4px solid #ef4444; padding:15px; color:#ef4444;'><h4 style='margin:0 0 10px 0;'>" + dx.mod + " - ERRORE</h4>Dati incongruenti: il Costo Totale (" + dx.totFin + "&euro;) &egrave; inferiore al prezzo di listino (" + dx.prz + "&euro;)! Controlla la rata o la maxirata, nessuno regala soldi.</div>";
            
            var carb = (d.prezzo / dx.con) * kmAnnui;
            var rimb = (dx.rataVera * 12) + carb;
            var diffOld = rimb - rimbOld;
            
            return "<div style='flex:1; border-left:4px solid "+col+"; padding-left:15px;'>" +
                "<h4 style='margin:0 0 10px 0; color:"+col+";'>" + dx.mod + "</h4>" +
                "<div style='margin-bottom:8px; font-size:12px;'><span style='color:#94a3b8;'>Costo Totale:</span> <b style='color:#fff;'>" + Math.round(dx.totFin) + " &euro;</b></div>" +
                "<div style='margin-bottom:8px; font-size:12px;'><span style='color:#94a3b8;'>Interessi/TAEG:</span> <b style='color:#ef4444;'>" + Math.round(dx.interessi) + " &euro;</b> (" + dx.tasso + ")</div>" +
                "<div style='margin-bottom:8px; font-size:12px;'><span style='color:#94a3b8;'>Rata Vera Piena:</span> <b style='color:#fff;'>" + Math.round(dx.rataVera) + " &euro;/m</b></div>" +
                "<div style='margin-bottom:8px; font-size:12px;'><span style='color:#94a3b8;'>Mantenimento annuo:</span> <b style='color:#fff;'>" + Math.round(rimb) + " &euro;</b></div>" +
                "<div style='margin-top:15px; font-size:12px; padding:6px; background:rgba(255,255,255,0.05); border-radius:4px;'>vs Vecchia Auto: <b style='color:" + (diffOld>0?"#ef4444":"#10b981") + ";'>" + (diffOld>0?"+":"") + Math.round(diffOld) + " &euro;/anno</b></div>" +
                "</div>";
        };
        
        var isValid = function(dx) {
            if (dx.prz <= 0 || dx.mesi <= 0 || dx.con <= 0) return false;
            if (dx.ant >= dx.prz || dx.maxi >= dx.prz || dx.totFin < dx.prz) return false;
            if (dx.con > 100 || dx.mesi > 120) return false;
            return true;
        };
        
        var v1 = isValid(d1) ? ((d1.rataVera * 12) + ((d.prezzo / d1.con) * kmAnnui)) : 9999999;
        var v2 = isValid(d2) ? ((d2.rataVera * 12) + ((d.prezzo / d2.con) * kmAnnui)) : 9999999;
        var winner = "";
        var showConfetti = false;
        if (isValid(d1) && isValid(d2)) {
            var diff = Math.abs(v1 - v2);
            if (diff > 1000) showConfetti = true;
            if (v1 < v2) winner = "<div style='background:rgba(16,185,129,0.15); padding:10px; border-radius:8px; text-align:center; color:#10b981; font-weight:bold;'>🏆 Vince " + d1.mod + "! Risparmi " + Math.round(diff) + " &euro; all'anno rispetto all'altra opzione." + (showConfetti ? " 🎉💸" : "") + "</div>";
            else if (v2 < v1) winner = "<div style='background:rgba(16,185,129,0.15); padding:10px; border-radius:8px; text-align:center; color:#10b981; font-weight:bold;'>🏆 Vince " + d2.mod + "! Risparmi " + Math.round(diff) + " &euro; all'anno rispetto all'altra opzione." + (showConfetti ? " 🎉💸" : "") + "</div>";
            else winner = "<div style='background:rgba(245,158,11,0.15); padding:10px; border-radius:8px; text-align:center; color:#f59e0b; font-weight:bold;'>Pareggio tecnico tra le due opzioni.</div>";
            
            if (showConfetti && !document.getElementById('sp_confetti')) {
                var cdiv = document.createElement('div');
                cdiv.id = 'sp_confetti';
                cdiv.style.cssText = 'position:absolute; top:-20px; left:0; width:100%; height:100%; pointer-events:none; z-index:999999; text-align:center; font-size:40px; overflow:hidden; white-space:nowrap; animation: fall 3s linear forwards;';
                cdiv.innerHTML = "🎉 🎊 💸 🏆 💸 🎊 🎉 💸 🏆 💸 🎊 🎉";
                var st = document.createElement('style');
                st.innerHTML = "@keyframes fall { 0% { top:-50px; opacity:1; } 80% { opacity:1; } 100% { top:600px; opacity:0; } }";
                document.head.appendChild(st);
                box.appendChild(cdiv);
                setTimeout(function(){ if(cdiv.parentNode) cdiv.parentNode.removeChild(cdiv); }, 3000);
            }
        } else if (d1.prz > 0 && d2.prz > 0) {
            winner = "<div style='background:rgba(239,68,68,0.15); padding:10px; border-radius:8px; text-align:center; color:#ef4444; font-weight:bold;'>Impossibile calcolare il vincitore. Correggi gli errori in rosso.</div>";
        }
        
        var maxV = Math.max(rimbOld, v1 < 9999999 ? v1 : 0, v2 < 9999999 ? v2 : 0);
        var chartHtml = "";
        if (maxV > 0) {
            var wOld = Math.round((rimbOld/maxV)*100);
            var w1 = (v1 < 9999999) ? Math.round((v1/maxV)*100) : 0;
            var w2 = (v2 < 9999999) ? Math.round((v2/maxV)*100) : 0;
            
            chartHtml = "<div style='margin-top:15px; padding:15px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid #334155;'>" +
                "<h4 style='margin:0 0 10px 0; font-size:11px; color:#cbd5e1; text-transform:uppercase;'><i class='fa fa-bar-chart'></i> Impatto Finanziario Annuo</h4>" +
                "<div style='display:flex; align-items:center; margin-bottom:8px;'><div style='width:90px; font-size:10px; color:#94a3b8; overflow:hidden; text-overflow:ellipsis;'>Vecchia Auto</div><div style='flex:1; background:#1e293b; border-radius:4px; height:8px; overflow:hidden;'><div style='width:" + wOld + "%; background:#cbd5e1; height:100%; transition:width 0.5s;'></div></div><div style='width:50px; text-align:right; font-size:11px; font-weight:bold; color:#cbd5e1;'>" + Math.round(rimbOld) + "&euro;</div></div>" +
                (v1 < 9999999 ? "<div style='display:flex; align-items:center; margin-bottom:8px;'><div style='width:90px; font-size:10px; color:#0ea5e9; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'>" + d1.mod + "</div><div style='flex:1; background:#1e293b; border-radius:4px; height:8px; overflow:hidden;'><div style='width:" + w1 + "%; background:#0ea5e9; height:100%; transition:width 0.5s;'></div></div><div style='width:50px; text-align:right; font-size:11px; font-weight:bold; color:#0ea5e9;'>" + Math.round(v1) + "&euro;</div></div>" : "") +
                (v2 < 9999999 ? "<div style='display:flex; align-items:center; margin-bottom:0;'><div style='width:90px; font-size:10px; color:#f43f5e; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'>" + d2.mod + "</div><div style='flex:1; background:#1e293b; border-radius:4px; height:8px; overflow:hidden;'><div style='width:" + w2 + "%; background:#f43f5e; height:100%; transition:width 0.5s;'></div></div><div style='width:50px; text-align:right; font-size:11px; font-weight:bold; color:#f43f5e;'>" + Math.round(v2) + "&euro;</div></div>" : "") +
                "</div>";
        }
        
        var resHtml = "<h3 style='margin:0 0 10px 0; color:#10b981; font-size:14px; text-transform:uppercase;'>Confronto Diretto</h3>" +
            "<div style='display:flex; gap:15px; margin-bottom:15px;'>" + compHtml(d1, "#0ea5e9") + compHtml(d2, "#f43f5e") + "</div>" + winner + chartHtml;
        document.getElementById('sp_risultati').innerHTML = resHtml;
    };
    
    var arr = ['p1', 'p2'];
    var flds = ['modello', 'prezzo', 'anticipo', 'rata', 'mesi', 'maxirata', 'consumo'];
    arr.forEach(function(pref) {
        flds.forEach(function(f) {
            var el = document.getElementById(pref+'_'+f);
            if(el) { el.onkeyup = calcola; el.onchange = calcola; }
        });
    });
    
    document.getElementById('sp_btnSalva').onclick = function() {
        var d1 = getDati('p1'); var d2 = getDati('p2');
        localStorage.setItem('sp_preventivi_memoria', JSON.stringify({ p1: d1, p2: d2 }));
        var btn = document.getElementById('sp_btnSalva');
        var old = btn.innerHTML;
        btn.innerHTML = "<i class='fa fa-check'></i> Salvato!";
        btn.style.background = "#10b981";
        setTimeout(function(){ btn.innerHTML = old; btn.style.background = "#3b82f6"; }, 2000);
    };
    
    document.getElementById('sp_btnStampa').onclick = function() {
        try {
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            var shell = new ActiveXObject("WScript.Shell");
            var deskPath = shell.SpecialFolders("Desktop");
            var filePath = deskPath + "\\Confronto_Preventivi.html";
            var file = fso.CreateTextFile(filePath, true);
            var htmlData = "<html><head><title>Confronto Preventivi Auto</title><style>body{font-family:sans-serif; padding:20px; color:#333;} h1{color:#111;} table{width:100%; border-collapse:collapse; margin-top:20px;} th, td{border:1px solid #ccc; padding:10px; text-align:left;} th{background:#eee;}</style></head><body>" +
                           "<h1><img src='assets/images/logo.png' style='height:40px; vertical-align:middle;' onerror='this.style.display=\"none\"'> Report Analisi Finanziaria Preventivi</h1>" +
                           "<p><i>Documento generato dal Sistema Logistica - Consulente Auto</i></p>" +
                           document.getElementById('sp_risultati').innerHTML.replace(/color:#fff/g, 'color:#000').replace(/color:#ef4444/g, 'color:#d32f2f').replace(/color:#cbd5e1/g, 'color:#333').replace(/color:#94a3b8/g, 'color:#555').replace(/background:rgba[^;]+;/g, 'background:#f9f9f9; border:1px solid #ddd;').replace(/border-left:4px solid/g, 'border-left:5px solid') +
                           "<script>window.onload = function() { window.print(); };</script></body></html>";
            file.Write(htmlData);
            file.Close();
            shell.Run('"' + filePath + '"');
        } catch(e) {
            alert("Errore durante l'esportazione. Assicurati che i controlli ActiveX siano abilitati. Dettaglio: " + e.message);
        }
    };
    
    document.getElementById('sp_btnChiudi').onclick = function() {
        overlay.parentNode.removeChild(overlay);
    };
    
    calcola();
}
