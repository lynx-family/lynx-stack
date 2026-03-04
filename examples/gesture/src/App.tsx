import { PanGesture, useGesture } from '@lynx-js/gesture-runtime';
import { useCallback, useMainThreadRef, useState } from '@lynx-js/react';

import './App.css';

type GestureMode = 'set' | 'diff' | 'remove';

interface Point {
  x: number;
  y: number;
}

export function App() {
  const [mode, setMode] = useState<GestureMode>('set');
  const startPointMTRef = useMainThreadRef<Point>({ x: 0, y: 0 });
  const baseOffsetMTRef = useMainThreadRef<Point>({ x: 0, y: 0 });

  const panGestureA = useGesture(PanGesture);
  panGestureA
    .onBegin((event) => {
      'main thread';
      startPointMTRef.current = {
        x: event.params.clientX,
        y: event.params.clientY,
      };
      event.currentTarget.setStyleProperty('opacity', '0.82');
      console.info('PanGestureA onBegin', startPointMTRef.current);
    })
    .onUpdate((event) => {
      'main thread';
      const dx = event.params.clientX - startPointMTRef.current.x;
      const dy = event.params.clientY - startPointMTRef.current.y;
      const nextX = baseOffsetMTRef.current.x + dx;
      const nextY = baseOffsetMTRef.current.y + dy;
      event.currentTarget.setStyleProperty(
        'transform',
        `translate(${nextX}px, ${nextY}px)`,
      );
      console.info('PanGestureA onUpdate', dx, dy, nextX, nextY);
    })
    .onEnd((event) => {
      'main thread';
      const dx = event.params.clientX - startPointMTRef.current.x;
      const dy = event.params.clientY - startPointMTRef.current.y;
      baseOffsetMTRef.current = {
        x: baseOffsetMTRef.current.x + dx,
        y: baseOffsetMTRef.current.y + dy,
      };
      event.currentTarget.setStyleProperty('opacity', '1');
      console.info('PanGestureA onEnd', baseOffsetMTRef.current);
    });

  const panGestureB = useGesture(PanGesture);
  panGestureB
    .onBegin((event) => {
      'main thread';
      startPointMTRef.current = {
        x: event.params.clientX,
        y: event.params.clientY,
      };
      event.currentTarget.setStyleProperty('opacity', '0.82');
      console.info('PanGestureB onBegin', startPointMTRef.current);
    })
    .onUpdate((event) => {
      'main thread';

      const dx = event.params.clientX - startPointMTRef.current.x;
      const nextX = baseOffsetMTRef.current.x + dx;
      event.currentTarget.setStyleProperty(
        'transform',
        `translate(${nextX}px, 0px)`,
      );
      console.info('PanGestureB onUpdate', dx, nextX);
    })
    .onEnd((event) => {
      'main thread';
      const dx = event.params.clientX - startPointMTRef.current.x;
      baseOffsetMTRef.current = {
        x: baseOffsetMTRef.current.x + dx,
        y: 0,
      };
      event.currentTarget.setStyleProperty('opacity', '1');
      console.info('PanGestureB onEnd', baseOffsetMTRef.current);
    });

  const onSetGesture = useCallback(() => {
    'background-only';
    setMode('set');
  }, []);

  const onDiffGesture = useCallback(() => {
    'background-only';
    setMode('diff');
  }, []);

  const onRemoveGesture = useCallback(() => {
    'background-only';
    setMode('remove');
  }, []);

  const activeGesture = mode === 'set'
    ? panGestureA
    : (mode === 'diff'
      ? panGestureB
      : undefined);

  const modeDescription = mode === 'set'
    ? 'Mode A: drag in both X and Y.'
    : (mode === 'diff'
      ? 'Mode B: drag in X only.'
      : 'Removed: drag should do nothing.');

  const dragBoxGestureProps = activeGesture
    ? { 'main-thread:gesture': activeGesture }
    : {};

  return (
    <view className='Root'>
      <view className='Card'>
        <text className='Title'>Gesture Lifecycle Playground</text>
        <text className='Description'>
          Tap buttons to trigger set/diff/remove and drag the square.
        </text>
        <text className='Description'>
          Verify remove semantics: after tapping "Remove Gesture", dragging
          should produce no PanGesture logs.
        </text>
        <text className='Description'>
          Verify update semantics: after tapping "Diff to Gesture B", only
          PanGestureB logs should appear.
        </text>

        <view className='Controls'>
          <view
            className={`Button ${mode === 'set' ? 'Button--active' : ''}`}
            bindtap={onSetGesture}
          >
            <text className='ButtonText'>Set Gesture A</text>
          </view>
          <view
            className={`Button ${mode === 'diff' ? 'Button--active' : ''}`}
            bindtap={onDiffGesture}
          >
            <text className='ButtonText'>Diff to Gesture B</text>
          </view>
          <view
            className={`Button ${mode === 'remove' ? 'Button--active' : ''}`}
            bindtap={onRemoveGesture}
          >
            <text className='ButtonText'>Remove Gesture</text>
          </view>
        </view>

        <text className='ModeText'>{modeDescription}</text>

        <view className='Stage'>
          <view
            className={`DragBox ${mode === 'diff' ? 'DragBox--diff' : ''} ${
              mode === 'remove' ? 'DragBox--removed' : ''
            }`}
            {...dragBoxGestureProps}
          >
            <text className='DragBoxText'>
              {mode === 'set' ? 'A' : (mode === 'diff' ? 'B' : 'OFF')}
            </text>
          </view>
        </view>
      </view>
    </view>
  );
}
