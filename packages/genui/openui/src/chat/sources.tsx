// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BuiltinActionType } from '@openuidev/lang-core';

import { createContext, useContext } from '@lynx-js/react';

import { useIsStreaming, useTriggerAction } from '../core/context.jsx';

interface Source {
  url?: string | undefined;
  title: string;
  sourceName: string;
}

export const SourcesContext = createContext<readonly Source[]>([]);

/** Route links through the host action callback, on native and Web alike. */
export function useOpenLink() {
  const trigger = useTriggerAction();
  const streaming = useIsStreaming();
  return (label: string, url?: string) => {
    if (
      streaming || !url
      || !/^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url)
    ) return;
    void trigger(label, undefined, {
      type: String(BuiltinActionType.OpenUrl),
      params: { url },
    });
  };
}

export function Citation({ index }: { index: number }) {
  const sources = useContext(SourcesContext);
  const source = sources[index - 1];
  const open = useOpenLink();
  return (
    <text
      className={source?.url ? 'OpenUIChatLink' : ''}
      accessibility-label={source ? `${index}. ${source.title}` : ''}
      bindtap={source ? () => open(source.title, source.url) : undefined}
    >
      {`[${index}]`}
    </text>
  );
}
