
"use client";

import type { User } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, MessageSquareText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface UserListPanelProps {
  users: User[];
  currentUserId: string | null;
  selectedPeer: User | null;
  onSelectPeer: (user: User | null) => void;
  currentUserUsername: string;
  onLogout: () => void;
}

interface UserListItemProps {
  user: User;
  // isCurrentUser: boolean; // Not needed if current user is not in the list to select
  isSelected: boolean;
  onSelect: () => void;
}

function UserListItem({ user, isSelected, onSelect }: UserListItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full flex items-center justify-start p-2 space-x-3 rounded-md transition-colors duration-150 h-auto",
        isSelected ? "bg-primary/20 text-primary hover:bg-primary/25" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
      title={`Chat with ${user.username}`}
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className={cn(
            "font-semibold",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-foreground"
          )}>
          {user.username.substring(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className={cn("font-medium text-sm truncate", isSelected ? "text-primary" : "text-foreground")}>
        {user.username}
      </span>
    </Button>
  );
}

export function UserListPanel({ users, currentUserId, selectedPeer, onSelectPeer, currentUserUsername, onLogout }: UserListPanelProps) {
  const otherUsers = users.filter(user => user.id !== currentUserId);
  const sortedOtherUsers = [...otherUsers].sort((a, b) => a.username.localeCompare(b.username));


  return (
    <Card className="h-full flex flex-col shadow-lg rounded-lg">
      <CardHeader className="py-4 px-4 border-b">
        <CardTitle className="text-xl font-headline flex items-center text-foreground">
          <Users className="w-6 h-6 mr-2 text-primary" />
          Online Users
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-grow">
        <CardContent className="p-2">
          {/* Static item for Group Chat */}
          <Button
            variant="ghost"
            className={cn(
              "w-full flex items-center justify-start p-2 space-x-3 rounded-md transition-colors duration-150 h-auto mb-1",
              !selectedPeer ? "bg-primary/20 text-primary hover:bg-primary/25" : "hover:bg-muted/50"
            )}
            onClick={() => onSelectPeer(null)}
            title="Switch to Group Chat"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className={cn(
                "font-semibold flex items-center justify-center",
                !selectedPeer ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-foreground"
              )}>
                <MessageSquareText className="w-5 h-5"/>
              </AvatarFallback>
            </Avatar>
            <span className={cn("font-medium text-sm", !selectedPeer ? "text-primary" : "text-foreground")}>
              Group Chat
            </span>
          </Button>

          {sortedOtherUsers.length > 0 ? (
            <ul className="space-y-1">
              {sortedOtherUsers.map((user) => (
                <li key={user.id}>
                  <UserListItem
                    user={user}
                    isSelected={selectedPeer?.id === user.id}
                    onSelect={() => onSelectPeer(user)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground p-4 text-center">No other users online.</p>
          )}
        </CardContent>
      </ScrollArea>
       <Separator />
      <CardFooter className="p-3 flex flex-col items-start space-y-2">
        <div className="flex items-center space-x-2 w-full">
            <Avatar className="h-9 w-9">
                <AvatarFallback className="font-semibold bg-secondary text-secondary-foreground">
                    {currentUserUsername.substring(0,1).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm text-foreground truncate">{currentUserUsername} (You)</span>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout} className="w-full text-destructive hover:bg-destructive/10 border-destructive/50 hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
        </Button>
      </CardFooter>
    </Card>
  );
}
