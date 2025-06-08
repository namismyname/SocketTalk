
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Ensure this function is only called on the client side
export const getSocket = (): Socket => {
  if (typeof window === 'undefined') {
    // Return a mock or throw error if called server-side unexpectedly
    return {
      on: () => {},
      off: () => {},
      emit: () => {},
      connect: () => {},
      disconnect: () => {},
      connected: false,
      id: 'mock-socket-id',
    } as unknown as Socket;
  }

  if (!socket) {
    console.log('SocketTalk: Attempting to connect with ONLY polling transport...');
    socket = io({
      path: '/api/socketio_service', // Matches server-side path
      transports: ['polling'], // Force polling ONLY
    });

    socket.on('connect', () => {
      console.log(`SocketTalk: Connected to server - ID: ${socket?.id}, Transport: ${socket?.io.engine.transport.name}`);
    });

    socket.on('disconnect', (reason: Socket.DisconnectReason) => {
      console.log('SocketTalk: Disconnected from server - ', reason);
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server
        // socket?.connect(); // Example: uncomment if manual reconnection is needed
      }
      // else the socket will automatically try to reconnect if not a server-initiated disconnect
    });

    socket.on('connect_error', (error: Error) => {
      console.error('SocketTalk: Connection error - ', error);
      if (error.message && error.message.toLowerCase().includes('xhr poll error')) {
        console.error('SocketTalk: XHR Poll Error. Full error object:', error);
      }
    });

    // Listen for underlying Engine.IO events for more granular diagnostics
    if (socket.io) {
        socket.io.on('error', (engineError) => {
            console.error('SocketTalk: Engine.IO layer error -', engineError);
        });

        socket.io.on('reconnect_attempt', (attempt) => {
            console.log(`SocketTalk: Engine.IO reconnect_attempt, attempt number ${attempt}`);
        });

        socket.io.on('reconnect_failed', () => {
            console.error('SocketTalk: Engine.IO reconnect_failed after multiple attempts.');
        });

         socket.io.on('reconnect_error', (reconnectError) => {
            console.error('SocketTalk: Engine.IO reconnect_error -', reconnectError);
        });

        socket.io.on('reconnect', (attempt) => {
            console.log(`SocketTalk: Engine.IO reconnected successfully on attempt ${attempt}! Transport: ${socket?.io.engine.transport.name}`);
        });
    }
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
    console.log('SocketTalk: Manually disconnected.');
  }
  socket = null; // Allow re-initialization
};

