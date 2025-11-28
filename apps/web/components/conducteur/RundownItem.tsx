'use client';

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

interface RundownItemData {
  id: string;
  type: 'STORY' | 'INTERVIEW' | 'JINGLE' | 'MUSIC' | 'LIVE' | 'BREAK' | 'OTHER';
  title: string;
  duration: number;
  position: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE';
  notes?: string | null;
  storyId?: string | null;
  assigneeId?: string | null;
  story?: { title: string } | null;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-white border rounded-lg transition-all',
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
          <span className="font-medium truncate">{item.title}</span>
          {item.story && (
            <span className="text-xs text-gray-500 truncate">
              - {item.story.title}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{item.notes}</p>
        )}
      </div>

      {/* Duration */}
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <Clock className="h-4 w-4" />
        {formatDuration(item.duration)}
      </div>

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
    </div>
  );
}
