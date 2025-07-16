import { useRef, useCallback } from "react";

const useStaticHandler = <U extends unknown[], V>(
  eventHandler: (...args: U) => V,
): ((...args: U) => V) => {
  const ref = useRef<(...args: U) => V>(eventHandler);
  ref.current = eventHandler;

  return useCallback((...args) => ref.current(...args), [ref]);
};

export default useStaticHandler;
