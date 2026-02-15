# Morphogen

A real-time reaction-diffusion simulation engine with a Rust backend and a browser-based WebGL/Canvas renderer.

## Architecture

```
morphogen/
  server/     - Rust simulation engine (Axum + WebSocket)
  client/     - TypeScript browser renderer (Vite + Canvas)
  shared/     - Shared type definitions and protocol specs
  docs/       - Design documents and references
  scripts/    - Build and deploy helpers
  data/       - Simulation snapshots and logs (gitignored)
```

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable, 2024 edition)
- [Node.js](https://nodejs.org/) >= 20

### Server

```sh
cargo build --release
cargo run -p morphogen-server
```

### Client

```sh
cd client
npm install
npm run dev
```

The browser will connect to the server via WebSocket at `ws://localhost:3000`.

## Development

Run `cargo check` and `tsc --noEmit` before committing. The CI pipeline enforces both.

## License

MIT
