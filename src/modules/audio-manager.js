// Audio Manager - FIXED: Logarithmic/Exponential Volume Curves
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
    
    console.log('AudioManager: Successfully initialized with logarithmic volume curves');
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
      // Load mappings when MIDI device connects
      setTimeout(() => {
        window.midiController.loadMappings();
      }, 1000);
    });

    // Listen for MIDI messages during learning
    window.midiController.on('midiMessage', (message) => {
      console.log('AudioManager: MIDI message received:', message);
      // This will be handled by UI Manager for learning
    });

    // Listen for mappings loaded event
    window.midiController.on('mappingsLoaded', (mappings) => {
      console.log('AudioManager: MIDI mappings loaded:', Object.keys(mappings).length);
      this.emit('mappingsLoaded');
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

      // OBS InputLevelsMul is amplitude (0-1), InputLevelsDb is dB (-∞ to 0)
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

  // FIXED: Audio source control methods with exponential volume curves
  async setSourceVolume(sourceName, volume) {
    const source = this.audioSources.get(sourceName);
    if (!source) {
      throw new Error(`Audio source '${sourceName}' not found`);
    }

    try {
      // Apply exponential curve for better human perception
      const exponentialVolume = this.applyVolumeGammaCurve(volume);
      
      console.log(`AudioManager: Setting volume for ${sourceName}: Linear ${volume.toFixed(3)} → Exponential ${exponentialVolume.toFixed(3)}`);
      
      await window.obsManager.setInputVolume(sourceName, exponentialVolume);
      source.volume = exponentialVolume;
      
      // Save setting (save the original linear value)
      this.saveSourceSettings(sourceName, { volume: volume });
      
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

  // ENHANCED: Volume curve functions for human perception
  
  /**
   * Apply exponential gamma curve for better human audio perception
   * Uses x^4 curve which is optimal for 60dB range (typical consumer audio)
   * Reference: https://www.dr-lex.be/info-stuff/volumecontrols.html
   */
  applyVolumeGammaCurve(linearValue) {
    // Ensure input is 0-1
    const x = Math.max(0, Math.min(1, linearValue));
    
    // x^4 curve - good approximation for human audio perception
    // This makes the lower end more sensitive, upper end less sensitive
    return Math.pow(x, 4);
  }

  /**
   * Apply logarithmic curve with soft knee for better usability
   * This prevents the "too sensitive at top" problem
   */
  applyLogarithmicCurveWithSoftKnee(linearValue) {
    const x = Math.max(0, Math.min(1, linearValue));
    
    if (x === 0) return 0;
    
    // Soft knee curve: more linear at top, more logarithmic at bottom
    // This provides better control across the entire range
    if (x < 0.1) {
      // Very quiet: use strong exponential curve
      return Math.pow(x * 10, 4) * 0.1;
    } else if (x > 0.8) {
      // Loud section: more linear for better control
      return 0.64 + (x - 0.8) * 1.8; // 0.8^4 ≈ 0.4096, scaled
    } else {
      // Middle section: x^4 curve
      return Math.pow(x, 4);
    }
  }

  /**
   * Convert linear amplitude to proper dB display
   * This fixes the visualization issue
   */
  amplitudeToDbDisplay(amplitude) {
    if (amplitude <= 0.0001) return -100; // -∞ represented as -100
    
    // Convert amplitude to dB: 20 * log10(amplitude)
    const db = 20 * Math.log10(amplitude);
    
    // Clamp to reasonable range
    return Math.max(-100, Math.min(0, db));
  }

  /**
   * Convert dB to visual meter position (0-1) with logarithmic scaling
   * This makes the meter more readable like professional audio gear
   */
  dbToMeterPosition(db) {
    if (db <= -60) return 0; // Below -60dB = 0% meter
    if (db >= 0) return 1;   // 0dB = 100% meter
    
    // Logarithmic scale: more space for louder signals (-20dB to 0dB)
    // This matches professional audio equipment behavior
    if (db > -20) {
      // Upper section (-20dB to 0dB): 50% of meter space
      return 0.5 + (db + 20) / 40; // 0.5 to 1.0
    } else {
      // Lower section (-60dB to -20dB): 50% of meter space  
      return (db + 60) / 80; // 0.0 to 0.5
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
      controlType: controlType, 
      midiDescription: window.midiController.getMidiEventDescription(midiEvent),
      curveType: 'exponential' // Track what curve we're using
    };

    // Set up the MIDI mapping with exponential curve
    const action = {
      type: controlType,
      sourceName: sourceName,
      maxVolume: 1.0,
      curveType: 'exponential'
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

    console.log('AudioManager: MIDI mapping created with exponential curve:', mapping);
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

  // ENHANCED: Volume level utilities with proper dB handling
  dbToLinear(db) {
    if (db <= -100) return 0;
    return Math.pow(10, db / 20);
  }

  linearToDb(linear) {
    if (linear <= 0.0001) return -100;
    return 20 * Math.log10(linear);
  }

  /**
   * Format volume level for display - FIXED for logarithmic display
   */
  formatVolumeLevel(levelMul) {
    if (!levelMul || levelMul <= 0.0001) return '-∞ dB';
    
    // Convert amplitude to dB
    const db = this.amplitudeToDbDisplay(levelMul);
    
    // Format for display
    if (db <= -60) return '-∞ dB';
    return `${db.toFixed(1)} dB`;
  }

  /**
   * Format volume percentage for display
   */
  formatVolumePercent(volume) {
    return `${Math.round(volume * 100)}%`;
  }

  /**
   * Get meter position for visualization - FIXED for logarithmic meter
   */
  getMeterPosition(levelMul) {
    const db = this.amplitudeToDbDisplay(levelMul);
    return this.dbToMeterPosition(db);
  }

  /**
   * Get level color based on dB value
   */
  getLevelColor(levelMul) {
    const db = this.amplitudeToDbDisplay(levelMul);
    
    if (db > -10) return 'high';        // Red: > -10dB (very loud)
    if (db > -20) return 'medium';      // Yellow: -20 to -10dB (good level)
    return 'low';                       // Green: < -20dB (quiet)
  }

  // OBS Volume conversion - FIXED for exponential curves
  obsVolumeToLinear(obsVolume) {
    // OBS volume is already amplitude (0-1), but we need to reverse our curve
    return Math.pow(obsVolume, 1/4); // Inverse of x^4
  }

  linearToObsVolume(linearValue) {
    // Apply our exponential curve
    return this.applyVolumeGammaCurve(linearValue);
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

  // Debug methods
  testVolumeCurves() {
    console.log('=== Volume Curve Test ===');
    for (let i = 0; i <= 10; i++) {
      const linear = i / 10;
      const exponential = this.applyVolumeGammaCurve(linear);
      const softKnee = this.applyLogarithmicCurveWithSoftKnee(linear);
      const db = this.amplitudeToDbDisplay(exponential);
      
      console.log(`Linear ${linear.toFixed(1)} → Exp ${exponential.toFixed(3)} → ${db.toFixed(1)}dB | SoftKnee ${softKnee.toFixed(3)}`);
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
console.log('Creating Audio Manager with logarithmic volume curves...');
window.audioManager = new AudioManager();