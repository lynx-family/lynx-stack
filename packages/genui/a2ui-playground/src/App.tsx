// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useState } from 'react';

import { ProtocolSwitch } from './components/ProtocolSwitch.js';
import { AIChatPage } from './pages/AIChatPage.js';
import { ComponentsPage } from './pages/ComponentsPage.js';
import { DemosPage } from './pages/DemosPage.js';
import type { ProtocolVersion } from './utils/protocol.js';
import { DEFAULT_PROTOCOL } from './utils/protocol.js';

type Tab = 'chat' | 'demos' | 'components';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'AI Chat' },
  { id: 'demos', label: 'Demos' },
  { id: 'components', label: 'Components' },
];

interface Route {
  tab: Tab;
  componentName?: string;
}

function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/u, '');
  const parts = cleaned.split('/');
  if (parts[0] === 'demos') return { tab: 'demos' };
  if (parts[0] === 'components') {
    return { tab: 'components', componentName: parts[1] };
  }
  return { tab: 'chat' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash)
  );
  const [protocol, setProtocol] = useState<ProtocolVersion>(DEFAULT_PROTOCOL);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabClick = useCallback((id: Tab) => {
    window.location.hash = `#/${id}`;
  }, []);

  const page = (() => {
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
  })();

  return (
    <div className='appShell'>
      <div className='topBar'>
        <span className='brand'>A2UI Playground</span>

        <nav className='tabNav'>
          {TABS.map((t) => (
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

        <div className='protocolControl'>
          <div className='protocolLabel'>Protocol</div>
          <ProtocolSwitch value={protocol} onChange={setProtocol} />
        </div>
      </div>

      <div className='appBody'>
        {page}
      </div>
    </div>
  );
}
