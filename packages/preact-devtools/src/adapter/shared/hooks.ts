import { parseStackTrace } from 'errorstacks';
import { h } from 'preact';
import {
  parseProps,
  PropData,
  PropDataType,
} from '../../view/components/sidebar/inspect/parseProps';
import { RendererConfig } from './renderer';
import { isEditable, serialize } from './serialize';
import { HookState, PreactBindings, SharedVNode } from './bindings';
import { OptionsV11 } from '../11/options';
import { OptionsV10 } from '../10/options';
import { flattenChildren } from '../../view/components/tree/windowing';

export enum HookType {
  useState = 1,
  useReducer = 2,
  useEffect = 3,
  useLayoutEffect = 4,
  useRef = 5,
  useImperativeHandle = 6,
  useMemo = 7,
  useCallback = 8,
  useContext = 9,
  useErrorBoundary = 10,
  useDebugValue = 11,
  custom = 99,
  devtoolsParent = 9999,
}

export interface HookLocation {
  name: string;
  location: string;
}

export interface HookData {
  type: HookType;
  stack: HookLocation[];
}

export interface HookItem {
  name: string;
  type: HookType;
  index: number;
  value: any;
  children: HookItem[];
}

let hookLog: HookData[] = [];
let inspectingHooks = false;
let ancestorName = 'unknown';
const debugValues = new Map<string, unknown>();
let debugNames: string[] = [];

export function addHookName(name: any) {
  if (!inspectingHooks) return;
  debugNames.push(String(name));
}

export function addDebugValue(value: any) {
  if (!inspectingHooks) return;

  const last = hookLog.pop()!;
  const location = last.stack
    .reverse()
    .slice(0, -1)
    .map(x => (x.name === 'root' ? x.name : `${x.location}.${x.name}`))
    .join('.');

  debugValues.set(location, value);
}

let ignoreNext = false;
export function addHookStack(type: HookType) {
  if (!inspectingHooks || ignoreNext) {
    ignoreNext = false;
    return;
  }

  // Ignore next useState call coming from useErrorBoundary
  if (type === HookType.useErrorBoundary) {
    ignoreNext = true;
  }

  // By default browser limit stack trace length to 10 entries
  const oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 1000;

  const err = new Error();
  let stack = err.stack ? parseStackTrace(err.stack) : [];
  const ancestorIdx = stack.findIndex(x => x.name === ancestorName);

  if (ancestorIdx > -1 && stack.length > 0) {
    // Remove `addHookStack` + `options._hook` + `getHookState` from stack
    let trim = type === HookType.useDebugValue ? 2 : 3;
    // These hooks are implemented with other hooks
    if (
      type === HookType.useState
      || type === HookType.useImperativeHandle
      || type === HookType.useCallback
      || type === HookType.useRef
    ) {
      trim += 1;
    }
    // Lynx has one more `call at call (native)` stack, we need `- 1` here
    stack = stack.slice(trim, ancestorIdx - 1);
  }

  const normalized: HookLocation[] = [];

  // To easy mappings we'll rotate all positional data.
  for (let i = 0; i < stack.length; i++) {
    if (i === stack.length - 1) {
      normalized.push({ name: 'root', location: 'root' });
      continue;
    }
    const frame = stack[i];
    const next = stack[i + 1];
    normalized.push({
      name: frame.name,
      // file://view2/.rspeedy/main/background.ed172d51.js -> /.rspeedy/main/background.ed172d51.js
      location: `${
        next.fileName.replace(/^file:\/\/[^/]*/, '')
      }:${next.line}:${next.column}`,
    });
  }

  hookLog.push({ type, stack: normalized });

  // Restore original stack trace limit
  Error.stackTraceLimit = oldLimit;
}

export function parseHookData<T extends SharedVNode>(
  config: RendererConfig,
  data: HookData[],
  vnode: T,
  userHookNames: string[],
  bindings: PreactBindings<T>,
): PropData[] {
  const tree = new Map<string, PropData>();
  const root: PropData = {
    children: [],
    depth: 0,
    name: 'root',
    editable: false,
    id: 'root',
    type: 'object',
    value: null,
    meta: null,
  };
  tree.set('root', root);
  const out: PropData[] = [root];

  data.forEach((hook, hookIdx) => {
    const type = HookType[hook.type];
    let parentId = 'root';

    for (let i = hook.stack.length - 2; i >= 0; i--) {
      const frame = hook.stack[i];
      const isNative = i === 0;

      const id = `${parentId}.${frame.location}.${frame.name}`;

      if (!tree.has(id)) {
        let value: any = '__preact_empty__';
        let editable = false;
        let children: string[] = [];
        let nodeType: PropDataType = 'undefined';
        const depth = hook.stack.length - i - 1;
        let name = isNative ? type : frame.name;
        if (
          isNative
          && userHookNames.length > 0
          && (hook.type === HookType.useState
            || hook.type === HookType.useRef
            || hook.type === HookType.useMemo
            || hook.type === HookType.useReducer)
        ) {
          name = `${name} ${userHookNames.pop()!}`;
        }

        if (debugValues.has(id)) {
          value = serialize(config, bindings, debugValues.get(id));
        }

        const hookValueTree: PropData[] = [];

        if (isNative) {
          const s = bindings.getHookState(vnode, hookIdx, hook.type);
          const rawValue = Array.isArray(s) ? s[0] : s;
          value = serialize(config, bindings, rawValue);

          // The user should be able to click through the value
          // properties if the value is an object. We parse it
          // separately and append it as children to our hook node
          if (
            typeof rawValue === 'object'
            && !(rawValue instanceof preactDevtoolsCtx.Node)
          ) {
            const valueTree = parseProps(value, id, 8, 1, name);
            children = valueTree.get(id)!.children;

            const flat = flattenChildren(valueTree, id, () => false).slice(1);

            for (let j = 0; j < flat.length; j++) {
              const data = valueTree.get(flat[j])!;
              hookValueTree.push(data);
            }

            if (hookValueTree.length > 1) {
              nodeType = hookValueTree[0].type;
            }
          }
          editable = (hook.type === HookType.useState
            || hook.type === HookType.useReducer)
            && isEditable(rawValue);
        }

        const item: PropData = {
          children,
          depth,
          editable,
          id,
          name,
          type: nodeType,
          meta: isNative
            ? {
              index: hookIdx,
              type,
            }
            : frame.name,
          value,
          index: hookIdx,
        };
        tree.set(id, item);
        out.push(item);

        if (tree.has(parentId)) {
          tree.get(parentId)!.children.push(id);
        }

        if (hookValueTree.length) {
          hookValueTree.forEach(v => {
            tree.set(v.id, v);
            out.push(v);
          });
        }
      }

      parentId = id;
    }
  });

  return out;
}

export function inspectHooks<T extends SharedVNode>(
  config: RendererConfig,
  options: OptionsV10 | OptionsV11,
  vnode: T,
  helpers: PreactBindings<T>,
) {
  inspectingHooks = true;
  hookLog = [];
  debugValues.clear();
  debugNames = [];
  ancestorName = parseStackTrace(new Error().stack!)[0].name;

  const c = helpers.getComponent(vnode)!;
  const isClass = (vnode.type as any).prototype
    && (vnode.type as any).prototype.render;

  // Disable hook effects
  (options as any)._skipEffects = (options as any).__s = true;

  const prevConsole: Record<string, any> = {};

  // Temporarily disable all console methods to not confuse users
  // It sucks that we need to do this :/
  for (const method in console) {
    try {
      prevConsole[method] = (console as any)[method];
      (console as any)[method] = () => undefined;
    } catch (error) {
      // Ignore errors here
    }
  }

  let pendingValues: unknown[] | null = null;
  let statefulHooks: HookState[] | null = null;
  try {
    // Call render on a dummy component, so that any possible
    // state changes or effect are not written to our original
    // component.
    const hooks = helpers.getComponentHooks(vnode);
    if (hooks === null) return [];

    statefulHooks = helpers.getStatefulHooks(vnode);
    if (statefulHooks !== null) {
      pendingValues = statefulHooks.map(s => helpers.getPendingHookValue(s));
    }

    const dummy = {
      props: c.props,
      context: c.context,
      state: {},
      __hooks: hooks,
      __H: hooks,
      __v: null as any,
    };

    // Force preact to reset internal hooks index
    const renderHook = (options as any).__r || (options as any)._render;
    if (renderHook) {
      const dummyVNode = h('div', null);
      // Note: A "div" normally won't have the _component property set,
      // but we can get away with that for the devtools
      // This is only needed for Preact 10.x
      (dummyVNode as any)._component = dummy;
      (dummyVNode as any).__c = dummy;
      dummy.__v = dummyVNode;
      // Preact V11 for hook names
      (dummyVNode as any).data = {
        __hooks: hooks,
        __H: hooks,
      };
      renderHook(dummyVNode, null);
    }

    if (isClass) {
      c.render.call(dummy, dummy.props, dummy.state);
    } else {
      // Preact V11 doesn't create classes anymore
      if (c.constructor === Object) {
        vnode.type.call(dummy, dummy.props, dummy.context);
      } else {
        c.constructor.call(dummy, dummy.props, dummy.context);
      }
    }

    // Signals need this, otherwise they end up in an incosnistent state
    const diffedHook = options.diffed;
    if (diffedHook) diffedHook(vnode as any);
  } catch (error) {
    // We don't care about any errors here. We only need
    // the hook call sites
  } finally {
    // Restore hook state
    if (pendingValues !== null && statefulHooks !== null) {
      pendingValues.forEach((original, i) => {
        if (original !== undefined) {
          helpers.setPendingHookValue(statefulHooks![i], original);
        }
      });
    }

    // Restore original console
    for (const method in prevConsole) {
      try {
        (console as any)[method] = prevConsole[method];
      } catch (error) {
        // Ignore errors
      }
    }
    (options as any)._skipEffects = (options as any).__s = false;
  }

  const parsed = hookLog.length
    ? parseHookData(config, hookLog, vnode, [...debugNames].reverse(), helpers)
    : null;

  debugNames = [];

  inspectingHooks = false;
  ancestorName = 'unknown';
  hookLog = [];

  return parsed;
}
