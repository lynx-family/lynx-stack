// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import type { LocalDaemonClient } from './api-client.js';
import lightLogo from './assets/lynx-dark-logo.svg';
import darkLogo from './assets/lynx-light-logo.svg';
import { IsolatedLynxXmlFrame } from './IsolatedLynxXmlFrame.js';
import { LocalAgentChatController } from './LocalAgentChatController.js';
import type {
  CreateLynxXmlPreviewFrame,
  PreviewFrameRenderer,
} from '../../../../playground/src/shared-ui/index.js';
import {
  DemosList,
  DemosPage,
  LYNX_XML_DEMOS_LIST_SOURCE,
  LYNX_XML_DEMOS_PAGE_SOURCE,
  PROTOCOLS,
  PlaygroundChrome,
  parseRouteHash,
} from '../../../../playground/src/shared-ui/index.js';

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'a2ui-playground-theme';
const LOCAL_CREATE_HASH = '#/lynx-xml';
const LOCAL_TABS = [
  { id: 'create', label: 'Create' },
  { id: 'examples', label: 'Examples' },
] as const;

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Theme persistence is optional.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readLocalRoute() {
  const route = parseRouteHash(window.location.hash || LOCAL_CREATE_HASH);
  if (route.protocol.name !== 'lynx-xml') {
    return { ...parseRouteHash(LOCAL_CREATE_HASH), invalid: true };
  }
  return {
    ...route,
    tab: route.tab === 'examples' ? 'examples' as const : 'create' as const,
    invalid: route.tab !== 'create' && route.tab !== 'examples',
  };
}

export function LocalPlaygroundApp(props: { client: LocalDaemonClient }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [route, setRoute] = useState(readLocalRoute);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme persistence is optional.
    }
  }, [theme]);

  useEffect(() => {
    if (!window.location.hash || route.invalid) {
      window.history.replaceState(null, '', LOCAL_CREATE_HASH);
      setRoute(readLocalRoute());
    }
    const onHashChange = () => {
      const next = readLocalRoute();
      if (next.invalid) {
        window.history.replaceState(null, '', LOCAL_CREATE_HASH);
        setRoute(readLocalRoute());
      } else {
        setRoute(next);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [route.invalid]);

  const createLynxXmlPreviewFrame = useCallback<
    CreateLynxXmlPreviewFrame
  >((request) => {
    const render: PreviewFrameRenderer = (frameProps) => (
      <IsolatedLynxXmlFrame
        {...frameProps}
        source={request.source}
        identity={request.identity}
        previewOrigin={props.client.bootstrap.previewOrigin}
      />
    );
    return render;
  }, [props.client.bootstrap.previewOrigin]);

  const page = useMemo(() => {
    if (route.tab !== 'examples') {
      return <LocalAgentChatController client={props.client} />;
    }
    return route.demoId
      ? (
        <DemosPage
          protocol={PROTOCOLS['lynx-xml']}
          demoId={route.demoId}
          theme={theme}
          source={LYNX_XML_DEMOS_PAGE_SOURCE}
          createLynxXmlPreviewFrame={createLynxXmlPreviewFrame}
        />
      )
      : (
        <DemosList
          protocol={PROTOCOLS['lynx-xml']}
          theme={theme}
          source={LYNX_XML_DEMOS_LIST_SOURCE}
          createPreviewFrame={(scenario) =>
            createLynxXmlPreviewFrame({
              source: scenario.source,
              identity: 'example-card:' + scenario.id,
            })}
        />
      );
  }, [
    createLynxXmlPreviewFrame,
    props.client,
    route.demoId,
    route.tab,
    theme,
  ]);

  return (
    <PlaygroundChrome
      theme={theme}
      lightLogoSrc={lightLogo}
      darkLogoSrc={darkLogo}
      tabs={LOCAL_TABS}
      activeTab={route.tab}
      onTabSelect={(tab) => {
        window.location.hash = tab === 'examples'
          ? '#/lynx-xml/examples'
          : LOCAL_CREATE_HASH;
      }}
      protocolValue='lynx-xml'
      protocolOptions={[{
        value: 'lynx-xml',
        label: 'Lynx XML',
      }]}
      protocolDisabled
      onProtocolSelect={() => undefined}
      onThemeToggle={() =>
        setTheme((current) => current === 'dark' ? 'light' : 'dark')}
    >
      {page}
    </PlaygroundChrome>
  );
}
