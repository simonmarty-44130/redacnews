'use client';

/**
 * Barre de transport : play/pause, position, durée, scrubbing.
 * Pilote la lecture via l'API player de peaks.js ; l'état (temps, lecture) est
 * mirroré dans le store pour rester synchrone avec la waveform.
 *
 * Port du composant Tanguy, re-stylé en thème slate sombre.
 */
import { useEffect } from 'react';
import type { PeaksInstance } from 'peaks.js';
import { Pause, Play } from 'lucide-react';
import { useAudioEditorStore } from '@/lib/audio-editor/store';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TransportBar({ peaks }: { peaks: PeaksInstance | null }) {
  const isPlaying = useAudioEditorStore((s) => s.isPlaying);
  const currentTime = useAudioEditorStore((s) => s.currentTime);
  const duration = useAudioEditorStore((s) => s.durationSeconds);
  const setCurrentTime = useAudioEditorStore((s) => s.setCurrentTime);
  const setIsPlaying = useAudioEditorStore((s) => s.setIsPlaying);
  const setDuration = useAudioEditorStore((s) => s.setDuration);

  useEffect(() => {
    if (!peaks) return;
    const onTime = (t: number) => setCurrentTime(t);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    peaks.on('player.timeupdate', onTime);
    peaks.on('player.playing', onPlay);
    peaks.on('player.pause', onPause);
    peaks.on('player.ended', onEnded);

    const d = peaks.player.getDuration();
    if (Number.isFinite(d) && d > 0) setDuration(d);

    return () => {
      peaks.off('player.timeupdate', onTime);
      peaks.off('player.playing', onPlay);
      peaks.off('player.pause', onPause);
      peaks.off('player.ended', onEnded);
    };
  }, [peaks, setCurrentTime, setIsPlaying, setDuration]);

  const toggle = () => {
    if (!peaks) return;
    if (isPlaying) peaks.player.pause();
    else void peaks.player.play();
  };

  const handleSeek = (value: number) => {
    if (peaks) peaks.player.seek(value);
    setCurrentTime(value);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={!peaks}
        aria-label={isPlaying ? 'Pause' : 'Lecture'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => handleSeek(parseFloat(e.target.value))}
        disabled={!peaks}
        className="flex-1 cursor-pointer accent-blue-500"
      />

      <span className="min-w-[78px] text-right tabular-nums text-[12px] text-slate-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
