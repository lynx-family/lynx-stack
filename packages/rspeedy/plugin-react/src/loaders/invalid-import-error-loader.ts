// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

export default function invalidImportErrorLoader(
  this: Rspack.LoaderContext<{ message: string }>,
): void {
  const { message } = this.getOptions()
  throw new Error(message)
}
