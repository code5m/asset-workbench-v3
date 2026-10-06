import { createStarter } from '../packages/starter/src/index.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const prefixed = process.argv.find((value) => value.startsWith(`${name}=`));
  return prefixed?.slice(name.length + 1);
}

const target = arg('--target') ?? process.argv[2];
if (!target) {
  console.error('Usage: npm run starter:create -- --target <directory> [--name <project-name>]');
  process.exit(2);
}

try {
  const result = createStarter({ target, name: arg('--name') });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
