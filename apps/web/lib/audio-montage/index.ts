// apps/web/lib/audio-montage/index.ts

export * from './types';
export * from './constants';

// SyncEngine - Nouveau systeme de synchronisation base sur WaveSurfer.js
// Chaque clip est une instance WaveSurfer independante, coordonnee par SyncEngine
export { SyncEngine, getSyncEngine, resetSyncEngine } from './SyncEngine';
export type { SyncedClipRef, TimeUpdateCallback, PlayStateCallback } from './SyncEngine';

// MultiTrackEngine - Ancien moteur (conserve pour compatibilite et export WAV)
export { MultiTrackEngine, getMultiTrackEngine } from './MultiTrackEngine';
