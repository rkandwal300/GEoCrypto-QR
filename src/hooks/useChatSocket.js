
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
          ...data.message, // The message is nested in the data object
          id: data.optimisticId, // IMPORTANT: Reuse the optimistic ID
          timestamp: new Date().toISOString(),
          status: 'sent', // Update status from 'sending'
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
  const resolvedRoomId = roomId || [userId, otherId].sort().join('--');

  // Initialize state with an empty array to prevent hydration mismatch.
  const [messages, setMessages] = useState([]);

  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  // Effect to load from and save to sessionStorage on the client side only.
  useEffect(() => {
    // Load initial messages from sessionStorage
    try {
      const storedMessages = sessionStorage.getItem(`chat_${resolvedRoomId}`);
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      } else {
        setMessages([]); // Ensure messages are cleared when switching to a room with no history
      }
    } catch (error) {
      console.error("Failed to parse messages from sessionStorage", error);
      setMessages([]);
    }
  }, [resolvedRoomId]);

  // Effect to save messages whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(`chat_${resolvedRoomId}`, JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save messages to sessionStorage", error);
    }
  }, [messages, resolvedRoomId]);


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

    // --- Event Handlers ---
    const onConnect = () => {
      setConnected(true);
      socket.emit('joinRoom', resolvedRoomId);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onReceiveMessage = (message) => {
      setMessages((prevMessages) => {
        const existingIndex = prevMessages.findIndex((m) => m.id === message.id);
        if (existingIndex !== -1) {
          const updatedMessages = [...prevMessages];
          updatedMessages[existingIndex] = message;
          return updatedMessages;
        }
        return [...prevMessages, message];
      });
    };

    // --- Event Listeners ---
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receiveMessage', onReceiveMessage);

    // --- Initial Data Fetch ---
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
    } else {
      // In mock mode, if session storage is empty, populate with some data.
      if (messages.length === 0) {
        const mockHistory = [
          { id: 'mock-1', name: "user-1", text: 'Hello! This is a mock chat history.', senderId: otherId, timestamp: new Date(Date.now() - 60000 * 5).toISOString(), type: 'text' },
          { id: 'mock-2', name: "user-1", text: 'You can switch to a real backend via environment variables.', senderId: otherId, timestamp: new Date(Date.now() - 60000 * 4).toISOString(), type: 'text' },
        ];
        setMessages(mockHistory);
      }
    }

    // --- Connect & Cleanup ---
    if (useMock) {
      socket.connect();
    }

    return () => {
      if (socket) {
        socket.disconnect();
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('receiveMessage', onReceiveMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage = {
      ...messageData,
      id: optimisticId, // Temporary ID for optimistic update
      timestamp: new Date().toISOString(),
      senderId: userId,
      status: 'sending', // Visual cue for optimistic state
    };

    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    socket.emit('sendMessage', {
      message: messageData,
      roomId: resolvedRoomId,
      optimisticId: optimisticId, // Send the temp ID to the mock server
    });
  };

  return { messages, sendMessage, connected };
}
