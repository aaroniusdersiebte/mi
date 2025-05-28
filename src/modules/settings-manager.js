// Settings Manager - Fixed for Browser/Electron Renderer
class SettingsManager {
  constructor() {
    // Use localStorage for browser/renderer process compatibility
    this.storageKey = 'obs-midi-mixer-settings';
    this.defaults = {
      obs: {
        url: 'ws://localhost:4455',
        password: '',
        autoConnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 5
      },
      midi: {
        deviceId: null,
        deviceName: '',
        autoConnect: true,
        learningTimeout: 10000
      },
      audio: {
        sources: {},
        masterVolume: 1.0,
        updateRate: 60,
        volumeSmoothing: true,
        peakHoldTime: 2000
      },
      hotkeys: {
        mappings: {},
        globalHotkeys: {
          toggleMidiLearning: 'F1',
          refreshSources: 'F5',
          openSettings: 'Ctrl+,',
          toggleMasterMute: 'F2'
        }
      },
      ui: {
        audioSectionWidth: 50,
        theme: 'dark',
        showVolumeDb: true,
        showVolumePercent: true,
        animationsEnabled: true,
        compactMode: false
      },
      advanced: {
        debug: false,
        logLevel: 'info',
        performanceMode: false,
        experimentalFeatures: false
      }
    };

    this.listeners = new Map();
    this.initializeSettings();
    
    console.log('Settings Manager initialized successfully');
  }

  initializeSettings() {
    try {
      // Check if settings exist, if not create defaults
      const existingSettings = this.getAll();
      if (Object.keys(existingSettings).length === 0) {
        console.log('No existing settings found, creating defaults');
        this.setAll(this.defaults);
      } else {
        console.log('Loaded existing settings');
        // Merge with defaults to ensure all keys exist
        const mergedSettings = this.mergeWithDefaults(existingSettings);
        if (JSON.stringify(mergedSettings) !== JSON.stringify(existingSettings)) {
          console.log('Updated settings with new default values');
          this.setAll(mergedSettings);
        }
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
      // Fallback to defaults
      this.setAll(this.defaults);
    }
  }

  mergeWithDefaults(settings) {
    const merged = JSON.parse(JSON.stringify(this.defaults));
    
    // Deep merge existing settings
    Object.keys(settings).forEach(key => {
      if (typeof settings[key] === 'object' && settings[key] !== null) {
        merged[key] = { ...merged[key], ...settings[key] };
      } else {
        merged[key] = settings[key];
      }
    });
    
    return merged;
  }

  // Internal storage methods
  _getStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return {};
    }
  }

  _setStorage(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  }

  // Get settings
  get(key, defaultValue = null) {
    try {
      const data = this._getStorage();
      const keys = key.split('.');
      let result = data;
      
      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = result[k];
        } else {
          return defaultValue;
        }
      }
      
      return result !== undefined ? result : defaultValue;
    } catch (error) {
      console.error('Error getting setting:', key, error);
      return defaultValue;
    }
  }

  // Set settings
  set(key, value) {
    try {
      const data = this._getStorage();
      const keys = key.split('.');
      let current = data;
      
      // Navigate to the parent object
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
      
      // Set the value
      current[keys[keys.length - 1]] = value;
      
      const success = this._setStorage(data);
      if (success) {
        this.notifyListeners(key, value);
      }
      return success;
    } catch (error) {
      console.error('Error setting:', key, error);
      return false;
    }
  }

  // Delete setting
  delete(key) {
    try {
      const data = this._getStorage();
      const keys = key.split('.');
      let current = data;
      
      // Navigate to the parent object
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
          return true; // Key doesn't exist, consider it deleted
        }
        current = current[k];
      }
      
      // Delete the key
      delete current[keys[keys.length - 1]];
      
      const success = this._setStorage(data);
      if (success) {
        this.notifyListeners(key, null);
      }
      return success;
    } catch (error) {
      console.error('Error deleting setting:', key, error);
      return false;
    }
  }

  // Get all settings
  getAll() {
    return this._getStorage();
  }

  // Set all settings
  setAll(settings) {
    const success = this._setStorage(settings);
    if (success) {
      this.notifyListeners('*', null);
    }
    return success;
  }

  // Reset all settings to defaults
  reset() {
    try {
      localStorage.removeItem(this.storageKey);
      this.setAll(this.defaults);
      this.notifyListeners('*', null);
      console.log('Settings reset to defaults');
      return true;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  }

  // OBS Settings
  getObsSettings() {
    return this.get('obs', this.defaults.obs);
  }

  setObsSettings(settings) {
    const current = this.getObsSettings();
    return this.set('obs', { ...current, ...settings });
  }

  // MIDI Settings
  getMidiSettings() {
    return this.get('midi', this.defaults.midi);
  }

  setMidiSettings(settings) {
    const current = this.getMidiSettings();
    return this.set('midi', { ...current, ...settings });
  }

  // Audio Source Settings
  getAudioSourceSettings(sourceName) {
    const sources = this.get('audio.sources', {});
    return sources[sourceName] || {
      volume: 1.0,
      muted: false,
      midiMapping: null
    };
  }

  setAudioSourceSettings(sourceName, settings) {
    const sources = this.get('audio.sources', {});
    const currentSettings = this.getAudioSourceSettings(sourceName);
    sources[sourceName] = { ...currentSettings, ...settings };
    return this.set('audio.sources', sources);
  }

  // MIDI Mappings
  getMidiMappings() {
    return this.get('hotkeys.mappings', {});
  }

  setMidiMapping(midiId, action) {
    const mappings = this.getMidiMappings();
    mappings[midiId] = action;
    return this.set('hotkeys.mappings', mappings);
  }

  removeMidiMapping(midiId) {
    const mappings = this.getMidiMappings();
    delete mappings[midiId];
    return this.set('hotkeys.mappings', mappings);
  }

  // UI Settings
  getUiSettings() {
    return this.get('ui', this.defaults.ui);
  }

  setUiSettings(settings) {
    const current = this.getUiSettings();
    return this.set('ui', { ...current, ...settings });
  }

  // Event Listeners for settings changes
  addListener(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
  }

  removeListener(key, callback) {
    if (this.listeners.has(key)) {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(key, value) {
    // Notify specific key listeners
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(value, key);
        } catch (error) {
          console.error('Error in settings listener:', error);
        }
      });
    }

    // Notify global listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try {
          callback(value, key);
        } catch (error) {
          console.error('Error in global settings listener:', error);
        }
      });
    }
  }

  // Import/Export settings
  exportSettings() {
    try {
      const settings = this.getAll();
      return JSON.stringify(settings, null, 2);
    } catch (error) {
      console.error('Error exporting settings:', error);
      return null;
    }
  }

  importSettings(jsonString) {
    try {
      const settings = JSON.parse(jsonString);
      
      // Validate settings structure
      if (!this.validateSettings(settings)) {
        throw new Error('Invalid settings format');
      }

      // Import new settings
      this.setAll(settings);
      return true;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }

  validateSettings(settings) {
    // Basic validation of settings structure
    if (!settings || typeof settings !== 'object') {
      return false;
    }
    
    const requiredKeys = ['obs', 'midi', 'audio', 'hotkeys', 'ui'];
    return requiredKeys.every(key => key in settings);
  }

  // Debug helpers
  debugPrint() {
    console.log('Current Settings:', this.getAll());
  }

  getStorageInfo() {
    const dataSize = localStorage.getItem(this.storageKey)?.length || 0;
    return {
      type: 'localStorage',
      key: this.storageKey,
      size: dataSize,
      sizeFormatted: this.formatBytes(dataSize)
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export as global variable immediately
console.log('Creating Settings Manager...');
window.settingsManager = new SettingsManager();