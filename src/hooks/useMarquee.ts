import { useEffect } from "react";
import useStaticHandler from "./useStaticHandler";

const useMarquee = (
  ref: React.RefObject<HTMLElement>,
  enableAnimation: boolean,
) => {
  const animateMarquee = useStaticHandler(() => {
    if (ref.current) {
      const target = ref.current;
      let offset = target.scrollLeft || 0;
      let direction = 1;
      let timeoutId: number | undefined;

      target.style.textOverflow = "clip";

      const animate = () => {
        const maxOffset = target.scrollWidth - target.clientWidth;

        if (direction === 1 && offset >= maxOffset) {
          direction = -1;
          timeoutId = window.setTimeout(animate, 2000);
        } else if (direction === -1 && offset <= 0) {
          direction = 1;
          timeoutId = window.setTimeout(animate, 2000);
        } else {
          offset += direction;
          target.scrollLeft = offset;
          timeoutId = window.setTimeout(animate, 15);
        }
      };

      animate();

      return () => {
        target.style.textOverflow = "ellipsis";
        target.scrollLeft = 0;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      };
    }
  });

  useEffect(() => {
    const target = ref.current;
    if (target) {
      // Check if the text overflows the container
      if (enableAnimation) {
        return animateMarquee();
      }
    }
    return () => {};
  }, [animateMarquee, enableAnimation]);
};

export default useMarquee;
