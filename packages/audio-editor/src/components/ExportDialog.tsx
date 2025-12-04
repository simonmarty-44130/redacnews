'use client';

import React, { useState, useCallback } from 'react';
import type { ExportOptions, ExportFormat } from '../types/editor.types';
import { formatTime } from '../utils/time-format';
import { formatFileSize, estimateFileSize } from '../utils/export-utils';
import { EDITOR_THEME } from '../constants/shortcuts';

interface ExportDialogProps {
  isOpen: boolean;
  duration: number;
  onClose: () => void;
  onExport: (options: ExportOptions, filename: string) => void;
  isExporting?: boolean;
  progress?: number;
  theme?: 'light' | 'dark';
}

export function ExportDialog({
  isOpen,
  duration,
  onClose,
  onExport,
  isExporting = false,
  progress = 0,
  theme = 'dark',
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [sampleRate, setSampleRate] = useState<44100 | 48000>(48000);
  const [bitDepth, setBitDepth] = useState<16 | 24>(16);
  const [bitrate, setBitrate] = useState<128 | 192 | 256 | 320>(320);
  const [normalize, setNormalize] = useState(true);
  const [normalizeTarget, setNormalizeTarget] = useState(-16);
  const [filename, setFilename] = useState('');

  const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

  // Estimate file size
  const estimatedSize = estimateFileSize(
    duration,
    2, // stereo
    sampleRate,
    format,
    format === 'wav' ? bitDepth : undefined,
    format === 'mp3' ? bitrate : undefined
  );

  const handleExport = useCallback(() => {
    const options: ExportOptions = {
      format,
      sampleRate,
      bitDepth: format === 'wav' ? bitDepth : undefined,
      bitrate: format === 'mp3' ? bitrate : undefined,
      normalize,
      normalizeTarget: normalize ? normalizeTarget : undefined,
    };

    const exportFilename = filename || `export_${Date.now()}`;
    onExport(options, exportFilename);
  }, [format, sampleRate, bitDepth, bitrate, normalize, normalizeTarget, filename, onExport]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-md rounded-lg shadow-xl"
        style={{ backgroundColor: colors.surface }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            Exporter l'audio
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700"
            disabled={isExporting}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Filename */}
          <div>
            <label className="block text-sm mb-1" style={{ color: colors.textMuted }}>
              Nom du fichier
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="export"
              className="w-full px-3 py-2 rounded border bg-slate-700 text-white"
              style={{ borderColor: colors.border }}
              disabled={isExporting}
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm mb-1" style={{ color: colors.textMuted }}>
              Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('wav')}
                className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                  format === 'wav'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
                disabled={isExporting}
              >
                WAV
              </button>
              <button
                onClick={() => setFormat('mp3')}
                className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                  format === 'mp3'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
                disabled={isExporting}
              >
                MP3
              </button>
            </div>
          </div>

          {/* Sample Rate */}
          <div>
            <label className="block text-sm mb-1" style={{ color: colors.textMuted }}>
              Frequence d'echantillonnage
            </label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value) as 44100 | 48000)}
              className="w-full px-3 py-2 rounded border bg-slate-700 text-white"
              style={{ borderColor: colors.border }}
              disabled={isExporting}
            >
              <option value={44100}>44.1 kHz (CD)</option>
              <option value={48000}>48 kHz (Broadcast)</option>
            </select>
          </div>

          {/* Bit Depth (WAV only) */}
          {format === 'wav' && (
            <div>
              <label className="block text-sm mb-1" style={{ color: colors.textMuted }}>
                Profondeur de bits
              </label>
              <select
                value={bitDepth}
                onChange={(e) => setBitDepth(Number(e.target.value) as 16 | 24)}
                className="w-full px-3 py-2 rounded border bg-slate-700 text-white"
                style={{ borderColor: colors.border }}
                disabled={isExporting}
              >
                <option value={16}>16-bit</option>
                <option value={24}>24-bit</option>
              </select>
            </div>
          )}

          {/* Bitrate (MP3 only) */}
          {format === 'mp3' && (
            <div>
              <label className="block text-sm mb-1" style={{ color: colors.textMuted }}>
                Debit binaire
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(Number(e.target.value) as 128 | 192 | 256 | 320)}
                className="w-full px-3 py-2 rounded border bg-slate-700 text-white"
                style={{ borderColor: colors.border }}
                disabled={isExporting}
              >
                <option value={128}>128 kbps</option>
                <option value={192}>192 kbps</option>
                <option value={256}>256 kbps</option>
                <option value={320}>320 kbps (Haute qualite)</option>
              </select>
            </div>
          )}

          {/* Normalization */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={isExporting}
              />
              <span className="text-sm" style={{ color: colors.text }}>
                Normaliser le volume
              </span>
            </label>
            {normalize && (
              <div className="mt-2 ml-6">
                <label className="block text-sm mb-1" style={{ color: colors.textMuted }}>
                  Niveau cible (LUFS)
                </label>
                <select
                  value={normalizeTarget}
                  onChange={(e) => setNormalizeTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded border bg-slate-700 text-white"
                  style={{ borderColor: colors.border }}
                  disabled={isExporting}
                >
                  <option value={-14}>-14 LUFS (Streaming)</option>
                  <option value={-16}>-16 LUFS (Radio Broadcast)</option>
                  <option value={-23}>-23 LUFS (EBU R128)</option>
                </select>
              </div>
            )}
          </div>

          {/* Info */}
          <div
            className="p-3 rounded text-sm"
            style={{ backgroundColor: colors.background }}
          >
            <div className="flex justify-between mb-1">
              <span style={{ color: colors.textMuted }}>Duree:</span>
              <span style={{ color: colors.text }}>{formatTime(duration)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: colors.textMuted }}>Taille estimee:</span>
              <span style={{ color: colors.text }}>{formatFileSize(estimatedSize)}</span>
            </div>
          </div>

          {/* Progress bar */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: colors.textMuted }}>Export en cours...</span>
                <span style={{ color: colors.text }}>{Math.round(progress)}%</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: colors.background }}
              >
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: colors.border }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded font-medium transition-colors bg-slate-700 hover:bg-slate-600"
            style={{ color: colors.text }}
            disabled={isExporting}
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white"
            disabled={isExporting}
          >
            {isExporting ? 'Export...' : 'Exporter'}
          </button>
        </div>
      </div>
    </div>
  );
}
