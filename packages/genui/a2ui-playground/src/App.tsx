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

import { AIChatPage } from './pages/AIChatPage.js';
import { ComponentsPage } from './pages/ComponentsPage.js';
import { DemosPage } from './pages/DemosPage.js';
import { OpenUIComponentsPage } from './pages/OpenUIComponentsPage.js';
import { OpenUIDemosPage } from './pages/OpenUIDemosPage.js';
import type { Protocol, ProtocolName } from './utils/protocol.js';
import { DEFAULT_PROTOCOL, getProtocol } from './utils/protocol.js';

type Tab = 'chat' | 'demos' | 'components';

interface TabDef {
  id: Tab;
  label: string;
}

const A2UI_TABS: TabDef[] = [
  { id: 'chat', label: 'AI Chat' },
  { id: 'demos', label: 'Demos' },
  { id: 'components', label: 'Components' },
];

const OPENUI_TABS: TabDef[] = [
  { id: 'demos', label: 'Demos' },
  { id: 'components', label: 'Components' },
];

interface Route {
  protocol: Protocol;
  tab: Tab;
  componentName?: string;
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
    return { protocol, tab: 'demos' };
  }
  if (rest[0] === 'components') {
    return { protocol, tab: 'components', componentName: rest[1] };
  }
  if (rest[0] === 'chat' || rest[0] === 'create') {
    return { protocol, tab: 'chat' };
  }
  // OpenUI has no chat tab, default to demos
  if (protocol.name === 'openui') return { protocol, tab: 'demos' };
  return { protocol, tab: 'chat' };
}

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash)
  );
  const [theme, setTheme] = useState<Theme>(getSystemTheme);

  const protocol = route.protocol;
  const tabs = protocol.name === 'openui' ? OPENUI_TABS : A2UI_TABS;

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
    // When switching to openui and current tab is chat, fallback to demos
    const tab = name === 'openui' && route.tab === 'chat' ? 'demos' : route.tab;
    window.location.hash = `#/${name}/${tab}`;
  }, [route.tab]);

  const page = useMemo(() => {
    if (protocol.name === 'openui') {
      switch (route.tab) {
        case 'components':
          return (
            <OpenUIComponentsPage
              key='openui-components'
              protocol={protocol}
              componentName={route.componentName}
            />
          );
        default:
          return <OpenUIDemosPage key='openui-demos' protocol={protocol} />;
      }
    }

    switch (route.tab) {
      case 'demos':
        return <DemosPage key='demos' protocol={protocol} />;
      case 'components':
        return (
          <ComponentsPage
            key='components'
            protocol={protocol}
            componentName={route.componentName}
          />
        );
      default:
        return <AIChatPage key='chat' protocol={protocol} />;
    }
  }, [protocol, route.tab, route.componentName]);

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
    <div className='appShell'>
      <div className='topBar'>
        <span className='brand'>Lynx GenUI Playground</span>

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

        <button
          type='button'
          className='themeToggle'
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>

      <div className='appBody'>
        {page}
      </div>
    </div>
  );
}
