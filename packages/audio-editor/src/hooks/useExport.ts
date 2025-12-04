/**
 * Hook pour l'export audio (WAV et MP3)
 */

import { useState, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import type { ExportOptions, ExportResult, ExportMetadata } from '../types/editor.types';
import {
  audioBufferToWav,
  audioBufferToMp3,
  exportAudioBuffer,
  downloadBlob,
  formatFileSize,
  estimateFileSize,
} from '../utils/export-utils';
import { normalizeToLUFS, normalizeToPeak } from '../effects/normalizer';
import { compressBuffer, COMPRESSOR_PRESETS } from '../effects/compressor';

export interface UseExportReturn {
  // State
  isExporting: boolean;
  progress: number;
  error: string | null;

  // Actions
  exportToFile: (
    audioBuffer: AudioBuffer,
    filename: string,
    options: ExportOptions
  ) => Promise<void>;
  exportToBlob: (
    audioBuffer: AudioBuffer,
    options: ExportOptions
  ) => Promise<ExportResult>;
  downloadExport: (result: ExportResult, filename: string) => void;

  // Utils
  estimateSize: (duration: number, options: ExportOptions) => string;
  getDefaultFilename: (format: 'wav' | 'mp3') => string;
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tracks = useEditorStore((state) => state.tracks);

  // Export to blob
  const exportToBlob = useCallback(
    async (
      audioBuffer: AudioBuffer,
      options: ExportOptions
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setProgress(0);
      setError(null);

      try {
        let processedBuffer = audioBuffer;

        // Apply normalization if requested
        if (options.normalize) {
          setProgress(20);
          if (options.normalizeTarget) {
            processedBuffer = await normalizeToLUFS(
              processedBuffer,
              options.normalizeTarget
            );
          } else {
            processedBuffer = normalizeToPeak(processedBuffer, 0.95);
          }
        }

        setProgress(50);

        // Export to the requested format
        const result = await exportAudioBuffer(processedBuffer, options);

        setProgress(100);
        setIsExporting(false);

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Export failed';
        setError(errorMessage);
        setIsExporting(false);
        throw err;
      }
    },
    []
  );

  // Export directly to file download
  const exportToFile = useCallback(
    async (
      audioBuffer: AudioBuffer,
      filename: string,
      options: ExportOptions
    ): Promise<void> => {
      const result = await exportToBlob(audioBuffer, options);

      // Add extension if not present
      let finalFilename = filename;
      if (!finalFilename.endsWith(`.${options.format}`)) {
        finalFilename += `.${options.format}`;
      }

      downloadBlob(result.blob, finalFilename);
    },
    [exportToBlob]
  );

  // Download an already exported result
  const downloadExport = useCallback(
    (result: ExportResult, filename: string): void => {
      const format = result.metadata.format;
      let finalFilename = filename;
      if (!finalFilename.endsWith(`.${format}`)) {
        finalFilename += `.${format}`;
      }
      downloadBlob(result.blob, finalFilename);
    },
    []
  );

  // Estimate file size
  const estimateSize = useCallback(
    (duration: number, options: ExportOptions): string => {
      const channels = 2; // Stereo
      const size = estimateFileSize(
        duration,
        channels,
        options.sampleRate,
        options.format,
        options.bitDepth,
        options.bitrate
      );
      return formatFileSize(size);
    },
    []
  );

  // Generate default filename
  const getDefaultFilename = useCallback(
    (format: 'wav' | 'mp3'): string => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', 'h');

      // Use first track name if available
      if (tracks.length > 0) {
        const sanitized = tracks[0].name
          .replace(/[^a-zA-Z0-9-_]/g, '_')
          .slice(0, 30);
        return `${sanitized}_${dateStr}.${format}`;
      }

      return `export_${dateStr}_${timeStr}.${format}`;
    },
    [tracks]
  );

  return {
    // State
    isExporting,
    progress,
    error,

    // Actions
    exportToFile,
    exportToBlob,
    downloadExport,

    // Utils
    estimateSize,
    getDefaultFilename,
  };
}

// Default export options for radio broadcast
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'wav',
  sampleRate: 48000,
  bitDepth: 16,
  normalize: true,
  normalizeTarget: -16, // LUFS standard radio
};

// MP3 export preset
export const MP3_EXPORT_OPTIONS: ExportOptions = {
  format: 'mp3',
  sampleRate: 44100,
  bitrate: 320,
  normalize: true,
  normalizeTarget: -16,
};

// High quality WAV export preset
export const HQ_WAV_EXPORT_OPTIONS: ExportOptions = {
  format: 'wav',
  sampleRate: 48000,
  bitDepth: 24,
  normalize: false,
};
