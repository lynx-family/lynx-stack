// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { HtmlView } from './HtmlView.js';
import { LynxXmlView } from './LynxXmlView.js';
import { PreviewViewport } from './PreviewViewport.js';
import type {
  PreviewInlineRenderer,
  PreviewViewportProps,
} from './PreviewViewport.js';

const renderHtml: PreviewInlineRenderer = (props) => (
  <HtmlView
    className={props.className}
    iframeRef={props.iframeRef}
    source={props.source}
    title={props.title}
    onLoad={props.onLoad}
  />
);

const renderLynxXml: PreviewInlineRenderer = (props) => (
  <LynxXmlView
    className={props.className}
    source={props.source}
    onLoad={props.onLoad}
  />
);

export function HostedPreviewViewport(props: PreviewViewportProps) {
  return (
    <PreviewViewport
      {...props}
      htmlRenderer={renderHtml}
      lynxXmlRenderer={renderLynxXml}
    />
  );
}
