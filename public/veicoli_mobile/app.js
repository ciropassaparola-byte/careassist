
window.chiudiModali = function() {
  document.querySelectorAll(".modal-overlay").forEach(m => {
    m.classList.remove("active");
    m.style.display = "none";
  });
};

const STORAGE_KEY = 'flotta_veicoli_mobile_db';

const defaultVeicoliData = {
  "scadenze": {
    "assicurazione": { "titolo": "Assicurazione RCA Veicolo", "data": "2026-12-31", "nota": "Copertura Attiva Regolare", "stato": "OK" },
    "revisione": { "titolo": "Revisione Ministeriale Periodica", "data": "2027-05-31", "nota": "Centro Revisioni Autorizzato", "stato": "In Regola" },
    "bollo": { "titolo": "Bollo Auto Annuale", "data": "2027-01-31", "nota": "Regione Basilicata / ACI", "stato": "Pagato" }
  },
  "spese": [
    {
      "id": 20,
      "data": "2026-09-18",
      "desc": "olio,",
      "costo": 150,
      "note": "ORDINARIA"
    },
    {
      "id": 19,
      "data": "2026-08-03",
      "desc": "stostituzione pompa acqua",
      "costo": 207,
      "note": "STRAORDINARIA"
    },
    {
      "id": 16,
      "data": "2026-07-31",
      "desc": "soccorso stradale Barletta-Bari",
      "costo": 130,
      "note": "soccorso stradale Barletta-Bari"
    },
    {
      "id": 17,
      "data": "2026-07-31",
      "desc": "termostato ventola",
      "costo": 140,
      "note": "termostato ventola"
    },
    {
      "id": 15,
      "data": "2026-07-22",
      "desc": "Distributore di accensione, candele",
      "costo": 270,
      "note": "Distributore di accensione, candele"
    },
    {
      "id": 14,
      "data": "2026-06-08",
      "desc": "LAVAGGIO ESTERNO",
      "costo": 7,
      "note": "STRAORDINARIA"
    },
    {
      "id": 13,
      "data": "2026-05-29",
      "desc": "Lavaggio interni ed esterni",
      "costo": 13,
      "note": "Lavaggio interni ed esterni"
    },
    {
      "id": 3,
      "data": "2026-04-20",
      "desc": "Lavaggio completo e Igienizzazione",
      "costo": 15,
      "note": "Lavaggio interni ed esterni"
    },
    {
      "id": 4,
      "data": "2026-04-17",
      "desc": "cambio ruote estive",
      "costo": 45,
      "note": "CAMBIO RUOTE ESTIVE"
    }
  ],
  "rifornimenti": [
    {
      "id": 35,
      "data": "2026-10-18",
      "litri": 22.61,
      "costo": 45.08,
      "km": 149991,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 34,
      "data": "2026-10-11",
      "litri": 26.87,
      "costo": 53.18,
      "km": 149620,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 33,
      "data": "2026-10-04",
      "litri": 19.2,
      "costo": 38,
      "km": 149207,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 32,
      "data": "2026-10-03",
      "litri": 28.15,
      "costo": 55.71,
      "km": 0,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 31,
      "data": "2026-09-25",
      "litri": 12.99,
      "costo": 27.53,
      "km": 0,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 30,
      "data": "2026-09-14",
      "litri": 29,
      "costo": 60,
      "km": 148178,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 29,
      "data": "2026-09-06",
      "litri": 17.25,
      "costo": 35,
      "km": 147702,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 28,
      "data": "2026-09-04",
      "litri": 21.47,
      "costo": 43.35,
      "km": 147343,
      "note": "Rifornimento"
    },
    {
      "id": 27,
      "data": "2026-07-31",
      "litri": 22.97,
      "costo": 45,
      "km": 146036,
      "note": "Centro commerciale casamassima"
    },
    {
      "id": 26,
      "data": "2026-07-23",
      "litri": 25.82,
      "costo": 50.06,
      "km": 145074,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 24,
      "data": "2026-07-13",
      "litri": 16.59,
      "costo": 30.34,
      "km": 144674,
      "note": "Rifornimento"
    },
    {
      "id": 25,
      "data": "2026-07-10",
      "litri": 12,
      "costo": 21.95,
      "km": 144462,
      "note": "Rifornimento"
    },
    {
      "id": 23,
      "data": "2026-07-05",
      "litri": 18.19,
      "costo": 33.27,
      "km": 144159,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 22,
      "data": "2026-07-04",
      "litri": 24.16,
      "costo": 44.19,
      "km": 143811,
      "note": "centro commerciale"
    },
    {
      "id": 20,
      "data": "2026-06-21",
      "litri": 19.01,
      "costo": 34.39,
      "km": 143424,
      "note": "Rifornimento"
    },
    {
      "id": 21,
      "data": "2026-06-19",
      "litri": 26.66,
      "costo": 48.23,
      "km": 143049,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 19,
      "data": "2026-06-14",
      "litri": 16.71,
      "costo": 31.06,
      "km": 142572,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 18,
      "data": "2026-06-13",
      "litri": 20.48,
      "costo": 38.07,
      "km": 142226,
      "note": "centro cemmerciale casamassima"
    },
    {
      "id": 14,
      "data": "2026-06-09",
      "litri": 15.03,
      "costo": 28.54,
      "km": 141872,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 12,
      "data": "2026-06-07",
      "litri": 24.04,
      "costo": 46.13,
      "km": 141615,
      "note": "CENTRO COMMERCIALE CASAMASSIMA"
    },
    {
      "id": 9,
      "data": "2026-05-30",
      "litri": 17.1,
      "costo": 32.81,
      "km": 141183,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 8,
      "data": "2026-05-29",
      "litri": 19,
      "costo": 36.46,
      "km": 140845,
      "note": "centro commerciale casamassima140845"
    },
    {
      "id": 5,
      "data": "2026-05-24",
      "litri": 19.08,
      "costo": 36.42,
      "km": 140506,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 6,
      "data": "2026-05-22",
      "litri": 22.1,
      "costo": 42.19,
      "km": 140152,
      "note": "centro commerciale casamassima"
    },
    {
      "id": 4,
      "data": "2026-05-05",
      "litri": 34.41,
      "costo": 65,
      "km": 139856,
      "note": "Centro commerciale Casamassima"
    }
  ],
  "rimborsiMesi": [
    {
      "mese": "Gennaio 2026",
      "rimborsi": 131.31,
      "benzina": 32.7,
      "netto": 98.61
    },
    {
      "mese": "Febbraio 2026",
      "rimborsi": 398.3,
      "benzina": 99.18,
      "netto": 299.12
    },
    {
      "mese": "Marzo 2026",
      "rimborsi": 319.38,
      "benzina": 79.53,
      "netto": 239.85
    },
    {
      "mese": "Aprile 2026",
      "rimborsi": 239.28,
      "benzina": 59.58,
      "netto": 119.7
    },
    {
      "mese": "Maggio 2026",
      "rimborsi": 280,
      "benzina": 212.88,
      "netto": 67.12
    },
    {
      "mese": "Giugno 2026",
      "rimborsi": 496.04,
      "benzina": 226.42,
      "netto": 269.62
    },
    {
      "mese": "Luglio 2026",
      "rimborsi": 305.6,
      "benzina": 224.81,
      "netto": 80.79
    },
    {
      "mese": "Agosto 2026",
      "rimborsi": 128.1,
      "benzina": 33.08,
      "netto": 95.02
    },
    {
      "mese": "Settembre 2026",
      "rimborsi": 310,
      "benzina": 165.88,
      "netto": 144.12
    },
    {
      "mese": "Ottobre 2026",
      "rimborsi": 380,
      "benzina": 191.97,
      "netto": 188.03
    }
  ]
};

let AppData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultVeicoliData;

function saveAppData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(AppData));
  renderAll();
  // Sincronizza su server in background
  try {
    fetch('/api/veicoli/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(AppData)
    }).catch(() => {});
  } catch(e) {}
}

async function caricaDatiDaServer() {
  try {
    const res = await fetch('/api/veicoli/data');
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && (serverData.rifornimenti?.length > 0 || serverData.spese?.length > 0)) {
        // Unisci mantenendo eventuali record salvati di recente in locale
        const localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (localData && localData.rifornimenti) {
          const mapRif = new Map();
          (serverData.rifornimenti || []).forEach(r => mapRif.set(String(r.id), r));
          (localData.rifornimenti || []).forEach(r => mapRif.set(String(r.id), r));
          serverData.rifornimenti = Array.from(mapRif.values()).sort((a,b) => (b.data || '').localeCompare(a.data || ''));

          const mapSpese = new Map();
          (serverData.spese || []).forEach(s => mapSpese.set(String(s.id), s));
          (localData.spese || []).forEach(s => mapSpese.set(String(s.id), s));
          serverData.spese = Array.from(mapSpese.values()).sort((a,b) => (b.data || '').localeCompare(a.data || ''));
        }
        AppData = serverData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(AppData));
        renderAll();
      }
    }
  } catch(e) {
    console.warn('Offline mode: uso dati cache locali');
  }
}

function switchView(tabName, btnElem) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section-view').forEach(v => v.classList.remove('active'));

  if (btnElem) {
    btnElem.classList.add('active');
  } else {
    const defaultBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (defaultBtn) defaultBtn.classList.add('active');
  }

  const target = document.getElementById('view-' + tabName);
  if (target) target.classList.add('active');
}

function formattaDataItaliana(dStr) {
  if (!dStr) return '--/--/----';
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return dStr;
}

function renderAll() {
  // 1. Spese
  const cSpese = document.getElementById('list-spese');
  if (cSpese) {
    cSpese.innerHTML = AppData.spese.map(s => `
      <div class="item-card" style="border-radius:16px; border:1.5px solid #e2e8f0; padding:14px 16px; margin-bottom:10px; cursor:pointer; transition:all 0.2s;" onclick="apriModificaSpesa('${s.id}')" title="Clicca per modificare questo intervento">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:44px; height:44px; min-width:44px; border-radius:50%; background:linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border:1.5px solid #0284c7; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(2,132,199,0.25); flex-shrink:0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </div>
            <div class="item-left">
              <div class="item-title" style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:14.5px; font-weight:800; color:#0f3d6c;">${s.desc}</span>
                <span style="font-size:10.5px; background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:10px; font-weight:800; border:1px solid #bae6fd;">✏️ Modifica</span>
              </div>
              <div class="item-date" style="font-size:12px; color:#64748b; margin-top:3px;">📅 <b>${formattaDataItaliana(s.data)}</b> ${s.note ? ' &bull; 🏢 ' + s.note : ''}</div>
              <span class="item-tag tag-blue" style="margin-top:4px;">Manutenzione Auto</span>
            </div>
          </div>
          <div class="item-cost negative" style="font-size:16px; font-weight:800; white-space:nowrap;">-€ ${parseFloat(s.costo).toFixed(2)}</div>
        </div>
      </div>
    `).join('');
  }

  // 2. Rifornimenti
  const cRif = document.getElementById('list-rifornimenti');
  if (cRif) {
    cRif.innerHTML = AppData.rifornimenti.map(r => `
      <div class="item-card" style="border-radius:16px; border:1.5px solid #e2e8f0; padding:14px 16px; margin-bottom:10px; cursor:pointer; transition:all 0.2s;" onclick="apriModificaRifornimento('${r.id}')" title="Clicca per modificare questo rifornimento">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:44px; height:44px; min-width:44px; border-radius:50%; background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border:1.5px solid #f59e0b; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(245,158,11,0.25); flex-shrink:0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="22" x2="15" y2="22"></line>
                <line x1="4" y1="9" x2="14" y2="9"></line>
                <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path>
                <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path>
              </svg>
            </div>
            <div class="item-left">
              <div class="item-title" style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:14.5px; font-weight:800; color:#0f3d6c;">Rifornimento Carburante ${r.litri ? '(' + r.litri + ' Litri)' : ''}</span>
                <span style="font-size:10.5px; background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:10px; font-weight:800; border:1px solid #bae6fd;">✏️ Modifica</span>
              </div>
              <div class="item-date" style="font-size:12px; color:#64748b; margin-top:3px;">📅 <b>${formattaDataItaliana(r.data)}</b> ${r.km ? ' &bull; 🚗 ' + Number(r.km).toLocaleString('it-IT') + ' Km' : ''} ${r.note ? ' &bull; 📍 ' + r.note : ''}</div>
              <span class="item-tag tag-amber" style="margin-top:4px;">Carburante</span>
            </div>
          </div>
          <div class="item-cost negative" style="font-size:16px; font-weight:800; white-space:nowrap;">-€ ${parseFloat(r.costo).toFixed(2)}</div>
        </div>
      </div>
    `).join('');
  }

  // 3. Rimborsi Mesi
  const cRimborsi = document.getElementById('list-rimborsi');
  if (cRimborsi) {
    cRimborsi.innerHTML = AppData.rimborsiMesi.map(m => `
      <div class="item-card">
        <div class="item-left">
          <div class="item-title">${m.mese}</div>
          <div class="item-date">ACI: <b>€ ${m.rimborsi.toFixed(2)}</b> &bull; Carburante: € ${m.benzina.toFixed(2)}</div>
          <span class="item-tag ${m.netto >= 0 ? 'tag-green' : 'tag-amber'}">${m.netto >= 0 ? 'Guadagno Netto' : 'Spese Mese Elevate'}</span>
        </div>
        <div class="item-cost ${m.netto >= 0 ? 'positive' : 'negative'}">
          ${m.netto >= 0 ? '+' : ''}€ ${m.netto.toFixed(2)}
        </div>
      </div>
    `).join('');
  }

  // 4. Scadenze Documenti
  const cScad = document.getElementById("list-scadenze");
  if (cScad) {
    const sc = AppData.scadenze || (typeof defaultVeicoliData !== "undefined" ? defaultVeicoliData.scadenze : {});
    const items = [
      {
        key: 'assicurazione',
        titolo: 'Assicurazione Auto',
        sottotitolo: 'Guida senza pensieri',
        iconCircleBg: '#e0f2fe',
        iconBorder: '#bae6fd',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
        labelPrefix: 'Scadenza',
        badgeBg: '#ecfdf5',
        badgeColor: '#059669',
        badgeBorder: '#a7f3d0',
        data: sc.assicurazione
      },
      {
        key: 'revisione',
        titolo: 'Revisione Periodica',
        sottotitolo: 'In regola con la legge',
        iconCircleBg: '#e0f2fe',
        iconBorder: '#bae6fd',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
        labelPrefix: 'Prossimo Controllo',
        badgeBg: '#eff6ff',
        badgeColor: '#1d4ed8',
        badgeBorder: '#bfdbfe',
        data: sc.revisione
      },
      {
        key: 'bollo',
        titolo: 'Bollo Auto Annuale',
        sottotitolo: 'Tassa automobilistica ACI',
        iconCircleBg: '#fef3c7',
        iconBorder: '#fde68a',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
        labelPrefix: 'Termine Pagamento',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        badgeBorder: '#fde68a',
        data: sc.bollo
      }
    ];

    cScad.innerHTML = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; margin-bottom: 20px;">' + items.map(it => {
      const d = it.data || {};
      const dataFmt = (typeof formattaDataItaliana === 'function' && d.data) ? formattaDataItaliana(d.data) : (d.data || '---');
      return `
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 20px; padding: 18px 20px; box-shadow: 0 4px 16px rgba(15,23,42,0.06); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 46px; height: 46px; min-width: 46px; border-radius: 50%; background: ${it.iconCircleBg}; border: 1.5px solid ${it.iconBorder}; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                ${it.iconSvg}
              </div>
              <div>
                <div style="font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 800; color: #0f3d6c; line-height: 1.2;">${it.titolo}</div>
                <div style="font-size: 11.5px; color: #64748b; font-weight: 600; margin-top: 2px;">${it.sottotitolo}</div>
              </div>
            </div>
            <span style="font-size: 11px; font-weight: 800; background: ${it.badgeBg}; color: ${it.badgeColor}; border: 1px solid ${it.badgeBorder}; padding: 3px 10px; border-radius: 12px; white-space: nowrap;">
              ${d.stato || 'In Regola'}
            </span>
          </div>

          <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 14px; padding: 11px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${it.labelPrefix}</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">📅 ${dataFmt}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Dettaglio / Ente</div>
              <div style="font-size: 11.5px; font-weight: 700; color: #475569; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${d.nota || 'Regolare'}</div>
            </div>
          </div>

          <button type="button" onclick="apriModalModificaScadenze()" style="background: #e0f2fe; color: #0284c7; border: 1.5px solid #bae6fd; border-radius: 12px; padding: 10px 14px; font-size: 12.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; width: 100%; box-shadow: 0 2px 6px rgba(2,132,199,0.08);">
            <span>✏️</span> Modifica Dati & Scadenza
          </button>
        </div>
      `;
    }).join('') + '</div>';
  }
}

function apriModalSpesa() {
  document.getElementById('modal-spesa-title').innerText = 'Registra Spesa / Intervento';
  document.getElementById('form-spesa-id').value = '';
  document.getElementById('form-spesa-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('form-spesa-desc').value = '';
  document.getElementById('form-spesa-costo').value = '';
  document.getElementById('form-spesa-note').value = '';
  const delBtn = document.getElementById('btn-spesa-elimina');
  if (delBtn) delBtn.style.display = 'none';
  const mp = document.getElementById('modal-spesa'); mp.style.display = 'flex'; mp.classList.add('active');
}

function apriModificaSpesa(id) {
  const item = (AppData.spese || []).find(s => String(s.id) === String(id));
  if (!item) return;

  document.getElementById('modal-spesa-title').innerText = 'Modifica Spesa / Intervento';
  document.getElementById('form-spesa-id').value = item.id;
  document.getElementById('form-spesa-data').value = item.data || '';
  document.getElementById('form-spesa-desc').value = item.desc || '';
  document.getElementById('form-spesa-costo').value = item.costo || '';
  document.getElementById('form-spesa-note').value = item.note || '';

  const delBtn = document.getElementById('btn-spesa-elimina');
  if (delBtn) delBtn.style.display = 'inline-block';

  const mp = document.getElementById('modal-spesa'); mp.style.display = 'flex'; mp.classList.add('active');
}

function eliminaSpesaCorrente() {
  const id = document.getElementById('form-spesa-id').value;
  if (!id) return;
  if (!confirm('Vuoi eliminare definitivamente questa spesa?')) return;

  AppData.spese = (AppData.spese || []).filter(s => String(s.id) !== String(id));
  saveAppData();
  chiudiModali();
  if (typeof showToast === 'function') showToast('Spesa eliminata con successo.', 'info');
}

function salvaSpesa(e) {
  e.preventDefault();
  const id = document.getElementById('form-spesa-id').value;
  const data = document.getElementById('form-spesa-data').value;
  const desc = document.getElementById('form-spesa-desc').value;
  const costo = parseFloat(document.getElementById('form-spesa-costo').value) || 0;
  const note = document.getElementById('form-spesa-note').value;

  if (id) {
    // Modifica esistente
    const idx = (AppData.spese || []).findIndex(s => String(s.id) === String(id));
    if (idx !== -1) {
      AppData.spese[idx] = { ...AppData.spese[idx], data, desc, costo, note };
    }
  } else {
    // Nuova spesa
    AppData.spese.unshift({ id: Date.now(), data, desc, costo, note });
  }

  AppData.spese.sort((a,b) => (b.data || '').localeCompare(a.data || ''));
  saveAppData();
  chiudiModali();
  if (typeof showToast === 'function') showToast('✅ Spesa salvata con successo!', 'success');
}

function apriModalRifornimento() {
  document.getElementById('modal-rif-title').innerText = 'Registra Rifornimento Carburante';
  document.getElementById('form-rif-id').value = '';
  document.getElementById('form-rif-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('form-rif-costo').value = '';
  document.getElementById('form-rif-km').value = '';
  document.getElementById('form-rif-prezzo-litro').value = '';
  document.getElementById('form-rif-litri').value = '';
  document.getElementById('form-rif-note').value = '';
  const delBtn = document.getElementById('btn-rif-elimina');
  if (delBtn) delBtn.style.display = 'none';
  const mr = document.getElementById('modal-rifornimento'); mr.style.display = 'flex'; mr.classList.add('active');
}

function apriModificaRifornimento(id) {
  const item = (AppData.rifornimenti || []).find(r => String(r.id) === String(id));
  if (!item) return;

  document.getElementById('modal-rif-title').innerText = 'Modifica Rifornimento Carburante';
  document.getElementById('form-rif-id').value = item.id;
  document.getElementById('form-rif-data').value = item.data || '';
  document.getElementById('form-rif-costo').value = item.costo || '';
  document.getElementById('form-rif-km').value = item.km || '';
  document.getElementById('form-rif-litri').value = item.litri || '';
  document.getElementById('form-rif-note').value = item.note || '';

  if (item.costo && item.litri && parseFloat(item.litri) > 0) {
    document.getElementById('form-rif-prezzo-litro').value = (parseFloat(item.costo) / parseFloat(item.litri)).toFixed(3);
  } else {
    document.getElementById('form-rif-prezzo-litro').value = '';
  }

  const delBtn = document.getElementById('btn-rif-elimina');
  if (delBtn) delBtn.style.display = 'inline-block';

  const mr = document.getElementById('modal-rifornimento'); mr.style.display = 'flex'; mr.classList.add('active');
}

function eliminaRifornimentoCorrente() {
  const id = document.getElementById('form-rif-id').value;
  if (!id) return;
  if (!confirm('Vuoi eliminare definitivamente questo rifornimento?')) return;

  AppData.rifornimenti = (AppData.rifornimenti || []).filter(r => String(r.id) !== String(id));
  saveAppData();
  chiudiModali();
  if (typeof showToast === 'function') showToast('Rifornimento eliminato con successo.', 'info');
}

function salvaRifornimento(e) {
  e.preventDefault();
  const id = document.getElementById('form-rif-id').value;
  const data = document.getElementById('form-rif-data').value;
  const costo = parseFloat(document.getElementById('form-rif-costo').value) || 0;
  const km = parseInt(document.getElementById('form-rif-km').value) || 0;
  const litri = parseFloat(document.getElementById('form-rif-litri').value) || 0;
  const note = document.getElementById('form-rif-note').value;

  if (id) {
    // Modifica esistente
    const idx = (AppData.rifornimenti || []).findIndex(r => String(r.id) === String(id));
    if (idx !== -1) {
      AppData.rifornimenti[idx] = { ...AppData.rifornimenti[idx], data, costo, km, litri, note };
    }
  } else {
    // Nuovo rifornimento
    AppData.rifornimenti.unshift({ id: Date.now(), data, costo, km, litri, note });
  }

  AppData.rifornimenti.sort((a,b) => (b.data || '').localeCompare(a.data || ''));
  saveAppData();
  chiudiModali();
  if (typeof showToast === 'function') showToast('✅ Rifornimento salvato con successo!', 'success');
}

window.addEventListener('DOMContentLoaded', () => {
  // Se i dati locali avevano solo i 4 rifornimenti demo, aggiorna ai dati reali
  if (!AppData.rifornimenti || AppData.rifornimenti.length <= 4) {
    AppData = defaultVeicoliData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppData));
  }
  renderAll();
  caricaDatiDaServer();
});


// ============================================================================
// INTELLIGENZA OTTICA FOTOCAMERA: CRUSCOTTO (KM) & SCONTRINO CARBURANTE
// ============================================================================
function apriVeicoliOcrModal(titolo, desc, icona) {
  const m = document.getElementById('veicoli-ocr-modal');
  if (m) {
    document.getElementById('veicoli-ocr-title').textContent = titolo || 'Analisi Immagine...';
    document.getElementById('veicoli-ocr-sub').textContent = desc || 'Lettura caratteri in corso...';
    document.getElementById('veicoli-ocr-icon').textContent = icona || '🔍';
    m.style.display = 'flex';
  }
}

function chiudiVeicoliOcrModal() {
  const m = document.getElementById('veicoli-ocr-modal');
  if (m) m.style.display = 'none';
}

function ricalcolaLitriRif() {
  const costoInp = document.getElementById('form-rif-costo');
  const prezzoLitroInp = document.getElementById('form-rif-prezzo-litro');
  const litriInp = document.getElementById('form-rif-litri');

  const costo = parseFloat(costoInp?.value) || 0;
  const prezzoLitro = parseFloat(prezzoLitroInp?.value) || 0;

  if (costo > 0 && prezzoLitro > 0 && litriInp) {
    litriInp.value = (costo / prezzoLitro).toFixed(2);
  }
}

// 1. SCANSIONE CRUSCOTTO (CONTACHILOMETRI)
async function scansionaCruscotto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  // Apre subito il modale di inserimento per accogliere i dati
  apriModalRifornimento();
  apriVeicoliOcrModal('Lettura Cruscotto Auto', 'Riconoscimento contachilometri digitale/analogico...', '🚗');

  try {
    let text = '';
    if (typeof Tesseract !== 'undefined') {
      const worker = await Tesseract.createWorker(['ita', 'eng']);
      const ret = await worker.recognize(file);
      await worker.terminate();
      text = ret.data.text || '';
    }

    console.log('Testo Cruscotto Riconosciuto:\n', text);

    // Cerca numeri tipici contachilometri (es. tra 5.000 e 600.000 km)
    const cleanDigits = text.replace(/[^0-9\s]/g, ' ');
    const numbers = cleanDigits.match(/\b\d{4,6}\b/g);

    let detectedKm = null;
    if (numbers && numbers.length > 0) {
      const parsed = numbers.map(n => parseInt(n, 10)).filter(n => n >= 5000 && n <= 600000);
      if (parsed.length > 0) detectedKm = Math.max(...parsed);
    }

    if (detectedKm) {
      document.getElementById('form-rif-km').value = detectedKm;
      showToast('Km rilevati da cruscotto: ' + detectedKm.toLocaleString('it-IT') + ' km!', 'success');
    } else {
      showToast('Cruscotto aperto. Inserisci i km se non letti perfettamente.', 'info');
    }
  } catch(err) {
    console.warn('OCR Cruscotto:', err);
    showToast('Scheda rifornimento pronta: verifica i km rilevati.', 'info');
  } finally {
    chiudiVeicoliOcrModal();
    try { event.target.value = ''; } catch(e){}
  }
}

// 2. SCANSIONE SCONTRINO CARBURANTE (DISTRIBUTORE, COSTO, LITRI, PREZZO/L)
async function scansionaScontrino(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  // 1. APRE IMMEDIATAMENTE LA SCHEDA DI COMPILAZIONE RIFORNIMENTO
  apriModalRifornimento();
  apriVeicoliOcrModal('Lettura Scontrino Pompa', 'Estrazione importo totale, litri, prezzo/L e distributore...', '🧾');

  try {
    let text = '';
    if (typeof Tesseract !== 'undefined') {
      const worker = await Tesseract.createWorker(['ita', 'eng']);
      const ret = await worker.recognize(file);
      await worker.terminate();
      text = ret.data.text || '';
    }

    const upper = text.toUpperCase();
    console.log('Testo Scontrino Riconosciuto:\n', text);

    // 1. DATA (Supporta DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD.MM.YY)
    const dateMatch = upper.match(/(\d{2})[\/\.-](\d{2})[\/\.-](\d{2,4})/);
    if (dateMatch) {
      let d = dateMatch[1];
      let m = dateMatch[2];
      let yr = dateMatch[3];
      if (yr.length === 2) yr = '20' + yr;
      const formattedDate = yr + '-' + m + '-' + d;
      const dateInp = document.getElementById('form-rif-data');
      if (dateInp) dateInp.value = formattedDate;
    }

    // 2. DISTRIBUTORE / LOCALITA (Include IPERSTAROIL, CASAMASSIMA, ENI, IP, Q8, TAMOIL, ESSO, REPSOL, CONAD, TOTAL, BEYFIN, RETI)
    const brands = [
      'IPERSTAROIL', 'STAROIL', 'ENI', 'AGIP', 'Q8', 'KUWAIT', 'IP ', 'ITALIANA PETROLI', 
      'TAMOIL', 'ESSO', 'REPSOL', 'CONAD', 'TOTAL', 'BEYFIN', 'RETI', 'KEROPETROL', 'AVIA', 'COSTANTIN'
    ];
    let foundBrand = '';
    for (const b of brands) {
      if (upper.includes(b)) {
        foundBrand = b.trim();
        break;
      }
    }
    // Rileva eventuale comune/localita se presente (es. Casamassima)
    let extraLoc = '';
    const locs = ['CASAMASSIMA', 'BARI', 'NOICATTARO', 'RUTIGLIANO', 'VALENZANO', 'CAPURSO', 'TRIGGIANO', 'MODUGNO'];
    for (const loc of locs) {
      if (upper.includes(loc)) {
        extraLoc = ' (' + loc.charAt(0) + loc.slice(1).toLowerCase() + ')';
        break;
      }
    }

    const noteInp = document.getElementById('form-rif-note');
    if (noteInp) {
      if (foundBrand) {
        noteInp.value = foundBrand + extraLoc;
      } else if (extraLoc) {
        noteInp.value = 'Distributore' + extraLoc;
      }
    }

    // 3. TOTALE EURO (Supporta: "IMPORTO EURO 39,24", "EUR 39,24", "TOTALE 39.24", "€ 39,24", "TOT 39.24")
    let detectedTotal = null;
    const totalMatch = upper.match(/(?:IMPORTO\s*EURO|IMPORTO\s*EUR|IMPORTO|TOTALE|PAGATO|EURO|EUR|€|IMP|TOT)[^0-9]*([0-9]{1,3}[,\.][0-9]{2})/);
    if (totalMatch) {
      detectedTotal = parseFloat(totalMatch[1].replace(',', '.'));
    } else {
      // Fallback: cerca importi numerici con 2 decimali plausibili (da 10€ a 250€)
      const allPrices = upper.match(/\b([1-9][0-9]{1,2}[,\.][0-9]{2})\b/g);
      if (allPrices && allPrices.length > 0) {
        const floatPrices = allPrices.map(p => parseFloat(p.replace(',', '.'))).filter(p => p >= 10 && p <= 250);
        if (floatPrices.length > 0) detectedTotal = Math.max(...floatPrices);
      }
    }

    if (detectedTotal && detectedTotal > 0 && detectedTotal < 500) {
      const costoInp = document.getElementById('form-rif-costo');
      if (costoInp) costoInp.value = detectedTotal.toFixed(2);
    }

    // 4. PREZZO AL LITRO (Supporta: "EUR/L 1,984", "EURO/L 1.984", "€/L 1,984", "PREZZO 1,984", "1.984")
    let detectedPrezzoLitro = null;
    const priceLitroMatch = upper.match(/(?:EUR\/L|EURO\/L|€\/L|PREZZO|AL\s*LITRO|CAD)[^0-9]*([12][,\.][0-9]{3})/);
    if (priceLitroMatch) {
      detectedPrezzoLitro = parseFloat(priceLitroMatch[1].replace(',', '.'));
    } else {
      // Fallback a 3 cifre decimali tipiche dei carburanti (es: 1,984 o 1.859)
      const matches3Dec = upper.match(/\b([12][,\.][0-9]{3})\b/);
      if (matches3Dec) {
        detectedPrezzoLitro = parseFloat(matches3Dec[1].replace(',', '.'));
      }
    }
    if (detectedPrezzoLitro && detectedPrezzoLitro >= 1 && detectedPrezzoLitro <= 3) {
      const pLInp = document.getElementById('form-rif-prezzo-litro');
      if (pLInp) pLInp.value = detectedPrezzoLitro.toFixed(3);
    }

    // 5. LITRI EROGATI (Supporta: "QUANTITA' L 19,78", "LITRI 19.78", "VOL 19,78", "L 19,78", "LT 19,78")
    let detectedLitri = null;
    const litriMatch = upper.match(/(?:QUANTITA|QUANTITÀ|LITRI|VOL|EROGATO|\bL\b|\bLT\b)[^0-9]*([0-9]{1,3}[,\.][0-9]{2})/);
    if (litriMatch) {
      detectedLitri = parseFloat(litriMatch[1].replace(',', '.'));
    }
    if (detectedLitri && detectedLitri > 0 && detectedLitri < 150) {
      const litInp = document.getElementById('form-rif-litri');
      if (litInp) litInp.value = detectedLitri.toFixed(2);
    }

    // 6. RICALCOLI CROCIATI INTELLIGENTI
    // Se abbiamo Totale e Prezzo/L ma mancano i litri: calcola Litri = Totale / Prezzo/L
    ricalcolaLitriRif();

    // Se abbiamo Totale e Litri ma manca il Prezzo/L: calcola Prezzo/L = Totale / Litri
    const cVal = parseFloat(document.getElementById('form-rif-costo')?.value) || 0;
    const lVal = parseFloat(document.getElementById('form-rif-litri')?.value) || 0;
    const pVal = parseFloat(document.getElementById('form-rif-prezzo-litro')?.value) || 0;
    if (cVal > 0 && lVal > 0 && !pVal) {
      const calcPL = (cVal / lVal).toFixed(3);
      const pLInp = document.getElementById('form-rif-prezzo-litro');
      if (pLInp) pLInp.value = calcPL;
    }

    if (detectedTotal || detectedLitri) {
      showToast('Scontrino decodificato: € ' + (detectedTotal || cVal).toFixed(2) + ' compilati!', 'success');
    } else {
      showToast('Scheda aperta: controlla i campi compilati.', 'info');
    }

  } catch(err) {
    console.warn('OCR Scontrino:', err);
    showToast('Scheda aperta: inserisci i dettagli del rifornimento.', 'info');
  } finally {
    chiudiVeicoliOcrModal();
    try { event.target.value = ''; } catch(e){}
  }
}

// 3. SCANSIONE FATTURA / RICEVUTA MECCANICO
async function scansionaFatturaSpesa(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  apriVeicoliOcrModal('Lettura Fattura Meccanico', 'Estrazione importo spesa e officina...', '🔧');

  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract non pronto');
    const worker = await Tesseract.createWorker('ita');
    const ret = await worker.recognize(file);
    await worker.terminate();

    const text = ret.data.text || '';
    const upper = text.toUpperCase();

    // Data
    const dateMatch = upper.match(/(\d{2})[\/\.-](\d{2})[\/\.-](\d{2,4})/);
    if (dateMatch) {
      let yr = dateMatch[3];
      if (yr.length === 2) yr = '20' + yr;
      document.getElementById('form-spesa-data').value = yr + '-' + dateMatch[2] + '-' + dateMatch[1];
    }

    // Importo Totale
    const totMatch = upper.match(/(?:TOTALE|IMPORTO|FATTURA|SALDO)[^0-9]*([0-9]{1,4}[,\.][0-9]{2})/);
    if (totMatch) {
      const tot = parseFloat(totMatch[1].replace(',', '.'));
      if (tot > 0) document.getElementById('form-spesa-costo').value = tot.toFixed(2);
    }

    // Descrizione / Officina
    if (upper.includes('GOMME') || upper.includes('PNEUMATICI')) {
      document.getElementById('form-spesa-desc').value = 'Sostituzione Pneumatici / Convergenza';
    } else if (upper.includes('TAGLIANDO') || upper.includes('FILTRO') || upper.includes('OLIO')) {
      document.getElementById('form-spesa-desc').value = 'Tagliando e Filtri';
    } else if (upper.includes('REVISIONE')) {
      document.getElementById('form-spesa-desc').value = 'Revisione Ministeriale';
    }

    showToast('Fattura manutenzione analizzata!', 'success');
  } catch(e) {
    showToast('Ricevuta caricata.', 'info');
  } finally {
    chiudiVeicoliOcrModal();
    event.target.value = '';
  }
}


function apriModalModificaScadenze() {
  const sc = AppData.scadenze || defaultVeicoliData.scadenze;
  document.getElementById('form-scad-ass-data').value = sc.assicurazione?.data || '2026-12-31';
  document.getElementById('form-scad-ass-stato').value = sc.assicurazione?.stato || 'OK';
  document.getElementById('form-scad-ass-nota').value = sc.assicurazione?.nota || 'Copertura Attiva Regolare';

  document.getElementById('form-scad-rev-data').value = sc.revisione?.data || '2027-05-31';
  document.getElementById('form-scad-rev-stato').value = sc.revisione?.stato || 'In Regola';
  document.getElementById('form-scad-rev-nota').value = sc.revisione?.nota || 'Centro Revisioni Autorizzato';

  document.getElementById('form-scad-bollo-data').value = sc.bollo?.data || '2027-01-31';
  document.getElementById('form-scad-bollo-stato').value = sc.bollo?.stato || 'Pagato';
  document.getElementById('form-scad-bollo-nota').value = sc.bollo?.nota || 'Regione Basilicata / ACI';

  const ms = document.getElementById('modal-scadenze'); ms.style.display = 'flex'; ms.classList.add('active');
}

function salvaScadenzeForm(e) {
  e.preventDefault();
  if (!AppData.scadenze) AppData.scadenze = {};

  AppData.scadenze.assicurazione = {
    titolo: 'Assicurazione RCA Veicolo',
    data: document.getElementById('form-scad-ass-data').value,
    stato: document.getElementById('form-scad-ass-stato').value || 'OK',
    nota: document.getElementById('form-scad-ass-nota').value || 'Copertura Attiva Regolare'
  };

  AppData.scadenze.revisione = {
    titolo: 'Revisione Ministeriale Periodica',
    data: document.getElementById('form-scad-rev-data').value,
    stato: document.getElementById('form-scad-rev-stato').value || 'In Regola',
    nota: document.getElementById('form-scad-rev-nota').value || 'Centro Revisioni Autorizzato'
  };

  AppData.scadenze.bollo = {
    titolo: 'Bollo Auto Annuale',
    data: document.getElementById('form-scad-bollo-data').value,
    stato: document.getElementById('form-scad-bollo-stato').value || 'Pagato',
    nota: document.getElementById('form-scad-bollo-nota').value || 'Regione Basilicata / ACI'
  };

  saveAppData();
  chiudiModali();
  showToast('✅ Scadenze documenti aggiornate con successo!');
}
