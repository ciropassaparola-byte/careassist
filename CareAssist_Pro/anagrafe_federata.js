// ============================================================================
// SUITE MILELLA - 1-CLICK SMART IMPORT & ANAGRAFE CONDIVISA
// Permette di importare con 1 clic qualsiasi soggetto presente nell'ecosistema
// (es. Maria Carmela Stoppelli da Progetto Salute in CareAssist Pro o in Ambulatorio)
// ============================================================================

let _soggettiSuiteCache = [];

async function caricaAnagrafeCondivisaSuite() {
  try {
    const res = await fetch('/api/suite/anagrafe-condivisa');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.soggetti) && data.soggetti.length > 0) {
        _soggettiSuiteCache = data.soggetti;
        garantisciPazientiNelContestoLocale();
        popolaSelettoreImportSuite();
        return;
      }
    }
  } catch(e) {
    console.warn('API non raggiungibile, fallback locale:', e.message);
  }
  costruisciFallbackLocaleAnagrafe();
}

function costruisciFallbackLocaleAnagrafe() {
  const map = new Map();
  // 1. CareAssist
  if (typeof AppData !== 'undefined' && Array.isArray(AppData.pazienti)) {
    AppData.pazienti.forEach(p => {
      if (p && p.nome) {
        map.set(p.nome.trim().toLowerCase(), {
          nome: p.nome.trim(),
          dataNascita: p.dataNascita || '',
          sesso: p.sesso || 'M',
          indirizzo: p.indirizzo || '',
          telefono: p.telefono || p.cellulare || '',
          origini: ['CareAssist Pro']
        });
      }
    });
  }

  // 2. Soggetti noti della Suite (Maria Carmela Stoppelli & Ciro Milella da Progetto Salute)
  const ciroNome = localStorage.getItem('profileName_marito') || 'Ciro Milella';
  const mariaNome = localStorage.getItem('profileName_moglie') || 'Maria Carmela';
  const mariaFull = mariaNome.toLowerCase().includes('stoppelli') ? mariaNome : mariaNome + ' Stoppelli';

  map.set('maria carmela', {
    nome: mariaFull,
    dataNascita: '1969-03-20',
    sesso: 'F',
    indirizzo: 'Via Giulio Petroni, 69 - BARI (BA)',
    telefono: '347 123 4567',
    origini: ['Progetto Salute']
  });

  map.set('ciro milella', {
    nome: ciroNome.trim(),
    dataNascita: '1967-12-16',
    sesso: 'M',
    indirizzo: 'Via Giulio Petroni, 69 - BARI (BA)',
    telefono: '338 000 0000',
    origini: ['Progetto Salute']
  });

  _soggettiSuiteCache = Array.from(map.values());
  garantisciPazientiNelContestoLocale();
  popolaSelettoreImportSuite();
}

// Inietta immediatamente i pazienti della Suite in AppData se mancano
function garantisciPazientiNelContestoLocale() {
  if (typeof AppData === 'undefined' || !AppData || !Array.isArray(AppData.pazienti)) return;

  let modificato = false;
  _soggettiSuiteCache.forEach(s => {
    const nomeNorm = s.nome.trim().toLowerCase();
    const giaPresente = AppData.pazienti.some(p => {
      const pNorm = (p.nome || '').trim().toLowerCase();
      return pNorm === nomeNorm || 
             (nomeNorm.includes('maria carmela') && pNorm.includes('maria carmela')) ||
             (nomeNorm.includes('ciro milella') && pNorm.includes('ciro milella'));
    });

    if (!giaPresente) {
      console.log('✨ Auto-iniezione paziente Suite in CareAssist:', s.nome);
      AppData.pazienti.push({
        id: s.id || 'paz_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        nome: s.nome,
        dataNascita: s.dataNascita || '1969-03-20',
        sesso: s.sesso || 'F',
        indirizzo: s.indirizzo || 'Via Giulio Petroni, 69 - BARI (BA)',
        telefono: s.telefono || '',
        cellulare: s.telefono || '',
        allettato: false,
        patologie: s.patologie || ['Nutrizione & Benessere'],
        terapie: [],
        visite: [],
        diario: []
      });
      modificato = true;
    } else {
      // Se è Maria Carmela ma non ha cognome Stoppelli, aggiorniamo il nome completo
      const mcPaz = AppData.pazienti.find(p => (p.nome || '').toLowerCase().includes('maria carmela'));
      if (mcPaz && !mcPaz.nome.toLowerCase().includes('stoppelli')) {
        mcPaz.nome = 'Maria Carmela Stoppelli';
        modificato = true;
      }
    }
  });

  if (modificato) {
    if (window._initialSyncDone && typeof saveDb === 'function') {
      saveDb();
    } else {
      try { localStorage.setItem('careassist_pro_db_v2', JSON.stringify(AppData)); } catch(e) {}
    }
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderizzaGrigliaPazientiAsl === 'function') renderizzaGrigliaPazientiAsl();
  }
}

function popolaSelettoreImportSuite() {
  const container = document.getElementById('box-importa-suite');
  if (!container) return;

  container.style.display = 'block';
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <span style="font-size:12.5px; font-weight:800; color:#0369a1; display:flex; align-items:center; gap:6px;">
        <span>🏛️</span> <span>Importa Paziente dalla Suite (Condivisione Master)</span>
      </span>
      <span style="font-size:11px; background:#0284c7; color:#ffffff; padding:2px 8px; border-radius:10px; font-weight:700;">
        ${_soggettiSuiteCache.length} Pazienti Condivisi
      </span>
    </div>

    <!-- BARRA DI RICERCA SMART CON AUTOCOMPLETAMENTO AD ALTO CONTRASTO -->
    <div style="position:relative; width:100%;" id="careassist-search-box-wrapper">
      <div style="display:flex; align-items:center; background:#ffffff; border:1.5px solid #0284c7; border-radius:10px; padding:2px 10px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <span style="font-size:15px; margin-right:8px; color:#64748b;">🔍</span>
        <input type="text" id="careassist-suite-search-input" 
               placeholder="Cerca per Nome, Anno o Telefono (es. Rosa, 1938, Zamparino)..." 
               autocomplete="off"
               onfocus="mostraDropdownCareAssistSuite(true)" 
               oninput="filtraPazientiCareAssistSuite(this.value)"
               style="border:none !important; outline:none !important; width:100%; padding:8px 0; font-size:13px; font-weight:600; color:#0f172a; background:transparent !important; box-shadow:none !important;">
        <button type="button" id="careassist-suite-clear-btn" onclick="pulisciRicercaCareAssistSuite()" style="display:none; background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:0 4px;">✕</button>
      </div>

      <!-- DROPDOWN RISULTATI SCALABILE CON SCROLL ELEGANTE -->
      <div id="careassist-suite-dropdown" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; background:#ffffff; border:1.5px solid #0284c7; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.18); max-height:240px; overflow-y:auto; z-index:99999; padding:4px 0;">
      </div>
    </div>

    <!-- CHIP RAPIDI AD ALTO CONTRASTO (I PRIMI 4) -->
    <div style="display:flex; align-items:center; gap:6px; margin-top:8px; flex-wrap:wrap; font-size:11.5px;">
      <span style="font-weight:700; color:#475569;">Rapidi:</span>
      <div id="careassist-suite-chips-row" style="display:inline-flex; gap:6px; flex-wrap:wrap;"></div>
    </div>

    <div id="import-suite-feedback" style="display:none; margin-top:8px; font-size:12px; color:#15803d; font-weight:800; background:#dcfce7; padding:6px 12px; border-radius:8px; border:1px solid #86efac;"></div>
  `;

  aggiornaChipRapidiCareAssist();
}

function aggiornaChipRapidiCareAssist() {
  const container = document.getElementById('careassist-suite-chips-row');
  if (!container) return;

  const rapidi = _soggettiSuiteCache.slice(0, 4);
  container.innerHTML = rapidi.map((s, idx) => {
    const isFem = (s.sesso && (s.sesso.toUpperCase() === 'F' || s.sesso.toLowerCase().includes('donna')));
    const emoji = isFem ? '👩' : '👨';
    const borderCol = isFem ? '#f472b6' : '#38bdf8';
    const year = s.dataNascita ? s.dataNascita.split('-')[0] : '';

    return `
      <button type="button" onclick="selezionaPazienteCareAssistSuite('${idx}')" 
              style="background:#ffffff; color:#0f172a; border:1px solid ${borderCol}; padding:4px 10px; border-radius:8px; font-weight:700; font-size:11.5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:all 0.15s;"
              onmouseover="this.style.background='#f0f9ff'; this.style.borderColor='#0284c7';"
              onmouseout="this.style.background='#ffffff'; this.style.borderColor='${borderCol}';">
        <span>${emoji}</span>
        <span>${s.nome}</span>
        ${year ? `<span style="font-size:10px; color:#64748b; background:#f1f5f9; padding:1px 4px; border-radius:4px;">${year}</span>` : ''}
      </button>
    `;
  }).join('') + (_soggettiSuiteCache.length > 4 ? `<span style="font-size:11px; color:#0284c7; font-weight:600; margin-left:4px;">+ altri ${_soggettiSuiteCache.length - 4} nella ricerca 🔍</span>` : '');
}

window.filtraPazientiCareAssistSuite = function(query) {
  const dropdown = document.getElementById('careassist-suite-dropdown');
  const clearBtn = document.getElementById('careassist-suite-clear-btn');
  if (!dropdown) return;

  const q = (query || '').toLowerCase().trim();
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

  if (!_soggettiSuiteCache || _soggettiSuiteCache.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px; color:#64748b; font-size:12px; text-align:center;">Nessun assistito in memoria</div>';
    dropdown.style.display = 'block';
    return;
  }

  const filtrati = _soggettiSuiteCache.map((s, idx) => ({ ...s, originalIdx: idx })).filter(s => {
    if (!q) return true;
    const nomeMatch = (s.nome || '').toLowerCase().includes(q);
    const dobMatch = (s.dataNascita || '').includes(q);
    const telMatch = (s.telefono || '').includes(q);
    const indMatch = (s.indirizzo || '').toLowerCase().includes(q);
    return nomeMatch || dobMatch || telMatch || indMatch;
  });

  if (filtrati.length === 0) {
    dropdown.innerHTML = `<div style="padding:12px; color:#64748b; font-size:12px; text-align:center;">Nessun assistito corrisponde a "<strong>${query}</strong>"</div>`;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtrati.map(s => {
    const isFem = (s.sesso && (s.sesso.toUpperCase() === 'F' || s.sesso.toLowerCase().includes('donna')));
    const emoji = isFem ? '👩' : '👨';
    const year = s.dataNascita ? s.dataNascita.split('-')[0] : '';
    const originiStr = (s.origini || []).join(' • ');

    return `
      <div onclick="selezionaPazienteCareAssistSuite('${s.originalIdx}')" 
           style="display:flex; justify-content:space-between; align-items:center; padding:9px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:background 0.15s;"
           onmouseover="this.style.background='#f0f9ff';" 
           onmouseout="this.style.background='#ffffff';">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">${emoji}</span>
          <div>
            <div style="font-weight:800; font-size:13px; color:#0f172a;">${s.nome}</div>
            <div style="font-size:11px; color:#64748b;">${originiStr ? originiStr + ' • ' : ''}${s.dataNascita || 'Data n.d.'}${s.indirizzo ? ' • ' + s.indirizzo : ''}</div>
          </div>
        </div>
        <span style="font-size:11px; font-weight:700; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:6px;">
          ${year ? 'Anno ' + year : '1-Click'}
        </span>
      </div>
    `;
  }).join('');

  dropdown.style.display = 'block';
};

window.mostraDropdownCareAssistSuite = function(mostra) {
  const input = document.getElementById('careassist-suite-search-input');
  if (mostra) {
    filtraPazientiCareAssistSuite(input ? input.value : '');
  } else {
    setTimeout(() => {
      const dropdown = document.getElementById('careassist-suite-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    }, 250);
  }
};

window.pulisciRicercaCareAssistSuite = function() {
  const input = document.getElementById('careassist-suite-search-input');
  if (input) { input.value = ''; input.focus(); }
  filtraPazientiCareAssistSuite('');
};

window.selezionaPazienteCareAssistSuite = function(idxStr) {
  applicaImportazionePazienteSuite(idxStr);
  const dropdown = document.getElementById('careassist-suite-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  const s = _soggettiSuiteCache[parseInt(idxStr, 10)];
  const input = document.getElementById('careassist-suite-search-input');
  if (input && s) {
    input.value = s.nome;
    const clearBtn = document.getElementById('careassist-suite-clear-btn');
    if (clearBtn) clearBtn.style.display = 'block';
  }
};

document.addEventListener('click', function(e) {
  const box = document.getElementById('careassist-search-box-wrapper');
  const dropdown = document.getElementById('careassist-suite-dropdown');
  if (dropdown && box && !box.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

function applicaImportazionePazienteSuite(indexStr) {
  if (indexStr === '' || indexStr === null || indexStr === undefined) return;
  const idx = parseInt(indexStr, 10);
  const nomiEsistenti = (typeof AppData !== 'undefined' && Array.isArray(AppData.pazienti))
    ? AppData.pazienti.map(p => (p.nome || '').trim().toLowerCase())
    : [];
  const importabili = _soggettiSuiteCache.filter(s => !nomiEsistenti.includes(s.nome.trim().toLowerCase()));
  const s = _soggettiSuiteCache[idx] || importabili[idx];
  if (!s) return;

  // 1. Compila Nome
  const elNome = document.getElementById('nuovo-paz-nome');
  if (elNome) elNome.value = s.nome;

  // 2. Compila Data di Nascita
  if (s.dataNascita) {
    const elData = document.getElementById('nuovo-paz-nascita');
    if (elData) {
      elData.value = s.dataNascita;
      if (typeof sincronizzaSelectsDaData === 'function') sincronizzaSelectsDaData('nuovo', s.dataNascita);
      if (typeof calcolaEtaDinamica === 'function') calcolaEtaDinamica(s.dataNascita);
    }
  }

  // 3. Compila Sesso
  if (s.sesso) {
    const isFem = (s.sesso.toUpperCase() === 'F' || s.sesso.toLowerCase().includes('donna') || s.sesso.toLowerCase().includes('moglie'));
    const rFem = document.getElementById('nuovo-paz-sesso-f') || document.querySelector('input[name="nuovo-sesso"][value="F"]');
    const rMas = document.getElementById('nuovo-paz-sesso-m') || document.querySelector('input[name="nuovo-sesso"][value="M"]');
    if (isFem && rFem) rFem.checked = true;
    else if (!isFem && rMas) rMas.checked = true;
  }

  // 4. Compila Indirizzo
  if (s.indirizzo) {
    const elInd = document.getElementById('nuovo-paz-indirizzo');
    if (elInd) elInd.value = s.indirizzo;
  }

  // 5. Compila Telefono
  if (s.telefono) {
    const elTel = document.getElementById('nuovo-paz-cellulare') || document.getElementById('nuovo-paz-telefono');
    if (elTel) elTel.value = s.telefono;
  }

  // Feedback visivo immediato
  const banner = document.getElementById('import-suite-feedback');
  if (banner) {
    banner.style.display = 'block';
    banner.innerHTML = `✅ Dati di <b>${s.nome}</b> importati con successo! Controlla e clicca su "Crea Cartella Clinica".`;
  }
}

// Esegui caricamento immediato all'avvio
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(caricaAnagrafeCondivisaSuite, 200);
  });
} else {
  setTimeout(caricaAnagrafeCondivisaSuite, 200);
}

// Aggancia l'evento openModal
const originalOpenModalNuovo = window.openModal;
window.openModal = function(id) {
  if (typeof originalOpenModalNuovo === 'function') {
    originalOpenModalNuovo(id);
  } else {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); el.style.display = 'flex'; }
  }
  if (id === 'modal-nuovo-paziente') {
    caricaAnagrafeCondivisaSuite();
  }
};

window.caricaAnagrafeCondivisaSuite = caricaAnagrafeCondivisaSuite;
window.applicaImportazionePazienteSuite = applicaImportazionePazienteSuite;
