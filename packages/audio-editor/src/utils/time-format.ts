/**
 * Utilitaires de formatage du temps pour l'editeur audio
 */

/**
 * Formate un temps en secondes vers MM:SS:ms
 */
export function formatTime(seconds: number, showMs = true): string {
  if (!isFinite(seconds) || seconds < 0) {
    return showMs ? '00:00:000' : '00:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(3, '0');

  return showMs ? `${minsStr}:${secsStr}:${msStr}` : `${minsStr}:${secsStr}`;
}

/**
 * Formate un temps en secondes vers HH:MM:SS:ms (pour les longs enregistrements)
 */
export function formatTimeLong(seconds: number, showMs = true): string {
  if (!isFinite(seconds) || seconds < 0) {
    return showMs ? '00:00:00:000' : '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const hoursStr = hours.toString().padStart(2, '0');
  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(3, '0');

  return showMs
    ? `${hoursStr}:${minsStr}:${secsStr}:${msStr}`
    : `${hoursStr}:${minsStr}:${secsStr}`;
}

/**
 * Parse un temps au format MM:SS ou MM:SS:ms vers secondes
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':').map((p) => parseFloat(p));

  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // MM:SS:ms ou HH:MM:SS
    if (parts[2] >= 0 && parts[2] < 60) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      // MM:SS:ms
      return parts[0] * 60 + parts[1] + parts[2] / 1000;
    }
  } else if (parts.length === 4) {
    // HH:MM:SS:ms
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 1000;
  }

  return 0;
}

/**
 * Formate une duree de maniere compacte (ex: "1m 30s" ou "45s")
 */
export function formatDurationCompact(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0s';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (mins === 0) {
    return `${secs}s`;
  } else if (secs === 0) {
    return `${mins}m`;
  } else {
    return `${mins}m ${secs}s`;
  }
}

/**
 * Calcule le temps en secondes a partir d'une position pixel et du zoom
 */
export function pixelsToTime(pixels: number, zoom: number): number {
  return pixels / zoom;
}

/**
 * Calcule la position en pixels a partir d'un temps et du zoom
 */
export function timeToPixels(time: number, zoom: number): number {
  return time * zoom;
}

/**
 * Arrondit un temps a la precision donnee (en secondes)
 */
export function snapTime(time: number, precision: number): number {
  return Math.round(time / precision) * precision;
}

/**
 * Genere les graduations de la timeline selon le zoom
 */
export function generateTimelineMarkers(
  duration: number,
  zoom: number,
  viewportWidth: number
): { time: number; label: string; major: boolean }[] {
  const markers: { time: number; label: string; major: boolean }[] = [];

  // Determine l'intervalle des markers en fonction du zoom
  let interval: number;
  let majorInterval: number;

  if (zoom >= 200) {
    interval = 0.5; // Toutes les 500ms
    majorInterval = 5; // Major toutes les 5 secondes
  } else if (zoom >= 100) {
    interval = 1; // Toutes les secondes
    majorInterval = 10;
  } else if (zoom >= 50) {
    interval = 5; // Toutes les 5 secondes
    majorInterval = 30;
  } else if (zoom >= 25) {
    interval = 10; // Toutes les 10 secondes
    majorInterval = 60;
  } else {
    interval = 30; // Toutes les 30 secondes
    majorInterval = 300; // 5 minutes
  }

  for (let time = 0; time <= duration; time += interval) {
    const isMajor = time % majorInterval === 0;
    markers.push({
      time,
      label: formatTime(time, false),
      major: isMajor,
    });
  }

  return markers;
}

/**
 * Estime la duree de lecture d'un texte (pour prompteur)
 * Base: ~150 mots/minute pour une lecture naturelle
 */
export function estimateReadingTime(text: string, wordsPerMinute = 150): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (words / wordsPerMinute) * 60;
}
