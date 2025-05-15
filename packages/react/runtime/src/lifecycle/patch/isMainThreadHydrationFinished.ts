import { onHydrationFinished } from '@lynx-js/react/worklet-runtime/bindings';

export let isMainThreadHydrationFinished = false;

export function setMainThreadHydrationFinished(isFinished: boolean): void {
  if (isFinished && !isMainThreadHydrationFinished) {
    onHydrationFinished();
  }
  isMainThreadHydrationFinished = isFinished;
}
