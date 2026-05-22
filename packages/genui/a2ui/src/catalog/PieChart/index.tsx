// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useResolvedProps } from '../../react/useDataBinding.js';
import type { GenericComponentProps } from '../../store/types.js';
import {
  DEFAULT_CHART_COLORS,
  escapeXml,
  formatValue,
} from '../utils/chart.js';

import '../../../styles/catalog/PieChart.css';

export interface PieChartSlice {
  name: string;
  value: number;
  color?: string;
}

type PieChartVariant = 'pie' | 'donut';

const SVG_WIDTH = 360;
const SVG_HEIGHT = 220;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = SVG_HEIGHT / 2;
const DEFAULT_OUTER_RADIUS = 84;
const DEFAULT_DONUT_INNER_RADIUS = 52;

/**
 * @a2uiCatalog PieChart
 */
export interface PieChartProps extends GenericComponentProps {
  /** Pie slices to render. */
  data:
    | Array<{
      name: string;
      value: number;
      color?: string;
    }>
    | { path: string };
  /** Render the chart as a flat pie or a donut. */
  variant?: 'pie' | 'donut';
  /** Optional title shown above the chart. */
  title?: string;
  /** Optional subtitle shown under the title. */
  subtitle?: string;
  /** Show the legend below the chart. */
  showLegend?: boolean;
  /** Show percentage values in the legend. */
  showPercentages?: boolean;
  /** Chart height in pixels. */
  height?: number;
  /** Padding angle between slices, in degrees. */
  paddingAngle?: number;
  /** Custom color palette for the slices. */
  colors?: string[];
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Number(value.toFixed(1))}%`;
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
): { x: number; y: number } {
  const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180);
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeSlicePath(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(
    centerX,
    centerY,
    outerRadius,
    startAngle,
  );
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? '1' : '0';

  if (innerRadius <= 0) {
    return [
      `M ${centerX.toFixed(1)} ${centerY.toFixed(1)}`,
      `L ${outerStart.x.toFixed(1)} ${outerStart.y.toFixed(1)}`,
      `A ${outerRadius.toFixed(1)} ${
        outerRadius.toFixed(1)
      } 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(1)} ${outerEnd.y.toFixed(1)}`,
      'Z',
    ].join(' ');
  }

  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const innerStart = polarToCartesian(
    centerX,
    centerY,
    innerRadius,
    startAngle,
  );

  return [
    `M ${outerStart.x.toFixed(1)} ${outerStart.y.toFixed(1)}`,
    `A ${outerRadius.toFixed(1)} ${
      outerRadius.toFixed(1)
    } 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(1)} ${outerEnd.y.toFixed(1)}`,
    `L ${innerEnd.x.toFixed(1)} ${innerEnd.y.toFixed(1)}`,
    `A ${innerRadius.toFixed(1)} ${
      innerRadius.toFixed(1)
    } 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(1)} ${
      innerStart.y.toFixed(1)
    }`,
    'Z',
  ].join(' ');
}

function buildSvgMarkup(
  slices: PieChartSlice[],
  variant: PieChartVariant,
  paddingAngle: number,
  palette: readonly string[],
): string {
  const total = slices.reduce(
    (sum, slice) => sum + Math.max(0, Number(slice.value) || 0),
    0,
  );

  if (total <= 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"></svg>`;
  }

  const outerRadius = DEFAULT_OUTER_RADIUS;
  const innerRadius = variant === 'donut' ? DEFAULT_DONUT_INNER_RADIUS : 0;
  const gap = Math.max(0, paddingAngle);

  let currentAngle = -90;
  const segments = slices
    .map((slice, index) => {
      const value = Math.max(0, Number(slice.value) || 0);
      if (value <= 0) {
        return null;
      }

      const sliceAngle = (value / total) * 360;
      const gapForSlice = Math.min(gap, sliceAngle * 0.45);
      const startAngle = currentAngle + gapForSlice / 2;
      const endAngle = currentAngle + sliceAngle - gapForSlice / 2;
      currentAngle += sliceAngle;

      if (endAngle <= startAngle) {
        return null;
      }

      const color = escapeXml(
        slice.color ?? palette[index % palette.length]
          ?? DEFAULT_CHART_COLORS[0],
      );
      const path = describeSlicePath(
        CENTER_X,
        CENTER_Y,
        outerRadius,
        innerRadius,
        startAngle,
        endAngle,
      );
      return `<path d="${path}" fill="${color}" stroke="var(--a2ui-color-surface)" stroke-width="2" />`;
    })
    .filter((segment): segment is string => segment !== null)
    .join('');

  const backdrop = `<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${
    outerRadius + 5
  }" fill="var(--a2ui-color-surface-muted)" opacity="0.45" />`;
  const hole = innerRadius > 0
    ? `<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${
      innerRadius - 2
    }" fill="var(--a2ui-color-surface)" />`
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
      ${backdrop}
      ${segments}
      ${hole}
    </svg>
  `;
}

export function PieChart(
  props: PieChartProps,
): import('@lynx-js/react').ReactNode {
  const [resolvedProps] = useResolvedProps(
    props,
    props.surface,
    props.dataContextPath,
  );
  const id = props.id;
  const dataValue = resolvedProps['data'];
  const slices = Array.isArray(dataValue)
    ? (dataValue as PieChartSlice[])
    : [];
  const variant = (resolvedProps['variant'] as PieChartVariant | undefined)
    ?? 'pie';
  const title = (resolvedProps['title'] as string | undefined) ?? 'Pie chart';
  const subtitle = (resolvedProps['subtitle'] as string | undefined)
    ?? (slices.length > 0
      ? `${slices.length} slices • ${
        formatValue(
          slices.reduce(
            (sum, slice) => sum + Math.max(0, Number(slice.value) || 0),
            0,
          ),
        )
      } total`
      : 'No data');
  const showLegend = resolvedProps['showLegend'] !== false;
  const showPercentages = resolvedProps['showPercentages'] !== false;
  const heightValue = resolvedProps['height'];
  const height = typeof heightValue === 'number' ? heightValue : 220;
  const paddingAngleValue = resolvedProps['paddingAngle'];
  const paddingAngle = typeof paddingAngleValue === 'number'
    ? paddingAngleValue
    : 2;
  const palette = Array.isArray(resolvedProps['colors'])
    ? (resolvedProps['colors'] as string[])
    : DEFAULT_CHART_COLORS;
  const total = slices.reduce(
    (sum, slice) => sum + Math.max(0, Number(slice.value) || 0),
    0,
  );
  const svgMarkup = buildSvgMarkup(slices, variant, paddingAngle, palette);

  return (
    <view key={id} className='pie-chart'>
      <view className='pie-chart-header'>
        <view className='pie-chart-header-copy'>
          <text className='pie-chart-title'>{title}</text>
          <text className='pie-chart-caption'>{subtitle}</text>
        </view>
        <view className='pie-chart-kpi'>
          <text className='pie-chart-kpi-label'>Total</text>
          <text className='pie-chart-kpi-value'>{formatValue(total)}</text>
        </view>
      </view>

      <view className='pie-chart-svg-wrap'>
        <svg
          className='pie-chart-svg'
          content={svgMarkup}
          style={{ width: '100%', height: `${height}px` }}
        />
      </view>

      {showLegend
        ? (
          <view className='pie-chart-legend'>
            {slices.map((slice, index) => {
              const value = Math.max(0, Number(slice.value) || 0);
              const percent = total > 0 ? (value / total) * 100 : 0;
              const color = slice.color
                ?? palette[index % palette.length]
                ?? DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
                ?? DEFAULT_CHART_COLORS[0];

              return (
                <view
                  key={`${slice.name}-${index}`}
                  className='pie-chart-legend-item'
                >
                  <view
                    className='pie-chart-legend-swatch'
                    style={{ backgroundColor: color }}
                  />
                  <view className='pie-chart-legend-copy'>
                    <text className='pie-chart-legend-label'>{slice.name}</text>
                    <text className='pie-chart-legend-value'>
                      {showPercentages
                        ? `${formatValue(value)} (${formatPercent(percent)})`
                        : formatValue(value)}
                    </text>
                  </view>
                </view>
              );
            })}
          </view>
        )
        : null}
    </view>
  );
}
