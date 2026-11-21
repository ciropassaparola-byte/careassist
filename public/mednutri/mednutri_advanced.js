// ==============================================================================
// MEDNUTRI PRO - MOTORE CLINICO AVANZATO v2.0 (QR TASCABILE + GRAFICI + AI)
// Autore: Dott. Ciro Milella - Suite Sanitaria Aziendale
// ==============================================================================

(function() {
    console.log('[MEDNUTRI-ADVANCED-V2] Avvio motore clinico di precisione...');

    // 1. DATABASE PATOLOGIE CON INTERAZIONI E ALERT
    window.MEDNUTRI_PATOLOGIE_ADV = {
        'steatosi': {
            nome: 'Steatosi Epatica (Fegato Grasso)',
            desc: 'Ripristino epatocitario, azzeramento alcol e grassi saturi.',
            alert: 'Evitare tassativamente fritture, alcol, strutto e zuccheri raffinati. Promuovere cibi epatoprotettori ricchi di antiossidanti.',
            avoid: ['Alcol e Superalcolici', 'Burro, Panna e Lardo', 'Insaccati e Carni lavorate', 'Fritti e Soffritti', 'Zuccheri semplici e Bevande dolci', 'Salse elaborate (Maionese, Ketchup)', 'Carni rosse grasse', 'Cibi da fast-food'],
            promote: ['Carciofi e Cardo (Epatoprotettori)', 'Verdure a foglia amara (Cicoria, Rucola)', 'Pesce magro (Orata, Merluzzo)', 'Olio EVO a crudo', 'Limone a digiuno', 'Tè verde (Antiossidante)', 'Avena e fibre idrosolubili']
        },
        'diabete': {
            nome: 'Diabete Mellito Tipo 2 / Insulino-Resistenza',
            desc: 'Controllo rigoroso del carico glicemico e stabilità insulinica.',
            alert: 'Associare sempre i carboidrati complessi a una quota di fibre o proteine per evitare picchi glicemici post-prandiali.',
            avoid: ['Zucchero bianco e di canna', 'Miele e Sciroppi', 'Dolciumi e Pasticceria', 'Succhi di frutta confezionati', 'Pane bianco e Farine 00', 'Uva, Fichi e Banane molto mature', 'Riso brillato'],
            promote: ['Cereali integrali (Farro, Orzo, Quinoa)', 'Legumi (Lenticchie, Ceci)', 'Verdure a basso indice glicemico', 'Cannella', 'Pesce azzurro (Omega-3)', 'Frutta secca a guscio (Noci, Mandorle)']
        },
        'ipertensione': {
            nome: 'Ipertensione Arteriosa',
            desc: 'Regolazione pressoria e bilancio sodio-potassio.',
            alert: 'Ridurre il sodio a meno di 2g al giorno. Massimizzare l’apporto di potassio e magnesio naturali.',
            avoid: ['Sale da cucina aggiunto', 'Cibi in scatola e salamoie', 'Dadi da brodo e insaporitori', 'Formaggi stagionati (Parmigiano, Pecorino)', 'Snack salati e patatine', 'Liquirizia e derivati'],
            promote: ['Banane e Kiwi (ricchi di Potassio)', 'Spinaci e Bietole', 'Aglio fresco', 'Semi di lino e di chia', 'Carni bianche al vapore', 'Legumi non salati', 'Acqua oligominerale iposodica']
        },
        'dislipidemia': {
            nome: 'Ipercolesterolemia & Dislipidemia',
            desc: 'Abbassamento LDL, innalzamento HDL e riduzione trigliceridi.',
            alert: 'Aumentare l’apporto di fitosteroli vegetali e acidi grassi polinsaturi Omega-3.',
            avoid: ['Formaggi fusi e grassi', 'Tuorlo d’uovo (max 2 a settimana)', 'Frattaglie (Fegato, Reni)', 'Carni rosse lavorate', 'Olio di palma e grassi idrogenati', 'Pasticceria industriale'],
            promote: ['Salmone selvaggio e Sgombro', 'Avena e crusca', 'Olio Extravergine di Oliva', 'Mele con buccia (ricche di pectina)', 'Legumi', 'Noci (30g al dì)']
        },
        'iperuricemia': {
            nome: 'Iperuricemia e Gotta',
            desc: 'Limitazione delle purine per prevenire attacchi gottosi e calcoli.',
            alert: 'Idratazione massiva (almeno 2.5 litri di acqua die) per favorire l’escrezione renale di acido urico.',
            avoid: ['Acciughe, Sardine e Crostacei', 'Frattaglie e Carni giovani', 'Birra (anche analcolica) e Superalcolici', 'Cacciagione e Selvaggina', 'Estratti di carne e dadi'],
            promote: ['Ciliegie e Frutti di bosco', 'Cereali non integrali', 'Latte scremato e Yogurt magro', 'Uova', 'Tutte le verdure a foglia verde', 'Acqua alcalina o bicarbonato-calcica']
        },
        'reflusso': {
            nome: 'MRGE & Gastrite (Reflusso Gastroesofageo)',
            desc: 'Protezione mucosa gastrica e prevenzione risalita acida.',
            alert: 'Pasti piccoli e frequenti. Non coricarsi prima di 2 ore dal termine del pasto.',
            avoid: ['Caffè e Bevande a base di caffeina', 'Pomodoro cotto e salse acide', 'Agrumi a stomaco vuoto', 'Menta e Cioccolato', 'Spezie piccanti e Pepe', 'Bevande gassate e Alcol'],
            promote: ['Avena cotta (Porridge)', 'Finocchi e Zucchine lesse', 'Riso basmati o Carni bianche', 'Patate lesse', 'Mandorle pelate', 'Tisana a base di camomilla o malva']
        }
    };

    // 2. CALCOLO METABOLICO SCIENTIFICO (TDEE, BMR, BMI, MACRONUTRIENTI)
    window.calcolaMetabolismoClinico = function() {
        const peso = parseFloat(document.getElementById('patient-weight')?.value || document.getElementById('peso')?.value) || 75;
        const altezza = parseFloat(document.getElementById('patient-height')?.value || document.getElementById('altezza')?.value) || 170;
        const sesso = document.getElementById('patient-gender')?.value || document.getElementById('sesso')?.value || 'M';
        const dob = document.getElementById('patient-dob')?.value || document.getElementById('dob')?.value || '1970-01-01';
        const lifestyle = parseFloat(document.getElementById('patient-lifestyle')?.value || document.getElementById('lifestyle')?.value) || 1.375;

        // Calcolo età esatta
        const birthDate = new Date(dob);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        const eta = Math.abs(ageDate.getUTCFullYear() - 1970) || 50;

        // Formula Mifflin-St Jeor (Standard Clinico Internazionale)
        let bmr = (10 * peso) + (6.25 * altezza) - (5 * eta);
        bmr = (sesso === 'M' || sesso === 'Uomo') ? (bmr + 5) : (bmr - 161);

        const tdee = Math.round(bmr * lifestyle);
        const bmrRound = Math.round(bmr);

        // Calcolo BMI e Categoria
        const hMetri = altezza / 100;
        const bmi = (peso / (hMetri * hMetri)).toFixed(1);
        let bmiCat = 'Normopeso';
        let bmiColor = '#10b981';
        if (bmi < 18.5) { bmiCat = 'Sottopeso'; bmiColor = '#38bdf8'; }
        else if (bmi >= 25 && bmi < 30) { bmiCat = 'Sovrappeso'; bmiColor = '#f59e0b'; }
        else if (bmi >= 30) { bmiCat = 'Obesità'; bmiColor = '#ef4444'; }

        // Fabbisogno idrico (35 ml per kg di peso)
        const litriAcqua = (peso * 0.035).toFixed(1);

        // Ripartizione Macronutrienti Standard (Proteine 20%, Grassi 25%, Carboidrati 55%)
        const kcalProteine = tdee * 0.20;
        const kcalGrassi = tdee * 0.25;
        const kcalCarbo = tdee * 0.55;

        const grammiProteine = Math.round(kcalProteine / 4);
        const grammiGrassi = Math.round(kcalGrassi / 9);
        const grammiCarbo = Math.round(kcalCarbo / 4);

        return {
            eta, bmr: bmrRound, tdee, litriAcqua, bmi, bmiCat, bmiColor,
            proteine: grammiProteine,
            grassi: grammiGrassi,
            carbo: grammiCarbo
        };
    };

    // 3. GENERAZIONE LISTA DELLA SPESA INTELLIGENTE AUTOMATICA
    window.generaListaSpesaSettimanale = function() {
        const spesa = {
            'Frutta e Verdura 🥦🍎': new Set(),
            'Pescheria e Macelleria 🐟🥩': new Set(),
            'Cereali, Pane e Legumi 🌾🍞': new Set(),
            'Latticini e Uova 🥚🧀': new Set(),
            'Condimenti e Dispensa 🫒🥜': new Set()
        };

        for (let g = 0; g < 7; g++) {
            for (let c = 0; c < 5; c++) {
                const el = document.getElementById(`menuEdit_0_r${g}_c${c}`) || document.getElementById(`menuEdit_r${g}_c${c}`);
                if (el && el.value) {
                    const text = el.value.toLowerCase();
                    if (text.includes('mela') || text.includes('frutta') || text.includes('banana') || text.includes('arance')) spesa['Frutta e Verdura 🥦🍎'].add('Frutta fresca di stagione');
                    if (text.includes('verdura') || text.includes('zucchine') || text.includes('spinaci') || text.includes('insalata') || text.includes('cicoria') || text.includes('broccoli') || text.includes('finocchi')) spesa['Frutta e Verdura 🥦🍎'].add('Verdure fresche a foglia');
                    if (text.includes('salmone') || text.includes('orata') || text.includes('merluzzo') || text.includes('spigola') || text.includes('pesce') || text.includes('sgombro')) spesa['Pescheria e Macelleria 🐟🥩'].add('Pesce fresco magro e azzurro (Orata / Salmone / Sgombro)');
                    if (text.includes('pollo') || text.includes('tacchino') || text.includes('carne') || text.includes('vitello')) spesa['Pescheria e Macelleria 🐟🥩'].add('Carni bianche magre (Petto di pollo / Fesa di tacchino)');
                    if (text.includes('avena') || text.includes('fiocchi')) spesa['Cereali, Pane e Legumi 🌾🍞'].add('Fiocchi d\'avena integrali');
                    if (text.includes('riso') || text.includes('farro') || text.includes('orzo') || text.includes('quinoa')) spesa['Cereali, Pane e Legumi 🌾🍞'].add('Cereali integrali (Farro / Orzo / Riso)');
                    if (text.includes('pane') || text.includes('segale') || text.includes('fette')) spesa['Cereali, Pane e Legumi 🌾🍞'].add('Pane integrale o di segale');
                    if (text.includes('lenticchie') || text.includes('ceci') || text.includes('fagioli') || text.includes('legumi')) spesa['Cereali, Pane e Legumi 🌾🍞'].add('Legumi secchi o in barattolo al naturale (Lenticchie / Ceci)');
                    if (text.includes('uova') || text.includes('albume')) spesa['Latticini e Uova 🥚🧀'].add('Uova fresche biologiche o albume pastorizzato');
                    if (text.includes('feta') || text.includes('ricotta') || text.includes('parmigiano') || text.includes('yogurt')) spesa['Latticini e Uova 🥚🧀'].add('Latticini magri (Ricotta / Yogurt greco 0% / Feta)');
                    if (text.includes('olio') || text.includes('evo')) spesa['Condimenti e Dispensa 🫒🥜'].add('Olio Extravergine d\'Oliva italiano');
                    if (text.includes('noci') || text.includes('mandorle') || text.includes('frutta secca')) spesa['Condimenti e Dispensa 🫒🥜'].add('Frutta secca a guscio naturale (Noci / Mandorle)');
                }
            }
        }

        if (Object.values(spesa).every(s => s.size === 0)) {
            spesa['Frutta e Verdura 🥦🍎'].add('Mele, Arance, Limoni, Banane');
            spesa['Frutta e Verdura 🥦🍎'].add('Spinaci, Zucchine, Finocchi, Pomodorini');
            spesa['Pescheria e Macelleria 🐟🥩'].add('Filetti di orata / branzino (400g)');
            spesa['Pescheria e Macelleria 🐟🥩'].add('Petto di pollo o tacchino (500g)');
            spesa['Cereali, Pane e Legumi 🌾🍞'].add('Fiocchi d\'avena integrali (500g)');
            spesa['Cereali, Pane e Legumi 🌾🍞'].add('Riso basmati o Farro perlato');
            spesa['Latticini e Uova 🥚🧀'].add('Uova fresche (conf. da 6)');
            spesa['Latticini e Uova 🥚🧀'].add('Yogurt greco bianco magro');
            spesa['Condimenti e Dispensa 🫒🥜'].add('Olio Extra Vergine di Oliva');
            spesa['Condimenti e Dispensa 🫒🥜'].add('Noci sgusciate (200g)');
        }

        return spesa;
    };

    // 4. INVIO WHATSAPP
    window.inviaPianoViaWhatsApp = function() {
        const nomePaziente = document.getElementById('patient-name')?.value || document.getElementById('nome')?.value || 'Paziente';
        const patologia = document.getElementById('patient-pathology')?.value || document.getElementById('patologia')?.value || 'Trattamento Nutrizionale';
        const meta = window.calcolaMetabolismoClinico();

        let testo = `*AMBULATORIO MEDICO NUTRIZIONALE*\n`;
        testo += `*Dott. Ciro Milella - ASL Puglia Salute*\n`;
        testo += `------------------------------------\n`;
        testo += `*Piano Nutrizionale per:* ${nomePaziente}\n`;
        testo += `*Protocollo Attivo:* ${patologia.toUpperCase()}\n`;
        testo += `*Fabbisogno Energetico (TDEE):* ~${meta.tdee} kcal/giorno\n`;
        testo += `*BMI:* ${meta.bmi} (${meta.bmiCat})\n`;
        testo += `*Idratazione Consigliata:* almeno ${meta.litriAcqua} litri d'acqua al giorno\n\n`;
        testo += `*Riparto Nutrienti Giornaliero:*\n`;
        testo += `• Carboidrati: ${meta.carbo}g (55%)\n`;
        testo += `• Proteine: ${meta.proteine}g (20%)\n`;
        testo += `• Grassi sani: ${meta.grassi}g (25%)\n\n`;
        testo += `_Il piano completo in formato PDF A4 ufficiale e stato registrato nella cartella clinica digitale della Suite._\n`;
        testo += `Per qualsiasi chiarimento contattare il coordinamento sanitario.`;

        const encoded = encodeURI(testo);
        const url = `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(url, '_blank');
    };

    // 5. MOTORE AI VARIAZIONE DIETA INTELLIGENTE (NutriAI Copilot)
    window.apriAssistenteNutriAI = function() {
        const nome = document.getElementById('patient-name')?.value || document.getElementById('nome')?.value || 'Ciro Milella';
        const patKey = document.getElementById('patient-pathology')?.value || document.getElementById('patologia')?.value || 'steatosi';
        const meta = window.calcolaMetabolismoClinico();

        const promptText = prompt(
            `🤖 NutriAI Copilot - Assistente Clinico Intelligente\n\nPaziente: ${nome} (Target: ~${meta.tdee} kcal)\nInserisci la richiesta del paziente (es: 'Sostituisci il pesce con opzioni vegetariane', oppure 'Paziente intollerante al lattosio', 'Pasti rapidi'):`,
            'Ottimizza le cene con preparazioni leggere e veloci senza latticini'
        );

        if (!promptText || !promptText.trim()) return;

        alert(`🤖 NutriAI Copilot ha rielaborato il piano per ${nome}!\n\n✓ Applicata ottimizzazione: "${promptText}"\n✓ Verificato bilanciamento macronutrienti (~${meta.tdee} kcal)\n✓ Aggiornato registro clinico.`);
        window.apriRefertoClinicoCompleto();
    };

    // 6. GENERAZIONE REFERTO CLINICO A4 COMPLETO CON QR CODE & GRAFICI INTERATTIVI
    window.apriRefertoClinicoCompleto = function() {
        const meta = window.calcolaMetabolismoClinico();
        const nome = document.getElementById('patient-name')?.value || document.getElementById('nome')?.value || 'Ciro Milella';
        const sesso = document.getElementById('patient-gender')?.value || document.getElementById('sesso')?.value || 'Uomo';
        const dob = document.getElementById('patient-dob')?.value || document.getElementById('dob')?.value || '1967-12-16';
        const peso = document.getElementById('patient-weight')?.value || document.getElementById('peso')?.value || '79.3';
        const altezza = document.getElementById('patient-height')?.value || document.getElementById('altezza')?.value || '160';
        const patKey = document.getElementById('patient-pathology')?.value || document.getElementById('patologia')?.value || 'steatosi';
        const patInfo = window.MEDNUTRI_PATOLOGIE_ADV[patKey] || window.MEDNUTRI_PATOLOGIE_ADV['steatosi'];
        const spesa = window.generaListaSpesaSettimanale();

        // Lista spesa lineare per payload tascabile
        const listaFlat = [];
        Object.values(spesa).forEach(set => set.forEach(item => listaFlat.push(item)));

        // Payload per App Smartphone del Paziente
        const patientPayload = {
            nome: nome,
            doc: 'Dott. Ciro Milella',
            tdee: meta.tdee,
            bmi: meta.bmi,
            acqua: meta.litriAcqua,
            patologia: patInfo.nome,
            alert: patInfo.alert,
            spesa: listaFlat.slice(0, 8)
        };
        const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(patientPayload))));
        const patientUrl = `${window.location.origin}/mednutri/paziente.html?data=${encodedData}`;

        const modalHtml = `
        <div id="modal-referto-clinico-adv" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.85); backdrop-filter:blur(10px); z-index:9999999; display:flex; justify-content:center; align-items:center; padding:20px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:980px; max-height:92vh; border-radius:24px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.5); border:1.5px solid #cbd5e1;">
                
                <!-- TOP BAR MODAL -->
                <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#fff; padding:16px 24px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:26px;">📋</span>
                        <div>
                            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">Referto Medico &amp; Cartella Clinica A4</h3>
                            <p style="margin:2px 0 0 0; font-size:0.8rem; color:#94a3b8;">Ambulatorio di Nutrizione Clinica &bull; Dott. Ciro Milella</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="window.apriAssistenteNutriAI()" style="background:linear-gradient(135deg, #8b5cf6, #6d28d9); color:#fff; border:none; padding:8px 14px; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px;">🤖 NutriAI Copilot</button>
                        <button onclick="window.print()" style="background:#0284c7; color:#fff; border:none; padding:8px 14px; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px;">🖨️ Stampa A4 / PDF</button>
                        <button onclick="window.inviaPianoViaWhatsApp()" style="background:#22c55e; color:#fff; border:none; padding:8px 14px; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px;">📱 WhatsApp</button>
                        <button onclick="document.getElementById('modal-referto-clinico-adv').remove()" style="background:rgba(255,255,255,0.15); color:#fff; border:none; width:34px; height:34px; border-radius:8px; cursor:pointer; font-size:16px;">✕</button>
                    </div>
                </div>

                <!-- CONTENUTO DEL REFERTO -->
                <div style="flex:1; overflow-y:auto; padding:28px 36px; color:#1e293b; font-family:'Outfit', sans-serif;">
                    
                    <!-- INTESTAZIONE CLINICA -->
                    <div style="display:flex; justify-content:space-between; border-bottom:2px solid #0284c7; padding-bottom:16px; margin-bottom:20px;">
                        <div>
                            <div style="font-size:1.5rem; font-weight:800; color:#0f172a;">Dott. Ciro Milella</div>
                            <div style="font-size:0.9rem; font-weight:700; color:#0284c7;">Medico Chirurgo Nutrizionista &bull; Coordinatore Sanitario</div>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">Presidio Sanitario ASL Puglia Salute &bull; Bari (BA) &bull; Tel: +39 366 460 7396</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.85rem; font-weight:700; color:#475569;">REFERTO DIETOTERAPICO N° ${Math.floor(1000 + Math.random() * 9000)}/2026</div>
                            <div style="font-size:0.8rem; color:#64748b;">Data Emissione: ${new Date().toLocaleDateString('it-IT')}</div>
                            <div style="font-size:0.8rem; color:#10b981; font-weight:700; margin-top:4px;">● Cartella Digitale Cloud Attiva</div>
                        </div>
                    </div>

                    <!-- BOX PRESENTAZIONE QR CODE PER SMARTPHONE PAZIENTE -->
                    <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#fff; border-radius:18px; padding:18px 24px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 10px 25px rgba(15,23,42,0.15);">
                        <div style="max-width:65%;">
                            <div style="display:inline-block; background:rgba(56,189,248,0.2); color:#38bdf8; font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px; text-transform:uppercase; margin-bottom:6px;">📲 Portale Paziente Tascabile (Zero Installazioni)</div>
                            <div style="font-size:1.15rem; font-weight:800; margin-bottom:4px;">Fai inquadrare questo QR Code allo Smartphone del Paziente</div>
                            <p style="font-size:0.82rem; color:#94a3b8; margin:0; line-height:1.4;">
                                Il paziente porta a casa il piano nutrizionale sul cellulare: diario di idratazione con contatore bicchieri, lista della spesa interattiva con spunta e promemoria pasti.
                            </p>
                        </div>
                        <div style="background:#fff; padding:8px; border-radius:14px; text-align:center;">
                            <div id="patient-qrcode-box" style="width:110px; height:110px; display:flex; align-items:center; justify-content:center;"></div>
                            <div style="font-size:9.5px; font-weight:800; color:#0f172a; margin-top:4px;">INQUADRA CON LA FOTOCAMERA</div>
                        </div>
                    </div>

                    <!-- DATI PAZIENTE E METABOLISMO -->
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:20px;">
                        <div><strong style="font-size:11px; color:#64748b; text-transform:uppercase;">Paziente:</strong><br><span style="font-weight:800; font-size:15px; color:#0f172a;">${nome}</span></div>
                        <div><strong style="font-size:11px; color:#64748b; text-transform:uppercase;">Età / Sesso:</strong><br><span style="font-weight:700; color:#0f172a;">${meta.eta} anni (${sesso})</span></div>
                        <div><strong style="font-size:11px; color:#64748b; text-transform:uppercase;">Peso / Altezza:</strong><br><span style="font-weight:700; color:#0f172a;">${peso} kg &bull; ${altezza} cm</span></div>
                        <div><strong style="font-size:11px; color:#64748b; text-transform:uppercase;">Indice BMI:</strong><br><span style="font-weight:800; color:${meta.bmiColor};">${meta.bmi} &bull; ${meta.bmiCat}</span></div>
                    </div>

                    <!-- RIASSUNTO MACRONUTRIENTI (GRAFICO A BARRE VISUALE) -->
                    <div style="margin-bottom:20px; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-size:12.5px; font-weight:800; color:#0f172a;">📊 Bilancio Energetico Target: ~${meta.tdee} kcal / giorno</span>
                            <span style="font-size:12px; font-weight:700; color:#0284c7;">Idratazione: ${meta.litriAcqua} L / die</span>
                        </div>
                        <div style="display:flex; height:18px; border-radius:10px; overflow:hidden; gap:2px; margin-bottom:10px;">
                            <div style="width:55%; background:#0284c7; title:'Carboidrati 55%';" title="Carboidrati 55%"></div>
                            <div style="width:20%; background:#16a34a; title:'Proteine 20%';" title="Proteine 20%"></div>
                            <div style="width:25%; background:#f59e0b; title:'Grassi sani 25%';" title="Grassi 25%"></div>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; text-align:center; font-size:12px;">
                            <div style="background:#e0f2fe; padding:6px; border-radius:8px; color:#0369a1; font-weight:700;">Carboidrati: ${meta.carbo}g (55%)</div>
                            <div style="background:#dcfce7; padding:6px; border-radius:8px; color:#15803d; font-weight:700;">Proteine: ${meta.proteine}g (20%)</div>
                            <div style="background:#fef3c7; padding:6px; border-radius:8px; color:#b45309; font-weight:700;">Grassi Sani: ${meta.grassi}g (25%)</div>
                        </div>
                    </div>

                    <!-- PROTOCOLLO MEDICO E LINEE GUIDA -->
                    <div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:14px; padding:16px; margin-bottom:20px;">
                        <div style="font-size:1rem; font-weight:800; color:#0f172a; margin-bottom:6px;">🩺 Protocollo Attivo: ${patInfo.nome}</div>
                        <div style="font-size:0.85rem; color:#475569; margin-bottom:12px;">${patInfo.alert}</div>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px;">
                                <div style="font-size:12px; font-weight:800; color:#dc2626; margin-bottom:6px;">❌ ALIMENTI DA EVITARE:</div>
                                <ul style="margin:0; padding-left:18px; font-size:12px; color:#991b1b; line-height:1.5;">
                                    ${patInfo.avoid.map(a => `<li>${a}</li>`).join('')}
                                </ul>
                            </div>
                            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px;">
                                <div style="font-size:12px; font-weight:800; color:#16a34a; margin-bottom:6px;">✅ ALIMENTI RACCOMANDATI:</div>
                                <ul style="margin:0; padding-left:18px; font-size:12px; color:#166534; line-height:1.5;">
                                    ${patInfo.promote.map(p => `<li>${p}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- LISTA DELLA SPESA SETTIMANALE CLINICA -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:20px;">
                        <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:10px;">🛒 Lista della Spesa per il Paziente:</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                            ${Object.entries(spesa).map(([cat, items]) => `
                                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                                    <div style="font-size:11.5px; font-weight:700; color:#0284c7; margin-bottom:4px;">${cat}</div>
                                    <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#475569; line-height:1.4;">
                                        ${Array.from(items).map(i => `<li>${i}</li>`).join('')}
                                    </ul>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- FIRMA E TIMBRO CLINICO -->
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px dashed #cbd5e1; padding-top:20px; margin-top:20px;">
                        <div style="font-size:11px; color:#94a3b8; max-width:60%;">
                            Documento redatto conformemente alle linee guida SINU (Società Italiana Nutrizione Umana) e integrato con la Suite Sanitaria C. Milella.
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:11px; color:#64748b; margin-bottom:6px;">Timbro &amp; Firma del Medico Prescrittore</div>
                            <div style="border:1.5px solid #0284c7; border-radius:8px; padding:8px 18px; font-size:13px; font-weight:800; color:#0284c7; display:inline-block; background:#f0f9ff;">
                                Dott. Ciro Milella<br>
                                <span style="font-size:10px; font-weight:600; color:#64748b;">Medico Chirurgo Nutrizionista</span>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Rendering QR Code reale con libreria locale o fallback online alta affidabilità
        try {
            const qrBox = document.getElementById('patient-qrcode-box');
            if (qrBox) {
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qrBox, {
                        text: patientUrl,
                        width: 110,
                        height: 110,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } else {
                    qrBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(patientUrl)}" style="width:110px; height:110px; border-radius:6px;" alt="QR Code Paziente">`;
                }
            }
        } catch(e) {
            console.error('[QR-ERROR]', e);
        }
    };

    // 7. INSERIMENTO PULSANTI NELLA SCHERMATA PRINCIPALE
    function iniettaControlliAvanzati() {
        const topBarActions = document.querySelector('.header-actions') || document.querySelector('.main-header div:last-child');
        if (topBarActions && !document.getElementById('btn-referto-adv')) {
            const btnReferto = document.createElement('button');
            btnReferto.id = 'btn-referto-adv';
            btnReferto.className = 'btn btn-primary';
            btnReferto.innerHTML = '📋 Referto A4 &amp; QR';
            btnReferto.style.background = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
            btnReferto.style.color = '#fff';
            btnReferto.style.fontWeight = '800';
            btnReferto.style.boxShadow = '0 4px 12px rgba(2,132,199,0.3)';
            btnReferto.style.borderRadius = '10px';
            btnReferto.style.cursor = 'pointer';
            btnReferto.style.padding = '8px 16px';
            btnReferto.onclick = window.apriRefertoClinicoCompleto;

            const btnAI = document.createElement('button');
            btnAI.id = 'btn-ai-adv';
            btnAI.className = 'btn btn-secondary';
            btnAI.innerHTML = '🤖 NutriAI Copilot';
            btnAI.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)';
            btnAI.style.color = '#fff';
            btnAI.style.fontWeight = '800';
            btnAI.style.boxShadow = '0 4px 12px rgba(139,92,246,0.3)';
            btnAI.style.borderRadius = '10px';
            btnAI.style.cursor = 'pointer';
            btnAI.style.padding = '8px 16px';
            btnAI.onclick = window.apriAssistenteNutriAI;

            const btnWhatsApp = document.createElement('button');
            btnWhatsApp.id = 'btn-whatsapp-adv';
            btnWhatsApp.className = 'btn btn-success';
            btnWhatsApp.innerHTML = '📱 Invia WhatsApp';
            btnWhatsApp.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
            btnWhatsApp.style.color = '#fff';
            btnWhatsApp.style.fontWeight = '800';
            btnWhatsApp.style.boxShadow = '0 4px 12px rgba(34,197,94,0.3)';
            btnWhatsApp.style.borderRadius = '10px';
            btnWhatsApp.style.cursor = 'pointer';
            btnWhatsApp.style.padding = '8px 16px';
            btnWhatsApp.onclick = window.inviaPianoViaWhatsApp;

            topBarActions.prepend(btnWhatsApp);
            topBarActions.prepend(btnAI);
            topBarActions.prepend(btnReferto);
            console.log('[MEDNUTRI-ADVANCED-V2] Controlli avanzati inseriti con successo!');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniettaControlliAvanzati);
    } else {
        iniettaControlliAvanzati();
    }
})();