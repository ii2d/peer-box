import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTransport, resetInMemoryTransportRooms } from '../transport/in-memory-transport';
import { ChatService } from './chat-service';
import { createMessageStore } from './message-store';

describe('ChatService', () => {
  beforeEach(() => {
    resetInMemoryTransportRooms();
  });

  it('broadcasts message to all peers in the room', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    await transport1.joinRoom({ roomId: 'cute-dog' });
    await transport2.joinRoom({ roomId: 'cute-dog' });

    const store1 = createMessageStore('cute-dog');
    const store2 = createMessageStore('cute-dog');

    const chat1 = new ChatService({
      transport: transport1,
      store: store1,
      persona: { name: 'Alice Otter', emoji: '⚡', color: '#818cf8' },
    });

    const chat2 = new ChatService({
      transport: transport2,
      store: store2,
      persona: { name: 'Bob Panda', emoji: '🎨', color: '#34d399' },
    });

    const receivedBy2: string[] = [];
    chat2.onNewMessage((msg) => receivedBy2.push(msg.content));

    const sent = chat1.sendMessage('Hello everyone!');

    expect(sent.content).toBe('Hello everyone!');
    expect(sent.isPrivate).toBe(false);
    expect(store1.getMessages()).toHaveLength(1);

    expect(receivedBy2).toEqual(['Hello everyone!']);
    expect(store2.getMessages()).toHaveLength(1);
    expect(store2.getMessages()[0].senderName).toBe('Alice Otter');
  });

  it('sends direct private message exclusively to targeted peer', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');
    const transport3 = new InMemoryTransport('peer-3');

    await transport1.joinRoom({ roomId: 'cute-dog' });
    await transport2.joinRoom({ roomId: 'cute-dog' });
    await transport3.joinRoom({ roomId: 'cute-dog' });

    const chat1 = new ChatService({
      transport: transport1,
      store: createMessageStore('cute-dog'),
      persona: { name: 'Alice', emoji: '⚡', color: '#818cf8' },
    });

    const chat2 = new ChatService({
      transport: transport2,
      store: createMessageStore('cute-dog'),
      persona: { name: 'Bob', emoji: '🎨', color: '#34d399' },
    });

    const chat3 = new ChatService({
      transport: transport3,
      store: createMessageStore('cute-dog'),
      persona: { name: 'Charlie', emoji: '🚀', color: '#f472b6' },
    });

    const receivedBy2: string[] = [];
    const receivedBy3: string[] = [];
    chat2.onNewMessage((msg) => receivedBy2.push(msg.content));
    chat3.onNewMessage((msg) => receivedBy3.push(msg.content));

    const privateMsg = chat1.sendMessage('Secret for Bob only', {
      id: 'peer-2',
      name: 'Bob',
    });

    expect(privateMsg.isPrivate).toBe(true);
    expect(privateMsg.recipientId).toBe('peer-2');

    expect(receivedBy2).toEqual(['Secret for Bob only']);
    expect(receivedBy3).toEqual([]); // Charlie never sees it!
  });
});
