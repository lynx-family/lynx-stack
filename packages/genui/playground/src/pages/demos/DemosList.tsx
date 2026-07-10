// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';

import {
  EXAMPLE_PREVIEW_MAX_CONCURRENT,
  ExamplePreviewCard,
  ExamplePreviewQueueProvider,
} from '../../components/ExamplePreviewCard.js';
import type { ExamplePreviewScenario } from '../../components/ExamplePreviewCard.js';
import { PageHeader } from '../../components/PageHeader.js';
import type { Protocol } from '../../utils/protocol.js';

import './DemosPage.css';

export interface DemosListScenario extends ExamplePreviewScenario {
  badge?: string;
}

export interface DemosListSection<
  TScenario extends DemosListScenario,
> {
  id: string;
  title: string;
  titleHref?: string;
  scenarios: readonly TScenario[];
  layout?: 'columns' | 'flow';
  badge?: string;
}

interface DemosListSourceArgs {
  protocol: Protocol;
  theme: 'light' | 'dark';
}

interface CreateDemoPreviewUrlArgs<TScenario extends DemosListScenario>
  extends DemosListSourceArgs
{
  scenario: TScenario;
  baseUrl: string;
}

export interface DemosListSource<
  TScenario extends DemosListScenario,
> {
  title: string;
  description: string;
  scenarios: readonly TScenario[];
  sections: readonly DemosListSection<TScenario>[];
  createPreviewUrl: (
    args: CreateDemoPreviewUrlArgs<TScenario>,
  ) => string;
  createResetKey: (args: DemosListSourceArgs) => string;
}

export function DemosList<TScenario extends DemosListScenario>(props: {
  protocol: Protocol;
  source: DemosListSource<TScenario>;
  theme: 'light' | 'dark';
}) {
  const { protocol, source, theme } = props;
  const baseUrl = window.location.href.replace(/#.*$/u, '');

  const previewUrls = useMemo(
    () =>
      new Map(
        source.scenarios.map((scenario) => [
          scenario.id,
          source.createPreviewUrl({
            scenario,
            protocol,
            theme,
            baseUrl,
          }),
        ]),
      ),
    [baseUrl, protocol, source, theme],
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
      resetKey={source.createResetKey({ protocol, theme })}
    >
      <div className='examplePage'>
        <PageHeader
          className='examplePageHeader'
          titleClassName='examplePageHeaderTitle'
          descriptionClassName='examplePageHeaderDesc'
          title={source.title}
          description={source.description}
          topContent={
            <span className='chip'>{source.scenarios.length} examples</span>
          }
        />
        <div className='exampleColumns'>
          {source.sections.map((section) => (
            <section key={section.id} className='exampleSection'>
              <div className='exampleSectionHeader'>
                {section.titleHref
                  ? (
                    <a
                      className='exampleSectionTitleLink'
                      href={section.titleHref}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {section.title}
                    </a>
                  )
                  : <h2 className='exampleSectionTitle'>{section.title}</h2>}
                <span className='chip'>{section.scenarios.length}</span>
              </div>
              <div
                className={section.layout === 'flow'
                  ? 'exampleGrid exampleGridFlow'
                  : 'exampleGrid'}
              >
                {section.scenarios.map((scenario) => (
                  <ExamplePreviewCard
                    key={scenario.id}
                    scenario={scenario}
                    previewUrl={previewUrls.get(scenario.id)}
                    badge={section.badge ?? scenario.badge}
                    onOpen={handleOpenExample}
                    onKeyDown={handleCardKeyDown}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </ExamplePreviewQueueProvider>
  );
}
