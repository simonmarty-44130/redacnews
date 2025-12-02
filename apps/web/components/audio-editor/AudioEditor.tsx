'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.js';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Volume2,
  ZoomIn,
  ZoomOut,
  Save,
  X,
  Loader2,
  ArrowUpFromLine,
  ArrowDownFromLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AudioEditorProps {
  url: string;
  title: string;
  onSave?: (audioBlob: Blob, format: 'wav') => void;
  onClose?: () => void;
  className?: string;
}

interface HistoryState {
  audioBuffer: AudioBuffer;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function AudioEditor({
  url,
  title,
  onSave,
  onClose,
  className,
}: AudioEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [volume, setVolume] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [clipboard, setClipboard] = useState<AudioBuffer | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94a3b8',
      progressColor: '#3b82f6',
      height: 128,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 2,
      cursorColor: '#ef4444',
      normalize: true,
      plugins: [regions],
    });

    wavesurfer.load(url);

    wavesurfer.on('ready', () => {
      setIsReady(true);
      setIsLoading(false);
      setDuration(wavesurfer.getDuration());

      // Store initial buffer
      const decodedData = wavesurfer.getDecodedData();
      if (decodedData) {
        currentBufferRef.current = decodedData;
        // Initialize history with original state
        setHistory([{ audioBuffer: decodedData }]);
        setHistoryIndex(0);
      }
    });

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('seeking', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => setIsPlaying(false));

    // Region events
    regions.on('region-created', (region) => {
      // Remove any other regions (only one selection at a time)
      regions.getRegions().forEach((r) => {
        if (r.id !== region.id) {
          r.remove();
        }
      });
      setSelectedRegion(region);
    });

    regions.on('region-updated', (region) => {
      setSelectedRegion(region);
    });

    regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      setSelectedRegion(region);
    });

    // Enable drag selection
    regions.enableDragSelection({
      color: 'rgba(59, 130, 246, 0.3)',
    });

    wavesurferRef.current = wavesurfer;
    audioContextRef.current = new AudioContext();

    return () => {
      wavesurfer.destroy();
      audioContextRef.current?.close();
    };
  }, [url]);

  // Update zoom
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.zoom(zoom);
    }
  }, [zoom, isReady]);

  // Update volume
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(volume);
    }
  }, [volume]);

  const pushToHistory = useCallback((buffer: AudioBuffer) => {
    setHistory((prev) => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ audioBuffer: buffer });
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    setHasChanges(true);
  }, [historyIndex]);

  const applyBuffer = useCallback(async (buffer: AudioBuffer) => {
    if (!wavesurferRef.current) return;

    currentBufferRef.current = buffer;

    // Convert buffer to blob and reload
    const blob = await audioBufferToWav(buffer);
    const blobUrl = URL.createObjectURL(blob);

    wavesurferRef.current.load(blobUrl);
    setDuration(buffer.duration);

    // Clear selection
    regionsRef.current?.clearRegions();
    setSelectedRegion(null);
  }, []);

  const togglePlay = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, Math.min(duration, wavesurferRef.current.getCurrentTime() + seconds));
      wavesurferRef.current.setTime(newTime);
    }
  }, [duration]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      applyBuffer(history[newIndex].audioBuffer);
    }
  }, [historyIndex, history, applyBuffer]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      applyBuffer(history[newIndex].audioBuffer);
    }
  }, [historyIndex, history, applyBuffer]);

  const handleCut = useCallback(async () => {
    if (!selectedRegion || !currentBufferRef.current || !audioContextRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(selectedRegion.start * sampleRate);
    const endSample = Math.floor(selectedRegion.end * sampleRate);

    // Copy to clipboard
    const clipboardBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      endSample - startSample,
      sampleRate
    );
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      clipboardBuffer.copyToChannel(channelData.slice(startSample, endSample), channel);
    }
    setClipboard(clipboardBuffer);

    // Create new buffer without the selected region
    const newLength = buffer.length - (endSample - startSample);
    const newBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      newLength,
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const newChannelData = newBuffer.getChannelData(channel);

      // Copy before selection
      newChannelData.set(channelData.slice(0, startSample), 0);
      // Copy after selection
      newChannelData.set(channelData.slice(endSample), startSample);
    }

    pushToHistory(newBuffer);
    await applyBuffer(newBuffer);
  }, [selectedRegion, pushToHistory, applyBuffer]);

  const handleCopy = useCallback(() => {
    if (!selectedRegion || !currentBufferRef.current || !audioContextRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(selectedRegion.start * sampleRate);
    const endSample = Math.floor(selectedRegion.end * sampleRate);

    const clipboardBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      endSample - startSample,
      sampleRate
    );
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      clipboardBuffer.copyToChannel(channelData.slice(startSample, endSample), channel);
    }
    setClipboard(clipboardBuffer);
  }, [selectedRegion]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !currentBufferRef.current || !audioContextRef.current || !wavesurferRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;
    const currentPosition = Math.floor(wavesurferRef.current.getCurrentTime() * sampleRate);

    // Create new buffer with clipboard inserted at current position
    const newLength = buffer.length + clipboard.length;
    const newBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      newLength,
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const clipboardData = clipboard.getChannelData(channel);
      const newChannelData = newBuffer.getChannelData(channel);

      // Copy before cursor
      newChannelData.set(channelData.slice(0, currentPosition), 0);
      // Insert clipboard
      newChannelData.set(clipboardData, currentPosition);
      // Copy after cursor
      newChannelData.set(channelData.slice(currentPosition), currentPosition + clipboard.length);
    }

    pushToHistory(newBuffer);
    await applyBuffer(newBuffer);
  }, [clipboard, pushToHistory, applyBuffer]);

  const handleDelete = useCallback(async () => {
    if (!selectedRegion || !currentBufferRef.current || !audioContextRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(selectedRegion.start * sampleRate);
    const endSample = Math.floor(selectedRegion.end * sampleRate);

    const newLength = buffer.length - (endSample - startSample);
    const newBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      newLength,
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const newChannelData = newBuffer.getChannelData(channel);

      newChannelData.set(channelData.slice(0, startSample), 0);
      newChannelData.set(channelData.slice(endSample), startSample);
    }

    pushToHistory(newBuffer);
    await applyBuffer(newBuffer);
  }, [selectedRegion, pushToHistory, applyBuffer]);

  const handleFadeIn = useCallback(async () => {
    if (!selectedRegion || !currentBufferRef.current || !audioContextRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(selectedRegion.start * sampleRate);
    const endSample = Math.floor(selectedRegion.end * sampleRate);
    const fadeLength = endSample - startSample;

    const newBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel).slice();

      for (let i = 0; i < fadeLength; i++) {
        const gain = i / fadeLength;
        channelData[startSample + i] *= gain;
      }

      newBuffer.copyToChannel(channelData, channel);
    }

    pushToHistory(newBuffer);
    await applyBuffer(newBuffer);
  }, [selectedRegion, pushToHistory, applyBuffer]);

  const handleFadeOut = useCallback(async () => {
    if (!selectedRegion || !currentBufferRef.current || !audioContextRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(selectedRegion.start * sampleRate);
    const endSample = Math.floor(selectedRegion.end * sampleRate);
    const fadeLength = endSample - startSample;

    const newBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel).slice();

      for (let i = 0; i < fadeLength; i++) {
        const gain = 1 - (i / fadeLength);
        channelData[startSample + i] *= gain;
      }

      newBuffer.copyToChannel(channelData, channel);
    }

    pushToHistory(newBuffer);
    await applyBuffer(newBuffer);
  }, [selectedRegion, pushToHistory, applyBuffer]);

  const handleNormalize = useCallback(async () => {
    if (!currentBufferRef.current || !audioContextRef.current) return;

    const buffer = currentBufferRef.current;
    const sampleRate = buffer.sampleRate;

    // Find max amplitude
    let maxAmplitude = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[i]));
      }
    }

    if (maxAmplitude === 0) return;

    const gain = 1 / maxAmplitude;

    const newBuffer = audioContextRef.current.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel).slice();

      for (let i = 0; i < channelData.length; i++) {
        channelData[i] *= gain;
      }

      newBuffer.copyToChannel(channelData, channel);
    }

    pushToHistory(newBuffer);
    await applyBuffer(newBuffer);
  }, [pushToHistory, applyBuffer]);

  const handleSave = useCallback(async () => {
    if (!currentBufferRef.current || !onSave) return;

    setIsSaving(true);
    try {
      const blob = await audioBufferToWav(currentBufferRef.current);
      onSave(blob, 'wav');
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (confirm('Vous avez des modifications non sauvegardees. Voulez-vous vraiment fermer ?')) {
        onClose?.();
      }
    } else {
      onClose?.();
    }
  }, [hasChanges, onClose]);

  const clearSelection = useCallback(() => {
    regionsRef.current?.clearRegions();
    setSelectedRegion(null);
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col bg-slate-900 text-white', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">{title}</h2>
            {hasChanges && (
              <span className="text-xs text-amber-400">(modifie)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Sauvegarder
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-700 bg-slate-800">
          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndo}
                disabled={!canUndo}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Annuler (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRedo}
                disabled={!canRedo}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retablir (Ctrl+Y)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-2 bg-slate-600" />

          {/* Edit operations */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCut}
                disabled={!selectedRegion}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <Scissors className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Couper (Ctrl+X)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                disabled={!selectedRegion}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copier (Ctrl+C)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePaste}
                disabled={!clipboard}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <span className="text-sm font-medium">V</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Coller (Ctrl+V)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={!selectedRegion}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Supprimer (Del)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-2 bg-slate-600" />

          {/* Audio effects */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFadeIn}
                disabled={!selectedRegion}
                className="h-8 px-2 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <ArrowUpFromLine className="h-4 w-4 mr-1" />
                <span className="text-xs">Fade In</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Appliquer un fade in a la selection</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFadeOut}
                disabled={!selectedRegion}
                className="h-8 px-2 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <ArrowDownFromLine className="h-4 w-4 mr-1" />
                <span className="text-xs">Fade Out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Appliquer un fade out a la selection</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNormalize}
                className="h-8 px-2 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <Volume2 className="h-4 w-4 mr-1" />
                <span className="text-xs">Normaliser</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Normaliser le volume</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-slate-400" />
            <Slider
              value={[zoom]}
              min={10}
              max={200}
              step={10}
              onValueChange={(v) => setZoom(v[0])}
              className="w-24"
            />
            <ZoomIn className="h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Waveform */}
        <div className="flex-1 p-4 min-h-[200px] relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}
          <div
            ref={containerRef}
            className={cn(
              'w-full h-full rounded bg-slate-800',
              !isReady && 'opacity-50'
            )}
          />
          {selectedRegion && (
            <div className="absolute top-2 right-6 text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
              Selection: {formatTime(selectedRegion.start)} - {formatTime(selectedRegion.end)}
              <button
                onClick={clearSelection}
                className="ml-2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3 inline" />
              </button>
            </div>
          )}
        </div>

        {/* Transport controls */}
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center gap-4">
            {/* Time display */}
            <div className="text-sm font-mono text-slate-300 w-32">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(-5)}
                disabled={!isReady}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                onClick={togglePlay}
                disabled={!isReady}
                size="icon"
                className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(5)}
                disabled={!isReady}
                className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-slate-400" />
              <Slider
                value={[volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => setVolume(v[0])}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Helper function to convert AudioBuffer to WAV Blob
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data (interleaved)
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = headerSize;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
