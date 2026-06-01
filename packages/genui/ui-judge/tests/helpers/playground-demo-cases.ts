// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface PlaygroundDemoCase {
  demoId: string;
  expectedText: string;
  readyText: string;
  task: string;
}

export const PLAYGROUND_DEMO_CASES: PlaygroundDemoCase[] = [
  {
    demoId: 'recs',
    readyText: 'Recommendations: Date-Night Dining Ideas',
    expectedText: 'Sea Breeze Kitchen',
    task:
      'The A2UI playground preview should show date-night dining recommendations for Moonlight Terrace, Pinewood Bistro, and Sea Breeze Kitchen.',
  },
  {
    demoId: 'cast-grid',
    readyText: 'AI generated answer',
    expectedText: 'Zhou Ning',
    task:
      'The A2UI playground preview should show a cast grid for the short film Night Notes, including Lin Xia and Zhou Ning cast cards.',
  },
  {
    demoId: 'citywalk-list',
    readyText: 'AI Answer: Weekend Citywalk Coffee Picks',
    expectedText: 'Late Sun Roastery',
    task:
      'The A2UI playground preview should show weekend citywalk coffee picks with Rooftop Brew Room, Corner Canvas Lab, and Late Sun Roastery.',
  },
  {
    demoId: 'fridge-search',
    readyText: 'Refrigerators',
    expectedText: 'Midea 550L Frost-Free French-Door Fridge',
    task:
      'The A2UI playground preview should show refrigerator search results with Siemens, Hualing, Haier, and Midea product cards.',
  },
  {
    demoId: 'trip-planner',
    readyText: 'Trip Planner: Kyoto in 48 Hours',
    expectedText: 'Monkey Park Viewpoint',
    task:
      'The A2UI playground preview should show a Kyoto 48-hour trip planner with Day 1 and Day 2 itinerary sections, including Monkey Park Viewpoint.',
  },
  {
    demoId: 'weather-current',
    readyText: 'Austin, TX',
    expectedText: 'Clear skies with light breeze',
    task:
      'The A2UI playground preview should show the current weather for Austin, TX, including clear skies with light breeze.',
  },
  {
    demoId: 'product-card',
    readyText: 'Wireless Headphones Pro',
    expectedText: 'Add to Cart',
    task:
      'The A2UI playground preview should show a Wireless Headphones Pro product card with a visible Add to Cart action.',
  },
  {
    demoId: 'workout-plan',
    readyText: 'Weekly Workout Plan',
    expectedText: 'Friday',
    task:
      'The A2UI playground preview should show a weekly workout plan with five days from Monday Ramp-Up through Friday Conditioning.',
  },
];

export const ANDROID_PLAYGROUND_DEMO_CASES: PlaygroundDemoCase[] = [
  'product-card',
  'weather-current',
  'trip-planner',
].map((demoId) => {
  const demo = PLAYGROUND_DEMO_CASES.find((candidate) =>
    candidate.demoId === demoId
  );
  if (!demo) {
    throw new Error(`Missing playground demo case: ${demoId}`);
  }
  return demo;
});
