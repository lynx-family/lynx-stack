// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
interface Event<E extends string, D> {
  event: E;
  data: D;
}

type CustomizedEvent<TType extends string, TData> = Event<'Customized', {
  type: TType;
  sender: number;
  data: TData;
}>;

export interface AppInfo {
  App: string;
  AppVersion: string;
  /** Android only */
  AppProcessName?: string;
  /** iOS only */
  bundleId?: string;
  /** OpenHarmony only */
  bundleName?: string;
  debugRouterId: string;
  debugRouterVersion: string;
  deviceModel: string;
  network: string;
  osVersion: string;
  sdkVersion: string;
}
export type InitializeRequest = Event<'Initialize', number>;
export type InitializeResponse = Event<'Register', {
  id: number;
  info: AppInfo;
}>;

export type AppResponse = CustomizedEvent<'App', {
  /** JSON string. See {@link AppResponseMessage} for parsed result. */
  message: string;
}>;
export interface AppResponseMessage {
  id: number;
  /** JSON string */
  result: string;
}
export interface CDPRequestMessage<T = unknown> {
  method: string;
  params?: T | undefined;
}
export type CDPRequest = CustomizedEvent<'CDP', {
  client_id: number;
  session_id: number;
  message: CDPRequestMessage & { id: number };
}>;
export type CDPResponse = CustomizedEvent<'CDP', {
  /** JSON string. See {@link CDPResponseMessage} for parsed result. */
  message: string;
}>;
export type CDPResponseMessage =
  & { id: number }
  & ({ result: unknown } | { error: { code: number; message: string } });

export interface Session {
  session_id: number;
  type: '';
  url: string;
}
export type ListSessionRequest = CustomizedEvent<
  'ListSession',
  Record<string, never>
>;
export type ListSessionResponse = CustomizedEvent<'SessionList', Session[]>;

export type GlobalKeys = 'enable_devtool';
export type GetGlobalSwitchRequest = CustomizedEvent<'GetGlobalSwitch', {
  client_id: number;
  session_id: number;
  message: { global_key: GlobalKeys };
}>;
export type GetGlobalSwitchResponse = CustomizedEvent<'GetGlobalSwitch', {
  client_id: number;
  session_id: number;
  message: string | boolean | { global_value: string | boolean };
}>;
export type SetGlobalSwitchRequest = CustomizedEvent<'SetGlobalSwitch', {
  client_id: number;
  session_id: number;
  message: { global_key: GlobalKeys; global_value: boolean };
}>;
export type SetGlobalSwitchResponse = CustomizedEvent<'SetGlobalSwitch', {
  client_id: number;
  session_id: number;
  /** JSON string */
  message: string;
}>;

export interface CustomizedResponseMap {
  App: AppResponse;
  CDP: CDPResponse;
}
export interface CustomizedResponseMessageMap {
  App: AppResponseMessage;
  CDP: CDPResponseMessage;
}

export type Response =
  | InitializeResponse
  | ListSessionResponse
  | AppResponse
  | CDPResponse
  | GetGlobalSwitchResponse
  | SetGlobalSwitchResponse;

export function isInitializeResponse(
  response: Response,
): response is InitializeResponse {
  return response.event === 'Register';
}

export function isListSessionResponse(
  response: Response,
): response is ListSessionResponse {
  return response.event === 'Customized'
    && response.data.type === 'SessionList';
}

export function isCustomizedResponseWithType<
  T extends keyof CustomizedResponseMap,
>(
  response: Response,
  type: T,
): response is CustomizedResponseMap[T] {
  return response.event === 'Customized' && response.data.type === type;
}
