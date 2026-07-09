// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NodesRef, SelectorQuery } from '@lynx-js/types';

export type RefCleanup = (() => void) | void;
export type RefCallback<T> = ((ref: T | null) => RefCleanup) & {
  _unmount?: RefCleanup;
};
export interface RefObject<T> {
  current: T | null;
}
export type OrdinaryRef<T> = RefCallback<T> | RefObject<T>;

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? K : never;
}[keyof T];

export type ForwardableNodesRefMethod = Exclude<FunctionPropertyNames<NodesRef>, 'exec'>;
type ForwardableNodesRefMethodArgs = {
  [K in ForwardableNodesRefMethod]: Parameters<NodesRef[K]>;
}[ForwardableNodesRefMethod];
export type RefProxyForwardedMethods<TProxy> = {
  [K in ForwardableNodesRefMethod]: (...args: Parameters<NodesRef[K]>) => TProxy;
};

type RefTask = (nodesRef: NodesRef) => SelectorQuery;

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
): void {
  try {
    if (typeof ref === 'function') {
      const cleanup = ref._unmount;
      const hasCleanup = typeof cleanup === 'function';
      if (hasCleanup) {
        cleanup();
      }
      ref._unmount = undefined;

      if (!hasCleanup || value !== null) {
        const nextCleanup = ref(value);
        if (typeof nextCleanup === 'function') {
          ref._unmount = nextCleanup;
        }
      }
    } else {
      ref.current = value;
    }
  } catch (error) {
    lynx.reportError(error as Error);
  }
}

// Keeps the Snapshot/ET ordinary ref ordering shared without owning backend
// timing: each backend decides when to queue/flush and how to build the proxy.
export class OrdinaryRefEffectQueue<TProxy, TToken> {
  private readonly refsToClear: OrdinaryRef<TProxy>[] = [];
  private readonly refsToApply: Array<[ref: OrdinaryRef<TProxy>, token: TToken]> = [];

  queue(
    oldRef: OrdinaryRef<TProxy> | null | undefined,
    newRef: OrdinaryRef<TProxy> | null | undefined,
    token: TToken,
  ): void {
    if (oldRef === newRef) {
      return;
    }
    if (oldRef) {
      this.refsToClear.push(oldRef);
    }
    if (newRef) {
      this.refsToApply.push([newRef, token]);
    }
  }

  flush(
    createValue: (token: TToken) => TProxy,
  ): void {
    // Ref callbacks can synchronously trigger more work; detach this batch from
    // the queue before invoking user code so later effects stay in the next batch.
    const refsToClearNow = this.refsToClear.splice(0);
    const refsToApplyNow = this.refsToApply.splice(0);

    for (const ref of refsToClearNow) {
      applyOrdinaryRef(ref, null);
    }
    for (const [ref, token] of refsToApplyNow) {
      applyOrdinaryRef(ref, createValue(token));
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

export abstract class SelectorRefProxy<TProxy extends SelectorRefProxy<TProxy>> {
  private task: RefTask | undefined;

  protected createProxy(): TProxy {
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

        return (...args: ForwardableNodesRefMethodArgs) => {
          return target.createProxyTarget().setTask(prop as ForwardableNodesRefMethod, args);
        };
      },
    }) as unknown as TProxy;
  }

  protected abstract createProxyTarget(): TProxy;

  protected abstract runOrDelay(task: () => void): void;

  abstract get selector(): string;

  private setTask(
    method: ForwardableNodesRefMethod,
    args: ForwardableNodesRefMethodArgs,
  ): TProxy {
    this.task = (nodesRef) => {
      const nodesRefMethod = nodesRef[method] as (...params: ForwardableNodesRefMethodArgs) => SelectorQuery;
      return nodesRefMethod.apply(nodesRef, args);
    };
    return this as unknown as TProxy;
  }

  exec(): void {
    this.runOrDelay(() => {
      this.task!(lynx.createSelectorQuery().select(this.selector)).exec();
    });
  }
}
