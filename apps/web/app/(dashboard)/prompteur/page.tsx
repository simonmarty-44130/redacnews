'use client';

import { Presentation, ExternalLink, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-700',
  READY: 'bg-green-100 text-green-700',
  ON_AIR: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-blue-100 text-blue-700',
};

const statusLabels = {
  DRAFT: 'Brouillon',
  READY: 'Pret',
  ON_AIR: 'A l\'antenne',
  ARCHIVED: 'Archive',
};

export default function PrompteurPage() {
  const { data: rundowns, isLoading } = trpc.rundown.list.useQuery({});

  // Filter to show recent rundowns (last 7 days and upcoming)
  const recentRundowns = rundowns?.filter((r) => {
    const date = new Date(r.date);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= sevenDaysAgo;
  }).slice(0, 10);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Presentation className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Prompteur</h1>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <p className="text-gray-600">
          Le Prompteur affiche vos scripts en mode plein ecran pour la presentation a l'antenne.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Selectionnez un conducteur ci-dessous pour ouvrir le prompteur.
        </p>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Conducteurs recents
          </h2>
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Chargement...</div>
        ) : recentRundowns?.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Aucun conducteur recent
          </div>
        ) : (
          <ul className="divide-y">
            {recentRundowns?.map((rundown) => (
              <li
                key={rundown.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{rundown.show.name}</span>
                    <Badge className={statusColors[rundown.status]}>
                      {statusLabels[rundown.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {format(new Date(rundown.date), 'EEEE d MMMM yyyy', { locale: fr })}
                    {' - '}
                    {rundown.items.length} element{rundown.items.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/prompteur/${rundown.id}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-semibold mb-2">Raccourcis clavier du prompteur</h3>
        <ul className="grid grid-cols-2 gap-2">
          <li><kbd className="px-2 py-1 bg-white border rounded">ESPACE</kbd> Lecture / Pause</li>
          <li><kbd className="px-2 py-1 bg-white border rounded">+</kbd> / <kbd className="px-2 py-1 bg-white border rounded">-</kbd> Vitesse de defilement</li>
          <li><kbd className="px-2 py-1 bg-white border rounded">A</kbd> / <kbd className="px-2 py-1 bg-white border rounded">Z</kbd> Taille du texte</li>
          <li><kbd className="px-2 py-1 bg-white border rounded">Fleches</kbd> Navigation</li>
          <li><kbd className="px-2 py-1 bg-white border rounded">F</kbd> Plein ecran</li>
          <li><kbd className="px-2 py-1 bg-white border rounded">R</kbd> Reset chrono</li>
          <li><kbd className="px-2 py-1 bg-white border rounded">ESC</kbd> Quitter plein ecran</li>
        </ul>
      </div>
    </div>
  );
}
