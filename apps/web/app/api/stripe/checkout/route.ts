// POST /api/stripe/checkout
// Crée une session Stripe Checkout (abonnement, essai 30 j AVEC carte) pour un
// utilisateur Cognito fraîchement inscrit, avant que son organisation n'existe.
// L'org est provisionnée par le webhook quand Stripe confirme la session.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@redacnews/db';
import { verifyAccessToken } from '@/lib/auth/verify-token';
import { getStripe, priceIdForPlan, isPlanKey, TRIAL_DAYS } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await verifyAccessToken(req);
  if (!auth) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { plan?: string; orgName?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const { plan, orgName, email } = body;
  if (!isPlanKey(plan)) {
    return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 });
  }
  if (!orgName || !email) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  // Déjà provisionné ? → pas de 2e abonnement.
  const existing = await prisma.user.findUnique({
    where: { cognitoId: auth.sub },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'ALREADY_ONBOARDED' }, { status: 409 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://redacnews.link';

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      customer_email: email,
      // Carte exigée dès l'inscription (essai sans débit immédiat).
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { cognitoSub: auth.sub, email, orgName, plan },
      },
      metadata: { cognitoSub: auth.sub, email, orgName, plan },
      allow_promotion_codes: true,
      success_url: `${appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/onboarding`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[checkout] erreur Stripe:', e);
    return NextResponse.json({ error: 'STRIPE_ERROR' }, { status: 500 });
  }
}
