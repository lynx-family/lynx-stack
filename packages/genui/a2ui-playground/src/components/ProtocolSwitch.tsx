// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Protocol } from '../utils/protocol.js';

export function ProtocolSwitch(props: {
  protocol: Protocol;
}) {
  const { protocol } = props;
  return (
    <div className='protocolSwitch' role='group' aria-label='Protocol version'>
      <button
        type='button'
        className='protocolButton active'
      >
        {protocol.name === 'a2ui' ? 'A2UI' : 'OpenUI'} v{protocol.version}
      </button>
    </div>
  );
}
