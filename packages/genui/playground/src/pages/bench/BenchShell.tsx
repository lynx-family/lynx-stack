// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import { ChevronLeft, Moon, Sun } from '../../components/Icon.js';
import './BenchShell.css';

const LYNX_LOGO_URL = new URL(
  './assets/lynx-dark-logo.svg',
  import.meta.url,
).href;

type Theme = 'light' | 'dark';

interface BenchShellProps {
  activeSlug?: string;
  children: ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
}

interface BenchNavItem {
  href: string;
  label: string;
  slug: string;
}

const BENCH_NAV_ITEMS: BenchNavItem[] = [
  {
    href: '#/bench',
    label: 'Runner',
    slug: 'runner',
  },
  {
    href: '#/bench/phase-1',
    label: 'Phase 01',
    slug: 'phase-1',
  },
  {
    href: '#/bench/phase-2',
    label: 'Phase 02',
    slug: 'phase-2',
  },
];

function isActiveItem(
  activeSlug: string | undefined,
  item: BenchNavItem,
): boolean {
  if (item.slug === 'runner') {
    return activeSlug === undefined || activeSlug === 'runner';
  }

  return activeSlug === item.slug;
}

function ThemeButton(props: {
  className: string;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const Icon = props.theme === 'dark' ? Sun : Moon;
  const nextTheme = props.theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type='button'
      className={props.className}
      onClick={props.onToggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon aria-hidden='true' />
      <span className='benchShellVisuallyHidden'>
        Switch to {nextTheme} mode
      </span>
    </button>
  );
}

export function BenchShell(props: BenchShellProps) {
  return (
    <div className='benchShell'>
      <header className='benchShellMasthead'>
        <a className='benchShellBrand' href='#/bench'>
          <span className='benchShellBrandMark'>
            <img src={LYNX_LOGO_URL} alt='' aria-hidden='true' />
          </span>
          <strong>Lynx Bench</strong>
        </a>

        <nav className='benchShellNav' aria-label='Bench sections'>
          {BENCH_NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              className={isActiveItem(props.activeSlug, item)
                ? 'benchShellNavItem active'
                : 'benchShellNavItem'}
              href={item.href}
              aria-current={isActiveItem(props.activeSlug, item)
                ? 'page'
                : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className='benchShellUtilities'>
          <a className='benchShellUtility' href='#/a2ui'>
            <ChevronLeft aria-hidden='true' />
            <span>Playground</span>
          </a>
          <ThemeButton
            className='benchShellUtility'
            theme={props.theme}
            onToggleTheme={props.onToggleTheme}
          />
        </div>
      </header>

      <div className='benchShellMain'>
        {props.children}
      </div>
    </div>
  );
}
