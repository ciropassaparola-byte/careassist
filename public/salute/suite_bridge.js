// ============================================================================
// SUITE MILELLA - PROGETTO SALUTE ECOSYSTEM BRIDGE
// Riceve e sincronizza in tempo reale il paziente/profilo attivo dalla Suite
// ============================================================================
(function() {
  function getQueryParam(name) {
    try {
      const u = new URLSearchParams(window.location.search);
      return u.get(name);
    } catch(e) { return null; }
  }

  // ============================================================================
  // IMPORTAZIONE BIDIREZIONALE REAL-TIME DA ANAGRAFE SUITE (CAREASSIST & MEDNUTRI)
  // ============================================================================
  async function sincronizzaPazientiDellaSuiteInSalute() {
    try {
      const res = await fetch('/api/suite/anagrafe-condivisa');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.soggetti) || data.soggetti.length === 0) return;

      let hp = [];
      try { hp = JSON.parse(localStorage.getItem('health_profiles') || '["marito","moglie"]'); } catch(e){ hp = ['marito','moglie']; }
      let cambiato = false;

      data.soggetti.forEach(s => {
        if (!s || !s.nome) return;
        const nLower = s.nome.trim().toLowerCase();
        
        // Se è Ciro o Maria Carmela, aggiorno solo eventuali dati mancanti
        if (nLower.includes('ciro') && nLower.includes('milella')) {
          if (!localStorage.getItem('profileName_marito')) localStorage.setItem('profileName_marito', s.nome);
          return;
        }
        if (nLower.includes('maria') && nLower.includes('carmela')) {
          if (!localStorage.getItem('profileName_moglie')) localStorage.setItem('profileName_moglie', s.nome);
          return;
        }

        // Genera ID profilo univoco e pulito per Progetto Salute
        const pid = nLower.replace(/[^a-z0-9]/g, '');
        if (!pid) return;

        if (!hp.includes(pid)) {
          hp.push(pid);
          cambiato = true;
          console.log('🌿 Progetto Salute: Aggancio automatico assistito dalla Suite ->', s.nome);
        }

        // Memorizza dettagli profilo se mancanti
        if (!localStorage.getItem('profileName_' + pid)) {
          localStorage.setItem('profileName_' + pid, s.nome.trim());
          cambiato = true;
        }

        if (!localStorage.getItem('profileStats_' + pid)) {
          const stats = {
            dob: s.dataNascita || '',
            gender: (s.sesso && s.sesso.toUpperCase().startsWith('F')) ? 'F' : 'M',
            start: s.peso || '---',
            height: s.altezza || '---',
            goal: s.targetPeso || '---',
            kcal: s.kcalTarget || '---'
          };
          localStorage.setItem('profileStats_' + pid, JSON.stringify(stats));
          cambiato = true;
        }
      });

      if (cambiato) {
        localStorage.setItem('health_profiles', JSON.stringify(hp));
        if (typeof window.globalProfiles !== 'undefined') window.globalProfiles = hp;
        if (typeof getVisibleHealthProfiles === 'function') {
          window.visibleProfiles = getVisibleHealthProfiles();
        } else if (typeof window.visibleProfiles !== 'undefined') {
          window.visibleProfiles = hp;
        }
        if (typeof renderTabs === 'function') renderTabs();
        if (typeof renderProfiles === 'function') renderProfiles();
      }
    } catch(err) {
      console.warn('Sync federata Progetto Salute:', err.message);
    }
  }

  function mappaPazienteAProfiloSalute(nome) {
    if (!nome) return null;
    const n = nome.toLowerCase().trim();
    if (n.includes('ciro') || n.includes('milella') || n.includes('marito')) return 'marito';
    if (n.includes('maria') || n.includes('carmela') || n.includes('stoppelli') || n.includes('moglie')) return 'moglie';
    
    // Controlla se corrisponde a un altro profilo dinamico esistente
    const pid = n.replace(/[^a-z0-9]/g, '');
    let hp = [];
    try { hp = JSON.parse(localStorage.getItem('health_profiles') || '[]'); } catch(e){}
    if (hp.includes(pid)) return pid;

    // Ricerca per nome salvato
    for (let p of hp) {
      const pName = (localStorage.getItem('profileName_' + p) || '').toLowerCase();
      if (pName && (pName.includes(n) || n.includes(pName))) return p;
    }
    return null;
  }

  function sincronizzaProfiloSaluteDaSuite() {
    const paramProfile = getQueryParam('profile') || getQueryParam('paziente') || getQueryParam('patient');
    const storedPaziente = localStorage.getItem('milella_active_patient_name');

    let matchedProf = null;
    let displayName = '';

    if (paramProfile) {
      const dec = decodeURIComponent(paramProfile);
      matchedProf = mappaPazienteAProfiloSalute(dec);
      displayName = dec;
    } else if (storedPaziente) {
      matchedProf = mappaPazienteAProfiloSalute(storedPaziente);
      displayName = storedPaziente;
    }

    if (matchedProf) {
      console.log('🌿 Sincronizzazione Profilo Salute:', matchedProf, '(' + displayName + ')');
      
      // Seleziona la tab corrispondente
      const tabBtn = document.querySelector(`.user-badge[data-profile="${matchedProf}"]`) || document.querySelector(`.profile-tab[data-profile="${matchedProf}"]`);
      if (tabBtn) {
        tabBtn.click();
      } else if (typeof activeProfile !== 'undefined') {
        window.activeProfile = matchedProf;
        localStorage.setItem('activeProfile', matchedProf);
        if (typeof renderAll === 'function') renderAll();
      }

      mostraBannerSaluteSincronizzato(displayName || (matchedProf === 'marito' ? 'Ciro Milella' : 'Maria Carmela'));
    }
  }

  function mostraBannerSaluteSincronizzato(nome) {
    let banner = document.getElementById('salute-patient-synced-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'salute-patient-synced-banner';
      banner.style.cssText = 'position:fixed; top:16px; right:16px; background:linear-gradient(135deg, #10b981, #059669); color:#ffffff; padding:10px 18px; border-radius:14px; font-size:13px; font-weight:700; box-shadow:0 8px 24px rgba(16,185,129,0.35); z-index:999999; display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,0.3); animation:fadeIn 0.3s ease;';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<span>🥗 Profilo Sincronizzato: <b>${nome}</b></span> <span onclick="this.parentElement.remove()" style="cursor:pointer; font-size:16px; margin-left:6px;">✕</span>`;
    setTimeout(() => { if (banner && banner.parentElement) banner.remove(); }, 5000);
  }

  // Navigazione rapida cross-app da Progetto Salute
  window.navigaDaSaluteACareAssist = function() {
    const prof = (typeof activeProfile !== 'undefined') ? activeProfile : (localStorage.getItem('activeProfile') || 'marito');
    const nome = prof === 'moglie' ? (localStorage.getItem('profileName_moglie') || 'Maria Carmela') : (localStorage.getItem('profileName_marito') || 'Ciro Milella');
    localStorage.setItem('milella_active_patient_name', nome);
    window.location.href = '/careassist/?patient=' + encodeURIComponent(nome);
  };

  window.navigaDaSaluteAAmbulatorio = function() {
    const prof = (typeof activeProfile !== 'undefined') ? activeProfile : (localStorage.getItem('activeProfile') || 'marito');
    const nome = prof === 'moglie' ? (localStorage.getItem('profileName_moglie') || 'Maria Carmela') : (localStorage.getItem('profileName_marito') || 'Ciro Milella');
    localStorage.setItem('milella_active_patient_name', nome);
    window.location.href = '/mednutri/?patient=' + encodeURIComponent(nome);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(sincronizzaPazientiDellaSuiteInSalute, 150);
      setTimeout(sincronizzaProfiloSaluteDaSuite, 350);
    });
  } else {
    setTimeout(sincronizzaPazientiDellaSuiteInSalute, 150);
    setTimeout(sincronizzaProfiloSaluteDaSuite, 350);
  }
})();

  // SINCRONIZZAZIONE AUTOMATICA DEL PESO E PARAMETRI CON IL FASCICOLO SANITARIO SUITE
  window.trasmettiParametriSaluteASuite = function(nomePaziente, peso, altezza, pressione, note) {
    if (!nomePaziente) return;
    try {
      fetch('/api/suite/pazienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomePaziente,
          peso: peso || '',
          altezza: altezza || '',
          pressione: pressione || '',
          ultimoRilevamentoSalute: new Date().toISOString(),
          noteSalute: note || 'Parametri aggiornati da Progetto Salute'
        })
      }).then(r => r.json()).then(res => {
        console.log('🌿 Parametri Salute sincronizzati nel Fascicolo Sanitario Centrale:', res);
      }).catch(() => {});
    } catch(e) {}
  };

  // Monitora salvataggi del peso e parametri in Progetto Salute per allineamento istantaneo
  window.addEventListener('storage', function(e) {
    if (e.key && e.key.startsWith('weightLog_')) {
      const prof = e.key.replace('weightLog_', '');
      const nomePaz = (prof === 'marito') ? 'Ciro Milella' : (prof === 'moglie' ? 'Maria Carmela' : prof);
      try {
        const logs = JSON.parse(e.newValue || '[]');
        if (logs.length > 0) {
          const ultimoPeso = logs[logs.length - 1].weight;
          trasmettiParametriSaluteASuite(nomePaz, ultimoPeso, null, null, 'Nuova pesata registrata');
        }
      } catch(err) {}
    }
  });