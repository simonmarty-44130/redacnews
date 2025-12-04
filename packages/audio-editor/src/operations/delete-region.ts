import { Track } from '../types/editor.types';

/**
 * Supprime une région spécifique par son ID
 */
export function deleteRegion(track: Track, regionId: string): Track {
  return {
    ...track,
    regions: track.regions.filter((r) => r.id !== regionId),
  };
}
