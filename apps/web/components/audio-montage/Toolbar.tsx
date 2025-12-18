'use client';

import { Scissors, MousePointer2, Mic, CornerDownLeft, CornerDownRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  editMode: 'select' | 'razor';
  inPoint: number | null;
  outPoint: number | null;
  isRecording: boolean;
  recordingTrackId: string | null;
  onEditModeChange: (mode: 'select' | 'razor') => void;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onClearInOutPoints: () => void;
  onCut: () => void;
}

// Formater le temps en MM:SS.ms
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function Toolbar({
  editMode,
  inPoint,
  outPoint,
  isRecording,
  onEditModeChange,
  onSetInPoint,
  onSetOutPoint,
  onClearInOutPoints,
  onCut,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30 border-b">
        {/* Mode d'édition */}
        <div className="flex items-center gap-0.5 p-0.5 bg-background rounded-md border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={editMode === 'select' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onEditModeChange('select')}
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Mode Selection (V)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={editMode === 'razor' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onEditModeChange('razor')}
              >
                <Scissors className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Mode Rasoir (R)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Points In/Out */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2 gap-1',
                  inPoint !== null && 'bg-blue-500/20 text-blue-600'
                )}
                onClick={onSetInPoint}
              >
                <CornerDownRight className="h-3 w-3" />
                <span className="text-xs font-medium">In</span>
                {inPoint !== null && (
                  <span className="text-[10px] ml-1 opacity-70">
                    {formatTime(inPoint)}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Definir point In (I)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2 gap-1',
                  outPoint !== null && 'bg-blue-500/20 text-blue-600'
                )}
                onClick={onSetOutPoint}
              >
                <CornerDownLeft className="h-3 w-3" />
                <span className="text-xs font-medium">Out</span>
                {outPoint !== null && (
                  <span className="text-[10px] ml-1 opacity-70">
                    {formatTime(outPoint)}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Definir point Out (O)</p>
            </TooltipContent>
          </Tooltip>

          {(inPoint !== null || outPoint !== null) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={onClearInOutPoints}
                >
                  <X className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Effacer In/Out (Esc)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Couper */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={onCut}
            >
              <Scissors className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Couper</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Couper a la playhead (X)</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Indicateur d'enregistrement */}
        {isRecording && (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 rounded text-red-600">
            <Mic className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-medium">Enregistrement...</span>
          </div>
        )}

        {/* Raccourcis clavier */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Space: Play/Pause</span>
          <span>|</span>
          <span>I/O: In/Out</span>
          <span>|</span>
          <span>X: Cut</span>
          <span>|</span>
          <span>R: Razor</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
