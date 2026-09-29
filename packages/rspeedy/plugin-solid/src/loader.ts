// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LoaderContext, LoaderDefinitionFunction } from '@rspack/core'

import {
  SOLID_ELEMENT_TEMPLATE_BUILD_INFO,
  transformSolidElementTemplates,
} from './transform.js'

const solidElementTemplateLoader: LoaderDefinitionFunction = function(
  this: LoaderContext<Record<string, never>>,
  content,
  sourceMap,
): void {
  const currentModule = (this as typeof this & {
    _module?: {
      buildInfo?: Record<string, unknown>
    }
  })._module
  const buildInfo = currentModule?.buildInfo
  const result = transformSolidElementTemplates(
    content,
    this.resourcePath,
    sourceMap ?? undefined,
  )
  if (buildInfo !== undefined) {
    if (result.elementTemplates.length === 0) {
      delete buildInfo[SOLID_ELEMENT_TEMPLATE_BUILD_INFO]
    } else {
      buildInfo[SOLID_ELEMENT_TEMPLATE_BUILD_INFO] = result.elementTemplates
    }
  }
  this.callback(null, result.code, result.map as never)
}

export default solidElementTemplateLoader
