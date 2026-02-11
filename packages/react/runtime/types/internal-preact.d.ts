// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import 'preact';

declare module 'preact' {
  interface Options {
    /** _diff */
    __b?(vnode: VNode): void;
    /** _render */
    __r?(vnode: VNode): void;
    /** _commit */
    __c?(vnode: VNode, commitQueue: any[]): void;
    /** _catchError */
    __e(
      error: any,
      vnode: VNode<any>,
      oldVNode?: VNode<any>,
      errorInfo?: ErrorInfo,
    ): void;
    /** root */
    __?(vnode: VNode, parentDom: any): void;
  }

  export type HookState = Record<string, unknown>;

  // Hook tracking
  interface ComponentHooks {
    /** The list of hooks a component uses */
    __?: HookState[];
    /** List of Effects to be invoked after the next frame is rendered */
    _pendingEffects: EffectHookState[];
  }

  interface VNode {
    /** _component */
    __c?: Component | null;
    /** _original */
    __v?: number;
  }

  interface Component<P = {}, S = {}> {
    /** _vnode */
    __v?: VNode<P> | null;
    /** _renderCallbacks */
    __h: ((this: Component<P, S>) => void)[];
    /** _force */
    __e?: boolean;
    /** dirty */
    __d?: boolean;
    /** __hooks */
    __H?: ComponentHooks;
  }
}
