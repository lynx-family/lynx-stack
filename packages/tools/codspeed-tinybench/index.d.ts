// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Bench } from 'tinybench';

export { Bench } from 'tinybench';

/**
 * Run a tinybench `Bench` (tasks already added) under CodSpeed when
 * instrumented, else fall back to a normal tinybench walltime run.
 *
 * @param bench A tinybench `Bench` with its tasks already added via `.add()`.
 * @param benchFileUrl `import.meta.url` of the calling bench file (used to
 *   build the CodSpeed benchmark URI).
 */
export function withCodSpeed(bench: Bench, benchFileUrl: string): Promise<void>;
