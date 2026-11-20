// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHtmlAgent } from '../../agent/html/html-agent.js';
import TextAgentService from '../common/text-agent.js';

export type { ChatOptions as HtmlChatOptions } from '../common/types.js';

export default class HtmlAgentService extends TextAgentService {
  constructor() {
    super('html', opts => createHtmlAgent(opts).agent);
  }
}

const SERVICE_KEY = '__HTML_AGENT_SERVICE__';
type GlobalWithService = typeof globalThis & {
  [SERVICE_KEY]?: HtmlAgentService;
};

export function getHtmlAgentService(): HtmlAgentService {
  const global = globalThis as GlobalWithService;
  global[SERVICE_KEY] ??= new HtmlAgentService();
  return global[SERVICE_KEY];
}
