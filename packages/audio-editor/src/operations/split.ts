import { Track, AudioRegion } from '../types/editor.types';
import { generateId } from '../utils/id';

/**
 * SPLIT : Divise une région en 2 à la position du curseur
 *
 * Avant (curseur à 2:30) :
 * ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 * 0:00        │            5:00
 *            2:30 (curseur)
 *
 * Après :
 * ▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 * 0:00      2:30           5:00
 * │ Région 1 ││  Région 2    │
 */
export function splitAtPosition(
  track: Track,
  position: number // Position dans le temps ORIGINAL
): Track {
  const newRegions: AudioRegion[] = [];

  for (const region of track.regions) {
    // Si le curseur est dans cette région → split
    if (position > region.startTime && position < region.endTime) {
      // Partie gauche
      newRegions.push({
        id: generateId(),
        startTime: region.startTime,
        endTime: position,
        duration: position - region.startTime,
        label: region.label ? `${region.label} (A)` : undefined,
        fadeIn: region.fadeIn,
      });
      // Partie droite
      newRegions.push({
        id: generateId(),
        startTime: position,
        endTime: region.endTime,
        duration: region.endTime - position,
        label: region.label ? `${region.label} (B)` : undefined,
        fadeOut: region.fadeOut,
      });
    } else {
      // Région non affectée → garder
      newRegions.push({ ...region });
    }
  }

  return {
    ...track,
    regions: newRegions,
  };
}
