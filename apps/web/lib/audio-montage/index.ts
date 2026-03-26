// apps/web/lib/audio-montage/index.ts

export * from './types';
export * from './constants';

// ToneEngine - Moteur de synchronisation moderne base sur Tone.js
// Synchronisation sample-accurate, pas de drift, fiable
export { ToneEngine, getToneEngine, resetToneEngine } from './ToneEngine';
export type { ToneClipRef, TimeUpdateCallback, PlayStateCallback } from './ToneEngine';

// SyncEngine - DEPRECATED - Ancien systeme (problemes de sync)
// Garde pour compatibilite temporaire
export { SyncEngine, getSyncEngine, resetSyncEngine } from './SyncEngine';
export type { SyncedClipRef } from './SyncEngine';

// MultiTrackEngine - Ancien moteur (conserve pour compatibilite et export WAV)
export { MultiTrackEngine, getMultiTrackEngine } from './MultiTrackEngine';
