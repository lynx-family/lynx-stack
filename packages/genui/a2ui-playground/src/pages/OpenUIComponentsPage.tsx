// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Protocol } from '../utils/protocol.js';

export function OpenUIComponentsPage(
  _props: { protocol: Protocol; componentName?: string },
) {
  return (
    <div className='compPage'>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--geist-secondary)' }}>
          OpenUI Components (coming soon)
        </p>
      </div>
    </div>
  );
}
