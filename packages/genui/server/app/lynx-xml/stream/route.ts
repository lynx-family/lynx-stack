// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { normalizeLynxXmlArtifact } from '../../../agent/lynx-xml/lynx-xml-output.js';
import { getLynxXmlAgentService } from '../../../service/lynx-xml/lynx-xml-agent.js';
import type { LynxXmlChatOptions } from '../../../service/lynx-xml/lynx-xml-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';

export default createTextStreamRoute({
  scope: 'lynx-xml',
  path: '/lynx-xml/stream',
  getService: getLynxXmlAgentService,
  parseOptions(body) {
    if (
      body.enableScriptReuse !== undefined
      && typeof body.enableScriptReuse !== 'boolean'
    ) {
      return { ok: false, error: 'enableScriptReuse must be a boolean' };
    }
    if (
      body.enableHtmlFragment !== undefined
      && typeof body.enableHtmlFragment !== 'boolean'
    ) {
      return { ok: false, error: 'enableHtmlFragment must be a boolean' };
    }
    const options: LynxXmlChatOptions = {
      enableScriptReuse: body.enableScriptReuse === true,
      enableHtmlFragment: body.enableHtmlFragment === true,
    };
    if (
      body.stylePreset !== undefined && body.stylePreset !== false
      && body.stylePreset !== 'default'
    ) {
      return { ok: false, error: 'stylePreset must be false or "default"' };
    }
    if (body.stylePreset) options.stylePreset = body.stylePreset;
    return { ok: true, options };
  },
  normalizeFinalText: normalizeLynxXmlArtifact,
});
