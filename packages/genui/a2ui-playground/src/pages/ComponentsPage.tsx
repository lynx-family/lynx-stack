// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useState } from 'react';

import { CATEGORIES, COMPONENT_CATALOG } from '../componentCatalog.js';
import type { ComponentDoc } from '../componentCatalog.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { DEFAULT_DEMO_URL } from '../utils/demoUrl.js';
import type { ProtocolVersion } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

const jsonExtensions = [json()];

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function createComponentPreviewMessages(
  comp: ComponentDoc,
  usage: unknown,
): unknown[] {
  return [
    {
      createSurface: {
        surfaceId: 'default',
        catalogId: `component-${comp.name.toLowerCase()}`,
      },
      updateComponents: {
        surfaceId: 'default',
        components: [usage],
      },
    },
  ];
}

function ComponentDetail(
  props: { comp: ComponentDoc; protocol: ProtocolVersion },
) {
  const { comp, protocol } = props;
  const [usageJson, setUsageJson] = useState(() =>
    formatJson(comp.usage[protocol])
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUsageJson(formatJson(comp.usage[protocol]));
  }, [comp, protocol]);

  const parsedUsage = useMemo(() => {
    try {
      return { error: '', value: JSON.parse(usageJson) as unknown };
    } catch (e) {
      return { error: `Invalid JSON: ${String(e)}`, value: null };
    }
  }, [usageJson]);

  const previewUrl = useMemo(() => {
    if (parsedUsage.error) return '';
    const baseUrl = window.location.href.replace(/#.*$/u, '');
    return buildRenderUrl(
      {
        protocol,
        demoUrl: DEFAULT_DEMO_URL,
        messages: createComponentPreviewMessages(comp, parsedUsage.value),
      },
      baseUrl,
    );
  }, [comp, parsedUsage, protocol]);

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

      <div className='compSectionHeader'>
        <h3 className='compSubheading'>Usage</h3>
        <button
          className='compCopyBtn'
          type='button'
          title={copied ? 'Copied' : 'Copy JSON'}
          onClick={() => {
            void copyToClipboard(usageJson).then((ok) => {
              if (!ok) return;
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <CodeMirror
        className='compUsageEditor'
        value={usageJson}
        extensions={jsonExtensions}
        onChange={setUsageJson}
        theme='dark'
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
        }}
      />
      {parsedUsage.error
        ? <div className='compUsageError'>{parsedUsage.error}</div>
        : null}

      <h3 className='compSubheading'>Preview</h3>
      <div className='compPreview'>
        {previewUrl
          ? (
            <iframe
              className='compPreviewIframe'
              title={`${comp.name} preview`}
              src={previewUrl}
            />
          )
          : (
            <div className='compPreviewInvalid'>
              Fix the Usage JSON to update the preview.
            </div>
          )}
      </div>
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
