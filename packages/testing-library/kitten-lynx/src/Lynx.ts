import { Connector } from '@lynx-js/devtool-connector';
import { AndroidTransport } from '@lynx-js/devtool-connector/transport';
import { AdbServerClient } from '@yume-chan/adb';
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp';
import { KittenLynxView } from './KittenLynxView.js';

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
   * Main setup method. Connects to the Lynx app devtool server over ADB.
   *
   * **Agent Guide on the Connection Flow:**
   * 1. Discovers the target ADB device (physical Android or emulator).
   * 2. Force-stops the target app to ensure a clean state (`adb shell am force-stop`).
   * 3. Launches the application (usually Lynx Explorer) on the device.
   * 4. Queries the `Connector` for available clients and matches by device ID and package name.
   * 5. Enables the master devtool switch (`enable_devtool`).
   *
   * **When to use:**
   * This should be the first method invoked in any test script or interaction flow.
   *
   * @param options - Configure connection variables, such as `appPackage` and `deviceId` (useful if multiple devices are attached).
   * @returns A Promise resolving to a connected `Lynx` instance ready to spawn new pages.
   * @throws Errors if devices aren't found, the app is missing, or the target client fails to initialize.
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
      const client = new AdbServerClient(
        new AdbServerNodeTcpConnector({ port: 5037 }),
      );
      const adb = await client.createAdb({ serial: deviceIdToUse });
      try {
        await adb.subprocess.noneProtocol.spawnWaitText([
          'am',
          'force-stop',
          appPackage,
        ]);
      } finally {
        await adb.close();
      }
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

    console.log(
      `[Lynx] Waiting 2 seconds for app to initialize before listing clients...`,
    );
    await new Promise(resolve => setTimeout(resolve, 2000));

    const clients = await lynx._connector.listClients();
    console.log(`[Lynx] Found ${clients.length} clients in total.`);
    for (const c of clients) {
      console.log(`[Lynx] Client ID: ${c.id}, App: ${c.info?.AppProcessName}`);
    }

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
   * Spawns a new page representation for the connected Lynx environment.
   *
   * **Agent Usage:**
   * Similar to Puppeteer's `browser.newPage()`. Once you have a `Lynx` connection instance safely created
   * via `Lynx.connect()`, call this method to obtain a `KittenLynxView`. You can then call `post.goto(url)`
   * on the view to navigate to a Lynx Bundle.
   *
   * @returns A Promise resolving to a new `KittenLynxView` instance bound to the active ADB client.
   * @throws Error if the Lynx connection isn't properly initialized first.
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
   * Closes the active ADB/CDP connection and releases associated resources.
   *
   * **Agent Usage:**
   * Ensure this is called in your test's teardown block (e.g., in `afterAll()`) to prevent
   * floating Node.js processes or hanging ADB connections that can ruin subsequent test runs.
   *
   * @returns A Promise resolving when the cleanup operation is fully processed.
   */
  async close(): Promise<void> {
    if (this._connector) {
      await this._connector.close();
    }
    this._connector = null;
    this._currentClient = null;
    this._currentClientId = '';
  }
}
