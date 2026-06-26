// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

interface CopyToastState {
  message: string;
  tone: 'success' | 'error';
  id: number;
}

export function useCopyToast(timeoutMs = 1400) {
  const [toast, setToast] = useState<CopyToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyToast = useCallback(
    (ok: boolean) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      setToast({
        id: Date.now(),
        message: ok ? 'Copy succeeded' : 'Copy failed',
        tone: ok ? 'success' : 'error',
      });
      timeoutRef.current = window.setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, timeoutMs);
    },
    [timeoutMs],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { toast, showCopyToast };
}

export function CopyToast(props: { toast: CopyToastState | null }) {
  const { toast } = props;
  if (!toast) return null;
  return (
    <div className='copyToastViewport' role='status' aria-live='polite'>
      <div className={`copyToast copyToast-${toast.tone}`} key={toast.id}>
        {toast.message}
      </div>
    </div>
  );
}
