// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Chip } from '../components/Chip.js';
import { SUPPORTED_COMPONENTS } from '../demos.js';
import type { Protocol } from '../utils/protocol.js';

export function HomePage(props: { protocol: Protocol }) {
  const { protocol } = props;
  const base = `#/${protocol.name}`;

  return (
    <div className='page'>
      <header className='hero'>
        <div className='heroBadge'>
          {protocol.name.toUpperCase()} v{protocol.version}
        </div>
        <h1 className='heroTitle'>A2UI Renderer</h1>
        <p className='heroSubtitle'>
          Render declarative A2UI JSON into interactive UI, with both static and
          dynamic modes.
        </p>
      </header>

      <section className='homeCards'>
        <a className='homeCard' href={`${base}/static`}>
          <div className='homeIcon'>▦</div>
          <div className='homeCardTitle'>Static Rendering</div>
          <div className='homeCardDesc'>
            Browse multiple A2UI cards to validate composition and baseline
            rendering.
          </div>
          <div className='chipRow'>
            {['Card', 'Form', 'List', 'Progress', 'Accordion'].map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </a>

        <a className='homeCard' href={`${base}/dynamic`}>
          <div className='homeIcon'>⚡</div>
          <div className='homeCardTitle'>Dynamic Rendering</div>
          <div className='homeCardDesc'>
            Presets and custom JSON. Useful for testing actions and incremental
            updates.
          </div>
          <div className='chipRow'>
            {['Preset', 'JSON', 'Action'].map((t) => <Chip key={t}>{t}</Chip>)}
          </div>
        </a>
      </section>

      <section className='supportedSection'>
        <h2 className='sectionTitle'>Supported Components</h2>
        <div className='chipWall'>
          {SUPPORTED_COMPONENTS.map((name) => <Chip key={name}>{name}</Chip>)}
        </div>
      </section>

      <footer className='footerNote'>
        A2UI is an open standard that enables agents to generate UI via
        declarative JSON.
      </footer>
    </div>
  );
}
