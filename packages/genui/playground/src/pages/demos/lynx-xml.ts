// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { DemosListSource } from './DemosList.js';
import { LYNX_XML_DEMOS_LIST_PRESENTATION } from './lynx-xml-presentation.js';
import type { LynxXmlScenario } from './lynx-xml-presentation.js';
import { buildLynxXmlRenderUrl } from '../../utils/renderUrl.js';

export {
  LYNX_XML_DEMOS_PAGE_SOURCE,
  LYNX_XML_SCENARIOS,
} from './lynx-xml-presentation.js';
export type { LynxXmlScenario } from './lynx-xml-presentation.js';

export const LYNX_XML_DEMOS_LIST_SOURCE = {
  ...LYNX_XML_DEMOS_LIST_PRESENTATION,
  createPreviewUrl({ baseUrl, scenario, theme }) {
    return buildLynxXmlRenderUrl({
      sourceUrl: new URL(scenario.sourcePath, baseUrl).toString(),
      theme,
    }, baseUrl);
  },
} satisfies DemosListSource<LynxXmlScenario>;
