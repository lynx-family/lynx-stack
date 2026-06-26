import { beforeEach, describe, expect, it, vi } from 'vitest';

const adbMock = vi.hoisted(() => ({
  close: vi.fn(),
  createAdb: vi.fn(),
  getDevices: vi.fn(),
  spawnWaitText: vi.fn(),
}));

vi.mock('@yume-chan/adb', () => ({
  AdbServerClient: vi.fn().mockImplementation(() => ({
    createAdb: adbMock.createAdb,
    getDevices: adbMock.getDevices,
  })),
}));

vi.mock('@yume-chan/adb-server-node-tcp', () => ({
  AdbServerNodeTcpConnector: vi.fn(),
}));

import { AndroidTransport } from '../src/connector/transport/android.js';

describe('AndroidTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adbMock.createAdb.mockResolvedValue({
      close: adbMock.close,
      subprocess: {
        noneProtocol: {
          spawnWaitText: adbMock.spawnWaitText,
        },
      },
    });
  });

  it('lists arbitrary installed packages instead of known apps only', async () => {
    adbMock.spawnWaitText.mockResolvedValue([
      'package:com.lynx.explorer',
      'package:com.example.custom',
      '',
    ].join('\n'));

    const transport = new AndroidTransport();

    await expect(transport.listAvailableApps('device-1')).resolves.toEqual([
      { packageName: 'com.lynx.explorer', name: 'com.lynx.explorer' },
      { packageName: 'com.example.custom', name: 'com.example.custom' },
    ]);
    expect(adbMock.spawnWaitText).toHaveBeenCalledWith([
      'pm',
      'list',
      'packages',
    ]);
  });

  it('opens any installed package name', async () => {
    adbMock.spawnWaitText.mockImplementation(async (args: string[]) => {
      if (args.join(' ') === 'pm list packages') {
        return 'package:com.example.custom\n';
      }
      if (
        args.join(' ')
          === 'cmd package resolve-activity --brief com.example.custom'
      ) {
        return 'com.example.custom/.MainActivity\n';
      }
      if (args[0] === 'am') {
        return 'Starting: Intent { cmp=com.example.custom/.MainActivity }';
      }
      throw new Error(`unexpected adb command: ${args.join(' ')}`);
    });

    const transport = new AndroidTransport();

    await expect(
      transport.openApp('device-1', 'com.example.custom'),
    ).resolves.toBeUndefined();
    expect(adbMock.spawnWaitText).toHaveBeenCalledWith([
      'am',
      'start',
      '-a',
      'android.intent.action.MAIN',
      '-c',
      'android.intent.category.LAUNCHER',
      '-f',
      '0x10200000',
      '-n',
      'com.example.custom/.MainActivity',
    ]);
    expect(adbMock.spawnWaitText).not.toHaveBeenCalledWith([
      'monkey',
      '-p',
      'com.example.custom',
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
  });
});
