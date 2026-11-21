// ============================================================================
// SUITE MILELLA - PONTE DI SINCRONIZZAZIONE PAZIENTE MULTI-APP (TRIADE SANITARIA)
// Connette in tempo reale CareAssist Pro <-> Ambulatorio Medico <-> Progetto Salute
// ============================================================================
(function() {
  function getQueryParam(name) {
    try {
      const u = new URLSearchParams(window.location.search);
      return u.get(name);
    } catch(e) { return null; }
  }

  // 1. All'avvio di CareAssist, verifica se c'è un paziente passato da URL o da localStorage
  function sincronizzaPazienteInIngresso() {
    if (typeof AppData === 'undefined' || !AppData || !Array.isArray(AppData.pazienti) || AppData.pazienti.length === 0) {
      setTimeout(sincronizzaPazienteInIngresso, 150);
      return;
    }

    const paramPaziente = getQueryParam('paziente') || getQueryParam('patient');
    const storedPazId = localStorage.getItem('milella_active_patient_id');
    const storedPazName = localStorage.getItem('milella_active_patient_name');

    let targetPaziente = null;

    if (paramPaziente) {
      const decParam = decodeURIComponent(paramPaziente).toLowerCase().trim();
      targetPaziente = AppData.pazienti.find(p => 
        (p.id && p.id.toLowerCase() === decParam) ||
        (p.nome && p.nome.toLowerCase() === decParam) ||
        (p.nome && p.nome.toLowerCase().includes(decParam))
      );
    } else if (storedPazId) {
      targetPaziente = AppData.pazienti.find(p => p.id === storedPazId);
    } else if (storedPazName) {
      const decName = storedPazName.toLowerCase().trim();
      targetPaziente = AppData.pazienti.find(p => p.nome && p.nome.toLowerCase().includes(decName));
    }

    if (targetPaziente && targetPaziente.id !== AppData.activePazienteId) {
      console.log('🔄 Sincronizzazione Paziente Suite:', targetPaziente.nome);
      AppData.activePazienteId = targetPaziente.id;
      try { localStorage.setItem('careassist_pro_db_v2', JSON.stringify(AppData)); } catch(e) {}
      if (typeof renderAll === 'function') renderAll();
    }

    // Salva sempre i riferimenti attivi condivisi
    salvaRiferimentoCondiviso();
  }

  function salvaRiferimentoCondiviso() {
    if (typeof getActivePaziente === 'function') {
      const p = getActivePaziente();
      if (p) {
        localStorage.setItem('milella_active_patient_id', p.id);
        localStorage.setItem('milella_active_patient_name', p.nome);
        if (p.dataNascita) localStorage.setItem('milella_active_patient_dob', p.dataNascita);
        if (p.sesso) localStorage.setItem('milella_active_patient_gender', p.sesso);
      }
    }
  }

  // Hook sul cambio paziente manuale
  const originalCambiaPaziente = window.cambiaPaziente;
  window.cambiaPaziente = function(pazId) {
    if (typeof originalCambiaPaziente === 'function') {
      originalCambiaPaziente(pazId);
    } else {
      AppData.activePazienteId = pazId;
      try { localStorage.setItem('careassist_pro_db_v2', JSON.stringify(AppData)); } catch(e) {}
      if (typeof renderAll === 'function') renderAll();
    }
    salvaRiferimentoCondiviso();
  };

  // Navigazione Rapida Diretta verso MedNutri Ambulatorio Medico Nutrizionale
  window.navigaAdAmbulatorioApp = function() {
    salvaRiferimentoCondiviso();
    const p = (typeof getActivePaziente === 'function') ? getActivePaziente() : null;
    const nome = p ? encodeURIComponent(p.nome) : '';
    window.location.href = '/mednutri/?patient=' + nome;
  };

  // Navigazione Rapida verso Ambulatorio Medico con paziente attivo
  window.navigaAdAmbulatorio = function() {
    salvaRiferimentoCondiviso();
    // Se siamo all'interno di CareAssist Pro, apri direttamente la cartella ambulatoriale / specialistica interna
    if (typeof apriAmbulatorioSpecialisticoMobile === 'function') {
      apriAmbulatorioSpecialisticoMobile();
      return;
    }
    const tabEpa = document.getElementById('tab-epatologia');
    if (tabEpa) {
      if (typeof vaiATab === 'function') vaiATab('tab-epatologia');
      return;
    }
    const p = (typeof getActivePaziente === 'function') ? getActivePaziente() : null;
    const nome = p ? encodeURIComponent(p.nome) : '';
    window.location.href = '/mednutri/?patient=' + nome;
  };

  // Navigazione Rapida verso Progetto Salute con profilo corrispondente
  window.navigaAProgettoSalute = function() {
    salvaRiferimentoCondiviso();
    const p = (typeof getActivePaziente === 'function') ? getActivePaziente() : null;
    const nome = p ? encodeURIComponent(p.nome) : '';
    window.location.href = '/salute/?profile=' + nome;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(sincronizzaPazienteInIngresso, 300);
    });
  } else {
    setTimeout(sincronizzaPazienteInIngresso, 300);
  }
})();
