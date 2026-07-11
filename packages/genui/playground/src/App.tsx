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

import { Button } from './components/Button.js';
import { Moon, Sun } from './components/Icon.js';
import { BenchPage } from './pages/BenchPage.js';
import { ComponentsPage } from './pages/catalog/ComponentsPage.js';
import { ChatPage } from './pages/chat/ChatPage.js';
import { DemosListPage } from './pages/demos/DemosListPage.js';
import { DemosPage } from './pages/demos/DemosPage.js';
import type { Route, Tab } from './utils/appRoute.js';
import {
  DEFAULT_ROUTE_HASH,
  buildRouteHash,
  getRouteHash,
  isEmptyRouteHash,
  parseRouteHash,
} from './utils/appRoute.js';
import type { ProtocolName } from './utils/protocol.js';
import { PROTOCOLS } from './utils/protocol.js';

const LYNX_LIGHT_LOGO =
  'https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/lynx-dark-logo.svg';
const LYNX_DARK_LOGO =
  'https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/lynx-light-logo.svg';

interface TabDef {
  id: Tab;
  label: string;
}

const A2UI_TABS: TabDef[] = [
  { id: 'create', label: 'Create' },
  { id: 'examples', label: 'Examples' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'bench', label: 'Bench' },
];

const OPENUI_TABS: TabDef[] = [
  { id: 'create', label: 'Create' },
  { id: 'examples', label: 'Examples' },
  { id: 'catalog', label: 'Catalog' },
];

function ensureDefaultRouteHash(): void {
  if (!isEmptyRouteHash(window.location.hash)) return;
  const url = new URL(window.location.href);
  url.hash = DEFAULT_ROUTE_HASH;
  window.history.replaceState(null, '', url);
}

function getCurrentRouteHash(): string {
  return getRouteHash(window.location.hash);
}

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'a2ui-playground-theme';

function getSystemTheme(): Theme {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function getInitialTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    // Ignore localStorage errors and fall back to the system theme.
  }

  return getSystemTheme();
}

function readUrlFlag(name: string): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  } catch {
    return null;
  }
}

function isEmbedded(): boolean {
  const value = readUrlFlag('embed');
  return value === '1' || value === 'true';
}

function getForcedTheme(): Theme | null {
  const value = readUrlFlag('theme');
  return value === 'light' || value === 'dark' ? value : null;
}

export function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseRouteHash(getCurrentRouteHash())
  );
  const [theme, setTheme] = useState<Theme>(() => {
    return getForcedTheme() ?? getInitialTheme();
  });
  const embedded = useMemo(() => isEmbedded(), []);
  const forcedTheme = useMemo(() => getForcedTheme(), []);

  const protocol = route.protocol;
  const tabs = protocol.name === 'openui' ? OPENUI_TABS : A2UI_TABS;

  useLayoutEffect(() => {
    ensureDefaultRouteHash();
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (forcedTheme) return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore localStorage errors.
    }
  }, [theme, forcedTheme]);

  useEffect(() => {
    const onHashChange = () => {
      ensureDefaultRouteHash();
      setRoute(parseRouteHash(getCurrentRouteHash()));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabClick = useCallback((id: Tab) => {
    window.location.hash = buildRouteHash(protocol.name, id);
  }, [protocol.name]);

  const handleProtocolSelect = useCallback((name: ProtocolName) => {
    // When switching to OpenUI and current tab is A2UI-only, fallback to examples.
    const tab = name === 'openui' && route.tab === 'bench'
      ? 'examples'
      : route.tab;
    window.location.hash = buildRouteHash(name, tab);
  }, [route.tab]);

  const page = useMemo(() => {
    if (embedded) {
      // Embedded mode (e.g. iframe on the Lynx website) only exposes the
      // component catalog: the All Components grid and per-component preview.
      return (
        <ComponentsPage
          key='components-embedded'
          protocol={protocol}
          componentName={route.componentName}
          theme={theme}
          embedded
        />
      );
    }

    const createPage = (
      <ChatPage
        key={`${protocol.name}-create`}
        protocol={protocol}
        theme={theme}
      />
    );

    if (protocol.name === 'openui') {
      switch (route.tab) {
        case 'create':
          return createPage;
        case 'catalog':
          return (
            <ComponentsPage
              key='openui-components'
              protocol={protocol}
              componentName={route.componentName}
              theme={theme}
            />
          );
        default:
          return route.demoId
            ? (
              <DemosPage
                key='openui-examples-detail'
                protocol={protocol}
                demoId={route.demoId}
                theme={theme}
              />
            )
            : (
              <DemosListPage
                key='openui-examples-index'
                protocol={protocol}
                theme={theme}
              />
            );
      }
    }

    switch (route.tab) {
      case 'bench':
        return <BenchPage key='bench' />;
      case 'examples':
        return route.demoId
          ? (
            <DemosPage
              key='examples-detail'
              protocol={protocol}
              demoId={route.demoId}
              theme={theme}
            />
          )
          : (
            <DemosListPage
              key='examples-index'
              protocol={protocol}
              theme={theme}
            />
          );
      case 'catalog':
        return (
          <ComponentsPage
            key='components'
            protocol={protocol}
            componentName={route.componentName}
            theme={theme}
          />
        );
      default:
        return createPage;
    }
  }, [
    embedded,
    protocol,
    route.tab,
    route.componentName,
    route.demoId,
    theme,
  ]);

  const protocolVersionControl = (
    <div className='protocolControl'>
      <div className='protocolLabel'>Protocol</div>
      <select
        className='protocolSelect'
        value={protocol.name}
        onChange={(e) => handleProtocolSelect(e.target.value as ProtocolName)}
      >
        <option value='a2ui'>A2UI v{PROTOCOLS.a2ui.version}</option>
        <option value='openui'>OpenUI v{PROTOCOLS.openui.version}</option>
      </select>
    </div>
  );

  return (
    <div className={embedded ? 'appShell appShellEmbedded' : 'appShell'}>
      {embedded ? null : (
        <div className='topBar'>
          <div className='brandGroup'>
            <img
              className='brandLogo'
              src={theme === 'dark' ? LYNX_DARK_LOGO : LYNX_LIGHT_LOGO}
              alt='Lynx'
            />
            <span className='brand'>Lynx GenUI Playground</span>
          </div>

          <nav className='tabNav'>
            {tabs.map((t) => (
              <button
                key={t.id}
                type='button'
                className={route.tab === t.id
                  ? 'tabNavItem active'
                  : 'tabNavItem'}
                onClick={() => handleTabClick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className='spacer' />

          {protocolVersionControl}

          <Button
            variant='ghost'
            size='sm'
            iconOnly
            iconBefore={theme === 'dark' ? Sun : Moon}
            className='themeToggle'
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          />
        </div>
      )}

      <div className='appBody'>
        {page}
      </div>
    </div>
  );
}
