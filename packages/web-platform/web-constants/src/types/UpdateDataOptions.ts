export const enum NativeUpdateDataType {
  UPDATE = 0,
  RESET = 1,
}

export const enum UpdateDataType {
  // default
  Unknown = 0,

  // update by `setState` or `setData`
  UpdateExplicitByUser = 1,

  // update by lynx_core from ctor
  UpdateByKernelFromCtor = 1 << 1,

  // update by lynx_core from render
  UpdateByKernelFromRender = 1 << 2,

  // update by hydrate
  UpdateByKernelFromHydrate = 1 << 3,

  // update by `getDerivedStateFromProps`
  UpdateByKernelFromGetDerived = 1 << 4,

  // update by conflict detected
  UpdateByKernelFromConflict = 1 << 5,

  // update by HMR
  UpdateByKernelFromHMR = 1 << 6,
}
