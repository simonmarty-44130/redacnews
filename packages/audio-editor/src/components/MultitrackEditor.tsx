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
import { useEditorStore, selectCanUndo, selectCanRedo } from '../stores/editorStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TransportControls } from './TransportControls';
import { Toolbar } from './Toolbar';
import { TrackList } from './TrackControls';
import { ExportDialog } from './ExportDialog';
import { formatTime } from '../utils/time-format';
import { audioBufferToWav } from '../operations/cut';
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
    const tracksLoadedRef = useRef(false);
    const bufferVersionRef = useRef(0); // Track buffer changes

    // ============ LOCAL STATE ============
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [initRetry, setInitRetry] = useState(0);

    // ============ STORE ============
    const tracks = useEditorStore((state) => state.tracks);
    const activeTrackId = useEditorStore((state) => state.activeTrackId);
    const duration = useEditorStore((state) => state.duration);
    const currentTime = useEditorStore((state) => state.currentTime);
    const isPlaying = useEditorStore((state) => state.isPlaying);
    const zoom = useEditorStore((state) => state.zoom);
    const selection = useEditorStore((state) => state.selection);
    const inPoint = useEditorStore((state) => state.inPoint);
    const outPoint = useEditorStore((state) => state.outPoint);
    const canUndo = useEditorStore(selectCanUndo);
    const canRedo = useEditorStore(selectCanRedo);

    const loadTrack = useEditorStore((state) => state.loadTrack);
    const removeTrack = useEditorStore((state) => state.removeTrack);
    const setActiveTrack = useEditorStore((state) => state.setActiveTrack);
    const setPlaying = useEditorStore((state) => state.setPlaying);
    const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
    const toggleMute = useEditorStore((state) => state.toggleMute);
    const toggleSolo = useEditorStore((state) => state.toggleSolo);
    const setTrackGain = useEditorStore((state) => state.setTrackGain);
    const setTrackPan = useEditorStore((state) => state.setTrackPan);
    const zoomIn = useEditorStore((state) => state.zoomIn);
    const zoomOut = useEditorStore((state) => state.zoomOut);
    const setZoom = useEditorStore((state) => state.setZoom);
    const undo = useEditorStore((state) => state.undo);
    const redo = useEditorStore((state) => state.redo);
    const setInPoint = useEditorStore((state) => state.setInPoint);
    const setOutPoint = useEditorStore((state) => state.setOutPoint);
    const cutSelection = useEditorStore((state) => state.cutSelection);
    const trimToSelection = useEditorStore((state) => state.trimToSelection);
    const clearSelection = useEditorStore((state) => state.clearSelection);
    const initAudioContext = useEditorStore((state) => state.initAudioContext);
    const getAudioContext = useEditorStore((state) => state.getAudioContext);

    // Active track
    const activeTrack = tracks.find((t) => t.id === activeTrackId);

    // Theme colors
    const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

    // ============ RELOAD PEAKS WITH NEW BUFFER ============
    const reloadPeaksWithBuffer = useCallback(async (buffer: AudioBuffer) => {
      if (!zoomviewRef.current || !audioRef.current) return;

      console.log('=== Reloading peaks with new buffer ===');
      console.log('Buffer duration:', buffer.duration.toFixed(3));

      // Convert buffer to WAV blob
      const wavBlob = audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);

      // Update audio element
      audioRef.current.src = url;
      await new Promise<void>((resolve) => {
        audioRef.current!.onloadedmetadata = () => resolve();
        audioRef.current!.onerror = () => resolve();
      });

      // Destroy old peaks instance
      if (peaksRef.current) {
        try {
          peaksRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying peaks:', e);
        }
        peaksRef.current = null;
      }

      // Re-initialize peaks
      setIsReady(false);

      const audioContext = getAudioContext();
      if (!audioContext) return;

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
          audioContext,
        },
        keyboard: false,
        nudgeIncrement: 0.1,
        zoomLevels: [256, 512, 1024, 2048, 4096, 8192],
        logger: console.error.bind(console),
      };

      const PeaksModule = await import('peaks.js');
      const Peaks = PeaksModule.default;

      Peaks.init(options, (err: Error | null, peaks: PeaksInstance) => {
        if (err) {
          console.error('Peaks re-init error:', err);
          return;
        }

        if (!peaks) return;

        peaksRef.current = peaks;
        setIsReady(true);

        // Setup event listeners
        peaks.on('player.timeupdate', (time: number) => {
          setCurrentTime(time);
        });

        peaks.on('player.playing', () => {
          setPlaying(true);
        });

        peaks.on('player.pause', () => {
          setPlaying(false);
        });

        peaks.on('player.ended', () => {
          setPlaying(false);
        });

        peaks.on('zoomview.click', (event: { time: number }) => {
          setCurrentTime(event.time);
          peaks.player.seek(event.time);
        });

        // Update IN/OUT markers
        updatePeaksMarkers(peaks);

        console.log('=== Peaks reloaded ===');
      });
    }, [colors, getAudioContext, setCurrentTime, setPlaying]);

    // ============ UPDATE MARKERS ============
    const updatePeaksMarkers = useCallback((peaks: PeaksInstance) => {
      if (!peaks) return;

      peaks.points.removeAll();

      if (inPoint !== null) {
        peaks.points.add({
          time: inPoint,
          labelText: 'IN',
          color: '#22C55E',
          editable: false,
        });
      }
      if (outPoint !== null) {
        peaks.points.add({
          time: outPoint,
          labelText: 'OUT',
          color: '#EF4444',
          editable: false,
        });
      }

      // Add selection segment if both points exist
      if (inPoint !== null && outPoint !== null) {
        peaks.segments.removeAll();
        peaks.segments.add({
          id: 'selection',
          startTime: Math.min(inPoint, outPoint),
          endTime: Math.max(inPoint, outPoint),
          labelText: 'Sélection',
          color: 'rgba(239, 68, 68, 0.3)',
          editable: false,
        });
      } else {
        peaks.segments.removeAll();
      }
    }, [inPoint, outPoint]);

    // ============ PEAKS.JS INITIALIZATION ============
    useEffect(() => {
      if (!zoomviewRef.current || !audioRef.current || !activeTrack) {
        return;
      }

      // Check if container is visible
      const rect = zoomviewRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (initRetry < 10) {
          const delay = Math.min(100 * (initRetry + 1), 500);
          const retryTimeout = setTimeout(() => {
            setInitRetry((prev) => prev + 1);
          }, delay);
          return () => clearTimeout(retryTimeout);
        }
        return;
      }

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

      // Initialize audio context
      initAudioContext();

      // If track has an audioBuffer, create a blob URL from it
      // Otherwise use the src URL
      const setupAudio = async () => {
        if (activeTrack.audioBuffer) {
          const wavBlob = audioBufferToWav(activeTrack.audioBuffer);
          audioRef.current!.src = URL.createObjectURL(wavBlob);
        } else if (activeTrack.src) {
          audioRef.current!.src = activeTrack.src;
        } else {
          setIsLoading(false);
          setError('No audio source');
          return;
        }

        // Wait for audio to load
        await new Promise<void>((resolve) => {
          audioRef.current!.onloadedmetadata = () => resolve();
          audioRef.current!.onerror = () => resolve();
        });

        const audioContext = getAudioContext();

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
            audioContext: audioContext!,
          },
          keyboard: false,
          nudgeIncrement: 0.1,
          zoomLevels: [256, 512, 1024, 2048, 4096, 8192],
          logger: console.error.bind(console),
        };

        const PeaksModule = await import('peaks.js');
        const Peaks = PeaksModule.default;

        Peaks.init(options, (err: Error | null, peaks: PeaksInstance) => {
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

          // Event listeners
          peaks.on('player.timeupdate', (time: number) => {
            setCurrentTime(time);
          });

          peaks.on('player.playing', () => {
            setPlaying(true);
          });

          peaks.on('player.pause', () => {
            setPlaying(false);
          });

          peaks.on('player.ended', () => {
            setPlaying(false);
          });

          peaks.on('zoomview.click', (event: { time: number }) => {
            setCurrentTime(event.time);
            peaks.player.seek(event.time);
          });

          // Update markers
          updatePeaksMarkers(peaks);
        });
      };

      setupAudio().catch((err) => {
        console.error('Failed to setup audio:', err);
        setIsLoading(false);
        setError('Failed to load audio');
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
    }, [activeTrack?.id, colors, initRetry, initAudioContext, getAudioContext, setCurrentTime, setPlaying, updatePeaksMarkers]);

    // ============ WATCH FOR BUFFER CHANGES ============
    useEffect(() => {
      if (!activeTrack?.audioBuffer || !isReady) return;

      // Increment version to track changes
      const newVersion = bufferVersionRef.current + 1;
      bufferVersionRef.current = newVersion;

      // Debounce to avoid rapid reloads
      const timeout = setTimeout(() => {
        if (bufferVersionRef.current === newVersion) {
          reloadPeaksWithBuffer(activeTrack.audioBuffer!);
        }
      }, 100);

      return () => clearTimeout(timeout);
    }, [activeTrack?.audioBuffer, activeTrack?.duration]);

    // ============ UPDATE MARKERS ON POINT CHANGE ============
    useEffect(() => {
      if (peaksRef.current && isReady) {
        updatePeaksMarkers(peaksRef.current);
      }
    }, [inPoint, outPoint, isReady, updatePeaksMarkers]);

    // ============ LOAD INITIAL TRACKS ============
    useEffect(() => {
      if (initialTracks.length === 0 || tracksLoadedRef.current) {
        return;
      }

      tracksLoadedRef.current = true;

      const loadInitialTracks = async () => {
        for (const trackData of initialTracks) {
          await loadTrack(trackData.src, trackData.name);
        }
      };

      loadInitialTracks();
    }, [initialTracks, loadTrack]);

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
        setPlaying(false);
      }
    }, [setCurrentTime, setPlaying]);

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

    const handleZoomFit = useCallback(() => {
      setZoom(DEFAULTS.zoom);
    }, [setZoom]);

    // ============ FULLSCREEN ============
    const handleFullscreen = useCallback(() => {
      if (!containerRef.current) return;

      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    }, [isFullscreen]);

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    }, []);

    // ============ TRACK MANAGEMENT ============
    const handleAddTrack = useCallback(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const url = URL.createObjectURL(file);
        await loadTrack(url, file.name.replace(/\.[^/.]+$/, ''));
      };
      input.click();
    }, [loadTrack]);

    const handleRemoveTrack = useCallback(
      (trackId: string) => {
        removeTrack(trackId);
      },
      [removeTrack]
    );

    // ============ EXPORT ============
    const handleExport = useCallback(
      async (options: ExportOptions, filename: string) => {
        if (!activeTrack?.audioBuffer) return;

        try {
          setIsExporting(true);
          setExportProgress(0);

          setExportProgress(50);

          // For destructive editing, the buffer IS the final result
          const blob = audioBufferToWav(activeTrack.audioBuffer);

          setExportProgress(100);

          // Download the file
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.${options.format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setIsExportDialogOpen(false);

          if (onSave) {
            await onSave(blob, {
              title: filename,
              duration: activeTrack.duration,
              format: options.format,
              sampleRate: activeTrack.audioBuffer.sampleRate,
              channels: activeTrack.audioBuffer.numberOfChannels,
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
          if (isPlaying) handlePause();
          else handlePlay();
        },
        onStop: handleStop,
        onRewind: () => handleSeek(0),
        onFastForward: () => handleSeek(duration || 0),
        onShuttleBack: () => handleSeek(Math.max(0, currentTime - 5)),
        onShuttleStop: handlePause,
        onShuttleForward: () => handleSeek(Math.min(duration || 0, currentTime + 5)),
        onUndo: undo,
        onRedo: redo,
        onCut: cutSelection,
        onCopy: () => console.log('Copy not implemented'),
        onPaste: () => console.log('Paste not implemented'),
        onDelete: cutSelection,
        onSelectAll: () => {
          if (activeTrack) {
            setInPoint(0);
            setOutPoint(duration);
          }
        },
        onDeselect: clearSelection,
        onSplit: () => console.log('Split not implemented in destructive mode'),
        onSetCueIn: () => {
          if (peaksRef.current) {
            const peaksTime = peaksRef.current.player.getCurrentTime();
            console.log('>>> I pressed:', peaksTime.toFixed(3));
            setInPoint(peaksTime);
          }
        },
        onSetCueOut: () => {
          if (peaksRef.current) {
            const peaksTime = peaksRef.current.player.getCurrentTime();
            console.log('>>> O pressed:', peaksTime.toFixed(3));
            setOutPoint(peaksTime);
          }
        },
        onGoToCueIn: () => {
          if (inPoint !== null) handleSeek(inPoint);
        },
        onGoToCueOut: () => {
          if (outPoint !== null) handleSeek(outPoint);
        },
        onZoomIn: handleZoomIn,
        onZoomOut: handleZoomOut,
        onZoomFit: handleZoomFit,
        onMuteTrack: () => {
          if (activeTrackId) toggleMute(activeTrackId);
        },
        onSoloTrack: () => {
          if (activeTrackId) toggleSolo(activeTrackId);
        },
        onSave: () => console.log('Save'),
        onExport: () => setIsExportDialogOpen(true),
        onFullscreen: handleFullscreen,
      },
    });

    // ============ EXPOSE METHODS VIA REF ============
    useImperativeHandle(
      ref,
      () => ({
        play: handlePlay,
        pause: handlePause,
        stop: handleStop,
        seek: handleSeek,
        addTrack: async (track) => {
          await loadTrack(track.src, track.name);
        },
        removeTrack: handleRemoveTrack,
        getState: () => useEditorStore.getState(),
        exportAudio: async (options: ExportOptions): Promise<ExportResult> => {
          if (!activeTrack?.audioBuffer) {
            throw new Error('No active track');
          }
          const blob = audioBufferToWav(activeTrack.audioBuffer);
          return {
            blob,
            duration: activeTrack.duration,
            metadata: {
              format: options.format,
              sampleRate: activeTrack.audioBuffer.sampleRate,
              channels: activeTrack.audioBuffer.numberOfChannels,
              size: blob.size,
            },
          };
        },
        undo,
        redo,
        setInPoint,
        setOutPoint,
        cutSelection,
        splitAtCursor: () => console.log('Split not implemented'),
      }),
      [handlePlay, handlePause, handleStop, handleSeek, loadTrack, handleRemoveTrack, undo, redo, setInPoint, setOutPoint, cutSelection, activeTrack]
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
          isFullscreen={isFullscreen}
          onUndo={undo}
          onRedo={redo}
          onCut={cutSelection}
          onCopy={() => console.log('Copy')}
          onPaste={() => console.log('Paste')}
          onDelete={cutSelection}
          onSplit={() => console.log('Split')}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomFit={handleZoomFit}
          onExport={() => setIsExportDialogOpen(true)}
          onFullscreen={handleFullscreen}
        />

        {/* Transport controls */}
        <div
          className="flex items-center px-4 py-2 border-b"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <TransportControls
            playState={isPlaying ? 'playing' : 'stopped'}
            currentTime={currentTime}
            duration={duration || 0}
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
            {inPoint !== null && outPoint !== null && (
              <span className="text-xs text-yellow-500">
                <span className="font-mono">
                  ({formatTime(Math.abs(outPoint - inPoint))})
                </span>
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
                visibility: !activeTrack ? 'hidden' : 'visible',
              }}
            />

            {/* Main zoomview waveform */}
            <div
              ref={zoomviewRef}
              className="flex-1"
              style={{
                backgroundColor: colors.background,
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
                Sélection:{' '}
                <span className="font-mono" style={{ color: colors.text }}>
                  {formatTime(selection.startTime)} - {formatTime(selection.endTime)}
                </span>
                <span className="ml-1">({formatTime(selection.endTime - selection.startTime)})</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Durée: <span className="font-mono" style={{ color: colors.text }}>{formatTime(duration || 0)}</span>
            </span>
            <span>
              Pistes: <span className="font-mono" style={{ color: colors.text }}>{tracks.length}</span>
            </span>
            <span className="opacity-60">
              I = Point IN | O = Point OUT | X = Couper
            </span>
          </div>
        </div>

        {/* Export dialog */}
        <ExportDialog
          isOpen={isExportDialogOpen}
          duration={duration || 0}
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
