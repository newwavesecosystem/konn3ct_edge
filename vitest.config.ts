import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      'react': path.resolve(__dirname, './frontend/node_modules/react'),
      'react-dom': path.resolve(__dirname, './frontend/node_modules/react-dom'),
      '@testing-library/react': path.resolve(__dirname, './frontend/node_modules/@testing-library/react')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    setupFiles: ['./src/__tests__/setup.ts', './test/setup.ts'],
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/.next/**', 
      '**/frontend/e2e/**', 
      '**/*.spec.ts', // Playwright tests use spec.ts, Vitest will use test.ts
      'test/unit/StageView.test.tsx',
      'test/unit/ai-panel.test.tsx',
      'test/unit/participant-tile.test.ts',
      'test/unit/webrtc.test.ts',
      'test/unit/mute-latency.test.ts',
      'test/unit/scale.test.ts',
      'test/unit/action-lifecycle.test.ts',
      'test/unit/video-processor.test.ts'
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
