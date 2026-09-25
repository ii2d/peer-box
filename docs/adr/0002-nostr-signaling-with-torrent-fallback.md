# Nostr Signaling with Torrent Fallback

PeerBox uses public Nostr relays over secure WebSockets (`wss://`) as its primary WebRTC signaling strategy, retaining BitTorrent trackers as a fallback. BitTorrent trackers are commonly blocked by corporate, campus, and public Wi-Fi firewalls, whereas WebSocket traffic on port 443 reliably traverses modern middleboxes, ensuring dependable serverless peer discovery.
