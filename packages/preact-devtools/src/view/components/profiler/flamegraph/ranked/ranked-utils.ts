import { NodeTransform } from '../shared';
import { CommitData } from '../../data/commits';
import { getGradient } from '../../data/gradient';
import { ID, DevNode } from '../../../../store/types';

const MIN_WIDTH = 4;

/**
 * Convert commit data into an array of position data to operate on.
 */
export function toTransform(commit: CommitData): NodeTransform[] {
  return Array.from(commit.rendered.values())
    .sort((a, b) => commit.selfDurations.get(b)! - commit.selfDurations.get(a)!)
    .map((id, i) => {
      const selfDuration = commit.selfDurations.get(id)!;
      return {
        id,
        width: selfDuration,
        x: 0,
        row: i,
        maximized: false,
        weight: getGradient(commit.maxSelfDuration, selfDuration),
        visible: true,
        commitParent: false,
      };
    });
}

export function placeRanked(
  selfDurations: Map<ID, number>,
  sorted: NodeTransform[],
  selected: DevNode,
  canvasWidth: number,
) {
  const selectedDuration = selfDurations.get(selected.id) || 0.01;
  const scale = (canvasWidth || 1) / selectedDuration;
  let maximized = true;

  return sorted.map(pos => {
    // Ensure nodes are always visible
    const width = maximized
      ? canvasWidth
      : Math.max(Math.max(pos.width, 0.01) * scale, MIN_WIDTH);
    const posMaximized = maximized;

    if (pos.id === selected.id) {
      maximized = false;
    }

    return {
      ...pos,
      width,
      maximized: posMaximized,
    };
  });
}
