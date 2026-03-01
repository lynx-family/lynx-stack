import { useRef, useEffect, useState, useCallback } from 'react';
import type { LynxTemplate } from '@lynx-js/web-constants';
import type { LynxView } from '@lynx-js/web-core';

let renderCounter = 0;

interface LynxPreviewProps {
  template: LynxTemplate | null;
}

export function LynxPreview({ template }: LynxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<LynxView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail;
    const errorMessage = detail?.error?.message || detail?.error || 'Unknown error';
    const fileName = detail?.fileName;
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

  useEffect(() => {
    const container = containerRef.current;
    if (!template || !container) return;

    setError(null);

    // Remove old lynx-view
    if (viewRef.current) {
      viewRef.current.remove();
      viewRef.current = null;
    }

    const lynxView = document.createElement('lynx-view') as LynxView;
    lynxView.customTemplateLoader = async () => template;
    lynxView.addEventListener('error', handleError);

    container.appendChild(lynxView);

    // Use unique URL to bust template cache
    lynxView.url = `repl://template/v${renderCounter++}`;
    viewRef.current = lynxView;

    return () => {
      lynxView.removeEventListener('error', handleError);
      lynxView.remove();
      viewRef.current = null;
    };
  }, [template, handleError]);

  return (
    <div
      className="preview-content-area flex-1 flex flex-col overflow-hidden min-h-0 relative"
      style={{ background: 'var(--repl-preview-bg)' }}
      ref={containerRef}
    >
      {error && (
        <div className="error-overlay visible">
          {error}
        </div>
      )}
    </div>
  );
}
