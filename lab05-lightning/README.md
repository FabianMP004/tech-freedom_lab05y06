# Lab 05 Lightning

This package provides the Lightning lab app shell backed by the Spark WDK
adapter. It contains Receive and Pay sections using account 0 from
`@tetherto/wdk-wallet-spark` by default.

## Configuration

Copy `.env.example` to a local environment file and provide values at runtime:

- `WDK_MNEMONIC` — runtime wallet secret; never commit it.
- `WDK_STORAGE_KEY` — runtime 32-byte storage-encryption secret; never commit it.
- `WDK_NETWORK` — non-secret network name (the example uses `testnet`).
- `WDK_RPC_URL` — non-secret RPC endpoint for the selected network.
- `WDK_LIGHTNING_PACKAGE` — runtime Lightning adapter package; defaults to `@tetherto/wdk-wallet-spark`.
- `PAY_AUTH_TOKEN` — runtime-only token required as `Authorization: Bearer ...` for payments; never commit a value.

The example values are placeholders only. Do not put invoices, private keys,
real tokens, or credentials in this repository or in the browser bundle. The
pay API fails closed when `PAY_AUTH_TOKEN` is not configured.

## Local verification

Run the dependency-free test suite and secret scanner from this directory:

```sh
npm test
node scripts/secret-scan.mjs
```

The scanner checks tracked text files for mnemonic/private-key assignments and
real-looking credentials. Explicit placeholders and public `bolt11` evidence
labels are allowed. The Spark adapter dynamically loads the ESM default
`WalletManagerSpark`, maps `mainnet`, `testnet`, and `regtest` to Spark's
uppercase network names, and never persists the mnemonic or private key.

## Run

```sh
npm start
```

Open <http://localhost:8080> in a browser. `npm run dev` serves the same static
shell for local development.
