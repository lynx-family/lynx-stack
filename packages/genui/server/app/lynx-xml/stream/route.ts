// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { normalizeLynxXmlArtifact } from '../../../agent/lynx-xml-output.js';
import { getLynxXmlAgentService } from '../../../service/lynx-xml-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';

export default createTextStreamRoute({
  scope: 'lynx-xml',
  path: '/lynx-xml/stream',
  getService: getLynxXmlAgentService,
  normalizeFinalText: normalizeLynxXmlArtifact,
});
