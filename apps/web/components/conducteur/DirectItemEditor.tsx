'use client';

/**
 * Éditeur plein écran d'un « élément direct » du conducteur.
 * Édition du texte dans une iframe Google Doc intégrée (in-app) + chrono de
 * lecture qui se met à jour pendant la frappe → parité avec l'éditeur de sujet.
 */
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleDocEmbed } from '@/components/sujets/GoogleDocEmbed';
import { ItemReadingTimer } from './ItemReadingTimer';

interface DirectItemEditorProps {
  itemId: string;
  title: string;
  docId: string;
  docUrl?: string | null;
  initialDuration: number;
  onClose: () => void;
}

export function DirectItemEditor({
  itemId,
  title,
  docId,
  docUrl,
  initialDuration,
  onClose,
}: DirectItemEditorProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate text-[15px] font-semibold">{title || 'Élément direct'}</h2>
          <ItemReadingTimer itemId={itemId} initialDuration={initialDuration} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="mr-1 h-4 w-4" /> Fermer
        </Button>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <GoogleDocEmbed docId={docId} docUrl={docUrl ?? undefined} className="h-full" />
      </div>
    </div>
  );
}
