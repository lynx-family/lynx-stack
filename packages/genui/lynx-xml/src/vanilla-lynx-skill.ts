// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import backgroundReference from '@lynx-js/skill-vanilla-lynx/references/background.md?raw';
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
    omitLineContaining: 'processData',
  },
  {
    file: 'references/event.md',
    markdown: eventReference,
    sections: [
      'Choose a Context',
      'Cross-Thread Events',
      'Thread-Local Events',
      'Lifecycle Event Names',
      'App Event Names',
    ],
  },
  {
    file: 'references/background.md',
    markdown: backgroundReference,
    sections: [
      'Role',
      'Listen for Messages dispatched from Main Thread',
      'Dispatch Patches to the Main Thread',
      'Handle Background Tasks',
      'Data Guardrails',
    ],
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

function buildSkillGuidance(): string {
  const references = REFERENCE_SELECTIONS.map(selection => {
    const sections = selection.sections.map(sectionName => {
      let section = extractLevelTwoSection(
        selection.markdown,
        sectionName,
        selection.file,
      );
      section = stripFencedCodeBlocks(section);
      if (selection.omitLineContaining) {
        section = omitLinesContaining(section, selection.omitLineContaining);
      }
      if (selection.omitListItemStartingWith) {
        section = omitListItemStartingWith(
          section,
          selection.omitListItemStartingWith,
        );
      }
      return demoteHeadings(section);
    });

    return `### ${selection.file}\n\n${sections.join('\n\n')}`;
  });

  return `
## Imported Vanilla Lynx guidance

The following selected guidance is bundled from ${SKILL_PACKAGE_NAME}. It is
the source of truth for Element PAPI, lifecycle, event routing, background
state, and Lynx styling behavior unless the later Lynx XML adaptation contract
explicitly overrides it. Fenced examples are omitted to keep the generation
prompt focused; their surrounding normative rules are preserved.

${references.join('\n\n')}
`.trim();
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

function stripFencedCodeBlocks(markdown: string): string {
  return markdown
    .replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gmu, '')
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
