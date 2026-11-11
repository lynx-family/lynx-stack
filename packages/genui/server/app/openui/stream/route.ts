// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { OpenUIChatOptions } from '../../../service/openui/openui-agent.js';
import { getOpenUIAgentService } from '../../../service/openui/openui-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';

export default createTextStreamRoute({
  scope: 'openui',
  path: '/openui/stream',
  deltaFraming: 'line',
  getService: getOpenUIAgentService,
  parseOptions(body) {
    const tools = body.tools;
    if (tools === undefined) return { ok: true, options: {} };
    if (
      !Array.isArray(tools)
      || !tools.every(tool =>
        typeof tool === 'string' && tool.trim().length > 0
      )
    ) {
      return {
        ok: false,
        error: 'tools must be an array of nonempty tool names',
      };
    }
    // Runtime tools are prompt capabilities, not server-side agent tools.
    const options: OpenUIChatOptions = { promptOptions: { tools } };
    return { ok: true, options };
  },
});
