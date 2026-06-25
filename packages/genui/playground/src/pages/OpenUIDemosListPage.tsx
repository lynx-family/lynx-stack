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
import { OPENUI_SCENARIOS } from '../mock/openui-scenarios.js';
import type { Protocol } from '../utils/protocol.js';
import { buildOpenUIRenderUrl } from '../utils/renderUrl.js';

export function OpenUIDemosListPage(props: { protocol: Protocol }) {
  const { protocol } = props;
  const baseUrl = window.location.href.replace(/#.*$/, '');

  const previewUrls = useMemo(
    () =>
      new Map(
        OPENUI_SCENARIOS.map((scenario) => [
          scenario.id,
          buildOpenUIRenderUrl({
            rawText: scenario.raw,
            instant: true,
          }, baseUrl),
        ]),
      ),
    [baseUrl],
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
      resetKey={protocol.name}
    >
      <div className='examplePage'>
        <PageHeader
          className='examplePageHeader'
          titleClassName='examplePageHeaderTitle'
          descriptionClassName='examplePageHeaderDesc'
          title='OpenUI Showcase'
          description='Explore OpenUI Lang examples rendered through the Lynx preview runtime.'
          topContent={
            <span className='chip'>{OPENUI_SCENARIOS.length} examples</span>
          }
        />
        <div className='exampleColumns'>
          <section className='exampleSection'>
            <div className='exampleSectionHeader'>
              <h2 className='exampleSectionTitle'>Examples</h2>
              <span className='chip'>{OPENUI_SCENARIOS.length}</span>
            </div>
            <div className='exampleGrid exampleGridFlow'>
              {OPENUI_SCENARIOS.map((scenario) => (
                <ExamplePreviewCard
                  key={scenario.id}
                  scenario={scenario}
                  previewUrl={previewUrls.get(scenario.id)}
                  badge={scenario.badge}
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
