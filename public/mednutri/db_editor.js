// =====================================================================
// EDITOR DATABASE PATOLOGIE & FONTI UFFICIALI
// Permette di aggiungere, modificare, eliminare e ripristinare patologie,
// nonché di consultare le fonti mediche ufficiali e le linee guida con link diretti.
// Le modifiche sono salvate nel browser (localStorage).
// =====================================================================

const DB_STORAGE_KEY = 'mednutri_custom_pathologies';
// Copia intatta dei valori originali (per "Ripristina originale")
const pathologyDefaults = JSON.parse(JSON.stringify(pathologyDB));

let currentDbTab = 'pathologies'; // 'pathologies' | 'sources'

// Database delle Fonti Ufficiali e Linee Guida
const officialSources = {
    diagnosi: [
        {
            fonte: "ISSalute",
            ente: "Istituto Superiore di Sanità",
            url: "https://www.issalute.it",
            tag: "Enciclopedia Malattie A-Z",
            desc: "Enciclopedia ufficiale delle malattie dalla A alla Z, in lingua italiana, curata dall'ISS con sezioni dedicate a sintomi, cause e indicazioni alimentari validate."
        },
        {
            fonte: "Manuale MSD",
            ente: "Versione per Professionisti",
            url: "https://www.msdmanuals.com/it-it/professionale",
            tag: "Schede Cliniche & Terapie",
            desc: "Banca dati medica di riferimento mondiale con schede cliniche approfondite, eziologia, criteri diagnostici e protocolli nutrizionali/dietoterapici per ogni patologia."
        },
        {
            fonte: "OMS – ICD-11",
            ente: "Organizzazione Mondiale della Sanità",
            url: "https://icd.who.int",
            tag: "Standard Internazionale OMS",
            desc: "Classificazione statistica internazionale delle malattie e dei problemi sanitari correlati. Standard globale per denominazioni, codici e definizioni cliniche."
        }
    ],
    nutrizione: [
        {
            fonte: "CREA",
            ente: "Centro Ricerca Alimenti e Nutrizione",
            url: "https://www.crea.gov.it",
            tag: "Linee Guida Italiane",
            desc: "Documento ufficiale italiano 'Linee Guida per una sana alimentazione' con tabelle di composizione degli alimenti e porzioni standard raccomandate."
        },
        {
            fonte: "SINU – LARN",
            ente: "Società Italiana di Nutrizione Umana",
            url: "https://sinu.it",
            tag: "Fabbisogni & Nutrienti",
            desc: "Livelli di Assunzione di Riferimento di Nutrienti ed energia per la popolazione italiana (LARN): valori di fabbisogno calorico, macro e micro-nutrienti per età, sesso e condizioni fisiologiche."
        },
        {
            fonte: "Ministero della Salute",
            ente: "Direzione Generale Nutrizione",
            url: "https://www.salute.gov.it",
            tag: "Protocolli Istituzionali",
            desc: "Piani nazionali della prevenzione, opuscoli istituzionali su patologie metaboliche, diabete, ipertensione, celiachia e direttive nutrizionali per la salute pubblica."
        },
        {
            fonte: "AIC – Celiachia",
            ente: "Associazione Italiana Celiachia",
            url: "https://www.celiachia.it",
            tag: "Prontuario Senza Glutine",
            desc: "Guida ufficiale e prontuario degli alimenti permessi, vietati e a rischio per pazienti celiaci o con gluten sensitivity, costantemente revisionato dal comitato scientifico."
        }
    ]
};

function dbEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadCustomDB() {
    try { return JSON.parse(localStorage.getItem(DB_STORAGE_KEY)) || { items: {}, deleted: [] }; }
    catch (e) { return { items: {}, deleted: [] }; }
}
function saveCustomDB(data) { localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(data)); }

// Applica le personalizzazioni salvate al database in memoria
function applyCustomDB() {
    const data = loadCustomDB();
    (data.deleted || []).forEach(k => { delete pathologyDB[k]; });
    Object.keys(data.items || {}).forEach(k => { pathologyDB[k] = data.items[k]; });
}

// Ricostruisce il menu a tendina "Patologia principale"
function refreshPathologySelect() {
    const sel = document.getElementById('patient-pathology');
    if (!sel) return;
    const current = sel.value;
    const keys = Object.keys(pathologyDB).filter(k => k !== 'nessuna' && k !== 'altro')
        .sort((a, b) => pathologyDB[a].name.localeCompare(pathologyDB[b].name));
    let html = '';
    if (pathologyDB['nessuna']) html += `<option value="nessuna">${dbEsc(pathologyDB['nessuna'].name)}</option>`;
    keys.forEach(k => { html += `<option value="${dbEsc(k)}">${dbEsc(pathologyDB[k].name)}${pathologyDB[k].custom ? ' ★' : ''}</option>`; });
    html += `<option value="altro">✏️ Altra Patologia (Personalizzata)</option>`;
    sel.innerHTML = html;
    sel.value = [...sel.options].some(o => o.value === current) ? current : 'nessuna';
}

// Ricostruisce le comorbidità mantenendo le spunte attive
function refreshComorbidities() {
    const checked = [...document.querySelectorAll('.com-checkbox input:checked')].map(c => c.value);
    if (typeof initComorbidities === 'function') initComorbidities();
    document.querySelectorAll('.com-checkbox input').forEach(c => { if (checked.includes(c.value)) c.checked = true; });
}

function refreshAllPathologyUI() {
    refreshPathologySelect();
    refreshComorbidities();
    try { if (typeof updateAnalysis === 'function') updateAnalysis(); } catch (e) { console.warn(e); }
}

// ---------------------------------------------------------------------
// GESTIONE DEI TAB NEL MODALE
// ---------------------------------------------------------------------
function switchDbTab(tab) {
    currentDbTab = tab;
    renderDbTabs();
    if (tab === 'sources') {
        renderDatabaseSources();
    } else {
        renderDatabaseList();
    }
}

function renderDbTabs() {
    const modal = document.getElementById('database-modal');
    if (!modal) return;
    
    // Controlla se il contenitore dei tab esiste, altrimenti lo inietta prima della toolbar
    let tabContainer = document.getElementById('database-tabs-container');
    if (!tabContainer) {
        const modalBody = modal.querySelector('div');
        const toolbar = document.getElementById('database-toolbar');
        tabContainer = document.createElement('div');
        tabContainer.id = 'database-tabs-container';
        tabContainer.style.cssText = 'display:flex; gap:8px; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:10px;';
        if (toolbar && modalBody) {
            modalBody.insertBefore(tabContainer, toolbar);
        }
    }

    const totalPat = Object.keys(pathologyDB).filter(k => k !== 'altro').length;
    const isPat = currentDbTab === 'pathologies';

    tabContainer.innerHTML = `
        <button type="button" onclick="switchDbTab('pathologies')" style="${tabStyle(isPat)}">
            <span>📋</span> Patologie Registrate <span style="${badgeStyle(isPat)}">${totalPat}</span>
        </button>
        <button type="button" onclick="switchDbTab('sources')" style="${tabStyle(!isPat)}">
            <span>🌐</span> Fonti Ufficiali & Link Utili <span style="${badgeStyle(!isPat, '#0ea5e9', '#e0f2fe')}">7 Fonti</span>
        </button>
    `;
}

function tabStyle(active) {
    if (active) {
        return 'background:#0ea5e9; color:white; border:none; padding:8px 16px; border-radius:10px; font-weight:600; font-size:0.92rem; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 2px 8px rgba(14,165,233,0.3); font-family:inherit; transition:all 0.2s;';
    }
    return 'background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; padding:8px 16px; border-radius:10px; font-weight:500; font-size:0.92rem; cursor:pointer; display:flex; align-items:center; gap:8px; font-family:inherit; transition:all 0.2s;';
}

function badgeStyle(active, bgActive = 'rgba(255,255,255,0.25)', bgInactive = '#cbd5e1') {
    if (active) {
        return `background:${bgActive}; color:white; font-size:0.75rem; padding:2px 7px; border-radius:12px; font-weight:700;`;
    }
    return `background:${bgInactive}; color:#334155; font-size:0.75rem; padding:2px 7px; border-radius:12px; font-weight:600;`;
}

// ---------------------------------------------------------------------
// VISUALIZZAZIONE LISTA PATOLOGIE
// ---------------------------------------------------------------------
function showDatabase(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const modal = document.getElementById('database-modal');
    if (!modal) return false;
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    
    renderDbTabs();
    if (currentDbTab === 'sources') {
        renderDatabaseSources();
    } else {
        renderDatabaseList();
    }
    
    modal.style.zIndex = '100000';
    modal.style.display = 'flex';
    return false;
}

function renderDatabaseList(filter) {
    const list = document.getElementById('database-list');
    const toolbar = document.getElementById('database-toolbar');
    if (!list) return;
    const data = loadCustomDB();
    const q = (filter != null ? filter : (document.getElementById('db-search') || {}).value || '').toLowerCase().trim();

    if (toolbar) {
        toolbar.style.display = 'flex';
        toolbar.style.flexWrap = 'wrap';
        toolbar.style.gap = '8px';
        toolbar.innerHTML = `
            <input id="db-search" type="text" placeholder="🔍 Cerca patologia o alimento..." value="${dbEsc(q)}" oninput="renderDatabaseList(this.value)"
                style="flex:1; min-width:200px; padding:10px 14px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; font-size:0.95rem;">
            <button id="db-add-btn" class="btn-primary" onclick="openPathologyEditor()" style="padding:10px 16px; font-size:0.9rem; white-space:nowrap;">➕ Nuova Patologia</button>
            <button type="button" class="btn-secondary" onclick="exportDatabaseBackup()" title="Scarica un file di backup sul tuo computer" style="padding:10px 14px; font-size:0.85rem; display:flex; align-items:center; gap:5px;">
                <span>📥</span> Esporta Backup
            </button>
            <button type="button" class="btn-secondary" onclick="triggerImportDatabase()" title="Carica un file di backup precedente" style="padding:10px 14px; font-size:0.85rem; display:flex; align-items:center; gap:5px;">
                <span>📤</span> Importa Backup
            </button>
            <input type="file" id="db-import-file" accept=".json" style="display:none;" onchange="handleImportDatabaseFile(event)">
        `;
    }

    const keys = Object.keys(pathologyDB).filter(k => k !== 'altro').sort((a, b) => {
        if (a === 'nessuna') return -1; if (b === 'nessuna') return 1;
        return pathologyDB[a].name.localeCompare(pathologyDB[b].name);
    });

    list.innerHTML = '';
    let shown = 0;
    keys.forEach(key => {
        const pat = pathologyDB[key];
        const hay = [pat.name, pat.desc, pat.goldenRule, ...(pat.avoid || []), ...(pat.promote || [])].join(' ').toLowerCase();
        if (q && !hay.includes(q)) return;
        shown++;

        const isCustom = !!pat.custom;
        const isModified = !isCustom && data.items && data.items[key];
        const badge = isCustom
            ? '<span style="background:#ede9fe; color:#7c3aed; font-size:0.7rem; padding:2px 8px; border-radius:20px; margin-left:8px;">★ Personalizzata</span>'
            : (isModified ? '<span style="background:#fef3c7; color:#b45309; font-size:0.7rem; padding:2px 8px; border-radius:20px; margin-left:8px;">✏️ Modificata</span>' : '');

        const avoidHtml = (pat.avoid || []).map(i => `<li>❌ ${dbEsc(i)}</li>`).join('');
        const promoteHtml = (pat.promote || []).map(i => `<li>✅ ${dbEsc(i)}</li>`).join('');

        let actions = `<button onclick="openPathologyEditor('${key}')" style="${dbBtn('#e0f2fe', '#0369a1')}">✏️ Modifica</button>`;
        if (isModified) actions += `<button onclick="restorePathology('${key}')" style="${dbBtn('#fef3c7', '#b45309')}">↺ Ripristina</button>`;
        if (key !== 'nessuna') actions += `<button onclick="deletePathology('${key}')" style="${dbBtn('#fee2e2', '#b91c1c')}">🗑️ Elimina</button>`;

        const div = document.createElement('div');
        div.style.cssText = 'padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:5px;">
                <h3 style="color:#0f172a; font-size:1.1rem;">${dbEsc(pat.name || key)}${badge}</h3>
                <div style="display:flex; gap:6px; flex-shrink:0;">${actions}</div>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:10px;">${dbEsc(pat.desc)}</p>
            ${pat.goldenRule ? `<p style="font-size:0.9rem; margin-bottom:10px; background:#e0f2fe; padding:8px; border-radius:6px; color:#0284c7;"><strong>⭐ Golden Rule:</strong> ${dbEsc(pat.goldenRule)}</p>` : ''}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <div><strong style="font-size:0.85rem; color:#ef4444;">Da Evitare:</strong>
                    <ul style="list-style:none; padding:0; margin-top:5px; font-size:0.8rem; display:flex; flex-direction:column; gap:3px;">${avoidHtml}</ul></div>
                <div><strong style="font-size:0.85rem; color:#10b981;">Da Promuovere:</strong>
                    <ul style="list-style:none; padding:0; margin-top:5px; font-size:0.8rem; display:flex; flex-direction:column; gap:3px;">${promoteHtml}</ul></div>
            </div>`;
        list.appendChild(div);
    });

    if (!shown) list.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">Nessuna patologia trovata.</p>';

    if ((data.deleted || []).length) {
        const r = document.createElement('div');
        r.style.cssText = 'text-align:center; padding:10px;';
        r.innerHTML = `<button onclick="restoreDeletedPathologies()" style="${dbBtn('#f1f5f9', '#475569')}">↺ Ripristina patologie eliminate (${data.deleted.length})</button>`;
        list.appendChild(r);
    }
}

// ---------------------------------------------------------------------
// VISUALIZZAZIONE TABELLARE DELLE FONTI UFFICIALI E LINK UTILI
// ---------------------------------------------------------------------
function renderDatabaseSources() {
    const list = document.getElementById('database-list');
    const toolbar = document.getElementById('database-toolbar');
    if (!list) return;

    if (toolbar) {
        toolbar.style.display = 'flex';
        toolbar.innerHTML = `
            <div style="flex:1; background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:10px 14px; font-size:0.88rem; color:#0369a1; display:flex; align-items:center; gap:8px;">
                <span>💡</span> <span>Usa queste fonti mediche ufficiali per ricercare patologie o indicazioni alimentari validate, poi inseriscile nel sistema con il tasto a fianco.</span>
            </div>
            <button class="btn-primary" onclick="openPathologyEditor()" style="padding:10px 18px; font-size:0.95rem; white-space:nowrap;">➕ Nuova Patologia</button>
        `;
    }

    function createTableRows(items) {
        return items.map(item => `
            <tr style="border-bottom:1px solid #e2e8f0; transition:background 0.2s;">
                <td style="padding:12px 14px; vertical-align:top; font-size:0.92rem;">
                    <strong style="color:#0f172a; display:block; font-size:0.95rem;">${dbEsc(item.fonte)}</strong>
                    <span style="font-size:0.8rem; color:#64748b;">${dbEsc(item.ente)}</span>
                    <span style="display:inline-block; margin-top:4px; font-size:0.72rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:6px;">${dbEsc(item.tag)}</span>
                </td>
                <td style="padding:12px 14px; vertical-align:top; white-space:nowrap;">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                        style="display:inline-flex; align-items:center; gap:6px; background:#0284c7; color:white; padding:6px 12px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.82rem; box-shadow:0 2px 4px rgba(2,132,199,0.25);">
                        <span>Visita Sito</span> <span>↗</span>
                    </a>
                    <button type="button" onclick="copySourceUrl('${item.url}')" title="Copia indirizzo web"
                        style="display:block; margin-top:6px; background:none; border:none; color:#64748b; font-size:0.75rem; cursor:pointer; text-decoration:underline; padding:0;">
                        📋 Copia link
                    </button>
                </td>
                <td style="padding:12px 14px; vertical-align:top; font-size:0.88rem; color:#334155; line-height:1.45;">
                    ${dbEsc(item.desc)}
                </td>
            </tr>
        `).join('');
    }

    list.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px; padding:2px;">
            <!-- Sezione 1: Diagnosi & Elenchi Patologie -->
            <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                <div style="background:linear-gradient(135deg, #f8fafc, #eff6ff); padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:1.05rem; color:#1e293b; display:flex; align-items:center; gap:8px; margin:0;">
                        <span>📋</span> Elenchi delle Patologie (Nomi, Codici e Diagnosi)
                    </h3>
                    <span style="font-size:0.75rem; background:#dbeafe; color:#1d4ed8; padding:3px 8px; border-radius:12px; font-weight:600;">3 Banche Dati</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:0.82rem; text-transform:uppercase;">
                            <th style="padding:10px 14px; width:28%;">Fonte Ufficiale</th>
                            <th style="padding:10px 14px; width:20%;">Link Diretto</th>
                            <th style="padding:10px 14px;">Cosa Trovi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${createTableRows(officialSources.diagnosi)}
                    </tbody>
                </table>
            </div>

            <!-- Sezione 2: Linee Guida Nutrizionali -->
            <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                <div style="background:linear-gradient(135deg, #f8fafc, #f0fdf4); padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:1.05rem; color:#1e293b; display:flex; align-items:center; gap:8px; margin:0;">
                        <span>🥗</span> Linee Guida su Cosa Mangiare (Nutrizione & Prevenzione)
                    </h3>
                    <span style="font-size:0.75rem; background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:12px; font-weight:600;">4 Fonti Ufficiali</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-size:0.82rem; text-transform:uppercase;">
                            <th style="padding:10px 14px; width:28%;">Fonte Ufficiale</th>
                            <th style="padding:10px 14px; width:20%;">Link Diretto</th>
                            <th style="padding:10px 14px;">Cosa Trovi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${createTableRows(officialSources.nutrizione)}
                    </tbody>
                </table>
            </div>

            <!-- Box informativo operatività -->
            <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:15px; display:flex; justify-content:space-between; align-items:center; gap:15px;">
                <div>
                    <strong style="color:#0f172a; font-size:0.95rem; display:block;">Vuoi inserire una nuova patologia trovata su queste fonti?</strong>
                    <span style="color:#64748b; font-size:0.85rem;">Compila la scheda indicando cibi da evitare, cibi da promuovere e la Golden Rule. Il piano terapeutico la integrerà all'istante!</span>
                </div>
                <button class="btn-primary" onclick="openPathologyEditor()" style="padding:10px 18px; font-size:0.9rem; white-space:nowrap;">➕ Aggiungi al Database</button>
            </div>
        </div>
    `;
    list.scrollTop = 0;
}

function copySourceUrl(url) {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            notifyDB('Indirizzo copiato negli appunti: ' + url, 'success');
        }).catch(() => {
            prompt('Copia il link:', url);
        });
    } else {
        prompt('Copia il link:', url);
    }
}

function dbBtn(bg, color) {
    return `background:${bg}; color:${color}; border:none; padding:6px 10px; border-radius:8px; font-size:0.8rem; font-weight:600; cursor:pointer; font-family:inherit;`;
}

// ---------------------------------------------------------------------
// EDITOR (Nuova / Modifica)
// ---------------------------------------------------------------------
function openPathologyEditor(key) {
    const list = document.getElementById('database-list');
    const toolbar = document.getElementById('database-toolbar');
    const tabs = document.getElementById('database-tabs-container');
    if (toolbar) toolbar.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    
    const pat = key ? pathologyDB[key] : { name: '', desc: '', goldenRule: '', avoid: [], promote: [] };
    const field = 'width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit; font-size:0.95rem;';
    const lbl = 'display:block; font-size:0.85rem; font-weight:600; color:#475569; margin-bottom:5px;';

    list.innerHTML = `
        <div style="padding:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="font-size:1.15rem; color:#0f172a; margin:0;">${key ? '✏️ Modifica: ' + dbEsc(pat.name) : '➕ Nuova Patologia'}</h3>
                <button type="button" onclick="closeEditorToTab('sources')" style="${dbBtn('#f0f9ff', '#0284c7')}">🌐 Consulta Fonti Mediche</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:14px;">
                <div><label style="${lbl}">Nome patologia *</label>
                    <input id="ed-name" type="text" value="${dbEsc(pat.name)}" placeholder="Es. Anemia Sideropenica" style="${field}"></div>
                <div><label style="${lbl}">Descrizione / Obiettivo clinico</label>
                    <input id="ed-desc" type="text" value="${dbEsc(pat.desc)}" placeholder="Es. Aumento dell'apporto di ferro biodisponibile." style="${field}"></div>
                <div><label style="${lbl}">⭐ Golden Rule (regola d'oro)</label>
                    <textarea id="ed-rule" rows="2" placeholder="Es. Abbina sempre vitamina C ai cibi ricchi di ferro." style="${field} resize:vertical;">${dbEsc(pat.goldenRule)}</textarea></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div><label style="${lbl} color:#ef4444;">❌ Da Evitare <span style="font-weight:400; color:#94a3b8;">(uno per riga)</span></label>
                        <textarea id="ed-avoid" rows="9" style="${field} resize:vertical;">${dbEsc((pat.avoid || []).join('\n'))}</textarea></div>
                    <div><label style="${lbl} color:#10b981;">✅ Da Promuovere <span style="font-weight:400; color:#94a3b8;">(uno per riga)</span></label>
                        <textarea id="ed-promote" rows="9" style="${field} resize:vertical;">${dbEsc((pat.promote || []).join('\n'))}</textarea></div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:5px;">
                    <button id="ed-cancel" class="btn-secondary" onclick="closeEditorToTab('pathologies')">Annulla</button>
                    <button id="ed-save" class="btn-primary" onclick="savePathology(${key ? `'${key}'` : 'null'})">💾 Salva</button>
                </div>
            </div>
        </div>`;
    list.scrollTop = 0;
    setTimeout(() => document.getElementById('ed-name').focus(), 50);
}

function closeEditorToTab(targetTab = 'pathologies') {
    const tabs = document.getElementById('database-tabs-container');
    if (tabs) tabs.style.display = 'flex';
    switchDbTab(targetTab);
}

function savePathology(key) {
    const name = document.getElementById('ed-name').value.trim();
    if (!name) {
        document.getElementById('ed-name').classList.add('input-error');
        notifyDB('Inserisci il nome della patologia.', 'error');
        return;
    }
    const toList = id => document.getElementById(id).value.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
    const isNew = !key;

    if (isNew) {
        const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'patologia';
        key = 'custom_' + base;
        let n = 2;
        while (pathologyDB[key]) key = 'custom_' + base + '_' + (n++);
    }

    const entry = {
        name,
        desc: document.getElementById('ed-desc').value.trim(),
        goldenRule: document.getElementById('ed-rule').value.trim(),
        avoid: toList('ed-avoid'),
        promote: toList('ed-promote')
    };
    if (isNew || (pathologyDB[key] && pathologyDB[key].custom)) entry.custom = true;

    const data = loadCustomDB();
    data.items = data.items || {};
    data.items[key] = entry;
    data.deleted = (data.deleted || []).filter(k => k !== key);
    saveCustomDB(data);
    pathologyDB[key] = entry;

    refreshAllPathologyUI();
    closeEditorToTab('pathologies');
    notifyDB(isNew ? `Patologia "${name}" aggiunta al database.` : `Patologia "${name}" aggiornata.`, 'success');
}

function restorePathology(key) {
    if (!pathologyDefaults[key]) return;
    const data = loadCustomDB();
    delete data.items[key];
    saveCustomDB(data);
    pathologyDB[key] = JSON.parse(JSON.stringify(pathologyDefaults[key]));
    refreshAllPathologyUI();
    renderDatabaseList();
    notifyDB(`"${pathologyDB[key].name}" ripristinata ai valori originali.`, 'success');
}

function deletePathology(key) {
    const pat = pathologyDB[key];
    if (!pat) return;
    const doDelete = () => {
        const data = loadCustomDB();
        delete data.items[key];
        if (pathologyDefaults[key] && !(data.deleted || []).includes(key)) (data.deleted = data.deleted || []).push(key);
        saveCustomDB(data);
        delete pathologyDB[key];
        refreshAllPathologyUI();
        renderDatabaseList();
        notifyDB(`"${pat.name}" eliminata dal database.`, 'success');
    };

    const confirmBox = document.getElementById('custom-confirm');
    if (!confirmBox) { if (confirm(`Eliminare "${pat.name}"?`)) doDelete(); return; }
    if (confirmBox.parentElement !== document.body) document.body.appendChild(confirmBox);
    document.getElementById('custom-confirm-message').innerHTML =
        `Vuoi eliminare <strong>${dbEsc(pat.name)}</strong> dal Database Patologie?` +
        (pathologyDefaults[key] ? '<br><span style="font-size:0.8rem; color:#94a3b8; display:block; margin-top:5px;">Potrai recuperarla con "Ripristina patologie eliminate".</span>' : '');
    confirmBox.style.zIndex = '100001';
    confirmBox.style.display = 'flex';
    document.getElementById('custom-confirm-cancel').onclick = () => { confirmBox.style.display = 'none'; };
    document.getElementById('custom-confirm-ok').onclick = () => { confirmBox.style.display = 'none'; doDelete(); };
}

// Recupera le patologie predefinite eliminate per errore
function restoreDeletedPathologies() {
    const data = loadCustomDB();
    (data.deleted || []).forEach(k => { if (pathologyDefaults[k]) pathologyDB[k] = JSON.parse(JSON.stringify(pathologyDefaults[k])); });
    data.deleted = [];
    saveCustomDB(data);
    refreshAllPathologyUI();
    renderDatabaseList();
    notifyDB('Patologie predefinite ripristinate.', 'success');
}

function notifyDB(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
    else alert(msg);
}

// ---------------------------------------------------------------------
// BACKUP: ESPORTAZIONE & IMPORTAZIONE JSON
// ---------------------------------------------------------------------
function exportDatabaseBackup() {
    try {
        const customData = loadCustomDB();
        const exportPayload = {
            appName: "MedNutri Pro",
            version: "2.0",
            exportDate: new Date().toISOString(),
            customItems: customData.items || {},
            deletedDefaults: customData.deleted || [],
            allActivePathologies: pathologyDB
        };

        const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
        const downloadAnchor = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", jsonString);
        downloadAnchor.setAttribute("download", `Backup_Patologie_MedNutri_Pro_${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        notifyDB("Backup esportato con successo! File scaricato.", "success");
    } catch (err) {
        console.error(err);
        notifyDB("Errore durante l'esportazione del backup: " + err.message, "error");
    }
}

function triggerImportDatabase() {
    const fileInput = document.getElementById('db-import-file');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

function handleImportDatabaseFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported || (!imported.customItems && !imported.allActivePathologies)) {
                throw new Error("Formato del file di backup non valido.");
            }

            // Unisci con i dati locali
            const currentData = loadCustomDB();
            currentData.items = currentData.items || {};
            
            let count = 0;
            // Se presente customItems, importali
            if (imported.customItems) {
                Object.keys(imported.customItems).forEach(key => {
                    currentData.items[key] = imported.customItems[key];
                    pathologyDB[key] = imported.customItems[key];
                    count++;
                });
            } else if (imported.allActivePathologies) {
                Object.keys(imported.allActivePathologies).forEach(key => {
                    if (key !== 'nessuna' && key !== 'altro') {
                        currentData.items[key] = imported.allActivePathologies[key];
                        pathologyDB[key] = imported.allActivePathologies[key];
                        count++;
                    }
                });
            }

            if (Array.isArray(imported.deletedDefaults)) {
                currentData.deleted = Array.from(new Set([...(currentData.deleted || []), ...imported.deletedDefaults]));
            }

            saveCustomDB(currentData);
            applyCustomDB();
            refreshAllPathologyUI();
            renderDbTabs();
            renderDatabaseList();

            notifyDB(`Backup ripristinato! ${count} patologie caricate/aggiornate.`, "success");
        } catch (err) {
            console.error(err);
            notifyDB("Impossibile importare il file: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

// Avvio: applica le personalizzazioni prima che app.js costruisca l'interfaccia
applyCustomDB();
window.addEventListener('DOMContentLoaded', () => {
    refreshPathologySelect();
});

