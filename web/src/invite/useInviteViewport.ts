import { useEffect, useState, type RefObject } from 'react';

// Ignore normal browser chrome changes; only a substantial loss of visible height
// while editing suspends the dock. Zoom uses the in-flow controls instead.
const KEYBOARD_OCCLUSION_PX = 120;
const READING_EDGE_TOLERANCE_PX = 1;

export function useInviteViewport(
  scrollRef: RefObject<HTMLDivElement | null>,
  detailRef: RefObject<HTMLElement | null>,
  ready: boolean,
) {
  const [viewport, setViewport] = useState<{
    reading: boolean;
    height?: number;
    hideActions: boolean;
  }>({ reading: false, hideActions: false });

  useEffect(() => {
    if (!ready) return;
    const scroll = scrollRef.current;
    const visible = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement;
        const editing =
          focused instanceof HTMLTextAreaElement ||
          (focused instanceof HTMLInputElement && focused.type === 'text');
        const zoomed = Boolean(visible && visible.scale !== 1);
        const keyboard =
          editing && (!visible || window.innerHeight - visible.height > KEYBOARD_OCCLUSION_PX);
        const next = {
          reading: Boolean(
            scroll &&
            detailRef.current &&
            detailRef.current.getBoundingClientRect().top <=
              scroll.getBoundingClientRect().top + READING_EDGE_TOLERANCE_PX,
          ),
          height: visible && !zoomed ? visible.height : undefined,
          hideActions: keyboard || zoomed,
        };
        setViewport((current) =>
          current.reading === next.reading &&
          current.height === next.height &&
          current.hideActions === next.hideActions
            ? current
            : next,
        );
      });
    };
    update();
    scroll?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    visible?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      scroll?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      visible?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [scrollRef, detailRef, ready]);

  return viewport;
}
