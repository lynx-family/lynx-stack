/* eslint-disable headers/header-format, sort-imports, import/order, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, n/no-unsupported-features/node-builtins, @typescript-eslint/prefer-nullish-coalescing */
import { useRef, useEffect, useState, useCallback } from 'react';
import type { LynxTemplate } from '@lynx-js/web-constants';
import type { LynxView } from '@lynx-js/web-core';

let renderCounter = 0;

interface LynxPreviewProps {
  template: LynxTemplate | null;
  isDark: boolean;
  onLoad?: () => void;
}

export function LynxPreview({ template, isDark, onLoad }: LynxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<LynxView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail;
    const errorMessage = detail?.error?.message || detail?.error
      || 'Unknown error';
    const fileName = detail?.fileName;
    setIsLoading(false);
    if (
      fileName === 'app-service.js'
      && typeof errorMessage === 'string'
      && errorMessage.includes('__CreatePage is not defined')
    ) {
      setError(
        'Runtime Error: __CreatePage is not defined in background.js.\n'
          + 'Hint: put Element PAPI rendering code in main-thread.js '
          + '(inside globalThis.renderPage).',
      );
      return;
    }
    setError(`Runtime Error: ${errorMessage}`);
  }, []);

  // Create lynx-view once and keep it alive for the component's lifetime.
  // biome-ignore lint/correctness/useExhaustiveDependencies: isDark sets initial theme at mount; live changes handled by a separate effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const lynxView = document.createElement('lynx-view') as LynxView;
    lynxView.globalProps = {
      locale: navigator.language,
      theme: isDark ? 'dark' : 'light',
    };
    lynxView.addEventListener('error', handleError);
    container.appendChild(lynxView);
    viewRef.current = lynxView;
    return () => {
      lynxView.removeEventListener('error', handleError);
      lynxView.remove();
      viewRef.current = null;
    };
  }, [handleError]);

  // Notify the running card whenever the REPL theme toggles, and keep the
  // element's globalProps in sync so re-boots see the updated theme.
  // Skip the initial mount — globalProps is already set at element creation.
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const lynxView = viewRef.current;
    if (!lynxView) return;
    const theme = isDark ? 'dark' : 'light';
    lynxView.globalProps = { locale: navigator.language, theme };
    lynxView.sendGlobalEvent('themeChanged', [theme]);
  }, [isDark]);

  // On each template change: swap loader + bump url.
  // lynx-view tears down the old instance and boots fresh via queueMicrotask.
  useEffect(() => {
    const lynxView = viewRef.current;
    if (!template || !lynxView) return;

    setError(null);
    setIsLoading(true);

    lynxView.customTemplateLoader = async () => template;
    lynxView.url = `repl://template/v${renderCounter++}`;

    // lynx-view has no load event. The url setter schedules teardown+boot via
    // queueMicrotask, so our Promise microtask (queued after) runs once the
    // shadow root has been reset. Watch for [lynx-tag="page"] — the style tag
    // is injected first, so childElementCount > 0 fires too early.
    let observer: MutationObserver | null = null;
    void Promise.resolve().then(() => {
      const root = lynxView.shadowRoot;
      if (!root) return;
      const checkPage = () => root.querySelector('[lynx-tag="page"]') !== null;
      if (checkPage()) {
        setIsLoading(false);
        onLoad?.();
        return;
      }
      observer = new MutationObserver(() => {
        if (checkPage()) {
          setIsLoading(false);
          onLoad?.();
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(root, { childList: true, subtree: true });
    });

    return () => {
      observer?.disconnect();
    };
  }, [template, onLoad]);

  return (
    <div
      className='preview-content-area h-full overflow-hidden min-h-0 relative'
      style={{ background: 'var(--repl-preview-bg)' }}
      ref={containerRef}
    >
      {isLoading && !error && (
        <div
          className='absolute inset-0 flex items-center justify-center pointer-events-none'
          style={{ color: 'var(--repl-text-dim)' }}
        >
          <span className='text-[11px] font-mono animate-pulse'>loading…</span>
        </div>
      )}
      {error && (
        <div className='error-overlay'>
          {error}
        </div>
      )}
    </div>
  );
}
