// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState } from 'react';

import {
  BENCH_PRESET_OPTIONS,
  BENCH_PROTOCOL_OPTIONS,
  MAX_BENCH_GROUPS,
  isDocumentBenchProtocol,
  usesCatalog,
} from './benchData.js';
import type { BenchGroup, BenchPreset, BenchProtocol } from './benchData.js';
import { BenchDropdown } from './BenchDropdown.js';
import { Button } from '../../components/Button.js';
import { MessageSquarePlus, Trash2 } from '../../components/Icon.js';

export interface BenchModelOption {
  id: string;
  label: string;
}

export function BenchComparisonGroupsSection(props: {
  catalogOptions: readonly string[];
  groups: readonly BenchGroup[];
  locked: boolean;
  modelOptions: readonly BenchModelOption[];
  onAdd: () => void;
  onPresetChange?: (preset: BenchPreset) => void;
  onCatalogChange: (id: string, catalog: string) => void;
  onFragmentChange: (id: string, enabled: boolean) => void;
  onEnabledChange: (id: string, enabled: boolean) => void;
  onModelChange: (id: string, model: string) => void;
  onNameChange: (id: string, name: string) => void;
  onPromptChange: (id: string, prompt: string) => void;
  onProtocolChange: (id: string, protocol: BenchProtocol) => void;
  onRemove: (id: string) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<BenchPreset>('protocol');
  const hasA2UIAndOpenUI =
    props.groups.some((group) => group.protocol === 'a2ui')
    && props.groups.some((group) => group.protocol === 'openui');
  return (
    <section
      className='benchPlanSection benchGroupsSection'
      data-read-only={props.locked || undefined}
    >
      <div className='benchSectionHeader benchGroupsHeader'>
        <div className='benchSetupHeading'>
          <span className='benchStepNumber'>2</span>
          <div>
            <h3 className='benchSectionTitle'>Create comparison groups</h3>
            <p className='benchSectionSub'>
              Add groups and configure each one independently.
            </p>
          </div>
        </div>
        <label className='benchField benchPresetField'>
          <span className='benchFieldLabel'>Preset</span>
          <span className='benchPresetSelect'>
            <select
              className='benchInput'
              value={selectedPreset}
              disabled={props.locked}
              aria-label='Bench preset'
              onChange={(event) => {
                const preset = event.target.value as BenchPreset;
                setSelectedPreset(preset);
                props.onPresetChange?.(preset);
              }}
            >
              {BENCH_PRESET_OPTIONS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <div
          className='benchDirectionPicker'
          role='group'
          aria-label='Add comparison group'
        >
          <Button
            variant='secondary'
            size='sm'
            iconBefore={MessageSquarePlus}
            disabled={props.locked || props.groups.length >= MAX_BENCH_GROUPS}
            title={props.groups.length >= MAX_BENCH_GROUPS
              ? `Up to ${MAX_BENCH_GROUPS} comparison groups.`
              : undefined}
            onClick={props.onAdd}
          >
            + New group
          </Button>
        </div>
      </div>

      <div className='benchGroupGrid'>
        {props.groups.map((group, index) => {
          const groupName = group.name;
          return (
            <article
              className='benchGroupCard'
              data-disabled={!group.enabled}
              key={group.id}
            >
              <div className='benchGroupTop'>
                <span className='benchScenarioIndex'>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <input
                  className='benchInlineInput benchGroupNameInput'
                  value={groupName}
                  aria-label='Comparison group name'
                  readOnly={props.locked}
                  onChange={(event) =>
                    props.onNameChange(group.id, event.target.value)}
                />
                <Button
                  variant='danger'
                  size='sm'
                  iconOnly
                  iconBefore={Trash2}
                  aria-label={`Delete ${groupName}`}
                  title={`Delete ${groupName}`}
                  disabled={props.locked || props.groups.length <= 1}
                  onClick={() => props.onRemove(group.id)}
                />
              </div>
              <div className='benchGroupDetails'>
                <div className='benchGroupFields'>
                  <div className='benchField'>
                    <span className='benchFieldLabel'>Protocol</span>
                    <BenchDropdown
                      ariaLabel={`${groupName} Protocol`}
                      value={group.protocol}
                      disabled={props.locked}
                      options={BENCH_PROTOCOL_OPTIONS}
                      onChange={(protocol) =>
                        props.onProtocolChange(group.id, protocol)}
                    />
                  </div>
                </div>
                <div className='benchGroupFields'>
                  <div className='benchField'>
                    <span className='benchFieldLabel'>Model</span>
                    <BenchDropdown
                      ariaLabel={`${groupName} Model`}
                      value={group.model}
                      disabled={props.locked || props.modelOptions.length === 0}
                      options={props.modelOptions.map((model) => ({
                        value: model.id,
                        label: model.label,
                      }))}
                      onChange={(model) => props.onModelChange(group.id, model)}
                    />
                  </div>
                  {!isDocumentBenchProtocol(group.protocol) && (
                    <div className='benchField'>
                      <span className='benchFieldLabel benchFieldLabelWithHint'>
                        Catalog
                        <span
                          className='benchFieldHintIcon'
                          aria-label='Catalog restriction'
                          data-tooltip='When A2UI and OpenUI are both present, only Core Catalog is available and cannot be changed.'
                          role='img'
                        >
                          i
                        </span>
                      </span>
                      <BenchDropdown
                        ariaLabel={`${groupName} Catalog`}
                        value={group.protocol === 'openui'
                          ? 'Core Catalog'
                          : (hasA2UIAndOpenUI
                              && (group.protocol === 'a2ui'
                                || group.protocol === 'openui')
                            ? 'Core Catalog'
                            : group.catalog)}
                        disabled={props.locked || !usesCatalog(group)
                          || hasA2UIAndOpenUI}
                        options={props.catalogOptions.map((catalog) => ({
                          value: catalog,
                          label: catalog,
                        }))}
                        onChange={(catalog) =>
                          props.onCatalogChange(group.id, catalog)}
                      />
                    </div>
                  )}
                </div>
                {group.protocol === 'lynx-xml' && (
                  <div
                    className='benchField benchXmlFragmentField'
                    title='Convert the initial XML fragment to Element PAPI using the agent tool.'
                  >
                    <span className='benchFieldLabel'>XML fragment</span>
                    <BenchDropdown
                      ariaLabel={`${groupName} XML fragment`}
                      value={group.enableHtmlFragment === true
                        ? 'on'
                        : 'off'}
                      disabled={props.locked}
                      options={[{ value: 'off', label: 'Off' }, {
                        value: 'on',
                        label: 'On',
                      }]}
                      onChange={(value) =>
                        props.onFragmentChange(group.id, value === 'on')}
                    />
                  </div>
                )}
                <label className='benchField benchAdditionalPromptField'>
                  <span className='benchFieldLabel'>
                    Additional prompt instructions
                  </span>
                  <textarea
                    className='benchTextarea'
                    value={group.extraInstruction}
                    placeholder='Prompt appended only to this comparison group'
                    readOnly={props.locked}
                    onChange={(event) =>
                      props.onPromptChange(group.id, event.target.value)}
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
