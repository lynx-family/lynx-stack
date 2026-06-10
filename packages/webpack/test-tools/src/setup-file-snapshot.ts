// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Register ONLY the file-snapshot matcher the harness needs. We deliberately do
// NOT pull in `@rspack/test-tools/setup-expect`, because it also installs global
// snapshot *serializers* that rewrite Error/object output and corrupt unrelated
// unit tests' inline snapshots (e.g. css-extract's `runtime.test.ts`). The
// harness already normalizes its own snapshot content via `normalizePlaceholder`,
// so those serializers are unnecessary here.
//
// Used as an rstest `setupFiles` entry, AFTER `@rspack/test-tools/setup-env`
// (which forwards the `__*__` path env vars onto globals before the
// `@rspack/test-tools` barrel reads them at load time).
import { toMatchFileSnapshotSync } from '@rspack/test-tools/helper/expect/to-match-file-snapshot';

(globalThis as unknown as {
  expect: { extend: (m: Record<string, unknown>) => void };
}).expect.extend({ toMatchFileSnapshotSync });
