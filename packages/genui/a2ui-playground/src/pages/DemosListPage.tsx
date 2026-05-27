// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import './DemosPage.css';

import { PageHeader } from '../components/PageHeader.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import {
  DYNAMIC_PRESETS,
  EXTENDED_STATIC_DEMOS,
  OFFICIAL_STATIC_DEMOS,
} from '../demos.js';
import { MountQueueProvider, useQueuedMount } from '../hooks/useMountQueue.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import { PRIORITY } from '../utils/mountQueue.js';
import type { Priority } from '../utils/mountQueue.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

const MAX_CONCURRENT = 4;
const ROOT_MARGIN = '50% 0px';
const RENDER_READY_TIMEOUT_MS = 5000;

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

function useViewportPriority(
  ref: RefObject<Element | null>,
): Priority {
  const [priority, setPriority] = useState<Priority>(PRIORITY.OFFSCREEN);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setPriority(PRIORITY.IN_VIEW);
      return;
    }
    const inViewObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setPriority(PRIORITY.IN_VIEW);
        } else {
          // Outside the viewport: defer to the near-viewport observer below.
          setPriority((cur) => cur === PRIORITY.IN_VIEW ? PRIORITY.NEAR : cur);
        }
      },
      { rootMargin: '0px' },
    );
    const nearObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setPriority((cur) => {
          if (entry?.isIntersecting) {
            return cur === PRIORITY.IN_VIEW ? cur : PRIORITY.NEAR;
          }
          return PRIORITY.OFFSCREEN;
        });
      },
      { rootMargin: ROOT_MARGIN },
    );
    inViewObserver.observe(el);
    nearObserver.observe(el);
    return () => {
      inViewObserver.disconnect();
      nearObserver.disconnect();
    };
  }, [ref]);
  return priority;
}

interface ExampleCardProps {
  scenario: ExampleScenario;
  previewUrl: string | undefined;
  badge?: string;
  onOpen: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, id: string) => void;
}

function CardPreviewLoading(props: { title: string; revealed: boolean }) {
  return (
    <div className='cardPreviewLoading' data-revealed={props.revealed}>
      <div className='cardPreviewLoadingTitle'>{props.title}</div>
      <div className='cardPreviewLoadingDots' aria-hidden='true'>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function ExampleCard(props: ExampleCardProps) {
  const { badge, onKeyDown, onOpen, previewUrl, scenario } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const priority = useViewportPriority(cardRef);
  const { armed, markReady } = useQueuedMount(scenario.id, priority);
  const [rendered, setRendered] = useState(false);

  // Free the queue slot. Does NOT reveal the iframe — that's the
  // RENDER_READY path's job. If we never hear from the iframe (web-core
  // race, broken bundle, etc.), the loading overlay stays put so the
  // user never sees a blank-white iframe peeking through.
  const releaseSlot = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    markReady();
  }, [markReady]);

  const handleRenderReady = useCallback(() => {
    setRendered(true);
    releaseSlot();
  }, [releaseSlot]);

  // When previewUrl changes (e.g. theme toggle rebuilds the URL with a
  // new `?theme=` param), drop the rendered state so the loading overlay
  // covers the iframe again until the new boot finishes — otherwise the
  // user sees the old frame, then a white flash, then the new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: previewUrl is intentionally a reset trigger; the effect body only resets local refs.
  useEffect(() => {
    readyRef.current = false;
    setRendered(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [previewUrl]);

  // Listen for the iframe's A2UI_RENDER_READY postMessage. Stays
  // attached even after the safety timeout, so a slow-but-eventually
  // working iframe still gets its overlay faded out when it finishes.
  useEffect(() => {
    if (!armed) return;
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (data && data.type === 'A2UI_RENDER_READY') {
        handleRenderReady();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [armed, handleRenderReady]);

  // Cleanup the safety timer if the card unmounts before it fires.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (readyRef.current) return;
    if (timerRef.current !== null) return;
    // Safety timeout: if A2UI_RENDER_READY never arrives, release the
    // slot so the queue can advance. We do NOT set rendered=true here —
    // the overlay stays on top so a failed iframe never shows blank.
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      releaseSlot();
    }, RENDER_READY_TIMEOUT_MS);
  }, [releaseSlot]);

  return (
    <div
      ref={cardRef}
      className='exampleCard'
      onClick={() => onOpen(scenario.id)}
      onKeyDown={(event) => onKeyDown(event, scenario.id)}
      role='button'
      tabIndex={0}
    >
      <div className='exampleCardPreview'>
        <div
          className='exampleCardPreviewWindow'
          style={{ position: 'relative' }}
        >
          <PreviewViewport
            src={armed ? previewUrl : undefined}
            iframeTitle={`${scenario.title} preview`}
            emptyTitle={scenario.title}
            displayMode='full'
            iframeRef={iframeRef}
            onLoad={handleIframeLoad}
          />
          {armed
            ? (
              <CardPreviewLoading
                title={scenario.title}
                revealed={rendered}
              />
            )
            : null}
        </div>
      </div>
      <div className='exampleCardBody'>
        <div className='exampleCardTop'>
          <div className='exampleCardTitle'>{scenario.title}</div>
          {badge ? <span className='exampleCardBadge'>{badge}</span> : null}
        </div>
      </div>
    </div>
  );
}

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
    <MountQueueProvider
      maxConcurrent={MAX_CONCURRENT}
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
                <ExampleCard
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
                <ExampleCard
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
        </div>
      </div>
    </MountQueueProvider>
  );
}
