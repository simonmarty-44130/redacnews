# Calcul de durée différencié - Émissions News vs Animation

## Contexte

RedacNews gère deux types d'émissions avec des besoins différents pour le calcul de durée de lecture :

1. **Émissions d'information** (FLASH, JOURNAL) : Le présentateur lit uniquement les lancements et pieds (texte en gras), les voix off sont des éléments audio séparés.

2. **Émissions d'animation** (MAGAZINE, CHRONIQUE, AUTRE) : L'animateur lit l'intégralité du texte, sauf les repères techniques.

## Fonctionnement

### Backend (`packages/api/src/lib/google/docs.ts`)

#### Fonctions principales

```typescript
// Détermine le mode de calcul selon la catégorie du Show
getDurationModeFromCategory(category: ShowCategory): 'news' | 'animation'
// FLASH, JOURNAL → 'news'
// MAGAZINE, CHRONIQUE, AUTRE → 'animation'

// Calcule la durée selon le mode
estimateDocReadingDurationByMode(docId: string, mode: 'news' | 'animation')
// Retourne : { duration, wordCount, mode, usedBoldOnly }
```

#### Mode "news" (FLASH, JOURNAL)

- Seul le **texte en gras** est comptabilisé
- Le texte normal (voix off, indications) n'est pas compté
- Si aucun texte en gras, tout le texte est compté par défaut

**Exemple Google Doc :**
```
**Bonjour, voici le flash info de 8h.** ← Compté (gras)

Voix off sur les images de la manifestation ← Non compté

**Le mouvement social se poursuit aujourd'hui.** ← Compté (gras)
```

#### Mode "animation" (MAGAZINE comme Tour des Clochers)

- **Tout le texte** est comptabilisé
- Les **marqueurs techniques entre crochets `[...]`** sont exclus
- Pas besoin de mettre en gras

**Exemple Google Doc :**
```
Bonjour et bienvenue dans le Tour des Clochers ! ← Compté

[JINGLE OUVERTURE] ← Non compté (marqueur)

Aujourd'hui nous partons à la découverte de... ← Compté

[FLASH INFO - voir conducteur imbriqué] ← Non compté (marqueur)

Après ce flash, retour à notre émission. ← Compté

[>>> RUBRIQUE MÉTÉO <<<] ← Non compté (marqueur)
```

#### Marqueurs techniques reconnus

Tout texte entre crochets est ignoré :
- `[JINGLE]`
- `[FLASH INFO]`
- `[RUBRIQUE MÉTÉO]`
- `[>>> transition <<<]`
- `[PAUSE PUB]`
- `[SON: interview maire]`

### API (`packages/api/src/routers/rundown.ts`)

#### `syncFromGoogleDocs`

Synchronise tous les items d'un conducteur depuis leurs Google Docs liés.

```typescript
// Input
{ rundownId: string }

// Output
{
  rundownId: string,
  updatedItems: number,
  updates: Array<{
    itemId: string,
    storyId: string,
    duration: number,
    wordCount: number,
    mode: 'news' | 'animation'
  }>,
  durationMode: 'news' | 'animation'  // Mode utilisé
}
```

Le mode est automatiquement déterminé par la **catégorie du Show** associé au conducteur.

#### `syncItemFromGoogleDoc`

Synchronise un seul item depuis son Google Doc.

```typescript
// Input
{ itemId: string }

// Output
{
  item: RundownItem,
  duration: number,
  wordCount: number,
  usedBoldOnly: boolean,
  durationMode: 'news' | 'animation'
}
```

### Frontend (`apps/web/components/conducteur/RundownEditor.tsx`)

Le bouton "Sync GDocs" dans le conducteur appelle `syncFromGoogleDocs` :

```tsx
const syncFromGoogleDocs = api.rundown.syncFromGoogleDocs.useMutation({
  onSuccess: (data) => {
    toast({
      title: 'Synchronisation terminée',
      description: `${data.updatedItems} élément(s) mis à jour (mode: ${data.durationMode})`,
    });
    refetch(); // Recharger le conducteur
  },
});
```

## Configuration des Shows

Pour que le calcul fonctionne correctement, chaque Show doit avoir la bonne catégorie :

| Show | Catégorie | Mode de calcul |
|------|-----------|----------------|
| Flash Info | FLASH | news (gras uniquement) |
| Journal 08h | JOURNAL | news (gras uniquement) |
| Tour des Clochers | MAGAZINE | animation (tout le texte) |
| Chronique Culture | CHRONIQUE | animation (tout le texte) |

## Workflow utilisateur

### Pour Tiphaine (Tour des Clochers - animation)

1. Créer le conducteur du Tour des Clochers
2. Générer le script Google Doc
3. Rédiger le texte normalement (pas besoin de gras)
4. Utiliser `[MARQUEURS]` pour les repères techniques
5. Cliquer "Sync GDocs" → durée calculée sur tout le texte hors marqueurs

### Pour Clara (Flash Info - news)

1. Créer le conducteur du Flash
2. Associer les sujets avec leurs Google Docs
3. Dans chaque Google Doc, mettre en **gras** le texte lu par le présentateur
4. Cliquer "Sync GDocs" → durée calculée sur le texte en gras uniquement

## Vitesse de lecture

La vitesse de lecture standard radio est de **150 mots par minute**.

```typescript
function estimateReadingDuration(wordCount: number): number {
  const wordsPerMinute = 150;
  return Math.round((wordCount / wordsPerMinute) * 60); // en secondes
}
```

## Fichiers modifiés

- `packages/api/src/lib/google/docs.ts` - Fonctions de calcul de durée
- `packages/api/src/routers/rundown.ts` - Procédures tRPC de synchronisation
- `packages/db/prisma/schema.prisma` - Enum `ShowCategory` (déjà existant)

## Tests

Pour tester :

1. Créer un Show de type MAGAZINE (ex: "Test Animation")
2. Créer un conducteur pour ce Show
3. Ajouter un item avec Google Doc
4. Écrire du texte avec des `[MARQUEURS]`
5. Cliquer "Sync GDocs"
6. Vérifier que la durée exclut le texte entre crochets

Puis :

1. Créer un Show de type FLASH (ex: "Test Flash")
2. Créer un conducteur pour ce Show
3. Ajouter un item avec Google Doc
4. Écrire du texte avec du **gras**
5. Cliquer "Sync GDocs"
6. Vérifier que seul le texte en gras est compté
