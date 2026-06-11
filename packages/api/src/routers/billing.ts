import { router, protectedProcedure } from '../trpc';

// État d'abonnement de l'organisation courante (pour le paywall / bandeau essai).
export const billingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUnique({
      where: { id: ctx.organizationId! },
      select: {
        subscriptionStatus: true,
        plan: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
      },
    });

    const status = org?.subscriptionStatus ?? null;
    const isActive = status === 'trialing' || status === 'active';
    const trialDaysLeft =
      org?.trialEndsAt != null
        ? Math.max(
            0,
            Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86_400_000)
          )
        : null;

    return {
      status,
      plan: org?.plan ?? null,
      isActive,
      isTrialing: status === 'trialing',
      trialEndsAt: org?.trialEndsAt ?? null,
      trialDaysLeft,
      currentPeriodEnd: org?.currentPeriodEnd ?? null,
    };
  }),
});
