
"use client";

import React, { useEffect, useRef } from 'react';
import type { Message, User } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { MessageCircle } from 'lucide-react';

interface MessageListAreaProps {
  messages: Message[];
  currentUserId: string | null;
  selectedPeer: User | null;
}

export function MessageListArea({ messages, currentUserId, selectedPeer }: MessageListAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, selectedPeer]); // Also scroll when selectedPeer changes, to show latest messages of new chat

  const filteredMessages = messages.filter(msg => {
    if (selectedPeer) { // DM view
      return (
        (msg.senderId === currentUserId && msg.recipientId === selectedPeer.id) ||
        (msg.senderId === selectedPeer.id && msg.recipientId === currentUserId)
      );
    }
    return !msg.recipientId; // Group chat view: only messages without a recipientId
  });

  return (
    <ScrollArea className="flex-grow bg-background/80 p-4" viewportRef={viewportRef}>
      {filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">
            {selectedPeer ? `Start your conversation with ${selectedPeer.username}.` : "No messages in group chat yet."}
          </p>
          <p className="text-sm">Send a message to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isCurrentUser={msg.senderId === currentUserId} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
