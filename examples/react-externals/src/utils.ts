export function formatTapCount(count: number): string {
  if (count === 0) {
    return 'Tap the logo and have fun!';
  }
  return `Tapped ${count} ${count === 1 ? 'time' : 'times'}`;
}
