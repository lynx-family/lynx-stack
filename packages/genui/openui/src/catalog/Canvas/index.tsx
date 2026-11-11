// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { runOnBackground, runOnMainThread, useEffect } from '@lynx-js/react';

import { Canvas as CanvasDefinition } from './definition.js';
import { drawCanvas } from './draw.js';
import { useFormName, useIsStreaming, useOpenUI } from '../../core/context.jsx';
import type { DefinedComponent } from '../../core/library.jsx';
import type { ActionLike } from '../Action/index.jsx';

import '../../../styles/catalog/Canvas.css';

/** OpenUI Canvas component using standard Canvas 2D drawing commands. */
export const Canvas: DefinedComponent<typeof CanvasDefinition.props> = {
  ...CanvasDefinition,
  component: ({ props, statementId }) => {
    const isStreaming = useIsStreaming();
    const { reportError, setFieldValue, triggerAction } = useOpenUI();
    const formName = useFormName();
    const width = props.width ?? 360;
    const height = props.height ?? 360;
    // Stable across token updates to the unfinished tail: do not send the same
    // committed prefix across threads on every streamed character.
    const chunks = typeof props.code === 'string'
      ? (isStreaming ? [] : [props.code])
      : (isStreaming ? props.code.slice(0, -1) : props.code);
    const code = JSON.stringify(chunks);
    const name = props.name ?? statementId ?? 'openui-canvas';
    const isWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    useEffect(() => {
      if (!isWeb) return;
      let active = true;
      void runOnMainThread(drawCanvas)(
        JSON.parse(code) as string[],
        width,
        height,
        name,
      )
        .catch((error: unknown) => {
          if (!active) return;
          reportError?.({
            source: 'runtime',
            code: 'render-error',
            component: 'Canvas',
            ...(statementId ? { statementId } : {}),
            message: error instanceof Error ? error.message : String(error),
          });
        });
      return () => {
        active = false;
      };
    }, [isWeb, code, width, height, name, reportError, statementId]);

    useEffect(() => {
      if (!isWeb || isStreaming || !props.action) return;
      let active = true;
      const onTap = (point: { x: number; y: number }) => {
        'background only';
        if (!active) return;
        if (props.name) {
          setFieldValue(formName, 'Canvas', props.name, point, true);
        }
        void triggerAction(
          'Canvas click',
          formName,
          props.action as ActionLike,
        );
      };
      const listen = () => {
        'main thread';
        const root = globalThis.frameElement?.getRootNode() as
          | ShadowRoot
          | undefined;
        const canvas = root?.getElementById(name) as HTMLCanvasElement | null;
        if (!canvas) return;
        canvas.onclick = event => {
          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          void runOnBackground(onTap)({
            x: (event.clientX - rect.left) * width / rect.width,
            y: (event.clientY - rect.top) * height / rect.height,
          });
        };
      };
      const clear = () => {
        'main thread';
        const root = globalThis.frameElement?.getRootNode() as
          | ShadowRoot
          | undefined;
        const canvas = root?.getElementById(name) as HTMLCanvasElement | null;
        if (canvas) canvas.onclick = null;
      };
      void runOnMainThread(listen)();
      return () => {
        active = false;
        void runOnMainThread(clear)();
      };
    }, [
      isWeb,
      isStreaming,
      props.action,
      props.name,
      name,
      width,
      height,
      formName,
      setFieldValue,
      triggerAction,
    ]);

    if (!isWeb) {
      return (
        <view className='OpenUICanvas'>
          <text>Canvas is not supported on this platform.</text>
        </view>
      );
    }

    return (
      <view className='OpenUICanvas'>
        {/* @ts-expect-error Canvas is a host extension, absent from standard Lynx intrinsics. */}
        <canvas
          id={name}
          name={name}
          className='OpenUICanvasSurface'
          style={{ width: `${width}px`, height: 'auto' }}
        />
      </view>
    );
  },
};
