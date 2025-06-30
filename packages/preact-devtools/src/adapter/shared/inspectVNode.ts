import { RendererConfig, getDevtoolsType } from './renderer';
import { Options } from 'preact';
import { inspectHooks } from './hooks';
import { getVNodeById, IdMappingState } from './idMapper';
import { cleanContext, cleanProps, serialize } from './serialize';
import { PreactBindings, SharedVNode } from './bindings';
import { InspectData } from '../adapter/adapter';
import { ID } from '../../view/store/types';
import { getSignalTextName } from './utils';

/**
 * Serialize all properties/attributes of a `VNode` like `props`, `context`,
 * `hooks`, and other data. This data will be requested when the user selects a
 * `VNode` in the devtools. It returning information will be displayed in the
 * sidebar.
 */
export function inspectVNode<T extends SharedVNode>(
  ids: IdMappingState<T>,
  config: RendererConfig,
  bindings: PreactBindings<T>,
  options: Options,
  id: ID,
  supportsHooks: boolean,
  version: string,
): InspectData | null {
  const vnode = getVNodeById(ids, id);
  if (!vnode) return null;

  const c = bindings.getComponent(vnode);
  const hasState = bindings.isComponent(vnode)
    && c != null
    && typeof c.state === 'object'
    && c.state != null
    && Object.keys(c.state).length > 0;

  const isSignalTextNode = typeof vnode.type === 'function'
    && vnode.type.displayName === '_st';

  const hasHooks = c != null && !isSignalTextNode
    && bindings.getComponentHooks(vnode) != null;
  const hooks = supportsHooks && hasHooks
    ? inspectHooks(config, options, vnode, bindings)
    : null;
  const context = c != null
    ? serialize(config, bindings, cleanContext(c.context))
    : null;
  const props = vnode.type !== null
    ? serialize(config, bindings, cleanProps(vnode.props))
    : null;
  const state = hasState ? serialize(config, bindings, c!.state) : null;
  const signals = c != null && '__$u' in c
    ? inspectSignalSubscriptions(config, bindings, c.__$u.s)
    : null;

  let suspended = false;
  let canSuspend = false;
  let item: T | null = vnode;
  while (item) {
    if (bindings.isSuspenseVNode(item)) {
      canSuspend = true;

      const res = bindings.getSuspendedState(item);
      if (res !== null) {
        suspended = res;
      }
      break;
    }

    item = bindings.getVNodeParent(item);
  }

  return {
    context,
    canSuspend,
    key: vnode.key || null,
    hooks: supportsHooks ? hooks : !supportsHooks && hasHooks ? [] : null,
    id,
    name: getSignalTextName(bindings.getDisplayName(vnode, config)),
    props,
    state,
    signals,
    // TODO: We're not using this information anywhere yet
    type: getDevtoolsType(vnode, bindings),
    suspended,
    version,
    // @ts-ignore
    __source: vnode.__source || null,
  };
}

function inspectSignalSubscriptions<T extends SharedVNode>(
  config: RendererConfig,
  bindings: PreactBindings<T>,
  node: any,
) {
  const out: Record<string, any> = {};
  let i = 0;

  const seen = new Set();
  while (node !== null && node !== undefined && !seen.has(node)) {
    seen.add(node);
    out[i] = serialize(config, bindings, node.S);
    node = node.n;
    i++;
  }

  return i > 0 ? out : null;
}
