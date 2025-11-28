# ROADMAP.md - Feuille de Route RédacNews

> **Dernière mise à jour** : 28 novembre 2025
> **Statut** : Phase MVP en cours

---

## ÉTAT ACTUEL

### Fait (Setup + P1 + P2)

| Module | Fonctionnalité | Statut |
|--------|----------------|--------|
| **Setup** | Monorepo Turborepo | Done |
| **Setup** | Next.js 14 + App Router | Done |
| **Setup** | Prisma + PostgreSQL | Done |
| **Setup** | AWS Cognito (auth) | Done |
| **Setup** | tRPC API | Done |
| **Setup** | Layout principal + navigation | Done |
| **Conducteur** | Modèles DB (Show, Rundown, RundownItem) | Done |
| **Conducteur** | API CRUD | Done |
| **Conducteur** | Interface liste + éditeur | Done |
| **Conducteur** | Drag & drop | Done |
| **Conducteur** | Timer automatique | Done |
| **Conducteur** | Collaboration temps réel (Yjs) | Done |
| **Sujets** | Modèle DB Story | Done |
| **Sujets** | Google Docs API integration | Done |
| **Sujets** | Interface liste + éditeur | Done |
| **Sujets** | Embed Google Docs | Done |
| **Médiathèque** | Modèle DB MediaItem, Collection | Done |
| **Médiathèque** | AWS S3 upload | Done |
| **Médiathèque** | Interface grille/liste | Done |
| **Médiathèque** | Player audio inline | Done |
| **Médiathèque** | AWS Transcribe (routes API) | Done |
| **Médiathèque** | Bouton transcription + statut | Done |
| **Médiathèque** | Waveform audio (wavesurfer.js) | Done |
| **Médiathèque** | Collections (sidebar + gestion) | Done |
| **Médiathèque** | Filtrage par collection | Done |

---

## PROCHAINE SESSION - P3 : Prompteur

### 1. Interface prompteur fullscreen
```
Fichier : apps/web/app/(dashboard)/prompteur/page.tsx

- Mode plein écran
- Affichage du texte du sujet en cours
- Taille de police ajustable
- Mode sombre pour régie
```

### 2. Synchronisation avec conducteur
```
- Sélecteur de conducteur actif
- Navigation entre les sujets (précédent/suivant)
- Affichage du sujet correspondant à l'item sélectionné
```

### 3. Défilement automatique
```
- Vitesse de défilement réglable
- Contrôles clavier (Espace = pause, flèches = navigation)
- Timer de temps restant
```

---

## SESSIONS FUTURES

### P4 : Éditeur Audio (AudioMass)
```
- Fork AudioMass dans packages/audio-editor
- Wrapper React pour intégration
- Ouvrir un média depuis la médiathèque
- Export et sauvegarde vers médiathèque
```

### P5 : Recherche et Polish
```
- Recherche full-text (OpenSearch ou Prisma)
- Recherche dans les transcriptions
- Notifications toast
- Tests E2E (Playwright)
```

### P6 : Déploiement Production
```
- Configuration AWS Amplify
- Variables d'environnement production
- Domaine personnalisé
- Monitoring CloudWatch
```

---

## VARIABLES D'ENVIRONNEMENT À CONFIGURER

### Pour la transcription (déjà dans le code)
```bash
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=redacnews-media
```

### Pour Google Docs (déjà dans le code)
```bash
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=xxx
```

---

## COMMANDES UTILES

```bash
# Développement
npm run dev              # Next.js seul
npm run dev:ws           # WebSocket server seul
npm run dev:all          # Next.js + WebSocket

# Base de données
cd packages/db
npx prisma generate      # Générer les types
npx prisma db push       # Pousser le schéma
npx prisma studio        # Interface admin

# Build
npm run build            # Build production

# Git
git status
git log --oneline -5
```

---

## STRUCTURE DES FICHIERS CLÉS

```
apps/web/
├── app/(dashboard)/
│   ├── conducteur/page.tsx      # Liste + éditeur conducteur
│   ├── sujets/page.tsx          # Liste + éditeur sujets
│   ├── mediatheque/page.tsx     # Médiathèque
│   └── prompteur/page.tsx       # Prompteur (à compléter)
├── components/
│   ├── conducteur/
│   │   ├── RundownEditor.tsx
│   │   ├── CollaborativeRundownEditor.tsx
│   │   └── RundownItem.tsx
│   ├── sujets/
│   │   ├── StoryEditor.tsx
│   │   └── GoogleDocEmbed.tsx
│   ├── mediatheque/
│   │   ├── MediaGrid.tsx
│   │   └── MediaDetails.tsx     # À modifier pour transcription
│   └── collaboration/
│       └── CollaborationAwareness.tsx
├── lib/
│   ├── aws/
│   │   └── transcribe.ts        # Service AWS Transcribe
│   ├── google/
│   │   └── docs.ts              # Service Google Docs
│   └── collaboration/
│       ├── useCollaboration.ts
│       └── useYRundown.ts
└── scripts/
    └── websocket-server.js      # Serveur WebSocket dev

packages/api/src/routers/
├── rundown.ts                   # API conducteur + batchUpdate
├── story.ts                     # API sujets + Google Docs
└── media.ts                     # API médiathèque + transcription
```

---

## POUR DÉMARRER LA PROCHAINE SESSION

Copier ce message :

```
Je continue le développement de RédacNews.

Contexte :
- Setup + P1 + P2 terminés (Conducteur, Sujets, Médiathèque complète)
- Le build passe sans erreur
- Prochaine étape : P3 - Prompteur

Tâche prioritaire :
Implémenter l'interface prompteur fullscreen avec synchronisation
au conducteur actif.

Consulte la doc :
- /Users/directionradiofidelite/projects/RedacNews/CLAUDE.md
- /Users/directionradiofidelite/projects/RedacNews/ROADMAP.md
```

---

*Généré le 28 novembre 2025*
