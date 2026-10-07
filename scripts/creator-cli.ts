import { createKnowledge, verifyKnowledge } from '../packages/starter/src/index.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const prefixed = process.argv.find((value) => value.startsWith(`${name}=`));
  return prefixed?.slice(name.length + 1);
}

function usage(): never {
  console.error([
    'Creator CLI',
    '',
    'Create project knowledge:',
    '  npm run creator -- knowledge create --target <directory> [--name <project-name>]',
    '',
    'Verify project knowledge:',
    '  npm run creator -- knowledge verify --target <directory>',
    '',
    'Future public command shape:',
    '  asset-workbench creator knowledge <create|verify> ...',
  ].join('\n'));
  process.exit(2);
}

const [subject, action] = process.argv.slice(2, 4);
if (subject !== 'knowledge' || !['create', 'verify'].includes(action ?? '')) usage();

const target = arg('--target');
if (!target) usage();

try {
  const result = action === 'create'
    ? createKnowledge({ target, name: arg('--name') })
    : verifyKnowledge(target);

  console.log(JSON.stringify({
    command: `creator knowledge ${action}`,
    ...result,
  }, null, 2));

  if ('ok' in result && !result.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
