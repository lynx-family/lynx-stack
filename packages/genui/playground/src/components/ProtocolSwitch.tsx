// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Protocol } from '../utils/protocol.js';

export function ProtocolSwitch(props: {
  protocol: Protocol;
}) {
  const { protocol } = props;
  let label = 'MCP Apps';
  if (protocol.name === 'a2ui') {
    label = 'A2UI';
  } else if (protocol.name === 'openui') {
    label = 'OpenUI';
  }
  return (
    <div className='protocolSwitch' role='group' aria-label='Protocol version'>
      <button
        type='button'
        className='protocolButton active'
      >
        {label} v{protocol.version}
      </button>
    </div>
  );
}
