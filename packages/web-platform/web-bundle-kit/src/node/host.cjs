// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// What the Node.js stand-ins need from the kit at run time. The kit fills it
// in (see ../setup.ts) before any bundled package is evaluated.
module.exports = {
  /** The memfs of @rspack/browser. */
  fs: undefined,
  /** `rspack.experiments.resolver.ResolverFactory` of @rspack/browser. */
  ResolverFactory: undefined,
  /** Modules bundled into the kit, by their virtual path. */
  modules: Object.create(null),
};
