'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface AwarenessState {
  user: CollaborationUser;
  cursor?: { itemId: string; field?: string };
}

interface UseCollaborationOptions {
  documentId: string;
  user: CollaborationUser;
  wsUrl?: string;
}

const COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#34D399', // emerald
  '#22D3EE', // cyan
  '#60A5FA', // blue
  '#A78BFA', // violet
  '#F472B6', // pink
];

function getRandomColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function useCollaboration({ documentId, user, wsUrl }: UseCollaborationOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollaborationUser[]>([]);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const indexeddbRef = useRef<IndexeddbPersistence | null>(null);

  // Create Yjs document
  const ydoc = useMemo(() => {
    if (!ydocRef.current) {
      ydocRef.current = new Y.Doc();
    }
    return ydocRef.current;
  }, []);

  // Shared data structures
  const yItems = useMemo(() => ydoc.getArray<Y.Map<unknown>>('rundown-items'), [ydoc]);
  const yMeta = useMemo(() => ydoc.getMap<unknown>('rundown-meta'), [ydoc]);

  useEffect(() => {
    // WebSocket URL
    const socketUrl = wsUrl || process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:1234';

    // Create WebSocket provider
    const provider = new WebsocketProvider(
      socketUrl,
      `rundown-${documentId}`,
      ydoc,
      { connect: true }
    );
    providerRef.current = provider;

    // Create IndexedDB persistence for offline support
    const persistence = new IndexeddbPersistence(`rundown-${documentId}`, ydoc);
    indexeddbRef.current = persistence;

    // Set local awareness state
    const userWithColor: CollaborationUser = {
      ...user,
      color: user.color || getRandomColor(user.id),
    };

    provider.awareness.setLocalStateField('user', userWithColor);

    // Handle connection status
    const handleStatus = ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
    };
    provider.on('status', handleStatus);

    // Handle sync status
    const handleSync = (synced: boolean) => {
      setIsSynced(synced);
    };
    provider.on('sync', handleSync);

    // Handle awareness changes (connected users)
    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const users: CollaborationUser[] = [];

      states.forEach((state) => {
        if (state.user && state.user.id !== user.id) {
          users.push(state.user);
        }
      });

      setConnectedUsers(users);
    };
    provider.awareness.on('change', handleAwarenessChange);

    // Initial awareness update
    handleAwarenessChange();

    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.awareness.off('change', handleAwarenessChange);
      provider.destroy();
      persistence.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      indexeddbRef.current = null;
    };
  }, [documentId, user, wsUrl, ydoc]);

  // Set cursor position for awareness
  const setCursor = useCallback((itemId: string | null, field?: string) => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('cursor',
        itemId ? { itemId, field } : null
      );
    }
  }, []);

  // Get cursors of other users
  const getCursors = useCallback(() => {
    if (!providerRef.current) return [];

    const states = providerRef.current.awareness.getStates();
    const cursors: Array<{ user: CollaborationUser; cursor: { itemId: string; field?: string } }> = [];

    states.forEach((state) => {
      if (state.user && state.user.id !== user.id && state.cursor) {
        cursors.push({ user: state.user, cursor: state.cursor });
      }
    });

    return cursors;
  }, [user.id]);

  return {
    ydoc,
    yItems,
    yMeta,
    isConnected,
    isSynced,
    connectedUsers,
    setCursor,
    getCursors,
  };
}
