// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type BenchRole = 'control' | 'experiment';
export type BenchProtocol = 'a2ui' | 'openui' | 'lynx-xml' | 'html';
export type BenchProfile = 'matched-core' | 'native';
export type BenchVariable =
  | 'catalog'
  | 'custom'
  | 'model'
  | 'prompt'
  | 'protocol';
export type BenchComparisonDirection = Extract<
  BenchVariable,
  'model' | 'prompt' | 'protocol'
>;
export interface BenchGroup {
  enableHtmlFragment?: boolean;
  catalog: string;
  enabled: boolean;
  extraInstruction: string;
  id: string;
  model: string;
  name: string;
  profile: BenchProfile;
  protocol: BenchProtocol;
  role: BenchRole;
  variable: BenchVariable;
}

export interface BenchScenario {
  action: string;
  complexity: number;
  id: string;
  name: string;
  prompt: string;
  type: string;
}

export type BenchPreset =
  | 'protocol'
  | 'model'
  | 'prompt'
  | 'catalog'
  | 'platform';

export const BENCH_PRESET_OPTIONS = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'model', label: 'Model' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'catalog', label: 'Catalog' },
  { value: 'platform', label: 'Platform' },
] as const;

export const BENCH_PROTOCOL_OPTIONS = [
  { value: 'a2ui', label: 'A2UI', description: 'Structured message stream' },
  { value: 'openui', label: 'OpenUI', description: 'OpenUI Lang' },
  {
    value: 'lynx-xml',
    label: 'Lynx XML',
    description: 'Self-contained Lynx XML page',
  },
  { value: 'html', label: 'HTML', description: 'Self-contained HTML page' },
] as const;

export function isDocumentBenchProtocol(protocol: BenchProtocol): boolean {
  return protocol === 'lynx-xml' || protocol === 'html';
}

export function getBenchProtocolLabel(
  protocol: BenchProtocol = 'a2ui',
): string {
  return BENCH_PROTOCOL_OPTIONS.find((option) => option.value === protocol)
    ?.label ?? protocol;
}

export function withBenchProtocol(
  group: BenchGroup,
  protocol: BenchProtocol,
): BenchGroup {
  if (protocol === 'a2ui') {
    return group.protocol === 'a2ui'
      ? group
      : { ...group, protocol, profile: 'native', catalog: 'Full Catalog' };
  }
  let profile = group.profile;
  if (protocol === 'openui') profile = 'matched-core';
  if (isDocumentBenchProtocol(protocol)) profile = 'native';
  let catalog = group.catalog === 'none' ? 'Full Catalog' : group.catalog;
  if (profile === 'matched-core') catalog = 'Core Catalog';
  if (isDocumentBenchProtocol(protocol)) catalog = 'none';
  return {
    ...group,
    protocol,
    profile,
    catalog,
    ...(protocol === 'lynx-xml'
      ? { enableHtmlFragment: group.enableHtmlFragment === true }
      : {}),
  };
}

export function nextBenchComparisonProtocol(
  groups: readonly BenchGroup[],
  baseline: BenchGroup,
): BenchProtocol {
  return BENCH_PROTOCOL_OPTIONS.find((option) =>
    !groups.some((group) => group.protocol === option.value)
  )?.value
    ?? BENCH_PROTOCOL_OPTIONS.find((option) =>
      option.value !== baseline.protocol
    )!.value;
}

export interface BenchSettings {
  collectLiveRenderMetrics: boolean;
  judgeEnabled: boolean;
  repairEnabled: boolean;
  repeats: number;
  uiJudgeModel?: string;
}

export const BENCH_CATALOG_OPTIONS = [
  'Full Catalog',
  'Core Catalog',
  'Minimal Catalog',
] as const;

export const DEFAULT_BENCH_SETTINGS: Readonly<BenchSettings> = {
  repeats: 2,
  repairEnabled: true,
  judgeEnabled: true,
  collectLiveRenderMetrics: true,
};

// Keep this aligned with the server's Bench request limit.
export const MAX_BENCH_GROUPS = 8;

export const DEFAULT_BENCH_SCENARIOS: readonly BenchScenario[] = [
  {
    id: 'weather-refresh',
    name: 'Weather Refresh Card',
    prompt:
      'A Hangzhou weather UI with current weather, 24 C, humidity, wind, short forecast, and Refresh action.',
    type: 'Information',
    complexity: 0.86,
    action: 'Refresh',
  },
  {
    id: 'product-purchase',
    name: 'Product Purchase Card',
    prompt:
      'A product purchase UI for AeroPulse Runner with image, price, rating, size choices, delivery, and Buy Now action.',
    type: 'Commerce',
    complexity: 1.08,
    action: 'Buy Now',
  },
  {
    id: 'kyoto-trip',
    name: 'Kyoto Trip Planner',
    prompt:
      'A 48-hour Kyoto itinerary UI with two day sections, timed stops, budget summary, and Save Plan action.',
    type: 'Long content',
    complexity: 1.36,
    action: 'Save Plan',
  },
];

export function createDefaultBenchGroups(model: string): BenchGroup[] {
  return [
    {
      id: 'a2ui-default',
      role: 'control',
      protocol: 'a2ui',
      profile: 'native',
      name: 'Group-A2UI',
      variable: 'custom',
      model,
      catalog: 'Full Catalog',
      extraInstruction: '',
      enabled: true,
    },
    {
      id: 'openui-default',
      role: 'experiment',
      protocol: 'openui',
      profile: 'native',
      name: 'Group-OpenUI',
      variable: 'custom',
      model,
      catalog: 'none',
      extraInstruction: '',
      enabled: true,
    },
    {
      id: 'lynx-xml-default',
      role: 'experiment',
      protocol: 'lynx-xml',
      profile: 'native',
      name: 'Group-Lynx XML',
      variable: 'custom',
      model,
      catalog: 'none',
      extraInstruction: '',
      enabled: true,
    },
    {
      id: 'html-default',
      role: 'experiment',
      protocol: 'html',
      profile: 'native',
      name: 'Group-HTML',
      variable: 'custom',
      model,
      catalog: 'none',
      extraInstruction: '',
      enabled: true,
    },
  ];
}

export function createBenchPresetGroups(
  preset: BenchPreset,
  model: string,
  models: readonly string[] = [],
): BenchGroup[] {
  const base = createDefaultBenchGroups(model)[0]!;
  const group = (name: string, patch: Partial<BenchGroup>): BenchGroup => ({
    ...base,
    ...patch,
    id: `preset-${name.toLowerCase().replaceAll(' ', '-')}`,
    name: `Group-${name}`,
  });
  switch (preset) {
    case 'protocol':
      return [
        group('A2UI', { role: 'control', variable: 'protocol' }),
        group('OpenUI', {
          protocol: 'openui',
          profile: 'matched-core',
          catalog: 'Core Catalog',
          role: 'experiment',
          variable: 'protocol',
        }),
        group('Lynx XML', {
          protocol: 'lynx-xml',
          catalog: 'none',
          role: 'experiment',
          variable: 'protocol',
        }),
      ];
    case 'model':
      return (models.length > 0 ? models : [model]).slice(0, 3).map((
        item,
        index,
      ) =>
        group(item, {
          id: `preset-model-${index + 1}`,
          model: item,
          role: index === 0 ? 'control' : 'experiment',
          variable: 'model',
        })
      );
    case 'prompt':
      return [
        group('Base', { role: 'control', variable: 'prompt' }),
        group('Concise', {
          role: 'experiment',
          variable: 'prompt',
          extraInstruction:
            'Use concise copy and minimize unnecessary UI structure while preserving the requested content and interaction.',
        }),
        group('Detailed', {
          role: 'experiment',
          variable: 'prompt',
          extraInstruction:
            'Include helpful details, clear hierarchy, and polished interaction guidance.',
        }),
      ];
    case 'catalog':
      return ['Full Catalog', 'Core Catalog', 'Minimal Catalog'].map((
        catalog,
        index,
      ) =>
        group(catalog, {
          id: `preset-catalog-${index + 1}`,
          catalog,
          role: index === 0 ? 'control' : 'experiment',
          variable: 'catalog',
        })
      );
    case 'platform':
      return [
        group('HTML', {
          protocol: 'html',
          catalog: 'none',
          role: 'control',
          variable: 'protocol',
        }),
        group('Lynx XML', {
          protocol: 'lynx-xml',
          catalog: 'none',
          role: 'experiment',
          variable: 'protocol',
        }),
      ];
  }
}

export function createCustomBenchScenario(id: string): BenchScenario {
  return {
    id,
    name: 'Custom scenario',
    prompt: 'Describe the UI to generate and evaluate.',
    type: 'Custom',
    complexity: 1,
    action: 'Primary action',
  };
}

export function usesCatalog(group: BenchGroup): boolean {
  return group.protocol === 'a2ui' && group.profile === 'native';
}

function getBaselineCompatibilityScore(
  candidate: BenchGroup,
  group: BenchGroup,
): number {
  const catalogMatches = usesCatalog(candidate) && usesCatalog(group)
    && candidate.catalog === group.catalog;
  return Number(candidate.profile === group.profile) * 8
    + Number(candidate.model === group.model) * 4
    + Number(candidate.protocol === group.protocol) * 2
    + Number(catalogMatches);
}

export function findComparableBaseline(
  group: BenchGroup,
  groups: readonly BenchGroup[],
): BenchGroup | undefined {
  if (group.role === 'control') return group;

  const controls = groups.filter((candidate) =>
    candidate.role === 'control' && candidate.id !== group.id
  );
  return controls.sort((left, right) => {
    return getBaselineCompatibilityScore(right, group)
      - getBaselineCompatibilityScore(left, group);
  })[0];
}

export function getBenchGroupDifferences(
  group: BenchGroup,
  baseline: BenchGroup | undefined,
): string[] {
  if (!baseline || group.id === baseline.id) return [];

  const differences: string[] = [];
  if (group.protocol !== baseline.protocol) differences.push('Protocol');
  if (group.profile !== baseline.profile) differences.push('Profile');
  if (group.model !== baseline.model) differences.push('Model');
  if (
    group.protocol === 'lynx-xml' && baseline.protocol === 'lynx-xml'
    && (group.enableHtmlFragment === true)
      !== (baseline.enableHtmlFragment === true)
  ) {
    differences.push('XML fragment');
  }
  if (
    usesCatalog(group) && usesCatalog(baseline)
    && group.catalog !== baseline.catalog
  ) {
    differences.push('Catalog');
  }
  if (group.extraInstruction !== baseline.extraInstruction) {
    differences.push('Prompt');
  }
  return differences;
}

export function inferBenchVariable(
  group: BenchGroup,
  baseline: BenchGroup | undefined,
): BenchVariable {
  const differences = getBenchGroupDifferences(group, baseline);
  if (differences.length !== 1) return 'custom';
  const [difference] = differences;
  if (difference === 'Protocol') return 'protocol';
  if (difference === 'Model') return 'model';
  if (difference === 'Catalog') return 'catalog';
  if (difference === 'Prompt') return 'prompt';
  return 'custom';
}
