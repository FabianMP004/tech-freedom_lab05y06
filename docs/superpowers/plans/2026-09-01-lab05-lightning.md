# Lab 05 Lightning Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable WDK Lightning wallet app that persists state, creates/checks/pays real invoices, and exposes a receive/pay UI without repository secrets.

**Architecture:** A Node HTTP server owns one initialized wallet service per process. A repository-backed encrypted state adapter handles persistence, while a wallet port isolates WDK from API and tests. A static browser client calls the API and renders QR/bolt11 data.

**Tech Stack:** Node.js 20+, ESM JavaScript, WDK Lightning package selected from the installed/current WDK API, native `node:test`, Web Crypto, static HTML/CSS/JS, Vercel Node function deployment.

**Spec:** `docs/superpowers/specs/2026-09-01-labs-05-06-design.md`

## Global Constraints

- Never create, print, store, commit, or request a real mnemonic/private key in the repository.
- `WDK_MNEMONIC` and `WDK_STORAGE_KEY` are environment-only runtime values.
- Validate all request inputs and avoid leaking wallet errors or environment values in HTTP responses.
- Vercel deployment and Lightning payments remain user-authorized external actions.

---

### Task 1: Project scaffold and secret-safe configuration

**Files:**
- Create: `lab05-lightning/package.json`
- Create: `lab05-lightning/.env.example`
- Create: `lab05-lightning/.gitignore`
- Create: `lab05-lightning/README.md`
- Create: `lab05-lightning/public/index.html`
- Create: `lab05-lightning/public/app.js`
- Create: `lab05-lightning/public/styles.css`

**Interfaces:** Produces a runnable app shell and documented environment names without secret values.

- [ ] Write a test that confirms `.env.example` contains only placeholder text and that `.gitignore` excludes `.env*`, runtime state, and logs.
- [ ] Run the test and verify it fails because the scaffold files do not exist.
- [ ] Add the package scripts `test`, `start`, and `dev`; add placeholder variables `WDK_MNEMONIC=replace-with-runtime-secret`, `WDK_STORAGE_KEY=replace-with-32-byte-secret`, and non-secret network settings.
- [ ] Implement the minimal static UI with Receive and Pay sections, accessible labels, and no embedded invoice or secret.
- [ ] Run the scaffold test and confirm it passes.

### Task 2: Encrypted persistence and wallet lifecycle

**Files:**
- Create: `lab05-lightning/src/config.js`
- Create: `lab05-lightning/src/secure-store.js`
- Create: `lab05-lightning/src/wallet-port.js`
- Create: `lab05-lightning/src/wallet-service.js`
- Test: `lab05-lightning/test/secure-store.test.js`
- Test: `lab05-lightning/test/wallet-service.test.js`

**Interfaces:** `createSecureStore(path, key)`, `createWalletService({ walletFactory, store })`, `createInvoice({ amountSats, memo })`, `checkInvoice(invoiceId)`, and `payInvoice(bolt11)`.

- [ ] Write failing tests proving encrypted state round-trips, wrong keys fail, wallet initialization occurs once, and subsequent requests reuse the same service instance.
- [ ] Run `node --test test/secure-store.test.js test/wallet-service.test.js` and verify the expected RED failures.
- [ ] Implement AES-GCM persistence with a random nonce per write, atomic file replacement, strict key parsing, and no mnemonic in the serialized state.
- [ ] Implement one process-level wallet service initialized from environment configuration; use an injected fake wallet in tests and a WDK adapter in production.
- [ ] Run the focused tests and confirm GREEN; inspect the state file bytes to ensure it contains no mnemonic-like environment value.

### Task 3: Validated invoice/check/pay HTTP API

**Files:**
- Create: `lab05-lightning/src/validation.js`
- Create: `lab05-lightning/src/http-server.js`
- Create: `lab05-lightning/api/index.js`
- Test: `lab05-lightning/test/http-server.test.js`

**Interfaces:** `POST /api/invoice` accepts `{ amountSats: integer, memo?: string }`; `GET /api/check/:invoiceId` returns `{ settled: boolean, invoiceId }`; `POST /api/pay` accepts `{ bolt11: string }`.

- [ ] Write failing integration tests for valid invoice creation, malformed amounts, bounded memo length, unknown invoice IDs, payment success, and sanitized wallet failures.
- [ ] Run the focused HTTP tests and verify RED.
- [ ] Implement schema validation at the HTTP boundary, JSON envelopes, status codes `201/200/400/404/502`, and response fields limited to public invoice data.
- [ ] Connect handlers to the singleton wallet service and keep WDK exceptions server-side.
- [ ] Run all Lab 05 tests and confirm GREEN.

### Task 4: Receive/pay UI and Vercel packaging

**Files:**
- Modify: `lab05-lightning/public/index.html`
- Modify: `lab05-lightning/public/app.js`
- Modify: `lab05-lightning/public/styles.css`
- Create: `lab05-lightning/vercel.json`
- Create: `lab05-lightning/DEPLOY.md`
- Create: `lab05-lightning/test/static-ui.test.js`

- [ ] Write failing tests that verify Receive renders QR and bolt11 from the API, Pay submits pasted bolt11, and UI source contains no secret variables.
- [ ] Run the UI tests and verify RED.
- [ ] Implement QR rendering using a browser-safe dependency or compact SVG generation, copy buttons, status polling with cancellation, and user-friendly errors.
- [ ] Configure Vercel routing for the static page and Node API entry point; document environment variable setup, `vercel --prod`, health verification, node ID capture, and cross-payment evidence placeholders.
- [ ] Run unit/integration/static tests and inspect the final tree for `.env`, mnemonic, private-key, and token patterns.

### Task 5: Lab 05 verification packet

**Files:**
- Modify: `lab05-lightning/README.md`
- Modify: `lab05-lightning/DEPLOY.md`
- Create: `lab05-lightning/scripts/secret-scan.mjs`

- [ ] Write a failing test for the secret scanner against a fixture containing a fake mnemonic and a clean fixture.
- [ ] Run it and verify RED.
- [ ] Implement a scanner that fails on mnemonic/private-key assignments and real-looking credentials while allowing explicit placeholders and public bolt11 evidence labels.
- [ ] Run `npm test`, the secret scanner, and a production start smoke test with fake wallet mode only.
- [ ] Record only verified local results; leave Vercel URL and cross-payment fields for the user’s authorized deployment/payment.
