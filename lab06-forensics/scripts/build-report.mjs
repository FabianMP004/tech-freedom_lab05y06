#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ETH_CONTRACT = '0x9f6FEa1C76FC1961eED97c00124eF7D7a7b3d9Ea';
const eth = Object.freeze({
  lock: '0x3061cd37ce12acbaa816a6ce1e8779ecbf26e27c5980d5d3b9acf40d517c3748',
  claim: '0x7ec4aac5fd922aa914a2c40093e515103539f151b02d98cea23cec98ecc555ef',
  contractUrl: 'https://etherscan.io/address/0x9f6fea1c76fc1961eed97c00124ef7d7a7b3d9ea#code',
  lockUrl: 'https://etherscan.io/tx/0x3061cd37ce12acbaa816a6ce1e8779ecbf26e27c5980d5d3b9acf40d517c3748',
  claimUrl: 'https://etherscan.io/tx/0x7ec4aac5fd922aa914a2c40093e515103539f151b02d98cea23cec98ecc555ef',
});
const btc = Object.freeze({
  funding: '88047644c7e42421861b5d15551aa29151f86d81409fd9a3831f43a541505720',
  spend: 'fa7eb13f6d854ed32ef284983c620f74050dd6d119dc9e91ad09c083b0267f8f',
  fundingUrl: 'https://blockstream.info/tx/88047644c7e42421861b5d15551aa29151f86d81409fd9a3831f43a541505720',
  spendUrl: 'https://blockstream.info/tx/fa7eb13f6d854ed32ef284983c620f74050dd6d119dc9e91ad09c083b0267f8f',
});

export function buildReport() {
  return `# Transaction Forensics: Ethereum vs Bitcoin Taproot

Generated from the local public-evidence note dated 2026-09-01. This report does not perform live lookups and does not invent transaction fields.

## Raw data

### Ethereum

- Contract: \`${ETH_CONTRACT}\` ([verified-source page](${eth.contractUrl})).
- Primary candidate lock transaction: \`${eth.lock}\` ([Etherscan](${eth.lockUrl})).
- Second verification transaction, the candidate claim: \`${eth.claim}\` ([Etherscan](${eth.claimUrl})).
- Lock observation: method/action \`Lock\`; function \`lock(bytes32 preimageHash, address claimAddress, uint256 timelock)\`; selector \`0x0899146b\`; block \`12063470\`; value \`0.02213081 ETH\`.
- Lock parameters observed in the decoded event: preimageHash \`0x712071d518bf6c5407f5e606c32cfe654541c72a3879dbc5edf293e8934aad54\`, claimAddress \`0x89aDC1d19ccF3e5E74550CDB831594013CFDD83c\`, refundAddress/sender \`0xB34817A34a965E426BBcbBFFaD085Aa7B6a09426\`, timelock \`12064183\`.
- Claim observation: function \`claim(bytes32 preimage, uint256 amount, address refundAddress, uint256 timelock)\`; selector \`0xc3c37fbc\`; block \`12063476\`; revealed preimage \`0xbd512a8b7207d4d04ee7ddc7224961cfeb55f06641b2446fa8a86a3b115ee78b\`.
- Raw lock calldata: \\`0x0899146b712071d518bf6c5407f5e606c32cfe654541c72a3879dbc5edf293e8934aad5400000000000000000000000089adc1d19ccf3e5e74550cdb831594013cfdd83c0000000000000000000000000000000000000000000000000000000000b815b7\\`; calldata length: \\`100\\` bytes; receipt status: \\`0x1\\`; gas limit: \\`0xb701\\`; gas used: \\`0xb701\\`; gas price: \\`0x266ac43200\\`.
- Raw claim calldata: \\`0xc3c37fbcbd512a8b7207d4d04ee7ddc7224961cfeb55f06641b2446fa8a86a3b115ee78b000000000000000000000000000000000000000000000000004e9fdabca44400000000000000000000000000b34817a34a965e426bbcbbffad085aa7b6a094260000000000000000000000000000000000000000000000000000000000b815b7\\`; calldata length: \\`132\\` bytes; receipt status: \\`0x1\\`; gas limit: \\`0xa4d8\\`; gas used: \\`0x61ae\\`; gas price: \\`0x2794ca2400\\`.
- Decoded claim parameters: preimage \\`0xbd512a8b7207d4d04ee7ddc7224961cfeb55f06641b2446fa8a86a3b115ee78b\\`, amount \\`22130810000000000\\` wei, refund address \\`0xb34817a34a965e426bbcbbffad085aa7b6a09426\\`, timelock \\`12064183\\`.
- Documented EtherSwap function inventory: \`lock(bytes32,address,uint256)\` → \`0x0899146b\`; \`claim(bytes32,uint256,address,uint256)\` → \`0xc3c37fbc\`; \`refund(bytes32,uint256,address,uint256)\` → \`0x35cd4ccb\`.

### Bitcoin

- Primary documented funding transaction: \`${btc.funding}\`, output 1 ([Blockstream](${btc.fundingUrl})).
- Second verification transaction: \`${btc.spend}\` ([Blockstream](${btc.spendUrl})); the note records that it spends the documented funding output.
- Funding raw facts: confirmed block \\`872044\\`; output 1 is \\`v1_p2tr\\`, value \\`10000\\` sats, scriptPubKey \\`5120562529047f476b9a833a5a780a75845ec32980330d76d1ac9f351dc76bce5d72\\`; transaction size \\`234\\`, weight \\`609\\`, fee \\`700\\`, therefore \\`153 vbytes\\`.
- Spend raw facts: confirmed block \\`872044\\`; input 1 spends funding output 1 and has \\`v1_p2tr\\` prevout; transaction size \\`321\\`, weight \\`726\\`, fee \\`3895\\`, therefore \\`182 vbytes\\`.
- Spend witness for the Taproot input: \\`03\\`, \\`5387\\`, and the 129-byte control block captured by \\`data/btc/capture.json\\`.
- Spend type: **script-path**; witness element count: \\`3\\`; leaf script: \\`0x5387\\`; control block leaf version: \\`0xc0\\`. The control block exposes a Merkle path, but public data cannot determine the total number of other leaves/conditions in the Taproot tree. No settled status or service identity is supplied.

## What can be inferred

### Ethereum

- The two documented Ethereum transactions are a high-confidence HTLC-pattern lock/claim pair: identical preimageHash, matching amount, matching refund address relationship, matching claim destination, and claim before the lock block-height timelock.
- The verified EtherSwap source documents lock, claim, and refund entry points, the SHA-256 preimage relation, Lockup/Claim/Refund events, and the refund block-height check.
- A selector identifies a function entry point; it does not by itself prove settlement. The documented pair supports the HTLC-pattern inference, while omitted receipt/raw RPC fields must not be treated as observed.

### Bitcoin

- A script-path spend reveals that a Taproot leaf/control-block path was used, but the documented evidence does not include the leaf bytes needed to compare the script to a particular HTLC construction.
- The public transaction data therefore does not prove a Bitcoin HTLC, Boltz attribution, or settled swap. **No BTC HTLC/Boltz attribution is proven.**
- The observable script-path fact is not sufficient to attribute this spend to a named HTLC or service.
- A Taproot key-path spend would leave the script tree hidden; that caveat remains relevant to any future capture. No Bitcoin settled status is asserted.
- Hidden Taproot script tree caveat: key-path witness data does not reveal the hidden Taproot script tree or its spending conditions.

## Comparison

“Better” depends on the dimension; no single winner is claimed:

- Privacy: better means less publicly revealed transaction intent or secret/script material.
- Cost: better means lower fee/gas burden for the same outcome.
- Auditability: better means more independently inspectable terms and linkage.
- Flexibility: better means more settlement paths and policy choices.

| Dimension | What would be better | Evidence-limited assessment |
| --- | --- | --- |
| Privacy | The construction that reveals less transaction intent or secret/script material | Bitcoin Taproot can hide the tree under key-path spending; this documented script-path comparator reveals a spend path, while the Ethereum candidate exposes contract calldata/events. Context-dependent, not a universal winner. |
| Cost | The construction with lower fee/gas burden for the same outcome | Not scored: the documented Bitcoin vbytes and Ethereum gas fields needed for a fair comparison are not captured. |
| Auditability | The construction with more independently inspectable terms and linkage | Ethereum is better supported by the documented verified contract, selectors, events, and shared preimageHash. Bitcoin is not attributable here. |
| Flexibility | The construction supporting more settlement paths and policy choices | Ethereum’s documented lock/claim/refund functions are explicit; Bitcoin Taproot supports key-path/script-path choices, but hidden tree conditions and HTLC attribution are unknown here. Trade-off, not a blanket winner. |

### Evidence boundary

- Public URLs and observations above come only from the documented candidate note and repository capture documentation.
- The Bitcoin pair is a weak Taproot comparator, not a proven HTLC or Boltz swap.
- No txid, calldata, witness, leaf, vbytes, receipt, or settled status has been fabricated. Unknown means unknown.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFile(resolve(process.cwd(), 'TX_FORENSICS.md'), buildReport(), { mode: 0o644 });
  process.stdout.write('Wrote TX_FORENSICS.md\n');
}
