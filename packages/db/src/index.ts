import { PrismaClient } from '@prisma/client';

// For AWS Amplify SSR, env vars may not be available at runtime
// Try to load from .env.production if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');

    // Try multiple possible locations for .env.production
    const possiblePaths = [
      path.join(process.cwd(), '.env.production'),
      path.join(__dirname, '../../../apps/web/.env.production'),
      '/var/task/.env.production',
      '/var/task/apps/web/.env.production',
    ];

    for (const envPath of possiblePaths) {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = value;
            }
          }
        }
        console.log(`[Prisma] Loaded env from ${envPath}`);
        break;
      }
    }
  } catch (e) {
    console.error('[Prisma] Failed to load .env.production:', e);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
