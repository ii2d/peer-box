import type { Persona } from '../persona/persona';
import type { RoomTransport } from '../transport/types';
import type { ChatMessage, MessageStore } from './message-store';

export interface ChatServiceOptions {
  transport: RoomTransport;
  store: MessageStore;
  persona: Persona;
}

export class ChatService {
  private transport: RoomTransport;
  private store: MessageStore;
  private persona: Persona;
  private messageListeners = new Set<(msg: ChatMessage) => void>();
  private unsubAction: (() => void) | null = null;

  constructor(options: ChatServiceOptions) {
    this.transport = options.transport;
    this.store = options.store;
    this.persona = options.persona;

    this.unsubAction = this.transport.onAction<ChatMessage>('chat-message', (msg) => {
      this.store.addMessage(msg);
      for (const listener of this.messageListeners) {
        listener(msg);
      }
    });
  }

  setPersona(persona: Persona): void {
    this.persona = persona;
  }

  getMessages(): ChatMessage[] {
    return this.store.getMessages();
  }

  sendMessage(content: string, recipient?: { id: string; name?: string } | null): ChatMessage {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Message cannot be empty');
    }

    const isPrivate = Boolean(recipient?.id);
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: this.transport.localPeerId,
      senderName: this.persona.name,
      senderColor: this.persona.color,
      senderEmoji: this.persona.emoji,
      recipientId: recipient?.id ?? null,
      recipientName: recipient?.name,
      content: trimmed,
      timestamp: Date.now(),
      isPrivate,
    };

    this.store.addMessage(message);

    // Send action
    if (recipient?.id) {
      this.transport.sendAction('chat-message', message, recipient.id);
    } else {
      this.transport.sendAction('chat-message', message);
    }

    for (const listener of this.messageListeners) {
      listener(message);
    }

    return message;
  }

  onNewMessage(cb: (msg: ChatMessage) => void): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  destroy(): void {
    if (this.unsubAction) {
      this.unsubAction();
      this.unsubAction = null;
    }
    this.messageListeners.clear();
  }
}
