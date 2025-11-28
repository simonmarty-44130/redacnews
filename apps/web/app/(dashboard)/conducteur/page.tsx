'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LayoutDashboard, Inbox, Calendar, ChevronRight } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { RundownEditor, CreateRundownDialog } from '@/components/conducteur';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

export default function ConducteurPage() {
  const [selectedRundownId, setSelectedRundownId] = useState<string | null>(null);

  const { data: rundowns, isLoading } = trpc.rundown.list.useQuery({});

  const handleRundownCreated = (rundownId: string) => {
    setSelectedRundownId(rundownId);
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Conducteur</h1>
            {rundowns && (
              <span className="text-sm text-gray-500">
                ({rundowns.length} conducteur{rundowns.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <CreateRundownDialog onSuccess={handleRundownCreated} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Rundowns list */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </>
              ) : rundowns && rundowns.length > 0 ? (
                rundowns.map((rundown) => (
                  <Card
                    key={rundown.id}
                    className={cn(
                      'p-3 cursor-pointer transition-all hover:shadow-md',
                      selectedRundownId === rundown.id &&
                        'ring-2 ring-blue-500 bg-blue-50/50'
                    )}
                    onClick={() => setSelectedRundownId(rundown.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-12 rounded-full"
                        style={{ backgroundColor: rundown.show.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {rundown.show.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {format(new Date(rundown.date), 'd MMM yyyy', {
                              locale: fr,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            className={cn(
                              'text-xs',
                              statusColors[rundown.status]
                            )}
                          >
                            {statusLabels[rundown.status]}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {rundown.items.length} element
                            {rundown.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </Card>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Inbox className="h-12 w-12 mb-4 text-gray-300" />
                  <p className="font-medium">Aucun conducteur</p>
                  <p className="text-sm mt-1 text-center">
                    Creez votre premier conducteur pour commencer
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Rundown editor */}
        <div className="flex-1 bg-white overflow-hidden">
          {selectedRundownId ? (
            <RundownEditor rundownId={selectedRundownId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <LayoutDashboard className="h-16 w-16 mb-4 text-gray-300" />
              <p className="font-medium">Selectionnez un conducteur</p>
              <p className="text-sm mt-1">
                Cliquez sur un conducteur dans la liste pour le modifier
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
