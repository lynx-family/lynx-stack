// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';

import './DemosPage.css';

import {
  EXAMPLE_PREVIEW_MAX_CONCURRENT,
  ExamplePreviewCard,
  ExamplePreviewQueueProvider,
} from '../components/ExamplePreviewCard.js';
import { PageHeader } from '../components/PageHeader.js';
import {
  DYNAMIC_PRESETS,
  EXTENDED_STATIC_DEMOS,
  OFFICIAL_STATIC_DEMOS,
  STATIC_DEMO_JSON_IDS,
  Z_STATIC_DEMOS,
} from '../demos.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface ExampleScenario {
  id: string;
  title: string;
  tags: string[];
  messages: unknown;
}

const EXTENDED_EXAMPLES: ExampleScenario[] = [...EXTENDED_STATIC_DEMOS];
const Z_EXAMPLES: ExampleScenario[] = [...Z_STATIC_DEMOS];
const OFFICIAL_EXAMPLES: ExampleScenario[] = [...OFFICIAL_STATIC_DEMOS];
const DYNAMIC_EXAMPLES: ExampleScenario[] = [...DYNAMIC_PRESETS];
const ALL_EXAMPLES: ExampleScenario[] = [
  ...EXTENDED_EXAMPLES,
  ...OFFICIAL_EXAMPLES,
  ...Z_EXAMPLES,
  ...DYNAMIC_EXAMPLES,
];

export function DemosListPage(
  props: { protocol: Protocol; theme: 'light' | 'dark' },
) {
  const { protocol, theme } = props;
  const baseUrl = window.location.href.replace(/#.*$/, '');

  const previewUrls = useMemo(
    () =>
      new Map(
        ALL_EXAMPLES.map((scenario) => [
          scenario.id,
          buildRenderUrl(
            {
              protocol,
              demoUrl: DEFAULT_A2UI_DEMO_URL,
              messages: scenario.messages,
              theme,
              demoId: STATIC_DEMO_JSON_IDS.has(scenario.id)
                ? scenario.id
                : undefined,
              instant: true,
            },
            baseUrl,
          ),
        ]),
      ),
    [baseUrl, protocol, theme],
  );

  const handleOpenExample = useCallback(
    (id: string) => {
      window.location.hash = `#/${protocol.name}/examples/${id}`;
    },
    [protocol.name],
  );

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, id: string) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleOpenExample(id);
    },
    [handleOpenExample],
  );

  return (
    <ExamplePreviewQueueProvider
      maxConcurrent={EXAMPLE_PREVIEW_MAX_CONCURRENT}
      resetKey={`${protocol.name}|${theme}`}
    >
      <div className='examplePage'>
        <PageHeader
          className='examplePageHeader'
          titleClassName='examplePageHeaderTitle'
          descriptionClassName='examplePageHeaderDesc'
          title='Showcase'
          description='Browse playground examples and the curated A2UI gallery in one place. Click any card to jump into the full detail workspace.'
          topContent={
            <span className='chip'>{ALL_EXAMPLES.length} examples</span>
          }
        />
        <div className='exampleColumns'>
          <section className='exampleSection'>
            <div className='exampleSectionHeader'>
              <h2 className='exampleSectionTitle'>Playground Examples</h2>
              <span className='chip'>{EXTENDED_EXAMPLES.length}</span>
            </div>
            <div className='exampleGrid exampleGridFlow'>
              {EXTENDED_EXAMPLES.map((scenario) => (
                <ExamplePreviewCard
                  key={scenario.id}
                  scenario={scenario}
                  previewUrl={previewUrls.get(scenario.id)}
                  onOpen={handleOpenExample}
                  onKeyDown={handleCardKeyDown}
                />
              ))}
            </div>
          </section>
          <section className='exampleSection'>
            <div className='exampleSectionHeader'>
              <a
                className='exampleSectionTitleLink'
                href='https://a2ui-composer.ag-ui.com/gallery'
                target='_blank'
                rel='noreferrer'
              >
                A2UI Gallery
              </a>
              <span className='chip'>{OFFICIAL_EXAMPLES.length}</span>
            </div>
            <div className='exampleGrid'>
              {OFFICIAL_EXAMPLES.map((scenario) => (
                <ExamplePreviewCard
                  key={scenario.id}
                  scenario={scenario}
                  previewUrl={previewUrls.get(scenario.id)}
                  badge='From A2UI Gallery'
                  onOpen={handleOpenExample}
                  onKeyDown={handleCardKeyDown}
                />
              ))}
            </div>
          </section>
          <section className='exampleSection'>
            <div className='exampleSectionHeader'>
              <h2 className='exampleSectionTitle'>z</h2>
              <span className='chip'>{Z_EXAMPLES.length}</span>
            </div>
            <div className='exampleGrid'>
              {Z_EXAMPLES.map((scenario) => (
                <ExamplePreviewCard
                  key={scenario.id}
                  scenario={scenario}
                  previewUrl={previewUrls.get(scenario.id)}
                  badge='z 0.0.35'
                  onOpen={handleOpenExample}
                  onKeyDown={handleCardKeyDown}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </ExamplePreviewQueueProvider>
  );
}
