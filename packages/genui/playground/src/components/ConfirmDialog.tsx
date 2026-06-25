// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    cancelLabel = 'Cancel',
    confirmLabel,
    description,
    onCancel,
    onConfirm,
    open,
    title,
    tone = 'neutral',
  } = props;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className='confirmDialogOverlay'
      role='presentation'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <section
        className='confirmDialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='confirm-dialog-title'
        aria-describedby='confirm-dialog-description'
      >
        <div className='confirmDialogBody'>
          <h2 id='confirm-dialog-title' className='confirmDialogTitle'>
            {title}
          </h2>
          <p
            id='confirm-dialog-description'
            className='confirmDialogDescription'
          >
            {description}
          </p>
        </div>
        <div className='confirmDialogActions'>
          <button
            type='button'
            className='confirmDialogButton confirmDialogButtonCancel'
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            className={tone === 'danger'
              ? 'confirmDialogButton confirmDialogButtonDanger'
              : 'confirmDialogButton confirmDialogButtonPrimary'}
            autoFocus
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
