// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Compatibility re-export. The headless renderer refactor moves these
// types to `src/store/`; this barrel keeps the new import path stable
// while the implementation still lives under `core/`.
export * from '../core/types.js';
