'use client';

import { useState, useRef, useEffect } from 'react';
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
  Link2,
  Unlink,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LinkRundownDialog } from './LinkRundownDialog';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

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

interface LinkedRundownInfo {
  id: string;
  status: string;
  show: {
    id: string;
    name: string;
    color: string;
  };
  items: Array<{
    id: string;
    script: string | null;
    googleDocId: string | null;
  }>;
}

type LinkedRundownState = 'empty' | 'draft' | 'ready';

/**
 * Calcule l'etat d'un conducteur imbrique pour l'indicateur visuel
 */
function getLinkedRundownState(linkedRundown: LinkedRundownInfo): LinkedRundownState {
  // Si marque READY ou ON_AIR → vert
  if (linkedRundown.status === 'READY' || linkedRundown.status === 'ON_AIR') {
    return 'ready';
  }

  // Calculer le taux de remplissage
  const total = linkedRundown.items.length;
  if (total === 0) return 'empty';

  const filled = linkedRundown.items.filter(
    (item) => item.script || item.googleDocId
  ).length;

  const fillRate = filled / total;

  // < 30% rempli → rouge
  if (fillRate < 0.3) return 'empty';

  // Sinon → orange (en cours)
  return 'draft';
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
  googleDocId?: string | null;
  googleDocUrl?: string | null;
  storyId?: string | null;
  assigneeId?: string | null;
  linkedRundownId?: string | null;
  linkedRundown?: LinkedRundownInfo | null;
  fixedTime?: string | null; // Heure fixe obligatoire (format HH:mm)
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
  rundownId: string;
  rundownDate: Date;
  onDelete?: () => void;
  onStatusChange?: (status: RundownItemData['status']) => void;
  onDurationChange?: (newDuration: number) => void;
  onFocus?: () => void; // For collaborative cursor tracking
  onBlur?: () => void;
  onLinkChange?: () => void;
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

/**
 * Calcule le delta entre l'heure calculée et l'heure fixe obligatoire
 * Retourne le delta en secondes (positif si en retard, négatif si en avance)
 */
function calculateFixedTimeDelta(
  calculatedTime: string,
  fixedTime: string
): { deltaSeconds: number; deltaText: string; status: 'ok' | 'warning' | 'error' } {
  // Parser l'heure calculée (format HH:mm:ss ou HH:mm)
  const calcParts = calculatedTime.split(':').map(Number);
  const calcSeconds = calcParts[0] * 3600 + calcParts[1] * 60 + (calcParts[2] || 0);

  // Parser l'heure fixe (format HH:mm)
  const fixedParts = fixedTime.split(':').map(Number);
  const fixedSeconds = fixedParts[0] * 3600 + fixedParts[1] * 60;

  const deltaSeconds = calcSeconds - fixedSeconds;
  const absDelta = Math.abs(deltaSeconds);

  // Formater le delta
  const mins = Math.floor(absDelta / 60);
  const secs = absDelta % 60;
  const sign = deltaSeconds >= 0 ? '+' : '-';
  const deltaText = `${sign}${mins}:${secs.toString().padStart(2, '0')}`;

  // Déterminer le statut
  let status: 'ok' | 'warning' | 'error';
  if (absDelta <= 30) {
    status = 'ok'; // < 30s = OK
  } else if (absDelta <= 120) {
    status = 'warning'; // 30s - 2min = attention
  } else {
    status = 'error'; // > 2min = problème
  }

  return { deltaSeconds, deltaText, status };
}

export function RundownItem({
  item,
  startTime,
  rundownId,
  rundownDate,
  onDelete,
  onStatusChange,
  onDurationChange,
  onFocus,
  onBlur,
  onLinkChange,
}: RundownItemProps) {
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editedMinutes, setEditedMinutes] = useState(Math.floor(item.duration / 60));
  const [editedSeconds, setEditedSeconds] = useState(item.duration % 60);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const utils = trpc.useUtils();

  // Focus sur l'input des minutes quand on entre en mode édition
  useEffect(() => {
    if (isEditingDuration && minutesInputRef.current) {
      minutesInputRef.current.focus();
      minutesInputRef.current.select();
    }
  }, [isEditingDuration]);

  // Handlers pour l'édition de la durée
  const handleStartEditDuration = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedMinutes(Math.floor(item.duration / 60));
    setEditedSeconds(item.duration % 60);
    setIsEditingDuration(true);
  };

  const handleSaveDuration = () => {
    const newDuration = editedMinutes * 60 + editedSeconds;
    if (newDuration !== item.duration && newDuration >= 0) {
      onDurationChange?.(newDuration);
    }
    setIsEditingDuration(false);
  };

  const handleCancelEditDuration = () => {
    setEditedMinutes(Math.floor(item.duration / 60));
    setEditedSeconds(item.duration % 60);
    setIsEditingDuration(false);
  };

  const handleDurationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveDuration();
    } else if (e.key === 'Escape') {
      handleCancelEditDuration();
    }
  };

  // Mutation pour creer un Google Doc pour l'item
  const createItemDoc = trpc.rundown.createItemDoc.useMutation({
    onSuccess: (data) => {
      // Ouvrir le Google Doc cree dans un nouvel onglet
      if (data.googleDocUrl) {
        window.open(data.googleDocUrl, '_blank');
      }
      // Rafraichir les donnees
      utils.rundown.get.invalidate();
    },
    onError: () => {
      toast.error('Erreur lors de la creation du document');
    },
  });

  // Handler pour ouvrir ou creer le script
  const handleOpenScript = () => {
    if (item.googleDocUrl) {
      // Google Doc existe → l'ouvrir directement
      window.open(item.googleDocUrl, '_blank');
    } else {
      // Pas de Google Doc → le creer puis l'ouvrir
      createItemDoc.mutate({
        itemId: item.id,
        initialContent: item.script || item.story?.content || '',
      });
    }
  };

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

      {/* Time + Fixed time badge */}
      <div className="flex items-center gap-1">
        <div className="w-16 text-sm font-mono text-gray-600">{startTime}</div>
        {item.fixedTime && (() => {
          const delta = calculateFixedTimeDelta(startTime, item.fixedTime);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-mono font-medium',
                      delta.status === 'ok' && 'bg-green-100 text-green-700',
                      delta.status === 'warning' && 'bg-orange-100 text-orange-700',
                      delta.status === 'error' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {item.fixedTime}
                    {delta.status !== 'ok' && (
                      <span className="ml-1 text-[10px]">
                        ({delta.deltaText})
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Heure impérative: {item.fixedTime}</p>
                  <p className={cn(
                    delta.status === 'ok' && 'text-green-600',
                    delta.status === 'warning' && 'text-orange-600',
                    delta.status === 'error' && 'text-red-600'
                  )}>
                    Delta: {delta.deltaText}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}
      </div>

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

      {/* Linked rundown indicator with status */}
      {item.linkedRundown && (() => {
        const state = getLinkedRundownState(item.linkedRundown);
        return (
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border-2 col-span-full ml-14',
              state === 'ready' && 'border-green-500 bg-green-50',
              state === 'draft' && 'border-orange-500 bg-orange-50',
              state === 'empty' && 'border-red-500 bg-red-50'
            )}
          >
            <Link2
              className={cn(
                'h-4 w-4',
                state === 'ready' && 'text-green-600',
                state === 'draft' && 'text-orange-600',
                state === 'empty' && 'text-red-600'
              )}
            />

            <span className="text-sm font-medium">
              {item.linkedRundown.show.name}
            </span>

            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                state === 'ready' && 'bg-green-200 text-green-800',
                state === 'draft' && 'bg-orange-200 text-orange-800',
                state === 'empty' && 'bg-red-200 text-red-800'
              )}
            >
              {state === 'ready' && 'Pret'}
              {state === 'draft' && 'En cours...'}
              {state === 'empty' && 'A remplir'}
            </span>

            <Link
              href={`/conducteur?id=${item.linkedRundown.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Ouvrir
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        );
      })()}

      {/* Duration - Editable */}
      {isEditingDuration ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Clock className="h-4 w-4 text-blue-600" />
          <input
            ref={minutesInputRef}
            type="number"
            min="0"
            max="999"
            value={editedMinutes}
            onChange={(e) => setEditedMinutes(Math.max(0, parseInt(e.target.value) || 0))}
            onKeyDown={handleDurationKeyDown}
            className="w-10 h-6 text-sm text-center border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-gray-400">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={editedSeconds.toString().padStart(2, '0')}
            onChange={(e) => setEditedSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
            onKeyDown={handleDurationKeyDown}
            className="w-10 h-6 text-sm text-center border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={handleSaveDuration}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-gray-600"
            onClick={handleCancelEditDuration}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleStartEditDuration}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                <Clock className="h-4 w-4" />
                {formatDuration(item.duration)}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cliquer pour modifier la durée</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Script button - Ouvre directement le Google Doc */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenScript}
              disabled={createItemDoc.isPending}
              className={cn(
                'h-8 w-8',
                item.googleDocUrl
                  ? 'text-green-600' // Google Doc existe
                  : item.script
                    ? 'text-blue-600' // Script texte simple
                    : 'text-gray-400' // Pas de script
              )}
            >
              {createItemDoc.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : (
                <ScrollText className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {createItemDoc.isPending
              ? 'Creation en cours...'
              : item.googleDocUrl
                ? 'Ouvrir le script'
                : 'Creer le script'
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Link rundown button */}
      <LinkRundownDialog
        itemId={item.id}
        itemTitle={item.title}
        rundownId={rundownId}
        rundownDate={rundownDate}
        linkedRundown={item.linkedRundown}
        onSuccess={onLinkChange}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              item.linkedRundown
                ? 'text-purple-600' // Conducteur lie
                : 'text-gray-400' // Pas de lien
            )}
            title={
              item.linkedRundown
                ? `Conducteur lie: ${item.linkedRundown.show.name}`
                : 'Lier un conducteur imbrique'
            }
          >
            <Link2 className="h-4 w-4" />
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
