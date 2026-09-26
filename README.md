<div align="center">
  <img src="public/icon.svg" width="96" height="96" alt="PeerBox Logo" />
  <h1>PeerBox</h1>
  <p><strong>Serverless, zero-login peer-to-peer workspace for real-time messaging and chunked file sharing via WebRTC & Nostr.</strong></p>

  <p>
    <a href="https://peer-box.ii2d.com"><strong>peer-box.ii2d.com »</strong></a>
  </p>

  <p>
    <a href="https://peer-box.ii2d.com"><img src="https://img.shields.io/badge/Demo-peer--box.ii2d.com-38bdf8?style=flat-square&logo=cloudflare&logoColor=white" alt="Live Demo" /></a>
    <a href="https://github.com/ii2d/peer-box/actions/workflows/deploy.yml"><img src="https://img.shields.io/github/actions/workflow/status/ii2d/peer-box/deploy.yml?branch=main&label=CI&style=flat-square" alt="CI Status" /></a>
    <a href="https://github.com/ii2d/peer-box/actions/workflows/codeql.yml"><img src="https://img.shields.io/github/actions/workflow/status/ii2d/peer-box/codeql.yml?branch=main&label=CodeQL&style=flat-square" alt="CodeQL" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
    <a href="https://svelte.dev"><img src="https://img.shields.io/badge/Svelte-5.x%20Runes-ff3e00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5" /></a>
    <a href="https://webrtc.org"><img src="https://img.shields.io/badge/WebRTC-P2P-333333?style=flat-square" alt="WebRTC" /></a>
  </p>
</div>

---

## ⚡ Highlights

PeerBox enables private, instant, browser-to-browser collaboration with **no accounts, no backend servers, and no tracking**:

- **🔒 Zero Servers & Intermediaries**: Direct browser-to-browser WebRTC DataChannels. No central server inspects, relays, or stores messages.
- **🔑 URL Hash Encryption**: The secret Room Key resides exclusively in the URL hash fragment (`#key=...`), which web browsers never transmit over HTTP.
- **📦 Large File Streaming (OPFS)**: Slices and streams files of any size directly to disk using the Origin Private File System (OPFS), bypassing browser memory limits.
- **🧹 Ephemeral State**: All active state lives in volatile browser memory—closing the tab erases everything.

---

## ✨ Features

- **Direct Messaging**: Low-latency room broadcasts or 1-to-1 targeted whispers.
- **OPFS File Transfers**: Chunked direct transfers with backpressure control and live throughput/ETA telemetry.
- **Voice Notes**: In-browser audio recording with Opus compression and interactive waveform preview.
- **Screen Grabs**: Capture a display or window frame instantly without video call overhead.
- **Connection Telemetry**: Live metrics for connection type (`Direct LAN` vs `Direct P2P`) and round-trip latency.
- **Instant Pairing**: 1-click room link copying and built-in offline QR code generation for mobile devices.
- **PWA & Mobile Ready**: Responsive edge-to-edge layout with safe-area support and offline PWA caching.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (≥ 18.0.0, Node 22 recommended)
- [pnpm](https://pnpm.io/) (≥ 12.0.0)

### Installation

```bash
# Clone the repository
git clone https://github.com/ii2d/peer-box.git
cd peer-box

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 Available Scripts

| Command             | Description                                   |
| :------------------ | :-------------------------------------------- |
| `pnpm dev`          | Start Vite local development server           |
| `pnpm build`        | Compile production bundle to `dist/`          |
| `pnpm preview`      | Preview production build locally              |
| `pnpm test`         | Run Vitest test suite                         |
| `pnpm test:watch`   | Run Vitest in interactive watch mode          |
| `pnpm check`        | Run `svelte-check` and TypeScript diagnostics |
| `pnpm lint`         | Run ESLint across codebase                    |
| `pnpm lint:fix`     | Automatically fix ESLint errors               |
| `pnpm format`       | Format code with Prettier                     |
| `pnpm format:check` | Check code formatting with Prettier           |

---

## 🛡️ Trust & Privacy Architecture

PeerBox is built around four verifiable guarantees:

1. **Zero Central Relays**: No central TURN servers relay your content ([ADR-0001](docs/adr/0001-zero-turn-relay-architecture.md)).
2. **Decentralized Signaling**: Discovery operates over public Nostr relays without a custom backend ([ADR-0002](docs/adr/0002-nostr-signaling-with-torrent-fallback.md)).
3. **Key in Hash Fragment**: The Room Key is never sent in HTTP request headers or query strings ([ADR-0003](docs/adr/0003-key-in-hash-fragment.md)).
4. **Transparent IP Disclosure**: Direct WebRTC connections exchange IP addresses directly between peers; PeerBox discloses this transparently ([ADR-0004](docs/adr/0004-transparent-webrtc-ip-disclosure.md)).

---

## 📚 Documentation

- [Domain Model & Glossary](CONTEXT.md) – Project terminology and conceptual boundaries.
- [Technical Specification](SPEC.md) – Architectural contracts and protocols.
- [Agent Guidelines](AGENTS.md) – Development conventions and issue triage workflow.
- [Architecture Decision Records (ADRs)](docs/adr/) – Architectural history and trade-offs.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository and create your feature branch: `git checkout -b feature/my-feature`
2. Ensure tests and typechecks pass:
   ```bash
   pnpm check
   pnpm test
   pnpm lint
   pnpm format:check
   ```
3. Commit your changes and push to your fork.
4. Open a Pull Request detailing the changes made.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
