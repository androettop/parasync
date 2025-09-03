import { useEffect, useRef } from "react";

export function useKeepAwake() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function requestWakeLock() {
      try {
        // @ts-ignore
        const sentinel: WakeLockSentinel =
          await navigator.wakeLock.request("screen");
        wakeLockRef.current = sentinel;
      } catch (err) {
        console.error("Failed to acquire wake lock:", err);
      }
    }

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);
}
