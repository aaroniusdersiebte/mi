const { WebMidi } = require('webmidi');

class MidiController {
  constructor() {
    this.isEnabled = false;
    this.connectedDevices = new Map();
    this.activeDevice = null;
    this.listeners = new Map();
    this.isLearning = false;
    this.learningCallback = null;
    this.controllerMappings = new Map();
    this.lastValues = new Map(); // Cache for controller values to detect changes

    this.initializeMidi();
  }

  async initializeMidi() {
    try {
      await WebMidi.enable();
      console.log('WebMidi enabled successfully');
      this.isEnabled = true;
      this.scanDevices();
      this.setupDeviceEvents();
      this.emit('enabled');
    } catch (error) {
      console.error('Error enabling WebMidi:', error);
      this.emit('error', error);
    }
  }

  setupDeviceEvents() {
    // Listen for device connections
    WebMidi.addListener('connected', (event) => {
      console.log('MIDI device connected:', event.port.name);
      this.scanDevices();
    });

    WebMidi.addListener('disconnected', (event) => {
      console.log('MIDI device disconnected:', event.port.name);
      this.connectedDevices.delete(event.port.id);
      
      if (this.activeDevice && this.activeDevice.id === event.port.id) {
        this.activeDevice = null;
        this.emit('deviceDisconnected');
      }
      
      this.scanDevices();
    });
  }

  scanDevices() {
    const devices = [];
    
    // Input devices
    WebMidi.inputs.forEach(input => {
      const deviceInfo = {
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        type: 'input',
        connected: input.state === 'connected'
      };
      
      devices.push(deviceInfo);
      this.connectedDevices.set(input.id, deviceInfo);
    });

    console.log('Available MIDI devices:', devices);
    this.emit('devicesUpdated', devices);
    
    // Auto-connect to first available device if none selected
    if (!this.activeDevice && devices.length > 0) {
      this.connectToDevice(devices[0].id);
    }

    return devices;
  }

  connectToDevice(deviceId) {
    try {
      const input = WebMidi.getInputById(deviceId);
      if (!input) {
        throw new Error(`MIDI device with ID ${deviceId} not found`);
      }

      // Disconnect from previous device
      if (this.activeDevice) {
        this.disconnectFromDevice();
      }

      this.activeDevice = {
        id: deviceId,
        name: input.name,
        input: input
      };

      // Set up MIDI message listeners
      this.setupMidiListeners(input);

      console.log(`Connected to MIDI device: ${input.name}`);
      this.emit('deviceConnected', this.activeDevice);
      
      return true;
    } catch (error) {
      console.error('Error connecting to MIDI device:', error);
      this.emit('error', error);
      return false;
    }
  }

  disconnectFromDevice() {
    if (this.activeDevice && this.activeDevice.input) {
      // Remove all listeners
      this.activeDevice.input.removeListener();
      this.activeDevice = null;
      this.controllerMappings.clear();
      this.lastValues.clear();
      this.emit('deviceDisconnected');
    }
  }

  setupMidiListeners(input) {
    // Control Change messages (knobs, faders, etc.)
    input.addListener('controlchange', (event) => {
      this.handleControlChange(event);
    });

    // Note On messages (buttons pressed)
    input.addListener('noteon', (event) => {
      this.handleNoteOn(event);
    });

    // Note Off messages (buttons released)  
    input.addListener('noteoff', (event) => {
      this.handleNoteOff(event);
    });

    // Program Change messages
    input.addListener('programchange', (event) => {
      this.handleProgramChange(event);
    });

    // Pitch Bend messages
    input.addListener('pitchbend', (event) => {
      this.handlePitchBend(event);
    });
  }

  handleControlChange(event) {
    const controllerId = `cc_${event.controller.number}_${event.channel}`;
    const value = event.value;
    const normalizedValue = value / 127; // Normalize to 0-1

    // Store the last value for this controller
    this.lastValues.set(controllerId, normalizedValue);

    const midiEvent = {
      type: 'controlchange',
      id: controllerId,
      controller: event.controller.number,
      channel: event.channel,
      value: value,
      normalizedValue: normalizedValue,
      timestamp: Date.now()
    };

    if (this.isLearning) {
      this.handleLearningEvent(midiEvent);
    } else {
      this.handleMappedEvent(midiEvent);
    }

    this.emit('midiMessage', midiEvent);
  }

  handleNoteOn(event) {
    const noteId = `note_${event.note.number}_${event.channel}`;
    
    const midiEvent = {
      type: 'noteon',
      id: noteId,
      note: event.note.number,
      channel: event.channel,
      velocity: event.velocity,
      normalizedVelocity: event.velocity / 127,
      timestamp: Date.now()
    };

    if (this.isLearning) {
      this.handleLearningEvent(midiEvent);
    } else {
      this.handleMappedEvent(midiEvent);
    }

    this.emit('midiMessage', midiEvent);
  }

  handleNoteOff(event) {
    const noteId = `note_${event.note.number}_${event.channel}`;
    
    const midiEvent = {
      type: 'noteoff',
      id: noteId,
      note: event.note.number,
      channel: event.channel,
      velocity: event.velocity,
      timestamp: Date.now()
    };

    this.emit('midiMessage', midiEvent);
  }

  handleProgramChange(event) {
    const programId = `program_${event.channel}`;
    
    const midiEvent = {
      type: 'programchange',
      id: programId,
      value: event.value,
      channel: event.channel,
      timestamp: Date.now()
    };

    if (this.isLearning) {
      this.handleLearningEvent(midiEvent);
    } else {
      this.handleMappedEvent(midiEvent);
    }

    this.emit('midiMessage', midiEvent);
  }

  handlePitchBend(event) {
    const pitchId = `pitch_${event.channel}`;
    const normalizedValue = (event.value + 8192) / 16383; // Normalize pitch bend to 0-1
    
    const midiEvent = {
      type: 'pitchbend',
      id: pitchId,
      value: event.value,
      normalizedValue: normalizedValue,
      channel: event.channel,
      timestamp: Date.now()
    };

    if (this.isLearning) {
      this.handleLearningEvent(midiEvent);
    } else {
      this.handleMappedEvent(midiEvent);
    }

    this.emit('midiMessage', midiEvent);
  }

  // MIDI Learning
  startLearning(callback) {
    this.isLearning = true;
    this.learningCallback = callback;
    this.emit('learningStarted');
    console.log('MIDI learning started - move a control on your MIDI device');
  }

  stopLearning() {
    this.isLearning = false;
    this.learningCallback = null;
    this.emit('learningStopped');
    console.log('MIDI learning stopped');
  }

  handleLearningEvent(midiEvent) {
    if (this.learningCallback) {
      this.learningCallback(midiEvent);
      this.stopLearning();
    }
  }

  // Control Mapping
  mapControl(midiId, action) {
    this.controllerMappings.set(midiId, action);
    
    // Save to settings
    if (window.settingsManager) {
      window.settingsManager.setMidiMapping(midiId, action);
    }
    
    this.emit('mappingAdded', { midiId, action });
    console.log(`MIDI control mapped: ${midiId} -> ${action.type}`);
  }

  removeMapping(midiId) {
    this.controllerMappings.delete(midiId);
    
    // Remove from settings
    if (window.settingsManager) {
      window.settingsManager.removeMidiMapping(midiId);
    }
    
    this.emit('mappingRemoved', midiId);
    console.log(`MIDI mapping removed: ${midiId}`);
  }

  handleMappedEvent(midiEvent) {
    const mapping = this.controllerMappings.get(midiEvent.id);
    if (!mapping) return;

    try {
      switch (mapping.type) {
        case 'volume':
          this.handleVolumeControl(midiEvent, mapping);
          break;
        case 'mute':
          this.handleMuteControl(midiEvent, mapping);
          break;
        case 'scene':
          this.handleSceneControl(midiEvent, mapping);
          break;
        default:
          console.warn('Unknown mapping type:', mapping.type);
      }
    } catch (error) {
      console.error('Error handling mapped MIDI event:', error);
    }
  }

  handleVolumeControl(midiEvent, mapping) {
    if (midiEvent.type === 'controlchange' && window.obsManager) {
      const volume = midiEvent.normalizedValue * (mapping.maxVolume || 1.0);
      window.obsManager.setInputVolume(mapping.sourceName, volume)
        .catch(error => console.error('Error setting volume:', error));
    }
  }

  handleMuteControl(midiEvent, mapping) {
    if (midiEvent.type === 'noteon' && window.obsManager) {
      window.obsManager.toggleInputMute(mapping.sourceName)
        .catch(error => console.error('Error toggling mute:', error));
    }
  }

  handleSceneControl(midiEvent, mapping) {
    // Implementation for scene switching would go here
    console.log('Scene control not yet implemented');
  }

  // Load mappings from settings
  loadMappings() {
    if (window.settingsManager) {
      const mappings = window.settingsManager.getMidiMappings();
      Object.entries(mappings).forEach(([midiId, action]) => {
        this.controllerMappings.set(midiId, action);
      });
      console.log(`Loaded ${Object.keys(mappings).length} MIDI mappings`);
    }
  }

  // Utility methods
  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  getActiveDevice() {
    return this.activeDevice;
  }

  getAllMappings() {
    return Array.from(this.controllerMappings.entries()).map(([midiId, action]) => ({
      midiId,
      action
    }));
  }

  getMidiEventDescription(midiEvent) {
    switch (midiEvent.type) {
      case 'controlchange':
        return `Controller ${midiEvent.controller} (Channel ${midiEvent.channel})`;
      case 'noteon':
        return `Note ${midiEvent.note} (Channel ${midiEvent.channel})`;
      case 'programchange':
        return `Program Change (Channel ${midiEvent.channel})`;
      case 'pitchbend':
        return `Pitch Bend (Channel ${midiEvent.channel})`;
      default:
        return `${midiEvent.type} (Channel ${midiEvent.channel})`;
    }
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
          console.error(`Error in MIDI event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy() {
    this.disconnectFromDevice();
    this.listeners.clear();
    this.controllerMappings.clear();
    this.lastValues.clear();
    
    if (this.isEnabled) {
      WebMidi.disable();
    }
  }
}

// Export singleton instance
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new MidiController();
} else {
  window.midiController = new MidiController();
}