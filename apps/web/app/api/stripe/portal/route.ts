// POST /api/stripe/portal
// Ouvre le portail client Stripe (changer d'offre, mettre à jour la carte,
// résilier) pour l'organisation de l'utilisateur connecté.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@redacnews/db';
import { verifyAccessToken } from '@/lib/auth/verify-token';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await verifyAccessToken(req);
  if (!auth) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { cognitoId: auth.sub },
    select: { organization: { select: { stripeCustomerId: true } } },
  });
  const customerId = user?.organization?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: 'NO_CUSTOMER' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://redacnews.link';

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings/organisation`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[portal] erreur Stripe:', e);
    return NextResponse.json({ error: 'STRIPE_ERROR' }, { status: 500 });
  }
}
