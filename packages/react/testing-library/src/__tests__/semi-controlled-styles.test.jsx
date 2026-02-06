import { describe, expect, vi } from 'vitest';
import { fireEvent, render, waitSchedule, screen } from '..';
import { runOnBackground, useMainThreadRef, runOnMainThread, useState } from '@lynx-js/react';

describe('Semi Controlled Styles', () => {
  it('Setting different styles using declarative and imperative way should both take effect', async () => {
    const Comp = () => {
      const viewMTRef = useMainThreadRef(null);
      const [height, setHeight] = useState(100);

      function updateViewWidth() {
        'main thread';
        viewMTRef.current?.setStyleProperties({
          width: '100px',
        });
      }

      return (
        <view
          style={{
            height: `${height}px`,
          }}
          main-thread:ref={viewMTRef}
          main-thread:bindtap={(e) => {
            'main thread';
            updateViewWidth();
          }}
        >
          <text>Hello Main Thread Script</text>
        </view>
      );
    };
    const { container } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 100px;"
      >
        <text>
          Hello Main Thread Script
        </text>
      </view>
    `);

    fireEvent.tap(container.firstChild, {
      key: 'value',
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 100px; width: 100px;"
      >
        <text>
          Hello Main Thread Script
        </text>
      </view>
    `);
  });

  it('Imperatively setting style should override the declarative style', async () => {
    const Comp = () => {
      const viewMTRef = useMainThreadRef(null);
      const [height, setHeight] = useState(100);

      function updateViewWidth() {
        'main thread';
        viewMTRef.current?.setStyleProperties({
          height: '500px',
        });
      }

      return (
        <view
          style={{
            height: `${height}px`,
          }}
          main-thread:ref={viewMTRef}
          main-thread:bindtap={(e) => {
            'main thread';
            updateViewWidth();
          }}
        >
          <text>Hello Main Thread Script</text>
        </view>
      );
    };
    const { container } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 100px;"
      >
        <text>
          Hello Main Thread Script
        </text>
      </view>
    `);

    fireEvent.tap(container.firstChild, {
      key: 'value',
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 500px;"
      >
        <text>
          Hello Main Thread Script
        </text>
      </view>
    `);
  });

  it('Rerender will override the imperatively set style', async () => {
    const Comp = () => {
      const viewMTRef = useMainThreadRef(null);
      const [height, setHeight] = useState(100);

      function updateViewWidth() {
        'main thread';
        viewMTRef.current?.setStyleProperties({
          height: '500px',
        });
      }

      return (
        <view
          style={{
            height: `${height}px`,
          }}
          main-thread:ref={viewMTRef}
        >
          <text data-testid='StateButton' bindtap={() => setHeight(200)}>Update in State</text>
          <text
            data-testid='MTSButton'
            main-thread:bindtap={(e) => {
              'main thread';
              updateViewWidth();
            }}
          >
            Update in MTS
          </text>
        </view>
      );
    };
    const { container, rerender } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 100px;"
      >
        <text
          data-testid="StateButton"
        >
          Update in State
        </text>
        <text
          data-testid="MTSButton"
        >
          Update in MTS
        </text>
      </view>
    `);

    fireEvent.tap(screen.getByTestId('MTSButton'), {
      key: 'value',
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 500px;"
      >
        <text
          data-testid="StateButton"
        >
          Update in State
        </text>
        <text
          data-testid="MTSButton"
        >
          Update in MTS
        </text>
      </view>
    `);

    fireEvent.tap(screen.getByTestId('StateButton'), {
      key: 'value',
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        has-react-ref="true"
        style="height: 200px;"
      >
        <text
          data-testid="StateButton"
        >
          Update in State
        </text>
        <text
          data-testid="MTSButton"
        >
          Update in MTS
        </text>
      </view>
    `);
  });
});
