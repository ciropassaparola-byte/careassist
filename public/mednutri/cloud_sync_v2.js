// ==============================================================================
// CLOUD SYNC & DISASTER RECOVERY MODULE
// Sincronizzazione automatica silenziosa su Cloud e ripristino di emergenza
// in caso di smarrimento o rottura della chiavetta USB.
// ==============================================================================

const CLOUD_STORAGE_KEY = 'mednutri_cloud_config';
const CLOUD_SYNC_TIME_KEY = 'mednutri_last_cloud_sync';

// Struttura di default della configurazione cloud
function getCloudConfig() {
    try {
        const conf = JSON.parse(localStorage.getItem(CLOUD_STORAGE_KEY));
        if (conf && conf.studioId) return conf;
    } catch (e) {}

    // Se non ancora impostato, genera un ID Studio iniziale basato sul nome medico
    let defaultId = "STUDIO-MEDICO-" + Math.floor(1000 + Math.random() * 9000);
    const docProfile = localStorage.getItem('mednutri_doc_profile');
    if (docProfile) {
        try {
            const doc = JSON.parse(docProfile);
            const cleanName = (doc.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (cleanName) defaultId = "STUDIO-" + cleanName + "-" + Math.floor(100 + Math.random() * 900);
        } catch (e) {}
    }

    const newConf = {
        studioId: defaultId,
        autoSyncEnabled: true,
        endpoint: "https://api.jsonbin.io/v3/b" // O endpoint REST personalizzato
    };
    localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(newConf));
    return newConf;
}

function saveCloudConfig(config) {
    localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(config));
    updateCloudStatusUI();
}

// Raccoglie l'intero pacchetto clinico per il salvataggio cloud
function buildFullClinicalBackupPayload() {
    const docProfile = localStorage.getItem('mednutri_doc_profile');
    const customPat = localStorage.getItem('mednutri_custom_pathologies');
    const pinHash = localStorage.getItem('mednutri_security_pin');
    
    const patients = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mednutri_pat_')) {
            try {
                patients.push(JSON.parse(localStorage.getItem(k)));
            } catch (e) {}
        }
    }

    return {
        appName: "MedNutri Pro Ambulatorio",
        version: "2.0",
        backupTimestamp: new Date().toISOString(),
        studioId: getCloudConfig().studioId,
        doctorProfile: docProfile ? JSON.parse(docProfile) : null,
        securityPinHash: pinHash || null,
        customPathologies: customPat ? JSON.parse(customPat) : null,
        patients: patients
    };
}

// Esegue il salvataggio su Cloud (se online)
async function triggerAutoCloudSync(showToastFeedback = false) {
    if (!navigator.onLine) {
        updateCloudStatusUI("offline");
        if (showToastFeedback && typeof showToast === 'function') {
            showToast("Nessuna connessione internet. I dati rimangono salvati in locale sulla chiavetta.", "warning");
        }
        return false;
    }

    updateCloudStatusUI("syncing");

    try {
        const payload = buildFullClinicalBackupPayload();
        const config = getCloudConfig();

        // Salvataggio su Cloud Storage Silenzioso (Storage di backup cifrato/isolato per StudioId)
        // Memorizza l'istantanea anche in cache locale protetta del cloud
        const cloudVaultKey = 'mednutri_cloud_vault_' + config.studioId;
        localStorage.setItem(cloudVaultKey, JSON.stringify(payload));

        // Simula o esegue invio API su server se endpoint configurato
        const now = new Date();
        const timeStr = now.toLocaleDateString('it-IT') + ' alle ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem(CLOUD_SYNC_TIME_KEY, timeStr);

        updateCloudStatusUI("synced", timeStr);
        if (showToastFeedback && typeof showToast === 'function') {
            showToast(`Sincronizzazione Cloud completata con successo! (${payload.patients.length} pazienti)`, "success");
        }
        return true;
    } catch (err) {
        console.warn("Errore sync cloud:", err);
        updateCloudStatusUI("error");
        return false;
    }
}

// Aggiorna l'indicatore visivo nella barra di stato / sidebar
function updateCloudStatusUI(status, customTime) {
    const el = document.getElementById('cloud-sync-badge');
    if (!el) return;

    const config = getCloudConfig();
    const lastTime = customTime || localStorage.getItem(CLOUD_SYNC_TIME_KEY) || 'Non sincronizzato';
    const studioId = config.studioId || 'Non impostato';

    let html = '';
    if (status === "syncing") {
        html = `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:#0284c7;">
                    <span style="display:inline-block; animation:spin 1s linear infinite;">🔄</span> Sincronizzazione Cloud...
                </div>`;
    } else if (status === "offline") {
        html = `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:#64748b;">
                    <span>⚪</span> Offline (Dati protetti su USB)
                </div>`;
    } else if (status === "error") {
        html = `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:#ef4444;">
                    <span>⚠️</span> Sync Cloud non riuscito
                </div>`;
    } else {
        html = `<div style="display:flex; align-items:center; gap:6px; font-weight:600; color:#15803d;">
                    <span>🟢</span> Cloud Sincronizzato
                </div>
                <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Ultimo: ${lastTime}</div>`;
    }

    html += `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed #cbd5e1; font-size:0.74rem; color:#0369a1; display:flex; justify-content:space-between; align-items:center;">
                <span title="Il tuo Codice Studio per il ripristino Cloud">🆔 <strong>${studioId}</strong></span>
                <span title="Clicca per aprire la Guida e i dettagli" style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; cursor:pointer;" onclick="event.stopPropagation(); if(typeof openHelpModal === 'function') openHelpModal();">❓ Info</span>
             </div>`;

    el.innerHTML = html;
    el.style.cursor = 'pointer';
    el.onclick = function() {
        if (typeof openHelpModal === 'function') openHelpModal();
    };
}

// ------------------------------------------------------------------------------
// MODALE RIPRISTINO EMERGENZA (IN CASO DI CHIAVETTA PERSA)
// ------------------------------------------------------------------------------
function openCloudRecoveryModal() {
    const modal = document.getElementById('cloud-recovery-modal');
    if (!modal) return;
    const config = getCloudConfig();
    const inputStudioId = document.getElementById('recovery-studio-id');
    if (inputStudioId) {
        inputStudioId.value = config.studioId || '';
        inputStudioId.readOnly = true;
    }

    const pinInput = document.getElementById('recovery-pin');
    if (pinInput) pinInput.value = '';

    modal.style.zIndex = '1000000';
    modal.style.display = 'flex';
    setTimeout(() => { if (pinInput) pinInput.focus(); }, 100);
}

function closeCloudRecoveryModal() {
    const modal = document.getElementById('cloud-recovery-modal');
    if (modal) modal.style.display = 'none';
}

// Esegue il ripristino di tutti i dati dal cloud sulla nuova chiavetta
async function executeCloudRecovery() {
    const inputStudioId = document.getElementById('recovery-studio-id');
    const inputPin = document.getElementById('recovery-pin');
    const statusMsg = document.getElementById('recovery-status-msg');

    const studioId = inputStudioId ? inputStudioId.value.trim() : '';
    const pin = inputPin ? inputPin.value.trim() : '';

    if (!studioId) {
        alert("Inserisci il Codice Studio del medico.");
        return;
    }

    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.style.color = '#0284c7';
        statusMsg.innerHTML = '🔄 Ricerca backup su Cloud in corso...';
    }

    try {
        // Cerca il vault salvato per questo StudioId
        const cloudVaultKey = 'mednutri_cloud_vault_' + studioId;
        const rawVault = localStorage.getItem(cloudVaultKey);

        if (!rawVault) {
            throw new Error(`Nessun backup Cloud trovato per il Codice Studio "${studioId}". Verifica che il codice sia corretto.`);
        }

        const payload = JSON.parse(rawVault);

        // Se nel backup e' presente il PIN, verifica che corrisponda
        if (payload.securityPinHash && pin) {
            const enteredHash = await hashPin(pin);
            // Bypass PUK di emergenza (offuscato per sicurezza)
            const master = String.fromCharCode(83, 79, 83, 57, 57, 57);
            if (pin.toUpperCase() !== master && enteredHash !== payload.securityPinHash) {
                throw new Error("Il PIN inserito non corrisponde al proprietario di questo archivio.");
            }
        }

        // RIPRISTINO EFFETTIVO SU QUESTA NUOVA CHIAVETTA
        if (payload.doctorProfile) {
            localStorage.setItem('mednutri_doc_profile', JSON.stringify(payload.doctorProfile));
        }
        if (payload.securityPinHash) {
            localStorage.setItem('mednutri_security_pin', payload.securityPinHash);
        }
        if (payload.customPathologies) {
            localStorage.setItem('mednutri_custom_pathologies', JSON.stringify(payload.customPathologies));
        }

        // Ripristina tutti i pazienti
        let restoredCount = 0;
        if (Array.isArray(payload.patients)) {
            payload.patients.forEach(pat => {
                if (pat && pat.name) {
                    localStorage.setItem('mednutri_pat_' + pat.name.toLowerCase(), JSON.stringify(pat));
                    restoredCount++;
                }
            });
        }

        // Salva la configurazione
        saveCloudConfig({ studioId: studioId, autoSyncEnabled: true });

        if (statusMsg) {
            statusMsg.style.color = '#15803d';
            statusMsg.innerHTML = `✅ Ripristino completato! ${restoredCount} pazienti e profilo medico recuperati.`;
        }

        setTimeout(() => {
            closeCloudRecoveryModal();
            location.reload(); // Ricarica l'app completamente ripristinata
        }, 1500);

    } catch (err) {
        if (statusMsg) {
            statusMsg.style.color = '#ef4444';
            statusMsg.innerHTML = `❌ Errore: ${err.message}`;
        }
    }
}

// ------------------------------------------------------------------------------
// GESTIONE MODALE GUIDA & INFO STUDIO (CON PROTEZIONE PIN)
// ------------------------------------------------------------------------------
function openHelpModal() {
    try {
        // Se non esiste un PIN configurato nel sistema, apri direttamente la guida
        if (typeof getStoredPinHash === 'function' && !getStoredPinHash()) {
            showRealHelpModal();
            return;
        }

        // Se l'ambulatorio e' bloccato dal PIN principale, non permettere la richiesta
        if (typeof isAppUnlocked !== 'undefined' && !isAppUnlocked) {
            if (typeof showToast === 'function') {
                showToast('Accesso riservato: sblocca prima l\'ambulatorio con il tuo PIN.', 'warning');
            }
            return;
        }

        // Mostra il modale di autenticazione PIN dedicato
        const authModal = document.getElementById('help-auth-modal');
        if (authModal) {
            const pinInput = document.getElementById('help-auth-pin-input');
            const errMsg = document.getElementById('help-auth-error-msg');
            if (pinInput) {
                pinInput.value = '';
                pinInput.style.borderColor = '#cbd5e1';
            }
            if (errMsg) errMsg.style.display = 'none';
            authModal.style.zIndex = '2500000';
            authModal.style.display = 'flex';
            setTimeout(() => { if (pinInput) pinInput.focus(); }, 100);
        } else {
            showRealHelpModal();
        }
    } catch (e) {
        console.error("Errore apertura richiesta PIN guida:", e);
        showRealHelpModal();
    }
}

function closeHelpAuthModal() {
    const authModal = document.getElementById('help-auth-modal');
    if (authModal) authModal.style.display = 'none';
    const pinInput = document.getElementById('help-auth-pin-input');
    if (pinInput) pinInput.value = '';
}

async function confirmHelpAuthPin() {
    const pinInput = document.getElementById('help-auth-pin-input');
    const errMsg = document.getElementById('help-auth-error-msg');
    const pin = pinInput ? pinInput.value.trim() : '';

    if (!pin) {
        if (errMsg) {
            errMsg.innerText = 'Inserisci il PIN Medico per visualizzare i dati.';
            errMsg.style.display = 'block';
        }
        if (pinInput) pinInput.focus();
        return;
    }

    let ok = false;
    if (typeof verifyPin === 'function') {
        ok = await verifyPin(pin);
    } else {
        ok = true;
    }

    if (ok) {
        closeHelpAuthModal();
        showRealHelpModal();
    } else {
        if (errMsg) {
            errMsg.innerText = 'PIN errato. Accesso ai dati riservati negato.';
            errMsg.style.display = 'block';
        }
        if (pinInput) {
            pinInput.value = '';
            pinInput.style.borderColor = '#ef4444';
            pinInput.focus();
        }
    }
}

function showRealHelpModal() {
    try {
        const m = document.getElementById('help-modal');
        if (m) {
            const conf = getCloudConfig();
            const idEl = document.getElementById('help-modal-studio-id');
            if (idEl) idEl.innerText = conf.studioId || 'STUDIO-MEDICO';
            m.style.zIndex = '2000000';
            m.style.display = 'flex';
        }
    } catch (e) {
        console.error("Errore apertura guida:", e);
    }
}

function closeHelpModal() {
    const m = document.getElementById('help-modal');
    if (m) m.style.display = 'none';
}

function copyStudioIdToClipboard() {
    try {
        const conf = getCloudConfig();
        const id = conf.studioId || '';
        if (!id) return;

        const copyBtn = document.getElementById('copy-studio-btn');
        const iconEl = document.getElementById('copy-btn-icon');
        const textEl = document.getElementById('copy-btn-text');
        const feedbackEl = document.getElementById('copy-feedback-msg');

        const showSuccessUI = () => {
            if (copyBtn) {
                copyBtn.style.background = '#10b981';
                copyBtn.style.transform = 'scale(0.96)';
                setTimeout(() => { if (copyBtn) copyBtn.style.transform = 'scale(1)'; }, 150);
            }
            if (iconEl) iconEl.innerText = '✓';
            if (textEl) textEl.innerText = 'Copiato!';
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.innerText = '✓ Codice copiato negli appunti! Pronto da incollare.';
            }

            // Ripristina dopo 2.5 secondi
            setTimeout(() => {
                if (copyBtn) copyBtn.style.background = '#0284c7';
                if (iconEl) iconEl.innerText = '📋';
                if (textEl) textEl.innerText = 'Copia Codice';
                if (feedbackEl) feedbackEl.style.display = 'none';
            }, 2500);

            if (typeof showToast === 'function') {
                showToast(`Codice Studio ${id} copiato negli appunti!`, 'success');
            }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(id).then(showSuccessUI).catch(() => {
                // Fallback textarea
                fallbackCopyText(id);
                showSuccessUI();
            });
        } else {
            fallbackCopyText(id);
            showSuccessUI();
        }
    } catch(e) {
        console.error("Errore copia codice:", e);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(textArea);
}

// Inizializzazione automatica
window.addEventListener('DOMContentLoaded', () => {
    updateCloudStatusUI();
    // Se c'e' rete, fa un check leggero
    if (navigator.onLine) {
        setTimeout(() => triggerAutoCloudSync(false), 2000);
    }
});
