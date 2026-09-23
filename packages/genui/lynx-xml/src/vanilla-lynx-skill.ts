// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import eventReference from '@lynx-js/skill-vanilla-lynx/references/event.md?raw';
import lynxXmlReference from '@lynx-js/skill-vanilla-lynx/references/lynxml.md?raw';
import mainThreadReference from '@lynx-js/skill-vanilla-lynx/references/main-thread.md?raw';
import styleReference from '@lynx-js/skill-vanilla-lynx/references/style.md?raw';
import vanillaLynxSkill from '@lynx-js/skill-vanilla-lynx/SKILL.md?raw';

const SKILL_PACKAGE_NAME = '@lynx-js/skill-vanilla-lynx';

interface SkillReferenceSelection {
  file: string;
  markdown: string;
  sections: string[];
  templateReuseSections?: string[];
  omitLineContaining?: string;
  omitListItemStartingWith?: string;
}

const REFERENCE_SELECTIONS: SkillReferenceSelection[] = [
  {
    file: 'SKILL.md',
    markdown: vanillaLynxSkill,
    sections: ['Core Rules'],
    omitListItemStartingWith: 'Keep external bundle',
  },
  {
    file: 'references/lynxml.md',
    markdown: lynxXmlReference,
    sections: [
      'Document Contract',
      'Assemble the Artifact',
      'Pre-delivery Check',
    ],
    templateReuseSections: ['Document Contract', 'Pre-delivery Check'],
    omitLineContaining: 'external-build.md',
  },
  {
    file: 'references/main-thread.md',
    markdown: mainThreadReference,
    sections: [
      'Responsibilities',
      'Element PAPI Surface',
      'Build the Tree',
      'Bind Element Events',
      'Render',
      'Update',
      'Lifecycle Cleanup',
    ],
    templateReuseSections: ['Element PAPI Surface', 'Build the Tree'],
    omitLineContaining: 'processData',
  },
  {
    file: 'references/event.md',
    markdown: eventReference,
    sections: [
      'Choose a Context',
      'Thread-Local Events',
      'Lifecycle Event Names',
    ],
    templateReuseSections: ['Choose a Context', 'Thread-Local Events'],
  },
  {
    file: 'references/style.md',
    markdown: styleReference,
    sections: [
      'Runtime Style Application',
      'Strict Authoring Rules',
      'Web Margin Collapse Migration — High Priority',
      'Runtime Transform Geometry',
      'CSS Property Allowlist',
      'Responsive Sizing',
      'Images',
    ],
  },
];

/** Selected guidance bundled directly from `@lynx-js/skill-vanilla-lynx`. */
export const VANILLA_LYNX_SKILL_GUIDANCE: string = buildSkillGuidance();

/** Guidance for model-authored business callbacks with agent-owned lifecycle code. */
export const VANILLA_LYNX_REUSED_SCRIPT_GUIDANCE: string = buildSkillGuidance(
  'script-reuse',
);

/** Dynamic API guidance when the agent owns both the initial tree and lifecycle. */
export const VANILLA_LYNX_TEMPLATE_REUSED_SCRIPT_GUIDANCE: string =
  buildSkillGuidance('template-script-reuse');

function buildSkillGuidance(
  mode: 'full' | 'script-reuse' | 'template-script-reuse' = 'full',
): string {
  const references = REFERENCE_SELECTIONS.map(selection => {
    const selectedSections = mode === 'template-script-reuse'
      ? selection.templateReuseSections ?? selection.sections
      : selection.sections;
    const sections = selectedSections.filter(sectionName =>
      mode === 'full' || selection.file !== 'references/main-thread.md'
      || !['Bind Element Events', 'Render', 'Update', 'Lifecycle Cleanup']
        .includes(sectionName)
    ).map(sectionName => {
      let section = extractLevelTwoSection(
        selection.markdown,
        sectionName,
        selection.file,
      );
      section = stripFencedExamples(section);
      if (selection.file !== 'references/style.md') {
        section = keepMainThreadGuidance(section);
      }
      if (selection.omitLineContaining) {
        section = omitLinesContaining(section, selection.omitLineContaining);
      }
      if (selection.omitListItemStartingWith) {
        section = omitListItemStartingWith(
          section,
          selection.omitListItemStartingWith,
        );
      }
      if (mode === 'template-script-reuse') {
        section = compactTemplateReuseSection(
          section,
          selection.file,
          sectionName,
        );
      }
      return demoteHeadings(section);
    });

    return `### ${selection.file}\n\n${sections.join('\n\n')}`;
  });

  return `
## Imported Vanilla Lynx guidance

The following selected guidance is bundled from ${SKILL_PACKAGE_NAME}. It is
the source of truth for Element PAPI, lifecycle, local events,
and Lynx styling behavior unless the later Lynx XML adaptation contract
explicitly overrides it. Code examples are omitted to keep the generation
prompt focused; plain-text constraint lists and surrounding rules are preserved.

${references.join('\n\n')}
`.trim();
}

function compactTemplateReuseSection(
  section: string,
  file: string,
  heading: string,
): string {
  if (file === 'SKILL.md') {
    return selectParagraphs(section, ['- Do not use ReactLynx']);
  }
  if (file === 'references/lynxml.md') {
    return section.split('\n').filter(line =>
      !line.startsWith('- Put source blocks')
      && !line.startsWith('- Do not put UI markup')
      && !line.startsWith('- Every lifecycle')
      && !line.startsWith('- Later UI mutation')
    ).join('\n');
  }
  if (file === 'references/main-thread.md') {
    if (heading === 'Build the Tree') {
      // These update constraints live beside the initial-tree instructions.
      return selectParagraphs(section, [
        'Raw-text nodes are immutable',
        'When an existing image will switch sources',
      ]);
    }
    return `## Element Handles

Treat ElementRef values as opaque handles. Never read or write their properties,
enumerate, clone, spread, serialize, or attach application state to them. Use
the ctx UI helpers to create or mutate nodes. Do not call raw Element PAPI.`;
  }
  if (file === 'references/event.md') {
    return heading === 'Choose a Context'
      ? `## App Event Payloads

Use ctx.emit(eventName, data) to dispatch main-thread app events and
ctx.listen(eventName, handler) to receive their payload from event.data.`
      : '';
  }
  if (
    file === 'references/style.md'
    && heading === 'Runtime Style Application'
  ) {
    return `## Runtime Style Application

- Apply static classes in the template. For dynamic state use ctx.setClasses().
  Reserve ctx.setInlineStyles() for runtime-computed values.
- For a passive overlay use pointer-events classes. For the
  user-interaction-enabled Element attribute use ctx.setAttribute().`;
  }
  // CSS rules, including the full property lists, are never compacted.
  return file === 'references/style.md'
    ? section.replace('real Element PAPI nodes', 'real nodes')
    : section;
}

function selectParagraphs(markdown: string, prefixes: string[]): string {
  const paragraphs = markdown.split(/\n{2,}|\n(?=- )/u);
  return prefixes.map(prefix => {
    const paragraph = paragraphs.find(value => value.startsWith(prefix));
    if (!paragraph) {
      throw new Error(
        `[genui-lynx-xml] Missing skill paragraph starting with ${
          JSON.stringify(prefix)
        }.`,
      );
    }
    return paragraph;
  }).join('\n\n');
}

function extractLevelTwoSection(
  markdown: string,
  heading: string,
  file: string,
): string {
  const normalized = normalizeMarkdown(markdown);
  const lines = normalized.split('\n');
  const marker = `## ${heading}`;
  const start = lines.findIndex(line => line === marker);
  if (start < 0) {
    throw new Error(
      `[genui-lynx-xml] Missing section ${JSON.stringify(heading)} in ${file}.`,
    );
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('## ')) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/gu, '\n').trim();
}

function stripFencedExamples(markdown: string): string {
  return markdown
    .replace(
      /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gmu,
      (_match, language: string, content: string) =>
        // The skill uses text fences for normative CSS property lists.
        language.trim() === 'text' ? content.trimEnd() : '',
    )
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function keepMainThreadGuidance(markdown: string): string {
  // The pinned skill mixes both thread modes in paragraphs and table rows.
  // Preserve their main-thread clauses before dropping the remaining guidance.
  // Style guidance bypasses this filter: CSS background properties are valid.
  return markdown
    .replace(
      /^## Choose a Context\n[\s\S]*?(?=^Dispatch app-defined events)/mu,
      '## App Event Payloads\n\n',
    )
    .replace(/ Never call Element PAPI APIs[^\n]*/gu, '')
    .replace(/ Background-thread (?:source|workflows)[^\n]*/gu, '')
    .replaceAll('thread-local or cross-thread events', 'local events')
    .replaceAll('long-lived and cross-thread listeners', 'long-lived listeners')
    .replaceAll(', then optional `<script thread="background">`', '')
    .replaceAll(
      'Main and optional background JavaScript are',
      'Main-thread JavaScript is',
    )
    .replaceAll(
      ' and dispatch an app-defined destroy event to the background when present',
      '',
    )
    .replaceAll('either local event loop', 'the local event loop')
    .split('\n')
    .filter(line => !/\bbackground\b|cross-thread/iu.test(line))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function omitLinesContaining(markdown: string, value: string): string {
  return markdown
    .split('\n')
    .filter(line => !line.includes(value))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function omitListItemStartingWith(
  markdown: string,
  value: string,
): string {
  return markdown
    .split('\n')
    .filter(line => !line.startsWith(`- ${value}`))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function demoteHeadings(markdown: string): string {
  return markdown
    .replace(/^### /gmu, '##### ')
    .replace(/^## /gmu, '#### ');
}
