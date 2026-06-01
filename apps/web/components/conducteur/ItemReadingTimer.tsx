'use client';

/**
 * Chrono de lecture « live » pour un élément de conducteur (ex. élément direct).
 * Poll `syncItemFromGoogleDoc` toutes les X s pendant l'édition dans l'iframe →
 * met à jour la durée affichée au fil de la frappe (le serveur relit le Google Doc).
 * Même principe que le ReadingTimer des sujets (l'iframe étant cross-origin, on ne
 * peut pas compter côté client — on relit le doc côté serveur).
 */
import { useEffect, useRef, useState } from 'react';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ItemReadingTimerProps {
  itemId: string;
  initialDuration?: number;
  refreshInterval?: number; // ms, défaut 7000
}

export function ItemReadingTimer({
  itemId,
  initialDuration = 0,
  refreshInterval = 7000,
}: ItemReadingTimerProps) {
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [syncError, setSyncError] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const sync = trpc.rundown.syncItemFromGoogleDoc.useMutation({
    onSuccess: (data) => {
      setDuration(data.duration);
      setWordCount(data.wordCount);
      setSyncError(false);
    },
    onError: () => setSyncError(true),
  });

  useEffect(() => {
    sync.mutate({ itemId });
    intervalRef.current = setInterval(() => {
      if (!sync.isPending) sync.mutate({ itemId });
    }, refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, refreshInterval]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium cursor-default',
              syncError ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'
            )}
          >
            {sync.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : syncError ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span className="tabular-nums">{fmt(duration)}</span>
            <span className="text-xs opacity-70">({wordCount} mots)</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>Temps de lecture radio (~150 mots/min, tout le texte)</p>
            <p className="text-gray-400">Mise à jour auto toutes les 7s pendant la frappe</p>
            {syncError && <p className="text-orange-500">Erreur de synchronisation</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
