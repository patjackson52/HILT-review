#!/usr/bin/env npx tsx

import { apiKeyService } from '../src/services/api-key.service.js';

const sourceId = process.argv[2];

if (!sourceId) {
  console.error('Usage: npx tsx scripts/create-api-key.ts <source-id>');
  process.exit(1);
}

async function main() {
  const result = await apiKeyService.generate({
    sourceId,
    keyType: 'source',
    environment: 'test',
    name: 'Test Key',
  });

  console.log('\n=== API Key Created ===');
  console.log('Key (save this - it will not be shown again):');
  console.log(result.key);
  console.log('\nKey ID:', result.record.id);
  console.log('Source ID:', result.record.sourceId);
  console.log('========================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
