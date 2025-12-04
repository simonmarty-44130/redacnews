'use client';

import { useParams, useRouter } from 'next/navigation';
import { StoryEditorFullscreen } from '@/components/sujets/StoryEditorFullscreen';

export default function StoryEditPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const handleBack = () => {
    router.push('/sujets');
  };

  return <StoryEditorFullscreen storyId={storyId} onBack={handleBack} />;
}
