/**
 * AudioContext singleton partagé.
 *
 * Safari plante avec « too many AudioContexts » si on en crée à la volée.
 * Toute la lib (décodage, édition, lecture) DOIT passer par getAudioContext().
 */

type WebkitWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

let sharedContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === 'closed') {
    const Ctor =
      window.AudioContext || (window as WebkitWindow).webkitAudioContext
    if (!Ctor) {
      throw new Error("Web Audio API non supportée par ce navigateur")
    }
    sharedContext = new Ctor()
  }
  return sharedContext
}

/** Reprend le contexte (suspendu par défaut tant qu'il n'y a pas d'interaction). */
export async function resumeAudioContext(): Promise<AudioContext> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx
}

/** Ferme le contexte partagé (cleanup au démontage de l'éditeur). */
export async function closeAudioContext(): Promise<void> {
  if (sharedContext && sharedContext.state !== 'closed') {
    await sharedContext.close()
  }
  sharedContext = null
}
