import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Radio,
  LayoutDashboard,
  FileText,
  FolderOpen,
  AudioLines,
  Presentation,
  Bot,
  Users,
  Globe,
  Sparkles,
  Clock,
  ShieldCheck,
  ArrowRight,
  Check,
  RadioTower,
  Inbox,
  CalendarCheck,
  BellRing,
  Share2,
  Podcast,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ConducteurPreview,
  MediathequePreview,
  SujetsPreview,
  ScreenshotFrame,
} from '@/components/marketing/AppPreviews';
// Import statique → les images sont bundlées dans .next/static (servi par Amplify),
// contrairement à public/ qui n'est pas exposé avec output: 'standalone'.
import editeurAudioImg from '@/public/screenshots/editeur-audio.png';
import prompteurImg from '@/public/screenshots/prompteur.png';

export const metadata: Metadata = {
  title: 'RedacNews — La suite tout-en-un pour les rédactions radio',
  description:
    "Conducteur, sujets, médiathèque, montage audio, prompteur et assistant IA : RedacNews réunit tout le flux de production d'une radio dans un seul outil web collaboratif.",
};

const MODULES = [
  {
    icon: LayoutDashboard,
    name: 'Conducteur',
    desc: "Le déroulé minute par minute de vos journaux et émissions. Minutage automatique, glisser-déposer, statuts en couleur, et génération de la conduite prête à l'antenne.",
  },
  {
    icon: FileText,
    name: 'Sujets',
    desc: "Rédaction dans Google Docs intégré, avec calcul du temps de lecture en direct et distinction lancement / reportage / pied pour le présentateur.",
  },
  {
    icon: FolderOpen,
    name: 'Médiathèque',
    desc: 'Tous vos sons, interviews et virgules au même endroit. Transcription automatique, recherche full-text et collections partagées par la rédaction.',
  },
  {
    icon: AudioLines,
    name: 'Montage audio',
    desc: "Enregistrement micro, montage, optimisation voix, limiteur de loudness et export MP3 — directement dans le navigateur, sans logiciel à installer.",
  },
  {
    icon: Presentation,
    name: 'Prompteur',
    desc: "Affichage plein écran synchronisé avec le conducteur pour la lecture à l'antenne, en mode régie.",
  },
  {
    icon: Bot,
    name: 'Assistant IA',
    desc: 'Retrouvez un sujet ou un son en langage naturel et laissez l’IA vous aider à préparer vos contenus.',
  },
];

const VALUES = [
  { icon: Users, title: 'Collaboratif', desc: 'Toute la rédaction travaille sur les mêmes contenus, en temps réel.' },
  { icon: Globe, title: '100% web', desc: 'Rien à installer. Accessible depuis le studio, la maison ou le terrain.' },
  { icon: Radio, title: 'Pensé pour la radio', desc: 'Minutage, lancement/pied, conduite : le vocabulaire et les usages de l’antenne.' },
  { icon: Sparkles, title: 'IA intégrée', desc: 'Transcription, recherche intelligente et assistance à la rédaction.' },
  { icon: Clock, title: 'Du brief à l’antenne', desc: 'Un seul flux, de la collecte à la diffusion, sans ressaisie.' },
  { icon: ShieldCheck, title: 'Hébergé en Europe', desc: 'Infrastructure AWS, données hébergées dans l’UE.' },
];

const STEPS = [
  { n: '1', title: 'Collectez', desc: 'Déposez sons et interviews dans la médiathèque, enregistrez au micro.' },
  { n: '2', title: 'Rédigez', desc: 'Écrivez vos sujets, montez vos sons, calez les durées.' },
  { n: '3', title: 'Construisez', desc: 'Assemblez le conducteur — le minutage se calcule tout seul.' },
  { n: '4', title: 'Diffusez', desc: 'Générez la conduite et lisez au prompteur, à l’antenne.' },
];

// Tanguy : le volet « programmation & diffusion » de l'écosystème.
const TANGUY = [
  {
    icon: Inbox,
    title: 'Réception des contenus',
    desc: 'Les contributeurs déposent leurs émissions via un lien unique, sans compte. Chaque fichier est sécurisé dès l’arrivée.',
  },
  {
    icon: CalendarCheck,
    title: 'Calendrier studio',
    desc: 'Réservation des studios par les bénévoles, validation par la régie, sans conflit de créneaux.',
  },
  {
    icon: BellRing,
    title: 'Veille de la grille',
    desc: 'Alertes automatiques quand une émission manque à l’approche de sa diffusion, ou quand un stock devient faible.',
  },
  {
    icon: Share2,
    title: 'Distribution réseau',
    desc: 'Envoi et récupération automatiques des émissions vers les réseaux partenaires, au bon format et au bon moment.',
  },
  {
    icon: Podcast,
    title: 'Publication podcast',
    desc: 'Mise en ligne des épisodes validés sur votre plateforme de podcast, en un clic.',
  },
  {
    icon: ShieldCheck,
    title: 'Journal de bord',
    desc: 'Toutes les actions tracées dans un historique inaltérable — qui a fait quoi, quand.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold">RedacNews</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Se connecter
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Créer un compte</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-50 to-white" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            Le NRCS web pour les radios
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Toute votre rédaction radio,{' '}
            <span className="text-blue-600">dans un seul outil</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Conducteur, sujets, médiathèque, montage audio, prompteur et assistant IA.
            De la collecte à l’antenne, RedacNews réunit tout le flux de production —
            collaboratif et 100% web.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Commencer <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Se connecter
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">Sans installation · accessible partout</p>
        </div>
      </section>

      {/* Aperçu principal — le Conducteur */}
      <div className="relative z-10 mx-auto -mt-8 max-w-5xl px-4 sm:-mt-14">
        <ConducteurPreview />
      </div>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">La suite tout-en-un</h2>
          <p className="mt-3 text-slate-600">
            Six modules qui couvrent l’ensemble de la chaîne de production radio.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="group rounded-2xl border border-slate-200 p-6 transition-all hover:border-blue-200 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{m.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Aperçu de l'outil */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Un aperçu de l’outil</h2>
            <p className="mt-3 text-slate-600">
              Une interface claire, pensée pour aller vite en rédaction comme en régie.
            </p>
          </div>

          <div className="mt-12 space-y-8">
            {/* Éditeur audio (pleine largeur) — vraie capture */}
            <div>
              <ScreenshotFrame
                src={editeurAudioImg.src}
                url="redacnews.link/audio-editor"
                alt="Éditeur audio de RedacNews — montage, optimisation et export"
                dark
              />
              <p className="mt-3 text-center text-sm text-slate-500">
                Éditeur audio intégré — enregistrement, montage, optimisation et export, dans le navigateur.
              </p>
            </div>

            {/* Médiathèque + Sujets */}
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <MediathequePreview />
                <p className="mt-3 text-center text-sm text-slate-500">
                  Médiathèque partagée, recherche et transcription automatique.
                </p>
              </div>
              <div>
                <SujetsPreview />
                <p className="mt-3 text-center text-sm text-slate-500">
                  Sujets avec statuts, durées de lecture et workflow de validation.
                </p>
              </div>
            </div>

            {/* Prompteur — vraie capture */}
            <div>
              <ScreenshotFrame
                src={prompteurImg.src}
                url="redacnews.link/prompteur"
                alt="Prompteur de RedacNews — lecture à l'antenne"
                dark
              />
              <p className="mt-3 text-center text-sm text-slate-500">
                Prompteur plein écran, synchronisé au conducteur pour l’antenne.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pensé pour les radios</h2>
            <p className="mt-3 text-slate-600">
              Conçu avec et pour les rédactions, du studio au direct.
            </p>
          </div>
          <div className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                  <v.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Un seul flux, du brief à l’antenne</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tanguy — volet programmation & diffusion */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-300">
              <RadioTower className="h-3.5 w-3.5" />
              L’écosystème continue
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Et pour la programmation : <span className="text-blue-400">Tanguy</span>
            </h2>
            <p className="mt-3 text-slate-300">
              Là où RedacNews gère la <strong className="text-white">production</strong> au quotidien,
              Tanguy est la <strong className="text-white">tour de contrôle des programmes</strong> :
              réception des contenus, suivi des émissions, et distribution vers vos réseaux et podcasts.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TANGUY.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-blue-400/40"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{t.desc}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-400">
            Ensemble, RedacNews et Tanguy couvrent toute la chaîne — de l’idée du sujet
            jusqu’à la diffusion sur l’antenne, le réseau et le podcast.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-20">
        <div className="overflow-hidden rounded-3xl bg-blue-600 px-6 py-14 text-center text-white sm:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Prêt à moderniser votre rédaction ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-blue-100">
            Faites passer toute votre production radio sur un seul outil.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="gap-2 text-blue-700">
                Créer un compte <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Se connecter
              </Button>
            </Link>
          </div>
          <ul className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-blue-100">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" /> 100% web
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Collaboratif
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Hébergé en Europe
            </li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-slate-700">RedacNews</span>
          </div>
          <p>© 2026 RedacNews — Newsroom management system</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-900">
              Connexion
            </Link>
            <Link href="/register" className="hover:text-slate-900">
              Créer un compte
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
