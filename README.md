# ADS-B Aircraft Tracker

A real-time ADS-B (Automatic Dependent Surveillance-Broadcast) aircraft tracking application with advanced signal strength visualization and analysis capabilities using live or recorded data from Universiy of Twente sensors. 

### Core Functionality
- **Real-time Aircraft Tracking**: Live display of aircraft positions from ADS-B receivers
- **Signal Strength Analysis**: Visual representation of RSSI (Received Signal Strength Indicator) values
- **Historical Data Playback**: Process and visualize historical ADS-B data from JSONL files
- **Multi-receiver Support**: Simultaneous tracking from multiple ADS-B receivers (zi-5067, zi-5110)

### Advanced Visualization
- **Interactive Map Interface**: Pan and zoom controls for exploring coverage areas
- **Signal-Strength Based Trails**: Aircraft flight paths with opacity and size reflecting signal quality
- **Real-time Signal Indicators**: 4-bar signal strength displays for each aircraft
- **Color-coded Receivers**: Red (zi-5067) and Blue (zi-5110) receiver differentiation

## 🎮 Usage

### Historical Data Mode
1. Place your JSONL data file in the `src/` directory
2. Update the import in `App.svelte`:
   ```typescript
   import bigass from "./your-data-file.jsonl?raw";
   ```
3. Uncomment the `processEntries()` call to start playback

### Controls
- **Arrow Keys**: Pan the map view
- **+/-**: Zoom in/out
- **Aircraft Panel**: Toggle individual aircraft visibility
- **Collapse Button**: Hide/show the control panel

## 📊 Signal Analysis Features

### Trail Visualization
- **Opacity**: Stronger signals appear brighter
- **Size**: Signal strength determines trail dot size
- **Color**: Matches receiver color (Red/Blue)
- **Tooltips**: Hover for exact RSSI values and timestamps

### RSSI Values
- **Strong Signal**: -30 to -50 dBm (bright, large trail dots)
- **Medium Signal**: -50 to -70 dBm (moderate visibility)
- **Weak Signal**: -70 to -90 dBm (faint trail dots)
- **Very Weak**: Below -90 dBm (minimal visibility)

### Signal Bars
- **4 Bars**: Strongest signal in current group
- **3 Bars**: Good signal quality
- **2 Bars**: Moderate signal quality
- **1 Bar**: Weak but detectable signal


## 📄 Data Format

The application expects ADS-B data in JSON Lines format:
```json
{
  "address": "A12345",
  "latitude": 51.9200,
  "longitude": 5.9200,
  "altitude": 10000,
  "heading": 180,
  "speed": 450,
  "rssi": -45,
  "receiver": "zi-5067",
  "timestamp": "2024-01-01T12:00:00Z"
}
```