# Specification: PeerBox Serverless P2P Room Chat & Chunked File Transfer

**Issue**: [#1](https://github.com/ii2d/peer-box/issues/1)  
**Triage Label**: `ready-for-agent`

## Problem Statement

Peers frequently need to exchange real-time messages, visual captures, voice memos, and large files directly between devices or collaborators without creating accounts, installing desktop software, or uploading private data to intermediate cloud servers. Existing web-based transfer solutions frequently suffer from corporate firewall blockades, lack true end-to-end room encryption, enforce low file size limits, or crash browser tabs when transferring multi-hundred-megabyte or gigabyte files.

## Solution

PeerBox is a 100% serverless, zero-knowledge peer-to-peer web application statically hosted on GitHub Pages (`peer-box.ii2d.com`). Built using Svelte 5 and Trystero WebRTC, PeerBox allows peers to create protected ephemeral rooms identified by random adjective-noun pairs (e.g. `cute-dog`) or custom names.

Signaling leverages Nostr relays (via standard secure WebSockets) with automatic BitTorrent tracker fallback. Rooms are protected by AES-GCM encryption keys derived directly from the Room Key; keys are preserved in client-side URL hashes so they are never exposed to server access logs. Transfers automatically stream directly into the Origin Private File System (OPFS) for files ≥25MB with accept/decline consent and real-time telemetry (speed & ETA), while files <25MB transfer instantly with inline media playback and voice memos. Direct P2P connectivity operates strictly without TURN relay servers, providing live ICE connection health diagnostics and transparent Trust Guarantee disclosures.

## User Stories

1. As a peer, I want to create a new room with a single click using an auto-generated random adjective-noun pair (e.g., `cute-dog`), so that I can establish a room without manual naming effort.
2. As a peer, I want to enter a custom room name, so that I can coordinate with peers on a pre-agreed room name.
3. As a room creator, I want to assign an optional Room Key, so that only participants with the matching secret key can discover, connect to, and decrypt room communications.
4. As a peer, I want to copy a full invite link that embeds the Room Key in the URL hash, so that invited peers can join with zero manual key entry.
5. As a security-conscious peer, I want the Room Key in invite links to stay strictly inside the URL hash fragment (`#key=...`), so that it is never transmitted over HTTP to GitHub Pages or any intermediate web server.
6. As a peer, I want an option to copy a link without the Room Key, so that I can transmit the key out-of-band for higher security.
7. As a mobile peer, I want to display a QR code of the room invite link, so that nearby devices can scan and join instantly.
8. As a peer visiting a protected room without a key in the URL, I want to see a clear Room Key prompt modal, so that I can enter the key before joining.
9. As a peer waiting alone in a room for more than 10 seconds, I want to see a helpful diagnostic banner with a "Change Room Key" button, so that I am notified if a key typo is preventing peer discovery.
10. As a peer joining a room, I want to be automatically assigned a fun animal persona and avatar color, so that other peers can easily distinguish me.
11. As a peer, I want to click my display persona at any time to edit my nickname, so that I can use my preferred name or handle.
12. As a returning peer, I want my chosen nickname to persist across browser sessions, so that I do not need to retype it every time.
13. As a participant in a room, I want to see a live list of currently connected peers and their connection states, so that I know who is present before transferring files.
14. As a peer sending a message or file, I want the recipient selector to default to "Everyone", so that standard group conversations require no extra clicks.
15. As a peer sending sensitive content, I want to choose a specific connected peer from a recipient selector, so that only that specific recipient receives the data.
16. As a recipient of a targeted message or file, I want to see a distinct "Private" badge, so that I know the item was sent exclusively to me.
17. As a peer, I want to drop files anywhere onto the window or use a file picker, so that transferring files is intuitive and frictionless.
18. As a peer receiving a file smaller than 25MB, I want the transfer to start automatically and show an inline preview (for images, audio, video, and code snippets), so that small media exchanges feel like an instant messaging app.
19. As a peer receiving a file 25MB or larger, I want to see an incoming transfer request card with the filename, file size, and file type, along with "Accept & Download" and "Decline" buttons, so that large transfers do not consume bandwidth or disk space without my explicit consent.
20. As a peer downloading a large file, I want incoming chunks to stream directly into the browser's Origin Private File System (OPFS), so that gigabyte-sized files do not exhaust browser memory or cause tab crashes.
21. As a peer transferring files, I want to see a real-time progress bar, transfer rate, and cancel button, so that I have full visibility and control over active transfers.
22. As a peer, I want to hold or click a microphone button to record and send an audio voice note, so that I can communicate verbally without typing.
23. As a peer on Safari or iOS, I want voice notes to seamlessly record in MP4 audio while Chrome/Firefox users record in WebM Opus, so that recording works reliably regardless of browser.
24. As a peer, I want the chat and file history to be ephemeral by default and wiped on tab close, so that no trace remains on shared or public devices.
25. As a peer on a private device, I want an option to enable local persistence in IndexedDB, so that my chat log remains accessible across page reloads in the same browser.
26. As a peer visiting clean URLs like `peer-box.ii2d.com/cute-dog`, I want the app to route correctly without 404 errors on GitHub Pages, so that clean URLs work smoothly.
27. As a peer, I want to be able to install PeerBox as a Progressive Web App (PWA) to my home screen or desktop, so that I can use it as a standalone application.
28. As an open-source contributor, I want automated GitHub Actions running security audits (`pnpm audit`), CodeQL SAST scanning, and secret leak detection, so that vulnerabilities are caught before merging to `main`.
29. As a developer, I want all commits pushed to `main` to run unit tests, typechecks, and automatically deploy to GitHub Pages with the `peer-box.ii2d.com` CNAME, so that deployments are fully automated.
30. As a peer transferring files, I want to view smoothed real-time transfer telemetry (throughput in KB/s or MB/s via a 1s EMA window and dynamic ETA), backed by dual-sided 500ms acknowledgements, so that both sender and receiver see synchronized, jitter-free progress.
31. As a peer, I want an instant screen grab button to capture a frame via `navigator.mediaDevices.getDisplayMedia`, stop stream tracks immediately for privacy, and review the image in a floating preview tray before sending, so that I can share visual context without accidental broadcasts.
32. As a peer, I want to inspect live WebRTC connection health and ICE candidate indicators (`host` for Direct LAN vs `srflx` for Direct P2P via STUN, with zero TURN relay servers used or required), with clear diagnostic guidance if symmetric NAT firewalls prevent a direct connection.
33. As a privacy-conscious peer, I want to see clear Trust Guarantee badges on the landing view and click an in-room Privacy Shield to review verifiable architectural assurances (Zero Servers, End-to-End Encryption with Room Key, Ephemeral Memory, and transparent Direct P2P public IP exposure), so that I have complete confidence in the security of my data.

## Implementation Decisions

### Signaling & End-to-End Encryption

- Primary matchmaking runs via Nostr relays over secure WebSockets (`wss://`), traversing enterprise firewalls that restrict torrent protocols. BitTorrent trackers serve as fallback (respects `docs/adr/0002-nostr-signaling-with-torrent-fallback.md`).
- Room Keys are used directly as AES-GCM encryption keys for peer discovery and data encryption.
- Room Keys in shared links remain exclusively in URL hash fragments (`#key=...`), ensuring they are never logged by GitHub Pages or web proxies (respects `docs/adr/0003-key-in-hash-fragment.md`).

### Testing Seam: `RoomTransport`

The codebase organizes around a single deep seam at the transport layer:

- **`RoomTransport` Interface**: Encapsulates room lifecycle, peer join/leave events, typed action messaging, telemetry polling, and binary chunk streaming.
- **Production Adapter (`TrysteroTransport`)**: Bridges to Trystero Nostr/Torrent implementations and browser `RTCPeerConnection.getStats()`.
- **Test Adapter (`InMemoryTransport`)**: In-memory event bus simulating connected virtual peers, latency stats, and chunk dispatch in Vitest.

### File Transfer Protocol, Streaming & Telemetry

- Message payloads are segmented into metadata announcements (`file-meta`), binary data chunks (`file-chunk`), transfer acknowledgements (`file-ack`), and cancellations (`file-cancel`).
- **Transfer Threshold**:
  - Files `< 25MB`: Automatically accepted and buffered into memory blobs for immediate rendering (image lightboxes, waveform audio, video players).
  - Files `≥ 25MB`: Displays an incoming consent card. When accepted, chunks stream directly to Origin Private File System (`navigator.storage.getDirectory()`) writable streams to prevent heap exhaustion.
- **Telemetry**: Throughput calculated via a 1-second Exponential Moving Average (EMA) window, with 500ms dual-sided acknowledgements synchronizing sender and receiver progress bars and dynamic ETA.

### Screen Grab Capture

- Captures a single still video frame using `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })` drawn onto an offscreen canvas.
- Immediately stops all media stream tracks upon frame capture, guaranteeing zero ongoing streaming overhead or background recording indicators.
- Displays a floating preview tray above the message composer for review, recipient selection, and optional captioning before dispatch.

### WebRTC Connection Health & Zero-TURN Architecture

- Operates with strict zero-TURN constraints (respects `docs/adr/0001-zero-turn-relay-architecture.md`).
- Polls `RTCPeerConnection.getStats()` every 2–3s to extract active candidate-pair details (`host` for Direct LAN, `srflx` for Direct P2P via STUN, latency in ms).
- Displays live latency pills and diagnostic guidance if symmetric NAT firewalls prevent a direct connection.

### Trust Guarantee & Privacy Presentation

- Non-intrusive Trust Guarantee badges on the landing view: `🔒 End-to-End Encrypted`, `⚡ Direct P2P (No Servers)`, `🧹 Zero Logs & Cookies`.
- Persistent in-room header button (`🛡️ Private & Ephemeral`) opening a modal with 4 visual summary cards: Zero Servers, Room Key Encryption, Ephemeral Memory, and Transparent Direct P2P Public IP Disclosure (respects `docs/adr/0004-transparent-webrtc-ip-disclosure.md`).
- Expandable technical verification sections detailing Web Crypto AES-GCM, zero-knowledge URL hashes, and Nostr WSS signaling.

### SPA Routing & Deployment

- GitHub Pages SPA routing using a `404.html` redirect script that maps `/cute-dog#key=...` through `/?p=/cute-dog#key=...` restored via `history.replaceState`.
- Automated GitHub Actions workflow (`deploy.yml`) with:
  - `pnpm audit --audit-level=high`
  - GitHub CodeQL SAST workflow
  - Gitleaks secret scanning
  - Typecheck, unit tests, and production build with CNAME `peer-box.ii2d.com`.

## Testing Decisions

- **Test Quality Standard**: Tests must verify observable user behavior through the `RoomTransport` seam rather than asserting on private state variables or mocking internal functions.
- **Modules Tested**:
  - Room lifecycle (joining, key derivation, peer presence).
  - Messaging and recipient targeting (broadcast vs targeted peer delivery).
  - File transfer state machine (chunking, reassembly, <25MB auto-download, ≥25MB prompt, cancellation, telemetry).
  - Screen grab frame capture and immediate track termination.
  - Persona generation and persistence.
  - URL hash parsing and safe key extraction.
  - Trust Guarantee dialog rendering and modal toggle state.
- **Prior Art**: Svelte 5 testing via Vitest + JSDOM (`src/App.test.ts`).

## Out of Scope

- Central user accounts, email/OAuth authentication, or persistent backend databases.
- Multi-party live audio/video streaming conferences (Mesh WebRTC AV). Voice notes are supported as recorded audio files, not live streaming.
- TURN relay server infrastructure (the system relies exclusively on direct Host and STUN NAT hole-punching for true zero-server operation).
- Server-side file relaying or long-term cloud file storage.

## Further Notes

- The project name is `peer-box`, located under the `ii2d` organization.
- Deploys to `peer-box.ii2d.com` with zero recurring hosting costs.
