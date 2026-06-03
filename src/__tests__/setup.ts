import dotenv from 'dotenv';
import path from 'path';

// Load the testing environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Setup global fetch/redis mocks if necessary
import { vi } from 'vitest';

vi.mock('../lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
  },
  initRedis: vi.fn(),
}));
