// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  createDefaultBenchGroups,
  getBenchProtocolLabel,
  nextBenchComparisonProtocol,
  usesCatalog,
  withBenchProtocol,
} from './benchData.js';
import { createBenchGroupsFromReport } from './benchHistory.js';

describe('Bench protocol selection', () => {
  test('switches to XML native without retaining a component catalog', () => {
    const original = createDefaultBenchGroups('test-model')[0]!;
    const xml = withBenchProtocol(
      withBenchProtocol(original, 'openui'),
      'lynx-xml',
    );
    expect(xml).toMatchObject({
      protocol: 'lynx-xml',
      profile: 'native',
      catalog: 'none',
      model: 'test-model',
    });
    expect(usesCatalog(xml)).toBe(false);
    expect(getBenchProtocolLabel(xml.protocol)).toBe('Lynx XML');
    expect(withBenchProtocol(xml, 'a2ui')).toMatchObject({
      protocol: 'a2ui',
      profile: 'native',
      catalog: 'Full Catalog',
    });
    expect(withBenchProtocol(xml, 'openui')).toMatchObject({
      protocol: 'openui',
      profile: 'matched-core',
      catalog: 'Core Catalog',
    });
  });

  test('offers XML after A2UI/OpenUI and supports an XML baseline', () => {
    const original = createDefaultBenchGroups('test-model')[0]!;
    const openui = withBenchProtocol(original, 'openui');
    const xml = withBenchProtocol(original, 'lynx-xml');
    expect(nextBenchComparisonProtocol([original, openui], original)).toBe(
      'lynx-xml',
    );
    expect(nextBenchComparisonProtocol([xml], xml)).toBe('a2ui');
    expect(nextBenchComparisonProtocol([original, openui, xml], xml)).not.toBe(
      'lynx-xml',
    );
  });

  test('restores XML protocol and model from a report', () => {
    const original = withBenchProtocol(
      createDefaultBenchGroups('xml-model')[0]!,
      'lynx-xml',
    );
    const restored = createBenchGroupsFromReport({
      env: { model: 'fallback-model', apiKeyConfigured: false },
      groups: [original],
    });
    expect(restored).toEqual([original]);
  });
});
