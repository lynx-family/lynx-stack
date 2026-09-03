// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import { Button } from './Button.js';
import { Moon, Sun } from './Icon.js';

export interface PlaygroundChromeTab {
  id: string;
  label: string;
}

export interface PlaygroundChromeProtocolOption {
  value: string;
  label: string;
}

export interface PlaygroundChromeProps {
  embedded?: boolean;
  showTopBar?: boolean;
  theme: 'light' | 'dark';
  lightLogoSrc: string;
  darkLogoSrc: string;
  tabs: readonly PlaygroundChromeTab[];
  activeTab: string;
  onTabSelect: (id: string) => void;
  protocolValue: string;
  protocolOptions: readonly PlaygroundChromeProtocolOption[];
  protocolDisabled?: boolean;
  onProtocolSelect: (value: string) => void;
  onThemeToggle: () => void;
  children: ReactNode;
}

export function PlaygroundChrome(props: PlaygroundChromeProps) {
  const {
    activeTab,
    children,
    darkLogoSrc,
    embedded = false,
    lightLogoSrc,
    onProtocolSelect,
    onTabSelect,
    onThemeToggle,
    protocolDisabled = false,
    protocolOptions,
    protocolValue,
    showTopBar = true,
    tabs,
    theme,
  } = props;
  return (
    <div className={embedded ? 'appShell appShellEmbedded' : 'appShell'}>
      {showTopBar
        ? (
          <div className='topBar'>
            <div className='brandGroup'>
              <img
                className='brandLogo'
                src={theme === 'dark' ? darkLogoSrc : lightLogoSrc}
                alt='Lynx'
              />
              <span className='brand'>Lynx GenUI Playground</span>
            </div>

            <nav className='tabNav'>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type='button'
                  className={activeTab === tab.id
                    ? 'tabNavItem active'
                    : 'tabNavItem'}
                  onClick={() => onTabSelect(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className='spacer' />

            <div className='protocolControl'>
              <div className='protocolLabel'>Protocol</div>
              <select
                className='protocolSelect'
                value={protocolValue}
                disabled={protocolDisabled}
                onChange={(event) => onProtocolSelect(event.target.value)}
              >
                {protocolOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant='ghost'
              size='sm'
              iconOnly
              iconBefore={theme === 'dark' ? Sun : Moon}
              className='themeToggle'
              onClick={onThemeToggle}
              aria-label={`Switch to ${
                theme === 'dark' ? 'light' : 'dark'
              } mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            />
          </div>
        )
        : null}

      <div className='appBody'>{children}</div>
    </div>
  );
}
