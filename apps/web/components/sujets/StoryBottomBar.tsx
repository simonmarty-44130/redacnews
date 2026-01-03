'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Tag, Layers, Vote } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MediaPicker } from './MediaPicker';
import { PoliticalTagSelector } from '@/components/politics';
import { trpc } from '@/lib/trpc/client';
import type { ElectionTypeCode } from '@/lib/politics/config';
import { STORY_CATEGORIES } from '@/lib/stories/config';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon', color: 'bg-gray-500' },
  { value: 'IN_REVIEW', label: 'En revision', color: 'bg-yellow-500' },
  { value: 'APPROVED', label: 'Valide', color: 'bg-green-500' },
  { value: 'PUBLISHED', label: 'Publie', color: 'bg-blue-500' },
  { value: 'ARCHIVED', label: 'Archive', color: 'bg-gray-400' },
];

interface StoryBottomBarProps {
  storyId: string;
  status: string;
  category: string;
  mediaCount: number;
  estimatedDuration?: number | null;
  onStatusChange: (status: string) => void;
  onCategoryChange: (category: string) => void;
}

export function StoryBottomBar({
  storyId,
  status,
  category,
  mediaCount,
  estimatedDuration,
  onStatusChange,
  onCategoryChange,
}: StoryBottomBarProps) {
  const router = useRouter();
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status);
  const [electionType, setElectionType] = useState<ElectionTypeCode | null>(null);
  const [pluralismOpen, setPluralismOpen] = useState(false);

  // Récupérer le nombre de tags politiques associés
  const { data: politicalTags } = trpc.politics.getStoryTags.useQuery(
    { storyId },
    { enabled: !!storyId }
  );

  // Query to get audio count from story media
  const { data: storyMedia } = trpc.storyMedia.listByStory.useQuery(
    { storyId },
    { enabled: !!storyId }
  );

  const audioCount = storyMedia?.filter(
    (m) => m.mediaItem.type === 'AUDIO'
  ).length || 0;

  const handleMontage = () => {
    router.push(`/audio-editor?story=${storyId}`);
  };

  return (
    <footer className="h-12 bg-white border-t flex items-center justify-between px-4 shrink-0">
      {/* Left: Status & Category */}
      <div className="flex items-center gap-4">
        {/* Status selector */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${currentStatus?.color}`} />
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Category selector */}
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gray-400" />
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              {STORY_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: Media & Pluralism */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Music className="h-4 w-4" />
          <span>
            {mediaCount} media{mediaCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Mount audio button */}
        {audioCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMontage}
            className="h-8"
          >
            <Layers className="h-4 w-4 mr-2" />
            Monter les sons ({audioCount})
          </Button>
        )}

        <MediaPicker storyId={storyId} excludeIds={[]} />

        {/* Pluralism dialog button */}
        <Dialog open={pluralismOpen} onOpenChange={setPluralismOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Vote className="h-4 w-4 mr-2" />
              Pluralisme
              {(politicalTags?.length || 0) > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                  {politicalTags?.length}
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5 text-blue-600" />
                Pluralisme politique (ARCOM)
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <PoliticalTagSelector
                storyId={storyId}
                electionType={electionType}
                onElectionTypeChange={setElectionType}
                estimatedDuration={estimatedDuration}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </footer>
  );
}
