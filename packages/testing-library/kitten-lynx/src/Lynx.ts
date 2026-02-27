import {
  DebugRouterConnector,
  MultiOpenStatus,
} from '@lynx-js/debug-router-connector';
import { LynxView } from './LynxView.js';

import { execSync } from 'child_process';

export class Lynx {
  private _connector: DebugRouterConnector | null = null;
  private _currentClient: any | null = null;
  private _currentClientId: number = -1;

  static async connect(): Promise<Lynx> {
    try {
      const output = execSync('adb devices').toString();
      const lines = output.split('\n');
      const adbDevices = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (line && line.endsWith('device')) {
          const parts = line.split('\t');
          if (parts.length >= 1 && parts[0]) {
            adbDevices.push(parts[0]);
          }
        }
      }

      for (const deviceId of adbDevices) {
        try {
          console.log(
            `[Lynx] Restarting com.lynx.explorer on device ${deviceId}...`,
          );
          execSync(`adb -s ${deviceId} shell am force-stop com.lynx.explorer`);
          execSync(
            `adb -s ${deviceId} shell monkey -p com.lynx.explorer -c android.intent.category.LAUNCHER 1`,
          );
        } catch (e) {
          console.error(
            `[Lynx] Failed to restart app on device ${deviceId}:`,
            e,
          );
        }
      }
    } catch (e) {
      console.warn(
        '[Lynx] Failed to list ADB devices or adb is not available.',
      );
    }

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
      for (const device of devices) {
        device.startWatchClient();
      }
    }

    const usbClients = lynx._connector.getAllUsbClients();
    if (usbClients.length > 0) {
      lynx._currentClient = usbClients[0];
      lynx._currentClientId = usbClients[0]!.clientId();
    } else {
      const existingClients = lynx._connector.getAllAppClients();
      if (existingClients.length > 0) {
        lynx._currentClient = existingClients[0];
        lynx._currentClientId = existingClients[0]!.clientId();
      } else {
        // Wait until a client is attached
        const clientId = await clientPromise;
        const allUsbs = lynx._connector.getAllUsbClients();
        lynx._currentClient = allUsbs.find((c: any) =>
          c.clientId() === clientId
        ) || null;
        lynx._currentClientId = clientId;
      }
    }

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
    return new LynxView(
      this._connector,
      this._currentClientId,
      this._currentClient,
    );
  }

  async close(): Promise<void> {
    if (this._connector) {
      if (this._connector.wss) {
        this._connector.wss.close();
      }
      this._connector = null;
    }
  }
}
