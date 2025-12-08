'use client';

import { useRef, useState, useEffect } from 'react';
import { ClipWaveform } from './ClipWaveform';

interface LazyClipWaveformProps {
  audioUrl: string;
  clipId: string;
  color?: string;
  inPoint: number;
  outPoint: number;
  width: number;
  height?: number;
  className?: string;
}

export function LazyClipWaveform(props: LazyClipWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Precharger un peu avant
        threshold: 0,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: props.width, height: props.height || 64 }}>
      {isVisible ? (
        <ClipWaveform {...props} />
      ) : (
        <div
          className="w-full h-full rounded"
          style={{ backgroundColor: (props.color || '#3B82F6') + '20' }}
        />
      )}
    </div>
  );
}
