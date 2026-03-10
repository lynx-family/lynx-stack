import { Connector } from '@lynx-js/devtool-connector';
import { AndroidTransport } from '@lynx-js/devtool-connector/transport';
import { KittenLynxView } from './KittenLynxView.js';

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

    const lynx = new Lynx();
    lynx._connector = new Connector([new AndroidTransport()]);

    const devices = await lynx._connector.listDevices();
    if (devices.length === 0) {
      throw new Error('Failed to connect to Lynx: no devices found.');
    }

    let devicesToSearch = devices;
    if (targetDevice) {
      devicesToSearch = devices.filter(d => d.id === targetDevice);
      if (devicesToSearch.length === 0) {
        throw new Error(
          `Failed to connect to Lynx: device ${targetDevice} not found.`,
        );
      }
    }

    let deviceIdToUse: string | undefined;
    for (const device of devicesToSearch) {
      try {
        const apps = await lynx._connector.listAvailableApps(device.id);
        if (apps.some(app => app.packageName === appPackage)) {
          deviceIdToUse = device.id;
          break;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (!deviceIdToUse) {
      throw new Error(
        `Failed to connect to Lynx: app ${appPackage} not found on any available device.`,
      );
    }

    console.log(
      `[Lynx] Restarting ${appPackage} on device ${deviceIdToUse}...`,
    );
    try {
      execSync(`adb -s ${deviceIdToUse} shell am force-stop ${appPackage}`);
    } catch (e) {
      console.error(
        `[Lynx] Failed to force-stop app on device ${deviceIdToUse}:`,
        e,
      );
    }

    try {
      await lynx._connector.openApp(deviceIdToUse, appPackage);
    } catch (e) {
      console.error(`[Lynx] Failed to open app on device ${deviceIdToUse}:`, e);
      throw e;
    }

    const clients = await lynx._connector.listClients();

    // Filter clients by deviceId and target package
    const encodedDeviceId = encodeURIComponent(deviceIdToUse);
    const matchedClients = clients.filter(
      c =>
        c.id.startsWith(encodedDeviceId + ':')
        && c.info.AppProcessName === appPackage,
    );

    if (matchedClients.length === 0) {
      throw new Error(
        `Failed to connect to Lynx: no client found for ${appPackage} on device "${deviceIdToUse}".`,
      );
    }

    lynx._currentClient = matchedClients[0];
    lynx._currentClientId = matchedClients[0]!.id;

    await lynx._connector.setGlobalSwitch(
      lynx._currentClientId,
      'enable_devtool',
      true,
    );

    return lynx;
  }

  /**
   * Create a new page (LynxView) for navigating and interacting with Lynx content.
   *
   * @returns A new {@link LynxView} instance bound to the current client.
   * @throws If not connected. Call {@link Lynx.connect} first.
   */
  async newPage(): Promise<KittenLynxView> {
    if (!this._connector || this._currentClientId === '') {
      throw new Error('Not connected. Call Lynx.connect() first.');
    }
    return new KittenLynxView(
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
