// import { Stage, StageContainer } from '@dugyu/luna-stage';
// import { LunaLynxStage } from '@dugyu/luna-stage/lynx';
import { VanillaLynxView } from './vanilla.js';
import './index.css';

const demos = [
  'PopoverBasic',
  'PopoverExtraAnchor',
  'PopoverOffsetAdjustment',
  'force_field',
];
export default function Preview() {
  return (
    <div className='demo-stages'>
      {
        /*       {demos.map(demo => (
        <div key={demo} className='demo-stage'>
          <p className='stage-title'>{demo}</p>
          <StageContainer className='stage-container'>
            <Stage>
              <LunaLynxStage
                entry={demo}
                bundleRoot='/'
                lunaTheme='lunaris-dark'
              />
            </Stage>
          </StageContainer>
        </div>
      ))} */
      }
      {
        /*  {
        <StageContainer className='stage-container'>
          <Stage alignX='left' alignY='top'>
            <LunaLynxStage
              entry={'PopoverBasic'}
              bundleRoot='/'
              lunaTheme='lunaris-dark'
            />
          </Stage>
        </StageContainer>
      } */
      }

      {demos.map(demo => {
        return <VanillaLynxView key={demo} entry={demo} bundleRoot='/' />;
      })}
    </div>
  );
}
