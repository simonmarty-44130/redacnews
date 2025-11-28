import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { TRPCProvider } from '@/lib/trpc/provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RedacNews',
  description: 'NRCS SaaS pour radios - Newsroom management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <TRPCProvider>
          <AuthProvider>{children}</AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
