// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';

import './DemosPage.css';

import { PageHeader } from '../components/PageHeader.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import {
  DYNAMIC_PRESETS,
  EXTENDED_STATIC_DEMOS,
  OFFICIAL_STATIC_DEMOS,
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
const OFFICIAL_EXAMPLES: ExampleScenario[] = [...OFFICIAL_STATIC_DEMOS];
const DYNAMIC_EXAMPLES: ExampleScenario[] = [...DYNAMIC_PRESETS];
const ALL_EXAMPLES: ExampleScenario[] = [
  ...EXTENDED_EXAMPLES,
  ...OFFICIAL_EXAMPLES,
  ...DYNAMIC_EXAMPLES,
];

const STATIC_DEMO_IDS = new Set(
  [...OFFICIAL_STATIC_DEMOS, ...EXTENDED_STATIC_DEMOS].map((d) => d.id),
);

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
              demoId: STATIC_DEMO_IDS.has(scenario.id)
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
              <div
                key={scenario.id}
                className='exampleCard'
                onClick={() => handleOpenExample(scenario.id)}
                onKeyDown={(event) => handleCardKeyDown(event, scenario.id)}
                role='button'
                tabIndex={0}
              >
                <div className='exampleCardPreview'>
                  <div className='exampleCardPreviewWindow'>
                    <PreviewViewport
                      src={previewUrls.get(scenario.id)}
                      iframeTitle={`${scenario.title} preview`}
                      emptyTitle={scenario.title}
                      displayMode='full'
                    />
                  </div>
                </div>
                <div className='exampleCardBody'>
                  <div className='exampleCardTop'>
                    <div className='exampleCardTitle'>{scenario.title}</div>
                  </div>
                </div>
              </div>
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
              <div
                key={scenario.id}
                className='exampleCard'
                onClick={() => handleOpenExample(scenario.id)}
                onKeyDown={(event) => handleCardKeyDown(event, scenario.id)}
                role='button'
                tabIndex={0}
              >
                <div className='exampleCardPreview'>
                  <div className='exampleCardPreviewWindow'>
                    <PreviewViewport
                      src={previewUrls.get(scenario.id)}
                      iframeTitle={`${scenario.title} preview`}
                      emptyTitle={scenario.title}
                      displayMode='full'
                    />
                  </div>
                </div>
                <div className='exampleCardBody'>
                  <div className='exampleCardTop'>
                    <div className='exampleCardTitle'>{scenario.title}</div>
                    <span className='exampleCardBadge'>From A2UI Gallery</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
