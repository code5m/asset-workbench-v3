/**
 * Asset Workbench official OpenCode capture plugin.
 *
 * OpenCode loads plugins from `.opencode/plugins/`. This plugin is strictly
 * observation / forwarding only: it appends each real provider event to an inbox
 * file and never alters OpenCode behaviour. Any capture problem is swallowed so
 * capture can never block the Agent's answer (fail-open).
 *
 * The inbox is later drained by server/providerAdapterService.ts
 * (importOpencodeEventStream) into the shared Capture Kernel.
 */
import fs from 'node:fs';
import path from 'node:path';

function inboxPath(directory) {
  if (process.env.AWB_OPENCODE_INBOX) return process.env.AWB_OPENCODE_INBOX;
  return path.join(directory || process.cwd(), '.asset-workbench-data', 'provider-adapters', 'opencode', 'inbox.jsonl');
}

export const AssetWorkbenchCapture = async (ctx) => {
  const directory = ctx?.directory || process.cwd();
  const target = inboxPath(directory);
  let ready = false;
  const write = (line) => {
    try {
      if (!ready) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        ready = true;
      }
      fs.appendFileSync(target, `${line}\n`, 'utf8');
    } catch {
      // fail-open: never block the provider
    }
  };

  return {
    // OpenCode delivers every real event here: { type, properties }
    event: async (input) => {
      const event = input?.event ?? input;
      if (!event || typeof event !== 'object') return;
      write(JSON.stringify({ receivedAt: new Date().toISOString(), ...event }));
    },
    // Tool lifecycle hooks keep tool evidence independent of text streaming.
    'tool.execute.before': async (input) => {
      write(JSON.stringify({ receivedAt: new Date().toISOString(), type: 'tool.execute.before', properties: input ?? {} }));
    },
    'tool.execute.after': async (input, output) => {
      write(JSON.stringify({ receivedAt: new Date().toISOString(), type: 'tool.execute.after', properties: input ?? {}, output: output ?? null }));
    },
  };
};

export default AssetWorkbenchCapture;
