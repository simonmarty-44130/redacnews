'use client';

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
// Types are loaded dynamically to avoid SSR issues with peaks.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PeaksInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PeaksOptions = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SegmentOptions = any;
import { useEditorStore } from '../stores/editorStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TransportControls } from './TransportControls';
import { Toolbar } from './Toolbar';
import { TrackList } from './TrackControls';
import { ExportDialog } from './ExportDialog';
import { formatTime } from '../utils/time-format';
import { generateId } from '../utils/id';
import { exportWithRegions } from '../utils/export-regions';
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
    // ============ REFS ============
    const containerRef = useRef<HTMLDivElement>(null);
    const zoomviewRef = useRef<HTMLDivElement>(null);
    const overviewRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const peaksRef = useRef<PeaksInstance | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const tracksLoadedRef = useRef(false);
    const loadedTracksKeyRef = useRef<string>('');

    // ============ LOCAL STATE ============
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [isExporting, setIsExporting] = useState(false);

    // ============ STORE ============
    const tracks = useEditorStore((state) => state.tracks);
    const activeTrackId = useEditorStore((state) => state.activeTrackId);
    const montedDuration = useEditorStore((state) => state.montedDuration);
    const currentTime = useEditorStore((state) => state.currentTime);
    const playState = useEditorStore((state) => state.playState);
    const zoom = useEditorStore((state) => state.zoom);
    const selection = useEditorStore((state) => state.selection);
    const selectedTrackIds = useEditorStore((state) => state.selectedTrackIds);
    const canUndo = useEditorStore((state) => state.canUndo);
    const canRedo = useEditorStore((state) => state.canRedo);
    const inPoint = useEditorStore((state) => state.inPoint);
    const outPoint = useEditorStore((state) => state.outPoint);
    const cuePoints = useEditorStore((state) => state.cuePoints);

    const loadTracks = useEditorStore((state) => state.loadTracks);
    const addTrackStore = useEditorStore((state) => state.addTrack);
    const removeTrackStore = useEditorStore((state) => state.removeTrack);
    const setActiveTrack = useEditorStore((state) => state.setActiveTrack);
    const setPlayState = useEditorStore((state) => state.setPlayState);
    const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
    const setSelection = useEditorStore((state) => state.setSelection);
    const selectTrack = useEditorStore((state) => state.selectTrack);
    const toggleMute = useEditorStore((state) => state.toggleMute);
    const toggleSolo = useEditorStore((state) => state.toggleSolo);
    const setTrackGain = useEditorStore((state) => state.setTrackGain);
    const setTrackPan = useEditorStore((state) => state.setTrackPan);
    const zoomIn = useEditorStore((state) => state.zoomIn);
    const zoomOut = useEditorStore((state) => state.zoomOut);
    const zoomToFit = useEditorStore((state) => state.zoomToFit);
    const undo = useEditorStore((state) => state.undo);
    const redo = useEditorStore((state) => state.redo);
    const setInPoint = useEditorStore((state) => state.setInPoint);
    const setOutPoint = useEditorStore((state) => state.setOutPoint);
    const cutSelectionAction = useEditorStore((state) => state.cutSelectionAction);
    const splitAtCursor = useEditorStore((state) => state.splitAtCursor);
    const clearSelection = useEditorStore((state) => state.clearSelection);
    const recalculateMontedDuration = useEditorStore((state) => state.recalculateMontedDuration);

    // Active track
    const activeTrack = tracks.find((t) => t.id === activeTrackId);

    // Theme colors
    const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

    // ============ PEAKS.JS INITIALIZATION ============
    const [initRetry, setInitRetry] = useState(0);

    useEffect(() => {
      if (!zoomviewRef.current || !audioRef.current || !activeTrack) {
        return;
      }

      // Check if container is visible and has dimensions
      const rect = zoomviewRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Container not visible yet, retry after increasing delay (max 10 retries)
        if (initRetry < 10) {
          const delay = Math.min(100 * (initRetry + 1), 500);
          const retryTimeout = setTimeout(() => {
            setInitRetry(prev => prev + 1);
          }, delay);
          return () => clearTimeout(retryTimeout);
        }
        // After 10 retries, give up silently
        return;
      }

      // Reset retry counter on successful dimension check
      if (initRetry > 0) {
        setInitRetry(0);
      }

      // Cleanup previous instance
      if (peaksRef.current) {
        try {
          peaksRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying peaks:', e);
        }
        peaksRef.current = null;
      }

      setIsLoading(true);
      setError(null);
      setIsReady(false);

      // Set audio source
      audioRef.current.src = activeTrack.src;

      // Create AudioContext if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      const options: PeaksOptions = {
        zoomview: {
          container: zoomviewRef.current,
          waveformColor: colors.waveform,
          playedWaveformColor: colors.waveformSelected,
          playheadColor: colors.playhead,
          playheadTextColor: colors.text,
          axisLabelColor: colors.textMuted,
          axisGridlineColor: colors.border,
          timeLabelPrecision: 2,
        },
        ...(overviewRef.current && {
          overview: {
            container: overviewRef.current,
            waveformColor: colors.textMuted,
            playedWaveformColor: colors.waveform,
            playheadColor: colors.playhead,
            highlightColor: `${colors.selection}80`,
          },
        }),
        mediaElement: audioRef.current,
        webAudio: {
          audioContext: audioContextRef.current,
        },
        keyboard: false, // We handle shortcuts ourselves
        nudgeIncrement: 0.1,
        zoomLevels: [256, 512, 1024, 2048, 4096, 8192],
        logger: console.error.bind(console),
      };

      // Dynamically import peaks.js to avoid SSR issues
      import('peaks.js').then((PeaksModule) => {
        // Verify container still exists after async import
        if (!zoomviewRef.current) {
          setIsLoading(false);
          return;
        }

        // Re-check dimensions after async import - container might have been hidden/resized
        const containerRect = zoomviewRef.current.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
          // Container not visible yet, trigger retry
          setIsLoading(false);
          if (initRetry < 10) {
            setInitRetry(prev => prev + 1);
          }
          return;
        }

        const Peaks = PeaksModule.default;
        Peaks.init(options, (err, peaks) => {
        setIsLoading(false);

        if (err) {
          console.error('Peaks.js init error:', err);
          setError(err.message || 'Failed to initialize waveform');
          return;
        }

        if (!peaks) {
          setError('Peaks instance is null');
          return;
        }

        peaksRef.current = peaks;
        setIsReady(true);

        // Get duration from audio element
        const audioDuration = audioRef.current?.duration || 0;
        if (audioDuration > 0 && activeTrack.originalDuration === 0) {
          // Update track duration in store
          useEditorStore.getState().updateTrack(activeTrack.id, {
            originalDuration: audioDuration,
            regions: [
              {
                id: generateId(),
                startTime: 0,
                endTime: audioDuration,
                duration: audioDuration,
              },
            ],
          });
          recalculateMontedDuration();
        }

        // Event listeners
        peaks.on('player.timeupdate', (time: number) => {
          setCurrentTime(time);
        });

        peaks.on('player.playing', () => {
          setPlayState('playing');
        });

        peaks.on('player.pause', () => {
          setPlayState('paused');
        });

        peaks.on('player.ended', () => {
          setPlayState('stopped');
        });

        // Display regions as segments
        updatePeaksSegments(peaks, activeTrack);
        });
      }).catch((err) => {
        console.error('Failed to load peaks.js:', err);
        setIsLoading(false);
        setError('Failed to load audio editor');
      });

      return () => {
        if (peaksRef.current) {
          try {
            peaksRef.current.destroy();
          } catch (e) {
            console.warn('Error in cleanup:', e);
          }
          peaksRef.current = null;
        }
      };
    }, [activeTrack?.src, colors, initRetry]);

    // ============ SYNC REGIONS → PEAKS SEGMENTS ============
    const updatePeaksSegments = useCallback((peaks: PeaksInstance, track: Track) => {
      if (!peaks) return;

      const segments = peaks.segments;

      // Remove all existing segments
      segments.removeAll();

      // Add regions as segments
      track.regions.forEach((region, index) => {
        const segmentOptions: SegmentOptions = {
          id: region.id,
          startTime: region.startTime,
          endTime: region.endTime,
          labelText: region.label || `Region ${index + 1}`,
          color: `${colors.waveform}40`,
          editable: false,
        };
        segments.add(segmentOptions);
      });

      // Add IN point marker
      if (inPoint !== null) {
        peaks.points.removeAll();
        peaks.points.add({
          time: inPoint,
          labelText: 'IN',
          color: '#22C55E',
          editable: false,
        });
      }

      // Add OUT point marker
      if (outPoint !== null) {
        peaks.points.add({
          time: outPoint,
          labelText: 'OUT',
          color: '#EF4444',
          editable: false,
        });
      }
    }, [colors.waveform, inPoint, outPoint]);

    // Update segments when regions change
    useEffect(() => {
      if (peaksRef.current && activeTrack) {
        updatePeaksSegments(peaksRef.current, activeTrack);
      }
    }, [activeTrack?.regions, inPoint, outPoint, updatePeaksSegments]);

    // ============ LOAD INITIAL TRACKS ============
    useEffect(() => {
      if (initialTracks.length === 0 || tracks.length > 0) {
        return;
      }

      // Create a key from track sources to detect real changes
      const tracksKey = initialTracks.map((t) => t.src).join(',');
      if (tracksKey === loadedTracksKeyRef.current) {
        return;
      }

      loadedTracksKeyRef.current = tracksKey;
      tracksLoadedRef.current = true;

      // Load tracks by fetching their durations
      const loadTracksWithDuration = async () => {
        const tracksWithDuration = await Promise.all(
          initialTracks.map(async (trackData) => {
            const audio = new Audio();
            audio.src = trackData.src;

            const duration = await new Promise<number>((resolve) => {
              audio.onloadedmetadata = () => resolve(audio.duration || 0);
              audio.onerror = () => resolve(0);
            });

            return {
              id: trackData.id || generateId(),
              name: trackData.name,
              src: trackData.src,
              originalDuration: duration,
            };
          })
        );

        loadTracks(tracksWithDuration);
      };

      loadTracksWithDuration();
    }, [initialTracks, tracks.length, loadTracks]);

    // Notify parent of track changes
    useEffect(() => {
      onTracksChange?.(tracks);
    }, [tracks, onTracksChange]);

    // ============ TRANSPORT ACTIONS ============
    const handlePlay = useCallback(() => {
      if (peaksRef.current) {
        peaksRef.current.player.play();
      }
    }, []);

    const handlePause = useCallback(() => {
      if (peaksRef.current) {
        peaksRef.current.player.pause();
      }
    }, []);

    const handleStop = useCallback(() => {
      if (peaksRef.current) {
        peaksRef.current.player.pause();
        peaksRef.current.player.seek(0);
        setCurrentTime(0);
        setPlayState('stopped');
      }
    }, [setCurrentTime, setPlayState]);

    const handleSeek = useCallback(
      (time: number) => {
        if (peaksRef.current) {
          peaksRef.current.player.seek(time);
          setCurrentTime(time);
        }
      },
      [setCurrentTime]
    );

    // ============ ZOOM ACTIONS ============
    const handleZoomIn = useCallback(() => {
      if (peaksRef.current) {
        peaksRef.current.zoom.zoomIn();
      }
      zoomIn();
    }, [zoomIn]);

    const handleZoomOut = useCallback(() => {
      if (peaksRef.current) {
        peaksRef.current.zoom.zoomOut();
      }
      zoomOut();
    }, [zoomOut]);

    // ============ TRACK MANAGEMENT ============
    const handleAddTrack = useCallback(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;

        for (const file of Array.from(files)) {
          const url = URL.createObjectURL(file);
          const audio = new Audio();
          audio.src = url;

          const duration = await new Promise<number>((resolve) => {
            audio.onloadedmetadata = () => resolve(audio.duration || 0);
            audio.onerror = () => resolve(0);
          });

          addTrackStore({
            src: url,
            name: file.name.replace(/\.[^/.]+$/, ''),
            originalDuration: duration,
          });
        }
      };
      input.click();
    }, [addTrackStore]);

    const handleRemoveTrack = useCallback(
      (trackId: string) => {
        removeTrackStore(trackId);
      },
      [removeTrackStore]
    );

    // ============ EXPORT ============
    const handleExport = useCallback(
      async (options: ExportOptions, filename: string) => {
        if (!activeTrack) return;

        try {
          setIsExporting(true);
          setExportProgress(0);

          const result = await exportWithRegions(
            activeTrack,
            options,
            (progress) => setExportProgress(progress)
          );

          // Download the file
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.${options.format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

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
          setError('Export failed');
        } finally {
          setIsExporting(false);
          setExportProgress(0);
        }
      },
      [activeTrack, onSave]
    );

    // ============ KEYBOARD SHORTCUTS ============
    useKeyboardShortcuts({
      enabled: true,
      handlers: {
        onPlayPause: () => {
          if (playState === 'playing') handlePause();
          else handlePlay();
        },
        onStop: handleStop,
        onRewind: () => handleSeek(0),
        onFastForward: () => handleSeek(montedDuration || 0),
        onShuttleBack: () => handleSeek(Math.max(0, currentTime - 5)),
        onShuttleStop: handlePause,
        onShuttleForward: () => handleSeek(Math.min(montedDuration || 0, currentTime + 5)),
        onUndo: undo,
        onRedo: redo,
        onCut: cutSelectionAction,
        onCopy: () => {
          // TODO: Implement copy
          console.log('Copy not yet implemented');
        },
        onPaste: () => {
          // TODO: Implement paste
          console.log('Paste not yet implemented');
        },
        onDelete: cutSelectionAction,
        onSelectAll: () => {
          // Select entire track
          if (activeTrack) {
            setSelection({
              start: 0,
              end: montedDuration || 0,
              startTime: 0,
              endTime: montedDuration || 0,
            });
          }
        },
        onDeselect: clearSelection,
        onSplit: splitAtCursor,
        onSetCueIn: setInPoint,
        onSetCueOut: setOutPoint,
        onGoToCueIn: () => {
          if (inPoint !== null) handleSeek(inPoint);
        },
        onGoToCueOut: () => {
          if (outPoint !== null) handleSeek(outPoint);
        },
        onZoomIn: handleZoomIn,
        onZoomOut: handleZoomOut,
        onZoomFit: zoomToFit,
        onMuteTrack: () => {
          if (activeTrackId) toggleMute(activeTrackId);
        },
        onSoloTrack: () => {
          if (activeTrackId) toggleSolo(activeTrackId);
        },
        onSave: () => {
          console.log('Save triggered');
        },
        onExport: () => setIsExportDialogOpen(true),
      },
    });

    // ============ EXPOSE METHODS VIA REF ============
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          handlePlay();
        },
        pause: () => {
          handlePause();
        },
        stop: () => {
          handleStop();
        },
        seek: (time: number) => {
          handleSeek(time);
        },
        addTrack: (track) => {
          addTrackStore(track);
        },
        removeTrack: (trackId: string) => {
          removeTrackStore(trackId);
        },
        getState: () => useEditorStore.getState(),
        exportAudio: async (options: ExportOptions): Promise<ExportResult> => {
          if (!activeTrack) {
            throw new Error('No active track');
          }
          return exportWithRegions(activeTrack, options);
        },
        undo,
        redo,
        setInPoint,
        setOutPoint,
        cutSelection: cutSelectionAction,
        splitAtCursor,
      }),
      [
        handlePlay,
        handlePause,
        handleStop,
        handleSeek,
        addTrackStore,
        removeTrackStore,
        undo,
        redo,
        setInPoint,
        setOutPoint,
        cutSelectionAction,
        splitAtCursor,
        activeTrack,
      ]
    );

    // ============ RENDER ============
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
          hasSelection={inPoint !== null && outPoint !== null}
          onUndo={undo}
          onRedo={redo}
          onCut={cutSelectionAction}
          onCopy={() => console.log('Copy')}
          onPaste={() => console.log('Paste')}
          onDelete={cutSelectionAction}
          onSplit={splitAtCursor}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
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
            duration={montedDuration || 0}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
          />

          <div className="flex-1" />

          {/* I/O Points display */}
          <div className="flex items-center gap-4 mr-4">
            {inPoint !== null && (
              <span className="text-xs">
                <span className="text-green-500 font-bold">IN:</span>{' '}
                <span className="font-mono">{formatTime(inPoint)}</span>
              </span>
            )}
            {outPoint !== null && (
              <span className="text-xs">
                <span className="text-red-500 font-bold">OUT:</span>{' '}
                <span className="font-mono">{formatTime(outPoint)}</span>
              </span>
            )}
          </div>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-slate-700 transition-colors"
              title="Fermer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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
              selectedTrackIds={activeTrackId ? [activeTrackId] : []}
              onSelectTrack={(trackId) => {
                selectTrack(trackId);
                setActiveTrack(trackId);
              }}
              onMuteTrack={toggleMute}
              onSoloTrack={toggleSolo}
              onGainChange={setTrackGain}
              onPanChange={setTrackPan}
              onRemoveTrack={handleRemoveTrack}
              onAddTrack={handleAddTrack}
              theme={theme}
            />
          </div>

          {/* Waveform area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Error message */}
            {error && (
              <div
                className="p-3 text-sm"
                style={{ backgroundColor: '#EF444420', color: '#EF4444' }}
              >
                {error}
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center p-4" style={{ color: colors.textMuted }}>
                <svg
                  className="animate-spin h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Chargement de la waveform...
              </div>
            )}

            {/* Overview waveform */}
            <div
              ref={overviewRef}
              className="h-16 border-b"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.surface,
                // Don't use display:none as peaks.js needs visible container
                visibility: !activeTrack ? 'hidden' : 'visible',
              }}
            />

            {/* Main zoomview waveform */}
            <div
              ref={zoomviewRef}
              className="flex-1"
              style={{
                backgroundColor: colors.background,
                // Don't use display:none as peaks.js needs visible container
                // Use visibility instead to keep dimensions
                visibility: !activeTrack ? 'hidden' : 'visible',
                minHeight: '200px',
              }}
            />

            {/* Empty state */}
            {!activeTrack && !isLoading && (
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
                  <p className="text-sm">Cliquez sur "Ajouter une piste" pour commencer</p>
                </div>
              </div>
            )}

            {/* Hidden audio element */}
            <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
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
              Position: <span className="font-mono" style={{ color: colors.text }}>{formatTime(currentTime)}</span>
            </span>
            {selection && (
              <span>
                Selection:{' '}
                <span className="font-mono" style={{ color: colors.text }}>
                  {formatTime(selection.start)} - {formatTime(selection.end)}
                </span>
                <span className="ml-1">({formatTime(selection.end - selection.start)})</span>
              </span>
            )}
            {activeTrack && (
              <span>
                Regions: <span className="font-mono" style={{ color: colors.text }}>{activeTrack.regions.length}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Duree: <span className="font-mono" style={{ color: colors.text }}>{formatTime(montedDuration || 0)}</span>
            </span>
            <span>
              Pistes: <span className="font-mono" style={{ color: colors.text }}>{tracks.length}</span>
            </span>
            <span className="opacity-60">
              I = Point IN | O = Point OUT | X = Couper | S = Diviser
            </span>
          </div>
        </div>

        {/* Export dialog */}
        <ExportDialog
          isOpen={isExportDialogOpen}
          duration={montedDuration || 0}
          onClose={() => setIsExportDialogOpen(false)}
          onExport={handleExport}
          isExporting={isExporting}
          progress={exportProgress}
          theme={theme}
        />
      </div>
    );
  }
);

export default MultitrackEditor;
