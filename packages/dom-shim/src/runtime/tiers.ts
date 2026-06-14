// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Tier-narrowing runtime helpers. See Shim_Design.md §2 "Tier selection at
 * construction".
 *
 * US-401 ships an empty module so package.json exports resolve; real cast
 * helpers (ReadOnly, SafeWrite, Events, Unsafe) land in US-448.
 */
export {};
