const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createSecureStore } = require('../src/secure-store');

async function temporaryDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'lab05-secure-store-'));
}

test('round-trips state without writing plaintext and uses a new nonce per write', async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, 'wallet-state.json');
  const store = createSecureStore(statePath, '11'.repeat(32));
  const state = { version: 1, walletId: 'test-wallet', mnemonic: 'must-not-be-persisted' };

  await store.write(state);
  const firstBytes = await fs.readFile(statePath, 'utf8');
  assert.deepEqual(await store.read(), state);
  assert.doesNotMatch(firstBytes, /must-not-be-persisted|mnemonic/);

  await store.write({ ...state, walletId: 'second-wallet' });
  const secondBytes = await fs.readFile(statePath, 'utf8');
  assert.notEqual(firstBytes, secondBytes);
  assert.deepEqual(await store.read(), { ...state, walletId: 'second-wallet' });
});

test('rejects an incorrect key when reading encrypted state', async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, 'wallet-state.json');
  await createSecureStore(statePath, '22'.repeat(32)).write({ walletId: 'test-wallet' });

  await assert.rejects(
    createSecureStore(statePath, '33'.repeat(32)).read(),
    /unable to decrypt wallet state/i,
  );
});

test('requires exactly 32 bytes for the encryption key', () => {
  assert.throws(() => createSecureStore('/tmp/state.json', 'short'), /32-byte/i);
  assert.throws(() => createSecureStore('/tmp/state.json', 'zz'.repeat(32)), /hex|base64/i);
});
