# Radio Traffic Stitcher

A cross-platform desktop application for combining multiple audio clips into a single MP3 file.

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- 🎵 **Drag & Drop** - Drop audio files directly onto the app
- 📂 **File Picker** - Browse and select multiple files
- ↕️ **Reorder Clips** - Drag or use ▲/▼ buttons to arrange order
- ⏱️ **Duration Display** - See duration and file size for each clip
- 🎚️ **Quality Settings** - Choose bitrate (128-320 kbps)
- 🚀 **FFmpeg Powered** - Seamless audio concatenation
- 🌙 **Modern Dark UI** - Clean interface with glassmorphism effects

## Supported Formats

MP3, WAV, OGG, FLAC, M4A, AAC, WMA, OPUS

## Requirements

- [FFmpeg](https://ffmpeg.org/) must be installed on your system

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/radio-traffic-stitcher.git
cd radio-traffic-stitcher

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Linux Dependencies

#### Arch Linux
```bash
sudo pacman -S webkit2gtk-4.1 ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt install libwebkit2gtk-4.1-dev ffmpeg
```

### GPU Workaround (Linux)

If you see a white screen, run with:
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 ./radio-traffic-stitcher
```

## Usage

1. **Add Clips** - Drag audio files or click to browse
2. **Reorder** - Use ▲/▼ buttons or drag clips to desired order
3. **Configure** - Set output filename and quality
4. **Export** - Click "Export to MP3" and choose save location

## Tech Stack

- **[Tauri 2.0](https://tauri.app/)** - Rust-based desktop framework
- **[React 19](https://react.dev/)** - UI framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[FFmpeg](https://ffmpeg.org/)** - Audio processing

## License

MIT License - see [LICENSE](LICENSE) for details.
