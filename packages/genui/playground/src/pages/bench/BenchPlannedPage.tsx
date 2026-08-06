// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './BenchPlannedPage.css';

export function BenchPlannedPage() {
  return (
    <div className='benchPlannedPage'>
      <main className='benchPlannedMain'>
        <div className='benchPlannedIndex' aria-hidden='true'>
          02
        </div>

        <section className='benchPlannedStatement'>
          <div className='benchPlannedEyebrow'>
            <span aria-hidden='true' />
            Phase 02 · 研究计划
          </div>
          <h1>
            A2UI <i>×</i> OpenUI
          </h1>
          <p>
            协议对比尚未发布。这条稳定路由将用于承载二期研究结果，
            在发布前不会展示推测性指标。
          </p>
        </section>

        <dl className='benchPlannedMeta'>
          <div>
            <dt>Status</dt>
            <dd>Planning</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>#/bench/phase-2</dd>
          </div>
          <div>
            <dt>Study</dt>
            <dd>A2UI × OpenUI</dd>
          </div>
        </dl>

        <nav className='benchPlannedLinks' aria-label='Phase 02 actions'>
          <a href='#/bench'>
            <span aria-hidden='true'>←</span>
            返回 Runner
          </a>
          <a href='#/bench/phase-1'>
            查看 Phase 01
            <span aria-hidden='true'>↗</span>
          </a>
        </nav>
      </main>
    </div>
  );
}
