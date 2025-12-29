// apps/web/lib/audio-montage/types.ts

export interface MontageProject {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number; // Duree totale en secondes
  tracks: Track[];
}

export interface Track {
  id: string;
  name: string;
  color: string;
  order: number; // Position verticale
  volume: number; // 0-1
  pan: number; // -1 (gauche) a 1 (droite)
  muted: boolean;
  solo: boolean;
  clips: Clip[];
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;

  // Source audio
  mediaItemId?: string; // Reference mediatheque (optionnel)
  sourceUrl: string; // URL du fichier audio
  sourceDuration: number; // Duree totale du fichier source

  // Position sur la timeline
  startTime: number; // Debut du clip sur la timeline (secondes)

  // Trim interne (portion du fichier source utilisee)
  inPoint: number; // Point d'entree dans le fichier source
  outPoint: number; // Point de sortie dans le fichier source

  // Proprietes
  volume: number; // Volume du clip (0-1)
  fadeInDuration: number; // Duree fade in (secondes)
  fadeOutDuration: number; // Duree fade out (secondes)
}

// Proprietes calculees pour Clip
export function getClipDuration(clip: Clip): number {
  return clip.outPoint - clip.inPoint;
}

export function getClipEndTime(clip: Clip): number {
  return clip.startTime + getClipDuration(clip);
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // Position curseur (secondes)
  isLooping: boolean;
  loopStart?: number;
  loopEnd?: number;
}

export interface TimelineState {
  zoom: number; // Pixels par seconde
  scrollLeft: number; // Position scroll horizontal
  viewportWidth: number; // Largeur visible
}

// Pour le drag and drop
export interface DragItem {
  type: 'CLIP' | 'LIBRARY_ITEM';
  id: string;
  name: string;
  sourceUrl: string;
  duration: number;
  mediaItemId?: string;
  // Pour les clips existants (type === 'CLIP')
  trackId?: string;
  startTime?: number;
}

// Evenements / Actions
export type MontageAction =
  | { type: 'ADD_TRACK'; payload: Omit<Track, 'id' | 'clips'> }
  | { type: 'REMOVE_TRACK'; payload: { trackId: string } }
  | { type: 'UPDATE_TRACK'; payload: { trackId: string; updates: Partial<Track> } }
  | { type: 'REORDER_TRACKS'; payload: { trackIds: string[] } }
  | {
      type: 'ADD_CLIP';
      payload: {
        trackId: string;
        clip: Omit<Clip, 'id' | 'trackId'>;
      };
    }
  | { type: 'REMOVE_CLIP'; payload: { clipId: string } }
  | { type: 'UPDATE_CLIP'; payload: { clipId: string; updates: Partial<Clip> } }
  | { type: 'MOVE_CLIP'; payload: { clipId: string; trackId: string; startTime: number } };

// Type pour clip avec proprietes calculees
export interface ClipWithComputed extends Clip {
  duration: number;
  endTime: number;
}

// Helper pour enrichir un clip
export function enrichClip(clip: Clip): ClipWithComputed {
  return {
    ...clip,
    duration: getClipDuration(clip),
    endTime: getClipEndTime(clip),
  };
}

// Type pour projet avec clips enrichis
export interface MontageProjectWithComputed extends Omit<MontageProject, 'tracks'> {
  tracks: (Omit<Track, 'clips'> & { clips: ClipWithComputed[] })[];
}

export function enrichProject(project: MontageProject): MontageProjectWithComputed {
  return {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map(enrichClip),
    })),
  };
}
