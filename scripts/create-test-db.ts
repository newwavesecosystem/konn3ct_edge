import { PrismaClient } from '@prisma/client';

async function main() {
  const prodUrl = process.env.DATABASE_URL;
  if (!prodUrl) throw new Error('Missing DATABASE_URL');
  
  console.log('Connecting to primary database to create konn3ct_test...');
  const prisma = new PrismaClient({ datasources: { db: { url: prodUrl } } });
  
  try {
    // Cannot run CREATE DATABASE inside a transaction, and prisma sometimes wraps things.
    // Try executing it directly.
    await prisma.$executeRawUnsafe('CREATE DATABASE konn3ct_test;');
    console.log('Created konn3ct_test database successfully.');
  } catch (err: any) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Database already exists. Continuing...');
    } else {
      console.error('Failed to create database. It might be a permission issue or unsupported by Prisma raw execute.');
      console.error(err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
