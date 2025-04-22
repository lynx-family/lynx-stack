// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Animation, AnimationElement, NodesRef, SelectorQuery } from '@lynx-js/types';

import { hydrationMap } from '../../snapshotInstanceHydrationMap.js';

type RefTask = (nodesRef: NodesRef) => SelectorQuery;

const lynxGetElementById = lynx.getElementById;
// @ts-ignore
lynx.getElementById = (id: string) => {
  return new ElementProxy(id);
};

/**
 * A flag to indicate whether UI operations should be delayed.
 * When set to true, UI operations will be queued in the `delayedUiOps` array
 * and executed later when `runDelayedUiOps` is called.
 * This is used during the commit phase to ensure UI operations are batched
 * and executed at the appropriate time.
 */
const shouldDelayUiOps = { value: true };

/**
 * An array of functions that will be executed later when `runDelayedUiOps` is called.
 * These functions contain UI operations that need to be delayed.
 */
const delayedUiOps: (() => void)[] = [];

/**
 * Runs a task either immediately or delays it based on the `shouldDelayUiOps` flag.
 * @param task - The function to execute.
 */
function runOrDelay(task: () => void): void {
  if (shouldDelayUiOps.value) {
    delayedUiOps.push(task);
  } else {
    task();
  }
}

/**
 * Executes all delayed UI operations.
 */
function runDelayedUiOps(): void {
  for (const task of delayedUiOps) {
    task();
  }
  shouldDelayUiOps.value = false;
  delayedUiOps.length = 0;
}

/**
 * A proxy class designed for managing and executing reference-based tasks.
 * Provides functionality to invoke and execute tasks associated with specific references.
 */
class RefProxy {
  private readonly refAttr: [number, number];
  private task: RefTask | undefined;

  constructor(refAttr: [number, number]) {
    this.refAttr = refAttr;
  }

  private setTask<K extends keyof NodesRef>(
    method: K,
    args: Parameters<NodesRef[K] extends (...args: any[]) => any ? NodesRef[K] : never>,
  ): this {
    this.task = (nodesRef) => {
      return (nodesRef[method] as unknown as (...args: any[]) => SelectorQuery)(...args);
    };
    return this;
  }

  invoke(...args: Parameters<NodesRef['invoke']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('invoke', args);
  }

  path(...args: Parameters<NodesRef['path']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('path', args);
  }

  fields(...args: Parameters<NodesRef['fields']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('fields', args);
  }

  setNativeProps(...args: Parameters<NodesRef['setNativeProps']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('setNativeProps', args);
  }

  exec(): void {
    runOrDelay(() => {
      const realRefId = hydrationMap.get(this.refAttr[0]) ?? this.refAttr[0];
      const refSelector = `[react-ref-${realRefId}-${this.refAttr[1]}]`;
      this.task!(lynx.createSelectorQuery().select(refSelector)).exec();
    });
  }
}

/**
 * A proxy class for elements that handles animation and property operations.
 * This class delays operations until the appropriate time based on the shouldDelayUiOps flag.
 */
class ElementProxy {
  private readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  animate(...args: Parameters<AnimationElement['animate']>): AnimationProxy {
    const animation = new AnimationProxy();
    runOrDelay(() => {
      animation.onReceivedAnimation(lynxGetElementById(this.id).animate(...args));
    });
    return animation;
  }

  setProperty(...args: Parameters<AnimationElement['setProperty']>): void {
    runOrDelay(() => {
      lynxGetElementById(this.id).setProperty(...args);
    });
  }
}

/**
 * A proxy class for animations that handles play, pause, and cancel operations.
 * This class queues operations until the actual animation object is available,
 * then executes them in order.
 */
class AnimationProxy {
  private animation: Animation | undefined;
  private tasks: (() => void)[] = [];

  onReceivedAnimation(animation: Animation): void {
    this.animation = animation;
    for (const task of this.tasks) {
      task();
    }
    this.tasks.length = 0;
  }

  private runOrDelay(method: 'play' | 'pause' | 'cancel'): void {
    if (this.animation) {
      this.animation[method]();
      return;
    }
    this.tasks.push(() => {
      this.animation![method]();
    });
  }

  play(): void {
    this.runOrDelay('play');
  }

  pause(): void {
    this.runOrDelay('pause');
  }

  cancel(): void {
    this.runOrDelay('cancel');
  }
}

/**
 * @internal
 */
export { RefProxy, runDelayedUiOps, shouldDelayUiOps, ElementProxy };
