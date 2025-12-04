import { Track, AudioRegion } from '../types/editor.types';

/**
 * Calcule la durée totale du montage (somme des régions)
 */
export function getMontedDuration(track: Track): number {
  return track.regions.reduce((sum, region) => sum + region.duration, 0);
}

/**
 * Convertit un temps dans la timeline MONTÉE vers le temps ORIGINAL
 *
 * Exemple :
 * - Région 1 : 0:00-1:00 dans l'original
 * - Région 2 : 2:00-4:00 dans l'original
 *
 * Timeline montée :
 * 0:00 → original 0:00
 * 0:30 → original 0:30
 * 1:00 → original 1:00 (fin région 1)
 * 1:30 → original 2:30 (milieu région 2)
 * 3:00 → original 4:00 (fin région 2)
 */
export function montedTimeToOriginal(
  track: Track,
  montedTime: number
): { originalTime: number; regionId: string | null } {
  let accumulatedTime = 0;

  for (const region of track.regions) {
    const regionDuration = region.duration;

    if (montedTime <= accumulatedTime + regionDuration) {
      // Le temps est dans cette région
      const offsetInRegion = montedTime - accumulatedTime;
      return {
        originalTime: region.startTime + offsetInRegion,
        regionId: region.id,
      };
    }

    accumulatedTime += regionDuration;
  }

  // Après la dernière région
  const lastRegion = track.regions[track.regions.length - 1];
  return {
    originalTime: lastRegion?.endTime ?? 0,
    regionId: lastRegion?.id ?? null,
  };
}

/**
 * Convertit un temps ORIGINAL vers le temps dans la timeline MONTÉE
 */
export function originalTimeToMonted(
  track: Track,
  originalTime: number
): { montedTime: number; isInRegion: boolean } {
  let montedTime = 0;

  for (const region of track.regions) {
    if (originalTime < region.startTime) {
      // Le temps est avant cette région (dans une zone coupée)
      return { montedTime, isInRegion: false };
    }

    if (originalTime >= region.startTime && originalTime <= region.endTime) {
      // Le temps est dans cette région
      const offsetInRegion = originalTime - region.startTime;
      return { montedTime: montedTime + offsetInRegion, isInRegion: true };
    }

    montedTime += region.duration;
  }

  // Après toutes les régions
  return { montedTime, isInRegion: false };
}

/**
 * Trouve la région qui contient un temps original donné
 */
export function findRegionAtTime(
  track: Track,
  originalTime: number
): AudioRegion | null {
  return (
    track.regions.find(
      (r) => originalTime >= r.startTime && originalTime < r.endTime
    ) ?? null
  );
}

/**
 * Calcule les positions de rendu pour afficher les régions "recollées"
 */
export interface RegionRenderInfo {
  region: AudioRegion;
  renderStart: number; // Position de début dans l'affichage monté
  renderEnd: number; // Position de fin dans l'affichage monté
}

export function getRegionsRenderInfo(track: Track): RegionRenderInfo[] {
  const result: RegionRenderInfo[] = [];
  let currentPosition = 0;

  for (const region of track.regions) {
    result.push({
      region,
      renderStart: currentPosition,
      renderEnd: currentPosition + region.duration,
    });
    currentPosition += region.duration;
  }

  return result;
}

/**
 * Vérifie si deux régions sont adjacentes dans l'original
 */
export function areRegionsAdjacent(
  region1: AudioRegion,
  region2: AudioRegion
): boolean {
  const [first, second] =
    region1.startTime < region2.startTime
      ? [region1, region2]
      : [region2, region1];
  return Math.abs(first.endTime - second.startTime) < 0.001; // Tolérance de 1ms
}

/**
 * Trie les régions par leur position de début dans l'original
 */
export function sortRegionsByStartTime(regions: AudioRegion[]): AudioRegion[] {
  return [...regions].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Valide qu'une région est correcte (startTime < endTime, duration > 0)
 */
export function isValidRegion(region: AudioRegion): boolean {
  return (
    region.startTime >= 0 &&
    region.endTime > region.startTime &&
    region.duration > 0 &&
    Math.abs(region.endTime - region.startTime - region.duration) < 0.001
  );
}

/**
 * Crée une région à partir de temps de début et fin
 */
export function createRegion(
  id: string,
  startTime: number,
  endTime: number,
  options?: Partial<AudioRegion>
): AudioRegion {
  return {
    id,
    startTime,
    endTime,
    duration: endTime - startTime,
    ...options,
  };
}
