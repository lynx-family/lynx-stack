// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NodesRef, SelectorQuery, uiMethodOptions } from '@lynx-js/types';

import { getPageLynx } from './page-lynx.js';

const NODE_NOT_FOUND_CODE = 2;
const NO_UI_FOR_NODE_CODE = 6;

export type RefCleanup = (() => void) | void;
export type RefCallback<T> = (ref: T | null) => RefCleanup;
export interface OrdinaryRefBinding {
  cleanup?: RefCleanup;
}
export interface RefObject<T> {
  current: T | null;
}
export type OrdinaryRef<T> = RefCallback<T> | RefObject<T>;

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? K : never;
}[keyof T];

export type ForwardableNodesRefMethod = Exclude<FunctionPropertyNames<NodesRef>, 'exec'>;
export type RefProxyForwardedMethods<TProxy> = {
  [K in ForwardableNodesRefMethod]: (...args: Parameters<NodesRef[K]>) => TProxy;
};

type RefTask = (nodesRef: NodesRef, execStack?: string, selector?: string) => SelectorQuery;

function enrichRefError<T>(
  res: T,
  method: string,
  template: string | undefined,
  execStack: string | undefined,
): T {
  const record = res as { code?: unknown; data?: unknown } | null | undefined;
  if (
    !record
    || (record.code !== NODE_NOT_FOUND_CODE && record.code !== NO_UI_FOR_NODE_CODE)
    || typeof record.data !== 'string'
  ) {
    return res;
  }

  return Object.assign({}, res, {
    data: `${record.data} [ReactLynx ref: invoke(${method})${template ? `, ${template}` : ''}]${
      __DEV__ && execStack ? `\n${execStack}` : ''
    }`,
  });
}

export function assertValidRef<T>(value: unknown): OrdinaryRef<T> {
  if (
    typeof value === 'function'
    || (typeof value === 'object' && value !== null && 'current' in value)
  ) {
    return value as OrdinaryRef<T>;
  }
  throw new Error(
    `Elements' "ref" property should be a function, or an object created `
      + `by createRef(), but got [${typeof value}] instead`,
  );
}

export function normalizeRefValue<T>(value: unknown): OrdinaryRef<T> | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }
  return assertValidRef<T>(value);
}

export function applyOrdinaryRef<T>(
  ref: OrdinaryRef<T>,
  value: T | null,
  binding: OrdinaryRefBinding,
): void {
  try {
    if (typeof ref === 'function') {
      const cleanup = binding.cleanup;
      const hasCleanup = typeof cleanup === 'function';
      binding.cleanup = undefined;
      if (hasCleanup) {
        cleanup();
      }

      if (!hasCleanup || value !== null) {
        const nextCleanup = ref(value);
        if (typeof nextCleanup === 'function') {
          binding.cleanup = nextCleanup;
        }
      }
    } else {
      ref.current = value;
    }
  } catch (error) {
    getPageLynx().reportError(error as Error);
  }
}

// Keeps the Snapshot/ET ordinary ref ordering shared without owning backend
// timing: each backend decides when to queue/flush and how to build the proxy.
export class OrdinaryRefEffectQueue<TProxy, TToken> {
  // A host instance survives hydration's numeric ID remapping. Each ref slot
  // owns its cleanup independently, even when callbacks are shared.
  private readonly bindings = new WeakMap<object, Map<number, OrdinaryRefBinding>>();
  private readonly refsToClear: Array<[ref: OrdinaryRef<TProxy>, binding: OrdinaryRefBinding]> = [];
  private readonly refsToApply: Array<[ref: OrdinaryRef<TProxy>, token: TToken, binding: OrdinaryRefBinding]> = [];

  queue(
    oldRef: OrdinaryRef<TProxy> | null | undefined,
    newRef: OrdinaryRef<TProxy> | null | undefined,
    owner: object,
    slot: number,
    token: TToken,
  ): void {
    if (oldRef === newRef) {
      return;
    }
    let slots = this.bindings.get(owner);
    if (!slots) {
      this.bindings.set(owner, slots = new Map<number, OrdinaryRefBinding>());
    }
    let binding = slots.get(slot);
    if (!binding) {
      slots.set(slot, binding = {});
    }
    if (oldRef) {
      this.refsToClear.push([oldRef, binding]);
    }
    if (newRef) {
      this.refsToApply.push([newRef, token, binding]);
    }
  }

  flush(
    createValue: (token: TToken) => TProxy,
  ): void {
    // Ref callbacks can synchronously trigger more work; detach this batch from
    // the queue before invoking user code so later effects stay in the next batch.
    const refsToClearNow = this.refsToClear.splice(0);
    const refsToApplyNow = this.refsToApply.splice(0);

    for (const [ref, binding] of refsToClearNow) {
      applyOrdinaryRef(ref, null, binding);
    }
    for (const [ref, token, binding] of refsToApplyNow) {
      applyOrdinaryRef(ref, createValue(token), binding);
    }
  }

  clear(): void {
    this.refsToClear.length = 0;
    this.refsToApply.length = 0;
  }

  hasPending(): boolean {
    return this.refsToClear.length > 0 || this.refsToApply.length > 0;
  }
}

function createRefTask(
  method: ForwardableNodesRefMethod,
  args: unknown[],
  template: string | undefined,
): RefTask {
  return (nodesRef, execStack, selector) => {
    let callArgs = args;
    if (method === 'invoke') {
      const options = args[0] as uiMethodOptions | undefined;
      if (options && typeof options.fail === 'function') {
        callArgs = [
          Object.assign({}, options, {
            fail: (res: Parameters<NonNullable<uiMethodOptions['fail']>>[0]) =>
              options.fail!.call(
                options,
                enrichRefError(res, options.method, template, execStack),
              ),
          }),
        ];
      } else if (__DEV__ && options) {
        callArgs = [
          Object.assign({}, options, {
            fail: (res: Parameters<NonNullable<uiMethodOptions['fail']>>[0]) => {
              if (
                res
                && (res as { code?: unknown }).code !== 0
                && !(lynx as { _switches?: { disableSelectorQueryWarningWhenFailed?: boolean } })._switches
                  ?.disableSelectorQueryWarningWhenFailed
              ) {
                const enriched = enrichRefError(res, options.method, template, undefined);
                const message =
                  `Failed to exec NodesRef.invoke() on ${selector}. Add a fail callback to suppress this warning. Msg: ${
                    JSON.stringify(enriched)
                  }\n${execStack}`;
                console.warn(message);
                const error = new Error(message);
                error.name = 'INVOKE_ERROR';
                lynx.reportError(error);
              }
            },
          }),
        ];
      }
    }

    return (nodesRef[method] as (...params: unknown[]) => SelectorQuery).apply(nodesRef, callArgs);
  };
}

export abstract class SelectorRefProxy<TProxy extends SelectorRefProxy<TProxy>> {
  private task: RefTask | undefined;

  protected createProxy(template?: string): TProxy {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          typeof prop === 'symbol'
          || prop === 'then'
          || prop in target
          || typeof prop !== 'string'
        ) {
          return Reflect.get(target, prop, receiver);
        }

        return <K extends ForwardableNodesRefMethod>(...args: Parameters<NodesRef[K]>) => {
          const next = target.createProxyTarget();
          (next as SelectorRefProxy<TProxy>).task = createRefTask(
            prop as ForwardableNodesRefMethod,
            args,
            template,
          );
          return next;
        };
      },
    }) as unknown as TProxy;
  }

  protected abstract createProxyTarget(): TProxy;

  protected abstract runOrDelay(task: () => void): void;

  abstract get selector(): string;

  exec(): void {
    const pageLynx = getPageLynx();
    if (__DEV__) {
      const execStack = new Error('ReactLynx ref exec() call stack').stack;
      this.runOrDelay(() => {
        const selector = this.selector;
        this.task!(pageLynx.createSelectorQuery().select(selector), execStack, selector).exec();
      });
      return;
    }
    this.runOrDelay(() => {
      this.task!(pageLynx.createSelectorQuery().select(this.selector)).exec();
    });
  }
}
