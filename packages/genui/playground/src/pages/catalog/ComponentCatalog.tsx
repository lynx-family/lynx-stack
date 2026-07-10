// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';
import { useEffect, useMemo, useState } from 'react';

import { ComponentUsagePreview } from './ComponentUsagePreview.js';
import { PageHeader } from '../../components/PageHeader.js';
import type { Protocol } from '../../utils/protocol.js';

import './ComponentCatalog.css';

export interface ComponentCatalogCategory {
  readonly id: string;
  readonly label: string;
}

export interface ComponentCatalogProp {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly default?: string;
}

export interface ComponentCatalogDoc {
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly props: readonly ComponentCatalogProp[];
}

export interface ComponentCatalogUsageExample<TContext = undefined> {
  readonly label: string;
  readonly value: string;
  readonly context?: TContext;
}

interface ComponentCatalogPreview {
  error: string;
  url: string;
  readyEmptyTitle: string;
  invalidTitle: string;
}

interface BuildComponentCatalogPreviewArgs<
  TDoc extends ComponentCatalogDoc,
  TContext,
> {
  component: TDoc;
  value: string;
  example?: ComponentCatalogUsageExample<TContext>;
  protocol: Protocol;
  theme: 'light' | 'dark';
  baseUrl: string;
}

export interface ComponentCatalogUsageAdapter<
  TDoc extends ComponentCatalogDoc,
  TContext = undefined,
> {
  editorLabel: string;
  sideHint: string;
  hint: string;
  propsHint: string;
  extensions?: ReactCodeMirrorProps['extensions'];
  getExamples: (
    component: TDoc,
    protocol: Protocol,
  ) => readonly ComponentCatalogUsageExample<TContext>[];
  buildPreview: (
    args: BuildComponentCatalogPreviewArgs<TDoc, TContext>,
  ) => ComponentCatalogPreview;
}

export interface ComponentCatalogSource<
  TDoc extends ComponentCatalogDoc,
  TContext = undefined,
> {
  categories: readonly ComponentCatalogCategory[];
  components: readonly TDoc[];
  routeSegment: string;
  headerTitle: string;
  headerDescription: string;
  gridDescription: string;
  usage: ComponentCatalogUsageAdapter<TDoc, TContext>;
}

function ComponentDetail<
  TDoc extends ComponentCatalogDoc,
  TContext,
>(props: {
  component: TDoc;
  protocol: Protocol;
  source: ComponentCatalogSource<TDoc, TContext>;
  theme: 'light' | 'dark';
}) {
  const { component, protocol, source, theme } = props;
  const usageExamples = useMemo(
    () => source.usage.getExamples(component, protocol),
    [component, protocol, source],
  );
  const [selectedUsageExample, setSelectedUsageExample] = useState(0);
  const [usageValue, setUsageValue] = useState(
    () => usageExamples[0]?.value ?? '',
  );

  useEffect(() => {
    setSelectedUsageExample(0);
    setUsageValue(usageExamples[0]?.value ?? '');
  }, [usageExamples]);

  const selectedExample = usageExamples[selectedUsageExample]
    ?? usageExamples[0];
  const preview = useMemo(
    () =>
      source.usage.buildPreview({
        component,
        value: usageValue,
        example: selectedExample,
        protocol,
        theme,
        baseUrl: window.location.href.replace(/#.*$/u, ''),
      }),
    [
      component,
      protocol,
      selectedExample,
      source,
      theme,
      usageValue,
    ],
  );

  return (
    <div className='compContent'>
      <h2 className='compName'>{component.name}</h2>
      <p className='compDesc'>{component.description}</p>

      <section className='compPropsSection compUsageSection'>
        <div className='compSectionHeader'>
          <h3 className='compSubheading'>Props</h3>
          <div className='compPlaygroundSideHint'>
            {component.props.length} fields
          </div>
        </div>
        <p className='compUsageHint'>{source.usage.propsHint}</p>
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
              {component.props.map((prop) => (
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

      <ComponentUsagePreview
        editorLabel={source.usage.editorLabel}
        sideHint={source.usage.sideHint}
        hint={source.usage.hint}
        value={usageValue}
        onChange={setUsageValue}
        theme={theme}
        extensions={source.usage.extensions}
        error={preview.error}
        exampleTabs={usageExamples.length > 1
          ? {
            items: usageExamples,
            selectedIndex: selectedUsageExample,
            onSelect: (index) => {
              setSelectedUsageExample(index);
              setUsageValue(usageExamples[index]?.value ?? '');
            },
          }
          : undefined}
        preview={preview.url
          ? {
            kind: 'ready',
            src: preview.url,
            iframeTitle: `${component.name} preview`,
            emptyTitle: preview.readyEmptyTitle,
          }
          : {
            kind: 'invalid',
            title: preview.invalidTitle,
          }}
      />
    </div>
  );
}

export function ComponentCatalog<
  TDoc extends ComponentCatalogDoc,
  TContext,
>(props: {
  source: ComponentCatalogSource<TDoc, TContext>;
  protocol: Protocol;
  componentName?: string;
  theme: 'light' | 'dark';
  embedded?: boolean;
}) {
  const {
    componentName,
    embedded = false,
    protocol,
    source,
    theme,
  } = props;

  const selectedComponent = useMemo(
    () => (componentName
      ? source.components.find((component) => component.name === componentName)
      : undefined),
    [componentName, source],
  );

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, TDoc[]>();
    for (const category of source.categories) {
      const components = source.components.filter((component) =>
        component.category === category.id
      );
      if (components.length > 0) groups.set(category.id, components);
    }
    return groups;
  }, [source]);

  const allComponentsHref = `#/${protocol.name}/${source.routeSegment}`;
  const componentHref = (name: string) => `${allComponentsHref}/${name}`;

  const breadcrumb = selectedComponent
    ? (
      <nav
        aria-label='Breadcrumb'
        className='compBreadcrumb compResponsiveBreadcrumb'
      >
        <a className='compBreadcrumbLink' href={allComponentsHref}>
          ← All Components
        </a>
        <span className='compBreadcrumbSep'>/</span>
        <span className='compBreadcrumbCurrent'>
          {selectedComponent.name}
        </span>
      </nav>
    )
    : null;

  return (
    <div className='compPage'>
      <div className='compCatalogPage'>
        {embedded ? null : (
          <PageHeader
            className='compCatalogContent'
            titleClassName='compCatalogHeaderTitle'
            descriptionClassName='compCatalogHeaderDesc'
            title={source.headerTitle}
            description={source.headerDescription}
            topContent={
              <span className='chip'>
                {source.components.length} components
              </span>
            }
          />
        )}

        <div className='compCatalogSplit'>
          <div className='compSidebar compCatalogSidebar compResponsiveSidebar'>
            <a
              className={'compSidebarAll'
                + (selectedComponent ? '' : ' active')}
              href={allComponentsHref}
            >
              All Components
            </a>
            {source.categories.map((category) => {
              const components = groupedByCategory.get(category.id);
              if (!components) return null;
              return (
                <div
                  key={category.id}
                  className='compSidebarGroup'
                  id={`sidebar-${category.id}`}
                >
                  <div className='compSidebarGroupLabel'>
                    {category.label}
                  </div>
                  {components.map((component) => (
                    <a
                      key={component.name}
                      className={'compSidebarItem'
                        + (selectedComponent?.name === component.name
                          ? ' active'
                          : '')}
                      href={componentHref(component.name)}
                    >
                      {component.name}
                    </a>
                  ))}
                </div>
              );
            })}
          </div>

          <div className='compCatalogDetail'>
            {breadcrumb}
            {selectedComponent
              ? (
                <ComponentDetail
                  key={selectedComponent.name}
                  component={selectedComponent}
                  protocol={protocol}
                  source={source}
                  theme={theme}
                />
              )
              : (
                <div className='compContent'>
                  <h2 className='compName'>All Components</h2>
                  <p className='compDesc'>{source.gridDescription}</p>

                  {source.categories.map((category) => {
                    const components = groupedByCategory.get(category.id);
                    if (!components) return null;
                    return (
                      <div
                        key={category.id}
                        className='compCategorySection'
                      >
                        <h3 className='compCategoryTitle'>
                          {category.label}
                        </h3>
                        <div className='compGrid'>
                          {components.map((component) => (
                            <a
                              key={component.name}
                              className='compGridCard'
                              href={componentHref(component.name)}
                            >
                              <div className='compGridCardName'>
                                {component.name}
                              </div>
                              <div className='compGridCardDesc'>
                                {component.description}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
