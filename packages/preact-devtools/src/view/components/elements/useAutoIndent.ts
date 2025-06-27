import { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useResize } from '../utils';

const INITIAL = 14;
const RIGHT_MARGIN = 16;

export function useAutoIndent(
  container: RefObject<HTMLElement | null>,
  deps: any[],
) {
  const indent = useRef(INITIAL);
  const [available, setAvailable] = useState(0);
  const cacheRef = useRef(new Map<string, number>());

  useResize(
    () => {
      indent.current = INITIAL;
      if (container.current) {
        setAvailable(container.current.clientWidth);
      }
    },
    [],
    true,
  );

  useLayoutEffect(() => {
    if (container.current) {
      let space = available;
      if (available === 0) {
        space = container.current.clientWidth;
      }

      const cache = cacheRef.current;
      const { childNodes } = container.current;

      let nextIndent = indent.current;

      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i] as HTMLElement;
        if (!child) continue;

        const id = child.getAttribute('data-id');
        if (!id) continue;

        // Measure the actual first child
        const el = child.firstChild as HTMLElement;
        if (!el) continue;

        let width = cache.get(id);
        if (!width) {
          width = el.offsetWidth + RIGHT_MARGIN;
          cache.set(id, width);
        }

        const depth = +(child.getAttribute('data-depth') || 0);
        nextIndent = Math.min(nextIndent, Math.max(0, (space - width) / depth));
      }

      container.current.style.setProperty('--indent-depth', `${nextIndent}px`);
      indent.current = nextIndent;
    }
  }, [...deps, available]);

  return indent;
}
