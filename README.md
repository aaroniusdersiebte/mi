# OBS MIDI Mixer

Ein professioneller MIDI-gesteuerter Audio-Mixer für OBS Studio mit intuitivem Dark Design und modularer Architektur.

## ✨ Features

### 🎵 Audio-Management
- **Echtzeit-Audio-Visualisierung** aller OBS-Quellen
- **Präzise Lautstärke-Kontrolle** mit Slidern und MIDI-Controllern
- **Sofortiges Muten/Unmuten** per Klick oder MIDI-Button
- **Automatische Pegelanzeige** in dB und Prozent

### 🎛️ MIDI-Integration
- **Automatische MIDI-Geräteerkennung**
- **Einfaches MIDI-Learning** - einfach Knopf drücken
- **Flexibles Mapping** für Fader, Knöpfe und Controller
- **Mehrere MIDI-Geräte** parallel unterstützt

### 🎨 Benutzeroberfläche
- **Dark Apple Design** mit Orange-Akzenten
- **Responsive Layout** mit verschiebbarem Splitter
- **Minimalistisch und intuitiv**
- **Echtzeit-Verbindungsstatus**

### ⚙️ Konfiguration
- **Persistente Einstellungen** - alles wird gespeichert
- **Import/Export** von Konfigurationen
- **Modulare Architektur** für einfache Wartung
- **Debug-Modus** für Entwickler

## 🚀 Installation

### Voraussetzungen
- **Node.js** (Version 18 oder höher)
- **OBS Studio** (Version 28 oder höher)
- **MIDI-Controller** (optional, aber empfohlen)

### Schritt 1: Projekt klonen/herunterladen
```bash
# Projekt-Ordner erstellen
mkdir obs-midi-mixer
cd obs-midi-mixer

# Oder: ZIP herunterladen und entpacken
```

### Schritt 2: Dependencies installieren
```bash
npm install
```

### Schritt 3: OBS WebSocket konfigurieren
1. OBS Studio öffnen
2. **Tools → WebSocket Server Settings**
3. **Server aktivieren** ✓
4. **Port:** 4455 (Standard)
5. **Passwort** setzen (empfohlen)

### Schritt 4: Anwendung starten
```bash
# Entwicklungsmodus
npm run dev

# Produktionsmodus
npm start
```

## 🎛️ Verwendung

### Erste Schritte
1. **OBS-Verbindung** - Wird automatisch hergestellt
2. **MIDI-Gerät** anschließen - Wird automatisch erkannt
3. **Audio-Quellen** erscheinen automatisch links
4. **MIDI-Zuordnungen** rechts verwalten

### MIDI-Controller zuordnen
1. **"MIDI Lernen"** Button drücken
2. **Gewünschten Regler/Button** am MIDI-Gerät betätigen
3. **Zuordnung** wird automatisch gespeichert
4. **Fertig!** - Controller steuert jetzt die Audio-Quelle

### Audio-Kontrolle
- **Lautstärke**: Slider ziehen oder MIDI-Fader verwenden
- **Mute**: 🔊/🔇 Button oder MIDI-Button drücken
- **Pegelanzeige**: Echtzeit dB-Werte neben Quelle

### Einstellungen
- **⚙️ Button** oben rechts klicken
- **OBS-Verbindung** anpassen
- **MIDI-Gerät** manuell auswählen
- **Einstellungen** werden automatisch gespeichert

## 🏗️ Architektur

### Modularer Aufbau
```
src/
├── renderer/           # Frontend (HTML/CSS/JS)
│   ├── index.html     # Hauptfenster
│   ├── styles.css     # Dark Apple Design
│   └── renderer.js    # UI-Koordination
├── modules/           # Backend-Module
│   ├── obs-websocket.js    # OBS-Verbindung
│   ├── midi-controller.js  # MIDI-Verwaltung
│   ├── audio-manager.js    # Audio-Logik  
│   ├── settings-manager.js # Einstellungen
│   └── ui-manager.js       # UI-Verwaltung
└── config/
    └── default-settings.json
```

### Manager-System
- **OBSWebSocketManager**: Verbindung zu OBS, Audio-Events
- **MidiController**: MIDI-Geräte, Learning, Mapping
- **AudioManager**: Audio-Quellen, Lautstärke, Mute
- **SettingsManager**: Persistente Konfiguration
- **UIManager**: Interface, Events, Layout

## 🔧 Development

### Projekt starten
```bash
# Entwicklungsmodus mit DevTools
npm run dev

# Produktions-Build
npm run build

# Projekt bereinigen
npm run clean
```

### Debug-Funktionen
```javascript
// In der Browser-Konsole
debugApp()           // Debug-Informationen ausgeben
app.getAppStatus()   // Aktueller Status
app.managers.obs     // OBS Manager direkt ansprechen
```

### Code-Stil
- **Modulare Architektur** - Jede Datei hat klare Verantwortung
- **Event-basiert** - Lose Kopplung zwischen Modulen
- **Error Handling** - Robuste Fehlerbehandlung
- **TypeScript-ready** - Kann einfach zu TS migriert werden

## 📋 Unterstützte MIDI-Controller

### Getestet mit:
- **Behringer X-Touch Mini**
- **Akai MPD218**
- **Novation Launch Control XL**
- **Arturia BeatStep**

### Unterstützte MIDI-Events:
- **Control Change** (CC) - Fader, Knöpfe, Encoder
- **Note On/Off** - Buttons, Pads
- **Program Change** - Szenen-Wechsel
- **Pitch Bend** - Spezielle Controller

## ⚠️ Fehlerbehebung

### OBS verbindet nicht
1. **OBS läuft?** - Studio muss geöffnet sein
2. **WebSocket aktiv?** - Tools → WebSocket Server Settings
3. **Port korrekt?** - Standard: 4455
4. **Firewall?** - Windows Defender prüfen

### MIDI-Gerät nicht erkannt
1. **Gerät angeschlossen?** - USB-Kabel prüfen
2. **Treiber installiert?** - Herstellerseite besuchen
3. **Browser-Support?** - Chrome/Edge empfohlen
4. **Berechtigung?** - MIDI-Zugriff erlauben

### Audio-Quellen fehlen
1. **OBS-Quellen vorhanden?** - Audio-Inputs in OBS prüfen
2. **Quellentyp korrekt?** - Muss Audio-Input sein
3. **Verbindung stabil?** - OBS neu verbinden

### Performance-Probleme
1. **Hardware-Beschleunigung** aktivieren
2. **Update-Rate reduzieren** (60 → 30 fps)
3. **Debug-Modus deaktivieren**
4. **Andere Programme schließen**

## 🛠️ Erweiterte Konfiguration

### Hotkeys anpassen
```json
{
  "hotkeys": {
    "globalHotkeys": {
      "toggleMidiLearning": "F1",
      "refreshSources": "F5",
      "openSettings": "Ctrl+,",
      "toggleMasterMute": "F2"
    }
  }
}
```

### Performance optimieren
```json
{
  "audio": {
    "updateRate": 30,        // Reduziert CPU-Last
    "volumeSmoothing": false  // Deaktiviert Glättung
  },
  "advanced": {
    "performanceMode": true   // Aktiviert Performance-Modus
  }
}
```

## 📝 Changelog

### Version 1.0.0
- ✅ Grundlegende OBS-WebSocket-Integration
- ✅ MIDI-Controller-Support
- ✅ Audio-Quellen-Visualisierung
- ✅ Persistente Einstellungen
- ✅ Dark Apple UI-Design
- ✅ Modulare Architektur

### Geplante Features
- 🔄 Szenen-Steuerung über MIDI
- 🔄 Mehrere OBS-Instanzen
- 🔄 VST-Plugin-Kontrolle
- 🔄 Custom UI-Themes
- 🔄 MIDI-Feedback (LEDs)

## 🤝 Beitragen

1. **Fork** das Repository
2. **Feature Branch** erstellen (`git checkout -b feature/amazing-feature`)
3. **Änderungen committen** (`git commit -m 'Add amazing feature'`)
4. **Branch pushen** (`git push origin feature/amazing-feature`)
5. **Pull Request** erstellen

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei für Details.

## 🙋‍♂️ Support

- **Issues** auf GitHub erstellen
- **Diskussionen** in GitHub Discussions
- **Wiki** für detaillierte Dokumentation

---

**Happy Streaming! 🎥🎵**