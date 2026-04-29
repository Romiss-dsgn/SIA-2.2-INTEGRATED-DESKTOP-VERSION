// main.js - Electron Main Process for Well Served EMR Desktop App

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow;

// ✅ Resolve the real on-disk root — uses app.asar.unpacked when packaged
const appRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked')
  : __dirname;

console.log('✅ appRoot:', appRoot);

// ✅ Manually parse .env — looks inside view/ where it actually lives
function loadEnvFile() {
  const envVars = {};
  const possiblePaths = [
    path.join(appRoot, 'view', '.env'),       // ✅ Primary: view/.env (unpacked)
    path.join(appRoot, '.env'),               // Fallback: root
    path.join(__dirname, 'view', '.env'),     // Dev fallback
    path.join(__dirname, '.env'),             // Dev root fallback
  ];

  for (const envPath of possiblePaths) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) return;
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        const hashIndex = value.search(/\s+#/);
        if (hashIndex !== -1) value = value.substring(0, hashIndex).trim();
        if (key) envVars[key] = value;
      });
      console.log(`✅ .env loaded from: ${envPath}`);
      console.log('✅ Env keys:', Object.keys(envVars).join(', '));
      return envVars;
    } catch (e) {
      // Try next path
    }
  }
  console.error('❌ .env not found in any expected location');
  return envVars;
}

// ✅ Start Express server in-process using Electron's built-in Node.js
async function startServer() {
  try {
    const envVars = loadEnvFile();
    Object.assign(process.env, envVars);
    console.log('✅ Env vars applied to process.env');

    const serverDir = path.join(appRoot, 'view');
    console.log('✅ Server dir:', serverDir);

    const serverJsPath = path.join(serverDir, 'server.js');
    if (!fs.existsSync(serverJsPath)) {
      console.error('❌ server.js not found at:', serverJsPath);
      return;
    }

    process.chdir(serverDir);
    console.log('✅ cwd changed to:', process.cwd());

    const serverUrl = 'file:///' + serverJsPath.replace(/\\/g, '/');
    console.log('✅ Importing server from:', serverUrl);

    await import(serverUrl);
    console.log('✅ Server module loaded successfully');

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    console.error(err.stack);
  }
}

function createWindow() {
  session.defaultSession.clearCache();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      enableRemoteModule: false,
      webviewTag: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: false,
      devTools: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'user/Assets/wellserved_logo.jpg'),
    show: false,
    backgroundColor: '#FFFFFF',
    autoHideMenuBar: true
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.loadFile(path.join(__dirname, 'EMR_ADMIN_USER', 'LANDING_and_LOGINPAGE', 'emrLogin.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .select2-container--open .select2-dropdown { z-index: 999999 !important; }
      .select2-dropdown { z-index: 999999 !important; position: fixed !important; }
      .select2-container--open { position: fixed !important; }
      .modal, .modal-content, [class*="modal"] { overflow: visible !important; }
      body { transform: none !important; -webkit-transform: none !important; isolation: auto !important; }
    `).catch(err => console.error('CSS injection error:', err));
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ✅ Fix SRV DNS resolution for MongoDB Atlas in Electron
app.commandLine.appendSwitch('dns-over-https', 'off');
app.commandLine.appendSwitch('no-proxy-server', '');

app.whenReady().then(async () => {
  await startServer();
  setTimeout(createWindow, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});