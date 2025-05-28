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
        enableRemoteModule: false
      },
      frame: process.platform === 'darwin',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#1a1a1a',
      show: false
    });

    // Set MIDI permissions for WebMidi.js
    this.setupMidiPermissions();

    this.mainWindow.loadFile('src/renderer/index.html');

    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupMidiPermissions() {
    // Handle MIDI permission requests
    this.mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
      console.log('Permission request:', permission);
      if (permission === 'midi' || permission === 'midiSysex') {
        callback(true);
      } else {
        callback(false);
      }
    });

    // Handle MIDI permission checks
    this.mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      console.log('Permission check:', permission);
      if (permission === 'midi' || permission === 'midiSysex') {
        return true;
      }
      return false;
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
  }
}

// Initialize the application
new MainApplication();