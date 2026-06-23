import dotenv from 'dotenv';
import path from 'path';

// Load .env.test specifically for Vitest before Prisma initializes
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Verify it loaded correctly
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is missing in .env.test. Integration tests may fail. Check .env.test.example.');
} else {
  const dbUrl = process.env.DATABASE_URL.toLowerCase();
  
  if (dbUrl.includes('production') || dbUrl.includes('prod') || dbUrl.includes('staging')) {
    console.error('❌  DANGER: DATABASE_URL appears to be pointing to production or staging! Tests aborted.');
    process.exit(1);
  }

  if (!dbUrl.includes('test') && !dbUrl.includes('konn3ct_test')) {
    console.error('❌  DANGER: DATABASE_URL does not contain "test". Refusing to run integration tests against a potentially real database.');
    process.exit(1);
  }
}
