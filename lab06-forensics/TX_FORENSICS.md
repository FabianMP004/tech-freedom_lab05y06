# Transaction Forensics: Ethereum vs Bitcoin Taproot

Generated from the local public-evidence note dated 2026-09-01. This report does not perform live lookups and does not invent transaction fields.

## Raw data

### Ethereum

- Contract: `0x9f6FEa1C76FC1961eED97c00124eF7D7a7b3d9Ea` ([verified-source page](https://etherscan.io/address/0x9f6fea1c76fc1961eed97c00124ef7d7a7b3d9ea#code)).
- Primary candidate lock transaction: `0x3061cd37ce12acbaa816a6ce1e8779ecbf26e27c5980d5d3b9acf40d517c3748` ([Etherscan](https://etherscan.io/tx/0x3061cd37ce12acbaa816a6ce1e8779ecbf26e27c5980d5d3b9acf40d517c3748)).
- Second verification transaction, the candidate claim: `0x7ec4aac5fd922aa914a2c40093e515103539f151b02d98cea23cec98ecc555ef` ([Etherscan](https://etherscan.io/tx/0x7ec4aac5fd922aa914a2c40093e515103539f151b02d98cea23cec98ecc555ef)).
- Lock observation: method/action `Lock`; function `lock(bytes32 preimageHash, address claimAddress, uint256 timelock)`; selector `0x0899146b`; block `12063470`; value `0.02213081 ETH`.
- Lock parameters observed in the decoded event: preimageHash `0x712071d518bf6c5407f5e606c32cfe654541c72a3879dbc5edf293e8934aad54`, claimAddress `0x89aDC1d19ccF3e5E74550CDB831594013CFDD83c`, refundAddress/sender `0xB34817A34a965E426BBcbBFFaD085Aa7B6a09426`, timelock `12064183`.
- Claim observation: function `claim(bytes32 preimage, uint256 amount, address refundAddress, uint256 timelock)`; selector `0xc3c37fbc`; block `12063476`; revealed preimage `0xbd512a8b7207d4d04ee7ddc7224961cfeb55f06641b2446fa8a86a3b115ee78b`.
- Raw transaction input/calldata bytes, receipt status, gas, gas price, and exact decoded claim parameters were not captured in the documented note; they remain **not captured**, not reconstructed. Calldata byte length: **not captured**.
- Documented EtherSwap function inventory: `lock(bytes32,address,uint256)` → `0x0899146b`; `claim(bytes32,uint256,address,uint256)` → `0xc3c37fbc`; `refund(bytes32,uint256,address,uint256)` → `0x35cd4ccb`.

### Bitcoin

- Primary documented funding transaction: `88047644c7e42421861b5d15551aa29151f86d81409fd9a3831f43a541505720`, output 1 ([Blockstream](https://blockstream.info/tx/88047644c7e42421861b5d15551aa29151f86d81409fd9a3831f43a541505720)).
- Second verification transaction: `fa7eb13f6d854ed32ef284983c620f74050dd6d119dc9e91ad09c083b0267f8f` ([Blockstream](https://blockstream.info/tx/fa7eb13f6d854ed32ef284983c620f74050dd6d119dc9e91ad09c083b0267f8f)); the note records that it spends the documented funding output.
- Documented observation for the spend: historical Taproot script-path spend; its revealed witness script was not recorded in the note.
- Spend type: **script-path (documented observation)**. Leaf script, control block, leaf version, witness elements, transaction weight, and vbytes: **not captured**.
- No Bitcoin capture output is present in the repository. Therefore no raw witness, calldata, settled status, HTLC match, or service identity is supplied here.

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
