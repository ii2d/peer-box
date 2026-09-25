export interface PeerInfo {
  id: string;
  name?: string;
  color?: string;
}

export interface RoomTransportConfig {
  roomId: string;
  roomKey?: string | null;
  peerId?: string;
}

export interface PeerConnectionStats {
  peerId: string;
  roundTripTimeMs: number;
  candidateType: 'host' | 'srflx';
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'failed';
}

export interface RoomTransport {
  readonly localPeerId: string;
  readonly currentRoomId: string | null;
  readonly currentRoomKey: string | null;

  joinRoom(config: RoomTransportConfig): Promise<void>;
  leaveRoom(): void;
  getPeers(): PeerInfo[];

  onPeerJoin(cb: (peer: PeerInfo) => void): () => void;
  onPeerLeave(cb: (peerId: string) => void): () => void;

  sendAction<T>(actionName: string, payload: T, targetPeerId?: string): void;
  onAction<T>(actionName: string, cb: (payload: T, senderId: string) => void): () => void;

  getPeerStats?(peerId: string): Promise<PeerConnectionStats | null>;
}
