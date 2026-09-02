# Lab 06 Taproot vs Ethereum Forensics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-backed raw-data report comparing an Ethereum HTLC-pattern contract interaction with a Bitcoin Taproot HTLC-pattern spend.

**Architecture:** A read-only collector fetches public chain data through configurable explorers/RPC endpoints. Decoder helpers normalize calldata, ABI functions, transaction fields, and Taproot witness data into report-ready JSON; the Markdown report separates raw observations from interpretation.

**Tech Stack:** Node.js 20+, ESM JavaScript, `viem` ABI decoding, native `node:test`, configurable Ethereum RPC and mempool.space REST endpoints.

**Spec:** `docs/superpowers/specs/2026-09-01-labs-05-06-design.md`

## Global Constraints

- No wallet credentials or private keys are needed or allowed.
- Raw public transaction data must be recorded before conclusions.
- Historical transactions remain valid evidence even if a service is unavailable.
- Every interpretation must identify what the raw data does and does not prove.

---

### Task 1: Read-only collector and decoder primitives

**Files:**
- Create: `lab06-forensics/package.json`
- Create: `lab06-forensics/src/eth.js`
- Create: `lab06-forensics/src/btc.js`
- Create: `lab06-forensics/src/report-format.js`
- Test: `lab06-forensics/test/decoders.test.js`

- [ ] Write failing tests for calldata byte length, 4-byte selector extraction, ABI parameter decoding, witness classification, and script-path leaf extraction.
- [ ] Run `node --test test/decoders.test.js` and verify RED.
- [ ] Implement pure decoders with deterministic fixtures and explicit hex validation.
- [ ] Implement read-only fetchers that require transaction IDs as arguments and never accept signing material.
- [ ] Run focused tests and confirm GREEN.

### Task 2: Ethereum evidence capture

**Files:**
- Create: `lab06-forensics/scripts/capture-eth.mjs`
- Create: `lab06-forensics/data/eth/README.md`
- Create: `lab06-forensics/data/eth/.gitkeep`
- Test: `lab06-forensics/test/eth-capture.test.js`

- [ ] Write tests for the specified contract address, raw calldata preservation, transaction receipt fields, selector, parameter list, calldata size, and complete ABI function inventory.
- [ ] Run tests and verify RED.
- [ ] Implement capture requiring a user-supplied public transaction hash and RPC URL, with the contract address hard-coded as a public constant and no private credentials.
- [ ] Store sanitized public JSON and render a raw-data section; if the chosen transaction is not lock/claim HTLC-pattern evidence, reject it with a clear message.
- [ ] Run tests with fixtures and record the live lookup command separately from captured data.

### Task 3: Bitcoin Taproot evidence capture

**Files:**
- Create: `lab06-forensics/scripts/capture-btc.mjs`
- Create: `lab06-forensics/data/btc/README.md`
- Create: `lab06-forensics/data/btc/.gitkeep`
- Test: `lab06-forensics/test/btc-capture.test.js`

- [ ] Write tests for Taproot input detection, one-element key-path witness classification, script-path control-block parsing, vbytes, leaf script, and the limits of counting hidden tree conditions.
- [ ] Run tests and verify RED.
- [ ] Implement capture from a supplied public txid using mempool.space-compatible endpoints, preserving raw transaction/input/vout fields and avoiding interpretation in the collector.
- [ ] Add a second verification tx path and require both txids before report generation.
- [ ] Run fixture tests and validate that captured data contains no credentials.

### Task 4: Report and comparison

**Files:**
- Create: `lab06-forensics/TX_FORENSICS.md`
- Create: `lab06-forensics/README.md`
- Create: `lab06-forensics/scripts/build-report.mjs`
- Test: `lab06-forensics/test/report.test.js`

- [ ] Write failing tests requiring ETH selector/params/calldata size/all functions, BTC spend type/leaf/vbytes/tree caveat, two verification txs, and four comparison dimensions.
- [ ] Run the report tests and verify RED.
- [ ] Implement report generation with separate `Raw data`, `What can be inferred`, and `Comparison` sections; use explicit placeholders until public txids are supplied.
- [ ] Fill the report only from captured public data, cite explorer/API URLs, and define “better” separately for privacy, cost, auditability, and flexibility.
- [ ] Run all Lab 06 tests and a final grep/secret scan.
