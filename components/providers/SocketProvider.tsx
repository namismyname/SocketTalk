"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window !== 'undefined') {
      const sock = getSocket();
      setSocketInstance(sock);

      const onConnect = () => setIsConnected(true);
      const onDisconnect = () => setIsConnected(false);
      
      if (sock.connected) {
        setIsConnected(true);
      }

      sock.on('connect', onConnect);
      sock.on('disconnect', onDisconnect);

      return () => {
        sock.off('connect', onConnect);
        sock.off('disconnect', onDisconnect);
        // The socket instance itself is managed by getSocket/disconnectSocket globally.
        // Provider unmount doesn't necessarily mean the global socket should disconnect.
      };
    }
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketInstance, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
