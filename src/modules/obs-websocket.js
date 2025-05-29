// OBS WebSocket Manager - GEFIXT: Korrekte High-Volume Event Subscription für Volume Meters
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
    this.connectionHealth = {
      lastHeartbeat: 0,
      missedHeartbeats: 0,
      maxMissedHeartbeats: 3
    };

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
    // Enhanced WebSocket implementation for better OBS communication
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
        this.connectionHealth.lastHeartbeat = Date.now();

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
          this.connectionHealth.missedHeartbeats = 0;
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
            console.error('OBS: Connection timeout - not identified within 15 seconds');
            this.websocket.close();
            reject(new Error('Connection timeout'));
          } else {
            resolve();
          }
        }, 15000); // Increased timeout

      } catch (error) {
        reject(error);
      }
    });
  }

  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Update connection health
      this.connectionHealth.lastHeartbeat = Date.now();
      this.connectionHealth.missedHeartbeats = 0;
      
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
        case 9: // RequestBatch
          this.handleRequestBatchResponse(message);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  handleHello(data) {
    console.log('OBS: Received Hello message');
    
    // GEFIXT: Korrekte Event Subscriptions für Volume Meters
    // See: https://github.com/obsproject/obs-websocket/discussions/1152
    const identifyMessage = {
      op: 1, // Identify
      d: {
        rpcVersion: 1,
        // WICHTIG: InputVolumeMeters ist ein High-Volume Event (Bit 16)
        // Regular events: 511 (0x1FF) = Bits 0-8
        // High-volume events: 65536 (0x10000) = Bit 16 für InputVolumeMeters
        eventSubscriptions: 511 | 65536 // Regular events + InputVolumeMeters
      }
    };

    // Add authentication if needed
    if (data.authentication) {
      console.log('OBS: Authentication required but not implemented in fallback');
      // For production, implement proper authentication here
    }

    console.log('OBS: Sending Identify message with InputVolumeMeters subscription');
    this.websocket.send(JSON.stringify(identifyMessage));
  }

  handleIdentified(data) {
    console.log('OBS: Successfully identified with Volume Meters enabled!');
    this.isConnected = true;
    this.isIdentified = true;
    this.reconnectAttempts = 0;
    this.clearReconnectInterval();
    
    // Start connection health monitoring
    this.startHealthMonitor();
    
    this.emit('ConnectionOpened');
  }

  handleOBSEvent(eventData) {
    const eventType = eventData.eventType;
    console.log('OBS: Event received:', eventType);
    
    switch (eventType) {
      case 'InputVolumeMeters':
        this.handleVolumeMetersEvent(eventData.eventData);
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

  // GEFIXT: Proper volume meters handling
  handleVolumeMetersEvent(data) {
    // OBS sends volume meter data with proper scaling
    // InputLevelsMul is 0-1 (linear amplitude)
    // InputLevelsDb is the dB value (-∞ to 0)
    
    console.log('OBS: Volume meters received for', data.inputs?.length || 0, 'inputs');
    this.emit('InputVolumeMeters', data);
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

  handleRequestBatchResponse(message) {
    // Handle batch responses if needed
    console.log('OBS: Batch response received');
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
    this.stopHealthMonitor();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.pendingRequests?.clear();
    this.isConnected = false;
    this.isIdentified = false;
  }

  // Connection Health Monitoring
  startHealthMonitor() {
    this.healthMonitorInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.connectionHealth.lastHeartbeat;
      
      // If no message received in 30 seconds, consider connection unhealthy
      if (timeSinceLastHeartbeat > 30000) {
        this.connectionHealth.missedHeartbeats++;
        console.warn('OBS: Missed heartbeat', this.connectionHealth.missedHeartbeats);
        
        if (this.connectionHealth.missedHeartbeats >= this.connectionHealth.maxMissedHeartbeats) {
          console.error('OBS: Connection unhealthy, attempting reconnect');
          this.disconnect();
          this.startReconnectTimer();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  stopHealthMonitor() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = null;
    }
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
        // GEFIXT: Korrekte Event Subscriptions mit InputVolumeMeters (High-Volume Event)
        eventSubscriptions: 511 | 65536, // Regular events + InputVolumeMeters
        rpcVersion: 1,
        ...options
      };

      if (this.obs && typeof this.obs.connect === 'function') {
        await this.obs.connect(url, password, connectOptions);
        console.log('OBS: Connected successfully with Volume Meters enabled');
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
    this.stopHealthMonitor();
    
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

  // ENHANCED: Audio source management with better error handling
  async getAudioSources() {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      console.log('OBS: Getting input list...');
      const response = await this.obs.call('GetInputList');
      const inputs = response.inputs || [];
      
      console.log('OBS: Received inputs:', inputs.length);

      // Filter for audio sources with better detection
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
          kind === 'coreaudio_output_capture' ||
          kind === 'decklink_input' ||
          kind === 'av_capture_input' ||
          kind.includes('microphone') ||
          kind.includes('desktop') ||
          kind.includes('system')
        );
      });

      console.log('OBS: Found audio inputs:', audioInputs.length);

      // Update internal sources map
      this.audioSources.clear();
      
      // Get volume and mute info for all sources
      for (const input of audioInputs) {
        const sourceInfo = {
          name: input.inputName,
          kind: input.inputKind,
          volume: 1.0,
          muted: false,
          levelMul: 0,
          levelDb: -100
        };
        
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

  // ENHANCED: Scene management with better error handling
  async getScenes() {
    if (!this.isConnected || !this.isIdentified) {
      console.warn('OBS: Cannot get scenes - not connected or not identified');
      throw new Error('OBS WebSocket not connected or not identified');
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
          index: scene.sceneIndex || 0
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

  // GEFIXT: Volume setting mit korrekter Range-Validierung
  async setInputVolume(inputName, volume) {
    if (!this.isIdentified) {
      throw new Error('OBS WebSocket not identified');
    }

    try {
      // OBS InputVolumeMul range: 0-1 (can go above 1 for boost, but we limit to 1)
      const clampedVolume = Math.max(0, Math.min(1, volume));
      
      console.log(`OBS: Setting volume for ${inputName} to ${clampedVolume.toFixed(3)} (${(clampedVolume * 100).toFixed(1)}%)`);
      
      await this.obs.call('SetInputVolume', {
        inputName,
        inputVolumeMul: clampedVolume
      });
      
      if (this.audioSources.has(inputName)) {
        this.audioSources.get(inputName).volume = clampedVolume;
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
        // OBS provides properly scaled values
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
    // Refresh audio sources after a short delay
    setTimeout(() => {
      this.getAudioSources().catch(console.error);
    }, 500);
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

  // ENHANCED: Better connection status reporting
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      identified: this.isIdentified,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      volumeMetersEnabled: true, // We now correctly subscribe to this
      health: {
        lastHeartbeat: this.connectionHealth.lastHeartbeat,
        missedHeartbeats: this.connectionHealth.missedHeartbeats,
        timeSinceLastHeartbeat: Date.now() - this.connectionHealth.lastHeartbeat
      }
    };
  }

  // Connection quality check
  isConnectionHealthy() {
    if (!this.isConnected || !this.isIdentified) return false;
    
    const timeSinceLastHeartbeat = Date.now() - this.connectionHealth.lastHeartbeat;
    return timeSinceLastHeartbeat < 30000 && this.connectionHealth.missedHeartbeats < 2;
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
  getAudioSource(name) {
    return this.audioSources.get(name);
  }

  getAllAudioSources() {
    return Array.from(this.audioSources.values());
  }

  getAllScenes() {
    return Array.from(this.scenes.values());
  }

  // Enhanced debugging
  getDebugInfo() {
    return {
      connection: this.getConnectionStatus(),
      audioSources: this.audioSources.size,
      scenes: this.scenes.size,
      pendingRequests: this.pendingRequests?.size || 0,
      websocketState: this.websocket?.readyState || 'N/A',
      volumeMetersSubscribed: true
    };
  }

  destroy() {
    this.disconnect();
    this.stopHealthMonitor();
    this.audioSources.clear();
    this.scenes.clear();
    this.listeners.clear();
    this.pendingRequests?.clear();
  }
}

// Export as global variable
console.log('Creating FIXED OBS WebSocket Manager with Volume Meters...');
window.obsManager = new OBSWebSocketManager();