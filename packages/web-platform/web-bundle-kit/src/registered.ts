// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The modules Rspack or `require()` load by path at build time (the loaders
 * and the ReactLynx transform), by virtual path, each with a function that
 * imports it. `setup` puts them in the registry of the `module` stand-in.
 *
 * This file is a stub. The build replaces its content with one entry per
 * module of `REGISTERED` in rslib.config.ts (see `pluginWebBundleKit`), so
 * the virtual paths come from the same layout as the rest of the build.
 * Type checking and unit tests see the empty map.
 */
export const registered: Record<string, () => Promise<unknown>> = {};
