import Link from 'next/link';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <Radio className="h-12 w-12 text-blue-600" />
          <h1 className="text-4xl font-bold">RedacNews</h1>
        </div>
        <p className="text-xl text-muted-foreground text-center max-w-md">
          NRCS SaaS pour radios - Newsroom management system
        </p>
        <div className="flex gap-4 mt-4">
          <Link href="/login">
            <Button>Se connecter</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Creer un compte</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
