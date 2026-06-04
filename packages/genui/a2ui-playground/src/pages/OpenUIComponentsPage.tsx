// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from 'react';

import {
  OPENUI_CATEGORIES,
  OPENUI_COMPONENT_CATALOG,
} from '../catalog/openui.js';
import type { OpenUIComponentDoc } from '../catalog/openui.js';
import { PageHeader } from '../components/PageHeader.js';
import type { Protocol } from '../utils/protocol.js';

import './ComponentsPage.css';

function getOpenUICategoryLabel(categoryId: string): string {
  return OPENUI_CATEGORIES.find((cat) => cat.id === categoryId)?.label
    ?? categoryId;
}

// ─── Components ─────────────────────────────────────────────────────────────

function ComponentDetail(props: {
  comp: OpenUIComponentDoc;
  protocol: Protocol;
}) {
  const { comp, protocol } = props;

  return (
    <div className='compContent openuiCompContent openuiCompDetailContent'>
      <div className='compBreadcrumb'>
        <a
          className='compBreadcrumbLink'
          href={`#/${protocol.name}/components`}
        >
          Components
        </a>
        <span className='compBreadcrumbSep'>/</span>
        <span className='compBreadcrumbCurrent'>{comp.name}</span>
      </div>

      <div className='openuiCompIntro'>
        <div className='compCategoryBadge'>
          {getOpenUICategoryLabel(comp.category)}
        </div>
        <h2 className='compName'>{comp.name}</h2>
        <p className='compDesc'>{comp.description}</p>
      </div>

      {comp.props.length > 0
        ? (
          <section className='compPropsSection compUsageSection openuiCompSection'>
            <div className='compSectionHeader'>
              <h3 className='compSubheading'>Props</h3>
              <div className='compPlaygroundSideHint'>
                {comp.props.length} fields
              </div>
            </div>
            <div className='compPropsTableWrap openuiCompPropsTableWrap'>
              <table className='compTable compPropsTable'>
                <thead>
                  <tr>
                    <th className='compTableHeader'>Name</th>
                    <th className='compTableHeader'>Type</th>
                    <th className='compTableHeader'>Description</th>
                    <th className='compTableHeader'>Default</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.props.map((prop) => (
                    <tr key={prop.name}>
                      <td className='compTableCell'>{prop.name}</td>
                      <td className='compTableCell'>{prop.type}</td>
                      <td className='compTableCell'>{prop.description}</td>
                      <td className='compTableCell'>{prop.default ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
        : null}

      <section className='compUsageSection openuiCompSection'>
        <div className='compSectionHeader compUsageSectionHeader'>
          <h3 className='compSubheading'>Usage</h3>
          <div className='compPlaygroundSideHint'>OpenUI DSL</div>
        </div>
        <pre className='compCodeBlock openuiCompDslBlock'>{comp.usage}</pre>
      </section>
    </div>
  );
}

function ComponentGrid(props: { protocol: Protocol }) {
  const { protocol } = props;

  return (
    <div className='compContent openuiCompContent'>
      <h2 className='compName'>OpenUI Components</h2>
      <p className='compDesc'>
        Browse all supported OpenUI components by category.
      </p>

      {OPENUI_CATEGORIES.map((cat) => {
        const items = OPENUI_COMPONENT_CATALOG.filter((c) =>
          c.category === cat.id
        );
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className='compCategorySection'>
            <div className='openuiCompCategoryHeader'>
              <h3 className='compCategoryTitle'>{cat.label}</h3>
              <span className='openuiCompCategoryCount'>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className='compGrid'>
              {items.map((comp) => (
                <a
                  key={comp.name}
                  className='compGridCard openuiCompGridCard'
                  href={`#/${protocol.name}/components/${comp.name}`}
                >
                  <div className='compGridCardName'>{comp.name}</div>
                  <div className='compGridCardDesc'>{comp.description}</div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function OpenUIComponentsPage(
  props: { protocol: Protocol; componentName?: string },
) {
  const { protocol, componentName } = props;

  const selectedComp = useMemo(
    () =>
      componentName
        ? OPENUI_COMPONENT_CATALOG.find((c) => c.name === componentName)
        : undefined,
    [componentName],
  );

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, OpenUIComponentDoc[]>();
    for (const cat of OPENUI_CATEGORIES) {
      const items = OPENUI_COMPONENT_CATALOG.filter((c) =>
        c.category === cat.id
      );
      if (items.length > 0) map.set(cat.id, items);
    }
    return map;
  }, []);

  return (
    <div className='compPage openuiCompPage'>
      <div className='compCatalogPage openuiCompCatalogPage'>
        <PageHeader
          className='compCatalogContent openuiCompHeader'
          title='OpenUI Components'
          description='Browse the OpenUI DSL component catalog, prop contracts, and usage snippets.'
          topContent={
            <>
              <span className='chip'>
                {OPENUI_COMPONENT_CATALOG.length} components
              </span>
              <span className='chip'>
                {OPENUI_CATEGORIES.length} categories
              </span>
            </>
          }
        />

        <div className='compCatalogSplit openuiCompSplit'>
          <div className='compSidebar compCatalogSidebar openuiCompSidebar'>
            <a
              className={'compSidebarAll' + (componentName ? '' : ' active')}
              href={`#/${protocol.name}/components`}
            >
              All Components
            </a>

            {OPENUI_CATEGORIES.map((cat) => {
              const items = groupedByCategory.get(cat.id);
              if (!items) return null;
              return (
                <div key={cat.id} className='compSidebarGroup'>
                  <div className='compSidebarGroupLabel'>{cat.label}</div>
                  {items.map((comp) => (
                    <a
                      key={comp.name}
                      className={'compSidebarItem'
                        + (componentName === comp.name ? ' active' : '')}
                      href={`#/${protocol.name}/components/${comp.name}`}
                    >
                      {comp.name}
                    </a>
                  ))}
                </div>
              );
            })}
          </div>

          <div className='compCatalogDetail openuiCompDetail'>
            {selectedComp
              ? <ComponentDetail comp={selectedComp} protocol={protocol} />
              : <ComponentGrid protocol={protocol} />}
          </div>
        </div>
      </div>
    </div>
  );
}
