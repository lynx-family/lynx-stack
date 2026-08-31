// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { normalizeHtmlArtifact } from '../../../agent/html-output.js';
import { getHtmlAgentService } from '../../../service/html-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';

export default createTextStreamRoute({
  scope: 'html',
  path: '/html/stream',
  getService: getHtmlAgentService,
  normalizeFinalText: normalizeHtmlArtifact,
});
