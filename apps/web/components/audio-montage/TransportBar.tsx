'use client';

import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TransportBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  masterVolume: number;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onMasterVolumeChange: (volume: number) => void;
  onSave: () => void;
  onExport: () => void;
}

export function TransportBar({
  isPlaying,
  currentTime,
  duration,
  masterVolume,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onMasterVolumeChange,
}: TransportBarProps) {
  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="flex items-center justify-center gap-6 px-4 py-3 bg-[#111111] border-b border-[#2a2a2a]">
      {/* Controles de lecture */}
      <div className="flex items-center gap-2">
        {/* Retour au début */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(0)}
          title="Retour au debut"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        {/* Stop */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          title="Stop"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
        >
          <Square className="h-4 w-4" />
        </Button>

        {/* Bouton Play/Pause circulaire bleu */}
        {isPlaying ? (
          <Button
            size="icon"
            onClick={onPause}
            title="Pause (Espace)"
            className="h-12 w-12 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-lg shadow-blue-500/30"
          >
            <Pause className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={onPlay}
            title="Lecture (Espace)"
            className="h-12 w-12 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-lg shadow-blue-500/30"
          >
            <Play className="h-5 w-5 ml-0.5" />
          </Button>
        )}

        {/* Aller à la fin */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(duration)}
          title="Aller a la fin"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Affichage du temps - style timecode */}
      <div className="flex items-center gap-3 bg-[#0a0a0a] px-4 py-2 rounded-lg border border-[#2a2a2a]">
        <span className="font-mono text-xl text-white tracking-wider">{formatTime(currentTime)}</span>
        <span className="text-gray-500">/</span>
        <span className="font-mono text-xl text-gray-400 tracking-wider">{formatTime(duration)}</span>
      </div>

      {/* Volume master */}
      <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-2 rounded-lg">
        <Volume2 className="h-4 w-4 text-gray-400 shrink-0" />
        <Slider
          value={[masterVolume * 100]}
          onValueChange={([v]) => onMasterVolumeChange(v / 100)}
          max={100}
          step={1}
          className="w-24 [&>span:first-child]:bg-[#2a2a2a] [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-[#3B82F6]"
        />
        <span className="text-xs text-gray-400 w-8 text-right font-mono">
          {Math.round(masterVolume * 100)}%
        </span>
      </div>
    </div>
  );
}
