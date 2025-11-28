# CLAUDE.md - Contexte Projet RédacNews

> **Ce fichier est le contexte de développement pour Claude Code.**
> Il contient toutes les informations nécessaires pour développer RédacNews de manière autonome.

---

## 🔗 GITHUB & WORKFLOW

### Repository

- **Owner** : simonmarty-44130
- **URL** : https://github.com/simonmarty-44130
- **Repo à créer** : `redacnews`
- **URL finale** : https://github.com/simonmarty-44130/redacnews

### Instructions de setup initial

```bash
# 1. Créer le repo sur GitHub (via CLI ou interface web)
gh repo create redacnews --public --description "NRCS SaaS pour radios - Newsroom management system"

# 2. Cloner et initialiser
git clone https://github.com/simonmarty-44130/redacnews.git
cd redacnews

# 3. Initialiser le projet (voir section INITIALISATION PROJET)
# ... suivre les étapes ci-dessous ...

# 4. Premier commit
git add .
git commit -m "🎉 Initial commit - Project setup"
git push origin main
```

### Workflow de développement

**Branches** :
- `main` : Production stable
- `develop` : Intégration des features
- `feature/*` : Nouvelles fonctionnalités
- `fix/*` : Corrections de bugs

**Convention de commits** (Conventional Commits) :
```
feat: ✨ nouvelle fonctionnalité
fix: 🐛 correction de bug
docs: 📚 documentation
style: 💄 formatting, missing semicolons, etc.
refactor: ♻️ refactoring code
test: ✅ ajout de tests
chore: 🔧 maintenance, dépendances
```

**Workflow itératif recommandé** :

```bash
# Pour chaque nouvelle feature
git checkout develop
git pull origin develop
git checkout -b feature/nom-de-la-feature

# Développer, tester, commiter régulièrement
git add .
git commit -m "feat: description de la feature"

# Quand la feature est prête
git push origin feature/nom-de-la-feature

# Créer une Pull Request vers develop
# Après review/merge, supprimer la branche locale
git checkout develop
git pull origin develop
git branch -d feature/nom-de-la-feature
```

### Structure des commits par phase

**Phase 1 - Setup (Semaine 1-2)** :
```
🎉 Initial commit - Project setup
🔧 chore: configure Turborepo monorepo
🔧 chore: setup Next.js 14 with App Router
🔧 chore: configure Prisma + Amazon RDS PostgreSQL
🔐 feat: integrate Amazon Cognito authentication
🎨 feat: create main dashboard layout
🔌 feat: setup tRPC API layer
🚀 chore: deploy to AWS Amplify
```

**Phase 2 - Conducteur (Semaine 3-4)** :
```
📊 feat(conducteur): add Show and Rundown models
🔌 feat(conducteur): create CRUD API endpoints
📋 feat(conducteur): rundown list page
✏️ feat(conducteur): rundown editor with drag&drop
⏱️ feat(conducteur): automatic timer calculation
🔄 feat(conducteur): real-time collaboration with Yjs
```

**Phase 3 - Sujets (Semaine 5-6)** :
```
📝 feat(sujets): add Story model
🔗 feat(sujets): Google Docs API integration
📋 feat(sujets): stories list with filters
✏️ feat(sujets): story editor with Google Docs embed
📎 feat(sujets): link stories to rundown items
```

**Phase 4 - Médiathèque (Semaine 7-8)** :
```
🗄️ feat(media): add MediaItem and Collection models
☁️ feat(media): AWS S3 upload with presigned URLs
📁 feat(media): media library grid/list view
🎵 feat(media): inline audio player with waveform
✂️ feat(media): AudioMass editor integration
💾 feat(media): export edited audio to library
```

### Fichiers à ne JAMAIS commiter

Créer un `.gitignore` à la racine :

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
.next/
out/
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Prisma
packages/db/prisma/*.db
packages/db/prisma/*.db-journal

# Vercel
.vercel

# Testing
coverage/
.nyc_output/

# Turbo
.turbo/
```

### Variables d'environnement

Créer un fichier `.env.example` pour documenter les variables nécessaires (sans les valeurs sensibles) :

```bash
# App
NEXT_PUBLIC_APP_URL=

# AWS General
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Amazon Cognito (Auth)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_COGNITO_DOMAIN=

# Amazon RDS PostgreSQL (Database)
DATABASE_URL=postgresql://user:password@host.eu-west-3.rds.amazonaws.com:5432/redacnews

# Amazon ElastiCache Redis (Cache & Realtime)
REDIS_URL=redis://host.cache.amazonaws.com:6379

# Amazon S3 (Storage)
AWS_S3_BUCKET=redacnews-media
AWS_S3_BUCKET_REGION=eu-west-3

# Amazon CloudFront (CDN)
AWS_CLOUDFRONT_DOMAIN=xxxxx.cloudfront.net
AWS_CLOUDFRONT_DISTRIBUTION_ID=

# Amazon OpenSearch (Search)
OPENSEARCH_ENDPOINT=https://xxxxx.eu-west-3.es.amazonaws.com

# Amazon SES (Email)
AWS_SES_FROM_EMAIL=noreply@redacnews.fr

# Amazon Transcribe (Audio to Text)
# (utilise les credentials AWS généraux)

# Google APIs (pour Google Docs)
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_DRIVE_FOLDER_ID=

# WebSocket (API Gateway ou auto-hébergé)
NEXT_PUBLIC_WEBSOCKET_URL=wss://xxxxx.execute-api.eu-west-3.amazonaws.com/prod
```

---

## 🎯 VISION PRODUIT

### Qu'est-ce que RédacNews ?

**RédacNews** est un **NRCS (Newsroom Computer System) SaaS** destiné aux **petites et moyennes radios (3-20 salariés)**. C'est un outil tout-en-un, collaboratif, 100% web, permettant aux journalistes radio de :

1. **Gérer leurs conducteurs (rundowns)** - Planning des émissions
2. **Rédiger leurs sujets** - Via Google Docs intégré
3. **Monter leur audio** - Éditeur intégré (basé sur AudioMass)
4. **Partager une médiathèque** - Sons, interviews, virgules
5. **Diffuser à l'antenne** - Prompteur web synchronisé

### Philosophie produit

| Principe | Application |
|----------|-------------|
| **Simplicité** | UX intuitive, pas de formation nécessaire |
| **Collaboration** | Temps réel, tout partagé |
| **Économique** | Stack cloud optimisée, pas d'infra on-premise |
| **Moderne** | PWA, mobile-first, IA intégrée |
| **Ouvert** | APIs, exports standards |

### Utilisateurs cibles

- **Journalistes** : Rédaction, montage, présentation
- **Rédacteurs en chef** : Validation, planification
- **Techniciens** : Configuration, intégrations
- **Pigistes** : Accès limité, contribution externe

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Stack technologique (100% AWS)

```
FRONTEND
├── Next.js 14 (App Router)
├── TypeScript (strict mode)
├── Tailwind CSS + shadcn/ui
├── Zustand (state management)
├── React Query (data fetching)
├── Yjs (collaboration temps réel)
└── AudioMass (éditeur audio - fork customisé)

BACKEND
├── Next.js API Routes + tRPC
├── Prisma ORM
└── Hébergé sur AWS Amplify ou EC2/ECS

BASE DE DONNÉES & CACHE (AWS)
├── Amazon RDS PostgreSQL (base de données principale)
├── Amazon ElastiCache Redis (cache, sessions, realtime)
└── Amazon DynamoDB (optionnel - données temps réel)

STOCKAGE & CDN (AWS)
├── Amazon S3 (stockage média, documents)
├── Amazon CloudFront (CDN global)
└── S3 Intelligent-Tiering (optimisation coûts)

SERVICES IA & MÉDIA (AWS)
├── Amazon Transcribe (transcription audio → texte)
├── Amazon Polly (optionnel - texte → audio)
├── Amazon Comprehend (optionnel - analyse de texte, résumés)
└── Amazon Rekognition (optionnel - analyse images)

AUTHENTIFICATION (AWS)
├── Amazon Cognito (auth, SSO, MFA)
├── User Pools (gestion utilisateurs)
└── Identity Pools (accès AWS services)

RECHERCHE (AWS)
└── Amazon OpenSearch Serverless (recherche full-text)

COMMUNICATION (AWS)
├── Amazon SES (emails transactionnels)
├── Amazon SNS (notifications push)
└── Amazon API Gateway WebSocket (temps réel)

MONITORING & LOGS (AWS)
├── Amazon CloudWatch (logs, métriques)
├── AWS X-Ray (tracing)
└── Amazon CloudWatch Alarms (alertes)

INFRASTRUCTURE (AWS)
├── AWS Amplify (déploiement frontend) OU
├── Amazon ECS Fargate (containers serverless)
├── AWS Lambda (fonctions serverless)
└── Amazon VPC (réseau privé)

INTEGRATIONS EXTERNES
├── Google Drive API (documents collaboratifs)
├── Google Docs API (édition texte)
└── AFP/Reuters feeds (futur)
```

### Pourquoi 100% AWS ?

| Avantage | Description |
|----------|-------------|
| **Cohérence** | Une seule console, une seule facturation |
| **Intégration native** | Tous les services communiquent facilement |
| **Sécurité** | IAM, VPC, encryption at rest/transit |
| **Scalabilité** | Auto-scaling sur tous les services |
| **Coûts optimisés** | Free tier généreux, pay-as-you-go |
| **Compliance** | RGPD, SOC2, ISO 27001 |

### Structure du monorepo

```
redacnews/
├── apps/
│   ├── web/                    # Application Next.js principale
│   │   ├── app/
│   │   │   ├── (auth)/         # Routes authentification
│   │   │   ├── (dashboard)/    # Routes protégées
│   │   │   │   ├── conducteur/
│   │   │   │   ├── sujets/
│   │   │   │   ├── mediatheque/
│   │   │   │   ├── prompteur/
│   │   │   │   └── settings/
│   │   │   ├── api/
│   │   │   │   └── trpc/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── conducteur/
│   │   │   ├── sujets/
│   │   │   ├── mediatheque/
│   │   │   ├── audio-editor/   # AudioMass integration
│   │   │   └── prompteur/
│   │   ├── lib/
│   │   │   ├── trpc/
│   │   │   ├── google/         # Google APIs wrappers
│   │   │   ├── audio/          # Audio processing utils
│   │   │   └── utils/
│   │   └── hooks/
│   └── mobile/                 # PWA / React Native (futur)
├── packages/
│   ├── db/                     # Prisma schema + client
│   ├── api/                    # tRPC routers
│   ├── types/                  # Types partagés
│   ├── audio-editor/           # AudioMass fork package
│   └── config/                 # ESLint, TypeScript configs
├── docker-compose.yml
├── turbo.json
└── package.json
```

### Schéma de base de données (Prisma)

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ ORGANISATION ============

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logo      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users       User[]
  shows       Show[]
  stories     Story[]
  mediaItems  MediaItem[]
  collections Collection[]
}

model User {
  id             String   @id @default(cuid())
  cognitoId      String   @unique  // Amazon Cognito User Sub
  email          String   @unique
  firstName      String?
  lastName       String?
  avatarUrl      String?
  role           UserRole @default(JOURNALIST)
  organizationId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  
  stories         Story[]         @relation("StoryAuthor")
  assignedStories Story[]         @relation("StoryAssignee")
  rundownItems    RundownItem[]
  mediaItems      MediaItem[]
  comments        Comment[]
}

enum UserRole {
  ADMIN
  EDITOR_IN_CHIEF
  JOURNALIST
  TECHNICIAN
  FREELANCER
}

// ============ ÉMISSIONS & CONDUCTEURS ============

model Show {
  id             String   @id @default(cuid())
  name           String
  description    String?
  defaultDuration Int      @default(60) // minutes
  color          String   @default("#3B82F6")
  organizationId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  rundowns     Rundown[]
}

model Rundown {
  id          String        @id @default(cuid())
  showId      String
  date        DateTime
  status      RundownStatus @default(DRAFT)
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  show  Show          @relation(fields: [showId], references: [id])
  items RundownItem[]
}

enum RundownStatus {
  DRAFT
  READY
  ON_AIR
  ARCHIVED
}

model RundownItem {
  id          String          @id @default(cuid())
  rundownId   String
  storyId     String?
  type        RundownItemType
  title       String
  duration    Int             // secondes
  position    Int
  notes       String?
  status      ItemStatus      @default(PENDING)
  assigneeId  String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  rundown  Rundown  @relation(fields: [rundownId], references: [id], onDelete: Cascade)
  story    Story?   @relation(fields: [storyId], references: [id])
  assignee User?    @relation(fields: [assigneeId], references: [id])
  media    RundownItemMedia[]
}

enum RundownItemType {
  STORY       // Sujet rédactionnel
  INTERVIEW   // Interview/Son
  JINGLE      // Virgule/Jingle
  MUSIC       // Musique
  LIVE        // Direct
  BREAK       // Pause pub
  OTHER       // Autre
}

enum ItemStatus {
  PENDING
  IN_PROGRESS
  READY
  ON_AIR
  DONE
}

model RundownItemMedia {
  id            String @id @default(cuid())
  rundownItemId String
  mediaItemId   String
  position      Int

  rundownItem RundownItem @relation(fields: [rundownItemId], references: [id], onDelete: Cascade)
  mediaItem   MediaItem   @relation(fields: [mediaItemId], references: [id])
}

// ============ SUJETS ============

model Story {
  id             String      @id @default(cuid())
  title          String
  slug           String
  googleDocId    String?     // ID du Google Doc lié
  googleDocUrl   String?
  content        String?     @db.Text // Backup du contenu
  summary        String?
  status         StoryStatus @default(DRAFT)
  category       String?
  tags           String[]
  estimatedDuration Int?     // secondes
  authorId       String
  assigneeId     String?
  organizationId String
  publishedAt    DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  author       User          @relation("StoryAuthor", fields: [authorId], references: [id])
  assignee     User?         @relation("StoryAssignee", fields: [assigneeId], references: [id])
  organization Organization  @relation(fields: [organizationId], references: [id])
  
  rundownItems RundownItem[]
  media        StoryMedia[]
  comments     Comment[]
}

enum StoryStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

model StoryMedia {
  id          String @id @default(cuid())
  storyId     String
  mediaItemId String
  position    Int
  notes       String?

  story     Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)
  mediaItem MediaItem @relation(fields: [mediaItemId], references: [id])
}

// ============ MÉDIATHÈQUE ============

model MediaItem {
  id              String        @id @default(cuid())
  title           String
  description     String?
  type            MediaType
  mimeType        String
  fileSize        Int           // bytes
  duration        Int?          // secondes (pour audio/video)
  s3Key           String
  s3Url           String
  thumbnailUrl    String?
  waveformData    Json?         // Données waveform pour affichage
  transcription   String?       @db.Text
  transcriptionStatus TranscriptionStatus @default(NONE)
  tags            String[]
  uploadedById    String
  organizationId  String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  uploadedBy   User         @relation(fields: [uploadedById], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  collections     CollectionItem[]
  storyMedia      StoryMedia[]
  rundownItemMedia RundownItemMedia[]
}

enum MediaType {
  AUDIO
  VIDEO
  IMAGE
  DOCUMENT
}

enum TranscriptionStatus {
  NONE
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}

model Collection {
  id             String   @id @default(cuid())
  name           String
  description    String?
  color          String   @default("#6366F1")
  isPublic       Boolean  @default(true)
  organizationId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization     @relation(fields: [organizationId], references: [id])
  items        CollectionItem[]
}

model CollectionItem {
  id           String @id @default(cuid())
  collectionId String
  mediaItemId  String
  position     Int
  addedAt      DateTime @default(now())

  collection Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  mediaItem  MediaItem  @relation(fields: [mediaItemId], references: [id])

  @@unique([collectionId, mediaItemId])
}

// ============ COMMENTAIRES ============

model Comment {
  id        String   @id @default(cuid())
  content   String
  storyId   String
  authorId  String
  parentId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  story    Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)
  author   User      @relation(fields: [authorId], references: [id])
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies  Comment[] @relation("CommentReplies")
}
```

---

## 📐 SPÉCIFICATIONS FONCTIONNELLES

### Module 1 : Conducteur (Rundown)

#### Description
Le conducteur est le planning minute par minute d'une émission radio. C'est l'écran principal utilisé en régie.

#### Fonctionnalités

| Feature | Priorité | Description |
|---------|----------|-------------|
| Création/édition | P0 | Créer un conducteur pour une émission et une date |
| Drag & drop | P0 | Réorganiser les éléments par glisser-déposer |
| Timer automatique | P0 | Calcul automatique des heures de passage |
| Collaboration temps réel | P0 | Voir les modifications des autres en direct |
| Statuts visuels | P0 | Couleurs selon statut (en attente, prêt, à l'antenne) |
| Ajout rapide | P1 | Ajouter sujet, son, jingle, pause pub |
| Lien vers sujet | P1 | Ouvrir le sujet associé dans un panneau latéral |
| Lien vers média | P1 | Preview audio inline |
| Export PDF | P2 | Export pour impression |
| Duplication | P2 | Dupliquer un conducteur existant |

#### UI/UX

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RédacNews    [Conducteur] [Sujets] [Médiathèque]    🔔  👤 Marie D.   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ◀ 27 nov    JT Midi - 28 novembre 2025    29 nov ▶    [📤] [🖨️]     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ⏱️ 12:00:00  TOTAL: 58:30 / 60:00  ⚠️ -1:30                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────┬────────────────────────────────────────┬───────┬───────────┐  │
│  │HEURE│ ÉLÉMENT                                │ DURÉE │ STATUT    │  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │12:00│ 🎵 Jingle ouverture                    │ 0:15  │ ✅ Prêt   │  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │12:00│ 📝 Lancement - Sommaire                │ 0:45  │ ✅ Prêt   │  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │12:01│ 📝 Grève SNCF - Perturbations          │ 2:30  │ ⏳ EnCours│  │
│  │     │    └─ 🔊 ITW Usager Gare du Nord       │       │ ✅        │  │
│  │     │    └─ 🔊 ITW Dir. Communication SNCF   │       │ ⏳        │  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │12:03│ 📝 Météo                               │ 1:00  │ ⏳ EnCours│  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │12:04│ ⏸️  Pause pub                          │ 3:00  │ ✅ Prêt   │  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │12:07│ 📝 Économie locale - Nouveau centre    │ 3:30  │ 📝 Draft  │  │
│  │     │    └─ 🔊 ITW Maire                     │       │ 📝        │  │
│  ├─────┼────────────────────────────────────────┼───────┼───────────┤  │
│  │     │                                        │       │           │  │
│  │     │         [+ Ajouter un élément]         │       │           │  │
│  │     │                                        │       │           │  │
│  └─────┴────────────────────────────────────────┴───────┴───────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 💬 Notes: RDV téléphonique avec ministre à 11h45                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Implémentation technique

**Composant principal** : `apps/web/components/conducteur/RundownEditor.tsx`

```typescript
// Types
interface RundownItem {
  id: string;
  type: 'STORY' | 'INTERVIEW' | 'JINGLE' | 'MUSIC' | 'LIVE' | 'BREAK' | 'OTHER';
  title: string;
  duration: number; // secondes
  position: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE';
  storyId?: string;
  media?: { id: string; title: string; duration: number }[];
  assignee?: { id: string; name: string; avatar: string };
}

// Collaboration temps réel avec Yjs
// - Utiliser y-websocket pour la synchronisation
// - Chaque rundown = un document Yjs
// - Awareness pour voir qui édite quoi
```

**Librairies à utiliser** :
- `@dnd-kit/core` + `@dnd-kit/sortable` pour le drag & drop
- `yjs` + `y-websocket` pour la collaboration temps réel
- `date-fns` pour les calculs de temps

---

### Module 2 : Sujets (Stories)

#### Description
Interface de rédaction des sujets journalistiques, avec intégration Google Docs pour l'édition collaborative du texte.

#### Fonctionnalités

| Feature | Priorité | Description |
|---------|----------|-------------|
| Liste des sujets | P0 | Vue liste avec filtres (statut, auteur, date) |
| Création sujet | P0 | Crée un sujet + Google Doc associé |
| Embed Google Docs | P0 | iFrame d'édition dans notre interface |
| Métadonnées sidebar | P0 | Titre, durée estimée, catégorie, tags |
| Attachement média | P0 | Lier des sons de la médiathèque |
| Workflow validation | P1 | Draft → Review → Approved → Published |
| Timer lecture | P1 | Estimation durée basée sur le texte |
| Historique versions | P2 | Via Google Docs |
| Commentaires | P2 | Panneau de discussion |

#### UI/UX

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RédacNews    [Conducteur] [Sujets] [Médiathèque]    🔔  👤 Marie D.   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Sujets    [+ Nouveau sujet]    🔍 Rechercher...    Filtres ▼          │
│                                                                         │
│  ┌────────────────────────────┬────────────────────────────────────┐   │
│  │                            │                                    │   │
│  │  LISTE DES SUJETS          │  SUJET : Grève SNCF               │   │
│  │                            │                                    │   │
│  │  ┌──────────────────────┐  │  ┌────────────────────────────┐   │   │
│  │  │ 📝 Grève SNCF        │◀─│──│  MÉTADONNÉES               │   │   │
│  │  │    Marie D. • 2h     │  │  │                            │   │   │
│  │  │    ⏳ En cours       │  │  │  Statut: [En cours ▼]      │   │   │
│  │  └──────────────────────┘  │  │  Durée: 2:30 (~450 mots)   │   │   │
│  │                            │  │  Catégorie: [Société ▼]    │   │   │
│  │  ┌──────────────────────┐  │  │  Tags: grève, transport    │   │   │
│  │  │ 📝 Météo weekend     │  │  │  Assigné: [Marie D. ▼]     │   │   │
│  │  │    Jean P. • 30min   │  │  │                            │   │   │
│  │  │    ✅ Validé         │  │  │  📎 MÉDIAS ATTACHÉS        │   │   │
│  │  └──────────────────────┘  │  │  🔊 ITW Usager (1:20)      │   │   │
│  │                            │  │  🔊 ITW SNCF (0:45)        │   │   │
│  │  ┌──────────────────────┐  │  │  [+ Ajouter média]         │   │   │
│  │  │ 📝 Économie locale   │  │  │                            │   │   │
│  │  │    Pierre L. • 1h    │  │  └────────────────────────────┘   │   │
│  │  │    📝 Brouillon      │  │                                    │   │
│  │  └──────────────────────┘  │  ┌────────────────────────────┐   │   │
│  │                            │  │                            │   │   │
│  │                            │  │    GOOGLE DOCS EMBED       │   │   │
│  │                            │  │                            │   │   │
│  │                            │  │  [iframe Google Docs ici]  │   │   │
│  │                            │  │                            │   │   │
│  │                            │  │  La grève à la SNCF se     │   │   │
│  │                            │  │  poursuit ce vendredi...   │   │   │
│  │                            │  │                            │   │   │
│  │                            │  │                            │   │   │
│  │                            │  └────────────────────────────┘   │   │
│  │                            │                                    │   │
│  │                            │  [Preview antenne] [Enregistrer]   │   │
│  │                            │                                    │   │
│  └────────────────────────────┴────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Intégration Google Docs

**Création d'un Google Doc** :

```typescript
// apps/web/lib/google/docs.ts

import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
  ],
});

const drive = google.drive({ version: 'v3', auth });
const docs = google.docs({ version: 'v1', auth });

export async function createStoryDoc(title: string, organizationFolderId: string) {
  // 1. Créer le document
  const doc = await docs.documents.create({
    requestBody: {
      title: `[RédacNews] ${title}`,
    },
  });

  const docId = doc.data.documentId!;

  // 2. Déplacer dans le dossier de l'organisation
  await drive.files.update({
    fileId: docId,
    addParents: organizationFolderId,
    fields: 'id, parents',
  });

  // 3. Partager avec l'organisation (anyone with link can edit)
  await drive.permissions.create({
    fileId: docId,
    requestBody: {
      role: 'writer',
      type: 'anyone',
    },
  });

  return {
    id: docId,
    url: `https://docs.google.com/document/d/${docId}/edit`,
    embedUrl: `https://docs.google.com/document/d/${docId}/edit?embedded=true`,
  };
}

export async function getDocContent(docId: string) {
  const doc = await docs.documents.get({ documentId: docId });
  // Extraire le texte brut pour backup/recherche
  let text = '';
  doc.data.body?.content?.forEach((element) => {
    if (element.paragraph?.elements) {
      element.paragraph.elements.forEach((e) => {
        if (e.textRun?.content) {
          text += e.textRun.content;
        }
      });
    }
  });
  return text;
}
```

**Composant Embed** :

```tsx
// apps/web/components/sujets/GoogleDocEmbed.tsx

'use client';

import { useEffect, useRef } from 'react';

interface GoogleDocEmbedProps {
  docId: string;
  className?: string;
}

export function GoogleDocEmbed({ docId, className }: GoogleDocEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // URL avec paramètres pour mode édition
  const embedUrl = `https://docs.google.com/document/d/${docId}/edit?embedded=true&rm=minimal`;

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full min-h-[500px] border-0 rounded-lg"
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
```

---

### Module 3 : Médiathèque

#### Description
Bibliothèque centralisée de tous les médias (sons, images, documents) partagée par toute la rédaction.

#### Fonctionnalités

| Feature | Priorité | Description |
|---------|----------|-------------|
| Upload drag & drop | P0 | Upload multiple, progress bar |
| Liste/Grille | P0 | Vue liste ou grille avec preview |
| Player inline | P0 | Écoute sans quitter la page |
| Waveform | P0 | Visualisation forme d'onde |
| Recherche | P0 | Full-text sur titre, description, tags |
| Métadonnées | P0 | Titre, description, tags, durée |
| Collections | P1 | Dossiers partagés ("Virgules", "ITW") |
| Transcription auto | P1 | AWS Transcribe à l'upload |
| Recherche transcription | P1 | Chercher dans le contenu audio |
| Éditeur audio | P1 | Ouvrir dans AudioMass intégré |
| Verrouillage | P2 | Qui édite en ce moment |
| Versioning | P2 | Historique des modifications |

#### UI/UX

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RédacNews    [Conducteur] [Sujets] [Médiathèque]    🔔  👤 Marie D.   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Médiathèque    [⬆️ Upload]    🔍 Rechercher...    [🎵][📷][📄] [≡][⊞]│
│                                                                         │
│  COLLECTIONS                   TOUS LES MÉDIAS (147)                   │
│  ┌──────────────────────┐     ┌────────────────────────────────────┐   │
│  │ 📁 Tous les médias   │     │                                    │   │
│  │ 📁 Mes uploads       │     │  ┌──────┐ ┌──────┐ ┌──────┐       │   │
│  │ ────────────────     │     │  │ 🔊   │ │ 🔊   │ │ 🔊   │       │   │
│  │ 🎵 Virgules (23)     │     │  │~~~~~~│ │~~~~~~│ │~~~~~~│       │   │
│  │ 🎵 Jingles (12)      │     │  │ITW   │ │Ambiance│ │Conf  │       │   │
│  │ 🎤 ITW récentes (45) │     │  │Maire │ │Marché │ │Presse│       │   │
│  │ 📰 Conférences (18)  │     │  │1:45  │ │3:20  │ │12:30 │       │   │
│  │ + Nouvelle collection│     │  └──────┘ └──────┘ └──────┘       │   │
│  └──────────────────────┘     │                                    │   │
│                               │  ┌──────┐ ┌──────┐ ┌──────┐       │   │
│  PLAYER                       │  │ 🔊   │ │ 🔊   │ │ 🔊   │       │   │
│  ┌──────────────────────┐     │  │~~~~~~│ │~~~~~~│ │~~~~~~│       │   │
│  │ ITW Maire - Centre   │     │  │Flash │ │Virgule│ │Micro │       │   │
│  │ ▶ ████████░░░░ 0:45  │     │  │Info  │ │JT    │ │Trottoir│     │   │
│  │ [⬇️][✏️][📋][🗑️]     │     │  │0:30  │ │0:08  │ │2:15  │       │   │
│  └──────────────────────┘     │  └──────┘ └──────┘ └──────┘       │   │
│                               │                                    │   │
│  DÉTAILS                      │          [Charger plus...]         │   │
│  ┌──────────────────────┐     │                                    │   │
│  │ Titre: ITW Maire     │     └────────────────────────────────────┘   │
│  │ Durée: 1:45          │                                              │
│  │ Uploadé: Marie D.    │                                              │
│  │ Date: 28/11/2025     │                                              │
│  │ Tags: #interview     │                                              │
│  │       #politique     │                                              │
│  │                      │                                              │
│  │ TRANSCRIPTION        │                                              │
│  │ ┌──────────────────┐ │                                              │
│  │ │"Nous allons      │ │                                              │
│  │ │ouvrir ce nouveau │ │                                              │
│  │ │centre commercial │ │                                              │
│  │ │dès le mois..."   │ │                                              │
│  │ └──────────────────┘ │                                              │
│  │ [Ouvrir dans éditeur]│                                              │
│  └──────────────────────┘                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Upload et traitement

```typescript
// apps/web/lib/media/upload.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const transcribe = new TranscribeClient({ region: process.env.AWS_REGION });

export async function getUploadUrl(filename: string, contentType: string, organizationId: string) {
  const key = `${organizationId}/${Date.now()}-${filename}`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return {
    uploadUrl,
    key,
    publicUrl: `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`,
  };
}

export async function startTranscription(mediaItemId: string, s3Key: string) {
  const jobName = `redacnews-${mediaItemId}-${Date.now()}`;
  
  await transcribe.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: 'fr-FR',
    Media: {
      MediaFileUri: `s3://${process.env.AWS_S3_BUCKET}/${s3Key}`,
    },
    OutputBucketName: process.env.AWS_S3_BUCKET,
    OutputKey: `transcriptions/${mediaItemId}.json`,
  }));

  return jobName;
}
```

---

### Module 4 : Éditeur Audio (AudioMass)

#### Description
Éditeur audio intégré basé sur AudioMass, permettant le montage basique directement dans le navigateur.

#### Fonctionnalités

| Feature | Priorité | Description |
|---------|----------|-------------|
| Chargement fichier | P0 | Depuis médiathèque ou upload |
| Waveform | P0 | Visualisation forme d'onde |
| Cut/Copy/Paste | P0 | Édition basique |
| Fade in/out | P0 | Transitions douces |
| Normalisation | P0 | Niveler le volume |
| Export MP3/WAV | P0 | Retour vers médiathèque |
| Undo/Redo | P0 | Historique des actions |
| Zoom | P0 | Zoom sur la timeline |
| Effets basiques | P1 | EQ, compression légère |
| Multitrack | P2 | Plusieurs pistes (v2) |
| Enregistrement | P2 | Capturer depuis micro |

#### Intégration AudioMass

AudioMass sera forké et intégré comme package dans le monorepo :

```
packages/audio-editor/
├── src/
│   ├── index.ts           # Export principal
│   ├── AudioMassEditor.tsx # Wrapper React
│   ├── core/              # Code AudioMass adapté
│   │   ├── app.js
│   │   ├── engine.js
│   │   ├── actions.js
│   │   └── ...
│   ├── hooks/
│   │   ├── useAudioEditor.ts
│   │   └── useWaveform.ts
│   └── types.ts
├── package.json
└── tsconfig.json
```

**Wrapper React** :

```tsx
// packages/audio-editor/src/AudioMassEditor.tsx

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AudioMassCore } from './core';

interface AudioMassEditorProps {
  audioUrl?: string;
  onSave?: (blob: Blob, format: 'mp3' | 'wav') => void;
  onClose?: () => void;
  className?: string;
}

export function AudioMassEditor({ audioUrl, onSave, onClose, className }: AudioMassEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<AudioMassCore | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      editorRef.current = new AudioMassCore(containerRef.current, {
        onExport: (blob, format) => {
          onSave?.(blob, format);
        },
      });
    }

    return () => {
      editorRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (audioUrl && editorRef.current) {
      editorRef.current.loadFromUrl(audioUrl);
    }
  }, [audioUrl]);

  const handleExport = useCallback((format: 'mp3' | 'wav') => {
    editorRef.current?.export(format);
  }, []);

  return (
    <div className={className}>
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
        <div className="flex gap-2">
          <button onClick={() => editorRef.current?.undo()} title="Annuler">
            ↩️ Annuler
          </button>
          <button onClick={() => editorRef.current?.redo()} title="Rétablir">
            ↪️ Rétablir
          </button>
          <span className="border-l mx-2" />
          <button onClick={() => editorRef.current?.cut()} title="Couper">
            ✂️ Couper
          </button>
          <button onClick={() => editorRef.current?.copy()} title="Copier">
            📋 Copier
          </button>
          <button onClick={() => editorRef.current?.paste()} title="Coller">
            📌 Coller
          </button>
          <span className="border-l mx-2" />
          <button onClick={() => editorRef.current?.fadeIn()} title="Fade In">
            🔊 Fade In
          </button>
          <button onClick={() => editorRef.current?.fadeOut()} title="Fade Out">
            🔈 Fade Out
          </button>
          <button onClick={() => editorRef.current?.normalize()} title="Normaliser">
            📊 Normaliser
          </button>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => handleExport('mp3')}
            className="bg-blue-500 text-white px-3 py-1 rounded"
          >
            💾 Exporter MP3
          </button>
          <button 
            onClick={() => handleExport('wav')}
            className="bg-gray-500 text-white px-3 py-1 rounded"
          >
            💾 Exporter WAV
          </button>
          {onClose && (
            <button onClick={onClose} className="text-gray-500">
              ✕ Fermer
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[400px]" />
    </div>
  );
}
```

---

### Module 5 : Prompteur

#### Description
Affichage plein écran des scripts pour lecture à l'antenne, synchronisé avec le conducteur.

#### Fonctionnalités

| Feature | Priorité | Description |
|---------|----------|-------------|
| Affichage fullscreen | P0 | Mode présentation |
| Sync conducteur | P0 | Affiche le sujet en cours |
| Défilement auto | P0 | Vitesse réglable |
| Contrôle clavier | P0 | Espace = pause, flèches = navigation |
| Taille police | P0 | Ajustable |
| Mode sombre | P0 | Pour régie |
| Timer | P1 | Temps restant |
| Miroir | P2 | Pour prompteur physique |

#### UI/UX

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                           [⚙️] [✕]     │
│                                                                         │
│                                                                         │
│                                                                         │
│                  GRÈVE SNCF : FORTE MOBILISATION                        │
│                                                                         │
│                                                                         │
│       La grève à la SNCF se poursuit ce vendredi avec                  │
│       une forte mobilisation des cheminots. Selon la                   │
│       direction, 60% des TGV sont annulés et seulement                 │
│       un TER sur trois circule en moyenne.                             │
│                                                                         │
│       >>> SON : Interview usager Gare du Nord (1:20) <<<               │
│                                                                         │
│       Les négociations entre la direction et les                       │
│       syndicats doivent reprendre lundi prochain.                      │
│                                                                         │
│                                                                         │
│                                                                         │
│─────────────────────────────────────────────────────────────────────────│
│  ▶ Défilement: [====●====] 1x    Police: [A-] [A+]    ⏱️ 2:15 restant │
│  [◀ Précédent]                                          [Suivant ▶]    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 GUIDES D'IMPLÉMENTATION

### Setup initial du projet

```bash
# 1. Créer le monorepo avec Turborepo
npx create-turbo@latest redacnews

# 2. Structure de base
cd redacnews
mkdir -p apps/web packages/{db,api,types,audio-editor,config}

# 3. Setup Next.js 14
cd apps/web
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"

# 4. Installer les dépendances principales
npm install @trpc/server @trpc/client @trpc/react-query @tanstack/react-query
npm install @prisma/client zustand yjs y-websocket
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install date-fns lucide-react clsx tailwind-merge
npm install googleapis

# 5. AWS SDK v3 (modulaire)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install @aws-sdk/client-transcribe
npm install @aws-sdk/client-ses
npm install @aws-sdk/client-cognito-identity-provider
npm install amazon-cognito-identity-js
npm install aws-amplify @aws-amplify/ui-react

# 6. Setup Prisma
cd packages/db
npm init -y
npm install prisma @prisma/client
npx prisma init

# 7. Installer shadcn/ui
cd apps/web
npx shadcn@latest init
npx shadcn@latest add button card input label select textarea dialog dropdown-menu tabs toast avatar badge
```

### Variables d'environnement

```bash
# apps/web/.env.local

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AWS General
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Amazon Cognito (Auth)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-3_xxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=redacnews.auth.eu-west-3.amazoncognito.com

# Amazon RDS PostgreSQL (Database)
DATABASE_URL=postgresql://postgres:password@redacnews.xxxxxxx.eu-west-3.rds.amazonaws.com:5432/redacnews

# Amazon ElastiCache Redis
REDIS_URL=redis://redacnews.xxxxxx.cache.amazonaws.com:6379

# Amazon S3 (Storage)
AWS_S3_BUCKET=redacnews-media

# Amazon CloudFront (CDN)
AWS_CLOUDFRONT_DOMAIN=xxxxxxx.cloudfront.net

# Amazon OpenSearch (Search)
OPENSEARCH_ENDPOINT=https://xxxxxxx.eu-west-3.es.amazonaws.com

# Amazon SES (Email)
AWS_SES_FROM_EMAIL=noreply@redacnews.fr

# Google APIs (pour Google Docs embed)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=xxx

# WebSocket
NEXT_PUBLIC_WEBSOCKET_URL=wss://xxxxxxx.execute-api.eu-west-3.amazonaws.com/prod
```

### Conventions de code

```typescript
// NAMING
// - Components: PascalCase (RundownEditor.tsx)
// - Hooks: camelCase avec préfixe "use" (useRundown.ts)
// - Utils: camelCase (formatDuration.ts)
// - Types: PascalCase avec suffixe si besoin (RundownItem, CreateRundownInput)
// - API routes: kebab-case (/api/rundowns/[id])

// STRUCTURE COMPOSANTS
// components/
//   conducteur/
//     RundownEditor.tsx       # Composant principal
//     RundownItem.tsx         # Sous-composant
//     RundownHeader.tsx       # Sous-composant
//     useRundown.ts           # Hook associé
//     rundown.types.ts        # Types locaux
//     index.ts                # Export barrel

// PATTERNS
// - Server Components par défaut
// - 'use client' uniquement si interactivité nécessaire
// - tRPC pour toutes les API calls
// - Zustand pour state global UI (pas pour data)
// - React Query (via tRPC) pour data fetching

// STYLE
// - Tailwind CSS uniquement (pas de CSS modules)
// - shadcn/ui pour composants de base
// - Pas de librairie CSS-in-JS
```

### Structure API (tRPC)

```typescript
// packages/api/src/routers/rundown.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const rundownRouter = router({
  // Lister les conducteurs
  list: protectedProcedure
    .input(z.object({
      showId: z.string().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.rundown.findMany({
        where: {
          show: { organizationId: ctx.organizationId },
          ...(input.showId && { showId: input.showId }),
          ...(input.from && { date: { gte: input.from } }),
          ...(input.to && { date: { lte: input.to } }),
        },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: { story: true, assignee: true },
          },
        },
        orderBy: { date: 'desc' },
      });
    }),

  // Obtenir un conducteur
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              story: true,
              assignee: true,
              media: { include: { mediaItem: true } },
            },
          },
        },
      });
    }),

  // Créer un conducteur
  create: protectedProcedure
    .input(z.object({
      showId: z.string(),
      date: z.date(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.rundown.create({
        data: input,
      });
    }),

  // Mettre à jour l'ordre des items
  reorderItems: protectedProcedure
    .input(z.object({
      rundownId: z.string(),
      itemIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = input.itemIds.map((id, index) =>
        ctx.db.rundownItem.update({
          where: { id },
          data: { position: index },
        })
      );
      await ctx.db.$transaction(updates);
      return { success: true };
    }),

  // Ajouter un item
  addItem: protectedProcedure
    .input(z.object({
      rundownId: z.string(),
      type: z.enum(['STORY', 'INTERVIEW', 'JINGLE', 'MUSIC', 'LIVE', 'BREAK', 'OTHER']),
      title: z.string(),
      duration: z.number(),
      storyId: z.string().optional(),
      position: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { rundownId, position, ...data } = input;
      
      // Si pas de position, ajouter à la fin
      const lastItem = await ctx.db.rundownItem.findFirst({
        where: { rundownId },
        orderBy: { position: 'desc' },
      });
      
      return ctx.db.rundownItem.create({
        data: {
          ...data,
          rundownId,
          position: position ?? (lastItem?.position ?? 0) + 1,
        },
      });
    }),
});
```

---

## 📋 CHECKLIST DE DÉVELOPPEMENT

### Phase MVP (Semaines 1-8)

#### Semaine 1-2 : Setup & Auth
- [ ] Initialiser monorepo Turborepo
- [ ] Setup Next.js 14 avec App Router
- [ ] Configurer Prisma + PostgreSQL
- [ ] Intégrer Clerk (auth)
- [ ] Créer layout principal avec navigation
- [ ] Setup tRPC
- [ ] Déployer sur Vercel (staging)

#### Semaine 3-4 : Conducteur
- [ ] Modèles DB (Show, Rundown, RundownItem)
- [ ] API CRUD conducteurs
- [ ] Interface liste des conducteurs
- [ ] Interface édition conducteur
- [ ] Drag & drop items
- [ ] Timer automatique
- [ ] Collaboration temps réel (Yjs)

#### Semaine 5-6 : Sujets + Google Docs
- [ ] Modèle DB Story
- [ ] Intégration Google APIs
- [ ] Création automatique Google Doc
- [ ] Interface liste des sujets
- [ ] Interface sujet avec embed Google Docs
- [ ] Sidebar métadonnées
- [ ] Lien sujet ↔ conducteur

#### Semaine 7-8 : Médiathèque + Audio
- [ ] Modèle DB MediaItem, Collection
- [ ] Setup AWS S3 + CloudFront
- [ ] Upload avec presigned URLs
- [ ] Interface médiathèque (grille/liste)
- [ ] Player audio inline
- [ ] Fork et intégration AudioMass
- [ ] Éditeur audio basique
- [ ] Export et sauvegarde vers médiathèque

### Phase V1 (Semaines 9-12)

#### Semaine 9-10 : Prompteur + Polish
- [ ] Interface prompteur fullscreen
- [ ] Sync avec conducteur actif
- [ ] Défilement automatique
- [ ] Contrôles clavier
- [ ] Notifications (toast, temps réel)

#### Semaine 11-12 : Transcription + Recherche
- [ ] Intégration AWS Transcribe
- [ ] Transcription automatique à l'upload
- [ ] Recherche full-text (Prisma ou OpenSearch)
- [ ] Recherche dans transcriptions
- [ ] Tests E2E
- [ ] Documentation utilisateur

---

## 🚨 POINTS D'ATTENTION

### Sécurité
- **Clerk** gère l'auth, ne jamais bypasser
- **Google Docs** : utiliser Service Account, pas OAuth user
- **S3** : presigned URLs avec expiration courte (1h)
- **API** : toujours vérifier organizationId dans les requêtes
- **CORS** : configurer strictement pour le domaine de prod

### Performance
- **Images/Audio** : servir via CloudFront, pas S3 direct
- **Waveforms** : pré-générer côté serveur à l'upload
- **Recherche** : utiliser des index DB appropriés
- **Collaboration** : limiter la fréquence de sync Yjs (debounce)

### UX Radio
- **Timing** : tout doit afficher des durées (MM:SS)
- **Couleurs statut** : cohérentes partout (vert=prêt, orange=en cours, etc.)
- **Raccourcis clavier** : essentiels pour les journalistes (Ctrl+S, etc.)
- **Mode sombre** : pour utilisation en régie

### Limites connues
- **Google Docs embed** : nécessite que l'utilisateur soit connecté à Google
- **AudioMass** : pas de multitrack natif (v2)
- **Transcription** : délai de quelques minutes (asynchrone)
- **Collaboration** : max ~20 users simultanés par document Yjs

---

## 📚 RESSOURCES

### Documentation officielle
- Next.js 14 : https://nextjs.org/docs
- Prisma : https://www.prisma.io/docs
- tRPC : https://trpc.io/docs
- Clerk : https://clerk.com/docs
- shadcn/ui : https://ui.shadcn.com
- Yjs : https://docs.yjs.dev
- AWS SDK v3 : https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/

### Repos de référence
- AudioMass : https://github.com/pkalogiros/AudioMass
- Waveform-playlist : https://github.com/naomiaro/waveform-playlist
- Superdesk (inspiration) : https://github.com/superdesk/superdesk

### Design
- Lucide Icons : https://lucide.dev/icons
- Tailwind Colors : https://tailwindcss.com/docs/colors
- Radix Colors : https://www.radix-ui.com/colors

---

## 💬 NOTES POUR CLAUDE CODE

### Principes de développement

1. **Commence par le setup** - Ne saute pas les étapes d'initialisation
2. **Un module à la fois** - Termine un module avant de passer au suivant
3. **Tests manuels fréquents** - Vérifie que ça fonctionne avant de continuer
4. **Commit souvent** - Petits commits descriptifs avec emojis
5. **Demande clarification** - Si une spec est ambiguë, demande à l'utilisateur
6. **Priorise le fonctionnel** - UI basique OK, on polish après
7. **Pas d'over-engineering** - YAGNI (You Ain't Gonna Need It)

### Workflow GitHub

```bash
# TOUJOURS commencer une session par :
cd redacnews
git pull origin develop

# TOUJOURS terminer une session par :
git add .
git commit -m "feat/fix/chore: description claire"
git push origin <branch-actuelle>
```

### Checklist avant chaque commit

- [ ] Le code compile sans erreur (`npm run build`)
- [ ] Pas de `console.log` de debug oubliés
- [ ] Les nouveaux fichiers sont ajoutés (`git status`)
- [ ] Le message de commit suit la convention
- [ ] Les fichiers sensibles (.env) ne sont PAS commités

### Ordre de développement recommandé

```
1. SETUP INITIAL
   └── Créer repo GitHub
   └── Initialiser Turborepo
   └── Configurer Next.js + Tailwind + shadcn
   └── Setup Prisma avec schéma complet
   └── Configurer Clerk
   └── Premier déploiement Vercel
   
2. MODULE CONDUCTEUR (priorité haute)
   └── API CRUD
   └── Liste des conducteurs
   └── Éditeur avec drag&drop
   └── Timer automatique
   
3. MODULE SUJETS
   └── Intégration Google Docs
   └── Liste des sujets
   └── Éditeur avec embed
   
4. MODULE MÉDIATHÈQUE
   └── Upload S3
   └── Player audio
   └── Éditeur AudioMass
   
5. MODULE PROMPTEUR
   └── Affichage fullscreen
   └── Sync conducteur
```

### En cas de problème

1. **Erreur de build** : Vérifier les imports, types TypeScript
2. **Erreur Prisma** : `npx prisma generate` puis `npx prisma db push`
3. **Erreur auth Clerk** : Vérifier les variables d'environnement
4. **Erreur tRPC** : Vérifier que le router est bien exporté dans `root.ts`

**En cas de doute, le plus simple qui fonctionne est toujours la bonne réponse.**

### Contact propriétaire

- **GitHub** : https://github.com/simonmarty-44130
- **Repo** : https://github.com/simonmarty-44130/redacnews

---

*Dernière mise à jour : 28 novembre 2025*
*Version : 1.0*
