// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from 'react';

import { Chip } from '../components/Chip.js';
import { MobilePreview } from '../components/MobilePreview.js';
import { QrCode } from '../components/QrCode.js';
import { STATIC_DEMOS } from '../demos.js';
import type { ProtocolVersion } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

export function StaticPage(
  props: { protocol: ProtocolVersion; demoUrl: string },
) {
  const { protocol, demoUrl } = props;

  const origin = window.location.origin;
  const homeHref = `#/${protocol}`;

  const entries = useMemo(() => {
    return STATIC_DEMOS.map((demo) => {
      const renderUrl = buildRenderUrl(
        {
          protocol,
          demoUrl,
          messages: demo.messages,
        },
        origin,
      );

      return {
        demo,
        renderUrl,
      };
    });
  }, [demoUrl, origin, protocol]);

  return (
    <div className='page'>
      <div className='pageHeader'>
        <a className='backLink' href={homeHref}>
          ← Back to Home
        </a>
        <h1 className='pageTitle'>Static Rendering</h1>
        <p className='pageSubtitle'>
          Preview A2UI JSON rendering. Each card is shown via Lynx For Web.
        </p>
      </div>

      <div className='demoList'>
        {entries.map(({ demo, renderUrl }) => (
          <div key={demo.id} className='demoCard'>
            <div className='demoMeta'>
              <div className='demoTitleRow'>
                <h2 className='demoTitle'>{demo.title}</h2>
                <div className='chipRow'>
                  {demo.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}
                </div>
              </div>
              <div className='demoDesc'>{demo.description}</div>
              <div className='qrBlock'>
                <div className='qrLabel'>View on Device</div>
                <QrCode value={renderUrl} />
              </div>
            </div>

            <div className='demoPreview'>
              <div className='previewHeader'>Preview (Lynx For Web)</div>
              <div className='previewStage'>
                <MobilePreview src={renderUrl} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
