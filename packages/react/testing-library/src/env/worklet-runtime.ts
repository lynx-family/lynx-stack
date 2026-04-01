const workletRuntimeGlobal = globalThis as typeof globalThis & {
  lynxWorkletImpl?: unknown;
  onInitWorkletRuntime?: () => unknown;
};

if (!workletRuntimeGlobal.lynxWorkletImpl) {
  workletRuntimeGlobal.onInitWorkletRuntime?.();
}

export {};
