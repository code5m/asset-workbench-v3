import { defineProvider } from '../../packages/provider-sdk/src/index.ts';

/**
 * Reference Provider Definition.
 *
 * This is intentionally declarative: no arbitrary shell command is embedded.
 * A real adapter can be written in Node, Python, Rust, Java, Go, or another
 * language as long as it emits the canonical Capture API contract.
 */
export const exampleHooksProvider = defineProvider({
  schemaVersion: 1,
  version: '1.0.0',
  id: 'example-hooks',
  displayName: 'Example Hooks Provider',
  description: 'Reference lifecycle-hook Provider for third-party integrations.',
  providerType: 'coding-agent',
  discovery: {
    configPaths: ['.example-agent/hooks.json'],
  },
  auth: {
    type: 'external',
  },
  eventSource: {
    type: 'hooks',
    projectConfigPath: '.example-agent/hooks.json',
  },
  events: {
    SessionStart: { canonical: 'session.started' },
    UserPromptSubmit: { canonical: 'user.message', contentPath: 'prompt' },
    PostToolUse: { canonical: 'tool.completed' },
    Stop: { canonical: 'assistant.message', contentPath: 'last_assistant_message' },
    SessionEnd: { canonical: 'session.ended' },
  },
  finalization: {
    strategy: 'explicit-event',
    event: 'SessionEnd',
  },
  verification: {
    required: ['user.message', 'assistant.message'],
    optional: ['tool.completed'],
    requireTranscript: true,
  },
}, { allowExecutableCommands: false });
