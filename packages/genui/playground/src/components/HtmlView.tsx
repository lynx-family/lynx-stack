// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// biome-ignore lint/style/useImportType: Rstest's JSX transform needs React at runtime.
import * as React from 'react';

export const HTML_PREVIEW_SANDBOX = 'allow-scripts';

interface HtmlViewProps {
  className?: string;
  iframeRef?: React.Ref<HTMLIFrameElement>;
  onLoad?: () => void;
  source: string;
  title?: string;
}

/** Render model-authored HTML without granting access to the parent origin. */
export function HtmlView(props: HtmlViewProps) {
  const {
    className,
    iframeRef,
    onLoad,
    source,
    title = 'HTML preview',
  } = props;
  return (
    <iframe
      className={className}
      ref={iframeRef}
      title={title}
      srcDoc={source}
      sandbox={HTML_PREVIEW_SANDBOX}
      referrerPolicy='no-referrer'
      onLoad={onLoad}
    />
  );
}
