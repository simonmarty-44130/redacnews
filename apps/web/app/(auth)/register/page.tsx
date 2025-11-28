'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import { register, confirmRegistration } from '@/lib/aws/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'register' | 'confirm'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await register(email, password, firstName, lastName);
      if (result.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep('confirm');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmRegistration(email, confirmCode);
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Code de confirmation invalide');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'confirm') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <Radio className="h-10 w-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Confirmation</CardTitle>
            <CardDescription>
              Un code de confirmation a ete envoye a {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConfirm} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">Code de confirmation</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verification...' : 'Confirmer'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Radio className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Creer un compte</CardTitle>
          <CardDescription>
            Inscrivez-vous pour acceder a RedacNews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prenom</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 caracteres, avec majuscule, minuscule et chiffre
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Inscription...' : 'S\'inscrire'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Deja un compte ?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
