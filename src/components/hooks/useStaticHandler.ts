/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback } from "react";

const useStaticHandler = <U extends any[], V>(
  eventHandler: (...args: U) => V
): ((...args: U) => V) => {
  const ref = useRef<any>(() => {});
  ref.current = eventHandler;

  return useCallback((...args) => ref.current(...args), [ref]);
};

export default useStaticHandler;