'use client';

import { useState, useMemo } from 'react';
import { FileText, Inbox } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { StoryCard, StoryEditor, StoryFilters, CreateStoryDialog } from '@/components/sujets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface Filters {
  search: string;
  status: string;
  category: string;
}

export default function SujetsPage() {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    category: 'all',
  });

  const { data: stories, isLoading } = trpc.story.list.useQuery({
    status: filters.status !== 'all' ? filters.status as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' : undefined,
    category: filters.category !== 'all' ? filters.category : undefined,
    search: filters.search || undefined,
  });

  const handleStoryCreated = (storyId: string) => {
    setSelectedStoryId(storyId);
  };

  const handleStoryDeleted = () => {
    setSelectedStoryId(null);
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Sujets</h1>
            {stories && (
              <span className="text-sm text-gray-500">
                ({stories.length} sujet{stories.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <CreateStoryDialog onSuccess={handleStoryCreated} />
        </div>
        <StoryFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stories list */}
        <div className="w-96 border-r bg-gray-50 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isLoading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </>
              ) : stories && stories.length > 0 ? (
                stories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    isSelected={story.id === selectedStoryId}
                    onClick={() => setSelectedStoryId(story.id)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Inbox className="h-12 w-12 mb-4 text-gray-300" />
                  <p className="font-medium">Aucun sujet</p>
                  <p className="text-sm mt-1">
                    {filters.search || filters.status !== 'all' || filters.category !== 'all'
                      ? 'Aucun sujet ne correspond aux filtres'
                      : 'Creez votre premier sujet pour commencer'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Story editor */}
        <div className="flex-1 bg-white">
          {selectedStoryId ? (
            <StoryEditor
              storyId={selectedStoryId}
              onClose={() => setSelectedStoryId(null)}
              onDelete={handleStoryDeleted}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="h-16 w-16 mb-4 text-gray-300" />
              <p className="font-medium">Selectionnez un sujet</p>
              <p className="text-sm mt-1">
                Cliquez sur un sujet dans la liste pour le modifier
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
