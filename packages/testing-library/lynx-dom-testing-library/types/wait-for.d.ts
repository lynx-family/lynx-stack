import type { LynxFiberElement } from '@lynx-js/lynx-dom';

export interface waitForOptions {
  container?: LynxFiberElement;
  timeout?: number;
  interval?: number;
  onTimeout?: (error: Error) => Error;
  mutationObserverOptions?: MutationObserverInit;
}

export function waitFor<T>(
  callback: () => Promise<T> | T,
  options?: waitForOptions,
): Promise<T>;
