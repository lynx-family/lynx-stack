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
import {
  readBenchLocale,
  writeBenchLocale,
} from './pages/bench/benchLocale.js';
import type { BenchLocale } from './pages/bench/benchLocale.js';
import { BenchResultPage } from './pages/bench/BenchResultPage.js';
import { BenchRunnerPage } from './pages/bench/BenchRunnerPage.js';
import { BenchShell } from './pages/bench/BenchShell.js';
import { PhaseTwoReportPage } from './pages/bench/PhaseTwoReportPage.js';
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

const GENUI_TABS: TabDef[] = [
  { id: 'create', label: 'Create' },
  { id: 'examples', label: 'Examples' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'bench', label: 'Bench' },
];

const MCP_APPS_TABS: TabDef[] = [
  { id: 'create', label: 'Create' },
  { id: 'examples', label: 'Examples' },
];
const LYNX_XML_TABS: TabDef[] = [{ id: 'examples', label: 'Examples' }];

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
  const [benchLocale, setBenchLocale] = useState<BenchLocale>(readBenchLocale);
  const embedded = useMemo(() => isEmbedded(), []);
  const forcedTheme = useMemo(() => getForcedTheme(), []);

  const protocol = route.protocol;
  const tabs = protocol.name === 'mcp-apps'
    ? MCP_APPS_TABS
    : (protocol.name === 'lynx-xml' ? LYNX_XML_TABS : GENUI_TABS);

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
    writeBenchLocale(benchLocale);
  }, [benchLocale]);

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

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }, []);

  const handleProtocolSelect = useCallback((name: ProtocolName) => {
    if (name === 'mcp-apps') {
      window.location.hash = buildRouteHash(
        name,
        route.tab === 'examples' ? 'examples' : 'create',
      );
      return;
    }
    if (name === 'lynx-xml') {
      window.location.hash = buildRouteHash(name, 'examples');
      return;
    }
    window.location.hash = buildRouteHash(name, route.tab);
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

    if (protocol.name === 'mcp-apps') {
      if (route.tab !== 'examples') return createPage;
      return route.demoId
        ? (
          <DemosPage
            key='mcp-apps-examples-detail'
            protocol={protocol}
            demoId={route.demoId}
            theme={theme}
          />
        )
        : (
          <DemosListPage
            key='mcp-apps-examples-index'
            protocol={protocol}
            theme={theme}
          />
        );
    }

    if (protocol.name === 'lynx-xml') {
      return route.demoId
        ? (
          <DemosPage
            key='lynx-xml-examples-detail'
            protocol={protocol}
            demoId={route.demoId}
            theme={theme}
          />
        )
        : (
          <DemosListPage
            key='lynx-xml-examples-index'
            protocol={protocol}
            theme={theme}
          />
        );
    }

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
      case 'bench': {
        let benchPage = (
          <BenchRunnerPage key='bench-runner' locale={benchLocale} />
        );
        switch (route.benchSlug) {
          case undefined:
          case 'runner':
            break;
          case 'phase-1':
            benchPage = (
              <BenchResultPage key='bench-phase-1' locale={benchLocale} />
            );
            break;
          case 'phase-2':
            benchPage = (
              <PhaseTwoReportPage
                key='bench-phase-2-report'
                locale={benchLocale}
              />
            );
            break;
          default:
            break;
        }
        return (
          <BenchShell
            activeSlug={route.benchSlug}
            locale={benchLocale}
            theme={theme}
            onChangeLocale={setBenchLocale}
            onToggleTheme={handleThemeToggle}
          >
            {benchPage}
          </BenchShell>
        );
      }
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
    route.benchSlug,
    benchLocale,
    theme,
    handleThemeToggle,
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
        <option value='mcp-apps'>
          MCP Apps v{PROTOCOLS['mcp-apps'].version}
        </option>
        <option value='lynx-xml'>
          Lynx XML v{PROTOCOLS['lynx-xml'].version}
        </option>
      </select>
    </div>
  );

  return (
    <div className={embedded ? 'appShell appShellEmbedded' : 'appShell'}>
      {embedded || route.tab === 'bench' ? null : (
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
            onClick={handleThemeToggle}
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
