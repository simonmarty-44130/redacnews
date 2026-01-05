'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { getCurrentUser } from 'aws-amplify/auth';
import { trpc } from './client';

// Ensure Amplify is configured before any auth calls
import '@/lib/aws/amplify-config';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:3000`;
}

// Get cognitoId (userId) from Amplify auth
async function getCognitoId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    console.log('[tRPC] Got user from Amplify:', user.userId);
    return user.userId; // This is the Cognito sub
  } catch (error) {
    console.log('[tRPC] Failed to get user from Amplify:', error);
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
            const cognitoId = await getCognitoId();
            return {
              ...(cognitoId && { 'x-cognito-id': cognitoId }),
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
