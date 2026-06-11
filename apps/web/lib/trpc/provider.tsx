'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { fetchAuthSession } from 'aws-amplify/auth';
import { trpc } from './client';

// Ensure Amplify is configured before any auth calls
import '@/lib/aws/amplify-config';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:3000`;
}

// Recupere le token d'acces Cognito (JWT) a envoyer au serveur, qui le
// verifiera cryptographiquement. On n'envoie plus le `sub` en clair : il etait
// pose par le client et donc usurpable.
async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch (error) {
    console.log('[tRPC] Failed to get auth session from Amplify:', error);
    return null;
  }
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false, // Éviter le re-fetch au retour sur l'onglet
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          async headers() {
            const accessToken = await getAccessToken();
            return {
              ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
