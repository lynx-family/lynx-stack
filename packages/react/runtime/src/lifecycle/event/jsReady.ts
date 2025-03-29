import { LifecycleConstant } from '../../lifecycleConstant.js';
import { __root } from '../../root.js';
import { takeGlobalRefPatchMap } from '../../snapshot/ref.js';

let isJSReady: boolean;
let jsReadyEventIdSwap: Record<number, number>;

function jsReady(): void {
  isJSReady = true;
  __OnLifecycleEvent([
    LifecycleConstant.firstScreen, /* FIRST_SCREEN */
    {
      root: JSON.stringify(__root),
      refPatch: JSON.stringify(takeGlobalRefPatchMap()),
      jsReadyEventIdSwap,
    },
  ]);
  jsReadyEventIdSwap = {};
}

function clearJSReadyEventIdSwap(): void {
  jsReadyEventIdSwap = {};
}

function resetJSReady(): void {
  isJSReady = false;
  jsReadyEventIdSwap = {};
}

/**
 * @internal
 */
export { jsReady, isJSReady, jsReadyEventIdSwap, clearJSReadyEventIdSwap, resetJSReady };
