const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const DB_FILE = path.join(BASE_DIR, 'careassist_database.json');

const server = http.createServer((req, res) => {
  // CORS headers per consentire chiamate sia da localhost che da IP Wi-Fi
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);

  // ENDPOINT 1: Recupera il database sincronizzato condiviso
  if (reqPath === '/api/get-db' && req.method === 'GET') {
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
      if (err || !data) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'not_found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ENDPOINT 2: Salva il database sincronizzato da qualsiasi dispositivo (PC o Smartphone)
  if (reqPath === '/api/save-db' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Empty body' }));
        return;
      }
      try {
        // Verifica che sia JSON valido
        JSON.parse(body);
        fs.writeFile(DB_FILE, body, 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
        });
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(path.join(BASE_DIR, reqPath));
  if (!safePath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    res.end('Accesso negato');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File non trovato: ' + reqPath);
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': (ext === '.html' || ext === '.js' || ext === '.css') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(safePath).pipe(res);
  });
});

function getLocalIp() {
  const nets = os.networkInterfaces();
  let wifiIp = null;
  let fallbackIp = null;
  for (const name of Object.keys(nets)) {
    // Ignora schede virtuali
    if (/tailscale|vmware|virtual|vEthernet|loopback/i.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (/wi-?fi|wlan/i.test(name)) return net.address;
        if (!fallbackIp) fallbackIp = net.address;
      }
    }
  }
  return wifiIp || fallbackIp || '192.168.1.8';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('================================================================');
  console.log('🩺 CAREASSIST PRO - SERVER LOCALE PER SMARTPHONE & TABLET ATTIVO');
  console.log('================================================================');
  console.log(`\nDa questo PC:           http://localhost:${PORT}`);
  console.log(`Dal tuo SMARTPHONE:     http://${ip}:${PORT}\n`);
  console.log('Apri la fotocamera del cellulare o il browser e inserisci questo indirizzo!');
  console.log('(Assicurati che lo smartphone sia connesso alla stessa rete Wi-Fi)');
  console.log('Premi CTRL+C per terminare il server quando hai finito.');
  console.log('================================================================\n');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Porta ${PORT} già presidiata dalla Suite Principale (CareAssist integrato e sincronizzato).`);
  } else {
    console.error('Errore server CareAssist:', err);
  }
});
