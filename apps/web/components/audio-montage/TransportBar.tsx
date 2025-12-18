'use client';

import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  Save,
  Download,
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
  isSaving,
  hasUnsavedChanges,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onMasterVolumeChange,
  onSave,
  onExport,
}: TransportBarProps) {
  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 p-3 border-b bg-background">
      {/* Controles de lecture */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(0)}
          title="Retour au debut"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        {isPlaying ? (
          <Button
            variant="default"
            size="icon"
            onClick={onPause}
            title="Pause"
          >
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            onClick={onPlay}
            title="Lecture"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(duration)}
          title="Aller a la fin"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Affichage du temps */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-foreground">{formatTime(currentTime)}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{formatTime(duration)}</span>
      </div>

      {/* Barre de progression */}
      <div className="flex-1 px-4">
        <Slider
          value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
          onValueChange={([v]) => onSeek((v / 100) * duration)}
          max={100}
          step={0.1}
          className="cursor-pointer"
        />
      </div>

      {/* Volume master */}
      <div className="flex items-center gap-2 w-32">
        <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Slider
          value={[masterVolume * 100]}
          onValueChange={([v]) => onMasterVolumeChange(v / 100)}
          max={100}
          step={1}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Sauvegarde...' : hasUnsavedChanges ? 'Sauvegarder*' : 'Sauvegarder'}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onExport}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exporter
        </Button>
      </div>
    </div>
  );
}
