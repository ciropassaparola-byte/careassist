/**
 * ZENITH LOGISTICA 2026 - MODULO GESTIONE MATERIALI NATIVO
 * Motore ultra-veloce (0.05s) per consultazione ed estrazione ausili & dispositivi.
 * Supporta la Vista Catalogo Materiali e Vista Cliente.
 */

(function(window) {
    'use strict';

    var MaterialiEngine = {
        data: [],
        currentProv: 'ALL',
        currentView: 'MATERIALI', // 'MATERIALI' oppure 'CLIENTI'
        isLoaded: false,

        escapeHTML: function(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        escapeJS: function(str) {
            if (!str) return '';
            return String(str)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
        },

        // Caricamento Dati istantaneo dal DB JSON
        loadData: function(callback) {
            var self = this;
            var jsonPath = "File_Sistema/gestione_materiale/materiali_db.json";
            
            try {
                if (typeof ActiveXObject !== "undefined") {
                    var fso = new ActiveXObject("Scripting.FileSystemObject");
                    var pG = window.location.pathname || "";
                    if (pG.indexOf("/") === 0 && pG.indexOf(":") > -1) pG = pG.substring(1);
                    pG = decodeURIComponent(pG).replace(/\//g, "\\");
                    var baseDir = fso.GetParentFolderName(pG);
                    
                    var fullPath = fso.BuildPath(baseDir, "gestione_materiale\\materiali_db.json");
                    if (!fso.FileExists(fullPath)) {
                        fullPath = fso.BuildPath(baseDir, "File_Sistema\\gestione_materiale\\materiali_db.json");
                    }

                    if (fso.FileExists(fullPath)) {
                        var stream = new ActiveXObject("ADODB.Stream");
                        stream.Type = 2;
                        stream.Charset = "utf-8";
                        stream.Open();
                        stream.LoadFromFile(fullPath);
                        var rawText = stream.ReadText(-1);
                        stream.Close();
                        
                        try {
                            self.data = eval("(" + rawText + ")");
                        } catch(eEval) {
                            self.data = JSON.parse(rawText);
                        }
                        self.isLoaded = true;
                        if (callback) callback(null, self.data);
                        return;
                    }
                }
            } catch(eAx) {}

            var fetchUrl = jsonPath + "?t=" + new Date().getTime();
            fetch(fetchUrl)
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    self.data = data || [];
                    self.isLoaded = true;
                    if (callback) callback(null, self.data);
                })
                .catch(function(err) {
                    fetch("gestione_materiale/materiali_db.json?t=" + new Date().getTime())
                        .then(function(res2) { return res2.json(); })
                        .then(function(data2) {
                            self.data = data2 || [];
                            self.isLoaded = true;
                            if (callback) callback(null, self.data);
                        })
                        .catch(function(err2) {
                            self.data = [];
                            self.isLoaded = true;
                            if (callback) callback(err2, []);
                        });
                });
        },

        // Estrae la lista piatta di tutti i singoli materiali
        getFlatMateriali: function() {
            var flat = [];
            for (var i = 0; i < this.data.length; i++) {
                var item = this.data[i];
                if (item.materiali && item.materiali.length > 0) {
                    for (var m = 0; m < item.materiali.length; m++) {
                        var mat = item.materiali[m];
                        flat.push({
                            nomeMateriale: mat.valore || mat.nome || "Ausilio N/D",
                            tipoCategoria: mat.nome || "Generico",
                            nominativo: item.nominativo || "N/D",
                            cliente: item.cliente || "",
                            citta: item.citta || "-",
                            telefono: item.telefono || "-",
                            province: item.province || "BARI"
                        });
                    }
                }
            }
            return flat;
        },

        // Apri la Finestra Pop-up Dedicata Singola
        apriModal: function() {
            var self = this;
            var overlay = document.getElementById("materialiOverlay");
            if (overlay) {
                overlay.style.display = "none";
            }
            self.apriWindow();
        },

        // Apri la Finestra Pop-up Dedicata Standalone
        apriWindow: function() {
            try {
                if (typeof ActiveXObject !== "undefined") {
                    var shell = new ActiveXObject("WScript.Shell");
                    var fso = new ActiveXObject("Scripting.FileSystemObject");
                    var pG = window.location.pathname || "";
                    if (pG.indexOf("/") === 0 && pG.indexOf(":") > -1) pG = pG.substring(1);
                    pG = decodeURIComponent(pG).replace(/\//g, "\\");
                    var baseDir = fso.GetParentFolderName(pG);
                    
                    var viewerPath = fso.BuildPath(baseDir, "gestione_materiale\\visualizzatore_materiali.html");
                    if (!fso.FileExists(viewerPath)) {
                        viewerPath = fso.BuildPath(baseDir, "File_Sistema\\gestione_materiale\\visualizzatore_materiali.html");
                    }
                    if (!fso.FileExists(viewerPath)) {
                        viewerPath = "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\questa\\Sistema_Logistica_C_Milella\\File_Sistema\\gestione_materiale\\visualizzatore_materiali.html";
                    }
                    if (fso.FileExists(viewerPath)) {
                        shell.Run('mshta.exe "' + viewerPath + '"', 1, false);
                        return;
                    }
                }
            } catch(eAx) {}

            var relUrl = "File_Sistema/gestione_materiale/visualizzatore_materiali.html";
            if (window.location.pathname.indexOf("File_Sistema") > -1) {
                relUrl = "gestione_materiale/visualizzatore_materiali.html";
            }
            window.open(relUrl, "_blank", "width=1300,height=850");
        },

        chiudiModal: function() {
            var overlay = document.getElementById("materialiOverlay");
            if (overlay) overlay.style.display = "none";
            try {
                if (window.parent && window.parent.document) {
                    var pOv = window.parent.document.getElementById("materialiOverlay");
                    if (pOv) pOv.style.display = "none";
                }
            } catch(eP){}
        },

        impostaVista: function(viewMode) {
            this.currentView = viewMode;
            var btnMat = document.getElementById("btnViewMateriali");
            var btnCli = document.getElementById("btnViewClienti");
            
            if (btnMat && btnCli) {
                if (viewMode === 'MATERIALI') {
                    btnMat.style.background = "#1e40af"; btnMat.style.color = "#ffffff";
                    btnCli.style.background = "#cbd5e1"; btnCli.style.color = "#1e293b";
                } else {
                    btnCli.style.background = "#1e40af"; btnCli.style.color = "#ffffff";
                    btnMat.style.background = "#cbd5e1"; btnMat.style.color = "#1e293b";
                }
            }
            
            this.filtra();
        },

        // Ricerca Intelligente Cliente per Autocompilazione Scheda Consegna
        cercaClientePerNominativo: function(queryNome) {
            if (!queryNome || String(queryNome).trim().length < 2) return null;
            var q = String(queryNome).toLowerCase().trim();
            
            for (var i = 0; i < this.data.length; i++) {
                var item = this.data[i];
                var nom = (item.nominativo || '').toLowerCase();
                
                if (nom.indexOf(q) > -1 || q.indexOf(nom) > -1) {
                    var matTextArr = [];
                    if (item.materiali) {
                        for (var m = 0; m < item.materiali.length; m++) {
                            var mat = item.materiali[m];
                            var strM = (mat.nome ? mat.nome + ': ' : '') + (mat.valore || '');
                            if (strM) matTextArr.push(strM);
                        }
                    }
                    
                    return {
                        nominativo: item.nominativo,
                        cliente: item.cliente,
                        citta: item.citta,
                        telefono: item.telefono,
                        province: item.province,
                        materialiList: item.materiali || [],
                        materialiText: matTextArr.join(' | ')
                    };
                }
            }
            return null;
        },

        // Attiva il Listener Autocompilazione su qualsiasi Input Cognome/Nome
        associaAutocompilazione: function(inputId, targetFieldsMap) {
            var inputEl = document.getElementById(inputId);
            if (!inputEl) return;
            
            var self = this;
            var handler = function() {
                var val = inputEl.value;
                var res = self.cercaClientePerNominativo(val);
                if (res && targetFieldsMap) {
                    if (targetFieldsMap.citta && document.getElementById(targetFieldsMap.citta)) {
                        document.getElementById(targetFieldsMap.citta).value = res.citta || '';
                    }
                    if (targetFieldsMap.telefono && document.getElementById(targetFieldsMap.telefono)) {
                        document.getElementById(targetFieldsMap.telefono).value = res.telefono || '';
                    }
                    if (targetFieldsMap.materiali && document.getElementById(targetFieldsMap.materiali)) {
                        document.getElementById(targetFieldsMap.materiali).value = res.materialiText || '';
                    }
                    if (targetFieldsMap.province && document.getElementById(targetFieldsMap.province)) {
                        document.getElementById(targetFieldsMap.province).value = res.province || '';
                    }
                }
            };
            
            if (inputEl.addEventListener) {
                inputEl.addEventListener('keyup', handler);
                inputEl.addEventListener('change', handler);
            } else {
                inputEl.onkeyup = handler;
            }
        },

        popolaProvince: function() {
            var btnContainer = document.getElementById("materialiProvButtons");
            if (!btnContainer) return;
            
            var provSet = {};
            for (var i = 0; i < this.data.length; i++) {
                if (this.data[i].province) {
                    provSet[this.data[i].province.toUpperCase()] = true;
                }
            }
            
            var html = '<button onclick="MaterialiEngine.impostaProvincia(\'ALL\')" style="background:' + (this.currentProv === 'ALL' ? '#1e40af' : '#cbd5e1') + '; color:' + (this.currentProv === 'ALL' ? '#ffffff' : '#1e293b') + '; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">TUTTE</button>';
            
            for (var p in provSet) {
                if (provSet.hasOwnProperty(p)) {
                    var active = (this.currentProv === p);
                    html += '<button onclick="MaterialiEngine.impostaProvincia(\'' + p + '\')" style="background:' + (active ? '#1e40af' : '#cbd5e1') + '; color:' + (active ? '#ffffff' : '#1e293b') + '; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; margin-left:4px;">' + p + '</button>';
                }
            }
            btnContainer.innerHTML = html;
        },

        impostaProvincia: function(prov) {
            this.currentProv = prov;
            this.popolaProvince();
            this.filtra();
        },

        filtra: function() {
            var txt = document.getElementById("txtSearchMateriali");
            var query = txt ? txt.value.toLowerCase().trim() : "";
            
            if (this.currentView === 'MATERIALI') {
                var flatList = this.getFlatMateriali();
                var filteredMat = [];
                for (var f = 0; f < flatList.length; f++) {
                    var itemM = flatList[f];
                    if (this.currentProv !== 'ALL' && (itemM.province || '').toUpperCase() !== this.currentProv) continue;
                    if (query !== "") {
                        var nm = (itemM.nomeMateriale || '').toLowerCase();
                        var cat = (itemM.tipoCategoria || '').toLowerCase();
                        var nom = (itemM.nominativo || '').toLowerCase();
                        var cit = (itemM.citta || '').toLowerCase();
                        var tel = (itemM.telefono || '').toLowerCase();
                        if (nm.indexOf(query) === -1 && cat.indexOf(query) === -1 && nom.indexOf(query) === -1 && cit.indexOf(query) === -1 && tel.indexOf(query) === -1) continue;
                    }
                    filteredMat.push(itemM);
                }
                this.renderTabellaMateriali(filteredMat);
            } else {
                var filtered = [];
                for (var i = 0; i < this.data.length; i++) {
                    var item = this.data[i];
                    if (this.currentProv !== 'ALL' && (item.province || '').toUpperCase() !== this.currentProv) continue;
                    if (query !== "") {
                        var nomC = (item.nominativo || '').toLowerCase();
                        var cliC = (item.cliente || '').toLowerCase();
                        var citC = (item.citta || '').toLowerCase();
                        var telC = (item.telefono || '').toLowerCase();
                        var matStr = "";
                        if (item.materiali) {
                            for (var k = 0; k < item.materiali.length; k++) {
                                matStr += (item.materiali[k].nome || '') + " " + (item.materiali[k].valore || '') + " ";
                            }
                        }
                        matStr = matStr.toLowerCase();
                        if (nomC.indexOf(query) === -1 && cliC.indexOf(query) === -1 && citC.indexOf(query) === -1 && telC.indexOf(query) === -1 && matStr.indexOf(query) === -1) continue;
                    }
                    filtered.push(item);
                }
                this.renderTabellaClienti(filtered);
            }
        },

        renderTabellaMateriali: function(records) {
            var tbody = document.getElementById("tbodyMaterialiModal");
            var lblCount = document.getElementById("lblMaterialiCount");
            var thead = document.getElementById("theadMaterialiModal");
            
            if (lblCount) lblCount.innerText = records.length + " MATERIALI E DISPOSITIVI IN ELENCO";
            
            if (thead) {
                thead.innerHTML = '<tr>' +
                    '<th style="padding:12px 16px; text-align:left; width:35%;">Materiale / Ausilio</th>' +
                    '<th style="padding:12px 16px; text-align:left; width:25%;">Assegnato a (Cliente)</th>' +
                    '<th style="padding:12px 16px; text-align:left; width:15%;">Città / Prov.</th>' +
                    '<th style="padding:12px 16px; text-align:left; width:15%;">Telefono</th>' +
                    '<th style="padding:12px 16px; text-align:center; width:10%;">Azione</th>' +
                '</tr>';
            }
            
            if (!tbody) return;
            if (records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#64748b; font-weight:700;">Nessun materiale o ausilio trovato con i filtri inseriti.</td></tr>';
                return;
            }
            
            var html = "";
            for (var i = 0; i < records.length; i++) {
                var item = records[i];
                var badgeCat = '<span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:800; margin-right:6px;">' + this.escapeHTML(item.tipoCategoria) + '</span>';
                var clienteStr = this.escapeHTML(item.nominativo);
                if (item.cliente && item.cliente !== '') {
                    clienteStr += ' <span style="font-size:0.7rem; background:#1e40af; color:white; padding:2px 5px; border-radius:4px; font-weight:800;">' + this.escapeHTML(item.cliente) + '</span>';
                }
                
                html += '<tr style="border-bottom:1px solid #e2e8f0; background:' + (i % 2 === 0 ? '#ffffff' : '#f8fafc') + ';">' +
                    '<td style="padding:10px 16px; font-weight:800; color:#1e3a8a;">' + badgeCat + this.escapeHTML(item.nomeMateriale) + '</td>' +
                    '<td style="padding:10px 16px; font-weight:700; color:#334155;">' + clienteStr + '</td>' +
                    '<td style="padding:10px 16px; color:#475569;">' + this.escapeHTML(item.citta) + ' (' + this.escapeHTML(item.province) + ')</td>' +
                    '<td style="padding:10px 16px; color:#475569; font-weight:600;">' + this.escapeHTML(item.telefono) + '</td>' +
                    '<td style="padding:10px 16px; text-align:center;">' +
                        '<button onclick="MaterialiEngine.copiaContatto(\'' + this.escapeJS(item.nominativo) + '\', \'' + this.escapeJS(item.telefono) + '\')" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer;">📋 Copia</button>' +
                    '</td>' +
                '</tr>';
            }
            tbody.innerHTML = html;
        },

        renderTabellaClienti: function(records) {
            var tbody = document.getElementById("tbodyMaterialiModal");
            var lblCount = document.getElementById("lblMaterialiCount");
            var thead = document.getElementById("theadMaterialiModal");
            
            if (lblCount) lblCount.innerText = records.length + " CLIENTE CON MATERIALI TROVATI";
            
            if (thead) {
                thead.innerHTML = '<tr>' +
                    '<th style="padding:12px 16px; text-align:left; width:22%;">Nominativo / Cliente</th>' +
                    '<th style="padding:12px 16px; text-align:left; width:15%;">Città</th>' +
                    '<th style="padding:12px 16px; text-align:left; width:18%;">Telefono</th>' +
                    '<th style="padding:12px 16px; text-align:left;">Materiali Assegnati</th>' +
                    '<th style="padding:12px 16px; text-align:center; width:10%;">Azione</th>' +
                '</tr>';
            }
            
            if (!tbody) return;
            if (records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#64748b; font-weight:700;">Nessun cliente trovato con i filtri correnti.</td></tr>';
                return;
            }
            
            var html = "";
            for (var i = 0; i < records.length; i++) {
                var item = records[i];
                var matHtml = "";
                if (item.materiali && item.materiali.length > 0) {
                    for (var m = 0; m < item.materiali.length; m++) {
                        var mat = item.materiali[m];
                        matHtml += '<div style="margin-bottom:4px; font-size:12px;"><b style="color:#1e40af;">' + this.escapeHTML(mat.nome) + ':</b> ' + this.escapeHTML(mat.valore) + '</div>';
                    }
                } else {
                    matHtml = '<span style="color:#94a3b8; font-style:italic;">Nessun materiale specificato</span>';
                }
                
                var clienteStr = this.escapeHTML(item.nominativo || 'N/D');
                if (item.cliente && item.cliente !== '') {
                    clienteStr += ' <span style="font-size:0.7rem; background:#1e40af; color:white; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:800;">' + this.escapeHTML(item.cliente) + '</span>';
                }
                
                html += '<tr style="border-bottom:1px solid #e2e8f0; background:' + (i % 2 === 0 ? '#ffffff' : '#f8fafc') + ';">' +
                    '<td style="padding:10px 16px; font-weight:700; color:#0f172a;">' + clienteStr + '</td>' +
                    '<td style="padding:10px 16px; color:#475569;">' + this.escapeHTML(item.citta || '-') + '</td>' +
                    '<td style="padding:10px 16px; color:#475569; font-weight:600;">' + this.escapeHTML(item.telefono || '-') + '</td>' +
                    '<td style="padding:10px 16px;">' + matHtml + '</td>' +
                    '<td style="padding:10px 16px; text-align:center;">' +
                        '<button onclick="MaterialiEngine.copiaContatto(\'' + this.escapeJS(item.nominativo) + '\', \'' + this.escapeJS(item.telefono) + '\')" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer;">📋 Copia</button>' +
                    '</td>' +
                '</tr>';
            }
            tbody.innerHTML = html;
        },

        copiaContatto: function(nom, tel) {
            var txt = nom + " - Tel: " + tel;
            if (window.clipboardData) {
                window.clipboardData.setData("Text", txt);
                alert("Copiato negli appunti:\n" + txt);
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(txt);
                alert("Copiato negli appunti:\n" + txt);
            }
        },

        apriExcelDiretto: function() {
            try {
                if (typeof ActiveXObject !== "undefined") {
                    var shell = new ActiveXObject("WScript.Shell");
                    var fso = new ActiveXObject("Scripting.FileSystemObject");
                    var excelPath = "C:\\Users\\Utente\\Desktop\\LOGISTICA_CONSEGNE_MC\\ELENCO E QUANTITA'MATERIALE.xls";
                    if (fso.FileExists(excelPath)) {
                        shell.Run('"' + excelPath + '"', 1, false);
                        return;
                    }
                }
                alert("Apri il file Excel sorgente dalla cartella del progetto:\nELENCO E QUANTITA'MATERIALE.xls");
            } catch(e) {
                alert("Impossibile aprire il file Excel: " + e.message);
            }
        },

        selezionaFileExcel: function() {
            var self = this;
            try {
                if (typeof ActiveXObject !== "undefined") {
                    var shell = new ActiveXObject("WScript.Shell");
                    var fso = new ActiveXObject("Scripting.FileSystemObject");
                    var cmd = 'powershell -Sta -NoProfile -ExecutionPolicy Bypass -Command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.windows.forms\') | Out-Null; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = \'File Excel (*.xls;*.xlsx)|*.xls;*.xlsx|Tutti i File (*.*)|*.*\'; $f.Title = \'Seleziona File Excel Materiali\'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Host $f.FileName }"';
                    var exec = shell.Exec(cmd);
                    var res = exec.StdOut.ReadAll().replace(/[\r\n]/g, "");
                    if (res && res.length > 0) {
                        var pG = window.location.pathname || "";
                        if (pG.indexOf("/") === 0 && pG.indexOf(":") > -1) pG = pG.substring(1);
                        pG = decodeURIComponent(pG).replace(/\//g, "\\");
                        var baseDir = fso.GetParentFolderName(pG);
                        
                        var cfgPath = fso.BuildPath(baseDir, "config.json");
                        if (!fso.FileExists(cfgPath)) cfgPath = fso.BuildPath(baseDir, "gestione_materiale\\config.json");
                        
                        var cfgContent = '{"excelPath": "' + res.replace(/\\/g, "\\\\") + '"}';
                        var fCfg = fso.CreateTextFile(cfgPath, true);
                        fCfg.Write(cfgContent);
                        fCfg.Close();
                        
                        var vbsPath = fso.BuildPath(baseDir, "import_excel_native.vbs");
                        if (!fso.FileExists(vbsPath)) vbsPath = fso.BuildPath(baseDir, "gestione_materiale\\import_excel_native.vbs");
                        
                        if (fso.FileExists(vbsPath)) {
                            shell.Run('wscript.exe "' + vbsPath + '"', 0, true);
                        }
                        
                        alert("File Excel aggiornato con successo!\nPercorso: " + res);
                        self.loadData(function() {
                            self.popolaProvince();
                            self.filtra();
                        });
                        return;
                    }
                }
            } catch(eEx) {
                alert("Errore selezione file Excel: " + eEx.message);
            }
        }
    };

    window.MaterialiEngine = MaterialiEngine;

    if (document.readyState === "complete" || document.readyState === "interactive") {
        MaterialiEngine.loadData();
    } else {
        if (window.addEventListener) {
            window.addEventListener("DOMContentLoaded", function() {
                MaterialiEngine.loadData();
            });
        }
    }

})(window);
