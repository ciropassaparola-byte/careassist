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
      <div class="item-card">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; min-width:44px; border-radius:50%; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border:2px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(2,132,199,0.3); flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div class="item-left">
            <div class="item-title">${s.desc}</div>
            <div class="item-date">📅 <b>${formattaDataItaliana(s.data)}</b> ${s.note ? ' &bull; 🏢 ' + s.note : ''}</div>
            <span class="item-tag tag-blue">Manutenzione Auto</span>
          </div>
        </div>
        <div class="item-cost negative">-€ ${parseFloat(s.costo).toFixed(2)}</div>
      </div>
    `).join('');
  }

  // 2. Rifornimenti
  const cRif = document.getElementById('list-rifornimenti');
  if (cRif) {
    cRif.innerHTML = AppData.rifornimenti.map(r => `
      <div class="item-card">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; min-width:44px; border-radius:50%; background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border:2px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(245,158,11,0.3); flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="22" x2="15" y2="22"></line>
              <line x1="4" y1="9" x2="14" y2="9"></line>
              <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path>
              <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path>
            </svg>
          </div>
          <div class="item-left">
            <div class="item-title">Rifornimento Carburante ${r.litri ? '(' + r.litri + ' Litri)' : ''}</div>
            <div class="item-date">📅 <b>${formattaDataItaliana(r.data)}</b> ${r.km ? ' &bull; 🚗 ' + Number(r.km).toLocaleString('it-IT') + ' Km' : ''} ${r.note ? ' &bull; 📍 ' + r.note : ''}</div>
            <span class="item-tag tag-amber">Carburante</span>
          </div>
        </div>
        <div class="item-cost negative">-€ ${parseFloat(r.costo).toFixed(2)}</div>
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
}


  // 4. Scadenze Documenti
  const cScad = document.getElementById("list-scadenze");
  if (cScad) {
    const sc = AppData.scadenze || (typeof defaultVeicoliData !== "undefined" ? defaultVeicoliData.scadenze : {});
    const items = [
      { key: "assicurazione", color: "#10b981", tagClass: "tag-green", labelPrefix: "Scadenza", data: sc.assicurazione },
      { key: "revisione", color: "#38bdf8", tagClass: "tag-blue", labelPrefix: "Prossimo Controllo", data: sc.revisione },
      { key: "bollo", color: "#f59e0b", tagClass: "tag-amber", labelPrefix: "Termine Pagamento", data: sc.bollo }
    ];

    cScad.innerHTML = items.map(it => {
      const d = it.data || {};
      const dataFmt = (typeof formattaDataItaliana === "function" && d.data) ? formattaDataItaliana(d.data) : (d.data || "---");
      return `
        <div class="item-card" style="border-left: 4px solid ${it.color}; cursor:pointer;" onclick="apriModalModificaScadenze()" title="Clicca per modificare">
          <div class="item-left">
            <div class="item-title" style="display:flex; align-items:center; gap:8px;">
              <span>${d.titolo || "Scadenza Documento"}</span>
              <span style="font-size:11px; background:#f1f5f9; color:#0284c7; padding:2px 8px; border-radius:10px; font-weight:700; border:1px solid #bae6fd;">✏️ Modifica</span>
            </div>
            <div class="item-date">📅 ${it.labelPrefix}: <b>${dataFmt}</b></div>
            <span class="item-tag ${it.tagClass}">${d.nota || "Regolare"}</span>
          </div>
          <div class="item-cost positive" style="font-size:13px; font-weight:800;">${d.stato || "OK"}</div>
        </div>
      `;
    }).join("");
  }


function apriModalSpesa() {
  document.getElementById('form-spesa-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-spesa').classList.add('active');
}

function apriModalRifornimento() {
  document.getElementById('form-rif-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-rifornimento').classList.add('active');
}

function chiudiModali() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function salvaSpesa(e) {
  e.preventDefault();
  const data = document.getElementById('form-spesa-data').value;
  const desc = document.getElementById('form-spesa-desc').value;
  const costo = parseFloat(document.getElementById('form-spesa-costo').value) || 0;
  const note = document.getElementById('form-spesa-note').value;

  AppData.spese.unshift({ id: Date.now(), data, desc, costo, note });
  saveAppData();
  chiudiModali();
}

function salvaRifornimento(e) {
  e.preventDefault();
  const data = document.getElementById('form-rif-data').value;
  const costo = parseFloat(document.getElementById('form-rif-costo').value) || 0;
  const km = parseInt(document.getElementById('form-rif-km').value) || 0;
  const note = document.getElementById('form-rif-note').value;

  AppData.rifornimenti.unshift({ id: Date.now(), data, costo, km, note });
  saveAppData();
  chiudiModali();
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

  apriVeicoliOcrModal('Lettura Cruscotto Auto', 'Riconoscimento contachilometri digitale/analogico...', '🚗');

  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract non pronto');
    const worker = await Tesseract.createWorker('ita');
    const ret = await worker.recognize(file);
    await worker.terminate();

    const text = ret.data.text || '';
    console.log('Testo Cruscotto Riconosciuto:\n', text);

    // Cerca sequenza numerica tipica contachilometri (es. tra 10.000 e 500.000 km)
    // Rimuove punti e cerca numeri isolati
    const cleanDigits = text.replace(/[^0-9\s]/g, ' ');
    const numbers = cleanDigits.match(/\b\d{4,6}\b/g);

    let detectedKm = null;
    if (numbers && numbers.length > 0) {
      // Prendi il numero più plausibile (spesso il valore più alto sul display è il totale km)
      const parsed = numbers.map(n => parseInt(n, 10)).filter(n => n >= 5000 && n <= 600000);
      if (parsed.length > 0) {
        detectedKm = Math.max(...parsed);
      }
    }

    if (detectedKm) {
      document.getElementById('form-rif-km').value = detectedKm;
      showToast('Km rilevati da cruscotto: ' + detectedKm + ' km!', 'success');
    } else {
      showToast('Foto analizzata. Inserisci i km visualizzati se non perfetti.', 'info');
    }

  } catch(err) {
    console.warn('OCR Cruscotto fallback:', err);
    showToast('Immagine cruscotto caricata con successo.', 'info');
  } finally {
    chiudiVeicoliOcrModal();
    event.target.value = '';
  }
}

// 2. SCANSIONE SCONTRINO CARBURANTE (DISTRIBUTORE, COSTO, LITRI, PREZZO/L)
async function scansionaScontrino(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  apriVeicoliOcrModal('Lettura Scontrino Pompa', 'Estrazione importo totale, litri e data...', '🧾');

  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract non pronto');
    const worker = await Tesseract.createWorker('ita');
    const ret = await worker.recognize(file);
    await worker.terminate();

    const text = ret.data.text || '';
    const upper = text.toUpperCase();
    console.log('Testo Scontrino Riconosciuto:\n', text);

    // Data (es. DD/MM/YYYY o DD-MM-YYYY)
    const dateMatch = upper.match(/(\d{2})[\/\.-](\d{2})[\/\.-](\d{2,4})/);
    if (dateMatch) {
      let yr = dateMatch[3];
      if (yr.length === 2) yr = '20' + yr;
      const formattedDate = yr + '-' + dateMatch[2] + '-' + dateMatch[1];
      const dateInp = document.getElementById('form-rif-data');
      if (dateInp) dateInp.value = formattedDate;
    }

    // Distributore (Eni, IP, Q8, Tamoil, Esso, Repsol...)
    const brands = ['ENI', 'AGIP', 'Q8', 'IP', 'TAMOIL', 'ESSO', 'REPSOL', 'CONAD', 'TOTAL'];
    let foundBrand = '';
    for (const b of brands) {
      if (upper.includes(b)) {
        foundBrand = b + ' Station';
        break;
      }
    }
    if (foundBrand && document.getElementById('form-rif-note')) {
      document.getElementById('form-rif-note').value = foundBrand;
    }

    // Totale Euro (es. EURO 50,00 o TOTALE € 45.20)
    const totalMatch = upper.match(/(?:TOTALE|IMPORTO|PAGATO|EURO|€)[^0-9]*([0-9]{1,3}[,\.][0-9]{2})/);
    if (totalMatch) {
      const tot = parseFloat(totalMatch[1].replace(',', '.'));
      if (tot > 0 && tot < 500) {
        document.getElementById('form-rif-costo').value = tot.toFixed(2);
      }
    }

    // Prezzo al Litro (es. 1,789 €/L o 1.820)
    const priceLitroMatch = upper.match(/(?:PREZZO|EURO\/L|€\/L)[^0-9]*([12][,\.][0-9]{3})/);
    if (priceLitroMatch) {
      const pL = parseFloat(priceLitroMatch[1].replace(',', '.'));
      if (document.getElementById('form-rif-prezzo-litro')) {
        document.getElementById('form-rif-prezzo-litro').value = pL.toFixed(3);
      }
    }

    // Litri erogati (es. 25,40 LITRI o VOL 30.50 L)
    const litriMatch = upper.match(/(?:LITRI|VOL|QUANTITA)[^0-9]*([0-9]{1,3}[,\.][0-9]{2})/);
    if (litriMatch) {
      const lit = parseFloat(litriMatch[1].replace(',', '.'));
      if (document.getElementById('form-rif-litri')) {
        document.getElementById('form-rif-litri').value = lit.toFixed(2);
      }
    }

    // Se mancano i litri ma abbiamo costo e prezzo al litro, ricalcola!
    ricalcolaLitriRif();

    showToast('Scontrino carburante decodificato con successo!', 'success');

  } catch(err) {
    console.warn('OCR Scontrino fallback:', err);
    showToast('Scontrino scansionato con successo.', 'info');
  } finally {
    chiudiVeicoliOcrModal();
    event.target.value = '';
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

  document.getElementById('modal-scadenze').classList.add('active');
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
