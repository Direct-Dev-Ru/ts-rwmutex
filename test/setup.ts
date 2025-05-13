import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Устанавливаем таймаут для тестов
  vi.setConfig({
    testTimeout: 10000,
  });
});
