'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineRuler } from './TimelineRuler';
import { Track } from './Track';
import { ZoomControls } from './ZoomControls';
import {
  TRACK_CONTROLS_WIDTH,
  TRACK_HEIGHT,
  TIMELINE_RULER_HEIGHT,
  MAX_TRACKS,
} from '@/lib/audio-montage/constants';
import type { Track as TrackType, ClipWithComputed, DragItem } from '@/lib/audio-montage/types';

interface TimelineProps {
  tracks: (TrackType & { clips: ClipWithComputed[] })[];
  zoom: number;
  scrollLeft: number;
  currentTime: number;
  duration: number;
  selectedClipId: string | null;
  onZoomChange: (zoom: number) => void;
  onScrollChange: (scrollLeft: number) => void;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClip: (clipId: string, trackId: string, startTime: number) => void;
  onTrimClip: (clipId: string, inPoint: number, outPoint: number) => void;
  onAddClip: (trackId: string, item: DragItem, startTime: number) => void;
  onAddTrack: () => void;
  onDeleteTrack: (trackId: string) => void;
  onUpdateTrack: (
    trackId: string,
    updates: Partial<TrackType>
  ) => void;
}

export function Timeline({
  tracks,
  zoom,
  scrollLeft,
  currentTime,
  duration,
  selectedClipId,
  onZoomChange,
  onScrollChange,
  onSeek,
  onSelectClip,
  onDeleteClip,
  onMoveClip,
  onTrimClip,
  onAddClip,
  onAddTrack,
  onDeleteTrack,
  onUpdateTrack,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculer la largeur de la timeline
  const timelineWidth = Math.max(duration * zoom + 500, 2000);

  // Calculer la largeur du viewport
  const viewportWidth = containerRef.current
    ? containerRef.current.clientWidth - TRACK_CONTROLS_WIDTH
    : 800;

  // Gerer le scroll horizontal avec la molette
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom avec Ctrl/Cmd + molette
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(10, Math.min(200, zoom * delta));
        onZoomChange(newZoom);
      } else if (e.shiftKey) {
        // Scroll horizontal avec Shift + molette
        e.preventDefault();
        const newScrollLeft = Math.max(0, scrollLeft + e.deltaY);
        onScrollChange(newScrollLeft);
      }
    },
    [zoom, scrollLeft, onZoomChange, onScrollChange]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Fit to view
  const handleFitToView = () => {
    if (duration > 0 && viewportWidth > 0) {
      const newZoom = (viewportWidth - 50) / duration;
      onZoomChange(Math.max(10, Math.min(200, newZoom)));
      onScrollChange(0);
    }
  };

  // Suivre le curseur pendant la lecture
  useEffect(() => {
    const cursorX = currentTime * zoom;
    const viewStart = scrollLeft;
    const viewEnd = scrollLeft + viewportWidth;

    // Si le curseur sort de la vue, scroller pour le suivre
    if (cursorX > viewEnd - 50) {
      onScrollChange(cursorX - viewportWidth + 100);
    } else if (cursorX < viewStart + 50 && scrollLeft > 0) {
      onScrollChange(Math.max(0, cursorX - 100));
    }
  }, [currentTime, zoom, scrollLeft, viewportWidth, onScrollChange]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
      {/* Header avec zoom */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Timeline</span>
          <span className="text-xs text-muted-foreground">
            {tracks.length} piste{tracks.length > 1 ? 's' : ''}
          </span>
        </div>
        <ZoomControls
          zoom={zoom}
          onZoomChange={onZoomChange}
          onFitToView={handleFitToView}
        />
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex">
            {/* Colonne des controles de piste (fixe) */}
            <div
              className="sticky left-0 z-20 bg-background"
              style={{ width: TRACK_CONTROLS_WIDTH }}
            >
              {/* Espace pour la regle */}
              <div
                className="border-b border-r bg-muted/30"
                style={{ height: TIMELINE_RULER_HEIGHT }}
              />

              {/* Espace vide sous les pistes pour le bouton "Ajouter" */}
              <div
                style={{
                  height: tracks.length * TRACK_HEIGHT,
                }}
              />

              {/* Bouton ajouter piste */}
              {tracks.length < MAX_TRACKS && (
                <div className="p-2 border-r">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddTrack}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter une piste
                  </Button>
                </div>
              )}
            </div>

            {/* Zone scrollable de la timeline */}
            <div
              ref={timelineRef}
              className="flex-1 overflow-x-auto"
              onScroll={(e) => onScrollChange(e.currentTarget.scrollLeft)}
            >
              <div style={{ width: timelineWidth }}>
                {/* Regle temporelle */}
                <TimelineRuler
                  zoom={zoom}
                  scrollLeft={scrollLeft}
                  viewportWidth={viewportWidth}
                  duration={duration}
                  currentTime={currentTime}
                  onSeek={onSeek}
                />

                {/* Pistes */}
                {tracks.map((track) => (
                  <Track
                    key={track.id}
                    track={track}
                    zoom={zoom}
                    scrollLeft={scrollLeft}
                    selectedClipId={selectedClipId}
                    onSelectClip={onSelectClip}
                    onDeleteClip={onDeleteClip}
                    onMoveClip={onMoveClip}
                    onTrimClip={onTrimClip}
                    onAddClip={onAddClip}
                    onTrackVolumeChange={(volume) =>
                      onUpdateTrack(track.id, { volume })
                    }
                    onTrackPanChange={(pan) =>
                      onUpdateTrack(track.id, { pan })
                    }
                    onTrackMuteToggle={() =>
                      onUpdateTrack(track.id, { muted: !track.muted })
                    }
                    onTrackSoloToggle={() =>
                      onUpdateTrack(track.id, { solo: !track.solo })
                    }
                    onTrackDelete={() => onDeleteTrack(track.id)}
                    onTrackNameChange={(name) =>
                      onUpdateTrack(track.id, { name })
                    }
                  />
                ))}

                {/* Zone vide pour drop si pas de pistes */}
                {tracks.length === 0 && (
                  <div
                    className="flex items-center justify-center text-muted-foreground"
                    style={{ height: TRACK_HEIGHT * 2 }}
                  >
                    <div className="text-center">
                      <p className="text-sm">Aucune piste</p>
                      <p className="text-xs">
                        Cliquez sur "Ajouter une piste" pour commencer
                      </p>
                    </div>
                  </div>
                )}

                {/* Curseur de lecture vertical */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                  style={{
                    left: TRACK_CONTROLS_WIDTH + currentTime * zoom - scrollLeft,
                    display:
                      currentTime * zoom >= scrollLeft &&
                      currentTime * zoom <= scrollLeft + viewportWidth
                        ? 'block'
                        : 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
