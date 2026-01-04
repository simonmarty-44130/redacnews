import Link from 'next/link';
import { Settings, Users, Building2, Bell, Shield, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsCategories = [
  {
    title: 'Équipe',
    description: 'Gérez les membres de votre organisation',
    href: '/settings/equipe',
    icon: Users,
    available: true,
  },
  {
    title: 'Organisation',
    description: 'Paramètres de votre organisation',
    href: '/settings/organisation',
    icon: Building2,
    available: true,
  },
  {
    title: 'Notifications',
    description: 'Préférences de notifications',
    href: '/settings/notifications',
    icon: Bell,
    available: true,
  },
  {
    title: 'Sécurité',
    description: 'Mot de passe et authentification',
    href: '/settings/securite',
    icon: Shield,
    available: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">
            Configurez votre compte et votre organisation
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {settingsCategories.map((category) => {
          const Icon = category.icon;

          if (!category.available) {
            return (
              <Card key={category.title} className="opacity-60">
                <CardHeader className="flex flex-row items-center gap-4 py-4">
                  <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{category.title}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded">
                    Bientôt
                  </span>
                </CardHeader>
              </Card>
            );
          }

          return (
            <Link key={category.title} href={category.href}>
              <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4 py-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{category.title}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
