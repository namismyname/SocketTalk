
"use client";

import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
}

export function MessageBubble({ message, isCurrentUser }: MessageBubbleProps) {
  const alignmentClass = isCurrentUser ? 'ml-auto items-end' : 'mr-auto items-start';
  const bubbleColorClass = isCurrentUser
    ? 'bg-primary text-primary-foreground rounded-bl-2xl rounded-tr-2xl rounded-tl-2xl'
    : 'bg-card text-card-foreground border rounded-br-2xl rounded-tr-2xl rounded-tl-2xl';

  let formattedTimestamp = '';
  try {
    formattedTimestamp = format(new Date(message.timestamp), 'p'); // e.g., 12:00 PM
  } catch (error) {
    formattedTimestamp = 'Invalid time';
  }

  return (
    <div className={cn('flex mb-3 list-item-enter', isCurrentUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex flex-col max-w-xs md:max-w-md lg:max-w-lg', alignmentClass)}>
         {!isCurrentUser && (
           <div className="flex items-center mb-1">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarFallback className="text-xs bg-muted-foreground/20 text-foreground">
                  {message.senderUsername.substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs font-semibold text-accent">
                {message.senderUsername}
              </p>
           </div>
        )}
        <div className={cn('p-3 rounded-lg shadow-md', bubbleColorClass)}>
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.text}
          </p>
          <p className={cn('text-xs mt-1', isCurrentUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left')}>
            {formattedTimestamp}
          </p>
        </div>
      </div>
    </div>
  );
}
