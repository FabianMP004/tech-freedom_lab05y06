const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const { createRequestHandler } = require('../src/http-server');

function walletService(overrides = {}) {
  return {
    async createInvoice(input) {
      return { invoiceId: 'inv-1', bolt11: 'lnbc1test', ...input, internal: 'do-not-expose' };
    },
    async checkInvoice(invoiceId) {
      if (invoiceId === 'missing') throw new Error('invoice not found in WDK');
      return { invoiceId, settled: true, mnemonic: 'never-expose' };
    },
    async payInvoice(bolt11) {
      return { bolt11, paid: true, privateKey: 'never-expose' };
    },
    ...overrides,
  };
}

async function request(handler, path, { method = 'GET', body, headers = {} } = {}) {
  const request = Readable.from(body === undefined ? [] : [body]);
  request.method = method;
  request.url = path;
  request.headers = headers;
  const response = {
    status: null,
    headers: null,
    output: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(value) { this.output = value || ''; },
  };
  await handler(request, response);
  return { status: response.status, body: JSON.parse(response.output) };
}

async function withPayAuth(token, callback) {
  const previous = process.env.PAY_AUTH_TOKEN;
  if (token === undefined) delete process.env.PAY_AUTH_TOKEN;
  else process.env.PAY_AUTH_TOKEN = token;
  try { return await callback(); }
  finally {
    if (previous === undefined) delete process.env.PAY_AUTH_TOKEN;
    else process.env.PAY_AUTH_TOKEN = previous;
  }
}

test('creates a valid invoice with a public response envelope', async () => {
  const handler = createRequestHandler({ walletService: walletService() });
  {
    const result = await request(handler, '/api/invoice', {
      method: 'POST', body: JSON.stringify({ amountSats: 42, memo: 'coffee' }),
    });

    assert.equal(result.status, 201);
    assert.deepEqual(result.body, {
      ok: true,
      data: { invoiceId: 'inv-1', bolt11: 'lnbc1test', amountSats: 42, memo: 'coffee' },
    });
  }
});

test('rejects malformed amounts and overlong memos at the HTTP boundary', async () => {
  const handler = createRequestHandler({ walletService: walletService() });
  {
    for (const payload of [
      { amountSats: 1.5 },
      { amountSats: '42' },
      { amountSats: 0 },
      { amountSats: 42, memo: 'x'.repeat(281) },
    ]) {
      const result = await request(handler, '/api/invoice', { method: 'POST', body: JSON.stringify(payload) });
      assert.equal(result.status, 400);
      assert.equal(result.body.ok, false);
      assert.equal(typeof result.body.error, 'string');
    }
  }
});

test('rejects malformed JSON with a sanitized 400 response', async () => {
  let calls = 0;
  const handler = createRequestHandler({ walletService: walletService({
    createInvoice: async () => { calls += 1; },
  }) });
  const result = await request(handler, '/api/invoice', { method: 'POST', body: '{"amountSats":' });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { ok: false, error: 'Request body must be valid JSON' });
  assert.equal(calls, 0);
});

test('rejects request bodies over the maximum size with a sanitized 400 response', async () => {
  let calls = 0;
  const handler = createRequestHandler({ walletService: walletService({
    createInvoice: async () => { calls += 1; },
  }) });
  const result = await request(handler, '/api/invoice', {
    method: 'POST',
    body: JSON.stringify({ amountSats: 42, memo: 'x'.repeat(1024 * 1024) }),
  });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { ok: false, error: 'Request body is too large' });
  assert.equal(calls, 0);
  assert.doesNotMatch(JSON.stringify(result.body), /wallet|service|stack|TypeError/);
});

test('rejects unexpected request fields at the HTTP boundary', async () => {
  const handler = createRequestHandler({ walletService: walletService() });
  const invoice = await request(handler, '/api/invoice', {
    method: 'POST', body: JSON.stringify({ amountSats: 42, role: 'admin' }),
  });
  assert.equal(invoice.status, 400);
  const payment = await withPayAuth('test-runtime-token', () => request(handler, '/api/pay', {
    method: 'POST',
    headers: { authorization: 'Bearer test-runtime-token' },
    body: JSON.stringify({ bolt11: 'lnbc1test', extra: true }),
  }));
  assert.equal(payment.status, 400);
});

test('checks an invoice and returns 404 for an unknown invoice ID', async () => {
  const handler = createRequestHandler({ walletService: walletService() });
  {
    const checked = await request(handler, '/api/check/inv-1');
    assert.equal(checked.status, 200);
    assert.deepEqual(checked.body, { ok: true, data: { settled: true, invoiceId: 'inv-1' } });

    const missing = await request(handler, '/api/check/missing');
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { ok: false, error: 'Invoice not found' });
  }
});

test('routes check requests to exactly one invoice path segment', async () => {
  let calls = 0;
  const handler = createRequestHandler({ walletService: walletService({
    checkInvoice: async () => { calls += 1; return { settled: true }; },
  }) });
  const extraSegment = await request(handler, '/api/check/inv-1/extra');
  assert.equal(extraSegment.status, 404);
  const encodedSlash = await request(handler, '/api/check/inv%2F1');
  assert.equal(encodedSlash.status, 400);
  assert.equal(calls, 0);
});

test('rejects values that are not structurally bolt11 invoices before wallet calls', async () => {
  let calls = 0;
  const handler = createRequestHandler({ walletService: walletService({
    payInvoice: async () => { calls += 1; return { paid: true }; },
  }) });
  const result = await withPayAuth('test-runtime-token', () => request(handler, '/api/pay', {
    method: 'POST',
    headers: { authorization: 'Bearer test-runtime-token' },
    body: JSON.stringify({ bolt11: 'not-a-bolt11' }),
  }));
  assert.equal(result.status, 400);
  assert.equal(calls, 0);
});

test('pays a valid invoice and returns public payment data', async () => {
  const handler = createRequestHandler({ walletService: walletService() });
  await withPayAuth('test-runtime-token', async () => {
    const result = await request(handler, '/api/pay', { method: 'POST', body: JSON.stringify({ bolt11: 'lnbc1test' }) });
    const authorized = await request(handler, '/api/pay', {
      method: 'POST',
      headers: { authorization: 'Bearer test-runtime-token' },
      body: JSON.stringify({ bolt11: 'lnbc1test' }),
    });
    assert.equal(result.status, 401);
    assert.equal(authorized.status, 200);
    assert.deepEqual(authorized.body, { ok: true, data: { bolt11: 'lnbc1test', paid: true } });
  });
});

test('fails closed on missing or wrong payment authorization before wallet calls', async () => {
  let calls = 0;
  const handler = createRequestHandler({ walletService: walletService({
    payInvoice: async () => { calls += 1; return { bolt11: 'lnbc1test', paid: true }; },
  }) });
  const missing = await withPayAuth(undefined, () => request(handler, '/api/pay', {
    method: 'POST', body: JSON.stringify({ bolt11: 'lnbc1test' }),
  }));
  const wrong = await withPayAuth('test-runtime-token', () => request(handler, '/api/pay', {
    method: 'POST',
    headers: { authorization: 'Bearer wrong-token' },
    body: JSON.stringify({ bolt11: 'lnbc1test' }),
  }));
  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(missing.body, { ok: false, error: 'Unauthorized' });
  assert.equal(calls, 0);
});

test('sanitizes wallet failures and does not expose WDK details', async () => {
  const failure = new TypeError('mnemonic=top-secret privateKey=hidden');
  const handler = createRequestHandler({ walletService: walletService({ createInvoice: async () => { throw failure; } }) });
  {
    const result = await request(handler, '/api/invoice', { method: 'POST', body: JSON.stringify({ amountSats: 42 }) });
    assert.equal(result.status, 502);
    assert.deepEqual(result.body, { ok: false, error: 'Wallet service unavailable' });
    assert.doesNotMatch(JSON.stringify(result.body), /top-secret|hidden|mnemonic|privateKey/);
  }
});
