// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { normalizeBenchJobRequest } from '../service/common/bench/request.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

function body(groups: unknown[]) {
  return {
    provider: {},
    playground: { browserScreenshots: true },
    settings: {
      repeats: 1,
      parallelism: 3,
      maxRepairAttempts: 1,
    },
    groups,
    scenarios: [{
      id: 'scenario',
      name: 'Scenario',
      prompt: 'Build a card',
      type: 'Information',
    }],
  };
}

describe('A2UI Bench request protocol groups', () => {
  test.each([undefined, false, true])(
    'normalizes fragment conversion with default off: %s',
    (enabled) => {
      const result = normalizeBenchJobRequest(
        body([{
          id: 'xml',
          protocol: 'lynx-xml',
          enableHtmlFragment: enabled,
        }]),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.request.groups[0]?.enableHtmlFragment).toBe(
          enabled === true,
        );
      }
    },
  );
  test('rejects non-boolean fragment selection', () => {
    expect(
      normalizeBenchJobRequest(
        body([{
          id: 'xml',
          protocol: 'lynx-xml',
          enableHtmlFragment: 'false',
        }]),
      ),
    ).toMatchObject({ ok: false, status: 400 });
  });
  test('accepts Lynx XML native alongside both component protocols', () => {
    const normalized = normalizeBenchJobRequest(body(
      ['a2ui', 'openui', 'lynx-xml'].map((protocol) => ({
        id: protocol,
        protocol,
        catalog: 'Core Catalog',
        enabled: true,
      })),
    ));
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(
      normalized.request.groups.map((group) => [group.protocol, group.profile]),
    ).toEqual([
      ['a2ui', 'native'],
      ['openui', 'matched-core'],
      ['lynx-xml', 'native'],
    ]);
    expect(normalized.request.groups[2]).not.toHaveProperty('catalog');
    expect(normalized.request.settings.parallelism).toBe(1);
  });

  test('rejects a matched-core profile for Lynx XML', () => {
    expect(normalizeBenchJobRequest(body([{
      id: 'xml',
      protocol: 'lynx-xml',
      profile: 'matched-core',
    }]))).toMatchObject({
      ok: false,
      status: 400,
      error: 'lynx-xml groups require the "native" profile',
    });
  });

  test('keeps legacy groups on the A2UI native profile', () => {
    const normalized = normalizeBenchJobRequest(
      body([{
        id: 'legacy',
        role: 'control',
        name: 'Legacy',
        variable: 'catalog',
        enabled: true,
        catalog: 'Core Catalog',
      }]),
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.request.groups[0]).toMatchObject({
      protocol: 'a2ui',
      profile: 'native',
      catalog: 'Core Catalog',
    });
  });

  test('drops group models that are not configured by the server', () => {
    const normalized = normalizeBenchJobRequest(
      body([
        {
          id: 'a2ui',
          role: 'control',
          name: 'A2UI',
          variable: 'protocol',
          enabled: true,
          protocol: 'a2ui',
          profile: 'matched-core',
          model: 'model-a',
        },
        {
          id: 'openui',
          role: 'experiment',
          name: 'OpenUI',
          variable: 'protocol',
          enabled: true,
          protocol: 'openui',
          model: 'model-b',
        },
      ]),
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.request.groups).toEqual([
      expect.objectContaining({
        protocol: 'a2ui',
        profile: 'matched-core',
        variable: 'protocol',
      }),
      expect.objectContaining({
        protocol: 'openui',
        profile: 'matched-core',
        variable: 'protocol',
      }),
    ]);
    expect(normalized.request.groups[0]).not.toHaveProperty('model');
    expect(normalized.request.groups[1]).not.toHaveProperty('model');
    expect(normalized.request.groups[0]).not.toHaveProperty('catalog');
    expect(normalized.request.groups[1]).not.toHaveProperty('catalog');
    expect(normalized.request.settings.parallelism).toBe(1);
    expect(normalized.warnings).toContain(
      'Mixed-protocol jobs run one sample at a time so benchmark arms remain paired; settings.parallelism was set to 1.',
    );
  });

  test('ignores custom provider settings and unconfigured group models', () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify({
      'Configured Model': {
        apiKey: 'server-secret',
        baseURL: 'https://server.example.com/v1',
        model: 'server-model',
      },
    });
    try {
      const normalized = normalizeBenchJobRequest(
        {
          ...body([
            {
              id: 'configured',
              name: 'Configured',
              enabled: true,
              model: 'Configured Model',
            },
            {
              id: 'unconfigured',
              name: 'Unconfigured',
              enabled: true,
              model: 'attacker-model',
            },
          ]),
          provider: {
            apiKey: 'client-secret',
            baseURL: 'https://openrouter.ai/api/v1',
            model: 'Configured Model',
            api: 'chat',
          },
        },
      );

      expect(normalized.ok).toBe(true);
      if (!normalized.ok) return;
      expect(normalized.request.provider).toEqual({
        model: 'Configured Model',
      });
      expect(normalized.request.groups[0]).toMatchObject({
        model: 'Configured Model',
      });
      expect(normalized.request.groups[1]).not.toHaveProperty('model');
      expect(normalized.warnings).toContain(
        'Custom provider settings are unsupported for Bench; using only server-configured model selections.',
      );
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('rejects an unsupported OpenUI native arm', () => {
    const normalized = normalizeBenchJobRequest(
      body([{
        id: 'openui-native',
        role: 'experiment',
        name: 'OpenUI native',
        variable: 'protocol',
        enabled: true,
        protocol: 'openui',
        profile: 'native',
      }]),
    );

    expect(normalized).toEqual({
      ok: false,
      status: 400,
      error: 'openui groups require the "matched-core" profile',
    });
  });

  test('bounds adapter attempts without changing legacy A2UI admission', () => {
    const legacy = body([{
      id: 'legacy',
      role: 'control',
      name: 'Legacy',
      variable: 'custom',
      enabled: true,
    }]);
    legacy.settings.repeats = 10;
    legacy.settings.maxRepairAttempts = 4;
    legacy.scenarios = Array.from({ length: 3 }, (_, index) => ({
      id: `scenario-${index}`,
      name: `Scenario ${index}`,
      prompt: 'Build a card',
      type: 'Information',
    }));

    const legacyResult = normalizeBenchJobRequest(legacy);
    expect(legacyResult.ok).toBe(true);

    const judgedLegacy = {
      ...legacy,
      settings: {
        ...legacy.settings,
        judgeEnabled: true,
      },
    };
    expect(normalizeBenchJobRequest(judgedLegacy)).toEqual({
      ok: false,
      status: 422,
      error:
        'benchmark workload exceeds the 120 planned generation-attempt limit',
    });

    const matched = {
      ...legacy,
      groups: [{
        id: 'matched',
        role: 'control',
        name: 'Matched',
        variable: 'protocol',
        enabled: true,
        protocol: 'a2ui',
        profile: 'matched-core',
      }],
    };
    expect(normalizeBenchJobRequest(matched)).toEqual({
      ok: false,
      status: 422,
      error:
        'benchmark workload exceeds the 120 planned generation-attempt limit',
    });
  });

  test('drops legacy screenshot URLs from server job configuration', () => {
    const normalized = normalizeBenchJobRequest(
      {
        ...body([{
          id: 'group',
          name: 'Group',
          enabled: true,
        }]),
        playground: {
          baseUrl: 'https://playground.example/',
          browserScreenshots: true,
          uiJudgeServerUrl: 'http://judge.test/internal?token=ignored#health',
        },
      },
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.request.playground).toEqual({
      baseUrl: 'https://playground.example/',
      browserScreenshots: true,
    });
  });

  test('requires a browser screenshot client when Judge is enabled', () => {
    expect(normalizeBenchJobRequest(
      {
        ...body([{
          id: 'group',
          name: 'Group',
          enabled: true,
        }]),
        settings: { judgeEnabled: true },
        playground: {
          uiJudgeServerUrl: 'file:///tmp/ui-judge.sock',
        },
      },
    )).toEqual({
      ok: false,
      status: 400,
      error:
        'UI Judge requires a browser screenshot client. Start this Bench from the Playground.',
    });
  });
});
