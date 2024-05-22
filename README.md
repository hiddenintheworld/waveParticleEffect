# Interactive Particle System

This interactive particle system is built using Three.js and allows for dynamic manipulation of particle attributes, audio processing, and wave generation based on user input. The system is designed to provide an intuitive interface for modifying particle behavior in real time.

## Features

- **Dynamic Particle System**: Adjust the number of rows and columns of particles.
- **Real-time Audio Processing**: Load and process audio in real time to drive particle motion.
- **Wave Generation**: Trigger waves across the particle grid based on audio peaks.
- **Undo/Redo Actions**: Manage changes with an undo/redo system.
- **Save/Load Configuration**: Save the current configuration to a file and load it back.

## User Interface

### Controls

- **General Controls**
  - `Arrow Up`: Toggle mode to add upward forces.
  - `Arrow Down`: Toggle mode to add downward forces.
  - `Space`: Toggle between 'add' and 'edit' modes.
  - `Arrow Left`: Undo the last action.
  - `Arrow Right`: Redo an action.
  - `D`: Activate wave generation mode.
  - `C`: Deactivate wave generation mode.

### GUI Parameters

- **a, b, tension, gravity, gravityRange, forceScale**: Adjust these parameters to tweak the physical properties affecting particle movement.
- **spacing, particleSize**: Adjust the visual spacing and size of particles.
- **rows, cols**: Adjust the grid dimensions. Changes here will reinitialize the particle system to accommodate new grid sizes without disrupting ongoing interactions.

### Adding and Editing Forces

- Click on the particle grid to add new forces (in 'add' mode) or to modify existing forces (in 'edit' mode). When adding forces, the direction (upward or downward) is determined by the last used arrow key (up for upward, down for downward).

### Audio Interaction

- **Load Audio**: Use the file input to load audio. The system will process the audio and use it to drive particle motion.
- **Start Audio**: Click the start button to begin audio playback. This also starts the particle animation influenced by the audio.

### Saving and Loading Configurations

- **Save Configuration**: Click the save button to download the current configuration as a JSON file.
- **Load Configuration**: Use the load button to select and load a configuration from a JSON file.

## Installation

1. Clone the repository or download the source code.
2. Open the project in a web server environment (local server setup is recommended as file loading is involved).
3. Load `index.html` in your web browser to start the application.

## Dependencies

- Three.js
- dat.GUI
- Web Audio API

## Browser Compatibility

The application is built with modern web technologies and should run on most up-to-date web browsers, including Chrome, Firefox, Safari, and Edge.

## Author

hiddenintheworld

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
