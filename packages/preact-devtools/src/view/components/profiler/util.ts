const formatter = Intl.NumberFormat();

const decimals = 1;

export function formatTime(time: number) {
  if (time < 0.1) return '<0.1ms';

  if (time > 100) {
    const display = formatter.format(Number((time / 1000).toFixed(decimals)));
    return `${display}s`;
  }

  return `${time.toFixed(decimals)}ms`;
}
