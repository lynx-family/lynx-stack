// @ts-nocheck
export * from '../dist/index.d.ts';

declare global {
  var lynxEnv: LynxEnv;
  var elementTree: ElementTree;
  var __JS__: boolean;
  var __LEPUS__: boolean;
  var __BACKGROUND__: boolean;
  var __MAIN_THREAD__: boolean;

  namespace lynxCoreInject {
    var tt: any;
  }

  function onInjectBackgroundThreadGlobals(globals: any): void;
  function onInjectMainThreadGlobals(globals: any): void;
  function onSwitchedToBackgroundThread(): void;
  function onSwitchedToMainThread(): void;
  function onResetLynxEnv(): void;
  function onInitWorkletRuntime(): void;
}
