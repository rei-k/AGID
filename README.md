# GeoGrid Explorer

An advanced, interactive geographic visualization tool built with React, MapLibre GL, and Express. GeoGrid Explorer provides high-precision grid overlays, integrated elevation data, and intelligent location searching for both land and sea.

![GeoGrid Explorer UI](https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1200)

## Features

- **Dynamic Grid Overlay**: High-performance grid rendering that adapts to zoom levels. Includes a 300m "focus radius" that remains visible even at lower zooms.
- **Elevation Integration**: Real-time elevation lookups using multiple open-source data providers (OpenTopoData, Open-Elevation).
- **Marine Support**: Intelligent sea naming and location proxying using Marine Regions Gazetteer.
- **Smart Search**: Integrated Nominatim search with quick-action coordinates and Japanese region handling.
- **Customizable UI**: Support for multiple map styles (Satellite, Dark, Outdoor, Light) with responsive design.
- **External Map Bridge**: Quick shortcuts to open current locations in Google Maps, Yahoo Map, and more.

## Tech Stack

- **Frontend**: React 18, Vite, MapLibre GL, Tailwind CSS, Motion (framer-motion), Lucide React.
- **Backend API**: Express (Node.js) acting as a proxy for elevation and marine data to avoid CORS issues.
- **Worker Threads**: Off-canvas grid generation using Web Workers for smooth UI performance.
- **Native Core (Optional)**: Rust (WASM) for AGID quantization/Hilbert encode-decode acceleration.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/geogrid-explorer.git
   cd geogrid-explorer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Development Mode**:
   Starts the Express server which also serves the Vite frontend.
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

4. **Build for Production**:
   ```bash
   npm run build
   ```

5. **Build Rust WASM Core (optional, for faster AGID core math)**:
   ```bash
   npm run build:rust-wasm
   ```

## Configuration

Environment variables can be set in a `.env` file (see `.env.example`).
- `PORT`: Server port (default: 3000)

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [MapLibre GL](https://maplibre.org/)
- [Marine Regions](https://www.marineregions.org/)
- [OpenTopoData](https://www.opentopodata.org/)
- [Open-Elevation](https://open-elevation.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)
