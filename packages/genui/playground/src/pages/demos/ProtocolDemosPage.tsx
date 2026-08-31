// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UI_DEMOS_PAGE_SOURCE } from './a2ui.js';
import { DemosPage } from './DemosPage.js';
import type { DemosPreviewPanelRenderRequest } from './DemosPage.js';
import { LYNX_XML_DEMOS_PAGE_SOURCE } from './lynx-xml.js';
import { MCP_APPS_DEMOS_PAGE_SOURCE } from './mcp-apps.js';
import { OPENUI_DEMOS_PAGE_SOURCE } from './openui.js';
import { HostedPreviewViewport } from '../../components/HostedPreviewViewport.js';
import type { CreateLynxXmlPreviewFrame } from '../../components/LynxXmlPreviewRuntime.js';
import { PreviewPanel } from '../../components/PreviewPanel.js';
import type { Protocol } from '../../utils/protocol.js';

const renderHostedPreviewPanel = (
  props: DemosPreviewPanelRenderRequest,
) => <PreviewPanel {...props} />;

export function ProtocolDemosPage(props: {
  protocol: Protocol;
  demoId?: string;
  theme: 'light' | 'dark';
  createLynxXmlPreviewFrame?: CreateLynxXmlPreviewFrame;
}) {
  if (props.protocol.name === 'lynx-xml') {
    return (
      <DemosPage
        key='lynx-xml'
        {...props}
        source={LYNX_XML_DEMOS_PAGE_SOURCE}
        PreviewViewportComponent={HostedPreviewViewport}
        renderPreviewPanel={renderHostedPreviewPanel}
      />
    );
  }
  if (props.protocol.name === 'mcp-apps') {
    return (
      <DemosPage
        key='mcp-apps'
        {...props}
        source={MCP_APPS_DEMOS_PAGE_SOURCE}
        PreviewViewportComponent={HostedPreviewViewport}
        renderPreviewPanel={renderHostedPreviewPanel}
      />
    );
  }
  if (props.protocol.name === 'openui') {
    return (
      <DemosPage
        key='openui'
        {...props}
        source={OPENUI_DEMOS_PAGE_SOURCE}
        PreviewViewportComponent={HostedPreviewViewport}
        renderPreviewPanel={renderHostedPreviewPanel}
      />
    );
  }
  return (
    <DemosPage
      key='a2ui'
      {...props}
      source={A2UI_DEMOS_PAGE_SOURCE}
      PreviewViewportComponent={HostedPreviewViewport}
      renderPreviewPanel={renderHostedPreviewPanel}
    />
  );
}
