const API_BASE = '/api';
let inventario = [];
let posizioni = [];
let serverIp = 'localhost';
let lastInventoryHash = '';

const form = document.getElementById('addForm');
const formTitle = document.getElementById('formTitle');
const editItemIdInput = document.getElementById('editItemId');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const searchInput = document.getElementById('ricerca');
const grid = document.getElementById('listaAttrezzi');
const shutdownBtn = document.getElementById('shutdownBtn');
const toastEl = document.getElementById('toast');

// Filters and Export
const filterCategoria = document.getElementById('filterCategoria');
const filterStato = document.getElementById('filterStato');
const btnExportCSV = document.getElementById('btnExportCSV');

// Chart Instances (Deprecated)
let chartCat = null;
let chartStato = null;

// History Log
let cronologia = JSON.parse(localStorage.getItem('inventario_cronologia') || '[]');
const btnCronologia = document.getElementById('btnCronologia');
const historyModal = document.getElementById('historyModal');
const btnCloseHistoryModal = document.getElementById('btnCloseHistoryModal');
const historyList = document.getElementById('historyList');

// Scanner
const btnScanQR = document.getElementById('btnScanQR');
const scannerModal = document.getElementById('scannerModal');
const btnCloseScanner = document.getElementById('btnCloseScanner');
let html5QrcodeScanner = null;

// Location Management elements
const attrezzoPosizioneSelect = document.getElementById('attrezzoPosizione');
const btnManageLocations = document.getElementById('btnManageLocations');
const locationModal = document.getElementById('locationModal');
const btnCloseLocationModal = document.getElementById('btnCloseLocationModal');
const newLocationInput = document.getElementById('newLocationInput');
const btnAddLocation = document.getElementById('btnAddLocation');
const locationsList = document.getElementById('locationsList');

// Utils: Show Toast
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// Custom Confirm Modal
function customConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const titleEl = document.getElementById('modalTitle');
        const msgEl = document.getElementById('modalMessage');
        const btnConfirm = document.getElementById('modalBtnConfirm');
        const btnCancel = document.getElementById('modalBtnCancel');

        titleEl.textContent = title;
        msgEl.textContent = message;

        const cleanup = () => {
            modal.classList.remove('show');
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
        };

        const onConfirm = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);

        modal.classList.add('show');
    });
}

// Gestione Fotocamera e Galleria Foto
const fileInputCam = document.getElementById('attrezzoFotoCam');
const fileInputGallery = document.getElementById('attrezzoFotoGallery');
const btnTriggerCam = document.getElementById('btnTriggerCam');
const btnTriggerGallery = document.getElementById('btnTriggerGallery');
const photoPreviewContainer = document.getElementById('photoPreviewContainer');
const photoPreviewImg = document.getElementById('photoPreviewImg');
const fileNameDisplay = document.getElementById('fileName');
const removePhotoBtn = document.getElementById('removePhotoBtn');

let currentSelectedFile = null;

function handleFileSelection(file) {
    if (!file) return;
    currentSelectedFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    
    // Mostra anteprima immediata
    const reader = new FileReader();
    reader.onload = function(e) {
        if (photoPreviewImg) photoPreviewImg.src = e.target.result;
        if (photoPreviewContainer) photoPreviewContainer.style.display = 'block';
        if (removePhotoBtn) removePhotoBtn.style.display = 'inline';
    };
    reader.readAsDataURL(file);
}

if (btnTriggerCam && fileInputCam) {
    btnTriggerCam.addEventListener('click', (e) => {
        e.preventDefault();
        fileInputCam.click();
    });
    fileInputCam.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
}

// Modale Galleria Catalogo Foto
const catalogGalleryModal = document.getElementById('catalogGalleryModal');
const catalogGalleryGrid = document.getElementById('catalogGalleryGrid');
const btnCloseCatalogGallery = document.getElementById('btnCloseCatalogGallery');
let selectedCatalogPhotoPath = null;

async function openCatalogGallery() {
    if (!catalogGalleryModal || !catalogGalleryGrid) return;
    catalogGalleryGrid.innerHTML = '<div style="color:var(--text-muted); padding:20px; grid-column: 1/-1; text-align:center;">Caricamento foto in corso...</div>';
    catalogGalleryModal.classList.add('show');
    
    try {
        const res = await fetch(`${API_BASE}/available-photos`);
        const photos = await res.json();
        
        if (!photos || photos.length === 0) {
            catalogGalleryGrid.innerHTML = '<div style="color:var(--text-muted); padding:20px; grid-column: 1/-1; text-align:center;">Nessuna foto trovata nel catalogo.</div>';
            return;
        }

        catalogGalleryGrid.innerHTML = '';
        photos.forEach(p => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'position:relative; cursor:pointer; border:2px solid rgba(255,255,255,0.1); border-radius:8px; overflow:hidden; aspect-ratio:1; background:#000; transition:all 0.2s;';
            itemDiv.innerHTML = `
                <img src="/${p.path}" style="width:100%; height:100%; object-fit:cover;">
                <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); font-size:10px; color:#f8fafc; padding:2px 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${p.filename}
                </div>
            `;
            itemDiv.onmouseover = () => { itemDiv.style.borderColor = 'var(--gold-primary)'; itemDiv.style.transform = 'scale(1.05)'; };
            itemDiv.onmouseout = () => { itemDiv.style.borderColor = 'rgba(255,255,255,0.1)'; itemDiv.style.transform = 'scale(1)'; };
            
            itemDiv.onclick = () => {
                // Seleziona questa foto
                selectedCatalogPhotoPath = p.path;
                currentSelectedFile = null; // È già sul server
                if (photoPreviewImg) photoPreviewImg.src = '/' + p.path;
                if (fileNameDisplay) fileNameDisplay.textContent = 'Foto scelta: ' + p.filename;
                if (photoPreviewContainer) photoPreviewContainer.style.display = 'block';
                if (removePhotoBtn) removePhotoBtn.style.display = 'inline';
                catalogGalleryModal.classList.remove('show');
                showToast('Foto associata con successo!');
            };
            catalogGalleryGrid.appendChild(itemDiv);
        });
    } catch(err) {
        catalogGalleryGrid.innerHTML = '<div style="color:#ef4444; padding:20px; grid-column: 1/-1; text-align:center;">Errore caricamento galleria.</div>';
    }
}

if (btnCloseCatalogGallery && catalogGalleryModal) {
    btnCloseCatalogGallery.addEventListener('click', () => catalogGalleryModal.classList.remove('show'));
    catalogGalleryModal.addEventListener('click', (e) => {
        if (e.target === catalogGalleryModal) catalogGalleryModal.classList.remove('show');
    });
}

if (btnTriggerGallery) {
    btnTriggerGallery.addEventListener('click', (e) => {
        e.preventDefault();
        // Sul PC o Cloud apri la comoda galleria a schermo con tutte le foto salvate
        openCatalogGallery();
    });
}

if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
        currentSelectedFile = null;
        selectedCatalogPhotoPath = null;
        if (fileInputCam) fileInputCam.value = '';
        if (fileInputGallery) fileInputGallery.value = '';
        if (photoPreviewContainer) photoPreviewContainer.style.display = 'none';
        if (photoPreviewImg) photoPreviewImg.src = '';
        if (fileNameDisplay) fileNameDisplay.textContent = '';
        removePhotoBtn.style.display = 'none';
    });
}

// Init
async function init() {
    try {
        const resIp = await fetch(`${API_BASE}/my-ip`);
        const dataIp = await resIp.json();
        serverIp = dataIp.ip;
    } catch(e) { console.warn('Could not fetch server IP', e); }

    await syncPendingData(); // Tenta prima di inviare eventuali dati in sospeso
    await fetchLocations();
    await fetchInventory();
    renderLocationsSelect();
    
    setupQRLabelsPrint();
    
    // Controlla se c'è una query string (es. da scansione QR code)
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        searchInput.value = searchQuery;
        renderGrid(searchQuery);
    } else {
        renderGrid();
    }
}

async function fetchInventory() {
    try {
        const res = await fetch(`${API_BASE}/inventory`);
        const rawText = await res.text();
        lastInventoryHash = rawText;
        inventario = JSON.parse(rawText);
        // Sort newest first
        inventario.sort((a, b) => b.id - a.id);
        localStorage.setItem('inventario_cache', JSON.stringify(inventario));
    } catch (e) {
        showToast('Sei offline. Caricamento dalla cache locale.');
        const cache = localStorage.getItem('inventario_cache');
        if (cache) {
            inventario = JSON.parse(cache);
        } else {
            inventario = [];
        }
    }
}

async function fetchLocations() {
    try {
        const res = await fetch(`${API_BASE}/locations`);
        posizioni = await res.json();
        localStorage.setItem('posizioni_cache', JSON.stringify(posizioni));
    } catch (e) {
        const cache = localStorage.getItem('posizioni_cache');
        if (cache) {
            posizioni = JSON.parse(cache);
        } else {
            posizioni = ["Garage", "Casa", "Furgone"]; // fallback
        }
    }
}

async function saveLocations() {
    localStorage.setItem('posizioni_cache', JSON.stringify(posizioni));
    try {
        await fetch(`${API_BASE}/locations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(posizioni)
        });
    } catch (e) {
        showToast('Sei offline. Posizioni salvate localmente.');
        localStorage.setItem('posizioni_sync_pending', 'true');
    }
}

function renderLocationsSelect() {
    const currentVal = attrezzoPosizioneSelect.value;
    attrezzoPosizioneSelect.innerHTML = '';
    posizioni.forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos;
        opt.textContent = pos;
        attrezzoPosizioneSelect.appendChild(opt);
    });
    // Ripristina il valore selezionato se esiste ancora
    if (posizioni.includes(currentVal)) {
        attrezzoPosizioneSelect.value = currentVal;
    } else if (posizioni.length > 0) {
        attrezzoPosizioneSelect.value = posizioni[0];
    }
}

function renderLocationsList() {
    locationsList.innerHTML = '';
    if (posizioni.length === 0) {
        locationsList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:10px;">Nessuna posizione.</div>';
        return;
    }
    posizioni.forEach(pos => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 12px';
        row.style.background = 'rgba(255,255,255,0.05)';
        row.style.borderRadius = '6px';
        row.style.color = '#f8fafc';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = pos;
        row.appendChild(nameSpan);
        
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '✖';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = '#ef4444';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = async () => {
            // Controlla se la posizione è in uso
            const inUso = inventario.some(item => item.posizione === pos);
            if (inUso) {
                showToast('Impossibile eliminare: posizione in uso da alcuni attrezzi.');
                return;
            }
            posizioni = posizioni.filter(p => p !== pos);
            await saveLocations();
            renderLocationsList();
            renderLocationsSelect();
        };
        
        row.appendChild(delBtn);
        locationsList.appendChild(row);
    });
}

// Event Listeners for Location Modal
btnManageLocations.addEventListener('click', () => {
    renderLocationsList();
    locationModal.classList.add('show');
});

btnCloseLocationModal.addEventListener('click', () => {
    locationModal.classList.remove('show');
});

btnAddLocation.addEventListener('click', async () => {
    const newVal = newLocationInput.value.trim();
    if (!newVal) return;
    if (posizioni.includes(newVal)) {
        showToast('Posizione già esistente');
        return;
    }
    posizioni.push(newVal);
    await saveLocations();
    newLocationInput.value = '';
    renderLocationsList();
    renderLocationsSelect();
    showToast('Posizione aggiunta!');
});

async function saveInventory() {
    localStorage.setItem('inventario_cache', JSON.stringify(inventario));
    try {
        await fetch(`${API_BASE}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inventario)
        });
    } catch (e) {
        showToast('Sei offline. Modifiche salvate localmente.');
        localStorage.setItem('inventario_sync_pending', 'true');
    }
}

// Add/Edit Item
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const editId = editItemIdInput.value;
    const nome = document.getElementById('attrezzoNome').value.trim();
    const posizione = document.getElementById('attrezzoPosizione').value;
    const quantita = document.getElementById('attrezzoQuantita').value;
    const categoria = document.getElementById('attrezzoCategoria').value;
    const stato = document.getElementById('attrezzoStato').value;
    const prestatoA = document.getElementById('attrezzoPrestatoA').value.trim();
    const note = document.getElementById('attrezzoNote').value.trim();
    const file = currentSelectedFile;
    
    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Salvataggio...';
    btn.disabled = true;

    let photoPath = selectedCatalogPhotoPath || null;

    if (file) {
        if (!navigator.onLine) {
            showToast('Errore: impossibile caricare foto mentre sei offline.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }
        const formData = new FormData();
        formData.append('foto', file);
        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            photoPath = data.path;
        } catch (e) {
            showToast('Errore upload foto');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }
    }

    if (editId) {
        // Edit Existing Item
        const itemIndex = inventario.findIndex(item => item.id == editId);
        if (itemIndex > -1) {
            inventario[itemIndex] = {
                ...inventario[itemIndex],
                nome, posizione, quantita, categoria, stato, prestato_a: prestatoA, note,
                foto: photoPath || inventario[itemIndex].foto // keep old photo if no new one
            };
        }
        showToast('Attrezzo aggiornato!');
        logHistory('Modificato', nome + (prestatoA ? ` (Prestato a: ${prestatoA})` : ''));
    } else {
        // Add New Item
        const newItem = {
            id: Date.now(),
            nome,
            posizione,
            quantita,
            categoria,
            stato,
            prestato_a: prestatoA,
            note,
            foto: photoPath
        };
        inventario.unshift(newItem);
        showToast('Attrezzo salvato!');
        logHistory('Aggiunto', nome);
    }

    await saveInventory();
    
    // Reset Form
    resetFormState();
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    
    renderGrid();
});

function resetFormState() {
    form.reset();
    editItemIdInput.value = '';
    formTitle.textContent = 'Nuovo Attrezzo';
    document.getElementById('saveBtn').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> SALVA';
    cancelEditBtn.style.display = 'none';
    currentSelectedFile = null;
    selectedCatalogPhotoPath = null;
    if (fileInputCam) fileInputCam.value = '';
    if (fileInputGallery) fileInputGallery.value = '';
    if (photoPreviewContainer) photoPreviewContainer.style.display = 'none';
    if (photoPreviewImg) photoPreviewImg.src = '';
    if (fileNameDisplay) fileNameDisplay.textContent = '';
    if (removePhotoBtn) removePhotoBtn.style.display = 'none';
    document.getElementById('prestitoGroup').style.display = 'none';
}

cancelEditBtn.addEventListener('click', resetFormState);

// Edit Item Population
function editItem(id) {
    const item = inventario.find(i => i.id == id);
    if (!item) return;

    editItemIdInput.value = item.id;
    formTitle.textContent = 'Modifica Attrezzo';
    document.getElementById('saveBtn').innerHTML = 'AGGIORNA';
    cancelEditBtn.style.display = 'block';

    document.getElementById('attrezzoNome').value = item.nome;
    document.getElementById('attrezzoPosizione').value = item.posizione;
    document.getElementById('attrezzoQuantita').value = item.quantita;
    document.getElementById('attrezzoCategoria').value = item.categoria || 'Altro';
    document.getElementById('attrezzoStato').value = item.stato || 'Disponibile';
    document.getElementById('attrezzoPrestatoA').value = item.prestato_a || '';
    document.getElementById('attrezzoNote').value = item.note || '';

    // Mostra foto esistente se presente
    currentSelectedFile = null;
    if (item.foto) {
        if (photoPreviewImg) photoPreviewImg.src = '/' + item.foto;
        if (fileNameDisplay) fileNameDisplay.textContent = 'Foto presente nel catalogo';
        if (photoPreviewContainer) photoPreviewContainer.style.display = 'block';
        if (removePhotoBtn) removePhotoBtn.style.display = 'none';
    } else {
        if (photoPreviewContainer) photoPreviewContainer.style.display = 'none';
        if (fileNameDisplay) fileNameDisplay.textContent = '';
    }
    
    const prestitoGroup = document.getElementById('prestitoGroup');
    if (item.stato === 'In Prestito') prestitoGroup.style.display = 'block';
    else prestitoGroup.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Delete Item
async function deleteItem(id, photoPath) {
    const isConfirmed = await customConfirm('Elimina Attrezzo', 'Sei sicuro di voler eliminare definitivamente questo attrezzo?');
    if (!isConfirmed) return;
    
    const itemToDelete = inventario.find(i => i.id === id);
    if(itemToDelete) logHistory('Eliminato', itemToDelete.nome);

    inventario = inventario.filter(item => item.id !== id);
    await saveInventory();
    
    if (photoPath) {
        const filename = photoPath.split('/').pop();
        try {
            await fetch(`${API_BASE}/upload/${filename}`, { method: 'DELETE' });
        } catch (e) {
            console.error('Failed to delete photo file');
        }
    }
    
    showToast('Eliminato con successo');
    renderGrid();
}

// Render Grid
function renderGrid(filter = '') {
    grid.innerHTML = '';
    
    // Calcolo Dashboard Stats
    let totAttrezzi = 0;
    let totPrestiti = 0;
    let totManutenzione = 0;
    let totDisponibili = 0;
    
    inventario.forEach(item => {
        const qta = parseInt(item.quantita) || 1;
        totAttrezzi += qta;
        if (item.stato === 'In Prestito') totPrestiti += qta;
        if (item.stato === 'In Manutenzione') totManutenzione += qta;
        if (item.stato === 'Disponibile') totDisponibili += qta;
    });

    document.getElementById('statTotale').textContent = totAttrezzi;
    document.getElementById('statPrestiti').textContent = totPrestiti;
    document.getElementById('statManutenzione').textContent = totManutenzione;
    if (document.getElementById('statDisponibili')) document.getElementById('statDisponibili').textContent = totDisponibili;

    const lowerFilter = filter.toLowerCase();
    
    const selCat = filterCategoria.value;
    const selStato = filterStato.value;
    
    const filtered = inventario.filter(item => {
        const itemIdStr = `inv-${item.id}`;
        const matchText = item.nome.toLowerCase().includes(lowerFilter) || 
                          item.posizione.toLowerCase().includes(lowerFilter) ||
                          (item.note && item.note.toLowerCase().includes(lowerFilter)) ||
                          itemIdStr.includes(lowerFilter);
                          
        const matchCat = selCat === '' || item.categoria === selCat;
        const matchStato = selStato === '' || item.stato === selStato;
        
        return matchText && matchCat && matchStato;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Nessun attrezzo trovato.</div>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card glass-panel';
        
        // Placeholder SVG se non c'è foto
        const imgSrc = item.foto 
            ? `/${item.foto}` 
            : `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1zm3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4h-3.5zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z'/%3E%3C/svg%3E`;

        // Colore badge stato
        let statusColor = '#94a3b8';
        if (item.stato === 'Disponibile') statusColor = '#4ade80';
        else if (item.stato === 'In Prestito') statusColor = '#fb923c';
        else if (item.stato === 'In Manutenzione') statusColor = '#ef4444';
        else if (item.stato === 'Dismesso') statusColor = '#64748b';

        const statoTxt = item.stato || 'Disponibile';
        const qta = item.quantita || '1';
        const cat = item.categoria || 'Altro';

        let badgeTitleHTML = `<div class="card-title">${item.nome}</div>`;
        if (item.stato === 'In Prestito' && item.prestato_a) {
            badgeTitleHTML = `<div class="card-title" style="margin-bottom:0;">${item.nome}</div>
                              <div style="font-size:0.85rem; color:#fb923c; margin-bottom:10px;">Prestato a: <strong>${item.prestato_a}</strong></div>`;
        }

        const qtaVal = parseInt(item.quantita) || 0;
        if (qtaVal <= 0) {
            card.style.border = '2px solid var(--danger)';
            card.style.boxShadow = '0 0 15px rgba(239,68,68,0.4)';
            badgeTitleHTML += `<div style="font-size:0.8rem; color:var(--danger); font-weight:bold; margin-bottom:10px;">⚠️ IN ESAURIMENTO</div>`;
        }

        card.innerHTML = `
            <div class="card-badge">${item.posizione}</div>
            <div class="card-status-badge" style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}44;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${statusColor}; margin-right:4px;"></span>
                ${statoTxt}
            </div>
            <div class="card-img-wrapper" style="cursor:zoom-in;" onclick="openImageModal('${imgSrc}')">
                <img src="${imgSrc}" class="card-img" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' fill=\\'%2394a3b8\\' viewBox=\\'0 0 16 16\\'%3E%3Cpath d=\\'M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1zm3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4h-3.5zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z\\'/%3E%3C/svg%3E'; this.style.objectFit='contain'; this.style.padding='2rem';">
            </div>
            <div class="card-body">
                ${badgeTitleHTML}
                <div style="font-size:0.8rem; color:var(--gold-light); margin-bottom:8px;">📁 ${cat} &nbsp;|&nbsp; 📦 Q.tà: ${qta}</div>
                <div class="card-notes" title="${item.note || ''}">${item.note || '<i>Nessuna nota aggiuntiva</i>'}</div>
                <div class="card-actions">
                    <button class="btn-icon" onclick="editItem(${item.id})" title="Modifica">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" onclick="printQRCode('${item.id}', '${item.nome.replace(/'/g, "\\'")}')" title="Stampa QR Code">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><line x1="9" y1="15" x2="9.01" y2="15"></line><line x1="15" y1="15" x2="15.01" y2="15"></line></svg>
                    </button>
                    <button class="btn-icon" onclick="deleteItem(${item.id}, '${item.foto || ''}')" title="Elimina">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    updateCharts();
}

function updateCharts() {
    if (typeof Chart === 'undefined') return;
    if (!document.getElementById('categoryChart')) return;

    const catData = {};
    const statoData = {};

    inventario.forEach(item => {
        const cat = item.categoria || 'Altro';
        const stato = item.stato || 'Disponibile';
        catData[cat] = (catData[cat] || 0) + (parseInt(item.quantita) || 1);
        statoData[stato] = (statoData[stato] || 0) + (parseInt(item.quantita) || 1);
    });

    // Chart Options
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#f8fafc' } } }
    };

    if (chartCat) chartCat.destroy();
    chartCat = new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{ data: Object.values(catData), backgroundColor: ['#d4af37', '#aa7c11', '#f3e5ab', '#4ade80', '#fb923c', '#94a3b8'], borderWidth: 0 }]
        },
        options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Attrezzi per Categoria', color: '#d4af37' } } }
    });

    if (chartStato) chartStato.destroy();
    chartStato = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statoData),
            datasets: [{ data: Object.values(statoData), backgroundColor: ['#4ade80', '#fb923c', '#ef4444', '#64748b'], borderWidth: 0 }]
        },
        options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Attrezzi per Stato', color: '#d4af37' } } }
    });
}

// Filters & Search
searchInput.addEventListener('input', () => renderGrid(searchInput.value));
filterCategoria.addEventListener('change', () => renderGrid(searchInput.value));
filterStato.addEventListener('change', () => renderGrid(searchInput.value));

btnExportCSV.addEventListener('click', () => {
    if (inventario.length === 0) return showToast('Nessun attrezzo da esportare');
    let csv = 'ID,Nome,Posizione,Quantita,Categoria,Stato,PrestatoA,Note\n';
    inventario.forEach(i => {
        csv += `${i.id},"${i.nome}","${i.posizione}",${i.quantita},"${i.categoria || ''}","${i.stato}","${i.prestato_a || ''}","${(i.note || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Inventario_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Shutdown
shutdownBtn.addEventListener('click', () => {
    window.location.href = 'launcher.html';
});

// Backup
const btnBackupInventarioApp = document.getElementById('btnBackupInventarioApp');
if (btnBackupInventarioApp) {
    btnBackupInventarioApp.addEventListener('click', async (e) => {
        e.preventDefault();
        const originalHTML = btnBackupInventarioApp.innerHTML;
        btnBackupInventarioApp.style.pointerEvents = 'none';
        btnBackupInventarioApp.innerHTML = `⏳ IN CORSO...`;
        
        try {
            await fetch(`${API_BASE}/backup-inventario`, { method: 'POST' });
            btnBackupInventarioApp.innerHTML = `✅ FATTO`;
            setTimeout(() => {
                btnBackupInventarioApp.innerHTML = originalHTML;
                btnBackupInventarioApp.style.pointerEvents = 'auto';
            }, 3000);
        } catch(e) {
            showToast("Errore nell'avvio del backup");
            btnBackupInventarioApp.innerHTML = originalHTML;
            btnBackupInventarioApp.style.pointerEvents = 'auto';
        }
    });
}

// Apri Cartella Backup
const btnOpenBackupFolder = document.getElementById('btnOpenBackupFolder');
if (btnOpenBackupFolder) {
    btnOpenBackupFolder.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/open-backup-folder`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast("Cartella di backup aperta su Windows!");
            } else {
                showToast(data.message || "Apertura consentita solo sul PC locale");
            }
        } catch(e) {
            showToast("Errore nell'apertura della cartella");
        }
    });
}

// Condizionale Prestito Input
document.getElementById('attrezzoStato').addEventListener('change', function() {
    const prestitoGroup = document.getElementById('prestitoGroup');
    if (this.value === 'In Prestito') {
        prestitoGroup.style.display = 'block';
    } else {
        prestitoGroup.style.display = 'none';
        document.getElementById('attrezzoPrestatoA').value = '';
    }
});

// Stampa QR Code
function printQRCode(id, nome) {
    // Usa l'IP del server (es. IP Tailscale) al posto di localhost per far funzionare i QR sul telefono
    const hostStr = (serverIp !== 'localhost') ? `${serverIp}:3000` : window.location.host;
    const qrData = `http://${hostStr}/?q=INV-${id}`;
    
    // Rimuovi eventuali modali QR vecchie
    const oldModal = document.getElementById('qrModal');
    if(oldModal) oldModal.remove();

    const qrModal = document.createElement('div');
    qrModal.id = 'qrModal';
    qrModal.className = 'modal-overlay show';
    qrModal.style.zIndex = '10000';
    qrModal.innerHTML = `
        <div class="card" style="max-width: 400px; text-align: center; padding: 2rem; background: var(--bg-color); border: 2px solid var(--gold-primary);">
            <h3 style="color: var(--gold-light); margin-bottom: 10px;">QR Code</h3>
            <p style="color: var(--text-main); font-weight:bold; font-size:1.2rem; margin-bottom:20px;">${nome}</p>
            <div style="background:#fff; padding:15px; display:inline-block; border-radius:10px; margin-bottom: 20px;" id="qrCodeContainer">
            </div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button class="btn btn-danger" onclick="document.getElementById('qrModal').remove()">Chiudi</button>
                <button class="btn btn-primary" onclick="window.print()">Stampa</button>
            </div>
        </div>
    `;
    document.body.appendChild(qrModal);

    // Genera QR Code localmente
    new QRCode(document.getElementById("qrCodeContainer"), {
        text: qrData,
        width: 250,
        height: 250,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });
}

// Setup QR Labels Sheet Printing
function setupQRLabelsPrint() {
    const btnPrintQRLabels = document.getElementById('btnPrintQRLabels');
    const modalPrintLabels = document.getElementById('modalPrintLabels');
    const btnClosePrintLabels = document.getElementById('btnClosePrintLabels');
    const selectPrintFilterPos = document.getElementById('selectPrintFilterPos');
    const btnPrintAllQR = document.getElementById('btnPrintAllQR');
    const btnExecutePrint = document.getElementById('btnExecutePrint');
    const labelsGrid = document.getElementById('labelsGrid');

    if (!btnPrintQRLabels || !modalPrintLabels) return;

    function populateLocationFilter() {
        if (!selectPrintFilterPos) return;
        const currentVal = selectPrintFilterPos.value;
        selectPrintFilterPos.innerHTML = '<option value="ALL">Tutte le Posizioni</option>';
        posizioni.forEach(pos => {
            const opt = document.createElement('option');
            opt.value = pos;
            opt.textContent = pos;
            selectPrintFilterPos.appendChild(opt);
        });
        if (currentVal && (currentVal === 'ALL' || posizioni.includes(currentVal))) {
            selectPrintFilterPos.value = currentVal;
        }
    }

    function renderLabels(filterPos = 'ALL') {
        if (!labelsGrid) return;
        labelsGrid.innerHTML = '';
        const itemsToPrint = (filterPos === 'ALL') 
            ? inventario 
            : inventario.filter(i => (i.posizione || 'Non assegnata') === filterPos);

        if (itemsToPrint.length === 0) {
            labelsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Nessun attrezzo trovato per la selezione.</div>';
            return;
        }

        const hostStr = (serverIp !== 'localhost') ? `${serverIp}:3000` : window.location.host;

        itemsToPrint.forEach(item => {
            const card = document.createElement('div');
            card.className = 'label-card';
            const qrId = `qr-label-${item.id}`;
            card.innerHTML = `
                <div class="label-info">
                    <span class="label-code">INV-${String(item.id).padStart(4, '0')}</span>
                    <h4 class="label-title" title="${item.nome}">${item.nome}</h4>
                    <span class="label-pos">📍 ${item.posizione || 'Non assegnata'}</span>
                    <span class="label-cat">🏷️ ${item.categoria || 'Generale'}</span>
                </div>
                <div class="label-qr" id="${qrId}"></div>
            `;
            labelsGrid.appendChild(card);

            const qrData = `http://${hostStr}/?q=INV-${item.id}`;
            try {
                new QRCode(document.getElementById(qrId), {
                    text: qrData,
                    width: 90,
                    height: 90,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch(e) {
                console.error("QR Code generation error:", e);
            }
        });
    }

    btnPrintQRLabels.addEventListener('click', () => {
        populateLocationFilter();
        renderLabels(selectPrintFilterPos ? selectPrintFilterPos.value : 'ALL');
        modalPrintLabels.classList.add('show');
    });

    if (btnClosePrintLabels) {
        btnClosePrintLabels.addEventListener('click', () => {
            modalPrintLabels.classList.remove('show');
        });
    }

    if (selectPrintFilterPos) {
        selectPrintFilterPos.addEventListener('change', (e) => {
            renderLabels(e.target.value);
        });
    }

    if (btnPrintAllQR) {
        btnPrintAllQR.addEventListener('click', () => {
            if (selectPrintFilterPos) selectPrintFilterPos.value = 'ALL';
            renderLabels('ALL');
        });
    }

    if (btnExecutePrint) {
        btnExecutePrint.addEventListener('click', () => {
            window.print();
        });
    }
}


// Sincronizzazione automatica
async function syncPendingData() {
    let synced = false;
    if (localStorage.getItem('inventario_sync_pending') === 'true') {
        try {
            // Unisci i dati locali con quelli sul server per evitare perdite di dati
            const serverRes = await fetch(`${API_BASE}/inventory`);
            const serverData = await serverRes.json();
            const localData = JSON.parse(localStorage.getItem('inventario_cache') || '[]');
            
            const mergedMap = new Map();
            serverData.forEach(item => mergedMap.set(item.id, item));
            localData.forEach(item => mergedMap.set(item.id, item));
            
            const mergedArray = Array.from(mergedMap.values());
            mergedArray.sort((a, b) => b.id - a.id);

            const res = await fetch(`${API_BASE}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mergedArray)
            });
            if (res.ok) {
                localStorage.removeItem('inventario_sync_pending');
                inventario = mergedArray;
                localStorage.setItem('inventario_cache', JSON.stringify(mergedArray));
                renderGrid(document.getElementById('ricerca').value);
                synced = true;
            }
        } catch (e) {}
    }
    if (localStorage.getItem('posizioni_sync_pending') === 'true') {
        try {
            const res = await fetch(`${API_BASE}/locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: localStorage.getItem('posizioni_cache')
            });
            if (res.ok) {
                localStorage.removeItem('posizioni_sync_pending');
                synced = true;
            }
        } catch (e) {}
    }
    if (synced) {
        showToast('Sincronizzazione completata!');
    }
}

// Auto-Refresh per mantenere aggiornato il PC se si inseriscono dati dal telefono
async function autoRefreshData() {
    if (!navigator.onLine) return;
    try {
        const res = await fetch(`${API_BASE}/inventory`);
        if (res.ok) {
            const rawText = await res.text();
            if (rawText !== lastInventoryHash) {
                lastInventoryHash = rawText;
                inventario = JSON.parse(rawText);
                inventario.sort((a, b) => b.id - a.id);
                localStorage.setItem('inventario_cache', JSON.stringify(inventario));
                
                // Aggiorna l'interfaccia in tempo reale sul PC senza ricaricare la pagina
                renderGrid(document.getElementById('ricerca').value);
                
                // Riproduci una piccola notifica
                showToast('Inventario aggiornato automaticamente!');
            }
        }
    } catch (e) {}
}

setInterval(() => {
    // Sincronizzazione in upload (dal telefono al PC)
    if (localStorage.getItem('inventario_sync_pending') === 'true' || localStorage.getItem('posizioni_sync_pending') === 'true') {
        syncPendingData();
    }
    // Sincronizzazione in download (dal server al browser del PC)
    autoRefreshData();
}, 5000);

window.addEventListener('online', syncPendingData);

// History Logic
function logHistory(action, itemNome) {
    const timestamp = new Date().toLocaleString();
    let actionColor = '#cbd5e1';
    if(action === 'Aggiunto') actionColor = '#4ade80';
    if(action === 'Modificato') actionColor = '#f59e0b';
    if(action === 'Eliminato') actionColor = '#ef4444';
    
    cronologia.unshift(`<span style="color:var(--text-muted); font-size:0.8rem;">[${timestamp}]</span> <span style="color:${actionColor}; font-weight:bold;">${action}</span>: <strong>${itemNome}</strong>`);
    if(cronologia.length > 50) cronologia.pop();
    localStorage.setItem('inventario_cronologia', JSON.stringify(cronologia));
}

if (btnCronologia) {
    btnCronologia.addEventListener('click', () => {
        historyList.innerHTML = cronologia.length === 0 
            ? '<div style="color:var(--text-muted); text-align:center;">Nessun evento registrato.</div>'
            : cronologia.map(entry => `<div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">${entry}</div>`).join('');
        historyModal.classList.add('show');
    });
    btnCloseHistoryModal.addEventListener('click', () => historyModal.classList.remove('show'));
}

// QR Scanner Logic
if (btnScanQR) {
    let html5Qrcode = null;

    btnScanQR.addEventListener('click', () => {
        scannerModal.classList.add('show');
        
        // Pulisci errori precedenti
        document.getElementById('reader').innerHTML = '';
        
        if (!html5Qrcode) {
            html5Qrcode = new Html5Qrcode("reader");
        }
        
        html5Qrcode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                html5Qrcode.stop().then(() => {
                    scannerModal.classList.remove('show');
                    
                    // Parse INV-ID
                    const match = decodedText.match(/INV-(\d+)/i);
                    if(match) {
                        searchInput.value = 'INV-' + match[1];
                        renderGrid('INV-' + match[1]);
                        showToast('Attrezzo trovato!');
                    } else if(decodedText.includes('?q=')) {
                        const q = decodedText.split('?q=')[1];
                        searchInput.value = q;
                        renderGrid(q);
                        showToast('Ricerca completata!');
                    } else {
                        searchInput.value = decodedText;
                        renderGrid(decodedText);
                        showToast('QR Code scansionato!');
                    }
                }).catch(err => console.error("Error stopping scanner", err));
            },
            (errorMessage) => {
                // ignora errori dei singoli frame
            }
        ).catch(err => {
            console.error(err);
            document.getElementById('reader').innerHTML = `
                <div style="padding: 2rem; color: #ef4444; font-size: 0.9rem;">
                    <p style="margin-bottom: 10px;"><b>Errore Fotocamera</b></p>
                    <p>Brave/Browser sta bloccando l'accesso, oppure hai negato i permessi.</p>
                    <p style="margin-top: 10px; font-size: 0.8rem; color: #94a3b8;">${err}</p>
                </div>
            `;
        });
    });

    btnCloseScanner.addEventListener('click', async () => {
        if(html5Qrcode) {
            try {
                if(html5Qrcode.getState() === 2) { // 2 = SCANNING
                    await html5Qrcode.stop();
                }
            } catch(e) { console.warn(e); }
        }
        scannerModal.classList.remove('show');
    });
}

// Start
init();
