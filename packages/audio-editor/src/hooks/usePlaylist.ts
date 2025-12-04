/**
 * Hook principal pour l'integration de waveform-playlist
 */

import { useRef, useEffect, useCallback, useState } from 'react';
// @ts-ignore - waveform-playlist n'a pas de types officiels
import WaveformPlaylist from 'waveform-playlist';
import { useEditorStore } from '../stores/editorStore';
import type { Track, Selection, PlayState, ExportOptions, ExportResult } from '../types/editor.types';
import { DEFAULTS, EDITOR_THEME } from '../constants/shortcuts';
import { audioBufferToWav, audioBufferToMp3 } from '../utils/export-utils';

interface UsePlaylistOptions {
  container: HTMLElement | null;
  sampleRate?: number;
  samplesPerPixel?: number;
  mono?: boolean;
  waveHeight?: number;
  theme?: 'light' | 'dark';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventEmitterInstance = any;

interface PlaylistInstance {
  load: (tracks: unknown[]) => Promise<unknown>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number, percent?: number) => void;
  setTimeSelection: (start: number, end: number) => void;
  getTimeSelection: () => { start: number; end: number };
  getEventEmitter: () => EventEmitterInstance;
  getAudioContext: () => AudioContext;
  getTracks: () => unknown[];
  zoom: (samplesPerPixel: number) => void;
  setState: (state: string) => void;
  clear: () => void;
  addTrack: (track: unknown) => void;
  removeTrack: (trackId: string | number) => void;
  setTrackSolo: (trackId: string | number, solo: boolean) => void;
  setTrackMute: (trackId: string | number, mute: boolean) => void;
  setTrackGain: (trackId: string | number, gain: number) => void;
  setTrackPan?: (trackId: string | number, pan: number) => void;
  getTracksAudioBuffer?: () => Promise<AudioBuffer>;
  exportMix?: (options: unknown) => Promise<Blob>;
}

export interface UsePlaylistReturn {
  // State
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  playState: PlayState;
  selection: Selection | null;
  duration: number;

  // Actions
  loadTracks: (tracks: Track[]) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSelection: (start: number, end: number) => void;
  clearSelection: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (samplesPerPixel: number) => void;

  // Track actions
  addTrack: (track: Track) => Promise<void>;
  removeTrack: (trackId: string) => void;
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, soloed: boolean) => void;
  setTrackGain: (trackId: string, gain: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;

  // Export
  exportMix: (options: ExportOptions) => Promise<ExportResult>;

  // Utils
  getAudioContext: () => AudioContext | null;
}

const ZOOM_LEVELS = [500, 1000, 2000, 3000, 4000, 5000, 6000];

export function usePlaylist(options: UsePlaylistOptions): UsePlaylistReturn {
  const { container, sampleRate = DEFAULTS.sampleRate, samplesPerPixel = 1000, mono = false, waveHeight = DEFAULTS.waveHeight, theme = 'dark' } = options;

  const playlistRef = useRef<PlaylistInstance | null>(null);
  const eventEmitterRef = useRef<EventEmitterInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const zoomLevelIndexRef = useRef(2); // Default to 2000 samples per pixel

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playState, setPlayState] = useState<PlayState>('stopped');
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const [duration, setDuration] = useState(0);

  const themeColors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

  // Initialize playlist
  useEffect(() => {
    if (!container) return;

    try {
      const playlist = WaveformPlaylist({
        container,
        samplesPerPixel,
        sampleRate,
        mono,
        exclSolo: true,
        timescale: true,
        waveHeight,
        state: 'cursor',
        colors: {
          waveOutlineColor: themeColors.waveform,
          timeColor: themeColors.text,
          fadeColor: themeColors.selection,
        },
        controls: {
          show: false,
          width: 0,
        },
        seekStyle: 'line',
        isAutomaticScroll: true,
        zoomLevels: ZOOM_LEVELS,
      });

      playlistRef.current = playlist;
      eventEmitterRef.current = playlist.getEventEmitter();

      // Setup event listeners
      const ee = eventEmitterRef.current;

      ee.on('timeupdate', (time: number) => {
        setCurrentTime(time);
      });

      ee.on('finished', () => {
        setPlayState('stopped');
        setCurrentTime(0);
      });

      ee.on('select', (start: number, end: number) => {
        if (start !== end) {
          setSelectionState({ start, end });
        } else {
          setSelectionState(null);
        }
      });

      ee.on('statechange', (state: string) => {
        // waveform-playlist states: cursor, select, fadein, fadeout, shift
        // We map these to our playState
      });

      setIsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize playlist');
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (playlistRef.current) {
        playlistRef.current.clear();
      }
    };
  }, [container, sampleRate, samplesPerPixel, mono, waveHeight, themeColors]);

  // Load tracks
  const loadTracks = useCallback(async (tracks: Track[]) => {
    if (!playlistRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const playlistTracks = tracks.map((track, index) => ({
        src: track.src,
        name: track.name,
        start: track.start || 0,
        gain: track.gain || 1,
        muted: track.muted || false,
        soloed: track.soloed || false,
        fadeIn: track.fadeIn ? {
          shape: track.fadeIn.shape,
          duration: track.fadeIn.duration,
        } : undefined,
        fadeOut: track.fadeOut ? {
          shape: track.fadeOut.shape,
          duration: track.fadeOut.duration,
        } : undefined,
        customClass: `track-${index}`,
        waveOutlineColor: track.color || themeColors.trackColors[index % themeColors.trackColors.length],
      }));

      await playlistRef.current.load(playlistTracks);

      // Calculate total duration
      let maxDuration = 0;
      tracks.forEach(track => {
        const trackEnd = (track.start || 0) + (track.duration || 0);
        if (trackEnd > maxDuration) {
          maxDuration = trackEnd;
        }
      });
      setDuration(maxDuration || 60);

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
      setIsLoading(false);
    }
  }, [themeColors]);

  // Playback controls
  const play = useCallback(() => {
    if (playlistRef.current) {
      playlistRef.current.play();
      setPlayState('playing');
    }
  }, []);

  const pause = useCallback(() => {
    if (playlistRef.current) {
      playlistRef.current.pause();
      setPlayState('paused');
    }
  }, []);

  const stop = useCallback(() => {
    if (playlistRef.current) {
      playlistRef.current.stop();
      setPlayState('stopped');
      setCurrentTime(0);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (playlistRef.current) {
      playlistRef.current.seek(time, 0);
      setCurrentTime(time);
    }
  }, []);

  // Selection
  const setSelection = useCallback((start: number, end: number) => {
    if (playlistRef.current) {
      playlistRef.current.setTimeSelection(start, end);
      setSelectionState({ start, end });
    }
  }, []);

  const clearSelection = useCallback(() => {
    if (playlistRef.current) {
      playlistRef.current.setTimeSelection(0, 0);
      setSelectionState(null);
    }
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (playlistRef.current && zoomLevelIndexRef.current > 0) {
      zoomLevelIndexRef.current--;
      playlistRef.current.zoom(ZOOM_LEVELS[zoomLevelIndexRef.current]);
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (playlistRef.current && zoomLevelIndexRef.current < ZOOM_LEVELS.length - 1) {
      zoomLevelIndexRef.current++;
      playlistRef.current.zoom(ZOOM_LEVELS[zoomLevelIndexRef.current]);
    }
  }, []);

  const setZoom = useCallback((spp: number) => {
    if (playlistRef.current) {
      playlistRef.current.zoom(spp);
    }
  }, []);

  // Track actions
  const addTrack = useCallback(async (track: Track) => {
    if (!playlistRef.current) return;

    const playlistTrack = {
      src: track.src,
      name: track.name,
      start: track.start || 0,
      gain: track.gain || 1,
      muted: track.muted || false,
      soloed: track.soloed || false,
      waveOutlineColor: track.color || themeColors.waveform,
    };

    playlistRef.current.addTrack(playlistTrack);
  }, [themeColors]);

  const removeTrack = useCallback((trackId: string) => {
    if (playlistRef.current) {
      // waveform-playlist uses track index
      playlistRef.current.removeTrack(trackId);
    }
  }, []);

  const setTrackMute = useCallback((trackId: string, muted: boolean) => {
    if (playlistRef.current) {
      playlistRef.current.setTrackMute(trackId, muted);
    }
  }, []);

  const setTrackSolo = useCallback((trackId: string, soloed: boolean) => {
    if (playlistRef.current) {
      playlistRef.current.setTrackSolo(trackId, soloed);
    }
  }, []);

  const setTrackGain = useCallback((trackId: string, gain: number) => {
    if (playlistRef.current) {
      playlistRef.current.setTrackGain(trackId, gain);
    }
  }, []);

  const setTrackPan = useCallback((trackId: string, pan: number) => {
    if (playlistRef.current && playlistRef.current.setTrackPan) {
      playlistRef.current.setTrackPan(trackId, pan);
    }
  }, []);

  // Export
  const exportMix = useCallback(async (exportOptions: ExportOptions): Promise<ExportResult> => {
    if (!playlistRef.current) {
      throw new Error('Playlist not initialized');
    }

    // Get the audio context and create an offline render
    const audioContext = playlistRef.current.getAudioContext();

    // For now, we'll use a simple approach
    // In a full implementation, this would properly mix all tracks

    // Create an offline audio context for rendering
    const offlineContext = new OfflineAudioContext(
      2, // stereo
      Math.ceil(duration * exportOptions.sampleRate),
      exportOptions.sampleRate
    );

    // This is a simplified export - in production, you'd properly mix all tracks
    // For now, return an empty buffer as placeholder
    const renderedBuffer = await offlineContext.startRendering();

    let blob: Blob;
    if (exportOptions.format === 'wav') {
      blob = audioBufferToWav(renderedBuffer, exportOptions.bitDepth);
    } else {
      blob = await audioBufferToMp3(renderedBuffer, exportOptions.bitrate);
    }

    return {
      blob,
      duration: renderedBuffer.duration,
      metadata: {
        format: exportOptions.format,
        sampleRate: renderedBuffer.sampleRate,
        channels: renderedBuffer.numberOfChannels,
        size: blob.size,
      },
    };
  }, [duration]);

  // Utils
  const getAudioContext = useCallback(() => {
    return playlistRef.current?.getAudioContext() || null;
  }, []);

  return {
    // State
    isLoaded,
    isLoading,
    error,
    currentTime,
    playState,
    selection,
    duration,

    // Actions
    loadTracks,
    play,
    pause,
    stop,
    seek,
    setSelection,
    clearSelection,
    zoomIn,
    zoomOut,
    setZoom,

    // Track actions
    addTrack,
    removeTrack,
    setTrackMute,
    setTrackSolo,
    setTrackGain,
    setTrackPan,

    // Export
    exportMix,

    // Utils
    getAudioContext,
  };
}
