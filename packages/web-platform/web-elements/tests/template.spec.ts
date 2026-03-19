import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import * as templates from '../src/elements/htmlTemplates.js';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('template sync', () => {
  test('sync between rust and ts', () => {
    const rsPath = path.resolve(__dirname, '../src/template.rs');
    const rsContent = fs.readFileSync(rsPath, 'utf8');

    const extractConst = (name: string) => {
      // Find `pub const NAME: &str = r#"CONTENT"#;`
      const regex = new RegExp(`pub const ${name}: &str = r#"([\\s\\S]*?)"#;`);
      const match = rsContent.match(regex);
      if (!match) throw new Error(`Could not find ${name} in template.rs`);
      return match[1];
    };

    expect(templates.templateScrollView).toBe(
      extractConst('TEMPLATE_SCROLL_VIEW'),
    );
    expect(templates.templateXAudioTT).toBe(
      extractConst('TEMPLATE_X_AUDIO_TT'),
    );
    expect(templates.templateXInput).toBe(extractConst('TEMPLATE_X_INPUT'));
    expect(templates.templateXList).toBe(extractConst('TEMPLATE_X_LIST'));
    expect(templates.templateXOverlayNg).toBe(
      extractConst('TEMPLATE_X_OVERLAY_NG'),
    );
    expect(templates.templateXRefreshView).toBe(
      extractConst('TEMPLATE_X_REFRESH_VIEW'),
    );
    expect(templates.templateXSwiper).toBe(extractConst('TEMPLATE_X_SWIPER'));
    expect(templates.templateXText).toBe(extractConst('TEMPLATE_X_TEXT'));
    expect(templates.templateXTextarea).toBe(
      extractConst('TEMPLATE_X_TEXTAREA'),
    );
    expect(templates.templateXViewpageNg).toBe(
      extractConst('TEMPLATE_X_VIEWPAGE_NG'),
    );
    expect(templates.templateXWebView).toBe(
      extractConst('TEMPLATE_X_WEB_VIEW'),
    );

    // Check template_x_image
    const imageNoneRsMatch = rsContent.match(
      /r#"<img part="img" alt="" id="img" \/> "#/,
    );
    if (!imageNoneRsMatch) {
      throw new Error(
        `Could not find templateImageNone base string in template.rs`,
      );
    }
    const imageNoneRs = imageNoneRsMatch[0].slice(3, -2);
    expect(templates.templateXImage({})).toBe(imageNoneRs);

    const imageSomeRsMatch = rsContent.match(
      /r#"<img part="img" alt="" id="img" src="\{src_str\}"\/> "#/,
    );
    if (!imageSomeRsMatch) {
      throw new Error(
        `Could not find templateImageSome base string in template.rs`,
      );
    }
    const imageSomeRs = imageSomeRsMatch[0].slice(3, -2).replace(
      '{src_str}',
      'https://example.com/a.png',
    );
    expect(templates.templateXImage({ src: 'https://example.com/a.png' })).toBe(
      imageSomeRs,
    );

    // Check XSS error logic locally in TS as well
    expect(() => templates.templateXImage({ src: '<script>' })).toThrow();
    expect(() => templates.templateXImage({ src: '  <  script' })).toThrow();

    // Check template_x_svg
    const svgRsMatch = rsContent.match(
      /pub fn template_x_svg\(\) -> String \{\s*r#"([\s\S]*?)"#\.to_string\(\)\s*\}/,
    );
    if (!svgRsMatch) {
      throw new Error(`Could not find template_x_svg in template.rs`);
    }
    expect(templates.templateXSvg()).toBe(svgRsMatch[1]);
  });
});
