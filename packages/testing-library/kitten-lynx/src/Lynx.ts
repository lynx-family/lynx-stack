import { Connector } from '@lynx-js/devtool-connector';
import { AndroidTransport } from '@lynx-js/devtool-connector/transport';
import { LynxView } from './LynxView.js';

import { execSync } from 'child_process';

/**
 * Options for configuring the connection to a Lynx device.
 */
export interface ConnectOptions {
  /**
   * ADB device serial to target (e.g. `"localhost:5555"`, `"emulator-5554"`).
   * When multiple ADB devices are connected, use this to select the correct one.
   * If omitted, uses the first available device.
   */
  deviceId?: string;
  /**
   * App package name to launch on the device.
   * @default "com.lynx.explorer"
   */
  appPackage?: string;
}

const DEFAULT_APP_PACKAGE = 'com.lynx.explorer';

/**
 * Main entry point for the kitten-lynx testing framework.
 *
 * Provides Puppeteer-like APIs for connecting to a Lynx app running on an
 * Android device (physical or emulator) via ADB and the Chrome DevTools Protocol.
 *
 * @example
 * ```typescript
 * const lynx = await Lynx.connect({ deviceId: 'localhost:5555' });
 * const page = await lynx.newPage();
 * await page.goto('http://example.com/bundle.lynx.bundle');
 * const content = await page.content();
 * await lynx.close();
 * ```
 */
export class Lynx {
  private _connector: Connector | null = null;
  private _currentClient: any | null = null;
  private _currentClientId: string = '';

  /**
   * Connect to a Lynx app on an Android device.
   *
   * Discovers ADB devices, restarts the target app, and waits for a Lynx
   * devtool client to become available.
   *
   * @param options - Connection options to specify target device and app package.
   * @returns A connected `Lynx` instance ready for creating pages.
   * @throws If no Lynx client is found after 10 seconds of polling.
   */
  static async connect(options?: ConnectOptions): Promise<Lynx> {
    const targetDevice = options?.deviceId;
    const appPackage = options?.appPackage ?? DEFAULT_APP_PACKAGE;

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

      // If a specific device is requested, only restart that one
      const devicesToRestart = targetDevice
        ? adbDevices.filter(d => d === targetDevice)
        : adbDevices;

      for (const deviceId of devicesToRestart) {
        try {
          console.log(
            `[Lynx] Restarting ${appPackage} on device ${deviceId}...`,
          );
          execSync(`adb -s ${deviceId} shell am force-stop ${appPackage}`);
          execSync(
            `adb -s ${deviceId} shell monkey -p ${appPackage} -c android.intent.category.LAUNCHER 1`,
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

    lynx._connector = new Connector([new AndroidTransport()]);

    let clients = await lynx._connector.listClients();
    let attempts = 0;
    while (clients.length === 0 && attempts < 20) {
      await new Promise(r => setTimeout(r, 500));
      clients = await lynx._connector.listClients();
      attempts++;
    }

    // Filter clients by deviceId if specified (client.id format: "deviceId:port")
    if (targetDevice) {
      clients = clients.filter(c => c.id.startsWith(targetDevice + ':'));
    }

    if (clients.length === 0) {
      throw new Error(
        targetDevice
          ? `Failed to connect to Lynx: no client found on device "${targetDevice}" after 10 seconds.`
          : 'Failed to connect to Lynx: no client found after 10 seconds.',
      );
    }

    lynx._currentClient = clients[0];
    lynx._currentClientId = clients[0]!.id;

    return lynx;
  }

  /**
   * Create a new page (LynxView) for navigating and interacting with Lynx content.
   *
   * @returns A new {@link LynxView} instance bound to the current client.
   * @throws If not connected. Call {@link Lynx.connect} first.
   */
  async newPage(): Promise<LynxView> {
    if (!this._connector || this._currentClientId === '') {
      throw new Error('Not connected. Call Lynx.connect() first.');
    }
    return new LynxView(
      this._connector,
      this._currentClientId,
      this._currentClient,
    );
  }

  /**
   * Close the connection and release resources.
   */
  async close(): Promise<void> {
    this._connector = null;
  }
}
