'use client';

import { Volume2, VolumeX, Headphones, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { TRACK_CONTROLS_WIDTH, TRACK_HEIGHT } from '@/lib/audio-montage/constants';
import type { Track } from '@/lib/audio-montage/types';

interface TrackControlsProps {
  track: Track;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onDelete: () => void;
  onNameChange: (name: string) => void;
}

export function TrackControls({
  track,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onDelete,
  onNameChange,
}: TrackControlsProps) {
  return (
    <div
      className="flex flex-col border-r border-border bg-muted/30 p-2"
      style={{ width: TRACK_CONTROLS_WIDTH, height: TRACK_HEIGHT }}
    >
      {/* Header avec nom et couleur */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: track.color }}
        />
        <input
          type="text"
          value={track.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="text-sm font-medium bg-transparent border-none outline-none flex-1 min-w-0 truncate"
          title={track.name}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Boutons Mute / Solo */}
      <div className="flex gap-1 mb-2">
        <Button
          variant={track.muted ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-6 px-2 text-xs font-medium',
            track.muted && 'bg-yellow-500 hover:bg-yellow-600 text-white'
          )}
          onClick={onMuteToggle}
        >
          {track.muted ? <VolumeX className="h-3 w-3 mr-1" /> : null}
          M
        </Button>
        <Button
          variant={track.solo ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-6 px-2 text-xs font-medium',
            track.solo && 'bg-green-500 hover:bg-green-600 text-white'
          )}
          onClick={onSoloToggle}
        >
          {track.solo ? <Headphones className="h-3 w-3 mr-1" /> : null}
          S
        </Button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 mb-1">
        <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
        <Slider
          value={[track.volume * 100]}
          onValueChange={([v]) => onVolumeChange(v / 100)}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right">
          {Math.round(track.volume * 100)}
        </span>
      </div>

      {/* Pan */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-4">L</span>
        <Slider
          value={[track.pan * 50 + 50]}
          onValueChange={([v]) => onPanChange((v - 50) / 50)}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-4">R</span>
      </div>
    </div>
  );
}
