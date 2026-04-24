// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ProtocolVersion } from '../utils/protocol.js';

export function ProtocolSwitch(props: {
  value: ProtocolVersion;
  onChange: (next: ProtocolVersion) => void;
}) {
  const { value, onChange } = props;
  return (
    <div className='protocolSwitch' role='group' aria-label='Protocol version'>
      <button
        type='button'
        className={value === '0.9' ? 'protocolButton active' : 'protocolButton'}
        onClick={() =>
          onChange('0.9')}
      >
        v0.9
      </button>
    </div>
  );
}
