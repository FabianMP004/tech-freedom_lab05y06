# Lab 06 forensics report

`TX_FORENSICS.md` is a bounded comparison of the documented Ethereum EtherSwap candidate and the documented Bitcoin Taproot comparator. It separates raw observations from inference and marks unavailable capture fields as unknown.

Build the report with:

```sh
node scripts/build-report.mjs
```

The report uses no credentials, signing material, live lookups, or fabricated transaction data. The Bitcoin transactions are not proven HTLC/Boltz activity; **no BTC HTLC/Boltz attribution is proven**.
