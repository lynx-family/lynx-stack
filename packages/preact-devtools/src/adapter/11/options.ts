import { recordMark, endMark } from '../marks';
import {
  getDisplayName,
  setNextState,
  getNextState,
  getComponent,
  Internal,
  getStatefulHooks,
  getStatefulHookValue,
  TYPE_COMPONENT,
  isRoot,
  getVNodeId,
} from './bindings';
import { RendererConfig } from '../shared/renderer';
import { Renderer } from '../renderer';
import {
  addDebugValue,
  addHookName,
  addHookStack,
  HookType,
} from '../shared/hooks';
import { createVNodeTimings } from '../shared/timings';
import { ProfilerState } from '../adapter/profiler';
import {
  createReason,
  RenderReason,
  RenderReasonData,
} from '../shared/renderReasons';
import { ComponentType } from 'preact';
import { getRenderReasonPre, RenderReasonTmpData } from './renderReason';

export interface VNodeV11<P = Record<string, unknown>> {
  type: ComponentType<P> | string | null;
  props: P;
  _vnodeId?: number;
  __v?: number;
}

export interface OptionsV11 {
  unmount?(internal: Internal): void;
  diffed?(internal: Internal): void;
  _root?(
    vnode: any,
    parent: Element | Document | ShadowRoot | DocumentFragment,
  ): void;
  __?(
    vnode: any,
    parent: Element | Document | ShadowRoot | DocumentFragment,
  ): void;

  _diff?(internal: Internal, vnode?: VNodeV11): void;
  __b?(internal: Internal, vnode?: VNodeV11): void;

  _commit?(internal: Internal | null, commitQueue: any): void;
  __c?(internal: Internal | null, commitQueue: any): void;

  _render?(internal: Internal): void;
  __r?(internal: Internal): void;

  _hook?(component: any, index: number, type: HookType): void;
  __h?(component: any, index: number, type: HookType): void;

  _skipEffects?: boolean;
  __s?: boolean;

  _catchError?(error: any, internal: Internal): void;
  __e?(error: any, internal: Internal): void;

  vnode(vnode: VNodeV11): void;
  _internal?(internal: Internal, vnode: VNodeV11 | string): void;
  __i?(internal: Internal, vnode: VNodeV11 | string): void;

  useDebugValue?(value: string | number): void;
}

/**
 * Inject tracking into setState
 */
function trackPrevState(Ctor: any) {
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

function getParentDom(internal: Internal): Node | null {
  return internal.props?._parentDom || internal.props?.__P || null;
}

export function setupOptionsV11(
  options: OptionsV11,
  renderer: Renderer,
  roots: Map<any, Node>,
  config: RendererConfig,
  profiler: ProfilerState,
) {
  // Track component state. Only supported in Preact > 10.4.0
  if (config.Component) {
    trackPrevState(config.Component);
  }

  const timings = createVNodeTimings<Internal>();
  let renderReasons = new Map<Internal, RenderReasonData>();
  let reasonTmpData = new Map<Internal, RenderReasonTmpData>();
  const vnodeIdToOwner = new Map<number, Internal>();
  const owners = new Map<Internal, Internal>();
  let ownerStack: Internal[] = [];

  const o = options;

  // Store (possible) previous hooks so that we don't overwrite them
  const prevVNodeHook = options.vnode;
  const prevInternalHook = options._internal || o.__i;
  const prevCommitRoot = o._commit || o.__c;
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

    o._hook = o.__h = (internal: Internal, index: number, type: number) => {
      if (type) {
        addHookStack(type);
      }

      // Don't continue the chain while the devtools is inspecting hooks.
      // Otherwise the next hook will very likely throw as we're only
      // faking a render and not doing a proper one. #278
      if (!(options as any)._skipEffects && !(options as any).__s) {
        if (prevHook) prevHook(internal, index, type);
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

  options.vnode = vnode => {
    if (
      ownerStack.length > 0
      && typeof vnode.type === 'function'
      && vnode.type !== config.Fragment
    ) {
      vnodeIdToOwner.set(getVNodeId(vnode), ownerStack[ownerStack.length - 1]);
    }
    if (prevVNodeHook) prevVNodeHook(vnode);
  };

  options._internal = options.__i = (internal, vnode) => {
    const owner = vnodeIdToOwner.get(getVNodeId(internal));
    if (owner) {
      owners.set(internal, owner);
    }
    if (prevInternalHook) prevInternalHook(internal, vnode);
  };

  o._diff = o.__b = (internal, vnode) => {
    if (internal.flags & TYPE_COMPONENT) {
      timings.start.set(internal, performance.now());
      const name = getDisplayName(internal, config);
      recordMark(`${name}_diff`);

      if (vnode != null) {
        const internalId = getVNodeId(internal);
        const vnodeId = getVNodeId(vnode);
        if (internalId !== vnodeId) {
          const owner = vnodeIdToOwner.get(internalId);
          if (owner) {
            vnodeIdToOwner.set(vnodeId, owner);
          }
          vnodeIdToOwner.delete(internalId);
        }
      }

      if (profiler.captureRenderReasons) {
        if (internal === null) {
          if (vnode != null) {
            renderReasons.set(internal, createReason(RenderReason.MOUNT, null));
          }
        } else if (vnode != null) {
          reasonTmpData.set(internal, {
            type: vnode.type,
            props: internal.props,
          });
        }
      }
    }

    if (prevBeforeDiff != null) prevBeforeDiff(internal);
  };

  o._render = o.__r = (internal: Internal) => {
    if (
      !skipEffects
      && internal.flags & TYPE_COMPONENT
      && internal.type !== config.Fragment
    ) {
      ownerStack.push(internal);
    }
    if (prevRender != null) prevRender(internal);
  };

  options.diffed = internal => {
    if (internal.flags & TYPE_COMPONENT) {
      if (internal.type !== config.Fragment) {
        ownerStack.pop();
      }

      timings.end.set(internal, performance.now());
      endMark(getDisplayName(internal, config));

      if (profiler.captureRenderReasons) {
        const old = reasonTmpData.get(internal);
        if (old != null) {
          const reason = getRenderReasonPre(timings, internal, old);
          if (reason !== null) {
            renderReasons.set(internal, reason);
          }
        }

        const s = getStatefulHooks(internal);
        if (s && Array.isArray(s) && s.length > 0) {
          const internal = s[0]._internal || s[0].__i;
          if (internal !== undefined && getComponent(internal)) {
            s[0]._oldValue = getStatefulHookValue(s[0]);
          }
        }
      }
    }

    if (prevAfterDiff) prevAfterDiff(internal);
  };

  o._commit = o.__c = (internal: Internal | null, queue: any[]) => {
    if (prevCommitRoot) prevCommitRoot(internal, queue);

    // These cases are already handled by `unmount`
    if (internal == null) return;
    if (isRoot(internal, config)) {
      const dom = getParentDom(internal);
      if (dom) {
        roots.set(internal, dom);
      }
    }

    ownerStack = [];
    renderer.onCommit(internal, owners, timings, renderReasons);

    if (profiler.captureRenderReasons) {
      renderReasons = new Map();
      reasonTmpData = new Map();
    }
  };

  options.unmount = internal => {
    if (prevBeforeUnmount) prevBeforeUnmount(internal);
    vnodeIdToOwner.delete(getVNodeId(internal));
    owners.delete(internal);
    timings.start.delete(internal);
    timings.end.delete(internal);
    renderer.onUnmount(internal);
  };

  // Teardown devtools options. Mainly used for testing
  return () => {
    options.unmount = prevBeforeUnmount;
    o._commit = o.__c = prevCommitRoot;
    o._diff = o.__b = prevBeforeDiff;
    o._render = o.__r = prevRender;
    options.diffed = prevAfterDiff;
    options._internal = prevVNodeHook;
    o._hook = o.__h = prevHook;
    o.vnode = prevVNodeHook;
    o._internal = o.__i = prevInternalHook;
    options.useDebugValue = prevUseDebugValue;
  };
}
