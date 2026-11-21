const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3030;

// Inizializza il client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true, // Let's use true for now
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

let isClientReady = false;

client.on('qr', (qr) => {
    // Genera il QR code nel terminale per l'autenticazione iniziale
    console.log('SCANNA IL QR CODE CON WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Ponte Mobile WhatsApp: CLIENT PRONTO!');
    isClientReady = true;
});

client.on('auth_failure', msg => {
    console.error('Ponte Mobile WhatsApp: Errore di Autenticazione', msg);
});

client.initialize();

// API ENDPOINTS

app.get('/api/wa/status', (req, res) => {
    res.json({ ready: isClientReady });
});

app.post('/api/wa/send-file', async (req, res) => {
    if (!isClientReady) {
        return res.status(503).json({ success: false, error: 'Il client WhatsApp non è ancora pronto o autenticato.' });
    }

    const { phoneNumber, filePath, message } = req.body;

    if (!phoneNumber || !filePath) {
        return res.status(400).json({ success: false, error: 'Parametri mancanti: phoneNumber e filePath sono obbligatori.' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: `File non trovato: ${filePath}` });
    }

    try {
        // Formatta il numero (es. rimuovi spazi, aggiungi +39 se non presente)
        let formattedNumber = phoneNumber.replace(/\D/g, '');
        if (!formattedNumber.startsWith('39') && formattedNumber.length === 10) {
             formattedNumber = '39' + formattedNumber; // Default Italia
        }
        const chatId = `${formattedNumber}@c.us`;

        // Crea oggetto media
        const media = MessageMedia.fromFilePath(filePath);
        
        // Invia media con didascalia (messaggio)
        const response = await client.sendMessage(chatId, media, { caption: message || '' });
        
        res.json({ success: true, msg: 'File inviato con successo!', id: response.id._serialized });

    } catch (error) {
        console.error('Errore durante l\'invio del file WhatsApp:', error);
        res.status(500).json({ success: false, error: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`Ponte Mobile WhatsApp in ascolto sulla porta ${PORT}`);
});
