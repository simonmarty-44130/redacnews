'use client';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Radio, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc/client';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MediaUsagesProps {
  mediaItemId: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export function MediaUsages({ mediaItemId }: MediaUsagesProps) {
  const { data, isLoading } = trpc.storyMedia.listByMedia.useQuery({
    mediaItemId,
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Chargement...</div>;
  }

  const storyCount = data?.storyUsages?.length || 0;
  const rundownCount = data?.rundownUsages?.length || 0;
  const totalCount = storyCount + rundownCount;

  if (totalCount === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Ce media n'est utilise nulle part
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">
          {totalCount} utilisation{totalCount > 1 ? 's' : ''}
        </span>
      </div>

      <Tabs defaultValue="stories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stories" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Sujets ({storyCount})
          </TabsTrigger>
          <TabsTrigger value="rundowns" className="text-xs">
            <Radio className="h-3 w-3 mr-1" />
            Conducteurs ({rundownCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories">
          <ScrollArea className="h-[200px]">
            {data?.storyUsages?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun sujet
              </p>
            ) : (
              <div className="space-y-2">
                {data?.storyUsages?.map((usage) => (
                  <Link
                    key={usage.id}
                    href={`/sujets?id=${usage.story.id}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors group"
                  >
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-600">
                        {usage.story.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                          {usage.story.author.firstName}{' '}
                          {usage.story.author.lastName}
                        </span>
                        <Badge
                          className={cn(
                            'text-xs',
                            statusColors[usage.story.status]
                          )}
                        >
                          {usage.story.status}
                        </Badge>
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rundowns">
          <ScrollArea className="h-[200px]">
            {data?.rundownUsages?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun conducteur
              </p>
            ) : (
              <div className="space-y-2">
                {data?.rundownUsages?.map((usage) => (
                  <Link
                    key={usage.id}
                    href={`/conducteur?id=${usage.rundownItem.rundown.id}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors group"
                  >
                    <Radio className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-600">
                        {usage.rundownItem.rundown.show.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(
                          new Date(usage.rundownItem.rundown.date),
                          {
                            addSuffix: true,
                            locale: fr,
                          }
                        )}
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
