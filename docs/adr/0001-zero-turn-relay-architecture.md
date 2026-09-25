# Zero-TURN Relay Architecture

PeerBox exclusively relies on direct WebRTC connections (`host` on local LAN and `srflx` via public STUN NAT traversal) and explicitly forbids deploying, maintaining, or configuring TURN relay servers. While this accepts that strict double-symmetric NAT corporate firewalls may fail to establish a direct connection, it guarantees 100% serverless, zero-maintenance, zero-cost static hosting on GitHub Pages with zero liability for relaying user traffic.
