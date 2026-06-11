// Authentification serveur pour le contexte tRPC.
//
// SECURITE : l'identite (et donc l'organizationId multi-tenant) DOIT etre
// derivee d'un token Cognito verifie cryptographiquement cote serveur — jamais
// d'un en-tete pose par le client. Ce module reproduit la logique de
// `apps/web/lib/auth/get-current-user.ts` mais au niveau du package API.

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { prisma } from '@redacnews/db';

export interface AuthContext {
  userId: string;
  organizationId: string;
  cognitoId: string;
}

// Verificateur JWT cree de maniere paresseuse (singleton).
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    const userPoolId =
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
      process.env.COGNITO_USER_POOL_ID;
    const clientId =
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ||
      process.env.COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      throw new Error(
        'Cognito non configure : NEXT_PUBLIC_COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_CLIENT_ID manquants'
      );
    }

    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }
  return verifier;
}

/**
 * Extrait le token d'acces Cognito d'une requete.
 * Priorite a l'en-tete `Authorization: Bearer <token>`, avec repli sur les
 * cookies Amplify (`CognitoIdentityServiceProvider.<clientId>.<sub>.accessToken`).
 */
export function extractAccessToken(headers: Headers): string | null {
  const authHeader = headers.get('authorization') || headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  // Repli : cookies poses par Amplify (stockage cookie / SSR).
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name.includes('accessToken')) {
        const value = part.slice(eq + 1).trim();
        if (value) return decodeURIComponent(value);
      }
    }
  }

  return null;
}

/**
 * Verifie le token et resout l'utilisateur applicatif (avec son organisation).
 * Retourne null si le token est absent, invalide, ou si l'utilisateur n'existe
 * pas en base. Ne jette jamais : un echec de verification = pas d'identite.
 */
export async function getAuthContext(
  headers: Headers
): Promise<AuthContext | null> {
  try {
    const accessToken = extractAccessToken(headers);
    if (!accessToken) return null;

    const payload = await getVerifier().verify(accessToken);
    if (!payload?.sub) return null;

    const cognitoId = payload.sub;

    const user = await prisma.user.findUnique({
      where: { cognitoId },
      select: { id: true, organizationId: true },
    });
    if (!user) return null;

    return {
      userId: user.id,
      organizationId: user.organizationId,
      cognitoId,
    };
  } catch (error) {
    // Token expire / signature invalide / pool inconnu, etc.
    console.error('[tRPC auth] verification echouee:', error);
    return null;
  }
}
