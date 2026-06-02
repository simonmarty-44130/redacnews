'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPassword, confirmForgotPassword } from '@/lib/aws/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Étape 1 : envoi du code par email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep('reset');
    } catch (err: any) {
      // Cognito renvoie UserNotFoundException si l'email n'existe pas.
      // On reste volontairement générique (ne pas révéler l'existence d'un compte).
      if (err?.name === 'LimitExceededException') {
        setError('Trop de tentatives. Réessayez dans quelques minutes.');
      } else {
        setError(
          "Si un compte existe pour cet email, un code de réinitialisation vient d'être envoyé."
        );
        // On passe quand même à l'étape suivante pour ne pas divulguer l'existence du compte.
        setStep('reset');
      }
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : code + nouveau mot de passe
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmNewPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      await confirmForgotPassword(email.trim(), code.trim(), newPassword);
      setStep('done');
    } catch (err: any) {
      if (err?.name === 'CodeMismatchException') {
        setError('Code incorrect. Vérifiez le code reçu par email.');
      } else if (err?.name === 'ExpiredCodeException') {
        setError('Code expiré. Renvoyez un nouveau code.');
      } else if (err?.name === 'InvalidPasswordException') {
        setError('Mot de passe trop faible : 8+ caractères, majuscule, minuscule et chiffre.');
      } else {
        setError(err?.message || 'Erreur lors de la réinitialisation.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Radio className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
          <CardDescription>
            {step === 'email' && 'Saisissez votre email pour recevoir un code de réinitialisation'}
            {step === 'reset' && 'Saisissez le code reçu par email et votre nouveau mot de passe'}
            {step === 'done' && 'Mot de passe réinitialisé'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@radio-fidelite.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Envoi...' : 'Recevoir un code'}
              </Button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code reçu par email</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500">
                  Minimum 8 caractères, avec majuscules, minuscules et chiffres
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </Button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-center text-sm text-gray-500 hover:underline"
              >
                Renvoyer un code
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">
                Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.
              </p>
              <Button className="w-full" onClick={() => router.push('/login')}>
                Aller à la connexion
              </Button>
            </div>
          )}

          {step !== 'done' && (
            <div className="mt-4 text-center text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
