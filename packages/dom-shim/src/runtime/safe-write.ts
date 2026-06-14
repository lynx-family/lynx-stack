// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// L2SafeWritableElement lives in `nodes.ts` to avoid the import cycle that
// ESLint `import/no-cycle` rejects (the L2 class needs `coerceAttributeValue`,
// `getElementCache`, `invalidateGeometry`, `scheduleFlush`, AND `wrapPapi`
// must dispatch to it). This file re-exports it to preserve the file layout
// documented in Shim_Implementation_PRD.md §8.1.
export { L2SafeWritableElement } from './nodes.ts';
