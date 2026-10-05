import { credentialStore } from '../server/credentialStore.ts';

const [providerId, field] = process.argv.slice(2);
if (!providerId || !field) process.exit(1);
process.stdout.write(credentialStore.has(providerId, field) ? 'configured\n' : 'missing\n');
