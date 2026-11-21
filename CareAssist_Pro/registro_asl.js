// ============================================================================
// SUITE MILELLA - REGISTRO ANAGRAFE SANITARIA & TRIAGE ADI/ASL ENTERPRISE
// Motore di ricerca ad alte prestazioni per centinaia/migliaia di assistiti
// ============================================================================

let _filtroAslAttivo = 'tutti'; // 'tutti', 'ritardi', 'allettati', 'deambulanti', 'recenti'
let _queryAslAttiva = '';

function apriRegistroSanitarioAsl() {
  const modal = document.getElementById('modal-registro-asl-enterprise');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const inputSearch = document.getElementById('asl-search-input');
  if (inputSearch) {
    inputSearch.value = _queryAslAttiva;
    setTimeout(() => inputSearch.focus(), 150);
  }

  renderizzaGrigliaPazientiAsl();
}

function chiudiRegistroSanitarioAsl() {
  const modal = document.getElementById('modal-registro-asl-enterprise');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function impostaFiltroAsl(filtro, elBtn) {
  _filtroAslAttivo = filtro;
  document.querySelectorAll('.asl-pill-filter').forEach(btn => btn.classList.remove('active'));
  if (elBtn) elBtn.classList.add('active');
  renderizzaGrigliaPazientiAsl();
}

function filtraPazientiAsl(query) {
  _queryAslAttiva = (query || '').toLowerCase().trim();
  renderizzaGrigliaPazientiAsl();
}

function renderizzaGrigliaPazientiAsl() {
  const container = document.getElementById('asl-grid-pazienti');
  const countBadge = document.getElementById('asl-total-count');
  if (!container) return;

  const tuttiPazienti = (typeof getPazientiAccessibili === 'function')
    ? getPazientiAccessibili()
    : ((typeof AppData !== 'undefined' && Array.isArray(AppData.pazienti)) ? AppData.pazienti : []);
  const activeId = (typeof AppData !== 'undefined') ? AppData.activePazienteId : null;

  // Se l'operatore non è admin, nascondi il tasto "+ Nuovo Assistito" e cestino
  const role = localStorage.getItem('milella_role') || localStorage.getItem('milella_last_authenticated_role');
  const btnNuovoAsl = document.querySelector('.asl-new-patient-btn');
  if (btnNuovoAsl) {
    btnNuovoAsl.style.display = (role === 'admin') ? 'inline-flex' : 'none';
  }
  const cestinoFl = document.getElementById('win-desktop-floating-trash');
  if (cestinoFl && role !== 'admin') {
    cestinoFl.style.setProperty('display', 'none', 'important');
  }

  let appAbilitate = [];
  try {
    appAbilitate = JSON.parse(localStorage.getItem('milella_app_abilitate') || '[]');
  } catch(e) { appAbilitate = []; }
  const haAmbulatorio = role === 'admin' || appAbilitate.includes('all') || appAbilitate.includes('app_mednutri');
  const haSalute = role === 'admin' || appAbilitate.includes('all') || appAbilitate.includes('app_salute');

  // Filtro combinato Testo + Categoria Triage
  const filtrati = tuttiPazienti.filter(p => {
    // Calcolo ritardi farmaci
    const numRitardi = (p.terapie || []).filter(t => {
      if (typeof isTerapiaPrevistaOggi === 'function' && typeof verificaStatoOrarioFarmaco === 'function') {
        return isTerapiaPrevistaOggi(t) && !t.fattoOggi && !t.saltatoOggi && verificaStatoOrarioFarmaco(t.ora).inRitardo;
      }
      return false;
    }).length;

    // Filtro per query
    if (_queryAslAttiva) {
      const matchNome = (p.nome || '').toLowerCase().includes(_queryAslAttiva);
      const matchIndirizzo = (p.indirizzo || '').toLowerCase().includes(_queryAslAttiva);
      const matchPatologie = (p.patologie || []).some(pat => pat.toLowerCase().includes(_queryAslAttiva));
      const matchCodice = (p.id || '').toLowerCase().includes(_queryAslAttiva);
      if (!matchNome && !matchIndirizzo && !matchPatologie && !matchCodice) return false;
    }

    // Filtro categoria triage
    if (_filtroAslAttivo === 'ritardi' && numRitardi === 0) return false;
    if (_filtroAslAttivo === 'allettati' && !p.allettato) return false;
    if (_filtroAslAttivo === 'deambulanti' && p.allettato) return false;
    return true;
  });

  if (countBadge) {
    const isRistretto = role !== 'admin' && typeof AppData !== 'undefined' && Array.isArray(AppData.pazienti) && tuttiPazienti.length < AppData.pazienti.length;
    countBadge.textContent = isRistretto
      ? `${filtrati.length} di ${tuttiPazienti.length} Assistiti Assegnati`
      : `${filtrati.length} di ${tuttiPazienti.length} Assistiti`;
  }

  if (filtrati.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 48px 20px; background:#f8fafc; border: 2px dashed #cbd5e1; border-radius:18px;">
        <span style="font-size:3rem; display:block; margin-bottom:10px;">🔍</span>
        <h4 style="font-size:1.1rem; color:#1e293b; margin:0 0 6px 0;">Nessun assistito corrisponde ai criteri</h4>
        <p style="font-size:0.88rem; color:#64748b; margin:0;">Prova a modificare i termini di ricerca o azzera i filtri.</p>
        <button type="button" onclick="resetFiltriAsl()" style="margin-top:14px; background:#0284c7; color:#fff; border:none; padding:8px 18px; border-radius:10px; font-weight:700; cursor:pointer;">
          Mostra Tutti gli Assistiti
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtrati.map(p => {
    const isAttivo = (p.id === activeId);
    const eta = (typeof calcolaAnniDaData === 'function') ? calcolaAnniDaData(p.dataNascita) : '--';
    const numRitardi = (p.terapie || []).filter(t => {
      if (typeof isTerapiaPrevistaOggi === 'function' && typeof verificaStatoOrarioFarmaco === 'function') {
        return isTerapiaPrevistaOggi(t) && !t.fattoOggi && !t.saltatoOggi && verificaStatoOrarioFarmaco(t.ora).inRitardo;
      }
      return false;
    }).length;

    const avInfo = (typeof getDettagliAvatarPaziente === 'function') ? getDettagliAvatarPaziente(p) : { emoji: '👤', isFemmina: false };
    const pulitoNome = (p.nome || '').replace(/\s*\(\d+\s*anni\)/gi, '').trim();
    const terapieTot = (p.terapie || []).length;

    return `
      <div class="asl-patient-card ${isAttivo ? 'active-card' : ''}" onclick="selezionaAssistitoDaAsl('${p.id}')">
        <!-- HEADER CARD -->
        <div class="asl-card-header">
          <div class="asl-card-avatar" style="background:${avInfo.isFemmina ? 'linear-gradient(135deg, #f472b6, #db2777)' : 'linear-gradient(135deg, #38bdf8, #0284c7)'};">
            <span>${avInfo.emoji}</span>
          </div>
          <div class="asl-card-info">
            <div class="asl-card-title-row">
              <h3 class="asl-card-name" title="${pulitoNome}">${pulitoNome}</h3>
              ${isAttivo ? '<span class="asl-badge-active">IN CARICO ORA</span>' : ''}
            </div>
            <div class="asl-card-meta">
              <span>🎂 ${eta} anni</span>
              <span>•</span>
              <span class="asl-badge-triage ${p.allettato ? 'badge-triage-red' : 'badge-triage-green'}">
                ${p.allettato ? '🛏️ Allettato (q2h)' : '🚶 Deambulante'}
              </span>
            </div>
          </div>
        </div>

        <!-- DETTAGLI TERRITORIO & CLINICA -->
        <div class="asl-card-body">
          <div class="asl-detail-row">
            <span class="asl-icon">📍</span>
            <span class="asl-text" title="${p.indirizzo || 'Indirizzo non registrato'}">${p.indirizzo || 'Domicilio non specificato'}</span>
          </div>
          <div class="asl-detail-row">
            <span class="asl-icon">💊</span>
            <span class="asl-text">Piano Terapeutico: <b>${terapieTot} farmaci prescritti</b></span>
          </div>
        </div>

        <!-- FOOTER: STATUS ALLERTE & CROSS-APP BRIDGES -->
        <div class="asl-card-footer">
          <div class="asl-status-alert">
            ${numRitardi > 0 
              ? `<span class="asl-alert-critico">🚨 ${numRitardi} RITARDI</span>` 
              : `<span class="asl-alert-ok">✅ In regola</span>`}
          </div>

          <div class="asl-bridge-actions" onclick="event.stopPropagation()">
            ${haAmbulatorio ? `
            <button type="button" class="asl-btn-bridge med" onclick="navigaAdAmbulatorioPaziente('${encodeURIComponent(pulitoNome)}')" title="Apri Ambulatorio Medico">
              🩺 Ambulatorio
            </button>` : ''}
            ${haSalute ? `
            <button type="button" class="asl-btn-bridge salute" onclick="navigaASalutePaziente('${encodeURIComponent(pulitoNome)}')" title="Apri Progetto Salute">
              🥗 Salute
            </button>` : ''}
            <button type="button" class="asl-btn-select" onclick="selezionaAssistitoDaAsl('${p.id}')" title="Apri Cartella CareAssist">
              ${isAttivo ? 'Aperto' : 'Apri ➔'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function resetFiltriAsl() {
  _filtroAslAttivo = 'tutti';
  _queryAslAttiva = '';
  const inputSearch = document.getElementById('asl-search-input');
  if (inputSearch) inputSearch.value = '';
  document.querySelectorAll('.asl-pill-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'tutti');
  });
  renderizzaGrigliaPazientiAsl();
}

function selezionaAssistitoDaAsl(pazId) {
  if (typeof cambiaPaziente === 'function') {
    cambiaPaziente(pazId);
  } else if (typeof AppData !== 'undefined') {
    AppData.activePazienteId = pazId;
    if (typeof saveDb === 'function') saveDb();
    if (typeof renderAll === 'function') renderAll();
  }
  chiudiRegistroSanitarioAsl();
}

function navigaAdAmbulatorioPaziente(encodedName) {
  chiudiRegistroSanitarioAsl();
  localStorage.setItem('milella_active_patient_name', decodeURIComponent(encodedName));
  window.location.href = '/mednutri/?patient=' + encodedName;
}

function navigaASalutePaziente(encodedName) {
  chiudiRegistroSanitarioAsl();
  localStorage.setItem('milella_active_patient_name', decodeURIComponent(encodedName));
  window.location.href = '/salute/?profile=' + encodedName;
}

// Supporto scorciatoia tastiera F2 / CTRL+K per aprire la ricerca ASL
document.addEventListener('keydown', function(e) {
  if (e.key === 'F2' || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    apriRegistroSanitarioAsl();
  } else if (e.key === 'Escape') {
    chiudiRegistroSanitarioAsl();
  }
});

// Alias per compatibilità con l'apertura rapida esistente
window.apriSwitchPazienteRapido = apriRegistroSanitarioAsl;
window.apriRegistroSanitarioAsl = apriRegistroSanitarioAsl;
window.chiudiRegistroSanitarioAsl = chiudiRegistroSanitarioAsl;
window.impostaFiltroAsl = impostaFiltroAsl;
window.filtraPazientiAsl = filtraPazientiAsl;
window.resetFiltriAsl = resetFiltriAsl;
window.selezionaAssistitoDaAsl = selezionaAssistitoDaAsl;
