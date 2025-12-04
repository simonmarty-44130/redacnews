'use client';

import React from 'react';
import type { PlayState } from '../types/editor.types';
import { formatTime } from '../utils/time-format';

interface TransportControlsProps {
  playState: PlayState;
  currentTime: number;
  duration: number;
  canRecord?: boolean;
  isRecording?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord?: () => void;
  onStopRecord?: () => void;
  className?: string;
}

export function TransportControls({
  playState,
  currentTime,
  duration,
  canRecord = false,
  isRecording = false,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onStopRecord,
  className = '',
}: TransportControlsProps) {
  const isPlaying = playState === 'playing';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Rewind button */}
      <button
        onClick={onStop}
        className="p-2 rounded hover:bg-slate-700 transition-colors"
        title="Retour au debut (Home)"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Play/Pause button */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 transition-colors"
        title={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="p-2 rounded hover:bg-slate-700 transition-colors"
        title="Stop (Echap)"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" />
        </svg>
      </button>

      {/* Record button */}
      {canRecord && (
        <button
          onClick={isRecording ? onStopRecord : onRecord}
          className={`p-2 rounded transition-colors ${
            isRecording
              ? 'bg-red-600 hover:bg-red-500 animate-pulse'
              : 'hover:bg-slate-700'
          }`}
          title={isRecording ? 'Arreter enregistrement' : 'Enregistrer'}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </button>
      )}

      {/* Time display */}
      <div className="ml-4 font-mono text-sm">
        <span className="text-white">{formatTime(currentTime)}</span>
        <span className="text-slate-400 mx-1">/</span>
        <span className="text-slate-400">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
