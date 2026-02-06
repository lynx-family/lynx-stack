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

export function setupSSRMiddleware(api: any) {
  api.use(
    async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      if (url.pathname === '/ssr') {
        const bundlePathQuery = url.searchParams.get('bundle');
        if (!bundlePathQuery) {
          res.end('Missing bundle query param');
          return;
        }

        const bundlePath = path.resolve(process.cwd(), bundlePathQuery);

        try {
          console.log(`SSR Rendering: ${bundlePath}`);

          const buffer = fs.readFileSync(bundlePath);

          // Execute Template
          const ssrResult = await executeTemplate(
            buffer,
            {}, // initData
            {}, // globalProps
            {}, // initI18nResources
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
          res.end(`SSR Error: ${err.message}`);
        }
      } else {
        next();
      }
    },
  );
}
