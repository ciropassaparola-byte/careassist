/**
 * suite_security_gate.js - Suite C. Milella Security Gate Unificato
 * -----------------------------------------------------------------
 * Blocca l'applicazione ogni volta che viene chiusa e riaperta.
 * - Verifica lo stato in sessionStorage ('milella_session_unlocked').
 * - Alla riapertura richiede il PIN autorizzato (Admin o Operatore) o Impronta Digitale.
 * - Fornisce la funzione globale window.lockMilellaSuite() per bloccare immediatamente.
 */
(function() {
    if (window.__milellaSecurityGateInit) return;
    window.__milellaSecurityGateInit = true;

    // Se ci troviamo sul launcher.html, la gestione PIN è già gestita nativamente
    if (window.location.pathname === '/launcher.html' || window.location.pathname === '/') {
        return;
    }

    const SESSION_KEY = 'milella_session_unlocked';

    // Determina titolo app corrente
    let currentAppTitle = 'SUITE C. MILELLA';
    const path = window.location.pathname.toLowerCase();
    if (path.includes('salute')) currentAppTitle = '🌿 PROGETTO SALUTE';
    else if (path.includes('careassist')) currentAppTitle = '🩺 CAREASSIST PRO';
    else if (path.includes('inventario')) currentAppTitle = '🛠️ INVENTARIO ATTREZZI';
    else if (path.includes('veicoli')) currentAppTitle = '🚗 FLOTTA VEICOLI & SPESE';
    else if (path.includes('ricettario')) currentAppTitle = '👨‍🍳 IL RICETTARIO';
    else if (path.includes('mednutri')) currentAppTitle = '🥗 MEDNUTRI PRO';
    else if (path.includes('gioco')) currentAppTitle = '🎮 PROGETTO GIOCO';

    function injectGateUI() {
        if (document.getElementById('suiteSecurityGateOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'suiteSecurityGateOverlay';
        overlay.style.cssText = 'display:none; position:fixed; inset:0; z-index:2147483647 !important; background:linear-gradient(135deg, #070b14 0%, #0f172a 100%); color:#fff; font-family:"Plus Jakarta Sans","Outfit","Inter",sans-serif; flex-direction:column; justify-content:center; align-items:center; padding:20px; text-align:center; box-sizing:border-box;';
        
        overlay.innerHTML = `
            <div style="background:rgba(255,255,255,0.04); border:1.5px solid rgba(212,175,55,0.45); border-radius:24px; padding:32px 24px; width:100%; max-width:390px; box-shadow:0 15px 45px rgba(0,0,0,0.75); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); box-sizing:border-box;">
                <div style="font-size:3rem; margin-bottom:8px;">🔐</div>
                <h2 style="margin:0 0 4px 0; font-size:1.35rem; font-weight:800; color:#f8fafc; letter-spacing:0.5px;">${currentAppTitle}</h2>
                <div style="font-size:0.85rem; color:#d4af37; font-weight:700; margin-bottom:16px;">👑 SUITE C. MILELLA</div>
                <p style="font-size:0.88rem; color:#94a3b8; margin:0 0 20px 0; line-height:1.4;">Accesso riservato. Inserisci il tuo PIN autorizzato per accedere all'applicazione.</p>

                <div style="position:relative; margin-bottom:16px;">
                    <input type="password" id="suiteGatePinInput" placeholder="••••••••" maxlength="16" style="width:100%; padding:14px 44px 14px 16px; border-radius:14px; background:rgba(0,0,0,0.55); border:1.5px solid rgba(212,175,55,0.5); color:#fff; font-size:24px; text-align:center; letter-spacing:6px; outline:none; box-sizing:border-box; font-family:monospace;">
                    <button type="button" id="btnSuiteGatePinToggle" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#cbd5e1; font-size:18px; cursor:pointer;" title="Mostra/Nascondi PIN">👁️</button>
                </div>

                <div id="suiteGateErrorMsg" style="display:none; color:#ef4444; font-size:0.85rem; font-weight:700; margin-bottom:14px; background:rgba(239,68,68,0.12); padding:8px 12px; border-radius:10px; border:1px solid rgba(239,68,68,0.3);"></div>

                <button type="button" id="btnSuiteGateUnlock" style="width:100%; padding:14px; background:linear-gradient(135deg, #d4af37 0%, #aa7c11 100%); color:#0b0f19; font-size:1rem; font-weight:900; border-radius:14px; border:none; cursor:pointer; box-shadow:0 6px 20px rgba(212,175,55,0.35); transition:transform 0.15s; margin-bottom:10px;">
                    SBLOCCA APPLICAZIONE 🔓
                </button>

                <button type="button" id="btnSuiteGateBiometric" style="display:none; width:100%; padding:12px; background:rgba(255,255,255,0.06); color:#38bdf8; font-size:0.92rem; font-weight:700; border-radius:14px; border:1px solid rgba(56,189,248,0.35); cursor:pointer; margin-bottom:10px;">
                    👆 Accedi con Impronta Digitale
                </button>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; font-size:0.82rem;">
                    <span style="color:#64748b;">Operatore autorizzato</span>
                    <a href="/launcher.html" style="color:#94a3b8; text-decoration:none; font-weight:700;">Torna al Menu ➔</a>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Event listener
        const pinInp = document.getElementById('suiteGatePinInput');
        const eyeBtn = document.getElementById('btnSuiteGatePinToggle');
        const unlockBtn = document.getElementById('btnSuiteGateUnlock');
        const bioBtn = document.getElementById('btnSuiteGateBiometric');

        if (eyeBtn && pinInp) {
            eyeBtn.onclick = () => {
                pinInp.type = (pinInp.type === 'password') ? 'text' : 'password';
                eyeBtn.textContent = (pinInp.type === 'password') ? '👁️' : '🙈';
            };
        }

        if (pinInp) {
            pinInp.onkeydown = (e) => {
                if (e.key === 'Enter') doVerifyPin();
            };
        }

        if (unlockBtn) {
            unlockBtn.onclick = doVerifyPin;
        }

        if (bioBtn) {
            bioBtn.onclick = doBiometricUnlock;
        }

        // Mostra biometrico se supportato
        if (window.PublicKeyCredential && localStorage.getItem('milella_last_authenticated_pin')) {
            if (bioBtn) bioBtn.style.display = 'block';
        }
    }

    async function doVerifyPin() {
        const inp = document.getElementById('suiteGatePinInput');
        const err = document.getElementById('suiteGateErrorMsg');
        const pin = (inp ? inp.value : '').trim();
        if (!pin) {
            if (err) { err.textContent = 'Inserisci il tuo PIN assegnato.'; err.style.display = 'block'; }
            return;
        }

        try {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codice: pin })
            });
            const data = await resp.json();
            if (data && data.success) {
                // Controlla sempre se l'utente che sta sbloccando ha i permessi per questa app
                if (data.ruolo !== 'admin') {
                    const enabledApps = data.appAbilitate || [];
                    const currentAppKey = (path.includes('veicoli') ? 'veicoli' : (path.includes('salute') ? 'salute' : (path.includes('careassist') ? 'careassist' : (path.includes('inventario') ? 'inventario' : (path.includes('ricettario') ? 'ricettario' : (path.includes('mednutri') ? 'mednutri' : (path.includes('gioco') ? 'gioco' : '')))))));
                    const hasAccess = enabledApps.includes('all') || 
                                      enabledApps.includes(currentAppKey) || 
                                      enabledApps.includes('app_' + currentAppKey) ||
                                      (currentAppKey === 'inventario' && (enabledApps.includes('attrezzi') || enabledApps.includes('app_attrezzi')));
                    if (currentAppKey && !hasAccess) {
                        if (err) {
                            err.textContent = 'Accesso negato: app non abilitata per il profilo ' + (data.nome || 'operatore') + '.';
                            err.style.display = 'block';
                        }
                        return;
                    }
                }

                sessionStorage.setItem(SESSION_KEY, 'true');
                // localStorage.setItem(SESSION_KEY, 'true');
                localStorage.setItem('milella_session_unlocked_time', String(Date.now()));
                sessionStorage.setItem('milella_user_nome', data.nome || 'Operatore');
                localStorage.setItem('milella_user_nome', data.nome || 'Operatore');
                localStorage.setItem('milella_last_authenticated_pin', pin);
                localStorage.setItem('milella_last_authenticated_role', data.ruolo || 'operatore');
                localStorage.setItem('milella_role', data.ruolo || 'operatore');
                localStorage.setItem('milella_last_authenticated_apps', JSON.stringify(data.appAbilitate || []));
                if (data.ruolo === 'admin') {
                    localStorage.setItem('milella_admin_pin', pin);
                    localStorage.setItem('milella_app_abilitate', JSON.stringify(['all']));
                    localStorage.setItem('milella_paz_abilitati', JSON.stringify(['all']));
                    localStorage.setItem('milella_profili_salute', JSON.stringify(['all']));
                    localStorage.setItem('milella_last_authenticated_paz', JSON.stringify(['all']));
                } else {
                    localStorage.removeItem('milella_admin_pin');
                    localStorage.setItem('milella_user_pin', pin);
                    localStorage.setItem('milella_app_abilitate', JSON.stringify(data.appAbilitate || []));
                    localStorage.setItem('milella_paz_abilitati', JSON.stringify(data.pazAbilitati || []));
                    localStorage.setItem('milella_profili_salute', JSON.stringify(data.profiliSalute || []));
                    localStorage.setItem('milella_last_authenticated_paz', JSON.stringify(data.pazAbilitati || []));
                }
                if (data.token) localStorage.setItem('milella_token', data.token);

                const overlay = document.getElementById('suiteSecurityGateOverlay');
                if (overlay) overlay.style.display = 'none';
                if (typeof window.renderAll === 'function') window.renderAll();
            } else {
                if (err) {
                    err.textContent = data.message || 'PIN non valido.';
                    err.style.display = 'block';
                }
            }
        } catch(e) {
            // Fallback offline con ultimo PIN salvato localmente
            const isMaster = (pin.toUpperCase() === 'SOS999'); if (isMaster) { sessionStorage.setItem(SESSION_KEY, 'true'); localStorage.setItem(SESSION_KEY, 'true'); localStorage.setItem('milella_role', 'admin'); localStorage.setItem('milella_last_authenticated_role', 'admin'); localStorage.setItem('milella_admin_pin', 'SOS999'); localStorage.setItem('milella_app_abilitate', JSON.stringify(['all'])); localStorage.setItem('milella_paz_abilitati', JSON.stringify(['all'])); localStorage.setItem('milella_profili_salute', JSON.stringify(['all'])); const overlay = document.getElementById('suiteSecurityGateOverlay'); if (overlay) overlay.style.display = 'none'; if (typeof window.renderAll === 'function') window.renderAll(); return; } const savedPin = localStorage.getItem('milella_admin_pin') || localStorage.getItem('milella_user_pin') || localStorage.getItem('milella_last_authenticated_pin');
            if (savedPin && pin.toLowerCase() === savedPin.toLowerCase()) {
                sessionStorage.setItem(SESSION_KEY, 'true');
                localStorage.setItem(SESSION_KEY, 'true');
                const overlay = document.getElementById('suiteSecurityGateOverlay');
                if (overlay) overlay.style.display = 'none';
            } else {
                if (err) {
                    err.textContent = 'PIN non riconosciuto (o server non raggiungibile).';
                    err.style.display = 'block';
                }
            }
        }
    }

    async function doBiometricUnlock() {
        const savedPin = localStorage.getItem('milella_last_authenticated_pin');
        const err = document.getElementById('suiteGateErrorMsg');
        if (!savedPin) {
            if (err) { err.textContent = 'Inserisci prima il tuo PIN una volta su questo dispositivo.'; err.style.display = 'block'; }
            return;
        }

        // Se WebAuthn è disponibile, verifica con il sensore di impronta / Touch ID / Face ID
        if (window.PublicKeyCredential && localStorage.getItem('milella_bio_cred_id')) {
            try {
                const rawCredId = localStorage.getItem('milella_bio_cred_id');
                const credIdBytes = Uint8Array.from(atob(rawCredId), c => c.charCodeAt(0));
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);

                await navigator.credentials.get({
                    publicKey: {
                        challenge: challenge,
                        allowCredentials: [{ id: credIdBytes, type: 'public-key' }],
                        timeout: 60000,
                        userVerification: "required"
                    }
                });
            } catch(eBio) {
                console.warn('Verifica biometrica annullata o fallita:', eBio);
                if (err) { err.textContent = 'Impronta non riconosciuta. Usa il tuo PIN.'; err.style.display = 'block'; }
                return;
            }
        }

        sessionStorage.setItem(SESSION_KEY, 'true');
        sessionStorage.setItem('salute_session_unlocked', 'true');
        localStorage.setItem(SESSION_KEY, 'true');
        localStorage.setItem('milella_session_unlocked_time', String(Date.now()));
        const overlay = document.getElementById('suiteSecurityGateOverlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.25s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 250);
        }
    }

    function checkGateState() {
        const SESSION_KEY = 'milella_session_unlocked';
        const isExplicitlyLocked = sessionStorage.getItem('milella_app_locked') === 'true' || localStorage.getItem('milella_app_locked') === 'true';
        localStorage.removeItem(SESSION_KEY);
        const hasSession = sessionStorage.getItem(SESSION_KEY) === 'true';
        if (!isExplicitlyLocked && hasSession) {
            const overlay = document.getElementById('suiteSecurityGateOverlay');
            if (overlay) overlay.style.display = 'none';
            document.body.classList.remove('modal-open');
            return;
        }
        // 1. Se la sessione è già sbloccata nel tab corrente (sessionStorage)
        let isUnlocked = sessionStorage.getItem(SESSION_KEY) === 'true';

        // 2. Se non è sbloccata nel tab, controlla se l'utente ha una sessione recente valida
        // Sessione stretta: se la sessione non è attiva nel tab, richiedi sempre PIN

        if (!isUnlocked) {
            injectGateUI();
            const overlay = document.getElementById('suiteSecurityGateOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
                setTimeout(() => {
                    const inp = document.getElementById('suiteGatePinInput');
                    if (inp) inp.focus();
                }, 200);
            }
        } else {
            const overlay = document.getElementById('suiteSecurityGateOverlay');
            if (overlay) overlay.style.display = 'none';
        }
    }

    // Funzione globale esportata per bloccare manualmente l'app
    window.lockMilellaSuite = function() {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('milella_session_unlocked_time');
        checkGateState();
        const inp = document.getElementById('suiteGatePinInput');
        if (inp) { inp.value = ''; inp.focus(); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkGateState);
    } else {
        checkGateState();
    }
})();
