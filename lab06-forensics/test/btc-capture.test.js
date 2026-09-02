import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureBitcoinEvidence,
  renderBitcoinCaptureMarkdown,
} from '../scripts/capture-btc.mjs';
import {
  calculateVbytes,
  classifyWitness,
  classifyBitcoinTransaction,
  extractScriptPathLeaf,
  isTaprootInput,
} from '../src/btc.js';

const TXID = '11'.repeat(32);
const VERIFICATION_TXID = '22'.repeat(32);
const TAPROOT_SCRIPT = '5120' + 'aa'.repeat(32);
const CONTROL_BLOCK = 'c1' + 'bb'.repeat(32);

const keyPathTransaction = Object.freeze({
  txid: TXID,
  version: 2,
  locktime: 0,
  size: 180,
  weight: 705,
  fee: 500,
  vin: [{
    txid: '33'.repeat(32),
    vout: 0,
    prevout: { scriptpubkey: TAPROOT_SCRIPT, scriptpubkey_type: 'v1_p2tr', value: 100000 },
    scriptsig: '',
    witness: ['cc'.repeat(64)],
    sequence: 4294967295,
  }],
  vout: [{ value: 99000, scriptpubkey: TAPROOT_SCRIPT, scriptpubkey_type: 'v1_p2tr' }],
  status: { confirmed: true, block_height: 900000, block_hash: '44'.repeat(32) },
});

const scriptPathTransaction = Object.freeze({
  txid: VERIFICATION_TXID,
  version: 2,
  locktime: 0,
  size: 220,
  weight: 861,
  fee: 700,
  vin: [{
    txid: '55'.repeat(32),
    vout: 1,
    prevout: { scriptpubkey: TAPROOT_SCRIPT, scriptpubkey_type: 'v1_p2tr', value: 120000 },
    scriptsig: '',
    witness: ['01', 'a8' + '00'.repeat(32) + 'b175', CONTROL_BLOCK],
    sequence: 4294967295,
  }],
  vout: [{ value: 119300, scriptpubkey: TAPROOT_SCRIPT, scriptpubkey_type: 'v1_p2tr' }],
  status: { confirmed: true, block_height: 900001, block_hash: '66'.repeat(32) },
});

function fixtureRequest(url) {
  const match = url.match(/\/api\/tx\/([0-9a-f]+)(\/hex)?$/);
  assert.ok(match, `unexpected URL ${url}`);
  const transaction = match[1] === TXID ? keyPathTransaction : scriptPathTransaction;
  return match[2] ? `02000000${'00'.repeat(20)}00000000` : transaction;
}

test('detects Taproot inputs and classifies one-element witnesses as key path', () => {
  assert.equal(isTaprootInput(keyPathTransaction.vin[0]), true);
  assert.deepEqual(classifyWitness(keyPathTransaction.vin[0].witness), {
    spendType: 'key-path',
    elementCount: 1,
  });
});

test('parses script-path control blocks and calculates vbytes from weight', () => {
  const input = scriptPathTransaction.vin[0];
  assert.equal(isTaprootInput(input), true);
  assert.deepEqual(extractScriptPathLeaf(input.witness), {
    leafScript: `0x${input.witness.at(-2)}`,
    controlBlock: `0x${CONTROL_BLOCK}`,
    leafVersion: '0xc0',
  });
  assert.equal(calculateVbytes(scriptPathTransaction), 216);
});

test('marks key-path evidence as unable to prove HTLC-like hidden conditions', () => {
  assert.deepEqual(classifyBitcoinTransaction(keyPathTransaction).htlcLike, {
    status: 'unknown',
    reason: 'key-path witness does not reveal the Taproot script tree or spending conditions',
  });
});

test('captures two public transactions and preserves raw transaction, input, vout, and hex data', async () => {
  const capture = await captureBitcoinEvidence({
    baseUrl: 'https://mempool.example',
    transactionId: TXID,
    verificationTransactionId: VERIFICATION_TXID,
    request: fixtureRequest,
  });

  assert.deepEqual(capture.transactionIds, [TXID, VERIFICATION_TXID]);
  assert.equal(capture.transactions[0].raw.txid, TXID);
  assert.equal(capture.transactions[0].inputs[0].witness[0], keyPathTransaction.vin[0].witness[0]);
  assert.equal(capture.transactions[0].outputs[0].scriptpubkey, TAPROOT_SCRIPT);
  assert.equal(capture.transactions[0].rawHex.startsWith('02000000'), true);
  assert.equal(capture.transactions[0].observations.vbytes, 177);
  assert.equal(capture.transactions[0].observations.htlcLike.status, 'unknown');
  assert.equal(capture.transactions[1].observations.htlcLike.status, 'refused');
});

test('requires a distinct second transaction before report rendering', async () => {
  await assert.rejects(
    () => captureBitcoinEvidence({ transactionId: TXID, request: fixtureRequest }),
    /verification transaction id/i,
  );
  await assert.rejects(
    () => captureBitcoinEvidence({ transactionId: TXID, verificationTransactionId: TXID, request: fixtureRequest }),
    /distinct|different/i,
  );
});

test('refuses Boltz attribution and states the non-HTLC evidence boundary', async () => {
  const capture = await captureBitcoinEvidence({
    baseUrl: 'https://mempool.example',
    transactionId: TXID,
    verificationTransactionId: VERIFICATION_TXID,
    request: fixtureRequest,
  });
  const markdown = renderBitcoinCaptureMarkdown(capture);
  assert.match(markdown, /Raw data/);
  assert.match(markdown, /Boltz attribution is refused/i);
  assert.match(markdown, /HTLC-like status: unknown|refused/i);
  assert.doesNotMatch(markdown, /private key|seed phrase|mnemonic|password|secret/i);
});
