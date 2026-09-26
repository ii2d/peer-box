# Specification: Full-Window Workspace, Responsive Mobile Roster & SEO Portal

## Problem Statement

Peers currently interact with PeerBox through a narrow, centered modal card constrained to `max-width: 640px` and a fixed height. On desktop screens, this layout wastes valuable display area, causes long chat messages and file transfers to feel cramped, and hides presence and connection telemetry behind nested drawers. On mobile devices, viewport height calculation and virtual keyboard activation push controls off-screen or cause jittery layout shifting. Furthermore, because PeerBox previously displayed only a minimalist room creation form, search engines (Google, Bing) and AI search agents (Perplexity, ChatGPT Search, Claude) could not index or cite PeerBox's zero-server privacy model, large file OPFS streaming capabilities, or WebRTC architecture.

## Solution

Transform PeerBox into a responsive, full-window application with a dual presentation architecture:

1. **Public SEO & AI-SEO Portal (`/`)**: An above-the-fold interactive hero for instantaneous 1-click room creation and joining, combined with an extensive below-the-fold semantic showcase detailing the zero-server trust model, chunked OPFS file transfers, voice notes, and structured FAQ schema (`SoftwareApplication` & `FAQPage` JSON-LD).
2. **Full-Window In-Room Workspace (`/<room>#key=...`)**: An edge-to-edge (`100vw` × `100dvh`) 2-column workspace on desktop featuring a dedicated **Roster** (Room metadata, encryption status, Persona profile, active Peers with live WebRTC latency badges, diagnostics) and an expansive **Timeline** and pinned **Composer**.
3. **Responsive Mobile Shell**: An adaptive mobile layout (`<768px`) where the Roster collapses into an off-canvas drawer with backdrop blur, and the Timeline and Composer utilize `100dvh` and safe-area insets (`env(safe-area-inset-bottom)`) to prevent virtual keyboard disruption.

## User Stories

1. As a visiting peer on the Portal, I want to see an immediate, clear hero card with a 1-click "Create Room" button, so that I can start a private room in under 5 seconds without distractions.
2. As a visiting peer on the Portal, I want to type a custom room name and optional Room Key, so that I can join a pre-arranged room with my team.
3. As a visiting peer interested in privacy, I want to scroll down the Portal to read an architecture overview of how WebRTC P2P and Nostr signaling work without central servers, so that I understand why PeerBox cannot log or intercept my data.
4. As a visiting peer comparing file transfer tools, I want to view a side-by-side comparison between cloud relay services (WeTransfer, Telegram, Google Drive) and PeerBox's direct browser-to-browser streaming, so that I can evaluate the security trade-offs.
5. As an AI search engine crawler (Perplexity, ChatGPT, Claude) or web spider (Google, Bing), I want to parse structured semantic HTML headings (`<h1>`, `<h2>`, `<article>`), feature summaries, and JSON-LD `SoftwareApplication` and `FAQPage` schemas, so that I can index and accurately answer user queries about PeerBox.
6. As a peer entering a room on a desktop monitor, I want the workspace to fill the full browser window (`100vw` × `100dvh`) without outer borders, so that I have maximum screen real estate for communication.
7. As a peer in a desktop room, I want a dedicated left Roster panel displaying the Room ID, encryption badge, my Persona, and all connected Peers, so that I can monitor room membership and WebRTC telemetry without obstructing the chat stream.
8. As a peer in a desktop room, I want to copy the room share link with a single click from the Roster header, so that I can invite other peers immediately.
9. As a peer in a desktop room, I want to see real-time WebRTC connection badges (`⚡ Direct LAN` / `🌐 Direct P2P`) and round-trip ping next to each peer in the Roster, so that I immediately know network transfer viability.
10. As a peer in a room, I want the Timeline to occupy a readable centered column with full vertical scrolling, so that message reading remains comfortable without stretching text across ultra-wide monitors.
11. As a peer in a room, I want the Composer to stay pinned at the bottom of the window, so that I can send messages, attach files, record voice notes, or capture screen grabs without losing my place in the Timeline.
12. As a peer on a mobile smartphone, I want the room to span the exact dynamic viewport height (`100dvh`) with safe-area bottom padding, so that the mobile browser chrome and home indicator do not obscure the Composer.
13. As a peer on a mobile smartphone, I want the Roster to collapse into a smooth slide-over drawer accessible via a header button, so that my mobile chat timeline has full width while still keeping peer stats accessible.
14. As a peer on a mobile smartphone, I want the virtual keyboard opening to resize only the internal Timeline while keeping the Composer visible, so that typing a message does not awkwardly shift or hide the room header.
15. As a peer in a room, I want to view the Trust Guarantee explainer modal and Room Share QR code from persistent header buttons, so that security assurances and mobile QR scanning are always one tap away.

## Implementation Decisions

- **Full-Window App Shell (`app.css`)**:
  - Remove `#app` `max-width: 640px`, centering flex rules, and outer card padding.
  - Set root application container to `width: 100vw; height: 100dvh; overflow: hidden;` in Room view.
  - Implement mobile safe-area insets (`env(safe-area-inset-bottom)`) on the Composer.
- **Semantic SEO Portal View**:
  - The Portal root layout remains centered above the fold with the brand badge, 1-click room creation, custom room inputs, and trust chips.
  - Below the fold includes semantic `<section>` components:
    - Feature Showcase: Large file OPFS chunked streaming, ephemeral voice notes, instant screen grab, zero-TURN direct P2P.
    - Architecture & Privacy: Web Crypto AES-GCM explanation, `#key=...` hash fragment isolation, and Nostr WSS signaling.
    - Comparison Table: Traditional Cloud/Relay vs PeerBox Direct P2P.
    - Structured FAQ: `<details>` / `<summary>` accordions for common questions.
  - Inject JSON-LD `SoftwareApplication` and `FAQPage` schemas into `index.html` for rich search engine indexing.
- **Desktop 2-Column Room Workspace (`>= 768px`)**:
  - **Left Roster (`280px–300px` fixed width)**:
    - Room branding and ID with 1-click copy link.
    - Room Key status (`🔒 Encrypted` / `🌐 Open`) with inline key edit modal trigger.
    - Persona card with avatar and inline nickname editor.
    - Peers presence list with real-time `ConnectionBadge` (ping, LAN/STUN mode) and click-to-target recipient shortcut.
    - ICE Diagnostics drawer launcher and Leave Room action.
  - **Main Timeline & Composer**:
    - Header: Room title, active Recipient indicator, `🛡️ Private & Ephemeral` Trust Guarantee button, and `🔗 Share` button.
    - Banners: Alone diagnostic banner and symmetric NAT firewall diagnostic banner.
    - Timeline: Fluid flex container with `overflow-y: auto`, `overscroll-behavior-y: contain`, and max reading width of `900px` centered.
    - Composer: Pinned to bottom, supporting text drafting, paperclip file picker, screen grab trigger, voice note recorder, and recipient selector.
- **Mobile Responsive Drawer (`< 768px`)**:
  - Left Roster hidden off-canvas, sliding into view over a semi-transparent backdrop blur when toggled via a `👥 Peers` button in the room header.
  - Backdrop tap or swipe dismisses the Roster drawer.

## Testing Decisions

- **Observable Behavior Focus**: Tests exercise observable UI changes and DOM rendering through the existing `RoomTransport` seam and `InMemoryTransport` harness, avoiding assertions on private component state.
- **Modules Tested**:
  - `src/App.test.ts`: Verification of Portal above-the-fold controls, below-the-fold semantic sections, transition from Portal to full-window Room view upon room creation/join, desktop Roster presence rendering, mobile Roster drawer open/close toggle, and Composer persistence.
  - Existing suite of 24 test files (88 tests) covering chat, transfers, OPFS streaming, voice notes, screen grabs, WebRTC diagnostics, and trust modals must maintain 100% pass rate.
- **Prior Art**: Vitest + JSDOM unit and integration tests in `src/App.test.ts`.

## Out of Scope

- Central server-side rendering (SSR) frameworks (Next.js/SvelteKit server endpoints) — the app remains 100% static client-side Svelte 5 deployed to GitHub Pages.
- Cloud storage databases or remote account profiles.
- Live multi-party mesh video calls (voice notes and screen grabs remain file/media based).

## Further Notes

- Respects all architectural decisions: [ADR-0001](docs/adr/0001-zero-turn-relay-architecture.md) (Zero TURN), [ADR-0002](docs/adr/0002-nostr-signaling-with-torrent-fallback.md) (Nostr signaling), [ADR-0003](docs/adr/0003-key-in-hash-fragment.md) (Key in hash fragment), [ADR-0004](docs/adr/0004-transparent-webrtc-ip-disclosure.md) (WebRTC IP disclosure), and [ADR-0005](docs/adr/0005-full-window-workspace-and-seo-portal.md) (Full-Window Workspace and SEO Portal).
- Strictly employs canonical terms from [CONTEXT.md](CONTEXT.md): `Portal`, `Room`, `Room Key`, `Peer`, `Persona`, `Recipient`, `Transfer`, `Download`, `Voice Note`, `Screen Grab`, `Telemetry`, `Trust Guarantee`, `Roster`, `Timeline`, `Composer`.
