// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getOpenUIAgentService } from '../../../service/openui-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';

export default createTextStreamRoute({
  scope: 'openui',
  path: '/openui/stream',
  getService: getOpenUIAgentService,
});
