import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_ADDRESS,
  ETHERSWAP_FUNCTIONS,
  captureEthereumEvidence,
  renderCaptureMarkdown,
} from '../scripts/capture-eth.mjs';

const LOCK_CALldata = '0x0899146b'
  + '71'.repeat(32)
  + '00'.repeat(12) + '89adc1d19ccf3e5e74550cdb831594013cfdd83c'
  + (12064183n).toString(16).padStart(64, '0');

const fixtureTransaction = Object.freeze({
  hash: '0x3061cd37ce12acbaa816a6ce1e8779ecbf26e27c5980d5d3b9acf40d517c3748',
  blockNumber: '0xb842ee',
  from: '0xb34817a34a965e426bbcbffad085aa7b6a09426',
  to: CONTRACT_ADDRESS,
  value: '0x4e22f4d5c00000',
  input: LOCK_CALldata,
  nonce: '0x1',
  gas: '0x5208',
});

const fixtureReceipt = Object.freeze({
  transactionHash: fixtureTransaction.hash,
  blockNumber: fixtureTransaction.blockNumber,
  status: '0x1',
  gasUsed: '0x9c40',
  effectiveGasPrice: '0x3b9aca00',
  logs: [],
});

function fixtureRequest(url, params) {
  assert.equal(url, 'https://public.example/rpc');
  assert.equal(params.method, 'POST');
  const body = JSON.parse(params.body);
  if (body.method === 'eth_getTransactionByHash') return fixtureTransaction;
  if (body.method === 'eth_getTransactionReceipt') return fixtureReceipt;
  throw new Error(`unexpected RPC method ${body.method}`);
}

test('captures the fixed EtherSwap address, raw calldata, decoded lock parameters, and receipt fields', async () => {
  const capture = await captureEthereumEvidence({
    rpcUrl: 'https://public.example/rpc',
    transactionHash: fixtureTransaction.hash,
    request: fixtureRequest,
  });

  assert.equal(capture.contractAddress, '0x9f6FEa1C76FC1961eED97c00124eF7D7a7b3d9Ea');
  assert.equal(capture.transaction.input, LOCK_CALldata);
  assert.equal(capture.calldata.selector, '0x0899146b');
  assert.deepEqual(capture.calldata.parameters, [
    `0x${'71'.repeat(32)}`,
    '0x89adc1d19ccf3e5e74550cdb831594013cfdd83c',
    12064183n,
  ]);
  assert.equal(capture.calldata.byteLength, 100);
  assert.deepEqual(capture.receipt, {
    transactionHash: fixtureReceipt.transactionHash,
    blockNumber: fixtureReceipt.blockNumber,
    status: fixtureReceipt.status,
    gasUsed: fixtureReceipt.gasUsed,
    effectiveGasPrice: fixtureReceipt.effectiveGasPrice,
  });
});

test('exposes the complete EtherSwap function inventory', () => {
  assert.deepEqual(ETHERSWAP_FUNCTIONS.map(({ name, signature, selector, inputs }) => ({
    name, signature, selector, inputs,
  })), [
    { name: 'lock', signature: 'lock(bytes32,address,uint256)', selector: '0x0899146b', inputs: ['bytes32', 'address', 'uint256'] },
    { name: 'claim', signature: 'claim(bytes32,uint256,address,uint256)', selector: '0xc3c37fbc', inputs: ['bytes32', 'uint256', 'address', 'uint256'] },
    { name: 'refund', signature: 'refund(bytes32,uint256,address,uint256)', selector: '0x35cd4ccb', inputs: ['bytes32', 'uint256', 'address', 'uint256'] },
  ]);
});

test('rejects a successful transaction sent elsewhere as non-HTLC evidence', async () => {
  await assert.rejects(
    () => captureEthereumEvidence({
      rpcUrl: 'https://public.example/rpc',
      transactionHash: fixtureTransaction.hash,
      request: async (url, params) => {
        const result = await fixtureRequest(url, params);
        return params.method === 'POST' && JSON.parse(params.body).method === 'eth_getTransactionByHash'
          ? { ...result, to: '0x1111111111111111111111111111111111111111' }
          : result;
      },
    }),
    /HTLC|EtherSwap|contract address/i,
  );
});

test('renders sanitized observations under a raw-data section', async () => {
  const capture = await captureEthereumEvidence({
    rpcUrl: 'https://public.example/rpc',
    transactionHash: fixtureTransaction.hash,
    request: fixtureRequest,
  });
  const markdown = renderCaptureMarkdown(capture);
  assert.match(markdown, /^## Raw data/m);
  assert.match(markdown, /"input": "0x0899146b/);
  assert.match(markdown, /"receipt"/);
  assert.doesNotMatch(markdown, /private|secret|credential|password/i);
});

test('reports unavailable live RPC data clearly', async () => {
  await assert.rejects(
    () => captureEthereumEvidence({
      rpcUrl: 'https://public.example/rpc',
      transactionHash: fixtureTransaction.hash,
      request: async () => { throw new Error('network down'); },
    }),
    /Public Ethereum RPC eth_getTransactionByHash unavailable: network down/i,
  );
});
