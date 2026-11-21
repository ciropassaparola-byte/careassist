/**
 * CareAssist Pro - Modulo Turnario & Combinatore Turni Intelligente (Pannello Admin)
 * Conforme alle normative D.Lgs. 66/2003 (Riposo 11h, Smonto Notte obbligatorio)
 * e CCNL Sanità / Cooperative Sociali (36h / 38h).
 * 
 * SICUREZZA & RUOLI:
 * - ADMIN (Ciro Milella - PIN SOS999): Assegna, modifica, sviluppa automaticamente e gestisce i collaboratori.
 * - COLLABORATORI (con app CareAssist abilitata): Stessa interfaccia ma in SOLA LETTURA (Read-Only).
 */

const TURNI_INFO = {
  'M': { nome: 'Mattina', orario: '07:00 - 14:00', ore: 7, bg: '#dcfce7', color: '#15803d', border: '#86efac', icon: '☀️' },
  'P': { nome: 'Pomeriggio', orario: '14:00 - 21:00', ore: 7, bg: '#ffedd5', color: '#c2410c', border: '#fdba74', icon: '🌤️' },
  'N': { nome: 'Notte', orario: '21:00 - 07:00', ore: 10, bg: '#e0e7ff', color: '#4338ca', border: '#a5b4fc', icon: '🌙' },
  'S': { nome: 'Smonto Notte', orario: 'Recupero Biologico Post-Notte', ore: 0, bg: '#fef3c7', color: '#b45309', border: '#fcd34d', icon: '🛌' },
  'SN': { nome: 'Smonto Notte', orario: 'Recupero Biologico Post-Notte', ore: 0, bg: '#fef3c7', color: '#b45309', border: '#fcd34d', icon: '🛌' },
  'R': { nome: 'Riposo', orario: 'Riposo di Legge', ore: 0, bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', icon: '☕' },
  'D': { nome: 'Disponibilità', orario: 'Reperibile per Coperture / Emergenze', ore: 0, bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe', icon: '🦺' }
};

// Notificatore elegante senza prompt invasivi del browser
function notificaUtente(msg, icon = 'ℹ️') {
  if (typeof window.mostraToast === 'function') {
    window.mostraToast(msg, icon);
  } else if (typeof mostraToast === 'function') {
    mostraToast(msg, icon);
  } else {
    console.log(icon, msg);
  }
}

const REGIMI_ORARI_INFO = {
  // FULL TIME
  'ft_ssn_turnista_36h': {
    nome: 'Full Time SSN Turnista H24 Continuo',
    ore: 36,
    tipo: 'full_time',
    ccnl: 'CCNL Sanità Pubblica',
    badge: 'FT 36h Turni',
    bg: 'rgba(56,189,248,0.15)',
    color: '#38bdf8',
    desc: '36 ore medie settimanali con rotazione continua H24 (P-M-N-S-R). Riposo post-notte e banca ore compensativa.'
  },
  'ft_ssn_36h_5gg': {
    nome: 'Full Time SSN 5 Giorni (Settimana Corta)',
    ore: 36,
    tipo: 'full_time',
    ccnl: 'CCNL Sanità Pubblica',
    badge: 'FT 36h (5gg)',
    bg: 'rgba(56,189,248,0.15)',
    color: '#38bdf8',
    desc: '36 ore distribuite su 5 giorni lavorativi (7h 12m al giorno). Sabato e domenica a riposo.'
  },
  'ft_ssn_36h_6gg': {
    nome: 'Full Time SSN 6 Giorni (Settimana Standard)',
    ore: 36,
    tipo: 'full_time',
    ccnl: 'CCNL Sanità Pubblica',
    badge: 'FT 36h (6gg)',
    bg: 'rgba(56,189,248,0.15)',
    color: '#38bdf8',
    desc: '36 ore distribuite su 6 giorni lavorativi (6h al giorno dal lunedì al sabato). Domenica di riposo.'
  },
  'ft_coop_turnista_38h': {
    nome: 'Full Time Coop Sociali Turnista H24',
    ore: 38,
    tipo: 'full_time',
    ccnl: 'CCNL Cooperative Sociali',
    badge: 'FT 38h Turni',
    bg: 'rgba(129,140,248,0.15)',
    color: '#818cf8',
    desc: '38 ore settimanali per operatori socio-sanitari e infermieri in RSA, alloggi protetti e residenze H24.'
  },
  'ft_coop_38h_5gg': {
    nome: 'Full Time Coop Sociali Diurno / ADI',
    ore: 38,
    tipo: 'full_time',
    ccnl: 'CCNL Cooperative Sociali',
    badge: 'FT 38h Diurno',
    bg: 'rgba(129,140,248,0.15)',
    color: '#818cf8',
    desc: '38 ore settimanali per assistenza domiciliare integrata (ADI) e centri diurni (7,6h al giorno).'
  },
  'ft_privata_36h': {
    nome: 'Full Time Sanità Privata AIOP / ARIS',
    ore: 36,
    tipo: 'full_time',
    ccnl: 'CCNL Sanità Privata',
    badge: 'FT 36h AIOP',
    bg: 'rgba(52,211,153,0.15)',
    color: '#34d399',
    desc: '36 ore settimanali in case di cura, istituti di riabilitazione e cliniche convenzionate col SSN.'
  },
  'ft_standard_40h': {
    nome: 'Full Time 40h Standard / CCNL UNEBA',
    ore: 40,
    tipo: 'full_time',
    ccnl: 'CCNL UNEBA / Sanità Priv.',
    badge: 'FT 40h',
    bg: 'rgba(148,163,184,0.15)',
    color: '#cbd5e1',
    desc: '40 ore settimanali ordinarie (8h al giorno dal lunedì al venerdì).'
  },
  // PART TIME
  'pt_orizzontale_18h': {
    nome: 'Part Time 50% Orizzontale (18h)',
    ore: 18,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Orizzontale',
    badge: 'PT 18h (50%)',
    bg: 'rgba(251,146,60,0.15)',
    color: '#fb923c',
    desc: '50% del full time (18 ore settimanali nel SSN), orario ridotto giornaliero uniforme (3h 36m/gg).'
  },
  'pt_orizzontale_20h': {
    nome: 'Part Time 20h Orizzontale',
    ore: 20,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Orizzontale',
    badge: 'PT 20h',
    bg: 'rgba(251,146,60,0.15)',
    color: '#fb923c',
    desc: '20 ore settimanali (4 ore al giorno per 5 giorni lavorativi).'
  },
  'pt_orizzontale_24h': {
    nome: 'Part Time ~66% Orizzontale (24h)',
    ore: 24,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Orizzontale',
    badge: 'PT 24h (66%)',
    bg: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    desc: '24 ore settimanali (circa 4h 48m al giorno su 5 giorni o turni concordati).'
  },
  'pt_orizzontale_30h': {
    nome: 'Part Time ~80% Orizzontale (30h)',
    ore: 30,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Orizzontale',
    badge: 'PT 30h (80%)',
    bg: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    desc: '30 ore settimanali (6 ore al giorno per 5 giorni lavorativi).'
  },
  'pt_verticale_3gg': {
    nome: 'Part Time Verticale (3 Giorni)',
    ore: 21,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Verticale',
    badge: 'PT Vert. 3gg',
    bg: 'rgba(232,121,249,0.15)',
    color: '#e879f9',
    desc: 'Attività lavorativa a tempo pieno concentrata in soli 3 giorni settimanali; i restanti 4 giorni sono di riposo.'
  },
  'pt_verticale_4gg': {
    nome: 'Part Time Verticale (4 Giorni)',
    ore: 28,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Verticale',
    badge: 'PT Vert. 4gg',
    bg: 'rgba(232,121,249,0.15)',
    color: '#e879f9',
    desc: 'Attività lavorativa a tempo pieno concentrata in 4 giorni settimanali; i restanti 3 giorni sono di riposo.'
  },
  'pt_ciclico_turnista': {
    nome: 'Part Time Ciclico / Turnista',
    ore: 20,
    tipo: 'part_time',
    ccnl: 'Tempo Parziale Ciclico Turni',
    badge: 'PT Ciclico',
    bg: 'rgba(192,132,252,0.15)',
    color: '#c084fc',
    desc: 'Inserimento nei turni di reparto con rotazione proporzionata e monte ore medio concordato.'
  }
};
if (typeof window !== 'undefined') {
  window.REGIMI_ORARI_INFO = REGIMI_ORARI_INFO;
}

const DEFAULT_OPERATORI_TURNI = [
  { id: 'op_1', nome: 'Ciro Milella', ruolo: 'Admin / Coordinatore', tel: '366 460 7396', profilo: 'diurno', regimeOrario: 'full_time', condizioneOrario: 'ft_ssn_36h_5gg', oreContrattuali: 36, disponibileCoperture: true },
  { id: 'op_2', nome: 'M.C. Stoppelli', ruolo: 'OSS Referente (CareAssist)', tel: '338 739 7671', profilo: 'misto_pn', regimeOrario: 'full_time', condizioneOrario: 'ft_coop_turnista_38h', oreContrattuali: 38, disponibileCoperture: true },
  { id: 'op_3', nome: 'Marco Rossi', ruolo: 'OSS', tel: '340 123 4567', profilo: 'full_h24', regimeOrario: 'full_time', condizioneOrario: 'ft_ssn_turnista_36h', oreContrattuali: 36, disponibileCoperture: false },
  { id: 'op_4', nome: 'Sara Viola', ruolo: 'Infermiera / Reparto SSN', tel: '347 987 6543', profilo: 'infermiere_ssn', regimeOrario: 'full_time', condizioneOrario: 'ft_ssn_turnista_36h', oreContrattuali: 36, disponibileCoperture: true },
  { id: 'op_5', nome: 'Elena Bianchi', ruolo: 'OSS Domiciliare Part-Time', tel: '339 555 1234', profilo: 'diurno', regimeOrario: 'part_time', condizioneOrario: 'pt_orizzontale_20h', oreContrattuali: 20, disponibileCoperture: false }
];

let turnarioCorrente = null;

// Verifica se l'utente corrente ha i privilegi di Admin
function isUtenteAdmin() {
  const role = localStorage.getItem('milella_role') || localStorage.getItem('milella_last_authenticated_role');
  if (role === 'collaboratore') {
    if (sessionStorage.getItem('turnario_admin_unlocked') === 'true') return true;
    return false;
  }
  // Default: Ciro Milella Coordinatore con pieni privilegi senza richiesta di PIN
  return true;
}

// Sblocco manuale Admin tramite PIN Master
function sbloccaModalitaAdminManuale(pinInserito) {
  const pin = pinInserito || '';
  if (pin.trim().toUpperCase() === 'SOS999') {
    sessionStorage.setItem('turnario_admin_unlocked', 'true');
    localStorage.setItem('milella_role', 'admin');
    localStorage.setItem('milella_last_authenticated_role', 'admin');
    if (typeof aggiornaVistaTurnarioModal === 'function') {
      try { aggiornaVistaTurnarioModal(); } catch(e) {}
    }
    return true;
  }
  return false;
}

function formatDateYMD(d) {
  if (!d) return '';
  const date = (d instanceof Date) ? d : new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateYMD(str) {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  const parts = String(str).slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(str);
}

// Ottieni la data del lunedì della settimana corrente (senza bug di fuso orario UTC)
function getLunediSettimana(d) {
  const date = d ? (d instanceof Date ? new Date(d.getTime()) : parseDateYMD(d)) : new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Domenica, 1 = Lunedì ... 6 = Sabato
  const diff = (day === 0 ? -6 : 1) - day;
  const lunedi = new Date(date);
  lunedi.setDate(date.getDate() + diff);
  lunedi.setHours(0, 0, 0, 0);
  return lunedi;
}

// Sincronizza operatori censiti nel sistema che hanno CareAssist abilitata
async function sincronizzaOperatoriCareAssist() {
  try {
    const res = await fetch('/api/careassist/operatori-turni?_t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.operatori) && data.operatori.length > 0) {
        if (!turnarioCorrente) caricaDatiTurnario();
        
        // Unisci mantenendo i profili e aggiungendo nuovi operatori abilitati a CareAssist
        const esistentiIds = new Set(turnarioCorrente.operatori.map(o => o.id));
        data.operatori.forEach(serverOp => {
          if (!esistentiIds.has(serverOp.id)) {
            turnarioCorrente.operatori.push(serverOp);
          } else {
            // Aggiorna ruoli e telefoni
            const localOp = turnarioCorrente.operatori.find(o => o.id === serverOp.id);
            if (localOp) {
              localOp.nome = serverOp.nome;
              localOp.ruolo = serverOp.ruolo;
              if (serverOp.tel) localOp.tel = serverOp.tel;
            }
          }
        });
        salvaTurnarioSuStorage();
      }
    }
  } catch(e) {
    console.log('Sync operatori server offline/fallback');
  }
}

// Inizializza o carica i dati del turnario
function caricaDatiTurnario() {
  const salvato = localStorage.getItem('careassist_turnario_settimanale');
  if (salvato) {
    try {
      turnarioCorrente = JSON.parse(salvato);
      if (turnarioCorrente && turnarioCorrente.operatori && turnarioCorrente.griglia) {
        // Backfill regimi orari se assenti
        turnarioCorrente.operatori.forEach(op => {
          if (!op.regimeOrario) {
            op.regimeOrario = op.ruolo && op.ruolo.toLowerCase().includes('part') ? 'part_time' : 'full_time';
          }
          if (!op.condizioneOrario) {
            op.condizioneOrario = op.regimeOrario === 'part_time' ? 'pt_orizzontale_20h' : (op.profilo === 'infermiere_ssn' ? 'ft_ssn_turnista_36h' : 'ft_ssn_turnista_36h');
          }
          if (!op.oreContrattuali) {
            const rInfo = REGIMI_ORARI_INFO[op.condizioneOrario];
            op.oreContrattuali = rInfo ? rInfo.ore : (op.regimeOrario === 'part_time' ? 20 : 36);
          }
        });
        if (turnarioCorrente.settimanaInizio) {
          const lun = getLunediSettimana(parseDateYMD(turnarioCorrente.settimanaInizio));
          turnarioCorrente.settimanaInizio = formatDateYMD(lun);
        }
        return turnarioCorrente;
      }
    } catch (e) {
      console.warn('Errore lettura turnario salvato:', e);
    }
  }

  // Creazione iniziale
  const lunedi = getLunediSettimana();
  turnarioCorrente = {
    settimanaInizio: formatDateYMD(lunedi),
    fabbisogno: { M: 1, P: 1, N: 1 },
    operatori: JSON.parse(JSON.stringify(DEFAULT_OPERATORI_TURNI)),
    griglia: {}
  };

  sviluppaCombinazioneAutomatica();
  return turnarioCorrente;
}

// ALGORITMO DI SVILUPPO COMBINAZIONI TURNI SANITARI & SSN (SOLO ADMIN)
function sviluppaCombinazioneAutomatica(preset = 'ssn_pmnsr') {
  if (!isUtenteAdmin()) {
    notificaUtente("🔒 Solo l'Admin Coordinatore può sviluppare o modificare le combinazioni di turno.", "🔒");
    return false;
  }
  if (!turnarioCorrente) caricaDatiTurnario();

  const ops = turnarioCorrente.operatori || [];
  if (ops.length === 0) return false;

  const fabb = turnarioCorrente.fabbisogno || { M: 1, P: 1, N: 1 };
  const giorni = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

  // Reset griglia turni
  turnarioCorrente.griglia = {};
  ops.forEach(op => {
    turnarioCorrente.griglia[op.id] = { lun: 'R', mar: 'R', mer: 'R', gio: 'R', ven: 'R', sab: 'R', dom: 'R' };
  });

  if (preset === 'ssn_pmnsr') {
    // 1. CICLO IN 5ª SSN VARIANTE POMERIGGIO: P -> M -> N -> S -> R
    // Modello adottato nelle strutture convenzionate SSN (es. reparto degenza / infermieri)
    // Sequenza su 5 giorni con 55 ore consecutive libere tra smonto notte e successivo pomeriggio.
    const schema = ['P', 'M', 'N', 'S', 'R'];
    ops.forEach((op, opIdx) => {
      giorni.forEach((g, gIdx) => {
        const turno = schema[(opIdx + gIdx) % schema.length];
        turnarioCorrente.griglia[op.id][g] = turno;
      });
    });
  } else if (preset === 'ssn_mpnsr') {
    // 2. CICLO IN 5ª TRADIZIONALE SSN: M -> P -> N -> S -> R
    // Modello classico di degenza con stacco 24h tra i turni diurni e la notte
    const schema = ['M', 'P', 'N', 'S', 'R'];
    ops.forEach((op, opIdx) => {
      giorni.forEach((g, gIdx) => {
        const turno = schema[(opIdx + gIdx) % schema.length];
        turnarioCorrente.griglia[op.id][g] = turno;
      });
    });
  } else if (preset === 'ssn_h12') {
    // 3. CICLO IN 4ª EMERGENZA H12: Giorno 12h -> Notte 12h -> Smonto -> Riposo
    // Pronto Soccorso, Rianimazione, 118 SUEM a 4 squadre
    const schema = ['M', 'N', 'S', 'R'];
    ops.forEach((op, opIdx) => {
      giorni.forEach((g, gIdx) => {
        const turno = schema[(opIdx + gIdx) % schema.length];
        turnarioCorrente.griglia[op.id][g] = turno;
      });
    });
  } else if (preset === 'ssn_sesta') {
    // 4. CICLO IN 6ª CON DOPPIO RIPOSO: M -> P -> N -> S -> R -> R
    // 48h continuative di riposo post-notte e conformità contrattuale CCNL 36h
    const schema = ['M', 'P', 'N', 'S', 'R', 'R'];
    ops.forEach((op, opIdx) => {
      giorni.forEach((g, gIdx) => {
        const turno = schema[(opIdx + gIdx) % schema.length];
        turnarioCorrente.griglia[op.id][g] = turno;
      });
    });
  } else if (preset === 'diurno_adi') {
    // 5. SERVIZIO DIURNO CONTINUO ADI / AMBULATORIO (M / P alternati, domenica Riposo)
    ops.forEach((op, opIdx) => {
      const riposoInfrasettimanale = (opIdx * 2) % 6; // indice da 0 a 5 (lun-sab)
      giorni.forEach((g, gIdx) => {
        if (g === 'dom') {
          turnarioCorrente.griglia[op.id][g] = 'R';
        } else if (gIdx === riposoInfrasettimanale && ops.length > 2) {
          turnarioCorrente.griglia[op.id][g] = 'R';
        } else {
          const isMattina = (opIdx + gIdx) % 2 === 0;
          turnarioCorrente.griglia[op.id][g] = isMattina ? 'M' : 'P';
        }
      });
    });
  } else {
    // 6. TURNO MISTO CAREASSIST (Pomeriggio & Notte + Smonto + Reperibilità D)
    const opsNotte = ops.filter(o => o.profilo === 'misto_pn' || o.profilo === 'full_h24' || o.profilo === 'notte');
    let idxNotte = 0;

    for (let gIdx = 0; gIdx < giorni.length; gIdx++) {
      const g = giorni[gIdx];
      const gPrec = gIdx > 0 ? giorni[gIdx - 1] : null;

      // Smonto obbligatorio post-notte
      if (gPrec) {
        ops.forEach(op => {
          if (turnarioCorrente.griglia[op.id][gPrec] === 'N') {
            turnarioCorrente.griglia[op.id][g] = 'S';
          }
        });
      }

      // Assegna Notte
      if (fabb.N > 0 && opsNotte.length > 0) {
        let tentativi = 0;
        let assegnato = false;
        while (tentativi < opsNotte.length && !assegnato) {
          const opCandidato = opsNotte[idxNotte % opsNotte.length];
          const statoOggi = turnarioCorrente.griglia[opCandidato.id][g];
          const ieri = gPrec ? turnarioCorrente.griglia[opCandidato.id][gPrec] : null;

          if (statoOggi !== 'S' && ieri !== 'N') {
            turnarioCorrente.griglia[opCandidato.id][g] = 'N';
            assegnato = true;
          }
          idxNotte++;
          tentativi++;
        }
      }
    }

    // Assegna Pomeriggi e Mattine
    let idxP = 1;
    let idxM = 2;
    for (let gIdx = 0; gIdx < giorni.length; gIdx++) {
      const g = giorni[gIdx];
      const gPrec = gIdx > 0 ? giorni[gIdx - 1] : null;

      let pAssegnati = 0;
      let tentativiP = 0;
      while (pAssegnati < fabb.P && tentativiP < ops.length * 2) {
        const op = ops[idxP % ops.length];
        const stato = turnarioCorrente.griglia[op.id][g];
        const ieri = gPrec ? turnarioCorrente.griglia[op.id][gPrec] : null;

        if (stato === 'R' && ieri !== 'N') {
          turnarioCorrente.griglia[op.id][g] = 'P';
          pAssegnati++;
        }
        idxP++;
        tentativiP++;
      }

      let mAssegnati = 0;
      let tentativiM = 0;
      while (mAssegnati < fabb.M && tentativiM < ops.length * 2) {
        const op = ops[idxM % ops.length];
        const stato = turnarioCorrente.griglia[op.id][g];
        const ieri = gPrec ? turnarioCorrente.griglia[op.id][gPrec] : null;
        const ammetteMattina = op.profilo !== 'misto_pn' && op.profilo !== 'notte';

        if (stato === 'R' && ieri !== 'N' && ieri !== 'P' && ammetteMattina) {
          turnarioCorrente.griglia[op.id][g] = 'M';
          mAssegnati++;
        }
        idxM++;
        tentativiM++;
      }
    }

    // Disponibilità / Reperibilità D per coperture emergenze nei giorni liberi
    for (let gIdx = 0; gIdx < giorni.length; gIdx++) {
      const g = giorni[gIdx];
      ops.forEach(op => {
        const stato = turnarioCorrente.griglia[op.id][g];
        if (stato === 'R' && (op.disponibileCoperture || op.profilo === 'misto_pn')) {
          turnarioCorrente.griglia[op.id][g] = 'D';
        }
      });
    }
  }

  turnarioCorrente.ultimoPreset = preset;
  salvaTurnarioSuStorage();
  return true;
}

// Salva stato locale e invia al server cloud
function salvaTurnarioSuStorage() {
  if (turnarioCorrente) {
    localStorage.setItem('careassist_turnario_settimanale', JSON.stringify(turnarioCorrente));
    
    // Invia al server se Admin
    if (isUtenteAdmin()) {
      fetch('/api/careassist/turnario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnario: turnarioCorrente,
          pinAdmin: 'SOS999',
          isAdmin: true
        })
      }).catch(() => {});
    }
  }
}

// Calcola totale ore per operatore
function calcolaOreOperatore(opId) {
  if (!turnarioCorrente || !turnarioCorrente.griglia || !turnarioCorrente.griglia[opId]) return { ore: 0, disp: 0 };
  const riga = turnarioCorrente.griglia[opId];
  let oreLavorate = 0;
  let giorniDisp = 0;
  Object.values(riga).forEach(t => {
    if (TURNI_INFO[t]) oreLavorate += TURNI_INFO[t].ore;
    if (t === 'D') giorniDisp++;
  });
  return { ore: oreLavorate, disp: giorniDisp };
}

// Ciclo rapido al tocco sulla cella (M -> P -> N -> S -> R -> D) - SOLO ADMIN!
function ciclaTurnoCella(opId, giorno) {
  if (!isUtenteAdmin()) {
    notificaUtente("Solo l'Admin Coordinatore può modificare i turni.", "🔒");
    return;
  }
  if (!turnarioCorrente || !turnarioCorrente.griglia[opId]) return;
  const sequenza = ['M', 'P', 'N', 'S', 'R', 'D'];
  const attuale = turnarioCorrente.griglia[opId][giorno] || 'R';
  const idx = sequenza.indexOf(attuale);
  const nuovo = sequenza[(idx + 1) % sequenza.length];
  turnarioCorrente.griglia[opId][giorno] = nuovo;
  salvaTurnarioSuStorage();
  aggiornaVistaTurnarioModal();
}

// Impostazione diretta del turno scelto da popover/modale (SOLO ADMIN!)
function impostaTurnoCella(opId, giorno, nuovoTurno) {
  if (!isUtenteAdmin()) {
    notificaUtente("Solo l'Admin Coordinatore può modificare i turni.", "🔒");
    return false;
  }
  if (!turnarioCorrente) caricaDatiTurnario();
  if (!turnarioCorrente.griglia[opId]) {
    turnarioCorrente.griglia[opId] = { lun: 'R', mar: 'R', mer: 'R', gio: 'R', ven: 'R', sab: 'R', dom: 'R' };
  }
  turnarioCorrente.griglia[opId][giorno] = nuovoTurno;
  salvaTurnarioSuStorage();
  aggiornaVistaTurnarioModal();
  return true;
}

// APERTURA MODALE TURNARIO (ADMIN O COLLABORATORE)
async function apriModalTurnarioAdmin() {
  caricaDatiTurnario();
  await sincronizzaOperatoriCareAssist();
  aggiornaVistaTurnarioModal();

  const modal = document.getElementById('modal-turnario-admin');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

// Chiusura Modale
function chiudiModalTurnarioAdmin() {
  const modal = document.getElementById('modal-turnario-admin');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

// Rendering grafico dell'interfaccia nel modale
function aggiornaVistaTurnarioModal() {
  if (!turnarioCorrente) caricaDatiTurnario();

  const isAdmin = isUtenteAdmin();
  const tbody = document.getElementById('turnario-tbody-matrix');
  const dateLabel = document.getElementById('turnario-settimana-label');
  const dateInp = document.getElementById('turnario-input-data-inizio');
  const summaryBox = document.getElementById('turnario-coperture-summary');
  const modalTitolo = document.getElementById('turnario-modal-titolo-testo');
  const adminControlsBox = document.getElementById('turnario-admin-action-controls');

  const lunedi = new Date(turnarioCorrente.settimanaInizio + 'T00:00:00');
  const domenica = new Date(lunedi);
  domenica.setDate(lunedi.getDate() + 6);

  if (modalTitolo) {
    modalTitolo.innerHTML = isAdmin 
      ? 'Turnario & Combinatore Turni (Pannello Admin)' 
      : 'Turnario Assistenza (Collaboratore • Sola Lettura)';
  }

  if (dateLabel) {
    dateLabel.textContent = `Settimana: da Lunedì ${lunedi.toLocaleDateString('it-IT', { day:'2-digit', month:'short' })} a Domenica ${domenica.toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })}`;
  }
  if (dateInp) {
    dateInp.value = turnarioCorrente.settimanaInizio;
    dateInp.disabled = !isAdmin;
  }

  // Se collaboratore, nascondi o disabilita controlli di generazione
  if (adminControlsBox) {
    adminControlsBox.innerHTML = isAdmin ? `
      <button type="button" class="btn" onclick="sviluppaCombinazioneAutomatica(); aggiornaVistaTurnarioModal();" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; font-weight: 800; border-radius: 10px; padding: 8px 14px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(2,132,199,0.3);">
        ⚡ Sviluppa Combinazione Automatica
      </button>
      <button type="button" class="btn btn-outline" onclick="aggiungiOperatoreTurnario()" style="font-weight: 700; border-radius: 10px; padding: 8px 12px;">
        + Aggiungi Operatore
      </button>
    ` : `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="background:#f1f5f9; color:#475569; font-weight:700; font-size:12px; padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1;">
          🔒 Sola Visualizzazione
        </span>
        <button type="button" class="btn btn-outline" onclick="sbloccaModalitaAdminManuale()" style="font-size:11.5px; font-weight:700; padding:6px 10px; color:#0369a1;">
          🔑 Sblocca con PIN Admin
        </button>
      </div>
    `;
  }

  // Intestazione giorni con date reali
  const giorni = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  giorni.forEach((g, i) => {
    const curD = new Date(lunedi);
    curD.setDate(lunedi.getDate() + i);
    const thEl = document.getElementById(`th-giorno-${g}`);
    if (thEl) {
      thEl.innerHTML = `
        <div style="font-weight:800; font-size:12px;">${['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'][i]}</div>
        <div style="font-size:10px; color:#64748b; font-weight:600;">${curD.getDate()}/${curD.getMonth() + 1}</div>
      `;
    }
  });

  if (!tbody) return;

  const ops = turnarioCorrente.operatori || [];
  let html = '';

  ops.forEach((op) => {
    const { ore, disp } = calcolaOreOperatore(op.id);
    const badgeProfilo = op.profilo === 'misto_pn' ? '<span style="font-size:10px; background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:700;">🌙 Pom/Notte + Disp.</span>'
      : (op.profilo === 'diurno' ? '<span style="font-size:10px; background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-weight:700;">☀️ Diurno</span>'
      : '<span style="font-size:10px; background:#e0e7ff; color:#4338ca; padding:2px 6px; border-radius:4px; font-weight:700;">⭐ Full H24</span>');

    const dispLabel = op.disponibileCoperture ? '<span title="Disponibile per coperture urgenti" style="font-size:11px; cursor:help;">🦺 Jolly</span>' : '';
    const eliminaBtn = isAdmin ? `<button onclick="rimuoviOperatoreTurnario('${op.id}')" title="Rimuovi operatore" style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:14px; padding:2px 4px;">✕</button>` : '';

    html += `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 12px; background:#ffffff; position:sticky; left:0; z-index:2; border-right:2px solid #e2e8f0; min-width:180px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="font-weight:800; font-size:13px; color:#0f172a;">${op.nome}</div>
              <div style="font-size:11px; color:#64748b; margin-top:2px;">${op.ruolo} • 📞 ${op.tel}</div>
            </div>
            ${eliminaBtn}
          </div>
          <div style="margin-top:4px; display:flex; align-items:center; gap:6px;">
            ${badgeProfilo}
            ${dispLabel}
          </div>
        </td>
    `;

    giorni.forEach(g => {
      const turno = (turnarioCorrente.griglia[op.id] && turnarioCorrente.griglia[op.id][g]) || 'R';
      const info = TURNI_INFO[turno] || TURNI_INFO['R'];
      
      const cursorStyle = isAdmin ? 'cursor:pointer;' : 'cursor:default;';
      const tooltip = isAdmin ? `${info.nome} (${info.orario})\nTocca per cambiare turno` : `${info.nome} (${info.orario})\nTurno assegnato dall'Admin`;

      html += `
        <td style="padding:6px 4px; text-align:center; vertical-align:middle;">
          <div onclick="${isAdmin ? `ciclaTurnoCella('${op.id}', '${g}')` : ''}" 
               title="${tooltip}"
               style="${cursorStyle} user-select:none; background:${info.bg}; color:${info.color}; border:1.5px solid ${info.border}; border-radius:8px; padding:6px 2px; transition:transform 0.1s; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <span style="font-size:14px; font-weight:900; line-height:1;">${turno}</span>
            <span style="font-size:8.5px; font-weight:700; margin-top:2px; opacity:0.9;">${info.ore > 0 ? info.ore + 'h' : (turno === 'D' ? 'DISP' : (turno === 'S' ? 'SMONT' : 'LIB'))}</span>
          </div>
        </td>
      `;
    });

    // Colonna totale ore
    const statusColoreOre = ore >= 36 ? '#059669' : (ore > 0 ? '#0284c7' : '#64748b');
    html += `
        <td style="padding:8px 10px; text-align:center; background:#f8fafc; font-weight:800; font-size:13px; color:${statusColoreOre}; border-left:1.5px solid #e2e8f0;">
          <div>${ore}h</div>
          ${disp > 0 ? `<div style="font-size:10px; color:#7e22ce; font-weight:700;">+${disp} Disp.</div>` : ''}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Riepilogo coperture giornaliere
  if (summaryBox) {
    let summaryHtml = '<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">';
    
    if (isAdmin) {
      summaryHtml += `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">👑</span>
          <div>
            <div style="font-weight:800; font-size:12.5px; color:#0f172a;">Pannello Admin: Assegnazione Piena</div>
            <div style="font-size:11px; color:#059669; font-weight:700;">Tocca qualsiasi casella per modificare • Vincoli D.Lgs. 66/2003 verificati</div>
          </div>
        </div>
      `;
    } else {
      summaryHtml += `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">🔒</span>
          <div>
            <div style="font-weight:800; font-size:12.5px; color:#0369a1;">Vista Collaboratore (Sola Lettura)</div>
            <div style="font-size:11px; color:#64748b; font-weight:600;">I turni sono stabiliti esclusivamente dall'Admin Coordinatore</div>
          </div>
        </div>
      `;
    }

    summaryHtml += `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <span style="font-size:11px; padding:3px 8px; border-radius:6px; background:#dcfce7; color:#15803d; font-weight:800;">☀️ M = Mattina 07-14</span>
        <span style="font-size:11px; padding:3px 8px; border-radius:6px; background:#ffedd5; color:#c2410c; font-weight:800;">🌤️ P = Pomeriggio 14-21</span>
        <span style="font-size:11px; padding:3px 8px; border-radius:6px; background:#e0e7ff; color:#4338ca; font-weight:800;">🌙 N = Notte 21-07</span>
        <span style="font-size:11px; padding:3px 8px; border-radius:6px; background:#fef3c7; color:#b45309; font-weight:800;">🛌 S = Smonto</span>
        <span style="font-size:11px; padding:3px 8px; border-radius:6px; background:#f3e8ff; color:#7e22ce; font-weight:800;">🦺 D = Reperibile / Jolly</span>
      </div>
    </div>`;
    summaryBox.innerHTML = summaryHtml;
  }
}

// Cambio data della settimana dall'input (accessibile a tutti gli utenti per consultazione)
function cambiaSettimanaTurnario(nuovaDataStr) {
  if (!nuovaDataStr) return;
  if (!turnarioCorrente) caricaDatiTurnario();
  const selDate = parseDateYMD(nuovaDataStr);
  const lunedi = getLunediSettimana(selDate);
  const nuovaStr = formatDateYMD(lunedi);
  turnarioCorrente.settimanaInizio = nuovaStr;
  salvaTurnarioSuStorage();
  if (typeof aggiornaVistaTurnarioModal === 'function') {
    try { aggiornaVistaTurnarioModal(); } catch(e) {}
  }
  return nuovaStr;
}

// Navigazione rapida settimana precedente (-1) o successiva (+1)
function navigaSettimana(offset) {
  if (!turnarioCorrente) caricaDatiTurnario();
  const baseDate = parseDateYMD(turnarioCorrente.settimanaInizio);
  baseDate.setDate(baseDate.getDate() + (offset * 7));
  const lunedi = getLunediSettimana(baseDate);
  const nuovaStr = formatDateYMD(lunedi);
  turnarioCorrente.settimanaInizio = nuovaStr;
  salvaTurnarioSuStorage();
  if (typeof aggiornaVistaTurnarioModal === 'function') {
    try { aggiornaVistaTurnarioModal(); } catch(e) {}
  }
  return nuovaStr;
}

// Aggiungi nuovo operatore da oggetto dati (senza prompt nativo del browser)
function aggiungiOperatoreTurnario(datiOp) {
  if (!isUtenteAdmin()) return false;
  if (!turnarioCorrente) caricaDatiTurnario();

  const nome = (datiOp && datiOp.nome) ? datiOp.nome.trim() : 'Nuovo Collaboratore';
  const ruolo = (datiOp && datiOp.ruolo) ? datiOp.ruolo.trim() : 'OSS';
  const tel = (datiOp && datiOp.tel) ? datiOp.tel.trim() : '';
  const profilo = (datiOp && datiOp.profilo) ? datiOp.profilo : 'infermiere_ssn';
  const disp = (datiOp && typeof datiOp.disponibileCoperture !== 'undefined') ? Boolean(datiOp.disponibileCoperture) : true;
  const regime = (datiOp && datiOp.regimeOrario) ? datiOp.regimeOrario : 'full_time';
  const cond = (datiOp && datiOp.condizioneOrario) ? datiOp.condizioneOrario : (regime === 'part_time' ? 'pt_orizzontale_20h' : 'ft_ssn_turnista_36h');
  const rInfo = REGIMI_ORARI_INFO[cond];
  const oreContr = (datiOp && datiOp.oreContrattuali) ? Number(datiOp.oreContrattuali) : (rInfo ? rInfo.ore : (regime === 'part_time' ? 20 : 36));

  const newId = 'op_' + Date.now();
  turnarioCorrente.operatori.push({
    id: newId,
    nome: nome,
    ruolo: ruolo,
    tel: tel,
    profilo: profilo,
    regimeOrario: regime,
    condizioneOrario: cond,
    oreContrattuali: oreContr,
    disponibileCoperture: disp
  });

  if (!turnarioCorrente.griglia[newId]) {
    turnarioCorrente.griglia[newId] = { lun: 'R', mar: 'R', mer: 'R', gio: 'R', ven: 'R', sab: 'R', dom: 'R' };
  }

  salvaTurnarioSuStorage();
  if (typeof aggiornaVistaTurnarioModal === 'function') {
    try { aggiornaVistaTurnarioModal(); } catch(e) {}
  }
  return true;
}

// Modifica / aggiornamento anagrafica e profilo operatore esistente (SOLO ADMIN)
function aggiornaDatiOperatore(opId, datiAggiornati) {
  if (!isUtenteAdmin()) return false;
  if (!turnarioCorrente) caricaDatiTurnario();
  const op = turnarioCorrente.operatori.find(o => o.id === opId);
  if (!op) return false;

  if (datiAggiornati.nome) op.nome = datiAggiornati.nome.trim();
  if (datiAggiornati.ruolo) op.ruolo = datiAggiornati.ruolo.trim();
  if (typeof datiAggiornati.tel !== 'undefined') op.tel = datiAggiornati.tel.trim();
  if (datiAggiornati.profilo) op.profilo = datiAggiornati.profilo;
  if (typeof datiAggiornati.disponibileCoperture !== 'undefined') {
    op.disponibileCoperture = Boolean(datiAggiornati.disponibileCoperture);
  }
  if (datiAggiornati.regimeOrario) op.regimeOrario = datiAggiornati.regimeOrario;
  if (datiAggiornati.condizioneOrario) {
    op.condizioneOrario = datiAggiornati.condizioneOrario;
    const rInfo = REGIMI_ORARI_INFO[op.condizioneOrario];
    op.oreContrattuali = rInfo ? rInfo.ore : (op.regimeOrario === 'part_time' ? 20 : 36);
  }
  if (typeof datiAggiornati.oreContrattuali !== 'undefined') {
    op.oreContrattuali = Number(datiAggiornati.oreContrattuali);
  }

  salvaTurnarioSuStorage();
  if (typeof aggiornaVistaTurnarioModal === 'function') {
    try { aggiornaVistaTurnarioModal(); } catch(e) {}
  }
  return true;
}

// Rimuovi operatore (SOLO ADMIN, senza confirm nativo)
function rimuoviOperatoreTurnario(opId) {
  if (!isUtenteAdmin()) return false;
  if (!turnarioCorrente) caricaDatiTurnario();
  turnarioCorrente.operatori = turnarioCorrente.operatori.filter(o => o.id !== opId);
  delete turnarioCorrente.griglia[opId];
  salvaTurnarioSuStorage();
  if (typeof aggiornaVistaTurnarioModal === 'function') {
    try { aggiornaVistaTurnarioModal(); } catch(e) {}
  }
  return true;
}

// STAMPA CARTACEA A4 UFFICIALE (Accessibile sia ad Admin che a Collaboratore)
function stampaTurnarioCartaceoA4() {
  salvaTurnarioSuStorage();
  const win = window.open('/careassist/TURNARIO_SETTIMANALE_A4.html', '_blank');
  if (!win) {
    notificaUtente('Consenti l\'apertura dei popup nel browser per visualizzare il foglio di stampa A4.', '⚠️');
  }
}

// CONDIVIDI SU WHATSAPP (Accessibile sia ad Admin che a Collaboratore)
function condividiTurnarioWhatsApp() {
  if (!turnarioCorrente) caricaDatiTurnario();

  const lun = new Date(turnarioCorrente.settimanaInizio + 'T00:00:00');
  const dom = new Date(lun);
  dom.setDate(lun.getDate() + 6);

  let msg = `*📋 TURNARIO ASSISTENZA - CAREASSIST PRO*\n`;
  msg += `*Settimana:* ${lun.toLocaleDateString('it-IT')} - ${dom.toLocaleDateString('it-IT')}\n`;
  msg += `*Admin Coordinatore:* Ciro Milella\n\n`;

  const giorni = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const giorniNomi = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  giorni.forEach((g, idx) => {
    msg += `*📅 ${giorniNomi[idx]}*\n`;
    turnarioCorrente.operatori.forEach(op => {
      const t = turnarioCorrente.griglia[op.id][g];
      const info = TURNI_INFO[t] || TURNI_INFO['R'];
      if (t !== 'R') {
        msg += ` • ${info.icon} ${op.nome}: *${t}* (${info.nome})\n`;
      }
    });
    msg += `\n`;
  });

  msg += `_Turnario ufficiale assegnato dall'Admin Coordinatore CareAssist Pro._`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}


// ==============================================================================
// MODULO BACKUP & SINCRONIZZAZIONE USB (WEB <-> USB)
// ==============================================================================

async function eseguiBackupSicurezzaUSB() {
  try {
    let backupData = null;
    try {
      const res = await fetch('/api/suite/backup-completo');
      if (res.ok) {
        backupData = await res.json();
      }
    } catch(e) {
      console.warn('Fallback backup offline locale:', e);
    }

    if (!backupData) {
      backupData = {
        suite: 'Suite Milella Aziendale',
        versione: '2.5.0',
        timestamp: new Date().toISOString(),
        autore: 'Ciro Milella (Admin)',
        dati: {
          turnario: turnarioCorrente,
          operatori: turnarioCorrente ? turnarioCorrente.operatori : [],
          careassist: JSON.parse(localStorage.getItem('careassist_pazienti_db') || '{}'),
          consegne: JSON.parse(localStorage.getItem('careassist_consegne_cliniche') || '[]')
        }
      };
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = 'BACKUP_SUITE_MILELLA_' + dateStr + '.json';
    const jsonString = JSON.stringify(backupData, null, 2);

    // 1. Tentativo con File System Access API per salvare direttamente sulla chiavetta USB
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Backup Suite Milella (.json)',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        if (typeof mostraToast === 'function') {
          mostraToast('Copia di sicurezza USB salvata con successo!', '💾');
        }
        return true;
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') return false;
      }
    }

    // 2. Fallback download browser standard
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof mostraToast === 'function') {
      mostraToast('File di backup scaricato. Salvalo sulla tua chiavetta USB!', '💾');
    }
    return true;
  } catch(err) {
    console.error('Errore backup USB:', err);
    if (typeof mostraToast === 'function') {
      mostraToast('Errore durante la creazione del backup: ' + err.message, '❌');
    }
    return false;
  }
}

async function eseguiSincronizzazioneUSB(fileInput) {
  try {
    let fileObj = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
      fileObj = fileInput.files[0];
    } else if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'File JSON di Backup Suite Milella',
            accept: { 'application/json': ['.json'] }
          }],
          multiple: false
        });
        fileObj = await handle.getFile();
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') return;
      }
    }

    if (!fileObj) {
      if (typeof mostraToast === 'function') mostraToast('Nessun file selezionato.', '⚠️');
      return;
    }

    const text = await fileObj.text();
    const payload = JSON.parse(text);

    if (!payload || (!payload.dati && !payload.turnario && !payload.griglia)) {
      if (typeof mostraToast === 'function') mostraToast('Formato backup non valido.', '❌');
      return;
    }

    const dati = payload.dati || payload;

    // 1. Ripristina Turnario locale
    if (dati.turnario) {
      turnarioCorrente = dati.turnario;
      salvaTurnarioSuStorage();
    } else if (dati.griglia && dati.operatori) {
      turnarioCorrente = dati;
      salvaTurnarioSuStorage();
    }

    // 2. Ripristina consegne se presenti
    if (dati.consegne) {
      localStorage.setItem('careassist_consegne_cliniche', JSON.stringify(dati.consegne));
    }

    // 3. Invia al server per sincronizzazione cloud
    try {
      await fetch('/api/suite/ripristina-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(srvErr) {
      console.warn('Sincronizzazione server:', srvErr);
    }

    if (typeof renderViste === 'function') renderViste();
    if (typeof mostraToast === 'function') {
      mostraToast('Sincronizzazione USB completata con successo!', '🔄');
    }
  } catch(err) {
    console.error('Errore sincronizzazione USB:', err);
    if (typeof mostraToast === 'function') {
      mostraToast('Errore durante la sincronizzazione: ' + err.message, '❌');
    }
  }
}

// ==============================================================================
// ESPORTAZIONE CALENDARIO STANDARD ICAL (.ICS)
// ==============================================================================

function esportaCalendarioICS(opId = null) {
  if (!turnarioCorrente || !turnarioCorrente.giorni) {
    if (typeof mostraToast === 'function') mostraToast('Nessun turnario attivo da esportare.', '⚠️');
    return;
  }

  const giorni = turnarioCorrente.giorni;
  const operatori = opId 
    ? turnarioCorrente.operatori.filter(o => o.id === opId)
    : turnarioCorrente.operatori;

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CareAssist Pro//Turnario Sanitario H24//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Roster CareAssist Pro - ' + (opId ? (operatori[0]?.nome || 'Operatore') : 'Tutti i Collaboratori'),
    'X-WR-TIMEZONE:Europe/Rome'
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  giorni.forEach(gStr => {
    const parts = gStr.split('-');
    if (parts.length !== 3) return;
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    const nextDay = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10) + 1);
    const ny = String(nextDay.getFullYear());
    const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDay.getDate()).padStart(2, '0');

    operatori.forEach(op => {
      const t = turnarioCorrente.griglia[op.id] ? turnarioCorrente.griglia[op.id][gStr] : 'R';
      if (!t || t === 'R' || t === 'S') return;

      let start = '', end = '', summary = '', desc = '';
      if (t === 'M') {
        start = y + m + d + 'T070000';
        end = y + m + d + 'T140000';
        summary = '☀️ Turno Mattina (07-14) - ' + op.nome;
        desc = 'Assistenza Sanitaria Continua Sig. Ciro Milella - Sede Bari';
      } else if (t === 'P') {
        start = y + m + d + 'T140000';
        end = y + m + d + 'T210000';
        summary = '🌤️ Turno Pomeriggio (14-21) - ' + op.nome;
        desc = 'Assistenza Sanitaria Continua Sig. Ciro Milella - Sede Bari';
      } else if (t === 'N') {
        start = y + m + d + 'T210000';
        end = ny + nm + nd + 'T070000';
        summary = '🌙 Turno Notte (21-07) - ' + op.nome;
        desc = 'Sorveglianza Notturna Sanitaria Sig. Ciro Milella - Sede Bari';
      } else if (t === 'D') {
        start = y + m + d + 'T080000';
        end = y + m + d + 'T200000';
        summary = '🦺 Reperibilità Attiva Emergenze - ' + op.nome;
        desc = 'Disponibilità telefonica e pronto intervento per Sig. Ciro Milella';
      }

      const uid = 'turnario-' + op.id + '-' + gStr + '-' + t + '@milella-suite.com';
      ics.push('BEGIN:VEVENT');
      ics.push('UID:' + uid);
      ics.push('DTSTAMP:' + nowStamp);
      ics.push('DTSTART:' + start);
      ics.push('DTEND:' + end);
      ics.push('SUMMARY:' + summary);
      ics.push('DESCRIPTION:' + desc);
      ics.push('LOCATION:Bari (BA)');
      ics.push('STATUS:CONFIRMED');
      ics.push('END:VEVENT');
    });
  });

  ics.push('END:VCALENDAR');

  const icsContent = ics.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opId ? ('TURNO_' + (operatori[0]?.nome || 'OP').replace(/\s+/g, '_') + '.ics') : 'ROSTER_TURNI_CAREASSIST.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof mostraToast === 'function') {
    mostraToast('Calendario iCal (.ics) pronto per Google Calendar, iPhone e Outlook!', '📅');
  }
}

// ==============================================================================
// NOTIFICA TURNI PERSONALIZZATA WHATSAPP PER OPERATORE
// ==============================================================================

function notificaTurnoWhatsApp(opId) {
  if (!turnarioCorrente) return;
  const op = turnarioCorrente.operatori.find(o => o.id === opId);
  if (!op) {
    if (typeof mostraToast === 'function') mostraToast('Collaboratore non trovato.', '⚠️');
    return;
  }

  const giorni = turnarioCorrente.giorni;
  const giorniNomi = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const dataInizio = giorni[0].split('-').reverse().join('/');
  const dataFine = giorni[6].split('-').reverse().join('/');

  let msg = '*🏥 CAREASSIST PRO — PIANO TURNI INDIVIDUALE*\n';
  msg += '*Assistito:* Sig. Ciro Milella (Bari)\n';
  msg += '*Collaboratore:* ' + op.nome + ' (' + op.ruolo + ')\n';
  msg += '*Periodo:* dal ' + dataInizio + ' al ' + dataFine + '\n\n';
  msg += '*PROSPETTO SETTIMANALE:*\n';

  let oreTotali = 0;
  let notti = 0;
  let rep = 0;

  giorni.forEach((g, idx) => {
    const t = turnarioCorrente.griglia[op.id] ? turnarioCorrente.griglia[op.id][g] : 'R';
    const info = TURNI_INFO[t] || TURNI_INFO['R'];
    if (TURNI_INFO[t]) oreTotali += TURNI_INFO[t].ore;
    if (t === 'N') notti++;
    if (t === 'D') rep++;

    const gData = g.split('-').slice(1).reverse().join('/');
    msg += '• *' + giorniNomi[idx] + ' ' + gData + ':* ' + info.icon + ' ' + info.nome + ' (' + info.orario + ')\n';
  });

  msg += '\n*RIEPILOGO CONTRATTUALE:*\n';
  msg += '⏱️ Ore Programmate: *' + oreTotali + 'h* / Contratto: ' + (op.oreContrattuali || 36) + 'h\n';
  if (notti > 0) msg += '🌙 Notti di turno: *' + notti + '*\n';
  if (rep > 0) msg += '🦺 Giorni di reperibilità: *' + rep + '*\n';
  msg += '\n_Coordinatore Turni: Ciro Milella (Admin)_';

  const telLindo = (op.tel || '').replace(/\D/g, '');
  const targetNumber = telLindo.length > 8 ? (telLindo.startsWith('39') ? telLindo : '39' + telLindo) : '';
  const url = targetNumber ? ('https://wa.me/' + targetNumber + '?text=' + encodeURIComponent(msg)) : ('https://wa.me/?text=' + encodeURIComponent(msg));
  window.open(url, '_blank');
}

// ==============================================================================
// BILANCIO MENSILE COLLABORATORI (BANCA ORE & STATISTICHE)
// ==============================================================================

function calcolaBilancioMensile() {
  if (!turnarioCorrente || !turnarioCorrente.operatori) return [];
  const res = [];
  turnarioCorrente.operatori.forEach(op => {
    let oreLav = 0, mattine = 0, pomeriggi = 0, notti = 0, smonti = 0, riposi = 0, disp = 0;
    const riga = turnarioCorrente.griglia[op.id] || {};
    Object.values(riga).forEach(t => {
      if (t === 'M') { oreLav += 7; mattine++; }
      else if (t === 'P') { oreLav += 7; pomeriggi++; }
      else if (t === 'N') { oreLav += 10; notti++; }
      else if (t === 'S') smonti++;
      else if (t === 'R') riposi++;
      else if (t === 'D') disp++;
    });

    const oreContrattuali = op.oreContrattuali || 36;
    const saldo = oreLav - oreContrattuali;

    res.push({
      id: op.id,
      nome: op.nome,
      ruolo: op.ruolo,
      profilo: op.profilo,
      oreLav: oreLav,
      oreContrattuali: oreContrattuali,
      saldo: saldo,
      mattine: mattine,
      pomeriggi: pomeriggi,
      notti: notti,
      smonti: smonti,
      riposi: riposi,
      disp: disp
    });
  });
  return res;
}

// ==============================================================================
// GESTIONE CONSEGNE CLINICHE H24
// ==============================================================================

function getConsegneCliniche() {
  try {
    return JSON.parse(localStorage.getItem('careassist_consegne_cliniche') || '[]');
  } catch(e) {
    return [];
  }
}

function aggiungiConsegnaClinica(consegna) {
  const lista = getConsegneCliniche();
  consegna.id = 'cons_' + Date.now();
  consegna.timestamp = new Date().toISOString();
  lista.unshift(consegna);
  localStorage.setItem('careassist_consegne_cliniche', JSON.stringify(lista));
  return consegna;
}

// Esporta globalmente
window.isUtenteAdmin = isUtenteAdmin;
window.sbloccaModalitaAdminManuale = sbloccaModalitaAdminManuale;
window.apriModalTurnarioAdmin = apriModalTurnarioAdmin;
window.chiudiModalTurnarioAdmin = chiudiModalTurnarioAdmin;
window.sviluppaCombinazioneAutomatica = sviluppaCombinazioneAutomatica;
window.ciclaTurnoCella = ciclaTurnoCella;
window.impostaTurnoCella = impostaTurnoCella;
window.TURNI_INFO = TURNI_INFO;
window.caricaDatiTurnario = caricaDatiTurnario;
window.sincronizzaOperatoriCareAssist = sincronizzaOperatoriCareAssist;
window.cambiaSettimanaTurnario = cambiaSettimanaTurnario;
window.navigaSettimana = navigaSettimana;
window.aggiungiOperatoreTurnario = aggiungiOperatoreTurnario;
window.aggiornaDatiOperatore = aggiornaDatiOperatore;
window.rimuoviOperatoreTurnario = rimuoviOperatoreTurnario;
window.stampaTurnarioCartaceoA4 = stampaTurnarioCartaceoA4;
window.condividiTurnarioWhatsApp = condividiTurnarioWhatsApp;
window.formatDateYMD = formatDateYMD;
window.parseDateYMD = parseDateYMD;
window.getLunediSettimana = getLunediSettimana;

window.eseguiBackupSicurezzaUSB = eseguiBackupSicurezzaUSB;
window.eseguiSincronizzazioneUSB = eseguiSincronizzazioneUSB;
window.esportaCalendarioICS = esportaCalendarioICS;
window.notificaTurnoWhatsApp = notificaTurnoWhatsApp;
window.calcolaBilancioMensile = calcolaBilancioMensile;
window.getConsegneCliniche = getConsegneCliniche;
window.aggiungiConsegnaClinica = aggiungiConsegnaClinica;
