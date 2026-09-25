# PeerBox

PeerBox is a serverless, peer-to-peer communication space for real-time messaging and direct file exchange between web browsers without central intermediaries.

## Language

### Space & Security

**Room**:
An ephemeral virtual space where two or more peers discover each other and communicate.
_Avoid_: Channel, session, lobby, chatroom

**Room Key**:
A shared secret string used to derive encryption keys for peer discovery and end-to-end data encryption.
_Avoid_: Password, PIN, auth token

### Identity

**Peer**:
An individual browser instance actively participating in a Room.
_Avoid_: User, member, account, client

**Persona**:
The temporary display name and avatar color representing a Peer in a Room.
_Avoid_: Profile, username, handle

### Communication & Exchange

**Recipient**:
The designated audience for a message or file, either all peers in the room or a single specific peer.
_Avoid_: Destination, target, recipient list

**Transfer**:
The direct, peer-to-peer transmission of binary file or media data between peers.
_Avoid_: Upload (there is no server to upload to), sync

**Download**:
The action of receiving and saving transferred file data onto the local device.
_Avoid_: Fetch, pull

**Voice Note**:
A recorded audio memo captured in-browser and transmitted as an audio payload.
_Avoid_: Voice message, audio clip, call

**Screen Grab**:
A single still frame captured from a selected display, window, or tab, sent as an image.
_Avoid_: Screenshot, screen share, stream

**Telemetry**:
Live measurement of transfer throughput (speed), estimated time remaining (ETA), and round-trip connection latency between peers.
_Avoid_: Analytics, stats, monitoring
