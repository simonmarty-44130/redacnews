// Client Stripe serveur + configuration des offres.
//
// Toutes les clés viennent de l'environnement (jamais en dur) :
//   STRIPE_SECRET_KEY        sk_test_... puis sk_live_...
//   STRIPE_WEBHOOK_SECRET    whsec_... (signature des webhooks)
//   STRIPE_PRICE_ASSO        price_... (abonnement Asso 49 €/mois)
//   STRIPE_PRICE_RADIO       price_... (abonnement Radio 149 €/mois)
//   NEXT_PUBLIC_APP_URL      https://redacnews.link (success/cancel URLs)

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** Client Stripe, initialisé paresseusement (évite de planter le build si la clé manque). */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY manquante');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export const TRIAL_DAYS = 30;

/** Offres self-serve (Réseau = sur devis, pas de self-checkout). */
export const PLANS = {
  ASSO: { key: 'ASSO', label: 'Asso', priceEnv: 'STRIPE_PRICE_ASSO' },
  RADIO: { key: 'RADIO', label: 'Radio', priceEnv: 'STRIPE_PRICE_RADIO' },
} as const;

export type PlanKey = keyof typeof PLANS;

export function isPlanKey(v: unknown): v is PlanKey {
  return v === 'ASSO' || v === 'RADIO';
}

/** Résout le priceId Stripe d'une offre depuis l'environnement. */
export function priceIdForPlan(plan: PlanKey): string {
  const envName = PLANS[plan].priceEnv;
  const priceId = process.env[envName];
  if (!priceId) throw new Error(`${envName} manquante (priceId Stripe de l'offre ${plan})`);
  return priceId;
}

/** Statuts Stripe qui ouvrent l'accès au produit. */
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === 'trialing' || status === 'active';
}
