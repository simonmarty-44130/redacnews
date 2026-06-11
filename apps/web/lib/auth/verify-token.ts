// Vérifie un access token Cognito (Authorization: Bearer) SANS exiger qu'un
// User applicatif existe déjà — utilisé pendant l'onboarding (checkout), avant
// que l'organisation ne soit provisionnée.

import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    });
  }
  return verifier;
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization');
  if (h?.startsWith('Bearer ')) {
    const t = h.slice(7).trim();
    return t || null;
  }
  return null;
}

/** Retourne le `sub` Cognito si le token est valide, sinon null. */
export async function verifyAccessToken(req: Request): Promise<{ sub: string } | null> {
  try {
    const token = bearer(req);
    if (!token) return null;
    const payload = await getVerifier().verify(token);
    if (!payload?.sub) return null;
    return { sub: payload.sub };
  } catch (e) {
    console.error('[verify-token] échec:', e);
    return null;
  }
}
