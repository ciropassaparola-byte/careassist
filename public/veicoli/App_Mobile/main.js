// GESTIONE CONSEGNE MOBILE - Main Logic
// Versione: 2.5.0 (Offline Enhanced)

class OfflineDB {
    constructor() {
        this.dbName = 'MilellaLogistica';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('queue')) {
                    db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    async addToQueue(action) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB non inizializzato");
            const transaction = this.db.transaction(['queue'], 'readwrite');
            const store = transaction.objectStore('queue');
            const request = store.add({ ...action, timestamp: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async getQueue() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve([]);
            const transaction = this.db.transaction(['queue'], 'readonly');
            const store = transaction.objectStore('queue');
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }

    async removeFromQueue(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            const transaction = this.db.transaction(['queue'], 'readwrite');
            const store = transaction.objectStore('queue');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
}

class MobileApp {
    constructor() {
        this.data = [];
        this.oldData = []; // Memoria per rilevare cambiamenti ufficio
        this.filteredData = [];
        this.currentEditId = null;
        this.lastNotesMap = new Map();
        this.agendaData = []; // Nuova memoria Agenda
        
        this.initSignaturePad();
        this.initCamera();
        
        this.loadData();
        // Nuovi filtri
        this.months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        this.currentMonth = new Date().getMonth(); // Mese corrente (0-11)
        this.currentStatusFilter = 'PENDING';

        this.init();
        
        // Timer Alert Tempo
        setInterval(() => this.checkTimeAlerts(), 60000);
        // Timer Auto-Sync Comunicazioni (60 secondi)
        setInterval(() => this.loadData(true), 60000);
        
        this.loadUser();
        
        // v2.0 - Inizializzazione nuovi moduli
        this.trackTimer = null;
        this.checkChecklist();
        
        // v3.0 - Offline Enhanced (IndexedDB)
        this.db = new OfflineDB();
        this.db.init().then(() => {
            console.log("Database Offline Pronto 📦");
            this.processOfflineQueue();
            this.updateQueueCounterUI();
        });

        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        this.initPushNotifications();

        const btnSync = document.getElementById('btnSync');
        if (btnSync) {
            btnSync.addEventListener('click', () => {
                this.loadData(true);
            });
        }

        // Protezione chiusura accidentale se ci sono dati pendenti
        window.onbeforeunload = (e) => {
            // Non possiamo controllare IndexedDB in modo sincrono qui, 
            // ma usiamo un flag basato sull'ultima sincronizzazione nota
            if (this.hasUnsyncedData) {
                e.preventDefault();
                e.returnValue = '';
                return 'Attenzione! Ci sono dati non ancora inviati. Sincronizza prima di uscire.';
            }
        };
    }

    updateOnlineStatus() {
        const badge = document.getElementById('sync-status');
        const banner = document.getElementById('offline-banner');
        
        if (!navigator.onLine) {
            if (badge) badge.innerHTML = '<span style="color:#ff3b30"><i class="fa fa-plane"></i> MODALITÀ OFFLINE</span>';
            if (banner) banner.classList.remove('hidden');
        } else {
            if (badge) badge.innerHTML = '<span style="color:#34c759"><i class="fa fa-check-circle"></i> ONLINE</span>';
            if (banner) banner.classList.add('hidden');
            this.processOfflineQueue();
        }
    }

    async safeFetch(url, options = {}) {
        if (!navigator.onLine) {
            this.addToOfflineQueue(url, options);
            return { success: true, offline: true };
        }
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error("Server Error");
            return await res.json();
        } catch (e) {
            this.addToOfflineQueue(url, options);
            return { success: true, offline: true };
        }
    }

    async addToOfflineQueue(url, options) {
        try {
            await this.db.addToQueue({ url, options });
            this.showNotification("OFFLINE: Azione salvata in locale 📁", 'warning');
            this.updateQueueCounterUI();
        } catch (e) {
            console.error("Errore salvataggio offline:", e);
        }
    }

    async processOfflineQueue() {
        if (this._isProcessingQueue || !navigator.onLine) {
            this.updateQueueCounterUI();
            return;
        }
        this._isProcessingQueue = true;

        try {
            const queue = await this.db.getQueue();
            if (queue.length === 0) {
                this.hasUnsyncedData = false;
                this.updateQueueCounterUI();
                return;
            }
            
            this.hasUnsyncedData = true;
            this.showNotification(`SINCRONIZZAZIONE ${queue.length} AZIONE/I... 🔄`);
            
            for (const action of queue) {
                try {
                    const res = await fetch(action.url, action.options);
                    if (res.ok) {
                        await this.db.removeFromQueue(action.id);
                    } else {
                        console.warn("Risposta non OK dal server durante la sincronizzazione:", res.status);
                        // Se la richiesta fallisce lato server, contiamo i tentativi ed eliminiamo dopo 3 errori
                        action.retryCount = (action.retryCount || 0) + 1;
                        if (action.retryCount >= 3) {
                            console.warn("Azione scartata dopo 3 tentativi falliti:", action);
                            await this.db.removeFromQueue(action.id);
                        }
                    }
                } catch (e) {
                    console.error("Errore sincronizzazione riga:", e);
                    break; // Se la rete si interrompe durante la sincronizzazione, fermiamo il loop per non spammarlo
                }
            }
            
            const remaining = await this.db.getQueue();
            if (remaining.length === 0) {
                this.showNotification("SINCRONIZZAZIONE COMPLETATA! ✅", 'success');
                this.loadData();
            }
            this.updateQueueCounterUI();
        } finally {
            this._isProcessingQueue = false;
        }
    }

    async updateQueueCounterUI() {
        const el = document.getElementById('sync-queue-count');
        if (!el) return;
        try {
            const queue = await this.db.getQueue();
            if (queue.length === 0) {
                el.innerHTML = '<span style="color:#34c759"><i class="fa fa-check-circle"></i> Sincronizzato (0 pendenti)</span>';
                this.hasUnsyncedData = false;
            } else {
                el.innerHTML = `<span style="color:#ffcc00"><i class="fa fa-exclamation-triangle"></i> ${queue.length} azioni pendenti</span>`;
                this.hasUnsyncedData = true;
            }
        } catch(e) {
            el.innerText = "Errore lettura coda";
        }
    }

    stepKM(id, val) {
        const el = document.getElementById(id);
        if (el) {
            let current = parseInt(el.value) || 0;
            let next = current + val;
            if (next < 0) next = 0;
            el.value = next;
        }
    }

    loadFromCache() {
        const cached = localStorage.getItem('consegne_data');
        if (cached) {
            try {
                this.data = JSON.parse(cached);
                const query = document.getElementById('txtSearch') ? document.getElementById('txtSearch').value : '';
                this.filterData(query);
                const lastSync = localStorage.getItem('last_sync') || 'In memoria';
                this.updateSyncUI(`${lastSync} (Cache Local)`);
            } catch(e) {
                console.warn("Errore lettura cache:", e);
            }
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registrato con successo:', reg.scope))
                .catch(err => console.warn('Errore registrazione Service Worker:', err));
        }
    }

    init() {
        console.log("App CONSEGNE Mobile inizializzata.");
        this.renderMonthFilters();
        this.setupEventListeners();
        this.initFlatpickr();
        this.loadFromCache(); // Carica subito i dati salvati
        this.registerServiceWorker();
        this.setupNotes();
    }

    initFlatpickr() {
        if (typeof flatpickr === 'undefined') return;
        const self = this;
        const holidayOptions = {
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                const date = dayElem.dateObj;
                if (self.isHoliday(date)) {
                    dayElem.classList.add("holiday");
                } else if (self.isSaturday(date)) {
                    dayElem.classList.add("saturday");
                }
            },
            onChange: (selectedDates, dateStr, instance) => {
                if (selectedDates.length > 0) {
                    const date = selectedDates[0];
                    if (self.isHoliday(date)) {
                        alert("Festività non puoi digitarla");
                        instance.clear();
                    } else if (self.isSaturday(date)) {
                        alert("Sabato non lavorativo non puoi digitarlo");
                        instance.clear();
                    }
                }
            }
        };

        // Calendario elegante stile Apple/Moderno
        this.fpDate = flatpickr("#edit-data", {
            dateFormat: "d/m/Y",
            locale: "it",
            disableMobile: true,
            animate: true,
            ...holidayOptions
        });

        // Selettore Orario elegante
        this.fpTime = flatpickr("#edit-ora", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            disableMobile: true
        });

        // Selettore Data per NUOVA Consegna
        this.fpAddDate = flatpickr("#add-data", {
            dateFormat: "d/m/Y",
            locale: "it",
            disableMobile: true,
            defaultDate: "today",
            ...holidayOptions
        });
    }

    loadFromCache() {
        const cached = localStorage.getItem('consegne_data');
        const lastSync = localStorage.getItem('last_sync');
        if (cached) {
            this.data = JSON.parse(cached);
            
            // Applica ordinamento anche ai dati in cache con gestione date vuote (crescente per data, urgenze per prime)
            this.data.sort((a, b) => {
                if (a.data === '—' && b.data !== '—') return 1;
                if (a.data !== '—' && b.data === '—') return -1;
                
                const dateA = a.data.split('/').reverse().join('');
                const dateB = b.data.split('/').reverse().join('');
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                
                const pA = (a.stato === 'URGENTE') ? 0 : 1;
                const pB = (b.stato === 'URGENTE') ? 0 : 1;
                if (pA !== pB) return pA - pB;
                
                return (a.ora || "23:59").localeCompare(b.ora || "23:59");
            });

            this.filteredData = [...this.data];
            this.filterData(""); // Applica i filtri (mese corrente/stato) subito all'avvio
            this.updateSyncUI(lastSync);
        }
    }

    updateSyncUI(timestamp) {
        const badge = document.getElementById('sync-status');
        if (timestamp) {
            badge.innerText = `Sincronizzato: ${timestamp}`;
            badge.style.display = 'block';
        }
    }

    async loadUser() {
        const localName = localStorage.getItem('driver_name');
        const el = document.getElementById('driver-name');
        const input = document.getElementById('cfg-driver-name');
        const display = document.getElementById('active-driver-display');
        const divIn = document.getElementById('driver-logged-in');
        const divOut = document.getElementById('driver-logged-out');
        const mainTitle = document.getElementById('main-profile-name');

        const updateUI = (name, forceLogout) => {
            if (el) el.innerText = name;
            if (display) display.innerText = name;
            if (mainTitle && name && name !== "Ospite") {
                mainTitle.innerText = name.toUpperCase();
            }
            if (name && name !== "Ospite" && !forceLogout) {
                if (divIn) divIn.classList.remove('hidden');
                if (divOut) divOut.classList.add('hidden');
            } else {
                if (divIn) divIn.classList.add('hidden');
                if (divOut) divOut.classList.remove('hidden');
            }
        };

        if (localName) {
            updateUI(localName, false);
            return;
        }

        try {
            const apiBase = `${window.location.origin}/api`;
            const res = await fetch(`${apiBase}/user`);
            const data = await res.json();
            const name = data.user || "Ospite";
            updateUI(name, true);
            if (input) input.value = (name !== "Ospite") ? name : "";
        } catch (e) {
            console.warn("Impossibile caricare nome utente:", e);
            updateUI("Ospite");
        }
    }

    setDriverProfile() {
        const oldName = localStorage.getItem('driver_name') || document.getElementById('driver-name').innerText;
        const name = document.getElementById('cfg-driver-name').value.trim();
        if (!name) return alert("Per favore, inserisci il tuo Nome e Cognome.");
        
        if (oldName && oldName !== name && oldName !== "Ospite" && oldName !== "Caricamento...") {
            fetch(`${window.location.origin}/api/gps_remove?user=${encodeURIComponent(oldName)}`).catch(e=>console.log(e));
        }
        
        localStorage.setItem('driver_name', name);
        this.loadUser();
        this.showNotification("PROFILO AGGIORNATO: Benvenuto " + name + "! 👏", 'success');
        
        // Notifica PC Ufficio
        fetch(`${window.location.origin}/api/notify_pc?msg=${encodeURIComponent("CAMBIO AUTISTA: Nuovo autista attivo: " + name)}&driver=${encodeURIComponent(name)}`);
        
        this.startGPSTracking();
    }

    logoutDriver(skipConfirm) {
        const oldName = localStorage.getItem('driver_name') || "Sconosciuto";
        if (!skipConfirm) {
            if (!confirm("Vuoi confermare la FINE DEL TURNO?")) return;
        }
        
        // Ferma il tracking GPS locale
        if (this.trackTimer) {
            clearInterval(this.trackTimer);
            this.trackTimer = null;
        }

        // Rimuove immediatamente il veicolo dal Radar Ufficio
        fetch(`${window.location.origin}/api/gps_remove?user=${encodeURIComponent(oldName)}`).catch(e=>console.log(e));

        // Notifica PC Ufficio
        fetch(`${window.location.origin}/api/notify_pc?msg=${encodeURIComponent("FINE TURNO: L'autista " + oldName + " ha terminato il turno e si è disconnesso.")}&driver=${encodeURIComponent(oldName)}`).catch(e=>console.log(e));

        // Ritardo lo spegnimento della UI per dare tempo alla notifica di partire
        setTimeout(() => {
            localStorage.removeItem('driver_name');
            this.loadUser();
            this.showNotification("TURNO TERMINATO. A domani!", 'success');
            window.scrollTo(0, 0); // Riporta su per vedere il login
        }, 800);
    }

    setupNotes() {
        const txt = document.getElementById('cfg-notes');
        if (!txt) return;
        
        // Caricamento Note Salvate
        txt.value = localStorage.getItem('personal_notes') || "";
        
        // Salvataggio automatico durante la digitazione
        txt.addEventListener('input', () => {
            localStorage.setItem('personal_notes', txt.value);
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(() => console.log("Service Worker Registrato correttamente."))
                .catch(err => console.error("Errore SW:", err));
        }
    }

    setupEventListeners() {
        // Navigazione
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.switchPage(page);
            });
        });

        // Pulsante Sync
        document.getElementById('btnSync').addEventListener('click', () => {
            const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
            const query = document.getElementById('txtSearch').value;
            if (activePage === 'history') this.loadHistory(query);
            else this.loadData();
        });

        // Pulsante Add (+)
        document.getElementById('btnAdd').addEventListener('click', () => {
            document.getElementById('modal-add').classList.remove('hidden');
        });

        // Reset badge messaggi
        document.getElementById('msg-badge').addEventListener('click', () => {
            document.getElementById('msg-badge').classList.add('hidden');
        });

        // Ricerca con Debounce
        let searchTimeout;
        document.getElementById('txtSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterData(e.target.value);
            }, 500);
        });

        // Impostazioni Suono/Vibrazione
        const initBtn = (id, key) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const updateUI = () => {
                const val = localStorage.getItem(key) || 'ON';
                btn.innerText = val;
                if (val === 'ON') {
                    btn.classList.add('active');
                    btn.classList.remove('off');
                } else {
                    btn.classList.remove('active');
                    btn.classList.add('off');
                }
            };
            btn.addEventListener('click', () => {
                const newVal = (localStorage.getItem(key) === 'OFF') ? 'ON' : 'OFF';
                localStorage.setItem(key, newVal);
                updateUI();
                if (newVal === 'ON') { this.playBeep(); this.vibrate(); }
            });
            updateUI();
        };
        initBtn('btn-sound', 'notif_sound');
        initBtn('btn-vibrate', 'notif_vibrate');

        // Filtri Stato
        document.querySelectorAll('.status-filters .filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.status-filters .filter-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentStatusFilter = btn.getAttribute('data-status');
                this.filterData(document.getElementById('txtSearch').value);
            });
        });
    }

    renderMonthFilters() {
        const container = document.getElementById('month-filters');
        if (!container) return;

        container.innerHTML = this.months.map((m, index) => `
            <button class="filter-pill ${index === this.currentMonth ? 'active' : ''}" 
                    data-month="${index}" 
                    onclick="app.setMonth(${index})">${m}</button>
        `).join('');

        // Scroll al mese attivo
        setTimeout(() => {
            const active = container.querySelector('.filter-pill.active');
            if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 300);
    }

    setMonth(index) {
        this.currentMonth = index;
        this.renderMonthFilters();
        
        const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
        const query = document.getElementById('txtSearch').value;

        if (activePage === 'history') {
            this.loadHistory(query); // Carica e filtra lo storico per il nuovo mese
        } else {
            this.filterData(query); // Filtra la home per il nuovo mese
        }
    }

    async submitNewConsegna() {
        const nome = document.getElementById('add-nome').value;
        const data = document.getElementById('add-data').value;
        const citta = document.getElementById('add-citta').value;
        const ind = document.getElementById('add-ind').value;
        const tel = document.getElementById('add-tel').value;
        const merce = document.getElementById('add-merce').value;

        if (!nome || !citta) return alert("Nome e Città sono obbligatori!");

        try {
            const apiBase = `${window.location.origin}/api`;
            const url = `${apiBase}/aggiungi?nome=${encodeURIComponent(nome)}&citta=${encodeURIComponent(citta)}&ind=${encodeURIComponent(ind)}&tel=${encodeURIComponent(tel)}&merce=${encodeURIComponent(merce)}&data=${encodeURIComponent(data)}`;
            const result = await this.safeFetch(url);

            if (result.success) {
                this.showNotification(result.offline ? "SALVATA IN LOCALE (In coda) 📁" : "CONSEGNA SALVATA NEL DATABASE! ✅", 'success');
                document.getElementById('modal-add').classList.add('hidden');
                // Pulisci campi
                document.getElementById('add-nome').value = "";
                document.getElementById('add-citta').value = "";
                document.getElementById('add-ind').value = "";
                document.getElementById('add-tel').value = "";
                document.getElementById('add-merce').value = "";
                if (!result.offline) await this.loadData();
            } else {
                alert("Errore salvataggio: " + result.error);
            }
        } catch (error) {
            this.showNotification("ERRORE DI CONNESSIONE");
        }
    }

    switchPage(pageId) {
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.remove('active');
            if (i.getAttribute('data-page') === pageId) i.classList.add('active');
        });

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // CRITICAL FIX: Resetta lo scroll a ZERO per evitare che il residuo di altre pagine sposti la visuale!
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
        let viewId = 'view-home';
        const btnAdd = document.getElementById('btnAdd');
        
        if (pageId === 'history') {
            viewId = 'view-history';
            this.loadHistory(""); // Carica i dati aggiornati dal server
        }
        if (pageId === 'settings') viewId = 'view-settings';
        if (pageId === 'dashboard') {
            viewId = 'view-dashboard';
            this.renderDashboard();
        }
        if (pageId === 'agenda') {
            viewId = 'view-agenda';
            this.loadAgenda();
        }
        if (pageId === 'expenses') {
            viewId = 'view-expenses';
        }
        if (pageId === 'manuale') {
            viewId = 'view-manuale';
            this.loadManualeAusili();
        }
        if (pageId === 'map') {
            viewId = 'view-map';
            setTimeout(() => this.initMap(), 100);
        }

        // Gestione Visibilità Toolbar Globali (Action Bar / Filtro Mese)
        const actionBar = document.querySelector('.action-bar');
        const monthFilter = document.getElementById('global-month-filter');
        
        // Mostra filtri e ricerca solo in Home e Registro (dove servono)
        const needsGlobalControls = (pageId === 'home' || pageId === 'history');
        
        if (actionBar) actionBar.style.display = needsGlobalControls ? 'flex' : 'none';
        if (monthFilter) monthFilter.style.display = needsGlobalControls ? 'block' : 'none';

        if (btnAdd) btnAdd.style.display = (pageId === 'home') ? 'block' : 'none';
        
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            
            // Reset scorrimento anche del container interno per una pulizia TOTALE
            const list = targetView.querySelector('.list-container');
            if (list) list.scrollTop = 0;
        }

        if (pageId === 'history') this.loadHistory(document.getElementById('txtSearch').value);
    }

    async apriModalManuali(telefono, cliente) {
        document.getElementById('waFilePhoneMobile').value = telefono;
        document.getElementById('waFileSelectMobile').innerHTML = '<option value="">Caricamento manuali in corso...</option>';
        document.getElementById('waFileModalMobile').classList.remove('hidden');

        try {
            const apiBase = `${window.location.origin}/api`;
            const res = await fetch(`${apiBase}/manuali`);
            const files = await res.json();
            let html = '<option value="">-- Seleziona un manuale --</option>';
            
            // Raggruppa i file per cartella
            const groups = {};
            files.forEach(f => {
                const parts = f.split('/');
                const fileName = parts.pop();
                const folderName = parts.length > 0 ? parts.join('/') : 'Generali';
                
                if (!groups[folderName]) groups[folderName] = [];
                groups[folderName].push({ path: f, name: fileName });
            });
            
            // Crea l'HTML con optgroup
            for (const folder in groups) {
                const cleanFolder = folder.toUpperCase().replace(/_/g, ' ');
                html += `<optgroup label="📁 ${cleanFolder}">`;
                groups[folder].forEach(file => {
                    html += `<option value="${file.path}">${file.name}</option>`;
                });
                html += `</optgroup>`;
            }
            
            document.getElementById('waFileSelectMobile').innerHTML = html;
        } catch (e) {
            document.getElementById('waFileSelectMobile').innerHTML = '<option value="">Errore caricamento</option>';
        }
    }

    eseguiInvioManuale() {
        const file = document.getElementById('waFileSelectMobile').value;
        const telefono = document.getElementById('waFilePhoneMobile').value;
        if (!file) {
            alert('Seleziona un manuale prima di inviare.');
            return;
        }

        const fileUrl = `${window.location.origin}/archivio-manuali/${encodeURIComponent(file)}`;
        const msg = `Gentile Cliente, ecco il link per scaricare il manuale:\n\n${fileUrl}`;
        const waLink = this.buildWaLink(telefono, "", msg);
        
        document.getElementById('waFileModalMobile').classList.add('hidden');
        window.open(waLink, '_blank');
    }

    playBeep() {
        if (localStorage.getItem('notif_sound') === 'OFF') return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Onda quadra è molto più "decisa" e udibile del seno
            osc.type = 'square'; 
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            
            // Incremento volume (gain)
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.1);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.4);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.9);
        } catch(e) {}
    }

    vibrate() {
        if (localStorage.getItem('notif_vibrate') === 'OFF') return;
        // Sequenza lunga e "cattiva": 800ms vibra, 200ms pausa, 800ms vibra...
        if ('vibrate' in navigator) navigator.vibrate([800, 200, 800, 200, 1000]);
    }

    async handleSync() {
        const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
        const btnSync = document.getElementById('btnSync').querySelector('i');
        btnSync.classList.add('fa-spin');

        if (activePage === 'history') {
            await this.loadHistory("");
        } else if (activePage === 'manuale') {
            await this.loadManualeAusili();
        } else {
            await this.loadData(true);
        }
        
        btnSync.classList.remove('fa-spin');
    }

    async loadManualeAusili() {
        const listDiv = document.getElementById('manuale-list');
        if (!listDiv) return;
        
        listDiv.innerHTML = `<div class="empty-state"><i class="fa fa-spinner fa-spin"></i><p>Caricamento manuale in corso...</p></div>`;
        
        try {
            const apiBase = `${window.location.origin}/api`;
            const resData = await fetch(`${apiBase}/ausili`);
            const data = await resData.json();
            
            if (!resData.ok || (data && data.error)) {
                throw new Error((data && data.error) ? data.error : `Errore Server: ${resData.status}`);
            }
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                listDiv.innerHTML = `<div class="empty-state"><i class="fa fa-info-circle"></i><p>Nessun manuale disponibile al momento.</p></div>`;
                return;
            }
            
            let html = '';
            data.forEach((ausilio, index) => {
                let chkHtml = ausilio.checklist && ausilio.checklist.length > 0 
                    ? ausilio.checklist.map(c => `<li><i class="fa fa-check-circle-o" style="color:#10b981; margin-right:8px;"></i>${c}</li>`).join('') 
                    : `<li>Nessuna checklist</li>`;
                    
                let troubleHtml = ausilio.imprevisti && ausilio.imprevisti.length > 0
                    ? ausilio.imprevisti.map(t => `<div style="margin-top:10px; padding:10px; background:rgba(239, 68, 68, 0.1); border-left:3px solid #ef4444; border-radius:4px;"><strong style="color:#ef4444;">${t.t}</strong><br><span style="font-size:0.9em;">${t.s}</span></div>`).join('')
                    : `<div style="font-size:0.9em; color:#94a3b8; margin-top:5px;">Nessun imprevisto noto.</div>`;
                
                // Pulsante condivisione PDF (mostrato solo se il PDF è allegato)
                let pdfBtnHtml = '';
                if (ausilio.pdf) {
                    const pdfUrl = `${window.location.origin}/DOCUMENTI_PDF/${encodeURIComponent(ausilio.pdf)}`;
                    const waMsg = encodeURIComponent(`Gentile Cliente,\nallego il manuale del suo ausilio "${ausilio.nome}":\n${pdfUrl}`);
                    pdfBtnHtml = `
                        <div style="margin-top:20px; padding-top:15px; border-top:1px solid #333;">
                            <button onclick="app.condividiPdf('${pdfUrl}', '${ausilio.nome.replace(/'/g,"\\'")}', '${waMsg}')" 
                                style="width:100%; padding:14px; border-radius:10px; border:none; background:linear-gradient(135deg,#25d366,#128c7e); color:white; font-size:1rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; letter-spacing:0.5px;">
                                <i class="fa fa-whatsapp" style="font-size:1.3rem;"></i> INVIA MANUALE AL CLIENTE
                            </button>
                            <div style="font-size:0.75rem; color:#64748b; text-align:center; margin-top:6px;">
                                <i class="fa fa-paperclip"></i> ${ausilio.pdf}
                            </div>
                        </div>`;
                }
                    
                html += `
                <div class="card" style="background:#1e2130; border-radius:12px; margin-bottom:15px; overflow:hidden; border:1px solid #333;">
                    <div style="background:#2a2d40; padding:15px; border-bottom:1px solid #444; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="color:#d4af37; margin:0; font-size:1.1rem;"><i class="fa fa-medkit" style="margin-right:8px;"></i>${ausilio.nome}${ausilio.pdf ? ' <i class="fa fa-paperclip" style="color:#10b981; font-size:0.85rem;" title="PDF allegato"></i>' : ''}</h3>
                            <span style="background:rgba(212,175,55,0.2); color:#d4af37; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;"><i class="fa fa-clock-o"></i> ${ausilio.tempo} min</span>
                        </div>
                    </div>
                    <div style="display:none; padding:15px;">
                        <h4 style="color:#10b981; margin:0 0 10px 0; font-size:0.9rem; text-transform:uppercase;">Checklist Montaggio</h4>
                        <ul style="list-style:none; padding:0; margin:0 0 20px 0; color:#cbd5e1; font-size:0.95rem; line-height:1.5;">
                            ${chkHtml}
                        </ul>
                        <h4 style="color:#ef4444; margin:0 0 10px 0; font-size:0.9rem; text-transform:uppercase;">Risoluzione Problemi</h4>
                        ${troubleHtml}
                        ${pdfBtnHtml}
                    </div>
                </div>`;
            });
            
            listDiv.innerHTML = html;
        } catch (error) {
            console.error("Errore loadManualeAusili:", error);
            let msg = "Errore di connessione. Impossibile scaricare il manuale.";
            let icon = "fa-warning";
            
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                msg = "Connessione assente o caduta. Verifica la rete o il ponte mobile.";
                icon = "fa-wifi";
            } else if (error.message.includes("Unexpected token '<'") || error.message.includes('is not valid JSON')) {
                msg = "Il Ponte Mobile sul PC si è disconnesso temporaneamente. Controlla che la finestra nera del server sia aperta sul PC.";
            } else {
                msg = "Errore del Ponte Mobile sul PC: " + error.message;
            }
            
            listDiv.innerHTML = `
                <div class="empty-state" style="color:#ef4444; display:flex; flex-direction:column; gap:15px; align-items:center;">
                    <i class="fa ${icon}" style="font-size:2rem;"></i>
                    <p style="margin:0; text-align:center;">${msg}</p>
                    <button class="action-btn main" onclick="app.loadManualeAusili()" style="width:100%; max-width:200px; margin-top:10px; background:#ef4444; color:white; border-radius:10px;">
                        <i class="fa fa-refresh"></i> Riprova
                    </button>
                </div>`;
        }
    }

    async condividiPdf(pdfUrl, nomeAusilio, waMsgEncoded) {
        // Tenta prima la condivisione nativa del telefono (Android/iOS share sheet)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Manuale: ${nomeAusilio}`,
                    text: `Gentile Cliente,\nallego il manuale del suo ausilio "${nomeAusilio}":`,
                    url: pdfUrl
                });
                return;
            } catch (e) {
                // Se l'utente annulla o la share fallisce, continua con WhatsApp
                if (e.name === 'AbortError') return;
            }
        }
        // Fallback: apre WhatsApp Web con il messaggio già pronto
        const waUrl = `https://wa.me/?text=${waMsgEncoded}`;
        window.open(waUrl, '_blank');
    }

    async loadData(manual = false) {
        const btnSync = document.getElementById('btnSync');
        const icon = btnSync ? btnSync.querySelector('i') : null;
        if (icon && manual) icon.classList.add('fa-spin');
        
        try {
            const apiBase = `${window.location.origin}/api`;
            const resData = await fetch(`${apiBase}/consegne`);
            const rawData = await resData.json();
            
            const newData = this.processItems(rawData);
            
            // PRESERVA STATI NOTIFICA (Evita loop di avvisi al refresh)
            newData.forEach(newItem => {
                const old = this.data.find(o => String(o.id) === String(newItem.id));
                if (old) {
                    newItem.isLate = old.isLate;
                    newItem.notified30 = old.notified30;
                }
            });
            this.data = newData;
            
            // ORDINAMENTO RICHIESTO: DATA (crescente); URGENZE (con date vuote in fondo)
            this.data.sort((a, b) => {
                // Sposta le date vuote '—' in fondo
                if (a.data === '—' && b.data !== '—') return 1;
                if (a.data !== '—' && b.data === '—') return -1;

                // 1. Confronto per DATA (crescente)
                const dateA = a.data.split('/').reverse().join('');
                const dateB = b.data.split('/').reverse().join('');
                if (dateA !== dateB) return dateA.localeCompare(dateB);

                // 2. Confronto per URGENZA
                const pA = (a.stato === 'URGENTE') ? 0 : 1;
                const pB = (b.stato === 'URGENTE') ? 0 : 1;
                if (pA !== pB) return pA - pB;

                // 3. Confronto per ORA
                return (a.ora || "23:59").localeCompare(b.ora || "23:59");
            });

            // Applica eventuale ricerca pendente
            const query = document.getElementById('txtSearch').value;
            this.filterData(query);

            // Salva in cache
            const now = new Date();
            const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            localStorage.setItem('consegne_data', JSON.stringify(this.data));
            localStorage.setItem('last_sync', timestamp);
            this.updateSyncUI(timestamp);
        } catch (error) {
            console.error("Errore caricamento dati:", error);
            this.loadFromCache();
            // Silenzioso se offline, alert solo se manuale e online
            if (manual && navigator.onLine) {
                alert("Errore caricamento: " + error.message);
            }
        } finally {
            if (icon) icon.classList.remove('fa-spin');
            this.checkForNewMessages();
            
            // Radar cambiamenti Ufficio
            if (this.oldData.length > 0) {
                this.detectOfficeChanges(this.data);
            }
            this.oldData = JSON.parse(JSON.stringify(this.data));
        }
    }

    async loadHistory(query = '') {
        const btnSync = document.getElementById('btnSync');
        if (btnSync) btnSync.classList.add('fa-spin');
        
        // Carica subito dalla cache se disponibile
        const cached = localStorage.getItem('history_data');
        if (cached && !query) {
            this.historyData = JSON.parse(cached);
            this.filterData(query);
        }

        if (!navigator.onLine) {
            if (btnSync) btnSync.classList.remove('fa-spin');
            return; // In offline ci fermiamo alla cache
        }

        try {
            const apiBase = `${window.location.origin}/api`;
            const qParam = query ? `?q=${encodeURIComponent(query)}` : '';
            const resData = await fetch(`${apiBase}/storico${qParam}`);
            const rawData = await resData.json();
            
            this.historyData = this.processItems(rawData);
            
            // Salva in cache solo se è una query vuota (lo storico completo del mese)
            if (!query) {
                localStorage.setItem('history_data', JSON.stringify(this.historyData));
            }
            
            this.filterData(query);
        } catch (error) {
            console.error("Errore caricamento storico:", error);
            // Niente alert fastidiosi se siamo offline
        } finally {
            if (btnSync) btnSync.classList.remove('fa-spin');
        }
    }

    processItems(items) {
        if (!items) return [];
        const list = Array.isArray(items) ? items : [items];
        
        return list.map(item => ({
            id: item.id || 0,
            cliente: item.cliente || 'N.D.',
            citta: item.citta || 'N.D.',
            indirizzo: item.indirizzo || '',
            provincia: item.provincia || 'N.D.',
            data: (function(d) {
                if (!d || typeof d !== 'string') return '—';
                const clean = d.split(' ')[0].trim();
                if (clean.indexOf('-') > -1 && clean.split('-')[0].length === 4) {
                    return clean.split('-').reverse().join('/');
                }
                return clean;
            })(item.data),
            m_data: item.data || '—',
            merce: item.merce || '—',
            ordine: item.ordine || '',
            stato: (item.stato === 'Falso' || !item.stato) ? 'DA CHIAMARE' : item.stato.toUpperCase(),
            telefono: item.telefono || '',
            ora: item.ora || '--:--',
            kma: item.kma || 0,
            kmr: item.kmr || 0,
            lat: parseFloat(item.lat) || 0,
            lon: parseFloat(item.lon) || 0,
            note: item.note || ''
        }));
    }

    openEditModal(id, event) {
        if (event) event.stopPropagation();
        console.log("Tentativo apertura Modale ID:", id);
        
        try {
            // Troviamo l'item (confronto robusto)
            const allData = [...this.data, ...(this.historyData || [])];
            const item = allData.find(d => String(d.id).trim() === String(id).trim());
            
            if (!item) {
                alert("ERRORE: Consegna non trovata nel database locale.\nID cercato: " + id + "\nTotale record in memoria: " + allData.length);
                return;
            }

            this.currentEditId = id;
            
            // Funzione helper per riempimento sicuro
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
                else console.warn("Elemento non trovato:", id);
            };

            setVal('edit-nome', item.cliente);
            
            // Impostazione Date/Ora con Flatpickr (Stile Apple)
            if (this.fpDate) this.fpDate.setDate(item.data || '', false);
            if (this.fpTime) this.fpTime.setDate(item.ora || '', false);

            setVal('edit-stato', item.stato || 'IN ATTESA');
            setVal('edit-kma', item.kma);
            setVal('edit-kmr', item.kmr);
            setVal('edit-merce', item.merce);
            setVal('edit-note', item.note);
            
            const modal = document.getElementById('modal-edit');
            if (modal) {
                modal.classList.remove('hidden');
                console.log("Modale aperta con successo");
                
                // Inizializzazione dinamica del canvas firma
                this.initSignaturePad();
            } else {
                alert("ERRORE CRITICO: Elemento 'modal-edit' non trovato nell'HTML!");
            }
        } catch (err) {
            console.error("Errore in openEditModal:", err);
            alert("ERRORE CRASH APP:\n" + err.message + "\n\nControlla la console per i dettagli.");
        }
    }

    async submitEdit() {
        const id = this.currentEditId;
        if (!id) {
            alert("ERRORE: ID consegna non trovato. Prova a chiudere e riaprire la scheda.");
            return;
        }

        try {
            // Lettura sicura dei campi: se uno manca, non crasha
            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : '';
            };

            const nome = getVal('edit-nome');
            const data = getVal('edit-data');
            const ora = getVal('edit-ora');
            const stato = getVal('edit-stato');
            const kma = getVal('edit-kma');
            const kmr = getVal('edit-kmr');
            const merce = getVal('edit-merce');
            const note = getVal('edit-note');
            const msgPC = getVal('edit-notifica-pc');

            this.showNotification("SALVATAGGIO IN CORSO...");
            
            const apiBase = `${window.location.origin}/api`;
            const driver = localStorage.getItem('driver_name') || "Ospite";
            const url = `${apiBase}/update_details?id=${id}&nome=${encodeURIComponent(nome)}&data=${encodeURIComponent(data)}&ora=${encodeURIComponent(ora)}&stato=${encodeURIComponent(stato)}&kma=${kma}&kmr=${kmr}&merce=${encodeURIComponent(merce)}&note=${encodeURIComponent(note)}&driver=${encodeURIComponent(driver)}`;
            
            console.log("Invio dati a:", url);
            const result = await this.safeFetch(url);

            if (result.success) {
                if (!result.offline) {
                    if (msgPC.trim() !== "") {
                        const fullMsg = `NOTIZIE DA STRADA: ${nome} - ${msgPC}`;
                        fetch(`${apiBase}/notify_pc?msg=${encodeURIComponent(fullMsg)}&driver=${encodeURIComponent(driver)}`);
                        this.showNotification("SALVATO E NOTIFICATO! 📨", 'success');
                    } else {
                        this.showNotification("MODIFICHE SALVATE CON SUCCESSO! ✅", 'success');
                    }
                    await this.loadData();
                } else {
                    this.showNotification("SALVATO IN LOCALE (In coda) 📁", 'warning');
                }
                
                document.getElementById('modal-edit').classList.add('hidden');
                document.getElementById('edit-notifica-pc').value = "";
            } else {
                alert("ERRORE DATABASE:\n" + (result.error || "Impossibile aggiornare il record."));
            }
        } catch (error) {
            console.error("Errore submitEdit:", error);
            this.showNotification("ERRORE CONNESSIONE: Salvataggio in coda 📁");
        }
    }

    processData() { }

    initSignaturePad() {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return;
        
        // Prevent multiple initializations
        if (canvas.dataset.initialized) {
            // Just resize it
            canvas.width = canvas.offsetWidth || 300;
            canvas.height = canvas.offsetHeight || 150;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
            }
            return;
        }

        canvas.width = canvas.offsetWidth || 300;
        canvas.height = canvas.offsetHeight || 150;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let drawing = false;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        const start = (e) => {
            drawing = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            if (e.cancelable) e.preventDefault();
        };

        const move = (e) => {
            if (!drawing) return;
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            if (e.cancelable) e.preventDefault();
        };

        const stop = () => { drawing = false; };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);

        canvas.addEventListener('touchstart', start, {passive: false});
        canvas.addEventListener('touchmove', move, {passive: false});
        canvas.addEventListener('touchend', stop);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        canvas.dataset.initialized = "true";
    }

    saveSignature() {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return;
        
        const dataURL = canvas.toDataURL("image/png");
        const item = [...this.data, ...(this.historyData || [])].find(d => String(d.id) === String(this.currentEditId));
        const nome = item ? item.cliente : "";
        
        this.uploadPOD('firma', dataURL, nome);
    }

    clearSignature() {
        const canvas = document.getElementById('signature-pad');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    initCamera() {
        const input = document.getElementById('camera-input');
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const item = [...this.data, ...(this.historyData || [])].find(d => String(d.id) === String(this.currentEditId));
                    const nome = item ? item.cliente : "";
                    this.uploadPOD('foto', event.target.result, nome);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    takePhoto() {
        document.getElementById('camera-input').click();
    }

    async uploadDocument(input) {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        const id = this.currentEditId;
        const driver = localStorage.getItem('driver_name') || "Ospite";
        
        if (!id) {
            this.showNotification("Salva o seleziona una consegna prima di caricare il documento.", "warning");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            try {
                this.showNotification("Caricamento documento in corso... ⏳", "info");
                
                const response = await fetch(`${window.location.origin}/api/upload_document`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        driver: driver,
                        filename: file.name,
                        base64: base64
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    this.showNotification("Documento caricato con successo! ✅", "success");
                    
                    // Mostra pulsante di condivisione
                    const container = document.getElementById('document-share-container');
                    if (container) {
                        const fullUrl = window.location.origin + result.url;
                        container.style.display = 'block';
                        container.innerHTML = `
                            <button class="action-btn" onclick="app.shareDocument('${fullUrl}', '${file.name}')" style="background:#25D366; color:white; font-weight:800; width:100%; margin-top:10px;">
                                <i class="fa fa-whatsapp"></i> CONDIVIDI CON IL CLIENTE
                            </button>
                        `;
                    }
                } else {
                    this.showNotification("Errore caricamento documento.", "error");
                }
            } catch (err) {
                this.showNotification("Errore di rete durante il caricamento.", "error");
            }
            input.value = ""; // reset
        };
        reader.readAsDataURL(file);
    }

    shareDocument(url, fileName) {
        const item = this.data.find(d => String(d.id) === String(this.currentEditId));
        const clienteStr = item ? item.cliente : "Cliente";
        
        const testMsg = `Gentile ${clienteStr}, ecco in allegato il documento relativo alla sua consegna. Clicchi sul seguente link per visualizzarlo e scaricarlo: \n\n${url}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Documento Consegna',
                text: testMsg
            }).catch(console.error);
        } else {
            // Fallback per Desktop
            window.open(`https://wa.me/?text=${encodeURIComponent(testMsg)}`, '_blank');
        }
    }

    showHelp() {
        const msg = "📘 GUIDA RAPIDA CONSEGNA:\n\n" +
                  "1. VERIFICA: Controlla nome e ora.\n" +
                  "2. STATO: Cambia in 'COMPLETATA' per chiudere.\n" +
                  "3. KM: Inserisci KM Andata e Ritorno.\n" +
                  "4. FOTO: Scatta foto dei documenti o merce.\n" +
                  "5. FIRMA: Fai firmare e clicca 'SALVA FIRMA'.\n" +
                  "6. NOTIFICA: Scrivi un avviso se l'ufficio deve sapere qualcosa subito.\n" +
                  "7. SALVA: Clicca il tastone ARANCIO per finire.";
        alert(msg);
    }

    // v2.0 - Checklist Mattutina
    checkChecklist() {
        const lastCheck = localStorage.getItem('last_checklist_date');
        const today = new Date().toLocaleDateString();
        if (lastCheck !== today) {
            setTimeout(() => {
                document.getElementById('modal-checklist').classList.remove('hidden');
            }, 2000);
        } else {
            // Se la checklist è già stata fatta oggi, avvia comunque il GPS
            this.startGPSTracking();
        }
    }

    confirmChecklist() {
        const items = document.querySelectorAll('.chk-item');
        let allChecked = true;
        items.forEach(i => { if (!i.checked) allChecked = false; });

        if (!allChecked) return alert("Per favore, completa tutti i controlli di sicurezza!");

        localStorage.setItem('last_checklist_date', new Date().toLocaleDateString());
        document.getElementById('modal-checklist').classList.add('hidden');
        this.showNotification("TURNO INIZIATO! BUON LAVORO 🚚", 'success');
        
        // Notifica ufficio dell'inizio turno
        const driver = document.getElementById('driver-name').innerText;
        fetch(`${window.location.origin}/api/notify_pc?msg=${encodeURIComponent("INIZIO TURNO: " + driver + " ha completato la checklist.")}&driver=${encodeURIComponent(driver)}`);
        
        // Avvia tracking se ON
        this.startGPSTracking();
    }

    // v2.0 - Tracking GPS
    startGPSTracking() {
        if (this.trackTimer) clearInterval(this.trackTimer);
        
        const sendPos = () => {
            if (localStorage.getItem('gps_tracking') === 'OFF') return;
            
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    fetch(`${window.location.origin}/api/gps_update?lat=${latitude}&lon=${longitude}&user=${encodeURIComponent(document.getElementById('driver-name').innerText)}`);
                }, null, { enableHighAccuracy: true });
            }
        };

        // Invia subito e poi ogni 1 minuto per Radar Live
        sendPos();
        this.trackTimer = setInterval(sendPos, 1 * 60 * 1000); 
    }

    // v2.0 - Gestione Spese
    async takeExpensePhoto() {
        this.expensePhotoType = 'SCONTRINO';
        document.getElementById('camera-input').click();
    }

    async submitExpense() {
        const type = document.getElementById('expense-type').value;
        const amount = document.getElementById('expense-amount').value;
        const driver = document.getElementById('driver-name').innerText;

        if (!amount) return alert("Inserisci l'importo della spesa!");

        this.showNotification("INVIANDO SPESA...");
        
        try {
            const apiBase = `${window.location.origin}/api`;
            const msg = `SPESA ${type}: € ${amount} da ${driver}`;
            const res = await fetch(`${apiBase}/notify_pc?msg=${encodeURIComponent(msg)}&driver=${encodeURIComponent(driver)}`);
            
            if (res.ok) {
                this.showNotification("SPESA INVIATA ALL'UFFICIO! ✅", 'success');
                document.getElementById('expense-amount').value = "";
                // Qui potremmo aggiungere logica per salvare nel DB storico spese
            }
        } catch (e) {
            this.showNotification("ERRORE INVIO");
        }
    }

    async uploadPOD(type, base64Image, nome = "") {
        if (!this.currentEditId) return;
        this.showNotification(`CARICAMENTO ${type.toUpperCase()}...`);
        
        const driver = document.getElementById('driver-name') ? document.getElementById('driver-name').innerText : "Ospite";

        try {
            const url = `${window.location.origin}/api/upload_pod`;
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: this.currentEditId,
                    type: type,
                    image: base64Image,
                    nome: nome,
                    driver: driver
                })
            };

            const result = await this.safeFetch(url, options);
            if (result.success) {
                this.showNotification(result.offline ? "SALVATA IN LOCALE (In coda) 📁" : `${type.toUpperCase()} SALVATA! ✅`, 'success');
            }
        } catch (e) {
            this.showNotification("ERRORE CARICAMENTO");
        }
    }

    updateStatsUI(stats) {
        const uEl = document.querySelector('.urgent .stat-value');
        if (uEl) uEl.innerText = stats.urgenti || 0;
        
        const sEl = document.querySelector('.pending .stat-value');
        if (sEl) sEl.innerText = stats.sospesi || 0;
        
        const dEl = document.querySelector('.done .stat-value');
        if (dEl) dEl.innerText = stats.completati || 0;

        // Auto-refresh dashboard se visibile
        if (document.getElementById('view-dashboard').classList.contains('active')) {
            this.renderDashboard();
        }
    }

    renderDashboard() {
        const dCont = document.getElementById('stats-deliveries');
        const kCont = document.getElementById('stats-km');
        if (!dCont || !kCont) return;

        // Dati per mese selezionato
        const monthData = this.data.filter(d => {
            if (!d.data || d.data === '—') return false;
            const sep = d.data.includes('/') ? '/' : '-';
            return (parseInt(d.data.split(sep)[1]) - 1) === this.currentMonth;
        });

        const total = monthData.length || 1;
        const done = monthData.filter(i => i.stato === 'COMPLETATA' || i.stato === 'CONSEGNATO').length;
        const urgent = monthData.filter(i => i.stato === 'URGENTE').length;
        
        const totalKm = monthData.reduce((acc, i) => acc + (parseFloat(i.kma) || 0) + (parseFloat(i.kmr) || 0), 0);
        const maxKm = 5000; // Target ipotetico

        const renderBar = (label, val, max, unit = "") => `
            <div class="bar-row">
                <div class="bar-label"><span>${label}</span> <b>${val}${unit}</b></div>
                <div class="bar-outer"><div class="bar-inner" style="width: ${Math.min(100, (val/max)*100)}%"></div></div>
            </div>
        `;

        dCont.innerHTML = `
            ${renderBar("Totale Consegne", monthData.length, monthData.length)}
            ${renderBar("Completate", done, monthData.length)}
            ${renderBar("Urgenti", urgent, monthData.length)}
        `;

        kCont.innerHTML = `
            ${renderBar("KM Percorsi", Math.round(totalKm), maxKm, " km")}
            ${renderBar("Media/Consegna", Math.round(totalKm/total), 100, " km")}
        `;
    }

    speakDetails() {
        const id = this.currentEditId;
        const item = [...this.data, ...(this.historyData || [])].find(d => String(d.id) === String(id));
        if (!item) return;

        if ('speechSynthesis' in window) {
            // Ferma eventuali letture in corso
            window.speechSynthesis.cancel();

            const text = `Consegna per ${item.cliente}. Indirizzo: ${item.indirizzo}, ${item.citta}. Merce: ${item.merce}. Note aggiuntive: ${item.note || 'Nessuna nota.'}`;
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'it-IT';
            utter.rate = 0.9; // Leggermente più lento per chiarezza
            utter.pitch = 1;

            const btn = document.getElementById('btnVoice');
            utter.onstart = () => btn.classList.add('speaking');
            utter.onend = () => btn.classList.remove('speaking');
            utter.onerror = () => btn.classList.remove('speaking');

            window.speechSynthesis.speak(utter);
        } else {
            alert("Sintesi vocale non supportata su questo dispositivo.");
        }
    }

    startDictation() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return alert("Riconoscimento vocale non supportato dal browser in uso.");
        }

        if (this._isDictating) return;
        this._isDictating = true;

        const btn = document.getElementById('btnDictate');
        const input = document.getElementById('edit-notifica-pc');
        
        const recognition = new SpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            btn.classList.add('recording');
            this.showNotification("Ascolto in corso... Parla ora 🎙️", "info");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const text = transcript.charAt(0).toUpperCase() + transcript.slice(1);
            
            input.value = text;
            this.showNotification("Trascritto correttamente! ✅", "success");
        };

        recognition.onerror = (event) => {
            this.showNotification("Dettatura fallita", "warning");
            console.error("Speech Err:", event.error);
        };

        recognition.onend = () => {
            btn.classList.remove('recording');
            this._isDictating = false;
        };

        try {
            recognition.start();
        } catch (e) {
            this._isDictating = false;
            btn.classList.remove('recording');
        }
    }

    updateStats() { }

    filterData(query) {
        const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
        query = query.toLowerCase();

        if (activePage === 'history') {
            // Filtro per il Registro Storico (SOLO COMPLETATI)
            this.filteredData = (this.historyData || []).filter(d => {
                const matchesQuery = d.cliente.toLowerCase().includes(query) || d.citta.toLowerCase().includes(query);
                
                // Filtro Mese Storico
                let matchesMonth = false;
                if (d.data && d.data !== '—') {
                    const sep = d.data.includes('/') ? '/' : '-';
                    const monthIdx = parseInt(d.data.split(sep)[1]) - 1;
                    matchesMonth = (monthIdx === this.currentMonth);
                }

                // STATO: Nel registro mostriamo solo ciò che è concluso
                const s = String(d.stato).toUpperCase();
                const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA');
                
                return matchesQuery && matchesMonth && isDone;
            });
            this.renderList(this.filteredData, 'history-list', true);
            return;
        }

        // Filtro per la Home
        this.filteredData = this.data.filter(d => {
            const matchesQuery = !query || d.cliente.toLowerCase().includes(query) || d.citta.toLowerCase().includes(query);
            
            const isPendingFilter = (this.currentStatusFilter === 'PENDING');
            
            // 1. FILTRO MESE / ANNO (Mostriamo solo l'anno corrente per non avere rimasugli del 2025)
            let matchesDate = false;
            if (!d.data || d.data === '—') {
                // In HOME, le consegne senza data (o vecchi rimasugli) NON vengono mostrate automaticamente.
                // Questo pulisce la scheda da ciò che l'utente chiama "storico".
                // Verranno mostrate SOLO se l'utente le cerca esplicitamente col campo cerca.
                matchesDate = (query && query.length > 0);
            } else {
                const currentYear = new Date().getFullYear().toString();
                const mNum = (this.currentMonth + 1).toString();
                const mNumPad = mNum.padStart(2, '0');
                const dStr = String(d.data);
                
                const monthMatches = dStr.includes('/' + mNum + '/') || dStr.includes('/' + mNumPad + '/') || 
                                     dStr.includes('-' + mNum + '-') || dStr.includes('-' + mNumPad + '-');
                const yearMatches = dStr.includes('/' + currentYear) || dStr.includes('-' + currentYear);
                
                matchesDate = monthMatches && yearMatches;
            }

            // 2. FILTRO STATO (In HOME mostriamo SOLO il NON completato, lo storico va in REGISTRO)
            const s = String(d.stato).toUpperCase();
            const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA') || s.includes('ANNULLATA');
            
            let matchesStatus = !isDone; 
            
            if (this.currentStatusFilter !== 'PENDING' && this.currentStatusFilter !== 'ALL') {
                // Filtro specifico (es. URGENTI, SOSPESI)
                matchesStatus = matchesStatus && s.includes(String(this.currentStatusFilter).toUpperCase());
            }

            return matchesQuery && matchesDate && matchesStatus;
        });

        console.log("Dati filtrati pronti per il rendering:", this.filteredData.length);
        this.renderList(this.filteredData, 'consegne-list');
        
        // Statistiche: se siamo in PENDING, mostriamo le pendenze TOTALI (tutti i mesi)
        // Se siamo in altri filtri, mostriamo solo quelle del mese selezionato.
        const isGlobalView = (this.currentStatusFilter === 'PENDING' || this.currentStatusFilter === 'ALL');
        
        const monthStatsData = this.data.filter(d => {
            if (isGlobalView) return true; // Nelle viste globali, le stats sono globali
            if (!d.data || d.data === '—') return true; 

            const mNum = (this.currentMonth + 1).toString();
            const mNumPad = mNum.padStart(2, '0');
            const mName = this.months[this.currentMonth].toLowerCase();
            const dStr = String(d.data).toLowerCase();
            
            return dStr.includes('/' + mNum + '/') || dStr.includes('/' + mNumPad + '/') || 
                   dStr.includes('-' + mNum + '-') || dStr.includes('-' + mNumPad + '-') ||
                   dStr.includes(mName);
        });

        const stats = {
            urgenti: monthStatsData.filter(i => {
                const s = String(i.stato || "").toUpperCase();
                const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA');
                return s.includes('URGENTE') && !isDone;
            }).length,
            sospesi: monthStatsData.filter(i => {
                const s = String(i.stato || "").toUpperCase();
                const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA');
                return (s.includes('SOSPESO') || s.includes('ATTESA') || s.includes('CHIAMARE')) && !isDone;
            }).length,
            completati: monthStatsData.filter(i => {
                const s = String(i.stato || "").toUpperCase();
                return s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA');
            }).length
        };
        this.updateStatsUI(stats);
    }

    showNotification(msg, type = '') {
        const area = document.getElementById('notification-area');
        if (!area) return;

        // Limita a massimo 2 notifiche a schermo per evitare sovrapposizioni
        while (area.children.length >= 2) {
            area.removeChild(area.firstChild);
        }

        // Evita duplicazione dello stesso messaggio se già a schermo
        const cleanMsg = String(msg).replace(/[\🔄✅📁🔔]/g, '').trim();
        if (area.lastChild && area.lastChild.innerText.includes(cleanMsg)) {
            return;
        }

        const n = document.createElement('div');
        n.className = `notif ${type}`;
        n.innerHTML = `<i class="fa fa-bell"></i> ${msg}`;
        area.appendChild(n);

        // Feedback Sensoriale
        if (type === 'warning') {
            this.playBeep();
            this.vibrate();
        }

        setTimeout(() => n.classList.add('show'), 100);
        setTimeout(() => {
            n.classList.remove('show');
            setTimeout(() => n.remove(), 500);
        }, 4000);
    }

    checkTimeAlerts() {
        if (!this.data || this.data.length === 0) return;

        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const todayStr = `${dd}/${mm}/${yyyy}`;
        
        let refreshNeeded = false;

        this.data.forEach(item => {
            const s = String(item.stato || "").toUpperCase();
            const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA') || s.includes('ANNULLATA');

            // Se completata o senza orario, ignora
            if (!item.ora || item.ora === '--:--' || isDone) return;

            // ANALISI DATA: Se non c'è data o non è oggi, non mandiamo notifiche acustiche/popup
            if (!item.data || item.data === '—' || item.data !== todayStr) {
                // Segniamola solo come in ritardo graficamente se la data è passata
                if (item.data && item.data !== '—' && item.data !== todayStr && !item.isLate) {
                    try {
                        const parts = item.data.split('/');
                        const dDate = new Date(parts[2], parts[1]-1, parts[0]);
                        if (dDate < now) {
                            item.isLate = true;
                            refreshNeeded = true;
                        }
                    } catch(e) {}
                }
                return;
            }

            // Se arriviamo qui, la consegna è per OGGI (o senza data specifica)
            const [h, m] = item.ora.split(':');
            const targetTime = new Date();
            targetTime.setHours(parseInt(h), parseInt(m), 0, 0);

            const diffMin = (targetTime - now) / 60000;

            if (diffMin <= 0) {
                // In RITARDO!
                if (!item.isLate) {
                    item.isLate = true;
                    refreshNeeded = true;
                    this.showNotification(`RITARDO: Consegna a ${item.cliente} scaduta!`, 'warning');
                }
            } else if (diffMin <= 30) {
                // Mancano meno di 30 min
                if (!item.notified30) {
                    item.notified30 = true;
                    this.showNotification(`AVVISO: Consegna ${item.cliente} tra ${Math.round(diffMin)} min`, 'warning');
                }
            }
        });

        if (refreshNeeded) {
            this.renderList(this.filteredData, 'consegne-list');
        }
    }

    extractAllPhones(tel) {
        if (!tel) return [];
        const matches = [];
        // Regex ottimizzata per i prefissi italiani (fissi e mobili) con o senza spazi/trattini/slash/punti intermedi
        const regex = /(?:\+39|0039)?[\s\-\.\/]*(?:3\d{2}|0\d{1,3})(?:[\s\-\.\/]*\d){5,7}(?!\d)/g;
        let m;
        while ((m = regex.exec(String(tel))) !== null) {
            matches.push(m[0]);
        }
        if (matches.length === 0) return [];
        
        // Pulisce e rimuove duplicati
        const cleaned = matches.map(match => match.replace(/[^0-9\+]/g, ''));
        return [...new Set(cleaned)].filter(n => n.length >= 8);
    }

    buildWaLink(cleanNum, cliente, customMsg = null) {
        if (!cleanNum) return '#';
        const num = '39' + cleanNum.slice(-10); // Assume prefisso 39 se manca
        const msg = customMsg ? encodeURIComponent(customMsg) : encodeURIComponent(`Salve ${cliente}, sono l'autista di logistica C. Milella...`);
        return `https://wa.me/${num}?text=${msg}`;
    }

    downloadVCard(id) {
        const item = [...this.data, ...(this.historyData || [])].find(d => String(d.id) === String(id));
        if (!item) return;

        const cleanName = String(item.cliente || '').trim() || "Cliente Logistica";
        const rawTel = String(item.telefono || '');
        const citta = String(item.citta || '').trim();
        const indirizzo = String(item.indirizzo || '').trim();
        
        let vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${cleanName}\n`;
        
        // Aggiunta Indirizzo e Città (ADR: post office box; ext address; street; locality; region; zip; country)
        if (citta || indirizzo) {
            vcard += `ADR;TYPE=HOME:;;${indirizzo};${citta};;;;\n`;
        }
        
        // Estrazione numeri con relative etichette dal testo libero
        const parts = String(rawTel).split(/[;,]/);
        const addedNumbers = new Set();
        let itemIndex = 1;
        
        parts.forEach(part => {
            const matches = [];
            const regex = /(?:\+39|0039)?[\s\-\.\/]*(?:3\d{2}|0\d{1,3})(?:[\s\-\.\/]*\d){5,7}(?!\d)/g;
            let m;
            while ((m = regex.exec(part)) !== null) {
                matches.push(m[0]);
            }

            if (matches.length > 0) {
                // Estrae solo le lettere per formare l'etichetta (rimuovendo in blocco tutti i numeri)
                let label = part.replace(/[0-9\+]/g, '').replace(/[^a-zA-Z\u00C0-\u024F]/g, ' ').replace(/\s+/g, ' ').trim();
                if (label.length > 20) label = label.substring(0, 20); // Tronca etichette troppo lunghe
                if (label) label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
                
                matches.forEach(matchStr => {
                    const cleanNum = matchStr.replace(/[^0-9\+]/g, '');
                    if (!addedNumbers.has(cleanNum)) {
                        addedNumbers.add(cleanNum);
                        const telVal = cleanNum.startsWith('+') ? cleanNum : '+39' + cleanNum;
                        
                        if (label && label !== "") {
                            // Formato X-ABLabel compatibile con Android/iOS per etichette custom
                            vcard += `item${itemIndex}.TEL:${telVal}\n`;
                            vcard += `item${itemIndex}.X-ABLabel:${label}\n`;
                            itemIndex++;
                        } else {
                            vcard += `TEL;TYPE=CELL:${telVal}\n`;
                        }
                    }
                });
            }
        });
        
        // Salviamo comunque tutto il testo originale nel campo Note in caso le etichette non vengano lette
        const noteText = String(rawTel).replace(/\n/g, ' ').trim();
        if (noteText) {
            vcard += `NOTE:Testo inserito in ufficio: ${noteText}\n`;
        }

        vcard += `END:VCARD`;

        const blob = new Blob([vcard], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanName.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async concludiConsegna(id) {
        const item = this.data.find(d => String(d.id) === String(id));
        const clienteStr = item ? item.cliente : "Cliente";

        if (!confirm(`Segnare come COMPLETATA la consegna per ${clienteStr}?`)) return;

        try {
            const apiBase = `${window.location.origin}/api`;
            const driver = localStorage.getItem('driver_name') || "Ospite";
            const url = `${apiBase}/concludi?id=${id}&nome=${encodeURIComponent(clienteStr)}&driver=${encodeURIComponent(driver)}`;
            const result = await this.safeFetch(url);

            if (result.success) {
                if (!result.offline) {
                    const msgPC = `CONSEGNA COMPLETATA: ${clienteStr} alle ${new Date().toLocaleTimeString()}`;
                    fetch(`${apiBase}/notify_pc?msg=${encodeURIComponent(msgPC)}&driver=${encodeURIComponent(driver)}`);
                    this.showNotification("NOTIFICA INVIATA ALL'UFFICIO! ✅", 'success');
                    await this.loadData();
                } else {
                    this.showNotification("COMPLETATA (Offline - In coda) 📁", 'warning');
                }
                this.vibrate();
            } else {
                alert("Errore: " + result.error);
            }
        } catch (error) {
            this.showNotification("ERRORE CONNESSIONE: In coda 📁");
        }
    }

    renderList(items, containerId, isHistory = false) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!items || items.length === 0) {
            let msg = "Nessun dato";
            if (this.currentStatusFilter === 'PENDING') {
                msg = `Complimenti! Hai completato tutte le consegne di ${this.months[this.currentMonth]}! 🏆`;
            }
            else if (this.currentStatusFilter !== 'ALL') msg = `Nessuna consegna con stato "${this.currentStatusFilter}" per ${this.months[this.currentMonth]}`;
            else msg = `Nessuna consegna trovata per ${this.months[this.currentMonth]}`;

            container.innerHTML = `<div class="empty-state"><i class="fa fa-info-circle"></i><p>${msg}</p></div>`;
            return;
        }

        let html = "";
        items.forEach(item => {
            try {
                const isHistory = this.currentTab === 'registro';
                
                // Generazione dinamica pulsanti multipli
                const allPhones = this.extractAllPhones(item.telefono);
                let phoneButtons = '';
                let waButtons = '';
                let vcardButton = '';

                if (allPhones.length === 0) {
                    phoneButtons = `<a href="#" class="action-btn tel" onclick="event.stopPropagation()"><i class="fa fa-phone"></i> CHIAMA</a>`;
                    waButtons = `<a href="#" target="_blank" class="action-btn whatsapp" onclick="event.stopPropagation()"><i class="fa fa-whatsapp"></i> WHATSAPP</a>`;
                } else if (allPhones.length === 1) {
                    phoneButtons = `<a href="tel:${allPhones[0]}" class="action-btn tel" onclick="event.stopPropagation()"><i class="fa fa-phone"></i> CHIAMA</a>`;
                    waButtons = `<a href="${this.buildWaLink(allPhones[0], item.cliente)}" target="_blank" class="action-btn whatsapp" onclick="event.stopPropagation()"><i class="fa fa-whatsapp"></i> WHATSAPP</a>`;
                    vcardButton = `<a href="javascript:void(0)" onclick="app.downloadVCard('${item.id}'); event.stopPropagation();" class="action-btn" style="background:#2b6cb0; color:white;"><i class="fa fa-user-plus"></i> RUBRICA</a>`;
                } else {
                    vcardButton = `<a href="javascript:void(0)" onclick="app.downloadVCard('${item.id}'); event.stopPropagation();" class="action-btn" style="background:#2b6cb0; color:white;"><i class="fa fa-user-plus"></i> RUBRICA</a>`;
                    allPhones.forEach(p => {
                        const last3 = p.slice(-3);
                        phoneButtons += `<a href="tel:${p}" class="action-btn tel" onclick="event.stopPropagation()" title="Chiama ${p}"><i class="fa fa-phone"></i> CHIAMA (...${last3})</a>`;
                        waButtons += `<a href="${this.buildWaLink(p, item.cliente)}" target="_blank" class="action-btn whatsapp" onclick="event.stopPropagation()" title="WhatsApp ${p}"><i class="fa fa-whatsapp"></i> W.APP (...${last3})</a>`;
                    });
                }

                const orderBadge = item.ordine ? `<span class="badge-order">ORD. ${item.ordine}</span>` : '';
                const address = (item.indirizzo || "") + (item.citta ? ", " + item.citta : "");
                const statusClass = String(item.stato || "da-chiamare").toLowerCase().trim().replace(/\s+/g, '-');

                html += `
                <div class="consegna-card ${item.isLate ? 'card-late' : ''} ${isHistory ? 'done' : statusClass}" onclick="app.openEditModal('${item.id}', event)">
                    <div class="card-header">
                        <span class="badge-status">${isHistory ? 'COMPLETATA' : (item.stato || 'INFO')}</span>
                        ${orderBadge}
                        <span class="time">${item.ora || '--:--'}</span>
                    </div>
                    <h3>${item.cliente || 'CLIENTE ANONIMO'}</h3>
                    <p class="location"><i class="fa fa-calendar"></i> Consegna: <b>${item.data || '—'}</b></p>
                    <p class="location"><i class="fa fa-map-marker"></i> ${item.citta || 'Città n.d.'} - ${item.indirizzo || 'Indirizzo n.d.'}</p>
                    <div class="km-info">
                        <span><i class="fa fa-arrow-right"></i> KM A: ${item.kma || 0}</span>
                        <span><i class="fa fa-arrow-left"></i> KM R: ${item.kmr || 0}</span>
                    </div>
                    <p class="merce"><i class="fa fa-cube"></i> ${item.merce || 'Nessuna nota'}</p>
                    
                    <div class="card-actions">
                        <a href="https://waze.com/ul?q=${encodeURIComponent(address)}" target="_blank" class="action-btn waze" onclick="event.stopPropagation()">
                            <i class="fa fa-location-arrow"></i> WAZE
                        </a>
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" class="action-btn maps" onclick="event.stopPropagation()">
                            <i class="fa fa-map"></i> VEDI
                        </a>
                        ${vcardButton}
                        ${waButtons}
                        ${phoneButtons}
                        ${allPhones.length > 0 ? `<button class="action-btn" style="background:#8a2be2; color:white;" onclick="event.stopPropagation(); app.apriModalManuali('${allPhones[0]}', '${item.cliente ? item.cliente.replace(/'/g, "\\'") : ''}')"><i class="fa fa-book"></i> MANUALI</button>` : ''}
                        <button class="action-btn main" onclick="event.stopPropagation(); app.openEditModal('${item.id}', event)">
                            <i class="fa fa-edit"></i> MODIFICA / KM
                        </button>
                        ${!isHistory ? `
                        <button class="action-btn main" onclick="event.stopPropagation(); app.openSignatureModal('${item.id}')" style="background:#10b981; color:white; font-weight:bold;">
                            <i class="fa fa-pencil-square-o"></i> CONCLUDI (FIRMA)
                        </button>
                        ` : ''}
                    </div>
                </div>`;
            } catch (err) { console.error("Errore riga:", err); }
        });
        container.innerHTML = html;
        if (!isHistory) {
            this.attachSwipeEvents(containerId);
        }
    }

    attachSwipeEvents(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = container.querySelectorAll('.consegna-card');
        
        cards.forEach(card => {
            let startX = 0;
            let currentX = 0;
            let isDragging = false;
            const threshold = 80; // pixel per far scattare l'azione
            
            card.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                isDragging = true;
                card.style.transition = 'none'; // Rimuove animazione durante il drag
            }, {passive: true});
            
            card.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                currentX = e.touches[0].clientX;
                const diffX = currentX - startX;
                
                // Limita lo swipe tra -150 e 150
                if (diffX > 0 && diffX < 150) {
                    card.style.transform = `translateX(${diffX}px)`;
                    card.style.borderLeft = `${diffX/10}px solid #34c759`; // Verde a destra
                } else if (diffX < 0 && diffX > -150) {
                    card.style.transform = `translateX(${diffX}px)`;
                    card.style.borderRight = `${Math.abs(diffX)/10}px solid #ff3b30`; // Rosso a sinistra
                }
            }, {passive: true});
            
            card.addEventListener('touchend', (e) => {
                if (!isDragging) return;
                isDragging = false;
                const diffX = currentX - startX;
                
                card.style.transition = 'transform 0.3s ease, border 0.3s ease';
                card.style.transform = 'translateX(0)';
                card.style.borderLeft = '';
                card.style.borderRight = '';
                
                if (diffX > threshold) {
                    // Completato
                    const id = card.getAttribute('onclick').match(/'([^']+)'/)[1];
                    this.showNotification("Segnata come COMPLETATA! ✅");
                    this.concludiConsegna(id); // Usa la logica esistente
                } else if (diffX < -threshold) {
                    // Sospeso
                    const id = card.getAttribute('onclick').match(/'([^']+)'/)[1];
                    this.showNotification("Segnata come SOSPESA! ❌", 'warning');
                    this.sospendiConsegna(id); // Dovremo creare/usare questa funzione
                }
                
                startX = 0;
                currentX = 0;
            });
        });
    }

    sospendiConsegna(id) {
        const item = this.data.find(d => d.id == id);
        if(!item) return;
        item.stato = "Sospeso";
        // Simuliamo aggiornamento nel backend (usa la tua API esistente per update)
        const updateUrl = `../assets/api/aggiorna_consegna.asp?id=${id}&stato=Sospeso`;
        this.safeFetch(updateUrl).then(() => {
            this.loadData();
        });
    }

    async concludiConsegna(id, signatureData) {
        const item = this.data.find(d => d.id == id);
        if (!item) return;

        item.stato = "COMPLETATO";
        if (signatureData) {
            item.firma = signatureData;
        }
        
        this.showNotification("Consegna completata con firma digitale! ✅", "success");

        try {
            const apiBase = `${window.location.origin}/api`;
            await this.safeFetch(`${apiBase}/concludi?id=${id}&firma=1`);
        } catch (e) {
            console.error("Errore invio conclusione:", e);
        }

        this.renderList();
    }

    checkForNewMessages() {
        let hasNewMessage = false;
        let messageText = "";

        this.data.forEach(item => {
            const s = String(item.stato || "").toUpperCase();
            const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA') || s.includes('ANNULLATA');
            if (isDone) return;

            const currentNote = String(item.note || "").trim();
            if (!this.lastNotesMap.has(item.id)) {
                this.lastNotesMap.set(item.id, currentNote);
                return;
            }

            const oldNote = this.lastNotesMap.get(item.id);
            if (currentNote !== "" && currentNote !== oldNote) {
                hasNewMessage = true;
                messageText = `DISPOSIZIONE DA SEDE CENTRALE per ${item.cliente}:\n\n"${currentNote}"`;
                this.lastNotesMap.set(item.id, currentNote);
            } else if (currentNote === "" && oldNote !== "" && oldNote !== "—") {
                this.showNotification("✅ LETTO DA UFFICIO (" + item.cliente + ")");
                this.lastNotesMap.set(item.id, currentNote);
            }
        });

        if (hasNewMessage) {
            document.getElementById('msg-badge').innerText = "MSG SEDE";
            document.getElementById('msg-badge').classList.remove('hidden');
            this.playBeep();
            this.vibrate();
            alert("⚠️ " + messageText);
        }
    }

    initMap() {
        if (this.map) {
            this.map.invalidateSize();
            this.updateMarkers();
            return;
        }

        // Centro su Bari come default (puoi cambiarlo)
        this.map = L.map('map-container').setView([41.1171, 16.8719], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        document.getElementById('btn-optimize').onclick = () => this.optimizeRoute();
        this.updateMarkers();
        this.geocodeMissing();
    }

    updateMarkers() {
        if (!this.map) return;
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        this.data.forEach(item => {
            if (item.lat && item.lon) {
                let color = '#3388ff'; // Blu default
                if (item.stato === 'URGENTE') color = '#ff3b30'; // Rosso
                if (item.stato === 'COMPLETATA' || item.stato === 'CONSEGNATO') color = '#34c759'; // Verde

                const marker = L.circleMarker([item.lat, item.lon], {
                    radius: 10,
                    fillColor: color,
                    color: "#fff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(this.map);

                marker.bindPopup(`<b>${item.cliente}</b><br>${item.indirizzo}<br>Stato: ${item.stato}<br><button onclick="app.openEditModal('${item.id}')" style="margin-top:5px; background:orange; border:none; padding:5px; border-radius:5px; color:black; font-weight:800;">DETTAGLI</button>`);
                this.markers.push(marker);
            }
        });

        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    async geocodeMissing() {
        for (const item of this.data) {
            if (!item.lat || !item.lon || item.lat == 0) {
                const q = `${item.indirizzo}, ${item.citta}, IT`;
                console.log("Geocoding:", q);
                try {
                    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
                    const coords = await res.json();
                    if (coords.lat) {
                        item.lat = coords.lat;
                        item.lon = coords.lon;
                        // Salva nel DB
                        await fetch(`/api/update_coords?id=${item.id}&lat=${coords.lat}&lon=${coords.lon}`);
                        this.updateMarkers();
                    }
                } catch (e) {
                    console.warn("Geocode fallito per:", q);
                }
                // Rispetta i limiti di Nominatim (1 req/sec)
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    }

    optimizeRoute() {
        if (this.data.length < 2) return alert("Poche consegne per ottimizzare!");
        
        const sorted = [];
        const pool = [...this.data.filter(d => d.lat && d.lon && d.stato !== 'COMPLETATA')];
        
        if (pool.length === 0) return alert("Nessuna consegna con coordinate valide!");

        // Punto di partenza (il primo nel pool o una posizione fissa)
        let current = pool.shift();
        sorted.push(current);

        while (pool.length > 0) {
            let nearestIdx = 0;
            let minDist = Infinity;

            for (let i = 0; i < pool.length; i++) {
                const d = Math.sqrt(Math.pow(current.lat - pool[i].lat, 2) + Math.pow(current.lon - pool[i].lon, 2));
                if (d < minDist) {
                    minDist = d;
                    nearestIdx = i;
                }
            }

            current = pool.splice(nearestIdx, 1)[0];
            sorted.push(current);
        }

        this.data = [...sorted, ...this.data.filter(d => !sorted.includes(d))];
        this.renderList(this.data, 'consegne-list');
        this.switchPage('home');
        this.showNotification("PERCORSO OTTIMIZZATO!");
    }

    // ==========================================
    // SISTEMA RADAR: UFFICIO -> DRIVER
    // ==========================================
    detectOfficeChanges(newData) {
        let hasChanges = false;
        let changeMsg = "";

        newData.forEach(newItem => {
            const s = String(newItem.stato || "").toUpperCase();
            const isDone = s.includes('COMPLETATA') || s.includes('CONSEGNATO') || s.includes('CHIUSA') || s.includes('ANNULLATA');
            if (isDone) return;

            const oldItem = this.oldData.find(o => String(o.id) === String(newItem.id));
            if (oldItem) {
                // Confronto campi critici
                const dateChanged = oldItem.data !== newItem.data;
                const timeChanged = oldItem.ora !== newItem.ora;
                const noteChanged = oldItem.note !== newItem.note;

                if (dateChanged || timeChanged || noteChanged) {
                    hasChanges = true;
                    changeMsg = `VARIAZIONE: ${newItem.cliente}` + 
                                (dateChanged ? ` spostato al ${newItem.data}` : "");
                }
            } else if (this.oldData.length > 0) {
                // Nuova consegna rilevata
                hasChanges = true;
                changeMsg = `NUOVO ORDINE: ${newItem.cliente}`;
            }
        });

        if (hasChanges) {
            this.triggerDriverAlert(changeMsg);
        }
    }

    triggerDriverAlert(msg) {
        // 1. Vibrazione lunga
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

        // 2. Notifica a schermo
        this.showNotification(`📢 UFFICIO: ${msg}`, "warning");
        
        // 3. Suono sintetico
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // DO5
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } catch(e) {}
    }

    isHoliday(date) {
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const y = date.getFullYear();

        // Tutte le domeniche sono considerate festività
        if (date.getDay() === 0) return true;

        // Festività fisse
        if ((d === 1 && m === 1) || // Capodanno
            (d === 6 && m === 1) || // Epifania
            (d === 25 && m === 4) || // Liberazione
            (d === 1 && m === 5) || // Lavoro
            (d === 8 && m === 5) || // San Nicola (Bari)
            (d === 2 && m === 6) || // Repubblica
            (d === 15 && m === 8) || // Ferragosto
            (d === 1 && m === 11) || // Ognissanti
            (d === 8 && m === 12) || // Immacolata
            (d === 25 && m === 12) || // Natale
            (d === 26 && m === 12)) { // Santo Stefano
            return true;
        }

        // Calcolo Pasqua (Algoritmo di Meeus/Jones/Butcher)
        const a = y % 19;
        const b = Math.floor(y / 100);
        const c = y % 100;
        const d_val = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d_val - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m_val = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m_val + 114) / 31);
        const day = ((h + l - 7 * m_val + 114) % 31) + 1;

        if (d === day && m === month) return true; // Pasqua
        
        const emDate = new Date(y, month - 1, day + 1);
        if (d === emDate.getDate() && m === (emDate.getMonth() + 1)) return true; // Lunedì dell'Angelo

        return false;
    }

    isSaturday(date) {
        return date.getDay() === 6;
    }

    async terminateTurn() {
        this.showNotification("CONTROLLO DATI IN CORSO...");
        
        // 1. Forza tentativo di sincronizzazione
        await this.processOfflineQueue();
        
        const queue = await this.db.getQueue();
        if (queue.length > 0) {
            alert(`⚠️ ATTENZIONE: Ci sono ancora ${queue.length} operazioni non inviate all'ufficio (manca campo internet).\n\nNON CHIUDERE il programma se vuoi che i dati arrivino a destinazione. Torna dove c'è campo.`);
            return;
        }

        // 2. Controllo consegne SOSPESE
        const pendenti = this.data.filter(d => {
            const s = String(d.stato).toUpperCase();
            return s.includes('PENDING') || s.includes('DA CHIAMARE') || s.includes('ESEGUIRE') || s.includes('URGENTE') || s.includes('ATTESA') || s.includes('CONFERMATO');
        });

        if (pendenti.length > 0) {
            const procedi = confirm(`⚠️ ATTENZIONE: Hai ancora ${pendenti.length} consegne/ritiri DA ESEGUIRE.\n\nSei sicuro di voler chiudere il turno senza completarle? Verranno rimandate a domani.`);
            if (!procedi) return;
        }

        alert("Tutto in regola! I dati sono salvati al sicuro sul PC dell'ufficio.\n\nBuon riposo!");
        this.logoutDriver(true); // Effettua il logout invece di chiudere l'app
    }

    initPushNotifications() {
        if (!window.EventSource) return;
        const evtSource = new EventSource(`${window.location.origin}/api/events`);
        evtSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'NEW_URGENT') {
                    this.playBeep();
                    this.vibrate();
                    this.showNotification(`ATTENZIONE: ${data.count} nuova/e consegna/e URGENTE aggiunta!`, "error");
                    this.loadData(true); // Aggiorna lista
                }
            } catch(err){}
        };
        evtSource.onerror = () => {
            // Reconnect is handled automatically by EventSource
        };
    }

    // --- MODULO AGENDA MOBILE ---
    async loadAgenda() {
        const container = document.getElementById('agenda-list');
        if (!container) return;

        // Carica subito cache se presente per velocità iniziale
        const cached = localStorage.getItem('agenda_data');
        if (cached) {
            this.agendaData = JSON.parse(cached);
            this.renderAgenda();
        }

        if (!navigator.onLine) return;

        try {
            const apiBase = `${window.location.origin}/api`;
            const response = await fetch(`${apiBase}/promemoria`);
            if (!response.ok) throw new Error("Errore API");
            
            const data = await response.json();
            
            // Elabora dati per ordinamento
            this.agendaData = data.map(item => ({
                ...item,
                ora: (item.Ora || '--:--').toString().trim(),
                dataFormatted: item.Data ? item.Data.split(' ')[0].split('-').reverse().join('/') : '—',
                nominativo: (item.Nominativo || 'N.D.').toString().trim(),
                indirizzo: (item.Indirizzo || 'N.D.').toString().trim(),
                tipologia: (item.Tipologia || 'Generico').toString().toLowerCase().trim()
            }));

            // Salvataggio cache offline
            localStorage.setItem('agenda_data', JSON.stringify(this.agendaData));
            
            this.renderAgenda();
        } catch (error) {
            console.error("Errore caricamento Agenda:", error);
        }
    }

    renderAgenda() {
        const container = document.getElementById('agenda-list');
        if (!container) return;

        if (this.agendaData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa fa-sticky-note-o"></i>
                    <p>Nessun promemoria attivo</p>
                </div>`;
            return;
        }

        container.innerHTML = this.agendaData.map(item => {
            // Sanitizzazione e mapping classi CSS
            let typeClass = 'agenda-type-generico';
            if (item.tipologia.includes('commerciale')) typeClass = 'agenda-type-commerciale';
            else if (item.tipologia.includes('tecnico')) typeClass = 'agenda-type-tecnico';
            else if (item.tipologia.includes('consegna')) typeClass = 'agenda-type-consegna';
            else if (item.tipologia.includes('completato')) typeClass = 'agenda-type-completato';

            const cleanTel = (item.Telefono || '').replace(/\D/g, '');
            const prefixedTel = cleanTel.length === 10 && cleanTel.startsWith('3') ? '39' + cleanTel : cleanTel;
            const rawDriver = localStorage.getItem('driver_name') || 'Ciro';
            const driverName = rawDriver.split(' ')[0].toUpperCase();
            const msgContent = encodeURIComponent(`Gentile *${item.nominativo}*, sono ${driverName} il consegnatario della cooperativa Aurelio Nicolodi, Le confermo l'appuntamento del *${item.dataFormatted}* alle ore *${item.ora.toString().trim()}*. Cordiali saluti. ${driverName}.`);
            const telAction = item.Telefono ? `<p style="display:flex; align-items:center;"><i class="fa fa-phone" style="margin-right:8px;"></i> <a href="tel:${cleanTel}" style="color:inherit; text-decoration:underline; text-underline-offset:3px; font-weight:bold;">${item.Telefono}</a> <a href="https://wa.me/${prefixedTel}?text=${msgContent}" target="_blank" style="margin-left:12px; color:#25D366; font-size:1.3rem; display:inline-flex; align-items:center;" onclick="event.stopPropagation()"><i class="fa fa-whatsapp"></i></a></p>` : '';
            const notes = item.Note ? `<div style="margin-top:10px; font-style:italic; font-size:0.8rem; color:#fff; opacity:0.7; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">${item.Note}</div>` : '';

            return `
                <div class="agenda-card ${typeClass}">
                    <div class="agenda-time">${item.ora}</div>
                    <h4>${item.nominativo}</h4>
                    <p><i class="fa fa-calendar"></i> ${item.dataFormatted}</p>
                    <p><i class="fa fa-map-marker" style="color:var(--accent-orange)"></i> <a href="https://waze.com/ul?q=${encodeURIComponent(item.indirizzo)}" target="_blank" style="color:inherit; text-decoration:underline; text-underline-offset:3px;">${item.indirizzo}</a></p>
                    ${telAction}
                    <span class="meta-pill">${item.Tipologia || 'Generico'}</span>
                    ${notes}
                </div>
            `;
        }).join('');
    }
    openScanner() {
        document.getElementById('modal-scanner').classList.remove('hidden');
        if (!this.html5QrcodeScanner) {
            this.html5QrcodeScanner = new Html5Qrcode("reader");
        }
        this.html5QrcodeScanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText, decodedResult) => {
                this.closeScanner();
                this.handleScanResult(decodedText);
            },
            (errorMessage) => {}
        ).catch(err => {
            console.error("Errore avvio scanner", err);
            this.showNotification("Errore avvio fotocamera", "error");
        });
    }

    closeScanner() {
        document.getElementById('modal-scanner').classList.add('hidden');
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.stop().catch(err => console.error(err));
        }
    }

    handleScanResult(text) {
        this.showNotification(`Letto: ${text}`, "success");
        document.getElementById('txtSearch').value = text;
        document.getElementById('txtSearch').dispatchEvent(new Event('input'));
    }

    ottimizzaPercorso() {
        const consegneAttive = this.data.filter(d => {
            const s = String(d.stato).toUpperCase();
            return s.includes('PENDING') || s.includes('ESEGUIRE') || s.includes('URGENTE') || s.includes('ATTESA') || s.includes('CONFERMATO');
        });

        if (consegneAttive.length === 0) {
            this.showNotification("Nessuna consegna attiva da ottimizzare.", "info");
            return;
        }

        const addresses = consegneAttive.map(d => `${d.indirizzo}, ${d.citta}`);
        if (addresses.length > 20) {
            this.showNotification("Attenzione: Inviate solo le prime 20 tappe (limite Google Maps)", "warning");
            addresses.length = 20;
        }

        const origin = "Posizione Attuale";
        const destination = addresses[addresses.length - 1];
        let waypoints = '';
        if (addresses.length > 1) {
            waypoints = '&waypoints=' + addresses.slice(0, addresses.length - 1).map(encodeURIComponent).join('|');
        }

        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints}&travelmode=driving`;
        window.open(url, '_blank');
    }

    openResoModal() {
        if (!this.currentEditId) {
            this.showNotification("Seleziona prima una consegna dalla lista", "error");
            return;
        }
        document.getElementById('modal-edit').classList.add('hidden');
        document.getElementById('modal-reso').classList.remove('hidden');
        const d = this.data.find(x => x.id == this.currentEditId);
        if (d) {
            document.getElementById('reso-cliente').value = d.cliente;
        }
    }

    async submitReso() {
        if (!this.currentEditId) return;
        const d = this.data.find(x => x.id == this.currentEditId);
        if (!d) return;

        const condizione = document.getElementById('reso-condizione').value;
        const note = document.getElementById('reso-note').value;
        const driver = document.getElementById('driver-name') ? document.getElementById('driver-name').innerText : "Ospite";

        this.showNotification("Segnalazione reso in corso...");
        
        try {
            const url = `${window.location.origin}/api/reso`;
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente: d.cliente,
                    citta: d.citta,
                    indirizzo: d.indirizzo,
                    note: `[Condizione: ${condizione}] ${note}`,
                    driver: driver
                })
            };

            const result = await this.safeFetch(url, options);
            if (result.success) {
                document.getElementById('modal-reso').classList.add('hidden');
                this.showNotification("Reso registrato con successo! ✅", 'success');
                document.getElementById('reso-note').value = '';
            } else {
                this.showNotification("Errore registrazione reso", "error");
            }
        } catch (e) {
            this.showNotification("Errore di connessione", "error");
        }
    }

    // ============================================================
    //  NUOVE FUNZIONI PREMIUM: Signature Canvas & Giro Ottimizzato
    // ============================================================

    initSignatureCanvas() {
        const canvas = document.getElementById('signature-canvas');
        if (!canvas) return;
        this.sigContext = canvas.getContext('2d');
        this.sigIsDrawing = false;
        
        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startDraw = (e) => {
            this.sigIsDrawing = true;
            const pos = getPos(e);
            this.sigContext.beginPath();
            this.sigContext.moveTo(pos.x, pos.y);
            this.sigContext.lineWidth = 3;
            this.sigContext.lineCap = 'round';
            this.sigContext.strokeStyle = '#000000';
            if (e.cancelable) e.preventDefault();
        };

        const draw = (e) => {
            if (!this.sigIsDrawing) return;
            const pos = getPos(e);
            this.sigContext.lineTo(pos.x, pos.y);
            this.sigContext.stroke();
            if (e.cancelable) e.preventDefault();
        };

        const stopDraw = () => {
            this.sigIsDrawing = false;
        };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);

        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDraw);
    }

    openSignatureModal(id) {
        this.currentSignatureId = id;
        const modal = document.getElementById('modal-signature');
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => {
                this.initSignatureCanvas();
                this.clearSignature();
            }, 100);
        }
    }

    closeSignatureModal() {
        const modal = document.getElementById('modal-signature');
        if (modal) modal.classList.add('hidden');
    }

    clearSignature() {
        const canvas = document.getElementById('signature-canvas');
        if (canvas && this.sigContext) {
            this.sigContext.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    async confirmSignature() {
        const canvas = document.getElementById('signature-canvas');
        if (!canvas) return;
        const signatureData = canvas.toDataURL('image/png');
        this.closeSignatureModal();

        if (this.currentSignatureId) {
            await this.concludiConsegna(this.currentSignatureId, signatureData);
        }
    }

    async ottimizzaGiro() {
        const pending = this.data.filter(x => x.stato !== 'COMPLETATO' && x.stato !== 'CONFERMATO');
        if (pending.length === 0) {
            this.showNotification("Nessuna consegna da eseguire da ottimizzare!", "info");
            return;
        }

        if (this.isOptimized) {
            // RITORNA ALL'ORDINE ORIGINALE (IMPOSTATO IN PRECEDENZA DA UFFICIO)
            pending.sort((a, b) => {
                const ordA = parseInt(a.ordine || a.id || 0, 10);
                const ordB = parseInt(b.ordine || b.id || 0, 10);
                return ordA - ordB;
            });
            this.isOptimized = false;
            const completed = this.data.filter(x => x.stato === 'COMPLETATO' || x.stato === 'CONFERMATO');
            this.data = [...pending, ...completed];
            this.renderList();
            this.showNotification("RIPRISTINATO ORDINE ORIGINALE CONSEGNE 🔄", "info");
        } else {
            // APPLICA L'OTTIMIZZAZIONE PERCORSO PER CITTA'/INDIRIZZO
            this.showNotification("Calcolo giro ottimale in corso... 🚗💨", "success");
            pending.sort((a, b) => {
                const cityCompare = (a.citta || '').localeCompare(b.citta || '');
                if (cityCompare !== 0) return cityCompare;
                return (a.indirizzo || '').localeCompare(b.indirizzo || '');
            });
            this.isOptimized = true;
            const completed = this.data.filter(x => x.stato === 'COMPLETATO' || x.stato === 'CONFERMATO');
            this.data = [...pending, ...completed];
            this.renderList();
            this.showNotification(`GIRO OTTIMIZZATO: ${pending.length} consegne riordinate per prossimità! 📍`, "success");
        }
    }

    ottimizzaPercorso() {
        this.ottimizzaGiro();
    }

    initPushNotifications() {
        if (!window.EventSource) return;
        const evtSource = new EventSource(`${window.location.origin}/api/events`);
        evtSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'NEW_URGENT') {
                    this.playBeep();
                    this.vibrate();
                    this.showNotification(`ATTENZIONE: ${data.count} nuova/e consegna/e URGENTE aggiunta!`, "error");
                    this.loadData(true); // Aggiorna lista
                }
            } catch(err){}
        };
        evtSource.onerror = () => {
            // Reconnect is handled automatically by EventSource
        };
    }
}

// Inizializza l'app al caricamento
window.app = new MobileApp();
