import { describe, it, expect } from 'vitest';
import { RWMutex } from '../src/rwmutex.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RWMutex', () => {
  it('allows multiple readers simultaneously', async () => {
    const mutex = new RWMutex();
    let activeReaders = 0;
    let maxReaders = 0;

    const reader = async () => {
      const unlock = await mutex.rlock();
      activeReaders++;
      maxReaders = Math.max(maxReaders, activeReaders);
      await sleep(50);
      activeReaders--;
      unlock();
    };

    await Promise.all([reader(), reader(), reader()]);
    expect(maxReaders).toBe(3);
  });

  it('allows only one writer at a time', async () => {
    const mutex = new RWMutex();
    let activeWriters = 0;
    let maxWriters = 0;

    const writer = async () => {
      const unlock = await mutex.lock();
      activeWriters++;
      maxWriters = Math.max(maxWriters, activeWriters);
      await sleep(50);
      activeWriters--;
      unlock();
    };

    await Promise.all([writer(), writer(), writer()]);
    expect(maxWriters).toBe(1);
  });

  it('blocks readers when writer is waiting (preferWriters=true)', async () => {
    const mutex = new RWMutex(true);
    const log: string[] = [];

    const reader1 = async () => {
      const unlock = await mutex.rlock();
      log.push('reader1 start');
      await sleep(100);
      log.push('reader1 end');
      unlock();
    };

    const writer = async () => {
      await sleep(10); // чтобы зашла reader1
      const unlock = await mutex.lock();
      log.push('writer start');
      await sleep(50);
      log.push('writer end');
      unlock();
    };

    const reader2 = async () => {
      await sleep(20);
      const unlock = await mutex.rlock();
      log.push('reader2 start');
      await sleep(50);
      log.push('reader2 end');
      unlock();
    };

    await Promise.all([reader1(), writer(), reader2()]);
    expect(log).toEqual([
      'reader1 start',
      'reader1 end',
      'writer start',
      'writer end',
      'reader2 start',
      'reader2 end',
    ]);
  });

  it('throws timeout error if lock not acquired', async () => {
    const mutex = new RWMutex();

    const unlock = await mutex.lock();
    try {
      await expect(mutex.lock(100)).rejects.toThrowError(/timeout/);
    } finally {
      unlock();
    }
  });

  it('withReadLock / withWriteLock work correctly', async () => {
    const mutex = new RWMutex();
    const events: string[] = [];

    await Promise.all([
      mutex.withReadLock(async () => {
        events.push('reader');
        await sleep(50);
      }),
      mutex.withWriteLock(async () => {
        events.push('writer');
        await sleep(50);
      }),
    ]);

    expect(events).toContain('reader');
    expect(events).toContain('writer');
  });

  it('withWriteLock throws on timeout', async () => {
    const mutex = new RWMutex();
    const unlock = await mutex.lock();

    try {
      await expect(
        mutex.withWriteLock(async () => {
          // Этот код не должен выполниться
          throw new Error('Should not reach here');
        }, 100)
      ).rejects.toThrowError(/timeout/);
    } finally {
      unlock();
    }
  });

  it('state() returns internal counters', async () => {
    const mutex = new RWMutex();
    const unlock = await mutex.rlock();

    const state = mutex.state;
    expect(state.readers).toBe(1);
    expect(state.writer).toBe(false);
    expect(state.pendingWriters).toBe(0);

    unlock();
  });
});
