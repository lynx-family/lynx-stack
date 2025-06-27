import type { RendererConfig } from './renderer';
import type { ObjPath } from '../renderer';
import type { PreactBindings, SharedVNode } from './bindings';
import type { Signal } from '@preact/signals';

export interface SerializedVNode {
  type: 'vnode';
  name: string;
}

export function serializeVNode<T extends SharedVNode>(
  x: any,
  config: RendererConfig,
  bindings: PreactBindings<T>,
): SerializedVNode | null {
  if (bindings.isVNode(x)) {
    return {
      type: 'vnode',
      name: bindings.getPropsVNodeDisplayName(x, config),
    };
  }

  return null;
}

export function isSignal(x: any): x is Signal {
  return (
    x !== null
    && typeof x === 'object'
    && typeof x.peek === 'function'
    && 'value' in x
  );
}

export function isReadOnlySignal(signal: Signal): boolean {
  return (
    // Signals <1.2.0
    (signal as any)._r === true
    // Signals >=1.2.0
    || ('g' in signal && typeof (signal as any).x === 'function')
  );
}

function sortStrings(a: string, b: string) {
  return a.localeCompare(b);
}

export function jsonify(
  data: any,
  getVNode: (x: any) => SerializedVNode | null,
  seen: Set<any>,
): any {
  // Break out of circular references
  if (seen.has(data)) {
    return '[[Circular]]';
  }

  if (data !== null && typeof data === 'object') {
    seen.add(data);
  }

  if (typeof Element !== 'undefined' && data instanceof Element) {
    return {
      type: 'html',
      name: `<${data.localName} />`,
    };
  }

  const vnode = getVNode(data);
  if (vnode != null) return vnode;

  if (isSignal(data)) {
    return {
      type: 'signal',
      name: isReadOnlySignal(data) ? 'computed Signal' : 'Signal',
      value: jsonify(data.peek(), getVNode, seen),
    };
  }

  if (Array.isArray(data)) {
    return data.map(x => jsonify(x, getVNode, seen));
  }
  switch (typeof data) {
    case 'string':
      return data.length > 300 ? data.slice(300) : data;
    case 'bigint':
      return {
        type: 'bigint',
        value: data.toString(10),
      };
    case 'function': {
      return {
        type: 'function',
        name: data.displayName || data.name || 'anonymous',
      };
    }
    case 'symbol': {
      return {
        type: 'symbol',
        name: data.toString(),
      };
    }
    case 'object': {
      if (data === null) return null;
      else if (data instanceof preactDevtoolsCtx.Blob) {
        return {
          type: 'blob',
          name: 'Blob',
        };
      } else if (data instanceof Set) {
        return {
          type: 'set',
          name: 'Set',
          entries: Array.from(data.values()).map(item =>
            jsonify(item, getVNode, seen)
          ),
        };
      } else if (data instanceof Map) {
        return {
          type: 'map',
          name: 'Map',
          entries: Array.from(data.entries()).map(entry => {
            return [
              jsonify(entry[0], getVNode, seen),
              jsonify(entry[1], getVNode, seen),
            ];
          }),
        };
      }
      const out = {};
      Object.keys(data)
        .sort(sortStrings)
        .forEach(key => {
          (out as any)[key] = jsonify((data as any)[key], getVNode, seen);
        });
      return out;
    }
    default:
      return data;
  }
}

export function isEditable(x: any) {
  switch (typeof x) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'bigint':
      return true;
    default:
      return false;
  }
}

function clone(value: any) {
  if (Array.isArray(value)) return value.slice();
  if (value !== null && typeof value === 'object') {
    if (value instanceof Set) return new Set(value);
    if (value instanceof Map) return new Map(value);
    return { ...value };
  }
  return value;
}

/**
 * Deeply set a property and clone all parent objects/arrays
 */
export function setInCopy<T extends Record<string, unknown> = any>(
  obj: T,
  path: ObjPath,
  value: any,
  idx = 0,
): T {
  if (idx >= path.length) return value;

  // Signals bypass everything
  if (
    path[path.length - 1] === 'value'
    && maybeSetSignal(obj as any, path, value)
  ) {
    return obj;
  }

  const updated = clone(obj);
  if (obj instanceof Set) {
    const oldValue = Array.from(obj)[+path[idx]];
    updated.delete(oldValue);
    updated.add(setInCopy(oldValue, path, value, idx + 1));
  } else if (obj instanceof Map) {
    const oldEntry = Array.from(obj)[+path[idx]];
    const isKey = +path[idx + 1] === 0;
    if (isKey) {
      updated.delete(oldEntry[0]);
      updated.set(setInCopy(oldEntry[0], path, value, idx + 2), oldEntry[1]);
    } else {
      updated.delete(oldEntry[0]);
      updated.set(oldEntry[0], setInCopy(oldEntry[1], path, value, idx + 2));
    }
  } else {
    const key = path[idx];
    (updated as any)[key] = setInCopy((obj as any)[key], path, value, idx + 1);
  }
  return updated as any;
}

export function serialize<T extends SharedVNode>(
  config: RendererConfig,
  bindings: PreactBindings<T>,
  data: unknown | null,
) {
  return jsonify(
    data,
    node => serializeVNode(node, config, bindings),
    new Set(),
  );
}

/**
 * Deeply mutate a property by walking down an array of property keys
 */
export function setIn(obj: Record<string, any>, path: ObjPath, value: any) {
  const last = path.pop();
  const parent = path.reduce((acc, attr) => (acc ? acc[attr] : null), obj);
  if (parent && last) {
    parent[last] = value;
  }
}

export function maybeSetSignal(
  obj: Record<string, any>,
  path: ObjPath,
  value: any,
) {
  let current: any = obj;
  for (let i = 0; i < path.length; i++) {
    if (isSignal(current)) {
      current.value = value;
      return true;
    }

    current = current[path[i]];
  }

  return false;
}

export function hasIn(obj: Record<string, any>, path: ObjPath) {
  let item = obj;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (item && key in item) {
      const next = item[key];
      if (next !== null && typeof next === 'object') {
        item = next;
      }
    } else {
      return false;
    }
  }

  return true;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function cleanProps<T extends object>(
  props: T,
): Exclude<T, '__source' | '__self'> | null {
  if (typeof props === 'string' || !props) return null;
  const out: any = {};
  for (const key in props) {
    if (key === '__source' || key === '__self') continue;
    out[key] = props[key];
  }
  if (!Object.keys(out).length) return null;
  return out;
}

const reg = /__cC\d+/;
export function cleanContext(context: Record<string, any>) {
  const res: Record<string, any> = {};
  for (const key in context) {
    if (reg.test(key)) continue;
    res[key] = context[key];
  }

  if (Object.keys(res).length == 0) return null;
  return res;
}
