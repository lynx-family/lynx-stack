// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, test } from 'vitest';

import type { CSSProperties } from '@lynx-js/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Lynx Tailwind Preset', () => {
  let compiledCSS = '';
  let usedProperties = new Set<string>();

  beforeAll(() => {
    try {
      const cwd = path.resolve(__dirname, '../../');
      const configPath = path.resolve(__dirname, 'tailwind.config.ts');
      const inputPath = path.resolve(__dirname, 'styles.css');
      const outputPath = path.resolve(__dirname, 'output.css');

      // console.log('Working directory:', cwd);
      // console.log('Config path:', configPath);
      // console.log('Input path:', inputPath);
      // console.log('Output path:', outputPath);

      // Use Tailwind CLI to build CSS
      execSync(
        `npx tailwindcss -i ${inputPath} -o ${outputPath} -c ${configPath}`,
        {
          cwd,
        },
      );

      // Read the generated CSS
      compiledCSS = fs.readFileSync(outputPath, 'utf-8');

      // Extract classes and properties
      usedProperties = extractPropertiesFromCSS(compiledCSS);

      // Cleanup only if file exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (error) {
      console.error('Failed to generate CSS:', error);
      throw error;
    }
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
 * Get all supported CSS properties from @lynx-js/types
 * ideally this should be generated from the {@link CSSProperties} type
 * or {@link https://www.npmjs.com/package/@lynx-js/css-define}
 */
const supportedProperties: Array<keyof CSSProperties> = [
  'position',
  'boxSizing',
  'display',
  'overflow',
  'whiteSpace',
  'textAlign',
  'textOverflow',
  'fontWeight',
  'flexDirection',
  'flexWrap',
  'alignContent',
  'alignItems',
  'justifyContent',
  'fontStyle',
  'transform',
  'animationTimingFunction',
  'borderStyle',
  'transformOrigin',
  'linearOrientation',
  'linearGravity',
  'linearLayoutGravity',
  'layoutAnimationCreateTimingFunction',
  'layoutAnimationCreateProperty',
  'layoutAnimationDeleteTimingFunction',
  'layoutAnimationDeleteProperty',
  'layoutAnimationUpdateTimingFunction',
  'textDecoration',
  'visibility',
  'transitionProperty',
  'transitionTimingFunction',
  'borderLeftStyle',
  'borderRightStyle',
  'borderTopStyle',
  'borderBottomStyle',
  'overflowX',
  'overflowY',
  'wordBreak',
  'outlineStyle',
  'verticalAlign',
  'direction',
  'relativeCenter',
  'linearCrossGravity',
  'listMainAxisGap',
];

const allowedUnsupportedProperties = [
  'overflowWrap',
];
