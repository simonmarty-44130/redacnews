'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ReadingTimerProps {
  storyId: string;
  refreshInterval?: number; // en ms, defaut 7000 (7 secondes)
}

export function ReadingTimer({
  storyId,
  refreshInterval = 7000,
}: ReadingTimerProps) {
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: story } = trpc.story.get.useQuery({ id: storyId });

  const syncGoogleDoc = trpc.story.syncGoogleDoc.useMutation({
    onSuccess: (data) => {
      if (data.content) {
        const words = data.content.trim().split(/\s+/).filter(Boolean).length;
        setWordCount(words);
        setDuration(data.estimatedDuration || Math.round((words / 150) * 60));
      }
      setLastSync(new Date());
      setSyncError(false);
    },
    onError: () => {
      setSyncError(true);
    },
  });

  // Initial values from story
  useEffect(() => {
    if (story) {
      if (story.content) {
        const words = story.content.trim().split(/\s+/).filter(Boolean).length;
        setWordCount(words);
      }
      if (story.estimatedDuration) {
        setDuration(story.estimatedDuration);
      }
    }
  }, [story]);

  // Auto-sync every refreshInterval
  useEffect(() => {
    if (!story?.googleDocId) return;

    // Sync immediatement au montage
    syncGoogleDoc.mutate({ id: storyId });

    // Puis toutes les X secondes
    intervalRef.current = setInterval(() => {
      if (!syncGoogleDoc.isPending) {
        syncGoogleDoc.mutate({ id: storyId });
      }
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, story?.googleDocId, refreshInterval]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Si pas de Google Doc, afficher rien
  if (!story?.googleDocId) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-default',
              syncError
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-50 text-blue-700'
            )}
          >
            {syncGoogleDoc.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : syncError ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span className="tabular-nums">{formatDuration(duration)}</span>
            <span className="text-xs opacity-70">({wordCount} mots)</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p>Temps de lecture radio (~150 mots/min)</p>
            <p className="text-gray-400">Synchronisation auto toutes les 7s</p>
            {lastSync && (
              <p className="text-gray-400">
                Derniere sync: {lastSync.toLocaleTimeString()}
              </p>
            )}
            {syncError && (
              <p className="text-orange-500">Erreur de synchronisation</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
