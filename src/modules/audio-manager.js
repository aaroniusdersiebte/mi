class AudioManager {
  constructor() {
    this.audioSources = new Map();
    this.listeners = new Map();
    this.updateInterval = null;
    this.updateRate = 60; // Updates per second
    this.isActive = false;

    this.initializeManager();
  }

  initializeManager() {
    // Set up OBS manager listeners
    if (window.obsManager) {
      this.setupObsListeners();
    } else {
      // Wait for OBS manager to be available
      setTimeout(() => this.initializeManager(), 100);
      return;
    }

    // Set up MIDI controller listeners
    if (window.midiController) {
      this.setupMidiListeners();
    }

    // Load saved settings
    this.loadSettings();
  }

  setupObsListeners() {
    window.obsManager.on('connected', () => {
      console.log('AudioManager: OBS connected');
      this.refreshAudioSources();
      this.startUpdating();
    });

    window.obsManager.on('disconnected', () => {
      console.log('AudioManager: OBS disconnected');
      this.stopUpdating();
      this.clearAudioSources();
    });

    window.obsManager.on('audioSourcesUpdated', (sources) => {
      this.updateAudioSources(sources);
    });

    window.obsManager.on('volumeMeters', (data) => {
      this.updateVolumeLevels(data);
    });

    window.obsManager.on('volumeChanged', (data) => {
      this.handleVolumeChanged(data);
    });

    window.obsManager.on('muteStateChanged', (data) => {
      this.handleMuteStateChanged(data);
    });
  }

  setupMidiListeners() {
    window.midiController.on('deviceConnected', (device) => {
      console.log('AudioManager: MIDI device connected:', device.name);
      window.midiController.loadMappings();
    });
  }

  startUpdating() {
    if (this.updateInterval) return;
    
    this.isActive = true;
    this.updateInterval = setInterval(() => {
      this.emit('update');
    }, 1000 / this.updateRate);
  }

  stopUpdating() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isActive = false;
  }

  async refreshAudioSources() {
    try {
      if (window.obsManager && window.obsManager.isConnected) {
        await window.obsManager.getAudioSources();
      }
    } catch (error) {
      console.error('Error refreshing audio sources:', error);
      this.emit('error', error);
    }
  }

  updateAudioSources(sources) {
    // Clear existing sources
    this.audioSources.clear();

    // Add new sources
    sources.forEach(source => {
      const audioSource = this.createAudioSource(source);
      this.audioSources.set(source.name, audioSource);
    });

    console.log(`AudioManager: Updated ${sources.length} audio sources`);
    this.emit('sourcesUpdated', Array.from(this.audioSources.values()));
  }

  createAudioSource(obsSource) {
    // Get saved settings for this source
    const savedSettings = window.settingsManager?.getAudioSourceSettings(obsSource.name) || {};
    
    const audioSource = {
      name: obsSource.name,
      kind: obsSource.kind,
      volume: savedSettings.volume ?? obsSource.volume,
      muted: savedSettings.muted ?? obsSource.muted,
      levelMul: obsSource.levelMul || 0,
      levelDb: obsSource.levelDb || -100,
      midiMapping: savedSettings.midiMapping || null,
      
      // Visual properties
      peakLevel: 0,
      averageLevel: 0,
      levelHistory: new Array(30).fill(0), // 30 samples for smoothing
      
      // State
      isActive: true,
      lastUpdate: Date.now()
    };

    return audioSource;
  }

  updateVolumeLevels(data) {
    if (!data.inputs) return;

    data.inputs.forEach(input => {
      const source = this.audioSources.get(input.inputName);
      if (!source) return;

      // Update level data
      const levelMul = input.inputLevelsMul?.[0]?.[0] || 0;
      const levelDb = input.inputLevelsDb?.[0]?.[0] || -100;

      source.levelMul = levelMul;
      source.levelDb = levelDb;
      source.lastUpdate = Date.now();

      // Update level history for smoothing
      source.levelHistory.push(levelMul);
      if (source.levelHistory.length > 30) {
        source.levelHistory.shift();
      }

      // Calculate average and peak levels
      source.averageLevel = source.levelHistory.reduce((a, b) => a + b, 0) / source.levelHistory.length;
      source.peakLevel = Math.max(source.peakLevel * 0.95, levelMul); // Peak with decay
    });

    this.emit('levelsUpdated');
  }

  handleVolumeChanged(data) {
    const source = this.audioSources.get(data.inputName);
    if (source) {
      source.volume = data.inputVolumeMul;
      this.emit('volumeChanged', {
        sourceName: data.inputName,
        volume: data.inputVolumeMul
      });
    }
  }

  handleMuteStateChanged(data) {
    const source = this.audioSources.get(data.inputName);
    if (source) {
      source.muted = data.inputMuted;
      this.emit('muteStateChanged', {
        sourceName: data.inputName,
        muted: data.inputMuted
      });
    }
  }

  clearAudioSources() {
    this.audioSources.clear();
    this.emit('sourcesUpdated', []);
  }

  // Audio source control methods
  async setSourceVolume(sourceName, volume) {
    const source = this.audioSources.get(sourceName);
    if (!source) {
      throw new Error(`Audio source '${sourceName}' not found`);
    }

    try {
      await window.obsManager.setInputVolume(sourceName, volume);
      source.volume = volume;
      
      // Save setting
      this.saveSourceSettings(sourceName, { volume });
      
      return true;
    } catch (error) {
      console.error(`Error setting volume for ${sourceName}:`, error);
      throw error;
    }
  }

  async setSourceMute(sourceName, muted) {
    const source = this.audioSources.get(sourceName);
    if (!source) {
      throw new Error(`Audio source '${sourceName}' not found`);
    }

    try {
      await window.obsManager.setInputMute(sourceName, muted);
      source.muted = muted;
      
      // Save setting
      this.saveSourceSettings(sourceName, { muted });
      
      return true;
    } catch (error) {
      console.error(`Error setting mute for ${sourceName}:`, error);
      throw error;
    }
  }

  async toggleSourceMute(sourceName) {
    const source = this.audioSources.get(sourceName);
    if (!source) {
      throw new Error(`Audio source '${sourceName}' not found`);
    }

    try {
      const newMuteState = await window.obsManager.toggleInputMute(sourceName);
      source.muted = newMuteState;
      
      // Save setting
      this.saveSourceSettings(sourceName, { muted: newMuteState });
      
      return newMuteState;
    } catch (error) {
      console.error(`Error toggling mute for ${sourceName}:`, error);
      throw error;
    }
  }

  // MIDI Mapping methods
  assignMidiControl(sourceName, midiEvent, controlType) {
    const source = this.audioSources.get(sourceName);
    if (!source) {
      throw new Error(`Audio source '${sourceName}' not found`);
    }

    const mapping = {
      midiId: midiEvent.id,
      sourceName: sourceName,
      controlType: controlType, // 'volume' or 'mute'
      midiDescription: window.midiController.getMidiEventDescription(midiEvent)
    };

    // Set up the MIDI mapping
    const action = {
      type: controlType,
      sourceName: sourceName,
      maxVolume: 1.0 // Can be adjusted later
    };

    window.midiController.mapControl(midiEvent.id, action);
    
    // Update source
    source.midiMapping = mapping;
    
    // Save setting
    this.saveSourceSettings(sourceName, { midiMapping: mapping });

    this.emit('midiMappingAdded', {
      sourceName,
      mapping
    });

    return mapping;
  }

  removeMidiMapping(sourceName) {
    const source = this.audioSources.get(sourceName);
    if (!source || !source.midiMapping) return;

    // Remove from MIDI controller
    window.midiController.removeMapping(source.midiMapping.midiId);
    
    // Update source
    source.midiMapping = null;
    
    // Save setting
    this.saveSourceSettings(sourceName, { midiMapping: null });

    this.emit('midiMappingRemoved', sourceName);
  }

  // Settings management
  saveSourceSettings(sourceName, settings) {
    if (window.settingsManager) {
      window.settingsManager.setAudioSourceSettings(sourceName, settings);
    }
  }

  loadSettings() {
    // Settings are loaded when sources are created
    // This method can be extended for other settings
  }

  // Utility methods
  getAudioSource(sourceName) {
    return this.audioSources.get(sourceName);
  }

  getAllAudioSources() {
    return Array.from(this.audioSources.values());
  }

  getActiveSources() {
    return Array.from(this.audioSources.values()).filter(source => source.isActive);
  }

  getSourcesWithMidiMappings() {
    return Array.from(this.audioSources.values()).filter(source => source.midiMapping);
  }

  // Volume level utilities
  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  linearToDb(linear) {
    return 20 * Math.log10(Math.max(linear, 0.0001));
  }

  formatVolumeLevel(levelMul) {
    const db = this.linearToDb(levelMul);
    if (db <= -60) return '-∞ dB';
    return `${db.toFixed(1)} dB`;
  }

  formatVolumePercent(volume) {
    return `${Math.round(volume * 100)}%`;
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in AudioManager event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy() {
    this.stopUpdating();
    this.audioSources.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new AudioManager();
} else {
  window.audioManager = new AudioManager();
}