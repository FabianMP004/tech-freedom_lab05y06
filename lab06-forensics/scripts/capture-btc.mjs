#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { classifyBitcoinTransaction } from '../src/btc.js';
import { formatRawData } from '../src/report-format.js';

const TXID = /^[0-9a-fA-F]{64}$/;

function requireTxid(value, name) {
  if (!TXID.test(value ?? '')) throw new TypeError(`${name} must be a 32-byte hex transaction id`);
  return value.toLowerCase();
}

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readPublicResponse(response, kind) {
  if (response && typeof response.ok === 'boolean' && !response.ok) {
    throw new Error(`Public Bitcoin endpoint returned HTTP ${response.status} for ${kind}`);
  }
  if (response && typeof response.json === 'function') return response.json();
  return response;
}

async function readPublicHex(response, kind) {
  if (response && typeof response.ok === 'boolean' && !response.ok) {
    throw new Error(`Public Bitcoin endpoint returned HTTP ${response.status} for ${kind}`);
  }
  if (response && typeof response.text === 'function') return response.text();
  if (typeof response !== 'string') throw new Error(`Public Bitcoin endpoint returned invalid ${kind}`);
  return response;
}

async function captureOne({ baseUrl, transactionId, request }) {
  let raw;
  let rawHex;
  try {
    raw = await readPublicResponse(await request(endpoint(baseUrl, `/api/tx/${transactionId}`)), 'transaction');
    rawHex = await readPublicHex(await request(endpoint(baseUrl, `/api/tx/${transactionId}/hex`)), 'raw transaction');
  } catch (error) {
    throw new Error(`Public Bitcoin capture failed for ${transactionId}: ${error.message}`);
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.vin) || !Array.isArray(raw.vout)) {
    throw new Error(`Public Bitcoin transaction ${transactionId} was missing inputs or outputs`);
  }
  const observations = classifyBitcoinTransaction(raw);
  return Object.freeze({
    raw,
    rawHex: rawHex.trim(),
    inputs: raw.vin,
    outputs: raw.vout,
    observations,
  });
}

export async function captureBitcoinEvidence({
  baseUrl = 'https://mempool.space',
  transactionId,
  verificationTransactionId,
  request = fetch,
} = {}) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) throw new TypeError('base URL must be an HTTP(S) public endpoint');
  if (typeof request !== 'function') throw new TypeError('request must be a function');
  const primary = requireTxid(transactionId, 'transaction id');
  const verification = requireTxid(verificationTransactionId, 'verification transaction id');
  if (primary === verification) throw new Error('verification transaction id must be distinct from the primary transaction id');
  const transactions = [
    await captureOne({ baseUrl, transactionId: primary, request }),
    await captureOne({ baseUrl, transactionId: verification, request }),
  ];
  return Object.freeze({
    source: 'mempool.space-compatible public API',
    transactionIds: [primary, verification],
    transactions,
    attribution: Object.freeze({
      boltz: 'refused',
      reason: 'public Bitcoin transaction data alone does not establish Boltz attribution',
    }),
  });
}

export function renderBitcoinCaptureMarkdown(capture) {
  return `${formatRawData(capture)}\n\n## Evidence boundary\n\n- Boltz attribution is refused: no service identity is inferred from public transaction data.\n- HTLC-like status is observational only; key-path spends leave hidden Taproot tree conditions unknown, and non-matching leaf scripts are refused as HTLC-like evidence.`;
}

async function runCli(argv) {
  const valueFor = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const capture = await captureBitcoinEvidence({
    baseUrl: valueFor('--base-url') ?? 'https://mempool.space',
    transactionId: valueFor('--txid'),
    verificationTransactionId: valueFor('--verification-txid'),
  });
  const output = valueFor('--output');
  if (output) {
    const root = resolve(process.cwd(), 'data/btc');
    const target = resolve(process.cwd(), output);
    const pathFromRoot = relative(root, target);
    if (isAbsolute(pathFromRoot) || pathFromRoot.startsWith('..')) throw new Error('--output must stay under data/btc');
    await mkdir(root, { recursive: true });
    await writeFile(target, `${JSON.stringify(capture, null, 2)}\n`, { mode: 0o644 });
  }
  process.stdout.write(`${renderBitcoinCaptureMarkdown(capture)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`capture-btc: ${error.message}\n`);
    process.exitCode = 1;
  });
}
