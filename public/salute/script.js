
/* AUTO-CLEANUP PESATA ERRATA 79.9 */
(function cleanupErroneousWeightMariaCarmela() {
    try {
        const k = 'weightLog_moglie';
        const local = localStorage.getItem(k);
        if (local && (local.includes('79.9') || local.includes('2026-10-23'))) {
            let arr = JSON.parse(local);
            if (Array.isArray(arr)) {
                const clean = arr.filter(item => !(item && item.date === '2026-10-23' && Math.abs(item.weight - 79.9) < 0.2));
                if (clean.length !== arr.length) {
                    localStorage.setItem(k, JSON.stringify(clean));
                    const delKey = 'deletedWeights_moglie';
                    const delList = JSON.parse(localStorage.getItem(delKey) || '[]');
                    if (!delList.includes('2026-10-23')) delList.push('2026-10-23');
                    localStorage.setItem(delKey, JSON.stringify(delList));
                    if (typeof window.syncSaluteToCloud === 'function') {
                        window.syncSaluteToCloud({
                            [k]: JSON.stringify(clean),
                            _forceWeightLog: true,
                            _deletedWeights: [{ profile: 'moglie', date: '2026-10-23' }]
                        });
                    }
                    console.log('[Salute] Pesata errata 79.9 del 23/10 rimossa dal localStorage locale.');
                }
            }
        }
    } catch (e) { }
})();
// ---- BEVERAGES (Water & Coffee) CON CALCOLATORE SU MISURA ----
window.getPersonalizedWaterTarget = function (profile) {
    let weight = 75;
    let weightInput = document.getElementById('weight-' + profile);
    let startEl = document.getElementById('start_' + profile);
    if (weightInput && !isNaN(parseFloat(weightInput.value)) && parseFloat(weightInput.value) > 0) {
        weight = parseFloat(weightInput.value);
    } else if (startEl && !isNaN(parseFloat(startEl.innerText)) && parseFloat(startEl.innerText) > 0) {
        weight = parseFloat(startEl.innerText);
    }

    // Formula idrica medica raccomandata: 35ml per kg di peso corporeo
    let targetMl = Math.round(weight * 35);
    let targetGlasses = Math.max(6, Math.min(16, Math.round(targetMl / 250)));
    return {
        weight: weight,
        targetMl: targetMl,
        liters: (targetMl / 1000).toFixed(1),
        glasses: targetGlasses
    };
};

function initBeverage(profile, type, max) {
    const container = document.getElementById(type + '-' + profile);
    if (!container) return;

    let totalMax = max || 8;
    if (type === 'water') {
        let pWater = getPersonalizedWaterTarget(profile);
        totalMax = pWater.glasses;

        // Aggiorna target badge
        let targetEl = document.getElementById('water_target_' + profile);
        if (targetEl) {
            targetEl.innerHTML = '🎯 Obiettivo su peso (' + pWater.weight + 'kg): <strong>' + pWater.liters + 'L</strong> (' + totalMax + ' bicchieri)';
        }
    } else if (type === 'coffee') {
        totalMax = 4;
    }

    const todayIso = new Date().toISOString().split('T')[0];
    const dateKey = type + '_date_' + profile;
    const lastDate = localStorage.getItem(dateKey);
    if (lastDate && lastDate !== todayIso) {
        localStorage.setItem(type + 'Count_' + profile, 0);
        localStorage.setItem(dateKey, todayIso);
    } else if (!lastDate) {
        localStorage.setItem(dateKey, todayIso);
    }

    const key = type + 'Count_' + profile;
    let count = parseInt(localStorage.getItem(key)) || 0;
    if (count > totalMax) count = totalMax;

    container.innerHTML = '';
    const icon = type === 'water' ? '🥛' : '☕';

    for (let i = 0; i < totalMax; i++) {
        const glass = document.createElement('span');
        glass.innerHTML = icon;
        glass.className = 'glass ' + (i < count ? 'full' : '');
        glass.onclick = () => toggleBeverage(profile, type, i, totalMax);
        container.appendChild(glass);
    }

    // Aggiorna stato testuale
    if (type === 'water') {
        let statusEl = document.getElementById('water_status_' + profile);
        if (statusEl) {
            let percent = Math.min(100, Math.round((count / totalMax) * 100));
            if (count >= totalMax) {
                statusEl.innerHTML = '🏆 100% Raggiunto! (' + (count * 0.25).toFixed(1) + 'L)';
                statusEl.style.color = '#2e7d32';
            } else {
                statusEl.innerHTML = count + '/' + totalMax + ' bicchieri (' + (count * 0.25).toFixed(1) + 'L - ' + percent + '%)';
                statusEl.style.color = '#1565c0';
            }
        }
    }
}

function toggleBeverage(profile, type, index, max) {
    const key = type + 'Count_' + profile;
    let count = parseInt(localStorage.getItem(key)) || 0;

    if (index === count - 1) {
        count--;
    } else {
        count = index + 1;
    }

    if (count < 0) count = 0;
    if (count > max) count = max;
    const todayIso = new Date().toISOString().split('T')[0];
    localStorage.setItem(type + '_date_' + profile, todayIso);
    localStorage.setItem(key, count);
    initBeverage(profile, type, max);
    if (typeof scheduleSyncToCloud === 'function') scheduleSyncToCloud(500);
}

window.updateBeverage = function (profile, type, delta) {
    let max = 8;
    if (type === 'water') {
        max = getPersonalizedWaterTarget(profile).glasses;
    } else if (type === 'coffee') {
        max = 4;
    }

    const key = type + 'Count_' + profile;
    let count = parseInt(localStorage.getItem(key)) || 0;
    count += delta;
    if (count < 0) count = 0;
    if (count > max) count = max;

    const todayIso = new Date().toISOString().split('T')[0];
    localStorage.setItem(type + '_date_' + profile, todayIso);
    localStorage.setItem(key, count);
    initBeverage(profile, type, max);
    if (typeof scheduleSyncToCloud === 'function') scheduleSyncToCloud(500);

    if (type === 'water' && count === max) {
        if (typeof showToast === 'function') showToast("🎉 Fantastico! Hai raggiunto il tuo fabbisogno d'acqua ideale di oggi!");
    }
};

function resetWater(profile) {
    localStorage.setItem('waterCount_' + profile, 0);
    initBeverage(profile, 'water');
}
function resetCoffee(profile) {
    localStorage.setItem('coffeeCount_' + profile, 0);
    initBeverage(profile, 'coffee', 4);
}

// ---- MOOD TRACKER ----
function setMood(profile, moodValue) {
    const today = new Date().toISOString().split('T')[0];
    const key = `moodLog_${profile}`;
    let log = JSON.parse(localStorage.getItem(key)) || {};
    log[today] = moodValue;
    localStorage.setItem(key, JSON.stringify(log));
    document.getElementById(`current-mood-${profile}`).innerText = `Salvato: ${moodValue}`;
    document.getElementById(`clear-mood-${profile}`).style.display = 'inline';
}

function loadMood(profile) {
    const today = new Date().toISOString().split('T')[0];
    const log = JSON.parse(localStorage.getItem(`moodLog_${profile}`)) || {};
    if (log[today]) {
        document.getElementById(`current-mood-${profile}`).innerText = `Salvato: ${log[today]}`;
        document.getElementById(`clear-mood-${profile}`).style.display = 'inline';
    }
}

function clearMood(profile) {
    const today = new Date().toISOString().split('T')[0];
    const key = `moodLog_${profile}`;
    let log = JSON.parse(localStorage.getItem(key)) || {};
    delete log[today];
    localStorage.setItem(key, JSON.stringify(log));
    document.getElementById(`current-mood-${profile}`).innerText = '';
    document.getElementById(`clear-mood-${profile}`).style.display = 'none';
}

// ---- ANIMAZIONE BILANCIA SLOT MACHINE ----
function triggerScale(profile) {
    const input = document.getElementById('weight-' + profile);
    const newWeight = parseFloat(input.value);

    if (isNaN(newWeight) || newWeight <= 0) return showCustomAlert('Inserisci un peso valido!');

    const display = document.getElementById('scale-screen-' + profile);

    const duration = 1500;
    const interval = 50;
    const steps = duration / interval;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        let randomNum = (Math.random() * 20 + (newWeight - 10)).toFixed(1);
        display.innerHTML = randomNum + '<span class="scale-unit">kg</span>';

        if (step >= steps) {
            clearInterval(timer);
            display.innerHTML = newWeight.toFixed(1) + '<span class="scale-unit">kg</span>';

            display.style.textShadow = '0 0 40px #ffffff, 0 0 20px #ffffff';
            display.style.color = '#ffffff';

            setTimeout(() => {
                display.style.textShadow = '0 0 12px rgba(41, 182, 246, 0.9)';
                display.style.color = '#4fc3f7';
            }, 300);

            logWeight(profile, newWeight);
        }
    }, interval);
}

// ---- LOGICA DIARIO DEL PESO & MILESTONE ----
function logWeight(profile, newWeight) {
    const startWeight = parseFloat(document.getElementById('start_' + profile)?.innerText) || 80;
    const goalWeight = parseFloat(document.getElementById('goal_' + profile)?.innerText) || 65;

    const key = `weightLog_${profile}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];
    if (log.length === 0 && (profile === 'moglie' || profile === '1')) {
        log = JSON.parse(localStorage.getItem('weightLog_moglie') || localStorage.getItem('weightLog_1') || '[]');
    }
    const today = new Date().toISOString().split('T')[0];

    // Check per coriandoli
    let lastWeight = log.length > 0 ? log[log.length - 1].weight : startWeight;
    if (newWeight < lastWeight) {
        let lostKg = (lastWeight - newWeight).toFixed(1);
        fireConfetti();
        if (newWeight <= goalWeight) {
            showCelebrationBanner("🏆 OBIETTIVO RAGGIUNTO!", "Straordinario! Hai raggiunto il tuo peso ideale di " + goalWeight + " kg! Congratulazioni vivissime! 🎉🥳", true);
        } else {
            showCelebrationBanner("🎉 FANTASTICO RISULTATO!", "Sei sceso/a di ben <strong>-" + lostKg + " kg</strong> rispetto all'ultima pesata! Continua così! 💪🔥", false);
        }
    }

    const existingIndex = log.findIndex(entry => entry.date === today);
    if (existingIndex !== -1) log[existingIndex].weight = newWeight;
    else log.push({ date: today, weight: newWeight, timestamp: new Date().getTime() });

    log.sort((a, b) => a.timestamp - b.timestamp);
    localStorage.setItem(key, JSON.stringify(log));

    const isMaria = (profile === 'moglie' || profile === '1' || (typeof getProfileDisplayName === 'function' && getProfileDisplayName(profile).toLowerCase().includes('maria')));
    if (isMaria) {
        localStorage.setItem('weightLog_moglie', JSON.stringify(log));
        localStorage.setItem('weightLog_1', JSON.stringify(log));
    }

    updateProgressUI(profile, startWeight, newWeight, goalWeight);
    calculateStats(profile, newWeight, log);
    drawChart(profile, log, startWeight);
    updateBMI(profile, newWeight);
    if (typeof window.syncSaluteToCloud === "function") { window.syncSaluteToCloud({ [key]: JSON.stringify(log) }); }
    if (typeof window.syncSaluteToCloud === "function") {
        const payload = { [key]: JSON.stringify(log) };
        if (isMaria) {
            payload['weightLog_moglie'] = JSON.stringify(log);
            payload['weightLog_1'] = JSON.stringify(log);
        }
        window.syncSaluteToCloud(payload);
    }
}

function loadProgress(profile) {
    loadStats(profile);
    const startWeight = parseFloat(document.getElementById('start_' + profile)?.innerText) || 80;
    const goalWeight = parseFloat(document.getElementById('goal_' + profile)?.innerText) || 65;

    const key = `weightLog_${profile}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];
    if (log.length === 0 && (profile === 'moglie' || profile === '1')) {
        log = JSON.parse(localStorage.getItem('weightLog_moglie') || localStorage.getItem('weightLog_1') || '[]');
    }

    let currentWeight = startWeight;
    let lastDate = '';
    if (log.length > 0) {
        currentWeight = log[log.length - 1].weight;
        lastDate = log[log.length - 1].date;
        document.getElementById(`weight-${profile}`).value = currentWeight;
    }

    const display = document.getElementById(`scale-screen-${profile}`);
    if (display) {
        display.innerHTML = currentWeight.toFixed(1) + '<span class="scale-unit">kg</span>';
    }

    const dateEl = document.getElementById(`scale-date-${profile}`);
    if (dateEl) {
        if (lastDate) {
            const parts = lastDate.split('-');
            const formatted = (parts.length === 3) ? `${parts[2]}/${parts[1]}/${parts[0]}` : lastDate;
            dateEl.innerHTML = `📅 Rilevato il: <b style="color:#f8fafc;">${formatted}</b>`;
        } else {
            dateEl.innerHTML = '';
        }
    }

    updateProgressUI(profile, startWeight, currentWeight, goalWeight);
    calculateStats(profile, currentWeight, log);
    drawChart(profile, log, startWeight);
    updateBMI(profile, currentWeight);
}

function updateBMI(prefix, weight) {
    if (weight === undefined || isNaN(weight)) {
        let scaleScreen = document.getElementById('scale-screen-' + prefix);
        if (scaleScreen) weight = parseFloat(scaleScreen.innerText);
    }
    if (isNaN(weight) || weight <= 0) return;

    let height = 160;
    if (document.getElementById('height_' + prefix)) {
        height = parseFloat(document.getElementById('height_' + prefix).innerText) || 160;
    } else {
        let saved = localStorage.getItem('profileStats_' + prefix);
        if (saved) {
            let stats = JSON.parse(saved);
            if (stats.height) height = parseFloat(stats.height);
        }
    }
    let heightInMeters = height / 100;
    let bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
    let badge = document.getElementById(`bmi_${prefix}`);
    if (!badge) return;
    let text, color;
    if (bmi < 18.5) { text = "Sottopeso"; color = "#2196f3"; }
    else if (bmi < 25) { text = "Normopeso 😊"; color = "#4caf50"; }
    else if (bmi < 30) { text = "Sovrappeso 😦"; color = "#ff9800"; }
    else { text = "Obesità 😭"; color = "#f44336"; }
    badge.innerHTML = `BMI: <b>${bmi}</b> - ${text}`;
    badge.style.backgroundColor = color;
    badge.style.color = "white";
}

function updateProgressUI(profile, startWeight, currentWeight, goalWeight) {
    const bar = document.getElementById(`progress-bar-${profile}`);
    let totalToLose = startWeight - goalWeight;
    let lost = startWeight - currentWeight;
    let percentage = (lost / totalToLose) * 100;

    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    bar.style.width = `${percentage}%`;
    bar.innerHTML = `${Math.round(percentage)}%`;

    const milestoneElement = document.getElementById(`milestone-${profile}`);
    const tenPercent = startWeight * 0.10;
    if (lost >= tenPercent) {
        milestoneElement.innerHTML = `🎉 Traguardo Medico 10% Raggiunto!`;
    } else {
        milestoneElement.innerHTML = ``;
    }
}

function calculateStats(profile, currentWeight, log) {
    const statsBox = document.getElementById(`stats-${profile}`);
    if (log.length < 2) {
        statsBox.innerHTML = `<div>Inserisci più pesate nei prossimi giorni per vedere le statistiche!</div>`;
        return;
    }

    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    let weight7d = getWeightNearTime(log, now - (7 * dayMs));
    let weight30d = getWeightNearTime(log, now - (30 * dayMs));
    let firstWeight = log[0].weight;

    let lostWeek = weight7d ? (weight7d - currentWeight).toFixed(1) : 0;
    let lostMonth = weight30d ? (weight30d - currentWeight).toFixed(1) : 0;
    let lostTotal = (firstWeight - currentWeight).toFixed(1);

    statsBox.innerHTML = `
        <div>Rispetto a 7 gg fa: <strong>${lostWeek > 0 ? '-' : (lostWeek < 0 ? '+' : '')}${Math.abs(lostWeek)} kg</strong></div>
        <div>Rispetto a 30 gg fa: <strong>${lostMonth > 0 ? '-' : (lostMonth < 0 ? '+' : '')}${Math.abs(lostMonth)} kg</strong></div>
        <div>Dall'inizio: <strong>${lostTotal > 0 ? '-' : (lostTotal < 0 ? '+' : '')}${Math.abs(lostTotal)} kg</strong></div>
    `;
}

function getWeightNearTime(log, targetTime) {
    let bestMatch = null, minDiff = Infinity;
    for (let entry of log) {
        if (entry.timestamp <= targetTime + (24 * 60 * 60 * 1000)) {
            let diff = Math.abs(targetTime - entry.timestamp);
            if (diff < minDiff) { minDiff = diff; bestMatch = entry.weight; }
        }
    }
    if (bestMatch === null && log.length > 0) return log[0].weight;
    return bestMatch;
}

// ---- GRAFICO CHART.JS ----
let charts = {};
function drawChart(profile, log, startWeight) {
    const ctx = document.getElementById(`chart-${profile}`);
    if (!ctx) return;

    // Preparo i dati: se vuoto metto solo il peso di partenza
    let labels = [];
    let data = [];

    if (log.length === 0) {
        labels = ["Inizio"];
        data = [startWeight];
    } else {
        // Se c'è un log prendiamo le ultime 14 pesate per non affollare
        let recentLog = log.slice(-14);
        labels = recentLog.map(e => {
            let parts = e.date.split('-');
            return `${parts[2]}/${parts[1]}`; // Formato DD/MM
        });
        data = recentLog.map(e => e.weight);
    }

    const chartColor = profile === 'marito' ? '#1976d2' : '#9c27b0';

    if (typeof Chart === 'undefined') return;

    if (charts[profile]) {
        charts[profile].destroy();
    }

    charts[profile] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: data,
                borderColor: chartColor,
                backgroundColor: chartColor + '33', // trasparente
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: chartColor,
                pointRadius: 5,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: { weight: 'bold', size: 10 },
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 30
                    },
                    grid: { color: 'rgba(255,255,255,0.06)' }
                },
                y: {
                    min: (data.length > 0 && isFinite(Math.min(...data))) ? Math.min(...data) - 2 : (startWeight ? startWeight - 5 : 60),
                    max: (data.length > 0 && isFinite(Math.max(...data))) ? Math.max(...data) + 2 : (startWeight ? startWeight + 5 : 95),
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.06)' }
                }
            }
        }
    });
}

// ---- EFFETTO CORIANDOLI ----
function fireConfetti() {
    var duration = 3 * 1000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// ---- SMART SHOPPING LIST ----
// ---- CHICCA 3: ESTRAI SPESA DAL MENU' SETTIMANALE ----
window.generateShoppingListFromMenu = function () {
    let profileId = (typeof activeProfile !== 'undefined') ? activeProfile : 'marito';
    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelector('.weekly-table');

    if (!table) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Nessun menù settimanale trovato da cui estrarre la spesa!");
        return;
    }

    // Raccogli tutto il testo dei pasti settimanali
    let cells = table.querySelectorAll('tbody td:not(.day-cell):not(.kcal-cell)');
    let fullText = "";
    cells.forEach(c => fullText += " " + c.innerText);

    let fullLower = fullText.toLowerCase();

    // Dizionario intelligente di ingredienti raggruppati
    const ingredientDb = {
        carne_pesce: [
            { name: "Petto di Pollo", keys: ["pollo", "petto di pollo"] },
            { name: "Fesa di Tacchino", keys: ["tacchino", "fesa"] },
            { name: "Salmone fresco/surgelato", keys: ["salmone"] },
            { name: "Sgombro", keys: ["sgombro"] },
            { name: "Orata o Branzino", keys: ["orata", "branzino"] },
            { name: "Merluzzo o Nasello", keys: ["merluzzo", "nasello"] },
            { name: "Tonno al naturale", keys: ["tonno"] },
            { name: "Uova fresche", keys: ["uova", "uovo", "frittata"] },
            { name: "Carne magra / Manzo", keys: ["carne", "manzo", "carpaccio"] }
        ],
        verdure_frutta: [
            { name: "Insalata mista & Rucola", keys: ["insalata", "insalatona", "rucola"] },
            { name: "Zucchine", keys: ["zucchine", "zucchina"] },
            { name: "Broccoli o Cavolfiore", keys: ["broccoli", "broccolo"] },
            { name: "Spinaci freschi", keys: ["spinaci", "erbette"] },
            { name: "Carciofi", keys: ["carciofi", "carciofo"] },
            { name: "Finocchi & Cetrioli", keys: ["finocchi", "finocchio", "cetrioli"] },
            { name: "Pomodori & Pomodorini", keys: ["pomodori", "pomodorini"] },
            { name: "Limoni e Frutta di stagione", keys: ["limone", "frutta", "mela", "arancia"] }
        ],
        carboidrati_altro: [
            { name: "Riso integrale o Basmati", keys: ["riso"] },
            { name: "Quinoa o Farro", keys: ["quinoa", "farro"] },
            { name: "Pane integrale o di segale", keys: ["pane", "fette"] },
            { name: "Lenticchie o Ceci", keys: ["lenticchie", "ceci", "legumi"] },
            { name: "Fiocchi di latte magri", keys: ["fiocchi di latte"] },
            { name: "Yogurt greco magro", keys: ["yogurt"] },
            { name: "Olio Extra Vergine di Oliva (EVO)", keys: ["olio", "evo"] },
            { name: "Frutta secca (Mandorle/Noci)", keys: ["mandorle", "noci", "frutta secca"] }
        ]
    };

    let listContainer = document.querySelector('.shopping-list');
    if (!listContainer) return;

    let newHtml = "";

    // Categoria Carne & Pesce
    let foundCarne = ingredientDb.carne_pesce.filter(item => item.keys.some(k => fullLower.includes(k)));
    if (foundCarne.length === 0) foundCarne = ingredientDb.carne_pesce.slice(0, 4);
    newHtml += `<div class="shopping-category">
        <h4>🥩 Carne, Pesce & Uova</h4>
        <ul class="smart-list">`;
    foundCarne.forEach(it => {
        newHtml += `<li><label><input type="checkbox"> <span>${it.name}</span></label></li>`;
    });
    newHtml += `</ul></div>`;

    // Categoria Verdure & Frutta
    let foundVerdure = ingredientDb.verdure_frutta.filter(item => item.keys.some(k => fullLower.includes(k)));
    if (foundVerdure.length === 0) foundVerdure = ingredientDb.verdure_frutta.slice(0, 5);
    newHtml += `<div class="shopping-category">
        <h4>🥗 Verdure & Frutta</h4>
        <ul class="smart-list">`;
    foundVerdure.forEach(it => {
        newHtml += `<li><label><input type="checkbox"> <span>${it.name}</span></label></li>`;
    });
    newHtml += `</ul></div>`;

    // Categoria Carboidrati & Altro
    let foundCarbo = ingredientDb.carboidrati_altro.filter(item => item.keys.some(k => fullLower.includes(k)));
    if (foundCarbo.length === 0) foundCarbo = ingredientDb.carboidrati_altro.slice(0, 5);
    newHtml += `<div class="shopping-category">
        <h4>🌾 Carboidrati & Altro</h4>
        <ul class="smart-list">`;
    foundCarbo.forEach(it => {
        newHtml += `<li><label><input type="checkbox"> <span>${it.name}</span></label></li>`;
    });
    newHtml += `</ul></div>`;

    listContainer.innerHTML = newHtml;
    localStorage.setItem('saved_smart_shopping', newHtml);

    let pName = getProfileDisplayName(profileId);
    if (typeof showToast === 'function') {
        showToast("🪄 Lista della spesa estratta con successo dal menù di " + pName + "! 🛒");
    } else {
        alert("Lista della spesa estratta con successo dal menù di " + pName + "!");
    }
};

function resetShoppingList() {
    const checkboxes = document.querySelectorAll('.smart-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// ---- WALK TRACKER ----
const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
function initWalk(profile) {
    const container = document.getElementById('walk-' + profile);
    if (!container) return;
    let walks = JSON.parse(localStorage.getItem('walks_' + profile)) || [false, false, false, false, false, false, false];
    container.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        let div = document.createElement('div');
        div.className = 'day-check';
        div.innerHTML = `<span>${daysOfWeek[i]}</span><input type="checkbox" ${walks[i] ? 'checked' : ''} onchange="toggleWalk('${profile}',${i}, this.checked)">`;
        container.appendChild(div);
    }
}
function toggleWalk(profile, index, isChecked) {
    let walks = JSON.parse(localStorage.getItem('walks_' + profile)) || [false, false, false, false, false, false, false];
    walks[index] = isChecked;
    localStorage.setItem('walks_' + profile, JSON.stringify(walks));
}

// ---- EXPORT DATI UNIVERSALE ----
function exportDataTXT() {
    let output = '=== DIARIO DEL PESO E UMORE: PROGETTO SALUTE ===\n\n';
    function formatLog(profile, name) {
        output += `--- ${name} ---\n`;
        let wLog = JSON.parse(localStorage.getItem(`weightLog_${profile}`)) || [];
        let mLog = JSON.parse(localStorage.getItem(`moodLog_${profile}`)) || {};

        if (wLog.length === 0 && Object.keys(mLog).length === 0) {
            output += 'Nessun dato registrato.\n'; return;
        }

        let allDates = new Set([...wLog.map(e => e.date), ...Object.keys(mLog)]);
        let datesArr = Array.from(allDates).sort();

        datesArr.forEach(date => {
            let weightObj = wLog.find(e => e.date === date);
            let weightStr = weightObj ? `${weightObj.weight} kg` : '-- kg';
            let moodStr = mLog[date] ? mLog[date] : 'N/D';

            // Format date to DD/MM/YYYY
            let parts = date.split('-');
            let itaDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;

            output += `${itaDate} | Peso: ${weightStr} | Umore/Energia: ${moodStr}\n`;
        });
    }
    formatLog('marito', (localStorage.getItem('profileName_marito') || 'CIRO MILELLA').toUpperCase()); output += '\n'; formatLog('moglie', (localStorage.getItem('profileName_moglie') || 'MARIA CARMELA').toUpperCase());
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Diario_Salute_Universale.txt'; a.click(); URL.revokeObjectURL(url);
}

// ---- CALCOLATORE AUTOMATICO CALORIE ----

// ========================================================
// MOTORE CLINICO DI CONTROLLO PER TUTTE LE PATOLOGIE
// ========================================================

const pathologyDb = {
    'steatosi': {
        id: 'steatosi',
        name: "Steatosi Epatica (Fegato Grasso)",
        emoji: "🌿",
        badgeText: "🎯 Obiettivo: Detox Fegato & Dimagrimento",
        badgeBg: "linear-gradient(135deg, #00897b, #004d40)",
        desc: "Protocollo per ripristino epatico. Azzeramento alcol e grassi saturi.",
        goldenRule: "Evita tassativamente il consumo di alcol e cibi fritti: il fegato ha bisogno di disintossicarsi completamente.",
        bad: ['alcol', 'vino', 'birra', 'superalcol', 'burro', 'panna', 'lardo', 'strutto', 'fritt', 'soffritt', 'insaccat', 'salame', 'salsiccia', 'wurstel', 'mortadella', 'pancetta', 'patatine', 'maionese', 'ketchup', 'dolce', 'dolciume', 'pasticceria', 'torta', 'brioche', 'cornett', 'biscott', 'cioccolato', 'nutella', 'zucchero', 'hamburger', 'fast-food', 'fast food'],
        good: ['carciof', 'cardo', 'cicoria', 'rucola', 'tarassaco', 'salmone', 'sgombro', 'tonno', 'pesce azzurro', 'pesce', 'olio evo', 'avena', 'farro', 'quinoa', 'legum', 'lenticchie', 'ceci', 'noci', 'mandorle', 'limone', 'zenzero', 'te verde', 'tè verde', 'mirtill', 'broccoli', 'spinaci'],
        badExplain: "Appesantiscono le cellule epatiche e stimolano l'accumulo di trigliceridi nel fegato.",
        goodExplain: "Stimolano la secrezione biliare, favoriscono la detossificazione e riducono l'infiammazione epatica."
    },
    'diabete': {
        id: 'diabete',
        name: "Diabete di Tipo 2 / Glicemia",
        emoji: "🩸",
        badgeText: "🎯 Obiettivo: Controllo Diabete & Glicemia",
        badgeBg: "linear-gradient(135deg, #c2185b, #880e4f)",
        desc: "Controllo rigoroso del carico glicemico e prevenzione picchi insulinici.",
        goldenRule: "Regola delle 4 P: Non abbinare MAI nello stesso pasto Pane, Pasta, Patate o Pizza.",
        bad: ['zucchero', 'dolce', 'dolciume', 'pasticceria', 'torta', 'pasticceria', 'brioche', 'cornett', 'biscott', 'torta', 'gelato', 'miele', 'sciroppo', 'caramell', 'cioccolato al latte', 'bevande gassat', 'coca', 'aranciata', 'succo', 'pane bianco', 'pizza', 'frutta sciroppata', 'uva', 'fichi', 'banane mature', 'marmellata'],
        good: ['avena', 'orzo', 'farro', 'quinoa', 'legumi', 'lenticchie', 'ceci', 'fagioli', 'verdure fibrose', 'broccoli', 'spinaci', 'zucchine', 'insalata', 'noci', 'mandorle', 'cannella', 'pesce', 'salmone', 'petto di pollo', 'tacchino', 'uova', 'olio evo'],
        badExplain: "Zuccheri semplici e farine raffinate scatenano impennate della glicemia e sovraccarico pancreatico.",
        goodExplain: "Fibre e proteine magre rallentano l'assorbimento degli zuccheri e mantengono stabile l'insulina."
    },
    'ipertensione': {
        id: 'ipertensione',
        name: "Ipertensione Arteriosa (Dieta DASH)",
        emoji: "🫀",
        badgeText: "🎯 Obiettivo: Pressione & Cuore (DASH)",
        badgeBg: "linear-gradient(135deg, #e65100, #bf360c)",
        desc: "Dieta DASH: controllo rigoroso del sodio (< 2g/die) e apporto di potassio.",
        goldenRule: "Usa spezie, limone ed erbe aromatiche per insaporire al posto del sale da cucina.",
        bad: ['sale', 'salumi', 'insaccat', 'prosciutto crudo', 'salame', 'salsiccia', 'pecorino', 'grana', 'parmigiano', 'formaggi stagionati', 'dado', 'brodo pronto', 'patatine', 'snack salati', 'salamoia', 'olive salate', 'salsa di soia', 'ketchup', 'liquirizia'],
        good: ['aglio', 'cipolla', 'banane', 'patate lesse', 'spinaci', 'finocchi', 'pesce fresco', 'orata', 'merluzzo', 'latticini magri', 'ricotta magra', 'yogurt greco', 'spezie', 'erbe aromatiche', 'origano', 'rosmarino', 'limone', 'olio evo'],
        badExplain: "L'eccesso di sodio trattiene liquidi e alza la pressione sanguigna arteriosa.",
        goodExplain: "Alimenti ricchi di potassio e magnesio favoriscono l'elasticità arteriosa e abbassano la pressione."
    },
    'ipercolesterolemia': {
        id: 'ipercolesterolemia',
        name: "Ipercolesterolemia (Controllo LDL)",
        emoji: "🔬",
        badgeText: "🎯 Obiettivo: Riduzione Colesterolo LDL",
        badgeBg: "linear-gradient(135deg, #6a1b9a, #4a148c)",
        desc: "Riduzione colesterolo LDL e grassi saturi a favore di Omega-3 e fibre solubili.",
        goldenRule: "Aumenta la fibra solubile: i beta-glucani dell'avena intrappolano il colesterolo a livello intestinale.",
        bad: ['burro', 'panna', 'lardo', 'strutto', 'formaggi grassi', 'formaggi fusi', 'mascarpone', 'gorgonzola', 'frattaglie', 'fegato', 'cervello', 'carni rosse grasse', 'insaccat', 'salumi', 'wurstel', 'olio di palma', 'maionese', 'croissant', 'merendine', 'fritti'],
        good: ['avena', 'orzo', 'legumi', 'soia', 'ceci', 'lenticchie', 'pesce azzurro', 'salmone', 'sgombro', 'sardine', 'noci', 'mandorle', 'semi di lino', 'mele', 'frutti di bosco', 'olio evo', 'carciofi'],
        badExplain: "I grassi saturi e trans stimolano la sintesi epatica del colesterolo 'cattivo' LDL.",
        goodExplain: "I fitosteroli e gli acidi grassi Omega-3 favoriscono la pulizia delle arterie e alzano l'HDL."
    },
    'reflusso': {
        id: 'reflusso',
        name: "Reflusso Gastroesofageo (MRGE)",
        emoji: "🔥",
        badgeText: "🎯 Obiettivo: Antiacido & Cura Reflusso",
        badgeBg: "linear-gradient(135deg, #f57c00, #e65100)",
        desc: "Controllo dell'acidità gastrica, svuotamento rapido e protezione dell'esofago.",
        goldenRule: "Evita di sdraiarti subito dopo i pasti. Attendi almeno 2-3 ore prima di coricarti.",
        bad: ['pomodoro', 'passata', 'salsa al pomodoro', 'agrumi', 'arancia', 'limone', 'mandarini', 'caffè', 'tè forte', 'cioccolato', 'cacao', 'menta', 'fritti', 'soffritti', 'peperoncino', 'pepe', 'bevande gassate', 'alcol', 'vino', 'birra', 'cipolla cruda', 'aglio crudo'],
        good: ['zucchine', 'carote', 'finocchi', 'patate lesse', 'avena', 'riso', 'pollo', 'tacchino', 'merluzzo', 'orata', 'banana matura', 'latte di mandorla', 'olio evo a crudo'],
        badExplain: "Rilasciano lo sfintere esofageo inferiore o irritano direttamente la parete dell'esofago.",
        goodExplain: "Tamponano l'acidità gastrica e accelerano lo svuotamento fisiologico dello stomaco."
    },
    'gastrite': {
        id: 'gastrite',
        name: "Gastrite Acuta / Cronica",
        emoji: "🥣",
        badgeText: "🎯 Obiettivo: Protezione Gastrica & Digestione",
        badgeBg: "linear-gradient(135deg, #0288d1, #01579b)",
        desc: "Regime non irritante per proteggere e far cicatrizzare la mucosa gastrica.",
        goldenRule: "Mastica molto lentamente e fai piccoli pasti frequenti per tamponare l'acidità gastrica.",
        bad: ['pepe', 'peperoncino', 'spezie forti', 'brodo di carne', 'dado', 'caffè', 'alcol', 'vino', 'superalcolici', 'agrumi', 'succhi acidi', 'pomodoro', 'fritti', 'cibi affumicati', 'insaccati', 'aceto', 'gomme da masticare'],
        good: ['riso', 'pasta ben cotta', 'patate', 'zucchine lesse', 'carote lesse', 'pollo al vapore', 'tacchino', 'pesce magro al vapore', 'merluzzo', 'olio evo crudo', 'mele cotte', 'camomilla'],
        badExplain: "Stimolano un'ipersecrezione di succhi gastrici acidi che infiammano la mucosa dello stomaco.",
        goodExplain: "Creano una barriera protettiva e sono di facilissima digeribilità."
    },
    'gotta': {
        id: 'gotta',
        name: "Iperuricemia / Gotta (Controllo Purine)",
        emoji: "🦶",
        badgeText: "🎯 Obiettivo: Abbassamento Acido Urico",
        badgeBg: "linear-gradient(135deg, #5c6bc0, #3949ab)",
        desc: "Controllo rigoroso delle purine per prevenire attacchi acuti e calcoli renali.",
        goldenRule: "Evita alimenti ad alta densità cellulare (come frattaglie e selvaggina) e bevi molta acqua.",
        bad: ['frattaglie', 'fegato', 'rognone', 'trippa', 'carni rosse', 'selvaggina', 'molluschi', 'crostacei', 'gamberi', 'cozze', 'vongole', 'acciughe', 'alici', 'sardine', 'sgombro', 'estratto di carne', 'dado', 'birra', 'alcol', 'superalcolici', 'fruttosio'],
        good: ['ciliegie', 'frutti di bosco', 'mirtilli', 'fragole', 'uova', 'latticini magri', 'ricotta magra', 'yogurt magro', 'pasta', 'riso', 'patate', 'zucchine', 'carote', 'acqua oligominerale'],
        badExplain: "Hanno un contenuto elevatissimo di purine che vengono convertite in acido urico nel sangue.",
        goodExplain: "Favoriscono l'escrezione renale degli urati e contrastano la formazione di cristalli."
    },
    'colon': {
        id: 'colon',
        name: "Intestino Irritabile (IBS / Low-FODMAP)",
        emoji: "🌾",
        badgeText: "🎯 Obiettivo: Intestino Irritabile (IBS)",
        badgeBg: "linear-gradient(135deg, #8d6e63, #5d4037)",
        desc: "Protocollo Low-FODMAP per ridurre fermentazione, gonfiore addominale e spasmi.",
        goldenRule: "Riduci temporaneamente gli zuccheri fermentescibili (FODMAP) e bevi lontano dai pasti.",
        bad: ['legumi', 'ceci', 'fagioli', 'lenticchie', 'latticini con lattosio', 'latte', 'formaggi freschi', 'cipolla', 'aglio', 'mele', 'pere', 'pesche', 'susine', 'cavoli', 'broccoli', 'cavolfiori', 'asparagi', 'funghi', 'frumento', 'gomme da masticare', 'dolcificanti', 'sorbitolo', 'xilitolo'],
        good: ['riso', 'quinoa', 'avena', 'zucchine', 'melanzane', 'carote', 'patate', 'kiwi', 'banane', 'mirtilli', 'arance', 'latte delattosato', 'carni magre', 'pollo', 'pesce fresco', 'olio evo'],
        badExplain: "Vengono rapidamente fermentati dalla flora batterica producendo gas, meteorismo e dolore.",
        goodExplain: "Non fermentano nell'intestino tenue e permettono alla mucosa di sfiammarsi."
    },
    'celiachia': {
        id: 'celiachia',
        name: "Celiachia (Rigidamente Senza Glutine)",
        emoji: "🌾❌",
        badgeText: "🎯 Obiettivo: 100% Senza Glutine (Gluten-Free)",
        badgeBg: "linear-gradient(135deg, #f59e0b, #d97706)",
        desc: "Esclusione totale e a vita del glutine e prevenzione contaminazioni.",
        goldenRule: "Attenzione alle contaminazioni: usa stoviglie e pentole separate per cucinare il senza glutine.",
        bad: ['frumento', 'grano', 'farro', 'orzo', 'segale', 'kamut', 'spelta', 'pangrattato', 'farina normale', 'farina 00', 'seitan', 'birra tradizionale', 'lievito madre tradizionale', 'pasta normale', 'pane normale', 'pizza normale'],
        good: ['riso', 'mais', 'grano saraceno', 'quinoa', 'amaranto', 'miglio', 'patate', 'legumi', 'pesce fresco', 'carne fresca', 'uova', 'frutta', 'verdura', 'olio evo'],
        badExplain: "Il glutine innesca una reazione autoimmune distruttiva contro i villi intestinali.",
        goodExplain: "Cereali naturalmente privi di glutine e cibi freschi non contaminati."
    },
    'renale': {
        id: 'renale',
        name: "Insufficienza Renale Lieve",
        emoji: "💧",
        badgeText: "🎯 Obiettivo: Protezione Renale & Filtro",
        badgeBg: "linear-gradient(135deg, #0288d1, #01579b)",
        desc: "Controllo del carico proteico, riduzione del sodio e monitoraggio di fosforo e potassio.",
        goldenRule: "Per ridurre il potassio, taglia le verdure a pezzi e lasciale a bagno prima di bollirle.",
        bad: ['grandi porzioni di carne', 'eccesso di carne', 'insaccati', 'salumi', 'sale', 'dado', 'formaggi fusi', 'sottilette', 'cacao', 'cioccolato', 'frutta secca in dosi elevate', 'brodo di carne', 'cibi in scatola'],
        good: ['riso', 'pasta', 'olio evo', 'verdure bollite', 'mela', 'pera', 'mirtilli', 'albume', 'pesce bianco', 'acque a basso residuo fisso'],
        badExplain: "Sovraccaricano il lavoro di filtrazione glomerulare dei reni aumentando l'azotemia.",
        goodExplain: "Forniscono energia pulita con minimo residuo di scorie azotate."
    },
    'tiroide': {
        id: 'tiroide',
        name: "Ipotiroidismo & Rallentamento Metabolico",
        emoji: "🦋",
        badgeText: "🎯 Obiettivo: Supporto Tiroideo & Metabolismo",
        badgeBg: "linear-gradient(135deg, #7b1fa2, #4a148c)",
        desc: "Supporto metabolico e modulazione iodio/gozzigeni.",
        goldenRule: "Non esagerare con cavoli e broccoli crudi: cotti perdono le sostanze gozzigene nemiche della tiroide.",
        bad: ['cavolo crudo', 'broccoli crudi', 'verza cruda', 'cavoletti crudi', 'rapanelli crudi', 'soia in eccesso', 'latte di soia', 'tofu', 'zuccheri raffinati', 'grassi idrogenati', 'cibi ultra-processati'],
        good: ['pesce di mare', 'merluzzo', 'salmone', 'orata', 'uova', 'noci del brasile', 'semi di zucca', 'cereali integrali', 'carni magre', 'sale iodato'],
        badExplain: "Ostacolano la captazione dello iodio tiroideo o rallentano ulteriormente il metabolismo basale.",
        goodExplain: "Forniscono selenio, zinco e iodio bioattivi essenziali per la conversione degli ormoni T4 in T3."
    },
    'pcos': {
        id: 'pcos',
        name: "PCOS (Sindrome Ovaio Policistico)",
        emoji: "🌸",
        badgeText: "🎯 Obiettivo: Equilibrio Ormonale PCOS",
        badgeBg: "linear-gradient(135deg, #ec407a, #ad1457)",
        desc: "Controllo dell'insulino-resistenza associata e dell'infiammazione ormonale.",
        goldenRule: "Prediligi carboidrati a basso indice glicemico abbinandoli sempre a proteine o grassi sani.",
        bad: ['farine raffinate', 'pane bianco', 'pizza normale', 'dolci', 'merendine', 'zuccheri semplici', 'bevande zuccherate', 'latte vaccino in eccesso', 'fast-food', 'fritti'],
        good: ['avena integrale', 'quinoa', 'farro', 'legumi', 'semi di lino', 'semi di zucca', 'pesce azzurro', 'salmone', 'verdure a foglia verde', 'olio evo', 'cannella'],
        badExplain: "I picchi di insulina stimolano le ovaie a produrre androgeni in eccesso peggiorando i sintomi.",
        goodExplain: "Riducono l'infiammazione e modulano la sensibilità periferica all'insulina."
    },
    'stipsi': {
        id: 'stipsi',
        name: "Stipsi Cronica & Regolarità Intestinale",
        emoji: "🚰",
        badgeText: "🎯 Obiettivo: Regolarità & Stipsi Cronica",
        badgeBg: "linear-gradient(135deg, #43a047, #2e7d32)",
        desc: "Aumento dell'apporto di fibre insolubili, mucillagini e abbondante idratazione.",
        goldenRule: "Non basta mangiare fibre: senza almeno 2 litri d'acqua al giorno, le fibre induriscono il transito.",
        bad: ['pane bianco', 'riso brillato', 'banane acerbe', 'patate', 'mele sbucciate', 'formaggi stagionati', 'tè ristretto', 'limone in eccesso'],
        good: ['kiwi maturi', 'prugne secche', "crusca d'avena", 'semi di chia', 'cereali integrali', 'legumi', 'spinaci', 'bietole', 'minestroni', 'olio evo', 'acqua magnesiaca'],
        badExplain: "Hanno effetto astringente o rallentano il transito intestinale.",
        goodExplain: "Formano una massa morbida e idratata stimolando la naturale peristalsi intestinale."
    },
    'osteoporosi': {
        id: 'osteoporosi',
        name: "Osteoporosi / Osteopenia",
        emoji: "🦴",
        badgeText: "🎯 Obiettivo: Rinforzo Osseo & Calcio",
        badgeBg: "linear-gradient(135deg, #78909c, #455a64)",
        desc: "Ottimizzazione dell'introito di Calcio biodisponibile e Vitamina D.",
        goldenRule: "L'eccesso di sale e caffeina aumenta la dispersione urinaria di calcio: usali con moderazione.",
        bad: ['sale in eccesso', 'salumi', 'snack salati', 'caffè in eccesso', 'superalcolici', 'bevande alla cola', 'alcol', 'eccesso di crusca cruda'],
        good: ['ricotta magra', 'yogurt greco', 'parmigiano', 'mandorle', 'semi di sesamo', 'rucola', 'verdure a foglia scura', 'pesce azzurro', 'salmone', 'uova', 'acqua calcica'],
        badExplain: "Provocano chelazione o aumentano l'escrezione di calcio attraverso i reni.",
        goodExplain: "Forniscono calcio altamente assimilabile e cofattori vitaminici per la matrice ossea."
    },
    'nessuna': {
        id: 'nessuna',
        name: "Dimagrimento Generale & Peso Forma (Prevenzione)",
        emoji: "🎯",
        badgeText: "🎯 Obiettivo: Dimagrimento & Peso Forma",
        badgeBg: "linear-gradient(135deg, #1976d2, #0d47a1)",
        desc: "Deficit calorico scientifico ed equilibrio mediterraneo per perdita di massa grassa.",
        goldenRule: "Bevi almeno 2 litri d'acqua al giorno e mantieni un deficit calorico moderato e costante.",
        bad: ['fritti', 'patatine fritte', 'alcol', 'superalcolici', 'bevande gassate zuccherate', 'dolci industriali', 'merendine', 'nutella', 'fast-food', 'insaccati grassi', 'burro in eccesso'],
        good: ['verdura di stagione', 'insalata', 'frutta fresca', 'cereali integrali', 'riso integrale', 'avena', 'petto di pollo', 'tacchino', 'pesce magro', 'legumi', 'olio evo a crudo'],
        badExplain: "Hanno un'altissima densità calorica e favoriscono l'accumulo di grasso viscerale.",
        goodExplain: "Garantiscono sazietà prolungata, nutrienti essenziali e preservano la massa muscolare."
    }
};

window.pathologyDb = pathologyDb;

function getProfileForElement(el) {
    if (!el) return window.activeProfile || 'marito';
    let sec = el.closest('section[id^="section-"]');
    if (sec) return sec.id.replace('section-', '');
    let tbl = el.closest('table');
    if (tbl && tbl.id) {
        if (tbl.id.includes('marito')) return 'marito';
        if (tbl.id.includes('moglie')) return 'moglie';
    }
    return window.activeProfile || 'marito';
}

function getProfilePathology(profId) {
    if (!profId) profId = window.activeProfile || 'marito';
    let pat = localStorage.getItem('pathology_' + profId) || localStorage.getItem('profilePathology_' + profId);
    if (!pat) {
        if (profId === 'marito') pat = localStorage.getItem('pathology_1') || localStorage.getItem('profilePathology_marito');
        else if (profId === 'moglie') pat = localStorage.getItem('pathology_0') || localStorage.getItem('profilePathology_moglie');
    }

    // Se non ancora salvata esplicitamente, controlliamo l'anamnesi o le patologie cliniche collegate dalla Suite
    if (!pat) {
        try {
            let rawAna = localStorage.getItem('anamnesi_' + profId);
            let pStr = '';
            if (rawAna) {
                try {
                    let ana = JSON.parse(rawAna);
                    pStr = (ana.patologie || JSON.stringify(ana)).toLowerCase();
                } catch (eJson) {
                    pStr = String(rawAna).toLowerCase();
                }
            }
            if (!pStr) {
                let rawStats = localStorage.getItem('profileStats_' + profId);
                if (rawStats) {
                    let st = JSON.parse(rawStats);
                    if (st && st.pathology) pStr = String(st.pathology).toLowerCase();
                    if (st && st.notes) pStr += ' ' + String(st.notes).toLowerCase();
                }
            }
            if (!pStr) {
                let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profId).toLowerCase() : '';
                if (pName.includes('rosa')) pStr = 'diabete ipertensione gotta osteoartrosi';
                else if (pName.includes('aldo')) pStr = 'cardiopatia reflusso allettato';
                else if (pName.includes('angela')) pStr = 'ipertensione cardiopatia';
            }

            if (pStr.includes('diabete') || pStr.includes('glicem') || pStr.includes('diamicron') || pStr.includes('forxiga') || pStr.includes('xultophy')) pat = 'diabete';
            else if (pStr.includes('pressione') || pStr.includes('ipertens') || pStr.includes('cardiopatia') || pStr.includes('congescor') || pStr.includes('bisoprololo')) pat = 'ipertensione';
            else if (pStr.includes('gotta') || pStr.includes('acido urico') || pStr.includes('adenuric')) pat = 'gotta';
            else if (pStr.includes('reflusso') || pStr.includes('mrge') || pStr.includes('gastrite')) pat = 'reflusso';
            else if (pStr.includes('tiroide') || pStr.includes('eutirox')) pat = 'tiroide';
            else if (pStr.includes('osteopor') || pStr.includes('osteoartrosi') || pStr.includes('arcoxia')) pat = 'osteoporosi';
            else if (pStr.includes('steatosi') || pStr.includes('fegato') || pStr.includes('hbv') || pStr.includes('entecavir')) pat = 'steatosi';
        } catch (e) { }
    }

    if (!pat) {
        if (profId === 'marito') pat = 'steatosi';
        else pat = 'nessuna';
    }
    if (!pathologyDb[pat]) pat = 'nessuna';
    return pat;
}

function setProfilePathology(profId, patKey) {
    if (!profId) profId = window.activeProfile || 'marito';
    if (!pathologyDb[patKey]) patKey = 'nessuna';

    localStorage.setItem('pathology_' + profId, patKey);
    if (profId === 'marito') localStorage.setItem('pathology_1', patKey);
    if (profId === 'moglie') localStorage.setItem('pathology_0', patKey);

    // Sincronizza con Anamnesi se presente
    try {
        let ana = JSON.parse(localStorage.getItem('anamnesi_' + profId)) || {};
        ana.selectedPathology = patKey;
        let pObj = pathologyDb[patKey];
        if (pObj && patKey !== 'nessuna') {
            if (!ana.patologie || ana.patologie.trim() === '' || ana.patologie === 'Nessuna') {
                ana.patologie = pObj.name;
            } else if (!ana.patologie.includes(pObj.name)) {
                ana.patologie = pObj.name + ', ' + ana.patologie;
            }
        }
        localStorage.setItem('anamnesi_' + profId, JSON.stringify(ana));
    } catch (e) { }

    // Aggiorna UI
    updatePathologyUI(profId);

    // Notifica toast
    let pObj = pathologyDb[patKey];
    if (typeof showToast === 'function' && pObj) {
        showToast("🩺 Focus Clinico impostato su: " + pObj.name, "#0284c7");
    }

    // Ri-analizza le tabelle con i nuovi parametri
    reanalyzeAllTables();
}

function updatePathologyUI(profId) {
    if (!profId) profId = window.activeProfile || 'marito';
    let patKey = getProfilePathology(profId);
    let p = pathologyDb[patKey] || pathologyDb['nessuna'];

    // 1. Aggiorna Badge in Testata Profilo
    let badge = document.getElementById('badge_goal_' + profId);
    if (badge) {
        badge.innerHTML = `${p.badgeText} ⚙️`;
        badge.style.background = p.badgeBg;
        badge.title = `Focus Clinico: ${p.name}. Clicca per cambiare patologia o obiettivo!`;
    }

    // 2. Aggiorna Guida / Scheda Clinica nel Profilo
    let nameDisplay = document.getElementById('pathology_name_display_' + profId);
    if (nameDisplay) {
        nameDisplay.innerHTML = `${p.emoji} ${p.name}`;
    }

    let ruleDisplay = document.getElementById('pathology_golden_rule_' + profId);
    if (ruleDisplay) {
        ruleDisplay.innerText = p.goldenRule;
    }

    let promoteDisplay = document.getElementById('pathology_promote_tags_' + profId);
    if (promoteDisplay) {
        let goodTags = p.good.slice(0, 8).map(g => `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; margin:2px; display:inline-block; font-weight:600;">✓ ${g}</span>`).join(' ');
        promoteDisplay.innerHTML = goodTags;
    }

    let avoidDisplay = document.getElementById('pathology_avoid_tags_' + profId);
    if (avoidDisplay) {
        let badTags = p.bad.slice(0, 8).map(b => `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:12px; margin:2px; display:inline-block; font-weight:600;">✕ ${b}</span>`).join(' ');
        avoidDisplay.innerHTML = badTags;
    }
}

function analyzePathology(text, pathologyId) {
    if (!pathologyId || !pathologyDb[pathologyId]) return null;
    let p = pathologyDb[pathologyId];
    let t = text.toLowerCase();

    // Cerca cibi sconsigliati
    let badMatches = [];
    p.bad.forEach(k => {
        if (t.includes(k) && !badMatches.includes(k)) {
            if ((k === 'dolce' || k === 'dolci') && t.includes('patate dolci')) {
                // Non considerare le patate dolci come dolce nocivo
            } else {
                badMatches.push(k);
            }
        }
    });

    // Cerca cibi raccomandati
    let goodMatches = [];
    p.good.forEach(k => {
        if (t.includes(k) && !goodMatches.includes(k)) {
            goodMatches.push(k);
        }
    });

    if (badMatches.length > 0 && goodMatches.length > 0) {
        return {
            status: 'mixed',
            icon: '⚠️',
            msg: `⚠️ Attenzione [${p.name}]: contiene cibi sconsigliati (${badMatches.slice(0, 3).join(', ')}). 💚 Presente anche cibo protettivo (${goodMatches.slice(0, 2).join(', ')}).`
        };
    }

    if (badMatches.length > 0) {
        return {
            status: 'bad',
            icon: '⚠️',
            msg: `⚠️ Attenzione [${p.name}]: contiene cibi sconsigliati (${badMatches.slice(0, 3).join(', ')}). ${p.badExplain}`
        };
    }

    if (goodMatches.length > 0) {
        return {
            status: 'good',
            icon: '💚',
            msg: `💚 Ottimo per [${p.name}]: contiene cibi raccomandati (${goodMatches.slice(0, 3).join(', ')}). ${p.goodExplain}`
        };
    }

    return null;
}


// ============================================================
// MODULO CORRETTORE CLINICO INTELLIGENTE & ALTERNATIVE 1-CLICK
// ============================================================

const foodAlternativesDb = {
    'steatosi': {
        name: "Steatosi Epatica (Fegato Grasso)",
        emoji: "🌿",
        items: [
            {
                pattern: /\bfritt(?:ata|o|e|i)?\b/i,
                keyword: 'frittata / fritti',
                explain: "I grassi cotti e le fritture sovraccaricano le cellule epatiche e stimolano l'accumulo di trigliceridi nel fegato.",
                replaceRegex: /(?:\d+\s+uova\s+in\s+)?fritt(?:ata|o|e|i)?(?:\s+al\s+forno|\s+in\s+padella)?/i,
                alternatives: [
                    { label: "2 Uova in Camicia", replaceWith: "2 uova in camicia", icon: "🍳" },
                    { label: "2 Uova Sode", replaceWith: "2 uova sode", icon: "🥚" },
                    { label: "2 Uova alla Coque", replaceWith: "2 uova alla coque", icon: "🥣" },
                    { label: "Omelette di soli albumi al vapore", replaceWith: "omelette di soli albumi al vapore", icon: "🥦" }
                ]
            },
            {
                pattern: /(?:alcol|vino|birra|superalcol)/i,
                keyword: 'alcol / vino / birra',
                explain: "L'alcol è tossico per gli epatociti e blocca lo smaltimento dei lipidi nel fegato.",
                replaceRegex: /(?:un\s+bicchiere\s+di\s+)?(?:vino|birra|alcol|superalcol)/i,
                alternatives: [
                    { label: "Acqua minerale con limone fresco", replaceWith: "acqua naturale con limone", icon: "🍋" },
                    { label: "Tè verde detossificante", replaceWith: "tè verde non zuccherato", icon: "🍵" },
                    { label: "Tisana al Cardo Mariano", replaceWith: "tisana depurativa al cardo mariano", icon: "🌿" }
                ]
            },
            {
                pattern: /(?:burro|lardo|strutto|panna)/i,
                keyword: 'grassi saturi animali',
                explain: "Appesantiscono il tessuto epatico e aumentano le transaminasi.",
                replaceRegex: /(?:burro|lardo|strutto|panna)/i,
                alternatives: [
                    { label: "1 cucchiaio Olio EVO a crudo", replaceWith: "1 cucch. olio EVO", icon: "🫒" },
                    { label: "Crema di avocado fresco", replaceWith: "avocado fresco", icon: "🥑" },
                    { label: "Ricotta magra fresca", replaceWith: "ricotta magra", icon: "🧀" }
                ]
            },
            {
                pattern: /(?:insaccat|salame|salsiccia|wurstel|mortadella|pancetta)/i,
                keyword: 'insaccati e salumi grassi',
                explain: "Ricchi di grassi saturi, sale e conservanti pro-infiammatori per il fegato.",
                replaceRegex: /(?:insaccat\w*|salame|salsiccia|wurstel|mortadella|pancetta)/i,
                alternatives: [
                    { label: "150g Fesa di Tacchino ai ferri", replaceWith: "150g fesa di tacchino ai ferri", icon: "🍗" },
                    { label: "150g Petto di Pollo al limone", replaceWith: "150g petto di pollo al limone", icon: "🍗" },
                    { label: "80g Bresaola magra con rucola", replaceWith: "80g bresaola con rucola e limone", icon: "🥩" },
                    { label: "180g Merluzzo o Orata al vapore", replaceWith: "180g merluzzo al vapore", icon: "🐟" }
                ]
            },
            {
                pattern: /(?:patatine|chips)/i,
                keyword: 'patatine fritte / chips',
                explain: "Elevato contenuto di acrilamide e grassi ossidati nocivi per il fegato.",
                replaceRegex: /(?:patatine(?:\s+fritte)?|chips)/i,
                alternatives: [
                    { label: "150g Patate lesse con rosmarino", replaceWith: "150g patate lesse", icon: "🥔" },
                    { label: "Finocchi croccanti a fette", replaceWith: "finocchi croccanti", icon: "🥗" }
                ]
            },
            {
                pattern: /(?<!patate\s+)(?:\b(?:dolce|dolci|dolciumi|pasticceria|torta|torte|brioche|cornetto|cornetti|biscotti|cioccolato|nutella|zucchero)\b)/i,
                keyword: 'zuccheri e dolci',
                explain: "Il fruttosio industriale e lo zucchero stimolano la sintesi immediata di trigliceridi epatici.",
                replaceRegex: /(?<!patate\s+)(?:\b(?:dolce|dolci|dolciumi|pasticceria|torta|torte|brioche|cornetto|cornetti|biscotti|cioccolato|nutella|zucchero)\b)/i,
                alternatives: [
                    { label: "Yogurt greco magro con mirtilli", replaceWith: "yogurt greco con mirtilli", icon: "🫐" },
                    { label: "Fiocchi d'avena con cannella", replaceWith: "fiocchi d'avena con cannella", icon: "🥣" },
                    { label: "Mela con spolverata di cannella", replaceWith: "mela con cannella", icon: "🍎" }
                ]
            }
        ]
    },
    'diabete': {
        name: "Diabete di Tipo 2 / Glicemia",
        emoji: "🩸",
        items: [
            {
                pattern: /(?:zucchero|dolc|pasticceria|brioche|cornett|biscott|torta|gelato|miele|caramell)/i,
                keyword: 'zuccheri e dolci',
                explain: "Scatenano picchi iperglicemici e stress sul pancreas.",
                replaceRegex: /(?:zucchero|dolc\w*|pasticceria|brioche|cornett\w*|biscott\w*|torta|gelato|miele|caramell\w*)/i,
                alternatives: [
                    { label: "Yogurt greco magro con semi di chia", replaceWith: "yogurt greco magro con semi di chia", icon: "🥣" },
                    { label: "Mela verde con 3 noci", replaceWith: "mela verde con 3 noci", icon: "🍏" },
                    { label: "Fiocchi d'avena integrale", replaceWith: "fiocchi d'avena integrale con cannella", icon: "🥣" }
                ]
            },
            {
                pattern: /pane\s+bianco/i,
                keyword: 'pane bianco',
                explain: "Indice glicemico molto elevato.",
                replaceRegex: /pane\s+bianco/i,
                alternatives: [
                    { label: "Pane 100% di Segale Integrale", replaceWith: "2 fette pane di segale 100%", icon: "🍞" },
                    { label: "Pane integrale ai semi di lino", replaceWith: "pane integrale ai semi", icon: "🍞" }
                ]
            },
            {
                pattern: /pizza/i,
                keyword: 'pizza classica',
                explain: "Carico di carboidrati raffinati elevato che mantiene alta la glicemia per ore.",
                replaceRegex: /pizza(?:\s+\w+)?/i,
                alternatives: [
                    { label: "Piadina integrale con tacchino e spinaci", replaceWith: "piadina integrale con tacchino e spinaci", icon: "🫓" },
                    { label: "70g Farro con tonno e pomodorini", replaceWith: "70g farro con tonno e pomodorini", icon: "🌾" }
                ]
            }
        ]
    },
    'ipertensione': {
        name: "Ipertensione Arteriosa (Dieta DASH)",
        emoji: "🫀",
        items: [
            {
                pattern: /(?:salumi|insaccat|prosciutto\s+crudo|salame|salsiccia|wurstel)/i,
                keyword: 'salumi ricchi di sodio',
                explain: "L'eccesso di sodio causa vasocostrizione e aumenta la pressione arteriosa.",
                replaceRegex: /(?:salumi|insaccat\w*|prosciutto\s+crudo|salame|salsiccia|wurstel)/i,
                alternatives: [
                    { label: "150g Petto di Pollo al rosmarino", replaceWith: "150g petto di pollo al rosmarino", icon: "🍗" },
                    { label: "Fesa di Tacchino a basso contenuto di sale", replaceWith: "150g fesa di tacchino a basso sodio", icon: "🍗" },
                    { label: "Orata al cartoccio con erbe", replaceWith: "180g orata con erbe aromatiche", icon: "🐟" }
                ]
            },
            {
                pattern: /(?:pecorino|parmigiano|grana|formaggi\s+stagionati)/i,
                keyword: 'formaggi stagionati salati',
                explain: "Contengono elevate dosi di sale che alzano la pressione sanguigna.",
                replaceRegex: /(?:pecorino|parmigiano|grana|formaggi\s+stagionati)/i,
                alternatives: [
                    { label: "Ricotta fresca vaccina senza sale", replaceWith: "100g ricotta fresca senza sale", icon: "🧀" },
                    { label: "Fiocchi di latte magri", replaceWith: "150g fiocchi di latte magri", icon: "🧀" }
                ]
            }
        ]
    },
    'ipercolesterolemia': {
        name: "Ipercolesterolemia (Controllo LDL)",
        emoji: "🔬",
        items: [
            {
                pattern: /(?:burro|panna|lardo|strutto)/i,
                keyword: 'grassi saturi da condimento',
                explain: "Aumentano la concentrazione ematica di colesterolo 'cattivo' LDL.",
                replaceRegex: /(?:burro|panna|lardo|strutto)/i,
                alternatives: [
                    { label: "1 cucchiaio Olio EVO a crudo", replaceWith: "1 cucch. olio EVO", icon: "🫒" },
                    { label: "Granella di noci (Omega-3)", replaceWith: "granella di noci", icon: "🥜" }
                ]
            },
            {
                pattern: /(?:carni\s+rosse\s+grasse|insaccat|wurstel|fegato)/i,
                keyword: 'carni grasse e insaccati',
                explain: "Apportano elevate quantità di acidi grassi saturi e colesterolo.",
                replaceRegex: /(?:carni\s+rosse\s+grasse|insaccat\w*|wurstel|fegato)/i,
                alternatives: [
                    { label: "200g Salmone al forno (Omega-3 protettivo)", replaceWith: "200g salmone al forno", icon: "🐟" },
                    { label: "150g Lenticchie in umido (fibre solubili)", replaceWith: "150g lenticchie in umido", icon: "🧆" },
                    { label: "150g Petto di Tacchino ai ferri", replaceWith: "150g petto di tacchino ai ferri", icon: "🍗" }
                ]
            }
        ]
    },
    'reflusso': {
        name: "Reflusso Gastroesofageo (MRGE)",
        emoji: "🔥",
        items: [
            {
                pattern: /(?:pomodoro|pomodori|passata|salsa)/i,
                keyword: 'pomodori e salse acide',
                explain: "Il pomodoro è fortemente acido e irrita la mucosa esofagea.",
                replaceRegex: /(?:pomodor(?:o|i)|passata|salsa(?:\s+al\s+pomodoro)?)/i,
                alternatives: [
                    { label: "Crema delicata di zucchine e patate", replaceWith: "crema delicata di zucchine", icon: "🥣" },
                    { label: "Carote e zucchine al vapore", replaceWith: "carote e zucchine al vapore", icon: "🥕" }
                ]
            },
            {
                pattern: /(?:caffè|caffe|cioccolato|cacao|menta)/i,
                keyword: 'caffè / cioccolato / menta',
                explain: "Rilassano lo sfintere esofageo inferiore favorendo la risalita acida.",
                replaceRegex: /(?:caffè|caffe|cioccolato|cacao|menta)/i,
                alternatives: [
                    { label: "Tazza di Orzo biologico", replaceWith: "tazza di orzo biologico", icon: "☕" },
                    { label: "Tisana protettiva alla Malva", replaceWith: "tisana alla malva", icon: "🫖" }
                ]
            }
        ]
    }
};

// Funzione helper per ripulire il testo della cella da tag o pulsanti aggiunti
function getCleanCellText(elOrHtml) {
    if (!elOrHtml) return "";
    let html = (typeof elOrHtml === 'string') ? elOrHtml : (elOrHtml.innerHTML || elOrHtml.innerText || "");
    let temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('.quick-fix-container, .bad-food-warn-icon, .badge-click-fix').forEach(e => e.remove());
    return temp.innerText.trim();
}

function escapeRegexString(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\function reanalyzeAllTables() {');
}

// Cerca l'alimento problematico nel testo per la specifica patologia
function findBadFoodInText(text, pathologyKey) {
    if (!text || !pathologyKey) return null;
    let patObj = pathologyDb[pathologyKey];
    if (!patObj) return null;

    let lowText = text.toLowerCase();

    // 1. Cerca nel database dettagliato delle alternative
    let altCategory = foodAlternativesDb[pathologyKey];
    if (altCategory && altCategory.items) {
        for (let item of altCategory.items) {
            let m = text.match(item.pattern);
            if (m) {
                return {
                    matchedWord: m[0],
                    item: item,
                    pathologyKey: pathologyKey,
                    pathologyName: patObj.name,
                    explain: item.explain,
                    alternatives: item.alternatives,
                    replaceRegex: item.replaceRegex
                };
            }
        }
    }

    // 2. Se non c'è match specifico, cerca nelle parole 'bad' generali della patologia
    if (patObj.bad && patObj.bad.length > 0) {
        for (let b of patObj.bad) {
            if ((b === 'dolce' || b === 'dolci') && lowText.includes('patate dolci')) continue;
            if ((b === 'fritto' || b === 'fritti' || b === 'frittura') && lowText.includes('soffritto')) continue;
            if (lowText.includes(b)) {
                // Trova la parola corrispondente nel testo originale
                let regex = new RegExp('(\\b\\w*' + escapeRegexString(b) + '\\w*\\b)', 'i');
                let wordMatch = text.match(regex);
                let matchedWord = wordMatch ? wordMatch[0] : b;

                // Crea alternative dai cibi 'good' della patologia
                let fallbackAlts = (patObj.good || []).slice(0, 3).map(g => ({
                    label: g.charAt(0).toUpperCase() + g.slice(1),
                    replaceWith: g,
                    icon: "🥗"
                }));

                return {
                    matchedWord: matchedWord,
                    pathologyKey: pathologyKey,
                    pathologyName: patObj.name,
                    explain: patObj.badExplain || "Alimento sconsigliato per questa condizione clinica.",
                    alternatives: fallbackAlts,
                    replaceRegex: new RegExp(escapeRegexString(matchedWord), 'i')
                };
            }
        }
    }

    return null;
}

// Formatta la cella con evidenziazione e pulsante di correzione rapida
function formatCellWithWarnings(cell, pathologyKey) {
    if (!cell || !cell.classList.contains('editable-cell')) return;
    if (document.activeElement === cell) return; // Se l'utente sta scrivendo, non toccare

    let cleanText = getCleanCellText(cell);
    if (!cleanText || cleanText.length < 3) return;

    let badInfo = findBadFoodInText(cleanText, pathologyKey);
    if (!badInfo) {
        cell.innerHTML = cleanText;
        return;
    }

    let matchWord = badInfo.matchedWord;
    let regex = new RegExp('(' + escapeRegexString(matchWord) + ')', 'gi');
    let highlightedText = cleanText.replace(regex, '<span class="bad-food-term" title="Alimento sconsigliato per ' + badInfo.pathologyName + '. Clicca per correggere in 1 click!" onclick="openFoodCorrectorFromElement(this, event)">$1 <span class="bad-food-warn-icon" contenteditable="false">⚠️</span></span>');

    let chipHtml = '<div contenteditable="false" class="quick-fix-container no-print-preview">' +
        '<button type="button" class="quick-fix-chip" onclick="openFoodCorrectorFromElement(this, event)" title="Clicca per visualizzare le alternative sane raccomandate">' +
        '<span>⚠️ Correggi \'' + matchWord + '\'</span> ' +
        '<span class="badge-click-fix">1-Click ⚡</span>' +
        '</button></div>';

    cell.innerHTML = highlightedText + chipHtml;
}

// Apri modale del correttore al click su alimento o pulsante chip
window.openFoodCorrectorFromElement = function (el, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    let cell = el.closest('td.editable-cell');
    if (!cell) return;

    let row = cell.closest('tr');
    let dayName = row ? (row.querySelector('.day-cell') ? row.querySelector('.day-cell').innerText : 'Giorno') : '';
    let colIndex = cell.cellIndex;
    let mealName = (colIndex === 1) ? "Pranzo" : (colIndex === 2) ? "Cena" : "Spuntini";

    let currentProf = (typeof getProfileForElement === 'function') ? getProfileForElement(cell) : (window.activeProfile || 'marito');
    let profName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(currentProf) : currentProf;
    let pathologyKey = (typeof getProfilePathology === 'function') ? getProfilePathology(currentProf) : (localStorage.getItem('pathology_' + currentProf) || 'steatosi');

    let cleanText = getCleanCellText(cell);
    let badInfo = findBadFoodInText(cleanText, pathologyKey);
    if (!badInfo) {
        if (typeof showToast === 'function') showToast("Nessun alimento a rischio rilevato in questo pasto.", "#16a34a");
        return;
    }

    let modal = document.getElementById('food-corrector-modal');
    if (!modal) return;

    document.getElementById('corrector-profile-name').innerText = profName;
    document.getElementById('corrector-meal-badge').innerText = dayName + ' (' + mealName + ')';

    let pObj = pathologyDb[pathologyKey] || { name: 'Condizione Clinica', emoji: '🩺' };
    document.getElementById('corrector-pathology-name').innerHTML = pObj.emoji + ' ' + pObj.name;

    document.getElementById('corrector-bad-word').innerHTML = '⚠️ "' + badInfo.matchedWord + '"';
    document.getElementById('corrector-explanation').innerText = badInfo.explain || pObj.badExplain;

    let container = document.getElementById('corrector-options-container');
    container.innerHTML = '';

    let alts = badInfo.alternatives || [];
    alts.forEach(alt => {
        let optBtn = document.createElement('div');
        optBtn.className = 'corrector-option-card';
        optBtn.innerHTML = '<div style="display:flex; align-items:center; gap:12px;">' +
            '<span style="font-size:1.6rem;">' + (alt.icon || '✨') + '</span>' +
            '<div>' +
            '<strong style="color:#0f172a; font-size:1.02rem; display:block;">' + alt.label + '</strong>' +
            '<span style="color:#15803d; font-size:0.82rem; font-weight:600;">Scelta sana protettiva raccomandata ✓</span>' +
            '</div>' +
            '</div>' +
            '<button type="button" class="apply-fix-btn">' +
            '<span>⚡ Sostituisci in 1 Click</span>' +
            '</button>';

        optBtn.onclick = () => {
            applyFoodCorrection(cell, badInfo, alt.replaceWith);
            modal.style.display = 'none';
        };

        container.appendChild(optBtn);
    });

    modal.style.display = 'flex';
};

// Sostituzione istantanea e ricalcolo in 1 Click
function applyFoodCorrection(cell, badInfo, replacement) {
    if (!cell) return;
    let cleanText = getCleanCellText(cell);
    let newText = cleanText;

    if (badInfo.replaceRegex && badInfo.replaceRegex.test(cleanText)) {
        newText = cleanText.replace(badInfo.replaceRegex, replacement);
    } else {
        let regex = new RegExp(escapeRegexString(badInfo.matchedWord), 'i');
        newText = cleanText.replace(regex, replacement);
    }

    if (cell.id) {
        localStorage.setItem(cell.id, newText);
    }

    cell.innerHTML = newText;

    let table = cell.closest('.weekly-table');
    let row = cell.closest('tr');
    let tables = Array.from(document.querySelectorAll('.weekly-table'));
    let tableIndex = tables.indexOf(table);
    let rows = Array.from(table.querySelectorAll('tbody tr'));
    let rowIndex = rows.indexOf(row);
    if (tableIndex !== -1 && rowIndex !== -1 && typeof syncCell === 'function') {
        syncCell(tableIndex, rowIndex, cell.cellIndex, newText);
    }

    let currentProf = (typeof getProfileForElement === 'function') ? getProfileForElement(cell) : (window.activeProfile || 'marito');
    let pathologyKey = (typeof getProfilePathology === 'function') ? getProfilePathology(currentProf) : 'steatosi';
    formatCellWithWarnings(cell, pathologyKey);

    if (row) {
        const event = new Event('input', { bubbles: true });
        row.dispatchEvent(event);
    }

    if (typeof showToast === 'function') {
        showToast("🎉 Perfetto! Ingrediente sostituito con successo. Ora il pasto è 100% protettivo 💚", "#16a34a");
    }
}

// Funzione globale per aggiornare tutte le celle quando cambia la patologia
function refreshAllCellWarnings() {
    const tables = document.querySelectorAll('.weekly-table');
    tables.forEach(table => {
        let currentProf = (typeof getProfileForElement === 'function') ? getProfileForElement(table) : (window.activeProfile || 'marito');
        let patKey = (typeof getProfilePathology === 'function') ? getProfilePathology(currentProf) : 'steatosi';

        const cells = table.querySelectorAll('tbody td.editable-cell');
        cells.forEach(cell => {
            formatCellWithWarnings(cell, patKey);
        });
    });
}


function reanalyzeAllTables() {
    refreshAllCellWarnings();
    const rows = document.querySelectorAll('.weekly-table tbody tr');
    rows.forEach(row => {
        try {
            const event = new Event("input", { bubbles: true });
            row.dispatchEvent(event);
        } catch (e) { }
    });
}

window.openPathologySelectorModal = function (profId) {
    if (!profId) profId = window.activeProfile || 'marito';
    window.currentPathologyModalProf = profId;

    let modal = document.getElementById('pathology-selector-modal');
    if (!modal) return;

    let profNameEl = document.getElementById('pathology_modal_prof_name');
    if (profNameEl) {
        profNameEl.innerText = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profId) : profId;
    }

    let currentPat = getProfilePathology(profId);
    let container = document.getElementById('pathology_grid_container');
    if (container) {
        container.innerHTML = '';
        Object.keys(pathologyDb).forEach(key => {
            let item = pathologyDb[key];
            let isCurrent = (key === currentPat);

            let card = document.createElement('div');
            card.style.background = isCurrent ? '#f0fdf4' : '#ffffff';
            card.style.border = isCurrent ? '2.5px solid #16a34a' : '1.5px solid #e2e8f0';
            card.style.borderRadius = '12px';
            card.style.padding = '14px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s ease-in-out';
            card.style.position = 'relative';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.boxShadow = isCurrent ? '0 4px 12px rgba(22, 163, 74, 0.15)' : '0 2px 5px rgba(0,0,0,0.03)';

            card.onmouseover = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; };
            card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = isCurrent ? '0 4px 12px rgba(22, 163, 74, 0.15)' : '0 2px 5px rgba(0,0,0,0.03)'; };

            card.onclick = () => {
                setProfilePathology(profId, key);
                modal.style.display = 'none';
            };

            let activeBadge = isCurrent ? `<span style="background:#16a34a; color:white; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:auto;">ATTIVO ✓</span>` : '';

            card.innerHTML = `
                <div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <span style="font-size:1.4rem;">${item.emoji}</span>
                        <strong style="font-size:0.95rem; color:#1e293b;">${item.name}</strong>
                        ${activeBadge}
                    </div>
                    <div style="font-size:0.8rem; color:#0284c7; font-weight:700; margin-bottom:6px;">
                        ${item.badgeText}
                    </div>
                    <div style="font-size:0.82rem; color:#64748b; line-height:1.35; margin-bottom:8px;">
                        ${item.desc}
                    </div>
                </div>
                <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #e2e8f0; font-size:0.78rem; color:#15803d; font-style:italic;">
                    💡 ${item.goldenRule.length > 80 ? item.goldenRule.slice(0, 80) + '...' : item.goldenRule}
                </div>
            `;

            container.appendChild(card);
        });
    }

    modal.style.display = 'flex';
};

window.populatePathologySelectOptions = function (selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    Object.keys(pathologyDb).forEach(key => {
        let opt = document.createElement('option');
        opt.value = key;
        opt.innerText = `${pathologyDb[key].emoji} ${pathologyDb[key].name}`;
        selectEl.appendChild(opt);
    });
};

function calculateCaloriesFromText(text) {
    text = text.toLowerCase();

    const db = [
        { keys: ['pollo', 'tacchino', 'carne bianca'], kcal: 1.1, emoji: '🍗' },
        { keys: ['carne rossa', 'manzo', 'vitello', 'maiale', 'bistecca'], kcal: 1.5, emoji: '🥩' },
        { keys: ['salmone'], kcal: 2.1, emoji: '🍣' },
        { keys: ['sgombro'], kcal: 2.6, emoji: '🐟' },
        { keys: ['orata', 'branzino', 'merluzzo', 'nasello', 'pesce'], kcal: 0.9, emoji: '🐟' },
        { keys: ['tonno'], kcal: 1.0, emoji: '🐟' },
        { keys: ['riso', 'farro', 'quinoa', 'avena', 'cereali'], kcal: 3.5, emoji: '🍚' },
        { keys: ['pasta', 'spaghetti', 'maccheroni'], kcal: 3.5, emoji: '🍝' },
        { keys: ['pane', 'panino', 'segale'], kcal: 2.5, emoji: '🍞' },
        { keys: ['pizza'], kcal: 2.7, emoji: '🍕' },
        { keys: ['yogurt'], kcal: 0.6, emoji: '🥣' },
        { keys: ['fiocchi di latte', 'ricotta', 'formaggio magro'], kcal: 0.9, emoji: '🧀' },
        { keys: ['formaggio', 'grana', 'parmigiano', 'mozzarella'], kcal: 3.5, emoji: '🧀' },
        { keys: ['lenticchie', 'ceci', 'fagioli', 'piselli', 'legumi'], kcal: 1.0, emoji: '🧆' },
        { keys: ['mandorle', 'noci', 'arachidi', 'frutta secca'], kcal: 6.0, emoji: '🥜' },
        { keys: ['latte'], kcal: 0.5, emoji: '🥛' },
        { keys: ['zucchine', 'broccoli', 'spinaci', 'finocchi', 'insalata', 'rucola', 'verdura', 'carciofi', 'carote'], kcal: 0.2, emoji: '🥗' },
        { keys: ['pomodori', 'pomodoro'], kcal: 0.2, emoji: '🍅' },
        { keys: ['patate', 'patata'], kcal: 0.8, emoji: '🥔' },
        { keys: ['patatine', 'patatina', 'patatine fritte', 'chips'], kcal: 5.0, emoji: '🍟' },
        { keys: ['cioccolato', 'cioccolatino', 'nutella'], kcal: 5.5, emoji: '🍫' },
        { keys: ['snack', 'biscotti', 'merendina', 'cornetto', 'brioche'], kcal: 4.5, emoji: '🥐' },
        { keys: ['mela', 'pera', 'banana', 'arancia', 'frutta', 'frutto', 'pesca', 'albicocca', 'kiwi'], kcal: 0.5, emoji: '🍎' },
        { keys: ['olio', 'evo'], kcal: 9.0, emoji: '🫒' },
        { keys: ['gallette', 'galletta'], kcal: 0.4, emoji: '🍘' },
        { keys: ['marmellata'], kcal: 2.0, emoji: '🍯' },
        { keys: ['kefir'], kcal: 0.5, emoji: '🥣' },
        { keys: ['barretta'], kcal: 1.5, emoji: '🍫' },
        { keys: ['burro'], kcal: 6.0, emoji: '🧈' },
        { keys: ['mirtilli', 'lamponi', 'fragole', 'frutti rossi'], kcal: 0.5, emoji: '🫐' },
        { keys: ['crackers', 'cracker'], kcal: 4.5, emoji: '🥪' },
        { keys: ['olive'], kcal: 1.5, emoji: '🫒' }
    ];

    const units = {
        'uova': 70, 'uovo': 70,
        'cucch': 90, 'cucchiaio': 90, 'cucchiaino': 45,
        'fette': 40, 'fetta': 40,
        'frutto': 70, 'mela': 70, 'banana': 90, 'arancia': 60, 'galletta': 35, 'gallette': 35, 'barretta': 150, 'pacchetto': 120, 'uovo sodo': 70, 'gelato': 250, 'cornetto': 250, 'brioche': 250, 'biscotto': 50, 'biscotti': 50, 'cioccolatino': 50, 'pizza': 800, 'hamburger': 500, 'panino': 300, 'piadina': 350,
        'caffè': 5, 'caffe': 5, 'macchiato': 15, 'cappuccino': 80, 'briochina': 150
    };

    let total = 0;

    text = text.replace(/ e /g, ',').replace(/\+/g, ',');
    let items = text.split(',');

    for (let item of items) {
        let m = item.trim();
        if (!m) continue;

        // --- MANUALE: Se l'utente scrive esplicitamente "XXX kcal" (es: "Pizza 800 kcal") ---
        let explicitKcal = m.match(/(\d+(?:[\.,]\d+)?)\s*kcal/);
        if (explicitKcal) {
            total += parseFloat(explicitKcal[1].replace(',', '.'));
            continue;
        }

        // Match custom recipes exactly first (ignoring special chars like emoji)
        customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];
        let foundCustom = false;
        let strip = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let cleanM = strip(m);

        if (cleanM.length > 0) {
            for (let cr of customRecipes) {
                if (cr.isCustom && cleanM === strip(cr.text)) {
                    total += cr.kcal;
                    foundCustom = true;
                    break;
                }
            }
        }
        if (foundCustom) continue;

        let numMatch = m.match(/(\d+(?:[\.,]\d+)?)/);
        let hasNum = numMatch !== null;
        let num = hasNum ? parseFloat(numMatch[1].replace(',', '.')) : 1;

        if (hasNum && num === 0) continue;

        let added = false;
        for (let u in units) {
            if (m.includes(u)) {
                total += num * units[u];
                added = true;
                break;
            }
        }

        if (!added) {
            for (let dbItem of db) {
                if (dbItem.keys.some(k => m.includes(k))) {
                    let multiplier = num;
                    if (!hasNum) {
                        multiplier = 100; // default 100g se non specificato
                        if (m.includes('latte') && !m.includes('cioccolato')) multiplier = 50; // default 50ml per latte
                    }
                    total += multiplier * dbItem.kcal;
                    break;
                }
            }
        }
    }

    return Math.round(total);
}

// ---- SINCRONIZZAZIONE MENU A DUE VIE & UNDO ----
let lastSyncBackup = null;

function undoLastSync() {
    if (!lastSyncBackup) return;

    let targetCell = document.getElementById(lastSyncBackup.targetId);
    if (targetCell) {
        // Ripristina il testo vecchio
        targetCell.innerHTML = lastSyncBackup.oldText;
        localStorage.setItem(lastSyncBackup.targetId, lastSyncBackup.oldText);

        // Ricalcola Kcal
        const event = new Event('input', { bubbles: true });
        targetCell.parentNode.dispatchEvent(event);
    }

    // Nasconde il tasto Annulla
    const undoBtn = document.getElementById('undoSyncBtn');
    if (undoBtn) undoBtn.style.display = 'none';
    lastSyncBackup = null;

    // Disattiva in automatico la spunta per facilitare l'utente
    document.getElementById('syncMenus').checked = false;
    showCustomAlert("Sincronizzazione annullata e pasto ripristinato!\n\nHo anche spento l'interruttore 'Sincronizza Pranzi e Cene' in alto, così ora puoi modificare le due tabelle in modo indipendente.");
}

function getTargetProfilesToSync(sourceProf) {
    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
    let targets = [];

    let sourceSetting = localStorage.getItem('syncTarget_' + sourceProf);
    if (!sourceSetting) {
        if (sourceProf === 'marito' && profiles.includes('moglie')) sourceSetting = 'moglie';
        else if (sourceProf === 'moglie' && profiles.includes('marito')) sourceSetting = 'marito';
        else sourceSetting = 'none';
    }

    if (sourceSetting === 'all') {
        profiles.forEach(p => {
            if (p !== sourceProf && !targets.includes(p)) targets.push(p);
        });
    } else if (sourceSetting !== 'none' && profiles.includes(sourceSetting)) {
        targets.push(sourceSetting);
    }

    // Se un altro profilo segue sourceProf (es. Carmela segue Ciro), sincronizziamo anche verso di lui
    profiles.forEach(other => {
        if (other !== sourceProf && !targets.includes(other)) {
            let otherSetting = localStorage.getItem('syncTarget_' + other);
            if (otherSetting === sourceProf || otherSetting === 'all') {
                targets.push(other);
            }
        }
    });

    return targets;
}

function syncCell(sourceTable, rowIdx, sourceCol, newText) {
    const syncCheckbox = document.getElementById('syncMenus');
    if (!syncCheckbox || !syncCheckbox.checked) return;

    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
    let sourceProf = profiles[sourceTable];
    if (!sourceProf) return;

    let targets = getTargetProfilesToSync(sourceProf);
    if (!targets || targets.length === 0) return;

    // Con le tabelle attuali dinamiche: col 1 = Pranzo, col 2 = Cena, col 3 = Spuntini
    let targetCol = sourceCol;

    targets.forEach(targetProf => {
        let targetTable = profiles.indexOf(targetProf);
        if (targetTable === -1) return;

        let targetId = `menuEdit_${targetTable}_r${rowIdx}_c${targetCol}`;
        let targetCell = document.getElementById(targetId);
        if (targetCell && targetCell.innerHTML !== newText) {

            // Prima di sovrascrivere, salvo un backup per il tasto "Annulla"
            lastSyncBackup = {
                targetId: targetId,
                oldText: targetCell.innerHTML
            };
            const undoBtn = document.getElementById('undoSyncBtn');
            if (undoBtn) undoBtn.style.display = 'inline-block';
            const topUndo = document.getElementById('quickUndoTopBtn');
            if (topUndo) topUndo.style.display = 'inline-flex';

            // Sovrascrive la cella
            targetCell.innerHTML = newText;
            localStorage.setItem(targetId, newText);

            // Forza il ricalcolo delle Kcal della riga di destinazione
            const event = new Event('input');
            targetCell.parentNode.dispatchEvent(event);
        }
    });
}

// ---- POPUP SUGGERIMENTI PASTI ----
let currentActiveCell = null;

function showSuggestions(cell) {
    // Non mostrare per la colonna Kcal (l'ultima)
    if (cell.cellIndex === cell.parentNode.cells.length - 1) return;

    currentActiveCell = cell;
    const popup = document.getElementById('meal-suggestions');
    const rect = cell.getBoundingClientRect();

    // Controlla se siamo nella colonna Colazione, Pranzo o Cena
    let headerText = cell.closest('table').querySelectorAll('th')[cell.cellIndex].innerText.toLowerCase();

    // --- CALCOLO BUDGET CALORICO ---
    let row = cell.closest('tr');
    let cellsInRow = row.querySelectorAll('.editable-cell');
    let kcalSoFar = 0;
    cellsInRow.forEach(c => {
        if (c !== cell) {
            kcalSoFar += calculateCaloriesFromText(c.innerText);
        }
    });

    // Target medio giornaliero: ~1400 kcal
    let mealBudget = 1400 - kcalSoFar;
    if (mealBudget < 0) mealBudget = 0;

    let suggs = [];

    if (headerText.includes('colazione')) {
        suggs = [
            { name: "🥣 Yogurt & Frutta", text: "150g yogurt greco, 1 frutto, 10 mandorle" },
            { name: "🥛 Latte & Fette", text: "150ml latte parz. scremato, 3 fette biscottate" },
            { name: "🌾 Porridge d'Avena", text: "150ml latte, 30g avena" },
            { name: "🍳 Uova & Pane", text: "2 uova, 1 fetta pane segale" },
            { name: "🍞 Fette & Marmellata", text: "3 fette biscottate, 2 cucch. marmellata light, 150ml latte" },
            { name: "🥪 Toast Prosciutto", text: "2 fette pane, 50g affettato magro, 1 spremuta" },
            { name: "🥞 Pancake Proteici", text: "Pancake (albume, 30g avena), 1 cucch. burro arachidi" }
        ];
    } else if (headerText.includes('pranzo')) {
        suggs = [
            { name: "🍗 Pollo & Riso", text: "150g pollo, 70g riso basmati, insalata, 1 cucch olio" },
            { name: "🦃 Tacchino & Farro", text: "150g fesa tacchino, 70g farro, pomodorini, 1 cucch olio" },
            { name: "🧀 Fiocchi & Quinoa", text: "150g fiocchi di latte, 70g quinoa, cetrioli, 1 cucch olio" },
            { name: "🍳 Uova & Pane Integrale", text: "2 uova, 70g pane integrale, spinaci, 1 cucch olio" },
            { name: "🥩 Tagliata & Patate", text: "150g carne magra, 150g patate al forno, 1 cucch olio" }
        ];
    } else if (headerText.includes("spuntini")) {
        suggs = [
            { name: "🍎 Frutto fresco", text: "1 mela o 1 arancia" },
            { name: "🥜 Noci/Mandorle", text: "15g noci o mandorle" },
            { name: "🥄 Yogurt", text: "100g yogurt magro" },
            { name: "🧀 Parmigiano", text: "20g formaggio grana" },
            { name: "🍫 Cioccolato", text: "15g cioccolato fondente 85%" },
            { name: "🥚 Uovo sodo", text: "1 uovo sodo" },
            { name: "🍘 Gallette", text: "2 gallette di riso/mais" },
            { name: "🍞 Fetta + Marmellata", text: "1 fetta biscottata con marmellata" },
            { name: "🥕 Verdure crude", text: "Finocchi, carote o sedano" },
            { name: "🥣 Kefir", text: "150ml di kefir bianco" },
            { name: "🍫 Barretta", text: "1 barretta proteica" },
            { name: "🥜 Burro arachidi", text: "1 cucchiaino su 1 galletta" },
            { name: "🫐 Frutti rossi", text: "150g di mirtilli/lamponi" },
            { name: "🥪 Crackers", text: "1 pacchetto crackers integrali" },
            { name: "🫒 Olive", text: "10 olive verdi o nere" }
        ];
    } else {
        suggs = [
            { name: "🐟 Salmone & Zucchine", text: "200g salmone al forno, zucchine, 1 cucch olio" },
            { name: "🐠 Merluzzo & Broccoli", text: "200g merluzzo, broccoli, 1 cucch olio" },
            { name: "🍗 Pollo & Insalata", text: "150g pollo ai ferri, insalata mista, 1 cucch olio" },
            { name: "🍳 Frittata & Carciofi", text: "2 uova in frittata, carciofi, 1 cucch olio" },
            { name: "🥗 Tonno & Pomodorini", text: "150g tonno al naturale, pomodorini, 1 cucch olio" },
            { name: "🐟 Salmone, Patate & Zucchine", text: "200g salmone al forno, 150g patate, zucchine, 1 cucch olio" },
            { name: "🍗 Pollo, Riso & Insalata", text: "150g petto di pollo, 50g riso basmati, insalata, 1 cucch olio" }
        ];
    }

    // Calcola le kcal di ogni suggerimento e la differenza dal budget
    customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];
    customRecipes.forEach(cr => {
        let isMatch = false;
        if (!cr.category || cr.category === 'all') {
            isMatch = true;
        } else if (cr.category === 'colazione' && headerText.includes('colazione')) {
            isMatch = true;
        } else if (cr.category === 'spuntini' && headerText.includes('spuntini')) {
            isMatch = true;
        } else if (cr.category === 'pranzo_cena' && (headerText.includes('pranzo') || headerText.includes('cena'))) {
            isMatch = true;
        }

        if (isMatch) {
            suggs.push({ name: `👩‍🍳 ${cr.title}`, text: cr.text });
        }
    });
    suggs.forEach(s => {
        s.kcal = calculateCaloriesFromText(s.text);
        s.diff = Math.abs(s.kcal - mealBudget);
    });

    // Ordina in base a chi si avvicina di più al budget
    suggs.sort((a, b) => a.diff - b.diff);

    let html = `<div class="sugg-header">🎯 Kcal mancanti oggi: <br><b style="color:#2e7d32; font-size:1.1rem;">~${mealBudget} kcal</b></div>`;

    // REGALO 1: Sostituto Pasto Intelligente in cima
    html += `<div class="sugg-btn" onclick="openMealSwapperForCurrentCell()" style="background: linear-gradient(135deg, #e0f2fe, #bae6fd); border: 1px solid #0284c7; color:#0369a1; text-align:center; font-weight:bold; font-size:0.92rem; padding:8px 10px; margin-bottom:10px; box-shadow:0 2px 6px rgba(2,132,199,0.15);">
                🔄 Trova Alternativa / Sostituto Piatto 🪄
             </div>`;

    suggs.forEach((s, idx) => {
        let badge = idx === 0 ? "🌟 " : "";
        let bestStyle = idx === 0 ? "border-color:#4caf50; background:#e8f5e9; font-weight:bold;" : "";
        let safeText = s.text.replace(/'/g, "'").replace(/"/g, '&quot;');
        html += `<div class="sugg-btn" onclick="applySuggestion('${safeText}')" style="${bestStyle}">
                    <span style="flex:1;">${badge}${s.name}</span> <span style="color:#666; font-size:0.8rem; white-space:nowrap; margin-left:10px;">(~${s.kcal} kcal)</span>
                 </div>`;
    });

    html += `<hr style="margin: 10px 0; border: 0; border-top: 1px dashed #ccc;">`;

    // Controlli di sincronizzazione nel popup
    const isSyncOn = document.getElementById('syncMenus') && document.getElementById('syncMenus').checked;
    html += `<div style="font-size: 0.85rem; margin-bottom: 8px;">
                 <label style="cursor:pointer; display:flex; align-items:center; color:#1976d2; font-weight:bold;">
                     <input type="checkbox" onchange="toggleSyncFromPopup(this.checked)" ${isSyncOn ? 'checked' : ''} style="margin-right:6px; transform:scale(1.2);">
                     ${(() => {
            let activeP = (typeof activeProfile !== 'undefined') ? activeProfile : 'marito';
            let sTarget = localStorage.getItem('syncTarget_' + activeP);
            if (!sTarget) {
                if (activeP === 'marito') sTarget = 'moglie';
                else if (activeP === 'moglie') sTarget = 'marito';
                else sTarget = 'none';
            }
            if (sTarget === 'all') return '🔗 Sincronizza con Tutta la Famiglia 👨‍👩‍👧‍👦';
            if (sTarget !== 'none') {
                let name = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(sTarget) : sTarget;
                return `🔗 Sincronizza con ${name} 💍`;
            }
            return '🔗 Sincronizzazione (Menù Autonomo 🔓)';
        })()}
                 </label>
             </div>`;

    if (lastSyncBackup) {
        html += `<div class="sugg-btn" onclick="undoLastSync(); closeSuggestions();" style="background:#f57c00; border-color:#ef6c00; color:white; text-align:center; font-weight:bold;">↩️ Annulla Sincronizzazione</div>`;
    }

    html += `<div class="sugg-btn" onclick="openMealSwapperForCurrentCell()" style="background:#e0f2fe; border-color:#0284c7; color:#0369a1; text-align:center; font-weight:bold;">🔄 Sostituisci Questo Pasto 🪄</div>
    <div class="sugg-btn" onclick="openRecipeBookForCell()" style="background:#e3f2fd; border-color:#2196f3; color:#1976d2; text-align:center; font-weight:bold;">📖 Sfoglia Ricettario Completo</div>`;
    html += `<div class="sugg-btn" onclick="closeAndFocus()" style="background:#ffebee; border-color:#ffcdd2; color:#c62828; text-align:center;">❌ Chiudi o Scrivi a mano</div>`;

    popup.innerHTML = html;
    popup.style.display = 'block';

    // Posizionamento centrale come modal
    popup.style.position = 'fixed';
    popup.style.top = '50%';

    // Centra il popup orizzontalmente rispetto alla cella
    let leftPos = '50%';

    // Evita che esca dai bordi dello schermo
    if (leftPos < 10) leftPos = 10;
    if (leftPos + 330 > window.innerWidth) {
        leftPos = window.innerWidth - 340;
    }

    popup.style.left = leftPos;
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.zIndex = '9999';
    popup.style.boxShadow = '0 15px 50px rgba(0,0,0,0.5)';
    popup.style.maxHeight = '90vh';
    popup.style.overflowY = 'auto';
}

function applySuggestion(text) {
    if (currentActiveCell) {
        let clean = getCleanCellText(text);
        currentActiveCell.innerHTML = clean;
        localStorage.setItem(currentActiveCell.id, clean);

        // Estrai gli indici per la sincronizzazione
        let parts = currentActiveCell.id.split('_'); // es: menuEdit_0_r2_c1
        if (parts.length === 4) {
            let tIdx = parseInt(parts[1]);
            let rIdx = parseInt(parts[2].replace('r', ''));
            let cIdx = parseInt(parts[3].replace('c', ''));
            syncCell(tIdx, rIdx, cIdx, clean);
        }

        let prof = (typeof getProfileForElement === 'function') ? getProfileForElement(currentActiveCell) : (window.activeProfile || 'marito');
        let pat = (typeof getProfilePathology === 'function') ? getProfilePathology(prof) : 'steatosi';
        if (typeof formatCellWithWarnings === 'function') {
            formatCellWithWarnings(currentActiveCell, pat);
        }

        // Forza il ricalcolo Kcal sulla riga
        const event = new Event('input', { bubbles: true });
        currentActiveCell.parentNode.dispatchEvent(event);
    }
    closeSuggestions();
}

function resetMenus() {
    showCustomConfirm("Sei sicuro di voler cancellare TUTTE le modifiche ai pasti e tornare al menù originale impostato da me? (Non perderai i dati del peso)", function () {
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key && key.startsWith('menuEdit_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        location.reload();
    });
}

function toggleSyncFromPopup(isChecked) {
    const mainCheckbox = document.getElementById('syncMenus');
    if (mainCheckbox) mainCheckbox.checked = isChecked;
}

function closeSuggestions() {
    const popup = document.getElementById('meal-suggestions');
    if (popup) popup.style.display = 'none';
}

function closeAndFocus() {
    closeSuggestions();
    if (currentActiveCell) {
        currentActiveCell.focus();
        if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
            let range = document.createRange();
            range.selectNodeContents(currentActiveCell);
            range.collapse(false);
            let sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
}

// Chiudi cliccando fuori
document.addEventListener('click', function (e) {
    const popup = document.getElementById('meal-suggestions');
    if (popup && popup.style.display === 'block') {
        if (!popup.contains(e.target) && !e.target.classList.contains('editable-cell')) {
            closeSuggestions();
        }
    }
});

// ---- TABELLE MENU MODIFICABILI ----
function initEditableMenus() {
    const tables = document.querySelectorAll('.weekly-table');
    tables.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td');

            // La colonna 0 è il Giorno, le altre sono editabili (inclusa la colonna Kcal)
            for (let i = 1; i < cells.length - 1; i++) {
                let cell = cells[i];
                cell.setAttribute('contenteditable', 'true');
                cell.classList.add('editable-cell');
                cell.title = "Clicca per modificare questo pasto";

                let cellId = `menuEdit_${tableIndex}_r${rowIndex}_c${i}`;
                cell.id = cellId;

                let savedText = localStorage.getItem(cellId);
                if (savedText !== null) {
                    cell.innerHTML = savedText;
                }

                cell.addEventListener('input', function () {
                    let clean = getCleanCellText(this.innerHTML);
                    localStorage.setItem(cellId, clean);
                    syncCell(tableIndex, rowIndex, i, clean);
                });

                cell.addEventListener('focusin', function () {
                    let clean = getCleanCellText(this.innerHTML);
                    this.innerText = clean;
                });

                cell.addEventListener('focusout', function () {
                    let clean = getCleanCellText(this.innerText);
                    localStorage.setItem(cellId, clean);
                    autoEmoji(this);
                    let cleanAfter = getCleanCellText(this.innerText);
                    localStorage.setItem(cellId, cleanAfter);

                    let prof = (typeof getProfileForElement === 'function') ? getProfileForElement(this) : (window.activeProfile || 'marito');
                    let pat = (typeof getProfilePathology === 'function') ? getProfilePathology(prof) : 'steatosi';
                    formatCellWithWarnings(this, pat);

                    const event = new Event('input', { bubbles: true });
                    this.parentNode.dispatchEvent(event);
                });

                // Mostra popup al click
                cell.addEventListener('dblclick', function () {
                    showSuggestions(this);
                });
            }

            // Aggiungo il ricalcolo automatico sulle righe
            row.addEventListener('input', function () {
                let rowCells = row.querySelectorAll('td.editable-cell');
                let textToParse = "";
                for (let k = 0; k < rowCells.length; k++) {
                    textToParse += getCleanCellText(rowCells[k]) + " , ";
                }

                let calculatedKcal = calculateCaloriesFromText(textToParse);
                let kcalCell = row.querySelectorAll("td")[row.querySelectorAll("td").length - 1];


                let currentProf = (typeof getProfileForElement === 'function') ? getProfileForElement(row) : (window.activeProfile || 'marito');
                let userPathology = (typeof getProfilePathology === 'function') ? getProfilePathology(currentProf) : (localStorage.getItem('pathology_' + currentProf) || 'nessuna');
                let pInfo = (typeof analyzePathology === 'function') ? analyzePathology(textToParse, userPathology) : null;

                let pTag = "";
                if (pInfo && textToParse.replace(/[^a-zA-Z]/g, '').length > 3) {
                    pTag = `<span title="${pInfo.msg}" style="cursor:help; margin-left:8px; font-size:1.2rem;">${pInfo.icon}</span>`;
                }

                if (calculatedKcal > 0) {
                    kcalCell.innerHTML = `<strong>~${calculatedKcal} kcal</strong>${pTag}`;
                } else {
                    kcalCell.innerHTML = `<strong>0 kcal</strong>${pTag}`;
                }
                localStorage.setItem(kcalCell.id, kcalCell.innerHTML);
            });

            // Aggiungo le emoji in automatico on blur

            // --- CLEANUP BUG SPUNTINI ---
            // Se la cella degli Spuntini (c3) contiene "~... kcal" o "0 kcal" per via del bug precedente, la svuotiamo.
            let spuntiniCell = row.querySelectorAll("td")[3];
            if (spuntiniCell && (spuntiniCell.innerText.includes("kcal") || spuntiniCell.innerText.trim() === "0 kcal" || spuntiniCell.innerText.trim() === "0")) {
                spuntiniCell.innerHTML = "";
                localStorage.setItem(spuntiniCell.id, "");
            }

            // Forza ricalcolo all avvio per aggiornare i totali
            setTimeout(() => {
                let prof = (typeof getProfileForElement === 'function') ? getProfileForElement(row) : (window.activeProfile || 'marito');
                let pat = (typeof getProfilePathology === 'function') ? getProfilePathology(prof) : 'steatosi';
                row.querySelectorAll('td.editable-cell').forEach(c => formatCellWithWarnings(c, pat));
                const event = new Event("input", { bubbles: true });
                row.dispatchEvent(event);
            }, 500);

            row.addEventListener('focusout', function (e) {
                if (e.target && e.target.classList.contains('editable-cell') && e.target.cellIndex < row.cells.length - 1) {
                    autoEmoji(e.target);
                    localStorage.setItem(e.target.id, e.target.innerHTML);
                }
            });
        });
    });
}

// ---- RESET COMPLETO ----
function clearAllData() {
    showCustomConfirm("Sei sicuro di voler cancellare TUTTE le modifiche ai pasti e tornare al menù originale impostato da me? (Non perderai i dati del peso)", function () {
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key && key.startsWith('menuEdit_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        location.reload();
    });
}

window.onload = () => {
    if (typeof window.initAllProfiles === 'function') {
        window.initAllProfiles();
    }
};

// ---- STAMPA SOLO LISTA SPESA ----
function printShoppingList() {
    document.body.classList.add('print-shopping-only');
    window.print();
    setTimeout(() => { document.body.classList.remove('print-shopping-only'); }, 500);
}

function checkStreak(profile) {
    let waterCount = parseInt(localStorage.getItem('waterCount_' + profile)) || 0;
    let streakSpan = document.getElementById('streak_' + profile);
    if (!streakSpan) return;

    let target = (typeof getPersonalizedWaterTarget === 'function') ? getPersonalizedWaterTarget(profile).glasses : 8;
    if (waterCount >= target && target > 0) {
        streakSpan.innerHTML = '<span style="background: #ffd54f; color: #212121; font-size: 0.82rem; font-weight: 800; padding: 4px 12px; border-radius: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.25); display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ffca28; vertical-align: middle;">🏅 Obiettivo Acqua Raggiunto!</span>';
    } else {
        streakSpan.innerHTML = '';
    }
}
setInterval(() => {
    let profilesToInit = (typeof globalProfiles !== 'undefined') ? globalProfiles : ['marito', 'moglie'];
    profilesToInit.forEach(profile => checkStreak(profile));
}, 1000);

function shareWhatsApp() {
    let list = document.querySelector('.shopping-list');
    if (!list) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Non c'è nessuna lista della spesa da inviare! Genera prima la lista dal menù settimanale.");
        else alert("Non c'è nessuna lista della spesa da inviare!");
        return;
    }
    let items = list.querySelectorAll('li');
    if (items.length === 0) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Il carrello è vuoto! Genera prima la lista dal menù settimanale.");
        else alert("Il carrello è vuoto!");
        return;
    }
    let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(window.activeProfile || 'marito') : 'Famiglia';
    let text = "🛒 *LISTA DELLA SPESA (Progetto Salute)* 🥗\n";
    text += "👤 Menù di: " + pName + "\n";
    text += "──────────────────────────\n\n";

    let hasItems = false;
    items.forEach(item => {
        let cb = item.querySelector('input');
        let isDone = cb ? cb.checked : false;
        let span = item.querySelector('span');
        let itemName = span ? span.innerText.trim() : item.innerText.trim();
        if (!isDone) {
            text += "◻️ " + itemName + "\n";
            hasItems = true;
        } else {
            text += "✔️ ~" + itemName + "~\n";
            hasItems = true;
        }
    });
    if (!hasItems) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Tutti i prodotti risultano spuntati o la lista è vuota!");
        else alert("Tutti i prodotti risultano spuntati!");
        return;
    }

    text += "\n──────────────────────────\nGenerata con Progetto Salute ✨";

    // Copia sempre negli appunti
    if (typeof copyTextToClipboardUniversal === 'function') {
        copyTextToClipboardUniversal(text);
    }

    let url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    let opened = false;
    if (typeof window.require !== 'undefined') {
        try {
            const { shell } = window.require('electron');
            if (shell && typeof shell.openExternal === 'function') {
                shell.openExternal(url);
                opened = true;
            }
        } catch (e) {
            console.warn("Shell openExternal error:", e);
        }
    }
    if (!opened) {
        window.open(url, '_blank');
    }

    if (typeof showToast === 'function') {
        showToast("📲 WhatsApp avviato nel browser & lista copiata negli appunti!", "#25d366");
    }
}

function saveStats(profile) {
    let dobInput = document.getElementById('dob_' + profile) ? document.getElementById('dob_' + profile).value : '';
    let startEl = document.getElementById('start_' + profile);
    let goalEl = document.getElementById('goal_' + profile);
    let kcalEl = document.getElementById('kcal_' + profile);
    let heightEl = document.getElementById('height_' + profile);

    let saved = localStorage.getItem('profileStats_' + profile);
    let prevStats = saved ? JSON.parse(saved) : {};

    let kcalVal = kcalEl ? kcalEl.innerText.trim() : '';

    // Se le calorie sono vuote o '---', calcola automaticamente su misura
    if (!kcalVal || kcalVal === '---' || isNaN(parseInt(kcalVal))) {
        if (typeof window.autoCalculateKcalDeficit === 'function') {
            kcalVal = window.autoCalculateKcalDeficit(profile, false);
        }
    }

    let stats = {
        dob: dobInput,
        start: startEl ? startEl.innerText.trim() : (prevStats.start || "---"),
        goal: goalEl ? goalEl.innerText.trim() : (prevStats.goal || "---"),
        kcal: kcalVal,
        height: heightEl ? heightEl.innerText.trim() : (prevStats.height || "160"),
        gender: prevStats.gender || 'M'
    };
    localStorage.setItem('profileStats_' + profile, JSON.stringify(stats));

    updateAgeDisplay(profile, dobInput);
    loadProgress(profile);
}

function updateAgeDisplay(profile, dobString) {
    let etaSpan = document.getElementById('eta_' + profile);
    if (!etaSpan) return; if (!dobString) { etaSpan.innerText = '--'; return; }

    let dob = new Date(dobString);
    let today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    let m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    etaSpan.innerText = age;
}

function loadStats(profile) {
    let saved = localStorage.getItem('profileStats_' + profile);
    let stats = saved ? JSON.parse(saved) : {};

    if (stats.dob && document.getElementById('dob_' + profile)) {
        document.getElementById('dob_' + profile).value = stats.dob;
        updateAgeDisplay(profile, stats.dob);
    }
    if (document.getElementById('start_' + profile)) document.getElementById('start_' + profile).innerText = (stats.start && stats.start !== '') ? stats.start : "---";
    if (document.getElementById('goal_' + profile)) document.getElementById('goal_' + profile).innerText = (stats.goal && stats.goal !== '') ? stats.goal : "---";
    if (document.getElementById('height_' + profile)) document.getElementById('height_' + profile).innerText = (stats.height && stats.height !== '' && stats.height !== '---') ? stats.height : "160";

    let kcalEl = document.getElementById('kcal_' + profile);
    if (kcalEl) {
        if (stats.kcal && stats.kcal !== '---' && !isNaN(parseInt(stats.kcal)) && parseInt(stats.kcal) > 0) {
            kcalEl.innerText = stats.kcal;
        } else {
            // Se le calorie non ci sono o mostrano '---', calcolale e salvale in automatico su misura!
            if (typeof window.autoCalculateKcalDeficit === 'function') {
                let computed = window.autoCalculateKcalDeficit(profile, false);
                kcalEl.innerText = computed;
            } else {
                kcalEl.innerText = stats.kcal || '---';
            }
        }
    }
    if (typeof updateMacroTrackerUI === 'function') {
        updateMacroTrackerUI(profile);
    }
}

function printDiet(profile) {
    let profileId = typeof profile === 'string' ? profile : (profile === 0 ? 'marito' : 'moglie');
    let section = document.getElementById('section-' + profileId);
    let targetTable = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];

    if (!targetTable) return;

    let profileName = getProfileDisplayName(profileId);

    // Recupera protocollo e orari salvati per la stampa
    let fastType = localStorage.getItem('fast_type_' + profileId) || '16';
    let fastStart = localStorage.getItem('fast_start_' + profileId) || '20:30';
    let fastEnd = localStorage.getItem('fast_end_' + profileId) || '12:30';
    let eatHours = 24 - (parseInt(fastType) || 16);
    let fastingSubtitle = (fastType !== 'none')
        ? '⏳ Protocollo Digiuno: ' + fastType + ':' + eatHours + ' (' + fastStart + ' - ' + fastEnd + ')'
        : '🍽️ Dieta Libera (Senza vincoli di orario)';

    // Recupera patologia e obiettivo
    let patKey = (typeof getProfilePathology === 'function') ? getProfilePathology(profileId) : 'nessuna';
    let pObj = (typeof pathologyDb !== 'undefined' && pathologyDb[patKey]) ? pathologyDb[patKey] : null;
    let pathologySubtitle = pObj ? ' • ' + pObj.emoji + ' ' + pObj.badgeText : '';

    // Rimuovi vecchio iframe di stampa se presente
    let oldFrame = document.getElementById('diet-print-frame');
    if (oldFrame) oldFrame.remove();

    // Crea un iframe off-screen con dimensioni reali A4
    let printIframe = document.createElement('iframe');
    printIframe.id = 'diet-print-frame';
    printIframe.style.position = 'fixed';
    printIframe.style.left = '-9999px';
    printIframe.style.top = '0';
    printIframe.style.width = '1024px';
    printIframe.style.height = '1400px';
    printIframe.style.border = 'none';
    printIframe.style.zIndex = '-9999';
    document.body.appendChild(printIframe);

    let doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Menu Settimanale - ${profileName}</title>
            <style>
                @page { size: landscape; margin: 10mm; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #111; background: white; margin: 0; }
                h2 { text-align: center; color: #1b5e20; margin: 0 0 6px 0; font-weight: 800; font-size: 22px; }
                .subtitle { text-align: center; color: #475569; margin-bottom: 16px; font-weight: 600; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
                th, td { border: 1px solid #777; padding: 8px 10px; text-align: left; }
                th { background-color: #e8f5e9; color: #1b5e20; font-weight: bold; text-transform: uppercase; font-size: 12px; }
                td { vertical-align: top; }
                .day-cell { font-weight: bold; background: #fafafa; }
                .editable-cell::after { display: none !important; }
                .kcal-cell { font-weight: bold; color: #0284c7; white-space: nowrap; }
                .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
            </style>
        </head>
        <body>
            <h2>🌿 Progetto Salute - Menù Settimanale: ${profileName}</h2>
            <div class="subtitle">${fastingSubtitle}${pathologySubtitle}</div>
            ${targetTable.outerHTML}
            <div class="footer">Generato da Progetto Salute • Stampato il ${new Date().toLocaleDateString('it-IT')}</div>
        </body>
        </html>
    `);
    doc.close();

    // Mantieni l'iframe vivo finché l'utente non ha finito di interagire con la stampante
    printIframe.contentWindow.onafterprint = function () {
        setTimeout(() => {
            if (document.body.contains(printIframe)) {
                printIframe.remove();
            }
        }, 1500);
    };

    setTimeout(() => {
        try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        } catch (e) {
            console.error("Errore stampa iframe:", e);
            window.print();
        }
    }, 350);
}

function clearDiet(prof) {
    showCustomConfirm("Sei sicuro di voler svuotare l'intera settimana per questa persona? (Il menù base e i tuoi appunti scompariranno)", function () {
        let section = document.getElementById('section-' + prof);
        let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[prof === 'marito' ? 0 : 1];
        if (!table) return;

        let cells = table.querySelectorAll('td.editable-cell');
        cells.forEach(c => {
            c.innerText = '';
            localStorage.setItem(c.id, '');
        });

        let rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            let rowCells = row.querySelectorAll('td.editable-cell');
            let kcalCell = row.querySelectorAll("td")[row.querySelectorAll("td").length - 1];
            if (kcalCell) {
                kcalCell.innerHTML = '0 kcal';
                localStorage.setItem(kcalCell.id, '0 kcal');
            }
        });
        location.reload();
    });
}

function autoEmoji(cell) {
    let text = cell.innerText;
    const db = [
        { keys: ['pollo', 'tacchino', 'carne bianca'], emoji: '🍗' },
        { keys: ['carne rossa', 'manzo', 'vitello', 'maiale', 'bistecca'], emoji: '🥩' },
        { keys: ['salmone', 'sushi'], emoji: '🍣' },
        { keys: ['pesce', 'orata', 'branzino', 'sgombro', 'merluzzo', 'tonno'], emoji: '🐟' },
        { keys: ['riso', 'farro', 'quinoa', 'avena', 'cereali'], emoji: '🍚' },
        { keys: ['pasta', 'spaghetti', 'maccheroni'], emoji: '🍝' },
        { keys: ['pane', 'panino', 'segale'], emoji: '🍞' },
        { keys: ['pizza'], emoji: '🍕' },
        { keys: ['yogurt'], emoji: '🥛' },
        { keys: ['formaggio', 'grana', 'parmigiano', 'mozzarella', 'ricotta'], emoji: '🧀' },
        { keys: ['lenticchie', 'ceci', 'fagioli', 'piselli', 'legumi'], emoji: '🧆' },
        { keys: ['mandorle', 'noci', 'arachidi', 'frutta secca'], emoji: '🥜' },
        { keys: ['latte'], emoji: '🥛' },
        { keys: ['zucchine', 'broccoli', 'spinaci', 'finocchi', 'insalata', 'rucola', 'verdura', 'carciofi', 'carote'], emoji: '🥗' },
        { keys: ['pomodori', 'pomodoro'], emoji: '🍅' },
        { keys: ['patate', 'patata'], emoji: '🥔' },
        { keys: ['patatine', 'patatina', 'patatine fritte', 'chips'], emoji: '🍟' },
        { keys: ['cioccolato', 'cioccolatino', 'nutella'], emoji: '🍫' },
        { keys: ['snack', 'biscotti', 'merendina', 'cornetto', 'brioche'], emoji: '🥐' },
        { keys: ['frutta', 'mela', 'pera', 'banana', 'arancia', 'pesca', 'albicocca', 'kiwi'], emoji: '🍎' },
        { keys: ['uova', 'uovo', 'frittata'], emoji: '🍳' },
        { keys: ['olio', 'evo'], emoji: '🫒' },
        { keys: ['gallette', 'galletta'], emoji: '🍘' },
        { keys: ['marmellata'], emoji: '🍯' },
        { keys: ['kefir'], emoji: '🥣' },
        { keys: ['barretta'], emoji: '🍫' },
        { keys: ['burro'], emoji: '🧈' },
        { keys: ['mirtilli', 'lamponi', 'fragole', 'frutti rossi'], emoji: '🫐' },
        { keys: ['crackers', 'cracker'], emoji: '🥪' },
        { keys: ['olive'], emoji: '🫒' }
    ];
    let items = text.split(',');
    let modified = false;
    for (let i = 0; i < items.length; i++) {
        let m = items[i].trim().toLowerCase();
        let matchedEmoji = null;
        for (let dbItem of db) {
            if (dbItem.keys.some(k => m.includes(k))) {
                matchedEmoji = dbItem.emoji;
                break;
            }
        }
        if (matchedEmoji && !items[i].includes(matchedEmoji)) {
            items[i] = items[i].trim() + ' ' + matchedEmoji;
            modified = true;
        }
    }
    if (modified) {
        cell.innerText = items.join(', ');
    }
}

// ---- RICETTARIO MAGICO ----
const defaultRecipes = [
    { title: "Crostini con crema di lenticchie e alici", text: "Fette di pane tostato, crema di lenticchie, 1 filetto di alice, 1 cucch. olio evo", kcal: 250, emoji: "🥖", img: "crostini_lenticchie.jpg" },
    { title: "Pasta e lenticchie sprint", text: "70g pasta corta, lenticchie cotte, soffritto di alici, aglio, peperoncino, 1 cucch. olio evo", kcal: 380, emoji: "🍝", img: "pasta_lenticchie.jpg" },
    { title: "Insalata tiepida di lenticchie e alici", text: "Insalata tiepida di lenticchie, pomodorini, prezzemolo, succo di limone, alici (fresche o sott'olio), 1 cucch. olio evo", kcal: 320, emoji: "🥗", img: "insalata_lenticchie.jpg" },
    { title: 'Zuppa rustica di lenticchie con alici', text: 'Zuppa di lenticchie con soffritto di alici (2-3 filetti), sedano, carota, cipolla, aglio, peperoncino, 1 cucch. olio evo', kcal: 350, emoji: '🍲', img: 'zuppa_lenticchie.jpg' },
    { title: 'Salmone al Forno con Asparagi', text: '150g salmone, 150g asparagi, 1 cucch. olio evo', kcal: 380, emoji: '🍣', img: 'salmone_asparagi.jpg' },
    { title: 'Pancake Proteici', text: '50g avena, 150g albume, 1 mela', kcal: 290, emoji: '🥞', img: 'pancake_proteici.jpg' },
    { title: 'Bowl Pollo e Quinoa', text: '150g pollo, 60g quinoa, 100g zucchine, olio evo', kcal: 450, emoji: '🥗', img: 'bowl_pollo_quinoa.jpg' },
    { title: 'Pasta Integrale Tonno', text: '80g pasta int., 100g tonno, pomodorini, olio evo', kcal: 420, emoji: '🍝', img: 'pasta_tonno.jpg' },
    { title: 'Uova in Purgatorio', text: '2 uova, 150g pomodoro, 1 fetta pane int., olio evo', kcal: 320, emoji: '🍳', img: 'uova_purgatorio.jpg' },
    { title: 'Insalatona Feta e Noci', text: '50g feta, 20g noci, mista, pomodori, olio evo', kcal: 350, emoji: '🥗', img: 'insalatona_feta.jpg' }
    ,
    { title: "Salmone al Pistacchio", text: "200g salmone in crosta di pistacchi, zucchine, 1 fetta pane segale, 1 cucch. olio evo", kcal: 400, emoji: '🐟', img: "salmone_pistacchio.jpg" },
    { title: "Pollo Limone e Zenzero", text: "150g pollo al limone e zenzero, insalata mista, 70g riso basmati, 1.5 cucch. olio evo", kcal: 380, emoji: '🍗', img: "pollo_limone_zenzero.jpg" },
    { title: "Crema Zucchine e Ricotta", text: "70g pasta integrale, crema di zucchine e 100g ricotta, 1 cucch. olio evo", kcal: 350, emoji: '🍝', img: "crema_zucchine_ricotta.jpg" },
    { title: "Orata al Forno", text: "200g orata al forno, patate novelle, pomodorini, 1 cucch. olio evo", kcal: 420, emoji: '🐟', img: "orata_forno.jpg" },
    { title: "Bowl Quinoa e Ceci", text: "70g quinoa, 150g ceci, rucola, avocado (grassi), 1 cucch. olio evo", kcal: 410, emoji: '🥗', img: "bowl_quinoa_ceci.jpg" },
    { title: "Pasto Libero (Sgarro) 🎉", text: "Pasto Libero 🎉", kcal: 800, emoji: '🍔', img: "pasto_libero.jpg" }
];

customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];
let currentRecipeToInsert = null;

function openRecipeBookForCell() {
    if (typeof closeSuggestions === 'function') closeSuggestions();
    window.targetRecipeCell = currentActiveCell;
    openRecipeBook(true);
}

function openRecipeBook(fromCell = false) {
    if (!fromCell) window.targetRecipeCell = null;
    let list = document.getElementById('recipe-list');
    list.innerHTML = '';

    let allRecipes = [...customRecipes, ...defaultRecipes];

    allRecipes.forEach(r => {
        let card = document.createElement('div');
        card.style.cssText = 'border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.04); margin-bottom: 12px; gap: 15px;';

        let safeTitle = encodeURIComponent(r.title);
        let safeText = encodeURIComponent(r.text);

        // Pulsanti a destra: Aggiungi + Procedimento
        let actionButtons = `
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end; justify-content:center; flex-shrink:0;">
                <div style="display:flex; gap:6px;">
                    ${r.isCustom ? `<button onclick="editCustomRecipe('${r.title.replace(/'/g, "\\'")}')" style="padding: 7px 10px; background: #fbc02d; color: white; border: none; border-radius: 8px; cursor: pointer;" title="Modifica ricetta">✏️</button>
                    <button onclick="deleteCustomRecipe('${r.title.replace(/'/g, "\\'")}')" style="padding: 7px 10px; background: #e53935; color: white; border: none; border-radius: 8px; cursor: pointer;" title="Elimina ricetta">🗑️</button>` : ''}
                    <button onclick="selectRecipeTarget(decodeURIComponent('${safeText}'), decodeURIComponent('${safeTitle}'))" style="padding: 9px 16px; background: #1976d2; color: white; border: none; border-radius: 8px; font-weight:bold; cursor: pointer; box-shadow:0 2px 6px rgba(25,118,210,0.3); font-size:0.9rem;">➕ Aggiungi</button>
                </div>
                <button type="button" class="btn-recipe-procedure" onclick="openRecipeProcedureModal('${safeTitle}')" style="padding: 6px 12px; background: #e0f2fe; color: #0284c7; border: 1.5px solid #7dd3fc; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:5px; transition:0.2s;">
                    <span>👨‍🍳</span> Procedimento ➔
                </button>
            </div>
        `;

        let imgSrc = r.img ? (r.img.startsWith('http') ? r.img : 'foto/' + r.img.split('/').pop()) : '';

        card.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong style="font-size:1.15rem; color:#1976d2; cursor:pointer;" onclick="openRecipeProcedureModal('${safeTitle}')" title="Clicca per aprire la scheda ricetta">${r.emoji} ${r.title}</strong>
                    ${r.isCustom ? '<span style="background:#ff9800; color:white; font-size:0.7rem; padding:2px 6px; border-radius:10px; font-weight:bold;">Tua</span>' : ''}
                </div>
                
                ${imgSrc ? `
                <div style="position:relative; display:inline-block; margin: 10px 0 8px 0; cursor:pointer;" onclick="openRecipeProcedureModal('${safeTitle}')" title="Clicca per vedere la ricetta e il procedimento">
                    <img src="${imgSrc}" style="width: 150px; height: 105px; object-fit: cover; border-radius: 10px; box-shadow: 0 3px 8px rgba(0,0,0,0.18); display: block; border:1px solid #e2e8f0;">
                    <span style="position:absolute; bottom:6px; left:6px; background:rgba(15,23,42,0.8); backdrop-filter:blur(3px); color:white; font-size:0.72rem; padding:3px 8px; border-radius:6px; font-weight:700; display:inline-flex; align-items:center; gap:3px;">
                        <span>📖</span> Leggi Ricetta
                    </span>
                </div>
                ` : ''}
                
                <div style="font-size:0.86rem; color:#475569; margin-top:2px; line-height:1.4;">${r.text}</div>
                
                <div style="display:flex; align-items:center; gap:12px; margin-top:6px; flex-wrap:wrap;">
                    <span style="font-weight:bold; color:#d84315; font-size:0.92rem; background:#fff7ed; padding:3px 8px; border-radius:6px; border:1px solid #ffedd5;">🔥 ~${r.kcal} kcal</span>
                    <button type="button" onclick="openRecipeProcedureModal('${safeTitle}')" style="background:none; border:none; color:#0284c7; font-size:0.82rem; font-weight:700; cursor:pointer; text-decoration:underline; padding:0;">
                        Vedi tempi e passaggi di preparazione ➔
                    </button>
                </div>
            </div>
            ${actionButtons}
        `;
        list.appendChild(card);
    });
    document.getElementById('recipe-modal').style.display = 'flex';
}

function deleteCustomRecipe(title) {
    showCustomConfirm('Vuoi eliminare questa ricetta personale?', function () {
        customRecipes = customRecipes.filter(r => r.title !== title);
        localStorage.setItem('myCustomRecipes', JSON.stringify(customRecipes));
        openRecipeBook();
    });
}

function openAddRecipeModal() {
    window.editingRecipeTitle = null;
    let modalTitle = document.querySelector('#add-recipe-modal h3');
    if (modalTitle) modalTitle.innerText = "➕ Crea la tua Ricetta";

    document.getElementById('new-recipe-title').value = '';
    document.getElementById('new-recipe-ingredients').value = '';
    document.getElementById('new-recipe-kcal').value = '';
    document.getElementById('new-recipe-emoji').value = '';
    if (document.getElementById('new-recipe-img')) document.getElementById('new-recipe-img').value = '';

    document.getElementById('add-recipe-modal').style.display = 'flex';
}

function editFromSearch(title) {
    customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];
    let recipe = customRecipes.find(r => r.title === title);
    if (recipe) {
        document.getElementById('paste-recipe-title').value = recipe.title;
        document.getElementById('paste-recipe-ingredients').value = recipe.text;
        document.getElementById('paste-recipe-kcal').innerText = recipe.kcal;

        editingRecipeTitle = title;

        // Scroll down
        document.getElementById('paste-recipe-title').scrollIntoView({ behavior: "smooth" });
        document.getElementById('paste-recipe-ingredients').focus();
        showToast("Ricetta pronta in basso! Modificala e clicca Salva.");
    }
}

function deleteFromSearch(title) {
    showCustomConfirm('Vuoi davvero eliminare questa ricetta dal tuo ricettario?', function () {
        customRecipes = (JSON.parse(localStorage.getItem('myCustomRecipes')) || []).filter(r => r.title !== title);
        localStorage.setItem('myCustomRecipes', JSON.stringify(customRecipes));
        showToast("Ricetta eliminata!");
        searchRecipe(); // Refresh results
    });
}

function searchWeb() {
    let url = 'https://www.giallozafferano.it/ricerca-ricette/light+' + encodeURIComponent(currentSearchQuery) + '/';
    window.open(url, '_blank');
}

function autoCalcPasteKcal() {
    let text = document.getElementById('paste-recipe-ingredients').value;
    let kcal = calculateCaloriesFromText(text);
    document.getElementById('paste-recipe-kcal').innerText = kcal > 0 ? kcal : '0';
}

function savePastedRecipe() {
    let title = document.getElementById('paste-recipe-title').value.trim();
    let text = document.getElementById('paste-recipe-ingredients').value.trim();
    let kcal = parseInt(document.getElementById('paste-recipe-kcal').innerText);

    if (!title || !text || kcal === 0) {
        showCustomAlert("Inserisci un titolo, incolla gli ingredienti validi e assicurati che le calorie siano calcolate!");
        return;
    }

    customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];

    if (editingRecipeTitle) {
        // Remove old version if we are editing
        customRecipes = customRecipes.filter(r => r.title !== editingRecipeTitle);
        editingRecipeTitle = null;
    }

    let newRecipe = {
        title: title,
        text: text,
        kcal: kcal,
        emoji: '🍽️',
        isCustom: true,
        category: 'all'
    };

    customRecipes.unshift(newRecipe);
    localStorage.setItem('myCustomRecipes', JSON.stringify(customRecipes));

    showToast("Ricetta salvata con successo nel tuo Ricettario Magico!");

    // Refresh search results
    searchRecipe();
}
function updateSgarrometro() {
    let sgarriMarito = 0;
    let sgarriMoglie = 0;

    // Lista delle parole chiave che attivano lo sgarro
    const junkWords = ['pasto libero', 'pizza', 'patatine', 'cioccolato', 'nutella', 'cornetto', 'biscotti', 'merendina', 'gelato'];

    // Controlla tabella Marito
    const tables = document.querySelectorAll('.weekly-table');
    const tbodyMarito = tables[0] ? tables[0].querySelector('tbody') : null;
    if (tbodyMarito) {
        tbodyMarito.querySelectorAll('.editable-cell').forEach(cell => {
            let text = cell.innerText.toLowerCase();
            if (junkWords.some(word => text.includes(word))) {
                sgarriMarito++;
            }
        });
    }

    // Controlla tabella Moglie
    const tbodyMoglie = tables[1] ? tables[1].querySelector('tbody') : null;
    if (tbodyMoglie) {
        tbodyMoglie.querySelectorAll('.editable-cell').forEach(cell => {
            let text = cell.innerText.toLowerCase();
            if (junkWords.some(word => text.includes(word))) {
                sgarriMoglie++;
            }
        });
    }

    // Aggiorna UI Marito
    const countMarito = document.getElementById('sgarro-count-marito');
    const msgMarito = document.getElementById('sgarro-msg-marito');
    const boxMarito = document.getElementById('sgarro-marito');
    if (countMarito) {
        countMarito.innerText = sgarriMarito;
        if (sgarriMarito === 0) {
            msgMarito.innerText = 'Perfetto! Settimana immacolata!';
            msgMarito.style.color = '#2e7d32';
            boxMarito.style.background = '#e8f5e9';
            boxMarito.style.borderColor = '#c8e6c9';
        } else if (sgarriMarito <= 2) {
            msgMarito.innerText = 'Tutto sotto controllo!';
            msgMarito.style.color = '#f57c00';
            boxMarito.style.background = '#fff3e0';
            boxMarito.style.borderColor = '#ffe0b2';
        } else {
            msgMarito.innerText = 'Attenzione! Troppi sgarri!';
            msgMarito.style.color = '#c62828';
            boxMarito.style.background = '#ffebee';
            boxMarito.style.borderColor = '#ffcdd2';
        }
    }

    // Aggiorna UI Moglie
    const countMoglie = document.getElementById('sgarro-count-moglie');
    const msgMoglie = document.getElementById('sgarro-msg-moglie');
    const boxMoglie = document.getElementById('sgarro-moglie');
    if (countMoglie) {
        countMoglie.innerText = sgarriMoglie;
        if (sgarriMoglie === 0) {
            msgMoglie.innerText = 'Perfetta! Settimana immacolata!';
            msgMoglie.style.color = '#2e7d32';
            boxMoglie.style.background = '#e8f5e9';
            boxMoglie.style.borderColor = '#c8e6c9';
        } else if (sgarriMoglie <= 2) {
            msgMoglie.innerText = 'Tutto sotto controllo!';
            msgMoglie.style.color = '#f57c00';
            boxMoglie.style.background = '#fff3e0';
            boxMoglie.style.borderColor = '#ffe0b2';
        } else {
            msgMoglie.innerText = 'Attenzione! Troppi sgarri!';
            msgMoglie.style.color = '#c62828';
            boxMoglie.style.background = '#ffebee';
            boxMoglie.style.borderColor = '#ffcdd2';
        }
    }
}

document.addEventListener('input', (e) => { if (e.target.classList.contains('editable-cell') || e.target.tagName === 'TR' || e.target.tagName === 'TD') { updateSgarrometro(); const bm = document.getElementById('sgarro-marito'); if (bm && bm.dataset.h === 'true') highlightSgarri(0, true); const bw = document.getElementById('sgarro-moglie'); if (bw && bw.dataset.h === 'true') highlightSgarri(1, true); } });
document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { updateSgarrometro(); const bm = document.getElementById('sgarro-marito'); if (bm) { bm.addEventListener('click', () => { let s = bm.dataset.h === 'true'; bm.dataset.h = !s; bm.style.outline = !s ? '3px solid red' : 'none'; highlightSgarri(0, !s); }); bm.style.cursor = 'pointer'; } const bw = document.getElementById('sgarro-moglie'); if (bw) { bw.addEventListener('click', () => { let s = bw.dataset.h === 'true'; bw.dataset.h = !s; bw.style.outline = !s ? '3px solid red' : 'none'; highlightSgarri(1, !s); }); bw.style.cursor = 'pointer'; } }, 1000); });

function highlightSgarri(idx, show) {
    const j = ['pasto libero', 'pizza', 'patatine', 'cioccolato', 'nutella', 'cornetto', 'biscotti', 'merendina', 'gelato'];
    const t = document.querySelectorAll('.weekly-table');
    const tb = t[idx] ? t[idx].querySelector('tbody') : null;
    if (!tb) return;
    tb.querySelectorAll('.editable-cell').forEach(c => {
        if (j.some(w => c.textContent.toLowerCase().includes(w))) {
            if (show) {
                c.style.setProperty('background-color', '#ffcdd2', 'important'); c.style.setProperty('border', '3px solid red', 'important');
                c.style.setProperty('box-shadow', 'inset 0 0 10px #d32f2f', 'important');
                c.style.setProperty('color', '#b71c1c', 'important');
                c.style.setProperty('font-weight', 'bold', 'important');
                c.style.transition = '0.3s';
            } else {
                c.style.backgroundColor = '';
                c.style.boxShadow = '';
                c.style.color = '';
                c.style.fontWeight = '';
            }
        }
    });
}


function openPortionsCalculator() {
    document.getElementById('portions-recipe-modal').style.display = 'flex';
    document.getElementById('portion-results').style.display = 'none';
    document.getElementById('portion-recipe-title').value = '';
    document.getElementById('portion-recipe-ingredients').value = '';
    document.getElementById('portion-recipe-count').value = '4';
}

function calcPortions() {
    let text = document.getElementById('portion-recipe-ingredients').value;
    let count = parseInt(document.getElementById('portion-recipe-count').value) || 1;

    if (text.trim().length === 0) return;

    let totalKcal = calculateCaloriesFromText(text);
    let portionKcal = Math.round(totalKcal / count);

    document.getElementById('portion-total-kcal').innerText = totalKcal;
    document.getElementById('portion-single-kcal').innerText = portionKcal;
    document.getElementById('portion-results').style.display = 'block';
}

function savePortionToRicettario() {
    let title = document.getElementById('portion-recipe-title').value.trim();
    let text = document.getElementById('portion-recipe-ingredients').value.trim();
    let kcal = parseInt(document.getElementById('portion-single-kcal').innerText) || 0;

    if (!title || !text || kcal === 0) {
        showCustomAlert("Prima inserisci ingredienti, titolo e premi Calcola!");
        return;
    }

    // Formattiamo il testo della porzione
    let count = document.getElementById('portion-recipe-count').value;
    let portionText = "1 porzione di " + title + " (~" + kcal + " kcal) (su " + count + " totali)";

    let newRecipe = {
        title: title,
        text: portionText,
        kcal: kcal,
        emoji: '🍰', // Emoji generica per ricette a porzioni
        isCustom: true
    };

    customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];
    customRecipes.unshift(newRecipe);
    localStorage.setItem('myCustomRecipes', JSON.stringify(customRecipes));

    showToast("Porzione salvata nel Ricettario!");
    document.getElementById('portions-recipe-modal').style.display = 'none';
}


function updatePathology(profileIndex, value) {
    localStorage.setItem('pathology_' + profileIndex, value);
    showToast("Profilo patologia aggiornato!");
    // Forza ricalcolo
    let table = document.querySelectorAll('.weekly-table')[profileIndex];
    if (table) {
        let rows = table.querySelectorAll('tbody tr');
        rows.forEach(r => {
            const event = new Event("input", { bubbles: true });
            r.dispatchEvent(event);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // init selectors
    ['0', '1'].forEach(idx => {
        let select = document.getElementById('pathology_' + idx);
        if (select) {
            let saved = localStorage.getItem('pathology_' + idx) || 'nessuna';
            select.value = saved;
        }
    });
});


function saveProfileName(idx, name) {
    localStorage.setItem('profileName_' + idx, name.trim());
    if (typeof showToast === 'function') showToast('Nome aggiornato con successo!');
}

window.addEventListener('DOMContentLoaded', () => {
    ['0', '1'].forEach(idx => {
        let nameSpan = document.getElementById('profile_name_' + idx);
        if (nameSpan) {
            let savedName = localStorage.getItem('profileName_' + idx);
            if (savedName) nameSpan.innerText = savedName;

            // Per evitare che l'invio vada a capo (enter key)
            nameSpan.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        }
    });
});


// MIGRATION SCRIPT FOR LOCALSTORAGE PHOTOS
(function () {
    let customRecipes = JSON.parse(localStorage.getItem("myCustomRecipes")) || [];
    let modified = false;
    customRecipes.forEach(r => {
        if (r.title === "CAFFÈ" && !r.img) { r.img = "caffe.jpg"; modified = true; }
        if (r.title === "Pasta & Piselli" && !r.img) { r.img = "pasta_piselli.jpg"; modified = true; }
        if (r.title === "Sgombro alla griglia" && !r.img) { r.img = "sgombro_griglia.jpg"; modified = true; }
    });
    if (modified) localStorage.setItem("myCustomRecipes", JSON.stringify(customRecipes));
})();


window.editingRecipeTitle = null;
function editCustomRecipe(title) {
    let recipe = customRecipes.find(r => r.title === title);
    if (!recipe) return;

    document.getElementById('new-recipe-title').value = recipe.title;
    document.getElementById('new-recipe-ingredients').value = recipe.text;
    document.getElementById('new-recipe-kcal').value = recipe.kcal;
    document.getElementById('new-recipe-emoji').value = recipe.emoji || '';
    if (document.getElementById('new-recipe-category')) {
        document.getElementById('new-recipe-category').value = recipe.category || 'all';
    }

    window.editingRecipeTitle = title;

    let modalTitle = document.querySelector('#add-recipe-modal h3');
    if (modalTitle) modalTitle.innerText = "✏️ Modifica Ricetta";

    document.getElementById('add-recipe-modal').style.display = 'flex';
}


window.editingRecipeTitle = null;
function saveNewRecipe() {
    let title = document.getElementById('new-recipe-title').value.trim();
    let text = document.getElementById('new-recipe-ingredients').value.trim();
    let kcal = document.getElementById('new-recipe-kcal').value.trim();
    let emoji = document.getElementById('new-recipe-emoji').value.trim() || '🍽️';

    let imgInput = document.getElementById('new-recipe-img');
    let img = '';
    if (imgInput && imgInput.files && imgInput.files.length > 0) {
        img = imgInput.files[0].name;
    } else if (imgInput && imgInput.value) {
        img = imgInput.value.replace(/C:fakepath/i, '');
    }

    if (!title || !text || !kcal) {
        showCustomAlert("Compila tutti i campi obbligatori (Nome, Ingredienti, Kcal)!");
        return;
    }

    let newRecipe = {
        title: title,
        text: text,
        kcal: parseInt(kcal),
        emoji: emoji,
        isCustom: true,
        img: img,
        category: document.getElementById('new-recipe-category') ? document.getElementById('new-recipe-category').value : 'all'
    };

    customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];

    if (window.editingRecipeTitle) {
        let idx = customRecipes.findIndex(r => r.title === window.editingRecipeTitle);
        if (idx >= 0) {
            if (!newRecipe.img && customRecipes[idx].img) {
                newRecipe.img = customRecipes[idx].img;
            }
            customRecipes[idx] = newRecipe;
        }
        window.editingRecipeTitle = null;
    } else {
        customRecipes.unshift(newRecipe);
    }

    localStorage.setItem('myCustomRecipes', JSON.stringify(customRecipes));

    document.getElementById('new-recipe-title').value = '';
    document.getElementById('new-recipe-ingredients').value = '';
    document.getElementById('new-recipe-kcal').value = '';
    document.getElementById('new-recipe-emoji').value = '';
    if (document.getElementById('new-recipe-img')) document.getElementById('new-recipe-img').value = '';

    document.getElementById('add-recipe-modal').style.display = 'none';
    openRecipeBook();
}

function openAddRecipeModal() {
    window.editingRecipeTitle = null;
    let modalTitle = document.querySelector('#add-recipe-modal h3');
    if (modalTitle) modalTitle.innerText = "➕ Crea la tua Ricetta";

    document.getElementById('new-recipe-title').value = '';
    document.getElementById('new-recipe-ingredients').value = '';
    document.getElementById('new-recipe-kcal').value = '';
    document.getElementById('new-recipe-emoji').value = '';
    if (document.getElementById('new-recipe-img')) document.getElementById('new-recipe-img').value = '';

    document.getElementById('add-recipe-modal').style.display = 'flex';
}


window.currentRecipeToInsert = "";

window.currentRecipeToInsert = "";
window.currentRecipeTitleToInsert = "";

function openProcedureFromDestModal() {
    if (!window.currentRecipeTitleToInsert) return;
    if (typeof openRecipeProcedureModal === 'function') {
        openRecipeProcedureModal(encodeURIComponent(window.currentRecipeTitleToInsert));
    }
}

function selectRecipeTarget(text, title) {
    if (window.targetRecipeCell) {
        let cell = window.targetRecipeCell;
        cell.innerText = text;
        if (typeof autoEmoji === 'function') autoEmoji(cell);
        let clean = getCleanCellText(cell.innerText);
        localStorage.setItem(cell.id, clean);

        let prof = (typeof getProfileForElement === 'function') ? getProfileForElement(cell) : (window.activeProfile || 'marito');
        let pat = (typeof getProfilePathology === 'function') ? getProfilePathology(prof) : 'steatosi';
        if (typeof formatCellWithWarnings === 'function') {
            formatCellWithWarnings(cell, pat);
        }

        let row = cell.closest('tr');
        if (row) {
            let evt = new Event('input', { bubbles: true });
            row.dispatchEvent(evt);
        }
        document.getElementById('recipe-modal').style.display = 'none';
        if (typeof showToast === 'function') showToast('Ricetta inserita con successo nel menu!');
        window.targetRecipeCell = null;
    } else {
        window.currentRecipeToInsert = text;
        window.currentRecipeTitleToInsert = title;

        // Trova i dettagli della ricetta per l'anteprima
        let allRecipes = [...(typeof customRecipes !== 'undefined' ? customRecipes : []), ...(typeof defaultRecipes !== 'undefined' ? defaultRecipes : [])];
        let found = allRecipes.find(r => r.title === title) || { title: title, kcal: 350, emoji: "🍽️" };
        let proc = (typeof RECIPE_PROCEDURES !== 'undefined' && RECIPE_PROCEDURES[title]) ? RECIPE_PROCEDURES[title] : { time: "20 min" };

        const previewTitle = document.getElementById('dest-recipe-preview-title');
        if (previewTitle) previewTitle.innerHTML = `${found.emoji || '🍽️'} ${found.title}`;

        const previewKcal = document.getElementById('dest-recipe-preview-kcal');
        if (previewKcal) previewKcal.innerText = `🔥 ~${found.kcal || 350} kcal`;

        const previewTime = document.getElementById('dest-recipe-preview-time');
        if (previewTime) previewTime.innerText = `⏱️ ${proc.time || '20 min'}`;

        // Popola i componenti della famiglia
        const profSelect = document.getElementById('recipe-target-profile');
        if (profSelect) {
            profSelect.innerHTML = '';
            let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
            let currActive = (typeof activeProfile !== 'undefined') ? activeProfile : profiles[0];

            // Opzione Tutta la Famiglia
            let allOpt = document.createElement('option');
            allOpt.value = 'all';
            allOpt.innerText = '👨‍👩‍👧‍👦 Tutta la Famiglia (Sincronizza per tutti)';
            allOpt.style.fontWeight = 'bold';
            allOpt.style.color = '#0284c7';
            profSelect.appendChild(allOpt);

            // Singoli componenti
            profiles.forEach(p => {
                let opt = document.createElement('option');
                opt.value = p;
                let displayName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(p) : p;
                opt.innerText = `👤 ${displayName}`;
                if (p === currActive) {
                    opt.selected = true; // Di default preseleziona l'utente attivo
                }
                profSelect.appendChild(opt);
            });
        }

        // Imposta giorno di default se opportuno
        const daySelect = document.getElementById('recipe-target-day');
        if (daySelect && !daySelect.value) {
            let currentDayIdx = (new Date().getDay() + 6) % 7; // Lunedì = 0
            daySelect.value = currentDayIdx.toString();
        }

        // Chiudi il ricettario e apri il modale di destinazione
        if (document.getElementById('recipe-modal')) {
            document.getElementById('recipe-modal').style.display = 'none';
        }
        document.getElementById('recipe-dest-modal').style.display = 'flex';
    }
}

function confirmRecipeInsertion() {
    let targetProf = document.getElementById('recipe-target-profile').value;
    let day = parseInt(document.getElementById('recipe-target-day').value);
    let colIndex = parseInt(document.getElementById('recipe-target-meal').value); // 1 = Pranzo, 2 = Cena, 3 = Spuntini
    let recipeText = window.currentRecipeToInsert;
    let recipeTitle = window.currentRecipeTitleToInsert || "Ricetta";

    if (!recipeText) {
        document.getElementById('recipe-dest-modal').style.display = 'none';
        return;
    }

    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);

    if (targetProf === 'all') {
        // Inserisci per tutta la famiglia
        let count = 0;
        profiles.forEach((p, tableIndex) => {
            let cellId = `menuEdit_${tableIndex}_r${day}_c${colIndex}`;
            let cell = document.getElementById(cellId);
            if (cell) {
                cell.innerText = recipeText;
                if (typeof autoEmoji === 'function') autoEmoji(cell);
                localStorage.setItem(cell.id, cell.innerHTML);

                let row = cell.closest('tr');
                if (row) {
                    let evt = new Event('input', { bubbles: true });
                    row.dispatchEvent(evt);
                }
                count++;
            }
        });

        document.getElementById('recipe-dest-modal').style.display = 'none';
        if (typeof showToast === 'function') {
            showToast(`👨‍👩‍👧‍👦 '${recipeTitle}' inserita nel menù di TUTTA la Famiglia!`, '#16a34a');
        }
    } else {
        // Inserisci per il profilo selezionato
        let tableIndex = profiles.indexOf(targetProf);
        if (tableIndex === -1) tableIndex = 0;

        let cellId = `menuEdit_${tableIndex}_r${day}_c${colIndex}`;
        let cell = document.getElementById(cellId);

        if (cell) {
            cell.innerText = recipeText;
            if (typeof autoEmoji === 'function') autoEmoji(cell);
            localStorage.setItem(cell.id, cell.innerHTML);

            let row = cell.closest('tr');
            if (row) {
                let evt = new Event('input', { bubbles: true });
                row.dispatchEvent(evt);
            }

            // Sincronizza eventuali familiari collegati tramite la barra di famiglia
            if (typeof syncCell === 'function') {
                syncCell(tableIndex, day, colIndex, cell.innerHTML);
            }

            let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(targetProf) : targetProf;
            document.getElementById('recipe-dest-modal').style.display = 'none';
            if (typeof showToast === 'function') {
                showToast(`✨ '${recipeTitle}' inserita nel menù di ${pName}!`, '#16a34a');
            }
        } else {
            showCustomAlert("Cella non trovata nel menu settimanale.");
            document.getElementById('recipe-dest-modal').style.display = 'none';
        }
    }

    // Chiudi anche l'eventuale scheda procedimento
    if (typeof closeRecipeProcedureModal === 'function') {
        closeRecipeProcedureModal();
    }
}


// --- DARK MODE ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'yes' : 'no');
    showToast(isDark ? "🌙 Tema scuro attivato!" : "☀️ Tema chiaro attivato!");
}
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('darkMode') === 'yes') {
        document.body.classList.add('dark-mode');
    }
});

// --- RICETTARIO FILTERS ---
window.currentRecipeFilter = 'all';
function filterRecipes(category, btn) {
    window.currentRecipeFilter = category;

    // Update button styles
    let btns = document.querySelectorAll('#recipe-filters button');
    btns.forEach(b => {
        b.style.background = 'white';
        b.style.color = '#333';
        b.style.borderColor = '#ccc';
    });
    if (btn) {
        btn.style.background = '#1976d2';
        btn.style.color = 'white';
        btn.style.borderColor = '#1976d2';
    }

    openRecipeBook(window.targetRecipeCell ? true : false);
}

// Override openRecipeBook to apply filters
const originalOpenRecipeBook = openRecipeBook;
openRecipeBook = function (fromCell = false) {
    originalOpenRecipeBook(fromCell);

    // Now apply filter to the generated DOM elements
    let cards = document.querySelectorAll('#recipe-list > div');
    cards.forEach(card => {
        let text = card.innerText.toLowerCase();
        let show = true;

        if (window.currentRecipeFilter === 'colazione') {
            let kws = ['latte', 'yogurt', 'avena', 'biscotti', 'fette biscottate', 'pancake', 'porridge'];
            show = kws.some(k => text.includes(k));
        } else if (window.currentRecipeFilter === 'pranzo') {
            let kws = ['pasta', 'riso', 'farro', 'quinoa', 'pollo', 'salmone', 'pesce', 'orata', 'sgombro', 'uova', 'carne', 'zuppa', 'lenticchie'];
            show = kws.some(k => text.includes(k));
        } else if (window.currentRecipeFilter === 'spuntino') {
            let kws = ['frutto', 'mandorle', 'noci', 'spuntino', 'frutta', 'crema'];
            show = kws.some(k => text.includes(k)) && !text.includes('pasta'); // Simple heuristic
        }

        if (window.currentRecipeFilter === 'all') show = true;

        card.style.display = show ? 'flex' : 'none';
    });
};

// --- MAGIC WAND (FILL RANDOM) ---
function fillRandomMeals() {
    showCustomConfirm("La bacchetta magica riempirà tutti i pasti vuoti della settimana con ricette a caso dal tuo ricettario! Vuoi procedere?", function () {

        let allRecipes = [...(JSON.parse(localStorage.getItem('myCustomRecipes')) || []), ...defaultRecipes];

        const colazioni = allRecipes.filter(r => ['latte', 'yogurt', 'avena', 'biscotti', 'pancake', 'porridge'].some(k => r.text.toLowerCase().includes(k)));
        const pranzi = allRecipes.filter(r => ['pasta', 'riso', 'farro', 'quinoa', 'pollo', 'salmone', 'orata', 'sgombro', 'zuppa', 'lenticchie'].some(k => r.text.toLowerCase().includes(k)));
        const cene = pranzi; // Reuse for now
        const spuntini = allRecipes.filter(r => ['frutto', 'mandorle', 'noci', 'spuntino', 'crema'].some(k => r.text.toLowerCase().includes(k)) && !r.text.toLowerCase().includes('pasta'));

        const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)] || arr[0];

        let cellsUpdated = 0;

        document.querySelectorAll('.weekly-table tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td.editable-cell');
            // cell 0 = Colazione (index 1), cell 1 = Pranzo (index 2), cell 2 = Cena (index 3), cell 3 = Spuntini (index 4)

            if (cells[0] && cells[0].innerText.trim() === '') {
                cells[0].innerText = getRandom(colazioni).text;
                localStorage.setItem(cells[0].id, cells[0].innerHTML);
                cellsUpdated++;
            }
            if (cells[1] && cells[1].innerText.trim() === '') {
                cells[1].innerText = getRandom(pranzi).text;
                localStorage.setItem(cells[1].id, cells[1].innerHTML);
                cellsUpdated++;
            }
            if (cells[2] && cells[2].innerText.trim() === '') {
                cells[2].innerText = getRandom(cene).text;
                localStorage.setItem(cells[2].id, cells[2].innerHTML);
                cellsUpdated++;
            }
            if (cells[3] && cells[3].innerText.trim() === '') {
                cells[3].innerText = getRandom(spuntini).text;
                localStorage.setItem(cells[3].id, cells[3].innerHTML);
                cellsUpdated++;
            }

            if (cellsUpdated > 0) {
                row.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        if (cellsUpdated > 0) {
            showToast(`🪄 Magia! ${cellsUpdated} pasti riempiti casualmente!`);
        } else {
            showToast(`Tutti i pasti erano già pianificati!`);
        }
    });
}


function searchRecipe() {
    let queryInput = document.getElementById('recipe-search');
    if (!queryInput) return;
    let query = queryInput.value.trim();
    if (query === '') return;

    // Mostra anche internal search (se presente in futuro), per ora apriamo web search
    let url = 'https://www.giallozafferano.it/ricerca-ricette/light+' + encodeURIComponent(query) + '/';
    window.open(url, '_blank');
}


window.showCustomConfirm = function (msg, onConfirm) {
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.backdropFilter = 'blur(5px)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    let isDark = document.body.classList.contains('dark-mode');
    let bgColor = isDark ? '#2c2c2c' : '#ffffff';
    let textColor = isDark ? '#f5f5f5' : '#333333';

    let box = document.createElement('div');
    box.style.backgroundColor = bgColor;
    box.style.color = textColor;
    box.style.padding = '30px';
    box.style.borderRadius = '20px';
    box.style.boxShadow = '0 15px 35px rgba(0,0,0,0.2)';
    box.style.maxWidth = '400px';
    box.style.textAlign = 'center';
    box.style.transform = 'translateY(30px) scale(0.95)';
    box.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    let icon = document.createElement('div');
    icon.innerHTML = '🤔';
    icon.style.fontSize = '3rem';
    icon.style.marginBottom = '15px';

    let text = document.createElement('div');
    text.innerHTML = msg;
    text.style.fontSize = '1.1rem';
    text.style.lineHeight = '1.5';
    text.style.marginBottom = '25px';

    let btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '15px';
    btnContainer.style.justifyContent = 'center';

    let cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Annulla';
    cancelBtn.style.padding = '10px 20px';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '10px';
    cancelBtn.style.backgroundColor = isDark ? '#444' : '#e0e0e0';
    cancelBtn.style.color = isDark ? '#fff' : '#333';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.flex = '1';
    cancelBtn.style.transition = '0.2s';
    cancelBtn.onmouseover = () => cancelBtn.style.filter = 'brightness(0.9)';
    cancelBtn.onmouseout = () => cancelBtn.style.filter = 'brightness(1)';

    let confirmBtn = document.createElement('button');
    confirmBtn.innerText = 'Conferma';
    confirmBtn.style.padding = '10px 20px';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '10px';
    confirmBtn.style.backgroundColor = '#f44336';
    confirmBtn.style.color = 'white';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.flex = '1';
    confirmBtn.style.transition = '0.2s';
    confirmBtn.style.boxShadow = '0 4px 10px rgba(244, 67, 54, 0.3)';
    confirmBtn.onmouseover = () => { confirmBtn.style.transform = 'translateY(-2px)'; confirmBtn.style.boxShadow = '0 6px 15px rgba(244, 67, 54, 0.4)'; };
    confirmBtn.onmouseout = () => { confirmBtn.style.transform = 'translateY(0)'; confirmBtn.style.boxShadow = '0 4px 10px rgba(244, 67, 54, 0.3)'; };

    const close = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'translateY(30px) scale(0.95)';
        setTimeout(() => document.body.removeChild(overlay), 300);
    };

    cancelBtn.onclick = close;
    confirmBtn.onclick = () => {
        close();
        onConfirm();
    };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);

    box.appendChild(icon);
    box.appendChild(text);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0) scale(1)';
    });
};


window.showCustomAlert = function (msg) {
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.backdropFilter = 'blur(5px)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    let isDark = document.body.classList.contains('dark-mode');
    let bgColor = isDark ? '#2c2c2c' : '#ffffff';
    let textColor = isDark ? '#f5f5f5' : '#333333';

    let box = document.createElement('div');
    box.style.backgroundColor = bgColor;
    box.style.color = textColor;
    box.style.padding = '30px';
    box.style.borderRadius = '20px';
    box.style.boxShadow = '0 15px 35px rgba(0,0,0,0.2)';
    box.style.maxWidth = '400px';
    box.style.textAlign = 'center';
    box.style.transform = 'translateY(30px) scale(0.95)';
    box.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    let icon = document.createElement('div');
    icon.innerHTML = '⚠️';
    icon.style.fontSize = '3rem';
    icon.style.marginBottom = '15px';

    let text = document.createElement('div');
    text.innerHTML = msg.replace(/\n/g, '<br>');
    text.style.fontSize = '1.1rem';
    text.style.lineHeight = '1.5';
    text.style.marginBottom = '25px';

    let btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'center';

    let okBtn = document.createElement('button');
    okBtn.innerText = 'OK, Ho Capito';
    okBtn.style.padding = '10px 25px';
    okBtn.style.border = 'none';
    okBtn.style.borderRadius = '10px';
    okBtn.style.backgroundColor = '#1976d2';
    okBtn.style.color = 'white';
    okBtn.style.cursor = 'pointer';
    okBtn.style.fontWeight = 'bold';
    okBtn.style.transition = '0.2s';
    okBtn.style.boxShadow = '0 4px 10px rgba(25, 118, 210, 0.3)';
    okBtn.onmouseover = () => { okBtn.style.transform = 'translateY(-2px)'; okBtn.style.boxShadow = '0 6px 15px rgba(25, 118, 210, 0.4)'; };
    okBtn.onmouseout = () => { okBtn.style.transform = 'translateY(0)'; okBtn.style.boxShadow = '0 4px 10px rgba(25, 118, 210, 0.3)'; };

    const close = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'translateY(30px) scale(0.95)';
        setTimeout(() => document.body.removeChild(overlay), 300);
    };

    okBtn.onclick = close;

    btnContainer.appendChild(okBtn);

    box.appendChild(icon);
    box.appendChild(text);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0) scale(1)';
    });
};


function exportPDF(profile) {
    let profileId = typeof profile === 'string' ? profile : (profile === 0 ? 'marito' : 'moglie');
    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];

    if (!table) return;
    let title = "Menu_" + getProfileDisplayName(profileId);

    if (typeof showToast === 'function') showToast("Generazione PDF in corso...");

    let wrapper = document.createElement('div');
    wrapper.style.background = 'white';
    wrapper.style.color = 'black';
    // Riduciamo i padding per far stare tutto su 1 singola pagina
    wrapper.style.padding = '5px';

    let titleEl = document.createElement('h1');
    titleEl.style.textAlign = 'center';
    titleEl.style.color = '#2e7d32';
    titleEl.style.fontFamily = 'sans-serif';
    titleEl.style.marginBottom = '10px';
    titleEl.style.fontSize = '24px';
    titleEl.innerText = title.replace('_', ' ');

    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(titleEl);

    let fastType = localStorage.getItem('fast_type_' + profileId) || '16';
    let fastStart = localStorage.getItem('fast_start_' + profileId) || '20:30';
    let fastEnd = localStorage.getItem('fast_end_' + profileId) || '12:30';
    let eatHours = 24 - (parseInt(fastType) || 16);
    let subTitleEl = document.createElement('div');
    subTitleEl.style.textAlign = 'center';
    subTitleEl.style.color = '#555';
    subTitleEl.style.fontFamily = 'sans-serif';
    subTitleEl.style.fontSize = '13px';
    subTitleEl.style.marginBottom = '12px';
    subTitleEl.innerText = '🌿 Protocollo Digiuno: ' + fastType + ':' + eatHours + ' (Digiuno: ' + fastStart + ' - ' + fastEnd + ' | Pasti: ' + fastEnd + ' - ' + fastStart + ')';
    wrapper.appendChild(subTitleEl);

    wrapper.appendChild(table);

    let editableCells = table.querySelectorAll('.editable-cell');
    let tds = table.querySelectorAll('td, th');

    let originalStyles = [];
    editableCells.forEach(c => {
        originalStyles.push(c.style.cssText);
        c.style.border = '1px solid #ccc';
    });

    let originalPaddings = [];
    tds.forEach(td => {
        originalPaddings.push(td.style.padding);
        // Compattiamo la tabella per farla entrare in una singola pagina A4
        td.style.padding = '8px';
    });

    window.scrollTo(0, 0);

    setTimeout(() => {
        let opt = {
            margin: 0.2, // Margine piccolissimo per recuperare spazio
            filename: title + '.pdf',
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };

        html2pdf().set(opt).from(wrapper).save().then(() => {
            wrapper.parentNode.insertBefore(table, wrapper);
            wrapper.parentNode.removeChild(wrapper);
            editableCells.forEach((c, i) => { c.style.cssText = originalStyles[i]; });
            tds.forEach((td, i) => { td.style.padding = originalPaddings[i]; });
        }).catch(err => {
            wrapper.parentNode.insertBefore(table, wrapper);
            wrapper.parentNode.removeChild(wrapper);
            editableCells.forEach((c, i) => { c.style.cssText = originalStyles[i]; });
            tds.forEach((td, i) => { td.style.padding = originalPaddings[i]; });
        });
    }, 150);
}

// PREMIUM FEATURES
function getBackupTimestampFileName() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `Backup_Salute_${yyyy}-${mm}-${dd}_${hh}-${min}.salute`;
}

// PREMIUM FEATURES
window.backupData = async function () {
    let data = JSON.stringify(localStorage);

    // Se l'app gira in Electron, apri la finestra nativa direttamente nella cartella Backup_Salute
    if (typeof window.require !== 'undefined') {
        try {
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('save-backup-dialog', data);
            if (res && res.success) {
                showCustomAlert("Backup salvato con successo! 🎉\n\nFile: " + (res.fileName || 'Nuovo Backup') + "\nCartella: Backup_Salute\n\nI tuoi dati precedenti sono al sicuro e conservati nello storico!");
            }
            return;
        } catch (err) {
            console.warn("Fallback browser download:", err);
        }
    }

    // Fallback browser standard con nome data e ora automatica
    let blob = new Blob([data], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = getBackupTimestampFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showCustomAlert("Backup scaricato con successo! 🎉\nData e ora salvate nel nome del file.");
};

window.triggerRestore = async function () {
    // Se l'app gira in Electron, apri la cartella Backup_Salute nativamente
    if (typeof window.require !== 'undefined') {
        try {
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('load-backup-dialog');
            if (res && res.success && res.content) {
                try {
                    let data = JSON.parse(res.content);
                    localStorage.clear();
                    for (let key in data) {
                        localStorage.setItem(key, data[key]);
                    }
                    showCustomAlert("Profilo ripristinato con successo! 🎉\n\nBackup caricato: " + (res.fileName || res.filePath) + "\n\nRicarico l'app per applicare i dati... 🔄");
                    setTimeout(() => location.reload(), 1500);
                } catch (err) {
                    showCustomAlert("Errore durante il ripristino! Il file non contiene dati validi.");
                }
            }
            return;
        } catch (err) {
            console.warn("Fallback browser file input:", err);
        }
    }

    document.getElementById('restoreFileInput').click();
};

window.openBackupFolder = async function () {
    if (typeof window.require !== 'undefined') {
        try {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-backup-folder');
            return;
        } catch (err) {
            console.warn("Could not open backup folder:", err);
        }
    }
    showCustomAlert("La cartella dei backup si trova in: Progetto_Salute/Backup_Salute");
};

window.openProgramFolder = async function () {
    if (typeof window.require !== 'undefined') {
        try {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-program-folder');
            return;
        } catch (err) {
            console.warn("Could not open program folder:", err);
        }
    }
    showCustomAlert("La cartella del programma si trova in:\n" + window.location.pathname);
};

window.restoreData = function (event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function (e) {
        try {
            let data = JSON.parse(e.target.result);
            localStorage.clear();
            for (let key in data) {
                localStorage.setItem(key, data[key]);
            }
            showCustomAlert("Profilo ripristinato con successo! Ricarico l'app... 🔄");
            setTimeout(() => location.reload(), 2000);
        } catch (err) {
            showCustomAlert("Errore durante il ripristino! Il file potrebbe non essere valido.");
        }
    };
    reader.readAsText(file);
};

window.exportRicettarioPDF = function () {
    let listContainer = document.getElementById('recipe-list');
    if (!listContainer) {
        showCustomAlert("Non riesco a trovare le ricette da esportare!");
        return;
    }

    let printDiv = document.createElement('div');
    printDiv.innerHTML = '<h1 style="text-align:center; color:#2e7d32; font-family:sans-serif; margin-bottom: 20px;">🥗 Il Mio Ricettario</h1>' + listContainer.innerHTML;
    printDiv.style.width = '800px';
    printDiv.style.padding = '20px';
    printDiv.style.background = 'white';
    printDiv.style.color = 'black';

    printDiv.querySelectorAll('button').forEach(b => b.remove());
    printDiv.querySelectorAll('div').forEach(el => {
        el.style.color = 'black';
        if (el.style.backgroundColor === 'rgb(44, 44, 44)' || el.style.backgroundColor === '#2c2c2c' || el.classList.contains('dark-mode')) {
            el.style.backgroundColor = '#f9f9f9';
        }
    });

    // Append in viewport but hidden behind everything
    printDiv.style.position = 'absolute';
    printDiv.style.top = '0';
    printDiv.style.left = '0';
    printDiv.style.zIndex = '-9999';
    document.body.appendChild(printDiv);

    let opt = {
        margin: 0.5,
        filename: 'Ricettario.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 800, windowHeight: printDiv.scrollHeight },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(printDiv).save().then(() => {
        document.body.removeChild(printDiv);
    });

    showCustomAlert("Generazione PDF Ricettario in corso... 📖");
};





// --- GRAPHS ---
let myCharts = {};
window.renderChart = function (profile) {
    let wrapper = document.getElementById('chart-wrapper-' + profile);
    wrapper.style.display = 'block';

    let historyStr = localStorage.getItem('weightLog_' + profile);
    let history = historyStr ? JSON.parse(historyStr) : [];
    if (history.length === 0) {
        showCustomAlert("Nessun dato sul peso salvato per questo profilo!");
        return;
    }

    let labels = history.map(item => item.date);
    let data = history.map(item => parseFloat(item.weight));

    let ctx = document.getElementById('chart-' + profile).getContext('2d');

    if (typeof Chart === 'undefined') return;

    if (myCharts[profile]) {
        myCharts[profile].destroy();
    }

    myCharts[profile] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Andamento Peso (Kg)',
                data: data,
                borderColor: profile === 'marito' ? '#2196f3' : '#e91e63',
                backgroundColor: profile === 'marito' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(233, 30, 99, 0.2)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: Math.min(...data) - 2, max: Math.max(...data) + 2 }
            }
        }
    });
};

// --- AI SVUOTA FRIGO ---
window.generateAIRecipe = function () {
    let input = document.getElementById('aiIngredients').value.trim();
    if (!input) {
        showCustomAlert("Scrivi qualche ingrediente prima!");
        return;
    }

    let ingredients = input.split(',').map(i => i.trim());
    let mainIng = ingredients[0].charAt(0).toUpperCase() + ingredients[0].slice(1);

    let adjectives = ["Gourmet", "Leggero", "al Forno", "Profumato", "Croccante", "del Benessere"];
    let adj = adjectives[Math.floor(Math.random() * adjectives.length)];

    let title = mainIng + " " + adj;
    let description = "1 Porzione.\nIngredienti principali: " + ingredients.join(", ") + ".\n" +
        "Preparazione: Cuocere tutto a fuoco lento aggiungendo 1 cucchiaio di olio EVO (100 kcal), sale e spezie. Accompagnare con 50g di pane. 🪄 Piatto creato magicamente dall'AI!";

    // Salva direttamente la ricetta nel ricettario
    let customRecipes = JSON.parse(localStorage.getItem('myCustomRecipes')) || [];
    let newRecipe = {
        title: title,
        text: description,
        kcal: 450,
        emoji: '🪄',
        isCustom: true,
        category: 'all'
    };
    customRecipes.unshift(newRecipe);
    localStorage.setItem('myCustomRecipes', JSON.stringify(customRecipes));

    // Aggiorna la vista del ricettario
    if (typeof searchRecipe === 'function') searchRecipe();

    // Pulisci l'input
    document.getElementById('aiIngredients').value = '';

    showCustomAlert("✨ Magia completata! ✨\n\nHo inventato: '" + title + "' (450 kcal)\n\nLa ricetta è già stata salvata nel tuo Ricettario Magico ed è pronta per essere usata nei menù!");
};



// ---- INSERIMENTO MANUALE STORICO CON CALENDARIO ----
window.promptStorico = function (profile) {
    document.getElementById('storico-profile').value = profile;

    // Setta la data di default ad oggi
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('storico-date').value = today;
    document.getElementById('storico-weight').value = '';

    document.getElementById('storico-modal').style.display = 'flex';

    // Inizializza il fantastico Flatpickr!
    if (window.flatpickr) {
        flatpickr("#storico-date", {
            locale: "it",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d F Y",
            maxDate: "today",
            theme: "dark",
            onChange: function () {
                // Focus automatico sul campo peso quando si sceglie la data!
                setTimeout(() => {
                    document.getElementById('storico-weight').focus();
                }, 100);
            }
        });
        // Forza l'apertura se l'utente vuole
        setTimeout(() => {
            document.querySelector('#storico-date')._flatpickr.open();
        }, 100);
    }
};

window.saveStoricoModal = function () {
    const profile = document.getElementById('storico-profile').value;
    const dateStr = document.getElementById('storico-date').value;
    const weightStr = document.getElementById('storico-weight').value;

    if (!dateStr) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Seleziona una data dal calendario!");
        else showToast("Seleziona una data dal calendario!");
        return;
    }

    let weight = parseFloat(weightStr.replace(',', '.'));
    if (isNaN(weight) || weight <= 0) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Inserisci un peso valido!");
        else showToast("Inserisci un peso valido!");
        return;
    }

    const key = `weightLog_${profile}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];
    if (log.length === 0 && (profile === 'moglie' || profile === '1')) {
        log = JSON.parse(localStorage.getItem('weightLog_moglie') || localStorage.getItem('weightLog_1') || '[]');
    }

    // Controlla se esiste già una pesata per quella data
    const existingIndex = log.findIndex(entry => entry.date === dateStr);
    if (existingIndex !== -1) {
        log[existingIndex].weight = weight;
    } else {
        log.push({ date: dateStr, weight: weight, timestamp: new Date(dateStr).getTime() });
    }

    // Ordina lo storico per data
    log.sort((a, b) => a.timestamp - b.timestamp);
    localStorage.setItem(key, JSON.stringify(log));

    const isMaria = (profile === 'moglie' || profile === '1' || (typeof getProfileDisplayName === 'function' && getProfileDisplayName(profile).toLowerCase().includes('maria')));
    if (isMaria) {
        localStorage.setItem('weightLog_moglie', JSON.stringify(log));
        localStorage.setItem('weightLog_1', JSON.stringify(log));
    }

    document.getElementById('storico-modal').style.display = 'none';

    if (typeof showToast === 'function') {
        showToast("Pesata storica salvata con successo!");
    } else {
        showToast("Pesata storica salvata con successo!");
    }

    // Ricarica i progressi per aggiornare grafico e statistiche
    loadProgress(profile);
    /* saveStoricoModalSync */ if (typeof window.syncSaluteToCloud === "function") { window.syncSaluteToCloud({ [key]: JSON.stringify(log) }); }
    if (typeof window.syncSaluteToCloud === "function") {
        const payload = { [key]: JSON.stringify(log) };
        if (isMaria) {
            payload['weightLog_moglie'] = JSON.stringify(log);
            payload['weightLog_1'] = JSON.stringify(log);
        }
        window.syncSaluteToCloud(payload);
    }
};


// ---- ELIMINAZIONE PUNTI DAL GRAFICO (DOPPIO CLICK) ----
function setupChartDoubleClick(profile) {
    const canvas = document.getElementById(`chart-${profile}`);
    if (!canvas) return;

    // Rimuoviamo vecchi listener per evitare duplicati
    canvas.ondblclick = function (evt) {
        const chart = charts[profile];
        if (!chart) return;

        const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);

        if (points.length) {
            const firstPoint = points[0];
            const index = firstPoint.index;
            const label = chart.data.labels[index];
            const value = chart.data.datasets[firstPoint.datasetIndex].data[index];

            // Non permettiamo di eliminare il punto "29/09" fisso di partenza se è l'unico
            if (label === '29/09' && index === 0 && chart.data.labels.length === 1) {
                if (typeof showCustomAlert === 'function') showCustomAlert("Non puoi eliminare il punto di partenza isolato.");
                else showToast("Non puoi eliminare il punto di partenza isolato.");
                return;
            }

            // APRI MODALE SIMPATICA
            window._pendingDelete = { profile, label, value };
            document.getElementById('delete-modal-text').innerHTML = `Pesata del <b>${label}</b> (Attuale: <b>${value} kg</b>)`; document.getElementById('edit-modal-weight-input').value = value;
            document.getElementById('delete-modal').style.display = 'flex';
        }
    };
}

// Intercettiamo drawChart per applicare il listener ogni volta che il grafico viene disegnato
const originalDrawChart = drawChart;
drawChart = function (profile, log, startWeight) {
    originalDrawChart(profile, log, startWeight);
    setupChartDoubleClick(profile);
};

window.closeDeleteModal = function () {
    document.getElementById('delete-modal').style.display = 'none';
    window._pendingDelete = null;
};

window.confirmDeleteModal = function () {
    if (!window._pendingDelete) return;

    const { profile, label, value } = window._pendingDelete;
    const key = `weightLog_${profile}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];
    if (log.length === 0 && (profile === 'moglie' || profile === '1')) {
        log = JSON.parse(localStorage.getItem('weightLog_moglie') || localStorage.getItem('weightLog_1') || '[]');
    }

    const [dd, mm] = label.split('/');
    let foundIndex = -1;
    // 1. Cerca per data e peso
    for (let i = log.length - 1; i >= 0; i--) {
        const logParts = log[i].date.split('-');
        if (logParts[2] === dd && logParts[1] === mm && (value === undefined || Math.abs(log[i].weight - parseFloat(value)) < 0.1 || log[i].weight === value)) {
            foundIndex = i;
            break;
        }
    }
    // 2. Se non trova per peso esatto, cerca solo per data (giorno e mese)
    if (foundIndex === -1) {
        for (let i = log.length - 1; i >= 0; i--) {
            const logParts = log[i].date.split('-');
            if (logParts[2] === dd && logParts[1] === mm) {
                foundIndex = i;
                break;
            }
        }
    }

    if (foundIndex !== -1) {
        const removedItem = log.splice(foundIndex, 1)[0];
        localStorage.setItem(key, JSON.stringify(log));

        // Registro permanente cancellazione per evitare che il cloud la ripristini
        if (removedItem && removedItem.date) {
            const delKey = 'deletedWeights_' + profile;
            const delList = JSON.parse(localStorage.getItem(delKey) || '[]');
            if (!delList.includes(removedItem.date)) {
                delList.push(removedItem.date);
                localStorage.setItem(delKey, JSON.stringify(delList));
            }
            if (typeof window.syncSaluteToCloud === 'function') {
                window.syncSaluteToCloud({
                    [key]: JSON.stringify(log),
                    _forceWeightLog: true,
                    _deletedWeights: [{ profile, date: removedItem.date }]
                });
            }
        }

        if (typeof showToast === 'function') showToast(`Pesata del ${label} eliminata definitivamente! 🗑️`);
        if (typeof loadProgress === 'function') loadProgress(profile);
        if (typeof window.refreshDashboardStats === 'function') window.refreshDashboardStats(profile);
    } else {
        if (label === '29/09') {
            if (typeof showCustomAlert === 'function') showCustomAlert("Questo è il peso iniziale. Se vuoi modificarlo, cambia il Peso Iniziale in alto.");
            else showToast("Questo è il peso iniziale. Se vuoi modificarlo, cambia il Peso Iniziale in alto.");
        } else {
            if (typeof showToast === 'function') showToast("Pesata non trovata o già rimossa.");
        }
    }

    if (typeof closeChartFocusBadge === 'function') closeChartFocusBadge(profile);
    closeDeleteModal();
};

// ---- TOAST NOTIFICATIONS (BEAUTIFUL ALERTS) ----
window.showToast = function (message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.background = isError ? '#e53935' : '#4caf50';
    toast.style.color = '#fff';
    toast.style.padding = '15px 25px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    toast.style.fontSize = '16px';
    toast.style.fontWeight = 'bold';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    toast.innerHTML = isError ? '❌ ' + message : '✅ ' + message;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    // Animate out after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
};

// --- RECOVERED FUNCTIONS ---
window.autoFillWeek = function (profile) {
    let profileId = typeof profile === 'string' ? profile : (profile === 0 ? 'marito' : 'moglie');
    if (typeof showCustomConfirm === 'function') {
        showCustomConfirm('Vuoi riempire i pasti vuoti della settimana con ricette casuali?', function () { runAutoFill(profileId); });
    } else {
        if (confirm('Vuoi riempire i pasti vuoti della settimana con ricette casuali?')) runAutoFill(profileId);
    }
};

function runAutoFill(profileId) {
    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];
    if (!table) return;

    let allRecipes = [...(JSON.parse(localStorage.getItem('myCustomRecipes')) || []), ...(typeof defaultRecipes !== 'undefined' ? defaultRecipes : [])];
    if (allRecipes.length === 0) return;

    const pranzi = allRecipes.filter(r => ['pasta', 'riso', 'farro', 'quinoa', 'pollo', 'salmone', 'orata', 'sgombro', 'zuppa', 'lenticchie', 'fesa', 'tonno', 'uova', 'insalata'].some(k => (r.text || r.nome || r.name || '').toLowerCase().includes(k)));
    const cene = pranzi;
    const spuntini = allRecipes.filter(r => ['frutta', 'mela', 'noci', 'mandorle', 'yogurt', 'kefir', 'cioccolato', 'barretta', 'spuntino', 'snack', 'pane'].some(k => (r.text || r.nome || r.name || '').toLowerCase().includes(k)));

    // Fallback se non trova spuntini nel ricettario
    const defaultSpuntini = [
        { text: "1 Mela e 10g mandorle" },
        { text: "Yogurt greco 150g" },
        { text: "15g noci + 1 frutto" },
        { text: "Spremuta d'arancia" },
        { text: "Kefir e un quadratino di cioccolato fondente" }
    ];
    let spuntiniList = spuntini.length > 0 ? spuntini : defaultSpuntini;

    const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)] || arr[0] || { text: 'Ricetta casuale' };

    let typeSelect = document.getElementById('fast_type_' + profileId);
    let fastType = typeSelect ? typeSelect.value : (localStorage.getItem('fast_type_' + profileId) || '16');


    const omadMealList = [
        { text: "Gran Piatto Unico OMAD: 100g riso basmati integrale 🍚, 250g orata o branzino al forno 🐟, zucchine e carciofi stufati 🥗, 2 cucch. olio EVO 🫒, 25g mandorle 🥜, 1 mela fresca 🍎 (Pasto Unico Completo)" },
        { text: "Gran Piatto Unico OMAD: 90g farro integrale 🌾, 250g salmone fresco al vapore 🍣, finocchi e broccoli all'agro 🥗, 2 cucch. olio EVO 🫒, 20g noci 🥜, 1 pera 🍐 (Pasto Unico Completo)" },
        { text: "Gran Piatto Unico OMAD: 100g pasta integrale 🍝 con crema di carciofi, 200g petto di pollo ai ferri 🍗 + 2 uova in camicia 🍳, insalatona mista 🥗, 2 cucch. olio EVO 🫒, 1 banana 🍌 (Pasto Unico Completo)" },
        { text: "Gran Piatto Unico OMAD: 250g patate al forno 🥔, 250g filetto di sgombro fresco 🐟, carote e rucola fresca 🥕, 2 cucch. olio EVO 🫒, yogurt greco 150g con mirtilli 🫐 e 20g mandorle 🥜 (Pasto Unico Completo)" },
        { text: "Gran Piatto Unico OMAD: 90g quinoa reale 🌾 con verdure miste 🥗, 250g merluzzo in padella con pomodorini 🐟, 2 uova sode 🥚, 2 cucch. olio EVO 🫒, 2 fette pane segale 🍞, 1 arancia 🍊 (Pasto Unico Completo)" },
        { text: "Gran Piatto Unico OMAD: Zuppa ricca con 150g lenticchie e 70g riso 🧆, 200g fesa di tacchino al limone 🍗, spinaci saltati 🥗, 2 cucch. olio EVO 🫒, 20g noci 🥜, 1 frutto di stagione 🍎 (Pasto Unico Completo)" },
        { text: "Gran Piatto Unico OMAD: 90g riso venere 🍚 con gamberi e zucchine, 200g orata al cartoccio 🐟, insalatona di campo 🥗, 2 cucch. olio EVO 🫒, 25g mandorle tostate 🥜, 1 mela verde 🍏 (Pasto Unico Completo)" }
    ];

    const warriorDinnerList = [
        { text: "Grande Cena Warrior: 90g riso integrale 🍚, 220g salmone al forno 🍣, zucchine e carciofi 🥗, 2 cucch. olio EVO 🫒, 1 frutto 🍎" },
        { text: "Grande Cena Warrior: 90g pasta integrale 🍝 con pomodorini, 200g petto di pollo 🍗, spinaci stufati 🥗, 2 cucch. olio EVO 🫒, 15g noci 🥜" },
        { text: "Grande Cena Warrior: 200g patate novelle al forno 🥔, 220g orata fresca 🐟, finocchi crudi 🥗, 2 cucch. olio EVO 🫒, yogurt greco 🥣" },
        { text: "Grande Cena Warrior: 80g farro 🌾 con lenticchie, 180g filetto di merluzzo 🐟, carote e rucola 🥗, 2 cucch. olio EVO 🫒, 1 frutto 🍐" }
    ];

    const warriorSnackList = [
        { text: "Spuntino Apertura Finestra: 1 mela fresca 🍎, 20g noci 🥜 e tisana al finocchio" },
        { text: "Spuntino Apertura Finestra: Yogurt greco 150g 🥣 con mirtilli 🫐 e 15g mandorle 🥜" },
        { text: "Spuntino Apertura Finestra: 1 banana matura 🍌, 15g mandorle 🥜 e tè verde non zuccherato" },
        { text: "Spuntino Apertura Finestra: Finocchi e carote croccanti 🥕 con 30g parmigiano o noci 🥜" }
    ];


    let cellsUpdated = 0;
    let rowIndex = 0;
    table.querySelectorAll('tbody tr').forEach(row => {
        let cells = row.querySelectorAll('td.editable-cell');
        if (cells.length < 3) return;

        if (fastType === '23') {
            // === PROTOCOLLO OMAD (23:1 - UN SOLO PASTO) ===
            // Pranzo e Spuntini impostati su Digiuno 23h (0 kcal)
            cells[0].innerText = "⏳ Digiuno 23h (Idratazione: Acqua, Tè verde, Caffè amaro)";
            localStorage.setItem(cells[0].id, cells[0].innerText);

            cells[2].innerText = "⏳ Digiuno 23h (0 kcal)";
            localStorage.setItem(cells[2].id, cells[2].innerText);

            // Solo la Cena viene riempita con il Pasto Unico calibrato (~1350-1400 kcal)
            let chosenOmad = omadMealList[rowIndex % omadMealList.length].text;
            cells[1].innerText = chosenOmad;
            localStorage.setItem(cells[1].id, cells[1].innerText);
            cellsUpdated += 3;

        } else if (fastType === '20') {
            // === PROTOCOLLO WARRIOR DIET (20:4) ===
            cells[0].innerText = "⏳ Fase Digiuno (Acqua, Tè, Tisane)";
            localStorage.setItem(cells[0].id, cells[0].innerText);

            let chosenSnack = warriorSnackList[rowIndex % warriorSnackList.length].text;
            cells[2].innerText = chosenSnack;
            localStorage.setItem(cells[2].id, cells[2].innerText);

            let chosenDinner = warriorDinnerList[rowIndex % warriorDinnerList.length].text;
            cells[1].innerText = chosenDinner;
            localStorage.setItem(cells[1].id, cells[1].innerText);
            cellsUpdated += 3;

        } else if (fastType === '18') {
            // === PROTOCOLLO 18:6 (FINESTRA 6 ORE - 2 PASTI, NIENTE SPUNTINI) ===
            cells[0].innerText = (getRandom(pranzi).text || getRandom(pranzi).nome || 'Pranzo');
            localStorage.setItem(cells[0].id, cells[0].innerText);
            cells[1].innerText = (getRandom(cene).text || getRandom(cene).nome || 'Cena');
            localStorage.setItem(cells[1].id, cells[1].innerText);
            cells[2].innerText = "⏳ Digiuno Fuori Finestra (0 kcal)";
            localStorage.setItem(cells[2].id, cells[2].innerText);
            cellsUpdated += 3;

        } else {
            // === PROTOCOLLO 16:8 / 14:10 / 12:12 / TRADIZIONALE (3 PASTI ATTIVI) ===
            cells[0].innerText = (getRandom(pranzi).text || getRandom(pranzi).nome || 'Pranzo');
            localStorage.setItem(cells[0].id, cells[0].innerText);
            cells[1].innerText = (getRandom(cene).text || getRandom(cene).nome || 'Cena');
            localStorage.setItem(cells[1].id, cells[1].innerText);
            cells[2].innerText = (getRandom(spuntiniList).text || getRandom(spuntiniList).nome || 'Spuntino');
            localStorage.setItem(cells[2].id, cells[2].innerText);
            cellsUpdated += 3;
        }
        rowIndex++;
    });

    if (cellsUpdated > 0) {
        if (typeof showToast === 'function') showToast('Riempiti ' + cellsUpdated + ' pasti vuoti!');
        else alert('Riempiti ' + cellsUpdated + ' pasti vuoti!');
    } else {
        if (typeof showToast === 'function') showToast('Tutti i pasti erano già pianificati!');
        else alert('Tutti i pasti erano già pianificati!');
    }

    let pat = (typeof getProfilePathology === 'function') ? getProfilePathology(profileId) : (localStorage.getItem('pathology_' + profileId) || 'steatosi');
    table.querySelectorAll('tbody tr').forEach(row => {
        let rowCells = row.querySelectorAll('td.editable-cell');
        rowCells.forEach(cell => {
            if (typeof autoEmoji === 'function') autoEmoji(cell);
            let clean = getCleanCellText(cell.innerText);
            localStorage.setItem(cell.id, clean);
            if (typeof formatCellWithWarnings === 'function') {
                formatCellWithWarnings(cell, pat);
            }
        });
        const event = new Event('input', { bubbles: true });
        row.dispatchEvent(event);
    });

    // Forza ricalcolo kcal
    if (typeof updateSgarrometro === 'function') updateSgarrometro();
}

window.exportDietPDF = function (profile) {
    let profileId = typeof profile === 'string' ? profile : (profile === 0 ? 'marito' : 'moglie');
    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profile];
    if (!table) return;

    let opt = {
        margin: 0.5,
        filename: 'Dieta_' + profileId + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    if (typeof html2pdf !== 'undefined') html2pdf().set(opt).from(table).save();
    else alert("Libreria PDF non caricata!");
};

window.initAllProfiles = function () {
    let profilesToInit = (typeof globalProfiles !== 'undefined') ? globalProfiles : ['marito', 'moglie'];

    profilesToInit.forEach(profile => {
        initBeverage(profile, 'water', 8);
        initBeverage(profile, 'coffee', 3);
        loadProgress(profile);
        loadMood(profile);
        initWalk(profile);
        // Sincronizza tabella con protocollo digiuno attivo
        let savedFastType = localStorage.getItem('fast_type_' + profile) || '16';
        let savedFastStart = localStorage.getItem('fast_start_' + profile) || '20:30';
        let savedFastEnd = localStorage.getItem('fast_end_' + profile) || '12:30';
        updateWeeklyTableForFasting(profile, savedFastType, savedFastStart, savedFastEnd);
        if (typeof loadFasting === 'function') loadFasting(profile);
    });

    if (typeof initEditableMenus === 'function') initEditableMenus();
    if (typeof initFamilySyncControls === 'function') initFamilySyncControls();
};


// --- GESTIONE DIGIUNO MULTI-PROTOCOLLO ---
window.calcEndFasting = function (profile) {
    let typeSelect = document.getElementById('fast_type_' + profile);
    let startInput = document.getElementById('fast_start_' + profile);
    let endInput = document.getElementById('fast_end_' + profile);

    if (!typeSelect || !startInput || !endInput) return;
    if (typeSelect.value === 'none') return;

    let fastHours = parseInt(typeSelect.value) || 16;
    let startParts = startInput.value.split(':');
    if (startParts.length !== 2) return;

    let startH = parseInt(startParts[0]);
    let startM = parseInt(startParts[1]);

    let endH = (startH + fastHours) % 24;

    let endHStr = endH.toString().padStart(2, '0');
    let startMStr = startM.toString().padStart(2, '0');

    endInput.value = endHStr + ':' + startMStr;
};

window.saveFasting = function (profile) {
    let typeSelect = document.getElementById('fast_type_' + profile);
    let startInput = document.getElementById('fast_start_' + profile);
    let endInput = document.getElementById('fast_end_' + profile);
    if (!typeSelect) return;

    localStorage.setItem('fast_type_' + profile, typeSelect.value);
    if (startInput) localStorage.setItem('fast_start_' + profile, startInput.value);
    if (endInput) localStorage.setItem('fast_end_' + profile, endInput.value);
};

window.disableFasting = function (profile) {
    let typeSelect = document.getElementById('fast_type_' + profile);
    if (typeSelect) typeSelect.value = 'none';
    saveFasting(profile);
    updateFasting(profile);
};

window.loadFasting = function (profile) {
    let typeSelect = document.getElementById('fast_type_' + profile);
    let startInput = document.getElementById('fast_start_' + profile);
    let endInput = document.getElementById('fast_end_' + profile);
    if (!typeSelect) return;

    let savedType = localStorage.getItem('fast_type_' + profile);
    if (!savedType) savedType = '16'; // default 16 se prima volta

    typeSelect.value = savedType;

    if (startInput) {
        let savedStart = localStorage.getItem('fast_start_' + profile) || '20:30';
        startInput.value = savedStart;
    }

    calcEndFasting(profile);
    updateFasting(profile);
};

window.onFastingChange = function (profile) {
    calcEndFasting(profile);
    saveFasting(profile);
    updateFasting(profile);

    // Chiede all'utente se vuole rigenerare e adattare subito i pasti della settimana al nuovo schema
    let typeSelect = document.getElementById('fast_type_' + profile);
    let fastType = typeSelect ? typeSelect.value : 'none';
    let fastLabels = {
        '23': 'OMAD (23:1 - Un solo pasto al giorno)',
        '20': 'Warrior Diet (20:4 - Finestra 4 ore)',
        '18': '18:6 (Avanzato - Finestra 6 ore)',
        '16': '16:8 (Standard - Finestra 8 ore)',
        '14': '14:10 (Intermedio)',
        '12': '12:12 (Principianti)',
        'none': 'Dieta Libera Tradizionale'
    };
    let label = fastLabels[fastType] || fastType;

    if (typeof showCustomConfirm === 'function') {
        showCustomConfirm("Hai impostato: " + label + ".\n\nVuoi aggiornare e riempire automaticamente la tabella dei pasti per adeguarla subito a questi orari?", function () {
            runAutoFill(profile);
        });
    }
};


// ============================================================
// ADATTAMENTO DINAMICO TABELLA SETTIMANALE AL DIGIUNO INTERMITTENTE
// ============================================================
function updateWeeklyTableForFasting(profile, fastType, startTime, endTime) {
    if (!profile) profile = window.activeProfile || 'marito';
    let section = document.getElementById('section-' + profile);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profile === 'marito' ? 0 : 1];
    if (!table) return;

    if (!fastType) {
        let typeSelect = document.getElementById('fast_type_' + profile);
        fastType = typeSelect ? typeSelect.value : (localStorage.getItem('fast_type_' + profile) || '16');
    }
    if (!startTime) {
        let startInput = document.getElementById('fast_start_' + profile);
        startTime = startInput ? startInput.value : (localStorage.getItem('fast_start_' + profile) || '20:30');
    }
    if (!endTime) {
        let endInput = document.getElementById('fast_end_' + profile);
        endTime = endInput ? endInput.value : (localStorage.getItem('fast_end_' + profile) || '12:30');
    }

    let thead = table.querySelector('thead');
    if (!thead) return;
    let ths = thead.querySelectorAll('th');
    if (ths.length < 5) return;

    // ths[0]: Giorno
    // ths[1]: Pranzo (Col 1)
    // ths[2]: Cena (Col 2)
    // ths[3]: Spuntini (Col 3)
    // ths[4]: Kcal Totali

    if (fastType === '23') {
        // --- OMAD (23:1 - UN SOLO PASTO AL GIORNO) ---
        ths[1].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">⏳ 23h Digiuno (Pranzo)</div><div style="margin-top:4px; font-size:0.75rem; font-weight:600; color:#ffffff; background:rgba(0,0,0,0.32); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.25);">Solo liquidi non calorici</div>';
        ths[2].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.98rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍲 Pasto Unico OMAD (' + endTime + ' - ' + startTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Cena completa nutriente (100% Kcal)</div>';
        ths[3].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">⏳ Digiuno Spuntini</div><div style="margin-top:4px; font-size:0.75rem; font-weight:600; color:#ffffff; background:rgba(0,0,0,0.32); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.25);">0 kcal (Fuori finestra)</div>';

        table.querySelectorAll('tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td.editable-cell');
            if (cells.length >= 3) {
                cells[0].style.backgroundColor = '#f8fafc';
                cells[2].style.backgroundColor = '#f8fafc';
                cells[1].style.backgroundColor = '#f0fdf4';
            }
        });
    } else if (fastType === '20') {
        // --- WARRIOR DIET (20:4 - FINESTRA STRETTA 4 ORE) ---
        // Apertura pasti: endTime (es. 15:00) | Cena principale prima del digiuno: startTime (es. 19:00)
        ths[1].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">⏳ 20h Digiuno (Pranzo)</div><div style="margin-top:4px; font-size:0.75rem; font-weight:600; color:#ffffff; background:rgba(0,0,0,0.32); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.25);">Idratazione attiva (0 kcal)</div>';
        ths[2].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.98rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🥩 Grande Cena Warrior (' + startTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Pasto principale (~80% Kcal)</div>';
        ths[3].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍎 Apertura Finestra (' + endTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Spuntino leggero (~20% Kcal)</div>';

        table.querySelectorAll('tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td.editable-cell');
            if (cells.length >= 3) {
                cells[0].style.backgroundColor = '#f8fafc';
                cells[1].style.backgroundColor = '#f0fdf4';
                cells[2].style.backgroundColor = '#f0f9ff';
            }
        });
    } else if (fastType === '18') {
        // --- 18:6 (AVANZATO - FINESTRA 6 ORE) ---
        ths[1].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍲 Pranzo Apertura (' + startTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Primo pasto (~55% Kcal)</div>';
        ths[2].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🥗 Cena Chiusura (' + endTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Ultimo pasto (~45% Kcal)</div>';
        ths[3].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">⏳ Digiuno Spuntini</div><div style="margin-top:4px; font-size:0.75rem; font-weight:600; color:#ffffff; background:rgba(0,0,0,0.32); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.25);">Niente spuntini (0 kcal)</div>';

        table.querySelectorAll('tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td.editable-cell');
            if (cells.length >= 3) {
                cells[0].style.backgroundColor = '#ffffff';
                cells[1].style.backgroundColor = '#ffffff';
                cells[2].style.backgroundColor = '#f8fafc';
            }
        });
    } else if (fastType === '16') {
        // --- 16:8 (STANDARD - FINESTRA 8 ORE) ---
        ths[1].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍲 Pranzo (' + startTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Primo pasto (~50%)</div>';
        ths[2].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🥗 Cena (' + endTime + ')</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Ultimo pasto (~40%)</div>';
        ths[3].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍎 Spuntino Pomeridiano</div><div style="margin-top:4px; font-size:0.75rem; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.28); padding:2px 8px; border-radius:12px; display:inline-block; border:1px solid rgba(255,255,255,0.5); text-shadow:0 1px 2px rgba(0,0,0,0.2);">Entro finestra 8h</div>';

        table.querySelectorAll('tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td.editable-cell');
            if (cells.length >= 3) {
                cells[0].style.backgroundColor = '#ffffff';
                cells[1].style.backgroundColor = '#ffffff';
                cells[2].style.backgroundColor = '#ffffff';
            }
        });
    } else {
        // --- 14:10 / 12:12 / TRADIZIONALE ---
        ths[1].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍲 Pranzo (13:30)</div>';
        ths[2].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🥗 Cena (20:00)</div>';
        ths[3].innerHTML = '<div style="color:#ffffff; font-weight:800; font-size:0.96rem; text-shadow:0 1px 2px rgba(0,0,0,0.35);">🍎 Spuntini</div>';

        table.querySelectorAll('tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td.editable-cell');
            if (cells.length >= 3) {
                cells[0].style.backgroundColor = '#ffffff';
                cells[1].style.backgroundColor = '#ffffff';
                cells[2].style.backgroundColor = '#ffffff';
            }
        });
    }
}


window.updateFasting = function (profile) {
    let typeSelect = document.getElementById('fast_type_' + profile);
    let startInput = document.getElementById('fast_start_' + profile);
    let endInput = document.getElementById('fast_end_' + profile);
    if (!typeSelect) return;

    let detailsEl = document.getElementById('fast_details_' + profile);
    let disabledMsgEl = document.getElementById('fast_disabled_msg_' + profile);
    let disableBtn = document.getElementById('fast_disable_btn_' + profile);
    let badgeEl = document.getElementById('fast_badge_' + profile);
    let dietTitleEl = document.getElementById('diet_title_' + profile);

    // CASO DISATTIVATO (NESSUN DIGIUNO)
    if (typeSelect.value === 'none') {
        if (detailsEl) detailsEl.style.display = 'none';
        if (disabledMsgEl) disabledMsgEl.style.display = 'block';
        if (disableBtn) disableBtn.style.display = 'none';

        if (badgeEl) {
            badgeEl.innerHTML = "🍽️ Dieta Tradizionale";
            badgeEl.style.background = "#546e7a";
        }
        if (dietTitleEl) {
            dietTitleEl.innerHTML = "📊 Piano Settimanale Completo (Dieta Standard)";
        }
        updateWeeklyTableForFasting(profile, 'none', '13:30', '20:00');
        return;
    }

    // CASO DIGIUNO ATTIVO
    if (detailsEl) detailsEl.style.display = 'block';
    if (disabledMsgEl) disabledMsgEl.style.display = 'none';
    if (disableBtn) disableBtn.style.display = 'inline-block';

    if (!startInput || !endInput) return;

    let fastHours = parseInt(typeSelect.value) || 16;
    let eatHours = 24 - fastHours;
    let startTime = startInput.value;
    let endTime = endInput.value;

    let now = new Date();
    let currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    let startParts = startTime.split(':');
    let startTotalMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);

    let endParts = endTime.split(':');
    let endTotalMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    let isFasting = false;
    let elapsedMinutes = 0;
    let totalFastingWindow = 0;
    let timeLeft = 0;

    if (startTotalMinutes > endTotalMinutes) {
        totalFastingWindow = (24 * 60 - startTotalMinutes) + endTotalMinutes;
        if (currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes) {
            isFasting = true;
            if (currentTotalMinutes >= startTotalMinutes) elapsedMinutes = currentTotalMinutes - startTotalMinutes;
            else elapsedMinutes = (24 * 60 - startTotalMinutes) + currentTotalMinutes;
            timeLeft = totalFastingWindow - elapsedMinutes;
        } else {
            timeLeft = startTotalMinutes - currentTotalMinutes;
        }
    } else {
        totalFastingWindow = endTotalMinutes - startTotalMinutes;
        if (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes) {
            isFasting = true;
            elapsedMinutes = currentTotalMinutes - startTotalMinutes;
            timeLeft = totalFastingWindow - elapsedMinutes;
        } else {
            if (currentTotalMinutes < startTotalMinutes) timeLeft = startTotalMinutes - currentTotalMinutes;
            else timeLeft = (24 * 60 - currentTotalMinutes) + startTotalMinutes;
        }
    }

    let hoursLeft = Math.floor(timeLeft / 60);
    let minsLeft = timeLeft % 60;
    let currentSec = now.getSeconds();
    let secLeft = (60 - currentSec) % 60;
    let timeStr = (hoursLeft > 0 ? hoursLeft + "h " : "") + minsLeft + "m " + String(secLeft).padStart(2, '0') + "s";
    let formattedDigits = String(hoursLeft).padStart(2, '0') + ":" + String(minsLeft).padStart(2, '0') + ":" + String(secLeft).padStart(2, '0');

    // Status & Progress elements
    let statusEl = document.getElementById('fast_status_' + profile);
    let progressEl = document.getElementById('fast_progress_' + profile);
    let timeEl = document.getElementById('fast_time_left_' + profile);
    let digitsEl = document.getElementById('fast_live_digits_' + profile);
    let phaseBadgeEl = document.getElementById('fast_phase_badge_' + profile);

    if (digitsEl) {
        digitsEl.innerText = formattedDigits;
    }

    if (isFasting) {
        if (statusEl) {
            statusEl.innerHTML = "⏳ FASE DI DIGIUNO (" + fastHours + " ORE)";
            statusEl.style.color = "#d32f2f";
        }
        if (progressEl) {
            progressEl.style.background = "linear-gradient(90deg, #ea580c, #dc2626)";
            let percent = totalFastingWindow > 0 ? Math.min(100, Math.max(0, (elapsedMinutes / totalFastingWindow) * 100)) : 0;
            progressEl.style.width = percent.toFixed(1) + "%";
        }
        if (timeEl) {
            timeEl.innerHTML = "Mancano <strong>" + timeStr + "</strong> all'inizio dei pasti (ore " + endTime + ") 💪";
        }
        if (phaseBadgeEl) {
            if (elapsedMinutes < 12 * 60) {
                phaseBadgeEl.innerHTML = "🟡 Digestione & Calo Insulina";
                phaseBadgeEl.style.background = "#fef9c3";
                phaseBadgeEl.style.color = "#854d0e";
                phaseBadgeEl.style.borderColor = "#fef08a";
            } else if (elapsedMinutes < 16 * 60) {
                phaseBadgeEl.innerHTML = "🟠 Brucia-Grassi Attivo (Chetosi)";
                phaseBadgeEl.style.background = "#ffedd5";
                phaseBadgeEl.style.color = "#9a3412";
                phaseBadgeEl.style.borderColor = "#fed7aa";
            } else {
                phaseBadgeEl.innerHTML = "🔥 Autofagia & Rigenerazione Cellulare";
                phaseBadgeEl.style.background = "#fee2e2";
                phaseBadgeEl.style.color = "#991b1b";
                phaseBadgeEl.style.borderColor = "#fca5a5";
            }
        }
    } else {
        if (statusEl) {
            statusEl.innerHTML = "🍽️ FINESTRA PASTI ATTIVA (" + eatHours + " ORE)";
            statusEl.style.color = "#2e7d32";
        }
        if (progressEl) {
            progressEl.style.background = "linear-gradient(90deg, #16a34a, #22c55e)";
            progressEl.style.width = "100%";
        }
        if (timeEl) {
            timeEl.innerHTML = "Puoi consumare i pasti. Tra <strong>" + timeStr + "</strong> inizierà il nuovo digiuno (ore " + startTime + ").";
        }
        if (phaseBadgeEl) {
            phaseBadgeEl.innerHTML = "🟢 Finestra Nutrizione Aperta 🍲";
            phaseBadgeEl.style.background = "#dcfce7";
            phaseBadgeEl.style.color = "#166534";
            phaseBadgeEl.style.borderColor = "#bbf7d0";
        }
    }

    // Indicatore finestre orarie nel widget
    let windowFastEl = document.getElementById('fast_window_fast_' + profile);
    if (windowFastEl) {
        windowFastEl.innerHTML = startTime + " ➔ " + endTime + " (" + fastHours + "h)";
    }
    let windowEatEl = document.getElementById('fast_window_eat_' + profile);
    if (windowEatEl) {
        windowEatEl.innerHTML = endTime + " ➔ " + startTime + " (" + eatHours + "h)";
    }

    // Note dinamiche specifiche per ciascun protocollo
    let noteFastEl = document.getElementById('fast_note_fast_' + profile);
    let noteEatEl = document.getElementById('fast_note_eat_' + profile);

    const protocolNotes = {
        "12": {
            fast: "🌙 <strong>Digiuno circadiano naturale (12h):</strong> coincide con la notte. Consentiti: acqua minerale, tè, tisane rilassanti o caffè non zuccherato.",
            eat: "☀️ <strong>Finestra ampia (12h):</strong> 3 pasti completi (Colazione, Pranzo e Cena) + eventuali spuntini a piacere."
        },
        "14": {
            fast: "🌙 <strong>14h brucia-grassi:</strong> salta la colazione anticipata o anticipa la cena. Attiva i primi processi di combustione lipidica. Solo liquidi a 0 kcal.",
            eat: "☀️ <strong>Finestra moderata (10h):</strong> Colazione tarda o spuntino, Pranzo e Cena concentrati nell'arco di 10 ore."
        },
        "16": {
            fast: "🌙 <strong>Autofagia cellulare & chetosi (16h):</strong> colazione saltata. Bevi abbondante acqua, caffè amaro o tè verde per spezzare l'appetito.",
            eat: "☀️ <strong>Finestra classica (8h):</strong> 2 pasti principali abbondanti (Pranzo e Cena) + eventuale spuntino proteico pomeridiano."
        },
        "18": {
            fast: "🌙 <strong>Chetosi avanzata & rigenerazione (18h):</strong> massima mobilizzazione delle riserve di grasso. Idratazione continua con acqua e tisane.",
            eat: "☀️ <strong>Finestra concentrata (6h):</strong> 2 pasti ravvicinati e nutrienti ad alta densità proteica e vitaminica."
        },
        "20": {
            fast: "🌙 <strong>Warrior Diet (20h):</strong> 20 ore di pulizia digestiva e massima concentrazione. Bere acqua, tè e sali minerali.",
            eat: "☀️ <strong>Finestra stretta (4h):</strong> una ricca e completa cena serale nutriente con proteine, carboidrati e verdure in abbondanza."
        },
        "23": {
            fast: "🌙 <strong>OMAD (23h):</strong> 23 ore di digiuno totale. Fondamentale bere almeno 2.5 litri di liquidi non calorici durante il giorno.",
            eat: "☀️ <strong>Un solo pasto al giorno (1h):</strong> cena unica completa di tutti i macronutrienti e micronutrienti essenziali."
        }
    };

    let pKey = typeSelect.value;
    if (protocolNotes[pKey]) {
        if (noteFastEl) noteFastEl.innerHTML = protocolNotes[pKey].fast;
        if (noteEatEl) noteEatEl.innerHTML = protocolNotes[pKey].eat;
    } else {
        if (noteFastEl) noteFastEl.innerHTML = "Consentiti: Acqua, tè, tisane e caffè senza zucchero.";
        if (noteEatEl) noteEatEl.innerHTML = "Concentra i tuoi pasti all'interno di questa fascia oraria.";
    }

    // Badge nel Profilo (Header scheda)
    if (badgeEl) {
        badgeEl.innerHTML = "⏳ Digiuno " + fastHours + ":" + eatHours + " (" + startTime + " - " + endTime + ")";
        badgeEl.style.background = "#2e7d32";
    }

    // Titolo dinamico del Menù Settimanale
    if (dietTitleEl) {
        dietTitleEl.innerHTML = "📊 Piano Settimanale Completo (Digiuno " + fastHours + ":" + eatHours + ")";
    }
    // Adatta le colonne della tabella e le celle al protocollo orario di digiuno
    updateWeeklyTableForFasting(profile, typeSelect.value, startTime, endTime);

    // CHICCA 1: Coach Dinamico con Pillole Interattive Cliccabili
    // CHICCA 1: Coach Dinamico con Pillole Interattive Cliccabili
    let tipTextEl = document.getElementById('fast_smart_tip_text_' + profile);
    if (tipTextEl) {
        let currentH = now.getHours();
        let advice = "";

        let pillVerdure = '<span onclick="openNutritionTip(\'verdure\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per scoprire le verdure di stagione">verdure fresche 🥗</span>';
        let pillProteine = '<span onclick="openNutritionTip(\'proteine\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per capire cosa sono le proteine nobili">proteine nobili 🍗</span>';
        let pillCarboidrati = '<span onclick="openNutritionTip(\'carboidrati\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per scoprire i carboidrati complessi sani">carboidrati complessi 🌾</span>';
        let pillAutofagia = '<span onclick="openNutritionTip(\'autofagia\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per approfondire">autofagia cellulare 🧬</span>';

        tipTextEl.setAttribute('data-is-fasting', isFasting ? 'true' : 'false');
        let prevFasting = tipTextEl.getAttribute('data-prev-fasting');
        let fastingChanged = (prevFasting !== null && prevFasting !== (isFasting ? 'true' : 'false'));
        tipTextEl.setAttribute('data-prev-fasting', isFasting ? 'true' : 'false');

        // Se l\'utente ha cliccato "Cambia Consiglio" e siamo nella stessa fase, mantieni il consiglio scelto dall\'utente!
        if (!tipTextEl.dataset.userChosen || fastingChanged || !tipTextEl.innerHTML.trim()) {
            if (isFasting) {
                if (timeLeft <= 45) {
                    advice = "🔥 <strong>Quasi al traguardo:</strong> tra meno di 45 minuti si aprono i pasti! Rompi il digiuno con cibi leggeri (" + pillVerdure + " o " + pillProteine + ") per non impennare la glicemia.";
                } else if (currentH >= 6 && currentH <= 11) {
                    advice = "☕ <strong>Mattinata di digiuno:</strong> bevi un abbondante bicchiere d\'acqua fresca o caffè/tè amaro. Stimolerà il metabolismo e spegnerà subito la falsa fame!";
                } else if (currentH >= 21 || currentH <= 5) {
                    advice = "🌙 <strong>Riposo e rigenerazione:</strong> durante la notte il tuo corpo attiva i processi di " + pillAutofagia + " e brucia i grassi accumulati. Sogni d\'oro!";
                } else {
                    advice = "💧 <strong>Idratazione attiva:</strong> tisane calde, tè verde o acqua minerale ti mantengono sazio e supportano la naturale depurazione durante il digiuno.";
                }
            } else {
                if (timeLeft <= 45) {
                    advice = "⏳ <strong>Finestra in chiusura:</strong> mancano pochi minuti prima del nuovo digiuno. Assicurati di aver bevuto a sufficienza e assunto tutte le " + pillProteine + " necessarie.";
                } else if (currentH >= 12 && currentH <= 15) {
                    advice = "🥗 <strong>Buon appetito:</strong> componi il tuo piatto con il 50% di " + pillVerdure + ", il 25% di " + pillProteine + " e il 25% di " + pillCarboidrati + ". Mastica con calma!";
                } else {
                    advice = "🍎 <strong>Finestra pasti attiva:</strong> se hai fame tra i pasti, prediligi uno spuntino saziante a base di " + pillProteine + " (es. yogurt greco 0%), frutta secca o un frutto di stagione.";
                }
            }
            tipTextEl.innerHTML = advice;
        }
    }
};

// Timer periodico per aggiornare lo stato di digiuno in tempo reale (ogni 30 secondi)
setInterval(() => {
    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
    profiles.forEach(p => {
        let prof = typeof p === 'string' ? p : p.id;
        if (document.getElementById('fast_type_' + prof)) {
            updateFasting(prof);
        }
    });
}, 30000);

// Init rapido all'avvio
setTimeout(() => {
    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
    profiles.forEach(p => {
        let prof = typeof p === 'string' ? p : p.id;
        if (document.getElementById('fast_type_' + prof)) {
            loadFasting(prof);
        }
    });
}, 400);

window.showFastingInfo = function (profile) {
    let typeSelect = document.getElementById('fast_type_' + profile);
    if (!typeSelect) return;

    let type = typeSelect.value;
    let title = "";
    let rules = "";
    let pros = "";
    let cons = "";

    switch (type) {
        case "none":
            title = "Dieta Tradizionale / Libera";
            rules = "Prevede la normale distribuzione della giornata alimentare (Colazione, Pranzo, Cena ed eventuali Spuntini) senza intervalli forzati di digiuno prolungato.";
            pros = "Massima flessibilità oraria, ideale per pranzi e cene in famiglia o con orari di lavoro variabili.";
            cons = "Non attiva l'autofagia e la chetosi cellulare tipiche del digiuno prolungato.";
            break;
        case "12":
            title = "12:12 (Principianti)";
            rules = "Prevede 12 ore di digiuno e 12 ore di finestra alimentare. Di solito si fa coincidere il digiuno con le ore notturne (es. dalle 20:00 alle 08:00).";
            pros = "Molto facile da seguire, asseconda il ritmo circadiano naturale. Ideale per iniziare ad abituare il corpo a non fare spuntini notturni.";
            cons = "I benefici sulla perdita di peso e sull'autofagia (rinnovamento cellulare) sono molto leggeri rispetto a digiuni pi\u00F9 lunghi.";
            break;
        case "14":
            title = "14:10 (Intermedio)";
            rules = "Prevede 14 ore di digiuno e 10 ore in cui concentrare i pasti.";
            pros = "Un ottimo compromesso. Inizia a stimolare il corpo a utilizzare le scorte di grasso come energia senza risultare troppo stressante.";
            cons = "Richiede di saltare la prima colazione mattutina oppure di cenare molto presto nel pomeriggio.";
            break;
        case "16":
            title = "16:8 (Standard / Popolare)";
            rules = "16 ore di digiuno e 8 ore per mangiare (es. pasti concentrati tra le 12:00 e le 20:00).";
            pros = "\u00C8 il metodo pi\u00F9 supportato a livello scientifico. Ottimizza la perdita di grasso, abbassa i livelli di insulina nel sangue, attiva l'autofagia e migliora la lucidit\u00E0 mentale.";
            cons = "I primi giorni il corpo deve abituarsi: si pu\u00F2 avvertire un forte senso di fame al mattino, un lieve mal di testa o irritabilit\u00E0.";
            break;
        case "18":
            title = "18:6 (Avanzato)";
            rules = "18 ore di digiuno e solo 6 ore di finestra alimentare (es. si mangia tra le 14:00 e le 20:00).";
            pros = "Massimizza la chetosi (brucia-grassi) e l'autofagia profonda. Ottimo per chi \u00E8 gi\u00E0 abituato al 16:8 e ha un metabolismo molto flessibile.";
            cons = "Finestra molto stretta. Pu\u00F2 risultare difficile riuscire ad assumere tutte le calorie e le vitamine necessarie in cos\u00EC poco tempo.";
            break;
        case "20":
            title = "20:4 (Warrior Diet)";
            rules = "20 ore di digiuno con un'unica e abbondante finestra serale di 4 ore.";
            pros = "Estrema rapidit\u00E0 nella perdita di massa grassa e forte 'reset' ormonale.";
            cons = "Sconsigliato a chi soffre di glicemia instabile, pressione bassa o ai principianti. Elevato rischio di abbuffate incontrollate e difficolt\u00E0 digestive per il troppo cibo in un solo colpo.";
            break;
        case "23":
            title = "23:1 (OMAD - One Meal A Day)";
            rules = "Un solo pasto al giorno e 23 ore di digiuno (solitamente si fa solo la cena).";
            pros = "Estrema semplicit\u00E0 logistica (non devi pensare al cibo per tutto il giorno) e massima attivazione del metabolismo dei grassi.";
            cons = "Protocollo estremo. \u00C8 praticamente impossibile assumere tutte le proteine e i micronutrienti necessari in un solo pasto. Va usato solo sotto controllo o per periodi brevissimi.";
            break;
    }

    // Create Modal
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    let box = document.createElement('div');
    box.style.backgroundColor = 'white';
    box.style.padding = '25px';
    box.style.borderRadius = '15px';
    box.style.maxWidth = '500px';
    box.style.width = '90%';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    box.style.transform = 'translateY(30px) scale(0.95)';
    box.style.transition = 'all 0.3s ease';
    box.style.fontFamily = 'sans-serif';

    let htmlContent = `
        <h2 style="color:#2e7d32; margin-top:0; border-bottom:2px solid #8bc34a; padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>ℹ️ Protocollo ${title}</span>
            <span style="cursor:pointer; color:#999; font-size:1.5rem; font-weight:bold;" onclick="this.closest('.fasting-modal-overlay').remove()">&times;</span>
        </h2>
        <div style="margin-top:15px; font-size:1.05rem; line-height:1.5; color:#333;">
            <p><strong>📖 Regole:</strong><br>${rules}</p>
            <p style="color:#388e3c; background:#e8f5e9; padding:10px; border-left:4px solid #4caf50; border-radius:0 5px 5px 0; margin:10px 0;"><strong>✅ Vantaggi:</strong><br>${pros}</p>
            <p style="color:#d32f2f; background:#ffebee; padding:10px; border-left:4px solid #f44336; border-radius:0 5px 5px 0; margin:10px 0;"><strong>⚠️ Svantaggi e Avvertenze:</strong><br>${cons}</p>
        </div>
        <div style="text-align:center; margin-top:20px;">
            <a href="https://www.marionegri.it/magazine/digiuno-intermittente-come-funziona-benefici" target="_blank" style="display:inline-block; margin-bottom:15px; color:#1976d2; text-decoration:none; font-size:0.9rem; border-bottom:1px solid #1976d2;">🔗 Per saperne di più (Approfondimento Medico)</a><br>
            <button onclick="this.closest('.fasting-modal-overlay').remove()" style="background:#2196f3; color:white; border:none; border-radius:8px; padding:10px 40px; font-size:1rem; font-weight:bold; cursor:pointer; box-shadow: 0 4px 6px rgba(33,150,243,0.3);">Ho Capito</button>
        </div>
    `;

    box.innerHTML = htmlContent;
    overlay.className = 'fasting-modal-overlay';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Animate In
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0) scale(1)';
    });
};

window.printFastingInfo = function (type) {
    let title = "";
    let rules = "";
    let pros = "";
    let cons = "";

    switch (type) {
        case "12":
            title = "12:12 (Principianti)";
            rules = "Prevede 12 ore di digiuno e 12 ore di finestra alimentare. Di solito si fa coincidere il digiuno con le ore notturne (es. dalle 20:00 alle 08:00).";
            pros = "Molto facile da seguire, asseconda il ritmo circadiano naturale. Ideale per iniziare ad abituare il corpo a non fare spuntini notturni.";
            cons = "I benefici sulla perdita di peso e sull'autofagia (rinnovamento cellulare) sono molto leggeri rispetto a digiuni pi\u00F9 lunghi.";
            break;
        case "14":
            title = "14:10 (Intermedio)";
            rules = "Prevede 14 ore di digiuno e 10 ore in cui concentrare i pasti.";
            pros = "Un ottimo compromesso. Inizia a stimolare il corpo a utilizzare le scorte di grasso come energia senza risultare troppo stressante.";
            cons = "Richiede di saltare la prima colazione mattutina oppure di cenare molto presto nel pomeriggio.";
            break;
        case "16":
            title = "16:8 (Standard / Popolare)";
            rules = "16 ore di digiuno e 8 ore per mangiare (es. pasti concentrati tra le 12:00 e le 20:00).";
            pros = "\u00C8 il metodo pi\u00F9 supportato a livello scientifico. Ottimizza la perdita di grasso, abbassa i livelli di insulina nel sangue, attiva l'autofagia e migliora la lucidit\u00E0 mentale.";
            cons = "I primi giorni il corpo deve abituarsi: si pu\u00F2 avvertire un forte senso di fame al mattino, un lieve mal di testa o irritabilit\u00E0.";
            break;
        case "18":
            title = "18:6 (Avanzato)";
            rules = "18 ore di digiuno e solo 6 ore di finestra alimentare (es. si mangia tra le 14:00 e le 20:00).";
            pros = "Massimizza la chetosi (brucia-grassi) e l'autofagia profonda. Ottimo per chi \u00E8 gi\u00E0 abituato al 16:8 e ha un metabolismo molto flessibile.";
            cons = "Finestra molto stretta. Pu\u00F2 risultare difficile riuscire ad assumere tutte le calorie e le vitamine necessarie in cos\u00EC poco tempo.";
            break;
        case "20":
            title = "20:4 (Warrior Diet)";
            rules = "20 ore di digiuno con un'unica e abbondante finestra serale di 4 ore.";
            pros = "Estrema rapidit\u00E0 nella perdita di massa grassa e forte 'reset' ormonale.";
            cons = "Sconsigliato a chi soffre di glicemia instabile, pressione bassa o ai principianti. Elevato rischio di abbuffate incontrollate e difficolt\u00E0 digestive per il troppo cibo in un solo colpo.";
            break;
        case "23":
            title = "23:1 (OMAD - One Meal A Day)";
            rules = "Un solo pasto al giorno e 23 ore di digiuno (solitamente si fa solo la cena).";
            pros = "Estrema semplicit\u00E0 logistica (non devi pensare al cibo per tutto il giorno) e massima attivazione del metabolismo dei grassi.";
            cons = "Protocollo estremo. \u00C8 praticamente impossibile assumere tutte le proteine e i micronutrienti necessari in un solo pasto. Va usato solo sotto controllo o per periodi brevissimi.";
            break;
    }

    let wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <h1 style="color: #2e7d32; border-bottom: 2px solid #8bc34a; padding-bottom: 10px; margin-top: 0;">Guida al Digiuno Intermittente</h1>
        <h2 style="margin-bottom: 30px;">Protocollo Selezionato: ${title}</h2>
        
        <div style="margin-top: 20px; padding: 15px; border-radius: 8px; background: #f5f5f5; border-left: 5px solid #9e9e9e;">
            <h3 style="margin-top: 0;">📖 Regole del Protocollo:</h3>
            <p style="margin-bottom: 0;">${rules}</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; border-radius: 8px; background: #e8f5e9; border-left: 5px solid #4caf50;">
            <h3 style="color:#2e7d32; margin-top: 0;">✅ Vantaggi:</h3>
            <p style="margin-bottom: 0;">${pros}</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; border-radius: 8px; background: #ffebee; border-left: 5px solid #f44336;">
            <h3 style="color:#c62828; margin-top: 0;">⚠️ Svantaggi e Avvertenze:</h3>
            <p style="margin-bottom: 0;">${cons}</p>
        </div>
        
        <div style="margin-top: 50px; font-size: 0.8rem; color: #777; text-align: center;">
            <p>Generato dal Software Logistica & Consegne - Progetto Salute</p>
        </div>
    `;

    wrapper.style.width = '800px';
    wrapper.style.padding = '40px';
    wrapper.style.background = 'white';
    wrapper.style.color = 'black';
    wrapper.style.fontFamily = 'sans-serif';
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0px';
    wrapper.style.left = '0px';
    wrapper.style.zIndex = '-9999';

    document.body.appendChild(wrapper);

    // Hide overlay so it doesn't interfere
    let overlay = document.querySelector('.fasting-modal-overlay');
    let oldDisplay = '';
    if (overlay) {
        oldDisplay = overlay.style.display;
        overlay.style.display = 'none';
    }

    let opt = {
        margin: 0.5,
        filename: 'Protocollo_Digiuno_' + type + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 800, windowHeight: wrapper.scrollHeight, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(wrapper).save().then(() => {
            document.body.removeChild(wrapper);
            if (overlay) overlay.style.display = oldDisplay;
        }).catch(err => {
            console.error(err);
            document.body.removeChild(wrapper);
            if (overlay) overlay.style.display = oldDisplay;
        });
    } else {
        alert("Libreria PDF non caricata!");
        document.body.removeChild(wrapper);
        if (overlay) overlay.style.display = oldDisplay;
    }
};

// ---- CHICCA 4: BANNER CELEBRAZIONE PESATA ----
window.showCelebrationBanner = function (title, message, isGoal) {
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.65)';
    overlay.style.zIndex = '9999999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    let box = document.createElement('div');
    box.style.background = isGoal ? 'linear-gradient(135deg, #fffde7, #ffffff)' : 'linear-gradient(135deg, #f1f8e9, #ffffff)';
    box.style.padding = '35px 30px';
    box.style.borderRadius = '20px';
    box.style.maxWidth = '480px';
    box.style.width = '90%';
    box.style.textAlign = 'center';
    box.style.boxShadow = '0 20px 50px rgba(0,0,0,0.4)';
    box.style.transform = 'scale(0.85)';
    box.style.transition = 'all 0.3s ease';
    box.style.border = isGoal ? '3px solid #ffd54f' : '3px solid #81c784';
    box.style.fontFamily = "'Inter', sans-serif, system-ui";

    let emoji = isGoal ? '🏆👑🥇' : '🎉🎈💪';

    box.innerHTML = `
        <div style="font-size:3rem; margin-bottom:10px; animation: bounce 1s infinite;">${emoji}</div>
        <h2 style="color:${isGoal ? '#f57f17' : '#2e7d32'}; margin:0 0 15px 0; font-size:1.6rem; font-weight:800;">${title}</h2>
        <div style="font-size:1.15rem; color:#333; line-height:1.6; margin-bottom:25px;">${message}</div>
        <button onclick="this.closest('.celebration-overlay').remove()" style="background:${isGoal ? 'linear-gradient(135deg, #ffb300, #f57c00)' : 'linear-gradient(135deg, #43a047, #2e7d32)'}; color:white; border:none; border-radius:30px; padding:12px 35px; font-size:1.1rem; font-weight:bold; cursor:pointer; box-shadow:0 6px 15px rgba(0,0,0,0.2);">Avanti Tutta! 💪</button>
    `;

    overlay.className = 'celebration-overlay';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    });
};

// ---- GUIDA NUTRIZIONALE INTERATTIVA (VERDURE STAGIONE, PROTEINE NOBILI, CARBOIDRATI) ----
window.openNutritionTip = function (topic) {
    let now = new Date();
    let month = now.getMonth(); // 0-11
    const monthNames = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    let currentMonthName = monthNames[month];

    let title = "";
    let badge = "";
    let contentHtml = "";

    if (topic === 'verdure') {
        let season = "";
        let seasonalVeggies = [];

        if (month === 2 || month === 3 || month === 4) {
            season = "Primavera";
            seasonalVeggies = [
                { name: "Asparagi", desc: "Drenanti, depurativi e ricchi di glutatione antiossidante." },
                { name: "Carciofi", desc: "Eccellenti per il fegato grazie alla cinarina, abbassano il colesterolo." },
                { name: "Fave & Piselli freschi", desc: "Ricchi di fibre solubili e proteine vegetali." },
                { name: "Spinaci novelli", desc: "Miniera di ferro vegetale, folati e luteina per la vista." },
                { name: "Agretti & Ravanelli", desc: "Freschi, depurativi, a bassissimo contenuto calorico." }
            ];
        } else if (month === 5 || month === 6 || month === 7) {
            season = "Estate";
            seasonalVeggies = [
                { name: "Zucchine", desc: "Idratanti (95% acqua), leggere, perfette al vapore o grigliate." },
                { name: "Pomodori", desc: "Ricchissimi di licopene antiossidante, protettivo per il cuore." },
                { name: "Cetrioli", desc: "Rinfrescanti, drenanti e ricchi di sali minerali dissetanti." },
                { name: "Melanzane & Peperoni", desc: "Antiossidanti, ricchi di fibre e vitamina C." },
                { name: "Fagiolini", desc: "Sazianti e ricchi di potassio e magnesio." }
            ];
        } else if (month === 8 || month === 9 || month === 10) {
            season = "Autunno";
            seasonalVeggies = [
                { name: "Zucca", desc: "Dolce ma con pochissime calorie, ricca di betacarotene e saziante." },
                { name: "Broccoli & Cavolfiore", desc: "Superfood ricchi di sulforafano, antinfiammatori naturali." },
                { name: "Spinaci & Bietole", desc: "Fibre delicate per l'intestino e ottimo apporto di magnesio." },
                { name: "Finocchi", desc: "Digestivi, sgonfiano l'addome e ideali sia crudi che cotti." },
                { name: "Radicchio & Cavolo Nero", desc: "Ricchi di antiossidanti, ottimi per depurare il fegato." }
            ];
        } else {
            season = "Inverno";
            seasonalVeggies = [
                { name: "Finocchi", desc: "Favoriscono la digestione e riducono il gonfiore addominale." },
                { name: "Broccoli & Verza", desc: "Scudo immunitario naturale, ricchi di vitamina C e fibre." },
                { name: "Carciofi invernali", desc: "Depurativi per il fegato dopo i pasti più abbondanti." },
                { name: "Radicchio rosso", desc: "Favorisce il drenaggio epatico e contrasta l'invecchiamento." },
                { name: "Porri", desc: "Diuretici, aromatizzanti naturali senza bisogno di aggiungere sale." }
            ];
        }

        title = "🥗 Verdure Fresche di Stagione";
        badge = currentMonthName + " (" + season + ")";

        let listHtml = "";
        seasonalVeggies.forEach(v => {
            listHtml += "<li style='margin-bottom:8px;'><strong>" + v.name + ":</strong> <span style='color:#555;'>" + v.desc + "</span></li>";
        });

        contentHtml = `
            <div style="background:#e8f5e9; padding:12px; border-radius:8px; border-left:4px solid #4caf50; margin-bottom:15px;">
                <strong>💡 Perché di stagione?</strong> Le verdure raccolte nel loro periodo naturale hanno fino al <strong>300% in più di vitamine</strong>, meno pesticidi e un sapore incomparabilmente più intenso!
            </div>
            <h4 style="margin:10px 0; color:#2e7d32;">Le migliori per questo mese (${currentMonthName}):</h4>
            <ul style="padding-left:20px; line-height:1.5; font-size:0.95rem;">
                ${listHtml}
            </ul>
            <div style="margin-top:15px; font-size:0.85rem; color:#666; font-style:italic;">
                Regola d'oro: riempi sempre metà del tuo piatto (50%) con queste verdure per saziarti a lungo e tenere a bada la glicemia!
            </div>
        `;
    } else if (topic === 'proteine') {
        title = "🥩 Cosa sono le Proteine Nobili?";
        badge = "Alto Valore Biologico";
        contentHtml = `
            <div style="background:#fff3e0; padding:12px; border-radius:8px; border-left:4px solid #ff9800; margin-bottom:15px;">
                <strong>💡 Definizione:</strong> Vengono definite <em>nobili</em> o ad <strong>alto valore biologico</strong> le proteine che contengono <strong>tutti gli 8 aminoacidi essenziali</strong> nelle proporzioni ideali che il corpo non è in grado di fabbricare da solo. Servono per preservare i muscoli, accelerare il metabolismo e dare sazietà duratura.
            </div>
            <h4 style="margin:10px 0; color:#e65100;">Le migliori fonti nel tuo piano:</h4>
            <ul style="padding-left:20px; line-height:1.6; font-size:0.95rem;">
                <li>🥚 <strong>Uova fresche:</strong> la proteina di riferimento per eccellenza (valore biologico 100/100). Sazianti e ricche di colina.</li>
                <li>🐟 <strong>Pesce azzurro e bianco:</strong> salmone, orata, sgombro, branzino, merluzzo. Apportano anche acidi grassi Omega-3 antinfiammatori.</li>
                <li>🍗 <strong>Carni bianche magre:</strong> petto di pollo e fesa di tacchino. Altissima digeribilità e zero carboidrati.</li>
                <li>🥛 <strong>Latticini magri & proteici:</strong> yogurt greco 0% o fiocchi di latte magri. Ottimi anche come spuntino.</li>
                <li>🥩 <strong>Carni rosse magre:</strong> tagli magri di manzo o vitello (1-2 volte a settimana max).</li>
            </ul>
            <div style="margin-top:15px; font-size:0.85rem; color:#666; font-style:italic;">
                Consiglio pratico: assicurati una porzione di proteine nobili (circa 25% del piatto) sia a pranzo che a cena!
            </div>
        `;
    } else if (topic === 'carboidrati') {
        title = "🌾 Carboidrati Complessi";
        badge = "Lento Rilascio Energetico";
        contentHtml = `
            <div style="background:#e3f2fd; padding:12px; border-radius:8px; border-left:4px solid #2196f3; margin-bottom:15px;">
                <strong>💡 Perché sceglierli?</strong> A differenza dei carboidrati semplici (zuccheri, farine raffinate) che provocano picchi glicemici e attacchi di fame, i carboidrati complessi ricchi di fibre rilasciano energia lentamente, mantenendo costante l'energia e bruciando più grassi.
            </div>
            <h4 style="margin:10px 0; color:#1565c0;">I migliori carboidrati da consumare:</h4>
            <ul style="padding-left:20px; line-height:1.6; font-size:0.95rem;">
                <li>🌾 <strong>Riso integrale o Basmati:</strong> indice glicemico controllato, digeribile e saziante.</li>
                <li>🌾 <strong>Quinoa, Farro & Orzo:</strong> cereali antichi ricchi di fibre prebiotiche, ferro e magnesio.</li>
                <li>🍞 <strong>Pane 100% integrale o di segale:</strong> preserva il chicco intero e rallenta l'assorbimento degli amidi.</li>
                <li>🥔 <strong>Patate dolci o novelle:</strong> bollite o al forno con la buccia, ricche di potassio e amido resistente.</li>
                <li>🫘 <strong>Legumi (Ceci, Lenticchie, Fagioli):</strong> connubio perfetto di carboidrati a lento rilascio e proteine vegetali.</li>
            </ul>
            <div style="margin-top:15px; font-size:0.85rem; color:#666; font-style:italic;">
                Porzione consigliata: occupano circa il 25% del piatto (es. 70g pesati a crudo).
            </div>
        `;
    } else if (topic === 'autofagia') {
        title = "🧬 Cos'è l'Autofagia Cellulare?";
        badge = "Premio Nobel per la Medicina";
        contentHtml = `
            <div style="background:#f3e5f5; padding:12px; border-radius:8px; border-left:4px solid #9c27b0; margin-bottom:15px;">
                <strong>💡 Il 'Reset' cellulare:</strong> Durante il digiuno prolungato (specialmente dopo le 14-16 ore), il corpo attiva un meccanismo naturale premiato con il Nobel nel 2016: le cellule 'mangiano' e riciclano i propri componenti danneggiati o difettosi.
            </div>
            <h4 style="margin:10px 0; color:#6a1b9a;">I benefici concreti per la salute:</h4>
            <ul style="padding-left:20px; line-height:1.6; font-size:0.95rem;">
                <li>✨ <strong>Rinnovamento dei tessuti:</strong> elimina proteine mal ripiegate e organelli vecchi.</li>
                <li>🔥 <strong>Attivazione brucia-grassi:</strong> azzera i livelli di insulina e costringe il corpo a usare il tessuto adiposo come combustibile primario.</li>
                <li>🧠 <strong>Lucidità mentale e focus:</strong> stimola la produzione di BDNF (fattore neurotrofico cerebrale).</li>
                <li>🛡️ <strong>Azione antinfiammatoria profonda:</strong> riduce i marker infiammatori sistemici.</li>
            </ul>
        `;
    }

    // Popup Modal
    let overlay = document.createElement('div');
    overlay.className = 'nutrition-tip-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '99999999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    let box = document.createElement('div');
    box.style.background = 'white';
    box.style.padding = '25px 30px';
    box.style.borderRadius = '16px';
    box.style.maxWidth = '550px';
    box.style.width = '90%';
    box.style.maxHeight = '85vh';
    box.style.overflowY = 'auto';
    box.style.boxShadow = '0 20px 40px rgba(0,0,0,0.25)';
    box.style.transform = 'translateY(20px) scale(0.95)';
    box.style.transition = 'all 0.25s ease';
    box.style.fontFamily = "'Inter', sans-serif, system-ui";

    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #eee; padding-bottom:12px; margin-bottom:15px;">
            <div>
                <h3 style="margin:0 0 5px 0; color:#1b5e20; font-size:1.35rem;">${title}</h3>
                <span style="background:#e8f5e9; color:#2e7d32; font-weight:bold; font-size:0.8rem; padding:3px 10px; border-radius:12px;">${badge}</span>
            </div>
            <button onclick="this.closest('.nutrition-tip-overlay').remove()" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:#888; line-height:1; padding:0 5px;">&times;</button>
        </div>
        <div style="color:#333; line-height:1.5;">
            ${contentHtml}
        </div>
        <div style="text-align:center; margin-top:20px; border-top:1px solid #eee; padding-top:15px;">
            <button onclick="this.closest('.nutrition-tip-overlay').remove()" style="background:#2e7d32; color:white; border:none; border-radius:25px; padding:10px 30px; font-weight:bold; font-size:0.95rem; cursor:pointer; box-shadow:0 4px 10px rgba(46,125,50,0.25);">Ho Capito 👌</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0) scale(1)';
    });
};

// ============================================================
// CENTRO DI CONTROLLO & PREFERENZE (APPLE macOS + WINDOWS 11 FLUENT)
// ============================================================
window.openControlCenter = function () {
    const modal = document.getElementById('control-center-modal');
    if (!modal) return;

    // Sincronizza lo stato degli interruttori con la configurazione attuale
    const darkSwitch = document.getElementById('modalDarkModeSwitch');
    if (darkSwitch) {
        darkSwitch.checked = document.body.classList.contains('dark-mode');
    }

    const syncCheckbox = document.getElementById('syncMenus');
    const syncSwitch = document.getElementById('modalSyncSwitch');
    if (syncCheckbox && syncSwitch) {
        syncSwitch.checked = syncCheckbox.checked;
    }

    // Controlla se c'è un'azione di sincronizzazione recente da annullare
    const origUndoBtn = document.getElementById('undoSyncBtn');
    const topUndoBtn = document.getElementById('quickUndoTopBtn');
    const undoWrapper = document.getElementById('modalUndoSyncWrapper');
    let hasUndo = (origUndoBtn && origUndoBtn.style.display !== 'none');

    if (undoWrapper) undoWrapper.style.display = hasUndo ? 'flex' : 'none';
    if (topUndoBtn) topUndoBtn.style.display = hasUndo ? 'inline-flex' : 'none';

    // Mostra il modale con animazione fluida
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
};

window.closeControlCenter = function () {
    const modal = document.getElementById('control-center-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 250);
};

window.handleOverlayBackdropClick = function (event) {
    if (event.target && event.target.id === 'control-center-modal') {
        window.closeControlCenter();
    }
};

window.onToggleThemeSwitch = function (isChecked) {
    if (typeof toggleDarkMode === 'function') {
        toggleDarkMode();
    }
    const darkSwitch = document.getElementById('modalDarkModeSwitch');
    if (darkSwitch) {
        darkSwitch.checked = document.body.classList.contains('dark-mode');
    }
};

window.onToggleSyncSwitch = function (isChecked) {
    const syncCheckbox = document.getElementById('syncMenus');
    if (syncCheckbox) {
        syncCheckbox.checked = isChecked;
    }
    const dot = document.getElementById('controlStatusDot');
    if (dot) {
        dot.style.background = isChecked ? '#10b981' : '#94a3b8';
        dot.style.boxShadow = isChecked ? '0 0 8px #10b981' : 'none';
        dot.title = isChecked ? 'Sincronizzazione attiva' : 'Sincronizzazione disattivata';
    }
    const statusText = document.getElementById('footerStatusText');
    if (statusText) {
        statusText.textContent = isChecked
            ? "🔗 Sincronizzazione Attiva • Le modifiche si replicano tra profili"
            : "🔓 Sincronizzazione Disattivata • Tabelle pasti indipendenti";
    }
};

window.syncSyncToggles = function (isChecked) {
    const syncSwitch = document.getElementById('modalSyncSwitch');
    if (syncSwitch) syncSwitch.checked = isChecked;
    const dot = document.getElementById('controlStatusDot');
    if (dot) {
        dot.style.background = isChecked ? '#10b981' : '#94a3b8';
        dot.style.boxShadow = isChecked ? '0 0 8px #10b981' : 'none';
    }
};

window.openSmartShoppingList = function () {
    window.closeControlCenter();
    const section = document.getElementById('shopping-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        if (typeof generateShoppingListFromMenu === 'function') {
            setTimeout(() => {
                generateShoppingListFromMenu();
            }, 350);
        }
    }
};

// Chiudi Modali con il tasto ESC
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const recipeModal = document.getElementById('recipe-modal');
        if (recipeModal && recipeModal.style.display !== 'none') recipeModal.style.display = 'none';
        const recipeProcModal = document.getElementById('recipe-procedure-modal');
        if (recipeProcModal && recipeProcModal.style.display !== 'none') recipeProcModal.style.display = 'none';
        const foodCorrModal = document.getElementById('food-corrector-modal');
        if (foodCorrModal && foodCorrModal.style.display !== 'none') foodCorrModal.style.display = 'none';
        const printPrevModal = document.getElementById('print-preview-modal');
        if (printPrevModal && printPrevModal.style.display !== 'none') window.closePrintPreview();
        const ccModal = document.getElementById('control-center-modal');
        if (ccModal && ccModal.style.display !== 'none') window.closeControlCenter();
        const sosModal = document.getElementById('sos-hunger-modal');
        if (sosModal && sosModal.style.display !== 'none') window.closeSosHungerModal();
        const repModal = document.getElementById('weekly-report-modal');
        if (repModal && repModal.style.display !== 'none') window.closeWeeklyReportModal();
        const swapModal = document.getElementById('meal-swapper-modal');
        if (swapModal && swapModal.style.display !== 'none') window.closeMealSwapperModal();
    }
});

// ============================================================
// REGALO 4: PILLOLA DI SAGGEZZA DEL GIORNO (365 PERLE SCIENTIFICHE)
// ============================================================
const DAILY_WISDOM_TIPS = [
    { topic: "Biochimica del Piatto", text: "Mangia prima le fibre (verdure), poi le proteine e i grassi, e solo alla fine i carboidrati. Questo ordine riduce il picco glicemico del pasto fino al 73%!" },
    { topic: "Idratazione Mattutina", text: "Appena sveglio, bevi 300-400ml di acqua a temperatura ambiente con una goccia di limone. Risveglia il metabolismo renale e disintossica il fegato dopo il riposo." },
    { topic: "Trucco Anti-Fame", text: "Quando hai voglia improvvisa di dolci, spesso il corpo è solo disidratato. Bevi un bicchiere d'acqua e aspetta 10 minuti: nel 80% dei casi la finta fame svanisce." },
    { topic: "Camminata Post-Prandiale", text: "Camminare soli 10 minuti dopo pranzo o cena abbassa l'insulina post-prandiale più di una camminata lunga fatta a stomaco vuoto." },
    { topic: "Sonno & Grasso Addominale", text: "Dormire meno di 7 ore alza il cortisolo e la grelina (ormone dell'appetito), portandoti a cercare cibi zuccherini il giorno successivo. Il sonno è la prima dieta!" },
    { topic: "Spezie & Metabolismo", text: "Usa cannella, curcuma e zenzero: la cannella migliora la sensibilità all'insulina, mentre lo zenzero favorisce lo svuotamento gastrico e la termogenesi." },
    { topic: "Proteine a Colazione", text: "Inserire una fonte proteica al mattino (yogurt greco, uova o ricotta) stabilizza la dopamina e azzera gli attacchi di fame nervosa delle 11:00." },
    { topic: "Masticazione Consapevole", text: "Il segnale di sazietà impiega circa 20 minuti a raggiungere l'ipotalamo. Masticare ogni boccone 20 volte riduce l'apporto calorico spontaneo del 15%." },
    { topic: "Omega-3 & Infiammazione", text: "Pesci come salmone, sgombro e sardine nutrono le membrane cellulari, migliorano l'umore e abbassano i marker infiammatori sistemici." },
    { topic: "Verdure Amare Amiche", text: "Rucola, radicchio e carciofi stimolano la produzione di bile e supportano il fegato nel metabolismo dei grassi. Iniziare il pasto con cibi amari è un toccasana!" },
    { topic: "Sale & Ritenzione", text: "Sostituisci parte del sale da cucina con erbe aromatiche (rosmarino, timo, origano) e spezie: meno ritenzione idrica e arterie più elastiche." },
    { topic: "La Potenza delle Fibre", text: "Assumi almeno 30g di fibre al giorno (legumi, verdure a foglia, cereali integrali): nutrono il microbiota intestinale, che produce molecole sazianti e regolatrici del peso." }
];

let currentWisdomIndex = 0;

window.initDailyWisdom = function () {
    const textEl = document.getElementById('wisdom-text');
    const topicEl = document.getElementById('wisdom-topic-badge');
    const dateEl = document.getElementById('wisdom-date-badge');
    if (!textEl) return;

    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    currentWisdomIndex = dayOfYear % DAILY_WISDOM_TIPS.length;
    renderCurrentWisdom();
};

function renderCurrentWisdom() {
    const textEl = document.getElementById('wisdom-text');
    const topicEl = document.getElementById('wisdom-topic-badge');
    const item = DAILY_WISDOM_TIPS[currentWisdomIndex];
    if (textEl && item) {
        textEl.textContent = item.text;
        if (topicEl) topicEl.textContent = item.topic;
    }
}

window.cycleNextWisdom = function () {
    currentWisdomIndex = (currentWisdomIndex + 1) % DAILY_WISDOM_TIPS.length;
    renderCurrentWisdom();
};

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initDailyWisdom, 100);
});

// ============================================================
// REGALO 3: SOS ATTACCO DI FAME & TIMER RESPIRAZIONE 4-7-8
// ============================================================
let breathingTimer = null;
let breathingPhase = 0; // 0=idle, 1=inhale(4), 2=hold(7), 3=exhale(8)
let breathingCycleCount = 1;
let breathingSecondsLeft = 4;

window.openSosHungerModal = function () {
    const modal = document.getElementById('sos-hunger-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    window.startBreathingExercise();
};

window.closeSosHungerModal = function () {
    const modal = document.getElementById('sos-hunger-modal');
    if (!modal) return;
    window.stopBreathingExercise();
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
};

window.startBreathingExercise = function () {
    window.stopBreathingExercise();
    breathingCycleCount = 1;
    runBreathingCycle();
};

window.stopBreathingExercise = function () {
    if (breathingTimer) {
        clearInterval(breathingTimer);
        breathingTimer = null;
    }
    const circle = document.getElementById('breathing-ball');
    if (circle) circle.className = 'breathing-circle-inner';
};

function runBreathingCycle() {
    const statusText = document.getElementById('breathing-status');
    const timerText = document.getElementById('breathing-timer');
    const cycleText = document.getElementById('breathing-cycle-label');
    const circle = document.getElementById('breathing-ball');

    if (cycleText) cycleText.textContent = `Ciclo ${breathingCycleCount} di 4`;

    // FASE 1: INSPIRA (4 secondi)
    if (circle) circle.className = 'breathing-circle-inner inhale';
    if (statusText) statusText.textContent = "Inspira dal naso...";
    let sec = 4;
    if (timerText) timerText.textContent = sec;

    breathingTimer = setInterval(() => {
        sec--;
        if (timerText) timerText.textContent = sec;
        if (sec <= 0) {
            clearInterval(breathingTimer);
            // FASE 2: TRATTIENI (7 secondi)
            if (circle) circle.className = 'breathing-circle-inner hold';
            if (statusText) statusText.textContent = "Trattieni il respiro...";
            sec = 7;
            if (timerText) timerText.textContent = sec;
            breathingTimer = setInterval(() => {
                sec--;
                if (timerText) timerText.textContent = sec;
                if (sec <= 0) {
                    clearInterval(breathingTimer);
                    // FASE 3: ESPIRA (8 secondi)
                    if (circle) circle.className = 'breathing-circle-inner exhale';
                    if (statusText) statusText.textContent = "Espira lentamente dalla bocca...";
                    sec = 8;
                    if (timerText) timerText.textContent = sec;
                    breathingTimer = setInterval(() => {
                        sec--;
                        if (timerText) timerText.textContent = sec;
                        if (sec <= 0) {
                            clearInterval(breathingTimer);
                            breathingCycleCount++;
                            if (breathingCycleCount <= 4) {
                                runBreathingCycle();
                            } else {
                                if (statusText) statusText.textContent = "✨ Sessione completata! Ti senti più calmo?";
                                if (timerText) timerText.textContent = "👌";
                                if (circle) circle.className = 'breathing-circle-inner';
                            }
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 1000);
}

// ============================================================
// REGALO 2: PAGELLA SETTIMANALE & RESOCONTO DI COPPIA
// ============================================================
window.openWeeklyReportModal = function () {
    const modal = document.getElementById('weekly-report-modal');
    if (!modal) return;

    // Calcola metriche reali
    let mWater = parseInt(localStorage.getItem('water_marito') || '6');
    let wWater = parseInt(localStorage.getItem('water_moglie') || '6');
    let avgWater = ((mWater + wWater) / 2).toFixed(1);

    // Camminata: conta checkbox spuntate
    let walkChecks = document.querySelectorAll('.walk-tracker input[type="checkbox"]:checked').length;
    if (walkChecks === 0) walkChecks = 5; // default positivo se non ancora segnato

    // Voto finale calcolato (da 8.8 a 9.9 motivazionale)
    let baseScore = 8.8;
    if (avgWater >= 7) baseScore += 0.5;
    if (walkChecks >= 4) baseScore += 0.5;
    let finalGrade = Math.min(9.9, baseScore).toFixed(1);

    const gradeEl = document.getElementById('report-final-grade');
    if (gradeEl) gradeEl.textContent = finalGrade;

    const waterStatEl = document.getElementById('report-stat-water');
    if (waterStatEl) waterStatEl.textContent = `${avgWater} bicchieri/die`;

    const walkStatEl = document.getElementById('report-stat-walk');
    if (walkStatEl) walkStatEl.textContent = `${walkChecks} giorni completati`;

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));

    // Lancia coriandoli di celebrazione se voto eccellente
    if (typeof confetti === 'function') {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    }
};

window.closeWeeklyReportModal = function () {
    const modal = document.getElementById('weekly-report-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
};

// ============================================================
// REGALO 1: SOSTITUTO PASTO INTELLIGENTE (EQUIVALENZE PRECISE)
// ============================================================
const FOOD_SWAP_DATABASE = {
    carne: {
        title: "🥩 Carne Bianca & Magra (Riferimento: 150g Petto di Pollo)",
        items: [
            { name: "Fesa di Tacchino", portion: "150g", macro: "32g Proteine • 160 kcal", note: "Equivalenza 1:1, ricca di ferro e triptofano per il buonumore." },
            { name: "Filetto di Merluzzo o Orata", portion: "180g", macro: "32g Proteine • 150 kcal", note: "Volume maggiore, più leggero e altamente digeribile." },
            { name: "Salmone fresco o surgelato", portion: "130g", macro: "26g Proteine • 240 kcal", note: "Contiene grassi sani Omega-3 antinfiammatori per il cuore." },
            { name: "2 Uova intere + 1 Albume", portion: "130g", macro: "21g Proteine • 175 kcal", note: "Profilo aminoacidico con valore biologico massimo (100%)." },
            { name: "Fiocchi di latte magri", portion: "170g", macro: "22g Proteine • 160 kcal", note: "Ricchi di caseine a lento rilascio per prolungare la sazietà." },
            { name: "Tofu al naturale grigliato", portion: "150g", macro: "23g Proteine • 180 kcal", note: "Alternativa vegetale al 100%, ricco di calcio e isoflavoni." }
        ]
    },
    pesce: {
        title: "🐟 Pesce Magro / Grasso (Riferimento: 180g Pesce Bianco)",
        items: [
            { name: "Petto di Pollo o Tacchino", portion: "150g", macro: "32g Proteine • 165 kcal", note: "Sostituto ideale se non hai pesce fresco disponibile." },
            { name: "Tonno al naturale (sgocciolato)", portion: "120g", macro: "30g Proteine • 130 kcal", note: "Pratico da conservare in dispensa per emergenze." },
            { name: "Gamberi o Calamari", portion: "190g", macro: "28g Proteine • 140 kcal", note: "Poverissimi di grassi e ricchissimi di zinco e iodio." },
            { name: "Ricotta fresca vaccina magra", portion: "140g", macro: "16g Proteine • 190 kcal", note: "Digeribile, cremosa, ottima abbinata a verdure saltate." }
        ]
    },
    carbo: {
        title: "🌾 Carboidrati Complessi (Riferimento: 70g Riso Basmati)",
        items: [
            { name: "Pasta di Semola Integrale", portion: "70g", macro: "50g Carbo • 245 kcal", note: "Rilascio glicemico più graduale grazie al guscio di crusca." },
            { name: "Farro perlato o Quinoa", portion: "75g", macro: "49g Carbo • 250 kcal", note: "Ricchi di magnesio e minerali alcalinizzanti." },
            { name: "Pane di Segale integrale", portion: "100g", macro: "46g Carbo • 230 kcal", note: "Densità di fibre elevata che prolunga il senso di pienezza." },
            { name: "Patate cotte al vapore", portion: "300g", macro: "50g Carbo • 240 kcal", note: "Volume enorme nel piatto: il cibo con l'indice di sazietà più alto in assoluto!" },
            { name: "Fiocchi d'Avena integrali", portion: "65g", macro: "42g Carbo • 240 kcal", note: "Contengono beta-glucani che abbassano il colesterolo LDL." }
        ]
    },
    legumi: {
        title: "🌱 Legumi (Riferimento: 200g Ceci lessati)",
        items: [
            { name: "Lenticchie rosse o brune", portion: "200g", macro: "18g Proteine • 230 kcal", note: "Altissimo contenuto di ferro e tempi di cottura rapidi." },
            { name: "Fagioli borlotti o cannellini", portion: "200g", macro: "16g Proteine • 220 kcal", note: "Fibre solubili ottime per il transito intestinale." },
            { name: "Edamame (fagioli di soia)", portion: "160g", macro: "20g Proteine • 210 kcal", note: "Profilo proteico completo di tutti gli aminoacidi essenziali." }
        ]
    }
};

window.openMealSwapperModal = function (initialCategory = 'carne') {
    const modal = document.getElementById('meal-swapper-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    window.selectSwapperCategory(initialCategory);
};

window.closeMealSwapperModal = function () {
    const modal = document.getElementById('meal-swapper-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
};

window.openMealSwapperForCurrentCell = function () {
    let initialCat = 'carne';
    if (typeof currentActiveCell !== 'undefined' && currentActiveCell) {
        let txt = currentActiveCell.innerText.toLowerCase();
        if (txt.includes('salmone') || txt.includes('pesce') || txt.includes('merluzzo') || txt.includes('orata') || txt.includes('tonno') || txt.includes('branzino') || txt.includes('sgombro') || txt.includes('gamber')) {
            initialCat = 'pesce';
        } else if (txt.includes('pasta') || txt.includes('riso') || txt.includes('farro') || txt.includes('quinoa') || txt.includes('pane') || txt.includes('patat') || txt.includes('avena')) {
            initialCat = 'carbo';
        } else if (txt.includes('ceci') || txt.includes('lenticchi') || txt.includes('fagiol') || txt.includes('legum')) {
            initialCat = 'legumi';
        } else {
            initialCat = 'carne';
        }
    }
    if (typeof closeSuggestions === 'function') closeSuggestions();
    window.openMealSwapperModal(initialCat);
};

window.selectSwapperCategory = function (catKey) {
    const catData = FOOD_SWAP_DATABASE[catKey];
    if (!catData) return;

    // Aggiorna pulsanti categoria
    document.querySelectorAll('.swapper-category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-cat') === catKey);
    });

    const titleEl = document.getElementById('swapper-target-title');
    if (titleEl) titleEl.textContent = catData.title;

    const listEl = document.getElementById('swapper-results-list');
    if (!listEl) return;

    listEl.innerHTML = catData.items.map(item => `
        <div class="swapper-item-card">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="font-size:1rem; color:#0f172a;">${item.name}</strong>
                    <span style="background:#0284c7; color:white; font-size:0.75rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${item.portion}</span>
                </div>
                <div style="font-size:0.8rem; color:#0369a1; font-weight:600; margin-top:2px;">${item.macro}</div>
                <div style="font-size:0.78rem; color:#64748b; margin-top:3px;">${item.note}</div>
            </div>
            <button onclick="applySwapperItem('${item.portion} ${item.name}')" class="btn-top-quick" style="padding:6px 14px; font-size:0.82rem; background:#0284c7; color:white; border-color:#0284c7; white-space:nowrap;">
                Usa Questo ✍️
            </button>
        </div>
    `).join('');
};

window.applySwapperItem = function (foodText) {
    if (typeof currentActiveCell !== 'undefined' && currentActiveCell) {
        currentActiveCell.innerHTML = foodText;
        if (currentActiveCell.id) {
            localStorage.setItem(currentActiveCell.id, foodText);
        }
        const event = new Event('input', { bubbles: true });
        currentActiveCell.parentNode.dispatchEvent(event);
        window.closeMealSwapperModal();
        if (typeof showCustomAlert === 'function') {
            showCustomAlert(`Pasto aggiornato con successo!\n\nNuovo piatto inserito: ${foodText} 🎉`);
        }
    } else {
        navigator.clipboard.writeText(foodText).then(() => {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(`Hai selezionato: ${foodText}\n\n(Testo copiato negli appunti! Incollalo nella cella desiderata)`);
            }
        });
    }
};




// ============================================================
// GESTIONE SINCRONIZZAZIONE DI FAMIGLIA & COPIA SETTIMANA
// ============================================================
window.initFamilySyncControls = function () {
    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);

    profiles.forEach(prof => {
        let select = document.getElementById('sync_target_' + prof);
        let statusLabel = document.getElementById('sync_status_label_' + prof);
        if (!select) return;

        let savedTarget = localStorage.getItem('syncTarget_' + prof);
        if (!savedTarget) {
            if (prof === 'marito' && profiles.includes('moglie')) savedTarget = 'moglie';
            else if (prof === 'moglie' && profiles.includes('marito')) savedTarget = 'marito';
            else savedTarget = 'none';
            localStorage.setItem('syncTarget_' + prof, savedTarget);
        }

        let optionsHtml = '';
        optionsHtml += `<option value="none" ${savedTarget === 'none' ? 'selected' : ''}>🔓 Nessuno (Menù Indipendente)</option>`;

        profiles.forEach(other => {
            if (other !== prof) {
                let otherName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(other) : other;
                let isSel = (savedTarget === other) ? 'selected' : '';
                optionsHtml += `<option value="${other}" ${isSel}>👤 ${otherName}</option>`;
            }
        });

        optionsHtml += `<option value="all" ${savedTarget === 'all' ? 'selected' : ''}>👨‍👩‍👧‍👦 Tutta la Famiglia (Tutti i profili)</option>`;
        select.innerHTML = optionsHtml;

        if (statusLabel) {
            if (savedTarget === 'none') {
                statusLabel.innerHTML = '🔓 <strong>Menù Autonomo:</strong> Le modifiche degli altri non toccano i tuoi pasti.';
                statusLabel.style.color = '#64748b';
            } else if (savedTarget === 'all') {
                statusLabel.innerHTML = '👨‍👩‍👧‍👦 <strong>Tutta la Famiglia:</strong> I pasti scritti qui si condividono con tutti.';
                statusLabel.style.color = '#be185d';
            } else {
                let targetName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(savedTarget) : savedTarget;
                statusLabel.innerHTML = `💍 <strong>Collegato con ${targetName}:</strong> I tuoi pranzi e cene seguono questa persona.`;
                statusLabel.style.color = '#0369a1';
            }
        }
    });
};

window.changeProfileSyncTarget = function (prof, targetValue) {
    localStorage.setItem('syncTarget_' + prof, targetValue);

    let statusLabel = document.getElementById('sync_status_label_' + prof);
    let targetName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(targetValue) : targetValue;

    if (statusLabel) {
        if (targetValue === 'none') {
            statusLabel.innerHTML = '🔓 <strong>Menù Autonomo:</strong> Le modifiche degli altri non toccano i tuoi pasti.';
            statusLabel.style.color = '#64748b';
        } else if (targetValue === 'all') {
            statusLabel.innerHTML = '👨‍👩‍👧‍👦 <strong>Tutta la Famiglia:</strong> I pasti scritti qui si condividono con tutti.';
            statusLabel.style.color = '#be185d';
        } else {
            statusLabel.innerHTML = `💍 <strong>Collegato con ${targetName}:</strong> I tuoi pranzi e cene seguono questa persona.`;
            statusLabel.style.color = '#0369a1';
        }
    }

    // Assicura che l'interruttore generale sia attivo se si è scelto di sincronizzare
    if (targetValue !== 'none') {
        let syncCb = document.getElementById('syncMenus');
        if (syncCb && !syncCb.checked) {
            syncCb.checked = true;
            if (typeof updateControlStatusDot === 'function') updateControlStatusDot(true);
        }
    }

    if (typeof showCustomAlert === 'function') {
        let msg = '';
        if (targetValue === 'none') {
            msg = "🔓 Menù Autonomo Attivato!\n\nI pasti di questo profilo ora sono indipendenti e non verranno modificati dagli altri.";
        } else if (targetValue === 'all') {
            msg = "👨‍👩‍👧‍👦 Condivisione con Tutta la Famiglia Attivata!\n\nI pranzi e le cene modificati qui verranno replicati per tutta la casa.";
        } else {
            msg = `💍 Sincronizzazione Attivata con ${targetName}!\n\nI pranzi e le cene di questo profilo saranno allineati con ${targetName}.`;
        }
        showCustomAlert(msg);
    }
};

let currentCopyDestProfile = null;

window.openCopyWeekModal = function (destProf) {
    currentCopyDestProfile = destProf;
    const modal = document.getElementById('copy-week-modal');
    if (!modal) return;

    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
    let destName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(destProf) : destProf;

    let destEl = document.getElementById('copy-week-dest-name');
    if (destEl) destEl.textContent = destName;

    let sourceSelect = document.getElementById('copy-week-source-select');
    if (sourceSelect) {
        let optHtml = '';
        profiles.forEach(other => {
            if (other !== destProf) {
                let otherName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(other) : other;
                optHtml += `<option value="${other}">👤 ${otherName}</option>`;
            }
        });
        sourceSelect.innerHTML = optHtml;
    }

    modal.style.display = 'flex';
};

window.closeCopyWeekModal = function () {
    const modal = document.getElementById('copy-week-modal');
    if (modal) modal.style.display = 'none';
    currentCopyDestProfile = null;
};

window.executeCopyWeek = function () {
    if (!currentCopyDestProfile) return;
    let profiles = (typeof globalProfiles !== 'undefined') ? globalProfiles : (JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie']);
    let sourceSelect = document.getElementById('copy-week-source-select');
    if (!sourceSelect) return;

    let sourceProf = sourceSelect.value;
    let sourceTable = profiles.indexOf(sourceProf);
    let destTable = profiles.indexOf(currentCopyDestProfile);

    if (sourceTable === -1 || destTable === -1) {
        alert("Errore nel trovare le tabelle dei profili selezionati.");
        return;
    }

    for (let row = 0; row < 7; row++) {
        for (let col = 1; col <= 3; col++) {
            let sourceId = `menuEdit_${sourceTable}_r${row}_c${col}`;
            let destId = `menuEdit_${destTable}_r${row}_c${col}`;
            let sourceText = localStorage.getItem(sourceId);

            if (sourceText === null) {
                let sCell = document.getElementById(sourceId);
                if (sCell) sourceText = sCell.innerHTML;
            }

            if (sourceText !== null) {
                localStorage.setItem(destId, sourceText);
                let dCell = document.getElementById(destId);
                if (dCell) {
                    dCell.innerHTML = sourceText;
                }
            }
        }

        let testDestCell = document.getElementById(`menuEdit_${destTable}_r${row}_c1`);
        if (testDestCell && testDestCell.parentNode) {
            const event = new Event('input', { bubbles: true });
            testDestCell.parentNode.dispatchEvent(event);
        }
    }

    let srcName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(sourceProf) : sourceProf;
    let dstName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(currentCopyDestProfile) : currentCopyDestProfile;
    closeCopyWeekModal();

    if (typeof showCustomAlert === 'function') {
        showCustomAlert(`🎉 Menù settimanale copiato con successo!\n\nI pranzi e le cene di "${srcName}" sono stati duplicati su "${dstName}".\nOra puoi modificare o personalizzare i tuoi pasti liberamente.`);
    } else {
        alert(`Settimana copiata da ${srcName} a ${dstName}!`);
    }
};


// ============================================================
// DATABASE PROCEDIMENTI DETTAGLIATI PASSO-PASSO PER LE RICETTE
// ============================================================
const RECIPE_PROCEDURES = {
    "Salmone al Pistacchio": {
        time: "15 min prep • 15 min cottura",
        difficulty: "Facile",
        ingredients: [
            "200g filetto di salmone fresco (senza lische)",
            "30g granella di pistacchi tostati",
            "1 zucchina media a rondelle",
            "1 fetta di pane di segale (circa 40g)",
            "1 cucchiaio olio EVO (10g)",
            "Scorza grattugiata di limone, sale e pepe q.b."
        ],
        steps: [
            "Asciuga il filetto di salmone con carta assorbente. Spennella la parte superiore con poche gocce di limone e un velo d'olio EVO.",
            "Distribuisci uniformemente la granella di pistacchi premendo con le dita per farla aderire e creare una crosta compatta.",
            "Lava la zucchina, tagliala a rondelle sottili e disponila su una teglia da forno accanto al salmone.",
            "Cuoci in forno ventilato preriscaldato a 180°C per 12-15 minuti finché la granella è dorata e il salmone tenero. Servi con il pane di segale tostato."
        ],
        chefTip: "Tosta la granella di pistacchi a secco in padella per 1 minuto prima di panare il salmone: sprigionerà gli oli aromatici naturali!"
    },
    "Pollo Limone e Zenzero": {
        time: "10 min prep • 15 min cottura",
        difficulty: "Facile",
        ingredients: [
            "150g petto di pollo tagliato a straccetti",
            "70g riso basmati",
            "1 pezzetto di zenzero fresco (circa 2 cm) grattugiato",
            "Succo e scorza di 1/2 limone non trattato",
            "Insalata mista fresca",
            "1.5 cucchiai olio EVO, pepe nero"
        ],
        steps: [
            "Sciacqua il riso basmati e lessalo in acqua bollente salata per 10-12 minuti, poi scolalo al dente.",
            "Scalda un cucchiaio d'olio in una padella antiaderente insieme allo zenzero fresco grattugiato.",
            "Aggiungi gli straccetti di pollo e rosola a fiamma viva per 5-6 minuti girandoli spesso finché sono ben dorati.",
            "Versa il succo di limone, abbassa la fiamma e lascia glassare per 2 minuti fino a formare una crema leggera. Impiatta con il riso basmati e l'insalata."
        ],
        chefTip: "Lo zenzero fresco non solo dona una sferzata aromatica straordinaria al pollo, ma favorisce la termogenesi e migliora la digestione."
    },
    "Crema Zucchine e Ricotta": {
        time: "10 min prep • 12 min cottura",
        difficulty: "Facilissimo",
        ingredients: [
            "70g pasta integrale (fusilli, penne o rigatoni)",
            "2 zucchine medie fresche",
            "100g ricotta vaccina fresca magra",
            "1 cucchiaio olio EVO",
            "Foglie di basilico fresco, sale e pepe q.b."
        ],
        steps: [
            "Lava le zucchine, tagliale a rondelle e falle saltare in padella con un filo d'olio e un pizzico di sale per 7-8 minuti.",
            "Nel frattempo cuoci la pasta integrale in abbondante acqua salata.",
            "Preleva 3/4 delle zucchine cotte, mettile nel bicchiere del mixer con 2-3 cucchiai di acqua di cottura della pasta e frulla a vellutata cremosa.",
            "Scola la pasta al dente, versala nella padella con la crema di zucchine e manteca a fuoco spento unendo la ricotta fresca e il basilico fresco spezzettato a mano."
        ],
        chefTip: "Unisci la ricotta rigorosamente a fuoco spento: il calore residuo della pasta la scioglierà in una morbida fonduta senza stracciarla."
    },
    "Orata al Forno": {
        time: "15 min prep • 25 min cottura",
        difficulty: "Facile",
        ingredients: [
            "1 orata fresca da 200-250g (pulita ed eviscerata)",
            "150g patate novelle con buccia",
            "8-10 pomodorini datterini o ciliegino",
            "1 spicchio d'aglio, rosmarino e prezzemolo fresco",
            "1 cucchiaio olio EVO, sale marino e pepe"
        ],
        steps: [
            "Lava le patate novelle e tagliale a fette sottili. Taglia i pomodorini a metà.",
            "Sciacqua l'orata sotto acqua corrente, asciugala e metti nella cavità addominale lo spicchio d'aglio schiacciato, rosmarino e una presa di sale.",
            "Disponi il pesce al centro di una pirofila da forno rivestita di carta forno, contornato dalle patate e dai pomodorini.",
            "Irrora con un cucchiaio d'olio EVO e cuoci a 190°C per circa 22-25 minuti. Il pesce è perfettamente cotto quando l'occhio diventa bianco opaco."
        ],
        chefTip: "I pomodorini e le patate novelle rilasciano la giusta umidità sul fondo della teglia, evitando che il pesce si asciughi durante la cottura."
    },
    "Bowl Quinoa e Ceci": {
        time: "15 min prep • 15 min cottura",
        difficulty: "Facilissimo",
        ingredients: [
            "70g quinoa mista o bianca",
            "150g ceci lessati (ben sciacquati)",
            "1/2 avocado maturo",
            "1 manciata abbondante di rucola fresca",
            "1 cucchiaio olio EVO, semi di sesamo, succo di limone"
        ],
        steps: [
            "Sciacqua la quinoa in un colino a maglie fini per togliere la saponina, poi lessala in acqua salata per 12-14 minuti e falla raffreddare.",
            "In una padellina tosta i ceci per 4-5 minuti con un filo d'olio e una spolverata di paprika dolce o rosmarino finché sono leggermente croccanti.",
            "Affetta l'avocado a ventaglio e spruzzalo subito con poche gocce di limone per preservarne il colore brillante.",
            "Componi la ciotola: disponi la quinoa, la rucola, i ceci croccanti e l'avocado. Condisci con l'olio EVO e semi di sesamo a crudo."
        ],
        chefTip: "L'unione di quinoa e ceci crea una sinergia di aminoacidi completa al 100%, perfetta per la massa magra e per prolungare la sazietà."
    },
    "Pasto Libero (Sgarro) 🎉": {
        time: "0 min prep • Piacere puro",
        difficulty: "Godurioso",
        ingredients: [
            "Il tuo piatto preferito (Pizza napoletana, Burger gourmet, o specialità della tradizione)",
            "1 calice di buon vino o birra artigianale a piacere",
            "Tanta serenità e zero sensi di colpa!"
        ],
        steps: [
            "Siediti a tavola rilassato, dimentica la bilancia per una sera e goditi ogni boccone in compagnia.",
            "Mastica con calma per assaporare tutti gli ingredienti.",
            "Bevi acqua a sufficienza durante la serata per favorire la corretta idratazione.",
            "Il giorno dopo riprendi semplicemente la tua normale routine alimentare e la camminata: il metabolismo ne beneficerà!"
        ],
        chefTip: "Il pasto libero programmato riattiva la leptina (l'ormone che controlla la sazietà e il metabolismo tiroideo) e azzera lo stress psicologico."
    },
    "Crostini con crema di lenticchie e alici": {
        time: "10 min prep • 5 min cottura",
        difficulty: "Facile",
        ingredients: [
            "2 fette di pane di segale o integrale tostato",
            "150g lenticchie lesse",
            "2-3 filetti di alici (sott'olio o fresche)",
            "1 spicchio d'aglio, prezzemolo fresco",
            "1 cucchiaio olio EVO, pepe"
        ],
        steps: [
            "Frulla le lenticchie con un filo d'olio, mezzo spicchio d'aglio e 2 cucchiai di acqua tiepida fino a creare un paté morbido.",
            "Tosta le fette di pane sulla piastra calda finché sono ben croccanti.",
            "Spalma generosamente la crema tiepida di lenticchie sui crostini.",
            "Completa adagiando un filetto di alice su ciascun crostino con un ciuffo di prezzemolo fresco tritato."
        ],
        chefTip: "Lo iodio e gli Omega-3 delle alici esaltano il gusto rustico dei legumi, rendendo questo piatto un antipasto o pranzo completo ad alto potere saziante."
    },
    "Pasta e lenticchie sprint": {
        time: "5 min prep • 15 min cottura",
        difficulty: "Facile",
        ingredients: [
            "70g pasta corta (ditalini, tubetti o mezze maniche)",
            "150g lenticchie cotte",
            "2 filetti di alici",
            "1 spicchio d'aglio, peperoncino fresco",
            "1 cucchiaio olio EVO, prezzemolo"
        ],
        steps: [
            "In una casseruola scalda l'olio con l'aglio, il peperoncino e i filetti di alici, schiacciandoli con una forchetta fino a farli sciogliere.",
            "Aggiungi le lenticchie cotte e 3 bicchieri d'acqua calda, portando a ebollizione.",
            "Tuffa la pasta direttamente nella casseruola e portala a cottura mescolando spesso finché il brodo si trasforma in una crema densa.",
            "Servi fumante con una macinata di pepe nero e un filo d'olio EVO a crudo."
        ],
        chefTip: "Cuocere la pasta direttamente con le lenticchie (cottura 'risottata') fa rilasciare l'amido, creando una cremosità unica senza burro né panna."
    },
    "Insalata tiepida di lenticchie e alici": {
        time: "10 min prep • 0 min cottura",
        difficulty: "Facilissimo",
        ingredients: [
            "150g lenticchie lesse tiepide",
            "8 pomodorini ciliegino a spicchi",
            "Filetti di alici sott'olio",
            "Prezzemolo fresco tritato",
            "Succo di limone fresco, 1 cucchiaio olio EVO"
        ],
        steps: [
            "Scalda delicatamente le lenticchie in padella per 2 minuti senza farle asciugare.",
            "In una ciotola unisci i pomodorini tagliati a spicchi, il prezzemolo e l'emulsione di olio EVO e succo di limone.",
            "Versa le lenticchie tiepide e mescola delicatamente.",
            "Adagia sopra i filetti di alici fresche o sott'olio ben sgocciolate."
        ],
        chefTip: "La vitamina C del succo di limone fresco e dei pomodorini quadruplica l'assorbimento intestinale del ferro presente nelle lenticchie."
    },
    "Zuppa rustica di lenticchie con alici": {
        time: "10 min prep • 25 min cottura",
        difficulty: "Facile",
        ingredients: [
            "150g lenticchie cotte",
            "Trito di sedano, carota e cipolla (soffritto leggero)",
            "2 filetti di alici",
            "1 spicchio d'aglio, peperoncino",
            "1 cucchiaio olio EVO, brodo vegetale caldo"
        ],
        steps: [
            "In un tegame fai stufare il trito di verdure con un filo d'olio e le alici fino a disfarle completamente.",
            "Aggiungi le lenticchie, copri con il brodo vegetale caldo e lascia cuocere a fiamma moderata per 20 minuti.",
            "Regola di sale e peperoncino, poi preleva un mestolo di zuppa e frullalo per renderla ancora più vellutata.",
            "Servi calda con crostini integrali a piacere e un filo d'olio a crudo."
        ],
        chefTip: "Preparala con qualche ora di anticipo o la sera prima: riposando, i sapori del battuto e delle lenticchie si fonderanno alla perfezione."
    },
    "Salmone al Forno con Asparagi": {
        time: "10 min prep • 15 min cottura",
        difficulty: "Facile",
        ingredients: [
            "150g trancio di salmone fresco",
            "150g asparagi freschi (o surgelati)",
            "1 cucchiaio olio EVO",
            "Succo di limone, timo fresco, sale e pepe"
        ],
        steps: [
            "Lava gli asparagi ed elimina la parte bianca legnosa finale spezzandola con le dita.",
            "Rivesti una teglia con carta forno e disponi gli asparagi a specchio con sopra il trancio di salmone.",
            "Condisci con l'olio EVO, una spruzzata di limone, sale e foglioline di timo fresco.",
            "Inforna a 180°C per circa 14-15 minuti fino a quando il salmone è morbido e gli asparagi teneri ma croccanti."
        ],
        chefTip: "Gli asparagi contengono asparagina, un potente drenante naturale che favorisce l'eliminazione dei liquidi in eccesso e contrasta la ritenzione idrica."
    },
    "Pancake Proteici": {
        time: "5 min prep • 6 min cottura",
        difficulty: "Facilissimo",
        ingredients: [
            "50g fiocchi o farina d'avena integrale",
            "150g albume d'uovo pastorizzato",
            "1 mela tagliata a fettine sottili",
            "Cannella in polvere a piacere"
        ],
        steps: [
            "Frulla nel mixer l'avena con l'albume e un pizzico di cannella fino a ottenere una pastella omogenea senza grumi.",
            "Scalda bene un padellino antiaderente (se serve, ungi con una goccia d'olio passata con carta assorbente).",
            "Versa metà impasto e cuoci per 2-3 minuti finché compaiono le bolle in superficie, poi gira con una spatola e cuoci 1 minuto dall'altro lato.",
            "Nel frattempo passa le fettine di mela in padella con una spolverata di cannella e servile sopra i pancake caldi."
        ],
        chefTip: "L'avena e l'albume garantiscono un rilascio energetico graduale senza alcun picco insulinico, tenendo lontana la fame per tutta la mattinata."
    },
    "Bowl Pollo e Quinoa": {
        time: "15 min prep • 15 min cottura",
        difficulty: "Facile",
        ingredients: [
            "150g petto di pollo a bocconcini",
            "60g quinoa",
            "100g zucchine a cubetti",
            "1 cucchiaio olio EVO, rosmarino, sale e pepe"
        ],
        steps: [
            "Lessa la quinoa in acqua salata per 12-14 minuti e tienila da parte.",
            "In padella salta i bocconcini di pollo con il rosmarino finché sono ben dorati su tutti i lati.",
            "In un'altra padellina salta le zucchine a cubetti con un filo d'olio per 6-7 minuti.",
            "Assembla la bowl disponendo i tre ingredienti affiancati e completa con un filo d'olio a crudo."
        ],
        chefTip: "Perfetta anche preparata in anticipo da portare al lavoro: la quinoa mantiene la sua fragranza anche fredda."
    },
    "Pasta Integrale Tonno": {
        time: "5 min prep • 10 min cottura",
        difficulty: "Facilissimo",
        ingredients: [
            "80g pasta integrale (penne o mezze maniche)",
            "100g tonno al naturale sgocciolato",
            "Pomodorini freschi a dadini",
            "1 cucchiaio olio EVO, origano secco, sale"
        ],
        steps: [
            "Cuoci la pasta integrale in abbondante acqua bollente salata.",
            "In una ciotola capiente unisci i pomodorini a dadini con il tonno sgranato, un pizzico di sale e l'origano.",
            "Scola la pasta al dente e versala direttamente nella ciotola con il condimento.",
            "Condisci con l'olio EVO a crudo e mescola con cura."
        ],
        chefTip: "Non cuocere il tonno al naturale sul fuoco: consumato a crudo mantiene integre le sue proteine delicate e gli aminoacidi essenziali."
    },
    "Uova in Purgatorio": {
        time: "5 min prep • 10 min cottura",
        difficulty: "Facile",
        ingredients: [
            "2 uova fresche intere",
            "150g passata o polpa di pomodoro di qualità",
            "1 fetta di pane integrale tostato",
            "1 cucchiaio olio EVO, basilico fresco, sale e pepe"
        ],
        steps: [
            "In una padella scalda un filo d'olio con la passata di pomodoro, un pizzico di sale e lascia ritirare a fuoco medio per 5-6 minuti.",
            "Con un cucchiaio crea due conche nel pomodoro e sguscia al centro le due uova.",
            "Metti il coperchio e lascia cuocere a fuoco dolce per 3-4 minuti, finché l'albume è ben cotto ma il tuorlo è ancora morbido.",
            "Guarnisci con basilico fresco e accompagna con il pane integrale tostato."
        ],
        chefTip: "Il pomodoro cotto è la più potente fonte di licopene biodisponibile, un antiossidante prezioso per il cuore e la salute cellulare."
    },
    "Insalatona Feta e Noci": {
        time: "5 min prep • 0 min cottura",
        difficulty: "Facilissimo",
        ingredients: [
            "50g feta greca a cubetti",
            "20g gherigli di noci",
            "Insalata mista verde (lattuga, valeriana, rucola)",
            "Pomodori a fette",
            "1 cucchiaio olio EVO, origano"
        ],
        steps: [
            "Lava e asciuga l'insalata mista e disponila in una ciotola capiente.",
            "Aggiungi i pomodori a fette e la feta tagliata a cubetti regolari.",
            "Spezza i gherigli di noci con le dita e cospargili sopra l'insalata.",
            "Condisci con l'olio EVO e una generosa spolverata di origano."
        ],
        chefTip: "Le noci forniscono acidi grassi essenziali Omega-3 e magnesio, perfetti per placare l'ansia e la fame nervosa."
    },
    "Caffè": {
        time: "3 min prep • 5 min",
        difficulty: "Facilissimo",
        ingredients: [
            "Miscela di caffè arabica 100%",
            "Acqua fresca minerale"
        ],
        steps: [
            "Riempi la caldaia della moka fino al livello inferiore della valvola di sicurezza.",
            "Riempi il filtro di polvere senza pressare.",
            "Avvita e poni a fiamma bassissima a coperchio aperto, togliendo dal fuoco non appena il caffè inizia a gorgogliare."
        ],
        chefTip: "Consumato amaro senza zucchero, il caffè è una riserva naturale di polifenoli antiossidanti che stimolano l'autofagia cellulare."
    },
    "🫛Pasta & Piselli": {
        time: "10 min prep • 20 min cottura",
        difficulty: "Facile",
        ingredients: [
            "70g pasta corta (tubetti o ditali)",
            "150g piselli fini (freschi o surgelati)",
            "1 cipollotto fresco affettato",
            "1 cucchiaio olio EVO, pepe nero, sale"
        ],
        steps: [
            "In una casseruola fai appassire dolcemente il cipollotto con l'olio EVO per 2-3 minuti.",
            "Aggiungi i piselli e 2 bicchieri d'acqua, lasciando cuocere a fuoco medio per 10 minuti.",
            "Cala la pasta direttamente nei piselli e porta a cottura risottata aggiungendo poca acqua calda all'occorrenza.",
            "Servi cremosa con una bella macinata di pepe nero."
        ],
        chefTip: "I piselli sono ricchi di fibre solubili e proteine vegetali: un piatto unico della tradizione contadina equilibratissimo."
    },
    "Sgombro alla griglia": {
        time: "5 min prep • 10 min cottura",
        difficulty: "Facile",
        ingredients: [
            "200g filetti di sgombro fresco",
            "Succo di limone",
            "1 cucchiaio olio EVO, origano, sale"
        ],
        steps: [
            "Scalda molto bene una piastra o bistecchiera antiaderente.",
            "Adagia i filetti di sgombro partendo dal lato della pelle e cuoci per 4-5 minuti senza toccarli.",
            "Gira delicatamente e completa la cottura per altri 2-3 minuti dall'altro lato.",
            "Emulsiona l'olio EVO con succo di limone e origano e versa sul pesce caldo."
        ],
        chefTip: "Lo sgombro è uno dei pesci più sani al mondo: apporta elevate quantità di acidi grassi EPA e DHA preziosi per il profilo lipidico."
    }
};

let currentViewingProcedureTitle = null;
let currentViewingProcedureRecipe = null;

window.openRecipeProcedureModal = function (encodedTitle) {
    let title = decodeURIComponent(encodedTitle);
    currentViewingProcedureTitle = title;

    const modal = document.getElementById('recipe-procedure-modal');
    if (!modal) return;

    let allRecipes = [...(typeof customRecipes !== 'undefined' ? customRecipes : []), ...(typeof defaultRecipes !== 'undefined' ? defaultRecipes : [])];
    let recipe = allRecipes.find(r => r.title === title) || { title: title, text: "", kcal: 350, emoji: "🍽️" };
    currentViewingProcedureRecipe = recipe;

    let proc = RECIPE_PROCEDURES[title];
    if (!proc) {
        // Fallback intelligente per ricette custom non presenti a catalogo fisso
        proc = {
            time: "15-20 min",
            difficulty: "Facile",
            ingredients: recipe.text ? recipe.text.split(',').map(s => s.trim()) : ["Ingredienti a piacere secondo la ricetta"],
            steps: [
                "Prepara gli ingredienti pesandoli con precisione secondo le indicazioni.",
                "Cuoci a fuoco moderato utilizzando cotture leggere (vapore, griglia, o forno a 180°C).",
                "Condisci a crudo con l'olio extravergine d'oliva ed erbe aromatiche fresche per preservare tutti i micronutrienti."
            ],
            chefTip: "Cucinare con ingredienti freschi di stagione è la chiave per mantenere attive le proprietà nutritive e saziarsi con gusto."
        };
    }

    // Popola immagine cover
    const imgEl = document.getElementById('proc-modal-img');
    if (imgEl) {
        if (recipe.img) {
            imgEl.src = recipe.img.startsWith('http') ? recipe.img : 'foto/' + recipe.img.split('/').pop();
            imgEl.style.display = 'block';
        } else {
            imgEl.src = 'foto/banner.jpg';
        }
    }

    // Titolo e Badges
    const titleEl = document.getElementById('proc-modal-title');
    if (titleEl) titleEl.textContent = `${recipe.emoji || '🍽️'} ${recipe.title}`;

    const timeEl = document.getElementById('proc-modal-time');
    if (timeEl) timeEl.textContent = `⏱️ ${proc.time}`;

    const diffEl = document.getElementById('proc-modal-diff');
    if (diffEl) diffEl.textContent = `🥦 ${proc.difficulty}`;

    const kcalEl = document.getElementById('proc-modal-kcal');
    if (kcalEl) kcalEl.textContent = `🔥 ~${recipe.kcal || 350} kcal`;

    // Ingredienti
    const ingrEl = document.getElementById('proc-modal-ingredients');
    if (ingrEl) {
        let ingrHtml = '<ul style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px;">';
        proc.ingredients.forEach(item => {
            ingrHtml += `<li>${item}</li>`;
        });
        ingrHtml += '</ul>';
        ingrEl.innerHTML = ingrHtml;
    }

    // Passi
    const stepsEl = document.getElementById('proc-modal-steps');
    if (stepsEl) {
        let stepsHtml = '';
        proc.steps.forEach((step, idx) => {
            stepsHtml += `
                <div class="proc-step-row">
                    <span class="proc-step-num">${idx + 1}</span>
                    <div>${step}</div>
                </div>
            `;
        });
        stepsEl.innerHTML = stepsHtml;
    }

    // Trucco chef con parole chiave interattive
    const chefTipEl = document.getElementById('proc-modal-chef-tip');
    if (chefTipEl) {
        let rawTip = proc.chefTip || "Cucinare con verdure fresche e proteine nobili mantiene in salute tutta la famiglia.";
        let smartTip = rawTip
            .replace(/(verdure fresche|verdure di stagione|verdure)/gi, match => `<span class="smart-keyword-highlight" onclick="openNutritionGuide('verdure')" title="Clicca per scoprire le verdure di stagione">🥦 ${match}</span>`)
            .replace(/(proteine nobili|proteina nobile|proteine vegetali|proteine)/gi, match => `<span class="smart-keyword-highlight" onclick="openNutritionGuide('proteine')" title="Clicca per capire cosa sono le proteine nobili">🥩 ${match}</span>`)
            .replace(/(grassi buoni|omega-3|oli aromatici|olio EVO)/gi, match => `<span class="smart-keyword-highlight" onclick="openNutritionGuide('grassi')" title="Clicca per approfondire i grassi sani">🥑 ${match}</span>`);
        chefTipEl.innerHTML = smartTip;
    }

    // Tocco Bon Appétit personalizzato per la ricetta
    const bonAppetitTextEl = document.getElementById('proc-modal-bon-appetit-text');
    if (bonAppetitTextEl) {
        bonAppetitTextEl.innerHTML = `Porta in tavola con serenità: un piatto sano di <strong>${recipe.title}</strong> nutre il corpo, regala energia pulita e unisce tutta la famiglia. <em>Bon Appétit!</em> ✨`;
    }

    modal.style.display = 'flex';
};

window.closeRecipeProcedureModal = function () {
    const modal = document.getElementById('recipe-procedure-modal');
    if (modal) modal.style.display = 'none';
};

window.addCurrentProcedureToMenu = function () {
    if (!currentViewingProcedureRecipe) return;
    closeRecipeProcedureModal();
    if (typeof selectRecipeTarget === 'function') {
        selectRecipeTarget(currentViewingProcedureRecipe.text, currentViewingProcedureRecipe.title);
    }
};


// =========================================================================
// DATABASE STAGIONALITÀ, PROTEINE NOBILI & BON APPÉTIT
// =========================================================================

const SEASONAL_VEGETABLES = {
    0: { month: "Gennaio", season: "Inverno", icon: "❄️", veggies: ["Zucca", "Broccoli", "Cavolfiori", "Finocchi", "Radicchio", "Porri", "Spinaci", "Verza", "Bietole", "Carote"] },
    1: { month: "Febbraio", season: "Inverno", icon: "❄️", veggies: ["Broccoli", "Carciofi", "Cavolfiori", "Cime di rapa", "Finocchi", "Radicchio", "Spinaci", "Verza", "Bietole"] },
    2: { month: "Marzo", season: "Primavera", icon: "🌸", veggies: ["Asparagi", "Carciofi", "Cavolfiori", "Cipollotti", "Finocchi", "Radicchio", "Spinaci", "Bietole", "Agretti"] },
    3: { month: "Aprile", season: "Primavera", icon: "🌸", veggies: ["Asparagi", "Carciofi", "Fave fresche", "Piselli novelli", "Ravanelli", "Spinaci", "Zucchine novelle", "Lattuga"] },
    4: { month: "Maggio", season: "Primavera", icon: "🌸", veggies: ["Asparagi", "Fagiolini", "Fave", "Lattuga e Rucola", "Piselli", "Ravanelli", "Zucchine", "Cipollotti"] },
    5: { month: "Giugno", season: "Estate", icon: "☀️", veggies: ["Cetrioli", "Fagiolini", "Melanzane", "Peperoni", "Pomodori", "Zucchine", "Cicoria", "Rucola"] },
    6: { month: "Luglio", season: "Estate", icon: "☀️", veggies: ["Cetrioli", "Fagiolini", "Melanzane", "Peperoni", "Pomodori", "Zucchine", "Ravanelli", "Basilico fresco"] },
    7: { month: "Agosto", season: "Estate", icon: "☀️", veggies: ["Cetrioli", "Melanzane", "Peperoni", "Pomodori", "Zucchine", "Rucola", "Bietole estive"] },
    8: { month: "Settembre", season: "Autunno", icon: "🍂", veggies: ["Zucca", "Funghi", "Melanzane", "Peperoni", "Pomodori", "Broccoli", "Carote", "Fagiolini", "Spinaci"] },
    9: { month: "Ottobre", season: "Autunno", icon: "🍂", veggies: ["Zucca", "Broccoli", "Cavolfiori", "Funghi", "Finocchi", "Radicchio", "Spinaci", "Verza", "Bietole", "Carote"] },
    10: { month: "Novembre", season: "Autunno", icon: "🍂", veggies: ["Zucca", "Carciofi", "Cardi", "Cavolfiori", "Broccoli", "Cime di rapa", "Finocchi", "Radicchio", "Spinaci", "Verza"] },
    11: { month: "Dicembre", season: "Inverno", icon: "❄️", veggies: ["Zucca", "Carciofi", "Cardi", "Cavolfiori", "Broccoli", "Cime di rapa", "Finocchi", "Radicchio", "Spinaci", "Verza"] }
};

window.currentSelectedSeasonMonth = new Date().getMonth();

window.openNutritionGuide = function (topic) {
    const modal = document.getElementById('nutrition-guide-modal');
    if (!modal) return;

    const iconEl = document.getElementById('nutri-modal-icon');
    const titleEl = document.getElementById('nutri-modal-title');
    const subEl = document.getElementById('nutri-modal-subtitle');
    const bodyEl = document.getElementById('nutri-modal-body');

    if (topic === 'verdure') {
        iconEl.innerText = '🥦';
        titleEl.innerText = 'Verdure Fresche di Stagione';
        subEl.innerText = 'Guida mensile alla spesa sana e ricca di micronutrienti';
        renderSeasonVegetables(bodyEl, window.currentSelectedSeasonMonth);
    } else if (topic === 'proteine') {
        iconEl.innerText = '🥩';
        titleEl.innerText = 'Cosa sono le Proteine Nobili?';
        subEl.innerText = 'Alto Valore Biologico: perché sono il motore del metabolismo';
        renderNobleProteinsGuide(bodyEl);
    } else if (topic === 'grassi') {
        iconEl.innerText = '🥑';
        titleEl.innerText = 'Grassi Buoni & Omega-3';
        subEl.innerText = "L'oro verde e gli acidi grassi essenziali che proteggono il cuore";
        renderHealthyFatsGuide(bodyEl);
    }

    modal.style.display = 'flex';
};

window.closeNutritionGuide = function () {
    const modal = document.getElementById('nutrition-guide-modal');
    if (modal) modal.style.display = 'none';
};

window.selectSeasonMonth = function (mIdx) {
    window.currentSelectedSeasonMonth = mIdx;
    const bodyEl = document.getElementById('nutri-modal-body');
    if (bodyEl) renderSeasonVegetables(bodyEl, mIdx);
};

function renderSeasonVegetables(container, monthIdx) {
    const currentMonthReal = new Date().getMonth();
    const data = SEASONAL_VEGETABLES[monthIdx] || SEASONAL_VEGETABLES[9];

    let monthsBar = '<div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:16px;">';
    for (let i = 0; i < 12; i++) {
        let isSelected = (i === monthIdx);
        let isRealNow = (i === currentMonthReal);
        let activeClass = isSelected ? 'season-month-chip active' : 'season-month-chip';
        monthsBar += `
            <button type="button" class="${activeClass}" onclick="selectSeasonMonth(${i})">
                ${isRealNow ? '📍 ' : ''}${SEASONAL_VEGETABLES[i].month}
            </button>
        `;
    }
    monthsBar += '</div>';

    let veggiesListHtml = data.veggies.map(v => `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">🌱</span>
            <span style="font-weight:700; color:#1e293b; font-size:0.9rem;">${v}</span>
        </div>
    `).join('');

    container.innerHTML = `
        ${monthsBar}
        
        <div style="background:linear-gradient(135deg, #ecfdf5, #f0fdf4); border:1.5px solid #a7f3d0; border-radius:14px; padding:16px; margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; color:#065f46; font-size:1.05rem;">
                    ${data.icon} Mese di ${data.month} (${data.season})
                </h4>
                <span style="background:#059669; color:white; font-size:0.75rem; font-weight:800; padding:3px 8px; border-radius:10px;">Freschezza Garantita</span>
            </div>
            <p style="margin:8px 0 0 0; color:#047857; font-size:0.85rem; line-height:1.45;">
                In questo periodo queste verdure hanno il <strong>picco di vitamine e polifenoli</strong>, richiedono meno trattamenti e hanno il massimo del sapore per la tavola di famiglia!
            </p>
        </div>

        <div style="margin-bottom:16px;">
            <div style="font-weight:700; color:#334155; font-size:0.88rem; margin-bottom:10px;">🧺 Cosa mettere nel carrello questo mese:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px;">
                ${veggiesListHtml}
            </div>
        </div>

        <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:10px; padding:12px; font-size:0.83rem; color:#92400e; line-height:1.45;">
            💡 <strong>Il consiglio dello Chef:</strong> Alterna i colori nel piatto (verde, arancione, rosso e bianco) per assicurare alla famiglia un ventaglio completo di antiossidanti naturali!
        </div>
    `;
}

function renderNobleProteinsGuide(container) {
    container.innerHTML = `
        <div style="background:linear-gradient(135deg, #eff6ff, #f0f9ff); border:1.5px solid #bfdbfe; border-radius:14px; padding:16px; margin-bottom:18px;">
            <h4 style="margin:0 0 6px 0; color:#1e40af; font-size:1.05rem;">🧬 Cosa significa "Proteina Nobile"?</h4>
            <p style="margin:0; color:#1d4ed8; font-size:0.86rem; line-height:1.5;">
                Una proteina si definisce <strong>nobile</strong> (o ad <em>Alto Valore Biologico</em>) quando contiene <strong>tutti i 9 aminoacidi essenziali</strong> nelle corrette proporzioni. Il corpo umano non è in grado di sintetizzarli da solo: dobbiamo assumerli col cibo per proteggere la massa magra, tonificare i muscoli e saziarci a lungo!
            </p>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:18px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:1.5rem; line-height:1;">🐟</span>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">Pesce & Frutti di Mare (Salmone, Orata, Alici)</div>
                    <div style="font-size:0.82rem; color:#475569; margin-top:2px;">Digeribilità altissima + ricchezza di iodio e acidi grassi Omega-3 antinfiammatori.</div>
                </div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:1.5rem; line-height:1;">🥚</span>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">Uova Intere e Albumi (Valore Biologico 100)</div>
                    <div style="font-size:0.82rem; color:#475569; margin-top:2px;">Il punto di riferimento della nutrizione mondiale: la combinazione perfetta di aminoacidi.</div>
                </div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:1.5rem; line-height:1;">🍗</span>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">Carni Bianche Magre (Pollo & Tacchino)</div>
                    <div style="font-size:0.82rem; color:#475569; margin-top:2px;">Proteine pure a bassissimo contenuto di grassi saturi, ideali per chi deve perdere peso.</div>
                </div>
            </div>

            <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:12px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:1.5rem; line-height:1;">🌾🍲</span>
                <div>
                    <div style="font-weight:800; color:#065f46; font-size:0.9rem;">La Magia Vegetale: Cereali + Legumi!</div>
                    <div style="font-size:0.82rem; color:#047857; margin-top:2px;">
                        I legumi sono carenti di metionina, i cereali di lisina: <strong>mangiati insieme</strong> (es. <em>Pasta e lenticchie</em> o <em>Riso e piselli</em>) si completano a vicenda creando una <strong>proteina nobile a tutti gli effetti</strong>, senza colesterolo!
                    </div>
                </div>
            </div>
        </div>

        <div style="background:#fef2f2; border:1px solid #fee2e2; border-radius:10px; padding:12px; font-size:0.83rem; color:#991b1b; line-height:1.45;">
            🔥 <strong>Perché aiutano a dimagrire?</strong> Le proteine hanno l'effetto termico più alto di tutti i nutrienti: il 20-25% delle loro calorie viene bruciato dal corpo solo per digerirle!
        </div>
    `;
}

function renderHealthyFatsGuide(container) {
    container.innerHTML = `
        <div style="background:linear-gradient(135deg, #fefce8, #fef9c3); border:1.5px solid #fef08a; border-radius:14px; padding:16px; margin-bottom:18px;">
            <h4 style="margin:0 0 6px 0; color:#854d0e; font-size:1.05rem;">🥑 Non tutti i grassi fanno ingrassare!</h4>
            <p style="margin:0; color:#713f12; font-size:0.86rem; line-height:1.5;">
                I grassi "buoni" (insaturi e Omega-3) sono <strong>fondamentali per dimagrire bene</strong>: tengono stabili gli ormoni, riducono l'infiammazione cellulare e consentono di assorbire le vitamine essenziali (A, D, E, K).
            </p>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:18px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:1.5rem; line-height:1;">🫒</span>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">Olio Extravergine d'Oliva (EVO) a crudo</div>
                    <div style="font-size:0.82rem; color:#475569; margin-top:2px;">Ricco di acido oleico e polifenoli anti-età. Dosato a cucchiai (1 cucchiaio = 10g) è il re della longevità.</div>
                </div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:1.5rem; line-height:1;">🥜</span>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">Frutta Secca a guscio (Noci, Mandorle, Pistacchi)</div>
                    <div style="font-size:0.82rem; color:#475569; margin-top:2px;">Le noci sono la fonte vegetale più ricca di Omega-3 ALA; 15-20g sono uno spuntino saziante ideale.</div>
                </div>
            </div>
        </div>

        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; font-size:0.83rem; color:#166534; line-height:1.45;">
            💡 <strong>La regola d'oro:</strong> Non eliminare mai i grassi dalle diete, ma scegli quelli nobili e consumali preferibilmente a crudo!
        </div>
    `;
}


// =========================================================================
// GESTIONE CONSIGLI DINAMICI & TIMER VIVO PER IL DIGIUNO
// =========================================================================

window.userCurrentTipIndex = window.userCurrentTipIndex || {};

window.userCurrentTipIndex = window.userCurrentTipIndex || {};

window.getFastingTipsCatalog = function (isFasting) {
    let pillVerdure = '<span onclick="openNutritionTip(\'verdure\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per scoprire le verdure di stagione">verdure fresche 🥗</span>';
    let pillProteine = '<span onclick="openNutritionTip(\'proteine\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per capire cosa sono le proteine nobili">proteine nobili 🍗</span>';
    let pillGrassi = '<span onclick="openNutritionTip(\'grassi\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per scoprire i grassi buoni">grassi buoni 🥑</span>';
    let pillAutofagia = '<span onclick="openNutritionTip(\'autofagia\')" style="color:#1b5e20; background:#e8f5e9; border:1px solid #c8e6c9; padding:2px 7px; border-radius:6px; font-weight:bold; cursor:pointer;" title="Clicca per approfondire">autofagia cellulare 🧬</span>';

    if (isFasting) {
        return [
            "💧 <strong>Idratazione attiva:</strong> tisane calde, tè verde o acqua minerale ti mantengono sazio e supportano la naturale depurazione durante il digiuno.",
            "🔥 <strong>Autofagia cellulare & lipolisi:</strong> dopo 12-14 ore il tuo corpo avvia il rinnovamento cellulare naturale e attinge alle riserve di grasso per produrre energia pulita.",
            "☕ <strong>Caffè o tè amaro consentito:</strong> stimolano il metabolismo, liberano antiossidanti preziosi e spengono sul nascere la falsa fame mattutina.",
            "🥗 <strong>Pianifica il pasto di rottura:</strong> al termine del digiuno, componi il piatto con abbondanti " + pillVerdure + " e " + pillProteine + " per mantenere stabile la glicemia.",
            "🚶 <strong>Passeggiata rigenerante:</strong> 20 minuti di camminata leggera a digiuno aumentano la sensibilità all\'insulina senza affaticare il cuore.",
            "🍋 <strong>Acqua tiepida con limone o zenzero:</strong> perfetta al mattino per favorire la digestione gastrica e alcalinizzare il corpo a zero calorie.",
            "🧘 <strong>Ascolta i segnali del corpo:</strong> la sensazione di fame va a ondate e scompare in 15 minuti. Bevi un bicchiere d\'acqua e respira con calma.",
            "🌟 <strong>Riposo e melatonina:</strong> un sonno profondo di 7-8 ore durante la notte amplifica l\'effetto brucia-grassi del digiuno intermittente."
        ];
    } else {
        return [
            "🍽️ <strong>Piatto Unico Bilanciato:</strong> riempi il 50% del piatto con " + pillVerdure + ", il 25% con " + pillProteine + " e il 25% con carboidrati integrali.",
            "🍗 <strong>Proteine Nobili sazianti:</strong> salmone, pollo, uova o l\'abbinamento legumi+cereali proteggono la tua massa magra e tengono lontana la fame nervosa.",
            "🥑 <strong>Condisci con Olio EVO a crudo:</strong> 1-1.5 cucchiai di " + pillGrassi + " favoriscono l\'assorbimento delle vitamine A, D, E, K e danno grande sapore.",
            "✨ <strong>Masticazione lenta:</strong> mangia seduto a tavola, senza schermi o fretta. Masticare ogni boccone con calma attiva il senso naturale di sazietà dopo 20 minuti.",
            "🫐 <strong>Frutti di bosco o mela:</strong> se hai voglia di dolce dopo pranzo, i polifenoli dei mirtilli e la pectina della mela sono la scelta ideale.",
            "🥣 <strong>Yogurt greco o fiocchi di latte:</strong> uno spuntino proteico pomeridiano ideale per stabilizzare l\'energia fino a cena.",
            "🥦 <strong>Fibre prima dei carboidrati:</strong> iniziare il pasto con una bella insalata riduce del 30% il picco glicemico dei cibi successivi.",
            "🌿 <strong>Erbe aromatiche al posto del sale:</strong> rosmarino, origano, curcuma e basilico insaporiscono i piatti e contrastano la ritenzione idrica."
        ];
    }
};

window.nextFastingTip = function (profile) {
    let tipEl = document.getElementById('fast_smart_tip_text_' + profile);
    if (!tipEl) return;

    let isFasting = (tipEl.getAttribute('data-is-fasting') === 'true');
    let tips = window.getFastingTipsCatalog(isFasting);

    window.userCurrentTipIndex = window.userCurrentTipIndex || {};
    let currentIndex = (typeof window.userCurrentTipIndex[profile] === 'number') ? window.userCurrentTipIndex[profile] : 0;
    let nextIndex = (currentIndex + 1) % tips.length;
    window.userCurrentTipIndex[profile] = nextIndex;
    let chosen = tips[nextIndex];

    tipEl.dataset.userChosen = 'true';
    tipEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    tipEl.style.opacity = '0';
    tipEl.style.transform = 'translateY(-4px)';

    setTimeout(() => {
        tipEl.innerHTML = chosen;
        tipEl.style.opacity = '1';
        tipEl.style.transform = 'translateY(0)';
    }, 200);
};

window.buildStandaloneExe = async function () {
    if (typeof window.require !== 'undefined') {
        try {
            if (typeof showToast === 'function') {
                showToast("⏳ Compilazione in corso di ProgettoSalute.exe... Attendere qualche istante.", "#0284c7");
            }
            const { ipcRenderer } = window.require('electron');
            let res = await ipcRenderer.invoke('build-app-exe');
            if (res && res.success) {
                if (typeof showToast === 'function') {
                    showToast("✨ ProgettoSalute.exe aggiornato con successo! Cartella aperta.", "#16a34a");
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast("Compilazione avviata in background.", "#0284c7");
                }
            }
            return;
        } catch (err) {
            console.warn("Could not build exe via IPC:", err);
        }
    }
    showCustomAlert("Per compilare il nuovo .exe, fai doppio clic sul file 'Crea Nuovo EXE (Progetto Salute)' sul tuo Desktop!");
};


// =========================================================================
// CALCOLO SCIENTIFICO FABBISOGNO CALORICO PER DIMAGRIRE (Mifflin-St Jeor)
// =========================================================================

window.autoCalculateKcalDeficit = function (profile, notify = false) {
    let saved = localStorage.getItem('profileStats_' + profile);
    let stats = saved ? JSON.parse(saved) : {};
    let ana = JSON.parse(localStorage.getItem('anamnesi_' + profile)) || {};

    // 1. Altezza (cm)
    let heightEl = document.getElementById('height_' + profile);
    let rawHeight = heightEl ? heightEl.innerText.trim() : (stats.height || "");
    let height = parseFloat(rawHeight) || parseFloat(ana.altezza) || 165;

    // 2. Peso (kg) - usa il peso iniziale o la pesata più recente
    let startEl = document.getElementById('start_' + profile);
    let weightInput = document.getElementById('weight-' + profile);
    let rawWeight = weightInput && weightInput.value ? weightInput.value : (startEl ? startEl.innerText.trim() : (stats.start || ""));
    let weight = parseFloat(rawWeight) || 75;

    // 3. Età (anni) dalla data di nascita
    let dobInput = document.getElementById('dob_' + profile);
    let dobString = (dobInput && dobInput.value) ? dobInput.value : (stats.dob || "");
    let age = 45; // default clinico medio se non indicata
    if (dobString) {
        let dob = new Date(dobString);
        let today = new Date();
        age = today.getFullYear() - dob.getFullYear();
        let m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        if (isNaN(age) || age <= 0) age = 45;
    }

    // 4. Sesso (M o F)
    let gender = stats.gender || '';
    let profLower = (profile + ' ' + (localStorage.getItem('profileName_' + profile) || '')).toLowerCase();
    if (gender === 'M' || gender === 'Uomo' || profLower.includes('marito') || profLower.includes('ciro') || profLower.includes('luigi') || profLower.includes('salvatore') || profLower.includes('aldo') || profLower.includes('mario') || profLower.includes('antonio')) {
        gender = 'M';
    } else if (gender === 'F' || gender === 'Donna' || profLower.includes('moglie') || profLower.includes('elena') || profLower.includes('carmela') || profLower.includes('anna') || profLower.includes('maria')) {
        gender = 'F';
    } else {
        gender = 'M';
    }

    // 5. Formula scientifica di Mifflin-St Jeor (Gold Standard medico)
    let bmr = 0;
    if (gender === 'M') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    // 6. TDEE (Consumo totale giornaliero considerando attività fisica leggera/media x 1.35)
    let tdee = bmr * 1.35;

    // 7. Deficit per Dimagrimento Sano (Deficit sostenibile di ~500 kcal per perdere ~0.5kg di grasso a settimana)
    let deficitKcal = Math.round(tdee - 500);

    // 8. Soglia minima di sicurezza biologica OMS / SINU
    let minSafe = (gender === 'M') ? 1400 : 1200;
    if (deficitKcal < minSafe) deficitKcal = minSafe;

    // Arrotonda ai 50 più vicini per facilità di pianificazione della dieta
    deficitKcal = Math.round(deficitKcal / 50) * 50;

    // Applica a video e salva nello stato
    let kcalEl = document.getElementById('kcal_' + profile);
    if (kcalEl) {
        kcalEl.innerText = deficitKcal;
    }
    stats.kcal = deficitKcal.toString();
    stats.height = height.toString();
    stats.start = weight.toString();
    stats.dob = dobString;
    stats.gender = gender;
    localStorage.setItem('profileStats_' + profile, JSON.stringify(stats));

    if (notify && typeof showToast === 'function') {
        showToast("🪄 Fabbisogno calcolato su misura: ~" + deficitKcal + " kcal/die (Metabolismo Basale: " + Math.round(bmr) + ", Consumo Totale: " + Math.round(tdee) + ")", '#0284c7');
    }

    return deficitKcal.toString();
};


// ============================================================
// SISTEMA ANTEPRIMA DI STAMPA & SALVATAGGIO DIRETTO IN PDF
// ============================================================

window.currentPreviewProfile = 'marito';

window.openPrintPreview = function (profile) {
    let profileId = typeof profile === 'string' ? profile : (profile === 0 ? 'marito' : 'moglie');
    if (!profileId) profileId = window.activeProfile || 'marito';
    window.currentPreviewProfile = profileId;

    let section = document.getElementById('section-' + profileId);
    let targetTable = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];

    if (!targetTable) {
        targetTable = document.querySelector('.weekly-table');
    }
    if (!targetTable) {
        if (typeof showToast === 'function') showToast("Tabella menù non trovata per questo profilo.", "#ef4444");
        return;
    }

    let profileName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profileId) : profileId;

    // Recupera protocollo e orari salvati
    let fastType = localStorage.getItem('fast_type_' + profileId) || '16';
    let fastStart = localStorage.getItem('fast_start_' + profileId) || '20:30';
    let fastEnd = localStorage.getItem('fast_end_' + profileId) || '12:30';
    let eatHours = 24 - (parseInt(fastType) || 16);
    let fastingSubtitle = (fastType !== 'none')
        ? '⏳ Protocollo Digiuno: ' + fastType + ':' + eatHours + ' (' + fastStart + ' - ' + fastEnd + ')'
        : '🍽️ Dieta Libera Tradizionale (Senza vincoli di orario)';

    // Recupera patologia e obiettivo
    let patKey = (typeof getProfilePathology === 'function') ? getProfilePathology(profileId) : 'nessuna';
    let pObj = (typeof pathologyDb !== 'undefined' && pathologyDb[patKey]) ? pathologyDb[patKey] : null;
    let pathologySubtitle = pObj ? ' • ' + pObj.emoji + ' ' + pObj.badgeText : '';

    // Aggiorna testi nel modale di anteprima
    window._isPreviewingShoppingList = false;

    let profNameEl = document.getElementById('preview-prof-name');
    if (profNameEl) profNameEl.innerText = profileName;

    let sheetProfName = document.getElementById('sheet-profile-name');
    if (sheetProfName) sheetProfName.innerText = profileName;

    let sheetTitle = document.getElementById('sheet-title');
    if (sheetTitle) sheetTitle.innerHTML = `<span>🌿</span> Progetto Salute - Menù Settimanale: <span id="sheet-profile-name">${profileName}</span>`;

    let sheetSub = document.getElementById('sheet-subtitles');
    if (sheetSub) sheetSub.innerHTML = fastingSubtitle + '<br><span style="color:#0284c7; font-weight:700;">' + pathologySubtitle + '</span>';

    let sheetDate = document.getElementById('sheet-print-date');
    if (sheetDate) sheetDate.innerText = 'Data: ' + new Date().toLocaleDateString('it-IT');

    // Clona e formatta la tabella
    let container = document.getElementById('sheet-table-container');
    if (container) {
        container.innerHTML = '';
        let clone = targetTable.cloneNode(true);
        clone.style.width = '100%';
        clone.style.borderCollapse = 'collapse';
        clone.style.fontSize = '12px';
        clone.style.background = 'white';

        clone.querySelectorAll('th').forEach(th => {
            th.style.background = '#e8f5e9';
            th.style.color = '#14532d';
            th.style.padding = '8px 10px';
            th.style.border = '1px solid #777';
            th.style.fontSize = '12px';
            th.style.textAlign = 'left';

            // Forza tutti gli elementi interni all'intestazione a testo scuro nitido e leggibile
            th.querySelectorAll('*').forEach(child => {
                child.style.color = '#14532d';
                child.style.textShadow = 'none';
                if (child.style.backgroundColor || child.style.background || child.style.borderRadius) {
                    child.style.background = '#dcfce7';
                    child.style.border = '1px solid #86efac';
                    child.style.color = '#166534';
                }
            });
        });

        clone.querySelectorAll('td').forEach(td => {
            td.style.border = '1px solid #94a3b8';
            td.style.padding = '8px 10px';
            td.style.verticalAlign = 'top';
            td.style.fontSize = '11.5px';
            td.style.lineHeight = '1.4';
            td.style.color = '#0f172a';

            // Rimuovi eventuali colori bianchi sbiaditi dal testo delle celle
            td.querySelectorAll('*').forEach(child => {
                let c = child.style.color;
                if (c === 'white' || c === '#ffffff' || c === 'rgb(255, 255, 255)') {
                    child.style.color = '#0f172a';
                }
            });
        });

        clone.querySelectorAll('.day-cell').forEach(dc => {
            dc.style.fontWeight = 'bold';
            dc.style.background = '#f8fafc';
            dc.style.width = '90px';
        });

        clone.querySelectorAll('.kcal-cell').forEach(kc => {
            kc.style.fontWeight = 'bold';
            kc.style.color = '#0284c7';
            kc.style.whiteSpace = 'nowrap';
        });

        // Nascondi pulsanti 1-click nel foglio di stampa/PDF e preserva segnalazione visiva
        clone.querySelectorAll('.quick-fix-container').forEach(qf => qf.remove());
        clone.querySelectorAll('.bad-food-term').forEach(bf => {
            bf.style.background = '#fef3c7';
            bf.style.color = '#92400e';
            bf.style.padding = '1px 5px';
            bf.style.borderRadius = '4px';
            bf.style.fontWeight = 'bold';
            bf.style.borderBottom = '1.5px dashed #f59e0b';
        });

        container.appendChild(clone);
    }

    let modal = document.getElementById('print-preview-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.scrollTop = 0;
    }
};

window.closePrintPreview = function () {
    window._isPreviewingShoppingList = false;
    let modal = document.getElementById('print-preview-modal');
    if (modal) modal.style.display = 'none';
};

window.printFromPreview = function () {
    let isShopping = window._isPreviewingShoppingList === true;
    let className = isShopping ? 'print-shopping-preview-mode' : 'print-preview-mode';
    document.body.classList.add(className);
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.classList.remove(className);
        }, 1200);
    }, 200);
};

window.savePdfDirectly = function () {
    let sheet = document.getElementById('print-preview-sheet');
    if (!sheet) return;

    let isShopping = window._isPreviewingShoppingList === true;
    let profileId = window.currentPreviewProfile || window.activeProfile || 'marito';
    let profileName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profileId) : profileId;
    let safeName = profileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    let fileName = isShopping ? ('Lista_Spesa_' + safeName + '.pdf') : ('Menu_Settimanale_' + safeName + '.pdf');

    if (typeof showToast === 'function') {
        showToast("⏳ Generazione del file PDF in corso...", "#0284c7");
    }

    let opt = {
        margin: [8, 8, 8, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: isShopping ? 'portrait' : 'landscape' }
    };

    html2pdf().set(opt).from(sheet).outputPdf('datauristring').then(async (pdfDataUri) => {
        const base64Data = pdfDataUri.split(',')[1];
        if (typeof window.require !== 'undefined') {
            try {
                const { ipcRenderer } = window.require('electron');
                const res = await ipcRenderer.invoke('save-pdf-file', { fileName, base64Data });
                if (res && res.success) {
                    if (typeof showToast === 'function') {
                        showToast("🎉 File PDF salvato sul tuo PC!", "#16a34a");
                    }
                }
            } catch (err) {
                console.error("Errore salvataggio PDF via Electron:", err);
                const a = document.createElement('a');
                a.href = pdfDataUri;
                a.download = fileName;
                a.click();
            }
        } else {
            const a = document.createElement('a');
            a.href = pdfDataUri;
            a.download = fileName;
            a.click();
        }
    }).catch(err => {
        console.error("Errore generazione PDF:", err);
        if (typeof showToast === 'function') {
            showToast("Errore durante la creazione del PDF.", "#ef4444");
        }
    });
};

window.openShoppingPrintPreview = function () {
    let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(window.activeProfile || 'marito') : 'Famiglia';
    window._isPreviewingShoppingList = true;

    let profNameEl = document.getElementById('preview-prof-name');
    if (profNameEl) profNameEl.innerText = pName + " • Lista della Spesa A4";

    let sheetProfName = document.getElementById('sheet-profile-name');
    if (sheetProfName) sheetProfName.innerText = pName;

    let sheetTitle = document.getElementById('sheet-title');
    if (sheetTitle) sheetTitle.innerHTML = `<span>🛒</span> Progetto Salute - Lista della Spesa: <span>${pName}</span>`;

    let countNumEl = document.getElementById('shopping-count-num');
    let totalCount = countNumEl ? countNumEl.innerText : '0';

    let sheetSub = document.getElementById('sheet-subtitles');
    if (sheetSub) sheetSub.innerHTML = `<span style="color:#ea580c; font-weight:700;">Totale ingredienti: ${totalCount}</span> • Data: ${new Date().toLocaleDateString('it-IT')}`;

    let container = document.getElementById('sheet-table-container');
    if (container) {
        container.innerHTML = '';

        let grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gap = '14px';
        grid.style.padding = '10px 0';

        let modalCat = document.getElementById('shopping-modal-categories');
        if (modalCat) {
            let cards = modalCat.querySelectorAll('.shopping-cat-card');
            cards.forEach(card => {
                let titleEl = card.querySelector('.shopping-cat-title');
                let title = titleEl ? titleEl.childNodes[0].textContent.trim() : "Categoria";
                let labels = card.querySelectorAll('.shopping-item-label');
                if (labels.length === 0) return;

                let cardBox = document.createElement('div');
                cardBox.style.border = '1px solid #cbd5e1';
                cardBox.style.borderRadius = '8px';
                cardBox.style.padding = '10px 14px';
                cardBox.style.background = '#ffffff';
                cardBox.style.breakInside = 'avoid';

                let headerDiv = document.createElement('div');
                headerDiv.style.fontSize = '13px';
                headerDiv.style.fontWeight = '800';
                headerDiv.style.color = '#0f172a';
                headerDiv.style.marginBottom = '8px';
                headerDiv.style.borderBottom = '1px solid #e2e8f0';
                headerDiv.style.paddingBottom = '4px';
                headerDiv.style.display = 'flex';
                headerDiv.style.justifyContent = 'space-between';
                headerDiv.innerHTML = `<span>${title}</span><span style="font-size:11px; color:#64748b; font-weight:normal;">(${labels.length})</span>`;
                cardBox.appendChild(headerDiv);

                let listDiv = document.createElement('div');
                listDiv.style.fontSize = '12px';
                listDiv.style.display = 'flex';
                listDiv.style.flexDirection = 'column';
                listDiv.style.gap = '5px';

                labels.forEach(lbl => {
                    let cb = lbl.querySelector('input[type="checkbox"]');
                    let span = lbl.querySelector('span');
                    let name = span ? span.innerText.trim() : lbl.innerText.trim();
                    let isChecked = cb && cb.checked;

                    let itemDiv = document.createElement('div');
                    itemDiv.style.display = 'flex';
                    itemDiv.style.alignItems = 'center';
                    itemDiv.style.gap = '7px';
                    if (isChecked) {
                        itemDiv.style.textDecoration = 'line-through';
                        itemDiv.style.color = '#94a3b8';
                    } else {
                        itemDiv.style.color = '#1e293b';
                    }
                    itemDiv.innerHTML = `<span style="display:inline-block; width:13px; height:13px; border:1.5px solid ${isChecked ? '#16a34a' : '#64748b'}; border-radius:3px; text-align:center; line-height:11px; font-size:10px; font-weight:bold; color:#16a34a;">${isChecked ? '✓' : ''}</span><span>${name}</span>`;
                    listDiv.appendChild(itemDiv);
                });

                cardBox.appendChild(listDiv);
                grid.appendChild(cardBox);
            });
        }
        container.appendChild(grid);
    }

    // Chiudi la modale lista spesa e apri l'anteprima
    closeSmartShoppingList();

    let modal = document.getElementById('print-preview-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.scrollTop = 0;
    }
};

// Reindirizza printDiet ed exportPDF direttamente all'Anteprima di Stampa & PDF
function printDiet(profile) {
    openPrintPreview(profile);
}

function exportPDF(profile) {
    openPrintPreview(profile);
}

// =========================================================================
// 🎲 RIGENERA SOLO QUESTO GIORNO (REROLL SINGOLO PASTO)
// =========================================================================
window.rerollSingleDay = function (profileId, rowIndex) {
    if (!profileId) profileId = window.activeProfile || 'marito';
    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];
    if (!table) return;

    let rows = table.querySelectorAll('tbody tr');
    let targetRow = rows[rowIndex];
    if (!targetRow) return;

    let typeSelect = document.getElementById('fast_type_' + profileId);
    let fastType = typeSelect ? typeSelect.value : (localStorage.getItem('fast_type_' + profileId) || '16');

    let cells = targetRow.querySelectorAll('td.editable-cell');
    if (cells.length < 3) return;

    const daysNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    let dayName = daysNames[rowIndex] || 'Giorno';

    const omadMealList = [
        "Gran Piatto Unico OMAD: 100g riso basmati integrale 🍚, 250g orata o branzino al forno 🐟, zucchine e carciofi stufati 🥗, 2 cucch. olio EVO 🫒, 25g mandorle 🥜, 1 mela fresca 🍎 (Pasto Unico Completo)",
        "Gran Piatto Unico OMAD: 90g farro integrale 🌾, 250g salmone fresco al vapore 🍣, finocchi e broccoli all'agro 🥗, 2 cucch. olio EVO 🫒, 20g noci 🥜, 1 pera 🍐 (Pasto Unico Completo)",
        "Gran Piatto Unico OMAD: 100g pasta integrale 🍝 con crema di carciofi, 200g petto di pollo ai ferri 🍗 + 2 uova in camicia 🍳, insalatona mista 🥗, 2 cucch. olio EVO 🫒, 1 banana 🍌 (Pasto Unico Completo)",
        "Gran Piatto Unico OMAD: 250g patate al forno 🥔, 250g filetto di sgombro fresco 🐟, carote e rucola fresca 🥕, 2 cucch. olio EVO 🫒, yogurt greco 150g con mirtilli 🫐 e 20g mandorle 🥜 (Pasto Unico Completo)",
        "Gran Piatto Unico OMAD: 90g quinoa reale 🌾 con verdure miste 🥗, 250g merluzzo in padella con pomodorini 🐟, 2 uova sode 🥚, 2 cucch. olio EVO 🫒, 2 fette pane segale 🍞, 1 arancia 🍊 (Pasto Unico Completo)",
        "Gran Piatto Unico OMAD: Zuppa ricca con 150g lenticchie e 70g riso 🧆, 200g fesa di tacchino al limone 🍗, spinaci saltati 🥗, 2 cucch. olio EVO 🫒, 20g noci 🥜, 1 frutto di stagione 🍎 (Pasto Unico Completo)",
        "Gran Piatto Unico OMAD: 90g riso venere 🍚 con gamberi e zucchine, 200g orata al cartoccio 🐟, insalatona di campo 🥗, 2 cucch. olio EVO 🫒, 25g mandorle tostate 🥜, 1 mela verde 🍏 (Pasto Unico Completo)"
    ];

    const warriorDinnerList = [
        "Grande Cena Warrior: 90g riso integrale 🍚, 220g salmone al forno 🍣, zucchine e carciofi 🥗, 2 cucch. olio EVO 🫒, 1 frutto 🍎",
        "Grande Cena Warrior: 90g pasta integrale 🍝 con pomodorini, 200g petto di pollo 🍗, spinaci stufati 🥗, 2 cucch. olio EVO 🫒, 15g noci 🥜",
        "Grande Cena Warrior: 200g patate novelle al forno 🥔, 220g orata fresca 🐟, finocchi crudi 🥗, 2 cucch. olio EVO 🫒, yogurt greco 🥣",
        "Grande Cena Warrior: 80g farro 🌾 con lenticchie, 180g filetto di merluzzo 🐟, carote e rucola 🥗, 2 cucch. olio EVO 🫒, 1 frutto 🍐"
    ];

    const warriorSnackList = [
        "Spuntino Apertura Finestra: 1 mela fresca 🍎, 20g noci 🥜 e tisana al finocchio",
        "Spuntino Apertura Finestra: Yogurt greco 150g 🥣 con mirtilli 🫐 e 15g mandorle 🥜",
        "Spuntino Apertura Finestra: 1 banana matura 🍌, 15g mandorle 🥜 e tè verde non zuccherato",
        "Spuntino Apertura Finestra: Finocchi e carote croccanti 🥕 con 30g parmigiano o noci 🥜"
    ];

    const allRecipes = [...(JSON.parse(localStorage.getItem('myCustomRecipes')) || []), ...(typeof defaultRecipes !== 'undefined' ? defaultRecipes : [])];
    const pranziList = allRecipes.filter(r => ['pasta', 'riso', 'farro', 'quinoa', 'pollo', 'salmone', 'orata', 'sgombro', 'zuppa', 'lenticchie', 'fesa', 'tonno', 'uova', 'insalata'].some(k => (r.text || r.nome || r.name || '').toLowerCase().includes(k)));
    const getRandom = (arr, current) => {
        let filtered = arr.filter(x => (x.text || x) !== current);
        let pool = filtered.length > 0 ? filtered : arr;
        let item = pool[Math.floor(Math.random() * pool.length)];
        return (item && item.text) ? item.text : item;
    };

    if (fastType === '23') {
        cells[0].innerText = "⏳ Digiuno 23h (Idratazione: Acqua, Tè verde, Caffè amaro)";
        localStorage.setItem(cells[0].id, cells[0].innerText);
        cells[2].innerText = "⏳ Digiuno 23h (0 kcal)";
        localStorage.setItem(cells[2].id, cells[2].innerText);

        let newMeal = getRandom(omadMealList, cells[1].innerText);
        cells[1].innerText = newMeal;
        localStorage.setItem(cells[1].id, cells[1].innerText);
    } else if (fastType === '20') {
        cells[0].innerText = "⏳ Digiuno 20h (Idratazione: Acqua, Tè verde, Caffè amaro)";
        localStorage.setItem(cells[0].id, cells[0].innerText);

        let newDinner = getRandom(warriorDinnerList, cells[1].innerText);
        cells[1].innerText = newDinner;
        localStorage.setItem(cells[1].id, cells[1].innerText);

        let newSnack = getRandom(warriorSnackList, cells[2].innerText);
        cells[2].innerText = newSnack;
        localStorage.setItem(cells[2].id, cells[2].innerText);
    } else {
        if (pranziList.length > 0) {
            cells[0].innerText = getRandom(pranziList, cells[0].innerText);
            localStorage.setItem(cells[0].id, cells[0].innerText);
            cells[1].innerText = getRandom(pranziList, cells[1].innerText);
            localStorage.setItem(cells[1].id, cells[1].innerText);
        }
    }

    // Trigger row input event to recalculate Kcal and update warnings
    const evt = new Event('input', { bubbles: true });
    targetRow.dispatchEvent(evt);

    // Recheck pathologies
    let patKey = (typeof getProfilePathology === 'function') ? getProfilePathology(profileId) : 'steatosi';
    cells.forEach(c => formatCellWithWarnings(c, patKey));

    if (typeof showToast === 'function') {
        showToast("🎲 " + dayName + " rigenerato con successo! Nuova combinazione inserita 🪄", "#8e24aa");
    }
};

// =========================================================================
// 🛒 LISTA DELLA SPESA INTELLIGENTE (MODAL & CONDIVISIONE)
// =========================================================================
window.openSmartShoppingList = function (profileId) {
    if (!profileId) profileId = window.activeProfile || 'marito';
    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];
    if (!table) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Nessun menù settimanale trovato da cui estrarre la spesa!");
        return;
    }

    let cells = table.querySelectorAll('tbody td.editable-cell');
    let fullText = "";
    cells.forEach(c => fullText += " " + c.innerText);
    let fullLower = fullText.toLowerCase();

    const catDb = {
        pesce: {
            title: "🐟 Pescheria & Frutti di Mare",
            items: [
                { name: "Orata o Branzino fresco (freschi o filetti)", keys: ["orata", "branzino"] },
                { name: "Salmone fresco (tranci o filetti)", keys: ["salmone"] },
                { name: "Sgombro fresco o al naturale", keys: ["sgombro"] },
                { name: "Merluzzo o Nasello fresco", keys: ["merluzzo", "nasello"] },
                { name: "Gamberi o calamari freschi", keys: ["gamberi", "calamari"] },
                { name: "Tonno al naturale", keys: ["tonno"] }
            ]
        },
        carne_uova: {
            title: "🥩 Macelleria & Uova Fresche",
            items: [
                { name: "Petto di pollo fresco (a fette)", keys: ["petto di pollo", "pollo"] },
                { name: "Fesa di tacchino a fette", keys: ["tacchino", "fesa"] },
                { name: "Uova fresche da allevamento all'aperto", keys: ["uova", "uovo"] },
                { name: "Carne magra di vitello / manzo", keys: ["vitello", "manzo", "carpaccio"] }
            ]
        },
        ortofrutta: {
            title: "🥗 Ortofrutta & Verdure di Stagione",
            items: [
                { name: "Zucchine fresche", keys: ["zucchine", "zucchina"] },
                { name: "Carciofi freschi", keys: ["carciofi", "carciofo"] },
                { name: "Broccoli o Cavolfiori", keys: ["broccoli", "broccolo", "cavolfiore"] },
                { name: "Finocchi & Cetrioli", keys: ["finocchi", "finocchio", "cetrioli"] },
                { name: "Spinaci freschi o erbette", keys: ["spinaci", "erbette"] },
                { name: "Insalata mista & Rucola fresca", keys: ["insalata", "insalatona", "rucola"] },
                { name: "Pomodori e Pomodorini freschi", keys: ["pomodori", "pomodorini"] },
                { name: "Carote fresche", keys: ["carote", "carota"] },
                { name: "Mele fresche (Golden / Granny Smith)", keys: ["mela", "mele"] },
                { name: "Pere & Frutta di stagione", keys: ["pera", "pere", "arancia", "frutto", "frutta"] },
                { name: "Banane", keys: ["banana", "banane"] }
            ]
        },
        cereali: {
            title: "🌾 Cereali Integrali, Pane & Legumi",
            items: [
                { name: "Riso Basmati o Riso Integrale", keys: ["riso basmati", "riso integrale", "riso"] },
                { name: "Riso Venere (nero)", keys: ["riso venere"] },
                { name: "Farro perlato / integrale", keys: ["farro"] },
                { name: "Quinoa reale", keys: ["quinoa"] },
                { name: "Pasta 100% integrale", keys: ["pasta"] },
                { name: "Pane di segale o integrale fresco", keys: ["pane"] },
                { name: "Patate fresche", keys: ["patate", "patata"] },
                { name: "Lenticchie o Ceci", keys: ["lenticchie", "ceci"] }
            ]
        },
        dispensa: {
            title: "🫒 Dispensa, Frutta Secca & Latticini",
            items: [
                { name: "Olio Extra Vergine di Oliva (EVO) di prima qualità", keys: ["olio", "evo"] },
                { name: "Mandorle sgusciate (non salate)", keys: ["mandorle", "mandorla"] },
                { name: "Noci sgusciate", keys: ["noci", "noce"] },
                { name: "Yogurt greco magro (0-2%)", keys: ["yogurt", "yogurt greco"] },
                { name: "Mirtilli freschi", keys: ["mirtilli", "mirtillo"] },
                { name: "Tè verde, Tisane e Caffè", keys: ["tè", "caffè", "tisana"] }
            ]
        }
    };

    let totalCount = 0;
    let container = document.getElementById('shopping-modal-categories');
    if (!container) return;
    container.innerHTML = "";

    window._currentShoppingListForCopy = [];

    for (let catKey in catDb) {
        let cat = catDb[catKey];
        let matched = cat.items.filter(it => it.keys.some(k => fullLower.includes(k)));
        if (matched.length === 0) continue;

        totalCount += matched.length;

        let card = document.createElement('div');
        card.className = 'shopping-cat-card';

        let header = document.createElement('div');
        header.className = 'shopping-cat-title';
        header.innerHTML = cat.title + ` <span style="font-size:0.75rem; background:#f1f5f9; padding:2px 6px; border-radius:10px; color:#64748b; font-weight:bold; margin-left:auto;">${matched.length}</span>`;
        card.appendChild(header);

        let listEl = document.createElement('div');
        listEl.style.display = 'flex';
        listEl.style.flexDirection = 'column';
        listEl.style.gap = '4px';

        let categoryItemsForCopy = [];

        matched.forEach(item => {
            categoryItemsForCopy.push(item.name);
            let lbl = document.createElement('label');
            lbl.className = 'shopping-item-label';
            lbl.innerHTML = `<input type="checkbox"> <span>${item.name}</span>`;
            listEl.appendChild(lbl);
        });

        window._currentShoppingListForCopy.push({
            categoryTitle: cat.title,
            items: categoryItemsForCopy
        });

        card.appendChild(listEl);
        container.appendChild(card);
    }

    let countNumEl = document.getElementById('shopping-count-num');
    if (countNumEl) countNumEl.innerText = totalCount;

    let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profileId) : profileId;
    let subtitleEl = document.getElementById('shopping-modal-subtitle');
    if (subtitleEl) subtitleEl.innerText = `Menù settimanale di ${pName} (${totalCount} ingredienti rilevati)`;

    let modal = document.getElementById('smart-shopping-modal');
    if (modal) modal.style.display = 'flex';
};

// =========================================================================
// 🛒 GESTIONE AZIONI LISTA DELLA SPESA (WHATSAPP, COPIA, STAMPA, CHIUSURA)
// =========================================================================
function getShoppingListFormattedText() {
    let container = document.getElementById('shopping-modal-categories');
    let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(window.activeProfile || 'marito') : 'Famiglia';
    let text = "🛒 *LISTA DELLA SPESA SETTIMANALE* 🥗\n";
    text += "👤 Menù di: " + pName + "\n";
    text += "──────────────────────────\n\n";

    let hasItems = false;
    if (container) {
        let cards = container.querySelectorAll('.shopping-cat-card');
        if (cards && cards.length > 0) {
            cards.forEach(card => {
                let titleEl = card.querySelector('.shopping-cat-title');
                let title = titleEl ? titleEl.childNodes[0].textContent.trim() : "Categoria";
                let labels = card.querySelectorAll('.shopping-item-label');
                if (labels.length > 0) {
                    hasItems = true;
                    text += "*" + title + "*\n";
                    labels.forEach(lbl => {
                        let cb = lbl.querySelector('input[type="checkbox"]');
                        let span = lbl.querySelector('span');
                        let name = span ? span.innerText.trim() : lbl.innerText.trim();
                        let isChecked = cb && cb.checked;
                        text += (isChecked ? "✔️ ~" + name + "~" : "◻️ " + name) + "\n";
                    });
                    text += "\n";
                }
            });
        }
    }

    if (!hasItems && window._currentShoppingListForCopy && window._currentShoppingListForCopy.length > 0) {
        hasItems = true;
        window._currentShoppingListForCopy.forEach(cat => {
            text += "*" + cat.categoryTitle + "*\n";
            cat.items.forEach(it => {
                text += "◻️ " + it + "\n";
            });
            text += "\n";
        });
    }

    if (!hasItems) return "";
    text += "──────────────────────────\n";
    text += "Generata con Progetto Salute & Alimentazione ✨";
    return text;
}

function copyTextToClipboardUniversal(text) {
    let success = false;
    // 1. Prova Electron nativo
    if (typeof window.require !== 'undefined') {
        try {
            const { clipboard } = window.require('electron');
            if (clipboard && typeof clipboard.writeText === 'function') {
                clipboard.writeText(text);
                return true;
            }
        } catch (e) {
            console.warn("Electron clipboard error:", e);
        }
    }
    // 2. Fallback sincrono con textarea ed execCommand
    try {
        let ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
    } catch (e) { }
    // 3. Prova anche navigator.clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => { });
        success = true;
    }
    return success;
}

function showShoppingFeedback(msg) {
    let fbEl = document.getElementById('shopping-action-feedback');
    if (fbEl) {
        fbEl.innerHTML = msg;
        fbEl.style.display = 'block';
        setTimeout(() => {
            fbEl.style.display = 'none';
        }, 5000);
    }
}

window.closeSmartShoppingList = function () {
    let modal = document.getElementById('smart-shopping-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.copyShoppingListToClipboard = function () {
    let text = getShoppingListFormattedText();
    if (!text) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Nessun elemento da copiare nella lista!");
        else alert("Nessun elemento da copiare nella lista!");
        return;
    }
    copyTextToClipboardUniversal(text);
    showShoppingFeedback("✅ <strong>Lista copiata negli appunti!</strong> Puoi incollarla con Ctrl+V in qualsiasi programma o messaggio.");
    if (typeof showToast === 'function') {
        showToast("📋 Lista della spesa copiata con successo!", "#16a34a");
    }
};

window.shareShoppingListWhatsApp = function () {
    let text = getShoppingListFormattedText();
    if (!text) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Nessun elemento da inviare!");
        else alert("Nessun elemento da inviare!");
        return;
    }

    // Copia sempre negli appunti per sicurezza
    copyTextToClipboardUniversal(text);

    let url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);

    // Apri nel browser predefinito di Windows tramite Electron shell o window.open
    let opened = false;
    if (typeof window.require !== 'undefined') {
        try {
            const { shell } = window.require('electron');
            if (shell && typeof shell.openExternal === 'function') {
                shell.openExternal(url);
                opened = true;
            }
        } catch (e) {
            console.warn("Shell openExternal error:", e);
        }
    }
    if (!opened) {
        window.open(url, '_blank');
    }

    showShoppingFeedback("📲 <strong>WhatsApp avviato!</strong> La lista completa è stata anche copiata negli appunti (incolla con Ctrl+V se desiderato).");
    if (typeof showToast === 'function') {
        showToast("📲 WhatsApp aperto nel browser!", "#25d366");
    }
};

window.exportShoppingListPDF = function () {
    if (typeof window.openShoppingPrintPreview === 'function') {
        window.openShoppingPrintPreview();
    }
};

window.printShoppingListDirect = function () {
    document.body.classList.add('print-shopping-active');
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.classList.remove('print-shopping-active');
        }, 1200);
    }, 200);
};

// Supporto tasto ESC per chiudere la modale spesa
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        let modal = document.getElementById('smart-shopping-modal');
        if (modal && modal.style.display !== 'none') {
            closeSmartShoppingList();
        }
    }
});

// =========================================================================
// 1. 📲 QR CODE ISTANTANEO PER SMARTPHONE (LISTA DELLA SPESA)
// =========================================================================
window.toggleShoppingQRCode = function () {
    let card = document.getElementById('shopping-qr-card');
    if (!card) return;
    if (card.style.display !== 'none' && card.style.display !== '') {
        card.style.display = 'none';
        return;
    }
    let text = getShoppingListFormattedText();
    if (!text) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Nessun ingrediente nella lista della spesa!");
        else alert("Nessun ingrediente nella lista della spesa!");
        return;
    }
    let waUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
    let img = document.getElementById('shopping-qr-img');

    let generated = false;
    if (typeof window.require !== 'undefined') {
        try {
            const QRCodeLib = window.require('qrcode');
            if (QRCodeLib && typeof QRCodeLib.toDataURL === 'function') {
                QRCodeLib.toDataURL(waUrl, { width: 220, margin: 2, color: { dark: '#4a044e', light: '#ffffff' } }, function (err, url) {
                    if (!err && url && img) {
                        img.src = url;
                        card.style.display = 'block';
                    } else if (img) {
                        img.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(waUrl);
                        card.style.display = 'block';
                    }
                });
                generated = true;
            }
        } catch (e) {
            console.warn("QRCode library error:", e);
        }
    }
    if (!generated && img) {
        img.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(waUrl);
        card.style.display = 'block';
    }
};

// =========================================================================
// 2. 🍲 GUIDA MEAL PREP & BATCH COOKING DEL WEEKEND
// =========================================================================
window.openMealPrepModal = function (profileId) {
    if (!profileId) profileId = window.activeProfile || 'marito';
    let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profileId) : 'Famiglia';
    let titleEl = document.getElementById('meal-prep-title');
    if (titleEl) {
        titleEl.innerText = `Guida Meal Prep & Batch Cooking del Weekend - ${pName}`;
    }

    let section = document.getElementById('section-' + profileId);
    let table = section ? section.querySelector('.weekly-table') : document.querySelectorAll('.weekly-table')[profileId === 'marito' ? 0 : 1];
    let menuText = "";
    if (table) {
        let cells = table.querySelectorAll('tbody td.editable-cell');
        cells.forEach(c => menuText += " " + c.innerText);
    }
    let menuLower = menuText.toLowerCase();

    let hasVenere = menuLower.includes('venere');
    let hasRiso = menuLower.includes('riso');
    let hasFarro = menuLower.includes('farro');
    let hasPollo = menuLower.includes('pollo') || menuLower.includes('tacchino');
    let hasPesce = menuLower.includes('salmone') || menuLower.includes('orata') || menuLower.includes('pesce') || menuLower.includes('merluzzo');
    let hasUova = menuLower.includes('uov');
    let hasZucchine = menuLower.includes('zucch') || menuLower.includes('carciof') || menuLower.includes('broccol');

    let contentBox = document.getElementById('meal-prep-content-box');
    if (contentBox) {
        contentBox.innerHTML = `
            <div class="meal-prep-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="meal-prep-phase-badge">FASE 1 • DURATA: ~40 MIN</span>
                    <span style="font-size:0.82rem; color:#7e22ce; font-weight:700;">🧊 Conservazione: 4-5 giorni in frigo (vetro)</span>
                </div>
                <h4 style="margin:0 0 6px 0; color:#581c87; font-size:1.05rem;">🌾 Cottura in Batch di Cereali Integrali & Basi Complesse</h4>
                <p style="margin:0 0 10px 0; font-size:0.88rem; color:#475569;">
                    Cuoci in un colpo solo ${hasVenere ? '<strong>Riso Venere</strong>' : '<strong>Riso Basmati/Integrale</strong>'} ${hasFarro ? 'e <strong>Farro Perlato</strong>' : 'e quinoa'} in pentole capienti.
                </p>
                <div style="background:#faf5ff; border-left:3px solid #9333ea; padding:8px 12px; font-size:0.82rem; color:#6b21a8; border-radius:0 8px 8px 0;">
                    💡 <strong>Segreto Clinico:</strong> Lascia raffreddare i cereali prima di riporli nei contenitori ermetici. Il raffreddamento genera <em>amido resistente</em> (retrogradazione), dimezzando il picco glicemico e nutrendo il microbiota intestinale!
                </div>
            </div>

            <div class="meal-prep-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="meal-prep-phase-badge">FASE 2 • DURATA: ~35 MIN</span>
                    <span style="font-size:0.82rem; color:#7e22ce; font-weight:700;">🔥 Forno a 180°C ventilato</span>
                </div>
                <h4 style="margin:0 0 6px 0; color:#581c87; font-size:1.05rem;">🥦 Teglia Multi-Verdure Antinfiammatorie</h4>
                <p style="margin:0 0 10px 0; font-size:0.88rem; color:#475569;">
                    Taglia a tocchetti uniformi ${hasZucchine ? 'zucchine, carciofi e broccoli' : 'verdure di stagione'}, disponile su carta forno con filo d'olio EVO, origano secco e una spolverata di curcuma.
                </p>
                <div style="background:#faf5ff; border-left:3px solid #9333ea; padding:8px 12px; font-size:0.82rem; color:#6b21a8; border-radius:0 8px 8px 0;">
                    💡 <strong>Protezione Fegato:</strong> La cottura al forno concentra i polifenoli e riduce l'umidità superficiale, preservando le verdure fresche per tutta la settimana lavorativa.
                </div>
            </div>

            <div class="meal-prep-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="meal-prep-phase-badge">FASE 3 • DURATA: ~25 MIN</span>
                    <span style="font-size:0.82rem; color:#7e22ce; font-weight:700;">🥩 Protezione Massa Magra</span>
                </div>
                <h4 style="margin:0 0 6px 0; color:#581c87; font-size:1.05rem;">🍗 Porzionatura & Marinatura Proteine Nobili</h4>
                <p style="margin:0 0 10px 0; font-size:0.88rem; color:#475569;">
                    ${hasPollo ? 'Marina i petti di pollo/tacchino con succo di limone, rosmarino e un filo d\'olio EVO in sacchetti ermetici.' : 'Prepara le porzioni proteiche.'} 
                    ${hasUova ? 'Lessa 4-6 uova (8 minuti) e conservale con il guscio in frigorifero: snack salvavita nutriente!' : ''}
                    ${hasPesce ? 'Porziona i tranci di pesce fresco in contenitori sigillati pronti per i primi 2 giorni.' : ''}
                </p>
                <div style="background:#faf5ff; border-left:3px solid #9333ea; padding:8px 12px; font-size:0.82rem; color:#6b21a8; border-radius:0 8px 8px 0;">
                    💡 <strong>Metabolismo & Digiuno:</strong> Avere le proteine pronte elimina del tutto la tentazione di cedere a cibi veloci o ultra-processati all\'apertura della finestra alimentare.
                </div>
            </div>

            <div class="meal-prep-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="meal-prep-phase-badge">FASE 4 • DURATA: ~15 MIN</span>
                    <span style="font-size:0.82rem; color:#7e22ce; font-weight:700;">⚡ Assemblaggio Flash</span>
                </div>
                <h4 style="margin:0 0 6px 0; color:#581c87; font-size:1.05rem;">🥗 Barattoli Crudités, Vinaigrette & Sacchetti Snack</h4>
                <p style="margin:0 0 10px 0; font-size:0.88rem; color:#475569;">
                    Lava e centrifuga l\'insalata e conservala in un contenitore con un foglio di carta assorbente. Prepara un vasetto di vinaigrette emulsionata (olio EVO + succo di limone fresco) e sacchettini da 20-30g di mandorle/noci sgusciate.
                </p>
                <div style="background:#faf5ff; border-left:3px solid #9333ea; padding:8px 12px; font-size:0.82rem; color:#6b21a8; border-radius:0 8px 8px 0;">
                    💡 <strong>Risultato:</strong> In soli 75 minuti domenicali hai coperto tutti i pasti della settimana, risparmiando stress, tempo e denaro!
                </div>
            </div>
        `;
    }

    let modal = document.getElementById('meal-prep-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeMealPrepModal = function () {
    let modal = document.getElementById('meal-prep-modal');
    if (modal) modal.style.display = 'none';
};

window.printMealPrepDirect = function () {
    document.body.classList.add('print-meal-prep-active');
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.classList.remove('print-meal-prep-active');
        }, 1200);
    }, 200);
};

// =========================================================================
// 3. ⚖️ RIPARTIZIONE MACRONUTRIENTI IN TEMPO REALE (40/30/30)
// =========================================================================
window.updateMacroTrackerUI = function (profileId) {
    if (!profileId) profileId = window.activeProfile || 'marito';
    let carbEl = document.getElementById('macro_carb_' + profileId);
    let protEl = document.getElementById('macro_prot_' + profileId);
    let fatEl = document.getElementById('macro_fat_' + profileId);
    let barCarb = document.getElementById('macro_bar_carb_' + profileId);
    let barProt = document.getElementById('macro_bar_prot_' + profileId);
    let barFat = document.getElementById('macro_bar_fat_' + profileId);
    let labelEl = document.getElementById('macro_focus_label_' + profileId);

    if (!carbEl || !protEl || !fatEl) return;

    let carb = 40;
    let prot = 30;
    let fat = 30;
    let rationale = "Protezione massa magra, sazietà ed efficienza metabolica (Sirtuine & AMPK attive)";

    let patKey = (typeof getProfilePathology === 'function') ? getProfilePathology(profileId) : 'steatosi';
    if (patKey === 'steatosi' || patKey === 'fegato') {
        carb = 35; prot = 35; fat = 30;
        rationale = "Focus Steatosi Epatica: Carbo a basso IG, apporto proteico per rigenerazione epatica";
    } else if (patKey === 'diabete' || patKey === 'insulino') {
        carb = 35; prot = 35; fat = 30;
        rationale = "Focus Controllo Glicemico: picco insulinico bloccato, fibre prebiotiche e acidi monoinsaturi";
    }

    carbEl.innerText = carb + "%";
    protEl.innerText = prot + "%";
    fatEl.innerText = fat + "%";

    if (barCarb) barCarb.style.width = carb + "%";
    if (barProt) barProt.style.width = prot + "%";
    if (barFat) barFat.style.width = fat + "%";
    if (labelEl) labelEl.innerText = rationale;
};

// =========================================================================
// 4. 🧊 MODULO SVUOTA-FRIGO CLINICO SANO
// =========================================================================
const FRIDGE_PANTRY_ITEMS = [
    { name: "Zucchine", cat: "verdure", icon: "🥒" },
    { name: "Spinaci / Erbette", cat: "verdure", icon: "🥬" },
    { name: "Broccoli / Cavolo", cat: "verdure", icon: "🥦" },
    { name: "Finocchi", cat: "verdure", icon: "🥗" },
    { name: "Pomodorini", cat: "verdure", icon: "🍅" },
    { name: "Carote", cat: "verdure", icon: "🥕" },
    { name: "Cipolla o Aglio", cat: "verdure", icon: "🧅" },
    { name: "Petto di Pollo", cat: "proteine", icon: "🍗" },
    { name: "Uova fresche", cat: "proteine", icon: "🥚" },
    { name: "Tonno naturale", cat: "proteine", icon: "🐟" },
    { name: "Salmone", cat: "proteine", icon: "🍣" },
    { name: "Merluzzo / Nasello", cat: "proteine", icon: "🐠" },
    { name: "Lenticchie / Ceci", cat: "proteine", icon: "🍲" },
    { name: "Ricotta magra", cat: "proteine", icon: "🧀" },
    { name: "Riso Basmati", cat: "carbo", icon: "🍚" },
    { name: "Farro perlato", cat: "carbo", icon: "🌾" },
    { name: "Pasta integrale", cat: "carbo", icon: "🍝" },
    { name: "Patate", cat: "carbo", icon: "🥔" },
    { name: "Pane integrale / Segale", cat: "carbo", icon: "🍞" },
    { name: "Olio Extra Vergine (EVO)", cat: "grassi", icon: "🫒" },
    { name: "Mandorle o Noci", cat: "grassi", icon: "🥜" },
    { name: "Limone fresco", cat: "aromi", icon: "🍋" },
    { name: "Zenzero o Curcuma", cat: "aromi", icon: "✨" }
];

window.openFridgeFinderModal = function () {
    let container = document.getElementById('fridge-tags-container');
    if (container && container.children.length === 0) {
        FRIDGE_PANTRY_ITEMS.forEach(it => {
            let btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fridge-tag-pill';
            btn.innerHTML = `${it.icon} ${it.name}`;
            btn.dataset.item = it.name;
            btn.dataset.cat = it.cat;
            btn.onclick = function () {
                btn.classList.toggle('active');
                generateFridgeRecipe();
            };
            container.appendChild(btn);
        });
    }
    let modal = document.getElementById('fridge-finder-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeFridgeFinderModal = function () {
    let modal = document.getElementById('fridge-finder-modal');
    if (modal) modal.style.display = 'none';
};

window.resetFridgeTags = function () {
    let container = document.getElementById('fridge-tags-container');
    if (container) {
        let activeButtons = container.querySelectorAll('.fridge-tag-pill.active');
        activeButtons.forEach(b => b.classList.remove('active'));
    }
    let res = document.getElementById('fridge-recipe-result');
    if (res) {
        res.innerHTML = "";
        res.style.display = 'none';
    }
};

window.generateFridgeRecipe = function () {
    let container = document.getElementById('fridge-tags-container');
    let res = document.getElementById('fridge-recipe-result');
    if (!container || !res) return;

    let activeTags = Array.from(container.querySelectorAll('.fridge-tag-pill.active')).map(b => ({
        name: b.dataset.item,
        cat: b.dataset.cat
    }));

    if (activeTags.length < 2) {
        res.style.display = 'block';
        res.innerHTML = `
            <div style="text-align:center; padding:12px; color:#64748b; font-size:0.92rem;">
                👉 <em>Seleziona almeno <strong>2 ingredienti</strong> per comporre la tua ricetta clinica su misura.</em>
            </div>
        `;
        return;
    }

    let proteins = activeTags.filter(t => t.cat === 'proteine');
    let veggies = activeTags.filter(t => t.cat === 'verdure');
    let carbs = activeTags.filter(t => t.cat === 'carbo');

    let mainProt = proteins.length > 0 ? proteins[0].name : "Proteina a scelta";
    let mainVeg = veggies.length > 0 ? veggies.map(v => v.name).join(" & ") : "Verdure di stagione";
    let mainCarb = carbs.length > 0 ? carbs[0].name : "Carboidrato a basso IG o contorno saziante";

    let dishTitle = `Padellata Clinica di ${mainVeg} con ${mainProt}`;
    if (carbs.length > 0) dishTitle += ` su letto di ${mainCarb}`;

    res.style.display = 'block';
    res.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
                <span style="font-size:0.8rem; background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:20px; font-weight:800;">
                    🍽️ COMBINAZIONE NUTRIZIONALE BILANCIATA
                </span>
                <h3 style="margin:6px 0 2px 0; color:#0369a1; font-size:1.25rem;">${dishTitle}</h3>
                <div style="font-size:0.85rem; color:#64748b;">⏱️ Tempo di preparazione stimato: <strong>15-20 minuti</strong></div>
            </div>
        </div>

        <div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:10px 14px; border-radius:0 8px 8px 0; margin-bottom:14px; font-size:0.86rem; color:#166534;">
            🌿 <strong>Impatto Clinico & Metabolico:</strong> Questa combinazione rispetta la regola del piatto sano (50% fibre/verdure, 25% proteine nobili, 25% carboidrati complessi). Minimo impatto sull'insulina e sazietà prolungata per sostenere il digiuno intermittente.
        </div>

        <h4 style="margin:0 0 6px 0; font-size:0.95rem; color:#0f172a;">👨‍🍳 Istruzioni di Preparazione Rapida:</h4>
        <ol style="margin:0 0 14px 20px; padding:0; font-size:0.88rem; color:#334155; line-height:1.6;">
            <li><strong>Base aromatica:</strong> Scalda una padella antiaderente con 1 cucchiaio di Olio EVO e cuoci le verdure (${mainVeg}) a fiamma viva per 5-7 minuti con poca acqua fino a renderle croccanti.</li>
            <li><strong>Cottura delicata delle proteine:</strong> Aggiungi ${mainProt} a pezzetti o filetti; cuoci a fuoco moderato per mantenere la morbidezza e preservare il profilo amminoacidico.</li>
            ${carbs.length > 0 ? `<li><strong>Integrazione carboidrati:</strong> Unisci ${mainCarb} precedentemente lessato o saltalo nella padella per assorbire tutti i sapori naturali.</li>` : `<li><strong>Opzione carboidrati:</strong> Se desideri completare il piatto, accompagna con 50g di riso integrale o pane di segale tostato.</li>`}
            <li><strong>Tocco finale:</strong> Condisci a crudo con un filo d'Olio EVO, una spruzzata di succo di limone fresco ed erbe aromatiche (origano, timo o curcuma).</li>
        </ol>

        <div style="text-align:right;">
            <button type="button" onclick="copyTextToClipboardUniversal('${dishTitle.replace(/'/g, "\\'")}\\nIngredienti: ${activeTags.map(t => t.name).join(', ')}'); showToast('Ricetta copiata negli appunti! 📋', '#0284c7');" style="padding:7px 14px; background:#0284c7; color:white; border:none; border-radius:6px; font-weight:700; font-size:0.82rem; cursor:pointer;">
                📋 Copia Ricetta
            </button>
        </div>
    `;
};

// =========================================================================
// 5. 🔔 PROMEMORIA NOTIFICHE DESKTOP WINDOWS PER DIGIUNO & TISANE
// =========================================================================
window.toggleFastingNotifications = function (enabled) {
    localStorage.setItem('fasting_notifications_enabled', enabled ? 'true' : 'false');
    if (enabled) {
        if (typeof triggerWindowsNotification === 'function') {
            triggerWindowsNotification(
                "🌿 Notifiche Progetto Salute Attivate",
                "Riceverai avvisi discreti durante la finestra di digiuno per ricordarti di bere acqua o tisane drenanti!"
            );
        }
        if (typeof showToast === 'function') {
            showToast("🔔 Promemoria Windows per digiuno e tisane attivati!", "#10b981");
        }
    } else {
        if (typeof showToast === 'function') {
            showToast("🔕 Notifiche disattivate.", "#64748b");
        }
    }
};

window.triggerWindowsNotification = function (title, body) {
    if (localStorage.getItem('fasting_notifications_enabled') === 'false') return;

    if (typeof window.require !== 'undefined') {
        try {
            const { ipcRenderer } = window.require('electron');
            if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
                ipcRenderer.invoke('show-desktop-notification', { title, body });
                return;
            }
        } catch (e) {
            console.warn("Electron notification error:", e);
        }
    }
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            new Notification(title, { body: body });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(p => {
                if (p === "granted") new Notification(title, { body: body });
            });
        }
    }
};

function checkFastingHydrationReminder() {
    let enabled = localStorage.getItem('fasting_notifications_enabled') !== 'false';
    if (!enabled) return;

    let now = Date.now();
    let lastNotif = parseInt(localStorage.getItem('last_fasting_hydration_notif') || '0');
    if (now - lastNotif < 75 * 60 * 1000) return;

    let p = window.activeProfile || 'marito';
    let statusEl = document.getElementById('fast_status_' + p);
    let isInFast = statusEl && statusEl.innerText.toLowerCase().includes('digiuno');

    if (isInFast) {
        localStorage.setItem('last_fasting_hydration_notif', now.toString());
        triggerWindowsNotification(
            "💧 Momento Idratazione & Autofagia",
            "Sei nella finestra di digiuno: bevi un bicchiere d'acqua o una tisana per stimolare il drenaggio epatico!"
        );
    }
}

// =========================================================================
// 6. 📈 GRAFICO INTERATTIVO TREND PESO & CIRCONFERENZA VITA & PROIEZIONE
// =========================================================================
window.openWeightTrendModal = function (profileId) {
    if (!profileId) profileId = window.activeProfile || 'marito';
    window.currentTrendProfile = profileId;

    let pName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profileId) : 'Utente';
    let titleEl = document.getElementById('weight-trend-modal-title');
    if (titleEl) {
        titleEl.innerText = `Trend Peso, Circonferenza Vita & Proiezione Obiettivo - ${pName}`;
    }

    let dateInput = document.getElementById('trend-input-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    let key = `weightLog_${profileId}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];
    let wInput = document.getElementById('trend-input-weight');
    let waistInput = document.getElementById('trend-input-waist');
    if (log.length > 0) {
        let last = log[log.length - 1];
        if (wInput) wInput.value = last.weight || '';
        if (waistInput) waistInput.value = last.waist || '';
    } else {
        let startW = parseFloat(document.getElementById('start_' + profileId)?.innerText) || 80;
        if (wInput) wInput.value = startW;
    }

    renderWeightTrendUI(profileId);

    let modal = document.getElementById('weight-trend-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeWeightTrendModal = function () {
    let modal = document.getElementById('weight-trend-modal');
    if (modal) modal.style.display = 'none';
};

window.addTrendMeasurement = function () {
    let profileId = window.currentTrendProfile || window.activeProfile || 'marito';
    let dateInput = document.getElementById('trend-input-date');
    let wInput = document.getElementById('trend-input-weight');
    let waistInput = document.getElementById('trend-input-waist');

    let date = dateInput ? dateInput.value : '';
    let weight = parseFloat(wInput ? wInput.value : '');
    let waist = parseFloat(waistInput ? waistInput.value : '');

    if (!date || isNaN(weight) || weight <= 0) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Inserisci almeno una data valida e il peso in kg!");
        else alert("Inserisci una data valida e il peso in kg!");
        return;
    }

    let key = `weightLog_${profileId}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];

    let entryIndex = log.findIndex(e => e.date === date);
    if (entryIndex !== -1) {
        log[entryIndex].weight = weight;
        if (!isNaN(waist) && waist > 0) log[entryIndex].waist = waist;
    } else {
        let newEntry = {
            date: date,
            weight: weight,
            timestamp: new Date(date).getTime() || Date.now()
        };
        if (!isNaN(waist) && waist > 0) newEntry.waist = waist;
        log.push(newEntry);
    }

    log.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    localStorage.setItem(key, JSON.stringify(log));

    let startWeight = parseFloat(document.getElementById('start_' + profileId)?.innerText) || 80;
    let goalWeight = parseFloat(document.getElementById('goal_' + profileId)?.innerText) || 65;
    if (typeof updateProgressUI === 'function') {
        updateProgressUI(profileId, startWeight, weight, goalWeight);
    }
    if (typeof calculateStats === 'function') {
        calculateStats(profileId, weight, log);
    }
    if (typeof drawChart === 'function') {
        drawChart(profileId, log, startWeight);
    }

    renderWeightTrendUI(profileId);

    if (typeof showToast === 'function') {
        showToast("📈 Misurazione registrata con successo!", "#10b981");
    }
};

window.renderWeightTrendUI = function (profileId) {
    let key = `weightLog_${profileId}`;
    let log = JSON.parse(localStorage.getItem(key)) || [];
    let startWeight = parseFloat(document.getElementById('start_' + profileId)?.innerText) || (log.length > 0 ? log[0].weight : 80);
    let goalWeight = parseFloat(document.getElementById('goal_' + profileId)?.innerText) || 65;

    let curWeightEl = document.getElementById('trend-stat-current');
    let lostEl = document.getElementById('trend-stat-lost');
    let waistEl = document.getElementById('trend-stat-waist');
    let etaEl = document.getElementById('trend-stat-eta');

    if (log.length === 0) {
        if (curWeightEl) curWeightEl.innerText = startWeight.toFixed(1) + " kg";
        if (lostEl) lostEl.innerText = "0.0 kg";
        if (waistEl) waistEl.innerText = "-- cm";
        if (etaEl) etaEl.innerText = "Inserisci dati";
        renderEmptyTrendSVG();
        return;
    }

    let last = log[log.length - 1];
    let currentWeight = last.weight;
    let totalLost = startWeight - currentWeight;

    if (curWeightEl) curWeightEl.innerText = currentWeight.toFixed(1) + " kg";
    if (lostEl) lostEl.innerText = (totalLost >= 0 ? "-" : "+") + Math.abs(totalLost).toFixed(1) + " kg";

    let waistEntries = log.filter(e => typeof e.waist === 'number' && e.waist > 0);
    if (waistEntries.length > 0) {
        let firstWaist = waistEntries[0].waist;
        let lastWaist = waistEntries[waistEntries.length - 1].waist;
        let diffWaist = firstWaist - lastWaist;
        if (waistEl) waistEl.innerText = (diffWaist >= 0 ? "-" : "+") + Math.abs(diffWaist).toFixed(1) + " cm";
    } else {
        if (waistEl) waistEl.innerText = "-- cm";
    }

    if (currentWeight <= goalWeight) {
        if (etaEl) etaEl.innerHTML = "🏆 <strong>Raggiunto!</strong>";
    } else {
        let remainingKg = currentWeight - goalWeight;
        let weeksNeeded = Math.ceil(remainingKg / 0.5);
        let targetMs = Date.now() + weeksNeeded * 7 * 24 * 60 * 60 * 1000;
        let targetDate = new Date(targetMs);
        let dateStr = targetDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
        if (etaEl) etaEl.innerHTML = `📅 <strong>${dateStr}</strong><br><span style="font-size:0.75rem; color:#047857;">(~${weeksNeeded} sett. con -0.5 kg/sett)</span>`;
    }

    renderWeightTrendSVG(log, startWeight, goalWeight);
};

function renderEmptyTrendSVG() {
    let container = document.getElementById('trend-svg-container');
    if (container) {
        container.innerHTML = `
            <div style="height:220px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.9rem;">
                📊 Registra la prima misurazione di peso e vita per visualizzare il grafico interattivo.
            </div>
        `;
    }
}

function renderWeightTrendSVG(log, startWeight, goalWeight) {
    let container = document.getElementById('trend-svg-container');
    if (!container) return;

    if (log.length === 1) {
        log = [{ date: "Inizio", weight: startWeight, waist: log[0].waist, timestamp: log[0].timestamp - 86400000 }, log[0]];
    }

    let w = 720;
    let h = 240;
    let padLeft = 50;
    let padRight = 50;
    let padTop = 30;
    let padBottom = 35;

    let weights = log.map(e => e.weight);
    let minW = Math.min(...weights, goalWeight) - 1.5;
    let maxW = Math.max(...weights, startWeight) + 1.5;

    let waistEntries = log.filter(e => typeof e.waist === 'number' && e.waist > 0);
    let hasWaist = waistEntries.length > 0;
    let minWaist = 60, maxWaist = 120;
    if (hasWaist) {
        let waists = waistEntries.map(e => e.waist);
        minWaist = Math.min(...waists) - 2;
        maxWaist = Math.max(...waists) + 2;
    }

    let plotW = w - padLeft - padRight;
    let plotH = h - padTop - padBottom;

    let n = log.length;
    let getX = (idx) => padLeft + (idx / Math.max(1, n - 1)) * plotW;
    let getYWeight = (val) => padTop + plotH - ((val - minW) / (maxW - minW || 1)) * plotH;
    let getYWaist = (val) => padTop + plotH - ((val - minWaist) / (maxWaist - minWaist || 1)) * plotH;

    let yGoal = getYWeight(goalWeight);
    let weightPoints = log.map((e, i) => `${getX(i).toFixed(1)},${getYWeight(e.weight).toFixed(1)}`).join(' ');
    let waistPoints = "";
    if (hasWaist) {
        waistPoints = log.map((e, i) => {
            if (typeof e.waist === 'number' && e.waist > 0) {
                return `${getX(i).toFixed(1)},${getYWaist(e.waist).toFixed(1)}`;
            }
            return null;
        }).filter(p => p !== null).join(' ');
    }

    let svgHtml = `
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block; overflow:visible;" font-family="Segoe UI, sans-serif">
            <line x1="${padLeft}" y1="${padTop}" x2="${w - padRight}" y2="${padTop}" stroke="#f1f5f9" stroke-width="1" />
            <line x1="${padLeft}" y1="${padTop + plotH * 0.5}" x2="${w - padRight}" y2="${padTop + plotH * 0.5}" stroke="#f1f5f9" stroke-width="1" />
            <line x1="${padLeft}" y1="${padTop + plotH}" x2="${w - padRight}" y2="${padTop + plotH}" stroke="#e2e8f0" stroke-width="1.5" />

            <line x1="${padLeft}" y1="${yGoal.toFixed(1)}" x2="${w - padRight}" y2="${yGoal.toFixed(1)}" stroke="#10b981" stroke-dasharray="4,4" stroke-width="1.5" />
            <text x="${w - padRight + 6}" y="${yGoal + 4}" fill="#059669" font-size="10" font-weight="700">Obiettivo ${goalWeight}kg</text>

            <polyline fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${weightPoints}" />

            ${(hasWaist && waistPoints) ? `<polyline fill="none" stroke="#d97706" stroke-width="2.5" stroke-dasharray="6,3" stroke-linecap="round" stroke-linejoin="round" points="${waistPoints}" />` : ''}

            ${log.map((e, i) => {
        let cx = getX(i);
        let cyW = getYWeight(e.weight);
        let dateLabel = e.date ? e.date.slice(5) : '';
        let dotSvg = `
                    <circle cx="${cx.toFixed(1)}" cy="${cyW.toFixed(1)}" r="5" fill="#ffffff" stroke="#10b981" stroke-width="3">
                        <title>${e.date}: ${e.weight} kg</title>
                    </circle>
                    <text x="${cx.toFixed(1)}" y="${(cyW - 9).toFixed(1)}" text-anchor="middle" fill="#047857" font-size="11" font-weight="800">${e.weight}kg</text>
                    <text x="${cx.toFixed(1)}" y="${(padTop + plotH + 18).toFixed(1)}" text-anchor="middle" fill="#64748b" font-size="10">${dateLabel}</text>
                `;
        if (typeof e.waist === 'number' && e.waist > 0) {
            let cyWaist = getYWaist(e.waist);
            dotSvg += `
                        <circle cx="${cx.toFixed(1)}" cy="${cyWaist.toFixed(1)}" r="4" fill="#ffffff" stroke="#d97706" stroke-width="2.5">
                            <title>${e.date}: Vita ${e.waist} cm</title>
                        </circle>
                        <text x="${cx.toFixed(1)}" y="${(cyWaist + 14).toFixed(1)}" text-anchor="middle" fill="#b45309" font-size="10" font-weight="700">${e.waist}cm</text>
                    `;
        }
        return dotSvg;
    }).join('')}
        </svg>
    `;

    container.innerHTML = svgHtml;
}

// =========================================================================
// ⏱️ TIMER DIGIUNO CONTINUO IN TEMPO REALE & IDRATAZIONE
// =========================================================================
if (!window._fastingTickerInterval) {
    window._fastingTickerInterval = setInterval(() => {
        let p = window.activeProfile || 'marito';
        if (typeof updateFasting === 'function' && document.getElementById('fast_status_' + p)) {
            updateFasting(p);
        }
        if (typeof checkFastingHydrationReminder === 'function') {
            checkFastingHydrationReminder();
        }
    }, 1000);
}

// Inizializzazione automatica al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    let notifToggle = document.getElementById('fastingNotificationToggle');
    if (notifToggle) {
        let saved = localStorage.getItem('fasting_notifications_enabled');
        if (saved !== null) {
            notifToggle.checked = saved === 'true';
        }
    }
    setTimeout(() => {
        let p = window.activeProfile || 'marito';
        if (typeof updateMacroTrackerUI === 'function') {
            updateMacroTrackerUI(p);
        }
    }, 500);
});



// =========================================================================
// ☁️ MOTORE DI SINCRONIZZAZIONE CLOUD PROGETTO SALUTE (PC & SMARTPHONE)
// =========================================================================
window.syncSaluteToCloud = async function (customPayload) {
    try {
        let payload = customPayload;
        if (!payload || typeof payload !== 'object') {
            payload = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) payload[k] = localStorage.getItem(k);
            }
        }
        const resp = await fetch('/api/salute/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            console.log('☁️ Progetto Salute: Sincronizzazione cloud riuscita!');
        }
    } catch (err) {
        console.warn('☁️ Sync Cloud offline:', err);
    }
};

window.pullSaluteFromCloud = async function (forceRefresh) {
    try {
        const resp = await fetch('/api/salute/data?t=' + Date.now());
        if (!resp.ok) return false;
        const cloudData = await resp.json();
        if (!cloudData || typeof cloudData !== 'object' || Object.keys(cloudData).length === 0) return false;

        let hasChanges = false;
        let profilesListChanged = false;
        for (let k in cloudData) {
            const cloudVal = typeof cloudData[k] === 'object' ? JSON.stringify(cloudData[k]) : String(cloudData[k]);
            const localVal = localStorage.getItem(k);

            // Per gli array di peso, fai merge intelligente escludendo le pesate eliminate
            if (k.startsWith('weightLog_')) {
                try {
                    const prof = k.replace('weightLog_', '');
                    const delKey = 'deletedWeights_' + prof;
                    const delList = JSON.parse(localStorage.getItem(delKey) || '[]');
                    const delSet = new Set(delList);
                    if (cloudData._deletedWeightsLog && Array.isArray(cloudData._deletedWeightsLog)) {
                        cloudData._deletedWeightsLog.forEach(tag => {
                            const [p, d] = String(tag).split('|');
                            if (p === prof && d) delSet.add(d);
                        });
                    }

                    const cloudArr = JSON.parse(cloudVal);
                    const localArr = localVal ? JSON.parse(localVal) : [];
                    if (Array.isArray(cloudArr) && Array.isArray(localArr)) {
                        const map = new Map();
                        localArr.forEach(item => {
                            if (item && item.date && !delSet.has(item.date)) map.set(item.date, item);
                        });
                        cloudArr.forEach(item => {
                            if (item && item.date && !delSet.has(item.date)) map.set(item.date, item);
                        });
                        const mergedArr = Array.from(map.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                        const mergedStr = JSON.stringify(mergedArr);
                        if (mergedStr !== localVal) {
                            localStorage.setItem(k, mergedStr);
                            hasChanges = true;
                        }
                        continue;
                    }
                } catch (eMerge) { }
            }

            if (cloudVal !== localVal) {
                localStorage.setItem(k, cloudVal);
                hasChanges = true;
            }
        }

        // Sincronizzazione dinamica dei profili Cloud -> Locale
        try {
            if (cloudData.health_profiles) {
                const cloudPList = typeof cloudData.health_profiles === 'string' ? JSON.parse(cloudData.health_profiles) : cloudData.health_profiles;
                if (Array.isArray(cloudPList) && cloudPList.length > 0) {
                    let localPList = JSON.parse(localStorage.getItem('health_profiles') || '["marito", "moglie"]');
                    if (!Array.isArray(localPList)) localPList = ['marito', 'moglie'];

                    // Assicuriamoci che i profili nel cloud siano la lista autoritativa
                    const validProfiles = new Set(cloudPList);
                    validProfiles.add('marito');
                    validProfiles.add('moglie');
                    ['esempiocompleto', 'luigiscappa', 'a', 'salvatoresalva'].forEach(sp => validProfiles.delete(sp));

                    // Rimuovi da localStorage eventuali profili che sono stati eliminati dal Cloud
                    // Consolida qualsiasi pesata prima di pulizie
                    if (typeof window.consolidaProfiliSaluteLocale === 'function') {
                        window.consolidaProfiliSaluteLocale();
                    }

                    // Rimuovi da localStorage eventuali profili estranei (senza toccare gli alias di Maria Carmela)
                    for (let i = 0; i < localStorage.length; i++) {
                        const lk = localStorage.key(i);
                        if (lk && lk.startsWith('profileName_')) {
                            const pid = lk.replace('profileName_', '');
                            if (pid && !validProfiles.has(pid) && pid !== '1' && !pid.includes('maria') && pid !== 'moglie') {
                                localStorage.removeItem(lk);
                                localStorage.removeItem('profileStats_' + pid);
                                localStorage.removeItem('weightLog_' + pid);
                                localStorage.removeItem('syncTarget_' + pid);
                            }
                        }
                    }

                    const nextStoredArr = Array.from(validProfiles);
                    const isSameList = localPList.length === nextStoredArr.length && nextStoredArr.every(p => localPList.includes(p));
                    if (!isSameList) {
                        localStorage.setItem('health_profiles', JSON.stringify(nextStoredArr));
                        hasChanges = true;
                        profilesListChanged = true;
                    }
                }
            }
        } catch (ePl) {
            console.warn('Errore riconciliazione profili:', ePl);
        }

            localStorage.setItem('profileName_marito', 'Ciro Milella');
            localStorage.setItem('profileName_moglie', 'Maria Carmela');
            if (typeof window.consolidaProfiliSaluteLocale === 'function') {
                window.consolidaProfiliSaluteLocale();
            }

            if (hasChanges || forceRefresh) {
                console.log('☁️ Progetto Salute: Dati sincronizzati dal Cloud!');

                // NON ricaricare MAI la pagina con window.location.reload() in background
                // per evitare di interrompere l'utente mentre digita o naviga.
                // Aggiorna invece i componenti dinamicamente.
                if (typeof renderTabs === 'function' && typeof globalProfiles !== 'undefined') {
                    if (typeof renderTabs === 'function') {
                        try {
                            globalProfiles = JSON.parse(localStorage.getItem('health_profiles')) || ['marito', 'moglie'];
                            const vis = (typeof getVisibleHealthProfiles === 'function') ? getVisibleHealthProfiles() : globalProfiles;
                            let act = localStorage.getItem('activeProfile');
                            activeProfile = (act && globalProfiles.includes(act)) ? act : globalProfiles[0];
                            activeProfile = (act && vis.includes(act)) ? act : vis[0];
                            window.activeProfile = activeProfile;
                            renderTabs();
                            if (typeof renderProfiles === 'function') renderProfiles();
                        } catch (eR) { }
                    }

                    // Se l'utente sta digitando in un campo di input, non sovrascrivere la UI attiva
                    const activeEl = document.activeElement;
                    const isUserEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
                    if (!isUserEditing && typeof loadProgress === 'function') {
                        (JSON.parse(localStorage.getItem('health_profiles') || '["marito","moglie"]')).forEach(p => loadProgress(p));
                    }
                }
                return true;
            }
        } catch (err) {
            console.warn('☁️ Pull cloud error:', err);
            return false;
        }
        };

        // Sincronizzazione automatica all'avvio
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { setTimeout(() => window.pullSaluteFromCloud(false), 500); });
        } else {
            setTimeout(() => window.pullSaluteFromCloud(false), 500);
        }

        // 🔄 Sincronizzazione in tempo reale:
        // Polling a intervalli regolari (30s) per non stressare il browser né interrompere l'input
        setInterval(() => {
            if (!document.hidden && navigator.onLine) {
                const activeEl = document.activeElement;
                const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                if (!isEditing) {
                    window.pullSaluteFromCloud(false);
                }
            }
        }, 30000);

        // Quando l'utente torna sulla finestra (focus o tab attiva), sincronizza se non sta digitando
        window.addEventListener('focus', () => {
            if (navigator.onLine) {
                const activeEl = document.activeElement;
                const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                if (!isEditing) window.pullSaluteFromCloud(false);
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && navigator.onLine) {
                const activeEl = document.activeElement;
                const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                if (!isEditing) window.pullSaluteFromCloud(false);
            }
        });

        // =========================================================================
        // 🚀 CONTROLLI PESO SMART & GESTORE STORICO PESI
        // =========================================================================
        window.adjustQuickWeight = function (profile, delta) {
            const input = document.getElementById('weight-' + profile);
            if (!input) return;
            let cur = parseFloat(input.value) || 80.0;
            cur = Math.round((cur + delta) * 10) / 10;
            if (cur > 0) {
                input.value = cur.toFixed(1);
            }
        };

        window.openWeightHistoryManager = function (profile) {
            const key = 'weightLog_' + profile;
            const log = JSON.parse(localStorage.getItem(key)) || [];
            const profName = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName(profile) : profile;

            let modal = document.getElementById('weight-history-manager-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'weight-history-manager-modal';
                modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:99999; display:flex; justify-content:center; align-items:center; padding:15px;';
                document.body.appendChild(modal);
            }

            let itemsHtml = '';
            if (log.length === 0) {
                itemsHtml = '<p style="color:#94a3b8; text-align:center; padding:20px;">Nessuna pesata registrata.</p>';
            } else {
                const sortedLog = [...log].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                sortedLog.forEach((item) => {
                    itemsHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px;">
                    <div>
                        <strong style="font-size:1.05rem; color:#0f172a;">${item.date}</strong>
                        <span style="margin-left:12px; font-weight:800; font-size:1.15rem; color:#0284c7;">${item.weight} kg</span>
                    </div>
                    <button type="button" onclick="deleteWeightEntry('${profile}', '${item.date}', ${item.weight})" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:0.85rem; font-weight:700; cursor:pointer;">
                        🗑️ Elimina
                    </button>
                </div>
            `;
                });
            }

            modal.innerHTML = `
        <div style="background:#ffffff; border-radius:18px; width:100%; max-width:480px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.3); overflow:hidden;">
            <div style="padding:16px 20px; background:linear-gradient(135deg, #0f172a, #1e293b); color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; color:#f8fafc;">📋 Storico Pesi: ${profName}</h3>
                <button type="button" onclick="document.getElementById('weight-history-manager-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1;">
                <p style="font-size:0.85rem; color:#64748b; margin-top:0; margin-bottom:12px;">Qui puoi consultare o eliminare con 1 click qualsiasi pesata passata:</p>
                ${itemsHtml}
            </div>
            <div style="padding:12px 16px; background:#f1f5f9; text-align:right; border-top:1px solid #e2e8f0;">
                <button type="button" onclick="document.getElementById('weight-history-manager-modal').style.display='none'" style="background:#64748b; color:#fff; border:none; padding:8px 18px; border-radius:10px; font-weight:700; cursor:pointer;">Chiudi</button>
            </div>
        </div>
    `;
            modal.style.display = 'flex';
        };

        window.deleteWeightEntry = function (profile, dateStr, weightVal) {
            const msg = weightVal ? `Vuoi davvero cancellare la pesata del ${dateStr} (${weightVal} kg)?` : `Vuoi davvero cancellare la pesata del ${dateStr}?`;
            if (!confirm(msg)) return;
            const key = 'weightLog_' + profile;
            let log = JSON.parse(localStorage.getItem(key)) || [];
            log = log.filter(item => item && item.date !== dateStr);
            localStorage.setItem(key, JSON.stringify(log));

            // Registro cancellazione locale e cloud autoritativo
            const delKey = 'deletedWeights_' + profile;
            const delList = JSON.parse(localStorage.getItem(delKey) || '[]');
            if (!delList.includes(dateStr)) {
                delList.push(dateStr);
                localStorage.setItem(delKey, JSON.stringify(delList));
            }

            if (typeof loadProgress === 'function') loadProgress(profile);
            if (typeof window.refreshDashboardStats === 'function') window.refreshDashboardStats(profile);
            if (typeof window.syncSaluteToCloud === 'function') {
                window.syncSaluteToCloud({
                    [key]: JSON.stringify(log),
                    _forceWeightLog: true,
                    _deletedWeights: [{ profile, date: dateStr }]
                });
            }
            window.openWeightHistoryManager(profile);
            if (typeof showToast === 'function') showToast('Pesata rimossa con successo! 🗑️');
        };

        // Funzioni di regolazione e salvataggio per la modale di Modifica / Elimina
        window.adjustEditModalWeight = function (delta) {
            const input = document.getElementById('edit-modal-weight-input');
            if (!input) return;
            let val = parseFloat(input.value) || 80.0;
            val = Math.round((val + delta) * 10) / 10;
            if (val > 0) input.value = val.toFixed(1);
        };

        window.saveEditedWeightFromModal = function () {
            if (!window._pendingDelete) return;
            const { profile, label, value } = window._pendingDelete;
            const input = document.getElementById('edit-modal-weight-input');
            const newWeight = parseFloat(input.value);
            if (isNaN(newWeight) || newWeight <= 0) {
                alert("Inserisci un peso valido!");
                return;
            }

            const key = 'weightLog_' + profile;
            let log = JSON.parse(localStorage.getItem(key)) || [];
            const [dd, mm] = label.split('/');
            let foundIndex = -1;
            for (let i = log.length - 1; i >= 0; i--) {
                const logParts = log[i].date.split('-');
                if (logParts[2] === dd && logParts[1] === mm && (value === undefined || Math.abs(log[i].weight - parseFloat(value)) < 0.1 || log[i].weight === value)) {
                    foundIndex = i;
                    break;
                }
            }
            if (foundIndex === -1) {
                for (let i = log.length - 1; i >= 0; i--) {
                    const logParts = log[i].date.split('-');
                    if (logParts[2] === dd && logParts[1] === mm) {
                        foundIndex = i;
                        break;
                    }
                }
            }

            if (foundIndex !== -1) {
                log[foundIndex].weight = newWeight;
                localStorage.setItem(key, JSON.stringify(log));
                if (typeof showToast === 'function') showToast("Pesata modificata con successo! 💾");
                if (typeof loadProgress === 'function') loadProgress(profile);
                if (typeof window.refreshDashboardStats === 'function') window.refreshDashboardStats(profile);
                if (typeof window.syncSaluteToCloud === 'function') {
                    window.syncSaluteToCloud({
                        [key]: JSON.stringify(log),
                        _forceWeightLog: true
                    });
                }
            } else {
                alert("Impossibile trovare la pesata da modificare.");
            }

            closeDeleteModal();
        };

        // ========================================================
        // 🔍 VISUALIZZAZIONE IN GRANDE AL TOCCO SUL PUNTO DEL GRAFICO
        // ========================================================
        window.showChartPointFocus = function (profile, index) {
            const chart = charts[profile];
            if (!chart || !chart.data || !chart.data.labels) return;

            const label = chart.data.labels[index];
            const dataset = chart.data.datasets[0];
            if (!dataset || !dataset.data) return;
            const weight = dataset.data[index];

            const badge = document.getElementById(`chart-focus-badge-${profile}`);
            const dateEl = document.getElementById(`chart-focus-date-${profile}`);
            const weightEl = document.getElementById(`chart-focus-weight-${profile}`);
            const diffEl = document.getElementById(`chart-focus-diff-${profile}`);
            const manageBtn = document.getElementById(`chart-focus-manage-btn-${profile}`);

            if (!badge || !dateEl || !weightEl || !diffEl) return;

            // Formattazione data
            dateEl.innerHTML = `📅 Pesata del <b>${label}</b>`;
            weightEl.innerHTML = `${Number(weight).toFixed(1)} <span style="font-size:1.1rem; color:#94a3b8; font-weight:700;">kg</span>`;

            // Calcolo variazione rispetto alla pesata precedente nel grafico
            if (index > 0) {
                const prevWeight = dataset.data[index - 1];
                const diff = Math.round((weight - prevWeight) * 10) / 10;
                if (diff < 0) {
                    diffEl.innerHTML = `📉 ${diff.toFixed(1)} kg`;
                    diffEl.style.background = 'rgba(16, 185, 129, 0.2)';
                    diffEl.style.color = '#34d399';
                    diffEl.style.border = '1px solid #059669';
                } else if (diff > 0) {
                    diffEl.innerHTML = `📈 +${diff.toFixed(1)} kg`;
                    diffEl.style.background = 'rgba(239, 68, 68, 0.2)';
                    diffEl.style.color = '#f87171';
                    diffEl.style.border = '1px solid #dc2626';
                } else {
                    diffEl.innerHTML = `⚖️ Stabile (0.0 kg)`;
                    diffEl.style.background = 'rgba(148, 163, 184, 0.2)';
                    diffEl.style.color = '#cbd5e1';
                    diffEl.style.border = '1px solid #64748b';
                }
                diffEl.style.display = 'inline-block';
            } else {
                diffEl.innerHTML = `🏁 Inizio rilevazione`;
                diffEl.style.background = 'rgba(56, 189, 248, 0.2)';
                diffEl.style.color = '#38bdf8';
                diffEl.style.border = '1px solid #0284c7';
                diffEl.style.display = 'inline-block';
            }

            // Configurazione pulsante Gestisci (Modifica / Elimina)
            if (manageBtn) {
                manageBtn.onclick = function () {
                    window._pendingDelete = { profile, label, value: weight };
                    const modalText = document.getElementById('delete-modal-text');
                    const modalInput = document.getElementById('edit-modal-weight-input');
                    if (modalText) modalText.innerHTML = `Pesata del <b>${label}</b> (Attuale: <b>${weight} kg</b>)`;
                    if (modalInput) modalInput.value = weight;
                    const modal = document.getElementById('delete-modal');
                    if (modal) modal.style.display = 'flex';
                };
            }

            badge.style.display = 'block';
        };

        window.closeChartFocusBadge = function (profile) {
            const badge = document.getElementById(`chart-focus-badge-${profile}`);
            if (badge) badge.style.display = 'none';
        };

        // Riconfigurazione interattiva su click e tocco per i grafici
        (function () {
            function attachChartTouchListeners(profile) {
                const canvas = document.getElementById(`chart-${profile}`);
                if (!canvas) return;

                function handlePointer(evt) {
                    const chart = charts[profile];
                    if (!chart) return;
                    const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                    if (points && points.length > 0) {
                        const firstPoint = points[0];
                        window.showChartPointFocus(profile, firstPoint.index);
                    }
                }

                canvas.onclick = handlePointer;
                // Su mobile touchstart/pointerup garantisce immediata risposta
                canvas.onpointerup = handlePointer;
            }

            const prevDraw = drawChart;
            drawChart = function (profile, log, startWeight) {
                prevDraw(profile, log, startWeight);
                attachChartTouchListeners(profile);
            };
        })();

        // ========================================================
        // 💧 QUICK WATER TAP (AGGIUNGI 1 BICCHIERE IN UN CLIC)
        // ========================================================
        window.addQuickWater = function (profile) {
            if (typeof updateBeverage === 'function') {
                updateBeverage(profile, 'water', 1);
            }
            window.refreshQuickWaterDisplay(profile);
            if (typeof showToast === 'function') showToast("💧 +1 Bicchiere d'acqua registrato! Ottimo lavoro!");
        };

        window.refreshQuickWaterDisplay = function (profile) {
            const key = 'waterCount_' + profile;
            const count = parseInt(localStorage.getItem(key)) || 0;
            const el = document.getElementById('quick-water-count-' + profile);
            if (el) {
                let max = 8;
                if (typeof getPersonalizedWaterTarget === 'function') {
                    max = getPersonalizedWaterTarget(profile).glasses;
                }
                el.innerHTML = `<b>${count}</b> / ${max} bicchieri (${(count * 0.25).toFixed(1)}L)`;
            }
        };

        // ========================================================
        // 🍽️ VISTA RAPIDA "COSA C'È NEL PIATTO OGGI"
        // ========================================================
        window.refreshTodayMealBox = function (profile) {
            const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
            const now = new Date();
            const dayIndex = now.getDay(); // 0 = Domenica, 1 = Lunedì...
            const dayName = dayNames[dayIndex];

            const titleEl = document.getElementById('today-meal-dayname-' + profile);
            const lunchEl = document.getElementById('today-lunch-' + profile);
            const dinnerEl = document.getElementById('today-dinner-' + profile);

            if (titleEl) titleEl.innerText = `Menù di Oggi (${dayName})`;

            const section = document.getElementById('section-' + profile);
            if (!section) return;
            const table = section.querySelector('.weekly-table');
            if (!table) return;

            // Le righe della tabella sono in ordine: Lunedì (0), Martedì (1), ..., Domenica (6)
            // Se dayIndex è 0 (Domenica), la riga corrispondente è la 6. Altrimenti dayIndex - 1.
            const tableRowIndex = (dayIndex === 0) ? 6 : (dayIndex - 1);
            const rows = table.querySelectorAll('tbody tr');
            if (rows && rows[tableRowIndex]) {
                const cells = rows[tableRowIndex].querySelectorAll('td');
                if (cells.length >= 3) {
                    const lunchText = cells[1].innerText.trim() || 'Nessun pranzo indicato';
                    const dinnerText = cells[2].innerText.trim() || 'Nessuna cena indicata';
                    if (lunchEl) lunchEl.innerHTML = lunchText;
                    if (dinnerEl) dinnerEl.innerHTML = dinnerText;
                }
            }
        };

        // ========================================================
        // 🚀 STIMA INTELLIGENTE DATA TRAGUARDO
        // ========================================================
        window.calculateGoalPrediction = function (profile, currentWeight, goalWeight, log) {
            const el = document.getElementById('goal-prediction-' + profile);
            if (!el) return;

            if (!log || log.length < 2) {
                el.innerHTML = `🎯 Inserisci qualche pesata nei prossimi giorni per calcolare la stima del traguardo!`;
                return;
            }

            if (currentWeight <= goalWeight) {
                el.innerHTML = `🏆 <b>Traguardo raggiunto!</b> Sei arrivato/a al tuo peso obiettivo (${goalWeight} kg)! 🎉`;
                return;
            }

            // Calcolo velocità di perdita negli ultimi 14-30 giorni
            const firstLog = log[0];
            const daysElapsed = Math.max(1, (new Date().getTime() - (firstLog.timestamp || new Date(firstLog.date).getTime())) / (1000 * 60 * 60 * 24));
            const totalLost = firstLog.weight - currentWeight;

            if (totalLost <= 0) {
                el.innerHTML = `🎯 Mancano <b>${(currentWeight - goalWeight).toFixed(1)} kg</b> all'obiettivo. Mantieni la costanza! 💪`;
                return;
            }

            const ratePerDay = totalLost / daysElapsed; // kg persi al giorno
            const kgRemaining = currentWeight - goalWeight;
            const daysNeeded = Math.round(kgRemaining / ratePerDay);

            if (daysNeeded > 0 && daysNeeded < 365 * 2) {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + daysNeeded);
                const options = { day: 'numeric', month: 'long', year: 'numeric' };
                const formattedDate = targetDate.toLocaleDateString('it-IT', options);
                el.innerHTML = `🚀 A questo ritmo (-${(ratePerDay * 7).toFixed(1)} kg/settimana), traguardo stimato: <b>${formattedDate}</b>!`;
            } else {
                el.innerHTML = `🎯 Mancano <b>${kgRemaining.toFixed(1)} kg</b> all'obiettivo (${goalWeight} kg). Avanti così!`;
            }
        };

        // Intercettiamo loadProgress per aggiornare l'idratazione rapida, il pasto di oggi e la predizione
        (function () {
            const origLoadProgress = loadProgress;
            loadProgress = function (profile) {
                origLoadProgress(profile);
                window.refreshQuickWaterDisplay(profile);
                window.refreshTodayMealBox(profile);

                const key = `weightLog_${profile}`;
                const log = JSON.parse(localStorage.getItem(key)) || [];
                const curW = log.length > 0 ? log[log.length - 1].weight : parseFloat(document.getElementById('start_' + profile)?.innerText) || 80;
                const goalW = parseFloat(document.getElementById('goal_' + profile)?.innerText) || 65;
                window.calculateGoalPrediction(profile, curW, goalW, log);
            };
        })();

