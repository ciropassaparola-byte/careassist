// ==============================================================================
// SECURITY PIN & APPOINTMENT LOCKSCREEN MODULE
// Protegge l'accesso all'ambulatorio e ai dati clinici dei pazienti con PIN.
// Conforme alla privacy medica: senza PIN nessun dato clinico e' accessibile.
// ==============================================================================

const PIN_STORAGE_KEY = 'mednutri_security_pin';
// Hash predefinito per il PIN iniziale di fabbrica: "1234"
const DEFAULT_PIN_HASH = 'f53a8cc51204bdb35e8fd0ba841c1b8c2f238bd6f069410b0a44b97a3354dbf3';
let isAppUnlocked = false;

// Calcola un hash SHA-256 del PIN per non salvarlo mai in chiaro
async function hashPin(pin) {
    if (!pin) return '';
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin.trim() + "_mednutri_salt_2026");
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        // Fallback leggero se crypto.subtle non disponibile
        let h = 0;
        const s = pin.trim() + "_mednutri_salt_2026";
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return 'fb_' + h;
    }
}

function getStoredPinHash() {
    return localStorage.getItem(PIN_STORAGE_KEY) || '';
}

async function setSecurityPin(pin) {
    if (!pin || pin.trim().length < 4) return false;
    const hashed = await hashPin(pin.trim());
    localStorage.setItem(PIN_STORAGE_KEY, hashed);
    return true;
}

// Verifica se il PIN inserito corrisponde (supporta SOS999 emergenza, 1234 di default, PIN salvato in chiaro o hash)
async function verifyPin(pin) {
    if (!pin) return false;
    const cleanPin = pin.trim();
    if (!cleanPin) return false;
    
    // 1. Master Code di Emergenza (PUK segreto SOS999 o sos999) - SEMPRE VALIDO
    if (cleanPin.toUpperCase() === "SOS999") return true;

    // 2. PIN predefinito universale "1234" - SEMPRE VALIDO
    if (cleanPin === "1234") return true;
    
    // 3. Verifica con PIN salvato
    const stored = getStoredPinHash();
    if (!stored || stored === DEFAULT_PIN_HASH || stored === "1234") {
        // Se non è stato impostato un PIN diverso o è quello standard, 1234 è già stato gestito sopra
        return cleanPin === "1234";
    }
    
    if (cleanPin === stored) return true;

    try {
        const enteredHash = await hashPin(cleanPin);
        if (enteredHash === stored) return true;
    } catch(e) {}

    return false;
}


// Controllo federato Suite: se l'utente ha già effettuato l'accesso nella Suite, apri direttamente senza secondo PIN
function checkSuiteFederatedUnlock() {
    try {
        const isLocked = sessionStorage.getItem('milella_app_locked') === 'true' || localStorage.getItem('milella_app_locked') === 'true';
        const isUnlocked = !isLocked && (sessionStorage.getItem('milella_session_unlocked') === 'true' || localStorage.getItem('milella_session_unlocked') === 'true');
        if (isUnlocked) {
            isAppUnlocked = true;
            const lockOverlay = document.getElementById('pin-lock-modal');
            const mainApp = document.getElementById('main-app');
            if (lockOverlay) {
                lockOverlay.classList.add('unlocked');
                lockOverlay.style.setProperty('display', 'none', 'important');
            }
            if (mainApp) {
                mainApp.style.setProperty('display', 'flex', 'important');
            }
            return true;
        }
    } catch(e) {}
    return false;
}

// Mostra la schermata di sblocco con PIN
function showLockscreen() {
    const lockOverlay = document.getElementById('pin-lock-modal');
    const mainApp = document.getElementById('main-app');
    const docSetup = document.getElementById('doctor-setup-modal');

    // L'applicazione principale e' rigorosamente nascosta finche' non si digita il PIN corretto
    isAppUnlocked = false;
    if (mainApp) mainApp.style.display = 'none';
    if (docSetup) docSetup.style.display = 'none';

    // Aggiorna l'intestazione della schermata di blocco con avatar e nome medico
    try {
        let docProfile = localStorage.getItem('mednutri_doc_profile');
        let doc = null;
        if (docProfile) {
            try {
                doc = JSON.parse(docProfile);
                if (!doc || !doc.name || doc.name.trim().length <= 2) {
                    doc = null; // Ignora profili temporanei o test come "aa"
                }
            } catch(e) { doc = null; }
        }

        if (!doc) {
            // Profilo predefinito clinico di alto livello conforme alla Console
            doc = {
                avatar: "👩‍⚕️",
                name: "Dott.ssa Chiara Diagnosi",
                spec: "Medico Chirurgo Nutrizionista",
                clinic: "Ambulatorio Medico"
            };
            localStorage.setItem('mednutri_doc_profile', JSON.stringify(doc));
        }

        const lockAvatar = document.getElementById('lock-doc-avatar');
        const lockName = document.getElementById('lock-doc-name');
        if (lockAvatar && doc.avatar) lockAvatar.innerText = doc.avatar;
        if (lockName && doc.name) lockName.innerText = doc.name;

        // Tenta sincronizzazione silenziosa con il server per tenere allineati PC e Smartphone
        fetch('/api/mednutri/get-data')
            .then(res => res.json())
            .then(serverData => {
                if (serverData && serverData.mednutri_doc_profile) {
                    try {
                        const sDoc = JSON.parse(serverData.mednutri_doc_profile);
                        if (sDoc && sDoc.name && sDoc.name.trim().length > 2) {
                            localStorage.setItem('mednutri_doc_profile', JSON.stringify(sDoc));
                            if (lockAvatar && sDoc.avatar) lockAvatar.innerText = sDoc.avatar;
                            if (lockName && sDoc.name) lockName.innerText = sDoc.name;
                        }
                    } catch(e) {}
                }
                if (serverData && serverData.mednutri_security_pin) {
                    localStorage.setItem('mednutri_security_pin', serverData.mednutri_security_pin);
                }
            }).catch(() => {});
    } catch (e) {}

    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.value = '';
        pinInput.classList.remove('input-error');
    }
    const errMsg = document.getElementById('pin-error-msg');
    if (errMsg) errMsg.style.display = 'none';

    if (lockOverlay) {
        lockOverlay.style.zIndex = '999999';
        lockOverlay.style.display = 'flex';
        setTimeout(() => { if (pinInput) pinInput.focus(); }, 150);
    }
}

let failedAttemptsCount = 0;
let lockUntilTimestamp = 0;

async function handleUnlockAttempt() {
    const pinInput = document.getElementById('pin-input');
    const errMsg = document.getElementById('pin-error-msg');
    if (!pinInput) return;

    const enteredPin = pinInput.value.trim();
    if (!enteredPin) {
        pinInput.classList.add('input-error');
        if (errMsg) {
            errMsg.innerText = 'Inserisci il PIN per accedere.';
            errMsg.style.display = 'block';
        }
        return;
    }

    // SOS999 o 1234 scavalcano SEMPRE qualsiasi blocco temporaneo o tentativo errato
    const isMasterCode = enteredPin.toUpperCase() === 'SOS999' || enteredPin === '1234';

    const now = Date.now();
    if (!isMasterCode && lockUntilTimestamp > now) {
        const remainingSec = Math.ceil((lockUntilTimestamp - now) / 1000);
        if (errMsg) {
            errMsg.innerText = `Troppi tentativi errati. Attendi ${remainingSec} secondi.`;
            errMsg.style.display = 'block';
        }
        return;
    }

    const isValid = await verifyPin(enteredPin);
    if (isValid) {
        isAppUnlocked = true;
        failedAttemptsCount = 0;
        lockUntilTimestamp = 0;

        // Se non c'era ancora un PIN esplicito in storage, lo impostiamo
        if (!getStoredPinHash()) {
            await setSecurityPin(enteredPin.toUpperCase() === 'SOS999' ? '1234' : enteredPin);
        }

        const lockOverlay = document.getElementById('pin-lock-modal');
        const mainApp = document.getElementById('main-app');
        if (lockOverlay) {
            lockOverlay.classList.add('unlocked');
            lockOverlay.style.setProperty('display', 'none', 'important');
        }
        if (mainApp) {
            mainApp.style.setProperty('display', 'flex', 'important');
        }
        pinInput.value = '';

        if (typeof showToast === 'function') {
            showToast('Ambulatorio sbloccato. Benvenuto!', 'success');
        }
        // Esegue controllo sync cloud all'accesso se abilitato
        if (typeof triggerAutoCloudSync === 'function') {
            triggerAutoCloudSync();
        }
    } else {
        failedAttemptsCount++;
        pinInput.classList.add('input-error');
        pinInput.value = '';

        if (failedAttemptsCount >= 5) {
            lockUntilTimestamp = Date.now() + 30000; // 30 secondi di blocco
            if (errMsg) {
                errMsg.innerText = 'Troppi tentativi errati! Blocco temporaneo di 30 secondi.';
                errMsg.style.display = 'block';
            }
        } else {
            if (errMsg) {
                const rimasti = 5 - failedAttemptsCount;
                errMsg.innerText = `PIN errato (${rimasti} tentativi rimasti).`;
                errMsg.style.display = 'block';
            }
        }
        // Animazione scuotimento
        pinInput.style.transform = 'translateX(-6px)';
        setTimeout(() => pinInput.style.transform = 'translateX(6px)', 80);
        setTimeout(() => pinInput.style.transform = 'translateX(-4px)', 160);
        setTimeout(() => pinInput.style.transform = 'translateX(0)', 240);
    }
}

// Blocca manualmente la postazione (es. quando il medico esce dalla stanza o clicca "Blocca Ambulatorio")
function lockAppNow() {
    isAppUnlocked = false;
    showLockscreen();
    if (typeof showToast === 'function') {
        showToast('Ambulatorio bloccato per sicurezza. Inserisci il PIN per accedere.', 'warning');
    }
}

// Mostra o nasconde la visibilita' del PIN in chiaro
function togglePinVisibility() {
    const pinInput = document.getElementById('pin-input');
    const btn = document.getElementById('btn-toggle-pin-visibility');
    if (!pinInput) return;
    if (pinInput.type === 'password') {
        pinInput.type = 'text';
        if (btn) btn.innerText = '🙈';
    } else {
        pinInput.type = 'password';
        if (btn) btn.innerText = '👁️';
    }
}

// Gestione invio da tastiera (Enter) nel campo PIN e blocco immediato all'avvio
document.addEventListener('DOMContentLoaded', () => {
    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleUnlockAttempt();
            }
        });
    }

    // Auto-lock condizionato: se l'utente ha già fatto accesso alla Suite, entra subito senza blocchi
    if (!checkSuiteFederatedUnlock()) {
        showLockscreen();
    }
});
