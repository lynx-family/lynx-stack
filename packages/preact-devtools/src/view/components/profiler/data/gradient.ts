export function getGradient(max: number, n: number) {
  const maxColor = 9; // Amount of colors, see css variables
  let i = 0;
  if (!isNaN(n)) {
    if (!isFinite(n)) {
      i = max;
    } else {
      const slope = (1 * (maxColor - 0)) / max - 0;
      i = 0 + Math.round(slope * (n - 0));
    }
  }

  // i can be NaN at this point
  if (isNaN(i)) return 0;
  return Math.max(i, 0);
}
