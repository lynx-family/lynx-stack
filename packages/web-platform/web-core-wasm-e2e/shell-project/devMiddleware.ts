/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { executeTemplate } from '@lynx-js/web-core-wasm/server';
import type { IncomingMessage, ServerResponse } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ssrMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  if (url.pathname === '/ssr') {
    const caseName = url.searchParams.get('casename');
    const hasdir = url.searchParams.get('hasdir') === 'true';
    const bundlePath = path.join(
      __dirname,
      '../dist',
      hasdir ? caseName : '',
      `${caseName}.web.bundle`,
    );

    try {
      const buffer = fs.readFileSync(bundlePath);

      // Construct view attributes from other query params and defaults
      const attributes = new Map<string, string>();
      attributes.set('height', 'auto');
      attributes.set('id', 'lynxview1');
      attributes.set(
        'url',
        `/dist/ssr/${
          hasdir
            ? `${caseName}/${caseName}.web.bundle`
            : `${caseName}.web.bundle`
        }`,
      );

      url.searchParams.forEach((value, key) => {
        if (key !== 'casename' && key !== 'hasdir') {
          attributes.set(key, value);
        }
      });

      let viewAttributes = '';
      for (const [key, value] of attributes) {
        viewAttributes += `${key}="${value}" `;
      }
      viewAttributes = viewAttributes.trim();

      // Execute Template
      const ssrResult = await executeTemplate(
        buffer,
        {}, // initData
        {}, // globalProps
        {}, // initI18nResources
        viewAttributes,
      );

      // Read template
      const template = fs.readFileSync(
        path.join(__dirname, 'ssr.html'),
        'utf-8',
      );

      // Inject result
      const html = template.replace(
        '<!--INJECT_SSR_CONTENT-->',
        ssrResult,
      );

      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch (err: any) {
      console.error('SSR Error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  } else {
    next();
  }
}
