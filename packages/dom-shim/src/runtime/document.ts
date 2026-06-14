// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Document stand-in. See Shim_Design.md §9.
 *
 * US-401 ships an empty placeholder so downstream stories can import it
 * without churn. Real surface (createElement, body, documentElement,
 * querySelector, etc.) lands in US-425.
 */
export const document: Record<string, never> = Object.freeze({});
