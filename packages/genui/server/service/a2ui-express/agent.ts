// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG } from '../../agent/a2ui/a2ui-catalog.js';
import { createExpressProcessor } from '../../agent/a2ui-express/format.js';
import { createTextAgent } from '../../agent/common/text-agent.js';
import TextAgentService from '../common/text-agent.js';

export function createExpressService(
  processor: ReturnType<typeof createExpressProcessor>,
) {
  const prompt = [
    'Generate a complete Lynx UI in one <a2ui> block using A2UI Express. On follow-ups and user events, return the complete updated surface.',
    processor.promptSnippet,
  ].join('\n\n');
  return new TextAgentService(
    'a2ui-express',
    opts =>
      createTextAgent('a2ui-express-agent', 'A2UI Express', prompt, opts).agent,
  );
}

export const expressProcessor = createExpressProcessor(BASIC_CATALOG);
export const expressService = createExpressService(expressProcessor);
