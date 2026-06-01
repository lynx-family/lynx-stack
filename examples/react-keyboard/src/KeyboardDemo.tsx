import { useState } from '@lynx-js/react';
import type { BaseKeyEvent } from '@lynx-js/types';

import './keyboard.css';

type LynxKeyEvent = BaseKeyEvent<unknown> & { code?: string };

interface KeyDef {
  code: string;
  label: string;
  flex: number;
}

const ROW1: KeyDef[] = [
  { code: 'Backquote', label: '`', flex: 1 },
  { code: 'Digit1', label: '1', flex: 1 },
  { code: 'Digit2', label: '2', flex: 1 },
  { code: 'Digit3', label: '3', flex: 1 },
  { code: 'Digit4', label: '4', flex: 1 },
  { code: 'Digit5', label: '5', flex: 1 },
  { code: 'Digit6', label: '6', flex: 1 },
  { code: 'Digit7', label: '7', flex: 1 },
  { code: 'Digit8', label: '8', flex: 1 },
  { code: 'Digit9', label: '9', flex: 1 },
  { code: 'Digit0', label: '0', flex: 1 },
  { code: 'Minus', label: '-', flex: 1 },
  { code: 'Equal', label: '=', flex: 1 },
  { code: 'Backspace', label: '⌫', flex: 2 },
];

const ROW2: KeyDef[] = [
  { code: 'Tab', label: 'Tab', flex: 1.5 },
  { code: 'KeyQ', label: 'Q', flex: 1 },
  { code: 'KeyW', label: 'W', flex: 1 },
  { code: 'KeyE', label: 'E', flex: 1 },
  { code: 'KeyR', label: 'R', flex: 1 },
  { code: 'KeyT', label: 'T', flex: 1 },
  { code: 'KeyY', label: 'Y', flex: 1 },
  { code: 'KeyU', label: 'U', flex: 1 },
  { code: 'KeyI', label: 'I', flex: 1 },
  { code: 'KeyO', label: 'O', flex: 1 },
  { code: 'KeyP', label: 'P', flex: 1 },
  { code: 'BracketLeft', label: '[', flex: 1 },
  { code: 'BracketRight', label: ']', flex: 1 },
  { code: 'Backslash', label: '\\', flex: 1.5 },
];

const ROW3: KeyDef[] = [
  { code: 'CapsLock', label: 'Caps', flex: 1.75 },
  { code: 'KeyA', label: 'A', flex: 1 },
  { code: 'KeyS', label: 'S', flex: 1 },
  { code: 'KeyD', label: 'D', flex: 1 },
  { code: 'KeyF', label: 'F', flex: 1 },
  { code: 'KeyG', label: 'G', flex: 1 },
  { code: 'KeyH', label: 'H', flex: 1 },
  { code: 'KeyJ', label: 'J', flex: 1 },
  { code: 'KeyK', label: 'K', flex: 1 },
  { code: 'KeyL', label: 'L', flex: 1 },
  { code: 'Semicolon', label: ';', flex: 1 },
  { code: 'Quote', label: '\'', flex: 1 },
  { code: 'Enter', label: '↵ Enter', flex: 2.25 },
];

const ROW4: KeyDef[] = [
  { code: 'ShiftLeft', label: '⇧ Shift', flex: 2.25 },
  { code: 'KeyZ', label: 'Z', flex: 1 },
  { code: 'KeyX', label: 'X', flex: 1 },
  { code: 'KeyC', label: 'C', flex: 1 },
  { code: 'KeyV', label: 'V', flex: 1 },
  { code: 'KeyB', label: 'B', flex: 1 },
  { code: 'KeyN', label: 'N', flex: 1 },
  { code: 'KeyM', label: 'M', flex: 1 },
  { code: 'Comma', label: ',', flex: 1 },
  { code: 'Period', label: '.', flex: 1 },
  { code: 'Slash', label: '/', flex: 1 },
  { code: 'ShiftRight', label: 'Shift ⇧', flex: 2.75 },
];

const ROW5: KeyDef[] = [
  { code: 'ControlLeft', label: 'Ctrl', flex: 1.5 },
  { code: 'MetaLeft', label: '⌘', flex: 1.25 },
  { code: 'AltLeft', label: 'Alt', flex: 1.25 },
  { code: 'Space', label: '', flex: 6 },
  { code: 'AltRight', label: 'Alt', flex: 1.25 },
  { code: 'MetaRight', label: '⌘', flex: 1.25 },
  { code: 'ControlRight', label: 'Ctrl', flex: 1.5 },
];

const ROWS = [ROW1, ROW2, ROW3, ROW4, ROW5];

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);

const REGULAR_COLOR = '#2a2a2a';
const LIT_COLOR = '#39ff14';
const MOD_COLOR = '#00d4ff';

export function KeyboardDemo() {
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set());
  const [lastKey, setLastKey] = useState('—');

  const handleKeyDown = (e: LynxKeyEvent) => {
    'background-only';
    const code = e.code ?? '';
    setLastKey(e.key);
    setPressed(prev => new Set([...prev, code]));
  };

  const handleKeyUp = (e: LynxKeyEvent) => {
    'background-only';
    const code = e.code ?? '';
    setPressed(prev => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  };

  return (
    <view
      className='kb-root'
      {...{
        'global-bindkeydown': handleKeyDown,
        'global-bindkeyup': handleKeyUp,
      }}
    >
      {/* Header */}
      <view className='kb-header'>
        <text style={{ color: '#fff', fontSize: '22px', fontWeight: 'bold' }}>
          KEYBOARD EVENTS
        </text>
        <text style={{ color: '#555', fontSize: '13px' }}>
          Click here, then press keys
        </text>
      </view>

      {/* Last key */}
      <view className='kb-last-key-row'>
        <text style={{ color: '#555', fontSize: '13px', flex: 1 }}>
          Last key
        </text>
        <text
          style={{
            color: pressed.size > 0 ? LIT_COLOR : '#444',
            fontSize: '26px',
            fontWeight: 'bold',
          }}
        >
          {lastKey}
        </text>
      </view>

      {/* Keyboard */}
      <view className='kb-board'>
        {ROWS.map((row, rowIdx) => (
          <view key={rowIdx} className='kb-row'>
            {row.map((key) => {
              const isPressed = pressed.has(key.code);
              const isMod = MODIFIER_CODES.has(key.code);
              const bg = isPressed
                ? (isMod ? MOD_COLOR : LIT_COLOR)
                : REGULAR_COLOR;
              const labelColor = isPressed ? '#000' : '#bbb';
              const isSpace = key.code === 'Space';

              return (
                <view
                  key={key.code}
                  className={isSpace ? 'kb-key kb-space' : 'kb-key'}
                  style={{ flex: key.flex, backgroundColor: bg }}
                >
                  {!isSpace && (
                    <text
                      style={{
                        color: labelColor,
                        fontSize: key.label.length > 3 ? '9px' : '12px',
                        fontWeight: isPressed ? 'bold' : 'normal',
                        textAlign: 'center',
                      }}
                    >
                      {key.label}
                    </text>
                  )}
                </view>
              );
            })}
          </view>
        ))}
      </view>

      {/* Legend */}
      <view className='kb-legend'>
        <view className='kb-legend-item'>
          <view
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: LIT_COLOR,
              borderRadius: '3px',
              marginRight: '6px',
            }}
          />
          <text style={{ color: '#555', fontSize: '11px' }}>Key</text>
        </view>
        <view className='kb-legend-item'>
          <view
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: MOD_COLOR,
              borderRadius: '3px',
              marginRight: '6px',
            }}
          />
          <text style={{ color: '#555', fontSize: '11px' }}>Modifier</text>
        </view>
      </view>
    </view>
  );
}
