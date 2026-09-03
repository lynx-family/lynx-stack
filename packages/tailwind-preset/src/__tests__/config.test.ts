// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, test } from '@rstest/core';

import { testClasses, unsupportedClasses } from './test-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const TAILWIND_CLI_TIMEOUT = 30_000;
const TAILWIND_HOOK_TIMEOUT = 50_000;
const escapeClassName = (
  require('tailwindcss/lib/util/escapeClassName.js') as {
    default: (className: string) => string;
  }
).default;

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
    '--no-autoprefixer',
  ], {
    encoding: 'utf-8',
    timeout: TAILWIND_CLI_TIMEOUT,
    // Progress notices go to stderr, CSS goes to stdout.
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// Full-suite Windows CI can exceed Vitest's default 10-second hook timeout.
// Keep the hook limit above the child-process limit so the CLI owns timeouts.
describe('Lynx Tailwind Preset', () => {
  let compiledCSS = '';
  let usedProperties = new Set<string>();

  beforeAll(() => {
    compiledCSS = compilePresetCSS();
    usedProperties = extractPropertiesFromCSS(compiledCSS);
  }, TAILWIND_HOOK_TIMEOUT);

  test('compiles the preset without changing its output', async () => {
    await expect(compiledCSS).toMatchFileSnapshot(
      path.resolve(__dirname, 'output.css'),
    );
  });

  test('generates every representative utility class', () => {
    for (const className of testClasses.split(' ')) {
      expect(compiledCSS).toMatch(
        new RegExp(
          `\\.${escapeRegExp(escapeClassName(className))}(?![-_a-zA-Z0-9])`,
        ),
      );
    }
  });

  test('does not generate unsupported utility classes', () => {
    for (const className of unsupportedClasses) {
      expect(compiledCSS).not.toMatch(
        new RegExp(
          `\\.${escapeRegExp(escapeClassName(className))}(?![-_a-zA-Z0-9])`,
        ),
      );
    }
  });

  describe('Test against verified CSS properties', () => {
    test('all generated properties are verified', () => {
      const verifiedProperties = [
        ...documentedProperties,
        ...verifiedUndocumentedProperties,
      ];

      for (const property of usedProperties) {
        expect(verifiedProperties).toContain(property);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * CSS properties from a July 4, 2025 snapshot of the LynxJS official docs.
 *
 * This conservative list guards the CLI fixture. It is not a current or
 * exhaustive runtime capability definition, so verify documented omissions
 * against the applicable SDK/runtime before using them to update the support matrix.
 *
 * A generated replacement could use
 * {@link https://www.npmjs.com/package/@lynx-js/css-defines}, but it must
 * filter by maintained target and SDK support. A registered CSS definition
 * alone is insufficient because legacy, unmaintained entries may remain.
 */
const documentedProperties: string[] = [
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

/**
 * Runtime-supported properties missing from the documentation snapshot above.
 *
 * Keep each entry tied to runtime/source evidence and a representative class
 * in test-content.ts.
 */
const verifiedUndocumentedProperties: string[] = [
  // Supported on `<input>` in Lynx SDK 3.4+; absent from the CSS docs snapshot.
  'caretColor',
];
