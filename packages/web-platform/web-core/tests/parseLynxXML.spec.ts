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
    it('parses the canonical Vanilla Lynx XML format', () => {
      const style = '\n.card { width: 100px; color: red; }\n';
      const mainThreadScript = '\nfunction renderPage() { return null; }\n';
      const backgroundThreadScript =
        '\nglobalThis.__background_started = true;\n';
      const result = expectSuccess(parseLynxXML(
        '<!doctype lynx>\n'
          + '<lynx engine-version="4.2">\n'
          + `<style>${style}</style>\n`
          + `<script thread="main">${mainThreadScript}</script>\n`
          + `<script thread="background">${backgroundThreadScript}</script>\n`
          + '</lynx>',
      ));

      expect(result.style).toBe(style);
      expect(result.mainThreadScript).toBe(mainThreadScript);
      expect(result.backgroundThreadScript).toBe(backgroundThreadScript);
    });

    it('parses the minimal legal document', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2"><script thread="main">main</script></lynx>',
      ));

      expect(result.style).toBeUndefined();
      expect(result.mainThreadScript).toBe('main');
      expect(result.backgroundThreadScript).toBeUndefined();
    });

    it('keeps section content verbatim, whitespace included', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2">\n'
          + '<style>\n.card { width: 1px; }\n</style>\n'
          + '<script thread="main">\nmain\n</script>\n'
          + '</lynx>',
      ));

      expect(result.style).toBe('\n.card { width: 1px; }\n');
      expect(result.mainThreadScript).toBe('\nmain\n');
    });

    it('accepts double and single quoted thread attributes', () => {
      for (
        const attribute of [
          'thread="main"',
          'thread=\'main\'',
        ]
      ) {
        const result = expectSuccess(parseLynxXML(
          `<lynx engine-version="5.4.2"><script ${attribute}>main</script></lynx>`,
        ));
        expect(result.mainThreadScript).toBe('main');
      }
      for (
        const attribute of [
          'thread="background"',
          'thread=\'background\'',
        ]
      ) {
        const result = expectSuccess(parseLynxXML(
          `<lynx engine-version="5.4.2"><script thread="main">main</script>`
            + `<script ${attribute}>bg</script></lynx>`,
        ));
        expect(result.backgroundThreadScript).toBe('bg');
      }
    });

    it('accepts a single quoted engine-version attribute', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version=\'5.4.2\'><script thread="main">main</script></lynx>',
      ));
      expect(result.mainThreadScript).toBe('main');
    });

    it('skips comments in every ignorable position', () => {
      const result = expectSuccess(parseLynxXML(
        '<!-- before doctype -->\n'
          + '<!doctype lynx>\n'
          + '<!-- before root -->\n'
          + '<lynx engine-version="5.4.2">\n'
          + '<!-- inside root -->\n'
          + '<script thread="main">main</script>\n'
          + '<!-- between sections -->\n'
          + '<script thread="background">bg</script>\n'
          + '</lynx>\n'
          + '<!-- after root -->\n',
      ));

      expect(result.mainThreadScript).toBe('main');
      expect(result.backgroundThreadScript).toBe('bg');
    });

    it('accepts optional sections in any order and a leading BOM', () => {
      const result = expectSuccess(parseLynxXML(
        '\uFEFF<lynx engine-version="5.4.2">\n'
          + '<script thread="background">background-code</script>\n'
          + '<script thread="main">main-code</script>\n'
          + '</lynx>',
      ));

      expect(result.style).toBeUndefined();
      expect(result.mainThreadScript).toBe('main-code');
      expect(result.backgroundThreadScript).toBe('background-code');
    });

    it('parses a document without a style section', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2">'
          + '<script thread="main">main</script>'
          + '<script thread="background">bg</script>'
          + '</lynx>',
      ));

      expect(result.style).toBeUndefined();
      expect(result.backgroundThreadScript).toBe('bg');
    });

    it('parses a document without a background script section', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2">'
          + '<style>.a { width: 1px; }</style>'
          + '<script thread="main">main</script>'
          + '</lynx>',
      ));

      expect(result.style).toBe('.a { width: 1px; }');
      expect(result.backgroundThreadScript).toBeUndefined();
    });

    it('keeps an empty style section as an empty string', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2"><style></style>'
          + '<script thread="main">main</script></lynx>',
      ));

      expect(result.style).toBe('');
    });

    it('accepts extra whitespace around attributes', () => {
      for (
        const source of [
          '<lynx  engine-version = "5.4.2" ><script thread="main">m</script></lynx>',
          '<lynx engine-version="5.4.2" ><script thread="main">m</script></lynx>',
          '<lynx engine-version="5.4.2"><script  thread  =  "main" >m</script></lynx>',
        ]
      ) {
        expect(expectSuccess(parseLynxXML(source)).mainThreadScript).toBe('m');
      }
    });

    it('keeps an empty script section as an empty string', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2">'
          + '<script thread="main"></script></lynx>',
      ));

      expect(result.mainThreadScript).toBe('');
    });

    it('tolerates trailing whitespace after the root closing tag', () => {
      const result = expectSuccess(parseLynxXML(
        '<lynx engine-version="5.4.2"><script thread="main">main</script></lynx>\n\n',
      ));

      expect(result.mainThreadScript).toBe('main');
    });
  });

  describe('error branches', () => {
    it('rejects a missing root element', () => {
      expect(expectFailure('<script thread="main">main</script>')).toContain(
        'root element',
      );
    });

    it('rejects a non lynx doctype', () => {
      expect(expectFailure(
        '<!doctype html><lynx engine-version="5.4.2">'
          + '<script thread="main">main</script></lynx>',
      )).toBe('expected \'<!doctype lynx>\'');
    });

    it('rejects an unterminated doctype declaration', () => {
      expect(expectFailure('<!doctype lynx')).toBe(
        'expected \'<!doctype lynx>\'',
      );
    });

    it('rejects a missing engine-version attribute', () => {
      expect(expectFailure(
        '<lynx><script thread="main">main</script></lynx>',
      )).toContain('\'engine-version\' attribute');
    });

    it('rejects an empty engine-version attribute', () => {
      expect(expectFailure(
        '<lynx engine-version=""><script thread="main">main</script></lynx>',
      )).toContain('\'engine-version\' attribute');
    });

    it('rejects an unrelated root attribute', () => {
      expect(expectFailure(
        '<lynx lang="en"><script thread="main">main</script></lynx>',
      )).toContain('\'engine-version\' attribute');
    });

    it('rejects an unterminated root opening tag', () => {
      expect(expectFailure('<lynx engine-version="5.4.2"')).toBe(
        'unterminated \'<lynx>\' opening tag',
      );
    });

    it('rejects a missing main-thread script', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><script thread="background">background</script></lynx>',
      )).toBe('missing \'<script thread="main">\' section');
    });

    it('rejects a document with only a style section', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><style>.a { width: 1px; }</style></lynx>',
      )).toBe('missing \'<script thread="main">\' section');
    });

    it('rejects duplicate script sections', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><script thread="main">main</script>'
          + '<script thread="main">duplicate</script></lynx>',
      )).toContain('duplicate');
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><script thread="main">main</script>'
          + '<script thread="background">a</script><script thread="background">b</script></lynx>',
      )).toContain('duplicate');
    });

    it('rejects duplicate style sections', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><style>a</style><style>b</style>'
          + '<script thread="main">main</script></lynx>',
      )).toBe('duplicate \'<style>\' section');
    });

    it('rejects attributes on the style section', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><style scoped>.a { width: 1px; }</style>'
          + '<script thread="main">main</script></lynx>',
      )).toBe('\'<style>\' does not accept attributes');
    });

    it('rejects a script without a valid thread attribute', () => {
      for (
        const openingTag of [
          '<script>',
          '<script worker>',
          '<script thread>',
          '<script thread="worker">',
          '<script thread="main" defer="true">',
          '<script main-thread="false">',
          '<script background="false">',
          '<script main-thread background>',
        ]
      ) {
        expect(expectFailure(
          `<lynx engine-version="5.4.2">${openingTag}main</script></lynx>`,
        )).toBe(
          '\'<script>\' requires exactly one \'thread="main"\' or \'thread="background"\' attribute',
        );
      }
    });

    it('rejects unknown top-level tags, naming the tag', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><view></view>'
          + '<script thread="main">main</script></lynx>',
      )).toBe('unsupported top-level tag \'<view>\'');
    });

    it('rejects an unexpected closing tag at the top level', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"></style>'
          + '<script thread="main">main</script></lynx>',
      )).toBe('unexpected closing tag');
    });

    it('rejects an unterminated section opening tag', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><script thread="main"',
      )).toBe('unterminated opening tag');
    });

    it('rejects CDATA sections', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2">'
          + '<script thread="main"><![CDATA[main]]></script></lynx>',
      )).toBe('CDATA sections are not supported');
    });

    it('rejects an unterminated comment', () => {
      expect(expectFailure('<lynx engine-version="5.4.2"><!-- unterminated'))
        .toBe(
          'unterminated comment',
        );
    });

    it('rejects a missing section closing tag', () => {
      expect(
        expectFailure(
          '<lynx engine-version="5.4.2"><script thread="main">main',
        ),
      )
        .toBe('missing closing tag \'</script>\'');
    });

    it('rejects a missing root closing tag', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><script thread="main">main</script>',
      )).toBe('missing closing tag \'</lynx>\'');
    });

    it('rejects content after the root closing tag', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2"><script thread="main">main</script></lynx>trailing',
      )).toBe('unexpected content after \'</lynx>\'');
    });

    it('rejects legacy wrapper syntax', () => {
      const canonical = '<!doctype lynx><lynx engine-version="4.2">'
        + '<script thread="main">main</script></lynx>';
      for (
        const source of [
          `<?xml version="1.0"?>${canonical}`,
          canonical.replace('<!doctype lynx>', '<!DOCTYPE lynx>'),
          canonical.replace('engine-version="4.2"', 'version="5.4.2"'),
          canonical.replace('thread="main"', 'main-thread="true"'),
          '<lynx engine-version="4.2"><script thread="main">main</script>'
          + '<script background="true">background</script></lynx>',
          '<lynx engine-version="4.2"><script thread="main">'
          + '<![CDATA[main]]></script></lynx>',
        ]
      ) {
        expect(parseLynxXML(source).success).toBe(false);
      }
    });

    it('rejects an empty document', () => {
      expect(expectFailure('')).toContain('root element');
    });

    it('rejects bare text between sections', () => {
      expect(expectFailure(
        '<lynx engine-version="5.4.2">garbage'
          + '<script thread="main">main</script></lynx>',
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
          '<lynx engine-version',
          '<lynx engine-version=',
          '<lynx engine-version="',
          '</lynx>',
          '<![CDATA[',
          '\uFEFF',
          '\uFEFF<lynx engine-version="1">',
        ]
      ) {
        expect(() => parseLynxXML(source)).not.toThrow();
        expect(parseLynxXML(source).success).toBe(false);
      }
    });

    it('reports the offset of the failing section, not of the document', () => {
      const prefix = '<lynx engine-version="5.4.2">\n';
      const result = parseLynxXML(
        `${prefix}<view></view><script thread="main">main</script></lynx>`,
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
    const root =
      '<lynx engine-version="5.4.2"><script thread="main">m</script></lynx>';
    /**
     * `truncated` and `closed` differ only in the comment's `-->`, so the pair
     * shows the rejection is about the missing terminator and not about a
     * comment being disallowed in that position.
     */
    const positions: Record<string, { truncated: string; closed: string }> = {
      'before the doctype': {
        truncated: `<!-- oops\n<!doctype lynx>\n${root}`,
        closed: `<!-- fine -->\n<!doctype lynx>\n${root}`,
      },
      'between the doctype and the root element': {
        truncated: `<!doctype lynx>\n<!-- oops\n${root}`,
        closed: `<!doctype lynx>\n<!-- fine -->\n${root}`,
      },
      'between two sections': {
        truncated:
          '<lynx engine-version="5.4.2"><script thread="main">m</script>\n'
          + '<!-- oops\n<script thread="background">b</script></lynx>',
        closed:
          '<lynx engine-version="5.4.2"><script thread="main">m</script>\n'
          + '<!-- fine -->\n<script thread="background">b</script></lynx>',
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
    const engineVersionRejected =
      '\'<lynx>\' requires exactly one non-empty \'engine-version\' attribute';

    it('rejects a bare \'engine-version\' with no value', () => {
      expect(expectFailure(
        '<lynx engine-version><script thread="main">m</script></lynx>',
      )).toBe(engineVersionRejected);
    });

    it('rejects an attribute that only starts with \'engine-version\'', () => {
      for (
        const attribute of [
          'engine-versionless="1"',
          'engine-version-name="5.4.2"',
        ]
      ) {
        expect(expectFailure(
          `<lynx ${attribute}><script thread="main">m</script></lynx>`,
        )).toBe(engineVersionRejected);
      }
    });

    it('rejects a script attribute that only starts with a known name', () => {
      for (const attribute of ['threaded="main"', 'thread-name="background"']) {
        expect(expectFailure(
          `<lynx engine-version="5.4.2"><script ${attribute}>m</script></lynx>`,
        )).toBe(
          '\'<script>\' requires exactly one \'thread="main"\' or \'thread="background"\' attribute',
        );
      }
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
      // The fixture uses raw sections, so no legacy wrapper may appear.
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
   * The corpus below pins the rejection and acceptance boundaries of the
   * current Vanilla Lynx XML grammar.
   */
  describe('current grammar boundaries', () => {
    it('rejects every malformed document in the corpus', () => {
      const sources = [
        '<script thread="main">main</script>',
        '<!doctype html><lynx engine-version="5.4.2">'
        + '<script thread="main">main</script></lynx>',
        '<lynx engine-version="5.4.2"><style scoped>.a { width: 1px; }</style>'
        + '<script thread="main">main</script></lynx>',
        '<lynx engine-version="5.4.2"><script>main</script></lynx>',
        '<lynx engine-version="5.4.2"><script worker>main</script></lynx>',
        '<lynx engine-version="5.4.2"><script thread="main">main</script>'
        + '<script thread="main">duplicate</script></lynx>',
        '<lynx engine-version="5.4.2"><script thread="background">background</script></lynx>',
        '<lynx engine-version="5.4.2"><view></view>'
        + '<script thread="main">main</script></lynx>',
        '<lynx engine-version="5.4.2"><script thread="main">main',
        '<lynx engine-version="5.4.2"><!-- unterminated',
        '<lynx><script thread="main">main</script></lynx>',
        '<lynx engine-version=""><script thread="main">main</script></lynx>',
        '<lynx lang="en"><script thread="main">main</script></lynx>',
        '<lynx engine-version="5.4.2">'
        + '<script main-thread="false">main</script></lynx>',
        '<lynx engine-version="5.4.2">'
        + '<script thread="main"><![CDATA[main</script></lynx>',
        '<lynx engine-version="5.4.2">'
        + '<script thread="main">main</script>',
      ];

      expect(sources.filter((source) => parseLynxXML(source).success))
        .toEqual([]);
      for (const source of sources) {
        expectFailure(source);
      }
    });

    it('extracts every current-format section', () => {
      const full = expectSuccess(parseLynxXML(
        '<!doctype lynx>\n'
          + '<!-- A Lynx single-file bundle. -->\n'
          + '<lynx engine-version="5.4.2">\n'
          + '<style>\n.card { width: 100px; }\n</style>\n'
          + '<script thread="main">\nmain\n</script>\n'
          + '<script thread="background">\nbackground\n</script>\n'
          + '</lynx>',
      ));
      expect(full.style).toBe('\n.card { width: 100px; }\n');
      expect(full.mainThreadScript).toBe('\nmain\n');
      expect(full.backgroundThreadScript).toBe('\nbackground\n');

      const anyOrder = expectSuccess(parseLynxXML(
        '\uFEFF<lynx engine-version="5.4.2">\n'
          + '<script thread="background">background-code</script>\n'
          + '<script thread="main">main-code</script>\n'
          + '</lynx>',
      ));
      expect(anyOrder.style).toBeUndefined();
      expect(anyOrder.mainThreadScript).toBe('main-code');
      expect(anyOrder.backgroundThreadScript).toBe('background-code');
    });
  });
});
