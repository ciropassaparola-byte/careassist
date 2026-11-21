const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetUrl = 'http://192.168.1.6:3000/careassist/index.html';
const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=' + encodeURIComponent(targetUrl);

https.get(apiUrl, (res) => {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const b64 = buffer.toString('base64');
    const jsContent = 'window.QR_CODE_SMARTPHONE_DATA_URL = "data:image/png;base64,' + b64 + '";\nwindow.CAREASSIST_MOBILE_URL = "' + targetUrl + '";\n';

    const p1 = 'c:\\Users\\Utente\\Desktop\\questa\\CareAssist_Pro\\qrcode_data_uri.js';
    const p2 = 'c:\\Users\\Utente\\Desktop\\CareAssist Pro\\CareAssist_Pro\\qrcode_data_uri.js';
    const p3 = 'c:\\Users\\Utente\\Desktop\\questa\\PROGRAMMI_SINGOLI\\7_CareAssist_Pro\\qrcode_data_uri.js';

    fs.writeFileSync(p1, jsContent);
    try { fs.writeFileSync(p2, jsContent); } catch(e){}
    try { fs.writeFileSync(p3, jsContent); } catch(e){}
    console.log('QR Code successfully generated and updated!');
  });
}).on('error', err => {
  console.error('Error fetching QR code:', err);
});
