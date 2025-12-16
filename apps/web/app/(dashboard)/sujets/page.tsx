'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Inbox, Vote } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { StoryCard, StoryFilters, CreateStoryDialog } from '@/components/sujets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface Filters {
  search: string;
  status: string;
  category: string;
}

export default function SujetsPage() {
  const router = useRouter();
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

  const handleStoryClick = (storyId: string) => {
    router.push(`/sujets/${storyId}`);
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
          <div className="flex items-center gap-2">
            <Link href="/pluralisme">
              <Button variant="outline" className="gap-2">
                <Vote className="h-4 w-4" />
                Pluralisme
              </Button>
            </Link>
            <CreateStoryDialog />
          </div>
        </div>
        <StoryFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Liste des sujets - Grille responsive */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : stories && stories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onClick={() => handleStoryClick(story.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <Inbox className="h-16 w-16 mb-4 text-gray-300" />
              <p className="font-medium text-lg">Aucun sujet</p>
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
  );
}
