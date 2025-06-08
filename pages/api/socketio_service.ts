
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer, Socket as ServerSocket } from 'socket.io';
import type { User, Message as ChatMessage, AuthJoinResponse, RegisterUserResponse, LoginFailedResponse } from '@/types';

console.log('SYNC LOG: src/pages/api/socketio_service.ts - File loaded by Next.js');

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const registeredUsers = new Map<string, { username: string; passwordPlainText: string }>();
const connectedUsers = new Map<string, User>();

if (!registeredUsers.has('admin')) {
  registeredUsers.set('admin', { username: 'Admin', passwordPlainText: 'Ensure12@' });
  console.log("SocketTalk: SERVER - Pre-seeded 'Admin' user.");
}

export const config = {
  api: {
    bodyParser: false,
  },
};

function joinUserToChat(socket: ServerSocket, username: string): AuthJoinResponse {
  const timestamp = new Date().toISOString();
  let currentUserIdValue = socket.id;

  console.log(`[${timestamp}] SocketTalk: SERVER - joinUserToChat: Attempting for username: '${username}', socket.id: '${socket.id}'`);

  if (!currentUserIdValue || typeof currentUserIdValue !== 'string' || currentUserIdValue.trim() === '') {
    const errorMsg = `CRITICAL: socket.id is invalid ('${currentUserIdValue}') for user '${username}' during join attempt.`;
    console.error(`[${timestamp}] SocketTalk: SERVER - ${errorMsg}`);
    currentUserIdValue = ""; 
    return { success: false, error: 'User session ID is invalid.', username, currentUserId: currentUserIdValue, users: [] };
  }
  console.log(`[${timestamp}] SocketTalk: SERVER - joinUserToChat: Determined currentUserIdValue: '${currentUserIdValue}' (Type: ${typeof currentUserIdValue})`);

  let userObject = connectedUsers.get(currentUserIdValue);
  let broadcastUserListUpdate = false;
  let newJoin = false;

  if (userObject) {
    if (userObject.username !== username) {
      console.log(`[${timestamp}] SocketTalk: SERVER - User ${currentUserIdValue} updating username from '${userObject.username}' to '${username}'.`);
      userObject.username = username;
      broadcastUserListUpdate = true;
    }
  } else {
    userObject = { id: currentUserIdValue, username: username };
    connectedUsers.set(currentUserIdValue, userObject);
    console.log(`[${timestamp}] SocketTalk: SERVER - User ${userObject.username} (ID: ${userObject.id}) added to connectedUsers map. Total connected: ${connectedUsers.size}`);
    newJoin = true;
    broadcastUserListUpdate = true;
  }

  if (newJoin && userObject) {
    socket.broadcast.emit('user_joined', userObject);
  }
  if (broadcastUserListUpdate) {
    socket.server.emit('user_list_update', Array.from(connectedUsers.values()));
  }

  const usersList = Array.from(connectedUsers.values());
  
  if (!Array.isArray(usersList)) {
      console.error(`[${timestamp}] SocketTalk: SERVER - CRITICAL_PAYLOAD_ERROR in joinUserToChat: usersList is not an array for ${username}. Users:`, usersList);
      return { success: false, error: 'Server error: Could not prepare user list.', username, currentUserId: currentUserIdValue, users: [] };
  }
  if (typeof currentUserIdValue !== 'string' || currentUserIdValue.trim() === '') {
      console.error(`[${timestamp}] SocketTalk: SERVER - CRITICAL_PAYLOAD_ERROR in joinUserToChat: currentUserIdValue is invalid for ${username}. ID: '${currentUserIdValue}'`);
      return { success: false, error: 'Server error: User session ID became invalid.', username, currentUserId: "", users: usersList };
  }

  const responsePayload: AuthJoinResponse = {
    success: true,
    users: usersList,
    currentUserId: currentUserIdValue,
    username: username,
  };

  const payloadUsers = responsePayload.users;
  const payloadUserId = responsePayload.currentUserId;

  if (!payloadUsers || !Array.isArray(payloadUsers) || typeof payloadUserId !== 'string' || payloadUserId.trim() === '') {
    console.error(`[${timestamp}] SocketTalk: SERVER - CRITICAL_PAYLOAD_ERROR before joinUserToChat callback: Invalid payload constructed. Users: ${JSON.stringify(payloadUsers)}, UserID: '${payloadUserId}' for ${username}`);
    return { success: false, error: 'Server error: Critical payload integrity failure.', username, currentUserId: payloadUserId || "", users: payloadUsers || [] };
  }
  console.log(`[${timestamp}] SocketTalk: SERVER - joinUserToChat for ${username} (ID: ${currentUserIdValue}) - success. Payload:`, JSON.stringify(responsePayload));
  return responsePayload;
}

export default function SocketIOServiceHandler(
  _req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  const handlerTimestamp = new Date().toISOString();
  console.log(`[${handlerTimestamp}] SocketIOServiceHandler: API route /api/socketio_service hit by a request.`);

  if (res.socket.server.io) {
    console.log(`[${handlerTimestamp}] SocketIOServiceHandler: Socket.IO server already running on path: /api/socketio_service`);
  } else {
    console.log(`[${handlerTimestamp}] SocketIOServiceHandler: Initializing Socket.IO server on path: /api/socketio_service...`);
    const io = new IOServer(res.socket.server, {
      path: '/api/socketio_service',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    res.socket.server.io = io;
    console.log(`[${handlerTimestamp}] SocketIOServiceHandler: IOServer instance created.`);

    io.on('connection', (socket: ServerSocket) => {
      const connectionTimestamp = new Date().toISOString();
      console.log(`[${connectionTimestamp}] SocketTalk: SERVER - User connected - ID: ${socket.id}, Transport: ${socket.conn.transport.name}`);

      socket.on('register_user', (data: { username?: string; password?: string }, callback: (payload: RegisterUserResponse) => void) => {
        const timestamp = new Date().toISOString();
        const socketIdForLog = socket.id; 
        console.log(`[${timestamp}] SocketTalk: SERVER - 'register_user' event received from socket ID: ${socketIdForLog}. Data:`, data ? {username: data.username, password: data.password ? '******' : undefined} : {});

        if (typeof callback !== 'function') {
            console.error(`[${timestamp}] SocketTalk: SERVER - CRITICAL: No callback function provided for 'register_user' from socket ID: ${socketIdForLog}. Registration attempt aborted.`);
            return; 
        }
        
        try {
          const { username, password } = data;
          if (!username || typeof username !== 'string' || username.trim() === '' ||
              !password || typeof password !== 'string' || password.trim() === '') {
            callback({ success: false, message: 'Username and password cannot be empty.' });
            return;
          }
          const trimmedUsername = username.trim();
          const lowerCaseUsername = trimmedUsername.toLowerCase();

          if (registeredUsers.has(lowerCaseUsername)) {
            callback({ success: false, message: `Username "${trimmedUsername}" is already taken.` });
            return;
          }
          
          registeredUsers.set(lowerCaseUsername, { username: trimmedUsername, passwordPlainText: password });
          console.log(`[${timestamp}] SocketTalk: SERVER - User '${trimmedUsername}' registered. Total registered: ${registeredUsers.size}`);
          callback({ success: true, message: 'Registration successful! You can now log in.', username: trimmedUsername });
        } catch (error) {
          console.error(`[${timestamp}] SocketTalk: SERVER - CRITICAL ERROR in 'register_user' handler for socket ${socketIdForLog}:`, error);
          callback({ success: false, message: 'An unexpected server error occurred during registration.' });
        }
      });

      socket.on('login_user', (data: { username?: string; password?: string }) => {
        const socketIdForLog = socket.id;
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] SocketTalk: SERVER - 'login_user' event received from socket ID: ${socketIdForLog}. Data:`, data ? {username: data.username, password: data.password ? '******' : undefined} : {});
      
        // IMMEDIATE ACKNOWLEDGEMENT FOR DEBUGGING
        try {
          socket.emit('login_attempt_acknowledged', { status: 'received', userId: socketIdForLog, timestamp: new Date().toISOString() });
          console.log(`[${timestamp}] SocketTalk: SERVER - Successfully emitted 'login_attempt_acknowledged' to socket ID: ${socketIdForLog}`);
        } catch (ackError) {
          console.error(`[${timestamp}] SocketTalk: SERVER - FAILED to emit 'login_attempt_acknowledged' to socket ID: ${socketIdForLog}. Error:`, ackError);
        }

        try {
          const { username, password } = data;
          if (!username || typeof username !== 'string' || username.trim() === '' ||
              !password || typeof password !== 'string' || password.trim() === '') {
            console.warn(`[${timestamp}] SocketTalk: SERVER - Invalid login data for socket ID: ${socketIdForLog}. Missing username/password.`);
            socket.emit('login_failed', { message: 'Username and password are required.' } as LoginFailedResponse);
            return;
          }
          const trimmedUsername = username.trim();
          const lowerCaseUsername = trimmedUsername.toLowerCase();
          console.log(`[${timestamp}] SocketTalk: SERVER - Attempting to find user '${lowerCaseUsername}' for socket ID: ${socketIdForLog}.`);
          const storedUser = registeredUsers.get(lowerCaseUsername);
      
          if (!storedUser) {
            console.warn(`[${timestamp}] SocketTalk: SERVER - Login attempt for non-existent user: '${trimmedUsername}' from socket ID: ${socketIdForLog}.`);
            socket.emit('login_failed', { message: 'User not found. Please register or check your username.' } as LoginFailedResponse);
            return;
          }
          
          console.log(`[${timestamp}] SocketTalk: SERVER - User '${trimmedUsername}' found. Checking password for socket ID: ${socketIdForLog}.`);
          if (storedUser.passwordPlainText !== password) { 
            console.warn(`[${timestamp}] SocketTalk: SERVER - Invalid password for user: '${trimmedUsername}' from socket ID: ${socketIdForLog}.`);
            socket.emit('login_failed', { message: 'Invalid password.' } as LoginFailedResponse);
            return;
          }
      
          console.log(`[${timestamp}] SocketTalk: SERVER - User '${storedUser.username}' (socket: ${socketIdForLog}) credentials validated. Proceeding to join chat.`);
          const joinResult = joinUserToChat(socket, storedUser.username);
          
          if (joinResult.success) {
            console.log(`[${timestamp}] SocketTalk: SERVER - login_user for '${storedUser.username}' successful. Emitting 'login_success' to socket ID: ${socketIdForLog}. Payload:`, JSON.stringify(joinResult));
            socket.emit('login_success', joinResult);
          } else {
            console.error(`[${timestamp}] SocketTalk: SERVER - login_user for '${storedUser.username}' failed at joinUserToChat. Emitting 'login_failed' to socket ID: ${socketIdForLog}. Error: ${joinResult.error}`);
            socket.emit('login_failed', { message: joinResult.error || 'Failed to join chat after login.' } as LoginFailedResponse);
          }
      
        } catch (error) {
          console.error(`[${timestamp}] SocketTalk: SERVER - CRITICAL ERROR in 'login_user' handler for socket ${socketIdForLog} (after ack):`, error);
          socket.emit('login_failed', { message: 'An unexpected server error occurred during login. Please try again later.' } as LoginFailedResponse);
        }
      });
      
      socket.on('join_chat', (username: string, callback: (payload: AuthJoinResponse) => void) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] SocketTalk: SERVER - Legacy 'join_chat' event for username: '${username}', socket.id: '${socket.id}'. This is now primarily for re-joining/session validation.`);
        
        if (typeof callback !== 'function') {
          console.error(`[${timestamp}] SocketTalk: SERVER - 'join_chat' for '${username}', but no callback provided.`);
          return;
        }

        if (!username || typeof username !== 'string' || username.trim() === '') {
          callback({ success: false, error: 'Username cannot be empty.', username });
          return;
        }
        const trimmedUsername = username.trim();
        
        const currentSocketUser = connectedUsers.get(socket.id);
        if (!currentSocketUser || currentSocketUser.username.toLowerCase() !== trimmedUsername.toLowerCase()) {
            console.warn(`[${timestamp}] SocketTalk: SERVER - 'join_chat' for user '${trimmedUsername}' (socket ${socket.id}) - Mismatch or not found in connectedUsers. Attempting re-join.`);
        }

        const joinResult = joinUserToChat(socket, trimmedUsername);
        console.log(`[${timestamp}] SocketTalk: SERVER - Invoking legacy join_chat callback with payload:`, JSON.stringify(joinResult));
        callback(joinResult);
      });

      socket.on('send_message', (data: { text: string; recipientId?: string; timestamp: string }) => {
        try {
          const sender = connectedUsers.get(socket.id);
          if (sender) {
            const fullMessage: ChatMessage = {
              id: new Date().toISOString() + Math.random().toString(36).substring(2, 9),
              text: data.text,
              senderId: socket.id,
              senderUsername: sender.username,
              recipientId: data.recipientId,
              timestamp: data.timestamp,
            };

            console.log(`[${new Date().toISOString()}] SocketTalk: SERVER - Message from ${fullMessage.senderUsername} (ID: ${socket.id})${data.recipientId ? ` to user ${data.recipientId}` : ' (group)'}: ${fullMessage.text}`);

            if (data.recipientId) { 
              io.to(data.recipientId).to(socket.id).emit('new_message', fullMessage);
            } else { 
              io.emit('new_message', fullMessage);
            }
          } else {
            console.warn(`[${new Date().toISOString()}] SocketTalk: SERVER - Message received from unauthenticated/unknown sender ID: ${socket.id}. Msg: ${data.text}`);
          }
        } catch (error) {
           console.error(`[${new Date().toISOString()}] SocketTalk: SERVER - Error in 'send_message' handler for socket ${socket.id}:`, error);
        }
      });

      socket.on('disconnect', (reason: string) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] SocketTalk: SERVER - User ${socket.id} disconnected. Reason: ${reason}`);
        const user = connectedUsers.get(socket.id);
        if (user) {
          connectedUsers.delete(socket.id);
          console.log(`[${timestamp}] SocketTalk: SERVER - User ${user.username} (ID: ${socket.id}) removed from connectedUsers map. Total connected: ${connectedUsers.size}`);
          io.emit('user_left', user); 
          io.emit('user_list_update', Array.from(connectedUsers.values()));
        } else {
          console.log(`[${timestamp}] SocketTalk: SERVER - Disconnect event for user ID: ${socket.id}, who was not in connectedUsers map.`);
        }
      });
    });
    console.log(`[${handlerTimestamp}] SocketIOServiceHandler: Socket.IO server initialized and event listeners attached.`);
  }
  console.log(`[${handlerTimestamp}] SocketIOServiceHandler: Ending API response.`);
  res.end();
}

    