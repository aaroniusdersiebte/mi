// Main renderer process script
class RendererApp {
  constructor() {
    this.isInitialized = false;
    this.managers = {};
    this.errors = [];
    
    this.initialize();
  }

  async initialize() {
    console.log('Initializing OBS MIDI Mixer...');
    
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Initialize managers in order
      await this.initializeManagers();
      
      // Set up error handling
      this.setupErrorHandling();
      
      // Auto-connect if configured
      await this.autoConnect();
      
      this.isInitialized = true;
      console.log('OBS MIDI Mixer initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.showErrorMessage('Fehler beim Starten der Anwendung', error.message);
    }
  }

  async initializeManagers() {
    console.log('=== Initializing Managers ===');
    
    // Check if managers are available
    const managerStatus = {
      settings: !!window.settingsManager,
      obs: !!window.obsManager, 
      midi: !!window.midiController,
      audio: !!window.audioManager,
      ui: !!window.uiManager
    };
    
    console.log('Manager availability:', managerStatus);
    
    // Settings Manager (already initialized via global variable)
    if (window.settingsManager) {
      this.managers.settings = window.settingsManager;
      console.log('✓ Settings Manager loaded');
    } else {
      console.error('❌ Settings Manager not available - this is critical!');
      throw new Error('Settings Manager not available');
    }
    
    // OBS WebSocket Manager
    if (window.obsManager) {
      this.managers.obs = window.obsManager;
      console.log('✓ OBS Manager loaded');
    } else {
      console.warn('⚠️ OBS Manager not available - OBS features disabled');
    }
    
    // MIDI Controller
    if (window.midiController) {
      this.managers.midi = window.midiController;
      console.log('✓ MIDI Controller loaded');
    } else {
      console.warn('⚠️ MIDI Controller not available - MIDI features disabled');
    }
    
    // Audio Manager
    if (window.audioManager) {
      this.managers.audio = window.audioManager;
      console.log('✓ Audio Manager loaded');
    } else {
      console.warn('⚠️ Audio Manager not available - Audio features disabled');
    }
    
    // Wait a bit for managers to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // UI Manager (should be initialized last)
    if (window.uiManager) {
      this.managers.ui = window.uiManager;
      console.log('✓ UI Manager loaded');
    } else {
      console.error('❌ UI Manager not available');
    }
    
    const loadedCount = Object.values(this.managers).filter(m => m !== undefined).length;
    console.log(`Managers loaded: ${loadedCount}/5`);
    
    if (loadedCount === 0) {
      throw new Error('No managers could be loaded - check module loading');
    }
  }

  setupErrorHandling() {
    // Global error handlers
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.handleError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason);
    });

    // Manager error handlers
    this.managers.obs?.on('error', (error) => {
      console.error('OBS error:', error);
      this.showErrorMessage('OBS Verbindungsfehler', error.message || 'Unbekannter Fehler');
    });

    this.managers.midi?.on('error', (error) => {
      console.error('MIDI error:', error);
      this.showErrorMessage('MIDI Fehler', error.message || 'Unbekannter Fehler');
    });

    this.managers.audio?.on('error', (error) => {
      console.error('Audio error:', error);
      this.showErrorMessage('Audio Fehler', error.message || 'Unbekannter Fehler');
    });
  }

  async autoConnect() {
    const settings = this.managers.settings?.getAll() || {};
    
    // Auto-connect to OBS if configured and available
    if (this.managers.obs && settings.obs?.autoConnect !== false) {
      try {
        console.log('Auto-connecting to OBS...');
        const obsUrl = settings.obs?.url || 'ws://localhost:4455';
        const obsPassword = settings.obs?.password || '';
        await this.managers.obs.connect(obsUrl, obsPassword);
      } catch (error) {
        console.warn('Auto-connect to OBS failed:', error.message);
      }
    } else {
      console.log('OBS Manager not available or auto-connect disabled');
    }

    // Force MIDI device scan if available
    if (this.managers.midi) {
      try {
        console.log('Scanning for MIDI devices...');
        this.managers.midi.scanDevices();
      } catch (error) {
        console.warn('MIDI device scan failed:', error.message);
      }
    } else {
      console.log('MIDI Controller not available');
    }
    
    // Force UI update after connections
    setTimeout(() => {
      if (this.managers.ui) {
        this.managers.ui.updateConnectionStatus();
      }
    }, 2000);
  }

  handleError(error) {
    // Log error details
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    console.error('Application error:', errorInfo);
    
    // Store error for debugging
    this.errors.push(errorInfo);
    
    // Keep only last 10 errors
    if (this.errors.length > 10) {
      this.errors.shift();
    }

    // Show user-friendly error message
    this.showErrorMessage('Ein Fehler ist aufgetreten', error.message);
  }

  showErrorMessage(title, message) {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="error-content">
        <strong>${title}</strong>
        <p>${message}</p>
        <button class="error-close">×</button>
      </div>
    `;

    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'var(--error-color)',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: 'var(--shadow)',
      zIndex: '10000',
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out'
    });

    // Add close button functionality
    const closeBtn = notification.querySelector('.error-close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    document.body.appendChild(notification);
  }

  showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
      <div class="success-content">
        <p>${message}</p>
        <button class="success-close">×</button>
      </div>
    `;

    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'var(--success-color)',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: 'var(--shadow)',
      zIndex: '10000',
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out'
    });

    const closeBtn = notification.querySelector('.success-close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);

    document.body.appendChild(notification);
  }

  // Debug methods
  getAppStatus() {
    const managerCount = Object.values(this.managers).filter(m => m !== undefined).length;
    
    return {
      initialized: this.isInitialized,
      managersLoaded: managerCount,
      totalManagers: 5,
      obsConnected: this.managers.obs?.isConnected || false,
      midiConnected: !!this.managers.midi?.getActiveDevice(),
      audioSources: this.managers.audio?.getAllAudioSources().length || 0,
      midiMappings: Object.keys(this.managers.settings?.getMidiMappings() || {}).length,
      errors: this.errors || []
    };
  }

  debugPrint() {
    console.log('=== OBS MIDI Mixer Debug Info ===');
    console.log('App Status:', this.getAppStatus());
    console.log('Settings:', this.managers.settings?.getAll());
    console.log('OBS Status:', this.managers.obs?.getConnectionStatus());
    console.log('MIDI Device:', this.managers.midi?.getActiveDevice());
    console.log('Audio Sources:', this.managers.audio?.getAllAudioSources());
    console.log('MIDI Mappings:', this.managers.midi?.getAllMappings());
  }

  // Cleanup
  destroy() {
    Object.values(this.managers).forEach(manager => {
      if (manager && typeof manager.destroy === 'function') {
        manager.destroy();
      }
    });
  }
}

// CSS for notifications (inject into document)
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .error-notification, .success-notification {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .error-content, .success-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .error-close, .success-close {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .error-close:hover, .success-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .midi-learning {
    cursor: crosshair;
  }

  .midi-learning * {
    cursor: crosshair;
  }
`;
document.head.appendChild(notificationStyles);

// Initialize the application
const app = new RendererApp();

// Make app available globally for debugging
window.app = app;

// Expose debug function globally
window.debugApp = () => app.debugPrint();

// Additional debug functions
window.debugManagers = () => {
  console.log('=== Manager Status ===');
  console.log('Settings Manager:', !!window.settingsManager);
  console.log('OBS Manager:', !!window.obsManager);
  console.log('MIDI Controller:', !!window.midiController);
  console.log('Audio Manager:', !!window.audioManager);
  console.log('UI Manager:', !!window.uiManager);
  
  if (window.midiController) {
    console.log('MIDI Devices:', window.midiController.getConnectedDevices());
    console.log('Active MIDI Device:', window.midiController.getActiveDevice());
  }
  
  if (window.obsManager) {
    console.log('OBS Status:', window.obsManager.getConnectionStatus());
  }
};

// Test connectivity
window.testConnections = () => {
  console.log('=== Testing Connections ===');
  
  const results = {
    managers: {},
    connections: {},
    errors: []
  };
  
  // Test manager availability
  results.managers = {
    settings: !!window.settingsManager,
    obs: !!window.obsManager,
    midi: !!window.midiController,
    audio: !!window.audioManager,
    ui: !!window.uiManager
  };
  
  console.log('Manager Status:', results.managers);
  
  // Test OBS
  if (window.obsManager) {
    const settings = window.settingsManager?.getObsSettings() || {};
    window.obsManager.connect(settings.url || 'ws://localhost:4455', settings.password || '')
      .then(() => {
        console.log('✓ OBS Connected');
        results.connections.obs = 'success';
      })
      .catch(err => {
        console.log('✗ OBS Failed:', err.message);
        results.connections.obs = 'failed: ' + err.message;
        results.errors.push('OBS: ' + err.message);
      });
  } else {
    results.connections.obs = 'manager not available';
  }
  
  // Test MIDI
  if (window.midiController) {
    try {
      const devices = window.midiController.scanDevices();
      console.log('MIDI Scan Result:', devices);
      results.connections.midi = `Found ${devices.length} devices`;
      
      if (devices.length > 0) {
        console.log('✓ MIDI Devices found');
      } else {
        console.log('✗ No MIDI devices');
      }
    } catch (err) {
      console.log('✗ MIDI Scan failed:', err.message);
      results.connections.midi = 'scan failed: ' + err.message;
      results.errors.push('MIDI: ' + err.message);
    }
  } else {
    results.connections.midi = 'manager not available';
  }
  
  console.log('Test Results:', results);
  return results;
};

// Manual connection helpers
window.connectOBS = async (url, password) => {
  if (!window.obsManager) {
    throw new Error('OBS Manager not available');
  }
  
  try {
    await window.obsManager.connect(url || 'ws://localhost:4455', password || '');
    console.log('✓ Manual OBS connection successful');
    return true;
  } catch (error) {
    console.error('✗ Manual OBS connection failed:', error);
    throw error;
  }
};

window.scanMIDI = () => {
  if (!window.midiController) {
    throw new Error('MIDI Controller not available');
  }
  
  try {
    const devices = window.midiController.scanDevices();
    console.log('✓ MIDI scan completed:', devices.length, 'devices found');
    return devices;
  } catch (error) {
    console.error('✗ MIDI scan failed:', error);
    throw error;
  }
};