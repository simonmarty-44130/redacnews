'use client';

import { Keyboard, Clock, Layers, MousePointer2, Scissors } from 'lucide-react';

interface StatusBarProps {
  currentTime: number;
  duration: number;
  trackCount: number;
  clipCount: number;
  editMode: 'select' | 'razor';
  zoom: number;
}

// Formater le temps en MM:SS.ms
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function StatusBar({
  currentTime,
  duration,
  trackCount,
  clipCount,
  editMode,
  zoom,
}: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-[#111111] border-t border-[#2a2a2a] text-xs">
      {/* Gauche - Position et durée */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="h-3 w-3" />
          <span className="font-mono text-gray-300">{formatTime(currentTime)}</span>
          <span className="text-gray-600">/</span>
          <span className="font-mono text-gray-500">{formatTime(duration)}</span>
        </div>

        <div className="h-3 w-px bg-[#2a2a2a]" />

        <div className="flex items-center gap-2 text-gray-400">
          <Layers className="h-3 w-3" />
          <span>{trackCount} piste{trackCount > 1 ? 's' : ''}</span>
          <span className="text-gray-600">•</span>
          <span>{clipCount} clip{clipCount > 1 ? 's' : ''}</span>
        </div>

        <div className="h-3 w-px bg-[#2a2a2a]" />

        <div className="flex items-center gap-2 text-gray-400">
          {editMode === 'select' ? (
            <>
              <MousePointer2 className="h-3 w-3 text-[#3B82F6]" />
              <span className="text-[#3B82F6]">Sélection</span>
            </>
          ) : (
            <>
              <Scissors className="h-3 w-3 text-amber-400" />
              <span className="text-amber-400">Rasoir</span>
            </>
          )}
        </div>

        <div className="h-3 w-px bg-[#2a2a2a]" />

        <div className="flex items-center gap-1 text-gray-500">
          <span className="font-mono">{Math.round(zoom)}px/s</span>
        </div>
      </div>

      {/* Droite - Raccourcis clavier */}
      <div className="flex items-center gap-4 text-gray-500">
        <div className="flex items-center gap-1.5">
          <Keyboard className="h-3 w-3" />
          <span>Raccourcis:</span>
        </div>
        <div className="flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono">Espace</kbd> Play</span>
          <span><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono">I</kbd><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono ml-0.5">O</kbd> In/Out</span>
          <span><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono">X</kbd> Cut</span>
          <span><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono">R</kbd> Rasoir</span>
          <span><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono">Del</kbd> Suppr</span>
          <span><kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded text-[10px] font-mono">Ctrl+S</kbd> Sauver</span>
        </div>
      </div>
    </div>
  );
}
