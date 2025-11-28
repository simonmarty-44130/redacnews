'use client';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  category?: string | null;
  estimatedDuration?: number | null;
  updatedAt: Date;
  author: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
}

interface StoryCardProps {
  story: Story;
  isSelected?: boolean;
  onClick?: () => void;
}

const statusConfig = {
  DRAFT: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  IN_REVIEW: { label: 'En revision', color: 'bg-orange-100 text-orange-700' },
  APPROVED: { label: 'Valide', color: 'bg-green-100 text-green-700' },
  PUBLISHED: { label: 'Publie', color: 'bg-blue-100 text-blue-700' },
  ARCHIVED: { label: 'Archive', color: 'bg-gray-100 text-gray-500' },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function StoryCard({ story, isSelected, onClick }: StoryCardProps) {
  const status = statusConfig[story.status];
  const authorName = story.author.firstName && story.author.lastName
    ? `${story.author.firstName} ${story.author.lastName}`
    : story.author.email.split('@')[0];

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500 bg-blue-50/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gray-100 rounded-lg">
          <FileText className="h-5 w-5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{story.title}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {authorName}
            </span>
            {story.estimatedDuration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(story.estimatedDuration)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn('text-xs', status.color)}>
              {status.label}
            </Badge>
            {story.category && (
              <Badge variant="outline" className="text-xs">
                {story.category}
              </Badge>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {formatDistanceToNow(new Date(story.updatedAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
