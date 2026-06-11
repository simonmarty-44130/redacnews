// POST /api/stripe/webhook
// Point d'entrée des événements Stripe. Vérifie la signature, puis :
//  - checkout.session.completed   -> provisionne l'org + l'admin (1ère fois)
//  - customer.subscription.*      -> synchronise le statut d'abonnement
//
// IMPORTANT : route NON protégée (appelée par Stripe), signature obligatoire.
// Le corps brut est requis pour la vérification de signature.

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { provisionFromCheckout, syncSubscription } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'NO_SIGNATURE' }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error('[webhook] signature invalide:', e);
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await provisionFromCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        // Événement non traité : on acquitte quand même (200).
        break;
    }
  } catch (e) {
    // On log mais on renvoie 200 pour éviter les re-livraisons en boucle sur
    // une erreur applicative non transitoire ; à monitorer.
    console.error(`[webhook] erreur traitement ${event.type}:`, e);
    return NextResponse.json({ received: true, warning: 'handler_error' });
  }

  return NextResponse.json({ received: true });
}
