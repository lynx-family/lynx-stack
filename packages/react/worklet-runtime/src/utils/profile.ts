// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function profile<Ret, Fn extends (...args: unknown[]) => Ret>(
  sliceName: string,
  f: Fn,
): Ret {
  /* v8 ignore next 9 */
  // TODO: change it to __PROFILE__
  if (__DEV__) {
    console.profile(sliceName);
    try {
      return f();
    } finally {
      console.profileEnd();
    }
  } else {
    return f();
  }
}
