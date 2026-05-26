import { test, expect } from 'vitest';
import { prismaMock } from './mockPrisma';

test('Math works', () => {
  expect(1 + 1).toBe(2);
});

test('Prisma mock works', async () => {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'test-id',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const user = await prismaMock.user.findUnique({ where: { id: 'test-id' } });
  expect(user?.email).toBe('test@example.com');
});
