// apps/web/components/audio-montage/index.ts

export { MontageEditor } from './MontageEditor';
export { Timeline } from './Timeline';
export { TimelineRuler } from './TimelineRuler';
export { Track } from './Track';
export { TrackControls } from './TrackControls';
export { Clip } from './Clip';
// ClipWaveform n'est pas exporte directement car peaks.js ne supporte pas le SSR
// Le composant est charge dynamiquement (next/dynamic ssr:false) dans Clip.tsx
export { ClipLibrary } from './ClipLibrary';
export { TransportBar } from './TransportBar';
export { ZoomControls } from './ZoomControls';
export { ExportDialog } from './ExportDialog';
