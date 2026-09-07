// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BenchScenario } from './benchData.js';
import { Button } from '../../components/Button.js';
import { MessageSquarePlus, Trash2 } from '../../components/Icon.js';

export function BenchScenarioSection(props: {
  locked: boolean;
  onAdd: () => void;
  onNameChange: (id: string, name: string) => void;
  onPromptChange: (id: string, prompt: string) => void;
  onRemove: (id: string) => void;
  scenarios: readonly BenchScenario[];
}) {
  return (
    <section
      className='benchPlanSection benchSetupSection'
      data-read-only={props.locked || undefined}
    >
      <div className='benchSectionHeader benchSetupHeader'>
        <div className='benchSetupHeading'>
          <span className='benchStepNumber'>1</span>
          <div>
            <h3 className='benchSectionTitle'>Choose scenarios</h3>
            <p className='benchSectionSub'>
              Three scenarios are included by default. Edit their prompts or
              append your own.
            </p>
          </div>
        </div>
        <Button
          variant='secondary'
          size='sm'
          iconBefore={MessageSquarePlus}
          disabled={props.locked}
          onClick={props.onAdd}
        >
          Add custom scenario
        </Button>
      </div>
      <div className='benchScenarioSelectionGrid'>
        {props.scenarios.map((scenario, index) => {
          const scenarioName = scenario.name;
          return (
            <article className='benchScenarioChoice' key={scenario.id}>
              <div className='benchScenarioTop'>
                <span className='benchScenarioIndex'>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <input
                  className='benchInlineInput benchScenarioName'
                  value={scenarioName}
                  aria-label='Scenario name'
                  readOnly={props.locked}
                  onChange={(event) =>
                    props.onNameChange(scenario.id, event.target.value)}
                />
                <Button
                  variant='danger'
                  size='sm'
                  iconOnly
                  iconBefore={Trash2}
                  aria-label={`Remove ${scenarioName}`}
                  title='Remove scenario'
                  disabled={props.locked || props.scenarios.length <= 1}
                  onClick={() => props.onRemove(scenario.id)}
                />
              </div>
              <textarea
                className='benchTextarea benchScenarioPrompt'
                value={scenario.prompt}
                aria-label={`${scenarioName} prompt`}
                readOnly={props.locked}
                onChange={(event) =>
                  props.onPromptChange(scenario.id, event.target.value)}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
