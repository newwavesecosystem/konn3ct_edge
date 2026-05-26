import { vi } from 'vitest';
import { db } from '../db';

vi.mock('../db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    room: {
      count: vi.fn(),
    },
    teamMember: {
      count: vi.fn(),
    },
    recording: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    meetingSession: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  }
}));

export const prismaMock = db as any;
