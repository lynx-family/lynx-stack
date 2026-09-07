// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface BenchRunPanelSettings {
  collectLiveRenderMetrics: boolean;
  judgeEnabled: boolean;
  parallelism: number;
  repairEnabled: boolean;
  repeats: number;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function BenchRunPanel(props: {
  locked: boolean;
  onSettingsChange: (patch: Partial<BenchRunPanelSettings>) => void;
  onUiJudgeServerUrlChange: (value: string) => void;
  settings: BenchRunPanelSettings;
  uiJudgeServerUrl: string;
  uiJudgeServerUrlValidationError?: string;
}) {
  return (
    <section className='benchPlanSection benchRunSection'>
      <div className='benchRunPanel'>
        <div
          className='benchInlineRunConfig'
          id='bench-inline-run-config'
          data-read-only={props.locked || undefined}
        >
          <div className='benchInlineConfigHeader'>
            <div className='benchSetupHeading'>
              <span className='benchStepNumber'>3</span>
              <div>
                <h3 className='benchSectionTitle'>Configure and run</h3>
                <p className='benchSectionSub'>
                  Adjust judge and execution settings, then start Bench.
                </p>
              </div>
            </div>
          </div>

          <div className='benchInlineConfigGrid'>
            <section className='benchInlineConfigGroup'>
              <h4>UI Judge</h4>
              <label className='benchField'>
                <span className='benchFieldLabel'>UI_JUDGE_SERVER_URL</span>
                <input
                  className='benchInput'
                  type='url'
                  value={props.uiJudgeServerUrl}
                  placeholder='http://127.0.0.1:8080'
                  readOnly={props.locked}
                  aria-invalid={props.uiJudgeServerUrlValidationError
                    ? 'true'
                    : undefined}
                  onChange={(event) =>
                    props.onUiJudgeServerUrlChange(event.target.value)}
                />
              </label>
              <p className='benchFieldHint'>
                Leave empty for the server setting. Valid URLs are saved in this
                browser.
              </p>
              {props.uiJudgeServerUrlValidationError
                ? (
                  <p className='benchFieldError' role='alert'>
                    {props.uiJudgeServerUrlValidationError}
                  </p>
                )
                : null}
            </section>

            <section className='benchInlineConfigGroup'>
              <h4>Run parameters</h4>
              <div className='benchRunnerGrid'>
                <label className='benchField'>
                  <span className='benchFieldLabel'>Repeats</span>
                  <input
                    className='benchInput'
                    type='number'
                    min={1}
                    max={10}
                    value={props.settings.repeats}
                    readOnly={props.locked}
                    onChange={(event) =>
                      props.onSettingsChange({
                        repeats: clampNumber(
                          Number(event.target.value),
                          1,
                          10,
                        ),
                      })}
                  />
                </label>
                <label className='benchField'>
                  <span className='benchFieldLabel'>Concurrency</span>
                  <input
                    className='benchInput'
                    type='number'
                    min={1}
                    max={8}
                    value={props.settings.parallelism}
                    readOnly={props.locked}
                    onChange={(event) =>
                      props.onSettingsChange({
                        parallelism: clampNumber(
                          Number(event.target.value),
                          1,
                          8,
                        ),
                      })}
                  />
                </label>
              </div>
              <div className='benchInlineToggles'>
                <label className='benchToggle'>
                  <input
                    type='checkbox'
                    checked={props.settings.repairEnabled}
                    disabled={props.locked}
                    onChange={(event) =>
                      props.onSettingsChange({
                        repairEnabled: event.target.checked,
                      })}
                  />
                  <span>Repair attempts</span>
                </label>
                <label className='benchToggle'>
                  <input
                    type='checkbox'
                    checked={props.settings.judgeEnabled}
                    disabled={props.locked}
                    onChange={(event) =>
                      props.onSettingsChange({
                        judgeEnabled: event.target.checked,
                      })}
                  />
                  <span>UI Judge</span>
                </label>
                <label className='benchToggle'>
                  <input
                    type='checkbox'
                    checked={props.settings.collectLiveRenderMetrics}
                    disabled={props.locked}
                    onChange={(event) =>
                      props.onSettingsChange({
                        collectLiveRenderMetrics: event.target.checked,
                      })}
                  />
                  <span>Render metrics</span>
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
