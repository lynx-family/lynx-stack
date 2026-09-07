// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type BenchRole = 'control' | 'experiment';
export type BenchProtocol = 'a2ui' | 'openui';
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

export interface BenchSettings {
  collectLiveRenderMetrics: boolean;
  judgeEnabled: boolean;
  parallelism: number;
  repairEnabled: boolean;
  repeats: number;
}

export const BENCH_CATALOG_OPTIONS = [
  'Full Catalog',
  'Core Catalog',
  'Minimal Catalog',
] as const;

export const DEFAULT_BENCH_SETTINGS: Readonly<BenchSettings> = {
  repeats: 3,
  parallelism: 2,
  repairEnabled: true,
  judgeEnabled: true,
  collectLiveRenderMetrics: true,
};

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
      id: 'control-empty',
      role: 'control',
      protocol: 'a2ui',
      profile: 'native',
      name: 'Baseline',
      variable: 'custom',
      model,
      catalog: 'Full Catalog',
      extraInstruction: '',
      enabled: true,
    },
  ];
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
