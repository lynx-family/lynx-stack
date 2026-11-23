// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { HTML_SYSTEM_PROMPT } from '@lynx-js/genui-html';

import type { GenerationAgentOptions } from '../common/agent-capabilities.js';
import { createTextAgent } from '../common/text-agent.js';

export type { TextAgent as HtmlAgent } from '../common/text-agent.js';

export function createHtmlAgent(opts: GenerationAgentOptions = {}) {
  return createTextAgent('html-agent', 'HtmlAgent', HTML_SYSTEM_PROMPT, opts);
}
