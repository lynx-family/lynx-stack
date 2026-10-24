// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import cameraPreferences from './openui/chat/camera-preferences.openui?raw';
import lakeComparison from './openui/chat/lake-comparison.openui?raw';
import materialComparison from './openui/chat/material-comparison.openui?raw';
import mobilePlans from './openui/chat/mobile-plans.openui?raw';
import noResults from './openui/chat/no-results.openui?raw';
import places from './openui/chat/places.openui?raw';
import productComparison from './openui/chat/product-comparison.openui?raw';
import productDetails from './openui/chat/product-details.openui?raw';
import productFeature from './openui/chat/product-feature.openui?raw';
import projectorQuestions from './openui/chat/projector-questions.openui?raw';
import quickAnswer from './openui/chat/quick-answer.openui?raw';
import shoppingBudget from './openui/chat/shopping-budget.openui?raw';
import shortPoem from './openui/chat/short-poem.openui?raw';
import sixDayTrip from './openui/chat/six-day-trip.openui?raw';
import splitBill from './openui/chat/split-bill.openui?raw';
import tripBudget from './openui/chat/trip-budget.openui?raw';
import twoDayTrip from './openui/chat/two-day-trip.openui?raw';
import weightComparison from './openui/chat/weight-comparison.openui?raw';
import { resolveOpenUIExampleAssets } from './openui-chat-assets.js';

export const OPENUI_CHAT_CASES = [
  {
    id: 'chat-quick-answer',
    title: 'Quick Answer',
    raw: quickAnswer,
    sourcePath: 'demos/openui/chat/quick-answer.openui',
  },
  {
    id: 'chat-weight-comparison',
    title: 'Weight Comparison',
    raw: weightComparison,
    sourcePath: 'demos/openui/chat/weight-comparison.openui',
  },
  {
    id: 'chat-split-bill',
    title: 'Split Bill',
    raw: splitBill,
    sourcePath: 'demos/openui/chat/split-bill.openui',
  },
  {
    id: 'chat-product-comparison',
    title: 'Product Comparison',
    raw: productComparison,
    sourcePath: 'demos/openui/chat/product-comparison.openui',
  },
  {
    id: 'chat-places',
    title: 'Places to Visit',
    raw: places,
    sourcePath: 'demos/openui/chat/places.openui',
  },
  {
    id: 'chat-two-day-trip',
    title: 'Two-day Trip',
    raw: twoDayTrip,
    sourcePath: 'demos/openui/chat/two-day-trip.openui',
  },
  {
    id: 'chat-mobile-plans',
    title: 'Mobile Plans',
    raw: mobilePlans,
    sourcePath: 'demos/openui/chat/mobile-plans.openui',
  },
  {
    id: 'chat-no-results',
    title: 'No Results',
    raw: noResults,
    sourcePath: 'demos/openui/chat/no-results.openui',
  },
  {
    id: 'chat-short-poem',
    title: 'Short Poem',
    raw: shortPoem,
    sourcePath: 'demos/openui/chat/short-poem.openui',
  },
  {
    id: 'chat-material-comparison',
    title: 'Material Comparison',
    raw: materialComparison,
    sourcePath: 'demos/openui/chat/material-comparison.openui',
  },
  {
    id: 'chat-product-details',
    title: 'Product Details',
    raw: productDetails,
    sourcePath: 'demos/openui/chat/product-details.openui',
  },
  {
    id: 'chat-lake-comparison',
    title: 'Lake Comparison',
    raw: lakeComparison,
    sourcePath: 'demos/openui/chat/lake-comparison.openui',
  },
  {
    id: 'chat-product-feature',
    title: 'Product Feature',
    raw: productFeature,
    sourcePath: 'demos/openui/chat/product-feature.openui',
  },
  {
    id: 'chat-shopping-budget',
    title: 'Shopping Budget',
    raw: shoppingBudget,
    sourcePath: 'demos/openui/chat/shopping-budget.openui',
  },
  {
    id: 'chat-camera-preferences',
    title: 'Camera Preferences',
    raw: cameraPreferences,
    sourcePath: 'demos/openui/chat/camera-preferences.openui',
  },
  {
    id: 'chat-projector-questions',
    title: 'Projector Questions',
    raw: projectorQuestions,
    sourcePath: 'demos/openui/chat/projector-questions.openui',
  },
  {
    id: 'chat-trip-budget',
    title: 'Trip Budget',
    raw: tripBudget,
    sourcePath: 'demos/openui/chat/trip-budget.openui',
  },
  {
    id: 'chat-six-day-trip',
    title: 'Six-day Trip',
    raw: sixDayTrip,
    sourcePath: 'demos/openui/chat/six-day-trip.openui',
  },
].map(scenario => ({
  ...scenario,
  library: 'chat' as const,
  badge: 'Chat',
  raw: typeof window === 'undefined'
    ? scenario.raw
    : resolveOpenUIExampleAssets(scenario.raw, window.location.href),
}));
