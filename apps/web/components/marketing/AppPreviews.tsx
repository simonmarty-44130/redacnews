/**
 * Aperçus d'interface (maquettes rendues) pour la landing publique.
 * Reproductions fidèles de l'UI réelle de RedacNews, avec des données de DÉMO
 * (aucun nom ni contenu réel). Purement présentationnel.
 */
import {
  Radio,
  LayoutDashboard,
  FileText,
  FolderOpen,
  AudioLines,
  Presentation,
  Bot,
  Music,
  Clock,
  GripVertical,
  Play,
} from 'lucide-react';

/* ---------- Cadre « navigateur » ---------- */
function BrowserFrame({
  url,
  dark,
  children,
}: {
  url: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl shadow-2xl ring-1 ${
        dark ? 'ring-slate-700' : 'ring-slate-200'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}
      >
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span
          className={`ml-2 truncate rounded px-2 py-0.5 text-[11px] ${
            dark ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-400'
          }`}
        >
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ---------- Barre de nav de l'app ---------- */
function AppNav({ active }: { active: string }) {
  const items = [
    { name: 'Conducteur', icon: LayoutDashboard },
    { name: 'Sujets', icon: FileText },
    { name: 'Médiathèque', icon: FolderOpen },
    { name: 'Montage', icon: AudioLines },
    { name: 'Prompteur', icon: Presentation },
    { name: 'Assistant IA', icon: Bot },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-slate-100 bg-white px-3 py-2 text-[11px]">
      <div className="mr-2 flex items-center gap-1.5 font-bold text-slate-900">
        <Radio className="h-4 w-4 text-blue-600" />
        RedacNews
      </div>
      {items.map((it) => (
        <span
          key={it.name}
          className={`hidden items-center gap-1 rounded-md px-2 py-1 sm:inline-flex ${
            it.name === active ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-500'
          }`}
        >
          <it.icon className="h-3 w-3" />
          {it.name}
        </span>
      ))}
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-700">
        LM
      </span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'air' | 'ready' | 'done' }) {
  const cls =
    tone === 'air'
      ? 'bg-red-50 text-red-600'
      : tone === 'ready'
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-blue-50 text-blue-600';
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

/* ---------- Conducteur ---------- */
const RUNDOWN = [
  { t: '12:00:00', title: 'Titres', dur: '0:31', tone: 'air' as const, air: true },
  { t: '12:00:31', title: 'Sommaire', dur: '0:44', tone: 'ready' as const, story: true },
  { t: '12:01:15', title: 'Conseil municipal', dur: '1:52', tone: 'ready' as const, story: true, audio: '1:30' },
  { t: '12:03:07', title: 'Travaux tramway', dur: '0:43', tone: 'done' as const, story: true, audio: '0:35' },
  { t: '12:03:50', title: 'Météo régionale', dur: '0:38', tone: 'done' as const, story: true },
  { t: '12:04:28', title: 'Brève sport', dur: '0:30', tone: 'ready' as const, story: true },
];

export function ConducteurPreview() {
  return (
    <BrowserFrame url="redacnews.link/conducteur">
      <div className="bg-white">
        <AppNav active="Conducteur" />
        <div className="flex">
          {/* Rail conducteurs (caché en mobile) */}
          <div className="hidden w-44 shrink-0 space-y-2 border-r border-slate-100 bg-slate-50/60 p-3 md:block">
            {[
              { d: 'Journal 12h', date: 'mardi', active: true, n: 6 },
              { d: 'Journal 08h', date: 'lundi', n: 5 },
              { d: 'Journal 18h', date: 'lundi', n: 7 },
            ].map((c, i) => (
              <div
                key={i}
                className={`rounded-lg border bg-white p-2.5 ${
                  c.active ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-6 w-1 rounded-full ${c.active ? 'bg-blue-500' : 'bg-orange-400'}`} />
                  <div className="text-[11px] font-semibold text-slate-800">{c.d}</div>
                </div>
                <div className="mt-1 text-[9px] text-slate-400">Brouillon · {c.n} éléments</div>
              </div>
            ))}
          </div>

          {/* Éditeur */}
          <div className="min-w-0 flex-1 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">Journal 12h</div>
                <div className="text-[10px] text-slate-400">mardi 2 juin 2026</div>
              </div>
              <div className="hidden gap-1.5 sm:flex">
                {['Sync GDocs', 'Script', 'Prompteur'].map((b) => (
                  <span key={b} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Minutage */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold tabular-nums text-slate-700">
                <Clock className="h-3.5 w-3.5" /> 4:58 / 6:00
              </span>
              <span className="text-[11px] font-medium text-amber-600">⚠ 1:02</span>
            </div>

            {/* Lignes */}
            <div className="mt-3 space-y-1.5">
              {RUNDOWN.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 ${
                    r.air ? 'border-red-300 bg-red-50/40 ring-1 ring-red-200' : 'border-slate-200'
                  }`}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">{r.t}</span>
                  {r.air ? (
                    <Radio className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <span
                    className={`flex-1 truncate text-[12px] ${
                      r.story ? 'font-medium text-blue-600' : 'font-semibold text-slate-800'
                    }`}
                  >
                    {r.title}
                  </span>
                  {r.audio && (
                    <span className="hidden items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 sm:inline-flex">
                      <Music className="h-2.5 w-2.5" /> AUDIO {r.audio}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">{r.dur}</span>
                  <StatusPill
                    label={r.tone === 'air' ? 'À l’antenne' : r.tone === 'ready' ? 'Prêt' : 'Terminé'}
                    tone={r.tone}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 text-center">
              <span className="rounded-md border border-slate-200 px-3 py-1.5 text-[10px] text-slate-500">
                + Ajouter un élément
              </span>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ---------- Éditeur audio (sombre) ---------- */
function Waveform() {
  const bars = Array.from({ length: 140 }, (_, i) => {
    const env = 0.35 + 0.5 * Math.abs(Math.sin(i * 0.18)) * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.05)));
    return Math.round(env * 100);
  });
  return (
    <div className="relative h-40 overflow-hidden rounded-md bg-slate-800/60">
      {/* lignes dB */}
      {[18, 40, 60, 82].map((top) => (
        <div key={top} className="absolute left-0 right-0 h-px bg-slate-600/40" style={{ top: `${top}%` }} />
      ))}
      <div className="absolute inset-0 flex items-center gap-[1px] px-2">
        {bars.map((h, i) => {
          const sel = i > 18 && i < 64; // zone bleue (sélection/lecture)
          return (
            <span
              key={i}
              className={`w-[2px] rounded-full ${sel ? 'bg-blue-400' : 'bg-slate-500'}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <span className="absolute left-1 top-1 text-[8px] text-red-400">0 dB</span>
      <span className="absolute bottom-1 left-1 text-[8px] text-red-400">0 dB</span>
    </div>
  );
}

export function AudioEditorPreview() {
  const tools = ['🔍−', '🔍+', 'IN', 'OUT', '✂ Couper', '✨ Optimiser', 'Normaliser', 'Fondu ↗', 'Fondu ↘', '−1 dB', '+1 dB', 'Limiteur'];
  return (
    <BrowserFrame url="redacnews.link/audio-editor" dark>
      <div className="bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold">Éditer le son</div>
            <div className="text-[10px] text-slate-400">interview marché (montée)</div>
          </div>
          <span className="text-[11px] text-slate-400">✕ Fermer</span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {tools.map((t, i) => (
            <span
              key={i}
              className={`rounded-md px-2 py-1 text-[10px] ${
                t === '✂ Couper'
                  ? 'bg-red-600 text-white'
                  : t === '✨ Optimiser'
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-600 text-slate-200'
              }`}
            >
              {t}
            </span>
          ))}
          <span className="ml-1 text-[10px] tabular-nums text-slate-400">niveau −18.0 · crête −4.1 dB</span>
        </div>
        <Waveform />
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
            <Play className="h-3.5 w-3.5 text-white" />
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-slate-700">
            <div className="h-1.5 w-1/4 rounded-full bg-blue-500" />
          </div>
          <span className="text-[10px] tabular-nums text-slate-400">0:08 / 0:35</span>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ---------- Médiathèque ---------- */
const MEDIA = [
  { title: 'Virgule JT', dur: '0:08', who: 'Léa M.' },
  { title: 'Interview maire', dur: '1:24', who: 'Tom B.' },
  { title: 'Ambiance marché', dur: '0:35', who: 'Léa M.' },
  { title: 'Flash info', dur: '0:30', who: 'Sam R.' },
  { title: 'Jingle météo', dur: '0:06', who: 'Tom B.' },
  { title: 'Micro-trottoir', dur: '2:15', who: 'Léa M.' },
  { title: 'Reportage festival', dur: '1:43', who: 'Sam R.' },
  { title: 'Conférence presse', dur: '12:30', who: 'Tom B.' },
];

export function MediathequePreview() {
  return (
    <BrowserFrame url="redacnews.link/mediatheque">
      <div className="bg-white p-4">
        <AppNav active="Médiathèque" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MEDIA.map((m, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="relative flex h-16 items-center justify-center bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                  <Music className="h-4 w-4 text-purple-500" />
                </span>
                <span className="absolute bottom-1 right-1 rounded bg-slate-900/80 px-1 py-0.5 text-[8px] text-white">
                  {m.dur}
                </span>
              </div>
              <div className="p-2">
                <div className="truncate text-[11px] font-medium text-slate-800">{m.title}</div>
                <div className="text-[9px] text-slate-400">{m.who}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ---------- Sujets ---------- */
const SUJETS = [
  { title: 'Conseil municipal', who: 'Léa Martin', dur: '1:52', st: 'Validé', tone: 'ready' as const },
  { title: 'Travaux tramway', who: 'Tom Bernard', dur: '0:43', st: 'Validé', tone: 'ready' as const },
  { title: 'Festival d’été', who: 'Sam Roussel', dur: '0:38', st: 'En révision', tone: 'review' as const },
  { title: 'Météo régionale', who: 'Léa Martin', dur: '0:30', st: 'Brouillon', tone: 'draft' as const },
  { title: 'Économie locale', who: 'Tom Bernard', dur: '1:10', st: 'Publié', tone: 'pub' as const },
  { title: 'Brève sport', who: 'Sam Roussel', dur: '0:17', st: 'Validé', tone: 'ready' as const },
];

export function SujetsPreview() {
  const toneCls = (t: string) =>
    t === 'ready'
      ? 'bg-emerald-50 text-emerald-600'
      : t === 'review'
        ? 'bg-amber-50 text-amber-600'
        : t === 'pub'
          ? 'bg-blue-50 text-blue-600'
          : 'bg-slate-100 text-slate-500';
  return (
    <BrowserFrame url="redacnews.link/sujets">
      <div className="bg-white p-4">
        <AppNav active="Sujets" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUJETS.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-slate-800">{s.title}</div>
                  <div className="text-[9px] text-slate-400">
                    {s.who} · {s.dur}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <span className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${toneCls(s.tone)}`}>
                  {s.st}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ---------- Prompteur ---------- */
export function PrompteurPreview() {
  return (
    <BrowserFrame url="redacnews.link/prompteur" dark>
      <div className="bg-slate-950 px-6 py-5 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-semibold">Journal 12h</div>
            <div className="text-[9px] text-slate-500">mardi 2 juin 2026</div>
          </div>
          <span className="font-mono text-base font-bold tabular-nums text-red-500">13:52:35</span>
        </div>
        <div className="border-t border-amber-500/40 pt-4 text-[17px] leading-relaxed text-slate-50 sm:text-xl">
          Méfiance dans la circulation également pour cause de travaux partout dans
          l’agglomération, on fait le point.
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400">
          <span className="rounded bg-emerald-600 px-2 py-1 font-medium text-white">▶ Lecture</span>
          <span>Vitesse 1.0x · Taille 36px · Plein écran</span>
        </div>
      </div>
    </BrowserFrame>
  );
}
