import { RefObject, VNode } from 'preact';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useResize } from '../utils';

export interface VirtualizedListProps<T> {
  items: T[];
  container: RefObject<Element | null>;
  rowHeight: number;
  minBufferCount: number;
  renderRow: (item: T, idx: number, top: number) => any;
}

export function useVirtualizedList<T>({
  rowHeight,
  minBufferCount,
  items,
  container,
  renderRow,
}: VirtualizedListProps<T>) {
  const [height, setHeight] = useState(0);
  const [scroll, setScroll] = useState(0);

  const bufferCount = height > 0
    ? Math.max(minBufferCount, Math.ceil(height / rowHeight / 2))
    : minBufferCount;

  let idx = Math.max(0, Math.floor(scroll / rowHeight) - bufferCount);
  const max = idx + Math.ceil(height / rowHeight) + bufferCount;
  let top = idx * rowHeight;

  // A bit hacky, we basically want to ensure that `scrollToItem`
  // is ALWAYS stable
  const timeoutRef = useRef<any>(null);
  const scrollRef = useRef(scroll);
  const itemsRef = useRef(items);
  const heightRef = useRef(height);
  scrollRef.current = scroll;
  itemsRef.current = items;
  heightRef.current = height;

  const scrollToItem = useCallback(
    (item: T) => {
      const scroll = scrollRef.current;
      const items = itemsRef.current;
      const height = heightRef.current;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const nextIdx = items.findIndex(t => t === item);
      if (nextIdx < 0) return;

      // Check if the item we want to scroll to is already in view
      const pos = Math.floor(nextIdx * rowHeight);
      const EDGE = rowHeight / 2;
      const isBefore = scroll + EDGE > pos;
      const isAfter = scroll + height - EDGE < pos;
      if (isBefore || isAfter) {
        // Clamp to available range to avoid overflow
        const maxScroll = Math.floor(rowHeight * items.length - height);
        const nextPos = Math.max(
          0,
          Math.min(isBefore ? pos : pos - height + rowHeight * 2, maxScroll),
        );

        // Debounce scroll to avoid flickering when quickly hovering
        // a bunch of elements
        timeoutRef.current = setTimeout(() => {
          if (container.current) {
            container.current.scrollTop = nextPos;
          }
        }, 100);
      }
    },
    [rowHeight],
  );

  useEffect(() => {
    const scrollFn = (e: Event) => {
      const top = (e.target as Element).scrollTop;
      // Ignore overscroll
      if (top >= 0) {
        setScroll(top);
      }
    };

    if (container.current) {
      container.current.addEventListener('scroll', scrollFn);
    }

    return () => {
      if (container.current) {
        container.current.removeEventListener('scroll', scrollFn);
      }
    };
  }, [container.current]);

  useResize(
    () => {
      if (container.current) {
        setHeight(container.current.clientHeight);
      }
    },
    [],
    true,
  );

  const vnodes = useMemo(() => {
    const vnodes: VNode[] = [];
    while (idx < items.length && idx <= max) {
      vnodes.push(renderRow(items[idx], idx, top));
      top += rowHeight;
      idx++;
    }
    return vnodes;
  }, [items, idx, max, top]);

  return {
    containerHeight: rowHeight * items.length,
    children: vnodes,
    scrollToItem,
  };
}
