// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type Cloneable<T = string | number | null | boolean | undefined> =
  | T
  | Record<string, T>
  | T[];

export type CloneableObject<T = string | number | null | boolean | undefined> =
  Record<
    string,
    T | T[]
  >;
