import {
  DebugRouterConnector,
  MultiOpenStatus,
} from '@lynx-js/debug-router-connector';
import { LynxView } from './LynxView.js';

export class Lynx {
  private _connector: DebugRouterConnector | null = null;
  private _currentClientId: number = -1;

  static async connect(): Promise<Lynx> {
    const lynx = new Lynx();

    lynx._connector = new DebugRouterConnector({
      manualConnect: true,
      enableWebSocket: true, // Used for local debugging in docker/adb
      enableDesktop: true,
    });

    const { promise: startedPromise, resolve: startedResolve } = Promise
      .withResolvers<void>();

    // Auto-remove connector upon disconnect
    lynx._connector.setMultiOpenCallback({
      statusChanged(status: MultiOpenStatus) {
        if (status === MultiOpenStatus.unattached) {
          lynx._connector = null;
        }
      },
    });

    await lynx._connector.startWSServer();

    lynx._connector.on('device-connected', (device) => {
      device.startWatchClient();
    });

    const { promise: clientPromise, resolve: clientResolve } = Promise
      .withResolvers<number>();

    lynx._connector.on('client-connected', async (client) => {
      startedResolve(); // Unblock initial wait
      clientResolve(client.clientId());
    });

    if (lynx._connector.devices.size === 0) {
      const devices = await lynx._connector.connectDevices(1000);
      if (devices.length === 0) {
        throw new Error('Failed to connect to Lynx: no device found.');
      }
    }

    // Wait until a client is attached
    lynx._currentClientId = await clientPromise;

    // Force enable devtools toggle if required
    lynx._connector.sendMessageToApp(
      lynx._currentClientId,
      JSON.stringify({
        event: 'Customized',
        data: {
          type: 'SetGlobalSwitch',
          data: {
            client_id: lynx._currentClientId,
            message: JSON.stringify({
              global_key: 'enable_devtool',
              global_value: true,
              id: 10000,
            }),
            session_id: -1,
          },
          sender: lynx._currentClientId,
        },
        from: lynx._currentClientId,
      }),
    );

    return lynx;
  }

  async newPage(): Promise<LynxView> {
    if (!this._connector || this._currentClientId === -1) {
      throw new Error('Not connected. Call Lynx.connect() first.');
    }
    return new LynxView(this._connector, this._currentClientId);
  }

  async close(): Promise<void> {
    // Optional: terminate the connector properly
    // Note: API bindings for `close` on `DebugRouterConnector` depend on upstream
  }
}
