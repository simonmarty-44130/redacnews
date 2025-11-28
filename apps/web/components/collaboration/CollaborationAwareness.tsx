'use client';

import { useState, useEffect } from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CollaborationUser } from '@/lib/collaboration/useCollaboration';

interface CollaborationAwarenessProps {
  isConnected: boolean;
  isSynced: boolean;
  connectedUsers: CollaborationUser[];
  currentUser: CollaborationUser;
}

export function CollaborationAwareness({
  isConnected,
  isSynced,
  connectedUsers,
  currentUser,
}: CollaborationAwarenessProps) {
  const [showPulse, setShowPulse] = useState(false);

  // Show pulse animation when users join/leave
  useEffect(() => {
    setShowPulse(true);
    const timer = setTimeout(() => setShowPulse(false), 1000);
    return () => clearTimeout(timer);
  }, [connectedUsers.length]);

  const allUsers = [currentUser, ...connectedUsers];
  const displayUsers = allUsers.slice(0, 4);
  const remainingCount = allUsers.length - 4;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <div className="flex items-center gap-1.5 text-green-600">
                  <div className="relative">
                    <Wifi className="h-4 w-4" />
                    {isSynced && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">
                    Connecte
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-xs font-medium hidden sm:inline">
                    Hors ligne
                  </span>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isConnected
              ? isSynced
                ? 'Synchronise en temps reel'
                : 'Connexion en cours...'
              : 'Mode hors ligne - Les modifications seront synchronisees a la reconnexion'}
          </TooltipContent>
        </Tooltip>

        {/* User avatars */}
        <div className={cn('flex items-center -space-x-2', showPulse && 'animate-pulse')}>
          {displayUsers.map((user) => (
            <Tooltip key={user.id}>
              <TooltipTrigger>
                <Avatar
                  className={cn(
                    'h-7 w-7 border-2 border-white ring-2 transition-all',
                    user.id === currentUser.id ? 'ring-blue-500' : 'ring-transparent'
                  )}
                  style={{
                    borderColor: user.color,
                  }}
                >
                  <AvatarFallback
                    className="text-xs font-medium text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {user.id === currentUser.id && (
                    <Badge variant="secondary" className="text-xs">
                      Vous
                    </Badge>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <div className="h-7 w-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    +{remainingCount}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {allUsers.slice(4).map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: user.color }}
                      />
                      <span>{user.name}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* User count */}
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-gray-500">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">{allUsers.length}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {allUsers.length === 1
              ? 'Vous etes seul sur ce conducteur'
              : `${allUsers.length} personnes sur ce conducteur`}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Cursor indicator component for showing where other users are
export function UserCursor({
  user,
  children,
}: {
  user: CollaborationUser;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="absolute -left-1 top-0 bottom-0 w-0.5 rounded-full"
        style={{ backgroundColor: user.color }}
      />
      <div
        className="absolute -left-1 -top-5 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </div>
      {children}
    </div>
  );
}
