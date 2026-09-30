// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { readTheme } from './query.js';
import { LynxXmlView } from '../components/LynxXmlView.js';
import {
  LYNX_XML_RENDER_READY_MESSAGE_TYPE,
  LYNX_XML_SOURCE_URL_QUERY_PARAM,
} from '../utils/renderUrl.js';

export function LynxXmlRender() {
  const initial = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      sourceUrl: params.get(LYNX_XML_SOURCE_URL_QUERY_PARAM) ?? '',
      exampleId: params.get('exampleId'),
      theme: readTheme(params.get('theme')) ?? 'light',
    };
  }, []);

  const [templateSource, setTemplateSource] = useState<string>();
  const [templateError, setTemplateError] = useState('');
  useEffect(() => {
    if (!initial.exampleId) return;
    let active = true;
    void import('../pages/demos/lynx-xml.js')
      .then(({ LYNX_XML_SCENARIOS }) => {
        if (!active) return;
        const scenario = LYNX_XML_SCENARIOS.find(({ id }) =>
          id === initial.exampleId
        );
        if (!scenario?.templateSource) {
          throw new Error('Unknown Lynx XML template example.');
        }
        setTemplateSource(scenario.source);
      })
      .catch(error => {
        if (active) {
          setTemplateError(
            error instanceof Error ? error.message : String(error),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [initial]);

  useEffect(() => {
    document.documentElement.dataset.theme = initial.theme;
    document.documentElement.style.colorScheme = initial.theme;
  }, [initial.theme]);

  const handleLoad = useCallback(() => {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      { type: LYNX_XML_RENDER_READY_MESSAGE_TYPE },
      '*',
    );
  }, []);

  if (templateError) {
    return <div className='lynxXmlRenderError'>{templateError}</div>;
  }
  if (initial.exampleId && !templateSource) return null;
  return initial.sourceUrl || templateSource
    ? (
      <LynxXmlView
        className='lynxXmlRenderView'
        sourceUrl={initial.exampleId ? undefined : initial.sourceUrl}
        source={templateSource}
        onLoad={handleLoad}
      />
    )
    : (
      <div className='lynxXmlRenderError'>
        Missing Lynx XML source URL.
      </div>
    );
}
