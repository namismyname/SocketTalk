
export interface User {
  id: string; // This will typically be the socket.id
  username: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  recipientId?: string; // If present, this is a direct message to this user (socket.id)
  text: string;
  timestamp: string;
}

// For server -> client on successful login or if user was already "joined" by a previous action
// This is emitted by the server on 'login_success' or used by 'join_chat' callback
export interface AuthJoinResponse {
  success: boolean;
  users?: User[];          // List of currently connected users
  currentUserId?: string;  // The socket.id for this user's current session
  username?: string;       // The validated username
  error?: string;          // Error message if success is false
}

// For register_user event callback
export interface RegisterUserResponse {
  success: boolean;
  message: string; // e.g., "Registration successful" or error message
  username?: string; // The username that was processed
}

// For login_user event - server emits 'login_failed' with this payload on error
export interface LoginFailedResponse {
  message: string;
}

// Note: LoginUserResponse type is effectively replaced by AuthJoinResponse for success
// and LoginFailedResponse for failure, communicated via separate events.

