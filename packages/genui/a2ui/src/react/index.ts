// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Public React surface. `<A2UI>` is the all-in-one component for
// developers without protocol knowledge. The hooks + `NodeRenderer` are
// the contract that custom catalog components plug into.
//
// `A2UIProvider`, `A2UIRenderer`, `A2UIContext`, `useA2UIContext`, and
// `useCatalog` are intentionally NOT exported — they're internal details
// of how `<A2UI>` mounts itself. Custom components don't need them.
//
// `FormContext` and `FormController` are also internal. `useChecks` reads
// from `FormContext` so a follow-up PR can introduce a `<Form>` component
// that aggregates input validity — exporting the context now would
// pre-commit the package to a Provider-based API before there's a real
// consumer to validate it.
export { A2UI } from './A2UI.js';
export type { A2UIProps } from './A2UI.js';
export { NodeRenderer } from './A2UIRenderer.js';
export { useAction } from './useAction.js';
export type { ActionProps } from './useAction.js';
export { useDataBinding, useResolvedProps } from './useDataBinding.js';
export { useChecks } from './useChecks.js';
export type { CheckLike } from './useChecks.js';
