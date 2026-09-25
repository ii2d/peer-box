export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  senderEmoji: string;
  recipientId: string | null;
  recipientName?: string;
  content: string;
  timestamp: number;
  isPrivate: boolean;
}

const PERSISTENCE_PREF_KEY = 'peerbox_persist_chat_preference';

export function getPersistencePreference(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(PERSISTENCE_PREF_KEY) === 'true';
}

export function setPersistencePreference(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PERSISTENCE_PREF_KEY, enabled ? 'true' : 'false');
}

export interface MessageStore {
  readonly roomId: string;
  readonly isPersisted: boolean;
  getMessages(): ChatMessage[];
  addMessage(message: ChatMessage): void;
  clear(): void;
}

export function createMessageStore(roomId: string, isPersisted = false): MessageStore {
  const storageKey = `peerbox_messages_${roomId}`;
  let memoryMessages: ChatMessage[] = [];

  if (isPersisted && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        memoryMessages = JSON.parse(raw);
      }
    } catch {
      memoryMessages = [];
    }
  }

  return {
    roomId,
    isPersisted,
    getMessages(): ChatMessage[] {
      return [...memoryMessages];
    },
    addMessage(message: ChatMessage): void {
      memoryMessages.push(message);
      if (isPersisted && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(memoryMessages));
        } catch {
          // Ignore quota errors
        }
      }
    },
    clear(): void {
      memoryMessages = [];
      if (isPersisted && typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
    },
  };
}
