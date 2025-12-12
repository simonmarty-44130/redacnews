'use client';

import { Scissors, MousePointer2, Mic, CornerDownLeft, CornerDownRight, X, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onImport: () => void;
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
  onImport,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        {/* Mode d'édition */}
        <div className="flex items-center gap-1 p-1 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-8 p-0',
                  editMode === 'select'
                    ? 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                )}
                onClick={() => onEditModeChange('select')}
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <p>Mode Sélection (V)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-8 p-0',
                  editMode === 'razor'
                    ? 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                )}
                onClick={() => onEditModeChange('razor')}
              >
                <Scissors className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <p>Mode Rasoir (R)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="h-6 w-px bg-[#2a2a2a]" />

        {/* Points In/Out */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-3 gap-1.5',
                  inPoint !== null
                    ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/50'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                )}
                onClick={onSetInPoint}
              >
                <CornerDownRight className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">In</span>
                {inPoint !== null && (
                  <span className="text-[10px] ml-1 opacity-80 font-mono">
                    {formatTime(inPoint)}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <p>Définir point In (I)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-3 gap-1.5',
                  outPoint !== null
                    ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/50'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                )}
                onClick={onSetOutPoint}
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Out</span>
                {outPoint !== null && (
                  <span className="text-[10px] ml-1 opacity-80 font-mono">
                    {formatTime(outPoint)}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <p>Définir point Out (O)</p>
            </TooltipContent>
          </Tooltip>

          {(inPoint !== null || outPoint !== null) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500 hover:text-white hover:bg-[#2a2a2a]"
                  onClick={onClearInOutPoints}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                <p>Effacer In/Out (Esc)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="h-6 w-px bg-[#2a2a2a]" />

        {/* Couper */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 gap-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
              onClick={onCut}
            >
              <Scissors className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Couper</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
            <p>Couper à la playhead (X)</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-[#2a2a2a]" />

        {/* Importer */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 gap-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
              onClick={onImport}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Importer</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
            <p>Importer un son</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Indicateur d'enregistrement */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-lg border border-red-500/50">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <Mic className="h-4 w-4 text-red-400" />
            <span className="text-xs font-medium text-red-400">Enregistrement...</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
