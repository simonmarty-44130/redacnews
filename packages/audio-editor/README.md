# @redacnews/audio-editor

Module d'editeur audio multitrack pour RedacNews, un NRCS (Newsroom Computer System) SaaS destine aux radios.

## Installation

```bash
npm install @redacnews/audio-editor
```

## Utilisation

### Composant principal

```tsx
import { MultitrackEditor } from '@redacnews/audio-editor';
import type { Track, ExportMetadata } from '@redacnews/audio-editor';

function AudioPage() {
  const initialTracks: Track[] = [
    {
      id: 'track-1',
      src: 'https://example.com/audio/interview.mp3',
      name: 'Interview Maire',
      start: 0,
    },
    {
      id: 'track-2',
      src: 'https://example.com/audio/ambiance.wav',
      name: 'Ambiance Marche',
      start: 15.5,
    },
  ];

  const handleSave = async (blob: Blob, metadata: ExportMetadata) => {
    // Upload vers S3 et sauvegarder dans la base de donnees
    console.log('Export:', metadata);
  };

  return (
    <MultitrackEditor
      initialTracks={initialTracks}
      onSave={handleSave}
      theme="dark"
      className="h-screen"
    />
  );
}
```

### API Reference

#### Props du composant MultitrackEditor

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialTracks` | `Track[]` | `[]` | Pistes audio initiales a charger |
| `onSave` | `(blob: Blob, metadata: ExportMetadata) => Promise<void>` | - | Callback lors de l'export |
| `onTracksChange` | `(tracks: Track[]) => void` | - | Callback lors de modifications |
| `onClose` | `() => void` | - | Callback pour fermer l'editeur |
| `sampleRate` | `44100 \| 48000` | `44100` | Frequence d'echantillonnage |
| `defaultZoom` | `number` | `100` | Zoom initial (pixels par seconde) |
| `showTimecode` | `boolean` | `true` | Afficher le timecode SMPTE |
| `theme` | `'light' \| 'dark'` | `'dark'` | Theme de couleurs |
| `className` | `string` | - | Classes CSS additionnelles |

#### Ref Methods

```tsx
const editorRef = useRef<MultitrackEditorRef>(null);

// Lecture
editorRef.current.play();
editorRef.current.pause();
editorRef.current.stop();
editorRef.current.seek(30); // Aller a 30 secondes

// Pistes
editorRef.current.addTrack({ src: '...', name: 'Nouvelle piste' });
editorRef.current.removeTrack('track-id');

// Export
const result = await editorRef.current.exportAudio({
  format: 'wav',
  sampleRate: 48000,
  bitDepth: 16,
  normalize: true,
  normalizeTarget: -16,
});

// Historique
editorRef.current.undo();
editorRef.current.redo();
```

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Espace` | Lecture / Pause |
| `Echap` | Stop |
| `Home` | Retour au debut |
| `End` | Aller a la fin |
| `J` | Shuttle arriere |
| `K` | Stop shuttle |
| `L` | Shuttle avant |
| `Ctrl+X` | Couper |
| `Ctrl+C` | Copier |
| `Ctrl+V` | Coller |
| `Suppr` | Supprimer |
| `Ctrl+A` | Tout selectionner |
| `Ctrl+D` | Deselectionner |
| `Ctrl+Z` | Annuler |
| `Ctrl+Shift+Z` | Retablir |
| `S` | Couper a la position |
| `I` | Definir point In |
| `O` | Definir point Out |
| `Shift+I` | Aller au point In |
| `Shift+O` | Aller au point Out |
| `Ctrl+=` | Zoom avant |
| `Ctrl+-` | Zoom arriere |
| `Ctrl+0` | Ajuster a la fenetre |
| `M` | Mute piste selectionnee |
| `Ctrl+M` | Solo piste selectionnee |
| `Ctrl+E` | Exporter |

## Effets audio

### Compresseur broadcast

```tsx
import { createBroadcastCompressor, COMPRESSOR_PRESETS } from '@redacnews/audio-editor';

// Preset optimise pour la radio
const compressor = createBroadcastCompressor();

// Ou avec un preset specifique
const interviewCompressor = createCompressor(COMPRESSOR_PRESETS.interview);
```

### Normalisation LUFS

```tsx
import { normalizeToLUFS, analyzeAudio } from '@redacnews/audio-editor';

// Analyser le niveau audio
const analysis = analyzeAudio(audioBuffer);
console.log(`LUFS: ${analysis.lufs}, Peak: ${analysis.peakDB} dB`);

// Normaliser a -16 LUFS (standard radio francaise)
const normalizedBuffer = await normalizeToLUFS(audioBuffer, -16);
```

### Presets EQ

```tsx
import { EQ_PRESETS, applyEQToBuffer } from '@redacnews/audio-editor';

// Presets disponibles: voixHomme, voixFemme, telephone, exterieur, presence, warm, flat
const processedBuffer = await applyEQToBuffer(audioBuffer, EQ_PRESETS.voixHomme);
```

## Export

### WAV

```tsx
import { audioBufferToWav } from '@redacnews/audio-editor';

const wavBlob = audioBufferToWav(audioBuffer, 16); // 16 ou 24 bits
```

### MP3

```tsx
import { audioBufferToMp3 } from '@redacnews/audio-editor';

const mp3Blob = await audioBufferToMp3(audioBuffer, 320); // Bitrate en kbps
```

## Hooks

### usePlaylist

Hook principal pour integrer waveform-playlist.

```tsx
import { usePlaylist } from '@redacnews/audio-editor';

const playlist = usePlaylist({
  container: containerRef.current,
  sampleRate: 48000,
  theme: 'dark',
});

// Actions
playlist.play();
playlist.pause();
playlist.seek(30);
playlist.zoomIn();
```

### useTransport

Hook pour controler le transport (lecture/pause/stop).

```tsx
import { useTransport } from '@redacnews/audio-editor';

const transport = useTransport({
  onPlay: () => console.log('Playing'),
  onPause: () => console.log('Paused'),
});

transport.togglePlayPause();
transport.shuttleForward(); // J/K/L style
```

### useSelection

Hook pour gerer les selections audio.

```tsx
import { useSelection } from '@redacnews/audio-editor';

const selection = useSelection();

selection.selectRegion(10, 20); // Selectionner de 10s a 20s
selection.setCueIn(); // Definir point In a la position actuelle
selection.setCueOut();
selection.selectBetweenCuePoints();
```

### useRecording

Hook pour l'enregistrement depuis le microphone.

```tsx
import { useRecording } from '@redacnews/audio-editor';

const recording = useRecording({
  sampleRate: 44100,
  channels: 1,
});

await recording.startRecording();
const blob = await recording.stopRecording();
```

### useExport

Hook pour l'export audio.

```tsx
import { useExport, DEFAULT_EXPORT_OPTIONS } from '@redacnews/audio-editor';

const exportHook = useExport();

await exportHook.exportToFile(audioBuffer, 'mon-export', DEFAULT_EXPORT_OPTIONS);
```

## Store Zustand

Le state global de l'editeur est gere via Zustand.

```tsx
import { useEditorStore, selectTracks, selectPlayState } from '@redacnews/audio-editor';

// Utiliser des selectors pour eviter les re-renders inutiles
const tracks = useEditorStore(selectTracks);
const playState = useEditorStore(selectPlayState);

// Actions
const { addTrack, toggleMute, undo, redo } = useEditorStore();
```

## Architecture

```
packages/audio-editor/
├── src/
│   ├── index.ts                    # Exports publics
│   ├── components/
│   │   ├── MultitrackEditor.tsx    # Composant principal
│   │   ├── Toolbar.tsx             # Barre d'outils
│   │   ├── Timeline.tsx            # Ruler temporel
│   │   ├── TrackControls.tsx       # Controles par piste
│   │   ├── TransportControls.tsx   # Play/Pause/Stop
│   │   └── ExportDialog.tsx        # Modal d'export
│   ├── hooks/
│   │   ├── usePlaylist.ts          # Integration waveform-playlist
│   │   ├── useTransport.ts         # Controle transport
│   │   ├── useSelection.ts         # Gestion selection
│   │   ├── useKeyboardShortcuts.ts # Raccourcis clavier
│   │   ├── useRecording.ts         # Enregistrement micro
│   │   └── useExport.ts            # Export audio
│   ├── stores/
│   │   └── editorStore.ts          # Store Zustand
│   ├── utils/
│   │   ├── audio-processing.ts     # Traitement audio
│   │   ├── time-format.ts          # Formatage temps
│   │   └── export-utils.ts         # Export WAV/MP3
│   ├── effects/
│   │   ├── compressor.ts           # Compression broadcast
│   │   ├── normalizer.ts           # Normalisation LUFS
│   │   └── eq-presets.ts           # Presets EQ voix
│   ├── types/
│   │   └── editor.types.ts         # Types TypeScript
│   └── constants/
│       └── shortcuts.ts            # Raccourcis clavier + theme
```

## Technologies

- **waveform-playlist** - Editeur multitrack base sur Web Audio API
- **Tone.js** - Effets audio (compresseur, EQ)
- **Zustand** - State management
- **lamejs** - Encodage MP3

## License

MIT
