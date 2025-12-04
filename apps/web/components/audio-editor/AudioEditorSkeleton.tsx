'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function AudioEditorSkeleton() {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header skeleton */}
      <div className="h-12 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-20 bg-slate-700" />
          <Skeleton className="h-4 w-32 bg-slate-700" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 bg-slate-700" />
          <Skeleton className="h-8 w-8 bg-slate-700" />
        </div>
      </div>

      {/* Toolbar skeleton */}
      <div className="h-10 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-2">
        <Skeleton className="h-6 w-6 bg-slate-700" />
        <Skeleton className="h-6 w-6 bg-slate-700" />
        <div className="w-px h-6 bg-slate-700 mx-2" />
        <Skeleton className="h-6 w-6 bg-slate-700" />
        <Skeleton className="h-6 w-6 bg-slate-700" />
        <Skeleton className="h-6 w-6 bg-slate-700" />
        <div className="flex-1" />
        <Skeleton className="h-6 w-24 bg-slate-700" />
      </div>

      {/* Transport controls skeleton */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-4">
        <Skeleton className="h-8 w-32 bg-slate-700" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full bg-slate-700" />
          <Skeleton className="h-10 w-10 rounded-full bg-slate-700" />
          <Skeleton className="h-8 w-8 rounded-full bg-slate-700" />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track controls skeleton */}
        <div className="w-48 bg-slate-800 border-r border-slate-700 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full bg-slate-700" />
              <Skeleton className="h-20 w-full bg-slate-700" />
            </div>
          ))}
          <Skeleton className="h-10 w-full bg-slate-700 mt-4" />
        </div>

        {/* Waveform area skeleton */}
        <div className="flex-1 flex flex-col">
          {/* Timeline skeleton */}
          <div className="h-8 bg-slate-800 border-b border-slate-700">
            <Skeleton className="h-full w-full bg-slate-700" />
          </div>

          {/* Waveforms skeleton */}
          <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-slate-700" />
            ))}
          </div>
        </div>
      </div>

      {/* Status bar skeleton */}
      <div className="h-6 bg-slate-800 border-t border-slate-700 flex items-center px-4">
        <Skeleton className="h-3 w-48 bg-slate-700" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-32 bg-slate-700" />
      </div>
    </div>
  );
}
