'use client';

import { Suspense } from 'react';
import { AudioEditorRoute } from '@/components/audio/AudioEditorRoute';
import { AudioEditorSkeleton } from '@/components/audio-editor/AudioEditorSkeleton';

export default function Page() {
  return (
    <Suspense fallback={<AudioEditorSkeleton />}>
      <AudioEditorRoute />
    </Suspense>
  );
}
