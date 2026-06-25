// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import { PreviewViewport } from './PreviewViewport.js';
import { MountQueueProvider, useQueuedMount } from '../hooks/useMountQueue.js';
import { PRIORITY } from '../utils/mountQueue.js';
import type { Priority } from '../utils/mountQueue.js';

const ROOT_MARGIN = '50% 0px';
const RENDER_READY_TIMEOUT_MS = 5000;

export const EXAMPLE_PREVIEW_MAX_CONCURRENT = 4;

export interface ExamplePreviewScenario {
  id: string;
  title: string;
}

export { MountQueueProvider as ExamplePreviewQueueProvider };

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

export function ExamplePreviewCard(props: {
  scenario: ExamplePreviewScenario;
  previewUrl: string | undefined;
  badge?: string;
  onOpen: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, id: string) => void;
}) {
  const { badge, onKeyDown, onOpen, previewUrl, scenario } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const previewUrlRef = useRef(previewUrl);
  const timerRef = useRef<number | null>(null);
  const priority = useViewportPriority(cardRef);
  const { armed, markReady } = useQueuedMount(scenario.id, priority);
  const [rendered, setRendered] = useState(false);

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

  // When previewUrl changes (e.g. theme toggle rebuilds the URL), cover the
  // stale frame until the next boot reports readiness.
  useEffect(() => {
    previewUrlRef.current = previewUrl;
    readyRef.current = false;
    setRendered(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [previewUrl]);

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
