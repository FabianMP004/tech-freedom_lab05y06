#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { formatRawData } from '../src/report-format.js';
import {
  calldataByteLength,
  decodeAbiParameters,
  extractSelector,
} from '../src/eth.js';

export const CONTRACT_ADDRESS = '0x9f6FEa1C76FC1961eED97c00124eF7D7a7b3d9Ea';

export const ETHERSWAP_FUNCTIONS = Object.freeze([
  Object.freeze({ name: 'lock', signature: 'lock(bytes32,address,uint256)', selector: '0x0899146b', inputs: ['bytes32', 'address', 'uint256'] }),
  Object.freeze({ name: 'claim', signature: 'claim(bytes32,uint256,address,uint256)', selector: '0xc3c37fbc', inputs: ['bytes32', 'uint256', 'address', 'uint256'] }),
  Object.freeze({ name: 'refund', signature: 'refund(bytes32,uint256,address,uint256)', selector: '0x35cd4ccb', inputs: ['bytes32', 'uint256', 'address', 'uint256'] }),
]);

const TRANSACTION_FIELDS = ['hash', 'blockNumber', 'from', 'to', 'value', 'input', 'nonce', 'gas', 'gasPrice'];
const RECEIPT_FIELDS = ['transactionHash', 'blockNumber', 'status', 'gasUsed', 'effectiveGasPrice'];
const HASH = /^0x[0-9a-fA-F]{64}$/;

function requiredString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

function copyFields(source, fields, name) {
  if (!source || typeof source !== 'object') throw new Error(`${name} was missing from the public RPC response`);
  return Object.freeze(Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])));
}

async function rpcCall(rpcUrl, method, transactionHash, request) {
  let response;
  try {
    response = await request(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [transactionHash] }),
    });
  } catch (error) {
    throw new Error(`Public Ethereum RPC ${method} unavailable: ${error.message}`);
  }
  const payload = response && typeof response.json === 'function' ? await response.json() : response;
  if (!payload || payload.error) throw new Error(`Public Ethereum RPC ${method} failed: ${payload?.error?.message ?? 'invalid response'}`);
  return payload.result ?? payload;
}

function functionForSelector(selector) {
  return ETHERSWAP_FUNCTIONS.find((item) => item.selector === selector);
}

export async function captureEthereumEvidence({ rpcUrl, transactionHash, request = fetch } = {}) {
  requiredString(rpcUrl, 'rpc URL');
  if (!HASH.test(transactionHash ?? '')) throw new TypeError('transaction hash must be a 0x-prefixed 32-byte hex value');
  if (typeof request !== 'function') throw new TypeError('request must be a function');

  const transaction = await rpcCall(rpcUrl, 'eth_getTransactionByHash', transactionHash, request);
  if (!transaction) throw new Error('Public Ethereum RPC returned no transaction; verify the hash and RPC URL');
  if (typeof transaction.to !== 'string' || transaction.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error(`Transaction is not EtherSwap HTLC evidence: expected contract address ${CONTRACT_ADDRESS}`);
  }
  const input = requiredString(transaction.input, 'transaction calldata');
  const selector = extractSelector(input);
  const functionInfo = functionForSelector(selector);
  if (!functionInfo) throw new Error(`Transaction is not a recognized EtherSwap HTLC lock/claim/refund call (selector ${selector})`);

  const receiptResponse = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', transactionHash, request);
  const receipt = copyFields(receiptResponse, RECEIPT_FIELDS, 'transaction receipt');
  if (receipt.status !== '0x1') throw new Error('Transaction receipt is not successful; refusing to capture failed HTLC evidence');

  return Object.freeze({
    contractAddress: CONTRACT_ADDRESS,
    transaction: copyFields(transaction, TRANSACTION_FIELDS, 'transaction'),
    calldata: Object.freeze({
      function: functionInfo.name,
      signature: functionInfo.signature,
      selector,
      parameters: decodeAbiParameters(functionInfo.inputs, input),
      byteLength: calldataByteLength(input),
    }),
    receipt,
    abiFunctions: ETHERSWAP_FUNCTIONS,
  });
}

export function renderCaptureMarkdown(capture) {
  return formatRawData(capture);
}

async function runCli(argv) {
  const valueFor = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const rpcUrl = valueFor('--rpc-url');
  const transactionHash = valueFor('--tx-hash');
  const output = valueFor('--output');
  if (!rpcUrl || !transactionHash) throw new Error('Usage: capture-eth.mjs --rpc-url PUBLIC_RPC_URL --tx-hash TX_HASH [--output data/eth/capture.json]');
  const capture = await captureEthereumEvidence({ rpcUrl, transactionHash });
  if (output) {
    const root = resolve(process.cwd(), 'data/eth');
    const target = resolve(process.cwd(), output);
    const pathFromRoot = relative(root, target);
    if (isAbsolute(pathFromRoot) || pathFromRoot.startsWith('..')) throw new Error('--output must stay under data/eth');
    await mkdir(root, { recursive: true });
    await writeFile(target, `${JSON.stringify(capture, (_, item) => typeof item === 'bigint' ? `${item}n` : item, 2)}\n`, { mode: 0o644 });
  }
  process.stdout.write(`${renderCaptureMarkdown(capture)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`capture-eth: ${error.message}\n`);
    process.exitCode = 1;
  });
}
