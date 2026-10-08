import { createKnowledge, verifyKnowledge } from '../packages/starter/src/index.ts';
import {
  applyInstanceUpgrade,
  createInstance,
  frameworkIdentity,
  instanceStatus,
  planInstanceUpgrade,
  rollbackInstance,
  runInstanceLifecycleSelfTest,
  verifyInstance,
} from '../packages/creator-core/src/index.ts';
import { loadConfig } from '../server/config.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const prefixed = process.argv.find((value) => value.startsWith(`${name}=`));
  return prefixed?.slice(name.length + 1);
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function usage(): never {
  console.error([
    'Creator CLI',
    '',
    'Knowledge:',
    '  npm run creator -- knowledge create --target <directory> [--name <project-name>]',
    '  npm run creator -- knowledge verify --target <directory>',
    '',
    'Instance lifecycle:',
    '  npm run creator -- instance create --project <directory> [--name <project-name>] [--init-knowledge]',
    '  npm run creator -- instance status --project <directory>',
    '  npm run creator -- instance verify --project <directory>',
    '  npm run creator -- instance upgrade-plan --project <directory>',
    '  npm run creator -- instance upgrade-apply --project <directory> --plan <plan-id>',
    '  npm run creator -- instance rollback --project <directory> [--migration <migration-id>]',
    '  npm run creator -- instance self-test',
    '',
    'Advanced test/automation override:',
    '  --framework-version <version> --framework-revision <revision>',
  ].join('\n'));
  process.exit(2);
}

function currentFramework() {
  const cfg = loadConfig();
  return frameworkIdentity(
    arg('--framework-version') ?? cfg.frameworkVersion,
    arg('--framework-revision') ?? cfg.frameworkRevision,
  );
}

const [subject, action] = process.argv.slice(2, 4);

try {
  if (subject === 'knowledge') {
    if (!['create', 'verify'].includes(action ?? '')) usage();
    const target = arg('--target');
    if (!target) usage();
    const result = action === 'create'
      ? createKnowledge({ target, name: arg('--name') })
      : verifyKnowledge(target);
    console.log(JSON.stringify({ command: `creator knowledge ${action}`, ...result }, null, 2));
    if ('ok' in result && !result.ok) process.exitCode = 1;
  } else if (subject === 'instance') {
    const framework = currentFramework();
    let result: unknown;

    if (action === 'self-test') {
      result = runInstanceLifecycleSelfTest({
        framework,
        frameworkRoot: loadConfig().appRoot,
      });
    } else {
      const projectRoot = arg('--project');
      if (!projectRoot) usage();

      if (action === 'create') {
      result = createInstance({
        projectRoot,
        name: arg('--name'),
        initializeKnowledge: flag('--init-knowledge'),
        framework,
        frameworkRoot: loadConfig().appRoot,
      });
    } else if (action === 'status') {
      result = instanceStatus(projectRoot, framework);
    } else if (action === 'verify') {
      result = verifyInstance(projectRoot, framework);
    } else if (action === 'upgrade-plan') {
      result = planInstanceUpgrade(projectRoot, framework);
    } else if (action === 'upgrade-apply') {
      const planId = arg('--plan');
      if (!planId) usage();
      result = applyInstanceUpgrade(projectRoot, planId);
    } else if (action === 'rollback') {
      result = rollbackInstance(projectRoot, arg('--migration'));
      } else {
        usage();
      }
    }

    console.log(JSON.stringify({ command: `creator instance ${action}`, ...(result as object) }, null, 2));
    if (action === 'verify' && result && typeof result === 'object' && 'ok' in result && !(result as { ok: boolean }).ok) {
      process.exitCode = 1;
    }
  } else {
    usage();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
