'use client';

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from '@/lib/audio-montage/constants';

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToView: () => void;
}

export function ZoomControls({ zoom, onZoomChange, onFitToView }: ZoomControlsProps) {
  const zoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, zoom * 1.25);
    onZoomChange(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, zoom / 1.25);
    onZoomChange(newZoom);
  };

  const resetZoom = () => {
    onZoomChange(DEFAULT_ZOOM);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        title="Zoom arriere"
        className="h-8 w-8"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={resetZoom}
        className="h-8 px-2 text-xs font-mono"
        title="Reinitialiser le zoom"
      >
        {Math.round(zoom)}px/s
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        title="Zoom avant"
        className="h-8 w-8"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onFitToView}
        title="Ajuster a la vue"
        className="h-8 w-8"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
