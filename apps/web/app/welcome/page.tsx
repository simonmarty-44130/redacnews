'use client';

// Page d'atterrissage après un paiement Stripe réussi.
// Stripe redirige ici (/welcome?session_id=...). L'organisation + le User
// applicatif sont provisionnés de façon asynchrone par le webhook Stripe :
// on interroge donc /api/onboarding/status en boucle jusqu'à ce que le compte
// existe, puis on entre dans l'app (/conducteur).

import '@/lib/aws/amplify-config';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 24; // ~60 s au total

export default function WelcomePage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  // Identifiant de la session de polling courante. Incrémenter cette valeur
  // (via "Réessayer") invalide proprement toute boucle déjà en cours.
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    setTimedOut(false);

    const stop = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const check = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const token = (await fetchAuthSession()).tokens?.accessToken?.toString();
        if (cancelled) return;

        if (token) {
          const res = await fetch('/api/onboarding/status', {
            headers: { Authorization: 'Bearer ' + token },
            cache: 'no-store',
          });
          if (cancelled) return;

          if (res.ok) {
            const data = (await res.json()) as { provisioned?: boolean };
            if (cancelled) return;

            if (data.provisioned) {
              stop();
              router.push('/conducteur');
              return;
            }
          }
        }
      } catch {
        // Erreur réseau transitoire : on retentera au prochain tick.
      }

      if (!cancelled && attempts >= MAX_ATTEMPTS) {
        stop();
        setTimedOut(true);
      }
    };

    // Premier essai immédiat, puis toutes les POLL_INTERVAL_MS.
    void check();
    intervalId = setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stop();
    };
  }, [router, pollKey]);

  const retry = useCallback(() => {
    setPollKey((k) => k + 1);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 text-center">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <Radio className="h-7 w-7" aria-hidden="true" />
        </div>

        {!timedOut ? (
          <>
            <div className="mb-6 flex justify-center" aria-hidden="true">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-600 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Activation de votre espace RedacNews…
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              Cela prend quelques secondes après le paiement.
            </p>
            <div
              className="mx-auto mt-8 h-1 w-40 overflow-hidden rounded-full bg-gray-100"
              role="status"
              aria-label="Activation en cours"
            >
              <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Votre espace est presque prêt.
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              L&apos;activation prend un peu plus de temps que prévu. Réessayez
              dans un instant&nbsp;; si rien ne se passe, rafraîchissez la page.
            </p>
            <Button
              onClick={retry}
              className="mt-8 bg-blue-600 text-white hover:bg-blue-700"
            >
              Réessayer
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
