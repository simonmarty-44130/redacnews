'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Radio } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { logout } from '@/lib/aws/auth';
import { Button } from '@/components/ui/button';
import '@/lib/aws/amplify-config';

export default function BillingPage() {
  const router = useRouter();
  const { data: billing, isLoading } = trpc.billing.status.useQuery();

  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePortal = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const token = (await fetchAuthSession()).tokens?.accessToken?.toString();
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        setError("Impossible d'ouvrir le portail de gestion. Veuillez reessayer.");
        setPortalLoading(false);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez reessayer.");
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-blue-600 animate-pulse" />
          <span className="text-lg text-slate-700">Chargement...</span>
        </div>
      </div>
    );
  }

  const isTrialing = billing?.isTrialing;
  const isActive = billing?.isActive;
  const status = billing?.status;
  const plan = billing?.plan;

  let heading: string;
  let description: React.ReactNode;

  if (isTrialing) {
    heading = 'Essai en cours';
    description = (
      <>
        <p>
          Il vous reste {billing?.trialDaysLeft} jour(s) d&apos;essai.
        </p>
        {plan && (
          <p className="mt-1 text-slate-500">
            Formule : <span className="font-medium text-slate-700">{plan}</span>
          </p>
        )}
      </>
    );
  } else if (status === 'active') {
    heading = 'Abonnement actif';
    description = plan ? (
      <p>
        Formule : <span className="font-medium text-slate-700">{plan}</span>
      </p>
    ) : (
      <p>Votre abonnement est actif.</p>
    );
  } else {
    heading = 'Acces suspendu';
    description = (
      <p>
        Votre abonnement n&apos;est plus actif. Regularisez pour retrouver
        l&apos;acces.
      </p>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Radio className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg text-slate-900">RedacNews</span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
        <div className="mt-3 text-slate-600">{description}</div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-3">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handlePortal}
            disabled={portalLoading}
          >
            {portalLoading ? 'Redirection...' : 'Gerer mon abonnement'}
          </Button>

          {isActive && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/conducteur')}
            >
              Retour a l&apos;app
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full text-slate-500"
            onClick={handleLogout}
          >
            Se deconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
