// Audio Manager - Fixed for proper initialization
class AudioManager {
  constructor() {
    this.audioSources = new Map();
    this.listeners = new Map();
    this.updateInterval = null;
    this.updateRate = 60; // Updates per second
    this.isActive = false;

    console.log('AudioManager constructor called');
    
    // Delayed initialization to ensure other managers are ready
    setTimeout(() => this.initializeManager(), 500);
  }

  initializeManager() {
    console.log('AudioManager: Starting initialization...');
    
    // Set up OBS manager listeners
    if (window.obsManager) {
      console.log('AudioManager: OBS Manager found, setting up listeners');
      this.setupObsListeners();
    } else {
      console.warn('AudioManager: OBS Manager not yet available, retrying...');
      setTimeout(() => this.initializeManager(), 1000);
      return;
    }

    // Set up MIDI controller listeners
    if (window.midiController) {
      console.log('AudioManager: MIDI Controller found, setting up listeners');
      this.setupMidiListeners();
    } else {
      console.warn('AudioManager: MIDI Controller not available');
    }

    // Load saved settings
    this.loadSettings();
    
    console.log('AudioManager: Successfully initialized');
  }

  setupObsListeners() {
    window.obsManager.on('connected', () => {
      console.log('AudioManager: OBS connected');
      // Wait a bit for OBS to be fully ready
      setTimeout(() => {
        this.refreshAudioSources();
        this.startUpdating();
      }, 1000);
    });

    window.obsManager.on('disconnected', () => {
      console.log('AudioManager: OBS disconnected');
      this.stopUpdating();
      this.clearAudioSources();
    });

    window.obsManager.on('audioSourcesUpdated', (sources) => {
      console.log('AudioManager: Audio sources updated:', sources.length);
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

    // Listen for MIDI messages during learning
    window.midiController.on('midiMessage', (message) => {
      console.log('AudioManager: MIDI message received:', message);
      // This will be handled by UI Manager for learning
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
      console.log('AudioManager: Refreshing audio sources...');
      if (window.obsManager && window.obsManager.isConnected) {
        await window.obsManager.getAudioSources();
      } else {
        console.warn('AudioManager: OBS not connected, cannot refresh sources');
      }
    } catch (error) {
      console.error('AudioManager: Error refreshing audio sources:', error);
      this.emit('error', error);
    }
  }

  updateAudioSources(sources) {
    console.log('AudioManager: Updating audio sources:', sources.length);
    
    // Clear existing sources
    this.audioSources.clear();

    // Add new sources
    sources.forEach(source => {
      const audioSource = this.createAudioSource(source);
      this.audioSources.set(source.name, audioSource);
      console.log('AudioManager: Added audio source:', source.name);
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
      volume: savedSettings.volume ?? obsSource.volume ?? 1.0,
      muted: savedSettings.muted ?? obsSource.muted ?? false,
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
      controlType: controlType, // 'volume', 'mute', or 'scene'
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

    console.log('AudioManager: MIDI mapping created:', mapping);
    return mapping;
  }

  // Scene control methods
  assignMidiSceneControl(sceneName, midiEvent) {
    const mapping = {
      midiId: midiEvent.id,
      sceneName: sceneName,
      controlType: 'scene',
      midiDescription: window.midiController.getMidiEventDescription(midiEvent)
    };

    // Set up the MIDI mapping for scene switching
    const action = {
      type: 'scene',
      sceneName: sceneName
    };

    window.midiController.mapControl(midiEvent.id, action);
    
    // Save scene mapping
    const sceneMappings = window.settingsManager?.get('hotkeys.sceneMappings', {}) || {};
    sceneMappings[midiEvent.id] = mapping;
    window.settingsManager?.set('hotkeys.sceneMappings', sceneMappings);

    this.emit('sceneMappingAdded', {
      sceneName,
      mapping
    });

    console.log('AudioManager: Scene MIDI mapping created:', mapping);
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

// Export as global variable
console.log('Creating Audio Manager...');
window.audioManager = new AudioManager();