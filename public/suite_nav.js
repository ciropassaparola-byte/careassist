/**
 * suite_nav.js - Unified Mobile Experience & Navigation per la Suite Milella
 * 1. Barra di Navigazione Mobile Unificata (Glassmorphic)
 * 2. Feedback Aptico / Vibrazione tattile al tocco
 * 3. Badge Notifiche dinamico (Pallino rosso su Flotta per scadenze/allarmi)
 * 4. Supporto PWA / Prompt "Aggiungi a Schermata Home"
 * 5. Transizioni fluide di pagina (Page Fade / Slide Transition)
 */
(function() {
  if (document.getElementById('suite-unified-bottom-nav') || document.getElementById('mednutri-mobile-bar') || document.querySelector('.mobile-bottom-bar')) return;

  // 1. INIEZIONE STILI CSS
  const style = document.createElement('style');
  style.id = 'suite-unified-bottom-nav-style';
  style.textContent = `
    /* Spazio extra in fondo alla pagina per evitare sovrapposizioni */
    body {
      padding-bottom: 84px !important;
    }

    /* page-transitioning rimosso per eliminare farfallio */

    /* Nasconde automaticamente la barra inferiore quando un modale è aperto per lasciare pieno spazio ai tasti azione */
    body.modal-open #suite-unified-bottom-nav,
    body:has(.modal-overlay.active) #suite-unified-bottom-nav,
    body:has(.modal-overlay[style*="display: flex"]) #suite-unified-bottom-nav {
      transform: translateY(115%) !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transition: transform 0.25s ease, opacity 0.2s ease !important;
    }

    /* BARRA INFERIORE FLOTTANTE */
    #suite-unified-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 68px;
      background: rgba(11, 19, 35, 0.94);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border-top: 1px solid rgba(56, 189, 248, 0.22);
      box-shadow: 0 -8px 25px rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 0 10px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      z-index: 999999;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    /* VISIBILE SOLO SU SMARTPHONE / TABLET (<= 900px) */
    @media (min-width: 901px) {
      #suite-unified-bottom-nav, #pwa-install-banner {
        display: none !important;
      }
      body {
        padding-bottom: 0 !important;
      }
    }

    .suite-nav-btn {
      position: relative;
      background: none;
      border: none;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      padding: 6px 10px;
      border-radius: 12px;
      min-width: 58px;
      -webkit-tap-highlight-color: transparent;
    }

    .suite-nav-btn:active {
      transform: scale(0.88);
      color: #38bdf8;
    }

    .suite-nav-btn.active, .suite-nav-btn:hover {
      color: #38bdf8;
    }

    .suite-nav-btn svg {
      width: 22px;
      height: 22px;
      stroke: currentColor;
    }

    /* Tasto Centrale in Risalto */
    .suite-nav-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      top: -10px;
    }

    .suite-nav-circle-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      border: 3px solid #070d18;
      box-shadow: 0 6px 18px rgba(14, 165, 233, 0.55);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .suite-nav-circle-btn:active {
      transform: scale(0.86);
    }

    .suite-nav-circle-btn svg {
      width: 24px;
      height: 24px;
      stroke: #ffffff;
    }

    .suite-nav-center span {
      font-size: 10px;
      font-weight: 800;
      color: #38bdf8;
      margin-top: 3px;
    }

    /* BADGE NOTIFICA ROSSO */
    .suite-badge {
      position: absolute;
      top: 3px;
      right: 12px;
      width: 9px;
      height: 9px;
      background: #ef4444;
      border: 1.5px solid #070d18;
      border-radius: 50%;
      box-shadow: 0 0 8px #ef4444;
      animation: pulseBadge 2s infinite;
    }

    @keyframes pulseBadge {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    /* BANNER INSTALLA COME APP (POSIZIONATO IN BASSO SOPRA LA DOCK BAR) */
    #pwa-install-banner {
      position: fixed;
      bottom: 74px;
      left: 12px;
      right: 12px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 16px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.65);
      z-index: 999990;
      animation: slideUpBanner 0.4s ease-out;
    }

    @keyframes slideUpBanner {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .pwa-banner-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pwa-banner-text strong {
      font-size: 13px;
      color: #ffffff;
      font-weight: 700;
    }
    .pwa-banner-text span {
      font-size: 11px;
      color: #94a3b8;
    }
    .pwa-banner-btns {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .btn-pwa-add {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      color: #ffffff;
      border: none;
      padding: 7px 13px;
      border-radius: 10px;
      font-size: 11.5px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(14, 165, 233, 0.4);
    }
    .btn-pwa-close {
      background: none;
      border: none;
      color: #64748b;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
    }
  `;
  document.head.appendChild(style);

  // 2. FUNZIONE FEEDBACK APTICO / VIBRAZIONE
  function triggerHaptic(duration = 25) {
    try {
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(duration);
      }
    } catch(e) {}
  }
  // 3. RESOLVER DINAMICO INDIRIZZO HOME SUITE LAUNCHER
  function resolveLauncherUrl() {
    if (window.location.protocol === 'file:') {
      return '../launcher.html';
    }
    return '/launcher.html';
  }

  // 4. NAVIGAZIONE CON TRANSIZIONE FLUIDA E RESILIENTE
  function navigateWithTransition(url) {
    triggerHaptic(20);
    window.location.href = url;
  }

  // 5. GESTIONE AZIONE "INDIETRO" INTELLIGENTE E MULTILIVELLO
  function handleBackAction(e) {
    if (e) e.preventDefault();
    triggerHaptic(25);

    // Livello 1: Se c'è un modale aperto, chiudilo all'istante
    const activeModal = document.querySelector('.modal-overlay.active, .modal-overlay[style*="display: flex"], #suiteSecurityGateOverlay[style*="display: flex"]');
    if (activeModal) {
      if (activeModal.id === 'suiteSecurityGateOverlay') {
        navigateWithTransition(resolveLauncherUrl());
        return;
      }
      if (typeof window.closeModal === 'function') {
        window.closeModal(activeModal.id);
      } else {
        activeModal.classList.remove('active');
        activeModal.style.display = 'none';
        document.body.classList.remove('modal-open');
      }
      return;
    }

    // Livello 2: Se siamo su una tab secondaria (es. Terapie o Visite), torna alla prima tab principale (Dashboard)
    const navTabs = document.querySelectorAll('.nav-tab');
    if (navTabs.length > 1 && !navTabs[0].classList.contains('active')) {
      navTabs[0].click();
      return;
    }

    // Livello 3: Torna alla pagina precedente della Suite se presente, altrimenti torna al Launcher
    const ref = document.referrer || '';
    const currentOrigin = window.location.origin;
    const isInternalSuiteRef = ref && currentOrigin && ref.startsWith(currentOrigin) && !ref.includes(window.location.pathname);

    if (isInternalSuiteRef && window.history.length > 1) {
      document.body.classList.add('page-transitioning');
      setTimeout(() => {
        window.history.back();
        setTimeout(() => {
          document.body.classList.remove('page-transitioning');
        }, 500);
      }, 100);
    } else {
      navigateWithTransition(resolveLauncherUrl());
    }
  }

  // 6. CREAZIONE DOM DELLA BARRA
  const nav = document.createElement('nav');
  nav.id = 'suite-unified-bottom-nav';
  nav.innerHTML = `
    <!-- 1. INDIETRO -->
    <button type="button" class="suite-nav-btn" id="suite-btn-back" title="Torna Indietro">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      <span>Indietro</span>
    </button>

    <!-- 2. HOME SUITE -->
    <a href="/launcher.html" class="suite-nav-btn" id="suite-btn-home" title="Home Suite Launcher">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span>Home</span>
    </a>

    <!-- 3. AZIONE RAPIDA CENTRALE -->
    <div class="suite-nav-center">
      <a href="/launcher.html" class="suite-nav-circle-btn" id="suite-btn-menu" title="Menu Suite">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      </a>
      <span>Suite</span>
    </div>

    <!-- 4. BLOCCA CON PIN -->
    <button type="button" class="suite-nav-btn" id="suite-btn-lock" title="Blocca App con PIN" style="color:#f59e0b;">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span>Blocca</span>
    </button>

    <!-- 5. FLOTTA VEICOLI (CON BADGE NOTIFICA) -->
    <a href="/veicoli_mobile/" class="suite-nav-btn" id="suite-btn-flotta" title="Flotta Veicoli & Spese">
      <div class="suite-badge" title="Scadenze / Attenzioni attive"></div>
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
      <span>Flotta</span>
    </a>
  `;

  // Collega eventi con feedback aptico e animazione
  function bindNavEvents() {
    document.getElementById('suite-btn-back')?.addEventListener('click', handleBackAction);

    document.getElementById('suite-btn-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigateWithTransition(resolveLauncherUrl());
    });

    document.getElementById('suite-btn-menu')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigateWithTransition(resolveLauncherUrl());
    });

    document.getElementById('suite-btn-lock')?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerHaptic(50);
      if (typeof window.lockMilellaSuite === 'function') {
        window.lockMilellaSuite();
      }
    });

    document.getElementById('suite-btn-flotta')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigateWithTransition('/veicoli_mobile/');
    });
  }

  // =========================================================================
  // GESTIONE UNIFICATA & IMMEDIATA: BLOCCO SICUREZZA SUITE CON PIN (SECURITY GATE)
  // =========================================================================
  const SESSION_KEY = 'milella_session_unlocked';
  const LOCK_FLAG = 'milella_app_locked';

  function getCurrentAppInfo() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.includes('careassist')) return { title: 'CAREASSIST PRO', icon: '🩺' };
    if (p.includes('salute')) return { title: 'PROGETTO SALUTE', icon: '🫀' };
    if (p.includes('inventario')) return { title: 'INVENTARIO ATTREZZI', icon: '📦' };
    if (p.includes('veicoli')) return { title: 'FLOTTA VEICOLI & SPESE', icon: '🚗' };
    if (p.includes('ricettario')) return { title: 'IL RICETTARIO', icon: '🍽️' };
    if (p.includes('mednutri')) return { title: 'MEDNUTRI PRO', icon: '🥗' };
    return { title: 'SUITE C. MILELLA', icon: '🔐' };
  }

  function ensureSecurityGateUI() {
    let overlay = document.getElementById('suiteSecurityGateOverlay');
    if (overlay) return overlay;

    const info = getCurrentAppInfo();
    overlay = document.createElement('div');
    overlay.id = 'suiteSecurityGateOverlay';
    overlay.style.cssText = 'display:none; position:fixed; inset:0; z-index:2147483647 !important; background:rgba(7, 11, 20, 0.96); backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px); color:#fff; font-family:"Plus Jakarta Sans","Outfit","Inter",sans-serif; flex-direction:column; justify-content:center; align-items:center; padding:18px; text-align:center; box-sizing:border-box;';

    overlay.innerHTML = `
      <div style="background:rgba(255,255,255,0.05); border:1.5px solid rgba(212,175,55,0.55); border-radius:24px; padding:28px 22px; width:100%; max-width:390px; box-shadow:0 20px 60px rgba(0,0,0,0.85); box-sizing:border-box;">
        <div style="font-size:3.2rem; margin-bottom:6px; line-height:1;">🔒</div>
        <h2 style="margin:0 0 4px 0; font-size:1.35rem; font-weight:900; color:#f8fafc; letter-spacing:0.5px;">${info.icon} ${info.title}</h2>
        <div style="font-size:0.85rem; color:#d4af37; font-weight:800; margin-bottom:14px; text-transform:uppercase; letter-spacing:1px;">🔐 APPLICAZIONE BLOCCATA</div>
        <p style="font-size:0.88rem; color:#94a3b8; margin:0 0 18px 0; line-height:1.45;">Accesso riservato. Inserisci il PIN di sicurezza per continuare ad operare.</p>

        <div style="position:relative; margin-bottom:14px;">
          <input type="password" id="suiteGatePinInput" placeholder="Inserisci PIN..." maxlength="16" autocomplete="off" autocorrect="off" autocapitalize="characters" style="width:100%; padding:14px 44px 14px 16px; border-radius:14px; background:rgba(0,0,0,0.65); border:1.5px solid rgba(212,175,55,0.6); color:#fff; font-size:22px; text-align:center; letter-spacing:4px; outline:none; box-sizing:border-box; font-family:monospace; font-weight:800;">
          <button type="button" id="btnSuiteGatePinToggle" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#cbd5e1; font-size:18px; cursor:pointer; padding:4px;" title="Mostra/Nascondi PIN">👁️</button>
        </div>

        <div id="suiteGateErrorMsg" style="display:none; color:#f87171; font-size:0.85rem; font-weight:800; margin-bottom:14px; background:rgba(239,68,68,0.15); padding:10px 14px; border-radius:12px; border:1px solid rgba(239,68,68,0.4); text-align:center;"></div>

        <button type="button" id="btnSuiteGateUnlock" style="width:100%; padding:14px; background:linear-gradient(135deg, #d4af37 0%, #aa7c11 100%); color:#0b0f19; font-size:1rem; font-weight:900; border-radius:14px; border:none; cursor:pointer; box-shadow:0 6px 22px rgba(212,175,55,0.4); transition:transform 0.15s; margin-bottom:10px; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
          <span>🔓</span> SBLOCCA APPLICAZIONE
        </button>

        <button type="button" id="btnSuiteGateBiometric" style="display:none; width:100%; padding:12px; background:rgba(255,255,255,0.06); color:#38bdf8; font-size:0.92rem; font-weight:800; border-radius:14px; border:1px solid rgba(56,189,248,0.35); cursor:pointer; margin-bottom:10px;">
          👆 Accedi con Impronta Digitale
        </button>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; font-size:0.82rem; padding-top:12px; border-top:1px solid rgba(255,255,255,0.1);">
          <span style="color:#64748b;">Suite C. Milella</span>
          <a href="/launcher.html" style="color:#38bdf8; text-decoration:none; font-weight:800; display:inline-flex; align-items:center; gap:4px;">
            <span>Menu Suite</span> ➔
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const pinInp = document.getElementById('suiteGatePinInput');
    const eyeBtn = document.getElementById('btnSuiteGatePinToggle');
    const unlockBtn = document.getElementById('btnSuiteGateUnlock');
    const bioBtn = document.getElementById('btnSuiteGateBiometric');

    if (eyeBtn && pinInp) {
      eyeBtn.onclick = () => {
        pinInp.type = (pinInp.type === 'password') ? 'text' : 'password';
        eyeBtn.textContent = (pinInp.type === 'password') ? '👁️' : '🔒';
      };
    }

    if (pinInp) {
      pinInp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doVerifyPin();
        }
      };
    }

    if (unlockBtn) unlockBtn.onclick = doVerifyPin;
    if (bioBtn) bioBtn.onclick = doBiometricUnlock;

    if (window.PublicKeyCredential && localStorage.getItem('milella_last_authenticated_pin')) {
      if (bioBtn) bioBtn.style.display = 'block';
    }

    return overlay;
  }

  async function doVerifyPin() {
    const inp = document.getElementById('suiteGatePinInput');
    const err = document.getElementById('suiteGateErrorMsg');
    const pin = (inp ? inp.value : '').trim();

    if (!pin) {
      if (err) { err.textContent = 'Inserisci il PIN di sicurezza.'; err.style.display = 'block'; }
      return;
    }

    // 1. Verifica PIN Master SOS999 (immediata sia online che offline)
    const isMaster = (pin.toUpperCase() === 'SOS999');

    // 2. Verifica online con endpoint server se raggiungibile
    let serverOk = false;
    let authData = null;
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codice: pin })
      });
      if (resp.ok) {
        authData = await resp.json();
        if (authData && authData.success) {
          serverOk = true;
        }
      }
    } catch(e) {
      // Server offline o esecuzione locale
    }

    // 3. Verifica credenziali salvate localmente
    const savedPin = localStorage.getItem('milella_admin_pin') || localStorage.getItem('milella_user_pin') || localStorage.getItem('milella_last_authenticated_pin');
    const localMatch = savedPin && (savedPin.toLowerCase() === pin.toLowerCase());

    if (isMaster || serverOk || localMatch) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      // localStorage.setItem(SESSION_KEY, 'true');
      localStorage.setItem('milella_session_unlocked_time', String(Date.now()));
      sessionStorage.removeItem(LOCK_FLAG);

      if (isMaster) {
        localStorage.setItem('milella_role', 'admin');
        localStorage.setItem('milella_last_authenticated_role', 'admin');
        localStorage.setItem('milella_admin_pin', 'SOS999');
        localStorage.setItem('milella_app_abilitate', JSON.stringify(['all']));
        localStorage.setItem('milella_paz_abilitati', JSON.stringify(['all']));
        localStorage.setItem('milella_profili_salute', JSON.stringify(['all']));
        localStorage.setItem('milella_last_authenticated_paz', JSON.stringify(['all']));
      }
      if (authData) {
        if (authData.nome) localStorage.setItem('milella_user_nome', authData.nome);
        if (authData.ruolo) {
          localStorage.setItem('milella_role', authData.ruolo);
          localStorage.setItem('milella_last_authenticated_role', authData.ruolo);
        }
        if (authData.ruolo === 'admin') {
          localStorage.setItem('milella_admin_pin', pin);
          localStorage.setItem('milella_app_abilitate', JSON.stringify(['all']));
          localStorage.setItem('milella_paz_abilitati', JSON.stringify(['all']));
          localStorage.setItem('milella_profili_salute', JSON.stringify(['all']));
          localStorage.setItem('milella_last_authenticated_paz', JSON.stringify(['all']));
        } else {
          localStorage.removeItem('milella_admin_pin');
          localStorage.setItem('milella_user_pin', pin);
          if (authData.appAbilitate) localStorage.setItem('milella_app_abilitate', JSON.stringify(authData.appAbilitate));
          if (authData.pazAbilitati) localStorage.setItem('milella_paz_abilitati', JSON.stringify(authData.pazAbilitati));
          if (authData.profiliSalute) localStorage.setItem('milella_profili_salute', JSON.stringify(authData.profiliSalute));
        }
        if (authData.token) localStorage.setItem('milella_token', authData.token);
      }
      localStorage.setItem('milella_last_authenticated_pin', pin);
      if (typeof window.renderAll === 'function') window.renderAll();

      const overlay = document.getElementById('suiteSecurityGateOverlay');
      if (overlay) {
        overlay.style.transition = 'opacity 0.2s ease-out';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.style.display = 'none';
          overlay.style.opacity = '1';
        }, 200);
      }

      document.body.classList.remove('modal-open');
      const navEl = document.getElementById('suite-unified-bottom-nav');
      if (navEl) navEl.style.display = '';

      if (typeof window.showToast === 'function') {
        window.showToast('🔓 Applicazione Sbloccata con Successo!', 'success');
      }
    } else {
      triggerHaptic(60);
      if (err) {
        err.textContent = '❌ PIN non corretto. Riprova o usa il PIN Master SOS999.';
        err.style.display = 'block';
      }
      if (inp) {
        inp.value = '';
        inp.focus();
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
    const inp = document.getElementById('suiteGatePinInput');
    if (inp) inp.value = savedPin;
    doVerifyPin();
  }

  window.lockMilellaSuite = function() {
    triggerHaptic(50);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('milella_session_unlocked_time');
    sessionStorage.setItem(LOCK_FLAG, 'true');

    const overlay = ensureSecurityGateUI();
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
      document.body.classList.add('modal-open');
      const navEl = document.getElementById('suite-unified-bottom-nav');
      if (navEl) navEl.style.display = 'none';

      setTimeout(() => {
        const inp = document.getElementById('suiteGatePinInput');
        const err = document.getElementById('suiteGateErrorMsg');
        if (err) err.style.display = 'none';
        if (inp) { inp.value = ''; inp.focus(); }
      }, 150);
    }
  };
  window.lockSaluteApp = window.lockMilellaSuite;

  // Auto-ripristino stato blocco se ricaricata pagina mentre bloccata
  if (sessionStorage.getItem(LOCK_FLAG) === 'true') {
    setTimeout(window.lockMilellaSuite, 50);
  }

  // 5. BANNER PWA / "AGGIUNGI A SCHERMATA HOME"
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showPwaBanner();
  });

  function showPwaBanner() {
    if (localStorage.getItem('pwa_banner_dismissed') === 'true') return;
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-text">
        <strong>📱 Installa Suite Milella</strong>
        <span>Aggiungi alla schermata Home come App nativa</span>
      </div>
      <div class="pwa-banner-btns">
        <button class="btn-pwa-add" id="btn-pwa-install">Installa</button>
        <button class="btn-pwa-close" id="btn-pwa-dismiss">✕</button>
      </div>
    `;

    document.body.prepend(banner);

    document.getElementById('btn-pwa-install')?.addEventListener('click', async () => {
      triggerHaptic(30);
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
      } else {
        alert("Per installare l'App su Brave/Chrome:\n1. Tocca i 3 puntini ⋮ in alto a destra\n2. Scegli 'Aggiungi a schermata Home'");
      }
      banner.remove();
    });

    document.getElementById('btn-pwa-dismiss')?.addEventListener('click', () => {
      triggerHaptic(15);
      localStorage.setItem('pwa_banner_dismissed', 'true');
      banner.remove();
    });
  }

  // Mostra banner suggerimento dopo 3 secondi se su cellulare e non ancora salvato
  if (window.innerWidth <= 900 && !window.matchMedia('(display-mode: standalone)').matches) {
    setTimeout(showPwaBanner, 2500);
  }

  
  // INSERIMENTO A CARICAMENTO DOM
  function mount() {
    if (document.getElementById('suite-unified-bottom-nav') || document.getElementById('mednutri-mobile-bar') || document.querySelector('.mobile-bottom-bar')) return;
    document.body.appendChild(nav);
    bindNavEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

