// Enhanced UI Manager with Scene Support and Hotkey Creation
class UIManager {
  constructor() {
    this.elements = {};
    this.isResizing = false;
    this.currentAudioSectionWidth = 50; // Percentage
    this.isLearningMidi = false;
    this.learningTarget = null;
    this.learningType = null; // 'audio' or 'scene'
    this.availableScenes = [];

    console.log('UIManager: Constructor called');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeUI());
    } else {
      this.initializeUI();
    }
  }

  initializeUI() {
    console.log('UIManager: Starting initialization...');
    
    // Cache DOM elements
    this.cacheElements();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize UI state
    this.initializeState();
    
    // Set up manager listeners with delay
    setTimeout(() => this.setupManagerListeners(), 1000);

    console.log('UIManager: Initialized successfully');
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
    
    console.log('UIManager: Elements cached');
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
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    console.log('UIManager: Event listeners set up');
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
    
    console.log('UIManager: State initialized');
  }

  setupManagerListeners() {
    console.log('UIManager: Setting up manager listeners...');
    
    // OBS Manager listeners
    if (window.obsManager) {
      console.log('UIManager: Setting up OBS listeners');
      window.obsManager.on('connected', () => {
        this.updateConnectionStatus();
        this.addObsLogEntry('Connection', 'Connected to OBS Studio');
        // Load scenes when connected
        this.loadScenes();
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
      window.obsManager.on('scenesUpdated', (scenes) => {
        this.availableScenes = scenes;
        this.addObsLogEntry('Scenes', `${scenes.length} scenes loaded`);
        this.updateSceneButtons();
      });
    } else {
      console.warn('UIManager: OBS Manager not available for listeners');
    }

    // MIDI Controller listeners
    if (window.midiController) {
      console.log('UIManager: Setting up MIDI listeners');
      window.midiController.on('deviceConnected', (device) => {
        console.log('UIManager: MIDI device connected:', device);
        setTimeout(() => this.updateConnectionStatus(), 100);
        this.addMidiLogEntry('Device Connected', device?.name || 'Unknown device');
      });
      window.midiController.on('deviceDisconnected', () => {
        console.log('UIManager: MIDI device disconnected');
        setTimeout(() => this.updateConnectionStatus(), 100);
        this.addMidiLogEntry('Device Disconnected', 'Device removed');
      });
      window.midiController.on('devicesUpdated', (devices) => {
        console.log('UIManager: MIDI devices updated:', devices);
        this.updateMidiDevices(devices);
        setTimeout(() => this.updateConnectionStatus(), 100);
      });
      window.midiController.on('learningStarted', () => this.onMidiLearningStarted());
      window.midiController.on('learningStopped', () => this.onMidiLearningStopped());
      window.midiController.on('midiMessage', (message) => {
        this.addMidiLogEntry('MIDI Message', `${message.type}: ${message.id}`);
      });
    } else {
      console.warn('UIManager: MIDI Controller not available for listeners');
    }

    // Audio Manager listeners
    if (window.audioManager) {
      console.log('UIManager: Setting up Audio Manager listeners');
      window.audioManager.on('sourcesUpdated', (sources) => this.updateAudioSources(sources));
      window.audioManager.on('levelsUpdated', () => this.updateAudioLevels());
      window.audioManager.on('volumeChanged', (data) => this.updateSourceVolume(data));
      window.audioManager.on('muteStateChanged', (data) => this.updateSourceMute(data));
      window.audioManager.on('midiMappingAdded', (data) => this.updateMidiMappings());
      window.audioManager.on('midiMappingRemoved', () => this.updateMidiMappings());
      window.audioManager.on('mappingsLoaded', () => {
        console.log('UIManager: Audio mappings loaded, refreshing display');
        this.updateMidiMappings();
      });
    } else {
      console.warn('UIManager: Audio Manager not available for listeners');
    }
  }

  startAudioMidiAssignment(sourceName) {
    this.learningTarget = sourceName;
    this.learningType = 'audio';
    
    this.showMidiLearningOverlay(`Audio-Quelle: ${sourceName}`);
    
    window.midiController?.startLearning((midiEvent) => {
      this.assignMidiToAudioSource(sourceName, midiEvent);
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

  startSceneMidiAssignment(sceneName) {
    this.learningTarget = sceneName;
    this.learningType = 'scene';
    
    this.showMidiLearningOverlay(`Szene: ${sceneName}`);
    
    window.midiController?.startLearning((midiEvent) => {
      this.assignMidiToScene(sceneName, midiEvent);
      this.learningTarget = null;
    });
    
    // Visual feedback
    const sceneBtn = document.querySelector(`[data-scene="${sceneName}"]`);
    if (sceneBtn) {
      sceneBtn.style.background = 'var(--accent-orange)';
      sceneBtn.textContent = 'MIDI lernt...';
      setTimeout(() => {
        sceneBtn.style.background = '';
        sceneBtn.textContent = 'MIDI zuordnen';
      }, 3000);
    }
  }

  assignMidiToAudioSource(sourceName, midiEvent) {
    const controlType = midiEvent.type === 'controlchange' ? 'volume' : 'mute';
    window.audioManager?.assignMidiControl(sourceName, midiEvent, controlType);
    this.showSuccessMessage(`MIDI-Steuerung für "${sourceName}" erstellt!`);
  }

  assignMidiToScene(sceneName, midiEvent) {
    if (window.midiController) {
      window.midiController.mapSceneControl(midiEvent, sceneName);
      this.showSuccessMessage(`Scene-Hotkey für "${sceneName}" erstellt!`);
      this.updateSceneMappingsDisplay();
    }
  }

  updateSceneMappingsDisplay() {
    // Update the scene mappings display to show assigned MIDI controls
    const sceneMappings = window.midiController?.getSceneMappings() || [];
    
    sceneMappings.forEach(mapping => {
      const sceneBtn = document.querySelector(`[data-scene="${mapping.sceneName}"]`);
      if (sceneBtn) {
        sceneBtn.textContent = `MIDI: ${mapping.midiDescription}`;
        sceneBtn.classList.add('mapped');
      }
    });
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
      
      if (obsStatus.connected && obsStatus.identified) {
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

    // MIDI Status
    if (this.elements.midiStatus) {
      const activeDevice = window.midiController?.getActiveDevice();
      const connectedDevices = window.midiController?.getConnectedDevices() || [];
      const statusDot = this.elements.midiStatus.querySelector('.status-dot');
      const statusText = this.elements.midiStatus.querySelector('.status-text');
      
      if (activeDevice && activeDevice.name) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = `MIDI: ${activeDevice.name}`;
      } else if (connectedDevices.length > 0) {
        const firstDevice = connectedDevices[0];
        statusDot.className = 'status-dot connected';
        statusText.textContent = `MIDI: ${firstDevice.name}`;
      } else {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'MIDI: Kein Gerät';
      }
    }
  }

  // Load scenes from OBS
  async loadScenes() {
    try {
      if (window.obsManager && window.obsManager.isConnected && window.obsManager.isIdentified) {
        console.log('UIManager: Loading scenes from OBS...');
        await window.obsManager.getScenes();
      } else {
        console.warn('UIManager: Cannot load scenes - OBS not ready');
        // Retry after a delay
        setTimeout(() => {
          this.loadScenes();
        }, 2000);
      }
    } catch (error) {
      console.error('UIManager: Error loading scenes:', error);
      // Retry after a delay
      setTimeout(() => {
        this.loadScenes();
      }, 5000);
    }
  }

  // Update scene buttons in hotkeys section
  updateSceneButtons() {
    if (!this.elements.hotkeyMappings) return;

    // Clear existing scene mappings display
    const existingScenes = this.elements.hotkeyMappings.querySelectorAll('.scene-mapping');
    existingScenes.forEach(el => el.remove());

    if (this.availableScenes.length === 0) return;

    // Add scene controls section
    let sceneSection = this.elements.hotkeyMappings.querySelector('.scene-section');
    if (!sceneSection) {
      sceneSection = document.createElement('div');
      sceneSection.className = 'scene-section';
      sceneSection.innerHTML = `
        <h3>Szenen-Steuerung</h3>
        <div class="scene-mappings" id="sceneMappings"></div>
      `;
      this.elements.hotkeyMappings.appendChild(sceneSection);
    }

    const sceneMappings = sceneSection.querySelector('.scene-mappings');
    sceneMappings.innerHTML = '';

    // Add scene buttons
    this.availableScenes.forEach(scene => {
      const sceneDiv = document.createElement('div');
      sceneDiv.className = 'scene-mapping';
      sceneDiv.innerHTML = `
        <div class="scene-info">
          <span class="scene-name">${scene.name}</span>
          <button class="assign-scene-btn" data-scene="${scene.name}">MIDI zuordnen</button>
        </div>
      `;

      // Add event listener for MIDI assignment
      const assignBtn = sceneDiv.querySelector('.assign-scene-btn');
      assignBtn.addEventListener('click', () => {
        this.startSceneMidiAssignment(scene.name);
      });

      sceneMappings.appendChild(sceneDiv);
    });

    console.log('UIManager: Scene buttons updated, found', this.availableScenes.length, 'scenes');
  }

  // Audio sources management
  updateAudioSources(sources) {
    if (!this.elements.audioSources) return;

    console.log('UIManager: Updating audio sources display:', sources.length);

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

    console.log('UIManager: Audio sources display updated');
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
      <div class="audio-visualizer">
        <div class="level-bar-container">
          <div class="level-bar" data-level="0"></div>
          <div class="peak-indicator"></div>
        </div>
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
      this.startAudioMidiAssignment(source.name);
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
        // Update level text
        const levelElement = sourceElement.querySelector('.source-level');
        if (levelElement) {
          levelElement.textContent = window.audioManager.formatVolumeLevel(source.levelMul);
        }
        
        // Update visual level bar
        const levelBar = sourceElement.querySelector('.level-bar');
        const peakIndicator = sourceElement.querySelector('.peak-indicator');
        
        if (levelBar) {
          const levelPercent = Math.max(0, Math.min(100, (source.levelMul || 0) * 100));
          levelBar.style.width = `${levelPercent}%`;
          levelBar.dataset.level = levelPercent.toFixed(0);
          
          // Color based on level
          if (levelPercent > 80) {
            levelBar.className = 'level-bar level-high';
          } else if (levelPercent > 60) {
            levelBar.className = 'level-bar level-medium';
          } else {
            levelBar.className = 'level-bar level-low';
          }
        }
        
        // Update peak indicator
        if (peakIndicator && source.peakLevel > 0.8) {
          peakIndicator.style.opacity = '1';
          setTimeout(() => {
            peakIndicator.style.opacity = '0';
          }, 100);
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
      this.startGeneralMidiLearning();
    }
  }

  startGeneralMidiLearning() {
    this.isLearningMidi = true;
    this.learningTarget = null;
    this.learningType = 'general';
    
    if (this.elements.learnMidiBtn) {
      this.elements.learnMidiBtn.textContent = 'Lernen beenden';
      this.elements.learnMidiBtn.classList.add('active');
    }
    
    // Show learning overlay
    this.showMidiLearningOverlay('Allgemeine MIDI-Kontrolle');
    
    window.midiController?.startLearning((midiEvent) => {
      console.log('UIManager: General MIDI learning captured:', midiEvent);
      this.handleGeneralMidiLearning(midiEvent);
      this.stopMidiLearning();
    });
  }

  handleGeneralMidiLearning(midiEvent) {
    // Create a hotkey mapping dialog
    this.showMidiMappingDialog(midiEvent);
  }

  showMidiMappingDialog(midiEvent) {
    const description = window.midiController?.getMidiEventDescription(midiEvent);
    
    // Create modal dialog
    const dialogHTML = `
      <div class="midi-mapping-dialog">
        <h3>MIDI-Kontrolle zuordnen</h3>
        <p>Erkannt: <strong>${description}</strong></p>
        <div class="mapping-options">
          <h4>Verfügbare Audio-Quellen:</h4>
          <div class="audio-source-list" id="audioSourceList"></div>
          <h4>Verfügbare Szenen:</h4>
          <div class="scene-list" id="sceneList"></div>
        </div>
        <div class="dialog-buttons">
          <button class="btn-secondary" onclick="this.closest('.midi-mapping-dialog').remove()">Abbrechen</button>
        </div>
      </div>
    `;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = dialogHTML;
    document.body.appendChild(overlay);
    
    // Populate audio sources
    const audioSourceList = overlay.querySelector('#audioSourceList');
    const audioSources = window.audioManager?.getAllAudioSources() || [];
    audioSources.forEach(source => {
      const button = document.createElement('button');
      button.className = 'source-mapping-btn';
      button.textContent = source.name;
      button.onclick = () => {
        this.assignMidiToAudioSource(source.name, midiEvent);
        overlay.remove();
      };
      audioSourceList.appendChild(button);
    });
    
    // Populate scenes
    const sceneList = overlay.querySelector('#sceneList');
    this.availableScenes.forEach(scene => {
      const button = document.createElement('button');
      button.className = 'scene-mapping-btn';
      button.textContent = scene.name;
      button.onclick = () => {
        this.assignMidiToScene(scene.name, midiEvent);
        overlay.remove();
      };
      sceneList.appendChild(button);
    });
    
    // Close on outside click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    };
  }

  showMidiLearningOverlay(target = '') {
    const overlay = document.createElement('div');
    overlay.className = 'midi-learning-overlay';
    overlay.innerHTML = `
      <div class="learning-content">
        <div class="learning-icon">🎹</div>
        <h3>MIDI Learning Aktiv</h3>
        <p>Bewege einen Regler oder drücke einen Button auf deinem MIDI-Controller</p>
        <div class="learning-target">${target}</div>
        <button class="btn-secondary" onclick="window.uiManager.stopMidiLearning()">Abbrechen</button>
      </div>
    `;
    document.body.appendChild(overlay);
    this.learningOverlay = overlay;
  }

  stopMidiLearning() {
    this.isLearningMidi = false;
    this.learningTarget = null;
    this.learningType = null;
    
    if (this.elements.learnMidiBtn) {
      this.elements.learnMidiBtn.textContent = 'MIDI Lernen';
      this.elements.learnMidiBtn.classList.remove('active');
    }
    
    // Remove learning overlay
    if (this.learningOverlay) {
      this.learningOverlay.remove();
      this.learningOverlay = null;
    }
    
    window.midiController?.stopLearning();
  }

  onMidiLearningStarted() {
    document.body.classList.add('midi-learning');
  }

  onMidiLearningStopped() {
    document.body.classList.remove('midi-learning');
  }

  showMidiLearningSuccess(midiEvent) {
    const description = window.midiController?.getMidiEventDescription(midiEvent);
    this.showSuccessMessage(`MIDI-Kontrolle erkannt: ${description}`);
  }

  updateMidiMappings() {
    const sources = window.audioManager?.getAllAudioSources() || [];
    this.updateAudioSources(sources);
    this.updateSceneMappingsDisplay();
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
        audioSources: window.audioManager?.getAllAudioSources().length || 0,
        scenes: this.availableScenes.length,
        midiMappings: window.midiController?.getAllMappings().length || 0,
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
      } else {
        console.log('✗ MIDI Test: No devices found');
        this.showErrorMessage('MIDI-Test', 'Keine MIDI-Geräte gefunden');
      }
    }
    
    console.log('Connection Test Results:', results);
    
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

  exportDebugInfo() {
    const debugData = {
      timestamp: new Date().toISOString(),
      appStatus: window.app?.getAppStatus() || {},
      settings: window.settingsManager?.getAll() || {},
      midiEvents: this.midiEventBuffer || [],
      obsEvents: this.obsEventBuffer || [],
      availableScenes: this.availableScenes
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
    
    this.updateMidiDevices(window.midiController?.getConnectedDevices() || []);
  }

  updateMidiDevices(devices) {
    if (!this.elements.midiDevice) return;
    
    this.elements.midiDevice.innerHTML = '<option value="">Automatisch erkennen</option>';
    
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.name} (${device.manufacturer})`;
      this.elements.midiDevice.appendChild(option);
    });
    
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
    
    window.settingsManager?.setObsSettings(obsSettings);
    
    if (window.obsManager) {
      window.obsManager.disconnect();
      setTimeout(() => {
        window.obsManager.connect(obsSettings.url, obsSettings.password);
      }, 100);
    }
    
    if (selectedMidiDevice && window.midiController) {
      window.midiController.connectToDevice(selectedMidiDevice);
    }
    
    this.closeSettings();
    this.showSuccessMessage('Einstellungen gespeichert und Verbindungen aktualisiert');
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
    
    if (e.key === 'F5') {
      e.preventDefault();
      this.refreshAudioSources();
    }
    
    if (e.key === 'F1') {
      e.preventDefault();
      this.openConnectionModal();
    }
    
    if (e.key === 'F12') {
      e.preventDefault();
      this.openDebugModal();
    }
  }

  // Cleanup
  destroy() {
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('keydown', this.handleKeyboard);
  }
}

// Export as global variable
console.log('Creating UI Manager...');
window.uiManager = new UIManager();