import { Track, AudioRegion } from '../types/editor.types';
import { generateId } from '../utils/id';

/**
 * TRIM : Garde uniquement la sélection, supprime le reste
 * C'est l'opération INVERSE de CUT
 *
 * Avant (sélection de 2:00 à 3:00) :
 * ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 * 0:00                      5:00
 *           ████████
 *          2:00  3:00 (sélection)
 *
 * Après :
 * ▓▓▓▓▓▓▓▓▓▓
 * 2:00  3:00
 */
export function trimToSelection(
  track: Track,
  selectionStart: number, // Dans le temps ORIGINAL
  selectionEnd: number // Dans le temps ORIGINAL
): Track {
  // Validation
  if (selectionStart >= selectionEnd) {
    console.warn('Invalid selection: start >= end');
    return track;
  }

  // La nouvelle région est simplement la sélection
  const newRegion: AudioRegion = {
    id: generateId(),
    startTime: selectionStart,
    endTime: selectionEnd,
    duration: selectionEnd - selectionStart,
  };

  return {
    ...track,
    regions: [newRegion],
  };
}
