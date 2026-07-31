// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BenchPage } from '../BenchPage.js';
import type { BenchLocale } from './benchLocale.js';
import './BenchRunnerPage.css';

export function BenchRunnerPage(props: { locale?: BenchLocale }) {
  const locale = props.locale ?? 'zh-CN';
  const isEnglish = locale === 'en-US';

  return (
    <div className='benchRunnerPage'>
      <header className='benchRunnerHeader'>
        <div>
          <h1>Bench Runner</h1>
          <p>
            {isEnglish
              ? 'Combine Protocol, Model, Prompt, and Catalog freely in one run plan.'
              : '在一份运行计划中自由组合 Protocol、Model、Prompt 与 Catalog。'}
          </p>
        </div>
        <span>
          {isEnglish ? 'Unified setup · Live report' : '统一配置 · 实时报告'}
        </span>
      </header>

      <div className='benchRunnerWorkspace'>
        <BenchPage locale={locale} showHeader={false} />
      </div>
    </div>
  );
}
