// Provisioning et synchronisation de la facturation Stripe.
//
// L'organisation est créée par le WEBHOOK (source de vérité) au moment où
// l'essai/abonnement Stripe est confirmé — jamais avant paiement validé.

import type Stripe from 'stripe';
import { prisma } from '@redacnews/db';
import { getStripe } from './stripe';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  // suffixe court pour garantir l'unicité (slug est @unique)
  const suffix = Math.abs(hashCode(name + Date.now())).toString(36).slice(0, 6);
  return `${base || 'radio'}-${suffix}`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function tsToDate(ts: number | null | undefined): Date | null {
  return ts ? new Date(ts * 1000) : null;
}

// `current_period_end` a migré au niveau des items dans l'API Stripe récente ;
// on lit l'item puis on retombe sur le champ historique si présent.
function periodEndOf(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  return tsToDate(item?.current_period_end ?? top);
}

/**
 * Provisionne (idempotent) l'organisation + son 1er utilisateur ADMIN à partir
 * d'une Checkout Session complétée. Appelé sur `checkout.session.completed`.
 */
export async function provisionFromCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata || {};
  const cognitoSub = meta.cognitoSub;
  const email = meta.email || session.customer_details?.email || undefined;
  const orgName = meta.orgName || 'Ma radio';
  const plan = meta.plan || null;

  if (!cognitoSub || !email) {
    console.error('[billing] checkout.session.completed sans cognitoSub/email', session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  // Idempotence : déjà provisionné pour cet utilisateur ?
  const existingUser = await prisma.user.findUnique({
    where: { cognitoId: cognitoSub },
    select: { organizationId: true },
  });
  if (existingUser) {
    // L'org existe déjà → on resynchronise juste l'état d'abonnement.
    if (subscriptionId) {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      await syncSubscription(sub);
    }
    return;
  }

  // Détails d'abonnement (statut, fin d'essai, période).
  let status: string | null = null;
  let trialEnd: Date | null = null;
  let periodEnd: Date | null = null;
  if (subscriptionId) {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    status = sub.status;
    trialEnd = tsToDate(sub.trial_end);
    periodEnd = periodEndOf(sub);
  }

  await prisma.organization.create({
    data: {
      name: orgName,
      slug: slugify(orgName),
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
      subscriptionStatus: status,
      plan,
      trialEndsAt: trialEnd,
      currentPeriodEnd: periodEnd,
      users: {
        create: {
          cognitoId: cognitoSub,
          email,
          role: 'ADMIN',
        },
      },
    },
  });
}

/**
 * Synchronise l'état d'abonnement d'une org depuis un objet Subscription Stripe.
 * Appelé sur customer.subscription.updated / .deleted, invoice.payment_failed, etc.
 */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });
  if (!org) {
    console.warn('[billing] subscription sans org correspondante', sub.id);
    return;
  }
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: sub.status,
      trialEndsAt: tsToDate(sub.trial_end),
      currentPeriodEnd: periodEndOf(sub),
    },
  });
}
