import { Component } from 'preact';
import { RendererConfig } from './renderer';
import { HookType } from './hooks';
import { RenderReasonData } from './renderReasons';
import { IdMappingState } from './idMapper';
import { VNodeTimings } from './timings';

// These hook types are declared in "preact/hooks/src/internal" but not very
// complete, so for now loosely declare locally.
export type ComponentHooks = Record<string, any>;
export type HookState = Record<string, any>;

export interface PreactBindings<T extends SharedVNode = SharedVNode> {
  getDisplayName(vnode: T, config: RendererConfig): string;
  getPropsVNodeDisplayName(vnode: any, config: RendererConfig): string;
  isRoot(vnode: T, config: RendererConfig): boolean;
  getActualChildren(vnode: T): Array<T | null | undefined>;
  getVNodeParent(vnode: T): T | null;
  isTextVNode(vnode: T): boolean;
  getHookState(vnode: T, index: number, type?: HookType): unknown;
  getComponent(vnode: T): any | null; // FIXME
  getComponentHooks(vnode: T): ComponentHooks | null; // FIXME
  getDom(vnode: T): HTMLElement | Text | null;
  isElement(vnode: T): boolean;
  isComponent(vnode: T): boolean;
  getInstance(vnode: T): any;
  isSuspenseVNode(vnode: T): boolean;
  isPortal(vnode: T): boolean;
  /**
   * Null means that the component is not a true suspense node.
   * We do this because a few experiments mess with suspense
   * internals
   */
  getSuspendedState(vnode: T): boolean | null;
  createSuspenseState(vnode: T, suspended: boolean): unknown;
  setNextState<S>(component: Component, value: S): unknown;
  isVNode(value: any): value is T;

  // Hooks inspection
  getStatefulHooks(vnode: T): HookState[] | null;
  isUseReducerOrState(state: HookState): boolean;
  getStatefulHookValue(state: HookState): unknown;
  setPendingHookValue(state: HookState, value: unknown): void;
  getPendingHookValue(state: HookState): unknown;

  // Profiler related
  getRenderReasonPost(
    ids: IdMappingState<T>,
    bindings: PreactBindings<T>,
    timings: VNodeTimings<T>,
    old: T | null,
    next: T | null,
  ): RenderReasonData | null;
}

/**
 * Type that abstracts common vnode/internal properties
 * across major Preact versions. Only use this as a
 * generic default value.
 */
export interface SharedVNode {
  type: any;
  key: any;
  props: any;
}
