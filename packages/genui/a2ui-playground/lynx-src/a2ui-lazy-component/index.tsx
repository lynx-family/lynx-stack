// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './index.css';

interface LazyKpi {
  label?: string;
  value?: string;
  delta?: string;
}

interface LazyCardData {
  title?: string;
  subtitle?: string;
  accent?: string;
  kpis?: LazyKpi[];
}

interface LazyCardProps {
  sourceData?: LazyCardData;
}

function readKpis(value: LazyCardData | undefined): LazyKpi[] {
  return Array.isArray(value?.kpis) ? value.kpis : [];
}

function readPrimaryKpi(kpis: LazyKpi[]): LazyKpi {
  return kpis[0] ?? {
    label: 'Primary metric',
    value: '-',
    delta: '',
  };
}

export default function A2UILazyComponent(
  props: LazyCardProps,
): import('@lynx-js/react').ReactNode {
  const data = props.sourceData ?? {};
  const kpis = readKpis(data);
  const primaryKpi = readPrimaryKpi(kpis);
  const secondaryKpis = kpis.slice(1);
  const accent = data.accent ?? '#0f766e';

  return (
    <view className='lazy-card'>
      <view className='lazy-card-hero'>
        <view className='lazy-card-hero-stack'>
          <view
            className='lazy-card-accent'
            style={{
              backgroundColor: accent,
            }}
          />
          <view className='lazy-card-heading'>
            <text className='lazy-card-eyebrow'>
              ReactLynx lazy bundle
            </text>
            <text className='lazy-card-title'>
              {data.title ?? 'Lazy component card'}
            </text>
          </view>
        </view>
        <text className='lazy-card-subtitle'>
          {data.subtitle ?? 'Rendered from sourceData'}
        </text>
      </view>

      <view className='lazy-card-body'>
        <view className='lazy-card-primary'>
          <text className='lazy-card-label'>
            {primaryKpi.label ?? 'Metric'}
          </text>
          <view className='lazy-card-primary-stack'>
            <text className='lazy-card-primary-value'>
              {primaryKpi.value ?? '-'}
            </text>
            <view
              className='lazy-card-pill'
              style={{
                border: `1px solid ${accent}`,
              }}
            >
              <text
                className='lazy-card-pill-text'
                style={{
                  color: accent,
                }}
              >
                {primaryKpi.delta ?? ''}
              </text>
            </view>
          </view>
        </view>

        <view className='lazy-card-metrics'>
          {secondaryKpis.map((item, index) => (
            <view
              key={`${item.label ?? 'kpi'}-${index}`}
              className='lazy-card-metric'
              style={{
                marginBottom: index === secondaryKpis.length - 1
                  ? '0px'
                  : '7px',
              }}
            >
              <text className='lazy-card-label'>
                {item.label ?? 'Metric'}
              </text>
              <text className='lazy-card-metric-value'>
                {item.value ?? '-'}
              </text>
              <text
                className='lazy-card-delta'
                style={{
                  color: accent,
                }}
              >
                {item.delta ?? ''}
              </text>
            </view>
          ))}
        </view>
      </view>
    </view>
  );
}
