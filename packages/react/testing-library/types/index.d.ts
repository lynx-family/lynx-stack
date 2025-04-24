// @ts-nocheck
export * from '../dist/index.d.ts';
import { ElementTree, LynxEnv } from '../dist/index.d.ts';

declare global {
  var lynxEnv: LynxEnv;
  var elementTree: ElementTree;

  function onInjectBackgroundThreadGlobals(globals: any): void;
  function onInjectMainThreadGlobals(globals: any): void;
  function onSwitchedToBackgroundThread(): void;
  function onSwitchedToMainThread(): void;
  function onResetLynxEnv(): void;
  function onInitWorkletRuntime(): void;
}
