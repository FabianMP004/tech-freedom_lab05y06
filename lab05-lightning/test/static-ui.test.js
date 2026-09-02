const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');

function makeElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    dataset: {},
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    querySelector() { return null; },
  };
}

function loadUi(fetchImpl, { setTimeoutImpl = (callback) => callback() } = {}) {
  const ids = [
    'status', 'receive-form', 'receive-amount', 'receive-result', 'receive-bolt11',
    'receive-qr', 'receive-copy', 'receive-state', 'pay-form', 'payment-request', 'pay-token',
    'pay-result', 'pay-state', 'pay-copy',
  ];
  const elements = Object.fromEntries(ids.map((id) => [`#${id}`, makeElement()]));
  const document = { querySelector(selector) { return elements[selector] || null; } };
  const context = {
    document,
    fetch: fetchImpl,
    setTimeout: setTimeoutImpl,
    clearTimeout() {},
    navigator: { clipboard: { writeText: async () => {} } },
    console,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8'), context);
  return { elements, ui: context.module.exports };
}

test('Receive renders the API bolt11 and a QR after creating an invoice', async () => {
  const calls = [];
  const { elements } = loadUi(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return url === '/api/invoice'
          ? { ok: true, data: { invoiceId: 'inv-1', bolt11: 'lnbcrt1receive', amountSats: 21 } }
          : { ok: true, data: { invoiceId: 'inv-1', settled: true } };
      },
    };
  });

  elements['#receive-amount'].value = '21';
  await elements['#receive-form'].listeners.submit({ preventDefault() {} });

  assert.equal(calls[0].url, '/api/invoice');
  assert.deepEqual(JSON.parse(calls[0].options.body), { amountSats: 21 });
  assert.equal(elements['#receive-bolt11'].textContent, 'lnbcrt1receive');
  assert.match(elements['#receive-qr'].innerHTML, /<svg[\s>]/);
});

test('Pay submits the pasted bolt11 with the entered runtime token', async () => {
  let request;
  const { elements } = loadUi(async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, async json() { return { ok: true, data: { bolt11: 'lnbc1pay', paid: true } }; } };
  });

  elements['#payment-request'].value = 'lnbc1pay';
  elements['#pay-token'].value = 'typed-at-runtime';
  await elements['#pay-form'].listeners.submit({ preventDefault() {} });

  assert.equal(request.url, '/api/pay');
  assert.equal(request.options.headers.Authorization, 'Bearer typed-at-runtime');
  assert.deepEqual(JSON.parse(request.options.body), { bolt11: 'lnbc1pay' });
  assert.match(elements['#status'].textContent, /paid|success/i);
});

test('UI source has no embedded secret configuration or token value', () => {
  const source = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  assert.doesNotMatch(source, /(?:WDK_MNEMONIC|WDK_STORAGE_KEY|PAY_AUTH_TOKEN|PRIVATE_KEY|MNEMONIC)\s*=/i);
  assert.doesNotMatch(source, /process\.env|import\.meta\.env/);
});
