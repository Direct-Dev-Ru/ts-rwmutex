# rwmutex-ts

> 🧵 Reader-writer mutex for TypeScript / ESM with timeout support and lock priority

[![npm](https://img.shields.io/npm/v/rwmutex-ts)](https://www.npmjs.com/package/rwmutex-ts)
[![license](https://img.shields.io/npm/l/rwmutex-ts)](LICENSE)
[![test](https://img.shields.io/badge/tested-vitest-9cf.svg)](https://vitest.dev)

## ✨ Features

- ✅ Asynchronous **read-write mutex** implementation
- ⏱️ Supports **timeout for lock acquisition**
- ⚖️ Prioritizes **writers over readers** to avoid starvation
- 🧪 Tested with [Vitest](https://vitest.dev)
- 📦 ESM-native and typed (`.d.ts`)

## 📦 Installation

```bash
npm install rwmutex-ts
```

## 🔧 Usage

```typescript
import { RWMutex } from 'rwmutex-ts';

const mutex = new RWMutex();

// Reader section
await mutex.withReadLock(async () => {
  // Shared resource access
});

// Writer section
await mutex.withWriteLock(async () => {
  // Exclusive access
});
```

## ⏱️ Lock Timeout Example

You can pass a timeout (in milliseconds) to abort if the lock can't be acquired:

```typescript
try {
  await mutex.withWriteLock(async () => {
    // critical section
  }, 200); // try for max 200ms
} catch (err) {
  console.error('Write lock timeout:', err);
}
```

## 🧪 Test

```bash
npm run test
```

## 📘 API

### `withReadLock(fn: () => Promise<T>, timeoutMs?: number): Promise<T>`

Executes `fn` under a read lock. Fails if the lock cannot be acquired within the timeout.

### `withWriteLock(fn: () => Promise<T>, timeoutMs?: number): Promise<T>`

Executes `fn` under a write lock. Timeout behaves the same.

## 📄 License

MIT © 2025 Your Name

## 🛠 Example Projects

- 🔐 Locking shared config access in SSR apps
- 📁 Concurrent file readers
- 🧵 Concurrency control in worker pools

PRs and issues welcome!
