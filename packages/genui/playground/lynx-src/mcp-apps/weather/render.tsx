// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineAppRenderer } from '@lynx-js/genui/mcp-apps/render';
import type { AppRendererProps } from '@lynx-js/genui/mcp-apps/render';
import { useEffect, useState } from '@lynx-js/react';

import {
  WEATHER_RENDERER_ID,
  callWeatherApi,
  parseWeatherApiResult,
} from './api.js';
import type { WeatherApiResult } from './api.js';
import './render.css';

export function WeatherCard(props: AppRendererProps<WeatherApiResult>) {
  const [input, setInput] = useState(props.input);
  const [result, setResult] = useState(props.result);

  useEffect(() => {
    setInput(props.input);
    setResult(props.result);
  }, [props.input, props.result]);

  const weather = result.weather;

  const degree = weather.unit === 'fahrenheit' ? '°F' : '°C';
  const refresh = () => {
    const nextInput = {
      ...input,
      city: weather.city,
      unit: weather.unit,
      refresh: weather.refresh + 1,
    };
    setInput(nextInput);
    setResult(callWeatherApi(nextInput));
  };

  return (
    <view className='weatherCard'>
      <view className='weatherHeader'>
        <view className='weatherLocationGroup'>
          <text className='weatherEyebrow'>CURRENT WEATHER</text>
          <text className='weatherCity'>{weather.city}</text>
          <text className='weatherUpdated'>{weather.updatedAt}</text>
        </view>
        <view className='weatherIconBubble'>
          <text className='weatherIcon'>{weather.icon}</text>
        </view>
      </view>

      <view className='weatherCurrent'>
        <text className='weatherTemperature'>
          {weather.temperature}
          {degree}
        </text>
        <view className='weatherCurrentCopy'>
          <text className='weatherCondition'>{weather.condition}</text>
          <text className='weatherRange'>
            H {weather.high}° · L {weather.low}°
          </text>
        </view>
      </view>

      <view className='weatherMetrics'>
        <view className='weatherMetric'>
          <text className='weatherMetricLabel'>HUMIDITY</text>
          <text className='weatherMetricValue'>{weather.humidity}%</text>
        </view>
        <view className='weatherMetricDivider' />
        <view className='weatherMetric'>
          <text className='weatherMetricLabel'>WIND</text>
          <text className='weatherMetricValue'>{weather.wind} km/h</text>
        </view>
      </view>

      <view className='weatherForecast'>
        {weather.forecast.map((day) => (
          <view className='weatherForecastDay' key={day.label}>
            <text className='weatherForecastLabel'>{day.label}</text>
            <text className='weatherForecastIcon'>{day.icon}</text>
            <text className='weatherForecastCondition'>{day.condition}</text>
            <text className='weatherForecastRange'>
              {day.high}° / {day.low}°
            </text>
          </view>
        ))}
      </view>

      <view className='weatherRefresh' bindtap={refresh}>
        <text className='weatherRefreshIcon'>↻</text>
        <text className='weatherRefreshText'>Refresh forecast</text>
      </view>
      <text className='weatherFooter'>Lynx weather template</text>
    </view>
  );
}

export const WEATHER_RENDERER = defineAppRenderer({
  id: WEATHER_RENDERER_ID,
  parseResult: parseWeatherApiResult,
  component: WeatherCard,
  invalidResultMessage: 'Weather API returned an invalid result.',
});
