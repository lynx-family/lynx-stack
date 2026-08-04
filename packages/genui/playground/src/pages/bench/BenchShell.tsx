// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import type { BenchLocale } from './benchLocale.js';
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
  locale: BenchLocale;
  theme: Theme;
  onChangeLocale: (locale: BenchLocale) => void;
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
  locale: BenchLocale;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const Icon = props.theme === 'dark' ? Sun : Moon;
  const nextTheme = props.theme === 'dark' ? 'light' : 'dark';
  const label = props.locale === 'en-US'
    ? `Switch to ${nextTheme} mode`
    : `切换到${nextTheme === 'dark' ? '深色' : '浅色'}模式`;

  return (
    <button
      type='button'
      className={props.className}
      onClick={props.onToggleTheme}
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden='true' />
      <span className='benchShellVisuallyHidden'>
        {label}
      </span>
    </button>
  );
}

export function BenchShell(props: BenchShellProps) {
  const isEnglish = props.locale === 'en-US';

  return (
    <div className='benchShell' lang={isEnglish ? 'en' : 'zh-CN'}>
      <header className='benchShellMasthead'>
        <a className='benchShellBrand' href='#/bench'>
          <span className='benchShellBrandMark'>
            <img src={LYNX_LOGO_URL} alt='' aria-hidden='true' />
          </span>
          <strong>Lynx GenUI Bench</strong>
        </a>

        <nav
          className='benchShellNav'
          aria-label={isEnglish ? 'Bench sections' : 'Bench 页面'}
        >
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
          <div
            className='benchShellLocale'
            role='group'
            aria-label={isEnglish ? 'Language' : '语言'}
          >
            <button
              type='button'
              aria-pressed={!isEnglish}
              className={isEnglish ? undefined : 'active'}
              onClick={() => props.onChangeLocale('zh-CN')}
            >
              中文
            </button>
            <button
              type='button'
              aria-pressed={isEnglish}
              className={isEnglish ? 'active' : undefined}
              onClick={() => props.onChangeLocale('en-US')}
            >
              EN
            </button>
          </div>
          <ThemeButton
            className='benchShellUtility'
            locale={props.locale}
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
