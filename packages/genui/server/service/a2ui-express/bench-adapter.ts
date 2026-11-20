// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createExpressService } from './agent.js';
import {
  createExpressProcessor,
  validateExpressOutput,
} from '../../agent/a2ui-express/format.js';
import { createA2UIBenchAdapter } from '../a2ui/a2ui-bench-adapter.js';

export function createExpressBenchAdapter() {
  return createA2UIBenchAdapter({
    format: {
      protocol: 'a2ui-express',
      outputInstruction:
        'Return the complete UI as A2UI Express inside <a2ui> tags using the selected catalog.',
      validate: validateExpressOutput,
    },
    generateRaw(messages, opts, signal) {
      const service = createExpressService(
        createExpressProcessor(opts.catalog),
      );
      return service.generateRaw(messages, opts, undefined, signal);
    },
  });
}
