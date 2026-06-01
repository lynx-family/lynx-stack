// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { PreviewViewport } from './PreviewViewport.js';
import { EXTENDED_STATIC_DEMOS, OFFICIAL_STATIC_DEMOS } from '../demos.js';
import type { StaticDemo } from '../demos.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface InstantExamplesStripProps {
  protocol: Protocol;
  theme: 'light' | 'dark';
  disabled?: boolean;
  onSelectExample: (demo: StaticDemo) => void;
  onBrowseAllHref: string;
}

const STATIC_DEMO_IDS = new Set(
  [...OFFICIAL_STATIC_DEMOS, ...EXTENDED_STATIC_DEMOS].map((d) => d.id),
);

const FEATURED_EXAMPLES: StaticDemo[] = (() => {
  const featured = [...EXTENDED_STATIC_DEMOS];
  for (const demo of OFFICIAL_STATIC_DEMOS) {
    if (featured.length >= 12) break;
    if (!featured.some((d) => d.id === demo.id)) featured.push(demo);
  }
  return featured;
})();

// Lazy-mounts the preview iframe only after the tile scrolls into view, plus
// a small per-tile mount delay — without this, mounting many iframes at once
// triggers a layout race where most lynx-view shadow roots stay at 0×0.
function LazyTilePreview(props: {
  src: string | undefined;
  emptyTitle: string;
  iframeTitle: string;
  rootSelector: string;
  mountDelayMs: number;
}) {
  const { emptyTitle, iframeTitle, mountDelayMs, rootSelector, src } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const node = containerRef.current;
    if (!node) return;
    const root = node.closest(rootSelector);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = () => {
      timer = setTimeout(() => {
        if (!cancelled) setMounted(true);
      }, mountDelayMs);
    };

    if (typeof IntersectionObserver === 'undefined') {
      arm();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            arm();
            break;
          }
        }
      },
      { root, rootMargin: '160px', threshold: 0.01 },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [mountDelayMs, mounted, rootSelector]);

  return (
    <div ref={containerRef} className='instantTilePreviewSlot'>
      <PreviewViewport
        src={mounted ? src : undefined}
        iframeTitle={iframeTitle}
        emptyTitle={emptyTitle}
        displayMode='full'
      />
    </div>
  );
}

export function InstantExamplesStrip(props: InstantExamplesStripProps) {
  const {
    disabled = false,
    onBrowseAllHref,
    onSelectExample,
    protocol,
    theme,
  } = props;

  const baseUrl = useMemo(() => window.location.href.replace(/#.*$/u, ''), []);

  const previewUrls = useMemo(
    () =>
      new Map(
        FEATURED_EXAMPLES.map((demo) => [
          demo.id,
          buildRenderUrl(
            {
              protocol,
              demoUrl: DEFAULT_A2UI_DEMO_URL,
              messages: demo.messages,
              theme,
              demoId: STATIC_DEMO_IDS.has(demo.id) ? demo.id : undefined,
              instant: true,
            },
            baseUrl,
          ),
        ]),
      ),
    [baseUrl, protocol, theme],
  );

  const handleCardKey = (
    event: KeyboardEvent<HTMLDivElement>,
    demo: StaticDemo,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (disabled) return;
    onSelectExample(demo);
  };

  return (
    <div className='instantExamples'>
      <div className='instantExamplesHeader'>
        <span className='instantExamplesLabel'>
          <span className='instantExamplesLabelIcon' aria-hidden='true'>
            ⚡
          </span>
          Pick an instant example
          <span className='instantExamplesLabelHint'>· no API call</span>
        </span>
        <a className='instantExamplesAllLink' href={onBrowseAllHref}>
          See all →
        </a>
      </div>
      <div className='instantExamplesRail'>
        {FEATURED_EXAMPLES.map((demo, idx) => (
          <div
            key={demo.id}
            className={disabled
              ? 'instantTile instantTile-disabled'
              : 'instantTile'}
            onClick={() => !disabled && onSelectExample(demo)}
            onKeyDown={(e) => handleCardKey(e, demo)}
            role='button'
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            title={demo.description ?? demo.title}
          >
            <div className='instantTileScreen'>
              <LazyTilePreview
                src={previewUrls.get(demo.id)}
                iframeTitle={`${demo.title} preview`}
                emptyTitle={demo.title}
                rootSelector='.instantExamplesRail'
                mountDelayMs={idx * 180}
              />
            </div>
            <div className='instantTileTitle'>{demo.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
