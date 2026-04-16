// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { toDataURL } from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

export function QrCode(props: { value: string; size?: number }) {
  const { value, size = 144 } = props;
  const [src, setSrc] = useState<string>('');

  const options = useMemo(
    () => ({
      width: size,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    }),
    [size],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const url = await toDataURL(value, options);
        if (!cancelled) {
          setSrc(url);
        }
      } catch {
        if (!cancelled) {
          setSrc('');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options, value]);

  if (!src) {
    return (
      <div className='qrPlaceholder' style={{ width: size, height: size }} />
    );
  }

  return (
    <img
      className='qrImage'
      src={src}
      width={size}
      height={size}
      alt='QR code'
    />
  );
}
