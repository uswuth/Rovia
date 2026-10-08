import { useEffect, useRef, useCallback } from 'react';

interface UseScrollFadeOptions {
  size?: number;
  orientation?: 'vertical' | 'horizontal' | 'both';
}

/**
 * Hook to dynamically calculate scroll edge fading.
 * - Disables fade if there is no scroll overflow.
 * - Activates top/bottom/left/right edge fades dynamically based on user scroll position.
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollFadeOptions = {}
) {
  const { size = 40, orientation = 'vertical' } = options;
  const ref = useRef<T | null>(null);

  const updateFade = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    if (orientation === 'vertical' || orientation === 'both') {
      const hasOverflow = el.scrollHeight > el.clientHeight + 1;

      if (!hasOverflow) {
        el.setAttribute('data-overflow', 'false');
        el.style.setProperty('--scroll-fade-top', '0px');
        el.style.setProperty('--scroll-fade-bottom', '0px');
      } else {
        el.setAttribute('data-overflow', 'true');
        const scrollTop = el.scrollTop;
        const maxScroll = el.scrollHeight - el.clientHeight;

        // Top edge fade: 0px when at top, up to `size` as user scrolls down
        const topFade = Math.min(scrollTop, size);
        // Bottom edge fade: 0px when at bottom, up to `size` as user scrolls up
        const bottomFade = Math.min(maxScroll - scrollTop, size);

        el.style.setProperty('--scroll-fade-top', `${Math.max(0, topFade)}px`);
        el.style.setProperty('--scroll-fade-bottom', `${Math.max(0, bottomFade)}px`);
      }
    }

    if (orientation === 'horizontal' || orientation === 'both') {
      const hasOverflowX = el.scrollWidth > el.clientWidth + 1;

      if (!hasOverflowX) {
        el.setAttribute('data-overflow-x', 'false');
        el.style.setProperty('--scroll-fade-left', '0px');
        el.style.setProperty('--scroll-fade-right', '0px');
      } else {
        el.setAttribute('data-overflow-x', 'true');
        const scrollLeft = el.scrollLeft;
        const maxScrollX = el.scrollWidth - el.clientWidth;

        const leftFade = Math.min(scrollLeft, size);
        const rightFade = Math.min(maxScrollX - scrollLeft, size);

        el.style.setProperty('--scroll-fade-left', `${Math.max(0, leftFade)}px`);
        el.style.setProperty('--scroll-fade-right', `${Math.max(0, rightFade)}px`);
      }
    }
  }, [orientation, size]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateFade();

    const handleScroll = () => {
      requestAnimationFrame(updateFade);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    // Handle container or window resize
    const resizeObserver = new ResizeObserver(() => {
      updateFade();
    });
    resizeObserver.observe(el);
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [updateFade]);

  return ref;
}
