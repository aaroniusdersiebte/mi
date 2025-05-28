// Enhanced MIDI Controller with Scene Support and Learning
class MidiController {
  constructor() {
    this.isEnabled = false;
    this.connectedDevices = new Map();
    this.activeDevice = null;
    this.listeners = new Map();
    this.isLearning = false;
    this.learningCallback = null;
    this.learningTimeout = null;
    this.controllerMappings = new Map();
    this.lastValues = new Map();
    this.sceneMappings = new Map(); // Separate mappings for scenes

    console.log('MidiController: Constructor called');
    
    // Initialize after a short delay to ensure WebMIDI API is available
    setTimeout(() => this.initializeMidi(), 100);
  }

  async initializeMidi() {
    try {
      // Check if Web MIDI API is available
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported in this browser');
      }

      console.log('MIDI: Requesting MIDI access...');
      const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      
      this.midiAccess = midiAccess;
      this.isEnabled = true;
      
      console.log('MIDI: Access granted successfully');
      this.scanDevices();
      this.setupDeviceEvents();
      this.emit('enabled');
    } catch (error) {
      console.error('Error enabling MIDI:', error);
      this.emit('error', error);
    }
  }

  setupDeviceEvents() {
    if (!this.midiAccess) return;

    // Listen for device connections/disconnections
    this.midiAccess.onstatechange = (event) => {
      console.log('MIDI: Device state changed:', event.port.name, event.port.state);
      
      if (event.port.state === 'connected') {
        console.log('MIDI: Device connected:', event.port.name);
        this.scanDevices();
      } else if (event.port.state === 'disconnected') {
        console.log('MIDI: Device disconnected:', event.port.name);
        this.connectedDevices.delete(event.port.id);
        
        if (this.activeDevice && this.activeDevice.id === event.port.id) {
          this.activeDevice = null;
          this.emit('deviceDisconnected');
        }
        
        this.scanDevices();
      }
    };
  }

  scanDevices() {
    if (!this.midiAccess) {
      console.warn('MIDI: Access not available for device scan');
      return [];
    }

    const devices = [];
    
    // Scan input devices
    for (const input of this.midiAccess.inputs.values()) {
      if (input.state === 'connected') {
        const deviceInfo = {
          id: input.id,
          name: input.name,
          manufacturer: input.manufacturer || 'Unknown',
          type: 'input',
          connected: true
        };
        
        devices.push(deviceInfo);
        this.connectedDevices.set(input.id, deviceInfo);
      }
    }

    console.log('MIDI: Available devices:', devices);
    this.emit('devicesUpdated', devices);
    
    // Auto-connect to first available device if none selected
    if (!this.activeDevice && devices.length > 0) {
      console.log('MIDI: Auto-connecting to first device:', devices[0].name);
      this.connectToDevice(devices[0].id);
    }

    return devices;
  }

  connectToDevice(deviceId) {
    if (!this.midiAccess) {
      console.error('MIDI: Access not available');
      return false;
    }

    try {
      const input = this.midiAccess.inputs.get(deviceId);
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

      console.log(`MIDI: Connected to device: ${input.name}`);
      this.emit('deviceConnected', this.activeDevice);
      
      return true;
    } catch (error) {
      console.error('MIDI: Error connecting to device:', error);
      this.emit('error', error);
      return false;
    }
  }

  disconnectFromDevice() {
    if (this.activeDevice && this.activeDevice.input) {
      // Remove listeners
      this.activeDevice.input.onmidimessage = null;
      this.activeDevice = null;
      this.controllerMappings.clear();
      this.lastValues.clear();
      this.emit('deviceDisconnected');
    }
  }

  setupMidiListeners(input) {
    input.onmidimessage = (event) => {
      this.handleMidiMessage(event);
    };
  }

  handleMidiMessage(event) {
    const [status, data1, data2] = event.data;
    const channel = (status & 0x0f) + 1; // MIDI channels are 1-16
    const messageType = status & 0xf0;

    let midiEvent = null;

    switch (messageType) {
      case 0xb0: // Control Change
        midiEvent = this.createControlChangeEvent(data1, data2, channel);
        break;
      case 0x90: // Note On
        if (data2 > 0) { // Velocity > 0 means note on
          midiEvent = this.createNoteOnEvent(data1, data2, channel);
        } else { // Velocity = 0 means note off
          midiEvent = this.createNoteOffEvent(data1, data2, channel);
        }
        break;
      case 0x80: // Note Off
        midiEvent = this.createNoteOffEvent(data1, data2, channel);
        break;
      case 0xc0: // Program Change
        midiEvent = this.createProgramChangeEvent(data1, channel);
        break;
      case 0xe0: // Pitch Bend
        const pitchValue = (data2 << 7) | data1;
        midiEvent = this.createPitchBendEvent(pitchValue, channel);
        break;
    }

    if (midiEvent) {
      console.log('MIDI: Message received:', midiEvent.type, midiEvent.id);
      
      if (this.isLearning) {
        this.handleLearningEvent(midiEvent);
      } else {
        this.handleMappedEvent(midiEvent);
      }
      this.emit('midiMessage', midiEvent);
    }
  }

  createControlChangeEvent(controller, value, channel) {
    const controllerId = `cc_${controller}_${channel}`;
    const normalizedValue = value / 127;

    this.lastValues.set(controllerId, normalizedValue);

    return {
      type: 'controlchange',
      id: controllerId,
      controller: controller,
      channel: channel,
      value: value,
      normalizedValue: normalizedValue,
      timestamp: Date.now()
    };
  }

  createNoteOnEvent(note, velocity, channel) {
    const noteId = `note_${note}_${channel}`;
    
    return {
      type: 'noteon',
      id: noteId,
      note: note,
      channel: channel,
      velocity: velocity,
      normalizedVelocity: velocity / 127,
      timestamp: Date.now()
    };
  }

  createNoteOffEvent(note, velocity, channel) {
    const noteId = `note_${note}_${channel}`;
    
    return {
      type: 'noteoff',
      id: noteId,
      note: note,
      channel: channel,
      velocity: velocity,
      timestamp: Date.now()
    };
  }

  createProgramChangeEvent(program, channel) {
    const programId = `program_${channel}`;
    
    return {
      type: 'programchange',
      id: programId,
      value: program,
      channel: channel,
      timestamp: Date.now()
    };
  }

  createPitchBendEvent(value, channel) {
    const pitchId = `pitch_${channel}`;
    const normalizedValue = value / 16383;
    
    return {
      type: 'pitchbend',
      id: pitchId,
      value: value,
      normalizedValue: normalizedValue,
      channel: channel,
      timestamp: Date.now()
    };
  }

  // MIDI Learning
  startLearning(callback, timeout = 10000) {
    if (this.isLearning) {
      this.stopLearning();
    }

    this.isLearning = true;
    this.learningCallback = callback;
    
    // Set timeout for learning
    this.learningTimeout = setTimeout(() => {
      console.log('MIDI: Learning timeout');
      this.stopLearning();
    }, timeout);

    this.emit('learningStarted');
    console.log('MIDI: Learning started - press any control on your MIDI device');
  }

  stopLearning() {
    this.isLearning = false;
    this.learningCallback = null;
    
    if (this.learningTimeout) {
      clearTimeout(this.learningTimeout);
      this.learningTimeout = null;
    }
    
    this.emit('learningStopped');
    console.log('MIDI: Learning stopped');
  }

  handleLearningEvent(midiEvent) {
    if (this.learningCallback) {
      console.log('MIDI: Learning captured event:', midiEvent);
      this.learningCallback(midiEvent);
      this.stopLearning();
    }
  }

  // Control Mapping
  mapControl(midiId, action) {
    console.log('MIDI: Mapping control:', midiId, 'to action:', action);
    this.controllerMappings.set(midiId, action);
    
    // Save to settings
    if (window.settingsManager) {
      window.settingsManager.setMidiMapping(midiId, action);
    }
    
    this.emit('mappingAdded', { midiId, action });
    console.log(`MIDI: Control mapped: ${midiId} -> ${action.type}`);
  }

  removeMapping(midiId) {
    this.controllerMappings.delete(midiId);
    
    // Remove from settings
    if (window.settingsManager) {
      window.settingsManager.removeMidiMapping(midiId);
    }
    
    this.emit('mappingRemoved', midiId);
    console.log(`MIDI: Mapping removed: ${midiId}`);
  }

  handleMappedEvent(midiEvent) {
    const mapping = this.controllerMappings.get(midiEvent.id);
    if (!mapping) return;

    console.log('MIDI: Executing mapped action:', mapping.type, 'for', midiEvent.id);

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
          console.warn('MIDI: Unknown mapping type:', mapping.type);
      }
    } catch (error) {
      console.error('MIDI: Error handling mapped event:', error);
    }
  }

  handleVolumeControl(midiEvent, mapping) {
    if (midiEvent.type === 'controlchange' && window.obsManager) {
      const volume = midiEvent.normalizedValue * (mapping.maxVolume || 1.0);
      console.log('MIDI: Setting volume for', mapping.sourceName, 'to', volume);
      window.obsManager.setInputVolume(mapping.sourceName, volume)
        .then(() => console.log('MIDI: Volume set successfully'))
        .catch(error => console.error('MIDI: Error setting volume:', error));
    }
  }

  handleMuteControl(midiEvent, mapping) {
    if (midiEvent.type === 'noteon' && window.obsManager) {
      console.log('MIDI: Toggling mute for', mapping.sourceName);
      window.obsManager.toggleInputMute(mapping.sourceName)
        .then(() => console.log('MIDI: Mute toggled successfully'))
        .catch(error => console.error('MIDI: Error toggling mute:', error));
    }
  }

  handleSceneControl(midiEvent, mapping) {
    if (midiEvent.type === 'noteon' && window.obsManager) {
      console.log('MIDI: Switching to scene:', mapping.sceneName);
      window.obsManager.setCurrentScene(mapping.sceneName)
        .then(() => console.log('MIDI: Scene switched successfully'))
        .catch(error => console.error('MIDI: Error switching scene:', error));
    }
  }

  // Scene mapping methods
  mapSceneControl(midiEvent, sceneName) {
    const mapping = {
      midiId: midiEvent.id,
      sceneName: sceneName,
      type: 'scene',
      midiDescription: this.getMidiEventDescription(midiEvent)
    };

    const action = {
      type: 'scene',
      sceneName: sceneName
    };

    this.mapControl(midiEvent.id, action);
    
    // Also store in scene mappings for UI
    this.sceneMappings.set(midiEvent.id, mapping);
    
    return mapping;
  }

  // Load mappings from settings
  loadMappings() {
    if (window.settingsManager) {
      const mappings = window.settingsManager.getMidiMappings();
      Object.entries(mappings).forEach(([midiId, action]) => {
        this.controllerMappings.set(midiId, action);
        
        // If it's a scene mapping, also add to scene mappings
        if (action.type === 'scene') {
          this.sceneMappings.set(midiId, {
            midiId: midiId,
            sceneName: action.sceneName,
            type: 'scene',
            midiDescription: this.getMidiEventDescription({ id: midiId })
          });
        }
      });
      console.log(`MIDI: Loaded ${Object.keys(mappings).length} mappings`);
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

  getSceneMappings() {
    return Array.from(this.sceneMappings.values());
  }

  getMidiEventDescription(midiEvent) {
    const parts = midiEvent.id ? midiEvent.id.split('_') : [];
    
    switch (parts[0] || midiEvent.type) {
      case 'cc':
      case 'controlchange':
        const controller = parts[1] || midiEvent.controller;
        const channel = parts[2] || midiEvent.channel;
        return `Controller ${controller} (Ch ${channel})`;
      case 'note':
      case 'noteon':
        const note = parts[1] || midiEvent.note;
        const noteChannel = parts[2] || midiEvent.channel;
        return `Note ${note} (Ch ${noteChannel})`;
      case 'program':
      case 'programchange':
        const progChannel = parts[1] || midiEvent.channel;
        return `Program Change (Ch ${progChannel})`;
      case 'pitch':
      case 'pitchbend':
        const pitchChannel = parts[1] || midiEvent.channel;
        return `Pitch Bend (Ch ${pitchChannel})`;
      default:
        return `${midiEvent.type || 'Unknown'} (${midiEvent.id || 'No ID'})`;
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
    this.stopLearning();
    this.disconnectFromDevice();
    this.listeners.clear();
    this.controllerMappings.clear();
    this.sceneMappings.clear();
    this.lastValues.clear();
    this.isEnabled = false;
  }
}

// Export as global variable
console.log('Creating MIDI Controller...');
window.midiController = new MidiController();