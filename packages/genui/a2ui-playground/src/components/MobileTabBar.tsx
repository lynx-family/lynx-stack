// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ICON_SIZE, Pencil, Smartphone } from './Icon.js';

export type MobilePaneTab = 'edit' | 'preview';

interface MobileTabBarProps {
  activeTab: MobilePaneTab;
  onChange: (tab: MobilePaneTab) => void;
  editLabel?: string;
}

export function MobileTabBar(props: MobileTabBarProps) {
  const { activeTab, editLabel = 'Edit', onChange } = props;
  const tabIconSize = ICON_SIZE.xl;
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
        <Pencil size={tabIconSize} strokeWidth={2} aria-hidden='true' />
        <span className='mobileTabLabel'>{editLabel}</span>
      </button>
      <button
        type='button'
        role='tab'
        aria-selected={activeTab === 'preview'}
        className={activeTab === 'preview' ? 'mobileTab active' : 'mobileTab'}
        onClick={() => onChange('preview')}
      >
        <Smartphone size={tabIconSize} strokeWidth={2} aria-hidden='true' />
        <span className='mobileTabLabel'>Preview</span>
      </button>
    </nav>
  );
}
