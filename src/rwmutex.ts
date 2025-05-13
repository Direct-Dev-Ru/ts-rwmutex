export type UnlockFn = () => void;
type LockType = 'read' | 'write';

export class RWMutex {
  private readers = 0;
  private writer = false;
  private pendingReaders: (() => void)[] = [];
  private pendingWriters: (() => void)[] = [];
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor(private preferWriters = true) {}

  private debug(message: string) {
    if (process.env.RWMUTEX_DEBUG === '1') {
      console.log(`[RWMutex] ${message}`);
    }
  }

  async rlock(timeoutMs = 5000): Promise<UnlockFn> {
    return this.tryLock('read', timeoutMs);
  }

  async lock(timeoutMs = 5000): Promise<UnlockFn> {
    return this.tryLock('write', timeoutMs);
  }

  private tryLock(type: LockType, timeoutMs: number): Promise<UnlockFn> {
    return new Promise<UnlockFn>((resolve, reject) => {
      const tryAcquire = () => {
        if (type === 'read') {
          if (!this.writer && (!this.preferWriters || this.pendingWriters.length === 0)) {
            this.readers++;
            this.debug(`Reader acquired (readers: ${this.readers})`);
            clearTimeout(timeout);
            resolve(() => this.runlock());
            return;
          }
          if (this.pendingReaders.length >= this.MAX_QUEUE_SIZE) {
            clearTimeout(timeout);
            reject(new Error('Too many pending readers'));
            return;
          }
          this.pendingReaders.push(tryAcquire);
        } else {
          if (!this.writer && this.readers === 0) {
            this.writer = true;
            this.debug('Writer acquired');
            clearTimeout(timeout);
            resolve(() => this.unlock());
            return;
          }
          this.pendingWriters.push(tryAcquire);
        }
      };

      const timeout = setTimeout(() => {
        if (type === 'read') {
          const index = this.pendingReaders.indexOf(tryAcquire);
          if (index !== -1) this.pendingReaders.splice(index, 1);
        } else {
          const index = this.pendingWriters.indexOf(tryAcquire);
          if (index !== -1) this.pendingWriters.splice(index, 1);
        }
        reject(new Error(`${type} lock timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        tryAcquire();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private runlock(): void {
    this.readers--;
    this.debug(`Reader released (readers: ${this.readers})`);
    this.schedule();
  }

  private unlock(): void {
    this.writer = false;
    this.debug('Writer released');
    this.schedule();
  }

  private schedule() {
    if (!this.writer && this.readers === 0 && this.pendingWriters.length > 0) {
      const writerNext = this.pendingWriters.shift();
      if (writerNext) writerNext();
    } else if (!this.writer && (!this.preferWriters || this.pendingWriters.length === 0)) {
      while (this.pendingReaders.length > 0) {
        const readerNext = this.pendingReaders.shift();
        if (readerNext) readerNext();
      }
    }
  }

  async withReadLock<T>(fn: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    const unlock = await this.rlock(timeoutMs);
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  async withWriteLock<T>(fn: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    const unlock = await this.lock(timeoutMs);
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  get state() {
    return {
      readers: this.readers,
      writer: this.writer,
      pendingReaders: this.pendingReaders.length,
      pendingWriters: this.pendingWriters.length,
    };
  }

  public clear() {
    this.pendingReaders = [];
    this.pendingWriters = [];
    this.readers = 0;
    this.writer = false;
  }
}
