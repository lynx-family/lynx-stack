// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { CSS } from '@lynx-js/template-webpack-plugin';

const supportedAtRules = new Set(['font-face', 'keyframes']);

export function parseStylesheet(
  source: string | undefined,
  filename: string,
): CSS.LynxStyleNode[] {
  if (source === undefined) return [];
  const { root, errors } = CSS.parse(source, {
    filename,
    plugins: [{
      name: 'lynx:islands:stylesheet',
      phaseStandard(ast) {
        // Keep diagnostics before serialization: unknown at-rules are otherwise
        // silently discarded, and imports have no sibling stylesheet to resolve.
        const unsupported = new Set<string>();
        CSS.csstree.walk(ast, node => {
          if (node.type === 'Atrule' && !supportedAtRules.has(node.name)) {
            unsupported.add(`@${node.name}`);
          }
        });
        if (unsupported.size > 0) {
          throw new Error(
            `${filename}: Island CSS has unsupported at-rules: ${
              [...unsupported].join(', ')
            }`,
          );
        }
      },
    }],
  });
  if (errors.length > 0) {
    throw new Error(
      `${filename}: Invalid island CSS: ${
        errors.map(error => error.message).join('; ')
      }`,
    );
  }
  return root;
}
