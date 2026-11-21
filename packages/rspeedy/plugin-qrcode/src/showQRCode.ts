// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import process from 'node:process'
import { crc32, deflateSync } from 'node:zlib'

import { log } from '@clack/prompts'
import color from 'picocolors'
import { createSupportsTerminalGraphics } from 'supports-terminal-graphics'
import { encode, renderUnicodeCompact } from 'uqr'

export type TerminalImageProtocol = 'kitty' | 'iterm2' | 'sixel' | null

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const DEFAULT_QR_ROWS = 14
const MIN_QR_ROWS = 6
const QR_BORDER = 4
const QR_SCALE = 8
const SIXEL_DEFAULT_SCALE = 6
const TERMINAL_QUERY_TIMEOUT_MS = 100
const TERMINAL_QUERY_POLL_MS = 5

/**
 * Detect whether the current terminal supports inline graphics protocols
 * (Kitty Graphics Protocol, iTerm2 Inline Images Protocol, or Sixel) via
 * `supports-terminal-graphics`.
 *
 * Returns `null` when running in non-TTY streams, inside terminal multiplexers
 * (`tmux` / `screen`), or on terminals without graphics support.
 */
export function detectTerminalImageProtocol(
  stream: { isTTY?: boolean } = process.stdout,
): TerminalImageProtocol {
  if (!stream.isTTY) {
    return null
  }

  const term = process.env['TERM']?.toLowerCase() ?? ''

  // Terminal multiplexers strip or corrupt un-wrapped graphics sequences unless
  // passthrough is explicitly configured. Fall back to Unicode rendering there.
  if (
    process.env['TMUX']
    || process.env['STY']
    || term.startsWith('tmux')
    || term.startsWith('screen')
  ) {
    return null
  }

  const support = createSupportsTerminalGraphics(stream)
  const termProgram = process.env['TERM_PROGRAM']?.toLowerCase() ?? ''

  // Although iTerm2 3.6+ reports Kitty support, its native inline-image
  // protocol (OSC 1337) is more reliable (consistent with `terminal-image`).
  // Only prefer iTerm2 when `support.iterm2` confirms version compatibility.
  const isITerm2 = termProgram === 'iterm.app'

  if (!isITerm2 && support.kitty) {
    return 'kitty'
  }

  // VS Code's integrated terminal (`TERM_PROGRAM=vscode`) defaults
  // `terminal.integrated.enableImages` to `false` and silently ignores OSC 1337
  // sequences unless the user explicitly opted in, so keep Unicode rendering
  // there by default.
  if (support.iterm2 && termProgram !== 'vscode') {
    return 'iterm2'
  }

  if (support.sixel && termProgram !== 'vscode') {
    return 'sixel'
  }

  return null
}

/**
 * Build a single PNG chunk (`length` + `type` + `data` + `CRC32`).
 */
function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crcBuffer = Buffer.alloc(4)
  const crcValue = crc32(Buffer.concat([typeBuffer, data]))
  crcBuffer.writeUInt32BE(crcValue >>> 0, 0)
  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

/**
 * Encode a boolean QR matrix (`true` = dark module, `false` = light module)
 * into an 8-bit grayscale PNG with a pure white background (`0xFF`) and
 * black modules (`0x00`).
 */
export function encodeQRMatrixToPng(
  matrix: readonly (readonly boolean[])[],
  scale: number = QR_SCALE,
): Buffer {
  const moduleCount = matrix.length
  const pixelSize = moduleCount * scale
  const rowStride = pixelSize + 1
  // Fill with 255 (white), then set filter byte (0) and dark pixels (0).
  const raw = Buffer.alloc(rowStride * pixelSize, 255)

  for (let y = 0; y < pixelSize; y++) {
    const rowOffset = y * rowStride
    raw[rowOffset] = 0 // PNG filter type 0 (None)
    const qrRow = matrix[Math.floor(y / scale)]!
    for (let x = 0; x < pixelSize; x++) {
      if (qrRow[Math.floor(x / scale)]) {
        raw[rowOffset + 1 + x] = 0
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(pixelSize, 0)
  ihdr.writeUInt32BE(pixelSize, 4)
  ihdr[8] = 8 // 8-bit depth
  ihdr[9] = 0 // Grayscale color type
  ihdr[10] = 0 // Compression method
  ihdr[11] = 0 // Filter method
  ihdr[12] = 0 // Interlace method

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', deflateSync(raw)),
    createPngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * Synchronously query the terminal for its cell pixel dimensions using
 * `CSI 16 t` (XTWINOPS, replies with `\x1b[6;<height>;<width>t`) followed by a
 * Primary Device Attributes (`CSI c`, replies with `\x1b[?...c`) sentinel so
 * terminals that ignore `CSI 16 t` return immediately without blocking.
 *
 * Retries on `EAGAIN` / `EWOULDBLOCK` (non-blocking TTY stdin) up to
 * `timeoutMs`.
 */
export function queryTerminalCellPixelSize(
  stdin: {
    isTTY?: boolean
    fd?: number
    isRaw?: boolean
    setRawMode?: (mode: boolean) => void
  } = process.stdin,
  stdout: {
    isTTY?: boolean
    write?: (data: string) => boolean
  } = process.stdout,
  timeoutMs: number = TERMINAL_QUERY_TIMEOUT_MS,
): { cellWidthPx: number, cellHeightPx: number } | null {
  if (
    !stdin.isTTY
    || !stdout.isTTY
    || typeof stdin.fd !== 'number'
    || typeof stdin.setRawMode !== 'function'
    || typeof stdout.write !== 'function'
  ) {
    return null
  }

  const wasRaw = Boolean(stdin.isRaw)
  const sleepArray = new Int32Array(new SharedArrayBuffer(4))
  try {
    stdin.setRawMode(true)
    stdout.write('\u001b[16t\u001b[c')

    let response = ''
    const buf = Buffer.alloc(64)
    const deadline = Date.now() + timeoutMs
    while (response.length < 128 && Date.now() < deadline) {
      let bytesRead = 0
      try {
        bytesRead = fs.readSync(stdin.fd, buf, 0, buf.length, null)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === 'EAGAIN' || code === 'EWOULDBLOCK') {
          const remaining = deadline - Date.now()
          if (remaining <= 0) {
            break
          }
          Atomics.wait(
            sleepArray,
            0,
            0,
            Math.min(TERMINAL_QUERY_POLL_MS, remaining),
          )
          continue
        }
        return null
      }
      if (bytesRead <= 0) {
        break
      }
      response += buf.toString('utf8', 0, bytesRead)
      // Stop as soon as the DA1 sentinel response (`\x1b[?...c`) arrives
      if (response.includes('\u001b[?') && response.endsWith('c')) {
        break
      }
    }

    const prefixIndex = response.indexOf('\u001b[6;')
    if (prefixIndex === -1) {
      return null
    }
    const endIndex = response.indexOf('t', prefixIndex + 4)
    if (endIndex === -1) {
      return null
    }
    const parts = response.slice(prefixIndex + 4, endIndex).split(';')
    if (parts.length !== 2) {
      return null
    }
    const cellHeightPx = Number.parseInt(parts[0]!, 10)
    const cellWidthPx = Number.parseInt(parts[1]!, 10)
    if (cellWidthPx > 0 && cellHeightPx > 0) {
      return { cellWidthPx, cellHeightPx }
    }
    return null
  } catch {
    return null
  } finally {
    try {
      stdin.setRawMode(wasRaw)
    } catch {
      // Ignore errors when restoring raw mode
    }
  }
}

/**
 * Compute the pixel scale per QR module for Sixel rendering from the terminal's
 * actual pixel dimensions (`cellWidthPx` and `cellHeightPx`) and target cell box.
 *
 * Returns `null` when either pixel dimension is unavailable or when even `1px`
 * per module would exceed the available pixel area.
 */
export function calculateSixelScale(
  moduleCount: number,
  cellSize: { columns: number, rows: number },
  cellWidthPx: number | undefined,
  cellHeightPx: number | undefined,
): number | null {
  if (
    moduleCount <= 0
    || cellWidthPx === undefined
    || !Number.isFinite(cellWidthPx)
    || cellWidthPx <= 0
    || cellHeightPx === undefined
    || !Number.isFinite(cellHeightPx)
    || cellHeightPx <= 0
  ) {
    return null
  }
  const maxWidthPx = cellSize.columns * cellWidthPx
  const maxHeightPx = cellSize.rows * cellHeightPx
  const maxPixels = Math.min(maxWidthPx, maxHeightPx)
  const scale = Math.min(
    SIXEL_DEFAULT_SCALE,
    Math.floor(maxPixels / moduleCount),
  )
  return scale >= 1 ? scale : null
}

/**
 * Encode a boolean QR matrix (`true` = dark module, `false` = light module)
 * into a Sixel graphics sequence (`\x1bP0;0;0q...`) with an explicit pure white
 * background (`#0;2;100;100;100`) and black modules (`#1;2;0;0;0`).
 *
 * Each QR module is scaled to `scale` x `scale` pixels.
 */
export function encodeQRMatrixToSixel(
  matrix: readonly (readonly boolean[])[],
  scale: number = SIXEL_DEFAULT_SCALE,
): string {
  const moduleCount = matrix.length
  const pixelSize = moduleCount * scale
  let out =
    `\u001bP0;0;0q"1;1;${pixelSize};${pixelSize}#0;2;100;100;100#1;2;0;0;0`

  for (let bandY = 0; bandY < pixelSize; bandY += 6) {
    const bandHeight = Math.min(6, pixelSize - bandY)
    const fullMask = (1 << bandHeight) - 1

    let whitePass = '#0'
    let blackPass = '#1'

    for (let col = 0; col < moduleCount; col++) {
      let blackBits = 0
      for (let dy = 0; dy < bandHeight; dy++) {
        const qrRow = matrix[Math.floor((bandY + dy) / scale)]!
        if (qrRow[col]) {
          blackBits |= 1 << dy
        }
      }
      const whiteBits = fullMask ^ blackBits
      const whiteChar = String.fromCodePoint(63 + whiteBits)
      const blackChar = String.fromCodePoint(63 + blackBits)
      whitePass += scale > 1 ? `!${scale}${whiteChar}` : whiteChar
      blackPass += scale > 1 ? `!${scale}${blackChar}` : blackChar
    }

    // `$` returns to the start of the current Sixel band, `-` advances to the next band.
    out += `${whitePass}$${blackPass}-`
  }

  return `${out}\u001b\\`
}

/**
 * Format a PNG buffer using the Kitty Graphics Protocol (`\x1b_G...`).
 * Uses `C=1` to keep cursor movement predictable and pads `rows - 1` newlines
 * so multi-line loggers (like `@clack/prompts`) draw a left border on every row.
 */
export function formatKittyImage(
  pngBuffer: Buffer,
  columns: number,
  rows: number,
): string {
  const base64Data = pngBuffer.toString('base64')
  const chunkSize = 4096
  const params = `a=T,f=100,q=2,C=1,c=${columns},r=${rows}`

  let sequence = ''
  if (base64Data.length <= chunkSize) {
    sequence = `\u001b_G${params};${base64Data}\u001b\\`
  } else {
    for (let offset = 0; offset < base64Data.length; offset += chunkSize) {
      const chunk = base64Data.slice(offset, offset + chunkSize)
      const isFirst = offset === 0
      const isLast = offset + chunkSize >= base64Data.length
      if (isFirst) {
        sequence += `\u001b_G${params},m=1;${chunk}\u001b\\`
      } else {
        sequence += `\u001b_Gq=2,m=${isLast ? 0 : 1};${chunk}\u001b\\`
      }
    }
  }

  return sequence + '\n'.repeat(Math.max(0, rows - 1))
}

/**
 * Format a PNG buffer using the iTerm2 Inline Images Protocol (`OSC 1337`).
 * Pre-allocates `rows - 1` lines first, then moves the cursor up on the last
 * line to emit the image so `@clack/prompts` renders the guide bar on all rows
 * without overwriting the image.
 */
export function formatITerm2Image(
  pngBuffer: Buffer,
  columns: number,
  rows: number,
): string {
  const base64Data = pngBuffer.toString('base64')
  const osc =
    `\u001b]1337;File=inline=1;width=${columns};height=${rows};preserveAspectRatio=1;size=${pngBuffer.byteLength}:${base64Data}\u0007`
  const rowOffset = Math.max(0, rows - 1)
  if (rowOffset === 0) {
    return osc
  }
  return '\n'.repeat(rowOffset) + `\u001b[${rowOffset}A` + osc
}

/**
 * Compute target cell dimensions (`columns` x `rows`) for a square QR code,
 * respecting small terminal sizes. Terminal cells have an ~1:2 width-to-height
 * aspect ratio, so `columns = rows * 2`.
 *
 * Returns `null` if the available terminal space is smaller than `MIN_QR_ROWS`.
 */
export function calculateQRCellSize(
  terminalColumns: number | undefined = process.stdout.columns,
  terminalRows: number | undefined = process.stdout.rows,
): { columns: number, rows: number } | null {
  // Reserve 4 columns for `@clack/prompts` guide prefix (`◇  `) and margin
  const maxColumns = terminalColumns === undefined
    ? DEFAULT_QR_ROWS * 2
    : Math.floor(Math.max(0, terminalColumns - 4) / 2) * 2
  // Reserve 6 rows for surrounding prompt headers, URL line, and shortcuts
  const maxRows = terminalRows === undefined
    ? DEFAULT_QR_ROWS
    : Math.max(0, terminalRows - 6)

  const rows = Math.min(DEFAULT_QR_ROWS, maxRows, Math.floor(maxColumns / 2))
  if (rows < MIN_QR_ROWS) {
    return null
  }
  return { columns: rows * 2, rows }
}

/**
 * Render a QR code string for the given URL using terminal graphics protocols
 * (`kitty`, `iterm2`, or `sixel`) when supported, or fall back to `uqr`
 * compact Unicode block characters.
 */
export function renderQRCode(
  url: string,
  stream: {
    isTTY?: boolean
    columns?: number
    rows?: number
    cellWidthPx?: number
    cellHeightPx?: number
  } = process.stdout,
): string {
  const protocol = detectTerminalImageProtocol(stream)
  if (protocol) {
    const cellSize = calculateQRCellSize(stream.columns, stream.rows)
    if (cellSize) {
      try {
        const qr = encode(url, { border: QR_BORDER })
        if (Array.isArray(qr?.data) && qr.data.length > 0) {
          if (protocol === 'sixel') {
            const queried = stream.cellWidthPx === undefined
                || stream.cellHeightPx === undefined
              ? queryTerminalCellPixelSize()
              : null
            const cellWidthPx = stream.cellWidthPx ?? queried?.cellWidthPx
            const cellHeightPx = stream.cellHeightPx ?? queried?.cellHeightPx
            const sixelScale = calculateSixelScale(
              qr.data.length,
              cellSize,
              cellWidthPx,
              cellHeightPx,
            )
            if (sixelScale) {
              return encodeQRMatrixToSixel(qr.data, sixelScale)
            }
          } else {
            const pngBuffer = encodeQRMatrixToPng(qr.data)
            return protocol === 'kitty'
              ? formatKittyImage(pngBuffer, cellSize.columns, cellSize.rows)
              : formatITerm2Image(pngBuffer, cellSize.columns, cellSize.rows)
          }
        }
      } catch {
        // Fall back to compact Unicode rendering if encoding fails or `uqr` is mocked in tests
      }
    }
  }

  return renderUnicodeCompact(url)
}

/**
 * Print the QR code and URL to the terminal using `@clack/prompts`.
 */
export default function showQRCode(url: string): void {
  log.info(color.green('Scan with Lynx'))
  log.success(renderQRCode(url))
  log.success(url)
}
