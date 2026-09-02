import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport } from '../scripts/build-report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
function reportText() {
  return buildReport();
}

test('report includes ETH selectors, decoded parameters, calldata size, and all functions', () => {
  const report = reportText();
  for (const value of [
    '0x0899146b', '0xc3c37fbc', '0x35cd4ccb',
    'lock(bytes32,address,uint256)',
    'claim(bytes32,uint256,address,uint256)',
    'refund(bytes32,uint256,address,uint256)',
    'preimageHash', 'claimAddress', 'refundAddress', 'timelock',
    'calldata byte length',
  ]) assert.match(report, new RegExp(value.replace(/[()]/g, '\\$&'), 'i'));
});

test('report includes BTC spend type, leaf, vbytes, and hidden-tree caveat', () => {
  const report = reportText();
  for (const value of ['key-path', 'script-path', 'leaf script', 'control block', 'leaf version', 'vbytes', 'hidden Taproot script tree']) {
    assert.match(report, new RegExp(value, 'i'));
  }
  assert.match(report, /not sufficient to attribute|does not establish.*Boltz/i);
});

test('report identifies a second verification transaction for each chain', () => {
  const report = reportText();
  assert.match(report, /Ethereum[\s\S]*verification[\s\S]*0x7ec4aac5fd922aa914a2c40093e515103539f151b02d98cea23cec98ecc555ef/i);
  assert.match(report, /Bitcoin[\s\S]*verification[\s\S]*fa7eb13f6d854ed32ef284983c620f74050dd6d119dc9e91ad09c083b0267f8f/i);
});

test('report compares privacy, cost, auditability, and flexibility separately', () => {
  const report = reportText();
  for (const dimension of ['Privacy', 'Cost', 'Auditability', 'Flexibility']) assert.match(report, new RegExp(`better.*${dimension}|${dimension}.*better`, 'i'));
});

test('report separates raw data from inference and avoids fabricated capture fields', () => {
  const report = reportText();
  assert.match(report, /## Raw data/);
  assert.match(report, /## What can be inferred/);
  assert.match(report, /## Comparison/);
  assert.match(report, /not captured|not supplied|unknown/i);
  assert.match(report, /no BTC HTLC\/Boltz attribution is proven/i);
  assert.doesNotMatch(report, /deadbeef|REDACTED/i);
});
