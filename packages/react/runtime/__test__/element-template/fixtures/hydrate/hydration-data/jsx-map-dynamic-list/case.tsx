import { runCaseByName } from '../_shared.js';

export function run({ fixtureDir }: { fixtureDir: string }) {
  return runCaseByName('jsx-map-dynamic-list', fixtureDir);
}
