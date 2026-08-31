import { PrismaClient } from '@prisma/client';

// Add prisma to the Node.js global type
declare global {
  var prisma: PrismaClient | undefined;
}

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes('connection_limit=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  const limit = process.env.DB_CONNECTION_LIMIT || '5';
  const timeout = process.env.DB_POOL_TIMEOUT || '20';
  return `${url}${separator}connection_limit=${limit}&pool_timeout=${timeout}`;
}

const dbUrl = getDatabaseUrl();

// Prevent multiple instances of Prisma Client
export const db = global.prisma || new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = db;
}
