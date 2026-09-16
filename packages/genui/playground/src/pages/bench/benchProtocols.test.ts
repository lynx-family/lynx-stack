// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  createBenchPresetGroups,
  createDefaultBenchGroups,
  getBenchGroupDifferences,
  getBenchProtocolLabel,
  nextBenchComparisonProtocol,
  usesCatalog,
  withBenchGroupPatch,
  withBenchProtocol,
} from './benchData.js';
import { createBenchGroupsFromReport } from './benchHistory.js';

describe('Bench preset group names', () => {
  test('updates automatic protocol names and preserves the group identity', () => {
    const group = createBenchPresetGroups('protocol', 'model')[0]!;
    const html = withBenchProtocol(group, 'html');
    expect(html).toMatchObject({ id: group.id, name: 'Group 01-HTML' });
    expect(withBenchProtocol(html, 'openui').name).toBe('Group 01-OpenUI');
    expect(withBenchProtocol(html, 'a2ui').name).toBe('Group 01-A2UI');
    const platform = createBenchPresetGroups('platform', 'model')[0]!;
    expect(withBenchProtocol(platform, 'lynx-xml').name).toBe(
      'Group 01-Lynx XML',
    );
  });

  test('updates automatic model and catalog names without encoding values in their ids', () => {
    const model = createBenchPresetGroups('model', 'first-model')[0]!;
    const updated = withBenchGroupPatch(model, { model: 'next-model' });
    expect(updated).toMatchObject({
      id: 'preset-model-1',
      name: 'Group 01-next-model',
      model: 'next-model',
    });
    expect(withBenchGroupPatch(updated, { model: 'third-model' }).name).toBe(
      'Group 01-third-model',
    );
    const catalog = createBenchPresetGroups('catalog', 'model')[0]!;
    expect(withBenchGroupPatch(catalog, { catalog: 'Minimal Catalog' }))
      .toMatchObject({
        id: 'preset-catalog-1',
        name: 'Group 01-Minimal Catalog',
      });
  });

  test('preserves manual names and labels for a different comparison variable', () => {
    const group = createBenchPresetGroups('protocol', 'model')[0]!;
    const renamed = withBenchGroupPatch(group, { name: 'My baseline' });
    expect(withBenchProtocol(renamed, 'html').name).toBe('My baseline');
    expect(withBenchGroupPatch(group, { model: 'next-model' }).name).toBe(
      'Group 01-A2UI',
    );
    expect(
      withBenchProtocol(createDefaultBenchGroups('model')[0]!, 'html')
        .name,
    ).toBe('Baseline');
  });

  test('repairs a stale legacy preset name when its configuration changes again', () => {
    const legacy = {
      ...createBenchPresetGroups('model', 'old-model')[0]!,
      id: 'preset-old-model',
      model: 'current-model',
    };
    expect(withBenchGroupPatch(legacy, { model: 'next-model' })).toMatchObject({
      id: legacy.id,
      name: 'Group 01-next-model',
    });
  });
});

describe('Bench protocol selection', () => {
  test('restores enabled conversion and reports it as a comparison difference', () => {
    const baseline = withBenchProtocol(
      createDefaultBenchGroups('model')[0]!,
      'lynx-xml',
    );
    const enabled = {
      ...baseline,
      id: 'enabled',
      enableHtmlFragment: true,
    };
    expect(getBenchGroupDifferences(enabled, baseline)).toEqual([
      'XML fragment',
    ]);
    expect(
      createBenchGroupsFromReport({
        groups: [enabled],
        env: { apiKeyConfigured: false, model: 'model' },
      })[0]
        ?.enableHtmlFragment,
    ).toBe(true);
    const { enableHtmlFragment: _flag, ...legacy } = baseline;
    expect(
      createBenchGroupsFromReport({
        groups: [legacy],
        env: { apiKeyConfigured: false, model: 'model' },
      })[0]
        ?.enableHtmlFragment,
    ).toBe(false);
  });
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

test('HTML comparison uses native, has no catalog and survives report restoration', () => {
  const baseline = createDefaultBenchGroups('html-model')[0]!;
  const html = withBenchProtocol(withBenchProtocol(baseline, 'openui'), 'html');
  expect(html).toMatchObject({
    protocol: 'html',
    profile: 'native',
    catalog: 'none',
  });
  expect(getBenchProtocolLabel('html')).toBe('HTML');
  expect(usesCatalog(html)).toBe(false);
  expect(
    createBenchGroupsFromReport({
      groups: [html],
      env: { model: 'html-model', apiKeyConfigured: false },
    }),
  ).toEqual([html]);
  expect(
    nextBenchComparisonProtocol([
      baseline,
      withBenchProtocol(baseline, 'openui'),
      withBenchProtocol(baseline, 'lynx-xml'),
    ], baseline),
  ).toBe('html');
});
