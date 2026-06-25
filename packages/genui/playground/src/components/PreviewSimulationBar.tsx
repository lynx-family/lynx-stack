// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

export interface PreviewSimulationBarProps {
  speed: number;
  speedInputId: string;
  onSpeedChange: (speed: number) => void;
  speedLabel?: ReactNode;
  label?: ReactNode;
  infoTooltip?: ReactNode;
  infoAriaLabel?: string;
  infoTooltipOpen?: boolean;
  onToggleInfoTooltip?: () => void;
}

export function PreviewSimulationBar(props: PreviewSimulationBarProps) {
  const {
    infoAriaLabel = 'Simulation info',
    infoTooltip,
    infoTooltipOpen = false,
    label = 'Simulated',
    onSpeedChange,
    onToggleInfoTooltip,
    speed,
    speedInputId,
    speedLabel = 'Speed',
  } = props;

  return (
    <div className='simulationBar'>
      <div className='simInfo'>
        {onToggleInfoTooltip
          ? (
            <button
              type='button'
              className='simInfoToggle'
              onClick={onToggleInfoTooltip}
              aria-label={infoAriaLabel}
            >
              <span className='simInfoIcon'>i</span>
              <span className='simInfoLabel'>{label}</span>
            </button>
          )
          : (
            <>
              <span className='simInfoIcon'>i</span>
              <span className='simInfoLabel'>{label}</span>
            </>
          )}
        {infoTooltip && infoTooltipOpen
          ? <div className='simTooltip'>{infoTooltip}</div>
          : null}
      </div>
      <div className='simSpeed'>
        <label className='simSpeedLabel' htmlFor={speedInputId}>
          {speedLabel}
        </label>
        <input
          id={speedInputId}
          className='simSpeedSlider'
          type='range'
          min='0.25'
          max='4'
          step='0.25'
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
        <span className='simSpeedValue'>{speed}x</span>
      </div>
    </div>
  );
}
