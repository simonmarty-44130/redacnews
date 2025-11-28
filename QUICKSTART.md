# QUICKSTART.md - Démarrage Rapide RédacNews

> **Commandes et snippets prêts à copier-coller pour Claude Code**
> **Stack 100% AWS**

---

## 🚀 INITIALISATION PROJET

### Étape 1 : Créer le monorepo

```bash
# Créer le projet
npx create-turbo@latest redacnews --example with-tailwind
cd redacnews

# Nettoyer et restructurer
rm -rf apps/docs
mkdir -p packages/{db,api,types,audio-editor}
```

### Étape 2 : Configurer l'app web Next.js

```bash
cd apps/web

# Installer les dépendances core
npm install @trpc/server @trpc/client @trpc/react-query @trpc/next
npm install @tanstack/react-query@^4 superjson zod
npm install zustand immer
npm install yjs y-websocket y-indexeddb
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install date-fns lucide-react clsx tailwind-merge
npm install googleapis

# AWS SDK v3 (modulaire - on installe que ce qu'on utilise)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install @aws-sdk/client-transcribe
npm install @aws-sdk/client-ses
npm install @aws-sdk/client-cognito-identity-provider
npm install amazon-cognito-identity-js

# AWS Amplify (wrapper simplifié pour Cognito)
npm install aws-amplify @aws-amplify/ui-react

# Dev dependencies
npm install -D @types/node @types/react typescript
```

### Étape 3 : Configurer shadcn/ui

```bash
cd apps/web
npx shadcn@latest init

# Répondre aux prompts :
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes

# Installer les composants nécessaires
npx shadcn@latest add button card input label select textarea 
npx shadcn@latest add dialog dropdown-menu tabs toast badge
npx shadcn@latest add avatar separator scroll-area skeleton
npx shadcn@latest add popover calendar command
```

### Étape 4 : Setup Prisma (packages/db)

```bash
cd packages/db
npm init -y
npm install prisma @prisma/client
npx prisma init

# Éditer prisma/schema.prisma avec le schéma fourni dans CLAUDE.md
```

---

## ☁️ CONFIGURATION AWS

### Services AWS à créer

| Service | Usage | Configuration |
|---------|-------|---------------|
| **Cognito** | Auth utilisateurs | User Pool + App Client |
| **RDS PostgreSQL** | Base de données | db.t3.micro (free tier) |
| **S3** | Stockage média | Bucket privé + CORS |
| **CloudFront** | CDN | Distribution pour S3 |
| **SES** | Emails | Vérifier domaine |
| **Amplify** | Hosting | Déploiement Next.js |

### 1. Amazon Cognito (Authentification)

```bash
# Via AWS CLI
aws cognito-idp create-user-pool \
  --pool-name redacnews-users \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --region eu-west-3

# Créer un App Client
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name redacnews-web \
  --generate-secret false \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --region eu-west-3
```

### 2. Amazon RDS PostgreSQL

```bash
# Via AWS CLI
aws rds create-db-instance \
  --db-instance-identifier redacnews-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username postgres \
  --master-user-password <MOT_DE_PASSE> \
  --allocated-storage 20 \
  --publicly-accessible \
  --region eu-west-3
```

### 3. Amazon S3 + CloudFront

```bash
# Créer le bucket S3
aws s3 mb s3://redacnews-media --region eu-west-3

# Configurer CORS
aws s3api put-bucket-cors --bucket redacnews-media --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000", "https://*.amplifyapp.com"],
    "ExposeHeaders": ["ETag"]
  }]
}'
```

---

## 📁 FICHIERS DE CONFIGURATION

### turbo.json (racine)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

### apps/web/next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@redacnews/db', '@redacnews/api', '@redacnews/types'],
  images: {
    domains: [
      // CloudFront domain
      process.env.AWS_CLOUDFRONT_DOMAIN,
      // Cognito hosted UI
      'cognito-idp.eu-west-3.amazonaws.com',
    ].filter(Boolean),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
```

---

## 🔐 AWS COGNITO SETUP

### apps/web/lib/aws/amplify-config.ts

```typescript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
      },
    },
  },
});

export default Amplify;
```

### apps/web/lib/aws/auth.ts

```typescript
import { 
  signIn, 
  signUp, 
  signOut, 
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession 
} from 'aws-amplify/auth';

export async function login(email: string, password: string) {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username: email,
      password,
    });
    return { isSignedIn, nextStep };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function register(email: string, password: string, firstName: string, lastName: string) {
  try {
    const { isSignUpComplete, userId, nextStep } = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          given_name: firstName,
          family_name: lastName,
        },
      },
    });
    return { isSignUpComplete, userId, nextStep };
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
}

export async function confirmRegistration(email: string, code: string) {
  try {
    const { isSignUpComplete } = await confirmSignUp({
      username: email,
      confirmationCode: code,
    });
    return { isSignUpComplete };
  } catch (error) {
    console.error('Confirm error:', error);
    throw error;
  }
}

export async function logout() {
  try {
    await signOut();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

export async function getSession() {
  try {
    const session = await fetchAuthSession();
    return session;
  } catch (error) {
    return null;
  }
}

export async function getUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    return null;
  }
}
```

### apps/web/components/auth/AuthProvider.tsx

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import { getUser, getSession } from '@/lib/aws/auth';
import '@/lib/aws/amplify-config';

interface User {
  userId: string;
  username: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return () => hubListener();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getUser();
      if (currentUser) {
        setUser({
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId,
        });
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### apps/web/app/layout.tsx

```tsx
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'RédacNews',
  description: 'Newsroom management system for radio',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## 🌐 TRPC SETUP (avec Cognito)

### packages/api/src/trpc.ts

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@redacnews/db';

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req } = opts;
  
  // Extraire le token Cognito du header Authorization
  const authHeader = req.headers.authorization;
  let userId: string | null = null;
  let organizationId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      // Valider le token Cognito
      // En production, utiliser aws-jwt-verify
      const token = authHeader.substring(7);
      // Décoder et valider le JWT...
      // userId = decodedToken.sub;
    } catch (error) {
      console.error('Auth error:', error);
    }
  }

  return {
    db: prisma,
    userId,
    organizationId,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
```

---

## 🎨 LAYOUT PRINCIPAL

### apps/web/app/(dashboard)/layout.tsx

```tsx
'use client';

import Link from "next/link";
import { useAuth } from '@/components/auth/AuthProvider';
import { logout } from '@/lib/aws/auth';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  FolderOpen, 
  Presentation,
  Settings,
  Radio,
  LogOut,
  User
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Conducteur", href: "/conducteur", icon: LayoutDashboard },
  { name: "Sujets", href: "/sujets", icon: FileText },
  { name: "Médiathèque", href: "/mediatheque", icon: FolderOpen },
  { name: "Prompteur", href: "/prompteur", icon: Presentation },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const initials = user.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/conducteur" className="flex items-center gap-2">
              <Radio className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-lg">RédacNews</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Settings className="h-5 w-5 text-gray-500 hover:text-gray-700" />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-sm text-gray-500">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

---

## 📤 UPLOAD MÉDIA (S3)

### apps/web/lib/aws/s3.ts

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  organizationId: string
) {
  const key = `${organizationId}/media/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return {
    uploadUrl,
    key,
    publicUrl: `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`,
  };
}
```

---

## 🎯 COMMANDES UTILES

```bash
# Développement
npm run dev                    # Lancer tous les apps en mode dev
npm run dev --filter=web       # Lancer uniquement l'app web

# Base de données
cd packages/db
npx prisma generate           # Générer le client Prisma
npx prisma db push            # Pousser le schéma vers RDS
npx prisma studio             # Interface admin DB

# Build
npm run build                 # Build de production
npm run lint                  # Linter

# AWS Amplify (déploiement)
amplify init                  # Initialiser Amplify
amplify push                  # Déployer les changements
amplify publish               # Build + déployer le frontend

# Tests
npm run test                  # Tests unitaires
npm run test:e2e              # Tests E2E
```

---

## 💰 ESTIMATION COÛTS AWS (Free Tier + Petit usage)

| Service | Free Tier | Après Free Tier |
|---------|-----------|-----------------|
| Cognito | 50,000 MAU gratuits | $0.0055/MAU |
| RDS PostgreSQL | 750h/mois (12 mois) | ~$15/mois (db.t3.micro) |
| S3 | 5GB stockage | ~$0.023/GB |
| CloudFront | 1TB/mois | ~$0.085/GB |
| SES | 62,000 emails/mois | $0.10/1000 emails |
| Amplify Hosting | 1000 min build/mois | $0.01/min build |

**Estimation pour une petite radio (10 users, 50GB média)** : ~$25-40/mois après free tier

---

*Ce fichier complète CLAUDE.md avec les snippets de code prêts à l'emploi - Stack 100% AWS*
