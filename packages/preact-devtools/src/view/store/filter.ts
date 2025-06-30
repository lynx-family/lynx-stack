import { signal } from '@preact/signals';
import { escapeStringRegexp } from './utils';
import { RawFilterState } from '../../adapter/adapter/filter';

export interface RawFilter {
  value: string;
  enabled: boolean;
}

export function createFilterStore(
  onSubmit: (event: 'update-filter', filters: RawFilterState) => void,
) {
  const defaults = {
    fragment: true,
    dom: true,
    hoc: true,
    root: true,
    textSignal: true,
    regex: [] as RawFilter[],
  };

  const filters = signal<RawFilter[]>(defaults.regex);
  const filterFragment = signal(defaults.fragment);
  const filterDom = signal(defaults.dom);
  const filterHoc = signal(defaults.hoc);
  const filterRoot = signal(defaults.root);
  const filterTextSignal = signal(defaults.textSignal);

  const submit = () => {
    const s: RawFilterState = {
      regex: [],
      type: {
        fragment: filterFragment.value,
        dom: filterDom.value,
        hoc: filterHoc.value,
        root: filterRoot.value,
        textSignal: filterTextSignal.value,
      },
    };

    filters.value.forEach(x => {
      s.regex.push({ value: escapeStringRegexp(x.value), enabled: x.enabled });
    });
    onSubmit('update-filter', s);
  };

  const restore = (state: RawFilterState) => {
    try {
      filterFragment.value = !!state.type.fragment;
      filterDom.value = !!state.type.dom;
      filterHoc.value = !!state.type.hoc;
      filterRoot.value = !!state.type.root;
      filterTextSignal.value = 'textSignal' in state.type
        ? !!state.type.textSignal
        : true;
      filters.value = state.regex;

      // Refetch component tree if filters are not the default ones
      if (
        defaults.fragment !== filterFragment.value
        || defaults.dom !== filterDom.value
        || defaults.hoc !== filterHoc.value
        || defaults.root !== filterRoot.value
        || defaults.textSignal !== filterTextSignal.value
        || filters.value.some(f => f.enabled)
      ) {
        submit();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  };

  return {
    filters,
    filterFragment,
    filterDom,
    filterHoc,
    filterRoot,
    filterTextSignal,
    submit,
    restore,
  };
}
