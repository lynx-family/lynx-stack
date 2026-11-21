// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import process from 'node:process'
import { inflateSync } from 'node:zlib'

import { encode } from 'uqr'
import { afterEach, describe, expect, test, vi } from 'vitest'

import showQRCode, {
  calculateQRCellSize,
  detectTerminalImageProtocol,
  encodeQRMatrixToPng,
  formatITerm2Image,
  formatKittyImage,
  renderQRCode,
} from '../src/showQRCode.js'

const ORIGINAL_ENV = { ...process.env }

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const saved = { ...process.env }
  for (
    const key of [
      'TERM',
      'TERM_PROGRAM',
      'TERM_PROGRAM_VERSION',
      'LC_TERMINAL',
      'TMUX',
      'STY',
      'KITTY_WINDOW_ID',
      'KITTY_PID',
      'GHOSTTY_RESOURCES_DIR',
      'WEZTERM_PANE',
      'WEZTERM_UNIX_SOCKET',
      'KONSOLE_VERSION',
      'ITERM_SESSION_ID',
    ]
  ) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  try {
    return fn()
  } finally {
    process.env = saved
  }
}

describe('showQRCode - Terminal Image Rendering', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  describe('detectTerminalImageProtocol', () => {
    const tty = { isTTY: true }

    test('returns null when stdout is not a TTY', () => {
      withEnv(
        {
          TERM_PROGRAM: 'ghostty',
          GHOSTTY_RESOURCES_DIR: '/usr/share/ghostty',
        },
        () => {
          expect(detectTerminalImageProtocol({ isTTY: false })).toBeNull()
        },
      )
    })

    test('returns null inside tmux or GNU screen (including STY) even when outer terminal vars exist', () => {
      withEnv(
        {
          TERM_PROGRAM: 'ghostty',
          GHOSTTY_RESOURCES_DIR: '/usr/share/ghostty',
          TMUX: '/tmp/tmux-1000/default,1234,0',
        },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBeNull()
        },
      )

      withEnv(
        {
          KITTY_WINDOW_ID: '1',
          TERM: 'tmux-256color',
        },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBeNull()
        },
      )

      withEnv(
        {
          ITERM_SESSION_ID: 'w0t0p0:123',
          TERM: 'screen-256color',
        },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBeNull()
        },
      )

      withEnv(
        {
          KITTY_WINDOW_ID: '1',
          TERM: 'xterm-256color',
          STY: '1234.pts-0.host',
        },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBeNull()
        },
      )
    })

    test('detects Ghostty as kitty protocol via supports-terminal-graphics', () => {
      withEnv({ TERM_PROGRAM: 'ghostty' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ GHOSTTY_RESOURCES_DIR: '/app' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ TERM: 'xterm-ghostty' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
    })

    test('detects Kitty, WezTerm, Warp, Rio, and Konsole >= 22.04 as kitty protocol', () => {
      withEnv({ KITTY_WINDOW_ID: '1' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ TERM: 'xterm-kitty' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ TERM_PROGRAM: 'WezTerm' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ WEZTERM_PANE: '0' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ TERM_PROGRAM: 'WarpTerminal' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ TERM_PROGRAM: 'rio' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ KONSOLE_VERSION: '220400' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('kitty')
      })
      withEnv({ KONSOLE_VERSION: '210800' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBeNull()
      })
    })

    test('detects iTerm2 (>= 2.9.20150512) and Mintty as iterm2 protocol', () => {
      withEnv(
        { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6.6' },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBe('iterm2')
        },
      )
      withEnv(
        { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '2.8.0' },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBeNull()
        },
      )
      withEnv({ LC_TERMINAL: 'iTerm2' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('iterm2')
      })
      withEnv({ TERM_PROGRAM: 'mintty' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBe('iterm2')
      })
    })

    test('returns null on unsupported terminals (Apple Terminal, Alacritty, VS Code, unknown)', () => {
      withEnv({ TERM_PROGRAM: 'Apple_Terminal' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBeNull()
      })
      withEnv({ TERM: 'alacritty' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBeNull()
      })
      withEnv(
        { TERM_PROGRAM: 'vscode', TERM_PROGRAM_VERSION: '1.100.0' },
        () => {
          expect(detectTerminalImageProtocol(tty)).toBeNull()
        },
      )
      withEnv({ TERM: 'xterm-256color' }, () => {
        expect(detectTerminalImageProtocol(tty)).toBeNull()
      })
    })
  })

  describe('encodeQRMatrixToPng', () => {
    test('produces a valid grayscale PNG with white (255) background and black (0) modules', () => {
      const matrix = [
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ]
      const scale = 2
      const png = encodeQRMatrixToPng(matrix, scale)

      // Verify PNG signature
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      )

      // Verify IHDR dimensions (3 * 2 = 6x6)
      expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
      expect(png.readUInt32BE(16)).toBe(6)
      expect(png.readUInt32BE(20)).toBe(6)
      expect(png[24]).toBe(8) // 8-bit depth
      expect(png[25]).toBe(0) // grayscale

      // Extract IDAT payload and decompress to verify pixel values
      const idatLength = png.readUInt32BE(33)
      expect(png.subarray(37, 41).toString('ascii')).toBe('IDAT')
      const compressed = png.subarray(41, 41 + idatLength)
      const raw = inflateSync(compressed)

      const stride = 6 + 1
      expect(raw.length).toBe(stride * 6)

      // Top-left border pixel (y=0, x=0) must be pure white (255)
      expect(raw[0]).toBe(0) // filter byte
      expect(raw[1]).toBe(255)

      // Center module (y=2..3, x=2..3) must be pure black (0)
      expect(raw[2 * stride + 1 + 2]).toBe(0)
      expect(raw[2 * stride + 1 + 3]).toBe(0)
      expect(raw[3 * stride + 1 + 2]).toBe(0)
      expect(raw[3 * stride + 1 + 3]).toBe(0)
    })
  })

  describe('formatKittyImage & formatITerm2Image', () => {
    test('formats single-chunk and multi-chunk Kitty sequences with row padding', () => {
      const smallBuf = Buffer.from('hello-png')
      const single = formatKittyImage(smallBuf, 28, 14)
      const lines = single.split('\n')

      expect(lines).toHaveLength(14)
      expect(lines[0]).toBe(
        `\u001b_Ga=T,f=100,q=2,C=1,c=28,r=14;${
          smallBuf.toString('base64')
        }\u001b\\`,
      )
      expect(lines.slice(1).every(line => line === '')).toBe(true)

      // Multi-chunk (> 4096 base64 chars)
      const largeBuf = Buffer.alloc(4000, 0xab)
      const multi = formatKittyImage(largeBuf, 20, 10)
      const multiLines = multi.split('\n')
      expect(multiLines).toHaveLength(10)
      expect(multiLines[0]).toContain(
        '\u001b_Ga=T,f=100,q=2,C=1,c=20,r=10,m=1;',
      )
      expect(multiLines[0]).toContain('\u001b_Gq=2,m=0;')
    })

    test('formats iTerm2 OSC 1337 sequence with pre-allocated rows and cursor-up', () => {
      const buf = Buffer.from('iterm-png')
      const formatted = formatITerm2Image(buf, 24, 12)
      const lines = formatted.split('\n')

      expect(lines).toHaveLength(12)
      expect(lines.slice(0, 11).every(line => line === '')).toBe(true)
      expect(lines[11]).toBe(
        `\u001b[11A\u001b]1337;File=inline=1;width=24;height=12;preserveAspectRatio=1;size=${buf.byteLength}:${
          buf.toString('base64')
        }\u0007`,
      )
    })
  })

  describe('calculateQRCellSize', () => {
    test('scales down gracefully in small terminals and returns null when below minimum readable size', () => {
      expect(calculateQRCellSize(120, 40)).toEqual({ columns: 28, rows: 14 })
      // Narrow terminal (e.g. 24 columns wide)
      expect(calculateQRCellSize(24, 40)).toEqual({ columns: 20, rows: 10 })
      // Short terminal (e.g. 14 rows high)
      expect(calculateQRCellSize(80, 14)).toEqual({ columns: 16, rows: 8 })
      // Tiny terminal below MIN_QR_ROWS (6) returns null so caller falls back
      expect(calculateQRCellSize(10, 8)).toBeNull()
    })
  })

  describe('renderQRCode & fallback', () => {
    test('renders long schema via Kitty graphics protocol in Ghostty within compact cells with a 4-module quiet zone', () => {
      const longSchema =
        'aweme://lynxview/?channel=reactlynx_demo&bundle=main.lynx.bundle&url='
        + encodeURIComponent(
          'http://192.168.1.100:3000/main.lynx.bundle?fullscreen=true&debug=1&hmr=true&extra=long_parameter_value_for_testing_resolution',
        )

      const qr = encode(longSchema, { border: 4 })
      // A long schema produces a high-density QR code (> 50x50 modules), which
      // would exceed a 40-column terminal if rendered as characters.
      expect(qr.size).toBeGreaterThan(50)

      withEnv({ TERM_PROGRAM: 'ghostty' }, () => {
        const output = renderQRCode(longSchema, {
          isTTY: true,
          columns: 40,
          rows: 24,
        })

        // Fits inside 14 rows x 28 columns in the 40x24 terminal!
        expect(output).toContain('\u001b_Ga=T,f=100,q=2,C=1,c=28,r=14')
        expect(output.split('\n')).toHaveLength(14)

        // Extract base64 PNG from the Kitty sequence and verify the 4-module (32px) white quiet zone
        const payload = (output.split('\n')[0] ?? '')
          .split('\u001b\\')
          .filter(Boolean)
          .map(chunk => chunk.slice(chunk.indexOf(';') + 1))
          .join('')
        const png = Buffer.from(payload, 'base64')
        const width = png.readUInt32BE(16)
        expect(width).toBe(qr.size * 8)

        const idatLength = png.readUInt32BE(33)
        const raw = inflateSync(png.subarray(41, 41 + idatLength))
        const stride = width + 1
        const marginPx = 4 * 8
        for (let y = 0; y < marginPx; y++) {
          for (let x = 0; x < width; x++) {
            expect(raw[y * stride + 1 + x]).toBe(255)
            expect(raw[(width - 1 - y) * stride + 1 + x]).toBe(255)
          }
        }
      })
    })

    test('renders via iTerm2 protocol when terminal supports OSC 1337', () => {
      const url = 'http://example.com/main.lynx.bundle'
      withEnv(
        { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6.6' },
        () => {
          const output = renderQRCode(url, {
            isTTY: true,
            columns: 80,
            rows: 24,
          })

          expect(output).toContain(
            '\u001b]1337;File=inline=1;width=28;height=14;',
          )
          expect(output.split('\n')).toHaveLength(14)
        },
      )
    })

    test('falls back to uqr renderUnicodeCompact when terminal does not support images or is too small', () => {
      const url = 'http://example.com/main.lynx.bundle'
      withEnv({ TERM: 'xterm-256color' }, () => {
        const output = renderQRCode(url, {
          isTTY: true,
          columns: 80,
          rows: 24,
        })

        expect(output).not.toContain('\u001b_G')
        expect(output).not.toContain('\u001b]1337;')
        expect(output).toContain('█')
      })

      withEnv({ TERM_PROGRAM: 'ghostty' }, () => {
        const output = renderQRCode(url, {
          isTTY: true,
          columns: 10,
          rows: 8,
        })

        expect(output).not.toContain('\u001b_G')
        expect(output).toContain('█')
      })
    })

    test('showQRCode logs header, rendered QR code, and URL via @clack/prompts', async () => {
      const { log } = await import('@clack/prompts')
      const infoSpy = vi.spyOn(log, 'info').mockImplementation(() => {
        // noop
      })
      const successSpy = vi.spyOn(log, 'success').mockImplementation(() => {
        // noop
      })

      showQRCode('http://example.com/main.lynx.bundle')

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(successSpy).toHaveBeenCalledTimes(2)
      expect(successSpy).toHaveBeenLastCalledWith(
        'http://example.com/main.lynx.bundle',
      )

      infoSpy.mockRestore()
      successSpy.mockRestore()
    })
  })
})
