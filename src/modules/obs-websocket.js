// OBS WebSocket Manager - Fixed authentication and scene support
class OBSWebSocketManager {
  constructor() {
    this.obs = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isIdentified = false; // Track identification status
    this.listeners = new Map();
    this.audioSources = new Map();
    this.scenes = new Map(); // Store scenes
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    console.log('OBSWebSocketManager: Constructor called');
    this.initializeOBS();
  }

  async initializeOBS() {
    try {
      // Try electron require first
      if (typeof window.require !== 'undefined') {
        try {
          const OBSWebSocket = window.require('obs-websocket-js').default;
          this.obs = new OBSWebSocket();
          this.setupEventHandlers();
          console.log('OBS WebSocket initialized via electron require');
          return;
        } catch (error) {
          console.warn('Could not load obs-websocket-js via require:', error.message);
        }
      }

      // Fallback: Use native WebSocket implementation
      console.log('Using fallback WebSocket implementation for OBS');
      this.setupFallbackWebSocket();
      
    } catch (error) {
      console.error('Failed to initialize OBS WebSocket:', error);
      this.emit('error', error);
    }
  }

  setupFallbackWebSocket() {
    // Simple WebSocket implementation for basic OBS communication
    this.obs = {
      connect: (url, password, options) => this.fallbackConnect(url, password, options),
      disconnect: () => this.fallbackDisconnect(),
      call: (request, data) => this.fallbackCall(request, data),
      on: (event, callback) => this.on(event, callback),
      off: (event, callback) => this.off(event, callback)
    };
  }

  async fallbackConnect(url, password, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        console.log('OBS: Connecting to', url);
        this.websocket = new WebSocket(url);
        this.messageId = 1;
        this.pendingRequests = new Map();
        this.isIdentified = false;

        this.websocket.onopen = () => {
          console.log('OBS: WebSocket connection opened');
          this.isConnecting = false;
          // Don't set isConnected yet - wait for identification
        };

        this.websocket.onclose = (event) => {
          console.log('OBS: WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.isConnecting = false;
          this.isIdentified = false;
          this.emit('ConnectionClosed');
        };

        this.websocket.onerror = (error) => {
          console.error('OBS: WebSocket error:', error);
          this.isConnected = false;
          this.isConnecting = false;
          this.isIdentified = false;
          this.emit('ConnectionError', error);
          reject(error);
        };

        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        // Set up connection timeout
        setTimeout(() => {
          if (!this.isIdentified) {
            console.error('OBS: Connection timeout - not identified within 10 seconds');
            this.websocket.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('OBS: Received message:', message.op, message.d?.eventType || message.d?.requestType);
      
      switch (message.op) {
        case 0: // Hello
          this.handleHello(message.d);
          break;
        case 2: // Identified
          this.handleIdentified(message.d);
          break;
        case 5: // Event
          this.handleOBSEvent(message.d);
          break;
        case 7: // RequestResponse
          this.handleRequestResponse(message);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  handleHello(data) {
    console.log('OBS: Received Hello message');
    
    // Send Identify message
    const identifyMessage = {
      op: 1, // Identify
      d: {
        rpcVersion: 1,
        eventSubscriptions: 2047 | 65536 // All events + high volume
      }
    };

    // Add authentication if needed
    if (data.authentication) {
      // For now, skip authentication - will implement if password is set
      console.log('OBS: Authentication required but not implemented in fallback');
    }

    console.log('OBS: Sending Identify message');
    this.websocket.send(JSON.stringify(identifyMessage));
  }

  handleIdentified(data) {
    console.log('OBS: Successfully identified!');
    this.isConnected = true;
    this.isIdentified = true;
    this.reconnectAttempts = 0;
    this.clearReconnectInterval();
    this.emit('ConnectionOpened');
  }

  handleOBSEvent(eventData) {
    const eventType = eventData.eventType;
    console.log('OBS: Event received:', eventType);
    
    switch (eventType) {
      case 'InputVolumeMeters':
        this.emit('InputVolumeMeters', eventData.eventData);
        break;
      case 'InputVolumeChanged':
        this.emit('InputVolumeChanged', eventData.eventData);
        break;
      case 'InputMuteStateChanged':
        this.emit('InputMuteStateChanged', eventData.eventData);
        break;
      case 'InputCreated':
        this.emit('InputCreated', eventData.eventData);
        break;
      case 'InputRemoved':
        this.emit('InputRemoved', eventData.eventData);
        break;
      case 'CurrentProgramSceneChanged':
        this.emit('CurrentProgramSceneChanged', eventData.eventData);
        break;
      case 'SceneCreated':
        this.emit('SceneCreated', eventData.eventData);
        break;
      case 'SceneRemoved':
        this.emit('SceneRemoved', eventData.eventData);
        break;
    }
  }

  handleRequestResponse(message) {
    const requestId = message.d.requestId;
    const request = this.pendingRequests.get(requestId);
    
    if (request) {
      this.pendingRequests.delete(requestId);
      
      if (message.d.requestStatus.result) {
        console.log('OBS: Request successful:', message.d.requestStatus.code);
        request.resolve(message.d.responseData || {});
      } else {
        console.error('OBS: Request failed:', message.d.requestStatus.comment || 'Unknown error');
        request.reject(new Error(message.d.requestStatus.comment || 'Request failed'));
      }
    }
  }

  async fallbackCall(requestType, requestData = {}) {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${this.messageId++}`;
      
      const message = {
        op: 6, // Request
        d: {
          requestType,
          requestId,
          requestData
        }
      };

      console.log('OBS: Sending request:', requestType, requestData);
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.websocket.send(JSON.stringify(message));
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  fallbackDisconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.pendingRequests?.clear();
    this.isConnected = false;
    this.isIdentified = false;
  }

  setupEventHandlers() {
    if (!this.obs) return;

    // Connection events
    this.obs.on('ConnectionOpened', () => {
      console.log('OBS WebSocket connected');
      this.isConnected = true;
      this.isConnecting = false;
      this.isIdentified = true; // For library version
      this.reconnectAttempts = 0;
      this.clearReconnectInterval();
      this.emit('connected');
    });

    this.obs.on('ConnectionClosed', () => {
      console.log('OBS WebSocket disconnected');
      this.isConnected = false;
      this.isConnecting = false;
      this.isIdentified = false;
      this.emit('disconnected');
      this.startReconnectTimer();
    });

    this.obs.on('ConnectionError', (error) => {
      console.error('OBS WebSocket connection error:', error);
      this.isConnected = false;
      this.isConnecting = false;
      this.isIdentified = false;
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

    // Scene events
    this.obs.on('CurrentProgramSceneChanged', (data) => {
      this.handleSceneChanged(data);
    });
  }

  async connect(url = 'ws://localhost:4455', password = '', options = {}) {
    if (this.isConnected || this.isConnecting) {
      console.log('OBS: Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.emit('connecting');

    try {
      const connectOptions = {
        eventSubscriptions: 2047 | 65536, // All regular events + InputVolumeMeters
        rpcVersion: 1,
        ...options
      };

      if (this.obs && typeof this.obs.connect === 'function') {
        await this.obs.connect(url, password, connectOptions);
        console.log('OBS: Connected successfully');
      } else {
        throw new Error('OBS WebSocket not properly initialized');
      }
    } catch (error) {
      this.isConnecting = false;
      console.error('OBS: Connection failed:', error);
      throw error;
    }
  }

  disconnect() {
    this.clearReconnectInterval();
    if (this.obs && this.isConnected) {
      this.obs.disconnect();
    }
  }

  startReconnectTimer() {
    if (this.reconnectInterval || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectInterval = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`OBS: Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      const settings = window.settingsManager?.getObsSettings() || {};
      if (settings.autoConnect !== false) {
        this.connect(settings.url, settings.password).catch(error => {
          console.error('OBS: Reconnection failed:', error);
        });
      }
      
      this.reconnectInterval = null;
    }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
  }

  clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Audio source management
  async getAudioSources() {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      console.log('OBS: Getting input list...');
      const response = await this.obs.call('GetInputList');
      const inputs = response.inputs || [];
      
      console.log('OBS: Received inputs:', inputs.length);

      // Filter for audio sources
      const audioInputs = inputs.filter(input => {
        const kind = input.inputKind;
        return kind && (
          kind.includes('audio') ||
          kind === 'wasapi_input_capture' ||
          kind === 'wasapi_output_capture' ||
          kind === 'pulse_input_capture' ||
          kind === 'pulse_output_capture' ||
          kind === 'alsa_input_capture' ||
          kind === 'coreaudio_input_capture' ||
          kind === 'coreaudio_output_capture'
        );
      });

      console.log('OBS: Found audio inputs:', audioInputs.length);

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
          
          console.log('OBS: Got volume/mute info for', input.inputName);
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

  // Scene management
  async getScenes() {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      console.log('OBS: Getting scene list...');
      const response = await this.obs.call('GetSceneList');
      const scenes = response.scenes || [];
      
      console.log('OBS: Found scenes:', scenes.length);

      // Update internal scenes map
      this.scenes.clear();
      scenes.forEach(scene => {
        this.scenes.set(scene.sceneName, {
          name: scene.sceneName,
          index: scene.sceneIndex
        });
      });

      this.emit('scenesUpdated', Array.from(this.scenes.values()));
      return Array.from(this.scenes.values());
    } catch (error) {
      console.error('Error getting scenes:', error);
      throw error;
    }
  }

  async setCurrentScene(sceneName) {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      console.log('OBS: Setting current scene to:', sceneName);
      await this.obs.call('SetCurrentProgramScene', {
        sceneName: sceneName
      });
      return true;
    } catch (error) {
      console.error(`Error setting scene to ${sceneName}:`, error);
      throw error;
    }
  }

  async setInputVolume(inputName, volume) {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      await this.obs.call('SetInputVolume', {
        inputName,
        inputVolumeMul: Math.max(0, Math.min(20, volume))
      });
      
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
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      await this.obs.call('SetInputMute', {
        inputName,
        inputMuted: muted
      });
      
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
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      const result = await this.obs.call('ToggleInputMute', {
        inputName
      });
      
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
    setTimeout(() => {
      this.getAudioSources().catch(console.error);
    }, 100);
  }

  handleInputRemoved(data) {
    console.log('Input removed:', data.inputName);
    this.audioSources.delete(data.inputName);
    this.emit('audioSourceRemoved', data.inputName);
  }

  handleSceneChanged(data) {
    console.log('Scene changed to:', data.sceneName);
    this.emit('sceneChanged', data.sceneName);
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
      identified: this.isIdentified,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getAudioSource(name) {
    return this.audioSources.get(name);
  }

  getAllAudioSources() {
    return Array.from(this.audioSources.values());
  }

  getAllScenes() {
    return Array.from(this.scenes.values());
  }

  destroy() {
    this.disconnect();
    this.audioSources.clear();
    this.scenes.clear();
    this.listeners.clear();
  }
}

// Export as global variable
console.log('Creating OBS WebSocket Manager...');
window.obsManager = new OBSWebSocketManager();