import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMessageStore,
  getPersistencePreference,
  setPersistencePreference,
  type ChatMessage,
} from './message-store';

describe('Message Store & Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to ephemeral mode and manages messages in memory', () => {
    const store = createMessageStore('room-1', false);
    expect(store.isPersisted).toBe(false);

    const msg: ChatMessage = {
      id: 'msg-1',
      senderId: 'peer-1',
      senderName: 'Bold Otter',
      senderColor: '#818cf8',
      senderEmoji: '⚡',
      recipientId: null,
      content: 'Hello World',
      timestamp: Date.now(),
      isPrivate: false,
    };

    store.addMessage(msg);
    expect(store.getMessages()).toHaveLength(1);
    expect(store.getMessages()[0].content).toBe('Hello World');

    store.clear();
    expect(store.getMessages()).toHaveLength(0);
  });

  it('manages local persistence preference in localStorage', () => {
    expect(getPersistencePreference()).toBe(false);

    setPersistencePreference(true);
    expect(getPersistencePreference()).toBe(true);

    setPersistencePreference(false);
    expect(getPersistencePreference()).toBe(false);
  });

  it('loads and saves messages from persistent store when persistence is enabled', () => {
    const store1 = createMessageStore('room-persist', true);
    const msg: ChatMessage = {
      id: 'msg-p1',
      senderId: 'peer-1',
      senderName: 'Cosmic Fox',
      senderColor: '#f472b6',
      senderEmoji: '🦊',
      recipientId: null,
      content: 'Persistent message',
      timestamp: Date.now(),
      isPrivate: false,
    };

    store1.addMessage(msg);
    expect(store1.getMessages()).toHaveLength(1);

    // Create a new store instance for the same room to verify restoration
    const store2 = createMessageStore('room-persist', true);
    expect(store2.getMessages()).toHaveLength(1);
    expect(store2.getMessages()[0].id).toBe('msg-p1');
    expect(store2.getMessages()[0].content).toBe('Persistent message');
  });
});
