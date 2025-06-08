
"use client";

import React, { useState, useEffect } from 'react';
import { AuthForm } from '@/components/chat/UsernamePrompt'; // Updated import name
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useSocket } from '@/components/providers/SocketProvider';
import type { AuthJoinResponse, User } from '@/types';
import { useToast } from "@/hooks/use-toast";

const LOCALSTORAGE_AUTH_USER_KEY = 'socketTalk_authUser'; // Stores { username, currentUserId }

interface AuthenticatedUserState {
  username: string;
  currentUserId: string;
}

export default function HomePage() {
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUserState | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const storedAuthUser = localStorage.getItem(LOCALSTORAGE_AUTH_USER_KEY);
    if (storedAuthUser) {
      try {
        const parsedUser = JSON.parse(storedAuthUser) as AuthenticatedUserState;
        if (parsedUser && parsedUser.username && parsedUser.currentUserId) {
          // We still need to validate this session with the server IF the socket reconnects
          // or if this is a fresh load. For now, optimistically set.
          // ChatInterface will handle re-joining/validating if needed.
          setAuthenticatedUser(parsedUser);
           console.log("HomePage: Loaded authenticated user from localStorage:", parsedUser);
        }
      } catch (e) {
        console.error("HomePage: Failed to parse stored auth user, removing.", e);
        localStorage.removeItem(LOCALSTORAGE_AUTH_USER_KEY);
      }
    }
  }, []);

  const handleAuthSuccess = (response: AuthJoinResponse) => {
    if (response.success && response.username && response.currentUserId) {
      const authData: AuthenticatedUserState = {
        username: response.username,
        currentUserId: response.currentUserId,
      };
      localStorage.setItem(LOCALSTORAGE_AUTH_USER_KEY, JSON.stringify(authData));
      setAuthenticatedUser(authData);
      toast({ title: "Authentication Successful!", description: `Welcome, ${response.username}!` });
      console.log("HomePage: Auth success, user set:", authData);
    } else {
      // Error should be handled by AuthForm, this is a fallback.
      toast({ title: "Authentication Failed", description: response.error || "Could not authenticate.", variant: "destructive" });
      localStorage.removeItem(LOCALSTORAGE_AUTH_USER_KEY); // Clear any stale auth data
      setAuthenticatedUser(null);
    }
  };

  // Listen for forced disconnections or session invalidations from server
  useEffect(() => {
    if (socket && isConnected) {
      const handleSessionInvalidated = (data: { message: string }) => {
        console.warn("HomePage: Server invalidated session.", data.message);
        toast({
          title: "Session Expired",
          description: data.message || "Your session has been invalidated. Please log in again.",
          variant: "destructive",
          duration: 7000,
        });
        localStorage.removeItem(LOCALSTORAGE_AUTH_USER_KEY);
        setAuthenticatedUser(null); // This will re-render AuthForm
      };

      // Example: socket.on('session_invalidated', handleSessionInvalidated);
      // Implement this event on server if needed, e.g., on server restart and connectedUsers map is cleared.

      return () => {
        // socket.off('session_invalidated', handleSessionInvalidated);
      };
    }
  }, [socket, isConnected, toast]);


  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading SocketTalk...
      </div>
    );
  }

  if (!authenticatedUser || !authenticatedUser.username || !authenticatedUser.currentUserId) {
    // Pass socket and isConnected to AuthForm for it to handle emissions
    return <AuthForm onAuthSuccess={handleAuthSuccess} socket={socket} isConnected={isConnected} />;
  }

  // Pass username and currentUserId to ChatInterface.
  // ChatInterface will use currentUserId for its operations.
  // It might perform its own 'join_chat' or validation if socket had disconnected and reconnected.
  return (
    <ChatInterface 
      key={authenticatedUser.currentUserId} // Use currentUserId as key to re-mount on user change
      initialUsername={authenticatedUser.username} 
      initialCurrentUserId={authenticatedUser.currentUserId}
    />
  );
}
