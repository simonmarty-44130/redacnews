// Fonction pour récupérer l'utilisateur courant côté serveur

import { getCurrentUser as getCognitoUser, fetchAuthSession } from 'aws-amplify/auth';
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    // Récupérer l'utilisateur depuis Cognito
    const cognitoUser = await getCognitoUser();

    if (!cognitoUser || !cognitoUser.userId) {
      return null;
    }

    // Récupérer l'utilisateur depuis la base de données
    const user = await prisma.user.findUnique({
      where: { cognitoId: cognitoUser.userId },
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
