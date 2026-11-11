// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Card as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { SourcesContext, useOpenLink } from '../sources.jsx';
import '../../../styles/catalog/ChatCard.css';

/** ReactLynx renderer for the OpenUI Chat Card contract. */
export const Card: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => {
    const open = useOpenLink();
    const sources = props.sources ?? [];
    return (
      <SourcesContext.Provider value={sources}>
        <view className='OpenUIChatCard'>
          {renderNode(props.children ?? [])}
          {sources.length > 0 && (
            <view className='OpenUIChatSources'>
              {sources.map((source, index) => (
                <text
                  key={`${index}:${source.url ?? source.title}`}
                  className={source.url
                    ? 'OpenUIChatSource OpenUIChatLink'
                    : 'OpenUIChatSource'}
                  bindtap={() => open(source.title, source.url)}
                >
                  {`[${index + 1}] ${source.title} · ${source.sourceName}`}
                </text>
              ))}
            </view>
          )}
        </view>
      </SourcesContext.Provider>
    );
  },
};
