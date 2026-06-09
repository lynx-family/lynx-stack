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
import { AIChatPage } from './pages/AIChatPage.js';
import { ComponentsPage } from './pages/ComponentsPage.js';
import { DemosListPage } from './pages/DemosListPage.js';
import { DemosPage } from './pages/DemosPage.js';
import { OpenUIComponentsPage } from './pages/OpenUIComponentsPage.js';
import { OpenUIDemosPage } from './pages/OpenUIDemosPage.js';
import type { Protocol, ProtocolName } from './utils/protocol.js';
import { DEFAULT_PROTOCOL, getProtocol } from './utils/protocol.js';

const LYNX_LIGHT_LOGO =
  'https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/lynx-dark-logo.svg';
const LYNX_DARK_LOGO =
  'https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/lynx-light-logo.svg';

type Tab = 'create' | 'examples' | 'components' | 'catalog';

interface TabDef {
  id: Tab;
  label: string;
}

const A2UI_TABS: TabDef[] = [
  { id: 'create', label: 'Create' },
  { id: 'examples', label: 'Examples' },
  { id: 'catalog', label: 'Catalog' },
];

const OPENUI_TABS: TabDef[] = [
  { id: 'examples', label: 'Examples' },
  { id: 'components', label: 'Components' },
];

interface Route {
  protocol: Protocol;
  tab: Tab;
  componentName?: string;
  demoId?: string;
}

function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/u, '');
  const parts = cleaned.split('/');

  let protocol: Protocol = DEFAULT_PROTOCOL;
  let rest = parts;

  if (parts[0] === 'a2ui' || parts[0] === 'openui') {
    protocol = getProtocol(parts[0]);
    rest = parts.slice(1);
  }

  if (rest[0] === 'demos' || rest[0] === 'examples') {
    return {
      protocol,
      tab: 'examples',
      demoId: rest[1],
    };
  }
  if (rest[0] === 'components' || rest[0] === 'catalog') {
    return {
      protocol,
      tab: protocol.name === 'a2ui' ? 'catalog' : 'components',
      componentName: rest[1],
    };
  }
  if (rest[0] === 'chat' || rest[0] === 'create') {
    return { protocol, tab: 'create' };
  }
  // Back-compat: the standalone Playback tab is gone; route it to Examples.
  if (rest[0] === 'playback') {
    return { protocol, tab: 'examples' };
  }
  // OpenUI has no create tab, default to examples.
  if (protocol.name === 'openui') return { protocol, tab: 'examples' };
  return { protocol, tab: 'create' };
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
    parseHash(window.location.hash)
  );
  const [theme, setTheme] = useState<Theme>(() => {
    return getForcedTheme() ?? getInitialTheme();
  });
  const embedded = useMemo(() => isEmbedded(), []);
  const forcedTheme = useMemo(() => getForcedTheme(), []);

  const protocol = route.protocol;
  const tabs = protocol.name === 'openui' ? OPENUI_TABS : A2UI_TABS;

  useLayoutEffect(() => {
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
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabClick = useCallback((id: Tab) => {
    window.location.hash = `#/${protocol.name}/${id}`;
  }, [protocol.name]);

  const handleProtocolSelect = useCallback((name: ProtocolName) => {
    // When switching to openui and current tab is create, fallback to examples.
    const tab = name === 'openui' && route.tab === 'create'
      ? 'examples'
      : route.tab;
    window.location.hash = `#/${name}/${tab}`;
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

    if (protocol.name === 'openui') {
      switch (route.tab) {
        case 'components':
        case 'catalog':
          return (
            <OpenUIComponentsPage
              key='openui-components'
              protocol={protocol}
              componentName={route.componentName}
            />
          );
        default:
          return <OpenUIDemosPage key='openui-examples' protocol={protocol} />;
      }
    }

    switch (route.tab) {
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
      case 'components':
        return (
          <ComponentsPage
            key='components'
            protocol={protocol}
            componentName={route.componentName}
            theme={theme}
          />
        );
      default:
        return <AIChatPage key='create' protocol={protocol} theme={theme} />;
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
        <option value='a2ui'>A2UI v0.9</option>
        <option value='openui'>OpenUI v0.1</option>
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
