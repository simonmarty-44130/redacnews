// Fonction pour récupérer l'utilisateur courant côté serveur (API Routes)

import { cookies } from 'next/headers';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { prisma } from '@redacnews/db';

export interface CurrentUser {
  id: string;
  email: string;
  cognitoId: string;
  organizationId: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}

// Créer un vérificateur JWT pour Cognito
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    // Récupérer le token depuis les cookies
    const cookieStore = cookies();

    // Chercher le token d'accès dans les cookies Amplify
    let accessToken: string | undefined;

    // Les cookies Amplify sont stockés avec ce pattern
    const amplifyTokenKey = `CognitoIdentityServiceProvider.${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}`;

    // Parcourir tous les cookies pour trouver celui qui contient le token
    cookieStore.getAll().forEach(cookie => {
      if (cookie.name.includes('accessToken')) {
        accessToken = cookie.value;
      }
    });

    if (!accessToken) {
      console.log('No access token found in cookies');
      return null;
    }

    // Vérifier et décoder le token
    const payload = await verifier.verify(accessToken);

    if (!payload || !payload.sub) {
      return null;
    }

    const cognitoId = payload.sub;

    // Récupérer l'utilisateur depuis la base de données
    const user = await prisma.user.findUnique({
      where: { cognitoId },
      select: {
        id: true,
        email: true,
        cognitoId: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      console.log('User not found in database for cognitoId:', cognitoId);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      cognitoId: user.cognitoId,
      organizationId: user.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}
