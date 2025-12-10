'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  FileText,
  Mic,
  Music,
  Radio,
  Clock,
  MoreVertical,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Volume2,
  ScrollText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EditItemScriptDialog } from './EditItemScriptDialog';

interface StoryMediaItem {
  id: string;
  mediaItem: {
    id: string;
    title: string;
    type: string;
    duration: number | null;
    s3Url: string;
  };
}

interface RundownItemData {
  id: string;
  type: 'STORY' | 'INTERVIEW' | 'JINGLE' | 'MUSIC' | 'LIVE' | 'BREAK' | 'OTHER';
  title: string;
  duration: number;
  position: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE';
  notes?: string | null;
  script?: string | null;
  storyId?: string | null;
  assigneeId?: string | null;
  story?: {
    id: string;
    title: string;
    content?: string | null;
    media?: StoryMediaItem[];
  } | null;
  assignee?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  rundownId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  media?: unknown[];
}

interface RundownItemProps {
  item: RundownItemData;
  startTime: string;
  onDelete?: () => void;
  onStatusChange?: (status: RundownItemData['status']) => void;
  onFocus?: () => void; // For collaborative cursor tracking
  onBlur?: () => void;
}

const typeConfig = {
  STORY: { icon: FileText, label: 'Sujet', color: 'text-blue-600' },
  INTERVIEW: { icon: Mic, label: 'Interview', color: 'text-purple-600' },
  JINGLE: { icon: Music, label: 'Jingle', color: 'text-orange-600' },
  MUSIC: { icon: Music, label: 'Musique', color: 'text-pink-600' },
  LIVE: { icon: Radio, label: 'Direct', color: 'text-red-600' },
  BREAK: { icon: Clock, label: 'Pause', color: 'text-gray-600' },
  OTHER: { icon: FileText, label: 'Autre', color: 'text-gray-600' },
};

const statusConfig = {
  PENDING: { label: 'En attente', color: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-orange-100 text-orange-700' },
  READY: { label: 'Pret', color: 'bg-green-100 text-green-700' },
  ON_AIR: { label: 'A l\'antenne', color: 'bg-red-100 text-red-700' },
  DONE: { label: 'Termine', color: 'bg-blue-100 text-blue-700' },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RundownItem({
  item,
  startTime,
  onDelete,
  onStatusChange,
  onFocus,
  onBlur,
}: RundownItemProps) {
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeInfo = typeConfig[item.type];
  const statusInfo = statusConfig[item.status];
  const Icon = typeInfo.icon;
  const storyMedia = item.story?.media || [];
  const hasMedia = storyMedia.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-wrap items-center gap-3 p-3 bg-white border rounded-lg transition-all',
        isDragging && 'opacity-50 shadow-lg',
        item.status === 'ON_AIR' && 'ring-2 ring-red-500 bg-red-50'
      )}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Time */}
      <div className="w-16 text-sm font-mono text-gray-600">{startTime}</div>

      {/* Type icon */}
      <div className={cn('p-1.5 rounded', typeInfo.color, 'bg-opacity-10')}>
        <Icon className={cn('h-4 w-4', typeInfo.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.storyId && item.story ? (
            <Link
              href={`/sujets?id=${item.story.id}`}
              className="font-medium truncate text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {item.title}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <span className="font-medium truncate">{item.title}</span>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{item.notes}</p>
        )}
        {/* Media toggle button */}
        {hasMedia && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMediaExpanded(!mediaExpanded);
            }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-1"
          >
            {mediaExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Volume2 className="h-3 w-3" />
            {storyMedia.length} media{storyMedia.length > 1 ? 's' : ''} attache{storyMedia.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Duration */}
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <Clock className="h-4 w-4" />
        {formatDuration(item.duration)}
      </div>

      {/* Script button */}
      <EditItemScriptDialog
        itemId={item.id}
        itemTitle={item.title}
        currentScript={item.script || null}
        storyContent={item.story?.content}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              item.script ? 'text-blue-600' : 'text-gray-400'
            )}
            title={item.script ? 'Script defini - Cliquer pour modifier' : 'Ajouter un script'}
          >
            <ScrollText className="h-4 w-4" />
          </Button>
        }
      />

      {/* Status */}
      <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.entries(statusConfig).map(([key, config]) => (
            <DropdownMenuItem
              key={key}
              onClick={() =>
                onStatusChange?.(key as RundownItemData['status'])
              }
            >
              <Badge className={cn('mr-2 text-xs', config.color)}>
                {config.label}
              </Badge>
              Marquer comme {config.label.toLowerCase()}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Expanded media list */}
      {hasMedia && mediaExpanded && (
        <div className="col-span-full ml-14 mt-2 pl-4 border-l-2 border-gray-200">
          <ul className="space-y-1">
            {storyMedia.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 text-xs text-gray-600 py-1"
              >
                <Volume2 className="h-3 w-3 text-purple-500" />
                <span className="truncate flex-1">{m.mediaItem.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {m.mediaItem.type}
                </Badge>
                {m.mediaItem.duration && (
                  <span className="text-gray-400">
                    {formatDuration(m.mediaItem.duration)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
