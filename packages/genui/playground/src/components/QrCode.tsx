// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { toDataURL } from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

export function QrCode(props: {
  value: string;
  size?: number;
  onErrorChange?: (error: string) => void;
}) {
  const { value, size = 144, onErrorChange } = props;
  const [src, setSrc] = useState<string>('');
  const [error, setError] = useState<string>('');

  const options = useMemo(
    () => ({
      width: size,
      margin: 1,
      // Lowest error correction level lets us encode longer URLs (playground
      // render URLs can embed full A2UI messages as query params).
      errorCorrectionLevel: 'L' as const,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    }),
    [size],
  );

  useEffect(() => {
    let cancelled = false;
    setError('');
    onErrorChange?.('');

    if (!value) {
      setSrc('');
      return;
    }

    void (async () => {
      try {
        const url = await toDataURL(value, options);
        if (!cancelled) {
          setSrc(url);
          setError('');
          onErrorChange?.('');
        }
      } catch (e) {
        if (!cancelled) {
          setSrc('');
          const msg = e instanceof Error
            ? e.message
            : 'Failed to encode QR code';
          setError(msg);
          onErrorChange?.(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onErrorChange, options, value]);

  if (!src) {
    // Hide the entire QR block on error; parent can choose where/how to show copy.
    if (error) return null;

    return (
      <div
        className='qrPlaceholder'
        style={{ width: size, height: size }}
      >
        {null}
      </div>
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
