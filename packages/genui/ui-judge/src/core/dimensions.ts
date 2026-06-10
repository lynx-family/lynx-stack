// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { UiJudgeDimension } from '../types.js';

export const DEFAULT_DIMENSION: UiJudgeDimension = 'visual-correctness';

interface JudgeDimensionPromptDefinition {
  criteria: readonly string[];
  focus: string;
  title: string;
}

export const JUDGE_DIMENSION_PROMPTS: Record<
  UiJudgeDimension,
  JudgeDimensionPromptDefinition
> = {
  'accessibility-performance': {
    title: 'Accessibility & Performance',
    focus:
      'Judge whether the UI feels inclusive, robust across screen sizes, and technically mature under real usage conditions.',
    criteria: [
      'WCAG contrast and non-color cues: text/background contrast should meet AA expectations, and important states should not rely only on color.',
      'Touch targets and responsive behavior: interactive areas should be easy to tap, and the layout should avoid overlap, truncation, or broken adaptation.',
      'Perceived performance: loading, large data, or waiting states should use skeletons, progressive loading, optimistic feedback, or other anxiety-reducing patterns when relevant.',
    ],
  },
  'architecture-writing': {
    title: 'Information Architecture & UX Writing',
    focus:
      'Judge whether users can quickly find what they need, understand where they are, and act on clear product language.',
    criteria: [
      'Wayfinding and navigation: navigation should be flat enough for the task, with clear current location, next destinations, and return paths when relevant.',
      'Microcopy: buttons, labels, and helper text should be concise, consistent, action-oriented, and free of ambiguity.',
      'Empty states: no-data, first-use, or no-result states should feel intentional and provide a useful next action instead of dead ends.',
    ],
  },
  'consistency-standards': {
    title: 'Consistency & Standards',
    focus:
      'Judge whether the UI follows expected design-system, product, and platform conventions so it lowers both implementation and learning cost.',
    criteria: [
      'Design-system fit: components, spacing, radius, color, and typography should look tokenized and reusable rather than improvised.',
      'Internal consistency: repeated components and behaviors should stay consistent across cards, lists, controls, dialogs, and modules.',
      'Platform conventions: icons, gestures, search, settings, navigation, and form behaviors should match familiar iOS, Android, or web standards for the visible context.',
    ],
  },
  'usability-interaction': {
    title: 'Usability & Interaction Logic',
    focus:
      'Judge whether the product is easy to understand, easy to operate, and resilient when users take normal actions.',
    criteria: [
      'Cognitive load: information density should be reasonable, and the page purpose should be understandable within about one second.',
      'System feedback: clicks, hover states, loading, success, and error transitions should provide immediate and clear feedback when visible in the current state.',
      'Error recovery: destructive or high-stakes actions should show confirmation, and errors should use human language with a clear recovery path when relevant.',
      'Task efficiency: the core flow should minimize unnecessary steps and use smart defaults, history, shortcuts, or direct actions for frequent tasks when appropriate.',
    ],
  },
  'visual-aesthetics': {
    title: 'Visual Communication & Aesthetics',
    focus:
      'Judge whether the interface looks professional, trustworthy, and visually comfortable while guiding attention to the right actions.',
    criteria: [
      'Visual hierarchy: the primary action and most important information should be prominent, with clear contrast in size, weight, color, and placement.',
      'Typography and whitespace: spacing should follow Gestalt proximity, related elements should group naturally, and the layout should have enough breathing room.',
      'Color semantics: brand, neutral, warning, success, and emphasis colors should be restrained, meaningful, and consistent.',
      'Graphics and icons: icon stroke, corner style, illustration quality, imagery, and decorative graphics should feel consistent and support comprehension.',
    ],
  },
  'visual-correctness': {
    title: 'Visual Correctness',
    focus:
      'Judge whether the generated UI visually satisfies the requested task and reference content.',
    criteria: [
      'Required content: the expected components, labels, data, and relationships should be present.',
      'Task fit: the visible UI should match the requested scenario rather than merely showing related generic content.',
      'Rendering quality: the page should not be blank, broken, clipped, or impossible to inspect.',
    ],
  },
};

export function getResultDimension(
  dimension: UiJudgeDimension | undefined,
): UiJudgeDimension {
  return isKnownDimension(dimension) ? dimension : DEFAULT_DIMENSION;
}

export function isKnownDimension(
  dimension: UiJudgeDimension | undefined,
): dimension is UiJudgeDimension {
  return typeof dimension === 'string'
    && Object.hasOwn(JUDGE_DIMENSION_PROMPTS, dimension);
}

export function getDimensionNames(): string[] {
  return Object.keys(JUDGE_DIMENSION_PROMPTS).sort();
}
