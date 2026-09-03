// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { normalizeBenchJobRequest } from '../service/a2ui-bench-request.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

function body(groups: unknown[]) {
  return {
    provider: {},
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
      { clientOverrideAccepted: false },
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.request.groups[0]).toMatchObject({
      protocol: 'a2ui',
      profile: 'native',
      catalog: 'Core Catalog',
    });
  });

  test('removes group model overrides when client overrides are disabled', () => {
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
      { clientOverrideAccepted: false },
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
    expect(normalized.warnings).toContain(
      'Client provider overrides are disabled by server policy; using server environment provider settings.',
    );
  });

  test('keeps arbitrary group models with a complete allowed provider', () => {
    const request = body([
      {
        id: 'a2ui',
        role: 'control',
        name: 'A2UI',
        variable: 'model',
        enabled: true,
        protocol: 'a2ui',
        profile: 'matched-core',
        model: 'model-a',
      },
      {
        id: 'openui',
        role: 'experiment',
        name: 'OpenUI',
        variable: 'model',
        enabled: true,
        protocol: 'openui',
        model: 'model-b',
      },
    ]);
    const normalized = normalizeBenchJobRequest(
      {
        ...request,
        provider: {
          apiKey: 'client-secret',
          baseURL: 'https://openrouter.ai/api/v1/',
          model: 'default-model',
          api: 'chat',
        },
      },
      { clientOverrideAccepted: true },
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.request.provider).toEqual({
      apiKey: 'client-secret',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'default-model',
      api: 'chat',
    });
    expect(normalized.request.groups).toEqual([
      expect.objectContaining({ model: 'model-a' }),
      expect.objectContaining({ model: 'model-b' }),
    ]);
  });

  test('drops partial provider fields and unconfigured group models', () => {
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
            baseURL: 'https://attacker.example/v1',
            model: 'Configured Model',
          },
        },
        { clientOverrideAccepted: true },
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
        'Incomplete custom provider settings were ignored; using only server-configured model selections.',
      );
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('rejects a complete provider outside the base URL allow-list', () => {
    const normalized = normalizeBenchJobRequest(
      {
        ...body([{
          id: 'group',
          name: 'Group',
          enabled: true,
        }]),
        provider: {
          apiKey: 'client-secret',
          baseURL: 'https://attacker.example/v1',
          model: 'attacker-model',
        },
      },
      { clientOverrideAccepted: true },
    );

    expect(normalized).toEqual({
      ok: false,
      status: 400,
      error:
        'Custom provider baseURL must be one of the supported provider URLs: https://api.openai.com/v1, https://generativelanguage.googleapis.com/v1beta/openai, https://openrouter.ai/api/v1',
    });
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
      { clientOverrideAccepted: true },
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

    const legacyResult = normalizeBenchJobRequest(legacy, {
      clientOverrideAccepted: false,
    });
    expect(legacyResult.ok).toBe(true);

    const judgedLegacy = {
      ...legacy,
      settings: {
        ...legacy.settings,
        judgeEnabled: true,
      },
    };
    expect(normalizeBenchJobRequest(judgedLegacy, {
      clientOverrideAccepted: false,
    })).toEqual({
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
    expect(normalizeBenchJobRequest(matched, {
      clientOverrideAccepted: false,
    })).toEqual({
      ok: false,
      status: 422,
      error:
        'benchmark workload exceeds the 120 planned generation-attempt limit',
    });
  });
});
