const OBSWebSocket = require('obs-websocket-js').default;

class OBSWebSocketManager {
  constructor() {
    this.obs = new OBSWebSocket();
    this.isConnected = false;
    this.isConnecting = false;
    this.listeners = new Map();
    this.audioSources = new Map();
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Connection events
    this.obs.on('ConnectionOpened', () => {
      console.log('OBS WebSocket connected');
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.clearReconnectInterval();
      this.emit('connected');
    });

    this.obs.on('ConnectionClosed', () => {
      console.log('OBS WebSocket disconnected');
      this.isConnected = false;
      this.isConnecting = false;
      this.emit('disconnected');
      this.startReconnectTimer();
    });

    this.obs.on('ConnectionError', (error) => {
      console.error('OBS WebSocket connection error:', error);
      this.isConnected = false;
      this.isConnecting = false;
      this.emit('error', error);
      this.startReconnectTimer();
    });

    // Audio events
    this.obs.on('InputVolumeMeters', (data) => {
      this.handleVolumeMeters(data);
    });

    this.obs.on('InputVolumeChanged', (data) => {
      this.handleVolumeChanged(data);
    });

    this.obs.on('InputMuteStateChanged', (data) => {
      this.handleMuteStateChanged(data);
    });

    // Source events
    this.obs.on('InputCreated', (data) => {
      this.handleInputCreated(data);
    });

    this.obs.on('InputRemoved', (data) => {
      this.handleInputRemoved(data);
    });
  }

  async connect(url = 'ws://localhost:4455', password = '') {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.emit('connecting');

    try {
      await this.obs.connect(url, password, {
        eventSubscriptions: 
          2047 | // All regular events  
          65536, // InputVolumeMeters high-volume event
        rpcVersion: 1
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  disconnect() {
    this.clearReconnectInterval();
    if (this.isConnected) {
      this.obs.disconnect();
    }
  }

  startReconnectTimer() {
    if (this.reconnectInterval || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectInterval = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      const settings = window.settingsManager?.getObsSettings() || {};
      if (settings.autoConnect) {
        this.connect(settings.url, settings.password).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
      
      this.reconnectInterval = null;
    }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)); // Exponential backoff, max 30s
  }

  clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Audio source management
  async getAudioSources() {
    if (!this.isConnected) {
      throw new Error('Not connected to OBS');
    }

    try {
      const { inputs } = await this.obs.call('GetInputList');
      
      // Filter for audio sources
      const audioInputs = inputs.filter(input => {
        return input.inputKind && (
          input.inputKind.includes('audio') ||
          input.inputKind === 'wasapi_input_capture' ||
          input.inputKind === 'wasapi_output_capture' ||
          input.inputKind === 'pulse_input_capture' ||
          input.inputKind === 'pulse_output_capture' ||
          input.inputKind === 'alsa_input_capture' ||
          input.inputKind === 'coreaudio_input_capture' ||
          input.inputKind === 'coreaudio_output_capture'
        );
      });

      // Update internal sources map
      this.audioSources.clear();
      for (const input of audioInputs) {
        const sourceInfo = {
          name: input.inputName,
          kind: input.inputKind,
          volume: 1.0,
          muted: false,
          levelMul: 0,
          levelDb: -100
        };
        
        // Get current volume and mute state
        try {
          const volumeInfo = await this.obs.call('GetInputVolume', {
            inputName: input.inputName
          });
          sourceInfo.volume = volumeInfo.inputVolumeMul;
          
          const muteInfo = await this.obs.call('GetInputMute', {
            inputName: input.inputName
          });
          sourceInfo.muted = muteInfo.inputMuted;
        } catch (error) {
          console.warn(`Could not get volume/mute info for ${input.inputName}:`, error);
        }

        this.audioSources.set(input.inputName, sourceInfo);
      }

      this.emit('audioSourcesUpdated', Array.from(this.audioSources.values()));
      return Array.from(this.audioSources.values());
    } catch (error) {
      console.error('Error getting audio sources:', error);
      throw error;
    }
  }

  async setInputVolume(inputName, volume) {
    if (!this.isConnected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('SetInputVolume', {
        inputName,
        inputVolumeMul: Math.max(0, Math.min(20, volume))
      });
      
      // Update local cache
      if (this.audioSources.has(inputName)) {
        this.audioSources.get(inputName).volume = volume;
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting volume for ${inputName}:`, error);
      throw error;
    }
  }

  async setInputMute(inputName, muted) {
    if (!this.isConnected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('SetInputMute', {
        inputName,
        inputMuted: muted
      });
      
      // Update local cache
      if (this.audioSources.has(inputName)) {
        this.audioSources.get(inputName).muted = muted;
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting mute for ${inputName}:`, error);
      throw error;
    }
  }

  async toggleInputMute(inputName) {
    if (!this.isConnected) {
      throw new Error('Not connected to OBS');
    }

    try {
      const result = await this.obs.call('ToggleInputMute', {
        inputName
      });
      
      // Update local cache
      if (this.audioSources.has(inputName)) {
        this.audioSources.get(inputName).muted = result.inputMuted;
      }
      
      return result.inputMuted;
    } catch (error) {
      console.error(`Error toggling mute for ${inputName}:`, error);
      throw error;
    }
  }

  // Event handlers
  handleVolumeMeters(data) {
    if (!data.inputs) return;

    data.inputs.forEach(input => {
      if (this.audioSources.has(input.inputName)) {
        const source = this.audioSources.get(input.inputName);
        source.levelMul = input.inputLevelsMul?.[0]?.[0] || 0;
        source.levelDb = input.inputLevelsDb?.[0]?.[0] || -100;
      }
    });

    this.emit('volumeMeters', data);
  }

  handleVolumeChanged(data) {
    if (this.audioSources.has(data.inputName)) {
      this.audioSources.get(data.inputName).volume = data.inputVolumeMul;
    }
    this.emit('volumeChanged', data);
  }

  handleMuteStateChanged(data) {
    if (this.audioSources.has(data.inputName)) {
      this.audioSources.get(data.inputName).muted = data.inputMuted;
    }
    this.emit('muteStateChanged', data);
  }

  handleInputCreated(data) {
    console.log('Input created:', data.inputName);
    // Refresh audio sources when new input is created
    setTimeout(() => {
      this.getAudioSources().catch(console.error);
    }, 100);
  }

  handleInputRemoved(data) {
    console.log('Input removed:', data.inputName);
    this.audioSources.delete(data.inputName);
    this.emit('audioSourceRemoved', data.inputName);
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
          console.error(`Error in OBS event listener for ${event}:`, error);
        }
      });
    }
  }

  // Utility methods
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getAudioSource(name) {
    return this.audioSources.get(name);
  }

  getAllAudioSources() {
    return Array.from(this.audioSources.values());
  }
}

// Export singleton instance
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new OBSWebSocketManager();
} else {
  window.obsManager = new OBSWebSocketManager();
}