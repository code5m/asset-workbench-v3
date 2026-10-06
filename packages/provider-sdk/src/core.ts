import type { ProviderDefinition } from '../../protocol/src/provider.ts';

export interface ProviderSdkValidationOptions {
  allowExecutableCommands?: boolean;
}

export interface ProviderAdapter<Input = unknown, Output = unknown> {
  definition: ProviderDefinition;
  normalize(input: Input): Output[];
}

export function validateProviderDefinition(
  input: ProviderDefinition,
  options: ProviderSdkValidationOptions = {},
): ProviderDefinition {
  if (input.schemaVersion !== 1) throw new Error('provider schemaVersion must be 1');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(input.id)) {
    throw new Error('provider id must use lowercase letters, numbers, and hyphens');
  }
  if (!input.version || !input.displayName || !input.providerType) {
    throw new Error('provider identity is incomplete');
  }
  if (!input.eventSource?.type || !input.finalization?.strategy || !input.auth?.type) {
    throw new Error('provider definition is incomplete');
  }
  if (!options.allowExecutableCommands) {
    if (
      input.auth.verifyCommand?.length ||
      input.discovery.versionCommand?.length ||
      input.installation?.command?.length
    ) {
      throw new Error('provider definition cannot contain executable commands');
    }
  }
  return input;
}

export function defineProvider<T extends ProviderDefinition>(
  definition: T,
  options: ProviderSdkValidationOptions = { allowExecutableCommands: true },
): T {
  validateProviderDefinition(definition, options);
  return Object.freeze(definition);
}

export function defineProviderAdapter<Input, Output>(
  adapter: ProviderAdapter<Input, Output>,
): ProviderAdapter<Input, Output> {
  validateProviderDefinition(adapter.definition, { allowExecutableCommands: true });
  return Object.freeze(adapter);
}
