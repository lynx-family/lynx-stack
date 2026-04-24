// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from 'react';

import { CATEGORIES, COMPONENT_CATALOG } from '../componentCatalog.js';
import type { ComponentDoc } from '../componentCatalog.js';
import type { ProtocolVersion } from '../utils/protocol.js';

function ComponentDetail(
  props: { comp: ComponentDoc; protocol: ProtocolVersion },
) {
  const { comp, protocol } = props;
  return (
    <div className='compContent'>
      <div className='compBreadcrumb'>
        <a className='compBreadcrumbLink' href='#/components'>Components</a>
        <span className='compBreadcrumbSep'>/</span>
        <span className='compBreadcrumbCurrent'>{comp.name}</span>
      </div>

      <h2 className='compName'>{comp.name}</h2>
      <p className='compDesc'>{comp.description}</p>

      <div className='compCategoryBadge'>{comp.category}</div>

      <h3 className='compSubheading'>Usage</h3>
      <pre className='compCodeBlock'>
        {JSON.stringify(comp.usage[protocol], null, 2)}
      </pre>

      <h3 className='compSubheading'>Props</h3>
      <table className='compTable'>
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
  );
}

function ComponentGrid() {
  return (
    <div className='compContent'>
      <h2 className='compName'>Components</h2>
      <p className='compDesc'>
        Browse all supported A2UI components by category.
      </p>

      {CATEGORIES.map((cat) => {
        const items = COMPONENT_CATALOG.filter((c) => c.category === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className='compCategorySection'>
            <h3 className='compCategoryTitle'>{cat.label}</h3>
            <div className='compGrid'>
              {items.map((comp) => (
                <a
                  key={comp.name}
                  className='compGridCard'
                  href={`#/components/${comp.name}`}
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

export function ComponentsPage(
  props: { protocol: ProtocolVersion; componentName?: string },
) {
  const { protocol, componentName } = props;

  const selectedComp = useMemo(
    () => (componentName
      ? COMPONENT_CATALOG.find((c) => c.name === componentName)
      : undefined),
    [componentName],
  );

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, ComponentDoc[]>();
    for (const cat of CATEGORIES) {
      const items = COMPONENT_CATALOG.filter((c) => c.category === cat.id);
      if (items.length > 0) map.set(cat.id, items);
    }
    return map;
  }, []);

  return (
    <div className='compPage'>
      <div className='compSidebar'>
        <a
          className={'compSidebarAll' + (componentName ? '' : ' active')}
          href='#/components'
        >
          All Components
        </a>

        {CATEGORIES.map((cat) => {
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
                  href={`#/components/${comp.name}`}
                >
                  {comp.name}
                </a>
              ))}
            </div>
          );
        })}
      </div>

      {selectedComp
        ? <ComponentDetail comp={selectedComp} protocol={protocol} />
        : <ComponentGrid />}
    </div>
  );
}
