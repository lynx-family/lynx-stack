// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, test } from '@rstest/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Compiles the test config with the real Tailwind CSS v3 CLI.
 *
 * The CLI is resolved from the `tailwindcss` devDependency instead of
 * `node_modules/.bin`, because `postcss` is not hoisted into this package
 * and the bin link depends on the installer layout.
 */
function compilePresetCSS(): string {
  return execFileSync(process.execPath, [
    require.resolve('tailwindcss/lib/cli.js'),
    '--config',
    path.resolve(__dirname, 'tailwind.config.ts'),
    '--input',
    path.resolve(__dirname, 'styles.css'),
  ], {
    encoding: 'utf-8',
    timeout: 30_000,
    // Progress and browserslist notices go to stderr, CSS goes to stdout.
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// This compile is what timed out on Windows in #1125, back when CI passed
// `--hook-timeout` and vitest silently ignored it, leaving hooks at the 10s
// default. #1121 corrected the flag to `--hookTimeout`, so the 50s ceiling
// now actually applies.
describe('Lynx Tailwind Preset', () => {
  let compiledCSS = '';
  let usedProperties = new Set<string>();

  beforeAll(() => {
    compiledCSS = compilePresetCSS();
    usedProperties = extractPropertiesFromCSS(compiledCSS);
  });

  test('compiles the preset without changing its output', async () => {
    await expect(compiledCSS).toMatchFileSnapshot(
      path.resolve(__dirname, 'output.css'),
    );
  });

  describe('Test against allowed CSS Properties', () => {
    test('all used properties are supported', () => {
      const allowedProperties = [
        ...supportedProperties,
        ...allowedUnsupportedProperties,
      ];

      // Check that all used properties are supported
      for (const property of usedProperties) {
        expect(allowedProperties).toContain(property);
      }
    });
  });
});

// Helper function to convert kebab-case to camelCase
function kebabToCamel(str: string): string {
  return str.replace(
    /-([a-z])/g,
    (_: string, letter: string) => letter.toUpperCase(),
  );
}

// Helper function to extract CSS property names from generated utilities
function extractPropertiesFromCSS(css: string): Set<string> {
  const properties = new Set<string>();
  const propertyRegex = /([a-z-]+):/gi;
  let match;

  while ((match = propertyRegex.exec(css)) !== null) {
    if (match[1] && !match[1].startsWith('--tw-')) {
      properties.add(kebabToCamel(match[1]));
    }
  }

  return properties;
}

/**
 * Get all supported CSS properties in LynxJS Official Docs
 * Ideally this should be generated from the
 * {@link https://www.npmjs.com/package/@lynx-js/css-defines}
 */
const supportedProperties: string[] = [
  'XAutoFontSizePresetSizes',
  'XAutoFontSize',
  'XHandleColor',
  'XHandleSize',
  'alignContent',
  'alignItems',
  'alignSelf',
  'animationDelay',
  'animationDirection',
  'animationDuration',
  'animationFillMode',
  'animationIterationCount',
  'animationName',
  'animationPlayState',
  'animationTimingFunction',
  'animation',
  'aspectRatio',
  'backgroundClip',
  'backgroundColor',
  'backgroundImage',
  'backgroundOrigin',
  'backgroundPosition',
  'backgroundRepeat',
  'backgroundSize',
  'background',
  'borderBottomColor',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderBottomStyle',
  'borderBottomWidth',
  'borderBottom',
  'borderColor',
  'borderEndEndRadius',
  'borderEndStartRadius',
  'borderInlineEndColor',
  'borderInlineEndStyle',
  'borderInlineEndWidth',
  'borderInlineStartColor',
  'borderInlineStartStyle',
  'borderInlineStartWidth',
  'borderLeftColor',
  'borderLeftStyle',
  'borderLeftWidth',
  'borderLeft',
  'borderRadius',
  'borderRightColor',
  'borderRightStyle',
  'borderRightWidth',
  'borderRight',
  'borderStartEndRadius',
  'borderStartStartRadius',
  'borderStyle',
  'borderTopColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderTopStyle',
  'borderTopWidth',
  'borderTop',
  'borderWidth',
  'border',
  'bottom',
  'boxShadow',
  'boxSizing',
  'clipPath',
  'color',
  'columnGap',
  'direction',
  'display',
  'filter',
  'flexBasis',
  'flexDirection',
  'flexFlow',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'flex',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'gap',
  'gridAutoColumns',
  'gridAutoFlow',
  'gridAutoRows',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridTemplateColumns',
  'gridTemplateRows',
  'height',
  'imageRendering',
  'insetInlineEnd',
  'insetInlineStart',
  'justifyContent',
  'justifyItems',
  'justifySelf',
  'left',
  'letterSpacing',
  'lineHeight',
  'linearCrossGravity',
  'linearDirection',
  'linearGravity',
  'linearLayoutGravity',
  'linearWeightSum',
  'linearWeight',
  'marginBottom',
  'marginInlineEnd',
  'marginInlineStart',
  'marginLeft',
  'marginRight',
  'marginTop',
  'margin',
  'maskImage',
  'mask',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'opacity',
  'order',
  'overflowX',
  'overflowY',
  'overflow',
  'paddingBottom',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'padding',
  'perspective',
  'position',
  'relativeAlignBottom',
  'relativeAlignInlineEnd',
  'relativeAlignInlineStart',
  'relativeAlignLeft',
  'relativeAlignRight',
  'relativeAlignTop',
  'relativeBottomOf',
  'relativeCenter',
  'relativeId',
  'relativeInlineEndOf',
  'relativeInlineStartOf',
  'relativeLayoutOnce',
  'relativeLeftOf',
  'relativeRightOf',
  'relativeTopOf',
  'right',
  'rowGap',
  'textAlign',
  'textDecoration',
  'textIndent',
  'textOverflow',
  'textShadow',
  'textStrokeColor',
  'textStrokeWidth',
  'textStroke',
  'top',
  'transformOrigin',
  'transform',
  'transitionDelay',
  'transitionDuration',
  'transitionProperty',
  'transitionTimingFunction',
  'transition',
  'verticalAlign',
  'visibility',
  'whiteSpace',
  'width',
  'wordBreak',
  'zIndex',
];

const allowedUnsupportedProperties = [
  'overflowWrap',
];
