import { getProjectRoot } from '../server/config.ts';
import { migrateConversationIaV2 } from '../server/conversationIaMigration.ts';

const result = migrateConversationIaV2(getProjectRoot());
console.log(JSON.stringify(result, null, 2));
