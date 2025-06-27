import { Options, VNode, ComponentConstructor, Component } from 'preact';
import { recordMark, endMark } from '../marks';
import {
  getDisplayName,
  setNextState,
  getNextState,
  getStatefulHooks,
  getStatefulHookValue,
  getComponent,
  isRoot,
  getActualChildren,
} from './bindings';
import {
  addDebugValue,
  addHookName,
  addHookStack,
  HookType,
} from '../shared/hooks';
import { createVNodeTimings } from '../shared/timings';
import { Renderer } from '../renderer';
import { RendererConfig } from '../shared/renderer';

export type OptionsV10 = Options;

/**
 * Inject tracking into setState
 */
function trackPrevState(Ctor: ComponentConstructor) {
  const setState = Ctor.prototype.setState;
  Ctor.prototype.setState = function(update: any, callback: any) {
    // Duplicated in setState() but doesn't matter due to the guard.
    const nextState = getNextState(this);
    const s = (nextState !== this.state && nextState)
      || setNextState(this, Object.assign({}, this.state));

    // Needed in order to check if state has changed after the tree has been committed:
    this._prevState = Object.assign({}, s);

    return setState.call(this, update, callback);
  };
}

export function setupOptionsV10(
  options: Options,
  renderer: Renderer,
  roots: Map<VNode, Node>,
  config: RendererConfig,
) {
  // Track component state. Only supported in Preact > 10.4.0
  if (config.Component) {
    trackPrevState(config.Component);
  }

  let timings = createVNodeTimings<VNode>();
  const owners = new Map<VNode, VNode>();
  let ownerStack: VNode[] = [];

  const o = options as any;

  // Store (possible) previous hooks so that we don't overwrite them
  const prevVNodeHook = options.vnode;
  const prevCommitRoot = o._commit || o.__c;
  const prevRoot = o._root || o.__;
  const prevBeforeUnmount = options.unmount;
  const prevBeforeDiff = o._diff || o.__b;
  const prevRender = o._render || o.__r;
  const prevAfterDiff = options.diffed;
  let prevHook = o._hook || o.__h;
  let prevUseDebugValue = options.useDebugValue;
  // @ts-ignore
  let prevHookName = options.useDebugName;

  const skipEffects = o._skipEffects || o.__s;

  // Make sure that we are always the first `option._hook` to be called.
  // This is necessary to ensure that our callstack remains consistent.
  // Otherwise we'll end up with an unknown number of frames in-between
  // the called hook and `options._hook`. This will lead to wrongly
  // parsed hooks.
  setTimeout(() => {
    prevHook = o._hook || o.__h;
    prevUseDebugValue = options.useDebugValue;
    // @ts-ignore
    prevHookName = options._addHookName || options.__a;

    o._hook = o.__h = (c: Component, index: number, type: number) => {
      if (type) {
        addHookStack(type);
      }

      // Don't continue the chain while the devtools is inspecting hooks.
      // Otherwise the next hook will very likely throw as we're only
      // faking a render and not doing a proper one. #278
      if (!(options as any)._skipEffects && !(options as any).__s) {
        if (prevHook) prevHook(c, index, type);
      }
    };

    options.useDebugValue = (value: any) => {
      addHookStack(HookType.useDebugValue);
      addDebugValue(value);
      if (prevUseDebugValue) prevUseDebugValue(value);
    };

    // @ts-ignore
    options._addHookName = options.__a = (name: string | number) => {
      addHookName(name);
      if (prevHookName) prevHookName(name);
    };
  }, 100);

  options.vnode = (vnode: VNode) => {
    if (
      ownerStack.length > 0
      && typeof vnode.type === 'function'
      && vnode.type !== config.Fragment
    ) {
      owners.set(vnode, ownerStack[ownerStack.length - 1]);
    }
    if (prevVNodeHook) prevVNodeHook(vnode);
  };

  o._diff = o.__b = (vnode: VNode) => {
    if (typeof vnode.type === 'function') {
      const name = getDisplayName(vnode, config);
      recordMark(`${name}_diff`);

      const c = getComponent(vnode);
      const s = getStatefulHooks(vnode);
      if (s !== null && c !== null) {
        if (!(c as any)._oldHookValues) {
          (c as any)._oldHookValues = new Array(s.length).fill(undefined);
        }

        for (let i = 0; i < s.length; i++) {
          const value = getStatefulHookValue(s[i]);
          (c as any)._oldHookValues[i] = value;
        }
      }
    }

    if (vnode.type !== null) {
      timings.start.set(vnode, preactDevtoolsCtx.performance.now());
    }

    if (prevBeforeDiff != null) prevBeforeDiff(vnode);
  };

  o._render = o.__r = (vnode: VNode, parent: VNode | null) => {
    if (
      !skipEffects
      && typeof vnode.type === 'function'
      && vnode.type !== config.Fragment
    ) {
      ownerStack.push(vnode);
    }
    if (prevRender != null) prevRender(vnode, parent);
  };

  options.diffed = vnode => {
    if (typeof vnode.type === 'function') {
      if (vnode.type !== config.Fragment) {
        ownerStack.pop();
      }

      endMark(getDisplayName(vnode, config));
    }

    if (vnode.type !== null) {
      timings.end.set(vnode, preactDevtoolsCtx.performance.now());
    }

    if (prevAfterDiff) prevAfterDiff(vnode);
  };

  const userRootToContainer = new Map<VNode, Node>();
  o._commit = o.__c = (vnode: VNode | null, queue: any[]) => {
    if (prevCommitRoot) prevCommitRoot(vnode, queue);

    // These cases are already handled by `unmount`
    if (vnode == null) return;
    if (isRoot(vnode, config)) {
      const children = getActualChildren(vnode);
      if (children.length > 0) {
        const dom = userRootToContainer.get(children[0] as any);
        if (dom) {
          roots.set(vnode, dom);
        }
      }
    }

    const tmpTimings = timings;
    ownerStack = [];
    timings = createVNodeTimings();
    renderer.onCommit(vnode, owners, tmpTimings, null);
  };

  o._root = o.__ = (vnode: VNode, parent: Node | null) => {
    if (parent === null) {
      userRootToContainer.delete(vnode);
    } else {
      // Some islands based frameworks use a virtual container node
      // instead of an actual DOM node.
      const treeParent =
        'Node' in globalThis && parent instanceof preactDevtoolsCtx.Node
          ? parent
          : (parent as any).parentNode;
      userRootToContainer.set(vnode, treeParent);
    }

    if (prevRoot) prevRoot(vnode, parent);
  };

  options.unmount = vnode => {
    if (prevBeforeUnmount) prevBeforeUnmount(vnode);
    if (vnode.type !== null) {
      timings.start.delete(vnode);
      timings.end.delete(vnode);
    }
    owners.delete(vnode);
    renderer.onUnmount(vnode as any);
  };

  // Teardown devtools options. Mainly used for testing
  return () => {
    options.unmount = prevBeforeUnmount;
    o._commit = o.__c = prevCommitRoot;
    options.diffed = prevAfterDiff;
    o._diff = o.__b = prevBeforeDiff;
    options.vnode = prevVNodeHook;
    o._hook = o.__h = prevHook;
    options.useDebugValue = prevUseDebugValue;
  };
}
