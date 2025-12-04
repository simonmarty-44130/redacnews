'use client';

import React, { useCallback } from 'react';
import type { Track } from '../types/editor.types';
import { EDITOR_THEME } from '../constants/shortcuts';

interface TrackControlsProps {
  track: Track;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onGainChange: (gain: number) => void;
  onPanChange: (pan: number) => void;
  onRemove: () => void;
  theme?: 'light' | 'dark';
}

export function TrackControls({
  track,
  index,
  isSelected,
  onSelect,
  onMuteToggle,
  onSoloToggle,
  onGainChange,
  onPanChange,
  onRemove,
  theme = 'dark',
}: TrackControlsProps) {
  const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

  const handleGainChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onGainChange(parseFloat(e.target.value));
    },
    [onGainChange]
  );

  const handlePanChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPanChange(parseFloat(e.target.value));
    },
    [onPanChange]
  );

  return (
    <div
      className={`flex flex-col p-2 border-b transition-colors ${
        isSelected ? 'bg-slate-700' : 'bg-slate-800'
      }`}
      style={{
        borderColor: colors.border,
        borderLeftWidth: '4px',
        borderLeftColor: track.color || colors.waveform,
      }}
      onClick={onSelect}
    >
      {/* Track name and remove button */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-sm font-medium truncate flex-1"
          style={{ color: colors.text }}
          title={track.name}
        >
          {track.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 hover:bg-red-600/20 rounded transition-colors"
          title="Supprimer la piste"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Mute/Solo buttons */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMuteToggle();
          }}
          className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
            track.muted
              ? 'bg-red-600 text-white'
              : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
          }`}
          title="Mute (M)"
        >
          M
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSoloToggle();
          }}
          className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
            track.soloed
              ? 'bg-green-600 text-white'
              : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
          }`}
          title="Solo (Ctrl+M)"
        >
          S
        </button>
      </div>

      {/* Volume slider */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <label
            className="text-xs"
            style={{ color: colors.textMuted }}
          >
            Vol
          </label>
          <span
            className="text-xs font-mono"
            style={{ color: colors.textMuted }}
          >
            {Math.round((track.gain || 1) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={track.gain || 1}
          onChange={handleGainChange}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
          style={{
            accentColor: track.color || colors.waveform,
          }}
        />
      </div>

      {/* Pan slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            className="text-xs"
            style={{ color: colors.textMuted }}
          >
            Pan
          </label>
          <span
            className="text-xs font-mono"
            style={{ color: colors.textMuted }}
          >
            {formatPan(track.pan || 0)}
          </span>
        </div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={track.pan || 0}
          onChange={handlePanChange}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
          style={{
            accentColor: track.color || colors.waveform,
          }}
        />
      </div>
    </div>
  );
}

function formatPan(pan: number): string {
  if (pan === 0) return 'C';
  if (pan < 0) return `L${Math.abs(Math.round(pan * 100))}`;
  return `R${Math.round(pan * 100)}`;
}

// ============ Track List Component ============

interface TrackListProps {
  tracks: Track[];
  selectedTrackIds: string[];
  onSelectTrack: (trackId: string) => void;
  onMuteTrack: (trackId: string) => void;
  onSoloTrack: (trackId: string) => void;
  onGainChange: (trackId: string, gain: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onRemoveTrack: (trackId: string) => void;
  onAddTrack: () => void;
  theme?: 'light' | 'dark';
}

export function TrackList({
  tracks,
  selectedTrackIds,
  onSelectTrack,
  onMuteTrack,
  onSoloTrack,
  onGainChange,
  onPanChange,
  onRemoveTrack,
  onAddTrack,
  theme = 'dark',
}: TrackListProps) {
  const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ backgroundColor: colors.surface }}
    >
      {tracks.map((track, index) => (
        <TrackControls
          key={track.id}
          track={track}
          index={index}
          isSelected={selectedTrackIds.includes(track.id)}
          onSelect={() => onSelectTrack(track.id)}
          onMuteToggle={() => onMuteTrack(track.id)}
          onSoloToggle={() => onSoloTrack(track.id)}
          onGainChange={(gain) => onGainChange(track.id, gain)}
          onPanChange={(pan) => onPanChange(track.id, pan)}
          onRemove={() => onRemoveTrack(track.id)}
          theme={theme}
        />
      ))}

      {/* Add track button */}
      <button
        onClick={onAddTrack}
        className="flex items-center justify-center gap-2 p-3 m-2 border-2 border-dashed rounded-lg transition-colors hover:bg-slate-700/50"
        style={{
          borderColor: colors.border,
          color: colors.textMuted,
        }}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span className="text-sm">Ajouter une piste</span>
      </button>
    </div>
  );
}
