class UIManager {
  constructor() {
    this.elements = {};
    this.isResizing = false;
    this.currentAudioSectionWidth = 50; // Percentage
    this.isLearningMidi = false;
    this.learningTarget = null;

    this.initializeUI();
  }

  initializeUI() {
    // Cache DOM elements
    this.cacheElements();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize UI state
    this.initializeState();
    
    // Set up manager listeners
    this.setupManagerListeners();

    console.log('UIManager initialized');
  }

  cacheElements() {
    this.elements = {
      // Header elements
      obsStatus: document.getElementById('obsStatus'),
      midiStatus: document.getElementById('midiStatus'),
      connectBtn: document.getElementById('connectBtn'),
      debugBtn: document.getElementById('debugBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      minimizeBtn: document.getElementById('minimizeBtn'),
      closeBtn: document.getElementById('closeBtn'),
      
      // Main content
      audioSection: document.getElementById('audioSection'),
      hotkeysSection: document.getElementById('hotkeysSection'),
      resizeHandle: document.getElementById('resizeHandle'),
      
      // Audio section
      refreshAudio: document.getElementById('refreshAudio'),
      audioSources: document.getElementById('audioSources'),
      noSourcesMessage: document.getElementById('noSourcesMessage'),
      
      // Hotkeys section
      learnMidiBtn: document.getElementById('learnMidiBtn'),
      testBtn: document.getElementById('testBtn'),
      hotkeyMappings: document.getElementById('hotkeyMappings'),
      noMappingsMessage: document.getElementById('noMappingsMessage'),
      
      // Settings modal
      settingsModal: document.getElementById('settingsModal'),
      closeSettings: document.getElementById('closeSettings'),
      obsUrl: document.getElementById('obsUrl'),
      obsPassword: document.getElementById('obsPassword'),
      midiDevice: document.getElementById('midiDevice'),
      resetSettings: document.getElementById('resetSettings'),
      saveSettings: document.getElementById('saveSettings'),
      
      // Connection modal
      connectionModal: document.getElementById('connectionModal'),
      closeConnection: document.getElementById('closeConnection'),
      obsConnectionInfo: document.getElementById('obsConnectionInfo'),
      obsConnectionStatus: document.getElementById('obsConnectionStatus'),
      obsConnectionUrl: document.getElementById('obsConnectionUrl'),
      obsReconnectAttempts: document.getElementById('obsReconnectAttempts'),
      connectObs: document.getElementById('connectObs'),
      disconnectObs: document.getElementById('disconnectObs'),
      midiConnectionInfo: document.getElementById('midiConnectionInfo'),
      midiConnectionStatus: document.getElementById('midiConnectionStatus'),
      midiDeviceName: document.getElementById('midiDeviceName'),
      midiDeviceCount: document.getElementById('midiDeviceCount'),
      scanMidi: document.getElementById('scanMidi'),
      disconnectMidi: document.getElementById('disconnectMidi'),
      refreshConnection: document.getElementById('refreshConnection'),
      
      // Debug modal
      debugModal: document.getElementById('debugModal'),
      closeDebug: document.getElementById('closeDebug'),
      debugAppStatus: document.getElementById('debugAppStatus'),
      midiEventLog: document.getElementById('midiEventLog'),
      obsEventLog: document.getElementById('obsEventLog'),
      clearMidiLog: document.getElementById('clearMidiLog'),
      clearObsLog: document.getElementById('clearObsLog'),
      exportDebug: document.getElementById('exportDebug'),
      refreshDebug: document.getElementById('refreshDebug')
    };
  }

  setupEventListeners() {
    // Header buttons
    this.elements.connectBtn?.addEventListener('click', () => this.openConnectionModal());
    this.elements.debugBtn?.addEventListener('click', () => this.openDebugModal());
    this.elements.settingsBtn?.addEventListener('click', () => this.openSettings());
    this.elements.minimizeBtn?.addEventListener('click', () => this.minimizeWindow());
    this.elements.closeBtn?.addEventListener('click', () => this.closeWindow());
    
    // Resize handle
    this.elements.resizeHandle?.addEventListener('mousedown', (e) => this.startResize(e));
    
    // Audio section
    this.elements.refreshAudio?.addEventListener('click', () => this.refreshAudioSources());
    
    // Hotkeys section
    this.elements.learnMidiBtn?.addEventListener('click', () => this.toggleMidiLearning());
    this.elements.testBtn?.addEventListener('click', () => this.runConnectionTest());
    
    // Settings modal
    this.elements.closeSettings?.addEventListener('click', () => this.closeSettings());
    this.elements.settingsModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) {
        this.closeSettings();
      }
    });
    this.elements.resetSettings?.addEventListener('click', () => this.resetSettings());
    this.elements.saveSettings?.addEventListener('click', () => this.saveSettings());
    
    // Connection modal
    this.elements.closeConnection?.addEventListener('click', () => this.closeConnectionModal());
    this.elements.connectionModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.connectionModal) {
        this.closeConnectionModal();
      }
    });
    this.elements.connectObs?.addEventListener('click', () => this.connectObs());
    this.elements.disconnectObs?.addEventListener('click', () => this.disconnectObs());
    this.elements.scanMidi?.addEventListener('click', () => this.scanMidi());
    this.elements.disconnectMidi?.addEventListener('click', () => this.disconnectMidi());
    this.elements.refreshConnection?.addEventListener('click', () => this.refreshConnectionStatus());
    
    // Debug modal
    this.elements.closeDebug?.addEventListener('click', () => this.closeDebugModal());
    this.elements.debugModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.debugModal) {
        this.closeDebugModal();
      }
    });
    this.elements.clearMidiLog?.addEventListener('click', () => this.clearMidiLog());
    this.elements.clearObsLog?.addEventListener('click', () => this.clearObsLog());
    this.elements.exportDebug?.addEventListener('click', () => this.exportDebugInfo());
    this.elements.refreshDebug?.addEventListener('click', () => this.refreshDebugInfo());
    
    // Global events
    document.addEventListener('mousemove', (e) => this.handleResize(e));
    document.addEventListener('mouseup', () => this.stopResize());
    
    // Keyboard shortcuts - with more debugging
    document.addEventListener('keydown', (e) => {
      console.log('Key pressed:', e.key, e.code);
      this.handleKeyboard(e);
    });
  }

  initializeState() {
    // Load UI settings
    const uiSettings = window.settingsManager?.getUiSettings() || {};
    this.currentAudioSectionWidth = uiSettings.audioSectionWidth || 50;
    
    // Apply initial layout
    this.updateLayout();
    
    // Update status indicators
    this.updateConnectionStatus();
    
    // Initialize debug logs
    this.midiEventBuffer = [];
    this.obsEventBuffer = [];
    this.maxLogEntries = 100;
    
    // Force update status after short delay
    setTimeout(() => {
      this.updateConnectionStatus();
    }, 1000);
  }

  setupManagerListeners() {
    // OBS Manager listeners
    if (window.obsManager) {
      window.obsManager.on('connected', () => {
        this.updateConnectionStatus();
        this.addObsLogEntry('Connection', 'Connected to OBS Studio');
      });
      window.obsManager.on('disconnected', () => {
        this.updateConnectionStatus();
        this.addObsLogEntry('Connection', 'Disconnected from OBS Studio');
      });
      window.obsManager.on('connecting', () => {
        this.updateConnectionStatus();
        this.addObsLogEntry('Connection', 'Connecting to OBS Studio...');
      });
      window.obsManager.on('error', (error) => {
        this.updateConnectionStatus();
        this.addObsLogEntry('Error', error?.message || 'Unknown error');
      });
      window.obsManager.on('audioSourcesUpdated', (sources) => {
        this.addObsLogEntry('Audio', `${sources.length} audio sources found`);
      });
    } else {
      console.warn('OBS Manager not available for UI listeners');
    }

    // MIDI Controller listeners
    if (window.midiController) {
      window.midiController.on('deviceConnected', (device) => {
        console.log('UI: MIDI device connected:', device);
        setTimeout(() => this.updateConnectionStatus(), 100);
        this.addMidiLogEntry('Device Connected', device?.name || 'Unknown device');
      });
      window.midiController.on('deviceDisconnected', () => {
        console.log('UI: MIDI device disconnected');
        setTimeout(() => this.updateConnectionStatus(), 100);
        this.addMidiLogEntry('Device Disconnected', 'Device removed');
      });
      window.midiController.on('devicesUpdated', (devices) => {
        console.log('UI: MIDI devices updated:', devices);
        this.updateMidiDevices(devices);
        setTimeout(() => this.updateConnectionStatus(), 100);
      });
      window.midiController.on('learningStarted', () => this.onMidiLearningStarted());
      window.midiController.on('learningStopped', () => this.onMidiLearningStopped());
      window.midiController.on('midiMessage', (message) => {
        this.addMidiLogEntry('MIDI Message', `${message.type}: ${message.id}`);
      });
    } else {
      console.warn('MIDI Controller not available for UI listeners');
    }

    // Audio Manager listeners
    if (window.audioManager) {
      window.audioManager.on('sourcesUpdated', (sources) => this.updateAudioSources(sources));
      window.audioManager.on('levelsUpdated', () => this.updateAudioLevels());
      window.audioManager.on('volumeChanged', (data) => this.updateSourceVolume(data));
      window.audioManager.on('muteStateChanged', (data) => this.updateSourceMute(data));
      window.audioManager.on('midiMappingAdded', (data) => this.updateMidiMappings());
      window.audioManager.on('midiMappingRemoved', () => this.updateMidiMappings());
    } else {
      console.warn('Audio Manager not available for UI listeners');
    }
  }

  // Layout management
  updateLayout() {
    const audioWidth = this.currentAudioSectionWidth;
    const hotkeysWidth = 100 - audioWidth;
    
    if (this.elements.audioSection) {
      this.elements.audioSection.style.flex = `0 0 ${audioWidth}%`;
    }
    
    if (this.elements.hotkeysSection) {
      this.elements.hotkeysSection.style.flex = `0 0 ${hotkeysWidth}%`;
    }
  }

  startResize(e) {
    this.isResizing = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }

  handleResize(e) {
    if (!this.isResizing) return;
    
    const containerRect = document.querySelector('.main-content').getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;
    
    // Calculate percentage (with limits)
    let percentage = (mouseX / containerWidth) * 100;
    percentage = Math.max(25, Math.min(75, percentage)); // 25% to 75%
    
    this.currentAudioSectionWidth = percentage;
    this.updateLayout();
  }

  stopResize() {
    if (this.isResizing) {
      this.isResizing = false;
      document.body.style.cursor = '';
      
      // Save layout setting
      window.settingsManager?.setUiSettings({
        audioSectionWidth: this.currentAudioSectionWidth
      });
    }
  }

  // Status updates
  updateConnectionStatus() {
    // OBS Status
    if (this.elements.obsStatus) {
      const obsStatus = window.obsManager?.getConnectionStatus() || {};
      const statusDot = this.elements.obsStatus.querySelector('.status-dot');
      const statusText = this.elements.obsStatus.querySelector('.status-text');
      
      if (obsStatus.connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'OBS: Verbunden';
      } else if (obsStatus.connecting) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'OBS: Verbinde...';
      } else {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'OBS: Getrennt';
      }
    }

    // MIDI Status - verbesserte Logik
    if (this.elements.midiStatus) {
      const activeDevice = window.midiController?.getActiveDevice();
      const connectedDevices = window.midiController?.getConnectedDevices() || [];
      const statusDot = this.elements.midiStatus.querySelector('.status-dot');
      const statusText = this.elements.midiStatus.querySelector('.status-text');
      
      console.log('UI Update: Active device:', activeDevice);
      console.log('UI Update: Connected devices:', connectedDevices);
      
      if (activeDevice && activeDevice.name) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = `MIDI: ${activeDevice.name}`;
      } else if (connectedDevices.length > 0) {
        // Gerät erkannt aber nicht als aktiv gesetzt
        const firstDevice = connectedDevices[0];
        statusDot.className = 'status-dot connected';
        statusText.textContent = `MIDI: ${firstDevice.name}`;
        
        // Versuche das erste Gerät zu aktivieren
        if (window.midiController && firstDevice.id) {
          console.log('Trying to connect to first available device:', firstDevice.name);
          setTimeout(() => {
            window.midiController.connectToDevice(firstDevice.id);
          }, 100);
        }
      } else {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'MIDI: Kein Gerät';
      }
    }
  }

  // Audio sources management
  updateAudioSources(sources) {
    if (!this.elements.audioSources) return;

    // Clear existing content
    this.elements.audioSources.innerHTML = '';
    
    if (sources.length === 0) {
      this.elements.audioSources.appendChild(this.elements.noSourcesMessage);
      return;
    }

    // Create source elements
    sources.forEach(source => {
      const sourceElement = this.createAudioSourceElement(source);
      this.elements.audioSources.appendChild(sourceElement);
    });
  }

  createAudioSourceElement(source) {
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'audio-source';
    sourceDiv.dataset.sourceName = source.name;
    
    sourceDiv.innerHTML = `
      <div class="source-header">
        <span class="source-name">${source.name}</span>
        <span class="source-level">-∞ dB</span>
      </div>
      <div class="source-controls">
        <input type="range" class="volume-slider" 
               min="0" max="1" step="0.01" value="${source.volume}">
        <button class="mute-btn ${source.muted ? 'muted' : ''}" 
                title="${source.muted ? 'Unmute' : 'Mute'}">
          ${source.muted ? '🔇' : '🔊'}
        </button>
      </div>
      ${source.midiMapping ? 
        `<div class="midi-assignment">
           MIDI: ${source.midiMapping.midiDescription}
           <button class="remove-mapping-btn" title="MIDI-Zuordnung entfernen">×</button>
         </div>` : 
        `<div class="midi-assignment">
           <button class="assign-midi-btn">MIDI zuordnen</button>
         </div>`
      }
    `;

    // Add event listeners
    this.setupAudioSourceListeners(sourceDiv, source);
    
    return sourceDiv;
  }

  setupAudioSourceListeners(element, source) {
    const volumeSlider = element.querySelector('.volume-slider');
    const muteBtn = element.querySelector('.mute-btn');
    const assignMidiBtn = element.querySelector('.assign-midi-btn');
    const removeMappingBtn = element.querySelector('.remove-mapping-btn');

    // Volume slider
    volumeSlider?.addEventListener('input', (e) => {
      const volume = parseFloat(e.target.value);
      window.audioManager?.setSourceVolume(source.name, volume);
    });

    // Mute button
    muteBtn?.addEventListener('click', () => {
      window.audioManager?.toggleSourceMute(source.name);
    });

    // MIDI assignment
    assignMidiBtn?.addEventListener('click', () => {
      this.startMidiAssignment(source.name);
    });

    // Remove MIDI mapping
    removeMappingBtn?.addEventListener('click', () => {
      window.audioManager?.removeMidiMapping(source.name);
    });
  }

  updateAudioLevels() {
    const audioSources = window.audioManager?.getAllAudioSources() || [];
    
    audioSources.forEach(source => {
      const sourceElement = this.elements.audioSources.querySelector(
        `[data-source-name="${source.name}"]`
      );
      
      if (sourceElement) {
        const levelElement = sourceElement.querySelector('.source-level');
        if (levelElement) {
          levelElement.textContent = window.audioManager.formatVolumeLevel(source.levelMul);
        }
      }
    });
  }

  updateSourceVolume(data) {
    const sourceElement = this.elements.audioSources.querySelector(
      `[data-source-name="${data.sourceName}"]`
    );
    
    if (sourceElement) {
      const volumeSlider = sourceElement.querySelector('.volume-slider');
      if (volumeSlider) {
        volumeSlider.value = data.volume;
      }
    }
  }

  updateSourceMute(data) {
    const sourceElement = this.elements.audioSources.querySelector(
      `[data-source-name="${data.sourceName}"]`
    );
    
    if (sourceElement) {
      const muteBtn = sourceElement.querySelector('.mute-btn');
      if (muteBtn) {
        muteBtn.className = `mute-btn ${data.muted ? 'muted' : ''}`;
        muteBtn.textContent = data.muted ? '🔇' : '🔊';
        muteBtn.title = data.muted ? 'Unmute' : 'Mute';
      }
    }
  }

  // MIDI learning and assignment
  toggleMidiLearning() {
    if (this.isLearningMidi) {
      this.stopMidiLearning();
    } else {
      this.startMidiLearning();
    }
  }

  startMidiLearning() {
    this.isLearningMidi = true;
    
    if (this.elements.learnMidiBtn) {
      this.elements.learnMidiBtn.textContent = 'Lernen beenden';
      this.elements.learnMidiBtn.classList.add('active');
    }
    
    window.midiController?.startLearning((midiEvent) => {
      console.log('MIDI learned:', midiEvent);
      this.stopMidiLearning();
    });
  }

  stopMidiLearning() {
    this.isLearningMidi = false;
    this.learningTarget = null;
    
    if (this.elements.learnMidiBtn) {
      this.elements.learnMidiBtn.textContent = 'MIDI Lernen';
      this.elements.learnMidiBtn.classList.remove('active');
    }
    
    window.midiController?.stopLearning();
  }

  startMidiAssignment(sourceName) {
    this.learningTarget = sourceName;
    
    window.midiController?.startLearning((midiEvent) => {
      this.assignMidiToSource(sourceName, midiEvent);
      this.learningTarget = null;
    });
    
    // Visual feedback
    const sourceElement = this.elements.audioSources.querySelector(
      `[data-source-name="${sourceName}"]`
    );
    if (sourceElement) {
      sourceElement.style.border = '2px solid var(--accent-orange)';
      setTimeout(() => {
        sourceElement.style.border = '';
      }, 3000);
    }
  }

  assignMidiToSource(sourceName, midiEvent) {
    const controlType = midiEvent.type === 'controlchange' ? 'volume' : 'mute';
    window.audioManager?.assignMidiControl(sourceName, midiEvent, controlType);
  }

  onMidiLearningStarted() {
    // Add visual feedback for learning mode
    document.body.classList.add('midi-learning');
  }

  onMidiLearningStopped() {
    // Remove visual feedback
    document.body.classList.remove('midi-learning');
  }

  updateMidiMappings() {
    const sources = window.audioManager?.getAllAudioSources() || [];
    this.updateAudioSources(sources);
  }

  // Connection Modal
  openConnectionModal() {
    if (this.elements.connectionModal) {
      this.elements.connectionModal.style.display = 'flex';
      this.refreshConnectionStatus();
    }
  }

  closeConnectionModal() {
    if (this.elements.connectionModal) {
      this.elements.connectionModal.style.display = 'none';
    }
  }

  refreshConnectionStatus() {
    // Update OBS connection info
    const obsStatus = window.obsManager?.getConnectionStatus() || {};
    if (this.elements.obsConnectionStatus) {
      this.elements.obsConnectionStatus.textContent = obsStatus.connected ? 'Verbunden' : 
        obsStatus.connecting ? 'Verbinde...' : 'Getrennt';
    }
    if (this.elements.obsReconnectAttempts) {
      this.elements.obsReconnectAttempts.textContent = obsStatus.reconnectAttempts || '0';
    }
    
    // Update MIDI connection info
    const activeDevice = window.midiController?.getActiveDevice();
    const connectedDevices = window.midiController?.getConnectedDevices() || [];
    
    if (this.elements.midiConnectionStatus) {
      this.elements.midiConnectionStatus.textContent = activeDevice ? 'Verbunden' : 'Getrennt';
    }
    if (this.elements.midiDeviceName) {
      this.elements.midiDeviceName.textContent = activeDevice ? activeDevice.name : 'Kein Gerät';
    }
    if (this.elements.midiDeviceCount) {
      this.elements.midiDeviceCount.textContent = connectedDevices.length.toString();
    }
  }

  connectObs() {
    const settings = window.settingsManager?.getObsSettings() || {};
    if (window.obsManager) {
      window.obsManager.connect(settings.url, settings.password)
        .then(() => {
          this.addObsLogEntry('Connection', 'Connected successfully');
        })
        .catch(error => {
          this.addObsLogEntry('Error', `Connection failed: ${error.message}`);
        });
    }
  }

  disconnectObs() {
    if (window.obsManager) {
      window.obsManager.disconnect();
      this.addObsLogEntry('Connection', 'Disconnected manually');
    }
  }

  scanMidi() {
    if (window.midiController) {
      window.midiController.scanDevices();
      this.addMidiLogEntry('Scan', 'Scanning for MIDI devices...');
    }
  }

  disconnectMidi() {
    if (window.midiController) {
      window.midiController.disconnectFromDevice();
      this.addMidiLogEntry('Connection', 'Disconnected manually');
    }
  }

  // Debug Modal
  openDebugModal() {
    if (this.elements.debugModal) {
      this.elements.debugModal.style.display = 'flex';
      this.refreshDebugInfo();
    }
  }

  closeDebugModal() {
    if (this.elements.debugModal) {
      this.elements.debugModal.style.display = 'none';
    }
  }

  refreshDebugInfo() {
    if (this.elements.debugAppStatus) {
      const status = {
        app: window.app?.getAppStatus() || {},
        settings: Object.keys(window.settingsManager?.getAll() || {}).length,
        timestamp: new Date().toLocaleString()
      };
      this.elements.debugAppStatus.textContent = JSON.stringify(status, null, 2);
    }
  }

  addMidiLogEntry(type, data) {
    if (!this.midiEventBuffer) {
      this.midiEventBuffer = [];
    }
    
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      type: type,
      data: data
    };
    
    this.midiEventBuffer.push(entry);
    if (this.midiEventBuffer.length > this.maxLogEntries) {
      this.midiEventBuffer.shift();
    }
    
    this.updateMidiLog();
  }

  addObsLogEntry(type, data) {
    if (!this.obsEventBuffer) {
      this.obsEventBuffer = [];
    }
    
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      type: type,
      data: data
    };
    
    this.obsEventBuffer.push(entry);
    if (this.obsEventBuffer.length > this.maxLogEntries) {
      this.obsEventBuffer.shift();
    }
    
    this.updateObsLog();
  }

  updateMidiLog() {
    if (this.elements.midiEventLog) {
      const logText = this.midiEventBuffer.map(entry => 
        `[${entry.timestamp}] ${entry.type}: ${entry.data}`
      ).join('\n');
      this.elements.midiEventLog.textContent = logText || 'Keine Events...';
      this.elements.midiEventLog.scrollTop = this.elements.midiEventLog.scrollHeight;
    }
  }

  updateObsLog() {
    if (this.elements.obsEventLog) {
      const logText = this.obsEventBuffer.map(entry => 
        `[${entry.timestamp}] ${entry.type}: ${entry.data}`
      ).join('\n');
      this.elements.obsEventLog.textContent = logText || 'Keine Events...';
      this.elements.obsEventLog.scrollTop = this.elements.obsEventLog.scrollHeight;
    }
  }

  clearMidiLog() {
    this.midiEventBuffer = [];
    this.updateMidiLog();
  }

  clearObsLog() {
    this.obsEventBuffer = [];
    this.updateObsLog();
  }

  runConnectionTest() {
    console.log('🧪 Running Connection Test...');
    
    // Test all managers
    const results = {
      managers: {
        settings: !!window.settingsManager,
        obs: !!window.obsManager,
        midi: !!window.midiController,
        audio: !!window.audioManager,
        ui: !!window.uiManager
      },
      connections: {},
      devices: {}
    };
    
    // Test OBS connection
    if (window.obsManager) {
      results.connections.obs = window.obsManager.getConnectionStatus();
      
      // Try to connect if not connected
      if (!results.connections.obs.connected) {
        const settings = window.settingsManager?.getObsSettings() || {};
        window.obsManager.connect(settings.url || 'ws://localhost:4455', settings.password || '')
          .then(() => {
            console.log('✓ OBS Test: Connected');
            this.showSuccessMessage('OBS-Verbindung erfolgreich!');
          })
          .catch(err => {
            console.log('✗ OBS Test Failed:', err.message);
            this.showErrorMessage('OBS-Verbindung fehlgeschlagen', err.message);
          });
      }
    }
    
    // Test MIDI devices
    if (window.midiController) {
      const devices = window.midiController.scanDevices();
      results.devices.midi = devices;
      
      if (devices.length > 0) {
        console.log('✓ MIDI Test: Found', devices.length, 'devices');
        this.showSuccessMessage(`${devices.length} MIDI-Gerät(e) gefunden!`);
        
        // Try to connect to first device
        const firstDevice = devices[0];
        if (!window.midiController.getActiveDevice() && firstDevice.id) {
          window.midiController.connectToDevice(firstDevice.id);
        }
      } else {
        console.log('✗ MIDI Test: No devices found');
        this.showErrorMessage('MIDI-Test', 'Keine MIDI-Geräte gefunden');
      }
    }
    
    // Log full results
    console.log('Connection Test Results:', results);
    
    // Update UI
    setTimeout(() => {
      this.updateConnectionStatus();
    }, 500);
    
    return results;
  }

  showErrorMessage(title, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--error-color);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10001;
      font-size: 14px;
      max-width: 350px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `<strong>${title}</strong><br>${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  exportDebugInfo() {
    const debugData = {
      timestamp: new Date().toISOString(),
      appStatus: window.app?.getAppStatus() || {},
      settings: window.settingsManager?.getAll() || {},
      midiEvents: this.midiEventBuffer || [],
      obsEvents: this.obsEventBuffer || []
    };
    
    const dataStr = JSON.stringify(debugData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `obs-midi-mixer-debug-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  // Settings management
  openSettings() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.style.display = 'flex';
      this.loadSettingsValues();
    }
  }

  closeSettings() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.style.display = 'none';
    }
  }

  loadSettingsValues() {
    const obsSettings = window.settingsManager?.getObsSettings() || {};
    const midiSettings = window.settingsManager?.getMidiSettings() || {};
    
    if (this.elements.obsUrl) {
      this.elements.obsUrl.value = obsSettings.url || 'ws://localhost:4455';
    }
    
    if (this.elements.obsPassword) {
      this.elements.obsPassword.value = obsSettings.password || '';
    }
    
    // Update MIDI device dropdown
    this.updateMidiDevices(window.midiController?.getConnectedDevices() || []);
  }

  updateMidiDevices(devices) {
    if (!this.elements.midiDevice) return;
    
    // Clear existing options
    this.elements.midiDevice.innerHTML = '<option value="">Automatisch erkennen</option>';
    
    // Add device options
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.name} (${device.manufacturer})`;
      this.elements.midiDevice.appendChild(option);
    });
    
    // Select current device
    const activeDevice = window.midiController?.getActiveDevice();
    if (activeDevice) {
      this.elements.midiDevice.value = activeDevice.id;
    }
  }

  saveSettings() {
    const obsSettings = {
      url: this.elements.obsUrl?.value || 'ws://localhost:4455',
      password: this.elements.obsPassword?.value || '',
      autoConnect: true
    };
    
    const selectedMidiDevice = this.elements.midiDevice?.value;
    
    // Save settings
    window.settingsManager?.setObsSettings(obsSettings);
    
    // Reconnect OBS if needed
    if (window.obsManager) {
      window.obsManager.disconnect();
      setTimeout(() => {
        window.obsManager.connect(obsSettings.url, obsSettings.password);
      }, 100);
    }
    
    // Connect to MIDI device if selected
    if (selectedMidiDevice && window.midiController) {
      window.midiController.connectToDevice(selectedMidiDevice);
    }
    
    this.closeSettings();
    
    // Show success message
    this.showSuccessMessage('Einstellungen gespeichert und Verbindungen aktualisiert');
  }

  showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--success-color);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10001;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  resetSettings() {
    if (confirm('Alle Einstellungen zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      window.settingsManager?.reset();
      location.reload();
    }
  }

  // Utility functions
  refreshAudioSources() {
    window.audioManager?.refreshAudioSources();
  }

  minimizeWindow() {
    if (typeof window.require !== 'undefined') {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('minimize-window');
    }
  }

  closeWindow() {
    if (typeof window.require !== 'undefined') {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('close-window');
    }
  }

  handleKeyboard(e) {
    // ESC to close modals or stop learning
    if (e.key === 'Escape') {
      if (this.elements.settingsModal.style.display === 'flex') {
        this.closeSettings();
      } else if (this.elements.connectionModal.style.display === 'flex') {
        this.closeConnectionModal();
      } else if (this.elements.debugModal.style.display === 'flex') {
        this.closeDebugModal();
      } else if (this.isLearningMidi) {
        this.stopMidiLearning();
      }
    }
    
    // F5 to refresh
    if (e.key === 'F5') {
      e.preventDefault();
      this.refreshAudioSources();
    }
    
    // F1 for connection modal
    if (e.key === 'F1') {
      e.preventDefault();
      this.openConnectionModal();
    }
    
    // F12 for debug modal
    if (e.key === 'F12') {
      e.preventDefault();
      this.openDebugModal();
    }
  }

  // Cleanup
  destroy() {
    // Remove event listeners and clean up
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('keydown', this.handleKeyboard);
  }
}

// Export singleton instance - Compatible with both Node.js and Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new UIManager();
} else {
  // Browser environment - set as global variable
  window.uiManager = new UIManager();
}