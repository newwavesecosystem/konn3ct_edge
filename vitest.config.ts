import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      'react': path.resolve(__dirname, './frontend/node_modules/react'),
      'react-dom': path.resolve(__dirname, './frontend/node_modules/react-dom')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts', './test/setup.ts'],
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/.next/**', 
      '**/frontend/e2e/**', 
      '**/*.spec.ts' // Playwright tests use spec.ts, Vitest will use test.ts
    ],
    include: ['test/**/*.test.{ts,tsx}', 'src/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true,
      include: [
        'src/signaling/server.ts',
        'frontend/lib/meeting-context.tsx',
        'frontend/components/meeting/ParticipantTile.tsx',
        'frontend/lib/webrtc.ts',
        'frontend/lib/video-processor.ts',
        'frontend/lib/api-client.ts',
        'src/media/sfu.ts',
        'src/routes/auth.ts',
        'src/routes/scheduling.ts'
      ]
    },
  },
});
