// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import castGrid from './mock/messages/cast-grid.json';
import citywalkList from './mock/messages/citywalk-list.json';
import fridgeSearch from './mock/messages/fridge-search.json';
import recs from './mock/messages/recs.json';
import tripPlanner from './mock/messages/trip-planner.json';
import workoutPlan from './mock/messages/workout-plan.json';

function collectComponentNamesFromMessages(
  value: unknown,
  out: Set<string>,
): void {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectComponentNamesFromMessages(item, out);
    }
    return;
  }

  if (typeof value !== 'object') return;

  const v = value as Record<string, unknown>;

  // Standard v0.9 message: { updateComponents: { components: [...] } }
  const updateComponents = v.updateComponents;
  if (updateComponents && typeof updateComponents === 'object') {
    const uc = updateComponents as Record<string, unknown>;
    const components = uc.components;
    if (Array.isArray(components)) {
      for (const c of components) {
        if (!c || typeof c !== 'object') continue;
        const comp = (c as Record<string, unknown>).component;
        if (typeof comp === 'string' && comp.trim() !== '') {
          out.add(comp);
        }
      }
    }
  }

  // Be resilient to wrapper shapes like { messages: [...] }.
  if (Array.isArray(v.messages)) {
    collectComponentNamesFromMessages(v.messages, out);
  }
}

function tagsFromMessages(messages: unknown): string[] {
  const out = new Set<string>();
  collectComponentNamesFromMessages(messages, out);
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

export interface StaticDemo {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  messages: unknown;
}

export interface DynamicPreset {
  id: string;
  title: string;
  tags: string[];
  messages: unknown;
  actionMocks?: Record<string, unknown>;
}

export const STATIC_DEMOS: StaticDemo[] = [
  {
    id: 'recs',
    title: 'Date-Night Restaurant Picks',
    description:
      'Three restaurant cards with images. Content updates progressively.',
    tags: tagsFromMessages(recs),
    messages: recs,
  },
  {
    id: 'cast-grid',
    title: 'Cast Grid Layout Demo',
    tags: tagsFromMessages(castGrid),
    messages: castGrid,
  },
  {
    id: 'citywalk-list',
    title: 'Weekend Citywalk Coffee Picks',
    tags: tagsFromMessages(citywalkList),
    messages: citywalkList,
  },
  {
    id: 'fridge-search',
    title: 'Fridge Search Results',
    tags: tagsFromMessages(fridgeSearch),
    messages: fridgeSearch,
  },
  {
    id: 'trip-planner',
    title: 'Trip Planner: Kyoto in 48 Hours',
    description:
      'A two-day itinerary streams in card by card, with each stop filled progressively.',
    tags: tagsFromMessages(tripPlanner),
    messages: tripPlanner,
  },
  {
    id: 'workout-plan',
    title: 'Weekly Workout Plan',
    description:
      'A five-day workout plan is assembled day by day through data-model updates with a shared list template.',
    tags: tagsFromMessages(workoutPlan),
    messages: workoutPlan,
  },
];

export const DYNAMIC_PRESETS: DynamicPreset[] = [];

export const SUPPORTED_COMPONENTS = tagsFromMessages([
  ...STATIC_DEMOS.flatMap((d) => d.messages as unknown[]),
  ...DYNAMIC_PRESETS.flatMap((d) => d.messages as unknown[]),
]);
