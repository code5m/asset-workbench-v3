# Contributing to Asset Workbench V3

Thank you for contributing.

## Development

- Node.js 22+
- `npm ci`
- `npm run check` before opening a pull request
- Keep filesystem access behind the Local Asset Runtime; React must not import Node filesystem APIs.
- Keep Provider adapters behind the provider-neutral Capture Kernel.
- Do not fabricate Transcript evidence or E2E verification.

## Internationalization

User-facing UI strings belong in `src/i18n/translations.ts`. Do not add new hard-coded
Chinese or English labels in components. The current product ships complete `zh-CN`
and `en` UI dictionaries; new locales can be added through the same locale registry.

## Language ecosystems

The asset browser is language-neutral. Java, JavaScript/TypeScript, Python, and Rust
are first-class tested ecosystems. Add support through classification/ignore policies
and tests rather than language-specific branches in the core asset engine.

## Performance

Directory browsing is intentionally lazy. Never reintroduce a recursive whole-project
tree in memory or serialize recursive `children` from the tree API.

## Security

Never add arbitrary executable commands to custom Provider definitions. Credentials
must stay in the operating-system secure store.

## License

The repository is being prepared for broader open-source contribution. A project
license must be selected by the project owner before representing a public release as
licensed open source.
