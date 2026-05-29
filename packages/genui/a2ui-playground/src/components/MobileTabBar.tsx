// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type MobilePaneTab = 'edit' | 'preview';

interface MobileTabBarProps {
  activeTab: MobilePaneTab;
  onChange: (tab: MobilePaneTab) => void;
  editLabel?: string;
}

export function MobileTabBar(props: MobileTabBarProps) {
  const { activeTab, editLabel = 'Edit', onChange } = props;
  return (
    <nav
      className='mobileTabBar'
      role='tablist'
      aria-label='Active panel'
    >
      <button
        type='button'
        role='tab'
        aria-selected={activeTab === 'edit'}
        className={activeTab === 'edit' ? 'mobileTab active' : 'mobileTab'}
        onClick={() => onChange('edit')}
      >
        <svg
          viewBox='0 0 24 24'
          width='18'
          height='18'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <path d='M12 20h9' />
          <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
        </svg>
        <span className='mobileTabLabel'>{editLabel}</span>
      </button>
      <button
        type='button'
        role='tab'
        aria-selected={activeTab === 'preview'}
        className={activeTab === 'preview' ? 'mobileTab active' : 'mobileTab'}
        onClick={() => onChange('preview')}
      >
        <svg
          viewBox='0 0 24 24'
          width='18'
          height='18'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <rect x='6' y='2' width='12' height='20' rx='2.5' ry='2.5' />
          <line x1='12' y1='18' x2='12.01' y2='18' />
        </svg>
        <span className='mobileTabLabel'>Preview</span>
      </button>
    </nav>
  );
}
