import { Signal, signal } from '@preact/signals';
import { useStore } from './react-bindings';
import { escapeStringRegexp } from './utils';
import { ID, DevNode } from './types';

export function createRegex(s: string): RegExp {
  if (s[0] === '/') {
    s = s.slice(1);
    if (s[s.length - 1] === '/') {
      s = s.slice(0, -1);
    }
    try {
      return new RegExp(s, 'i');
    } catch (err) {
      return new RegExp('');
    }
  }
  return new RegExp(`(${escapeStringRegexp(s)})`, 'i');
}

export function createSearchStore(
  items: Signal<Map<ID, DevNode>>,
  list: Signal<ID[]>,
) {
  const searchValue = signal('');
  const selected = signal(0);
  const selectedIdx = signal(-1);
  const regex = signal<RegExp | null>(null);
  const match = signal<number[]>([]);
  const count = signal(0);

  const onChange = (s: string) => {
    searchValue.value = s;

    match.value = [];

    if (s === '') {
      regex.value = null;
      count.value = 0;
      selected.value = 0;
      return;
    }

    const reg = createRegex(s);
    regex.value = reg;

    const ids: number[] = [];
    list.value.forEach(id => {
      const node = items.value.get(id);
      if (
        node
        && (reg.test(node.name)
          || (node.hocs && node.hocs.some(h => reg.test(h))))
      ) {
        ids.push(id);
      }
    });

    if (ids.length > 0) {
      selected.value = 0;
    }
    count.value = ids.length;
    match.value = ids;
  };

  const reset = () => {
    selectedIdx.value = -1;
    onChange('');
  };

  function go(n: number) {
    if (n < 0) n = match.value.length - 1;
    else if (n > match.value.length - 1) n = 0;
    selected.value = n;
    selectedIdx.value = list.value.findIndex(id => match.value[n] === id);
  }

  const selectNext = () => go(selected.value + 1);
  const selectPrev = () => go(selected.value - 1);

  return {
    selected,
    selectedIdx,
    regex,
    count,
    searchValue,
    match,
    reset,
    onChange,
    selectNext,
    selectPrev,
  };
}

export function useSearch() {
  const { search: s } = useStore();
  const match = s.match.value;
  const value = s.searchValue.value;
  const marked = s.selected.value;
  const regex = s.regex.value;
  const count = s.count.value;
  const selected = s.selected.value;
  const selectedId = s.match.value[s.selected.value];
  return {
    count,
    selected,
    selectedId,
    marked,
    regex,
    match,
    goNext: s.selectNext,
    goPrev: s.selectPrev,
    value,
  };
}
