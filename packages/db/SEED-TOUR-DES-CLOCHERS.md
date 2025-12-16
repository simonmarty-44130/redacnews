# Exécution du Seed "Tour des Clochers"

## Prérequis

Assurez-vous d'être dans le bon répertoire et que la base de données est accessible.

## Commandes à exécuter

```bash
# 1. Aller dans le dossier db
cd /Users/directionradiofidelite/Projects/RedacNews/packages/db

# 2. Exécuter le seed
npx tsx prisma/seed-tour-des-clochers.ts
```

## Résultat attendu

```
🏠 Seed du template Tour des Clochers...

✅ Organisation trouvée: Radio Fidélité
✅ Émission existante: Le Tour des Clochers
🗑️  Ancien template supprimé: Tour des Clochers - Conducteur complet (si existait)
✅ Template créé: Tour des Clochers - Conducteur complet
✅ 45 éléments créés

📋 Résumé du template:
   - Nom: Tour des Clochers - Conducteur complet
   - Émission: Le Tour des Clochers
   - Éléments totaux: 45
   - Éléments fixes: 28
   - Éléments variables: 17
   - Durée totale: 2h00
   - Variables: 16

📝 Catégories de variables:
   - general: 6 variables
   - fil_rouge: 1 variables
   - evangile: 4 variables
   - vie_paroissiale: 1 variables
   - elus: 1 variables
   - patrimoine: 1 variables
   - association: 1 variables

✨ Seed terminé avec succès!
```

## En cas d'erreur

### "Organisation Radio Fidélité non trouvée"
Exécutez d'abord le seed principal :
```bash
npx tsx prisma/seed.ts
```

### Erreur de connexion DB
Vérifiez que `DATABASE_URL` est défini dans `.env` :
```bash
cat ../.env | grep DATABASE_URL
```

### Erreur TypeScript
Installez tsx si nécessaire :
```bash
npm install -D tsx
```
