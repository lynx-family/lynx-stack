// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import ReactDOM from 'react-dom/client';

import '../styles.css';

import { A2UIRender } from './a2ui.js';
import { LynxXmlRender } from './lynx-xml.js';
import { McpAppsRender } from './mcp-apps.js';
import { OpenUIRender } from './openui.js';
import { parseInitDataFromQuery, readRenderProtocol } from './query.js';
import { ReactLynxRender } from './reactlynx.js';

function Render() {
  const protocol = readRenderProtocol(
    new URLSearchParams(window.location.search).get('protocol'),
  ) ?? parseInitDataFromQuery()?.protocol;

  switch (protocol) {
    case 'reactlynx':
      return <ReactLynxRender />;
    case 'lynx-xml':
      return <LynxXmlRender />;
    case 'openui':
      return <OpenUIRender />;
    case 'mcp-apps':
      return <McpAppsRender />;
    default:
      return <A2UIRender />;
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
document.documentElement.dataset.playgroundEntry = 'render';
ReactDOM.createRoot(container).render(<Render />);
