import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

type SetStateAction<T> = T | ((prevState: T) => T);
type StorageEventCallback = (this: Window, ev: StorageEvent) => void;

function dispatchStorageEvent(key: string, value: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue: value,
    }),
  );
}

const setLocalStorageItem = <T>(key: string, value: T): void => {
  const stringifiedValue = JSON.stringify(value);
  window.localStorage.setItem(key, stringifiedValue);
  dispatchStorageEvent(key, stringifiedValue);
};

const removeLocalStorageItem = (key: string): void => {
  window.localStorage.removeItem(key);
  dispatchStorageEvent(key, null);
};

const getLocalStorageItem = (key: string): string | null => {
  return window.localStorage.getItem(key);
};

const useLocalStorageSubscribe = (
  callback: StorageEventCallback,
): (() => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getLocalStorageServerSnapshot = (): never => {
  throw Error("useLocalStorage is a client-only hook");
};

// Main hook
export function useLocalStorage<T>(
  key: string,
  initialValue?: T,
): [T, (value: SetStateAction<T>) => void] {
  const getSnapshot = () => getLocalStorageItem(key);

  const store = useSyncExternalStore(
    useLocalStorageSubscribe,
    getSnapshot,
    getLocalStorageServerSnapshot,
  );

  const setState = useCallback(
    (v: SetStateAction<T>) => {
      try {
        const prev = store ? JSON.parse(store) : initialValue;
        const nextState =
          typeof v === "function" ? (v as (prev: T) => T)(prev) : v;

        if (nextState === undefined || nextState === null) {
          removeLocalStorageItem(key);
        } else {
          setLocalStorageItem(key, nextState);
        }
      } catch (e) {
        console.warn(e);
      }
    },
    [key, store, initialValue],
  );

  useEffect(() => {
    if (
      getLocalStorageItem(key) === null &&
      typeof initialValue !== "undefined"
    ) {
      setLocalStorageItem(key, initialValue);
    }
  }, [key, initialValue]);

  const parsed = useMemo(
    () => (store ? JSON.parse(store) : initialValue),
    [store, initialValue],
  );
  return [parsed as T, setState];
}
