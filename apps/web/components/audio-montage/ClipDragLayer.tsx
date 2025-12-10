'use client';

import { useDragLayer } from 'react-dnd';
import { Music, GripVertical } from 'lucide-react';
import { TRACK_HEIGHT } from '@/lib/audio-montage/constants';

/**
 * ClipDragLayer - Affiche une preview personnalisee pendant le drag d'un clip
 *
 * Ce composant remplace la preview HTML5 native pour eviter le bug ou
 * les controles de piste semblent se deplacer avec le clip.
 */
export function ClipDragLayer() {
  const { itemType, item, isDragging, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

  // Ne rien afficher si pas en train de drag ou si ce n'est pas un clip
  if (!isDragging || !currentOffset) {
    return null;
  }

  // Ne rendre que pour les clips et items de bibliotheque
  if (itemType !== 'CLIP' && itemType !== 'LIBRARY_ITEM') {
    return null;
  }

  const clipName = item?.name || 'Clip';
  const clipDuration = item?.duration || 0;

  // Formater la duree
  const formatDuration = (sec: number): string => {
    if (!sec) return '--:--';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clipHeight = TRACK_HEIGHT - 8;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${currentOffset.x - 50}px, ${currentOffset.y - clipHeight / 2}px)`,
      }}
    >
      <div
        className="rounded overflow-hidden border border-white/30 shadow-lg"
        style={{
          width: 150,
          height: clipHeight,
          backgroundColor: 'rgba(59, 130, 246, 0.8)', // Bleu semi-transparent
        }}
      >
        {/* Contenu de la preview */}
        <div className="h-full flex flex-col p-1.5">
          {/* Header */}
          <div className="flex items-center gap-1 text-white text-xs">
            <GripVertical className="h-3 w-3 opacity-70 shrink-0" />
            <span className="truncate font-medium drop-shadow-md">{clipName}</span>
          </div>

          {/* Icone centrale */}
          <div className="flex-1 flex items-center justify-center">
            <Music className="h-5 w-5 text-white/60" />
          </div>

          {/* Duration */}
          <div className="text-white/80 text-[10px] font-medium drop-shadow-md">
            {formatDuration(clipDuration)}
          </div>
        </div>
      </div>
    </div>
  );
}
