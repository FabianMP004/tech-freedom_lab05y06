# Ethereum evidence capture

`capture-eth.mjs` performs a read-only JSON-RPC lookup for a user-supplied public transaction hash. It accepts only a public RPC URL and never accepts credentials, private keys, signing material, or broadcast options.

The capture is accepted only when the transaction targets the fixed public EtherSwap contract and uses one of its HTLC-pattern functions: `lock`, `claim`, or `refund`. The output preserves the transaction's raw `input` calldata, decodes its selector and parameters, records calldata byte length, records sanitized receipt fields, and renders a `## Raw data` Markdown section.

Example live lookup (run only when a public RPC endpoint is available):

```sh
node scripts/capture-eth.mjs \
  --rpc-url 'https://PUBLIC_RPC_ENDPOINT' \
  --tx-hash '0x3061cd37ce12acbaa816a6ce1e8779ecbf26e27c5980d5d3b9acf40d517c3748' \
  --output data/eth/capture.json
```

The candidate hash above comes from the local public-evidence note. No live capture is committed here unless the lookup is independently verified; an unavailable or invalid endpoint causes a clear non-zero error.
