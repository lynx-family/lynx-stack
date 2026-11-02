// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname } from 'node:path';

import { GroupRouter } from 'typedoc';
import type { Reflection } from 'typedoc';

/** Keeps group paths in English while rendering with the page's locale. */
export class ApiGroupRouter extends GroupRouter {
  override extension = '.mdx';
  readonly groupLabels = new Map<string, string>();

  protected override getIdealBaseName(reflection: Reflection): string {
    const localized = super.getIdealBaseName(reflection);
    const locale = this.application.options.getValue('lang');
    this.application.internationalization.setLocale('en');
    try {
      const path = super.getIdealBaseName(reflection);
      this.groupLabels.set(dirname(path), dirname(localized));
      return path;
    } finally {
      this.application.internationalization.setLocale(locale);
    }
  }

  protected override getFileName(baseName: string): string {
    // Match typedoc-plugin-markdown's merged README entry page.
    if (
      baseName === 'modules'
      && this.application.options.getValue('mergeReadme')
    ) return `index${this.extension}`;
    return super.getFileName(baseName);
  }
}
