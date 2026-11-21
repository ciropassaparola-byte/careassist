/**
 * ANAGRAFICA PREMIUM UX LOGIC
 * Funzionalità aggiunte: Glass Tabs, Floating Labels, Pulse Feedback, Smart Copy, Interactive Integrity
 */

// --- GESTIONE GLASS TABS ---
function SwitchTab(tabId, btnElement) {
    // Nascondi tutti i tab content
    var contents = document.querySelectorAll('.tab-content');
    for (var i = 0; i < contents.length; i++) {
        contents[i].classList.remove('active');
    }
    
    // Rimuovi la classe active da tutti i bottoni del tab
    var btns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    
    // Attiva il tab selezionato
    var target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    
    // Attiva il bottone (se non passato, prova a trovarlo)
    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        // Fallback (cerca quello associato)
        for (var i = 0; i < btns.length; i++) {
            if(btns[i].getAttribute('onclick') && btns[i].getAttribute('onclick').indexOf(tabId) > -1) {
                btns[i].classList.add('active');
                break;
            }
        }
    }
    
    if (typeof UXPremium !== 'undefined' && UXPremium.PlaySound) {
        UXPremium.PlaySound.Click();
    }
}

// --- SMART COPY FUNZIONALITA ---
function SmartCopy(inputId) {
    var el = document.getElementById(inputId);
    if (el && el.value.trim() !== "") {
        try {
            window.clipboardData.setData('Text', el.value);
            if (typeof UXPremium !== 'undefined') {
                UXPremium.ShowToast("Valore copiato negli appunti: " + el.value, "success");
            } else {
                alert("Copiato: " + el.value);
            }
        } catch(e) {
            console.log("Errore copia", e);
        }
    } else {
        if (typeof UXPremium !== 'undefined') {
            UXPremium.ShowToast("Nessun valore da copiare.", "warning");
        }
    }
}

// --- INIZIALIZZAZIONE UX ---
window.addEventListener('load', function() {
    
    // 1. FLOATING LABELS E PULSE FEEDBACK (DIRTY TRACKING)
    var inputs = document.querySelectorAll('.zenith-input');
    
    var checkValue = function(el) {
        if (el.value.trim() !== "") {
            el.classList.add('has-value');
            if (el.parentNode && el.parentNode.classList.contains('zenith-field-group')) {
                el.parentNode.classList.add('has-value');
            }
        } else {
            el.classList.remove('has-value');
            if (el.parentNode && el.parentNode.classList.contains('zenith-field-group')) {
                el.parentNode.classList.remove('has-value');
            }
        }
    };
    
    // Dirty tracking array
    window.modifiedFields = {};
    
    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        
        // Controllo iniziale
        checkValue(input);
        
        // Listener per simulare Floating Labels
        // Override input per aggiornare le "Chicche"
        input.addEventListener('input', function(e) {
            var el = e.target || e.srcElement;
            checkValue(el);
            
            // Pulse Feedback su modifica
            if (!window.modifiedFields[el.id]) {
                window.modifiedFields[el.id] = true;
                el.classList.add('pulse-dirty');
                
                // Cerca il bottone salva vicino
                if (el.parentNode) {
                    var saveBtn = el.parentNode.querySelector('.q-save');
                    if (saveBtn) saveBtn.classList.add('pulse-dirty-icon');
                }
            }
            
            // Trigger chicche
            if (el.id === 'txtCognomeNome') {
                updateMagicAvatar();
            }
            updateRealtimeIntegrity();
        });
        
        input.addEventListener('change', function(e) {
            checkValue(e.target || e.srcElement);
            if (e.target.id === 'txtCognomeNome') updateMagicAvatar();
            updateRealtimeIntegrity();
        });
        
        // Patch per fixare l'autofill / caricamento programmatico
        setTimeout(function(el) { return function() { checkValue(el); if(el.id==='txtCognomeNome') updateMagicAvatar(); updateRealtimeIntegrity(); }; }(input), 500);
        setTimeout(function(el) { return function() { checkValue(el); if(el.id==='txtCognomeNome') updateMagicAvatar(); updateRealtimeIntegrity(); }; }(input), 1500);
    }
    
    // FUNZIONI DELLE CHICCHE UX
    function updateMagicAvatar() {
        var nameField = document.getElementById('txtCognomeNome');
        var ph = document.getElementById('photoPlaceholder');
        var img = document.getElementById('imgCliente');
        
        if (ph && nameField && (!img || img.style.display === "none")) {
            var name = nameField.value.trim();
            if (name.length > 0) {
                var parts = name.split(' ');
                var initials = parts[0].charAt(0).toUpperCase();
                if (parts.length > 1 && parts[1].length > 0) initials += parts[1].charAt(0).toUpperCase();
                
                var colors = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e"];
                var hash = 0;
                for(var i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                var color = colors[Math.abs(hash) % colors.length];
                
                ph.innerHTML = "<div style='width: 100%; height: 100%; border-radius: 10px; background: linear-gradient(135deg, " + color + "dd, " + color + "); display: flex; justify-content: center; align-items: center; font-size: 3rem; font-weight: 800; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.5); cursor: pointer;' onclick='getEl(\"fileFoto\").click()' title='Clicca per cambiare foto'>" + initials + "</div>";
                ph.style.border = "none";
            } else {
                ph.innerHTML = "<div style='text-align:center;'><i class='fa fa-camera' style='font-size:2rem; margin-bottom:10px; color:var(--zenith-gold);'></i><br><span style='font-size:0.7rem; font-weight:800; letter-spacing:1px;'>TRASCINA<br>FOTO</span></div>";
                ph.style.border = "2px dashed rgba(255,255,255,0.1)";
            }
        }
    }
    
    function updateRealtimeIntegrity() {
        var total = 5;
        var filled = 0;
        
        if (document.getElementById('txtCognomeNome') && document.getElementById('txtCognomeNome').value.trim() !== "") filled++;
        if (document.getElementById('txtEmailCliente') && document.getElementById('txtEmailCliente').value.trim() !== "") filled++;
        // Il telefono potrebbe essere gestito dal ghost in alcuni casi
        if ((document.getElementById('txtTelefoni') && document.getElementById('txtTelefoni').value.trim() !== "") || (document.getElementById('txtPhoneGhost') && document.getElementById('txtPhoneGhost').value.trim() !== "")) filled++;
        if (document.getElementById('cmbLocalita') && document.getElementById('cmbLocalita').value.trim() !== "") filled++;
        if (document.getElementById('txtResidenza') && document.getElementById('txtResidenza').value.trim() !== "") filled++;
        
        var perc = Math.round((filled / total) * 100);
        var bar = document.getElementById('integrityBar');
        var lbl = document.getElementById('lblIntegrityPerc');
        
        if (bar && lbl) {
            bar.style.width = perc + "%";
            lbl.innerText = perc + "%";
            
            if (perc < 40) bar.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
            else if (perc < 80) bar.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)";
            else bar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
        }
    }
    
    // Override QuickAction SAVE per pulire lo stato dirty se c'è
    if (typeof window.QuickAction === 'function') {
        var originalQuickAction = window.QuickAction;
        window.QuickAction = function(mode, targetId) {
            var res = originalQuickAction(mode, targetId);
            
            // Se stiamo salvando tutto
            if (mode === 'SAVE' && !targetId) {
                // Rimuovi pulse da tutto
                var dirtyInputs = document.querySelectorAll('.pulse-dirty');
                for(var i=0; i<dirtyInputs.length; i++) dirtyInputs[i].classList.remove('pulse-dirty');
                
                var dirtyIcons = document.querySelectorAll('.pulse-dirty-icon');
                for(var i=0; i<dirtyIcons.length; i++) dirtyIcons[i].classList.remove('pulse-dirty-icon');
                
                window.modifiedFields = {};
            }
            return res;
        };
    }
    
    // 2. INTERACTIVE INTEGRITY (Tooltip)
    var integrityBox = document.querySelector('.integrity-box');
    if (integrityBox) {
        integrityBox.style.cursor = 'help';
        integrityBox.title = "Clicca per analisi dettagliata dei campi mancanti";
        
        integrityBox.onclick = function() {
            var missing = [];
            if (document.getElementById('txtEmailCliente') && document.getElementById('txtEmailCliente').value.trim() === "") missing.push("Email");
            if (document.getElementById('txtTelefoni') && document.getElementById('txtTelefoni').value.trim() === "") missing.push("Telefono");
            if (document.getElementById('cmbLocalita') && document.getElementById('cmbLocalita').value.trim() === "") missing.push("Comune");
            if (document.getElementById('txtResidenza') && document.getElementById('txtResidenza').value.trim() === "") missing.push("Indirizzo Residenza");
            
            var msg = missing.length > 0 ? "Campi raccomandati mancanti:\n- " + missing.join("\n- ") : "Profilo compilato al 100%!";
            if (typeof UXPremium !== 'undefined') {
                UXPremium.ShowToast(missing.length > 0 ? "Completa il profilo: mancano " + missing.length + " dati" : "Ottimo, profilo 100%!", missing.length > 0 ? "warning" : "success");
            }
            alert("ANALISI INTEGRITÀ DATI\n\n" + msg);
        };
    }
    
    // 3. BADGE DINAMICO STATO CLIENTE
    // Cerchiamo di aggiornarlo durante il caricamento del record
    setInterval(function() {
        var rankBadge = document.getElementById('lblRankBadge');
        var dataIns = document.getElementById('lblDeckDataIns');
        var idField = document.getElementById('txtId');
        
        if (rankBadge && dataIns && idField) {
            if (idField.value === "NEW" || idField.value === "") {
                rankBadge.style.display = "none";
                return;
            }
            
            // Semplice logica dimostrativa: 
            // Se la data di emissione è recente (es. anno in corso)
            var currentYear = new Date().getFullYear().toString();
            if (dataIns.innerText.indexOf(currentYear) > -1) {
                rankBadge.className = "zenith-status-badge badge-nuovo";
                rankBadge.innerHTML = "<i class='fa fa-star'></i> CLIENTE RECENTE";
                rankBadge.style.display = "inline-block";
            } else {
                // Altrimenti, dormiente se ultima modifica è di oltre 1 anno fa?
                // Lasciamo Frequente per default se non ci sono regole precise
                var modified = document.getElementById('lblDeckDataMod');
                if (modified && modified.innerText.indexOf(currentYear) > -1) {
                    rankBadge.className = "zenith-status-badge badge-frequente";
                    rankBadge.innerHTML = "<i class='fa fa-fire'></i> CLIENTE ATTIVO";
                    rankBadge.style.display = "inline-block";
                } else {
                    rankBadge.className = "zenith-status-badge badge-dormiente";
                    rankBadge.innerHTML = "<i class='fa fa-moon-o'></i> DORMIENTE";
                    rankBadge.style.display = "inline-block";
                }
            }
        }
    }, 2000); // Polling ogni 2s per rilevare aggiornamenti lenti
    
    // 3.5 POLLING VELOCE PER MAGIC AVATAR (Rileva cambi programmatici istantanei)
    var lastAvatarName = "";
    setInterval(function() {
        var nf = document.getElementById('txtCognomeNome');
        if (nf) {
            var curr = nf.value.trim();
            if (curr !== lastAvatarName) {
                lastAvatarName = curr;
                updateMagicAvatar();
                updateRealtimeIntegrity();
            }
        }
    }, 200);
    
    // 4. CHICCHE PREMIUM: Google Maps, Formattazione Telefono, Master Control, Salvataggio Animato
    setTimeout(function() {
        // A. Google Maps Magic Button
        var resField = document.getElementById('txtResidenza');
        if (resField && resField.parentNode) {
            var hdr = resField.parentNode.querySelector('.zenith-field-actions');
            if (hdr) {
                var btnMap = document.createElement('i');
                btnMap.className = "fa fa-map-marker q-action";
                btnMap.title = "Apri in Google Maps";
                btnMap.style.color = "#f43f5e";
                btnMap.onclick = function() {
                    var addr = resField.value;
                    var loc = document.getElementById('cmbLocalita') ? document.getElementById('cmbLocalita').value : "";
                    if (addr.length > 2) {
                        window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr + " " + loc));
                    } else {
                        alert("Compila prima Indirizzo e Comune per usare la mappa!");
                    }
                };
                hdr.insertBefore(btnMap, hdr.firstChild);
            }
        }
        
        // B. Formattazione Intelligente Telefono
        function formatPhone(el) {
            if (!el || !el.value) return;
            var val = el.value.replace(/\D/g, ''); // Solo numeri
            var formatted = val;
            if (val.length > 3) {
                formatted = val.substring(0,3) + " " + val.substring(3,6) + (val.length > 6 ? " " + val.substring(6) : "");
            }
            // Evita di resettare il cursore se non necessario
            if (el.value !== formatted) el.value = formatted;
        }
        var phoneInput = document.getElementById('txtTelefoni');
        if (phoneInput) {
            phoneInput.addEventListener('keyup', function() { formatPhone(this); });
            phoneInput.addEventListener('blur', function() { formatPhone(this); });
        }
        
        // C. Master Control (Tasti di scelta rapida con Alt/Ctrl)
        var style = document.createElement('style');
        style.innerHTML = 
            "body.show-shortcuts .dock-btn { position: relative; } " +
            "body.show-shortcuts .dock-btn::after { " +
                "content: attr(data-shortcut); position: absolute; top: -12px; right: -12px; " +
                "background: #f43f5e; color: white; padding: 3px 8px; border-radius: 6px; " +
                "font-size: 0.75rem; font-weight: 900; box-shadow: 0 4px 10px rgba(0,0,0,0.5); " +
                "z-index: 10000; letter-spacing: 1px; border: 2px solid white; pointer-events: none; " +
            "} " +
            "body.show-shortcuts .zenith-app-container { filter: brightness(0.8); transition: 0.2s; }";
        document.head.appendChild(style);
        
        if(document.getElementById('btnSalva')) document.getElementById('btnSalva').setAttribute('data-shortcut', 'Ctrl+S');
        if(document.getElementById('btnSvuota')) document.getElementById('btnSvuota').setAttribute('data-shortcut', 'Ctrl+N');
        if(document.getElementById('btnEsci')) document.getElementById('btnEsci').setAttribute('data-shortcut', 'Esc');
        
        document.addEventListener('keydown', function(e) {
            if (e.keyCode === 18 || e.keyCode === 17) document.body.classList.add('show-shortcuts');
        });
        document.addEventListener('keyup', function(e) {
            if (e.keyCode === 18 || e.keyCode === 17) document.body.classList.remove('show-shortcuts');
        });
        
        // D. Salvataggio Animato
        if (typeof window.ActionSalva === 'function') {
            var originalSalva = window.ActionSalva;
            window.ActionSalva = function() {
                var btn = document.getElementById('btnSalva');
                if (btn) {
                    var oldHtml = btn.innerHTML;
                    var oldBg = btn.style.background;
                    btn.innerHTML = "<i class='fa fa-spinner fa-spin'></i> SALVATAGGIO...";
                    btn.style.background = "#f59e0b"; // Orange
                    
                    setTimeout(function() {
                        var res = false;
                        try { res = originalSalva(); } catch(e) { console.error(e); }
                        
                        if (res !== false) { // Se non ha ritornato false (errore validazione)
                            btn.innerHTML = "<i class='fa fa-check'></i> SALVATO!";
                            btn.style.background = "#10b981"; // Green
                            setTimeout(function() {
                                btn.innerHTML = oldHtml;
                                btn.style.background = oldBg;
                            }, 1500);
                        } else {
                            btn.innerHTML = oldHtml;
                            btn.style.background = oldBg;
                        }
                    }, 50); // Piccolo delay per far refreshare la UI e far apparire lo spinner
                    return false; // Il vero ritorno è gestito dentro il setTimeout, ActionSalva solitamente non ritorna un valore critico a chi la chiama dal click
                } else {
                    return originalSalva();
                }
            };
        }
        
        // E. WhatsApp Diretto
        var phoneFieldUI = document.getElementById('txtTelefoni');
        if (phoneFieldUI && phoneFieldUI.parentNode) {
            var hdrPhone = phoneFieldUI.parentNode.querySelector('.zenith-field-actions');
            if (hdrPhone) {
                var btnWa = document.createElement('i');
                btnWa.className = "fa fa-whatsapp q-action";
                btnWa.title = "Scrivi su WhatsApp Web";
                btnWa.style.color = "#25D366";
                btnWa.onclick = function() {
                    var num = phoneFieldUI.value.replace(/\D/g, '');
                    if (num.length >= 9 && num.indexOf('3') === 0) window.open("https://wa.me/39" + num);
                    else if (num.length >= 9) window.open("https://wa.me/" + num);
                    else alert("Inserisci un numero di cellulare valido prima!");
                };
                hdrPhone.insertBefore(btnWa, hdrPhone.firstChild);
            }
        }
        
        // F. Macchina del Tempo (Undo per campo)
        var allInputs = document.querySelectorAll('.zenith-input');
        for (var k = 0; k < allInputs.length; k++) {
            var inp = allInputs[k];
            // Salva valore originale al focus se non è sporco
            inp.addEventListener('focus', function() {
                if (!this.classList.contains('pulse-dirty') && !this.hasAttribute('data-orig')) {
                    this.setAttribute('data-orig', this.value);
                }
            });
            // Aggiungi tastino undo
            var hdrInp = inp.parentNode ? inp.parentNode.querySelector('.zenith-field-actions') : null;
            if (hdrInp && !hdrInp.querySelector('.q-undo')) {
                var btnUndo = document.createElement('i');
                btnUndo.className = "fa fa-undo q-action q-undo";
                btnUndo.title = "Annulla modifiche a questo campo";
                btnUndo.style.display = "none";
                btnUndo.onclick = (function(fld, btnU) {
                    return function() {
                        if (fld.hasAttribute('data-orig')) {
                            fld.value = fld.getAttribute('data-orig');
                            fld.classList.remove('pulse-dirty');
                            if(window.modifiedFields) delete window.modifiedFields[fld.id];
                            btnU.style.display = "none";
                            // Resetta se avatar
                            if (fld.id === 'txtCognomeNome') updateMagicAvatar();
                            updateRealtimeIntegrity();
                        }
                    };
                })(inp, btnUndo);
                hdrInp.insertBefore(btnUndo, hdrInp.firstChild);
                
                // Mostra undo quando si sporca
                inp.addEventListener('input', (function(btnU) {
                    return function() {
                        if (this.classList.contains('pulse-dirty')) btnU.style.display = "inline-block";
                    };
                })(btnUndo));
            }
        }
        
        // G. Smart Paste (Incolla Magico)
        var dockBottom = document.querySelector('.zenith-action-dock');
        if (dockBottom) {
            var btnPaste = document.createElement('button');
            btnPaste.className = "dock-btn";
            btnPaste.innerHTML = "<i class='fa fa-magic' style='color:#a855f7'></i> INCOLLA MAGICO";
            btnPaste.onclick = function() {
                var overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100%'; overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(2, 6, 23, 0.85)';
                overlay.style.zIndex = '100000';
                overlay.style.display = 'flex'; overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';

                var modal = document.createElement('div');
                modal.style.backgroundColor = '#0f172a';
                modal.style.border = '2px solid #a855f7';
                modal.style.borderRadius = '16px';
                modal.style.padding = '25px';
                modal.style.width = '450px';
                modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.3)';
                modal.style.fontFamily = "'Outfit', 'Segoe UI', sans-serif";
                modal.style.color = '#f8fafc';
                
                var title = document.createElement('h3');
                title.innerHTML = "<i class='fa fa-magic' style='color:#a855f7; margin-right:10px;'></i>INCOLLA MAGICO";
                title.style.margin = '0 0 15px 0'; title.style.fontSize = '18px'; title.style.fontWeight = '900'; title.style.letterSpacing = '1px';
                
                var desc = document.createElement('p');
                desc.innerHTML = "Incolla qui il blocco di testo (es. firma email, messaggio WhatsApp).<br>Il sistema estrarrà automaticamente Nome, Email, Telefono e Indirizzo.";
                desc.style.fontSize = '12px'; desc.style.color = '#94a3b8'; desc.style.marginBottom = '20px'; desc.style.lineHeight = '1.4';
                
                var textarea = document.createElement('textarea');
                textarea.style.width = '100%'; textarea.style.height = '150px';
                textarea.style.backgroundColor = '#020617'; textarea.style.border = '1px solid #334155';
                textarea.style.color = '#fff'; textarea.style.borderRadius = '8px'; textarea.style.padding = '10px';
                textarea.style.fontSize = '13px'; textarea.style.resize = 'none'; textarea.style.outline = 'none';
                textarea.style.boxSizing = 'border-box'; textarea.style.marginBottom = '20px';
                textarea.placeholder = "Incolla o digita qui il testo magico...";
                textarea.onfocus = function() { this.style.borderColor = '#a855f7'; };
                textarea.onblur = function() { this.style.borderColor = '#334155'; };

                var btnContainer = document.createElement('div');
                btnContainer.style.display = 'flex'; btnContainer.style.justifyContent = 'flex-end'; btnContainer.style.gap = '10px';
                
                var btnCancel = document.createElement('button');
                btnCancel.innerHTML = "Annulla";
                btnCancel.style.backgroundColor = 'transparent'; btnCancel.style.border = '1px solid #334155';
                btnCancel.style.color = '#94a3b8'; btnCancel.style.padding = '8px 16px'; btnCancel.style.borderRadius = '8px';
                btnCancel.style.cursor = 'pointer'; btnCancel.style.fontWeight = '800';
                btnCancel.onclick = function() { document.body.removeChild(overlay); };
                
                var btnProcess = document.createElement('button');
                btnProcess.innerHTML = "<i class='fa fa-bolt'></i> ESTRAI DATI";
                btnProcess.style.backgroundColor = '#a855f7'; btnProcess.style.border = 'none';
                btnProcess.style.color = '#fff'; btnProcess.style.padding = '8px 16px'; btnProcess.style.borderRadius = '8px';
                btnProcess.style.cursor = 'pointer'; btnProcess.style.fontWeight = '900';
                
                btnContainer.appendChild(btnCancel);
                btnContainer.appendChild(btnProcess);
                modal.appendChild(title);
                modal.appendChild(desc);
                modal.appendChild(textarea);
                modal.appendChild(btnContainer);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                textarea.focus();

                btnProcess.onclick = function() {
                    var text = textarea.value;
                    document.body.removeChild(overlay);
                    if (text && text.trim().length > 0) {
                        var mEmail = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
                        if (mEmail && document.getElementById('txtEmailCliente')) {
                            document.getElementById('txtEmailCliente').value = mEmail[0];
                            document.getElementById('txtEmailCliente').classList.add('pulse-dirty');
                        }
                        var mPhone = text.match(/(?:3\d{2}[\s.-]*\d{3}[\s.-]*\d{4}|3\d{2}[\s.-]*\d{7})/);
                        if (mPhone && document.getElementById('txtTelefoni')) {
                            document.getElementById('txtTelefoni').value = mPhone[0];
                            document.getElementById('txtTelefoni').classList.add('pulse-dirty');
                            formatPhone(document.getElementById('txtTelefoni'));
                        }
                        var mAddr = text.match(/(Via|Viale|Piazza|Corso|Largo|Vicolo)\s+([A-Za-z\s]+)(?:,\s*|\s+)(\d+[a-zA-Z]?)/i);
                        if (mAddr && document.getElementById('txtResidenza')) {
                            document.getElementById('txtResidenza').value = mAddr[0];
                            document.getElementById('txtResidenza').classList.add('pulse-dirty');
                        }
                        // Estrai possibile nome (prime parole)
                        var lines = text.trim().split('\n');
                        if (lines.length > 0 && document.getElementById('txtCognomeNome') && document.getElementById('txtCognomeNome').value.trim() === '') {
                            var firstLine = lines[0].replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i, '').replace(/\d/g, '').replace(/via|viale|piazza|corso/i, '').trim();
                            if (firstLine.length > 3) {
                                document.getElementById('txtCognomeNome').value = firstLine.substring(0, 50).trim();
                                document.getElementById('txtCognomeNome').classList.add('pulse-dirty');
                                updateMagicAvatar();
                            }
                        }
                        updateRealtimeIntegrity();
                        
                        // Custom alert per successo in modo da rimuovere anche quello di sistema
                        var succOverlay = document.createElement('div');
                        succOverlay.style.position = 'fixed'; succOverlay.style.top = '0'; succOverlay.style.left = '0'; succOverlay.style.width = '100%'; succOverlay.style.height = '100%';
                        succOverlay.style.backgroundColor = 'rgba(2, 6, 23, 0.7)'; succOverlay.style.zIndex = '100000';
                        succOverlay.style.display = 'flex'; succOverlay.style.justifyContent = 'center'; succOverlay.style.alignItems = 'center';
                        var succModal = document.createElement('div');
                        succModal.style.backgroundColor = '#0f172a'; succModal.style.border = '2px solid #10b981';
                        succModal.style.borderRadius = '16px'; succModal.style.padding = '25px'; succModal.style.width = '350px';
                        succModal.style.textAlign = 'center'; succModal.style.color = '#fff'; succModal.style.fontFamily = "'Outfit', 'Segoe UI', sans-serif";
                        succModal.innerHTML = "<i class='fa fa-check-circle' style='font-size:40px; color:#10b981; margin-bottom:15px;'></i><h3 style='margin:0 0 10px 0;'>Magia Completata!</h3><p style='font-size:12px; color:#94a3b8; margin-bottom:20px;'>Dati estratti e inseriti nei campi con successo.</p>";
                        var succBtn = document.createElement('button');
                        succBtn.innerHTML = "Chiudi"; succBtn.style.backgroundColor = '#10b981'; succBtn.style.border = 'none';
                        succBtn.style.color = '#fff'; succBtn.style.padding = '8px 24px'; succBtn.style.borderRadius = '8px';
                        succBtn.style.cursor = 'pointer'; succBtn.style.fontWeight = '900';
                        succBtn.onclick = function() { document.body.removeChild(succOverlay); };
                        succModal.appendChild(succBtn); succOverlay.appendChild(succModal);
                        document.body.appendChild(succOverlay);
                    }
                };
            };
            dockBottom.insertBefore(btnPaste, dockBottom.firstChild);
            
            // Bottone Stampa DDT
            var btnDDT = document.createElement('button');
            btnDDT.className = "dock-btn";
            btnDDT.innerHTML = "<i class='fa fa-file-pdf-o' style='color:#ef4444'></i> STAMPA DDT PDF";
            btnDDT.onclick = function() {
                var w = window.open('', '_blank', 'width=800,height=900');
                var ddtHtml = "<html><head><title>DDT - Documento di Trasporto</title>";
                ddtHtml += "<style>body{font-family:sans-serif; margin:40px;} .header{border-bottom:2px solid #333; padding-bottom:20px; margin-bottom:20px; display:flex; justify-content:space-between;} .title{font-size:24px; font-weight:bold;} .data-box{border:1px solid #ccc; padding:15px; margin-bottom:15px; border-radius:8px;} .grid{display:grid; grid-template-columns:1fr 1fr; gap:20px;} .footer{margin-top:50px; text-align:center; font-size:12px; color:#666;}</style>";
                ddtHtml += "</head><body>";
                ddtHtml += "<div class='header'><div><h1 style='margin:0;color:#0ea5e9;'>LOGISTICA PLATINUM</h1><p style='margin:0'>Trasporti & Consegne</p></div><div class='title'>DOCUMENTO DI TRASPORTO (DDT)</div></div>";
                
                var mitt = document.getElementById('txtCliente') ? document.getElementById('txtCliente').value : '';
                var dest = document.getElementById('txtIndirizzo') ? document.getElementById('txtIndirizzo').value : '';
                var merce = document.getElementById('txtMerce') ? document.getElementById('txtMerce').value : '';
                var dataC = document.getElementById('txtDataConsegna') ? document.getElementById('txtDataConsegna').value : new Date().toLocaleDateString();
                
                ddtHtml += "<div class='grid'>";
                ddtHtml += "<div class='data-box'><h3>Destinatario</h3><p><strong>" + mitt + "</strong><br>" + dest + "</p></div>";
                ddtHtml += "<div class='data-box'><h3>Dettagli Spedizione</h3><p>Data: " + dataC + "<br>Riferimento Ordine: Automtico</p></div>";
                ddtHtml += "</div>";
                
                ddtHtml += "<div class='data-box'><h3>Descrizione Merce</h3><p>" + (merce || "Nessuna descrizione specificata") + "</p></div>";
                
                ddtHtml += "<div style='margin-top:50px; display:flex; justify-content:space-between;'>";
                ddtHtml += "<div style='width:200px; border-top:1px solid #000; text-align:center; padding-top:10px;'>Firma Vettore</div>";
                ddtHtml += "<div style='width:200px; border-top:1px solid #000; text-align:center; padding-top:10px;'>Firma Destinatario</div>";
                ddtHtml += "</div>";
                
                ddtHtml += "<div class='footer'>Documento generato automaticamente dal sistema Logistica Platinum.</div>";
                ddtHtml += "<script>window.onload=function(){window.print();}</script></body></html>";
                
                w.document.write(ddtHtml);
                w.document.close();
            };
            dockBottom.insertBefore(btnDDT, dockBottom.firstChild);
        }
        
        // I. Decodificatore Magico Codice Fiscale
        var txtCF = document.getElementById('txtCodFisc');
        if (txtCF) {
            var cfBadgeContainer = document.createElement('div');
            cfBadgeContainer.style.marginTop = "5px";
            if (txtCF.parentNode) txtCF.parentNode.appendChild(cfBadgeContainer);
            
            function decodeCF() {
                var cf = txtCF.value.toUpperCase().trim();
                if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) {
                    txtCF.style.borderColor = "#10b981"; // Verde smeraldo
                    var yearStr = cf.substring(6, 8);
                    var monthChar = cf.charAt(8);
                    var dayStr = cf.substring(9, 11);
                    
                    var year = parseInt(yearStr);
                    year = year > 30 ? 1900 + year : 2000 + year; // Assunzione semplificata per vecchi e nuovi millenials
                    
                    var day = parseInt(dayStr);
                    var gender = "Uomo";
                    if (day > 40) { gender = "Donna"; day -= 40; }
                    
                    var months = {A:1, B:2, C:3, D:4, E:5, H:6, L:7, M:8, P:9, R:10, S:11, T:12};
                    var month = months[monthChar] || 1;
                    
                    var age = new Date().getFullYear() - year;
                    
                    cfBadgeContainer.innerHTML = "<span style='background:linear-gradient(135deg, #a855f7, #6366f1); color:white; padding:3px 8px; border-radius:10px; font-size:0.65rem; font-weight:800;'><i class='fa fa-magic'></i> " + gender + ", nato il " + day + "/" + month + "/" + year + " (" + age + " anni)</span>";
                } else if (cf.length > 0) {
                    txtCF.style.borderColor = "#f59e0b"; // Arancione
                    cfBadgeContainer.innerHTML = "";
                } else {
                    txtCF.style.borderColor = "";
                    cfBadgeContainer.innerHTML = "";
                }
            }
            txtCF.addEventListener('input', decodeCF);
            setInterval(decodeCF, 1000); // Polling in caso di caricamento automatico
        }
        
        // J. Smart Tags Nelle Note
        var txtNote = document.getElementById('txtNote');
        if (txtNote) {
            var tagsContainer = document.createElement('div');
            tagsContainer.style.marginBottom = "8px";
            if (txtNote.parentNode) txtNote.parentNode.insertBefore(tagsContainer, txtNote);
            
            function extractTags() {
                var text = txtNote.value;
                var matches = text.match(/#(\w+)/g);
                tagsContainer.innerHTML = "";
                if (matches) {
                    var unique = [];
                    for(var j=0; j<matches.length; j++) if(unique.indexOf(matches[j]) === -1) unique.push(matches[j]);
                    
                    for(var j=0; j<unique.length; j++) {
                        var t = unique[j].toLowerCase();
                        var color = "#0ea5e9";
                        if (t.indexOf('urgente') > -1 || t.indexOf('insolvente') > -1 || t.indexOf('attento') > -1) color = "#ef4444";
                        if (t.indexOf('vip') > -1 || t.indexOf('attenzione') > -1) color = "#f59e0b";
                        if (t.indexOf('mattina') > -1 || t.indexOf('pomeriggio') > -1) color = "#8b5cf6";
                        
                        tagsContainer.innerHTML += "<span style='background:" + color + "; color:white; padding:3px 8px; border-radius:10px; font-size:0.65rem; font-weight:800; margin-right:5px; margin-bottom:5px; display:inline-block; box-shadow:0 2px 5px rgba(0,0,0,0.3); transition:0.3s; cursor:default;'>" + t + "</span>";
                    }
                }
            }
            txtNote.addEventListener('input', extractTags);
            setInterval(extractTags, 1000); // Polling anche qui
        }
        
        // K. Validatore Visivo P.IVA
        var txtPIva = document.getElementById('txtPIva');
        if (txtPIva) {
            function validatePIva() {
                var val = txtPIva.value.replace(/\s/g, '');
                if (val.length === 11 && /^\d+$/.test(val)) txtPIva.style.borderColor = "#10b981"; // Verde
                else if (val.length > 0) txtPIva.style.borderColor = "#f59e0b"; // Arancione
                else txtPIva.style.borderColor = "";
            }
            txtPIva.addEventListener('input', validatePIva);
            setInterval(validatePIva, 1000);
        }
        
    }, 1000);
    
});

// ============================================================================
// NUOVE FUNZIONALITA' PREMIUM 2026 (LOGISTICA, CRM, DOCS, VOICE)
// ============================================================================

// 1. Logica Mappa Integrata
function AggiornaMappaLogistica() {
    var indirizzo = document.getElementById('txtLogIndirizzo') ? document.getElementById('txtLogIndirizzo').value : "";
    var comune = document.getElementById('txtLogComune') ? document.getElementById('txtLogComune').value : "";
    
    // Fallback su residenza se logistica è vuota
    if (!indirizzo && !comune) {
        indirizzo = document.getElementById('txtResidenza') ? document.getElementById('txtResidenza').value : "";
        comune = document.getElementById('cmbLocalita') ? document.getElementById('cmbLocalita').value : "";
    }
    
    if (indirizzo.length > 3 || comune.length > 2) {
        // Simula calcolo distanza dalla Sede (Bari)
        var badge = document.getElementById('distanzaBadge');
        var lbl = document.getElementById('lblDistanza');
        if (badge && lbl) {
            var randomDistance = Math.floor(Math.random() * 45) + 2; // Mock da 2 a 47 km
            lbl.innerText = randomDistance + " KM";
            badge.style.display = 'inline-block';
        }
    } else {
        var badge = document.getElementById('distanzaBadge');
        if (badge) badge.style.display = 'none';
    }
}
setInterval(AggiornaMappaLogistica, 2000); // Polling per mappare l'indirizzo

// 3. Smart Tags (Pillole Veloci)
function InitializeSmartTags() {
    var container = document.getElementById('smartTagsContainer');
    if (!container) return;
    
    var tags = ["#ConsegnaDifficile", "#SoloMattina", "#PianoAlto", "#Attenzione", "#ClienteVIP", "#Urgentissimo"];
    var html = "";
    for(var i=0; i<tags.length; i++) {
        var color = tags[i].indexOf('Attenzione') > -1 || tags[i].indexOf('Urgentissimo') > -1 ? '#ef4444' : '#38bdf8';
        if (tags[i].indexOf('VIP') > -1) color = '#f59e0b';
        html += "<span onclick='ToggleSmartTag(\"" + tags[i] + "\")' style='background:rgba(255,255,255,0.05); border:1px solid " + color + "; color:" + color + "; padding:2px 6px; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer; transition:0.2s;' onmouseover='this.style.background=\"" + color + "\"; this.style.color=\"white\"' onmouseout='this.style.background=\"rgba(255,255,255,0.05)\"; this.style.color=\"" + color + "\"'>" + tags[i] + "</span>";
    }
    container.innerHTML = html;
}
function ToggleSmartTag(tag) {
    var txtNote = document.getElementById('txtNote');
    if (txtNote) {
        if (txtNote.value.indexOf(tag) === -1) {
            txtNote.value = tag + " " + txtNote.value;
            txtNote.classList.add('pulse-dirty');
            if (typeof UXPremium !== 'undefined') UXPremium.ShowToast("Tag aggiunto: " + tag, "success");
        } else {
            txtNote.value = txtNote.value.replace(tag + " ", "").replace(tag, "");
            txtNote.classList.add('pulse-dirty');
        }
    }
}
setTimeout(InitializeSmartTags, 1000);

// 4. Timeline CRM Interazioni
function RegistraInterazione(tipo, dettaglio) {
    var container = document.getElementById('crmTimelineContainer');
    if (!container) return;
    
    // Rimuovi il messaggio "Nessuna interazione" se presente
    if (container.innerHTML.indexOf('Nessuna interazione') > -1) {
        container.innerHTML = "";
    }
    
    var icon = "fa-check"; var color = "#94a3b8";
    if (tipo === 'whatsapp') { icon = "fa-whatsapp"; color = "#25d366"; }
    else if (tipo === 'email') { icon = "fa-envelope"; color = "#3b82f6"; }
    else if (tipo === 'salvataggio') { icon = "fa-save"; color = "#f59e0b"; }
    else if (tipo === 'nota') { icon = "fa-comment"; color = "#10b981"; }
    
    var d = new Date();
    var time = ("0"+d.getHours()).slice(-2) + ":" + ("0"+d.getMinutes()).slice(-2);
    
    var html = "<div style='display:flex; gap:10px; align-items:flex-start; margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.05);'>" +
               "<div style='background:rgba(255,255,255,0.1); border-radius:50%; width:24px; height:24px; display:flex; justify-content:center; align-items:center; flex-shrink:0;'><i class='fa " + icon + "' style='color:" + color + "; font-size:0.7rem;'></i></div>" +
               "<div><div style='font-size:0.7rem; color:#64748b; font-weight:bold;'>" + time + " - SISTEMA</div>" +
               "<div style='font-size:0.85rem; color:#e2e8f0; margin-top:2px;'>" + dettaglio + "</div></div></div>";
               
    container.innerHTML = html + container.innerHTML;
}

function AggiungiLogManuale() {
    var testo = prompt("Inserisci i dettagli dell'interazione (es. Chiamata effettuata e risposto):");
    if (testo) { RegistraInterazione('nota', testo); }
}

// Intercetta vecchi click per loggare
var oldWhatsApp = window.WhatsAppCliente;
window.WhatsAppCliente = function() {
    if (oldWhatsApp) oldWhatsApp();
    RegistraInterazione('whatsapp', "Inviato messaggio WhatsApp");
};
var oldEmail = window.EmailCliente;
window.EmailCliente = function() {
    if (oldEmail) oldEmail();
    RegistraInterazione('email', "Inviata comunicazione via Email");
};

// 5. Drag & Drop Documenti
window.GestisciDropDocumento = function(e) {
    e.preventDefault();
    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
    e.target.style.background = 'rgba(0,0,0,0.2)';
    
    var files = e.dataTransfer.files;
    if (files && files.length > 0) {
        var file = files[0];
        var lista = document.getElementById('listaDocumenti');
        if (lista) {
            var el = document.createElement('div');
            el.style.background = "rgba(56, 189, 248, 0.15)";
            el.style.border = "1px solid #38bdf8";
            el.style.color = "#38bdf8";
            el.style.padding = "5px 10px";
            el.style.borderRadius = "6px";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.justifyContent = "space-between";
            el.style.fontSize = "0.75rem";
            el.innerHTML = "<span><i class='fa fa-file-pdf-o' style='margin-right:5px;'></i> " + file.name + "</span> <i class='fa fa-trash' style='cursor:pointer;' onclick='this.parentNode.remove()'></i>";
            lista.appendChild(el);
            RegistraInterazione('salvataggio', "Allegato nuovo documento: " + file.name);
            if (typeof UXPremium !== 'undefined') UXPremium.ShowToast("Documento allegato: " + file.name, "success");
        }
    } else {
        // Proviamo a vedere se è un percorso testo trascinato
        var textPath = e.dataTransfer.getData("Text");
        if (textPath) {
            var lista = document.getElementById('listaDocumenti');
            if (lista) {
                var el = document.createElement('div');
                el.style.background = "rgba(56, 189, 248, 0.15)"; el.style.border = "1px solid #38bdf8"; el.style.color = "#38bdf8"; el.style.padding = "5px 10px"; el.style.borderRadius = "6px"; el.style.display = "flex"; el.style.alignItems = "center"; el.style.justifyContent = "space-between"; el.style.fontSize = "0.75rem";
                el.innerHTML = "<span><i class='fa fa-file-o' style='margin-right:5px;'></i> " + textPath.substring(textPath.lastIndexOf('\\')+1) + "</span> <i class='fa fa-trash' style='cursor:pointer;' onclick='this.parentNode.remove()'></i>";
                lista.appendChild(el);
            }
        }
    }
};

// 6. Promemoria / Alert
function AggiungiPromemoria() {
    var msg = prompt("Testo del promemoria per questo cliente:");
    if (msg) {
        var badge = document.getElementById('lblReminderBadge');
        if (badge) {
            var curr = parseInt(badge.innerText || "0");
            badge.innerText = (curr + 1);
            badge.style.display = "inline-block";
            // Aggiungiamo animazione pulse al bottone
            document.getElementById('btnReminder').style.animation = "pulse 1s infinite";
        }
        if (typeof UXPremium !== 'undefined') UXPremium.ShowToast("Promemoria impostato con successo!", "success");
        RegistraInterazione('salvataggio', "Aggiunto promemoria: " + msg);
    }
}

// 7. Sintesi Vocale
function LeggiSchedaVocale() {
    var nome = document.getElementById('txtCognomeNome') ? document.getElementById('txtCognomeNome').value : "";
    var indirizzo = document.getElementById('txtResidenza') ? document.getElementById('txtResidenza').value : "";
    var comune = document.getElementById('cmbLocalita') ? document.getElementById('cmbLocalita').value : "";
    var stato = document.getElementById('lblStatoBadge') ? document.getElementById('lblStatoBadge').innerText : "";
    
    var testo = "Scheda cliente di " + (nome || "Nome non specificato") + ". " +
                "Indirizzo: " + (indirizzo || "Non specificato") + " a " + (comune || "Comune non specificato") + ". " +
                "Stato invalidità: " + stato;
                
    try {
        var SAPI = new ActiveXObject("SAPI.SpVoice");
        // Imposta una velocità e volume ottimali
        SAPI.Rate = 0;
        SAPI.Volume = 100;
        // Riproduzione asincrona
        SAPI.Speak(testo, 1);
        if (typeof UXPremium !== 'undefined') UXPremium.ShowToast("Lettura vocale in corso...", "info");
    } catch(e) {
        console.error("Errore Sintesi Vocale. Verifica che SAPI sia supportato.", e);
        alert("Lettura Scheda:\n\n" + testo);
    }
}

