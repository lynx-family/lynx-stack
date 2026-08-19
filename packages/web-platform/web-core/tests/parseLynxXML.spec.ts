// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from '@rstest/core';

import { parseLynxXML } from '../ts/common/xml/parseLynxXML.js';
import type {
  LynxXMLParseResult,
  LynxXMLParseSuccess,
} from '../ts/common/xml/parseLynxXML.js';

function expectSuccess(result: LynxXMLParseResult): LynxXMLParseSuccess {
  if (!result.success) {
    throw new Error(`expected a successful parse: ${result.error.message}`);
  }
  return result;
}

function expectFailure(source: string): string {
  const result = parseLynxXML(source);
  if (result.success) {
    throw new Error(`expected a failed parse for: ${source}`);
  }
  expect(result.error.formattedMessage).toBe(
    `invalid TemplateBundle XML at offset ${result.error.offset}: ${result.error.message}`,
  );
  expect(result.error.formattedMessage.startsWith(
    'invalid TemplateBundle XML at offset',
  )).toBe(true);
  expect(result.error.offset).toBeGreaterThanOrEqual(0);
  return result.error.message;
}

describe('parseLynxXML', () => {
  describe('happy paths', () => {
    it('parses a full document with declaration, doctype and CDATA', () => {
      const style = '\n.card { width: 100px; color: red; }\n';
      const mainThreadScript = '\nfunction renderPage() { return null; }\n';
      const backgroundThreadScript =
        '\nglobalThis.__background_started = true;\n';
      const result = expectSuccess(parseLynxXML(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
          + '<!DOCTYPE lynx>\n'
          + '<lynx version="5.4.2">\n'
          + `<style><![CDATA[${style}]]></style>\n`
          + `<script main-thread="true"><![CDATA[${mainThreadScript}]]></script>\n`
          + `<script background="true"><![CDATA[${backgroundThreadScript}]]></script>\n`
          + '</lynx>',
      ));

      expect(result.style).toBe(style);
      expect(result.mainThreadScript).toBe(mainThreadScript);
      expect(result.backgroundThreadScript).toBe(backgroundThreadScript);
    });

    it('parses the minimal legal document', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2"><script main-thread>main</script></lynx>',
      ));

      expect(result.style).toBeUndefined();
      expect(result.mainThreadScript).toBe('main');
      expect(result.backgroundThreadScript).toBeUndefined();
    });

    it('keeps bare (non CDATA) content verbatim, whitespace included', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2">\n'
          + '<style>\n.card { width: 1px; }\n</style>\n'
          + '<script main-thread>\nmain\n</script>\n'
          + '</lynx>',
      ));

      expect(result.style).toBe('\n.card { width: 1px; }\n');
      expect(result.mainThreadScript).toBe('\nmain\n');
    });

    it('allows CDATA content that itself contains a closing tag', () => {
      const mainThreadScript = '\nconst closingTag = "</script>";\n';
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2">'
          + `<script main-thread="true"><![CDATA[${mainThreadScript}]]></script>`
          + '</lynx>',
      ));

      expect(result.mainThreadScript).toBe(mainThreadScript);
    });

    it('accepts the three boolean attribute spellings', () => {
      for (
        const attribute of [
          'main-thread',
          'main-thread="true"',
          'main-thread=\'true\'',
        ]
      ) {
        const result = expectSuccess(parseLynxXML(
          `<lynx version="5.4.2"><script ${attribute}>main</script></lynx>`,
        ));
        expect(result.mainThreadScript).toBe('main');
      }
      for (
        const attribute of [
          'background',
          'background="true"',
          'background=\'true\'',
        ]
      ) {
        const result = expectSuccess(parseLynxXML(
          `<lynx version="5.4.2"><script main-thread>main</script>`
            + `<script ${attribute}>bg</script></lynx>`,
        ));
        expect(result.backgroundThreadScript).toBe('bg');
      }
    });

    it('accepts doctype casing variants', () => {
      for (
        const doctype of [
          '<!DOCTYPE lynx>',
          '<!doctype lynx>',
          '<!DoCtYpE LyNx>',
          '<!DOCTYPE   lynx  >',
        ]
      ) {
        const result = expectSuccess(parseLynxXML(
          `${doctype}<lynx version="5.4.2">`
            + '<script main-thread>main</script></lynx>',
        ));
        expect(result.mainThreadScript).toBe('main');
      }
    });

    it('accepts a single quoted version attribute', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version=\'5.4.2\'><script main-thread>main</script></lynx>',
      ));
      expect(result.mainThreadScript).toBe('main');
    });

    it('skips comments in every ignorable position', () => {
      const result = expectSuccess(parseLynxXML(
        '<!-- before declaration -->\n'
          + '<?xml version="1.0"?>\n'
          + '<!-- between declaration and doctype -->\n'
          + '<!DOCTYPE lynx>\n'
          + '<!-- before root -->\n'
          + '<lynx version="5.4.2">\n'
          + '<!-- inside root -->\n'
          + '<script main-thread>main</script>\n'
          + '<!-- between sections -->\n'
          + '<script background>bg</script>\n'
          + '</lynx>\n'
          + '<!-- after root -->\n',
      ));

      expect(result.mainThreadScript).toBe('main');
      expect(result.backgroundThreadScript).toBe('bg');
    });

    it('accepts optional sections in any order and a leading BOM', () => {
      const result = expectSuccess(parseLynxXML(
        '\uFEFF<lynx version="5.4.2">\n'
          + '<script background>background-code</script>\n'
          + '<script main-thread>main-code</script>\n'
          + '</lynx>',
      ));

      expect(result.style).toBeUndefined();
      expect(result.mainThreadScript).toBe('main-code');
      expect(result.backgroundThreadScript).toBe('background-code');
    });

    it('parses a document without a style section', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2">'
          + '<script main-thread>main</script>'
          + '<script background>bg</script>'
          + '</lynx>',
      ));

      expect(result.style).toBeUndefined();
      expect(result.backgroundThreadScript).toBe('bg');
    });

    it('parses a document without a background script section', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2">'
          + '<style>.a { width: 1px; }</style>'
          + '<script main-thread>main</script>'
          + '</lynx>',
      ));

      expect(result.style).toBe('.a { width: 1px; }');
      expect(result.backgroundThreadScript).toBeUndefined();
    });

    it('keeps an empty style section as an empty string', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2"><style></style>'
          + '<script main-thread>main</script></lynx>',
      ));

      expect(result.style).toBe('');
    });

    it('accepts extra whitespace around attributes', () => {
      for (
        const source of [
          '<lynx  version = "5.4.2" ><script main-thread>m</script></lynx>',
          '<lynx version="5.4.2" ><script main-thread>m</script></lynx>',
          '<lynx version="5.4.2"><script  main-thread  =  "true" >m</script></lynx>',
        ]
      ) {
        expect(expectSuccess(parseLynxXML(source)).mainThreadScript).toBe('m');
      }
    });

    it('keeps an empty CDATA section as an empty string', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2">'
          + '<script main-thread><![CDATA[]]></script></lynx>',
      ));

      expect(result.mainThreadScript).toBe('');
    });

    it('tolerates trailing whitespace after the root closing tag', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2"><script main-thread>main</script></lynx>\n\n',
      ));

      expect(result.mainThreadScript).toBe('main');
    });
  });

  describe('error branches', () => {
    it('rejects a missing root element', () => {
      expect(expectFailure('<script main-thread>main</script>')).toContain(
        'root element',
      );
    });

    it('rejects a non lynx doctype', () => {
      expect(expectFailure(
        '<!doctype html><lynx version="5.4.2">'
          + '<script main-thread>main</script></lynx>',
      )).toBe('expected \'<!doctype lynx>\'');
    });

    it('rejects an unterminated doctype declaration', () => {
      expect(expectFailure('<!doctype lynx')).toBe(
        'unterminated doctype declaration',
      );
    });

    it('rejects a missing version attribute', () => {
      expect(expectFailure(
        '<lynx><script main-thread>main</script></lynx>',
      )).toContain('\'version\' attribute');
    });

    it('rejects an empty version attribute', () => {
      expect(expectFailure(
        '<lynx version=""><script main-thread>main</script></lynx>',
      )).toContain('\'version\' attribute');
    });

    it('rejects an unrelated root attribute', () => {
      expect(expectFailure(
        '<lynx lang="en"><script main-thread>main</script></lynx>',
      )).toContain('\'version\' attribute');
    });

    it('rejects an unterminated root opening tag', () => {
      expect(expectFailure('<lynx version="5.4.2"')).toBe(
        'unterminated \'<lynx>\' opening tag',
      );
    });

    it('rejects a missing main-thread script', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><script background>background</script></lynx>',
      )).toBe('missing \'<script main-thread>\' section');
    });

    it('rejects a document with only a style section', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><style>.a { width: 1px; }</style></lynx>',
      )).toBe('missing \'<script main-thread>\' section');
    });

    it('rejects duplicate script sections', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><script main-thread>main</script>'
          + '<script main-thread>duplicate</script></lynx>',
      )).toContain('duplicate');
      expect(expectFailure(
        '<lynx version="5.4.2"><script main-thread>main</script>'
          + '<script background>a</script><script background>b</script></lynx>',
      )).toContain('duplicate');
    });

    it('rejects duplicate style sections', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><style>a</style><style>b</style>'
          + '<script main-thread>main</script></lynx>',
      )).toBe('duplicate \'<style>\' section');
    });

    it('rejects attributes on the style section', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><style scoped>.a { width: 1px; }</style>'
          + '<script main-thread>main</script></lynx>',
      )).toBe('\'<style>\' does not accept attributes');
    });

    it('rejects a script without main-thread or background', () => {
      for (
        const openingTag of [
          '<script>',
          '<script worker>',
          '<script main-thread="false">',
          '<script background="false">',
          '<script main-thread background>',
        ]
      ) {
        expect(expectFailure(
          `<lynx version="5.4.2">${openingTag}main</script></lynx>`,
        )).toBe(
          '\'<script>\' requires exactly one of \'main-thread\' or \'background\'',
        );
      }
    });

    it('rejects unknown top-level tags, naming the tag', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><view></view>'
          + '<script main-thread>main</script></lynx>',
      )).toBe('unsupported top-level tag \'<view>\'');
    });

    it('rejects an unexpected closing tag at the top level', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"></style>'
          + '<script main-thread>main</script></lynx>',
      )).toBe('unexpected closing tag');
    });

    it('rejects an unterminated section opening tag', () => {
      expect(expectFailure('<lynx version="5.4.2"><script main-thread')).toBe(
        'unterminated opening tag',
      );
    });

    it('rejects an unterminated CDATA section', () => {
      expect(expectFailure(
        '<lynx version="5.4.2">'
          + '<script main-thread="true"><![CDATA[main</script></lynx>',
      )).toBe('unterminated CDATA section');
    });

    it('rejects content after the CDATA section', () => {
      expect(expectFailure(
        '<lynx version="5.4.2">'
          + '<script main-thread><![CDATA[a]]>trailing]]></script></lynx>',
      )).toBe('unexpected content after the CDATA section');
    });

    it('rejects an unterminated comment', () => {
      expect(expectFailure('<lynx version="5.4.2"><!-- unterminated')).toBe(
        'unterminated comment',
      );
    });

    it('rejects a missing section closing tag', () => {
      expect(expectFailure('<lynx version="5.4.2"><script main-thread>main'))
        .toBe('missing closing tag \'</script>\'');
    });

    it('rejects a missing root closing tag', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><script main-thread="true">main</script>',
      )).toBe('missing closing tag \'</lynx>\'');
    });

    it('rejects content after the root closing tag', () => {
      expect(expectFailure(
        '<lynx version="5.4.2"><script main-thread>main</script></lynx>trailing',
      )).toBe('unexpected content after \'</lynx>\'');
    });

    it('rejects an unterminated XML declaration', () => {
      expect(expectFailure(
        '<?xml version="1.0"<lynx version="5.4.2">'
          + '<script main-thread>main</script></lynx>',
      )).toBe('unterminated XML declaration');
    });

    it('rejects an empty document', () => {
      expect(expectFailure('')).toContain('root element');
    });

    it('rejects bare text between sections', () => {
      expect(expectFailure(
        '<lynx version="5.4.2">garbage'
          + '<script main-thread>main</script></lynx>',
      )).toBe('unexpected content outside a section');
    });

    it('never throws, whatever the input is', () => {
      for (
        const source of [
          '',
          '<',
          '<!',
          '<!-',
          '<?xml',
          '<lynx',
          '<lynx version',
          '<lynx version=',
          '<lynx version="',
          '</lynx>',
          '<![CDATA[',
          '\uFEFF',
          '\uFEFF<lynx version="1">',
        ]
      ) {
        expect(() => parseLynxXML(source)).not.toThrow();
        expect(parseLynxXML(source).success).toBe(false);
      }
    });

    it('reports the offset of the failing section, not of the document', () => {
      const prefix = '<lynx version="5.4.2">\n';
      const result = parseLynxXML(
        `${prefix}<view></view><script main-thread>main</script></lynx>`,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.offset).toBe(prefix.length);
      }
    });
  });

  /**
   * A comment may appear in every ignorable position, so an *unterminated* one
   * has to be rejected from every one of them. Each slot is a separate call
   * site in `parse()`, and a missed one degrades quietly: the parser would stop
   * scanning and report whatever the state happened to be - typically "missing
   * closing tag" or a bogus success - instead of naming the real defect.
   */
  describe('an unterminated comment is rejected from every position', () => {
    const root = '<lynx version="5.4.2"><script main-thread>m</script></lynx>';
    /**
     * `truncated` and `closed` differ only in the comment's `-->`, so the pair
     * shows the rejection is about the missing terminator and not about a
     * comment being disallowed in that position.
     */
    const positions: Record<string, { truncated: string; closed: string }> = {
      'before the XML declaration': {
        truncated: `<!-- oops\n<?xml version="1.0"?>\n${root}`,
        closed: `<!-- fine -->\n<?xml version="1.0"?>\n${root}`,
      },
      'between the declaration and the doctype': {
        truncated: `<?xml version="1.0"?>\n<!-- oops\n<!DOCTYPE lynx>\n${root}`,
        closed:
          `<?xml version="1.0"?>\n<!-- fine -->\n<!DOCTYPE lynx>\n${root}`,
      },
      'between the doctype and the root element': {
        truncated: `<!DOCTYPE lynx>\n<!-- oops\n${root}`,
        closed: `<!DOCTYPE lynx>\n<!-- fine -->\n${root}`,
      },
      'between two sections': {
        truncated: '<lynx version="5.4.2"><script main-thread>m</script>\n'
          + '<!-- oops\n<script background>b</script></lynx>',
        closed: '<lynx version="5.4.2"><script main-thread>m</script>\n'
          + '<!-- fine -->\n<script background>b</script></lynx>',
      },
      'after the root closing tag': {
        truncated: `${root}\n<!-- oops`,
        closed: `${root}\n<!-- fine -->`,
      },
    };

    for (const [where, { truncated, closed }] of Object.entries(positions)) {
      it(`rejects one ${where}`, () => {
        expect(expectFailure(truncated)).toBe('unterminated comment');

        const result = parseLynxXML(truncated);
        if (result.success) {
          throw new Error('unreachable');
        }
        // Pointing at the comment's own start is what makes the message
        // actionable; the end of the document would be useless.
        expect(result.error.offset).toBe(truncated.indexOf('<!--'));

        expectSuccess(parseLynxXML(closed));
      });
    }
  });

  /**
   * Both attribute matchers start with a `startsWith` test, so a missing
   * follow-up check would accept any attribute that merely *begins* with the
   * expected name. That is the silent-acceptance direction: the document looks
   * legal, and the value is then read from the wrong attribute.
   */
  describe('attribute names are matched whole, not by prefix', () => {
    const versionRejected =
      '\'<lynx>\' requires exactly one non-empty \'version\' attribute';

    it('rejects a bare \'version\' with no value', () => {
      expect(expectFailure(
        '<lynx version><script main-thread>m</script></lynx>',
      )).toBe(versionRejected);
    });

    it('rejects an attribute that only starts with \'version\'', () => {
      for (const attribute of ['versionless="1"', 'version-name="5.4.2"']) {
        expect(expectFailure(
          `<lynx ${attribute}><script main-thread>m</script></lynx>`,
        )).toBe(versionRejected);
      }
    });

    it('rejects a script attribute that only starts with a known name', () => {
      for (const attribute of ['main-threaded', 'backgrounded="true"']) {
        expect(expectFailure(
          `<lynx version="5.4.2"><script ${attribute}>m</script></lynx>`,
        )).toBe(
          '\'<script>\' requires exactly one of \'main-thread\' or \'background\'',
        );
      }
    });
  });

  describe('CDATA boundaries', () => {
    it('rejects text after the CDATA section with no second \']]>\'', () => {
      // Distinct from both existing CDATA failures: the `]]>` *is* found, so
      // the section is not unterminated from `#consumeSection`'s point of
      // view, and the trailing text is not a second CDATA end either. Without
      // the `endsWith` check the trailing text would be silently swallowed
      // into - or dropped from - the section's content.
      const source = '<lynx version="5.4.2">'
        + '<script main-thread><![CDATA[main]]>tail</script></lynx>';
      expect(expectFailure(source)).toBe('unterminated CDATA section');

      const result = parseLynxXML(source);
      if (result.success) {
        throw new Error('unreachable');
      }
      // Reported at the section's content start, i.e. where the CDATA began.
      expect(result.error.offset).toBe(source.indexOf('<![CDATA['));
    });

    it('strips whitespace around a CDATA wrapper but not inside it', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx version="5.4.2">'
          + '<style>\n  <![CDATA[ .a { width: 1px; } ]]>\n  </style>'
          + '<script main-thread>m</script></lynx>',
      ));
      // The wrapper's surrounding whitespace is layout, the inner whitespace is
      // content.
      expect(result.style).toBe(' .a { width: 1px; } ');
    });
  });

  describe('real world fixture', () => {
    it('parses markup-card.xml into three non-empty sections', () => {
      const source = readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          'fixtures',
          'markup-card.xml',
        ),
        'utf8',
      );
      const result = expectSuccess(parseLynxXML(source));

      expect(result.style).toBeTruthy();
      expect(result.style).toContain('.page');
      expect(result.mainThreadScript).toBeTruthy();
      expect(result.mainThreadScript).toContain('__CreatePage');
      expect(result.backgroundThreadScript).toBeTruthy();
      expect(result.backgroundThreadScript).toContain('lynx.getCoreContext');
      // No CDATA markers may leak into the extracted sections.
      for (
        const section of [
          result.style!,
          result.mainThreadScript,
          result.backgroundThreadScript!,
        ]
      ) {
        expect(section).not.toContain('<![CDATA[');
        expect(section).not.toContain(']]>');
      }
    });
  });

  /**
   * The corpus below mirrors the rejection and acceptance cases of the
   * engine-side reference parser, so that any behavioral drift from it is
   * caught here.
   */
  describe('parity with the reference parser', () => {
    it('rejects every document the reference parser rejects', () => {
      const sources = [
        '<script main-thread>main</script>',
        '<!doctype html><lynx version="5.4.2">'
        + '<script main-thread>main</script></lynx>',
        '<lynx version="5.4.2"><style scoped>.a { width: 1px; }</style>'
        + '<script main-thread>main</script></lynx>',
        '<lynx version="5.4.2"><script>main</script></lynx>',
        '<lynx version="5.4.2"><script worker>main</script></lynx>',
        '<lynx version="5.4.2"><script main-thread>main</script>'
        + '<script main-thread>duplicate</script></lynx>',
        '<lynx version="5.4.2"><script background>background</script></lynx>',
        '<lynx version="5.4.2"><view></view>'
        + '<script main-thread>main</script></lynx>',
        '<lynx version="5.4.2"><script main-thread>main',
        '<lynx version="5.4.2"><!-- unterminated',
        '<lynx><script main-thread>main</script></lynx>',
        '<lynx version=""><script main-thread>main</script></lynx>',
        '<lynx lang="en"><script main-thread>main</script></lynx>',
        '<lynx version="5.4.2">'
        + '<script main-thread="false">main</script></lynx>',
        '<lynx version="5.4.2">'
        + '<script main-thread="true"><![CDATA[main</script></lynx>',
        '<lynx version="5.4.2">'
        + '<script main-thread="true">main</script>',
      ];

      expect(sources.filter((source) => parseLynxXML(source).success))
        .toEqual([]);
      for (const source of sources) {
        expectFailure(source);
      }
    });

    it('extracts the same sections as the reference parser', () => {
      const full = expectSuccess(parseLynxXML(
        '<?xml version="1.0"?>\n'
          + '<!-- A Lynx single-file bundle. -->\n'
          + '<lynx version="5.4.2">\n'
          + '<style>\n.card { width: 100px; }\n</style>\n'
          + '<script main-thread>\nmain\n</script>\n'
          + '<script background>\nbackground\n</script>\n'
          + '</lynx>',
      ));
      expect(full.style).toBe('\n.card { width: 100px; }\n');
      expect(full.mainThreadScript).toBe('\nmain\n');
      expect(full.backgroundThreadScript).toBe('\nbackground\n');

      const anyOrder = expectSuccess(parseLynxXML(
        '\uFEFF<lynx version="5.4.2">\n'
          + '<script background>background-code</script>\n'
          + '<script main-thread>main-code</script>\n'
          + '</lynx>',
      ));
      expect(anyOrder.style).toBeUndefined();
      expect(anyOrder.mainThreadScript).toBe('main-code');
      expect(anyOrder.backgroundThreadScript).toBe('background-code');
    });
  });
});
