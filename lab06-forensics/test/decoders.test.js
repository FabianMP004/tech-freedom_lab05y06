import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calldataByteLength,
  extractSelector,
  decodeAbiParameters,
  createEthereumFetcher,
} from '../src/eth.js';
import {
  classifyWitness,
  extractScriptPathLeaf,
  createBitcoinFetcher,
} from '../src/btc.js';
import {
  formatRawData,
  formatInference,
} from '../src/report-format.js';

test('measures calldata bytes and extracts its four-byte selector', () => {
  const calldata = '0xa9059cbb' + '00'.repeat(32) + '00'.repeat(31) + '2a';

  assert.equal(calldataByteLength(calldata), 68);
  assert.equal(extractSelector(calldata), '0xa9059cbb');
});

test('decodes common static and dynamic ABI parameters from calldata', () => {
  const address = '11'.repeat(20);
  const calldata = '0x12345678'
    + '00'.repeat(12) + address
    + (42n).toString(16).padStart(64, '0')
    + (96).toString(16).padStart(64, '0')
    + (5).toString(16).padStart(64, '0')
    + Buffer.from('hello').toString('hex').padEnd(64, '0');

  assert.deepEqual(
    decodeAbiParameters(['address', 'uint256', 'string'], calldata),
    [`0x${address}`, 42n, 'hello'],
  );
});

test('rejects ABI dynamic offsets that are not aligned to words', () => {
  const calldata = '0x12345678'
    + (65).toString(16).padStart(64, '0')
    + '00'.repeat(32);

  assert.throws(
    () => decodeAbiParameters(['bytes'], calldata),
    /aligned/i,
  );
});

test('rejects ABI dynamic offsets and lengths that exceed safe integer bounds', () => {
  const huge = (2n ** 256n - 32n).toString(16).padStart(64, '0');
  const calldata = '0x12345678' + huge + huge;

  assert.throws(
    () => decodeAbiParameters(['bytes'], calldata),
    /safe integer|bounds/i,
  );
});

test('rejects ABI dynamic values that overrun calldata or have non-zero padding', () => {
  const overrun = '0x12345678'
    + (32).toString(16).padStart(64, '0')
    + (33).toString(16).padStart(64, '0')
    + 'aa'.padEnd(64, '0');
  assert.throws(() => decodeAbiParameters(['bytes'], overrun), /bounds|truncated/i);

  const nonZeroPadding = '0x12345678'
    + (32).toString(16).padStart(64, '0')
    + (1).toString(16).padStart(64, '0')
    + 'aa'.padEnd(64, '0').replace(/0$/, '1');
  assert.throws(() => decodeAbiParameters(['bytes'], nonZeroPadding), /padding/i);
});

test('validates ABI address, bool, and bytesN word encodings', () => {
  const malformedAddress = '0x12345678' + '01'.padEnd(64, '0');
  assert.throws(() => decodeAbiParameters(['address'], malformedAddress), /address/i);

  const malformedBool = '0x12345678' + '00'.repeat(31) + '02';
  assert.throws(() => decodeAbiParameters(['bool'], malformedBool), /bool/i);

  const malformedBytes4 = '0x12345678' + '11223344'.padEnd(64, '1');
  assert.throws(() => decodeAbiParameters(['bytes4'], malformedBytes4), /padding/i);
  assert.throws(() => decodeAbiParameters(['bytes0'], '0x12345678' + '00'.repeat(32)), /bytesN|Unsupported/i);
});

test('classifies key-path and script-path Taproot witnesses', () => {
  assert.deepEqual(classifyWitness(['aa'.repeat(64)]), {
    spendType: 'key-path',
    elementCount: 1,
  });
  assert.deepEqual(classifyWitness(['aa', 'bb', 'c1' + 'cc'.repeat(32)]), {
    spendType: 'script-path',
    elementCount: 3,
  });
  assert.deepEqual(classifyWitness(['aa'.repeat(35), '02'.repeat(33)]), {
    spendType: 'unknown',
    elementCount: 2,
  });
  assert.deepEqual(classifyWitness(['aa'.repeat(35), 'bb'.repeat(35), '51'.repeat(34)]), {
    spendType: 'unknown',
    elementCount: 3,
  });
});

test('extracts the leaf script from a script-path witness', () => {
  const leafScript = '5120' + '11'.repeat(32);
  const controlBlock = 'c1' + '22'.repeat(32);
  const witness = ['01', leafScript, controlBlock];

  assert.deepEqual(extractScriptPathLeaf(witness), {
    leafScript: `0x${leafScript}`,
    controlBlock: `0x${controlBlock}`,
    leafVersion: '0xc0',
  });
});

test('rejects Taproot control blocks with paths longer than 128 bytes', () => {
  const witness = ['51', 'c1' + '22'.repeat(32 * 5)];

  assert.throws(() => extractScriptPathLeaf(witness), /path length|control block/i);
});

test('fetchers require a transaction id and expose no signing-material option', async () => {
  const eth = createEthereumFetcher({ request: async (url) => ({ url }) });
  const btc = createBitcoinFetcher({ request: async (url) => ({ url }) });

  await assert.rejects(() => eth.getTransaction(), /transaction id/i);
  await assert.rejects(() => btc.getTransaction(''), /transaction id/i);
  assert.equal(eth.getTransaction.length, 1);
  assert.equal(btc.getTransaction.length, 1);
});

test('formats raw observations and inferences as separate report sections', () => {
  assert.match(formatRawData({ selector: '0x12345678' }), /^## Raw data/m);
  assert.match(formatInference(['A selector identifies a function entry point.']), /^## What can be inferred/m);
});
