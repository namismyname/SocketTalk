
"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import type { User } from '@/types';

interface MessageInputFormProps {
  onSendMessage: (messageText: string) => void;
  isSending: boolean;
  selectedPeer: User | null;
}

export function MessageInputForm({ onSendMessage, isSending, selectedPeer }: MessageInputFormProps) {
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !isSending) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const placeholderText = selectedPeer
    ? `Message @${selectedPeer.username}...`
    : "Type a message to the group...";

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2 p-3 sm:p-4 border-t bg-card">
      <Input
        type="text"
        placeholder={placeholderText}
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        className="flex-grow text-sm rounded-full px-4 py-2 focus-visible:ring-primary"
        aria-label="Message input"
        disabled={isSending}
      />
      <Button type="submit" size="icon" className="rounded-full bg-primary hover:bg-primary/90" aria-label="Send message" disabled={!messageText.trim() || isSending}>
        {isSending ? (
          <svg className="animate-spin h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <Send className="w-5 h-5" />
        )}
      </Button>
    </form>
  );
}
