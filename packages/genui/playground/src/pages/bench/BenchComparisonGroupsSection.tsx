// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  findComparableBaseline,
  getBenchGroupDifferences,
  usesCatalog,
} from './benchData.js';
import type {
  BenchComparisonDirection,
  BenchGroup,
  BenchProfile,
  BenchProtocol,
  BenchRole,
} from './benchData.js';
import { BenchDropdown } from './BenchDropdown.js';
import { Button } from '../../components/Button.js';
import { Trash2 } from '../../components/Icon.js';

export interface BenchModelOption {
  id: string;
  label: string;
}

function directionLabel(direction: BenchComparisonDirection): string {
  switch (direction) {
    case 'model':
      return 'Model';
    case 'prompt':
      return 'Prompt';
    case 'protocol':
      return 'Protocol';
  }
}

export function BenchComparisonGroupsSection(props: {
  catalogOptions: readonly string[];
  groups: readonly BenchGroup[];
  locked: boolean;
  modelOptions: readonly BenchModelOption[];
  onAdd: (direction: BenchComparisonDirection) => void;
  onCatalogChange: (id: string, catalog: string) => void;
  onEnabledChange: (id: string, enabled: boolean) => void;
  onModelChange: (id: string, model: string) => void;
  onNameChange: (id: string, name: string) => void;
  onProfileChange: (id: string, profile: BenchProfile) => void;
  onPromptChange: (id: string, prompt: string) => void;
  onProtocolChange: (id: string, protocol: BenchProtocol) => void;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: BenchRole) => void;
}) {
  const activeGroups = props.groups.filter((group) => group.enabled);
  const configuredControlGroupCount =
    props.groups.filter((group) => group.role === 'control').length;

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
              Choose a direction, then configure each group's model
              independently.
            </p>
          </div>
        </div>
        <div
          className='benchDirectionPicker'
          role='group'
          aria-label='New comparison group direction'
        >
          {(['protocol', 'model', 'prompt'] as const).map((direction) => (
            <button
              type='button'
              disabled={props.locked}
              key={direction}
              onClick={() => props.onAdd(direction)}
            >
              <strong>{directionLabel(direction)}</strong>
              <span>+ New group</span>
            </button>
          ))}
        </div>
      </div>

      <div className='benchGroupGrid'>
        {props.groups.map((group) => {
          const groupName = group.name;
          const baseline = findComparableBaseline(group, activeGroups);
          const differences = getBenchGroupDifferences(group, baseline);
          return (
            <article
              className='benchGroupCard'
              data-disabled={!group.enabled}
              key={group.id}
            >
              <div className='benchGroupTop'>
                <label className='benchSwitch'>
                  <input
                    type='checkbox'
                    checked={group.enabled}
                    aria-label={`Enable ${groupName}`}
                    disabled={props.locked}
                    onChange={(event) =>
                      props.onEnabledChange(group.id, event.target.checked)}
                  />
                  <span />
                </label>
                <div className='benchRoleControl'>
                  {(['control', 'experiment'] as const).map((role) => (
                    <button
                      type='button'
                      className={group.role === role
                        ? 'benchRoleButton active'
                        : 'benchRoleButton'}
                      aria-pressed={group.role === role}
                      disabled={props.locked
                        || (role === 'experiment'
                          && group.role === 'control'
                          && configuredControlGroupCount === 1)}
                      key={role}
                      onClick={() => props.onRoleChange(group.id, role)}
                    >
                      {role === 'control' ? 'Baseline' : 'Comparison'}
                    </button>
                  ))}
                </div>
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
              <input
                className='benchGroupName'
                value={groupName}
                aria-label='Comparison group name'
                readOnly={props.locked}
                onChange={(event) =>
                  props.onNameChange(group.id, event.target.value)}
              />
              <div className='benchGroupSummary'>
                <span data-protocol={group.protocol}>
                  {group.protocol === 'a2ui' ? 'A2UI' : 'OpenUI'}
                </span>
                <span>{group.profile}</span>
                <span>{group.model || 'Model required'}</span>
                {differences.length === 0
                  ? <span data-baseline='true'>Baseline</span>
                  : differences.map((difference) => (
                    <span data-changed='true' key={difference}>
                      {`${difference} changed`}
                    </span>
                  ))}
                {group.role === 'experiment' && baseline
                  ? (
                    <span data-baseline='true'>
                      {`vs. ${baseline.name}`}
                    </span>
                  )
                  : null}
              </div>
              <details className='benchGroupDetails'>
                <summary>Configure</summary>
                <div className='benchGroupFields'>
                  <div className='benchField'>
                    <span className='benchFieldLabel'>Protocol</span>
                    <BenchDropdown
                      ariaLabel={`${groupName} Protocol`}
                      value={group.protocol}
                      disabled={props.locked}
                      options={[
                        {
                          value: 'a2ui',
                          label: 'A2UI',
                          description: 'Structured message stream',
                        },
                        {
                          value: 'openui',
                          label: 'OpenUI',
                          description: 'OpenUI Lang',
                        },
                      ]}
                      onChange={(protocol) =>
                        props.onProtocolChange(group.id, protocol)}
                    />
                  </div>
                  <div className='benchField'>
                    <span className='benchFieldLabel'>Profile</span>
                    <BenchDropdown
                      ariaLabel={`${groupName} Profile`}
                      value={group.profile}
                      disabled={props.locked || group.protocol === 'openui'}
                      options={[
                        {
                          value: 'native',
                          label: 'native',
                          description: 'Use the full protocol capability set',
                        },
                        {
                          value: 'matched-core',
                          label: 'matched-core',
                          description: 'Use only the shared capability subset',
                        },
                      ]}
                      onChange={(profile) =>
                        props.onProfileChange(group.id, profile)}
                    />
                  </div>
                </div>
                {group.profile === 'matched-core'
                  ? (
                    <p className='benchProfileHint'>
                      <strong>matched-core</strong>{' '}
                      uses only capabilities shared by A2UI and OpenUI, making
                      it suitable for a like-for-like Protocol comparison.
                    </p>
                  )
                  : null}
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
                  <div className='benchField'>
                    <span className='benchFieldLabel'>Catalog</span>
                    <BenchDropdown
                      ariaLabel={`${groupName} Catalog`}
                      value={group.catalog}
                      disabled={props.locked || !usesCatalog(group)}
                      options={props.catalogOptions.map((catalog) => ({
                        value: catalog,
                        label: catalog,
                      }))}
                      onChange={(catalog) =>
                        props.onCatalogChange(group.id, catalog)}
                    />
                    {usesCatalog(group)
                      ? null
                      : (
                        <p className='benchFieldHint'>
                          Catalog can be changed only for A2UI native. OpenUI
                          and matched-core use the fixed shared catalog.
                        </p>
                      )}
                  </div>
                </div>
                <label className='benchField'>
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
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
