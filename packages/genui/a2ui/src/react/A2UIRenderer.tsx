// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Compatibility re-export. The headless renderer refactor exposes the
// renderer under `src/react/`; this barrel keeps the new import path
// stable while the implementation still lives under `core/`. The
// renamed export (`A2UIRenderer`) matches the post-refactor symbol so
// catalog components can adopt the new path now.
export {
  A2UIRender as A2UIRenderer,
  NodeRenderer,
} from '../core/A2UIRender.jsx';
