import { describe, it, expect, beforeEach } from 'vitest';
import { RWMutex } from '../src/rwmutex';
import type { UnlockFn } from '../src/rwmutex';

describe('RWMutex', () => {
  let mutex: RWMutex;

  beforeEach(() => {
    mutex = new RWMutex();
  });

  it('should allow multiple readers', async () => {
    const readers = 5;
    const promises = Array(readers).fill(0).map(() => mutex.rlock());
    const locks = await Promise.all(promises);
    expect(mutex.state.readers).toBe(readers);
    locks.forEach(unlock => unlock());
    expect(mutex.state.readers).toBe(0);
  });

  it('should not allow writer while readers are active', async () => {
    const readerLock = await mutex.rlock();
    const writerPromise = mutex.lock(100);
    await expect(writerPromise).rejects.toThrow('write lock timeout');
    readerLock();
  });

  it('should not allow readers while writer is active', async () => {
    const writerLock = await mutex.lock();
    const readerPromise = mutex.rlock(100);
    await expect(readerPromise).rejects.toThrow('read lock timeout');
    writerLock();
  });

  it('should clear queues on timeout', async () => {
    const writerLock = await mutex.lock();
    const readerPromises = Array(5).fill(0).map(() => mutex.rlock(100));
    await Promise.all(readerPromises.map(p => p.catch(() => {})));
    expect(mutex.state.pendingReaders).toBe(0);
    writerLock();
  });

  it('should reject when queue size exceeds limit', async () => {
    const writerLock = await mutex.lock();
    const readerPromises = Array(1001).fill(0).map(() => mutex.rlock());
    await expect(Promise.all(readerPromises)).rejects.toThrow('Too many pending readers');
    writerLock();
  });

  it.concurrent('should handle stress test with multiple concurrent operations', async () => {
    const iterations = 500;
    const batchSize = 10;
    const results: number[] = [];
    let counter = 0;
    const LOCK_TIMEOUT = 20_000;
    const WRITE_INTERVAL = 5; // Каждая пятая операция - запись

    const operation = async () => {
      const value = await mutex.withReadLock(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        return counter;
      }, LOCK_TIMEOUT);
      results.push(value);
    };

    const writeOperation = async () => {
      await mutex.withWriteLock(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        counter++;
      }, LOCK_TIMEOUT);
    };

    type Operation = () => Promise<void>;
    const batches: Operation[][] = [];
    
    for (let i = 0; i < iterations; i += batchSize) {
      const batch = Array(Math.min(batchSize, iterations - i)).fill(0).map((_, index) => {
        const operationIndex = i + index;
        if (operationIndex % WRITE_INTERVAL === 0) {
          return writeOperation;
        }
        return operation;
      });
      batches.push(batch);
    }

    for (const batch of batches) {
      await Promise.all(batch.map(op => op()));
    }

    const expectedWrites = Math.floor(iterations / WRITE_INTERVAL);
    expect(counter).toBe(expectedWrites);
    expect(results.length).toBe(iterations - expectedWrites);
  }, 30_000);

  it.concurrent.skip('should handle stress test with queue overflow', async () => {
    const batchSize = 100;
    const writerLock = await mutex.lock(20_000);
    
    type PromiseResult = PromiseSettledResult<UnlockFn>;
    const batches: Promise<UnlockFn>[][] = [];
    
    for (let i = 0; i < 1100; i += batchSize) {
      const batch = Array(Math.min(batchSize, 1100 - i)).fill(0).map(() => mutex.rlock(20_000));
      batches.push(batch);
    }

    const results: PromiseResult[] = [];
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
    }

    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<UnlockFn> => r.status === 'fulfilled');

    expect(rejected.length).toBeGreaterThan(0);
    expect(fulfilled.length).toBeLessThanOrEqual(1000);
    writerLock();
  }, 30_000);

  it('should clear all queues and reset state', async () => {
    const writerLock = await mutex.lock();
    const readerPromises = Array(5).fill(0).map(() => mutex.rlock(100));
    await Promise.all(readerPromises.map(p => p.catch(() => {})));
    
    mutex.clear();
    expect(mutex.state).toEqual({
      readers: 0,
      writer: false,
      pendingReaders: 0,
      pendingWriters: 0
    });
    
    writerLock();
  });
}); 