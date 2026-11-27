// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// What the Node.js stand-ins need from the kit at run time. The kit fills it
// in (see ../setup.ts) after @rspack/browser has loaded and before any
// bundled package is evaluated.

type RspackBrowser = typeof import('@rspack/browser');

/** The memfs instance that Rspack reads. */
export type MemFs = RspackBrowser['builtinMemFs']['fs'];

export const host: {
  /** `rspack.builtinMemFs.fs` of @rspack/browser. */
  fs: MemFs | undefined;
  /** `rspack.experiments.resolver.ResolverFactory` of @rspack/browser. */
  ResolverFactory:
    | RspackBrowser['experiments']['resolver']['ResolverFactory']
    | undefined;
  /** Modules bundled into the kit, by their virtual path. */
  modules: Record<string, unknown>;
} = {
  fs: undefined,
  ResolverFactory: undefined,
  modules: Object.create(null) as Record<string, unknown>,
};

/** The memfs of @rspack/browser. Bundled code only runs after setup. */
export const memfs = (): MemFs => host.fs!;
