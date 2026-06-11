# Setup Stripe — essai 30 j avec carte → abonnement

Statut : **code backend prêt** (modèle, `/api/stripe/checkout|webhook|portal`, provisioning,
router tRPC `billing`). Il manque : le **compte Stripe + les clés/price IDs**, la **migration DB**,
et le **câblage UI** (onboarding / welcome / paywall / landing). Ce doc liste ce qu'il faut faire.

## 1. Ce dont j'ai besoin de toi (Stripe)

1. **Compte Stripe** (mode test d'abord). 
2. **2 produits + prix récurrents mensuels** (EUR) :
   - « RedacNews Asso » → **49 €/mois** → note le `price_...`
   - « RedacNews Radio » → **149 €/mois** → note le `price_...`
   - Via le dashboard, ou via CLI une fois `stripe login` fait :
     ```bash
     stripe products create --name "RedacNews Asso"
     stripe prices create --product <prod_id> --unit-amount 4900 --currency eur -d "recurring[interval]=month"
     stripe products create --name "RedacNews Radio"
     stripe prices create --product <prod_id> --unit-amount 14900 --currency eur -d "recurring[interval]=month"
     ```
3. **Clé secrète** test : `sk_test_...` (Dashboard → Developers → API keys).
4. **Webhook** : endpoint `https://redacnews.link/api/stripe/webhook`, événements
   `checkout.session.completed`, `customer.subscription.updated|deleted|trial_will_end`.
   → récupère le **signing secret** `whsec_...`.

## 2. Variables d'environnement (local + Amplify prod)

```
STRIPE_SECRET_KEY=sk_test_...        # puis sk_live_... en prod
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ASSO=price_...
STRIPE_PRICE_RADIO=price_...
NEXT_PUBLIC_APP_URL=https://redacnews.link
```
À ajouter aussi dans Amplify (app `d69jdt4k0rstd`, env vars de la branche `main`).

## 3. Migration base de données (additive, sans risque)

Le modèle `Organization` gagne des colonnes **nullable** (Stripe). Migration non destructive :
```bash
cd packages/db && npx prisma db push   # ajoute les colonnes à redacnews-db
```
(À exécuter avant le déploiement du code qui les lit.)

## 4. Test en mode test (avant prod)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook   # donne un whsec_ de test
# carte de test : 4242 4242 4242 4242, date future, CVC quelconque
```
Parcours : register → confirmation email → onboarding (offre) → Checkout (carte) →
webhook `checkout.session.completed` → l'org + l'admin sont créés, statut `trialing`.

## 5. Reste à câbler côté UI (à faire avec les clés en place, pour pouvoir tester)

- **Page `/onboarding`** : nom de la radio + choix offre → `POST /api/stripe/checkout` (Bearer) → redirection Checkout.
- **Page `/welcome`** (success_url) : poll `billing.status` jusqu'à provisioning, puis entrée dans l'app.
- **Register** : après confirmation, auto-login puis redirection `/onboarding`.
- **Paywall** : bandeau « essai : J-N » + blocage si `status` ∉ {trialing, active} → bouton « gérer l'abonnement » (`POST /api/stripe/portal`).
- **Landing** : retirer « sans carte bancaire » (l'offre choisie = carte à l'inscription).

## 6. Passage en prod

Clés `sk_live_`/`whsec_` live, webhook live, retirer la mention « sans carte », déployer.
TVA : à terme activer **Stripe Tax** (TVA FR 20 % B2B) — non bloquant pour le test.
