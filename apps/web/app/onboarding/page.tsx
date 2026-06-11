'use client';

import '@/lib/aws/amplify-config';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';

import { Button } from '@/components/ui/button';

type Plan = 'ASSO' | 'RADIO';

interface PlanOption {
  id: Plan;
  name: string;
  price: string;
  seats: string;
}

const PLANS: PlanOption[] = [
  { id: 'ASSO', name: 'Asso', price: '49 €/mois', seats: "jusqu'à 20 sièges" },
  { id: 'RADIO', name: 'Radio', price: '149 €/mois', seats: "jusqu'à 40 sièges" },
];

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState<Plan>('ASSO');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const session = await fetchAuthSession();
        if (!session.tokens?.accessToken) {
          router.push('/login');
          return;
        }
        const payloadEmail = session.tokens?.idToken?.payload?.email as
          | string
          | undefined;
        if (active) {
          setEmail(payloadEmail ?? '');
          setLoading(false);
        }
      } catch {
        router.push('/login');
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit() {
    if (!orgName.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken?.toString();

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({ plan, orgName, email }),
      });

      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        window.location.href = url;
        return;
      }

      if (res.status === 409) {
        router.push('/conducteur');
        return;
      }

      setError(
        "Une erreur est survenue lors de la création de l'abonnement. Merci de réessayer."
      );
      setSubmitting(false);
    } catch {
      setError('Une erreur réseau est survenue. Merci de réessayer.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Créez votre rédaction
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Choisissez une formule et donnez un nom à votre radio pour démarrer.
          </p>
          {email ? (
            <p className="mt-1 text-xs text-slate-400">Connecté en tant que {email}</p>
          ) : null}
        </div>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="orgName"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Nom de la radio / rédaction
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ex. Radio Fidélité"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Formule
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLANS.map((option) => {
                const selected = plan === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPlan(option.id)}
                    aria-pressed={selected}
                    className={
                      'rounded-lg border p-4 text-left transition-colors ' +
                      (selected
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300')
                    }
                  >
                    <span className="block text-base font-semibold text-slate-900">
                      {option.name}
                    </span>
                    <span className="mt-1 block text-lg font-bold text-blue-600">
                      {option.price}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {option.seats}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            30 jours d&apos;essai gratuit, carte requise, sans engagement.
          </p>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!orgName.trim() || submitting}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? 'Redirection…' : "Démarrer l'essai 30 jours"}
          </Button>
        </div>
      </div>
    </div>
  );
}
