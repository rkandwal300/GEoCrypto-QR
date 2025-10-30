
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { EventEmitter } from 'events';

// In-memory mock socket for development and testing
const createMockSocket = () => {
  const emitter = new EventEmitter();
  let isConnected = false;

  const mockSocket = {
    connected: isConnected,
    on: (event, handler) => emitter.on(event, handler),
    off: (event, handler) => emitter.removeListener(event, handler),
    emit: (event, data) => {
      // Simulate server echoing back the message for 'sendMessage'
      if (event === 'sendMessage') {
        const messageWithId = {
          ...data,
          id: `msg-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
        };
        // Simulate a small network delay
        setTimeout(() => {
          emitter.emit('receiveMessage', messageWithId);
        }, 200);
      }
    },
    connect: () => {
      if (!isConnected) {
        isConnected = true;
        mockSocket.connected = true;
        // Simulate successful connection event
        setTimeout(() => emitter.emit('connect'), 50);
      }
    },
    disconnect: () => {
      if (isConnected) {
        isConnected = false;
        mockSocket.connected = false;
        // Simulate disconnection
        setTimeout(() => emitter.emit('disconnect'), 50);
      }
    },
  };

  return mockSocket;
};


/**
 * Custom hook to manage Socket.IO chat functionality.
 * @param {object} config - The hook configuration.
 * @param {string} config.userId - The ID of the current user.
 * @param {string} config.otherId - The ID of the other user in the chat.
 * @param {string} [config.roomId] - An optional, explicit room ID. If not provided, one is generated.
 * @returns {{messages: Array, sendMessage: Function, connected: boolean}}
 */
export function useChatSocket({ userId, otherId, roomId }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  // Determine the room ID. Sort user IDs to ensure consistency.
  const resolvedRoomId = roomId || [userId, otherId].sort().join('--');

  useEffect(() => {
    // Determine whether to use mock or real socket based on environment variable
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

    if (useMock) {
      console.log('Using mock chat socket.');
      socketRef.current = createMockSocket();
    } else {
      if (!socketUrl) {
        console.error('NEXT_PUBLIC_SOCKET_URL is not defined.');
        return;
      }
      console.log(`Connecting to real chat socket at ${socketUrl}`);
      // In a real app, pass authentication details here.
      // See README for examples.
      socketRef.current = io(socketUrl, {
        query: { roomId: resolvedRoomId },
        // auth: { token: 'your_jwt_token' }
      });
    }

    const socket = socketRef.current;

    // --- Event Listeners ---
    socket.on('connect', () => {
      setConnected(true);
      // Join a room for targeted messaging
      socket.emit('joinRoom', resolvedRoomId);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('receiveMessage', (message) => {
      // Update state with the new message from the server/mock
      setMessages((prevMessages) => {
        // Avoid duplicating optimistically added messages
        if (prevMessages.find((m) => m.id === message.id)) {
          return prevMessages.map((m) => (m.id === message.id ? message : m));
        }
        return [...prevMessages, message];
      });
    });

    // --- Initial Data Fetch ---
    // Fetch message history when the component mounts
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/messages/${resolvedRoomId}`
        );
        if (response.ok) {
          const history = await response.json();
          setMessages(history);
        }
      } catch (err) {
        console.error('Failed to fetch message history:', err);
      }
    };

    if (!useMock) {
      fetchHistory();
    }

    // --- Connect & Cleanup ---
    if (useMock) {
      socket.connect();
    }

    return () => {
      socket.disconnect();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receiveMessage');
    };
  }, [resolvedRoomId]); // Re-run effect if room changes

  /**
   * Sends a message to the server and optimistically updates the UI.
   * @param {object} messageData - The message object to send.
   */
  const sendMessage = (messageData) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.error('Socket not connected.');
      return;
    }

    const optimisticMessage = {
      ...messageData,
      id: `temp-${Date.now()}`, // Temporary ID for optimistic update
      timestamp: new Date().toISOString(),
      senderId: userId,
      status: 'sending', // Visual cue for optimistic state
    };

    // Optimistically add to UI
    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    // Emit to server
    socket.emit('sendMessage', {
      ...messageData,
      roomId: resolvedRoomId,
    });
  };

  return { messages, sendMessage, connected };
}
