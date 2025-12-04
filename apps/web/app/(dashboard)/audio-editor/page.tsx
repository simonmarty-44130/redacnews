'use client';

import { Suspense } from 'react';
import { AudioEditorPage } from '@/components/audio-editor/AudioEditorPage';
import { AudioEditorSkeleton } from '@/components/audio-editor/AudioEditorSkeleton';

export default function Page() {
  return (
    <Suspense fallback={<AudioEditorSkeleton />}>
      <AudioEditorPage />
    </Suspense>
  );
}
