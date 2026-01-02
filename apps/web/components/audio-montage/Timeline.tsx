'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Plus, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimelineRuler } from './TimelineRuler';
import { Track, type DropPreview, type CrossfadeInfo } from './Track';
import {
  TRACK_CONTROLS_WIDTH,
  TRACK_HEIGHT,
  TIMELINE_RULER_HEIGHT,
  MAX_TRACKS,
  FIXED_TRACKS_MODE,
} from '@/lib/audio-montage/constants';
import type { Track as TrackType, ClipWithComputed, DragItem } from '@/lib/audio-montage/types';
import type { ClipRef } from './Clip';

interface TimelineProps {
  tracks: (TrackType & { clips: ClipWithComputed[] })[];
  zoom: number;
  scrollLeft: number;
  currentTime: number;
  duration: number;
  selectedClipId: string | null;
  clipRefs: Map<string, ClipRef | null>;
  inPoint: number | null;
  outPoint: number | null;
  editMode: 'select' | 'razor';
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
  onClipReady?: (clipId: string) => void;
  onSplitClip?: (clipId: string, globalTime: number) => void;
  onDurationDetected?: (clipId: string, realDuration: number) => void;
  onClipVolumeChange?: (clipId: string, volume: number) => void;
  onClipFadeChange?: (clipId: string, fadeInDuration: number, fadeOutDuration: number) => void;
  onCrossfade?: (crossfadeInfo: CrossfadeInfo) => void;
  onViewportWidthChange?: (width: number) => void;
  isRecording?: boolean;
  recordingTrackId?: string | null;
  onStartRecording?: (trackId: string) => void;
}

export function Timeline({
  tracks,
  zoom,
  scrollLeft,
  currentTime,
  duration,
  selectedClipId,
  clipRefs,
  inPoint,
  outPoint,
  editMode,
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
  onClipReady,
  onSplitClip,
  onDurationDetected,
  onClipVolumeChange,
  onClipFadeChange,
  onCrossfade,
  onViewportWidthChange,
  isRecording,
  recordingTrackId,
  onStartRecording,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // État pour l'indicateur de snap (magnétisme)
  const [snapIndicator, setSnapIndicator] = useState<number | null>(null);

  // État pour la prévisualisation de drop
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);

  // Collecter tous les clips de toutes les pistes pour le snap inter-pistes
  const allClips = useMemo(() => {
    return tracks.flatMap((track) => track.clips);
  }, [tracks]);

  // Calculer la largeur de la timeline
  const timelineWidth = Math.max(duration * zoom + 500, 2000);

  // State pour la largeur du viewport
  const [viewportWidth, setViewportWidth] = useState(800);

  // Observer les changements de taille du container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateViewportWidth = () => {
      const newWidth = container.clientWidth - TRACK_CONTROLS_WIDTH;
      if (newWidth !== viewportWidth) {
        setViewportWidth(newWidth);
        onViewportWidthChange?.(newWidth);
      }
    };

    // Initial update
    updateViewportWidth();

    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(updateViewportWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [viewportWidth, onViewportWidthChange]);

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

  // Synchroniser le scroll DOM avec le state scrollLeft
  // Ceci est nécessaire quand le scrollLeft est changé depuis la minimap
  useEffect(() => {
    if (timelineRef.current && timelineRef.current.scrollLeft !== scrollLeft) {
      timelineRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  // Suivre le curseur pendant la lecture (auto-scroll)
  // Utiliser un ref pour éviter de déclencher l'auto-scroll quand on drag la minimap
  const autoScrollEnabledRef = useRef(true);

  useEffect(() => {
    // Désactiver temporairement l'auto-scroll après un changement manuel de scrollLeft
    // (pour permettre de naviguer avec la minimap sans que l'auto-scroll interfère)
    autoScrollEnabledRef.current = false;
    const timeout = setTimeout(() => {
      autoScrollEnabledRef.current = true;
    }, 500);
    return () => clearTimeout(timeout);
  }, [scrollLeft]);

  useEffect(() => {
    if (!autoScrollEnabledRef.current) return;

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
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Timeline - Structure: colonne fixe + zone scrollable */}
      <div className="flex-1 flex overflow-hidden">
        {/* Colonne des controles de piste (FIXE - en dehors du scroll) - Fond gris foncé */}
        <div
          className="flex-shrink-0 bg-[#1a1a1a] z-20 overflow-y-auto border-r border-[#2a2a2a]"
          style={{ width: TRACK_CONTROLS_WIDTH }}
        >
          {/* Header de la colonne avec zoom */}
          <div
            className="flex items-center justify-between px-2 border-b border-[#2a2a2a] bg-[#111111]"
            style={{ height: TIMELINE_RULER_HEIGHT }}
          >
            <span className="text-xs text-gray-400 font-medium">Pistes</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-[#2a2a2a]"
                onClick={() => onZoomChange(Math.max(10, zoom * 0.8))}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-gray-500 font-mono w-8 text-center">
                {Math.round(zoom)}px/s
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-[#2a2a2a]"
                onClick={() => onZoomChange(Math.min(200, zoom * 1.2))}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-[#2a2a2a]"
                onClick={handleFitToView}
                title="Ajuster à la vue"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Controles des pistes */}
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="flex flex-col border-b border-[#2a2a2a] bg-[#1a1a1a] p-2"
              style={{ height: TRACK_HEIGHT }}
            >
              {/* Header avec nom et couleur */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/20"
                  style={{ backgroundColor: track.color }}
                />
                {FIXED_TRACKS_MODE ? (
                  // En mode pistes fixes, afficher le nom sans possibilité de modification
                  <span
                    className="text-sm font-medium flex-1 min-w-0 truncate text-white"
                    title={track.name}
                  >
                    {track.name}
                  </span>
                ) : (
                  // En mode dynamique, permettre le renommage
                  <input
                    type="text"
                    value={track.name}
                    onChange={(e) => onUpdateTrack(track.id, { name: e.target.value })}
                    className="text-sm font-medium bg-transparent border-none outline-none flex-1 min-w-0 truncate text-white focus:bg-[#2a2a2a] rounded px-1"
                    title={track.name}
                  />
                )}
                {/* Bouton de suppression masqué en mode pistes fixes */}
                {!FIXED_TRACKS_MODE && (
                  <button
                    className="h-6 w-6 text-gray-500 hover:text-red-400 shrink-0 flex items-center justify-center"
                    onClick={() => onDeleteTrack(track.id)}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Boutons Mute / Solo / Rec */}
              <div className="flex gap-1 mb-2">
                <button
                  className={`h-6 px-2 text-xs font-bold rounded transition-colors ${
                    track.muted
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333] hover:text-white'
                  }`}
                  onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                  title="Mute (M)"
                >
                  M
                </button>
                <button
                  className={`h-6 px-2 text-xs font-bold rounded transition-colors ${
                    track.solo
                      ? 'bg-green-500 text-black'
                      : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333] hover:text-white'
                  }`}
                  onClick={() => onUpdateTrack(track.id, { solo: !track.solo })}
                  title="Solo (S)"
                >
                  S
                </button>
                {onStartRecording && (
                  <button
                    className={`h-6 w-6 flex items-center justify-center rounded transition-all ${
                      isRecording && recordingTrackId === track.id
                        ? 'bg-red-600 animate-pulse'
                        : 'bg-[#2a2a2a] hover:bg-red-600'
                    }`}
                    onClick={() => onStartRecording(track.id)}
                    title={isRecording && recordingTrackId === track.id ? "Arreter l'enregistrement" : "Enregistrer"}
                  >
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </button>
                )}
              </div>

              {/* Volume - Style compact */}
              <div className="flex items-center gap-2">
                <svg className="h-3 w-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={track.volume * 100}
                  onChange={(e) => onUpdateTrack(track.id, { volume: Number(e.target.value) / 100 })}
                  className="flex-1 h-1 accent-[#3B82F6] bg-[#2a2a2a] rounded-full cursor-pointer"
                />
                <span className="text-[10px] text-gray-500 w-7 text-right font-mono">
                  {Math.round(track.volume * 100)}%
                </span>
              </div>
            </div>
          ))}

          {/* Bouton ajouter piste - masqué en mode pistes fixes */}
          {!FIXED_TRACKS_MODE && tracks.length < MAX_TRACKS && (
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddTrack}
                className="w-full gap-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] border border-dashed border-[#2a2a2a]"
              >
                <Plus className="h-4 w-4" />
                Ajouter une piste
              </Button>
            </div>
          )}
        </div>

        {/* Zone scrollable de la timeline (clips uniquement) - Fond noir */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto bg-[#0a0a0a]"
          onScroll={(e) => onScrollChange(e.currentTarget.scrollLeft)}
        >
              <div style={{ width: timelineWidth }} className="relative">
                {/* Regle temporelle */}
                <TimelineRuler
                  zoom={zoom}
                  scrollLeft={scrollLeft}
                  viewportWidth={viewportWidth}
                  duration={duration}
                  currentTime={currentTime}
                  onSeek={onSeek}
                />

                {/* Zone In/Out (affichée si les deux points sont définis) */}
                {inPoint !== null && outPoint !== null && inPoint < outPoint && (
                  <div
                    className="absolute bg-[#3B82F6]/20 border-l-2 border-r-2 border-[#3B82F6] pointer-events-none z-5"
                    style={{
                      left: inPoint * zoom,
                      width: (outPoint - inPoint) * zoom,
                      top: TIMELINE_RULER_HEIGHT,
                      bottom: 0,
                    }}
                  >
                    {/* Indicateur In */}
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-[#3B82F6] text-white text-[10px] font-bold flex items-center justify-center">
                      I
                    </div>
                    {/* Indicateur Out */}
                    <div className="absolute -right-2 top-0 w-4 h-4 bg-[#3B82F6] text-white text-[10px] font-bold flex items-center justify-center">
                      O
                    </div>
                  </div>
                )}

                {/* Point In seul */}
                {inPoint !== null && outPoint === null && (
                  <div
                    className="absolute w-0.5 bg-[#3B82F6] pointer-events-none z-5"
                    style={{
                      left: inPoint * zoom,
                      top: TIMELINE_RULER_HEIGHT,
                      bottom: 0,
                    }}
                  >
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-[#3B82F6] text-white text-[10px] font-bold flex items-center justify-center">
                      I
                    </div>
                  </div>
                )}

                {/* Point Out seul */}
                {outPoint !== null && inPoint === null && (
                  <div
                    className="absolute w-0.5 bg-[#3B82F6] pointer-events-none z-5"
                    style={{
                      left: outPoint * zoom,
                      top: TIMELINE_RULER_HEIGHT,
                      bottom: 0,
                    }}
                  >
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-[#3B82F6] text-white text-[10px] font-bold flex items-center justify-center">
                      O
                    </div>
                  </div>
                )}

                {/* Indicateur de snap (magnétisme) */}
                {snapIndicator !== null && (
                  <div
                    className="absolute w-0.5 bg-yellow-400 pointer-events-none z-30"
                    style={{
                      left: snapIndicator * zoom,
                      top: TIMELINE_RULER_HEIGHT,
                      bottom: 0,
                    }}
                  />
                )}

                {/* Pistes */}
                {tracks.map((track) => (
                  <Track
                    key={track.id}
                    track={track}
                    allClips={allClips}
                    zoom={zoom}
                    scrollLeft={scrollLeft}
                    viewportWidth={viewportWidth}
                    selectedClipId={selectedClipId}
                    clipRefs={clipRefs}
                    editMode={editMode}
                    snapIndicator={snapIndicator}
                    dropPreview={dropPreview}
                    onSnapIndicatorChange={setSnapIndicator}
                    onDropPreviewChange={setDropPreview}
                    onScrollChange={onScrollChange}
                    onSelectClip={onSelectClip}
                    onDeleteClip={onDeleteClip}
                    onMoveClip={onMoveClip}
                    onTrimClip={onTrimClip}
                    onAddClip={onAddClip}
                    onClipReady={onClipReady}
                    onSplitClip={onSplitClip}
                    onDurationDetected={onDurationDetected}
                    onClipVolumeChange={onClipVolumeChange}
                    onClipFadeChange={onClipFadeChange}
                    onCrossfade={onCrossfade}
                  />
                ))}

                {/* Zone vide pour drop si pas de pistes */}
                {tracks.length === 0 && (
                  <div
                    className="flex items-center justify-center text-gray-500"
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

                {/* Curseur de lecture vertical - Bleu vif */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#3B82F6] pointer-events-none z-10 shadow-lg shadow-blue-500/50"
                  style={{
                    left: currentTime * zoom,
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
    </div>
  );
}
