import { Track, AudioRegion } from '../types/editor.types';
import { generateId } from '../utils/id';

/**
 * Fusionne deux régions adjacentes
 */
export function mergeRegions(
  track: Track,
  regionId1: string,
  regionId2: string
): Track {
  const region1 = track.regions.find((r) => r.id === regionId1);
  const region2 = track.regions.find((r) => r.id === regionId2);

  if (!region1 || !region2) {
    console.warn('Regions not found');
    return track;
  }

  // Vérifier qu'elles sont adjacentes dans l'original
  const [first, second] =
    region1.startTime < region2.startTime
      ? [region1, region2]
      : [region2, region1];

  if (first.endTime !== second.startTime) {
    console.warn('Regions are not adjacent');
    return track;
  }

  // Créer la région fusionnée
  const mergedRegion: AudioRegion = {
    id: generateId(),
    startTime: first.startTime,
    endTime: second.endTime,
    duration: second.endTime - first.startTime,
    label: first.label || second.label,
    fadeIn: first.fadeIn,
    fadeOut: second.fadeOut,
  };

  return {
    ...track,
    regions: [
      ...track.regions.filter((r) => r.id !== regionId1 && r.id !== regionId2),
      mergedRegion,
    ].sort((a, b) => a.startTime - b.startTime),
  };
}
