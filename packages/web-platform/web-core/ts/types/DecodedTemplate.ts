/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageConfig } from './PageConfig.js';
import type {
  ElementTemplateDefinition,
  StyleSheetResource,
} from '../../binary/client/client.js';
import type { ElementTemplateAsset } from './ElementTemplateData.js';

export interface DecodedElementTemplateDefinition {
  template: HTMLTemplateElement;
  definition: ElementTemplateDefinition;
}

export interface DecodedTemplate {
  config?: PageConfig;
  lepusCode?: Record<string, string>;
  customSections?: Record<string, any>;
  backgroundCode?: Record<string, string>;
  elementTemplates?: ElementTemplateAsset[];
  elementTemplateDefinitions?: Map<string, DecodedElementTemplateDefinition>;
  styleSheet?: StyleSheetResource;
}
