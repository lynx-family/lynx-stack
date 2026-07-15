// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { AppApiDefinition } from '@lynx-js/genui/mcp-apps';

export type { AppApiDefinition, AppRenderData } from '@lynx-js/genui/mcp-apps';

export const WEATHER_API_NAME = 'weather.get_forecast';
export const WEATHER_RENDERER_ID = 'weather';

export interface WeatherForecastDay {
  label: string;
  condition: string;
  icon: string;
  high: number;
  low: number;
}

export interface WeatherData {
  city: string;
  condition: string;
  icon: string;
  temperature: number;
  high: number;
  low: number;
  humidity: number;
  wind: number;
  unit: 'celsius' | 'fahrenheit';
  updatedAt: string;
  refresh: number;
  forecast: WeatherForecastDay[];
}

export interface WeatherApiResult {
  summary: string;
  weather: WeatherData;
}

export const WEATHER_API: AppApiDefinition = {
  name: WEATHER_API_NAME,
  title: 'Weather forecast',
  description:
    'Get current conditions and a compact three-day forecast for a city.',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City name, for example Hangzhou or Seattle.',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature unit.',
      },
    },
    required: ['city'],
    additionalProperties: false,
  },
  renderer: WEATHER_RENDERER_ID,
};

const CONDITIONS = [
  { condition: 'Sunny', icon: '☀️' },
  { condition: 'Partly cloudy', icon: '⛅' },
  { condition: 'Light rain', icon: '🌦️' },
  { condition: 'Cloudy', icon: '☁️' },
] as const;

function textValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function integerValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : fallback;
}

function citySeed(city: string): number {
  let seed = 0;
  for (const character of city) {
    seed = (seed * 31 + (character.codePointAt(0) ?? 0)) % 997;
  }
  return seed;
}

function convertTemperature(value: number, unit: WeatherData['unit']): number {
  return unit === 'fahrenheit' ? Math.round(value * 9 / 5 + 32) : value;
}

export function getWeatherData(
  args: Record<string, unknown>,
): WeatherData {
  const city = textValue(args.city, 'Hangzhou');
  const unit: WeatherData['unit'] = args.unit === 'fahrenheit'
    ? 'fahrenheit'
    : 'celsius';
  const refresh = Math.max(0, integerValue(args.refresh, 0));
  const seed = citySeed(city) + refresh * 17;
  const current = CONDITIONS[seed % CONDITIONS.length] ?? CONDITIONS[0];
  const base = 17 + seed % 12;
  const temperature = convertTemperature(base, unit);
  const high = convertTemperature(base + 4, unit);
  const low = convertTemperature(base - 5, unit);
  const forecast = [0, 1, 2].map((offset) => {
    const condition = CONDITIONS[(seed + offset + 1) % CONDITIONS.length]
      ?? CONDITIONS[0];
    return {
      label: offset === 0 ? 'Tomorrow' : `Day ${offset + 2}`,
      condition: condition.condition,
      icon: condition.icon,
      high: convertTemperature(base + 3 - offset, unit),
      low: convertTemperature(base - 5 - offset, unit),
    };
  });
  return {
    city,
    condition: current.condition,
    icon: current.icon,
    temperature,
    high,
    low,
    humidity: 48 + seed % 35,
    wind: 5 + seed % 16,
    unit,
    updatedAt: refresh === 0 ? 'Just now' : `Refreshed ${refresh}×`,
    refresh,
    forecast,
  };
}

export function callWeatherApi(
  args: Record<string, unknown>,
): WeatherApiResult {
  const weather = getWeatherData(args);
  const degree = weather.unit === 'fahrenheit' ? '°F' : '°C';
  return {
    summary:
      `${weather.city}: ${weather.condition}, ${weather.temperature}${degree}. High ${weather.high}${degree}, low ${weather.low}${degree}.`,
    weather,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseForecastDay(value: unknown): WeatherForecastDay | null {
  if (!isRecord(value)) return null;
  const label = nonEmptyText(value.label);
  const condition = nonEmptyText(value.condition);
  const icon = nonEmptyText(value.icon);
  const high = finiteNumber(value.high);
  const low = finiteNumber(value.low);
  if (!label || !condition || !icon || high === null || low === null) {
    return null;
  }
  return { label, condition, icon, high, low };
}

export function parseWeatherApiResult(value: unknown): WeatherApiResult | null {
  if (!isRecord(value) || !isRecord(value.weather)) return null;
  const summary = nonEmptyText(value.summary);
  const weatherValue = value.weather;
  const city = nonEmptyText(weatherValue.city);
  const condition = nonEmptyText(weatherValue.condition);
  const icon = nonEmptyText(weatherValue.icon);
  const temperature = finiteNumber(weatherValue.temperature);
  const high = finiteNumber(weatherValue.high);
  const low = finiteNumber(weatherValue.low);
  const humidity = finiteNumber(weatherValue.humidity);
  const wind = finiteNumber(weatherValue.wind);
  const updatedAt = nonEmptyText(weatherValue.updatedAt);
  const refresh = finiteNumber(weatherValue.refresh);
  const unit = weatherValue.unit;
  if (
    !summary
    || !city
    || !condition
    || !icon
    || temperature === null
    || high === null
    || low === null
    || humidity === null
    || wind === null
    || !updatedAt
    || refresh === null
    || !Number.isInteger(refresh)
    || refresh < 0
    || (unit !== 'celsius' && unit !== 'fahrenheit')
    || !Array.isArray(weatherValue.forecast)
  ) {
    return null;
  }
  const forecast: WeatherForecastDay[] = [];
  for (const item of weatherValue.forecast) {
    const day = parseForecastDay(item);
    if (!day) return null;
    forecast.push(day);
  }
  return {
    summary,
    weather: {
      city,
      condition,
      icon,
      temperature,
      high,
      low,
      humidity,
      wind,
      unit,
      updatedAt,
      refresh,
      forecast,
    },
  };
}
