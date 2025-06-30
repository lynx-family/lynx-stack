import { AppCtx } from './react-bindings';
import { Signal } from '@preact/signals';
import { useContext } from 'preact/hooks';

export interface Collapser<T> {
  collapsed: Signal<Set<T>>;
  toggle: (item: T) => void;
  collapseNode: (item: T, shouldCollapse: boolean) => void;
}

/**
 * The Collapser deals with hiding sections in a tree view
 */
export function createCollapser<T>(collapsed: Signal<Set<T>>): Collapser<T> {
  const collapseNode = (id: T, shouldCollapse: boolean) => {
    const v = collapsed.value;
    shouldCollapse ? v.add(id) : v.delete(id);
    collapsed.value = new Set(v);
  };

  const toggle = (id: T) => collapseNode(id, !collapsed.value.has(id));

  return {
    collapsed,
    collapseNode,
    toggle,
  };
}

export function useCollapser() {
  const c = useContext(AppCtx).collapser;
  const collapsed = c.collapsed.value;
  return { collapsed, collapseNode: c.collapseNode, toggle: c.toggle };
}
