import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const subcommand = process.argv[2];
if (subcommand !== 'dev' && subcommand !== 'preview') {
  process.stderr.write(`Usage: node scripts/serve.mjs <dev|preview>\n`);
  process.exitCode = 1;
  throw new Error(`unknown subcommand: ${subcommand ?? '(none)'}`);
}

const rspeedy = process.platform === 'win32' ? 'rspeedy.cmd' : 'rspeedy';

const producer = spawn(
  rspeedy,
  [subcommand, '--config', 'lynx.config.producer.js'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

const prefix = (stream, label) => {
  const rl = createInterface({ input: stream });
  rl.on('line', (line) => {
    process.stdout.write(`[${label}] ${line}\n`);
  });
};
prefix(producer.stdout, 'producer');
prefix(producer.stderr, 'producer');

const consumer = spawn(
  rspeedy,
  [subcommand, '--config', 'lynx.config.consumer.js'],
  { stdio: 'inherit' },
);

const shutdown = (code) => {
  if (typeof code === 'number') process.exitCode = code;
  if (!producer.killed) producer.kill('SIGTERM');
  if (!consumer.killed) consumer.kill('SIGTERM');
};

consumer.on('exit', (code) => shutdown(code ?? 0));
// Tear the consumer down on ANY producer exit (including a clean one):
// the consumer's /producer lazy-bundle traffic depends on the producer, so
// leaving it up would only serve guaranteed-to-fail requests.
producer.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
