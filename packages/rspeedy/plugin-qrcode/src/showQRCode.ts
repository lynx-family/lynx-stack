// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { crc32, deflateSync } from 'node:zlib'

import { log } from '@clack/prompts'
import color from 'picocolors'
import { createSupportsTerminalGraphics } from 'supports-terminal-graphics'
import { encode, renderUnicodeCompact } from 'uqr'

export type TerminalImageProtocol = 'kitty' | null

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const DEFAULT_QR_ROWS = 14
const MIN_QR_ROWS = 6
const QR_BORDER = 4
const QR_SCALE = 8

/**
 * Detect whether the current terminal supports inline graphics via the Kitty
 * Graphics Protocol using `supports-terminal-graphics`.
 *
 * Returns `null` when running in non-TTY streams, inside terminal multiplexers
 * (`tmux` / `screen`), or on terminals without Kitty graphics support.
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

  // Although iTerm2 3.6+ reports Kitty support, it does not reliably render
  // Kitty placements (consistent with `terminal-image`).
  const isITerm2 = process.env['TERM_PROGRAM']?.toLowerCase() === 'iterm.app'

  if (!isITerm2 && support.kitty) {
    return 'kitty'
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
 * Render a QR code string for the given URL using the Kitty Graphics Protocol
 * when supported, or fall back to `uqr` compact Unicode block characters.
 */
export function renderQRCode(
  url: string,
  stream: {
    isTTY?: boolean
    columns?: number
    rows?: number
  } = process.stdout,
): string {
  const protocol = detectTerminalImageProtocol(stream)
  if (protocol === 'kitty') {
    const cellSize = calculateQRCellSize(stream.columns, stream.rows)
    if (cellSize) {
      try {
        const qr = encode(url, { border: QR_BORDER })
        if (Array.isArray(qr?.data) && qr.data.length > 0) {
          const pngBuffer = encodeQRMatrixToPng(qr.data)
          return formatKittyImage(pngBuffer, cellSize.columns, cellSize.rows)
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
