const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class MainApplication {
  constructor() {
    this.mainWindow = null;
    this.isDev = process.argv.includes('--dev');
    
    this.initializeApp();
  }

  initializeApp() {
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupIpcHandlers();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: false,
        // Enable web security for external resources but allow local files
        webSecurity: false,
        // Allow running insecure content for MIDI and WebSocket connections
        allowRunningInsecureContent: true,
        // Enable experimental web platform features for MIDI
        experimentalFeatures: true
      },
      frame: process.platform === 'darwin',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#1a1a1a',
      show: false,
      // Add icon if available
      icon: path.join(__dirname, 'assets', 'icon.png')
    });

    // Set up permissions for MIDI and other features
    this.setupPermissions();

    this.mainWindow.loadFile('src/renderer/index.html');

    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Log initialization status
      console.log('=== OBS MIDI Mixer Started ===');
      console.log('Development mode:', this.isDev);
      console.log('Node.js version:', process.version);
      console.log('Electron version:', process.versions.electron);
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle navigation and external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      // Open external links in default browser
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  setupPermissions() {
    const session = this.mainWindow.webContents.session;

    // Handle all permission requests
    session.setPermissionRequestHandler((webContents, permission, callback, details) => {
      console.log('Permission request:', permission, details);
      
      switch (permission) {
        case 'midi':
        case 'midiSysex':
          console.log('✓ MIDI permission granted');
          callback(true);
          break;
        case 'media':
          console.log('✓ Media permission granted');
          callback(true);
          break;
        case 'notifications':
          console.log('✓ Notifications permission granted');
          callback(true);
          break;
        default:
          console.log('? Unknown permission requested:', permission);
          callback(false);
      }
    });

    // Handle permission checks
    session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      console.log('Permission check:', permission, requestingOrigin);
      
      switch (permission) {
        case 'midi':
        case 'midiSysex':
          return true;
        case 'media':
          return true;
        case 'notifications':
          return true;
        default:
          return false;
      }
    });

    // Set up CSP to allow external resources
    session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https://cdnjs.cloudflare.com; " +
            "connect-src 'self' ws: wss: https:; " +
            "media-src 'self' blob:; " +
            "worker-src 'self' blob:;"
          ]
        }
      });
    });
  }

  setupIpcHandlers() {
    // IPC handlers for renderer communication
    ipcMain.handle('get-app-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('minimize-window', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.handle('close-window', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });

    ipcMain.handle('toggle-devtools', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.toggleDevTools();
      }
    });

    ipcMain.handle('reload-window', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.reload();
      }
    });

    // Debug helper
    ipcMain.handle('get-debug-info', () => {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        isDev: this.isDev
      };
    });
  }
}

// Enable live reload in development
if (process.argv.includes('--dev')) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
    console.log('Live reload enabled');
  } catch (e) {
    console.log('Live reload not available (electron-reload not installed)');
  }
}

// Initialize the application
new MainApplication();