'use client';

/**
 * Point d'entrée route `/audio-editor` du nouvel éditeur (port Tanguy).
 *
 * - `/audio-editor`                 → nouvel enregistrement.
 * - `/audio-editor?media=<id>`      → édition / re-montage du son d'un MediaItem.
 *   (si plusieurs ids sont passés, on édite le premier — l'éditeur est mono-piste).
 *
 * Le composant lourd (peaks.js, worker MP3) est chargé en dynamic(ssr:false).
 */
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { trpc } from '@/lib/trpc/client';
import { AudioEditorSkeleton } from '@/components/audio-editor/AudioEditorSkeleton';

const MediaAudioEditor = dynamic(
  () => import('./MediaAudioEditor').then((m) => m.MediaAudioEditor),
  { ssr: false }
);

export function AudioEditorRoute() {
  const router = useRouter();
  const params = useSearchParams();

  const mediaParam = params.get('media');
  const firstMediaId = mediaParam ? mediaParam.split(',').filter(Boolean)[0] : null;

  const { data: media, isLoading } = trpc.media.get.useQuery(
    { id: firstMediaId! },
    { enabled: !!firstMediaId }
  );

  const goToMediatheque = () => router.push('/mediatheque');

  // En cas d'édition d'un média existant, on attend ses infos (URL présignée).
  if (firstMediaId && isLoading) {
    return (
      <div className="flex h-full flex-col bg-slate-900">
        <AudioEditorSkeleton />
      </div>
    );
  }

  const markers =
    (media?.waveformData as { markers?: number[] } | null)?.markers ?? [];

  return (
    <MediaAudioEditor
      mediaId={firstMediaId ?? undefined}
      mediaTitle={media?.title}
      existingAudioUrl={media?.presignedUrl ?? undefined}
      existingMarkers={markers}
      onClose={goToMediatheque}
      onSaved={() => goToMediatheque()}
    />
  );
}
