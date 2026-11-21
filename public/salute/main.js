const { app, BrowserWindow, Menu, dialog, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

function getBackupTimestampFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `Backup_Salute_${yyyy}-${mm}-${dd}_${hh}-${min}.salute`;
}

function getAppRootDirectory() {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
}

function getBackupDirectory() {
  const baseDir = getAppRootDirectory();
  const backupDir = path.join(baseDir, 'Backup_Salute');
  if (!fs.existsSync(backupDir)) {
    try {
      fs.mkdirSync(backupDir, { recursive: true });
    } catch (e) {
      const docDir = path.join(app.getPath('documents'), 'Progetto_Salute_Backup');
      if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
      return docDir;
    }
  }
  return backupDir;
}

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('show', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isMaximized()) {
        mainWindow.maximize();
      }
    }, 100);
  });

  // Supporto al tasto F11 per passare a schermo intero immersivo
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  // Indirizza qualsiasi download del browser direttamente nella cartella Backup_Salute
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const backupDir = getBackupDirectory();
    const suggestedName = (item.getFilename() === 'IlMioProfilo.salute') 
      ? getBackupTimestampFileName() 
      : item.getFilename();
    const targetFile = path.join(backupDir, suggestedName);
    item.setSaveDialogOptions({
      defaultPath: targetFile
    });
  });

  // Pulizia cache automatica per evitare problemi con Service Worker
  mainWindow.webContents.session.clearCache().then(() => {
    // Rimuovi il menu predefinito per un look più professionale
    Menu.setApplicationMenu(null);
    // Carica il file HTML principale
    mainWindow.loadFile('index.html');
  });
}

// IPC Handlers per Backup & Restore impostati sulla cartella dedicata "Backup_Salute"

// IPC Handler per Auto-Salvataggio silenzioso di sicurezza
ipcMain.handle('auto-save-backup', async (event, dataStr) => {
  try {
    const backupDir = getBackupDirectory();
    const targetFile = path.join(backupDir, 'Ultimo_Salvataggio_Automatico.salute');
    fs.writeFileSync(targetFile, dataStr, 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-backup-dialog', async (event, dataStr) => {
  const backupDir = getBackupDirectory();
  const defaultFile = path.join(backupDir, getBackupTimestampFileName());

  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win, {
    title: 'Salva Backup Storico con Data',
    defaultPath: defaultFile,
    filters: [
      { name: 'File SALUTE (*.salute)', extensions: ['salute'] },
      { name: 'File JSON (*.json)', extensions: ['json'] },
      { name: 'Tutti i file (*.*)', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, dataStr, 'utf8');
    return { success: true, filePath: result.filePath, fileName: path.basename(result.filePath) };
  }
  return { success: false, canceled: true };
});

ipcMain.handle('load-backup-dialog', async () => {
  const backupDir = getBackupDirectory();
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Seleziona Backup Storico da Ripristinare',
    defaultPath: backupDir,
    filters: [
      { name: 'File SALUTE (*.salute)', extensions: ['salute'] },
      { name: 'File JSON (*.json)', extensions: ['json'] },
      { name: 'Tutti i file (*.*)', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    const content = fs.readFileSync(selectedPath, 'utf8');
    return { success: true, content, filePath: selectedPath, fileName: path.basename(selectedPath) };
  }
  return { success: false, canceled: true };
});

// Apri la cartella dedicata Backup_Salute in Esplora Risorse
ipcMain.handle('open-backup-folder', async () => {
  const backupDir = getBackupDirectory();
  await shell.openPath(backupDir);
  return { success: true, folderPath: backupDir };
});

// Apri la cartella principale del programma in Esplora Risorse
ipcMain.handle('open-program-folder', async () => {
  const dir = getAppRootDirectory();
  await shell.openPath(dir);
  return { success: true, folderPath: dir };
});

// Compilazione rapida dell'eseguibile .exe autonomo
ipcMain.handle('build-app-exe', async () => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec('npm run build:exe', { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr });
      } else {
        const outDir = path.join(__dirname, 'dist', 'ProgettoSalute-win32-x64');
        shell.openPath(outDir);
        resolve({ success: true, folder: outDir });
      }
    });
  });
});


// IPC Handler per salvare file PDF con finestra di dialogo nativa e aprirlo subito
ipcMain.handle('save-pdf-file', async (event, { fileName, base64Data }) => {
  const win = BrowserWindow.getFocusedWindow();
  const defaultPath = path.join(app.getPath('desktop'), fileName);
  const result = await dialog.showSaveDialog(win, {
    title: 'Salva Menù Settimanale in Formato PDF',
    defaultPath: defaultPath,
    filters: [
      { name: 'Documento PDF (*.pdf)', extensions: ['pdf'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    // Apri subito il PDF nel visualizzatore predefinito di Windows
    shell.openPath(result.filePath);
    return { success: true, filePath: result.filePath, fileName: path.basename(result.filePath) };
  }
  return { success: false, canceled: true };
});

// IPC Handler per notifiche desktop native di Windows
ipcMain.handle('show-desktop-notification', async (event, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      const iconPath = path.join(__dirname, 'icon.png');
      const notif = new Notification({
        title: title || '🌿 Progetto Salute',
        body: body || 'Promemoria idratazione e salute',
        icon: fs.existsSync(iconPath) ? iconPath : undefined
      });
      notif.show();
      return { success: true };
    }
  } catch (e) {
    console.warn("Notification error:", e);
  }
  return { success: false };
});

app.whenReady().then(() => {
  // Assicura il dialogo di stampa classico su Windows per evitare il bug di Windows 11 col tasto Stampa disabilitato
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec('reg add "HKCU\\Software\\Microsoft\\Print\\UnifiedPrintDialog" /v "PreferLegacyPrintDialog" /t REG_DWORD /d 1 /f', () => {});
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
