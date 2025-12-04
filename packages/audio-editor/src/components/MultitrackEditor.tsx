'use client';

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useEditorStore } from '../stores/editorStore';
import { usePlaylist } from '../hooks/usePlaylist';
import { useTransport } from '../hooks/useTransport';
import { useSelection } from '../hooks/useSelection';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useExport } from '../hooks/useExport';
import { TransportControls } from './TransportControls';
import { Toolbar } from './Toolbar';
import { TrackList } from './TrackControls';
import { Timeline, WaveformContainer } from './Timeline';
import { ExportDialog } from './ExportDialog';
import type {
  MultitrackEditorProps,
  MultitrackEditorRef,
  Track,
  ExportOptions,
  ExportResult,
} from '../types/editor.types';
import { EDITOR_THEME, DEFAULTS } from '../constants/shortcuts';

export const MultitrackEditor = forwardRef<MultitrackEditorRef, MultitrackEditorProps>(
  function MultitrackEditor(
    {
      initialTracks = [],
      onSave,
      onTracksChange,
      onClose,
      sampleRate = DEFAULTS.sampleRate,
      defaultZoom = DEFAULTS.zoom,
      showTimecode = true,
      className = '',
      theme = 'dark',
    },
    ref
  ) {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Local state
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Store
    const tracks = useEditorStore((state) => state.tracks);
    const duration = useEditorStore((state) => state.duration);
    const currentTime = useEditorStore((state) => state.currentTime);
    const playState = useEditorStore((state) => state.playState);
    const zoom = useEditorStore((state) => state.zoom);
    const selection = useEditorStore((state) => state.selection);
    const selectedTrackIds = useEditorStore((state) => state.selectedTrackIds);
    const canUndo = useEditorStore((state) => state.canUndo);
    const canRedo = useEditorStore((state) => state.canRedo);
    const markers = useEditorStore((state) => state.markers);

    const loadTracks = useEditorStore((state) => state.loadTracks);
    const addTrackStore = useEditorStore((state) => state.addTrack);
    const removeTrackStore = useEditorStore((state) => state.removeTrack);
    const updateTrack = useEditorStore((state) => state.updateTrack);
    const setPlayState = useEditorStore((state) => state.setPlayState);
    const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
    const setSelection = useEditorStore((state) => state.setSelection);
    const selectTrack = useEditorStore((state) => state.selectTrack);
    const toggleMute = useEditorStore((state) => state.toggleMute);
    const toggleSolo = useEditorStore((state) => state.toggleSolo);
    const setTrackGain = useEditorStore((state) => state.setTrackGain);
    const setTrackPan = useEditorStore((state) => state.setTrackPan);
    const setZoom = useEditorStore((state) => state.setZoom);
    const zoomIn = useEditorStore((state) => state.zoomIn);
    const zoomOut = useEditorStore((state) => state.zoomOut);
    const zoomToFit = useEditorStore((state) => state.zoomToFit);
    const undo = useEditorStore((state) => state.undo);
    const redo = useEditorStore((state) => state.redo);

    // Playlist hook
    const playlist = usePlaylist({
      container: waveformContainerRef.current,
      sampleRate,
      theme,
    });

    // Transport hook
    const transport = useTransport({
      onPlay: () => playlist.play(),
      onPause: () => playlist.pause(),
      onStop: () => playlist.stop(),
      onSeek: (time) => playlist.seek(time),
    });

    // Selection hook
    const selectionHook = useSelection();

    // Export hook
    const exportHook = useExport();

    // Theme colors
    const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

    // Load initial tracks
    useEffect(() => {
      if (initialTracks.length > 0) {
        loadTracks(initialTracks);
        playlist.loadTracks(initialTracks);
      }
    }, []); // Only on mount

    // Notify parent of track changes
    useEffect(() => {
      onTracksChange?.(tracks);
    }, [tracks, onTracksChange]);

    // Sync scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const scrollLeftValue = e.currentTarget.scrollLeft;
      setScrollLeft(scrollLeftValue);
    }, []);

    // Handle seek from timeline
    const handleSeek = useCallback(
      (time: number) => {
        setCurrentTime(time);
        playlist.seek(time);
      },
      [setCurrentTime, playlist]
    );

    // Handle selection change
    const handleSelectionChange = useCallback(
      (start: number, end: number) => {
        setSelection({ start, end });
        playlist.setSelection(start, end);
      },
      [setSelection, playlist]
    );

    // Handle add track
    const handleAddTrack = useCallback(() => {
      // Create file input and trigger click
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;

        for (const file of Array.from(files)) {
          const url = URL.createObjectURL(file);
          const trackId = addTrackStore({
            src: url,
            name: file.name.replace(/\.[^/.]+$/, ''),
            start: 0,
          });
          await playlist.addTrack({
            id: trackId,
            src: url,
            name: file.name.replace(/\.[^/.]+$/, ''),
            start: 0,
          });
        }
      };
      input.click();
    }, [addTrackStore, playlist]);

    // Handle remove track
    const handleRemoveTrack = useCallback(
      (trackId: string) => {
        removeTrackStore(trackId);
        playlist.removeTrack(trackId);
      },
      [removeTrackStore, playlist]
    );

    // Handle export
    const handleExport = useCallback(
      async (options: ExportOptions, filename: string) => {
        try {
          const result = await playlist.exportMix(options);
          exportHook.downloadExport(result, filename);
          setIsExportDialogOpen(false);

          if (onSave) {
            await onSave(result.blob, {
              title: filename,
              duration: result.duration,
              format: options.format,
              sampleRate: result.metadata.sampleRate,
              channels: result.metadata.channels,
            });
          }
        } catch (err) {
          console.error('Export failed:', err);
        }
      },
      [playlist, exportHook, onSave]
    );

    // Keyboard shortcuts
    useKeyboardShortcuts({
      enabled: true,
      handlers: {
        onPlayPause: transport.togglePlayPause,
        onStop: transport.stop,
        onRewind: transport.rewind,
        onFastForward: transport.fastForward,
        onShuttleBack: transport.shuttleBack,
        onShuttleStop: transport.shuttleStop,
        onShuttleForward: transport.shuttleForward,
        onUndo: undo,
        onRedo: redo,
        onCut: () => {
          // TODO: Implement cut
        },
        onCopy: () => {
          // TODO: Implement copy
        },
        onPaste: () => {
          // TODO: Implement paste
        },
        onDelete: () => {
          // TODO: Implement delete
        },
        onSelectAll: selectionHook.selectAll,
        onDeselect: selectionHook.selectNone,
        onSplit: () => {
          // TODO: Implement split
        },
        onSetCueIn: () => selectionHook.setCueIn(),
        onSetCueOut: () => selectionHook.setCueOut(),
        onGoToCueIn: selectionHook.goToCueIn,
        onGoToCueOut: selectionHook.goToCueOut,
        onZoomIn: zoomIn,
        onZoomOut: zoomOut,
        onZoomFit: zoomToFit,
        onMuteTrack: () => {
          if (selectedTrackIds.length > 0) {
            toggleMute(selectedTrackIds[0]);
          }
        },
        onSoloTrack: () => {
          if (selectedTrackIds.length > 0) {
            toggleSolo(selectedTrackIds[0]);
          }
        },
        onSave: () => {
          // TODO: Implement save
        },
        onExport: () => setIsExportDialogOpen(true),
      },
    });

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          setPlayState('playing');
          playlist.play();
        },
        pause: () => {
          setPlayState('paused');
          playlist.pause();
        },
        stop: () => {
          setPlayState('stopped');
          setCurrentTime(0);
          playlist.stop();
        },
        seek: (time: number) => {
          setCurrentTime(time);
          playlist.seek(time);
        },
        addTrack: (track: Track) => {
          addTrackStore(track);
          playlist.addTrack(track);
        },
        removeTrack: (trackId: string) => {
          removeTrackStore(trackId);
          playlist.removeTrack(trackId);
        },
        getState: () => useEditorStore.getState(),
        exportAudio: async (options: ExportOptions): Promise<ExportResult> => {
          return playlist.exportMix(options);
        },
        undo,
        redo,
      }),
      [playlist, addTrackStore, removeTrackStore, setPlayState, setCurrentTime, undo, redo]
    );

    return (
      <div
        ref={containerRef}
        className={`flex flex-col h-full ${className}`}
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        {/* Toolbar */}
        <Toolbar
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={selection !== null}
          onUndo={undo}
          onRedo={redo}
          onCut={() => {}}
          onCopy={() => {}}
          onPaste={() => {}}
          onDelete={() => {}}
          onSplit={() => {}}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomFit={zoomToFit}
          onExport={() => setIsExportDialogOpen(true)}
        />

        {/* Transport controls */}
        <div
          className="flex items-center px-4 py-2 border-b"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <TransportControls
            playState={playState}
            currentTime={currentTime}
            duration={duration}
            onPlay={() => {
              setPlayState('playing');
              playlist.play();
            }}
            onPause={() => {
              setPlayState('paused');
              playlist.pause();
            }}
            onStop={() => {
              setPlayState('stopped');
              setCurrentTime(0);
              playlist.stop();
            }}
          />

          <div className="flex-1" />

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-slate-700 transition-colors"
              title="Fermer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Track controls sidebar */}
          <div
            className="flex-shrink-0 overflow-y-auto"
            style={{ width: DEFAULTS.trackControlsWidth, backgroundColor: colors.surface }}
          >
            <TrackList
              tracks={tracks}
              selectedTrackIds={selectedTrackIds}
              onSelectTrack={selectTrack}
              onMuteTrack={toggleMute}
              onSoloTrack={toggleSolo}
              onGainChange={setTrackGain}
              onPanChange={setTrackPan}
              onRemoveTrack={handleRemoveTrack}
              onAddTrack={handleAddTrack}
              theme={theme}
            />
          </div>

          {/* Timeline and waveforms */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline */}
            <Timeline
              duration={duration}
              currentTime={currentTime}
              zoom={zoom}
              scrollLeft={scrollLeft}
              selection={selection}
              markers={markers}
              onSeek={handleSeek}
              onSelectionChange={handleSelectionChange}
              theme={theme}
            />

            {/* Waveform area */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-x-auto overflow-y-hidden"
              onScroll={handleScroll}
            >
              <div
                ref={waveformContainerRef}
                className="h-full min-h-[200px]"
                style={{
                  width: duration * zoom,
                  minWidth: '100%',
                }}
              >
                {/* waveform-playlist will render here */}
                {tracks.length === 0 && (
                  <div
                    className="flex items-center justify-center h-full text-center"
                    style={{ color: colors.textMuted }}
                  >
                    <div>
                      <svg
                        className="w-16 h-16 mx-auto mb-4 opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <p className="text-lg mb-2">Aucune piste audio</p>
                      <p className="text-sm">
                        Cliquez sur "Ajouter une piste" pour commencer
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-4 py-1 text-xs border-t"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textMuted,
          }}
        >
          <div className="flex items-center gap-4">
            <span>
              Position: <span className="font-mono text-white">{formatTimeStatus(currentTime)}</span>
            </span>
            {selection && (
              <span>
                Selection: <span className="font-mono text-white">{formatTimeStatus(selection.end - selection.start)}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Duree: <span className="font-mono text-white">{formatTimeStatus(duration)}</span>
            </span>
            <span>
              Zoom: <span className="font-mono text-white">{zoom}px/s</span>
            </span>
            <span>
              Pistes: <span className="font-mono text-white">{tracks.length}</span>
            </span>
          </div>
        </div>

        {/* Export dialog */}
        <ExportDialog
          isOpen={isExportDialogOpen}
          duration={duration}
          onClose={() => setIsExportDialogOpen(false)}
          onExport={handleExport}
          isExporting={exportHook.isExporting}
          progress={exportHook.progress}
          theme={theme}
        />
      </div>
    );
  }
);

function formatTimeStatus(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
}
