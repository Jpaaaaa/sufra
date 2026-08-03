let lock: Promise<void> = Promise.resolve();
let locked = false;

export function isBackupLockHeld(): boolean {
  return locked;
}

export async function withBackupLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  const previous = lock;
  let release!: () => void;
  lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  locked = true;
  try {
    return await fn();
  } finally {
    locked = false;
    release();
  }
}
