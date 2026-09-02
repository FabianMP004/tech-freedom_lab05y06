const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
}

test('provides secret-safe environment placeholders and ignores local state', () => {
  const envExample = readProjectFile('.env.example');
  const gitignore = readProjectFile('.gitignore');

  assert.match(envExample, /^WDK_MNEMONIC=replace-with-runtime-secret$/m);
  assert.match(envExample, /^WDK_STORAGE_KEY=replace-with-32-byte-secret$/m);
  assert.match(envExample, /^WDK_NETWORK=.+$/m);
  assert.match(envExample, /^WDK_RPC_URL=.+$/m);
  assert.match(envExample, /^WDK_LIGHTNING_PACKAGE=@tetherto\/wdk-wallet-spark$/m);
  assert.doesNotMatch(envExample, /\b(?:abandon|legal|winner|thank|year|wave)\b/i);

  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /(?:^|\/)runtime(?:\/|$)/m);
  assert.match(gitignore, /(?:^|\/)logs?(?:\/|$)/m);
});
