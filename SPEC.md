# Specification: PeerBox Serverless P2P Room Chat & Chunked File Transfer

**Issue**: [#1](https://github.com/ii2d/peer-box/issues/1)  
**Status**: `ready-for-agent`

## Problem Statement

Users often need to quickly exchange sensitive or large files, media, and real-time messages between devices or with collaborators without creating accounts, installing native desktop software, or uploading private data to third-party cloud storage servers. Existing web-based file transfer tools frequently suffer from corporate firewall blockades, lack true end-to-end room encryption, cap file transfers at low limits, or crash browser tabs when transferring multi-hundred-megabyte or gigabyte files.

## Solution

PeerBox is a 100% serverless, zero-knowledge peer-to-peer web application hosted statically on GitHub Pages (`peer-box.ii2d.com`). Built on top of Trystero and WebRTC, PeerBox allows users to create password-protected ephemeral rooms using memorable random word pairs (e.g. `cute-dog`) or custom identifiers. 

Signaling leverages Nostr relays (via standard secure WebSockets) with automatic BitTorrent tracker fallback. Rooms are protected by AES-GCM encryption keys derived directly from room passwords; keys are preserved in client-side URL hashes so they are never exposed to server access logs. Transfers automatically stream directly into the Origin Private File System (OPFS) for files ≥25MB with accept/decline consent and real-time progress bars, while files <25MB transfer instantly with inline media playback and voice memos.

## User Stories

1. As a user, I want to create a new room with a single click using an auto-generated random adjective-noun pair (e.g., `cute-dog`), so that I can establish a room without manual naming effort.
2. As a user, I want to enter a custom room name, so that I can coordinate with peers on a pre-agreed room name.
3. As a room creator, I want to assign an optional room password, so that only participants with the matching secret key can discover, connect to, and decrypt room communications.
4. As a user, I want to copy a full invite link that embeds the room password in the URL hash, so that invited peers can join with zero manual password entry.
5. As a security-conscious user, I want the room password in invite links to stay strictly inside the URL hash fragment (`#key=...`), so that it is never transmitted over HTTP to GitHub Pages or any intermediate web server.
6. As a user, I want an option to copy a link without the password, so that I can transmit the password out-of-band for higher security.
7. As a mobile user, I want to display a QR code of the room invite link, so that nearby devices can scan and join instantly.
8. As a user visiting a password-protected room without a key in the URL, I want to see a clear password prompt modal, so that I can enter the key before joining.
9. As a user waiting alone in a room for more than 10 seconds, I want to see a helpful diagnostic banner with a "Change Password" button, so that I am notified if a password typo is preventing peer discovery.
10. As a user joining a room, I want to be automatically assigned a fun animal persona and avatar color, so that other peers can easily distinguish me.
11. As a user, I want to click my display persona at any time to edit my nickname, so that I can use my preferred name or handle.
12. As a returning user, I want my chosen nickname to persist across browser sessions, so that I do not need to retype it every time.
13. As a participant in a room, I want to see a live list of currently connected peers and their connection states, so that I know who is present before sending files.
14. As a user sending a message or file, I want the recipient selector to default to "Everyone", so that standard group conversations require no extra clicks.
15. As a user sending sensitive content, I want to choose a specific connected peer from a recipient selector, so that only that specific peer receives the data.
16. As a recipient of a targeted message or file, I want to see a distinct "Private" badge, so that I know the item was sent exclusively to me.
17. As a user, I want to drop files anywhere onto the window or use a file picker, so that sending files is intuitive and frictionless.
18. As a user receiving a file smaller than 25MB, I want the transfer to start automatically and show an inline preview (for images, audio, video, and code snippets), so that small media exchanges feel like an instant messaging app.
19. As a user receiving a file 25MB or larger, I want to see an incoming transfer request card with the filename, file size, and file type, along with "Accept & Download" and "Decline" buttons, so that large transfers do not consume bandwidth or disk space without my explicit consent.
20. As a user downloading a large file, I want incoming chunks to stream directly into the browser's Origin Private File System (OPFS), so that gigabyte-sized files do not exhaust browser memory or cause tab crashes.
21. As a user transferring files, I want to see a real-time progress bar, transfer rate, and cancel button, so that I have full visibility and control over active transfers.
22. As a user, I want to hold or click a microphone button to record and send an audio voice note, so that I can communicate verbally without typing.
23. As a user on Safari or iOS, I want voice notes to seamlessly record in MP4 audio while Chrome/Firefox users record in WebM Opus, so that recording works reliably regardless of browser.
24. As a user, I want the chat and file history to be ephemeral by default and wiped on tab close, so that no trace remains on shared or public devices.
25. As a user on a private device, I want an option to enable local persistence in IndexedDB, so that my chat log remains accessible across page reloads in the same browser.
26. As a user visiting clean URLs like `peer-box.ii2d.com/cute-dog`, I want the app to route correctly without 404 errors on GitHub Pages, so that clean URLs work smoothly.
27. As a user, I want to be able to install PeerBox as a Progressive Web App (PWA) to my home screen or desktop, so that I can use it as a standalone application.
28. As an open-source contributor, I want automated GitHub Actions running security audits (`pnpm audit`), CodeQL SAST scanning, and secret leak detection, so that vulnerabilities are caught before merging to `main`.
29. As a developer, I want all commits pushed to `main` to run unit tests, typechecks, and automatically deploy to GitHub Pages with the `peer-box.ii2d.com` CNAME, so that deployments are fully automated.

## Implementation Decisions

### 1. Signaling & Encryption Engine
- Use **Trystero** with Nostr (`trystero/nostr`) as the default signaling mechanism over secure WebSockets (`wss://`). BitTorrent (`trystero/torrent`) is retained as an alternative or fallback strategy.
- Password protection leverages Trystero's native room configuration: `joinRoom({ appId, password }, roomId)`. Trystero uses the password as an AES-GCM encryption key to secure all signaling handshakes and peer-to-peer data channels.
- When sharing a room URL, the password is encoded exclusively in the URL hash fragment (`#key=<password>`) or `?` query fallback where safe, ensuring it never touches GitHub Pages access logs.

### 2. Testing Seam: `RoomTransport` Interface
To maintain a deep module architecture with minimal test seams, the entire application couples to a single mockable transport interface:
- **`RoomTransport`**: Encapsulates room lifecycle, peer join/leave events, typed action messaging, and binary file chunk streaming.
- **`TrysteroTransport`**: The production adapter delegating to Trystero Nostr/Torrent implementations.
- **`InMemoryTransport`**: The test adapter providing an in-memory event bus that connects virtual peer instances in Vitest without real WebRTC or network sockets.

### 3. File Transfer Protocol & Streaming
- Message payloads are segmented into metadata announcements (`file-meta`), binary data chunks (`file-chunk`), transfer acknowledgements (`file-ack`), and cancellations (`file-cancel`).
- **Transfer Threshold**:
  - Files `< 25MB`: Automatically accepted and buffered into memory blobs for immediate rendering.
  - Files `≥ 25MB`: Triggers an incoming request card. On acceptance, chunks stream into a file handle backed by the Origin Private File System (`navigator.storage.getDirectory()`), preventing heap exhaustion.
- Inline media viewer components render images in lightboxes, audio in custom waveform players, video in HTML5 video elements, and code files in syntax-highlighted containers.

### 4. Recipient Targeting Model
- The send interface exposes a recipient selector defaulting to `"everyone"` (broadcast).
- When a specific connected peer is selected, Trystero's targeted action dispatch is invoked (`action.send(payload, peerId)`), and the item in the sender and recipient timelines receives a private message badge.

### 5. Storage Persistence Strategy
- Storage is managed by a pluggable storage module defaulting to an in-memory store.
- If the user toggles "Persist chat locally", the storage adapter switches to IndexedDB, saving chat logs and file transfer receipts keyed by room ID.

### 6. GitHub Pages SPA Routing
- Vite configuration produces a single-page distribution with custom domain `CNAME` for `peer-box.ii2d.com`.
- SPA navigation relies on a `404.html` redirect script that captures clean paths (e.g. `/cute-dog`) and query/hash parameters, redirecting to `/?p=/cute-dog` which is immediately restored via `history.replaceState`.

### 7. Security & CI/CD Pipeline
- GitHub Actions CI workflow runs:
  - `pnpm audit --audit-level=high` for dependency vulnerability auditing.
  - Static security analysis via GitHub CodeQL (`.github/workflows/codeql.yml`).
  - Automated secret scanning (Gitleaks).
  - TypeScript typechecking (`svelte-check`), linting (`eslint`), and unit testing (`vitest`).
  - Automated static build deployment to GitHub Pages.
- MIT License included in the repository.

## Testing Decisions

- **Definition of Good Tests**: Tests verify observable user and peer behaviors through the `RoomTransport` seam rather than internal state variables or private functions.
- **Modules Tested**:
  - Room connection lifecycle: Joining rooms, password negotiation, peer arrival, peer departure.
  - Messaging and Recipient Targeting: Broadcasting to everyone versus direct peer delivery.
  - File Transfer State Machine: Chunking, reassembly, auto-download threshold (<25MB), consent approval (≥25MB), progress reporting, and cancellation.
  - Nickname and Persona Generation: Deterministic persona assignment and persistent custom nickname updates.
  - SPA Routing & Hash Parsing: Safe extraction of room IDs and password keys from URLs.
- **Prior Art**: Svelte 5 component testing via Vitest + JSDOM (`src/App.test.ts`).

## Out of Scope

- Central user accounts, email/OAuth authentication, or persistent backend databases.
- Multi-party live audio/video streaming conferences (Mesh WebRTC AV). Voice notes are supported as recorded audio files, not live streaming.
- Server-side file relaying or long-term cloud file storage.

## Further Notes

- The project name is `peer-box`, located under the `ii2d` organization.
- Deploys to `peer-box.ii2d.com` with zero recurring hosting costs.
