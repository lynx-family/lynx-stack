// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useState } from 'react';

import { CATEGORIES, COMPONENT_CATALOG } from '../catalog/a2ui.js';
import type { ComponentDoc } from '../catalog/a2ui.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

import './ComponentsPage.css';

const jsonExtensions = [json()];

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function createComponentPreviewMessages(
  comp: ComponentDoc,
  usage: unknown,
): unknown[] {
  const components = Array.isArray(usage) ? usage : [usage];
  return [
    {
      createSurface: {
        surfaceId: 'default',
        catalogId: `component-${comp.name.toLowerCase()}`,
      },
      updateComponents: {
        surfaceId: 'default',
        components,
      },
    },
  ];
}

function ComponentDetail(
  props: {
    comp: ComponentDoc;
    protocol: Protocol;
    theme: 'light' | 'dark';
  },
) {
  const { comp, protocol, theme } = props;
  const usageExamples = comp.usageExamples[protocol.name];
  const [selectedUsageExample, setSelectedUsageExample] = useState(0);
  const [usageJson, setUsageJson] = useState(() =>
    formatJson(usageExamples[0]?.value ?? comp.usage[protocol.name])
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedUsageExample(0);
    setUsageJson(
      formatJson(usageExamples[0]?.value ?? comp.usage[protocol.name]),
    );
  }, [comp, protocol, usageExamples]);

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
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        messages: createComponentPreviewMessages(comp, parsedUsage.value),
        theme,
        instant: true,
      },
      baseUrl,
    );
  }, [comp, parsedUsage, protocol, theme]);

  return (
    <div className='compContent'>
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

      <h2 className='compName'>{comp.name}</h2>
      <p className='compDesc'>{comp.description}</p>

      <section className='compPropsSection compUsageSection'>
        <div className='compSectionHeader'>
          <h3 className='compSubheading'>Props</h3>
          <div className='compPlaygroundSideHint'>
            {comp.props.length} fields
          </div>
        </div>
        <p className='compUsageHint'>
          Reference the available props before editing the usage JSON below.
        </p>
        <div className='compPropsTableWrap'>
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

      <section className='compUsageSection'>
        <div className='compSectionHeader compUsageSectionHeader'>
          <h3 className='compSubheading'>Usage</h3>
          <div className='compPlaygroundSideHint'>
            JSON editor and live phone preview
          </div>
        </div>
        <p className='compUsageHint'>
          Edit the JSON below to change the component preview instantly.
        </p>
        <div className='compEditorPreviewRow'>
          <section className='compUsagePane'>
            {usageExamples.length > 1
              ? (
                <div className='compUsageExamples'>
                  {usageExamples.map((example, index) => (
                    <button
                      key={example.label}
                      className={'compUsageExample'
                        + (selectedUsageExample === index ? ' active' : '')}
                      type='button'
                      onClick={() => {
                        setSelectedUsageExample(index);
                        setUsageJson(formatJson(example.value));
                      }}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              )
              : null}
            <div className='compUsageEditorToolbar'>
              <div className='compUsageEditorLabel'>JSON</div>
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
              className={theme === 'dark'
                ? 'compUsageEditor compUsageEditorDark'
                : 'compUsageEditor compUsageEditorLight'}
              value={usageJson}
              extensions={jsonExtensions}
              onChange={setUsageJson}
              theme={theme}
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
          </section>

          <section className='compPreviewPane'>
            <div className='compPreviewStage'>
              {previewUrl
                ? (
                  <PreviewViewport
                    src={previewUrl}
                    iframeTitle={`${comp.name} preview`}
                    emptyTitle='Fix the Usage JSON to update the preview.'
                  />
                )
                : (
                  <div className='compPreviewInvalid'>
                    Fix the Usage JSON to update the preview.
                  </div>
                )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ComponentGrid(props: { protocol: Protocol }) {
  const { protocol } = props;

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

export function ComponentsPage(
  props: {
    protocol: Protocol;
    componentName?: string;
    theme: 'light' | 'dark';
  },
) {
  const { protocol, componentName, theme } = props;

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
          href={`#/${protocol.name}/components`}
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
                  href={`#/${protocol.name}/components/${comp.name}`}
                >
                  {comp.name}
                </a>
              ))}
            </div>
          );
        })}
      </div>

      {selectedComp
        ? (
          <ComponentDetail
            comp={selectedComp}
            protocol={protocol}
            theme={theme}
          />
        )
        : <ComponentGrid protocol={protocol} />}
    </div>
  );
}
