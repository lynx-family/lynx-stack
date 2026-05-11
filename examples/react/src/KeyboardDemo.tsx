import { useState } from '@lynx-js/react';
import type { BaseKeyEvent } from '@lynx-js/types';

type LynxKeyEvent = BaseKeyEvent<unknown> & {
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
};

export function KeyboardDemo() {
  const [lastKey, setLastKey] = useState('—');
  const [lastCode, setLastCode] = useState('—');
  const [modifiers, setModifiers] = useState('');
  const [eventType, setEventType] = useState('—');
  const [log, setLog] = useState<string[]>([]);

  const handleKeyDown = (e: LynxKeyEvent) => {
    'background-only';
    const key = e.key ?? '?';
    const code = e.code ?? '?';
    setLastKey(key);
    setLastCode(code);
    setEventType('keydown');
    const mods = [
      e.ctrlKey === true && 'Ctrl',
      e.shiftKey === true && 'Shift',
      e.altKey === true && 'Alt',
      e.metaKey === true && 'Meta',
    ].filter(Boolean).join('+');
    setModifiers(mods || 'none');
    setLog(prev => [`↓ ${key} (${code})`, ...prev].slice(0, 8));
  };

  const handleKeyUp = (e: LynxKeyEvent) => {
    'background-only';
    const key = e.key ?? '?';
    const code = e.code ?? '?';
    setEventType('keyup');
    setLog(prev => [`↑ ${key} (${code})`, ...prev].slice(0, 8));
  };

  return (
    <view
      style={{
        padding: '20px',
        backgroundColor: '#1a1a2e',
        borderRadius: '12px',
        margin: '16px',
      }}
      bindkeydown={handleKeyDown}
      bindkeyup={handleKeyUp}
    >
      <text style={{ color: '#e94560', fontSize: '18px', fontWeight: 'bold' }}>
        Keyboard Event Demo
      </text>
      <text style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>
        Click here and press any key
      </text>

      <view
        style={{
          marginTop: '16px',
          backgroundColor: '#16213e',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <text style={{ color: '#0f3460', fontSize: '11px' }}>LAST EVENT</text>
        <text
          style={{ color: '#e94560', fontSize: '24px', fontWeight: 'bold' }}
        >
          {lastKey}
        </text>
        <text style={{ color: '#aaa', fontSize: '13px' }}>
          code: {lastCode}
        </text>
        <text style={{ color: '#aaa', fontSize: '13px' }}>
          type: {eventType}
        </text>
        <text style={{ color: '#aaa', fontSize: '13px' }}>
          modifiers: {modifiers}
        </text>
      </view>

      <view
        style={{
          marginTop: '12px',
          backgroundColor: '#16213e',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <text style={{ color: '#0f3460', fontSize: '11px' }}>EVENT LOG</text>
        {log.length === 0
          ? (
            <text style={{ color: '#555', fontSize: '13px' }}>
              no events yet
            </text>
          )
          : log.map((entry, i) => (
            <text
              key={i}
              style={{ color: i === 0 ? '#e94560' : '#888', fontSize: '13px' }}
            >
              {entry}
            </text>
          ))}
      </view>
    </view>
  );
}
