import { Track, AudioRegion } from '../types/editor.types';
import { generateId } from '../utils/id';

/**
 * CUT : Supprime la sélection et garde le reste
 *
 * Avant (sélection de 2:00 à 3:00) :
 * ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 * 0:00                      5:00
 *           ████████
 *          2:00  3:00 (sélection)
 *
 * Après :
 * ▓▓▓▓▓▓▓▓▓▓░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓
 * 0:00    2:00    3:00        5:00
 * │ Région 1 │    │ Région 2    │
 *
 * Visuellement (recollé) :
 * ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 * 0:00    2:00        4:00
 */
export function cutSelection(
  track: Track,
  selectionStart: number, // Dans le temps ORIGINAL
  selectionEnd: number // Dans le temps ORIGINAL
): Track {
  // Validation
  if (selectionStart >= selectionEnd) {
    console.warn('Invalid selection: start >= end');
    return track;
  }

  const newRegions: AudioRegion[] = [];

  for (const region of track.regions) {
    // Cas 1: Région entièrement AVANT la sélection → garder intacte
    if (region.endTime <= selectionStart) {
      newRegions.push({ ...region });
    }
    // Cas 2: Région entièrement APRÈS la sélection → garder intacte
    else if (region.startTime >= selectionEnd) {
      newRegions.push({ ...region });
    }
    // Cas 3: La sélection est ENTIÈREMENT dans la région → diviser en 2
    else if (
      region.startTime < selectionStart &&
      region.endTime > selectionEnd
    ) {
      // Partie gauche
      newRegions.push({
        id: generateId(),
        startTime: region.startTime,
        endTime: selectionStart,
        duration: selectionStart - region.startTime,
        label: region.label ? `${region.label} (1)` : undefined,
        fadeIn: region.fadeIn,
        // Pas de fadeOut car on a coupé
      });
      // Partie droite
      newRegions.push({
        id: generateId(),
        startTime: selectionEnd,
        endTime: region.endTime,
        duration: region.endTime - selectionEnd,
        label: region.label ? `${region.label} (2)` : undefined,
        // Pas de fadeIn car on a coupé
        fadeOut: region.fadeOut,
      });
    }
    // Cas 4: La sélection coupe le DÉBUT de la région
    else if (
      selectionStart <= region.startTime &&
      selectionEnd < region.endTime
    ) {
      newRegions.push({
        id: generateId(),
        startTime: selectionEnd,
        endTime: region.endTime,
        duration: region.endTime - selectionEnd,
        label: region.label,
        fadeOut: region.fadeOut,
      });
    }
    // Cas 5: La sélection coupe la FIN de la région
    else if (
      selectionStart > region.startTime &&
      selectionEnd >= region.endTime
    ) {
      newRegions.push({
        id: generateId(),
        startTime: region.startTime,
        endTime: selectionStart,
        duration: selectionStart - region.startTime,
        label: region.label,
        fadeIn: region.fadeIn,
      });
    }
    // Cas 6: La sélection englobe TOUTE la région → la supprimer (ne pas l'ajouter)
    // (region.startTime >= selectionStart && region.endTime <= selectionEnd)
  }

  // Trier par startTime
  newRegions.sort((a, b) => a.startTime - b.startTime);

  return {
    ...track,
    regions: newRegions,
  };
}
