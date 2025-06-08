
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/components/providers/SocketProvider';
import type { User, Message, AuthJoinResponse } from '@/types';
import { UserListPanel } from './UserListPanel';
import { MessageListArea } from './MessageListArea';
import { MessageInputForm } from './MessageInputForm';
import { useToast } from "@/hooks/use-toast";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, LogOut } from 'lucide-react';

interface ChatInterfaceProps {
  initialUsername: string;
  initialCurrentUserId: string;
}

const LOCALSTORAGE_MESSAGES_KEY_PREFIX = 'socketTalk_messages_'; // Per-user messages
const LOCALSTORAGE_AUTH_USER_KEY = 'socketTalk_authUser';


export function ChatInterface({ initialUsername, initialCurrentUserId }: ChatInterfaceProps) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // These are now effectively read-only after initial prop setting from HomePage based on successful auth
  const [currentUsername, setCurrentUsername] = useState<string>(initialUsername);
  const [currentUserId, setCurrentUserId] = useState<string>(initialCurrentUserId);

  const [selectedPeer, setSelectedPeer] = useState<User | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [unreadCount, setUnreadCount] = useState(0);
  const initialJoinAttemptedRef = useRef(false); // To manage re-joining logic if socket reconnects

  const getMessagesLocalStorageKey = useCallback(() => {
    return `${LOCALSTORAGE_MESSAGES_KEY_PREFIX}${currentUserId || 'guest'}`;
  }, [currentUserId]);

  // Load messages from localStorage on initial mount (scoped to currentUserId)
  useEffect(() => {
    if (!currentUserId) return; // Ensure currentUserId is available
    const storedMessages = localStorage.getItem(getMessagesLocalStorageKey());
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch (e) {
        console.error("ChatInterface: Failed to parse stored messages:", e);
        localStorage.removeItem(getMessagesLocalStorageKey());
      }
    }
  }, [currentUserId, getMessagesLocalStorageKey]);

  // Save messages to localStorage whenever they change (scoped to currentUserId)
  useEffect(() => {
    if (!currentUserId) return;
    // Avoid writing empty array if it was never populated or to clear it if messages become empty
    if (messages.length > 0 || localStorage.getItem(getMessagesLocalStorageKey())) {
        localStorage.setItem(getMessagesLocalStorageKey(), JSON.stringify(messages));
    }
  }, [messages, currentUserId, getMessagesLocalStorageKey]);

  // Effect for Notification Permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission); // Set initial state

      if (Notification.permission === 'default') {
        toast({
          title: "Enable Notifications?",
          description: "Get notified of new messages even when the tab is in the background.",
          duration: 10000,
          action: (
            <Button onClick={() => {
              Notification.requestPermission().then(permission => {
                setNotificationPermission(permission);
                if (permission === 'granted') {
                  toast({ title: "Notifications Enabled!", description: "You'll now receive chat notifications." });
                } else if (permission === 'denied') {
                  toast({ 
                    title: "Notifications Not Allowed", 
                    description: "You chose not to allow notifications. You can change this in your browser settings.", 
                    variant: "default",
                    duration: 7000,
                  });
                }
              });
            }}>Enable</Button>
          )
        });
      } else if (Notification.permission === 'denied') {
         toast({ 
          title: "Notifications Blocked", 
          description: "You've previously blocked notifications. To enable them, check your browser's site settings.",
          variant: "default",
          duration: 7000,
        });
      }
    }
  }, [toast]);

  // Effect for Document Title and Visibility
  useEffect(() => {
    const originalTitle = `SocketTalk - ${currentUsername}`;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setUnreadCount(0); 
        document.title = originalTitle;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (document.hidden && unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.title = 'SocketTalk'; 
    };
  }, [unreadCount, currentUsername]);

  // Effect to join chat if currentUserId is set (from props) AND socket is connected.
  // This handles initial join and re-joining if the socket reconnects.
  useEffect(() => {
    // Only attempt to join if we have essential info and socket is ready
    if (socket && isConnected && currentUsername && currentUserId && !initialJoinAttemptedRef.current) {
      console.log(`ChatInterface: Attempting 'join_chat' for user: ${currentUsername} (ID: ${currentUserId}). Socket connected: ${isConnected}`);
      initialJoinAttemptedRef.current = true; 
      
      // Use the legacy 'join_chat' for now, or a new 'rejoin_chat' if server supports it.
      // For this iteration, 'join_chat' will re-add to connectedUsers if not present or update info.
      socket.emit('join_chat', currentUsername, (response: AuthJoinResponse) => {
        console.log(`ChatInterface: 'join_chat' (or re-join) callback received. Full response:`, response);

        if (response.success && response.users && response.currentUserId && response.username) {
          setUsers(response.users); 
          // currentUserId and currentUsername are already set from props, but good to verify.
          if (response.currentUserId !== currentUserId) {
             console.warn("ChatInterface: Server assigned a different currentUserId on rejoin. This might indicate a session issue.", response.currentUserId);
             // Potentially handle this by forcing re-auth or updating local state. For now, log.
          }
           if (response.username !== currentUsername) {
             console.warn("ChatInterface: Server assigned a different username on rejoin.", response.username);
             setCurrentUsername(response.username); // Update if server sanitized/changed it
             // Also update localStorage if HomePage was relying on this
             const authData = localStorage.getItem(LOCALSTORAGE_AUTH_USER_KEY);
             if (authData) {
                try {
                    const parsed = JSON.parse(authData);
                    parsed.username = response.username;
                    localStorage.setItem(LOCALSTORAGE_AUTH_USER_KEY, JSON.stringify(parsed));
                } catch (e) { console.error("Error updating username in localStorage", e);}
             }

          }
          console.log(`ChatInterface: Successfully (re)joined with ID: '${response.currentUserId}'. Users set.`);
        } else {
          console.error(`ChatInterface: Failed to (re)join chat. Error: ${response.error}. Response:`, response);
          toast({
            title: "Chat Re-join Error",
            description: response.error || "Could not re-establish chat session.",
            variant: "destructive",
            duration: 10000
          });
          // Consider logging out user here by clearing localStorage and calling a logout function from HomePage
        }
      });
    }
    // Reset join attempt flag if socket disconnects, so it tries again on reconnect
    if (!isConnected) {
        initialJoinAttemptedRef.current = false;
    }

  }, [socket, isConnected, currentUsername, currentUserId, toast]); 

  // Effect for handling ongoing socket events once joined (currentUserId is set)
  useEffect(() => {
    if (socket && isConnected && currentUserId) {
      console.log(`ChatInterface: Event Listener Effect - Attaching socket event listeners for currentUserId: ${currentUserId}`);

      const handleNewMessage = (message: Message) => {
        console.log('ChatInterface: Received new_message:', message);
        setMessages((prevMessages) => {
            if (prevMessages.find(m => m.id === message.id)) {
                return prevMessages;
            }
            return [...prevMessages, message].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });

        if (message.senderId !== currentUserId) { 
          if (document.hidden) {
            setUnreadCount(prev => prev + 1); 

            if (notificationPermission === 'granted') {
              const senderUser = users.find(u => u.id === message.senderId);
              const senderName = senderUser ? senderUser.username : message.senderUsername; 

              let notificationTitle = `New message from ${senderName}`;
              if (message.recipientId) { 
                  notificationTitle = `DM from ${senderName}`;
              } else { 
                  notificationTitle = `Group: ${senderName}`;
              }
              
              let notificationBody = message.text;
              if (notificationBody.length > 70) { 
                notificationBody = notificationBody.substring(0, 67) + "...";
              }

              const notification = new Notification(notificationTitle, {
                body: notificationBody,
                tag: message.id, 
                // icon: '/favicon.ico', // Optional: add an icon
              });

              notification.onclick = () => {
                window.focus();
                if (message.recipientId && senderUser && selectedPeer?.id !== senderUser.id) {
                  setSelectedPeer(senderUser);
                } else if (!message.recipientId && selectedPeer !== null) {
                  setSelectedPeer(null);
                }
                setUnreadCount(0);
                notification.close();
              };
            }
          }
        }
      };

      const handleUserListUpdate = (updatedUsers: User[]) => {
        console.log('ChatInterface: Received user_list_update:', updatedUsers.map(u=>u.username).join(', '));
        setUsers(updatedUsers);
        if (selectedPeer && !updatedUsers.find(u => u.id === selectedPeer.id)) {
          setSelectedPeer(null);
          toast({
            title: "Chat Closed",
            description: `${selectedPeer.username} has left. Returning to group view.`,
          });
        }
      };

      const handleUserJoined = (user: User) => {
        console.log('ChatInterface: Received user_joined:', user);
        if (user.id !== currentUserId) { // Don't toast self
          toast({
            title: "User Joined",
            description: `${user.username} has joined the chat.`,
          });
        }
         // Server now sends full user_list_update for joins/leaves.
        // Individual handling might not be needed if list update is comprehensive.
        // setUsers(prevUsers => {
        //   if (!prevUsers.find(u => u.id === user.id)) {
        //     return [...prevUsers, user];
        //   }
        //   return prevUsers.map(u => u.id === user.id ? user : u); 
        // });
      };

      const handleUserLeft = (user: User) => {
        console.log('ChatInterface: Received user_left:', user);
         if (user.id !== currentUserId) {
            toast({
                title: "User Left",
                description: `${user.username} has left the chat.`,
            });
        }
        // Server now sends full user_list_update.
        // setUsers(prevUsers => prevUsers.filter(u => u.id !== user.id));
        //  if (selectedPeer?.id === user.id) {
        //     setSelectedPeer(null);
        // }
      };

      socket.on('new_message', handleNewMessage);
      socket.on('user_list_update', handleUserListUpdate);
      // 'user_joined' and 'user_left' might be redundant if 'user_list_update' covers these events comprehensively.
      // If 'user_list_update' is sent on every join/leave, individual handlers can be removed.
      // For now, keeping them but server logic might be refactored later.
      socket.on('user_joined', handleUserJoined); 
      socket.on('user_left', handleUserLeft);

      return () => {
        console.log(`ChatInterface: Event Listener Effect - Cleaning up socket event listeners for currentUserId: ${currentUserId}`);
        socket.off('new_message', handleNewMessage);
        socket.off('user_list_update', handleUserListUpdate);
        socket.off('user_joined', handleUserJoined);
        socket.off('user_left', handleUserLeft);
      };
    }
  }, [socket, isConnected, currentUserId, toast, selectedPeer, notificationPermission, users, getMessagesLocalStorageKey]);


  const handleSendMessage = useCallback(async (messageText: string) => {
    if (socket && isConnected && currentUserId && currentUsername && messageText.trim() !== '' && !isSending) {
      setIsSending(true);
      try {
        const messagePayload = {
          text: messageText,
          recipientId: selectedPeer ? selectedPeer.id : undefined,
          timestamp: new Date().toISOString(),
        };
        console.log('ChatInterface: Emitting send_message:', messagePayload);
        socket.emit('send_message', messagePayload);
      } catch (error) {
        console.error("ChatInterface: Error sending message:", error);
        toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
      } finally {
        setIsSending(false);
      }
    }
  }, [socket, isConnected, currentUserId, currentUsername, selectedPeer, toast, isSending]);

  const handleSelectPeer = (peer: User | null) => {
    setSelectedPeer(peer);
    setUnreadCount(0); 
    document.title = `SocketTalk - ${currentUsername}`; 
    if (peer) {
      toast({
        title: "Direct Chat",
        description: `Opened direct chat with ${peer.username}.`,
      });
    } else {
      toast({
        title: "Group Chat",
        description: "Switched to group chat view.",
      });
    }
  };

  const handleLogout = () => {
    console.log("ChatInterface: User logging out.");
    toast({title: "Logged Out", description: "You have been logged out."});
    localStorage.removeItem(LOCALSTORAGE_AUTH_USER_KEY);
    // This should trigger HomePage to re-render and show AuthForm
    // A more robust way would be to call a logout function passed from HomePage
    // For now, simple reload or rely on HomePage's useEffect to clear authenticatedUser
    window.location.reload(); // Simplest way to force re-evaluation by HomePage
  };

  if (!isConnected && typeof window !== 'undefined') {
     return (
        <div className="flex items-center justify-center h-screen text-muted-foreground">
          Connecting to SocketTalk... If this persists, the server might be unavailable.
        </div>
      );
  }

  // currentUserId and currentUsername are guaranteed by HomePage logic before rendering ChatInterface
  // So, no need for a "Verifying session..." screen here if props are correctly passed.

  return (
    <div className="flex h-screen max-h-screen bg-background p-3 sm:p-4 md:p-6 gap-3 sm:gap-4 md:gap-6 font-body">
      <div className="w-1/3 max-w-sm hidden md:flex flex-col">
        <UserListPanel
          users={users}
          currentUserId={currentUserId} 
          selectedPeer={selectedPeer}
          onSelectPeer={handleSelectPeer}
          currentUserUsername={currentUsername}
          onLogout={handleLogout}
        />
      </div>
      <Card className="flex-1 flex flex-col overflow-hidden shadow-xl rounded-lg">
        <div className="p-3 border-b bg-card flex items-center justify-between">
          {selectedPeer ? (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-primary" />
                Chat with {selectedPeer.username}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => handleSelectPeer(null)} title="Back to group chat">
                <X className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <h2 className="text-lg font-semibold text-foreground flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-primary" />
              Group Chat
            </h2>
          )}
           <div className="md:hidden"> {/* Logout button for mobile, shown in header */}
             <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="w-5 h-5 text-destructive" />
            </Button>
           </div>
        </div>
        <MessageListArea
          messages={messages}
          currentUserId={currentUserId} 
          selectedPeer={selectedPeer}
        />
        <MessageInputForm
          onSendMessage={handleSendMessage}
          isSending={isSending}
          selectedPeer={selectedPeer}
        />
      </Card>
    </div>
  );
}
