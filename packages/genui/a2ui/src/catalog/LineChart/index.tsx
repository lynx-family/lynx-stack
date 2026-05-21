// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useResolvedProps } from '../../react/useDataBinding.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/LineChart.css';

type ChartVariant = 'linear' | 'natural' | 'step';

export interface LineChartSeries {
  name: string;
  values: number[];
  color?: string;
}

/**
 * @a2uiCatalog LineChart
 */
export interface LineChartProps extends GenericComponentProps {
  /** Category labels shown along the x axis. */
  labels: string[] | { path: string };
  /** One or more line series to render over the shared labels. */
  series:
    | Array<{
      name: string;
      values: number[];
      color?: string;
    }>
    | { path: string };
  variant?: 'linear' | 'natural' | 'step';
  xLabel?: string;
  yLabel?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
}

const SVG_WIDTH = 360;
const DEFAULT_HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 24, left: 16 };
const DEFAULT_COLORS = [
  '#0057d9',
  '#0a8f8f',
  '#8a5cf6',
  '#d92d20',
  '#2d6a4f',
  '#b26a00',
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value) >= 1000
    ? Math.round(value)
    : Number(value.toFixed(1));
  return String(rounded);
}

function normalizeSeries(
  series: LineChartSeries[],
  palette: readonly string[],
): LineChartSeries[] {
  return series.map((item, index) => ({
    name: item.name,
    values: item.values,
    color: item.color ?? palette[index % palette.length] ?? '#0057d9',
  }));
}

function buildLinearPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  const rest = points.slice(1);
  let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (const point of rest) {
    path += ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }
  return path;
}

function buildStepPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  const rest = points.slice(1);
  let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  let prev = first;
  for (const point of rest) {
    path += ` L ${point.x.toFixed(1)} ${prev.y.toFixed(1)}`;
    path += ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    prev = point;
  }
  return path;
}

function buildNaturalPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const point = points[0]!;
    return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }

  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${
      cp2x.toFixed(
        1,
      )
    } ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function buildPath(
  points: Array<{ x: number; y: number }>,
  variant: ChartVariant,
): string {
  switch (variant) {
    case 'step':
      return buildStepPath(points);
    case 'natural':
      return buildNaturalPath(points);
    default:
      return buildLinearPath(points);
  }
}

function sampleIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const step = Math.ceil(count / maxLabels);
  const indices: number[] = [];
  for (let index = 0; index < count; index += step) {
    indices.push(index);
  }
  const last = count - 1;
  if (indices[indices.length - 1] !== last) {
    indices.push(last);
  }
  return Array.from(new Set(indices));
}

function minMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }
  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return { min, max };
}

function buildSvgMarkup(
  labels: string[],
  series: LineChartSeries[],
  variant: ChartVariant,
  showGrid: boolean,
): string {
  const width = SVG_WIDTH;
  const height = DEFAULT_HEIGHT;
  const chartWidth = width - MARGIN.left - MARGIN.right;
  const chartHeight = height - MARGIN.top - MARGIN.bottom;
  const maxPoints = labels.length;
  const values = series.flatMap((item) => item.values.slice(0, maxPoints));

  if (maxPoints === 0 || series.length === 0 || values.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
  }

  const { min: minValue, max: maxValue } = minMax(values);
  const yRange = maxValue - minValue;
  const xStep = maxPoints > 1 ? chartWidth / (maxPoints - 1) : 0;
  const gridLines = 4;

  const lineMarkup = series
    .map((item, seriesIndex) => {
      const points = item.values.slice(0, maxPoints).map((value, index) => {
        const x = MARGIN.left + xStep * index;
        const y = MARGIN.top + chartHeight
          - ((value - minValue) / yRange) * chartHeight;
        return { x, y };
      });

      const color = escapeXml(
        item.color ?? DEFAULT_COLORS[seriesIndex % DEFAULT_COLORS.length]
          ?? '#0057d9',
      );
      const d = buildPath(points, variant);
      const circles = points
        .map((point) =>
          `<circle cx="${point.x.toFixed(1)}" cy="${
            point.y.toFixed(1)
          }" r="3.5" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`
        )
        .join('');

      return `
        <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${circles}
      `;
    })
    .join('');

  const gridMarkup = showGrid
    ? Array.from({ length: gridLines + 1 }, (_, index) => {
      const ratio = index / gridLines;
      const y = MARGIN.top + chartHeight - ratio * chartHeight;
      const dashed = index === gridLines ? '' : ' stroke-dasharray="4 6"';
      return `<line x1="${MARGIN.left}" y1="${y.toFixed(1)}" x2="${
        width - MARGIN.right
      }" y2="${
        y.toFixed(1)
      }" stroke="rgba(0,0,0,0.12)" stroke-width="1"${dashed} />`;
    }).join('')
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="rgba(255,255,255,0.02)" />
      ${gridMarkup}
      <line x1="${MARGIN.left}" y1="${height - MARGIN.bottom}" x2="${
    width - MARGIN.right
  }" y2="${
    height - MARGIN.bottom
  }" stroke="rgba(0,0,0,0.24)" stroke-width="1.5" />
      ${lineMarkup}
    </svg>
  `;
}

export function LineChart(
  props: LineChartProps,
): import('@lynx-js/react').ReactNode {
  const [resolvedProps] = useResolvedProps(
    props,
    props.surface,
    props.dataContextPath,
  );
  const id = props.id;
  const labelsValue = resolvedProps['labels'];
  const labels = Array.isArray(labelsValue)
    ? (labelsValue as string[])
    : [];
  const seriesValue = resolvedProps['series'];
  const series = Array.isArray(seriesValue)
    ? normalizeSeries(seriesValue as LineChartSeries[], DEFAULT_COLORS)
    : [];
  const variant = (resolvedProps['variant'] as ChartVariant | undefined)
    ?? 'natural';
  const showGrid = resolvedProps['showGrid'] !== false;
  const showLegend = resolvedProps['showLegend'] !== false;
  const heightValue = resolvedProps['height'];
  const height = typeof heightValue === 'number'
    ? heightValue
    : DEFAULT_HEIGHT;
  const svgMarkup = buildSvgMarkup(labels, series, variant, showGrid);
  const visibleLabelIndices = sampleIndices(labels.length, 8);
  const { min, max } = minMax(
    series.flatMap((item) => item.values.slice(0, labels.length)),
  );

  return (
    <view key={id} className='line-chart'>
      <view className='line-chart-header'>
        <view className='line-chart-header-copy'>
          <text className='line-chart-title'>
            {(resolvedProps['yLabel'] as string | undefined) ?? 'Line chart'}
          </text>
          <text className='line-chart-caption'>
            {series.length > 0
              ? `${series.length} series • ${labels.length} points`
              : 'No data'}
          </text>
        </view>
        {(resolvedProps['xLabel'] as string | undefined)
          ? (
            <text className='line-chart-axis-label'>
              {resolvedProps['xLabel'] as string}
            </text>
          )
          : null}
      </view>

      <view className='line-chart-scale-row'>
        <text className='line-chart-scale-value'>{formatValue(min)}</text>
        <text className='line-chart-scale-value line-chart-scale-value-right'>
          {formatValue(max)}
        </text>
      </view>

      <svg
        className='line-chart-svg'
        content={svgMarkup}
        style={{ width: '100%', height: `${height}px` }}
      />

      <view className='line-chart-axis-row'>
        {visibleLabelIndices.map((index) => (
          <view
            key={`${index}-${labels[index] ?? index}`}
            className='line-chart-axis-tick'
          >
            <text className='line-chart-axis-tick-label'>
              {labels[index] ?? ''}
            </text>
          </view>
        ))}
      </view>

      {showLegend
        ? (
          <view className='line-chart-legend'>
            {series.map((item, index) => (
              <view
                key={item.name}
                className='line-chart-legend-item'
              >
                <view
                  className='line-chart-legend-swatch'
                  style={{
                    backgroundColor: item.color
                      ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                      ?? '#0057d9',
                  }}
                />
                <text className='line-chart-legend-label'>{item.name}</text>
              </view>
            ))}
          </view>
        )
        : null}
    </view>
  );
}
