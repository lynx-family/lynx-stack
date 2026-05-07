// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BuildA2UIPromptOptions } from './types.js';

interface PromptExample {
  id: string;
  title: string;
  keywords: string[];
  userRequest: string;
  outputJson: string;
}

const SAFE_DEFAULT_SURFACE_ID = 'default';
const SAFE_DEFAULT_CATALOG_ID = 'demo-streaming';
const SAFE_LIST_CATALOG_ID = 'demo-streaming-list';

const PREFERRED_COMPONENTS = [
  'Column',
  'Row',
  'Card',
  'Text',
  'Image',
  'Divider',
  'List',
];

const PROMPT_EXAMPLES: PromptExample[] = [
  {
    id: 'product-card',
    title: 'Simple product card',
    keywords: ['product', 'card', 'price', 'shop', 'sku', 'item'],
    userRequest:
      'Create a simple product card with a title, short description, and price.',
    outputJson: JSON.stringify(
      {
        messages: [
          {
            createSurface: {
              surfaceId: SAFE_DEFAULT_SURFACE_ID,
              catalogId: SAFE_DEFAULT_CATALOG_ID,
            },
          },
          {
            updateComponents: {
              surfaceId: SAFE_DEFAULT_SURFACE_ID,
              components: [
                {
                  id: 'root',
                  component: 'Column',
                  align: 'stretch',
                  children: ['product-card'],
                },
                {
                  id: 'product-card',
                  component: 'Card',
                  child: 'product-card-body',
                },
                {
                  id: 'product-card-body',
                  component: 'Column',
                  align: 'stretch',
                  children: ['product-title', 'product-desc', 'product-price'],
                },
                {
                  id: 'product-title',
                  component: 'Text',
                  variant: 'h3',
                  text: 'iPhone 16 Pro Max',
                },
                {
                  id: 'product-desc',
                  component: 'Text',
                  variant: 'body',
                  text:
                    'Powered by the A18 Pro chip with a titanium design, Apple Intelligence support, an advanced triple-camera system, and improved all-day battery life.',
                },
                {
                  id: 'product-price',
                  component: 'Text',
                  variant: 'h4',
                  text: 'From ¥9,999',
                },
              ],
            },
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    id: 'citywalk-list',
    title: 'Streaming citywalk list',
    keywords: ['list', 'coffee', 'cafe', 'travel', 'citywalk', 'trip'],
    userRequest:
      'Create a vertical recommendation list with a heading, summary text, and repeated cards for places.',
    outputJson: JSON.stringify(
      {
        messages: [
          {
            createSurface: {
              surfaceId: SAFE_DEFAULT_SURFACE_ID,
              catalogId: SAFE_LIST_CATALOG_ID,
            },
          },
          {
            updateComponents: {
              surfaceId: SAFE_DEFAULT_SURFACE_ID,
              components: [
                {
                  id: 'root',
                  component: 'Column',
                  children: ['header', 'summary', 'divider', 'spots-list'],
                },
                {
                  id: 'header',
                  component: 'Text',
                  variant: 'h2',
                  text: 'Weekend Coffee Picks',
                },
                {
                  id: 'summary',
                  component: 'Text',
                  variant: 'body',
                  text:
                    'Three places presented as a vertical list with image, title, meta, and reason.',
                },
                {
                  id: 'divider',
                  component: 'Divider',
                  axis: 'horizontal',
                },
                {
                  id: 'spots-list',
                  component: 'List',
                  direction: 'vertical',
                  children: {
                    path: '/spots',
                    componentId: 'spot-card',
                  },
                },
                {
                  id: 'spot-card',
                  component: 'Card',
                  child: 'spot-card-body',
                },
                {
                  id: 'spot-card-body',
                  component: 'Column',
                  children: [
                    'spot-image',
                    'spot-title',
                    'spot-meta',
                    'spot-reason',
                  ],
                },
                {
                  id: 'spot-image',
                  component: 'Image',
                  url: {
                    path: 'cover',
                  },
                },
                {
                  id: 'spot-title',
                  component: 'Text',
                  variant: 'h4',
                  text: {
                    path: 'name',
                  },
                },
                {
                  id: 'spot-meta',
                  component: 'Text',
                  variant: 'caption',
                  text: {
                    path: 'meta',
                  },
                },
                {
                  id: 'spot-reason',
                  component: 'Text',
                  variant: 'body',
                  text: {
                    path: 'reason',
                  },
                },
              ],
            },
          },
        ],
      },
      null,
      2,
    ),
  },
];

function scoreExample(example: PromptExample, lowerCaseText: string): number {
  return example.keywords.reduce(
    (score, keyword) => score + (lowerCaseText.includes(keyword) ? 1 : 0),
    0,
  );
}

function pickExamples(userText: string): PromptExample[] {
  const lowerCaseText = userText.toLowerCase();
  const ranked = PROMPT_EXAMPLES
    .map((example) => ({
      example,
      score: scoreExample(example, lowerCaseText),
    }))
    .sort((left, right) => right.score - left.score);

  const matched = ranked.filter((item) => item.score > 0).map((item) =>
    item.example
  );
  if (matched.length >= 2) {
    return matched.slice(0, 2);
  }

  const defaults = ranked
    .map((item) => item.example)
    .filter((example) => !matched.includes(example));
  return [...matched, ...defaults].slice(0, 2);
}

function buildExamplesSection(examples: PromptExample[]): string {
  return examples
    .map(
      (example, index) =>
        [
          `Example ${index + 1}: ${example.title}`,
          `User request: ${example.userRequest}`,
          'Valid output:',
          example.outputJson,
        ].join('\n'),
    )
    .join('\n\n');
}

export function buildA2UIPrompt(options: BuildA2UIPromptOptions): string {
  const examples = pickExamples(options.userText);

  return [
    'You are an A2UI generation assistant for the a2ui-playground.',
    'Convert the user request into valid A2UI JSON that can be rendered directly by the local preview runtime.',
    '',
    'Output requirements:',
    '1. Return valid JSON only. Do not add markdown fences. Do not add explanations before or after the JSON.',
    '2. The top-level shape must be an object with a "messages" array. You may optionally include "actionMocks".',
    `3. Always create the surface first. Use "surfaceId": "${SAFE_DEFAULT_SURFACE_ID}".`,
    `4. Use "${SAFE_DEFAULT_CATALOG_ID}" as the default "catalogId". Use "${SAFE_LIST_CATALOG_ID}" only when the request clearly needs a data-driven list with path-based child bindings.`,
    '5. Prefer simple, stable layouts over overly complex nesting.',
    `6. Prefer components that already appear in the playground demos: ${
      PREFERRED_COMPONENTS.join(', ')
    }.`,
    '7. Use deterministic component ids and keep the structure renderable.',
    '8. Match the user-requested language for visible text. If the request does not specify a language, prefer English.',
    '',
    'A2UI protocol guidance:',
    '- Use operations like createSurface and updateComponents.',
    '- For simple static UIs, return a minimal two-message structure: createSurface + updateComponents.',
    '- For list-style UIs, prefer List with data bindings such as { "path": "..." } only when they help the requested UI.',
    '- Do not invent unsupported wrapper fields outside the top-level JSON object.',
    '',
    'Few-shot examples:',
    buildExamplesSection(examples),
    '',
    'User request:',
    options.userText,
  ].join('\n');
}
