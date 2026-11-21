let allRecipes = [];
let currentCategory = 'all';
let currentOrigin = 'all';
let fridgeIngredients = [];
let shoppingListRecipeIds = new Set();
let mealPlan = JSON.parse(localStorage.getItem('mealPlan')) || {
    lunedi: [], martedi: [], mercoledi: [], giovedi: [], venerdi: [], sabato: [], domenica: []
};
let recipeStats = JSON.parse(localStorage.getItem('recipeStats')) || {
    totalCooked: 0,
    recipes: {},
    categories: {}
};

// DOM Elements
const recipesGrid = document.getElementById('recipesGrid');
const searchInput = document.getElementById('searchInput');
const fridgeInput = document.getElementById('fridgeInput');
const fridgeTags = document.getElementById('fridgeTags');
const categoryFilter = document.getElementById('categoryFilter');
const originFilter = document.getElementById('originFilter');

const recipeModal = document.getElementById('recipeModal');
const btnNewRecipe = document.getElementById('btnNewRecipe');
const btnCloseModal = document.getElementById('btnCloseModal');
const recipeForm = document.getElementById('recipeForm');

const viewModal = document.getElementById('viewModal');
const btnCloseView = document.getElementById('btnCloseView');
const btnDeleteRecipe = document.getElementById('btnDeleteRecipe');
const btnEditRecipe = document.getElementById('btnEditRecipe'); // Nuovo bottone
const btnBackRecipe = document.getElementById('btnBackRecipe'); // Bottone Indietro
const btnPrintRecipe = document.getElementById('btnPrintRecipe'); // Bottone Stampa
const btnRandomRecipe = document.getElementById('btnRandomRecipe'); // Bottone Sorprendimi

let currentEditId = null;

// Image upload preview
const imagePreview = document.getElementById('imagePreview');
const fotoInput = document.getElementById('fotoInput');
const fotoPath = document.getElementById('fotoPath');

// Fetch Recipes on load con fallback offline e auto-sync
async function loadRecipes() {
    try {
        const res = await fetch('/api/recipes');
        if (res.ok) {
            allRecipes = await res.json();
            localStorage.setItem('allRecipes_cache', JSON.stringify(allRecipes));
            
            // Se ci sono ricette salvate sul telefono mentre si era offline, sincronizza con il PC
            if (localStorage.getItem('ricette_sync_pending') === 'true') {
                await syncPendingRecipes();
            }
        } else {
            throw new Error('Server non raggiungibile');
        }
        renderRecipes();
    } catch (e) {
        console.warn("Offline: carico ricette dalla memoria locale", e);
        const cached = localStorage.getItem('allRecipes_cache');
        if (cached) {
            allRecipes = JSON.parse(cached);
        }
        renderRecipes();
    }
}

async function syncPendingRecipes() {
    try {
        const cached = localStorage.getItem('allRecipes_cache');
        if (!cached) return;
        const localList = JSON.parse(cached);
        
        // Merge intelligente per ID per non sovrascrivere
        const map = new Map();
        allRecipes.forEach(r => map.set(r.id, r));
        localList.forEach(r => map.set(r.id, r));
        const merged = Array.from(map.values());

        const res = await fetch('/api/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged)
        });
        if (res.ok) {
            localStorage.removeItem('ricette_sync_pending');
            allRecipes = merged;
            localStorage.setItem('allRecipes_cache', JSON.stringify(merged));
            renderRecipes();
            console.log('Ricette offline sincronizzate con successo!');
        }
    } catch(err) {
        console.warn('Sync pending failed, will retry on next connect', err);
    }
}

window.addEventListener('online', syncPendingRecipes);

// Render Grid
function renderRecipes() {
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = allRecipes.filter(r => {
        let matchCat = false;
        if (currentCategory === 'all') {
            matchCat = true;
        } else if (currentCategory === 'favorites') {
            matchCat = r.isFavorite === true;
        } else {
            matchCat = r.categoria === currentCategory;
        }
        
        let matchOrig = false;
        if (currentOrigin === 'all') {
            matchOrig = true;
        } else {
            matchOrig = r.origine === currentOrigin;
        }
        
        const safeTitolo = (r.titolo || "").toLowerCase();
        const safeIngred = (r.ingredienti || "").toLowerCase();
        const matchSearch = safeTitolo.includes(searchTerm) || safeIngred.includes(searchTerm);
        
        let matchFridge = true;
        if (fridgeIngredients.length > 0) {
            matchFridge = fridgeIngredients.every(tag => safeIngred.includes(tag));
        }
        
        return matchCat && matchOrig && matchSearch && matchFridge;
    });

    // -- STAGIONALITÀ --
    const month = new Date().getMonth(); // 0-11
    let seasonTitle = "";
    let seasonKeywords = [];
    if (month >= 2 && month <= 4) {
        seasonTitle = "🌸 Profumo di Primavera";
        seasonKeywords = ["asparagi", "fragole", "piselli", "carciofi", "fresco", "primavera", "primaverile"];
    } else if (month >= 5 && month <= 7) {
        seasonTitle = "☀️ Estate in Tavola";
        seasonKeywords = ["pomodori", "zucchine", "melanzane", "basilico", "freddo", "insalata", "estate", "estivo", "estiva"];
    } else if (month >= 8 && month <= 10) {
        seasonTitle = "🍂 Sapori d'Autunno";
        seasonKeywords = ["zucca", "fungh", "castagne", "patate", "caldo", "zuppa", "autunno", "autunnale"];
    } else {
        seasonTitle = "❄️ Coccole Invernali";
        seasonKeywords = ["cavolo", "brodo", "aranc", "polenta", "forno", "inverno", "invernale"];
    }

    const seasonalShowcase = document.getElementById('seasonalShowcase');
    const seasonalGrid = document.getElementById('seasonalGrid');
    
    // Mostra vetrina solo se non ci sono filtri attivi
    if(currentOrigin === 'all' && currentCategory === 'all' && fridgeIngredients.length === 0 && searchInput.value === '') {
        let seasonalRecipes = allRecipes.filter(r => {
            const text = ((r.titolo||"") + " " + (r.ingredienti||"")).toLowerCase();
            return seasonKeywords.some(kw => text.includes(kw));
        });
        if(seasonalRecipes.length > 0) {
            seasonalShowcase.style.display = 'block';
            document.getElementById('seasonalTitle').textContent = seasonTitle;
            seasonalGrid.innerHTML = '';
            // Prendi fino a 3 ricette a caso tra quelle stagionali
            let shuffled = seasonalRecipes.sort(() => 0.5 - Math.random());
            let showcaseItems = shuffled.slice(0,3);
            showcaseItems.forEach(r => {
                seasonalGrid.appendChild(createRecipeCard(r));
            });
            
            // Rimuoviamo le ricette in vetrina dalla griglia principale per non avere duplicati
            const showcaseIds = new Set(showcaseItems.map(r => r.id));
            filtered = filtered.filter(r => !showcaseIds.has(r.id));
            
        } else {
            seasonalShowcase.style.display = 'none';
        }
    } else {
        seasonalShowcase.style.display = 'none';
    }

    recipesGrid.innerHTML = '';
    
    // Aggiorna anche la lista delle origini nella sidebar
    renderOrigins();
    
    if (filtered.length === 0 && seasonalShowcase.style.display === 'none') {
        recipesGrid.innerHTML = '<p style="color:#888; grid-column: 1/-1; text-align: center; padding: 3rem;">Nessuna ricetta trovata.</p>';
        return;
    } else if (filtered.length === 0) {
        // Se non ci sono ricette rimanenti oltre a quelle in vetrina, nascondi il titolo "Tutte le Ricette" (se volessimo)
        // Ma per ora lasciamo solo vuota la griglia
    }

    filtered.forEach(r => {
        recipesGrid.appendChild(createRecipeCard(r));
    });
}

function createRecipeCard(r) {
    const ingPreviewArray = r.ingredienti.split('\n').filter(i => i.trim() !== '');
    const ingPreview = ingPreviewArray.slice(0, 3).join(', ') + (ingPreviewArray.length > 3 ? '...' : '');

    const isFav = r.isFavorite ? '❤️' : '🤍';
    const favClass = r.isFavorite ? 'active' : '';

    const tPrep = parseInt(r.tempo) || 0;
    const tCott = parseInt(r.tempo_cottura) || 0;
    const totalTime = tPrep + tCott;
    const displayTime = totalTime > 0 ? `${totalTime} min` : '-';

    const isShop = shoppingListRecipeIds.has(r.id);
    const shopClass = isShop ? 'active' : '';

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `
        <button class="card-shop-btn ${shopClass}" onclick="toggleShoppingList('${r.id}', event)" title="Aggiungi alla spesa">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </button>
        <button class="card-plan-btn" onclick="openAssignDayModal('${r.id}', event)" title="Pianifica Menu">📅</button>
        <button class="card-fav-btn ${favClass}" onclick="toggleFavorite('${r.id}', event)">${isFav}</button>
        <span class="card-badge">${r.categoria}</span>
        <div class="card-img-wrapper">
            <img src="${r.foto || 'https://via.placeholder.com/400x300?text=Nessuna+Foto'}" alt="${r.titolo}" class="card-image">
            <div class="card-hover-overlay">
                <span class="btn-scopri">Scopri Ricetta</span>
            </div>
        </div>
        <div class="card-content">
            <h3 class="card-title">${r.titolo}</h3>
            <p class="card-ingredients-preview">${ingPreview}</p>
            <div class="card-meta">
                <span>⏱️ ${displayTime}</span>
                <span>🍽️ ${r.porzioni || '-'} px</span>
            </div>
        </div>
    `;
    card.addEventListener('click', () => openViewModal(r));
    return card;
}

// Filters
searchInput.addEventListener('input', renderRecipes);

categoryFilter.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if(li) {
        document.querySelectorAll('#categoryFilter li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        currentCategory = li.getAttribute('data-cat');
        renderRecipes();
    }
});

originFilter.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if(li) {
        document.querySelectorAll('#originFilter li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        currentOrigin = li.getAttribute('data-orig');
        renderRecipes();
    }
});

function renderOrigins() {
    const uniqueOrigins = [...new Set(allRecipes.map(r => r.origine).filter(Boolean))].sort();
    
    let html = `<li class="${currentOrigin === 'all' ? 'active' : ''}" data-orig="all">🏷️ Tutte le Fonti</li>`;
    
    uniqueOrigins.forEach(orig => {
        const isActive = currentOrigin === orig ? 'active' : '';
        html += `<li class="${isActive}" data-orig="${orig}">👤 ${orig}</li>`;
    });
    
    originFilter.innerHTML = html;
}

// ==========================================
// SVUOTA FRIGO LOGIC
// ==========================================
fridgeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && fridgeInput.value.trim() !== '') {
        const tag = fridgeInput.value.trim().toLowerCase();
        if (!fridgeIngredients.includes(tag)) {
            fridgeIngredients.push(tag);
            renderFridgeTags();
            
            // Reset dei filtri per cercare in tutto il ricettario
            currentCategory = 'all';
            document.querySelectorAll('#categoryFilter li').forEach(el => el.classList.remove('active'));
            const allCatLi = document.querySelector('#categoryFilter li[data-cat="all"]');
            if (allCatLi) allCatLi.classList.add('active');
            
            currentOrigin = 'all';
            document.querySelectorAll('#originFilter li').forEach(el => el.classList.remove('active'));
            const allOrigLi = document.querySelector('#originFilter li[data-orig="all"]');
            if (allOrigLi) allOrigLi.classList.add('active');

            renderRecipes();
        }
        fridgeInput.value = '';
    }
});

function renderFridgeTags() {
    fridgeTags.innerHTML = '';
    fridgeIngredients.forEach(tag => {
        const div = document.createElement('div');
        div.className = 'fridge-tag';
        div.innerHTML = `${tag} <span onclick="removeFridgeTag('${tag}')">✕</span>`;
        fridgeTags.appendChild(div);
    });
}

window.removeFridgeTag = function(tag) {
    fridgeIngredients = fridgeIngredients.filter(t => t !== tag);
    renderFridgeTags();
    renderRecipes();
}

// ==========================================
// LISTA SPESA LOGIC
// ==========================================
// ==========================================
// LISTA SPESA LOGIC UNIFICATA
// ==========================================
window.toggleShoppingList = function(id, e) {
    if (e) e.stopPropagation();
    if (shoppingListRecipeIds.has(id)) {
        shoppingListRecipeIds.delete(id);
    } else {
        shoppingListRecipeIds.add(id);
    }
    updateFAB();
    renderRecipes();
};

const shoppingModal = document.getElementById('shoppingModal');
const btnCloseShopping = document.getElementById('btnCloseShopping');
const btnCopyShoppingList = document.getElementById('btnCopyShoppingList');
const btnClearShoppingList = document.getElementById('btnClearShoppingList');
const btnPrintShoppingList = document.getElementById('btnPrintShoppingList');
const btnWhatsAppShoppingList = document.getElementById('btnWhatsAppShoppingList');
const shoppingListContainer = document.getElementById('shoppingListContainer');
const shoppingSubtitle = document.getElementById('shoppingSubtitle');
const sidebarShoppingBadge = document.getElementById('sidebarShoppingBadge');
const btnOpenShoppingSidebar = document.getElementById('btnOpenShoppingSidebar');
const shoppingCartFab = document.getElementById('shoppingCartFab');
const shoppingCartBadge = document.getElementById('shoppingCartBadge');

function updateFAB() {
    const totalCount = shoppingListRecipeIds.size;
    if (sidebarShoppingBadge) {
        sidebarShoppingBadge.textContent = totalCount;
        sidebarShoppingBadge.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }
    if (shoppingCartBadge) {
        shoppingCartBadge.textContent = totalCount;
        shoppingCartBadge.style.display = totalCount > 0 ? 'flex' : 'none';
    }
}

if (btnOpenShoppingSidebar) {
    btnOpenShoppingSidebar.addEventListener('click', () => {
        generateShoppingList();
        if(shoppingModal) shoppingModal.classList.add('active');
    });
}

if (shoppingCartFab) {
    shoppingCartFab.addEventListener('click', () => {
        generateShoppingList();
        if(shoppingModal) shoppingModal.classList.add('active');
    });
}

if (btnCloseShopping) {
    btnCloseShopping.addEventListener('click', () => {
        if(shoppingModal) shoppingModal.classList.remove('active');
    });
}

if (btnPrintShoppingList) {
    btnPrintShoppingList.addEventListener('click', () => {
        window.print();
    });
}

if (btnClearShoppingList) {
    btnClearShoppingList.addEventListener('click', () => {
        if (confirm('Vuoi davvero svuotare la lista della spesa?')) {
            shoppingListRecipeIds.clear();
            updateFAB();
            renderRecipes();
            generateShoppingList();
            showToast('Lista della spesa svuotata! 🗑️');
        }
    });
}

function generateShoppingList() {
    if (!shoppingListContainer) return;
    let selectedRecipes = allRecipes.filter(r => shoppingListRecipeIds.has(r.id));

    if (selectedRecipes.length === 0) {
        if (shoppingSubtitle) shoppingSubtitle.textContent = 'Nessuna ricetta selezionata.';
        shoppingListContainer.innerHTML = '<div style="text-align:center; padding: 2.5rem; color:#888;"><span style="font-size:2.5rem; display:block; margin-bottom:10px;">🛒</span>Nessuna ricetta aggiunta alla spesa.<br><small style="color:#aaa;">Seleziona le ricette cliccando sull\'icona carrello nelle schede o nel dettaglio ricetta.</small></div>';
        return;
    }

    if (shoppingSubtitle) {
        const recipeTitles = selectedRecipes.map(r => `<b>${r.titolo}</b>`).join(', ');
        shoppingSubtitle.innerHTML = `Ricette incluse (${selectedRecipes.length}): ${recipeTitles}`;
    }

    let allLines = [];
    selectedRecipes.forEach(r => {
        if (r.ingredienti) {
            const lines = r.ingredienti.split('\n').filter(l => l.trim() !== '');
            allLines = allLines.concat(lines);
        }
    });

    const aggregated = {};
    const regex = /^([\d.,]+)?\s*(g|kg|ml|l|cucchiai|cucchiaini|pz|spicchi|fette)?\s*(.*)$/i;

    allLines.forEach(line => {
        const match = line.trim().match(regex);
        if (match && match[1]) {
            let qty = parseFloat(match[1].replace(',', '.'));
            let unit = match[2] ? match[2].toLowerCase() : '';
            let name = match[3] ? match[3].trim().toLowerCase() : line.trim();

            if (!name) name = line.trim();
            const key = `${unit}_${name}`;
            if (!aggregated[key]) {
                aggregated[key] = { name: name, unit: unit, qty: 0 };
            }
            aggregated[key].qty += qty;
        } else {
            const cleanName = line.trim();
            const key = `raw_${cleanName.toLowerCase()}`;
            if (!aggregated[key]) {
                aggregated[key] = { name: cleanName, unit: '', qty: 0 };
            }
        }
    });

    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    for (let key in aggregated) {
        const item = aggregated[key];
        let displayStr = '';
        if (item.qty > 0) {
            const qtyStr = (item.qty % 1 === 0) ? item.qty : item.qty.toFixed(1).replace('.', ',');
            displayStr = `<strong>${qtyStr} ${item.unit}</strong> ${item.name}`;
        } else {
            displayStr = item.name;
        }
        
        html += `
            <label class="shopping-item" style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:#f8fafc; border-radius:8px; cursor:pointer; border-left:4px solid var(--primary); transition: background 0.2s;">
                <input type="checkbox" onchange="this.parentElement.style.opacity = this.checked ? '0.5' : '1'; this.nextElementSibling.style.textDecoration = this.checked ? 'line-through' : 'none';" style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer;">
                <span class="text-content" style="font-size:1.05rem; color:#1e293b; text-transform:capitalize;">${displayStr}</span>
            </label>
        `;
    }
    html += '</div>';

    shoppingListContainer.innerHTML = html;
}

function getShoppingListText() {
    let textToCopy = "🛒 *LA MIA LISTA DELLA SPESA* 🛒\n\n";
    let selectedRecipes = allRecipes.filter(r => shoppingListRecipeIds.has(r.id));
    if (selectedRecipes.length > 0) {
        textToCopy += `🍽️ *Ricette:* ${selectedRecipes.map(r => r.titolo).join(', ')}\n\n`;
    }
    document.querySelectorAll('.shopping-item .text-content').forEach(el => {
        textToCopy += `◻️ ${el.textContent.trim()}\n`;
    });
    textToCopy += "\n_Generato da Il Ricettario di Famiglia_ ❤️";
    return textToCopy;
}

if (btnCopyShoppingList) {
    btnCopyShoppingList.addEventListener('click', () => {
        navigator.clipboard.writeText(getShoppingListText()).then(() => {
            showToast("Lista copiata negli appunti! 📋");
        });
    });
}

if (btnWhatsAppShoppingList) {
    btnWhatsAppShoppingList.addEventListener('click', () => {
        if (shoppingListRecipeIds.size === 0) {
            showToast('La lista della spesa è vuota! 🛒');
            return;
        }
        const text = getShoppingListText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    });
}

function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==========================================
// Modals Management
// ==========================================
btnNewRecipe.addEventListener('click', () => {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = "Aggiungi Ricetta";
    recipeForm.reset();
    fotoPath.value = '';
    imagePreview.innerHTML = '<span class="preview-text">Clicca per caricare una foto</span>';
    previousEditPortions = parseInt(document.getElementById('recipePortions').value) || 1;
    recipeModal.classList.add('active');
});

btnCloseModal.addEventListener('click', () => {
    recipeModal.classList.remove('active');
});

btnCloseView.addEventListener('click', () => {
    viewModal.classList.remove('active');
});

if(btnBackRecipe) {
    btnBackRecipe.addEventListener('click', () => {
        viewModal.classList.remove('active');
    });
}

if(btnPrintRecipe) {
    btnPrintRecipe.addEventListener('click', () => {
        window.print();
    });
}

if(btnRandomRecipe) {
    btnRandomRecipe.addEventListener('click', () => {
        if (allRecipes.length === 0) {
            alert("Aggiungi qualche ricetta prima di tentare la fortuna!");
            return;
        }
        const randomIndex = Math.floor(Math.random() * allRecipes.length);
        const randomRecipe = allRecipes[randomIndex];
        openViewModal(randomRecipe);
    });
}

// Image Upload
imagePreview.addEventListener('click', () => fotoInput.click());

fotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    imagePreview.innerHTML = '<span class="preview-text">Caricamento...</span>';
    
    const formData = new FormData();
    formData.append('foto', file);
    
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.path) {
            fotoPath.value = '/' + data.path; // Absolute path for rendering
            imagePreview.innerHTML = `<img src="${fotoPath.value}" alt="Preview">`;
        }
    } catch(err) {
        alert('Errore caricamento foto');
        imagePreview.innerHTML = '<span class="preview-text">Riprova</span>';
    }
});

// Save Recipe
recipeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newRecipe = {
        id: currentEditId || Date.now().toString(),
        titolo: document.getElementById('titolo').value,
        categoria: document.getElementById('categoria').value,
        origine: document.getElementById('origine').value,
        tempo: document.getElementById('recipeTime').value,
        tempo_cottura: document.getElementById('recipeCookTime').value,
        porzioni: document.getElementById('recipePortions').value,
        difficolta: document.getElementById('recipeDifficulty').value,
        costo: document.getElementById('recipeCost').value,
        metodo_cottura: document.getElementById('recipeMethod').value,
        stagionalita: document.getElementById('recipeSeason').value,
        cucina: document.getElementById('recipeCuisine').value,
        ingredienti: document.getElementById('ingredienti').value,
        procedimento: document.getElementById('procedimento').value,
        note: document.getElementById('note').value,
        foto: fotoPath.value
    };

    if (currentEditId) {
        const index = allRecipes.findIndex(r => r.id === currentEditId);
        if (index !== -1) allRecipes[index] = newRecipe;
    } else {
        allRecipes.unshift(newRecipe); // Aggiungi in cima
    }

    try {
        await fetch('/api/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allRecipes)
        });
        localStorage.removeItem('ricette_sync_pending');
        localStorage.setItem('allRecipes_cache', JSON.stringify(allRecipes));
        recipeModal.classList.remove('active');
        renderRecipes();
    } catch (e) {
        // Fallback Offline: memorizza localmente e marca come in sospeso
        localStorage.setItem('allRecipes_cache', JSON.stringify(allRecipes));
        localStorage.setItem('ricette_sync_pending', 'true');
        recipeModal.classList.remove('active');
        renderRecipes();
        alert("Sei offline. Ricetta salvata sul telefono: verrà sincronizzata con il PC appena ti riconnetti al Wi-Fi!");
    }
});

// View Recipe
let currentRecipeId = null;
let currentBasePortions = 1;
let currentDisplayedPortions = 1;

function openViewModal(recipe) {
    currentRecipeId = recipe.id;
    currentBasePortions = parseInt(recipe.porzioni) || 1;
    currentDisplayedPortions = currentBasePortions;

    document.getElementById('viewImage').src = recipe.foto || 'https://via.placeholder.com/800x400?text=Nessuna+Foto';
    
    // Mostriamo sia l'origine che la categoria nella badge
    const originText = recipe.origine || 'Non specificata';
    
    document.getElementById('viewCategory').textContent = `🏷️ ${originText} | ${recipe.categoria}`;
    document.getElementById('viewTitle').textContent = recipe.titolo;
    
    // Costruisci Info Bar
    const infoBarHTML = `
        <div class="info-item">
            <span class="info-icon">👨‍🍳</span>
            <div class="info-text"><strong>Difficoltà</strong><br>${recipe.difficolta || 'Media'}</div>
        </div>
        <div class="info-item">
            <span class="info-icon">⏱️</span>
            <div class="info-text"><strong>Tempo prep.</strong><br>${recipe.tempo || '-'}m</div>
        </div>
        <div class="info-item">
            <span class="info-icon">🥘</span>
            <div class="info-text"><strong>Tempo cottura</strong><br>${recipe.tempo_cottura || '-'}m</div>
        </div>
        <div class="info-item">
            <span class="info-icon">👥</span>
            <div class="info-text">
                <strong>Porzioni</strong><br>
                <div class="portion-controls">
                    <button class="btn-portion" data-html2canvas-ignore="true" onclick="changePortions(-1, event)">-</button>
                    <span id="viewPortionsValue" style="display:inline-block; width: 20px; text-align: center; font-weight: bold;">${currentDisplayedPortions}</span>
                    <button class="btn-portion" data-html2canvas-ignore="true" onclick="changePortions(1, event)">+</button>
                </div>
            </div>
        </div>
        <div class="info-item">
            <span class="info-icon">💶</span>
            <div class="info-text"><strong>Costo</strong><br>${recipe.costo || 'Medio'}</div>
        </div>
        <div class="info-item">
            <span class="info-icon">🍳</span>
            <div class="info-text"><strong>Metodo di cottura</strong><br>${recipe.metodo_cottura || '-'}</div>
        </div>
        <div class="info-item">
            <span class="info-icon">📅</span>
            <div class="info-text"><strong>Stagionalità</strong><br>${recipe.stagionalita || '-'}</div>
        </div>
        <div class="info-item">
            <span class="info-icon">🏳️</span>
            <div class="info-text"><strong>Cucina</strong><br>${recipe.cucina || '-'}</div>
        </div>
    `;
    document.getElementById('viewInfoDetails').innerHTML = infoBarHTML;
    
    // Render Ingredienti con base 1 (nessun moltiplicatore ancora)
    renderIngredientsForView();

    // Procedimento (lista con frecce rosse)
    const procDiv = document.getElementById('viewInstructionsText');
    procDiv.innerHTML = '';
    const procArray = recipe.procedimento.split('\n').filter(p => p.trim() !== '');
    if (procArray.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'proc-list';
        procArray.forEach(p => {
            const li = document.createElement('li');
            
            // Regex per trovare i tempi (es. 45 minuti, 1 ora)
            let formattedText = p.replace(/(\d+(?:[.,]\d+)?)\s*(minuti|minuto|min|ore|ora|secondi|secondo)\b/gi, (match, num, unit) => {
                return `<button class="magic-timer-btn" onclick="startMagicTimer(${num.replace(',', '.')}, '${unit.toLowerCase()}')" title="Avvia Timer">⏱️ ${match}</button>`;
            });

            li.innerHTML = `<span class="proc-arrow">➔</span> ${formattedText}`;
            ul.appendChild(li);
        });
        procDiv.appendChild(ul);
    }
    
    const notesContainer = document.getElementById('viewNotesContainer');
    if (recipe.note && recipe.note.trim() !== '') {
        notesContainer.style.display = 'block';
        document.getElementById('viewNotesText').textContent = recipe.note;
    } else {
        notesContainer.style.display = 'none';
    }

    viewModal.classList.add('active');
}

// Ricalcolo Porzioni e Render Ingredienti
window.changePortions = function(delta, event) {
    if(event) event.stopPropagation();
    if (currentDisplayedPortions + delta < 1) return; // Minimo 1 porzione
    
    currentDisplayedPortions += delta;
    document.getElementById('viewPortionsValue').textContent = currentDisplayedPortions;
    
    renderIngredientsForView();
};

function renderIngredientsForView() {
    const recipe = allRecipes.find(r => r.id === currentRecipeId);
    if (!recipe) return;

    const ingList = document.getElementById('viewIngredientsList');
    ingList.innerHTML = '';
    
    const multiplier = currentDisplayedPortions / currentBasePortions;
    const ingredientsArray = recipe.ingredienti.split('\n').filter(i => i.trim() !== '');
    
    ingredientsArray.forEach(ing => {
        let textToDisplay = ing;
        
        if (multiplier !== 1) {
            const match = ing.trim().match(/^([^0-9]*)(\d+(?:[.,]\d+)?)(.*)$/);
            if (match) {
                let numStr = match[2].replace(',', '.'); 
                let num = parseFloat(numStr);
                let newNum = num * multiplier;
                
                let newNumStr = newNum % 1 === 0 ? newNum.toString() : newNum.toFixed(1).replace('.', ',');
                
                textToDisplay = match[1] + newNumStr + match[3];
            }
        }
        
        const li = document.createElement('li');
        li.textContent = textToDisplay;
        ingList.appendChild(li);
    });
}

// Edit Recipe
btnEditRecipe.addEventListener('click', () => {
    const recipeToEdit = allRecipes.find(r => r.id === currentRecipeId);
    if (!recipeToEdit) return;

    viewModal.classList.remove('active');
    
    currentEditId = recipeToEdit.id;
    document.getElementById('modalTitle').textContent = "Modifica Ricetta";
    
    // Pre-fill form
    document.getElementById('titolo').value = recipeToEdit.titolo;
    document.getElementById('categoria').value = recipeToEdit.categoria;
    document.getElementById('origine').value = recipeToEdit.origine || 'Personale';
    document.getElementById('recipeTime').value = recipeToEdit.tempo || '';
    document.getElementById('recipeCookTime').value = recipeToEdit.tempo_cottura || '';
    document.getElementById('recipePortions').value = recipeToEdit.porzioni || '';
    document.getElementById('recipeDifficulty').value = recipeToEdit.difficolta || 'Media';
    document.getElementById('recipeCost').value = recipeToEdit.costo || 'Medio';
    document.getElementById('recipeMethod').value = recipeToEdit.metodo_cottura || '';
    document.getElementById('recipeSeason').value = recipeToEdit.stagionalita || '';
    document.getElementById('recipeCuisine').value = recipeToEdit.cucina || '';
    document.getElementById('ingredienti').value = recipeToEdit.ingredienti;
    document.getElementById('procedimento').value = recipeToEdit.procedimento;
    document.getElementById('note').value = recipeToEdit.note || '';
    fotoPath.value = recipeToEdit.foto || '';
    
    previousEditPortions = parseInt(recipeToEdit.porzioni) || 1;
    
    if (recipeToEdit.foto) {
        imagePreview.innerHTML = `<img src="${recipeToEdit.foto}" alt="Preview">`;
    } else {
        imagePreview.innerHTML = '<span class="preview-text">Clicca per caricare una foto</span>';
    }

    recipeModal.classList.add('active');
});

// Delete Recipe
btnDeleteRecipe.addEventListener('click', async () => {
    if (!confirm("Sei sicuro di voler eliminare per sempre questa ricetta?")) return;
    
    // Se c'è una foto, eliminala dal server
    const recipeToDelete = allRecipes.find(r => r.id === currentRecipeId);
    if (recipeToDelete && recipeToDelete.foto) {
        const filename = recipeToDelete.foto.split('/').pop();
        try { fetch(`/api/upload/${filename}`, { method: 'DELETE' }); } catch(e){}
    }

    allRecipes = allRecipes.filter(r => r.id !== currentRecipeId);
    
    try {
        await fetch('/api/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allRecipes)
        });
        viewModal.classList.remove('active');
        renderRecipes();
    } catch (e) {
        alert("Errore eliminazione");
    }
});

// Toggle Favorite
window.toggleFavorite = async function(id, event) {
    event.stopPropagation(); // Evita di aprire la modale della ricetta
    const recipe = allRecipes.find(r => r.id === id);
    if(recipe) {
        recipe.isFavorite = !recipe.isFavorite;
        
        try {
            await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allRecipes)
            });
            renderRecipes(); // Ricarica la griglia per aggiornare il cuore
        } catch (e) {
            console.error("Errore salvataggio preferito", e);
        }
    }
}

// Auto-update ingredients in edit modal when portions change
let previousEditPortions = 1;

document.getElementById('recipePortions').addEventListener('change', function(e) {
    let newPortions = parseInt(this.value);
    if (isNaN(newPortions) || newPortions < 1) return;
    if (previousEditPortions === newPortions) return;
    
    const textarea = document.getElementById('ingredienti');
    let text = textarea.value;
    
    if (text.trim() === '') {
        previousEditPortions = newPortions;
        return;
    }
    
    const multiplier = newPortions / previousEditPortions;
    
    const lines = text.split('\n');
    const newLines = lines.map(line => {
        // Find the first number in the line (e.g. "500", "1.5", "1,5")
        const match = line.match(/^([^0-9]*)(\d+(?:[.,]\d+)?)(.*)$/);
        if (match) {
            let numStr = match[2].replace(',', '.');
            let num = parseFloat(numStr);
            let newNum = num * multiplier;
            // Format to 1 decimal place if not integer
            let newNumStr = newNum % 1 === 0 ? newNum.toString() : newNum.toFixed(1).replace('.', ',');
            return match[1] + newNumStr + match[3];
        }
        return line;
    });
    
    textarea.value = newLines.join('\n');
    previousEditPortions = newPortions;
});

// Intercept + and - buttons to trigger change event
document.querySelectorAll('.btn-num-control').forEach(btn => {
    btn.addEventListener('click', function(e) {
        // Small delay to allow stepUp/stepDown to update the value
        setTimeout(() => {
            const input = this.parentNode.querySelector('input[type=number]');
            if(input.id === 'recipePortions') {
                input.dispatchEvent(new Event('change'));
            }
        }, 10);
    });
});

// Init
loadRecipes();

// ==========================================
// FOCUS MODE LOGIC
// ==========================================
const btnFocusMode = document.getElementById('btnFocusMode');
const focusModal = document.getElementById('focusModal');
const btnCloseFocus = document.getElementById('btnCloseFocus');

btnFocusMode.addEventListener('click', () => {
    const recipe = allRecipes.find(r => r.id === currentRecipeId);
    if(!recipe) return;
    
    document.getElementById('focusTitle').textContent = recipe.titolo;
    
    const ingredientsArray = recipe.ingredienti.split('\n').filter(i => i.trim() !== '');
    const multiplier = currentDisplayedPortions / currentBasePortions;
    
    let ingHtml = '';
    ingredientsArray.forEach(ing => {
        let textToDisplay = ing;
        if (multiplier !== 1) {
            const match = ing.trim().match(/^([^0-9]*)(\d+(?:[.,]\d+)?)(.*)$/);
            if (match) {
                let numStr = match[2].replace(',', '.'); 
                let num = parseFloat(numStr);
                let newNum = num * multiplier;
                let newNumStr = newNum % 1 === 0 ? newNum.toString() : newNum.toFixed(1).replace('.', ',');
                textToDisplay = match[1] + newNumStr + match[3];
            }
        }
        ingHtml += `<li>${textToDisplay}</li>`;
    });
    document.getElementById('focusIngredientsList').innerHTML = ingHtml;
    
    // Procedimento Step-by-Step
    let stepsArray = recipe.procedimento.split('\n').filter(p => p.trim() !== '');
    if (stepsArray.length === 1) {
        // Se c'è un solo enorme blocco di testo, proviamo a dividerlo per punti.
        stepsArray = recipe.procedimento.split(/(?<=\.)\s+/).filter(p => p.trim() !== '');
    }
    focusStepsArray = stepsArray;
    currentFocusStep = 0;
    
    renderFocusStep();
    
    // Aggiorna le statistiche quando si cucina
    if (typeof trackCookedRecipe === 'function') {
        trackCookedRecipe(recipe);
    }
    
    focusModal.classList.add('active');
});

let focusStepsArray = [];
let currentFocusStep = 0;

function renderFocusStep() {
    if (focusStepsArray.length === 0) {
        document.getElementById('focusCurrentStepText').innerHTML = "Nessun procedimento inserito.";
        document.getElementById('focusStepCounter').textContent = "-";
        return;
    }
    
    const p = focusStepsArray[currentFocusStep];
    // Cerca pattern come "15 minuti" o "30 min" e crea un timer cliccabile
    const pWithTimers = p.replace(/(\d+(?:[.,]\d+)?)\s*(minuti|minuto|min)\b/gi, (match, num) => {
        return `<span class="smart-timer" onclick="startSmartTimer(${num.replace(',', '.')}, event)">⏱️ ${match}</span>`;
    });
    
    // Riproduce l'animazione forzando un reflow
    const stepTextEl = document.getElementById('focusCurrentStepText');
    stepTextEl.style.animation = 'none';
    stepTextEl.offsetHeight; // trigger reflow
    stepTextEl.style.animation = null; 
    
    // Riduce la dimensione del testo se il passaggio è molto lungo
    if (p.length > 250) {
        stepTextEl.style.fontSize = '1.8rem';
    } else if (p.length > 120) {
        stepTextEl.style.fontSize = '2.5rem';
    } else {
        stepTextEl.style.fontSize = '3.5rem';
    }
    
    stepTextEl.innerHTML = pWithTimers;
    
    document.getElementById('focusStepCounter').textContent = `Passo ${currentFocusStep + 1} di ${focusStepsArray.length}`;
    
    document.getElementById('btnFocusPrev').disabled = (currentFocusStep === 0);
    document.getElementById('btnFocusNext').disabled = (currentFocusStep === focusStepsArray.length - 1);
}

document.getElementById('btnFocusNext').addEventListener('click', () => {
    if (currentFocusStep < focusStepsArray.length - 1) {
        currentFocusStep++;
        renderFocusStep();
    }
});

document.getElementById('btnFocusPrev').addEventListener('click', () => {
    if (currentFocusStep > 0) {
        currentFocusStep--;
        renderFocusStep();
    }
});

const btnReadAloud = document.getElementById('btnReadAloud');
if (btnReadAloud) {
    btnReadAloud.addEventListener('click', () => {
        if ('speechSynthesis' in window && focusStepsArray.length > 0) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(focusStepsArray[currentFocusStep]);
            utterance.lang = 'it-IT';
            window.speechSynthesis.speak(utterance);
        } else {
            showToast("Il tuo browser non supporta la sintesi vocale.");
        }
    });
}

// Timer Logic
window.startSmartTimer = function(minutes, event) {
    if(event) event.stopPropagation();
    
    const container = document.getElementById('activeTimersContainer');
    const timerId = 'timer_' + Date.now();
    let secondsLeft = minutes * 60;
    
    const timerDiv = document.createElement('div');
    timerDiv.className = 'active-timer';
    timerDiv.id = timerId;
    timerDiv.innerHTML = `
        <span class="timer-time" id="time_${timerId}">${formatTime(secondsLeft)}</span>
        <button class="timer-close" onclick="stopSmartTimer('${timerId}')">&times;</button>
    `;
    container.appendChild(timerDiv);
    
    const interval = setInterval(() => {
        secondsLeft--;
        const timeSpan = document.getElementById(`time_${timerId}`);
        if(timeSpan) {
            timeSpan.textContent = formatTime(secondsLeft);
        }
        
        if (secondsLeft <= 0) {
            clearInterval(interval);
            timerDiv.style.background = '#4CAF50';
            timerDiv.style.color = 'white';
            timerDiv.innerHTML = `<span>Tempo Scaduto! 🛎️</span> <button class="timer-close" onclick="stopSmartTimer('${timerId}')">&times;</button>`;
            showToast(`Il timer da ${minutes} minuti è scaduto! 🛎️`);
        }
    }, 1000);
    
    timerDiv.dataset.intervalId = interval;
}

window.stopSmartTimer = function(timerId) {
    const timerDiv = document.getElementById(timerId);
    if(timerDiv) {
        clearInterval(timerDiv.dataset.intervalId);
        timerDiv.remove();
    }
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

btnCloseFocus.addEventListener('click', () => {
    focusModal.classList.remove('active');
    if(window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    const btnReadAloud = document.getElementById('btnReadAloud');
    if(btnReadAloud) btnReadAloud.innerHTML = '🗣️ Leggi Ricetta';
});

// ==========================================
// PLANNER LOGIC
// ==========================================
let currentPlanRecipeId = null;
const assignDayModal = document.getElementById('assignDayModal');
const assignDaySelect = document.getElementById('assignDaySelect');
const btnOpenPlanner = document.getElementById('btnOpenPlanner');
const plannerModal = document.getElementById('plannerModal');
const btnClosePlanner = document.getElementById('btnClosePlanner');
const btnPlannerToShopping = document.getElementById('btnPlannerToShopping');

window.openAssignDayModal = function(id, event) {
    event.stopPropagation();
    currentPlanRecipeId = id;
    assignDayModal.classList.add('active');
}

document.getElementById('btnConfirmAssignDay').addEventListener('click', () => {
    const day = assignDaySelect.value;
    if(currentPlanRecipeId) {
        mealPlan[day].push(currentPlanRecipeId);
        localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
        showToast("Aggiunta al menu settimanale! 📅");
    }
    assignDayModal.classList.remove('active');
});

document.getElementById('btnCancelAssignDay').addEventListener('click', () => {
    assignDayModal.classList.remove('active');
});

btnOpenPlanner.addEventListener('click', () => {
    renderPlanner();
    plannerModal.classList.add('active');
});

btnClosePlanner.addEventListener('click', () => {
    plannerModal.classList.remove('active');
});

window.removePlanRecipe = function(day, index) {
    mealPlan[day].splice(index, 1);
    localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
    renderPlanner();
}

window.openPlannerRecipe = function(id) {
    const r = allRecipes.find(rec => rec.id === id);
    if (r) {
        document.getElementById('plannerModal').classList.remove('active');
        openViewModal(r);
    }
}

function renderPlanner() {
    const grid = document.getElementById('plannerGrid');
    grid.innerHTML = '';
    const days = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
    
    days.forEach(day => {
        const col = document.createElement('div');
        col.className = 'planner-day';
        col.innerHTML = `<h4>${day}</h4>`;
        
        if(mealPlan[day].length === 0) {
            col.innerHTML += `<p style="text-align:center; color:#999; font-size: 0.9rem; margin-top: 1rem;">Vuoto</p>`;
        } else {
            mealPlan[day].forEach((id, index) => {
                const recipe = allRecipes.find(r => r.id === id);
                if(recipe) {
                    col.innerHTML += `
                        <div class="planner-recipe" onclick="openPlannerRecipe('${recipe.id}')" style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#fdfbf7'" onmouseout="this.style.background='white'">
                            <span class="planner-recipe-title">${recipe.titolo}</span>
                            <button class="planner-recipe-del" onclick="event.stopPropagation(); removePlanRecipe('${day}', ${index})" title="Rimuovi">×</button>
                        </div>
                    `;
                }
            });
        }
        grid.appendChild(col);
    });
}

btnPlannerToShopping.addEventListener('click', () => {
    let count = 0;
    for(let day in mealPlan) {
        mealPlan[day].forEach(id => {
            shoppingListRecipeIds.add(id);
            count++;
            // Track in stats
            const r = allRecipes.find(x => x.id === id);
            if(r) trackCookedRecipe(r);
        });
    }
    if (count > 0) {
        updateFAB();
        renderRecipes();
        plannerModal.classList.remove('active');
        generateShoppingList();
        document.getElementById('shoppingModal').classList.add('active');
        showToast("Ricette importate nella Spesa! 🛒");
    } else {
        alert("Il menu settimanale è vuoto!");
    }
});

// ==========================================
// STATS LOGIC
// ==========================================
function trackCookedRecipe(recipe) {
    recipeStats.totalCooked++;
    
    if(!recipeStats.recipes[recipe.id]) {
        recipeStats.recipes[recipe.id] = 0;
    }
    recipeStats.recipes[recipe.id]++;
    
    const cat = recipe.categoria;
    if(!recipeStats.categories[cat]) {
        recipeStats.categories[cat] = 0;
    }
    recipeStats.categories[cat]++;
    
    localStorage.setItem('recipeStats', JSON.stringify(recipeStats));
}

const btnOpenStats = document.getElementById('btnOpenStats');
const statsModal = document.getElementById('statsModal');
const btnCloseStats = document.getElementById('btnCloseStats');

if(btnOpenStats) {
    btnOpenStats.addEventListener('click', () => {
        document.getElementById('statTotalCooked').textContent = recipeStats.totalCooked;
        
        let topCat = "-";
        let maxCat = 0;
        for(let c in recipeStats.categories) {
            if(recipeStats.categories[c] > maxCat) {
                maxCat = recipeStats.categories[c];
                topCat = c;
            }
        }
        document.getElementById('statFavCategory').textContent = topCat;
        
        let recipesArray = [];
        for(let id in recipeStats.recipes) {
            recipesArray.push({id: id, count: recipeStats.recipes[id]});
        }
        recipesArray.sort((a,b) => b.count - a.count);
        
        const topList = document.getElementById('statTopRecipes');
        topList.innerHTML = '';
        
        if(recipesArray.length === 0) {
            topList.innerHTML = '<li>Ancora nessuna ricetta cucinata!</li>';
        } else {
            recipesArray.slice(0,3).forEach((item, index) => {
                const r = allRecipes.find(x => x.id === item.id);
                const title = r ? r.titolo : "Ricetta Eliminata";
                const medals = ['🥇', '🥈', '🥉'];
                topList.innerHTML += `<li>${medals[index] || ''} <b>${title}</b> (${item.count} volte)</li>`;
            });
        }
        
        statsModal.classList.add('active');
    });
}

if(btnCloseStats) {
    btnCloseStats.addEventListener('click', () => {
        statsModal.classList.remove('active');
    });
}

// ==========================================
// TEMA SCURO (DARK MODE)
// ==========================================
const btnToggleTheme = document.getElementById('btnToggleTheme');
if(btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        if(document.documentElement.classList.contains('dark-mode')){
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
}


// ==========================================
// COMANDI DA TASTIERA (SHORTCUTS)
// ==========================================
document.addEventListener('keydown', (e) => {
    // Disabilita le scorciatoie se l'utente sta scrivendo nella barra di ricerca o form
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // ALT + D => Tema Scuro (Dark Mode)
    if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const btn = document.getElementById('btnToggleTheme');
        if (btn) btn.click();
        showToast("Scorciatoia: Tema Scuro attivato/disattivato");
    }
    
    // ALT + F => Cucina Ora (Focus Mode)
    if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const btn = document.getElementById('btnFocusMode');
        const viewModal = document.getElementById('viewModal');
        if (btn && viewModal && viewModal.classList.contains('active')) {
            btn.click();
        }
    }
    
    // ALT + V => Chef Parlante (Voce)
    if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const btn = document.getElementById('btnReadAloud');
        // Controlla se il modale Focus Mode è aperto (quindi se il bottone è visibile)
        const focusModal = document.getElementById('focusModal');
        if (btn && focusModal && focusModal.classList.contains('active')) {
            btn.click();
            showToast("Scorciatoia: Lettore Vocale");
        } else {
            showToast("Apri una ricetta in 'CUCINA ORA' per usare il Lettore (ALT + V)");
        }
    }
    
    // ALT + C => Cartolina (Capture)
    if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const btn = document.getElementById('btnShareInstagram');
        const viewModal = document.getElementById('viewModal');
        // Assicuriamoci che siamo nella schermata della ricetta
        if (btn && viewModal && viewModal.classList.contains('active')) {
            btn.click();
        } else {
            showToast("Apri una ricetta per poter creare una Cartolina (ALT + C)");
        }
    }
});

// ===== MAGIC TIMERS =====
let activeTimer = null;
const floatingTimer = document.getElementById('floatingTimer');
const timerDisplay = document.getElementById('timerDisplay');
const timerClose = document.getElementById('timerClose');
const btnStopTimer = document.getElementById('btnStopTimer');
let timerAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Suono di allarme

window.startMagicTimer = function(value, unit) {
    if (activeTimer) clearInterval(activeTimer);
    
    let totalSeconds = 0;
    if (unit.startsWith('min')) totalSeconds = value * 60;
    else if (unit.startsWith('or')) totalSeconds = value * 3600;
    else if (unit.startsWith('sec')) totalSeconds = value;
    
    if (floatingTimer) floatingTimer.classList.add('active');
    if (btnStopTimer) btnStopTimer.style.display = 'none';
    
    function updateDisplay() {
        if (totalSeconds <= 0) {
            clearInterval(activeTimer);
            if(timerDisplay) timerDisplay.innerText = "PRONTO!";
            if(timerDisplay) timerDisplay.style.color = "#e74c3c";
            if(btnStopTimer) btnStopTimer.style.display = 'block';
            timerAudio.loop = true;
            timerAudio.play().catch(e=>console.log("Audio play failed",e));
            return;
        }
        if(timerDisplay) timerDisplay.style.color = "var(--primary)";
        let h = Math.floor(totalSeconds / 3600);
        let m = Math.floor((totalSeconds % 3600) / 60);
        let s = Math.floor(totalSeconds % 60);
        
        if (h > 0) {
            if(timerDisplay) timerDisplay.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } else {
            if(timerDisplay) timerDisplay.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        totalSeconds--;
    }
    
    updateDisplay();
    activeTimer = setInterval(updateDisplay, 1000);
};

if(timerClose) timerClose.addEventListener('click', () => {
    if (activeTimer) clearInterval(activeTimer);
    floatingTimer.classList.remove('active');
    timerAudio.pause();
    timerAudio.currentTime = 0;
});

if(btnStopTimer) btnStopTimer.addEventListener('click', () => {
    timerAudio.pause();
    timerAudio.currentTime = 0;
    btnStopTimer.style.display = 'none';
    timerDisplay.innerText = "00:00";
    setTimeout(() => floatingTimer.classList.remove('active'), 1000);
});

// Collega Metti nel Carrello da Scheda Ricetta
const btnAddToShopping = document.getElementById('btnAddToShopping');
if (btnAddToShopping) {
    btnAddToShopping.addEventListener('click', () => {
        const recipe = allRecipes.find(r => r.id === currentRecipeId);
        if (!recipe) return;
        shoppingListRecipeIds.add(recipe.id);
        updateFAB();
        renderRecipes();
        showToast(`"${recipe.titolo}" aggiunta alla spesa! 🛒`);
    });
}

// Renderizza al caricamento
renderRecipes();

// ==========================================
// INSTAGRAM POSTCARD EXPORT
// ==========================================
const btnShareInstagram = document.getElementById('btnShareInstagram');
if (btnShareInstagram) {
    btnShareInstagram.addEventListener('click', () => {
        const recipe = allRecipes.find(r => r.id === currentRecipeId);
        if (!recipe) return;
        
        // Populate template
        document.getElementById('postcardTitle').textContent = recipe.titolo;
        document.getElementById('postcardCategory').textContent = recipe.categoria || 'Speciale';
        
        // Handle Image
        const imgEl = document.getElementById('postcardImage');
        if (recipe.immagine && recipe.immagine.startsWith('data:image')) {
            imgEl.src = recipe.immagine;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
        
        // Genera canvas
        const template = document.getElementById('postcardTemplate');
        
        // Temporaneamente lo rendiamo visibile ma off-screen
        template.style.left = '0';
        template.style.top = '0';
        template.style.zIndex = '-9999';
        
        showToast("Creazione cartolina in corso... 📸");
        
        // Assicurati che html2canvas sia caricato
        if (typeof html2canvas !== 'undefined') {
            html2canvas(template, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#fdfbf7' 
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Ricetta_${recipe.titolo.replace(/\s+/g, '_')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                // Nascondi di nuovo
                template.style.left = '-9999px';
                showToast("Cartolina creata con successo! 🎉");
            });
        } else {
            alert("Libreria html2canvas non trovata. Ricarica la pagina.");
        }
    });
}
