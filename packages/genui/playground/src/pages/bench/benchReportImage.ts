// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable n/no-unsupported-features/node-builtins -- Browser-only DOM Blob APIs. */

/** Rasterize the existing report, without changing its scroll or disclosure state. */
export async function createBenchReportImage(
  source: HTMLElement,
): Promise<Blob> {
  const host = document.createElement('div');
  let timer = 0;
  let finished = false;
  try {
    return await Promise.race([
      capture(),
      new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(() =>
          reject(
            new Error(
              'Image generation timed out. Please try again with fewer expanded sections.',
            ),
          ), 30000);
      }),
    ]);
  } finally {
    finished = true;
    window.clearTimeout(timer);
    host.remove();
  }

  async function capture(): Promise<Blob> {
    const width = Math.ceil(Math.max(
      source.getBoundingClientRect().width,
      ...Array.from(
        source.querySelectorAll<HTMLElement>('.publishedReportTableWrap'),
      )
        .map((table) => table.scrollWidth + 96),
    ));
    if (!width || width > 4096) {
      throw new Error(
        'The report is too wide to export. Resize the page and try again.',
      );
    }
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-report-image-exclude]').forEach((node) =>
      node.remove()
    );
    clone.querySelectorAll('[id]').forEach((node) =>
      node.removeAttribute('id')
    );
    Object.assign(clone.style, { maxWidth: 'none', margin: '0' });
    clone.querySelectorAll<HTMLElement>('.publishedReportTableWrap').forEach(
      (table) => {
        table.style.overflow = 'visible';
      },
    );
    const images = Array.from(clone.querySelectorAll('img'));
    // The report template only renders validated inline PNGs; never fetch other sources.
    if (
      images.some((img) =>
        !img.src.startsWith('data:image/png;base64,') || img.srcset
      )
    ) {
      throw new Error(
        'The report contains a screenshot that cannot be exported locally.',
      );
    }
    host.className = 'publishedReportPage';
    host.setAttribute('aria-hidden', 'true');
    host.inert = true;
    Object.assign(host.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: `${width}px`,
      height: 'auto',
      overflow: 'visible',
      pointerEvents: 'none',
    });
    host.append(clone);
    document.body.append(host);
    await Promise.all(images.map(async (img) => {
      img.loading = 'eager';
      try {
        await img.decode();
      } catch {
        throw new Error(
          'A saved screenshot could not be decoded. The image was not exported.',
        );
      }
    }));
    if (finished) throw new Error('Image generation timed out.');
    const height = Math.ceil(clone.scrollHeight);
    const pixelRatio = Math.min(
      2,
      16000 / Math.max(width, height),
      Math.sqrt(16_000_000 / (width * height)),
    );
    if (!height || pixelRatio < 0.5) {
      throw new Error(
        'The report is too long for one image. Collapse some sections and try again.',
      );
    }
    const { toBlob } = await import('html-to-image');
    if (finished) throw new Error('Image generation timed out.');
    const blob = await toBlob(clone, {
      width,
      height,
      pixelRatio,
      backgroundColor: getComputedStyle(host).backgroundColor,
      // The report uses system fonts; do not download unrelated web fonts/stylesheets.
      skipFonts: true,
    });
    if (!blob || blob.size === 0 || blob.type !== 'image/png') {
      throw new Error('The browser could not create a PNG. Please try again.');
    }
    return blob;
  }
}
