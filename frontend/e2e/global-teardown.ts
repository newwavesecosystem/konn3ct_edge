/**
 * Playwright Global Teardown
 * ==========================
 * Runs ONCE after all tests complete. Cleans up test data created in globalSetup.
 */
import { execSync } from 'child_process';
import path from 'path';
import { TEST_ROOM_SLUG } from './global-setup';

export default async function globalTeardown() {
  console.log('\n🧹 [Global Teardown] Cleaning up test data...\n');

  try {
    const teardownScript = `
      const { PrismaClient } = require('@prisma/client');
      const db = new PrismaClient();

      async function main() {
        await db.room.deleteMany({ where: { slug: { in: ['playwright-prefs-room', 'playwright-health-room', 'playwright-webrtc-room'] } } });
        await db.user.deleteMany({ where: { email: 'playwright-bot@konn3ct.test' } });
        console.log('Test data cleaned up.');
        await db.$disconnect();
      }

      main().catch(e => { console.error(e); process.exit(1); });
    `;

    execSync(`node -e "${teardownScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, {
      cwd: path.resolve(__dirname, '../../'),
      stdio: 'inherit',
    });

    console.log('\n✅ [Global Teardown] Done.\n');
  } catch (err: any) {
    console.warn('\n⚠ [Global Teardown] Cleanup failed (safe to ignore):', err.message, '\n');
  }
}
