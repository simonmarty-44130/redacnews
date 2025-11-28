'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { useCollaboration, CollaborationUser } from './useCollaboration';

// Types matching Prisma schema
export interface RundownItemData {
  id: string;
  type: 'STORY' | 'INTERVIEW' | 'JINGLE' | 'MUSIC' | 'LIVE' | 'BREAK' | 'OTHER';
  title: string;
  duration: number;
  position: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE';
  notes?: string;
  storyId?: string;
  assigneeId?: string;
}

export interface RundownMetaData {
  status: 'DRAFT' | 'READY' | 'ON_AIR' | 'ARCHIVED';
  notes?: string;
}

interface UseYRundownOptions {
  rundownId: string;
  user: CollaborationUser;
  initialItems: RundownItemData[];
  initialMeta: RundownMetaData;
  onSyncToServer: (items: RundownItemData[], meta: RundownMetaData) => void;
}

export function useYRundown({
  rundownId,
  user,
  initialItems,
  initialMeta,
  onSyncToServer,
}: UseYRundownOptions) {
  const {
    ydoc,
    yItems,
    yMeta,
    isConnected,
    isSynced,
    connectedUsers,
    setCursor,
    getCursors,
  } = useCollaboration({
    documentId: rundownId,
    user,
  });

  const [items, setItems] = useState<RundownItemData[]>(initialItems);
  const [meta, setMeta] = useState<RundownMetaData>(initialMeta);
  const isInitializedRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced sync to server
  const scheduleSyncToServer = useCallback(
    (newItems: RundownItemData[], newMeta: RundownMetaData) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        onSyncToServer(newItems, newMeta);
      }, 1000); // Debounce 1 second
    },
    [onSyncToServer]
  );

  // Initialize Yjs document with server data
  useEffect(() => {
    if (isInitializedRef.current) return;

    ydoc.transact(() => {
      // Only initialize if the document is empty
      if (yItems.length === 0 && initialItems.length > 0) {
        initialItems.forEach((item) => {
          const yMap = new Y.Map<unknown>();
          Object.entries(item).forEach(([key, value]) => {
            yMap.set(key, value);
          });
          yItems.push([yMap]);
        });
      }

      // Initialize meta if empty
      if (yMeta.size === 0) {
        Object.entries(initialMeta).forEach(([key, value]) => {
          yMeta.set(key, value);
        });
      }
    });

    isInitializedRef.current = true;
  }, [ydoc, yItems, yMeta, initialItems, initialMeta]);

  // Listen to Yjs changes
  useEffect(() => {
    const updateItemsFromY = () => {
      const newItems: RundownItemData[] = [];
      yItems.forEach((yMap) => {
        if (yMap instanceof Y.Map) {
          const item: RundownItemData = {
            id: yMap.get('id') as string,
            type: yMap.get('type') as RundownItemData['type'],
            title: yMap.get('title') as string,
            duration: yMap.get('duration') as number,
            position: yMap.get('position') as number,
            status: yMap.get('status') as RundownItemData['status'],
            notes: yMap.get('notes') as string | undefined,
            storyId: yMap.get('storyId') as string | undefined,
            assigneeId: yMap.get('assigneeId') as string | undefined,
          };
          newItems.push(item);
        }
      });
      // Sort by position
      newItems.sort((a, b) => a.position - b.position);
      setItems(newItems);
      scheduleSyncToServer(newItems, meta);
    };

    const updateMetaFromY = () => {
      const newMeta: RundownMetaData = {
        status: (yMeta.get('status') as RundownMetaData['status']) || 'DRAFT',
        notes: yMeta.get('notes') as string | undefined,
      };
      setMeta(newMeta);
      scheduleSyncToServer(items, newMeta);
    };

    yItems.observe(updateItemsFromY);
    yMeta.observe(updateMetaFromY);

    // Initial update
    if (yItems.length > 0) {
      updateItemsFromY();
    }
    if (yMeta.size > 0) {
      updateMetaFromY();
    }

    return () => {
      yItems.unobserve(updateItemsFromY);
      yMeta.unobserve(updateMetaFromY);
    };
  }, [yItems, yMeta, items, meta, scheduleSyncToServer]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Collaborative operations
  const addItem = useCallback(
    (item: Omit<RundownItemData, 'position'>) => {
      ydoc.transact(() => {
        const yMap = new Y.Map<unknown>();
        const position = yItems.length;
        Object.entries({ ...item, position }).forEach(([key, value]) => {
          yMap.set(key, value);
        });
        yItems.push([yMap]);
      });
    },
    [ydoc, yItems]
  );

  const updateItem = useCallback(
    (itemId: string, updates: Partial<RundownItemData>) => {
      ydoc.transact(() => {
        for (let i = 0; i < yItems.length; i++) {
          const yMap = yItems.get(i);
          if (yMap instanceof Y.Map && yMap.get('id') === itemId) {
            Object.entries(updates).forEach(([key, value]) => {
              yMap.set(key, value);
            });
            break;
          }
        }
      });
    },
    [ydoc, yItems]
  );

  const deleteItem = useCallback(
    (itemId: string) => {
      ydoc.transact(() => {
        for (let i = 0; i < yItems.length; i++) {
          const yMap = yItems.get(i);
          if (yMap instanceof Y.Map && yMap.get('id') === itemId) {
            yItems.delete(i, 1);
            // Update positions of remaining items
            for (let j = i; j < yItems.length; j++) {
              const item = yItems.get(j);
              if (item instanceof Y.Map) {
                item.set('position', j);
              }
            }
            break;
          }
        }
      });
    },
    [ydoc, yItems]
  );

  const reorderItems = useCallback(
    (oldIndex: number, newIndex: number) => {
      ydoc.transact(() => {
        if (oldIndex === newIndex) return;

        // Get the item to move
        const itemToMove = yItems.get(oldIndex);
        if (!(itemToMove instanceof Y.Map)) return;

        // Clone the item data
        const itemData: Record<string, unknown> = {};
        itemToMove.forEach((value, key) => {
          itemData[key] = value;
        });

        // Remove from old position
        yItems.delete(oldIndex, 1);

        // Create new Y.Map with the data
        const newYMap = new Y.Map<unknown>();
        Object.entries(itemData).forEach(([key, value]) => {
          newYMap.set(key, value);
        });

        // Insert at new position
        yItems.insert(newIndex, [newYMap]);

        // Update all positions
        for (let i = 0; i < yItems.length; i++) {
          const item = yItems.get(i);
          if (item instanceof Y.Map) {
            item.set('position', i);
          }
        }
      });
    },
    [ydoc, yItems]
  );

  const updateMeta = useCallback(
    (updates: Partial<RundownMetaData>) => {
      ydoc.transact(() => {
        Object.entries(updates).forEach(([key, value]) => {
          yMeta.set(key, value);
        });
      });
    },
    [ydoc, yMeta]
  );

  return {
    items,
    meta,
    isConnected,
    isSynced,
    connectedUsers,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    updateMeta,
    setCursor,
    getCursors,
  };
}
