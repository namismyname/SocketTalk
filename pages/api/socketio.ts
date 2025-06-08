
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer, Socket as ServerSocket } from 'socket.io';
import type { User } from '@/types'; 

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const connectedUsers = new Map<string, User>();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function SocketIOServiceHandler( // Renamed handler for clarity, though not strictly necessary
  _req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  console.log('SocketIOServiceHandler: API route /api/socketio_service hit.');
  if (res.socket.server.io) {
    console.log('SocketIOServiceHandler: Socket.IO server already running on path: /api/socketio_service');
  } else {
    console.log('SocketIOServiceHandler: Initializing Socket.IO server on path: /api/socketio_service...');
    const io = new IOServer(res.socket.server, {
      path: '/api/socketio_service', // This path is used by Socket.IO for its specific requests
      addTrailingSlash: false, // Important: client does not add trailing slash
      cors: {
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true 
      }
    });
    res.socket.server.io = io;
    console.log('SocketIOServiceHandler: IOServer instance created.');

    io.on('connection', (socket: ServerSocket) => {
      console.log(`SocketTalk: SERVER - User connected - ID: ${socket.id}, Transport: ${socket.conn.transport.name}`);

      socket.on('disconnect', (reason: string) => {
        console.log(`SocketTalk: SERVER - User ${socket.id} disconnected. Reason: ${reason}`);
        if (connectedUsers.has(socket.id)) {
          const user = connectedUsers.get(socket.id);
          connectedUsers.delete(socket.id);
          console.log(`SocketTalk: SERVER - User ${user?.username || socket.id} removed from map.`);
          // io.emit('user_list_update', Array.from(connectedUsers.values())); // Re-enable when user logic is complete
        }
      });

      socket.on('test_event', (data: any) => {
        console.log(`SocketTalk: SERVER - Received test_event from ${socket.id} with data:`, data);
        socket.emit('test_event_response', { message: 'Test event received by server' });
      });

      // Add actual chat event handlers here when ready
      // socket.on('join_chat', (username, callback) => { /* ... */ });
      // socket.on('send_message', (message) => { /* ... */ });

    });
    console.log('SocketIOServiceHandler: Socket.IO server initialized and event listeners attached.');
  }
  console.log('SocketIOServiceHandler: Ending API response.');
  res.end();
}
