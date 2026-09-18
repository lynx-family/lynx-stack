// @ts-nocheck
export * from '../dist/index.d.ts';
import { ElementTree, LynxTestingEnv } from '../dist/index.d.ts';

declare global {
  var lynxTestingEnv: LynxTestingEnv;
  var elementTree: ElementTree;

  function onInjectBackgroundThreadGlobals(globals: any): void;
  function onInjectMainThreadGlobals(globals: any): void;
  function onSwitchedToBackgroundThread(): void;
  function onSwitchedToMainThread(): void;
  function onResetLynxTestingEnv(): void;
  function onInitWorkletRuntime(): void;
}
