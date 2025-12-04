import { nanoid } from 'nanoid';

/**
 * Génère un ID unique pour les régions, pistes, marqueurs, etc.
 */
export function generateId(): string {
  return nanoid();
}
