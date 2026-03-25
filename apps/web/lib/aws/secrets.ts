// Helper pour récupérer les secrets depuis AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'eu-west-3' });

// Cache des secrets en mémoire pour éviter les appels répétés
const secretsCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getSecret<T = Record<string, any>>(secretName: string): Promise<T> {
  // Vérifier le cache
  const cached = secretsCache.get(secretName);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value as T;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no SecretString`);
    }

    const secretValue = JSON.parse(response.SecretString);

    // Mettre en cache
    secretsCache.set(secretName, {
      value: secretValue,
      timestamp: Date.now(),
    });

    return secretValue as T;
  } catch (error: any) {
    console.error(`Failed to get secret ${secretName}:`, error.message);
    throw new Error(`Failed to retrieve secret: ${secretName}`);
  }
}

// Type pour le secret Anthropic
export interface AnthropicSecret {
  apiKey: string;
  defaultModel: string;
}

// Helpers spécifiques pour les secrets RédacNews
export async function getAnthropicCredentials(): Promise<AnthropicSecret> {
  return getSecret<AnthropicSecret>('redacnews/anthropic-api-key');
}

export async function getGoogleServiceAccount(): Promise<Record<string, any>> {
  return getSecret('redacnews/google-service-account');
}
