'use client';

import { useRef } from 'react';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { TRACK_HEIGHT, SNAP_TO_GRID } from '@/lib/audio-montage/constants';
import { Clip } from './Clip';
import { TrackControls } from './TrackControls';
import type { Track as TrackType, ClipWithComputed, DragItem } from '@/lib/audio-montage/types';

interface TrackProps {
  track: Omit<TrackType, 'clips'> & { clips: ClipWithComputed[] };
  zoom: number;
  scrollLeft: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClip: (clipId: string, trackId: string, startTime: number) => void;
  onTrimClip: (clipId: string, inPoint: number, outPoint: number) => void;
  onAddClip: (trackId: string, item: DragItem, startTime: number) => void;
  onTrackVolumeChange: (volume: number) => void;
  onTrackPanChange: (pan: number) => void;
  onTrackMuteToggle: () => void;
  onTrackSoloToggle: () => void;
  onTrackDelete: () => void;
  onTrackNameChange: (name: string) => void;
}

export function Track({
  track,
  zoom,
  scrollLeft,
  selectedClipId,
  onSelectClip,
  onDeleteClip,
  onMoveClip,
  onTrimClip,
  onAddClip,
  onTrackVolumeChange,
  onTrackPanChange,
  onTrackMuteToggle,
  onTrackSoloToggle,
  onTrackDelete,
  onTrackNameChange,
}: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Configuration du drop
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: ['CLIP', 'LIBRARY_ITEM'],
      drop: (item: DragItem, monitor) => {
        const clientOffset = monitor.getClientOffset();
        const trackRect = trackRef.current?.getBoundingClientRect();

        if (!clientOffset || !trackRect) return;

        // Calculer le temps de drop
        const x = clientOffset.x - trackRect.left + scrollLeft;
        let startTime = x / zoom;

        // Snap to grid
        if (SNAP_TO_GRID > 0) {
          startTime = Math.round(startTime / SNAP_TO_GRID) * SNAP_TO_GRID;
        }

        startTime = Math.max(0, startTime);

        if (item.type === 'CLIP') {
          // Deplacement d'un clip existant
          onMoveClip(item.id, track.id, startTime);
        } else {
          // Ajout d'un nouvel item depuis la bibliotheque
          onAddClip(track.id, item, startTime);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [track.id, zoom, scrollLeft, onMoveClip, onAddClip]
  );

  return (
    <div className="flex border-b border-border" style={{ height: TRACK_HEIGHT }}>
      {/* Controles de la piste */}
      <TrackControls
        track={track}
        onVolumeChange={onTrackVolumeChange}
        onPanChange={onTrackPanChange}
        onMuteToggle={onTrackMuteToggle}
        onSoloToggle={onTrackSoloToggle}
        onDelete={onTrackDelete}
        onNameChange={onTrackNameChange}
      />

      {/* Zone des clips */}
      <div
        ref={(node) => {
          (trackRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          drop(node);
        }}
        className={cn(
          'flex-1 relative bg-muted/10',
          isOver && canDrop && 'bg-primary/10',
          track.muted && 'opacity-50'
        )}
        onClick={() => onSelectClip(null)}
      >
        {/* Grille de fond */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: `${zoom * 1}px 100%`,
            backgroundPosition: `${-scrollLeft % (zoom * 1)}px 0`,
          }}
        />

        {/* Clips */}
        {track.clips.map((clip) => (
          <Clip
            key={clip.id}
            clip={clip}
            zoom={zoom}
            trackColor={track.color}
            isSelected={selectedClipId === clip.id}
            onSelect={() => onSelectClip(clip.id)}
            onDelete={() => onDeleteClip(clip.id)}
            onMove={(startTime) => onMoveClip(clip.id, track.id, startTime)}
            onTrim={(inPoint, outPoint) => onTrimClip(clip.id, inPoint, outPoint)}
          />
        ))}

        {/* Indicateur de drop */}
        {isOver && canDrop && (
          <div className="absolute inset-0 border-2 border-dashed border-primary rounded pointer-events-none" />
        )}
      </div>
    </div>
  );
}
