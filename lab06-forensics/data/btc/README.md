# Bitcoin Taproot evidence capture

`capture-btc.mjs` performs read-only lookups against mempool.space-compatible public endpoints:

```sh
node scripts/capture-btc.mjs \
  --base-url 'https://mempool.space' \
  --txid PRIMARY_PUBLIC_TXID \
  --verification-txid SECOND_PUBLIC_TXID \
  --output data/btc/capture.json
```

Both transaction IDs are required and must be distinct. The collector records the public transaction JSON, raw transaction hex, input witnesses, outputs, and calculated vbytes. It does not construct, sign, or broadcast transactions and accepts no credentials or signing material.

Taproot facts are limited to what the public transaction reveals: `v1_p2tr` prevouts, witness shape, script-path leaf/control-block bytes, and vbytes. A one-element key-path witness cannot reveal the hidden script tree or count its conditions, so HTLC-like status is `unknown`. A transaction without an observable, matching HTLC-like leaf is explicitly `refused`; no Boltz attribution is made from chain data alone.

Tests use deterministic local fixtures and injected requests. No live capture is committed unless its public provenance is independently verified.
