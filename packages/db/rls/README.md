# Row-Level Security (RLS) multi-tenant — runbook

> **Statut : PRÉPARÉ, NON ACTIVÉ.** Ne pas appliquer en production sans avoir
> d'abord validé en staging. Activer la RLS sans avoir câblé le positionnement
> de la variable de session `app.current_org` **coupe l'accès à toutes les
> données** (toutes les requêtes renverraient 0 ligne). Voir l'ordre de
> déploiement plus bas.

## Pourquoi

L'isolation entre organisations repose aujourd'hui sur :

1. **L'identité vérifiée** (token Cognito vérifié côté serveur dans
   `packages/api/src/auth.ts` → `createTRPCContext`). ✅ en place.
2. **Le scoping applicatif** (`where: { organizationId }` + gardes
   `packages/api/src/lib/tenant-guard.ts`). Partiel : fiable seulement si chaque
   requête pense à filtrer.

La RLS ajoute une **3ᵉ couche, garantie par la base** : même si une requête
applicative oublie un filtre, PostgreSQL refuse physiquement les lignes d'une
autre organisation. C'est la condition de sérénité pour mutualiser une même RDS
entre plusieurs clients (segment associatif).

## Modèle

Chaque transaction applicative positionne l'organisation courante :

```sql
SELECT set_config('app.current_org', '<organizationId>', true); -- true = LOCAL (transaction)
```

Les policies filtrent sur `current_setting('app.current_org', true)`. Le 2ᵉ
argument `true` fait renvoyer `NULL` (au lieu d'une erreur) si la variable n'est
pas posée — dans ce cas, aucune ligne ne passe : *fail-closed*.

## Tables concernées

- **Org direct** (colonne `organizationId`) : `Constituency`, `User`, `Show`,
  `Story`, `MediaItem`, `Collection`, `MontageProject`, `RundownTemplate`,
  `PoliticalTag`, `Invitation`, `AIConversation`, `AIUsage`, `AISettings`.
  → couvertes par `enable-rls.sql`.
- **Org indirect** (scopées via un parent, pas de colonne) : `Rundown` (via
  `Show`), `RundownItem`, `RundownTeamMember`, `RundownItemMedia`, `StoryMedia`,
  `CollectionItem`, `Comment`, `MontageTrack`, `MontageClip`,
  `RundownTemplateItem`, `RundownItemGuest`.
  → **TODO** : soit dénormaliser `organizationId` sur ces tables (recommandé,
  policies simples + index), soit policies `USING (EXISTS (... parent ...))`.
  Tant que ce n'est pas fait, ces tables restent protégées uniquement par les
  gardes applicatives.

## Ordre de déploiement (sans coupure)

1. **Câbler `withTenant`** : router toutes les requêtes Prisma protégées via un
   client qui ouvre une transaction et pose `app.current_org` (helper fourni :
   `packages/db/src/tenant.ts`). Auditer les `$transaction` interactives
   existantes (ex. réordonnancement de `RundownItem`) pour qu'elles posent aussi
   la variable.
2. **Dénormaliser `organizationId`** sur les tables « org indirect » + backfill.
3. **Appliquer `enable-rls.sql`** d'abord en staging, valider qu'un utilisateur
   d'une org ne voit jamais une autre (tests d'intégration cross-tenant).
4. **Créer un rôle applicatif non-superuser** : la RLS est ignorée pour le
   propriétaire des tables et les superusers. L'app DOIT se connecter avec un
   rôle `NOBYPASSRLS`.
5. Appliquer en production hors heures de pointe, monitorer le taux d'erreurs.

## Rollback

`disable-rls.sql` désactive les policies sans perte de données.
