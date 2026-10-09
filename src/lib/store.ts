import { useSyncExternalStore } from "react";

type StoreOptions<T> = {
  /** Tool name, e.g. "timer". Stored under `ding:<key>:v<version>`. */
  key: string;
  version: number;
  defaults: T;
  /** Whether this store should sync to the user's AT Protocol account once sync exists. */
  sync: boolean;
  /** Turns data saved under an older version into the current shape. */
  migrate?: (old: unknown, fromVersion: number) => T;
};

export type Store<T> = {
  readonly key: string;
  readonly sync: boolean;
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
};

const storageKey = (key: string, version: number) => `ding:${key}:v${version}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function createStore<T>({
  key,
  version,
  defaults,
  sync,
  migrate,
}: StoreOptions<T>): Store<T> {
  const fullKey = storageKey(key, version);
  const listeners = new Set<() => void>();

  // Fields added to `defaults` without a version bump still get a value.
  const withDefaults = (value: unknown): T =>
    isPlainObject(defaults) && isPlainObject(value)
      ? { ...defaults, ...value }
      : (value as T);

  const write = (value: T) => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (private mode): keep the value in memory only.
    }
  };

  const migrateOlder = (): T | undefined => {
    if (!migrate) return undefined;
    for (let v = version - 1; v >= 1; v--) {
      const oldKey = storageKey(key, v);
      const raw = localStorage.getItem(oldKey);
      if (raw === null) continue;
      const migrated = migrate(JSON.parse(raw), v);
      write(migrated);
      localStorage.removeItem(oldKey);
      return migrated;
    }
    return undefined;
  };

  const read = (): T => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw !== null) return withDefaults(JSON.parse(raw));
      return migrateOlder() ?? defaults;
    } catch {
      return defaults;
    }
  };

  let current = read();

  const emit = () => listeners.forEach((listener) => listener());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== fullKey && event.key !== null) return;
    current = read();
    emit();
  };

  return {
    key: fullKey,
    sync,
    get: () => current,
    set: (next) => {
      current =
        typeof next === "function" ? (next as (prev: T) => T)(current) : next;
      write(current);
      emit();
    },
    reset: () => {
      current = defaults;
      try {
        localStorage.removeItem(fullKey);
      } catch {
        // Nothing to clear.
      }
      emit();
    },
    subscribe: (listener) => {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0)
          window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export function useStore<T>(store: Store<T>): [T, Store<T>["set"]] {
  const value = useSyncExternalStore(store.subscribe, store.get);
  return [value, store.set];
}
